"""Round-1 head route: heads painted as layered pixel data on the construction grid, the way a pixel
artist works in layers (ART-RULES WF-P01, WF-P06; learning log round R1).

  python tools/art-construct/head_paint.py build  --view q34 --expr confident [--roll 0] [--sheet]
  python tools/art-construct/head_paint.py all    [--sheet]          # 3 views x 3 expressions
  python tools/art-construct/head_paint.py thumbs --view q34          # the trial variants (WF-P03/P04 for faces)
  python tools/art-construct/head_paint.py preview FILE.json [--expr confident] [--z 14]

Why a new route (round R1): the C1 face_construct.py draws the hair and the jaw from parametric shapes
(a shell on the ball, capsule clumps). By eye beside refs 07/08/09 that gives a smooth helmet, a boxy
lower face and features that float on a flat skin. An artist draws those on the guides by hand. So here:
  1. the construction (ball, side plane, curved centre line, FC-P01 rows, jaw contour) still comes from
     face_construct.Face.construct(), and is drawn under the paint on every sheet;
  2. the paint is data: art/rosace/construct/faces/r1/head_<view>.json holds the layers
     (back = hair behind + neck, skin = the face plane, front = bangs + sidelocks) and the expression
     overlays (eye_near, eye_far, brow_near, brow_far, mouth, nose, blush), each a small grid at an anchor;
  3. landmarks (face.json schema, checklist.json inputs) are measured from the painted pixels, so
     rules_check.py --face grades the painted head exactly as it grades a C1 face.

Authoring format. A layer is a list of 46 rows; a row is either a literal 38-character string or
segments "x:chars x:chars" (chars start at column x; '.' = transparent). Characters are artlib.KEY codes.
Overlay grids are literal rows with '.' transparent. In a brow grid '#' means "OL over hair, I3 on skin"
(FC-P15). The canvas matches face_construct: 38 x 46, chin row at y = 36 (rows count up from the chin).
"""
import argparse
import copy
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import face_construct as FC  # noqa: E402

LIBDIR = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'r1'
SHEETS = A.ROOT / 'review' / 'rosace' / 'construct' / 'round-1' / 'face'
W, H, CHIN_Y = FC.W, FC.H, FC.CHIN_Y
VIEWS = ('q34', 'front', 'profile')
EXPRS = ('confident', 'focused', 'radiant')
HAIR_CH = set('jklnd')
TIP_CH = set('abc')
SKIN_CH = set('1stmp')
GOLD_CH = set('uvxzq')


def parse_rows(rows, w=W, h=H):
    """layer rows (literal or 'x:chars' segments) -> list of h strings of width w"""
    out = []
    for r in rows:
        if ':' in r:
            line = ['.'] * w
            for seg in r.split():
                x, s = seg.split(':', 1)
                x = int(x)
                for i, ch in enumerate(s):
                    if 0 <= x + i < w and ch != '.':
                        line[x + i] = ch
            out.append(''.join(line))
        else:
            out.append((r + '.' * w)[:w])
    while len(out) < h:
        out.append('.' * w)
    return out[:h]


def load(view, path=None):
    p = Path(path) if path else LIBDIR / f'head_{view}.json'
    return json.loads(p.read_text(encoding='utf-8'))


