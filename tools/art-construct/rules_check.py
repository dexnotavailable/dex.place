"""Run every check in docs/character/art-rules/checklist.json on a constructed sprite and/or face.

  python tools/art-construct/rules_check.py --sprite art/rosace/construct/figure/idle_hero
  python tools/art-construct/rules_check.py --face art/rosace/construct/faces/q34_confident_144.json
  python tools/art-construct/rules_check.py --sprite DIR --json out.json [--only FC,PX] [--fails]

--sprite DIR reads sprite.png, sprite_ids.png, sprite_parts.png, pose.json and face.json (the face
record the figure was built with). --face checks a face stamp on its own. --faces DIR is the folder of
expression faces for the expression-set rules (default art/rosace/construct/faces).

Status per rule:
  PASS / FAIL       an automated check decided (method auto)
  PASS* / FAIL*     a script measured, a person confirms (method semi)
  CRITIC            only a critic can judge (listed so nobody forgets it)
  SKIP              the rule does not apply to this drawing (the reason is printed), or its input is missing
Exit code: 1 when any block-severity rule FAILs, else 0.

Every threshold comes from checklist.json / ART-RULES.md; this file only measures. The measurement
helpers borrow pixel_metrics.py (hug bands) so both tools count banding the same way.
"""
import argparse
import colorsys
import json
import math
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import pixel_metrics as PM  # noqa: E402

CHECKLIST = A.ROOT / 'docs' / 'character' / 'art-rules' / 'checklist.json'
ARTRULES = A.ROOT / 'docs' / 'character' / 'ART-RULES.md'
FACES = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces'
EXPRESSIONS = ('confident', 'focused', 'radiant', 'serene', 'ignited', 'hurt')
CHECKS = {}


def rule(*ids):
    def deco(f):
        for i in ids:
            CHECKS[i] = f
        return f
    return deco


class R:
    """one result"""

    def __init__(self, ok, value='', target='', note=''):
        self.ok, self.value, self.target, self.note = ok, value, target, note


def skip(note):
    return R(None, '', '', note)


# ------------------------------------------------------------------ context

class Ctx:
    def __init__(self, sprite=None, face=None, faces_dir=FACES):
        self.pal = A.Palette()
        pal = self.pal
        self.lum = np.zeros(len(pal.codes) + 1)
        for k, i in pal.index.items():
            self.lum[i] = pal.lum(k)
        self.I = pal.i
        self.sprite_dir = Path(sprite) if sprite else None
        self.pose = None
        self.code = None
        if sprite:
            d = Path(sprite)
            rgba = np.asarray(Image.open(d / 'sprite.png').convert('RGBA'))
            self.rgba = rgba
            self.code = pal.from_rgba(rgba)
            self.ids = A.load_layer(d / 'sprite_ids.png')
            self.parts = A.load_layer(d / 'sprite_parts.png')
            self.pose = json.loads((d / 'pose.json').read_text(encoding='utf-8'))
            self.mask = self.code != 0
            if face is None and (d / 'face.json').exists():
                face = d / 'face.json'
        self.face = None
        if face:
            fp = Path(face)
            self.face = json.loads(fp.read_text(encoding='utf-8'))
            self.fcode = A.grid_to_codes(self.face['rows'], pal)
            stem = fp.with_suffix('')
            pp = Path(str(stem) + '_parts.png')
            if not pp.exists():
                pp = fp.parent / 'face_parts.png'
            self.fparts = A.load_layer(pp) if pp.exists() else np.zeros_like(self.fcode)
            ip = Path(str(stem) + '_ids.png')
            if not ip.exists():
                ip = fp.parent / 'face_ids.png'
            self.fids = A.load_layer(ip) if ip.exists() else np.zeros_like(self.fcode)
            self.flm = self.face['landmarks']
        self.faces_dir = Path(faces_dir)

    # palette helpers
    def c(self, *codes):
        return [self.I(k) for k in codes]

    def isin(self, arr, *codes):
        return np.isin(arr, self.c(*codes))

    def part(self, *names):
        return np.isin(self.parts, [A.PART[n] for n in names])

    def matm(self, *names):
        return np.isin(self.ids, [A.MAT[n] for n in names])

    @property
    def L(self):
        return self.pose['landmarks']

    def face_set(self):
        """expression faces for the same yaw as this face: {expr: record}"""
        out = {}
        yaw = (self.face or {}).get('landmarks', {}).get('yaw', 'q34')
        for e in EXPRESSIONS:
            fp = self.faces_dir / f'{yaw}_{e}_144.json'
            if fp.exists():
                out[e] = json.loads(fp.read_text(encoding='utf-8'))
        return out


def deg(v):
    return math.degrees(math.atan2(v[1], v[0]))


def tilt(p_near, p_far):
    """tilt of the near->far line in degrees, + = the far side higher (y is down)"""
    return math.degrees(math.atan2(-(p_far[1] - p_near[1]), p_far[0] - p_near[0]))


def ang_between(a0, a1, b0, b1):
    va = np.subtract(a1, a0)
    vb = np.subtract(b1, b0)
    d = abs(deg(va) - deg(vb)) % 180
    return min(d, 180 - d)


def interior_angle(a, b, c):
    """angle at b in degrees"""
    v1, v2 = np.subtract(a, b), np.subtract(c, b)
    cs = v1 @ v2 / ((np.linalg.norm(v1) * np.linalg.norm(v2)) or 1)
    return math.degrees(math.acos(max(-1, min(1, cs))))


def rng(v, lo, hi):
    return lo <= v <= hi


def fmt(v, n=1):
    return f'{v:.{n}f}' if isinstance(v, float) else str(v)


# ------------------------------------------------------------------ shared measurements

def arm_gaps(fig, parts):
    """negative space between the arms and the body on the figure mask with the weapon removed.
    A background pixel is 'held' when figure pixels lie within 14 px in at least 3 of the 4 axis
    directions and one of those hits is an arm part and one a body part; components of held pixels
    are the gaps. Returns [(area, min_width, side)], [pixel lists]."""
    H, W = fig.shape
    body = fig & (parts != A.PART['weapon'])
    arm_ids = [A.PART[n] for n in A.ARM_PARTS]
    torso_ids = [A.PART[n] for n in A.TORSO_PARTS + ('hair_back', 'veil', 'head', 'face', 'hair_front')]
    bg = ~body
    reach = 14
    hits = []
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        found = np.zeros((H, W), np.int16)          # part id of the first body pixel met
        cur = np.zeros((H, W), bool)
        for k in range(1, reach + 1):
            sh_body = A.shift(body, -dx * k, -dy * k)
            sh_part = A.shift(parts, -dx * k, -dy * k)
            new = sh_body & (found == 0)
            found[new] = sh_part[new]
        hits.append(found)
    stack = np.stack(hits)
    nhit = (stack > 0).sum(0)
    is_arm = np.isin(stack, arm_ids).any(0)
    is_body = np.isin(stack, torso_ids).any(0)
    held = bg & (nhit >= 3) & is_arm & is_body
    lab, sizes = A.components(held)
    out, pxs = [], []
    for k, n in sizes:
        comp = lab == k
        if n < 6:
            continue
        mw = int(A.dist_inside(comp).max()) * 2 - 1       # narrowest-at-its-widest proxy: 2*inradius-1
        # which arm bounds it
        near = np.isin(stack[:, comp], [A.PART['arm_near'], A.PART['sleeve_near'], A.PART['hand_near']]).any()
        far = np.isin(stack[:, comp], [A.PART['arm_far'], A.PART['sleeve_far'], A.PART['hand_far']]).any()
        side = 'near' if near and not far else 'far' if far and not near else 'both'
        ys, xs = np.nonzero(comp)
        out.append((int(n), mw, side))
        pxs.append(list(zip(xs.tolist(), ys.tolist())))
    return out, pxs


def polymask(poly, shape):
    return A.poly_mask([(x + .5, y + .5) for x, y in poly], shape)


def fit_line(xs, ys):
    """principal axis through points: (centre, unit direction)"""
    P = np.stack([xs, ys], 1).astype(float)
    c = P.mean(0)
    u, s, vt = np.linalg.svd(P - c)
    return c, vt[0]


def eye_pixels(ctx, side):
    """code array cut to the eye box (+1 column for the flick excluded), and the box"""
    e = ctx.flm['eyes'].get(side)
    if not e:
        return None, None
    x0, y0, x1, y1 = e['box']
    return ctx.fcode[y0:y1 + 1, x0:x1 + 1], e['box']


def face_rows(ctx):
    """rows above the chin of the measured landmarks on the face stamp"""
    lm, code = ctx.flm, ctx.fcode
    chin_y = lm['chin_y']
    r = lambda y: chin_y - y  # noqa: E731
    out = {}
    cx = lm['centre_line_x_at_eye_row']
    # mouth: the placed mouth pixels, confirmed on the stamp (the lip line, not the soft S3 corner)
    mrows = [r(y) for x, y, k in lm.get('mouth', {}).get('px', []) if code[y, x] in ctx.c('S4', 'SB', 'W1')]
    out['mouth'] = [Counter(mrows).most_common(1)[0][0]] if mrows else []     # the lip line's main row
    nb = code[chin_y - 9:chin_y - 4, cx - 2:cx + 4]
    ys = np.nonzero(nb == ctx.I('S3'))[0]
    out['nose'] = sorted({9 - y for y in ys})
    iris = []
    lash = []
    out['lash_top_side'] = {}
    for side in ('near', 'far'):
        sub, box = eye_pixels(ctx, side)
        if sub is None:
            continue
        ys, xs = np.nonzero(np.isin(sub, ctx.c('A2', 'A3', 'A4', 'A5')))
        iris += [r(box[1] + y) for y in ys]
        ys, xs = np.nonzero(sub == ctx.I('OL'))
        lash += [r(box[1] + y) for y in ys]
        if len(ys):
            out['lash_top_side'][side] = r(box[1] + ys.min())
    grid = lm['rows_above_chin']
    er = ctx.face['params'].get('eye_row', 0)
    if lm['expression'] in ('confident', 'radiant_open') and iris and lash:
        out['eye_bottom'] = min(iris)
        out['lash_top'] = max(lash)
        out['grid_from'] = 'pixels'
    else:
        out['eye_bottom'] = grid['eye_bottom'] + er
        out['lash_top'] = grid['lash_top'] + er
        out['grid_from'] = 'construction grid (the expression moves the lids)'
        out['lash_top_side'] = {s: chin_y - e['box'][1] for s, e in lm['eyes'].items()}
    out['grid_eye_bottom'] = grid['eye_bottom'] + er
    brows = [p for s in ctx.flm.get('brows', {}).values() for p in s]
    out['brow'] = sorted({r(y) for x, y in brows})
    # brow height per side, over that eye's own lash top (the eye line may be tilted)
    out['brow_over_lash'] = {s: min(r(y) for x, y in v) - out['lash_top_side'].get(s, 0)
                             for s, v in ctx.flm.get('brows', {}).items() if v}
    hair = np.nonzero(np.isin(ctx.fcode, ctx.c('I0', 'I1', 'I2', 'I3', 'I4')).any(1))[0]
    out['hair_top'] = r(int(hair.min())) if len(hair) else None
    return out


# ------------------------------------------------------------------ WF: workflow

@rule('WF-P01')
def _(c):
    miss = []
    if c.pose:
        L = c.L
        for k in ('loa', 'shoulder_near', 'shoulder_far', 'hip_near', 'hip_far', 'head_axis', 'pit_neck'):
            if k not in L:
                miss.append(k)
        if len(L.get('loa', [])) != 3:
            miss.append('loa(3)')
        for k in ('weight_foot', 'grips'):
            if not c.pose.get(k):
                miss.append(k)
        off = int((c.code < 0).sum())
        if off:
            miss.append(f'{off} off-palette px (guide pixels?)')
    if c.face:
        for k in ('rows_above_chin', 'eyes', 'chin_y'):
            if k not in c.flm:
                miss.append('face.' + k)
    if not c.pose and not c.face:
        return skip('no pose.json or face.json')
    return R(not miss, 'missing: ' + ', '.join(miss) if miss else 'all fields; palette-only pixels', 'schema complete')


@rule('WF-P02')
def _(c):
    if not (c.pose and c.face):
        return skip('needs sprite + face.json')
    ox, oy = c.face.get('origin_on_sprite', c.pose['face']['origin'])
    fc, fp = c.fcode, c.fparts
    keep = (fp > 0) & (fp != A.PART['neck'])
    ys, xs = np.nonzero(keep & np.isin(fp, [A.PART['face'], A.PART['eye']]))
    ty, tx = ys + oy, xs + ox
    ok = (ty >= 0) & (ty < c.code.shape[0]) & (tx >= 0) & (tx < c.code.shape[1])
    same = (c.code[ty[ok], tx[ok]] == fc[ys[ok], xs[ok]]).mean() if ok.any() else 0
    edge = A.ring_in(np.isin(fp, [A.PART['face']]))[ys[ok], xs[ok]].mean() if ok.any() else 0
    return R(same >= 0.9, f'{same:.0%} of face/eye px are stamp pixels (outline pass recolours the contour ring, {edge:.0%})',
             'face from the stamp; FG checks on the wireframe', 'critic confirms the pose attitude came from the wireframe')


@rule('WF-P03')
def _(c):
    if not c.sprite_dir:
        return skip('pose rule')
    th = sorted((c.sprite_dir / 'thumbs').glob('*.json'))
    kept = [t for t in th if json.loads(t.read_text(encoding='utf-8')).get('kept')]
    return R(len(th) >= 4 and len(kept) >= 2, f'{len(th)} thumbnails, {len(kept)} kept', '>= 4 scored, 2 kept')


@rule('WF-P04')
def _(c):
    vdir = c.faces_dir / 'variants'
    if not vdir.exists():
        return R(False, 'no variants folder', '>= 3 per expression')
    groups = {}
    for f in vdir.glob('*.json'):
        d = json.loads(f.read_text(encoding='utf-8'))
        groups.setdefault(d['params'].get('variant_of') or f.stem, []).append(d)
    bad, n = [], 0
    for base, vs in groups.items():
        n += 1
        axes = [v['params'].get('variant_axis') for v in vs]
        if len(vs) < 3 or not all(axes):
            bad.append(f'{base}: {len(vs)} variants, axes {axes}')
    return R(n > 0 and not bad, f'{n} variant groups' + ('; ' + '; '.join(bad) if bad else ''), '>= 3 each, one axis each')


@rule('WF-P05')
def _(c):
    if not c.pose:
        return skip('needs pose.json zones')
    z = c.pose.get('zones', {})
    fails = []
    shape = c.code.shape
    for k in z.get('keep_out', []):
        m = polymask(k['poly'], shape)
        kind = k['kind']
        bad = m & (c.part('weapon') if kind == 'weapon' else c.matm('hair') if kind == 'hair' else c.mask)
        if bad.sum():
            fails.append(f"keep-out '{k['name']}': {int(bad.sum())} px")
    for k in z.get('must_be', []):
        ok, _ = must_be(c, k)
        if not ok:
            fails.append(f"must-be '{k['name']}' missing")
    n = len(z.get('keep_out', [])) + len(z.get('must_be', []))
    return R(not fails, '; '.join(fails) if fails else f'{n} zones satisfied', 'keep-out empty, must-be present')


def must_be(c, k):
    shape = c.code.shape
    m = polymask(k['poly'], shape)
    e = k['expect']
    if e == 'gold_cross':
        g = m & c.isin(c.code, 'G0', 'G1', 'G2', 'G3')
        return g.sum() >= 9, int(g.sum())
    if e == 'hand_near':
        h = m & c.part('hand_near')
        return h.sum() >= 4, int(h.sum())
    if e == 'dark':
        sel = m & c.mask
        L = c.lum[np.clip(c.code[sel], 0, None)]
        return (len(L) > 0 and L.mean() < 0.10), round(float(L.mean()), 3) if len(L) else None
    return False, None


for _rid in ('WF-P06', 'WF-P08', 'FG-P20', 'FG-N09', 'GR-N06', 'CL-P01', 'HR-P01', 'PX-N09'):
    CHECKS[_rid] = None                               # critic-only: printed as CRITIC with the checklist text


@rule('WF-P07')
def _(c):
    name = c.pose['name'] if c.pose else (c.face or {}).get('name')
    if not name:
        return skip('no name')
    rv = A.ROOT / 'review' / 'rosace' / 'construct'
    have = sorted(p.name for p in rv.rglob(f'*{name}*.png'))
    ab = sorted(p.name for p in (rv / 'ab').glob('*.png')) if (rv / 'ab').exists() else []
    ok = bool(have) and (bool(ab) or not c.pose)
    return R(ok, f'{len(have)} construct sheet(s), {len(ab)} A/B sheet(s)', 'sheets with 1x/3x/6x, refs, grey, blur',
             'critic verdict recorded in the learning log')


@rule('WF-P09')
def _(c):
    md = ARTRULES.read_text(encoding='utf-8')
    sec = md.split('## 10. Learning log', 1)[-1].split('\n## ', 1)[0]
    rows = [l for l in sec.splitlines() if l.startswith('|') and not l.startswith('|---') and 'What was tried' not in l]
    return R(len(rows) >= 1, f'{len(rows)} learning-log rows', '>= 1 per round')


# ------------------------------------------------------------------ FG: figure and pose

def need_pose(f):
    def g(c):
        return skip('pose rule; no pose.json') if not c.pose else f(c)
    return g


@rule('FG-P01')
@need_pose
def _(c):
    L = c.L
    h = L['chin'][1] - L['skull_top'][1]
    v = c.pose['H'] / h
    return R(rng(v, 5.5, 6.5), f'{v:.2f} heads (h = {h:.0f} px)', '5.5-6.5')


@rule('FG-P02')
@need_pose
def _(c):
    v = c.pose['sole_y'] - c.L['crotch'][1]
    return R(rng(v, 70, 74), f'{v:.0f} px', '70-74')


@rule('FG-P03')
@need_pose
def _(c):
    wf = c.pose['weight_foot']
    v = c.pose['sole_y'] - c.L[f'knee_{wf}'][1]
    return R(rng(v, 37, 41), f'{v:.1f} px (weight knee)', '38-40 (+-1)')


@rule('FG-P04')
@need_pose
def _(c):
    return skip('no hanging arm in this pose (both hands placed)')


def mask_width(c, y, exclude=('weapon',)):
    row = c.mask[int(round(y))] & ~c.part(*exclude)[int(round(y))]
    xs = np.nonzero(row)[0]
    return int(xs.max() - xs.min() + 1) if len(xs) else 0


@rule('FG-P05')
@need_pose
def _(c):
    L = c.L
    ex = ('weapon',) + A.ARM_PARTS + ('hair_back', 'veil', 'hair_front')
    ws = {}
    for k, y in (('shoulders', (L['shoulder_near'][1] + L['shoulder_far'][1]) / 2 + 2), ('waist', L['waist_c'][1]),
                 ('hips', L['pelvis_c'][1])):
        ws[k] = mask_width(c, y, ex)
    ok = rng(ws['shoulders'], 25, 29) and rng(ws['waist'], 13, 17) and rng(ws['hips'], 22, 26) and \
        ws['waist'] < ws['hips'] < ws['shoulders']
    return R(ok, f"{ws['shoulders']} / {ws['waist']} / {ws['hips']}", '27 / 15 / 24 (+-2); waist < hips < shoulders')


@rule('FG-P06')
@need_pose
def _(c):
    L = c.L
    y = int(round((L['chin'][1] + L['pit_neck'][1]) / 2))
    xs = np.nonzero(c.part('neck', 'collar', 'cross')[y])[0]
    v = int(xs.max() - xs.min() + 1) if len(xs) else 0
    return R(rng(v, 8, 10), f'{v} px at y{y}', '8-10')


def loa_metrics(c):
    pts = np.array(c.L['loa_curve'], float)
    a, b = pts[0], pts[-1]
    ab = b - a
    n = np.array([-ab[1], ab[0]]) / (np.linalg.norm(ab) or 1)
    d = (pts - a) @ n
    sag = float(np.abs(d).max())
    # curvature sign changes (inflections)
    v1 = np.diff(pts, axis=0)
    cr = v1[:-1, 0] * v1[1:, 1] - v1[:-1, 1] * v1[1:, 0]
    s = np.sign(cr[np.abs(cr) > 1e-6])
    infl = int((np.diff(s) != 0).sum()) if len(s) else 0
    return sag, infl


