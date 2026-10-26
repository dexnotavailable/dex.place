"""Finish-gap metrics for one of Rosace's stills (docs/character/art-rules/finish-gap.md).

Measures the numbers that finish-gap.md compares with the finish-bar refs 07, 08, 09 and 04:
chroma (median HSV saturation, the share of chromatic pixels, the share of saturated accent
pixels), the value register (CIE L* histogram, median), the silhouette ring (near-black share),
tones per material (L* modes, 1-D greedy with +-5 L*), the pixel-weighted mean cluster size and
banding (borrowed from pixel_metrics.py), and silhouette mass (body area / height^2, weapon
excluded via the part ids).

Input is a render directory with still.png (RGBA), id.png (supersampled; R = material id,
G = part id) and meta.json, e.g. <build>/renders/integrated/idle_hero/px144.

The ref side of the comparison lives in the git-ignored review/rosace/art/finish-gap/ (the refs
are third-party and never committed); this tool only reads our own renders.

Usage:
  python tools/art-construct/finish_metrics.py RENDER_DIR [RENDER_DIR ...] [--json OUT.json]
"""
import argparse, json, os, sys
from collections import Counter
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixel_metrics as pm  # noqa: E402

GLAIVE_PARTS = (33, 34)
MATERIALS = {'skin': [1], 'hair': [5, 6], 'light cloth': [2], 'dark cloth': [3, 9], 'gold': [4]}


def lin(a):
    c = a / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def rel_l(a):
    x = lin(a.astype(float))
    return 0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2]


def l_star(a):
    y = rel_l(a)
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)


def sat_val(a):
    c = a.astype(float) / 255
    mx, mn = c.max(-1), c.min(-1)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-9), 0), mx


def load(d):
    s = np.asarray(Image.open(os.path.join(d, 'still.png')).convert('RGBA'))
    fg = s[..., 3] > 0
    idm = np.asarray(Image.open(os.path.join(d, 'id.png')).convert('RGBA'))
    H, W = fg.shape
    ss = idm.shape[0] // H
    blk = idm[:H * ss, :W * ss].reshape(H, ss, W, ss, 4).transpose(0, 2, 1, 3, 4).reshape(H, W, ss * ss, 4)
    mat = np.zeros((H, W), int); part = np.zeros((H, W), int)
    for y, x in zip(*np.nonzero(fg)):
        v = blk[y, x]; v = v[v[:, 3] > 0]
        if len(v):
            m, p = Counter(map(tuple, v[:, :2])).most_common(1)[0][0]
            mat[y, x], part[y, x] = m, p
    for _ in range(4):  # outline px with no id take a labelled neighbour's
        miss = fg & (mat == 0)
        if not miss.any():
            break
        for y, x in zip(*np.nonzero(miss)):
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and mat[ny, nx]:
                    mat[y, x], part[y, x] = mat[ny, nx], part[ny, nx]; break
    return s[..., :3], fg, mat, part


def tones(lv, tol=5, cover=0.9):
    seeds = []
    for v, n in Counter(np.round(lv).astype(int)).most_common():
        for sd in seeds:
            if abs(v - sd[0]) <= tol:
                sd[1] += n; break
        else:
            seeds.append([v, n])
    seeds.sort(key=lambda sd: -sd[1]); acc = 0
    for i, sd in enumerate(seeds):
        acc += sd[1]
        if acc >= cover * len(lv):
            return i + 1, sorted(int(q[0]) for q in seeds[:i + 1])
    return len(seeds), sorted(int(q[0]) for q in seeds)


def measure(d):
    a, fg, mat, part = load(d)
    body = fg & ~np.isin(part, GLAIVE_PARTS)
    L, Ls = rel_l(a), l_star(a)
    S, V = sat_val(a)
    pad = np.pad(fg, 1)
    ring = fg & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    lv = Ls[fg]
    hist = np.histogram(lv, bins=[0, 20, 35, 50, 65, 80, 101])[0] / len(lv)
    out = {
        'figure_px': int(fg.sum()),
        'colours': len(set(map(tuple, a[fg]))),
        'chroma': {
            'median_S': round(float(np.median(S[fg])), 2),
            'chromatic_share': round(float(((S > 0.15) & (V > 0.15))[fg].mean()), 3),
            'accent_share_S>0.6_V>0.3': round(float(((S > 0.6) & (V > 0.3))[fg].mean()), 3),
        },
        'value': {
            'Lstar_median': round(float(np.median(lv)), 1),
            'Lstar_hist_0-20_20-35_35-50_50-65_65-80_80-100': [round(float(h), 3) for h in hist],
        },
        'ring_near_black_L<0.06': round(float((L[ring] < 0.06).mean()), 3),
        'materials': {},
    }
    for name, ids in MATERIALS.items():
        m = fg & np.isin(mat, ids) & ~ring & (L >= 0.0105)
        if m.sum() >= 15:
            n, modes = tones(Ls[m])
            out['materials'][name] = {'px': int(m.sum()), 'tones90': n, 'tone_Lstar': modes,
                                      'mean_S': round(float(S[m].mean()), 2)}
    lab, _, _ = pm.quantize(a.astype(int), body, 12)
    hp, _ = pm.hug_bands(lab)
    cl = pm.clusters(lab)
    out['banding_per_1000px'] = round(1000.0 * hp / body.sum(), 2)
    out['cluster_px_weighted_mean'] = cl['px_weighted_mean_size']
    ys, xs = np.nonzero(body)
    h = ys.max() - ys.min() + 1
    out['mass_body_area_per_H2'] = round(float(body.sum() / h ** 2), 3)
    out['body_bbox_fill'] = round(float(body.sum() / (h * (xs.max() - xs.min() + 1))), 3)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dirs', nargs='+'); ap.add_argument('--json')
    args = ap.parse_args()
    res = {d: measure(d) for d in args.dirs}
    print(json.dumps(res, indent=1))
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(res, f, indent=1)


if __name__ == '__main__':
    main()
