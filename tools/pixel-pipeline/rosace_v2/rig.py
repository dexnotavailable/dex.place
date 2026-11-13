"""v2 rig additions on the renamed SiroinoSotai armature (runs inside Blender).

The v1 contract is kept: J_Bip_* humanoid bones (rest = T-pose, she faces -Y), a 'Root' bone at
the origin, J_Adj_*_FaceEye anchors, IK + glaive sockets from ../rosace/rig.py and glaive.py.
Added here:
  * twist helpers J_Adj_*_UpperArmTwist / LowerArmTwist (SiroinoSotai's own twist weights), driven
    by Transformation constraints in REPLACE mode (so posing.bake_keys' FK capture can't double
    them): the forearm helper takes half the hand's twist, the upper-arm helper cancels half the
    upper arm's twist near the shoulder. This is the candy-wrap fix.
  * soft-tissue jiggle bones: J_Sec_*_Bust1 (the source's breast bones), J_Sec_*_Glute,
    J_Sec_*_Thigh, with weights for the glutes and thighs; their spring settings are in jiggle.py.
"""
import math

import bpy
import numpy as np
from mathutils import Vector

V = Vector


def edit(arm):
    bpy.context.view_layer.objects.active = arm
    if bpy.context.mode != "EDIT_ARMATURE":
        bpy.ops.object.mode_set(mode="EDIT")
    return arm.data.edit_bones


def obj_mode():
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def add_root_and_head(arm, head_joint, eyes):
    """Root at the floor origin (parent of the hips, unconnected), the head joint moved up to the
    MMD head's own skull-base pivot, and the eye anchors."""
    eb = edit(arm)
    root = eb.new("Root")
    root.head, root.tail = V((0, 0, 0)), V((0, 0, 0.1))
    hips = eb["J_Bip_C_Hips"]
    hips.parent = root
    hips.use_connect = False
    head = eb["J_Bip_C_Head"]
    neck = eb["J_Bip_C_Neck"]
    L = 0.09
    head.use_connect = False
    head.head = V(head_joint)
    head.tail = V(head_joint) + V((0, 0, L))
    neck.tail = V(head_joint)
    head.use_connect = True
    for s in "LR":
        e = eb.new(f"J_Adj_{s}_FaceEye")
        e.head = V(eyes[s])
        e.tail = V(eyes[s]) + V((0, -0.04, 0))
        e.parent = head
        e.use_deform = False
    eb["J_Sec_C_BustRoot"].use_deform = False
    for s in "LR":
        eb[f"J_Sec_{s}_Bust2"].use_deform = False
    obj_mode()


def twist_constraints(arm):
    pb = arm.pose.bones
    out = {}
    for s in "LR":
        # forearm: +50% of the hand's twist about its own long axis
        c = pb[f"J_Adj_{s}_LowerArmTwist"].constraints.new("TRANSFORM")
        c.name = "twist"
        c.target, c.subtarget = arm, f"J_Bip_{s}_Hand"
        c.owner_space = c.target_space = "LOCAL"
        c.map_from = "ROTATION"
        c.from_rotation_mode = "SWING_TWIST_Y"
        c.map_to = "ROTATION"
        c.mix_mode_rot = "REPLACE"
        c.map_to_x_from, c.map_to_y_from, c.map_to_z_from = "X", "Y", "Z"
        c.from_min_y_rot, c.from_max_y_rot = -math.pi, math.pi
        c.to_min_y_rot, c.to_max_y_rot = -math.pi / 2, math.pi / 2
        # upper arm near the shoulder: cancel 50% of the upper arm's own twist
        c = pb[f"J_Adj_{s}_UpperArmTwist"].constraints.new("TRANSFORM")
        c.name = "twist"
        c.target, c.subtarget = arm, f"J_Bip_{s}_UpperArm"
        c.owner_space = c.target_space = "LOCAL"
        c.map_from = "ROTATION"
        c.from_rotation_mode = "SWING_TWIST_Y"
        c.map_to = "ROTATION"
        c.mix_mode_rot = "REPLACE"
        c.from_min_y_rot, c.from_max_y_rot = -math.pi, math.pi
        c.to_min_y_rot, c.to_max_y_rot = math.pi / 2, -math.pi / 2
        out[s] = "forearm +0.5 hand twist; upper arm -0.5 own twist"
    return out


