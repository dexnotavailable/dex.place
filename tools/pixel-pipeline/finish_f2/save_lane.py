"""Save route F2's lane file: the canonical build posed with a pose file and the head scale (runs in Blender, under bl_run.py).

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python tools/pixel-pipeline/finish_f2/bl_run.py -- \
      --head 1.10 --script tools/pixel-pipeline/finish_f2/save_lane.py \
      --blend D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend --pose <pose.json> \
      --save D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F2.blend

The file is for inspection (the head scale lives in the pose-bone scales of that one pose, and the rig's
rosace_height is the refit H; the rig also carries 'f2_head'). Re-posing it resets the scales: renders go through
stills_f2.py, which applies the scale to every pose. Refuses to write anything but lanes/finish-F2*.blend.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rosace import common, posing  # noqa: E402

argv = common.args_after_dashes(sys.argv)
blend, pose, save = common.arg(argv, "--blend"), common.arg(argv, "--pose"), os.path.abspath(common.arg(argv, "--save"))
assert os.path.basename(save).startswith("finish-F2") and os.path.basename(os.path.dirname(save)) == "lanes", \
    "route F2 saves only lanes/finish-F2*.blend"
bpy.ops.wm.open_mainfile(filepath=blend)
meta = posing.apply_pose_file(pose)          # bl_run.py installed the head scale on posing.apply_pose
arm = bpy.data.objects["rosace_rig"]
arm["f2_head"] = meta.get("f2", {}).get("cfg", {}).get("head", 1.0)
bpy.ops.wm.save_as_mainfile(filepath=save, compress=True)
print("F2_SAVED", save, meta.get("f2"))
