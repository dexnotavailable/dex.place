"""Smoke test: bind a Quaternius UAL2 clip onto a VRoid VRM with the Retarget extension, headless.

  tools/pixel-pipeline/blender.sh --python tools/pixel-pipeline/retarget_smoke.py -- \
      [--downloads DIR] [--clip Sword_Regular_C] [--json OUT]

Prints one "RETARGET_SMOKE {json}" line: constraints added to the VRM and, every 10 frames,
how well the VRM's right upper-arm -> hand direction matches the source (dot product, 1.0 =
same direction) plus both hip heights.

Headless calling convention for Retarget 5.2.0 (found here, 2026-09-28):
- "Bind to Active Armature" constrains the SELECTED armature to the ACTIVE one. The animated
  source is active; the rig that should follow (our VRM) is selected. src_preset names the
  preset of the bound (selected) rig, trg_preset the active rig's.
- execute() reads `current_m`, which only invoke() sets. Called from a script (no invoke) it
  is None and the operator crashes, so the class attribute is set first.
- With default options the VRM's hips do not follow the source's hip height (a crouching
  source leaves the VRM standing), yet the bound VRM stays on top of the source in x even when
  its object is moved, so the --render frames overlap the two. The operator also rescales the
  active source rig to fit the target (about 0.91 here). All of this needs configuring in the
  real retarget step.
"""
import json
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def opt(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


DL = opt("--downloads", os.environ.get("DEXPLACE_DOWNLOADS",
                                      r"D:\Dex\Inbox\Downloads\dexplace-character"))
CLIP = opt("--clip", "Sword_Regular_C")
UAL2 = os.path.join(DL, "quaternius", "UAL2_Standard", "Universal Animation Library 2[Standard]",
                    "Unreal-Godot", "UAL2_Standard.glb")
VRM = os.path.join(DL, "vrm", "HairSample_Female.vrm")

scene = bpy.context.scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)
scene.render.fps = 30

bpy.ops.import_scene.vrm(filepath=VRM)
vrm = next(o for o in scene.objects if o.type == "ARMATURE")
before = set(scene.objects)
bpy.ops.import_scene.gltf(filepath=UAL2)
src = next(o for o in scene.objects if o.type == "ARMATURE" and o not in before)
act = bpy.data.actions[CLIP]
src.animation_data.action = act
if len(act.slots):
    src.animation_data.action_slot = act.slots[0]
for t in src.animation_data.nla_tracks:
    t.mute = True

vl = bpy.context.view_layer
for o in scene.objects:
    o.select_set(False)
vrm.select_set(True)
src.select_set(True)
vl.objects.active = src
bpy.types.ARMATURE_OT_retarget_constrain_to_armature.current_m = "OBJECT"
res = bpy.ops.armature.retarget_constrain_to_armature(src_preset="Vroid.py",
                                                      trg_preset="Unreal_Mannequin.py")
bpy.ops.object.mode_set(mode="OBJECT")


def pos(arm, bone):
    return arm.matrix_world @ arm.pose.bones[bone].head


out = {"clip": CLIP, "op_result": sorted(res),
       "vrm_constraints": sum(len(pb.constraints) for pb in vrm.pose.bones), "frames": []}
f0, f1 = map(int, act.frame_range)
for f in range(f0, f1 + 1, 10):
    scene.frame_set(f)
    s_dir = (pos(src, "hand_r") - pos(src, "upperarm_r")).normalized()
    t_dir = (pos(vrm, "J_Bip_R_Hand") - pos(vrm, "J_Bip_R_UpperArm")).normalized()
    out["frames"].append({"f": f, "arm_dir_dot": round(s_dir.dot(t_dir), 3),
                          "hip_z_src_vrm": [round(pos(src, "pelvis").z, 3),
                                            round(pos(vrm, "J_Bip_C_Hips").z, 3)]})
out["min_arm_dir_dot"] = min(fr["arm_dir_dot"] for fr in out["frames"])

if "--render" in argv:  # eyeball check: source (orange) over bound VRM (grey), Workbench, small
    import math
    from mathutils import Vector
    png = opt("--render", "")
    cam_data = bpy.data.cameras.new("smoke_cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 3.4
    cam = bpy.data.objects.new("smoke_cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = Vector((0.0, -6.0, 0.9))
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = 640, 480
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    frames = [int(f0 + (f1 - f0) * t) for t in (0.0, 0.33, 0.66)]
    base, ext = os.path.splitext(png)
    for f in frames:
        scene.frame_set(f)
        scene.render.filepath = f"{base}_f{f:03d}{ext}"
        bpy.ops.render.render(write_still=True)
    out["renders"] = [f"{base}_f{f:03d}{ext}" for f in frames]
print("RETARGET_SMOKE " + json.dumps(out))
if "--json" in argv:
    with open(opt("--json", ""), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
if out["vrm_constraints"] == 0 or out["min_arm_dir_dot"] < 0.95:
    sys.exit(1)
