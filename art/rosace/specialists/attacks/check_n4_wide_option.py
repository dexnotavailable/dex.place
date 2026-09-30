"""Finite source fixtures and planning exports for an unadjudicated N4 option; no rendering."""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent


def need(ok, message):
    if not ok:
        raise ValueError(message)


def inside(point, boxes):
    px, py = point
    return any(x <= px < x+w and y <= py < y+h for x,y,w,h in boxes)


def raster_mask(boxes, height):
    """Sample centres once for visual core and once independently for collision core."""
    scale = height/96
    left = math.floor(min(b[0] for b in boxes)*scale)
    right = math.ceil(max(b[0]+b[2] for b in boxes)*scale)
    top = math.floor(min(b[1] for b in boxes)*scale)
    bottom = math.ceil(max(b[1]+b[3] for b in boxes)*scale)
    return {(x,y) for y in range(top,bottom) for x in range(left,right)
            if inside(((x+.5)/scale,(y+.5)/scale),boxes)}


def row_boxes(mask):
    """One pixel row per contiguous run, preserving voids; never enclosing empty corners."""
    rows = []
    for y in sorted({p[1] for p in mask}):
        xs = sorted(x for x,yy in mask if yy==y)
        first = prev = xs[0]
        for x in xs[1:]:
            if x != prev+1:
                rows.append([first,y,prev-first+1,1])
                first=x
            prev=x
        rows.append([first,y,prev-first+1,1])
    return rows


def validate(option, control_bytes, clip):
    need(option['state']=='authored-unadjudicated-alternative' and not option['rendered'] and not option['runtimeReady'], 'false readiness claim')
    need(hashlib.sha256(control_bytes).hexdigest()==option['controlDataSha256'], 'immutable control differs')
    need(option['controlHead']=='267ef4c6ce058be617fc702079af9a892e71ea7e', 'control retargeted')
    need(option['fps']==60 and option['sourceH']==96 and option['targetsH']==[80,144], 'clock or scale changed')
    need(clip['length']==63 and len(clip['drawings'])==13, 'original clip changed')
    f=option['fan']
    need(f['actorWindow']==[9,9] and f['floorContactTick']==10 and f['nominalContactTick']==10, 'opening/floor clock changed')
    need(f['damageGroup']=='n4:a' and f['hitstop']==4 and f['heavy'] is True, 'reaction/group changed')
    need(f['knockbackSourcePxPerTick']==[.5,1.5] and f['knockbackBasis']=='sourceH96-px-per-tick', 'slam units changed')
    visual=f['visualCoreBoxesSourcePx96']
    hit=f['collisionCoreBoxesSourcePx96']
    for b in visual+hit:
        need(len(b)==4 and all(math.isfinite(v) for v in b) and b[2]>0 and b[3]>0, 'invalid core')
    width=(max(x+w for x,y,w,h in hit)-min(b[0] for b in hit))/96
    need(abs(width-f['spanH'])<1e-9 and width>=2.2, 'false damage width')
    need(abs(max(y+h for x,y,w,h in hit)/96+f['floorClearanceH'])<1e-9, 'air gap changed')
    need(inside([v*96 for v in f['originH']],hit), 'blade emission point disconnected from core')
    for height in (80,144):
        vm, hm = raster_mask(visual,height), raster_mask(hit,height)
        need(vm==hm, 'visual/collision masks disagree')
        widths=[b[2] for b in row_boxes(hm)]
        need(max(widths)==int(2.5*height), 'raster hitting width lost')
        need(sum(w==int(2.5*height) for w in widths)>=int(.125*height), 'full-width core reduced to hairline')
        for key,point in option['targetFixturesSourcePx96'].items():
            pixel=tuple(math.floor(v*height/96) for v in point)
            need((pixel in hm)==key.startswith('inside'), key+' raster hit/miss differs')
    fixtures=option['targetFixturesSourcePx96']
    for key,point in fixtures.items():
        need(inside(point,hit)==key.startswith('inside'), key+' expected hit/miss differs')


def timeline(option, clip, height, early_contact=False):
    fan=option['fan']
    core=row_boxes(raster_mask(fan['collisionCoreBoxesSourcePx96'],height))
    root=[0.0,0.0]
    out=[]
    for tick in range(1,64):
        drawing=next(name for name,start,hold in clip['drawings'] if start<=tick<start+hold)
        for r in clip['root']:
            if r['from']<=tick<=r['to']:
                for axis in (0,1):
                    root[axis]+=r['deltaSourcePx'][axis]/96/(r['to']-r['from']+1)
        def row(frozen):
            wall=len(out)+1
            is_fan=tick==9
            return {'wallTick':wall,'actorTick':tick,'drawing':drawing,'frozen':frozen,
                    'rootH':list(root),'rootPx':[v*height for v in root],
                    'fanVisible':is_fan,'fanCollisionSample':is_fan and not frozen,
                    'fanGroup':'n4:a' if is_fan else None,'fanCoreRowsPx':core if is_fan else [],
                    'ornamentWallAge':wall-9 if is_fan else None,
                    'originalFloorContactTrigger':tick==10 and not frozen,
                    'limits':'pose/tip/cloth/FX-assets remain unsolved; all original controller clocks unchanged'}
        out.append(row(False))
        if early_contact and tick==9:
            out.extend(row(True) for _ in range(fan['hitstop']))
    value={'contract':'rosace.attack-option-ticks/1','state':option['state'],'sourceId':option['id'],
            'rendered':False,'runtimeReady':False,'bodyH':height,'fps':60,'route':'earlyf9contact' if early_contact else 'whiff',
            'controlHead':option['controlHead'],'originalClipPlan':clip,'optionPlan':option,
            'ticks':out,'wallTicks':len(out),'rootTotalH':root}
    validate_timeline(value,clip)
    return value


