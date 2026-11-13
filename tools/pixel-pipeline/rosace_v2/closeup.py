"""Hi-res close-ups of the dressed model with every part visible (runs inside Blender; read-only).

  blender_env.py run --python tools/pixel-pipeline/rosace_v2/closeup.py -- --blend <.blend> --out <dir>
      [--pose art/rosace/poses/idle_hero.json] --shots name:yaw:elev:cx,cy,cz:size[;name:...]
      [--res 700]

cx,cy,cz is the frame centre in metres in the posed armature's world frame, or a bone name
(e.g. J_Bip_C_Head) whose posed head is the centre; size is the ortho frame (m). Uses the
pipeline's toon materials, camera frame and key light (rosace/render.py), so what shows here is
what the stills render, only bigger. Pose files go through tools/motion-ai/hero_layer.resolve
first (motion poses use its conveniences), as check_rosace_v2.py does.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, PIPE)
sys.path.insert(0, os.path.join(REPO, "tools", "motion-ai"))

import bpy  # noqa: E402
from mathutils import Vector as V  # noqa: E402

from rosace import common, materials, posing, render  # noqa: E402

argv = common.args_after_dashes(sys.argv)
BLEND = common.arg(argv, "--blend")
OUT = common.arg(argv, "--out")
POSE = common.arg(argv, "--pose", None)
SHOTS = common.arg(argv, "--shots", "")
RES = common.arg(argv, "--res", 700, int)
HIDE = [h for h in common.arg(argv, "--hide", "").split(",") if h]
THONG = common.arg(argv, "--thong", None)


def main():
    assert os.path.isabs(OUT), "absolute --out only"
    bpy.ops.wm.open_mainfile(filepath=BLEND, load_ui=False)
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    materials.set_pass("beauty")
    arm = bpy.data.objects["rosace_rig"]
    if POSE:
        import hero_layer
        P = hero_layer.resolve(json.load(open(POSE, encoding="utf-8")))
        for k in [k for k in P.get("bones", {}) if k.split(".")[0] not in arm.pose.bones]:
            P["bones"].pop(k)
        posing.apply_pose(P)
        posing.update()
    if THONG:
        from rosace import outfit
        outfit.set_thong_variant(THONG)
    for o in sc.objects:
        if o.type == "MESH" and any(o.name.startswith(h) or o.get("part") == h for h in HIDE):
            o.hide_render = True
    cam, sun = render.ensure_camera(sc)
    os.makedirs(OUT, exist_ok=True)
    for spec in [s for s in SHOTS.split(";") if s]:
        name, yaw, elev, c, size = spec.split(":")
        if c in arm.pose.bones:
            ctr = arm.matrix_world @ arm.pose.bones[c].head
        else:
            ctr = V([float(x) for x in c.split(",")])
        back, right, up, fwd = render.camera_frame(float(yaw), float(elev))
        cam.location = ctr + back * render.CAM_DIST
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = fwd.to_track_quat("-Z", "Y")
        cam.data.ortho_scale = float(size)
        cam.data.clip_end = render.CAM_DIST * 2 + 10
        sc.render.resolution_x = sc.render.resolution_y = RES
        L = render.LIGHT_CAM
        d = (right * L.x + up * L.y + back * L.z).normalized()
        sun.rotation_mode = "QUATERNION"
        sun.rotation_quaternion = (-d).to_track_quat("-Z", "Y")
        materials.set_spec_half((L + V((0, 0, 1))).normalized())
        materials.set_depth_range(render.CAM_DIST - 3.0, render.CAM_DIST + 3.0)
        sc.render.filepath = os.path.join(OUT, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print("SHOT", sc.render.filepath)


main()
