"""Delivery-only actual matched R2/FC1 native finish and preservation proof."""
import argparse
import copy
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image,ImageDraw
import facecage_png as PNG
import facecage_inputs as INPUTS

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
PIPE = REPO/"tools/pixel-pipeline"
sys.path.insert(0,str(PIPE/"drive9"))
import d9_post as D

PASSES = ("id.png","normal.png","depth.png","depth2.png","light.png","beauty.png","noise.png")
RAW6_SCHEMA=['id','normal','depth','light','beauty','noise']
RAW7_SCHEMA=['id','normal','depth','light','beauty','depth2','noise']
ANCHOR_ROLE='cage geometry placement only; actual eye bones/pose/facing unchanged'


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def rgba(path):
    return PNG.decode(path)[0]


def source_identity(value,expected_name,recorded_pose_sha1=None):
    path=Path(value)
    if not path.is_absolute() or path.name!=expected_name:
        raise AssertionError('only explicit absolute same-filename source relocation is allowed')
    raw=path.read_bytes()
    if recorded_pose_sha1 is not None and hashlib.sha1(raw).hexdigest()[:12]!=recorded_pose_sha1:
        raise AssertionError('pose_sha1 does not match that metadata record source raw bytes')
    return ({'filename':path.name,'canonicalLfSha256':hashlib.sha256(raw.replace(b'\r\n',b'\n')).hexdigest()},
            {'path':str(path.resolve()),'rawSha256':hashlib.sha256(raw).hexdigest(),'rawPoseSha1Prefix':hashlib.sha1(raw).hexdigest()[:12]})


def normalized_metadata(meta,role,pose_name):
    result=copy.deepcopy(meta); proof={}
    expected_passes=RAW6_SCHEMA if role=='frozenR2' else RAW7_SCHEMA
    if result.get('passes')!=expected_passes:
        raise AssertionError('explicit frozen-six/actual-seven pass schema differs')
    result['passes']=RAW7_SCHEMA[:] # only declared addition: separately proven depth2
    if role in ('control','candidate'):
        if Path(result['pose_file']).resolve()!=(REPO/'art/rosace/poses'/pose_name).resolve() or Path(result['d9']['r2']).resolve()!=(PIPE/'drive9/r2_model.json').resolve():
            raise AssertionError('new metadata source paths must be executing exact repo sources')
    pose,proof['pose_file']=source_identity(result['pose_file'],pose_name,result['pose_sha1'])
    model,proof['d9.r2']=source_identity(result['d9']['r2'],'r2_model.json')
    result['pose_file']=pose; result['pose_sha1']=pose['canonicalLfSha256']; result['d9']['r2']=model
    if role=='candidate':
        anchors=result['anchors']
        added={'facecage_rig_eye_anchors','facecage_eye_placement','facecage_anchor_role'}
        if not added<=set(anchors) or anchors['facecage_anchor_role']!=ANCHOR_ROLE:
            raise AssertionError('declared candidate cage anchor interface missing/changed')
        if set(anchors['facecage_rig_eye_anchors'])!={'L','R'} or set(anchors['facecage_eye_placement'])!={'L','R'}:
            raise AssertionError('candidate cage anchor side schema differs')
        for side in 'LR':
            actual=anchors[f'eye_{side}']; original=anchors['facecage_rig_eye_anchors'][side]; placement=anchors['facecage_eye_placement'][side]
            if len(actual)!=4 or len(original)!=4 or len(placement)!=3 or actual[:3]!=placement or actual[3]!=original[3] or not all(math.isfinite(v) for v in (*actual,*original,*placement)):
                raise AssertionError('candidate cage coordinates/facing violate declared interface')
            anchors[f'eye_{side}']=original
        for key in added: del anchors[key]
    return result,proof


def exact_metadata_value(value,baseline):
    encode=lambda row:json.dumps(row,sort_keys=True,allow_nan=False,separators=(',',':'))
    if encode(value)!=encode(baseline):
        raise AssertionError('exact normalized metadata/source identity changed; no numeric or JSON-semantic waiver')


def guard_metadata(am,bm,frozen,failed,ar,br,binding):
    if ar.get('sourceInputBinding')!=binding or br.get('sourceInputBinding')!=binding:
        raise AssertionError('both actual trial sourceInputBinding records must equal verified input binding')
    pose_name=Path(frozen['pose_file']).name
    rows=[normalized_metadata(meta,role,pose_name) for meta,role in
          ((frozen,'frozenR2'),(failed,'failedBdDepth2'),(am,'control'),(bm,'candidate'))]
    for value,_ in rows[1:]: exact_metadata_value(value,rows[0][0])
    return {'allOtherMetadataExact':True,'relocationProof':dict(zip(('frozenR2','failedBdDepth2','control','candidate'),(p for _,p in rows))),
            'sourceEquivalence':'same filename and byte-exact after ONLY CRLF->LF, raw hashes retained and each pose_sha1 checked; no JSON-semantic/numeric tolerance'}


