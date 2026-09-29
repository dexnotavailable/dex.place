# Patch data for author_overrides.py (stills round 4). One entry per layer <pose>_<px>.
# Coordinates are sprite pixels of the r4 renders (stills.sh --round r4; pixel-identical to the
# fix:r3 renders). Kinds:
#   preface (drawn BEFORE the face stamp, see overrides.preface):
#     bangs    fringe profile: per-column last hair row, so the clumps end in pointed tips and
#              the lash row sits 1 px below them (face critic: "helmet bangs crush the face")
#     facewin  face-window mask: skin-coloured contour pixels the id pass gave to hair / gold /
#              veil become skin (adopt_skin), and veil / sleeve blocks on the jaw are replaced
#              (critic: "lavender veil block on the right jaw reads as a bruise")
#     contour  hand-painted jaw taper, chin point, near-cheek shading, profile nose / lips / chin
#   patches (after the face stamp):
#     hand     library stamps (art/rosace/hands) on every grip
#     hair     despeckle, crown seam, skull-following angel-ring arcs broken per clump, clump
#              separators one step darker than the shadow (I3), azure tips, sidelock clasp
#     form     painted form on skin (re-banded from the render normals; glute lobes, folds)
#     fold     crease lines on the white cloth
#     glint    blade and gold specular
STILL = {'idle_hero': 'idle_hero', 'n1_contact': 'n1_contact', 'q_stamp': 'q_stamp', 'n2_pivot': 'n2_pivot_black'}
RIM_HALF = {'level': 'half', 'family': 'cool', 'dir': [-0.62, -0.78], 'thr': 0.6,
            'note': 'world rim from upper back (lab rimDir); DESIGN.md s9 lit outline'}
RIM_FULL = dict(RIM_HALF, level='full', note='skill / attack frame: the glaive glow motivates the full level (DESIGN.md s9)')
FACE = {
    'idle_hero': {'facing': 'q34', 'expr': 'serene', 'note': 'q34 forced (yaw 17, judged as 3/4 by the critics); rounded open eyes, calm mouth'},
    'n1_contact': {'facing': 'q34', 'expr': 'resolute', 'dx': -1, 'note': 'yaw 41, head pitched into the thrust; the stamp sits 1 px left on the narrow face'},
    'q_stamp': {'facing': 'front', 'expr': 'radiant', 'dy': 1, 'note': 'skill: radiant ^^ with an open smile; eyes 1 px under the bang tips'},
    'n2_pivot': {'facing': 'profile', 'expr': 'serene', 'note': 'over-the-shoulder profile; the nose / lips / chin silhouette is the contour preface'},
}


def glint(cx, cy, arms=True):
    px = [[cx, cy, 'A5']]
    if arms:
        px += [[cx - 1, cy, 'A4'], [cx + 1, cy, 'A4'], [cx, cy - 1, 'A4'], [cx, cy + 1, 'A4']]
    return {'kind': 'glint', 'note': 'blade glint: A5 core with A4 arms (the one specular star on the weapon)', 'px': px}


def folds(lines, c='W4', on=('white',)):
    return {'kind': 'fold', 'on': list(on), 'note': 'crease lines at the fold roots (one step darker than the cloth shadow)',
            'lines': [{'pts': q, 'c': c} for q in lines]}


BANDS = [[-1, 'S4'], [0.12, 'S3'], [0.45, 'S2'], [0.86, 'S1']]


def shade(box, light):
    return {'kind': 'form', 'note': 'painted form on skin below the chin: one clean core-shadow band per limb, S4 occlusion edge, '
                                    'one S1 highlight (re-banded from the render normals with the key light of this still)',
            'shade': {'box': box, 'mat': 'skin', 'light': light, 'bands': BANDS}}


