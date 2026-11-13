"""Round-3 review sheets (review/rosace/construct/round-3/, git-ignored: the refs are third-party).

  python tools/art-construct/sheets_r3.py [--seed 20261129]

On the stills_sheets.py / sheets.py conventions (each panel on its own native grid, one integer zoom per sheet, blind
A/B panels labelled only A / B, the side shuffled with a seed, key.json saying which side is ours):
  ab_idle_hero_r3_vs_<ref>_x3.png / _x6.png     blind: the R3 hero vs refs 07, 08, 09 (idle) and 04 (centre figure)
  ab_face_vs_<ref>_x1/_x3/_x6/_x10.png          blind: the head as it sits on the R3 hero (collar and shoulders in the
                                                crop, like the ref crops) vs the 07 / 08 / 09 head crops, same native grid
  key.json                                      which side is ours, per sheet
  faces_library_x8.png                          not blind: the 18 painted faces (3 views x 6 expressions) + ref heads
  process_face.png                              the face loop: trial rounds a-e (x5, verdicts), the WF-P11 pick,
                                                the one-axis variants (WF-P04)
  process_figure.png                            the gesture thumbnails with verdicts, the tail A/B, the construction
  before_after_x3.png                           not blind: round-4-fix 3D still | R2 hero | R3 hero
  composite_face_x8.png                         the R3 face stamp | as a figure stamp | on the hero
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
import face_r3  # noqa: E402
import sheets as SH  # noqa: E402
from sheets_r2 import head_crop, label_img  # noqa: E402

R3 = A.ROOT / 'review' / 'rosace' / 'construct' / 'round-3'
FIG = A.ROOT / 'art' / 'rosace' / 'construct' / 'figure'
FACES = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'r3'
R4FIX = Path(r'D:\Dex\Projects\dex-place-art\rosace\build\renders\r4fix\idle_hero\px144')
HERO = FIG / 'idle_hero_r3'


def ab_sheets(seed):
    made = SH.ab(HERO, seed, R3, label='round R3')
    key = json.loads((R3 / 'key.json').read_text(encoding='utf-8'))
    # the face as it sits on the hero, at x1 and x3 too (critique 2a: test at 1x, not only box size)
    rng = random.Random(seed + 1)   # +1: the face sides come out mixed (B, B, A); +5 put ours on B three times
    for hk in SH.HEADS:
        r = SH.ref_img(hk, SH.HEADS)
        o = head_crop(HERO, SH.border_colour(r))
        left = rng.random() < 0.5
        panels = [o, r] if left else [r, o]
        name = f'ab_face_vs_{hk}'
        files = []
        for z in (1, 3, 6, 10):
            fn = f'{name}_x{z}.png'
            SH.sheet(panels, ['A', 'B'], z, f'round R3 | head on the figure vs ref head | x{z}, native grids').save(R3 / fn)
            files.append(fn)
        key['sheets'][name] = {'ours': 'A' if left else 'B', 'ours_still': 'idle_hero_r3 head crop (q34 Confident, R3 paint)',
                               'ref': hk, 'files': files}
        made += files
    key['_doc'] = ("Blind A/B key for review/rosace/construct/round-3 (tools/art-construct/sheets_r3.py). 'ours' names the "
                   "side (A or B) that is Rosace; every panel is on its own native pixel grid at the sheet's zoom. Our still: "
                   "art/rosace/construct/figure/idle_hero_r3 (figure_r3.py) with the R3 painted head (heads_r3.py / "
                   "face_r3.py). Face sheets crop the head as it sits on the figure.")
    key['round'] = 'R3'
    key['seed'] = seed
    A.jdump(key, R3 / 'key.json')
    return made


def text_rows(lines, width=1900, size=13):
    return face_r3.notes_img(lines, width, size)


ROUNDS = (('a', 'confident', 'round a (critique 2a, 2b): the eyes'),
          ('b', 'confident', 'round b (2c): the brows'),
          ('c', 'confident', 'round c (2d): the mouth and the cheek'),
          ('d', 'confident', 'round d (4a, 4b): the hair'),
          ('e', 'ignited', 'round e (2g): the Ignited battle cry'))


def process_face():
    spec = face_r3.spec_of('q34')
    rows = []
    for rnd, expr, title in ROUNDS:
        tr = spec['trials'][rnd]
        rp = R3 / 'face' / f'q34_trial_{rnd}' / 'results.json'
        if not rp.exists():
            continue
        res = json.loads(rp.read_text(encoding='utf-8'))['results']
        ps = []
        for r in res:
            png = R3 / 'face' / f'q34_trial_{rnd}' / f"q34_{expr}__{r['name']}.png"
            im = A.zoom(A.on_bg(Image.open(png).convert('RGBA')).crop((2, 4, 36, 44)), 5)
            v = tr['variants'].get(r['name'], {})
            tag = 'base' if r['name'] == 'base' else ('KEPT' if v.get('kept') else 'rejected')
            ps.append(label_img(im, f"{r['name']} ({r['passed']} pass) {tag}"))
        H = max(p.height for p in ps)
        W = sum(p.width for p in ps) + 12 * (len(ps) + 1)
        s = Image.new('RGB', (W, H + 34), (22, 22, 26))
        ImageDraw.Draw(s).text((12, 6), f'q34 {expr}, trial {title} (x5)', fill=(210, 210, 210), font=A.font(16))
        x = 12
        for p in ps:
            s.paste(p, (x, 30))
            x += p.width + 12
        rows.append(s)
        rows.append(text_rows([f"base: {tr.get('base_verdict', '')}"] +
                              [f"{k}: {v.get('verdict', '')}" for k, v in tr['variants'].items()], max(1400, s.width)))
    pk = R3 / 'face' / 'q34_pick_x3_revealed.png'
    if pk.exists():
        rows.append(label_img(Image.open(pk).convert('RGB'), 'WF-P11, the critic gate: whole faces beside ref 08 at x3 and 1x '
                                                             '(slots shuffled; revealed here, blind sheet q34_pick_x3.png)', 16))
    refs = [(k, A.zoom(v, 5)) for k, v in face_r3.FC.ref_faces()]
    rows.append(A.row_sheet(refs, title='the finish-bar heads at x5 (third-party refs: review/ only)'))
    for v in ('q34', 'front', 'profile'):
        p = R3 / 'face' / f'{v}_one_axis_variants_x6.png'
        if p.exists():
            rows.append(label_img(Image.open(p).convert('RGB'), f'{v}: WF-P04 one-axis variants (eye line, brows, mouth row, '
                                                                 'each 1 px up); none beat its base', 16))
    A.stack(rows).save(R3 / 'process_face.png')


def process_figure():
    rows = [Image.open(R3 / 'figure' / 'idle_hero_r3_thumbs.png').convert('RGB')]
    ab = R3 / '_work' / 'render_ab'
    alts = (('hero (t7, R3 tail clumps)', HERO / 'sprite.png', 'KEPT'),
            ('R2 tail strands', ab / 'idle_hero_r3_ab_r2tail' / 'sprite.png',
             'rejected: two I4 lines and two lighter strands read as stripes down the back (critique 4a); 143 rules pass '
             'against the hero 146'))
    ps = []
    for i, (nm, p, cap) in enumerate(alts):
        if p.exists():
            im = A.on_bg(Image.open(p).convert('RGBA')).crop((30, 40, 140, 206))
            ps.append((f'{i + 1} ' + ('KEPT' if cap == 'KEPT' else 'rejected'), A.zoom(im, 3)))
    rows.append(A.row_sheet(ps, title='render A/B at x3 (not blind); verdicts below and in ART-RULES 10, round R3'))
    rows.append(text_rows([f'{i + 1} {nm}: {cap}' for i, (nm, p, cap) in enumerate(alts)]))
    c = R3 / 'figure' / 'idle_hero_r3_construct.png'
    if c.exists():
        rows.append(Image.open(c).convert('RGB'))
    A.stack(rows).save(R3 / 'process_figure.png')


def before_after():
    panels, labels = [], []
    for lab, p in (('round-4-fix (3D route)', R4FIX / 'still.png'), ('R2 hero', FIG / 'idle_hero_r2' / 'sprite.png'),
                   ('R3 hero', HERO / 'sprite.png')):
        if p.exists():
            panels.append(SH.ours(p, SH.BACKDROP))
            labels.append(lab)
    SH.sheet(panels, labels, 3, 'not blind | the same idle, H 144, x3 | 3D route -> R2 -> R3').save(R3 / 'before_after_x3.png')
    # the heads alone, as they sit on the figures
    hp, hl = [], []
    for lab, d in (('R2 head on the hero', FIG / 'idle_hero_r2'), ('R3 head on the hero', HERO)):
        hp.append(head_crop(d, SH.BACKDROP))
        hl.append(lab)
    SH.sheet(hp, hl, 8, 'not blind | the head as it sits on the figure, x8 | R2 -> R3').save(R3 / 'before_after_head_x8.png')


def composite():
    rec = json.loads((HERO / 'face.json').read_text(encoding='utf-8'))
    pal = A.Palette()
    face = A.on_bg(Image.fromarray(pal.to_rgba(np.clip(A.grid_to_codes(rec['rows'], pal), 0, None)), 'RGBA'))
    st = A.on_bg(Image.open(FACES / 'q34_confident_144.png').convert('RGBA'))
    A.row_sheet([('1 the R3 stamp', A.zoom(st, 8)),
                 ('2 as a figure stamp', A.zoom(face, 8)),
                 ('3 on the hero', A.zoom(head_crop(HERO, SH.BACKDROP), 8))],
                title='composite x8: 1 q34 Confident as painted (heads_r3) | 2 as a figure stamp (the back hair under the '
                      'chin is left to the body layer) | 3 on the hero').save(R3 / 'composite_face_x8.png')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--seed', type=int, default=20261129)
    a = ap.parse_args()
    R3.mkdir(parents=True, exist_ok=True)
    kp = R3 / 'key.json'
    if kp.exists():
        kp.unlink()            # a fresh key per run: the sides are re-drawn from the seed
    made = ab_sheets(a.seed)
    face_r3.library_sheet()
    process_face()
    process_figure()
    before_after()
    composite()
    print(len(made), 'A/B sheets + faces_library_x8, process_face, process_figure, before_after_x3, before_after_head_x8, '
                     'composite_face_x8 in', R3)


if __name__ == '__main__':
    main()
