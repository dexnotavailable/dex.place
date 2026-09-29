"""Writes the face lane's F2 glyph library and expression specs (art/rosace/construct/faces/f2/).

One eye model per view angle (critique F1 2h): q34 near / q34 far / front / profile, each with fixed
iris rows (4 on the open eye) and a 1 px lash plus a 2 px outer flick (critique 2a). The expressions
change the lids and the mouth on that model, never the eye's size.

  python tools/art-construct/face_f2_lib.py

Glyph characters (face_f2.GKEY): O OL, a A2, b A3, c A4, h A5, w W1, e W2, n I3, s S2, t S3, m S4,
p SB, l S3 (lower lid), r I3 (brow, the dark hair tone), 1 S1, k S2 over hair, '.' leave the render.
Authored facing screen-right (the near eye's outer corner is its LEFT end, the far eye's its RIGHT end);
mirrored for screen-left. Gaze at the viewer from a head turned screen-right: both irises sit left in
their boxes, both whites right, the catchlight on the top iris row one column right of the pupil (FC-P11,
FC-P12), the same offset in both eyes.
"""
import json
from pathlib import Path

L = Path(__file__).resolve().parents[2] / 'art' / 'rosace' / 'construct' / 'faces' / 'f2'
DOC = ("Face lane F2 glyph library (tools/art-construct/face_f2.py; written by face_f2_lib.py). Authored "
       "pixels, facing screen-right (mirrored for screen-left). 'origin' = [col, row] that lands on the "
       "construction point: eyes on the projected iris centre, brows/blush at dx/dy from their eye's origin "
       "(blush dy counts rows under the eye's bottom row), nose on the nose tip, mouth on the mouth row. "
       "O OL, a A2, b A3, c A4, h A5, w W1, e W2, n I3, t S3, l S3 lower lid, m S4, p SB, r I3 brow, "
       "1 S1, k S2 over hair.")