class Head:
    """one painted head: a view's layers plus one expression's overlays"""

    def __init__(self, spec, expr='confident', roll=None, pitch=0, facing='right', variant=None):
        self.spec = copy.deepcopy(spec)
        if variant:
            self.apply_variant(variant)
        self.view = self.spec['view']
        self.expr = expr
        self.roll = self.spec.get('roll', 0) if roll is None else roll
        self.pitch = pitch
        self.facing = facing
        self.pal = A.Palette()
        self.rows = dict(self.spec['rows'])
        self.anch = self.spec['anchors']
        self.feat = {}

    def apply_variant(self, v):
        """a variant patches layers (row replacements) and/or overlays (whole grids) - one design axis each"""
        s = self.spec
        for lay, patch in v.get('layers', {}).items():
            rows = parse_rows(s['layers'][lay])
            for y, r in patch.items():
                rows[int(y)] = parse_rows([r])[0] if ':' in r else r
            s['layers'][lay] = rows
        for lay, rows in v.get('replace_layers', {}).items():
            s['layers'][lay] = rows
        for e, ov in v.get('expressions', {}).items():
            s['expressions'].setdefault(e, {}).update(ov)
        for k, val in v.get('anchors', {}).items():
            s['anchors'][k] = val
        for k, val in v.get('rows', {}).items():
            s['rows'][k] = val

    # ------------------------------------------------------------------ composition
    def compose(self):
        pal = self.pal
        I = pal.i
        cv = A.Canvas(W, H)
        z = np.zeros((H, W), np.int16)
        L = self.spec['layers']

        def put_layer(rows, part_of, zi):
            g = parse_rows(rows)
            for y, r in enumerate(g):
                for x, ch in enumerate(r):
                    if ch == '.' or ch == ' ':
                        continue
                    code = I(A.KEY[ch])
                    mat, part = part_of(ch, x, y)
                    cv.code[y, x] = code
                    cv.mat[y, x] = A.MAT[mat]
                    cv.part[y, x] = A.PART[part]
                    z[y, x] = zi

        def back_part(ch, x, y):
            if ch in SKIN_CH:
                return 'skin', 'neck'
            if ch in GOLD_CH:
                return 'gold', 'hair_back'
            if ch in TIP_CH:
                return 'hairtip', 'hair_back'
            if ch in 'we':
                return 'veil', 'veil'
            if ch == 'O':
                return 'line', 'hair_back'
            return 'hair', 'hair_back'

        def skin_part(ch, x, y):
            if ch in SKIN_CH:
                return 'skin', ('face' if y <= CHIN_Y else 'neck')
            if ch == 'O':
                return 'line', 'face'
            return 'hair', 'hair_back'

        def front_part(ch, x, y):
            if ch in GOLD_CH:
                return 'gold', 'hair_front'
            if ch in TIP_CH:
                return 'hairtip', 'hair_front'
            if ch in SKIN_CH:
                return 'skin', 'face'
            if ch == 'O':
                return 'line', 'hair_front'
            return 'hair', 'hair_front'

        put_layer(L['back'], back_part, 1)
        put_layer(L['skin'], skin_part, 2)
        self.skin_only = (cv.part == A.PART['face']).copy()        # the face plane before features and bangs
        ex = self.spec['expressions'].get(self.expr) or self.spec['expressions']['confident']
        base = self.spec['expressions']['confident']
        get = lambda k: ex[k] if k in ex else base.get(k)  # noqa: E731
        # features on the skin
        self.feat = {}
        self.gaze = ex.get('gaze', self.spec.get('gaze', [-1, 0]))
        self.gaze_target = ex.get('gaze_target', self.spec.get('gaze_target', 'viewer'))
        for k in ('skin_fix', 'nose', 'mouth', 'blush_near', 'blush_far', 'eye_near', 'eye_far'):
            ov = get(k)
            if not ov:
                continue
            self.feat[k] = self.overlay(cv, z, ov, k, 3)
        put_layer(L['front'], front_part, 4)
        # hair tips (azure) over the eye boxes would be FC-N17 anyway; brows go over the bangs (FC-P15)
        for k in ('brow_near', 'brow_far'):
            ov = get(k)
            if ov:
                self.feat[k] = self.overlay(cv, z, ov, k, 5)
        # extra overlays of the expression (e.g. a glow, a sweat drop) in 'extra'
        for i, ov in enumerate(ex.get('extra', [])):
            self.feat[f'extra{i}'] = self.overlay(cv, z, ov, 'extra', 5)
        self.z = z
        # outline: OL ring outside the silhouette (the figure re-does it on the whole body)
        sil = cv.code > 0
        ring = A.ring_out(sil)
        ring[H - 1:, :] = False
        # the neck's bottom rows stay open (it continues into the body)
        cv.put(ring, I('OL'), A.MAT['line'], 0)
        self.pixel_perfect(cv, sil)
        if self.facing == 'left':
            cv.code, cv.mat, cv.part = cv.code[:, ::-1].copy(), cv.mat[:, ::-1].copy(), cv.part[:, ::-1].copy()
        self.cv = cv
        return cv

    def pixel_perfect(self, cv, sil):
        """remove L-corner doubles from the outside ring (PX-P21): a ring pixel whose two orthogonal ring
        neighbours both touch the fill diagonally is dropped"""
        I = self.pal.i
        line = (cv.code == I('OL')) & ~sil
        drop = np.zeros_like(line)
        for (dx1, dy1), (dx2, dy2) in (((1, 0), (0, 1)), ((1, 0), (0, -1)), ((-1, 0), (0, 1)), ((-1, 0), (0, -1))):
            a1 = A.shift(line, -dx1, -dy1)
            a2 = A.shift(line, -dx2, -dy2)
            inner = A.shift(sil, -(dx1 + dx2), -(dy1 + dy2))
            drop |= line & a1 & a2 & inner & ~A.shift(sil, -dx1, -dy1) & ~A.shift(sil, -dx2, -dy2)
        cv.code[drop] = 0
        cv.mat[drop] = 0

    def overlay(self, cv, z, ov, key, zi):
        pal = self.pal
        I = pal.i
        x0, y0 = ov['at']
        far = key.endswith('_far')
        if far and self.view != 'profile':
            y0 += self.roll
        y0 += self.pitch
        px = []
        for j, r in enumerate(ov['rows']):
            for i, ch in enumerate(r):
                if ch in '. ':
                    continue
                X, Y = x0 + i, y0 + j
                if not (0 <= X < W and 0 <= Y < H):
                    continue
                if ch == '#':
                    on_hair = cv.mat[Y, X] in (A.MAT['hair'], A.MAT['hairtip'])
                    code = 'OL' if on_hair else 'I3'
                else:
                    code = A.KEY[ch]
                cv.code[Y, X] = I(code)
                if key.startswith('eye'):
                    cv.mat[Y, X] = A.MAT['line'] if code == 'OL' else A.MAT['eye']
                    cv.part[Y, X] = A.PART['eye']
                elif key.startswith('brow'):
                    cv.mat[Y, X] = A.MAT['line']
                elif key == 'extra':
                    if code.startswith('A'):                      # a glow beside the eye belongs to the eye
                        cv.mat[Y, X] = A.MAT['eye']
                        cv.part[Y, X] = A.PART['eye']
                else:
                    cv.mat[Y, X] = A.MAT['skin']
                    if cv.part[Y, X] == 0:
                        cv.part[Y, X] = A.PART['face']
                z[Y, X] = zi
                px.append((X, Y, code))
        return {'at': [x0, y0], 'px': px, 'box': ov.get('box'), 'grid_at': [ov['at'][0], y0]}

    # ------------------------------------------------------------------ landmarks (face.json schema)
    def landmarks(self):
        cv, pal = self.cv, self.pal
        I = pal.i
        rows = self.rows
        a = self.anch
        c0 = a['c0']
        lm = {'facing': self.facing, 'yaw': self.view,
              'yaw_deg': {'front': 0, 'q34': 30, 'profile': 90}[self.view],
              'expression': self.expr, 'head_px': rows['skull_top'], 'chin_y': CHIN_Y,
              'rows_above_chin': rows, 'skull_top_row': rows['skull_top'], 'hair_top_row': rows['hair_top'],
              'centre_line_x_at_eye_row': c0, 'gaze_target': self.gaze_target,
              'light': [0.6, -0.8], 'origin': [a['chin'][0], CHIN_Y]}
        hair_rows = np.nonzero(np.isin(cv.mat, [A.MAT['hair'], A.MAT['hairtip']]).any(1))[0]
        lm['hair_top_measured'] = int(CHIN_Y - hair_rows.min()) if len(hair_rows) else None
        # contour tables from the painted face plane (before the bangs cover it)
        far, near = {}, {}
        so = self.skin_only
        for y in range(H):
            xs = np.nonzero(so[y])[0]
            r = CHIN_Y - y
            if len(xs) and r >= 0:
                far[r], near[r] = int(xs.max()), int(xs.min())
        lm['far_edge'], lm['near_edge'] = far, near
        eb = CHIN_Y - rows['eye_bottom']
        xs = np.nonzero(np.isin(cv.part[eb], [A.PART['face'], A.PART['eye']]))[0]
        lm['face_width_eye_row'] = {'y': eb, 'x0': int(xs.min()) if len(xs) else None, 'x1': int(xs.max()) if len(xs) else None}
        # eyes
        eyes = {}
        for side in ('near', 'far'):
            f = self.feat.get(f'eye_{side}')
            if not f:
                continue
            bx = f['box']
            gx, gy = f['grid_at']
            box = [gx + bx[0], gy + bx[1], gx + bx[0] + bx[2] - 1, gy + bx[1] + bx[3] - 1]
            inb = lambda x, y: box[0] <= x <= box[2] and box[1] <= y <= box[3]  # noqa: E731
            az = [(x, y) for x, y, k in f['px'] if k in ('A2', 'A3', 'A4') and inb(x, y) and cv.code[y, x] == I(k)]
            az_rows = {y for x, y in az} | {y for x, y, k in f['px'] if k == 'A5'}
            # I3 is iris (its dark top, eye table row 3) only right under the lash in a row that also holds azure; elsewhere it is the lower lash
            iris = az + [(x, y) for x, y, k in f['px'] if k == 'I3' and inb(x, y) and y in az_rows and cv.code[y, x] == I(k)
                         and y > 0 and cv.code[y - 1, x] == I('OL')]
            hl = [(x, y) for x, y, k in f['px'] if k == 'A5' and cv.code[y, x] == I('A5')]
            whites = [(x, y) for x, y, k in f['px'] if k in ('W1', 'W2') and cv.code[y, x] == I(k)]
            lash = [(x, y) for x, y, k in f['px'] if k == 'OL']
            info = {'box': box, 'template': f'r1_{self.view}_{side}_{self.expr}', 'mirrored': False, 'lash_px': len(lash)}
            if iris or hl:
                allx = [p[0] for p in iris + hl]
                ally = [p[1] for p in iris + hl]
                icols = list(range(min(allx), max(allx) + 1))
                info.update({'iris_cols': icols, 'iris_rows': sorted(set(ally)), 'iris_w': len(icols),
                             'highlight': list(hl[0]) if hl else None, 'whites': [list(w) for w in whites],
                             'white_side': (None if not whites else
                                            ('right' if np.mean([w[0] for w in whites]) > np.mean(icols) else 'left'))})
            eyes[side] = info
        lm['eyes'] = eyes
        gz = self.gaze
        lm['gaze'] = {'dx': gz[0], 'dy': gz[1], 'target': lm['gaze_target']}
        lm['brows'] = {s: [(x, y) for x, y, k in self.feat[f'brow_{s}']['px']]
                       for s in ('near', 'far') if f'brow_{s}' in self.feat}
        m = self.feat.get('mouth')
        lm['mouth'] = {'key': self.expr, 'px': [(x, y, k) for x, y, k in m['px']] if m else []}
        n = self.feat.get('nose')
        lm['nose'] = [(x, y) for x, y, k in n['px'] if k == 'S3'] if n and self.view != 'profile' else []
        lm['blush'] = {s: [(x, y) for x, y, k in self.feat[f'blush_{s}']['px'] if k == 'SB' and cv.code[y, x] == I('SB')]
                       for s in ('near', 'far') if f'blush_{s}' in self.feat}
        # centre line (for the checker's head axis): the construction's curve
        f0 = FC.Face(self.fc_params())
        f0.construct()
        lm['centre_line'] = f0.lm['centre_line']
        return lm

    def fc_params(self):
        return {'yaw': self.view, 'roll': 0, 'expression': self.expr}

    def record(self, name):
        cv = self.cv
        return {
            '_doc': 'Painted face stamp, round R1 (tools/art-construct/head_paint.py from '
                    f'art/rosace/construct/faces/r1/head_{self.view}.json). rows use the KEY in tools/art-construct/artlib.py; '
                    'origin = [column, row] of the chin point; landmarks follow the face.json schema in '
                    'docs/character/art-rules/checklist.json inputs and are measured from the painted pixels.',
            'name': name,
            'params': {'yaw': self.view, 'expression': self.expr, 'gaze': self.gaze,
                       'roll': self.roll, 'pitch': self.pitch, 'eye_row': 0, 'pupil': False,
                       'gaze_target': self.gaze_target, 'facing': self.facing,
                       'route': 'r1 painted layers'},
            'landmarks': self.landmarks(),
            'rows': A.codes_to_grid(cv.code, self.pal),
        }

    def blockin(self):
        """the block-in the painter started from: every material flattened to its lit tone"""
        pal = self.pal
        I = pal.i
        flat = {'hair': 'I2', 'hairtip': 'A3', 'skin': 'S2', 'gold': 'G2', 'veil': 'W2'}
        b = self.cv.code.copy()
        for mat, code in flat.items():
            sel = (self.cv.mat == A.MAT[mat]) & (b != I('OL'))
            b[sel] = I(code)
        b[(self.cv.part == A.PART['eye'])] = I('OL')
        return b


