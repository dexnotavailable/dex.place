"""Native integrated reconstruction, with a matched closed-window control.

R2 is the overall A/B control. The same new gesture/hands with a closed bodice
is a structural control for real skin gain. No generated image is read.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw

sys.path.insert(0,str(Path(__file__).resolve().parent))
import reconstruction_finish as F
import window_mesh_post as W


def align(images,metas):
    """Integer translation only: common world-origin anchor, no resampling."""
    for meta in metas[1:]:
        if abs(meta["ppm"]-metas[0]["ppm"])>1e-6:
            raise AssertionError("overall comparison has unequal pixel scale")
        for key in ("right","up","fwd"):
            if not np.allclose(meta["cam"][key],metas[0]["cam"][key],rtol=0,atol=1e-6):
                raise AssertionError("overall comparison camera basis differs")
    for im,meta in zip(images,metas):
        if list(im.shape[1::-1])!=meta["canvas"] or any(int(v)!=v for v in meta["anchor"]):
            raise AssertionError("image canvas/integer world-origin anchor mismatch")
    left=min(-m["anchor"][0] for m in metas)
    top=min(-m["anchor"][1] for m in metas)
    right=max(im.shape[1]-m["anchor"][0] for im,m in zip(images,metas))
    bottom=max(im.shape[0]-m["anchor"][1] for im,m in zip(images,metas))
    anchor=[-left,-top]
    result=[]
    shifts=[]
    for im,meta in zip(images,metas):
        dx,dy=[int(a-b) for a,b in zip(anchor,meta["anchor"])]
        canvas=np.zeros((bottom-top,right-left,4),dtype=np.uint8)
        canvas[dy:dy+im.shape[0],dx:dx+im.shape[1]]=im
        result.append(canvas)
        shifts.append([dx,dy])
    return result,{"kind":"integer world-origin translation only","anchor":anchor,
                   "canvas":[right-left,bottom-top],"shifts":shifts,"ppm":metas[0]["ppm"]}


def run(root,reference):
    root,reference=root.resolve(),reference.resolve()
    if not (F.REPO/"review/rosace").resolve() in root.parents or root==reference or reference in root.parents or root in reference.parents:
        raise ValueError("private native output separate from preserved reference required")
    if (root/"reconstruction-faces.json").exists():
        raise ValueError("fresh native finishing output required")
    finish=F.finish_recipe(root)
    rows=[]
    for px in (144,80):
        outputs={}
        metas={}
        contacts={}
        for mode in ("control","construction-control","reconstruction"):
            raw=root/f"{mode}-raw/idle/px{px}"
            if (raw/"R2").exists():
                raise ValueError("never overwrite a prior finish")
            recipe=F.D.load_finish(str(F.PIPE/"drive9/r2_finish.json")) if mode=="control" else finish
            F.D.process(str(raw),recipe,"D1","R2",True)
            outputs[mode]=np.asarray(Image.open(raw/"R2/still.png").convert("RGBA"))
            metas[mode]=json.loads((raw/"meta.json").read_text())
            record=json.loads((raw/"reconstruction.json").read_text())
            gap=float(record["contact"]["L"]["gap_cm"])
            if not math.isfinite(gap) or not 0<=gap<=1.5:
                raise AssertionError(f"synthetic seated grip exceeds1.5cm or is invalid: {mode}")
            contacts[mode]={"syntheticLeftGripGapCm":gap,
                "limits":"bone-point contact guard only; thumb/finger wrap needs raw hand metrics and actualpixels"}
        baseline=np.asarray(Image.open(reference/f"idle/px{px}/R2/still.png").convert("RGBA"))
        if not np.array_equal(outputs["control"],baseline):
            raise AssertionError("disabled integrated driver must reproduce R2 exactly")
        closed=root/f"construction-control-raw/idle/px{px}"
        opened=root/f"reconstruction-raw/idle/px{px}"
        a=json.loads((closed/"reconstruction.json").read_text())
        b=json.loads((opened/"reconstruction.json").read_text())
        if a["effectivePose"]!=b["effectivePose"]:
            raise AssertionError("opening control needs the same effective new pose/hands")
        matrix_error=max(abs(float(x)-float(y)) for name,mat in a["evaluatedBoneMatrices"].items()
            for row_a,row_b in zip(mat,b["evaluatedBoneMatrices"][name]) for x,y in zip(row_a,row_b))
        if matrix_error>1e-6:
            raise AssertionError("actual rig matrices differ between closed/open construction control")
        for field in ("canvas","anchor","ss","px"):
            if metas["construction-control"][field]!=metas["reconstruction"][field]:
                raise AssertionError("closed/open window framing differs")
        if metas["construction-control"]["cam"]!=metas["reconstruction"]["cam"]:
            raise AssertionError("closed/open actual camera differs")
        geometry=json.loads((opened/"window_geometry.json").read_text())
        ids=np.asarray(Image.open(opened/"id.png").convert("RGBA"))
        closed_ids=np.asarray(Image.open(closed/"id.png").convert("RGBA"))
        meta=metas["reconstruction"]
        aperture=W.polygon((ids.shape[1],ids.shape[0]),geometry["boundaryProjectedPx"],meta["ss"])
        skin=lambda im:(im[...,3]>0)&(im[...,0]==meta["materials"]["skin"]["id"])&(im[...,1]==meta["parts"]["body"])
        visible=int((skin(ids)&aperture).sum())
        previous=int((skin(closed_ids)&aperture).sum())
        if visible<=previous:
            raise AssertionError("reconstruction has not revealed real body skin through cloth")
        aligned,alignment=align(list(outputs.values()),list(metas.values()))
        row={"px":px,"R2ControlChangedPixels":0,
            "integratedChangedPixels":int(np.any(aligned[0]!=aligned[2],axis=2).sum()),
            "integratedAlphaChangedPixels":int((aligned[0][...,3]!=aligned[2][...,3]).sum()),"comparisonAlignment":alignment,
            "contactGuards":contacts,
            "samePoseClosedWindowSkinSubpixels":previous,"actualOpenWindowSkinSubpixels":visible,
            "samePoseRigMatrixMaxError":matrix_error,"geometry":geometry,"effectivePose":b["effectivePose"],
            "limits":"integrated letter, no per-lever quality attribution; actual144/80 parts/3freshcritics mandatory; cloth/motion pending"}
        rows.append(row)
        for mode,image in zip(outputs,aligned):
            Image.fromarray(image).save(root/f"{mode}-aligned-{px}.png")
        images=[Image.fromarray(im) for im in aligned]
        for scale in (1,3):
            heights=[im.height*scale for im in images]
            widths=[im.width*scale+20 for im in images]
            sheet=Image.new("RGB",(sum(widths),max(heights)+30),"#212126")
            draw=ImageDraw.Draw(sheet)
            x=10
            for label,im,width in zip(("R2","samepose closedwindow","authored reconstruction"),images,widths):
                draw.text((x,5),label,fill="#d9d0bb")
                large=im.resize((im.width*scale,im.height*scale),Image.Resampling.NEAREST)
                sheet.paste(large,(x,23),large)
                x+=width
            sheet.save(root/f"reconstruction-native-{px}-x{scale}.png")
    (root/"reconstruction-native-proof.json").write_text(json.dumps({"kind":"genuine native integrated reconstruction","rows":rows,"canonicalReplacement":False,"motionQualified":False},indent=2))
    print(json.dumps({"proof":str(root/"reconstruction-native-proof.json"),"rows":[{k:v for k,v in r.items() if k not in ("geometry","effectivePose")} for r in rows]}))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--reference",type=Path,required=True)
    args=parser.parse_args()
    run(args.root,args.reference)
