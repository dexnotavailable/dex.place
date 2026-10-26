"""Drive 9 whole-character round 5, Blender side (a library for d9_blender.py --r2 <json>): the head-top signature,
built at render time from our own geometry on the opened lane file and never saved into it.

  pin   the round-4 face critic's fix 'a head-top signature that sits in the hairline, never across the brow: a small
        gold stained-glass rosette or veil pin at the crown on the far side, 3-4 px, with a short veil or ribbon
        trailing off it for silhouette'. A flat rosace (gold rim ring, glass disc, glasscore centre, the same three
        materials as the weapon's rose disc, so the finish treats them the same) sits on the hair's own outer surface
        in direction (azimuth, elevation) from the skull centre; two ribbon tails in 'veil' hang from it (a V cut at
        the ends) along the hair. Everything is weighted 100 % to J_Bip_C_Head, so head_scale's scale carries it.

  cfg: {"azimuth": deg (0 = the face's front, -y; + toward the model's left, +x), "elevation": deg (0 = level with
        'centre_z', 90 = straight up), "centre": [x, y, z] the skull centre, "r": rosette radius (m), "out": gap over
        the hair (m), "ribbon": {"len": m, "w": m, "spread": deg, "mat": "veil", "dir": [x, y, z] the fall
        direction (laid into the tangent plane; default straight down)} or null}
"""
import math

import bmesh
import bpy
from mathutils import Vector

from r2_blender import _hair_points, _new_object, _weight_to_head  # noqa: E402


def _surface(pts, c, d, cone=0.18):
    """the hair's outer radius from c along unit d: the largest projection of the hair points inside a narrow cone"""
    best = 0.0
    for p in pts:
        v = p - c
        L = v.length
        if L < 1e-6:
            continue
        if v.dot(d) / L < math.cos(cone):
            continue
        best = max(best, v.dot(d))
    return best


def _disc(name, mat, centre, n, rr, part_pi, solid=None):
    """a flat disc of radius rr at centre facing unit normal n"""
    t1 = n.cross(Vector((0, 0, 1)))
    if t1.length < 1e-3:
        t1 = n.cross(Vector((1, 0, 0)))
    t1.normalize()
    t2 = n.cross(t1).normalized()
    bm = bmesh.new()
    k = 16
    cen = bm.verts.new(centre)
    vs = [bm.verts.new(centre + (t1 * math.cos(2 * math.pi * q / k) + t2 * math.sin(2 * math.pi * q / k)) * rr) for q in range(k)]
    for q in range(k):
        bm.faces.new((cen, vs[q], vs[(q + 1) % k]))
    for f in bm.faces:
        f.normal_update()
        if f.normal.dot(n) < 0:
            f.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = _new_object(name, "circlet_jewel", part_pi, me, [mat])
    if solid:
        s2 = ob.modifiers.new("Solidify", "SOLIDIFY")
        s2.thickness = solid
        s2.offset = -1.0
    _weight_to_head(ob)
    return ob


def pin(cfg):
    if not cfg:
        return None
    pts = _hair_points()
    c = Vector(cfg.get("centre", [0.0, 0.03, 1.74]))
    az, el = math.radians(cfg.get("azimuth", 60)), math.radians(cfg.get("elevation", 55))
    d = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))).normalized()
    R = _surface(pts, c, d)
    if R <= 0:
        R = 0.12
    out = cfg.get("out", 0.006)
    pc = c + d * (R + out)
    rad = cfg.get("r", 0.024)
    _disc("d9_pin_rim", "gold", pc, d, rad, 41, solid=0.007)
    _disc("d9_pin", "glass", pc + d * 0.003, d, rad * 0.70, 41)
    _disc("d9_pin_core", "glasscore", pc + d * 0.005, d, rad * 0.28, 41)
    rep = {"at": [round(v, 4) for v in pc], "dir": [round(v, 3) for v in d], "hair_r": round(R, 4), "r": rad}
    rb = cfg.get("ribbon")
    if rb:
        # two tails from under the rosette, hanging down and out along the hair (the tangent plane at the pin), a V cut
        # at each end; a ribbon (w) of 'veil', solidified thin so both sides render
        L, w = rb.get("len", 0.10), rb.get("w", 0.014)
        g = Vector(rb.get("dir", [0, 0, -1])).normalized()       # the fall direction, laid into the pin's tangent plane
        down = (g - d * g.dot(d)).normalized()
        side = d.cross(down).normalized()
        bm = bmesh.new()
        for sgn in (-1, 1):
            a = math.radians(rb.get("spread", 16)) * sgn
            ax = (down * math.cos(a) + side * math.sin(a)).normalized()
            across = d.cross(ax).normalized()
            p0 = pc - d * 0.004
            n_seg = 5
            rows = []
            for i in range(n_seg + 1):
                t = i / n_seg
                # hug the hair: sink back toward the skull as it falls (a slight curl), widen a little to the end
                pos = p0 + ax * (L * t) - d * (0.012 * t * t)
                ww = w * (0.8 + 0.4 * t)
                rows.append((bm.verts.new(pos - across * ww / 2), bm.verts.new(pos + across * ww / 2)))
            for i in range(n_seg):
                bm.faces.new((rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]))
            # the V cut: the end's middle pulled up
            tip = bm.verts.new(p0 + ax * (L * 0.86) - d * 0.009)
            bm.faces.new((rows[-1][0], tip, rows[-1][1]))
        me = bpy.data.meshes.new("d9_pin_ribbon")
        bm.to_mesh(me)
        bm.free()
        ob = _new_object("d9_pin_ribbon", "veil", 42, me, [rb.get("mat", "veil")])
        so = ob.modifiers.new("Solidify", "SOLIDIFY")
        so.thickness = 0.003
        _weight_to_head(ob)
        rep["ribbon"] = {"len": L, "w": w, "mat": rb.get("mat", "veil")}
    return rep
