"""One coordinated face finish on preserved native R2 raw passes.

F1 is the prior eye-only experimental seed, not a promoted baseline. Face2
uses a shared projected eyeline for tapered lids and brows, a shared iris
offset, and skin-only cheek/jaw planes. Actual mesh/head pose remains R2.
No mouth edit, image generation, native render, or canonical write.
"""
import argparse
import copy
import hashlib
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

PIPE = Path(__file__).resolve().parents[1]
REPO = PIPE.parents[1]
sys.path.insert(0, str(PIPE / "drive9"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import d9_post as D
import face_trial as F1
import wh2_px as W


def recipe(base):
    result = F1.candidates(base)["F1"]
    specs = result["stamps"]["144"]
    specs["eye_near_open"] = {"c": [3.5, 2.5], "rows": [
        "O......", ".OOOOOk", ".WaaKW.", "..wcd..", "...d4.."], "_face2_basis": True}
    specs["eye_far_open"] = {"c": [2.5, 2.5], "rows": [
        ".....O", ".kOOOO", ".WaKW.", "..wcd.", "...4.."], "_face2_basis": True}
    specs["brow_near"] = {"c": [1.5, 1.0], "dy": -4, "dx": 0,
                          "rows": [".mm.", "m..m"], "_face2_basis": True}
    specs["brow_far"] = {"c": [1.5, 1.0], "dy": -4, "dx": 0,
                         "rows": [".mm.", "m..m"], "_face2_basis": True}
    small = result["stamps"]["80"]
    small["eye_near_open"]["rows"] = ["OOk", "aKw", ".d4"]
    small["eye_far_open"]["rows"] = ["kOO", "aKw", ".d4"]
    for size in ("144", "80"):
        for name in ("eye_near_open", "eye_far_open"):
            result["stamps"][size][name]["_face2_basis"] = True
    result["_face2"] = {"kind": "shared projected eyeline, gaze and cheek/jaw finish",
                        "headPose": "unchanged R2 mesh/head turn", "mouth": "unchanged R2"}
    return result


def run(source, output):
    source, output = source.resolve(), output.resolve()
    if output.exists() or source == output or source in output.parents or output in source.parents:
        raise ValueError("fresh separate output required")
    if not (REPO / "review/rosace").resolve() in output.parents:
        raise ValueError("only executing worktree's private review output allowed")
    output.mkdir(parents=True)
    base = json.loads((PIPE / "drive9/r2_faces.json").read_text(encoding="utf-8"))
    recipes = {"R2": base, "F1": F1.candidates(base)["F1"], "Face2": recipe(base)}
    original = (D.stamp_face, D.r2_face_paint, W.cells, W.fit_eyes)
    state = {}
    proof = {"kind": "authored finish-only face on genuine R2 native raw", "rows": [],
             "meshHeadPoseChanged": False, "mouthChanged": False, "noFreshNativeClaim": True}

    def stamp(*args, **kwargs):
        meta, fp = args[4], args[5]
        points = sorted([np.array(meta["anchors"][n][:2]) / meta["ss"] for n in ("eye_L", "eye_R")], key=lambda p: p[0])
        delta = points[1] - points[0]
        if abs(delta[0]) < 1.5:
            raise ValueError("Face2 first proof is a separated-eye view; profiles need qualification")
        state.update(meta=meta, fp=fp, slope=float(np.clip(delta[1] / delta[0], -.5, .5)))
        return original[0](*args, **kwargs)

    def cells(st, ax, ay, mirror, dx=0, dy=0):
        result = original[2](st, ax, ay, mirror, dx, dy)
        if not st.get("_face2_basis"):
            return result
        return [(x, y + int(round(state["slope"] * (x + .5 - ax - dx))), ch) for x, y, ch in result]

    def fit(S, specs, mirror, allow, rng, gap):
        # Preserve each native vertical eye anchor; horizontal fitting handles fringe occlusion.
        return original[3](S, specs, mirror, allow, (rng[0], 0), gap)

    def paint(out, alpha, mat, part, meta, byid, finish, spec, keep):
        report = original[1](out, alpha, mat, part, meta, byid, finish, spec, keep)
        head = alpha & (part == meta["parts"]["head"]) & (mat == meta["materials"]["skin"]["id"])
        free = head & ~keep
        eye = max(meta["anchors"][n][1] / meta["ss"] for n in ("eye_L", "eye_R"))
        chin = float(state["fp"]["chin"][1])
        forward = meta["anchors"].get("head_fwd_screen", [0, 0])[0]
        side = 1 if forward >= 0 else -1
        lut = D.ramp_lut(finish["materials"]["skin"]["stops"])
        cheek = lut[110]
        jaw = lut[85]
        count = {"cheek": 0, "jaw": 0}
        for y in range(max(0, int(eye + 3 * meta["px"] / 144)), min(len(head), int(chin) + 1)):
            xs = np.flatnonzero(head[y])
            if len(xs) < 3:
                continue
            edge = xs[-1] if side > 0 else xs[0]
            width = 2 if meta["px"] == 144 else 1
            for x in xs:
                if not free[y, x]:
                    continue
                if abs(x - edge) < width:
                    out[y, x, :3] = out[y, x, :3] * .45 + cheek * .55
                    count["cheek"] += 1
                if y + 1 < len(head) and not head[y + 1, x] and y > eye + 5 * meta["px"] / 144:
                    out[y, x, :3] = out[y, x, :3] * .65 + jaw * .35
                    count["jaw"] += 1
        report["face2"] = {"sharedEyelineSlope": state["slope"], "skinOnlyPlanes": count,
                           "verticalEyeFit": 0, "headPose": "unchanged", "mouth": "unchanged"}
        return report

    try:
        for name, spec in recipes.items():
            path = output / f"{name}-faces.json"
            path.write_text(json.dumps(spec, indent=2), encoding="utf-8")
            finish = D.load_finish(str(PIPE / "drive9/r2_finish.json"))
            finish["r2_faces"] = str(path)
            if name == "Face2":
                D.stamp_face, D.r2_face_paint, W.cells, W.fit_eyes = stamp, paint, cells, fit
            for px in (144, 80):
                src = source / "idle" / f"px{px}"
                raw = output / name / "idle" / f"px{px}"
                raw.mkdir(parents=True)
                hashes = {}
                for file in F1.RAW:
                    if (src / file).exists():
                        shutil.copyfile(src / file, raw / file)
                        hashes[file] = hashlib.sha256((src / file).read_bytes()).hexdigest()
                D.process(str(raw), finish, "D1", "R2", True)
                img = np.asarray(Image.open(raw / "R2/still.png").convert("RGBA")).copy()
                control = np.asarray(Image.open(source / "idle" / f"px{px}/R2/still.png").convert("RGBA"))
                change = np.any(img != control, axis=2)
                meta = json.loads((raw / "meta.json").read_text())
                points = [meta["anchors"][n] for n in ("eye_L", "eye_R")]
                ratio, ss = px / 144, meta["ss"]
                box = [max(0, int(min(p[0] for p in points) / ss - 7*ratio)),
                       max(0, int(min(p[1] for p in points) / ss - 10*ratio)),
                       min(img.shape[1], int(max(p[0] for p in points) / ss + 7*ratio)+1),
                       min(img.shape[0], int(max(p[1] for p in points) / ss + 14*ratio)+1)]
                x0, y0, x1, y1 = box
                allowed = np.zeros(change.shape, bool)
                allowed[y0:y1, x0:x1] = True
                discarded = 0
                mouth_cells = []
                post = json.loads((raw / "R2/post.json").read_text())
                if name == "Face2":
                    # D9's late global skin requantization depends on face keep masks.
                    # This experiment consumes its face region only, keeping the R2
                    # remainder exact rather than letting that coupling change skin
                    # elsewhere. Preserve the intermediate for honest diagnostics.
                    Image.fromarray(img).save(raw / "R2/chain-intermediate.png")
                    discarded = int((change & ~allowed).sum())
                    img[~allowed] = control[~allowed]
                    mx, my = post["face"]["mouth_at"]
                    mouth_cells = original[2](base["stamps"][str(px)]["mouth_smirk"], mx, my, post["face"]["dir"] < 0)
                    for x, y, _ in mouth_cells:
                        img[y, x] = control[y, x]
                    Image.fromarray(img).save(raw / "R2/still.png")
                    Image.fromarray(img).resize((img.shape[1]*3, img.shape[0]*3), Image.Resampling.NEAREST).save(raw / "R2/still_x3.png")
                    import judge_sheets as J
                    J.f1_grounded(str(raw / "R2")).save(raw / "R2/still_ground.png")
                    change = np.any(img != control, axis=2)
                if (name == "R2" and change.any()) or np.any(change & ~allowed) or not np.array_equal(img[..., 3], control[..., 3]):
                    raise AssertionError(f"control/face isolation/alpha failed: {name}/{px}")
                # Native R2 mouth location and glyph are kept exactly, including its pixel colors.
                proof["rows"].append({"name": name, "px": px, "changedPixels": int(change.sum()),
                    "outsideFaceBox": 0, "alphaChanged": 0, "box": box, "rawHashes": hashes,
                    "discardedIntermediateOutsideFaceChanges": discarded,
                    "mouthPixelsPreserved": [[x, y] for x, y, _ in mouth_cells],
                    "face2": post.get("r2_face", {}).get("face2"), "face": post.get("face")})
                Image.open(raw / "R2/still_ground.png").crop(box).resize(((x1-x0)*8, (y1-y0)*8), Image.Resampling.NEAREST).save(raw / "face_x8.png")
    finally:
        D.stamp_face, D.r2_face_paint, W.cells, W.fit_eyes = original
    for px in (144, 80):
        panels = [Image.open(output / name / "idle" / f"px{px}/R2/still_ground.png").convert("RGBA") for name in recipes]
        w, h = panels[0].size
        sheet = Image.new("RGB", (3*(w*3+20), h*3+32), "#212126")
        draw = ImageDraw.Draw(sheet)
        for i, (name, img) in enumerate(zip(recipes, panels)):
            x = i*(w*3+20)+10
            draw.text((x, 5), name, fill="#d9d0bb")
            large = img.resize((w*3, h*3), Image.Resampling.NEAREST)
            sheet.paste(large, (x, 24), large)
        sheet.save(output / f"face2-{px}-x3.png")
    (output / "proof.json").write_text(json.dumps(proof, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(output), "rows": [{k: v for k, v in row.items() if k not in ("rawHashes", "face")} for row in proof["rows"]]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    run(args.root, args.out)
