"""Face lane, v2 head: construction-grid faces placed on the real v2 renders (round F1).

The v2 head (MMD用女性素体 by 射当ユウキ on the SiroinoSotai body) renders a blank skin face with
hair strands crossing it. This module draws the face ON that render, per still, the way
ART-RULES section 6 asks: construction first, then negative zones, then the features.

Inputs per still (a render folder <still>/px<N>):
  noface.png, noface_id.png, meta.json   the render (rosace_post.py --no-face)
  facepass.json, facewin.png              tools/pixel-pipeline/author_faces_pass.py: the head's own
                                          eye / brow / mouth meshes projected (where the MMD author
                                          put them in this pose), the chin and nose points, and the
                                          head skin alone (the face window before hair covers it)

Steps (compose()):
  1. construct   the grid from the face pass: facing and yaw from the head's forward axis, near and
                 far eye centres (the MMD iris centroids, near = nearer the camera), the chin, the
                 nose, the mouth row (FC-P01 order: chin < mouth < nose < eye), the brow line
  2. window      negative zone FC-N17: inside the face window and below the brow band, a hair
                 strand that has face on both sides becomes skin; nothing but the fringe edge may sit
                 between the eyes below the lash top; framing locks on the window edge stay
  3. skin        FC-P16 / PX-N01: the render's 3D banding on the face is flattened to S2, then the
                 designed shadows go on: the fringe's cast shadow (a band, thicker away from the key
                 light), one jaw shadow on the shadow side, an optional S1 cheek light
  4. features    glyphs from the library (art/rosace/construct/faces/v2/lib_<px>.json), each placed
                 on its own construction point: eyes on the projected iris centres, brows on the
                 eye's lash row, nose on the nose point, mouth on the mouth row, blush under the eyes.
                 Glyphs are authored facing screen-right and mirror for screen-left.
Glyph characters (artlib KEY plus a few placement codes):
  O OL  a A2  b A3  c A4  h A5  w W1  e W2  n I3  d I4  s S2  t S3  m S4  p SB  1 S1
  B brow: OL where it lands on hair, I3 on skin (FC-P15)
  k skin S2 that may land on hair inside the window (clears a strand under a feature)
  . leave the render
The expression spec (art/rosace/construct/faces/v2/<facing>_<expr>_<px>.json) names the glyphs.

  python tools/art-construct/face_v2.py compose --still <dir>/px144 --expr confident --out <png>
"""
import argparse
import copy
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402

LIB = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'v2'
GKEY = {'O': 'OL', 'a': 'A2', 'b': 'A3', 'c': 'A4', 'h': 'A5', 'w': 'W1', 'e': 'W2', 'n': 'I3',
        'd': 'I4', 's': 'S2', 't': 'S3', 'm': 'S4', 'p': 'SB', '1': 'S1', 'k': 'S2', 'B': None}
EXPR_ALIAS = {'neutral': 'confident', 'resolute': 'focused', 'attack': 'focused',
              'focus': 'focused', 'radiant': 'smile', 'happy': 'smile', 'skill': 'smile', 'pain': 'hurt',
              'blink': 'closed'}
HAIR = ('hair', 'hairtip')


# ------------------------------------------------------------------ loading

class Still:
    def __init__(self, d, tag='noface'):
        d = Path(d)
        self.dir = d
        self.meta = json.loads((d / 'meta.json').read_text())
        self.fp = json.loads((d / 'facepass.json').read_text())
        self.img = np.array(Image.open(d / f'{tag}.png').convert('RGBA'))
        self.mat = np.asarray(Image.open(d / f'{tag}_id.png').convert('RGBA'))[..., 0].astype(int)
        mats = self.meta['materials']
        self.mid = {k: v['id'] for k, v in mats.items()}
        ss = self.meta['ss']
        w = np.asarray(Image.open(d / 'facewin.png').convert('RGBA'))[..., 3] > 0
        H, W = self.mat.shape
        w = w[:H * ss, :W * ss].reshape(H, ss, W, ss).mean((1, 3))
        self.win = w >= 0.5
        self.px = self.meta['px']
        self.pal = A.Palette()

    def is_(self, *names):
        return np.isin(self.mat, [self.mid[n] for n in names if n in self.mid])


