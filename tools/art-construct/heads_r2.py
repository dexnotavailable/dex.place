"""Round R2 heads, painted stroke by stroke (ART-RULES WF-P10; learning log round R2).

  python tools/art-construct/heads_r2.py            # writes art/rosace/construct/faces/r2/head_<view>.json

Why a repaint and not a patch of R1 (critique of round R1, 2026-09-29): the R1 head's problems were in
the drawing itself: a comb fringe on a 3/6 px period, straight vertical crown lines, a 9 px chin that ran
into the neck column, a straight S3 column on the near cheek, tear-streak marks, a lash that sloped down
toward the outer corner (the "tired" read, csp-yitsuin) and an iris whose top row (I3) merged with the
lash (I3/OL = 1.52:1 [M]). So the head is repainted on the same construction grid (face_construct: chin
y 36, eye bottom row 10, lash top row 14, 38 x 46 canvas) with every stroke written below.

Every coordinate here is a hand decision [I]; the reasons are in the comments and in ART-RULES 10 (R2).
Codes (artlib.KEY): O OL | j k l n d = I0-I4 | a b c h = A2-A5 | w e = W1 W2 | 1 s t m p = S1-S4 SB |
v x z = G1-G3.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
from brush import Grid  # noqa: E402

OUT = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'r2'

# ----------------------------------------------------------------------------------------------- q34
Q34_LOCK_DEEP = []      # the I4 strip behind the near sidelock, set by q34_front (it follows the lock's S-curve)
# Crown: the R1 silhouette (hair top row 29) kept; the clump lines now radiate from a parting at about
# (19, 9) and bend 1 px every 2 rows (HR-N04), each a different length; the highlight is one broken band,
# one dash per clump, tapering down the flow (HR-P08). Light from the upper right (DESIGN 9).
Q34_CROWN = {
    7:  '.............nlkkkkk..................',
    8:  '..........nnlkkkkkkkkkl...............',
    9:  '........nnlllkkklkkkkkkkl.............',
    10: '......dnnllllkkklkklklkkkkl...........',
    11: '.....dnnllljjjlnjjlnljnkjjjl..........',
    12: '....ddnnnljjlllnllnlljlnkklll........',
    13: '...ddnnnnllllllnlllnllllnkklkkkln.....',
    14: '...ddnnnlllllnllllnllllnlkklkklln.....',
    15: '..ddnnnnllllln' + 'llllllllll' + 'nlkklkll' + 'n.....',
    16: '..ddnnnn' + 'l' * 24 + 'nn....',
}


def q34_back(r2b=True):
    g = Grid()
    for y, r in Q34_CROWN.items():
        for x, ch in enumerate(r[:38]):
            if ch != '.':
                g.put(x, y, ch)
    # the near-side mass (the back of the head, turned from the light) from the crown to the canvas foot.
    # silhouette: x1 .. the jaw / neck; mostly I3 with value inside it (HR-P07: >= 1/3 in I1-I2 overall)
    for y in range(17, 46):
        right = 13 if y <= 28 else {29: 14, 30: 15, 31: 16, 32: 17, 33: 18, 34: 19, 35: 20, 36: 20}.get(y, 15)
        g.span(y, 1, right, 'n')
    # the top of the mass catches the light where it rolls over the crown: an I2 cap, an I1 dash
    g.spans({17: (3, 12), 18: (3, 11), 19: (4, 10), 20: (4, 9), 21: (5, 8), 22: (5, 7)}, 'l')
    g.spans({18: (6, 7), 19: (6, 7), 20: (6, 6)}, 'k')
    # two S-curved clump separators in I4 (one step under the I3 shadow, HR-P06), bending every 2-3 rows
    g.line([(3, 17), (3, 18), (4, 19), (4, 21), (3, 22), (3, 24), (2, 25), (2, 27), (3, 28), (3, 30), (4, 31), (4, 33),
            (5, 34), (5, 36), (4, 37), (4, 39), (3, 40), (3, 42), (4, 43), (4, 45)], 'd')
    g.line([(9, 21), (9, 23), (8, 24), (8, 26), (7, 27), (7, 29), (8, 30), (8, 32), (9, 33), (9, 35), (10, 36), (10, 38),
            (9, 39), (9, 41), (10, 42), (10, 44)], 'd')
    # lighter strands between them (2 px ribbons, S-curved) so the mass is not one flat I3 curtain
    g.line([(6, 24), (6, 26), (5, 27), (5, 29), (6, 30), (6, 32), (7, 33), (7, 35), (6, 36), (6, 38), (7, 39), (7, 41)], 'l')
    g.line([(5, 24), (5, 26), (4, 27), (4, 29), (5, 30), (5, 32), (6, 33)], 'l')
    g.line([(1, 31), (1, 33), (2, 34), (2, 36), (1, 37), (1, 39)], 'l')
    # the deepest value right behind the near sidelock, so the lock separates from the mass (HR-P12)
    q34_front()                                                             # the lock's shape decides where
    g.dots(Q34_LOCK_DEEP)
    if r2b:
        # round b, hair_contrast (kept): thin I1 strands, an I4 underside where the mass tucks toward the neck,
        # 3 px crown dashes
        g.line([(4, 23), (4, 24), (3, 25), (3, 26)], 'k')
        g.line([(6, 34), (6, 36)], 'k')
        g.line([(2, 36), (2, 38)], 'k')
        g.dots([(1, 41, 'd'), (2, 41, 'd'), (1, 42, 'd'), (2, 42, 'd'), (1, 43, 'd'), (2, 43, 'd'), (3, 44, 'd'),
                (2, 44, 'd'), (1, 44, 'd'), (5, 43, 'd'), (5, 44, 'd'), (6, 44, 'd'), (7, 43, 'd'), (7, 44, 'd')])
        g.dots([(14, 11, 'j'), (18, 11, 'j'), (26, 11, 'j'), (21, 11, 'j')])
        # a lit strand in the hair seen behind the near jaw, so that pocket is not one dark blob on the figure (PX-N01)
        g.spans({29: (13, 13), 30: (13, 14), 31: (13, 15), 32: (13, 16), 33: (13, 17), 34: (13, 18), 35: (13, 19),
                 36: (13, 19)}, 'l')
        g.line([(14, 31), (15, 33), (16, 35)], 'n')
        # round b, silhouette_breaks (kept): two temple locks flick out of the round outline
        g.dots([(1, 14, 'n'), (0, 13, 'n'), (1, 13, 'd'), (2, 13, 'd')])
        g.dots([(33, 17, 'l'), (34, 16, 'l'), (33, 18, 'n'), (34, 17, 'l')])
    # the far side: hair behind the far cheek, and the far sidelock (stops under the jaw: O-9, CL-N02)
    g.spans({16: (28, 33), 17: (28, 32), 18: (28, 32), 19: (28, 32), 20: (28, 32), 21: (28, 32), 22: (28, 31),
             23: (28, 31), 24: (28, 31), 25: (28, 31), 26: (29, 31), 27: (29, 31), 28: (29, 31), 29: (28, 31),
             30: (28, 31), 31: (28, 30), 32: (28, 30), 33: (28, 30), 34: (29, 30), 35: (29, 29)}, 'l')
    g.line([(32, 17), (32, 19), (31, 20), (31, 22), (32, 23), (32, 25), (31, 26), (31, 32)], 'k')       # the lit outer edge of the lock
    g.line([(28, 17), (29, 21), (29, 25), (29, 28)], 'n')                 # the side toward the face, in shadow
    g.line([(30, 18), (30, 22), (30, 26), (29, 30)], 'n')                 # one bent split
    g.dots([(28, 33, 'b'), (29, 33, 'b'), (30, 33, 'c'), (29, 34, 'b'), (30, 34, 'c'), (29, 35, 'c')])   # azure tips
    return g


def q34_skin():
    g = Grid()
    # face plane: far contour 27 -> a 1 px cheekbone bulge (rows 10-8, y 26-28) -> angles into a 3 px chin at
    # x 21-23 (1 px toward the far side of the centre line x 21: FC-P08). Near side: behind the sidelock to
    # y 28, then the jaw runs 1:1 to the chin, so no straight run and no flat chin row (FC-N13).
    far = {**{y: 27 for y in range(16, 26)}, 26: 28, 27: 28, 28: 28, 29: 27, 30: 27, 31: 26, 32: 26, 33: 25,
           34: 24, 35: 23, 36: 23}
    near = {**{y: 12 for y in range(16, 29)}, 29: 14, 30: 15, 31: 16, 32: 17, 33: 18, 34: 19, 35: 20, 36: 21}
    for y in range(16, 37):
        g.span(y, near[y], far[y], 's')
    # the cast shadow under the fringe: an S3 band that follows the clump tips (painted in q34_front's shape)
    g.dots([(12, 23, 't'), (12, 24, 't')])                                 # under the temple clump
    g.dots([(14, 18, 't'), (15, 18, 't'), (16, 18, 't'), (17, 18, 't'), (13, 19, 't'), (13, 20, 't'), (19, 20, 't'),
            (19, 21, 't'), (20, 20, 't'), (21, 20, 't'), (22, 20, 't')])
    # far cheek: one diagonal S3 cluster under the cheekbone, following the jaw (critique 2d)
    g.dots([(26, 30, 't'), (26, 31, 't'), (25, 31, 't'), (25, 32, 't')])
    # the lit cheek: a small S1 cluster (FC-P16), near side high on the cheekbone
    g.dots([(16, 27, '1'), (17, 27, '1')])
    # neck: behind and under the chin, narrower than the jaw; S4 cast wedge right under the chin (PX-P03)
    g.spans({37: (16, 21), 38: (16, 21), 39: (16, 21), 40: (16, 21), 41: (16, 21), 42: (16, 21), 43: (16, 21),
             44: (16, 21), 45: (16, 21)}, 's')
    g.spans({37: (18, 21), 38: (19, 20)}, 'm')
    g.spans({37: (16, 17), 38: (16, 18), 39: (16, 17), 40: (16, 17), 41: (16, 16), 42: (16, 16), 43: (16, 16),
             44: (16, 16), 45: (16, 16)}, 't')
    return g


def q34_front(r2b=True):
    g = Grid()
    # the fringe: a full mass over the forehead at the roots (y 16-18), splitting into 4 root clumps of unequal
    # width (6 / 4 / 5 / 4 at y 18, "mix large pieces with smaller cuts", skyrye-hair) from a parting at x 19-20;
    # the near clumps swing toward the near side, the far ones toward the far side (ao-hair34). Every tip ends on
    # a different row (HR-P11). Over each eye the tips stop 1-2 rows above that eye's own lash top (HR-P04; the
    # far eye is 1 px higher, roll -1); beside the eyes they may reach the lash row.
    body = {16: [(10, 29)], 17: [(10, 29)],
            18: [(10, 13), (18, 23), (27, 28)],
            19: [(10, 12), (18, 19), (21, 22), (27, 28)],
            20: [(10, 12), (18, 18), (28, 28)],
            21: [(10, 11), (28, 28)], 22: [(10, 11), (28, 28)], 23: [(11, 11)]}
    g.spans(body, 'l')
    # the forehead windows are designed, not leftovers: x 14-17 over the near eye and x 23-26 over the far eye
    # are where the brows sit on skin (FC-P15 reads there), the parting window at x 20 (y 19)
    # light from the upper right: each clump's upper right in I1 (a short lit patch, different on each clump),
    # the left edge and the underside in I3
    g.spans({16: [(13, 15), (18, 19), (22, 24), (27, 28)], 17: [(14, 15), (19, 20), (23, 24), (27, 28)],
             18: [(20, 21)]}, 'k')
    g.dots([(10, 18, 'n'), (10, 19, 'n'), (10, 20, 'n'), (10, 21, 'n'), (10, 22, 'n'), (11, 23, 'n'),
            (13, 18, 'n'), (12, 19, 'n'), (18, 18, 'n'), (18, 19, 'n'), (18, 20, 'n'), (22, 19, 'n'), (23, 18, 'n'),
            (27, 19, 'n'), (28, 20, 'n'), (28, 22, 'n')])
    # separators where the clumps touch (y 16-18), I4, each bent 1 px so they are not a comb
    g.dots([(16, 16, 'n'), (15, 17, 'd'), (21, 16, 'n'), (21, 17, 'd'), (25, 16, 'n'), (25, 17, 'd')])
    # one lock sweeps across the parting (critique 4: "let one lock sweep across")
    g.dots([(19, 18, 'k')])
    if r2b:
        # round b, fringe_gloss (kept, I1 only: I0 here broke HR-P08): a streak down each clump's lit side
        g.dots([(14, 16, 'k'), (14, 17, 'k'), (18, 16, 'k'), (19, 17, 'k'), (19, 18, 'k'), (23, 16, 'k'),
                (23, 17, 'k'), (28, 17, 'k'), (28, 18, 'k')])
    # near sidelock: an S-curved ribbon over the near cheek edge, gold clasp, azure tips (DESIGN 6)
    left = {**{y: 7 for y in (21, 22, 23)}, **{y: 6 for y in (24, 25, 26)}, **{y: 7 for y in (27, 28, 29)},
            **{y: 8 for y in (30, 31, 32)}, **{y: 9 for y in (33, 34, 35)}, **{y: 8 for y in (36, 37, 38)},
            39: 9, 40: 9, 41: 10, 42: 10, 43: 10}
    right = {**{y: 10 for y in range(21, 24)}, 24: 11, **{y: 12 for y in range(25, 42)},
             42: 11, 43: 10}
    lock = {y: (left[y], right[y]) for y in left}
    g.spans(lock, 'l')
    self_deep = [(left[y] - 1, y, 'd') for y in left if y <= 41]      # read by q34_back: the deep value behind the lock
    Q34_LOCK_DEEP[:] = self_deep
    g.line([(10, 22), (10, 24), (11, 27), (11, 31), (12, 34), (12, 36)], 'k')    # lit edge toward the face
    g.dots([(left[y], y, 'n') for y in left if y <= 40])                          # shadow side follows the S
    g.line([(9, 24), (9, 26), (10, 27), (10, 29)], 'n')                          # one split, bent
    g.dots([(9, 37, 'z'), (10, 37, 'x'), (11, 37, 'x'), (12, 37, 'v')])          # the gold cross clasp
    g.dots([(10, 40, 'b'), (11, 40, 'b'), (12, 40, 'b'), (10, 41, 'b'), (11, 41, 'c'), (12, 41, 'c'),
            (10, 42, 'c'), (11, 42, 'c'), (10, 43, 'c')])                        # tips A3 -> A4 (HR-P09)
    return g


# ---- expression overlays (q34). Eye grids: rows from the anchor; '.' transparent. Near eye anchor (12, 21):
# column 0 is x 12 (the flick, outside the box), the box is x 13-18, y 22-27. Far eye anchor (22, 21): box
# x 22-26; with roll -1 the far overlays draw 1 px higher (head tilt, DESIGN 5 Confident).
Q34_EXPR = {
    'confident': {
        '_doc': 'default face: open eyes at the viewer, lash heavy at the outer end with an up-and-out flick, A2 iris '
                'top (A2/OL 3.24:1 [M]), A3, an A4 crescent; brows level-to-rising outward; a 3 px S4 smirk with '
                'the near corner stepped up; the near lower lid lifted 1 px (the smile reaches the eye); head '
                'tilted 1 px (far eye higher)',
        'eye_near': {'at': [12, 21], 'box': [1, 1, 6, 6], 'rows': [
            'OO......',
            '.OOOO...',
            '.OOaOOO.',
            '.Oanhe..',
            '..bbb...',
            '.OOcb...',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '.....O',
            '.OOOOO',
            'OOah..',
            '.anbe.',
            '.bbbe.',
            '.ccbO.',
        ]},
        'brow_near': {'at': [14, 18], 'rows': ['#...', '.##.', '...#']},
        'brow_far': {'at': [24, 18], 'rows': ['..#', '.#.', '#..']},
        'nose': {'at': [22, 29], 'rows': ['t', 't']},
        'mouth': {'at': [18, 32], 'rows': ['t...', '.m..', '..mm']},
        'blush_near': {'at': [13, 28], 'rows': ['pp']},
        'blush_far': {'at': [25, 28], 'rows': ['pp']},
    },
    'focused': {
        '_doc': 'attacks: the lash flattened to a straight 2-row bar lowered onto the iris, the lower lid pushed up at '
                'the outer corner (2 iris rows show), irises on the target (screen-right), brows angled down to the '
                'nose and 1 px closer, a pressed 2 px mouth; no blush. Differs from Confident in lids, brows and mouth '
                '(critique 2g: the lids must differ, not only the brows)',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [12, 21], 'box': [1, 1, 6, 6], 'rows': [
            '........',
            'OOOOOO..',
            '.OOOOOO.',
            '..eaah..',
            '.Oebcc..',
            '.OOO....',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......',
            'OOOOOO',
            'OOOOO.',
            '.eaah.',
            '.ebcc.',
            '...OO.',
        ]},
        'brow_near': {'at': [14, 19], 'rows': ['#...', '.##.', '...#']},
        'brow_far': {'at': [23, 19], 'rows': ['..#', '.#.', '#..']},
        'mouth': {'at': [20, 34], 'rows': ['mm']},
        'blush_near': None, 'blush_far': None,
    },
    'radiant': {
        '_doc': 'wins: the eyes closed into arcs that curve up in the middle, brows raised 1 px into a soft arch, an '
                'open smile (S4 corners up, SB inside), a 3 px blush (FC-N20: the eyes change with the smile)',
        'eye_near': {'at': [12, 21], 'box': [1, 1, 6, 6], 'rows': [
            '........',
            '........',
            '....OO..',
            '..OO..O.',
            '.O......',
            '........',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......',
            '......',
            '.OO...',
            'O..OO.',
            '.....O',
            '......',
        ]},
        'brow_near': {'at': [14, 18], 'rows': ['.##.', '#..#']},
        'brow_far': {'at': [23, 19], 'rows': ['.##', '#..']},
        'mouth': {'at': [19, 33], 'rows': ['m..m', '.pp.']},
        'skin_fix': {'at': [14, 18], 'rows': ['s..s']},          # the brow arch covers the fringe shadow's middle
        'blush_near': {'at': [13, 28], 'rows': ['ppp']},
        'blush_far': {'at': [25, 28], 'rows': ['pp']},
    },
    'serene': {
        '_doc': 'prayer beats only (the one half-lid): the lash lowered so 2 iris rows show, the outer end softly down, '
                'level brows, a small closed smile with the near corner up',
        'eye_near': {'at': [12, 21], 'box': [1, 1, 6, 6], 'rows': [
            '........',
            '........',
            '.OOOOO..',
            'OOOOOOO.',
            '..aahe..',
            '.Obcb...',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......',
            '......',
            '.OOOO.',
            'OOOOOO',
            '.aahe.',
            '.bcbO.',
        ]},
        'brow_near': {'at': [14, 19], 'rows': ['####']},
        'brow_far': {'at': [24, 19], 'rows': ['###']},
        'mouth': {'at': [19, 33], 'rows': ['m.', '.m']},
        'skin_fix': {'at': [12, 23], 'rows': ['s']},             # the lowered lash covers the shadow's lower px
    },
    'ignited': {
        '_doc': 'R / Illumination: the Focused lids and brows; the iris keeps a dark A2 core inside an A4 rim (critique '
                '2g: a pale iris reads blind) and a 1 px A4 glow sits beside each eye; a shout with a W1 tooth',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [12, 21], 'box': [1, 1, 6, 6], 'rows': [
            '........',
            'OOOOOO..',
            '.OOOOOO.',
            '..ecah..',
            '.Oecac..',
            '.OOO....',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......',
            'OOOOOO',
            'OOOOO.',
            '.ecah.',
            '.ecac.',
            '...OO.',
        ]},
        'brow_near': {'at': [14, 19], 'rows': ['#...', '.##.', '...#']},
        'brow_far': {'at': [23, 19], 'rows': ['..#', '.#.', '#..']},
        'mouth': {'at': [19, 33], 'rows': ['mwm', 'mpm']},
        'blush_near': None, 'blush_far': None,
        'extra': [{'at': [11, 23], 'rows': ['c']}, {'at': [28, 22], 'rows': ['c']}],
    },
    'hurt': {
        '_doc': 'hit reactions: the eyes squeezed into > < shapes pointing at the nose, the inner brow ends raised '
                '(the worry brow, used here on purpose), a wince with the far corner down',
        'eye_near': {'at': [12, 21], 'box': [1, 1, 6, 6], 'rows': [
            '........',
            '.OO.....',
            '...OO...',
            '.....OO.',
            '...OO...',
            '.OO.....',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......',
            '....OO',
            '..OO..',
            'OO....',
            '..OO..',
            '....OO',
        ]},
        'brow_near': {'at': [14, 18], 'rows': ['...#', '..#.', '##..']},
        'brow_far': {'at': [24, 19], 'rows': ['#..', '.##']},
        'mouth': {'at': [19, 33], 'rows': ['mm.', '..m']},
        'blush_near': None, 'blush_far': None,
    },
}


def q34_trials():
    """trial round a on Confident (WF-P04): one design axis per variant, judged beside 07/08/09 at x6 and 2x"""
    base = Q34_EXPR['confident']
    jaw = q34_skin()
    jaw.dots([(13, 28, 't'), (14, 28, 't'), (14, 29, 't'), (15, 29, 't'), (15, 30, 't'), (16, 30, 't'), (16, 31, 't'),
              (17, 32, 't')])
    win = q34_skin()
    win.dots([(16, 18, 's'), (17, 18, 's')])
    return {'a': {
        'expr': 'confident',
        'base_patch': {'replace_layers': {'back': q34_back(False).rows(), 'front': q34_front(False).rows()},
                       'expressions': {'confident': {
            'blush_near': {'at': [13, 28], 'rows': ['p.p']}, 'blush_far': {'at': [24, 28], 'rows': ['p.p']},
            'brow_near': {'at': [14, 19], 'rows': ['###.', '...#']}, 'brow_far': {'at': [24, 19], 'rows': ['..#', '##.']},
            'mouth': {'at': [18, 33], 'rows': ['tm..', '..mm']},
            'eye_near': {**base['eye_near'], 'rows': ['O.......', '.OOOOO..', '.OOaheO.', '.Oabbe..', '..bbb...', '.OOcb...']},
            'eye_far': {**base['eye_far'], 'rows': ['.....O', '.OOOOO', 'OaahO.', '.abbe.', '.bbbe.', '.ccbO.']}}}},
        'base_verdict': 'all automatic FC/HR rules pass (60; FC-P19/N19 need the rest of the set); by eye awake and friendly, '
                        'but the iris is glassy and the hair is one flat blue next to 07/08',
        'base_idea': 'the repaint: A2 iris top, lash heavy at the outer end with a flick, lid lifted on the smirk side, '
                     'brows in forehead windows, 3 px S4 smirk, 1 px head tilt',
        'variants': {
            'iris_deep': {'axis': 'iris value', 'kept': True, 'verdict': 'KEPT: at x6 beside 07/08 the mostly-A3 base iris reads glassy; two A2 rows give the eye a dark upper mass (csp-okids) and it still passes FC-P13 (4 rows >= 2:1)', 'idea': 'the top half of each iris A2 (2 rows), A3 under it, the A4 '
                          'crescent kept: a darker upper area (csp-okids) instead of the mostly-A3 iris',
                          'expressions': {'confident': {
                              'eye_near': {**base['eye_near'], 'rows': ['O.......', '.OOOOO..', '.OOaheO.', '.Oaabe..',
                                                                         '..bbb...', '.OOcb...']},
                              'eye_far': {**base['eye_far'], 'rows': ['.....O', '.OOOOO', 'OaahO.', '.aabe.', '.bbbe.',
                                                                       '.ccbO.']}}}},
            'pupil': {'axis': 'pupil', 'kept': True, 'verdict': "KEPT (with iris_deep; the pupil row is iris_deep's second row): the I3 dot on the gaze side makes the look land on the viewer; at 2x the eyes stop reading as pale discs", 'idea': 'a 1 px I3 pupil in the iris middle on the gaze side (FC-P14 option)',
                      'expressions': {'confident': {
                          'eye_near': {**base['eye_near'], 'rows': ['O.......', '.OOOOO..', '.OOaheO.', '.Oanbe..',
                                                                     '..bbb...', '.OOcb...']},
                          'eye_far': {**base['eye_far'], 'rows': ['.....O', '.OOOOO', 'OaahO.', '.anbe.', '.bbbe.',
                                                                   '.ccbO.']}}}},
            'brow_window': {'axis': 'fringe shadow over the near brow', 'kept': False, 'verdict': 'rejected: no visible change at x6 or 2x; the S3 band over the brow is what separates it from the fringe, so it stays', 'idea': 'the S3 cast shadow under the fringe '
                            'stops at x 15, so skin shows over the inner half of the near brow',
                            'replace_layers': {'skin': win.rows()}},
            'jaw_shade': {'axis': 'face form shading', 'kept': False, 'verdict': "rejected by the checker: FC-N24 (the band's steps made vertical pairs beside the nose: tear streaks again), FC-P17 (blush touching S3), FC-N15; by eye it dirtied the jaw. Form on the face stays in the cast shadows, not a jaw band", 'idea': 'a 2 px S3 band along the near jaw: the side plane '
                          'turned from the key light (one terminator, PX-P02)', 'replace_layers': {'skin': jaw.rows()}},
            'no_blush': {'axis': 'blush', 'kept': False, 'verdict': 'rejected: without blush the face goes cold at 2x; but the p.p hatch reads as two dots at x6, so round b tries a solid 2 px blush', 'idea': 'no blush at all: does the hatch add warmth or noise at 1x?',
                         'expressions': {'confident': {'blush_near': None, 'blush_far': None}}},
            'smirk4': {'axis': 'mouth width', 'kept': False, 'verdict': 'rejected: at 2x the 4 px mouth reads as a flat line; 3 px S4 with the S3 dimple keeps the curl (FC-N11 would allow it, the eye says no)', 'idea': 'a 4 px smirk (S4 step + 3 px lip) instead of 3 + dimple',
                       'expressions': {'confident': {'mouth': {'at': [18, 33], 'rows': ['mm..', '..mm']}}}},
        }},
        'b': {
        'expr': 'confident',
        'base_patch': {'replace_layers': {'back': q34_back(False).rows(), 'front': q34_front(False).rows()},
                       'expressions': {'confident': {'blush_near': {'at': [13, 28], 'rows': ['p.p']},
                                                     'blush_far': {'at': [24, 28], 'rows': ['p.p']},
            'eye_near': {**base['eye_near'], 'rows': ['O.......', '.OOOOO..', '.OOaheO.', '.Oanbe..', '..bbb...', '.OOcb...']},
            'eye_far': {**base['eye_far'], 'rows': ['.....O', '.OOOOO', 'OaahO.', '.anbe.', '.bbbe.', '.ccbO.']},
            'brow_near': {'at': [14, 19], 'rows': ['###.', '...#']}, 'brow_far': {'at': [24, 19], 'rows': ['..#', '##.']},
            'mouth': {'at': [18, 33], 'rows': ['tm..', '..mm']}}}},
        'base_verdict': 'the base after round a; everything passes; the hair still reads as one flat blue beside 07/08',
        'base_idea': 'round a base + iris_deep + pupil',
        'variants': {
            'hair_contrast': {'axis': 'hair value range', 'kept': True, 'verdict': 'KEPT: small at x6, but at 2x the mass stops being one flat blue: the I1 strands and the tucked I4 underside give the near hair a light-to-dark turn', 'idea': 'wider value range in the back mass (critique 4: the refs '
                              'hair is value-rich): thin I1 strands on the S-curves, an I4 underside where the mass tucks '
                              'toward the neck, 3 px crown dashes', 'replace_layers': {'back': hair_contrast().rows()}},
            'fringe_gloss': {'axis': 'fringe highlight', 'kept': True, 'verdict': 'KEPT with a fix: the I0 dabs broke HR-P08 (8 dashes for 4 clumps: the gloss has to stay one band) so the fringe streaks are I1 only; by eye the clumps read as separate ribbons', 'idea': 'one tapered I1 -> I0 streak down the lit side of '
                             'each fringe clump (kawaiihannah / slynyrd-29 gloss), tips kept I3',
                             'replace_layers': {'front': fringe_gloss().rows()}},
            'silhouette_breaks': {'axis': 'head silhouette', 'kept': True, 'verdict': 'KEPT: the two temple flicks break the helmet outline at 2x without an antenna; all rules still pass', 'idea': 'two locks break the round outline at the temples '
                                  '(skyrye-hair: break the silhouette with uneven clumps; no crown antenna, R1 round a)',
                                  'replace_layers': {'back': silhouette_breaks().rows()}},
            'blush_solid': {'axis': 'blush', 'kept': True, 'verdict': 'KEPT: the solid 2 px reads as warmth at 2x where p.p read as two dots; FC-P17 (one row, on S2) holds', 'idea': 'a solid 2 px SB blush instead of the p.p hatch',
                            'expressions': {'confident': {'blush_near': {'at': [13, 28], 'rows': ['pp']},
                                                          'blush_far': {'at': [25, 28], 'rows': ['pp']}}}},
        }},
        'c': {
        'expr': 'confident',
        'base_patch': {'expressions': {'confident': {
            'eye_near': {**base['eye_near'], 'rows': ['O.......', '.OOOOO..', '.OOaheO.', '.Oanbe..', '..bbb...', '.OOcb...']},
            'eye_far': {**base['eye_far'], 'rows': ['.....O', '.OOOOO', 'OaahO.', '.anbe.', '.bbbe.', '.ccbO.']},
            'brow_near': {'at': [14, 19], 'rows': ['###.', '...#']}, 'brow_far': {'at': [24, 19], 'rows': ['..#', '##.']},
            'mouth': {'at': [18, 33], 'rows': ['tm..', '..mm']}}}},
        'base_idea': 'rounds a + b folded in. Question for this round (critique 3): smug or tired? Beside 08 the base reads '
                     'awake and pleasant but not smug: round open eyes, a small mouth',
        'variants': {
            'cat_lid': {'axis': 'upper lid line', 'kept': True, 'verdict': 'KEPT (with a fix): beside 07/08 at x6 this is the first base that reads sure of itself rather than pleasant: the lid line falls toward the nose. As first drawn it failed FC-P10 (the far iris lost the lash above its inner column) and FC-P24 (the pupil row made the bottom iris row as wide as the row above); the pupil moved up a row and the far lash runs one column further in', 'idea': 'the lash slopes down toward the nose (outer end high with a 2 px flick, '
                        'inner third covering the top of the iris): the sharp, sure eye of 07/08 (csp-yitsuin: the angle of the '
                        'lid line carries the character; down at the outside reads tired, so the slope goes the other way)',
                        'expressions': {'confident': {
                            'eye_near': {**base['eye_near'], 'rows': ['OO......', '.OOOO...', '.OOaOOO.', '.Oaahe..', '..bnb...',
                                                                       '.OOcb...']},
                            'eye_far': {**base['eye_far'], 'rows': ['.....O', '..OOOO', 'OOah..', '.anbe.', '.bbbe.',
                                                                     '.ccbO.']}}}},
            'smirk_lift': {'axis': 'mouth corner', 'kept': True, 'verdict': 'KEPT: the 2-row rise is the first mouth that reads as a smirk at 2x; still 3 S4-class px wide (FC-N11)', 'idea': 'the near corner rises 2 px in a diagonal (S3 tip, S4 step) instead of 1',
                           'expressions': {'confident': {'mouth': {'at': [18, 32], 'rows': ['t...', '.m..', '..mm']}}}},
            'brow_arch': {'axis': 'brow angle', 'kept': True, 'verdict': 'KEPT: the raised outer ends read surer; FC-N26 holds (inner ends lower)', 'idea': 'both brows 1 px higher at the outer end (a surer, slightly arched brow)',
                          'expressions': {'confident': {'brow_near': {'at': [14, 18], 'rows': ['#...', '.##.', '...#']},
                                                        'brow_far': {'at': [24, 18], 'rows': ['..#', '.#.', '#..']}}}},
        }}}


def hair_contrast():
    g = q34_back(False)
    g.line([(4, 23), (4, 24), (3, 25), (3, 26)], 'k')
    g.line([(6, 34), (6, 35), (7, 36)], 'k')
    g.line([(2, 36), (2, 37), (1, 38)], 'k')
    g.dots([(1, 41, 'd'), (2, 41, 'd'), (1, 42, 'd'), (2, 42, 'd'), (1, 43, 'd'), (2, 43, 'd'), (3, 44, 'd'), (2, 44, 'd'),
            (1, 44, 'd'), (5, 43, 'd'), (5, 44, 'd'), (6, 44, 'd'), (7, 43, 'd'), (7, 44, 'd')])
    g.dots([(14, 11, 'j'), (18, 11, 'j'), (26, 11, 'j'), (21, 11, 'j')])
    return g


def fringe_gloss():
    g = q34_front(False)
    g.dots([(14, 16, 'j'), (14, 17, 'k'), (13, 18, 'k'), (18, 16, 'j'), (19, 17, 'j'), (19, 18, 'k'), (23, 16, 'j'),
            (23, 17, 'j'), (22, 18, 'k'), (28, 17, 'j'), (28, 18, 'k')])
    return g


def silhouette_breaks():
    g = q34_back(False)
    g.dots([(1, 14, 'n'), (0, 13, 'n'), (1, 13, 'd'), (2, 13, 'd')])          # near temple lock flicks out
    g.dots([(33, 17, 'l'), (34, 16, 'k'), (33, 18, 'n'), (34, 17, 'l')])      # far temple lock flicks out
    return g


def q34():
    spec = {
        '_doc': 'Round R2 painted head, three-quarter view facing screen-right, 144 px sprite; written by '
                'tools/art-construct/heads_r2.py (every stroke is in that file). Construction grid as R1 (chin y 36, '
                'rows above the chin: mouth 2, nose 6, eye bottom 10, lash top 14, brow 16-17, hairline 20, skull top 26, '
                'hair top 29). Layers back -> skin -> front, expression overlays at anchors; format: head_paint.py.',
        'view': 'q34', 'gaze': [-1, 0], 'gaze_target': 'viewer', 'roll': -1,
        'rows': {'mouth': 2, 'nose': 6, 'eye_bottom': 10, 'lash_top': 14, 'brow': 16, 'hairline': 20,
                 'skull_top': 26, 'hair_top': 29},
        'anchors': {'c0': 21, 'chin': [22, 36], 'eye_near': [13, 22, 6, 6], 'eye_far': [22, 22, 5, 6]},
        'bangs': [{'root': [10, 15], 'tip_y': 23}, {'root': [16, 20], 'tip_y': 20}, {'root': [21, 24], 'tip_y': 19},
                  {'root': [25, 29], 'tip_y': 22}],
        'layers': {'back': q34_back().rows(), 'skin': q34_skin().rows(), 'front': q34_front().rows()},
        'expressions': Q34_EXPR,
        'trials': q34_trials(),
    }
    return spec


def write(view, spec):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f'head_{view}.json'
    A.jdump(spec, p)
    print(p)


# ----------------------------------------------------------------------------------------------- front
# Front view (facing the viewer): the same grid (chin y 36, centre line x 19), a V chin (FC-P08 front: centred),
# eyes one eye-width apart (FC-P05 front: 5 px gap), a parting at x 20 so the fringe is not a mirror (FC-N18).
# Key light from the upper right: the right side of the hair mass carries the I1, the left the I3/I4.
FRONT_DEEP = []


def front_back():
    g = Grid()
    crown = {7: (15, 23), 8: (12, 26), 9: (10, 28), 10: (8, 30), 11: (7, 31), 12: (6, 32), 13: (5, 33), 14: (5, 33),
             15: (4, 34), 16: (4, 34)}
    g.spans(crown, 'l')
    g.spans({7: (18, 23), 8: (18, 25), 9: (19, 27), 10: (21, 29), 11: (24, 30), 12: (26, 31), 13: (28, 32),
             14: (29, 32), 15: (30, 33), 16: (31, 33)}, 'k')
    g.spans({9: (10, 12), 10: (8, 11), 11: (7, 10), 12: (6, 9), 13: (5, 8), 14: (5, 8), 15: (4, 7), 16: (4, 7)}, 'n')
    g.dots([(8, 10, 'd'), (7, 11, 'd'), (6, 12, 'd'), (5, 13, 'd'), (5, 14, 'd'), (4, 15, 'd'), (4, 16, 'd')])
    # clump lines radiate from the parting (20, 8) and bend every 2 rows (HR-N04)
    g.line([(18, 9), (18, 10), (17, 11), (16, 12), (16, 13), (15, 14), (14, 15), (14, 16)], 'n')
    g.line([(20, 10), (20, 11), (19, 12), (19, 13), (18, 14), (18, 15), (19, 16)], 'n')
    g.line([(22, 9), (23, 10), (23, 11), (24, 12), (25, 13), (25, 14), (26, 15), (27, 16)], 'l')
    g.line([(14, 10), (13, 11), (12, 12), (11, 13), (11, 14), (10, 15), (10, 16)], 'n')
    g.line([(26, 10), (27, 11), (28, 12), (28, 13), (29, 14), (30, 15), (30, 16)], 'l')
    # one broken highlight band across the crown, one dash per clump, following the dome
    g.dots([(12, 12, 'k'), (13, 12, 'k'), (16, 11, 'j'), (17, 11, 'j'), (21, 10, 'j'), (22, 10, 'j'), (25, 11, 'j'),
            (26, 11, 'j'), (29, 13, 'j'), (30, 13, 'j')])
    # the mass behind the face and the neck: left side in shadow, right side lit
    for y in range(17, 46):
        g.span(y, 3, 26, 'n')
        g.span(y, 27, 35, 'l')
    g.line([(5, 17), (5, 19), (4, 20), (4, 23), (5, 24), (5, 26), (4, 27), (4, 30), (5, 31), (5, 33), (4, 34), (4, 36),
            (5, 37), (5, 39), (4, 40), (4, 42), (5, 43), (5, 45)], 'd')
    g.line([(8, 20), (8, 22), (7, 23), (7, 25), (8, 26), (8, 28), (7, 29), (7, 32), (8, 33), (8, 35), (7, 36), (7, 38),
            (8, 39), (8, 41)], 'l')
    g.line([(33, 17), (33, 19), (34, 20), (34, 23), (33, 24), (33, 26), (34, 27), (34, 30), (33, 31), (33, 33), (34, 34),
            (34, 36), (33, 37), (33, 40)], 'k')
    g.line([(30, 21), (30, 23), (31, 24), (31, 26), (30, 27), (30, 29), (31, 30), (31, 33), (30, 34), (30, 36), (31, 37),
            (31, 40)], 'n')
    g.dots([(3, 42, 'd'), (3, 43, 'd'), (3, 44, 'd'), (4, 44, 'd'), (3, 45, 'd'), (4, 45, 'd')])
    return g


def front_skin():
    g = Grid()
    near = {**{y: 11 for y in range(16, 28)}, 28: 12, 29: 12, 30: 13, 31: 14, 32: 15, 33: 16, 34: 16, 35: 17, 36: 18}
    far = {**{y: 27 for y in range(16, 28)}, 28: 26, 29: 26, 30: 25, 31: 24, 32: 23, 33: 22, 34: 22, 35: 21, 36: 20}
    for y in range(16, 37):
        g.span(y, near[y], far[y], 's')
    # the fringe's cast shadow (follows the clump shapes in front_front); one S3 cluster where the left cheek turns
    # away from the light; the chin's cast shadow on the neck
    g.dots([(13, 18, 't'), (14, 18, 't'), (15, 18, 't'), (19, 19, 't'),
            (20, 19, 't'), (24, 18, 't'), (25, 18, 't')])
    g.dots([(12, 30, 't'), (13, 30, 't'), (13, 31, 't')])
    g.dots([(15, 27, '1'), (16, 27, '1')])
    g.spans({y: (16, 22) for y in range(37, 46)}, 's')
    g.spans({37: (17, 21), 38: (18, 20)}, 'm')
    g.spans({y: (16, 16) for y in range(37, 46)}, 't')
    return g


def front_front():
    g = Grid()
    body = {16: [(10, 28)], 17: [(10, 28)],
            18: [(9, 13), (16, 19), (21, 23), (27, 29)],
            19: [(9, 11), (17, 18), (21, 21), (23, 23), (28, 29)],
            20: [(9, 10), (16, 16), (23, 23), (29, 29)],
            21: [(9, 10), (29, 29)], 22: [(10, 10), (29, 29)]}
    g.spans(body, 'l')
    g.spans({16: [(13, 14), (18, 19), (22, 24), (27, 28)], 17: [(13, 13), (18, 18), (23, 24), (27, 28)],
             18: [(22, 23)]}, 'k')
    g.dots([(9, 18, 'n'), (9, 19, 'n'), (9, 20, 'n'), (9, 21, 'n'), (10, 22, 'n'), (13, 18, 'n'), (11, 19, 'n'),
            (16, 18, 'n'), (17, 19, 'n'), (16, 20, 'n'), (21, 18, 'n'), (23, 20, 'n'), (27, 18, 'n'), (29, 21, 'n'),
            (29, 22, 'n')])
    g.dots([(15, 16, 'n'), (15, 17, 'd'), (20, 16, 'd'), (20, 17, 'd'), (25, 16, 'n'), (25, 17, 'd')])
    # sidelocks, both S-curved but not mirrored: the left one swings in at y 28, the right one out at y 34
    lft = {**{y: 6 for y in (19, 20, 21)}, **{y: 5 for y in (22, 23, 24)}, **{y: 6 for y in (25, 26, 27)},
           **{y: 7 for y in (28, 29, 30)}, **{y: 8 for y in (31, 32, 33)}, **{y: 7 for y in (34, 35, 36)},
           **{y: 6 for y in (37, 38, 39)}, 40: 7, 41: 7}
    rgt = {**{y: 31 for y in (19, 20, 21)}, **{y: 32 for y in (22, 23, 24)}, **{y: 31 for y in (25, 26, 27)},
           **{y: 30 for y in (28, 29, 30)}, **{y: 31 for y in (31, 32, 33)}, **{y: 32 for y in (34, 35, 36)},
           **{y: 33 for y in (37, 38, 39)}, 40: 32, 41: 32}
    FRONT_DEEP.clear()
    for y in lft:
        g.span(y, lft[y], lft[y] + (4 if y < 34 else 3), 'l')
        g.put(lft[y], y, 'n')
        FRONT_DEEP.append((lft[y] - 1, y, 'd'))
    for y in rgt:
        g.span(y, rgt[y] - (3 if y < 34 else 2), rgt[y], 'l')
        g.put(rgt[y], y, 'k')
        g.put(rgt[y] - (3 if y < 34 else 2), y, 'n')
    g.line([(8, 21), (8, 23), (7, 24), (7, 26), (8, 27), (8, 29), (9, 30), (9, 32)], 'n')
    g.line([(30, 22), (30, 24), (31, 25), (31, 27)], 'n')
    g.dots([(6, 37, 'z'), (7, 37, 'x'), (8, 37, 'x'), (9, 37, 'v'), (31, 37, 'z'), (32, 37, 'x'), (33, 37, 'v')])
    g.dots([(7, 40, 'b'), (8, 40, 'b'), (9, 40, 'b'), (7, 41, 'c'), (8, 41, 'c'), (9, 41, 'b'), (8, 42, 'c'),
            (30, 40, 'b'), (31, 40, 'b'), (32, 40, 'b'), (31, 41, 'c'), (32, 41, 'c'), (32, 42, 'c')])
    return g


FRONT_EXPR = {
    'confident': {
        '_doc': 'front Confident: the q34 eye design at 5 px (with the round c lid that slopes toward the nose), both irises 1 px screen-left (a named target: the viewer, '
                'just off-axis), the near (left) lower lid lifted with the smirk, the near brow 1 px higher, a 3 px S4 smirk',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            'OO.....',
            '.OOOO..',
            '.OOaOO.',
            '.Oanhe.',
            '..bbb..',
            '.OOcb..',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '.....O',
            '.OOOOO',
            'OOah..',
            '.anbe.',
            '.bbb..',
            '.ccbO.',
        ]},
        'brow_near': {'at': [12, 19], 'rows': ['####']},
        'brow_far': {'at': [24, 19], 'rows': ['###']},
        'nose': {'at': [19, 30], 'rows': ['t']},
        'mouth': {'at': [17, 33], 'rows': ['tm..', '..mm']},
        'blush_near': {'at': [13, 28], 'rows': ['pp']},
        'blush_far': {'at': [24, 28], 'rows': ['pp']},
    },
    'focused': {
        '_doc': 'front Focused: flat lowered lids, the lower lids up, irises on a target to screen-right, brows down to '
                'the nose, a pressed mouth',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......',
            'OOOOOO.',
            '.OOOOO.',
            '..eaah.',
            '.Oebcc.',
            '.OO....',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......',
            'OOOOOO',
            'OOOOO.',
            '.eaah.',
            '.ebcc.',
            '...OO.',
        ]},
        'brow_near': {'at': [12, 19], 'rows': ['#...', '.##.', '...#']},
        'brow_far': {'at': [23, 20], 'rows': ['...#', '.##.']},
        'nose': {'at': [19, 30], 'rows': ['t']},
        'mouth': {'at': [18, 34], 'rows': ['mm']},
        'blush_near': None, 'blush_far': None,
    },
    'radiant': {
        '_doc': 'front Radiant: closed arcs peaked off-centre, raised soft brows, an open smile, a 3 px blush',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......',
            '.......',
            '...OO..',
            '..O..O.',
            '.O.....',
            '.......',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......',
            '......',
            '.OO...',
            'O..OO.',
            '.....O',
            '......',
        ]},
        'brow_near': {'at': [12, 18], 'rows': ['.##.', '#..#']},
        'brow_far': {'at': [24, 19], 'rows': ['.##', '#..']},
        'nose': {'at': [19, 30], 'rows': ['t']},
        'mouth': {'at': [17, 33], 'rows': ['m..m', '.pp.']},
        'skin_fix': {'at': [15, 18], 'rows': ['s']},
        'blush_near': {'at': [13, 28], 'rows': ['ppp']},
        'blush_far': {'at': [23, 28], 'rows': ['ppp']},
    },
    'serene': {
        '_doc': 'front Serene: the half-lid (2 iris rows), soft outer ends, level brows, a small closed smile',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......', '.......', '.OOOOO.', 'OOOOOO.', '..aahe.', '.Obcb..']},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......', '......', '.OOOO.', 'OOOOOO', '.aahe.', '.bcbO.']},
        'brow_near': {'at': [12, 19], 'rows': ['####']},
        'brow_far': {'at': [24, 20], 'rows': ['###']},
        'nose': {'at': [19, 30], 'rows': ['t']},
        'mouth': {'at': [18, 33], 'rows': ['m.', '.m']},
    },
    'ignited': {
        '_doc': 'front Ignited: the Focused lids, an A2 core in an A4 rim, a 1 px A4 glow beside each eye, a shout',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......', 'OOOOOO.', '.OOOOO.', '..ecah.', '.Oecac.', '.OO....']},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......', 'OOOOOO', 'OOOOO.', '.ecah.', '.ecac.', '...OO.']},
        'brow_near': {'at': [12, 19], 'rows': ['#...', '.##.', '...#']},
        'brow_far': {'at': [23, 20], 'rows': ['...#', '.##.']},
        'nose': {'at': [19, 30], 'rows': ['t']},
        'mouth': {'at': [18, 33], 'rows': ['mwm', 'mpm']},
        'blush_near': None, 'blush_far': None,
        'extra': [{'at': [10, 23], 'rows': ['c']}, {'at': [28, 23], 'rows': ['c']}],
    },
    'hurt': {
        '_doc': 'front Hurt: > < squeezed eyes, inner brow ends up, a wince with one corner down',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......', '.OO....', '...OO..', '.....O.', '...OO..', '.OO....']},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......', '....OO', '..OO..', '.O....', '..OO..', '....OO']},
        'brow_near': {'at': [12, 18], 'rows': ['...#', '..#.', '##..']},
        'brow_far': {'at': [24, 19], 'rows': ['#..', '.##']},
        'nose': {'at': [19, 30], 'rows': ['t']},
        'mouth': {'at': [18, 33], 'rows': ['mm.', '..m']},
        'blush_near': None, 'blush_far': None,
        'skin_fix': {'at': [14, 18], 'rows': ['s']},
    },
}


def front_spec():
    f = front_front()
    b = front_back()
    b.dots(FRONT_DEEP)
    return {
        '_doc': 'Round R2 painted head, front view, 144 px sprite; written by tools/art-construct/heads_r2.py (every '
                'stroke is in that file). Grid as q34 (chin y 36, centre line x 19).',
        'view': 'front', 'gaze': [-1, 0], 'gaze_target': 'viewer', 'roll': 0,
        'rows': {'mouth': 2, 'nose': 6, 'eye_bottom': 10, 'lash_top': 14, 'brow': 16, 'hairline': 20,
                 'skull_top': 26, 'hair_top': 29},
        'anchors': {'c0': 19, 'chin': [19, 36], 'eye_near': [12, 22, 5, 6], 'eye_far': [22, 22, 5, 6]},
        'bangs': [{'root': [10, 14]}, {'root': [15, 19]}, {'root': [20, 24]}, {'root': [25, 28]}],
        'layers': {'back': b.rows(), 'skin': front_skin().rows(), 'front': f.rows()},
        'expressions': FRONT_EXPR,
    }


# ----------------------------------------------------------------------------------------------- profile
# Profile facing screen-right. AnimeOutline's side-view rows (ao-side, FC-P23): nose tip about a quarter of the head
# above the chin (row 7, y 29), the bottom lip about an eighth (row 3), the eye set back from the front contour, the
# neck on an angle. The skull ball sits behind the face; the hime sidelock hides the ear.
PROFILE_DEEP = []


def profile_back():
    g = Grid()
    crown = {7: (10, 19), 8: (7, 22), 9: (5, 24), 10: (4, 25), 11: (3, 26), 12: (2, 26), 13: (2, 27), 14: (1, 27),
             15: (1, 27), 16: (1, 25)}
    g.spans(crown, 'l')
    g.spans({7: (13, 19), 8: (14, 22), 9: (16, 24), 10: (18, 25), 11: (20, 26), 12: (21, 26), 13: (22, 27),
             14: (23, 27), 15: (24, 27)}, 'k')
    g.spans({9: (5, 7), 10: (4, 6), 11: (3, 6), 12: (2, 5), 13: (2, 5), 14: (1, 4), 15: (1, 4), 16: (1, 4)}, 'n')
    g.dots([(5, 9, 'd'), (4, 10, 'd'), (3, 11, 'd'), (2, 12, 'd'), (2, 13, 'd'), (1, 14, 'd'), (1, 15, 'd')])
    # flow lines from the crown whorl at about (14, 9): they sweep back and down, and forward to the fringe
    g.line([(13, 9), (12, 10), (11, 11), (11, 12), (10, 13), (9, 14), (9, 15), (8, 16)], 'n')
    g.line([(16, 10), (15, 11), (15, 12), (14, 13), (14, 14), (13, 15), (13, 16)], 'n')
    g.line([(18, 10), (19, 11), (20, 12), (20, 13), (21, 14), (22, 15)], 'l')
    g.dots([(9, 11, 'k'), (10, 11, 'k'), (13, 10, 'j'), (14, 10, 'j'), (17, 9, 'j'), (18, 9, 'j'), (21, 11, 'j'),
            (22, 11, 'j')])
    # the hair down the back, S-curved clumps, dark toward the back
    for y in range(17, 46):
        g.span(y, 1, 17, 'n')
    g.line([(3, 17), (3, 19), (2, 20), (2, 22), (3, 23), (3, 25), (2, 26), (2, 28), (3, 29), (3, 31), (2, 32), (2, 34),
            (3, 35), (3, 37), (2, 38), (2, 40), (3, 41), (3, 43)], 'd')
    g.line([(7, 17), (7, 19), (6, 20), (6, 22), (7, 23), (7, 25), (8, 26), (8, 28), (7, 29), (7, 31), (6, 32), (6, 34),
            (7, 35), (7, 37), (8, 38), (8, 40)], 'l')
    g.line([(8, 18), (8, 19)], 'k')
    g.line([(11, 18), (11, 20), (10, 21), (10, 23), (11, 24), (11, 26), (12, 27), (12, 29), (11, 30), (11, 32),
            (10, 33), (10, 35), (11, 36), (11, 38)], 'd')
    g.line([(5, 24), (5, 26), (4, 27), (4, 29), (5, 30), (5, 32)], 'l')
    g.dots([(1, 42, 'd'), (1, 43, 'd'), (1, 44, 'd'), (2, 45, 'd'), (1, 45, 'd')])
    return g


def profile_skin():
    g = Grid()
    front = {16: 24, 17: 25, 18: 25, 19: 26, 20: 26, 21: 25, 22: 25, 23: 25, 24: 25, 25: 26, 26: 26, 27: 27, 28: 27,
             29: 29, 30: 28, 31: 26, 32: 26, 33: 27, 34: 26, 35: 26, 36: 24}
    back = {**{y: 17 for y in range(16, 29)}, 29: 18, 30: 18, 31: 19, 32: 19, 33: 20, 34: 21, 35: 22, 36: 23}
    for y in range(16, 37):
        g.span(y, back[y], front[y], 's')
    g.dots([(28, 29, '1'), (27, 29, '1')])                                    # the lit nose tip
    g.dots([(26, 30, 't'), (27, 30, 't')])                                    # under the nose tip
    g.dots([(22, 19, 't'), (23, 19, 't')])                                 # the fringe's cast shadow
    g.dots([(19, 31, 't'), (19, 32, 't'), (20, 32, 't')])                    # the jaw corner turning away
    # neck on an angle (ao-side), S4 cast wedge under the jaw
    neck = {37: (17, 23), 38: (17, 22), 39: (17, 22), 40: (16, 22), 41: (16, 21), 42: (16, 21), 43: (16, 21),
            44: (15, 21), 45: (15, 20)}
    g.spans(neck, 's')
    g.spans({37: (19, 23), 38: (20, 22)}, 'm')
    g.spans({y: (v[0], v[0]) for y, v in neck.items()}, 't')
    return g


def profile_front():
    g = Grid()
    # the fringe falls forward from the crown: a full mass over the forehead, 3 clumps of unequal width, tips
    # stepping down toward the face (the front clump longest), all of them in front of or above the eye
    body = {16: [(17, 27)], 17: [(17, 28)], 18: [(18, 18), (21, 28)], 19: [(18, 18), (24, 27)], 20: [(18, 18), (25, 27)],
            21: [(26, 27)], 22: [(27, 27)]}
    g.spans(body, 'l')
    g.spans({16: [(22, 26)], 17: [(24, 27)], 18: [(26, 27)]}, 'k')
    g.dots([(17, 16, 'n'), (17, 17, 'n'), (18, 18, 'n'), (22, 18, 'n'), (24, 19, 'n'), (25, 20, 'n'), (26, 21, 'n'),
            (27, 22, 'n'), (18, 20, 'n'), (21, 17, 'd'), (21, 16, 'n'), (25, 17, 'd')])
    # the sidelock hides the ear: an S-curved ribbon from the temple to the collarbone
    lft = {**{y: 12 for y in (19, 20, 21)}, **{y: 11 for y in (22, 23, 24)}, **{y: 12 for y in (25, 26, 27)},
           **{y: 13 for y in (28, 29, 30)}, **{y: 12 for y in (31, 32, 33)}, **{y: 11 for y in (34, 35, 36)},
           **{y: 12 for y in (37, 38, 39)}, 40: 12, 41: 12}
    PROFILE_DEEP.clear()
    for y, x in lft.items():
        w = 4 if y < 37 else 3
        g.span(y, x, x + w, 'l')
        g.put(x, y, 'n')
        g.put(x + w, y, 'k')
        PROFILE_DEEP.append((x - 1, y, 'd'))
    g.line([(14, 20), (14, 22), (13, 23), (13, 25), (14, 26), (14, 28), (15, 29), (15, 31)], 'n')
    g.dots([(12, 37, 'z'), (13, 37, 'x'), (14, 37, 'x'), (15, 37, 'v')])
    g.dots([(12, 40, 'b'), (13, 40, 'b'), (14, 40, 'b'), (15, 40, 'b'), (13, 41, 'c'), (14, 41, 'c'), (15, 41, 'b'),
            (14, 42, 'c')])
    return g


PROFILE_EXPR = {
    'confident': {
        '_doc': 'profile Confident: the eye 4 px wide, set back 4 px from the contour (FC-P23), the lash heavy at the back '
                'with the flick sweeping back and up, a 3 px iris at the front (looking ahead), the lower lid lifted '
                'with a smirk that curls back from the lip line',
        'gaze': [1, 0], 'gaze_target': 'ahead',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            'O.....',
            '.OOOO.',
            '.Oaah.',
            '.Oanb.',
            '..bbb.',
            '.OOcb.',
        ]},
        'brow_near': {'at': [19, 19], 'rows': ['###']},
        'mouth': {'at': [23, 33], 'rows': ['m..', '.mm']},
        'blush_near': {'at': [21, 28], 'rows': ['pp']},
    },
    'focused': {
        '_doc': 'profile Focused: the lid flat and lowered, the lower lid up, the brow driven down at the front, a pressed mouth',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......',
            'OOOOO.',
            '.OOOOO',
            '.Oaah.',
            '.Obcc.',
            '.OO...',
        ]},
        'brow_near': {'at': [19, 19], 'rows': ['##.', '..#']},
        'mouth': {'at': [24, 33], 'rows': ['m.', '.m']},
        'blush_near': None,
    },
    'radiant': {
        '_doc': 'profile Radiant: the eye closed into an arc that curves up, the brow raised, an open smile, a 3 px blush',
        'gaze': [1, 0], 'gaze_target': 'ahead',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......',
            '......',
            '...OO.',
            '.OO..O',
            'O.....',
            '......',
        ]},
        'brow_near': {'at': [18, 18], 'rows': ['.##.', '#..#']},
        'mouth': {'at': [23, 33], 'rows': ['m..', '.pm']},
        'blush_near': {'at': [20, 28], 'rows': ['ppp']},
    },
    'serene': {
        '_doc': 'profile Serene: the half-lid, the lash end soft, a level brow, a small closed smile',
        'gaze': [1, 1], 'gaze_target': 'blade',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......', '......', '.OOOO.', 'OOOOOO', '.Oaah.', '..bcb.']},
        'brow_near': {'at': [19, 19], 'rows': ['###']},
        'mouth': {'at': [24, 33], 'rows': ['m.', '.m']},
    },
    'ignited': {
        '_doc': 'profile Ignited: the Focused lid, an A2 core in an A4 rim, a glow behind the eye, a shout',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......', 'OOOOO.', '.OOOOO', '.Ocah.', '.Ocac.', '.OO...']},
        'brow_near': {'at': [19, 19], 'rows': ['##.', '..#']},
        'mouth': {'at': [23, 33], 'rows': ['mm', 'pm']},
        'blush_near': None,
        'extra': [{'at': [17, 23], 'rows': ['c']}],
    },
    'hurt': {
        '_doc': 'profile Hurt: the eye squeezed into a > pointing forward, the brow lifted at the front, a wince',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......', '.OO...', '...OO.', '.....O', '...OO.', '.OO...']},
        'brow_near': {'at': [19, 18], 'rows': ['..#', '##.']},
        'mouth': {'at': [24, 33], 'rows': ['mm', '.m']},
        'blush_near': None,
    },
}


def profile_spec():
    f = profile_front()
    b = profile_back()
    b.dots(PROFILE_DEEP)
    return {
        '_doc': 'Round R2 painted head, profile facing screen-right, 144 px sprite; written by tools/art-construct/heads_r2.py '
                '(every stroke is in that file). Grid as q34 (chin y 36).',
        'view': 'profile', 'gaze': [1, 0], 'gaze_target': 'ahead', 'roll': 0,
        'rows': {'mouth': 2, 'nose': 6, 'eye_bottom': 10, 'lash_top': 14, 'brow': 16, 'hairline': 20,
                 'skull_top': 26, 'hair_top': 29},
        'anchors': {'c0': 25, 'chin': [23, 36], 'eye_near': [18, 22, 4, 6]},
        'layers': {'back': b.rows(), 'skin': profile_skin().rows(), 'front': f.rows()},
        'expressions': PROFILE_EXPR,
    }



if __name__ == '__main__':
    write('q34', q34())
    write('front', front_spec())
    write('profile', profile_spec())
