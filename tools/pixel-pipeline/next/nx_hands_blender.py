"""Delivery-only isolated hand geometry trial around the preserved R2 renderer.

Run via blender_env.py and delivery's exclusive/GPU leases. Control scale1.0
leaves the original pose application untouched; candidate idle scales both
authored hands to1.30. Compensating the grip solve is a contact constraint of
that geometry change, not a new hand pose. Adds depth2 and separate hand/haft
measurements; never saves or changes a canonical blend or source mapping.
"""
import ast
import copy
import hashlib
import json
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hand_recipe  # noqa: E402

PIPE = Path(__file__).resolve().parents[1]
REPO = PIPE.parents[1]
EXPECTED_BLEND = "aef28c7f5cdddee6f18bd12c06d988b5436eeac24049ddf4f6ca37f654394373"
EXPECTED_MODEL = "1b30ca8eccc324cda999d90e3bae20f58e62970483ea3f9f877b8d61f73cebf3"


def library(path, name):
    """Load the known repo module, removing only its verified final main() call."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    last = tree.body[-1]
    if not (isinstance(last, ast.Expr) and isinstance(last.value, ast.Call)
            and isinstance(last.value.func, ast.Name) and last.value.func.id == "main"
            and not last.value.args and not last.value.keywords):
        raise ValueError(f"expected final main() call in {path}")
    tree.body.pop()
    module = types.ModuleType(name)
    module.__file__ = str(path)
    exec(compile(tree, str(path), "exec"), module.__dict__)
    return module


def argument(argv, name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    if "--save-lane" in argv:
        raise ValueError("this comparison never saves a blend")
    scale = float(argument(argv, "--hand-scale", "1.0"))
    hand_recipe.apply({}, scale)  # validates even before Blender source runs
    shots = argument(argv, "--shots", "idle,n1,q,back")
    if scale != 1.0 and ("--shots" not in argv or shots != "idle"):
        raise ValueError("candidate is bounded to idle; other moves are not changed")
    if argument(argv, "--r2") is None or Path(argument(argv, "--r2")).resolve() != (PIPE / "drive9/r2_model.json").resolve():
        raise ValueError("use the preserved R2 model file; no other model lever is allowed")
    if hashlib.sha256((PIPE / "drive9/r2_model.json").read_bytes()).hexdigest() != EXPECTED_MODEL:
        raise ValueError("preserved R2 model content changed")
    if float(argument(argv, "--head", "1.10")) != 1.10 or "--neck-l" in argv or "--drape" in argv:
        raise ValueError("head/neck/drape settings must stay R2")
    if argument(argv, "--ss", "4") != "4" or argument(argv, "--px", "144,80") != "144,80":
        raise ValueError("trial uses ss4 and both144/80 sizes only")
    blend = Path(argument(argv, "--blend"))
    before = hashlib.sha256(blend.read_bytes()).hexdigest()
    if before != EXPECTED_BLEND:
        raise ValueError("canonical baseline blend differs from preserved R2")
    output = Path(argument(argv, "--out")).resolve()
    if output.exists():
        raise ValueError("use a fresh output directory; no render trial is overwritten")
    sys.path.insert(0, str(PIPE))
    sys.path.insert(0, str(PIPE / "drive9"))
    driver = library(PIPE / "drive9/d9_blender.py", "nx_hand_drive9")
    gh = library(REPO / "tools/art-construct/gh_render.py", "nx_hand_landmarks")
    original_apply = driver.figure_pose.apply_pose
    original_grip = driver.posing.grip_hand
    original_rest = driver.posing.hand_rest
    original_f1 = driver.f1_module
    state = {"pose": None, "solve": []}

    def scaled_grip(arm, side, socket, thumb="tip", back=None, slide=0.0):
        pose = state["pose"]
        factor = hand_recipe.scale_for(pose, side)
        for row in range(4):
            for column in range(4):
                if abs(arm.matrix_world[row][column] - (1.0 if row == column else 0.0)) > 1e-6:
                    raise ValueError("scaled grip requires the canonical identity armature transform")
        ancestor = arm.pose.bones[f"J_Bip_{side}_Hand"].parent
        while ancestor:
            if any(abs(value - 1.0) > 1e-3 for value in ancestor.matrix.to_scale()):
                raise ValueError(f"scaled grip requires unit-scale ancestors: {ancestor.name}")
            ancestor = ancestor.parent

        def rest(a, s):
            matrix, head, forward, palm, grip = original_rest(a, s)
            if s == side:
                grip = head + (grip - head) * factor
            return matrix, head, forward, palm, grip

        driver.posing.hand_rest = rest
        try:
            original_grip(arm, side, socket, thumb, back, slide)
        finally:
            driver.posing.hand_rest = original_rest
        state["solve"].append({"side": side, "scale": factor,
                              "socket": socket, "slide": slide})

    def apply_pose(pose):
        if scale != 1.0 and pose.get("name") != "idle_appeal":
            raise ValueError("candidate pose must be preserved idle_appeal")
        state["pose"] = hand_recipe.apply(pose, scale)
        state["solve"] = []
        if scale == 1.0:
            return original_apply(pose)
        driver.posing.grip_hand = scaled_grip
        try:
            result = original_apply(state["pose"])
            arm = driver.posing.arm_obj()
            for side in "LR":
                actual = arm.pose.bones[f"J_Bip_{side}_Hand"].matrix.to_scale()
                if any(abs(value - scale) > 1e-3 for value in actual):
                    raise ValueError(f"effective hand scale differs from requested scale: {side}")
            return result
        finally:
            driver.posing.grip_hand = original_grip
            driver.posing.hand_rest = original_rest

    def f1():
        module = original_f1()
        original_facepass = module.facepass

        def facepass(scene, meta, directory):
            original_facepass(scene, meta, directory)
            pose = copy.deepcopy(state["pose"])
            pose["hands"] = hand_recipe.effective_hands(pose)
            gh.SS = int(meta["ss"])
            metrics = gh.landmarks(scene, pose)
            metrics["hand_trial"] = {"scale": scale, "geometry": "existing authored hand bones",
                                      "contact_compensation": scale != 1.0,
                                      "solve": state["solve"], "px": meta["px"],
                                      "canonical_blend_sha256": before,
                                      "limits": "gap measures synthetic bone grip center; finger wrap/wrist seams need pixels; GH reach_m uses unscaled rest offset"}
            Path(directory, "haft_grips.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        module.facepass = facepass
        return module

    driver.figure_pose.apply_pose = apply_pose
    driver.f1_module = f1
    driver.PASSES = (*driver.PASSES, "depth2")
    try:
        driver.main()
    finally:
        driver.figure_pose.apply_pose = original_apply
        driver.f1_module = original_f1
        driver.posing.grip_hand = original_grip
        driver.posing.hand_rest = original_rest
        after = hashlib.sha256(blend.read_bytes()).hexdigest()
        if after != before:
            raise AssertionError("canonical blend changed during read-only trial")


if __name__ == "__main__":
    main()
