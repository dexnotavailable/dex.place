"""Delivery-only actual matched R2/FC1 native finish and preservation proof."""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image,ImageDraw

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
PIPE = REPO/"tools/pixel-pipeline"
sys.path.insert(0,str(PIPE/"drive9"))
import d9_post as D

PASSES = ("id.png","normal.png","depth.png","light.png","beauty.png","noise.png")


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def rgba(path):
    return np.asarray(Image.open(path).convert("RGBA"))


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
            if ar["mode"]!="control" or ar["geometry"]["enabled"] or br["mode"]!="facecage1" or not br["geometry"]["enabled"] or not br["geometry"]["protectedDecodedNormalsExact"]:
                raise AssertionError("actual disabled control/enabled guarded cage required")
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
            ia,ib = rgba(a/"id.png"),rgba(b/"id.png")
            if ia.shape!=ib.shape or ia.shape[:2]!=(am["canvas"][1]*am["ss"],am["canvas"][0]*am["ss"]):
                raise AssertionError("raw dimensions do not match actual metadata")
            head = ((ia[...,3]>0)&(ia[...,1]==am["parts"]["head"]))|((ib[...,3]>0)&(ib[...,1]==am["parts"]["head"]))
            if not head.any():
                raise AssertionError("categorical actual head mask absent")
            raw_guard = dilate(head,4)
            raw_outside = {}
            for filename in PASSES:
                old,new = rgba(a/filename),rgba(b/filename)
                count = int((np.any(old!=new,axis=2)&~raw_guard).sum())
                raw_outside[filename] = count
                if count:
                    failures.append(f"{shot}/{px}/{filename} changed {count} nonhead subpixels")
            for raw in (a,b):
                if (raw/"R2").exists():
                    raise ValueError("fresh exact R2 finish required")
                D.process(str(raw),D.load_finish(str(PIPE/"drive9/r2_finish.json")),"D1","R2",True)
            images = [rgba(raw/"R2/still.png") for raw in (a,b)]
            if not np.array_equal(images[0],rgba(reference/shot/f"px{px}/R2/still.png")):
                raise AssertionError("disabled control does not reproduce frozen finished R2 at0px")
            native_head = head.reshape(am["canvas"][1],am["ss"],am["canvas"][0],am["ss"]).any(axis=(1,3))
            guard = dilate(native_head,2)
            changed = np.any(images[0]!=images[1],axis=2)
            outside = int((changed&~guard).sum())
            if outside:
                failures.append(f"{shot}/{px}: {outside} finish pixels outside declared head guard; retain/reject coupling, no compositing waiver")
            row = {"shot":shot,"px":px,"R2ControlChangedPixels":0,"samePoseRigMatrixMaxError":err,
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
    proof = {"kind":"actual matched native FC1 geometry plus exact R2 finish","rows":rows,"inputHashes":hashes,
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
