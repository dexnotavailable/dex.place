"""Run an unchanged pipeline script inside Blender with route F2's head scale installed (runs in Blender).

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python tools/pixel-pipeline/finish_f2/bl_run.py -- \
      --head 1.15 [--neck-w 0.4] [--neck-l 1.0] [--fit-h 1] --script tools/art-construct/gh_render.py <that script's args>

Everything after --script <path> is handed to the script as its own `-- args`. See head_scale.py.
"""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import head_scale  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
i = argv.index("--script")
own, script, rest = argv[:i], argv[i + 1], argv[i + 2:]


def opt(name, default, cast):
    return cast(own[own.index(name) + 1]) if name in own else default


c = head_scale.cfg_from({"head": opt("--head", 1.0, float), "neck_w": opt("--neck-w", 0.4, float),
                         "neck_l": opt("--neck-l", 1.0, float), "fit_h": bool(opt("--fit-h", 1, int))})
head_scale.install(c)
sys.argv = [sys.argv[0], "--"] + rest
runpy.run_path(os.path.abspath(script), run_name="__main__")
