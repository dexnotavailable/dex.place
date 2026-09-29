"""Inspection grid: every rendered image of a clip, in rows, cropped to the clip's union box.

  python tools/motion-ai/frame_grid.py D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders/n1_r2/px144 \
      out.png [--cols 6] [--scale 2]

Labels: the first game frame that shows the image, its drawing, and 'cloth' for cloth-only redraws.
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


def grid(px_dir, out, cols=6, scale=2):
    px_dir = Path(px_dir)
    meta = json.loads((px_dir / "meta.json").read_text())
    mo = meta["motion"]
    disp = mo["sample_frame"]
    body = mo.get("body_sample_frame", disp)
    frames = meta["frames"]
    first = {}
    for gf, s in enumerate(disp):
        first.setdefault(s, gf)
    ims = {f: Image.open(px_dir / f"sprite_{f:04d}.png").convert("RGBA") for f in frames}
    bb = None
    for im in ims.values():
        b = im.getbbox()
        if b:
            bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
    x0, y0, x1, y1 = bb[0] - 2, bb[1] - 12, bb[2] + 2, max(bb[3], meta["anchor"][1]) + 3
    w, h = x1 - x0, y1 - y0
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (w * cols, h * rows), (46, 46, 58, 255))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(frames):
        cx, cy = (i % cols) * w, (i // cols) * h
        sheet.alpha_composite(ims[f].crop((x0, y0, x1, y1)), (cx, cy))
        gy = cy + meta["anchor"][1] - y0
        d.line([(cx, gy), (cx + w - 1, gy)], fill=(80, 80, 100, 255))
        gf = first.get(f, f)
        cloth = gf > 0 and body[gf] == body[gf - 1]
        d.text((cx + 2, cy + 1), f"f{gf} {mo['drawing'][gf]}{' cloth' if cloth else ''}", fill=(240, 230, 160, 255))
        d.line([(cx + w - 1, cy), (cx + w - 1, cy + h)], fill=(30, 30, 38, 255))
    sheet = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("px_dir")
    ap.add_argument("out")
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--scale", type=int, default=2)
    a = ap.parse_args()
    print(grid(a.px_dir, a.out, a.cols, a.scale))
