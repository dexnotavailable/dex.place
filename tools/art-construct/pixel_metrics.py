"""Pixel-craft metrics for a character sprite or a reference crop.

Measures the things the pixel rules in docs/character/art-rules/pixel.md talk about, so the rules
can be grounded in what the finish-bar refs (07, 08, 09) actually do and checked against ours:

  colours      colour groups covering 95% / 99% of the figure (greedy, per-channel tolerance)
  clusters     4-connected runs of one colour group: count, singleton share, share of pixels in
               clusters of <= 3 px, median size, pixel-weighted mean size, strip thickness
  outline      the silhouette ring (figure pixels touching background): how dark it is, whether
               it is one colour or many (selective outline), and its top colours
  values       relative luminance distribution; share of near-white and near-black pixels
  families     colour groups per hue family (a proxy for "tones per material")
  steps        for neighbouring pixels in one hue family with different tones: share that jump
               two or more ramp steps (hard terminator) vs one step (gradient / banding)

Background: alpha when the image has it, else flood fill from the crop border through colours
within --bgtol of the most common border colours (handles checkerboards and flat greys). Extra
background colours (a ground shadow, say) go in --bg.

Lossy WebP refs inflate colour counts and singletons (compression makes 1 px specks), so for refs
07/08/09 read those two numbers as upper bounds. Our sprite is lossless and exact.

Usage:
  python pixel_metrics.py IMAGE [--box x0 y0 x1 y1] [--bgtol 22] [--tol 12] [--bg "#rrggbb,..."]
                          [--shadow "#rrggbb" --shadow-rows 16 --shadow-tol 10] [--mask-out M.png]
                          [--ids ID.png --ss 4] [--json OUT.json] [--label NAME]

--ids takes the pipeline's supersampled material-id map (R = material id) and adds per-material
tone counts and the value contrast across material borders (the white-on-white check).
"""
import argparse, colorsys, json, sys
from collections import Counter, deque
import numpy as np
from PIL import Image


