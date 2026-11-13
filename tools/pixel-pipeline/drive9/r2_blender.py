"""Drive 9 whole-character round 2, Blender side (a library for d9_blender.py --r2 <json>): render-time model edits
on the opened lanes/drive9.blend, never saved into it. Everything is built from our own model's geometry.

  mesh_edits   per object: {"scale_x": [top, bottom], "z": [z_top, z_bottom]} widens a garment in its rest mesh
               (x about the body's centre line), the factor interpolated from z_top to z_bottom (a flare). The
               critique's "the tabard is a sword-like strip": the front tabard becomes a panel with a flare.
  circlet      the signature head piece (critique: "no priestess head piece; the side beads are tiny"): a gold band
               that follows the hair's own outer contour at the brow (the front lower than the back), with a glass
               rosace jewel at the front centre. Weighted 100 % to J_Bip_C_Head, so head_scale's scale carries it.
"""
import math

import bmesh
import bpy
from mathutils import Vector

HEAD_BONE = "J_Bip_C_Head"


def _rig():
    return bpy.data.objects["rosace_rig"]


def mesh_edits(cfg):
    rep = {}
    items = []
    for name, e in (cfg or {}).items():
        if name.startswith("_"):
            continue
        if name.endswith("*"):
            items += [(o.name, e) for o in bpy.data.objects if o.name.startswith(name[:-1]) and o.type == "MESH"]
        else:
            items.append((name, e))
    for name, e in items:
        ob = bpy.data.objects.get(name)
        if ob is None or ob.type != "MESH":
            rep[name] = "missing"
            continue
        if "scale_xy" in e:
            rep[name] = _scale_xy(ob, e)
            continue
        s0, s1 = e["scale_x"]
        z0, z1 = e.get("z", [None, None])
        zs = [v.co.z for v in ob.data.vertices]
        z0 = max(zs) if z0 is None else z0
        z1 = min(zs) if z1 is None else z1
        cx = e.get("cx", 0.0)
        n = 0
        for v in ob.data.vertices:
            t = min(1.0, max(0.0, (z0 - v.co.z) / max(1e-6, z0 - z1)))
            s = s0 + (s1 - s0) * t
            v.co.x = cx + (v.co.x - cx) * s
            n += 1
        ob.data.update()
        rep[name] = {"verts": n, "scale_x": [s0, s1], "z": [round(z0, 3), round(z1, 3)]}
    return rep


def _scale_xy(ob, e):
    """round 3: scale a part in x and y about a vertical axis through c = [cx, cy] (its rest mesh), the factor
    interpolated from scale_xy[0] at z[0] to scale_xy[1] at z[1] and clamped outside; 'z' defaults to the part's
    own top and bottom. Hair volume (head and hair 4: 'widen the hair mass so the face reads smaller inside it')
    and the haft's thickness (weapon 7: 'thicken the shaft to 4-5 px at 144')."""
    s0, s1 = e["scale_xy"]
    cx, cy = e.get("c", [0.0, 0.0])
    zs = [v.co.z for v in ob.data.vertices]
    z0, z1 = e.get("z", [max(zs), min(zs)])
    for v in ob.data.vertices:
        t = min(1.0, max(0.0, (z0 - v.co.z) / (z0 - z1))) if abs(z0 - z1) > 1e-6 else 0.0
        k = s0 + (s1 - s0) * t
        v.co.x = cx + (v.co.x - cx) * k
        v.co.y = cy + (v.co.y - cy) * k
    ob.data.update()
    return {"verts": len(zs), "scale_xy": [s0, s1], "c": [cx, cy], "z": [round(z0, 3), round(z1, 3)]}


def _hair_points():
    pts = []
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        part = ob.get("part", ob.name)
        if not (part.startswith("hair_") or part == "head"):
            continue
        M = ob.matrix_world
        pts.extend(M @ v.co for v in ob.data.vertices)
    return pts


def _contour(pts, z, n=48, centre=(0.0, -0.02), band=0.02, off=0.004, fallback=0.15):
    """outer radius of the hair/head at height z, per angle (0 = front, -y), smoothed"""
    cx, cy = centre
    rs = [0.0] * n
    for p in pts:
        if abs(p.z - z) > band:
            continue
        dx, dy = p.x - cx, p.y - cy
        a = math.atan2(dx, -dy)
        i = int(round(a / (2 * math.pi) * n)) % n
        r = math.hypot(dx, dy)
        if r > rs[i]:
            rs[i] = r
    rs = [r if r > 0 else fallback for r in rs]
    sm = [(rs[(i - 1) % n] + 2 * rs[i] + rs[(i + 1) % n]) / 4 for i in range(n)]
    return [r + off for r in sm]


