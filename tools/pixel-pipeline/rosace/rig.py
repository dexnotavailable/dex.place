"""Rig additions on top of the VRM humanoid armature.

The J_Bip_* humanoid bones and the VRM humanoid mapping are kept untouched, so SMPL /
Quaternius / Mesh2Motion / CMU motion can be retargeted with the Retarget add-on's VRoid
preset later. Added here (all prefixed so they never collide with the humanoid set):
  * secondary chains: hair, sidelocks, veil, sleeves, tabard, stole, charms (chain_*)
  * weapon: 'glaive' bone (root at the main grip) with socket bones 'grip_main', 'grip_off',
    'glaive_tip', 'glaive_butt'
  * IK: hand targets 'ik_hand.L/R' + poles, foot targets 'ik_foot.L/R' + poles. Constraints
    exist but are muted in the rest file; posing.py enables them per pose.
"""
import math

import bpy
from mathutils import Matrix, Vector

V = Vector
CHAINS = {}          # chain name -> list of bone names (filled while building)


def edit(arm):
    bpy.context.view_layer.objects.active = arm
    if bpy.context.mode != "EDIT_ARMATURE":
        bpy.ops.object.mode_set(mode="EDIT")
    return arm.data.edit_bones


def obj_mode():
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def add_chain(arm, name, pts, parent, deform=True, roll_ref=None):
    """Bones name_1..n along pts (n+1 points). Returns bone names."""
    eb = edit(arm)
    names = []
    prev = parent
    for i in range(len(pts) - 1):
        bn = f"{name}_{i + 1}"
        b = eb.get(bn) or eb.new(bn)
        b.head, b.tail = V(pts[i]), V(pts[i + 1])
        if roll_ref is not None:
            b.align_roll(V(roll_ref))
        b.use_deform = deform
        b.parent = eb[prev] if prev else None
        b.use_connect = i > 0
        names.append(bn)
        prev = bn
    obj_mode()
    CHAINS[name] = names
    arm.data["chains"] = {k: v for k, v in CHAINS.items()}
    return names


def add_bone(arm, name, head, tail, parent=None, deform=False, roll_ref=None):
    eb = edit(arm)
    b = eb.get(name) or eb.new(name)
    b.head, b.tail = V(head), V(tail)
    if roll_ref is not None:
        b.align_roll(V(roll_ref))
    b.use_deform = deform
    b.parent = eb[parent] if parent else None
    obj_mode()
    return name


def add_bone_like(arm, name, like, parent=None, length=None):
    """New bone with the same head, direction and roll as 'like' (so copy-rotation is identity)."""
    eb = edit(arm)
    src = eb[like]
    b = eb.get(name) or eb.new(name)
    b.head, b.tail, b.roll = src.head.copy(), src.tail.copy(), src.roll
    if length:
        b.length = length
    b.use_deform = False
    b.parent = eb[parent] if parent else None
    obj_mode()
    return name


def bone_head(arm, name):
    return arm.data.bones[name].head_local.copy()


def bone_tail(arm, name):
    return arm.data.bones[name].tail_local.copy()


def _pole_angle(arm, base, tip, pole):
    b0, b1 = arm.data.bones[base], arm.data.bones[tip]
    p = arm.data.bones[pole].head_local
    x0 = b0.matrix_local.to_3x3().col[0]
    axis = b1.tail_local - b0.head_local
    pn = axis.cross(p - b0.head_local)
    proj = pn.cross(b0.tail_local - b0.head_local)

    def signed(v1, v2, n):
        a = v1.angle(v2)
        return -a if v1.cross(v2).dot(n) < 0 else a
    return signed(x0, proj, b0.tail_local - b0.head_local)