def _weights(ob):
    names = {g.index: g.name for g in ob.vertex_groups}
    return [{names[x.group]: x.weight for x in v.groups if x.weight > 0} for v in ob.data.vertices]


def _blend_in(ob, group, wts, per_vertex):
    """give 'group' weight w on each vertex, scaling the vertex's other weights by (1 - w)"""
    g = ob.vertex_groups.get(group) or ob.vertex_groups.new(name=group)
    idx = {x.name: x.index for x in ob.vertex_groups}
    for i, w in per_vertex.items():
        if w <= 1e-4:
            continue
        for n, x in wts[i].items():
            ob.vertex_groups[idx[n]].add([i], x * (1.0 - w), "REPLACE")
        g.add([i], w, "REPLACE")


# glute and thigh jiggle volumes (final metres): peak weight and kernel width
GLUTE = dict(peak=0.55, sigma=0.060, depth=0.10)
THIGH = dict(peak=0.30, sigma=0.055, at=0.42, depth=0.06)


def soft_tissue_bones(arm, body):
    B = arm.data.bones
    co = np.array([v.co[:] for v in body.data.vertices])
    wts = _weights(body)
    info = {}
    eb = edit(arm)
    specs = {}
    for s, sx in (("L", 1.0), ("R", -1.0)):
        hip = eb[f"J_Bip_{s}_UpperLeg"].head.copy()
        knee = eb[f"J_Bip_{s}_LowerLeg"].head.copy()
        # buttock peak: the most posterior skin point on this side, around the hip joint height
        m = (co[:, 0] * sx > 0.02) & (co[:, 0] * sx < 0.16) & (co[:, 2] > hip.z - 0.16) & (co[:, 2] < hip.z + 0.04)
        k = np.argmax(np.where(m, co[:, 1], -9))
        P = V(co[k])
        b = eb.new(f"J_Sec_{s}_Glute")
        b.head = P - V((0, GLUTE["depth"], 0))
        b.tail = P
        b.parent = eb["J_Bip_C_Hips"]
        specs[b.name] = ("glute", P, f"J_Bip_{s}_UpperLeg", hip)
        # thigh: back-inner surface at 42% hip -> knee
        c = hip.lerp(knee, THIGH["at"])
        m = (np.abs(co[:, 2] - c.z) < 0.012) & (co[:, 0] * sx > 0.0)
        k = np.argmax(np.where(m, co[:, 1] - 0.3 * np.abs(co[:, 0] - c.x), -9))
        Pt = V(co[k])
        b = eb.new(f"J_Sec_{s}_Thigh")
        b.head = V((c.x, c.y, c.z))
        b.tail = Pt
        b.parent = eb[f"J_Bip_{s}_UpperLeg"]
        specs[b.name] = ("thigh", Pt, f"J_Bip_{s}_UpperLeg", hip)
    obj_mode()
    for bn, (kind, P, leg, hip) in specs.items():
        S = GLUTE if kind == "glute" else THIGH
        d2 = ((co - np.array(P[:])) ** 2).sum(1)
        per = {}
        side = 1.0 if "_L_" in bn else -1.0
        for i in np.nonzero(d2 < (3 * S["sigma"]) ** 2)[0]:
            if co[i, 0] * side < -0.005:
                continue
            ws = wts[i]
            if kind == "glute":
                own = ws.get("J_Bip_C_Hips", 0) + ws.get(leg, 0)
                if co[i, 1] < hip.y - 0.01:          # front of the pelvis stays put
                    continue
            else:
                own = ws.get(leg, 0)
                if co[i, 1] < hip.y - 0.03:
                    continue
            if own < 0.5 * sum(ws.values()):
                continue
            per[int(i)] = S["peak"] * math.exp(-0.5 * d2[i] / S["sigma"] ** 2)
        _blend_in(body, bn, wts, per)
        wts = _weights(body)
        info[bn] = {"verts": len(per), "peak": round(max(per.values()), 3) if per else 0,
                    "surface": [round(c, 3) for c in P]}
    return info


