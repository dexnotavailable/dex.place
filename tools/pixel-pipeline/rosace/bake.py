"""Baked occlusion ('ao' point attribute) for the toon ramp.

Short-range ray-cast occlusion in the rest pose: creases where parts meet (under the bust,
the gluteal fold, under the collar, between hair clumps, inside the sleeves, where the garter
straps and the tabard sit on the body) fall into the shadow/deep band instead of reading as
flat colour. Authored crease masks (attribute 'crease', 0..1) are multiplied in.
Deterministic: fixed direction set, no noise.
"""
import math

import bpy
from mathutils import Vector

from .geo import object_bvh

V = Vector


def hemisphere_dirs(n=24):
    """Fibonacci hemisphere around +Z, cosine-weighted (fixed)."""
    out = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        u = (i + 0.5) / n
        r = math.sqrt(u)
        th = ga * i
        out.append(V((r * math.cos(th), r * math.sin(th), math.sqrt(max(0.0, 1 - u)))))
    return out


def ensure_attr(ob, name, default=1.0):
    me = ob.data
    a = me.attributes.get(name)
    if a is None:
        a = me.attributes.new(name, "FLOAT", "POINT")
        a.data.foreach_set("value", [default] * len(me.vertices))
    return a


def ensure_ao(obs, run=True, dist=0.075, strength=0.9, rays=24, skip_parts=("glaive",)):
    for ob in obs:
        ensure_attr(ob, "ao", 1.0)
    if not run:
        return
    # occluders are the base meshes (no solidify shells: a garment's own outer layer would
    # otherwise occlude it completely)
    from mathutils.bvhtree import BVHTree
    verts, polys = [], []
    for ob in obs:
        M = ob.matrix_world
        base = len(verts)
        verts += [M @ v.co for v in ob.data.vertices]
        polys += [[base + i for i in p.vertices] for p in ob.data.polygons]
    bvh = BVHTree.FromPolygons(verts, polys)
    dirs = hemisphere_dirs(rays)
    for ob in obs:
        if ob.get("no_ao"):
            continue
        me = ob.data
        M = ob.matrix_world
        N3 = M.to_3x3().inverted().transposed()
        o_dist = ob.get("ao_dist", dist)
        o_str = ob.get("ao_strength", strength)
        crease = me.attributes.get("crease")
        cv = [0.0] * len(me.vertices)
        if crease:
            crease.data.foreach_get("value", cv)
        vals = []
        for i, v in enumerate(me.vertices):
            p = M @ v.co
            n = (N3 @ v.normal).normalized()
            if n.length < 0.5:
                vals.append(1.0)
                continue
            q = n.to_track_quat("Z", "Y").to_matrix()
            origin = p + n * 0.0015
            occ = 0.0
            for d in dirs:
                w = q @ d
                hit, _, _, dd = bvh.ray_cast(origin, w, o_dist)
                if hit is not None:
                    occ += 1.0 - (dd / o_dist) ** 2
            a = 1.0 - o_str * occ / len(dirs)
            a *= 1.0 - cv[i]
            vals.append(max(0.0, min(1.0, a)))
        me.attributes["ao"].data.foreach_set("value", vals)
