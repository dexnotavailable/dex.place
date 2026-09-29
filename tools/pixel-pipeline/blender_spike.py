"""3D-to-pixel spike: stand-in glaive priestess, one wide sweep, pixel passes.

Run headless (never inside a user's open Blender):
  blender.exe -b --factory-startup --python-exit-code 1 --python blender_spike.py -- \
      --out <dir> [--px 96] [--ss 1] [--save-blend]

Everything is built from Python primitives: no downloads, no image generation.
Output (under --out):
  raw_ss<k>/<pass>/####.png   passes: beauty, albedo, id, normal, depth
  meta_ss<k>.json             palettes, ids, camera, per-frame anchors, smear samples
  stand-in.blend              (with --save-blend)
Conventions: character faces +X, her right side is -Y (toward the camera).
"""
import bpy
import bmesh
import math
import json
import os
import sys
from mathutils import Vector, Matrix, Quaternion
from bpy_extras.object_utils import world_to_camera_view

# ----------------------------------------------------------------------------
# args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None, cast=str):
    if name in argv:
        i = argv.index(name)
        if cast is bool:
            return True
        return cast(argv[i + 1])
    return default


OUT = arg("--out", os.path.join(os.getcwd(), "spike-out"))
PX = arg("--px", 96, int)            # character height in native pixels
SS = arg("--ss", 1, int)             # supersample factor (render k x native, downsample later)
SAVE_BLEND = arg("--save-blend", False, bool)
CAM_YAW = arg("--yaw", 30.0, float)  # degrees toward her front
CAM_ELEV = arg("--elev", 12.0, float)
SHADOWS = arg("--shadows", False, bool)  # cast shadows made noisy clusters; off by default
PASSES = arg("--passes", "beauty,albedo,id,normal,depth").split(",")
os.makedirs(OUT, exist_ok=True)

CHAR_H = 1.62
PPM = PX / CHAR_H                     # native pixels per metre
CANVAS = (int(round(360 * PX / 96)), int(round(184 * PX / 96)))  # native canvas (w, h)
ROOT_PX = (0.47, 0.90)                # where the feet land on the canvas (fraction of w, h from top)
FRAMES = list(range(0, 24))           # 24 frames @ 60 fps

# ----------------------------------------------------------------------------
# palettes (sRGB hex; Raw view transform writes these bytes exactly)
# order: line, deep, shadow, lit, highlight
PALETTES = {
    "skin":   ["#5a2f3c", "#a8686e", "#dba196", "#f7d2bd", "#fff0e6"],
    "suit":   ["#463a66", "#8f82b0", "#c3bad8", "#f1ece6", "#ffffff"],
    "tabard": ["#463a66", "#8f82b0", "#c3bad8", "#f1ece6", "#ffffff"],
    "sleeve": ["#463a66", "#8f82b0", "#c3bad8", "#f1ece6", "#ffffff"],
    "stock":  ["#463a66", "#8f82b0", "#c3bad8", "#f1ece6", "#ffffff"],
    "gold":   ["#3d1e16", "#7a4026", "#b8742f", "#eab64c", "#fff0a6"],
    "hair":   ["#0c0a16", "#17142a", "#252242", "#3c3a62", "#6b6aa0"],
    "shoe":   ["#0c0b18", "#1b1c34", "#2a2d4c", "#40466e", "#6a73a0"],
    "shaft":  ["#0c0b18", "#1b1c34", "#2a2d4c", "#40466e", "#6a73a0"],
    "blade":  ["#262c46", "#56628a", "#8d9cbc", "#d8e3ef", "#ffffff"],
    "edge":   ["#262c46", "#8d9cbc", "#d8e3ef", "#f4f8ff", "#ffffff"],
}
MAT_IDS = {name: i + 1 for i, name in enumerate(PALETTES)}
# ramp stops on N.L (deep, shadow, lit, highlight)
BAND_T = {"default": [0.0, 0.12, 0.46, 0.93],
          "skin": [0.0, 0.05, 0.30, 0.93],
          "hair": [0.0, 0.05, 0.40, 0.86],
          "blade": [0.0, 0.10, 0.45, 0.80],
          "gold": [0.0, 0.08, 0.40, 0.82]}


def hex2rgb(h):
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5))


# ----------------------------------------------------------------------------
# scene reset
def reset_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    for a in list(bpy.data.armatures):
        bpy.data.armatures.remove(a)
    sc = bpy.context.scene
    sc.render.fps = 60
    sc.frame_start = FRAMES[0]
    sc.frame_end = FRAMES[-1]
    return sc


SC = reset_scene()

# ----------------------------------------------------------------------------
# materials: each material carries every pass; set_pass() relinks the output.
MATS = {}
PASS_NODES = {}