def hair(head_box, crown_box, ring_y, segments, seps, tips_box=None, depth=4):
    """despeckle, crown seam, angel ring arcs following the skull (overrides 'ring'), clump
    separators (I3) running into the bang notches, azure tips on the free strand ends"""
    out = [
        {'kind': 'hair', 'note': "despeckle the render's dark I4 islands (<= 2 px) in the hair mass",
         'despeckle': {'box': head_box, 'mat': 'hair', 'codes': ['I4'], 'max': 2}},
        {'kind': 'hair', 'note': "crown: soften the dark seam and drop the render's straight I0 bar (the ring is redrawn as arcs)",
         'box': crown_box, 'mat': 'hair', 'map': {'I4': 'I3', 'I0': 'I1'}},
        {'kind': 'hair', 'note': "head: the render's loose azure hairtip specks on the crown (critic: 'noise') become hair tones",
         'box': head_box, 'mat': 'hairtip', 'map': {'A2': 'I2', 'A3': 'I1', 'A4': 'I1', 'A5': 'I0'}},
        {'kind': 'hair', 'note': 'angel ring: short I0 arcs with I1 ends that follow the skull outline, broken at every clump',
         'ring': {'y': ring_y, 'segments': segments, 'depth': depth, 'c': 'I0', 'flank': 'I1'}},
        {'kind': 'hair', 'on': ['hair'], 'note': 'clump separators (I3, one step darker than the I2 shadow) from the ring into the bang notches',
         'lines': [{'pts': q, 'c': 'I3'} for q in seps]},
    ]
    if tips_box:
        out.append({'kind': 'hair', 'note': 'azure tips (DESIGN s6): the last 3 px of every free hair end, A2 -> A3 -> A4',
                    'tips': {'box': tips_box, 'ramp': ['A2', 'A3', 'A4']}})
    return out


