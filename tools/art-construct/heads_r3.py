"""Round R3 heads, painted stroke by stroke (ART-RULES WF-P10; learning log round R3).

  python tools/art-construct/heads_r3.py            # writes art/rosace/construct/faces/r3/head_<view>.json

Why a repaint and not a patch of R2 (round-2 critique, 6.2/10, 2026-09-29): R2 read "sullen or unimpressed", not
confident and charming. The causes the critic measured are all in the drawing:
  2a  the near eye carried an 11 px lash over three rows, so its top iris row was 1 A2 px and the FAR eye read bigger;
  2b  the highlights sat at different heights against their pupils (the eyes focus on different points);
  2c  the fringe shadow was a checker of single I3/S2 pixels and a 4 px S3 bar joined the brows into a unibrow;
  2d  the mouth was 3 px on a diagonal (a pout), and the cheek and lid did not move with it;
  2e  both jaws were perfect 1:1 staircases: a guitar-pick face;
  2f  86 % flat S2, 2 px S1, a 7 px fringe shadow: a sticker set into the hair;
  4a  the crown highlight was one straight row of equal dashes (a halo band) and the back hair ran in parallel stripes;
  4b  a flat 7 px top run, a mirror-symmetric front dome.
So the head is repainted on the same construction grid (face_construct: chin y 36, eye bottom row 10, lash top row 14,
38 x 46 canvas). Every coordinate is a hand decision [I]; the reasons are in the comments, the sources in ART-RULES 12:
  lospec-outlines (skeddles): a curve's segments are longest at the top, bottom and sides and get shorter toward the
    middle; 5,2,2,1,1 not 5,2,1,2,1 ("a little lump in the middle")          -> the jaw and the crown silhouette
  aam-highlights (Anime Art Academy): "always make sure the highlights match in both eyes"; wonky highlights read as
    "unfocused, or ... looking in different directions"                        -> both catchlights on the top iris row
  ao-shade-hair (AnimeOutline): highlights are "a series of lines with some joined into small zigzags" that "flow along
    the shape"; shadows "form along the bottom parts of the clumps"             -> the crown dashes, the back clumps
  ao-shade-face (AnimeOutline): the "shadows cast by the hair" on the forehead, "a large shadow cast by the head" on the
    neck                                                                        -> the fringe cast-shadow band
  ao-teeth (AnimeOutline): "the top row of teeth stays in the same position"; teeth "shown as one combined shape"
                                                                                -> the Ignited shout
  maryli-34, ao-female34: the near eye is the bigger one in 3/4                -> 2a
  proski-expr, faigin: a real smile moves the lower lid and the cheek           -> 2d
Codes (artlib.KEY): O OL | j k l n d = I0-I4 | a b c h = A2-A5 | w e = W1 W2 | 1 s t m p = S1-S4 SB | v x z = G1-G3.
"""
import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
from brush import Grid  # noqa: E402

OUT = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'r3'

# ================================================================================================ q34
# The face plane (skin layer). Near edge (screen-left) and far edge (screen-right) per row y.
# Far contour, cheekbone to chin: vertical runs 4, 3, 2, 1, 1 (x28 y25-28, x27 y29-31, x26 y32-33, x25 y34, x24 y35)
# into the chin: the runs only get shorter toward the chin (lospec-outlines: "5, 2, 2, 1, 1" not "5, 2, 1, 2, 1"), so
# the jaw is a curve, not R2's staircase guitar pick (critique 2e). First draft 4,2,2,2,1,1 had a straight 1:2 stretch
# (four equal steps: FC-N28). The cheekbone bulge (x28 over rows 8-10) is 1 px wider than rows 6-7 (FC-P08).
Q34_FAR = {**{y: 27 for y in range(16, 25)}, 25: 28, 26: 28, 27: 28, 28: 28, 29: 27, 30: 27, 31: 27, 32: 26, 33: 26,
           34: 25, 35: 24, 36: 23}
# Near contour: behind the sidelock to y 25 (x 12), then runs 3, 2, 1, 1, 1 and a 2 px horizontal step into the chin row
# (critique 2e: "runs of 2-1-1-2 instead of 1-1-1-1").
Q34_NEAR = {**{y: 12 for y in range(16, 26)}, 26: 13, 27: 13, 28: 13, 29: 14, 30: 14, 31: 15, 32: 16, 33: 17, 34: 19,
            35: 20, 36: 21}
# chin: 3 px (x 21-23) with the 5 px row above it (x 20-24), 1 px toward the far side of the centre line x 21 (FC-P08)

Q34_BACK_DEFAULT = {'temple_flick'}   # trial round d's winner, folded in (the rounds re-run without it: base_patch)
Q34_LOCK_DEEP = []      # the I4 strip behind the near sidelock, set by q34_front (it follows the lock's S-curve)
# the near sidelock's left (outer) edge: an S whose runs are at most 3 rows, so the I4 strip behind it bends too (HR-N04;
# the first draft held x7 for 4 rows and made a straight dark line)
Q34_LOCK_LEFT = {19: 8, 20: 8, 21: 7, 22: 7, 23: 6, 24: 6, 25: 6, 26: 7, 27: 7, 28: 7, 29: 8, 30: 8, 31: 8, 32: 9, 33: 9,
                 34: 9, 35: 8, 36: 8, 37: 8, 38: 9, 39: 9, 40: 9, 41: 10, 42: 10, 43: 10}


