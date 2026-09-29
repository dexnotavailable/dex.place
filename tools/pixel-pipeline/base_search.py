"""Import a candidate base body, measure its proportions and render it (hi-res + ~144 px).

Two halves in one file:

1. Inside the isolated Blender (import, measure, render raw passes):
     python blender_env.py run --python base_search.py -- --src <model> --name <slug>
         --out <dir> [--keep REGEX] [--hide REGEX] [--front -y|+y] [--pmx-scale 0.08]
         [--export-pmx PATH]
   <model> is .pmx/.pmd (MMD Tools), .vrm (VRM add-on), .fbx, .glb/.gltf or .blend (opened
   read-only; never saved). Meshes matching --hide (or not matching --keep) are hidden, so
   hair and outfit can be switched off by name. MMD rigid bodies and joints are counted and
   never rendered. Writes <out>/measure.json and <out>/raw/*.png.

2. Outside Blender (plain Python with numpy + Pillow; builds the sheets and pixel frames):
     python base_search.py --post <out> [--post <out2> ...] --compare <sheet.png>

Measurements are taken on the evaluated mesh at the armature's rest pose, in world units,
and reported in heads (skull top to chin) and as a fraction of height. "Torso" verts are the
ones whose strongest bone is not an arm, hand, finger or head bone, so hanging A-pose hands
never count as hip width. Proportion targets come from docs/character/DESIGN.md section 2
(144 px column: head 24 px, crotch to sole 75 px = 52%, shoulders/waist/hips 27/15/24 px in
three-quarter view).
"""
import json
import math
import os
import re
import sys

try:
    import bpy  # noqa: F401
    from mathutils import Vector
    IN_BLENDER = True
except ImportError:
    IN_BLENDER = False

# DESIGN.md skin ramp S1-S4 and the outline colour; used for both hi-res and pixel renders.
SKIN = ["#b8766f", "#e2a996", "#f3d2b2", "#fbe4cf"]  # dark -> light
OUTLINE = "#181032"
PX_HEIGHT = 144  # figure height in the pixel render
PX_SS = 4        # supersample factor for the pixel render

ARM_KEYS = ("upperarm", "lowerarm", "forearm", "hand", "wrist", "elbow", "finger", "thumb",
            "index", "middle", "ring", "little", "pinky", "arm",
            "腕", "ひじ", "肘", "手首", "手捩", "指")
HEAD_KEYS = ("head", "eye", "face", "jaw", "tongue", "hair", "頭", "目", "あご", "舌", "髪", "顔")
UPPERARM_KEYS = ("upperarm", "upper_arm", "腕", "arm")
KNEE_KEYS = ("lowerleg", "lower_leg", "knee", "shin", "calf", "ひざ", "膝")
ANKLE_KEYS = ("foot", "ankle", "足首")


def hexlin(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def classify(name):
    n = name.lower()
    if any(k in n for k in HEAD_KEYS):
        return "head"
    if "twist" in n and "arm" not in n and "腕" not in n and "手" not in n:
        return "torso"
    if n in ("腕", "左腕", "右腕") or any(k in n for k in ARM_KEYS):
        # shoulder / clavicle bones stay in the torso
        if any(k in n for k in ("shoulder", "clavicle", "肩")) and not any(
                k in n for k in ("upperarm", "腕")):
            return "torso"
        return "arm"
    return "torso"


# --------------------------------------------------------------------------- Blender half

def px_name(view, ph):
    """raw pixel render name; 144 keeps the original name so older outputs still post-process"""
    return f"px_{view}.png" if ph == PX_HEIGHT else f"px{ph}_{view}.png"


def b_args():
    import argparse
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--name", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--keep", default="")
    ap.add_argument("--hide", default="")
    ap.add_argument("--front", default="auto", choices=["auto", "-y", "+y"])
    ap.add_argument("--pmx-scale", type=float, default=0.08)
    ap.add_argument("--export-pmx", default="")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--px-heights", default=str(PX_HEIGHT),
                    help="comma list of figure heights for the pixel renders, e.g. 144,80")
    a = ap.parse_args(argv)
    a.px_heights = [int(x) for x in a.px_heights.split(",") if x]
    return a


