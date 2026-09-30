"""Priority source preservation/syntax; no native/visual acceptance implied."""
import ast
import json
from pathlib import Path


def changes(before, after, prefix=""):
    if isinstance(before, dict) and isinstance(after, dict):
        out = []
        for key in set(before) | set(after):
            name = prefix + ("." if prefix else "") + key
            if key not in before or key not in after:
                out.append(name)
            else:
                out.extend(changes(before[key], after[key], name))
        return out
    return [] if before == after else [prefix]


def main():
    repo = Path(__file__).resolve().parents[3]
    base = json.loads((repo / "tools/pixel-pipeline/drive9/r2_model.json").read_text(encoding="utf-8"))
    pose = json.loads((repo / "art/rosace/next/pose-grounded-rest-model.json").read_text(encoding="utf-8-sig"))
    base.pop("_doc")
    pose.pop("_doc")
    expected = {"poses.idle_appeal.bones.J_Bip_C_Hips", "poses.idle_appeal.figure.torso.bend",
                "poses.idle_appeal.figure.joints.upper_chest", "poses.idle_appeal.figure.hands.R.pos"}
    actual = set(changes(base, pose))
    if actual != expected:
        raise AssertionError(f"undeclared pose change: {actual}")
    for name in ("face_trial.py", "window_trial.py", "nx_waist_audit_blender.py", "check_priority_passes.py"):
        ast.parse((Path(__file__).parent / name).read_text(encoding="utf-8"), filename=name)
    print(json.dumps({"declared_pose_gesture_only": sorted(actual), "syntax": "pass",
                      "limits": "nativebody/pose/waist evidence pending; actualface/windowcritique separate"}))


if __name__ == "__main__":
    main()
