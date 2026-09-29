"""One next lever on native H1: turn the grip about the seated haft.

Geometry size remains the reviewed H1 1.30, socket/slide/finger curls unchanged.
Two authored orientations expose palm or knuckles, tested against exact H1/R2
pixels. This does not paint a bigger hand or claim proxy contact as anatomy.
"""
import math

import hand_recipe as H1

ANGLE = 0.0
ALLOWED = (0.0, 30.0, -80.0)


def rotate(vector, axis, angle):
    length = math.sqrt(sum(x * x for x in axis))
    if length < 1e-9:
        raise ValueError("grip stage needs nonzero haft direction")
    unit = [x / length for x in axis]
    dot = sum(x * y for x, y in zip(unit, vector))
    cross = [unit[1] * vector[2] - unit[2] * vector[1],
             unit[2] * vector[0] - unit[0] * vector[2],
             unit[0] * vector[1] - unit[1] * vector[0]]
    c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    return [v * c + x * s + u * dot * (1 - c) for v, x, u in zip(vector, cross, unit)]


def apply(pose, scale):
    if ANGLE not in ALLOWED or scale not in (1.0, 1.3):
        raise ValueError("declared grip stage angles and H1 scale only")
    result = H1.apply(pose, scale)
    if scale == 1.3 and ANGLE != 0 and pose.get("name") == "idle_appeal":
        if "L" in (result.get("figure") or {}).get("hands", {}):
            raise ValueError("figure override would hide the authored grip change")
        grip = result["hands"]["L"]
        if grip["grip"] != "grip_main" or grip["thumb"] != "tip":
            raise ValueError("preserved H1 grip ownership changed")
        grip["back"] = rotate(grip["back"], result["weapon"]["dir"], ANGLE)
    return result


effective_hands = H1.effective_hands
scale_for = H1.scale_for
