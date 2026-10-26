"""Glaive-hands lane: render a still from a lane build and record the grip landmarks (runs in Blender).

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python tools/art-construct/gh_render.py -- \
      --blend D:/Dex/Projects/dex-place-art/rosace/build/lanes/glaive-hands.blend \
      --pose art/rosace/hands/poses/idle_hero.json --px 144,80 --ss 4 --out <dir> [--thong black]

The same passes, meta.json and anchors as tools/pixel-pipeline/render_rosace.py (so rosace_post.py
and overrides.py work unchanged), plus <out>/px<N>/landmarks.json for the hand constructor
(tools/pixel-pipeline/author_hands.py) and the checker adapter (gh_check.py):
  joints     shoulder / elbow / wrist / hand / hip / knee / ankle per side, pit_neck, pelvis_c, head,
             each [x, y] in sprite pixels (render px / ss) plus 'near' = the side nearer the camera
  haft       butt, tip, disc centre, and the disc's facing (dot with the camera; 1 = face-on)
  grips      per hand: the 3D grip point of the closed hand (posing.hand_rest's grip0 carried by the
             posed hand), the socket target it was sent to, the 3D gap in cm, and the back-of-hand
             facing (dot with the camera: > 0 = the back of the hand shows)
Nothing here writes a .blend; the lane build is read-only.
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.join(os.path.dirname(HERE), "pixel-pipeline")
sys.path.insert(0, PIPE)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

from rosace import common, materials, posing, render  # noqa: E402

V = Vector
argv = common.args_after_dashes(sys.argv)
BLEND = common.arg(argv, "--blend")
POSE = common.arg(argv, "--pose")
PXS = [int(x) for x in common.arg(argv, "--px", "144,80").split(",")]
SS = common.arg(argv, "--ss", 4, int)
OUT = common.arg(argv, "--out")
PASSES = common.arg(argv, "--passes", "beauty,albedo,id,normal,depth").split(",")
THONG = common.arg(argv, "--thong", None)


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:12]


def landmarks(sc, P):
    arm = posing.arm_obj()
    pb = arm.pose.bones
    M = arm.matrix_world
    cam = sc.camera
    back = (cam.matrix_world.to_3x3() @ V((0, 0, 1))).normalized()

    def pr(p):
        x, y, z = render.project(sc, M @ p)
        return [round(x / SS, 3), round(y / SS, 3)]

    def depth(p):
        return (M @ p).dot(back)
    J = {}
    for s in "LR":
        J[f"shoulder_{s}"] = pr(pb[f"J_Bip_{s}_UpperArm"].head)
        J[f"elbow_{s}"] = pr(pb[f"J_Bip_{s}_LowerArm"].head)
        J[f"wrist_{s}"] = pr(pb[f"J_Bip_{s}_Hand"].head)
        tip = pb.get(f"J_Bip_{s}_Middle3") or pb[f"J_Bip_{s}_Hand"]
        J[f"hand_{s}"] = pr(tip.tail)
        J[f"hip_{s}"] = pr(pb[f"J_Bip_{s}_UpperLeg"].head)
        J[f"knee_{s}"] = pr(pb[f"J_Bip_{s}_LowerLeg"].head)
        J[f"ankle_{s}"] = pr(pb[f"J_Bip_{s}_Foot"].head)
    J["pit_neck"] = pr(pb["J_Bip_C_Neck"].head)
    J["pelvis_c"] = pr(pb["J_Bip_C_Hips"].head)
    J["head"] = pr(pb["J_Bip_C_Head"].head)
    J["chest"] = pr(pb["J_Bip_C_UpperChest"].head)
    # near side = the shoulder nearer the camera
    near = "L" if depth(pb["J_Bip_L_UpperArm"].head) > depth(pb["J_Bip_R_UpperArm"].head) else "R"
    J3 = {k: [round(v, 3) for v in (M @ pb[b].head)] for k, b in
          (("shoulder_L", "J_Bip_L_UpperArm"), ("shoulder_R", "J_Bip_R_UpperArm"), ("hip_L", "J_Bip_L_UpperLeg"),
           ("hip_R", "J_Bip_R_UpperLeg"), ("pelvis_c", "J_Bip_C_Hips"), ("chest", "J_Bip_C_UpperChest"))}
    out = {"joints": J, "joints3d": J3, "near": near, "far": "R" if near == "L" else "L", "ss": SS}
    if "glaive" in pb:
        G = arm["glaive"]
        g = pb["glaive"]
        d = (g.tail - g.head).normalized()
        butt = g.head - d * G["grips"]["grip_main"]
        tip = butt + d * G["length"]
        disc = butt + d * G["disc_c"]
        # disc normal: the bone's rest frame carries weapon -Y (the flats); pose rotation applies it
        Rm = (g.matrix.to_3x3() @ g.bone.matrix_local.to_3x3().inverted())
        # weapon space flats face +/-Y; build() rotated weapon space by -90 deg about Z into rest
        n_rest = V((1, 0, 0))
        n = (M.to_3x3() @ Rm @ n_rest).normalized()
        out["haft"] = {"butt": pr(butt), "tip": pr(tip), "disc": pr(disc), "disc_facing": round(abs(n.dot(back)), 3),
                       "blade_base": pr(butt + d * G["blade_base"]), "style": G.get("style", "r4"),
                       "length_px": round(((V(pr(tip)) - V(pr(butt))).length), 2),
                       "sockets": {k: pr(butt + d * v) for k, v in G["grips"].items()}}
        grips = {}
        for s, h in P.get("hands", {}).items():
            if "grip" not in h:
                continue
            Mrest, head0, fdir0, palm0, grip0 = posing.hand_rest(arm, s)
            hb = pb[f"J_Bip_{s}_Hand"]
            Mp = hb.matrix @ hb.bone.matrix_local.inverted()
            gp = Mp @ grip0
            sock = h["grip"]
            target = butt + d * (G["grips"][sock] if sock in G["grips"] else 0.0) + d * h.get("slide", 0.0)
            # back of the hand: the rest palm is -Z, so the back is +Z carried by the hand
            bk = (M.to_3x3() @ Mp.to_3x3() @ V((0, 0, 1))).normalized()
            thumb_dir = d if h.get("thumb", "tip") == "tip" else -d
            # reach: the arm's length to the grip point and the haft point nearest the shoulder
            sh_ = pb[f"J_Bip_{s}_UpperArm"].head
            reach = ((pb[f"J_Bip_{s}_UpperArm"].bone.length + pb[f"J_Bip_{s}_LowerArm"].bone.length) +
                     (grip0 - head0).length)
            s_near = (sh_ - butt).dot(d)
            s_tgt = (target - butt).dot(d)
            grips[s] = {"point": pr(gp), "target": pr(target), "gap_cm": round((gp - target).length * 100, 2),
                        "reach_m": round(reach, 3), "shoulder_to_target_m": round((target - sh_).length, 3),
                        "nearest_slide_m": round(s_near - s_tgt, 3),
                        "nearest_dist_m": round((butt + d * s_near - sh_).length, 3),
                        "shoulder_3d": [round(v, 3) for v in (M @ sh_)],
                        "back_facing": round(bk.dot(back), 3), "thumb": h.get("thumb", "tip"),
                        "thumb_screen": pr(target + thumb_dir * 0.05)}
        out["grips"] = grips
    return out


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    P = json.load(open(POSE, encoding="utf-8"))
    pm = posing.apply_pose(P)
    yaw = pm.get("camera", {}).get("yaw", 60.0)
    elev = pm.get("camera", {}).get("elev", 10.0)
    if THONG:
        from rosace import outfit
        outfit.set_thong_variant(THONG)
    bpy.context.view_layer.update()
    for px in PXS:
        shot = render.setup_shot(sc, px, yaw=yaw, elev=elev, ss=SS)
        out = os.path.join(OUT, f"px{px}")
        render.render_passes(sc, out, PASSES)
        an = posing.anchors(sc, px)
        render.write_meta(os.path.join(out, "meta.json"), shot,
                          {"pose": pm.get("name"), "expression": pm.get("expression"), "pose_sha1": sha(POSE),
                           "pose_file": os.path.abspath(POSE), "passes": PASSES, "anchors": an, "frames": None,
                           "thong": THONG, "lane": "glaive-hands"})
        lm = landmarks(sc, P)
        lm["canvas"] = shot["canvas"]
        with open(os.path.join(out, "landmarks.json"), "w") as f:
            json.dump(lm, f, indent=1)
        print("RENDERED", out, shot["canvas"], "gaps", {s: g["gap_cm"] for s, g in lm.get("grips", {}).items()},
              "disc_facing", lm.get("haft", {}).get("disc_facing"))


main()
