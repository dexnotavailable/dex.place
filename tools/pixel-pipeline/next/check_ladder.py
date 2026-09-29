"""Source-only ladder preservation checks; no native/render/quality evidence."""
import ast
import json
from pathlib import Path

import hand_ladder_recipe as L
import hand_recipe as H


def main():
    repo = Path(__file__).resolve().parents[3]
    pose = json.loads((repo / "art/rosace/poses/idle_appeal.json").read_text(encoding="utf-8"))
    assert L.apply(pose, 1.0) == pose
    assert L.apply(pose, 1.3) == H.apply(pose, 1.3)
    for scale in (1.15, 1.3, 1.45):
        value = L.apply(pose, scale)
        for side in "LR":
            assert L.scale_for(value, side) == scale
            value["bones"].pop(f"J_Bip_{side}_Hand.scale")
        assert value == pose
    for scale in (0.9, 1.2, 1.46, float("nan"), float("inf")):
        try:
            L.apply(pose, scale)
        except ValueError:
            pass
        else:
            raise AssertionError(f"undeclared ladder scale accepted {scale}")
    for name in ("hand_ladder_recipe.py", "nx_hands_ladder_blender.py", "check_ladder.py"):
        ast.parse((Path(__file__).parent / name).read_text(encoding="utf-8"))
    print(json.dumps({"control_equal": True, "H130_exact_recipe_equal": True,
                      "one_lever_all_variants": True, "invalid_values_rejected": True,
                      "syntax": "pass", "limits": "native/contact/pixels pending delivery"}))


if __name__ == "__main__":
    main()
