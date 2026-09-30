"""Completed frozen Stage3 noFX files -> review-only authored frame input.

No native/finish/cloth execution and no release/World admission. The owning
delivery records all expected hashes externally, including the entire post tree.
"""
import argparse
import hashlib
import importlib.util
import io
import json
import math
import stat
import subprocess
import sys
from pathlib import Path
# Import owning guards without adding bytecode files to consumed source roots.
sys.dont_write_bytecode = True
from PIL import Image

BASE = "51220b87de0bf74b830fb58523a411a025330fde"
RECEIPT = "b87e65c107eab81b3b429e8599e804e4f575ed0ba57b49f8909361622da37228"
BODY = "acda010d715e91d7f736aa40fdae729547a4212f7c5e47202de134fd0914f97f"
TICKS = "d493b00f613ded9df54dce2fc6966a7dab97730edeb6077145e1984dd7868e5d"
SOURCE = "2b7fdde09abd29e2de13a39154655f702f0f8d9aadcb16628e8856e05dddfc91"
CLIP = "review_n1_n2_cloth_chain_slice"
ANCHORS = {"tip": "glaive_tip", "butt": "glaive_butt", "handN": "hand_R", "handF": "hand_L", "head": "head"}
NATIVE_KEYS = ("simulationFrame", "bodyBindingSha256", "driverSha256", "solverEpoch", "clothGeometrySha256", "bodyId", "sceneSha256")


def require(ok, message):
    if not ok:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def captured(path, expected=None):
    data = Path(path).read_bytes()
    if expected is not None:
        require(isinstance(expected, str) and len(expected) == 64 and all(c in "0123456789abcdef" for c in expected), "external SHA256 required")
        require(sha(data) == expected, f"external artifact hash mismatch: {path}")
    return data


def read(path, expected=None):
    return json.loads(captured(path, expected).decode("utf-8-sig"))


def root(path):
    p = Path(path)
    require(p.is_absolute(), "explicit absolute roots required")
    p = p.resolve()
    require(p.drive.lower() == "d:", "active work must be D-backed")
    return p


def inside(base, path):
    p = Path(path).resolve()
    require(p.is_relative_to(base) and p != base, "input leaves its explicit root")
    return p


def file(base, relative):
    name = Path(relative)
    require(not name.is_absolute() and ".." not in name.parts, "source-relative filename required")
    p = inside(base, base / name)
    require(p.is_file(), f"required input absent: {p}")
    return p


def tree_digest(base):
    """External delivery pin for ALL finished bytes, not a new manifest format."""
    base = Path(base)
    reparse = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400)
    def bounded(path):
        status = path.lstat()
        require(not path.is_symlink() and not path.is_junction()
                and not (getattr(status, "st_file_attributes", 0) & reparse),
                "post tree symlink/junction/reparse links are not bound files")
        resolved = path.resolve(strict=True)
        require(resolved.is_relative_to(boundary), "resolved post tree path escapes root")
        return status, resolved
    # Reject a linked tree itself, then inspect each child before descending or
    # reading file bytes. rglob may traverse Windows junctions while listing.
    base_status = base.lstat()
    require(not base.is_symlink() and not base.is_junction()
            and not (getattr(base_status, "st_file_attributes", 0) & reparse),
            "post root symlink/junction/reparse link forbidden")
    boundary = base.resolve(strict=True)
    require(stat.S_ISDIR(base_status.st_mode), "post tree root must be a directory")
    rows = []
    def walk(directory):
        for p in sorted(directory.iterdir()):
            status, resolved = bounded(p)
            if stat.S_ISDIR(status.st_mode):
                walk(resolved)
            elif stat.S_ISREG(status.st_mode):
                rows.append([p.relative_to(boundary).as_posix(), sha(captured(resolved))])
            else:
                raise ValueError("post tree entry is not a regular file/directory")
    walk(boundary)
    require(rows, "completed post tree required")
    return sha(json.dumps(rows, separators=(",", ":"), ensure_ascii=False).encode())


def vector(values, count, label):
    require(isinstance(values, list) and len(values) >= count and all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in values[:count]), f"finite {label} required")
    return values[:count]


