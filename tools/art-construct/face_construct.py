"""Construct a face the way an artist does: guides first, then block-in, then placed pixels.

  python tools/art-construct/face_construct.py --name q34_confident_144 [--params FILE.json]
         [--set yaw=q34 expression=confident gaze=-1,0 roll=1 ...] [--sheet] [--out DIR]
  python tools/art-construct/face_construct.py --batch art/rosace/construct/faces/set_q34_144.json --sheet

Steps (ART-RULES.md section 6, WF-P01, WF-P06):
  1. construction: head ball (Loomis, via Proko), side-plane oval, curved centre line for the yaw,
     the FC-P01 grid rows (chin 0, mouth, nose, eye bottom, lash top, brow, hairline, skull top,
     hair top), the jaw contour (FC-P08), the hair mass and the bang clump spines (HR-P01/P03)
  2. block-in: flat skin, flat hair mass, eye boxes, brow strokes, nose and mouth marks
  3. final: features from the authored library (art/rosace/construct/faces/feature_library_144.json)
     placed on the grid and tuned by parameters: gaze (iris offset), eye-line roll, brow raise,
     mouth corner, highlight placement; designed cast shadows; hair clump shading; outline
Writes <out>/<name>.json (stamp rows + face.json landmarks + params), <name>.png, <name>_ids.png,
<name>_parts.png, and with --sheet a construction sheet in review/rosace/construct/face/.

Coordinates: rows count up from the chin (row 0) as in ART-RULES; the canvas has the chin at
y = CHIN_Y. The head is authored facing screen-right; facing=left mirrors the finished face (the key
light also swaps sides, DESIGN 9, so the highlight stays on the lit side).
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

LIB = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'feature_library_144.json'
OUT = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces'
SHEETS = A.ROOT / 'review' / 'rosace' / 'construct' / 'face'
W, H, CHIN_Y = 38, 46, 36

DEFAULTS = {
    'head_px': 26,            # skull top to chin (FG-P01 / O-1: 24-26; 26 lets FC-P01 hair top 29 sit 3 px over the skull, HR-P02)
    'yaw': 'q34',             # front | q34 | profile
    'yaw_deg': 30,            # q34 turn; the centre line sits R*sin(yaw) toward the far side
    'facing': 'right',
    'expression': 'confident',
    'mouth': None,            # default: the expression's mouth
    'gaze': [-1, 0],          # iris offset in px (screen); viewer from a head turned right = -1
    'gaze_target': 'viewer',
    'roll': 1,                # eye-line tilt: far-side features move down this many rows
    'pitch': 0,               # rows the features move down (chin down = +1)
    'rows': {'mouth': 2, 'nose': 6, 'eye_bottom': 10, 'lash_top': 14, 'brow': 16, 'hairline': 20,
             'skull_top': 26, 'hair_top': 29},
    'eye_gap': 3,             # px between the inner corners (FC-P05: 3-4 in q34, 5-6 front)
    'far_margin': 2,          # skin columns beside the far eye at the eye row
    'cheek_bulge': 1,         # far contour bulge over rows 8-10 (FC-P08)
    'chin_w': 3, 'chin_dx': 1,  # chin point width and offset toward the far side (FC-P08)
    'nose_dx': 1,
    'mouth_dx': 0,
    'mouth_corner': 0,        # extra rows on the raised corner
    'brow_raise': 0,
    'highlight': 'edge',      # edge = on the iris's lit edge (touches the white) | inset (O-3 A/B)
    'pupil': False,
    'blush': True,
    'eye_row': 0,             # variant axis: whole eye line up (+) / down (-)
    'hairpin': True,
    'light': [0.6, -0.8],     # screen vector toward the key light (upper front, the facing side)
    'label': '',
    'variant_of': None, 'variant_axis': None,
}


def merged(base, over):
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = merged(out[k], v)
        else:
            out[k] = v
    return out


def parse_set(pairs):
    out = {}
    for p in pairs or []:
        k, v = p.split('=', 1)
        try:
            val = json.loads(v)
        except json.JSONDecodeError:
            val = [json.loads(x) for x in v.split(',')] if ',' in v else v
        cur = out
        ks = k.split('.')
        for kk in ks[:-1]:
            cur = cur.setdefault(kk, {})
        cur[ks[-1]] = val
    return out


class Face:
    """the construction and its three stages for one parameter set"""

    def __init__(self, params, lib=None):
        self.p = merged(DEFAULTS, params)
        self.lib = lib or json.loads(LIB.read_text(encoding='utf-8'))
        self.pal = A.Palette()
        self.g = A.Guides()          # construction layers
        self.lm = {}                 # landmarks (face.json)
        self.log = []                # construction notes, in order
        p = self.p
        k = p['head_px'] / 26.0
        self.rows = {n: int(round(v * k)) for n, v in p['rows'].items()}
        self.R = 0.44 * p['head_px']
        self.rb = self.rows['skull_top'] - self.R           # ball centre, rows above chin
        yaw = {'front': 0.0, 'q34': p['yaw_deg'], 'profile': 90.0}[p['yaw']]
        self.yaw = yaw
        self.xb = 15.5 if p['yaw'] != 'front' else W / 2.0
        if p['yaw'] == 'profile':
            self.xb = 14.5
        self.c0 = int(round(self.xb + self.R * math.sin(math.radians(yaw)))) if p['yaw'] != 'profile' \
            else int(round(self.xb + self.R - 1))
        self.shape = (H, W)

    # ------------------------------------------------------------ helpers
    def y(self, r):
        return CHIN_Y - r

    def rowmask(self, spans):
        """spans: {r: (x0, x1)} inclusive -> mask"""
        m = np.zeros(self.shape, bool)
        for r, (x0, x1) in spans.items():
            y = self.y(r)
            if 0 <= y < H:
                m[y, max(0, x0):min(W, x1 + 1)] = True
        return m

    @staticmethod
    def stairs(r_a, x_a, r_b, x_b):
        """per-row x from (r_a, x_a) to (r_b, x_b) with an even step rhythm (Bresenham)"""
        n = abs(r_b - r_a)
        out = {}
        for i in range(n + 1):
            r = r_a + (i if r_b > r_a else -i)
            out[r] = int(math.floor(x_a + (x_b - x_a) * i / max(1, n) + 0.5))
        return out

    # ------------------------------------------------------------ 1. construction
    def construct(self):
        p, g, R, rows = self.p, self.g, self.R, self.rows
        xb, c0, rb = self.xb, self.c0, self.rb
        cy = self.y(rb) + 0.5
        # head ball and side plane (Loomis: the ball's sides are sliced flat; the oval is 2/3 tall)
        g.circle((xb + 0.5, cy), R, (120, 200, 255), 2, layer='ball')
        yaw = math.radians(self.yaw)
        if p['yaw'] != 'front':
            sx = xb + 0.5 - 0.72 * R * math.cos(yaw)
            g.ellipse((sx, cy + 0.05 * R), 0.66 * R * max(0.15, math.sin(yaw)) * 0.9, 0.66 * R,
                      (120, 200, 255), 1, layer='ball')
        # curved centre line on the ball (x = xb + R sin(yaw) sqrt(1 - v^2)), then down the jaw
        pts = []
        for v in np.linspace(-0.98, 0.98, 25):
            yy = cy + v * R
            xx = xb + 0.5 + R * math.sin(yaw) * math.sqrt(max(0, 1 - v * v)) if p['yaw'] != 'profile' else c0 + 0.5
            pts.append((xx, yy))
        pts.append((c0 + p['chin_dx'] + 0.5, self.y(0) + 0.5))
        g.poly(pts, (255, 120, 200), 2, layer='ball')
        self.lm['centre_line'] = [[round(x - 0.5, 2), round(y - 0.5, 2)] for x, y in pts]
        # FC-P01 grid rows
        for n, r in rows.items():
            g.hline(self.y(r), 1, W - 4, (255, 230, 120), 1, label=f'{n} {r}', layer='grid')
        g.hline(self.y(0), 1, W - 4, (255, 230, 120), 1, label='chin 0', layer='grid')
        self.log.append(f'ball R={R:.1f} centre row {rb:.1f}; centre line at eye row x={c0} (yaw {self.yaw:.0f})')
        # ---- the face contour (jaw), per yaw
        far, near = {}, {}
        if p['yaw'] == 'q34':
            fw = self.lib['eyes']['q34_far']['box'][1]
            nw = self.lib['eyes']['q34_near']['box'][1]
            far_eye_x0 = c0 + 1                           # FC-P03: centre line 1 px inside the far inner corner
            far_eye_x1 = far_eye_x0 + fw - 1
            near_eye_x1 = far_eye_x0 - p['eye_gap'] - 1
            near_eye_x0 = near_eye_x1 - nw + 1
            fe = far_eye_x1 + p['far_margin']
            ne = near_eye_x0 - 2
            chin_l = c0 + p['chin_dx'] - p['chin_w'] // 2
            chin_r = chin_l + p['chin_w'] - 1
            for r in range(rows['eye_bottom'] + 1, rows['brow'] + 1):
                far[r] = fe
            for r in range(8, rows['eye_bottom'] + 1):
                far[r] = fe + p['cheek_bulge']
            far.update(self.stairs(7, fe, 0, chin_r))
            for r in range(rows['eye_bottom'], rows['brow'] + 1):
                near[r] = ne
            near.update(self.stairs(rows['eye_bottom'] - 1, ne, 1, chin_l - 1))
            near[0] = chin_l
            self.eyes = {'near': (near_eye_x0, nw, 'q34_near'), 'far': (far_eye_x0, fw, 'q34_far')}
        elif p['yaw'] == 'front':
            ew = self.lib['eyes']['front']['box'][1]
            gap = max(p['eye_gap'], 5)
            lx1 = c0 - (gap + 1) // 2 - 1 + (gap % 2 == 0)
            lx1 = c0 - gap // 2 - 1
            rx0 = lx1 + gap + 1
            lx0 = lx1 - ew + 1
            rx1 = rx0 + ew - 1
            fe, ne = rx1 + 1, lx0 - 1
            chin_l = c0 - p['chin_w'] // 2
            chin_r = chin_l + p['chin_w'] - 1
            for r in range(8, rows['brow'] + 1):
                far[r], near[r] = fe, ne
            far.update(self.stairs(7, fe, 0, chin_r))
            near.update(self.stairs(7, ne, 0, chin_l))
            self.eyes = {'near': (lx0, ew, 'front'), 'far': (rx0, ew, 'front_r')}
        else:  # profile, facing right: the front contour is the right edge
            pw = self.lib['eyes']['profile']['box'][1]
            front = {}
            for r in range(rows['brow'], rows['hairline'] + 3):
                front[r] = c0
            for r in range(rows['lash_top'] - 1, rows['brow']):
                front[r] = c0 - 1                       # brow ridge to eye socket step
            for r in range(rows['nose'] + 2, rows['lash_top'] - 1):
                front[r] = c0 - 1
            front[rows['nose'] + 1] = c0
            front[rows['nose']] = c0 + 1                 # the nose tip, 1 px out (slynyrd-29: almost none)
            front[rows['nose'] - 1] = c0 - 1
            for r in range(rows['mouth'] + 1, rows['nose'] - 1):
                front[r] = c0 - 1
            front[rows['mouth']] = c0 - 2
            front[1] = c0 - 1
            front[0] = c0 - 2
            far = front
            back = c0 - 11
            for r in range(8, rows['hairline'] + 3):
                near[r] = back
            near.update(self.stairs(7, back + 1, 0, c0 - 5))
            ex1 = c0 - 2
            self.eyes = {'near': (ex1 - pw + 1, pw, 'profile')}
        self.far_edge, self.near_edge = far, near
        # jaw and contour guide
        cont = [(near[r] + 0.0, self.y(r) + 0.5) for r in sorted(near, reverse=True)]
        cont += [(far[r] + 1.0, self.y(r) + 0.5) for r in sorted(far)]
        g.poly(cont, (255, 150, 80), 2, closed=True, layer='jaw')
        # eye boxes, nose, mouth, chin marks (the targets before any pixel)
        lt = rows['lash_top'] + p['eye_row']
        for side, (x0, w, key) in self.eyes.items():
            dr = self.roll_rows(x0 + w / 2.0)
            g.box(x0, self.y(lt) + dr, x0 + w - 1, self.y(lt - 4) + dr, (140, 255, 160), 1, layer='marks')
        nx = c0 + p['nose_dx']
        g.box(nx, self.y(rows['nose'] + 1), nx, self.y(rows['nose']), (140, 255, 160), 1, layer='marks')
        g.box(c0 + p['mouth_dx'] - 1, self.y(rows['mouth'] + 1), c0 + p['mouth_dx'] + 1, self.y(rows['mouth']),
              (140, 255, 160), 1, layer='marks')
        # hair mass: a shell 3 px off the ball (HR-P02), hairline, clump spines from the parting
        hr = rows['hair_top'] - rb
        g.circle((xb - 0.3, cy), hr, (190, 150, 255), 2, layer='hair')
        g.hline(self.y(rows['hairline']), int(xb - R), int(xb + R), (190, 150, 255), 1, label=None, layer='hair')
        self.clumps = []
        for cl in self.lib['bangs'][p['yaw'] if p['yaw'] in self.lib['bangs'] else 'q34']:
            r0 = (c0 + cl['root'][0] + 0.5, self.y(cl['root'][1]) + 0.5)
            # a rolled head moves the far-side tips with the far eye (the hair is on the same skull)
            troll = p['roll'] if (p['yaw'] != 'profile' and cl['tip'][0] > 0) else 0
            r1 = (c0 + cl['tip'][0] + 0.5, self.y(cl['tip'][1]) + troll + 0.5)
            mid = ((r0[0] + r1[0]) / 2 + cl['bend'], (r0[1] + r1[1]) / 2)
            spine = A.bezier(r0, mid, r1, 24)
            self.clumps.append((cl, spine))
            g.poly(spine, (230, 170, 255), 2, layer='hair')
        self.log.append(f'contour: far edge {min(far.values())}-{max(far.values())}, chin rows 0 at '
                        f'{far.get(0)}; {len(self.clumps)} bang clumps')

    def roll_rows(self, x):
        """rows (screen y) a feature at column x moves for the eye-line roll and the pitch"""
        p = self.p
        dr = p['pitch']
        if p['roll'] and p['yaw'] != 'profile' and x > self.c0:
            dr += p['roll']
        return dr

    # ------------------------------------------------------------ masks shared by block-in and final
    def masks(self):
        p, rows, R = self.p, self.rows, self.R
        xb, c0 = self.xb, self.c0
        cy = self.y(self.rb) + 0.5
        shape = self.shape
        # face skin: contour rows, plus the forehead up to under the hairline, inside the ball
        spans = {r: (self.near_edge[r], self.far_edge[r]) for r in self.far_edge if r in self.near_edge}
        face = self.rowmask(spans)
        ball = A.ellipse_mask((xb + 0.5, cy), R, R, shape)
        fore = ball.copy()
        fore[self.y(rows['brow']) + 1:, :] = False
        fore[:self.y(rows['hairline'] + 2), :] = False
        if p['yaw'] == 'q34':
            fore[:, :self.near_edge[rows['brow']]] = False
        face |= fore
        # neck (for the stand-alone stamp and the under-chin shadow)
        neck = np.zeros(shape, bool)
        nx0 = c0 + p['chin_dx'] - 4 if p['yaw'] != 'profile' else c0 - 9
        for y in range(self.y(0) - 1, H):
            neck[y, nx0:nx0 + 8] = True
        neck &= ~face
        # hair: cap shell, far lock behind the face, near sidelock in front, bang clumps in front
        hr = rows['hair_top'] - self.rb + 0.5
        cap = A.ellipse_mask((xb - 0.3, cy), hr, hr, shape)
        cap[self.y(rows['eye_bottom'] - 2):, :] = False
        back = np.zeros(shape, bool)
        if p['yaw'] != 'front':
            # the back of the head falls into the back hair (the figure continues it down)
            back = A.poly_mask([(xb - hr - 0.3, cy), (xb - 3, cy), (xb - 4, H), (xb - hr + 1, H)], shape)
        far_lock = np.zeros(shape, bool)
        near_lock = np.zeros(shape, bool)
        if p['yaw'] == 'q34':
            fx = self.far_edge[rows['eye_bottom'] + 1] + 1
            # the far lock stops just under the jaw so the far neck and shoulder line stay visible (CL-N02)
            far_lock = A.poly_mask([(fx - 2, self.y(rows['brow'])), (fx + 3.2, self.y(rows['brow'])),
                                    (fx + 2.6, self.y(-3)), (fx - 1.5, self.y(-2))], shape)
            nxl = self.near_edge[rows['brow']]
            near_lock = A.poly_mask([(nxl - 3.5, self.y(rows['hairline'] + 1)), (nxl + 1.6, self.y(rows['hairline'])),
                                     (nxl + 1.0, self.y(rows['eye_bottom'] + 1)), (nxl + 0.4, H - 1),
                                     (nxl - 3.8, H - 1)], shape)
        elif p['yaw'] == 'front':
            for sgn, e in ((-1, self.near_edge), (1, self.far_edge)):
                ex = e[rows['brow']]
                x_in = ex + (1 if sgn < 0 else 0)
                near_lock |= A.poly_mask([(x_in - 0.5 * sgn, self.y(rows['hairline'])), (x_in + 3.8 * sgn, self.y(rows['hairline'])),
                                          (x_in + 3.4 * sgn, H - 1), (x_in + 0.6 * sgn, H - 1)], shape)
        clumps = []
        for cl, spine in self.clumps:
            m = np.zeros(shape, bool)
            n = len(spine)
            for i in range(n - 1):
                t0, t1 = i / (n - 1), (i + 1) / (n - 1)
                r0 = (cl['w'][0] + (cl['w'][1] - cl['w'][0]) * t0) / 2.0
                r1 = (cl['w'][0] + (cl['w'][1] - cl['w'][0]) * t1) / 2.0
                m |= A.capsule_mask(spine[i], spine[i + 1], max(0.45, r0), max(0.45, r1), shape)
            clumps.append(m)
        bangs = np.zeros(shape, bool)
        for m in clumps:
            bangs |= m
        # the hairline band above the forehead is all hair (roots of the clumps)
        band = cap & A.dilate(bangs, 2) & (np.arange(H)[:, None] <= self.y(rows['hairline'] + 1))
        return dict(face=face, neck=neck, cap=cap, back=back, far_lock=far_lock, near_lock=near_lock,
                    clumps=clumps, bangs=bangs | band)

    # ------------------------------------------------------------ 2. block-in
    def blockin(self):
        pal, m = self.pal, self.masks()
        cv = A.Canvas(W, H)
        I = pal.i
        hair_behind = m['cap'] | m['back'] | m['far_lock']
        cv.put(hair_behind, I('I2'), A.MAT['hair'], A.PART['hair_back'])
        cv.put(m['neck'], I('S2'), A.MAT['skin'], A.PART['neck'])
        cv.put(m['face'], I('S2'), A.MAT['skin'], A.PART['face'])
        cv.put(m['bangs'] | m['near_lock'], I('I2'), A.MAT['hair'], A.PART['hair_front'])
        lt = self.rows['lash_top'] + self.p['eye_row']
        for side, (x0, w, key) in self.eyes.items():
            dr = self.roll_rows(x0 + w / 2.0)
            box = np.zeros(self.shape, bool)
            box[self.y(lt) + dr:self.y(lt - 4) + dr + 1, x0:x0 + w] = True
            cv.put(box, I('W2'), A.MAT['eye'], A.PART['eye'])
            cv.put(box & (np.arange(H)[:, None] == self.y(lt) + dr), I('OL'), A.MAT['line'], A.PART['eye'])
        c0 = self.c0
        cv.code[self.y(self.rows['nose']), c0 + self.p['nose_dx']] = I('S4')
        cv.code[self.y(self.rows['mouth']), c0 + self.p['mouth_dx'] - 1:c0 + self.p['mouth_dx'] + 2] = I('S4')
        self.masks_cache = m
        return cv

    # ------------------------------------------------------------ 3. final pixels
    def final(self):
        p, pal, rows = self.p, self.pal, self.rows
        I = pal.i
        m = self.masks_cache if hasattr(self, 'masks_cache') else self.masks()
        cv = A.Canvas(W, H)
        c0 = self.c0
        L = np.array(p['light'], float)
        L /= np.linalg.norm(L)
        cy = self.y(self.rb) + 0.5
        yy, xx = np.mgrid[0:H, 0:W]
        # --- hair behind the face: cap + back + far lock, shaded as one mass on the ball
        behind = m['cap'] | m['back'] | m['far_lock']
        hr = rows['hair_top'] - self.rb + 0.5
        dot = ((xx + 0.5 - (self.xb - 0.3)) * L[0] + (yy + 0.5 - cy) * L[1]) / hr
        tone = np.full(self.shape, I('I2'), np.int16)
        tone[dot < -0.25] = I('I3')
        tone[(dot > 0.58) & (yy < self.y(rows['brow']))] = I('I1')
        back_only = m['back'] & ~m['cap']
        tone[back_only] = I('I2')
        tone[back_only & ~A.shift(back_only, 2, 0)] = I('I3')         # the away-from-light edge
        fl = m['far_lock'] & ~m['cap']
        tone[fl] = I('I2')
        tone[fl & ~A.shift(fl, -1, 0) & ~A.shift(fl, -2, 0)] = I('I1')  # lit outer edge
        tone[fl & A.shift(m['face'] | m['neck'], 1, 0)] = I('I3')         # in the face's shadow
        cv.put(behind, tone, A.MAT['hair'], A.PART['hair_back'])
        # --- neck with the sharp under-chin cast shadow (FC-P16: S4 on the neck)
        cv.put(m['neck'], I('S2'), A.MAT['skin'], A.PART['neck'])
        chin_sh = m['neck'] & (yy <= self.y(0) + 3)
        # the shadow follows the jaw: 2-3 rows under the jaw line, lit side shorter
        for x in range(W):
            col = np.nonzero(m['neck'][:, x])[0]
            if len(col):
                d = 3 if x <= c0 + 1 else 2
                chin_sh[col[0] + d:, x] = False
        cv.put(chin_sh, I('S4'), A.MAT['skin'], A.PART['neck'])
        # --- face skin: flat S2 under the lash line (FC-P16)
        cv.put(m['face'], I('S2'), A.MAT['skin'], A.PART['face'])
        # far jaw line S3 under the cheekbone (FC-P16 one S3 cluster; FC-P18 far jaw in S3 not S4)
        if p['yaw'] == 'q34':
            x = self.far_edge[6]                      # a 2 px cluster, not two diagonal singles (FC-N15)
            for r in (6, 7):
                cv.code[self.y(r), x] = I('S3')
        # --- bangs and locks in front: clump shading, back to front (the side locks first, then
        # the clumps from the near side to the far side, so each later clump's left edge is the split)
        front = m['bangs'] | m['near_lock']
        hl_y = self.y(rows['hairline'])
        above = yy < hl_y                                    # above the hairline the clumps are the cap
        cap_tone = np.full(self.shape, I('I2'), np.int16)
        cap_tone[dot > 0.58] = I('I1')
        cap_tone[dot < -0.25] = I('I3')
        cv.put(front, cap_tone, A.MAT['hair'], A.PART['hair_front'])
        nl = m['near_lock']
        if nl.any():
            body = nl & ~above
            cv.put(body, I('I2'), A.MAT['hair'], A.PART['hair_front'])
            cv.put(body & ~A.shift(nl, 1, 0), I('I3'), A.MAT['hair'])          # shadow (left) edge
        order = sorted(range(len(m['clumps'])), key=lambda i: self.clumps[i][1][0][0])
        drawn = nl.copy()
        for i in order:
            cm = m['clumps'][i]
            body = cm & ~above
            cv.put(body, I('I2'), A.MAT['hair'], A.PART['hair_front'])
            left = body & ~A.shift(cm, 1, 0)
            right = body & ~A.shift(cm, -1, 0)
            sep = left & A.shift(drawn, 1, 0)                                 # over an earlier clump
            cv.put(sep, I('I4'), A.MAT['hair'])
            cv.put(left & ~sep, I('I3'), A.MAT['hair'])
            # the lit plane: the right edge of the upper half of the clump (key light upper right)
            lit_edge = right & (yy < hl_y + 4)
            lit_edge &= A.shift(lit_edge, 0, 1) | A.shift(lit_edge, 0, -1)      # no 1 px specks (HR-N02)
            cv.put(lit_edge, I('I1'), A.MAT['hair'])
            drawn |= cm
        # a lit edge a later clump cut down to 1 px is a speck (HR-N02): back to the mid tone
        lit = (cv.code == I('I1')) & (cv.part == A.PART['hair_front'])
        lab, sizes = A.components(lit)
        for k_, n_ in sizes:
            if n_ == 1:
                cv.code[lab == k_] = I('I2')
        # bang tips meet the skin with their dark tone (FC-P18: the hair's dark tone is the edge)
        cv.put(front & A.shift(m['face'] & ~front, 0, -1) & ~above, I('I3'), A.MAT['hair'])
        # crown highlight band: one I0 dash per clump, tapering along the flow (HR-P08)
        hb = rows['hair_top'] - 5
        for cl, spine in self.clumps:
            x = int(c0 + cl['root'][0])
            y0 = self.y(hb)
            for j, (dx, dy) in enumerate(((0, 0), (1, 0))):
                xx_, yy_ = x + dx, y0 + dy
                if 0 <= yy_ < H and 0 <= xx_ < W and cv.part[yy_, xx_] in (A.PART['hair_back'], A.PART['hair_front']) \
                        and cv.code[yy_, xx_] != I('I3'):
                    cv.code[yy_, xx_] = I('I0') if j < 2 else I('I1')
        # --- cast shadow of the bangs on the forehead (sharp, S3; 2 px under the wide part)
        hairfront = cv.part == A.PART['hair_front']
        skin = cv.part == A.PART['face']
        cast = skin & A.shift(hairfront, 0, 1)
        wide = A.shift(hairfront & A.shift(hairfront, 1, 0) & A.shift(hairfront, -1, 0), 0, 2)
        cast |= skin & wide & A.shift(cast, 0, 1)
        cast &= yy < self.y(rows['eye_bottom'] - 1)
        # a shading cluster is >= 2 px (FC-N15): drop single cast-shadow pixels
        lab, sizes = A.components(cast)
        for k_, n_ in sizes:
            if n_ < 2:
                cast[lab == k_] = False
        cv.put(cast, I('S3'), A.MAT['skin'])
        # --- features
        self.place_eyes(cv)
        self.place_brows(cv)
        self.place_mouth_nose(cv)
        if p['blush']:
            self.place_blush(cv)
        if p['hairpin'] and p['yaw'] != 'profile':
            hx, hy = int(self.xb - 5), self.y(rows['hair_top'] - 2)
            for (dx, dy), c in (((0, 0), 'G1'), ((1, 0), 'G2'), ((0, 1), 'G2'), ((1, 1), 'G3')):
                cv.code[hy + dy, hx + dx] = I(c)
                cv.mat[hy + dy, hx + dx] = A.MAT['gold']
        # --- outline: the silhouette gets OL outside (the figure re-does this on the whole body)
        sil = cv.filled()
        ring = A.ring_out(sil)
        ring[H - 1:, :] = False
        cv.put(ring, I('OL'), A.MAT['line'], 0)
        if p['facing'] == 'left':
            cv.code, cv.mat, cv.part = cv.code[:, ::-1].copy(), cv.mat[:, ::-1].copy(), cv.part[:, ::-1].copy()
            self.mirror_landmarks()
        self.final_cv = cv
        return cv

    def place_eyes(self, cv):
        p, pal, rows, lib = self.p, self.pal, self.rows, self.lib
        I = pal.i
        expr = p['expression']
        lt = rows['lash_top'] + p['eye_row']
        self.lm['eyes'] = {}
        for side, (x0, w, key) in self.eyes.items():
            mirror = key == 'front_r'
            tk = 'front' if mirror else key
            spec = lib['eyes'][tk]
            tpl = spec.get(expr) or spec['confident']
            if mirror:
                tpl = [r[::-1] for r in tpl]
            bx0 = spec['box'][0] if not mirror else len(tpl[0]) - spec['box'][0] - spec['box'][1]
            gx0 = x0 - bx0                       # grid column 0 on the canvas
            dr = self.roll_rows(x0 + w / 2.0)
            gy0 = self.y(lt + spec['row0']) + dr
            opening = np.zeros(self.shape, bool)
            lash = []
            for j, row in enumerate(tpl):
                for i, ch in enumerate(row):
                    X, Y = gx0 + i, gy0 + j
                    if not (0 <= X < W and 0 <= Y < H) or ch == '.':
                        continue
                    if ch == 'O':
                        cv.code[Y, X] = I('OL'); cv.mat[Y, X] = A.MAT['line']; cv.part[Y, X] = A.PART['eye']
                        lash.append((X, Y))
                    elif ch == 'L':
                        cv.code[Y, X] = I('I3'); cv.mat[Y, X] = A.MAT['line']; cv.part[Y, X] = A.PART['eye']
                    elif ch == 'G':
                        cv.code[Y, X] = I('A4'); cv.mat[Y, X] = A.MAT['eye']; cv.part[Y, X] = A.PART['eye']
                    elif ch == '~':
                        opening[Y, X] = True
            info = {'box': [x0, self.y(lt) + dr, x0 + w - 1, self.y(lt - 4) + dr], 'template': tk,
                    'mirrored': mirror, 'lash_px': len(lash)}
            if opening.any():
                self.fill_iris(cv, opening, side, info, expr)
            self.lm['eyes'][side] = info
        self.lm['gaze'] = {'dx': p['gaze'][0], 'dy': p['gaze'][1], 'target': p['gaze_target']}

    def fill_iris(self, cv, opening, side, info, expr):
        p, pal, lib = self.p, self.pal, self.lib
        I = pal.i
        ys, xs = np.nonzero(opening)
        rows_open = sorted(set(ys))
        # iris columns: centred on the widest open row, moved by the gaze
        widths = {y: xs[ys == y] for y in rows_open}
        wy = max(rows_open, key=lambda y: len(widths[y]))
        cx = (widths[wy].min() + widths[wy].max()) / 2.0
        iw = 3 if len(widths[wy]) >= 4 else 2
        ix0 = int(math.floor(cx - (iw - 1) / 2.0 + 0.5)) + int(p['gaze'][0])
        ix0 = max(widths[wy].min(), min(ix0, widths[wy].max() - iw + 1))
        icols = list(range(ix0, ix0 + iw))
        table = lib['iris']['ignited' if expr == 'ignited' else 'normal']
        irows = [y for y in rows_open if any(opening[y, c] for c in icols)]
        pick = {3: [0, 1, 2], 2: [0, 2], 1: [1]}.get(len(irows), list(range(len(irows))))
        lit_right = p['light'][0] > 0
        hl = None
        for k, y in enumerate(irows):
            trow = table[min(pick[k] if k < len(pick) else 2, 2)]
            if iw == 2:
                trow = trow[0] + trow[2]
            for j, x in enumerate(icols):
                if not opening[y, x]:
                    continue
                ch = trow[j]
                cv.code[y, x] = I(A.KEY[ch]); cv.mat[y, x] = A.MAT['eye']; cv.part[y, x] = A.PART['eye']
        # highlight on the top iris row, lit side (FC-P12); 'inset' moves it 1 px in (O-3 A/B)
        if irows and expr != 'ignited':
            y = irows[0]
            x = icols[-1] if lit_right else icols[0]
            if p['highlight'] == 'inset' and iw >= 3:
                x = icols[-2] if lit_right else icols[1]
            cv.code[y, x] = I('A5')
            hl = (x, y)
        if p['pupil'] and len(irows) >= 2:
            y = irows[1]
            x = icols[0] if p['gaze'][0] < 0 else icols[-1]
            cv.code[y, x] = I('I3')
        # whites: the rest of the opening, W2 in the lid-shadow row and beside the highlight
        wl = lib['whites']
        whites = []
        for y, x in zip(ys, xs):
            if x in icols and y in irows:
                continue
            ch = wl['top'] if y == rows_open[0] else wl['rest']
            if hl and abs(x - hl[0]) + abs(y - hl[1]) == 1:
                ch = wl['beside_highlight']
            cv.code[y, x] = I(A.KEY[ch]); cv.mat[y, x] = A.MAT['eye']; cv.part[y, x] = A.PART['eye']
            whites.append((int(x), int(y)))
        info.update({'iris_cols': icols, 'iris_rows': [int(y) for y in irows], 'iris_w': iw,
                     'highlight': list(hl) if hl else None, 'whites': whites,
                     'white_side': (None if not whites else
                                    ('right' if np.mean([w[0] for w in whites]) > np.mean(icols) else 'left'))})

    def place_brows(self, cv):
        p, pal, rows, lib = self.p, self.pal, self.rows, self.lib
        I = pal.i
        expr = p['expression']
        lt = rows['lash_top'] + p['eye_row']
        self.lm['brows'] = {}
        for side, (x0, w, key) in self.eyes.items():
            bside = 'near' if side == 'near' else 'far'
            spec = lib['brows'][bside]
            grid = spec.get(expr) or spec['confident']
            mirror = key == 'front_r' or (key == 'front' and False)
            if key == 'front_r':
                grid = [r[::-1] for r in lib['brows']['near'].get(expr, lib['brows']['near']['confident'])]
                dx = w - len(grid[0]) - lib['brows']['near']['dx']
            else:
                dx = spec['dx']
            if key == 'profile':
                dx = spec['dx'] - 1
            dr = self.roll_rows(x0 + w / 2.0)
            gy0 = self.y(lt + 4 + p['brow_raise']) + dr
            px = []
            for j, row in enumerate(grid):
                for i, ch in enumerate(row):
                    if ch != '#':
                        continue
                    X, Y = x0 + dx + i, gy0 + j
                    if not (0 <= X < W and 0 <= Y < H):
                        continue
                    on_hair = cv.mat[Y, X] == A.MAT['hair']
                    cv.code[Y, X] = I('OL') if on_hair else I('I3')
                    cv.mat[Y, X] = A.MAT['line']
                    px.append((X, Y))
            self.lm['brows'][side] = px

    def place_mouth_nose(self, cv):
        p, pal, rows, lib = self.p, self.pal, self.rows, self.lib
        I = pal.i
        c0 = self.c0
        expr = p['expression']
        mk = p['mouth'] or expr
        spec = lib['mouths'].get(mk) or lib['mouths']['confident']
        grid = spec['rows']
        ax = c0 + p['mouth_dx'] - spec['ax']
        if p['yaw'] == 'profile':
            ax = self.far_edge[rows['mouth']] - len(grid[0]) + 1
        gy0 = self.y(rows['mouth'] + 2) + p['pitch']
        mpx = []
        for j, row in enumerate(grid):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                X, Y = ax + i, gy0 + j
                if ch == 't' and p['mouth_corner']:
                    Y -= p['mouth_corner']
                cv.code[Y, X] = I(A.KEY[ch]); cv.mat[Y, X] = A.MAT['skin']
                mpx.append((X, Y, A.KEY[ch]))
        self.lm['mouth'] = {'key': mk, 'px': mpx}
        # nose: 1 x 2 S3 mark toward the far side (q34), 1 px front, the contour bump in profile
        npx = []
        if p['yaw'] == 'q34':
            nx = c0 + p['nose_dx']
            for r in (rows['nose'] + 1, rows['nose']):
                npx.append((nx, self.y(r) + p['pitch']))
        elif p['yaw'] == 'front':
            npx.append((c0, self.y(rows['nose']) + p['pitch']))
        for X, Y in npx:
            cv.code[Y, X] = I('S3')
        self.lm['nose'] = npx

    def place_blush(self, cv):
        p, pal, rows, lib = self.p, self.pal, self.rows, self.lib
        I = pal.i
        eb = rows['eye_bottom'] + p['eye_row']
        self.lm['blush'] = {}
        for side, (x0, w, key) in self.eyes.items():
            spec = lib['blush']['near' if side == 'near' else 'far']
            grid = spec['rows']
            dx = spec['dx']
            if key == 'front_r':
                grid = [r[::-1] for r in lib['blush']['near']['rows']]
                dx = w - len(grid[0])
            dr = self.roll_rows(x0 + w / 2.0)
            gy0 = self.y(eb - 1) + dr
            px = []
            for j, row in enumerate(grid):
                for i, ch in enumerate(row):
                    if ch != 'p':
                        continue
                    X, Y = x0 + dx + i, gy0 + j
                    if cv.code[Y, X] == I('S2'):      # SB only on S2 (FC-P17)
                        cv.code[Y, X] = I('SB')
                        px.append((X, Y))
            self.lm['blush'][side] = px

    def mirror_landmarks(self):
        pass  # landmarks are recorded facing right; the json says facing=left and consumers mirror

    # ------------------------------------------------------------ outputs
    def landmarks(self):
        p, rows = self.p, self.rows
        cv = self.final_cv
        skin = cv.part == A.PART['face']
        eye_row_y = self.y(rows['eye_bottom'])
        xs = np.nonzero((cv.part[eye_row_y] == A.PART['face']) | (cv.part[eye_row_y] == A.PART['eye']))[0]
        lm = {
            'facing': p['facing'], 'yaw': p['yaw'], 'yaw_deg': self.yaw, 'expression': p['expression'],
            'head_px': p['head_px'], 'chin_y': CHIN_Y, 'rows_above_chin': rows,
            'skull_top_row': rows['skull_top'], 'hair_top_row': rows['hair_top'],
            'hair_top_measured': int(CHIN_Y - np.nonzero((cv.mat == A.MAT['hair']).any(1))[0].min()),
            'centre_line_x_at_eye_row': self.c0,
            'face_width_eye_row': {'y': eye_row_y, 'x0': int(xs.min()) if len(xs) else None,
                                   'x1': int(xs.max()) if len(xs) else None},
            'far_edge': {int(k): int(v) for k, v in self.far_edge.items()},
            'near_edge': {int(k): int(v) for k, v in self.near_edge.items()},
            'gaze_target': p['gaze_target'],
            'origin': [self.c0 + p['chin_dx'], CHIN_Y],
            'light': p['light'],
        }
        lm.update({k: v for k, v in self.lm.items() if k != 'centre_line'})
        lm['centre_line'] = self.lm.get('centre_line')
        return lm

    def record(self, name):
        pal = self.pal
        cv = self.final_cv
        return {
            '_doc': 'Constructed face stamp (tools/art-construct/face_construct.py). rows use the KEY in '
                    'tools/art-construct/artlib.py; origin = [column, row] of the chin point; landmarks follow the '
                    'face.json schema in docs/character/art-rules/checklist.json inputs. Rows count up from the chin. '
                    'Built facing screen-right; facing=left means the pixels are mirrored.',
            'name': name, 'params': self.p, 'construction_log': self.log,
            'landmarks': self.landmarks(),
            'rows': A.codes_to_grid(cv.code, pal),
        }


def sheet(face, name, refs=True):
    """construction sheet: guides alone, guides over block-in, block-in, final, final + grid, 1x/3x,
    greyscale; with refs, the 07/08/09 face crops at the same zoom"""
    pal = face.pal
    Z = 10
    bg = (104, 102, 98)
    blank = Image.new('RGB', (W, H), bg)
    bi = A.on_bg(face.block_cv.image(pal), bg)
    fin_img = face.final_cv.image(pal)
    fi = A.on_bg(fin_img, bg)
    g = face.g
    p1 = g.draw(A.zoom(blank, Z), Z, layers=('ball', 'grid'))
    p2 = g.draw(A.zoom(Image.blend(blank, bi, 0.35), Z), Z, layers=('ball', 'jaw', 'hair', 'marks'))
    p3 = g.draw(A.zoom(bi, Z), Z, layers=('marks',))
    p4 = A.zoom(fi, Z)
    p5 = g.draw(A.zoom(fi, Z), Z, layers=('grid', 'jaw'))
    top = A.row_sheet([('1 ball, side plane, centre line, grid', p1), ('2 jaw, hair mass, clumps, feature boxes', p2),
                       ('3 block-in', p3), ('4 final', p4), ('5 final on the grid', p5)],
                      title=f'{name}  |  construction  |  x{Z}  |  ' + '; '.join(face.log[:2]))
    small = [('1x', A.zoom(fi, 1)), ('3x', A.zoom(fi, 3)), ('6x', A.zoom(fi, 6)), ('grey 6x', A.zoom(A.greyscale(fi), 6)),
             ('mirror 6x (flip test)', A.zoom(fi.transpose(Image.FLIP_LEFT_RIGHT), 6))]
    rows = [top, A.row_sheet(small, title='read at game size and flipped (WF-P07, WF-P08)')]
    if refs:
        rp = ref_faces()
        if rp:
            rows.append(A.row_sheet([(f'{k} x6', A.zoom(v, 6)) for k, v in rp] + [('ours x6', A.zoom(fi, 6))],
                                    title='same zoom as the finish-bar faces (third-party refs: review/ only)'))
    return A.stack(rows)


REF_FACES = {  # native-grid head crops: the 'idle head overview' boxes of review/rosace/construct/research/face/_index.json
    'ref07': ('07-anim-amberowl-wrench_top_native-p2.png', (104, 40, 142, 80)),
    'ref08': ('08-anim-amberowl-lys-lightning_top_native-p2.png', (100, 60, 140, 100)),
    'ref09': ('09-anim-amberowl-katana-cats_1x.png', (134, 34, 176, 80)),
}


def ref_faces():
    nat = A.ROOT / 'review' / 'refs' / 'character' / 'native'
    out = []
    for k, (f, box) in REF_FACES.items():
        fp = nat / f
        if fp.exists():
            out.append((k, Image.open(fp).convert('RGB').crop(box)))
    return out


def build(name, params, out=OUT, do_sheet=False, lib=None):
    f = Face(params, lib)
    f.construct()
    f.block_cv = f.blockin()
    f.final()
    rec = f.record(name)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    A.jdump(rec, out / f'{name}.json')
    f.final_cv.save(f.pal, out / f'{name}.png')
    f.final_cv.save_layers(str(out / name))
    if do_sheet:
        SHEETS.mkdir(parents=True, exist_ok=True)
        s = sheet(f, name)
        s.save(SHEETS / f'{name}_construct.png')
    return f, rec


# WF-P04: each variant differs from its base on exactly one axis (ART-RULES 1)
VARIANT_AXES = {
    'eye_row': {'eye_row': 1},                  # eye line 1 px higher
    'iris_offset': {'gaze': 'centre'},          # irises centred instead of shifted to the target
    'brow_angle': {'brow_raise': 1},            # brows 1 px up
    'mouth_corner': {'mouth_corner': 1},        # the raised corner 1 px higher
    'highlight': {'highlight': 'inset'},        # open question O-3: highlight off the white
}
DEFAULT_AXES = ('eye_row', 'iris_offset', 'mouth_corner')


def variants(batch_path, out=OUT, axes=DEFAULT_AXES, extra=None):
    """3+ one-axis variants per face of a batch file, into <out>/variants/, plus a pick sheet per face
    with the base, the variants and the ref faces at the same zoom"""
    b = json.loads(Path(batch_path).read_text(encoding='utf-8'))
    vdir = Path(out) / 'variants'
    vdir.mkdir(parents=True, exist_ok=True)
    SHEETS.mkdir(parents=True, exist_ok=True)
    made = []
    for name, prm in b['faces'].items():
        base = merged(b.get('base', {}), prm)
        ax_list = list(axes) + list((extra or {}).get(base.get('expression'), []))
        panels = []
        f0, _ = build(name, base, out, False)
        panels.append(('base', A.zoom(A.on_bg(f0.final_cv.image(f0.pal)), 6)))
        for ax in ax_list:
            over = dict(VARIANT_AXES[ax])
            if over.get('gaze') == 'centre':
                over['gaze'] = [0, base.get('gaze', [0, 0])[1]]
            vp = merged(base, over)
            vp['variant_of'] = name
            vp['variant_axis'] = ax
            vn = f'{name}__{ax}'
            f, rec = build(vn, vp, vdir, False)
            made.append(vn)
            panels.append((ax, A.zoom(A.on_bg(f.final_cv.image(f.pal)), 6)))
        panels += [(k, A.zoom(v, 6)) for k, v in ref_faces()]
        A.row_sheet(panels, title=f'{name}: one-axis variants (WF-P04) beside the refs, all x6').save(
            SHEETS / f'{name}_variants.png')
    return made


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--name', default='q34_confident_144')
    ap.add_argument('--params', help='json file of parameters (merged over the defaults)')
    ap.add_argument('--set', nargs='*', help='key=value overrides (dotted keys for rows.*)')
    ap.add_argument('--batch', help='json: {"base": {...}, "faces": {name: {...}, ...}}')
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--out', default=str(OUT))
    ap.add_argument('--variants', action='store_true', help='with --batch: build one-axis variants (WF-P04)')
    a = ap.parse_args()
    if a.batch and a.variants:
        made = variants(a.batch, a.out, extra={'confident': ['highlight', 'brow_angle']})
        print(len(made), 'variants:', ', '.join(made))
        return
    if a.batch:
        b = json.loads(Path(a.batch).read_text(encoding='utf-8'))
        for name, prm in b['faces'].items():
            f, rec = build(name, merged(b.get('base', {}), prm), a.out, a.sheet)
            print(name, 'ok', rec['landmarks']['face_width_eye_row'])
        return
    prm = json.loads(Path(a.params).read_text(encoding='utf-8')) if a.params else {}
    prm = merged(prm, parse_set(a.set))
    f, rec = build(a.name, prm, a.out, a.sheet)
    print('\n'.join(rec['rows']))
    print(json.dumps(rec['landmarks']['face_width_eye_row']), f.log)


if __name__ == '__main__':
    main()
