"""Authored face/material cluster reconstruction on our native passes only.

The guide supplies general construction ideas; this module accepts no guide
raster. R2 palette ramps, outline and physical geometry remain authoritative.
"""
import argparse
import copy
import hashlib
import json
import shutil
import sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw

PIPE=Path(__file__).resolve().parents[1]
REPO=PIPE.parents[1]
sys.path.insert(0,str(PIPE/"drive9"))
sys.path.insert(0,str(Path(__file__).resolve().parent))
import d9_post as D
import face_trial as F

CLUSTERS={"skin":{"tones":7,"tex":0.0},"white":{"tones":7,"tex":.01,"strand":.01},
    "veil":{"tones":5,"tex":.01,"strand":.01},"hair":{"tones":6,"tex":0.0,"strand":.025},
    "hairtip":{"tones":4,"tex":0.0,"strand":.02},"gold":{"tones":6,"tex":0.0},
    "indigo":{"tones":5,"tex":.005,"strand":.01}}


def finish_recipe(output):
    base=json.loads((PIPE/"drive9/r2_faces.json").read_text())
    face=F.candidates(base)["F1"] # preferred experimental open-eye seed, not Face2
    face["paint"]["fringe_shadow_t"]=.38
    face["paint"]["fringe_shadow2_k"]=.22
    face["paint"]["far_cheek_t"]=.32
    path=output/"reconstruction-faces.json"
    path.write_text(json.dumps(face,indent=2),encoding="utf-8")
    finish=D.load_finish(str(PIPE/"drive9/r2_finish.json"))
    for material,fields in CLUSTERS.items():
        finish["materials"][material].update(copy.deepcopy(fields))
    finish["materials"]["skin"]["face"]["lift"]=.24
    finish["r2_faces"]=str(path)
    return finish


def run(source,output):
    source,output=source.resolve(),output.resolve()
    if output.exists() or source==output or source in output.parents or output in source.parents:
        raise ValueError("fresh separate output required")
    if not (REPO/"review/rosace").resolve() in output.parents:
        raise ValueError("private executing worktree output required")
    output.mkdir(parents=True)
    candidate_finish=finish_recipe(output)
    proof={"kind":"authored reconstruction finish prototype on unchanged genuine R2 geometry",
        "generatedPixelsUsed":False,"freshNativeRender":False,"windowMeshClosed":True,
        "geometryPoseHandChangesApplied":False,"rows":[],"clusterChanges":CLUSTERS,
        "limits":"finish prototype only; full guide reconstruction needs separate native pose/hand/actualwindow letter"}
    for px in (144,80):
        src=source/"idle"/f"px{px}"
        outputs=[]
        for name in ("control","reconstruction"):
            raw=output/name/"idle"/f"px{px}"
            raw.mkdir(parents=True)
            for filename in F.RAW:
                if (src/filename).exists():
                    shutil.copyfile(src/filename,raw/filename)
            finish=D.load_finish(str(PIPE/"drive9/r2_finish.json")) if name=="control" else candidate_finish
            D.process(str(raw),finish,"D1","R2",True)
            outputs.append(raw)
        baseline=np.asarray(Image.open(src/"R2/still.png").convert("RGBA"))
        control=np.asarray(Image.open(outputs[0]/"R2/still.png").convert("RGBA"))
        candidate=np.asarray(Image.open(outputs[1]/"R2/still.png").convert("RGBA"))
        if not np.array_equal(control,baseline):
            raise AssertionError("R2 reconstruction control must reproduce exactly")
        if not np.array_equal(candidate[...,3],control[...,3]):
            raise AssertionError("finish-only prototype changed geometry/silhouette")
        unique=lambda im:int(len(np.unique(im[im[...,3]>0,:3],axis=0)))
        proof["rows"].append({"px":px,"controlChangedPixels":0,
            "candidateChangedPixels":int(np.any(control!=candidate,axis=2).sum()),"alphaChangedPixels":0,
            "controlUniqueRGB":unique(control),"candidateUniqueRGB":unique(candidate),
            "rawHashes":{n:hashlib.sha256((src/n).read_bytes()).hexdigest() for n in F.RAW if (src/n).exists()}})
        panels=[Image.open(p/"R2/still_ground.png").convert("RGBA") for p in outputs]
        for scale in (1,3):
            w,h=panels[0].size
            sheet=Image.new("RGB",(2*(w*scale+20),h*scale+30),"#212126")
            draw=ImageDraw.Draw(sheet)
            for i,(label,img) in enumerate(zip(("R2 control","authored finish prototype"),panels)):
                x=i*(w*scale+20)+10
                draw.text((x,5),label,fill="#d9d0bb")
                large=img.resize((w*scale,h*scale),Image.Resampling.NEAREST)
                sheet.paste(large,(x,23),large)
            sheet.save(output/f"reconstruction-finish-{px}-x{scale}.png")
    (output/"proof.json").write_text(json.dumps(proof,indent=2),encoding="utf-8")
    print(json.dumps({"output":str(output),"rows":[{k:v for k,v in r.items() if k!="rawHashes"} for r in proof["rows"]]}))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    run(args.root,args.out)