def load_lib(px):
    return json.loads((LIB / f'lib_{px}.json').read_text(encoding='utf-8'))


def load_spec(facing, expr, px):
    expr = EXPR_ALIAS.get(expr, expr)
    for f in (facing, 'q34'):
        p = LIB / f'{f}_{expr}_{px}.json'
        if p.exists():
            s = json.loads(p.read_text(encoding='utf-8'))
            s['_name'] = f'{f}_{expr}_{px}'
            return s
    return None


# ------------------------------------------------------------------ 1. construction

def centroid(pts):
    a = np.asarray(pts, float)
    return a[:, 0].mean(), a[:, 1].mean(), a[:, 2].mean()


def construct(st):
    fp = st.fp
    fwd = fp['axes']['fwd']
    side = 1 if fwd[0] >= 0 else -1                   # screen direction she faces
    yaw = math.degrees(math.atan2(abs(fwd[0]), max(fwd[2], 1e-6)))
    facing = 'front' if yaw < 12 else ('q34' if yaw < 70 else 'profile')
    eyes = {s: centroid(p) for s, p in fp['refs']['ref_eyes'].items()}
    lash = {s: centroid(p) for s, p in fp['refs']['ref_eyelush'].items()}
    brow = {s: centroid(p) for s, p in fp['refs']['ref_eyeblow'].items()}
    near_s = min(eyes, key=lambda s: eyes[s][2])
    if facing == 'front':
        # nearly frontal: both eyes are equally near; 'near' is the one on the side away from the turn
        near_s = min(eyes, key=lambda s: eyes[s][0] * side)
    far_s = 'L' if near_s == 'R' else 'R'
    g = {'side': side, 'yaw': round(yaw, 1), 'facing': facing, 'up': fp['axes']['up'][:2],
         'chin': fp['chin'][:2], 'nose': fp['nose'][:2],
         'eye': {'near': eyes[near_s][:2], 'far': eyes[far_s][:2]},
         'lash': {'near': lash[near_s][:2], 'far': lash[far_s][:2]},
         'brow': {'near': brow[near_s][:2], 'far': brow[far_s][:2]},
         'mouth_mesh': centroid(fp['refs']['ref_mouth']['C'])[:2]}
    # the far eye is hidden behind the nose bridge past ~70 deg (the profile draws one eye)
    g['far_visible'] = facing != 'profile'
    # mouth row: a third of the way from the chin to the nose, on the chin-nose line (FC-P01: the
    # mouth 2-3 rows over the chin, the nose 6-7; the v2 head is smaller, so ratios, not rows)
    cx, cy = g['chin']
    nx, ny = g['nose']
    g['mouth'] = [cx + (nx - cx) * 0.38, cy + (ny - cy) * 0.38]
    return g


# ------------------------------------------------------------------ helpers

def ipt(p):
    return int(math.floor(p[0])), int(math.floor(p[1]))


def brow_line_y(g, x):
    """y of the brow band at column x (a line through both projected brows)"""
    (x0, y0), (x1, y1) = g['brow']['near'], g['brow']['far']
    if abs(x1 - x0) < 1e-3:
        return (y0 + y1) / 2
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0)


def glyph_pixels(gl, at, flip):
    """(x, y, ch) for a glyph {'rows', 'origin'} placed with its origin on at"""
    ox, oy = gl['origin']
    n = max(len(r) for r in gl['rows'])
    for j, row in enumerate(gl['rows']):
        for i, ch in enumerate(row):
            if ch in '. ':
                continue
            x = at[0] + ((n - 1 - i) - (n - 1 - ox) if flip else i - ox)
            yield x, at[1] + j - oy, ch


# ------------------------------------------------------------------ 2. face window

