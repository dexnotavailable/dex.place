"""Estimate the native pixel-grid scale of an upscaled pixel-art image.

Method: per-column (and per-row) edge energy = summed absolute colour difference
between neighbouring columns. Upscaled pixel art only has edges on the grid
lines, so the edge-energy signal is periodic with period = scale. We score
candidate periods (fractional allowed) by how much edge energy lands near
grid lines for the best phase.

usage: python measure_grid.py <image> [x0 y0 x1 y1]
"""
import sys
import numpy as np
from PIL import Image


def edge_profile(a, axis):
    d = np.abs(np.diff(a.astype(np.int32), axis=axis)).sum(axis=2)
    return d.sum(axis=0 if axis == 1 else 1).astype(np.float64)


def score_period(e, p):
    n = len(e)
    idx = np.arange(n) + 0.5  # edge between i and i+1 sits at i+0.5 (in px units, +0.5 offset handled by phase)
    best = (0.0, 0.0)
    for phase in np.linspace(0, p, max(8, int(p * 8)), endpoint=False):
        dist = np.abs(((idx - phase + p / 2) % p) - p / 2)
        on = dist < 0.5
        s = e[on].sum() / max(e.sum(), 1e-9)
        # normalise by expected fraction if random
        expect = on.mean()
        best = max(best, (s - expect, phase))
    return best


def main():
    path = sys.argv[1]
    im = Image.open(path).convert("RGB")
    a = np.asarray(im)
    if len(sys.argv) >= 6:
        x0, y0, x1, y1 = map(int, sys.argv[2:6])
        a = a[y0:y1, x0:x1]
    ex = edge_profile(a, 1)
    ey = edge_profile(a, 0)
    res = {}
    for name, e in (("x", ex), ("y", ey)):
        cands = []
        for p in np.arange(1.5, 8.01, 0.05):
            s, ph = score_period(e, p)
            cands.append((s, round(float(p), 2), round(float(ph), 2)))
        cands.sort(reverse=True)
        res[name] = cands[:6]
    for k, v in res.items():
        print(k, v)


if __name__ == "__main__":
    main()
