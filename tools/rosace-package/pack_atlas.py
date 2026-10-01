"""Rosace packaging: trim the finished frames, shelf-pack one albedo + one normal atlas per size (the same packer
src/lab/art/atlas-builder.ts uses: frames sorted tall-first with a 2 px gutter, rows up to 2048 px wide), and write
layout_<px>.json (rect, pivot, anchors per pose key) for build_manifest.mjs.

  python tools/rosace-package/pack_atlas.py --frames <dir of <key>/px<N>/frame*.png> --keys-from data/standin_solved.json
        --out-root public/world --layout review/pack [--px 80,144]
Output: <out-root>/character/body.png + body_n.png (80), <out-root>/character-closeup/... (144).
"""
import argparse
import json
import os

import numpy as np
from PIL import Image

DIRS = {80: "character", 144: "character-closeup"}


def safe(key):
    return key.replace("~", "_to_").replace(":", "_").replace("/", "_")


def trim(a, n):
    ys, xs = np.nonzero(a[..., 3] >= 128)
    if not len(xs):
        raise SystemExit("frame is fully transparent")
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    return x0, y0, a[y0:y1 + 1, x0:x1 + 1], n[y0:y1 + 1, x0:x1 + 1]


def shelf(sizes, max_w=2048, gutter=2):
    """atlas-builder.ts pack(): sort by h desc then w desc (stable), fill rows, 2 px gutters"""
    order = sorted(range(len(sizes)), key=lambda i: (-sizes[i][1], -sizes[i][0]))
    x, y, row_h, width = gutter, gutter, 0, 0
    pos = [None] * len(sizes)
    for i in order:
        w, h = sizes[i]
        if x + w + gutter > max_w:
            x, y, row_h = gutter, y + row_h + gutter, 0
        pos[i] = (x, y)
        x += w + gutter
        row_h = max(row_h, h)
        width = max(width, x)
    return pos, max(4, width), max(4, y + row_h + gutter)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", required=True)
    ap.add_argument("--keys-from", required=True)
    ap.add_argument("--out-root", required=True)
    ap.add_argument("--layout", required=True)
    ap.add_argument("--px", default="80,144")
    a = ap.parse_args()
    solved = json.load(open(a.keys_from, encoding="utf-8"))
    keys = []
    for c in solved["clips"]:
        for f in c["frames"]:
            if f["pose"] not in keys:
                keys.append(f["pose"])
    os.makedirs(a.layout, exist_ok=True)
    for px in [int(x) for x in a.px.split(",")]:
        imgs, meta = [], []
        for k in keys:
            d = os.path.join(a.frames, safe(k), f"px{px}")
            alb = np.asarray(Image.open(os.path.join(d, "frame.png")).convert("RGBA"))
            nrm = np.asarray(Image.open(os.path.join(d, "frame_n.png")).convert("RGBA"))
            fm = json.load(open(os.path.join(d, "frame_meta.json")))
            x0, y0, ta, tn = trim(alb, nrm)
            imgs.append((ta, tn))
            meta.append((k, fm, x0, y0))
        pos, W, H = shelf([(i[0].shape[1], i[0].shape[0]) for i in imgs])
        A = np.zeros((H, W, 4), np.uint8)
        N = np.zeros((H, W, 4), np.uint8)
        layout = {}
        for (ta, tn), (k, fm, x0, y0), (px_, py_) in zip(imgs, meta, pos):
            h, w = ta.shape[:2]
            A[py_:py_ + h, px_:px_ + w] = ta
            N[py_:py_ + h, px_:px_ + w] = tn
            pv = fm["pivot"]
            layout[k] = {"rect": [int(px_), int(py_), int(w), int(h)], "pivot": [int(pv[0] - x0), int(pv[1] - y0)],
                         "anchors": fm["anchors"]}
        out = os.path.join(a.out_root, DIRS[px])
        os.makedirs(out, exist_ok=True)
        Image.fromarray(A, "RGBA").save(os.path.join(out, "body.png"), optimize=True)
        Image.fromarray(N, "RGBA").save(os.path.join(out, "body_n.png"), optimize=True)
        json.dump({"px": px, "width": W, "height": H, "frames": layout}, open(os.path.join(a.layout, f"layout_{px}.json"), "w"), indent=1)
        print(f"{px}: {len(keys)} frames, atlas {W}x{H}, albedo {os.path.getsize(os.path.join(out, 'body.png')) // 1024} KB, normal {os.path.getsize(os.path.join(out, 'body_n.png')) // 1024} KB")


if __name__ == "__main__":
    main()