def clean_window(st, g, img, mat, params, log):
    """hair strands crossing the face become skin (FC-N17); returns the face mask used later"""
    H, W = mat.shape
    sk, hid = st.mid['skin'], [st.mid[n] for n in HAIR if n in st.mid]
    s2 = st.pal.rgb['S2']
    face = st.win & np.isin(mat, [sk] + hid) & (img[..., 3] > 0)
    edge_keep = params.get('edge_keep', 2)
    below = params.get('below_brow', 1)
    changed = 0
    ys, xs = np.nonzero(face)
    for _ in range(2):
        for y in range(H):
            row = np.nonzero(st.win[y])[0]
            if not len(row):
                continue
            wx0, wx1 = row.min(), row.max()
            x = wx0
            while x <= wx1:
                if not (np.isin(mat[y, x], hid) and st.win[y, x] and y > brow_line_y(g, x) + below):
                    x += 1
                    continue
                x2 = x
                while x2 + 1 <= wx1 and np.isin(mat[y, x2 + 1], hid) and st.win[y, x2 + 1]:
                    x2 += 1
                # a strand: skin (or window) on both sides, not touching the window edge band
                inner = x - wx0 >= edge_keep and wx1 - x2 >= edge_keep
                lsk = x - 1 >= 0 and mat[y, x - 1] == sk
                rsk = x2 + 1 < W and mat[y, x2 + 1] == sk
                if inner and (lsk or rsk) and (x2 - x + 1) <= params.get('strand_max', 3):
                    for xx in range(x, x2 + 1):
                        img[y, xx, :3] = s2
                        img[y, xx, 3] = 255
                        mat[y, xx] = sk
                        changed += 1
                x = x2 + 1
    log.append(f'window: {changed} strand px -> skin (edge_keep {edge_keep}, strand_max {params.get("strand_max", 3)})')
    return st.win & (mat == sk)


# ------------------------------------------------------------------ 3. skin

def shade_skin(st, g, img, mat, face, params, log, window_cols=()):
    pal = st.pal.rgb
    H, W = mat.shape
    sk = st.mid['skin']
    flat = {pal['S3'], pal['S4'], pal['S1']}
    n = 0
    for y, x in zip(*np.nonzero(face)):
        if y > brow_line_y(g, x) - 1 and tuple(img[y, x, :3]) in flat:
            img[y, x, :3] = pal['S2']
            n += 1
    log.append(f'skin: {n} render px flattened to S2')
    # fringe cast shadow: the first skin px under hair (or under the window top) in every column of
    # the face, a second row on the side away from the key light (light from screen-right)
    hid = [st.mid[k] for k in HAIR if k in st.mid]
    mid_x = (g['eye']['near'][0] + g['eye']['far'][0]) / 2
    band = params.get('fringe_band', 2)
    cast = []
    for x in range(W):
        col = np.nonzero(face[:, x])[0]
        if not len(col):
            continue
        y = col.min()
        if y == 0 or not (np.isin(mat[y - 1, x], hid)):
            continue
        rows = 1 if (x >= mid_x or x in window_cols) else band
        for k in range(rows):
            if y + k < H and face[y + k, x] and y + k < g['eye']['near'][1] - 1:
                cast.append((x, y + k))
    # PX-N03 / FC-N15: a cast-shadow px with no 8-neighbour in the band is a speck, not a shape
    cs = set(cast)
    cast = [(x, y) for x, y in cast if any((x + dx, y + dy) in cs for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                                           if dx or dy)]
    for x, y in cast:
        img[y, x, :3] = pal['S3']
    log.append(f'skin: fringe shadow {len(cast)} px')
    # jaw shadow on the side away from the light: the last 2 face px of the lower rows
    jaw = []
    if params.get('jaw', True):
        cy = int(g['chin'][1])
        y0 = int(max(g['mouth'][1] - 1, g['nose'][1]))
        for y in range(y0, min(H, cy + 1)):
            xs = np.nonzero(face[y])[0]
            if len(xs) < 4:
                continue
            x = xs.min()
            jaw += [(x, y), (x + 1, y)] if y >= cy - 1 else [(x, y)]
        for x, y in jaw:
            img[y, x, :3] = pal['S3']
    log.append(f'skin: jaw shadow {len(jaw)} px')
    return set(cast) | set(jaw)


