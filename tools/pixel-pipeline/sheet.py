"""Compose PNGs side by side on a flat backdrop, nearest-neighbour scaled (review sheets).

  python sheet.py --out sheet.png [--scale 3] [--bg 70,70,78] [--label] a.png b.png ...
Images are bottom-aligned (feet on one line). Labels are the parent folder + file name.
"""
import argparse
import os

from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--scale", type=float, default=1)
ap.add_argument("--bg", default="70,70,78")
ap.add_argument("--gap", type=int, default=12)
ap.add_argument("--label", action="store_true")
ap.add_argument("--maxh", type=int, default=0, help="downscale (smooth) so the sheet is at most this tall")
ap.add_argument("imgs", nargs="+")
a = ap.parse_args()
bg = tuple(int(x) for x in a.bg.split(",")) + (255,)
ims = []
for p in a.imgs:
    im = Image.open(p).convert("RGBA")
    if a.scale != 1:
        im = im.resize((int(im.width * a.scale), int(im.height * a.scale)), Image.NEAREST)
    ims.append((p, im))
H = max(im.height for _, im in ims) + (18 if a.label else 0) + 2 * a.gap
W = sum(im.width for _, im in ims) + a.gap * (len(ims) + 1)
sheet = Image.new("RGBA", (W, H), bg)
d = ImageDraw.Draw(sheet)
x = a.gap
for p, im in ims:
    y = H - a.gap - im.height
    sheet.alpha_composite(im, (x, y))
    if a.label:
        d.text((x, 2), os.path.basename(os.path.dirname(p)) + "/" + os.path.basename(p), fill=(230, 230, 230, 255))
    x += im.width + a.gap
if a.maxh and sheet.height > a.maxh:
    k = a.maxh / sheet.height
    sheet = sheet.resize((int(sheet.width * k), a.maxh), Image.LANCZOS)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
sheet.save(a.out)
print(a.out, sheet.size)