# ---------------------------------------------------------------- 144 px
# The open eye (q34 near): 5 px body + the flick, 4 iris rows (A2 top, A2 + I3 pupil, A3, A4 bottom),
# the catchlight A5 where the iris meets the white, one W2 white column, the inner corner dipping 1 px
# (the almond), a 2 px S3 lower lid under the outer half.
EYES144 = {
    # ---- q34, open (confident). Round F2 trial (review/rosace/art/face/round-2/_scratch/t2-t4): the
    # 'diag' lash (1 px + a 2 px flick rising diagonally from the outer end) beat thin / heavy / sweep /
    # taper at x10, x3 and 1x; the dark iris (A2 over 3 rows, A3/A4 only at the bottom) beat R3's pale
    # A3/A4 half, which read doll-like; the lower lid as one S3 px at the outer bottom corner beat a 2 px
    # S3 row under the iris, which read as bags
    "near_open": {"origin": [3, 4], "rows": [
        "O......",
        ".O.....",
        "..OOOOO",
        "..aaheO",
        "..anae.",
        "..abb..",
        ".lbcc.."]},
    # the smirk side: the lower lid pushed up 1 px (the cheek rising, FC-P24)
    "near_open_lift": {"origin": [3, 4], "rows": [
        "O......",
        ".O.....",
        "..OOOOO",
        "..aaheO",
        "..anae.",
        ".labb..",
        "..lcc.."]},
    # trial controls: the thin lash with a 1 px flick, and R3/F1's 2 px flick over the lash
    "near_open_thin": {"origin": [2, 3], "rows": [
        "O.....",
        ".OOOOO",
        ".aaheO",
        ".anae.",
        ".abb..",
        "lbcc.."]},
    "near_open_heavy": {"origin": [2, 3], "rows": [
        "OO....",
        "OOOOOO",
        ".aaheO",
        ".anae.",
        ".abb..",
        "lbcc.."]},
    "near_open_pale": {"origin": [3, 4], "rows": [
        "O......",
        ".O.....",
        "..OOOOO",
        "..aaheO",
        "..anbe.",
        "..bbb..",
        "..ccc..",
        "..ll..."]},
    "far_open": {"origin": [1, 4], "rows": [
        ".....O",
        "....O.",
        "OOOO..",
        "aahe..",
        "anae..",
        "abb...",
        "bcc.l."]},
    "far_open_lift": {"origin": [1, 4], "rows": [
        ".....O",
        "....O.",
        "OOOO..",
        "aahe..",
        "anae..",
        "abbl..",
        "bcl..."]},
    # strong turn (yaw >= 40): the far eye 3 px against the contour, same rows
    "far_open_s": {"origin": [1, 4], "rows": [
        "....O",
        "...O.",
        "OOO..",
        "ahe..",
        "nae..",
        "ab...",
        "bcl.."]},
    # ---- q34, focused (attacks): the open model with the lid lowered one row onto the iris and flat (the
    # flick straight out past the outer corner), the inner end dipping toward the nose (intent), the
    # lower lid raised; the same columns, pupil and catchlight offset as the open eye (critique F1 2h)
    "near_focused": {"origin": [3, 2], "rows": [
        ".OOOOO.",
        "..aahOO",
        "..anbe.",
        ".llcc.."]},
    "far_focused": {"origin": [1, 2], "rows": [
        "OOOOO",
        "Oahe.",
        "anbe.",
        "ccl.."]},
    "far_focused_s": {"origin": [1, 2], "rows": [
        "OOOO",
        "aah.",
        "anb.",
        "cl.."]},
    # ---- smile (Q, wins): closed arcs curving up (^), the outer end flicked
    "near_smile": {"origin": [2, 1], "rows": [
        "..OO.",
        ".O..O",
        "O...."]},
    "far_smile": {"origin": [1, 1], "rows": [
        ".OO.",
        "O..O",
        "....O"]},
    # an open smile: the crescent (lower lid pushed up 2 rows), iris still visible
    "near_smile_open": {"origin": [2, 3], "rows": [
        "O.....",
        ".OOOOO",
        ".aaheO",
        ".anbe.",
        ".lll.."]},
    "far_smile_open": {"origin": [1, 3], "rows": [
        "....O",
        "OOOO.",
        "aahe.",
        "anbe.",
        ".lll."]},
    # ---- hurt: squeezed > < pointing at the nose
    "near_hurt": {"origin": [2, 1], "rows": ["OO...", "..OOO", "OO..."]},
    "far_hurt": {"origin": [1, 1], "rows": ["..OO", "OO..", "..OO"]},
    # ---- serene (prayer beats; the only half-lid): lash lowered onto the iris, the outer end soft (down)
    "near_serene": {"origin": [2, 3], "rows": [
        "......",
        "......",
        ".OOOOO",
        "OanbeO",
        ".ccc..",
        ".ll..."]},
    "far_serene": {"origin": [1, 3], "rows": [
        ".....",
        ".....",
        "OOOO.",
        "anbeO",
        "ccc..",
        "..ll."]},
    # ---- ignited (R): the focused lids, a dark A2 core inside an A4 rim
    "near_ignited": {"origin": [2, 2], "rows": [
        "OOOOO.",
        ".caaOO",
        "cahac.",
        ".ccc..",
        ".ll..."]},
    "far_ignited": {"origin": [1, 2], "rows": [
        ".OOOO",
        "OOcac",
        ".ahc.",
        "ccc..",
        "..ll."]},
    # ---- closed (blinks, motion in-betweens): a lash line curving down, the outer end longer
    "near_closed": {"origin": [2, 0], "rows": ["O....", ".OOOO"]},
    "far_closed": {"origin": [1, 0], "rows": ["...O", "OOO."]},
    # ---- front (both eyes 5 px): the far eye is the near eye's SHAPE mirrored (flick, dip and lid at its
    # own outer corner) but the iris, pupil, catchlight and white are NOT mirrored (FC-N02)
    "front_far_open": {"origin": [2, 4], "rows": [
        "......O",
        ".....O.",
        "OOOOO..",
        "Oaahe..",
        ".anae..",
        ".abb...",
        ".bcc.l."]},
    "front_far_smile": {"origin": [2, 1], "rows": [".OO..", "O..O.", "....O"]},
    # ---- profile: one eye, a 2-3 px wedge set back from the contour, the iris visible, the flick sweeping
    # back (the eye's outer corner = its left end in a facing-right glyph)
    "profile_open": {"origin": [2, 3], "rows": [
        "O....",
        ".O...",
        "..OOO",
        "..aah",
        "..an.",
        "..ab.",
        ".lcc."]},
    "profile_focused": {"origin": [2, 2], "rows": [
        ".OOOO",
        "..aah",
        "..an.",
        ".lcc."]},
    "profile_smile": {"origin": [1, 1], "rows": [".OO.", "O..O", "...."]},
    "profile_hurt": {"origin": [1, 1], "rows": ["OO.", "..O", "OO."]},
    "profile_closed": {"origin": [1, 0], "rows": ["O...", ".OOO"]},
    "profile_serene": {"origin": [1, 2], "rows": ["....", ".OOO", "Oanb", ".cc."]},
    "profile_ignited": {"origin": [1, 1], "rows": ["OOOO", ".cah", ".cc.", ".l.."]},
}

