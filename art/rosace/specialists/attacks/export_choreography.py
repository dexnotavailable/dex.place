"""Validate/export authored planning data. Does not open native tools or write runtime assets."""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path


HERE = Path(__file__).resolve().parent


def require(ok, message):
    if not ok:
        raise ValueError(message)


def validate(data):
    require(data['contract'] == 'rosace.choreography/1', 'unsupported planning contract')
    require(data['state'] == 'authored-proposal' and not data['rendered'], 'planning state must remain honest')
    require(data['fps'] == 60 and data['sourceH'] == 96, 'clock/unit basis changed')
    ids = [c['id'] for c in data['clips']]
    require(len(ids) == len(set(ids)), 'duplicate clip')
    for c in data['clips']:
        end = 1
        names = []
        for d in c['drawings']:
            require(d['start'] == end and isinstance(d['ticks'], int) and d['ticks'] > 0,
                    f"{c['id']}: exposure gap/overlap/invalid hold")
            end += d['ticks']
            names.append(d['id'])
        require(end == c['length'] + 1, f"{c['id']}: wrong whiff length")
        require(len(names) == len(set(names)), f"{c['id']}: duplicate drawing")
        for root in c['root']:
            require(1 <= root['from'] <= root['to'] <= c['length'], 'root window outside clip')
            require(all(math.isfinite(v) for v in root['deltaH']), 'nonfinite root')
        for hit in c['hits']:
            a, b = hit['active']
            require(1 <= a <= hit['nominalContact'] <= b <= c['length'], 'contact outside active window')
            require(0 <= hit['hitstop'] <= 14, 'unsafe freeze length')
            require(hit['boxBasis'] == 'sourceH96-exact', 'ambiguous box units')
            require(hit['knockbackBasis'] == 'sourceH96-px-per-tick', 'ambiguous knockback units')
            require(all(len(box) == 4 and all(math.isfinite(v) for v in box)
                        and box[2] > 0 and box[3] > 0 for box in hit['boxes']), 'invalid hit box')
            width = (max(x + w for x, y, w, h in hit['boxes']) - min(b[0] for b in hit['boxes'])) / data['sourceH']
            require(abs(width - hit['spanH']) < 1e-9, 'stated width differs from actual hit union')
            if c['id'].startswith('m1_'):
                require(width >= 2.2, 'M1 hitting span below2.2H')
        for event in c['fx'] + c['cues']:
            require(event['gate'] in ['always', 'contact'], 'unknown event gate')
            start = event.get('tick', event.get('ticks', [0])[0])
            require(1 <= start <= c['length'], 'event start outside clip')
        require(all(1 <= x['from'] <= c['length'] for x in c['cancels']), 'invalid cancel window')
    boundary = data.get('boundary')
    if boundary:
        source = next(c for c in data['clips'] if c['id'] == boundary['from'])
        dest = next(c for c in data['clips'] if c['id'] == boundary['to'])
        d = drawing_at(source, boundary['afterTick'])
        require(d['id'] == boundary['inheritDrawing'], 'boundary inherits wrong drawing')
        require(dest['drawings'][0]['inherit'] == source['id'] + '.' + d['id'], 'seam source differs')
        require(dest['drawings'][0]['grip'] == d['grip'], 'grip pop at seam')
        require(any(x['to'] == dest['id'] and x['from'] <= boundary['afterTick'] for x in source['cancels']), 'branch outside cancel')
        expected = boundary['afterTick'] + dest['length']
        require(expected == boundary['earliestChainWhiffTicks'], 'chain off-by-one')


def drawing_at(clip, tick):
    return next(d for d in clip['drawings'] if d['start'] <= tick < d['start'] + d['ticks'])


def box_export(box, target, source):
    x, y, w, h = [v * target / source for v in box]
    # Scale original endpoints; adding scaled floats can cross an exact integer boundary.
    right = math.ceil((box[0] + box[2]) * target / source)
    bottom = math.ceil((box[1] + box[3]) * target / source)
    left, top = math.floor(x), math.floor(y)
    return {'continuousPx': [x, y, w, h], 'outwardRasterBounds': [left, top, right - left, bottom - top]}


