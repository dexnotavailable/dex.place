"""Consolidate tiny interior fragments using an existing same-clump color.

Reads genuine native categorical IDs/light and exact finished R2 pixels. No
reference raster, drawing stamp, geometry mutation, resampling or image model.
This is an opt-in still diagnostic; integration and motion qualification are
owned by the Rosace integrator and native delivery lane.
"""
import argparse
from collections import Counter, deque
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parents[4]
PIPE = REPO / "tools/pixel-pipeline"
RAW = ("beauty.png", "depth.png", "id.png", "light.png", "meta.json",
       "noise.png", "normal.png", "facepass.json", "landmarks.json")
N4 = ((-1, 0), (1, 0), (0, -1), (0, 1))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def lab(rgb):
    c = np.asarray(rgb, dtype=float) / 255
    c = np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
    lms = c @ np.array([[.4122214708, .5363325363, .0514459929],
                       [.2119034982, .6806995451, .1073969566],
                       [.0883024619, .2817188376, .6299787005]]).T
    return np.cbrt(lms) @ np.array([[.2104542553, .7936177850, -.0040720468],
                                  [1.9779984951, -2.4285922050, .4505937099],
                                  [.0259040371, .7827717662, -.8086757660]]).T


def shift(a, dy, dx, fill):
    out = np.full_like(a, fill)
    h, w = a.shape[:2]
    out[max(0, dy):min(h, h + dy), max(0, dx):min(w, w + dx)] = \
        a[max(0, -dy):min(h, h - dy), max(0, -dx):min(w, w - dx)]
    return out


def masks(control, ids, light, meta, cfg, stage=None):
    """Full material coverage, native dominant part, one-pixel part interior."""
    h, w = control.shape[:2]
    ss = int(meta["ss"])
    if ids.shape != (h * ss, w * ss, 4) or light.shape[:2] != ids.shape[:2]:
        raise ValueError("native pass dimensions must match the finished canvas and ss")
    if meta["canvas"] != [w, h] or int(meta["px"]) not in (80, 144):
        raise ValueError("only matched native 80/144 stills are qualified")
    blocks = ids.reshape(h, ss, w, ss, 4).transpose(0, 2, 1, 3, 4)
    code = blocks[..., 0].astype(np.int32) * 256 + blocks[..., 1]
    pure = (blocks[..., 3] == 255).all((2, 3)) & \
        (blocks[..., 0].min((2, 3)) == blocks[..., 0].max((2, 3)))
    # Within one material its priority weight is constant. This is F1's
    # dominant label rule, including the first-subpixel tie break; a mixed
    # material/coverage cell never becomes eligible regardless of that mode.
    flat = code.reshape(h, w, ss * ss)
    labels = np.full((h, w), -1, dtype=np.int32)
    support = np.zeros((h, w), dtype=np.int32)
    for i in range(ss * ss):
        counts = (flat == flat[..., i, None]).sum(2)
        better = counts > support
        labels[better] = flat[..., i][better]
        support[better] = counts[better]
    labels = np.where(pure, labels, -1)
    label_mismatch = np.zeros((h, w), bool)
    if stage is not None:
        if stage["labels"].shape != (h, w) or stage["protected"].shape != (h, w):
            raise ValueError("matched R2 semantic stage dimensions required")
        label_mismatch = pure & (labels != stage["labels"])
        labels = np.where(pure & ~label_mismatch, stage["labels"], -1)
    mids = labels // 256
    hair_ids = [int(meta["materials"][n]["id"]) for n in cfg["materials"]]
    hair = np.isin(mids, hair_ids) & (control[..., 3] == 255)
    eligible = hair.copy()
    for dy, dx in N4:
        if stage is None:
            # Conservative standalone mode keeps the whole part edge halo.
            eligible &= shift(labels, dy, dx, -2) == labels
        else:
            # Native replay protects actual lower-lit separator cells and
            # occlusion lines rather than eroding both sides of each clump.
            eligible &= shift(mids, dy, dx, -2) == mids
        eligible &= shift(control[..., 3], dy, dx, 0) == 255
    if stage is not None:
        eligible &= ~stage["protected"]

    head = np.zeros((h, w), bool)
    eyes = [meta["anchors"][n] for n in ("eye_L", "eye_R")]
    ratio = int(meta["px"]) / 144
    mx, above, below = np.array(cfg["faceMargin144"]) * ratio
    x0 = max(0, int(np.floor(min(p[0] for p in eyes) / ss - mx)))
    x1 = min(w, int(np.ceil(max(p[0] for p in eyes) / ss + mx)) + 1)
    y0 = max(0, int(np.floor(min(p[1] for p in eyes) / ss - above)))
    y1 = min(h, int(np.ceil(max(p[1] for p in eyes) / ss + below)) + 1)
    head[y0:y1, x0:x1] = True

    hid = int(meta["materials"]["hair"]["id"])
    native_hair = (ids[..., 0] == hid) & (ids[..., 3] > 0)
    spec = light[..., 2].astype(float) / 255 * native_hair
    coverage = spec.reshape(h, ss, w, ss).mean((1, 3))
    core = coverage >= cfg["sheenCoverage"]
    sheen = core.copy()
    for dy, dx in ((0, 1), (0, -1), (0, 2), (0, -2), (1, 0), (-1, 0)):
        sheen |= shift(core, dy, dx, False)
    eligible &= ~head & ~sheen
    return labels, hair, eligible, head, sheen, [x0, y0, x1, y1], label_mismatch


