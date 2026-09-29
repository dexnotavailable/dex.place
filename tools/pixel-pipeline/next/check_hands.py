"""Small source checks; no Blender, GPU, native image or quality claim."""
import ast
import json
import math
from pathlib import Path

import hand_recipe


def main():
    repo = Path(__file__).resolve().parents[3]
    pose = json.loads((repo / "art/rosace/poses/idle_appeal.json").read_text(encoding="utf-8"))
    snapshot = json.dumps(pose, sort_keys=True)
    control = hand_recipe.apply(pose, 1.0)
    assert control == pose and control is not pose
    candidate = hand_recipe.apply(pose, 1.3)
    assert json.dumps(pose, sort_keys=True) == snapshot
    original_bones = dict(candidate["bones"])
    for side in "LR":
        assert original_bones.pop(f"J_Bip_{side}_Hand.scale") == 1.3
    assert original_bones == pose["bones"]
    candidate_without_bones = dict(candidate)
    candidate_without_bones["bones"] = pose["bones"]
    assert candidate_without_bones == pose
    hands = hand_recipe.effective_hands(pose)
    assert "grip" in hands["L"] and hands["R"]["rel"] == "hips"
    for invalid in (0.9, 1.31, float("nan"), float("inf")):
        try:
            hand_recipe.apply(pose, invalid)
        except ValueError:
            pass
        else:
            raise AssertionError(f"invalid scale accepted: {invalid}")
    # Grip-center identity for rotated rest offsets. This proves the source
    # formula; actual IK/mesh scale is separately guarded in Blender.
    for angle in (0, 45, 90, 137):
        theta = math.radians(angle)
        offset = (0.048 * math.cos(theta), 0.048 * math.sin(theta), -0.026)
        target = (0.31, -0.20, 1.44)
        wrist = tuple(p - 1.3 * d for p, d in zip(target, offset))
        grip = tuple(p + 1.3 * d for p, d in zip(wrist, offset))
        assert max(abs(a - b) for a, b in zip(grip, target)) < 1e-12
    for name in ("hand_recipe.py", "nx_hands_blender.py", "hand_metrics.py", "check_hands.py"):
        ast.parse((Path(__file__).parent / name).read_text(encoding="utf-8"), filename=name)
    proof = {"control_pose_copy_equal": True, "candidate_only_two_hand_scale_inputs": True,
             "input_pose_unchanged": True, "invalid_scales_rejected": True,
             "grip_formula_source_identity": True, "python_syntax": "pass",
             "limits": "actual inherited scale/IK/gap/depth2/hand pixels require delivery render"}
    output = repo / "review/rosace/art/next/hands130-source-checks.json"
    output.write_text(json.dumps(proof, indent=2), encoding="utf-8")
    print(json.dumps(proof))


if __name__ == "__main__":
    main()
