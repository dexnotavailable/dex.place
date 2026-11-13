"""Shading lane: make the lane's own .blend from the canonical one (runs inside Blender).

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python \
      tools/pixel-pipeline/rosace_shade_lane.py -- \
      [--src D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend] \
      [--out D:/Dex/Projects/dex-place-art/rosace/build/lanes/shading.blend]

Opens the canonical rosace.blend read-only, rebuilds every palette material with the current
rosace/materials.py (which adds the continuous 'light' pass the shading stage re-bands), and saves
the result as the lane file. Geometry, rig, weights and the scene's palette overrides are the
canonical file's, untouched, so the other lanes' parts come through exactly. It refuses to write
rosace.blend or rosace_v1.blend: only the Integrate step writes the canonical file.

Round 2: it also writes a FACE-domain float attribute 'limb' on every armature-deformed mesh: the
limb (LIMBS below) whose bones carry most of the face's vertex weight. materials.py writes it into
the depth2 pass's B channel, so rosace_shade.py can give each thigh, shin, arm, bust and glute its
own terminator (one designed edge per form) in any pose, instead of one quantile over the whole
body skin (round 1's vertical stripes down the thighs).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from rosace import common, materials  # noqa: E402

argv = common.args_after_dashes(sys.argv)
SRC = os.path.abspath(common.arg(argv, "--src", os.path.join(common.BUILD, "rosace.blend")))
OUT = os.path.abspath(common.arg(argv, "--out", os.path.join(common.BUILD, "lanes", "shading.blend")))
assert os.path.basename(OUT) not in ("rosace.blend", "rosace_v1.blend", "rosace_v2.blend"), \
    f"the shading lane never writes {os.path.basename(OUT)}"
assert os.path.abspath(SRC) != OUT

from rosace_v2.limbs import LIMBS, limb_of, write_limbs  # noqa: E402,F401  (moved at the Integrate step)


bpy.ops.wm.open_mainfile(filepath=SRC)
n_limb = write_limbs()
materials.PAL = None
materials.make_all()
n_light = sum(1 for m in bpy.data.materials if m.use_nodes and m.node_tree.nodes.get("pass_light"))
bpy.context.scene["rosace_shading_lane"] = {"src": SRC, "light_pass": 1, "limb_pass": 1}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT, copy=True)
print("LANE", OUT, "materials with a light pass:", n_light, "meshes with a limb attribute:", n_limb)
