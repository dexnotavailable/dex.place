"""Stills round 2 authoring aid (not part of stills.sh): derive 128 / 96 override patches from the hand-authored 144 layer by mapping coordinates
through the render anchors (same camera and pose, uniform scale). Hands get smaller authored fists."""
import json, sys
R = 'D:/Dex/Projects/dex-place-art/rosace/build/renders/r2s'
O = 'D:/Dex/Projects/dex.place/art/rosace/overrides'
STILL = {'idle_hero': 'idle_hero', 'n1_contact': 'n1_contact', 'q_stamp': 'q_stamp', 'n2_pivot': 'n2_pivot_black'}
FIST = {128: [".OOO.", "OLLSO", "OSMSO", "OTSMO", ".OOO."],
        96: [".OO.", "OLSO", "OTMO", ".OO."]}
def meta(s, px):
    return json.load(open(f'{R}/{STILL[s]}/px{px}/meta.json'))
for pose in STILL:
    src = json.load(open(f'{O}/{pose}_144.json', encoding='utf-8'))
    m144 = meta(pose, 144)
    for px in (128, 96):
        m = meta(pose, px)
        s = px / 144
        ax, ay = m144['anchor']; bx, by = m['anchor']
        f = lambda x, y: [int(round((x - ax) * s + bx)), int(round((y - ay) * s + by))]
        fb = lambda b: f(b[0], b[1]) + f(b[2], b[3])
        out = []
        hands = [p for p in src['patches'] if p['kind'] == 'hand']
        for p in src['patches']:
            if pose == 'idle_hero' and len(hands) > 1 and p is hands[1]:
                continue      # the open hand on the hip has no small-fist equivalent; left to the render
            q = {k: v for k, v in p.items() if k not in ('px', 'lines', 'rows', 'at', 'box', 'erase')}
            q['note'] = p.get('note', '') + f' [derived from the 144 layer by anchor mapping, x{s:.3f}]'
            if 'despeckle' in p:
                q['despeckle'] = dict(p['despeckle'], box=fb(p['despeckle']['box']))
            if 'tips' in p:
                q['tips'] = dict(p['tips'], box=fb(p['tips']['box']))
                if px == 96:
                    q['tips']['ramp'] = ['A3', 'A4']
            if 'box' in p:
                q['box'] = fb(p['box'])
            if 'lines' in p:
                if px == 96 and p['kind'] == 'hair':
                    # 96: the ring collapses to 2-3 dashes and the separators to the two bang lines
                    lines = [l for l in p['lines'] if l['c'] == 'I0'][1:4] + [l for l in p['lines'] if l['c'] == 'I3'][:2]
                else:
                    lines = p['lines']
                q['lines'] = [dict(l, pts=[f(*pt) for pt in l['pts']]) for l in lines]
            if 'px' in p:
                if p['kind'] == 'glint':
                    cx, cy = f(*p['px'][0][:2])
                    q['px'] = [[cx, cy, 'A5'], [cx - 1, cy, 'A4'], [cx + 1, cy, 'A4'], [cx, cy - 1, 'A4'], [cx, cy + 1, 'A4']] if px == 128 else [[cx, cy, 'A5'], [cx - 1, cy, 'A4'], [cx, cy - 1, 'A4']]
                else:
                    q['px'] = [f(x, y) + [c] for x, y, c in p['px']]
            if 'erase' in p:
                q['erase'] = [f(x, y) for x, y in p['erase']]
            if 'rows' in p:
                if p['kind'] != 'hand':
                    continue
                h, w = len(p['rows']), max(len(r) for r in p['rows'])
                cx, cy = f(p['at'][0] + w / 2, p['at'][1] + h / 2)
                fr = FIST[px]
                q['rows'] = fr
                q['at'] = [cx - len(fr[0]) // 2, cy - len(fr) // 2]
                q['note'] = 'fist closed on the haft (small authored fist at the mapped grip) ' + q['note']
            out.append(q)
        dst = json.load(open(f'{O}/{pose}_{px}.json', encoding='utf-8'))
        dst['patches'] = out
        dst['rim'] = dict(dst.get('rim') or {}, head_run=src['rim'].get('head_run', 4))
        json.dump(dst, open(f'{O}/{pose}_{px}.json', 'w', encoding='utf-8'), indent=1)
        print(pose, px, len(out))