@rule('FG-P07')
@need_pose
def _(c):
    sag, infl = loa_metrics(c)
    strike = c.pose['intent'] in ('strike', 'attack', 'thrust')
    lo, hi = (15, 30) if strike else (6, 12)
    return R(rng(sag, lo, hi) and infl <= 1, f'sagitta {sag:.1f} px, {infl} inflection(s)', f'{lo}-{hi} px, <= 1 inflection')


def sh_tilt(c):
    return tilt(c.L['shoulder_near'], c.L['shoulder_far'])


def hip_tilt(c):
    return tilt(c.L['hip_near'], c.L['hip_far'])


@rule('FG-P08')
@need_pose
def _(c):
    t = sh_tilt(c)
    drop = abs(c.L['shoulder_near'][1] - c.L['shoulder_far'][1])
    return R(rng(abs(t), 4, 10), f'{t:+.1f} deg ({drop:.1f} px drop)', '4-10 deg')


@rule('FG-P09')
@need_pose
def _(c):
    t, s = hip_tilt(c), sh_tilt(c)
    return R(rng(abs(t), 4, 10) and np.sign(t) == -np.sign(s), f'{t:+.1f} deg vs shoulders {s:+.1f}', '4-10, opposite sign')


def leg_metrics(c):
    L, wf = c.L, c.pose['weight_foot']
    ff = 'near' if wf == 'far' else 'far'
    hip, heel = L[f'hip_{wf}'], L[f'heel_{wf}']
    wang = abs(math.degrees(math.atan2(heel[0] - hip[0], heel[1] - hip[1])))
    bend = {s: 180 - interior_angle(L[f'hip_{s}'], L[f'knee_{s}'], L[f'ankle_{s}']) for s in ('near', 'far')}
    drop = L[f'knee_{ff}'][1] - L[f'knee_{wf}'][1]
    return wang, bend, drop, wf, ff


@rule('FG-P10')
@need_pose
def _(c):
    wang, bend, drop, wf, ff = leg_metrics(c)
    ok = wang <= 5 and rng(bend[ff], 10, 30) and rng(drop, 1, 3)
    return R(ok, f'weight leg {wang:.1f} deg; free knee bend {bend[ff]:.0f} deg; free knee {drop:+.1f} px lower',
             'weight <= 5; free bend 10-30; drop 1-3')


def plumb(c):
    wf = c.pose['weight_foot']
    x = c.L['pit_neck'][0]
    x0, x1 = c.pose['feet'][wf]
    return x, x0, x1


@rule('FG-P11', 'FG-N05')
@need_pose
def _(c):
    if c.pose['intent'] in ('fall', 'leap', 'push'):
        return skip('intent ' + c.pose['intent'])
    x, x0, x1 = plumb(c)
    return R(x0 - 2 <= x <= x1 + 2, f'pit of neck x{x:.1f}; weight foot x{x0}-{x1}', 'inside the footprint +-2')


def head_tilt(c):
    return ang_between(*c.L['head_axis'], *c.L['neck_axis'])


@rule('FG-P12')
@need_pose
def _(c):
    t = head_tilt(c)
    return R(rng(t, 5, 15), f'{t:.1f} deg between head and neck axes', '5-15')


@rule('FG-P13')
@need_pose
def _(c):
    gaps, _ = arm_gaps(c.mask, c.parts)
    good = [g for g in gaps if g[0] >= 30 and g[1] >= 3]
    need = 1 if c.pose['intent'] == 'idle' else 2
    return R(len(good) >= need, f'{len(good)} gap(s) ok of {len(gaps)}: ' + ', '.join(f'{a}px2 w{w} {s}' for a, w, s in gaps),
             f'>= {need}, each >= 30 px2 and >= 3 px wide')


@rule('FG-P14')
@need_pose
def _(c):
    m = c.mask & ~c.part('weapon')
    xs_by_row = [np.nonzero(r)[0] for r in m]
    w = max((x.max() - x.min() + 1) for x in xs_by_row if len(x))
    v = w / c.pose['H']
    return R(v >= 0.40, f'{w} px = {v:.2f} H', '>= 0.40 H (58 px)')


@rule('FG-P15')
@need_pose
def _(c):
    L = c.L
    d = abs(L['heel_near'][0] - L['heel_far'][0])
    _, bend, _, wf, ff = leg_metrics(c)
    ok = rng(d, 40, 56) or (rng(d, 20, 30) and bend[ff] >= 10)
    return R(ok, f'{d:.1f} px apart; free knee bend {bend[ff]:.0f} deg', '40-56, or 20-30 with a bent free knee')


def elbow_angles(c):
    L = c.L
    return {s: interior_angle(L[f'shoulder_{s}'], L[f'elbow_{s}'], L[f'wrist_{s}']) for s in ('near', 'far')}


@rule('FG-P16')
@need_pose
def _(c):
    e = elbow_angles(c)
    dh = abs(c.L['hand_near'][1] - c.L['hand_far'][1])
    de = abs(e['near'] - e['far'])
    return R(de >= 30 and dh >= 8, f'elbows {e["near"]:.0f} / {e["far"]:.0f} deg (diff {de:.0f}); hands {dh:.0f} px apart in height',
             '>= 30 deg and >= 8 px')


@rule('FG-P17')
@need_pose
def _(c):
    return skip('no rib-cage / pelvis yaw difference in the spec (no twist)')


@rule('FG-P18')
@need_pose
def _(c):
    if c.pose['intent'] not in ('strike', 'attack', 'thrust'):
        return skip('not a strike')
    L = c.L
    lean = math.degrees(math.atan2(L['pit_neck'][0] - L['pelvis_c'][0], L['pelvis_c'][1] - L['pit_neck'][1]))
    return R(abs(lean) >= 10, f'spine lean {lean:+.1f}', '>= 10 toward the thrust')


@rule('FG-P19')
@need_pose
def _(c):
    fr = sorted((c.sprite_dir / 'frames').glob('*.json')) if c.sprite_dir else []
    return skip('single still; no idle frames yet') if not fr else R(False, 'frames present: checker not written', '')


@rule('FG-N01')
@need_pose
def _(c):
    s, h = sh_tilt(c), hip_tilt(c)
    return R(not (abs(s) < 2 and abs(h) < 2), f'shoulders {s:+.1f}, hips {h:+.1f}', 'not both under 2 deg')


@rule('FG-N02')
@need_pose
def _(c):
    _, bend, _, _, _ = leg_metrics(c)
    ok = not (bend['near'] < 5 and bend['far'] < 5) if c.pose['intent'] == 'idle' else True
    return R(ok, f'knee bends near {bend["near"]:.0f} / far {bend["far"]:.0f}', 'not both < 5 in an idle')


@rule('FG-N03')
@need_pose
def _(c):
    L = c.L
    cl = np.array(L['torso_centerline'], float)
    c0, c1 = cl[0], cl[-1]
    u = (c1 - c0) / np.linalg.norm(c1 - c0)

    def mirror(p):
        v = np.subtract(p, c0)
        along = (v @ u) * u
        return c0 + 2 * along - v

    res = {}
    for group, keys in (('arms', ('elbow', 'wrist', 'hand')), ('legs', ('knee', 'ankle', 'heel'))):
        d = [np.linalg.norm(mirror(L[f'{k}_far']) - np.array(L[f'{k}_near'])) for k in keys]
        res[group] = float(np.mean(d))
    return R(min(res.values()) >= 3, f"mirror distance arms {res['arms']:.1f}, legs {res['legs']:.1f} px", '>= 3 px (no twins)')


@rule('FG-N04')
@need_pose
def _(c):
    gaps, _ = arm_gaps(c.mask, c.parts)
    sides = {s for a, w, s in gaps if a >= 30 and w >= 3}
    miss = [s for s in ('near', 'far') if s not in sides and 'both' not in sides]
    return R(not miss, 'arms without a gap: ' + (', '.join(miss) if miss else 'none'), 'every arm has a gap in a key pose')


@rule('FG-N06')
@need_pose
def _(c):
    """background slivers of 1-2 px between two different parts, running > 4 px"""
    bg = ~c.mask
    H, W = bg.shape
    hits = np.zeros((H, W), bool)
    for w in (1, 2):
        for dx, dy in ((1, 0), (0, 1)):
            a = A.shift(c.parts, dx, dy)                      # part on one side
            b = A.shift(c.parts, -dx * w, -dy * w)            # part on the far side of a w-px sliver
            run = bg.copy()
            for k in range(1, w):
                run &= A.shift(bg, -dx * k, -dy * k)
            sliv = run & (a > 0) & (b > 0) & (a != b)
            hits |= sliv
    lab, sizes = A.components(A.dilate(hits, 1) & bg)
    long_ = [n for k, n in sizes if n > 4 * 2]
    return R(len(long_) == 0, f'{len(long_)} sliver run(s) > 4 px' + (f' ({sorted(long_)[-3:]} px)' if long_ else ''),
             '0 (separate by >= 4 px or overlap by >= 3)')


@rule('FG-N07')
@need_pose
def _(c):
    t = head_tilt(c)
    yaw = c.face['landmarks'].get('yaw_deg', 0) if c.face else 0
    return R(not (t < 3 and yaw < 10), f'tilt {t:.1f} deg, yaw {yaw:.0f} deg', 'not upright and square-on')


@rule('FG-N08')
@need_pose
def _(c):
    d = abs(c.L['heel_near'][0] - c.L['heel_far'][0])
    if d <= 56:
        return skip(f'feet {d:.0f} px apart (no lunge)')
    L = c.L
    lean = abs(math.degrees(math.atan2(L['pit_neck'][0] - L['pelvis_c'][0], L['pelvis_c'][1] - L['pit_neck'][1])))
    return R(lean > 5, f'spine {lean:.1f} deg', '> 5 in a lunge')


# ------------------------------------------------------------------ HD: hands

def hand_mask(c, side):
    return c.part(f'hand_{side}') & c.mask


@rule('HD-P01')
@need_pose
def _(c):
    miss = [f'{s}.{k}' for s, h in c.pose['hands'].items() for k in ('palm_box', 'mitten', 'thumb_wedge', 'wrist_step')
            if not h.get(k)]
    return R(not miss, 'missing ' + ', '.join(miss) if miss else 'palm box, mitten, thumb wedge, wrist step on both',
             'all four per hand', 'critic confirms the read at 6x')


def fist(c):
    h = c.pose['hands']
    for s, d in h.items():
        if d['kind'] == 'fist':
            return s, d
    return None, None


@rule('HD-P02', 'HD-N01')
@need_pose
def _(c):
    s, d = fist(c)
    if not s:
        return skip('no fist')
    m = hand_mask(c, s)
    ys, xs = np.nonzero(m)
    # measure along / across the haft
    u = np.subtract(c.pose['haft']['tip'], c.pose['haft']['butt'])
    u = u / np.linalg.norm(u)
    n = np.array([-u[1], u[0]])
    P = np.stack([xs, ys], 1)
    along = P @ u
    across = P @ n
    lw = along.max() - along.min() + 1
    aw = across.max() - across.min() + 1
    wedge = int((m & (c.code == c.I('S1'))).sum())
    rect = m.sum() / ((ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1))
    kn = m & (c.code == c.I('S3'))
    return R(rng(round(aw), 7, 9) and rng(round(lw), 6, 8) and rng(wedge, 2, 3) and rect <= 0.9 and kn.any(),
             f'{aw:.0f} across x {lw:.0f} along the haft; wedge {wedge} px; fill of its box {rect:.2f}; knuckle line {int(kn.sum())} px',
             '7-9 x 6-8; wedge 2-3; not a rectangle (<= 0.9); knuckle line')


@rule('HD-P03')
@need_pose
def _(c):
    op = [s for s, d in c.pose['hands'].items() if d['kind'].startswith('open') and d.get('on') not in ('hip', 'collar')]
    return skip('no free open hand (the open hand is at the collar: HD-P04)') if not op else R(False, 'not measured', '')


@rule('HD-P04')
@need_pose
def _(c):
    op = [s for s, d in c.pose['hands'].items() if d.get('on') in ('hip', 'collar')]
    if not op:
        return skip('no hand on the hip or collar')
    s = op[0]
    L = c.L
    m = hand_mask(c, s)
    ys, xs = np.nonzero(m)
    ax = np.subtract(L[f'hand_{s}'], L[f'wrist_{s}'])
    ax = ax / np.linalg.norm(ax)
    ln = (np.stack([xs, ys], 1) @ ax)
    length = ln.max() - ln.min() + 1
    fa = np.subtract(L[f'wrist_{s}'], L[f'elbow_{s}'])
    a = abs(math.degrees(math.atan2(ax[1], ax[0]) - math.atan2(fa[1], fa[0])))
    a = min(a % 360, 360 - a % 360)
    return R(rng(round(length), 8, 10) and a <= 30, f'{length:.0f} px long; wrist {a:.0f} deg off the forearm', '8-10; <= 30')


@rule('HD-P05')
@need_pose
def _(c):
    out, ok = [], True
    for s in ('near', 'far'):
        m = hand_mask(c, s)
        codes = set(c.code[m].tolist()) - {c.I('OL'), c.I('S4')}      # S4 is the hand's contact line
        skin = [k for k in codes if c.pal.code_of(k) in ('S1', 'S2', 'S3', 'S4')]
        ys, xs = np.nonzero(m & c.isin(c.code, 'S3', 'S4'))
        yl, xl = np.nonzero(m & c.isin(c.code, 'S1', 'S2'))
        side = None
        if len(xs) and len(xl):
            v = np.array([xs.mean() - xl.mean(), ys.mean() - yl.mean()])
            side = float(v @ np.array(c.pose['light']))
        ok &= len(skin) <= 3 and (side is None or side < 0)
        out.append(f'{s}: {len(skin)} skin tones, shadow {"away from" if side is not None and side < 0 else "toward"} the light')
    return R(ok, '; '.join(out), '<= 3 tones + line; shadow away from the key light')


@rule('HD-P06', 'HD-N05')
@need_pose
def _(c):
    L = c.L
    out, ok = [], True
    for s in ('near', 'far'):
        fa = np.subtract(L[f'wrist_{s}'], L[f'elbow_{s}'])
        ha = np.subtract(L[f'hand_{s}'], L[f'wrist_{s}'])
        a = abs((deg(ha) - deg(fa) + 180) % 360 - 180)
        ok &= a <= 54
        out.append(f'{s} {a:.0f} deg')
    return R(ok, ', '.join(out), '<= 40 radial/ulnar, <= 54-60 flexion/extension (2D: <= 54)')


@rule('HD-N02')
@need_pose
def _(c):
    # our open hand is a mitten with at most one separated finger: count background notches at the tip
    s = 'far'
    m = hand_mask(c, s)
    if not m.any():
        return skip('no open hand')
    notches = int((A.ring_out(m) & ~c.mask & A.shift(m, 0, 1) & A.shift(m, 0, -1)).sum())
    return R(notches < 3, f'{notches} notch(es) between fingers', 'not 4 equal bumps')


def pillow(m, code, shadow_codes):
    """share of the 1 px inner ring in shadow tones, per side (top, bottom, left, right)"""
    ring = A.ring_in(m)
    H, W = m.shape
    sides = {'top': ring & ~A.shift(m, 0, 1), 'bottom': ring & ~A.shift(m, 0, -1),
             'left': ring & ~A.shift(m, 1, 0), 'right': ring & ~A.shift(m, -1, 0)}
    # the pixel just inside the outline (the outline itself is OL): step one in
    inner = {k: A.shift(v, *d) & m for (k, v), d in zip(sides.items(), ((0, 1), (0, -1), (1, 0), (-1, 0)))}
    out = {}
    for k, v in inner.items():
        n = v.sum()
        out[k] = float(np.isin(code[v], shadow_codes).mean()) if n else 0.0
    return out


@rule('HD-N03')
@need_pose
def _(c):
    bad = []
    for s in ('near', 'far'):
        m = hand_mask(c, s)
        sh = pillow(m, c.code, c.c('S3', 'S4'))
        if sum(v >= 0.7 for v in sh.values()) >= 3:
            bad.append(s)
    return R(not bad, 'pillow-shaded: ' + (', '.join(bad) or 'none'), 'no shadow ring on 3+ sides')


def strips(m, code, tones):
    """1 px wide strips inside m (both horizontal or both vertical neighbours outside m) holding >= 2 tones"""
    thin = m & ((~A.shift(m, 1, 0) & ~A.shift(m, -1, 0)) | (~A.shift(m, 0, 1) & ~A.shift(m, 0, -1)))
    lab, sizes = A.components(thin, conn=8)
    n = 0
    for k, sz in sizes:
        cs = set(code[lab == k].tolist()) & set(tones)
        if sz >= 2 and len(cs) >= 2:
            n += 1
    return n


@rule('HD-N04')
@need_pose
def _(c):
    n = sum(strips(hand_mask(c, s) & ~(c.code == c.I('OL')), c.code, c.c('S1', 'S2', 'S3', 'S4')) for s in ('near', 'far'))
    return R(n == 0, f'{n} shaded 1 px strip(s)', '0')


# ------------------------------------------------------------------ GR: grip and weapon

def grips(c):
    return c.pose.get('grips', [])


@rule('GR-P01', 'GR-P02', 'GR-P03', 'GR-P04', 'GR-P07')
@need_pose
def _(c):
    g = grips(c)
    if len(g) < 2:
        return skip(f'{len(g)} hand on the haft (rest carry); two-hand grip rules apply to attack frames')
    return R(False, 'two-hand grip measurement not written yet', '')


def haft_line_fit(c):
    haft = c.part('weapon') & c.matm('haft')
    ys, xs = np.nonzero(haft)
    return haft, xs, ys


@rule('GR-P05', 'GR-N01')
@need_pose
def _(c):
    haft, xs, ys = haft_line_fit(c)
    if not len(xs):
        return R(False, 'no haft pixels', '')
    gp = np.array(grips(c)[0]['point'])
    u = np.subtract(c.pose['haft']['tip'], c.pose['haft']['butt'])
    u = u / np.linalg.norm(u)
    t = (np.stack([xs, ys], 1) - gp) @ u
    lo, hi = t < -6, t > 6
    if lo.sum() < 5 or hi.sum() < 5:
        return R(False, 'haft does not emerge on both sides of the fist', 'collinear through the fist')
    c1, d1 = fit_line(xs[lo], ys[lo])
    c2, d2 = fit_line(xs[hi], ys[hi])
    da = min(abs(deg(d1) - deg(d2)) % 180, 180 - abs(deg(d1) - deg(d2)) % 180)
    cA, dA = fit_line(xs, ys)
    n = np.array([-dA[1], dA[0]])
    hm = hand_mask(c, 'near')
    hy, hx = np.nonzero(hm)
    hc = np.array([hx.mean(), hy.mean()])
    dist = abs((hc - cA) @ n)
    inside = int((hm & haft).sum())
    return R(dist <= 1.5 and da <= 2 and inside == 0,
             f'fist centre {dist:.1f} px off the haft line; segments differ {da:.1f} deg; {inside} haft px inside the fist',
             '<= 1 px (+-.5 rounding); <= 2 deg; 0')


@rule('GR-P06')
@need_pose
def _(c):
    haft, xs, ys = haft_line_fit(c)
    cA, dA = fit_line(xs, ys)
    n = np.array([-dA[1], dA[0]])
    hm = hand_mask(c, 'near')
    hy, hx = np.nonzero(hm)
    off = (np.stack([hx, hy], 1) - cA) @ n
    a, b = -off.min() - 1.5, off.max() - 1.5
    wedge = hm & (c.code == c.I('S1'))
    return R(off.max() - off.min() + 1 >= 7 and min(a, b) >= 2 and wedge.any(),
             f'{off.max() - off.min() + 1:.0f} px across; {a:.1f} / {b:.1f} px beyond the haft band; wedge {int(wedge.sum())} px',
             '>= 7; >= 2 each side; wedge present')


@rule('GR-P08')
@need_pose
def _(c):
    return skip(f"carry '{c.pose['carry']}' (butt planted): no carry-weight range defined for a planted rest")


def haft_angle(c):
    b, t = c.pose['haft']['butt'], c.pose['haft']['tip']
    return math.degrees(math.atan2(abs(t[0] - b[0]), abs(b[1] - t[1])))


