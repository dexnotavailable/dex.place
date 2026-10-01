"""Blender (read-only): print the rig facts the stand-in -> rig mapping needs. Never saves."""
import json, os, sys
sys.dont_write_bytecode = True
import bpy
argv = sys.argv[sys.argv.index("--") + 1:]
blend, out = argv[0], argv[1]
bpy.ops.wm.open_mainfile(filepath=blend)
arm = bpy.data.objects["rosace_rig"]
B = arm.data.bones
names = ["Root", "J_Bip_C_Hips", "J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest", "J_Bip_C_Neck", "J_Bip_C_Head"]
for s in "LR":
    names += [f"J_Bip_{s}_{b}" for b in ("Shoulder", "UpperArm", "LowerArm", "Hand", "UpperLeg", "LowerLeg", "Foot", "ToeBase")]
    names += [f"ik_foot.{s}", f"ik_hand.{s}", f"pole_leg.{s}", f"pole_arm.{s}"]
names += ["glaive", "grip_main", "grip_mid", "grip_off", "glaive_tip", "glaive_butt"]
rep = {"rosace_height": float(arm.get("rosace_height", 0)), "bones": {},
       "glaive": arm.get("glaive").to_dict() if hasattr(arm.get("glaive"), "to_dict") else str(arm.get("glaive")),
       "chains": {k: list(v) for k, v in arm.data.get("chains", {}).items()},
       "objects": [(o.name, o.type, o.hide_render, o.get("part")) for o in bpy.data.objects],
       "all_bones": len(B)}
for n in names:
    b = B.get(n)
    if b:
        rep["bones"][n] = {"head": list(b.head_local), "tail": list(b.tail_local), "parent": b.parent.name if b.parent else None}
json.dump(rep, open(out, "w"), indent=1, default=str)
print("PROBE OK", out)