def components(rgb, labels, hair):
    """Exact RGB components; connectivity never crosses a native part."""
    h, w = labels.shape
    index = np.full((h, w), -1, dtype=np.int32)
    groups = []
    for sy, sx in zip(*np.where(hair)):
        if index[sy, sx] >= 0:
            continue
        i = len(groups)
        color = tuple(int(c) for c in rgb[sy, sx])
        part = int(labels[sy, sx])
        q = deque([(int(sy), int(sx))])
        index[sy, sx] = i
        pixels = []
        while q:
            y, x = q.popleft()
            pixels.append((y, x))
            for dy, dx in N4:
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and index[yy, xx] < 0 \
                        and hair[yy, xx] and labels[yy, xx] == part \
                        and tuple(int(c) for c in rgb[yy, xx]) == color:
                    index[yy, xx] = i
                    q.append((yy, xx))
        groups.append({"color": color, "part": part, "pixels": pixels})
    return index, groups


def finish(control, ids, light, meta, cfg, stage=None):
    if set(cfg["materials"]) != {"hair", "hairtip"}:
        raise ValueError("artistry scope is hair/hairtip only")
    if control.dtype != np.uint8 or control.ndim != 3 or control.shape[2] != 4:
        raise ValueError("finished control must be uint8 RGBA")
    if any(not 1 <= cfg["maxFragmentPixels"][str(px)] <= cap for px, cap in ((144, 6), (80, 2))):
        raise ValueError("fragment limits exceed the reviewed 144/80 scope")
    if not 0 < cfg["maxOKLabDistance"] <= .10 or not 0 < cfg["maxLightnessDelta"] <= .08:
        raise ValueError("color distance limits exceed the reviewed scope")
    if cfg["minSupportRatio"] < 2 or cfg["minBoundaryContacts"] < 2:
        raise ValueError("fragment must have larger adjacent support")
    if cfg["iterations"] != 1:
        raise ValueError("one synchronous pass only; repeated erosion is unqualified")
    labels, hair, eligible, head, sheen, face_box, mismatch = masks(control, ids, light, meta, cfg, stage)
    index, groups = components(control[..., :3], labels, hair)
    maximum = cfg["maxFragmentPixels"][str(meta["px"])]
    out = control.copy()
    edits = []
    for i, group in enumerate(groups):
        pixels = group["pixels"]
        if len(pixels) > maximum or not all(eligible[y, x] for y, x in pixels):
            continue
        neighbors = Counter()
        for y, x in pixels:
            for dy, dx in N4:
                j = int(index[y + dy, x + dx])
                if j >= 0 and j != i and groups[j]["part"] == group["part"]:
                    neighbors[j] += 1
        valid = []
        own_lab = lab(group["color"])
        for j, contacts in neighbors.items():
            target = groups[j]
            delta = lab(target["color"]) - own_lab
            if len(target["pixels"]) >= cfg["minSupportRatio"] * len(pixels) \
                    and len(target["pixels"]) > maximum \
                    and contacts >= cfg["minBoundaryContacts"] \
                    and abs(delta[0]) <= cfg["maxLightnessDelta"] \
                    and np.linalg.norm(delta) <= cfg["maxOKLabDistance"]:
                valid.append((-contacts, float(np.linalg.norm(delta)), j))
        if not valid:
            continue
        _, distance, j = min(valid)
        target = groups[j]
        for y, x in pixels:
            out[y, x, :3] = target["color"]
        edits.append({"partCode": group["part"], "pixels": pixels,
                      "fromRGB": group["color"], "toRGB": target["color"],
                      "supportPixels": len(target["pixels"]),
                      "contacts": neighbors[j], "OKLabDistance": distance})
    changed = np.any(out != control, axis=2)
    if (changed & ~eligible).any() or not np.array_equal(out[..., 3], control[..., 3]):
        raise AssertionError("scope/alpha invariant failed")
    for group in groups:
        ys, xs = np.array(group["pixels"]).T
        palette = {g["color"] for g in groups if g["part"] == group["part"]}
        if any(tuple(int(c) for c in color) not in palette for color in out[ys, xs, :3]):
            raise AssertionError("color outside original same-clump palette")
    _, after = components(out[..., :3], labels, hair)
    colors = lambda a, mask: int(len(np.unique(a[mask, :3], axis=0)))
    report = {"changedPixels": int(changed.sum()), "alphaChangedPixels": 0,
              "outsideEligiblePixels": 0, "protectedFaceChangedPixels": int((changed & head).sum()),
              "protectedSheenChangedPixels": int((changed & sheen).sum()),
              "nativeLabelMismatchPixels": int(mismatch.sum()),
              "exactNativeStage": stage is not None,
              "protectedNativeStageChangedPixels": int((changed & stage["protected"]).sum()) if stage else 0,
              "protectedSeparatorPixels": int(stage["separators"].sum()) if stage else None,
              "hairPixels": int(hair.sum()), "eligiblePixels": int(eligible.sum()),
              "faceBox": face_box, "componentsBefore": len(groups), "componentsAfter": len(after),
              "smallComponentsBefore": sum(len(g["pixels"]) <= maximum for g in groups),
              "smallComponentsAfter": sum(len(g["pixels"]) <= maximum for g in after),
              "hairUniqueRGBBefore": colors(control, hair), "hairUniqueRGBAfter": colors(out, hair),
              "sameClumpPaletteSubset": True, "edits": edits}
    return out, eligible, changed, report