def q34_back(variant=None):
    """back hair, crown and the far lock. variant: a set of trial options: 'r2crown' (R2's straight halo band, the
    control), 'cowlick' (a 2 px crown cowlick), 'flyaway' (a lock breaking the back silhouette)"""
    variant = set(Q34_BACK_DEFAULT if variant is None else variant)
    g = Grid()
    # --- crown silhouette. R2 had a flat 7 px run on the top row (critique 4b). The dome now steps 6 | 3,2,2,1,1,1,1
    # on the far side and 3,2,2,1,1,1,1 on the back: longest runs at the top, shorter toward the sides (lospec-outlines).
    crown = {7: (14, 19), 8: (11, 22), 9: (9, 24), 10: (7, 26), 11: (6, 27), 12: (5, 28), 13: (4, 29), 14: (3, 30),
             15: (3, 31), 16: (2, 32)}
    g.spans(crown, 'l')
    # light from the upper right (DESIGN 9): the cap toward the light in I1, the back of the dome turned away in I3
    g.spans({7: (15, 19), 8: (15, 22), 9: (18, 24), 10: (21, 26), 11: (24, 27), 12: (26, 28), 13: (27, 29), 14: (28, 30),
             15: (29, 31)}, 'k')
    g.spans({9: (9, 10), 10: (7, 9), 11: (6, 8), 12: (5, 7), 13: (4, 7), 14: (3, 7), 15: (3, 7), 16: (2, 7)}, 'n')
    # --- the back mass behind the face, crown to the canvas foot. Contour: a slow S (x2 at the nape turn, x1 at the
    # widest part of the fall), so the back edge is not a ruler line
    left = {17: 2, 18: 1, **{y: 1 for y in range(19, 31)}, 31: 2, 32: 2, 33: 2, 34: 2, **{y: 1 for y in range(35, 46)}}
    for y in range(17, 46):
        right = Q34_NEAR.get(y, 15) - 1 if y <= 36 else 15
        right = max(right, 12)
        g.span(y, left[y], right, 'n')
    # three big clumps instead of R2's parallel stripes (critique 4a). B1 (outer, x1-3) stays I3; B2 (x3-8) carries a
    # 2 px lit ridge that S-bends with the fall (ao-shade-hair: highlights flow along the shape); B3 sits behind the lock.
    ridge = {17: 4, 18: 4, **{y: Q34_LOCK_LEFT[y] - 4 for y in range(19, 44)}}
    for y, x in ridge.items():
        g.span(y, max(2, x), max(3, x + 1), 'l')
    # where B2 rolls over the back of the skull it catches the light: a short tapering I1 strand, not a stripe
    g.dots([(4, 17, 'k'), (4, 18, 'k'), (5, 19, 'k'), (5, 20, 'k'), (4, 21, 'k')])
    # I4 only where one clump overlaps the next (B2 over B1), short and bent (ao-shade-hair: shadows along the bottoms
    # of the clumps; HR-N03)
    g.line([(3, 21), (3, 23), (2, 24), (2, 26), (3, 27), (3, 28)], 'd')
    g.line([(3, 36), (3, 38), (2, 39), (2, 41)], 'd')
    # the tucked underside of the mass toward the neck (it is closed off from the light)
    g.dots([(1, 43, 'd'), (2, 43, 'd'), (1, 44, 'd'), (2, 44, 'd'), (3, 44, 'd'), (6, 44, 'd'), (7, 44, 'd')])
    # the hair behind the near jaw: dark against the skin so the jaw reads, one lit strand a pixel away from it
    for y in range(29, 37):
        x = Q34_NEAR[y] - 2
        if x > 12:
            g.put(x, y, 'l')
    # --- the crown's clump lines: three, radiating from the parting at about (19, 8), each bending at least every 2
    # rows (HR-N04), one step darker than the clump they cross (HR-P06)
    for pts in ([(14, 9), (13, 10), (13, 11), (12, 12), (11, 13), (11, 14), (10, 15), (10, 16)],        # T | B
                [(19, 8), (19, 9), (20, 10), (20, 11), (19, 12), (19, 13), (20, 14), (20, 15)],         # the parting line
                [(23, 9), (24, 10), (24, 11), (25, 12), (25, 13), (26, 14), (26, 15)]):                 # F1 | F2
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            for xx, yy in A.line_px((x0, y0), (x1, y1)):
                cur = g.get(xx, yy)
                g.put(xx, yy, {'k': 'l', 'l': 'n', 'n': 'd'}.get(cur, cur))
    if 'cowlick' in variant:
        # critique 4b: a short cowlick, at most 2 px so it is not R1's antenna; it curls back from the parting
        g.dots([(16, 6, 'l'), (17, 6, 'k'), (15, 5, 'l')])
    if 'flyaway' in variant:
        # critique 4b: a flyaway lock at the back of the crown, dark (turned from the light), 2 px out of the dome
        g.dots([(3, 12, 'n'), (2, 11, 'n'), (1, 11, 'n'), (4, 12, 'n')])
    if 'flyaway_curl' in variant:
        # the second try: a clump tip curling up and back out of the dome, 2 px at its root, tapering (not a bar)
        g.dots([(6, 9, 'n'), (6, 10, 'n'), (5, 9, 'n'), (5, 8, 'n'), (4, 7, 'n')])
    if 'temple_flick' in variant:
        # the break on the lit side: the far temple clump flicks out of the silhouette in I2/I1, 2 px at its root, so it
        # reads as lit hair and not as a dark twig (the lesson of flyaway and flyaway_curl)
        g.dots([(33, 16, 'l'), (33, 17, 'l'), (34, 15, 'k'), (33, 15, 'k')])
    if 'r2crown' in variant:
        # R2's highlight for the A/B: one straight row of equal I0 dashes (the halo band, critique 4a)
        g.dots([(x, 11, 'j') for x in (11, 12, 13, 14, 16, 17, 18, 21, 24, 25, 26)])
    else:
        # the highlight: an angel ring broken into one tapering dash per clump, each on its own row where the skull's
        # curve puts it (ellipse about (17, 14), 12 x 4): lower at the back and the front, highest over the top
        # (critique 4a). Each dash is I0 at its head and tapers into I1 along the clump's flow (HR-P08).
        g.dots([(9, 11, 'j'), (10, 11, 'j'), (8, 12, 'k')])                       # B: flows back and down
        g.dots([(15, 10, 'j'), (16, 10, 'j'), (17, 10, 'j'), (14, 11, 'k')])      # T: the top, the longest dash
        g.dots([(21, 10, 'j'), (22, 11, 'j'), (23, 12, 'k')])                     # F1: flows forward, down the front
        g.dots([(26, 12, 'j'), (27, 12, 'j'), (28, 13, 'k')])                     # F2: over the far temple
    # --- the far side: the far lock hangs behind the far cheek and follows the jaw at 1 px (it backs the contour with
    # a dark value, FC-P18), stopping under the jaw (O-9, CL-N02)
    far_l = {**{y: Q34_FAR[y] + 1 for y in range(16, 35)}, 35: 26}
    far_r = {16: 32, 17: 32, 18: 32, 19: 32, 20: 31, 21: 31, 22: 31, 23: 31, 24: 31, 25: 31, 26: 31, 27: 31, 28: 31,
             29: 31, 30: 30, 31: 30, 32: 30, 33: 29, 34: 29, 35: 28}
    for y in far_l:
        g.span(y, far_l[y], far_r[y], 'l')
        g.put(far_r[y], y, 'k')                                                  # the lit outer edge
        g.put(far_l[y], y, 'n')                                                  # the side toward the face, in shadow
    g.line([(30, 18), (30, 20), (29, 21), (29, 24), (30, 25), (30, 28), (29, 29), (29, 31)], 'n')   # one bent split
    g.dots([(27, 33, 'b'), (28, 33, 'b'), (27, 34, 'b'), (28, 34, 'c'), (27, 35, 'c')])              # azure tips (HR-P09)
    # --- the deepest value right behind the near sidelock, so the lock separates from the mass (HR-P12)
    q34_front()
    g.dots(Q34_LOCK_DEEP)
    return g


def q34_skin():
    g = Grid()
    for y in range(16, 37):
        g.span(y, Q34_NEAR[y], Q34_FAR[y], 's')
    # --- the fringe's cast shadow (critique 2c, 2f; ao-shade-face "shadows cast by the hair"): a designed band of 2-3 px
    # S3 clusters hugging the underside of each clump, shifted down and left (away from the key light), never single
    # pixels between tips. The brows sit in the windows under it: the near brow with a row of clean S2 above and below,
    # the far brow (smaller, turned away) right under the band, as on 07/08.
    g.dots([(13, 18, 't'), (14, 17, 't'), (15, 17, 't')])                       # under C2's near half (the window arch)
    g.dots([(16, 18, 't'), (17, 19, 't')])                                       # under C2's far half
    # under C3's tip, 2 px shifted down-left; R2's 4 px S3 bar at brow height joined the brows (critique 2c). First draft
    # had 4 px here again (x18-20 + x21 y19): the same bar by eye, cut to the tip's own shadow
    g.dots([(18, 20, 't'), (19, 20, 't')])
    g.dots([(22, 18, 't'), (23, 18, 't'), (24, 18, 't'), (25, 18, 't'), (26, 18, 't'), (24, 17, 't'), (25, 17, 't')])
    g.dots([(27, 19, 't')])                                                      # under C5, beside the far flick
    # --- form: one S1 cluster on the near cheekbone (the plane that faces the key light), one S3 cluster under the far
    # cheekbone that follows the jaw (a slanted 3 px shape, never vertical beside the nose: FC-N24)
    g.dots([(16, 27, '1'), (17, 27, '1')])
    g.dots([(26, 29, 't'), (25, 30, 't'), (24, 30, 't')])
    # --- neck: behind and under the chin, narrower than the jaw; the head's cast shadow right under the chin (S4,
    # ao-shade-face "a large shadow cast by the head")
    g.spans({y: (16, 21) for y in range(37, 46)}, 's')
    g.spans({37: (18, 21), 38: (19, 20)}, 'm')
    g.spans({y: (16, 16) for y in range(37, 46)}, 't')
    return g


# The fringe (front layer). Five root clumps of unequal width at the hairline (y 16-17): C1 x9-12 (4), C2 x13-17 (5),
# C3 x18-22 (5), C4 x23-26 (4), C5 x27-30 (4); lower edge per column (the last hair row):
Q34_FRINGE_EDGE = {9: 21, 10: 23, 11: 22, 12: 19, 13: 17, 14: 16, 15: 16, 16: 17, 17: 18, 18: 18, 19: 19, 20: 19,
                   21: 18, 22: 17, 23: 17, 24: 16, 25: 16, 26: 17, 27: 18, 28: 21, 29: 22, 30: 20}
# C2 and C4 part over the brows (the windows: an arch, not a flat notch); C3 comes to a point between the eyes at y19,
# 2 rows above the lash (FC-N17); C1 and C5 frame the eyes from the temples. Tip rows 16-23: HR-P11.