def construction(view):
    f = FC.Face({'yaw': view, 'roll': 0})
    f.construct()
    return f


def img_of(codes, pal, bg=(104, 102, 98)):
    return A.on_bg(Image.fromarray(pal.to_rgba(np.clip(codes, 0, None)), 'RGBA'), bg)


def construct_sheet(head, name, extra_rows=(), label='round R1 painted head', src=None):
    pal = head.pal
    Z = 10
    bg = (104, 102, 98)
    f = construction(head.view)
    blank = Image.new('RGB', (W, H), bg)
    fin = img_of(head.cv.code, pal, bg)
    blk = img_of(head.blockin(), pal, bg)
    p1 = f.g.draw(A.zoom(blank, Z), Z, layers=('ball', 'grid'))
    p2 = f.g.draw(A.zoom(Image.blend(blank, blk, 0.45), Z), Z, layers=('ball', 'jaw', 'marks'))
    p3 = f.g.draw(A.zoom(blk, Z), Z, layers=('grid',))
    p4 = A.zoom(fin, Z)
    p5 = f.g.draw(A.zoom(fin, Z), Z, layers=('grid', 'ball'))
    top = A.row_sheet([('1 ball, side plane, centre line, FC-P01 grid', p1),
                       ('2 contour + feature boxes over the block-in', p2), ('3 block-in (flat tones)', p3),
                       ('4 final pixels', p4), ('5 final on the construction', p5)],
                      title=f'{name} | {label} | x{Z} | construction from face_construct, pixels from {src or "head_" + head.view + ".json"}')
    small = [('1x', fin), ('3x', A.zoom(fin, 3)), ('6x', A.zoom(fin, 6)), ('grey 6x', A.zoom(A.greyscale(fin), 6)),
             ('flip 6x', A.zoom(fin.transpose(Image.FLIP_LEFT_RIGHT), 6))]
    rows = [top, A.row_sheet(small, title='read at game size, greyscale, flipped (WF-P07, WF-P08)')]
    rp = FC.ref_faces()
    if rp:
        rows.append(A.row_sheet([(f'{k} x6', A.zoom(v, 6)) for k, v in rp] + [('ours x6', A.zoom(fin, 6))],
                                title='same zoom as the finish-bar heads (third-party refs: review/ only)'))
    rows += list(extra_rows)
    return A.stack(rows)


