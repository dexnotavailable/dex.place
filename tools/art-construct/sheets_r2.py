"""Round-2 review sheets (review/rosace/construct/round-2/, git-ignored: the refs are third-party).

  python tools/art-construct/sheets_r2.py [--seed 20261029]

On the stills_sheets.py / sheets.py conventions (each panel on its own native grid, one integer zoom per sheet,
blind A/B panels labelled only A / B, the side shuffled with a seed, key.json saying which side is ours):
  ab_idle_hero_r2_vs_<ref>_x3.png / _x6.png   blind: the R2 hero vs refs 07, 08, 09 (idle) and 04 (centre figure)
  ab_face_vs_<ref>_x1.png / _x6.png / _x10.png blind: the head as it sits on the R2 hero (collar and shoulders in the
                                              crop, like the ref crops) vs the 07 / 08 / 09 head crops
  key.json                                    which side is ours, per sheet
  faces_library_x8.png                        not blind: the 18 painted faces (3 views x 6 expressions) + ref heads
  process_face.png                            the face loop: trial rounds a and b (x6, with verdicts) and the
                                              one-axis variants (WF-P04)
  process_figure.png                          the eight gesture thumbnails with verdicts; the render A/Bs
  before_after_x3.png                         not blind: round-4-fix 3D still | R1 hero | R2 hero
  composite_face_x8.png                       the R2 face stamp | the same face on the hero
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
import face_r2  # noqa: E402
import sheets as SH  # noqa: E402

R2 = A.ROOT / 'review' / 'rosace' / 'construct' / 'round-2'
FIG = A.ROOT / 'art' / 'rosace' / 'construct' / 'figure'
FACES = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'r2'
R4FIX = Path(r'D:\Dex\Projects\dex-place-art\rosace\build\renders\r4fix\idle_hero\px144')
HERO = FIG / 'idle_hero_r2'


def label_img(im, text, size=14):
    out = Image.new('RGB', (im.width, im.height + size + 10), (22, 22, 26))
    ImageDraw.Draw(out).text((2, 2), text, fill=(255, 235, 150), font=A.font(size))
    out.paste(im.convert('RGB'), (0, size + 10))
    return out


def head_crop(sprite_dir, bg):
    """the head as composited on the sprite: the face stamp's canvas box on the sprite (38 x 42 from its top row)"""
    rec = json.loads((sprite_dir / 'face.json').read_text(encoding='utf-8'))
    ox, oy = rec['origin_on_sprite']
    spr = Image.open(sprite_dir / 'sprite.png').convert('RGBA')
    base = Image.new('RGB', spr.size, bg)
    base.paste(spr, (0, 0), spr)
    return base.crop((ox, oy + 4, ox + 38, oy + 46))


def ab_sheets(seed):
    made = SH.ab(HERO, seed, R2, label='round R2')
    key = json.loads((R2 / 'key.json').read_text(encoding='utf-8'))
    # the face: as it sits on the hero (the R1 sheets used the bare stamp); x1 added (critique 3: judge at x6 and 1x)
    rng = random.Random(seed + 3)   # +3: the face sides come out mixed (B, A, B); +1 put ours on B three times
    for hk in SH.HEADS:
        r = SH.ref_img(hk, SH.HEADS)
        o = head_crop(HERO, SH.border_colour(r))
        left = rng.random() < 0.5
        panels = [o, r] if left else [r, o]
        name = f'ab_face_vs_{hk}'
        files = []
        for z in (1, 6, 10):
            fn = f'{name}_x{z}.png'
            SH.sheet(panels, ['A', 'B'], z, f'round R2 | head on the figure vs ref head | x{z}, native grids').save(R2 / fn)
            files.append(fn)
        key['sheets'][name] = {'ours': 'A' if left else 'B', 'ours_still': 'idle_hero_r2 head crop (q34 Confident, R2 paint)',
                               'ref': hk, 'files': files}
        made += files
    key['_doc'] = ("Blind A/B key for review/rosace/construct/round-2 (tools/art-construct/sheets_r2.py). 'ours' names the side "
                   "(A or B) that is Rosace; every panel is on its own native pixel grid at the sheet's zoom. Our still: "
                   "art/rosace/construct/figure/idle_hero_r2 (figure_r2.py) with the R2 painted head (heads_r2.py / face_r2.py). "
                   "Face sheets crop the head as it sits on the figure.")
    key['round'] = 'R2'
    key['seed'] = seed
    A.jdump(key, R2 / 'key.json')
    return made


def text_rows(lines, width=1900, size=13):
    return face_r2.notes_img(lines, width, size)


