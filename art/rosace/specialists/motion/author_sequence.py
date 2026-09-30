"""Pure-data motion authoring/export. Does not start Blender, a model or a render.

This consumes the attack planner's actual interface and produces actor ticks and
authored pose JSONs. Blender resolves anatomy/grips; this is source evidence only.
"""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
BASE = "bcb220de03c0b84e8fa68851328cd1d799a11de5"


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def confined(path, root):
    path = Path(path).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("path leaves its declared root")
    return path


def make_poses():
    """Authored angular extremes; exact planner yaw is kept unwrapped in metadata.

    A2 retains the existing rear-three-quarter design. Other drawings author
    low/flat release, overshoot and a two-hand upright settle. Feet are native
    toe-pinned after Root movement, never accepted from these numeric targets.
    """
    coil = read(REPO / "art/rosace/poses/n2_pivot.json")
    coil["name"] = "motion_n2_A2"
    coil["note"] = "Authored N2 rear coil from frozen n2_pivot; native toe lock and regrip proof pending."
    for key in ("_doc", "note_glaive_hands", "note_integrate"):
        coil.pop(key, None)
    # Preserve the existing moving-export control camera. Additional strict
    # profile views are private coverage; only the integrator may adopt a new one.
    coil["camera"] = {"yaw": 60, "elev": 8}
    coil["_motion"] = {"drawing": "A2", "yawUnwrapped": 150, "status": "authored-unrendered"}
    write(HERE / "poses/n2_A2.json", coil)
    configurations = [
        ("S1", 300, 18, -0.17, 0.82, 4, 28),
        ("C1", 360, 12, -0.20, 0.88, 3, 12),
        ("F1", 382, 7, -0.13, 0.94, 22, 8),
        ("F2", 370, 4, -0.08, 1.03, 55, 4),
        ("R1", 363, 3, -0.04, 1.08, 76, 2),
        ("R2", 360, 2, -0.02, 1.10, 84, 0),
        ("R3", 360, 2, -0.02, 1.10, 84, 0),
    ]
    for drawing, yaw, tilt, sink, grip_h, pitch, chest_twist in configurations:
        p = copy.deepcopy(coil)
        p["name"] = f"motion_n2_{drawing}"
        p["note"] = "Original authored low sweep/overshoot/settle; source targets, native rig and pixel validation pending."
        p["root"] = {"loc": [0, 0, 0], "rot": [0, 0, yaw]}
        p["bones"] = {
            "J_Bip_C_Hips.loc": [0, -0.10, sink],
            "J_Bip_C_Hips": [tilt, -4, 0],
            "J_Bip_C_Spine": [-4, 2, chest_twist * 0.4],
            "J_Bip_C_Chest": [-6, 2, chest_twist * 0.4],
            "J_Bip_C_UpperChest": [-2, 0, chest_twist * 0.2],
            "J_Bip_C_Neck": [-3, 0, -chest_twist * 0.3],
            "J_Bip_C_Head": [-5, -3, -chest_twist * 0.4],
        }
        angle = math.radians(pitch)
        p["weapon"] = {"hand_R": [-0.18, -0.27, grip_h],
                       "dir": [0, -math.cos(angle), math.sin(angle)], "edge": [1, 0, 0]}
        p["hands"] = {
            "R": {"grip": "grip_off", "slide": -0.45, "thumb": "tip", "back": [-0.9, 0.1, 0.4]},
            "L": {"grip": "grip_main", "slide": -1.0, "thumb": "tip", "back": [0.8, 0.1, 0.5]},
        }
        p["feet"] = {"L": {"pos": [0.12, -0.36, 0.159], "yaw": 4},
                     "R": {"pos": [-0.16, 0.22, 0.159], "yaw": -24}}
        p["poles"] = {"arm.R": [-0.6, -0.3, 0.95], "arm.L": [0.55, -0.30, 1.05],
                      "leg.R": [-0.30, -0.65, 0.55], "leg.L": [0.30, -0.90, 0.55]}
        p["fingers"] = {s: {"curl": 80, "thumb": 50} for s in "LR"}
        p["_motion"] = {"drawing": drawing, "yawUnwrapped": yaw,
                         "status": "authored-unrendered", "anatomicalPrimary": "R"}
        write(HERE / f"poses/n2_{drawing}.json", p)


