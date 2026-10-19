"""Dex's art as pixelized previews for the Hall of Works (his 10-12 ask: "my artwork in their
pixelized preview forms as deco").

Each piece is re-drawn at the room's 1 px, exactly the size the hall hangs it (tools/hall/art-sizes.mjs),
in a small set of the game's own palette colours (the room's ramps plus the piece's key hues, about
16-24), with no anti-aliasing and no dither, so it sits in the room as pixel art instead of a photo.
It is lit as a hung picture: a picture lamp over it (a warm pool at the top, falling off), the frame's
top lip casting a shadow across its top rows, and its whites toned to warm paper (nothing brighter
than luma 210, so the pieces never outshine the court door).

    python -I tools/hall/pixelize_art.py            # every piece the world hangs, missing sizes only
    python -I tools/hall/pixelize_art.py --force    # remake all

Writes public/tesu/hall-art/<id>-<w>x<h>.png. Deterministic (same input, same pixels).
"""

import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "tesu", "hall-art")
MAX_LUMA = 210.0
# accent ramps a picture may take its key hues from; the room's own ramps are always in
ROOM = ["ink", "paper", "timber", "red", "lacquer", "gold", "stone", "ember", "umber", "bronze", "dusk", "mauve"]
ACCENT = ["blue", "skin", "blossom", "violet", "jade", "tile", "range", "karst", "moss", "earth"]


def game_palette():
    src = open(os.path.join(ROOT, "src", "tesu", "art", "palette.ts"), encoding="utf-8").read()
    ramps = {}
    for m in re.finditer(r"(\w+):\s*ramp\(([^)]*)\)", src):
        ramps[m.group(1)] = re.findall(r"#[0-9a-fA-F]{6}", m.group(2))
    return ramps


def hex_rgb(h):
    v = int(h[1:], 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]


def to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    x = (lin[..., 0] * 0.4124 + lin[..., 1] * 0.3576 + lin[..., 2] * 0.1805) / 0.95047
    y = lin[..., 0] * 0.2126 + lin[..., 1] * 0.7152 + lin[..., 2] * 0.0722
    z = (lin[..., 0] * 0.0193 + lin[..., 1] * 0.1192 + lin[..., 2] * 0.9505) / 1.08883

    def f(t):
        return np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)

    fx, fy, fz = f(x), f(y), f(z)
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], axis=-1)


def luma(rgb):
    r = np.asarray(rgb, dtype=np.float64)
    return r[..., 0] * 0.2126 + r[..., 1] * 0.7152 + r[..., 2] * 0.0722


def dist(a, b, hue=1.4):
    d = a[:, None, :] - b[None, :, :]
    return d[..., 0] ** 2 + hue * (d[..., 1] ** 2 + d[..., 2] ** 2)


def kmeans(px, k, iters=18):
    # deterministic seeds: quantiles of lightness, then the points farthest from the seeds so far
    order = np.argsort(px[:, 0], kind="stable")
    seeds = [px[order[int(i)]] for i in np.linspace(0, len(px) - 1, max(2, k // 2))]
    cen = np.array(seeds)
    while len(cen) < k:
        d = dist(px, cen).min(axis=1)
        cen = np.vstack([cen, px[int(np.argmax(d))]])
    for _ in range(iters):
        lab = dist(px, cen).argmin(axis=1)
        for j in range(k):
            m = lab == j
            if m.any():
                cen[j] = px[m].mean(axis=0)
    return cen


def pixelize(src, w, h, pal_hex, pal_names):
    im = Image.open(src).convert("RGB")
    # down in two steps: a sharp resample to twice the size, then an area average to the room's 1 px
    im = im.resize((w * 2, h * 2), Image.Resampling.LANCZOS).resize((w, h), Image.Resampling.BOX)
    lab = to_lab(np.asarray(im))
    yy, xx = np.mgrid[0:h, 0:w]
    u, v = (xx + 0.5) / w - 0.5, (yy + 0.5) / h
    # the picture lamp over the frame: a warm pool at the top middle, falling off down and out
    lamp = 1.07 - 0.22 * (u * u * 2.2 + v ** 1.3 * 0.75)
    L = lab[..., 0] * lamp
    # the frame's top lip shades the top rows
    for r, k in enumerate([0.62, 0.74, 0.86, 0.94]):
        if r < h:
            L[r, :] *= k
    # whites toned to warm paper: the highlights compressed, a warm cast over all of it
    L = np.where(L > 66, 66 + (L - 66) * 0.6, L)
    lab = np.stack([np.clip(L, 0, 100), lab[..., 1] + 1.2, lab[..., 2] + 3.5], axis=-1)

    pal_rgb = np.array([hex_rgb(x) for x in pal_hex], dtype=np.float64)
    ok = luma(pal_rgb) <= MAX_LUMA
    cand = np.where(ok)[0]
    pal_lab = to_lab(pal_rgb)

    flat = lab.reshape(-1, 3)
    cen = kmeans(flat, 26)
    # each cluster's colour becomes the nearest game colour (hue kept), then every pixel takes
    # the nearest of that small set: no dither, no blend
    dd = dist(cen, pal_lab[cand], 1.7)
    # skin stays skin: the pinks of blossom only for a colour that is truly magenta
    pinkish = np.array([n.startswith("blossom") or n.startswith("violet") for n in np.array(pal_names)[cand]])
    magenta = (cen[:, 1] > 28) & (cen[:, 2] < -2)
    dd[np.ix_(~magenta, pinkish)] += 900
    pick = cand[dd.argmin(axis=1)]
    pick = np.unique(pick)
    idx = pick[dist(flat, pal_lab[pick], 1.5).argmin(axis=1)].reshape(h, w)
    # clean clusters: a lone pixel that none of its 8 neighbours shares takes its neighbours' majority
    out = idx.copy()
    for _ in range(2):
        idx = out.copy()
        for y in range(h):
            for x in range(w):
                nb = idx[max(0, y - 1):y + 2, max(0, x - 1):x + 2].ravel()
                if (nb == idx[y, x]).sum() == 1:
                    vals, cnt = np.unique(nb, return_counts=True)
                    j = int(np.argmax(cnt))
                    if cnt[j] >= 4:
                        out[y, x] = vals[j]
    used = np.unique(out)
    rgb = pal_rgb[out].astype(np.uint8)
    return Image.fromarray(rgb, "RGB"), len(used), [pal_names[i] for i in used]


def main():
    force = "--force" in sys.argv
    ramps = game_palette()
    pal_hex, pal_names = [], []
    for name in ROOM + ACCENT:
        for i, hx in enumerate(ramps.get(name, [])):
            pal_hex.append(hx)
            pal_names.append(f"{name}[{i}]")
    sizes = json.loads(subprocess.check_output(["node", os.path.join(ROOT, "tools", "hall", "art-sizes.mjs")], cwd=ROOT))
    os.makedirs(OUT, exist_ok=True)
    for s in sizes:
        dst = os.path.join(OUT, f"{s['id']}-{s['w']}x{s['h']}.png")
        if os.path.exists(dst) and not force:
            print("have", os.path.relpath(dst, ROOT))
            continue
        src = os.path.join(ROOT, "public", "gallery", f"{s['id']}.webp")
        img, n, names = pixelize(src, s["w"], s["h"], pal_hex, pal_names)
        img.save(dst, optimize=True)
        print("made", os.path.relpath(dst, ROOT), f"{n} colours")


if __name__ == "__main__":
    main()
