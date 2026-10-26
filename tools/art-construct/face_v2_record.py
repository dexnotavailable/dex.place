"""Face records for the v2 faces, so rules_check.py can measure a face as it sits on a real render.

  python tools/art-construct/face_v2_record.py [--lane <dir>] [--out review/rosace/art/face/round-1]

For each still in the lane's run.json it composes every expression on that render (face_v2.compose),
crops the head (the same box as the A/B sheets), and writes a face record in the construct schema
(rows in the artlib KEY, <name>_parts.png, <name>_ids.png, landmarks MEASURED from the placed pixels):
  <lane>/records/<still>_<px>/<yaw>_<expr>_144.json     (the checker's face_set naming; 80 px records
                                                         use the same names in their own folder)
then runs rules_check on the still's own expression and writes rules_<still>_<px>.json + a summary.
A still facing screen-left is mirrored first (the checker's three-quarter rules are written facing right).
The v2 head is smaller than the construct grid (hair top to chin 26-27 px against FC-P01's 29-30), so the
grid rules are reported as measured, not bent to pass.
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import artlib as A  # noqa: E402
import face_v2  # noqa: E402
import face_v2_sheets as FS  # noqa: E402

CHECK_EXPR = {'confident': 'confident', 'focused': 'focused', 'smile': 'radiant', 'hurt': 'hurt',
              'closed': 'radiant', 'serene': 'serene', 'ignited': 'ignited'}      # closed eyes are measured like Radiant's arcs (no open lash)
LANE = Path(r'D:\Dex\Projects\dex-place-art\rosace\build\lanes\face')


def build_record(still_dir, px, expr, params, facing=None, spec=None, composer=None):
    st = face_v2.Still(still_dir)
    composer = composer or face_v2
    img, mat, rec, log = composer.compose(still_dir, expr, params=params, facing=facing, spec=spec)
    if rec.get('win') is not None:          # round F2: the jaw rebuild moves the face window
        st.win = rec['win']
    g = rec['grid']
    pal = A.Palette()
    box = FS.head_box(still_dir, px)
    x0, y0, x1, y1 = box
    H, W = y1 - y0, x1 - x0
    flip = g['side'] < 0

    def cx(x):
        x = x - x0
        return (W - 1 - x) if flip else x

    def crop(a):
        c = np.zeros((H, W) + a.shape[2:], a.dtype)
        ys, xs = slice(max(0, y0), min(a.shape[0], y1)), slice(max(0, x0), min(a.shape[1], x1))
        c[ys.start - y0:ys.stop - y0, xs.start - x0:xs.stop - x0] = a[ys, xs]
        return c[:, ::-1] if flip else c
    code = pal.from_rgba(crop(img))
    code[code < 0] = 0
    matc = crop(mat)
    win = crop(st.win.astype(np.uint8)) > 0
    names = {v: k for k, v in st.mid.items()}
    ids = np.zeros((H, W), np.int16)
    for mid, nm in names.items():
        if nm in A.MAT:
            ids[matc == mid] = A.MAT[nm]
    feats = rec.get('features', {})

    def fpx(name):
        return [(cx(x), y - y0, k) for x, y, k in feats.get(name, []) if 0 <= x - x0 < W and 0 <= y - y0 < H]
    parts = np.zeros((H, W), np.int16)
    skin = ids == A.MAT['skin']
    parts[np.isin(ids, [A.MAT['hair'], A.MAT['hairtip']])] = A.PART['hair_front']
    parts[skin & win] = A.PART['face']
    parts[skin & ~win] = A.PART['neck']
    for side in ('near', 'far'):
        for x, y, k in fpx(f'eye_{side}'):
            parts[y, x] = A.PART['eye']
    # chin: the lowest face row near the projected chin column
    ccx = cx(int(g['chin'][0]))
    face_rows = [y for y in range(H) if (parts[y, max(0, ccx - 3):ccx + 4] == A.PART['face']).any()]
    chin_y = max(face_rows) if face_rows else int(g['chin'][1]) - y0
    I = pal.i
    eyes = {}
    for side in ('near', 'far'):
        px_ = fpx(f'eye_{side}')
        if not px_:
            continue
        # the eye box starts at the lash row (the first row with 3+ OL px); OL above it is the flick, which the
        # checker looks for OUTSIDE the box (as on the construct records)
        ol_rows = Counter(y for x, y, k in px_ if k == 'OL')
        lash_rows = sorted(y for y, n in ol_rows.items() if n >= 3)
        top = lash_rows[0] if lash_rows else min(y for x, y, k in px_)
        body = [(x, y) for x, y, k in px_ if y >= top]
        xs = [x for x, y in body]
        ys = [y for x, y in body]
        ebox = [min(xs), top, max(xs), max(ys)]
        az = [(x, y) for x, y, k in px_ if k in ('A2', 'A3', 'A4') and code[y, x] == I(k)]
        az_rows = {y for x, y in az} | {y for x, y, k in px_ if k == 'A5'}
        iris = az + [(x, y) for x, y, k in px_ if k == 'I3' and y in az_rows]
        hl = [(x, y) for x, y, k in px_ if k == 'A5' and code[y, x] == I('A5')]
        whites = [(x, y) for x, y, k in px_ if k in ('W1', 'W2') and code[y, x] == I(k)]
        info = {'box': ebox, 'template': rec['eye_at'][side]['key'], 'mirrored': flip,
                'lash_px': sum(1 for x, y, k in px_ if k == 'OL')}
        if iris or hl:
            allx = [p[0] for p in iris + hl]
            ally = [p[1] for p in iris + hl]
            icols = list(range(min(allx), max(allx) + 1))
            info.update({'iris_cols': icols, 'iris_rows': sorted(set(ally)), 'iris_w': len(icols),
                         'highlight': list(hl[0]) if hl else None, 'whites': [list(w) for w in whites],
                         'white_side': None if not whites else
                         ('right' if np.mean([w[0] for w in whites]) > np.mean(icols) else 'left')})
        eyes[side] = info
    brows = {s: [(x, y) for x, y, k in fpx(f'brow_{s}')] for s in ('near', 'far') if fpx(f'brow_{s}')}
    mouth = [(x, y, k) for x, y, k in fpx('mouth')]
    nose = [(x, y) for x, y, k in fpx('nose') if k == 'S3']
    blush = {s: [(x, y) for x, y, k in fpx(f'blush_{s}') if k == 'SB'] for s in ('near', 'far') if fpx(f'blush_{s}')}
    far, near = {}, {}
    for y in range(H):
        xs = np.nonzero(parts[y] == A.PART['face'])[0]
        r = chin_y - y
        if len(xs) and r >= 0:
            far[r], near[r] = int(xs.max()), int(xs.min())
    hair_rows = np.nonzero(np.isin(ids, [A.MAT['hair'], A.MAT['hairtip']])[:, max(0, ccx - 8):ccx + 8].any(1))[0]
    hair_top = int(chin_y - hair_rows.min()) if len(hair_rows) else None
    ne = eyes.get('near', {})
    lash_top = chin_y - ne['box'][1] if ne else None
    eye_bottom = chin_y - max(ne.get('iris_rows', [ne['box'][3]])) if ne else None
    mrow = Counter(y for x, y, k in mouth if k == 'S4').most_common(1)
    rows = {'mouth': chin_y - mrow[0][0] if mrow else None, 'nose': chin_y - min(y for x, y in nose) if nose else None,
            'eye_bottom': eye_bottom, 'lash_top': lash_top,
            'brow': chin_y - max(y for x, y in brows['near']) if brows.get('near') else None,
            'hair_top': hair_top, 'skull_top': (hair_top - 2) if hair_top else None, 'hairline': None}
    # hairline: the first face (skin) row from the top in the centre columns, as rows above the chin
    cc = [c for c in range(max(0, ccx - 2), min(W, ccx + 3))]
    sk_rows = [y for y in range(H) if (parts[y, cc] == A.PART['face']).any()]
    rows['hairline'] = int(chin_y - min(sk_rows)) if sk_rows else None
    eye_row = chin_y - (eye_bottom or 0)
    xs = np.nonzero(np.isin(parts[eye_row], [A.PART['face'], A.PART['eye']]))[0] if 0 <= eye_row < H else []
    cl = int(round(cx(int((g['eye']['near'][0] + g['eye']['far'][0]) / 2)) + 0)) if 'far' in eyes else \
        (int(np.mean(xs)) if len(xs) else 0)
    yaw = rec['facing']
    lm = {'composer': rec.get('composer', 'v2'), 'facing': 'right', 'yaw': yaw, 'yaw_deg': g['yaw'], 'expression': CHECK_EXPR.get(expr, expr),
          'expression_v2': expr, 'head_px': hair_top, 'chin_y': int(chin_y), 'rows_above_chin': rows,
          'skull_top_row': rows['skull_top'], 'hair_top_row': hair_top, 'hair_top_measured': hair_top,
          'centre_line_x_at_eye_row': cl,
          'gaze_target': {'viewer': 'viewer', 'closed': 'closed eyes'}.get(rec.get('gaze'), rec.get('gaze')),
          'light': [0.6 * (-1 if flip else 1), -0.8], 'origin': [ccx, int(chin_y)],
          'face_width_eye_row': {'y': int(eye_row), 'x0': int(min(xs)) if len(xs) else None, 'x1': int(max(xs)) if len(xs) else None},
          'far_edge': far, 'near_edge': near, 'eyes': eyes,
          'gaze': {'dx': -1 if rec.get('gaze') == 'viewer' else 1, 'dy': 0, 'target': rec.get('gaze')},
          'brows': brows, 'mouth': {'key': expr, 'px': mouth}, 'nose': nose, 'blush': blush,
          'mirrored_from_screen_left': flip}
    out = {'_doc': 'Face record measured on a v2 render (face_v2_record.py): the face lane composite of '
                   f'{still_dir}, head crop {list(box)}' + (', mirrored to face right' if flip else '') +
                   '. rows use the artlib KEY; landmarks are read off the placed pixels.',
           'name': f'{yaw}_{CHECK_EXPR.get(expr, expr)}_144',
           'params': {'yaw': yaw, 'expression': CHECK_EXPR.get(expr, expr), 'gaze': [lm['gaze']['dx'], 0],
                      'pupil': True, 'gaze_target': lm['gaze_target'], 'facing': 'right', 'eye_row': 0,
                      'route': 'v2 face lane (construction on the MMD head render)', 'v2': rec['params']},
           'landmarks': lm, 'rows': A.codes_to_grid(code, pal)}
    return out, parts, ids


def strands(still_dir, png):
    """FC-N29: hair px crossing the face window below the brow band: horizontal runs of 1-3 hair-tone px
    (I0-I4) with skin tones (S1-S4, SB) on both sides, inside the head-skin window (face pass)"""
    st = face_v2.Still(still_dir)
    g = face_v2.construct(st)
    pal = A.Palette()
    code = pal.from_rgba(np.array(Image.open(png).convert('RGBA')))
    hair = np.isin(code, [pal.i(k) for k in ('I0', 'I1', 'I2', 'I3', 'I4')])
    skin = np.isin(code, [pal.i(k) for k in ('S1', 'S2', 'S3', 'S4', 'SB')])
    H, W = code.shape
    n, where = 0, []
    for y in range(H):
        x = 0
        while x < W:
            if not (hair[y, x] and st.win[y, x] and y > face_v2.brow_line_y(g, x) + 1):
                x += 1
                continue
            x2 = x
            while x2 + 1 < W and hair[y, x2 + 1] and st.win[y, x2 + 1]:
                x2 += 1
            if x2 - x + 1 <= 3 and x > 0 and x2 + 1 < W and skin[y, x - 1] and skin[y, x2 + 1]                     and st.win[y, x - 1] and st.win[y, x2 + 1]:
                n += x2 - x + 1
                where.append([int(x), int(y), int(x2 - x + 1)])
            x = x2 + 1
    return n, where


def hair_in_face(still_dir, png, rec):
    """FC-N30 (round F2): hair-tone px (I0-I4) inside an eye's body box (lash row to lid, face_f2 'body') or on a
    cheek (below the lowest eye body, inside the face window's span on that row, not its edge px)"""
    pal = A.Palette()
    code = pal.from_rgba(np.array(Image.open(png).convert('RGBA')))
    hair = np.isin(code, [pal.i(k) for k in ('I0', 'I1', 'I2', 'I4')])      # I3 is also the pupil tone
    win = rec.get('win')
    n_eye = n_cheek = 0
    yb = 0
    for w, v in rec.get('eye_at', {}).items():
        x0, y0, x1, y1 = v.get('body', v['box'])
        n_eye += int(hair[y0:y1 + 1, x0:x1 + 1].sum())
        yb = max(yb, y1)
    if win is not None and rec.get('facing') != 'profile':     # a profile's window spans the hair behind the cheek
        H = win.shape[0]
        for y in range(yb + 1, H):
            xs = np.nonzero(win[y])[0]
            if len(xs) >= 3:
                n_cheek += int(hair[y, xs.min() + 1:xs.max()].sum())
    return {'eye': n_eye, 'cheek': n_cheek}


def lash_outside(still_dir, png, tag='noface'):
    """FC-N31 (round F2b): OL px the face added (OL in png, not OL in the no-face render) above the mouth row that lie
    outside the head skin mask (facewin, before hair covers it) grown by 1 px, or left / right of the visible face
    contour (+1 px) at that height: a lash or flick run past the cheek onto the side hair"""
    st = face_v2.Still(still_dir, tag)
    g = face_v2.construct(st)
    pal = A.Palette()
    ol = pal.i('OL')
    now = pal.from_rgba(np.array(Image.open(png).convert('RGBA'))) == ol
    was = pal.from_rgba(st.img) == ol
    grown = A.dilate(st.win, 1, diag=True)
    my = int(g['mouth'][1])
    added = now & ~was
    added[my:] = False
    # the face contour: on each row, the span of VISIBLE skin in the no-face render (inside the window) over this
    # row and the 4 under it, grown by 1 px; a lash px left or right of that span has run past the cheek contour
    vis = st.win & (st.mat == st.mid['skin'])
    H, W = vis.shape
    span = np.zeros_like(vis)
    for y in range(H):
        xs = np.nonzero(vis[y:min(H, y + 5)].any(0))[0]
        if len(xs):
            span[y, max(0, xs.min() - 1):min(W, xs.max() + 2)] = True
    out = added & ~(grown & span)
    return int(out.sum()), [[int(x), int(y)] for y, x in zip(*np.nonzero(out))]


IRIS = ('A2', 'A3', 'A4', 'A5', 'I3')


def iris_rows(rec):
    """rows of each placed eye that carry iris px (A2-A5, the I3 pupil): the eye's open height (FC-P31)"""
    out = {}
    for w in ('near', 'far'):
        px = rec.get('features', {}).get(f'eye_{w}', [])
        rows = {y for x, y, c in px if c in IRIS}
        if px:
            out[w] = len(rows)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lane', default=str(LANE))
    ap.add_argument('--out', default=str(A.ROOT / 'review' / 'rosace' / 'art' / 'face' / 'round-1'))
    ap.add_argument('--run', default='run.json')
    ap.add_argument('--composer', default='v2', choices=['v2', 'f2'])
    a = ap.parse_args()
    import rules_check as RC
    lane = Path(a.lane)
    run = json.loads((lane / a.run).read_text())
    if a.composer == 'f2':
        import face_f2 as composer
    else:
        composer = face_v2
    table = json.loads((composer.LIB / 'stills.json').read_text(encoding='utf-8'))
    summary = {}
    for item in run['stills']:
        name, px, sd = item['still'], item['px'], item['dir']
        rd = lane / 'records' / (f'{name}_{px}' if a.composer == 'v2' else f'{a.composer}_{name}_{px}')
        rd.mkdir(parents=True, exist_ok=True)
        pose = {'n2_pivot_black': 'n2_pivot'}.get(name, name)
        pick = dict(table.get(pose, {}).get('*', {}))
        pick.update(table.get(pose, {}).get(str(px), {}))
        own = None
        for expr in ('confident', 'focused', 'smile', 'serene', 'ignited', 'hurt', 'closed'):
            params = dict(pick.get('params', {})) if expr == item['expr'] else \
                {k: v for k, v in pick.get('params', {}).items() if k != 'mouth'}
            rec, parts, ids = build_record(sd, px, expr, params, pick.get('facing'), composer=composer)
            if expr == 'closed':
                rec['name'] = rec['name'].replace('radiant', 'closed')
            fn = rd / f"{rec['name']}.json"
            A.jdump(rec, fn)
            Image.fromarray(parts.astype(np.uint8)).save(rd / f"{rec['name']}_parts.png")
            Image.fromarray(ids.astype(np.uint8)).save(rd / f"{rec['name']}_ids.png")
            if expr == item['expr']:
                own = fn
        ctx = RC.Ctx(face=own, faces_dir=rd)
        rows = RC.run(ctx, ['FC', 'HR'])
        (Path(a.out) / f'rules_{name}_{px}.json').write_text(json.dumps(rows, indent=1), encoding='utf-8')
        cnt = Counter(r['status'].rstrip('*') for r in rows)
        fails = [f"{r['id']} ({r['severity']}): {r['measured']}" for r in rows if r['status'].startswith('FAIL')]
        # FC-P28: every eye sits on the head's own projected iris (the face pass), within the anime cheats
        st_ = face_v2.Still(sd)
        g_ = face_v2.construct(st_)
        _, _, rec_, _ = composer.compose(sd, item['expr'], params=dict(pick.get('params', {})), facing=pick.get('facing'))
        off = {w: round(float(np.hypot(v['at'][0] + 0.5 - g_['eye'][w][0], v['at'][1] + 0.5 - g_['eye'][w][1])), 2)
               for w, v in rec_.get('eye_at', {}).items()}
        before, bw = strands(sd, item['control'])
        after, aw = strands(sd, item['png'])
        f1n = strands(sd, item['f1'])[0] if item.get('f1') else None
        eyehair = hair_in_face(sd, item['png'], rec_) if a.composer == 'f2' else None
        lash_out = {k: lash_outside(sd, item[k])[0] for k in ('control', 'f1', 'f2', 'png') if item.get(k)}
        irows = iris_rows(rec_)
        summary[f'{name}_{px}'] = {'expr': item['expr'], 'counts': dict(cnt), 'fails': fails,
                                   'FC-N29 strand px (control round-4 stamp -> F1)': [before, after],
                                   'FC-N29 where (F1)': aw,
                                   'FC-P28 eye origin to projected iris (px)': off,
                                   'FC-N29 strand px F1 control': f1n,
                                   'FC-N30 hair px in the eye bodies / on the cheeks': eyehair,
                                   'FC-N31 face OL px outside the face mask + 1 (control / F1 / F2 pass 1 / this)': lash_out,
                                   'FC-P31 iris rows': irows, '_view': rec_.get('facing'),
                                   '_open': item['expr'] in ('confident', 'focused')}

        print(f'{name} {px} {item["expr"]}: {dict(cnt)}; FC-N29 strand px crossing the face: control {before} -> F1 {after}; FC-P28 eye offsets {off}')
        for f in fails:
            print('   ', f)
    # FC-P31: across the stills at one size and one view, the open eyes' iris heights stay within 1 px
    groups = {}
    for k, v in summary.items():
        if v.get('_open') and v.get('FC-P31 iris rows'):
            groups.setdefault((k.rsplit('_', 1)[1], v['_view']), []).append((k, v['FC-P31 iris rows']))
    p31 = {}
    for (px, view), items in groups.items():
        for w in ('near', 'far'):
            hs = [r[w] for _, r in items if w in r]
            if hs:
                p31[f'{px} {view} {w}'] = {'heights': {k: r.get(w) for k, r in items}, 'spread': max(hs) - min(hs),
                                           'status': 'PASS' if max(hs) - min(hs) <= 1 else 'FAIL'}
    summary['FC-P31 iris height across frames'] = p31
    print('FC-P31', json.dumps(p31))
    (Path(a.out) / 'rules_summary.json').write_text(json.dumps(summary, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
