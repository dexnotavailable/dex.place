"""Glaive-hands lane: mark the recorded landmarks (butt, tip, grip targets, grip points, hips, pelvis) on a still.

  python tools/art-construct/gh_marks.py OUT.png --z 4 [--crop x0,y0,x1,y1] STILL_DIR[::label] ...
Grip target = cyan, the hand's 3D grip point = magenta, butt = red, pelvis/hips = yellow, shoulders = green.
"""
import argparse
import json
import os

from PIL import Image, ImageDraw


def marked(still, z, crop, base="noface"):
    im = Image.open(os.path.join(still, base + ".png")).convert("RGBA")
    lm = json.load(open(os.path.join(still, "landmarks.json")))
    bg = Image.new("RGBA", im.size, (96, 96, 104, 255))
    bg.alpha_composite(im)
    ox, oy = (crop[0], crop[1]) if crop else (0, 0)
    if crop:
        bg = bg.crop(crop)
    bg = bg.resize((bg.width * z, bg.height * z), Image.NEAREST)
    d = ImageDraw.Draw(bg)

    def dot(p, c, r=3):
        x, y = (p[0] - ox) * z, (p[1] - oy) * z
        d.ellipse([x - r, y - r, x + r, y + r], outline=c, width=2)
    J = lm["joints"]
    for k in ("pelvis_c", "hip_L", "hip_R"):
        dot(J[k], (255, 230, 0))
    for k in ("shoulder_L", "shoulder_R"):
        dot(J[k], (0, 230, 0))
    if "haft" in lm:
        dot(lm["haft"]["butt"], (255, 40, 40), 4)
        for s, g in lm.get("grips", {}).items():
            dot(g["target"], (0, 230, 255), 4)
            dot(g["point"], (255, 0, 255), 2)
    return bg


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import gh_view
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("stills", nargs="+")
    ap.add_argument("--z", type=int, default=4)
    ap.add_argument("--crop", default=None)
    ap.add_argument("--base", default="noface")
    a = ap.parse_args()
    crop = tuple(int(v) for v in a.crop.split(",")) if a.crop else None
    tiles = []
    for s in a.stills:
        p, _, lab = s.partition("::")
        tiles.append((marked(p, a.z, crop, a.base), lab))
    W = sum(t.width for t, _ in tiles) + 8 * (len(tiles) + 1)
    H = max(t.height for t, _ in tiles) + 30
    sh = Image.new("RGBA", (W, H), (36, 36, 42, 255))
    dr = ImageDraw.Draw(sh)
    x = 8
    for t, lab in tiles:
        sh.paste(t, (x, 22))
        dr.text((x, 4), lab, fill=(230, 230, 230))
        x += t.width + 8
    sh.save(a.out)
