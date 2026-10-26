"""Drive 9, Blender side: pose lanes/drive9.blend (route F3's mass build) with the figure-pose lane's appeal poses
(its applier, read-only) plus route F2's head scale, and render the passes the drive-9 finish needs at ss x the
sprite size. The finish itself (the painterly ramps, lines, rim, face) is all in d9_post.py, in numpy, so it can be
re-tuned without Blender.

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 \
      --python D:/Dex/Projects/dex.place/tools/pixel-pipeline/drive9/d9_blender.py -- \
      --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/<key> [--shots idle,n1,q,back] [--px 144,80]
      [--ss 4] [--head 1.10] [--drape p5|none|<shot>=<patch>,...] [--save-lane] [--r2 <round-2 json>]
      [--blend <lane .blend>] [--neck-l 1.0]   (round 5: render another lane build, e.g. lanes/drive9n.blend; since the promotion also the
      canonical rosace.blend, opened read-only: stills_v2.py's default chain)

Per shot and size, in <out>/<shot>/px<N>/: id, normal, depth, light (R = the toon ramp input v, G = ao, B = the
spec band; materials.py), beauty (the toon, for reference), noise (R = brush noise, G = strand noise stretched
along world z, B = 0; world position, feature about 2.5 / 1.2 sprite px), meta.json, facepass.json (route F1's
code, run on this render's own head), landmarks.json.

Head scale: finish_f2/head_scale.py (used as a library) injects the head/neck scales into the pose's bones stage and
refits H. Drape: finish_f3/drape_f3.json's patch deep-merged over the pose (the pose files are never edited).
--r2 (whole-character round 2, r2_blender.py): the json's 'mesh_edits' and 'circlet' change the opened model at render
time (never saved), and its 'poses' patches are deep-merged over each pose after the drape (pose files never edited).
--save-lane writes lanes/drive9.blend's posed copy lanes/drive9_idle.blend (idle posed, for inspection) and never
any other file.
"""
import copy
import hashlib
import json
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, PIPE)
sys.path.insert(0, os.path.join(PIPE, "rosace_v2"))
sys.path.insert(0, os.path.join(PIPE, "finish_f2"))

import bpy  # noqa: E402

from rosace import common, materials, posing, render  # noqa: E402
import figure_pose  # noqa: E402   (read-only: apply_pose, load_pose, measure)
import head_scale  # noqa: E402    (route F2, as a library)

BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
PICK = json.load(open(os.path.join(REPO, "art", "rosace", "drive9.json"), encoding="utf-8"))
BLEND = PICK["build"]["blend"]
POSES = os.path.join(REPO, "art", "rosace", "poses")
DRAPE = json.load(open(os.path.join(PIPE, "finish_f3", "drape_f3.json"), encoding="utf-8"))
PASSES = ("id", "normal", "depth", "light", "beauty")


def f1_module():
    """route F1's Blender module (finish_f1/f1_blender.py) as a library: its facepass() is reused. The file calls
    main() at import, so it is compiled without that last line."""
    p = os.path.join(PIPE, "finish_f1", "f1_blender.py")
    src = open(p, encoding="utf-8").read()
    cut = src.rstrip().rfind("\nmain()")
    mod = types.ModuleType("f1_blender_lib")
    mod.__file__ = p
    exec(compile(src[:cut], p, "exec"), mod.__dict__)
    return mod


def deep_merge(a, b):
    out = dict(a)
    for k, v in b.items():
        out[k] = deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def pose_file(names):
    for n in names:
        p = os.path.join(POSES, n)
        if os.path.exists(p):
            return p
    raise SystemExit(f"none of {names} in {POSES}")