LAYERS = {}
# ------------------------------------------------------------------ 144
LAYERS['idle_hero_144'] = dict(face=FACE['idle_hero'], rim=RIM_HALF, preface=[
    {'kind': 'facewin', 'note': 'adopt the anti-aliased skin-coloured contour pixels as skin', 'box': [41, 70, 57, 84], 'adopt_skin': True},
    {'kind': 'bangs', 'note': '3 clumps with pointed tips (x45, x50, x55); notches at x48 and x53; the lash row sits under the tips',
     'span': [69, 74], 'edge': [[42, 72], [43, 70], [44, 71], [45, 72], [46, 71], [47, 70], [48, 69], [49, 71], [50, 73], [51, 72],
                                [52, 70], [53, 69], [54, 71], [55, 72]]},
    {'kind': 'facewin', 'note': 'veil block on the far jaw becomes the side lock (I2)', 'box': [53, 78, 57, 83], 'from': ['veil'], 'to': 'I2', 'as': 'hair'},
    {'kind': 'contour', 'note': 'near jaw S3 line tapering to a 2 px chin point at x49-50 (1 px toward the facing side), S4 neck shadow under the '
     'jaw, 1 px far-jaw S3; the chin point replaces two collar pixels',
     'px': [[43, 79, 'S3'], [44, 80, 'S3'], [45, 81, 'S3'], [45, 82, 'S4'], [46, 82, 'S3'], [45, 83, 'S4'], [46, 83, 'S4'], [47, 83, 'S4'],
            [48, 83, 'S3'], [49, 83, 'S2'], [50, 83, 'S2'], [53, 80, 'S3']]},
], patches=[
    shade([0, 84, 76, 207], [0.55, 0.45, 0.7]),
    *hair([34, 55, 64, 86], [42, 58, 58, 63], [55, 69], [[41, 44], [46, 52], [54, 57]],
          [[[47, 64], [47, 67], [48, 69]], [[53, 64], [53, 66], [53, 69]]], [28, 90, 76, 160]),
    {'kind': 'hair', 'note': 'sidelock gold cross clasp (DESIGN s6), 2x2 at collarbone height on the near lock', 'on': ['hair'],
     'px': [[40, 88, 'G1'], [41, 88, 'G2'], [40, 89, 'G2'], [41, 89, 'G3']]},
    folds([[[49, 121], [48, 131]], [[47, 142], [47, 152]]], c='W3'),
    glint(12, 14),
    {'kind': 'hand', 'stamp': 'fist_v', 'at': [19, 99],
     'note': 'glaive hand: back of the hand to camera round the vertical haft, lit knuckles, thumb lobe under, wrist into the cuff'},
])
LAYERS['n1_contact_144'] = dict(face=FACE['n1_contact'], rim=RIM_FULL, preface=[
    {'kind': 'facewin', 'note': 'adopt the anti-aliased skin-coloured contour pixels as skin', 'box': [96, 21, 107, 31], 'adopt_skin': True},
    {'kind': 'bangs', 'note': 'tips at x97, x99, x101 (between the eyes) and x106; notches at x98, x100, x103',
     'span': [20, 26], 'edge': [[97, 23], [98, 21], [99, 22], [100, 21], [101, 23], [102, 21], [103, 20], [104, 21], [105, 22], [106, 23]]},
], patches=[
    shade([0, 31, 197, 118], [0.55, 0.45, 0.7]),
    *hair([84, 2, 114, 60], [90, 6, 110, 12], [2, 22], [[88, 92], [94, 100], [102, 107]],
          [[[98, 15], [98, 18], [98, 21]], [[103, 14], [103, 17], [103, 20]]], [0, 32, 118, 90]),
    glint(183, 15),
    {'kind': 'hand', 'stamp': 'fist_h', 'at': [132, 28], 'note': 'lead hand closed across the haft behind the guard, arm fully extended'},
    {'kind': 'hand', 'stamp': 'fist_h', 'at': [76, 45], 'note': 'rear hand at the hip, closed on the rear third of the haft where it leaves the sleeve'},
])
LAYERS['q_stamp_144'] = dict(face=FACE['q_stamp'], rim=RIM_FULL, preface=[
    {'kind': 'facewin', 'note': 'adopt the anti-aliased skin-coloured contour pixels as skin', 'box': [72, 96, 86, 112], 'adopt_skin': True},
    {'kind': 'facewin', 'note': 'the flung sleeve crossed the far cheek (critic: lavender block on the jaw); the cheek is restored in front of it',
     'poly': [[84, 102], [85, 103], [85, 106], [84, 107], [83, 108], [82, 109], [81, 110], [76, 110], [76, 102]], 'from': ['white'], 'to': 'S2'},
    {'kind': 'bangs', 'note': 'tips at x73, x76, x79, x83-84; the eye arcs sit 1 px under them',
     'span': [96, 102], 'edge': [[73, 100], [74, 98], [75, 99], [76, 100], [77, 99], [78, 98], [79, 100], [80, 99], [81, 98], [82, 99], [83, 100], [84, 101]]},
    {'kind': 'contour', 'note': 'jaw S3 on both sides tapering to a 3 px chin, S4 neck shadow under it, sleeve edge re-drawn along the cheek',
     'px': [[73, 106, 'S3'], [73, 107, 'S3'], [74, 108, 'S3'], [74, 109, 'S3'], [75, 110, 'S3'], [76, 111, 'S3'], [77, 111, 'S2'], [78, 111, 'S2'],
            [79, 111, 'S2'], [80, 111, 'S3'], [81, 111, 'W4'], [82, 110, 'W4'], [77, 112, 'S4'], [78, 112, 'S4'], [79, 112, 'S4'], [81, 110, 'S3'],
            [82, 109, 'S3'], [83, 108, 'S3']]},
], patches=[
    shade([0, 112, 129, 200], [0.5, 0.5, 0.7]),
    *hair([60, 80, 100, 140], [70, 84, 90, 90], [82, 99], [[68, 72], [74, 80], [82, 87]],
          [[[74, 91], [74, 95], [74, 98]], [[80, 90], [80, 94], [81, 98]]], [0, 114, 129, 200]),
    glint(119, 12),
    {'kind': 'hand', 'stamp': 'fist_v', 'flip': True, 'at': [104, 101], 'note': 'far hand at full reach, closed round the planted haft, arm from the left'},
])
N2_SKIN = [
    "...........",
    ".....II....",
    "....VII....",
    "....TSSS...",
    "....SSSSS..",
    "...TSSSSS..",
    "..SSSSSSS..",
    "...SSSSST..",
    "...SSSSSS..",
    "....SSSSS..",
    "...SSSSN...",
    "....TSN....",
    "..........."]
N2_LINE = [
    "...........",
    "...........",
    "...........",
    "...K.......",
    "...K.......",
    "..K........",
    ".K.........",
    "..K........",
    "..K........",
    "...K.......",
    "..K........",
    "...K.......",
    "....KK....."]
