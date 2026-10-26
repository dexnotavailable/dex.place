"""Build Rosace (the canonical base since the Adopt step, 2026-09-29): SiroinoSotai body (CC0)
+ MMD用女性素体 head -> rosace.blend.

Dex, 2026-09-29: "take the busty SiroinoSotai body, then swap in the head from the MMD女性素体".
Scripts are the source of truth; the .blend is regenerable build output. The retired v1 base is
kept as build/rosace_v1.blend (backed up before the first v2 write; build_rosace.py rebuilds v1
elsewhere). Run headless through the isolated wrapper (one Blender at a time):
  tools/pixel-pipeline/blender.ps1 --python tools/pixel-pipeline/build_rosace_v2.py '--' \
      [--out D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend] [--no-glaive] [--no-ao] [--bare]
      [--chain drive9|integrated]   (default drive9 since the drive-9 promotion; see below)
Exploration only: --keys JSON, --leg-stretch K, --torso-k K, --pinch JSON (rosace_v2/key_sweep.py).

Steps: body (append, bake the body keys, quads, J_Bip_* names, chest split) -> head (plan the
scale from the proportion target, cut, taper, weld, split, normals) -> rig (Root, head pivot, eye
anchors, twist helpers, soft-tissue bones and weights, v1 IK + glaive sockets) -> jiggle settings
-> refit (hair, veil, outfit, revision-3 palette; rosace_v2/refit.py; skipped with --bare)
-> glaive -> materials -> limbs -> AO -> save. A JSON report lands next to the .blend.

Integrate step (2026-09-29, PIPELINE.md 3.6g): the part lanes' kept builds are the defaults, read
from art/rosace/integrated.json 'build': the outfit variant (ROSACE_OUTFIT, rosace/outfit_art.py),
the glaive style (ROSACE_GLAIVE, rosace/glaive.py), the hair and veil variant (ROSACE_HAIR,
rosace/hair_v3.py; 'control' = the v2 refit hair) and the shading lane's per-face 'limb' attribute
(rosace_v2/limbs.py). An environment variable that is already set wins, so a lane driver still builds
its own variant. The canonical rosace.blend is only written when build/rosace_pre_artistry.blend (the
pre-integration canonical file) exists.

Drive-9 promotion (2026-09-29, PIPELINE.md 3.6r): the default chain is 'drive9', which adds route F3's
mass variant (art/rosace/drive9.json 'promoted.f3_variant', L: ref-14 bells, the mid tabard with pipe
folds, hair volume) through finish_f3/overrides.install before the build, exactly as drive9/bl_build.py
made lanes/drive9.blend. '--chain integrated' (or ROSACE_CHAIN=integrated) is the old integrated build.
The mass lever is skipped for --bare, when a lane driver already set ROSACE_OUTFIT / ROSACE_GLAIVE /
ROSACE_HAIR, or when a driver already installed an F3 variant (finish_f3/bl_build.py, drive9/bl_build.py),
so every lane driver builds what it built before. Writing rosace.blend with the drive9 chain needs
build/rosace_pre_drive9.blend (the integrated canonical file) to exist; no backup is ever overwritten.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from rosace import common  # noqa: E402
from rosace_v2 import body as vbody  # noqa: E402
from rosace_v2 import head as vhead  # noqa: E402
from rosace_v2 import jiggle, sources  # noqa: E402
from rosace_v2 import rig as vrig  # noqa: E402

argv = common.args_after_dashes(sys.argv)
OUT = common.arg(argv, "--out", os.path.join(common.BUILD, "rosace.blend"))
GLAIVE = not common.arg(argv, "--no-glaive", False, bool)
AO = not common.arg(argv, "--no-ao", False, bool)
BARE = common.arg(argv, "--bare", False, bool)      # the assembly base only: no hair, veil or outfit
# exploration only: --keys '{"Breasts_LL": 1.0, ...}' replaces BODY_KEYS for this build
KEYS = common.arg(argv, "--keys", None)
# exploration only: --leg-stretch 1.28 replaces body.LEG_STRETCH for this build
LEG_K = common.arg(argv, "--leg-stretch", None, float)
# exploration only: --pinch '{"amount": 0.06}' overrides body.WAIST_PINCH for this build
PINCH = common.arg(argv, "--pinch", None)
# exploration only: --torso-k 0.95 replaces body.TORSO_K for this build
TORSO_K = common.arg(argv, "--torso-k", None, float)
CANON = os.path.join(common.BUILD, "rosace.blend")
V1_BACKUP = os.path.join(common.BUILD, "rosace_v1.blend")   # the retired v1 base (Adopt, 2026-09-29)
PRE_ART = os.path.join(common.BUILD, "rosace_pre_artistry.blend")   # canonical before the Integrate step
PRE_D9 = os.path.join(common.BUILD, "rosace_pre_drive9.blend")      # canonical before the drive-9 promotion
INTEGRATED = json.load(open(os.path.join(common.ART, "integrated.json"), encoding="utf-8"))["build"]
# drive-9 promotion: the chain, and route F3's mass lever unless a lane driver owns this build
CHAIN = common.arg(argv, "--chain", None) or os.environ.get("ROSACE_CHAIN") or "drive9"
assert CHAIN in ("drive9", "integrated"), f"--chain drive9|integrated, not {CHAIN}"
PROMOTED = json.load(open(os.path.join(common.ART, "drive9.json"), encoding="utf-8"))["promoted"]
_LANE_ENV = [k for k in ("ROSACE_OUTFIT", "ROSACE_GLAIVE", "ROSACE_HAIR") if k in os.environ]
_F3_DONE = getattr(sys.modules.get("overrides"), "REPORT", {}).get("variant") \
    if hasattr(sys.modules.get("overrides"), "TABF") else None
MASS = {"chain": CHAIN, "skipped": None}
if CHAIN != "drive9":
    MASS["skipped"] = "chain integrated"
elif BARE:
    MASS["skipped"] = "--bare"
elif _LANE_ENV or _F3_DONE:
    MASS["skipped"] = f"lane driver owns the build (env {_LANE_ENV}, f3 installed {_F3_DONE})"
else:
    import importlib.util
    _p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "finish_f3", "overrides.py")
    _spec = importlib.util.spec_from_file_location("f3_overrides", _p)    # 'overrides' is also the face tool's name
    _f3 = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_f3)
    MASS["f3"] = dict(_f3.install(PROMOTED["f3_variant"]))
# the lane picks as defaults; a variable a lane driver already set wins
os.environ.setdefault("ROSACE_OUTFIT", INTEGRATED["outfit"])
os.environ.setdefault("ROSACE_GLAIVE", INTEGRATED["glaive"])
os.environ.setdefault("ROSACE_HAIR", INTEGRATED["hair"])
HAIR = os.environ["ROSACE_HAIR"]
H_TOP = 1.8956      # v1 rest height (arm['rosace_height'] of rosace_v1.blend): pose files are in metres
SOLE = 0.018        # the lowest skin sits this far above the floor (boot sole room), as in v1
T0 = time.time()
REPORT = {}


def log(*a):
    print(f"[build_v2 {time.time() - T0:6.1f}s]", *a, flush=True)


def use_hair(variant):
    """the hair lane's hair and veil (rosace/hair_v3.py) in place of the v2 refit's, as
    hair_lane_build.py swaps them; 'control' keeps rosace/hair.py and the refit veil"""
    if variant == "control" or BARE:
        return None
    from rosace import hair, hair_v3
    from rosace_v2 import refit
    hair_v3.VARIANT = hair_v3.VARIANTS[variant]
    S = hair_v3.spec()
    hair.build = hair_v3.build
    refit.build_veil_v2 = hair_v3.build_veil
    refit.build_pin_v2 = hair_v3.build_pin
    refit.build_veil_pins_v2 = hair_v3.build_veil_pins
    # hair tones ride on the scene's palette overrides, so the render meta and the post see the same ramps
    for name, cfg in S.get("materials", {}).items():
        refit.PALETTE_OVERRIDES[name] = cfg
    return sorted(S.get("materials", {}))


def main():
    if os.path.abspath(OUT) == os.path.abspath(CANON):
        assert os.path.exists(V1_BACKUP), "back up the v1 rosace.blend as rosace_v1.blend first"
        assert os.path.exists(PRE_ART), "back up the pre-integration rosace.blend as rosace_pre_artistry.blend first"
        assert not (BARE or KEYS or LEG_K or TORSO_K or PINCH), "exploration builds never write rosace.blend"
        if CHAIN == "drive9":
            assert os.path.exists(PRE_D9), "back up the integrated rosace.blend as rosace_pre_drive9.blend first"
    for bk in (V1_BACKUP, PRE_ART, PRE_D9):
        assert os.path.abspath(OUT) != os.path.abspath(bk), f"never overwrite {os.path.basename(bk)}"
    bpy.ops.wm.read_homefile(use_empty=True)
    REPORT["chain"] = MASS
    log("chain", json.dumps(MASS, default=str))
    REPORT["integrated"] = {"outfit": os.environ["ROSACE_OUTFIT"], "glaive": os.environ["ROSACE_GLAIVE"],
                            "hair": HAIR, "hair_materials": use_hair(HAIR), "limbs": INTEGRATED.get("limbs", False)}
    log("integrated", REPORT["integrated"])
    # ---- body
    arm, body = vbody.import_body()
    keys = json.loads(KEYS) if KEYS else vbody.BODY_KEYS
    moved = vbody.bake_keys(arm, body, keys)
    REPORT["body_keys"] = keys
    REPORT["refit"] = moved
    REPORT["quads"] = vbody.restore_quads(body)
    vbody.rename_bones(arm, body)
    REPORT["leg_stretch"] = vbody.stretch_legs(arm, body, LEG_K or vbody.LEG_STRETCH, TORSO_K)
    REPORT["chest_split_z_src"] = round(vbody.split_chest(arm, body), 4)
    ring_ids, REPORT["neck_cut_src"] = vbody.cut_neck(body, vbody.neck_ring(body))
    REPORT["unweighted_after_cut"] = vbody.fill_unweighted(body)
    ring_src = [body.data.vertices[i].co.copy() for i in ring_ids]
    zmin = min(v.co.z for v in body.data.vertices)
    log("body", len(body.data.vertices), "verts", REPORT["quads"], "ring", len(ring_ids))
    # ---- head plan, then scale the body into metres of Rosace
    head_me, meshes, lm = vhead.import_head()
    P = vhead.plan(lm, ring_src, zmin, H_TOP, SOLE)
    P["ring_ids"] = ring_ids
    s_b = P["s_b"]
    M = Matrix.Translation(Vector((0, 0, SOLE))) @ Matrix.Scale(s_b, 4) @ Matrix.Translation(Vector((0, 0, -zmin)))
    vbody.transform_all(arm, [body], M)
    # round WH2: the integrated pick may deepen the waist pinch (critique: "pinch the waist another 2 px at 144")
    REPORT["waist_pinch"] = vbody.waist_pinch(arm, body, json.loads(PINCH) if PINCH else
                                              (INTEGRATED.get("waist_pinch") if not BARE else None))
    REPORT["plan"] = {k: (round(v, 4) if isinstance(v, float) else None) for k, v in P.items()
                      if isinstance(v, float)}
    REPORT["landmarks_src"] = {k: ([round(c, 4) for c in v] if hasattr(v, "__len__") else round(v, 4))
                               for k, v in lm.items()}
    log("plan", REPORT["plan"])
    # ---- weld and split
    bm, weld = vhead.weld(body, head_me, P, arm)
    REPORT["weld"] = weld
    head = vhead.split(bm, body, arm)
    bm.free()
    log("weld", weld)
    # ---- rig
    vrig.add_root_and_head(arm, P["head_map"](lm["head_joint"]),
                           {"L": P["head_map"](lm["eye_L"]), "R": P["head_map"](lm["eye_R"])})
    REPORT["twist"] = vrig.twist_constraints(arm)
    REPORT["soft_tissue"] = vrig.soft_tissue_bones(arm, body)
    REPORT["deltoid"] = vrig.deltoid_helpers(arm, body)
    vrig.limit_and_normalise(body)
    vrig.limit_and_normalise(head)
    top = max(v.co.z for ob in (body, head) for v in ob.data.vertices)
    arm["rosace_height"] = top
    REPORT["rosace_height"] = round(top, 4)
    face = vhead.face_flattener(arm, P["chin"], top, P["head_len"])
    vhead.set_normals(body)
    vhead.set_normals(head, face)
    vhead.feature_objects(meshes, P, arm)
    # head metrics (the same function v1's hair build uses; anchors and outfit read them)
    from rosace import hair
    hm = hair.head_metrics(arm, body, head)
    arm["head_metrics"] = {k: (list(v) if hasattr(v, "__len__") else v) for k, v in hm.items()}
    # glaive + IK (v1 modules, unchanged)
    from rosace import materials, rig
    from rosace_v2 import refit
    if not BARE:
        refit.apply_palette()        # revision-3 ramps (dark thigh-highs, darker boots), v2 only
    materials.make_all()
    for ob in (body, head):
        ob.data.materials.clear()
        ob.data.materials.append(bpy.data.materials["skin"])
    parts = {}
    if not BARE:
        parts.update(refit.build(arm, body, head))
        REPORT["dress"] = refit.report(arm, parts)
        log("dress", REPORT["dress"]["objects"])
    if GLAIVE:
        from rosace import glaive
        parts["glaive"] = glaive.build(arm)
    rig.finish(arm, parts)
    jiggle.register(arm)
    REPORT["jiggle"] = jiggle.JIGGLE
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    # solidify: clamp the offset so sharp folds in extreme poses can never spike a vertex (v1's rule)
    for ob in bpy.data.objects:
        for m in ob.modifiers:
            if m.type == "SOLIDIFY":
                m.use_even_offset = False
                m.thickness_clamp = 1.0
                m.use_thickness_angle_clamp = True
    from rosace import bake
    from rosace.geo import set_part
    set_part(body, "body")
    set_part(head, "head")
    if INTEGRATED.get("limbs") and not BARE:
        from rosace_v2 import limbs     # the shading stage's per-form terminators (depth2 B)
        REPORT["integrated"]["limb_meshes"] = limbs.write_limbs()
    bake.ensure_ao([o for o in bpy.data.objects if o.type == "MESH" and not o.hide_render], run=AO)
    if INTEGRATED.get("bust") and not BARE:
        # round WH2: the figure-pose lane's bust shape key (rosace_v2/figure_shape.py, art/rosace/figure/shape.json)
        # applied on the baked build, the same way the lane made build/lanes/figure-pose-base.blend (body key,
        # matching garment and hair keys, ao re-baked near every moved vertex)
        from rosace_v2 import figure_shape
        rep = figure_shape.apply(figure_shape.variant_params(INTEGRATED["bust"]), name=INTEGRATED["bust"])
        REPORT["integrated"]["bust"] = {k: rep[k] for k in ("variant", "k", "volume_ratio_solved", "moved",
                                                             "ao_rebaked_verts", "profile") if k in rep}
        log("bust", INTEGRATED["bust"], rep.get("k"), rep.get("volume_ratio_solved"))
    arm["v2"] = {"body": sources.SOURCES["siroino"]["credit"], "head": sources.SOURCES["primero"]["credit"],
                 "body_keys": keys, "heads": vhead.HEADS}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
    with open(os.path.splitext(OUT)[0] + "_build.json", "w", encoding="utf-8") as f:
        json.dump(REPORT, f, indent=1, ensure_ascii=False, default=str)
    log("saved", OUT)


main()