def mapping(meta, row, previous_h, forward):
    ss, px = meta.get("ss"), meta.get("px")
    require(isinstance(ss, int) and not isinstance(ss, bool) and ss >= 1 and px in (80, 144), "actual source pixel grid required")
    height, ppm = meta.get("height_m"), meta.get("ppm")
    require(all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v > 0 for v in (height, ppm)), "actual height/ppm required")
    require(abs(height * ppm - px) <= 1e-4, "H/ppm scale differs")
    right = vector(meta["cam"]["right"], 3, "camera right")
    up = vector(meta["cam"]["up"], 3, "camera up")
    require(abs(sum(v*v for v in right)-1) <= 1e-5 and abs(sum(v*v for v in up)-1) <= 1e-5 and abs(sum(a*b for a,b in zip(right,up))) <= 1e-5, "orthonormal actual camera basis required")
    forward = vector(forward, 3, "rootForward")
    h = row.get("rootForwardH")
    require(isinstance(h, (int, float)) and not isinstance(h, bool) and math.isfinite(h) and math.isfinite(previous_h), "finite cumulative packet root required")
    delta = [(h-previous_h)*height*v for v in forward]
    motion = [ppm*sum(a*b for a,b in zip(delta,right)), -ppm*sum(a*b for a,b in zip(delta,up))]
    native = vector(meta["anchors"]["root"], 3, "projected actor origin")
    pivot = [native[0]/ss, native[1]/ss]
    anchors = {}
    for target, name in ANCHORS.items():
        point = vector(meta["anchors"][name], 3, f"anchor {name}")
        anchors[target] = [point[i]/ss-pivot[i] for i in (0,1)]
    return {"pivot": pivot, "rootMotion": motion, "anchors": anchors}


def validate_projected_increment(current, previous, projected, height):
    residual = [current[i]-previous[i]-projected[i] for i in (0,1)]
    # Float32 native world->camera projection, documented in native pixels.
    require(max(abs(v) for v in residual) <= .01, "observed native root increments differ from frozen projected packet")
    return [v/height for v in residual]


def guards(source_root, receipt_path, receipt_sha):
    require(receipt_sha == RECEIPT, "receiver supports only reviewed frozenV2 source receipt")
    receipt = read(receipt_path, receipt_sha)
    require(receipt.get("baseHead") == BASE and receipt.get("sourceKind") == "uncommitted exact-hash overlay over51220b8", "overlay/base identity differs")
    entries = receipt.get("source", [])
    require(len(entries) == 10 and len({v["path"] for v in entries}) == 10, "complete ten-file source overlay required")
    for entry in entries:
        captured(file(source_root, entry["path"]), entry["sha256"])
    # Source snapshot identity is the complete owning fingerprint, not a claim
    # that the bare base commit includes the reviewed overlay.
    module_dir = file(source_root, "art/rosace/integration/motion_fx_contract.py").parent
    sys.path.insert(0, str(module_dir))
    for name in ("motion_source_binding", "motion_fx_contract"):
        spec = importlib.util.spec_from_file_location(name, module_dir/(name+".py"))
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
    return sys.modules["motion_fx_contract"]


def completed_preview(proof, batch, binding, batch_sha, body_sha):
    require(proof.get("contract") == "rosace.n1-n2-preview/1", "completed Stage3 post proof required; preflight/clock is not post")
    require(proof.get("nativeBatchSha256") == batch_sha and proof.get("bodyBindingSha256") == body_sha and proof.get("bodyId") == binding["bodyId"], "post batch/body binding differs")
    require(proof.get("motionInputs") == batch["motionInputs"] and proof.get("artifactSha256") == batch["artifactSha256"] and proof.get("bodyFixtureStatus") == binding["bodyFixtureStatus"], "post provenance differs")
    require(proof.get("previewCount") == 18 and proof.get("nativeFrameCounts") == {"clothOff": 156, "clothOn": 156}, "complete post inventory required")
    claims = proof.get("claims", {})
    require(all(claims.get(k) is True for k in ("nativeRendered", "physicalTrajectoryBaked", "FXComposited", "playbackReadback")) and claims.get("runtimeExported") is False, "post was not completed or is a different runtime route")


def validate_clock(C, clock, packet, px, route):
    expected = C.playback(packet,route)
    cleaned = dict(clock,ticks=[{k:v for k,v in r.items() if k not in ("sprite","matchedNoFX","matchedClothOff")} for r in clock["ticks"]])
    require(cleaned == expected, "post diagnostic contact/control clocks differ")
    for tick in clock["ticks"]:
        f=tick["simulationFrame"]
        require(tick["sprite"]==f"px{px}/f{f:03d}/FX-{route}.png" and tick["matchedNoFX"]==f"px{px}/f{f:03d}/noFX.png" and tick["matchedClothOff"]==f"cloth-off/px{px}/f{f:03d}/noFX.png", "post clock frame/control correspondence differs")


def finished_identity(identity, record, finish_sha):
    require({k:identity.get(k) for k in NATIVE_KEYS}==record["identity"], "finished native frame/body/geometry/driver epoch differs")
    require(identity.get("rawSha256")=={k:record["rawSha256"][k] for k in ("id.png","normal.png","depth2.png","meta.json","facepass.json")}, "finished raw-input identity differs")
    require(identity.get("finishSha256")==finish_sha, "external actual finish identity differs")
    require("normal" not in identity and "normalSpace" not in identity, "finished normals unsupported by this receiver")


