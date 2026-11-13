"""Glaive-hands lane: quick look sheets (work files, not the blind A/B sheets: those are gh_sheets.py).

  python tools/art-construct/gh_view.py OUT.png --z 3 [--crop x0,y0,x1,y1] [--bg 96,96,104] IMG[:label] ...
Tiles the images left to right at one zoom over one background, a label over each.
"""
import argparse

from PIL import Image, ImageDraw


def tile(paths, z=3, crop=None, bg=(96, 96, 104), labels=None, gap=8):
    ims = []
    for p in paths:
        im = Image.open(p).convert("RGBA")
        if crop:
            im = im.crop(crop)
        b = Image.new("RGBA", im.size, bg + (255,))
        b.alpha_composite(im)
        ims.append(b.resize((im.width * z, im.height * z), Image.NEAREST))
    W = sum(i.width for i in ims) + gap * (len(ims) + 1)
    H = max(i.height for i in ims) + 2 * gap + 14
    sh = Image.new("RGBA", (W, H), (36, 36, 42, 255))
    d = ImageDraw.Draw(sh)
    x = gap
    for i, im in enumerate(ims):
        sh.paste(im, (x, gap + 14))
        if labels and labels[i]:
            d.text((x, 2), labels[i], fill=(230, 230, 230))
        x += im.width + gap
    return sh


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("imgs", nargs="+")
    ap.add_argument("--z", type=int, default=3)
    ap.add_argument("--crop", default=None)
    a = ap.parse_args()
    paths, labels = [], []
    for s in a.imgs:
        p, _, lab = s.partition("::")
        paths.append(p)
        labels.append(lab)
    crop = tuple(int(v) for v in a.crop.split(",")) if a.crop else None
    tile(paths, a.z, crop, labels=labels).save(a.out)