def _weight_to_head(ob):
    rig = _rig()
    ob.parent = rig
    ob.parent_type = "OBJECT"
    ob.matrix_parent_inverse.identity()
    vg = ob.vertex_groups.new(name=HEAD_BONE)
    vg.add([v.index for v in ob.data.vertices], 1.0, "REPLACE")
    m = ob.modifiers.new("Armature", "ARMATURE")
    m.object = rig


def _new_object(name, part, pass_index, me, mats):
    # the toon materials read a baked 'ao' point attribute (materials.py): new parts are fully open (1.0)
    at = me.attributes.new("ao", "FLOAT", "POINT")
    at.data.foreach_set("value", [1.0] * len(me.vertices))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob["part"] = part
    ob.pass_index = pass_index
    for mn in mats:
        me.materials.append(bpy.data.materials[mn])
    return ob


def circlet(cfg):
    if not cfg:
        return None
    pts = _hair_points()
    n = int(cfg.get("segments", 48))
    zf, zb = cfg.get("z_front", 1.80), cfg.get("z_back", 1.86)
    h = cfg.get("band_h", 0.018)
    th = cfg.get("thick", 0.005)
    cx, cy = cfg.get("centre", [0.0, -0.02])
    arc = math.radians(cfg.get("arc_deg", 160)) / 2      # a front diadem: the ends sink into the hair
    sink = cfg.get("sink", 0.02)
    radii = {}
    bm = bmesh.new()
    lo, hi, dirs = [], [], []
    k = n // 2
    for i in range(k + 1):
        a = -arc + 2 * arc * i / k
        z = zf + (zb - zf) * (1 - math.cos(a)) / 2
        cr = _contour(pts, z, n, (cx, cy), off=cfg.get("offset", 0.004))
        j = int(round(a / (2 * math.pi) * n)) % n
        r = cr[j] - sink * max(0.0, (abs(a) - 0.7 * arc) / (0.3 * arc))
        radii[i] = r
        d = Vector((math.sin(a), -math.cos(a), 0.0))
        c = Vector((cx, cy, 0.0)) + d * r
        lo.append(bm.verts.new((c.x, c.y, z - h / 2)))
        hi.append(bm.verts.new((c.x, c.y, z + h / 2)))
        dirs.append(d)
    for i in range(k):
        f = bm.faces.new((lo[i], lo[i + 1], hi[i + 1], hi[i]))
        f.normal_update()
        if f.normal.dot(dirs[i]) < 0:
            f.normal_flip()
    radii[0] = radii[k // 2]
    me = bpy.data.meshes.new("d9_circlet")
    bm.to_mesh(me)
    bm.free()
    ob = _new_object("d9_circlet", "circlet", int(cfg.get("pass_index", 40)), me, ["gold"])
    so = ob.modifiers.new("Solidify", "SOLIDIFY")
    so.thickness = th
    so.offset = 1.0
    _weight_to_head(ob)
    rep = {"front_r": round(radii[0], 4), "z": [zf, zb], "band_h": h}
    j = cfg.get("jewel")
    if j:
        r0 = radii[0] + th + j.get("out", 0.008)
        zc = zf + j.get("dz", 0.012)
        rad = j.get("r", 0.024)
        # a flat rosace: glass disc facing the front (-y), a gold rim ring, a glasscore centre
        for nm, mat, rr, dy, part_pi in (("d9_jewel_rim", "gold", rad, 0.0, 41), ("d9_jewel", "glass", rad * 0.72, -0.003, 41),
                                        ("d9_jewel_core", "glasscore", rad * 0.3, -0.005, 41)):
            bm = bmesh.new()
            k = 16
            cen = bm.verts.new((cx, cy - r0 + dy, zc))
            vs = [bm.verts.new((cx + rr * math.cos(2 * math.pi * q / k), cy - r0 + dy, zc + rr * math.sin(2 * math.pi * q / k)))
                  for q in range(k)]
            for q in range(k):
                bm.faces.new((cen, vs[q], vs[(q + 1) % k]))
            for f in bm.faces:
                f.normal_update()
                if f.normal.y > 0:
                    f.normal_flip()
            me = bpy.data.meshes.new(nm)
            bm.to_mesh(me)
            bm.free()
            o2 = _new_object(nm, "circlet_jewel", part_pi, me, [mat])
            if nm == "d9_jewel_rim":
                s2 = o2.modifiers.new("Solidify", "SOLIDIFY")
                s2.thickness = 0.006
                s2.offset = -1.0
            _weight_to_head(o2)
        rep["jewel"] = {"r": rad, "z": round(zc, 4), "y": round(cy - r0, 4)}
    return rep
