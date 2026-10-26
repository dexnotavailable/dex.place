"""Where do the pixel-craft rules fail? Marks, on a zoomed copy of a sprite, the pixels behind PX-P23 (checker
2x2s), PX-P12 (orphans), PX-P13 (shadow shapes never 2 px thick), FG-N06 (background slivers) and PX-N01 (per-side
shadow share of big forms). Round R1 helper: the painter looks where the checker points, then fixes the step
that owns the pixels (WF-P06).

  python tools/art-construct/craft_debug.py art/rosace/construct/figure/idle_hero_r1 [--z 5] [--out PNG]
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import rules_check as RC  # noqa: E402
from figure_construct import RAMP  # noqa: E402


def marks(c):
    code, mask, parts, ids = c.code, c.mask, c.parts, c.ids
    H, W = code.shape
    out = {}
    a, b, cc, d = code[:-1, :-1], code[:-1, 1:], code[1:, :-1], code[1:, 1:]
    chk = (a == d) & (b == cc) & (a != b) & (a > 0) & (b > 0)
    m = np.zeros((H, W), bool)
    m[:-1, :-1] |= chk
    m &= ~np.isin(parts, [A.PART['eye'], A.PART['face'], A.PART['weapon']])
    out['checker'] = m & (A.shift(m, 1, 0) | A.shift(m, -1, 0) | A.shift(m, 0, 1) | A.shift(m, 0, -1))
    face = np.isin(parts, [A.PART['eye'], A.PART['face']])
    orph = np.zeros((H, W), bool)
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            v = code[y, x]
            if v <= 0 or face[y, x] or v == c.I('OL'):
                continue
            nb = [code[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            dg = [code[y + dy, x + dx] for dy, dx in ((1, 1), (1, -1), (-1, 1), (-1, -1))]
            if v not in nb and v not in dg and len(set(nb)) == 1 and nb[0] > 0:
                win = code[max(0, y - 2):y + 3, max(0, x - 2):x + 3]
                if (win == nb[0]).sum() >= 12:
                    orph[y, x] = True
    out['orphan'] = orph
    thin = np.zeros((H, W), bool)
    for k in c.c('S3', 'W3', 'I3', 'G3', 'T4', 'B2'):
        lab, sizes = A.components(code == k)
        for lb, n in sizes:
            comp = lab == lb
            if n >= 4 and A.dist_inside(comp).max() < 2:
                thin |= comp
    out['thin'] = thin
    bg = ~mask
    hits = np.zeros((H, W), bool)
    for w in (1, 2):
        for dx, dy in ((1, 0), (0, 1)):
            aa = A.shift(parts, dx, dy)
            bb = A.shift(parts, -dx * w, -dy * w)
            run = bg.copy()
            for k in range(1, w):
                run &= A.shift(bg, -dx * k, -dy * k)
            hits |= run & (aa > 0) & (bb > 0) & (aa != bb)
    out['sliver'] = hits
    pil = []
    for pid in np.unique(parts[mask]):
        if pid in (0, A.PART['eye'], A.PART['face']):
            continue
        mm = mask & (parts == pid) & (code != c.I('OL'))
        from collections import Counter
        mat = Counter(ids[mm].tolist()).most_common(1)[0][0] if mm.any() else 0
        name = A.MATNAME.get(int(mat), '')
        if name not in RAMP:
            continue
        lab, sizes = A.components(mm)
        for k, n in sizes:
            if n >= 30:
                sh = RC.pillow(lab == k, code, [c.I(RAMP[name][0]), c.I(RAMP[name][1])])
                pil.append((A.PARTNAME.get(int(pid)), n, {kk: round(v, 2) for kk, v in sh.items()}))
    return out, pil


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sprite')
    ap.add_argument('--z', type=int, default=5)
    ap.add_argument('--out')
    a = ap.parse_args()
    c = RC.Ctx(a.sprite)
    out, pil = marks(c)
    im = A.zoom(A.on_bg(Image.open(Path(a.sprite) / 'sprite.png')), a.z)
    d = ImageDraw.Draw(im)
    col = {'checker': (255, 0, 255), 'orphan': (0, 255, 255), 'thin': (255, 140, 0), 'sliver': (255, 255, 0)}
    for k, m in out.items():
        ys, xs = np.nonzero(m)
        for x, y in zip(xs, ys):
            d.rectangle([x * a.z + 1, y * a.z + 1, (x + 1) * a.z - 2, (y + 1) * a.z - 2], outline=col[k])
        print(k, int(m.sum()))
    for p in pil:
        if sum(v >= 0.7 for v in p[2].values()) >= 3:
            print('pillow', p)
    o = a.out or str(A.ROOT / 'review' / 'rosace' / 'construct' / 'round-1' / '_work' / (Path(a.sprite).name + '_craft.png'))
    im.save(o)
    print(o)


if __name__ == '__main__':
    main()
