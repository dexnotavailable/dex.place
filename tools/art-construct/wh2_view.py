"""Round WH2 inspection helper: crop a still, zoom it on an integer grid with 1 px grid lines and
row/column ticks every 5 px, so pixel edits can be authored by coordinate.

  python tools/art-construct/wh2_view.py <png> x0 y0 x1 y1 [--z 14] [--out <png>] [--codes]
--codes prints the palette.json code of every pixel in the box (unknown hex -> '??')."""
import argparse
import json
import os

from PIL import Image, ImageDraw

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def codes_map():
    p = json.load(open(os.path.join(REPO, "art", "rosace", "palette.json"), encoding="utf-8"))["colors"]
    return {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)): k for k, h in p.items()}


def view(png, box, z=14, out=None, bg=(104, 102, 98)):
    im = Image.open(png).convert("RGBA")
    x0, y0, x1, y1 = box
    c = im.crop(box)
    base = Image.new("RGBA", c.size, bg + (255,))
    base.alpha_composite(c)
    big = base.resize((c.width * z, c.height * z), Image.NEAREST).convert("RGB")
    m = 28
    sheet = Image.new("RGB", (big.width + m, big.height + m), (20, 20, 24))
    sheet.paste(big, (m, m))
    d = ImageDraw.Draw(sheet)
    for i in range(c.width + 1):
        x = m + i * z
        col = (70, 70, 80) if (x0 + i) % 5 else (150, 150, 60)
        d.line([(x, m), (x, m + big.height)], fill=col)
        if (x0 + i) % 5 == 0 and i < c.width:
            d.text((x + 1, 2), str(x0 + i), fill=(220, 220, 120))
    for j in range(c.height + 1):
        y = m + j * z
        col = (70, 70, 80) if (y0 + j) % 5 else (150, 150, 60)
        d.line([(m, y), (m + big.width, y)], fill=col)
        if (y0 + j) % 5 == 0 and j < c.height:
            d.text((1, y + 1), str(y0 + j), fill=(220, 220, 120))
    if out:
        sheet.save(out)
    return sheet


def dump(png, box):
    im = Image.open(png).convert("RGBA")
    cm = codes_map()
    x0, y0, x1, y1 = box
    print("    " + "".join(f"{x % 100:>3}" for x in range(x0, x1)))
    for y in range(y0, y1):
        row = []
        for x in range(x0, x1):
            p = im.getpixel((x, y))
            row.append(" ." if p[3] == 0 else cm.get(p[:3], "??"))
        print(f"{y:>3} " + "".join(f"{r:>3}" for r in row))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("png")
    ap.add_argument("box", type=int, nargs=4)
    ap.add_argument("--z", type=int, default=14)
    ap.add_argument("--out")
    ap.add_argument("--codes", action="store_true")
    a = ap.parse_args()
    view(a.png, tuple(a.box), a.z, a.out)
    if a.codes:
        dump(a.png, tuple(a.box))
