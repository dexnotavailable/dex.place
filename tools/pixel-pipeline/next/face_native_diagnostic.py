"""Read-only diagnostic of the preserved native head versus finished face.

Uses genuine R2 render/ID/normal/light/facepass inputs only. No art candidate,
generated-image input, repainting, native execution, or canonical write.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

REPO=Path(__file__).resolve().parents[3]


def run(source,output):
    source,output=source.resolve(),output.resolve()
    if output.exists() or source == output or source in output.parents or output in source.parents:
        raise ValueError("fresh output separate from preserved source required")
    if not (REPO/"review/rosace").resolve() in output.parents:
        raise ValueError("diagnostic belongs to private executing worktree")
    output.mkdir(parents=True)
    report={"kind":"read-only native R2 head diagnostic; not an art candidate",
        "generatedPixelsUsed":False,"nativeExecutionPerformed":False,"rows":[],
        "sourceLimits":"camera-space encoded normals/light statistics do not identify a geometry winner or establish9"}
    for px in (144,80):
        raw=source/"idle"/f"px{px}"
        meta=json.loads((raw/"meta.json").read_text())
        fp=json.loads((raw/"facepass.json").read_text())
        post=json.loads((raw/"R2/post.json").read_text())
        ids=np.asarray(Image.open(raw/"id.png").convert("RGBA"))
        normals=np.asarray(Image.open(raw/"normal.png").convert("RGB"),float)/255*2-1
        light=np.asarray(Image.open(raw/"light.png").convert("RGB"),float)/255
        ss=meta["ss"]
        eyes={side:np.asarray(points,float).mean(axis=0) for side,points in fp["refs"]["ref_eyes"].items()}
        order=sorted(eyes,key=lambda s:eyes[s][0])
        delta=eyes[order[1]]-eyes[order[0]]
        eyeline=float(delta[1]/delta[0])
        skin=(ids[...,3]>0)&(ids[...,0]==meta["materials"]["skin"]["id"])&(ids[...,1]==meta["parts"]["head"])
        eye_y=float(np.mean([p[1] for p in eyes.values()]))
        chin_y=float(fp["chin"][1])
        yy,xx=np.indices(skin.shape)
        y_sprite=(yy+.5)/ss
        x_sprite=(xx+.5)/ss
        central=skin&(x_sprite>=min(e[0] for e in eyes.values())-4*px/144)&(x_sprite<=max(e[0] for e in eyes.values())+4*px/144)
        bands={"browToEyes":central&(y_sprite>=eye_y-4*px/144)&(y_sprite<eye_y+1*px/144),
               "cheeks":central&(y_sprite>=eye_y+1*px/144)&(y_sprite<eye_y+(chin_y-eye_y)*.65),
               "jaw":central&(y_sprite>=eye_y+(chin_y-eye_y)*.65)&(y_sprite<=chin_y+1)}
        stats={}
        for name,mask in bands.items():
            if not mask.any():
                stats[name]=None
                continue
            n=normals[mask]
            norms=np.linalg.norm(n,axis=1)
            unit=n/np.maximum(norms[:,None],1e-9)
            mean=unit.mean(axis=0)
            mean/=max(np.linalg.norm(mean),1e-9)
            spread=np.degrees(np.arccos(np.clip(unit@mean,-1,1)))
            stats[name]={"nativeSkinSubpixels":int(mask.sum()),"cameraNormalMean":mean.tolist(),
                "angularSpreadDegreesP50P90":np.percentile(spread,[50,90]).tolist(),
                "rawLightR_P10P50P90":np.percentile(light[...,0][mask],[10,50,90]).tolist(),
                "rawAO_G_P10P50P90":np.percentile(light[...,1][mask],[10,50,90]).tolist()}
        x0=max(0,int(min(e[0] for e in eyes.values())-7*px/144))
        x1=min(ids.shape[1]//ss,int(max(e[0] for e in eyes.values())+7*px/144)+1)
        y0=max(0,int(min(e[1] for e in eyes.values())-10*px/144))
        y1=min(ids.shape[0]//ss,int(max(e[1] for e in eyes.values())+14*px/144)+1)
        box=[x0,y0,x1,y1]
        native_box=[i*ss for i in box]
        finished=Image.open(raw/"R2/still_ground.png").convert("RGB").crop(box).resize(((x1-x0)*8,(y1-y0)*8),Image.Resampling.NEAREST)
        panels=[("R2 finished x8",finished)]
        for filename,label in (("beauty.png","native beauty SS4 x2"),("normal.png","native normals SS4 x2"),("light.png","native light R/AO G SS4 x2")):
            img=Image.open(raw/filename).convert("RGB").crop(native_box)
            panels.append((label,img.resize(finished.size,Image.Resampling.NEAREST)))
        mask_img=Image.fromarray(skin.astype(np.uint8)*255).convert("RGB").crop(native_box).resize(finished.size,Image.Resampling.NEAREST)
        panels.append(("native head-skin ID mask",mask_img))
        w,h=finished.size
        sheet=Image.new("RGB",(len(panels)*(w+20),h+32),"#212126")
        draw=ImageDraw.Draw(sheet)
        for index,(label,img) in enumerate(panels):
            x=index*(w+20)+10
            draw.text((x,5),label,fill="#d9d0bb")
            sheet.paste(img,(x,25))
        sheet.save(output/f"native-face-diagnostic-{px}.png")
        files=("id.png","normal.png","light.png","beauty.png","facepass.json","meta.json","R2/still.png","R2/post.json")
        report["rows"].append({"px":px,"box":box,"eyeCentroids":{s:p.tolist() for s,p in eyes.items()},
            "sharedProjectedEyelineSlope":eyeline,"eyeReferenceWidths":{s:float(np.ptp(np.asarray(p)[:,0])) for s,p in fp["refs"]["ref_eyes_white"].items()},
            "nativeHeadAxes":fp["axes"],"nose":fp["nose"],"chin":fp["chin"],
            "finishedFaceReport":post.get("face"),"bands":stats,
            "inputHashes":{name:hashlib.sha256((raw/name).read_bytes()).hexdigest() for name in files}})
    (output/"diagnostic.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"output":str(output),"candidate":False,"rows":[{"px":r["px"],"eyeSlope":r["sharedProjectedEyelineSlope"],"bands":r["bands"]} for r in report["rows"]]}))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    run(args.root,args.out)
