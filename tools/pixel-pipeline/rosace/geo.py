"""Mesh construction helpers for the Rosace build (Blender Python)."""
import heapq
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

V = Vector
PART_IDS = {}


def link(ob, coll=None):
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def fix_closed_normals(bm):
    """outward normals for every closed connected part (tubes, clumps, slabs); open sheets keep
    the orientation their builder chose"""
    bm.faces.ensure_lookup_table()
    bm.faces.index_update()
    seen = set()
    for f in bm.faces:
        if f in seen:
            continue
        part, stack = {f}, [f]
        while stack:
            g = stack.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if h not in part:
                        part.add(h)
                        stack.append(h)
        seen |= part
        if all(not e.is_boundary for g in part for e in g.edges):
            # sorted: a set's order changes between runs, and recalc_face_normals' result (which
            # loop each face starts on) follows it, so builds were not byte-reproducible
            bmesh.ops.recalc_face_normals(bm, faces=sorted(part, key=lambda f: f.index))


def bm_to_object(name, bm, materials=(), smooth=True, arm=None, part=None):
    fix_closed_normals(bm)
    # canonical face order (by centre, then by vertex indices): bmesh.ops.create_uvsphere's face
    # order changes between runs, which made builds differ byte for byte (rendering never depends on it)
    bm.verts.index_update()
    bm.faces.index_update()
    order = sorted(bm.faces, key=lambda f: (tuple(round(c, 6) for c in f.calc_center_median()),
                                            sorted(v.index for v in f.verts)))
    rank = {f.index: i for i, f in enumerate(order)}
    bm.faces.sort(key=lambda f: rank[f.index])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    link(ob)
    for m in materials:
        me.materials.append(bpy.data.materials[m] if isinstance(m, str) else m)
    for p in me.polygons:
        p.use_smooth = smooth
    if arm is not None:
        ob.parent = arm
        mod = ob.modifiers.new("arm", "ARMATURE")
        mod.object = arm
    set_part(ob, part or name)
    return ob


def set_part(ob, part):
    """Part id (object pass index) for the ID pass. Same part name -> same id."""
    if part not in PART_IDS:
        PART_IDS[part] = len(PART_IDS) + 1
    ob.pass_index = PART_IDS[part]
    ob["part"] = part


def frame_axes(t, ref):
    t = t.normalized()
    u = ref - t * ref.dot(t)
    if u.length < 1e-6:
        u = V((1, 0, 0)) - t * t.x
        if u.length < 1e-6:
            u = V((0, 1, 0)) - t * t.y
    u.normalize()
    return u, t.cross(u)


