"""Per-face limb ids for the shading stage (moved here from rosace_shade_lane.py at the Integrate step,
2026-09-29, so build_rosace_v2.py writes them into the canonical build too).

A FACE-domain float attribute 'limb' on every armature-deformed mesh: the limb (LIMBS below) whose
bones carry most of the face's vertex weight. materials.py writes it into the depth2 pass's B channel,
so rosace_shade.py can give each thigh, shin, arm, bust and glute its own terminator.
"""
import bpy

# limb ids (keep in sync with rosace_shade.LIMB_NAMES); bone name patterns are the VRM J_Bip names
LIMBS = [  # (id, name, bone-name predicates)
    (1, "torso", ("J_Bip_C_Hips", "J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest", "J_Sec_C_BustRoot", "Root")),
    (2, "neck", ("J_Bip_C_Neck",)),
    (3, "head", ("J_Bip_C_Head", "J_Adj_L_FaceEye", "J_Adj_R_FaceEye")),
    (4, "thigh_L", ("J_Bip_L_UpperLeg", "J_Sec_L_Thigh")),
    (5, "thigh_R", ("J_Bip_R_UpperLeg", "J_Sec_R_Thigh")),
    (6, "shin_L", ("J_Bip_L_LowerLeg",)),
    (7, "shin_R", ("J_Bip_R_LowerLeg",)),
    (8, "foot_L", ("J_Bip_L_Foot", "J_Bip_L_ToeBase")),
    (9, "foot_R", ("J_Bip_R_Foot", "J_Bip_R_ToeBase")),
    (10, "uarm_L", ("J_Bip_L_Shoulder", "J_Bip_L_UpperArm", "J_Adj_L_UpperArmTwist", "J_Adj_L_Deltoid")),
    (11, "uarm_R", ("J_Bip_R_Shoulder", "J_Bip_R_UpperArm", "J_Adj_R_UpperArmTwist", "J_Adj_R_Deltoid")),
    (12, "farm_L", ("J_Bip_L_LowerArm", "J_Adj_L_LowerArmTwist")),
    (13, "farm_R", ("J_Bip_R_LowerArm", "J_Adj_R_LowerArmTwist")),
    (14, "hand_L", ("J_Bip_L_Hand", "J_Bip_L_Index", "J_Bip_L_Middle", "J_Bip_L_Ring", "J_Bip_L_Little", "J_Bip_L_Thumb")),
    (15, "hand_R", ("J_Bip_R_Hand", "J_Bip_R_Index", "J_Bip_R_Middle", "J_Bip_R_Ring", "J_Bip_R_Little", "J_Bip_R_Thumb")),
    (16, "bust_L", ("J_Sec_L_Bust",)),
    (17, "bust_R", ("J_Sec_R_Bust",)),
    (18, "glute_L", ("J_Sec_L_Glute",)),
    (19, "glute_R", ("J_Sec_R_Glute",)),
    (20, "sleeve_L", ("sleeve_L_",)),
    (21, "sleeve_R", ("sleeve_R_",)),
    (22, "tabard", ("tabard_",)),
    (23, "stole", ("stole_",)),
    (24, "hair", ("side_", "hair_", "veil_")),
    (25, "glaive", ("glaive", "grip_")),
]


def limb_of(bone):
    for lid, _, pats in LIMBS:
        if any(bone == p or bone.startswith(p) for p in pats):
            return lid
    return 0


def write_limbs():
    n_obj = 0
    for o in bpy.data.objects:
        if o.type != "MESH" or not any(m.type == "ARMATURE" for m in o.modifiers):
            continue
        me = o.data
        gl = {g.index: limb_of(g.name) for g in o.vertex_groups}
        vl = []
        for v in me.vertices:
            acc = {}
            for g in v.groups:
                lid = gl.get(g.group, 0)
                if lid:
                    acc[lid] = acc.get(lid, 0.0) + g.weight
            vl.append(acc)
        if "limb" in me.attributes:
            me.attributes.remove(me.attributes["limb"])
        at = me.attributes.new("limb", "FLOAT", "FACE")
        vals = []
        for poly in me.polygons:
            acc = {}
            for vi in poly.vertices:
                for lid, w in vl[vi].items():
                    acc[lid] = acc.get(lid, 0.0) + w
            vals.append(float(max(sorted(acc), key=lambda k: acc[k])) if acc else 0.0)
        at.data.foreach_set("value", vals)
        n_obj += 1
    return n_obj
