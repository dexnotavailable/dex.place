"""Drive 9, the combined build: route F3's mass lever (variant from art/rosace/drive9.json 'build.f3_variant')
on the integrated canonical build, written to lanes/drive9.blend (runs inside Blender, one process at a time).

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 \
      --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/bl_build.py

Same mechanism as finish_f3/bl_build.py (used as a library: its overrides.install swaps outfit_art.sleeves_r2 /
tabard_r2 and registers the 'f3' hair variant), then build_rosace_v2.py runs unchanged with --out. The bust is
art/rosace/figure/shape.json 'current' (the figure-pose lane's pick, read-only). The head scale (route F2) and
the finish (route F1, re-tuned) are applied at render time by d9_blender.py, not baked. Never writes rosace.blend.
"""
import json
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, PIPE)
sys.path.insert(0, os.path.join(PIPE, "finish_f3"))

from rosace import common  # noqa: E402

PICK = json.load(open(os.path.join(REPO, "art", "rosace", "drive9.json"), encoding="utf-8"))
OUT = os.path.join(common.BUILD, "lanes", "drive9.blend")
assert os.path.basename(OUT) == "drive9.blend"

import overrides  # noqa: E402  (finish_f3, bpy side)
from rosace_v2 import figure_shape  # noqa: E402

rep = overrides.install(PICK["build"]["f3_variant"])
shape = figure_shape.load_shape(figure_shape.SHAPE_JSON)
integ = json.load(open(os.path.join(common.ART, "integrated.json"), encoding="utf-8"))["build"]
rep["bust"] = {"shape_current": shape.get("current"), "integrated": integ.get("bust")}
if shape.get("current") and shape["current"] != integ.get("bust"):
    _vp = figure_shape.variant_params
    figure_shape.variant_params = lambda name=None, path=figure_shape.SHAPE_JSON: _vp(shape["current"], path)
    rep["bust"]["used"] = shape["current"]
else:
    rep["bust"]["used"] = integ.get("bust")
print("[drive9] install", json.dumps(rep, default=str), flush=True)
sys.argv = [os.path.join(PIPE, "build_rosace_v2.py"), "--", "--out", OUT]
runpy.run_path(os.path.join(PIPE, "build_rosace_v2.py"), run_name="__main__")
with open(os.path.splitext(OUT)[0] + "_d9.json", "w", encoding="utf-8") as f:
    json.dump(rep, f, indent=1, default=str)
print("[drive9] built", OUT, flush=True)