# ------------------------------------------------------------------ 4. features

def place(st, g, img, mat, face, gl, at, flip, rec, name, only_skin=False):
    pal = st.pal.rgb
    H, W = mat.shape
    hid = [st.mid[k] for k in HAIR if k in st.mid]
    sk = st.mid['skin']
    near_win = A.dilate(st.win, 1, diag=True)
    put = []
    for x, y, ch in glyph_pixels(gl, at, flip):
        if not (0 <= x < W and 0 <= y < H):
            continue
        onhair = mat[y, x] in hid
        ok = (mat[y, x] == sk) or (onhair and near_win[y, x]) or (ch == 'O' and near_win[y, x] and img[y, x, 3] > 0)
        if only_skin:
            ok = mat[y, x] == sk and st.win[y, x]
        if not ok:
            continue
        if ch == 'B':
            code = 'OL' if onhair else 'I3'
        else:
            code = GKEY[ch]
        img[y, x, :3] = pal[code]
        img[y, x, 3] = 255
        if ch in 'k' or (onhair and ch != 'B' and ch != 'O'):
            mat[y, x] = sk
        put.append([int(x), int(y), code])
    rec.setdefault('features', {})[name] = put
    return put


def glyph_box(gl, at, flip):
    pts = list(glyph_pixels(gl, at, flip))
    xs = [x for x, y, ch in pts]
    ys = [y for x, y, ch in pts]
    return min(xs), min(ys), max(xs), max(ys)


def plan_eyes(st, g, spec, lib, params, flip):
    """where each eye glyph lands: the projected iris centre, then the anime 3/4 cheat: the eyes keep
    a gap of at least params['gap'] px (FC-P05) by moving the NEAR eye away from the far one, never past
    the near face edge; the far eye stays on its projection (it carries the contour)"""
    plan = {}
    strong = g['yaw'] >= params.get('strong_yaw', 40)
    for which in ('near', 'far'):
        key = spec.get(f'eye_{which}')
        if which == 'far':
            if not g['far_visible']:
                continue
            if strong and spec.get('eye_far_strong'):
                key = spec['eye_far_strong']
        if not key:
            continue
        ex, ey = ipt(g['eye'][which])
        plan[which] = {'key': key, 'at': [ex + params.get(f'{which}_dx', 0) * (-1 if flip else 1),
                                          ey + params.get('eye_dy', 0) + params.get(f'{which}_dy', 0)]}
    # the far eye sits on the contour: pull it in (at most 2 px) until every glyph px lands on the face
    # window, or its outer iris is cut off by the silhouette (round F1: N1's far iris lost its A4 row)
    if 'far' in plan and params.get('far_fit', True):
        H, W = st.win.shape
        for _ in range(2):
            gl = lib['eyes'][plan['far']['key']]
            out = [1 for x, y, ch in glyph_pixels(gl, plan['far']['at'], flip)
                   if ch != 'O' and not (0 <= x < W and 0 <= y < H and st.win[y, x])]
            if not out:
                break
            plan['far']['at'][0] += 1 if flip else -1
    if 'near' in plan and 'far' in plan and params.get('max_roll', 1) is not None:
        dy = plan['far']['at'][1] - plan['near']['at'][1]
        lim = params.get('max_roll', 1)
        if abs(dy) > lim and g['facing'] != 'front':
            # keep the far eye on its projection (it sits on the contour); the near eye follows the line
            plan['near']['at'][1] = plan['far']['at'][1] - (lim if dy > 0 else -lim)
    if 'near' in plan and 'far' in plan:
        gap = params.get('gap') or (3 if g['facing'] == 'q34' else 4)
        for _ in range(4):
            nb = glyph_box(lib['eyes'][plan['near']['key']], plan['near']['at'], flip)
            fb = glyph_box(lib['eyes'][plan['far']['key']], plan['far']['at'], flip)
            cur = (fb[0] - nb[2] - 1) if not flip else (nb[0] - fb[2] - 1)
            if cur >= gap:
                break
            plan['near']['at'][0] += -1 if not flip else 1
    for w, v in plan.items():
        v['box'] = glyph_box(lib['eyes'][v['key']], v['at'], flip)
    return plan


