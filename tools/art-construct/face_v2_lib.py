"""Writes the face lane's v2 glyph library and expression specs (art/rosace/construct/faces/v2/).

The glyphs are authored here as data (one character per pixel, face_v2.GKEY), so every change is a
reviewable diff:  python tools/art-construct/face_v2_lib.py
"""
import json
from pathlib import Path

L = Path(__file__).resolve().parents[2] / 'art' / 'rosace' / 'construct' / 'faces' / 'v2'
DOC = ("Face lane v2 glyph library (tools/art-construct/face_v2.py; written by face_v2_lib.py). Authored "
       "pixels, facing screen-right (mirrored for screen-left). 'origin' = [col, row] that lands on the "
       "construction point: eyes on the projected iris centre, brows/blush at dx/dy from their eye's origin, "
       "nose on the nose tip, mouth on the mouth row. O OL, a A2, b A3, c A4, h A5, w W1, e W2, n I3, s S2, "
       "t S3, m S4, p SB, 1 S1, B brow (OL on hair, I3 on skin), k S2 over hair. Near eye outer corner = "
       "left, far eye outer corner = right.")

LIB144 = {
    "eyes": {
        # open, gaze at the viewer: both irises left in their boxes, whites right (FC-P11); the
        # catchlight one column right of the pupil on the top iris row in both eyes (FC-P12)
        "near_open": {"origin": [2, 3], "rows": ["OO....", ".OOOOO", ".aaheO", ".anbe.", ".Occ.."]},
        "near_tall": {"origin": [2, 3], "rows": ["OO....", ".OOOOO", ".aaheO", ".anbe.", ".bbb..", ".Occ.."]},
        "far_open": {"origin": [2, 3], "rows": [".....O", ".OOOO.", ".aah..", ".anbe.", ".cc..."]},
        "far_open_dip": {"origin": [2, 3], "rows": ["....O", ".OOOO", "Oaah.", ".anbe", ".cc.."]},
        # front: the far eye is the near eye's shape mirrored (flick and lower lash at ITS outer corner),
        # but the iris, pupil, catchlight and white are NOT mirrored (FC-N02): same gaze, same light
        "front_far_open": {"origin": [2, 3], "rows": ["....OO", "OOOOO.", "Oaahe.", ".anbe.", ".bbb..", "..ccO."]},
        "far_small": {"origin": [2, 3], "rows": ["....O", ".OOOO", "Oaah.", ".anb.", "..c.."]},
        # strong 3/4 (yaw >= 40): the far eye narrows to 3 px against the contour
        "far_open_s": {"origin": [1, 3], "rows": ["...O", ".OOO", "Oah.", ".nbe", ".c.."]},
        "far_focused_s": {"origin": [2, 2], "rows": [".OOO.", "OOOO.", "eaah.", ".anc."]},
        # R3's painted eyes unchanged (6 / 5 wide): the size control
        "near_r3": {"origin": [3, 3], "rows": ["OO.....", ".OOOOO.", ".OaaheO", "..anbe.", "..bbb..", ".OOcc.."]},
        "far_r3": {"origin": [2, 2], "rows": [".....O", ".OOOOO", "Oaah..", ".anbe.", ".ccbO."]},
        # focused: the lash a flat 2-row bar lowered 1 px, the lower lid up; eyes on the target
        "near_focused": {"origin": [3, 2], "rows": ["OOOOO.", ".OOOOO", ".eaah.", ".Obnc."]},
        "far_focused": {"origin": [2, 2], "rows": [".OOOO", "OOOOO", ".eah.", "..nc."]},
        # smile: closed arcs (radiant), or open with the lower lid pushed up (a crescent)
        "near_smile": {"origin": [2, 1], "rows": [".OOO.", "O...O"]},
        "far_smile": {"origin": [2, 1], "rows": [".OO.", "O..O"]},
        "near_smile_open": {"origin": [2, 3], "rows": ["OO....", ".OOOOO", ".aaheO", "..OOO."]},
        "far_smile_open": {"origin": [2, 3], "rows": ["....O", ".OOOO", "Oaah.", ".OOO."]},
        # hurt: squeezed > < pointing at the nose
        "near_hurt": {"origin": [2, 1], "rows": ["OO..", "..OO", "OO.."]},
        "far_hurt": {"origin": [1, 1], "rows": ["..OO", "OO..", "..OO"]},
        # serene (prayer beats; the only half-lid): the lash lowered onto the iris, the outer end soft (down)
        "near_serene": {"origin": [2, 3], "rows": [".OOOOO", "Oanbe.", "..cc.."]},
        "far_serene": {"origin": [2, 3], "rows": [".OOOO.", ".anbeO", ".cc..."]},
        # ignited (R): the focused lids, a dark A2 core inside an A4 rim, an A4 glow at the outer corner
        "near_ignited": {"origin": [3, 2], "rows": ["OOOOO.", ".OOOOO", "c.caah", "..Occc"]},
        "far_ignited": {"origin": [2, 2], "rows": [".OOOO.", "OOOOO.", ".cah.c", "..cc.."]},
        # closed (blink, motion in-betweens): a lash line curving down
        "near_closed": {"origin": [2, 0], "rows": ["O...O", ".OOO."]},
        "far_closed": {"origin": [2, 0], "rows": ["O..O", ".OO."]},
        # profile: one eye set back from the contour, the flick sweeping back
        "profile_open": {"origin": [2, 2], "rows": ["OO...", ".OOOO", "..aah", "..anb", "..cc."]},
        "profile_focused": {"origin": [2, 2], "rows": ["OOOO.", ".OOOO", "..eah", "...nc"]},
        "profile_smile": {"origin": [2, 1], "rows": [".OOO", "O..."]},
        "profile_hurt": {"origin": [1, 1], "rows": ["OO.", "..O", "OO."]},
        "profile_closed": {"origin": [2, 0], "rows": ["O..O", ".OO."]},
        "profile_serene": {"origin": [2, 1], "rows": [".OOOO", "O.anb", "..cc."]},
        "profile_ignited": {"origin": [2, 2], "rows": ["OOOO.", ".OOOO", "..cah", "...cc"]},
    },
    "brows": {
        "near_confident": {"origin": [1, 1], "dx": 0, "dy": -5, "rows": ["B..", ".BB"]},
        "far_confident": {"origin": [0, 0], "dx": 0, "dy": -5, "rows": ["BB"]},
        "near_focused": {"origin": [1, 1], "dx": 0, "dy": -4, "rows": ["BB.", "..B"]},
        "far_focused": {"origin": [1, 1], "dx": 0, "dy": -4, "rows": [".BB", "B.."]},
        "near_fierce": {"origin": [1, 1], "dx": 0, "dy": -3, "rows": ["BB..", "..BB"]},
        "far_fierce": {"origin": [1, 1], "dx": 0, "dy": -3, "rows": [".BB", "B.."]},
        "near_smile": {"origin": [1, 0], "dx": 0, "dy": -4, "rows": [".B.", "B.B"]},
        "near_smile_flat": {"origin": [1, 0], "dx": 0, "dy": -5, "rows": ["BBB"]},
        "far_smile_flat": {"origin": [0, 0], "dx": 0, "dy": -5, "rows": ["BB"]},
        "far_smile": {"origin": [0, 0], "dx": 0, "dy": -4, "rows": ["BB"]},
        "near_hurt": {"origin": [1, 1], "dx": 0, "dy": -4, "rows": ["..B", "BB."]},
        "far_hurt": {"origin": [1, 1], "dx": 0, "dy": -4, "rows": ["B..", ".BB"]},
        "profile": {"origin": [1, 0], "dx": 0, "dy": -4, "rows": ["BBB"]},
        "near_serene": {"origin": [1, 0], "dx": 0, "dy": -4, "rows": ["BBB"]},
        "far_serene": {"origin": [0, 0], "dx": 0, "dy": -4, "rows": ["BB"]},
        "profile_focused": {"origin": [1, 1], "dx": 0, "dy": -4, "rows": ["BB.", "..B"]},
    },
    "blush": {
        # blush: dx from the eye's origin column, dy in rows under the eye's bottom row (FC-P17: 1-2 rows)
        "soft_near": {"origin": [0, 0], "dx": -2, "dy": 1, "rows": ["pp"]},
        "soft_far": {"origin": [0, 0], "dx": 1, "dy": 1, "rows": ["pp"]},
        "low_near": {"origin": [0, 0], "dx": -2, "dy": 2, "rows": ["pp"]},
        "low_far": {"origin": [0, 0], "dx": 1, "dy": 2, "rows": ["pp"]},
    },
    "noses": {"q34": {"origin": [0, 1], "rows": ["t", "t"]}, "front": {"origin": [0, 0], "rows": ["t"]}},
    "mouths": {
        "confident": {"origin": [2, 1], "rows": ["tm..m", "..mm."]},
        "confident_small": {"origin": [1, 1], "rows": ["m..m", ".mm."]},
        "smirk": {"origin": [1, 1], "rows": ["...m", "mmm."]},
        "focused": {"origin": [1, 0], "rows": ["mm"]},
        "shout": {"origin": [1, 1], "rows": ["ww", "OO", "mm"]},
        "smile": {"origin": [1, 1], "rows": ["m..m", ".pp."]},
        "smile_closed": {"origin": [1, 1], "rows": ["m..m", ".mm."]},
        "hurt": {"origin": [1, 0], "rows": ["mm.", "..m"]},
        "closed": {"origin": [0, 0], "rows": ["mm"]},
        "profile": {"origin": [0, 0], "rows": ["mm"]},
        "serene": {"origin": [1, 1], "rows": ["..m", "mm."]},
    },
}

