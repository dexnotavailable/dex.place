"""Palette-exact toon materials with every render pass in one node tree.

The spike's measured method: EEVEE, Raw view transform, filter size 0, 1 sample, dither 0,
emission shaders with Constant colour ramps, so the PNG holds the palette bytes exactly.

Additions over the spike (the spike critics' asks):
  * 'ao' point attribute multiplies the light before the ramp: baked occlusion and authored
    crease masks push folds and contact lines into the deep band.
  * view-space specular band (hair sheen, gold/blade glint) from a camera-space half vector
    that the renderer sets per shot (node 'spec_h').
  * backfaces fall into the deep band (inside of sleeves, tabard underside).
Passes: beauty, albedo, id, normal, depth.  set_pass() relinks every material's output.
"""
import bpy

from .common import hex2rgb, load_palette

PASS_NODES = {}
PAL = None


def palette():
    global PAL
    if PAL is None:
        PAL = load_palette()
    return PAL


def code_rgb(code):
    return hex2rgb(palette()["colors"][code])


def make_material(name, spec_cfg=None, depth_range=(8.0, 16.0)):
    P = palette()
    cfg = P["materials"][name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m["rosace_id"] = cfg["id"]
    nt = m.node_tree
    nt.nodes.clear()
    N, L = nt.nodes.new, nt.links.new
    out = N("ShaderNodeOutputMaterial")
    # light value
    diff = N("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = N("ShaderNodeShaderToRGB")
    L(diff.outputs[0], s2r.inputs[0])
    bw = N("ShaderNodeRGBToBW")
    L(s2r.outputs["Color"], bw.inputs[0])
    ao = N("ShaderNodeAttribute")
    ao.attribute_type = "GEOMETRY"
    ao.attribute_name = "ao"
    mul = N("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    L(bw.outputs[0], mul.inputs[0])
    L(ao.outputs["Fac"], mul.inputs[1])
    # lift: an ambient term so the unlit side still separates shadow from deep
    amb = N("ShaderNodeMath")
    amb.operation = "MULTIPLY_ADD"
    amb.name = "ambient"
    amb.inputs[1].default_value = 0.82
    L(mul.outputs[0], amb.inputs[0])
    # ambient is also occluded
    amb_ao = N("ShaderNodeMath")
    amb_ao.operation = "MULTIPLY"
    amb_ao.inputs[0].default_value = 0.16
    L(ao.outputs["Fac"], amb_ao.inputs[1])
    L(amb_ao.outputs[0], amb.inputs[2])
    geo = N("ShaderNodeNewGeometry")
    mixb = N("ShaderNodeMix")
    mixb.data_type = "FLOAT"
    L(geo.outputs["Backfacing"], mixb.inputs["Factor"])
    L(amb.outputs[0], mixb.inputs["A"])
    mixb.inputs["B"].default_value = 0.02
    ramp = N("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    els = ramp.color_ramp.elements
    while len(els) < 4:
        els.new(0.5)
    for i, (pos, code) in enumerate(zip(cfg["t"], cfg["ramp"])):
        els[i].position = pos
        els[i].color = code_rgb(code) + (1,)
    L(mixb.outputs["Result"], ramp.inputs[0])
    col = ramp.outputs[0]
    # camera-space normal
    vt = N("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"
    vt.convert_from = "WORLD"
    vt.convert_to = "CAMERA"
    L(geo.outputs["Normal"], vt.inputs[0])
    flip = N("ShaderNodeVectorMath")
    flip.operation = "MULTIPLY"
    flip.inputs[1].default_value = (1, 1, -1)     # OpenGL: x right, y up, z toward viewer
    L(vt.outputs[0], flip.inputs[0])
    cam_n = flip.outputs[0]
    sp = cfg.get("spec")
    if sp and sp.get("mode") == "ring":
        # angel ring: an arc where the camera-space normal tilts up by a set amount, facing
        # the viewer, on the light side; it follows each clump's curvature across the crown
        # instead of pooling into one blob where N = H (round 1)
        sep = N("ShaderNodeSeparateXYZ")
        L(cam_n, sep.inputs[0])
        facs = []
        for comp, op, val in ((1, "GREATER_THAN", sp["y0"]), (1, "LESS_THAN", sp["y1"]),
                              (2, "GREATER_THAN", sp.get("zmin", 0.3)), (0, "GREATER_THAN", sp.get("xmin", -0.3))):
            c = N("ShaderNodeMath")
            c.operation = op
            c.inputs[1].default_value = val
            L(sep.outputs[comp], c.inputs[0])
            facs.append(c.outputs[0])
        f = facs[0]
        for g in facs[1:]:
            mm = N("ShaderNodeMath")
            mm.operation = "MULTIPLY"
            L(f, mm.inputs[0])
            L(g, mm.inputs[1])
            f = mm.outputs[0]
        lit = N("ShaderNodeMath")
        lit.operation = "GREATER_THAN"
        lit.inputs[1].default_value = cfg["t"][1]
        L(mixb.outputs["Result"], lit.inputs[0])
        f2 = N("ShaderNodeMath")
        f2.operation = "MULTIPLY"
        L(f, f2.inputs[0])
        L(lit.outputs[0], f2.inputs[1])
        mixs = N("ShaderNodeMix")
        mixs.data_type = "RGBA"
        L(f2.outputs[0], mixs.inputs["Factor"])
        L(col, mixs.inputs["A"])
        mixs.inputs["B"].default_value = code_rgb(sp["code"]) + (1,)
        col = mixs.outputs["Result"]
    elif sp:
        h = N("ShaderNodeCombineXYZ")
        h.name = "spec_h"
        h.inputs[0].default_value, h.inputs[1].default_value, h.inputs[2].default_value = 0.35, 0.45, 0.82
        dot = N("ShaderNodeVectorMath")
        dot.operation = "DOT_PRODUCT"
        L(cam_n, dot.inputs[0])
        L(h.outputs[0], dot.inputs[1])
        gt = N("ShaderNodeMath")
        gt.operation = "GREATER_THAN"
        gt.inputs[1].default_value = sp["thr"]
        L(dot.outputs["Value"], gt.inputs[0])
        fac = gt.outputs[0]
        if sp.get("band"):
            lt = N("ShaderNodeMath")
            lt.operation = "LESS_THAN"
            lt.inputs[1].default_value = sp["thr"] + sp["band"]
            L(dot.outputs["Value"], lt.inputs[0])
            both = N("ShaderNodeMath")
            both.operation = "MULTIPLY"
            L(gt.outputs[0], both.inputs[0])
            L(lt.outputs[0], both.inputs[1])
            fac = both.outputs[0]
        # only on the lit side and never on occluded pixels
        lit = N("ShaderNodeMath")
        lit.operation = "GREATER_THAN"
        lit.inputs[1].default_value = cfg["t"][2]
        L(mixb.outputs["Result"], lit.inputs[0])
        f2 = N("ShaderNodeMath")
        f2.operation = "MULTIPLY"
        L(fac, f2.inputs[0])
        L(lit.outputs[0], f2.inputs[1])
        mixs = N("ShaderNodeMix")
        mixs.data_type = "RGBA"
        L(f2.outputs[0], mixs.inputs["Factor"])
        L(col, mixs.inputs["A"])
        mixs.inputs["B"].default_value = code_rgb(sp["code"]) + (1,)
        col = mixs.outputs["Result"]
    em_toon = N("ShaderNodeEmission")
    L(col, em_toon.inputs[0])
    # albedo: the lit colour, flat
    em_alb = N("ShaderNodeEmission")
    em_alb.inputs[0].default_value = code_rgb(cfg["ramp"][2]) + (1,)
    # id: R = material id, G = part id (object pass index)
    oi = N("ShaderNodeObjectInfo")
    div = N("ShaderNodeMath")
    div.operation = "DIVIDE"
    L(oi.outputs["Object Index"], div.inputs[0])
    div.inputs[1].default_value = 255.0
    comb = N("ShaderNodeCombineXYZ")
    comb.inputs[0].default_value = cfg["id"] / 255.0
    L(div.outputs[0], comb.inputs[1])
    em_id = N("ShaderNodeEmission")
    L(comb.outputs[0], em_id.inputs[0])
    # normal: camera space, encoded 0..1
    enc = N("ShaderNodeVectorMath")
    enc.operation = "MULTIPLY_ADD"
    enc.inputs[1].default_value = (0.5, 0.5, 0.5)
    enc.inputs[2].default_value = (0.5, 0.5, 0.5)
    L(cam_n, enc.inputs[0])
    em_n = N("ShaderNodeEmission")
    L(enc.outputs[0], em_n.inputs[0])
    # depth: view z mapped to 0..1 over depth_range (renderer updates the range)
    cd = N("ShaderNodeCameraData")
    dm = N("ShaderNodeMapRange")
    dm.name = "depth_map"
    dm.inputs["From Min"].default_value = depth_range[0]
    dm.inputs["From Max"].default_value = depth_range[1]
    L(cd.outputs["View Z Depth"], dm.inputs["Value"])
    em_d = N("ShaderNodeEmission")
    L(dm.outputs["Result"], em_d.inputs[0])
    for key, node in (("beauty", em_toon), ("albedo", em_alb), ("id", em_id), ("normal", em_n),
                      ("depth", em_d)):
        node.name = "pass_" + key
    PASS_NODES[name] = {"beauty": em_toon, "albedo": em_alb, "id": em_id, "normal": em_n,
                        "depth": em_d, "_out": out}
    L(em_toon.outputs[0], out.inputs["Surface"])
    return m


def make_all():
    for name in palette()["materials"]:
        make_material(name)


def rebind():
    """After loading a .blend, find each material's pass nodes again."""
    PASS_NODES.clear()
    for name in palette()["materials"]:
        m = bpy.data.materials.get(name)
        if not m:
            continue
        nodes = m.node_tree.nodes
        d = {k: nodes["pass_" + k] for k in ("beauty", "albedo", "id", "normal", "depth")}
        d["_out"] = next(n for n in nodes if n.type == "OUTPUT_MATERIAL")
        PASS_NODES[name] = d


def set_pass(p):
    for name, d in PASS_NODES.items():
        nt = bpy.data.materials[name].node_tree
        out = d["_out"]
        for l in list(out.inputs["Surface"].links):
            nt.links.remove(l)
        nt.links.new(d[p].outputs[0], out.inputs["Surface"])


def set_spec_half(h_cam):
    for name in PASS_NODES:
        n = bpy.data.materials[name].node_tree.nodes.get("spec_h")
        if n:
            for i in range(3):
                n.inputs[i].default_value = h_cam[i]


def set_depth_range(a, b):
    for name in PASS_NODES:
        n = bpy.data.materials[name].node_tree.nodes.get("depth_map")
        if n:
            n.inputs["From Min"].default_value = a
            n.inputs["From Max"].default_value = b
