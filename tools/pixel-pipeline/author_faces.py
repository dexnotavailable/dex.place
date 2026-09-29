# Rosace face library, stills round 4: hand-typed pixel rows (authoring record; not part of stills.sh).
# The JSON files it writes to art/rosace/faces/ are the source of truth: python author_faces.py
# (then `python faces.py png --review <dir>` redraws the PNG copies and the library sheets).
#
# Round 4 answers the round-3 face critique (score 5.5):
#   * eyes: 3-tone iris (I4 dark top tucked under the lash, A2 middle, A3 / A4 light bottom), the
#     A5 highlight on the same (screen-right) side in both eyes, a rounded upper lash that arcs
#     over the iris and thickens to 2 px at the outer corner with a 1 px flick, a lower-lash dot
#     at the outer corner; the round-3 straight lash bars read as a glare or a black visor
#   * q34: the far eye is 1 px narrower (2 px iris against 3) and sits 1 px lower at the top
#     (head tilt), highlight side kept
#   * no brows drawn over the bangs on the calm faces (round 3's OL brows read as a dark mask
#     band); resolute keeps short angled brows because they carry the expression
#   * single-pixel S3 nose; centred 2 px S4 mouth shifted 1 px toward the facing side; the stray
#     pink pixel above the mouth is gone
#   * profile: 1 px iris + 1 px light under a lighter lash with a flick (no "sunglasses bar")
#   * the jaw taper, chin point, near-cheek bulge, far-jaw S3, profile nose / lips / chin, the
#     bang tips and the face-window clean-up depend on each render's head, so they are authored
#     per still in the override layers' "preface" (tools/pixel-pipeline/author_overrides_data.py)
#     and drawn BEFORE this stamp; the stamp only carries eyes, brows, nose, mouth, blush
# Expressions (task: neutral-confident, focus/attack, smile):
#   serene   neutral-confident hero face (idle): open rounded eyes, calm small mouth
#   resolute focus / attack: angled brows, straight lash dropping at the inner end, set mouth
#   radiant  smile: eyes closed into ^ arcs with a tail, open smile with a pink tongue pixel
import json, os, glob
F = 'D:/Dex/Projects/dex.place/art/rosace/faces'
DOC = {
 'serene': 'serene = neutral-confident hero face (idle): open eyes with a rounded lash arc, 3-tone iris, highlight right, calm 2 px mouth',
 'resolute': 'resolute = focus/attack: short angled brows over the bangs, straight lash dropping at the inner end, narrowed iris, set 2 px mouth',
 'radiant': 'radiant = smile: eyes closed into ^ arcs with a tail, blush, open smile (S4 line over an SB tongue pixel)',
}
S = {}
# ---------------------------------------------------------------- 144 px, q34 (facing screen-right)
# near eye left (7 wide with the flick), far eye right (5 wide), nose under the far eye's inner
# corner, mouth 1 px toward the facing side. origin = [column, row] on the face anchor.
FLAT144 = dict(box=[1, 0, 16, 13], s1=True, bang=True)
Q144 = dict(origin=[8, 4], flat=FLAT144)
S['q34', 'serene', 144] = dict(Q144, rows=[
 "..................",
 "..................",
 "...OOO......OOO...",
 "..OddhO....OdhO...",
 ".OOaaaw....waaOO..",
 "...bcb......bc....",
 "..m..........m....",
 "............pp....",
 "..pp.......s......",
 "..................",
 "..........mm......"])
S['q34', 'resolute', 144] = dict(Q144, rows=[
 "..................",
 "....RR......RR....",
 "......RR..RR......",
 "..................",
 "..OOOOO...OOOOO...",
 "...OddhO..OdhO....",
 "....abw....ab.....",
 "...m.......m......",
 "....p.......p.....",
 ".........s........",
 "........mm........"])
S['q34', 'radiant', 144] = dict(Q144, rows=[
 "..................",
 "..................",
 "...OOO......OOO...",
 "..O...O....O...O..",
 ".O..............O.",
 "..................",
 "..ppp........pp...",
 "..................",
 "...........s......",
 "..........mmm.....",
 "...........p......"])
