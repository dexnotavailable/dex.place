"""Portable original-kit drawing/geometry planning exports; no native rendering or runtime writes."""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path

from export_choreography import box_export, require

HERE = Path(__file__).resolve().parent


def validate(data):
    require(data['contract'] == 'rosace.kit-plan/1', 'unsupported kit planning contract')
    require(data['state'] == 'authored-proposal' and not data['rendered'], 'not a rendered kit')
    require(data['fps'] == 60 and data['sourceH'] == 96, 'clock/unit basis changed')
    expected = {'m1_3':55, 'm1_4':63, 'm1_5':94, 'dash':23, 'dash_attack':41, 'skill_q':81, 'ult_r':208}
    require({c['id']: c['length'] for c in data['clips']} == expected, 'missing/original kit timing changed')
    require(data['m1Chain'] == ['m1_1','m1_2','m1_3','m1_4','m1_5'], 'five-hit order changed')
    for c in data['clips']:
        next_tick = 1
        for name, start, ticks in c['drawings']:
            require(start == next_tick and isinstance(ticks, int) and ticks > 0, f"{c['id']} gap/overlap")
            next_tick += ticks
        require(next_tick == c['length'] + 1, f"{c['id']} exposure length changed")
        for r in c['root']:
            require(1 <= r['from'] <= r['to'] <= c['length'], 'root outside clip')
        for hit in c['hits']:
            require(1 <= hit['active'][0] <= hit['nominal'] <= hit['active'][1] <= c['length'], 'hit timing outside clip')
            require('anchor' in hit, 'missing hit anchor identity')
            require(hit['knockbackBasis'] == 'sourceH96-px-per-tick', 'ambiguous reaction units')
            require('heavy' in hit and 'knockbackSourcePxPerTick' in hit, 'reaction omitted rather than unresolved')
            for b in hit.get('boxesSourcePx96', []) + hit.get('boxH', []):
                require(len(b) == 4 and all(math.isfinite(v) for v in b) and b[2] > 0 and b[3] > 0, 'invalid hit geometry')
        require(all(1 <= start <= c['length'] for dest, start in c['cancel']), 'invalid cancel')
    r = next(c for c in data['clips'] if c['id'] == 'ult_r')
    require([f['ticks'] for f in r['flashes']] == [[95,96],[195,196]], 'full-screen flash budget/timing changed')
    require(r['stage']['totalFreezeIncludingParticles'] == [161,182], '22tick freeze changed')
    require(r['stage']['controlReturns'] == r['length'] + 1, 'control-return off-by-one')
    q = next(c for c in data['clips'] if c['id'] == 'skill_q')
    require(q['shatter']['earliestRetriggerTick'] + 10 == 54, 'Q earliest shatter changed')
    require(q['shatter']['autoTriggerTick'] == 24 + 120, 'Q auto-shatter delay changed')


