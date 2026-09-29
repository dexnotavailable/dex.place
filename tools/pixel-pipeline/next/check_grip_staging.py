"""Source contact/staging preservation checks; actual visibility is native proof."""
import ast
import json
import math
from pathlib import Path

import grip_staging_recipe as S
import hand_recipe as H


def main():
    repo = Path(__file__).resolve().parents[3]
    pose = json.loads((repo / "art/rosace/poses/idle_appeal.json").read_text(encoding="utf-8"))
    parent = H.apply(pose, 1.3)
    S.ANGLE = 0
    assert S.apply(pose, 1.3) == parent
    for angle in (30, -80):
        S.ANGLE = angle
        value = S.apply(pose, 1.3)
        old = parent["hands"]["L"]["back"]
        new = value["hands"]["L"]["back"]
        assert abs(sum(x * x for x in old) - sum(x * x for x in new)) < 1e-12
        axis = pose["weapon"]["dir"]
        assert abs(sum(a * b for a, b in zip(old, axis)) - sum(a * b for a, b in zip(new, axis))) < 1e-12
        value["hands"]["L"]["back"] = old
        assert value == parent
    S.ANGLE = 0
    for name in ("grip_staging_recipe.py", "nx_grip_staging_blender.py", "check_grip_staging.py"):
        ast.parse((Path(__file__).parent / name).read_text(encoding="utf-8"))
    print(json.dumps({"zero_exact_H1_parent": True, "only_grip_back_direction_changed": True,
                      "same_socket_slide_fingers_size_pose_finish": True, "rotation_length_axis_projection": "pass",
                      "syntax": "pass", "limits": "native seam/contact/visibility/pixels pending"}))


if __name__ == "__main__":
    main()
