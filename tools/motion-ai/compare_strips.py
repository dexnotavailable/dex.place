"""Side-by-side comparison of motion variants: one row per BVH, one tile per chosen frame.

  D:/Dex/Tools/venvs/kimodo/Scripts/python.exe tools/motion-ai/compare_strips.py out.png a.bvh b.bvh ... \
      [--frames keys|even] [--n 12] [--scale 0.9]

Frames: `keys` (default) uses the MOVESET key-drawing frames stored in the variant's
<raw>/_constraints/<move>_<tempo>_<mode>.meta.json (plus one in-between inside every gap of 4+
frames), so every row shows the same drawings (A2 coil, C1 contact, ...). `even` (and any
BVH without a meta file, e.g. video captures) takes --n evenly spaced frames.

Each tile is the SIDE view (or, with --view front, the FRONT view: looking at her from her start
facing, world X horizontal; use it for front-on video captures, where spread legs and arms hide
in the side view) (the game's plane, world Z horizontal, following the hips) at one
shared scale for every row, so sizes and reach compare directly. The glaive is the same proxy
as motion_preview.py (drawn only while the wrists are 15-85 cm apart). Top-right of every tile:
a compass showing where the hips face seen from above (arrow up = her start facing, turning
arrow = spin), with the heading in degrees. Planted feet are red.
"""
import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from bvh_tools import Bvh  # noqa: E402
from motion_preview import SKIP_PREFIX, colour, glaive, planted_mask  # noqa: E402
from motion_qc import yaw_series  # noqa: E402

RAW = Path(r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\raw")
TW, TH, LABEL_W = 230, 300, 300


def key_frames(bvh, F):
    m = re.match(r"(.+?)_(study|game)_([a-z0-9]+?)_s\d+_\d\d$", bvh.stem)
    if not m:
        return None
    meta = RAW / "_constraints" / f"{m.group(1)}_{m.group(2)}_{m.group(3)}.meta.json"
    if not meta.exists():
        return None
    keys = json.loads(meta.read_text(encoding="utf-8"))["keys"]
    if keys and keys[-1]["frame"] >= F:  # text5s: meta frames were built for a shorter clip
        return None
    out = []
    for k in keys:
        if "(pre-roll)" in k["label"]:
            continue
        out.append((k["frame"], k["label"].replace(" (tail)", " end")))
    full = []
    for i, (f, lab) in enumerate(out):
        if i and f - out[i - 1][0] >= 4:
            mid = (f + out[i - 1][0]) // 2
            full.append((mid, ""))
        full.append((f, lab))
    return full


def row(bvh, scale, mode, n, view="side"):
    b = Bvh(str(bvh))
    P = b.positions()
    names = b.names
    F = len(P)
    fr = key_frames(bvh, F) if mode == "keys" else None
    if not fr:
        fr = [(int(round(x)), "") for x in np.linspace(0, F - 1, min(n, F))]
    keep = [j for j, nm in enumerate(names) if nm != "Root" and not nm.endswith("_end") and not nm.startswith(SKIP_PREFIX)]
    bones = [(b.parents[j], j) for j in keep if b.parents[j] >= 0 and names[b.parents[j]] != "Root"]
    G = glaive(P, names, 230.0)
    plant = planted_mask(P, names, b.fps)
    yaw = yaw_series(P, names)
    hips = names.index("Hips")
    img = Image.new("RGB", (LABEL_W + TW * len(fr), TH), (250, 250, 247))
    d = ImageDraw.Draw(img)
    for k, (f, lab) in enumerate(fr):
        x0 = LABEL_W + k * TW
        ax = 2 if view == "side" else 0
        sg = 1 if view == "side" else -1
        cx = P[f, hips, ax]
        floor_y = TH - 30

        def px(p):
            return (x0 + TW / 2 + sg * (p[ax] - cx) * scale, floor_y - p[1] * scale)

        d.rectangle([x0, 0, x0 + TW - 1, TH - 1], outline=(215, 215, 210))
        d.line([(x0, floor_y), (x0 + TW, floor_y)], fill=(170, 170, 160))
        for t in np.arange(np.floor((cx - TW / scale) / 50) * 50, cx + TW / scale, 50):
            tv = np.zeros(3); tv[ax] = t
            xx = px(tv)[0]
            if x0 <= xx <= x0 + TW:
                d.line([(xx, floor_y), (xx, floor_y + 5)], fill=(150, 150, 140))
        g = G[f]
        if not np.isnan(g[0, 0]):
            a, c = px(g[0]), px(g[1])
            d.line([a, c], fill=(120, 60, 150), width=3)
            d.ellipse([c[0] - 4, c[1] - 4, c[0] + 4, c[1] + 4], fill=(170, 60, 200))
        for p_, j in bones:
            d.line([px(P[f, p_]), px(P[f, j])], fill=colour(names[j]), width=3)
        hp = px(P[f, names.index("Head")])
        d.ellipse([hp[0] - 6, hp[1] - 6, hp[0] + 6, hp[1] + 6], outline=(90, 90, 90), width=2)
        for jn in ("LeftFoot", "LeftToeBase", "RightFoot", "RightToeBase"):
            if jn in names and plant[f, names.index(jn)]:
                q = px(P[f, names.index(jn)])
                d.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], fill=(220, 30, 30))
        # compass: heading seen from above (up = start facing)
        ccx, ccy, r = x0 + TW - 24, 26, 16
        d.ellipse([ccx - r, ccy - r, ccx + r, ccy + r], outline=(180, 180, 175))
        a = np.radians(yaw[f] - yaw[0])
        d.line([(ccx, ccy), (ccx + r * np.sin(a), ccy - r * np.cos(a))], fill=(200, 0, 0), width=2)
        d.text((x0 + 4, 4), f"f{f}", fill=(0, 0, 0))
        d.text((x0 + 4, 16), f"{yaw[f] - yaw[0]:+.0f}deg", fill=(120, 0, 0))
        if lab:
            d.text((x0 + 4, TH - 22), lab[:32], fill=(0, 0, 160))
    return img, F, b.fps


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("out")
    p.add_argument("bvh", nargs="+")
    p.add_argument("--frames", default="keys", choices=("keys", "even"))
    p.add_argument("--n", type=int, default=12)
    p.add_argument("--scale", type=float, default=1.0, help="pixels per cm")
    p.add_argument("--notes", default="", help="'|'-separated one-line note per row")
    p.add_argument("--view", default="side", choices=("side", "front"), help="front: looking at her from her start facing (world X horizontal)")
    a = p.parse_args()
    notes = a.notes.split("|") if a.notes else []
    rows = []
    for i, f in enumerate(a.bvh):
        im, F, fps = row(Path(f), a.scale, a.frames, a.n, a.view)
        d = ImageDraw.Draw(im)
        st = Path(f).stem
        for k, chunk in enumerate([st[i:i + 36] for i in range(0, len(st), 36)]):
            d.text((6, 8 + 12 * k), chunk, fill=(0, 0, 0))
        d.text((6, 50), f"{F} frames @ {fps:g} fps", fill=(80, 80, 80))
        if i < len(notes):
            for k, chunk in enumerate([notes[i][j:j + 44] for j in range(0, len(notes[i]), 44)]):
                d.text((6, 70 + 12 * k), chunk, fill=(0, 0, 150))
        rows.append(im)
    W = max(r.width for r in rows)
    S = Image.new("RGB", (W, sum(r.height for r in rows)), "white")
    y = 0
    for r in rows:
        S.paste(r, (0, y))
        y += r.height
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    S.save(a.out)
    print("STRIPS", a.out, S.size)


if __name__ == "__main__":
    main()
