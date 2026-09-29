"""Face lane round sheets (review/rosace/art/face/round-<n>/, git-ignored: the refs are third-party).

  python tools/art-construct/face_v2_sheets.py --round 1

Reads the lane's composed stills (face_v2_run.py output: <lane>/stills/<still>/px<N>/still.png plus
the variant composites in <lane>/variants/) and writes:
  ab_face_<still>_<px>_vs_<ref>_x1/_x3/_x6.png   blind A/B: our head as it sits on the render vs a
                                                   finish-bar head crop (144: refs 07/08/09; 80: ref 05)
  pick_<still>_<px>_x3.png / _x1.png               WF-P11 pick: the variants and the control (the
                                                   round-4 stamp on the same render), shuffled, with
                                                   the ref head beside them, letters only
  library_<px>_x8.png                              not blind: every expression composed on each still
  parts_<still>_<px>_x10.png                       not blind: eyes / brows / mouth crops, before and after
  key.json                                         which letter is what, the seed, the ref crops
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
import sheets as SH  # noqa: E402

REVIEW = A.ROOT / 'review' / 'rosace' / 'art' / 'face'
# round F2: the F1 boxes cut the ref head at the panel edge (critic F1: '80 A/B invalid'); these frame two whole heads
REF05 = ('05-anim-sailormars-sheet_1x.png', {'ref05a': (336, 108, 366, 138), 'ref05b': (716, 3, 746, 33)})
BG = SH.BACKDROP


def ref_heads(px):
    if px == 144:
        return {k: SH.ref_img(k, SH.HEADS) for k in SH.HEADS}
    f, boxes = REF05
    im = Image.open(SH.NATIVE / f).convert('RGB')
    return {k: im.crop(b) for k, b in boxes.items()}


def head_box(still_dir, px):
    fp = json.loads((Path(still_dir) / 'facepass.json').read_text())
    cx, cy = fp['chin'][:2]
    if px == 144:
        w, up, down = 40, 30, 10
    else:
        w, up, down = 30, 20, 10
    x0 = int(round(cx - w / 2))
    y0 = int(round(cy - up))
    return (x0, y0, x0 + w, y0 + up + down)


def head_crop(png, box, bg=BG):
    im = Image.open(png).convert('RGBA').crop(box)
    return A.on_bg(im, bg)


def labelled(panels, labels, z, header):
    return SH.sheet(panels, labels, z, header)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--round', type=int, default=1)
    ap.add_argument('--lane', default=r'D:\Dex\Projects\dex-place-art\rosace\build\lanes\face')
    ap.add_argument('--seed', type=int, default=None)
    ap.add_argument('--run', default='run.json', help='run file in the lane folder (round F2: run_f2.json)')
    a = ap.parse_args()
    out = REVIEW / f'round-{a.round}'
    out.mkdir(parents=True, exist_ok=True)
    lane = Path(a.lane)
    run = json.loads((lane / a.run).read_text())
    seed = a.seed if a.seed is not None else random.randrange(10 ** 9)
    rng = random.Random(seed)
    key = {'_doc': "Blind A/B key for review/rosace/art/face/round-%d (face_v2_sheets.py). 'ours' names the side "
                   "that is Rosace; pick sheets list what each letter is. Every panel is on its own native pixel "
                   "grid at the sheet's zoom; our crops come from the lane's composed stills (the face on the "
                   "real v2 render, hair and collar included, like the ref crops)." % a.round,
           'seed': seed, 'lane': str(lane), 'sheets': {},
           'refs': {'144': {k: {'file': v[0], 'crop': v[1]} for k, v in SH.HEADS.items()},
                    '80': {k: {'file': REF05[0], 'crop': b} for k, b in REF05[1].items()}}}
    for item in run['stills']:
        name, px, still = item['still'], item['px'], item['dir']
        box = head_box(item['base'], px)
        ours = head_crop(item['png'], box)
        for rk, r in ref_heads(px).items():
            left = rng.random() < 0.5
            panels = [ours, r] if left else [r, ours]
            files = []
            for z in (1, 3, 6):
                fn = f'ab_face_{name}_{px}_vs_{rk}_x{z}.png'
                labelled(panels, ['A', 'B'], z, f'face round F{a.round} | head vs ref head | x{z}, native grids').save(out / fn)
                files.append(fn)
            key['sheets'][f'ab_face_{name}_{px}_vs_{rk}'] = {'ours': 'A' if left else 'B', 'expr': item['expr'],
                                                           'files': files}
        # WF-P11 pick: variants + control, shuffled, beside the ref
        vs = item.get('variants', [])
        if vs:
            cands = [(v['name'], head_crop(v['png'], box)) for v in vs]
            rng.shuffle(cands)
            letters = [chr(ord('A') + i) for i in range(len(cands))]
            rk = 'ref08' if px == 144 else 'ref05a'
            r = ref_heads(px)[rk]
            for z in (1, 3):
                fn = f'pick_{name}_{px}_x{z}.png'
                labelled([c[1] for c in cands] + [r], letters + ['ref'], z,
                         f'face round F{a.round} | {name} {px} | which one would you pull for? | x{z}').save(out / fn)
            key['sheets'][f'pick_{name}_{px}'] = {'letters': {l: c[0] for l, c in zip(letters, cands)}, 'ref': rk,
                                                 'files': [f'pick_{name}_{px}_x1.png', f'pick_{name}_{px}_x3.png']}
    # expression library on the renders (not blind)
    for px in (144, 80):
        rows = []
        for item in run.get('library', []):
            if item['px'] != px:
                continue
            box = head_box(item['base'], px)
            z = 6 if px == 144 else 9
            panels = [('%s' % e, A.zoom(head_crop(p, box), z)) for e, p in item['exprs']]
            rows.append(A.row_sheet(panels, title=f"{item['still']} {px}: every expression composed on this render"))
        if rows:
            A.stack(rows).save(out / f'library_{px}_x{6 if px == 144 else 9}.png')
    # parts: before / after crops of the eyes and mouth (not blind)
    for item in run['stills']:
        name, px = item['still'], item['px']
        box = head_box(item['base'], px)
        before = head_crop(Path(item['base']) / 'noface.png', box)
        ctl = head_crop(item['control'], box) if item.get('control') else None
        f1 = head_crop(item['f1'], box) if item.get('f1') else None
        after = head_crop(item['png'], box)
        panels = [('render (no face)', A.zoom(before, 10 if px == 144 else 14))]
        if ctl is not None:
            panels.append(('control: round-4 stamp', A.zoom(ctl, 10 if px == 144 else 14)))
        if f1 is not None:
            panels.append(('control: F1', A.zoom(f1, 10 if px == 144 else 14)))
        tag = f"F{a.round}"
        if item.get('f2'):                  # round F2b: the first F2 pass is a control too
            panels.append(('control: F2 pass 1', A.zoom(head_crop(item['f2'], box), 10 if px == 144 else 14)))
            tag = f"F{a.round}b"
        panels.append((f"{tag}: {item['expr']}", A.zoom(after, 10 if px == 144 else 14)))
        A.row_sheet(panels, title=f'{name} {px}: the face on the v2 render, before / control / after').save(
            out / f'parts_{name}_{px}_x{10 if px == 144 else 14}.png')
    (out / 'key.json').write_text(json.dumps(key, indent=1), encoding='utf-8')
    print('sheets in', out, 'seed', seed)


if __name__ == '__main__':
    main()