def build(view, expr, roll=None, sheet=False, name=None, out=None, spec=None, variant=None):
    spec = spec or load(view)
    h = Head(spec, expr, roll=roll, variant=variant)
    h.compose()
    name = name or f'{view}_{expr}_144'
    out = Path(out) if out else LIBDIR
    out.mkdir(parents=True, exist_ok=True)
    rec = h.record(name)
    A.jdump(rec, out / f'{name}.json')
    h.cv.save(h.pal, out / f'{name}.png')
    h.cv.save_layers(str(out / name))
    if sheet:
        SHEETS.mkdir(parents=True, exist_ok=True)
        construct_sheet(h, name).save(SHEETS / f'{name}_construct.png')
    return h, rec


def preview(path, expr='confident', z=14, roll=0, variant=None):
    spec = json.loads(Path(path).read_text(encoding='utf-8'))
    h = Head(spec, expr, roll=roll, variant=variant)
    h.compose()
    f = construction(spec['view'])
    fin = img_of(h.cv.code, h.pal)
    from PIL import ImageDraw
    big = A.zoom(fin, z)
    d = ImageDraw.Draw(big)
    for x in range(0, W + 1, 5):
        d.line([(x * z, 0), (x * z, H * z)], fill=(150, 150, 60))
    for y in range(0, H + 1, 5):
        d.line([(0, y * z), (W * z, y * z)], fill=(150, 150, 60))
    for x in range(0, W, 5):
        d.text((x * z + 2, 1), str(x), fill=(255, 255, 0))
    for y in range(0, H, 5):
        d.text((1, y * z + 2), str(y), fill=(255, 255, 0))
    g = f.g.draw(A.zoom(fin, z), z, layers=('grid', 'ball'))
    s = A.row_sheet([(f'{spec["view"]} {expr} x{z}', big), ('on the construction', g), ('x3', A.zoom(fin, 3)),
                     ('1x', fin)] + [(k, A.zoom(v, 6)) for k, v in FC.ref_faces()])
    return h, s


