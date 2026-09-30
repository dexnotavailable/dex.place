"""Authored face construction letters on genuine preserved R2 raw passes.

Finish-only pixel experiment, no image model or new Blender/native claim. Only
eye or closed-smile construction changes; pose/head/body/palette remain R2.
Original files and raw/finished controls are read-only. General face stamps
remain anchor-driven and can carry to poses rather than per-still paint layers.
"""
import argparse
import copy
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

PIPE = Path(__file__).resolve().parents[1]
REPO = PIPE.parents[1]
sys.path.insert(0, str(PIPE / "drive9"))
import d9_post as D9  # noqa: E402

RAW = ("beauty.png", "depth.png", "id.png", "light.png", "meta.json", "noise.png",
       "normal.png", "facepass.json", "landmarks.json")


def candidates(base):
    eyes = copy.deepcopy(base)
    eyes["stamps"]["144"]["eye_near_open"]["rows"] = [
        "O.......", ".OOOOOk.", ".WaaaW..", "..awKa..", "...ccw..", "...dd4..", "........"]
    eyes["stamps"]["144"]["eye_far_open"]["rows"] = [
        "......O", ".kOOOO.", "..aaaW.", ".wKca..", "..cdw..", ".4dd...", "......."]
    eyes["stamps"]["80"]["eye_near_open"]["rows"] = ["Ok.", "wKa", ".dc"]
    eyes["stamps"]["80"]["eye_far_open"]["rows"] = [".kO", "wKa", "dc."]
    smile = copy.deepcopy(base)
    smile["stamps"]["144"]["mouth_smirk"]["rows"] = ["4..4", ".44."]
    smile["stamps"]["80"]["mouth_smirk"]["rows"] = ["4.4", ".4."]
    combined = copy.deepcopy(eyes)
    for px in ("144", "80"):
        combined["stamps"][px]["mouth_smirk"] = copy.deepcopy(smile["stamps"][px]["mouth_smirk"])
    return {"F0": copy.deepcopy(base), "F1": eyes, "F2": smile, "F3": combined}


def run(source, output):
    source, output = source.resolve(), output.resolve()
    if output.exists() or source == output or source in output.parents or output in source.parents:
        raise ValueError("fresh output separate from preserved raw source required")
    if not (REPO / "review/rosace").resolve() in output.parents:
        raise ValueError("face experiment belongs in private review tree")
    output.mkdir(parents=True)
    base = json.loads((PIPE / "drive9/r2_faces.json").read_text(encoding="utf-8"))
    recipes = candidates(base)
    proof = {"kind": "authored finish-only face pixels on genuine R2 raw passes",
             "source": str(source), "noFreshNativeClaim": True, "rows": []}
    for label, recipe in recipes.items():
        path = output / f"{label}-faces.json"
        path.write_text(json.dumps(recipe, indent=2), encoding="utf-8")
        finish = D9.load_finish(str(PIPE / "drive9/r2_finish.json"))
        finish["r2_faces"] = str(path)
        for px in (144, 80):
            original = source / "idle" / f"px{px}"
            raw = output / label / "idle" / f"px{px}"
            raw.mkdir(parents=True)
            for name in RAW:
                if (original / name).exists():
                    shutil.copyfile(original / name, raw / name)
            D9.process(str(raw), finish, "D1", "R2", True)
            image = np.asarray(Image.open(raw / "R2/still.png").convert("RGBA"))
            control_path = (original / "R2/still.png") if label == "F0" else (output / "F0/idle" / f"px{px}/R2/still.png")
            control = np.asarray(Image.open(control_path).convert("RGBA"))
            if image.shape != control.shape:
                raise AssertionError("framing changed")
            change = np.any(image != control, axis=2)
            meta = json.loads((raw / "meta.json").read_text(encoding="utf-8"))
            points = [meta["anchors"][name] for name in ("eye_L", "eye_R")]
            ss, ratio = meta["ss"], px / 144
            x0 = max(0, int(min(p[0] for p in points) / ss - 7 * ratio))
            x1 = min(image.shape[1], int(max(p[0] for p in points) / ss + 7 * ratio) + 1)
            y0 = max(0, int(min(p[1] for p in points) / ss - 10 * ratio))
            y1 = min(image.shape[0], int(max(p[1] for p in points) / ss + 14 * ratio) + 1)
            allow = np.zeros(change.shape, bool)
            allow[y0:y1, x0:x1] = True
            outside = int((change & ~allow).sum())
            if label == "F0" and change.any():
                raise AssertionError("face control does not reproduce R2")
            if outside or not np.array_equal(image[..., 3], control[..., 3]):
                raise AssertionError(f"face letter changed outside head framing: {label}/{px} {outside}")
            proof["rows"].append({"letter": label, "px": px, "changedPixels": int(change.sum()),
                                   "outsideFaceBox": outside, "alphaChanged": 0, "faceBox": [x0, y0, x1, y1]})
            Image.open(raw / "R2/still_ground.png").crop((x0, y0, x1, y1)).resize(
                ((x1-x0)*8, (y1-y0)*8), Image.Resampling.NEAREST).save(raw / "face_x8.png")
    for px in (144, 80):
        panels = [Image.open(output / label / "idle" / f"px{px}/R2/still_ground.png").convert("RGBA")
                  for label in recipes]
        width, height = panels[0].size
        scale = 3
        sheet = Image.new("RGB", (4 * (width * scale + 20), height * scale + 36), "#212126")
        draw = ImageDraw.Draw(sheet)
        for index, (label, image) in enumerate(zip(recipes, panels)):
            x = index * (width * scale + 20) + 10
            draw.text((x, 6), label, fill="#d9d0bb")
            resized = image.resize((width*scale, height*scale), Image.Resampling.NEAREST)
            sheet.paste(resized, (x, 27), resized)
        sheet.save(output / f"face-construction-{px}-x3.png")
    (output / "proof.json").write_text(json.dumps(proof, indent=2), encoding="utf-8")
    print(json.dumps(proof))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    run(args.root, args.out)