def catmull(pts, n):
    """Centripetal-ish Catmull-Rom through pts, n samples total (inclusive ends)."""
    P = [V(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    segs = len(P) - 3
    out = []
    for i in range(n):
        s = i / (n - 1) * segs
        k = min(int(s), segs - 1)
        t = s - k
        p0, p1, p2, p3 = P[k], P[k + 1], P[k + 2], P[k + 3]
        t2, t3 = t * t, t * t * t
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                          (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return out


def tube(bm, centers, radii, nseg=8, ref=V((0, 1, 0)), refs=None, cap0=True, cap1=True, twist=None):
    """Loft an elliptical tube. radii: list of (ru, rv). refs: per-ring reference vectors
    that fix the 'u' axis (for flattened ribbons). Returns list of rings (vert lists)."""
    cs = [V(c) for c in centers]
    rings = []
    for i, c in enumerate(cs):
        a = cs[min(i + 1, len(cs) - 1)] - cs[max(i - 1, 0)]
        u, v = frame_axes(a, V(refs[i]) if refs else ref)
        ru, rv = radii[i]
        ring = []
        for k in range(nseg):
            ang = 2 * math.pi * k / nseg + (twist[i] if twist else 0.0)
            ring.append(bm.verts.new(c + u * math.cos(ang) * ru + v * math.sin(ang) * rv))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(nseg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % nseg], rings[i + 1][(k + 1) % nseg], rings[i + 1][k]))
    if cap0:
        c = bm.verts.new(cs[0] + (cs[0] - cs[1]).normalized() * min(radii[0]) * 0.5)
        for k in range(nseg):
            bm.faces.new((rings[0][(k + 1) % nseg], rings[0][k], c))
    if cap1:
        c = bm.verts.new(cs[-1] + (cs[-1] - cs[-2]).normalized() * min(radii[-1]) * 0.5)
        for k in range(nseg):
            bm.faces.new((rings[-1][k], rings[-1][(k + 1) % nseg], c))
    return rings


def grid_sheet(bm, rows):
    """rows: list of rows of points (same length) -> quad sheet. Returns vert grid."""
    g = [[bm.verts.new(V(p)) for p in row] for row in rows]
    for i in range(len(g) - 1):
        for j in range(len(g[0]) - 1):
            bm.faces.new((g[i][j], g[i][j + 1], g[i + 1][j + 1], g[i + 1][j]))
    return g


def polygon_prism(bm, pts2d, origin, ax_u, ax_v, normal, depth, bevel_in=0.0):
    """Extrude a 2D outline (list of (u, v)) into a slab centred on origin.
    Used for crosses and flat ornaments. Returns the new faces."""
    o, U, W, N = V(origin), V(ax_u), V(ax_v), V(normal)
    front = [bm.verts.new(o + U * u + W * v + N * depth * 0.5) for u, v in pts2d]
    back = [bm.verts.new(o + U * u + W * v - N * depth * 0.5) for u, v in pts2d]
    faces = []
    ff = bm.faces.new(front)
    fb = bm.faces.new(list(reversed(back)))
    faces += [ff, fb]
    n = len(pts2d)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((front[j], front[i], back[i], back[j])))
    if bevel_in:
        r = bmesh.ops.inset_individual(bm, faces=[ff, fb], thickness=bevel_in, depth=bevel_in * 0.8)
    return faces


def fleur_cross_outline(h, arm_w, bar_y, bar_w, nub=True):
    """Fleur-cross (ref 14's cross): vertical bar with flared pointed ends.
    Returns a (u, v) outline: height h, cross-bar width bar_w centred at v = bar_y."""
    a = arm_w / 2
    t = a * 1.9 if nub else a            # flared end half-width
    L = h / 2
    by = bar_y
    bw = bar_w / 2
    pts = [
        (-a, -L + t * 1.3), (-t, -L + t * 0.4), (0, -L), (t, -L + t * 0.4), (a, -L + t * 1.3),
        (a, by - a), (bw - t * 1.3, by - a), (bw - t * 0.4, by - t), (bw, by), (bw - t * 0.4, by + t),
        (bw - t * 1.3, by + a), (a, by + a),
        (a, L - t * 1.3), (t, L - t * 0.4), (0, L), (-t, L - t * 0.4), (-a, L - t * 1.3),
        (-a, by + a), (-bw + t * 1.3, by + a), (-bw + t * 0.4, by + t), (-bw, by), (-bw + t * 0.4, by - t),
        (-bw + t * 1.3, by - a), (-a, by - a),
    ]
    return pts


def plain_cross_outline(h, arm_w, bar_y, bar_w):
    a, L, bw = arm_w / 2, h / 2, bar_w / 2
    return [(-a, -L), (a, -L), (a, bar_y - a), (bw, bar_y - a), (bw, bar_y + a), (a, bar_y + a),
            (a, L), (-a, L), (-a, bar_y + a), (-bw, bar_y + a), (-bw, bar_y - a), (-a, bar_y - a)]


def add_solidify(ob, thickness, offset=0.0, mat_offset=0, rim_mat_offset=0, even=True):
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = thickness
    m.offset = offset
    m.use_even_offset = even
    m.use_quality_normals = True
    m.material_offset = mat_offset
    m.material_offset_rim = rim_mat_offset
    # keep the armature first so the shell deforms, then thickens
    return m


def add_subsurf(ob, levels=1):
    m = ob.modifiers.new("sub", "SUBSURF")
    m.levels = levels
    m.render_levels = levels
    return m


def object_bvh(obs, depsgraph=None):
    """World-space BVH over the evaluated meshes of obs."""
    dg = depsgraph or bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    for ob in obs:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        M = ob.matrix_world
        base = len(verts)
        verts += [M @ v.co for v in me.vertices]
        polys += [[base + i for i in p.vertices] for p in me.polygons]
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys), verts


