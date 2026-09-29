"""One geometry variable: authored idle hands at 1.30, with the haft contact kept.

No face, body pose, fingers, sleeves or finish changes are proposed here. The
grip solve uses the scaled rest offset so its final center stays on the same
target. The original rig/pose files are never edited.
"""
import copy
import math


def apply(pose, scale):
    if not math.isfinite(scale) or not 1.0 <= scale <= 1.3:
        raise ValueError("hand scale must be finite in [1.0, 1.3]")
    result = copy.deepcopy(pose)
    if scale != 1.0:
        bones = result.setdefault("bones", {})
        for side in "LR":
            bones[f"J_Bip_{side}_Hand.scale"] = scale
    return result


def effective_hands(pose):
    hands = dict(pose.get("hands", {}))
    hands.update((pose.get("figure") or {}).get("hands", {}))
    return hands


def scale_for(pose, side):
    value = pose.get("bones", {}).get(f"J_Bip_{side}_Hand.scale", 1.0)
    if isinstance(value, (list, tuple)):
        if len(value) != 3 or max(value) - min(value) > 1e-9:
            raise ValueError("this trial supports uniform hand scales only")
        value = value[0]
    value = float(value)
    if not math.isfinite(value) or not 1.0 <= value <= 1.3:
        raise ValueError("invalid effective hand scale")
    return value
