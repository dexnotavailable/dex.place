"""Matched genuine native passes, unchanged finish, honest spatial leakage."""
import argparse
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
import binding as B

sys.path.insert(0,str(B.REPO/'tools/pixel-pipeline/next'))
import reconstruction_finish as F


def read_image(path):
    with Image.open(path) as im:
        return np.asarray(im.convert('RGBA')).copy()


def exact_file(a,b):
    if B.sha(a)!=B.sha(b):
        raise AssertionError(f'exact genuine native file differs: {a.name}')


def mask(size,polygons,scale):
    image=Image.new('L',size)
    draw=ImageDraw.Draw(image)
    for points in polygons:
        if len(points)<3:
            raise ValueError('invalid projected actual support polygon')
        for point in points:
            if len(point)!=3 or not np.isfinite(point).all() or point[2]<=0:
                raise ValueError('invalid projected source support/depth')
        draw.polygon([(p[0]*scale,p[1]*scale) for p in points],fill=255)
    return np.asarray(image)>0


def dilate(data):
    return np.asarray(Image.fromarray(np.uint8(data)*255).filter(ImageFilter.MaxFilter(3)))>0


def summarize_light(light,select):
    if not select.any():
        raise AssertionError('no actual skin in real aperture')
    return {name:{'min':int(light[...,i][select].min()),
                  'median':float(np.median(light[...,i][select])),
                  'max':int(light[...,i][select].max())}
            for i,name in enumerate(('ramp','AO','spec'))}


def compare_data(a,b,rawallow,finalallow):
    if a.shape!=b.shape or a.shape[:2]!=rawallow.shape:
        raise AssertionError('raw shape/mask mismatch')
    change=np.any(a!=b,axis=2)
    return {'changed':int(change.sum()),'outside':int((change&~rawallow).sum()),
            'alpha':int((a[...,3]!=b[...,3]).sum())}