def q34_front():
    g = Grid()
    for x, ye in Q34_FRINGE_EDGE.items():
        for y in range(16, ye + 1):
            g.put(x, y, 'l')
    # each clump: the lit upper right in I1, the body I2, the left edge and the tip in I3 (a ribbon turned in the light)
    g.dots([(11, 16, 'k'), (12, 16, 'k'), (11, 17, 'k'), (12, 17, 'k'), (12, 18, 'k')])                  # C1
    g.dots([(9, 18, 'n'), (9, 19, 'n'), (9, 20, 'n'), (9, 21, 'n'), (10, 22, 'n'), (10, 23, 'n'), (11, 22, 'n')])
    g.dots([(15, 16, 'k'), (16, 16, 'k'), (17, 16, 'k'), (16, 17, 'k')])                                  # C2
    g.dots([(13, 17, 'n'), (17, 18, 'n')])
    g.dots([(21, 16, 'k'), (22, 16, 'k'), (21, 17, 'k'), (20, 18, 'k')])                                  # C3
    g.dots([(18, 17, 'n'), (18, 18, 'n'), (19, 19, 'n'), (20, 19, 'n')])
    g.dots([(25, 16, 'k'), (26, 16, 'k'), (26, 17, 'k')])                                                 # C4
    g.dots([(23, 17, 'n')])
    g.dots([(29, 16, 'k'), (30, 16, 'k'), (30, 17, 'k'), (29, 18, 'k'), (30, 18, 'k')])                    # C5
    g.dots([(27, 17, 'n'), (27, 18, 'n'), (28, 20, 'n'), (29, 21, 'n'), (29, 22, 'n')])
    # separators where the clumps meet at the roots, I4, each bent 1 px (not a comb): C1|C2, C2|C3, C3|C4, C4|C5
    g.dots([(13, 16, 'd'), (12, 17, 'd')])
    g.dots([(18, 16, 'd'), (17, 17, 'd')])
    g.dots([(23, 16, 'd'), (22, 17, 'd')])
    g.dots([(27, 16, 'd'), (28, 17, 'd')])
    # the near sidelock: an S-curved ribbon behind C1, over the near cheek edge; gold cross clasp, azure tips (DESIGN 6)
    left = Q34_LOCK_LEFT
    right = {19: 9, 20: 9, 21: 9, 22: 9, 23: 10, 24: 11, **{y: 12 for y in range(25, 42)}, 42: 11, 43: 10}
    for y in left:
        if y <= 23:
            for x in range(left[y], right[y] + 1):
                if g.get(x, y) == '.':
                    g.put(x, y, 'l')
        else:
            g.span(y, left[y], right[y], 'l')
    Q34_LOCK_DEEP[:] = [(left[y] - 1, y, 'd') for y in left if y <= 41]
    g.line([(11, 24), (11, 26), (12, 27), (12, 30), (11, 31), (11, 34), (12, 35), (12, 36)], 'k')    # lit edge toward the face
    g.dots([(left[y], y, 'n') for y in left if y <= 40])                                            # shadow side follows the S
    g.line([(9, 25), (9, 27), (10, 28), (10, 30)], 'n')                                             # one bent split
    g.dots([(9, 37, 'z'), (10, 37, 'x'), (11, 37, 'x'), (12, 37, 'v')])                             # the gold cross clasp
    g.dots([(10, 40, 'b'), (11, 40, 'b'), (12, 40, 'b'), (10, 41, 'b'), (11, 41, 'c'), (12, 41, 'c'),
            (10, 42, 'c'), (11, 42, 'c'), (10, 43, 'c')])                                           # tips A3 -> A4 (HR-P09)
    return g


# ---- expression overlays (q34). Near eye anchor (12, 21): column 0 is x 12 (the flick, outside the box), the box is
# x 13-18, y 22-27. Far eye anchor (22, 21): box x 22-26; roll -1 draws every far overlay 1 px higher (the head tilt).
Q34_EXPR = {
    'confident': {
        '_doc': 'default face (R3): the near eye is the big bright one: the lash is the flick plus one row (8 OL px; R2 '
                'had 11 over three rows), so 4 iris rows show (A2 top, I3 pupil, A3, a 2 px A4 crescent) against the far '
                "eye's 3; both A5 catchlights on the top iris row, one column right of the pupil (aam-highlights); the "
                'near brow raised a step at its outer end in a clean skin window, the far brow flat under the fringe '
                'shadow; a 4 px S4 smile, both corners up (a shallow U; the WF-P11 pick over the smirk), an S3 dimple at the near corner; the smile lifts the near lower lid (proski-expr); trial rounds a-d below; '
                'head tilted 1 px (far eye higher)',
        'eye_near': {'at': [12, 21], 'box': [1, 1, 6, 6], 'rows': [
            'OO......',
            '.OOOOO..',
            '.OaaheO.',
            '..anbe..',
            '..bbb...',
            '.OOcc...',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '.....O',
            '.OOOOO',
            'Oaah..',
            '.anbe.',
            '.ccbO.',
            '......',
        ]},
        'brow_near': {'at': [14, 19], 'rows': ['#..', '.##']},
        'brow_far': {'at': [24, 20], 'rows': ['##']},
        'nose': {'at': [22, 29], 'rows': ['t', 't']},
        'mouth': {'at': [18, 33], 'rows': ['tm..m', '..mm.']},
        'blush_near': {'at': [14, 28], 'rows': ['pp']},
        'blush_far': {'at': [25, 28], 'rows': ['pp']},
    },
    'focused': {
        '_doc': 'attacks: the lash flattened into a straight 2-row bar lowered onto the iris (no flick), the lower lid '
                'pushed up (2 iris rows), the irises on the target (screen-right; the whites on the nose side of the '
                'gaze), brows driven down to the nose and 1 px closer (in their windows: FC-P27), a pressed 2 px mouth, no '
                'blush. The far eye 1 px narrower than the near (FC-P26)',
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
            '.OOOOO',
            'OOOOO.',
            '..eah.',
            '..ebc.',
            '...OO.',
        ]},
        'brow_near': {'at': [14, 19], 'rows': ['#..', '.#.', '..#']},
        'brow_far': {'at': [23, 20], 'rows': ['.#', '#.']},
        'mouth': {'at': [20, 34], 'rows': ['mm']},
        'blush_near': None, 'blush_far': None,
    },
    'radiant': {
        '_doc': 'wins (the smile): the eyes closed into arcs that curve up in the middle, the brows raised into soft '
                'arches, an open smile (S4 corners up, SB inside), a 3 px blush (FC-N20: the eyes change with the smile)',
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
        'brow_near': {'at': [14, 19], 'rows': ['.#.', '#.#']},
        'brow_far': {'at': [23, 20], 'rows': ['##']},
        'mouth': {'at': [19, 33], 'rows': ['m..m', '.pp.']},
        'blush_near': {'at': [14, 28], 'rows': ['ppp']},
        'blush_far': {'at': [25, 28], 'rows': ['pp']},
    },
    'serene': {
        '_doc': 'prayer beats only (the one half-lid): the lash lowered so 2 iris rows show, its outer end softly down (no '
                'flick), level brows, a small closed smile with the near corner up. Now that Confident is open (critique '
                "2a) the half-lid is Serene's own (critique 2g)",
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
            '.aah..',
            '.bcbO.',
        ]},
        'brow_near': {'at': [14, 20], 'rows': ['###']},
        'brow_far': {'at': [23, 20], 'rows': ['##']},
        'mouth': {'at': [19, 33], 'rows': ['m..', '.mm']},
    },
    'ignited': {
        '_doc': 'R / Illumination: the Focused lids; the iris keeps a dark A2 core inside an A4 rim (a pale iris reads '
                'blind) and a 1 px A4 glow sits beside each eye; the brows lowered and pulled in toward the nose; a battle '
                'cry: a dark open mouth with the teeth as one row along its top edge (critique 2g: R2 showed 2 white px '
                'in the middle and read as buck teeth; ao-teeth: "the top row of teeth stays in the same position", '
                'teeth "shown as one combined shape"). The mouth is the winner of trial round e (deep_shout)',
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
            '.OOOOO',
            'OOOOO.',
            '..cah.',
            '..cac.',
            '...OO.',
        ]},
        'brow_near': {'at': [15, 19], 'rows': ['#..', '.#.', '..#']},
        'brow_far': {'at': [22, 20], 'rows': ['.#', '#.']},
        'mouth': {'at': [19, 33], 'rows': ['www', 'OOO', '.m.']},
        'blush_near': None, 'blush_far': None,
        'extra': [{'at': [12, 24], 'rows': ['c']}, {'at': [28, 22], 'rows': ['c']}],
    },
    'hurt': {
        '_doc': 'hit reactions: the eyes squeezed into > < shapes pointing at the nose, the inner brow ends raised (the '
                'worry brow, used here on purpose), a wince with the far corner down, no blush',
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
        'brow_near': {'at': [14, 20], 'rows': ['..#', '##.']},
        'brow_far': {'at': [23, 20], 'rows': ['#.', '.#']},
        'mouth': {'at': [19, 33], 'rows': ['mm.', '..m']},
        'blush_near': None, 'blush_far': None,
    },
}



# ---- trial rounds on q34 Confident (WF-P04 on a head: one design axis per variant). Each round is judged beside refs
# 07/08/09 at x6, 2x and 1x (face_r3.py trial) and scored on every FC/HR rule; the verdict is the painter's call with the
# rule or the read that decided it, and every verdict is also a row in ART-RULES 10, round R3. base_patch rebuilds the
# base as it stood when the round ran, so a round re-renders the same after its winners are folded in.
R2_EYE_NEAR = ['OO......', '.OOOO...', '.OOaOOO.', '.Oanhe..', '..bbb...', '.OOcb...']       # heads_r2 (round c)
R2_EYE_FAR = ['.....O', '..OOOO', 'OOah..', '.anbe.', '.bbbe.', '.ccbO.']


def _conf(**kw):
    """a patch of the Confident overlays"""
    base = Q34_EXPR['confident']
    out = {}
    for k, v in kw.items():
        if k in ('eye_near', 'eye_far'):
            out[k] = {**base[k], 'rows': v}
        else:
            out[k] = v
    return {'expressions': {'confident': out}}


