"""Authoring aid: print a sprite region as palette codes (2 chars per pixel, '..' = empty).

  python codes.py sprite.png x0 y0 x1 y1        (x1, y1 exclusive)
Used to place override patches and face stamps by number. Review aid only.
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PAL = json.load(open(os.path.join(os.path.dirname(os.path.dirname(HERE)), "art", "rosace", "palette.json")))["colors"]
INV = {tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)): k for k, v in PAL.items()}
im = Image.open(sys.argv[1]).convert("RGBA")
x0, y0, x1, y1 = (int(v) for v in sys.argv[2:6])
print("     " + " ".join(f"{x:>2}"[-2:] for x in range(x0, x1)))
for y in range(y0, y1):
    row = []
    for x in range(x0, x1):
        p = im.getpixel((x, y))
        row.append(".." if p[3] == 0 else INV.get(p[:3], "??"))
    print(f"{y:>4} " + " ".join(row))