BROWS144 = {
    # 1 px lines, 3 px long, in the dark hair tone (I3), angled; placed only where a fringe gap shows skin
    "near_confident": {"origin": [1, 1], "dx": 0, "dy": -6, "rows": ["r..", ".rr"]},
    "far_confident": {"origin": [1, 1], "dx": 0, "dy": -6, "rows": ["..r", "rr."]},
    "near_focused": {"origin": [1, 1], "dx": 0, "dy": -4, "rows": ["rr.", "..r"]},
    "far_focused": {"origin": [1, 1], "dx": 0, "dy": -4, "rows": ["r..", ".rr"]},
    "near_smile": {"origin": [1, 0], "dx": 0, "dy": -5, "rows": [".r.", "r.r"]},
    "far_smile": {"origin": [1, 0], "dx": 0, "dy": -5, "rows": [".r.", "r.r"]},
    "near_hurt": {"origin": [1, 1], "dx": 0, "dy": -5, "rows": ["..r", "rr."]},
    "far_hurt": {"origin": [1, 1], "dx": 0, "dy": -5, "rows": ["r..", ".rr"]},
    "near_serene": {"origin": [1, 0], "dx": 0, "dy": -5, "rows": ["rrr"]},
    "far_serene": {"origin": [0, 0], "dx": 0, "dy": -5, "rows": ["rr"]},
    "profile": {"origin": [1, 0], "dx": 0, "dy": -5, "rows": ["rrr"]},
    "profile_focused": {"origin": [1, 1], "dx": 0, "dy": -4, "rows": ["rr.", "..r"]},
}

BLUSH144 = {
    # a 3-4 px horizontal strip in SB, broken at the outer end (critique 2e); dy rows under the eye bottom
    "soft_near": {"origin": [0, 0], "dx": -2, "dy": 1, "rows": ["ppp"]},
    "soft_far": {"origin": [0, 0], "dx": 0, "dy": 1, "rows": ["ppp"]},
    "broken_near": {"origin": [0, 0], "dx": -2, "dy": 1, "rows": ["p.pp"]},
    "broken_far": {"origin": [0, 0], "dx": 0, "dy": 1, "rows": ["pp.p"]},
    "strip_near": {"origin": [0, 0], "dx": -2, "dy": 1, "rows": ["ppp"]},
    "strip_far": {"origin": [0, 0], "dx": 0, "dy": 1, "rows": ["ppp"]},
    "wide_near": {"origin": [0, 0], "dx": -2, "dy": 1, "rows": ["pppp"]},
    "wide_far": {"origin": [0, 0], "dx": -1, "dy": 1, "rows": ["pppp"]},
    "dither_near": {"origin": [0, 0], "dx": -2, "dy": 1, "rows": [".ppp", "p..."]},
    "dither_far": {"origin": [0, 0], "dx": 0, "dy": 1, "rows": ["ppp.", "...p"]},
}

MOUTHS144 = {
    # at most 4 px of S4; a smirk bends up on one side (critique 2c, 3)
    "smirk_far": {"origin": [1, 1], "rows": ["...m", "mmm."]},
    "smirk_near": {"origin": [2, 1], "rows": ["m...", ".mmm"]},
    "smirk_far3": {"origin": [1, 1], "rows": ["..m", "mm."]},
    "u4": {"origin": [2, 1], "rows": ["m..m", ".mm."]},
    "u3": {"origin": [1, 1], "rows": ["m.m", ".m."]},
    "focused": {"origin": [1, 0], "rows": ["mm"]},
    "focused3": {"origin": [1, 0], "rows": ["mmm"]},
    "open_small": {"origin": [1, 0], "rows": ["mm", "pp"]},
    "shout": {"origin": [1, 1], "rows": ["ww", "OO", "mm"]},
    "smile": {"origin": [2, 1], "rows": ["m..m", ".pp."]},
    "smile_closed": {"origin": [2, 1], "rows": ["m..m", ".mm."]},
    "hurt": {"origin": [1, 0], "rows": ["mm.", "..m"]},
    "closed": {"origin": [0, 0], "rows": ["mm"]},
    "serene": {"origin": [1, 1], "rows": ["..m", "mm."]},
    "profile": {"origin": [0, 0], "rows": ["m"]},
    "profile_open": {"origin": [0, 0], "rows": ["m", "p"]},
}

