"""Round R2 figure: the R1 gesture/mannequin/part-model route (figure_paint.py) with the R2 painted head,
a reworked gesture, fuller masses, and designed paint passes on top of the part models.

  python tools/art-construct/figure_r2.py art/rosace/construct/figure/idle_hero_r2.gesture.json --thumbs
  python tools/art-construct/figure_r2.py art/rosace/construct/figure/idle_hero_r2.gesture.json --ref --sheet
  python tools/art-construct/rules_check.py --sprite art/rosace/construct/figure/idle_hero_r2 --faces art/rosace/construct/faces/r2

What R2 adds (ART-RULES 10, round R2), in the order an artist works (WF-P06):
  1. gesture: thumbnails of the near arm and the glaive (the R1 arm reached out level at full length, a
     flag-holder read); the spec's `thumbnails` hold every trial and its verdict.
  2. masses: fuller thighs and hips, a calf whose bulge sits high on the outside and low on the inside
     (proko-calf: "high on the outside, low on the inside"), a rounder shoulder.
  3. the painted R2 head (heads_r2.py via face_r2.py), Confident with its 1 px roll.
  4. hands painted as pixel grids (`HANDS` below) at the gesture's hand points, instead of capsules.
  5. paint passes (each switchable under `render` in the spec for A/Bs): the bodice's form (a terminator that
     follows the rib cage, a cast shadow under the bust, one W1 cluster on the lit plane), the stockings (the
     sheen broken at the knee, a knee highlight, the thigh band's cast shadow), the tabard (the hip band's cast
     shadow, a fold cluster at the hem). slynyrd-57: "define the light source with simple, prominent clusters"
     first, then refine; "avoid too many small scattered clusters".
The 3D render stays a reference layer under the gesture (WF-P02): proportion and turn only.
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
import face_r2  # noqa: E402,F401  (points head_paint at the R2 head library)
import figure_construct as FCN  # noqa: E402
import figure_paint as FP  # noqa: E402

OUT = A.ROOT / 'art' / 'rosace' / 'construct' / 'figure'
SHEETS = A.ROOT / 'review' / 'rosace' / 'construct' / 'round-2' / 'figure'

# ---------------------------------------------------------------------------------------------- hands
# Painted hands (HD-P01: palm box + finger mitten + thumb wedge + wrist step, drawn per pose). Grids are
# centred on the gesture's hand point; '.' = leave the pixel underneath. Codes: O OL, 1 S1, s S2, t S3, m S4.
HANDS = {
    # near fist on a haft leaning ~20 deg (top to screen-left), seen from the back of the hand: the knuckle row a
    # curved S3 line highest in the middle, the thumb wedge (S1 top) wrapping over the haft on the near side, the
    # fingers a mitten under the haft, the wrist step on the right where the forearm comes in (HD-P07)
    'fist_haft_left': {'centre': [3, 3], 'rows': [
        '..OOOO..',
        '.Oss11O.',
        'Osss1ssO',
        'OtttssO.',
        'OsssssO.',
        '.OtssO..',
        '..OOO...',
    ]},
    # far hand on the far hip, back of the hand to the viewer, fingers down and back along the hip, the thumb
    # forward (HD-P04), the wrist in line with the forearm
    'hip_back': {'centre': [2, 3], 'rows': [
        '.OOO.',
        'Ots1O',
        'OtssO',
        'OtssO',
        'OtstO',
        '.OtsO',
        '.OtO.',
        '.OtO.',
        '..O..',
    ]},
}


TERM_JITTER = [0, 0, 1, 1, 1, 0, -1, 0, 0, 1, 1, 0, 0, 0, -1, -1, 0]


class R2Head(FP.HP.Head):
    """the painted head as a figure stamp: its back hair below the chin is dropped, because on the figure that hair
    hangs behind the shoulder and the figure's own hair_back layer (drawn behind the torso) carries it. R1 stamped
    it on top, which put a dark block over the near shoulder (round R2, by eye)"""

    def compose(self):
        cv = super().compose()
        H = cv.code.shape[0]
        ys = np.arange(H)[:, None]
        chin = FP.HP.CHIN_Y
        if self.facing == 'left':
            pass
        drop = (cv.part == A.PART['hair_back']) & (ys > chin + 1)
        cv.code[drop] = 0
        cv.mat[drop] = 0
        cv.part[drop] = 0
        return cv


class R2Figure(FP.PaintFigure):

    def mannequin(self):
        super().mannequin()
        L, shape, s, m = self.L, self.shape, self.s, self.mq
        c = lambda p: (p[0] + .5, p[1] + .5)  # noqa: E731
        r2 = s.get('r2', {})
        # the calf bulge: high on the outside, low on the inside (proko-calf), drawn as an ellipse on the back of the
        # calf (screen-left in a facing-right 3/4) about a third of the way down from the knee
        if r2.get('calf_offset', True):
            for side in ('near', 'far'):
                k, a = np.array(L[f'knee_{side}'], float), np.array(L[f'ankle_{side}'], float)
                d = a - k
                d /= (np.linalg.norm(d) or 1)
                back = np.array([-d[1], d[0]]) if d[1] > 0 else np.array([d[1], -d[0]])
                if back[0] > 0:
                    back = -back
                ctr = k + (a - k) * 0.3 + back * 1.6
                m[f'calf_{side}'] |= A.ellipse_mask(c(ctr), 3.2, 6.0, shape, angle=math.degrees(math.atan2(d[0], d[1])))
        # a round shoulder (the deltoid cap) so the arm does not start as a tube
        if r2.get('deltoid', True):
            for side in ('near', 'far'):
                sh, el = np.array(L[f'shoulder_{side}'], float), np.array(L[f'elbow_{side}'], float)
                m[f'upper_arm_{side}'] |= A.ellipse_mask(c(sh + (el - sh) * 0.18), 4.0, 3.6, shape)

    def build(self):
        real = FP.HP.Head
        FP.HP.Head = R2Head
        try:
            cv = super().build()
        finally:
            FP.HP.Head = real
        # the face record for the checker: the fringe clumps of the painted head (HR-P08 counts one dash per clump)
        self.face.rec['params']['bangs'] = face_r2.spec_of('q34').get('bangs', [])
        r = self.s.get('render', {})
        if r.get('r2_veil', True):
            self.pass_veil()
        if r.get('r2_torso', True):
            self.pass_torso()
        if r.get('r2_gloss', True):
            self.pass_gloss()
        if r.get('r2_legs', True):
            self.pass_legs()
        if r.get('r2_thighs', True):
            self.pass_thighs()
        if r.get('r2_hairtail', True):
            self.pass_hairtail()
        if r.get('r2_tabard', True):
            self.pass_tabard()
        if r.get('r2_hands', True):
            self.pass_hands()
        self.pass_contacts()
        self.log.append('r2: R2 painted head (back hair under the chin left to the body layer); calf offset and deltoid '
                        'masses; paint passes ' + ', '.join(k for k in ('r2_veil', 'r2_torso', 'r2_gloss', 'r2_legs', 'r2_thighs',
                                                                        'r2_hairtail', 'r2_tabard', 'r2_hands') if r.get(k, True)))
        return cv

    # ------------------------------------------------------------------------------------ paint passes
    def _codes(self, *ks):
        return [self.pal.i(k) for k in ks]

    def pass_torso(self):
        """the bodice as a form: one terminator that follows the rib cage (the near third turned from the light),
        the bust's cast shadow under it (PX-P03), one W1 cluster on the lit upper plane; W4 contact lines kept"""
        cv, L, I = self.cv, self.L, self.pal.i
        bod = (cv.part == A.PART['torso']) & (cv.mat == A.MAT['white'])
        paint = bod & np.isin(cv.code, self._codes('W1', 'W2', 'W3'))
        ys = np.nonzero(bod.any(1))[0]
        pc = L['pit_neck']
        bust_c = (pc[0] + 4, pc[1] + 12)
        for y in ys:
            xs = np.nonzero(bod[y] | ((cv.part[y] == A.PART['torso']) & (cv.mat[y] == A.MAT['gold'])))[0]
            if len(xs) < 3:
                continue
            x0, x1 = xs.min(), xs.max()
            w = x1 - x0 + 1
            # the terminator bows with the rib cage: widest shadow plane at the ribs, narrow at the waist
            t = (y - pc[1]) / max(1.0, L['crotch'][1] - pc[1])
            frac = 0.30 + 0.08 * math.sin(math.pi * min(1.0, t * 1.4))
            # an irregular edge (steps of 2-3-1-2 rows), so the terminator is a shape and not a straight W3|W2 seam
            # that bands (PX-N02; slynyrd-57: simple, prominent clusters)
            xt = x0 + int(round(frac * w)) + TERM_JITTER[int(y - ys[0]) % len(TERM_JITTER)]
            for x in range(x0, x1 + 1):
                if paint[y, x]:
                    cv.code[y, x] = I('W3') if x < xt else I('W2')
        # the cast shadow under the bust: 2 rows under the bust ellipse, on the lit side too (a designed shape)
        bust = A.ellipse_mask((bust_c[0] + .5, bust_c[1] + .5), 7.5, 5.0, cv.code.shape)
        under = A.shift(bust, 0, 2) & ~bust & paint
        cv.code[under] = I('W3')
        # the lit upper plane of the bust: one W1 cluster (3-5 px), not a band
        hi = bust & paint & (np.arange(cv.code.shape[1])[None, :] > bust_c[0]) & \
            (np.arange(cv.code.shape[0])[:, None] < bust_c[1] - 1)
        ys_, xs_ = np.nonzero(hi)
        if len(ys_):
            order = np.argsort(np.hypot(xs_ - (bust_c[0] + 3), ys_ - (bust_c[1] - 3)))[:5]
            cv.code[ys_[order], xs_[order]] = I('W1')

    def pass_gloss(self):
        """glossy stockings (jansson: glossy materials take a sharp streak along the long axis; PX-P26 ramp): across each
        row of a leg, the side turned from the light is I3, the core I2, a 1-2 px I1 streak at about two-thirds across
        with one I0 core pixel on the thigh and the shin, and the rim beside the lit outline back to I2 (the reflected
        edge), so the leg reads as a shiny tube instead of a flat indigo strip with one stripe"""
        cv, L, I = self.cv, self.L, self.pal.i
        H = cv.code.shape[0]
        for side in ('near', 'far'):
            leg = (cv.part == A.PART[f'leg_{side}']) & (cv.mat == A.MAT['stocking'])
            paint = leg & np.isin(cv.code, self._codes('I0', 'I1', 'I2', 'I3'))
            ky = L[f'knee_{side}'][1]
            for y in np.nonzero(leg.any(1))[0]:
                xs = np.nonzero(leg[y])[0]
                x0, x1 = xs.min(), xs.max()
                w = x1 - x0 + 1
                if w < 4:
                    continue
                for x in range(x0, x1 + 1):
                    if not paint[y, x]:
                        continue
                    u = (x - x0 + 0.5) / w
                    code = 'I3' if u < 0.3 else 'I2'
                    if 0.58 <= u < 0.82 and abs(y - ky) > 2:
                        code = 'I1'
                    cv.code[y, x] = I(code)
                # one I0 core pixel on the streak, on the thigh and on the shin, away from the knee
                if abs(y - ky) > 4 and (y - ky) % 7 in (2, 3) and w >= 6:
                    xc = x0 + int(round(0.7 * w - 0.5))
                    if paint[y, xc]:
                        cv.code[y, xc] = I('I0')

    def pass_thighs(self):
        """the bare thighs above the stockings: the side turned from the light in S3 (a 2-3 px band with a steady
        edge), one S1 cluster where the thigh faces the light, the rest S2 (one terminator per form, PX-P02)"""
        cv, I = self.cv, self.pal.i
        for side in ('near', 'far'):
            sk = (cv.part == A.PART[f'leg_{side}']) & (cv.mat == A.MAT['skin'])
            # pixels touching the gold straps keep the contact tone the R1 pass gave them (PX-P08)
            paint = sk & np.isin(cv.code, self._codes('S1', 'S2', 'S3')) & ~A.dilate(cv.mat == A.MAT['gold'], 1)
            rows = np.nonzero(sk.any(1))[0]
            for i, y in enumerate(rows):
                xs = np.nonzero(sk[y])[0]
                x0, x1 = xs.min(), xs.max()
                w = x1 - x0 + 1
                for x in range(x0, x1 + 1):
                    if paint[y, x]:
                        cv.code[y, x] = I('S3') if (x - x0) < max(2, round(0.3 * w)) else I('S2')
                if 2 <= i <= 4 and w >= 6:
                    for x in (x1 - 2, x1 - 1):
                        if paint[y, x]:
                            cv.code[y, x] = I('S1')

    def pass_hairtail(self):
        """the hime tail below the head: two lighter S-curved strands and a broken I1 band where the hair turns over the
        shoulder blades (slynyrd-29: flow lines first, then the light), so the tail is not one dark column"""
        cv, L, I = self.cv, self.L, self.pal.i
        hb = (cv.part == A.PART['hair_back']) & (cv.mat == A.MAT['hair'])
        ch = L['chin']
        ys = [y for y in np.nonzero(hb.any(1))[0] if y > ch[1] + 2]
        if not ys:
            return
        top, bot = ys[0], ys[-1]
        for k, (frac, amp, ph) in enumerate(((0.35, 1.2, 0.0), (0.62, 1.0, 1.9))):
            for y in ys:
                xs = np.nonzero(hb[y])[0]
                if len(xs) < 6:
                    continue
                t = (y - top) / max(1, bot - top)
                x = int(round(xs.min() + frac * (xs.max() - xs.min()) + amp * math.sin(6.0 * t + ph)))
                if hb[y, x] and cv.code[y, x] in self._codes('I3', 'I2') and (y - top) % 11 < 8:
                    cv.code[y, x] = I('I2')
                    if k == 1 and hb[y, x + 1] and cv.code[y, x + 1] == I('I3'):
                        cv.code[y, x + 1] = I('I2')
        for y in range(top, min(top + 8, bot)):
            xs = np.nonzero(hb[y])[0]
            if len(xs) < 6:
                continue
            for x in xs:
                u = (x - xs.min()) / max(1, xs.max() - xs.min())
                if 0.55 < u < 0.85 and (x + y) % 5 != 0 and cv.code[y, x] in self._codes('I2', 'I3'):
                    cv.code[y, x] = I('I1') if y < top + 5 else I('I2')

    def pass_legs(self):
        """stockings: the sheen stripe breaks at the knee, the knee cap takes a 2x2 I1 cluster just above the joint,
        and the thigh band casts a 2-row I3 shadow on the stocking under it"""
        cv, L, I = self.cv, self.L, self.pal.i
        for side in ('near', 'far'):
            leg = (cv.part == A.PART[f'leg_{side}']) & (cv.mat == A.MAT['stocking'])
            k = L[f'knee_{side}']
            ky, kx = int(round(k[1])), int(round(k[0]))
            # break the sheen 3 rows around the knee
            band = leg & (np.abs(np.arange(cv.code.shape[0])[:, None] - ky) <= 2) & (cv.code == I('I1'))
            cv.code[band] = I('I2')
            # knee highlight: 2x2 on the lit side of the knee, 2 rows above the joint
            for dx, dy in ((1, -3), (2, -3), (1, -2), (2, -2)):
                X, Y = kx + dx, ky + dy
                if leg[Y, X] and cv.code[Y, X] in self._codes('I2', 'I1'):
                    cv.code[Y, X] = I('I1')
            # the thigh band's cast shadow: the 2 rows under the gold band go one step darker
            gold = (cv.part == A.PART[f'leg_{side}']) & (cv.mat == A.MAT['gold'])
            if gold.any():
                gy = np.nonzero(gold.any(1))[0].max()
                for dy in (1, 2):
                    row = leg[gy + dy] & np.isin(cv.code[gy + dy], self._codes('I1', 'I2'))
                    cv.code[gy + dy][row] = I('I3')

    def pass_tabard(self):
        """the hip band casts a 2-row W3 shadow across the top of the tabard; a V fold cluster at the hem (a
        diaper fold between the hem's two corners, hampton-folds)"""
        cv, I = self.cv, self.pal.i
        tab = (cv.part == A.PART['tabard']) & (cv.mat == A.MAT['white'])
        paint = tab & np.isin(cv.code, self._codes('W1', 'W2', 'W3'))
        ys = np.nonzero(tab.any(1))[0]
        if not len(ys):
            return
        top = ys.min()
        cv.code[top][paint[top]] = I('W3')
        xs1 = np.nonzero(paint[top + 1])[0]
        if len(xs1):
            # the second row of the cast shadow only on the side away from the light (a wedge, not a band)
            cut = xs1.min() + (xs1.max() - xs1.min()) * 2 // 3
            sel = paint[top + 1] & (np.arange(cv.code.shape[1]) <= cut)
            cv.code[top + 1][sel] = I('W3')
        hem = ys.max()
        xs = np.nonzero(tab[hem - 4])[0]
        if len(xs) >= 6:
            mid = int((xs.min() + xs.max()) / 2)
            for i, dy in enumerate((-6, -5, -4, -3)):
                for X in (mid - 2 + i // 2, mid + 2 - i // 2):
                    if paint[hem + dy, X]:
                        cv.code[hem + dy, X] = I('W3')

    def pass_veil(self):
        """the short veil (DESIGN 3 row 13, 18 x 24 at 144) as a shape: it shows 3-5 px past the back of the hair from
        the crown to the shoulder blades, W2 with a W3 turned edge and the beige lace hem, outlined. R1's veil was hidden
        behind the hair except a 1 px white line down its edge, which read as a glitch (round R2, by eye)"""
        cv, L, I = self.cv, self.L, self.pal.i
        ch = L['chin']
        shape = cv.code.shape
        c = lambda p: (p[0] + .5, p[1] + .5)  # noqa: E731
        x0 = ch[0] - 23
        # hangs from the back of the head and flares out over the shoulder blades (a light flag, DESIGN 8)
        poly = [c((x0 + 3, ch[1] - 24)), c((x0 + 6, ch[1] - 18)), c((x0 + 4, ch[1] + 6)), c((x0 + 2, ch[1] + 16)),
                c((x0 - 4, ch[1] + 19)), c((x0 - 7, ch[1] + 17)), c((x0 - 5, ch[1] + 6)), c((x0 - 2, ch[1] - 12))]
        veil = A.poly_mask(poly, shape) & (cv.code == 0)
        if not veil.any():
            return
        code = np.full(shape, I('W2'), np.int16)
        xx = np.arange(shape[1])[None, :]
        code[veil & (xx < x0 - 3)] = I('W3')
        yy = np.arange(shape[0])[:, None]
        # one fold from the pin at the back of the head down to the hem (a pipe fold from its tension point)
        for x_, y_ in A.line_px((x0 - 1, ch[1] - 6), (x0 - 4, ch[1] + 14)):
            if veil[y_, x_]:
                code[y_, x_] = I('W3')
        hem = veil & ~A.shift(A.poly_mask(poly, shape), 0, -2)
        code[hem] = I('B1')
        code[veil & ~A.shift(A.poly_mask(poly, shape), 0, -1)] = I('B2')
        cv.code[veil] = code[veil]
        cv.mat[veil] = A.MAT['veil']
        cv.part[veil] = A.PART['veil']
        ring = A.ring_out(veil) & (cv.code == 0)
        cv.code[ring] = I('OL')
        cv.mat[ring] = A.MAT['line']
        cv.part[ring] = A.PART['veil']

    def pass_hands(self):
        """paste the painted hand grids at the gesture's hand points (the fist over the haft, the far hand on the hip)"""
        cv, L, I = self.cv, self.L, self.pal.i
        spec_h = self.s.get('r2', {}).get('hands', {'near': 'fist_haft_left', 'far': 'hip_back'})
        # take the R1 capsule hands off first: each of their pixels takes the nearest non-hand pixel on its row
        # (the sleeve mouth, the haft, the hip), so nothing of the old hand shows round the painted one
        for side, key in spec_h.items():
            if not key:
                continue
            old = cv.part == A.PART[f'hand_{side}']
            W = cv.code.shape[1]
            for y, x in zip(*np.nonzero(old)):
                for d in range(1, 8):
                    src = [xx for xx in (x - d, x + d) if 0 <= xx < W and not old[y, xx]]
                    if src:
                        xx = src[0]
                        cv.code[y, x], cv.mat[y, x], cv.part[y, x] = cv.code[y, xx], cv.mat[y, xx], cv.part[y, xx]
                        break
                else:
                    cv.code[y, x] = cv.mat[y, x] = cv.part[y, x] = 0
        for side, key in spec_h.items():
            if not key:
                continue
            g = HANDS[key]
            cx, cy = g['centre']
            hx, hy = L[f'hand_{side}']
            ox, oy = int(round(hx)) - cx, int(round(hy)) - cy
            for j, row in enumerate(g['rows']):
                for i, ch in enumerate(row):
                    if ch == '.':
                        continue
                    X, Y = ox + i, oy + j
                    if 0 <= X < cv.code.shape[1] and 0 <= Y < cv.code.shape[0]:
                        under = cv.code[Y, X]
                        if ch == 'O' and cv.mat[Y, X] == A.MAT['skin'] and cv.part[Y, X] != A.PART[f'hand_{side}']:
                            ch = 'm'           # over skin the hand's edge is a contact line, not the outline (PX-P20)
                        cv.code[Y, X] = I(A.KEY[ch])
                        cv.mat[Y, X] = A.MAT['line'] if ch == 'O' else A.MAT['skin']
                        cv.part[Y, X] = A.PART[f'hand_{side}']
            # a painted hand over the background needs its outline closed where the grid left a gap
            hm = cv.part == A.PART[f'hand_{side}']
            ring = A.ring_out(hm) & (cv.code == 0)
            cv.code[ring] = I('OL')
            cv.mat[ring] = A.MAT['line']
            cv.part[ring] = A.PART[f'hand_{side}']

    def pass_contacts(self):
        """R2 layering left two light-on-light borders without a line: the sidelock's azure tips on the shoulder skin,
        and the restored pixels round the hands. The back part takes its deep tone there (the lock's cast shadow on
        the shoulder), as the R1 contact-line pass does for light materials (PX-P08, PX-N05)"""
        cv, I = self.cv, self.pal.i
        deep = {A.MAT['skin']: I('S4'), A.MAT['white']: I('W4')}
        lum = np.zeros(len(self.pal.codes) + 1)
        for k, i in self.pal.index.items():
            lum[i] = self.pal.lum(k)
        lines = set(I(k) for k in ('OL', 'W4', 'S4', 'I4', 'G4', 'T4'))
        H, W = cv.code.shape
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            for y in range(max(0, -dy), H - max(0, dy)):
                for x in range(max(0, -dx), W - max(0, dx)):
                    a, b = cv.code[y, x], cv.code[y + dy, x + dx]
                    ma, mb = cv.mat[y, x], cv.mat[y + dy, x + dx]
                    if a <= 0 or b <= 0 or ma == mb or a in lines or b in lines:
                        continue
                    if ma == A.MAT['skin'] and mb in (A.MAT['white'], A.MAT['veil']) and                             A.contrast(lum[a], lum[b]) < 1.5 and cv.part[y, x] not in (A.PART['face'], A.PART['eye']):
                        cv.code[y, x] = I('S4')
        tip = cv.mat == A.MAT['hairtip']
        near_tip = A.dilate(tip, 1) & ~tip
        for mid, code in deep.items():
            sel = near_tip & (cv.mat == mid) & ~np.isin(cv.part, [A.PART['face'], A.PART['eye']])
            cv.code[sel] = code


def build(spec_path, name=None, ref=None, overrides=None, do_sheet=False, out=OUT):
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    spec = FCN.merged(spec, overrides or {})
    name = name or spec['name']
    spec['name'] = name
    fig = R2Figure(spec)
    fig.gesture()
    fig.mannequin()
    fig.build()
    od = Path(out) / name
    od.mkdir(parents=True, exist_ok=True)
    fig.cv.save(fig.pal, od / 'sprite.png')
    fig.cv.save_layers(str(od / 'sprite'))
    pose = fig.pose_json(name)
    pose['route'] = 'r2 figure_r2 (painted head, paint passes, painted hands)'
    ref_img, ref_info = (None, None)
    if ref:
        ref_img, ref_info = FCN.load_ref(ref, fig)
        pose['reference'] = ref_info
    A.jdump(pose, od / 'pose.json')
    frec = fig.face.record(f'{name}_face')
    frec['origin_on_sprite'] = list(fig.face_origin)
    A.jdump(frec, od / 'face.json')
    fig.head.cv.save_layers(str(od / 'face'))
    A.jdump({'name': name, 'spec': spec, 'log': fig.log, 'reference': ref_info,
             '_doc': 'the spec this sprite was built from (tools/art-construct/figure_r2.py, round R2) and the log'},
            od / 'construct.json')
    if do_sheet:
        SHEETS.mkdir(parents=True, exist_ok=True)
        check = None
        try:
            import rules_check as RC
            check = {'gaps_px': RC.arm_gaps(fig.cv.code > 0, fig.cv.part)[1]}
        except Exception as e:  # noqa: BLE001
            print('gap overlay skipped:', e)
        FCN.construct_sheet(fig, name, ref_img, check).save(SHEETS / f'{name}_construct.png')
    return fig, pose


def thumbnails(spec_path, out=OUT):
    """WF-P03 with the R2 models: build every thumbnail in the spec, fill solid, score on the silhouette rules"""
    import rules_check as RC
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    name = spec['name']
    tdir = Path(out) / name / 'thumbs'
    tdir.mkdir(parents=True, exist_ok=True)
    res = []
    for tv in spec.get('thumbnails', []):
        vname = tv['name']
        fig, pose = build(spec_path, f'{name}__{vname}', None, tv.get('set', {}), False, tdir)
        ctx = RC.Ctx(tdir / f'{name}__{vname}', faces_dir=face_r2.LIB)
        rows = RC.run(ctx, list(FP.THUMB_RULES))
        passed = [r['id'] for r in rows if r['status'].startswith('PASS')]
        gaps, _ = RC.arm_gaps(ctx.mask, ctx.parts)
        area = sum(a for a, w, s_ in gaps if a >= 30 and w >= 3)
        body = (fig.cv.code > 0) & (fig.cv.part != A.PART['weapon'])
        xs = np.nonzero(body.any(0))[0]
        L = fig.L
        reach = math.hypot(L['hand_near'][0] - L['shoulder_near'][0], L['hand_near'][1] - L['shoulder_near'][1])
        res.append({'name': vname, 'idea': tv.get('idea', ''), 'set': tv.get('set', {}), 'score': len(passed),
                    'gap_area': area, 'width': int(xs.max() - xs.min() + 1), 'passed': passed,
                    'near_reach_px': round(reach, 1),
                    'failed': [f"{r['id']}: {r['measured']}" for r in rows if r['status'].startswith('FAIL')],
                    'verdict': tv.get('verdict', ''), 'kept': tv.get('kept'), 'fig': fig})
    ranked = sorted(res, key=lambda r: (-r['score'], -r['gap_area']))
    for i, r in enumerate(ranked):
        r['rank'] = i + 1
        A.jdump({k: v for k, v in r.items() if k != 'fig'}, tdir / f"{r['name']}.json")
    panels, colour = [], []
    for r in ranked:
        cv = r['fig'].cv
        sil = np.full(cv.code.shape + (3,), 104, np.uint8)
        sil[cv.code > 0] = (24, 20, 36)
        sil[cv.part == A.PART['weapon']] = (70, 66, 90)
        tag = f"#{r['rank']} {r['name']} {r['score']}/{len(FP.THUMB_RULES)} reach {r['near_reach_px']}" + \
              (' KEPT' if r.get('kept') else '')
        panels.append((tag, A.zoom(Image.fromarray(sil), 2)))
        colour.append((r['name'], A.zoom(A.on_bg(cv.image(r['fig'].pal)), 2)))
    SHEETS.mkdir(parents=True, exist_ok=True)
    notes = [f"{r['name']}: {r['idea']}" + (f" -> {r['verdict']}" if r['verdict'] else '') for r in ranked]
    s = A.stack([A.row_sheet(panels, title=f'{name} thumbnails (WF-P03): solid fill at 2x, scored on ' + ', '.join(FP.THUMB_RULES)),
                 A.row_sheet(colour, title='the same thumbnails as a colour build, 2x'), face_r2.notes_img(notes, 1900)])
    s.save(SHEETS / f'{name}_thumbs.png')
    return ranked


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('spec')
    ap.add_argument('--name')
    ap.add_argument('--ref', nargs='?', const=str(FCN.DEFAULT_REF))
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--thumbs', action='store_true')
    ap.add_argument('--out', default=str(OUT))
    a = ap.parse_args()
    if a.thumbs:
        for r in thumbnails(a.spec, a.out):
            print(f"#{r['rank']} {r['name']:18s} {r['score']}/{len(FP.THUMB_RULES)} gap {r['gap_area']:4d} width {r['width']} "
                  f"reach {r['near_reach_px']}  fails: " + '; '.join(f[:70] for f in r['failed']))
        return
    fig, pose = build(a.spec, a.name, a.ref, None, a.sheet, a.out)
    print(pose['name'], 'ok;', '; '.join(fig.log))


if __name__ == '__main__':
    main()