# ---------------------------------------------------------------------------- the noise pass
def add_noise_pass(name):
    m = bpy.data.materials.get(name)
    if m is None or name not in materials.PASS_NODES:
        return
    nt = m.node_tree
    nodes = nt.nodes
    for n in [n for n in nodes if n.get("d9")]:
        nodes.remove(n)

    def N(tp, **kw):
        n = nodes.new(tp)
        n["d9"] = True
        for k, v in kw.items():
            setattr(n, k, v)
        return n

    L = nt.links.new
    geo = N("ShaderNodeNewGeometry")
    outs = []
    for nm, stretch in (("d9_iso", (1.0, 1.0, 1.0)), ("d9_strand", (1.0, 1.0, 0.16))):
        sc = N("ShaderNodeVectorMath", operation="MULTIPLY")
        sc.name = nm + "_sc"
        L(geo.outputs["Position"], sc.inputs[0])
        sc.inputs[1].default_value = tuple(30.0 * s for s in stretch)
        noi = N("ShaderNodeTexNoise")
        noi.noise_dimensions = "3D"
        noi.inputs["Scale"].default_value = 1.0
        noi.inputs["Detail"].default_value = 1.5 if nm == "d9_iso" else 0.5
        noi.inputs["Roughness"].default_value = 0.55
        noi.inputs["Distortion"].default_value = 0.6 if nm == "d9_iso" else 0.2
        L(sc.outputs[0], noi.inputs["Vector"])
        outs.append(noi.outputs["Fac"])
    comb = N("ShaderNodeCombineXYZ")
    L(outs[0], comb.inputs[0])
    L(outs[1], comb.inputs[1])
    em = N("ShaderNodeEmission")
    em.name = "pass_noise"
    L(comb.outputs[0], em.inputs[0])
    materials.PASS_NODES[name]["noise"] = em


def set_noise_scale(px, iso_px=2.5, strand_px=1.2):
    ppm = px / bpy.data.objects["rosace_rig"]["rosace_height"]
    for name in materials.PASS_NODES:
        m = bpy.data.materials.get(name)
        nd = m.node_tree.nodes
        for nm, fpx, stretch in (("d9_iso", iso_px, (1, 1, 1)), ("d9_strand", strand_px, (1, 1, 0.16))):
            n = nd.get(nm + "_sc")
            if n is not None:
                k = ppm / fpx
                n.inputs[1].default_value = tuple(k * s for s in stretch)