LIB80 = {
    "eyes": {
        "near_open": {"origin": [1, 2], "rows": ["O...", ".OOO", ".ah.", ".ab."]},
        "near_open_bright": {"origin": [1, 2], "rows": ["O...", ".OOO", ".ahe", ".bc."]},
        "far_open": {"origin": [0, 2], "rows": ["..O", "OO.", "ah.", "b.."]},
        "near_focused": {"origin": [2, 1], "rows": ["OOOO", ".eah"]},
        "far_focused": {"origin": [1, 1], "rows": ["OOO", "ah."]},
        "near_smile": {"origin": [1, 1], "rows": [".O.", "O.O"]},
        "far_smile": {"origin": [0, 1], "rows": [".O", "O."]},
        "near_hurt": {"origin": [0, 1], "rows": ["O.", ".O", "O."]},
        "far_hurt": {"origin": [1, 1], "rows": [".O", "O.", ".O"]},
        "near_closed": {"origin": [1, 0], "rows": ["O.O", ".O."]},
        "far_closed": {"origin": [0, 0], "rows": ["OO"]},
        "profile_open": {"origin": [1, 1], "rows": ["OO.", ".ah"]},
        "profile_focused": {"origin": [1, 1], "rows": ["OOO", ".ah"]},
        "profile_smile": {"origin": [1, 1], "rows": [".O", "O."]},
        "profile_hurt": {"origin": [0, 1], "rows": ["O.", ".O", "O."]},
        "profile_closed": {"origin": [1, 0], "rows": ["OO"]},
        "near_serene": {"origin": [1, 1], "rows": ["OOO", ".ah"]},
        "far_serene": {"origin": [0, 1], "rows": ["OO", "ah"]},
        "near_ignited": {"origin": [2, 1], "rows": ["OOOO", ".cac"]},
        "far_ignited": {"origin": [1, 1], "rows": ["OOO", "ca."]},
        "profile_serene": {"origin": [1, 1], "rows": ["OOO", ".ah"]},
        "profile_ignited": {"origin": [1, 1], "rows": ["OOO", ".ca"]},
    },
    "brows": {
        "near_confident": {"origin": [1, 0], "dx": 0, "dy": -3, "rows": ["BB"]},
        "far_confident": {"origin": [0, 0], "dx": 0, "dy": -3, "rows": ["B"]},
        "near_focused": {"origin": [1, 0], "dx": 0, "dy": -2, "rows": ["BB"]},
        "far_focused": {"origin": [0, 0], "dx": 0, "dy": -2, "rows": ["B"]},
    },
    "blush": {"soft_near": {"origin": [0, 0], "dx": -1, "dy": 1, "rows": ["p"]},
              "soft_far": {"origin": [0, 0], "dx": 1, "dy": 1, "rows": ["p"]}},
    "noses": {},
    "mouths": {
        "confident": {"origin": [1, 0], "rows": ["m.m", ".m."]},
        "confident_flat": {"origin": [1, 0], "rows": ["mm"]},
        "focused": {"origin": [0, 0], "rows": ["mm"]},
        "smile": {"origin": [1, 0], "rows": ["m.m", ".p."]},
        "hurt": {"origin": [0, 0], "rows": ["m.", ".m"]},
        "closed": {"origin": [0, 0], "rows": ["m"]},
        "profile": {"origin": [0, 0], "rows": ["m"]},
        "serene": {"origin": [0, 0], "rows": ["mm"]},
        "shout": {"origin": [0, 0], "rows": ["O"]},
    },
}

