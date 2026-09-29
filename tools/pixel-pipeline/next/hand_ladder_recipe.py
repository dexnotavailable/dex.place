"""The newly authorized finite hand-size ladder; frozen H1 source stays untouched."""
import copy
import math

ALLOWED = (1.0, 1.15, 1.30, 1.45)


def validate(scale):
    if not math.isfinite(scale) or scale not in ALLOWED:
        raise ValueError(f"use one declared hand ladder scale: {ALLOWED}")


def apply(pose, scale):
    validate(scale)
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
            raise ValueError("hand ladder supports only uniform scale")
        value = value[0]
    value = float(value)
    validate(value)
    return value
