"""Import BVH files into headless Blender and report what arrived (isolated env, never Dex's prefs).

  python tools/pixel-pipeline/blender_env.py run --factory-startup \
      --python tools/motion-ai/blender_bvh_check.py -- a.bvh [b.bvh ...]

Prints one "BVH_CHECK {json}" line per file: bone count, frame range, scene fps, and the Hips
head position in metres at the first/last frame (Blender imports BVH centimetres x0.01 here).
"""
import json
import sys

import bpy

files = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for path in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_anim.bvh(filepath=path, global_scale=0.01, rotate_mode="NATIVE",
                            update_scene_fps=True, update_scene_duration=True, axis_forward="-Z", axis_up="Y")
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    sc = bpy.context.scene
    act = arm.animation_data.action if arm.animation_data else None
    f0, f1 = (int(v) for v in act.frame_range)
    out = {"file": path, "bones": len(arm.data.bones), "keyed_frames": [f0, f1],
           "fps": sc.render.fps / sc.render.fps_base, "action": act.name}
    for f, key in ((f0, "hips_first_m"), (f1, "hips_last_m")):
        sc.frame_set(f)
        pb = arm.pose.bones["Hips"]
        out[key] = [round(v, 3) for v in (arm.matrix_world @ pb.head)]
    print("BVH_CHECK " + json.dumps(out))