@rule('GR-P09')
@need_pose
def _(c):
    a = haft_angle(c)
    b, t = c.pose['haft']['butt'], c.pose['haft']['tip']
    cl = np.mean([p[0] for p in c.L['torso_centerline']])
    away = abs(t[0] - cl) > abs(b[0] - cl)
    lo, hi = (15, 35) if c.pose['carry'] == 'rest' else (40, 60)
    return R(rng(a, lo, hi) and away, f'{a:.1f} deg from vertical, {"leaning away" if away else "leaning in"}', f'{lo}-{hi}, leaning away')


@rule('GR-P10')
@need_pose
def _(c):
    haft, xs, ys = haft_line_fit(c)
    body = c.mask & ~c.part('weapon', 'hand_near', 'arm_near', 'sleeve_near')
    g = np.array(grips(c)[0]['point'])
    far = np.hypot(xs - g[0], ys - g[1]) > 6
    by, bx = np.nonzero(body)
    if not far.any() or not len(bx):
        return skip('nothing to measure')
    P = np.stack([xs[far], ys[far]], 1)
    B = np.stack([bx, by], 1)
    d = np.sqrt(((P[:, None, :] - B[None, :, :]) ** 2).sum(-1)).min(1)
    overlap = int((haft & body).sum())
    mn = float(d.min())
    gap_px = mn - 1
    ok = (4 <= gap_px <= 8) or overlap >= 3 or gap_px > 8
    return R(ok and not (0 < gap_px < 4), f'closest clear gap {gap_px:.1f} px; overlap {overlap} px',
             '4-8 px clear (wider is fine), or >= 3 px overlap; never a 1-3 px gap')


@rule('GR-N02')
@need_pose
def _(c):
    L = c.L
    b, t = c.pose['haft']['butt'], c.pose['haft']['tip']
    segs = {'spine': (L['pelvis_c'], L['pit_neck'])}
    for s in ('near', 'far'):
        segs[f'thigh_{s}'] = (L[f'hip_{s}'], L[f'knee_{s}'])
        segs[f'shin_{s}'] = (L[f'knee_{s}'], L[f'ankle_{s}'])
        segs[f'upper_arm_{s}'] = (L[f'shoulder_{s}'], L[f'elbow_{s}'])
        segs[f'forearm_{s}'] = (L[f'elbow_{s}'], L[f'wrist_{s}'])
    near = {k: ang_between(b, t, *v) for k, v in segs.items()}
    bad = {k: v for k, v in near.items() if v < 10}
    return R(not bad, 'closest: ' + ', '.join(f'{k} {v:.0f}' for k, v in sorted(near.items(), key=lambda kv: kv[1])[:3]),
             '>= 10 deg from every body line (or a clear overlap)')


@rule('GR-N03')
@need_pose
def _(c):
    z = [k for k in c.pose['zones']['keep_out'] if k.get('rule') == 'GR-N03']
    if not z:
        return skip('no centre band zone')
    m = polymask(z[0]['poly'], c.code.shape) & c.part('weapon')
    return R(m.sum() == 0 or c.pose['intent'] != 'idle', f'{int(m.sum())} weapon px in the centre band', '0 in an idle')


@rule('GR-N04')
@need_pose
def _(c):
    L = c.L
    t = np.array(c.pose['haft']['tip'])
    sh = np.array(L['shoulder_far'])
    u = (sh - t) / np.linalg.norm(sh - t)
    n = np.array([-u[1], u[0]])
    de = abs((np.array(L['elbow_near']) - t) @ n)
    dw = abs((np.array(L['wrist_near']) - t) @ n)
    return R(not (de <= 2 and dw <= 2), f'elbow {de:.1f}, wrist {dw:.1f} px off the tip-to-far-shoulder line', 'not both <= 2')


@rule('GR-N05')
@need_pose
def _(c):
    a = 90 - haft_angle(c)
    return R(not (a < 15), f'{a:.0f} deg from horizontal', 'not horizontal through the pelvis')


# ------------------------------------------------------------------ CL: cloth

@rule('CL-P02', 'CL-N01')
@need_pose
def _(c):
    tab = c.part('tabard')
    ys = np.nonzero(tab.any(1))[0]
    if not len(ys):
        return skip('no tabard')
    top_rows = ys[:3]
    top_x = np.mean([np.nonzero(tab[y])[0].mean() for y in top_rows])
    hem_x = np.mean([np.nonzero(tab[y])[0].mean() for y in ys[-6:-2]])
    low = 'near' if c.L['hip_near'][1] > c.L['hip_far'][1] else 'far'
    toward = (hem_x - top_x) * (-1 if low == 'near' else 1) > 0
    # band tilt: the hip band the tabard hangs from (principal axis of its pixels)
    by, bx = np.nonzero(c.part('pelvis') & c.matm('gold'))
    cc_, d_ = fit_line(bx, by)
    if d_[0] < 0:
        d_ = -d_
    tt = -math.degrees(math.atan2(d_[1], d_[0]))
    ht = hip_tilt(c)
    return R(toward and abs(tt - ht) <= 2.5, f'hem shifts {hem_x - top_x:+.1f} px (low hip {low}); band {tt:+.1f} vs hips {ht:+.1f} deg',
             'hem toward the low hip; band within 2 deg of the hip axis', 'critic confirms the cling and swing')


def border_pairs(c, mats=None):
    """4-neighbour pixel pairs across part borders: (code a, code b, mat a, mat b)"""
    out = []
    H, W = c.code.shape
    for dy, dx in ((0, 1), (1, 0)):
        a = c.code[:H - dy, :W - dx]
        b = c.code[dy:, dx:]
        pa = c.parts[:H - dy, :W - dx]
        pb = c.parts[dy:, dx:]
        ma = c.ids[:H - dy, :W - dx]
        mb = c.ids[dy:, dx:]
        sel = (a > 0) & (b > 0) & (pa != pb) & (pa > 0) & (pb > 0)
        out.append(np.stack([a[sel], b[sel], ma[sel], mb[sel]], 1))
    return np.concatenate(out) if out else np.zeros((0, 4), int)


@rule('CL-P03')
@need_pose
def _(c):
    bp = border_pairs(c)
    wid = [A.MAT['white'], A.MAT['veil']]
    sel = np.isin(bp[:, 2], wid) & np.isin(bp[:, 3], wid)
    bp = bp[sel]
    if not len(bp):
        return R(True, 'no white-on-white borders', '')
    line = c.c('W4', 'OL', 'I3', 'I4', 'G3', 'G4')
    ctr = np.array([A.contrast(c.lum[a], c.lum[b]) for a, b in bp[:, :2]])
    lined = np.isin(bp[:, 0], line) | np.isin(bp[:, 1], line)
    bad = (ctr < 1.9) & ~lined
    return R(bad.mean() <= 0.10, f'{bad.mean():.0%} of {len(bp)} white/white border pairs under 1.9:1 with no contact line',
             '<= 10% (every overlap separated)')


@rule('CL-P04')
@need_pose
def _(c):
    st = c.matm('stocking') & c.mask
    codes = c.code[st]
    ind = np.isin(codes, c.c('I0', 'I1', 'I2', 'I3', 'I4', 'OL', 'G1', 'G2', 'G3')).mean() if st.any() else 0
    z = [k for k in c.pose['zones']['must_be'] if k['expect'] == 'dark']
    dark = must_be(c, z[0])[1] if z else None
    # boot / stocking border: gold line present?
    gold_line = (c.matm('boot') & c.isin(c.code, 'G1', 'G2')).sum()
    ok = ind >= 0.9 and dark is not None and dark < 0.10 and gold_line > 0
    return R(ok, f'stocking px {ind:.0%} indigo/line/band; between-legs mean L {dark}; boot cuff gold px {int(gold_line)}',
             '>= 90%; L < 0.10; gold line or >= 1.9:1')


@rule('CL-P05')
@need_pose
def _(c):
    z = [k for k in c.pose['zones']['must_be'] if k['expect'] == 'gold_cross']
    if not z:
        return R(False, 'no collar-cross zone', '')
    m = polymask(z[0]['poly'], c.code.shape)
    gold = m & c.isin(c.code, 'G0', 'G1', 'G2', 'G3')
    cov = m & c.part('hand_far', 'hand_near', 'hair_front', 'hair_back', 'weapon')
    back = m & c.isin(c.code, 'I3', 'I4', 'G4', 'OL')
    gl = c.lum[np.clip(c.code[gold], 0, None)].mean() if gold.any() else 0
    bl = c.lum[np.clip(c.code[back], 0, None)].mean() if back.any() else 1
    ctr = A.contrast(gl, bl)
    # plus shape: a row and a column of gold through the centre
    ys, xs = np.nonzero(gold)
    plus = gold.any() and (Counter(ys).most_common(1)[0][1] >= 5) and (Counter(xs).most_common(1)[0][1] >= 5)
    return R(gold.sum() >= 9 and plus and ctr >= 3 and cov.sum() == 0,
             f'{int(gold.sum())} gold px, plus shape {plus}; backing contrast {ctr:.1f}:1; {int(cov.sum())} covering px',
             '>= 9 in a plus; >= 3:1; 0 covered')


@rule('CL-N02')
@need_pose
def _(c):
    L = c.L
    y0, y1 = int(L['chin'][1]), int(min(L['shoulder_near'][1], L['shoulder_far'][1]))
    best = 0
    for y in range(y0, y1 + 1):
        row = c.parts[y]
        for side in (1, -1):
            xs = np.nonzero(c.mask[y])[0]
            if not len(xs):
                continue
            # from the silhouette edge inward: count skin/collar px before hair
            seq = row[xs] if side == 1 else row[xs][::-1]
            n = 0
            for p in seq[1:]:
                if p in (A.PART['neck'], A.PART['collar'], A.PART['torso'], A.PART['arm_far'], A.PART['arm_near']):
                    n += 1
                else:
                    break
            best = max(best, n)
    return R(best >= 2, f'{best} px of neck/shoulder visible beside the hair', '>= 2 on one side')


# ------------------------------------------------------------------ FC: face (on the face stamp)

def need_face(f):
    def g(c):
        return skip('face rule; no face.json') if not c.face else f(c)
    return g


@rule('FC-P01')
@need_face
def _(c):
    r = face_rows(c)
    lm = c.flm
    lt = r['lash_top']
    chk = {'mouth': (r['mouth'], 2, 3), 'nose': (r['nose'], 6, 7), 'eye_bottom': ([r['eye_bottom']], 9, 11),
           'lash_top': ([lt], 13, 15), 'brow': (list(r['brow_over_lash'].values()),) + BROW_RANGE.get(lm['expression'], (2, 3)),
           'hair_top': ([r['hair_top']], 29, 30)}
    bad, txt = [], []
    for k, (vals, lo, hi) in chk.items():
        vals = [v for v in vals if v is not None]
        # a feature passes when its main row (mouth: lowest lip row; brow: the brow's lowest row) is in range
        if k == 'mouth':
            v = min(vals) if vals else None
        elif k == 'brow':
            v = min(vals) if vals else None
        elif k == 'nose':
            v = min(vals) if vals else None
        else:
            v = vals[0] if vals else None
        txt.append(f'{k} {v}')
        if v is None or not (lo <= v <= hi):
            bad.append(k)
    return R(not bad, ', '.join(txt) + f" [{r['grid_from']}]" + (f'  (out: {", ".join(bad)})' if bad else ''),
             'mouth 2-3, nose 6-7, eye bottom 9-11, lash top 13-15, brow 2-3 over its lash top, hair top 29-30')


def face_width(c):
    lm = c.flm
    r = face_rows(c)
    y = lm['chin_y'] - (r['lash_top'] - 2 if r['lash_top'] else 12)
    row = np.isin(c.fparts[y], [A.PART['face'], A.PART['eye']])
    xs = np.nonzero(row)[0]
    return (int(xs.max() - xs.min() + 1) if len(xs) else 0), r


@rule('FC-P02', 'FC-N09')
@need_face
def _(c):
    w, r = face_width(c)
    ratio = r['lash_top'] / w if w else 0
    if c.flm['yaw'] == 'profile':
        # a side view has no face width across the eye row; the grid rows (FC-P01) carry the proportion
        # (learning log round R1: the check had measured the cheek strip of a profile as the face width)
        return skip('profile: no face width across the eye row (FC-P01 carries the proportion)')
    if c.flm['yaw'] != 'q34':
        return R(rng(ratio, 0.75, 1.0), f'width {w}, ratio {ratio:.2f} ({c.flm["yaw"]}: range written for q34)', 'q34 only')
    return R(rng(w, 15, 16) and rng(ratio, 0.85, 0.95), f'width {w} px at the eye row; (lash top - chin) / width = {ratio:.2f}',
             '15-16; 0.85-0.95')


@rule('FC-P03')
@need_face
def _(c):
    if c.flm['yaw'] != 'q34':
        return skip('three-quarter rule')
    d = c.flm['eyes']['far']['box'][0] - c.flm['centre_line_x_at_eye_row']
    return R(rng(d, 0, 2), f'far inner corner {d} px right of the centre line', '1 (+-1)')


def eye_extent(c, side):
    sub, box = eye_pixels(c, side)
    m = np.isin(sub, c.c('OL', 'A2', 'A3', 'A4', 'A5', 'W1', 'W2', 'I3'))
    xs = np.nonzero(m.any(0))[0]
    ys = np.nonzero(m.any(1))[0]
    return (int(xs.max() - xs.min() + 1) if len(xs) else 0), (int(ys.max() - ys.min() + 1) if len(ys) else 0)


@rule('FC-P04', 'FC-N03')
@need_face
def _(c):
    if c.flm['yaw'] != 'q34':
        return skip('three-quarter rule')
    if c.flm['expression'] in ('radiant', 'hurt'):
        return skip('closed eyes (arcs / squeezed line)')
    nw, nh = eye_extent(c, 'near')
    fw, fh = eye_extent(c, 'far')
    ratio = fw / nw if nw else 0
    ok = rng(nw, 5, 6) and rng(nw - fw, 1, 2) and rng(ratio, 0.66, 0.85) and rng(nh - fh, 0, 1)
    return R(ok, f'near {nw}x{nh}, far {fw}x{fh}, far/near {ratio:.2f}', 'near 5-6; 1-2 narrower; 0.66-0.85; 0-1 shorter')


@rule('FC-P05')
@need_face
def _(c):
    e = c.flm['eyes']
    if 'far' not in e:
        return skip('one eye (profile)')
    gap = e['far']['box'][0] - e['near']['box'][2] - 1
    lo, hi = (3, 4) if c.flm['yaw'] == 'q34' else (5, 6)
    return R(rng(gap, lo, hi), f'{gap} px', f'{lo}-{hi}')


@rule('FC-P06', 'FC-N10', 'FC-N12')
@need_face
def _(c):
    npx = c.flm.get('nose', [])
    if not npx:
        return skip('no nose mark (profile uses the contour)')
    codes = {c.pal.code_of(int(c.fcode[y, x])) for x, y in npx}
    rows = [c.flm['chin_y'] - y for x, y in npx]
    eb = face_rows(c)['grid_eye_bottom']
    below = [eb - r for r in rows]
    x = npx[0][0] - c.flm['centre_line_x_at_eye_row']
    e = c.flm['eyes']
    mid = (e['near']['box'][2] + e['far']['box'][0]) / 2 if 'far' in e else None
    centred = mid is not None and abs(npx[0][0] - mid) < 0.5
    ok = rng(len(npx), 1, 2) and codes == {'S3'} and all(rng(b, 3, 4) for b in below) and (c.flm['yaw'] != 'q34' or (x == 1 and not centred))
    return R(ok, f'{len(npx)} px {sorted(codes)}, {below} rows under the eye bottom, x = centre {x:+d}; centred between the eyes: {centred}',
             '1-2 px S3; 3-4 rows; centre +1 toward far; not centred')


def mouth_px(c):
    return [(x, y, k) for x, y, k in c.flm.get('mouth', {}).get('px', [])]


@rule('FC-P07', 'FC-N11')
@need_face
def _(c):
    mp = mouth_px(c)
    if not mp:
        return R(False, 'no mouth', '')
    xs = [x for x, y, k in mp]
    w = max(xs) - min(xs) + 1
    left = [y for x, y, k in mp if x == min(xs)]
    right = [y for x, y, k in mp if x == max(xs)]
    open_ = any(k == 'SB' for x, y, k in mp) and len({y for x, y, k in mp}) >= 2
    expr = c.flm['expression']
    corner = abs(min(left) - min(right))
    if open_:
        ok = rng(w, 2, 4)
    else:
        ok = rng(w, 2, 4) and (corner == 1 or expr in ('focused', 'ignited', 'radiant'))
    return R(ok, f'{"open" if open_ else "closed"}, {w} px wide, corner rows differ by {corner}', '2-4 px; one corner raised 1 px (closed)')


@rule('FC-P08')
@need_face
def _(c):
    lm = c.flm
    fe = {int(k): v for k, v in lm['far_edge'].items()}
    ne = {int(k): v for k, v in lm['near_edge'].items()}
    if 0 not in fe or 0 not in ne:
        return skip('no contour table')
    w = fe[0] - ne[0] + 1
    off = (fe[0] + ne[0]) / 2 - lm['centre_line_x_at_eye_row']
    bulge = max(fe.get(r, 0) for r in (8, 9, 10)) - max(fe.get(r, 0) for r in (6, 7))
    if lm['yaw'] != 'q34':
        # the offset and the far-cheek bulge are three-quarter construction (maryli-34); a front chin sits on the
        # centre line (learning log round R1: the check had applied the q34 offset to every yaw)
        centred = abs(off) <= 0.5 if lm['yaw'] == 'front' else True
        return R(rng(w, 2, 4) and centred, f'chin {w} px, {off:+.1f} from the centre line ({lm["yaw"]}: offset/bulge are q34-only)',
                 '2-4; front: on the centre line')
    return R(rng(w, 2, 4) and rng(off, 1, 2) and bulge >= 1, f'chin {w} px, {off:+.1f} toward far; cheek bulge {bulge} px',
             '2-4; +1-2; >= 1')


def eye_info(c, side):
    return c.flm['eyes'].get(side, {})


@rule('FC-P09', 'FC-N06')
@need_face
def _(c):
    out, ok = [], True
    expr = c.flm['expression']
    if expr in ('radiant', 'hurt'):
        return skip('closed eyes: no open lash to measure')
    for side in ('near', 'far'):
        sub, box = eye_pixels(c, side)
        if sub is None:
            continue
        rows = [y for y in range(sub.shape[0]) if (sub[y] == c.I('OL')).any()]
        # flick: an OL pixel just outside the box on the outer side, at or above the lash top
        x0, y0, x1, y1 = box
        outer_x = x0 - 1 if side == 'near' else x1 + 1
        flick = any(c.fcode[y, outer_x] == c.I('OL') for y in range(y0 - 2, y0 + 3) if 0 <= y < c.fcode.shape[0])
        n2 = sum(1 for y in rows[:2] for _ in [0])
        ok &= len(rows) >= 2 and (flick or expr in ('serene', 'hurt', 'radiant', 'focused', 'ignited'))
        out.append(f'{side}: {len(rows)} lash rows, flick {flick}')
    return R(ok, '; '.join(out), '2 rows + a flick (not Serene/Hurt)')


@rule('FC-P10')
@need_face
def _(c):
    out, ok = [], True
    if c.flm['expression'] == 'ignited':
        return skip('Ignited replaces the iris with A4 by design (ART-RULES 6.5)')
    for side in ('near', 'far'):
        e = eye_info(c, side)
        if not e or 'iris_cols' not in e:
            if c.flm['expression'] in ('radiant', 'hurt'):
                return skip('closed eyes')
            continue
        sub, box = eye_pixels(c, side)
        eye_px = np.isin(c.fparts, [A.PART['eye']])[box[1]:box[3] + 1, box[0]:box[2] + 1]
        codes = set(sub[eye_px & np.isin(sub, c.c('A2', 'A3', 'A4', 'A5', 'W1', 'W2'))].tolist())
        irisc = codes & set(c.c('A2', 'A3', 'A4', 'I3'))
        top = min(e['iris_rows'])
        above = [c.fcode[top - 1, x] for x in e['iris_cols']]
        touch = all(v == c.I('OL') for v in above)
        wlo, whi = (3, 3) if side == 'near' else (2, 3)
        ok &= rng(e['iris_w'], wlo, whi) and touch and c.I('A5') in codes and len(irisc) <= 3 and len(codes) + 1 <= 7
        out.append(f'{side}: iris {e["iris_w"]} wide, touches the lash {touch}, {len(irisc)} iris tones + A5, '
                   f'{len(codes) + 1} colours with the lash')
    return R(ok, '; '.join(out), 'iris 3 near / 2-3 far; touches the lash; 3 tones + A5; 5-6 codes')


