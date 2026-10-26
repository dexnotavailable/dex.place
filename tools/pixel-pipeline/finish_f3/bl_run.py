"""Route F3: run a stills-chain Blender script with the figure-pose lane's applier behind
posing.apply_pose (runs inside Blender).

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 \
      --python tools/pixel-pipeline/finish_f3/bl_run.py -- <script.py> <that script's args...>

gh_render.py, author_faces_pass.py and render_rosace.py pose the rig with rosace.posing.apply_pose.
The appeal poses (idle_appeal*, back_appeal*; DESIGN 3.5) need rosace_v2/figure_pose.apply_pose,
which runs posing's own steps plus the 'figure' block. Here posing.apply_pose is swapped for a
dispatcher: an appeal pose goes to figure_pose.apply_pose (used read-only, as a library), any other
pose to posing's original. Nothing else changes, so the passes, meta.json, anchors and landmarks
are the stills chain's own.
"""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
sys.path.insert(0, PIPE)
sys.path.insert(0, os.path.join(PIPE, "rosace_v2"))

from rosace import posing  # noqa: E402

import figure_pose  # noqa: E402

_orig = posing.apply_pose


def apply_pose(P):
    if figure_pose.is_appeal(P):
        print("[finish_f3] figure_pose applier for", P.get("name"), flush=True)
        return figure_pose.apply_pose(P)
    return _orig(P)


posing.apply_pose = apply_pose
i = sys.argv.index("--")
script = os.path.abspath(sys.argv[i + 1])
sys.argv = [script, "--"] + sys.argv[i + 2:]
runpy.run_path(script, run_name="__main__")
