"""Zoomed, gridded crops of faces for measurement (research only).

Usage: python face_crop.py SRC x0 y0 x1 y1 OUT [zoom]
Writes a nearest-neighbour upscale with a 1 px grid line every pixel and a
brighter tick every 5 px, labelled with source coordinates, so pixel counts
can be read straight off the image. Output belongs in the git-ignored
review/rosace/construct/research/ when SRC is a third-party reference.
"""
import os
import sys

GRID = os.environ.get("GRID", "1") != "0"  # GRID=0: edge ticks only
from PIL import Image, ImageDraw

def crop(src, box, out, z=16):
    im = Image.open(src).convert("RGBA")
    x0, y0, x1, y1 = box
    c = im.crop(box)
    w, h = c.size
    pad = 28
    big = Image.new("RGBA", (w * z + pad, h * z + pad), (24, 24, 30, 255))
    # checker behind transparency
    bg = Image.new("RGBA", (w * z, h * z), (90, 90, 96, 255))
    up = c.resize((w * z, h * z), Image.NEAREST)
    bg.alpha_composite(up)
    big.paste(bg, (pad, pad))
    d = ImageDraw.Draw(big)
    for i in range(w + 1):
        X = pad + i * z
        if (x0 + i) % 5 == 0 or GRID:
            col = (255, 255, 0, 110) if (x0 + i) % 5 == 0 else (0, 0, 0, 50)
            d.line([(X, pad), (X, pad + h * z)] if GRID else [(X, pad - 6), (X, pad)], fill=col)
        if (x0 + i) % 5 == 0 and i < w:
            d.text((X + 1, 2), str(x0 + i), fill=(255, 255, 0, 255))
    for j in range(h + 1):
        Y = pad + j * z
        if (y0 + j) % 5 == 0 or GRID:
            col = (255, 255, 0, 110) if (y0 + j) % 5 == 0 else (0, 0, 0, 50)
            d.line([(pad, Y), (pad + w * z, Y)] if GRID else [(pad - 6, Y), (pad, Y)], fill=col)
        if (y0 + j) % 5 == 0 and j < h:
            d.text((1, Y + 1), str(y0 + j), fill=(255, 255, 0, 255))
    big.save(out)

if __name__ == "__main__":
    a = sys.argv
    crop(a[1], tuple(map(int, a[2:6])), a[6], int(a[7]) if len(a) > 7 else 16)
