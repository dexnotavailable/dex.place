"""Build the RETIRED v1 Rosace base (HairSample_Female.vrm, CC0) + scripts -> a scratch file.

Since the Adopt step (2026-09-29) rosace.blend is built by build_rosace_v2.py (SiroinoSotai body
+ MMD head); the shipped v1 file is kept as build/rosace_v1.blend. This script stays for
comparison rebuilds and never writes either of those two files.

Scripts are the source of truth; the .blend is regenerable build output.
Run headless through the isolated wrapper (never a user's open Blender):
  tools/pixel-pipeline/blender.sh --python tools/pixel-pipeline/build_rosace.py -- \
      [--out D:/Dex/Projects/dex-place-art/rosace/build/scratch/rosace_v1_rebuild.blend] [--only body,hair,...]

Inputs: HairSample_Female.vrm (CC0, pinned in third_party.json), art/rosace/palette.json.
Steps: body (import, strip, restyle, face normals) -> materials -> hair -> outfit -> glaive
       -> rig (chains, IK, sockets) -> occlusion bake -> save.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from rosace import body, common, materials  # noqa: E402

argv = common.args_after_dashes(sys.argv)
OUT = common.arg(argv, "--out", os.path.join(common.BUILD, "scratch", "rosace_v1_rebuild.blend"))
assert os.path.basename(OUT) not in ("rosace.blend", "rosace_v1.blend"), "v1 never writes the canonical files"
ONLY = common.arg(argv, "--only", "body,hair,outfit,glaive,rig,ao").split(",")
T0 = time.time()


def log(*a):
    print(f"[build {time.time() - T0:6.1f}s]", *a, flush=True)


def main():
    body.reset_scene()
    arm, bod, face = body.import_base()
    log("imported base", arm.name, len(bod.data.vertices), len(face.data.vertices))
    info = body.restyle(arm, [bod, face])
    log("restyled", info)
    materials.make_all()
    for ob in (bod, face):
        ob.data.materials.append(bpy.data.materials["skin"])
    body.flatten_face_normals(face, arm)
    top = max(max((ob.matrix_world @ v.co).z for v in ob.data.vertices) for ob in (bod, face))
    arm["rosace_height"] = top
    log("height (skull top to sole) m", round(top, 4))
    parts = {}
    if "hair" in ONLY:
        from rosace import hair
        parts["hair"] = hair.build(arm, face)
        log("hair")
    if "outfit" in ONLY:
        from rosace import outfit
        parts["outfit"] = outfit.build(arm, bod)
        log("outfit")
    if "glaive" in ONLY:
        from rosace import glaive
        parts["glaive"] = glaive.build(arm)
        log("glaive")
    if "rig" in ONLY:
        from rosace import rig
        rig.finish(arm, parts)
        log("rig")
    # solidify: clamp the offset so sharp folds in extreme poses can never spike a vertex
    for ob in bpy.data.objects:
        for m in ob.modifiers:
            if m.type == "SOLIDIFY":
                m.use_even_offset = False
                m.thickness_clamp = 1.0
                m.use_thickness_angle_clamp = True
    from rosace import bake
    bake.ensure_ao([o for o in bpy.data.objects if o.type == "MESH"], run="ao" in ONLY)
    log("ao")
    from rosace.geo import set_part
    set_part(bod, "body")
    set_part(face, "head")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
    log("saved", OUT)


main()
