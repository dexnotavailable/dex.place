"""Delivery-only Cuff2 proof; reuse exact R2 processing/categorical primitives.

No C1 proof is relabeled. The input schema, mode and geometry must be Cuff2.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from _reuse import REPO, load

C1 = load("cuff_native_post")
PIPE = REPO / "tools/pixel-pipeline"
PARENT = "bcb220de03c0b84e8fa68851328cd1d799a11de5"
HERE = Path(__file__).resolve().parent
read, rgba = C1.read, C1.rgba


def guard_frozen(frozen):
    binding = read(HERE/"frozen-parent.json")
    if binding["schema"] != "rosace.cuff2.frozen-parent/1" or binding["parentSource"] != PARENT or frozen != Path(binding["root"]).resolve():
        raise AssertionError("exact frozen bcb parent binding required")
    expected = {f"idle/px{px}/{filename}" for px in (144,80)
                for filename in (*C1.PASSES,"meta.json","haft_grips.json","reconstruction.json")}
    if set(binding["sha256"]) != expected:
        raise AssertionError("frozen parent binding omits required passes/provenance")
    for name, digest in binding["sha256"].items():
        if hashlib.sha256((frozen/name).read_bytes()).hexdigest() != digest:
            raise AssertionError("frozen parent input changed: "+name)
    return binding


def guard_pair(ar, br, am, bm, om, frozen_record, ag, bg):
    for record, mode in ((ar, "parent"), (br, "cuff2")):
        if record["schema"] != "rosace.cuff2.native/1" or record["construction"] != "cuff2" or record["mode"] != mode or record["parentSource"] != PARENT:
            raise AssertionError("actual Cuff2 schema/modes/exact parent provenance required")
    if frozen_record["mode"] != "construction-control" or frozen_record["handScale"] != 1.3:
        raise AssertionError("frozen bcb closed gesture seated1.30 required")
    if ar["geometry"]["enabled"] or not br["geometry"]["enabled"] or not br["geometry"]["bothOriginalMeshesUnchanged"] or br["geometry"]["construction"] != "cuff2":
        raise AssertionError("actual disabled parent/enabled Cuff2 mesh preservation required")
    geometry = br["geometry"]
    scalars = ("requestedRetreatM", "maxRetreatM", "minAxialGapRatio", "minAxialGapM", "storedRadialMaxErrorM")
    if any(type(geometry[field]) not in (int,float) or not math.isfinite(geometry[field]) for field in scalars):
        raise AssertionError("finite actual Cuff2 geometry measurements required")
    if geometry["requestedRetreatM"] != 0.055 or geometry["protectedRows"] != [0] or geometry["refittedRows"] != [1,22] or geometry["minAxialGapRatio"] < 0.25 or geometry["trianglesChecked"] != 2640 or geometry["cornerJacobiansChecked"] != 2640:
        raise AssertionError("fixed55mm whole-upper-loft geometry receipt required")
    if abs(geometry["maxRetreatM"]-0.055) > 1e-12 or geometry["minAxialGapM"] <= 0 or not 0 <= geometry["storedRadialMaxErrorM"] <= 1e-7:
        raise AssertionError("fixed endpoint retreat/positive stored gaps/radial preservation required")
    for field in ("actualColumnSpansM", "retainedColumnFactors"):
        if len(geometry[field]) != 30 or any(type(v) not in (int,float) or not math.isfinite(v) for v in geometry[field]):
            raise AssertionError("finite 30-column actual span/factor receipt required")
    if min(geometry["actualColumnSpansM"]) <= 0 or min(geometry["retainedColumnFactors"]) < .25 or max(geometry["retainedColumnFactors"]) > 1:
        raise AssertionError("positive source spans and retained quarter-gap factors required")
    for field, expected in (("windowMode", "unchanged closed"), ("finish", "unchanged R2")):
        if ar[field] != expected or br[field] != expected:
            raise AssertionError("another window/finish lever entered the pair")
    if ar["constructionPoseFields"] != br["constructionPoseFields"]:
        raise AssertionError("paired gesture fields differ")
    err = C1.matrix_error(ar["evaluatedBoneMatrices"], br["evaluatedBoneMatrices"])
    old_err = C1.matrix_error(ar["evaluatedBoneMatrices"], frozen_record["evaluatedBoneMatrices"])
    if max(err, old_err) > 1e-6:
        raise AssertionError("actual paired/frozen rig matrices differ")
    for field in ("canvas", "anchor", "ss", "px", "cam", "ppm"):
        if am[field] != bm[field] or am[field] != om[field]:
            raise AssertionError("paired/frozen camera/ppm/anchor/canvas differ; no resampling fallback")
    if ag["hand_trial"] != bg["hand_trial"] or ag["grips"] != bg["grips"]:
        raise AssertionError("actual grip/scale/socket/slide differs")
    gap = float(bg["grips"]["L"]["gap_cm"])
    if not math.isfinite(gap) or not 0 <= gap <= 1.5:
        raise AssertionError("synthetic grip gap invalid/exceeds1.5cm")
    return err, old_err, gap


def run(root, frozen):
    root, frozen = root.resolve(), frozen.resolve()
    if (REPO / "review/rosace/integration/cuff2").resolve() not in root.parents or root == frozen or root in frozen.parents or frozen in root.parents:
        raise ValueError("separate fresh executing-worktree Cuff2 root/frozen parent required")
    proof_path = root / "cuff2-native-proof.json"
    if proof_path.exists():
        raise ValueError("never overwrite Cuff2 native proof")
    binding = guard_frozen(frozen)
    rows, hashes = [], {}
    for px in (144,80):
        a, b = [root/mode/"idle"/f"px{px}" for mode in ("parent", "cuff2")]
        old = frozen/"idle"/f"px{px}"
        ar, br = read(a/"cuff2_trial.json"), read(b/"cuff2_trial.json")
        am, bm, om = read(a/"meta.json"), read(b/"meta.json"), read(old/"meta.json")
        frozen_record = read(old/"reconstruction.json")
        ag, bg = read(a/"haft_grips.json"), read(b/"haft_grips.json")
        err, old_err, gap = guard_pair(ar, br, am, bm, om, frozen_record, ag, bg)
        for filename in C1.PASSES:
            if not np.array_equal(rgba(a/filename), rgba(old/filename)):
                raise AssertionError(f"disabled Cuff2 parent raw replay differs: px{px}/{filename}")
        for raw in (a,b):
            if (raw/"R2").exists():
                raise ValueError("fresh unchanged R2 finish required")
            C1.D.process(str(raw), C1.D.load_finish(str(PIPE/"drive9/r2_finish.json")), "D1", "R2", True)
        native = [rgba(raw/"R2/still.png") for raw in (a,b)]
        images = [Image.open(raw/"R2/still_ground.png").convert("RGBA") for raw in (a,b)]
        row = {"px": px, "frozenParentRawReplayChangedPixels": 0,
               "samePoseMatrixMaxError": err, "frozenParentMatrixMaxError": old_err,
               "syntheticGripGapCm": gap, "geometry": br["geometry"],
               "changedPixels": int(np.any(native[0] != native[1], axis=2).sum()),
               "alphaChangedPixels": int((native[0][...,3] != native[1][...,3]).sum()),
               "parentVisibility": C1.visible_hand(a), "candidateVisibility": C1.visible_hand(b)}
        rows.append(row)
        for raw in (a,b,old):
            for filename in (*C1.PASSES, "meta.json", "haft_grips.json"):
                path = raw/filename
                hashes[str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (a/"cuff2_trial.json", b/"cuff2_trial.json", old/"reconstruction.json"):
            hashes[str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
        for raw in (a,b):
            for filename in ("still.png", "still_ground.png"):
                path = raw/"R2"/filename
                hashes[str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
        for scale in (1,3):
            w, h = images[0].size
            sheet = Image.new("RGB", (2*(w*scale+20), h*scale+28), "#212126")
            draw = ImageDraw.Draw(sheet)
            for i, (label, im) in enumerate(zip(("closed diagnostic parent", "Cuff2 upper-loft55mm"), images)):
                x = i*(w*scale+20)+10
                draw.text((x,5), label, fill="#d9d0bb")
                large = im.resize((w*scale,h*scale), Image.Resampling.NEAREST)
                sheet.paste(large, (x,23), large)
            sheet.save(root/f"cuff2-native-{px}-x{scale}.png")
    proof = {"schema": "rosace.cuff2.proof/1", "kind": "genuine paired native Cuff2 geometry, unchanged R2 finish",
             "parentSource": PARENT, "parentRole": "diagnostic; current appearance not promoted",
             "frozenParentBinding": binding,
             "rejectedPredecessor": "C1 c138e5d longitudinal compression before candidate render",
             "rows": rows, "inputAndFinishedHashes": hashes,
             "promoted": False, "motionQualified": False, "physicalClothQualified": False,
             "anatomyAccepted": False, "visualAcceptance": "pending actual pixel review",
             "limits": "80px >=20 categorical raw L-hand pixels and >=4x5 box necessary, not sufficient; inspect wrist/palm/thumb opposition/shaft interruption/cuff seams/clipping and whole144/80; three fresh fixed9 critics required"}
    proof_path.write_text(json.dumps(proof, indent=2), encoding="utf-8")
    print(json.dumps({"proof": str(proof_path), "visibilityFloors": [r["candidateVisibility"]["visibilityFloorPassed"] for r in rows]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--frozen-parent", type=Path, required=True)
    args = parser.parse_args()
    run(args.root, args.frozen_parent)
