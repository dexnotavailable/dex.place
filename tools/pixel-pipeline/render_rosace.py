"""Render Rosace passes from the built .blend (stills from the pose library, or frames).

  tools/pixel-pipeline/blender.sh --python tools/pixel-pipeline/render_rosace.py -- \
      --blend D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend \
      --pose art/rosace/poses/idle_hero.json [--px 96,128,144] [--yaw 60] [--elev 10] \
      [--ss 1] [--out D:/Dex/Projects/dex-place-art/rosace/build/renders/<name>] \
      [--passes beauty,albedo,id,normal,depth] [--thong black|white] [--frames 0-23]

Writes <out>/px<N>/<pass>.png (or <pass>/####.png with --frames) and meta.json per size.
Then run the pixel post-process on each size (outside Blender):
  python tools/pixel-pipeline/rosace_post.py --raw <out>/px<N>
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from rosace import common, materials, render  # noqa: E402

argv = common.args_after_dashes(sys.argv)
BLEND = common.arg(argv, "--blend", os.path.join(common.BUILD, "rosace.blend"))
POSE = common.arg(argv, "--pose", None)
PXS = [int(x) for x in common.arg(argv, "--px", "128").split(",")]
YAW = common.arg(argv, "--yaw", None, float)
ELEV = common.arg(argv, "--elev", None, float)
SS = common.arg(argv, "--ss", 1, int)
OUT = common.arg(argv, "--out", os.path.join(common.BUILD, "renders", "test"))
PASSES = common.arg(argv, "--passes", "beauty,albedo,id,normal,depth").split(",")
THONG = common.arg(argv, "--thong", None)
FRAMES = common.arg(argv, "--frames", None)
HIDE = [h for h in common.arg(argv, "--hide", "").split(",") if h]
SEQ = common.arg(argv, "--seq", None)   # "pose_a.json@0,pose_b.json@8": key poses into an action


def pose_sha1(path):
    """short hash of the pose file, so hand-painted override patches know which render they fit"""
    if not path:
        return None
    import hashlib
    from rosace.common import POSES_DIR
    if not os.path.exists(path):
        path = os.path.join(POSES_DIR, path)
    with open(path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:12]


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    pose_meta = {}
    yaw, elev = 60.0, 10.0
    if POSE:
        from rosace import posing
        pose_meta = posing.apply_pose_file(POSE)
        yaw = pose_meta.get("camera", {}).get("yaw", yaw)
        elev = pose_meta.get("camera", {}).get("elev", elev)
    if SEQ:
        from rosace import posing
        keys = [(int(k.split("@")[1]), k.split("@")[0]) for k in SEQ.split(",")]
        metas = posing.bake_keys(keys)
        pose_meta = dict(metas[0][1])
        pose_meta["name"] = "seq:" + SEQ
        yaw = pose_meta.get("camera", {}).get("yaw", yaw)
        elev = pose_meta.get("camera", {}).get("elev", elev)
    if YAW is not None:
        yaw = YAW
    if ELEV is not None:
        elev = ELEV
    if THONG:
        from rosace import outfit
        outfit.set_thong_variant(THONG)
    for o in sc.objects:
        if o.type == "MESH" and any(o.name.startswith(h) or o.get("part") == h for h in HIDE):
            o.hide_render = True
    bpy.context.view_layer.update()
    frames = None
    if FRAMES:
        a, b = FRAMES.split("-")
        frames = list(range(int(a), int(b) + 1))
    for px in PXS:
        shot = render.setup_shot(sc, px, yaw=yaw, elev=elev, ss=SS, frames=frames)
        out = os.path.join(OUT, f"px{px}")
        render.render_passes(sc, out, PASSES, frames)
        anchors = {}
        try:
            from rosace import posing
            if frames:
                for f in frames:
                    sc.frame_set(f)
                    anchors[str(f)] = posing.anchors(sc, px)
            else:
                anchors = posing.anchors(sc, px)
        except Exception as e:  # noqa: BLE001 - anchors are optional for bare-body tests
            print("anchors skipped:", e)
        render.write_meta(os.path.join(out, "meta.json"), shot,
                          {"pose": pose_meta.get("name"), "expression": pose_meta.get("expression"),
                           "pose_sha1": pose_sha1(POSE),
                           "passes": PASSES, "anchors": anchors,
                           "frames": frames, "thong": THONG})
        print("RENDERED", out, shot["canvas"])


main()
