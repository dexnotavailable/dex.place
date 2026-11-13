"""Round R3 face library: build, preview, trial and review the heads painted in heads_r3.py.

  python tools/art-construct/heads_r3.py                                   # (re)write the painted head specs
  python tools/art-construct/face_r3.py build --view q34 --expr confident   # one face -> faces/r3/<view>_<expr>_144.*
  python tools/art-construct/face_r3.py all                                # the library: 3 views x 6 expressions
  python tools/art-construct/face_r3.py preview --view q34 --expr confident # x16 grid + construction + refs (round-3/_work)
  python tools/art-construct/face_r3.py trial --view q34 --round a         # a trial round: the spec's trials[<round>]
  python tools/art-construct/face_r3.py pick --view q34                    # whole-face variants vs ref 08 at x3 and 1x
  python tools/art-construct/face_r3.py sheets                             # construction sheets + library sheet

Round R3 answers the round-2 critique (6.2/10): a sullen near eye under a 3-row lash, specky brows, a 3 px pout, a
diamond jaw, a flat face, a striped wig. Every fix is a trial variant with one design axis, scored on the FC/HR rules and
judged beside the ref heads at x6, x3 and 1x; and because round 2 passed 63/63 automatic face rules while missing the
brief, the round ends with WF-P11: a whole-face pick against ref 08 at x3 and 1x that no checker pass can override.

This is face_r2.py's route (head_paint.Head composes and measures), pointed at faces/r3 and round-3. It is a copy rather
than an import because face_r2 binds its library path into default arguments at import time.
"""
import argparse
import copy
import json
import sys
import textwrap
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import face_construct as FC  # noqa: E402
import head_paint as HP  # noqa: E402

LIB = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'r3'
REV = A.ROOT / 'review' / 'rosace' / 'construct' / 'round-3'
SHEETS = REV / 'face'
WORK = REV / '_work'
HP.LIBDIR = LIB
HP.SHEETS = SHEETS
SIX = ('confident', 'focused', 'radiant', 'serene', 'ignited', 'hurt')
LIBRARY = {'q34': SIX, 'front': SIX, 'profile': SIX}
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
    rec['_doc'] = rec['_doc'].replace('round R1', 'round R3').replace(
        f'faces/r1/head_{view}.json', f'faces/r3/head_{view}.json (painted by tools/art-construct/heads_r3.py)')
    rec['params']['route'] = 'r3 painted strokes'
    rec['params']['bangs'] = spec.get('bangs', [])
    rec['params']['pupil'] = bool(spec.get('pupil', False))
    A.jdump(rec, out / f'{name}.json')
    h.cv.save(h.pal, out / f'{name}.png')
    h.cv.save_layers(str(out / name))
    return h, rec


def img(h):
    return HP.img_of(h.cv.code, h.pal, BG)


def score(path, faces_dir=None):
    import rules_check as RC
    ctx = RC.Ctx(face=path, faces_dir=faces_dir or LIB)
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


def notes_img(lines, width=1600, fsize=14):
    wrapped = []
    for ln in lines:
        wrapped += textwrap.wrap(ln, width=int(width / (fsize * 0.52))) or ['']
    im = Image.new('RGB', (width, 12 + len(wrapped) * (fsize + 5)), (22, 22, 26))
    d = ImageDraw.Draw(im)
    f = A.font(fsize)
    for i, ln in enumerate(wrapped):
        d.text((12, 6 + i * (fsize + 5)), ln, fill=(220, 220, 220), font=f)
    return im


