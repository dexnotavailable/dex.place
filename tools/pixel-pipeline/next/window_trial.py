"""Restore the agreed anchor-driven gold-framed skin aperture in2D sprites.

The preserved win0mesh remains closed; this is the intended constructed-pixel
route, not a new3Dhole or cleavage-shading claim. Colors come from declared
skin/gold finish ramps, never raw-label attribution of arbitrary finalRGB.
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

PIPE = Path(__file__).resolve().parents[1]
REPO = PIPE.parents[1]
sys.path.insert(0, str(PIPE / "drive9"))
import d9_post as D  # noqa: E402
import judge_sheets as J  # noqa: E402


def run(source, output):
    source, output = source.resolve(), output.resolve()
    if output.exists() or source == output or source in output.parents or output in source.parents:
        raise ValueError("use a fresh private output separate from the preserved raw tree")
    if not (REPO / "review/rosace").resolve() in output.parents:
        raise ValueError("window trial writes only private review")
    output.mkdir(parents=True)
    finish = D.load_finish(str(PIPE / "drive9/r2_finish.json"))
    skin = D.ramp_lut(finish["materials"]["skin"]["stops"])
    gold = D.ramp_lut(finish["materials"]["gold"]["stops"])
    tones = {"litSkin": skin[190], "shadeSkin": skin[145], "goldFrame": gold[175]}
    proof = {"kind": "constructed2D gold-framed skin aperture; underlying win0mesh unchanged",
             "rows": [], "noNativeMeshHoleClaim": True}
    for px in (144, 80):
        raw = output / "raw/idle" / f"px{px}"
        raw.mkdir(parents=True)
        original = source / "idle" / f"px{px}"
        for name in ("beauty.png", "depth.png", "id.png", "light.png", "meta.json", "noise.png",
                     "normal.png", "facepass.json", "landmarks.json"):
            if (original / name).exists():
                shutil.copyfile(original / name, raw / name)
        D.process(str(raw), finish, "D1", "control", True)
        baseline = np.asarray(Image.open(raw / "control/still.png").convert("RGBA")).copy()
        preserved = np.asarray(Image.open(original / "R2/still.png").convert("RGBA"))
        if not np.array_equal(baseline, preserved):
            raise AssertionError("window control differs from R2")
        meta = json.loads((raw / "meta.json").read_text(encoding="utf-8"))
        top, bottom = [np.array(meta["anchors"][name][:2]) / meta["ss"]
                       for name in ("glyph_outfit_win_t", "glyph_outfit_win_b")]
        if meta["anchors"]["glyph_outfit_win_t"][3] < 0.25:
            raise ValueError("window is not facing camera in this idle trial")
        direction = bottom - top
        length = np.linalg.norm(direction)
        direction /= length
        perpendicular = np.array([-direction[1], direction[0]])
        ids, color = D.paint(str(raw), meta, finish)
        normal = np.asarray(Image.open(raw / "normal.png").convert("RGB"), float) / 255 * 2 - 1
        depth = np.asarray(Image.open(raw / "depth.png").convert("RGB"), float)[..., 0] / 255
        alpha, mat, part = D.F1.downsample(meta, ids, color, normal, depth, 0.35)[:3]
        allowed = alpha & np.isin(part, [meta["parts"][name] for name in ("body", "bodice")])
        for letter, width in (("W1", 5 if px == 144 else 4), ("W2", 7 if px == 144 else 5)):
            image = baseline.copy()
            mask = np.zeros(alpha.shape, bool)
            border = np.zeros(alpha.shape, bool)
            expected = 0
            for y in range(image.shape[0]):
                for x in range(image.shape[1]):
                    relative = np.array([x + 0.5, y + 0.5]) - top
                    t = relative @ direction / length
                    half = width * 0.5 * (1 - abs(2 * t - 1))
                    across = relative @ perpendicular
                    if 0 <= t <= 1 and abs(across) <= half:
                        expected += 1
                        if not allowed[y, x]:
                            continue
                        edge = abs(across) >= max(0, half - 1) or t * length < 1 or (1-t) * length < 1
                        image[y, x, :3] = np.clip(np.round(tones["goldFrame" if edge else
                            ("litSkin" if across >= 0 else "shadeSkin")]), 0, 255).astype(np.uint8)
                        mask[y, x] = True
                        border[y, x] = edge
            change = np.any(image != baseline, axis=2)
            if np.any(change & ~mask) or not np.array_equal(image[..., 3], baseline[..., 3]):
                raise AssertionError("window touched outside its aperture/silhouette")
            target = output / letter / f"px{px}"
            shutil.copytree(raw / "control", target)
            Image.fromarray(image).save(target / "still.png")
            Image.fromarray(image).resize((image.shape[1]*3, image.shape[0]*3), Image.Resampling.NEAREST).save(target / "still_x3.png")
            J.f1_grounded(str(target)).save(target / "still_ground.png")
            Image.fromarray(mask.astype(np.uint8)*255).save(target / "aperture_mask.png")
            proof["rows"].append({"letter": letter, "px": px, "changed": int(change.sum()),
                "framePixels": int(border.sum()), "interiorSkinPixels": int((mask & ~border).sum()),
                "visibleCoverage": float(mask.sum()/max(expected, 1)), "outsideMask": 0,
                "alphaChanged": 0, "crossGuard": "collar/cross parts excluded",
                "limits": "actual window/framing/readability critique pending; constructedsprite route, no mesh opening"})
    (output / "proof.json").write_text(json.dumps(proof, indent=2), encoding="utf-8")
    print(json.dumps(proof))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    run(args.root, args.out)
