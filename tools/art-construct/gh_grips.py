"""Glaive-hands lane: grip crops (before | after) around every grip of a lane stills folder, at x10 (144) / x16 (80).

  python tools/art-construct/gh_grips.py <stills dir> OUT.png [--tags base,still] [--r 13]
"""
import argparse
import json
import os

from PIL import Image, ImageDraw

STILLS = ["idle_hero", "n1_contact", "q_stamp", "n2_pivot_black"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("out")
    ap.add_argument("--tags", default="base,still")
    ap.add_argument("--r", type=int, default=13)
    a = ap.parse_args()
    tags = a.tags.split(",")
    rows = []
    for s in STILLS:
        for px in (144, 80):
            d = os.path.join(a.dir, s, f"px{px}")
            if not os.path.exists(os.path.join(d, "landmarks.json")):
                continue
            lm = json.load(open(os.path.join(d, "landmarks.json")))
            for side, g in lm.get("grips", {}).items():
                x, y = g["target"]
                r = a.r if px == 144 else max(6, int(a.r * 0.6))
                z = 10 if px == 144 else 16
                cells = []
                for t in tags:
                    p = os.path.join(d, t + ".png")
                    if not os.path.exists(p):
                        continue
                    im = Image.open(p).convert("RGBA").crop((int(x) - r, int(y) - r, int(x) + r, int(y) + r))
                    bg = Image.new("RGBA", im.size, (96, 96, 104, 255))
                    bg.alpha_composite(im)
                    cells.append(bg.resize((im.width * z, im.height * z), Image.NEAREST))
                rows.append((f"{s} {px} {side}", cells))
    W = max(sum(c.width + 6 for c in cells) for _, cells in rows) + 150
    per = 3
    # lay out: 3 groups per sheet row
    groups = [rows[i:i + per] for i in range(0, len(rows), per)]
    gh = [max(max(c.height for c in cells) for _, cells in g) + 18 for g in groups]
    gw = max(sum(sum(c.width + 6 for c in cells) + 20 for _, cells in g) for g in groups)
    sh = Image.new("RGBA", (gw, sum(gh)), (30, 30, 34, 255))
    dr = ImageDraw.Draw(sh)
    yy = 0
    for g, h in zip(groups, gh):
        xx = 0
        for lab, cells in g:
            dr.text((xx + 2, yy + 2), lab, fill=(230, 230, 230))
            for c in cells:
                sh.paste(c, (xx, yy + 16))
                xx += c.width + 6
            xx += 20
        yy += h
    sh.save(a.out)
    print(a.out, sh.size)


if __name__ == "__main__":
    main()