def q34_trials():
    return {
        'a': {
            'expr': 'confident', 'round_of': 'critique 2a, 2b: the eyes',
            'base_idea': 'the R3 repaint: near lash = the flick + 1 row (9 OL px), 4 full iris rows near / 3 far, the inner '
                         'lid dipping 1 px at the nose, both catchlights on the top iris row, one column right of the pupil',
            'base_verdict': "KEPT: at x12 and 2x the near eye is the big bright one (FC-P26 [M]: 4 full iris rows / 13 iris+white px against the far eye's 3 / 10); both catchlights on the top iris row, one column right of each pupil",
            'variants': {
                'r2_eye': {'axis': 'control: the R2 eyes', 'kept': False,
                           'idea': "R2's eye grids on the R3 head: a 3-row near lash squeezing 1 A2 px, highlights on "
                                   'different rows (the control: the new checker must catch the sullen eye)',
                           'verdict': "rejected, and the control works: under the R3 checker R2's eyes fail FC-P09 (near: 3 lash rows over the first full iris row), FC-P12 (catchlight offsets (1, 0) and (1, -1) from the pupils), FC-P26 (near 3 rows / 10 px against far 4 / 13) [M]; by eye the half-lidded near eye is back",
                           **_conf(eye_near=R2_EYE_NEAR, eye_far=R2_EYE_FAR)},
                'catch2': {'axis': 'catchlight size', 'kept': False,
                           'idea': "a 2 px catchlight in the near eye (A5 over A4), the critique's suggested A/B against "
                                   'ref 08 at x6',
                           'verdict': "rejected: at x12 the A4 under the A5 is a pale column that splits the iris and lowers its contrast; at 1x it merges with the white into one pale blob; ref 08's catchlight is one point on a dark iris [visible]",
                           **_conf(eye_near=['OO......', '.OOOOO..', '.OaaheO.', '..ance..', '..bbb...', '.OOcc...'])},
                'flat_lid': {'axis': 'lid line at the inner corner', 'kept': False,
                             'idea': 'no inner dip: the lash runs flat across the box (the first R3 draft)',
                             'verdict': 'rejected: the flat lash over the whole box reads calm and stern; the 1 px dip at the inner corner gives the almond (csp-okids: triangular ends) [visible]',
                             **_conf(eye_near=['OO......', '.OOOOOO.', '.Oaahe..', '..anbe..', '..bbb...', '.OOcc...'])},
                'white1': {'axis': 'white of the near eye', 'kept': False,
                           'idea': 'one white px in the near eye instead of two',
                           'verdict': 'rejected by FC-P26 (near 12 px against far 10, under the +3 margin [M]) and by eye: the near eye loses the brightness that makes it the near one',
                           **_conf(eye_near=['OO......', '.OOOOO..', '.OaaheO.', '..anb...', '..bbb...', '.OOcc...'])},
            }},
        'b': {
            'expr': 'confident', 'round_of': 'critique 2c: the brows',
            'base_idea': 'near brow 3 px, raised a step at its outer end, in a skin window with S2 above and below; far '
                         'brow 2 px flat, right under the fringe shadow band',
            'base_verdict': 'KEPT: the near brow reads as a stroke on skin at x12 and 2x; no unibrow, no speckle (FC-P27, FC-N27 [M])',
            'variants': {
                'brow_level': {'axis': 'brow angle', 'kept': False,
                               'idea': 'both brows flat (no raised outer end)',
                               'verdict': 'rejected: flat brows over the lashes read bored (two parallel bars) [visible]; the raised outer step is the sure look',
                               **_conf(brow_near={'at': [15, 20], 'rows': ['###']})},
                'brow_arch_far': {'axis': 'far brow shape', 'kept': False,
                                  'idea': 'the far brow arched too (outer end 1 px up)',
                                  'verdict': "rejected by FC-P27 (the raised end touches the C4 clump: the far window is one row tall) and FC-N27 [M]; by eye the far brow dissolves into the fringe again, the critique's 2c",
                                  **_conf(brow_far={'at': [24, 19], 'rows': ['.#', '#.']})},
                'brow_long': {'axis': 'brow length', 'kept': False,
                              'idea': 'R2 lengths: near 4 px, far 3 px',
                              'verdict': 'rejected: 4 / 3 px brows fill the windows edge to edge and read heavy and stern over the lashes at x12 [visible]; 3 / 2 keeps skin round each stroke',
                              **_conf(brow_near={'at': [14, 19], 'rows': ['#...', '.###']},
                                      brow_far={'at': [23, 20], 'rows': ['###']})},
            }},
        'c': {
            'expr': 'confident', 'round_of': 'critique 2d: the mouth and the cheek',
            'base_idea': 'a 4 px S4 smirk (near corner 1 row up), an S3 dimple beyond the corner, a 2 px S1 cheek lift '
                         'above it; the near lower lid already lifted (FC-P24)',
            'base_verdict': 'the smirk kept; the cheek lift came out (no_lift)',
            'variants': {
                'smirk3': {'axis': 'mouth width', 'kept': False,
                           'idea': "R2's mouth: 3 px of S4 on a diagonal with an S3 tip",
                           'verdict': 'rejected: FC-P07 and FC-N11 (3 px line) and FC-N15 [M]; by eye the pout the critic named',
                           **_conf(mouth={'at': [18, 32], 'rows': ['t...', '.m..', '..mm']})},
                'no_dimple': {'axis': 'dimple', 'kept': False,
                              'idea': 'the smirk without the S3 dimple',
                              'verdict': 'rejected: without the dimple the raised corner reads as the end of a slanted line, not a corner pulled up [visible]',
                              **_conf(mouth={'at': [18, 33], 'rows': ['.m...', '..mmm']})},
                'no_lift': {'axis': 'cheek lift', 'kept': True,
                            'idea': 'no S1 cheek lift above the corner',
                            'verdict': 'KEPT (the lift comes out): at x12 the 2 S1 px are a pale speck left of the corner, at 1x invisible (S1/S2 is 1.17:1 [M, PX-P05]); the lifted lower lid (FC-P24) and the dimple already carry the smile to the eye',
                            'expressions': {'confident': {'skin_fix': None}}},
                'smirk_rise2': {'axis': 'corner rise', 'kept': False,
                                'idea': 'the near corner rising 2 rows (S3 tip, S4 step, then 3 px)',
                                'verdict': 'rejected: the 2-row rise reads as a sneer beside open eyes, and FC-N15 [M]; one row up with the dimple reads as the smile',
                                **_conf(mouth={'at': [17, 32], 'rows': ['t....', '.m...', '..mmm']})},
            }},
        'd': {
            'expr': 'confident', 'round_of': 'critique 4a, 4b: the hair',
            'base_idea': 'the angel ring as one tapering dash per crown clump on 4 different rows; three crown clump lines; '
                         'the back hair as 2 big clumps with a lit ridge, I4 only under the overlap and behind the lock',
            'base_verdict': 'KEPT: the dashes follow the dome on four rows (HR-P08 [M]) and read as gloss, not a halo band',
            'variants': {
                'r2crown': {'axis': 'control: the R2 highlight', 'kept': False,
                            'idea': "R2's crown highlight: one straight row of equal I0 dashes",
                            'verdict': 'rejected, and the control works: HR-P08 fails (4 dashes on one row [M]); at x8 it is the halo band of critique 4a',
                            'replace_layers': {'back': 'r2crown'}},
                'cowlick': {'axis': 'crown silhouette', 'kept': False,
                            'idea': 'a 2 px cowlick curling back from the parting (critique 4b)',
                            'verdict': "rejected: FC-P01 and HR-P02 fail (hair top row 31 [M]); at 2x a single stray pixel on the dome: R1's antenna again",
                            'replace_layers': {'back': 'cowlick'}},
                'flyaway': {'axis': 'back silhouette', 'kept': False,
                            'idea': 'a dark lock flying out of the back of the crown (critique 4b)',
                            'verdict': 'rejected: a dark horizontal strand in I3 inside its outline reads as a twig at x8 and 2x [visible]',
                            'replace_layers': {'back': 'flyaway'}},
                'flyaway_curl': {'axis': 'back silhouette', 'kept': False,
                                 'idea': 'the flyaway as a clump tip curling up and back from the crown, 2 px at the root',
                                 'verdict': 'rejected: the second try (a tip curling up and back) still reads as a dark sprig or a horn [visible]. A break drawn in the shadow tone plus the outline is a 1 px dark line; that produced HR-N05',
                                 'replace_layers': {'back': 'flyaway_curl'}},
                'temple_flick': {'axis': 'far silhouette', 'kept': True,
                                 'idea': 'the far temple clump flicking out of the dome in lit tones (I2/I1)',
                                 'verdict': 'KEPT: the far temple clump flicks out in I2/I1 with a 2 px root; it reads as lit hair at 2x and 1x and breaks the dome without touching the top row (FC-P01 holds) [visible]; HR-P13',
                                 'replace_layers': {'back': 'temple_flick'}},
            }},
        'e': {
            'expr': 'ignited', 'round_of': 'critique 2g: the Ignited battle cry',
            'base_patch': {'expressions': {'ignited': {'mouth': {'at': [19, 33], 'rows': ['www', 'mOm']}}}},
            'base_idea': 'a 3 x 2 open mouth: the teeth as one W1 row along the top edge, the dark (OL) mouth under it '
                         'framed by S4 corners',
            'base_verdict': 'rejected as the base: the teeth bar over one dark px between S4 corners reads as clenched teeth, not a cry [visible, x16 and 2x]',
            'variants': {
                'r2_shout': {'axis': 'control: the R2 mouth', 'kept': False,
                             'idea': "R2's shout: one W1 px in the middle over SB (the critic's buck teeth)",
                             'verdict': "rejected, the control: one W1 px over SB reads as buck teeth, the critique's 2g [visible]",
                             'expressions': {'ignited': {'mouth': {'at': [19, 33], 'rows': ['mwm', 'mpm']}}}},
                'wide_shout': {'axis': 'mouth width', 'kept': False,
                               'idea': 'a 4 px shout: S4 corners, 2 teeth px on top, 2 dark px under',
                               'verdict': 'rejected: a 4 px mouth with 2 teeth px reads as a small open mouth, not a shout; FC-N11 allows it, the eye does not [visible]',
                               'expressions': {'ignited': {'mouth': {'at': [19, 33], 'rows': ['mwwm', '.OO.']}}}},
                'deep_shout': {'axis': 'mouth depth', 'kept': True,
                               'idea': 'a 3 x 3 shout: the teeth row on the mouth line, the dark mouth under it and the '
                                       'S4 lower lip in the middle: the jaw drops, the top teeth stay (ao-teeth)',
                               'verdict': 'KEPT: the teeth row over a dark mouth over the lower lip reads as a battle cry at x16, 2x and 1x (the only one of four with a dark mass under the teeth). First drawn one row high it failed FC-P01 (mouth row 4); on the mouth line, with the jaw dropped, it passes [M; visible]',
                               'expressions': {'ignited': {'mouth': {'at': [19, 33], 'rows': ['www', 'OOO', '.m.']}}}},
            }},
    }


