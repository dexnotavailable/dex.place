"""Review sheets for constructed art, on the tools/pixel-pipeline stills_sheets.py conventions: every
panel on its own native pixel grid, one integer zoom per sheet, blind A/B panels labelled only A / B
with the side shuffled per sheet (seeded), and key.json saying which side is ours.

  python tools/art-construct/sheets.py ab --sprite art/rosace/construct/figure/idle_hero [--seed 20261010]
  python tools/art-construct/sheets.py faces [--set q34]
  python tools/art-construct/sheets.py before-after --sprite art/rosace/construct/figure/idle_hero

Outputs go to review/rosace/construct/ab/ (git-ignored: the refs are third-party and never leave review/).
  ab_<pose>_vs_<ref>_x3.png / _x6.png   blind: our sprite vs a finish-bar ref (07, 08, 09 idle; 04 centre figure)
  ab_face_vs_<ref>_x6.png / _x10.png    blind: our constructed face vs the ref's head
  key.json                              which side is ours, per sheet
  faces_<set>_x8.png                    not blind: the expression set beside the ref heads
  before_after_<pose>_x3.png            not blind: round-4-fix 3D-route still vs the constructed sprite
"""
import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402

NATIVE = A.ROOT / 'review' / 'refs' / 'character' / 'native'
OUT = A.ROOT / 'review' / 'rosace' / 'construct' / 'ab'
BACKDROP = (104, 102, 98)
B07 = '07-anim-amberowl-wrench_bonus-originalsize_1x.png'
B08 = '08-anim-amberowl-lys-lightning_bonus-originalsize_1x.png'
R09 = '09-anim-amberowl-katana-cats_1x.png'
G04 = '04-style-grid9_native-p2.158.png'
# body crops: the same boxes as tools/pixel-pipeline/stills_sheets.py (REF-BREAKDOWN measurements);
# 04: the grid's centre cell, trimmed to the figure
REFS = {
    'ref07_idle': (B07, (64, 14, 178, 196), '07 bonus panel (1x), idle / carry stance'),
    'ref08_idle': (B08, (180, 40, 340, 222), '08 bonus panel (1x), idle stance'),
    'ref09_idle': (R09, (60, 32, 205, 215), '09 (1x), frame 1 idle'),
    'ref04_centre': (G04, (114, 168, 230, 342), '04 grid (native p2.158), centre figure: white skirt, dark thigh-highs'),
}
HEADS = {
    'ref07': ('07-anim-amberowl-wrench_top_native-p2.png', (104, 40, 142, 80)),
    'ref08': ('08-anim-amberowl-lys-lightning_top_native-p2.png', (100, 60, 140, 100)),
    'ref09': (R09, (134, 34, 176, 80)),
}


def ref_img(key, table=REFS):
    f, box = table[key][0], table[key][1]
    return Image.open(NATIVE / f).convert('RGB').crop(box)


def border_colour(im):
    a = np.asarray(im.convert('RGB'))
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    return tuple(int(np.median(edge[:, i])) for i in range(3))


def ground_shadow(canvas, sprite, at, bg):
    """the contact ellipse the game draws under her (stills_sheets.py round-3 shape, simplified)"""
    al = np.asarray(sprite.getchannel('A')) > 0
    ys, xs = np.nonzero(al)
    if not len(ys):
        return
    y1 = ys.max()
    foot = xs[ys >= y1 - 8]
    cx = at[0] + (foot.min() + foot.max()) / 2 + 0.5
    rx, ry = max(10, 0.75 * (foot.max() - foot.min() + 1) + 8) / 2, 3.5
    fy = at[1] + y1 + 0.5
    px = canvas.load()
    core = tuple(int(c * 0.66) for c in bg)
    ring = tuple(int(c * 0.82) for c in bg)
    for yy in range(int(fy - 4), int(fy + 4)):
        for xx in range(int(cx - rx - 1), int(cx + rx + 2)):
            if 0 <= xx < canvas.width and 0 <= yy < canvas.height:
                e = ((xx + .5 - cx) / rx) ** 2 + ((yy + .5 - fy) / ry) ** 2
                if e <= 0.45:
                    px[xx, yy] = core
                elif e <= 1.0:
                    px[xx, yy] = ring


def ours(sprite_png, bg, margin=8):
    im = Image.open(sprite_png).convert('RGBA')
    x0, y0, x1, y1 = im.getbbox()
    out = Image.new('RGB', (x1 - x0 + 2 * margin, y1 - y0 + 2 * margin + 3), bg)
    at = (margin - x0, margin - y0)
    ground_shadow(out, im, at, bg)
    out.paste(im, at, im)
    return out


def sheet(panels, labels, z, header):
    ims = [A.zoom(p, z) for p in panels]
    pad, top = 24, 70
    W = sum(i.width for i in ims) + pad * (len(ims) + 1)
    H = max(i.height for i in ims) + top + pad
    s = Image.new('RGB', (W, H), (22, 22, 26))
    d = ImageDraw.Draw(s)
    d.text((pad, 8), header, fill=(200, 200, 200), font=A.font(16))
    x = pad
    for im, lab in zip(ims, labels):
        d.text((x, 30), lab, fill=(255, 235, 150), font=A.font(26))
        s.paste(im, (x, H - pad - im.height))
        x += im.width + pad
    return s


