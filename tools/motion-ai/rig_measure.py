"""Pose measurements on the Rosace rig (runs inside Blender; import after bpy).

Everything is in her own frame: she faces -Y (the in-game facing; screen-right at camera yaw 60),
+Z up, her left +X, metres, and H = the rig's 'rosace_height' (1.863 m on the 2026-09-29 model).

  stance_m / stance_sw   horizontal ankle-to-ankle distance; SW = outer shoulder width, the
                         upper-arm heads at rest plus one arm-capsule radius per side (0.336 m)
  hips_drop              hips height / rest hips height (1.0 standing, 0.75 = a deep crouch)
  torso_yaw, hips_yaw    how far the chest / pelvis forward vectors turn away from her facing
                         (degrees, + = turned to her left, i.e. back toward the camera at yaw 60)
  separation             torso_yaw - hips_yaw (the hip-shoulder "X-factor")
  lean                   pelvis -> neck base against vertical, + = toward her facing (into a strike)
  line_of_action         rear ankle -> head top against vertical, + = toward her facing
  line_of_action_body    the same in the pelvis's own facing frame (a coil wound away from the target
                         leans over its own front knee, which is "backward" in her facing frame)
  chest_to_cam           chest facing against the camera direction (yaw 60): 0 = chest to camera,
                         180 = back to camera; back three-quarters is about 120-160
  head_down              the head's forward vector below horizontal (+ = looking down)
  knee_gap_over_ankle_gap  knee-to-knee over ankle-to-ankle (horizontal); knock knees pinch it
  tip_vs_heel_H          glaive tip along her facing, minus the rearmost heel (negative = behind)
  tip_behind_hip_H       how far the glaive tip sits behind the pelvis along her facing
  glaive_pitch           haft elevation above horizontal (butt -> tip), degrees
  hand_gap_cm            each gripping hand's grip point to the haft's centre line
  ankle_ik_cm            ankle bone head vs its IK target (a planted foot that can't reach)
"""
import math

from mathutils import Vector

V = Vector
SW_OUT = 0.336          # outer shoulder width, metres (0.246 joint-to-joint + 2 x 0.045 arm capsule)
FACING = V((0.0, -1.0, 0.0))
CAM_YAW = 60.0          # the motion view (render.camera_frame): camera on her right-front


def _hdir(v):
    h = V((v.x, v.y, 0.0))
    return h.normalized() if h.length > 1e-6 else V((0, -1, 0))


def _yaw_from_facing(fwd):
    """signed yaw of a horizontal forward vector against her facing (-Y); + = toward her left (+X)"""
    h = _hdir(fwd)
    return math.degrees(math.atan2(h.x, -h.y))


def grip_point(arm, s):
    pbs = arm.pose.bones
    b = arm.data.bones[f"J_Bip_{s}_Hand"]
    fx = 1.0 if s == "L" else -1.0
    grip0 = b.head_local + V((fx, 0, 0)) * 0.048 + V((0, 0, -1)) * 0.026
    M = pbs[f"J_Bip_{s}_Hand"].matrix @ b.matrix_local.inverted()
    return M @ grip0