def resolve_trials(tr):
    """the layer variants are named in the table above; paint them here. Every round ran on the same base: the cheek
    lift in (round c took it out) and no temple flick (round d added it)"""
    as_run = {'replace_layers': {'back': q34_back(set()).rows()},
              'expressions': {'confident': {'skin_fix': {'at': [17, 32], 'rows': ['11']},
                                            'mouth': {'at': [18, 33], 'rows': ['tm...', '..mmm']}}}}
    for k, rnd in tr.items():
        if k in 'abcd':
            rnd['base_patch'] = as_run
        for v in rnd['variants'].values():
            rl = v.get('replace_layers')
            if rl and isinstance(rl.get('back'), str):
                v['replace_layers'] = {'back': q34_back({rl['back']}).rows()}
    return tr

# ---- WF-P11, the critic gate: whole faces, not one axis, beside ref 08 at x3 and 1x, shuffled (face_r3.py pick). The
# critique asked for "3 one-axis variants of the whole face against ref 08 at x3 and x1, with a stranger-style 'which one
# would you pull for?' call"; R2 is in the line-up as the control.
Q34_PICK = {
    'seed': 3,
    'question': 'which one would you pull for?',
    'candidates': {
        'r3': {'idea': 'the R3 face after trial rounds a-d (the smirk)', 'kept': False,
               'expressions': {'confident': {'mouth': {'at': [18, 33], 'rows': ['tm...', '..mmm']}}},
               'verdict': 'runner-up: open, sure of itself, but cooler; beside the grin on ref 08 the smile (r3_smile) wins at '
                          'x10 and x3'},
        'r3_catch2': {'idea': "R3 with the critique's 2 px catchlight (A5 over A4) in the near eye", 'kept': False,
                      'verdict': 'no gain: the pale column splits the near iris at x10 and blurs it at 1x (as in round a)',
                      'expressions': {'confident': {'eye_near': {'at': [12, 21], 'box': [1, 1, 6, 6], 'rows': [
                          'OO......', '.OOOOO..', '.OaaheO.', '..ance..', '..bbb...', '.OOcc...']}}}},
        'r3_smirk3': {'idea': "R3 with R2's 3 px mouth", 'kept': False, 'verdict': 'the pout of critique 2d; at 1x the mouth is a dot',
                      'expressions': {'confident': {'mouth': {'at': [18, 32], 'rows': ['t...', '.m..', '..mm']}}}},
        'r3_smile': {'idea': 'R3 with a smile instead of the smirk: both corners up (S4 4 px, a shallow U) and the dimple',
                     'kept': True, 'verdict': 'PICKED: the warmest face at x10 and x3 beside ref 08; the shallow U with the near dimple reads as a smile that knows something (confident and charming), and at 1x the mouth registers as a curve, not a dot. Folded into Confident; FC-P07 and DESIGN 5 changed with it',
                     'expressions': {'confident': {'mouth': {'at': [18, 33], 'rows': ['tm..m', '..mm.']}}}},
        'r2': {'idea': 'the R2 face as shipped last round (the control)', 'kept': False, 'verdict': 'the control: at x3 the smallest near eye and the pout; the sullen read of the round-2 critique',
               'from_spec': 'art/rosace/construct/faces/r2/head_q34.json'},
    },
}

def q34():
    spec = {
        '_doc': 'Round R3 painted head, three-quarter view facing screen-right, 144 px sprite; written by '
                'tools/art-construct/heads_r3.py (every stroke is in that file). Construction grid as R1/R2 (chin y 36, '
                'rows above the chin: mouth 2, nose 6, eye bottom 10, lash top 14, brow 16-17, hairline 20, skull top 26, '
                'hair top 29). Layers back -> skin -> front, expression overlays at anchors; format: head_paint.py.',
        'view': 'q34', 'gaze': [-1, 0], 'gaze_target': 'viewer', 'roll': -1, 'pupil': True,
        'rows': {'mouth': 2, 'nose': 6, 'eye_bottom': 10, 'lash_top': 14, 'brow': 16, 'hairline': 20,
                 'skull_top': 26, 'hair_top': 29},
        'anchors': {'c0': 21, 'chin': [22, 36], 'eye_near': [13, 22, 6, 6], 'eye_far': [22, 22, 5, 6]},
        'bangs': [{'root': [9, 12], 'tip_y': 23}, {'root': [13, 17], 'tip_y': 18}, {'root': [18, 22], 'tip_y': 19},
                  {'root': [23, 26], 'tip_y': 17}, {'root': [27, 30], 'tip_y': 22}],
        'layers': {'back': q34_back().rows(), 'skin': q34_skin().rows(), 'front': q34_front().rows()},
        'expressions': copy.deepcopy(Q34_EXPR),
        'trials': resolve_trials(q34_trials()),
        'pick': Q34_PICK,
    }
    return spec


def write(view, spec):
    OUT.mkdir(parents=True, exist_ok=True)
    p = OUT / f'head_{view}.json'
    A.jdump(spec, p)
    print(p)



# ================================================================================================ front
# Front view (facing the viewer), on the same grid (chin y 36, centre line x 19). Critique 4b: R2's front dome was
# mirror-symmetric ("a wig on a skittle"). R3 parts the hair off-centre at x 22: the bigger side (screen-left) carries the
# volume, the dome's crest sits left of the face's centre line, the clump lines radiate from the parting, and the
# sidelocks swing differently. Key light from the upper right: the right side of the hair mass carries the I1.
FRONT_NEAR = {**{y: 11 for y in range(16, 28)}, 28: 12, 29: 12, 30: 12, 31: 13, 32: 13, 33: 14, 34: 15, 35: 17, 36: 18}
FRONT_FAR = {**{y: 27 for y in range(16, 28)}, 28: 26, 29: 26, 30: 26, 31: 25, 32: 25, 33: 24, 34: 23, 35: 21, 36: 20}
# both jaws: vertical runs 4 (to y 27), 3, 2, 1, 1, then a 2 px step into the 3 px chin (x 18-20, on the centre line):
# the runs only shorten toward the chin (lospec-outlines); the face is 17 px at the eye row (FC-P02 front)
FRONT_DEEP = []
FRONT_FRINGE_EDGE = {9: 21, 10: 22, 11: 19, 12: 17, 13: 17, 14: 16, 15: 16, 16: 18, 17: 19, 18: 20, 19: 19, 20: 18,
                     21: 17, 22: 16, 23: 16, 24: 17, 25: 16, 26: 17, 27: 18, 28: 21, 29: 23, 30: 21}
# roots at the hairline (y 16-17): L1 x9-12 (the left temple clump, framing the near eye), L2 x13-17 (arches over the
# near brow), C x18-21 (the lock from the big side, its tip between the eyes at y 20), R1 x23-26 (arches over the far
# brow), R2 x27-30 (the right temple clump); the parting's notch at x 22


