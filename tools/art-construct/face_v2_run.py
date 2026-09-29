"""Face lane round runner: stills from the lane build, the face pass, variants, library, run.json.

  python tools/art-construct/face_v2_run.py [--render] [--round 1]

Everything is written under the lane folder (default D:\\Dex\\Projects\\dex-place-art\\rosace\\build\\lanes\\face):
  stills/<still>/px<N>/...   stills_v2.py on lanes/face.blend (never rosace.blend), then
                             author_faces_pass.py per still, then the override step again, so the
                             still.png carries the v2 face (faces.v2_face) + the rim + the collar cross
  variants/<still>_<px>_<variant>.png   WF-P04 variants of the still's face, with the same override layer
  library/<still>_<px>_<expr>.png       every expression composed on that render
  run.json                              what the sheets read (face_v2_sheets.py)
The face choice per still is art/rosace/construct/faces/v2/stills.json; the variants are VARIANTS below.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import face_v2  # noqa: E402

PP = A.ROOT / 'tools' / 'pixel-pipeline'
BLEND = r'D:\Dex\Projects\dex-place-art\rosace\build\lanes\face.blend'
LANE = Path(r'D:\Dex\Projects\dex-place-art\rosace\build\lanes\face')
CONTROL = Path(r'D:\Dex\Projects\dex-place-art\rosace\build\renders\final_v2')   # the round-4 stamps on v2
STILLS = [('idle_hero', 'idle_hero'), ('n1_contact', 'n1_contact'), ('q_stamp', 'q_stamp'),
          ('n2_pivot_black', 'n2_pivot')]
EXPRS = ('confident', 'focused', 'smile', 'serene', 'ignited', 'hurt', 'closed')
# WF-P04: variants that differ from the pick on one axis, per expression and size
# (name, spec overrides, params); 'base' is the pick itself
VARIANTS = {
    ('confident', 144): [('base', {}, {}), ('eye_up', {}, {'eye_dy': -1}), ('wide_windows', {}, {'window': 'brow'}),
                         ('roll2', {}, {'max_roll': None}),
                         ('dimple_mouth', {'mouth': 'confident'}, {}),
                         ('lash_window', {}, {'window': 'lash'}), ('short_near', {'eye_near': 'near_open'}, {}),
                         ('r3_eyes', {'eye_near': 'near_r3', 'eye_far': 'far_r3'}, {}), ('no_blush', {}, {'blush': False})],
    ('focused', 144): [('base', {}, {}), ('pressed_mouth', {}, {'mouth': 'focused'}), ('wide_windows', {}, {'window': 'brow'}),
                       ('soft_brows', {'brow_near': 'near_focused', 'brow_far': 'far_focused'}, {}),
                       ('lash_window', {}, {'window': 'lash'})],
    ('smile', 144): [('base', {}, {}), ('open_crescent', {'eye_near': 'near_smile_open', 'eye_far': 'far_smile_open'}, {}),
                     ('arcs_no_brows', {}, {'brows': False}), ('closed_mouth', {'mouth': 'smile_closed'}, {})],
    ('confident', 80): [('base', {}, {}), ('brows', {'brow_near': 'near_confident', 'brow_far': 'far_confident'}, {}),
                        ('bright_eye', {'eye_near': 'near_open_bright'}, {}), ('flat_mouth', {'mouth': 'confident_flat'}, {})],
    ('focused', 80): [('base', {}, {}), ('brows', {'brow_near': 'near_focused', 'brow_far': 'far_focused'}, {})],
    ('smile', 80): [('base', {}, {}), ('no_blush', {}, {'blush': False})],
}


def sh(cmd):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        print((r.stdout or '')[-2000:], (r.stderr or '')[-2000:])
        raise SystemExit(f'failed: {cmd[:3]}')
    return r.stdout


def layer_png(still, pose, px):
    return LANE / 'stills' / '_layers' / f'{pose}_{px}.png'


def with_layer(img, lp):
    out = img.copy()
    if lp.exists():
        lay = np.asarray(Image.open(lp).convert('RGBA'))
        on = lay[..., 3] > 0
        er = on & (lay[..., 0] == 255) & (lay[..., 1] == 0) & (lay[..., 2] == 255)
        out[on & ~er] = lay[on & ~er]
        out[er] = 0
    return out


def glyph_stamp(still_dir, img):
    """the collar cross glyph, as the override step stamps it with the face"""
    sys.path.insert(0, str(PP))
    import glyphs
    meta = json.loads((Path(still_dir) / 'meta.json').read_text())
    meta['_still'], meta['_tag'] = str(still_dir), 'noface'
    glyphs.apply(meta, img, {})
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--render', action='store_true', help='re-render the stills from the lane build first')
    ap.add_argument('--round', type=int, default=1)
    a = ap.parse_args()
    out = LANE / 'stills'
    if a.render:
        sh([sys.executable, PP / 'stills_v2.py', '--blend', BLEND, '--out', out, '--hi', '0', '--plain'])
        for name, pose in STILLS:
            sh([sys.executable, PP / 'blender_env.py', 'run', '--python-exit-code', '1', '--python',
                PP / 'author_faces_pass.py', '--', '--blend', BLEND, '--pose', A.ROOT / 'art' / 'rosace' / 'poses' / f'{pose}.json',
                '--still', out / name / 'px144', '--still', out / name / 'px80'])
            if name == 'n2_pivot_black':      # the white-thong still shares the render geometry
                for px in (144, 80):
                    for f in ('facepass.json', 'facewin.png'):
                        src, dst = out / name / f'px{px}' / f, out / 'n2_pivot_white' / f'px{px}' / f
                        dst.write_bytes(src.read_bytes())
    # the override step again, now with the face pass in place (faces.v2_face)
    sh([sys.executable, PP / 'stills_v2.py', '--blend', BLEND, '--out', out, '--no-render', '--hi', '0', '--plain'])
    run = {'stills': [], 'library': [], 'round': a.round}
    table = json.loads((face_v2.LIB / 'stills.json').read_text(encoding='utf-8'))
    for d in ('variants', 'library'):
        (LANE / d).mkdir(parents=True, exist_ok=True)
    for name, pose in STILLS:
        for px in (144, 80):
            sd = out / name / f'px{px}'
            pick = dict(table.get(pose, {}).get('*', {}))
            pick.update(table.get(pose, {}).get(str(px), {}))
            expr = pick.get('expr', 'confident')
            params = pick.get('params', {})
            lp = layer_png(sd, pose, px)
            item = {'still': name, 'px': px, 'dir': str(sd), 'base': str(sd), 'png': str(sd / 'still.png'),
                    'expr': expr, 'params': params,
                    'control': str(CONTROL / name / f'px{px}' / 'still.png'), 'variants': []}
            spec0 = face_v2.load_spec(pick.get('facing') or face_v2.construct(face_v2.Still(sd)).get('facing'), expr, px)
            for vname, sover, pover in VARIANTS.get((expr, px), [('base', {}, {})]):
                spec = dict(spec0, **sover)
                img, mat, rec, log = face_v2.compose(sd, expr, spec=spec, params=dict(params, **pover), facing=pick.get('facing'))
                img = with_layer(glyph_stamp(sd, img), lp)
                p = LANE / 'variants' / f'{name}_{px}_{vname}.png'
                Image.fromarray(img).save(p)
                item['variants'].append({'name': vname, 'png': str(p), 'spec': sover, 'params': pover})
            item['variants'].append({'name': 'control (round-4 stamp)', 'png': item['control']})
            run['stills'].append(item)
            lib = {'still': name, 'px': px, 'base': str(sd), 'exprs': []}
            for e in EXPRS:
                # the still's placement params only (window etc.); its feature picks belong to its own expression
                lp_params = {k: v for k, v in params.items() if k not in ('mouth',)}
                img, mat, rec, log = face_v2.compose(sd, e, params=lp_params, facing=pick.get('facing'))
                img = with_layer(glyph_stamp(sd, img), lp)
                p = LANE / 'library' / f'{name}_{px}_{e}.png'
                Image.fromarray(img).save(p)
                lib['exprs'].append([e, str(p)])
            run['library'].append(lib)
    (LANE / 'run.json').write_text(json.dumps(run, indent=1), encoding='utf-8')
    print('run.json in', LANE)


if __name__ == '__main__':
    main()
