"""Round-1 figure route: the C1 gesture and mannequin (figure_construct.py), dressed and rendered with
part models sized to DESIGN.md at 144 px, and the painted round-1 head (head_paint.py).

  python tools/art-construct/figure_paint.py art/rosace/construct/figure/idle_hero_r1.gesture.json [--ref] [--sheet]
  python tools/art-construct/figure_paint.py SPEC --thumbs            # WF-P03: build + score the spec's thumbnails

What changed from C1 and why (ART-RULES 10, round R1):
  - C1 drew the trumpet sleeves with a 13 px drop; DESIGN 2 gives a 28 px sleeve with an 18 px mouth at 96 px,
    i.e. 42 / 27 at 144. The 3D reference layer (r4fix idle, px144) confirms the bell is the biggest mass after
    the hair (its near sleeve spans about 20 x 27 px). So the sleeves here are cones from the armband to a
    27 px mouth, the lower edge dropped by gravity, lining showing at the mouth, pipe folds from the
    armband tension point (hampton-folds), a gold hem stepped down on the shadow half.
  - the hime back hair is a real mass to mid-thigh (DESIGN 2: 55 px from the crown at 96 -> about 82 at 144),
    built as three clumps with S-curved splits, gathered by a gold ring, azure tips (HR-P09), and the veil
    at DESIGN size (12 x 16 at 96 -> 18 x 24).
  - limbs and pelvis at the widths the reference layer measures (thigh 13 px at the hip, pelvis 24-26 px 3/4).
  - the head is the painted r1 head; its neck is dropped (the collar and the body's neck take over).
  - the fist is built 8-9 px across with >= 2 px of knuckles and fingers either side of the haft (GR-P06).
Everything else (the order of work, the outline and contact-line passes, pose.json / face.json for the checker)
follows figure_construct.py so rules_check.py grades both routes the same way.
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
import figure_construct as FCN  # noqa: E402
import head_paint as HP  # noqa: E402

OUT = A.ROOT / 'art' / 'rosace' / 'construct' / 'figure'
SHEETS = A.ROOT / 'review' / 'rosace' / 'construct' / 'round-1' / 'figure'
RAMP = FCN.RAMP
INNER = FCN.INNER


class FaceAdapter:
    """what figure_construct's pose_json / zones read from a face (p, lm)"""

    def __init__(self, head, rec):
        self.head = head
        self.rec = rec
        self.lm = rec['landmarks']
        prm = rec['params']
        self.p = {'yaw': prm['yaw'], 'expression': prm['expression'], 'gaze': prm['gaze'], 'roll': prm['roll'],
                  'pitch': prm['pitch'], 'gaze_target': prm['gaze_target']}

    def record(self, name):
        r = copy.deepcopy(self.rec)
        r['name'] = name
        return r