def export_clip(data, clip, height):
    root = [0.0,0.0]
    rows = []
    for tick in range(1, clip['length'] + 1):
        name = next(name for name, start, duration in clip['drawings'] if start <= tick < start + duration)
        for r in clip['root']:
            if r['from'] <= tick <= r['to']:
                for axis in (0,1):
                    root[axis] += r['deltaSourcePx'][axis] / data['sourceH'] / (r['to'] - r['from'] + 1)
        active = []
        for h in clip['hits']:
            if h['active'][0] <= tick <= h['active'][1]:
                boxes = [box_export(b, height, 96) for b in h.get('boxesSourcePx96', [])]
                boxes += [box_export(b, height, 1) for b in h.get('boxH', [])]
                velocity = h['knockbackSourcePxPerTick']
                active.append({'group':h['group'], 'anchor':h['anchor'],
                               'geometryResolved':bool(boxes), 'targetSizeBoxes':boxes,
                               'geometryInstructions':h.get('geometry'), 'persistent':h.get('persistent',False),
                               'note':'world anchor must be resolved by adapter; target-size coordinates are not root-rebased',
                               'hitstop':h['hitstop'], 'freeze':h.get('freeze','actor+victim-proposal'),
                               'knockbackPxPerTick':None if velocity is None else [v*height/96 for v in velocity],
                               'knockbackResolved':velocity is not None, 'heavy':h['heavy'],
                               'reactionStatus':h['reactionStatus'], 'outwardX':h.get('outwardX',True),
                               'storeKnockbackUntil':h.get('storeKnockbackUntil')})
        stage = clip.get('stage',{})
        total = stage.get('totalFreezeIncludingParticles',[-1,-1])
        rows.append({'actorTick':tick,'drawing':name,'rootH':list(root),'rootPx':[v*height for v in root],
                     'activeHitPlans':active,'totalFreeze':total[0]<=tick<=total[1],
                     'cancelInto':[dest for dest,start in clip['cancel'] if tick>=start]})
    persistent = []
    if 'shatter' in clip:
        s = clip['shatter']
        persistent.append({'id':'q.shatter','trigger':{'earliestActorTick':s['earliestRetriggerTick'],
                           'automaticActorTick':s['autoTriggerTick']},'damageRelativeTicks':[10,12],
                           'anchor':s['anchor'],'targetSizeBoxes':[box_export(b,height,96) for b in s['boxesSourcePx96']],
                           'knockbackPxPerTick':[v*height/96 for v in s['knockbackSourcePxPerTick']],
                           'heavy':s['heavy'],'hitstop':s['hitstop'],'freeze':s['freeze'],
                           'geometryResolved':False,'note':'world/terrain binding remains required'})
    if 'tail' in clip:
        persistent.append({'id':'r.rain','damageActorTicks':clip['tail']['rainDamage'],
                           'anchor':'world-ballistic-landings','boxSizePx':[6*height/96,6*height/96],
                           'count':36,'hitstop':clip['tail']['rainHitstop'],'geometryResolved':False,
                           'note':'actual trajectories, terrain landings and groups require adapter/native proof'})
    return {'contract':'rosace.kit-ticks/1','sourceId':data['id'],'state':'authored-proposal',
            'rendered':False,'runtimeReady':False,'bodyH':height,'fps':60,'clip':clip['id'],
            'sourceClipPlan':clip,'ticks':rows,'persistentPlans':persistent,'rootTotalH':root,
            'limits':['whiff-planning-clock','collision/root/rig-unsolved','no-atlas/audio/FX-assets',
                      'physicalcloth-not-simulated','world-anchors-explicitly-unresolved']}