def make_material(name):
    pal = PALETTES[name]
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    N = nt.nodes.new
    L = nt.links.new
    # toon
    diff = N("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = N("ShaderNodeShaderToRGB")
    L(diff.outputs[0], s2r.inputs[0])
    bw = N("ShaderNodeRGBToBW")
    L(s2r.outputs["Color"], bw.inputs[0])
    geo = N("ShaderNodeNewGeometry")
    # backfaces (sleeve/tabard interiors) forced into the deep band
    mix = N("ShaderNodeMix")
    mix.data_type = "FLOAT"
    L(geo.outputs["Backfacing"], mix.inputs["Factor"])
    L(bw.outputs[0], mix.inputs["A"])
    mix.inputs["B"].default_value = 0.02
    ramp = N("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    t = BAND_T.get(name, BAND_T["default"])
    els = ramp.color_ramp.elements
    while len(els) < 4:
        els.new(0.5)
    for i, (pos, col) in enumerate(zip(t, pal[1:5])):
        els[i].position = pos
        els[i].color = hex2rgb(col) + (1,)
    L(mix.outputs["Result"], ramp.inputs[0])
    em_toon = N("ShaderNodeEmission")
    L(ramp.outputs[0], em_toon.inputs[0])
    # albedo: flat lit colour
    em_alb = N("ShaderNodeEmission")
    em_alb.inputs[0].default_value = hex2rgb(pal[3]) + (1,)
    # id: R = material id, G = object pass index (part id)
    oi = N("ShaderNodeObjectInfo")
    div = N("ShaderNodeMath")
    div.operation = "DIVIDE"
    L(oi.outputs["Object Index"], div.inputs[0])
    div.inputs[1].default_value = 255.0
    comb = N("ShaderNodeCombineXYZ")
    comb.inputs[0].default_value = MAT_IDS[name] / 255.0
    L(div.outputs[0], comb.inputs[1])
    em_id = N("ShaderNodeEmission")
    L(comb.outputs[0], em_id.inputs[0])
    # normal: camera space, OpenGL convention (x right, y up, z toward viewer)
    vt = N("ShaderNodeVectorTransform")
    vt.vector_type = "NORMAL"
    vt.convert_from = "WORLD"
    vt.convert_to = "CAMERA"
    L(geo.outputs["Normal"], vt.inputs[0])
    flip = N("ShaderNodeVectorMath")
    flip.operation = "MULTIPLY"
    flip.inputs[1].default_value = (1, 1, -1)
    L(vt.outputs[0], flip.inputs[0])
    enc = N("ShaderNodeVectorMath")
    enc.operation = "MULTIPLY_ADD"
    enc.inputs[1].default_value = (0.5, 0.5, 0.5)
    enc.inputs[2].default_value = (0.5, 0.5, 0.5)
    L(flip.outputs[0], enc.inputs[0])
    em_n = N("ShaderNodeEmission")
    L(enc.outputs[0], em_n.inputs[0])
    # depth: view z mapped to 0..1 over [CAM_DIST-3, CAM_DIST+3]
    cd = N("ShaderNodeCameraData")
    dm = N("ShaderNodeMapRange")
    dm.inputs["From Min"].default_value = CAM_DIST - 3.0
    dm.inputs["From Max"].default_value = CAM_DIST + 3.0
    L(cd.outputs["View Z Depth"], dm.inputs["Value"])
    em_d = N("ShaderNodeEmission")
    L(dm.outputs["Result"], em_d.inputs[0])
    PASS_NODES[name] = {"beauty": em_toon, "albedo": em_alb, "id": em_id,
                        "normal": em_n, "depth": em_d, "_out": out}
    MATS[name] = m
    return m


def set_pass(p):
    for name, d in PASS_NODES.items():
        nt = MATS[name].node_tree
        out = d["_out"]
        for l in list(out.inputs["Surface"].links):
            nt.links.remove(l)
        nt.links.new(d[p].outputs[0], out.inputs["Surface"])


CAM_DIST = 12.0
for _n in PALETTES:
    make_material(_n)

# ----------------------------------------------------------------------------
# skeleton (rest pose, armature space == world)
V = Vector
BONES = []  # (name, head, tail, parent, connect, deform)


def bone(name, head, tail, parent=None, connect=False, deform=True):
    BONES.append((name, V(head), V(tail), parent, connect, deform))


bone("root", (0, 0, 0), (0, 0.25, 0), None, deform=False)
bone("hips", (-0.01, 0, 0.90), (-0.005, 0, 1.02), "root")
bone("spine", (-0.005, 0, 1.02), (0.005, 0, 1.14), "hips", True)
bone("chest", (0.005, 0, 1.14), (0.0, 0, 1.29), "spine", True)
bone("neck", (0.0, 0, 1.29), (0.01, 0, 1.38), "chest", True)
bone("head", (0.01, 0, 1.38), (0.01, 0, 1.62), "neck", True)

ARM = {}
for side, s in (("L", 1), ("R", -1)):
    sh = V((-0.005, s * 0.165, 1.27))
    elbow = sh + V((0.02, s * 0.55, -0.83)).normalized() * 0.26
    fdir = V((0.30, s * 0.45, -0.84)).normalized()
    wrist = elbow + fdir * 0.235
    hand_end = wrist + fdir * 0.085
    ARM[side] = dict(sh=sh, elbow=elbow, wrist=wrist, hand=hand_end, fdir=fdir)
    bone(f"shoulder.{side}", (0.0, s * 0.035, 1.265), sh, "chest")
    bone(f"upperarm.{side}", sh, elbow, f"shoulder.{side}", True)
    bone(f"forearm.{side}", elbow, wrist, f"upperarm.{side}", True)
    bone(f"hand.{side}", wrist, hand_end, f"forearm.{side}", True)
    hip = V((0.0, s * 0.088, 0.885))
    knee = V((0.022, s * 0.095, 0.475))
    ankle = V((-0.005, s * 0.095, 0.075))
    toe = V((0.125, s * 0.10, 0.02))
    ARM[side].update(hip=hip, knee=knee, ankle=ankle, toe=toe)
    bone(f"thigh.{side}", hip, knee, "hips")
    bone(f"shin.{side}", knee, ankle, f"thigh.{side}", True)
    bone(f"foot.{side}", ankle, toe, f"shin.{side}", True)
    # controls
    bone(f"foot_ik.{side}", ankle, toe, "root", deform=False)
    bone(f"pole_knee.{side}", knee + V((0.55, 0.02 * s, 0.0)), knee + V((0.65, 0.02 * s, 0)),
         f"foot_ik.{side}", deform=False)
    bone(f"pole_arm.{side}", elbow + V((-0.35, s * 0.15, -0.05)),
         elbow + V((-0.45, s * 0.15, -0.05)), "chest", deform=False)
    # secondary: sleeve chain hinged on the forearm
    s0 = elbow.lerp(wrist, 0.35)
    s1 = wrist + fdir * 0.05
    s2 = wrist + fdir * 0.19
    bone(f"slv1.{side}", s0, s1, f"forearm.{side}")
    bone(f"slv2.{side}", s1, s2, f"slv1.{side}", True)
    ARM[side].update(s0=s0, s1=s1, s2=s2)

# weapon: grip at head, shaft along +Z at rest, blade edge toward +X
GRIP_REST = V((0.30, -0.20, 0.90))
bone("weapon", GRIP_REST, GRIP_REST + V((0, 0, 0.3)), "root", deform=True)
bone("hand_ik.R", GRIP_REST + V((0, 0, 0.05)), GRIP_REST + V((0, 0, 0.15)), "weapon", deform=False)
bone("hand_ik.L", GRIP_REST + V((0, 0, -0.33)), GRIP_REST + V((0, 0, -0.23)), "weapon", deform=False)

# hair chains (parent head)
HAIR_PTS = {
    "hair_c": [(-0.125, 0, 1.47), (-0.132, 0, 1.30), (-0.128, 0, 1.10), (-0.12, 0, 0.88)],
    "hair_l": [(-0.11, 0.085, 1.45), (-0.10, 0.10, 1.28), (-0.092, 0.102, 1.11), (-0.085, 0.097, 0.95)],
    "hair_r": [(-0.11, -0.085, 1.45), (-0.10, -0.10, 1.28), (-0.092, -0.102, 1.11), (-0.085, -0.097, 0.95)],
    "lock_l": [(0.078, 0.108, 1.45), (0.072, 0.106, 1.33), (0.062, 0.10, 1.21)],
    "lock_r": [(0.078, -0.108, 1.45), (0.072, -0.106, 1.33), (0.062, -0.10, 1.21)],
}
for ch, pts in HAIR_PTS.items():
    for k in range(len(pts) - 1):
        bone(f"{ch}{k + 1}", pts[k], pts[k + 1], "head" if k == 0 else f"{ch}{k}", k > 0)


def tabard_x(z):
    return 0.082 + 0.05 * (0.985 - z)


TAB_Z = [0.985, 0.83, 0.675, 0.52, 0.34]
TAB_PTS = [(tabard_x(z), 0.0, z) for z in TAB_Z]
for k in range(len(TAB_PTS) - 1):
    bone(f"tab{k + 1}", TAB_PTS[k], TAB_PTS[k + 1], "hips" if k == 0 else f"tab{k}", k > 0)


def build_armature():
    arm_data = bpy.data.armatures.new("rig")
    arm = bpy.data.objects.new("rig", arm_data)
    SC.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    for name, h, t, parent, connect, deform in BONES:
        b = eb.new(name)
        b.head, b.tail = h, t
        b.roll = 0.0
        b.use_deform = deform
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
    # IK pole angles (computed from rest)
    poles = {}

    def signed_angle(v1, v2, normal):
        a = v1.angle(v2)
        return -a if v1.cross(v2).dot(normal) < 0 else a

    for side in ("L", "R"):
        for base, tip, pole in ((f"upperarm.{side}", f"forearm.{side}", f"pole_arm.{side}"),
                                (f"thigh.{side}", f"shin.{side}", f"pole_knee.{side}")):
            b0, b1, p = eb[base], eb[tip], eb[pole]
            pole_normal = (b1.tail - b0.head).cross(p.head - b0.head)
            proj = pole_normal.cross(b0.tail - b0.head)
            poles[tip] = signed_angle(b0.x_axis, proj, b0.tail - b0.head)
    bpy.ops.object.mode_set(mode="OBJECT")
    pb = arm.pose.bones
    for side in ("L", "R"):
        c = pb[f"forearm.{side}"].constraints.new("IK")
        c.target, c.subtarget = arm, f"hand_ik.{side}"
        c.pole_target, c.pole_subtarget = arm, f"pole_arm.{side}"
        c.pole_angle = poles[f"forearm.{side}"]
        c.chain_count = 2
        c = pb[f"shin.{side}"].constraints.new("IK")
        c.target, c.subtarget = arm, f"foot_ik.{side}"
        c.pole_target, c.pole_subtarget = arm, f"pole_knee.{side}"
        c.pole_angle = poles[f"shin.{side}"]
        c.chain_count = 2
        c = pb[f"foot.{side}"].constraints.new("COPY_ROTATION")
        c.target, c.subtarget = arm, f"foot_ik.{side}"
    for p in pb:
        p.rotation_mode = "QUATERNION"
    return arm


ARM_OBJ = build_armature()
REST = {b.name: b.matrix_local.copy() for b in ARM_OBJ.data.bones}
SEGS = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in ARM_OBJ.data.bones}

# ----------------------------------------------------------------------------
# mesh helpers
PART_ID = [0]


def new_obj(name, bm, mats, smooth=True, subsurf=1):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    SC.collection.objects.link(ob)
    for mn in mats:
        me.materials.append(MATS[mn])
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    PART_ID[0] += 1
    ob.pass_index = PART_ID[0]
    mod = ob.modifiers.new("arm", "ARMATURE")
    mod.object = ARM_OBJ
    if subsurf:
        ss = ob.modifiers.new("sub", "SUBSURF")
        ss.levels = subsurf
        ss.render_levels = subsurf
    return ob


def frame_axes(t, ref):
    t = t.normalized()
    u = ref - t * ref.dot(t)
    if u.length < 1e-6:
        u = V((1, 0, 0)) - t * t.x
    u.normalize()
    v = t.cross(u)
    return u, v


def loft_bm(rings, nseg=12, cap0=True, cap1=True, ref=V((0, 1, 0))):
    """rings: list of (center, ru, rv[, ref]) ; ring axis from neighbours.
    returns bm, ring_verts, ring_index_of_face"""
    bm = bmesh.new()
    cs = [V(r[0]) for r in rings]
    rv = []
    for i, r in enumerate(rings):
        c = cs[i]
        a = cs[min(i + 1, len(cs) - 1)] - cs[max(i - 1, 0)]
        rref = V(r[3]) if len(r) > 3 else ref
        u, v = frame_axes(a, rref)
        ring = []
        for k in range(nseg):
            ang = 2 * math.pi * k / nseg
            ring.append(bm.verts.new(c + u * math.cos(ang) * r[1] + v * math.sin(ang) * r[2]))
        rv.append(ring)
    face_ring = {}
    for i in range(len(rv) - 1):
        for k in range(nseg):
            f = bm.faces.new((rv[i][k], rv[i][(k + 1) % nseg], rv[i + 1][(k + 1) % nseg], rv[i + 1][k]))
            face_ring[f] = i
    if cap0:
        d = (cs[0] - cs[1]).normalized() * min(rings[0][1], rings[0][2]) * 0.6
        pole = bm.verts.new(cs[0] + d)
        for k in range(nseg):
            f = bm.faces.new((rv[0][(k + 1) % nseg], rv[0][k], pole))
            face_ring[f] = -1
    if cap1:
        d = (cs[-1] - cs[-2]).normalized() * min(rings[-1][1], rings[-1][2]) * 0.6
        pole = bm.verts.new(cs[-1] + d)
        for k in range(nseg):
            f = bm.faces.new((rv[-1][k], rv[-1][(k + 1) % nseg], pole))
            face_ring[f] = len(rv) - 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm, rv, face_ring


def densify(rings, steps=2):
    """insert interpolated rings (linear in all params)"""
    out = []
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for s in range(steps):
            t = s / steps
            c = V(a[0]).lerp(V(b[0]), t)
            r = (c, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t) + tuple(a[3:])
            out.append(r)
    out.append(rings[-1])
    return out


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (a + ab * t - p).length


def weight_by_bones(ob, bones, power=6.0, bias=None):
    """smooth skin weights from distance to candidate bone segments (rest pose)"""
    groups = {b: ob.vertex_groups.new(name=b) for b in bones}
    for v in ob.data.vertices:
        p = v.co
        ws = []
        for b in bones:
            d = seg_dist(p, *SEGS[b]) + 1e-3
            w = 1.0 / d ** power
            if bias and b in bias:
                w *= bias[b]
            ws.append(w)
        tot = sum(ws)
        for b, w in zip(bones, ws):
            w /= tot
            if w > 0.01:
                groups[b].add([v.index], w, "REPLACE")


def weight_rigid(ob, b):
    g = ob.vertex_groups.new(name=b)
    g.add([v.index for v in ob.data.vertices], 1.0, "REPLACE")


def weight_chain_by_param(ob, chain_pts, bones, head_bone, z_attach=None):
    """weights for hair/tabard: project vertex onto chain polyline; blend neighbouring bones"""
    groups = {b: ob.vertex_groups.new(name=b) for b in bones + [head_bone]}
    pts = [V(p) for p in chain_pts]
    for v in ob.data.vertices:
        p = v.co
        best = (1e9, 0, 0.0)
        for k in range(len(pts) - 1):
            a, b = pts[k], pts[k + 1]
            ab = b - a
            t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
            d = (a + ab * t - p).length
            if d < best[0]:
                best = (d, k, t)
        _, k, t = best
        # position along chain in bone units
        s = k + t
        if z_attach is not None and p.z > z_attach:
            groups[head_bone].add([v.index], 1.0, "REPLACE")
            continue
        # blend: first 35% of first bone partly on head
        w = {}
        if s < 0.35:
            w[head_bone] = 1.0 - s / 0.35
            w[bones[0]] = s / 0.35
        else:
            i = min(int(s), len(bones) - 1)
            f = s - i
            w[bones[i]] = 1.0
            if f > 0.7 and i + 1 < len(bones):
                bl = (f - 0.7) / 0.6
                w[bones[i]] = 1.0 - bl
                w[bones[i + 1]] = bl
            if f < 0.3 and i > 0:
                bl = (0.3 - f) / 0.6
                w[bones[i]] = 1.0 - bl
                w[bones[i - 1]] = bl
        for b, ww in w.items():
            if ww > 0.001:
                groups[b].add([v.index], ww, "REPLACE")


def ellipsoid_bm(center, rx, ry, rz, segs=20, rings=12, shape=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        if shape:
            x, y, z = shape(x, y, z)
        v.co = V((center[0] + x * rx, center[1] + y * ry, center[2] + z * rz))
    return bm


def set_face_mats(ob, fn):
    me = ob.data
    names = [m.name for m in me.materials]
    for p in me.polygons:
        c = p.center
        n = p.normal
        mn = fn(c, n)
        p.material_index = names.index(mn)


# ----------------------------------------------------------------------------
# body parts
PARTS = {}


def build_body():
    # torso: (z, x_center, half-width Y, half-depth X)
    T = [(0.795, -0.012, 0.070, 0.055), (0.85, -0.018, 0.128, 0.080), (0.90, -0.020, 0.142, 0.086),
         (0.95, -0.015, 0.128, 0.078), (1.00, -0.008, 0.100, 0.066), (1.05, -0.004, 0.098, 0.066),
         (1.11, 0.000, 0.110, 0.072), (1.17, 0.000, 0.121, 0.076), (1.23, -0.005, 0.130, 0.072),
         (1.27, -0.010, 0.118, 0.064), (1.305, -0.004, 0.058, 0.048)]
    rings = [((x, 0, z), w, d, (0, 1, 0)) for z, x, w, d in T]
    bm, rv, fr = loft_bm(densify(rings, 2), nseg=16, ref=V((0, 1, 0)))
    ob = new_obj("torso", bm, ["skin", "suit"])

    def torso_mat(c, n):
        ay = abs(c.y)
        if c.z > 1.25:
            return "suit" if ay < 0.07 else "skin"          # high collar, bare shoulders
        if c.z < 0.95:
            w_cov = 0.030 + (c.z - 0.795) * 0.85           # high-cut V
            return "suit" if ay < w_cov else "skin"
        if n.x < -0.35 and c.z > 0.975:
            return "skin"                                  # open back
        if n.x > 0.5 and ay < 0.024 and 1.14 < c.z < 1.215:
            return "skin"                                  # keyhole
        return "suit"

    set_face_mats(ob, torso_mat)
    weight_by_bones(ob, ["hips", "spine", "chest", "neck", "thigh.L", "thigh.R"],
                    bias={"thigh.L": 0.25, "thigh.R": 0.25})
    PARTS["torso"] = ob

    # chest volumes
    for s in (1, -1):
        bm = ellipsoid_bm((0.058, s * 0.056, 1.172), 0.050, 0.050, 0.048, 14, 10)
        o = new_obj(f"chestvol{s}", bm, ["suit"])
        weight_rigid(o, "chest")

    # neck + collar
    bm, _, _ = loft_bm([((0.004, 0, 1.25), 0.034, 0.034), ((0.008, 0, 1.33), 0.032, 0.031),
                        ((0.012, 0, 1.41), 0.030, 0.030)], nseg=10)
    o = new_obj("neck", bm, ["skin"])
    weight_by_bones(o, ["chest", "neck", "head"])
    bm, rv, fr = loft_bm([((0.002, 0, 1.262), 0.058, 0.054), ((0.006, 0, 1.30), 0.050, 0.048),
                          ((0.010, 0, 1.345), 0.049, 0.047), ((0.012, 0, 1.372), 0.054, 0.051)],
                         nseg=14, cap0=False, cap1=False)
    o = new_obj("collar", bm, ["suit", "gold"])
    set_face_mats(o, lambda c, n: "gold" if c.z > 1.355 else "suit")
    weight_by_bones(o, ["chest", "neck"])
    # collar cross (gold)
    bm = bmesh.new()
    for (cx, cz, sy, sz) in ((0.062, 1.318, 0.009, 0.034), (0.062, 1.326, 0.024, 0.009)):
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r["verts"]:
            v.co = V((cx + v.co.x * 0.012, v.co.y * sy * 2, cz + v.co.z * sz * 2))
    o = new_obj("collarcross", bm, ["gold"], smooth=False, subsurf=0)
    weight_rigid(o, "chest")

    # head: ellipsoid with narrowed jaw
    def head_shape(x, y, z):
        if z < -0.15:
            k = min(1.0, (-z - 0.15) / 0.85)
            y *= 1.0 - 0.42 * k
            x = x * (1.0 - 0.25 * k) + 0.18 * k
        return x, y, z

    bm = ellipsoid_bm((0.014, 0, 1.495), 0.103, 0.093, 0.125, 22, 14, head_shape)
    o = new_obj("head", bm, ["skin"])
    weight_rigid(o, "head")
    PARTS["head"] = o

    # arms
    for side, s in (("L", 1), ("R", -1)):
        A = ARM[side]
        sh, el, wr, he = A["sh"], A["elbow"], A["wrist"], A["hand"]
        inward = sh + V((0, -s * 0.03, 0.01))
        rings = [(inward, 0.044, 0.044), (sh, 0.045, 0.045), (sh.lerp(el, 0.3), 0.040, 0.040),
                 (sh.lerp(el, 0.65), 0.035, 0.035), (el, 0.030, 0.030), (el.lerp(wr, 0.3), 0.031, 0.031),
                 (el.lerp(wr, 0.7), 0.025, 0.024), (wr, 0.021, 0.018), (wr.lerp(he, 0.5), 0.027, 0.013),
                 (he, 0.018, 0.010)]
        bm, _, _ = loft_bm(densify(rings, 2), nseg=10, ref=V((0, 0, 1)))
        o = new_obj(f"arm.{side}", bm, ["skin"])
        weight_by_bones(o, ["chest", f"shoulder.{side}", f"upperarm.{side}", f"forearm.{side}",
                            f"hand.{side}"], bias={"chest": 0.3, f"shoulder.{side}": 0.5})
        # gold armband
        c = sh.lerp(el, 0.42)
        d = (el - sh).normalized() * 0.012
        bm, _, _ = loft_bm([(c - d, 0.043, 0.043), (c + d, 0.042, 0.042)], nseg=12, cap0=False,
                           cap1=False, ref=V((0, 0, 1)))
        o = new_obj(f"armband.{side}", bm, ["gold"])
        weight_rigid(o, f"upperarm.{side}")
        # detached flared sleeve: fitted at the upper arm, then a teardrop drape hanging under the forearm
        fd = A["fdir"]
        ud = (el - sh).normalized()
        hem = wr + fd * 0.08
        # (center, r_vertical, r_horizontal, drop)
        spec = [(sh.lerp(el, 0.60), 0.041, 0.041, 0.0), (sh.lerp(el, 0.85), 0.046, 0.044, 0.004),
                (el, 0.056, 0.048, 0.012), (el.lerp(wr, 0.35), 0.076, 0.052, 0.032),
                (el.lerp(wr, 0.7), 0.090, 0.054, 0.050), (wr, 0.102, 0.056, 0.064),
                (hem, 0.108, 0.054, 0.070)]
        srings = []
        cs = [q[0] for q in spec]
        for i, (c, rvv, rhh, drop) in enumerate(spec):
            a = cs[min(i + 1, len(cs) - 1)] - cs[max(i - 1, 0)]
            u, _ = frame_axes(a, V((0, 0, 1)))
            srings.append((c - u * drop, rvv, rhh, (0, 0, 1)))
        bm, rv, fr = loft_bm(srings, nseg=16, cap0=False, cap1=False, ref=V((0, 0, 1)))
        down = V((0, 0, -1))
        for i in (len(rv) - 3, len(rv) - 2, len(rv) - 1):
            c0 = V(srings[i][0])
            for vv in rv[i]:
                radial = (vv.co - c0).normalized()
                k = max(0.0, radial.dot(down))
                ext = (0.015, 0.05, 0.12)[i - (len(rv) - 3)] * k ** 2.5
                vv.co += fd * ext * 0.8 + down * ext
        o = new_obj(f"sleeve.{side}", bm, ["sleeve", "gold"])
        me = o.data
        for p in me.polygons:
            c = p.center
            t_hem = (c - wr).dot(fd)
            first = (c - sh).dot(ud) < 0.26 * 0.655
            p.material_index = 1 if (t_hem > 0.040 or first) else 0
        # explicit weights along the arm: upperarm -> forearm -> slv1 -> slv2 (drape tip)
        gU, gF = o.vertex_groups.new(name=f"upperarm.{side}"), o.vertex_groups.new(name=f"forearm.{side}")
        g1, g2 = o.vertex_groups.new(name=f"slv1.{side}"), o.vertex_groups.new(name=f"slv2.{side}")
        flen = (wr - el).length
        for v in me.vertices:
            pco = v.co
            a_f = (pco - el).dot(fd) / flen
            if a_f < 0:
                a_u = (pco - sh).dot(ud) / (el - sh).length
                wf = max(0.0, min(1.0, (a_u - 0.8) / 0.4))
                ws = {gU: 1 - wf, gF: wf}
            else:
                wF = max(0.0, 1.0 - a_f / 0.75)
                below = max(0.0, min(1.0, (el.lerp(wr, min(a_f, 1.0)) - pco).dot(V((0, 0, 1))) / 0.12))
                w2 = max(0.0, min(1.0, (a_f - 0.6) / 0.6)) * below
                w1 = max(0.0, 1.0 - wF - w2)
                ws = {gF: wF, g1: w1, g2: w2}
            tot = sum(ws.values()) or 1.0
            for g, w in ws.items():
                if w / tot > 0.001:
                    g.add([v.index], w / tot, "REPLACE")
        PARTS[f"sleeve.{side}"] = o

    # legs
    for side, s in (("L", 1), ("R", -1)):
        A = ARM[side]
        hp, kn, an = A["hip"], A["knee"], A["ankle"]
        rings = [(hp + V((0, -s * 0.01, 0.06)), 0.070, 0.072), (hp, 0.077, 0.080),
                 (hp.lerp(kn, 0.3), 0.073, 0.075), (hp.lerp(kn, 0.62), 0.063, 0.065),
                 (hp.lerp(kn, 0.86), 0.051, 0.052), (kn, 0.045, 0.046),
                 (kn.lerp(an, 0.25) + V((-0.008, 0, 0)), 0.048, 0.051), (kn.lerp(an, 0.6), 0.038, 0.039),
                 (kn.lerp(an, 0.88), 0.028, 0.029), (an, 0.026, 0.027)]
        bm, rv, fr = loft_bm(densify(rings, 2), nseg=12, ref=V((0, 1, 0)))
        o = new_obj(f"leg.{side}", bm, ["skin", "gold", "stock"])
        set_face_mats(o, lambda c, n: "skin" if c.z > 0.642 else ("gold" if c.z > 0.612 else "stock"))
        weight_by_bones(o, ["hips", f"thigh.{side}", f"shin.{side}", f"foot.{side}"],
                        bias={"hips": 0.4})
        # shoe
        heel = an + V((-0.035, 0, -0.035))
        rings = [(heel, 0.030, 0.036, (0, 0, 1)), (an + V((0.01, 0, -0.02)), 0.032, 0.040, (0, 0, 1)),
                 (an + V((0.07, 0, -0.045)), 0.030, 0.028, (0, 0, 1)),
                 (an + V((0.13, 0, -0.055)), 0.022, 0.017, (0, 0, 1)),
                 (an + V((0.155, 0, -0.058)), 0.010, 0.010, (0, 0, 1))]
        bm, _, _ = loft_bm(rings, nseg=10, ref=V((0, 0, 1)))
        o = new_obj(f"shoe.{side}", bm, ["shoe"])
        weight_rigid(o, f"foot.{side}")
        # garter straps: belt -> stocking top (front + side)
        for (bx, by, tx, ty) in ((0.045, 0.105, 0.070, 0.082), (-0.045, 0.142, -0.03, 0.148)):
            a = V((bx, s * by, 0.895))
            b = V((tx + kn.x * 0.0, s * ty, 0.628))
            bm, _, _ = loft_bm([(a, 0.0075, 0.0075), (a.lerp(b, 0.5), 0.0075, 0.0075), (b, 0.0075, 0.0075)],
                               nseg=6, ref=V((1, 0, 0)))
            o = new_obj(f"strap.{side}{bx}", bm, ["gold"], subsurf=0)
            weight_by_bones(o, ["hips", f"thigh.{side}"], power=2.0)

    # garter belt
    T2 = [(0.887, -0.020, 0.150, 0.093), (0.915, -0.018, 0.143, 0.090)]
    bm, _, _ = loft_bm([((x, 0, z), w, d, (0, 1, 0)) for z, x, w, d in T2], nseg=18, cap0=False, cap1=False)
    o = new_obj("belt", bm, ["gold"])
    weight_rigid(o, "hips")

    # tabard: strip hanging in front, pointed hem
    cols = [-1.0, -0.86, -0.3, 0.3, 0.86, 1.0]
    zs = [0.985 - (0.985 - 0.34) * i / 14 for i in range(15)]
    bm = bmesh.new()
    grid = []
    for zi, z in enumerate(zs):
        w = 0.070 + 0.040 * (0.985 - z) / 0.645
        row = []
        for c in cols:
            y = c * w
            x = tabard_x(z) - 0.022 * c * c
            zz = z
            if zi == len(zs) - 1:
                zz = z - 0.065 * (1 - abs(c))
            row.append(bm.verts.new(V((x, y, zz))))
        grid.append(row)
    for zi in range(len(zs) - 1):
        for ci in range(len(cols) - 1):
            bm.faces.new((grid[zi][ci], grid[zi][ci + 1], grid[zi + 1][ci + 1], grid[zi + 1][ci]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = new_obj("tabard", bm, ["tabard", "gold"], subsurf=1)
    me = o.data
    for p in me.polygons:
        c = p.center
        w = 0.070 + 0.040 * (0.985 - c.z) / 0.645
        edge = abs(c.y) > 0.86 * w or c.z < 0.375
        p.material_index = 1 if edge else 0
    weight_chain_by_param(o, TAB_PTS, ["tab1", "tab2", "tab3", "tab4"], "hips")
    PARTS["tabard"] = o
    # tabard cross emblem (slightly in front)
    bm = bmesh.new()
    zc = 0.47
    xc = tabard_x(zc) + 0.012
    for (sy, z0, z1) in ((0.011, zc - 0.075, zc + 0.06), (0.042, zc + 0.012, zc + 0.032)):
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r["verts"]:
            v.co = V((xc + v.co.x * 0.01, v.co.y * sy * 2, (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    o = new_obj("tabcross", bm, ["gold"], smooth=False, subsurf=0)
    weight_chain_by_param(o, TAB_PTS, ["tab1", "tab2", "tab3", "tab4"], "hips")


def build_hair():
    # cap
    def cap_shape(x, y, z):
        return x, y, z

    bm = ellipsoid_bm((-0.004, 0, 1.512), 0.119, 0.108, 0.136, 22, 14, cap_shape)
    kill = []
    for v in bm.verts:
        xl = (v.co.x + 0.004) / 0.119
        yl = v.co.y / 0.108
        zl = (v.co.z - 1.512) / 0.136
        if (xl > 0.15 and zl < 0.42 and abs(yl) < 0.80) or zl < -0.62:
            kill.append(v)
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    o = new_obj("haircap", bm, ["hair"])
    weight_rigid(o, "head")
    # bangs
    bm = bmesh.new()
    for i, y in enumerate((-0.07, -0.036, 0.0, 0.036, 0.07)):
        tipz = 1.488 if i == 2 else (1.470 if i in (0, 4) else 1.478)
        pts = [(0.078, y * 0.9, 1.600), (0.112, y * 1.02, 1.555), (0.121, y * 1.1, 1.515),
               (0.118, y * 1.16, tipz)]
        rr = [(0.024, 0.013), (0.021, 0.012), (0.014, 0.009), (0.004, 0.004)]
        b2, _, _ = loft_bm([(pts[k], rr[k][0], rr[k][1], (0, 1, 0)) for k in range(4)], nseg=8)
        me = bpy.data.meshes.new("tmp")
        b2.to_mesh(me)
        b2.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    o = new_obj("bangs", bm, ["hair"])
    weight_rigid(o, "head")
    # side locks and back clumps along chains
    specs = {
        "lock_l": dict(start=(0.07, 0.10, 1.57), r=[(0.022, 0.013), (0.020, 0.012), (0.014, 0.008), (0.004, 0.003)]),
        "lock_r": dict(start=(0.07, -0.10, 1.57), r=[(0.022, 0.013), (0.020, 0.012), (0.014, 0.008), (0.004, 0.003)]),
        "hair_c": dict(start=(-0.06, 0, 1.585), r=[(0.088, 0.05), (0.086, 0.045), (0.070, 0.034), (0.050, 0.026), (0.008, 0.005)]),
        "hair_l": dict(start=(-0.05, 0.06, 1.575), r=[(0.055, 0.035), (0.055, 0.032), (0.046, 0.028), (0.034, 0.02), (0.005, 0.004)]),
        "hair_r": dict(start=(-0.05, -0.06, 1.575), r=[(0.055, 0.035), (0.055, 0.032), (0.046, 0.028), (0.034, 0.02), (0.005, 0.004)]),
    }
    for ch, sp in specs.items():
        pts = [V(sp["start"])] + [V(p) for p in HAIR_PTS[ch]]
        rings = [(pts[k], sp["r"][k][0], sp["r"][k][1], (0, 1, 0)) for k in range(len(pts))]
        bm, _, _ = loft_bm(densify(rings, 3), nseg=10, ref=V((0, 1, 0)))
        o = new_obj(f"hair.{ch}", bm, ["hair"])
        nb = len(HAIR_PTS[ch]) - 1
        weight_chain_by_param(o, HAIR_PTS[ch], [f"{ch}{k + 1}" for k in range(nb)], "head",
                              z_attach=HAIR_PTS[ch][0][2] + 0.03)


def build_glaive():
    G = GRIP_REST
    parts = []
    # shaft
    bm, _, _ = loft_bm([(G + V((0, 0, -0.55)), 0.019, 0.019), (G + V((0, 0, 0.3)), 0.019, 0.019),
                        (G + V((0, 0, 1.12)), 0.019, 0.019)], nseg=8, ref=V((1, 0, 0)))
    o = new_obj("shaft", bm, ["shaft"], subsurf=0)
    weight_rigid(o, "weapon")
    # gold fittings
    bm = bmesh.new()
    for (z0, z1, r0, r1) in ((-0.60, -0.53, 0.012, 0.030), (-0.53, -0.47, 0.028, 0.026),
                             (1.06, 1.10, 0.026, 0.030), (1.10, 1.17, 0.034, 0.034),
                             (0.28, 0.31, 0.024, 0.024)):
        b2, _, _ = loft_bm([(G + V((0, 0, z0)), r0, r0), (G + V((0, 0, z1)), r1, r1)], nseg=10,
                           ref=V((1, 0, 0)))
        me = bpy.data.meshes.new("tmp")
        b2.to_mesh(me)
        b2.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    # cross-guard ornament at the blade base (holy motif)
    for (cx, cz, sx, sz) in ((0.0, 1.19, 0.19, 0.035), (-0.02, 1.19, 0.035, 0.10)):
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r["verts"]:
            v.co = G + V((cx + v.co.x * sx, v.co.y * 0.045, cz + v.co.z * sz))
    o = new_obj("fittings", bm, ["gold"], smooth=False, subsurf=0)
    weight_rigid(o, "weapon")
    # crescent blade in the XZ plane, edge toward +X, bevelled (spine thick, edge sharp)
    base = 1.20
    N = 16
    spine, edge = [], []
    for i in range(N + 1):
        t = i / N
        a = 0.74 * t
        b_s = -0.025 - 0.10 * t * t
        spine.append((b_s, a))
        a_e = 0.02 + 0.80 * t
        b_e = -0.02 + 0.34 * math.sin(math.pi * min(1.0, t ** 0.75)) * (1.0 - 0.15 * t) - 0.10 * t * t
        edge.append((b_e, a_e))
    tip = (-0.13, 0.86)
    bm = bmesh.new()
    th = 0.014
    ST = [bm.verts.new(G + V((b, th, base + a))) for b, a in spine]
    SB = [bm.verts.new(G + V((b, -th, base + a))) for b, a in spine]
    ED = [bm.verts.new(G + V((b, 0.0, base + a))) for b, a in edge]
    # bevel line: 78% of the way from spine to edge, slightly thinner than the spine
    BT, BB = [], []
    for (bs, as_), (be, ae) in zip(spine, edge):
        bb_, ab_ = bs + (be - bs) * 0.78, as_ + (ae - as_) * 0.78
        BT.append(bm.verts.new(G + V((bb_, th * 0.35, base + ab_))))
        BB.append(bm.verts.new(G + V((bb_, -th * 0.35, base + ab_))))
    TP = bm.verts.new(G + V((tip[0], 0.0, base + tip[1])))
    edge_faces = []
    for i in range(N):
        bm.faces.new((ST[i], ST[i + 1], BT[i + 1], BT[i]))
        edge_faces.append(bm.faces.new((BT[i], BT[i + 1], ED[i + 1], ED[i])))
        edge_faces.append(bm.faces.new((ED[i], ED[i + 1], BB[i + 1], BB[i])))
        bm.faces.new((BB[i], BB[i + 1], SB[i + 1], SB[i]))
        bm.faces.new((SB[i], SB[i + 1], ST[i + 1], ST[i]))
    bm.faces.new((ST[0], BT[0], ED[0], BB[0], SB[0]))
    bm.faces.new((ST[N], TP, BT[N]))
    edge_faces.append(bm.faces.new((BT[N], TP, ED[N])))
    edge_faces.append(bm.faces.new((ED[N], TP, BB[N])))
    bm.faces.new((BB[N], TP, SB[N]))
    bm.faces.new((SB[N], TP, ST[N]))
    for fce in edge_faces:
        fce.material_index = 1
    # back hook
    hk = [bm.verts.new(G + V(p)) for p in ((-0.03, th, base + 0.04), (-0.03, -th, base + 0.04),
                                          (-0.20, 0, base + 0.02), (-0.03, 0, base + 0.20))]
    bm.faces.new((hk[0], hk[2], hk[1]))
    bm.faces.new((hk[0], hk[3], hk[2]))
    bm.faces.new((hk[1], hk[2], hk[3]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = new_obj("blade", bm, ["blade", "edge"], smooth=False, subsurf=0)
    weight_rigid(o, "weapon")
    # sample points on the cutting edge for smear tracking (rest, world)
    return {"edge": [list(G + V((b, 0, base + a))) for b, a in edge[::2]] + [list(G + V((tip[0], 0, base + tip[1])))],
            "shaft_top": list(G + V((0, 0, 1.12))), "butt": list(G + V((0, 0, -0.60)))}


build_body()
build_hair()
BLADE_PTS = build_glaive()

# ----------------------------------------------------------------------------
# animation: pose parameters sampled per frame from keyed poses with custom easing
READY = dict(hx=0.02, hy=0.0, hz=-0.085, hip_yaw=-20, hip_pitch=6, hip_roll=0,
             spine_yaw=-4, spine_pitch=4, chest_yaw=-6, chest_pitch=2, chest_roll=0,
             neck_yaw=12, head_yaw=16, head_pitch=-2, head_roll=0,
             fLx=0.24, fLy=0.13, fLyaw=10, fRx=-0.24, fRy=-0.15, fRyaw=-30, fRz=0.0, fLz=0.0,
             gx=0.30, gy=-0.20, gz=0.92, wyaw=12, wpitch=-24, wroll=92)
# anticipation: coil to her right, weight back, low
WINDUP = dict(READY, hx=-0.09, hz=-0.14, hip_yaw=-48, hip_pitch=-4, hip_roll=5,
              spine_yaw=-20, spine_pitch=-6, chest_yaw=-26, chest_pitch=-8, chest_roll=-6,
              neck_yaw=40, head_yaw=42, head_pitch=6,
              fLx=0.36, fLy=0.16, fLyaw=15, fRx=-0.28, fRy=-0.18, fRyaw=-50,
              gx=-0.18, gy=-0.36, gz=1.06, wyaw=-165, wpitch=-12, wroll=95)
HOLD = dict(WINDUP, hx=-0.10, hz=-0.15, hip_yaw=-52, spine_yaw=-22, chest_yaw=-28,
            gx=-0.20, gy=-0.34, gz=1.06, wyaw=-172, wpitch=-14, wroll=96)
# strike (3 frames)
S1 = dict(HOLD, hx=0.0, hz=-0.15, hip_yaw=-16, hip_pitch=8, hip_roll=0,
          spine_yaw=-6, spine_pitch=8, chest_yaw=-4, chest_pitch=6, chest_roll=0,
          neck_yaw=12, head_yaw=12, head_pitch=0,
          fLx=0.44, fRyaw=-30,
          gx=0.10, gy=-0.44, gz=0.98, wyaw=-112, wpitch=-12, wroll=40)
S2 = dict(S1, hx=0.18, hz=-0.17, hip_yaw=24, hip_pitch=14, hip_roll=-4,
          spine_yaw=14, spine_pitch=10, chest_yaw=22, chest_pitch=8, chest_roll=-5,
          neck_yaw=-28, head_yaw=-32, head_pitch=6,
          fLx=0.50, fLy=0.16, fRx=-0.24, fRy=-0.16, fRyaw=-5,
          gx=0.60, gy=-0.08, gz=0.98, wyaw=-10, wpitch=-2, wroll=6)
S3 = dict(S2, hx=0.21, hip_yaw=38, spine_yaw=20, chest_yaw=28, chest_pitch=6,
          neck_yaw=-40, head_yaw=-40,
          gx=0.40, gy=0.26, gz=1.02, wyaw=72, wpitch=12, wroll=4)
# follow-through overshoot, rebound, settle back to guard
OVER = dict(S3, hx=0.22, hz=-0.15, hip_yaw=44, spine_yaw=24, chest_yaw=32, chest_roll=-7,
            neck_yaw=-45, head_yaw=-45,
            gx=0.10, gy=0.40, gz=1.08, wyaw=126, wpitch=22, wroll=20)
REBOUND = dict(OVER, hip_yaw=38, spine_yaw=20, chest_yaw=26, neck_yaw=-38, head_yaw=-38,
               gx=0.16, gy=0.36, gz=1.08, wyaw=114, wpitch=18, wroll=45)
RECOVER = dict(READY, hx=0.14, hz=-0.09, hip_yaw=5, hip_pitch=6, spine_yaw=4, chest_yaw=4, chest_pitch=2,
               neck_yaw=0, head_yaw=2, head_pitch=-2,
               fLx=0.46, fLy=0.15, fLyaw=10, fRx=-0.20, fRy=-0.14, fRyaw=-10,
               gx=0.34, gy=-0.02, gz=0.98, wyaw=28, wpitch=-20, wroll=92)


def e_inout(t):
    return t * t * (3 - 2 * t)


def e_out(t):
    return 1 - (1 - t) ** 3


def e_in(t):
    return t ** 2.2


def e_lin(t):
    return t


# (frame, pose, easing used to arrive at this key)
KEYS = [(0, READY, e_lin), (6, WINDUP, e_inout), (9, HOLD, e_lin), (10, S1, e_in), (11, S2, e_lin),
        (12, S3, e_lin), (14, OVER, e_out), (16, REBOUND, e_inout), (23, RECOVER, e_out)]


def pose_at(t):
    if t <= KEYS[0][0]:
        return dict(KEYS[0][1])
    for (fa, pa, _), (fb, pb, eb) in zip(KEYS, KEYS[1:]):
        if fa <= t <= fb:
            u = eb((t - fa) / (fb - fa))
            return {k: pa[k] + (pb[k] - pa[k]) * u for k in pa}
    return dict(KEYS[-1][1])


def rq(axis, deg):
    return Quaternion(V(axis), math.radians(deg))


def world_rot(yaw=0.0, pitch=0.0, roll=0.0):
    return rq((0, 0, 1), yaw) @ rq((0, 1, 0), pitch) @ rq((1, 0, 0), roll)


def weapon_matrix(p):
    yaw, pitch, roll = math.radians(p["wyaw"]), math.radians(p["wpitch"]), math.radians(p["wroll"])
    D = V((math.cos(pitch) * math.cos(yaw), math.cos(pitch) * math.sin(yaw), math.sin(pitch)))
    T = V((-math.sin(yaw), math.cos(yaw), 0.0))  # direction of travel for increasing yaw
    T = (T - D * T.dot(D)).normalized()
    U = D.cross(T).normalized()
    E = T * math.cos(roll) + U * math.sin(roll)  # blade edge direction
    X = E
    Y = D
    Z = X.cross(Y)
    M = Matrix((X, Y, Z)).transposed().to_4x4()
    M.translation = V((p["gx"], p["gy"], p["gz"]))
    return M


def apply_pose(p):
    pb = ARM_OBJ.pose.bones

    def set_local_rot(name, q_world):
        r = REST[name].to_quaternion()
        pb[name].rotation_quaternion = r.inverted() @ q_world @ r

    hip_r = REST["hips"].to_3x3()
    pb["hips"].location = hip_r.inverted() @ V((p["hx"], p["hy"], p["hz"]))
    set_local_rot("hips", world_rot(p["hip_yaw"], p["hip_pitch"], p["hip_roll"]))
    set_local_rot("spine", world_rot(p["spine_yaw"], p["spine_pitch"], 0))
    set_local_rot("chest", world_rot(p["chest_yaw"], p["chest_pitch"], p["chest_roll"]))
    set_local_rot("neck", world_rot(p["neck_yaw"], 0, 0))
    set_local_rot("head", world_rot(p["head_yaw"], p["head_pitch"], p["head_roll"]))
    for side in ("L", "R"):
        n = f"foot_ik.{side}"
        rest = REST[n]
        M = Matrix.Translation(V((p[f"f{side}x"], p[f"f{side}y"], ARM[side]["ankle"].z + p[f"f{side}z"])))
        R = rq((0, 0, 1), p[f"f{side}yaw"]).to_matrix().to_4x4()
        rest_rot = rest.to_3x3().to_4x4()
        pb[n].matrix = M @ R @ rest_rot
    pb["weapon"].matrix = weapon_matrix(p)


def key_all(f):
    pb = ARM_OBJ.pose.bones
    for n in ("hips", "spine", "chest", "neck", "head", "foot_ik.L", "foot_ik.R", "weapon"):
        pb[n].keyframe_insert("rotation_quaternion", frame=f)
        pb[n].keyframe_insert("location", frame=f)


bpy.context.view_layer.objects.active = ARM_OBJ
bpy.ops.object.mode_set(mode="POSE")
for f in range(FRAMES[0] - 1, FRAMES[-1] + 2):
    apply_pose(pose_at(f))
    bpy.context.view_layer.update()
    apply_pose(pose_at(f))  # second pass: child matrices after parents settle
    key_all(f)
bpy.ops.object.mode_set(mode="OBJECT")

# check IK reach (does forearm tail sit on the IK target head?)
SC.frame_set(11)
_pb = ARM_OBJ.pose.bones
print("IKCHECK", (_pb["forearm.R"].tail - _pb["hand_ik.R"].head).length,
      (_pb["forearm.L"].tail - _pb["hand_ik.L"].head).length,
      (_pb["shin.L"].tail - _pb["foot_ik.L"].head).length)

# ----------------------------------------------------------------------------
# secondary motion: verlet chains in world space, baked to empties + damped track
CHAINS = {
    "hair_c": dict(parent="head", n=3, stiff=[0.050, 0.030, 0.018], damp=0.030, grav=1.0, cols="hair"),
    "hair_l": dict(parent="head", n=3, stiff=[0.060, 0.034, 0.020], damp=0.035, grav=1.0, cols="hair"),
    "hair_r": dict(parent="head", n=3, stiff=[0.060, 0.034, 0.020], damp=0.035, grav=1.0, cols="hair"),
    "lock_l": dict(parent="head", n=2, stiff=[0.08, 0.05], damp=0.04, grav=1.0, cols="none"),
    "lock_r": dict(parent="head", n=2, stiff=[0.08, 0.05], damp=0.04, grav=1.0, cols="none"),
    "tab": dict(parent="hips", n=4, stiff=[0.10, 0.05, 0.03, 0.02], damp=0.05, grav=1.0, cols="legs"),
    "slv1.L": None, "slv1.R": None,
}
SLEEVE = dict(n=2, stiff=[0.07, 0.04], damp=0.04, grav=1.0, cols="none")


def chain_bones(ch):
    if ch.startswith("slv"):
        side = ch[-1]
        return [f"slv1.{side}", f"slv2.{side}"], f"forearm.{side}", SLEEVE
    spec = CHAINS[ch]
    return [f"{ch}{k + 1}" for k in range(spec["n"])], spec["parent"], spec


SIM_FRAMES = list(range(FRAMES[0] - 1, FRAMES[-1] + 2))


def gather_mats():
    need = {"head", "hips", "forearm.L", "forearm.R", "thigh.L", "thigh.R", "shin.L", "shin.R", "spine", "chest"}
    data = {}
    for f in SIM_FRAMES:
        SC.frame_set(f)
        pb = ARM_OBJ.pose.bones
        data[f] = {n: (pb[n].matrix.copy(), pb[n].head.copy(), pb[n].tail.copy()) for n in need}
    return data


MATS_T = gather_mats()


def interp_mat(A, B, u):
    la, ra, sa = A.decompose()
    lb, rb, sb = B.decompose()
    return Matrix.LocRotScale(la.lerp(lb, u), ra.slerp(rb, u), sa.lerp(sb, u))


def state_at(t):
    f0 = math.floor(t)
    f0 = max(SIM_FRAMES[0], min(SIM_FRAMES[-1] - 1, f0))
    u = max(0.0, min(1.0, t - f0))
    A, B = MATS_T[f0], MATS_T[f0 + 1]
    out = {}
    for n in A:
        out[n] = (interp_mat(A[n][0], B[n][0], u), A[n][1].lerp(B[n][1], u), A[n][2].lerp(B[n][2], u))
    return out


def push_out_capsule(p, a, b, r):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    c = a + ab * t
    d = p - c
    L = d.length
    if L < r:
        if L < 1e-6:
            d = V((1, 0, 0))
            L = 1e-6
        return c + d / L * r
    return p


def simulate(ch):
    bones, parent, spec = chain_bones(ch)
    pts_rest = [SEGS[bones[0]][0]] + [SEGS[b][1] for b in bones]
    lens = [(pts_rest[k + 1] - pts_rest[k]).length for k in range(len(bones))]
    pinv = REST[parent].inverted()
    local = [pinv @ p for p in pts_rest]
    sub = 8
    dt = 1.0 / (60 * sub)
    g = V((0, 0, -9.8)) * spec["grav"]

    def targets(t):
        st = state_at(t)
        M = st[parent][0]
        return [M @ q for q in local], st

    tg, _ = targets(SIM_FRAMES[0])
    P = [q.copy() for q in tg]
    Pp = [q.copy() for q in tg]
    result = {}

    def step(t):
        tg, st = targets(t)
        P[0] = tg[0]
        Pp[0] = tg[0]
        for k in range(1, len(P)):
            vel = (P[k] - Pp[k]) * (1.0 - spec["damp"])
            Pp[k] = P[k].copy()
            P[k] = P[k] + vel + g * dt * dt + (tg[k] - P[k]) * spec["stiff"][k - 1]
        for _ in range(3):
            for k in range(1, len(P)):
                d = P[k] - P[k - 1]
                P[k] = P[k - 1] + d.normalized() * lens[k - 1]
                if spec["cols"] == "legs":
                    for side in ("L", "R"):
                        for bn, r in ((f"thigh.{side}", 0.098), (f"shin.{side}", 0.07)):
                            P[k] = push_out_capsule(P[k], st[bn][1], st[bn][2], r)
                elif spec["cols"] == "hair":
                    P[k] = push_out_capsule(P[k], st["hips"][1], st["chest"][2], 0.125)

    # pre-roll at first frame pose
    for _ in range(90 * sub):
        step(SIM_FRAMES[0])
    for f in SIM_FRAMES:
        for s in range(sub):
            step(f - 1 + (s + 1) / sub if f > SIM_FRAMES[0] else f)
        result[f] = [q.copy() for q in P]
    return bones, result


def bake_chain(ch):
    bones, res = simulate(ch)
    empties = []
    for k in range(1, len(bones) + 1):
        e = bpy.data.objects.new(f"sim_{ch}_{k}", None)
        SC.collection.objects.link(e)
        e.empty_display_size = 0.02
        for f, pts in res.items():
            e.location = pts[k]
            e.keyframe_insert("location", frame=f)
        empties.append(e)
    for k, b in enumerate(bones):
        c = ARM_OBJ.pose.bones[b].constraints.new("DAMPED_TRACK")
        c.target = empties[k]
        c.track_axis = "TRACK_Y"


for ch in ["hair_c", "hair_l", "hair_r", "lock_l", "lock_r", "tab", "slv1.L", "slv1.R"]:
    bake_chain(ch)

# ----------------------------------------------------------------------------
# camera + light
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
W, H = CANVAS
cam_data.ortho_scale = max(W, H) / PPM
cam_data.clip_start = 0.1
cam_data.clip_end = 40.0
CAM = bpy.data.objects.new("cam", cam_data)
SC.collection.objects.link(CAM)
SC.camera = CAM
ya, el = math.radians(CAM_YAW), math.radians(CAM_ELEV)
back = V((math.sin(ya) * math.cos(el), -math.cos(ya) * math.cos(el), math.sin(el)))
fwd = -back
right = fwd.cross(V((0, 0, 1))).normalized()
up = right.cross(fwd).normalized()
# place the world origin (feet) at ROOT_PX on the canvas
ox = (ROOT_PX[0] - 0.5) * W / PPM
oy = (0.5 - ROOT_PX[1]) * H / PPM
target = V((0, 0, 0)) - right * ox - up * oy
CAM.location = target + back * CAM_DIST
CAM.rotation_mode = "QUATERNION"
CAM.rotation_quaternion = fwd.to_track_quat("-Z", "Y")

sun_data = bpy.data.lights.new("key", "SUN")
sun_data.energy = math.pi
sun_data.angle = 0.0
sun_data.use_shadow = SHADOWS
SUN = bpy.data.objects.new("key", sun_data)
SC.collection.objects.link(SUN)
LIGHT_TO = V((0.70, -0.12, 0.70)).normalized()  # direction toward the light (world)
SUN.rotation_mode = "QUATERNION"
SUN.rotation_quaternion = (-LIGHT_TO).to_track_quat("-Z", "Y")
if SC.world is None:
    SC.world = bpy.data.worlds.new("w")
wn = SC.world.node_tree.nodes
bg = next((n for n in wn if n.type == "BACKGROUND"), None)
if bg:
    bg.inputs[1].default_value = 0.0

# render settings
R = SC.render
R.engine = "BLENDER_EEVEE"
R.resolution_x = W * SS
R.resolution_y = H * SS
R.resolution_percentage = 100
R.filter_size = 0.0
R.dither_intensity = 0.0
R.film_transparent = True
R.image_settings.file_format = "PNG"
R.image_settings.color_mode = "RGBA"
R.image_settings.color_depth = "8"
SC.eevee.taa_render_samples = 1
SC.view_settings.view_transform = "Raw"
SC.view_settings.look = "None"
SC.view_settings.exposure = 0.0
SC.view_settings.gamma = 1.0

# ----------------------------------------------------------------------------
# metadata: anchors per frame (eyes, head, blade), smear samples at sub-frames
def proj(p):
    co = world_to_camera_view(SC, CAM, p)
    return [co.x * W, (1.0 - co.y) * H, co.z]


meta = {"px": PX, "ss": SS, "canvas": [W, H], "ppm": PPM, "frames": FRAMES, "fps": 60,
        "palettes": PALETTES, "mat_ids": MAT_IDS,
        "parts": {o.name: o.pass_index for o in SC.objects if o.type == "MESH"},
        "light_cam": list(CAM.matrix_world.to_3x3().inverted() @ LIGHT_TO),
        "depth_range": [CAM_DIST - 3.0, CAM_DIST + 3.0], "cam_yaw": CAM_YAW, "cam_elev": CAM_ELEV,
        "anchors": {}, "smear": {},
        "cam": {"loc": list(CAM.location), "right": list(right), "up": list(up), "fwd": list(fwd)}}
EYE_REST = {"L": V((0.103, 0.040, 1.488)), "R": V((0.103, -0.040, 1.488))}
cam_dir_to = back
for f in FRAMES:
    SC.frame_set(f)
    pb = ARM_OBJ.pose.bones
    Mh = pb["head"].matrix @ REST["head"].inverted()
    head_fwd = (Mh.to_3x3() @ V((1, 0, 0))).normalized()
    a = {"head": proj(Mh @ V((0.014, 0, 1.495))), "head_fwd_dot_cam": head_fwd.dot(cam_dir_to),
         "head_fwd_screen": [head_fwd.dot(right), -head_fwd.dot(up)]}
    mp = Mh @ V((0.100, -0.018, 1.432))
    mn = (Mh.to_3x3() @ V((1.0, -0.25, -0.2))).normalized()
    a["mouth"] = proj(mp) + [mn.dot(cam_dir_to)]
    for side, p in EYE_REST.items():
        wp = Mh @ p
        n = (Mh.to_3x3() @ V((1.0, 0.45 * (1 if side == "L" else -1), 0.1))).normalized()
        a[f"eye_{side}"] = proj(wp) + [n.dot(cam_dir_to)]
    Mw = pb["weapon"].matrix @ REST["weapon"].inverted()
    a["blade_edge"] = [proj(Mw @ V(q)) for q in BLADE_PTS["edge"]]
    a["butt"] = proj(Mw @ V(BLADE_PTS["butt"]))
    a["root"] = proj(V((pb["hips"].head.x, pb["hips"].head.y, 0.0)))
    meta["anchors"][f] = a
# smear samples from the continuous pose function (exact arcs between frames)
Winv = REST["weapon"].inverted()
for f in FRAMES:
    samples = []
    for s in range(0, 49):
        t = f - 2.0 + s * (2.0 / 48)
        M = weapon_matrix(pose_at(t)) @ Winv
        samples.append({"t": t, "tip": proj(M @ V(BLADE_PTS["edge"][-1])),
                        "edge": [proj(M @ V(q)) for q in BLADE_PTS["edge"]],
                        "inner": proj(M @ V(BLADE_PTS["shaft_top"]))})
    meta["smear"][f] = samples

with open(os.path.join(OUT, f"meta_px{PX}_ss{SS}.json"), "w") as fh:
    json.dump(meta, fh)

if SAVE_BLEND:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, f"stand-in_px{PX}.blend"))

# ----------------------------------------------------------------------------
# render every pass as an animation
raw = os.path.join(OUT, f"raw_px{PX}_ss{SS}")
for p in PASSES:
    set_pass(p)
    d = os.path.join(raw, p)
    os.makedirs(d, exist_ok=True)
    R.filepath = os.path.join(d, "")
    bpy.ops.render.render(animation=True)
print("SPIKE_DONE", raw)