def score(rec_path, faces_dir=None):
    """rules_check on one face record: (passed, failed, rows) over the FC and HR rules"""
    import rules_check as RC
    ctx = RC.Ctx(face=rec_path, faces_dir=faces_dir or LIBDIR)
    ids = [i for i in RC.CHECKS if i.startswith(('FC', 'HR'))]
    rows = RC.run(ctx, ids)
    ok = [r['id'] for r in rows if r['status'].startswith('PASS')]
    bad = [f"{r['id']} {r['measured']}" for r in rows if r['status'].startswith('FAIL')]
    return ok, bad, rows


def thumbs(view, expr='confident', out=None, tag=''):
    """the trial loop for a head (WF-P03/WF-P04 applied to faces, round R1): every variant in the spec's
    'variants' changes one design axis; each is built, scored on the FC/HR rules and put beside the ref heads
    at x6. Writes <out>/<variant>.json/.png, variants.json (scores + the verdict written in the spec) and
    review/rosace/construct/round-1/face/<view>_variants_x6.png"""
    spec = load(view)
    out = Path(out or A.ROOT / 'review' / 'rosace' / 'construct' / 'round-1' / 'face' / f'{view}_variants{tag}')
    out.mkdir(parents=True, exist_ok=True)
    res = []
    items = [('base', {'idea': 'the head as authored', 'verdict': spec.get('base_verdict', '')})] +         list(spec.get('variants' + tag, {}).items())
    panels = []
    for name, v in items:
        h, rec = build(view, v.get('expr', expr), None, False, name=f'{view}_{expr}__{name}', out=out,
                       spec=spec, variant=None if name == 'base' else v)
        ok, bad, _ = score(out / f'{view}_{expr}__{name}.json')
        res.append({'name': name, 'axis': v.get('axis', ''), 'idea': v.get('idea', ''), 'passed': len(ok),
                    'failed': bad, 'verdict': v.get('verdict', ''), 'kept': v.get('kept')})
        label = f"{name}: {len(ok)} pass / {len(bad)} fail" + (' KEPT' if v.get('kept') else '')
        panels.append((label, A.zoom(img_of(h.cv.code, h.pal), 6)))
    A.jdump({'_doc': 'face trial variants (round R1): one axis each, scored with rules_check.py on FC/HR; '
                     'the verdict is the painter call beside the refs at x6 and is also written in the head spec',
             'view': view, 'expr': expr, 'results': res}, out / 'variants.json')
    refs = [(k, A.zoom(v, 6)) for k, v in FC.ref_faces()]
    rows = [A.row_sheet(panels[i:i + 4], title=(f'{view} {expr}: trial variants, one design axis each, x6 '
                                                 '(rules_check FC+HR counts)' if i == 0 else ''))
            for i in range(0, len(panels), 4)]
    rows.append(A.row_sheet(refs, title='the finish-bar heads at the same zoom (third-party refs: review/ only)'))
    SHEETS.mkdir(parents=True, exist_ok=True)
    A.stack(rows).save(SHEETS / f'{view}_{expr}_variants{tag}_x6.png')
    return res


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=('build', 'all', 'preview', 'thumbs', 'variants'))
    ap.add_argument('file', nargs='?')
    ap.add_argument('--view', default='q34')
    ap.add_argument('--expr', default='confident')
    ap.add_argument('--roll', type=int, default=None)
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--z', type=int, default=14)
    ap.add_argument('--out')
    ap.add_argument('--tag', default='', help="thumbs: which variant round ('' or e.g. _b = the spec's variants_b)")
    a = ap.parse_args()
    if a.cmd == 'preview':
        h, s = preview(a.file or LIBDIR / f'head_{a.view}.json', a.expr, a.z, a.roll or 0)
        o = Path(a.out or A.ROOT / 'review' / 'rosace' / 'construct' / 'round-1' / '_work' / f'preview_{h.view}_{a.expr}.png')
        o.parent.mkdir(parents=True, exist_ok=True)
        s.save(o)
        print(o)
    elif a.cmd == 'variants':
        for r in one_axis_variants():
            print(f"{r['base']:22s} {r['axis']:11s} {r['passed']} (base {r['base_passed']})  {'; '.join(r['failed'])[:120]}")
    elif a.cmd == 'thumbs':
        for r in thumbs(a.view, a.expr, tag=a.tag):
            print(f"{r['name']:16s} {r['passed']:2d} pass  fails: {'; '.join(x[:60] for x in r['failed'])}")
    elif a.cmd == 'build':
        h, rec = build(a.view, a.expr, a.roll, a.sheet, out=a.out)
        print(rec['name'], 'ok')
    else:
        for v in VIEWS:
            for e in EXPRS:
                if (LIBDIR / f'head_{v}.json').exists():
                    h, rec = build(v, e, None, a.sheet, out=a.out)
                    print(rec['name'], 'ok')