NOSES144 = {"q34": {"origin": [0, 0], "rows": ["t"]}, "front": {"origin": [0, 0], "rows": ["t"]}}

# ---------------------------------------------------------------- 80 px (the world height)
# ref 05's ~14 px heads: a dark 2-3 px eye mass with one catchlight, no brows on the fringe, a 1-2 px mouth
EYES80 = {
    "near_open": {"origin": [1, 1], "rows": ["OOO", "ah.", "bc."]},
    "near_open_flick": {"origin": [1, 1], "rows": ["O...", ".OOO", ".ah.", ".bc."]},
    "near_open_dark": {"origin": [1, 1], "rows": ["OOO", "ah.", "ab."]},
    "far_open": {"origin": [0, 1], "rows": ["OO", "ah", "b."]},
    "far_open_flick": {"origin": [0, 1], "rows": ["..O", "OO.", "ah.", "b.."]},
    "near_focused": {"origin": [1, 1], "rows": ["OOO", "ah."]},
    "far_focused": {"origin": [0, 1], "rows": ["OO", "ah"]},
    # round F2: at 80 a 3 px caret over the fringe's dark px read as an X; flat 2 px closed lids under the
    # blush read as a happy closed-eye smile at x3 and 1x (t8 trial, q_stamp and idle)
    "near_smile": {"origin": [1, 0], "rows": ["OO"]},
    "far_smile": {"origin": [0, 0], "rows": ["OO"]},
    "near_smile_caret": {"origin": [1, 0], "rows": [".O.", "O.O"]},
    "far_smile_caret": {"origin": [0, 0], "rows": [".O", "O."]},
    "near_hurt": {"origin": [0, 1], "rows": ["O.", ".O", "O."]},
    "far_hurt": {"origin": [1, 1], "rows": [".O", "O.", ".O"]},
    "near_closed": {"origin": [1, 0], "rows": ["OOO"]},
    "far_closed": {"origin": [0, 0], "rows": ["OO"]},
    "near_serene": {"origin": [1, 1], "rows": ["...", "OOO", "ah."]},
    "far_serene": {"origin": [0, 1], "rows": ["..", "OO", "ah"]},
    "near_ignited": {"origin": [1, 1], "rows": ["OOO", "cac"]},
    "far_ignited": {"origin": [0, 1], "rows": ["OO", "ca"]},
    "front_far_open": {"origin": [1, 1], "rows": ["OOO", "ah.", "bc."]},
    "front_far_smile": {"origin": [0, 0], "rows": ["OO"]},
    "profile_open": {"origin": [1, 1], "rows": ["OO", "ah", "b."]},
    "profile_focused": {"origin": [1, 1], "rows": ["OO", "ah"]},
    "profile_smile": {"origin": [1, 0], "rows": [".O", "O."]},
    "profile_hurt": {"origin": [0, 1], "rows": ["O.", ".O", "O."]},
    "profile_closed": {"origin": [1, 0], "rows": ["OO"]},
    "profile_serene": {"origin": [1, 1], "rows": ["..", "OO", "ah"]},
    "profile_ignited": {"origin": [1, 1], "rows": ["OO", "ca"]},
}
BROWS80 = {}
BLUSH80 = {"soft_near": {"origin": [0, 0], "dx": -1, "dy": 1, "rows": ["p"]},
           "soft_far": {"origin": [0, 0], "dx": 1, "dy": 1, "rows": ["p"]},
           "strip_near": {"origin": [0, 0], "dx": -1, "dy": 1, "rows": ["pp"]},
           "strip_far": {"origin": [0, 0], "dx": 0, "dy": 1, "rows": ["pp"]}}
