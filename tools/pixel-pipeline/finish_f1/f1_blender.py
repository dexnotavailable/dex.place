"""Route F1 (hi-bit painterly finish), Blender side: the painterly NPR material set and the hi-res passes.

Changes how Rosace is RENDERED, not the model. Opens the canonical build read-only (rosace.blend: the
integrated build, bust = art/rosace/figure/shape.json 'current', checked), applies the figure-pose lane's
newest poses through its applier (rosace_v2/figure_pose.apply_pose, used as a library, never edited), adds a
painterly branch 'pass_f1' to every palette material and renders, per shot and size, at ss x the sprite size:

  id, normal, depth, light, albedo, beauty (the toon ramp, for reference) and f1_<look>.png per look

The painterly branch (per material, data in finish_f1/f1.json):
  v   = the toon ramp input (ao * (0.82 N.L + 0.16), back faces 0.02)          [the existing light pass R]
      + tex * 2 * (noise - 0.5)          brush noise, world position, feature ~nscale_px sprite px
      + bounce_m * bounce * clamp(-Nc.y) * (1 - v / t_half)   warm reflected light on down-facing shadow
      - cav * (1 - ao)                   cavity: occlusion pushes a little deeper than the ramp alone
  col = 6-tone ramp (hue-shifted, chroma-budgeted) with each tone boundary widened by `soft`
        (0 = hard cel, 1 = linear from tone centre to tone centre)
      -> mixed toward the material's spec colour where the render's spec band fires
      -> mixed toward the world rim colour (#99d6ff) by rim_m * rim on the rim band: grazing normals
         (Nc.z < 0.5) that face the rim direction (upper back = screen upper left, away from the key light)
All through Emission, Raw view transform, filter 0, 1 sample: the post (f1_post.py) does the pixel work.

  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 \
      --python tools/pixel-pipeline/finish_f1/f1_blender.py -- render \
      --out D:/Dex/Projects/dex-place-art/rosace/build/lanes/finish-F1/renders [--shots idle,n1,back] \
      [--px 144,80] [--ss 4] [--looks cel,soft,paint] [--save-lane]

--save-lane writes lanes/finish-F1.blend (idle pose applied, the f1 branch wired to the Surface output with
the preset's look). It never writes rosace.blend or any other file.
"""
import hashlib
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
sys.path.insert(0, PIPE)
sys.path.insert(0, os.path.join(PIPE, "rosace_v2"))

import bpy  # noqa: E402
from mathutils import Vector as V  # noqa: E402

from rosace import common, materials, posing, render  # noqa: E402
import figure_pose  # noqa: E402   (read-only use: apply_pose, load_pose, measure)

BUILD = r"D:\Dex\Projects\dex-place-art\rosace\build"
CANON = os.path.join(BUILD, "rosace.blend")
LANE = os.path.join(BUILD, "lanes", "finish-F1.blend")
POSES = os.path.join(REPO, "art", "rosace", "poses")
SHAPE = os.path.join(REPO, "art", "rosace", "figure", "shape.json")
CFG = json.load(open(os.path.join(HERE, "f1.json"), encoding="utf-8"))

# shot name -> (pose files in order of preference, expression key for the face stamps)
SHOTS = {
    "idle": (["idle_appeal.json", "idle_appeal_A.json"], "idle_hero"),
    "n1": (["n1_contact.json"], "n1_contact"),
    "back": (["back_appeal.json", "back_appeal_A.json"], "idle_hero"),
}
PASSES = ("id", "normal", "depth", "light", "albedo", "beauty")


def hexrgb(h):
    """sRGB hex -> the float triple the Raw view transform writes back as the same bytes"""
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5))


def pose_file(names):
    for n in names:
        p = os.path.join(POSES, n)
        if os.path.exists(p):
            return p
    raise SystemExit(f"none of {names} in {POSES}")


# ---------------------------------------------------------------------------- the painterly branch
F1_TAG = "f1"


def _src(nodes, name, i):
    n = nodes.get(name)
    if n is None or not n.inputs[0].is_linked:
        return None
    return n.inputs[0].links[0].from_node


