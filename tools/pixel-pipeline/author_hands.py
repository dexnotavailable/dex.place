# Rosace hand library, stills round 3 (144 fists redrawn in stills round 4): hand-typed pixel rows (authoring record; not part of stills.sh).
# The JSON files it writes to art/rosace/hands/ are the source of truth: python author_hands.py
#
# Round-2 critics: the rendered 3D hands were a 4x5 flesh blob, a polka-dot ball fist and a
# pink mitt. At 22-26 px heads a hand is 5-7 px, which the renderer cannot resolve, so hands on
# key frames are authored stamps placed by the override layers ({"kind": "hand", "stamp": ...}).
# Rows use overrides.ROWKEY: O outline, L S1 lit, S S2, T S3 shadow, M S4 crease / knuckle line,
# '.' leaves the render (the haft shows through above and below the fist), 'x' erases.
# Round 4 (round-3 body/gear critics: "mittens with no thumb split and no knuckle highlight"):
# the 144 fists are 8-9 x 7-8 px: S1 knuckle highlights along the top, low-contrast S3 finger
# creases, the thumb as its own lit S1 lobe split from the fingers by a short S4 crease, and
# 2 px of S3 wrist running into the cuff. (A first try used G0 knuckle glints and a full OL
# thumb line; at x8 that read as two eyes and a mouth, the round-3 "skull" again.)
# Every stamp is authored with the arm entering from the side named in 'arm'; flip mirrors it.
import json, os
D = 'D:/Dex/Projects/dex.place/art/rosace/hands'
H = {}
# fist_v: closed on a (near-)vertical haft that runs through the origin column; back of the hand
# toward the camera; lit top-left thumb and index, two S4 finger creases, S3 wrist shadow into
# the sleeve on the right.
H['fist_v', 144] = dict(arm='right', origin=[3, 3], rows=[
 "..OOO...",
 ".OLLSO..",
 "OLSSSSTT",
 "OSSTSSTT",
 "OLSSSTTT",
 ".OTMSTO.",
 ".OLLTO..",
 "..OOO..."])
H['fist_v', 128] = dict(arm='right', origin=[2, 2], rows=[
 ".OOO..",
 "OLLSO.",
 "OMSSTT",
 "OSSTTT",
 "OMTTO.",
 ".OOO.."])
H['fist_v', 96] = dict(arm='right', origin=[2, 2], rows=[
 ".OO..",
 "OLSO.",
 "OMSTT",
 "OSTO.",
 ".OO.."])
# fist_h: closed across a shallow (0-25 deg) haft that runs through the origin row; the finger
# joints show as vertical S4 creases, the thumb lies along the top of the haft (lit), wrist on
# the left.
H['fist_h', 144] = dict(arm='left', origin=[4, 3], rows=[
 "...OOOO..",
 "..OLLSLO.",
 "TTSSTSTSO",
 "TTSSSSSSO",
 "TTSTMMSTO",
 "..OLLLTO.",
 "...OOOO.."])
H['fist_h', 128] = dict(arm='left', origin=[2, 3], rows=[
 "..OOO.",
 ".OLLLO",
 "TSMSMO",
 "TTMTMO",
 "..OOO."])
H['fist_h', 96] = dict(arm='left', origin=[2, 2], rows=[
 ".OOO.",
 "TLLLO",
 "TSMSO",
 ".OOO."])
# palm_open: a relaxed open hand flung back (skill follow-through); fingers fanned 1 px apart,
# thumb out, wrist on the right.
H['palm_open', 144] = dict(arm='right', origin=[4, 3], rows=[
 ".O.O.O...",
 "OLOLOLO..",
 "OSOSOSOO.",
 "OSSSSSLTO",
 ".OSSSTTO.",
 "..OTTTTT.",
 "...OOO..."])
H['palm_open', 128] = dict(arm='right', origin=[3, 3], rows=[
 ".O.O.O..",
 "OLOLOLO.",
 "OSSSSLTO",
 ".OSSTTO.",
 "..OTTTT.",
 "...OO..."])
H['palm_open', 96] = dict(arm='right', origin=[2, 2], rows=[
 ".O.O..",
 "OLOLO.",
 "OSSLTO",
 ".OTTT.",
 "..OO.."])
if __name__ == '__main__':
    for (name, px), st in H.items():
        w = max(len(r) for r in st['rows'])
        out = {'_doc': f"{name}, {px} px sprite: hand stamp for override layers (arm enters from the {st['arm']}; "
                       "'flip' in the patch mirrors it). origin = [column, row] placed on the patch 'at'. "
                       "Rows use overrides.ROWKEY codes; '.' leaves the render. Stills round 3.",
               'name': name, 'px': px, 'arm': st['arm'], 'origin': st['origin'],
               'rows': [r.ljust(w, '.') for r in st['rows']]}
        json.dump(out, open(os.path.join(D, f'{name}_{px}.json'), 'w'), indent=1)
    print(len(H))
    # review sheet (git-ignored review/): every stamp on an indigo haft swatch, x10
    import sys
    if '--review' in sys.argv:
        from PIL import Image, ImageDraw
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import overrides, faces
        pal = faces.palette()
        out_dir = sys.argv[sys.argv.index('--review') + 1]
        Z, cw, ch = 10, 14, 11
        names = sorted({n for n, _ in H})
        sheet = Image.new('RGB', (100 + 3 * cw * Z, 30 + len(names) * ch * Z), (40, 40, 46))
        d = ImageDraw.Draw(sheet)
        d.text((8, 8), 'Rosace hand library (authored stamps), x10; columns 144 / 128 / 96 px', fill=(230, 230, 230))
        for r, n in enumerate(names):
            d.text((8, 30 + r * ch * Z + 4), n, fill=(230, 220, 160))
            for c, px in enumerate((144, 128, 96)):
                st = H[n, px]
                w, h = max(len(x) for x in st['rows']), len(st['rows'])
                im = Image.new('RGB', (w + 4, h + 4), (104, 102, 98))
                ox, oy = st['origin']
                for y in range(h + 4):                       # the haft the stamp closes on
                    if n == 'fist_v':
                        im.putpixel((ox + 2, y), pal['I2']); im.putpixel((ox + 1, y), pal['I4'])
                for x in range(w + 4):
                    if n == 'fist_h':
                        im.putpixel((x, oy + 2), pal['I2']); im.putpixel((x, oy + 1), pal['I1'])
                for y, row in enumerate(st['rows']):
                    for x, chh in enumerate(row):
                        if chh not in '. ':
                            im.putpixel((x + 2, y + 2), pal[overrides.ROWKEY[chh]])
                sheet.paste(im.resize((im.width * Z, im.height * Z), Image.NEAREST), (100 + c * cw * Z, 30 + r * ch * Z))
        sheet.save(os.path.join(out_dir, 'hand_library_x10.png'))