class PaintFigure(FCN.Figure):

    # ------------------------------------------------------------ mannequin with the spec's limb radii
    def mannequin(self):
        super().mannequin()
        L, shape, s = self.L, self.shape, self.s
        c = lambda p: (p[0] + .5, p[1] + .5)  # noqa: E731
        R = {'thigh': (6.5, 4.0), 'calf': (3.8, 2.3), 'upper_arm': (3.3, 2.7), 'forearm': (2.6, 2.1)}
        R.update({k: tuple(v) for k, v in s.get('radii', {}).items()})
        self.R = R
        m = self.mq
        for side in ('near', 'far'):
            m[f'thigh_{side}'] = A.capsule_mask(c(L[f'hip_{side}']), c(L[f'knee_{side}']), *R['thigh'], shape)
            calf_mid = (L[f'knee_{side}'][0] * 0.62 + L[f'ankle_{side}'][0] * 0.38,
                        L[f'knee_{side}'][1] * 0.62 + L[f'ankle_{side}'][1] * 0.38)
            m[f'calf_{side}'] = (A.capsule_mask(c(L[f'knee_{side}']), c(calf_mid), R['calf'][0], R['calf'][0] + 0.6, shape) |
                                 A.capsule_mask(c(calf_mid), c(L[f'ankle_{side}']), R['calf'][0] + 0.6, R['calf'][1], shape))
            m[f'upper_arm_{side}'] = A.capsule_mask(c(L[f'shoulder_{side}']), c(L[f'elbow_{side}']), *R['upper_arm'], shape)
            m[f'forearm_{side}'] = A.capsule_mask(c(L[f'elbow_{side}']), c(L[f'wrist_{side}']), *R['forearm'], shape)

    # ------------------------------------------------------------ dressing and rendering
    def build(self):
        s, L, shape, pal = self.s, self.L, self.shape, self.pal
        I = pal.i
        c = lambda p: (p[0] + .5, p[1] + .5)  # noqa: E731
        m = self.mq
        H, W = shape
        yy, xx = np.mgrid[0:H, 0:W]
        lt = self.light
        layers = []
        R = self.R

        def ramp(mat):
            return [I(k) for k in RAMP[mat]]

        def cyl(mask, p0, p1, mat, r0, r1, shadow_frac=0.3, sheen=None):
            """one terminator along a limb: shadow on the side away from the light, a straight designed edge"""
            deepc, sh, lit, hi = ramp(mat)
            sgn = A.lit_side_sign(p0, p1, lt)
            sa, t, _ = A.across(c(p0), c(p1), shape)
            r = r0 + (r1 - r0) * np.clip(t, 0, 1)
            u = sgn * sa / np.maximum(r, 0.5)
            out = np.full(shape, lit, np.int16)
            # the shadow band is a shape, not a rim: at least 2 px across wherever the form is (PX-P13)
            frac = np.minimum(shadow_frac, 1.0 - 2.2 / np.maximum(r, 2.3))
            out[u < -frac] = sh
            deep_ok = (r >= 5.0) & (u < -0.8)
            out[deep_ok] = deepc if mat in ('stocking', 'boot') else sh
            if sheen:
                lo, hi_ = sheen
                out[(u > lo) & (u < hi_)] = hi
            return out

        def add(part, mask, mat, codes):
            layers.append((part, mask, mat, codes))

        hs = s['hair']
        chin = L['chin']
        # ---------------- back hair: three clumps from the back of the head to mid-thigh
        top_y = chin[1] + 8                      # the painted head's back hair ends at chin + 9
        x_back, x_front = chin[0] - 21, chin[0] - 8
        tail_y = self.S - hs['tail_h']
        sway = hs.get('sway', -3)
        width = hs.get('width', 15)
        pts_l, pts_r = [], []
        n = 24
        for i in range(n + 1):
            t = i / n
            y = top_y - 12 + (tail_y - top_y + 12) * t
            cxh = (x_back + x_front) / 2 + sway * math.sin(math.pi * t * 0.9) + hs.get('tail_dx', 0) * t
            w = (x_front - x_back + 1) * (1 - t) + width * t
            w *= 1.0 - 0.55 * max(0.0, t - 0.8) / 0.2                  # taper to the tips
            pts_l.append((cxh - w / 2, y))
            pts_r.append((cxh + w / 2, y))
        hair_back = A.poly_mask([c(p) for p in pts_l + pts_r[::-1]], shape)
        # clump splits: two S-curved I4 lines; lit strand on the side toward the light (right)
        # one terminator on the whole mass: the clump nearest the light (right third) in I2, the rest in I3
        ys_l = [p[1] for p in pts_l]
        xl = np.interp(yy, ys_l, [p[0] for p in pts_l])
        xr = np.interp(yy, ys_l, [p[0] for p in pts_r])
        rel = (xx + 0.5 - xl) / np.maximum(xr - xl, 1)
        hb = np.full(shape, I('I3'), np.int16)
        hb[hair_back & (rel > 0.62)] = I('I2')
        # two clump lines (I4, continuous, S-curved: ao-hair34 clumps, HR-P06 one step under the shadow)
        for k, off in enumerate((0.3, 0.62)):
            for yy_ in range(int(top_y - 12), int(tail_y - 8)):
                t = (yy_ - top_y + 12) / max(1, tail_y - top_y + 4)
                xi = int(round(np.interp(yy_ + .5, ys_l, [a[0] + off * (b[0] - a[0]) for a, b in zip(pts_l, pts_r)])
                               + 2.4 * math.sin(7.0 * t + 1.7 * k) - 0.5))
                if 0 <= yy_ < H and 0 <= xi < W and hair_back[yy_, xi]:
                    hb[yy_, xi] = I('I4')
        # a sheen streak down the lit clump, broken in two dashes (HR-P08 spirit), 2 px wide
        sheen = hair_back & (rel > 0.72) & (rel < 0.9) & (((yy > top_y) & (yy < top_y + 9)) | ((yy > top_y + 22) & (yy < top_y + 29)))
        hb[sheen] = I('I1')
        # the gold ring and the azure tips (DESIGN 6; HR-P09: A3 then A4 over the last 2-4 px)
        ring_y = int(tail_y - 12)
        hb[hair_back & (yy >= ring_y) & (yy <= ring_y + 1)] = I('G2')
        hb[hair_back & (yy == ring_y + 1) & (rel < 0.5)] = I('G3')
        hb[hair_back & (yy > tail_y - 5)] = I('A3')
        hb[hair_back & (yy > tail_y - 2)] = I('A4')
        self.ring = hair_back & (yy >= ring_y) & (yy <= ring_y + 1)
        add('hair_back', hair_back, 'hair', hb)
        # ---------------- veil (18 x 24 at 144) behind the head, showing past the back of the hair
        vx = chin[0] - 22
        veil = A.poly_mask([c((vx + 2, chin[1] - 24)), c((vx + 7, chin[1] - 20)), c((vx + 5, chin[1] + 2)),
                            c((vx + 1, chin[1] + 16)), c((vx - 4, chin[1] + 19)), c((vx - 4, chin[1])),
                            c((vx - 1, chin[1] - 17))], shape)
        vc = np.full(shape, I('W2'), np.int16)
        vc[veil & (xx < vx - 1)] = I('W3')                                  # the side turned from the light
        vc[veil & ~A.shift(veil, 0, -2)] = I('B1')                          # the lace hem
        vc[veil & ~A.shift(veil, 0, -1)] = I('B2')
        add('veil', veil, 'veil', vc)
        # ---------------- legs: far (weight) then near; bare thigh, dark thigh-highs, boots
        boot_h, stock_h = s.get('boot_h', 21), s.get('stock_h', 55)
        self.bands = []
        for side in ('far', 'near'):
            thigh, calf = m[f'thigh_{side}'], m[f'calf_{side}']
            foot = m[f'foot_{side}']
            leg = thigh | calf
            hip, knee, ankle = L[f'hip_{side}'], L[f'knee_{side}'], L[f'ankle_{side}']
            skin_part = leg & (yy <= self.S - stock_h)
            stock = leg & (yy > self.S - stock_h) & (yy <= self.S - boot_h)
            boot = ((leg | foot) & (yy > self.S - boot_h)) | foot
            codes = np.where(yy <= knee[1], cyl(thigh, hip, knee, 'skin', *R['thigh'], shadow_frac=0.2),
                             cyl(calf, knee, ankle, 'skin', *R['calf']))
            add(f'leg_{side}', skin_part, 'skin', codes)
            sc = np.where(yy <= knee[1], cyl(thigh, hip, knee, 'stocking', *R['thigh'], shadow_frac=0.15, sheen=(0.25, 0.6)),
                          cyl(calf, knee, ankle, 'stocking', *R['calf'], shadow_frac=0.15, sheen=(0.2, 0.62)))
            sc[stock & (np.abs(yy - knee[1]) <= 1) & (sc == I('I1'))] = I('I2')      # the sheen breaks at the knee
            band = stock & (yy >= int(self.S - stock_h + 1)) & (yy <= int(self.S - stock_h + 2))
            sc[band] = I('G2')
            add(f'leg_{side}', stock, 'stocking', sc)
            self.bands.append(band)
            bc = cyl(calf | foot, knee, ankle, 'boot', 4.2, 3.0, shadow_frac=0.1)
            toe = foot & (np.abs(xx - L[f'toe_{side}'][0]) <= 2)
            heel = foot & (np.abs(xx - (L[f'heel_{side}'][0] - 1)) <= 1) & (yy >= self.S - 3)
            caps = (toe | heel)
            capc = np.full(shape, I('G2'), np.int16)
            capc[caps & (yy >= self.S - 1)] = I('G3')
            cuff = boot & (yy == int(self.S - boot_h + 1))
            sx = (knee[0] + ankle[0]) / 2 + 1
            streak = boot & (np.abs(xx - np.interp(yy, [self.S - boot_h, self.S - 6], [sx, ankle[0] + 1])) < 0.6) & \
                (yy > self.S - boot_h + 3) & (yy < self.S - 8)
            bc[streak] = I('I1')
            bc[cuff] = I('G2')                                                  # the gold cuff line (DESIGN 3 row 12)
            add(f'boot_{side}', boot, 'boot', bc)
            add(f'boot_{side}', caps, 'gold', capc)
        # the garter straps and charms (DESIGN 3 row 8): 1 px gold from the hip band to the thigh band
        # ---------------- far upper arm (behind the torso at the shoulder)
        add('arm_far', m['upper_arm_far'], 'skin', cyl(m['upper_arm_far'], L['shoulder_far'], L['elbow_far'], 'skin', *R['upper_arm']))
        # ---------------- torso: skin (the open sides), bodice with the bust, chest window, hip band
        torso = m['torso']
        pc = L['pit_neck']
        # bust: the chest bulges toward the facing side (3/4 facing right)
        bust = A.ellipse_mask(c((pc[0] + 4, pc[1] + 12)), 7.5, 5.0, shape)
        hips = A.ellipse_mask(c((L['pelvis_c'][0] + 0.5, L['pelvis_c'][1] - 1)), (s['pelvis']['near_w'] + s['pelvis']['far_w']) / 2, 6.5, shape)
        torso = torso | bust | hips
        tc = np.full(shape, I('S2'), np.int16)
        near_line = lambda y_: np.interp(y_, [pc[1], L['crotch'][1]], [L['shoulder_near'][0] + 5, L['pelvis_edge_near'][0] + 4])  # noqa: E731
        tc[torso & (xx < near_line(yy))] = I('S3')                             # the side plane, away from the light
        add('torso', torso, 'skin', tc)
        self.s1_spots = []
        if s.get('render', {}).get('skin_lights', True):
            for side in ('far', 'near'):
                shp = np.array(L[f'shoulder_{side}'], float)
                self.s1_spots.append(A.ellipse_mask(c((shp[0] + 1, shp[1] - 0.5)), 1.6, 0.9, shape))
        cl_x = lambda y_: np.interp(y_, [pc[1], L['crotch'][1]], [pc[0] + 1, L['crotch'][0] + 1])  # noqa: E731
        bod = A.poly_mask([c((pc[0] - 6, pc[1] + 1)), c((pc[0] + 8, pc[1] + 1)),
                           c((L['shoulder_far'][0] - 2, L['shoulder_far'][1] + 7)),
                           c((pc[0] + 12, pc[1] + 13)),
                           c((L['waist_c'][0] + s['waist']['far_w'], L['waist_c'][1])),
                           c(L['pelvis_edge_far']), c((L['crotch'][0] + 4, L['crotch'][1])),
                           c((L['crotch'][0] - 4, L['crotch'][1])),
                           c((L['pelvis_edge_near'][0] + 5, L['pelvis_edge_near'][1])),
                           c((L['waist_c'][0] - s['waist']['near_w'] + 3, L['waist_c'][1])),
                           c((L['rib_c'][0] - s['ribcage']['near_w'] + 4, L['rib_c'][1] + 2)),
                           c((pc[0] - 9, pc[1] + 8))], shape) & torso | (bust & (xx > pc[0] - 4))
        bc = np.full(shape, I('W2'), np.int16)
        bc[bod & (xx < cl_x(yy) - 5)] = I('W3')                               # the bodice's near side plane
        # bust: lit upper planes, a designed cast shadow under it (PX-P03)
        under = bod & A.shift(bust, 0, 2) & ~bust
        bc[under] = I('W3')
        bc[bod & bust & (yy < pc[1] + 11) & (xx > cl_x(yy) + 1)] = I('W1')
        bc[bod & bust & (yy >= pc[1] + 14) & (xx > cl_x(yy) + 5)] = I('W3')
        if s.get('render', {}).get('bodice_planes', True):
            # the torso turns away on the far side below the bust: a W3 plane along the far waist (one terminator)
            far_edge = bod & ~A.shift(bod, -1, 0)
            waist_turn = A.dilate(far_edge, 1) & bod & (yy > pc[1] + 17) & (yy < L['pelvis_c'][1] - 2)
            bc[waist_turn] = I('W3')
            # tension folds: bust underside -> hip band on the near side (hampton-folds: folds run between tension points)
            for dx0, dx1 in ((-3, -5), (1, -1)):
                for j, (x_, y_) in enumerate(A.line_px((pc[0] + dx0, pc[1] + 17), (L['waist_c'][0] + dx1, L['waist_c'][1] + 4))):
                    if 0 <= y_ < H and 0 <= x_ < W and bod[y_, x_] and j % 5 != 4:
                        bc[y_, x_] = I('W3')
        # chest window: diamond on the centre line, gold framed (DESIGN 3 row 2)
        wy0, wy1 = pc[1] + 6, pc[1] + 19
        wcx = cl_x((wy0 + wy1) / 2) + 1
        diamond = A.poly_mask([(wcx + .5, wy0), (wcx + 3.4, (wy0 + wy1) / 2), (wcx + .5, wy1), (wcx - 2.4, (wy0 + wy1) / 2)], shape)
        bc[diamond] = I('S2')
        bc[diamond & (xx <= wcx - 1)] = I('S3')
        bc[A.ring_out(diamond) & bod] = I('G2')
        bc[A.ring_out(diamond) & bod & (xx < wcx)] = I('G3')
        add('torso', bod, 'white', bc)
        self.window = diamond
        # the open side (DESIGN 3 row 3): the skin strip between the bodice's near edge and the torso's near edge,
        # crossed by gold lines (1 px, lit G2 / shaded G3) so the bare side reads as designed costume
        side = torso & ~bod & (yy > pc[1] + 6) & (yy < L['pelvis_c'][1] - 3) & (xx < cl_x(yy))
        lace = np.zeros(shape, bool)
        if side.any():
            ys_s = np.nonzero(side.any(1))[0]
            for yl in range(int(ys_s.min()) + 3, int(ys_s.max()) - 1, 6):
                xs_row = np.nonzero(side[yl])[0]
                if len(xs_row) >= 3:
                    for x_, y_ in A.line_px((xs_row.min(), yl + 1), (xs_row.max(), yl - 1)):
                        if side[y_, x_]:
                            lace[y_, x_] = True
        self.lace = lace
        # hip band on the tilted pelvis, 2 px gold, the rose medallion; garter straps to the thigh bands
        e0 = (L['pelvis_edge_near'][0] + 1, L['pelvis_edge_near'][1] - 3)
        e1 = (L['pelvis_edge_far'][0] - 1, L['pelvis_edge_far'][1] - 3)
        hb_line = A.capsule_mask(c(e0), c(e1), 1.0, 1.0, shape) & (torso | bod)
        hbc = np.full(shape, I('G2'), np.int16)
        hbc[hb_line & ~A.shift(hb_line, 0, 1)] = I('G1')
        hbc[hb_line & (xx < cl_x(yy) - 6)] = I('G3')
        add('pelvis', hb_line, 'gold', hbc)
        straps = np.zeros(shape, bool)
        for side, dxs in (('near', (-2,)), ('far', (1,))):
            hip = L[f'hip_{side}']
            ty = self.S - stock_h + 1
            kx = np.interp(ty, [hip[1], L[f'knee_{side}'][1]], [hip[0], L[f'knee_{side}'][0]])
            for dx in dxs:
                for x_, y_ in A.line_px((hip[0] + dx, hip[1] - 2), (kx + dx, ty)):
                    if 0 <= y_ < H and 0 <= x_ < W:
                        straps[y_, x_] = True
        lcc = np.full(shape, I('G2'), np.int16)
        lcc[lace & (xx < cl_x(yy) - 8)] = I('G3')
        add('pelvis' if False else 'torso', lace, 'gold', lcc)
        stc = np.full(shape, I('G2'), np.int16)
        for side in ('far', 'near'):
            add(f'leg_{side}', straps & m[f'thigh_{side}'] & ~hb_line, 'gold', stc)
        # ---------------- tabard: from the tilted hip band to mid-shin (DESIGN 2: 7 x 34 at 96 -> 11 x 51)
        band_mid = ((e0[0] + e1[0]) / 2 + 1, (e0[1] + e1[1]) / 2 + 1)
        t = math.radians(s['pelvis']['tilt_deg'])
        half = s.get('tabard_half', 5.5)
        tl = (band_mid[0] - half * math.cos(t), band_mid[1] + half * math.sin(t))
        tr = (band_mid[0] + half * math.cos(t), band_mid[1] - half * math.sin(t))
        hem_y = self.S - s.get('tabard_hem_h', 24)
        sway_t = s.get('tabard_sway', -3)
        tab = A.poly_mask([c(tl), c(tr), c((tr[0] + 1 + sway_t, hem_y)), c((band_mid[0] + sway_t, hem_y + 5)),
                           c((tl[0] - 1 + sway_t, hem_y))], shape)
        tcod = np.full(shape, I('W2'), np.int16)
        edge_x = lambda y_, x0_: x0_ + (y_ - tr[1]) * sway_t / max(1, hem_y - tr[1])  # noqa: E731
        tcod[tab & (xx >= edge_x(yy, tr[0]) - 3)] = I('W1')                # the lit strip on the facing side
        # the panel drapes over the near thigh and turns away from the light on its near third: one terminator
        tcod[tab & (xx <= edge_x(yy, tl[0]) + 2) & (yy > band_mid[1] + 3)] = I('W3')
        # two pipe folds from the tension point at the band, sharp top edge (hampton-folds)
        for fx0, fx1, ln in ((-1.5, -3.0, 0.92), (2.0, 1.0, 0.6)):
            f0 = (band_mid[0] + fx0, band_mid[1] + 4)
            f1 = (band_mid[0] + fx1 + sway_t * ln, band_mid[1] + 4 + (hem_y - band_mid[1] - 8) * ln)
            for j, (x_, y_) in enumerate(A.line_px(f0, f1)):
                if 0 <= y_ < H and 0 <= x_ < W and tab[y_, x_]:
                    tcod[y_, x_] = I('W4') if j < 3 else I('W3')
                    if j > 4 and x_ - 1 >= 0 and tab[y_, x_ - 1]:
                        tcod[y_, x_ - 1] = I('W3')          # the fold's shadow side: 2 px wide below the pinch
        tcod[tab & ~A.shift(tab, -1, 0)] = I('G2')
        tcod[tab & ~A.shift(tab, 1, 0)] = I('G3')
        tcod[tab & ~A.shift(tab, 0, -1) & (yy > hem_y - 2)] = I('G3')
        fx, fy = int(round(band_mid[0] + sway_t * 0.8)), int(hem_y - 14)
        for dx, dy in ((0, -4), (0, -3), (0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (0, 3), (0, 4), (-1, -2), (-2, -2),
                       (1, -2), (2, -2), (-1, -3), (1, -3), (-2, -1), (2, -1)):
            if 0 <= fy + dy < H and tab[fy + dy, fx + dx]:
                tcod[fy + dy, fx + dx] = I('G2') if dx >= 0 else I('G3')
        add('tabard', tab, 'white', tcod)
        self.hem_y = hem_y
        # ---------------- collar and the 5x5 cross on a dark backing (CL-P05)
        col = A.poly_mask([c((pc[0] - 5, pc[1] + 1)), c((pc[0] - 4, chin[1] + 2)), c((pc[0] + 5, chin[1] + 1)),
                           c((pc[0] + 6, pc[1] + 1))], shape)
        cc = np.full(shape, I('W2'), np.int16)
        cc[col & (xx > pc[0] + 2)] = I('W1')
        cc[col & (xx < pc[0] - 2)] = I('W3')
        cc[col & ~A.shift(col, 0, -1)] = I('G2')
        cc[col & ~A.shift(col, 0, 1)] = I('G2')
        add('collar', col, 'white', cc)
        crx, cry = int(round(pc[0] + 1)), int(round(pc[1] - 3))
        cross = np.zeros(shape, bool)
        crc = np.full(shape, I('I3'), np.int16)
        for dx, dy in ((0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (-2, 0), (-1, 0), (1, 0), (2, 0)):
            cross[cry + dy, crx + dx] = True
            crc[cry + dy, crx + dx] = I('G1') if (dx > 0 or dy < 0) else I('G3')
        crc[cry, crx] = I('G1')
        back = A.dilate(cross, 1)
        add('cross', back, 'gold', crc)
        self.cross_px = (crx, cry)
        # ---------------- the head: the painted r1 head, neck dropped (the collar takes over)
        fp = s.get('face', {})
        head = HP.Head(HP.load(fp.get('yaw', 'q34')), s['expression'], roll=fp.get('roll'), pitch=fp.get('pitch', 0))
        head.compose()
        rec = head.record(f"{s.get('name', 'fig')}_face")
        self.head = head
        self.face = FaceAdapter(head, rec)
        ax, ay = head.anch['chin']
        ox, oy = int(round(chin[0] - ax)), int(round(chin[1] - ay))
        self.face_origin = (ox, oy)
        hcv = head.cv
        keep = (hcv.code > 0) & (hcv.part != A.PART['neck'])
        # the head's own outline ring below the chin (neck) is dropped too: the body's outline pass redoes it
        keep &= ~((hcv.part == 0) & (np.arange(hcv.h)[:, None] > ay))
        cl = rec['landmarks']['centre_line']
        by = ay - head.rows['brow']
        top = min(cl, key=lambda q_: abs(q_[1] - by))
        L['head_axis'] = [(top[0] + ox, top[1] + oy), (ax + ox, ay + oy)]
        L['skull_top'] = (14.5 + ox, ay - head.rows['skull_top'] + oy)
        neck = m['neck']
        nc = np.full(shape, I('S2'), np.int16)
        nc[neck & (yy <= chin[1] + 3)] = I('S4')
        nc[neck & (xx < L['neck_top'][0] - 1)] = I('S3')
        add('neck', neck & ~col, 'skin', nc)
        # ---------------- sleeves: trumpet bells from the armband to a 27 px mouth at the wrist
        sleeves = {}
        armbands = {}
        for side in ('near', 'far'):
            sh_, el, wr = (np.array(L[f'shoulder_{side}'], float), np.array(L[f'elbow_{side}'], float),
                           np.array(L[f'wrist_{side}'], float))
            ab = sh_ + (el - sh_) * 0.45                                         # armband: the sleeve's tension point
            uf = wr - el
            uf = uf / (np.linalg.norm(uf) or 1)                                  # forearm direction
            mouth = s.get('sleeve_mouth', 27)
            down = np.array([0.0, 1.0])
            # (1) the tube over the upper arm, the elbow and the forearm, widening toward the mouth
            tube = A.capsule_mask(c(ab), c(el), 3.4, 4.2, shape) | A.capsule_mask(c(el), c(wr + uf * 2), 4.2, 5.8, shape)
            # (2) the drape: the bell's lower edge hangs by gravity from the elbow to the mouth
            m_top = wr + uf * 2.5 - down * 3.5
            m_bot = wr + uf * 3.5 + down * (mouth - 5)
            drape = A.poly_mask([c(el - down * 1), c(m_top), c(m_bot), c(el + down * (mouth * 0.32) + uf * 2)], shape)
            bm = tube | drape
            bcod = np.full(shape, I('W2'), np.int16)
            # one light: the top of the tube toward the light W1, the drape's lower half W3 (a designed shadow shape)
            sa, tt, _ = A.across(c(el), c(wr), shape)
            lit_sg = A.lit_side_sign(tuple(el), tuple(wr), lt)
            bcod[tube & (sa * lit_sg > 2.4)] = I('W1')
            drop_y = np.interp(xx + .5, sorted([el[0], m_bot[0]]), [el[1], m_bot[1]] if el[0] < m_bot[0] else [m_bot[1], el[1]])
            bcod[drape & ~tube & (yy > (el[1] + m_bot[1]) / 2 + 2)] = I('W3')
            # two pipe folds from the elbow (the tension point where the bell hangs) to the hem: W3, W4 at the pinch
            lightcloth = np.isin(bcod, [I('W1'), I('W2')])
            for k, frac in enumerate((0.35, 0.72)):
                f0 = el + down * (1.5 + k) + uf * (1 + k)
                f1 = m_top + (m_bot - m_top) * frac - uf * 2.5
                pts = [(x_, y_) for x_, y_ in A.line_px(f0, f1) if 0 <= y_ < H - 1 and 0 <= x_ < W and bm[y_, x_] and lightcloth[y_, x_]]
                if len(pts) < 6:
                    continue                                   # a fold shorter than 6 px is noise at 1x (PX-N09)
                for j, (x_, y_) in enumerate(pts):
                    bcod[y_, x_] = I('W4') if j < 2 else I('W3')
                    if j >= 2 and lightcloth[y_ + 1, x_]:
                        bcod[y_ + 1, x_] = I('W3')              # the fold's shadow side: a 2 px shape, not a dotted line
            # the lining shows inside the mouth (DESIGN 3 row 5), the gold hem on the rim, a fleur-cross at the corner
            lining = A.capsule_mask(c(m_top - uf * 1.5 + down * 2), c(m_bot - uf * 1.6 - down * 2), 1.1, 1.6, shape) & bm
            bcod[lining] = I('I3')
            bcod[lining & (yy > (m_top[1] + m_bot[1]) / 2 + 3)] = I('I4')
            rim = np.zeros(shape, bool)
            for x_, y_ in A.line_px(m_top, m_bot):
                if 0 <= y_ < H and 0 <= x_ < W:
                    rim[y_, x_] = True
            rim = A.dilate(rim, 0) & bm | (rim & ~bm)
            bm |= rim
            bcod[rim] = I('G2')
            bcod[rim & (yy > (m_top[1] + m_bot[1]) / 2)] = I('G3')
            hem = drape & ~A.shift(drape | tube, 0, -1) & ~rim
            bcod[hem] = I('G3')
            cxy = np.round(m_bot - uf * 5 - down * 4).astype(int)
            for dx, dy in ((0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (-1, -1), (1, -1)):
                X_, Y_ = cxy[0] + dx, cxy[1] + dy
                if 0 <= Y_ < H and 0 <= X_ < W and bm[Y_, X_] and not lining[Y_, X_] and not rim[Y_, X_]:
                    bcod[Y_, X_] = I('G2') if dx >= 0 else I('G3')
            sleeves[side] = (bm, bcod)
            nrm = np.array([-uf[1], uf[0]])
            ua = el - sh_
            ua = ua / (np.linalg.norm(ua) or 1)
            na = np.array([-ua[1], ua[0]])
            abm = A.capsule_mask(c(ab - na * 3.4), c(ab + na * 3.4), 0.9, 0.9, shape) & A.dilate(m[f'upper_arm_{side}'], 1)
            abc = np.full(shape, I('G2'), np.int16)
            abc[abm & (A.across(c(sh_), c(el), shape)[0] * A.lit_side_sign(tuple(sh_), tuple(el), lt) > 0)] = I('G1')
            armbands[side] = (abm, abc)
        # ---------------- hands (HD-P01): the near fist wraps the haft; the far hand per the spec
        hands = {}
        near_hc, near_wr = np.array(L['hand_near']), np.array(L['wrist_near'])
        ax_ = np.array(self.gdir)
        fore = near_hc - near_wr
        fore = fore / (np.linalg.norm(fore) or 1)
        across_h = np.array([-ax_[1], ax_[0]])
        if across_h @ fore < 0:
            across_h = -across_h                                     # points from the wrist side across the haft
        fsh = across_h * s.get('fist_shift', 0.0)
        fist = A.capsule_mask(c(near_hc - ax_ * 0.2 + fsh), c(near_hc + ax_ * 0.2 + fsh), 3.6, 3.6, shape)
        # the wrist step (HD-P01) is the small drop where the forearm meets the back of the hand, right at the fist
        wrist_step = A.capsule_mask(c(near_hc - fore * 3.0), c(near_hc - fore * 2.2), 1.8, 1.8, shape)
        hand = fist | wrist_step
        hcod = np.full(shape, I('S2'), np.int16)
        sac, _, _ = A.across(c(near_hc - ax_ * 4), c(near_hc + ax_ * 4), shape)
        sgn = A.lit_side_sign(tuple(near_hc - ax_ * 4), tuple(near_hc + ax_ * 4), lt)
        hcod[hand & (sac * sgn < -1.6)] = I('S3')
        kn = near_hc + across_h * 1.8
        kl = A.capsule_mask(c(kn - ax_ * 2.6), c(kn + ax_ * 2.6), 0.5, 0.5, shape) & fist
        hcod[kl] = I('S3')
        # the thumb wedge crosses the haft on the near side and sits inside the fist's outline (it does not
        # stick out: a proud thumb pushes the fist past HD-P02's 9 px while GR-P06 needs 2 px each side)
        th0 = near_hc - across_h * 0.8 + ax_ * 1.4 + fsh
        thumb = A.poly_mask([c(th0 - ax_ * 1.0), c(th0 + ax_ * 1.2 - across_h * 0.4), c(th0 + across_h * 1.4 + ax_ * 0.6),
                             c(th0 + across_h * 1.0 - ax_ * 0.8)], shape) & fist
        hcod[thumb] = I('S1')
        hand |= thumb
        self.thumb = thumb
        hands['near'] = (hand, hcod)
        far_hc, far_wr = np.array(L['hand_far']), np.array(L['wrist_far'])
        fd = far_hc - far_wr
        fd = fd / (np.linalg.norm(fd) or 1)
        palm = A.capsule_mask(c(far_hc - fd * 1.2), c(far_hc + fd * 1.6), 2.6, 2.6, shape)
        mitten = A.capsule_mask(c(far_hc + fd * 1.4), c(far_hc + fd * 3.0), 2.2, 1.4, shape)
        fwrist = A.capsule_mask(c(far_wr), c(far_wr + fd * 1.2), 1.8, 1.8, shape)
        fh = palm | mitten | fwrist
        fcod = np.full(shape, I('S2'), np.int16)
        sac, _, _ = A.across(c(far_wr), c(far_hc + fd * 4), shape)
        sgn = A.lit_side_sign(tuple(far_wr), tuple(far_hc + fd * 4), lt)
        fcod[fh & (sac * sgn < -1.0)] = I('S3')
        fth = A.capsule_mask(c(far_hc - fd * 0.5 + np.array([0.3, -2.2])), c(far_hc + fd * 1.5 + np.array([0.6, -2.8])), 0.9, 0.7, shape)
        fcod[fth] = I('S1')
        fh |= fth
        hands['far'] = (fh, fcod)
        # ---------------- glaive: haft with lacquer segments and gold grip bands, disc, cross arms, blade, stole
        gl = s['glaive']
        Bp = np.array(L['haft_butt'], float)
        u = np.array(self.gdir)
        n2 = np.array([-u[1], u[0]])
        q = lambda a_, o=0.0: Bp + u * a_ + n2 * o  # noqa: E731
        Lh = gl['length']
        haft = A.capsule_mask(c(q(6)), c(q(Lh - 44)), 1.45, 1.45, shape)
        hcd = np.full(shape, I('I3'), np.int16)
        sa_, ta_, _ = A.across(c(q(6)), c(q(Lh - 44)), shape)
        seg = np.cumsum([0] + [9, 3, 13, 5, 7, 4, 11, 6] * 6)
        k_ = np.searchsorted(seg, ta_ * (Lh - 50)) % 2 == 1
        lit_side = sa_ * A.lit_side_sign(tuple(q(6)), tuple(q(Lh - 44)), lt) > 0.3
        hcd[haft & k_ & lit_side] = I('I2')
        for g0 in (gl['grip_along'] - 8, gl['grip_along'] + 7, 48, Lh - 62):
            band = A.capsule_mask(c(q(g0)), c(q(g0 + 1.2)), 1.6, 1.6, shape) & haft
            hcd[band] = I('G2')
            hcd[band & ~lit_side] = I('G3')
        butt = A.capsule_mask(c(q(0.5)), c(q(6)), 1.2, 2.2, shape)
        bcode = np.full(shape, I('G2'), np.int16)
        bcode[butt & (A.across(c(q(0)), c(q(6)), shape)[0] < 0)] = I('G3')
        disc_c = q(Lh - 39)
        disc = A.ellipse_mask(c(disc_c), 6.2, 6.2, shape)
        dcod = np.full(shape, I('G2'), np.int16)
        inner = A.ellipse_mask(c(disc_c), 4.4, 4.4, shape)
        ang = (np.degrees(np.arctan2(yy + .5 - (disc_c[1] + .5), xx + .5 - (disc_c[0] + .5))) + 360) % 360
        dcod[inner] = np.where(((ang // 45) % 2 == 0)[inner], I('A2'), I('A3'))
        dcod[A.ellipse_mask(c(disc_c), 1.2, 1.2, shape)] = I('A5')
        dcod[inner & ~A.erode(inner)] = I('I4')
        dcod[disc & ~inner & (xx < disc_c[0])] = I('G3')
        dcod[disc & ~inner & (xx >= disc_c[0]) & (yy < disc_c[1])] = I('G1')
        arms = A.capsule_mask(c(q(Lh - 39, -12.5)), c(q(Lh - 39, 12.5)), 1.1, 1.1, shape)
        for sg in (-1, 1):
            arms |= A.ellipse_mask(c(q(Lh - 39, sg * 12.5)), 1.8, 1.8, shape)
        acod = np.full(shape, I('G1'), np.int16)
        acod[arms & (yy > disc_c[1] + 1)] = I('G3')
        blade = A.poly_mask([c(q(Lh - 34, -1.5)), c(q(Lh, -1.0)), c(q(Lh - 8, 2.5)), c(q(Lh - 22, 5.0)), c(q(Lh - 32, 4.0))], shape)
        blcod = np.full(shape, I('T3'), np.int16)
        sb, _, _ = A.across(c(q(Lh - 34)), c(q(Lh)), shape)
        blcod[blade & (sb > 1.5)] = I('T2')
        blcod[blade & (sb < -0.2)] = I('T4')
        rimb = blade & ~A.shift(blade, -1, 0)
        blcod[blade & A.shift(rimb, -1, 0) & ~rimb & (sb > 0.5)] = I('A5')
        fuller = A.capsule_mask(c(q(Lh - 31, 0.8)), c(q(Lh - 13, 0.8)), 0.5, 0.5, shape) & blade
        blcod[fuller] = I('G2')
        for a_ in (Lh - 28, Lh - 23, Lh - 18):
            p_ = np.round(q(a_, 0.8)).astype(int)
            if blade[p_[1], p_[0]]:
                blcod[p_[1], p_[0]] = I('A3')
        stole = np.zeros(shape, bool)
        topst = q(Lh - 48, -2)
        for k, (dx, ln) in enumerate(((-3, 34), (1, 28))):
            stole |= A.capsule_mask(c(np.add(topst, (dx * 0.5, 0))), c(np.add(topst, (dx - 4, ln))), 1.6, 1.9, shape)
        scod = np.full(shape, I('W2'), np.int16)
        # a ribbon that twists: the beige back shows in two alternating patches (DESIGN 3 row 13 colour flip)
        st_t = (yy - topst[1]) / 34.0
        scod[stole & (xx < topst[0] - 2) & ((st_t < 0.35) | (st_t > 0.7))] = I('B1')
        scod[stole & ~A.shift(stole, -1, 0) & (st_t > 0.1) & (st_t < 0.55)] = I('W1')
        # ---------------- composite, back to front
        cv = A.Canvas(W, H)
        z = np.zeros(shape, np.int16)
        zi = [0]

        def put(part, mask, mat, codes):
            zi[0] += 1
            mm = mask.copy()
            cv.code[mm] = codes[mm] if isinstance(codes, np.ndarray) else codes
            cv.mat[mm] = A.MAT[mat]
            cv.part[mm] = A.PART[part]
            z[mm] = zi[0]

        far_hand_mode = s['arms']['far'].get('pose', 'collar')
        order = ['veil', 'hair_back', 'leg_far', 'boot_far', 'arm_far']
        for nm in order:
            for part, mask, mat, codes in layers:
                if part == nm:
                    put(part, mask, mat, codes)
        if far_hand_mode == 'hip':
            # the far forearm, sleeve and hand hang beside / behind the hip
            put('arm_far', m['forearm_far'], 'skin', cyl(m['forearm_far'], L['elbow_far'], L['wrist_far'], 'skin', *R['forearm']))
            put('sleeve_far', sleeves['far'][0], 'white', sleeves['far'][1])
            put('sleeve_far', armbands['far'][0], 'gold', armbands['far'][1])
        for nm in ('torso', 'pelvis', 'leg_near', 'boot_near', 'tabard', 'neck', 'collar', 'cross'):
            for part, mask, mat, codes in layers:
                if part == nm:
                    put(part, mask, mat, codes)
                    if part == 'cross':
                        cv.mat[mask & (codes == I('I3'))] = A.MAT['indigo']
        if far_hand_mode == 'hip':
            put('hand_far', hands['far'][0], 'skin', hands['far'][1])
        # head
        zi[0] += 1
        ys_, xs_ = np.nonzero(keep)
        ty, tx = ys_ + oy, xs_ + ox
        ok = (ty >= 0) & (ty < H) & (tx >= 0) & (tx < W)
        ys_, xs_, ty, tx = ys_[ok], xs_[ok], ty[ok], tx[ok]
        cv.code[ty, tx] = hcv.code[ys_, xs_]
        cv.mat[ty, tx] = hcv.mat[ys_, xs_]
        cv.part[ty, tx] = hcv.part[ys_, xs_]
        z[ty, tx] = zi[0]
        # the head's OL ring pixels are re-derived by the body's outline pass: keep them only on the head silhouette
        if far_hand_mode != 'hip':
            put('arm_far', m['forearm_far'], 'skin', cyl(m['forearm_far'], L['elbow_far'], L['wrist_far'], 'skin', *R['forearm']))
            put('sleeve_far', sleeves['far'][0], 'white', sleeves['far'][1])
            put('sleeve_far', armbands['far'][0], 'gold', armbands['far'][1])
            put('hand_far', hands['far'][0], 'skin', hands['far'][1])
        put('arm_near', m['upper_arm_near'], 'skin', cyl(m['upper_arm_near'], L['shoulder_near'], L['elbow_near'], 'skin', *R['upper_arm']))
        put('arm_near', m['forearm_near'], 'skin', cyl(m['forearm_near'], L['elbow_near'], L['wrist_near'], 'skin', *R['forearm']))
        put('sleeve_near', sleeves['near'][0], 'white', sleeves['near'][1])
        put('sleeve_near', armbands['near'][0], 'gold', armbands['near'][1])
        put('weapon', stole, 'white', scod)
        cv.mat[stole & (scod == I('B1'))] = A.MAT['beige']
        put('weapon', haft, 'haft', hcd)
        put('weapon', butt, 'gold', bcode)
        put('weapon', arms, 'gold', acod)
        put('weapon', disc, 'gold', dcod)
        cv.mat[inner] = A.MAT['glass']
        put('weapon', blade, 'steel', blcod)
        put('hand_near', hands['near'][0], 'skin', hands['near'][1])
        self.z = z
        self.cv = cv
        self.finish_lines(cv, z)
        self.masks = dict(sleeves=sleeves, hands=hands, haft=haft, blade=blade, disc=disc, stole=stole,
                          tabard=tab, collar=col, cross=cross, cross_back=back)
        self.log.append('r1: dressed at DESIGN sizes (bell sleeves, hime back hair, veil), painted r1 head; '
                        'one key light from the upper front (the facing side); outline and contact lines as C1')
        return cv

    def finish_lines(self, cv, z):
        """the outline, inner contact lines and the light-on-light contact pass, as figure_construct.build"""
        pal, shape = self.pal, self.shape
        I = pal.i
        lum = np.zeros(len(pal.codes) + 1)
        for k, i in pal.index.items():
            lum[i] = pal.lum(k)
        fig = cv.code > 0
        sil = A.ring_in(fig)
        inner = np.zeros(shape, bool)
        codes_ = cv.code.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nz = A.shift(z, dx, dy)
            ncode = A.shift(codes_, dx, dy)
            npart = A.shift(cv.part, dx, dy)
            behind = fig & (nz > 0) & (nz < z) & (npart != cv.part)
            for s_ in ('near', 'far'):
                same = np.isin(cv.part, [A.PART[f'leg_{s_}'], A.PART[f'boot_{s_}']]) & \
                    np.isin(npart, [A.PART[f'leg_{s_}'], A.PART[f'boot_{s_}']])
                behind &= ~same
                same = np.isin(cv.part, [A.PART[f'arm_{s_}'], A.PART[f'sleeve_{s_}']]) & \
                    np.isin(npart, [A.PART[f'arm_{s_}'], A.PART[f'sleeve_{s_}']])
                behind &= ~same
            la, lb = lum[np.clip(codes_, 0, None)], lum[np.clip(ncode, 0, None)]
            ctr = (np.maximum(la, lb) + 0.05) / (np.minimum(la, lb) + 0.05)
            inner |= behind & (ctr < 3.0)
        skip_line = np.isin(cv.part, [A.PART['face'], A.PART['eye'], A.PART['cross'], A.PART['hair_front']]) | \
            (cv.mat == A.MAT['gold'])
        inner &= ~skip_line & ~sil
        for mat_name, mid in A.MAT.items():
            sel = inner & (cv.mat == mid)
            if sel.any() and mat_name in INNER:
                cv.code[sel] = I(INNER[mat_name])
        before = cv.code.copy()
        dbl = np.zeros(shape, bool)
        for (dx1, dy1), (dx2, dy2) in (((1, 0), (0, 1)), ((1, 0), (0, -1)), ((-1, 0), (0, 1)), ((-1, 0), (0, -1))):
            a1 = A.shift(sil, -dx1, -dy1)
            a2 = A.shift(sil, -dx2, -dy2)
            diag_out = ~A.shift(fig, -(dx1 + dx2), -(dy1 + dy2))
            dbl |= sil & a1 & a2 & diag_out & A.shift(fig, dx1, dy1) & A.shift(fig, dx2, dy2)
        line = sil & ~dbl
        cv.code[line] = I('OL')
        cv.code[dbl] = before[dbl]
        cv.mat[line & (cv.mat == 0)] = A.MAT['line']
        self.doubles_removed = int(dbl.sum())
        for b_ in getattr(self, 'bands', []):
            cv.mat[b_ & np.isin(cv.part, [A.PART['leg_near'], A.PART['leg_far']])] = A.MAT['gold']
        light = [A.MAT[k] for k in ('white', 'skin', 'gold', 'veil', 'beige')]
        code2 = cv.code.copy()
        fixed = np.zeros(shape, bool)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nm = A.shift(cv.mat, dx, dy)
            nc = A.shift(code2, dx, dy)
            nzv = A.shift(z, dx, dy)
            la, lb = lum[np.clip(code2, 0, None)], lum[np.clip(nc, 0, None)]
            ctr = (np.maximum(la, lb) + 0.05) / (np.minimum(la, lb) + 0.05)
            cand = fig & ~line & np.isin(cv.mat, light) & np.isin(nm, light) & (nm != cv.mat) & (ctr < 1.5) & (nc > 0)
            front = cand & ((z > nzv) | ((z == nzv) & (cv.mat != A.MAT['skin'])))
            facey = np.isin(cv.part, [A.PART['face'], A.PART['eye']])
            fixed |= front & ~facey
            fixed |= cand & (z < nzv) & A.shift(facey, dx, dy)
        for mat_name in ('white', 'skin', 'veil', 'beige'):
            sel = fixed & (cv.mat == A.MAT[mat_name]) & ~np.isin(cv.part, [A.PART['face'], A.PART['eye']])
            cv.code[sel] = I(INNER[mat_name])
        cv.code[fixed & (cv.mat == A.MAT['gold'])] = I('G3')
        # small S1 lights where the key light hits skin squarely (shoulder tops), 2-4 px each (PX-P11 spirit)
        for spot in getattr(self, 's1_spots', []):
            sel = spot & (cv.mat == A.MAT['skin']) & (cv.code == I('S2'))
            if 2 <= sel.sum() <= 5:
                cv.code[sel] = I('S1')
        if self.s.get('render', {}).get('cleanup', True):
            # the automatic cleanup (DESIGN 12 hand-touch budget, RESEARCH 4.8): a lone pixel with no neighbour of its
            # colour (8-connected) inside a flat area takes that area's colour; never on the face, eyes, gold or lines
            code0 = cv.code.copy()
            Hh, Ww = shape
            keepm = np.isin(cv.part, [A.PART['face'], A.PART['eye'], A.PART['cross']]) | (cv.mat == A.MAT['gold']) |                 (code0 == I('OL'))
            for y in range(1, Hh - 1):
                for x in range(1, Ww - 1):
                    v = code0[y, x]
                    if v <= 0 or keepm[y, x]:
                        continue
                    nb = [code0[y + dy, x + dx] for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                    dg = [code0[y + dy, x + dx] for dy, dx in ((1, 1), (1, -1), (-1, 1), (-1, -1))]
                    if v not in nb and v not in dg and len(set(nb)) == 1 and nb[0] > 0:
                        cv.code[y, x] = nb[0]
        if self.s.get('render', {}).get('selout', True):
            # sel-out (jansson, yu-mistakes; PX-P18): on the lit side the silhouette line takes the material's deep tone,
            # never where she meets the ground and never on the hair (the hair keeps its dark frame)
            lx, ly = self.light
            fig2 = cv.code > 0
            out_dir = np.zeros(shape, bool)
            unlit = np.zeros(shape, bool)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if dx * lx + dy * ly > 0.3:
                    out_dir |= ~A.shift(fig2, -dx, -dy)
                else:
                    unlit |= ~A.shift(fig2, -dx, -dy)
            out_dir &= ~unlit                          # a corner that also faces away from the light keeps its OL
            deep = {'white': 'W4', 'skin': 'S4', 'gold': 'G4', 'veil': 'W4', 'beige': 'B2'}
            olm = (cv.code == I('OL')) & out_dir & (np.arange(self.H)[:, None] < self.S - 2)
            for mname, code in deep.items():
                sel = olm & (cv.mat == A.MAT[mname])
                cv.code[sel] = I(code)

    def pose_json(self, name):
        pose = super().pose_json(name)
        mode = self.s['arms']['far'].get('pose', 'collar')
        pose['hands']['far']['on'] = mode
        pose['route'] = 'r1 figure_paint'
        return pose


def build(spec_path, name=None, ref=None, overrides=None, do_sheet=False, out=OUT, paint=None):
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    spec = FCN.merged(spec, overrides or {})
    name = name or spec['name']
    spec['name'] = name
    fig = PaintFigure(spec)
    fig.gesture()
    fig.mannequin()
    fig.build()
    if paint:
        apply_paint(fig, paint)
    od = Path(out) / name
    od.mkdir(parents=True, exist_ok=True)
    fig.cv.save(fig.pal, od / 'sprite.png')
    fig.cv.save_layers(str(od / 'sprite'))
    pose = fig.pose_json(name)
    ref_img, ref_info = (None, None)
    if ref:
        ref_img, ref_info = FCN.load_ref(ref, fig)
        pose['reference'] = ref_info
    A.jdump(pose, od / 'pose.json')
    frec = fig.face.record(f'{name}_face')
    frec['origin_on_sprite'] = list(fig.face_origin)
    A.jdump(frec, od / 'face.json')
    fig.head.cv.save_layers(str(od / 'face'))
    A.jdump({'name': name, 'spec': spec, 'log': fig.log, 'reference': ref_info, 'paint': paint,
             '_doc': 'the spec this sprite was built from (tools/art-construct/figure_paint.py, round R1) and the log'},
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


def apply_paint(fig, paint):
    """the hand-touch layer (DESIGN 12 'hand-touch budget'; PIPELINE 3.10 override equivalent): explicit pixel
    edits authored after looking at the render, each with the reason. paint = {'_doc':..., 'edits': [{'why':...,
    'px': [[x, y, 'KEYCHAR'], ...]}]}. Material and part ids stay those of the pixel underneath, except
    where an edit sets 'mat' / 'part'."""
    I = fig.pal.i
    for e in paint.get('edits', []):
        for x, y, ch in e['px']:
            if ch == '.':
                fig.cv.code[y, x] = 0
                fig.cv.mat[y, x] = 0
                fig.cv.part[y, x] = 0
                continue
            fig.cv.code[y, x] = I(A.KEY[ch])
            if 'mat' in e:
                fig.cv.mat[y, x] = A.MAT[e['mat']]
            if 'part' in e:
                fig.cv.part[y, x] = A.PART[e['part']]


THUMB_RULES = FCN.THUMB_RULES


def thumbnails(spec_path, out=OUT, sheet_name=None):
    """WF-P03 on the r1 figure: every thumbnail in the spec is built with the r1 part models, filled solid,
    scored on the silhouette rules; ranked; the sheet shows the solid fill and the colour build at 2x"""
    import rules_check as RC
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    name = spec['name']
    tdir = Path(out) / name / 'thumbs'
    tdir.mkdir(parents=True, exist_ok=True)
    res = []
    for tv in spec.get('thumbnails', []):
        vname = tv['name']
        fig, pose = build(spec_path, f'{name}__{vname}', None, tv.get('set', {}), False, tdir)
        ctx = RC.Ctx(tdir / f'{name}__{vname}')
        rows = RC.run(ctx, list(THUMB_RULES))
        passed = [r['id'] for r in rows if r['status'].startswith('PASS')]
        gaps, _ = RC.arm_gaps(ctx.mask, ctx.parts)
        area = sum(a for a, w, s_ in gaps if a >= 30 and w >= 3)
        figm = fig.cv.code > 0
        body = figm & (fig.cv.part != A.PART['weapon'])
        xs = np.nonzero(body.any(0))[0]
        res.append({'name': vname, 'idea': tv.get('idea', ''), 'set': tv.get('set', {}), 'score': len(passed),
                    'gap_area': area, 'width': int(xs.max() - xs.min() + 1), 'passed': passed,
                    'failed': [f"{r['id']}: {r['measured']}" for r in rows if r['status'].startswith('FAIL')],
                    'verdict': tv.get('verdict', ''), 'fig': fig})
    ranked = sorted(res, key=lambda r: (-r['score'], -r['gap_area']))
    for i, r in enumerate(ranked):
        r['rank'] = i + 1
        r['kept'] = i < 2
        A.jdump({k: v for k, v in r.items() if k != 'fig'}, tdir / f"{r['name']}.json")
    panels, colour = [], []
    for r in ranked:
        cv = r['fig'].cv
        sil = np.full(cv.code.shape + (3,), 104, np.uint8)
        sil[cv.code > 0] = (24, 20, 36)
        sil[cv.part == A.PART['weapon']] = (70, 66, 90)
        tag = f"#{r['rank']} {r['name']} {r['score']}/{len(THUMB_RULES)} w{r['width']}"
        panels.append((tag, A.zoom(Image.fromarray(sil), 2)))
        colour.append((r['name'], A.zoom(A.on_bg(cv.image(r['fig'].pal)), 2)))
    SHEETS.mkdir(parents=True, exist_ok=True)
    s = A.stack([A.row_sheet(panels, title=f'{name} thumbnails (WF-P03): solid fill at 2x, scored on ' + ', '.join(THUMB_RULES)),
                 A.row_sheet(colour, title='the same thumbnails as a colour block-in, 2x')])
    s.save(SHEETS / (sheet_name or f'{name}_thumbs.png'))
    return ranked


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('spec')
    ap.add_argument('--name')
    ap.add_argument('--ref', nargs='?', const=str(FCN.DEFAULT_REF))
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--thumbs', action='store_true')
    ap.add_argument('--paint', help='hand-touch layer json')
    ap.add_argument('--out', default=str(OUT))
    a = ap.parse_args()
    if a.thumbs:
        for r in thumbnails(a.spec, a.out):
            print(f"#{r['rank']} {r['name']:18s} {r['score']}/{len(THUMB_RULES)} gap {r['gap_area']:4d} width {r['width']}  fails: "
                  + '; '.join(f[:70] for f in r['failed']))
        return
    paint = json.loads(Path(a.paint).read_text(encoding='utf-8')) if a.paint else None
    fig, pose = build(a.spec, a.name, a.ref, None, a.sheet, a.out, paint)
    print(pose['name'], 'ok;', '; '.join(fig.log))


if __name__ == '__main__':
    main()
