"""Finite source/native identity and whole-simulation playback clock. No renderer."""
import argparse
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
BODY_FILES = [
    "tools/pixel-pipeline/drive9/r2_model.json", "tools/pixel-pipeline/drive9/r2_blender.py",
    "tools/pixel-pipeline/drive9/r5_blender.py", "tools/pixel-pipeline/finish_f2/head_scale.py",
    "tools/pixel-pipeline/next/nx_window_mesh_blender.py", "tools/pixel-pipeline/next/window_mesh_recipe.py",
    "tools/pixel-pipeline/next/mesh_preservation.py", "tools/pixel-pipeline/next/hand_recipe.py",
    "tools/pixel-pipeline/next/reconstruction_recipe.py", "tools/pixel-pipeline/next/reconstruction_finish.py",
    "tools/pixel-pipeline/drive9/r2_finish.json", "tools/pixel-pipeline/drive9/r2_faces.json",
]
BLEND_SHA = "aef28c7f5cdddee6f18bd12c06d988b5436eeac24049ddf4f6ca37f654394373"
BODY_ID = "rosace-reconstruction1-W2-seated1.30-head1.10"


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False), encoding="utf-8")


def validate_construction(proof):
    if proof.get("kind") != "genuine native integrated reconstruction":
        raise ValueError("actual integrated construction proof required, not raw/prototype/source")
    rows = proof.get("rows", [])
    if len(rows) != 2 or {r["px"] for r in rows} != {80,144}:
        raise ValueError("actual completed construction at80/144 required")
    for row in rows:
        if row["R2ControlChangedPixels"] != 0 or row["samePoseRigMatrixMaxError"] > 1e-6:
            raise ValueError("construction replay/rig guard failed")
        if row["actualOpenWindowSkinSubpixels"] <= row["samePoseClosedWindowSkinSubpixels"]:
            raise ValueError("real native opening skin gain required")
        geometry = row["geometry"]
        if not geometry["retainedFacePreservation"]["exactSemanticEqual"]:
            raise ValueError("complete typed native preservation proof required")
        for contact in row["contactGuards"].values():
            gap = contact["syntheticLeftGripGapCm"]
            if not math.isfinite(gap) or not 0 <= gap <= 1.5:
                raise ValueError("construction grip diagnostic failed")
    return rows


def freeze_body(proof_path, output):
    proof_path, output = Path(proof_path).resolve(), Path(output).resolve()
    if output.exists() or not (REPO/"review/rosace").resolve() in output.parents:
        raise ValueError("freeze only a fresh private binding after actual construction result")
    rows = validate_construction(read(proof_path))
    native_root = next((p.parent for p in proof_path.parents if p.name=="review"), None)
    if native_root is None or any(sha(native_root/p)!=sha(REPO/p) for p in BODY_FILES):
        raise ValueError("executed native body preparation bytes must match this request")
    evidence = {"proof": {"path": str(proof_path), "sha256": sha(proof_path)}}
    # Bind final pixels and the full raw native evidence, not just a Boolean receipt.
    for px in (80,144):
        raw = proof_path.parent/f"reconstruction-raw/idle/px{px}"
        record, meta = read(raw/"reconstruction.json"), read(raw/"meta.json")
        if record["mode"]!="reconstruction" or record["handScale"]!=1.3 or record["sourceRecipeSha256"]!=sha(REPO/"tools/pixel-pipeline/next/reconstruction_recipe.py"):
            raise ValueError("actual native construction recipe/hand mode differs")
        if meta["ss"]!=4 or meta["px"]!=px or meta["d9"]["head"]!={"head":1.1,"neck_w":.4,"neck_l":1.0,"fit_h":True}:
            raise ValueError("actual native body head/grid differs")
        for name in ("R2/still.png", "meta.json", "reconstruction.json", "window_geometry.json", "id.png", "normal.png"):
            p = raw/name
            evidence[f"px{px}/{name}"] = {"path": str(p), "sha256": sha(p)}
    binding = {"contract":"rosace.motion-body/1", "state":"native-construction-guarded-opt-in",
        "bodyId":BODY_ID, "geometryMode":"reconstruction", "handScale":1.3,
        "head":{"head":1.1,"neck_w":.4,"neck_l":1.0,"fit_h":True},
        "canonicalBlendSha256":BLEND_SHA,
        "preparationSha256":{p:sha(REPO/p) for p in BODY_FILES}, "nativeEvidence":evidence,
        "sizes":[80,144], "nativeRows":[{"px":r["px"], "rigMax":r["samePoseRigMatrixMaxError"]} for r in rows],
        "posePolicy":"authored motion recipes replace idle gesture; same rest construction/head/hands/window",
        "clothQualified":False, "motionQualified":False, "appearance9":False,
        "limits":"construction guards only; full native motion/cloth/grip and pixels still pending"}
    output.parent.mkdir(parents=True, exist_ok=True)
    write(output,binding)
    return binding


