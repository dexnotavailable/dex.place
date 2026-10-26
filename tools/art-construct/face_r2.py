"""Round R2 face library: build, trial and review the heads painted in heads_r2.py.

  python tools/art-construct/heads_r2.py                                  # (re)write the painted head specs
  python tools/art-construct/face_r2.py build --view q34 --expr confident  # one face -> faces/r2/<view>_<expr>_144.*
  python tools/art-construct/face_r2.py all                               # the library: 3 views x confident/focused/radiant (+ q34 extras)
  python tools/art-construct/face_r2.py preview --view q34 --expr confident   # x16 grid + construction + refs (review/.../round-2/_work)
  python tools/art-construct/face_r2.py trial --view q34 --round a        # a trial round: the spec's trials[<round>]
  python tools/art-construct/face_r2.py sheets                            # construction sheets + library sheet

A trial round (WF-P04 applied to a head) is a list of variants in the spec's "trials" -> {round: {variants}}.
Each variant is a head_paint variant patch (layers / expressions / anchors / rows) that changes one design
axis. Every variant is built, scored on the FC and HR rules (rules_check.py) and put beside the ref heads at
x6 and at 1x; the verdict (the painter's call, with the rule that decided it) is written back into the spec
and into ART-RULES 10.

Uses head_paint.Head for composition and landmarks, so rules_check grades R2 exactly like R1.
"""
import argparse
import copy
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import face_construct as FC  # noqa: E402
import head_paint as HP  # noqa: E402

LIB = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'r2'
REV = A.ROOT / 'review' / 'rosace' / 'construct' / 'round-2'
SHEETS = REV / 'face'
WORK = REV / '_work'
HP.LIBDIR = LIB
HP.SHEETS = SHEETS
SIX = ('confident', 'focused', 'radiant', 'serene', 'ignited', 'hurt')
LIBRARY = {'q34': SIX, 'front': SIX, 'profile': SIX}      # the brief asks for confident / focused / smile; all six are painted
BG = (104, 102, 98)


def spec_of(view):
    return json.loads((LIB / f'head_{view}.json').read_text(encoding='utf-8'))


def build(view, expr, variant=None, name=None, out=None, spec=None):
    spec = spec or spec_of(view)
    h = HP.Head(spec, expr, variant=variant)
    h.compose()
    name = name or f'{view}_{expr}_144'
    out = Path(out) if out else LIB
    out.mkdir(parents=True, exist_ok=True)
    rec = h.record(name)
    rec['_doc'] = rec['_doc'].replace('round R1', 'round R2').replace(f'faces/r1/head_{view}.json', f'faces/r2/head_{view}.json '
                                                                     '(painted by tools/art-construct/heads_r2.py)')
    rec['params']['route'] = 'r2 painted strokes'
    rec['params']['bangs'] = spec.get('bangs', [])
    A.jdump(rec, out / f'{name}.json')
    h.cv.save(h.pal, out / f'{name}.png')
    h.cv.save_layers(str(out / name))
    return h, rec


def img(h):
    return HP.img_of(h.cv.code, h.pal, BG)


def score(path, faces_dir=LIB):
    import rules_check as RC
    ctx = RC.Ctx(face=path, faces_dir=faces_dir)
    ids = [i for i in RC.CHECKS if i.startswith(('FC', 'HR'))]
    rows = RC.run(ctx, ids)
    ok = [r['id'] for r in rows if r['status'].startswith('PASS')]
    bad = [f"{r['id']} {r['measured']}" for r in rows if r['status'].startswith('FAIL')]
    return ok, bad, rows


def grid_img(fin, z, w, h):
    big = A.zoom(fin, z)
    d = ImageDraw.Draw(big)
    for x in range(0, w + 1, 5):
        d.line([(x * z, 0), (x * z, h * z)], fill=(150, 150, 60))
    for y in range(0, h + 1, 5):
        d.line([(0, y * z), (w * z, y * z)], fill=(150, 150, 60))
    for x in range(0, w, 5):
        d.text((x * z + 2, 1), str(x), fill=(255, 255, 0))
    for y in range(0, h, 5):
        d.text((1, y * z + 2), str(y), fill=(255, 255, 0))
    return big


def preview(view, expr, z=16, variant=None, tag=''):
    h, rec = build(view, expr, variant=variant, name=f'_preview_{view}_{expr}{tag}', out=WORK)
    fin = img(h)
    f = HP.construction(view)
    s = A.row_sheet([(f'{view} {expr} x{z}', grid_img(fin, z, HP.W, HP.H)),
                     ('on the construction', f.g.draw(A.zoom(fin, z), z, layers=('grid', 'ball'))),
                     ('x3', A.zoom(fin, 3)), ('1x', fin)] + [(k, A.zoom(v, 6)) for k, v in FC.ref_faces()])
    WORK.mkdir(parents=True, exist_ok=True)
    p = WORK / f'preview_{view}_{expr}{tag}.png'
    s.save(p)
    ok, bad, _ = score(WORK / f'_preview_{view}_{expr}{tag}.json')
    return p, ok, bad


def merge_variant(a, b):
    out = copy.deepcopy(a)
    for k, v in b.items():
        if k == 'expressions':
            ex = out.setdefault('expressions', {})
            for e, ov in v.items():
                ex.setdefault(e, {}).update(copy.deepcopy(ov))
        elif isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = {**out[k], **copy.deepcopy(v)}
        else:
            out[k] = copy.deepcopy(v)
    return out