def measure(arm, grips=("R", "L"), ground=None):
    """one pose's numbers (armature space; the armature object sits at the origin, unrotated)"""
    pbs = arm.pose.bones
    bones = arm.data.bones
    H = float(arm.get("rosace_height", 1.8634))
    off = ground or V((0, 0, 0))
    out = {}
    an = {s: pbs[f"J_Bip_{s}_Foot"].head.copy() for s in "LR"}
    d = an["L"] - an["R"]
    out["stance_m"] = round(math.hypot(d.x, d.y), 3)
    out["stance_sw"] = round(out["stance_m"] / SW_OUT, 2)
    out["stance_H"] = round(out["stance_m"] / H, 3)
    hips = pbs["J_Bip_C_Hips"]
    out["hips_drop"] = round(hips.head.z / bones["J_Bip_C_Hips"].head_local.z, 3)

    def fwd_of(name):
        pb = pbs[name]
        M = pb.matrix.to_3x3() @ bones[name].matrix_local.to_3x3().inverted()
        return M @ V((0, -1, 0))
    out["torso_yaw"] = round(_yaw_from_facing(fwd_of("J_Bip_C_UpperChest")), 1)
    out["hips_yaw"] = round(_yaw_from_facing(fwd_of("J_Bip_C_Hips")), 1)
    sep = (out["torso_yaw"] - out["hips_yaw"] + 180.0) % 360.0 - 180.0
    out["separation"] = round(sep, 1)
    # the torso's turn away from her facing, unwrapped through the pelvis (a coil wound past 180
    # reads as e.g. -246, not +114)
    out["torso_twist"] = round(out["hips_yaw"] + sep, 1)
    sp = pbs["J_Bip_C_Neck"].head - hips.head
    out["lean"] = round(math.degrees(math.atan2(sp.dot(FACING), sp.z)), 1)
    heel = {s: pbs[f"J_Bip_{s}_Foot"].head for s in "LR"}
    rear = min("LR", key=lambda s: heel[s].dot(FACING))
    top = pbs["J_Bip_C_Head"].tail
    la = top - heel[rear]
    out["line_of_action"] = round(math.degrees(math.atan2(la.dot(FACING), la.z)), 1)
    # round 3: the same line in the PELVIS's own frame (a coil wound away from the target leans
    # over its own front knee, which is "backward" in her facing frame)
    pf = _hdir(fwd_of("J_Bip_C_Hips"))
    rear_b = min("LR", key=lambda s: heel[s].dot(pf))
    lb = top - heel[rear_b]
    out["line_of_action_body"] = round(math.degrees(math.atan2(lb.dot(pf), lb.z)), 1)
    # chest facing against the camera direction (camera yaw CAM_YAW): 0 = chest to camera,
    # 180 = back to camera; back three-quarters is about 120-160
    cy = math.radians(CAM_YAW)
    cam_dir = V((-math.sin(cy), -math.cos(cy), 0.0))
    cf = _hdir(fwd_of("J_Bip_C_UpperChest"))
    out["chest_to_cam"] = round(math.degrees(math.acos(max(-1, min(1, cf.dot(cam_dir))))), 1)
    # head pitch: + = looking down (the head's forward vector below horizontal)
    hf = fwd_of("J_Bip_C_Head").normalized()
    out["head_down"] = round(math.degrees(math.asin(max(-1, min(1, -hf.z)))), 1)
    # knee spread: knee-to-knee over ankle-to-ankle (horizontal). Knock-kneed legs pinch the knees
    # together (well under 0.5 on a wide stance); a toe-direction check was tried and dropped: the VRoid
    # foot bone does not point along the toes, so its angle was meaningless
    kn = {s: pbs[f"J_Bip_{s}_LowerLeg"].head for s in "LR"}
    dk = kn["L"] - kn["R"]
    out["knee_gap_over_ankle_gap"] = round(math.hypot(dk.x, dk.y) / max(1e-3, out["stance_m"]), 2)
    out["head_top"] = [round(x, 3) for x in top]
    if "glaive" in pbs:
        G = arm["glaive"]
        g = pbs["glaive"]
        dvec = (g.tail - g.head).normalized()
        butt = g.head - dvec * G["grips"]["grip_main"]
        tip = butt + dvec * G["length"]
        out["tip_vs_heel_H"] = round((tip.dot(FACING) - heel[rear].dot(FACING)) / H, 3)
        out["tip_behind_hip_H"] = round(-(tip - hips.head).dot(FACING) / H, 3)
        out["tip_height_H"] = round(tip.z / H, 3)
        out["glaive_pitch"] = round(math.degrees(math.asin(max(-1, min(1, dvec.z)))), 1)
        gaps = {}
        for s in grips:
            gp = grip_point(arm, s)
            o = gp - butt
            gaps[s] = round((o - dvec * o.dot(dvec)).length * 100, 2)
        out["hand_gap_cm"] = gaps
        reach = {}
        for s in grips:
            sh = pbs[f"J_Bip_{s}_UpperArm"].head
            tgt = pbs[f"ik_hand.{s}"].head
            L = bones[f"J_Bip_{s}_UpperArm"].length + bones[f"J_Bip_{s}_LowerArm"].length
            reach[s] = {"need": round((tgt - sh).length / L, 2), "to_target": [round(x, 2) for x in (tgt - sh)]}
        out["arm_reach"] = reach
        out["tip"] = [round(x, 3) for x in tip]
        out["butt"] = [round(x, 3) for x in butt]
    ik = {}
    for s in "LR":
        c = pbs[f"J_Bip_{s}_LowerLeg"].constraints.get("ik")
        if c is not None and not c.mute and c.influence > 0.99:
            ik[s] = round((pbs[f"J_Bip_{s}_Foot"].head - pbs[f"ik_foot.{s}"].head).length * 100, 2)
    out["ankle_ik_cm"] = ik
    out["ankles"] = {s: [round(x, 3) for x in an[s] + off] for s in "LR"}
    return out