def limit_and_normalise(ob, n=4):
    for v in ob.data.vertices:
        gs = sorted([(g.group, g.weight) for g in v.groups], key=lambda g: -g[1])
        i = v.index
        for g, _ in gs[n:] + [x for x in gs[:n] if x[1] <= 0]:
            ob.vertex_groups[g].remove([i])
        keep = [x for x in gs[:n] if x[1] > 0]
        tot = sum(w for _, w in keep)
        if tot > 0:
            for g, w in keep:
                ob.vertex_groups[g].add([i], w / tot, "REPLACE")


# shoulder helper, against the T-pose rig's usual deltoid collapse when an arm is raised (the
# clavicle-weighted skin stays at T-pose width). What first looked like that in n1_contact_r3b
# turned out to be the upper arm crossing the chest end-on (checks/neckcontact_v2.png), so the
# helper is a guard, kept because it is cheap and FK-bake-safe, not a measured fix. It sits
# on the shoulder joint, takes half the upper arm's rotation (Transformation constraint, REPLACE,
# so posing.bake_keys' FK capture cannot double it), and the deltoid blend zone moves onto it.
DELTOID = dict(radius=0.10, sigma=0.05, from_shoulder=0.65, from_arm=0.45, inner=0.035)


def deltoid_helpers(arm, body):
    eb = edit(arm)
    for s in "LR":
        ua = eb[f"J_Bip_{s}_UpperArm"]
        b = eb.new(f"J_Adj_{s}_Deltoid")
        b.head = ua.head.copy()
        b.tail = ua.head + (ua.tail - ua.head).normalized() * 0.08
        b.roll = ua.roll
        b.parent = eb[f"J_Bip_{s}_Shoulder"]
        b.use_deform = True
    obj_mode()
    pb = arm.pose.bones
    for s in "LR":
        c = pb[f"J_Adj_{s}_Deltoid"].constraints.new("TRANSFORM")
        c.name = "half_arm"
        c.target, c.subtarget = arm, f"J_Bip_{s}_UpperArm"
        c.owner_space = c.target_space = "LOCAL"
        c.map_from = "ROTATION"
        c.from_rotation_mode = "XYZ"
        c.map_to = "ROTATION"
        c.to_euler_order = "XYZ"
        c.mix_mode_rot = "REPLACE"
        for ax in "xyz":
            setattr(c, f"from_min_{ax}_rot", -math.pi)
            setattr(c, f"from_max_{ax}_rot", math.pi)
            setattr(c, f"to_min_{ax}_rot", -math.pi / 2)
            setattr(c, f"to_max_{ax}_rot", math.pi / 2)
    co = np.array([v.co[:] for v in body.data.vertices])
    wts = _weights(body)
    info = {}
    for s, sx in (("L", 1.0), ("R", -1.0)):
        J = arm.data.bones[f"J_Bip_{s}_UpperArm"].head_local
        d = np.sqrt(((co - np.array(J[:])) ** 2).sum(1))
        per = {}
        for i in np.nonzero(d < DELTOID["radius"])[0]:
            if co[i, 0] * sx < abs(J.x) - DELTOID["inner"]:
                continue
            ws = wts[i]
            sh = ws.get(f"J_Bip_{s}_Shoulder", 0.0)
            ar = ws.get(f"J_Bip_{s}_UpperArm", 0.0) + ws.get(f"J_Adj_{s}_UpperArmTwist", 0.0)
            f = math.exp(-0.5 * (d[i] / DELTOID["sigma"]) ** 2)
            w = f * (DELTOID["from_shoulder"] * sh + DELTOID["from_arm"] * ar) / max(sum(ws.values()), 1e-6)
            if w > 1e-3:
                per[int(i)] = min(w, 0.8)
        _blend_in(body, f"J_Adj_{s}_Deltoid", wts, per)
        wts = _weights(body)
        info[s] = {"verts": len(per), "peak": round(max(per.values()), 3) if per else 0}
    return info