def checks(data):
    validate(data)
    clips = {c['id']:c for c in data['clips']}
    expected_root = {'m1_3':[12/96,0], 'm1_4':[120/96,0], 'm1_5':[4/96,0],
                     'dash':[176/96,0], 'dash_attack':[128/96,0], 'skill_q':[0,0], 'ult_r':[0,0]}
    for name,total in expected_root.items():
        actual = export_clip(data, clips[name], 80)['rootTotalH']
        require(all(abs(a-b)<1e-9 for a,b in zip(actual,total)), name+' wrong root total')
    n4 = export_clip(data,clips['m1_4'],80)
    require(abs(n4['ticks'][21]['rootH'][1] + 40/96)<1e-9, 'vault peak lost')
    require(n4['ticks'][8]['activeHitPlans'][0]['group'] == 'n4:a'
            and len(n4['ticks'][9]['activeHitPlans'])==2, 'N4 narrow-chop caveat concealed')
    n5 = export_clip(data,clips['m1_5'],144)
    require(n5['ticks'][53]['drawing'] == n5['ticks'][54]['drawing'] == 'K1', 'same kneel image split wrongly')
    q = export_clip(data,clips['skill_q'],80)
    require(q['ticks'][19]['drawing']=='T3' and q['ticks'][20]['drawing']=='Q3', 'Q14tick partial loop changed')
    q144 = export_clip(data,clips['skill_q'],144)
    require(q144['persistentPlans'][0]['knockbackPxPerTick']==[3.75,3], 'persistent Q shatter reaction unscaled')
    r = export_clip(data,clips['ult_r'],144)
    require(sum(t['totalFreeze'] for t in r['ticks'])==22, 'R total-freeze ticks wrong')
    require(r['ticks'][94]['activeHitPlans'][0]['anchor']=='logicalViewport', 'viewport hit incorrectly root anchored')
    require(r['ticks'][112]['activeHitPlans'][0]['anchor']=='world-oculus-at-rise-end', 'rose wave anchor wrong')
    execution = r['ticks'][194]['activeHitPlans'][0]
    require(execution['knockbackPxPerTick']==[4.5,-7.5] and execution['storeKnockbackUntil']==197,
            'stored execution launch missing or unscaled')
    require(n4['ticks'][9]['activeHitPlans'][0]['knockbackPxPerTick']==[0.5*80/96,1.5*80/96], 'N4 slam reaction missing')
    asp = clips['dash_attack']
    require(any(e.get('spawnTicks')==[4,7] for e in asp['fx']), 'Aspersion afterimages missing')
    require(asp['hits'][2]['anchor']=='world-ballistic-landings', 'droplet anchor wrong')
    qfx = clips['skill_q']['fx']
    require(any(e.get('endOn')=='q.shatter:t10' and e.get('startTick')==30 for e in qfx), 'ward lifetime not event driven')
    require(any(e.get('id')=='q.dust' and e['ticks']==[24,50] for e in qfx), 'Q dust lifetime wrong')
    n5fx = clips['m1_5']['fx']
    require(any(e.get('id')=='n5.ground' and e['ticks']==[30,60] for e in n5fx), 'N5 ground response late/long')
    require(any(e.get('id')=='n5.spikes' and e['ticks']==[54,72] for e in n5fx), 'spike decay lifetime wrong')
    for height in (80,144):
        spikes = clips['m1_5']['hits'][2]['boxesSourcePx96']
        bs = [box_export(b,height,96)['continuousPx'] for b in spikes]
        span = max(x+w for x,y,w,h in bs)-min(b[0] for b in bs)
        require(abs(span-height*5)<1e-9, 'finisher width conversion wrong')
    for name,mutate in [
        ('Q-loop-gap',lambda d:d['clips'][5]['drawings'][8].__setitem__(1,20)),
        ('extra-flash',lambda d:d['clips'][6]['flashes'].append({'ticks':[130,131]})),
        ('wrong-freeze',lambda d:d['clips'][6]['stage'].__setitem__('totalFreezeIncludingParticles',[161,181])),
        ('missing-finisher',lambda d:d['m1Chain'].pop()),
    ]:
        bad = copy.deepcopy(data)
        mutate(bad)
        try:
            validate(bad)
        except ValueError:
            pass
        else:
            raise ValueError('negative fixture accepted: '+name)
    return {'status':'pass','kind':'original-kit-planning-checks', 'clips':{k:v['length'] for k,v in clips.items()},
            'rootTotalsH':expected_root,'RTotalFreeze':22,'RFlashStarts':[95,195],'QEarliestShatter':54,
            'native':'not-run','runtime':'not-run','physicalCloth':'not-run',
            'negativeFixturesRejected':['Q-loop-gap','extra-flash','wrong-freeze','missing-finisher'],
            'reviewRegressions':['event-driven-wards','Aspersion-afterimages','world-anchor-identity',
                                 'distinct-FX-lifetimes','scaled-stored-reactions']}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--out',type=Path)
    args = p.parse_args()
    path = HERE/'kit.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    result = checks(data)
    result['inputSha256']=hashlib.sha256(path.read_bytes()).hexdigest()
    if args.out:
        require(args.out.is_absolute(),'output must be absolute')
        args.out.mkdir(parents=True,exist_ok=True)
        for clip in data['clips']:
            for height in data['targetsH']:
                packet = export_clip(data,clip,height)
                (args.out/f"{clip['id']}-H{height}.json").write_text(json.dumps(packet,indent=2)+'\n',encoding='utf-8')
        (args.out/'checks.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result))


if __name__=='__main__':
    main()
