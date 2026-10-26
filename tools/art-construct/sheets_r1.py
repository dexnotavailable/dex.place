"""Round-1 review sheets (review/rosace/construct/round-1/, git-ignored: the refs are third-party).

  python tools/art-construct/sheets_r1.py [--seed 20261015]

Writes, on the stills_sheets.py / sheets.py conventions (every panel on its own native grid, one integer zoom
per sheet, blind A/B panels labelled only A / B, the side shuffled with a seed, key.json saying which is ours):
  ab_idle_hero_r1_vs_<ref>_x3.png / _x6.png    blind: the R1 hero vs refs 07, 08, 09 (idle) and 04 (centre figure)
  ab_face_vs_<ref>_x6.png / _x10.png           blind: the hero's painted face (as composited on the sprite) vs the
                                               07 / 08 / 09 heads, cropped to the same head box on native grids
  key.json                                     which side is ours, per sheet
  faces_library_x8.png                         not blind: all painted faces (3 views x 3 expressions, + q34 serene /
                                               ignited / hurt) beside the ref heads
  process_face.png                             the face trial loop: round a and b variants with the verdicts
  process_figure.png                           the six gesture thumbnails, the collar A/B, the render A/B
  before_after_x3.png                          not blind: round-4-fix 3D still | C1 construct | R1 hero
  composite_face_x8.png                        the face alone | the face on the figure, same zoom
"""
import argparse
import json
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import sheets as SH  # noqa: E402

R1 = A.ROOT / 'review' / 'rosace' / 'construct' / 'round-1'
FIG = A.ROOT / 'art' / 'rosace' / 'construct' / 'figure'
FACES = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'r1'
R4FIX = Path(r'D:\Dex\Projects\dex-place-art\rosace\build\renders\r4fix\idle_hero\px144')


def label_img(im, text, w=None, size=15):
    """a panel with a caption strip above it"""
    w = w or im.width
    out = Image.new('RGB', (max(w, im.width), im.height + size + 10), (22, 22, 26))
    ImageDraw.Draw(out).text((2, 2), text, fill=(255, 235, 150), font=A.font(size))
    out.paste(im.convert('RGB'), (0, size + 10))
    return out


def ab_sheets(seed):
    made = SH.ab(FIG / 'idle_hero_r1', seed, R1, label='round R1')
    key = json.loads((R1 / 'key.json').read_text(encoding='utf-8'))
    key['_doc'] = ("Blind A/B key for review/rosace/construct/round-1 (tools/art-construct/sheets_r1.py). 'ours' names the side "
                   "(A or B) that is Rosace; both panels are on their native pixel grids at the sheet's zoom. Our still: "
                   "art/rosace/construct/figure/idle_hero_r1 (figure_paint.py) with the painted r1 face (head_paint.py).")
    key['round'] = 'R1'
    A.jdump(key, R1 / 'key.json')
    return made


def faces_library():
    rows = []
    views = (('q34', ('confident', 'focused', 'radiant', 'serene', 'ignited', 'hurt')),
             ('front', ('confident', 'focused', 'radiant')), ('profile', ('confident', 'focused', 'radiant')))
    for v, exprs in views:
        ps = []
        for e in exprs:
            fp = FACES / f'{v}_{e}_144.png'
            if fp.exists():
                im = Image.open(fp).convert('RGBA')
                ps.append((f'{v} {e}', A.zoom(A.on_bg(im.crop(im.getbbox())), 8)))
        rows.append(A.row_sheet(ps))
    rows.append(A.row_sheet([(k, A.zoom(SH.ref_img(k, SH.HEADS), 8)) for k in SH.HEADS],
                            title='the finish-bar heads at the same zoom (third-party refs: review/ only)'))
    title = Image.new('RGB', (rows[0].width, 30), (22, 22, 26))
    ImageDraw.Draw(title).text((18, 6), 'round R1 painted face library, x8 on native grids (not blind)',
                               fill=(210, 210, 210), font=A.font(18))
    A.stack([title] + rows).save(R1 / 'faces_library_x8.png')