def build_ramp(ramp, tones, t, soft):
    """6 tones, 5 thresholds. Each tone owns [t[i-1], t[i]]; soft widens every boundary into a linear blend
    of width soft * (distance between the two tone centres)."""
    cr = ramp.color_ramp
    cr.interpolation = "LINEAR"
    edges = [0.0] + list(t) + [1.0]
    centres = [(edges[i] + edges[i + 1]) / 2 for i in range(6)]
    stops = []
    for i in range(6):
        lo = edges[i] if i == 0 else edges[i] + soft * (centres[i] - edges[i])
        hi = edges[i + 1] if i == 5 else edges[i + 1] - soft * (edges[i + 1] - centres[i])
        stops.append((max(0.0, lo), tones[i]))
        stops.append((min(1.0, max(lo + 1e-4, hi)), tones[i]))
    els = cr.elements
    while len(els) > 1:
        els.remove(els[-1])
    els[0].position = stops[0][0]
    els[0].color = hexrgb(stops[0][1]) + (1.0,)
    for pos, h in stops[1:]:
        e = els.new(pos)
        e.color = hexrgb(h) + (1.0,)


def add_f1(name, look):
    """add (or rebuild) the painterly branch on one material; returns its emission node"""
    m = bpy.data.materials.get(name)
    mc = CFG["materials"].get(name)
    if m is None or mc is None:
        return None
    nt = m.node_tree
    nodes = nt.nodes
    for n in [n for n in nodes if n.get("f1")]:
        nodes.remove(n)
    lc = _src(nodes, "pass_light", 0)
    enc = _src(nodes, "pass_normal", 0)
    if lc is None or enc is None:
        print("F1 WARN no light/normal pass on", name)
        return None
    v_s = lc.inputs[0].links[0].from_socket
    ao_s = lc.inputs[1].links[0].from_socket
    spec_s = lc.inputs[2].links[0].from_socket if lc.inputs[2].is_linked else None
    camn = enc.inputs[0].links[0].from_socket

    def N(tp, **kw):
        n = nodes.new(tp)
        n["f1"] = True
        for k, v in kw.items():
            setattr(n, k, v)
        return n

    L = nt.links.new

    def sock(coll, ident):
        return next(x for x in coll if x.identifier == ident)

    def val(nm, x):
        n = N("ShaderNodeValue")
        n.name = nm
        n.outputs[0].default_value = x
        return n.outputs[0]

    def math_(op, a, b=None, clamp=False):
        n = N("ShaderNodeMath", operation=op, use_clamp=clamp)
        for i, x in enumerate((a, b)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                n.inputs[i].default_value = x
            else:
                L(x, n.inputs[i])
        return n.outputs[0]

    tex = val("f1_tex", look["tex"])
    nsc = val("f1_nscale", 30.0)
    bnc = val("f1_bounce", look["bounce"] * mc.get("bounce", 0.0))
    cav = val("f1_cav", look["cav"])
    rimk = val("f1_rim", look["rim"] * mc.get("rim", 0.0))
    # brush noise on the world position (stills: stable per pose)
    geo = N("ShaderNodeNewGeometry")
    sc_ = N("ShaderNodeVectorMath", operation="SCALE")
    L(geo.outputs["Position"], sc_.inputs[0])
    L(nsc, sc_.inputs["Scale"])
    noi = N("ShaderNodeTexNoise")
    noi.noise_dimensions = "3D"
    noi.inputs["Scale"].default_value = 1.0
    noi.inputs["Detail"].default_value = 1.5
    noi.inputs["Roughness"].default_value = 0.55
    noi.inputs["Distortion"].default_value = 0.6
    L(sc_.outputs[0], noi.inputs["Vector"])
    nz = math_("SUBTRACT", noi.outputs["Fac"], 0.5)
    nz = math_("MULTIPLY", nz, 2.0)
    nz = math_("MULTIPLY", nz, tex)
    # reflected light: down-facing (camera space) shadow side
    sep = N("ShaderNodeSeparateXYZ")
    L(camn, sep.inputs[0])
    down = math_("MULTIPLY", sep.outputs[1], -1.0)
    down = math_("MAXIMUM", down, 0.0)
    t_half = mc["t"][3]
    shade = math_("DIVIDE", v_s, t_half)
    shade = math_("SUBTRACT", 1.0, shade, clamp=True)
    b = math_("MULTIPLY", down, shade)
    b = math_("MULTIPLY", b, bnc)
    # cavity
    occ = math_("SUBTRACT", 1.0, ao_s)
    occ = math_("MULTIPLY", occ, cav)
    v2 = math_("ADD", v_s, nz)
    v2 = math_("ADD", v2, b)
    v2 = math_("SUBTRACT", v2, occ, clamp=True)
    ramp = N("ShaderNodeValToRGB")
    ramp.name = "f1_ramp"
    build_ramp(ramp, mc["tones"], mc["t"], look["soft"])
    L(v2, ramp.inputs[0])
    col = ramp.outputs[0]
    if spec_s is not None and mc.get("spec"):
        mx = N("ShaderNodeMix", data_type="RGBA")
        L(spec_s, sock(mx.inputs, "Factor_Float"))
        L(col, sock(mx.inputs, "A_Color"))
        sock(mx.inputs, "B_Color").default_value = hexrgb(mc["spec"]) + (1.0,)
        col = sock(mx.outputs, "Result_Color")
    # rim: grazing normals facing the rim direction (screen upper left, away from the key light)
    rx, ry = CFG["rim_dir_cam"]
    rn = math.hypot(rx, ry)
    dxy = N("ShaderNodeVectorMath", operation="DOT_PRODUCT")
    L(camn, dxy.inputs[0])
    dxy.inputs[1].default_value = (rx / rn, ry / rn, 0.0)
    face = N("ShaderNodeMapRange")
    face.inputs["From Min"].default_value = 0.15
    face.inputs["From Max"].default_value = 0.55
    L(dxy.outputs["Value"], face.inputs["Value"])
    graze = N("ShaderNodeMapRange")
    graze.inputs["From Min"].default_value = CFG.get("rim_graze", [0.55, 0.30])[0]
    graze.inputs["From Max"].default_value = CFG.get("rim_graze", [0.55, 0.30])[1]
    L(sep.outputs[2], graze.inputs["Value"])
    rim = math_("MULTIPLY", face.outputs["Result"], graze.outputs["Result"])
    rim = math_("MULTIPLY", rim, rimk)
    # the rim lifts the local colour toward the light colour, never to white (PX-P34)
    mxr = N("ShaderNodeMix", data_type="RGBA", blend_type="SCREEN")
    L(rim, sock(mxr.inputs, "Factor_Float"))
    L(col, sock(mxr.inputs, "A_Color"))
    sock(mxr.inputs, "B_Color").default_value = hexrgb(CFG["rim_color"]) + (1.0,)
    col = sock(mxr.outputs, "Result_Color")
    em = N("ShaderNodeEmission")
    em.name = "pass_f1"
    L(col, em.inputs[0])
    materials.PASS_NODES.setdefault(name, {})["f1"] = em
    return em


def set_look(look, px):
    """set the look's values on every f1 branch (ramps rebuilt for softness) and the noise scale for px"""
    ppm = px / bpy.data.objects["rosace_rig"]["rosace_height"]
    nscale = ppm / look["nscale_px"]          # noise feature about nscale_px sprite px
    for name, mc in CFG["materials"].items():
        m = bpy.data.materials.get(name)
        if m is None:
            continue
        nd = m.node_tree.nodes
        if nd.get("f1_ramp") is None:
            continue
        build_ramp(nd["f1_ramp"], mc["tones"], mc["t"], look["soft"])
        nd["f1_tex"].outputs[0].default_value = look["tex"]
        nd["f1_nscale"].outputs[0].default_value = nscale
        nd["f1_bounce"].outputs[0].default_value = look["bounce"] * mc.get("bounce", 0.0)
        nd["f1_cav"].outputs[0].default_value = look["cav"]
        nd["f1_rim"].outputs[0].default_value = look["rim"] * mc.get("rim", 0.0)


# ---------------------------------------------------------------------------- face pass (author_faces_pass.py's
# landmark code, repeated here because that script poses with posing.py, which ignores the appeal poses' figure
# block; the numbers written are the same kind: projected MMD head features at sprite scale)
REFS = ("ref_eyes", "ref_eyes_white", "ref_eyes_highlight", "ref_eyeblow", "ref_eyelid", "ref_eyelush", "ref_mouth")


def _points(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    world = [ob.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    return world, [v.co.copy() for v in ob.data.vertices]


def facepass(sc, meta, still):
    arm = posing.arm_obj()
    pb = arm.pose.bones
    M = arm.matrix_world
    head = pb["J_Bip_C_Head"]
    Mh = M @ head.matrix
    R3 = Mh.to_3x3() @ head.bone.matrix_local.inverted().to_3x3()
    hs_world, hs_rest = _points(bpy.data.objects["head_skin"])
    front = [i for i, p in enumerate(hs_rest) if abs(p.x) < 0.012]
    eye_rest = [arm.data.bones[f"J_Adj_{s}_FaceEye"].head_local for s in "LR"]
    eyes_z = sum(e.z for e in eye_rest) / 2
    chin_i = min((i for i in front if hs_rest[i].y < eye_rest[0].y + 0.02), key=lambda i: hs_rest[i].z)
    nose_i = min((i for i in front if hs_rest[i].z < hs_rest[chin_i].z + 0.8 * (eyes_z - hs_rest[chin_i].z)),
                 key=lambda i: hs_rest[i].y)
    refs = {n: _points(bpy.data.objects[n]) for n in REFS if n in bpy.data.objects}
    ss = meta["ss"]
    cam = sc.camera
    bpy.context.view_layer.update()
    cb = (cam.matrix_world.to_3x3() @ V((0, 0, 1))).normalized()
    right = (cam.matrix_world.to_3x3() @ V((1, 0, 0))).normalized()
    up = (cam.matrix_world.to_3x3() @ V((0, 1, 0))).normalized()

    def P(p):
        x, y, z = render.project(sc, p)
        return [round(x / ss, 3), round(y / ss, 3), round(z, 4)]

    def axis(v):
        w = (R3 @ v).normalized()
        return [round(w.dot(right), 4), round(-w.dot(up), 4), round(w.dot(cb), 4)]

    out = {"_doc": "f1_blender.py facepass (author_faces_pass.py's format): projected MMD head landmarks, sprite px",
           "px": meta["px"], "ss": ss, "canvas": meta["canvas"], "anchor": meta["anchor"],
           "axes": {"fwd": axis(V((0, -1, 0))), "up": axis(V((0, 0, 1))), "left": axis(V((1, 0, 0)))},
           "chin": P(hs_world[chin_i]), "nose": P(hs_world[nose_i]),
           "eye_bones": {s: P(M @ pb[f"J_Adj_{s}_FaceEye"].head) for s in "LR"}, "refs": {}}
    for n, (world, rest) in refs.items():
        sides = {}
        for s, sign in (("L", 1), ("R", -1)):
            pts = [P(w) for w, r in zip(world, rest) if r.x * sign > 0]
            if pts:
                sides[s] = pts
        if n == "ref_mouth":
            sides = {"C": [P(w) for w in world]}
        out["refs"][n] = sides
    json.dump(out, open(os.path.join(still, "facepass.json"), "w"), indent=0)


# ---------------------------------------------------------------------------- main
def check_bust():
    cur = json.load(open(SHAPE, encoding="utf-8"))["current"]
    bj = os.path.join(BUILD, "rosace_build.json")
    built = json.load(open(bj)).get("integrated", {}).get("bust", {}).get("variant")
    return {"shape_json_current": cur, "rosace_blend_bust": built, "match": cur == built}


def render_all(out, shots, pxs, ss, looks, save_lane):
    bpy.ops.wm.open_mainfile(filepath=CANON)
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    bust = check_bust()
    print("F1 bust", bust)
    if not bust["match"]:
        raise SystemExit("rosace.blend's bust is not shape.json's current: rebuild the lane base first")
    for name in CFG["materials"]:
        add_f1(name, CFG["looks"][looks[0]])
    rep = {"blend": CANON, "blend_sha256": hashlib.sha256(open(CANON, "rb").read()).hexdigest(), "bust": bust,
           "f1_json_sha1": hashlib.sha1(open(os.path.join(HERE, "f1.json"), "rb").read()).hexdigest()[:12],
           "shots": {}}
    for shot in shots:
        files, expr = SHOTS[shot]
        path = pose_file(files)
        P, _ = figure_pose.load_pose(path)
        meta_p = figure_pose.apply_pose(P)
        bpy.context.view_layer.update()
        sha = hashlib.sha1(open(path, "rb").read()).hexdigest()[:12]
        cam = P.get("camera", {})
        yaw, elev = float(cam.get("yaw", 60.0)), float(cam.get("elev", 10.0))
        rep["shots"][shot] = {"pose": path, "pose_sha1": sha, "yaw": yaw, "elev": elev, "expr": expr}
        for px in pxs:
            d = os.path.join(out, shot, f"px{px}")
            os.makedirs(d, exist_ok=True)
            shot_m = render.setup_shot(sc, px, yaw=yaw, elev=elev, ss=ss)
            render.render_passes(sc, d, PASSES)
            for lk in looks:
                set_look(CFG["looks"][lk], px)
                materials.set_pass("f1")
                sc.render.filepath = os.path.join(d, f"f1_{lk}.png")
                bpy.ops.render.render(write_still=True)
            materials.set_pass("beauty")
            anchors = posing.anchors(sc, px)
            render.write_meta(os.path.join(d, "meta.json"), shot_m,
                              {"pose": meta_p.get("name"), "expression": meta_p.get("expression"), "pose_sha1": sha,
                               "pose_file": path, "passes": list(PASSES) + [f"f1_{lk}" for lk in looks],
                               "anchors": anchors, "frames": None, "thong": None, "applier": "figure_pose",
                               "f1": {"looks": looks, "expr": expr, "shot": shot}})
            facepass(sc, json.load(open(os.path.join(d, "meta.json"))), d)
            try:
                lm = figure_pose.measure(posing.arm_obj(), dict(P, camera={"yaw": yaw, "elev": elev}), pxs=(px,),
                                         anchors={px: shot_m["anchor"]})
                json.dump(lm, open(os.path.join(d, "landmarks.json"), "w", encoding="utf-8"), indent=1)
            except Exception as e:   # landmarks are for the checks only; a failure never blocks the render
                print("F1 WARN landmarks", shot, px, e)
            print("F1 RENDERED", d, shot_m["canvas"], flush=True)
    os.makedirs(out, exist_ok=True)
    json.dump(rep, open(os.path.join(out, "_render.json"), "w"), indent=1)
    if save_lane:
        assert os.path.basename(LANE) == "finish-F1.blend"
        P, _ = figure_pose.load_pose(pose_file(SHOTS["idle"][0]))
        figure_pose.apply_pose(P)
        set_look(CFG["looks"][looks[-1]], 144)
        materials.set_pass("f1")
        bpy.ops.wm.save_as_mainfile(filepath=LANE, compress=True, copy=True)
        print("F1 LANE SAVED", LANE)


def main():
    argv = common.args_after_dashes(sys.argv)
    cmd = argv[0] if argv else "render"
    if cmd != "render":
        raise SystemExit("usage: f1_blender.py -- render --out <dir> [...]")
    out = os.path.abspath(common.arg(argv, "--out", os.path.join(BUILD, "lanes", "finish-F1", "renders")))
    assert "rosace.blend" not in out
    shots = common.arg(argv, "--shots", "idle,n1,back").split(",")
    pxs = [int(x) for x in common.arg(argv, "--px", "144,80").split(",")]
    looks = common.arg(argv, "--looks", ",".join(CFG["looks"])).split(",")
    render_all(out, shots, pxs, common.arg(argv, "--ss", 4, int), looks, common.arg(argv, "--save-lane", False, bool))


main()