def setup_ik(arm):
    """IK targets for hands and feet (root-parented), poles, muted by default."""
    B = arm.data.bones
    pos = {s: {"lo": B[f"J_Bip_{s}_LowerArm"].head_local.copy(),
               "knee": B[f"J_Bip_{s}_LowerLeg"].head_local.copy()} for s in "LR"}
    for s in "LR":
        add_bone_like(arm, f"ik_hand.{s}", f"J_Bip_{s}_Hand", "Root", length=0.06)
        lo = pos[s]["lo"]
        add_bone(arm, f"pole_arm.{s}", lo + V((0, 0.35, 0)), lo + V((0, 0.42, 0)), "J_Bip_C_Chest")
        add_bone_like(arm, f"ik_foot.{s}", f"J_Bip_{s}_Foot", "Root")
        kn = pos[s]["knee"]
        add_bone(arm, f"pole_leg.{s}", kn + V((0, -0.5, 0)), kn + V((0, -0.56, 0)), f"ik_foot.{s}")
    pb = arm.pose.bones
    for s in "LR":
        c = pb[f"J_Bip_{s}_LowerArm"].constraints.new("IK")
        c.name = "ik"
        c.target, c.subtarget = arm, f"ik_hand.{s}"
        c.pole_target, c.pole_subtarget = arm, f"pole_arm.{s}"
        c.pole_angle = _pole_angle(arm, f"J_Bip_{s}_UpperArm", f"J_Bip_{s}_LowerArm", f"pole_arm.{s}")
        c.chain_count = 2
        c.mute = True
        c = pb[f"J_Bip_{s}_Hand"].constraints.new("COPY_ROTATION")
        c.name = "ik_rot"
        c.target, c.subtarget = arm, f"ik_hand.{s}"
        c.mute = True
        c = pb[f"J_Bip_{s}_LowerLeg"].constraints.new("IK")
        c.name = "ik"
        c.target, c.subtarget = arm, f"ik_foot.{s}"
        c.pole_target, c.pole_subtarget = arm, f"pole_leg.{s}"
        c.pole_angle = _pole_angle(arm, f"J_Bip_{s}_UpperLeg", f"J_Bip_{s}_LowerLeg", f"pole_leg.{s}")
        c.chain_count = 2
        c.mute = True
        c = pb[f"J_Bip_{s}_Foot"].constraints.new("COPY_ROTATION")
        c.name = "ik_rot"
        c.target, c.subtarget = arm, f"ik_foot.{s}"
        c.mute = True


def calibrate_poles(arm):
    """Measure each IK chain's pole angle instead of trusting a formula (the VRoid bone rolls
    differ per bone): with the target at rest, find the pole angle for which the solved chain
    keeps its rest twist. Tries candidates and keeps the one with the smallest deviation."""
    pb = arm.pose.bones
    for s in "LR":
        for tip, base in ((f"J_Bip_{s}_LowerLeg", f"J_Bip_{s}_UpperLeg"), (f"J_Bip_{s}_LowerArm", f"J_Bip_{s}_UpperArm")):
            c = pb[tip].constraints["ik"]
            c.mute = False
            best = None
            for deg in range(-180, 180, 5):
                c.pole_angle = math.radians(deg)
                bpy.context.view_layer.update()
                dev = 0.0
                for bn in (base, tip):
                    q = pb[bn].matrix.to_quaternion().rotation_difference(
                        arm.data.bones[bn].matrix_local.to_quaternion())
                    dev += abs(q.angle)
                if best is None or dev < best[0]:
                    best = (dev, deg)
            # refine
            lo = best[1]
            for deg10 in range((lo - 5) * 10, (lo + 5) * 10):
                c.pole_angle = math.radians(deg10 / 10)
                bpy.context.view_layer.update()
                dev = sum(abs(pb[bn].matrix.to_quaternion().rotation_difference(
                    arm.data.bones[bn].matrix_local.to_quaternion()).angle) for bn in (base, tip))
                if dev < best[0]:
                    best = (dev, deg10 / 10)
            c.pole_angle = math.radians(best[1])
            c.mute = True
            print("pole", tip, best[1], "residual", round(best[0], 4))
    bpy.context.view_layer.update()


def finish(arm, parts):
    # the VRM rig connects Hips to Root; a connected bone ignores translation, and the pelvis
    # has to drop and shift independently of the root (squats, lunges, weight shifts)
    eb = edit(arm)
    eb["J_Bip_C_Hips"].use_connect = False
    obj_mode()
    setup_ik(arm)
    calibrate_poles(arm)
    for p in arm.pose.bones:
        p.rotation_mode = "QUATERNION"
    arm.data.display_type = "STICK"
    arm.show_in_front = True
