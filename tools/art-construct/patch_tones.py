"""Tones per material, measured on hand-picked patches that sit inside one material.

For each patch: group colours (greedy, per-channel --tol), optionally fold 1 px compression specks
into their neighbours (--despeckle, for lossy refs), then report the groups that cover >= 5% of the
patch, dark to light, with each one's share and relative luminance, plus the luminance contrast
between the darkest and lightest of them. Lines and outline pixels inside a patch show up as their
own dark group; read them as "line", not as a shading tone.

Usage:
  python patch_tones.py PATCHES.json [--json OUT.json]

PATCHES.json: [{"image": path, "box": [x0, y0, x1, y1], "label": "r09 robe", "tol": 16,
                "despeckle": true}, ...]   (box in image pixels; alpha-0 pixels are skipped)
"""
import json, sys, argparse
from collections import Counter
import numpy as np
from PIL import Image


def rel_lum(c):
    c = np.asarray(c, float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])


def patch(p):
    a = np.asarray(Image.open(p['image']).convert('RGBA').crop(tuple(p['box']))).astype(int)
    rgb, al = a[..., :3], a[..., 3] > 0
    H, W = al.shape
    tol = p.get('tol', 16)
    cnt = Counter(tuple(rgb[y, x]) for y in range(H) for x in range(W) if al[y, x])
    seeds, lut = [], {}
    for col, n in cnt.most_common():
        for i, s in enumerate(seeds):
            if max(abs(col[j] - s[j]) for j in range(3)) <= tol:
                lut[col] = i; break
        else:
            lut[col] = len(seeds); seeds.append(np.array(col))
    lab = np.full((H, W), -1)
    for y in range(H):
        for x in range(W):
            if al[y, x]:
                lab[y, x] = lut[tuple(rgb[y, x])]
    if p.get('despeckle'):
        out = lab.copy()
        for y in range(H):
            for x in range(W):
                v = lab[y, x]
                if v < 0:
                    continue
                nb = [lab[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))
                      if 0 <= y + dy < H and 0 <= x + dx < W and lab[y + dy, x + dx] >= 0]
                if nb and v not in nb:
                    m = Counter(nb).most_common(1)[0][0]
                    if np.abs(seeds[m] - rgb[y, x]).max() <= 48:
                        out[y, x] = m
        lab = out
    tot = int((lab >= 0).sum())
    c = Counter(lab[lab >= 0].tolist())
    tones = [(i, n) for i, n in c.items() if n >= 0.05 * tot]
    tones.sort(key=lambda t: rel_lum(seeds[t[0]]))
    lum = [rel_lum(seeds[i]) for i, _ in tones]
    return {'label': p['label'], 'box': p['box'], 'px': tot, 'groups': len(c),
            'tones_ge5pct': len(tones),
            'ramp': [('#%02x%02x%02x' % tuple(seeds[i]), round(n / tot, 3), round(rel_lum(seeds[i]), 3)) for i, n in tones],
            'contrast_dark_to_light': round((max(lum) + 0.05) / (min(lum) + 0.05), 2) if lum else None}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('patches'); ap.add_argument('--json')
    ar = ap.parse_args()
    res = [patch(p) for p in json.load(open(ar.patches))]
    txt = json.dumps(res, indent=1)
    if ar.json:
        open(ar.json, 'w').write(txt)
    for r in res:
        print('%-28s tones=%d groups=%d contrast=%s  %s' % (r['label'], r['tones_ge5pct'], r['groups'], r['contrast_dark_to_light'],
              ' '.join('%s(%.0f%%,L%.2f)' % (h, s * 100, l) for h, s, l in r['ramp'])))


if __name__ == '__main__':
    main()