def run(root):
    provenance=B.verify(); root=root.resolve()
    if (B.REPO/'review/rosace').resolve() not in root.parents or (root/'window-ao-proof.json').exists():
        raise ValueError('fresh executing private post output required')
    finish=F.finish_recipe(root)
    rows=[]; failures=[]
    for px in (144,80):
        parent=B.PARENT/f'reconstruction-raw/idle/px{px}'
        control=root/f'control-raw/idle/px{px}'; candidate=root/f'rebaked-raw/idle/px{px}'
        rawhashes={}
        for name in B.RAW[:7]:
            exact_file(control/name,parent/name)
            rawhashes[name]={mode:B.sha(path/name) for mode,path in
                            (('actual545',parent),('control',control),('rebaked',candidate))}
        for name in ('id.png','normal.png','depth.png','depth2.png','noise.png'):
            exact_file(control/name,candidate/name)
        metas=[json.loads((p/'meta.json').read_text()) for p in (parent,control,candidate)]
        for key in ('canvas','anchor','ss','px','ppm','cam','materials','parts','anchors','d9'):
            # Only absolute source path may differ between executing exact worktrees.
            vals=[m[key] for m in metas]
            if key=='d9':
                vals=[dict(v,r2=Path(v['r2']).name) for v in vals]
            if vals[0]!=vals[1] or vals[1]!=vals[2]:
                raise AssertionError(f'exact native camera/pose/render setting differs: {key}')
        reconstruction=[json.loads((p/'reconstruction.json').read_text()) for p in (parent,control,candidate)]
        for key in ('effectivePose','evaluatedBoneMatrices','recipeHash','handScale','changedPoseFields','contact'):
            if reconstruction[0][key]!=reconstruction[1][key] or reconstruction[1][key]!=reconstruction[2][key]:
                raise AssertionError(f'exact actual rig/recipe/contact differs: {key}')
        geometries=[json.loads((p/'window_geometry.json').read_text()) for p in (parent,control,candidate)]
        if geometries[0]!=geometries[1] or geometries[1]!=geometries[2]:
            raise AssertionError('unchanged actual W2 opening/rim guard or projection differs')
        records=[json.loads((p/'window_ao.json').read_text()) for p in (control,candidate)]
        if records[0]['mode']!='control' or records[0]['bodyDataTouched'] or records[1]['mode']!='rebaked' or not records[1]['bodyDataTouched']:
            raise AssertionError('native matched AO mode receipts missing')
        ids=read_image(candidate/'id.png'); ss=int(metas[2]['ss'])
        size=ids.shape[1::-1]
        aperture=mask(size,[geometries[2]['boundaryProjectedPx']],ss)
        support=mask(size,[f['points'] for f in records[1]['supportProjectedPx']],ss)
        rawallow=dilate(aperture|support) # exactly one raw supersample edge
        finalallow=rawallow.reshape(metas[2]['canvas'][1],ss,metas[2]['canvas'][0],ss).any(axis=(1,3))
        finalallow=dilate(finalallow) # declared one sprite-cell local finish edge
        Image.fromarray(np.uint8(rawallow)*255).save(root/f'ao-raw-scope-{px}.png')
        Image.fromarray(np.uint8(finalallow)*255).save(root/f'ao-finished-scope-{px}.png')
        rawdiff={}
        for name in ('light.png','beauty.png'):
            rawdiff[name]=compare_data(read_image(control/name),read_image(candidate/name),rawallow,finalallow)
            if rawdiff[name]['outside'] or rawdiff[name]['alpha']:
                failures.append(f'{px}/{name} outside={rawdiff[name]["outside"]} alpha={rawdiff[name]["alpha"]}')
        if not rawdiff['light.png']['changed']:
            failures.append(f'{px}: rebaked AO has no actual light-pass change')
        skin=(ids[...,3]>0)&(ids[...,0]==metas[2]['materials']['skin']['id'])&(ids[...,1]==metas[2]['parts']['body'])
        finished=[]
        for path in (control,candidate):
            if (path/'R2').exists():
                raise ValueError('preserve prior finish; fresh native output required')
            F.D.process(str(path),finish,'D1','R2',True)
            finished.append(read_image(path/'R2/still.png'))
        for name in ('still.png','still_ground.png'):
            if not np.array_equal(read_image(control/'R2'/name),read_image(parent/'R2'/name)):
                raise AssertionError(f'unchanged actual545 finish replay differs: {px}/{name}')
        change=np.any(finished[0]!=finished[1],axis=2)
        outside=int((change&~finalallow).sum())
        alpha=int((finished[0][...,3]!=finished[1][...,3]).sum())
        if outside or alpha:
            failures.append(f'{px}/finished outside={outside} alpha={alpha}; preserve/reject adaptive coupling, no composition')
        clusters={}
        for mode,im in zip(('control','rebaked'),finished):
            values,counts=np.unique(im[change,:3],axis=0,return_counts=True)
            clusters[mode]=[{'RGB':list(map(int,v)),'pixels':int(n)} for v,n in zip(values,counts)]
        lights=[read_image(p/'light.png') for p in (control,candidate)]
        rows.append({'px':px,'controlSevenRawPassBytesEqualActual545':True,
                     'controlFinishedStillAndGroundReplayChangedPixels':0,
                     'candidateIdNormalDepthDepth2NoiseExact':True,
                     'sameExactCameraBonePoseAnchorPpm':True,'rawDifferences':rawdiff,
                     'finishedChanged':int(change.sum()),'finishedOutsideScope':outside,'finishedAlphaChanged':alpha,
                     'actualApertureBodySkinSubpixels':int((aperture&skin).sum()),
                     'openingLight':{mode:summarize_light(light,aperture&skin) for mode,light in zip(('control','rebaked'),lights)},
                     'otherBodySkinLight':{mode:summarize_light(light,skin&~rawallow) for mode,light in zip(('control','rebaked'),lights)},
                     'changedPixelClusters':clusters,'rawHashes':rawhashes,
                     'selectedFaceCount':len(records[1]['ao']['plan']['selectedFaces']),
                     'selectedPointCount':len(records[1]['ao']['plan']['selectedPoints']),
                     'fieldSourceSha256':records[1]['ao']['fieldSourceSha256']})
        # Actual full panels and literal chest crops; no modified/replaced output pixels.
        bounds=np.asarray(geometries[2]['rimOuterProjectedPx'])[:,:2]
        box=(*np.floor(bounds.min(axis=0)-2).astype(int),*np.ceil(bounds.max(axis=0)+3).astype(int))
        for scale in (1,3):
            images=[Image.fromarray(im) for im in finished]
            w,h=images[0].size
            sheet=Image.new('RGB',(2*(w*scale+20),h*scale+30),'#212126'); draw=ImageDraw.Draw(sheet)
            for i,(label,im) in enumerate(zip(('open control','same opening AO rebake'),images)):
                x=i*(w*scale+20)+10; draw.text((x,5),label,fill='#d9d0bb')
                large=im.resize((w*scale,h*scale),Image.Resampling.NEAREST); sheet.paste(large,(x,23),large)
            sheet.save(root/f'window-ao-native-{px}-x{scale}.png')
        for mode,im in zip(('control','rebaked'),finished):
            crop=Image.fromarray(im).crop(box)
            crop.resize((crop.width*8,crop.height*8),Image.Resampling.NEAREST).save(root/f'window-ao-chest-{mode}-{px}-x8.png')
    proof={'kind':'genuine native controlled open-geometry AO diagnostic','provenance':provenance,
           'rows':rows,'failures':failures,'passedMechanicalScopeGuards':not failures,
           'artAcceptance':False,'causeConfirmed':False,'defaultAdoption':False,
           'limits':'actual geometry/material junction remains below9; inspect gold/skin/shadow and three fresh blind actual-pixel critics; stills prove no motion/cloth'}
    (root/'window-ao-proof.json').write_text(json.dumps(proof,indent=2,allow_nan=False),encoding='utf-8')
    B.verify()
    print(json.dumps({'proof':str(root/'window-ao-proof.json'),'failures':failures,'rows':[{k:v for k,v in row.items() if k not in ('rawHashes','changedPixelClusters')} for row in rows]},indent=2))
    if failures:
        raise AssertionError('native AO spatial/finish scope rejected; complete outputs and leakage report retained')


if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--root',required=True,type=Path)
    run(p.parse_args().root)