def dump(h):
    """the composed head as a character grid with coordinates (the painter's check)"""
    g = A.codes_to_grid(h.cv.code, h.pal)
    out = ['    ' + ''.join(str(x // 10) for x in range(len(g[0]))), '    ' + ''.join(str(x % 10) for x in range(len(g[0])))]
    out += [f'{y:3d} {r}' for y, r in enumerate(g)]
    return '\n'.join(out)


def preview(view, expr, z=16, variant=None, tag=''):
    h, rec = build(view, expr, variant=variant, name=f'_preview_{view}_{expr}{tag}', out=WORK)
    fin = img(h)
    f = HP.construction(view)
    refs = [(k, A.zoom(v, 6)) for k, v in FC.ref_faces()]
    r2p = A.ROOT / 'art' / 'rosace' / 'construct' / 'faces' / 'r2' / f'{view}_{expr}_144.png'
    r2 = [('R2 x6', A.zoom(A.on_bg(Image.open(r2p).convert('RGBA'), BG), 6))] if r2p.exists() else []
    s = A.stack([A.row_sheet([(f'{view} {expr} x{z}', grid_img(fin, z, HP.W, HP.H)),
                              ('on the construction', f.g.draw(A.zoom(fin, z), z, layers=('grid', 'ball')))]),
                 A.row_sheet([('R3 x6', A.zoom(fin, 6))] + r2 + refs),
                 A.row_sheet([('x3', A.zoom(fin, 3)), ('2x', A.zoom(fin, 2)), ('1x', fin)] +
                             [(k, A.zoom(v, 2)) for k, v in FC.ref_faces()])])
    WORK.mkdir(parents=True, exist_ok=True)
    p = WORK / f'preview_{view}_{expr}{tag}.png'
    s.save(p)
    ok, bad, _ = score(WORK / f'_preview_{view}_{expr}{tag}.json')
    (WORK / f'preview_{view}_{expr}{tag}.txt').write_text(dump(h), encoding='utf-8')
    return p, ok, bad, h


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
    """one trial round: base + each variant, scored and sheeted with the refs at x6, 2x and 1x"""
    spec = spec_of(view)
    tr = spec.get('trials', {}).get(rnd)
    if not tr:
        raise SystemExit(f'no trials[{rnd}] in head_{view}.json')
    expr = expr or tr.get('expr', 'confident')
    out = SHEETS / f'{view}_trial_{rnd}'
    out.mkdir(parents=True, exist_ok=True)
    items = [('base', {'idea': tr.get('base_idea', 'the head as painted'), 'verdict': tr.get('base_verdict', '')})]
    items += list(tr['variants'].items())
    res, panels, small, one = [], [], [], []
    bp = tr.get('base_patch') or {}
    for name, v in items:
        e = v.get('expr', expr)
        var = merge_variant(bp, {} if name == 'base' else {k: val for k, val in v.items()
                                                           if k in ('layers', 'replace_layers', 'expressions', 'anchors', 'rows')}) or None
        h, rec = build(view, e, variant=var, name=f'{view}_{e}__{name}', out=out, spec=spec)
        ok, bad, _ = score(out / f'{view}_{e}__{name}.json')
        res.append({'name': name, 'axis': v.get('axis', ''), 'idea': v.get('idea', ''), 'passed': len(ok),
                    'failed': bad, 'verdict': v.get('verdict', ''), 'kept': v.get('kept')})
        tag = ' KEPT' if v.get('kept') else (' (rejected)' if v.get('kept') is False else '')
        panels.append((f'{name}: {len(ok)} pass / {len(bad)} fail{tag}', A.zoom(img(h), 6)))
        small.append((name, A.zoom(img(h), 2)))
        one.append((name, img(h)))
    A.jdump({'_doc': f'face trial round {rnd} (round R3): one axis per variant, scored on FC/HR with rules_check.py; '
                     'verdicts are the painter call beside the refs and are also in the head spec',
             'view': view, 'expr': expr, 'round': rnd, 'results': res}, out / 'results.json')
    refs6 = [(k, A.zoom(v, 6)) for k, v in FC.ref_faces()]
    rows = [A.row_sheet(panels[i:i + 5], title=(f'{view} {expr} trial round {rnd} (R3): one design axis per variant, x6, '
                                                 'FC+HR pass counts' if i == 0 else '')) for i in range(0, len(panels), 5)]
    rows.append(A.row_sheet(small + [(k, A.zoom(v, 2)) for k, v in FC.ref_faces()], title='the same at 2x beside the ref heads'))
    rows.append(A.row_sheet(one + list(FC.ref_faces()), title='1x (game size)'))
    rows.append(A.row_sheet(refs6, title='finish-bar heads at x6 (third-party refs: review/ only)'))
    notes = [f"{r['name']}: {r['idea']}" + (f" -> {r['verdict']}" if r['verdict'] else '') for r in res]
    rows.append(notes_img(notes))
    A.stack(rows).save(SHEETS / f'{view}_{expr}_trial_{rnd}_x6.png')
    return res


def pick(view='q34'):
    """WF-P11: the whole-face pick. Each candidate is a complete face (not one axis); all are put beside ref 08 at x3 and
    1x, shuffled, with the question a stranger would answer: which one would you pull for? The painter's answer and its
    reason are in the spec's pick record; a checker pass does not decide it."""
    spec = spec_of(view)
    pk = spec.get('pick')
    if not pk:
        raise SystemExit('no pick in the spec')
    out = SHEETS / f'{view}_pick'
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(pk.get('seed', 3))
    cands = list(pk['candidates'].items())
    order = list(rng.permutation(len(cands)))
    ref = dict(FC.ref_faces())
    p3, p1, key, res = [], [], {}, []
    for slot, i in enumerate(order):
        name, v = cands[i]
        var = {k: val for k, val in v.items() if k in ('layers', 'replace_layers', 'expressions', 'anchors', 'rows')} or None
        cspec = json.loads((A.ROOT / v['from_spec']).read_text(encoding='utf-8')) if v.get('from_spec') else spec
        h, rec = build(view, v.get('expr', 'confident'), variant=var, name=f'{view}_pick__{name}', out=out, spec=cspec)
        ok, bad, _ = score(out / f'{view}_pick__{name}.json')
        lab = chr(ord('A') + slot)
        key[lab] = name
        p3.append((lab, A.zoom(img(h), 3)))
        p1.append((lab, img(h)))
        res.append({'slot': lab, 'name': name, 'idea': v.get('idea', ''), 'passed': len(ok), 'failed': bad,
                    'verdict': v.get('verdict', ''), 'kept': v.get('kept')})
    r08 = ref.get('ref08')
    rows = [A.row_sheet(p3 + ([('ref08', A.zoom(r08, 3))] if r08 is not None else []),
                        title=f'{view} whole-face pick (WF-P11) at x3: which one would you pull for? (slots shuffled, key.json)'),
            A.row_sheet(p1 + ([('ref08', r08)] if r08 is not None else []), title='the same at 1x')]
    A.stack(rows).save(SHEETS / f'{view}_pick_x3.png')
    A.jdump({'_doc': 'WF-P11 whole-face pick: slot -> candidate. The verdicts are the painter call at x3 and 1x beside ref 08, '
                     'written in heads_r3.py; the checker counts are shown for information only',
             'key': key, 'results': res}, out / 'key.json')
    A.stack(rows + [notes_img([f"{r['slot']} = {r['name']}: {r['idea']} -> {r['verdict']} ({r['passed']} FC/HR pass, "
                               f"{len(r['failed'])} fail)" for r in sorted(res, key=lambda r: r['slot'])])]) \
        .save(SHEETS / f'{view}_pick_x3_revealed.png')
    return res


def construct_sheet(view, expr):
    h, rec = build(view, expr)
    name = f'{view}_{expr}_144'
    s = HP.construct_sheet(h, name, label='round R3 painted head',
                           src=f'faces/r3/head_{view}.json (strokes: tools/art-construct/heads_r3.py)')
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
            rows.append(A.row_sheet(panels, title=f'{view}: the R3 painted library at x{z}' if not rows else f'{view} x{z}'))
    refs = [(k, A.zoom(v, z)) for k, v in FC.ref_faces()]
    rows.append(A.row_sheet(refs, title=f'finish-bar heads at x{z}'))
    A.stack(rows).save(REV / f'faces_library_x{z}.png')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=('build', 'all', 'preview', 'trial', 'pick', 'sheets'))
    ap.add_argument('--view', default='q34')
    ap.add_argument('--expr', default='confident')
    ap.add_argument('--round', default='a')
    ap.add_argument('--z', type=int, default=16)
    a = ap.parse_args()
    if a.cmd == 'preview':
        p, ok, bad, h = preview(a.view, a.expr, a.z)
        print(p, f'{len(ok)} pass;', '\n  '.join(['FAIL:'] + bad))
    elif a.cmd == 'build':
        h, rec = build(a.view, a.expr)
        print(rec['name'])
    elif a.cmd == 'trial':
        for r in trial(a.view, a.round):
            print(f"{r['name']:18s} {r['passed']:2d} pass  fails: {'; '.join(x[:90] for x in r['failed'])}")
    elif a.cmd == 'pick':
        for r in pick(a.view):
            print(f"{r['slot']} {r['name']:18s} {r['passed']:2d} pass  fails: {'; '.join(x[:90] for x in r['failed'])}")
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
