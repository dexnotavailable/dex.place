"""Route F3: build one variant to a lane file (runs inside Blender, one process at a time).

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 \
      --python tools/pixel-pipeline/finish_f3/bl_build.py -- --variant B \
      [--out D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F3_B.blend]

It installs the variant's overrides (finish_f3/overrides.py) and then runs build_rosace_v2.py
unchanged with --out set to the lane file, so the build is the integrated canonical build
(art/rosace/integrated.json 'build': outfit R2Q, glaive l5, hair r2f, limbs, waist pinch) plus F3's
cloth and hair. The bust is art/rosace/figure/shape.json's 'current' (read-only through
figure_shape.variant_params, the applier build_rosace_v2 already calls). Never writes rosace.blend.
"""
import json
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
sys.path.insert(0, PIPE)
sys.path.insert(0, HERE)

from rosace import common  # noqa: E402

argv = common.args_after_dashes(sys.argv)
VARIANT = common.arg(argv, "--variant", "control")
LANES = os.path.join(common.BUILD, "lanes")
OUT = os.path.abspath(common.arg(argv, "--out", os.path.join(LANES, f"finish-F3_{VARIANT}.blend")))
assert os.path.basename(OUT).startswith("finish-F3") and os.path.dirname(OUT) == os.path.abspath(LANES), \
    "route F3 writes only lanes/finish-F3*.blend"

import overrides  # noqa: E402  (bpy side; imports rosace.outfit, outfit_art, hair_v3)
from rosace_v2 import figure_shape  # noqa: E402

rep = overrides.install(VARIANT)
shape = figure_shape.load_shape(figure_shape.SHAPE_JSON)
integ = json.load(open(os.path.join(common.ART, "integrated.json"), encoding="utf-8"))["build"]
rep["bust"] = {"shape_current": shape.get("current"), "integrated": integ.get("bust")}
if shape.get("current") and shape["current"] != integ.get("bust"):
    # the figure-pose lane moved its pick: use it (build_rosace_v2 asks for integrated.json's name)
    _vp = figure_shape.variant_params
    figure_shape.variant_params = lambda name=None, path=figure_shape.SHAPE_JSON: _vp(shape["current"], path)
    rep["bust"]["used"] = shape["current"]
else:
    rep["bust"]["used"] = integ.get("bust")
print("[finish_f3] install", json.dumps(rep, default=str), flush=True)
sys.argv = [os.path.join(PIPE, "build_rosace_v2.py"), "--", "--out", OUT]
runpy.run_path(os.path.join(PIPE, "build_rosace_v2.py"), run_name="__main__")
with open(os.path.splitext(OUT)[0] + "_f3.json", "w", encoding="utf-8") as f:
    json.dump(rep, f, indent=1, default=str)
print("[finish_f3] built", OUT, flush=True)
