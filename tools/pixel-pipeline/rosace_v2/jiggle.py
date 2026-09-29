"""Soft-tissue jiggle: damped springs on the bust, glute and thigh bones (runs inside Blender).

Same model as the motion lane's spring cloth (tools/motion-ai/hero_layer.py simulate): each bone's
tip is a damped spring, a = omega^2 (target - x) - 2 zeta omega v, with omega in radians per
60 fps frame, stepped in armature space with substeps and a length constraint about the bone's
head. The difference is the target: cloth springs toward the drawing's drape, soft tissue toward
where the tip would be if it were rigid with its parent (its rest shape carried by the body). So
a still pose shows the sculpted rest shape exactly, and motion adds lag, overshoot and settle.

Settings are stored on the rig (arm.data['jiggle']) so render and motion scripts read them from
the .blend. They are deliberately NOT in arm.data['chains']: posing.drape and the cloth sim
treat those as hanging cloth (gravity, body-capsule pushes), which soft tissue must not get.

Usage after a sequence is keyed (e.g. posing.bake_keys or the motion lane's set_state loop):
    from rosace_v2 import jiggle
    jiggle.bake(arm, frame_start, frame_end)     # keys the jiggle bones' rotations
"""
import math

import bpy
from mathutils import Quaternion, Vector

V = Vector

# omega (rad per 60 fps frame), zeta, max swing (deg). Tuned on the drop-and-stop and run-bob
# test in check_rosace_v2.py (review/rosace/base-v2/assemble/jiggle/): the bust shows two
# visible overshoots and settles in about half a second, the glutes one, the thighs only firm up.
JIGGLE = {
    "bust_L": {"bones": ["J_Sec_L_Bust1"], "omega": 0.42, "zeta": 0.22, "max_deg": 18.0},
    "bust_R": {"bones": ["J_Sec_R_Bust1"], "omega": 0.42, "zeta": 0.22, "max_deg": 18.0},
    "glute_L": {"bones": ["J_Sec_L_Glute"], "omega": 0.55, "zeta": 0.30, "max_deg": 12.0},
    "glute_R": {"bones": ["J_Sec_R_Glute"], "omega": 0.55, "zeta": 0.30, "max_deg": 12.0},
    "thigh_L": {"bones": ["J_Sec_L_Thigh"], "omega": 0.80, "zeta": 0.45, "max_deg": 6.0},
    "thigh_R": {"bones": ["J_Sec_R_Thigh"], "omega": 0.80, "zeta": 0.45, "max_deg": 6.0},
}


def register(arm, spec=JIGGLE):
    arm.data["jiggle"] = spec
    for c in spec.values():
        for n in c["bones"]:
            arm.pose.bones[n].rotation_mode = "QUATERNION"


def settings(arm):
    j = arm.data.get("jiggle")
    return {k: v.to_dict() if hasattr(v, "to_dict") else v for k, v in j.items()} if j else JIGGLE


def _clear(arm, spec):
    ad = arm.animation_data
    names = {n for c in spec.values() for n in c["bones"]}
    if ad and ad.action:
        for fc in list(ad.action.fcurves):
            if any(f'"{n}"' in fc.data_path for n in names):
                ad.action.fcurves.remove(fc)
    for n in names:
        arm.pose.bones[n].rotation_quaternion = Quaternion()


def simulate(arm, frames, substeps=4, warm=30, spec=None):
    """returns {frame: {bone: (tip, target, head)}} in armature space"""
    spec = spec or settings(arm)
    _clear(arm, spec)
    sc = bpy.context.scene
    pb = arm.pose.bones
    state, out = {}, {}
    for fi, f in enumerate(frames):
        sc.frame_set(f)
        rec = {}
        for c in spec.values():
            om, ze = c["omega"], c["zeta"]
            lim = math.radians(c["max_deg"])
            for n in c["bones"]:
                b = pb[n]
                head, tgt = b.head.copy(), b.tail.copy()
                L = (tgt - head).length
                if n not in state:
                    state[n] = {"x": tgt.copy(), "v": V((0, 0, 0))}
                st = state[n]
                for _ in range(warm if fi == 0 else 1):
                    for _k in range(substeps):
                        dt = 1.0 / substeps
                        a = (tgt - st["x"]) * (om * om) - st["v"] * (2 * ze * om)
                        st["v"] = st["v"] + a * dt
                        x = st["x"] + st["v"] * dt
                        r = (x - head)
                        r = r.normalized() if r.length > 1e-9 else (tgt - head).normalized()
                        d0 = (tgt - head).normalized()
                        ang = d0.angle(r) if r.dot(d0) < 0.9999999 else 0.0
                        if ang > lim:          # clamp the swing; kill the outward velocity
                            axis = d0.cross(r).normalized()
                            r = Quaternion(axis, lim) @ d0
                            st["v"] = st["v"] - r * st["v"].dot(r)
                        x = head + r * L
                        st["v"] = st["v"] - r * st["v"].dot(r)
                        st["x"] = x
                rec[n] = (st["x"].copy(), tgt, head)
        out[f] = rec
    return out


def pose_from(arm, rec):
    """rotate each jiggle bone (in its own frame) so its tail sits on the simulated tip"""
    pb = arm.pose.bones
    for n, (x, tgt, head) in rec.items():
        b = pb[n]
        q = (tgt - head).normalized().rotation_difference((x - head).normalized())
        M = b.matrix.to_3x3().normalized()        # pose orientation with zero own rotation
        b.rotation_quaternion = (M.inverted() @ q.to_matrix() @ M).to_quaternion()


def bake(arm, frame_start, frame_end, **kw):
    frames = list(range(frame_start, frame_end + 1))
    sim = simulate(arm, frames, **kw)
    sc = bpy.context.scene
    for f in frames:
        sc.frame_set(f)
        for n in sim[f]:
            arm.pose.bones[n].rotation_quaternion = Quaternion()
        bpy.context.view_layer.update()
        pose_from(arm, sim[f])
        for n in sim[f]:
            arm.pose.bones[n].keyframe_insert("rotation_quaternion", frame=f)
    return sim
