"""Small discriminating checks for planner binding/timing/root/grip source.

Standard library only. No Blender/model/GPU import or visual acceptance.
"""
import argparse
import ast
import copy
import json
import math
from pathlib import Path

import author_sequence as A


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--planner", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--motion-control-meta", type=Path)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    planner, motion = A.read(args.planner), A.read(A.HERE / "sequence.json")
    A.validate(planner, motion)
    old = A.read(A.REPO / "tools/motion-ai/timing/n1_r3c.json")
    expected = [(d["id"], d["start"], d["ticks"]) for d in planner["clips"][0]["drawings"]]
    if [tuple(d) for d in old["exposure"]["drawings"]] != expected:
        raise AssertionError("N1 r3c exposure was changed")
    exports = {}
    for name, chain in (("chain", True), ("n1-whiff", False)):
        path = args.out / f"{name}-ticks.json"
        exports[name] = A.export(args.planner, path, chain)
    chain, whiff = exports["chain"]["ticks"], exports["n1-whiff"]["ticks"]
    if len(chain) != 77 or len(whiff) != 57:
        raise AssertionError("wrong finite trajectory length")
    if chain[14]["clip"] != "m1_1" or chain[15]["clip"] != "m1_2":
        raise AssertionError("seam clock mismatch")
    if not math.isclose(chain[14]["rootForwardH"], 0.125) or chain[15]["rootForwardH"] != chain[14]["rootForwardH"]:
        raise AssertionError("root snap/double application at seam")
    if not math.isclose(chain[52]["rootForwardH"], 0.1875):
        raise AssertionError("N1+N2 H root travel mismatch")
    if [(chain[i]["tick"], chain[i]["regripReach"]) for i in (16, 17)] != [(2, 0.35), (3, 0.75)]:
        raise AssertionError("missing actual regrip redraw ticks")
    matrix = A.read(A.HERE / "view_keypose_matrix.json")
    if len(matrix["views"]) != 6 or matrix["bodyHeights"] != [80, 144]:
        raise AssertionError("missing requested scale/side view")
    for view in matrix["views"]:
        if not 0 <= view["yaw"] < 360:
            raise AssertionError("bad camera yaw")
    controls = {v["id"]: (v["yaw"], v["elev"]) for v in matrix["controlCameras"]}
    actual_control = None
    if args.motion_control_meta:
        actual = A.read(args.motion_control_meta)
        actual_control = (actual["yaw"], actual["elev"])
        if controls["existing-motion-control"] != actual_control:
            raise AssertionError("export camera diverged from actual saved moving control")
    for stage in matrix["stages"][1:4]:
        if stage["views"] != ["existing-motion-control"]:
            raise AssertionError("private inspection view silently replaced moving control")
    for pose_path in (A.HERE / "poses").glob("*.json"):
        p = A.read(pose_path)
        A.numeric_finite(p)
        if p["hands"]["R"].get("grip") is None or p["hands"]["L"].get("grip") is None:
            raise AssertionError("N2 lost an anatomical socket")
        if (p["camera"]["yaw"], p["camera"]["elev"]) != controls["existing-motion-control"]:
            raise AssertionError("pose camera changed before integrator adjudication")
        d, e = p["weapon"]["dir"], p["weapon"]["edge"]
        length = math.sqrt(sum(v * v for v in d))
        cross = [d[1] * e[2] - d[2] * e[1], d[2] * e[0] - d[0] * e[2], d[0] * e[1] - d[1] * e[0]]
        if length < 0.99 or math.sqrt(sum(v * v for v in cross)) < 0.1:
            raise AssertionError("degenerate weapon frame")
    negatives = []
    cases = [
        ("wrong-base", lambda p: p.update(base="0" * 40)),
        ("exposure-overlap", lambda p: p["clips"][1]["drawings"][1].update(start=3)),
        ("hand-swap", lambda p: p["clips"][1]["drawings"][2]["grip"].update(R=0)),
        ("reverse-pivot", lambda p: p["clips"][1]["drawings"][2].update(yawRelative=-60)),
        ("late-entry", lambda p: p["boundary"].update(afterTick=24)),
    ]
    for name, mutate in cases:
        p = copy.deepcopy(planner)
        mutate(p)
        try:
            A.validate(p, motion)
        except ValueError:
            negatives.append(name)
        else:
            raise AssertionError(f"negative fixture was accepted: {name}")
    for path in A.HERE.glob("*.py"):
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    result = {"status":"pass-source-only","plannerHead":motion["plannerHead"],
              "plannerSha256":A.sha(args.planner),"n1ExposurePreserved":True,
              "chainActorTicks":53,"chainWithSettleTicks":77,"whiffWithSettleTicks":57,
              "rootHAtSeam":chain[14]["rootForwardH"],"rootHAtEnd":chain[52]["rootForwardH"],
              "negativeFixtures":negatives,"bodyHeights":[80,144],"viewCount":6,
              "actualSavedMotionCamera":actual_control,
              "nativeExecuted":False,"renderedCandidate":False,
              "limits":"pure interface/timing/root/pose source; no native rig/physical cloth/pixel/playback acceptance"}
    A.write(args.out / "checks.json", result)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