def export_sequence(data, target, route, contacts=None):
    """Explicit route [(clipId,lastTick)]. Contacts keyed clipId:group, once/target externally."""
    validate(data)
    require(target in data['targetsH'], 'unsupported body height')
    clips = {c['id']: c for c in data['clips']}
    contacts = contacts or {}
    used = set()
    root = [0.0, 0.0]
    rows, events = [], []
    wall = 1

    def emit(clip, tick, d, frozen, boxes):
        live = [e['id'] for e in events if e['wallTick'] <= wall < e['wallTick'] + e['duration']]
        rows.append({'wallTick': wall, 'clip': clip['id'], 'actorTick': tick,
                     'drawing': d['id'], 'phase': d['phase'], 'frozen': frozen,
                     'rootH': list(root), 'rootPx': [v * target for v in root],
                     'plannedGrip': d['grip'], 'activeHits': [] if frozen else boxes,
                     'liveEventIds': live})

    def add_event(clip, event, tick, collision=False):
        start = event.get('tick', event.get('ticks', [0])[0])
        duration = event.get('duration', event.get('ticks', [start, start])[1] - start + 1)
        # Contact offsets are anchored to the actual collision, never unconditional nominal C1.
        offset = 0 if event['gate'] == 'always' else start - collision['nominalContact']
        events.append({'id': clip['id'] + ':' + event['id'], 'wallTick': wall + offset,
                       'actorTriggerTick': tick, 'duration': duration, 'gate': event['gate'],
                       'kind': event.get('kind', 'fx'), 'proposal': event})

    for clip_id, last in route:
        require(clip_id in clips, 'route clip absent')
        c = clips[clip_id]
        require(1 <= last <= c['length'], 'route cut outside clip')
        for tick in range(1, last + 1):
            d = drawing_at(c, tick)
            for r in c['root']:
                if r['from'] <= tick <= r['to']:
                    for axis in (0, 1):
                        root[axis] += r['deltaH'][axis] / (r['to'] - r['from'] + 1)
            for e in c['fx'] + c['cues']:
                if e['gate'] == 'always' and e.get('tick', e.get('ticks', [0])[0]) == tick:
                    add_event(c, e, tick)
            active, freeze = [], 0
            for hit in c['hits']:
                key = c['id'] + ':' + hit['group']
                at = contacts.get(key)
                if at is not None:
                    require(hit['active'][0] <= at <= hit['active'][1], 'collision outside active window')
                if hit['active'][0] <= tick <= hit['active'][1]:
                    active.append({'group': hit['group'], 'boxes': [box_export(b, target, data['sourceH']) for b in hit['boxes']],
                                   'knockbackPxPerTick': [v * target / data['sourceH'] for v in hit['knockback']],
                                   'outward': hit['outward']})
                if tick == at and key not in used:
                    used.add(key)
                    freeze = max(freeze, hit['hitstop'])
                    for e in c['fx'] + c['cues']:
                        if e['gate'] == 'contact':
                            add_event(c, e, tick, hit)
            emit(c, tick, d, False, active)
            wall += 1
            for _ in range(freeze):
                emit(c, tick, d, True, active)
                wall += 1
    require(used == set(contacts), 'contact key absent from route')
    return {'contract': 'rosace.choreography-ticks/1', 'sourceId': data['id'],
            'state': 'authored-proposal', 'rendered': False, 'fps': 60, 'bodyH': target,
            'limits': ['not-a-sprite-atlas', 'root-unclamped-proposal', 'pose-goals-not-solved-rig',
                       'cloth-not-simulated', 'effects/audio-not-produced', 'not-runtime-playback'],
            'route': route, 'contactPlan': contacts, 'wallTicks': len(rows),
            'rootTotalH': root, 'events': events, 'ticks': rows}