def guarded_raw_images(a,b,am,bm):
    images=[]
    for path,meta in ((a,am),(b,bm)):
        if type(meta['ss']) is not int or meta['ss']<=0 or len(meta['canvas'])!=2 or any(type(v)is not int or v<=0 for v in meta['canvas']):
            raise AssertionError('positive integer native canvas/SS required')
        expected=(meta['canvas'][1]*meta['ss'],meta['canvas'][0]*meta['ss'],4)
        row={}
        for filename in PASSES:
            pixels=rgba(path/filename)
            if pixels.shape!=expected:
                raise AssertionError('EVERY raw PNG shape must match ID/metadata before ROI: '+filename)
            row[filename]=pixels
        images.append(row)
    if images[0]['id.png'].shape!=images[1]['id.png'].shape:
        raise AssertionError('control/candidate raw ID shapes differ')
    return images


def matrix_error(a,b):
    if set(a)!=set(b):
        raise AssertionError("actual bone sets differ")
    errors = []
    for name in a:
        if len(a[name])!=4 or len(b[name])!=4:
            raise AssertionError("actual4x4 matrices required")
        for x,y in zip(a[name],b[name]):
            if len(x)!=4 or len(y)!=4 or not all(math.isfinite(v) for v in x+y):
                raise AssertionError("invalid actual bone matrix")
            errors.extend(abs(v-w) for v,w in zip(x,y))
    return max(errors,default=0)


def dilate(mask,n):
    out = mask.copy()
    for _ in range(n):
        old = out.copy()
        out[1:] |= old[:-1]
        out[:-1] |= old[1:]
        out[:,1:] |= old[:,:-1]
        out[:,:-1] |= old[:,1:]
    return out