def rel_lum(rgb):
    c = np.asarray(rgb, float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


def contrast(l1, l2):
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def hexc(c):
    return '#%02x%02x%02x' % tuple(int(v) for v in c)


def load(path, box):
    im = Image.open(path)
    has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA')
    if box:
        im = im.crop(box)
    a = np.asarray(im).astype(int)
    return a[..., :3], (a[..., 3] > 0) if has_alpha else None


def flood_bg(rgb, bgtol, extra):
    H, W, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    cnt = Counter(map(tuple, border))
    seeds, tot, acc = [], len(border), 0
    for col, n in cnt.most_common():
        seeds.append(col); acc += n
        if acc >= 0.9 * tot or len(seeds) >= 12:
            break
    seeds += extra
    near = np.zeros((H, W), bool)
    for s in seeds:
        near |= np.abs(rgb - np.array(s)).max(axis=2) <= bgtol
    bg = np.zeros((H, W), bool)
    q = deque()
    for y in range(H):
        for x in (0, W - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    for x in range(W):
        for y in (0, H - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and near[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    return ~bg


def largest_component(mask):
    H, W = mask.shape
    lab = np.zeros((H, W), int); best, bestn, k = 0, 0, 0
    for sy in range(H):
        for sx in range(W):
            if mask[sy, sx] and not lab[sy, sx]:
                k += 1; q = deque([(sy, sx)]); lab[sy, sx] = k; n = 0
                while q:
                    y, x = q.popleft(); n += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = k; q.append((ny, nx))
                if n > bestn:
                    best, bestn = k, n
    return lab == best


def quantize(rgb, mask, tol):
    """Greedy colour groups: the most common colours seed first; a colour joins the first seed
    within tol on every channel. Returns a label image (-1 = background) and seed colours."""
    px = rgb[mask]
    cnt = Counter(map(tuple, px))
    seeds, lut = [], {}
    for col, n in cnt.most_common():
        for i, s in enumerate(seeds):
            if max(abs(col[j] - s[0][j]) for j in range(3)) <= tol:
                s[1] += n; lut[col] = i; break
        else:
            lut[col] = len(seeds); seeds.append([col, n])
    lab = np.full(mask.shape, -1, int)
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        lab[y, x] = lut[tuple(rgb[y, x])]
    return lab, [np.array(s[0]) for s in seeds], [s[1] for s in seeds]


def coverage(counts, frac):
    tot, acc = sum(counts), 0
    for i, n in enumerate(sorted(counts, reverse=True)):
        acc += n
        if acc >= frac * tot:
            return i + 1
    return len(counts)


def clusters(lab):
    H, W = lab.shape
    seen = np.zeros((H, W), bool); sizes, thick = [], []
    for sy in range(H):
        for sx in range(W):
            if lab[sy, sx] < 0 or seen[sy, sx]:
                continue
            v = lab[sy, sx]; q = deque([(sy, sx)]); seen[sy, sx] = True; n = 0; per = 0
            while q:
                y, x = q.popleft(); n += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and lab[ny, nx] == v:
                        if not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                    else:
                        per += 1
            sizes.append(n)
            if n >= 4:
                thick.append(2.0 * n / per)  # ~ width of a strip; a 1 px band scores ~1
    s = np.array(sizes); tot = s.sum()
    return {
        'clusters': int(len(s)),
        'clusters_per_100px': round(100.0 * len(s) / tot, 2),
        'singleton_px_share': round(float(s[s == 1].sum()) / tot, 4),
        'le3_px_share': round(float(s[s <= 3].sum()) / tot, 4),
        'median_size': float(np.median(s)),
        'px_weighted_mean_size': round(float((s * s).sum()) / tot, 1),
        'strip_thickness_median_ge4': round(float(np.median(thick)), 2) if thick else None,
    }


def hug_bands(lab, minlen=3):
    """Banding in Pixel Logic's sense: a run of one colour sitting directly against a run of
    another colour with the same start and end (they 'hug'). Counted along rows and columns for
    runs of >= minlen px. Returns hugging run pairs and the share of figure pixels inside them."""
    H, W = lab.shape; hit = np.zeros((H, W), bool); pairs = 0

    def runs(line):
        out, i = [], 0
        while i < len(line):
            j = i
            while j + 1 < len(line) and line[j + 1] == line[i]:
                j += 1
            if line[i] >= 0 and j - i + 1 >= minlen:
                out.append((i, j, line[i]))
            i = j + 1
        return out
    for arr, T in ((lab, False), (lab.T, True)):
        R = [dict(((a, b), v) for a, b, v in runs(arr[k])) for k in range(arr.shape[0])]
        for k in range(arr.shape[0] - 1):
            for (a, b), v in R[k].items():
                w = R[k + 1].get((a, b))
                if w is not None and w != v:
                    pairs += 1
                    if T:
                        hit[a:b + 1, k] = True; hit[a:b + 1, k + 1] = True
                    else:
                        hit[k, a:b + 1] = True; hit[k + 1, a:b + 1] = True
    return pairs, round(float(hit.sum()) / max(1, int((lab >= 0).sum())), 4)


def family_of(c):
    r, g, b = (v / 255.0 for v in c)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if v < 0.16:
        return 'near-black'
    if s < 0.14:
        return 'neutral'
    return 'hue%03d' % (int(((h * 360) + 15) % 360 // 30) * 30)


def despeckle(lab, seeds, rgb, maxdist=48):
    """For lossy refs only: a pixel whose group differs from all 4 neighbours takes the most common
    neighbour group when that group's colour is within maxdist (per channel) of the pixel. This
    removes WebP specks; it also removes some real 1 px accents, so treat the result as a lower
    bound on the artist's singletons, and the raw number as an upper bound."""
    H, W = lab.shape; out = lab.copy(); changed = 0
    for y in range(H):
        for x in range(W):
            v = lab[y, x]
            if v < 0:
                continue
            nb = [lab[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))
                  if 0 <= y + dy < H and 0 <= x + dx < W and lab[y + dy, x + dx] >= 0]
            if not nb or v in nb:
                continue
            m = Counter(nb).most_common(1)[0][0]
            if np.abs(seeds[m] - rgb[y, x]).max() <= maxdist:
                out[y, x] = m; changed += 1
    return out, changed


def analyse(rgb, mask, tol, ids=None, desp=False):
    ys, xs = np.nonzero(mask)
    out = {'height_px': int(ys.max() - ys.min() + 1), 'width_px': int(xs.max() - xs.min() + 1),
           'figure_px': int(mask.sum())}
    lab, seeds, counts = quantize(rgb, mask, tol)
    if desp:
        lab, out['despeckled_px'] = despeckle(lab, seeds, rgb)
        counts = [int((lab == i).sum()) for i in range(len(seeds))]
        rgb = np.where(lab[..., None] >= 0, np.array(seeds + [np.zeros(3, int)])[lab], rgb)
    out['colour_groups'] = len([c for c in counts if c])
    out['cover95'] = coverage(counts, 0.95); out['cover99'] = coverage(counts, 0.99)
    out.update(clusters(lab))
    hp, hs = hug_bands(lab)
    out['banding'] = {'hugging_run_pairs': hp, 'hugging_pairs_per_1000px': round(1000.0 * hp / mask.sum(), 2),
                      'px_share_in_hugging_runs': hs}
    lum = rel_lum(rgb)
    L = lum[mask]
    out['lum_quartiles'] = [round(float(q), 3) for q in np.percentile(L, [10, 25, 50, 75, 90])]
    out['share_L_gt_0.60'] = round(float((L > 0.60).mean()), 3)
    out['share_L_lt_0.03'] = round(float((L < 0.03).mean()), 3)
    # silhouette ring
    H, W = mask.shape
    pad = np.pad(mask, 1)
    ring = mask & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    RL = lum[ring]
    rc = Counter(hexc(seeds[lab[y, x]]) for y, x in zip(*np.nonzero(ring)))
    out['outline'] = {
        'ring_px': int(ring.sum()),
        'share_dark_L_lt_0.03': round(float((RL < 0.03).mean()), 3),
        'share_dark_L_lt_0.06': round(float((RL < 0.06).mean()), 3),
        'median_L': round(float(np.median(RL)), 3),
        'distinct_groups_on_ring': len(rc),
        'top': [(c, round(n / ring.sum(), 3)) for c, n in rc.most_common(6)],
    }
    # hue families
    fam = [family_of(s) for s in seeds]
    famtot = Counter()
    for i, n in enumerate(counts):
        famtot[fam[i]] += n
    fams = {}
    for f, ft in famtot.most_common():
        if ft < 0.03 * mask.sum():
            continue
        members = sorted([(counts[i], i) for i in range(len(seeds)) if fam[i] == f], reverse=True)
        tones = [i for n, i in members if n >= 0.04 * ft]
        tones.sort(key=lambda i: float(rel_lum(seeds[i])))
        fams[f] = {'share': round(ft / mask.sum(), 3), 'tones_ge4pct': len(tones),
                   'ramp_dark_to_light': [hexc(seeds[i]) for i in tones]}
    out['families'] = fams
    # step jumps inside a family
    rank = {}
    for f, d in fams.items():
        for r, h in enumerate(d['ramp_dark_to_light']):
            rank[h] = (f, r)
    one = two = 0
    for dy, dx in ((0, 1), (1, 0)):
        a = lab[:H - dy, :W - dx]; b = lab[dy:, dx:]
        m = (a >= 0) & (b >= 0) & (a != b)
        for p, q in zip(a[m], b[m]):
            ra, rb = rank.get(hexc(seeds[p])), rank.get(hexc(seeds[q]))
            if ra and rb and ra[0] == rb[0]:
                if abs(ra[1] - rb[1]) == 1:
                    one += 1
                else:
                    two += 1
    out['in_family_steps'] = {'one_step': one, 'two_plus': two,
                              'two_plus_share': round(two / (one + two), 3) if one + two else None}
    if ids is not None:
        out['materials'] = material_report(rgb, mask, ids, lum)
    return out


MATNAMES = {1: 'skin', 2: 'white', 3: 'stocking', 4: 'gold', 5: 'hair', 6: 'hairtip', 7: 'indigo',
            8: 'lining', 9: 'boot', 10: 'haft', 11: 'steel', 12: 'glass', 13: 'veil', 14: 'beige'}


def material_report(rgb, mask, ids, lum):
    H, W = mask.shape
    rep = {}
    for m in np.unique(ids[mask]):
        if m == 0:
            continue
        sel = mask & (ids == m)
        cols = Counter(hexc(c) for c in rgb[sel])
        tot = sel.sum()
        rep[MATNAMES.get(int(m), str(int(m)))] = {
            'px': int(tot), 'tones': len([c for c, n in cols.items() if n >= 0.03 * tot]),
            'top': [(c, round(n / tot, 3)) for c, n in cols.most_common(6)]}
    # value contrast across borders between two light materials (white-on-white check)
    pairs = Counter(); lowc = Counter()
    for dy, dx in ((0, 1), (1, 0)):
        a = ids[:H - dy, :W - dx]; b = ids[dy:, dx:]
        ma = mask[:H - dy, :W - dx] & mask[dy:, dx:] & (a != b) & (a > 0) & (b > 0)
        la = lum[:H - dy, :W - dx]; lb = lum[dy:, dx:]
        for y, x in zip(*np.nonzero(ma)):
            k = tuple(sorted((MATNAMES.get(int(a[y, x]), '?'), MATNAMES.get(int(b[y, x]), '?'))))
            pairs[k] += 1
            if contrast(la[y, x], lb[y, x]) < 1.5:
                lowc[k] += 1
    rep['_borders'] = {'%s|%s' % k: {'px_pairs': n, 'share_contrast_lt_1.5': round(lowc[k] / n, 3)}
                       for k, n in pairs.most_common(12)}
    return rep


def downsample_ids(path, ss, shape):
    a = np.asarray(Image.open(path).convert('RGBA'))[..., 0].astype(int)
    H, W = shape
    out = np.zeros((H, W), int)
    for y in range(H):
        for x in range(W):
            blk = a[y * ss:(y + 1) * ss, x * ss:(x + 1) * ss].ravel()
            blk = blk[blk > 0]
            if len(blk):
                out[y, x] = Counter(blk.tolist()).most_common(1)[0][0]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image'); ap.add_argument('--box', type=int, nargs=4)
    ap.add_argument('--bgtol', type=int, default=22); ap.add_argument('--tol', type=int, default=12)
    ap.add_argument('--bg', default=''); ap.add_argument('--ids'); ap.add_argument('--ss', type=int, default=4)
    ap.add_argument('--json'); ap.add_argument('--label')
    ap.add_argument('--despeckle', action='store_true', help='lossy refs: fold 1 px compression specks into their neighbours')
    ap.add_argument('--shadow', default='', help='ground-shadow colour(s) "#rrggbb,..." removed in the bottom --shadow-rows rows')
    ap.add_argument('--shadow-rows', type=int, default=16); ap.add_argument('--shadow-tol', type=int, default=10)
    ap.add_argument('--mask-out', help='write the figure mask PNG here (to eyeball the bg removal)')
    ar = ap.parse_args()
    rgb, alpha = load(ar.image, ar.box)
    extra = [tuple(int(h.strip().lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) for h in ar.bg.split(',') if h.strip()]
    mask = alpha if alpha is not None else largest_component(flood_bg(rgb, ar.bgtol, extra))
    if ar.shadow:
        H = mask.shape[0]
        for h in ar.shadow.split(','):
            c = np.array([int(h.strip().lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)])
            near = np.abs(rgb - c).max(axis=2) <= ar.shadow_tol
            near[:H - ar.shadow_rows] = False
            mask &= ~near
        mask = largest_component(mask)
    if ar.mask_out:
        Image.fromarray((mask * 255).astype(np.uint8)).save(ar.mask_out)
    ids = downsample_ids(ar.ids, ar.ss, mask.shape) if ar.ids else None
    res = analyse(rgb, mask, ar.tol, ids, ar.despeckle)
    res = {'label': ar.label or ar.image, 'box': ar.box, 'tol': ar.tol, 'despeckle': ar.despeckle, **res}
    txt = json.dumps(res, indent=1)
    if ar.json:
        open(ar.json, 'w').write(txt)
    print(txt)


if __name__ == '__main__':
    main()