def process_face():
    spec = face_r2.spec_of('q34')
    rows = []
    for rnd, title in (('a', 'q34 Confident, trial round a: one design axis each on the repainted base (x5)'),
                       ('b', 'round b: on round a\'s winners (iris_deep + pupil) (x5)'),
                       ('c', 'round c: smug or tired? the lid line, the mouth corner, the brow angle (x5)')):
        tr = spec['trials'][rnd]
        res = json.loads((R2 / 'face' / f'q34_trial_{rnd}' / 'results.json').read_text(encoding='utf-8'))['results']
        ps = []
        for r in res:
            png = R2 / 'face' / f'q34_trial_{rnd}' / f"q34_confident__{r['name']}.png"
            im = A.zoom(A.on_bg(Image.open(png).convert('RGBA')).crop((2, 4, 36, 44)), 5)
            v = tr['variants'].get(r['name'], {})
            tag = 'base' if r['name'] == 'base' else ('KEPT' if v.get('kept') else 'rejected')
            ps.append(label_img(im, f"{r['name']} ({r['passed']} pass) {tag}"))
        H = max(p.height for p in ps)
        W = sum(p.width for p in ps) + 12 * (len(ps) + 1)
        s = Image.new('RGB', (W, H + 34), (22, 22, 26))
        ImageDraw.Draw(s).text((12, 6), title, fill=(210, 210, 210), font=A.font(16))
        x = 12
        for p in ps:
            s.paste(p, (x, 30))
            x += p.width + 12
        rows.append(s)
        rows.append(text_rows([f"{k}: {v.get('verdict', '')}" for k, v in tr['variants'].items()], max(1400, s.width)))
    refs = [(k, A.zoom(v, 5)) for k, v in face_r2.FC.ref_faces()]
    rows.append(A.row_sheet(refs, title='the finish-bar heads at x5 (third-party refs: review/ only)'))
    for v in ('q34', 'front', 'profile'):
        p = R2 / 'face' / f'{v}_one_axis_variants_x6.png'
        if p.exists():
            rows.append(label_img(Image.open(p).convert('RGB'), f'{v}: WF-P04 one-axis variants (eye line, brows, mouth row, '
                                                                 'each 1 px up); no variant beat its base', 16))
    A.stack(rows).save(R2 / 'process_face.png')


def process_figure():
    rows = [Image.open(R2 / 'figure' / 'idle_hero_r2_thumbs.png').convert('RGB')]
    spec = json.loads((FIG / 'idle_hero_r2.gesture.json').read_text(encoding='utf-8'))
    ab = R2 / '_work' / 'render_ab'
    alts = (('hero (t7, all R2 passes)', HERO / 'sprite.png', 'KEPT'),
            ('no paint passes', ab / 'idle_hero_r2_ab_nopasses' / 'sprite.png',
             'rejected: the bodice back to one flat W2 plate, the veil a 1 px line again'),
            ('capsule hands (R1)', ab / 'idle_hero_r2_ab_capsulehands' / 'sprite.png',
             'rejected: the hip hand is a lump with no fingers down the hip (HD-P04)'),
            ('R1 masses', ab / 'idle_hero_r2_ab_nomass' / 'sprite.png',
             'rejected: thinner thighs and hips, the arm starts as a tube'),
            ('no bodice pass', ab / 'idle_hero_r2_ab_notorso' / 'sprite.png', 'rejected: no terminator on the bodice'),
            ('no density passes', ab / 'idle_hero_r2_ab_nodensity' / 'sprite.png',
             'rejected: flat stockings, flat thighs, one dark hair column'))
    ps = []
    for i, (nm, p, cap) in enumerate(alts):
        if p.exists():
            im = A.on_bg(Image.open(p).convert('RGBA')).crop((30, 40, 140, 206))
            ps.append((f'{i + 1} ' + ('KEPT' if cap == 'KEPT' else 'rejected'), A.zoom(im, 3)))
    rows.append(A.row_sheet(ps, title='full-size render A/Bs at x3 (not blind); verdicts below and in ART-RULES 10, round R2'))
    rows.append(text_rows([f'{i + 1} {nm}: {cap}' for i, (nm, p, cap) in enumerate(alts)]))
    c = FIG.parent.parent.parent.parent / 'review' / 'rosace' / 'construct' / 'round-2' / 'figure' / 'idle_hero_r2_construct.png'
    if c.exists():
        rows.append(Image.open(c).convert('RGB'))
    A.stack(rows).save(R2 / 'process_figure.png')


def before_after():
    panels, labels = [], []
    for lab, p in (('round-4-fix (3D route)', R4FIX / 'still.png'), ('R1 hero', FIG / 'idle_hero_r1' / 'sprite.png'),
                   ('R2 hero', HERO / 'sprite.png')):
        if p.exists():
            panels.append(SH.ours(p, SH.BACKDROP))
            labels.append(lab)
    SH.sheet(panels, labels, 3, 'not blind | the same idle, H 144, x3 | 3D route -> R1 paint route -> R2').save(R2 / 'before_after_x3.png')


def composite():
    rec = json.loads((HERO / 'face.json').read_text(encoding='utf-8'))
    pal = A.Palette()
    face = A.on_bg(Image.fromarray(pal.to_rgba(np.clip(A.grid_to_codes(rec['rows'], pal), 0, None)), 'RGBA'))
    st = A.on_bg(Image.open(FACES / 'q34_confident_144.png').convert('RGBA'))
    A.row_sheet([('1 the R2 stamp', A.zoom(st, 8)),
                 ('2 as a figure stamp', A.zoom(face, 8)),
                 ('3 on the hero', A.zoom(head_crop(HERO, SH.BACKDROP), 8))],
                title='composite x8: 1 q34 Confident as painted (heads_r2) | 2 as a figure stamp (the back hair under the chin is left to the body layer) | 3 on the hero').save(R2 / 'composite_face_x8.png')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--seed', type=int, default=20261029)
    a = ap.parse_args()
    R2.mkdir(parents=True, exist_ok=True)
    kp = R2 / 'key.json'
    if kp.exists():
        kp.unlink()            # a fresh key per run: the sides are re-drawn from the seed
    made = ab_sheets(a.seed)
    face_r2.library_sheet()
    process_face()
    process_figure()
    before_after()
    composite()
    print(len(made), 'A/B sheets + faces_library_x8, process_face, process_figure, before_after_x3, composite_face_x8 in', R2)


if __name__ == '__main__':
    main()