def separator_mask(out, alpha, mat, part, byid, fin, keep, d9):
    """R2 selection at the actual pre-clump stage, including unchanged cells."""
    cfg = fin["hair_clumps"]
    hair_ids = [m for m, n in byid.items() if n in ("hair", "hairtip")]
    hair = alpha & np.isin(mat, hair_ids)
    if not (hair & ~keep).any():
        return np.zeros_like(hair)
    lightness = d9.oklab(np.clip(out[..., :3], 0, 255))[..., 0]
    selected = np.zeros_like(hair)
    for dy, dx in ((0, 1), (1, 0)):
        other = hair & d9.F1.shift(hair, -dy, -dx, False) \
            & (d9.F1.shift(part, -dy, -dx, 0) != part)
        other_l = d9.F1.shift(lightness, -dy, -dx, 0.)
        selected |= other & (lightness <= other_l)
        selected |= d9.F1.shift(other & (lightness > other_l), dy, dx, False)
    selected &= hair & ~keep
    regions, count = d9.F1.clusters(selected)  # native N8 connectivity
    for i in range(1, count + 1):
        if (regions == i).sum() < cfg["min_run"]:
            selected[regions == i] = False
    return selected


def replay_control(raw, d9):
    """Read-only synchronous instrumentation; shared source is untouched."""
    original = d9.hair_clumps
    stage = {}

    def capture(out, alpha, mat, part, byid, fin, keep):
        separators = separator_mask(out, alpha, mat, part, byid, fin, keep, d9)
        stage.update({"labels": mat.copy() * 256 + part.copy(),
                      "protected": keep.copy() | separators,
                      "separators": separators})
        result = original(out, alpha, mat, part, byid, fin, keep)
        if result != int(separators.sum()):
            raise AssertionError("separator instrumentation disagrees with frozen R2")
        return result

    d9.hair_clumps = capture
    try:
        d9.process(str(raw), d9.load_finish(str(PIPE / "drive9/r2_finish.json")), "D1", "R2", True)
    finally:
        d9.hair_clumps = original
    if not stage:
        raise AssertionError("matched native semantic stage was not captured")
    return stage


