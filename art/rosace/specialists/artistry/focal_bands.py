"""One authored hair hierarchy letter on exact same-clump R2 colors.

This projects shade populations into three deliberate connected bands; it is
not an incidental-fragment cleanup or an alternate D9 palette. Face, native
separators/occlusion, silhouette/rim, material AA and azure hair tips stay exact.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

import cluster_finish as C


def replay(raw, d9):
    original = d9.rim
    captured = {}

    def capture(out, *args):
        before = out.copy()
        result = original(out, *args)
        captured["rim"] = np.any(out != before, axis=2)
        return result

    d9.rim = capture
    try:
        stage = C.replay_control(raw, d9)
    finally:
        d9.rim = original
    if "rim" not in captured:
        raise AssertionError("original R2 rim stage not captured")
    stage["rim"] = captured["rim"]
    return stage


def finish(control, ids, light, meta, cfg, stage):
    if cfg["material"] != "hair" or cfg["newColorsAllowed"] or cfg["generatedPixelsUsed"]:
        raise ValueError("same-clump R2 hair colors only")
    roles = {}
    for role_name, role in cfg["roles"].items():
        thresholds = np.asarray(role["lightnessThresholds"], float)
        if thresholds.shape != (2,) or not 0 < thresholds[0] < thresholds[1] < 1 \
                or not 0 <= role["representativePopulationQuantile"] <= 1:
            raise ValueError("ordered dark/form/lit bands required")
        for part_name in role["parts"]:
            if part_name in roles:
                raise ValueError("one authored role per hair part")
            roles[part_name] = (role_name, role)
    if set(roles) != set(cfg["parts"]):
        raise ValueError("every targeted part must have an authored hair role")
    if not 0 < cfg["maxLightnessDelta"] <= .14 or not 0 < cfg["maxOKLabDistance"] <= .16:
        raise ValueError("shade-band projection exceeds reviewed distance bounds")
    mask_cfg = json.loads(Path(C.__file__).with_suffix(".json").read_text())
    mask_cfg["faceMargin144"] = cfg["faceMargin144"]
    labels, _, _, _, sheen, face_box, mismatch = C.masks(control, ids, light, meta, mask_cfg, stage)
    if mismatch.any():
        raise AssertionError("native categorical labels disagree with the matched control")
    part_names = meta["parts"]
    wanted = [int(part_names[name]) for name in cfg["parts"] if name in part_names]
    hid = int(meta["materials"]["hair"]["id"])
    target = (labels // 256 == hid) & np.isin(labels % 256, wanted)
    # Contact protection includes mixed/partial native cells. Pure projection
    # labels intentionally exclude them and are insufficient for this guard.
    h, w = control.shape[:2]
    ss = int(meta["ss"])
    skin_native = (ids[..., 0] == int(meta["materials"]["skin"]["id"])) & (ids[..., 3] > 0)
    skin = skin_native.reshape(h, ss, w, ss).any((1, 3))
    face_contact = skin.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            face_contact |= C.shift(skin, dy, dx, False)
    # Native keep contains exact stamped/painted face features. Skin contact
    # supplies the fringe boundary guard instead of a blanket screen box.
    eligible = target & ~stage["protected"] & ~stage["rim"] & ~sheen & ~face_contact
    out = control.copy()
    reports = []
    for code in np.unique(labels[eligible]):
        region = eligible & (labels == code)
        palette, population = np.unique(control[region, :3], axis=0, return_counts=True)
        ll = C.lab(palette)
        order = np.argsort(ll[:, 0], kind="stable")
        palette, ll, population = palette[order], ll[order], population[order]
        name = next((name for name, p in part_names.items() if p == code % 256), str(code))
        role_name, role = roles[name]
        thresholds = np.asarray(role["lightnessThresholds"], float)
        source_roles = np.searchsorted(thresholds, ll[:, 0], side="right")
        picks, band_role = [], []
        for band in range(3):
            within = np.where(source_roles == band)[0]
            if not len(within):
                continue
            cumulative = population[within].cumsum() / population[within].sum()
            picks.append(within[np.searchsorted(cumulative, role["representativePopulationQuantile"])])
            band_role.append(band)
        bands = palette[picks]
        # Map only within the same authored lightness role. This keeps the
        # lit-area footprint exact and preserves monotonic shading order.
        source_colors = control[region, :3]
        source_lab = C.lab(source_colors)
        pixel_roles = np.searchsorted(thresholds, source_lab[:, 0], side="right")
        band_index = {band: i for i, band in enumerate(band_role)}
        projected = bands[[band_index[int(b)] for b in pixel_roles]]
        difference = C.lab(projected) - source_lab
        bounded = (np.abs(difference[:, 0]) <= cfg["maxLightnessDelta"]) \
            & (np.linalg.norm(difference, axis=1) <= cfg["maxOKLabDistance"])
        final = source_colors.copy()
        final[bounded] = projected[bounded]
        out[region, :3] = final
        final_roles = np.searchsorted(thresholds, C.lab(final)[:, 0], side="right")
        if not np.array_equal(pixel_roles, final_roles):
            raise AssertionError("shade projection changed authored dark/form/lit footprint")
        allowed_colors = {tuple(int(x) for x in color) for color in palette}
        if any(tuple(int(x) for x in color) not in allowed_colors for color in final):
            raise AssertionError("projection introduced a color outside this R2 clump")
        reports.append({"partCode": int(code), "part": name, "role": role_name,
                        "eligiblePixels": int(region.sum()), "lightnessThresholds": thresholds.tolist(),
                        "bandRGB": bands.tolist(), "sourceColors": len(palette),
                        "candidateColors": len(np.unique(final, axis=0)),
                        "changedPixels": int(np.any(final != source_colors, axis=1).sum()),
                        "boundedOutliersKept": int((~bounded).sum()),
                        "sourceBandPopulation": np.bincount(pixel_roles, minlength=3).tolist(),
                        "candidateBandPopulation": np.bincount(final_roles, minlength=3).tolist(),
                        "orderedSameBandProjection": True,
                        "sameClumpR2PaletteSubset": True})
    changed = np.any(out != control, axis=2)
    if (changed & ~eligible).any() or not np.array_equal(control[..., 3], out[..., 3]):
        raise AssertionError("focal finish scope/alpha invariant failed")
    unique = lambda a: int(len(np.unique(a[a[..., 3] > 0, :3], axis=0)))
    _, before_groups = C.components(control[..., :3], labels, target)
    _, after_groups = C.components(out[..., :3], labels, target)
    report = {"px": int(meta["px"]), "changedPixels": int(changed.sum()),
              "eligiblePixels": int(eligible.sum()), "alphaChangedPixels": 0,
              "outsideScopeChangedPixels": 0, "nativeLabelMismatchPixels": 0,
              "skinOrFaceContactChangedPixels": int((changed & face_contact).sum()),
              "sheenChangedPixels": int((changed & sheen).sum()),
              "nativeProtectedChangedPixels": int((changed & stage["protected"]).sum()),
              "rimChangedPixels": int((changed & stage["rim"]).sum()),
              "nonHairChangedPixels": int((changed & (labels // 256 != hid)).sum()),
              "sourceUniqueRGB": unique(control), "candidateUniqueRGB": unique(out),
              "hairComponentsBefore": len(before_groups), "hairComponentsAfter": len(after_groups),
              "litFootprintChangedPixels": 0,
              "sameClumpR2PaletteSubset": True, "faceBox": face_box, "parts": reports}
    return out, eligible, changed, report


def run(source, output):
    source, output = source.resolve(), output.resolve()
    if output.exists() or (C.REPO / "review/rosace").resolve() not in output.parents \
            or source == output or source in output.parents or output in source.parents:
        raise ValueError("fresh separate executing-worktree private output required")
    cfg_path = Path(__file__).with_suffix(".json")
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    sys.path.insert(0, str(C.PIPE / "drive9"))
    import d9_post as d9
    output.mkdir(parents=True)
    for source_path, name in ((Path(__file__), "module-at-execution.py"),
                              (cfg_path, "config-at-execution.json"),
                              (Path(C.__file__), "cluster-dependency-at-execution.py"),
                              (Path(C.__file__).with_suffix(".json"), "cluster-config-at-execution.json")):
        shutil.copyfile(source_path, output / name)
    proof = {"id": cfg["id"], "kind": "authored same-clump shade-band hair hierarchy on saved genuine R2",
             "purpose": cfg["purpose"], "generatedPixelsUsed": False, "newColorsUsed": False,
             "freshNativeRender": False, "motionQualified": False,
             "moduleHash": C.sha(Path(__file__)), "configHash": C.sha(cfg_path),
             "clusterDependencyHash": C.sha(Path(C.__file__)),
             "clusterConfigDependencyHash": C.sha(Path(C.__file__).with_suffix(".json")),
             "source": str(source), "sourceHeadAtExecution": subprocess.check_output(
                 ["git", "-C", str(C.REPO), "rev-parse", "HEAD"], text=True).strip(),
             "sourceStatusAtExecution": subprocess.check_output(
                 ["git", "-C", str(C.REPO), "status", "--porcelain"], text=True).strip(),
             "finishDependencies": {str(p.relative_to(C.REPO)): C.sha(p) for p in (
                 C.PIPE / "drive9/d9_post.py", C.PIPE / "drive9/r2_finish.json",
                 C.PIPE / "drive9/d9_finish.json", C.PIPE / "drive9/r2_faces.json")}, "rows": []}
    for px in (144, 80):
        src = source / "idle" / f"px{px}"
        raw = output / "control/idle" / f"px{px}"
        raw.mkdir(parents=True)
        hashes = {name: C.sha(src / name) for name in C.RAW}
        finished_hashes = {name: C.sha(src / "R2" / name) for name in ("still.png", "still_ground.png")}
        for name in C.RAW:
            shutil.copyfile(src / name, raw / name)
        stage = replay(raw, d9)
        ctrl = raw / "R2"
        for name in finished_hashes:
            if not np.array_equal(np.asarray(Image.open(src / "R2" / name)), np.asarray(Image.open(ctrl / name))):
                raise AssertionError(f"exact R2 control failed: {px}/{name}")
        control = np.asarray(Image.open(ctrl / "still.png").convert("RGBA"))
        ids = np.asarray(Image.open(src / "id.png").convert("RGBA"))
        light = np.asarray(Image.open(src / "light.png").convert("RGB"))
        meta = json.loads((src / "meta.json").read_text())
        candidate, eligible, changed, row = finish(control, ids, light, meta, cfg, stage)
        dest = output / "candidate/idle" / f"px{px}"
        dest.mkdir(parents=True)
        Image.fromarray(candidate).save(dest / "still.png")
        ground = np.asarray(Image.open(ctrl / "still_ground.png").convert("RGBA")).copy()
        ground[changed, :3] = candidate[changed, :3]
        Image.fromarray(ground).save(dest / "still_ground.png")
        overlay = np.zeros_like(candidate)
        overlay[eligible] = (40, 180, 100, 255)
        overlay[changed] = (255, 80, 100, 255)
        Image.fromarray(overlay).save(dest / "eligible-delta.png")
        np.savez_compressed(dest / "native-stage.npz", **stage)
        raw_image = Image.open(src / "beauty.png").convert("RGBA").resize(
            (control.shape[1], control.shape[0]), Image.Resampling.NEAREST)
        raw_image.save(dest / "raw-nearest-diagnostic.png")
        for scale in (1, 4):
            C.panel([Image.fromarray(control), Image.fromarray(candidate)], ["A", "B"],
                    output / f"comparison-{px}-x{scale}.png", scale)
            C.panel([raw_image, Image.fromarray(control), Image.fromarray(candidate), Image.fromarray(overlay)],
                    ["raw diagnostic", "control", "candidate", "scope / delta"],
                    output / f"raw-finish-scope-{px}-x{scale}.png", scale)
        x0, y0, x1, y1 = row["faceBox"]
        ratio = px / 144
        box = (max(0, x0 - round(9 * ratio)), max(0, y0 - round(13 * ratio)),
               min(control.shape[1], x1 + round(9 * ratio)), y1)
        for scale in (1, 6):
            C.panel([Image.fromarray(control).crop(box), Image.fromarray(candidate).crop(box)], ["A", "B"],
                    output / f"hair-face-{px}-x{scale}.png", scale)
        if hashes != {name: C.sha(src / name) for name in C.RAW} \
                or finished_hashes != {name: C.sha(src / "R2" / name) for name in finished_hashes}:
            raise AssertionError("preserved R2 raw/finish changed")
        row.update({"controlChangedPixels": 0, "controlGroundChangedPixels": 0,
                    "rawHashes": hashes, "preservedFinishedHashes": finished_hashes,
                    "candidateHash": C.sha(dest / "still.png"), "roi": box,
                    "nativeStageHash": C.sha(dest / "native-stage.npz")})
        proof["rows"].append(row)
    (output / "proof.json").write_text(json.dumps(proof, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(output), "rows": [{k: v for k, v in r.items()
                      if k not in ("rawHashes", "parts")} for r in proof["rows"]]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    run(args.root, args.out)