def cut_windows(st, g, img, mat, plan, spec, lib, params, flip, log):
    """negative zones over the eyes: 'lash' keeps one skin row between the fringe and the lash top;
    'brow' opens a forehead window from the brow row down (FC-P27), the fringe arching over it"""
    mode = params.get('window', 'lash')
    hid = [st.mid[k] for k in HAIR if k in st.mid]
    s2 = st.pal.rgb['S2']
    H, W = mat.shape
    n = 0
    cols = set()
    for which, v in plan.items():
        x0, y0, x1, y1 = v['box']
        top = y0 - 1
        if mode in ('brow', 'brow_narrow') and spec.get(f'brow_{which}') and params.get('brows', True):
            bg = lib['brows'][spec[f'brow_{which}']]
            bat = (v['at'][0] + (-bg.get('dx', 0) if flip else bg.get('dx', 0)), v['at'][1] + bg.get('dy', 0)
                   + params.get('brow_dy', 0))
            bx0, by0, bx1, by1 = glyph_box(bg, bat, flip)
            if mode == 'brow_narrow':
                # an arch in the fringe just over the brow (brow +-1 px), the clump tips left hanging beside
                # the eye; the eye box itself below it (FC-P27 window, HR-P04 framing clumps)
                for y in range(max(0, by0 - 1), min(H, y0)):
                    for x in range(max(0, bx0 - 1), min(W, bx1 + 2)):
                        if st.win[y, x] and mat[y, x] in hid:
                            img[y, x, :3] = s2
                            img[y, x, 3] = 255
                            mat[y, x] = st.mid['skin']
                            n += 1
                cols |= set(range(bx0 - 1, bx1 + 2))
            else:
                top = by0 - 1      # one row over the brow for the fringe's cast shadow (FC-P27: shadow above)
                x0, x1 = min(x0, bx0 - 1), max(x1, bx1 + 1)
        cols |= set(range(x0, x1 + 1))
        # FC-N07: one skin px beside the lash ends too, so the lash never touches the darkest hair
        side = params.get('lash_margin', 1)
        for y in range(max(0, v['box'][1]), min(H, v['box'][1] + 3)):
            for x in list(range(max(0, v['box'][0] - side), v['box'][0])) + list(range(v['box'][2] + 1, min(W, v['box'][2] + 1 + side))):
                if st.win[y, x] and mat[y, x] in hid:
                    img[y, x, :3] = s2
                    img[y, x, 3] = 255
                    mat[y, x] = st.mid['skin']
                    n += 1
        for y in range(max(0, top), min(H, y1 + 1)):
            for x in range(max(0, x0), min(W, x1 + 1)):
                if st.win[y, x] and mat[y, x] in hid:
                    img[y, x, :3] = s2
                    img[y, x, 3] = 255
                    mat[y, x] = st.mid['skin']
                    n += 1
    # FC-N17: no hair between the eyes below the lash top
    if 'near' in plan and 'far' in plan:
        nb, fb = plan['near']['box'], plan['far']['box']
        xa, xb = (nb[2] + 1, fb[0] - 1) if not flip else (fb[2] + 1, nb[0] - 1)
        ya = max(nb[1], fb[1]) + 1
        yb = max(nb[3], fb[3])
        for y in range(max(0, ya), min(H, yb + 1)):
            for x in range(max(0, xa), min(W, xb + 1)):
                if st.win[y, x] and mat[y, x] in hid:
                    img[y, x, :3] = s2
                    mat[y, x] = st.mid['skin']
                    n += 1
    log.append(f'windows ({mode}): {n} hair px -> skin over and between the eyes')
    return cols