def b_clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def b_import(a):
    src = a.src
    ext = os.path.splitext(src)[1].lower()
    info = {"importer": ext}
    if ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=src, load_ui=False)
        for o in bpy.data.objects:
            if o.type in ("CAMERA", "LIGHT"):
                o.hide_render = True
        return info
    b_clear()
    if ext in (".pmx", ".pmd"):
        bpy.ops.mmd_tools.import_model(filepath=src, scale=a.pmx_scale, rename_bones=False,
                                       types={"MESH", "ARMATURE", "PHYSICS", "MORPHS", "DISPLAY"})
    elif ext == ".vrm":
        bpy.ops.import_scene.vrm(filepath=src)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=src)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=src)
    else:
        raise SystemExit(f"unsupported source: {src}")
    return info


def mmd_type(o):
    return getattr(o, "mmd_type", "NONE") or "NONE"


def b_physics_and_morphs():
    rb = [o for o in bpy.data.objects if mmd_type(o) == "RIGID_BODY"]
    jt = [o for o in bpy.data.objects if mmd_type(o) == "JOINT"]
    out = {"rigid_bodies": len(rb), "joints": len(jt)}
    roots = [o for o in bpy.data.objects if mmd_type(o) == "ROOT"]
    if roots:
        r = roots[0].mmd_root
        out["mmd_morphs"] = {k: len(getattr(r, k)) for k in
                             ("vertex_morphs", "bone_morphs", "material_morphs", "uv_morphs",
                              "group_morphs") if hasattr(r, k)}
        out["mmd_name"] = r.name
        out["mmd_comment"] = getattr(r, "comment_text", "")
    # physics bones: bones driven by dynamic rigid bodies (mode 1/2 in PMX)
    dyn = [o for o in rb if getattr(o.mmd_rigid, "type", "0") in ("1", "2")]
    out["dynamic_rigid_bodies"] = len(dyn)
    out["dynamic_rigid_names"] = sorted({o.mmd_rigid.name_j for o in dyn})[:80] if dyn else []
    springs = []
    for o in bpy.data.objects:
        ext = getattr(getattr(o, "data", None), "vrm_addon_extension", None)
        if ext is not None and o.type == "ARMATURE":
            try:
                sb = ext.spring_bone1
                springs.append(len(sb.springs))
            except Exception:
                pass
    if springs:
        out["vrm_spring_chains"] = springs
    return out


def b_meshes(a):
    keep = re.compile(a.keep) if a.keep else None
    hide = re.compile(a.hide) if a.hide else None
    kept, hidden = [], []
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        if mmd_type(o) != "NONE":
            o.hide_render = True
            continue
        ok = (keep is None or keep.search(o.name)) and not (hide and hide.search(o.name))
        o.hide_render = not ok
        o.hide_set(not ok)
        (kept if ok else hidden).append(o)
    return kept, hidden


def b_rest():
    for o in bpy.data.objects:
        if o.type == "ARMATURE":
            o.data.pose_position = "REST"
    bpy.context.view_layer.update()


CLS = {"torso": 0, "arm": 1, "head": 2}


def b_collect(kept):
    """World-space verts, their class (torso/arm/head) and edges of the evaluated meshes."""
    import numpy as np
    dg = bpy.context.evaluated_depsgraph_get()
    P, C, E = [], [], []
    base = 0
    stats = {"meshes": {}}
    # measure the skinned surface only: modifiers other than the armature (solidify, edge
    # split, outline shells) change the vertex count and would break the vertex -> bone map
    muted = []
    for o in kept:
        for md in o.modifiers:
            if md.type != "ARMATURE" and md.show_viewport:
                md.show_viewport = False
                muted.append(md)
    bpy.context.view_layer.update()
    bone_names = {b.name for a in bpy.data.objects if a.type == "ARMATURE" for b in a.data.bones}
    dg = bpy.context.evaluated_depsgraph_get()
    for o in kept:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = o.matrix_world
        # only deform-bone groups count (MMD Tools adds mmd_edge_scale / mmd_vertex_order)
        names = {g.index: g.name for g in o.vertex_groups if g.name in bone_names}
        src = o.data
        cls = []
        unweighted = 0
        for v in src.vertices:
            best, bw = None, 0.0
            for g in v.groups:
                if g.weight > bw and g.group in names:
                    best, bw = names[g.group], g.weight
            if best is None:
                unweighted += 1
                cls.append(0)
            else:
                cls.append(CLS[classify(best)])
        n = len(me.vertices)
        co = np.empty(n * 3)
        me.vertices.foreach_get("co", co)
        co = co.reshape(n, 3)
        M = np.array(mw)
        co = co @ M[:3, :3].T + M[:3, 3]
        ed = np.empty(len(me.edges) * 2, dtype=np.int64)
        me.edges.foreach_get("vertices", ed)
        P.append(co)
        C.append(np.array(cls if n == len(src.vertices) else [0] * n))
        E.append(ed.reshape(-1, 2) + base)
        base += n
        me.calc_loop_triangles()
        sk = src.shape_keys.key_blocks if src.shape_keys else []
        stats["meshes"][o.name] = {
            "verts": len(src.vertices), "tris": len(me.loop_triangles),
            "quads": sum(1 for p in src.polygons if len(p.vertices) == 4),
            "tris_in_source": sum(1 for p in src.polygons if len(p.vertices) == 3),
            "ngons": sum(1 for p in src.polygons if len(p.vertices) > 4),
            "polys": len(src.polygons), "vertex_groups": len(o.vertex_groups),
            "unweighted_verts": unweighted, "shape_keys": len(sk),
            "shape_key_names": [k.name for k in sk][:200],
        }
        stats["meshes"][o.name]["modifiers"] = [md.type for md in o.modifiers]
        stats["meshes"][o.name]["class_map_ok"] = n == len(src.vertices)
        ev.to_mesh_clear()
    for md in muted:
        md.show_viewport = True
    return (np.concatenate(P), np.concatenate(C), np.concatenate(E)), stats


