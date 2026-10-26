"""Construct a figure from a gesture spec the way an artist does, with the 3D render as an optional
reference layer only (ART-RULES WF-P01, WF-P02, WF-P06).

  python tools/art-construct/figure_construct.py art/rosace/construct/figure/idle_hero.gesture.json
         [--ref <render dir with still.png + meta.json>] [--set key.sub=value ...] [--name NAME] [--sheet]

Steps, each kept as a layer for the construction sheet:
  1. gesture   line of action (a quadratic curve crown -> weight heel), shoulder / hip / head axes,
               plumb line from the pit of the neck, weight foot, joints (IK from the hand and foot targets)
  2. mannequin head ball, rib-cage and pelvis boxes on one spine, limb cylinders (tapered capsules)
  3. silhouette solid fill; negative space (arm-body gaps) found and measured; keep-out / must-be zones
  4. dressing  costume parts over the mannequin (DESIGN section 3, revision 3): collar with the 5x5 cross,
               bodice, chest window, hip band, tabard, dark thigh-highs, boots, trumpet sleeves, hair, veil,
               the glaive, and hands built from palm box + mitten + thumb wedge (HD-P01)
  5. shading   one key light (upper front, the facing side), one terminator per form, designed cast
               shadows, no pillow shading; then the outline (OL silhouette, lighter inner lines)
  6. final     pixels (the face comes from face_construct.py with the pose's expression and gaze)
Writes art/rosace/construct/figure/<name>/: sprite.png, sprite_ids.png, sprite_parts.png, pose.json,
construct.json; with --sheet, review/rosace/construct/figure/<name>_construct.png.
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
import face_construct as FC  # noqa: E402

OUT = A.ROOT / 'art' / 'rosace' / 'construct' / 'figure'
SHEETS = A.ROOT / 'review' / 'rosace' / 'construct' / 'figure'
DEFAULT_REF = Path(r'D:\Dex\Projects\dex-place-art\rosace\build\renders\r4fix\idle_hero\px144')

# tone ramps per material, dark -> light: deep, shadow, lit, highlight. Thigh-highs use the indigo
# ramp (DESIGN 3 row 11, revision 3) even though palette.json's 'stocking' still maps the W ramp (O-6).
RAMP = {
    'skin': ['S4', 'S3', 'S2', 'S1'], 'white': ['W4', 'W3', 'W2', 'W1'], 'stocking': ['I4', 'I3', 'I2', 'I1'],
    'gold': ['G4', 'G3', 'G2', 'G1'], 'hair': ['I4', 'I3', 'I2', 'I1'], 'hairtip': ['I3', 'A2', 'A3', 'A4'],
    'lining': ['OL', 'I4', 'I3', 'I2'], 'boot': ['OL', 'I4', 'I3', 'I1'], 'haft': ['OL', 'I4', 'I3', 'I2'],
    'steel': ['T4', 'T4', 'T3', 'T2'], 'veil': ['W4', 'W3', 'W2', 'W1'], 'beige': ['B2', 'B2', 'B1', 'B1'],
}
INNER = {'skin': 'S4', 'white': 'W4', 'stocking': 'I4', 'gold': 'G4', 'hair': 'I4', 'hairtip': 'I3',
         'lining': 'OL', 'boot': 'OL', 'haft': 'OL', 'steel': 'T4', 'veil': 'W4', 'beige': 'B2', 'glass': 'I4'}


def merged(base, over):
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = merged(out[k], v)
        else:
            out[k] = v
    return out


def ik(root, target, a, b, hint):
    """2-bone IK: joint position for segment lengths a (root->joint), b (joint->end); of the two
    solutions, the one closer to hint"""
    rx, ry = root
    tx, ty = target
    d = math.hypot(tx - rx, ty - ry)
    d = max(abs(a - b) + 0.01, min(a + b - 0.01, d))
    ang = math.atan2(ty - ry, tx - rx)
    c = (a * a + d * d - b * b) / (2 * a * d)
    A_ = math.acos(max(-1, min(1, c)))
    sols = [(rx + a * math.cos(ang + s * A_), ry + a * math.sin(ang + s * A_)) for s in (1, -1)]
    return min(sols, key=lambda p: (p[0] - hint[0]) ** 2 + (p[1] - hint[1]) ** 2)


def angle_between(v1, v2):
    a = math.degrees(math.atan2(v1[1], v1[0]) - math.atan2(v2[1], v2[0]))
    return (a + 180) % 360 - 180


class Figure:
    def __init__(self, spec, ref=None):
        self.s = spec
        self.pal = A.Palette()
        self.W, self.H = spec['canvas']
        self.S = spec['sole_y']
        self.cx = spec['cx']
        self.shape = (self.H, self.W)
        self.g = A.Guides()
        self.L = {}
        self.log = []
        self.ref = ref
        light = np.array([0.6, -0.8])
        if spec.get('facing', 'right') == 'left':
            light[0] *= -1
        self.light = light / np.linalg.norm(light)

    def P(self, dx, h):
        return (self.cx + dx, self.S - h)

    # ------------------------------------------------------------ 1. gesture
    def gesture(self):
        s, L, P = self.s, self.L, self.P
        L['sole_y'] = self.S
        L['skull_top'] = P(s['head']['chin_dx'] - 5, s['H'])
        L['chin'] = P(s['head']['chin_dx'], s['head']['chin_h'])
        L['pit_neck'] = P(s['neck']['pit_dx'], s['neck']['pit_h'])
        # shoulders: a line through the pit of the neck, tilted (+ = far side up)
        sh = s['shoulders']
        t = math.radians(sh['tilt_deg'])
        px, py = L['pit_neck']
        L['shoulder_near'] = (px - sh['near_w'] * math.cos(t), py + sh['near_w'] * math.sin(t) + 1)
        L['shoulder_far'] = (px + sh['far_w'] * math.cos(t), py - sh['far_w'] * math.sin(t) + 1)
        # pelvis: hip joints on a tilted line; the crotch under the pelvis centre
        pv = s['pelvis']
        t = math.radians(pv['tilt_deg'])
        pcx, pcy = P(pv['dx'], pv['h'])
        L['pelvis_c'] = (pcx, pcy)
        L['hip_near'] = (pcx - (pv['near_w'] - 4) * math.cos(t), pcy + (pv['near_w'] - 4) * math.sin(t))
        L['hip_far'] = (pcx + (pv['far_w'] - 4) * math.cos(t), pcy - (pv['far_w'] - 4) * math.sin(t))
        L['pelvis_edge_near'] = (pcx - pv['near_w'] * math.cos(t), pcy + pv['near_w'] * math.sin(t))
        L['pelvis_edge_far'] = (pcx + pv['far_w'] * math.cos(t), pcy - pv['far_w'] * math.sin(t))
        L['crotch'] = P(pv['dx'] + 1, pv['crotch_h'])
        L['waist_c'] = P(s['waist']['dx'], s['waist']['h'])
        L['rib_c'] = P(s['ribcage']['dx'], s['ribcage']['h'])
        ln = s['lengths']
        # legs: heel targets, knees by IK toward the hint
        for side in ('near', 'far'):
            lg = s['legs'][side]
            heel = P(*lg['heel'])
            hip = L[f'hip_{side}']
            ankle = (heel[0], heel[1] - 4)
            knee = ik(hip, ankle, ln['thigh'], ln['calf'] - 4, P(*lg['knee_hint']))
            L[f'heel_{side}'] = heel
            L[f'ankle_{side}'] = ankle
            L[f'knee_{side}'] = knee
            L[f'toe_{side}'] = P(*lg['toe'])
        # glaive: butt, angle from vertical leaning away from the body (tip toward the near side)
        gl = s['glaive']
        a = math.radians(gl['angle_deg'])
        lean = -1 if s.get('facing', 'right') == 'right' else 1        # near side = screen-left
        self.gdir = (lean * math.sin(a), -math.cos(a))
        bx, by = P(*gl['butt'])
        L['haft_butt'] = (bx, by)
        L['haft_tip'] = (bx + self.gdir[0] * gl['length'], by + self.gdir[1] * gl['length'])
        g = gl['grip_along']
        L['grip_near'] = (bx + self.gdir[0] * g, by + self.gdir[1] * g)
        # arms: hand targets, elbows by IK
        for side in ('near', 'far'):
            am = s['arms'][side]
            sh_ = L[f'shoulder_{side}']
            if am['hand'] == 'grip':
                hand = L['grip_near']
            else:
                hand = P(*am['hand'])
            # 3/4 view: a segment turned toward or away from the camera looks shorter ([upper, fore])
            fs = am.get('foreshorten', 1.0)
            fu, ff = (fs, fs) if not isinstance(fs, list) else fs
            ua, fa = ln['upper_arm'] * fu, ln['forearm'] * ff
            # IK to the hand centre (forearm + 3.5 px of palm); the wrist sits on the forearm line
            elbow = ik(sh_, hand, ua, fa + 3.5, P(*am['elbow_hint']))
            dx, dy = hand[0] - elbow[0], hand[1] - elbow[1]
            dd = math.hypot(dx, dy) or 1
            wrist = (elbow[0] + fa * dx / dd * min(1.0, (dd - 3.5) / fa if fa else 1), elbow[1] + fa * dy / dd * min(1.0, (dd - 3.5) / fa if fa else 1))
            L[f'hand_{side}'] = hand
            L[f'wrist_{side}'] = wrist
            L[f'elbow_{side}'] = elbow
        # line of action: crown -> (through the hip on the weight side) -> weight heel
        wf = s['weight_foot']
        crown = L['skull_top']
        heel = L[f'heel_{wf}']
        mid = L[f'pelvis_edge_{wf}']
        # control point so the curve passes through the weight hip at t = 0.5
        ctrl = (2 * mid[0] - 0.5 * (crown[0] + heel[0]), 2 * mid[1] - 0.5 * (crown[1] + heel[1]))
        L['loa'] = [crown, mid, heel]
        self.loa_curve = A.bezier(crown, ctrl, heel, 40)
        # the neck column starts under the skull, behind the chin (3/4: the jaw juts toward the facing side)
        L['neck_top'] = (L['chin'][0] - s['neck'].get('back', 4), L['chin'][1] - 1)
        L['head_axis'] = [L['skull_top'], L['chin']]          # replaced by the face centre line after the head is placed
        L['neck_axis'] = [L['neck_top'], L['pit_neck']]
        L['torso_centerline'] = [L['pit_neck'], L['rib_c'], L['waist_c'], L['crotch']]
        # guides
        G = self.g
        G.poly([(x + .5, y + .5) for x, y in self.loa_curve], (255, 90, 90), 3, layer='gesture')
        G.line(np.add(L['shoulder_near'], .5), np.add(L['shoulder_far'], .5), (120, 220, 255), 2, layer='gesture')
        G.line(np.add(L['hip_near'], .5), np.add(L['hip_far'], .5), (120, 220, 255), 2, layer='gesture')
        G.line((L['pit_neck'][0] + .5, L['pit_neck'][1]), (L['pit_neck'][0] + .5, self.S + 1), (255, 255, 120), 1,
               layer='gesture')
        for a_, b_ in (('shoulder_near', 'elbow_near'), ('elbow_near', 'wrist_near'), ('shoulder_far', 'elbow_far'),
                       ('elbow_far', 'wrist_far'), ('hip_near', 'knee_near'), ('knee_near', 'ankle_near'),
                       ('hip_far', 'knee_far'), ('knee_far', 'ankle_far'), ('neck_top', 'pit_neck'),
                       ('pit_neck', 'rib_c'), ('rib_c', 'waist_c'), ('waist_c', 'pelvis_c')):
            G.line(np.add(L[a_], .5), np.add(L[b_], .5), (240, 240, 240), 2, layer='gesture')
        for k in ('shoulder_near', 'shoulder_far', 'elbow_near', 'elbow_far', 'wrist_near', 'wrist_far', 'hip_near',
                  'hip_far', 'knee_near', 'knee_far', 'heel_near', 'heel_far', 'pit_neck', 'chin'):
            G.dot(np.add(L[k], .5), (255, 200, 80), 3, layer='gesture')
        G.line(np.add(L['haft_butt'], .5), np.add(L['haft_tip'], .5), (160, 255, 160), 2, layer='gesture')
        G.circle(np.add(L['chin'], (.5 - 6, .5 - 12)), 12.5, (240, 240, 240), 2, layer='gesture')
        self.log.append('gesture: joints from targets by IK; weight on the %s foot' % wf)

    # ------------------------------------------------------------ 2. mannequin (masses on one spine)
    def mannequin(self):
        L, shape, G = self.L, self.shape, self.g
        s = self.s
        c = lambda p: (p[0] + .5, p[1] + .5)  # noqa: E731
        m = {}
        # rib cage box: shoulders to the bottom of the ribs; pelvis box: waist to the crotch
        rb = s['ribcage']
        rc = L['rib_c']
        tilt = math.radians(s['shoulders']['tilt_deg'])
        rib = [c(L['shoulder_near']), c(L['shoulder_far']),
               c((rc[0] + rb['far_w'], rc[1] - rb['far_w'] * math.sin(tilt) + 3)),
               c((rc[0] - rb['near_w'], rc[1] + rb['near_w'] * math.sin(tilt) + 3))]
        w = s['waist']
        wc = L['waist_c']
        pel = [c((wc[0] - w['near_w'], wc[1])), c((wc[0] + w['far_w'], wc[1])),
               c(L['pelvis_edge_far']), c((L['crotch'][0] + 4, L['crotch'][1])),
               c((L['crotch'][0] - 4, L['crotch'][1])), c(L['pelvis_edge_near'])]
        m['rib'] = A.poly_mask(rib, shape)
        m['pelvis'] = A.poly_mask(pel, shape)
        # the torso silhouette joins them through the waist (the pinch on the weight side)
        torso = [c(L['shoulder_near']), c((L['pit_neck'][0] - 4, L['pit_neck'][1])),
                 c((L['pit_neck'][0] + 4, L['pit_neck'][1])), c(L['shoulder_far']),
                 c((L['shoulder_far'][0] - 2, L['shoulder_far'][1] + 7)), rib[2],
                 c((wc[0] + w['far_w'], wc[1])), c(L['pelvis_edge_far']),
                 c((L['crotch'][0] + 4, L['crotch'][1])), c((L['crotch'][0] - 4, L['crotch'][1])),
                 c(L['pelvis_edge_near']), c((wc[0] - w['near_w'], wc[1])), rib[3],
                 c((L['shoulder_near'][0] + 2, L['shoulder_near'][1] + 7))]
        m['torso'] = A.poly_mask(torso, shape)
        self.torso_poly = torso
        self.rib_poly, self.pel_poly = rib, pel
        # limbs as tapered cylinders (radii at 144 px, [I])
        R = {'thigh': (6.0, 3.6), 'calf': (3.6, 2.3), 'upper_arm': (3.4, 2.7), 'forearm': (2.7, 2.1)}
        for side in ('near', 'far'):
            m[f'thigh_{side}'] = A.capsule_mask(c(L[f'hip_{side}']), c(L[f'knee_{side}']), *R['thigh'], shape)
            calf_mid = (L[f'knee_{side}'][0] * 0.65 + L[f'ankle_{side}'][0] * 0.35,
                        L[f'knee_{side}'][1] * 0.65 + L[f'ankle_{side}'][1] * 0.35)
            m[f'calf_{side}'] = (A.capsule_mask(c(L[f'knee_{side}']), c(calf_mid), 3.6, 4.1, shape) |
                                 A.capsule_mask(c(calf_mid), c(L[f'ankle_{side}']), 4.1, 2.3, shape))
            m[f'foot_{side}'] = A.poly_mask([c((L[f'ankle_{side}'][0] - 2, L[f'ankle_{side}'][1])),
                                             c((L[f'ankle_{side}'][0] + 2.5, L[f'ankle_{side}'][1])),
                                             c(L[f'toe_{side}']), c((L[f'toe_{side}'][0], L[f'toe_{side}'][1] - 3)),
                                             c((L[f'heel_{side}'][0] - 2.5, L[f'heel_{side}'][1]))], shape) | \
                A.capsule_mask(c(L[f'heel_{side}']), c(L[f'toe_{side}']), 2.2, 1.6, shape)
            m[f'upper_arm_{side}'] = A.capsule_mask(c(L[f'shoulder_{side}']), c(L[f'elbow_{side}']), *R['upper_arm'], shape)
            m[f'forearm_{side}'] = A.capsule_mask(c(L[f'elbow_{side}']), c(L[f'wrist_{side}']), *R['forearm'], shape)
        m['neck'] = A.capsule_mask(c(L['neck_top']), c(L['pit_neck']), s['neck']['width'] / 2, s['neck']['width'] / 2 + .5, shape)
        m['head'] = A.ellipse_mask((L['chin'][0] - 5.5, L['chin'][1] - 13), 12, 13, shape)
        self.mq = m
        for k in ('rib', 'pelvis'):
            G.poly(rib if k == 'rib' else pel, (120, 220, 255), 2, closed=True, layer='mannequin')
        for side in ('near', 'far'):
            for a_, b_, r in (('hip', 'knee', R['thigh']), ('knee', 'ankle', R['calf']),
                              ('shoulder', 'elbow', R['upper_arm']), ('elbow', 'wrist', R['forearm'])):
                p0, p1 = np.add(L[f'{a_}_{side}'], .5), np.add(L[f'{b_}_{side}'], .5)
                d = np.subtract(p1, p0)
                n = np.array([-d[1], d[0]]) / (np.linalg.norm(d) or 1)
                G.poly([p0 + n * r[0], p1 + n * r[1], p1 - n * r[1], p0 - n * r[0]], (200, 200, 255), 1, closed=True,
                       layer='mannequin')
        G.circle((L['chin'][0] - 5, L['chin'][1] - 12.5), 11, (200, 200, 255), 2, layer='mannequin')
        self.log.append('mannequin: rib cage and pelvis boxes on one spine; limbs as tapered cylinders')

    # ------------------------------------------------------------ 3-6. dressing, shading, pixels
    def build(self):
        s, L, shape, pal = self.s, self.L, self.shape, self.pal
        I = pal.i
        c = lambda p: (p[0] + .5, p[1] + .5)  # noqa: E731
        m = self.mq
        H, W = shape
        yy, xx = np.mgrid[0:H, 0:W]
        layers = []                      # (part, mask, mat, codes array or code)
        lt = self.light

        def ramp_codes(mat):
            return [I(k) for k in RAMP[mat]]

        def cyl(mask, p0, p1, mat, r0, r1, sheen=False, shadow_frac=0.3, deep=None):
            """one terminator along the form: shadow on the side away from the light"""
            deepc, sh, lit, hi = ramp_codes(mat)
            sgn = A.lit_side_sign(p0, p1, lt)
            sacross, t, _ = A.across(c(p0), c(p1), shape)
            r = r0 + (r1 - r0) * np.clip(t, 0, 1)
            u = sgn * sacross / np.maximum(r, 0.5)
            tt = np.clip(t, 0, 1)
            frac = shadow_frac - 0.28 * np.sin(np.pi * tt) + 0.12 * np.sin(3 * np.pi * tt + 0.7)
            out = np.full(shape, lit, np.int16)
            out[u < -frac] = sh
            if sheen:
                out[(u > 0.35 + 0.2 * np.cos(2 * np.pi * tt)) & (u < 0.8)] = hi
            if deep is not None:
                out[deep] = deepc
            return out

        def add(part, mask, mat, codes):
            layers.append((part, mask, mat, codes))

        # --- back hair and veil (behind everything)
        hs = s['hair']
        head_back = (L['chin'][0] - 13, L['chin'][1] - 14)
        tail_end = (L['shoulder_near'][0] - hs.get('tail_dx', 3), self.S - hs['tail_h'])
        hair_back = A.poly_mask([c((head_back[0] - 1, head_back[1] - 6)), c((head_back[0] + 8, head_back[1])),
                                 c((L['shoulder_near'][0] + 5, L['shoulder_near'][1] + 6)),
                                 c((tail_end[0] + 4, tail_end[1] - 10)), c((tail_end[0] + 1, tail_end[1])),
                                 c((tail_end[0] - 3, tail_end[1] - 2)),
                                 c((L['shoulder_near'][0] - 5, L['shoulder_near'][1] + 10)),
                                 c((head_back[0] - 4, head_back[1] + 8))], shape)
        hb = cyl(hair_back, head_back, tail_end, 'hair', 6, 3, sheen=False, shadow_frac=0.35)
        tip = hair_back & (yy > tail_end[1] - 7)
        hb[tip] = I('A3')
        hb[hair_back & (yy > tail_end[1] - 3)] = I('A4')
        ring_y = int(tail_end[1] - 11)
        hb[hair_back & (yy >= ring_y) & (yy <= ring_y + 1)] = I('G2')
        add('hair_back', hair_back, 'hair', hb)
        veil = A.poly_mask([c((head_back[0] + 2, head_back[1] - 12)), c((head_back[0] + 9, head_back[1] - 10)),
                            c((head_back[0] + 6, head_back[1] + 14)), c((head_back[0] - 6, head_back[1] + 18)),
                            c((head_back[0] - 8, head_back[1] + 4))], shape)
        vc = np.full(shape, I('W2'), np.int16)
        vc[veil & (xx < head_back[0] - 3)] = I('W3')
        vc[veil & ~A.shift(veil, 0, -2)] = I('B1')                      # lace hem
        add('veil', veil, 'veil', vc)
        # --- far leg (weight leg), far boot
        boot_h = 20
        stock_h = 56
        for side in ('far', 'near'):
            thigh, calf, foot = m[f'thigh_{side}'], m[f'calf_{side}'], m[f'foot_{side}']
            leg = thigh | calf
            hip, knee, ankle = L[f'hip_{side}'], L[f'knee_{side}'], L[f'ankle_{side}']
            skin_part = leg & (yy <= self.S - stock_h)
            stock = leg & (yy > self.S - stock_h) & (yy <= self.S - boot_h)
            boot = (leg | foot) & (yy > self.S - boot_h) | foot
            codes = np.where(yy <= knee[1], cyl(thigh, hip, knee, 'skin', 6, 3.6, shadow_frac=0.35),
                             cyl(calf, knee, ankle, 'skin', 3.6, 2.3))
            add(f'leg_{side}', skin_part, 'skin', codes)
            sc = np.where(yy <= knee[1], cyl(thigh, hip, knee, 'stocking', 6, 3.6, sheen=True, shadow_frac=0.25),
                          cyl(calf, knee, ankle, 'stocking', 3.6, 2.3, sheen=True, shadow_frac=0.25))
            # knee: the sheen breaks at the knee (a plane change), so it doesn't run as one stripe
            sc[stock & (np.abs(yy - knee[1]) <= 1) & (sc == I('I1'))] = I('I2')
            band = stock & (yy == int(self.S - stock_h + 1))
            sc[band] = I('G2')
            add(f'leg_{side}', stock, 'stocking', sc)
            self.bands = getattr(self, 'bands', []) + [band]
            bc = cyl(calf | foot, knee, ankle, 'boot', 4, 3, sheen=False, shadow_frac=0.2)
            bc[boot & (yy == int(self.S - boot_h + 1))] = I('G2')          # gold cuff line (DESIGN 3 row 12)
            toe = foot & (np.abs(xx - L[f'toe_{side}'][0]) <= 2)
            bc[toe] = I('G2')
            streak = boot & (xx == int(round((knee[0] + ankle[0]) / 2 + 1))) & (yy > self.S - boot_h + 3) & (yy < self.S - 8)
            bc[streak] = I('I1')
            add(f'boot_{side}', boot, 'boot', bc)
        # the near (free) leg is in front of the far leg: re-order so far goes first
        order_legs = [l for l in layers if l[0].endswith('_far')] + [l for l in layers if l[0].endswith('_near')]
        layers = [l for l in layers if not (l[0].endswith('_far') or l[0].endswith('_near'))] + order_legs
        # --- far upper arm (behind the torso at the shoulder)
        add('arm_far', m['upper_arm_far'], 'skin',
            cyl(m['upper_arm_far'], L['shoulder_far'], L['elbow_far'], 'skin', 3, 2.4))
        # --- torso: skin sides + bodice panel with the chest window; planes, not a gradient
        torso = m['torso']
        tc = np.full(shape, I('S2'), np.int16)
        near_side = torso & (xx < np.interp(yy, [L['pit_neck'][1], L['crotch'][1]],
                                            [L['shoulder_near'][0] + 4, L['pelvis_edge_near'][0] + 3]))
        tc[near_side] = I('S3')                                           # the side plane, away from the light
        add('torso', torso, 'skin', tc)
        pc = L['pit_neck']
        # bodice: from the collar to the crotch; its near edge leaves the open side (a skin strip)
        bod = A.poly_mask([c((pc[0] - 6, pc[1] + 1)), c((pc[0] + 7, pc[1] + 1)),
                           c((L['shoulder_far'][0] - 3, L['shoulder_far'][1] + 8)),
                           c((L['waist_c'][0] + s['waist']['far_w'], L['waist_c'][1])),
                           c(L['pelvis_edge_far']), c((L['crotch'][0] + 4, L['crotch'][1])),
                           c((L['crotch'][0] - 4, L['crotch'][1])),
                           c((L['pelvis_edge_near'][0] + 4, L['pelvis_edge_near'][1])),
                           c((L['waist_c'][0] - s['waist']['near_w'] + 3, L['waist_c'][1])),
                           c((L['rib_c'][0] - s['ribcage']['near_w'] + 3, L['rib_c'][1] + 2)),
                           c((pc[0] - 9, pc[1] + 8))], shape) & torso
        cl_x = lambda y_: np.interp(y_, [pc[1], L['crotch'][1]], [pc[0] + 1, L['crotch'][0] + 1])  # noqa: E731
        bc = np.full(shape, I('W2'), np.int16)
        plane = bod & (xx < cl_x(yy) - 5)
        bc[plane] = I('W3')                                               # near side plane of the bodice
        bust = bod & (yy > pc[1] + 9) & (yy < pc[1] + 13) & (xx < cl_x(yy) + 5)
        bc[bust] = I('W3')                                                # cast shadow under the bust
        bc[bod & (yy > pc[1] + 2) & (yy < pc[1] + 9) & (xx > cl_x(yy) + 1) & (xx < cl_x(yy) + 6)] = I('W1')
        # chest window: a diamond on the centre line, gold framed (DESIGN 3 row 2: 3x9 at 96 -> 5x13)
        wy0, wy1 = pc[1] + 7, pc[1] + 20
        wcx = cl_x((wy0 + wy1) / 2)
        diamond = A.poly_mask([(wcx + .5, wy0), (wcx + 3.2, (wy0 + wy1) / 2), (wcx + .5, wy1), (wcx - 2.2, (wy0 + wy1) / 2)],
                              shape)
        bc[diamond] = I('S2')
        bc[A.ring_out(diamond) & bod] = I('G2')
        add('torso', bod, 'white', bc)
        # hip band following the tilted pelvis (gold, 2 px), medallion rose on the centre line
        hb_line = A.capsule_mask(c((L['pelvis_edge_near'][0] + 1, L['pelvis_edge_near'][1] - 3)),
                                 c((L['pelvis_edge_far'][0] - 1, L['pelvis_edge_far'][1] - 3)), 1.0, 1.0, shape) & (torso | bod)
        hbc = np.full(shape, I('G2'), np.int16)
        hbc[hb_line & ~A.shift(hb_line, 0, 1)] = I('G1')
        add('pelvis', hb_line, 'gold', hbc)
        # --- tabard: hangs from the tilted hip band, off-centre toward the low hip, V-notch hem
        band_mid = ((L['pelvis_edge_near'][0] + L['pelvis_edge_far'][0]) / 2 + 1,
                    (L['pelvis_edge_near'][1] + L['pelvis_edge_far'][1]) / 2 - 2)
        t = math.radians(s['pelvis']['tilt_deg'])
        half = 7.0
        tl = (band_mid[0] - half * math.cos(t), band_mid[1] + half * math.sin(t))
        tr = (band_mid[0] + half * math.cos(t), band_mid[1] - half * math.sin(t))
        hem_y = self.S - 32
        sway = -3                                    # the hem swings off the free knee toward the low hip
        tab = A.poly_mask([c(tl), c(tr), c((tr[0] + 1 + sway, hem_y)), c((band_mid[0] + sway, hem_y + 4)),
                           c((tl[0] - 1 + sway, hem_y))], shape)
        tcod = np.full(shape, I('W2'), np.int16)
        tcod[tab & ~A.shift(tab, -1, 0)] = I('G2')
        tcod[tab & ~A.shift(tab, 1, 0)] = I('G3')
        tcod[tab & ~A.shift(tab, 0, -1) & (yy > hem_y - 2)] = I('G3')
        # one pipe fold from the tension point at the hip band (W3 shape with a sharp top edge)
        fold = A.poly_mask([c((band_mid[0] - 2, band_mid[1] + 6)), c((band_mid[0] - 1, band_mid[1] + 6)),
                            c((band_mid[0] - 2 + sway, hem_y - 2)), c((band_mid[0] - 4 + sway, hem_y - 3))], shape) & tab
        tcod[fold & ~A.ring_in(tab)] = I('W3')
        lit_strip = tab & (xx >= tr[0] - 3 + (yy - tr[1]) * sway / max(1, hem_y - tr[1])) & ~A.ring_in(tab) & (yy < hem_y - 6)
        tcod[lit_strip] = I('W1')
        # fleur-cross 5x7 near the hem (DESIGN 3 row 6)
        fx, fy = int(round(band_mid[0] + sway)), int(hem_y - 12)
        for dx, dy in ((0, -3), (0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (0, 3), (-1, -1), (-2, -1), (1, -1), (2, -1),
                       (-1, -2), (1, -2)):
            if tab[fy + dy, fx + dx]:
                tcod[fy + dy, fx + dx] = I('G2') if dx >= 0 else I('G3')
        add('tabard', tab, 'white', tcod)
        # --- collar (high stand collar) and the 5x5 cross on a dark backing (CL-P05)
        col = A.poly_mask([c((pc[0] - 5, pc[1] + 1)), c((pc[0] - 4, L['chin'][1] + 2)), c((pc[0] + 5, L['chin'][1] + 1)),
                           c((pc[0] + 6, pc[1] + 1))], shape)
        cc = np.full(shape, I('W2'), np.int16)
        cc[col & (xx > pc[0] + 2)] = I('W1')
        cc[col & ~A.shift(col, 0, -1)] = I('G2')
        cc[col & ~A.shift(col, 1, 0)] = I('W3')
        add('collar', col, 'white', cc)
        crx, cry = int(round(pc[0] + 1)), int(round(pc[1] - 3))
        cross = np.zeros(shape, bool)
        back = np.zeros(shape, bool)
        crc = np.full(shape, I('I3'), np.int16)
        pts = [(0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (-2, 0), (-1, 0), (1, 0), (2, 0)]
        for dx, dy in pts:
            cross[cry + dy, crx + dx] = True
            crc[cry + dy, crx + dx] = I('G1') if (dx > 0 or dy < 0) else I('G3')
        crc[cry, crx] = I('G1')
        back = A.dilate(cross, 1)                     # a 1 px dark backing hugging the cross (gold on white is 1.13:1)
        add('cross', back, 'gold', crc)
        self.cross_px = (crx, cry)
        # --- near arm: upper arm (skin), armband, forearm under the sleeve
        for side in ('near',):
            ua = m[f'upper_arm_{side}']
            add(f'arm_{side}', ua, 'skin', cyl(ua, L[f'shoulder_{side}'], L[f'elbow_{side}'], 'skin', 3, 2.4))
        # --- head (from face_construct): chin point on the chin landmark
        face_params = merged({'expression': s['expression'], 'gaze_target': s['gaze_target']}, s.get('face', {}))
        face = FC.Face(face_params)
        face.construct()
        face.block_cv = face.blockin()
        fcv = face.final()
        self.face = face
        ox = int(round(L['chin'][0] - (face.c0 + face.p['chin_dx'])))
        oy = int(round(L['chin'][1] - FC.CHIN_Y))
        self.face_origin = (ox, oy)
        # the head axis is the constructed face's centre line (brow row -> chin point), on the sprite
        cl = face.lm['centre_line']
        by = FC.CHIN_Y - face.rows['brow']
        top = min(cl, key=lambda q_: abs(q_[1] - by))
        L['head_axis'] = [(top[0] + ox, top[1] + oy), (face.c0 + face.p['chin_dx'] + ox, FC.CHIN_Y + oy)]
        L['skull_top'] = (face.xb + ox, FC.CHIN_Y - face.rows['skull_top'] + oy)
        self.hem_y = self.S - 32
        keep = (fcv.part > 0) & (fcv.part != A.PART['neck'])
        # neck before the head
        neck = m['neck']
        nc = np.full(shape, I('S2'), np.int16)
        nc[neck & (yy <= L['chin'][1] + 3)] = I('S4')                       # under-chin cast shadow
        add('neck', neck & ~col, 'skin', nc)
        head_layer = (ox, oy, fcv, keep)
        # --- far forearm, sleeve and hand (in front of the chest)
        # --- sleeves: trumpet bells hanging from the forearm, lining shows at the mouth
        sleeves = {}
        for side in ('near', 'far'):
            el, wr = L[f'elbow_{side}'], L[f'wrist_{side}']
            d = np.subtract(wr, el)
            dl = np.linalg.norm(d) or 1
            u = d / dl
            n = np.array([-u[1], u[0]])
            if n[1] < 0:
                n = -n                                                     # n points down (gravity side)
            a0 = np.add(el, u * 4)
            mouth = np.add(wr, u * 2)
            drop = 13
            bell = [a0 - n * 2.5, mouth - n * 3.5, mouth + n * (drop - 1) + u * 1,
                    mouth + n * drop - u * 4, a0 + n * 3.0]
            bm = A.poly_mask([c(p) for p in bell], shape)
            bcod = np.full(shape, I('W2'), np.int16)
            # the upper half toward the light is lit, the underside in shadow (one terminator)
            sacross, tt, _ = A.across(c(a0), c(mouth), shape)
            sg = 1 if n[1] > 0 else -1
            under = (sacross * (1 if (np.array([-u[1], u[0]]) @ n) > 0 else -1)) > 4.5
            bcod[bm & under] = I('W3')
            bcod[bm & ~under & ((sacross * (1 if (np.array([-u[1], u[0]]) @ n) > 0 else -1)) < -0.5)] = I('W1')
            # the mouth rim: gold hem and the indigo lining showing inside
            mouth_line = A.capsule_mask(c(mouth - n * 3.5), c(mouth + n * (drop - 1) + u), 0.8, 0.8, shape) & bm
            lining = A.capsule_mask(c(mouth - n * 2 - u * 1.5), c(mouth + n * (drop - 3) - u * 1.5), 1.3, 1.3, shape) & bm
            bcod[lining] = I('I3')
            bcod[mouth_line] = I('G2')
            sleeves[side] = (bm, bcod)
        near_fore = m['forearm_near']
        far_fore = m['forearm_far']
        # --- hands, constructed: palm box + finger mitten + thumb wedge + wrist step (HD-P01)
        hands = {}
        for side in ('near', 'far'):
            hc, wr = L[f'hand_{side}'], L[f'wrist_{side}']
            if side == 'near':
                ax = np.array(self.gdir)                                     # the fist wraps the haft
                fist_len, fist_w = 1.0, 2.5
            else:
                ax = np.subtract(hc, wr)
                ax = ax / (np.linalg.norm(ax) or 1)
                fist_len, fist_w = 3.4, 2.9
            palm = A.capsule_mask(c(np.subtract(hc, ax * fist_len / 2)), c(np.add(hc, ax * fist_len / 2)), fist_w, fist_w, shape)
            fore_dir = np.subtract(hc, wr)
            fore_dir = fore_dir / (np.linalg.norm(fore_dir) or 1)
            wrist_step = A.capsule_mask(c(wr), c(np.add(wr, fore_dir * 1.5)), 1.8, 1.8, shape)
            hand = palm | wrist_step
            hcod = np.full(shape, I('S2'), np.int16)
            # shadow on the side away from the light (the palm side), knuckle row line
            sac, tt, _ = A.across(c(np.subtract(hc, ax * 4)), c(np.add(hc, ax * 4)), shape)
            sgn = A.lit_side_sign(np.subtract(hc, ax * 4), np.add(hc, ax * 4), self.light)
            hcod[hand & (sac * sgn < -1.2)] = I('S3')
            if side == 'near':
                # knuckle row: a curved S3 line across the fist on the side the fingers wrap to
                kn = np.add(hc, -fore_dir * 0.5)
                kl = A.capsule_mask(c(np.subtract(kn, ax * 3)), c(np.add(kn, ax * 3)), 0.55, 0.55, shape) & palm
                hcod[kl] = I('S3')
                # thumb wedge crossing the haft on the near side (toward the viewer: over the haft, below the knuckles)
                # the wedge crosses the haft on the near side, inside the fist's outline
                nrm = np.array([-ax[1], ax[0]])
                if nrm @ fore_dir > 0:
                    nrm = -nrm
                th0 = np.add(hc, ax * 1.2)
                thumb = A.poly_mask([c(np.add(th0, -nrm * 1.8)), c(np.add(th0, nrm * 1.6)),
                                     c(np.add(th0, ax * 2.2 + nrm * 0.2)), c(np.add(th0, ax * 1.6 - nrm * 1.2))], shape) & A.erode(palm | wrist_step, 1)
                hcod[thumb] = I('S1')
                hand |= thumb
                self.thumb = thumb
            else:
                # relaxed mitten: fingers as one mass, one separated index finger, thumb up
                tipc = np.add(hc, ax * 3.4)
                finger = A.capsule_mask(c(np.add(hc, ax * 1.0)), c(tipc), 1.2, 0.9, shape)
                hand |= finger
                hcod[finger] = I('S2')
                th = A.poly_mask([c(np.add(hc, -ax * 0.5 + np.array([0, -2.8]))), c(np.add(hc, ax * 2.2 + np.array([0, -3.4]))),
                                  c(np.add(hc, ax * 1.4 + np.array([0, -1.2])))], shape)
                hcod[th] = I('S1')
                hand |= th
            hands[side] = (hand, hcod)
        # --- glaive: butt spike, haft with gold grip bands, rose disc, cross arms, lancet blade, stole
        gl = s['glaive']
        B = np.array(L['haft_butt'], float)
        u = np.array(self.gdir)
        n = np.array([-u[1], u[0]])                                        # to the right of up-the-haft
        q = lambda a_, o=0.0: B + u * a_ + n * o  # noqa: E731
        haft = A.capsule_mask(c(q(6)), c(q(150)), 1.45, 1.45, shape)
        hcod = np.full(shape, I('I3'), np.int16)
        sa_, ta_, _ = A.across(c(q(6)), c(q(150)), shape)
        seg = np.cumsum([0] + [5, 2, 7, 3, 4, 2, 6, 3] * 8)
        along = ta_ * 144.0
        k_ = np.searchsorted(seg, along) % 2 == 1
        hcod[haft & k_] = I('I2')
        glint = haft & (sa_ * A.lit_side_sign(tuple(q(6)), tuple(q(150)), lt) > 0.2) & \
            (np.sin(ta_ * 23.0) > 0.55) & (ta_ > 0.35) & (ta_ < 0.9)
        hcod[glint] = I('I1')
        for g0 in (gl['grip_along'] - 7, gl['grip_along'] + 6, 60, 128):
            band = A.capsule_mask(c(q(g0)), c(q(g0 + 1.2)), 1.6, 1.6, shape) & haft
            hcod[band] = I('G2')
        butt = A.capsule_mask(c(q(0.5)), c(q(6)), 1.2, 2.2, shape)
        bcode = np.full(shape, I('G2'), np.int16)
        bcode[butt & (A.across(c(q(0)), c(q(6)), shape)[0] < 0)] = I('G3')
        disc_c = q(155)
        disc = A.ellipse_mask(c(disc_c), 6.2, 6.2, shape)
        dcod = np.full(shape, I('G2'), np.int16)
        inner = A.ellipse_mask(c(disc_c), 4.4, 4.4, shape)
        ang = (np.degrees(np.arctan2(yy + .5 - (disc_c[1] + .5), xx + .5 - (disc_c[0] + .5))) + 360) % 360
        dcod[inner] = np.where(((ang // 45) % 2 == 0)[inner], I('A2'), I('A3'))
        dcod[A.ellipse_mask(c(disc_c), 1.2, 1.2, shape)] = I('A5')
        dcod[inner & ~A.erode(inner)] = I('I4')                      # the leading between glass and gold
        dcod[disc & ~inner & (xx < disc_c[0])] = I('G3')
        arms = A.capsule_mask(c(q(155, -12.5)), c(q(155, 12.5)), 1.1, 1.1, shape)
        for sgn in (-1, 1):
            arms |= A.ellipse_mask(c(q(155, sgn * 12.5)), 1.8, 1.8, shape)
        acod = np.full(shape, I('G1'), np.int16)
        acod[arms & (yy > A.across(c(q(155, -12.5)), c(q(155, 12.5)), shape)[0] * 0 + disc_c[1] + 1)] = I('G3')
        blade = A.poly_mask([c(q(160, -1.5)), c(q(194, -1.0)), c(q(186, 2.5)), c(q(172, 5.0)), c(q(162, 4.0))], shape)
        blcod = np.full(shape, I('T3'), np.int16)
        sb, tb, _ = A.across(c(q(160)), c(q(194)), shape)
        blcod[blade & (sb > 1.5)] = I('T2')
        blcod[blade & (sb < -0.2)] = I('T4')
        rim = blade & ~A.shift(blade, -1, 0)
        edge = blade & A.shift(rim, -1, 0) & ~rim & (sb > 0.5)
        blcod[edge] = I('A5')
        fuller = A.capsule_mask(c(q(163, 0.8)), c(q(181, 0.8)), 0.5, 0.5, shape) & blade
        blcod[fuller] = I('G2')
        for a_ in (166, 171, 176):
            p_ = np.round(q(a_, 0.8)).astype(int)
            if blade[p_[1], p_[0]]:
                blcod[p_[1], p_[0]] = I('A3')
        # stole: two tails from under the disc, white front, beige back, hanging with gravity
        stole = np.zeros(shape, bool)
        top = q(146, -2)
        for k, (dx, ln) in enumerate(((-3, 34), (1, 28))):
            p0 = np.add(top, (dx * 0.5, 0))
            p1 = np.add(top, (dx - 4, ln))
            stole |= A.capsule_mask(c(p0), c(p1), 1.6, 1.9, shape)
        scod = np.full(shape, I('W2'), np.int16)
        scod[stole & (xx < top[0] - 2)] = I('B1')
        scod[stole & ~A.shift(stole, -1, 0)] = I('W1')
        # --- composite, back to front
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

        for part, mask, mat, codes in layers:
            if part in ('arm_near',):
                continue
            put(part, mask, mat, codes)
        # far forearm + sleeve + hand in front of the chest but behind the collar cross? -> the hand frames
        put('arm_far', far_fore, 'skin', cyl(far_fore, L['elbow_far'], L['wrist_far'], 'skin', 2.4, 1.9))
        put('sleeve_far', sleeves['far'][0], 'white', sleeves['far'][1])
        put('hand_far', hands['far'][0], 'skin', hands['far'][1])
        for part, mask, mat, codes in layers:
            if part == 'collar' or part == 'cross':
                put(part, mask, mat, codes)
                if part == 'cross':
                    cv.mat[mask & (codes == I('I3'))] = A.MAT['indigo']
        # head
        ox, oy, fcv, keep = head_layer
        zi[0] += 1
        ys_, xs_ = np.nonzero(keep)
        ty, tx = ys_ + oy, xs_ + ox
        ok = (ty >= 0) & (ty < H) & (tx >= 0) & (tx < W)
        ys_, xs_, ty, tx = ys_[ok], xs_[ok], ty[ok], tx[ok]
        cv.code[ty, tx] = fcv.code[ys_, xs_]
        cv.mat[ty, tx] = fcv.mat[ys_, xs_]
        cv.part[ty, tx] = fcv.part[ys_, xs_]
        z[ty, tx] = zi[0]
        # facial inner OL pixels (lashes, brows) came with the eye part; the head's own outline is redone below
        # near arm, sleeve, glaive, fist
        for part, mask, mat, codes in layers:
            if part == 'arm_near':
                put(part, mask, mat, codes)
        put('arm_near', near_fore, 'skin', cyl(near_fore, L['elbow_near'], L['wrist_near'], 'skin', 2.4, 1.9))
        put('sleeve_near', sleeves['near'][0], 'white', sleeves['near'][1])
        put('weapon', stole, 'white', scod)
        cv.mat[stole & (scod == I('B1'))] = A.MAT['beige']
        put('weapon', haft, 'haft', hcod)
        put('weapon', butt, 'gold', bcode)
        put('weapon', arms, 'gold', acod)
        put('weapon', disc, 'gold', dcod)
        cv.mat[inner] = A.MAT['glass']
        put('weapon', blade, 'steel', blcod)
        put('hand_near', hands['near'][0], 'skin', hands['near'][1])
        self.z = z
        # --- lines: OL on the silhouette edge (inside the shape); inner lines where a part lies over a
        # different part behind it and the two tones are too close to separate (< 3:1), in the front
        # part's deep tone (PX-P20: interior lines lighter than the silhouette; CL-P03 contact lines)
        fig = cv.code > 0
        sil = A.ring_in(fig)
        inner = np.zeros(shape, bool)
        inner_code = np.zeros(shape, np.int16)
        codes_ = cv.code.copy()
        lum = np.zeros(len(pal.codes) + 1)
        for k, i in pal.index.items():
            lum[i] = pal.lum(k)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nz = A.shift(z, dx, dy)
            ncode = A.shift(codes_, dx, dy)
            npart = A.shift(cv.part, dx, dy)
            behind = fig & (nz > 0) & (nz < z) & (npart != cv.part)
            for s_ in ('near', 'far'):
                same = np.isin(cv.part, [A.PART[f'leg_{s_}'], A.PART[f'boot_{s_}']]) & \
                    np.isin(npart, [A.PART[f'leg_{s_}'], A.PART[f'boot_{s_}']])
                behind &= ~same
            la, lb = lum[np.clip(codes_, 0, None)], lum[np.clip(ncode, 0, None)]
            ctr = (np.maximum(la, lb) + 0.05) / (np.minimum(la, lb) + 0.05)
            need = behind & (ctr < 3.0)
            inner |= need
        skip_line = np.isin(cv.part, [A.PART['face'], A.PART['eye'], A.PART['cross'], A.PART['hair_front']]) | \
            (cv.mat == A.MAT['gold'])
        inner &= ~skip_line & ~sil
        for mat_name, mid in A.MAT.items():
            sel = inner & (cv.mat == mid)
            if sel.any() and mat_name in INNER:
                cv.code[sel] = I(INNER[mat_name])
        # pixel-perfect silhouette (PX-P21, MortMort / Ricky Han): an L-corner of the line whose
        # outer diagonal is background is a double; it keeps its fill colour instead of the line
        before = cv.code.copy()
        dbl = np.zeros(shape, bool)
        for (dx1, dy1), (dx2, dy2) in (((1, 0), (0, 1)), ((1, 0), (0, -1)), ((-1, 0), (0, 1)), ((-1, 0), (0, -1))):
            a1 = A.shift(sil, -dx1, -dy1)          # neighbour at (x+dx1, y+dy1) is on the line
            a2 = A.shift(sil, -dx2, -dy2)
            diag_out = ~A.shift(fig, -(dx1 + dx2), -(dy1 + dy2))
            dbl |= sil & a1 & a2 & diag_out & A.shift(fig, dx1, dy1) & A.shift(fig, dx2, dy2)
        line = sil & ~dbl
        cv.code[line] = I('OL')
        cv.code[dbl] = before[dbl]
        cv.mat[line & (cv.mat == 0)] = A.MAT['line']
        self.doubles_removed = int(dbl.sum())
        # contact lines between light materials that would merge (PX-P08, PX-N05, CL-P03): the pixel in
        # front takes its material's deep tone; a 1 px gold trim steps down to G3 instead of taking a line
        # the stocking's top band is a gold trim
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
            # the back pixel takes the line where the front one is the face
            fixed |= cand & (z < nzv) & A.shift(facey, dx, dy)
        for mat_name in ('white', 'skin', 'veil', 'beige'):
            sel = fixed & (cv.mat == A.MAT[mat_name]) & ~np.isin(cv.part, [A.PART['face'], A.PART['eye']])
            cv.code[sel] = I(INNER[mat_name])
        cv.code[fixed & (cv.mat == A.MAT['gold'])] = I('G3')
        self.cv = cv
        self.masks = dict(sleeves=sleeves, hands=hands, haft=haft, blade=blade, disc=disc, stole=stole,
                          tabard=tab, collar=col, cross=cross, cross_back=back)
        self.log.append('dressed, shaded (one key light from the upper front, the facing side) and outlined')
        return cv

    # ------------------------------------------------------------ pose.json (the wireframe record)
    def pose_json(self, name):
        L, s = self.L, self.s
        r = lambda p: [round(float(p[0]), 2), round(float(p[1]), 2)]  # noqa: E731
        lm = {k: r(v) for k, v in L.items() if isinstance(v, tuple)}
        lm['loa'] = [r(p) for p in L['loa']]
        lm['loa_curve'] = [r(p) for p in self.loa_curve[::4]] + [r(self.loa_curve[-1])]
        lm['head_axis'] = [r(p) for p in L['head_axis']]
        lm['neck_axis'] = [r(p) for p in L['neck_axis']]
        lm['torso_centerline'] = [r(p) for p in L['torso_centerline']]
        cv = self.cv
        figm = cv.code > 0
        # foot boxes from the pixels of each boot
        feet = {}
        for side in ('near', 'far'):
            ys, xs = np.nonzero((cv.part == A.PART[f'boot_{side}']) & (np.arange(cv.h)[:, None] >= self.S - 3))
            feet[side] = [int(xs.min()), int(xs.max())] if len(xs) else None
        zones = self.zones()
        pose = {
            '_doc': 'Construct wireframe for rules_check.py (schema: docs/character/art-rules/checklist.json inputs). '
                    'Canvas pixel coordinates, x right, y down; sole_y is the floor row.',
            'name': name, 'H': s['H'], 'canvas': s['canvas'], 'sole_y': self.S, 'cx': self.cx,
            'intent': s['intent'], 'move': s['move'], 'carry': s['carry'], 'facing': s.get('facing', 'right'),
            'weight_foot': s['weight_foot'], 'expression': s['expression'], 'gaze_target': s['gaze_target'],
            'landmarks': lm, 'feet': feet,
            'haft': {'butt': r(L['haft_butt']), 'tip': r(L['haft_tip'])},
            'grips': [{'hand': 'near', 'point': r(L['grip_near']), 'kind': 'rest'}],
            'hands': {
                'near': {'kind': 'fist', 'on': 'haft', 'palm_box': True, 'mitten': True, 'thumb_wedge': True,
                         'wrist_step': True, 'knuckle_side': 'out', 'centre': r(L['hand_near'])},
                'far': {'kind': 'open_relaxed', 'on': 'collar', 'palm_box': True, 'mitten': True, 'thumb_wedge': True,
                        'wrist_step': True, 'knuckle_side': 'up', 'centre': r(L['hand_far'])},
            },
            'face': {'origin': list(self.face_origin), 'params': {k: self.face.p[k] for k in
                                                                  ('yaw', 'expression', 'gaze', 'roll', 'pitch', 'gaze_target')}},
            'light': [round(float(v), 3) for v in self.light],
            'zones': zones,
            'cross_centre': list(self.cross_px),
        }
        return pose

    def zones(self):
        L = self.L
        pc = L['pit_neck']
        cl = [(pc[0] + 1 - 3, pc[1]), (pc[0] + 1 + 3, pc[1]), (L['crotch'][0] + 1 + 3, L['crotch'][1]),
              (L['crotch'][0] + 1 - 3, L['crotch'][1])]
        cx_, cy_ = self.cross_px
        fo = self.face_origin
        e = self.face.lm.get('eyes', {})
        eg = None
        if 'near' in e and 'far' in e:
            nb, fb = e['near']['box'], e['far']['box']
            eg = [(nb[2] + 1 + fo[0], nb[1] + fo[1]), (fb[0] - 1 + fo[0], nb[1] + fo[1]),
                  (fb[0] - 1 + fo[0], nb[3] + fo[1]), (nb[2] + 1 + fo[0], nb[3] + fo[1])]
        g = L['grip_near']
        def calf_x(side, y):
            k, a_ = L[f'knee_{side}'], L[f'ankle_{side}']
            return k[0] + (a_[0] - k[0]) * (y - k[1]) / ((a_[1] - k[1]) or 1)
        y0, y1 = self.hem_y + 5, self.hem_y + 12
        between = [(calf_x('near', y0), y0), (calf_x('far', y0), y0), (calf_x('far', y1), y1), (calf_x('near', y1), y1)]
        rr = lambda pts: [[round(float(x), 1), round(float(y), 1)] for x, y in pts]  # noqa: E731
        return {
            'keep_out': [
                {'name': 'torso centre band', 'kind': 'weapon', 'rule': 'GR-N03', 'poly': rr(cl)},
            ] + ([{'name': 'between the eyes below the lash top', 'kind': 'hair', 'rule': 'FC-N17', 'poly': rr(eg)}] if eg else []),
            'must_be': [
                {'name': 'collar_cross', 'expect': 'gold_cross', 'rule': 'CL-P05',
                 'poly': rr([(cx_ - 3, cy_ - 3), (cx_ + 4, cy_ - 3), (cx_ + 4, cy_ + 4), (cx_ - 3, cy_ + 4)])},
                {'name': 'fist at the grip', 'expect': 'hand_near', 'rule': 'GR-N01',
                 'poly': rr([(g[0] - 2, g[1] - 2), (g[0] + 3, g[1] - 2), (g[0] + 3, g[1] + 3), (g[0] - 2, g[1] + 3)])},
                {'name': 'dark between the legs', 'expect': 'dark', 'rule': 'CL-P04', 'poly': rr(between)},
            ],
        }


# ---------------------------------------------------------------- reference layer and sheet

def load_ref(ref_dir, fig):
    """the 3D render at the same H, aligned on the anchor (sole, body centre); reference only"""
    ref_dir = Path(ref_dir)
    for fn in ('noface.png', 'still.png', 'sprite.png'):
        if (ref_dir / fn).exists():
            im = Image.open(ref_dir / fn).convert('RGBA')
            break
    else:
        return None, None
    meta = json.loads((ref_dir / 'meta.json').read_text(encoding='utf-8'))
    ax, ay = meta['anchor']
    canvas = Image.new('RGBA', (fig.W, fig.H), (0, 0, 0, 0))
    canvas.alpha_composite(im, (0, 0)) if False else None
    off = (int(fig.cx - ax), int(fig.S - ay))
    base = Image.new('RGBA', (fig.W, fig.H), (0, 0, 0, 0))
    base.paste(im, off, im)
    info = {'dir': str(ref_dir), 'anchor': [ax, ay], 'offset': list(off), 'pose': meta.get('pose'),
            'yaw': meta.get('yaw')}
    a = meta.get('anchors', {})
    ss = meta.get('ss', 4)
    if 'glaive_tip' in a and 'glaive_butt' in a:
        (tx, ty), (bx, by) = a['glaive_tip'][:2], a['glaive_butt'][:2]
        info['glaive_angle_from_vertical'] = round(math.degrees(math.atan2(abs(tx - bx), abs(by - ty))), 1)
    for k in ('knee_L', 'knee_R', 'hand_L', 'hand_R', 'head'):
        if k in a:
            info[k] = [round(a[k][0] / ss + off[0], 1), round(a[k][1] / ss + off[1], 1)]
    return base, info


def construct_sheet(fig, name, ref_img=None, check=None):
    pal = fig.pal
    Z = 3
    bg = (104, 102, 98)
    blank = Image.new('RGB', (fig.W, fig.H), bg)
    final = A.on_bg(fig.cv.image(pal), bg)
    g = fig.g
    # 1 gesture over the faint 3D reference
    base = blank.copy()
    if ref_img is not None:
        base = Image.blend(blank, A.on_bg(ref_img, bg), 0.4)
    p1 = g.draw(A.zoom(base, Z), Z, layers=('gesture',))
    # 2 mannequin
    p2 = g.draw(A.zoom(blank, Z), Z, layers=('mannequin', 'gesture'))
    # 3 silhouette with negative space and zones
    sil = np.asarray(blank).copy()
    figm = fig.cv.code > 0
    sil[figm] = (30, 26, 44)
    weapon = fig.cv.part == A.PART['weapon']
    sil[weapon] = (70, 66, 90)
    if check is not None:
        for comp in check.get('gaps_px', []):
            for x, y in comp:
                sil[y, x] = (255, 170, 60)
    p3 = Image.fromarray(sil)
    zg = A.Guides()
    pose = fig.pose_json(name)
    for zz in pose['zones']['keep_out']:
        zg.poly([(x + .5, y + .5) for x, y in zz['poly']], (255, 80, 80), 2, closed=True)
    for zz in pose['zones']['must_be']:
        zg.poly([(x + .5, y + .5) for x, y in zz['poly']], (80, 255, 120), 2, closed=True)
    p3 = zg.draw(A.zoom(p3, Z), Z)
    # 4 block-in: every part in its material's lit tone, lines on
    blk = fig.cv.code.copy()
    for mat, ramp in RAMP.items():
        sel = (fig.cv.mat == A.MAT.get(mat, -1)) & (blk != pal.i('OL'))
        blk[sel] = pal.i(ramp[2])
    bimg = A.on_bg(Image.fromarray(pal.to_rgba(np.clip(blk, 0, None)), 'RGBA'), bg)
    p4 = A.zoom(bimg, Z)
    # 5 shading guide: light direction and the shadow shapes marked
    sh = np.asarray(bimg).copy()
    shadow_codes = [pal.i(c) for c in ('S3', 'S4', 'W3', 'W4', 'I3', 'I4', 'G3', 'G4', 'T4')]
    sm = np.isin(fig.cv.code, shadow_codes)
    sh[sm] = (sh[sm] * 0.55).astype(np.uint8)
    lg = A.Guides()
    lx, ly = fig.W - 22, 14
    lg.line((lx, ly), (lx - fig.light[0] * 12, ly - fig.light[1] * 12), (255, 255, 120), 3)
    lg.dot((lx, ly), (255, 255, 120), 5)
    lg.text((lx - 20, ly + 3), 'key light', (255, 255, 120))
    p5 = lg.draw(A.zoom(Image.fromarray(sh), Z), Z)
    p6 = A.zoom(final, Z)
    rows = [A.row_sheet([('1 gesture on the 3D reference layer', p1), ('2 mannequin', p2),
                         ('3 silhouette, gaps (orange), zones', p3)], title=f'{name}  |  construction x{Z}  |  ' + '; '.join(fig.log[:1])),
            A.row_sheet([('4 block-in', p4), ('5 shadow shapes + key light', p5), ('6 final', p6)])]
    small = [('1x', final), ('grey 1x', A.greyscale(final)), ('2x', A.zoom(final, 2)),
             ('silhouette 2x', A.zoom(Image.fromarray(np.where(figm[..., None], np.uint8(20), np.asarray(blank))), 2)),
             ('flip 2x', A.zoom(final.transpose(Image.FLIP_LEFT_RIGHT), 2)),
             ('blur 2x', A.blur(A.zoom(final, 2), 3))]
    rows.append(A.row_sheet(small, title='read at game size; greyscale, silhouette, flip, blur (WF-P07, WF-P08)'))
    return A.stack(rows)


def build(spec_path, name=None, ref=None, overrides=None, do_sheet=False, out=OUT):
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    spec = merged(spec, overrides or {})
    name = name or spec['name']
    fig = Figure(spec)
    fig.gesture()
    fig.mannequin()
    fig.build()
    od = Path(out) / name
    od.mkdir(parents=True, exist_ok=True)
    fig.cv.save(fig.pal, od / 'sprite.png')
    fig.cv.save_layers(str(od / 'sprite'))
    pose = fig.pose_json(name)
    ref_img, ref_info = (None, None)
    if ref:
        ref_img, ref_info = load_ref(ref, fig)
        pose['reference'] = ref_info
    A.jdump(pose, od / 'pose.json')
    frec = fig.face.record(f'{name}_face')
    frec['origin_on_sprite'] = list(fig.face_origin)
    A.jdump(frec, od / 'face.json')
    fig.face.final_cv.save_layers(str(od / 'face'))
    A.jdump({'name': name, 'spec': spec, 'log': fig.log, 'reference': ref_info,
             '_doc': 'the spec this sprite was built from and the construction log'}, od / 'construct.json')
    if do_sheet:
        SHEETS.mkdir(parents=True, exist_ok=True)
        check = None
        try:
            import rules_check as RC
            check = {'gaps_px': RC.arm_gaps(fig.cv.code > 0, fig.cv.part)[1]}
        except Exception as e:  # the sheet still builds without the checker
            print('gap overlay skipped:', e)
        construct_sheet(fig, name, ref_img, check).save(SHEETS / f'{name}_construct.png')
    return fig, pose


THUMB_RULES = ('FG-P13', 'FG-P14', 'FG-P11', 'FG-P08', 'FG-P09', 'GR-N02', 'FG-N04', 'FG-P10', 'GR-P10', 'GR-P05', 'GR-P09')


def thumbnails(spec_path, out=OUT, ref=None):
    """WF-P03: 4-6 gesture variants from the spec's 'thumbnails' list, each built, filled solid and scored
    on the silhouette rules; the best two are kept. Writes <out>/<name>/thumbs/<variant>.json (+ the
    variant's own build folder) and review/rosace/construct/figure/<name>_thumbs.png."""
    import rules_check as RC
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    name = spec['name']
    tdir = Path(out) / name / 'thumbs'
    tdir.mkdir(parents=True, exist_ok=True)
    results = []
    for tv in spec.get('thumbnails', []):
        vname = tv['name']
        fig, pose = build(spec_path, f'{name}__{vname}', None, tv.get('set', {}), False, tdir)
        ctx = RC.Ctx(tdir / f'{name}__{vname}')
        rows = RC.run(ctx, list(THUMB_RULES))
        passed = [r['id'] for r in rows if r['status'].startswith('PASS')]
        gaps, _ = RC.arm_gaps(ctx.mask, ctx.parts)
        area = sum(a for a, w, s in gaps if a >= 30 and w >= 3)
        results.append({'name': vname, 'idea': tv.get('idea', ''), 'set': tv.get('set', {}),
                        'score': len(passed), 'gap_area': area, 'passed': passed,
                        'failed': [f"{r['id']}: {r['measured']}" for r in rows if r['status'].startswith('FAIL')],
                        'fig': fig})
    ranked = sorted(results, key=lambda r: (-r['score'], -r['gap_area']))
    for i, r in enumerate(ranked):
        r['rank'] = i + 1
        r['kept'] = i < 2
        r['_doc'] = (f"thumbnail {r['name']} ({r['idea']}): {r['score']}/{len(THUMB_RULES)} silhouette rules pass, "
                     f"gap area {r['gap_area']} px2. " + ("KEPT: " if r['kept'] else "dropped: ") +
                     ('passes ' + ', '.join(r['passed']) if r['kept'] else 'fails ' + '; '.join(r['failed'][:3])))
        A.jdump({k: v for k, v in r.items() if k != 'fig'}, tdir / f"{r['name']}.json")
    # sheet: every thumbnail filled solid at 1x and 3x plus its colour build, ranked
    panels = []
    for r in ranked:
        cv = r['fig'].cv
        sil = np.full(cv.code.shape + (3,), 104, np.uint8)
        sil[cv.code > 0] = (24, 20, 36)
        sil[cv.part == A.PART['weapon']] = (70, 66, 90)
        tag = f"#{r['rank']} {r['name']} {r['score']}/{len(THUMB_RULES)}" + (' KEPT' if r['kept'] else '')
        panels.append((tag, A.zoom(Image.fromarray(sil), 2)))
    SHEETS.mkdir(parents=True, exist_ok=True)
    s = A.row_sheet(panels, title=f'{name} thumbnails (WF-P03): solid fill at 2x, scored on ' + ', '.join(THUMB_RULES))
    s.save(SHEETS / f'{name}_thumbs.png')
    return ranked


def parse_set(pairs):
    out = {}
    for p in pairs or []:
        k, v = p.split('=', 1)
        try:
            val = json.loads(v)
        except json.JSONDecodeError:
            val = v
        cur = out
        ks = k.split('.')
        for kk in ks[:-1]:
            cur = cur.setdefault(kk, {})
        cur[ks[-1]] = val
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('spec')
    ap.add_argument('--name')
    ap.add_argument('--ref', nargs='?', const=str(DEFAULT_REF), help='3D render dir (reference layer only)')
    ap.add_argument('--set', nargs='*')
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--out', default=str(OUT))
    ap.add_argument('--thumbs', action='store_true', help="build and score the spec's thumbnail variants (WF-P03)")
    a = ap.parse_args()
    if a.thumbs:
        for r in thumbnails(a.spec, a.out, a.ref):
            print(r['_doc'])
        return
    fig, pose = build(a.spec, a.name, a.ref, parse_set(a.set), a.sheet, a.out)
    print(pose['name'], 'ok;', '; '.join(fig.log))
    if pose.get('reference'):
        print('reference:', json.dumps(pose['reference']))


if __name__ == '__main__':
    main()
