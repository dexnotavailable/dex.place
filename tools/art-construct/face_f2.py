"""Face lane round F2: the face drawn on the v2 render with the fringe kept, the jaw rebuilt and one
eye model per view (ART-RULES section 6; the round-F1 critique).

F1 (face_v2.py) cut skin windows through the fringe for brows, kept the render's squat jaw and
scattered S3/S4 pixels over the lower face. F2 keeps face_v2's construction (face pass, eye
placement, strand cleaning) and changes what goes on the render:

  1. construct   face_v2.construct: facing, yaw, projected eyes, chin, nose, mouth row
  2. strands     face_v2.clean_window (FC-N29) and a stricter pass: no hair px in an eye box or on a cheek
  3. fringe      NO windows. The render's fringe silhouette stays (the round-4 control's), each flat run
                 on its bottom edge tapers to a 1 px tip (the other px of the run go up 1 row) (critique 2f)
  4. jaw         the lower face rebuilt on the construction: the chin moved down chin_len px along the
                 head's own down axis and chin_far px toward the far side, the jaw a U curve from the
                 taper row (runs that only shorten toward the chin, FC-N28), the chin point 2-3 px (FC-P08)
  5. skin        the render's banding flattened to S2 everywhere on the face (no S3/S4 below the eye line
                 but the contour); a 1-row S3 fringe shadow under the bangs; a 1 px S3 under the chin on
                 the neck; two skin tones plus blush (critique 2c, 2e)
  6. profile     a profile's front contour redrawn in skin: the nose a 1 px skin bump, the lips a 1 px
                 pink notch, no brown outline on the face silhouette (critique 2g)
  7. features    glyphs from art/rosace/construct/faces/f2/lib_<px>.json: blush first, then the eyes,
                 brows only where a real gap in the fringe shows skin (critique 2b), nose, mouth

Glyph characters are face_v2.GKEY's plus 'l' S3 lower lid and 'r' the brow in the dark hair tone.

  python tools/art-construct/face_f2.py compose --still <dir>/px144 --expr confident --out <png>
"""
import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import face_v2 as V  # noqa: E402

LIB = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'f2'
GKEY = dict(V.GKEY, l='S3', r='I3', q='I2', x='S1', R='I4', L='SB', g='A3')
HAIR = V.HAIR
SKIN_TONES = ('S1', 'S2', 'S3', 'S4', 'SB')


def load_lib(px):
    return json.loads((LIB / f'lib_{px}.json').read_text(encoding='utf-8'))


def load_spec(facing, expr, px):
    expr = V.EXPR_ALIAS.get(expr, expr)
    for f in (facing, 'q34'):
        p = LIB / f'{f}_{expr}_{px}.json'
        if p.exists():
            s = json.loads(p.read_text(encoding='utf-8'))
            s['_name'] = f'f2:{f}_{expr}_{px}'
            return s
    return None


# ------------------------------------------------------------------ small helpers

class Ctx:
    """the working state of one composition"""
    def __init__(self, st, g, img, mat, params, log):
        self.st, self.g, self.img, self.mat, self.p, self.log = st, g, img, mat, params, log
        self.pal = st.pal.rgb
        self.sk = st.mid['skin']
        self.hid = [st.mid[k] for k in HAIR if k in st.mid]
        self.H, self.W = mat.shape
        self.win = st.win.copy()
        self.clip = None

    def face(self):
        return self.win & (self.mat == self.sk)

    def hair(self, x, y):
        return 0 <= x < self.W and 0 <= y < self.H and self.mat[y, x] in self.hid

    def put(self, x, y, code, mat=None):
        self.img[y, x, :3] = self.pal[code]
        self.img[y, x, 3] = 255
        if mat is not None:
            self.mat[y, x] = mat

    def code_at(self, x, y):
        return self.st.pal.inv.get(tuple(int(v) for v in self.img[y, x, :3]))