def bone_heads(keys):
    res = []
    for o in bpy.data.objects:
        if o.type != "ARMATURE":
            continue
        for b in o.data.bones:
            n = b.name.lower()
            if any(k in n for k in keys):
                p = o.matrix_world @ b.head_local
                res.append((b.name, p))
    return res


def pick_pair(cands, exact=None):
    """Return (left, right) world positions for a mirrored bone pair."""
    if exact:
        cands = [c for c in cands if exact(c[0])] or cands
    left = [c for c in cands if c[1].x > 0.001]
    right = [c for c in cands if c[1].x < -0.001]
    if not left or not right:
        return None
    left.sort(key=lambda c: (abs(c[1].x), -c[1].z))
    right.sort(key=lambda c: (abs(c[1].x), -c[1].z))
    return left[0][1], right[0][1]


def b_measure(geo, front, px_heights=(PX_HEIGHT,)):
    import numpy as np
    P, C, E = geo
    z0, z1 = float(P[:, 2].min()), float(P[:, 2].max())
    H = z1 - z0
    if front == "auto":
        # toes point forward: the feet reach further from the shin line on the front side
        foot = P[P[:, 2] < z0 + 0.02 * H]
        shin = P[(P[:, 2] > z0 + 0.08 * H) & (P[:, 2] < z0 + 0.10 * H)]
        front = "-y" if foot[:, 1].mean() < shin[:, 1].mean() else "+y"
    sgn = -1 if front == "-y" else 1

    def section(z, classes=(0,), xmin=None, xmax=None):
        """Points where mesh edges cross the plane at height z (verts of allowed classes)."""
        ok = np.isin(C[E[:, 0]], classes) & np.isin(C[E[:, 1]], classes)
        a, b = P[E[ok, 0]], P[E[ok, 1]]
        cross = (a[:, 2] - z) * (b[:, 2] - z) <= 0
        a, b = a[cross], b[cross]
        dz = b[:, 2] - a[:, 2]
        safe = np.where(np.abs(dz) > 1e-12, dz, 1.0)
        t = np.where(np.abs(dz) > 1e-12, (z - a[:, 2]) / safe, 0.5)
        q = a + (b - a) * t[:, None]
        if xmin is not None:
            q = q[q[:, 0] > xmin]
        if xmax is not None:
            q = q[np.abs(q[:, 0]) < xmax]
        return q

    def width(q):
        return float(q[:, 0].max() - q[:, 0].min()) if len(q) else 0.0

    def depth(q):
        return float(q[:, 1].max() - q[:, 1].min()) if len(q) else 0.0

    head = P[C == 2]
    chin = None
    if len(head):
        hy = float(np.median(head[:, 1]))
        fr = head[((head[:, 1] - hy) * sgn > 0) & (np.abs(head[:, 0]) < 0.03 * H)]
        if len(fr):
            chin = float(fr[:, 2].min())
    tor = P[C == 0]
    cen = tor[(np.abs(tor[:, 0]) < 0.004 * H) & (tor[:, 2] > z0 + 0.25 * H)
              & (tor[:, 2] < z0 + 0.7 * H)]
    crotch = float(cen[:, 2].min()) if len(cen) else None

    ua = pick_pair(bone_heads(UPPERARM_KEYS),
                   exact=lambda n: bool(re.search(
                       r"upperarm|upper_arm|^(左|右)?腕$|^腕\.[lr]$|\.?arm[._ ]?[lr]?$", n.lower())))
    kn = pick_pair(bone_heads(KNEE_KEYS))
    an = pick_pair(bone_heads(ANKLE_KEYS))
    m = {"height": H, "z_min": z0, "z_max": z1, "front": front}
    head_len = (z1 - chin) if chin is not None else None
    m["head_len"] = head_len
    m["heads_tall"] = H / head_len if head_len else None
    m["crotch_to_sole"] = (crotch - z0) if crotch is not None else None
    m["leg_ratio"] = (crotch - z0) / H if crotch is not None else None
    if ua:
        sz = (ua[0].z + ua[1].z) / 2
        m["shoulder_joint_width"] = abs(ua[0].x - ua[1].x)
        m["shoulder_z"] = sz
        lim = abs(ua[0].x) + 0.035 * H
        m["shoulder_width"] = max(width(section(sz - dz * H, (0, 1), xmax=lim))
                                  for dz in (0.01, 0.02, 0.03))
    else:
        sz = z1 - 0.2 * H
        m["shoulder_z"] = None

    def scan(lo, hi, fn, better):
        best = None
        for z in np.arange(lo, hi, 0.002 * H):
            v = fn(float(z))
            if v > 0 and (best is None or better(v, best[0])):
                best = (v, float(z))
        return best or (None, None)

    if crotch is not None:
        m["bust_depth"], m["bust_z"] = scan(sz - 0.2 * H, sz - 0.03 * H,
                                            lambda z: depth(section(z)), lambda v, b: v > b)
        m["bust_width"] = width(section(m["bust_z"])) if m["bust_z"] else None
        top = (m["bust_z"] or sz - 0.15 * H) - 0.05 * H
        m["waist_width"], m["waist_z"] = scan(crotch + 0.08 * H, top,
                                              lambda z: width(section(z)), lambda v, b: v < b)
        m["waist_depth"] = depth(section(m["waist_z"])) if m["waist_z"] else None
        m["hip_width"], m["hip_z"] = scan(crotch - 0.03 * H, crotch + 0.10 * H,
                                          lambda z: width(section(z)), lambda v, b: v > b)
        m["hip_depth"] = depth(section(m["hip_z"])) if m["hip_z"] else None
        kz = kn[0].z if kn else z0 + 0.28 * H
        az = an[0].z if an else z0 + 0.05 * H
        m["knee_z"], m["ankle_z"] = kz, az

        def leg(z):  # one leg, +x side
            return section(z, (0,), xmin=0.002 * H)

        m["thigh_top_width"] = width(leg(crotch - 0.03 * H))
        m["thigh_top_depth"] = depth(leg(crotch - 0.03 * H))
        m["thigh_mid_width"] = width(leg((crotch + kz) / 2))
        m["knee_width"] = width(leg(kz))
        m["calf_width"], m["calf_z"] = scan(az + 0.04 * H, kz - 0.02 * H,
                                            lambda z: width(leg(z)), lambda v, b: v > b)
        m["ankle_width"] = min((width(leg(az + d * H)) for d in (0.01, 0.02, 0.03)
                                if len(leg(az + d * H))), default=None)
        if m.get("shoulder_width") and m.get("waist_width") and m.get("hip_width"):
            m["waist_to_hip"] = m["waist_width"] / m["hip_width"]
            m["waist_to_shoulder"] = m["waist_width"] / m["shoulder_width"]
    unit = head_len or (H / 7.0)
    m["unit"] = "head" if head_len else "H/7 (no head)"
    hu = {}
    for k in ("shoulder_joint_width", "shoulder_width", "bust_width", "bust_depth", "waist_width",
              "waist_depth", "hip_width", "hip_depth", "thigh_top_width", "thigh_top_depth",
              "thigh_mid_width", "knee_width", "calf_width", "ankle_width", "crotch_to_sole"):
        if m.get(k):
            hu[k] = round(m[k] / unit, 3)
    m["in_head_units"] = hu
    # the same numbers as pixels on a 144 px figure. DESIGN.md targets: head 24, crotch 75,
    # shoulders / waist / hips 27 / 15 / 24 (three-quarter view; these are front-view widths)
    for ph in sorted(set(px_heights) | {PX_HEIGHT}):
        s = ph / H
        m[f"at_{ph}px"] = {k: round(m[k] * s, 1) for k in
                           ("head_len", "crotch_to_sole", "shoulder_width", "waist_width", "hip_width",
                            "bust_width", "bust_depth", "thigh_top_width", "calf_width") if m.get(k)}
    return m


