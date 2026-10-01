"""Review sheets for the rendered frames (plain python; never part of the package).

  python tools/rosace-package/review_sheets.py --frames <dir> --px 144 --out review/sheets [--clips idle,run] [--scale 2]
Per clip: <out>/<clip>_px<N>.png (every drawing in clip order, pivot-aligned on a grey ground line) and
<out>/<clip>_px<N>.gif (the clip at game timing, 60 Hz ticks -> 17 ms per tick, exposure + hold honoured).
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw

BG = (92, 94, 104, 255)


def safe(key):
    return key.replace("~", "_to_").replace(":", "_").replace("/", "_")


def load(frames, key, px):
    d = os.path.join(frames, safe(key), f"px{px}")
    im = Image.open(os.path.join(d, "frame.png")).convert("RGBA")
    fm = json.load(open(os.path.join(d, "frame_meta.json")))
    return im, fm["pivot"]


def compose(items, scale, pad=6, labels=None):
    """items: [(im, pivot)] -> one row, every drawing placed on the same pivot"""
    left = max(p[0] for _, p in items) + pad
    right = max(im.width - p[0] for im, p in items) + pad
    up = max(p[1] for _, p in items) + pad
    down = max(im.height - p[1] for im, p in items) + pad
    w, h = left + right, up + down
    row = Image.new("RGBA", (w * len(items), h + 12), BG)
    d = ImageDraw.Draw(row)
    for i, ((im, pv), lb) in enumerate(zip(items, labels or [""] * len(items))):
        tile = Image.new("RGBA", (w, h), BG)
        ImageDraw.Draw(tile).line([(0, up), (w, up)], fill=(60, 62, 72, 255))
        tile.alpha_composite(im, (left - pv[0], up - pv[1]))
        row.paste(tile, (i * w, 12))
        d.text((i * w + 2, 0), lb, fill=(235, 235, 160, 255))
    return row.resize((row.width * scale, row.height * scale), Image.NEAREST), (w, h, left, up)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", required=True)
    ap.add_argument("--solved", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "standin_solved.json"))
    ap.add_argument("--px", default="144")
    ap.add_argument("--out", required=True)
    ap.add_argument("--clips", default="")
    ap.add_argument("--scale", type=int, default=2)
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--gif", action="store_true")
    a = ap.parse_args()
    solved = json.load(open(a.solved, encoding="utf-8"))
    os.makedirs(a.out, exist_ok=True)
    want = set(c for c in a.clips.split(",") if c)
    for px in [int(x) for x in a.px.split(",")]:
        for c in solved["clips"]:
            if want and c["id"] not in want:
                continue
            items, labels, ok = [], [], True
            for i, f in enumerate(c["frames"]):
                try:
                    items.append(load(a.frames, f["pose"], px))
                except FileNotFoundError:
                    ok = False
                    break
                labels.append(f"{i} {f['pose']} {f['duration']}" + (f"+{f['hold']}" if f["hold"] else ""))
            if not ok:
                continue
            # wrap rows
            rows = []
            for s in range(0, len(items), a.cols):
                rows.append(compose(items[s:s + a.cols], a.scale, labels=labels[s:s + a.cols])[0])
            sheet = Image.new("RGBA", (max(r.width for r in rows), sum(r.height for r in rows)), BG)
            y = 0
            for r in rows:
                sheet.paste(r, (0, y))
                y += r.height
            sheet.save(os.path.join(a.out, f"{c['id']}_px{px}.png"))
            if a.gif:
                row, (w, h, left, up) = compose(items, 1)
                seq = []
                for i, f in enumerate(c["frames"]):
                    tile = row.crop((i * w, 12, (i + 1) * w, 12 + h)).resize((w * a.scale, h * a.scale), Image.NEAREST)
                    seq += [tile.convert("P", palette=Image.ADAPTIVE)] * (f["duration"] + f["hold"])
                seq = seq[:600]
                seq[0].save(os.path.join(a.out, f"{c['id']}_px{px}.gif"), save_all=True, append_images=seq[1:], duration=17, loop=0, disposal=2)
            print("sheet", c["id"], px, flush=True)


if __name__ == "__main__":
    main()
