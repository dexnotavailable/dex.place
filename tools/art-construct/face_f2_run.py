"""Face lane round F2 runner: the lane's stills re-faced with face_f2, the variants, the library, run.json.

  python tools/art-construct/face_f2_run.py [--round 2]

Uses the renders and face passes round F1 left in the lane folder (lanes/face/stills/<still>/px<N>/:
noface, facepass.json, facewin.png; rendered from lanes/face.blend, never rosace.blend). Steps:
  1. keeps a copy of F1's still.png per still as lanes/face/f1_stills/<still>_<px>.png (once), the F1 control
  2. the override step again with ROSACE_FACES=f2 (stills_v2.py --no-render), so still.png carries the F2 face
     (faces.v2_face -> face_f2.compose, picks in art/rosace/construct/faces/f2/stills.json) + rim + collar cross
  3. variants/<still>_<px>_<name>.png: WF-P04 one-axis variants of the pick + the F1 and round-4 controls
  4. library/<still>_<px>_<expr>.png: every expression on that render
  5. run.json (what face_v2_sheets.py and face_v2_record.py read)
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import face_f2  # noqa: E402
import face_v2  # noqa: E402
import face_v2_run as R1  # noqa: E402

LANE = R1.LANE
BLEND = R1.BLEND
PP = R1.PP
STILLS = R1.STILLS
EXPRS = ('confident', 'focused', 'smile', 'serene', 'ignited', 'hurt', 'closed')
# (name, spec overrides, params) - 'base' is the pick itself (stills.json)
# round F2b (the second pass of round 2): one-axis variants of the new pick (WF-P04); the round-F2 face is kept as a
# control (lanes/face/f2_stills/, copied before the pass) next to F1 and the round-4 stamp
OPEN = {'eye_near': 'near_open', 'eye_far': 'far_open', 'eye_far_strong': 'far_open_s'}
VARIANTS = {
    ('idle_hero', 144): [
        ('base', {}, {}),
        ('no_brows', {}, {'brow_over': False}),
        ('brows_i4', {}, {'brow_over': True, 'brow_ch': 'R'}),
        ('rose3', {}, {'mouth': 'rose3'}),
        ('no_form', {}, {'form': False}),
        ('no_clip', {}, {'lash_clip': None}),
    ],
    ('n1_contact', 144): [
        ('base', {}, {}),
        ('no_brows', {}, {'brow_over': False}),
        ('focused3', {}, {'mouth': 'focused3'}),
        ('far_strong', {'eye_far_strong': 'far_focused_s'}, {}),
        ('open_eyes', OPEN, {}),
        ('no_form', {}, {'form': False}),
    ],
    ('q_stamp', 144): [
        ('base', {}, {}),
        ('no_brows', {}, {'brow_over': False}),
        ('u3_mouth', {}, {'mouth': 'u3'}),
        ('no_form', {}, {'form': False}),
    ],
    ('n2_pivot_black', 144): [
        ('base', {}, {}),
        ('no_brows', {}, {'brow_over': False}),
        ('focused', {'eye_near': 'profile_focused'}, {}),
    ],
    ('idle_hero', 80): [
        ('base', {}, {}),
        ('brows', {}, {'brow_over': True, 'brow_ch': 'O'}),
        ('smirk2', {}, {'mouth': 'smirk2'}),
    ],
    ('n1_contact', 80): [('base', {}, {}), ('no_brows', {}, {'brow_over': False}),
                         ('slant_brows', {'brow_near': 'near_focused_slant', 'brow_far': 'far_focused_slant'}, {})],
    ('q_stamp', 80): [('base', {}, {}), ('flat2', {}, {'mouth': 'flat2'}), ('u3', {}, {'mouth': 'u3'})],
    ('n2_pivot_black', 80): [('base', {}, {}), ('brows', {}, {'brow_over': True, 'brow_ch': 'O'})],
}
POSE = {'n2_pivot_black': 'n2_pivot'}


def pick_of(name, px):
    table = json.loads((face_f2.LIB / 'stills.json').read_text(encoding='utf-8'))
    pose = POSE.get(name, name)
    pick = dict(table.get(pose, {}).get('*', {}))
    pick.update(table.get(pose, {}).get(str(px), {}))
    return pick


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--round', type=int, default=2)
    ap.add_argument('--no-apply', action='store_true', help='skip the override step (still.png already F2)')
    a = ap.parse_args()
    out = LANE / 'stills'
    f1 = LANE / 'f1_stills'
    f1.mkdir(parents=True, exist_ok=True)
    for name, pose in STILLS:
        for px in (144, 80):
            dst = f1 / f'{name}_{px}.png'
            if not dst.exists():
                shutil.copyfile(out / name / f'px{px}' / 'still.png', dst)
    if not a.no_apply:
        env = dict(os.environ, ROSACE_FACES='f2')
        r = subprocess.run([sys.executable, str(PP / 'stills_v2.py'), '--blend', BLEND, '--out', str(out), '--no-render',
                            '--hi', '0', '--plain'], env=env, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if r.returncode:
            print(r.stdout[-2000:], r.stderr[-2000:])
            raise SystemExit('override step failed')
    run = {'stills': [], 'library': [], 'round': a.round, 'composer': 'f2'}
    for d in ('variants', 'library'):
        (LANE / d / f'f{a.round}').mkdir(parents=True, exist_ok=True)
    for name, pose in STILLS:
        for px in (144, 80):
            sd = out / name / f'px{px}'
            pick = pick_of(name, px)
            expr, params = pick.get('expr', 'confident'), pick.get('params', {})
            lp = R1.layer_png(sd, pose, px)
            item = {'still': name, 'px': px, 'dir': str(sd), 'base': str(sd), 'png': str(sd / 'still.png'),
                    'expr': expr, 'params': params, 'control': str(R1.CONTROL / name / f'px{px}' / 'still.png'),
                    'f1': str(f1 / f'{name}_{px}.png'), 'variants': []}
            g = face_v2.construct(face_v2.Still(sd))
            spec0 = face_f2.load_spec(pick.get('facing') or g['facing'], expr, px)
            for vname, sover, pover in VARIANTS.get((name, px), [('base', {}, {})]):
                spec = dict(spec0, **sover)
                img, mat, rec, log = face_f2.compose(sd, expr, spec=spec, params=dict(params, **pover),
                                                     facing=pick.get('facing'))
                img = R1.with_layer(R1.glyph_stamp(sd, img), lp)
                p = LANE / 'variants' / f'f{a.round}' / f'{name}_{px}_{vname}.png'
                Image.fromarray(img).save(p)
                item['variants'].append({'name': vname, 'png': str(p), 'spec': sover, 'params': pover})
            f2c = LANE / 'f2_stills' / f'{name}_{px}.png'
            if a.round == 2 and f2c.exists():
                item['f2'] = str(f2c)
                item['variants'].append({'name': 'control F2', 'png': str(f2c)})
            item['variants'].append({'name': 'control F1', 'png': item['f1']})
            item['variants'].append({'name': 'control round-4 stamp', 'png': item['control']})
            run['stills'].append(item)
            lib = {'still': name, 'px': px, 'base': str(sd), 'exprs': []}
            place_params = {k: v for k, v in params.items() if k in ('far_dx', 'near_dx', 'eye_dy')}
            for e in EXPRS:
                img, mat, rec, log = face_f2.compose(sd, e, params=place_params, facing=pick.get('facing'))
                img = R1.with_layer(R1.glyph_stamp(sd, img), lp)
                p = LANE / 'library' / f'f{a.round}' / f'{name}_{px}_{e}.png'
                Image.fromarray(img).save(p)
                lib['exprs'].append([e, str(p)])
            run['library'].append(lib)
    (LANE / f'run_f{a.round}.json').write_text(json.dumps(run, indent=1), encoding='utf-8')
    print('run in', LANE / f'run_f{a.round}.json')


if __name__ == '__main__':
    main()