def trial(view, rnd, expr=None):
    """one trial round: base + each variant, scored and sheeted with the refs at x6 and 1x"""
    spec = spec_of(view)
    tr = spec.get('trials', {}).get(rnd)
    if not tr:
        raise SystemExit(f'no trials[{rnd}] in head_{view}.json')
    expr = expr or tr.get('expr', 'confident')
    out = SHEETS / f'{view}_trial_{rnd}'
    out.mkdir(parents=True, exist_ok=True)
    items = [('base', {'idea': tr.get('base_idea', 'the head as painted'), 'verdict': tr.get('base_verdict', '')})]
    items += list(tr['variants'].items())
    res, panels, small = [], [], []
    bp = tr.get('base_patch') or {}
    for name, v in items:
        e = v.get('expr', expr)
        # a round is judged against the base as it was when the round ran (base_patch undoes later folds)
        var = merge_variant(bp, {} if name == 'base' else v) or None
        h, rec = build(view, e, variant=var, name=f'{view}_{e}__{name}', out=out, spec=spec)
        ok, bad, _ = score(out / f'{view}_{e}__{name}.json')
        res.append({'name': name, 'axis': v.get('axis', ''), 'idea': v.get('idea', ''), 'passed': len(ok),
                    'failed': bad, 'verdict': v.get('verdict', ''), 'kept': v.get('kept')})
        tag = ' KEPT' if v.get('kept') else (' (rejected)' if v.get('kept') is False else '')
        panels.append((f'{name}: {len(ok)} pass / {len(bad)} fail{tag}', A.zoom(img(h), 6)))
        small.append((name, A.zoom(img(h), 2)))
    A.jdump({'_doc': f'face trial round {rnd} (round R2): one axis per variant, scored on FC/HR with rules_check.py; '
                     'verdicts are the painter call beside the refs and are also in the head spec',
             'view': view, 'expr': expr, 'round': rnd, 'results': res}, out / 'results.json')
    refs = [(k, A.zoom(v, 6)) for k, v in FC.ref_faces()]
    rows = [A.row_sheet(panels[i:i + 4], title=(f'{view} {expr} trial round {rnd}: one design axis per variant, x6, FC+HR '
                                                 'pass counts' if i == 0 else '')) for i in range(0, len(panels), 4)]
    rows.append(A.row_sheet(small, title='the same at 2x (game read)'))
    rows.append(A.row_sheet(refs, title='finish-bar heads at x6 (third-party refs: review/ only)'))
    notes = [f"{r['name']}: {r['idea']}" + (f" -> {r['verdict']}" if r['verdict'] else '') for r in res]
    rows.append(notes_img(notes))
    A.stack(rows).save(SHEETS / f'{view}_{expr}_trial_{rnd}_x6.png')
    return res


def notes_img(lines, width=1600, fsize=14):
    """verdict text under a sheet, wrapped"""
    import textwrap
    wrapped = []
    for ln in lines:
        wrapped += textwrap.wrap(ln, width=int(width / (fsize * 0.52))) or ['']
    im = Image.new('RGB', (width, 12 + len(wrapped) * (fsize + 5)), (22, 22, 26))
    d = ImageDraw.Draw(im)
    f = A.font(fsize)
    for i, ln in enumerate(wrapped):
        d.text((12, 6 + i * (fsize + 5)), ln, fill=(220, 220, 220), font=f)
    return im


def construct_sheet(view, expr):
    h, rec = build(view, expr)
    name = f'{view}_{expr}_144'
    s = HP.construct_sheet(h, name, label='round R2 painted head',
                           src=f'faces/r2/head_{view}.json (strokes: tools/art-construct/heads_r2.py)')
    SHEETS.mkdir(parents=True, exist_ok=True)
    s.save(SHEETS / f'{name}_construct.png')
    return h


def library_sheet(z=8):
    rows = []
    for view, exprs in LIBRARY.items():
        if not (LIB / f'head_{view}.json').exists():
            continue
        panels = []
        for e in exprs:
            p = LIB / f'{view}_{e}_144.png'
            if p.exists():
                panels.append((f'{view} {e}', A.zoom(A.on_bg(Image.open(p).convert('RGBA'), BG), z)))
        if panels:
            rows.append(A.row_sheet(panels, title=f'{view}: the R2 painted library at x{z}' if not rows else f'{view} x{z}'))
    refs = [(k, A.zoom(v, z)) for k, v in FC.ref_faces()]
    rows.append(A.row_sheet(refs, title=f'finish-bar heads at x{z}'))
    A.stack(rows).save(REV / f'faces_library_x{z}.png')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=('build', 'all', 'preview', 'trial', 'sheets'))
    ap.add_argument('--view', default='q34')
    ap.add_argument('--expr', default='confident')
    ap.add_argument('--round', default='a')
    ap.add_argument('--z', type=int, default=16)
    a = ap.parse_args()
    if a.cmd == 'preview':
        p, ok, bad = preview(a.view, a.expr, a.z)
        print(p, f'{len(ok)} pass;', '\n  '.join(['FAIL:'] + bad))
    elif a.cmd == 'build':
        h, rec = build(a.view, a.expr)
        print(rec['name'])
    elif a.cmd == 'trial':
        for r in trial(a.view, a.round):
            print(f"{r['name']:18s} {r['passed']:2d} pass  fails: {'; '.join(x[:70] for x in r['failed'])}")
    elif a.cmd == 'all':
        for view, exprs in LIBRARY.items():
            if (LIB / f'head_{view}.json').exists():
                for e in exprs:
                    if e in spec_of(view)['expressions']:
                        build(view, e)
                        print(view, e)
    elif a.cmd == 'sheets':
        for view, exprs in LIBRARY.items():
            if (LIB / f'head_{view}.json').exists():
                for e in exprs:
                    if e in spec_of(view)['expressions']:
                        construct_sheet(view, e)
        library_sheet()


if __name__ == '__main__':
    main()
