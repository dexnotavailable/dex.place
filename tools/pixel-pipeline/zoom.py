"""Authoring aid: crop a sprite region and blow it up with a pixel grid and coordinates.

  python zoom.py sprite.png x0 y0 x1 y1 out.png [--z 14] [--bg 70,70,78]

Every 5th column/row is labelled with its sprite coordinate so pixel edits (face stamps,
override patches) can be placed by number. Review aid only; nothing reads its output.
"""
import argparse

from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("x0", type=int)
ap.add_argument("y0", type=int)
ap.add_argument("x1", type=int)
ap.add_argument("y1", type=int)
ap.add_argument("out")
ap.add_argument("--z", type=int, default=14)
ap.add_argument("--bg", default="70,70,78")
a = ap.parse_args()
im = Image.open(a.src).convert("RGBA")
bg = Image.new("RGBA", im.size, tuple(int(v) for v in a.bg.split(",")) + (255,))
bg.alpha_composite(im)
c = bg.crop((a.x0, a.y0, a.x1, a.y1))
Z, M = a.z, 26
w, h = c.width * Z, c.height * Z
out = Image.new("RGB", (w + M, h + M), (20, 20, 24))
out.paste(c.resize((w, h), Image.NEAREST).convert("RGB"), (M, M))
d = ImageDraw.Draw(out)
for i in range(c.width + 1):
    x = M + i * Z
    col = (255, 80, 80) if (a.x0 + i) % 5 == 0 else (40, 40, 44)
    d.line([(x, M), (x, M + h)], fill=col, width=1)
    if (a.x0 + i) % 5 == 0 and i < c.width:
        d.text((x + 1, 4), str(a.x0 + i), fill=(255, 200, 200))
for j in range(c.height + 1):
    y = M + j * Z
    col = (255, 80, 80) if (a.y0 + j) % 5 == 0 else (40, 40, 44)
    d.line([(M, y), (M + w, y)], fill=col, width=1)
    if (a.y0 + j) % 5 == 0 and j < c.height:
        d.text((2, y + 1), str(a.y0 + j), fill=(255, 200, 200))
out.save(a.out)
print(a.out, out.size)