def b_toon_material(name, cols):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    dif = nt.nodes.new("ShaderNodeBsdfDiffuse")
    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    em = nt.nodes.new("ShaderNodeEmission")
    ramp.color_ramp.interpolation = "CONSTANT"
    stops = [0.0, 0.08, 0.3, 0.62]
    els = ramp.color_ramp.elements
    while len(els) < len(cols):
        els.new(0.5)
    for e, pos, c in zip(els, stops, cols):
        e.position = pos
        e.color = hexlin(c) + [1.0]
    nt.links.new(dif.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


def b_flat_material(name, col):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = hexlin(col) + [1.0]
    nt.links.new(em.outputs[0], out.inputs[0])
    return mat


def b_render_setup():
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_EEVEE"
    except TypeError:
        sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    if sc.world is None:
        sc.world = bpy.data.worlds.new("w")
    sc.world.use_nodes = True
    bg = next(n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[1].default_value = 0.0
    for o in [o for o in bpy.data.objects if o.type == "LIGHT"]:
        o.hide_render = True
    ld = bpy.data.lights.new("key", "SUN")
    ld.energy = 3.0
    lo = bpy.data.objects.new("key", ld)
    sc.collection.objects.link(lo)
    cd = bpy.data.cameras.new("cam")
    cd.type = "ORTHO"
    co = bpy.data.objects.new("cam", cd)
    sc.collection.objects.link(co)
    sc.camera = co
    return sc, co, lo


def b_place(co, lo, view, front, cx, cy, cz, dist):
    # angle measured from the model's front, positive turns the camera to the model's left
    ang = {"front": 0.0, "3q": 35.0, "side": 90.0}[view]
    base = -math.pi / 2 if front == "-y" else math.pi / 2  # direction the model faces
    t = base + math.radians(ang)
    co.location = Vector((cx + dist * math.cos(t), cy + dist * math.sin(t), cz))
    d = Vector((cx, cy, cz)) - co.location
    co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    # key light: from the camera side, up and to the camera's left
    lt = t + math.radians(40)
    lo.location = Vector((cx + dist * math.cos(lt), cy + dist * math.sin(lt), cz + dist))
    ld = Vector((cx, cy, cz)) - lo.location
    lo.rotation_euler = ld.to_track_quat("-Z", "Y").to_euler()


def b_render(a, kept, m, out_raw):
    sc, co, lo = b_render_setup()
    toon = b_toon_material("bs_toon", SKIN)
    wire = b_flat_material("bs_wire", OUTLINE)
    for o in kept:
        o.data.materials.clear()
        o.data.materials.append(toon)
        for p in o.data.polygons:
            p.material_index = 0
    H, z0 = m["height"], m["z_min"]
    xs = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in kept:
        ev = o.evaluated_get(dg)
        xs += [(o.matrix_world @ Vector(c)) for c in ev.bound_box]
    cx = (min(v.x for v in xs) + max(v.x for v in xs)) / 2
    cy = (min(v.y for v in xs) + max(v.y for v in xs)) / 2
    cz = z0 + H / 2
    dist = H * 4
    co.data.clip_end = dist * 3
    views = ("front", "3q", "side")
    # hi-res: 1200 x 1600, figure 92% of the frame height
    sc.render.resolution_x, sc.render.resolution_y = 1200, 1600
    sc.render.filter_size = 1.2
    co.data.ortho_scale = H / 0.92 * (1600 / 1600)
    co.data.sensor_fit = "VERTICAL"
    for v in views:
        b_place(co, lo, v, a.front, cx, cy, cz, dist)
        sc.render.filepath = os.path.join(out_raw, f"hi_{v}.png")
        bpy.ops.render.render(write_still=True)
    # topology: wireframe copies over the toon mesh (front and 3q)
    wires = []
    for o in kept:
        w = o.copy()
        w.data = o.data.copy()
        w.data.materials.clear()
        w.data.materials.append(wire)
        mod = w.modifiers.new("wire", "WIREFRAME")
        mod.thickness = H * 0.0007
        mod.use_replace = True
        mod.use_even_offset = False
        sc.collection.objects.link(w)
        wires.append(w)
    for v in ("front", "3q"):
        b_place(co, lo, v, a.front, cx, cy, cz, dist)
        sc.render.filepath = os.path.join(out_raw, f"topo_{v}.png")
        bpy.ops.render.render(write_still=True)
    for w in wires:
        bpy.data.objects.remove(w, do_unlink=True)
    # pixel: figure = ph px, supersampled PX_SS x, square canvas with 16 px margins
    for ph in a.px_heights:
        canvas = ph + 32
        sc.render.resolution_x = sc.render.resolution_y = canvas * PX_SS
        sc.render.filter_size = 0.0
        co.data.ortho_scale = H * canvas / ph
        for v in views:
            b_place(co, lo, v, a.front, cx, cy, cz, dist)
            sc.render.filepath = os.path.join(out_raw, px_name(v, ph))
            bpy.ops.render.render(write_still=True)


def blender_main():
    a = b_args()
    os.makedirs(os.path.join(a.out, "raw"), exist_ok=True)
    info = b_import(a)
    info["src"] = a.src
    info["name"] = a.name
    info.update(b_physics_and_morphs())
    b_rest()
    kept, hidden = b_meshes(a)
    info["kept_meshes"] = [o.name for o in kept]
    info["hidden_meshes"] = [o.name for o in hidden]
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    info["bones"] = sum(len(o.data.bones) for o in arms)
    info["bone_names_sample"] = [b.name for o in arms for b in o.data.bones][:400]
    geo, stats = b_collect(kept)
    info.update(stats)
    info["measure"] = b_measure(geo, a.front, a.px_heights)
    info["px_heights"] = a.px_heights
    a.front = info["measure"]["front"]
    json.dump(info, open(os.path.join(a.out, "measure.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    print("BASE_SEARCH " + json.dumps(info["measure"]["in_head_units"]))
    print("BASE_SEARCH heads", info["measure"]["heads_tall"], "legs", info["measure"]["leg_ratio"])
    if a.export_pmx:
        # smoke path only: turn the armature into an MMD model and write a PMX
        arm = arms[0]
        bpy.ops.object.select_all(action="DESELECT")
        arm.select_set(True)
        for o in kept:
            o.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.mmd_tools.convert_to_mmd_model()
        bpy.ops.mmd_tools.export_pmx(filepath=a.export_pmx, scale=12.5,
                                     visible_meshes_only=True)
        print("BASE_SEARCH exported", a.export_pmx, os.path.getsize(a.export_pmx))
        return
    if not a.no_render:
        b_render(a, kept, info["measure"], os.path.join(a.out, "raw"))


# --------------------------------------------------------------------------- post half

def post_main():
    import argparse
    import numpy as np
    from PIL import Image, ImageDraw

    ap = argparse.ArgumentParser()
    ap.add_argument("--post", action="append", required=True)
    ap.add_argument("--compare", default="")
    a = ap.parse_args()

    pal = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in SKIN], np.int32)
    ol = tuple(int(OUTLINE[i:i + 2], 16) for i in (1, 3, 5))

    def pixelate(path):
        im = np.asarray(Image.open(path).convert("RGBA")).astype(np.int32)
        h, w = im.shape[:2]
        n = PX_SS
        a_ = im[..., 3] > 127
        rgb = im[..., :3]
        d = ((rgb[..., None, :] - pal[None, None]) ** 2).sum(-1)
        band = d.argmin(-1)
        band[~a_] = -1
        H2, W2 = h // n, w // n
        blocks = band[:H2 * n, :W2 * n].reshape(H2, n, W2, n).transpose(0, 2, 1, 3).reshape(H2, W2, n * n)
        out = np.zeros((H2, W2, 4), np.uint8)
        for y in range(H2):
            for x in range(W2):
                b = blocks[y, x]
                cov = (b >= 0).sum()
                if cov * 2 < n * n:
                    continue
                vals = np.bincount(b[b >= 0], minlength=4)
                out[y, x, :3] = pal[vals.argmax()]
                out[y, x, 3] = 255
        # 1 px outline outside the silhouette
        al = out[..., 3] > 0
        ring = np.zeros_like(al)
        ring[1:] |= al[:-1]
        ring[:-1] |= al[1:]
        ring[:, 1:] |= al[:, :-1]
        ring[:, :-1] |= al[:, 1:]
        ring &= ~al
        out[ring] = ol + (255,)
        return Image.fromarray(out)

    def label(img, text, bg=(24, 22, 34)):
        pad = 22
        c = Image.new("RGBA", (img.width, img.height + pad), bg + (255,))
        c.alpha_composite(img, (0, pad))
        ImageDraw.Draw(c).text((6, 5), text, fill=(235, 232, 245, 255))
        return c

    def on_bg(img, bg=(24, 22, 34)):
        c = Image.new("RGBA", img.size, bg + (255,))
        c.alpha_composite(img)
        return c

    compare = []
    for d in a.post:
        meta = json.load(open(os.path.join(d, "measure.json"), encoding="utf-8"))
        raw = os.path.join(d, "raw")
        m = meta["measure"]
        # hi-res sheet: front / 3q / side + topology front / 3q
        tiles = []
        for v in ("front", "3q", "side"):
            tiles.append(label(on_bg(Image.open(os.path.join(raw, f"hi_{v}.png")).convert("RGBA")), v))
        for v in ("front", "3q"):
            p = os.path.join(raw, f"topo_{v}.png")
            if os.path.exists(p):
                tiles.append(label(on_bg(Image.open(p).convert("RGBA")), f"topology {v}"))
        tiles = [t.resize((t.width // 2, t.height // 2), Image.LANCZOS) for t in tiles]
        sheet = Image.new("RGBA", (sum(t.width for t in tiles), tiles[0].height), (24, 22, 34, 255))
        x = 0
        for t in tiles:
            sheet.alpha_composite(t, (x, 0))
            x += t.width
        sheet.save(os.path.join(d, f"{meta['name']}_hires.png"))
        # pixel frames at 1x and a 4x sheet with the DESIGN guides (head 24 px, crotch 75 px at
        # 144; scaled for other heights)
        for ph in meta.get("px_heights", [PX_HEIGHT]):
            pix = []
            for v in ("front", "3q", "side"):
                p = pixelate(os.path.join(raw, px_name(v, ph)))
                p.save(os.path.join(d, f"{meta['name']}_px{ph}_{v}.png"))
                pix.append(p)
            S = 4
            canvas = pix[0].height
            top, sole = 16, 16 + ph
            hd, cr = round(24 * ph / PX_HEIGHT), round(75 * ph / PX_HEIGHT)
            g = Image.new("RGBA", (sum(p.width for p in pix) * S, canvas * S), (24, 22, 34, 255))
            x = 0
            for p in pix:
                g.alpha_composite(p.resize((p.width * S, p.height * S), Image.NEAREST), (x, 0))
                x += p.width * S
            dr = ImageDraw.Draw(g)
            for yy, col in ((top, (120, 120, 140)), (top + hd, (230, 90, 90)), (sole - cr, (90, 200, 230)),
                            (sole, (120, 120, 140))):
                dr.line([(0, yy * S), (g.width, yy * S)], fill=col + (255,), width=1)
            g = label(g, f"{meta['name']}  red={hd} px head  blue={cr} px crotch  ({ph} px figure, x{S})")
            g.save(os.path.join(d, f"{meta['name']}_px{ph}_x{S}.png"))
            if ph == PX_HEIGHT:
                compare.append((meta, pix))
    if a.compare and compare:
        S = 3
        tiles = []
        for meta, pix in compare:
            p = pix[1]  # three-quarter
            t = on_bg(p.resize((p.width * S, p.height * S), Image.NEAREST))
            m = meta["measure"]
            hu = m["in_head_units"]
            txt = (f"{meta['name']}  {m['heads_tall'] and round(m['heads_tall'], 2)} heads  "
                   f"legs {m['leg_ratio'] and round(m['leg_ratio'], 3)}")
            tiles.append(label(t, txt[:60]))
        sheet = Image.new("RGBA", (sum(t.width for t in tiles), max(t.height for t in tiles)),
                          (24, 22, 34, 255))
        x = 0
        for t in tiles:
            sheet.alpha_composite(t, (x, 0))
            x += t.width
        sheet.save(a.compare)


if __name__ == "__main__":
    if IN_BLENDER:
        blender_main()
    else:
        post_main()