LAYERS['n2_pivot_144'] = dict(face=FACE['n2_pivot'], rim=RIM_HALF, preface=[
    {'kind': 'facewin', 'note': 'adopt the anti-aliased skin-coloured contour pixels as skin', 'box': [108, 18, 118, 31], 'adopt_skin': True},
    {'kind': 'contour', 'note': 'profile silhouette facing left: bangs over the forehead, brow step, nose bridge, 1 px nose tip at x109, '
     'notch under the nose, upper lip, lip notch (the stamp mouth sits in it), chin, jaw back under the ear; the crossing lock over the eye is removed',
     'at': [108, 19], 'rows': N2_SKIN},
    {'kind': 'contour', 'note': "the profile's warm G4 outline (the skin's shadow-side sel-out)", 'at': [108, 19], 'as': 'keep',
     'key': {'K': 'G4'}, 'rows': N2_LINE},
], patches=[
    shade([95, 33, 203, 156], [-0.5, 0.45, 0.7]),
    *hair([100, 2, 150, 60], [112, 8, 132, 14], [6, 20], [[113, 116], [118, 123], [125, 130]],
          [[[117, 12], [116, 15], [115, 18]]], [100, 32, 203, 156]),
    glint(14, 21),
    {'kind': 'hand', 'stamp': 'fist_h', 'flip': True, 'at': [88, 36], 'note': 'lead hand closed on the level haft, arm from the right'},
    {'kind': 'form', 'on': ['skin'], 'note': 'near (right) glute: lit S2 lobe with an S1 highlight upper-outer, S4 gluteal fold arcing into the thigh',
     'ellipses': [{'box': [119, 66, 127, 82], 'c': 'S2', 'only': ['S3']}, {'box': [122, 68, 125, 72], 'c': 'S1', 'only': ['S2']}],
     'lines': [{'pts': [[118, 86], [120, 87], [123, 87], [125, 85]], 'c': 'S4'}]},
    {'kind': 'form', 'on': ['skin'], 'note': 'far (left) glute: S3 core shadow on the inner / lower curve toward the thong (it read as one pale blob), '
     'S1 highlight on the lit upper-outer lobe, S4 fold under it',
     'polys': [{'pts': [[113, 75], [116, 71], [117, 87], [114, 89], [111, 88], [112, 82]], 'c': 'S3', 'only': ['S1', 'S2']}],
     'ellipses': [{'box': [110, 67, 113, 71], 'c': 'S1', 'only': ['S2']}],
     'lines': [{'pts': [[110, 87], [112, 88], [115, 88]], 'c': 'S4'}]},
    {'kind': 'form', 'on': ['skin'], 'note': 'spine groove (S3) down the open back into the waist band',
     'lines': [{'pts': [[121, 47], [121, 52], [120, 58]], 'c': 'S3'}]},
])

# ------------------------------------------------------------------ 128 / 96 heads
# The face window is hand-authored at each height (bang profile, face-window clean-up, jaw /
# chin, profile silhouette); everything else in a 128 / 96 layer is mapped from the 144 layer
# (author_overrides.derive). Stamp nudges per height:
FACE_PX = {
    ('idle_hero', 128): dict(FACE['idle_hero'], dy=1),
    ('idle_hero', 96): dict(FACE['idle_hero']),
    ('n1_contact', 128): dict(FACE['n1_contact'], dx=0),
    ('n1_contact', 96): dict(FACE['n1_contact'], dx=0),
    ('q_stamp', 128): dict(FACE['q_stamp'], dy=0),
    ('q_stamp', 96): dict(FACE['q_stamp'], dx=-1, dy=0),
    ('n2_pivot', 128): dict(FACE['n2_pivot']),
    ('n2_pivot', 96): dict(FACE['n2_pivot']),
}


def adopt(box):
    return {'kind': 'facewin', 'note': 'adopt the anti-aliased skin-coloured contour pixels as skin', 'box': box, 'adopt_skin': True}


def bangs(span, edge, note='fringe profile: pointed clump tips, notches over the eyes'):
    return {'kind': 'bangs', 'note': note, 'span': span, 'edge': edge}


def contour(px, note='jaw S3 tapering to the chin point, S4 neck shadow under it'):
    return {'kind': 'contour', 'note': note, 'px': px}


def veil_to_lock(box):
    return {'kind': 'facewin', 'note': 'veil block on the far jaw becomes the side lock', 'box': box, 'from': ['veil'], 'to': 'I2', 'as': 'hair'}


def sleeve_off_cheek(poly):
    return {'kind': 'facewin', 'note': 'the flung sleeve crossed the far cheek; the cheek is restored in front of it',
            'poly': poly, 'from': ['white'], 'to': 'S2'}


def profile(at, skin, line, note):
    return [{'kind': 'contour', 'note': note, 'at': at, 'rows': skin},
            {'kind': 'contour', 'note': "the profile's warm G4 outline", 'at': at, 'as': 'keep', 'key': {'K': 'G4'}, 'rows': line}]