def compose(still_dir, expr='confident', spec=None, params=None, facing=None, tag='noface', base=None):
    """returns (rgba image, material ids, record, log). base: (img, mat) to draw on instead of the
    still's own tag files (the override step hands in its pre-faced render)"""
    st = Still(still_dir, tag)
    if base is not None:
        st.img, st.mat = base[0].copy(), base[1].copy()
    g = construct(st)
    facing = facing or g['facing']
    spec = spec or load_spec(facing, expr, st.px)
    if spec is None:
        raise SystemExit(f'no spec for {facing}/{expr}/{st.px}')
    params = dict(spec.get('params', {}), **(params or {}))
    lib = load_lib(st.px)
    img, mat = st.img.copy(), st.mat.copy()
    log = [f"{st.dir}: facing {facing} (yaw {g['yaw']}, side {g['side']}), spec {spec.get('_name')}"]
    rec = {'still': str(st.dir), 'spec': spec.get('_name'), 'expr': spec.get('expr'), 'facing': facing,
           'grid': g, 'params': params, 'gaze': spec.get('gaze')}
    flip = g['side'] < 0
    plan = plan_eyes(st, g, spec, lib, params, flip)
    face = clean_window(st, g, img, mat, params, log)
    wcols = cut_windows(st, g, img, mat, plan, spec, lib, params, flip, log)
    face = st.win & (mat == st.mid['skin'])
    shade_skin(st, g, img, mat, face, params, log, wcols)
    # blush first, so an eye's lower lash always wins over it; dy counts rows under the eye's bottom row
    pkey = spec.get('blush')
    for which, v in plan.items():
        if pkey and params.get('blush', True) and f'{pkey}_{which}' in lib['blush']:
            pg = lib['blush'][f'{pkey}_{which}']
            bat = (v['at'][0] + (-pg.get('dx', 0) if flip else pg.get('dx', 0)), v['box'][3] + pg.get('dy', 0))
            place(st, g, img, mat, face, pg, bat, flip, rec, f'blush_{which}', only_skin=True)
    for which, v in plan.items():
        gl = lib['eyes'][v['key']]
        place(st, g, img, mat, face, gl, v['at'], flip, rec, f'eye_{which}')
        rec.setdefault('eye_at', {})[which] = v
        bkey = spec.get(f'brow_{which}')
        if bkey and params.get('brows', True):
            bg = lib['brows'][bkey]
            bat = (v['at'][0] + (-bg.get('dx', 0) if flip else bg.get('dx', 0)), v['at'][1] + bg.get('dy', 0) + params.get('brow_dy', 0))
            place(st, g, img, mat, face, bg, bat, flip, rec, f'brow_{which}')
    if spec.get('nose') and spec['nose'] in lib['noses']:
        nx, ny = ipt(g['nose'])
        place(st, g, img, mat, face, lib['noses'][spec['nose']], (nx, ny + params.get('nose_dy', 0)), flip, rec, 'nose',
              only_skin=True)
    if spec.get('mouth'):
        mx, my = ipt(g['mouth'])
        mg = lib['mouths'][params.get('mouth', spec['mouth'])]
        place(st, g, img, mat, face, mg, (mx + (-1 if flip else 1) * params.get('mouth_dx', 0),
                                         my + params.get('mouth_dy', 0)), flip, rec, 'mouth', only_skin=True)
    return img, mat, rec, log


# ------------------------------------------------------------------ CLI

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['compose'])
    ap.add_argument('--still', required=True)
    ap.add_argument('--expr', default='confident')
    ap.add_argument('--facing')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    img, mat, rec, log = compose(a.still, a.expr, facing=a.facing)
    Image.fromarray(img).save(a.out)
    print('\n'.join(log))


if __name__ == '__main__':
    main()
