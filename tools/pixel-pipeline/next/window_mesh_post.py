"""Finish genuine native window renders unchanged; measure categorical skin.

No aperture painting or replacement pixels. The requested opening must show
the preserved body in the native ID pass, bounded by actual gold geometry.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

PIPE=Path(__file__).resolve().parents[1]
REPO=PIPE.parents[1]
sys.path.insert(0,str(PIPE/"drive9"))
import d9_post as D


def polygon(size, points, scale=1):
    im=Image.new("L",size)
    ImageDraw.Draw(im).polygon([(p[0]*scale,p[1]*scale) for p in points],fill=255)
    return np.asarray(im)>0


def run(root,reference):
    root,reference=root.resolve(),reference.resolve()
    if not (REPO/"review/rosace").resolve() in root.parents or root == reference or reference in root.parents:
        raise ValueError("native output must belong to executing private review, separate from preserved reference")
    finish=D.load_finish(str(PIPE/"drive9/r2_finish.json"))
    rows=[]
    for px in (144,80):
        controls=[]
        for mode in ("control","candidate"):
            raw=root/f"{mode}-raw/idle/px{px}"
            if (raw/"R2").exists():
                raise ValueError("fresh native raw output required; never overwrite a prior finish")
            D.process(str(raw),finish,"D1","R2",True)
            controls.append(np.asarray(Image.open(raw/"R2/still.png").convert("RGBA")))
        control,candidate=controls
        preserved=np.asarray(Image.open(reference/f"idle/px{px}/R2/still.png").convert("RGBA"))
        if not np.array_equal(control,preserved):
            raise AssertionError("disabled geometry hook must reproduce R2 control exactly")
        raw=root/f"candidate-raw/idle/px{px}"
        geometry=json.loads((raw/"window_geometry.json").read_text())
        meta=json.loads((raw/"meta.json").read_text())
        ids=np.asarray(Image.open(raw/"id.png").convert("RGBA"))
        control_ids=np.asarray(Image.open(root/f"control-raw/idle/px{px}/id.png").convert("RGBA"))
        if ids.shape != control_ids.shape:
            raise AssertionError("native framing changed")
        aperture=polygon((ids.shape[1],ids.shape[0]),geometry["boundaryProjectedPx"],meta["ss"])
        gold_band=polygon((ids.shape[1],ids.shape[0]),geometry["rimOuterProjectedPx"],meta["ss"]) & ~aperture
        skin=lambda data:(data[...,3]>0)&(data[...,0]==meta["materials"]["skin"]["id"])&(data[...,1]==meta["parts"]["body"])
        visible=int((aperture & skin(ids)).sum())
        previous=int((aperture & skin(control_ids)).sum())
        if visible <= previous or visible == 0:
            raise AssertionError("geometry opening has not revealed separately visible native body skin")
        gold=(ids[...,3]>0)&(ids[...,0]==meta["materials"]["gold"]["id"])&(ids[...,1]==meta["parts"]["bodice"])
        change=np.any(candidate!=control,axis=2)
        bounds=np.array(geometry["rimOuterProjectedPx"])
        x0,y0=np.floor(bounds[:,:2].min(axis=0)-2).astype(int)
        x1,y1=np.ceil(bounds[:,:2].max(axis=0)+2).astype(int)
        region=np.zeros(change.shape,bool)
        region[max(0,y0):min(len(region),y1+1),max(0,x0):min(region.shape[1],x1+1)]=True
        rows.append({"px":px,"controlChangedPixels":0,"changedPixels":int(change.sum()),
            "outsideWindowBoxChangedPixels":int((change&~region).sum()),
            "alphaChangedPixels":int((control[...,3]!=candidate[...,3]).sum()),
            "nativeBodySkinSubpixels":visible,"controlBodySkinSubpixels":previous,
            "nativeGoldBandSubpixels":int((gold_band&gold).sum()),"apertureSubpixels":int(aperture.sum()),
            "geometry":geometry,"limits":"skin ID proves real visibility; rim continuity/cloth termination/appeal need actual pixels and3freshcritics"})
        baseline=Image.open(root/f"control-raw/idle/px{px}/R2/still_ground.png").convert("RGBA")
        experiment=Image.open(raw/"R2/still_ground.png").convert("RGBA")
        for scale in (1,3):
            w,h=baseline.size
            sheet=Image.new("RGB",(2*(w*scale+20),h*scale+30),"#212126")
            draw=ImageDraw.Draw(sheet)
            for i,(name,img) in enumerate((("R2",baseline),("mesh window",experiment))):
                x=i*(w*scale+20)+10
                draw.text((x,5),name,fill="#d9d0bb")
                large=img.resize((w*scale,h*scale),Image.Resampling.NEAREST)
                sheet.paste(large,(x,23),large)
            sheet.save(root/f"window-mesh-{px}-x{scale}.png")
    proof={"kind":"genuine native opening; untouched R2 finish", "rows":rows,
        "canonicalReplacement":False, "motionQualification":None}
    (root/"window-pixel-proof.json").write_text(json.dumps(proof,indent=2),encoding="utf-8")
    print(json.dumps({"proof":str(root/"window-pixel-proof.json"),"rows":[{k:v for k,v in r.items() if k!="geometry"} for r in rows]}))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--reference",type=Path,required=True)
    args=parser.parse_args()
    run(args.root,args.reference)