def checks(data):
    validate(data)
    route = [('m1_1', 15), ('m1_2', 38)]
    w = export_sequence(data, 80, route)
    require(w['wallTicks'] == 53, 'earliest chain dropped/doubled frame')
    require(abs(w['rootTotalH'][0] - 18 / 96) < 1e-9, 'root step dropped/doubled')
    require(not any(e['gate'] == 'contact' for e in w['events']), 'whiff has hit feedback')
    h = export_sequence(data, 144, route, {'m1_1:n1': 9, 'm1_2:n2': 8})
    require(h['wallTicks'] == 59, 'hitstop was lost/double-counted')
    require(sum(r['frozen'] for r in h['ticks']) == 6, 'wrong actor freeze')
    require(h['ticks'][18]['clip'] == 'm1_2' and h['ticks'][18]['actorTick'] == 1, 'hit chain seam off-by-one')
    require(h['ticks'][17]['plannedGrip'] == h['ticks'][18]['plannedGrip'], 'grip discontinuity')
    early = export_sequence(data, 80, route, {'m1_1:n1': 8, 'm1_2:n2': 7})
    require(early['ticks'][8]['drawing'] == 'S1' and early['ticks'][8]['frozen'], 'early collision warps to contact drawing')
    for height in (80, 144):
        for c in data['clips']:
            hit = c['hits'][0]
            bs = [box_export(b, height, 96)['continuousPx'] for b in hit['boxes']]
            span = max(x + width for x, y, width, tall in bs) - min(b[0] for b in bs)
            require(abs(span - height * 2.5) < 1e-9, '80/144 width conversion wrong')
    frozen = [r for r in h['ticks'] if r['frozen'] and r['clip'] == 'm1_1']
    require(frozen[0]['rootH'] == frozen[-1]['rootH'], 'root drifts in hitstop')
    require(frozen[0]['liveEventIds'] != frozen[-1]['liveEventIds'], 'FX wall clock stalls on actor freeze')
    require(box_export([-120, -82, 240, 58], 80, 96)['outwardRasterBounds'] == [-100, -69, 200, 49],
            'exact-bottom raster boundary gained a pixel')
    require(h['ticks'][8]['activeHits'][0]['knockbackPxPerTick'] == [1.2, -3.0], 'knockback unit conversion wrong')
    controls = json.loads((HERE.parents[3] / 'tools/motion-ai/timing/n1_r3c.json').read_text())
    require([[d['id'], d['start'], d['ticks']] for d in data['clips'][0]['drawings']] == controls['exposure']['drawings'], 'N1 exposure differs from frozen control')
    rejected = []
    for name, mutate in [
        ('gap', lambda x: x['clips'][1]['drawings'][1].update(start=5)),
        ('narrow', lambda x: x['clips'][1]['hits'][0].update(boxes=[[-120, -82, 170, 58]])),
        ('grip-pop', lambda x: x['clips'][1]['drawings'][0]['grip'].update(L=1)),
        ('contact-outside-active', lambda x: x['clips'][0]['hits'][0].update(nominalContact=11)),
    ]:
        bad = copy.deepcopy(data)
        mutate(bad)
        try:
            validate(bad)
        except ValueError:
            rejected.append(name)
        else:
            raise ValueError('negative fixture unexpectedly accepted: ' + name)
    return {'status': 'pass', 'kind': 'planning-data-checks', 'whiffTicks': 53, 'contactTicks': 59,
            'rootTotalH': 18 / 96, 'widthPx': {'80': 200, '144': 360}, 'negativeFixturesRejected': rejected,
            'native': 'not-run', 'runtime': 'not-run', 'physicalCloth': 'not-run'}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', type=Path, default=HERE / 'n1-n2.json')
    p.add_argument('--out', type=Path)
    args = p.parse_args()
    data = json.loads(args.input.read_text(encoding='utf-8'))
    result = checks(data)
    result['inputSha256'] = hashlib.sha256(args.input.read_bytes()).hexdigest()
    if args.out:
        require(args.out.is_absolute(), 'output must be absolute')
        args.out.mkdir(parents=True, exist_ok=True)
        route = [('m1_1', 15), ('m1_2', 38)]
        for height in data['targetsH']:
            for name, contact in [('whiff', {}), ('contact', {'m1_1:n1':9, 'm1_2:n2':8}), ('early-contact', {'m1_1:n1':8, 'm1_2:n2':7})]:
                packet = export_sequence(data, height, route, contact)
                (args.out / f'n1-n2-H{height}-{name}.json').write_text(json.dumps(packet, indent=2) + '\n', encoding='utf-8')
        (args.out / 'checks.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