EXPRS = ("confident", "focused", "smile", "hurt", "closed")


def spec(facing, expr, px, **kw):
    d = {"_doc": f"{facing} {expr} at {px} px: glyph names from lib_{px}.json; params tune the placement "
                 "(face_v2.py). Written by face_v2_lib.py.",
         "facing": facing, "expr": expr, "px": px}
    d.update(kw)
    (L / f'{facing}_{expr}_{px}.json').write_text(json.dumps(d, indent=1), encoding='utf-8')


def main():
    L.mkdir(parents=True, exist_ok=True)
    for px, lib in ((144, LIB144), (80, LIB80)):
        out = {"_doc": DOC, "px": px}
        out.update(lib)
        (L / f'lib_{px}.json').write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding='utf-8')
    for px in (144, 80):
        big = px == 144
        base = dict(nose="q34" if big else None,
                    params={"edge_keep": 2, "strand_max": 3, "fringe_band": 2, "eye_dy": 0,
                            "gap": None if big else 1})

        def br(n):
            return n if (big or n.endswith(('confident', 'focused'))) else None
        for facing in ("q34", "front"):
            spec(facing, "confident", px, eye_near="near_tall" if big else "near_open",
                 eye_far=("front_far_open" if facing == "front" else "far_open") if big else "far_open",
                 eye_far_strong="far_open_s" if big else None, brow_near=br("near_confident") if big else None,
                 brow_far=br("far_confident") if big else None, blush="soft",
                 mouth="confident_small" if big else "confident", gaze="viewer", **base)
            spec(facing, "focused", px, eye_near="near_focused", eye_far="far_focused",
                 eye_far_strong="far_focused_s" if big else None, brow_near="near_fierce" if big else None,
                 brow_far="far_fierce" if big else None, mouth="focused", gaze="target (the way she faces)", **base)
            spec(facing, "smile", px, eye_near="near_smile", eye_far="far_smile", brow_near=br("near_smile_flat"),
                 brow_far=br("far_smile_flat"), blush="soft", mouth="smile", gaze="closed", **base)
            spec(facing, "hurt", px, eye_near="near_hurt", eye_far="far_hurt", brow_near=br("near_hurt"),
                 brow_far=br("far_hurt"), mouth="hurt", gaze="closed", **base)
            spec(facing, "serene", px, eye_near="near_serene", eye_far="far_serene", brow_near=br("near_serene"),
                 brow_far=br("far_serene"), blush="soft", mouth="serene", gaze="lowered (prayer)", **base)
            spec(facing, "ignited", px, eye_near="near_ignited", eye_far="far_ignited",
                 brow_near="near_fierce" if big else None, brow_far="far_fierce" if big else None,
                 mouth="shout", gaze="target (the way she faces)", **base)
            spec(facing, "closed", px, eye_near="near_closed", eye_far="far_closed", brow_near=br("near_confident"),
                 brow_far=br("far_confident"), blush="soft", mouth="closed", gaze="closed", **base)
        pb = "profile" if big else None
        for expr, e, b in (("confident", "profile_open", pb),
                           ("focused", "profile_focused", "profile_focused" if big else None),
                           ("smile", "profile_smile", pb), ("hurt", "profile_hurt", pb),
                           ("closed", "profile_closed", pb), ("serene", "profile_serene", pb),
                           ("ignited", "profile_ignited", "profile_focused" if big else None)):
            spec("profile", expr, px, eye_near=e, brow_near=b, mouth="shout" if (expr == "ignited" and big) else "profile",
                 gaze="target", nose=None,
                 params={"edge_keep": 1, "strand_max": 3, "fringe_band": 1, "jaw": False, "eye_dy": 0})
    print('wrote', len(list(L.glob('*.json'))), 'files in', L)


if __name__ == '__main__':
    main()
