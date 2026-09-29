# Rosace face library, 128 and 96 px sets (stills round 4), imported by author_faces.py.
# Same construction as the 144 set at a smaller budget (DESIGN.md s5):
#   128 (22 px head): near eye 5-6 wide x 3 tall (rounded lash arc, I4 top + A5 highlight, A2 / A3
#       below, lower-lash dot), far eye 4 wide; 1 px nose; 2 px mouth
#   96 (16 px head, ref 05's budget): eyes 3-4 wide x 2 tall: lash row with the outer end thick,
#       iris row I4 / A2 / A5 (near) or A2 / A5 (far); no brows; 2 px mouth; 1 px blush
# Rows are authored facing screen-right (profiles facing left, reversed by the writer).


def SMALL(reverse):
    S = {}
    # ---------------------------------------------------------------- 128
    Q128 = dict(origin=[8, 4], flat=dict(box=[0, 0, 14, 14], s1=True, bang=True))
    S['q34', 'serene', 128] = dict(Q128, rows=[
        "..............",
        "..............",
        "..OOO....OO...",
        ".OddhO..OdhO..",
        "OOabw....abO..",
        ".m.........m..",
        ".pp.......p...",
        ".........s....",
        "..............",
        "........mm...."])
    S['q34', 'resolute', 128] = dict(Q128, rows=[
        "..............",
        "...RR....RR...",
        "..............",
        "..OOOO..OOOO..",
        "..OdhO..OdhO..",
        "...ab....ab...",
        "..m.......m...",
        "...p.....p....",
        ".........s....",
        ".......mm....."])
    S['q34', 'radiant', 128] = dict(Q128, rows=[
        "..............",
        "..............",
        "..OOO....OO...",
        ".O...O..O..O..",
        "O.............",
        ".ppp......pp..",
        ".........s....",
        "........mmm...",
        ".........p...."])
    F128 = dict(origin=[7, 3], flat=dict(box=[0, 0, 13, 12], s1=True, bang=True))
    S['front', 'serene', 128] = dict(F128, rows=[
        ".............",
        ".............",
        "..OOO..OOO...",
        ".OddhO.OdhhO.",
        "OOabw...wabOO",
        ".m.........m.",
        ".pp.......pp.",
        "......s......",
        ".............",
        "......mm....."])
    S['front', 'resolute', 128] = dict(F128, rows=[
        ".RR.......RR.",
        "...R.....R...",
        ".OOOOO.OOOOO.",
        "..OdhO.OdhO..",
        "...ab...ab...",
        ".m.........m.",
        "..p.......p..",
        "......s......",
        "......mm....."])
    S['front', 'radiant', 128] = dict(F128, rows=[
        ".............",
        ".............",
        "..OO....OO...",
        ".O..O..O..O..",
        "O..........O.",
        ".pp......pp..",
        ".....s.......",
        "....mmm......",
        ".....p......."])
    PL128 = dict(origin=[4, 0])
    P = {}
    P['serene'] = dict(PL128, rows=[
        "..OOO",
        "..ahO",
        "....p",
        ".....",
        ".....",
        ".m..."])
    P['resolute'] = dict(PL128, rows=[
        "..OOOO",
        "..ahO.",
        "....p.",
        "......",
        "......",
        ".mm..."])
    P['radiant'] = dict(PL128, rows=[
        "...O.",
        "..O.O",
        "...pp",
        ".....",
        ".....",
        ".mm.."])
    for e, st in P.items():
        S['profile', e, 128] = reverse(st)
    # ---------------------------------------------------------------- 96
    Q96 = dict(origin=[6, 1], flat=dict(box=[0, 0, 11, 9], s1=True, bang=True))
    S['q34', 'serene', 96] = dict(Q96, rows=[
        "............",
        ".OOOO..OOO..",
        "..dah..ah...",
        ".p........p.",
        "............",
        ".....mm....."])
    S['q34', 'resolute', 96] = dict(Q96, rows=[
        "............",
        ".OOOO..OOOO.",
        "..dah..ah...",
        "............",
        "............",
        ".....mm....."])
    S['q34', 'radiant', 96] = dict(Q96, rows=[
        "..O.....O...",
        ".O.O...O.O..",
        ".p........p.",
        "............",
        ".....mm.....",
        "......p....."])
    F96 = dict(origin=[5, 1], flat=dict(box=[0, 0, 10, 8], s1=True, bang=True))
    S['front', 'serene', 96] = dict(F96, rows=[
        "...........",
        ".OOO...OOO.",
        "..dah..ah..",
        ".p.......p.",
        "...........",
        ".....mm...."])
    S['front', 'resolute', 96] = dict(F96, rows=[
        "...........",
        ".OOOO.OOOO.",
        "..dah.ah...",
        "...........",
        "...........",
        ".....mm...."])
    S['front', 'radiant', 96] = dict(F96, rows=[
        "..O....O...",
        ".O.O..O.O..",
        ".p......p..",
        "...........",
        "....mm.....",
        ".....p....."])
    PL96 = dict(origin=[2, 0])
    P = {}
    P['serene'] = dict(PL96, rows=[
        "..OO",
        "..a.",
        "....",
        ".m.."])
    P['resolute'] = dict(PL96, rows=[
        "..OOO",
        "..a..",
        ".....",
        ".mm.."])
    P['radiant'] = dict(PL96, rows=[
        "..O.",
        ".O.O",
        "....",
        ".mm."])
    for e, st in P.items():
        S['profile', e, 96] = reverse(st)
    return S