# ---------------------------------------------------------------- 144 px, front
# symmetric eyes 5 wide + the outer flick, highlight on the right of both irises
FR144 = dict(origin=[8, 3], flat=dict(box=[0, 0, 14, 13], s1=True, bang=True))
S['front', 'serene', 144] = dict(FR144, rows=[
 "...............",
 "...............",
 "..OOO....OOO...",
 ".OddhO..OddhO..",
 "OOaaaw..waaaOO.",
 "..bcb....bcb...",
 ".m..........m..",
 "...............",
 ".pp........pp..",
 "......s........",
 "...............",
 "......mm......."])
S['front', 'resolute', 144] = dict(FR144, rows=[
 ".RR.........RR.",
 "...RR.....RR...",
 "...............",
 "OOOOOO..OOOOOO.",
 ".OddhO..OddhO..",
 "..abw....wab...",
 ".m..........m..",
 "..p.........p..",
 "......s........",
 "...............",
 "......mm......."])
S['front', 'radiant', 144] = dict(FR144, rows=[
 "...............",
 "...............",
 "..OOO....OOO...",
 ".O...O..O...O..",
 "O............O.",
 ".pp........pp..",
 "......s........",
 "...............",
 ".....mmm.......",
 "......p........"])
# ---------------------------------------------------------------- 144 px, profile
# Drawn facing screen-LEFT (reversed by the writer; stamps are stored facing right). The eye sits
# 2 px behind the nose-bridge contour: 3 px lash with the flick at the back, I4 top + A5
# highlight, A2 / A3 below; blush behind the cheek; the mouth pixel inside the lip notch.
PL144 = dict(origin=[4, 0])
PROFILE_L = {}
PROFILE_L['serene'] = dict(PL144, rows=[
 "......",
 "..OOO.",
 "..dhOO",
 "..ab..",
 "....p.",
 "......",
 ".m...."])
PROFILE_L['resolute'] = dict(PL144, rows=[
 ".RRR..",
 "..OOOO",
 "..dhO.",
 "..a...",
 "....p.",
 "......",
 ".mm..."])
PROFILE_L['radiant'] = dict(PL144, rows=[
 "......",
 "...OO.",
 "..O..O",
 "......",
 "...pp.",
 "......",
 ".mm...",
 "..p..."])


def reverse(st):
    w = max(len(r) for r in st['rows'])
    rows = [r.ljust(w, '.')[::-1] for r in st['rows']]
    out = dict(st, rows=rows, origin=[w - 1 - st['origin'][0], st['origin'][1]])
    if 'flat' in st:
        c0, r0, c1, r1 = st['flat']['box']
        out['flat'] = dict(st['flat'], box=[w - 1 - c1, r0, w - 1 - c0, r1])
    return out


for e, st in PROFILE_L.items():
    S['profile', e, 144] = reverse(st)

from author_faces_small import SMALL      # 128 / 96 px sets (same construction, smaller budget)
S.update(SMALL(reverse))

HEAD = {144: '25 px head; q34 near eye 7 wide x 4 tall + lower-lash dot, far eye 5 wide',
        128: '22 px head; near eye 5-6 wide x 3 tall, far eye 4 wide',
        96: '16 px head; ref 05 budget: eyes 3 wide x 2 tall, 2-tone iris, no highlight, no brows'}
if __name__ == '__main__':
    for p in glob.glob(os.path.join(F, '*_rapt_*.json')):   # round-3 'rapt' retired (unused, read bored)
        os.remove(p)
    n = 0
    for (facing, expr, px), st in S.items():
        rows = st['rows']
        w = max(len(r) for r in rows)
        rows = [r.ljust(w, '.') for r in rows]
        doc = (f"{facing}, {DOC[expr]}; {px} px sprite ({HEAD[px]}). Authored facing screen-right (mirrored for "
               "screen-left). origin = [column, row] placed on the face anchor. 'flat' = box (stamp columns/rows) "
               "where rendered S1/S3/S4 skin is flattened to S2 (s1), then a 1 px S3 row under the bangs (bang). "
               "Contour, bang tips and face-window clean-up are per-still override 'preface' patches. Stills round 4.")
        out = {'_doc': doc, 'facing': facing, 'expr': expr, 'px': px, 'origin': st['origin'], 'rows': rows}
        if st.get('flat'):
            out['flat'] = st['flat']
        json.dump(out, open(os.path.join(F, f'{facing}_{expr}_{px}.json'), 'w'), indent=1)
        n += 1
    print(n)