def validate_raw_children(C, records, native_root):
    """Bound every owning raw child before Stage3 verifies its file hash."""
    checked = []
    for record in records:
        directory = inside(native_root, record["raw"])
        require(directory.is_dir(), "native raw directory must exist")
        for name in sorted(C.S.RAW_FILES):
            child = inside(native_root, directory / name)
            require(child.is_file(), f"ordinary native raw child required: {name}")
            checked.append(child)
    return checked


def receive(args):
    source_root, native_root, post_root = (root(getattr(args, k)) for k in ("source_root", "native_root", "post_root"))
    output = root(args.out)
    require(not output.exists(), "fresh normalized input required")
    for base in (source_root, native_root, post_root):
        require(not output.is_relative_to(base) and not base.is_relative_to(output), "output overlaps consumed inputs")
    require(not any(v.lower() == "public" for v in output.parts), "review input cannot enter public tree")
    batch_path = inside(native_root, args.batch)
    batch = read(batch_path, args.batch_sha256)
    require(batch.get("contract") == "rosace.n1-n2-native-batch/1", "complete native batch required; preflight is never admissible")
    require(args.body_binding_sha256 == BODY and args.ticks_sha256 == TICKS and args.source_fingerprint_sha256 == SOURCE, "wrong frozen body/packet/source binding")
    require(batch.get("runtimeExported") is False, "diagnostic unexported batch required")
    for key in ("packet", "driver", "bake", "setup"):
        inside(native_root, batch[key])
    for item in read(batch["bake"],batch["artifactSha256"]["bake"]).get("frames",[]):
        inside(native_root,item["geometry"])
    require(Path(batch["binding"]).resolve() == Path(args.body_binding).resolve(), "batch binding path differs from external input")
    for record in batch.get("frames", []):
        inside(native_root, record["raw"])
    C = guards(source_root, args.source_receipt, args.source_receipt_sha256)
    binding = C.validate_frozen_binding(args.body_binding, args.body_binding_sha256)
    require(binding["motionTicks"]["sha256"] == args.ticks_sha256 and binding["sourceFingerprint"]["sha256"] == args.source_fingerprint_sha256, "frozen packet/source provenance differs")
    validate_raw_children(C, batch.get("frames", []), native_root)
    packet, driver, bake = C.S.validate_chain(batch, binding, args.body_binding_sha256)
    rows = C.validate_ticks(packet)
    require(tree_digest(post_root) == args.post_tree_sha256, "externally pinned completed post tree differs")
    proof = read(file(post_root, "preview-proof.json"), args.post_proof_sha256)
    completed_preview(proof, batch, binding, args.batch_sha256, args.body_binding_sha256)
    previews = proof.get("previews", [])
    require(len(previews) == 18, "complete18 preview receipts required")
    keys = {(p["px"],p["contactRoute"],p["treatment"]) for p in previews}
    require(keys == {(px,r,t) for px in (80,144) for r in C.CONTACT_ROUTES for t in ("FX","noFX","cloth-off-noFX")}, "post preview routes/treatments differ")
    for p in previews:
        name = f"px{p['px']}-{p['treatment']}-{p['contactRoute']}.png"
        require(Path(p["path"]).resolve() == file(post_root,name), "preview path/root differs")
        captured(file(post_root,name),p["sha256"])
    for px in (80,144):
        for route in C.CONTACT_ROUTES:
            clock = read(file(post_root,f"px{px}-FX-{route}-clock.json"))
            validate_clock(C,clock,packet,px,route)
    sequence = read(file(source_root,C.S.SEQUENCE))
    variants, provenance_rows, projected = [], [], {}
    for px in (80,144):
        records = sorted((r for r in batch["frames"] if r["px"]==px and r["cloth"]),key=lambda r:r["frame"])
        frames=[]; prior=None; prior_h=0
        for record in records:
            f=record["frame"]; raw=Path(record["raw"])
            meta=read(raw/"meta.json",record["rawSha256"]["meta.json"])
            require(meta["ss"]==4 and meta["canvas"]==[6*px,4*px] and meta["anchor"]==[3*px,7*px//2] and meta["yaw"]==60 and meta["elev"]==8, "actual fixed Stage3 camera/grid differs")
            for cloth in (True,False):
                prefix="" if cloth else "cloth-off/"
                name=f"{prefix}px{px}/f{f:03d}"
                identity=read(file(post_root,name+"/native-identity.json"))
                native_record=next(r for r in batch["frames"] if (r["frame"],r["px"],r["cloth"])==(f,px,cloth))
                finished_identity(identity,native_record,args.finish_sha256)
                image_data=captured(file(post_root,name+"/noFX.png"),identity["spriteSha256"])
                with Image.open(io.BytesIO(image_data)) as image:
                    require(image.format=="PNG" and image.mode=="RGBA" and image.size==tuple(meta["canvas"]) and getattr(image,"n_frames",1)==1, "finished native PNG/grid/channel contract differs")
                require(not (post_root/name/"normal.png").exists() and "normal" not in identity, "finished normals unsupported by this receiver")
                for mask in ("body-mask.png","feature-mask.png","material-id.png","part-id.png"):
                    with Image.open(io.BytesIO(captured(file(post_root,name+"/"+mask)))) as image:
                        require(image.size==tuple(meta["canvas"]), "finished control/mask grid differs")
            current=[v/meta["ss"] for v in vector(meta["anchors"]["root"],3,"root")[:2]]
            if f:
                row=rows[f-1]
                mapped=mapping(meta,row,prior_h,sequence["rootForward"])
                residual=validate_projected_increment(current,prior,mapped["rootMotion"],px)
                name=f"px{px}/f{f:03d}/noFX.png"
                key=f"{BODY}:{TICKS}:simulation{f}:{row['clip']}:{row['tick']}:{row['recipe']}"
                frames.append({"image":name,"imageSha256":sha(captured(file(post_root,name))),"pose":key,"duration":1,**mapped})
                projected[(f,px)]=mapped["rootMotion"]
                provenance_rows.append({"frame":f,"height":px,"rawMetaSha256":record["rawSha256"]["meta.json"],"nativeIdentity":record["identity"],"rootIncrementResidualH":residual})
                prior_h=row["rootForwardH"]
            prior=current
        require(len(frames)==77,"complete77 diagnostic simulation frames required")
        variants.append({"height":px,"shading":"baked","clips":[{"id":CLIP,"loop":False,"tags":["review-only","diagnostic-chain-slice","noFX","projected-camera-root"],"frames":frames,"qualification":{"status":"unqualified","sourceHead":"reviewed-overlay-not-commit","evidence":[]}}]})
    for f in range(1,78):
        require(max(abs(projected[(f,80)][i]/80-projected[(f,144)][i]/144) for i in (0,1))<=1e-6,"paired H-space projected roots differ")
    value={"contract":"dex.authored-frames/1","fps":60,"space":"in-place","origin":"authored-native",
        "character":{"id":"rosace","name":"Rosace provisional Stage3 noFX diagnostic chain slice; unqualified"},"requiredClips":["m1_5"],"variants":variants,
        "provenance":{"receiverSha256":sha(captured(__file__)),"baseHead":BASE,"sourceReceiptSha256":RECEIPT,
            "batchSha256":args.batch_sha256,"postProofSha256":args.post_proof_sha256,"postTreeSha256":args.post_tree_sha256,"finishSha256":args.finish_sha256,
            "bodyBindingSha256":BODY,"ticksSha256":TICKS,"sourceFingerprintSha256":SOURCE,"nativeRows":provenance_rows,
            "pivotPolicy":"actual projected actor Root.xy/ss; remove baked travel through pivot without modifying PNG pixels",
            "rootPolicy":"review source-camera projection applied once; NONZEROY QUARANTINED from release/World gravity axis decision",
            "normalPolicy":"omitted; raw SS normals do not describe final-grid ink/sprite", "releaseEligible":False,
            "limits":"mechanical appearance-rejected fixture; partial chain, no release/World/appearance/cloth/fullkit acceptance; no diagnostic hitstop/FX baked into actor frames"}}
    # Only create output after owning guards, native/post inventory and all frame
    # checks pass. Exporter subsequently checks each exact PNG digest again.
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open("x",encoding="utf-8") as stream:
        stream.write(json.dumps(value,indent=2,allow_nan=False)+"\n")
    return {"input":str(output),"inputSha256":sha(captured(output)),"framesPerSize":77,"qualification":"unqualified","releaseEligible":False}


def parser():
    p=argparse.ArgumentParser(description=__doc__,allow_abbrev=False)
    for name in ("source-root","native-root","post-root","out","batch","body-binding","source-receipt"):
        p.add_argument("--"+name,required=True,type=Path)
    for name in ("batch-sha256","body-binding-sha256","ticks-sha256","source-fingerprint-sha256","source-receipt-sha256","post-proof-sha256","post-tree-sha256","finish-sha256"):
        p.add_argument("--"+name,required=True)
    return p


if __name__=="__main__":
    try:
        print(json.dumps(receive(parser().parse_args())))
    except (ValueError,KeyError,OSError) as error:
        print(str(error),file=sys.stderr)
        sys.exit(1)