# ---------------------------------------------------------------------------- main
def main():
    argv = common.args_after_dashes(sys.argv)
    out = os.path.abspath(common.arg(argv, "--out", os.path.join(BUILD, "lanes", "drive9", "raw", "main")))
    assert "rosace.blend" not in out
    shots = common.arg(argv, "--shots", "idle,n1,q,back").split(",")
    pxs = [int(x) for x in common.arg(argv, "--px", "144,80").split(",")]
    ss = common.arg(argv, "--ss", 4, int)
    hcfg = dict(PICK["head"])
    if common.arg(argv, "--head", None) is not None:
        hcfg["head"] = float(common.arg(argv, "--head", None))
    if common.arg(argv, "--neck-l", None) is not None:      # round 5: the neck's length (head_scale neck_l)
        hcfg["neck_l"] = float(common.arg(argv, "--neck-l", None))
    hc = head_scale.cfg_from({k: hcfg[k] for k in ("head", "neck_w", "neck_l", "fit_h")})
    drape_arg = common.arg(argv, "--drape", None)
    drape = {s: PICK["shots"][s].get("drape") for s in PICK["shots"]}
    if drape_arg:
        if "=" in drape_arg:
            for kv in drape_arg.split(","):
                k, v = kv.split("=")
                drape[k] = None if v == "none" else v
        else:
            drape = {s: (None if drape_arg == "none" else drape_arg) for s in drape}
    save_lane = common.arg(argv, "--save-lane", False, bool)
    r2p = common.arg(argv, "--r2", None)
    R2 = json.load(open(r2p, encoding="utf-8")) if r2p else {}

    blend = common.arg(argv, "--blend", BLEND)       # round 5: the recombined build (lanes/drive9n.blend)
    # drive-9 promotion (PIPELINE 3.6r): stills_v2.py renders the canonical rosace.blend through here. The opened file is
    # never saved (the render-time patches stay in memory; --save-lane writes a copy to lanes/drive9_idle.blend only).
    assert not (save_lane and os.path.basename(blend) == "rosace.blend"), "--save-lane is for lane builds"
    bpy.ops.wm.open_mainfile(filepath=blend)
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    f1 = f1_module()
    r2rep = {}
    if R2:
        sys.path.insert(0, HERE)
        import r2_blender
        r2rep["mesh_edits"] = r2_blender.mesh_edits(R2.get("mesh_edits"))
        r2rep["circlet"] = r2_blender.circlet(R2.get("circlet"))
        if R2.get("pin"):
            import r5_blender     # round 5: the head-top rosette pin and ribbon (r5_blender.py)
            r2rep["pin"] = r5_blender.pin(R2.get("pin"))
        print("D9 R2", json.dumps(r2rep), flush=True)
    for name in list(materials.PASS_NODES):
        add_noise_pass(name)
    head_scale.install(hc)          # posing.apply_pose = figure-pose applier + head/neck scale + H refit
    rep = {"blend": blend, "blend_sha256": hashlib.sha256(open(blend, "rb").read()).hexdigest(),
           "head": hc, "drape": drape, "shots": {}, "r2": {"file": r2p, "rep": r2rep}}
    for shot in shots:
        sd = PICK["shots"][shot]
        path = pose_file(sd["pose"])
        P, _ = figure_pose.load_pose(path)
        sha = hashlib.sha1(open(path, "rb").read()).hexdigest()[:12]
        patch = drape.get(shot)
        pname = P.get("name")
        if patch and pname in DRAPE[patch]:
            P = deep_merge(P, copy.deepcopy(DRAPE[patch][pname]))
        r2patch = R2.get("poses", {}).get(pname)
        if r2patch:
            P = deep_merge(P, copy.deepcopy(r2patch))
        meta_p = posing.apply_pose(P)
        bpy.context.view_layer.update()
        cam = P.get("camera", {})
        yaw, elev = float(cam.get("yaw", 60.0)), float(cam.get("elev", 10.0))
        rep["shots"][shot] = {"pose": path, "pose_sha1": sha, "drape": patch, "r2_patch": r2patch, "yaw": yaw, "elev": elev,
                              "rosace_height": float(bpy.data.objects["rosace_rig"]["rosace_height"])}
        for px in pxs:
            d = os.path.join(out, shot, f"px{px}")
            os.makedirs(d, exist_ok=True)
            shot_m = render.setup_shot(sc, px, yaw=yaw, elev=elev, ss=ss)
            render.render_passes(sc, d, PASSES)
            set_noise_scale(px)
            materials.set_pass("noise")
            sc.render.filepath = os.path.join(d, "noise.png")
            bpy.ops.render.render(write_still=True)
            materials.set_pass("beauty")
            anchors = posing.anchors(sc, px)
            render.write_meta(os.path.join(d, "meta.json"), shot_m,
                              {"pose": meta_p.get("name"), "expression": meta_p.get("expression"), "pose_sha1": sha,
                               "pose_file": path, "passes": list(PASSES) + ["noise"], "anchors": anchors,
                               "frames": None, "thong": None, "applier": "figure_pose+head_scale",
                               "d9": {"shot": shot, "expr": sd["expr"], "head": hc, "drape": patch,
                                      "r2": r2p, "r2_pose_patch": bool(r2patch)}})
            f1.facepass(sc, json.load(open(os.path.join(d, "meta.json"))), d)
            try:
                lm = figure_pose.measure(posing.arm_obj(), dict(P, camera={"yaw": yaw, "elev": elev}), pxs=(px,),
                                         anchors={px: shot_m["anchor"]})
                json.dump(lm, open(os.path.join(d, "landmarks.json"), "w", encoding="utf-8"), indent=1)
            except Exception as e:
                print("D9 WARN landmarks", shot, px, e)
            print("D9 RENDERED", d, shot_m["canvas"], flush=True)
    os.makedirs(out, exist_ok=True)
    json.dump(rep, open(os.path.join(out, "_render.json"), "w"), indent=1, default=str)
    if save_lane:
        sd = PICK["shots"]["idle"]
        P, _ = figure_pose.load_pose(pose_file(sd["pose"]))
        if drape.get("idle"):
            P = deep_merge(P, copy.deepcopy(DRAPE[drape["idle"]].get(P.get("name"), {})))
        posing.apply_pose(P)
        lane = os.path.join(BUILD, "lanes", "drive9_idle.blend")
        bpy.ops.wm.save_as_mainfile(filepath=lane, compress=True, copy=True)
        print("D9 LANE SAVED", lane)


main()
