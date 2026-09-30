"""Authored construction from semantic pixel-guide observations, not raster.

One integrated reconstruction letter: restore coherent upright torso/hip
rhythm, place the open free hand at the hip, keep seated1.30 authored hands,
and use an actual mesh window. Face/material clusters are a separate explicit
finish stage of the same letter. Every frozen input remains untouched.
"""
import copy
import json
import hashlib
import hand_recipe as BASE

MODE = "control"
CHANGES = {
    "bones.J_Bip_C_Hips": [5.0, 15.0, 4.0],
    "figure.torso.bend": [-12.0, 0.0, -5.0],
    "figure.joints.upper_chest": [0.0, 6.0, 0.0],
    "figure.hands.R.pos": [-0.15, -0.015, 1.22],
}


def apply(pose, scale):
    result = BASE.apply(pose, scale)
    if MODE == "control" or not pose:
        return result
    if MODE != "reconstruction" or scale != 1.3 or pose.get("name") != "idle_appeal":
        raise ValueError("reconstruction is explicit idle with compensated1.30 hands only")
    for path, value in CHANGES.items():
        target = result
        fields = path.split(".")
        for field in fields[:-1]:
            target = target.setdefault(field, {})
        target[fields[-1]] = copy.deepcopy(value)
    return result


def recipe_hash():
    return hashlib.sha256(json.dumps(CHANGES,sort_keys=True).encode()).hexdigest()


scale_for = BASE.scale_for
effective_hands = BASE.effective_hands