PREFACE_PX = {
    ('idle_hero', 128): [
        adopt([37, 62, 51, 76]),
        bangs([61, 66], [[38, 63], [39, 62], [40, 62], [41, 62], [42, 63], [43, 64], [44, 63], [45, 62], [46, 62], [47, 62], [48, 63], [49, 64]]),
        veil_to_lock([48, 71, 51, 75]),
        contour([[39, 72, 'S3'], [40, 73, 'S3'], [40, 74, 'S4'], [41, 74, 'S3'], [41, 75, 'S4'], [42, 75, 'S3'], [43, 75, 'S2'], [44, 75, 'S2'], [48, 71, 'S3']]),
    ],
    ('idle_hero', 96): [
        adopt([29, 49, 40, 58]),
        bangs([48, 52], [[30, 50], [31, 49], [32, 49], [33, 49], [34, 50], [35, 49], [36, 49], [37, 49], [38, 50]]),
        veil_to_lock([37, 55, 40, 58]),
        contour([[31, 56, 'S3'], [32, 57, 'S3'], [33, 57, 'S2'], [34, 57, 'S2'], [31, 57, 'S4']]),
    ],
    ('n1_contact', 128): [
        adopt([85, 19, 96, 29]),
        bangs([19, 23], [[87, 21], [88, 20], [89, 20], [90, 21], [91, 20], [92, 20], [93, 20], [94, 21]]),
        contour([[88, 27, 'S3'], [89, 28, 'S3'], [90, 28, 'S2'], [91, 28, 'S2']]),
    ],
    ('n1_contact', 96): [
        adopt([65, 16, 73, 23]),
        bangs([16, 19], [[67, 17], [68, 17], [69, 18], [70, 17], [71, 17]]),
    ],
    ('q_stamp', 128): [
        adopt([64, 87, 77, 101]),
        sleeve_off_cheek([[75, 91], [76, 92], [76, 95], [75, 97], [74, 98], [72, 99], [68, 99], [68, 91]]),
        bangs([86, 92], [[65, 88], [66, 89], [67, 88], [68, 88], [69, 89], [70, 90], [71, 89], [72, 88], [73, 88], [74, 89], [75, 90]]),
        contour([[66, 96, 'S3'], [66, 97, 'S3'], [67, 98, 'S3'], [68, 99, 'S3'], [69, 99, 'S2'], [70, 99, 'S2'], [71, 99, 'S3'], [73, 98, 'S3'], [74, 97, 'S3']]),
    ],
    ('q_stamp', 96): [
        adopt([49, 66, 60, 76]),
        sleeve_off_cheek([[58, 69], [59, 70], [59, 72], [58, 73], [56, 75], [53, 75], [53, 69]]),
        bangs([66, 72], [[51, 68], [52, 68], [53, 68], [54, 69], [55, 68], [56, 68], [57, 68], [58, 69]]),
        contour([[51, 73, 'S3'], [52, 74, 'S3'], [53, 75, 'S3'], [54, 75, 'S2'], [55, 75, 'S2'], [56, 75, 'S3']]),
    ],
    ('n2_pivot', 128): [
        adopt([97, 16, 106, 28]),
        *profile([97, 18], [
            "...VII...",
            "...TSSS..",
            "...SSSSS.",
            "..TSSSSS.",
            ".SSSSSSS.",
            "..SSSSSS.",
            "..SSSSSN.",
            "...SSSN..",
            "..SSSN...",
            "...TS...."], [
            ".........",
            "..K......",
            "..K......",
            ".K.......",
            "K........",
            ".K.......",
            ".K.......",
            "..K......",
            ".K.......",
            "..K......",
            "...KK...."], 'profile silhouette facing left (128): bangs over the forehead, brow, nose tip at x98, lip, lip notch, chin'),
    ],
    ('n2_pivot', 96): [
        adopt([74, 13, 81, 22]),
        *profile([73, 14], [
            "....VI...",
            "....TSS..",
            "....SSS..",
            "...SSSS..",
            "....SSS..",
            "...SSSN..",
            "....TS..."], [
            ".........",
            "...K.....",
            "...K.....",
            "..K......",
            "...K.....",
            "..K......",
            "...K.....",
            "....KK..."], 'profile silhouette facing left (96): bang, nose tip at x76, lip, chin'),
    ],
}