def vgroup_weights(ob):
    """per-vertex dict {group_name: weight}"""
    names = {g.index: g.name for g in ob.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if g.group in names} for v in ob.data.vertices]


def copy_weights_nearest(dst, src, max_groups=4, only=None):
    """Transfer skin weights from src (same armature) to dst by nearest surface point
    (Data Transfer modifier, applied)."""
    for g in src.vertex_groups:
        if only is None or g.name in only:
            if g.name not in dst.vertex_groups:
                dst.vertex_groups.new(name=g.name)
    m = dst.modifiers.new("dt", "DATA_TRANSFER")
    m.object = src
    m.use_vert_data = True
    m.data_types_verts = {"VGROUP_WEIGHTS"}
    m.vert_mapping = "POLYINTERP_NEAREST"
    m.layers_vgroup_select_src = "ALL"
    m.layers_vgroup_select_dst = "NAME"
    # move before the armature modifier and apply
    bpy.context.view_layer.objects.active = dst
    while dst.modifiers.find("dt") > 0:
        bpy.ops.object.modifier_move_up(modifier="dt")
    bpy.ops.object.modifier_apply(modifier="dt")
    limit_weights(dst, max_groups)


def limit_weights(ob, n=4):
    names = {g.index: g.name for g in ob.vertex_groups}
    for v in ob.data.vertices:
        gs = sorted(((g.weight, g.group) for g in v.groups), reverse=True)
        keep = gs[:n]
        tot = sum(w for w, _ in keep) or 1.0
        for w, gi in gs[n:]:
            ob.vertex_groups[gi].remove([v.index])
        for w, gi in keep:
            ob.vertex_groups[gi].add([v.index], w / tot, "REPLACE")


def set_weights(ob, per_vertex):
    """per_vertex: list of {bone: weight} aligned with ob.data.vertices"""
    for i, ws in enumerate(per_vertex):
        tot = sum(ws.values()) or 1.0
        for b, w in ws.items():
            if w <= 1e-4:
                continue
            g = ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b)
            g.add([i], w / tot, "REPLACE")


def chain_weights(p, chain_pts, bones, root_bone, root_blend=0.3):
    """Weights for a point hanging off a bone chain: project onto the chain polyline,
    blend neighbouring bones; the first root_blend of bone 0 fades from root_bone."""
    pts = [V(q) for q in chain_pts]
    best = (1e9, 0, 0.0)
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
        d = (a + ab * t - p).length
        if d < best[0]:
            best = (d, k, t)
    _, k, t = best
    if k == 0 and t < root_blend and root_bone:
        u = t / root_blend
        return {root_bone: 1 - u, bones[0]: u}
    w = {bones[k]: 1.0}
    if t > 0.65 and k + 1 < len(bones):
        u = (t - 0.65) / 0.7
        w = {bones[k]: 1 - u, bones[k + 1]: u}
    elif t < 0.35 and k > 0:
        u = (0.35 - t) / 0.7
        w = {bones[k]: 1 - u, bones[k - 1]: u}
    return w


def geodesic_from(bm, seeds):
    """Dijkstra edge-length distance from seed verts over bm; returns {vert.index: d}"""
    bm.verts.index_update()
    dist = {v.index: 1e9 for v in bm.verts}
    h = []
    for v in seeds:
        dist[v.index] = 0.0
        heapq.heappush(h, (0.0, v.index))
    verts = list(bm.verts)
    while h:
        d, i = heapq.heappop(h)
        if d > dist[i]:
            continue
        v = verts[i]
        for e in v.link_edges:
            o = e.other_vert(v)
            nd = d + e.calc_length()
            if nd < dist[o.index]:
                dist[o.index] = nd
                heapq.heappush(h, (nd, o.index))
    return dist


def boundary_verts(bm):
    return [v for v in bm.verts if v.is_boundary]


def apply_modifiers(ob, names):
    bpy.context.view_layer.objects.active = ob
    for n in names:
        if ob.modifiers.get(n):
            bpy.ops.object.modifier_apply(modifier=n)