def front_back():
    g = Grid()
    # the crest (x 15-21) sits left of the face's centre line, on the big side of the parting; runs 4,2,2,1,1,1 down
    # each side (a first draft crested a row higher: HR-P02, hair top 4 px over the skull)
    crown = {7: (15, 21), 8: (11, 25), 9: (9, 27), 10: (7, 29), 11: (6, 30), 12: (5, 31), 13: (4, 32), 14: (4, 32),
             15: (3, 33), 16: (3, 33)}
    g.spans(crown, 'l')
    # lit toward the key light (upper right), turned away on the left
    g.spans({7: (19, 21), 8: (21, 25), 9: (23, 27), 10: (25, 29), 11: (26, 30), 12: (27, 31), 13: (28, 32),
             14: (29, 32), 15: (30, 33), 16: (31, 33)}, 'k')
    g.spans({9: (8, 9), 10: (7, 9), 11: (6, 8), 12: (5, 8), 13: (4, 7), 14: (4, 7), 15: (3, 6), 16: (3, 6)}, 'n')
    # clump lines from the parting at (22, 7), bending every 2 rows (HR-N04), one step darker than the clump they cross
    for pts in ([(21, 8), (20, 9), (18, 10), (17, 11), (15, 12), (14, 13), (13, 14), (12, 15), (12, 16)],
                [(20, 8), (18, 9), (16, 10), (14, 11), (12, 12), (10, 13), (9, 14), (8, 15), (8, 16)],
                [(23, 8), (24, 9), (24, 10), (25, 11), (26, 12), (26, 13), (27, 14), (28, 15), (28, 16)]):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            for xx, yy in A.line_px((x0, y0), (x1, y1)):
                cur = g.get(xx, yy)
                g.put(xx, yy, {'k': 'l', 'l': 'n', 'n': 'd'}.get(cur, cur))
    # the angel ring: one tapering dash per clump on its own row (the ring is highest over the crest, lower at the sides)
    g.dots([(9, 12, 'j'), (10, 12, 'j'), (8, 13, 'k')])
    g.dots([(14, 10, 'j'), (15, 10, 'j'), (16, 9, 'j'), (13, 11, 'k')])
    g.dots([(19, 10, 'j'), (20, 10, 'j'), (21, 11, 'k')])
    g.dots([(26, 11, 'j'), (27, 11, 'j'), (28, 12, 'k')])
    # the mass behind the face and the neck: left side in shadow, right side lit
    for y in range(17, 46):
        g.span(y, 3, 26, 'n')
        g.span(y, 27, 35, 'l')
    g.line([(5, 17), (5, 19), (4, 20), (4, 23), (5, 24), (5, 26), (4, 27), (4, 29), (5, 30), (5, 32), (4, 33), (4, 35),
            (5, 36), (5, 38), (4, 39), (4, 41), (5, 42), (5, 44)], 'd')
    g.line([(7, 20), (7, 22), (8, 23), (8, 25), (7, 26), (7, 28), (8, 29), (8, 31), (7, 32), (7, 34), (8, 35), (8, 37),
            (7, 38), (7, 40)], 'l')
    g.line([(33, 17), (33, 19), (34, 20), (34, 22), (33, 23), (33, 25), (34, 26), (34, 28), (33, 29), (33, 31), (34, 32),
            (34, 34), (33, 35), (33, 37), (34, 38), (34, 40)], 'k')
    g.line([(30, 21), (30, 23), (31, 24), (31, 26), (30, 27), (30, 29), (31, 30), (31, 32), (30, 33), (30, 35), (31, 36),
            (31, 38)], 'n')
    g.dots([(3, 42, 'd'), (3, 43, 'd'), (3, 44, 'd'), (4, 44, 'd'), (3, 45, 'd'), (4, 45, 'd')])
    # the lit break on the lit side (round d's temple_flick, drawn for this view)
    g.dots([(34, 15, 'l'), (34, 16, 'l'), (35, 14, 'k'), (34, 14, 'k')])
    return g


def front_skin():
    g = Grid()
    for y in range(16, 37):
        g.span(y, FRONT_NEAR[y], FRONT_FAR[y], 's')
    # the fringe's cast shadow: one solid band under the clumps (the refs' "clean strokes in skin windows under a solid
    # fringe shadow"), shifted down-left, away from the key light. A first draft followed each window's arch and read
    # t-s-t-s-s-t along row 18: the speckle of critique 2c again (FC-N27)
    g.spans({18: [(12, 15), (21, 26)], 17: [(14, 15), (22, 23), (25, 25)]}, 't')
    g.dots([(16, 19, 't'), (20, 19, 't')])                                     # under L2's end and C's far side
    g.dots([(17, 21, 't'), (18, 21, 't')])                                     # under C's tip, 2 px
    g.dots([(27, 19, 't'), (27, 20, 't')])                                     # under R2 at the temple
    # form: the left cheek turns from the light (an S3 cluster following the jaw), an S1 cluster on the lit cheekbone
    g.dots([(12, 30, 't'), (13, 31, 't'), (13, 30, 't')])
    g.dots([(23, 27, '1'), (24, 27, '1')])
    g.spans({y: (16, 22) for y in range(37, 46)}, 's')
    g.spans({37: (17, 21), 38: (18, 20)}, 'm')
    g.spans({y: (16, 16) for y in range(37, 46)}, 't')
    return g


def front_front():
    g = Grid()
    for x, ye in FRONT_FRINGE_EDGE.items():
        for y in range(16, ye + 1):
            g.put(x, y, 'l')
    # clump light and shade: the upper right of each clump lit, the left edge and the tip in I3
    g.dots([(11, 16, 'k'), (12, 16, 'k'), (11, 17, 'k')])                                   # L1
    g.dots([(9, 18, 'n'), (9, 19, 'n'), (9, 20, 'n'), (9, 21, 'n'), (10, 21, 'n'), (10, 22, 'n'), (11, 19, 'n')])
    g.dots([(16, 16, 'k'), (17, 16, 'k'), (16, 17, 'k')])                                   # L2
    g.dots([(13, 17, 'n'), (16, 18, 'n')])
    g.dots([(20, 16, 'k'), (21, 16, 'k'), (20, 17, 'k'), (19, 18, 'k')])                    # C
    g.dots([(17, 18, 'n'), (17, 19, 'n'), (18, 20, 'n')])
    g.dots([(25, 16, 'k'), (26, 16, 'k'), (26, 17, 'k')])                                   # R1
    g.dots([(23, 16, 'n')])
    g.dots([(29, 16, 'k'), (30, 16, 'k'), (30, 17, 'k'), (29, 18, 'k'), (30, 18, 'k')])     # R2
    g.dots([(27, 17, 'n'), (27, 18, 'n'), (28, 20, 'n'), (29, 22, 'n'), (29, 23, 'n')])
    # root separators, I4, bent; the parting's notch at x 22 is skin
    g.dots([(13, 16, 'd'), (12, 17, 'd')])
    g.dots([(18, 16, 'd'), (18, 17, 'd')])
    g.dots([(23, 16, 'd')])
    g.dots([(27, 16, 'd'), (28, 17, 'd')])
    # sidelocks, both S-curved but not mirrored: the left one swings in at y 28, the right one out at y 34
    lft = {19: 6, 20: 6, 21: 6, 22: 5, 23: 5, 24: 5, 25: 6, 26: 6, 27: 6, 28: 7, 29: 7, 30: 7, 31: 8, 32: 8, 33: 8,
           34: 7, 35: 7, 36: 7, 37: 6, 38: 6, 39: 6, 40: 7, 41: 7}
    # the right lock's S in 3-row runs (a first draft held x 28 for 5 rows: a straight line, HR-N04), clear of the far
    # jaw (HR-P05)
    rgt = {19: 31, 20: 31, 21: 31, 22: 32, 23: 32, 24: 32, 25: 31, 26: 31, 27: 31, 28: 32, 29: 32, 30: 32, 31: 31,
           32: 31, 33: 31, 34: 33, 35: 33, 36: 33, 37: 34, 38: 34, 39: 34, 40: 33, 41: 33}
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
    g.line([(30, 22), (30, 24), (29, 25), (29, 27), (30, 28)], 'n')
    g.dots([(6, 37, 'z'), (7, 37, 'x'), (8, 37, 'x'), (9, 37, 'v'), (31, 37, 'z'), (32, 37, 'x'), (33, 37, 'v')])
    g.dots([(7, 40, 'b'), (8, 40, 'b'), (9, 40, 'b'), (7, 41, 'c'), (8, 41, 'c'), (9, 41, 'b'), (8, 42, 'c'),
            (30, 40, 'b'), (31, 40, 'b'), (32, 40, 'b'), (31, 41, 'c'), (32, 41, 'c'), (32, 42, 'c')])
    return g