def process_face():
    """both q34 trial rounds with the verdicts from the head spec"""
    spec = json.loads((FACES / 'head_q34.json').read_text(encoding='utf-8'))
    rows = []
    for tag, title in (('_a', 'round a: one design axis each, on the first painted base'),
                       ('_b', 'round b: on the base with round a\'s winners (eye_dark, skin_render)')):
        vdir = R1 / 'face' / f'q34_variants{tag}'
        res = json.loads((vdir / 'variants.json').read_text(encoding='utf-8'))['results'] if (vdir / 'variants.json').exists() else []
        ps = []
        for r in res:
            png = vdir / f"q34_confident__{r['name']}.png"
            if not png.exists():
                continue
            im = A.zoom(A.on_bg(Image.open(png).convert('RGBA')), 5)
            v = spec.get('variants' + tag, {}).get(r['name'], {})
            kept = v.get('kept')
            verdict = 'base' if r['name'] == 'base' else ('KEPT' if kept else 'rejected')
            ps.append(label_img(im, f"{r['name']} ({r['passed']} pass) {verdict}", size=13))
        if ps:
            H = max(p.height for p in ps)
            W = sum(p.width for p in ps) + 12 * (len(ps) + 1)
            s = Image.new('RGB', (W, H + 34), (22, 22, 26))
            ImageDraw.Draw(s).text((12, 6), title, fill=(210, 210, 210), font=A.font(16))
            x = 12
            for p in ps:
                s.paste(p, (x, 30))
                x += p.width + 12
            rows.append(s)
        # verdict text
        lines = [f"{k}: {v.get('verdict', '')}" for k, v in spec.get('variants' + tag, {}).items()]
        if lines:
            t = Image.new('RGB', (rows[-1].width if rows else 1400, 18 * len(lines) + 10), (22, 22, 26))
            d = ImageDraw.Draw(t)
            for i, ln in enumerate(lines):
                d.text((12, 4 + 18 * i), ln[:220], fill=(180, 180, 180), font=A.font(12))
            rows.append(t)
    one = R1 / 'face' / 'q34_one_axis_variants_x6.png'
    if one.exists():
        rows.append(Image.open(one).convert('RGB'))
    A.stack(rows).save(R1 / 'process_face.png')


def process_figure():
    rows = []
    th = R1 / 'figure' / 'idle_hero_r1_thumbs.png'
    if th.exists():
        rows.append(Image.open(th).convert('RGB'))
    spec = json.loads((FIG / 'idle_hero_r1.gesture.json').read_text(encoding='utf-8'))
    lines = [f"{t['name']}: {t.get('verdict', '')}" for t in spec['thumbnails']]
    t = Image.new('RGB', (1900, 18 * len(lines) + 10), (22, 22, 26))
    d = ImageDraw.Draw(t)
    for i, ln in enumerate(lines):
        d.text((12, 4 + 18 * i), ln[:250], fill=(180, 180, 180), font=A.font(12))
    rows.append(t)
    ps = []
    for nm, path, cap in (('hero (hip hand)', FIG / 'idle_hero_r1' / 'sprite.png', 'KEPT'),
                          ('collar hand A/B', FIG / 'idle_hero_r1_collar' / 'sprite.png', 'rejected: FG-N04 (bell closes the window)'),
                          ('render A/B: no sel-out', R1 / '_work' / 'render_ab' / 'idle_hero_r1_noselout' / 'sprite.png',
                           'rejected: uniform OL frame, flatter lit edges')):
        if path.exists():
            im = A.on_bg(Image.open(path).convert('RGBA'))
            ps.append((f'{nm}: {cap}', A.zoom(im.crop((0, 30, im.width, im.height)), 3)))
    rows.append(A.row_sheet(ps, title='full-size A/Bs at x3 (not blind)'))
    A.stack(rows).save(R1 / 'process_figure.png')


def before_after():
    panels, labels = [], []
    for lab, p in (('round-4-fix (3D route)', R4FIX / 'still.png'), ('C1 construct', FIG / 'idle_hero' / 'sprite.png'),
                   ('R1 hero', FIG / 'idle_hero_r1' / 'sprite.png')):
        if p.exists():
            panels.append(SH.ours(p, SH.BACKDROP))
            labels.append(lab)
    SH.sheet(panels, labels, 3, 'not blind | the same idle, H 144, x3 | 3D route -> C1 construct -> R1 paint route').save(R1 / 'before_after_x3.png')


def composite():
    fj = FIG / 'idle_hero_r1' / 'face.json'
    rec = json.loads(fj.read_text(encoding='utf-8'))
    pal = A.Palette()
    codes = A.grid_to_codes(rec['rows'], pal)
    face = A.on_bg(Image.fromarray(pal.to_rgba(np.clip(codes, 0, None)), 'RGBA'))
    ox, oy = rec['origin_on_sprite']
    spr = A.on_bg(Image.open(FIG / 'idle_hero_r1' / 'sprite.png').convert('RGBA'))
    crop = spr.crop((ox - 4, oy, ox + 42, oy + 50))
    A.row_sheet([('the painted face (head_paint)', A.zoom(face, 8)), ('composited on the hero (figure_paint)', A.zoom(crop, 8))],
                title='composite: the r1 face as stamped and as it sits on the figure (collar, veil and back hair from the body), x8') \
        .save(R1 / 'composite_face_x8.png')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--seed', type=int, default=20261015)   # mixes the sides (20261011 put ours on A in all four figure sheets)
    a = ap.parse_args()
    R1.mkdir(parents=True, exist_ok=True)
    made = ab_sheets(a.seed)
    faces_library()
    process_face()
    process_figure()
    before_after()
    composite()
    print(len(made), 'A/B sheets +', 'faces_library_x8, process_face, process_figure, before_after_x3, composite_face_x8 in', R1)


if __name__ == '__main__':
    main()
