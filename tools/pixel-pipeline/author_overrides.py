# Rosace key-still override layers, stills round 4 (round 3 structure): hand-placed patches (authoring record; not
# part of stills.sh). Writes art/rosace/overrides/<pose>_<px>.json (the source of truth for each
# layer) and stamps 'authored_on' with the render the pixels were placed on, then
# `overrides.py build` turns each into the layer PNG + .touched.json.
#   python author_overrides.py [--renders <build>/renders/r3] [--px 144,128,96]
# Coordinates are sprite pixels of the r4 renders (stills.sh --round r4). 128 / 96 layers are
# authored separately at their own pixel budget (smaller stamps, fewer lines), not scaled.
import argparse, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import overrides
from author_overrides_data import LAYERS, STILL, FACE_PX, PREFACE_PX
ap = argparse.ArgumentParser()
ap.add_argument('--renders', default=r'D:\Dex\Projects\dex-place-art\rosace\build\renders\r4')
ap.add_argument('--px', default='144,128,96')
ap.add_argument('--only', default='')
a = ap.parse_args()
pxs = [int(v) for v in a.px.split(',')]


def meta(pose, px):
    return json.load(open(os.path.join(a.renders, STILL[pose], f'px{px}', 'meta.json')))


def derive(spec, pose, px):
    """a 128 / 96 layer from the 144 one: same camera and pose at a uniform scale, so every
    coordinate maps through the root anchor (x px/144). Hand stamps keep their name (the library
    has a 128 and a 96 drawing of each); the jaw contour pixels and the face-window preface are
    dropped (each height has its own hand-authored PREFACE_PX); ring segments scale their columns,
    their y window and depth; 96 keeps one clump separator and a 3 px glint."""
    m0, m1 = meta(pose, 144), meta(pose, px)
    s = px / 144
    ax, ay = m0['anchor']
    bx, by = m1['anchor']
    f = lambda x, y: [int(round((x - ax) * s + bx)), int(round((y - ay) * s + by))]
    fb = lambda b: f(b[0], b[1]) + f(b[2], b[3])
    out = []
    for p in spec['patches']:
        if p['kind'] == 'contour':
            continue
        q = {k: v for k, v in p.items() if k not in ('px', 'lines', 'at', 'box', 'erase', 'ellipses', 'polys', 'shade', 'despeckle', 'tips', 'ring')}
        q['note'] = p.get('note', '') + f' [mapped from the 144 layer through the root anchor, x{s:.3f}]'
        if 'at' in p:
            q['at'] = f(*p['at'])
        if 'box' in p:
            q['box'] = fb(p['box'])
        for k in ('shade', 'despeckle', 'tips'):
            if k in p:
                q[k] = dict(p[k], box=fb(p[k]['box']))
        if 'ring' in p:
            rg = p['ring']
            q['ring'] = dict(rg, segments=[[f(a0, 0)[0], f(b0, 0)[0]] for a0, b0 in rg['segments']],
                             y=[f(0, rg['y'][0])[1], f(0, rg['y'][1])[1]], depth=max(2, int(round(rg.get('depth', 3) * s))))
        if 'ellipses' in p:
            q['ellipses'] = [dict(e, box=fb(e['box'])) for e in p['ellipses']]
        if 'lines' in p:
            ls = p['lines']
            if px == 96 and p['kind'] == 'hair' and all(l['c'] == 'I3' for l in ls):
                ls = ls[:1]
            q['lines'] = [dict(l, pts=[f(*pt) for pt in l['pts']]) for l in ls]
        if 'px' in p:
            if p['kind'] == 'glint':
                cx, cy = f(*p['px'][0][:2])
                q['px'] = [[cx, cy, 'A5'], [cx - 1, cy, 'A4'], [cx, cy - 1, 'A4']] if px == 96 else                     [[cx, cy, 'A5'], [cx - 1, cy, 'A4'], [cx + 1, cy, 'A4'], [cx, cy - 1, 'A4'], [cx, cy + 1, 'A4']]
            else:
                q['px'] = [f(x, y) + [c] for x, y, c in p['px']]
        out.append(q)
    face = dict(spec['face'])
    for k in ('dx', 'dy', 'far_dx'):
        if k in face:
            face[k] = int(round(face[k] * s))
    return dict(face=face, rim=spec['rim'], patches=out)


for pose in STILL:
    for px in (128, 96):
        if f'{pose}_{px}' not in LAYERS and f'{pose}_144' in LAYERS:
            LAYERS[f'{pose}_{px}'] = derive(LAYERS[f'{pose}_144'], pose, px)
        if (pose, px) in FACE_PX:
            LAYERS[f'{pose}_{px}']['face'] = FACE_PX[pose, px]
        if (pose, px) in PREFACE_PX:            # round 4: the face window is hand-authored per height
            LAYERS[f'{pose}_{px}']['preface'] = PREFACE_PX[pose, px]
for layer, spec in LAYERS.items():
    pose, px = layer.rsplit('_', 1)
    if int(px) not in pxs or (a.only and pose not in a.only.split(',')):
        continue
    p = os.path.join(overrides.ODIR, layer + '.json')
    ops = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    for k in ('face', 'rim', 'preface'):
        if k in spec:
            ops[k] = spec[k]
        elif k == 'preface':
            ops.pop(k, None)
    ops['patches'] = spec['patches']
    ops['_doc'] = ('Stills round 4 override layer: authored in tools/pixel-pipeline/author_overrides_data.py on the '
                   'render named in authored_on. Patches are pixel coordinates on that render.')
    json.dump(ops, open(p, 'w', encoding='utf-8'), indent=1)
    overrides.authored(os.path.join(a.renders, STILL[pose], f'px{px}'), layer, label='stills round 4 (r4)')