def strays(view, expr):
    """debug helper for FC-N15 / HR-N02: single-pixel shading clusters on the face and I0/I1 specks in the hair"""
    h = Head(load(view), expr)
    cv = h.compose()
    I = h.pal.i
    face = cv.part == A.PART['face']
    feat = np.zeros_like(face)
    for f in h.feat.values():
        for x, y, c in f['px']:
            feat[y, x] = True
    out = []
    m = face & ~feat
    for code in set(cv.code[m].tolist()) - {I('S2')}:
        lab, s = A.components(m & (cv.code == code))
        out += [('face', h.pal.code_of(code), int(np.nonzero(lab == k)[1][0]), int(np.nonzero(lab == k)[0][0])) for k, n in s if n == 1]
    for code in (I('I0'), I('I1')):
        lab, s = A.components((cv.code == code) & (cv.mat == A.MAT['hair']))
        out += [('hair', h.pal.code_of(code), int(np.nonzero(lab == k)[1][0]), int(np.nonzero(lab == k)[0][0])) for k, n in s if n == 1]
    return out


def set_px(view, layer, pts, path=None):
    """the painter's pixel pass: set (x, y, char) in a layer of a head spec (the row becomes a literal row)"""
    p = Path(path) if path else LIBDIR / f'head_{view}.json'
    d = json.loads(p.read_text(encoding='utf-8'))
    rows = parse_rows(d['layers'][layer])
    for x, y, ch in pts:
        r = list(rows[y])
        r[x] = ch
        rows[y] = ''.join(r)
    d['layers'][layer] = [r if set(r) != {'.'} else '' for r in rows]
    A.jdump(d, p)