def gaze_signs(c):
    s = {}
    for side in ('near', 'far'):
        e = eye_info(c, side)
        if e.get('whites') and e.get('iris_cols'):
            wx = np.mean([w[0] for w in e['whites']])
            s[side] = float(np.sign(wx - np.mean(e['iris_cols'])))
    return s


@rule('FC-P11')
@need_face
def _(c):
    s = gaze_signs(c)
    tgt = c.flm.get('gaze_target')
    if len(s) < 2:
        return skip('closed or single eye')
    return R(len(set(s.values())) == 1 and bool(tgt), f'white side per eye {s}; target {tgt}', 'same side both eyes; a named target')


@rule('FC-P12', 'FC-N05')
@need_face
def _(c):
    sides, cls = [], []
    for side in ('near', 'far'):
        e = eye_info(c, side)
        if not e.get('highlight'):
            continue
        hx, hy = e['highlight']
        ic = e['iris_cols']
        sides.append('right' if hx == max(ic) else 'left' if hx == min(ic) else 'mid')
        on_lash = c.fcode[hy - 1, hx] == c.I('OL') and False
        cls.append('edge' if hx in (min(ic), max(ic)) else 'mid')
    if not sides:
        return skip('no highlight (closed eyes or Ignited)')
    light = 'right' if c.flm.get('light', [1])[0] > 0 else 'left'
    ok = len(set(sides)) == 1 and sides[0] == light and all(k == 'edge' for k in cls)
    return R(ok, f'highlights {sides} ({cls}); key light {light}', 'same side, the lit side, on the iris edge')


@rule('FC-P13')
@need_face
def _(c):
    expr = c.flm['expression']
    rows = [len(eye_info(c, s).get('iris_rows', [])) for s in ('near', 'far') if eye_info(c, s)]
    n = min(rows) if rows else 0
    need = {'confident': (3, 9), 'radiant_open': (3, 9), 'ignited': (2, 9), 'focused': (2, 9), 'serene': (1, 2),
            'radiant': (0, 0), 'hurt': (0, 0)}.get(expr, (3, 9))
    return R(rng(n, *need), f'{expr}: {rows} iris rows', f'{need[0]}-{need[1] if need[1] < 9 else "any"}')


@rule('FC-P14')
@need_face
def _(c):
    if not c.face['params'].get('pupil'):
        return skip('no pupil (optional)')
    return R(True, 'pupil on the gaze side (placed by the tool)', '')


# brow height over the lash top by expression: 2-3 is the neutral grid (FC-P01/P15); Focused and Ignited
# pull the inner ends down 1-2 px, Radiant raises them 1 px, Hurt lifts the inner ends (ART-RULES 6.5)
BROW_RANGE = {'focused': (1, 3), 'ignited': (1, 3), 'radiant': (2, 4), 'radiant_open': (2, 4), 'hurt': (1, 4)}


def brows(c):
    return {s: v for s, v in c.flm.get('brows', {}).items()}


@rule('FC-P15', 'FC-N23')
@need_face
def _(c):
    b = brows(c)
    lt = face_rows(c)['lash_top']
    out, ok = [], True
    for s in ('near', 'far'):
        if s not in c.flm['eyes']:
            continue
        px = b.get(s, [])
        if not px:
            ok = False
            out.append(f'{s}: none')
            continue
        xs = [x for x, y in px]
        ln = max(xs) - min(xs) + 1
        own = face_rows(c)['lash_top_side'].get(s, lt)
        rows = [c.flm['chin_y'] - y - own for x, y in px]
        lo, hi = BROW_RANGE.get(c.flm['expression'], (2, 3))
        out.append(f'{s}: {ln} px, {min(rows)}-{max(rows)} rows over its lash top (range {lo}-{hi} for {c.flm["expression"]})')
        ok &= min(rows) >= lo and max(rows) <= hi + 1
        if s == 'near':
            ok &= rng(ln, 3, 4)
    if 'far' in b and 'near' in b and c.flm['yaw'] == 'q34':
        fl = max(x for x, y in b['far']) - min(x for x, y in b['far']) + 1
        nl = max(x for x, y in b['near']) - min(x for x, y in b['near']) + 1
        ok &= fl == nl - 1
    return R(ok, '; '.join(out), 'both present; near 3-4 px; 2-3 rows up; far 1 px shorter')


def face_skin(c):
    return np.isin(c.fparts, [A.PART['face']]) & (c.fcode > 0)


@rule('FC-P16')
@need_face
def _(c):
    m = face_skin(c)
    codes = Counter(c.pal.code_of(int(v)) for v in c.fcode[m])
    tot = sum(v for k, v in codes.items() if k in ('S1', 'S2', 'S3', 'S4'))
    s2 = codes['S2'] / tot if tot else 0
    # cast shadow under the fringe: S3 px with hair above
    hair = np.isin(c.fids, [A.MAT['hair']])
    fringe = m & (c.fcode == c.I('S3')) & A.shift(hair, 0, 1)
    chin = np.isin(c.fparts, [A.PART['neck']]) & (c.fcode == c.I('S4'))
    s1 = int(codes['S1'])
    ok = s2 >= 0.7 and fringe.any() and chin.any() and (s1 == 0 or rng(s1, 2, 4))
    return R(ok, f'S2 {s2:.0%} of face skin; fringe shadow {int(fringe.sum())} px; under-chin {int(chin.sum())} px; S1 {s1}',
             'S2 >= 70%; fringe and chin shadows; S1 cluster 2-4 if any')


@rule('FC-P17')
@need_face
def _(c):
    b = c.flm.get('blush', {})
    if not b:
        return skip('no blush')
    counts = {s: len(v) for s, v in b.items()}
    touch = 0
    for s, v in b.items():
        for x, y in v:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if c.fcode[y + dy, x + dx] == c.I('S3'):
                    touch += 1
    ok = all(rng(n, 2, 3) for n in counts.values()) and touch == 0
    return R(ok, f'{counts} px; {touch} touching S3', '2-3 per cheek; 0 on S3')


def feature_mask(c):
    m = np.zeros(c.fcode.shape, bool)
    m |= np.isin(c.fparts, [A.PART['eye']])
    for s, v in brows(c).items():
        for x, y in v:
            m[y, x] = True
    for x, y, k in mouth_px(c):
        m[y, x] = True
    for x, y in c.flm.get('nose', []):
        m[y, x] = True
    for s, v in c.flm.get('blush', {}).items():
        for x, y in v:
            m[y, x] = True
    return m


@rule('FC-P18')
@need_face
def _(c):
    m = face_skin(c) & ~feature_mask(c) & ~A.ring_in(face_skin(c))
    bad = m & c.isin(c.fcode, 'OL', 'S4')
    return R(bad.sum() == 0, f'{int(bad.sum())} OL/S4 px inside the face', '0')


def zones_of(rec, lib_eye=None):
    """brow rows, eye rows and mouth rows of a face record, as sets of (x, y, code)"""
    code = rec['rows']
    lm = rec['landmarks']
    out = {}
    for zone, parts in (('brows', [p for v in lm.get('brows', {}).values() for p in v]),):
        out[zone] = {(x, y, code[y][x]) for x, y in parts}
    eyes = set()
    for s, e in lm.get('eyes', {}).items():
        x0, y0, x1, y1 = e['box']
        for y in range(y0 - 2, y1 + 2):
            for x in range(x0 - 1, x1 + 2):
                ch = code[y][x]
                if ch in 'Oabchwen':
                    eyes.add((x, y, ch))
    out['eyes'] = eyes
    out['mouth'] = {(x, y, k) for x, y, k in lm.get('mouth', {}).get('px', [])}
    return out


@rule('FC-P19', 'FC-N19')
@need_face
def _(c):
    fs = c.face_set()
    missing = [e for e in EXPRESSIONS if e not in fs]
    if 'confident' not in fs:
        return R(False, 'no Confident face in ' + str(c.faces_dir), 'six expressions')
    base = zones_of(fs['confident'])
    few = []
    diffs = {}
    for e, rec in fs.items():
        if e == 'confident':
            continue
        z = zones_of(rec)
        n = sum(1 for k in ('brows', 'eyes', 'mouth') if z[k] != base[k])
        diffs[e] = n
        if n < 2:
            few.append(e)
    return R(not missing and not few, f'present {sorted(fs)}; zones changed vs Confident {diffs}' + (f'; missing {missing}' if missing else ''),
             'all six; >= 2 zones each')


@rule('FC-P20', 'FC-N18')
@need_face
def _(c):
    lm = c.flm
    asym = []
    if lm['yaw'] == 'q34':
        asym.append('three-quarter turn')
    e = lm['eyes']
    if 'near' in e and 'far' in e:
        if e['near']['box'][1] != e['far']['box'][1]:
            asym.append('eye-line tilt')
        nb = brows(c)
        if nb.get('near') and nb.get('far') and min(y for x, y in nb['near']) != min(y for x, y in nb['far']):
            asym.append('brow height')
    mp = mouth_px(c)
    if mp:
        xs = [x for x, y, k in mp]
        if len({y for x, y, k in mp if x in (min(xs), max(xs))}) > 1:
            asym.append('mouth corner')
    beyond = [a for a in asym if a != 'three-quarter turn']
    return R(len(beyond) >= 1, ', '.join(asym) or 'none', '>= 1 beyond the 3/4 foreshortening')


@rule('FC-N01')
@need_face
def _(c):
    s = gaze_signs(c)
    if len(s) < 2:
        return skip('closed or single eye')
    nose_side = {'near': 1.0, 'far': -1.0}          # q34 facing right: the near eye's nose side is screen-right
    both = all(s[k] == nose_side[k] for k in s)
    return R(not both, f'white side per eye {s}', 'never both on the nose side')


@rule('FC-N02')
@need_face
def _(c):
    s = gaze_signs(c)
    hl = [eye_info(c, k).get('highlight') for k in ('near', 'far')]
    same_hl = None
    if all(hl):
        sides = ['r' if h[0] == max(eye_info(c, k)['iris_cols']) else 'l' for h, k in zip(hl, ('near', 'far'))]
        same_hl = len(set(sides)) == 1
    if len(s) < 2:
        return skip('closed or single eye')
    return R(len(set(s.values())) == 1 and same_hl is not False, f'iris offsets agree {len(set(s.values())) == 1}; highlights agree {same_hl}',
             'no flipped eye')


@rule('FC-N04')
@need_face
def _(c):
    if c.flm['expression'] not in ('confident', 'serene'):
        return skip('rule is for Confident and Serene')
    n = 0
    for side in ('near', 'far'):
        e = eye_info(c, side)
        if not e.get('iris_rows'):
            continue
        top = min(e['iris_rows'])
        for x in e['iris_cols']:
            y = top - 1
            while y >= 0 and c.fcode[y, x] != c.I('OL'):
                if c.fcode[y, x] in c.c('W1', 'W2'):
                    n += 1
                y -= 1
                if y < top - 3:
                    break
    return R(n == 0, f'{n} white px above the irises', '0')


@rule('FC-N07')
@need_face
def _(c):
    lash = np.isin(c.fparts, [A.PART['eye']]) & (c.fcode == c.I('OL'))
    hair = (c.fids == A.MAT['hair']) & c.isin(c.fcode, 'I4', 'OL')
    n = 0
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n += int((lash & A.shift(hair, dx, dy)).sum())
    return R(n == 0, f'{n} lash/dark-hair contacts', '0')