def run(root,reference):
    root,reference = root.resolve(),reference.resolve()
    binding=INPUTS.verify()
    if reference!=INPUTS.R2.resolve(): raise ValueError('exact frozen R2 six-pass/finished reference required')
    if not (REPO/"review/rosace/specialists/refinement/facecage").resolve() in root.parents or root==reference or root in reference.parents or reference in root.parents:
        raise ValueError("fresh separate private facecage output required")
    if (root/"facecage-native-proof.json").exists():
        raise ValueError("never overwrite native proof")
    rows,hashes,failures = [],{},[]
    for shot in ("idle","back"):
        for px in (144,80):
            a,b = [root/mode/shot/f"px{px}" for mode in ("control","facecage1")]
            am,bm = read(a/"meta.json"),read(b/"meta.json")
            ar,br = read(a/"facecage_trial.json"),read(b/"facecage_trial.json")
            metadata_guard=guard_metadata(am,bm,read(reference/shot/f'px{px}/meta.json'),
                read(INPUTS.FAILED/shot/f'px{px}/meta.json'),ar,br,binding)
            if ar["mode"]!="control" or ar["geometry"]["enabled"] or br["mode"]!="facecage1" or not br["geometry"]["enabled"] or not br["geometry"]["protectedDecodedNormalsExact"]:
                raise AssertionError("actual disabled control/enabled guarded cage required")
            if not br['geometry'].get('protectedEncodedNormalsExact') or br['geometry']['originalP0VertexCount']!=941:
                raise AssertionError('ALL original941 P0 plus anatomy encoded/decoded guard required')
            control_replay={}
            for filename in INPUTS.RAW6:
                control_replay[filename]=PNG.exact(a/filename,reference/shot/f'px{px}'/filename)
            control_replay['depth2.png']=PNG.exact(a/'depth2.png',INPUTS.FAILED/shot/f'px{px}/depth2.png')
            for key in ("headMetrics","finish","cuffC1Included","bodyPoseChanged","eyeRigChanged"):
                if ar[key]!=br[key]:
                    raise AssertionError("undeclared parent/rig/finish construction lever")
            err = matrix_error(ar["evaluatedBoneMatrices"],br["evaluatedBoneMatrices"])
            if err>1e-6:
                raise AssertionError("actual rig changed; no headtilt/scale/pose attribution")
            for field in ("canvas","anchor","ss","px","cam","ppm","yaw","elev","materials","parts"):
                if am[field]!=bm[field]:
                    raise AssertionError("matched framing/scale/materials differ; no align/resampling fallback")
            af,bf = read(a/"facepass.json"),read(b/"facepass.json")
            if af["axes"]!=bf["axes"] or af["eye_bones"]!=bf["eye_bones"]:
                raise AssertionError("actual head orientation or rig eye projections changed")
            for side in "LR":
                if bm["anchors"]["facecage_rig_eye_anchors"][side]!=am["anchors"][f"eye_{side}"] or bm["anchors"][f"eye_{side}"][3]!=am["anchors"][f"eye_{side}"][3]:
                    raise AssertionError("kinematic eye/facing originals not preserved by placement interface")
            raw_a,raw_b=guarded_raw_images(a,b,am,bm)
            ia,ib = raw_a['id.png'],raw_b['id.png']
            if ia.shape!=ib.shape or ia.shape[:2]!=(am["canvas"][1]*am["ss"],am["canvas"][0]*am["ss"]):
                raise AssertionError("raw dimensions do not match actual metadata")
            head = ((ia[...,3]>0)&(ia[...,1]==am["parts"]["head"]))|((ib[...,3]>0)&(ib[...,1]==am["parts"]["head"]))
            if not head.any():
                raise AssertionError("categorical actual head mask absent")
            raw_guard = dilate(head,4)
            raw_outside = {}
            for filename in PASSES:
                old,new = raw_a[filename],raw_b[filename]
                count = int((np.any(old!=new,axis=2)&~raw_guard).sum())
                raw_outside[filename] = count
                if count:
                    failures.append(f"{shot}/{px}/{filename} changed {count} nonhead subpixels")
            for raw in (a,b):
                if (raw/"R2").exists():
                    raise ValueError("fresh exact R2 finish required")
                D.process(str(raw),D.load_finish(str(PIPE/"drive9/r2_finish.json")),"D1","R2",True)
            images = [rgba(raw/"R2/still.png") for raw in (a,b)]
            finished_replay={name:PNG.exact(a/'R2'/name,reference/shot/f'px{px}/R2'/name)
                             for name in ('still.png','still_ground.png')}
            native_head = head.reshape(am["canvas"][1],am["ss"],am["canvas"][0],am["ss"]).any(axis=(1,3))
            guard = dilate(native_head,2)
            changed = np.any(images[0]!=images[1],axis=2)
            outside = int((changed&~guard).sum())
            if outside:
                failures.append(f"{shot}/{px}: {outside} finish pixels outside declared head guard; retain/reject coupling, no compositing waiver")
            row = {"shot":shot,"px":px,"R2ControlChangedPixels":0,"samePoseRigMatrixMaxError":err,
                'controlSevenRawDecodedRGBA8Replay':control_replay,'depth2Provenance':binding['depth2Provenance'],
                'controlStillGroundDecodedRGBA8Replay':finished_replay,
                'metadataFrozenSemanticGuard':metadata_guard,'sourceInputBindingExact':True,'allSevenRawShapeGuardsExact':True,
                "rawOutsideHeadChangedSubpixels":raw_outside,"changedPixels":int(changed.sum()),
                "alphaChangedPixels":int((images[0][...,3]!=images[1][...,3]).sum()),
                "finishedOutsideHeadChangedPixels":outside,"geometry":br["geometry"],
                "originalRigEyeBones":bf["eye_bones"],"cageEyePlacement":bf["cage_eye_placement"],
                "faceFinishReports":{mode:read(raw/"R2/post.json").get("face") for mode,raw in (("control",a),("facecage1",b))}}
            rows.append(row)
            ys,xs = np.nonzero(guard)
            box = (int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1)
            for scale,view in ((1,"whole"),(3,"whole"),(8,"face")):
                panels = [Image.fromarray(im).crop(box) if view=="face" else Image.fromarray(im) for im in images]
                w,h = panels[0].size
                sheet = Image.new("RGB",(2*(w*scale+20),h*scale+28),"#212126")
                draw = ImageDraw.Draw(sheet)
                for i,(label,im) in enumerate(zip(("R2 control","FC1 geometry + same finish"),panels)):
                    x = i*(w*scale+20)+10
                    draw.text((x,5),label,fill="#d9d0bb")
                    large = im.resize((w*scale,h*scale),Image.Resampling.NEAREST)
                    sheet.paste(large,(x,23),large)
                sheet.save(root/f"facecage-{shot}-{px}-{view}-x{scale}.png")
            for raw in (a,b):
                for filename in (*PASSES,"meta.json","facepass.json","facecage_trial.json"):
                    path = raw/filename
                    hashes[str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
    proof = {"kind":"actual matched native FC1 support geometry plus exact R2 finish","rows":rows,"inputHashes":hashes,'binding':binding,
        "preservationFailures":failures,"nativePixelGuardsPassed":not failures,
        "promoted":False,"qualityAccepted":False,"motionQualified":False,"physicalClothQualified":False,
        "limits":"actual fringe/eye openness/stamp shifts/nose/chin/jaw/profile at144/80 and3freshfixed9critics must judge appeal; no source score/automatic9"}
    (root/"facecage-native-proof.json").write_text(json.dumps(proof,indent=2),encoding="utf-8")
    print(json.dumps({"proof":str(root/"facecage-native-proof.json"),"failures":failures,"qualityAccepted":False}))
    if failures:
        raise SystemExit("Native preservation/coupling guard failed; actual files retained, no candidate acceptance")


if __name__=="__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--reference",type=Path,required=True)
    args = parser.parse_args()
    run(args.root,args.reference)