MOUTHS80 = {
    "smirk_far": {"origin": [0, 0], "rows": ["m.", ".m"][::-1]},
    "smirk2": {"origin": [0, 0], "rows": [".m", "m."]},
    "u3": {"origin": [1, 0], "rows": ["m.m", ".m."]},
    "dot": {"origin": [0, 0], "rows": ["m"]},
    "flat2": {"origin": [0, 0], "rows": ["mm"]},
    "focused": {"origin": [0, 0], "rows": ["mm"]},
    "smile": {"origin": [1, 0], "rows": ["m.m", ".p."]},
    "smile2": {"origin": [0, 0], "rows": ["mm"]},
    "hurt": {"origin": [0, 0], "rows": ["m.", ".m"]},
    "closed": {"origin": [0, 0], "rows": ["m"]},
    "serene": {"origin": [0, 0], "rows": ["m"]},
    "shout": {"origin": [0, 0], "rows": ["m", "O"]},
    "profile": {"origin": [0, 0], "rows": ["m"]},
}

# ---------------------------------------------------------------- round F2b (144): the F1 critique's eye, again
# The second pass of round 2 (review/rosace/art/face/round-2/_scratch/g/t1-t2, idle x8 / x3 / 1x beside ref 08):
# ONE eye template per view, 5 iris rows under a lash that is a wedge (2 rows at the outer corner, a 2 px flick
# rising diagonally from it over 2 rows (F2's 'diag', kept: t7), 1 row toward the inner corner), the iris ramp A2 top -> A3 -> A4 bottom, the main catchlight
# 2 px tall at the iris's top inner side plus a 1 px secondary at its bottom outer corner (the same side in both
# eyes), one S3 lower-lid px at the outer bottom corner. The far eye is 1 px narrower, the same height.
# Every open expression is this template with other lids (focused: the lash one row lower and flat, 4 iris rows,
# so the iris height stays within 1 px across frames: FC-P31). Whites: 2 rows in one column (FC-P22).
EYES144.update({
    "near_open": {"origin": [3, 4], "rows": [
        "O......",
        "OO.....",
        ".OOOOOO",
        ".Oaahe.",
        "..anhe.",
        "..abb..",
        "..bbb..",
        ".lhcc.."]},
    "near_open_lift": {"origin": [3, 4], "rows": [
        "O......",
        "OO.....",
        ".OOOOOO",
        ".Oaahe.",
        "..anhe.",
        "..abb..",
        ".lbbb..",
        "..hcc.."]},
    "far_open": {"origin": [1, 4], "rows": [
        ".....O",
        "....OO",
        "OOOOO.",
        "aaheO.",
        "anhe..",
        "abb...",
        "bbb...",
        "hccl.."]},
    "far_open_lift": {"origin": [1, 4], "rows": [
        ".....O",
        "....OO",
        "OOOOO.",
        "aaheO.",
        "anhe..",
        "abb...",
        "bbbl..",
        "hcc..."]},
    "far_open_s": {"origin": [0, 4], "rows": [
        "....O",
        "...OO",
        "OOOO.",
        "aheO.",
        "nhe..",
        "bb...",
        "bb...",
        "hcl.."]},
    # focused: the open eye's lash row, flattened (the flick straight out past the outer corner, the inner end
    # dipping 1 px), the lower lid raised 1 row: 4 iris rows, the pupil and catchlights where the open eye has them
    "near_focused": {"origin": [3, 2], "rows": [
        "OOOOOO.",
        ".OaaheO",
        "..anhe.",
        "..abb..",
        ".lhcc.."]},
    "far_focused": {"origin": [1, 2], "rows": [
        "OOOOOO",
        "aaheO.",
        "anhe..",
        "abb...",
        "hccl.."]},
    "far_focused_s": {"origin": [0, 2], "rows": [
        "OOOOO",
        "aheO.",
        "nhe..",
        "bb...",
        "hcl.."]},
    "front_far_open": {"origin": [2, 4], "rows": [
        "......O",
        ".....OO",
        "OOOOOO.",
        ".aaheO.",
        ".anhe..",
        ".abb...",
        ".bbb...",
        ".hccl.."]},
    "profile_open": {"origin": [3, 4], "rows": [
        "O....",
        "OO...",
        ".OOOO",
        ".Oaah",
        "..anh",
        "..ab.",
        "..bb.",
        ".lhc."]},
    "profile_focused": {"origin": [3, 2], "rows": [
        "OOOOO",
        ".Oaah",
        "..anh",
        "..bb.",
        ".lhc."]},
})
# the F1 critique's mouth: 2-3 px, one corner raised 1 px, that corner in the warm SB (rose, not brown)
MOUTHS144.update({
    "rose3": {"origin": [1, 1], "rows": ["..p", "mm."]},
    "rose3_near": {"origin": [1, 1], "rows": ["p..", ".mm"]},
    "rose2": {"origin": [0, 0], "rows": ["mm"]},
})