def panel(images, labels, path, scale=1):
    w, h = images[0].size
    sheet = Image.new("RGB", (len(images) * (w * scale + 18), h * scale + 26), "#212126")
    draw = ImageDraw.Draw(sheet)
    for i, (im, label) in enumerate(zip(images, labels)):
        x = i * (w * scale + 18) + 9
        draw.text((x, 5), label, fill="#d9d0bb")
        big = im.resize((w * scale, h * scale), Image.Resampling.NEAREST)
        sheet.paste(big, (x, 23), big)
    sheet.save(path)


def run(source, output):
    source, output = source.resolve(), output.resolve()
    private = (REPO / "review/rosace").resolve()
    if output.exists() or private not in output.parents or source == output \
            or source in output.parents or output in source.parents:
        raise ValueError("fresh separate executing-worktree private output required")
    cfg_path = Path(__file__).with_name("cluster_finish.json")
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    sys.path.insert(0, str(PIPE / "drive9"))
    import d9_post as d9
    output.mkdir(parents=True)
    proof = {"id": cfg["id"], "kind": "authored hair-cluster finish on genuine saved native R2",
             "generatedPixelsUsed": False, "freshNativeRender": False, "motionQualified": False,
             "source": str(source), "moduleHash": sha(Path(__file__)), "configHash": sha(cfg_path),
             "sourceHeadAtExecution": subprocess.check_output(
                 ["git", "-C", str(REPO), "rev-parse", "HEAD"], text=True).strip(),
             "sourceStatusAtExecution": subprocess.check_output(
                 ["git", "-C", str(REPO), "status", "--porcelain"], text=True).strip(),
             "finishDependencies": {str(p.relative_to(REPO)): sha(p) for p in (
                 PIPE / "drive9/d9_post.py", PIPE / "drive9/r2_finish.json",
                 PIPE / "drive9/d9_finish.json", PIPE / "drive9/r2_faces.json",
                 PIPE / "finish_f1/f1_post.py", PIPE / "drive9/r3_post.py",
                 PIPE / "drive9/r4_post.py", PIPE / "drive9/r5_post.py",
                 PIPE / "finish_judge/judge_sheets.py", REPO / "art/rosace/drive9.json")},
             "rows": []}
    for px in (144, 80):
        src = source / "idle" / f"px{px}"
        raw = output / "control/idle" / f"px{px}"
        raw.mkdir(parents=True)
        hashes = {name: sha(src / name) for name in RAW}
        finished_hashes = {name: sha(src / "R2" / name) for name in ("still.png", "still_ground.png")}
        for name in RAW:
            shutil.copyfile(src / name, raw / name)
        stage = replay_control(raw, d9)
        ctrl_dir = raw / "R2"
        for name in ("still.png", "still_ground.png"):
            if not np.array_equal(np.asarray(Image.open(src / "R2" / name)),
                                  np.asarray(Image.open(ctrl_dir / name))):
                raise AssertionError(f"control replay differs: {px}/{name}")
        control = np.asarray(Image.open(ctrl_dir / "still.png").convert("RGBA"))
        ids = np.asarray(Image.open(src / "id.png").convert("RGBA"))
        light = np.asarray(Image.open(src / "light.png").convert("RGB"))
        meta = json.loads((src / "meta.json").read_text(encoding="utf-8"))
        candidate, eligible, changed, row = finish(control, ids, light, meta, cfg, stage)
        dest = output / "candidate/idle" / f"px{px}"
        dest.mkdir(parents=True)
        Image.fromarray(candidate).save(dest / "still.png")
        ground = np.asarray(Image.open(ctrl_dir / "still_ground.png").convert("RGBA")).copy()
        # Ground is presentation only. Its pixels and sprite alpha stay exact.
        ground[changed, :3] = candidate[changed, :3]
        Image.fromarray(ground).save(dest / "still_ground.png")
        overlay = np.zeros_like(candidate)
        overlay[eligible] = (40, 180, 100, 255)
        overlay[changed] = (255, 80, 100, 255)
        Image.fromarray(overlay).save(dest / "eligible-delta.png")
        np.savez_compressed(dest / "native-stage.npz", **stage)
        raw_image = Image.open(src / "beauty.png").convert("RGBA")
        # A nearest sample of the supersampled raw is diagnostic, never the candidate.
        raw_image = raw_image.resize((control.shape[1], control.shape[0]), Image.Resampling.NEAREST)
        raw_image.save(dest / "raw-nearest-diagnostic.png")
        for scale in (1, 4):
            panel([Image.fromarray(control), Image.fromarray(candidate)], ["A", "B"],
                  output / f"comparison-{px}-x{scale}.png", scale)
            panel([raw_image, Image.fromarray(control), Image.fromarray(candidate), Image.fromarray(overlay)],
                  ["raw diagnostic", "control", "candidate", "scope / delta"],
                  output / f"raw-finish-scope-{px}-x{scale}.png", scale)
        x0, y0, x1, y1 = row["faceBox"]
        ratio = px / 144
        y0 = max(0, y0 - round(13 * ratio))
        box = (max(0, x0 - round(9 * ratio)), y0, min(control.shape[1], x1 + round(9 * ratio)), y1)
        for scale in (1, 6):
            panel([Image.fromarray(control).crop(box), Image.fromarray(candidate).crop(box)], ["A", "B"],
                  output / f"hair-face-{px}-x{scale}.png", scale)
        if hashes != {name: sha(src / name) for name in RAW}:
            raise AssertionError("preserved raw source changed")
        if finished_hashes != {name: sha(src / "R2" / name) for name in finished_hashes}:
            raise AssertionError("preserved finished control changed")
        row.update({"px": px, "controlChangedPixels": 0, "controlGroundChangedPixels": 0,
                    "rawHashes": hashes, "preservedFinishedHashes": finished_hashes,
                    "candidateHash": sha(dest / "still.png"),
                    "groundHash": sha(dest / "still_ground.png"), "roi": box,
                    "rawDiagnosticOnly": True})
        proof["rows"].append(row)
    (output / "proof.json").write_text(json.dumps(proof, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(output), "rows": [{k: v for k, v in r.items()
                        if k not in ("rawHashes", "edits")} for r in proof["rows"]]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    run(args.root, args.out)