ONE_AXIS = {
    'eye_row': ('eye_near', 'eye_far', 'brow_near', 'brow_far', 'blush_near', 'blush_far'),   # the eye line 1 px higher
    'brow_raise': ('brow_near', 'brow_far'),                                                  # brows 1 px higher
    'mouth_row': ('mouth',),                                                                  # the mouth 1 px higher
}


def one_axis_variants(views=VIEWS):
    """WF-P04 for every painted face: three one-axis variants (eye line, brow height, mouth row), each moved
    1 px up from the base, saved to faces/r1/variants/ with variant_of / variant_axis, scored on FC+HR, and a
    pick sheet per view in review/rosace/construct/round-1/face/"""
    vdir = LIBDIR / 'variants'
    vdir.mkdir(parents=True, exist_ok=True)
    SHEETS.mkdir(parents=True, exist_ok=True)
    table = []
    for view in views:
        spec = load(view)
        exprs = [e for e in spec['expressions'] if not e.startswith('_')]
        rows = []
        for e in exprs:
            base = f'{view}_{e}_144'
            if not (LIBDIR / f'{base}.json').exists():
                continue
            ok0, bad0, _ = score(LIBDIR / f'{base}.json')
            panels = [(f'{e} base {len(ok0)}/{len(ok0) + len(bad0)}', A.zoom(A.on_bg(Image.open(LIBDIR / f'{base}.png').convert('RGBA')), 6))]
            full = spec['expressions'][e]
            conf = spec['expressions']['confident']
            for axis, keys in ONE_AXIS.items():
                ov = {}
                for k in keys:
                    src = full[k] if k in full else conf.get(k)
                    if src:
                        o = copy.deepcopy(src)
                        o['at'] = [o['at'][0], o['at'][1] - 1]
                        ov[k] = o
                name = f'{base}__{axis}'
                h, rec = build(view, e, None, False, name=name, out=vdir, spec=spec,
                               variant={'expressions': {e: ov}})
                rec['params'].update({'variant_of': base, 'variant_axis': axis})
                A.jdump(rec, vdir / f'{name}.json')
                ok, bad, _ = score(vdir / f'{name}.json')
                table.append({'base': base, 'axis': axis, 'passed': len(ok), 'failed': [b[:80] for b in bad],
                              'base_passed': len(ok0)})
                panels.append((f'{axis} {len(ok)}/{len(ok) + len(bad)}', A.zoom(A.on_bg(h.cv.image(h.pal)), 6)))
            rows.append(A.row_sheet(panels))
        if rows:
            A.stack([A.row_sheet([], title=f'{view}: one-axis variants per expression (WF-P04), x6; FC+HR pass counts')] + rows) \
                .save(SHEETS / f'{view}_one_axis_variants_x6.png') if False else \
                A.stack(rows).save(SHEETS / f'{view}_one_axis_variants_x6.png')
    A.jdump({'_doc': 'WF-P04 one-axis face variants (round R1): each moves one feature group 1 px up; the base is kept '
                     'unless a variant beats it on the rules and by eye (verdicts: ART-RULES 10, round R1)',
             'variants': table}, LIBDIR / 'variants_index.json')
    return table


if __name__ == '__main__':
    main()
