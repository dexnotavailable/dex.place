"""Finish genuine native frames; matched FX on simulation time; lossless timed preview.

No model/native execution. All output stays inside the executing private review
tree. Collision feedback uses a labelled finite AABB controller fixture, not a
claim of collision integration in the shipped world.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import motion_fx_contract as C
sys.path[:0]=[str(C.REPO/"tools/pixel-pipeline/next"),str(C.REPO/"art/rosace/specialists/effects")]
import reconstruction_finish as finish_source
import n1_n2_fx as FX
import raster_adapter as raster
D=finish_source.D


def native_h(meta,name):
    a=meta["anchors"][name]
    if len(a)<3 or not all(math.isfinite(x) for x in a[:3]):
        raise ValueError("actual finite projected native anchor required")
    return tuple((a[i]/meta["ss"]-meta["anchor"][i])/meta["px"] for i in (0,1))


def contact_fixture(clip,root):
    target=(root[0]+.70,root[1]-.75,.10,.20)
    hits=[]
    for box in FX.hit_boxes(clip,root):
        x,y,w,h=box
        tx,ty,tw,th=target
        a,b,c,d=max(x,tx),max(y,ty),min(x+w,tx+tw),min(y+h,ty+th)
        if c>a and d>b:
            hits.append((a,b,c-a,d-b))
    if not hits: raise ValueError("diagnostic target does not intersect current active hit geometry")
    x,y,w,h=hits[0]
    return {"target":"finite-controller-target-"+clip,"pointH":(x+w/2,y+h/2),
        "targetAabbH":target,"intersectionAabbH":hits[0],
        "evidence":"actual bounded AABB controller fixture intersected at nominal active tick; shipped gameplay untested"}


def scenes(packet,metas,contacts):
    rows=C.validate_ticks(packet)
    fx=FX.LiturgyFX()
    result=[]
    for row,meta in zip(rows,metas):
        f,clip,actor=row["frame"],row["clip"],row["tick"]
        root,tip=native_h(meta,"root"),native_h(meta,"glaive_tip")
        depth=meta["anchors"]["glaive_tip"][2]-meta["anchors"]["depth_plane"][2]
        if not math.isfinite(depth): raise ValueError("actual native tip depth required")
        layer="front" if depth<0 else "back"  # exact coplanar tie uses conservative back
        instance=packet["id"]+":"+clip
        cues=[] if row.get("settle") else FX.beat_cues(clip,actor)
        collision=None
        if not row.get("settle") and actor==FX.CLIPS[clip]["strike"]:
            fx.emit_strike(FX.Strike(instance,clip,f,root,tip_h=(tip[0]-root[0],tip[1]-root[1])))
        if contacts and f in (9,23):
            collision=contact_fixture(clip,root)
            cues+=fx.emit_contact(FX.Contact(instance,clip,f,collision["target"],collision["pointH"],actor,tip))
        active={"active_instance":instance,"active_root_h":root,"active_actor_frame":actor} if any(s.instance==instance for s in fx.strikes) else {}
        scene=fx.sample(f,live_tip_h=tip,live_tip_depth=layer,actor_root_h=root,**active)
        if clip=="m1_1" and actor in (5,6):
            fx._put(scene,[tip,(tip[0],tip[1]+1/96)],"A5","blade-glint-live-tip",kind="line",priority=1)
            scene["budget"]["commands"]+=1
            scene["budget"]["points"]+=2
        scene.update(simulationFrame=f,actorClip=clip,actorTick=actor,rootH=root,tipH=tip,
            tipCameraDepthMinusChest=depth,tipDepthLayer=layer,contact=collision,cues=cues,
            activeHitBoxesH=FX.hit_boxes(clip,root) if not row.get("settle") and FX.CLIPS[clip]["active"][0]<=actor<=FX.CLIPS[clip]["active"][1] else [],
            nativeIdentity=meta["nativeIdentity"],clock="simulation ticks; whole-frame freeze in playback expansion",
            evidence="native body/cloth/tip/depth; finite diagnostic target controller",lightsApplied=False,cameraCuesApplied=False)
        result.append(scene)
    return result


def finish_frame(raw,finish,output):
    meta=C.read(raw/"meta.json")
    captured=[]
    old=D.F1.downsample
    def downsample(*args,**kwargs):
        values=old(*args,**kwargs)
        captured.append(values)  # retain the exact label arrays through cleanup
        return values
    D.F1.downsample=downsample
    try: D.process(str(raw),finish,"D1","MOTION",True)
    finally: D.F1.downsample=old
    if len(captured)!=1: raise ValueError("one actual final-grid downsample required")
    alpha,mat,part= captured[0][:3]
    sprite=Image.open(raw/"MOTION/still.png").convert("RGBA")
    if sprite.size!=tuple(meta["canvas"]): raise ValueError("native sprite canvas changed")
    ids=np.asarray(Image.open(raw/"id.png").convert("RGBA"))
    depth=np.asarray(Image.open(raw/"depth2.png").convert("RGB"))
    k=meta["ss"]
    h,w=alpha.shape
    if ids.shape[:2]!=(h*k,w*k) or depth.shape[:2]!=(h*k,w*k):
        raise ValueError("native categorical/depth pass dimensions differ")
    opaque=ids[...,3]>0
    head=meta["parts"]["head"]
    skin=meta["materials"]["skin"]["id"]
    hair_ids=[v["id"] for n,v in meta["materials"].items() if n in ("hair","hairtip")]
    # materials.py writes limb/255 into depth2.B, so 8-bit B is the exact ID.
    limb=depth[...,2].astype(int)
    protected_parts=[v for n,v in meta["parts"].items() if n in ("head","tabard","sleeves") or n.startswith("glaive")]
    protected=opaque & (((ids[...,1]==head)&(ids[...,0]==skin))|
        np.isin(ids[...,0],hair_ids)|np.isin(ids[...,1],protected_parts)|np.isin(limb,[8,9,14,15,20,21,22]))
    block=protected.reshape(h,k,w,k).any((1,3))
    feature=Image.fromarray(block.astype("uint8")*255).filter(ImageFilter.MaxFilter(5))
    # Current actual mesh opening, including intentional empty pixels between rim.
    ImageDraw.Draw(feature).polygon([(x/k,y/k) for x,y,z in meta["windowBoundarySS"]],fill=255)
    body=sprite.getchannel("A")
    raster.validate_mask_bytes(body.tobytes(),body.tobytes(),feature.tobytes())
    box=body.getbbox()
    if not box or box[0]==0 or box[1]==0 or box[2]>=w or box[3]>=h:
        raise ValueError("native body/outline clipping in fixed camera")
    output.mkdir(parents=True)
    sprite.save(output/"noFX.png")
    body.save(output/"body-mask.png")
    feature.save(output/"feature-mask.png")
    Image.fromarray(np.asarray(mat,dtype=np.uint8)).save(output/"material-id.png")
    Image.fromarray(np.asarray(part,dtype=np.uint8)).save(output/"part-id.png")
    C.write(output/"native-identity.json",dict(meta["nativeIdentity"],
        rawSha256={n:C.sha(raw/n) for n in ("id.png","normal.png","depth2.png","meta.json","facepass.json")},
        spriteSha256=C.sha(output/"noFX.png"),finishSha256=hashlib.sha256(json.dumps(finish,sort_keys=True).encode()).hexdigest(),
        maskMethod="actual post labels; conservative SS material/part/limb coverage+dilate2+actual opening polygon",
        featureLimits="conservative protected pixels; anatomical readability still requires actual moving review"))
    return sprite,body,feature,meta


def encode_preview(paths,clock,output):
    frames=[Image.open(paths[r["simulationFrame"]]).convert("RGBA") for r in clock["ticks"]]
    durations=[round((i+1)*1000/60)-round(i*1000/60) for i in range(len(frames))]
    frames[0].save(output,format="PNG",save_all=True,append_images=frames[1:],duration=durations,
        loop=0,disposal=0,blend=0,optimize=False)
    expected=[]
    for im,duration in zip(frames,durations):
        digest=hashlib.sha256(im.tobytes()).hexdigest()
        if expected and expected[-1][0]==digest: expected[-1][1]+=duration
        else: expected.append([digest,duration])
    actual=[]
    with Image.open(output) as replay:
        for i in range(replay.n_frames):
            replay.seek(i)
            digest=hashlib.sha256(replay.convert("RGBA").tobytes()).hexdigest()
            duration=replay.info["duration"]
            if actual and actual[-1][0]==digest: actual[-1][1]+=duration
            else: actual.append([digest,duration])
    if len(actual)!=len(expected) or any(a[0]!=b[0] or abs(a[1]-b[1])>.01 for a,b in zip(actual,expected)):
        raise ValueError("lossless preview pixel/timing readback differs")
    return {"path":str(output),"sha256":C.sha(output),"durationTicks":len(frames),
        "durationMs":sum(durations),"decodedPixelsAndDelays":"exact schedule match",
        "schedule":"60Hz cumulative ms rounding; <=0.5ms cumulative quantization, no resampling"}


def run(batch_path,output):
    batch=C.read(batch_path)
    if batch.get("contract")!="rosace.n1-n2-native-batch/1": raise ValueError("genuine completed native batch required")
    output=Path(output).resolve()
    if output.exists() or not (C.REPO/"review/rosace").resolve() in output.parents:
        raise ValueError("fresh private post output required")
    binding=C.read(batch["binding"])
    C.validate_binding(binding)
    packet=C.read(batch["packet"])
    C.validate_ticks(packet)
    driver=C.read(batch["driver"])
    bake=C.read(batch["bake"])
    if not driver["numericGatesPassed"] or len(driver["postKeyEvaluation"]["frames"])!=78 or bake["first"]!=0 or bake["last"]!=77:
        raise ValueError("native action/continuous physical trajectory proof missing")
    records=[r for r in batch["frames"] if r["cloth"]]
    if sorted((r["frame"],r["px"]) for r in records)!=[(f,px) for f in range(78) for px in (80,144)]:
        raise ValueError("complete matched78 native epochs atbothsizes required")
    for record in batch["frames"]:
        if any(C.sha(Path(record["raw"])/n)!=h for n,h in record["rawSha256"].items()):
            raise ValueError("raw native pass artifact changed")
    for frame in bake["frames"]:
        if C.sha(frame["geometry"])!=frame["sha256"]: raise ValueError("native Cloth geometry changed")
    output.mkdir(parents=True)
    finish=finish_source.finish_recipe(output)
    previews=[]
    for px in (80,144):
        maps={};metas=[];native=[]
        selected=sorted((r for r in records if r["px"]==px and r["frame"]>0),key=lambda r:r["frame"])
        for r in selected:
            f=r["frame"]
            dest=output/f"px{px}/f{f:03d}"
            sprite,body,feature,meta=finish_frame(Path(r["raw"]),finish,dest)
            if meta["nativeIdentity"]!=r["identity"] or r["identity"]["bodyBindingSha256"]!=C.sha(batch["binding"]) or r["identity"]["driverSha256"]!=C.sha(batch["driver"]):
                raise ValueError("frame/mask/tip/body/action identity differs")
            geometry=next(v for v in bake["frames"] if v["frame"]==f)
            if r["identity"]["clothGeometrySha256"]!=geometry["sha256"]:
                raise ValueError("mask/frame geometry epoch differs")
            native.append((sprite,body,feature,dest))
            metas.append(meta)
            maps[f]=dest/"noFX.png"
        for variant,contact in (("FX-whiff",False),("FX-contact",True)):
            scene_rows=scenes(packet,metas,contact)
            candidates={}
            for scene,(sprite,body,feature,dest),meta in zip(scene_rows,native,metas):
                images,report=raster.composite(scene,sprite,body,feature,height_px=px,foot_px=meta["anchor"])
                if report["clipped_tags"] or report["opaque_feature_changed_pixels"]:
                    raise ValueError("FX clipping or protected pixels changed")
                path=dest/(variant+".png")
                images["candidate"].save(path)
                candidates[scene["simulationFrame"]]=path
                C.write(dest/(variant+".json"),{"scene":scene,"raster":report,
                    "actualNativeComposite":True,"bodyControlSha256":C.sha(dest/"noFX.png"),"candidateSha256":C.sha(path),
                    "runtimePolicy":"whole-simulation hitstop; no alternative world clock implemented"})
            clock=C.playback(packet,contact)
            for r in clock["ticks"]:
                r["sprite"]=str(candidates[r["simulationFrame"]].relative_to(output)).replace("\\","/")
                r["matchedNoFX"]=str(maps[r["simulationFrame"]].relative_to(output)).replace("\\","/")
            C.write(output/f"px{px}-{variant}-clock.json",clock)
            previews.append(encode_preview(candidates,clock,output/f"px{px}-{variant}.png"))
            previews.append(encode_preview(maps,clock,output/f"px{px}-noFX-{'contact' if contact else 'whiff'}.png"))
        # Finish same-pose cloth-off keys for actual physical A/B inspection.
        for r in batch["frames"]:
            if not r["cloth"] and r["px"]==px:
                finish_frame(Path(r["raw"]),finish,output/f"cloth-off/px{px}/f{r['frame']:03d}")
    C.write(output/"preview-proof.json",{"contract":"rosace.n1-n2-preview/1","nativeBatchSha256":C.sha(batch_path),
        "bodyId":binding["bodyId"],"bodyBindingSha256":C.sha(batch["binding"]),"previews":previews,
        "claims":{"nativeRendered":True,"physicalTrajectoryBaked":True,"FXComposited":True,"playbackReadback":True,
            "lightsApplied":False,"audioPlayed":False,"cameraCuesApplied":False,"runtimeExported":False,
            "clothVisuallyQualified":False,"motionVisuallyQualified":False,"appearance9":False},
        "contacts":"finite native-root AABB diagnostic fixture, not shipped world collision proof",
        "criticOwner":"rosace-critics; three fresh actual moving panels after pixels become available"})
    print(json.dumps({"output":str(output),"previews":len(previews),"bodyId":binding["bodyId"]}))


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--batch",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args()
    run(a.batch,a.out)
