"""Drive 9, N1 motion frames through the combined finish (runs inside Blender, one process at a time).

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 \
      --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/d9_motion_bl.py -- <blender_apply.py args...>

Runs tools/motion-ai/blender_apply.py unchanged (the motion lane's retarget, hero keys, IK, spring cloth) on
lanes/drive9.blend with three hooks installed around it:
  * render.setup_shot: first the head scale of art/rosace/drive9.json 'head' (route F2's head_scale numbers, set on
    the head and neck pose bones, which the motion never keys) and the H refit, then the noise pass on every material
  * render.render_passes: instead of '<pass>/####.png' sequences, every drawn frame is rendered as a still set in
    <out>/f####/ (id, normal, depth, light, noise, beauty) with meta.json, facepass.json (route F1's code) and
    landmarks, so d9_post.py runs on each frame exactly as on a still
The motion lane's own files are never written: --out must be under lanes/drive9/.
"""
import json
import os
import runpy
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, PIPE)
sys.path.insert(0, os.path.join(PIPE, "rosace_v2"))
sys.path.insert(0, os.path.join(PIPE, "finish_f2"))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

from rosace import materials, posing, render  # noqa: E402
import head_scale  # noqa: E402

PICK = json.load(open(os.path.join(REPO, "art", "rosace", "drive9.json"), encoding="utf-8"))
argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[argv.index("--out") + 1])
assert os.sep + "drive9" + os.sep in OUT, "drive 9 motion writes only under lanes/drive9/"


def _lib(name, path, cut_main=True):
    src = open(path, encoding="utf-8").read()
    if cut_main:
        src = src[:src.rstrip().rfind("\nmain()")]
    mod = types.ModuleType(name)
    mod.__file__ = path
    exec(compile(src, path, "exec"), mod.__dict__)
    return mod


F1B = _lib("f1_blender_lib", os.path.join(PIPE, "finish_f1", "f1_blender.py"))
D9B_SRC = os.path.join(HERE, "d9_blender.py")
D9B = _lib("d9_blender_lib", D9B_SRC)
HC = head_scale.cfg_from({k: PICK["head"][k] for k in ("head", "neck_w", "neck_l", "fit_h")})
STATE = {}

_setup = render.setup_shot
_passes = render.render_passes


def setup_shot(sc, px, *a, **kw):
    if "done" not in STATE:
        arm = bpy.data.objects["rosace_rig"]
        nw = head_scale.neck_scale(HC)
        pb = arm.pose.bones
        pb[head_scale.NECK].scale = nw
        pb[head_scale.HEAD].scale = tuple(HC["head"] / s for s in nw)
        f, top = head_scale.crown_factor(HC)
        STATE["h0"] = float(arm.get("rosace_height", 1.7))
        if HC["fit_h"]:
            arm["rosace_height"] = STATE["h0"] * f
        for name in list(materials.PASS_NODES):
            D9B.add_noise_pass(name)
        STATE["done"] = True
        print("D9_MOTION head", HC, "crown", round(f, 5), flush=True)
    shot = _setup(sc, px, *a, **kw)
    STATE["shot"] = shot
    STATE["px"] = px
    return shot


def render_passes(sc, out_dir, passes=("beauty",), frames=None):
    if frames is None:
        return _passes(sc, out_dir, passes, frames)
    px = STATE["px"]
    D9B.set_noise_scale(px)
    shot = STATE["shot"]
    for f in frames:
        sc.frame_set(f)
        bpy.context.view_layer.update()
        d = os.path.join(OUT, f"px{px}", f"f{f:04d}")
        os.makedirs(d, exist_ok=True)
        _passes(sc, d, ("id", "normal", "depth", "light", "beauty"), None)
        materials.set_pass("noise")
        sc.render.filepath = os.path.join(d, "noise.png")
        bpy.ops.render.render(write_still=True)
        materials.set_pass("beauty")
        render.write_meta(os.path.join(d, "meta.json"), shot,
                          {"pose": "n1_motion", "frame": f, "passes": ["id", "normal", "depth", "light", "beauty", "noise"],
                           "anchors": posing.anchors(sc, px), "frames": None, "thong": None,
                           "d9": {"shot": "n1", "expr": "n1_contact", "head": HC, "frame": f}})
        F1B.facepass(sc, json.load(open(os.path.join(d, "meta.json"))), d)
        print("D9_MOTION frame", f, flush=True)
    # the motion lane's own sequences are still written (blender_apply's meta.json expects them), into OUT
    return _passes(sc, out_dir, ("beauty", "id"), frames)


render.setup_shot = setup_shot
render.render_passes = render_passes
script = os.path.join(REPO, "tools", "motion-ai", "blender_apply.py")
sys.argv = [script, "--"] + argv
runpy.run_path(script, run_name="__main__")