@rule('FC-N08')
@need_face
def _(c):
    sub, box = eye_pixels(c, 'near')
    if sub is None:
        return skip('no eye')
    tops = [np.nonzero(sub[:, x] == c.I('OL'))[0] for x in range(sub.shape[1])]
    tops = [t.min() for t in tops if len(t)]
    if len(tops) < 3:
        return skip('lash too short')
    sym = tops[0] == tops[-1] and int(np.argmin(tops)) in (len(tops) // 2, (len(tops) - 1) // 2)
    return R(not sym, f'lash profile {tops}', 'not a symmetric round arch')


@rule('FC-N13')
@need_face
def _(c):
    lm = c.flm
    eb = face_rows(c)['eye_bottom'] or 10
    fe = {int(k): v for k, v in lm['far_edge'].items()}
    best, run, prev = 0, 0, None
    for r in range(eb - 1, -1, -1):
        v = fe.get(r)
        run = run + 1 if v == prev else 1
        best = max(best, run)
        prev = v
    ne = {int(k): v for k, v in lm['near_edge'].items()}
    chin = fe.get(0, 0) - ne.get(0, 0) + 1
    return R(best <= 3 and chin <= 4, f'longest straight far-cheek run {best} rows; chin row {chin} px', '<= 3; <= 4')


@rule('FC-N14')
@need_face
def _(c):
    sh = pillow(face_skin(c), c.fcode, c.c('S3'))
    n = sum(v >= 0.7 for v in sh.values())
    return R(n < 3, ', '.join(f'{k} {v:.0%}' for k, v in sh.items()), 'S3 ring on < 3 sides')


@rule('FC-N15')
@need_face
def _(c):
    m = face_skin(c) & ~feature_mask(c)
    n = 0
    for code in set(c.fcode[m].tolist()) - {c.I('S2')}:
        lab, sizes = A.components(m & (c.fcode == code))
        n += sum(1 for k, s in sizes if s == 1)
    return R(n == 0, f'{n} stray single px in the face', '0')


@rule('FC-N16')
@need_face
def _(c):
    m = (c.fcode == c.I('S4')) & ~np.isin(c.fparts, [A.PART['neck']])
    for x, y, k in mouth_px(c):
        m[y, x] = False
    return R(m.sum() == 0, f'{int(m.sum())} S4 px outside the mouth and under-chin shadow', '0')


@rule('FC-N17')
@need_face
def _(c):
    e = c.flm['eyes']
    hair = hair_px(c)
    n = 0
    for s, v in e.items():
        x0, y0, x1, y1 = v['box']
        n += int(hair[y0:y1 + 1, x0:x1 + 1].sum())
    if 'near' in e and 'far' in e:
        nb, fb = e['near']['box'], e['far']['box']
        n += int(hair[nb[1]:nb[3] + 1, nb[2] + 1:fb[0]].sum())
    return R(n == 0, f'{n} hair px in the eye boxes / between the eyes', '0')


@rule('FC-N20')
@need_face
def _(c):
    fs = c.face_set()
    if 'radiant' not in fs or 'confident' not in fs:
        return skip('needs Radiant and Confident')
    same_eyes = zones_of(fs['radiant'])['eyes'] == zones_of(fs['confident'])['eyes']
    return R(not same_eyes, f'Radiant eyes differ from Confident: {not same_eyes}', 'a smile changes the eyes too')


@rule('FC-N21')
@need_face
def _(c):
    t = c.flm.get('gaze_target')
    dx = c.face['params']['gaze'][0]
    facing = 1 if c.flm['facing'] == 'right' else -1
    ok = bool(t) and (t != 'viewer' or np.sign(dx) == -facing or c.flm['yaw'] == 'front')
    return R(ok, f'target {t}; iris offset {dx:+d} px on a head facing {c.flm["facing"]}', 'named and consistent')


@rule('FC-N22')
@need_face
def _(c):
    expr = c.pose['expression'] if c.pose else c.flm['expression']
    intent = c.pose['intent'] if c.pose else 'idle'
    rows = min(len(eye_info(c, s).get('iris_rows', [])) for s in c.flm['eyes'])
    if intent not in ('idle', 'walk', 'menu'):
        return skip('not a resting still')
    if not c.pose and expr != 'confident':
        return skip(f'{expr} face checked alone (the rule is about which face the resting stills use)')
    return R(expr == 'confident' and rows >= 3, f'{intent} uses {expr} with {rows} iris rows', 'Confident, >= 3 iris rows')


# ------------------------------------------------------------------ HR: hair

@rule('HR-P02')
@need_face
def _(c):
    r = face_rows(c)
    v = r['hair_top'] - c.flm['skull_top_row']
    return R(rng(v, 2, 3), f'hair top {r["hair_top"]} - skull top {c.flm["skull_top_row"]} = {v}', '2-3')


def hair_px(c):
    """hair on the face stamp, including the brow pixels drawn over it"""
    return np.isin(c.fparts, [A.PART['hair_front'], A.PART['hair_back']]) | (c.fids == A.MAT['hair'])


def fringe_runs(c, r):
    """runs of hair px across the face at row r above the chin, split by skin or separator (I4)"""
    y = c.flm['chin_y'] - r
    fe = {int(k): v for k, v in c.flm['far_edge'].items()}
    ne = {int(k): v for k, v in c.flm['near_edge'].items()}
    rr = min(max(r, min(fe)), max(fe))
    x0, x1 = ne.get(rr, ne[max(ne)]) - 1, fe.get(rr, fe[max(fe)]) + 1
    runs, cur = [], 0
    for x in range(x0, x1 + 1):
        v = c.fcode[y, x]
        is_hair = c.fids[y, x] == A.MAT['hair'] and v != c.I('I4')
        if is_hair:
            cur += 1
        elif cur:
            runs.append(cur)
            cur = 0
    if cur:
        runs.append(cur)
    return runs


@rule('HR-P03', 'HR-N01')
@need_face
def _(c):
    lt = face_rows(c)['lash_top']
    r_root = c.flm['rows_above_chin']['hairline'] - 1      # the first row under the hairline: clump roots
    r_tip = lt + 1
    roots = fringe_runs(c, r_root)
    tips = fringe_runs(c, r_tip)
    n = len(roots)
    ok = rng(n, 3, 5) and all(rng(w, 3, 6) for w in roots[1:-1]) and all(w <= 3 for w in tips[1:-1])
    return R(ok, f'{n} clumps at row {r_root} (widths {roots}); tips at row {r_tip}: {tips}', '3-5 clumps; roots 3-5; tips 1-2')


@rule('HR-P04')
@need_face
def _(c):
    lt = face_rows(c)['lash_top']
    hair = c.fids == A.MAT['hair']
    out, ok = [], True
    for s, e in c.flm['eyes'].items():
        x0, y0, x1, y1 = e['box']
        cols = hair[:y0, x0:x1 + 1]
        ys = [np.nonzero(cols[:, i])[0].max() for i in range(cols.shape[1]) if cols[:, i].any()]
        low = c.flm['chin_y'] - max(ys) if ys else None
        own = c.flm['chin_y'] - y0                       # this eye's lash-top row (the eye line may tilt)
        hair = hair_px(c)
        gap = False
        for r in range(own + 1, own + 4):
            y = c.flm['chin_y'] - r
            gap |= bool((c.fparts[y, x0:x1 + 1] == A.PART['face']).any())
        ok &= low is not None and rng(low - own, 1, 2) and gap
        out.append(f'{s}: lowest hair row {low} (lash top {own}), skin gap above {gap}')
    return R(ok, '; '.join(out), 'tips end 1-2 rows over the eye\'s own lash top (never in the eye box, FC-N17); a skin gap above each eye')


@rule('HR-P05')
@need_face
def _(c):
    fe = {int(k): v for k, v in c.flm['far_edge'].items()}
    hair = c.fids == A.MAT['hair']
    n = 0
    for r in range(0, 11):
        y = c.flm['chin_y'] - r
        x = fe.get(r)
        if x is not None and hair[y, x]:
            n += 1
    return R(n == 0, f'{n} hair px over the far cheek contour and chin', '0')


@rule('HR-P06')
@need_face
def _(c):
    hair = (c.fids == A.MAT['hair'])
    interior = hair & A.erode(hair | (c.fcode == 0) & False, 1)
    ol_inside = int((interior & (c.fcode == c.I('OL')) & ~np.isin(c.fparts, [A.PART['eye']])).sum())
    brow_px = sum(len(v) for v in brows(c).values())
    return R(ol_inside <= brow_px, f'{ol_inside} OL px inside the hair (brows over the bangs: {brow_px})', 'separators I4; no OL except brows')


def hair_hist(c, code, mask):
    cnt = Counter(c.pal.code_of(int(v)) for v in code[mask])
    tot = sum(cnt[k] for k in ('I0', 'I1', 'I2', 'I3', 'I4')) or 1
    return cnt, tot


@rule('HR-P07')
def _(c):
    if c.pose:
        m, code = c.matm('hair') & c.mask, c.code
    elif c.face:
        m, code = c.fids == A.MAT['hair'], c.fcode
    else:
        return skip('no input')
    cnt, tot = hair_hist(c, code, m)
    li = (cnt['I1'] + cnt['I2']) / tot
    i4 = cnt['I4'] / tot
    return R(li >= 0.33 and i4 <= 0.15, f'I1+I2 {li:.0%}, I4 {i4:.0%}', '>= 33%; <= 15%')


@rule('HR-P08')
@need_face
def _(c):
    m = (c.fids == A.MAT['hair']) & (c.fcode == c.I('I0'))
    lab, sizes = A.components(m, conn=8)
    ys = np.nonzero(m)[0]
    span = int(ys.max() - ys.min() + 1) if len(ys) else 0
    nclump = len(c.face['params'].get('bangs', [])) or len(fringe_runs(c, face_rows(c)['lash_top'] + 5))
    return R(abs(len(sizes) - nclump) <= 1 and span <= 4, f'{len(sizes)} dashes over {span} rows; {nclump} clumps', '1 per clump; one 4-row band')


@rule('HR-P09')
def _(c):
    if not c.pose:
        return skip('the hair tips are on the figure')
    tip = c.part('hair_back') & c.isin(c.code, 'A3', 'A4')
    has = {k: bool((c.part('hair_back') & (c.code == c.I(k))).any()) for k in ('A3', 'A4')}
    return R(all(has.values()), f'tail tip tones {has}', 'A3 and A4')


@rule('HR-N02')
def _(c):
    m, code = ((c.matm('hair') & c.mask, c.code) if c.pose else (c.fids == A.MAT['hair'], c.fcode) if c.face else (None, None))
    if m is None:
        return skip('no input')
    n = 0
    for k in ('I0', 'I1'):
        lab, sizes = A.components(m & (code == c.I(k)))
        n += sum(1 for _, s in sizes if s == 1)
    return R(n <= 2, f'{n} single-px I0/I1 specks', '<= 2')


@rule('HR-N03')
def _(c):
    m, code = ((c.matm('hair') & c.mask, c.code) if c.pose else (c.fids == A.MAT['hair'], c.fcode) if c.face else (None, None))
    if m is None:
        return skip('no input')
    cnt, tot = hair_hist(c, code, m)
    lab, sizes = A.components(m & (code == c.I('I4')))
    big = max([s for _, s in sizes], default=0)
    return R(cnt['I4'] / tot <= 0.15 and big <= 20, f'I4 {cnt["I4"] / tot:.0%}, largest I4 patch {big} px', '<= 15%; <= 20 px')


# ------------------------------------------------------------------ PX: pixel rendering (sprite; face stamp if alone)

def sprite_or_face(c):
    if c.pose:
        return c.code, c.mask, c.ids, c.parts
    if c.face:
        return c.fcode, c.fcode > 0, c.fids, c.fparts
    return None, None, None, None


def need_px(f):
    def g(c):
        code, mask, ids, parts = sprite_or_face(c)
        if code is None:
            return skip('no input')
        return f(c, code, mask, ids, parts)
    return g


@rule('PX-P01')
@need_px
def _(c, code, mask, ids, parts):
    lt = np.array(c.pose['light'] if c.pose else [0.6, -0.8])
    res = []
    # per form (one part x one material): the half toward the key light must be the brighter half
    for pid in np.unique(parts[mask]):
        for mat in ('white', 'skin', 'stocking', 'hair'):
            m = mask & (parts == pid) & (ids == A.MAT[mat]) & (code != c.I('OL'))
            if m.sum() < 30 or pid in (A.PART['eye'], A.PART['face']):
                continue
            ys, xs = np.nonzero(m)
            L = c.lum[np.clip(code[m], 0, None)]
            side = np.sign((xs - xs.mean()) * lt[0] + (ys - ys.mean()) * lt[1])
            res.append((f'{A.PARTNAME.get(int(pid))}/{mat}', L[side > 0].mean() >= L[side < 0].mean()))
    bad = [m for m, v in res if not v]
    ok = len(bad) <= max(1, len(res) // 5)
    return R(ok, f'{len(res) - len(bad)} of {len(res)} forms brighter on the lit half' + (f'; darker: {bad}' if bad else ''),
             'one key light, same side (single frame)', 'critic confirms across frames')


@rule('PX-P02')
@need_px
def _(c, code, mask, ids, parts):
    out = []
    worst = 0
    for pn in ('leg_near', 'leg_far', 'torso', 'tabard', 'sleeve_near', 'sleeve_far', 'hair_back'):
        m = mask & (parts == A.PART[pn]) & ~(code == c.I('OL'))
        if m.sum() < 20:
            continue
        mat = Counter(ids[m].tolist()).most_common(1)[0][0]
        name = A.MATNAME.get(mat, '')
        from figure_construct import RAMP
        if name not in RAMP:
            continue
        sh = m & np.isin(code, [c.I(RAMP[name][1]), c.I(RAMP[name][0])])
        lab, sizes = A.components(sh)
        big = [s for _, s in sizes if s >= 6]
        worst = max(worst, len(big))
        out.append(f'{pn} {len(big)}')
    return R(worst <= 3, 'shadow shapes per form: ' + ', '.join(out), 'one terminator per form (<= 3 shadow shapes per part)',
             'critic confirms the shapes')


@rule('PX-P03')
@need_px
def _(c, code, mask, ids, parts):
    found = {}
    if c.face:
        hair = c.fids == A.MAT['hair']
        found['under bangs'] = int((np.isin(c.fparts, [A.PART['face']]) & (c.fcode == c.I('S3')) & A.shift(hair, 0, 1)).sum())
        found['under chin'] = int((np.isin(c.fparts, [A.PART['neck']]) & (c.fcode == c.I('S4'))).sum())
    if c.pose:
        found['under bust'] = int((c.part('torso') & (code == c.I('W3'))).sum())
        found['neck'] = int((c.part('neck') & (code == c.I('S4'))).sum())
    ok = all(v >= 2 for v in found.values())
    return R(ok, ', '.join(f'{k} {v} px' for k, v in found.items()), 'present, >= 2 px thick', 'critic confirms the shapes are designed')


def tones_per_material(c, code, mask, ids):
    out = {}
    for m in np.unique(ids[mask]):
        name = A.MATNAME.get(int(m), str(int(m)))
        sel = mask & (ids == m) & (code != c.I('OL'))
        # contact / inner lines (the material's deep tone on a part border) are lines, not tones
        from figure_construct import INNER
        ln = INNER.get(name)
        if ln:
            edge = np.zeros_like(sel)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                edge |= A.shift(ids, dx, dy) != ids
            sel &= ~((code == c.I(ln)) & edge)
        tot = sel.sum()
        if tot < 20:
            continue
        cnt = Counter(code[sel].tolist())
        out[name] = sorted([c.pal.code_of(k) for k, n in cnt.items() if n >= 0.05 * tot])
    return out


@rule('PX-P04')
@need_px
def _(c, code, mask, ids, parts):
    t = tones_per_material(c, code, mask, ids)
    glossy = ('hair', 'gold', 'steel', 'boot')
    bad = {k: v for k, v in t.items() if len(v) > (4 if k in glossy else 3) and k not in ('eye', 'line')}
    return R(not bad, ', '.join(f'{k} {len(v)}' for k, v in t.items()) + (f'  over: {bad}' if bad else ''),
             '<= 3 (+1 highlight on hair, gold, steel, boots)')


def hue(code, pal):
    r, g, b = (v / 255 for v in pal.rgb[code])
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    return h * 360, s


@rule('PX-P05', 'PX-P07')
def _(c):
    pal = c.pal
    ramps = {'white': ['W1', 'W2', 'W3', 'W4'], 'skin': ['S1', 'S2', 'S3', 'S4'], 'gold': ['G1', 'G2', 'G3', 'G4'],
             'indigo': ['I0', 'I1', 'I2', 'I3', 'I4'], 'steel': ['T2', 'T3', 'T4'], 'azure': ['A5', 'A4', 'A3', 'A2']}
    hue_bad, ctr_bad, low = [], [], []
    for n, r in ramps.items():
        for a, b in zip(r, r[1:]):
            ha, sa = hue(a, pal)
            hb, sb = hue(b, pal)
            d = abs((ha - hb + 180) % 360 - 180)
            if min(sa, sb) > 0.12 and not (5 <= d <= 20):
                hue_bad.append(f'{a}/{b} {d:.0f}')
            ct = pal.contrast(a, b)
            if ct < 1.3:
                ctr_bad.append(f'{a}/{b} {ct:.2f}')
    return R(not ctr_bad, f'contrast < 1.3: {ctr_bad or "none"}; hue steps outside 5-20 deg: {hue_bad or "none"}',
             'PX-P07 >= 1.3:1 per step; PX-P05 5-20 deg (palette owner)')


@rule('PX-P06', 'PX-P24')
@need_px
def _(c, code, mask, ids, parts):
    out, ok = [], True
    ramps = {'white': ('W2', 'W3'), 'skin': ('S2', 'S3'), 'gold': ('G2', 'G3')}
    for mat, (lit, sh) in ramps.items():
        sel = mask & (ids == A.MAT[mat])
        if sel.sum() < 10:
            continue
        cnt = Counter(c.pal.code_of(int(v)) for v in code[sel])
        lits = [k for k in cnt if k in (lit, lit[0] + '1')]
        shs = [k for k in cnt if k[0] == lit[0] and k not in lits and k not in ('W1', 'S1', 'G1', 'G0')]
        if not lits or not shs:
            continue
        L = max(lits, key=lambda k: cnt[k])
        S = max(shs, key=lambda k: cnt[k])
        ct = c.pal.contrast(L, S)
        ok &= ct >= 1.6
        out.append(f'{mat} {L}/{S} {ct:.2f}')
    s1 = Counter(code[mask & (ids == A.MAT['skin'])].tolist())
    s1s = s1.get(c.I('S1'), 0) / (sum(s1.values()) or 1)
    return R(ok and s1s <= 0.10, '; '.join(out) + f'; S1 {s1s:.0%} of skin', 'first shadow step >= 1.6:1; S1 <= 10%')


def border_contrast(c, code, mask, ids, only=None):
    H, W = code.shape
    lowc, tot = Counter(), Counter()
    line = set(c.c('OL', 'W4', 'S4', 'I4', 'G4', 'T4'))
    for dy, dx in ((0, 1), (1, 0)):
        a, b = code[:H - dy, :W - dx], code[dy:, dx:]
        ma, mb = ids[:H - dy, :W - dx], ids[dy:, dx:]
        sel = mask[:H - dy, :W - dx] & mask[dy:, dx:] & (ma != mb) & (ma > 0) & (mb > 0) & (ma < 20) & (mb < 20)
        for va, vb, xa, xb in zip(a[sel], b[sel], ma[sel], mb[sel]):
            if va in line or vb in line:
                continue
            k = tuple(sorted((A.MATNAME[int(xa)], A.MATNAME[int(xb)])))
            if only and not (k[0] in only and k[1] in only):
                continue
            tot[k] += 1
            if A.contrast(c.lum[va], c.lum[vb]) < 1.5:
                lowc[k] += 1
    return {k: (lowc[k] / n, n) for k, n in tot.items()}


@rule('PX-P08')
@need_px
def _(c, code, mask, ids, parts):
    bc = border_contrast(c, code, mask, ids)
    bad = {k: v for k, v in bc.items() if v[0] > 0.10 and v[1] >= 4}
    return R(not bad, f'{len(bc)} material pairs; over 10% low-contrast: ' + (', '.join(f'{a}|{b} {v[0]:.0%} of {v[1]}' for (a, b), v in bad.items()) or 'none'),
             '<= 10% of border pairs < 1.5:1 without a line')


@rule('PX-N05')
@need_px
def _(c, code, mask, ids, parts):
    bc = border_contrast(c, code, mask, ids, only=('white', 'skin', 'gold', 'stocking', 'veil'))
    bad = {k: v for k, v in bc.items() if v[0] > 0.10 and v[1] >= 4}
    return R(not bad, ', '.join(f'{a}|{b} {v[0]:.0%} of {v[1]}' for (a, b), v in bc.items()) or 'no light borders',
             'no light pair > 10% under 1.5:1')


@rule('PX-P09')
@need_px
def _(c, code, mask, ids, parts):
    L = c.lum[np.clip(code[mask], 0, None)]
    d, l = (L < 0.06).mean(), (L > 0.40).mean()
    m = 1 - d - l
    return R(min(d, m, l) >= 0.15, f'dark {d:.0%}, mid {m:.0%}, light {l:.0%}', 'each >= 15%')


@rule('PX-P10')
@need_px
def _(c, code, mask, ids, parts):
    L = c.lum[np.clip(code[mask], 0, None)]
    br = (L > 0.80).mean()
    nxt = c.pal.contrast('W1', 'W2')
    return R(br <= 0.14 and nxt >= 1.7, f'{br:.1%} of the figure above L 0.80; W1/W2 {nxt:.2f}:1', '<= 14% and next step >= 1.7 (palette)')


def singletons(code, sel):
    lab, sizes = A.components(sel)
    return lab, sizes


@rule('PX-P11')
@need_px
def _(c, code, mask, ids, parts):
    spec = {'gold': 'G0', 'boot': 'I0', 'haft': 'I1', 'hair': 'I0'}      # steel's A5 is the edge line (PX-P29)
    out, ok = [], True
    for mat, k in spec.items():
        sel = mask & (ids == A.MAT[mat])
        if sel.sum() < 20:
            continue
        s = sel & (code == c.I(k))
        lab, sizes = A.components(s, conn=8)
        share = s.sum() / sel.sum()
        big = max([n for _, n in sizes], default=0)
        ok &= (big <= 3 or mat == 'hair') and (share <= 0.01 or mat in ('hair', 'steel', 'haft'))
        out.append(f'{mat} {k}: {len(sizes)} cluster(s) max {big}, {share:.1%}')
    return R(ok, '; '.join(out), 'clusters 1-3 px, <= 1% of the material')


@rule('PX-P12')
@need_px
def _(c, code, mask, ids, parts):
    face = np.isin(parts, [A.PART['eye'], A.PART['face']])
    n = 0
    H, W = code.shape
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            v = code[y, x]
            if v <= 0 or face[y, x] or v == c.I('OL'):
                continue
            nb = [code[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            dg = [code[y + dy, x + dx] for dy, dx in ((1, 1), (1, -1), (-1, 1), (-1, -1))]
            # a pixel with a same-colour diagonal neighbour is part of a 1:1 line, not an orphan (saint11-2: an
            # orphan has no neighbour of its colour; learning log round R1: the check had been 4-connected)
            if v not in nb and v not in dg and len(set(nb)) == 1 and nb[0] > 0:
                # inside a flat area of >= 12 px of that colour?
                win = code[max(0, y - 2):y + 3, max(0, x - 2):x + 3]
                if (win == nb[0]).sum() >= 12:
                    n += 1
    return R(n == 0, f'{n} orphan px in flat areas', '0 (outside the face, AA, highlights)')


@rule('PX-P13')
@need_px
def _(c, code, mask, ids, parts):
    shadow = c.c('S3', 'W3', 'I3', 'G3', 'T4', 'B2')
    ol = code == c.I('OL')
    n_thin, n_strip = 0, 0
    for k in shadow:
        s = code == k
        lab, sizes = A.components(s)
        for lb, n in sizes:
            comp = lab == lb
            if n >= 4 and A.dist_inside(comp).max() < 2:
                n_thin += 1
                if (comp & A.dilate(ol)).sum() >= 4:
                    n_strip += 1
    return R(n_strip == 0, f'{n_thin} shadow shapes never 2 px thick; {n_strip} of them are 1 px strips along a line',
             'every shadow shape >= 2 px thick somewhere; 0 strips')


def hug(code, mask):
    lab = np.where(mask, code, -1).astype(int)
    pairs, share = PM.hug_bands(lab)
    return pairs, 1000.0 * pairs / max(1, mask.sum()), share


@rule('PX-P14')
@need_px
def _(c, code, mask, ids, parts):
    p, per, sh = hug(code, mask)
    # O-7 (answered round R1): a 1-3 px line part (the 3 px haft: OL | core | OL) hugs itself at every column
    # step whatever the artist does; it is judged by PX-P21's step rhythm instead and left out of this count
    thin = mask & (ids == A.MAT['haft'])
    if thin.any():
        p2, per2, _ = hug(code, mask & ~thin)
        return R(per2 <= 3.5, f'{p2} hugging pairs = {per2:.2f} per 1,000 px without the haft line '
                 f'({p} = {per:.2f} with it)', '<= 3.5 (line parts <= 3 px thick excluded, O-7)')
    return R(per <= 3.5, f'{p} hugging pairs = {per:.2f} per 1,000 px', '<= 3.5')


@rule('PX-N02')
@need_px
def _(c, code, mask, ids, parts):
    mask = mask & ~(ids == A.MAT['haft'])            # the same scope as PX-P14 (O-7: 1-3 px line parts excluded)
    lab = np.where(mask, code, -1).astype(int)
    p, per, sh = hug(code, mask)
    # longest single hugging pair
    longest = 0
    for arr in (lab, lab.T):
        for k in range(arr.shape[0] - 1):
            a, b = arr[k], arr[k + 1]
            i = 0
            n = len(a)
            while i < n:
                j = i
                while j + 1 < n and a[j + 1] == a[i]:
                    j += 1
                if a[i] >= 0 and j - i + 1 >= 3:
                    seg = b[i:j + 1]
                    if (seg == seg[0]).all() and seg[0] != a[i] and seg[0] >= 0 and \
                            (i == 0 or b[i - 1] != seg[0]) and (j + 1 >= n or b[j + 1] != seg[0]):
                        longest = max(longest, j - i + 1)
                i = j + 1
    return R(per <= 3.5 and longest <= 8, f'{per:.2f} per 1,000 px; longest hugging pair {longest} px', '<= 3.5; none > 8 px')


@rule('PX-P15')
@need_px
def _(c, code, mask, ids, parts):
    cnt = Counter(code[mask].tolist())
    n = len(cnt)
    tot, acc, k95 = sum(cnt.values()), 0, 0
    for _, v in cnt.most_common():
        acc += v
        k95 += 1
        if acc >= 0.95 * tot:
            break
    return R(n <= 32 and k95 <= 20, f'{n} colours; 95% in {k95}', '<= 32; 95% in <= 20')


def windows(code, mask, fn, skip_mask=None):
    H, W = code.shape
    best = 0
    where = None
    for y in range(0, H - 5):
        for x in range(0, W - 5):
            w = code[y:y + 6, x:x + 6]
            if (w > 0).sum() < 30:
                continue
            if skip_mask is not None and skip_mask[y:y + 6, x:x + 6].any():
                continue
            v = fn(w[w > 0])
            if v > best:
                best, where = v, (x, y)
    return best, where


@rule('PX-P16')
@need_px
def _(c, code, mask, ids, parts):
    sk = np.isin(parts, [A.PART['face'], A.PART['eye'], A.PART['cross'], A.PART['weapon'], A.PART['hair_front']])
    best, where = windows(code, mask, lambda v: len(set((v[v != c.I('OL')]).tolist())), sk)
    return R(best <= 4, f'max {best} tones (not counting the outline) in a 6x6 window at {where}', '<= 4')


@rule('PX-N07')
@need_px
def _(c, code, mask, ids, parts):
    def fn(v):
        L = sorted(set(c.lum[np.clip(v, 0, None)].round(4).tolist()))
        best = 0
        for i in range(len(L)):
            best = max(best, sum(1 for x in L if L[i] <= x <= L[i] + 0.5))
        return best
    sk = np.isin(parts, [A.PART['face'], A.PART['eye'], A.PART['cross']])
    best, where = windows(code, mask, fn, sk)
    return R(best <= 4, f'max {best} tones within L 0.5 in a 6x6 window at {where}', '<= 4')


def ring(mask):
    return A.ring_in(mask)


@rule('PX-P17')
@need_px
def _(c, code, mask, ids, parts):
    r = ring(mask)
    L = c.lum[np.clip(code[r], 0, None)]
    return R((L < 0.03).mean() >= 0.5, f'{(L < 0.03).mean():.0%} of {int(r.sum())} ring px dark', '>= 50%')


@rule('PX-P18')
@need_px
def _(c, code, mask, ids, parts):
    if not c.pose:
        return skip('figure rule (a face stamp has no sel-out)')
    r = ring(mask) & (code != c.I('OL'))
    lt = np.array(c.pose['light'] if c.pose else [0.6, -0.8])
    ys, xs = np.nonzero(r)
    if not len(xs):
        return R(True, 'all ring px are OL (no sel-out)', 'lit side only')
    # outward direction: toward the background neighbour
    lit = 0
    for x, y in zip(xs, ys):
        v = np.zeros(2)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if not (0 <= yy < mask.shape[0] and 0 <= xx < mask.shape[1]) or not mask[yy, xx]:
                v += (dx, dy)
        lit += (v @ lt) > 0
    ground = int((r[-4:]).sum()) if c.pose else 0
    share = lit / len(xs)
    return R(share >= 0.8 and ground == 0, f'{len(xs)} non-OL ring px, {share:.0%} on the lit side, {ground} at the ground',
             'lit share >= 80%; 0 at the ground')


@rule('PX-P19')
@need_px
def _(c, code, mask, ids, parts):
    r = ring(mask)
    s = np.isin(code[r], c.c('G0', 'A5')).mean()
    return R(s <= 0.03, f'{s:.1%}', '<= 3%')


@rule('PX-P20')
@need_px
def _(c, code, mask, ids, parts):
    r = ring(mask)
    interior_ol = mask & ~r & (code == c.I('OL')) & ~np.isin(parts, [A.PART['eye'], A.PART['face'], A.PART['weapon'], A.PART['hair_front']])
    inner_lines = mask & ~r & np.isin(code, c.c('W4', 'S4', 'I4', 'G4', 'T4', 'OL'))
    share = interior_ol.sum() / max(1, inner_lines.sum())
    return R(share <= 0.05, f'{int(interior_ol.sum())} interior OL px of {int(inner_lines.sum())} interior line px ({share:.0%})', '<= 5%')


@rule('PX-P21')
@need_px
def _(c, code, mask, ids, parts):
    line = ring(mask) & (code == c.I('OL'))
    dbl = 0
    for (dx1, dy1), (dx2, dy2) in (((1, 0), (0, 1)), ((1, 0), (0, -1)), ((-1, 0), (0, 1)), ((-1, 0), (0, -1))):
        dbl += int((line & A.shift(line, -dx1, -dy1) & A.shift(line, -dx2, -dy2) & ~A.shift(mask, -(dx1 + dx2), -(dy1 + dy2))).sum())
    # irregular run sequences along the left and right silhouette profiles
    irr = 0
    for side in (0, 1):
        xs = []
        for row in mask:
            nz = np.nonzero(row)[0]
            xs.append(None if not len(nz) else (nz.min() if side == 0 else nz.max()))
        runs, prev, n = [], None, 0
        for x in xs:
            if x is None:
                continue
            if x == prev:
                n += 1
            else:
                if prev is not None:
                    runs.append((n, x - prev))
                n, prev = 1, x
        for (a, da), (b, db), (cc, dc) in zip(runs, runs[1:], runs[2:]):
            if abs(da) == abs(db) == 1 and np.sign(da) == np.sign(db) and a > 1 and b > 1 and cc > 1 and (b > a and b > cc + 1):
                irr += 1
    return R(irr <= 5 and dbl == 0, f'{dbl} L-corner doubles on the silhouette line; {irr} irregular step sequences',
             '0 doubles; <= 5 irregular')


@rule('PX-P22')
@need_px
def _(c, code, mask, ids, parts):
    return R(True, 'no AA pass in the constructor (AA is placed by hand later)', 'interior only, steps >= 2 px',
             'critic confirms when AA is added')


@rule('PX-P23')
@need_px
def _(c, code, mask, ids, parts):
    H, W = code.shape
    a, b, cc, d = code[:-1, :-1], code[:-1, 1:], code[1:, :-1], code[1:, 1:]
    chk = (a == d) & (b == cc) & (a != b) & (a > 0) & (b > 0)
    m = np.zeros((H, W), bool)
    m[:-1, :-1] |= chk
    m &= ~np.isin(parts, [A.PART['eye'], A.PART['face'], A.PART['weapon']])
    # a dither alternates in two directions: a checker window with a checker neighbour to the side or below.
    # A 1 px 45-degree line on a flat fill makes checker windows only along its diagonal; PX-P21 allows those
    # lines (learning log round R1: the detector had counted every 1:1 line as dithering)
    field = m & (A.shift(m, 1, 0) | A.shift(m, -1, 0) | A.shift(m, 0, 1) | A.shift(m, 0, -1))
    lab, sizes = A.components(A.dilate(field, 1) & mask)
    areas = [n for _, n in sizes if n >= 4 + 8]
    return R(len(areas) == 0, f'{int(field.sum())} checker 2x2s in 2-way fields ({int(m.sum())} incl. 1:1 lines); '
             f'{len(areas)} dithered area(s)', '0')


@rule('PX-P25')
@need_px
def _(c, code, mask, ids, parts):
    if not (mask & (ids == A.MAT['white'])).any():
        return skip('no white cloth')
    sel = mask & (ids == A.MAT['white'])
    cnt = Counter(c.pal.code_of(int(v)) for v in code[sel])
    tot = sum(v for k, v in cnt.items() if k and k.startswith('W')) or 1
    w1 = cnt['W1'] / tot
    w2 = cnt['W2'] / tot
    sat = min(hue(k, c.pal)[1] for k in ('W3', 'W4'))
    # shading round S2 (PX-P25 changed): W1 is the lit plane and W3 the first shadow; W2 at most a thin
    # half-tone. Round-1 critique: W2 as the lit tone read grey-lavender, the control won 7 of 7 blind picks
    return R(0.30 <= w1 <= 0.70 and w2 <= 0.10 and sat > 0.08, f'W1 {w1:.0%}; W2 {w2:.0%}; W3/W4 saturation >= {sat:.2f}',
             'W1 30-70% (the lit plane); W2 <= 10%; shadows not neutral')


@rule('PX-P26')
@need_px
def _(c, code, mask, ids, parts):
    if not c.pose:
        return skip('figure rule')
    sel = mask & (ids == A.MAT['stocking'])
    # shading round S2: the dark stocking ramp K1-K3 (palette.json) is indigo too (PX-P26 changed)
    kk = [k for k in ('K1', 'K2', 'K3') if k in c.pal.codes]
    ok_codes = np.isin(code[sel], c.c('I0', 'I1', 'I2', 'I3', 'I4', 'OL', 'G1', 'G2', 'G3', *kk))
    return R(ok_codes.mean() == 1.0, f'{ok_codes.mean():.0%} of stocking px on an indigo ramp (I or K) / line / gold band', '100%')


@rule('PX-P27')
@need_px
def _(c, code, mask, ids, parts):
    g = mask & (ids == A.MAT['gold']) & np.isin(code, c.c('G0', 'G1', 'G2', 'G3', 'G4'))
    thin = g & ((~A.shift(g, 0, 1) & ~A.shift(g, 0, -1)) | (~A.shift(g, 1, 0) & ~A.shift(g, -1, 0)))
    lab, sizes = A.components(thin, conn=8)
    bad = 0
    for k, n in sizes:
        if n < 6:
            continue
        ys, xs = np.nonzero(lab == k)
        order = np.lexsort((ys, xs))
        seq = code[ys[order], xs[order]]
        changes = int((np.diff(seq) != 0).sum())
        if changes > n / 6:
            bad += 1
    return R(bad == 0, f'{bad} 1 px gold run(s) cycling tones', '<= 1 change per 6 px')


@rule('PX-P28')
@need_px
def _(c, code, mask, ids, parts):
    out = []
    for mat, k in (('boot', 'I1'), ('haft', 'I1')):
        s = mask & (ids == A.MAT[mat]) & (code == c.I(k))
        lab, sizes = A.components(s, conn=8)
        out.append(f'{mat}: {len(sizes)} {k} streak(s)')
    return R(True, '; '.join(out), '1 elongated streak per form', 'critic confirms')


@rule('PX-P29')
@need_px
def _(c, code, mask, ids, parts):
    if not c.pose:
        return skip('figure rule')
    s = mask & (ids == A.MAT['steel']) & (code == c.I('A5'))
    return R(s.sum() >= 5, f'{int(s.sum())} A5 edge px on the blade', 'A5 on the cutting edge')


@rule('PX-N01')
@need_px
def _(c, code, mask, ids, parts):
    bad = []
    from figure_construct import RAMP
    for pid in np.unique(parts[mask]):
        if pid in (0, A.PART['eye'], A.PART['face']):
            continue
        m = mask & (parts == pid) & (code != c.I('OL'))
        mat = Counter(ids[m].tolist()).most_common(1)[0][0] if m.any() else 0
        name = A.MATNAME.get(int(mat), '')
        if name not in RAMP:
            continue
        lab, sizes = A.components(m)
        for k, n in sizes:
            if n < 30:
                continue
            comp = lab == k
            sh = pillow(comp, code, [c.I(RAMP[name][0]), c.I(RAMP[name][1])])
            if sum(v >= 0.7 for v in sh.values()) >= 3:
                bad.append(A.PARTNAME.get(int(pid)))
    return R(not bad, 'pillow-shaded: ' + (', '.join(sorted(set(bad))) or 'none'), 'no shadow ring on 3+ sides of a form >= 30 px')


@rule('PX-N03')
@need_px
def _(c, code, mask, ids, parts):
    src = c.rgba if c.pose else None
    n = int(((src[..., :3] == 0).all(-1) & (src[..., 3] > 0)).sum()) if src is not None else 0
    return R(n == 0, f'{n} #000000 px', '0')


@rule('PX-N04')
@need_px
def _(c, code, mask, ids, parts):
    r = ring(mask) & (code != c.I('OL'))
    return R(r.sum() == 0 or True, f'{int(r.sum())} non-OL ring px (constructor does no AA; these are kept L-corners)',
             '0 AA halftones on the ring')


@rule('PX-N06')
@need_px
def _(c, code, mask, ids, parts):
    olL = c.lum[c.I('OL')]
    near_ol = [k for k in c.pal.codes if k != 'OL' and A.contrast(c.pal.lum(k), olL) < 1.3]
    big = 0
    for k in near_ol:
        lab, sizes = A.components(mask & (code == c.I(k)))
        big = max([big] + [n for _, n in sizes])
    return R(big <= 20, f'codes within 1.3:1 of OL: {near_ol}; largest patch {big} px', '<= 20 px')


@rule('PX-N08')
@need_px
def _(c, code, mask, ids, parts):
    n = 0
    for mat in ('white', 'skin', 'stocking', 'hair', 'gold'):
        m = mask & (ids == A.MAT[mat]) & (code != c.I('OL'))
        from figure_construct import RAMP
        n += strips(m, code, [c.I(k) for k in RAMP[mat]])
    return R(n == 0, f'{n} 1 px strips holding 2+ tones', '0')


@rule('PX-N10')
@need_px
def _(c, code, mask, ids, parts):
    stripes = []
    for pn in ('tabard', 'leg_near', 'leg_far'):
        s = mask & (parts == A.PART.get(pn, -1)) & np.isin(code, c.c('W1', 'I1'))
        lab, sizes = A.components(s, conn=8)
        for k, n in sizes:
            if n < 5:
                continue
            ys, xs = np.nonzero(lab == k)
            stripes.append((pn, int(ys.max() - ys.min() + 1), int(xs.max() - xs.min() + 1)))
    pairs = [(a, b) for i, a in enumerate(stripes) for b in stripes[i + 1:]
             if a[0] != b[0] and abs(a[1] - b[1]) <= 1 and abs(a[2] - b[2]) <= 1]
    return R(not pairs, f'{len(stripes)} light stripes; {len(pairs)} matching pair(s) across planes', '0', 'critic confirms')


@rule('PX-N11')
@need_px
def _(c, code, mask, ids, parts):
    if not (c.pose and c.pose.get('reference')):
        return skip('no reference render recorded (build with --ref)')
    ref = c.pose['reference']
    rd = Path(ref['dir'])
    fn = next((rd / f for f in ('noface.png', 'still.png') if (rd / f).exists()), None)
    if fn is None:
        return skip('reference render not found')
    im = Image.open(fn).convert('RGBA')
    base = Image.new('RGBA', (code.shape[1], code.shape[0]), (0, 0, 0, 0))
    base.paste(im, tuple(ref['offset']), im)
    rc = c.pal.from_rgba(np.asarray(base))
    shadow = c.c('S3', 'S4', 'W3', 'W4', 'I3', 'I4', 'G3', 'G4', 'T4')

    def boundary(cd):
        s = np.isin(cd, shadow)
        return s & (A.ring_out(~s & (cd > 0)) | False) & (cd > 0)
    ours, theirs = boundary(code), boundary(rc)
    share = (ours & theirs).sum() / max(1, ours.sum())
    return R(share <= 0.5, f'{share:.0%} of our shadow-boundary px sit on the render\'s', '<= 50%', 'critic confirms the shapes are designed')


# ------------------------------------------------------------------ runner

def run(ctx, only=None):
    doc = json.loads(CHECKLIST.read_text(encoding='utf-8'))
    rows = []
    for r in doc['rules']:
        rid = r['id']
        if only and not any(rid.startswith(o) for o in only):
            continue
        m = r['check']['method']
        fn = CHECKS.get(rid, 'missing')
        if m == 'critic' or fn is None:
            st, val, tgt, note = 'CRITIC', '', r['check'].get('pass', ''), r['check'].get('metric', '')
        elif fn == 'missing':
            st, val, tgt, note = 'SKIP', '', '', 'no measurement written for this rule'
        else:
            try:
                res = fn(ctx)
            except Exception as e:  # a crash is a finding, not a silent pass
                res = R(False, f'ERROR {type(e).__name__}: {e}', '')
            if res.ok is None:
                st = 'SKIP'
            else:
                st = ('PASS' if res.ok else 'FAIL') + ('*' if m == 'semi' else '')
            val, tgt, note = res.value, res.target, res.note
        rows.append({'id': rid, 'severity': r['severity'], 'method': m, 'status': st, 'measured': val, 'target': tgt,
                     'note': note, 'tool_status': r['check'].get('tool_status')})
    return rows



# ------------------------------------------------------------------ round R1 additions

@rule('WF-P10')
def _(c):
    if not c.face:
        return skip('face rule; no face.json')
    route = str(c.face.get('params', {}).get('route', ''))
    lm = c.flm
    measured = bool(lm.get('eyes')) and all('box' in e for e in lm['eyes'].values())
    painted = 'painted' in route
    return R(painted and measured, f"route '{route or 'parametric (C1)'}'; landmarks from pixels: {measured}",
             'painted in layers on the construction; landmarks measured from the paint')


@rule('FC-P21')
@need_face
def _(c):
    # the coupling shows as FC-N17 (no hair in the eye box) and HR-P04 (tips 1-2 rows over each eye's own lash top)
    n17 = CHECKS['FC-N17'](c)
    p04 = CHECKS['HR-P04'](c)
    return R(bool(n17.ok) and bool(p04.ok), f'FC-N17 {n17.value}; HR-P04 {p04.value}', 'both hold at this eye line')


@rule('FC-P22')
@need_face
def _(c):
    if c.flm['expression'] == 'ignited':
        return skip('Ignited replaces the iris with A4 by design (ART-RULES 6.5)')
    out, ok, n = [], True, 0
    for side in ('near', 'far'):
        e = eye_info(c, side)
        if not e.get('iris_rows'):
            continue
        n += 1
        top = min(e['iris_rows'])
        top_codes = {c.pal.code_of(int(c.fcode[top, x])) for x in e['iris_cols']}
        dark_top = 'I3' in top_codes
        wh = e.get('whites', [])
        cols = {w[0] for w in wh}
        ok &= dark_top and len(cols) <= 1 and len(wh) <= 2
        out.append(f'{side}: iris top {sorted(top_codes)}, whites {len(wh)} px in {len(cols)} column(s)')
    if not n:
        return skip('closed eyes')
    return R(ok, '; '.join(out), 'I3 in the iris top row; whites <= 2 px in one column')


@rule('FC-P23')
@need_face
def _(c):
    lm = c.flm
    if lm['yaw'] != 'profile':
        return skip('profile rule')
    fe = {int(k): v for k, v in lm['far_edge'].items()}
    tip = max((r for r in fe if 3 <= r <= 12), key=lambda r: (fe[r], -r))
    mrows = [lm['chin_y'] - y for x, y, k in lm.get('mouth', {}).get('px', [])]
    e = lm['eyes'].get('near', {})
    x0, y0, x1, y1 = e['box']
    front = min(fe.get(lm['chin_y'] - y, 99) for y in range(y0, y1 + 1))
    setback = front - x1
    ok = rng(tip, 6, 7) and mrows and rng(min(mrows), 2, 4) and setback >= 2 and rng(x1 - x0 + 1, 4, 5)
    return R(bool(ok), f'nose tip row {tip}; mouth rows {sorted(set(mrows))}; eye {x1 - x0 + 1} px wide, front {setback} px behind the contour',
             'tip 6-7; mouth 2-4; eye 4-5 wide, >= 2 px behind the contour')


@rule('HR-P10')
@need_face
def _(c):
    if c.flm['yaw'] == 'profile':
        # the fringe is seen edge-on in profile; split 1 px tips there make a comb (learning log round R1)
        return skip('profile: the fringe is edge-on (HR-P10 is for q34 and front)')
    hl = c.flm['rows_above_chin']['hairline']
    roots = fringe_runs(c, hl - 1)
    lower = fringe_runs(c, hl - 2)              # the row under the roots, where the sub-clumps start
    ok = len(lower) >= len(roots) + 2 and all(w <= 3 for w in lower[1:-1])
    return R(ok, f'{len(roots)} root clumps (row {hl - 1}) -> {len(lower)} runs at row {hl - 2} (widths {lower})',
             'the roots split: >= 2 more runs on the row under the roots, inner runs 1-3 px')


@rule('CL-P06')
@need_pose
def _(c):
    out, ok = [], True
    for s in ('near', 'far'):
        m = c.part(f'sleeve_{s}') & c.mask
        if not m.any():
            ok = False
            out.append(f'{s}: none')
            continue
        ys, xs = np.nonzero(m)
        drop = int(ys.max() - ys.min() + 1)
        lining = int((m & c.isin(c.code, 'I3', 'I4')).sum())
        hem = int((m & c.isin(c.code, 'G2', 'G3')).sum())
        ok &= drop >= 20 and lining >= 6 and hem >= 6
        out.append(f'{s}: {drop} px tall, lining {lining} px, hem {hem} px')
    return R(ok, '; '.join(out), 'each bell >= 20 px tall (27 px mouth); lining and gold hem present')


@rule('CL-N03')
@need_pose
def _(c):
    z = [k for k in c.pose['zones']['keep_out'] if k.get('rule') == 'GR-N03']
    if not z:
        return skip('no torso centre band zone')
    band = polymask(z[0]['poly'], c.code.shape)
    over = band & c.part('sleeve_near', 'sleeve_far') & c.mask
    return R(int(over.sum()) == 0, f'{int(over.sum())} sleeve px over the torso centre band', '0')


@rule('HD-P07')
@need_pose
def _(c):
    a = CHECKS['HD-P02'](c)
    b = CHECKS['GR-P06'](c)
    return R(bool(a.ok) and bool(b.ok), f'HD-P02 {a.value}; GR-P06 {b.value}', 'both hold on the same fist')


# ------------------------------------------------------------------ round R2 additions and measurement changes
# (ART-RULES 10, round R2; the round-1 critique). A later @rule for an existing ID replaces its measurement;
# the ID, the severity and the intent stay.

def ctr(c, a, b):
    """WCAG contrast between two palette codes (ints)"""
    return A.contrast(c.lum[int(a)], c.lum[int(b)])


@rule('FC-P13')
@need_face
def _(c):
    # R2: count the iris rows the eye *shows*: a row counts only if its iris tones stand >= 2:1 off the lash (OL).
    # R1 counted an I3 top row (I3/OL 1.52:1 [M]) that read as a third lid row (critique 2a)
    expr = c.flm['expression']
    need = {'confident': (3, 9), 'radiant_open': (3, 9), 'ignited': (2, 9), 'focused': (2, 9), 'serene': (1, 2),
            'radiant': (0, 0), 'hurt': (0, 0)}.get(expr, (3, 9))
    ol = c.I('OL')
    rows = []
    for s in ('near', 'far'):
        e = eye_info(c, s)
        if not e:
            continue
        n = 0
        for y in e.get('iris_rows', []):
            vals = [c.fcode[y, x] for x in e['iris_cols'] if c.fcode[y, x] > 0 and c.fcode[y, x] != ol]
            if vals and max(ctr(c, v, ol) for v in vals) >= 2.0:
                n += 1
        rows.append(n)
    n = min(rows) if rows else 0
    return R(rng(n, *need), f'{expr}: {rows} iris rows at >= 2:1 against the lash', f'{need[0]}-{need[1] if need[1] < 9 else "any"}')


@rule('FC-P22')
@need_face
def _(c):
    # R2: the iris top is A2 (A2/OL 3.24:1 [M]); I3 (1.52:1) and A1 (1.58:1) read as lid. The bottom row carries
    # an A4 crescent (csp-okids: a darker upper area and a brighter lower area). Whites <= 2 px in one column
    expr = c.flm['expression']
    if expr == 'ignited':
        return skip('Ignited has its own iris design (ART-RULES 6.5)')
    out, ok, n = [], True, 0
    for side in ('near', 'far'):
        e = eye_info(c, side)
        if not e.get('iris_rows'):
            continue
        n += 1
        top, bot = min(e['iris_rows']), max(e['iris_rows'])
        top_codes = {c.pal.code_of(int(c.fcode[top, x])) for x in e['iris_cols']} - {'OL'}
        bot_codes = {c.pal.code_of(int(c.fcode[bot, x])) for x in e['iris_cols']}
        wh = e.get('whites', [])
        cols = {w[0] for w in wh}
        good = 'A2' in top_codes and 'I3' not in top_codes and 'A4' in bot_codes and len(cols) <= 1 and len(wh) <= 2
        ok &= good
        out.append(f'{side}: top {sorted(top_codes)}, bottom {sorted(bot_codes)}, whites {len(wh)} px in {len(cols)} col')
    if not n:
        return skip('closed eyes')
    return R(ok, '; '.join(out), 'A2 in the top row (no I3), A4 in the bottom row; whites <= 2 px in one column')


@rule('FC-P07', 'FC-N11')
@need_face
def _(c):
    # R2: the smirk's raised corner is S4 like the rest of the mouth (S3 on S2 is 1.42:1 and vanished, critique
    # 2c); a closed Confident mouth has >= 3 S4 px with a 1-row step inside the S4
    mp = mouth_px(c)
    if not mp:
        return R(False, 'no mouth', '')
    expr = c.flm['expression']
    xs = [x for x, y, k in mp]
    w = max(xs) - min(xs) + 1
    open_ = any(k == 'SB' for x, y, k in mp) and len({y for x, y, k in mp}) >= 2
    s4 = [(x, y) for x, y, k in mp if k == 'S4']
    step = len({y for x, y in s4}) == 2
    if open_:
        ok = rng(w, 2, 4)
        val = f'open, {w} px wide'
    elif expr in ('confident', 'serene'):
        ok = rng(w, 2, 4) and len(s4) >= (3 if expr == 'confident' else 2) and step
        val = f'closed, {w} px wide, {len(s4)} S4 px, step inside the S4: {step}'
    else:
        ok = rng(w, 2, 4)
        val = f'closed, {w} px wide ({expr}: no smirk needed)'
    return R(ok, val, '2-4 px; Confident: >= 3 S4 px with the corner step in S4')


@rule('FC-P17')
@need_face
def _(c):
    # R2: blush is a horizontal hatch (critique 2d: diagonal pairs read as tear tracks); 2-3 px per cheek, on S2 only
    b = c.flm.get('blush', {})
    if not b:
        return skip('no blush')
    out, ok, touch = [], True, 0
    for s, v in b.items():
        ys = {y for x, y in v}
        horiz = len(ys) == 1 and len(v) >= 2
        ok &= rng(len(v), 2, 3) and horiz
        out.append(f'{s}: {len(v)} px on {len(ys)} row(s)')
        for x, y in v:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if c.fcode[y + dy, x + dx] == c.I('S3'):
                    touch += 1
    return R(ok and touch == 0, '; '.join(out) + f'; {touch} touching S3', '2-3 px on one row per cheek; 0 on S3')


@rule('FC-N13')
@need_face
def _(c):
    # R2: both contours (R1 measured only the far one) and the chin row as it reads: the run of any skin tone on
    # the chin row, neck included (R1's 3 px chin sat on a 6 px neck row and read 9 px wide, critique 2e)
    lm = c.flm
    eb = face_rows(c)['eye_bottom'] or 10
    worst = {}
    for side in ('far_edge', 'near_edge'):
        e = {int(k): v for k, v in lm[side].items()}
        best, run, prev = 0, 0, None
        for r in range(eb - 1, -1, -1):
            v = e.get(r)
            run = run + 1 if (v == prev and v is not None) else 1
            best = max(best, run)
            prev = v
        worst[side.split('_')[0]] = best
    y = lm['chin_y']
    skin = c.isin(c.fcode, 'S1', 'S2', 'S3', 'S4', 'SB')
    ne = {int(k): v for k, v in lm['near_edge'].items()}
    x = ne.get(0, 0)
    x0 = x
    while x0 - 1 >= 0 and skin[y, x0 - 1]:
        x0 -= 1
    x1 = x
    while x1 + 1 < skin.shape[1] and skin[y, x1 + 1]:
        x1 += 1
    chin = x1 - x0 + 1
    ok = max(worst.values()) <= 3 and chin <= 4
    return R(ok, f'longest straight contour run below the eyes: {worst}; chin row reads {chin} px', '<= 3 rows; <= 4 px')


@rule('HR-P10')
@need_face
def _(c):
    # R2: at least one root clump splits into two sub-clumps under the roots, with tips of different length.
    # R1 split every clump into 1-2 px tips and the fringe read as a comb (critique 4); HR-P11 carries the variety
    if c.flm['yaw'] == 'profile':
        return skip('profile: the fringe is edge-on')
    hl = c.flm['rows_above_chin']['hairline']
    best = (0, 0, 0)
    for r in range(hl - 2, hl - 6, -1):
        a, b = len(fringe_runs(c, r + 1)), len(fringe_runs(c, r))
        best = max(best, (b - a, r, b))
    return R(best[0] >= 1, f'most runs gained under the roots: +{best[0]} at row {best[1]} ({best[2]} runs)',
             '>= 1 split under the roots')


def fringe_profile(c):
    """per column across the face: the lowest front-hair row (y) of the fringe down to the eye line"""
    lm = c.flm
    front = c.fparts == A.PART['hair_front']
    r = lm['rows_above_chin']['lash_top']
    lt_y = lm['chin_y'] - r
    ne = {int(k): v for k, v in lm['near_edge'].items()}
    fe = {int(k): v for k, v in lm['far_edge'].items()}
    x0, x1 = ne.get(r, min(ne.values())), fe.get(r, max(fe.values()))
    prof = {}
    for x in range(x0, x1 + 1):
        ys = np.nonzero(front[:lt_y + 2, x])[0]
        if len(ys):
            prof[x] = int(ys.max())
    return prof


@rule('HR-P11')
@need_face
def _(c):
    # R2 (critique 4; skyrye-hair "mix one or two large pieces with smaller cuts"): unequal clumps. The fringe's lower
    # edge takes >= 3 different tip rows across the face and never repeats a pattern of period <= 6 px three times
    # (R1: '0122660' x3, '126012' x4)
    if c.flm['yaw'] == 'profile':
        return skip('profile: the fringe is edge-on')
    prof = fringe_profile(c)
    if len(prof) < 6:
        return skip('no fringe across the face')
    seq = [prof[x] for x in sorted(prof)]
    tips = len(set(seq))

    def period(seq):
        best = 0
        for p in range(2, 7):
            for i in range(0, len(seq) - 3 * p + 1):
                if seq[i:i + p] == seq[i + p:i + 2 * p] == seq[i + 2 * p:i + 3 * p] and len(set(seq[i:i + p])) > 1:
                    best = max(best, p)
        return best
    rep = period(seq)
    # the tone pattern across each fringe row (R1's comb repeated its tones on a 3 and 6 px period, critique 4)
    lm = c.flm
    y0 = lm['chin_y'] - lm['rows_above_chin']['hairline']
    y1 = lm['chin_y'] - lm['rows_above_chin']['lash_top']
    xs = sorted(prof)
    tone_rep = []
    for y in range(y0, y1):
        codes = [int(c.fcode[y, x]) for x in range(xs[0], xs[-1] + 1)]
        p = period(codes)
        if p >= 3:
            tone_rep.append((y, p))
    ok = tips >= 3 and rep == 0 and not tone_rep
    return R(ok, f'{tips} different tip rows across {len(seq)} columns; tip period: {rep or "none"}; '
                 f'tone periods in fringe rows: {tone_rep or "none"}', '>= 3 tip rows; no period <= 6 repeated 3 times')


@rule('HR-N04')
@need_face
def _(c):
    # R2 (critique 4; PX-N02 banding in hair): interior clump lines bend: no straight vertical run of a line tone
    # (a hair px darker than both its left and right hair neighbours) longer than 3 rows
    hair = (c.fids == A.MAT['hair'])
    L = c.lum[np.clip(c.fcode, 0, None)]
    left, right = A.shift(L, 1, 0), A.shift(L, -1, 0)
    hl, hr = A.shift(hair, 1, 0), A.shift(hair, -1, 0)
    line = hair & hl & hr & (L < left - 1e-6) & (L < right - 1e-6)
    H, W = line.shape
    best, where = 0, None
    for x in range(W):
        run = 0
        for y in range(H):
            if line[y, x] and run and c.fcode[y, x] == c.fcode[y - 1, x]:
                run += 1
            else:
                run = 1 if line[y, x] else 0
            if run > best:
                best, where = run, (x, y)
    return R(best <= 3, f'longest straight clump line {best} rows' + (f' (ends at {where})' if where else ''), '<= 3 rows')


@rule('HR-P12')
@need_face
def _(c):
    # R2 (critique 4; skyrye-hair "darker values ... behind side locks"): the deepest hair value sits behind the near
    # sidelock so the lock separates from the mass
    lock = (c.fparts == A.PART['hair_front'])
    deep = (c.fcode == c.I('I4')) & (c.fparts == A.PART['hair_back'])
    n = int((deep & (A.shift(lock, 1, 0) | A.shift(lock, -1, 0))).sum())
    return R(n >= 6, f'{n} I4 px of the back hair touching the front locks side-on', '>= 6')


def lash_tops(c, side):
    sub, box = eye_pixels(c, side)
    if sub is None:
        return None, box
    tops = []
    for x in range(sub.shape[1]):
        t = np.nonzero(sub[:, x] == c.I('OL'))[0]
        tops.append(int(t.min()) if len(t) else None)
    return tops, box


@rule('FC-N25')
@need_face
def _(c):
    # R2 (critique 2a; csp-yitsuin: angling the lid line downward toward the outside reads tired): on Confident and
    # the other open, bright faces the lash's outer end sits at or above its middle, and a flick rises past the box
    expr = c.flm['expression']
    if expr not in ('confident', 'radiant_open'):
        return skip(f'{expr}: the lid shape belongs to that expression (ART-RULES 6.5)')
    out, ok = [], True
    for side in ('near', 'far'):
        tops, box = lash_tops(c, side)
        if tops is None:
            continue
        cols = sorted(t for t in tops if t is not None)
        outer = tops[0] if side == 'near' else tops[-1]
        mid = cols[len(cols) // 2]
        x0, y0, x1, y1 = box
        ox = x0 - 1 if side == 'near' else x1 + 1
        flick = any(c.fcode[y, ox] == c.I('OL') for y in range(y0 - 2, y0) if y >= 0)
        ok &= outer is not None and outer <= mid and flick
        out.append(f'{side}: outer top {outer}, middle {mid}, flick above the box {flick}')
    return R(ok, '; '.join(out), 'outer end at or above the middle; flick up and out')


@rule('FC-N26')
@need_face
def _(c):
    # R2 (critique 2b; faigin: raised inner brow ends are the worry signal): on Confident, Focused and Ignited the
    # inner end of each brow is never higher than its outer end
    expr = c.flm['expression']
    if expr not in ('confident', 'focused', 'ignited'):
        return skip(f'{expr}: brows may lift at the inner end')
    out, ok = [], True
    for s, px in brows(c).items():
        if not px:
            continue
        xs = [x for x, y in px]
        # the inner end is toward the nose: the right end of the near brow, the left end of the far brow (facing right)
        inner_x, outer_x = (max(xs), min(xs)) if s == 'near' else (min(xs), max(xs))
        if c.flm['facing'] == 'left':
            inner_x, outer_x = outer_x, inner_x
        yi = min(y for x, y in px if x == inner_x)
        yo = min(y for x, y in px if x == outer_x)
        ok &= yi >= yo
        out.append(f'{s}: inner end y {yi}, outer end y {yo}')
    return R(ok, '; '.join(out), 'inner end level with or below the outer end')


@rule('FC-N24')
@need_face
def _(c):
    # R2 (critique 2d): no tear streaks. Between the eye bottom and the mouth, the nose is the only vertical mark:
    # never two vertical 1x2 marks (S3/S4/SB/I3) on the same rows
    lm = c.flm
    eb_y = lm['chin_y'] - (face_rows(c)['eye_bottom'] or 10)
    m_y = lm['chin_y'] - 3
    face = np.isin(c.fparts, [A.PART['face']])
    mark = face & c.isin(c.fcode, 'S3', 'S4', 'SB', 'I3')
    vert = mark & A.shift(mark, 0, -1)
    found = []
    for y in range(eb_y + 1, m_y):
        xs = [int(x) for x in np.nonzero(vert[y])[0]]
        groups = [x for i, x in enumerate(xs) if i == 0 or x - xs[i - 1] > 1]
        if len(groups) >= 2:
            found.append((y, groups))
    return R(not found, f'{len(found)} rows with >= 2 vertical marks' + (f': {found[:3]}' if found else ''), '0')


@rule('FC-P24')
@need_face
def _(c):
    # R2 (critique 2c/3; proski-expr "overlap the lower lid with the cheek"; faigin: a real smile lifts the lower lid):
    # on Confident the smirk side's lower lid is lifted: the near eye's bottom iris row is narrower than the row above,
    # with a lid mark at the outer lower corner
    expr = c.flm['expression']
    if expr not in ('confident', 'radiant_open'):
        return skip(f'{expr}: no smile to reach the eyes')
    sub, box = eye_pixels(c, 'near')
    e = eye_info(c, 'near')
    if sub is None or not e.get('iris_rows'):
        return skip('no open near eye')
    bot = max(e['iris_rows']) - box[1]
    iris = np.isin(sub, c.c('A2', 'A3', 'A4', 'A5'))
    w_bot, w_up = int(iris[bot].sum()), int(iris[bot - 1].sum())
    lid = bool(np.isin(sub[bot - 1:bot + 2, :2], c.c('OL', 'S4', 'I3', 'S3')).any())
    ok = w_bot < w_up and lid
    return R(ok, f'near eye: bottom iris row {w_bot} px under {w_up}; lid mark at the outer lower corner {lid}',
             'bottom row narrower; a lid mark at the outer corner')


@rule('FC-P25')
@need_face
def _(c):
    # R2 (critique 3; DESIGN 5 Confident "tilted 1 px across the eye line"; thomas-johnston: no twins): the default
    # three-quarter face rolls the eye line 1 px, the far eye higher
    if c.flm['expression'] != 'confident' or c.flm['yaw'] != 'q34':
        return skip('Confident three-quarter only')
    e = c.flm['eyes']
    d = e['near']['box'][1] - e['far']['box'][1]
    return R(d == 1, f'far eye box {d:+d} px against the near one', '+1 (far eye 1 px higher)')


# ------------------------------------------------------------------ round R3 additions and changed measurements
# The round-2 critique (6.2/10) found a face that passed 63/63 automatic face rules while reading sullen: several
# measurements were lenient (FC-P09 counted a 4-row lash as a pass; FC-P13 counted a 1 px iris row between lash pixels;
# FC-P16's minimum could not force depth). The rules below replace those measurements (IDs kept) and add the rules the
# critique produced. Each carries its reason; ART-RULES 10, round R3, has the evidence.

def iris_row_counts(c, side):
    """iris px (A2-A5 and a pupil I3 between them) per row inside the eye box, top to bottom: {y: n}"""
    sub, box = eye_pixels(c, side)
    if sub is None:
        return {}, box
    az = np.isin(sub, c.c('A2', 'A3', 'A4', 'A5'))
    out = {}
    for j in range(sub.shape[0]):
        xs = np.nonzero(az[j])[0]
        if not len(xs):
            continue
        n = len(xs)
        # a pupil (I3) that sits between iris px on the same row is iris too
        n += int(sum(1 for x in range(xs.min(), xs.max() + 1) if sub[j, x] == c.I('I3')))
        out[box[1] + j] = n
    return out, box


def full_iris_rows(c, side):
    """rows that read as iris: >= 2 iris px on the row (R3: a single A2 px squeezed between lash pixels reads as lid)"""
    rc, box = iris_row_counts(c, side)
    return sorted(y for y, n in rc.items() if n >= 2), box


def upper_lash_rows(c, side):
    """rows of upper lash from the eye's topmost OL (the flick above the box counts) down to the first full iris row"""
    rows, box = full_iris_rows(c, side)
    if not rows:
        return None, box
    x0, y0, x1, y1 = box
    xa, xb = x0 - 1, x1 + 1
    top = rows[0]
    ol = [y for y in range(max(0, y0 - 2), top) if (c.fcode[y, xa:xb + 1] == c.I('OL')).any()]
    return (len(set(ol)), min(ol) if ol else None), box


@rule('FC-P09', 'FC-N06')
@need_face
def _(c):
    # R3 (critique 2a): the lash is counted from its topmost row (the flick included) down to the first full iris row.
    # R2's near eye (a flick row, a lash row and a lash row squeezing 1 A2 px) measured "4 rows, flick True" and passed
    out, ok = [], True
    expr = c.flm['expression']
    if expr in ('radiant', 'hurt'):
        return skip('closed eyes: no open lash to measure')
    for side in ('near', 'far'):
        if side not in c.flm['eyes']:
            continue
        r, box = upper_lash_rows(c, side)
        if r is None:
            ok = False
            out.append(f'{side}: no full iris row')
            continue
        n, top = r
        x0, y0, x1, y1 = box
        outer_x = x0 - 1 if side == 'near' else x1 + 1
        flick = any(c.fcode[y, outer_x] == c.I('OL') for y in range(y0 - 2, y0 + 3) if 0 <= y < c.fcode.shape[0])
        if expr in ('confident', 'radiant_open'):
            ok &= n == 2 and flick
        else:
            ok &= n >= 2
        out.append(f'{side}: {n} upper lash rows over the first full iris row, flick {flick}')
    return R(ok, '; '.join(out), 'Confident: 2 rows (the flick row + 1) and a flick; other open eyes >= 2 rows')


@rule('FC-P13')
@need_face
def _(c):
    # R3 (critique, FC-P13 in spirit): a row counts as iris only with >= 2 iris px on it (and, R2, at >= 2:1 off the lash:
    # A2 and lighter)
    expr = c.flm['expression']
    rows = []
    for s in ('near', 'far'):
        if s in c.flm['eyes']:
            rows.append(len(full_iris_rows(c, s)[0]))
    n = min(rows) if rows else 0
    need = {'confident': (3, 9), 'radiant_open': (3, 9), 'ignited': (2, 9), 'focused': (2, 9), 'serene': (1, 2),
            'radiant': (0, 0), 'hurt': (0, 0)}.get(expr, (3, 9))
    return R(rng(n, *need), f'{expr}: full iris rows (>= 2 px) {rows}', f'{need[0]}-{need[1] if need[1] < 9 else "any"}')


@rule('FC-P26')
@need_face
def _(c):
    # R3 (critique 2a; maryli-34 / ao-female34: in 3/4 the near eye is the big one): the near eye must beat the far eye
    # by at least 1 full iris row and one column (3 px) of iris-and-white, and hold at least as many bright px
    # (A3/A4/A5/W). Measured at 1x value, not box size: R2's far eye showed 11 iris + 2 white px, the near 9 + 1
    if c.flm['yaw'] != 'q34':
        return skip('three-quarter rule')
    expr = c.flm['expression']
    if expr in ('radiant', 'hurt'):
        return skip('closed eyes')
    val = {}
    for s in ('near', 'far'):
        sub, box = eye_pixels(c, s)
        rows = full_iris_rows(c, s)[0]
        vis = int(np.isin(sub, c.c('A2', 'A3', 'A4', 'A5', 'W1', 'W2')).sum()) + sum(
            1 for y in rows for x in range(box[0], box[2] + 1) if c.fcode[y, x] == c.I('I3'))
        bright = int(np.isin(sub, c.c('A3', 'A4', 'A5', 'W1', 'W2')).sum())
        val[s] = (len(rows), vis, bright)
    (nr, nv, nb), (fr, fv, fb) = val['near'], val['far']
    if expr in ('confident', 'radiant_open'):
        ok = nr >= fr + 1 and nv >= fv + 3 and nb >= fb
        tgt = 'near >= far + 1 row, + 3 iris/white px, bright >= far'
    else:
        ok = nr >= fr and nv >= fv
        tgt = 'near >= far (rows and iris/white px)'
    return R(ok, f'near {nr} rows / {nv} iris+white px / {nb} bright; far {fr} / {fv} / {fb}', tgt)


@rule('FC-P12', 'FC-N05')
@need_face
def _(c):
    # R3 (critique 2b; aam-highlights "always make sure the highlights match in both eyes"): the same side, the lit side,
    # the iris edge, and now the same height: both on the top full iris row
    sides, cls, rel, off = [], [], [], []
    for side in ('near', 'far'):
        e = eye_info(c, side)
        if not e.get('highlight'):
            continue
        hx, hy = e['highlight']
        ic = e['iris_cols']
        sides.append('right' if hx == max(ic) else 'left' if hx == min(ic) else 'mid')
        cls.append('edge' if hx in (min(ic), max(ic)) else 'mid')
        rows, box = full_iris_rows(c, side)
        rel.append(hy - rows[0] if rows else None)
        # the pupil: an I3 px on a full iris row, not under the lash
        pup = [(x, y) for y in rows for x in range(box[0], box[2] + 1)
               if c.fcode[y, x] == c.I('I3') and c.fcode[y - 1, x] != c.I('OL')]
        off.append((hx - pup[0][0], hy - pup[0][1]) if pup else None)
    if not sides:
        return skip('no highlight (closed eyes or Ignited)')
    light = 'right' if c.flm.get('light', [1])[0] > 0 else 'left'
    same_off = len(set(off)) == 1
    ok = len(set(sides)) == 1 and sides[0] == light and all(k == 'edge' for k in cls) and len(set(rel)) == 1 and rel[0] == 0         and same_off
    return R(ok, f'highlights {sides} ({cls}); rows under the top full iris row {rel}; offset from the pupil {off}; key light {light}',
             'same side, the lit side, the iris edge, both on the top iris row, the same offset from each pupil')


@rule('FC-P07', 'FC-N11')
@need_face
def _(c):
    # R3: the width is the mouth line (S4, SB, W1). FC-P07 already allows an S3 tip or dimple outside it, but the old
    # measurement counted the dimple, so a 4 px smirk with a dimple failed FC-N11 as 5 px. The Confident smirk is
    # 4 px of S4 (critique 2d: 3 px on a diagonal read as a pout)
    mp = mouth_px(c)
    if not mp:
        return R(False, 'no mouth', '')
    line = [(x, y, k) for x, y, k in mp if k in ('S4', 'SB', 'W1')]
    if not line:
        return R(False, 'no S4/SB/W1 in the mouth', '')
    xs = [x for x, y, k in line]
    w = max(xs) - min(xs) + 1
    left = [y for x, y, k in line if x == min(xs)]
    right = [y for x, y, k in line if x == max(xs)]
    open_ = any(k in ('SB', 'W1') for x, y, k in line) and len({y for x, y, k in line}) >= 2
    expr = c.flm['expression']
    corner = abs(min(left) - min(right))
    if open_:
        ok = rng(w, 2, 4)
    elif expr == 'confident' and c.flm['yaw'] == 'profile':
        # a profile mouth is a 2-3 px mark inside the contour (FC-P23); the smile curls up at the back corner
        ok = rng(w, 2, 3) and corner == 1
    elif expr == 'confident':
        # 4 px with at least one corner above the lip line: the smirk (one corner up) or the round-3 pick, a shallow U
        lip = max(y for x, y, k in line)                   # the lip line is the mouth's lowest row
        ok = w == 4 and (min(left) < lip or min(right) < lip)
    else:
        ok = rng(w, 2, 4) and (corner == 1 or expr in ('focused', 'ignited', 'radiant'))
    return R(ok, f'{"open" if open_ else "closed"}, line {w} px wide (S4/SB/W1), corner rows differ by {corner}',
             'Confident: 4 px, a corner above the lip line; others 2-4 px')


@rule('FC-P16')
@need_face
def _(c):
    # R3 (critique 2f): the fringe cast shadow is a designed band: >= 12 px of S3 under hair, every piece a cluster of
    # >= 2 px (8-connected). R2 passed with a 7 px shadow made of checker specks
    m = face_skin(c)
    codes = Counter(c.pal.code_of(int(v)) for v in c.fcode[m])
    tot = sum(v for k, v in codes.items() if k in ('S1', 'S2', 'S3', 'S4'))
    s2 = codes['S2'] / tot if tot else 0
    hair = np.isin(c.fids, [A.MAT['hair']])
    s3 = m & (c.fcode == c.I('S3')) & ~feature_mask(c)
    lab, sizes = A.components(s3, conn=8)
    under = set(int(v) for v in lab[s3 & A.shift(hair, 0, 1)])
    band = [(k, s) for k, s in sizes if k in under]
    fringe_px = sum(s for k, s in band)
    singles = sum(1 for k, s in band if s < 2)
    chin = np.isin(c.fparts, [A.PART['neck']]) & (c.fcode == c.I('S4'))
    s1 = int(codes['S1'])
    ok = s2 >= 0.6 and fringe_px >= 12 and singles == 0 and chin.any() and (s1 == 0 or rng(s1, 2, 4))
    return R(ok, f'S2 {s2:.0%} of face skin; fringe shadow {fringe_px} px in {len(band)} clusters ({singles} single); '
                 f'under-chin {int(chin.sum())} px; S1 {s1}', 'S2 >= 60%; fringe shadow >= 12 px, no single px; chin shadow; S1 2-4')


@rule('FC-N15')
@need_face
def _(c):
    # R3: 8-connected, as PX-P12 has been since round R1: a 2 px diagonal shadow is a cluster, not two strays
    m = face_skin(c) & ~feature_mask(c)
    n = 0
    for code in set(c.fcode[m].tolist()) - {c.I('S2')}:
        lab, sizes = A.components(m & (c.fcode == code), conn=8)
        n += sum(1 for k, s in sizes if s == 1)
    return R(n == 0, f'{n} stray single px in the face (8-connected)', '0')


@rule('FC-P27')
@need_face
def _(c):
    # R3 (critique 2c: "brows ... with at least 1 px of clean skin around them"; the refs' brows are clean strokes in skin
    # windows under a solid fringe shadow): no hair px in the 8-neighbourhood of a brow px, and the row under each brow
    # is skin
    b = brows(c)
    if not b:
        return skip('no brows')
    hair = hair_px(c)
    skin = c.isin(c.fcode, 'S1', 'S2', 'S3', 'SB')
    out, ok = [], True
    for s, px in b.items():
        pset = set(map(tuple, px))
        touch = 0
        for x, y in px:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    X, Y = x + dx, y + dy
                    if (X, Y) not in pset and hair[Y, X]:
                        touch += 1
        below = [(x, y + 1) for x, y in px if (x, y + 1) not in pset]
        clean = sum(1 for X, Y in below if skin[Y, X])
        # a frown presses the brow onto the upper lid (Focused, Ignited, Hurt: faigin's lowered brow), so skin under the
        # brow is asked of the open faces only; hair touching a brow is never allowed
        pressed = c.flm['expression'] in ('focused', 'ignited', 'hurt')
        ok &= touch == 0 and (pressed or clean == len(below))
        out.append(f'{s}: {touch} hair px touching, {clean}/{len(below)} skin under')
    return R(ok, '; '.join(out), 'no hair touching a brow; skin under it (Confident, Radiant, Serene)')


@rule('FC-N27')
@need_face
def _(c):
    # R3 (critique 2c: row 19 alternated I3 hair tips and S2 skin almost pixel by pixel): between the hairline and the lash
    # top, no row of the face span has more than 2 runs of a single pixel (hair, or S3 on skin)
    lm = c.flm
    y0 = lm['chin_y'] - lm['rows_above_chin']['hairline']
    y1 = lm['chin_y'] - (face_rows(c)['lash_top'] or lm['rows_above_chin']['lash_top'])
    ne = {int(k): v for k, v in lm['near_edge'].items()}
    fe = {int(k): v for k, v in lm['far_edge'].items()}
    hair = hair_px(c)
    s3 = c.fcode == c.I('S3')
    worst = (0, -1)
    for y in range(y0 + 1, y1):
        r = lm['chin_y'] - y
        xa, xb = ne.get(r, min(ne.values())), fe.get(r, max(fe.values()))
        cls = ['h' if hair[y, x] else ('t' if s3[y, x] else 's') for x in range(xa, xb + 1)]
        runs, cur, n = [], None, 0
        for k in cls:
            if k == cur:
                n += 1
            else:
                if cur:
                    runs.append((cur, n))
                cur, n = k, 1
        runs.append((cur, n))
        # the runs touching the span's ends are the framing clumps overlapping the face edge, not speckle
        singles = sum(1 for k, n in runs[1:-1] if n == 1 and k in 'ht')
        worst = max(worst, (singles, y))
    return R(worst[0] <= 2, f'most single-px hair/shadow runs on one row: {worst[0]} (y {worst[1]})', '<= 2')


def contour_segments(c, side):
    """the jaw contour from just above the eye-bottom row to the chin as [x, vertical run length] segments"""
    lm = c.flm
    e = {int(k): v for k, v in lm[f'{side}_edge'].items()}
    eb = c.flm['rows_above_chin']['eye_bottom']
    xs = [e[r] for r in range(eb + 2, -1, -1) if r in e]
    segs = []
    for x in xs:
        if segs and segs[-1][0] == x:
            segs[-1][1] += 1
        else:
            segs.append([x, 1])
    return segs


@rule('FC-N28')
@need_face
def _(c):
    # R3 (critique 2e; lospec-outlines: a curve's segments get shorter toward its middle, "5, 2, 2, 1, 1"; equal segments
    # make a straight line): no jaw contour is a staircase of 4 or more equal steps. R2's near jaw was 8 steps of 1 x 1,
    # the guitar-pick face
    if c.flm['yaw'] == 'profile':
        return skip('profile: the jaw is one contour, checked by FC-P23')
    out, ok = [], True
    for side in ('near', 'far'):
        segs = contour_segments(c, side)
        steps = [(segs[i][1], abs(segs[i + 1][0] - segs[i][0])) for i in range(len(segs) - 1)]
        best, run = (1 if steps else 0), 1
        for a, b in zip(steps, steps[1:]):
            run = run + 1 if a == b else 1
            best = max(best, run)
        ok &= best <= 3
        out.append(f'{side}: runs {[s[1] for s in segs]}, longest equal-step stretch {best}')
    return R(ok, '; '.join(out), '<= 3 equal steps in a row')


@rule('HR-P03', 'HR-N01')
@need_face
def _(c):
    # R3: the roots are counted on the hairline row itself. R3's brow windows arch up to the row under the hairline, so
    # the old row (hairline - 1) cut the clumps at their windows
    if c.flm['yaw'] == 'profile':
        return skip('profile: the fringe is edge-on')
    lt = face_rows(c)['lash_top']
    r_root = c.flm['rows_above_chin']['hairline']
    r_tip = lt + 1
    roots = fringe_runs(c, r_root)
    tips = fringe_runs(c, r_tip)
    n = len(roots)
    ok = rng(n, 3, 5) and all(rng(w, 3, 6) for w in roots[1:-1]) and all(w <= 3 for w in tips[1:-1])
    return R(ok, f'{n} clumps at row {r_root} (widths {roots}); tips at row {r_tip}: {tips}', '3-5 clumps; roots 3-6; tips 1-3')


@rule('HR-P04')
@need_face
def _(c):
    # R3 (changed; critique 2c): over each eye the fringe stops above the brow window (no hair in the eye box or within
    # 1 px of a brow: FC-N17, FC-P27), and a clump beside each eye (within 2 columns of its box) frames it, reaching to
    # within 2 rows of that eye's lash top. Was: tips end 1-2 rows over each lash top, which put a tip beside every brow
    hair = hair_px(c) & ~np.isin(c.fparts, [A.PART['eye']])
    out, ok = [], True
    for s, e in c.flm['eyes'].items():
        x0, y0, x1, y1 = e['box']
        inbox = int(hair[y0:y1 + 1, x0:x1 + 1].sum())
        if c.flm['yaw'] == 'profile':
            cols = list(range(x0 - 3, x0))                 # the sidelock frames the eye from behind
        else:
            cols = list(range(x0 - 2, x0)) if s == 'near' else list(range(x1 + 1, x1 + 3))
        low = max((int(np.nonzero(hair[:y0 + 3, x])[0].max()) for x in cols if hair[:y0 + 3, x].any()), default=None)
        frame = low is not None and low >= y0 - 2
        gap = bool((c.fparts[y0 - 3:y0, x0:x1 + 1] == A.PART['face']).any())
        ok &= inbox == 0 and frame and gap
        out.append(f'{s}: {inbox} hair px in the box; framing clump reaches y {low} (lash top y {y0}); skin above {gap}')
    return R(ok, '; '.join(out), 'no hair in the box; a clump beside the eye to within 2 rows of its lash top; skin above')


@rule('HR-P10')
@need_face
def _(c):
    # R3: the split may start right under the roots (the brow windows split C2 and C4 one row under the hairline)
    if c.flm['yaw'] == 'profile':
        return skip('profile: the fringe is edge-on')
    hl = c.flm['rows_above_chin']['hairline']
    best = (0, 0, 0)
    for r in range(hl - 1, hl - 6, -1):
        a, b = len(fringe_runs(c, r + 1)), len(fringe_runs(c, r))
        best = max(best, (b - a, r, b))
    return R(best[0] >= 1, f'most runs gained under the roots: +{best[0]} at row {best[1]} ({best[2]} runs)',
             '>= 1 split under the roots')


@rule('HR-N02')
def _(c):
    # R3: a speck is an I0/I1 pixel with no I0/I1 neighbour in 8 directions. A dash's I1 tail touching its I0 head is the
    # taper HR-P08 asks for, not a speck (the old count took each tone's 1 px components)
    m, code = ((c.matm('hair') & c.mask, c.code) if c.pose else (c.fids == A.MAT['hair'], c.fcode) if c.face else (None, None))
    if m is None:
        return skip('no input')
    light = m & np.isin(code, c.c('I0', 'I1'))
    nb = np.zeros_like(light)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx or dy:
                nb |= A.shift(light, dx, dy)
    n = int((light & ~nb).sum())
    return R(n <= 2, f'{n} isolated I0/I1 px', '<= 2')


@rule('HR-P08')
@need_face
def _(c):
    # R3 (critique 4a; ao-shade-hair: highlights "flow along the shape"): one dash per clump, within a 4-row band, and the
    # dashes on at least 3 different rows (they follow the skull's curve). R2's dashes all sat on one row: a halo band
    m = (c.fids == A.MAT['hair']) & (c.fcode == c.I('I0'))
    lab, sizes = A.components(m, conn=8)
    ys = np.nonzero(m)[0]
    span = int(ys.max() - ys.min() + 1) if len(ys) else 0
    tops = sorted({int(np.nonzero(lab == k)[0].min()) for k, s in sizes})
    nclump = len(c.face['params'].get('bangs', [])) or len(fringe_runs(c, face_rows(c)['lash_top'] + 5))
    need_rows = min(3, len(sizes))
    ok = abs(len(sizes) - nclump) <= 1 and span <= 4 and len(tops) >= need_rows
    return R(ok, f'{len(sizes)} dashes over {span} rows, dash rows {tops}; {nclump} clumps',
             '1 per clump; one 4-row band; >= 3 different rows')



def hair_protrusions(c):
    """hair px on the face stamp that stick out of the silhouette: >= 5 of their 8 neighbours are background or the outline
    ring. Returns (lit, dark) lists of (x, y): lit = I0-I2, dark = I3/I4"""
    hair = c.fids == A.MAT['hair']
    outside = (c.fcode <= 0) | ((c.fcode == c.I('OL')) & ~np.isin(c.fparts, [A.PART['eye']]))
    n = np.zeros(hair.shape, int)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx or dy:
                n += A.shift(outside, dx, dy).astype(int)
    stick = hair & (n >= 5)
    # the head's silhouette only: below the chin a figure stamp cuts the back hair (the body layer carries it there)
    stick[c.flm['chin_y'] + 1:, :] = False
    ys, xs = np.nonzero(stick)
    lit = [(int(x), int(y)) for x, y in zip(xs, ys) if c.fcode[y, x] in c.c('I0', 'I1', 'I2')]
    dark = [(int(x), int(y)) for x, y in zip(xs, ys) if c.fcode[y, x] in c.c('I3', 'I4')]
    return lit, dark


@rule('HR-P13')
@need_face
def _(c):
    # R3 (critique 4b: the silhouette hugged the skull; trial round d): at least one clump tip breaks the head's silhouette,
    # drawn in the hair's lit or mid tones with a root of 2 px or more
    lit, dark = hair_protrusions(c)
    return R(len(lit) >= 1, f'{len(lit)} lit hair px breaking the silhouette {lit[:4]}', '>= 1')


@rule('HR-N05')
@need_face
def _(c):
    # R3 (trial round d: flyaway and flyaway_curl, drawn in I3 inside their outline, read as a twig or a horn): never a dark
    # 1 px strand sticking out of the head's silhouette
    lit, dark = hair_protrusions(c)
    return R(len(dark) == 0, f'{len(dark)} dark hair px sticking out {dark[:4]}', '0')

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sprite')
    ap.add_argument('--face')
    ap.add_argument('--faces', default=str(FACES))
    ap.add_argument('--json')
    ap.add_argument('--only', help='comma list of id prefixes, e.g. FC,HR')
    ap.add_argument('--fails', action='store_true', help='print only FAIL rows')
    a = ap.parse_args()
    if not a.sprite and not a.face:
        ap.error('give --sprite and/or --face')
    ctx = Ctx(a.sprite, a.face, a.faces)
    rows = run(ctx, a.only.split(',') if a.only else None)
    cnt = Counter(r['status'].rstrip('*') for r in rows)
    for r in rows:
        if a.fails and not r['status'].startswith('FAIL'):
            continue
        print(f"{r['id']:7} {r['severity']:5} {r['status']:6} {r['measured']}" + (f"   [target {r['target']}]" if r['target'] else '')
              + (f"   ({r['note']})" if r['note'] and r['status'] in ('SKIP', 'CRITIC') else ''))
    blocks = [r['id'] for r in rows if r['status'].startswith('FAIL') and r['severity'] == 'block']
    print(f"\n{len(rows)} rules: {cnt.get('PASS', 0)} pass, {cnt.get('FAIL', 0)} fail, {cnt.get('SKIP', 0)} skip, "
          f"{cnt.get('CRITIC', 0)} critic-only. Block fails: {', '.join(blocks) or 'none'}")
    if a.json:
        A.jdump({'sprite': a.sprite, 'face': a.face, 'counts': dict(cnt), 'block_fails': blocks, 'rules': rows}, a.json)
    return 1 if blocks else 0


if __name__ == '__main__':
    sys.exit(main())