# front overlays. Near (screen-left) eye anchor (11, 21): box x 12-16; far eye anchor (22, 21): box x 22-26 (5 px gap,
# FC-P05 front). The near side is the smile side (its lower lid lifts, FC-P24).
FRONT_EXPR = {
    'confident': {
        '_doc': 'front Confident (R3): the q34 eye at 5 px: the flick + 1 lash row, the inner lid dipping 1 px, 4 full '
                'iris rows, both catchlights on the top iris row one column right of the pupil (aam-highlights); both '
                'irises 1 px screen-left (the viewer, just off-axis); the near brow cocked (its outer end up), the far '
                'brow level; the q34 pick smile (4 px, both corners up, a near dimple)',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            'OO.....',
            '.OOOO..',
            '.OaahO.',
            '..anbe.',
            '..bbb..',
            '.OOcc..',
        ]},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '.....O',
            '.OOOOO',
            'OaahO.',
            '.anbe.',
            '.bbb..',
            '.ccbO.',
        ]},
        'brow_near': {'at': [13, 19], 'rows': ['#..', '.##']},
        'brow_far': {'at': [23, 20], 'rows': ['###']},
        'nose': {'at': [19, 30], 'rows': ['t']},
        'mouth': {'at': [17, 33], 'rows': ['tm..m', '..mm.']},
        'blush_near': {'at': [13, 28], 'rows': ['pp']},
        'blush_far': {'at': [24, 28], 'rows': ['pp']},
    },
    'focused': {
        '_doc': 'front Focused: flat lowered lids, the lower lids up, the irises on a target to screen-right (whites on '
                'the left), brows driven down to the nose, a pressed mouth',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......', 'OOOOOO.', '.OOOOO.', '..eaah.', '.Oebcc.', '.OO....']},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......', 'OOOOOO', 'OOOOO.', '.eaah.', '.ebcc.', '...OO.']},
        'brow_near': {'at': [13, 19], 'rows': ['#..', '.#.', '..#']},
        'brow_far': {'at': [23, 20], 'rows': ['..#', '##.']},
        'mouth': {'at': [18, 34], 'rows': ['mm']},
        'blush_near': None, 'blush_far': None,
    },
    'radiant': {
        '_doc': 'front Radiant: closed arcs peaked off-centre, soft raised brows, an open smile, a 3 px blush',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......', '.......', '...OO..', '..O..O.', '.O.....', '.......']},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......', '......', '.OO...', 'O..OO.', '.....O', '......']},
        'brow_near': {'at': [13, 19], 'rows': ['.#.', '#.#']},
        'brow_far': {'at': [23, 20], 'rows': ['###']},
        'mouth': {'at': [18, 33], 'rows': ['m..m', '.pp.']},
        'blush_near': {'at': [12, 28], 'rows': ['ppp']},
        'blush_far': {'at': [24, 28], 'rows': ['ppp']},
    },
    'serene': {
        '_doc': 'front Serene: the half-lid (2 iris rows), soft outer ends, level brows, a small closed smile',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......', '.......', '.OOOOO.', 'OOOOOO.', '..aahe.', '.Obcb..']},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......', '......', '.OOOO.', 'OOOOOO', '.aahe.', '.bcbO.']},
        'brow_near': {'at': [13, 20], 'rows': ['###']},
        'brow_far': {'at': [23, 20], 'rows': ['###']},
        'mouth': {'at': [18, 33], 'rows': ['m..', '.mm']},
    },
    'ignited': {
        '_doc': 'front Ignited: the Focused lids, an A2 core in an A4 rim, a 1 px A4 glow beside each eye, the brows pulled '
                'in, the q34 battle cry (the teeth row on the mouth line, the dark mouth, the lower lip)',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......', 'OOOOOO.', '.OOOOO.', '..ecah.', '.Oecac.', '.OO....']},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......', 'OOOOOO', 'OOOOO.', '.ecah.', '.ecac.', '...OO.']},
        'brow_near': {'at': [14, 19], 'rows': ['#..', '.#.', '..#']},
        'brow_far': {'at': [22, 19], 'rows': ['..#', '.#.', '#..']},
        'mouth': {'at': [18, 33], 'rows': ['www', 'OOO', '.m.']},
        'blush_near': None, 'blush_far': None,
        'extra': [{'at': [11, 24], 'rows': ['c']}, {'at': [27, 23], 'rows': ['c']}],
    },
    'hurt': {
        '_doc': 'front Hurt: > < squeezed eyes, inner brow ends up, a wince with one corner down',
        'eye_near': {'at': [11, 21], 'box': [1, 1, 5, 6], 'rows': [
            '.......', '.OO....', '...OO..', '.....O.', '...OO..', '.OO....']},
        'eye_far': {'at': [22, 21], 'box': [0, 1, 5, 6], 'rows': [
            '......', '....OO', '..OO..', '.O....', '..OO..', '....OO']},
        'brow_near': {'at': [13, 20], 'rows': ['..#', '##.']},
        'brow_far': {'at': [23, 20], 'rows': ['#..', '.##']},
        'mouth': {'at': [18, 33], 'rows': ['mm.', '..m']},
        'blush_near': None, 'blush_far': None,
    },
}


def front_spec():
    f = front_front()
    b = front_back()
    b.dots(FRONT_DEEP)
    return {
        '_doc': 'Round R3 painted head, front view, 144 px sprite; written by tools/art-construct/heads_r3.py (every '
                'stroke is in that file). Grid as q34 (chin y 36, centre line x 19), parting at x 22.',
        'view': 'front', 'gaze': [-1, 0], 'gaze_target': 'viewer', 'roll': 0, 'pupil': True,
        'rows': {'mouth': 2, 'nose': 6, 'eye_bottom': 10, 'lash_top': 14, 'brow': 16, 'hairline': 20,
                 'skull_top': 26, 'hair_top': 29},
        'anchors': {'c0': 19, 'chin': [19, 36], 'eye_near': [12, 22, 5, 6], 'eye_far': [22, 22, 5, 6]},
        'bangs': [{'root': [9, 12]}, {'root': [13, 17]}, {'root': [18, 21]}, {'root': [23, 26]}, {'root': [27, 30]}],
        'layers': {'back': b.rows(), 'skin': front_skin().rows(), 'front': f.rows()},
        'expressions': copy.deepcopy(FRONT_EXPR),
    }



# ================================================================================================ profile
# Profile facing screen-right. AnimeOutline's side-view rows (ao-side, FC-P23): nose tip about a quarter of the head
# above the chin (row 7, y 29), the bottom lip about an eighth (row 3), the eye set back from the front contour, the neck
# on an angle. R3 (critique 2c, 4a, 4b): the crown's flat 10 px top run is rounded (runs 4,2,2,1,1), the fringe stops
# above the brow (a window) and only the forward clumps hang in front of the forehead, the fringe casts a band, the back
# hair is two big clumps with a lit ridge instead of four parallel strands, the dashes taper along the flow.
PROFILE_DEEP = []
PROFILE_FRONT = {16: 24, 17: 25, 18: 25, 19: 26, 20: 26, 21: 25, 22: 25, 23: 25, 24: 25, 25: 26, 26: 26, 27: 27,
                 28: 27, 29: 29, 30: 28, 31: 26, 32: 26, 33: 27, 34: 26, 35: 26, 36: 24}
PROFILE_BACK = {**{y: 17 for y in range(16, 29)}, 29: 18, 30: 18, 31: 19, 32: 19, 33: 20, 34: 21, 35: 22, 36: 23}
# the fringe's lower edge per column: over the brow (x 18-22) it stops at y 17 (FC-P27); the forward clumps sweep down
# in front of the forehead, each tip on its own row (HR-P11)
PROFILE_FRINGE_EDGE = {17: 17, 18: 17, 19: 17, 20: 16, 21: 17, 22: 17, 23: 18, 24: 19, 25: 20, 26: 21, 27: 22, 28: 18}
PROFILE_LOCK_LEFT = {19: 12, 20: 12, 21: 12, 22: 11, 23: 11, 24: 11, 25: 12, 26: 12, 27: 12, 28: 13, 29: 13, 30: 13,
                     31: 12, 32: 12, 33: 12, 34: 11, 35: 11, 36: 11, 37: 12, 38: 12, 39: 12, 40: 12, 41: 12}


