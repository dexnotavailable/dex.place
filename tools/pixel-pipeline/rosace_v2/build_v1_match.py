"""Comparison build: the CURRENT base (v1, HairSample_Female.vrm) dressed with the v2 refit's outfit.

For the blind base A/B (review/rosace/base-v2/compare/) both sides must wear the same outfit, so
this runs build_rosace.py's steps unchanged except that the refit's outfit revisions are applied
exactly as build_rosace_v2.py applies them to the v2 base:
  * refit.apply_palette() before materials.make_all() (revision-3 stocking / boot ramps)
  * hair + outfit through refit.build() (v2 veil, pins on the veil surface, boots_v2 with the gold
    cuff, collar cross hung in front of the chest and flagged for the pixel glyph)
Everything else (body import / restyle / face normals, glaive, rig.finish, solidify clamp, AO,
part ids) is build_rosace.py's. Output is a scratch comparison file; it never writes rosace.blend.

  python tools/pixel-pipeline/blender_env.py run --python tools/pixel-pipeline/rosace_v2/build_v1_match.py -- \
      [--out D:/Dex/Projects/dex-place-art/rosace/build/scratch/rosace_v1_outfitv2.blend] [--plain]

--plain skips the refit swaps (a pure build_rosace.py rebuild, to check the rebuild matches rosace.blend).
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bpy  # noqa: E402

from rosace import body, common, materials  # noqa: E402

argv = common.args_after_dashes(sys.argv)
OUT = common.arg(argv, "--out", os.path.join(common.BUILD, "scratch", "rosace_v1_outfitv2.blend"))
PLAIN = common.arg(argv, "--plain", False, bool)
V1_BLEND = os.path.join(common.BUILD, "rosace.blend")
T0 = time.time()


def log(*a):
    print(f"[build_v1match {time.time() - T0:6.1f}s]", *a, flush=True)


EMPTY_RETRIED = []


def _wide_coarse_shell():
    """v1's leg faces are ~2-3 cm tall, so a narrow band shell (thigh_bands +-9 mm, boot_cuffs
    +-7.5 mm) finds no face CENTRE inside the band and comes out empty: rosace.blend ships with
    0-vertex thigh_bands, and the v2 boot cuff would be 0 too. For the matched comparison an empty
    shell is rebuilt once with a coarse pick that also tests the face centre shifted +-1..3 cm in z;
    the final cut on the subdivided mesh is still the garment's own region, so the band is the
    same size as on v2."""
    from rosace import outfit
    orig = outfit.shell

    def shell(Bd, name, region, *a, **k):
        ob = orig(Bd, name, region, *a, **k)
        if ob is not None and len(ob.data.vertices) == 0 and "coarse" not in k:
            me = ob.data
            bpy.data.objects.remove(ob)
            bpy.data.meshes.remove(me)
            from mathutils import Vector

            def coarse(p, m):
                return any(region(p + Vector((0, 0, dz)), m) for dz in (0, -.01, .01, -.02, .02, -.03, .03))
            k = dict(k, coarse=coarse)
            k["subdiv"] = k.get("subdiv", 1) + 2
            ob = orig(Bd, name, region, *a, **k)
            EMPTY_RETRIED.append({"name": name, "verts": len(ob.data.vertices)})
        return ob
    outfit.shell = shell
    return orig


def main():
    assert os.path.abspath(OUT) != os.path.abspath(V1_BLEND), "never overwrite rosace.blend"
    from rosace_v2 import refit
    if not PLAIN:
        _wide_coarse_shell()
    body.reset_scene()
    arm, bod, face = body.import_base()
    info = body.restyle(arm, [bod, face])
    log("restyled", info)
    if not PLAIN:
        refit.apply_palette()
    materials.make_all()
    for ob in (bod, face):
        ob.data.materials.append(bpy.data.materials["skin"])
    body.flatten_face_normals(face, arm)
    top = max(max((ob.matrix_world @ v.co).z for v in ob.data.vertices) for ob in (bod, face))
    arm["rosace_height"] = top
    parts = {}
    if PLAIN:
        from rosace import hair, outfit
        parts["hair"] = hair.build(arm, face)
        parts["outfit"] = outfit.build(arm, bod)
    else:
        parts.update(refit.build(arm, bod, face))
    from rosace import glaive, rig
    parts["glaive"] = glaive.build(arm)
    rig.finish(arm, parts)
    for ob in bpy.data.objects:
        for m in ob.modifiers:
            if m.type == "SOLIDIFY":
                m.use_even_offset = False
                m.thickness_clamp = 1.0
                m.use_thickness_angle_clamp = True
    from rosace import bake
    bake.ensure_ao([o for o in bpy.data.objects if o.type == "MESH"], run=True)
    from rosace.geo import set_part
    set_part(bod, "body")
    set_part(face, "head")
    arm["v1_match"] = {"plain": PLAIN, "outfit": "v1" if PLAIN else "v2 refit (rosace_v2/refit.py)"}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
    rep = {"out": OUT, "plain": PLAIN, "rosace_height": round(top, 4)}
    if not PLAIN:
        rep["v2_fixes"] = refit.INFO
        rep["empty_shells_rebuilt"] = EMPTY_RETRIED
    with open(os.path.splitext(OUT)[0] + "_build.json", "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=1, default=str)
    log("saved", OUT)


main()