def load_key(out):
    kp = out / 'key.json'
    if kp.exists():
        return json.loads(kp.read_text(encoding='utf-8'))
    return {'_doc': "Blind A/B key for the construct sheets. 'ours' names the side (A or B) that is Rosace; "
                    "both panels are on their native pixel grids at the sheet's zoom.", 'sheets': {}}


def ab(sprite_dir, seed, out=OUT, label='construct'):
    out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(seed)
    key = load_key(out)
    key['seed'] = seed
    key['refs'] = {k: {'file': v[0], 'crop': v[1], 'what': v[2]} for k, v in REFS.items()}
    sd = Path(sprite_dir)
    pose = sd.name
    made = []
    for rk in REFS:
        r = ref_img(rk)
        o = ours(sd / 'sprite.png', border_colour(r))
        left = rng.random() < 0.5
        panels = [o, r] if left else [r, o]
        name = f'ab_{pose}_vs_{rk}'
        for z in (3, 6):
            fn = f'{name}_x{z}.png'
            sheet(panels, ['A', 'B'], z, f'{label} | {pose} vs finish-bar ref | x{z}, each panel on its own native grid').save(out / fn)
            made.append(fn)
        key['sheets'][name] = {'ours': 'A' if left else 'B', 'ours_still': f'{pose} (constructed, 144 px)', 'ref': rk,
                               'files': [f'{name}_x3.png', f'{name}_x6.png']}
    # the face alone vs each ref head (the face.json the sprite used)
    fj = sd / 'face.json'
    if fj.exists():
        rec = json.loads(fj.read_text(encoding='utf-8'))
        pal = A.Palette()
        codes = A.grid_to_codes(rec['rows'], pal)
        fimg = Image.fromarray(pal.to_rgba(np.clip(codes, 0, None)), 'RGBA')
        for hk in HEADS:
            r = ref_img(hk, HEADS)
            bgc = border_colour(r)
            o = Image.new('RGB', fimg.size, bgc)
            o.paste(fimg, (0, 0), fimg)
            bb = fimg.getbbox()
            o = o.crop((max(0, bb[0] - 3), max(0, bb[1] - 3), min(o.width, bb[2] + 3), min(o.height, bb[3] + 1)))
            left = rng.random() < 0.5
            panels = [o, r] if left else [r, o]
            name = f'ab_face_vs_{hk}'
            for z in (6, 10):
                fn = f'{name}_x{z}.png'
                sheet(panels, ['A', 'B'], z, f'{label} | face vs ref head | x{z}, native grids').save(out / fn)
                made.append(fn)
            key['sheets'][name] = {'ours': 'A' if left else 'B', 'ours_still': rec['name'], 'ref': hk,
                                   'files': [f'{name}_x6.png', f'{name}_x10.png']}
    A.jdump(key, out / 'key.json')
    return made


def faces(faces_dir, yaw='q34', out=OUT):
    out.mkdir(parents=True, exist_ok=True)
    pal = A.Palette()
    panels = []
    for e in ('confident', 'focused', 'radiant', 'serene', 'ignited', 'hurt'):
        fp = Path(faces_dir) / f'{yaw}_{e}_144.png'
        if fp.exists():
            im = Image.open(fp).convert('RGBA')
            panels.append((e, A.zoom(A.on_bg(im.crop(im.getbbox())), 8)))
    panels += [(k, A.zoom(ref_img(k, HEADS), 8)) for k in HEADS]
    s = A.row_sheet(panels, title=f'{yaw} expression set (constructed) beside the ref heads, all x8 on native grids (not blind)')
    fn = f'faces_{yaw}_x8.png'
    s.save(out / fn)
    return [fn]


def before_after(sprite_dir, before, out=OUT):
    out.mkdir(parents=True, exist_ok=True)
    sd = Path(sprite_dir)
    b = Path(before)
    bp = b / 'still.png' if (b / 'still.png').exists() else b / 'sprite.png'
    panels = [ours(bp, BACKDROP), ours(sd / 'sprite.png', BACKDROP)]
    fn = f'before_after_{sd.name}_x3.png'
    sheet(panels, ['round-4-fix (3D route)', 'constructed'], 3, 'not blind | same pose name, same height, x3').save(out / fn)
    return [fn]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('what', choices=('ab', 'faces', 'before-after', 'all'))
    ap.add_argument('--sprite', default=str(A.ROOT / 'art' / 'rosace' / 'construct' / 'figure' / 'idle_hero'))
    ap.add_argument('--faces', default=str(A.ROOT / 'art' / 'rosace' / 'construct' / 'faces'))
    ap.add_argument('--before', default=r'D:\Dex\Projects\dex-place-art\rosace\build\renders\r4fix\idle_hero\px144')
    ap.add_argument('--seed', type=int, default=20261010)
    ap.add_argument('--out', default=str(OUT))
    a = ap.parse_args()
    out = Path(a.out)
    made = []
    if a.what in ('ab', 'all'):
        made += ab(a.sprite, a.seed, out)
    if a.what in ('faces', 'all'):
        made += faces(a.faces, out=out)
    if a.what in ('before-after', 'all'):
        made += before_after(a.sprite, a.before, out)
    print(len(made), 'sheets in', out)
    for m in made:
        print(' ', m)


if __name__ == '__main__':
    main()