def validate_binding(binding):
    if binding.get("contract") != "rosace.motion-body/1" or binding.get("state") != "native-construction-guarded-opt-in":
        raise ValueError("freeze actual construction result before native motion")
    if binding.get("bodyId") != BODY_ID or binding.get("geometryMode") != "reconstruction" or binding.get("handScale") != 1.3:
        raise ValueError("this request pins W2/seated1.30; another current body requires a reviewed request")
    if binding.get("head") != {"head":1.1,"neck_w":.4,"neck_l":1.0,"fit_h":True} or binding.get("canonicalBlendSha256") != BLEND_SHA:
        raise ValueError("body head/rest source mismatch")
    expected = binding.get("preparationSha256", {})
    if set(expected) != set(BODY_FILES) or any(sha(REPO/p) != h for p,h in expected.items()):
        raise ValueError("body preparation bytes differ from completed native result")
    evidence = binding.get("nativeEvidence", {})
    if "proof" not in evidence or len(evidence) != 13:
        raise ValueError("complete construction pixel/raw evidence binding required")
    if any(sha(v["path"]) != v["sha256"] for v in evidence.values()):
        raise ValueError("completed body native artifacts changed")
    validate_construction(read(evidence["proof"]["path"]))


def validate_ticks(packet):
    rows = packet.get("ticks", [])
    if packet.get("contract") != "rosace.motion-ticks/1" or packet.get("fps") != 60 or packet.get("route") != "earliest-chain":
        raise ValueError("exact60Hz earliest N1->N2 motion packet required")
    if [r["frame"] for r in rows] != list(range(1,78)):
        raise ValueError("finite15+38+24 simulation frames required")
    if [(r["clip"],r["tick"]) for r in rows[:53]] != [("m1_1",i) for i in range(1,16)]+[("m1_2",i) for i in range(1,39)]:
        raise ValueError("actor route differs")
    if not all(r.get("settle") and r["clip"]=="m1_2" and r["tick"]==38 for r in rows[53:]):
        raise ValueError("24 final pose settle ticks required")
    if rows[14]["rootForwardH"] != rows[15]["rootForwardH"]:
        raise ValueError("native root seam snap")
    return rows


def playback(packet, contacts=False):
    rows = validate_ticks(packet)
    result = []
    for row in rows:
        f = row["frame"]
        event = contacts and f in (9,23)
        result.append({"wallTick":len(result)+1,"simulationFrame":f,"fxTick":f,
            "clip":row["clip"],"actorTick":row["tick"],"frozen":False,"emitContact":bool(event)})
        if event:
            for _ in range(3):
                result.append(dict(result[-1],wallTick=len(result)+1,frozen=True,emitContact=False))
    return {"contract":"rosace.whole-simulation-playback/1","fps":60,
        "policy":"whole-simulation hitstop; repeat complete body/cloth/FX frame",
        "ticks":result,"durationTicks":len(result),"contactSimulationFrames":[9,23] if contacts else [],
        "clockAdapterImplemented":"finite diagnostic replay only; world runtime unchanged"}


if __name__ == "__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--freeze-body-proof",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args()
    freeze_body(a.freeze_body_proof,a.out)
    print(json.dumps({"bodyBinding":str(a.out),"bodyId":BODY_ID,"appearance9":False}))