# ---------------------------------------------------------------- round F2b (80): brows and a mouth that read
# (critique F1: N1 at 80 read vacant; nose + mouth <= 2 px at 80). Brows are 1 row OL strokes over the fringe
# (brow_over), 2 rows above the lash; the focused near eye keeps a 2-row iris so N1's gaze shows.
BROWS80.update({
    "near_confident": {"origin": [1, 0], "dx": 0, "dy": -3, "rows": ["rr"]},
    "far_confident": {"origin": [0, 0], "dx": 0, "dy": -3, "rows": ["rr"]},
    "near_focused": {"origin": [1, 0], "dx": 0, "dy": -2, "rows": ["rr"]},
    "far_focused": {"origin": [0, 0], "dx": 0, "dy": -2, "rows": ["rr"]},
    "near_focused_slant": {"origin": [1, 0], "dx": 0, "dy": -2, "rows": ["r.", ".r"]},
    "far_focused_slant": {"origin": [0, 0], "dx": 0, "dy": -2, "rows": [".r", "r."]},
})
EYES80.update({"near_focused_t": {"origin": [1, 1], "rows": ["OOO", "ah.", "b.."]}})
MOUTHS80.update({"rose1": {"origin": [0, 0], "rows": ["p"]}})

EXPRS = ("confident", "focused", "smile", "serene", "ignited", "hurt", "closed")


def spec(facing, expr, px, **kw):
    d = {"_doc": f"F2 {facing} {expr} at {px} px: glyph names from lib_{px}.json; params tune the placement "
                 "(face_f2.py). Written by face_f2_lib.py.",
         "facing": facing, "expr": expr, "px": px}
    d.update(kw)
    (L / f'{facing}_{expr}_{px}.json').write_text(json.dumps(d, indent=1), encoding='utf-8')