def validate(planner, motion):
    if planner.get("contract") != motion["plannerContract"] or planner.get("id") != motion["plannerId"]:
        raise ValueError("wrong planner contract/id")
    if planner.get("base") != BASE or motion.get("base") != BASE or planner.get("fps") != 60:
        raise ValueError("wrong frozen base/clock")
    if planner["boundary"]["afterTick"] != 15 or planner["boundary"]["inheritDrawing"] != "F2":
        raise ValueError("this driver only supports reviewed earliest F2 seam")
    clips = planner["clips"]
    if [c["id"] for c in clips] != ["m1_1", "m1_2"] or [c["length"] for c in clips] != [33, 38]:
        raise ValueError("clip contract changed")
    for clip in clips:
        cursor = 1
        for d in clip["drawings"]:
            if d["start"] != cursor or not isinstance(d["ticks"], int) or d["ticks"] < 1:
                raise ValueError("drawing gap/overlap")
            cursor += d["ticks"]
            key = clip["id"] + "." + d["id"]
            recipe = motion["recipes"][key]
            if recipe["leftGrip"] != d["grip"]["L"] or d["grip"]["R"] != 1:
                raise ValueError("anatomical grip disagreement")
            if "pose" in recipe:
                path = confined(HERE / recipe["pose"], HERE)
                pose = read(path)
                if pose["_motion"]["yawUnwrapped"] != d["yawRelative"]:
                    raise ValueError("planner yaw drift")
                numeric_finite(pose)
        if cursor != clip["length"] + 1:
            raise ValueError("wrong total exposure")
    for path in motion["sources"].values():
        confined(REPO / path, REPO)
        if not (REPO / path).is_file():
            raise ValueError("missing hero source")
    numeric_finite(motion)
    return clips


def numeric_finite(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("nonfinite source")
    if isinstance(value, dict):
        for child in value.values():
            numeric_finite(child)
    if isinstance(value, list):
        for child in value:
            numeric_finite(child)


def root_at(clip, tick):
    result = 0.0
    for span in clip["root"]:
        # Inclusive per-tick deltas. Tick6 is the first N1 step, tick9 completes it.
        u = max(0.0, min(1.0, (tick - span["from"] + 1) / (span["to"] - span["from"] + 1)))
        result += span["deltaH"][0] * u
    return result


def export(planner_path, output, chain=True):
    planner, motion = read(planner_path), read(HERE / "sequence.json")
    if sha(planner_path) != motion["plannerSha256"]:
        raise ValueError("planner bytes changed; require integrator review and a new exact binding")
    clips = validate(planner, motion)
    ticks, total_root = [], 0.0
    for clip in clips[:2 if chain else 1]:
        length = 15 if chain and clip["id"] == "m1_1" else clip["length"]
        for tick in range(1, length + 1):
            drawing = next(d for d in clip["drawings"] if d["start"] <= tick < d["start"] + d["ticks"])
            reach = dict(motion["regrip"]["reachTicks"]).get(tick) if clip["id"] == "m1_2" else None
            ticks.append({"frame": len(ticks) + 1, "clip": clip["id"], "tick": tick,
                          "drawing": drawing["id"], "recipe": clip["id"] + "." + drawing["id"],
                          "rootForwardH": total_root + root_at(clip, tick), "regripReach": reach,
                          "yawUnwrapped": drawing.get("yawRelative", 0),
                          "leftGrip": drawing["grip"]["L"]})
        total_root += root_at(clip, length)
    if chain:
        if ticks[14]["recipe"] != "m1_1.F2" or ticks[15]["recipe"] != "m1_2.A1":
            raise ValueError("boundary recipe drift")
        if ticks[14]["rootForwardH"] != ticks[15]["rootForwardH"]:
            raise ValueError("root snap at seam")
    for _ in range(motion["settleTicks"]):
        row = dict(ticks[-1], frame=len(ticks) + 1, settle=True)
        ticks.append(row)
    result = {"contract": "rosace.motion-ticks/1", "id": motion["id"], "state": "authored-not-native",
              "plannerId": planner["id"], "plannerSha256": sha(planner_path),
              "motionSha256": sha(HERE / "sequence.json"), "fps": 60, "warmupTicks": 45,
              "route": "earliest-chain" if chain else "n1-whiff-recovery", "ticks": ticks,
              "limits": motion["limits"]}
    write(output, result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--author-poses", action="store_true")
    parser.add_argument("--planner", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--n1-only", action="store_true")
    args = parser.parse_args()
    if args.author_poses:
        make_poses()
    if args.planner:
        if not args.out:
            parser.error("--out required for source-only export")
        result = export(args.planner, args.out, chain=not args.n1_only)
        print(json.dumps({"status": "pass-source-only", "ticks": len(result["ticks"]),
                          "plannerSha256": result["plannerSha256"], "nativeExecuted": False}))


if __name__ == "__main__":
    main()
