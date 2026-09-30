"""Delivery-only paired native finish/guard/visibility receipt; no promotion.

All source pixels come from the two exact native modes. Same R2 finish both.
Frozen closed-parent image passes are read-only zero-pixel replay controls.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
PIPE = REPO/"tools/pixel-pipeline"
sys.path.insert(0,str(PIPE/"drive9"))
sys.path.insert(0,str(PIPE/"finish_f1"))
import d9_post as D
import f1_post as F1

PASSES = ("beauty.png","id.png","normal.png","depth.png","depth2.png","light.png","noise.png")


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def rgba(path):
    return np.asarray(Image.open(path).convert("RGBA"))


def visible_hand(raw):
    meta = read(raw/"meta.json")
    ids,limbs = rgba(raw/"id.png"),rgba(raw/"depth2.png")[...,2]
    if limbs.shape != ids.shape[:2] or meta["ss"] != 4:
        raise AssertionError("actual categorical pass shape/ss mismatch")
    zeros = np.zeros(ids.shape,float)
    alpha,mat,part = F1.downsample(meta,ids,zeros,np.zeros((*ids.shape[:2],3)),np.zeros(ids.shape[:2]),0.0)[:3]
    labels = np.zeros(mat.shape,dtype=np.uint8)
    ss = meta["ss"]
    for y,x in zip(*np.nonzero(alpha)):
        block = ids[y*ss:(y+1)*ss,x*ss:(x+1)*ss]
        match = (block[...,3]>0)&(block[...,0]==mat[y,x])&(block[...,1]==part[y,x])
        values,counts = np.unique(limbs[y*ss:(y+1)*ss,x*ss:(x+1)*ss][match],return_counts=True)
        if len(values):
            selected = int(values[np.argmax(counts)])
            if selected not in range(26):
                raise AssertionError("invalid categorical limb")
            labels[y,x] = selected
    if not np.any(np.isin(labels,(14,15))):
        raise AssertionError("hand limb attributes absent; cannot infer skin from RGB")
    mask = alpha&(mat==meta["materials"]["skin"]["id"])&(labels==14)
    ys,xs = np.nonzero(mask)
    box = [int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1] if len(xs) else None
    size = [box[2]-box[0],box[3]-box[1]] if box else [0,0]
    return {"leftHandRawSkinPixels":int(mask.sum()),"bbox":box,"bboxSize":size,
        "visibilityFloorPassed":bool(mask.sum()>=20 and size[0]>=4 and size[1]>=5),
        "method":"native chosen material+part categorical limb mode; no RGB skin inference",
        "limits":"counts/box alone do not prove wrist seam, thumb opposition, shaft interruption, clipping or anatomy"}


def matrix_error(a,b):
    if set(a)!=set(b):
        raise AssertionError("actual bone sets differ")
    errors = []
    for name in a:
        if len(a[name])!=4 or len(b[name])!=4:
            raise AssertionError("actual4x4 bone matrices required")
        for x,y in zip(a[name],b[name]):
            if len(x)!=4 or len(y)!=4 or not all(math.isfinite(v) for v in x+y):
                raise AssertionError("invalid actual bone matrix")
            errors.extend(abs(v-w) for v,w in zip(x,y))
    return max(errors,default=0)


def run(root,frozen):
    root,frozen = root.resolve(),frozen.resolve()
    if not (REPO/"review/rosace/specialists/refinement").resolve() in root.parents or root==frozen or root in frozen.parents or frozen in root.parents:
        raise ValueError("separate fresh private trial root and frozen parent required")
    if (root/"cuff-native-proof.json").exists():
        raise ValueError("never overwrite native proof")
    rows,hashes = [],{}
    for px in (144,80):
        a,b = [root/mode/"idle"/f"px{px}" for mode in ("parent","cuff1")]
        old = frozen/"idle"/f"px{px}"
        ar,br = read(a/"cuff_trial.json"),read(b/"cuff_trial.json")
        am,bm,om = read(a/"meta.json"),read(b/"meta.json"),read(old/"meta.json")
        frozen_record = read(old/"reconstruction.json")
        if frozen_record["mode"]!="construction-control" or frozen_record["handScale"]!=1.3:
            raise AssertionError("frozen bcb closed-gesture parent provenance required")
        if ar["mode"]!="parent" or ar["geometry"]["enabled"] or br["mode"]!="cuff1" or not br["geometry"]["enabled"] or not br["geometry"]["originalUnchanged"]:
            raise AssertionError("actual disabled parent/enabled C1 proof required")
        for field in ("constructionPoseFields","windowMode","finish"):
            if ar[field]!=br[field]:
                raise AssertionError("pair includes another construction lever")
        err = matrix_error(ar["evaluatedBoneMatrices"],br["evaluatedBoneMatrices"])
        old_err = matrix_error(ar["evaluatedBoneMatrices"],frozen_record["evaluatedBoneMatrices"])
        if max(err,old_err)>1e-6:
            raise AssertionError("actual rig differs from paired/frozen parent")
        for field in ("canvas","anchor","ss","px","cam","ppm"):
            if am[field]!=bm[field] or am[field]!=om[field]:
                raise AssertionError("paired/frozen framing differs; no top-align/resampling fallback")
        for filename in PASSES:
            if not np.array_equal(rgba(a/filename),rgba(old/filename)):
                raise AssertionError(f"disabled parent raw replay differs: px{px}/{filename}")
        ag,bg = read(a/"haft_grips.json"),read(b/"haft_grips.json")
        if ag["hand_trial"]!=bg["hand_trial"] or ag["grips"]!=bg["grips"]:
            raise AssertionError("actual grip solve/scale/socket/slide changed")
        gap = float(bg["grips"]["L"]["gap_cm"])
        if not math.isfinite(gap) or not 0<=gap<=1.5:
            raise AssertionError("synthetic contact invalid/exceeds1.5cm")
        for raw in (a,b):
            if (raw/"R2").exists():
                raise ValueError("fresh finish required")
            D.process(str(raw),D.load_finish(str(PIPE/"drive9/r2_finish.json")),"D1","R2",True)
        images = [Image.open(raw/"R2/still_ground.png").convert("RGBA") for raw in (a,b)]
        native = [rgba(raw/"R2/still.png") for raw in (a,b)]
        row = {"px":px,"frozenParentRawReplayChangedPixels":0,"samePoseMatrixMaxError":err,
            "frozenParentMatrixMaxError":old_err,"syntheticGripGapCm":gap,
            "changedPixels":int(np.any(native[0]!=native[1],axis=2).sum()),
            "alphaChangedPixels":int((native[0][...,3]!=native[1][...,3]).sum()),
            "parentVisibility":visible_hand(a),"candidateVisibility":visible_hand(b),"geometry":br["geometry"]}
        rows.append(row)
        for raw in (a,b,old):
            for filename in (*PASSES,"meta.json","haft_grips.json"):
                path = raw/filename
                hashes[str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
        for scale in (1,3):
            w,h = images[0].size
            sheet = Image.new("RGB",(2*(w*scale+20),h*scale+28),"#212126")
            draw = ImageDraw.Draw(sheet)
            for i,(label,im) in enumerate(zip(("samepose cuff parent","C1 upper-mouth clearance"),images)):
                x = i*(w*scale+20)+10
                draw.text((x,5),label,fill="#d9d0bb")
                large = im.resize((w*scale,h*scale),Image.Resampling.NEAREST)
                sheet.paste(large,(x,23),large)
            sheet.save(root/f"cuff-native-{px}-x{scale}.png")
    proof = {"kind":"genuine paired native geometry, unchanged R2 finish", "rows":rows,"inputHashes":hashes,
        "promoted":False,"motionQualified":False,"physicalClothQualified":False,
        "limits":"first idle pair; inspect raw/native144/80 wrist/palm/thumb/cuff/haft pixels, clipping and3freshfixed9 critics before further views/moving cloth"}
    (root/"cuff-native-proof.json").write_text(json.dumps(proof,indent=2),encoding="utf-8")
    print(json.dumps({"proof":str(root/"cuff-native-proof.json"),"visibilityFloors":[r["candidateVisibility"]["visibilityFloorPassed"] for r in rows]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--frozen-parent",type=Path,required=True)
    args = parser.parse_args()
    run(args.root,args.frozen_parent)