def main():
    L.mkdir(parents=True, exist_ok=True)
    for px, lib in ((144, dict(eyes=EYES144, brows=BROWS144, blush=BLUSH144, noses=NOSES144, mouths=MOUTHS144)),
                    (80, dict(eyes=EYES80, brows=BROWS80, blush=BLUSH80, noses={}, mouths=MOUTHS80))):
        out = {"_doc": DOC, "px": px}
        out.update(lib)
        (L / f'lib_{px}.json').write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding='utf-8')
    for px in (144, 80):
        big = px == 144
        P = {"edge_keep": 2, "strand_max": 3, "gap": None if big else 1, "chin_len": 2 if big else 1,
             "chin_far": 1 if big else 0, "chin_w": [1, 1] if big else [0, 1], "taper": big, "jaw_min": 1,
             "chin_contact": "S3",
             "lash_gap": 0, "jaw_pow": 1.6,
             # round F2b: the lash clipped at the face mask + 1 px; three skin tones (S3 shadow-side jaw, S1 lit
             # cheekbone under the near eye's inner half)
             "lash_clip": 1, "form": big, "form_lit": [2, 1] if big else [0, 0]}
        if big:
            # one brow style in every 144 expression (critique F1 2h: the same girl across frames): OL over the fringe
            P.update(brow_over=True, brow_ch="O")
        for facing in ("q34", "front"):
            fr = facing == "front"
            far_open = "front_far_open" if fr else "far_open"
            # round F2 pick (WF-P11, idle x4 and x3 beside 07/08): the smirk bent up on the far side with that
            # eye's lower lid lifted 1 px (Faigin's cheek rising) beat the U, the near smirk and the plain lid
            conf_p = dict(P, smirk_side="far", smirk_lift=1) if (big and not fr) else dict(P)
            if big:
                # round F2b pick (WF-P11, idle x6 / x3 beside ref 08): brows over the fringe in OL beat I4 (invisible
                # on the I2 fringe) and none; the 3 px S4 smirk beat the SB-cornered rose3 (a dot pair at x6) and 4 px
                conf_p = dict(conf_p, brow_over=True, brow_ch="O")
            spec(facing, "confident", px, eye_near="near_open",
                 eye_far=("far_open_lift" if (big and not fr) else far_open),
                 eye_far_strong="far_open_s" if big else None,
                 brow_near="near_confident" if big else None, brow_far="far_confident" if big else None,
                 blush="soft", mouth="smirk_far3" if big else "dot", nose=("front" if fr else "q34") if big else None,
                 gaze="viewer", params=conf_p)
            # round F2b (N1 x8): the full far eye at the 57 deg turn beat the 4 px strong-turn eye (FC-P04 far/near 0.57)
            spec(facing, "focused", px, eye_near="near_focused" if big else "near_focused_t", eye_far="far_focused",
                 eye_far_strong=None,
                 brow_near="near_focused", brow_far="far_focused",
                 mouth="rose2" if big else "dot", nose=("front" if fr else "q34") if big else None,
                 gaze="target (the way she faces)",
                 # round F2b: the focused brows go over the fringe in OL (N1 read vacant without them)
                 params=dict(P, brow_over=True, brow_ch="O"))
            spec(facing, "smile", px, eye_near="near_smile", eye_far="front_far_smile" if fr else "far_smile",
                 brow_near="near_smile" if big else None, brow_far="far_smile" if big else None, blush="soft",
                 mouth="smile_closed" if big else "rose1", nose=("front" if fr else "q34") if big else None,
                 gaze="closed", params=dict(P))
            spec(facing, "serene", px, eye_near="near_serene", eye_far="far_serene",
                 brow_near="near_serene" if big else None, brow_far="far_serene" if big else None, blush="soft",
                 mouth="serene", nose=("front" if fr else "q34") if big else None, gaze="lowered (prayer)",
                 params=dict(P))
            spec(facing, "ignited", px, eye_near="near_ignited", eye_far="far_ignited",
                 brow_near="near_focused" if big else None, brow_far="far_focused" if big else None,
                 mouth="shout", nose=("front" if fr else "q34") if big else None,
                 gaze="target (the way she faces)", params=dict(P))
            spec(facing, "hurt", px, eye_near="near_hurt", eye_far="far_hurt",
                 brow_near="near_hurt" if big else None, brow_far="far_hurt" if big else None,
                 mouth="hurt", nose=("front" if fr else "q34") if big else None, gaze="closed", params=dict(P))
            spec(facing, "closed", px, eye_near="near_closed", eye_far="far_closed",
                 brow_near="near_confident" if big else None, brow_far="far_confident" if big else None,
                 blush="soft", mouth="closed", nose=("front" if fr else "q34") if big else None, gaze="closed",
                 params=dict(P))
        # profile: the eye set back from the projected iris (FC-P23: its front 2 px behind the front contour;
        # the MMD eye projects onto the silhouette at 90 deg), near_dx < 0 = toward the back of the head
        PP = {"edge_keep": 1, "strand_max": 3, "jaw": False, "taper": big, "lash_gap": 0, "lash_clip": 1,
              "near_dx": -2 if big else -1}
        pb = "profile" if big else None
        for expr, e, b, m in (("confident", "profile_open", pb, "profile"),
                              ("focused", "profile_focused", "profile_focused" if big else None, "profile"),
                              ("smile", "profile_smile", pb, "profile"),
                              ("serene", "profile_serene", pb, "profile"),
                              ("ignited", "profile_ignited", "profile_focused" if big else None,
                               "profile_open" if big else "profile"),
                              ("hurt", "profile_hurt", pb, "profile"),
                              ("closed", "profile_closed", pb, "profile")):
            pp = dict(PP, brow_over=True, brow_ch="O") if (big and b) else dict(PP)   # round F2b pick (N2 x6)
            spec("profile", expr, px, eye_near=e, brow_near=b, mouth=m, gaze="target", nose=None, params=pp)
    print('wrote', len(list(L.glob('*.json'))), 'files in', L)


if __name__ == '__main__':
    main()
