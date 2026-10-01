"""Writes data/render_map.json: which drawing renders each pose key the clips name.

Default is the stand-in's own pose mapped onto the rig (posemap.py), which keeps every clip's timing, phases and
reach. Where the repository already holds judged, hand-posed Rosace keys for the same move, those are rendered
instead (same frame, same tick counts): the idle stance (art/rosace/poses/idle_appeal.json, the drive-9 idle), the N1
string for m1_1 (coil / strike / contact / over from art/rosace/poses/motion, the same mapping Codex's
n1-n2 driver recipes use: m1_1.A2 coil, S1 strike, C1 contact, F2 over) and q_stamp for the Q plant. Recovery frames
that blend into idle ("X~idle0:0.5") blend into the hero idle so a move ends on the pose the idle clip starts from.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
solved = json.load(open(os.path.join(HERE, "data", "standin_solved.json"), encoding="utf-8"))
IDLE = "hero:idle_appeal+breath0"
M = {
    "idle0": "hero:idle_appeal+breath0",
    "idle1": "hero:idle_appeal+breath1",
    "idle0~idle1:0.5": "hero:idle_appeal+breath0.5",
    "idle1~idle0:0.5": "hero:idle_appeal+breath0.5",
    "m1aWind": "hero:motion/n1_coil_r3",
    "m1aWind~m1aStrike:0.45": "hero:motion/n1_strike_r3c",
    "m1aStrike": "hero:motion/n1_contact_r3b",
    "m1aFollow": "hero:motion/n1_over_r3c",
    "qPlant": "hero:q_stamp",
    "qHold": "hero:q_stamp+settle",
    "qRaise~qPlant:0.5": "blend:qRaise|hero:q_stamp|0.5",
    # q_stamp (long stamping stance, glaive in both hands) and the idle (glaive planted, one hand) cannot be blended
    # without the grip leaving the hands, so the recovery frame is the idle stance itself
    "qHold~idle0:0.5": "hero:idle_appeal+breath0",
}
keys = []
for c in solved["clips"]:
    for f in c["frames"]:
        if f["pose"] not in keys:
            keys.append(f["pose"])
out = {}
for k in keys:
    if k in M:
        out[k] = M[k]
    elif k.endswith("~idle0:0.5"):
        base = k[:-len("~idle0:0.5")]
        out[k] = f"blend:{M.get(base, base)}|{IDLE}|0.5"
    else:
        out[k] = k
json.dump(out, open(os.path.join(HERE, "data", "render_map.json"), "w"), indent=1)
print(sum(1 for k, v in out.items() if k != v), "of", len(out), "pose keys use a non-default drawing")