def unit(v):
    n = math.hypot(v[0], v[1]) or 1.0
    return v[0] / n, v[1] / n


# ------------------------------------------------------------------ 3. fringe

def taper_fringe(c, plan, flip):
    """each flat run (>= taper_min px on one row) on the fringe's bottom edge over the face keeps 1 px as
    its tip; the rest of the run goes up 1 row (hair -> skin). The tip sits at the run's end toward the
    nearer face edge (side clumps swing to their own side, AnimeOutline hair 3/4), in the middle third at
    the run's middle. Columns of an eye box keep their edge (the eye glyph owns them)."""
    p = c.p
    if not p.get('taper', True):
        return 0
    face = c.face()
    cols = np.nonzero(face.any(0))[0]
    if not len(cols):
        return 0
    x0, x1 = cols.min(), cols.max()
    eye_y = min(v['box'][1] for v in plan.values()) if plan else c.H
    edge = {}
    for x in range(x0, x1 + 1):
        ys = np.nonzero(face[:, x])[0]
        if not len(ys):
            continue
        y = ys.min()
        if y > 0 and c.hair(x, y - 1) and y - 1 <= eye_y + p.get('taper_below', 1):
            edge[x] = y - 1
    n = 0
    xs = sorted(edge)
    runs, cur = [], []
    for x in xs:
        if cur and x == cur[-1] + 1 and edge[x] == edge[cur[-1]]:
            cur.append(x)
        else:
            if cur:
                runs.append(cur)
            cur = [x]
    if cur:
        runs.append(cur)
    mid = (x0 + x1) / 2
    third = (x1 - x0) / 6
    for run in runs:
        if len(run) < p.get('taper_min', 3):
            continue
        rc = (run[0] + run[-1]) / 2
        if rc < mid - third:
            tip = [run[0]]
        elif rc > mid + third:
            tip = [run[-1]]
        else:
            tip = [run[len(run) // 2]]
        for x in run:
            if x in tip:
                continue
            y = edge[x]
            # never open a hole through a thin fringe: the px above must be hair too
            if not c.hair(x, y - 1):
                continue
            c.put(x, y, 'S2', c.sk)
            c.win[y, x] = c.win[y, x] or c.st.win[y + 1, x]
            n += 1
    c.log.append(f'fringe: {n} px tapered ({len(runs)} edge runs)')
    return n


# ------------------------------------------------------------------ 4. jaw

def rebuild_jaw(c):
    """the lower face on the construction: a U curve from the taper row to a chin moved chin_len px down
    the head's axis and chin_far px toward the far side. Face px outside the curve take the colour of the
    nearest non-face px outward on their row (the hair or neck behind the jaw); px added under the old chin
    become skin; the neck px right under the new jaw get the S3 under-chin shadow."""
    p, g = c.p, c.g
    if not p.get('jaw', True):
        return
    face = c.face()
    if not face.any():
        return
    up = unit(g['up'])
    down = (-up[0], -up[1])
    side = g['side']
    cl, cf = p.get('chin_len', 2), p.get('chin_far', 1)
    chx = g['chin'][0] + down[0] * cl + side * cf
    chy = g['chin'][1] + down[1] * cl
    cy = int(math.floor(chy))
    # the taper starts on the mouth row (critique 2d) unless told otherwise
    start = {'mouth': g['mouth'][1], 'nose': g['nose'][1]}.get(p.get('jaw_from', 'mouth'), g['mouth'][1])
    ys = int(math.floor(start)) + p.get('jaw_from_dy', 0)
    row = np.nonzero(face[ys])[0]
    if not len(row) or cy <= ys:
        return
    # the contiguous face span around the chin column
    L, R = int(row.min()), int(row.max())
    cw_n, cw_f = p.get('chin_w', (1, 1))          # chin point half widths: near side, far side
    cx = int(math.floor(chx))
    # both jaw sides taper: the chin point stays jaw_min px inside each side of the start row's span
    jm = p.get('jaw_min', 2)
    cx = max(L + jm + (cw_n if side > 0 else cw_f), min(R - jm - (cw_f if side > 0 else cw_n), cx))
    chx = cx + 0.5
    lo_tip = cx - (cw_n if side > 0 else cw_f)
    hi_tip = cx + (cw_f if side > 0 else cw_n)
    pw = p.get('jaw_pow', 1.6)
    removed = added = 0
    new_rows = {}
    for y in range(ys + 1, cy + 1):
        t = (y - ys) / max(1, cy - ys)
        f = t ** pw
        xl = L + (lo_tip - L) * f
        xr = R + (hi_tip - R) * f
        a, b = int(math.ceil(xl - 0.35)), int(math.floor(xr + 0.35))
        new_rows[y] = (a, b)
    # rows below the new chin lose any face px
    last = max(new_rows)
    for y in range(ys + 1, min(c.H, last + 4)):
        a, b = new_rows.get(y, (1, 0))
        olds = np.nonzero(face[y])[0]
        for x in olds:
            if a <= x <= b:
                continue
            # fill from the nearest non-face px outward on this row (toward the side the px is on)
            step = -1 if x < (a + b) / 2 or y > last else 1
            if y > last:
                step = -1 if x < chx else 1
            xx = x
            while 0 <= xx < c.W and face[y, xx]:
                xx += step
            if 0 <= xx < c.W:
                if c.mat[y, xx] == c.sk:          # neck skin behind the jaw: the jaw's shadow on it
                    c.put(x, y, 'S3')
                else:
                    c.img[y, x] = c.img[y, xx]
                    c.mat[y, x] = c.mat[y, xx]
            else:
                c.put(x, y, 'S3')
            c.win[y, x] = False
            removed += 1
        for x in range(a, b + 1):
            if not (0 <= x < c.W) or face[y, x]:
                continue
            if c.mat[y, x] in c.hid and not p.get('jaw_over_hair', False):
                continue
            if c.img[y, x, 3] == 0 and not p.get('jaw_over_bg', False):
                continue
            c.put(x, y, 'S2', c.sk)
            c.win[y, x] = True
            added += 1
    # the under-chin shadow: the first px under each jaw column (neck skin -> S3, collar -> S4 contact)
    face = c.face()
    sh = 0
    for x in range(min(a for a, b in new_rows.values()), max(b for a, b in new_rows.values()) + 1):
        col = np.nonzero(face[:, x])[0]
        col = col[col > ys]
        if not len(col):
            continue
        y = col.max() + 1
        if y >= c.H or c.img[y, x, 3] == 0:
            continue
        if c.mat[y, x] == c.sk:
            c.put(x, y, 'S3')
            sh += 1
        elif c.mat[y, x] not in c.hid and p.get('chin_contact', 'S4'):
            c.put(x, y, p.get('chin_contact', 'S4'))
            sh += 1
    c.g['chin_f2'] = [chx, chy]
    c.log.append(f'jaw: chin moved to ({chx:.1f}, {chy:.1f}), taper rows {ys + 1}-{cy}, '
                 f'{removed} px off, {added} px on, {sh} px under-chin shadow')


# ------------------------------------------------------------------ 5. skin

def shade_skin(c, plan):
    p = c.p
    face = c.face()
    n = 0
    s2 = c.pal['S2']
    for y, x in zip(*np.nonzero(face)):
        if tuple(c.img[y, x, :3]) != s2:
            c.put(x, y, 'S2')
            n += 1
    # the face's own edge: skin px just outside the window (the render's contour ring) drawn in S4/G4 read as
    # a brown outline or stubble on the cheek (critique F1 2c, 2g); they step to S3, the jaw contour tone
    ring = A.dilate(face, 1) & ~face & (c.mat == c.sk)
    dark = {c.pal[k] for k in ('S4', 'G4', 'G3')}
    below = int(min(v['box'][3] for v in plan.values())) if plan else 0
    k = 0
    for y, x in zip(*np.nonzero(ring)):
        if y > below and tuple(c.img[y, x, :3]) in dark:
            c.put(x, y, 'S3')
            k += 1
    # the fringe's cast shadow: the first skin row under the bangs, in clusters of >= 2 px (FC-P16)
    cast = []
    eye_top = min(v.get('body', v['box'])[1] for v in plan.values()) if plan else c.H
    shadow_side = -c.g['side']                      # key light on the side she faces
    mid = np.mean([v['at'][0] for v in plan.values()]) if plan else c.W / 2
    for x in range(c.W):
        col = np.nonzero(face[:, x])[0]
        if not len(col):
            continue
        y = col.min()
        if y == 0 or not c.hair(x, y - 1):
            continue
        rows = 1
        if p.get('fringe_band2', True) and (x - mid) * shadow_side > 1:
            rows = 2
        for k in range(rows):
            if y + k < c.H and face[y + k, x] and y + k < eye_top + 1 - p.get('shadow_clear', 0):
                cast.append((x, y + k))
    cs = set(cast)
    cast = [(x, y) for x, y in cast if any((x + dx, y + dy) in cs for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                                           if dx or dy)]
    for x, y in cast:
        c.put(x, y, p.get('fringe_tone', 'S3'))
    c.log.append(f'skin: {n} px flattened to S2, {k} brown contour px to S3, fringe shadow {len(cast)} px')


def form_skin(c, plan):
    """round F2b (critique F1 2c): three warm skin tones. S2 stays the base; S3 on the shadow-side jaw
    contour (form_jaw rows up from the chin, 1 px) and under the chin (rebuild_jaw); S1 on the lit cheek plane
    (form_lit: a cluster of form_lit_w x form_lit_h px under the lit-side eye, beside its blush)"""
    p, g = c.p, c.g
    if not p.get('form') or not plan:
        return
    face = c.face()
    light = g['side'] * p.get('light', 1)          # screen direction of the key light (+1: the side she faces)
    n1 = n3 = 0
    ye = max(v['box'][3] for v in plan.values())
    chy = int(math.floor(g.get('chin_f2', g['chin'])[1]))
    rows = p.get('form_jaw', 4)
    for y in range(max(ye + 2, chy - rows), chy + 1):
        xs = np.nonzero(face[y])[0]
        if len(xs) < 3:
            continue
        x = xs.min() if light > 0 else xs.max()
        if tuple(c.img[y, x, :3]) == tuple(c.pal['S2']):
            c.put(x, y, 'S3')
            n3 += 1
    lw, lh = p.get('form_lit', (0, 0))
    if lw and lh and 'near' in plan:
        # the lit cheekbone: under the NEAR eye's inner half (ref 08's lightest skin sits there), lw px back from
        # the eye's inner edge, form_lit_dy rows under the eye; the blush keeps the outer half
        v = plan['near']
        inner = v['box'][2] if not (g['side'] < 0) else v['box'][0]
        step = -1 if not (g['side'] < 0) else 1        # from the inner edge toward the outer corner
        xs = [inner + step * k for k in range(p.get('form_lit_in', 0), p.get('form_lit_in', 0) + lw)]
        y0 = v['box'][3] + p.get('form_lit_dy', 1)
        for y in range(y0, y0 + lh):
            for x in xs:
                if 0 <= x < c.W and 0 <= y < c.H and face[y, x] and tuple(c.img[y, x, :3]) == tuple(c.pal['S2']):
                    c.put(x, y, 'S1')
                    n1 += 1
    c.log.append(f'form: {n3} S3 jaw px, {n1} S1 lit px')


# ------------------------------------------------------------------ 6. profile contour

def profile_contour(c):
    """critique 2g: a profile's front contour in skin. Between the nose row - 1 and the chin, the front-most
    non-transparent px of the head on each row: a brown/dark outline px there becomes skin (S2; S3 under the
    nose and under the chin), the lips a 1 px SB notch on the mouth row"""
    p, g = c.p, c.g
    if g['facing'] != 'profile' or not p.get('profile_contour', True):
        return
    front = -1 if g['side'] < 0 else 1             # screen direction of the face's front
    ny, cy = int(math.floor(g['nose'][1])), int(math.floor(g['chin'][1]))
    my = int(math.floor(g['mouth'][1]))
    brown = {c.pal[k] for k in ('G4', 'G3', 'S4', 'OL')}
    cx0 = int(g['chin'][0])
    n = 0
    dark = brown | {c.pal[k] for k in ('I3', 'I4', 'S3')}
    for y in range(ny - p.get('contour_up', 2), cy):
        # the front-most skin px of the head on this row, then the dark px in front of it: the first becomes
        # skin (the contour), any further ones the background (a 1 px skin bump reads as the nose, a stack of
        # outline px as a moustache)
        xs = np.nonzero((c.mat[y] == c.sk) & (c.img[y, :, 3] > 0))[0]
        xs = xs[np.abs(xs - cx0) < 10]
        if not len(xs):
            continue
        xf = (xs.min() if front < 0 else xs.max()) + front
        run = []
        while 0 <= xf < c.W and c.img[y, xf, 3] > 0 and tuple(c.img[y, xf, :3]) in dark and len(run) < 3 \
                and (c.mat[y, xf] not in c.hid or y > ny):     # under the nose no hair sits in front of a profile
            run.append(xf)
            xf += front
        if not run or not (0 <= xf < c.W) or c.img[y, xf, 3] > 0:
            continue            # something else in front (an arm, the hair): keep the edge line
        if tuple(c.img[y, run[0], :3]) not in brown and len(run) == 1:
            continue            # a single I3/S3 px on the edge is the render's own soft contour
        c.put(run[0], y, 'S3' if y == ny + 1 else 'S2', c.sk)
        c.win[y, run[0]] = True
        for x in run[1:]:
            c.img[y, x] = 0
            c.mat[y, x] = 0
        n += len(run)
    # the face window in profile ends short of the front contour on some renders (the head skin mask
    # renders the cheek, the lips and chin come out as neck skin): the skin px within 5 px of the front
    # contour between the nose and the chin join the face, so the skin pass and the mouth reach them
    for y in range(ny - 1, cy):
        xs = np.nonzero((c.mat[y] == c.sk) & (c.img[y, :, 3] > 0))[0]
        xs = xs[np.abs(xs - cx0) < 10]
        if not len(xs):
            continue
        xf = xs.min() if front < 0 else xs.max()
        for k in range(5):
            x = xf - front * k
            if 0 <= x < c.W and c.mat[y, x] == c.sk:
                c.win[y, x] = True
    # the lips notch: the front-most skin px on the mouth row -> SB, one px inside it S2
    xs = np.nonzero((c.mat[my] == c.sk) & (c.img[my, :, 3] > 0))[0]
    xs = xs[np.abs(xs - cx0) < 12]
    if len(xs) and p.get('lip_notch', True):
        xf = xs.min() if front < 0 else xs.max()
        c.g['lip'] = [int(xf), my]          # painted after the skin pass (compose)
    c.log.append(f'profile: {n} contour px to skin, lip notch on row {my}')


# ------------------------------------------------------------------ 7. features

def place(c, gl, at, flip, rec, name, only_skin=False, allow_hair=True, clip=None):
    near_win = A.dilate(c.win, 1, diag=True)
    put = []
    for x, y, ch in V.glyph_pixels(gl, at, flip):
        if not (0 <= x < c.W and 0 <= y < c.H):
            continue
        if clip is not None and not clip[y, x]:
            continue
        onhair = c.mat[y, x] in c.hid
        ok = (c.mat[y, x] == c.sk) or (allow_hair and onhair and near_win[y, x]) or \
             (ch == 'O' and near_win[y, x] and c.img[y, x, 3] > 0)
        if only_skin:
            ok = c.mat[y, x] == c.sk and c.win[y, x]
        if not ok:
            continue
        code = GKEY[ch] if ch != 'B' else ('OL' if onhair else 'I3')
        c.put(x, y, code)
        if ch == 'k' or (onhair and ch not in 'BO'):
            c.mat[y, x] = c.sk
        put.append([int(x), int(y), code])
    rec.setdefault('features', {})[name] = put
    return put


def contour_clip(c, grow=1):
    """where a lash / brow px may go (FC-N31): inside the head skin mask grown by `grow`, and on each row within the
    span of skin VISIBLE in the render (the window's skin) over that row and the 4 under it, grown by `grow`: the
    face's own side contour at that height, so a flick never runs past the cheek onto the side hair"""
    vis = c.st.win & (c.st.mat == c.sk)
    span = np.zeros_like(vis)
    for y in range(c.H):
        xs = np.nonzero(vis[y:min(c.H, y + 5)].any(0))[0]
        if len(xs):
            span[y, max(0, xs.min() - grow):min(c.W, xs.max() + grow + 1)] = True
    return A.dilate(c.st.win, grow, diag=True) & span


def eye_body(gl, at, flip):
    """the eye's body box: from its lash row (the first glyph row with >= 3 OL px) to its bottom, across the
    columns the glyph paints on those rows. The flick above the lash is not part of it (it may lie on hair)"""
    pts = list(V.glyph_pixels(gl, at, flip))
    rows = {}
    for x, y, ch in pts:
        rows.setdefault(y, []).append(ch)
    lash = [y for y in sorted(rows) if sum(1 for ch in rows[y] if ch == 'O') >= 3]
    top = lash[0] if lash else min(rows)
    body = [(x, y) for x, y, ch in pts if y >= top]
    xs, ys = [x for x, y in body], [y for x, y in body]
    return min(xs), top, max(xs), max(ys)


def clear_eyes(c, plan, lib, flip):
    """negative zone: no hair px inside an eye's body (FC-N17: the lash row down to the lid), 'lash_gap'
    skin rows between the fringe and the lash over the lash's own columns (FC-N07, off by default: the
    critique F1 2b/2f asks for no carving), and none between the eyes below the lash top"""
    p = c.p
    n = 0
    gap = p.get('lash_gap', 0)
    for which, v in plan.items():
        x0, y0, x1, y1 = eye_body(lib['eyes'][v['key']], v['at'], flip)
        v['body'] = [x0, y0, x1, y1]
        for y in range(max(0, y0 - gap), min(c.H, y1 + 1)):
            for x in range(max(0, x0), min(c.W, x1 + 1)):
                if c.hair(x, y) and (c.win[y, x] or A.dilate(c.win, 1)[y, x]):
                    c.put(x, y, 'S2', c.sk)
                    c.win[y, x] = True
                    n += 1
    if 'near' in plan and 'far' in plan:
        nb, fb = plan['near']['body'], plan['far']['body']
        xa, xb = (nb[2] + 1, fb[0] - 1) if not flip else (fb[2] + 1, nb[0] - 1)
        # below the HIGHER lash (FC-N17: no hair between the eyes below the lash top; with the eye line rolled
        # 1 px the far lash is a row above the near one)
        for y in range(min(nb[1], fb[1]) + 1, max(nb[3], fb[3]) + 1):
            for x in range(xa, xb + 1):
                if 0 <= x < c.W and 0 <= y < c.H and c.hair(x, y) and c.win[y, x]:
                    c.put(x, y, 'S2', c.sk)
                    n += 1
    c.log.append(f'eyes: {n} hair px cleared from the eye bodies')


def cheek_strands(c, plan):
    """critique 2f: no hair px on a cheek. Below the eye bottom and above the chin, inside the window,
    a hair px with skin on both sides within 3 px on its row (a strand, not the framing lock) becomes skin"""
    if not plan:
        return 0
    yb = max(v['box'][3] for v in plan.values())
    face = c.face()
    n = 0
    for y in range(yb + 1, c.H):
        xs = np.nonzero(face[y])[0]
        if len(xs) < 3:
            continue
        a, b = xs.min(), xs.max()
        for x in range(a + 1, b):
            if c.hair(x, y) and c.win[y, x]:
                c.put(x, y, 'S2', c.sk)
                n += 1
    c.log.append(f'cheeks: {n} hair px inside the cheek span -> skin')
    return n


def brows(c, g, plan, spec, lib, flip, rec):
    """a brow only where the fringe already shows skin (critique 2b): the glyph goes on if at least
    brow_min of its px land on skin in the face window and none would sit on hair; drawn in the dark hair
    tone (I3), never OL"""
    p = c.p
    if not p.get('brows', True):
        return
    for which, v in plan.items():
        key = spec.get(f'brow_{which}')
        if not key or key not in lib['brows']:
            continue
        bg = lib['brows'][key]
        at = (v['at'][0] + (-bg.get('dx', 0) if flip else bg.get('dx', 0)), v['at'][1] + bg.get('dy', 0)
              + p.get('brow_dy', 0))
        pts = [(x, y) for x, y, ch in V.glyph_pixels(bg, at, flip) if 0 <= x < c.W and 0 <= y < c.H]
        on_skin = [(x, y) for x, y in pts if c.mat[y, x] == c.sk and c.win[y, x]]
        on_hair = [(x, y) for x, y in pts if c.mat[y, x] in c.hid]
        if p.get('brow_over'):
            # round F2b (critique F1 2b): the brow drawn as a 1 px stroke in the deepest hair tone over the fringe
            # clumps, inside the head skin mask (the forehead under the bangs), the eye body never touched
            inside = [(x, y) for x, y in pts if c.st.win[y, x] or (c.mat[y, x] == c.sk and c.win[y, x])]
            if len(inside) >= p.get('brow_min', 2):
                bgi = dict(bg, rows=[r.replace('r', p.get('brow_ch', 'R')) for r in bg['rows']])
                put = []
                for x, y, ch in V.glyph_pixels(bgi, at, flip):
                    if 0 <= x < c.W and 0 <= y < c.H and (c.st.win[y, x] or c.win[y, x]) and                             (getattr(c, 'clip', None) is None or c.clip[y, x]):
                        onhair = c.mat[y, x] in c.hid
                        code = GKEY[ch] if onhair else p.get('brow_skin', 'I3')
                        c.put(x, y, code)
                        put.append([int(x), int(y), code])
                rec.setdefault('features', {})[f'brow_{which}'] = put
                c.log.append(f'brow {which}: {len(put)} px over the fringe')
                continue
        if len(on_skin) >= p.get('brow_min', 2) and (len(on_hair) == 0 or p.get('brow_partial', False)):
            place(c, bg, at, flip, rec, f'brow_{which}', only_skin=True)
            c.log.append(f'brow {which}: {len(on_skin)} px in a fringe gap')
        else:
            rec.setdefault('features', {})[f'brow_{which}'] = []
            c.log.append(f'brow {which}: covered by the fringe ({len(on_skin)} px on skin, {len(on_hair)} on hair) '
                         '- the lids carry it')


def compose(still_dir, expr='confident', spec=None, params=None, facing=None, tag='noface', base=None):
    """returns (rgba image, material ids, record, log), the same contract as face_v2.compose"""
    st = V.Still(still_dir, tag)
    if base is not None:
        st.img, st.mat = base[0].copy(), base[1].copy()
    g = V.construct(st)
    facing = facing or g['facing']
    spec = spec or load_spec(facing, expr, st.px)
    if spec is None:
        raise SystemExit(f'no f2 spec for {facing}/{expr}/{st.px}')
    params = dict(spec.get('params', {}), **(params or {}))
    lib = load_lib(st.px)
    img, mat = st.img.copy(), st.mat.copy()
    log = [f"{st.dir}: F2 facing {facing} (yaw {g['yaw']}, side {g['side']}), spec {spec.get('_name')}"]
    g['facing'] = facing
    rec = {'still': str(st.dir), 'spec': spec.get('_name'), 'expr': spec.get('expr'), 'facing': facing,
           'grid': g, 'params': params, 'gaze': spec.get('gaze'), 'composer': 'f2'}
    flip = g['side'] < 0
    c = Ctx(st, g, img, mat, params, log)
    plan = V.plan_eyes(st, g, spec, lib, params, flip)
    V.clean_window(st, g, img, mat, params, log)
    taper_fringe(c, plan, flip)
    rebuild_jaw(c)
    clear_eyes(c, plan, lib, flip)
    cheek_strands(c, plan)
    profile_contour(c)
    shade_skin(c, plan)
    form_skin(c, plan)
    if 'lip' in g:
        c.put(g['lip'][0], g['lip'][1], params.get('lip_code', 'SB'))
        rec.setdefault('features', {})['lip'] = [[g['lip'][0], g['lip'][1], params.get('lip_code', 'SB')]]
    # the construct's window follows the jaw (face_v2_record reads st.win through rec)
    rec['win'] = c.win
    pkey = spec.get('blush')
    for which, v in plan.items():
        bk = f'{pkey}_{which}'
        if pkey and params.get('blush', True) and bk in lib['blush']:
            pg = lib['blush'][bk]
            lift = params.get('smirk_lift', 0) if params.get('smirk_side', 'near') == which else 0
            bat = (v['at'][0] + (-pg.get('dx', 0) if flip else pg.get('dx', 0)), v['box'][3] + pg.get('dy', 0) - lift)
            place(c, pg, bat, flip, rec, f'blush_{which}', only_skin=True)
    # round F2b (critique F1 2a): the lash is clipped at the face contour: no eye px outside the head skin
    # mask (facewin, before hair covers it) grown by lash_clip px (CK: FC-N31)
    clip = None
    if params.get('lash_clip') is not None:
        clip = contour_clip(c, params['lash_clip'])
        c.clip = clip
    for which, v in plan.items():
        gl = lib['eyes'][v['key']]
        place(c, gl, v['at'], flip, rec, f'eye_{which}', clip=clip)
        rec.setdefault('eye_at', {})[which] = v
    brows(c, g, plan, spec, lib, flip, rec)
    nkey = params.get('nose', spec.get('nose'))
    if nkey and nkey in lib['noses']:
        nx, ny = V.ipt(g['nose'])
        place(c, lib['noses'][nkey], (nx + (-1 if flip else 1) * params.get('nose_dx', 0), ny + params.get('nose_dy', 0)),
              flip, rec, 'nose', only_skin=True)
    mkey = params.get('mouth', spec.get('mouth'))
    if mkey:
        if g['facing'] == 'profile' and 'lip' in g and params.get('mouth_on_lip', True):
            mx, my = g['lip']
            mx -= (-1 if flip else 1) * params.get('mouth_in', 1)
        else:
            mx, my = V.ipt(g['mouth'])
        mg = lib['mouths'][mkey]
        place(c, mg, (mx + (-1 if flip else 1) * params.get('mouth_dx', 0), my + params.get('mouth_dy', 0)), flip, rec,
              'mouth', only_skin=True)
    return img, mat, rec, log


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['compose'])
    ap.add_argument('--still', required=True)
    ap.add_argument('--expr', default='confident')
    ap.add_argument('--facing')
    ap.add_argument('--params', default='{}')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    img, mat, rec, log = compose(a.still, a.expr, facing=a.facing, params=json.loads(a.params))
    Image.fromarray(img).save(a.out)
    print('\n'.join(log))


if __name__ == '__main__':
    main()