def profile_back():
    g = Grid()
    crown = {7: (12, 18), 8: (8, 21), 9: (6, 23), 10: (4, 25), 11: (3, 26), 12: (2, 26), 13: (2, 27), 14: (1, 27),
             15: (1, 27), 16: (1, 25)}
    g.spans(crown, 'l')
    g.spans({7: (15, 18), 8: (15, 21), 9: (17, 23), 10: (19, 25), 11: (21, 26), 12: (22, 26), 13: (23, 27), 14: (24, 27),
             15: (25, 27)}, 'k')
    g.spans({9: (6, 7), 10: (4, 6), 11: (3, 6), 12: (2, 5), 13: (2, 5), 14: (1, 4), 15: (1, 4), 16: (1, 4)}, 'n')
    # flow lines from the crown whorl at about (14, 8): back and down, and forward to the fringe
    for pts in ([(13, 9), (12, 10), (11, 11), (11, 12), (10, 13), (9, 14), (9, 15), (8, 16)],
                [(18, 9), (19, 10), (20, 11), (20, 12), (21, 13), (22, 14), (22, 15)]):
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            for xx, yy in A.line_px((x0, y0), (x1, y1)):
                cur = g.get(xx, yy)
                g.put(xx, yy, {'k': 'l', 'l': 'n', 'n': 'd'}.get(cur, cur))
    # the angel ring: one tapering dash per clump, on its own row (lower at the back, highest over the crown)
    g.dots([(8, 12, 'j'), (7, 12, 'j'), (6, 13, 'k')])
    g.dots([(14, 9, 'j'), (15, 9, 'j'), (16, 9, 'j'), (13, 10, 'k')])
    g.dots([(22, 10, 'j'), (23, 10, 'j'), (24, 11, 'k')])
    # the hair down the back: two big clumps. B1 (x1-5) in shadow; B2 (x5-10) carries a 2 px lit ridge that S-bends with
    # the fall; I4 only under the overlap and behind the sidelock (critique 4a)
    # the mass fills to the jaw and the neck (R2 stopped at x 17 and left a hole behind the jaw)
    neck_l = {37: 17, 38: 17, 39: 17, 40: 16, 41: 16, 42: 16, 43: 16, 44: 15, 45: 15}
    for y in range(17, 46):
        g.span(y, 1, (PROFILE_BACK[y] if y <= 36 else neck_l[y]) - 1, 'n')
    ridge = {y: PROFILE_LOCK_LEFT.get(y, 12) - 5 for y in range(19, 42)}
    ridge.update({17: 7, 18: 7, 42: 7, 43: 7})
    for y, x in ridge.items():
        g.span(y, x, x + 1, 'l')
    g.dots([(7, 17, 'k'), (7, 18, 'k'), (8, 19, 'k'), (8, 20, 'k'), (7, 21, 'k')])
    g.line([(4, 20), (4, 22), (3, 23), (3, 25), (4, 26), (4, 27)], 'd')
    g.line([(4, 35), (4, 37), (3, 38), (3, 40)], 'd')
    g.dots([(1, 43, 'd'), (2, 43, 'd'), (1, 44, 'd'), (2, 44, 'd'), (1, 45, 'd'), (2, 45, 'd')])
    # the lit break on the lit side: a clump at the front of the crown flicks up out of the dome (round d)
    g.dots([(26, 10, 'l'), (27, 10, 'k'), (27, 9, 'k'), (26, 9, 'l')])
    return g


def profile_skin():
    g = Grid()
    for y in range(16, 37):
        g.span(y, PROFILE_BACK[y], PROFILE_FRONT[y], 's')
    g.dots([(28, 29, '1'), (27, 29, '1')])                                    # the lit nose tip
    g.dots([(26, 30, 't'), (27, 30, 't')])                                    # under the nose tip
    # the fringe's cast shadow: a band under the fringe over the brow, then stepping down under the forward clumps
    g.spans({18: (17, 22), 19: (23, 23), 20: (24, 24), 21: (25, 25)}, 't')
    g.dots([(22, 19, 't'), (23, 20, 't'), (24, 21, 't')])
    g.dots([(19, 31, 't'), (19, 32, 't'), (20, 32, 't')])                    # the jaw corner turning away
    neck = {37: (17, 23), 38: (17, 22), 39: (17, 22), 40: (16, 22), 41: (16, 21), 42: (16, 21), 43: (16, 21),
            44: (15, 21), 45: (15, 20)}
    g.spans(neck, 's')
    g.spans({37: (19, 23), 38: (20, 22)}, 'm')
    g.spans({y: (v[0], v[0]) for y, v in neck.items()}, 't')
    return g


def profile_front():
    g = Grid()
    for x, ye in PROFILE_FRINGE_EDGE.items():
        for y in range(16, ye + 1):
            g.put(x, y, 'l')
    g.spans({16: (21, 26), 17: (24, 27)}, 'k')
    g.dots([(28, 17, 'k'), (28, 18, 'k')])
    # the undersides and tips of the forward clumps in I3; separators I4, bent
    # (the forward tip at (27, 22) faces the key light: I2, not I3; in I3 it stuck out as a dark twig, HR-N05)
    g.dots([(17, 16, 'n'), (17, 17, 'n'), (23, 18, 'n'), (24, 19, 'n'), (25, 20, 'n'), (26, 21, 'n'), (27, 22, 'l'),
            (19, 17, 'n')])
    g.dots([(20, 16, 'd'), (21, 17, 'd'), (25, 16, 'd'), (25, 17, 'd')])
    # the sidelock hides the ear: an S-curved ribbon from the temple to the collarbone
    PROFILE_DEEP.clear()
    for y, x in PROFILE_LOCK_LEFT.items():
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
        '_doc': 'profile Confident (R3): the eye 4 px wide, set back from the contour (FC-P23), the lash = a flick sweeping '
                'back + 1 row, 3 full iris rows looking ahead with the catchlight on the top row at the front edge, the '
                'lower lid lifted; the brow in its window under the fringe band; the smile curls up at the back of the '
                'mouth',
        'gaze': [1, 0], 'gaze_target': 'ahead',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            'O.....',
            '.OOOO.',
            '.Oaah.',
            '..anb.',
            '..bbb.',
            '.OOcc.',
        ]},
        'brow_near': {'at': [19, 19], 'rows': ['###']},
        'mouth': {'at': [23, 33], 'rows': ['m..', '.mm']},
        'blush_near': {'at': [21, 28], 'rows': ['pp']},
    },
    'focused': {
        '_doc': 'profile Focused: the lid flat and lowered, the lower lid up, the brow driven down at the front, a pressed '
                'mouth',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......', 'OOOOO.', '.OOOOO', '..aah.', '.Obcc.', '.OO...']},
        'brow_near': {'at': [19, 19], 'rows': ['##.', '..#']},
        'mouth': {'at': [24, 33], 'rows': ['m.', '.m']},
        'blush_near': None,
    },
    'radiant': {
        '_doc': 'profile Radiant: the eye closed into an arc that curves up, the brow raised, an open smile, a 3 px blush',
        'gaze': [1, 0], 'gaze_target': 'ahead',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......', '......', '...OO.', '.OO..O', 'O.....', '......']},
        'brow_near': {'at': [19, 19], 'rows': ['.#.', '#.#']},
        'mouth': {'at': [23, 33], 'rows': ['m..', '.pm']},
        'blush_near': {'at': [20, 28], 'rows': ['ppp']},
    },
    'serene': {
        '_doc': 'profile Serene: the half-lid, the lash end soft, a level brow, a small closed smile, eyes on the blade',
        'gaze': [1, 1], 'gaze_target': 'blade',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......', '......', '.OOOO.', 'OOOOOO', '..aah.', '..bcb.']},
        'brow_near': {'at': [19, 20], 'rows': ['###']},
        'mouth': {'at': [24, 33], 'rows': ['m.', '.m']},
    },
    'ignited': {
        '_doc': 'profile Ignited: the Focused lid, an A2 core in an A4 rim, a glow behind the eye, the battle cry seen from '
                'the side (the teeth on the mouth line over the dark mouth; 2 x 2 so it stays in the FC-P23 mouth rows)',
        'gaze': [1, 0], 'gaze_target': 'enemy',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......', 'OOOOO.', '.OOOOO', '..cah.', '.Ocac.', '.OO...']},
        'brow_near': {'at': [20, 19], 'rows': ['#..', '.##']},
        'mouth': {'at': [24, 33], 'rows': ['ww', 'OO']},
        'blush_near': None,
        'extra': [{'at': [17, 23], 'rows': ['c']}],
    },
    'hurt': {
        '_doc': 'profile Hurt: the eye squeezed into a > pointing forward, the brow lifted at the front, a wince',
        'eye_near': {'at': [17, 21], 'box': [1, 1, 4, 6], 'rows': [
            '......', '.OO...', '...OO.', '.....O', '...OO.', '.OO...']},
        'brow_near': {'at': [19, 19], 'rows': ['..#', '##.']},
        'mouth': {'at': [24, 33], 'rows': ['.m', 'm.']},
        'blush_near': None,
    },
}


def profile_spec():
    f = profile_front()
    b = profile_back()
    b.dots(PROFILE_DEEP)
    return {
        '_doc': 'Round R3 painted head, profile facing screen-right, 144 px sprite; written by tools/art-construct/heads_r3.py '
                '(every stroke is in that file). Grid as q34 (chin y 36).',
        'view': 'profile', 'gaze': [1, 0], 'gaze_target': 'ahead', 'roll': 0, 'pupil': True,
        'rows': {'mouth': 2, 'nose': 6, 'eye_bottom': 10, 'lash_top': 14, 'brow': 16, 'hairline': 20,
                 'skull_top': 26, 'hair_top': 29},
        'anchors': {'c0': 25, 'chin': [23, 36], 'eye_near': [18, 22, 4, 6]},
        'layers': {'back': b.rows(), 'skin': profile_skin().rows(), 'front': f.rows()},
        'expressions': copy.deepcopy(PROFILE_EXPR),
    }


if __name__ == '__main__':
    write('q34', q34())
    write('front', front_spec())
    write('profile', profile_spec())