def validate_timeline(value,clip):
    for row in value['ticks']:
        tick=row['actorTick']
        expected=next(name for name,start,hold in clip['drawings'] if start<=tick<start+hold)
        need(row['drawing']==expected,'drawing changed from exact control exposure')
        if row['frozen']:
            need(tick==9 and row['drawing']=='S1' and row['fanVisible'] and not row['fanCollisionSample'],
                 'early-hit freeze pose/core/geometry changed')


def checks(option, raw, clip):
    validate(option,raw,clip)
    baseline=next(h for h in clip['hits'] if h['active']==[9,11])['boxesSourcePx96']
    need((max(x+w for x,y,w,h in baseline)-min(b[0] for b in baseline))/96==1, 'control narrow opening changed')
    need(not inside(option['targetFixturesSourcePx96']['insideLeft'],baseline) and
         not inside(option['targetFixturesSourcePx96']['insideRight'],baseline), 'baseline unexpectedly wide')
    exported=[]
    for height in (80,144):
        w=timeline(option,clip,height)
        h=timeline(option,clip,height,True)
        need(w['wallTicks']==63 and h['wallTicks']==67, 'actor/hitstop count changed')
        frozen=[r for r in h['ticks'] if r['frozen']]
        need(all(r['drawing']=='S1' and r['fanVisible'] and not r['fanCollisionSample'] for r in frozen), 'freeze pose/core/damage mismatch')
        need(frozen[0]['rootH']==frozen[-1]['rootH'] and frozen[0]['ornamentWallAge']!=frozen[-1]['ornamentWallAge'], 'frozen body or liveFX clocks wrong')
        need(next(r['wallTick'] for r in h['ticks'] if r['originalFloorContactTrigger'])==14, 'earlyfloorcontact')
        need(next(r['wallTick'] for r in w['ticks'] if r['originalFloorContactTrigger'])==10, 'whiff retimed')
        need(all(abs(a-b)<1e-9 for a,b in zip(w['rootTotalH'],[1.25,0])), 'root changed')
        exported.append({'H':height,'continuousSpanPx':2.5*height,'fullWidthDepthPx':.125*height,
                         'maskAreaPx':len(raster_mask(option['fan']['collisionCoreBoxesSourcePx96'],height)),
                         'farEndFixtureHits':True,'voidAndFloorFixtureMisses':True,'whiffTicks':63,'earlyContactTicks':67})
    # The once-per-victim ledger is shared across fan/chop/fissure; do not mint another group.
    seen=set()
    hits=0
    for tick,group in [(9,option['fan']['damageGroup']),(10,clip['hits'][1]['group'])]:
        key=('same-victim',group)
        if key not in seen:
            seen.add(key)
            hits+=1
    need(hits==1, 'fan plus fissure double-hit')
    bads=[
        ('thin-outline',lambda d:d['fan'].__setitem__('visualCoreBoxesSourcePx96',[[-24,-6,240,1]])),
        ('cosmetic-only-wide',lambda d:d['fan'].__setitem__('collisionCoreBoxesSourcePx96',baseline)),
        ('bounding-box-void',lambda d:d['fan'].__setitem__('collisionCoreBoxesSourcePx96',[[-24,-39,240,34]])),
        ('independent-fan-group',lambda d:d['fan'].__setitem__('damageGroup','n4:fan')),
        ('premature-floor',lambda d:d['fan'].__setitem__('floorContactTick',9)),
    ]
    rejected=[]
    for name,mutate in bads:
        bad=copy.deepcopy(option)
        mutate(bad)
        try:
            validate(bad,raw,clip)
        except ValueError:
            rejected.append(name)
        else:
            raise ValueError('negative control accepted: '+name)
    warp=timeline(option,clip,80,True)
    warp['ticks'][9]['drawing']='C1'
    try:
        validate_timeline(warp,clip)
    except ValueError:
        rejected.append('contact-pose-warp')
    else:
        raise ValueError('contact pose warp accepted')
    return {'status':'pass','kind':'authored-option-planning-checks','targets':exported,
            'sameVictimDamageCount':hits,'negativeControlsRejected':rejected,
            'native':'not-run','rendered':'not-run','visualWidth':'not-verified','physicalCloth':'not-run',
            'controlSha256':hashlib.sha256(raw).hexdigest()}


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--out',type=Path)
    args=p.parse_args()
    path=HERE/'n4-wide-opening-option.json'
    option=json.loads(path.read_text())
    raw=(HERE/option['controlData']).read_bytes()
    clip=next(c for c in json.loads(raw)['clips'] if c['id']=='m1_4')
    result=checks(option,raw,clip)
    result['optionSha256']=hashlib.sha256(path.read_bytes()).hexdigest()
    if args.out:
        need(args.out.is_absolute(),'absolute output required')
        args.out.mkdir(parents=True,exist_ok=True)
        for height in option['targetsH']:
            for name,contact in [('whiff',False),('early-contact',True)]:
                value=timeline(option,clip,height,contact)
                (args.out/f'n4-option-H{height}-{name}.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
        (args.out/'checks.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result))


if __name__=='__main__':
    main()
