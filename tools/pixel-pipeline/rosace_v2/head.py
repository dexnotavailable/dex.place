"""MMD用女性素体 head on the SiroinoSotai neck: cut, scale, place, taper, weld, weight, normals.

Runs inside Blender. The head and the body are welded into ONE mesh first (a zipper strip
between the body's neck ring and the head's cut ring), vertex normals are taken from that welded
surface, and only then is it split back into the pipeline's two objects ('body', 'head_skin',
separate part ids for the ID pass). Both halves get the welded normals as custom normals, so the
toon ramp is continuous across the seam: the seam exists only as an object boundary.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from .sources import SOURCES, append, verify

V = Vector

# ---------------------------------------------------------------------------- knobs
HEADS = 6.1              # heads tall (task: ~6-6.3; DESIGN.md 2: head 24 px at 144 = 6.0)
CHIN_OVER_RING = 0.010   # chin height above the front of the body's neck ring, source-body units
HEAD_DY = 0.0            # head forward (-) / back (+) against the neck ring centre, metres (final)
GAP = 0.006              # cut plane above the body's neck ring, metres (final): the welded strip
TAPER = 0.035            # head neck radius blends to the body ring over this height (final m)
NORMAL_BAND = 0.035      # weld-band normal smoothing: half-height about the cut plane (final m)
NORMAL_ITERS = 6
FILL_SPAN = 0.030        # source-unit span below which a boundary loop on the head is a socket
FEATURES = ("02_Eyes", "02_Eyes_Highlight", "02_Eyes_White", "03_Eyeblow", "03_Eyelid",
            "03_Eyelush", "04_Mouth", "04_Tongue", "04_Tooth")


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def import_head():
    """evaluated (mirror applied) meshes of the MMD model in its own space + landmarks"""
    path = verify("primero")
    obs = append(path, SOURCES["primero"]["objects"])
    dg = bpy.context.evaluated_depsgraph_get()
    meshes = {}
    for name in ("01_Body",) + FEATURES:
        ob = obs[name]
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        me.transform(ob.matrix_world)
        meshes[name] = me
    rig = obs["00_Rig"]
    B = rig.data.bones
    lm = {"head_joint": rig.matrix_world @ B["頭"].head_local,
          "eye_L": rig.matrix_world @ B["左目"].head_local,
          "eye_R": rig.matrix_world @ B["右目"].head_local}
    for o in obs.values():
        bpy.data.objects.remove(o, do_unlink=True)
    me = meshes["01_Body"]
    P = [v.co for v in me.vertices]
    lm["top"] = max(p.z for p in P)
    # chin: lowest skin point on the face's centre line, in front of the neck
    lm["chin"] = min(p.z for p in P if abs(p.x) < 0.008 and p.y < -0.05 and 1.38 < p.z < 1.50)
    band = [p for p in P if abs(p.z - (lm["chin"] - 0.012)) < 0.006]
    lm["neck_y"] = (min(p.y for p in band) + max(p.y for p in band)) / 2
    lm["neck_w"] = max(p.x for p in band) - min(p.x for p in band)
    return me, meshes, lm


def fill_sockets(bm):
    """close the eye and mouth openings flush with the skin (the face is stamped as pixels, the
    3D head only carries its shape, as in v1's head_skin)"""
    loops = _loops(bm)
    n = 0
    for loop in loops:
        vs = {v for e in loop for v in e.verts}
        c = sum((v.co for v in vs), V()) / len(vs)
        span = max((v.co - c).length for v in vs)
        if span < FILL_SPAN and c.z > 1.42 and c.y < 0:
            res = bmesh.ops.holes_fill(bm, edges=loop, sides=0)
            faces = res.get("faces", [])
            if faces:
                bmesh.ops.triangulate(bm, faces=faces)
                inner = [v for f in faces for v in f.verts if v not in vs]
                for _ in range(4):
                    for v in inner:
                        nb = [e.other_vert(v).co for e in v.link_edges]
                        v.co = v.co.lerp(sum(nb, V()) / len(nb), 0.5)
                n += 1
    return n


def _loops(bm):
    bm.edges.index_update()
    order = sorted((e for e in bm.edges if e.is_boundary), key=lambda e: e.index)
    left = set(order)
    loops = []
    for e0 in order:
        if e0 not in left:
            continue
        left.discard(e0)
        loop, stack = [e0], [e0]
        while stack:
            e = stack.pop()
            for v in e.verts:
                for e2 in v.link_edges:
                    if e2 in left:
                        left.discard(e2)
                        loop.append(e2)
                        stack.append(e2)
        loops.append(sorted(loop, key=lambda e: e.index))
    return loops


# ---------------------------------------------------------------------------- planning
def plan(lm, ring_src, zmin_src, H_top, sole):
    """head scale, body scale and the placement, from the proportion target.
    ring_src: body neck-ring vertex positions (source-body units, after the key bake)."""
    head_len = (H_top - sole) / HEADS
    s_h = head_len / (lm["top"] - lm["chin"])
    chin = H_top - head_len
    front = min(ring_src, key=lambda p: p.y)
    back = max(ring_src, key=lambda p: p.y)
    s_b = (chin - sole) / (front.z + CHIN_OVER_RING - zmin_src)

    def body_map(p):
        return V((p.x * s_b, p.y * s_b, (p.z - zmin_src) * s_b + sole))
    ring = [body_map(p) for p in ring_src]
    cb = sum(ring, V()) / len(ring)
    t = (body_map(back) - body_map(front))
    t.x = 0
    t.normalize()
    n = V((0.0, -t.z, t.y)).normalized()          # ring-plane normal, tilted forward with the neck
    if n.z < 0:
        n = -n
    A = V((0.0, cb.y + HEAD_DY, chin))
    C = V((0.0, lm["neck_y"], lm["chin"]))

    def head_map(p):
        return A + (V(p) - C) * s_h
    return {"head_len": head_len, "s_h": s_h, "s_b": s_b, "chin": chin, "ring_centre": cb,
            "normal": n, "body_map": body_map, "head_map": head_map, "ring": ring}


# ---------------------------------------------------------------------------- weld
def _frame(n):
    u = V((1, 0, 0))
    u = (u - n * u.dot(n)).normalized()
    w = n.cross(u).normalized()
    return u, w


def _polar(points, centre, n):
    u, w = _frame(n)
    out = []
    for p in points:
        q = p - centre
        q = q - n * q.dot(n)
        out.append((math.atan2(q.dot(w), q.dot(u)), q.length))
    return out


def _radius_fn(polar):
    pts = sorted(polar)
    ang = [a for a, _ in pts]
    rad = [r for _, r in pts]
    ang = [ang[-1] - 2 * math.pi] + ang + [ang[0] + 2 * math.pi]
    rad = [rad[-1]] + rad + [rad[0]]

    def f(a):
        for i in range(len(ang) - 1):
            if ang[i] <= a <= ang[i + 1]:
                t = (a - ang[i]) / max(ang[i + 1] - ang[i], 1e-9)
                return rad[i] + (rad[i + 1] - rad[i]) * t
        return rad[0]
    return f


def weld(body, head_me, P, arm):
    """cut the head at the plane GAP above the body's neck ring, taper its neck onto the ring,
    zipper-bridge the two rings, weight the head, and return the welded bmesh with a face layer
    'part' (0 body, 1 head, 2 bridge) and per-vertex welded normals."""
    n = P["normal"]
    cb = P["ring_centre"]
    plane_co = cb + n * GAP
    # --- head piece in final space, cut, largest component above the plane
    hb = bmesh.new()
    hb.from_mesh(head_me)
    fill_sockets(hb)
    for v in hb.verts:
        v.co = P["head_map"](v.co)
    bmesh.ops.bisect_plane(hb, geom=list(hb.verts) + list(hb.edges) + list(hb.faces),
                           plane_co=plane_co, plane_no=n, clear_inner=True)
    top = max(hb.verts, key=lambda v: v.co.z)
    keep, stack = {top}, [top]
    while stack:
        v = stack.pop()
        for e in v.link_edges:
            o = e.other_vert(v)
            if o not in keep:
                keep.add(o)
                stack.append(o)
    bmesh.ops.delete(hb, geom=[v for v in hb.verts if v not in keep], context="VERTS")
    cut = [v for v in hb.verts if v.is_boundary and abs((v.co - plane_co).dot(n)) < 1e-4]
    ch = sum((v.co for v in cut), V()) / len(cut)
    rh = _radius_fn(_polar([v.co for v in cut], ch, n))
    rb = _radius_fn(_polar(P["ring"], cb, n))
    target_c = cb + n * GAP
    u, w = _frame(n)
    taper_w = {}
    for v in hb.verts:
        d = (v.co - plane_co).dot(n)
        q = v.co - ch - n * d
        a = math.atan2(q.dot(w), q.dot(u))
        r = q.length
        k_r = 1.0 - smoothstep(1.08, 1.35, r / max(rh(a), 1e-6))
        k = k_r * (1.0 - smoothstep(0.0, TAPER, d))
        taper_w[v] = k
        if k <= 0:
            continue
        scale = 1.0 + (rb(a) / max(rh(a), 1e-6) - 1.0) * k
        v.co = ch + (target_c - ch) * k + n * d + q * scale
    # --- merge into the body mesh
    bm = bmesh.new()
    bm.from_mesh(body.data)
    part = bm.faces.layers.int.new("part")
    deform = bm.verts.layers.deform.verify()
    hwl = bm.verts.layers.float.new("hw")      # head weight, written to the groups after split
    for v in bm.verts:
        v[hwl] = -1.0                            # body verts keep their own weights
    gi = {g.name: g.index for g in body.vertex_groups}
    bm.verts.ensure_lookup_table()
    ring_ids = P["ring_ids"]
    ring_v = [bm.verts[i] for i in ring_ids]
    hw_ring = sum(v[deform].get(gi["J_Bip_C_Head"], 0.0) for v in ring_v) / len(ring_v)
    vmap = {}
    for v in hb.verts:
        nv = bm.verts.new(v.co)
        k = taper_w[v]
        wh = 1.0 + (hw_ring - 1.0) * k
        nv[hwl] = wh
        vmap[v] = nv
    for f in hb.faces:
        nf = bm.faces.new([vmap[v] for v in f.verts])
        nf[part] = 1
        nf.smooth = True
    for f in bm.faces:
        if f[part] != 1:
            f[part] = 0
    # --- zipper bridge, walking both rings by angle about the neck axis
    A = [(a, v) for (a, _), v in zip(_polar([v.co for v in ring_v], cb, n), ring_v)]
    Bh = [(a, vmap[v]) for (a, _), v in zip(_polar([v.co for v in cut], ch, n), cut)]
    A.sort(key=lambda x: x[0])
    Bh.sort(key=lambda x: x[0])
    na, nb_ = len(A), len(Bh)
    ua = [a for a, _ in A] + [A[0][0] + 2 * math.pi]
    ub = [b for b, _ in Bh] + [Bh[0][0] + 2 * math.pi]
    # start both walks at the same angle: rotate B so its first vertex is the nearest to A[0]
    j0 = min(range(nb_), key=lambda j: abs(math.remainder(ub[j] - ua[0], 2 * math.pi)))
    Bh = Bh[j0:] + Bh[:j0]
    ub = [b for b, _ in Bh]
    ub = [ub[0] + math.remainder(b - ub[0], 2 * math.pi) % (2 * math.pi) for b in ub] + [ub[0] + 2 * math.pi]
    shift = ub[0] - ua[0]
    ub = [b - shift for b in ub]
    i = j = 0
    bridge = []
    while i < na or j < nb_:
        a0, a1 = A[i % na][1], A[(i + 1) % na][1]
        b0, b1 = Bh[j % nb_][1], Bh[(j + 1) % nb_][1]
        if j >= nb_ or (i < na and ua[i + 1] <= ub[j + 1]):
            bridge.append(bm.faces.new((a0, a1, b0)))
            i += 1
        else:
            bridge.append(bm.faces.new((a0, b1, b0)))
            j += 1
    for f in bridge:
        f[part] = 2
        f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.normal_update()
    # the weld band (zipper triangles + the tapered neck) is faceted at 16-vs-30 verts: smooth
    # its normals over the band so the toon band edges run clean round the neck (seam check,
    # review/rosace/base-v2/assemble/checks/seam_*.png)
    band = [v for v in bm.verts if abs((v.co - plane_co).dot(n)) < NORMAL_BAND
            and ((v.co - plane_co) - n * (v.co - plane_co).dot(n)).length < 0.09]
    for _ in range(NORMAL_ITERS):
        new = {}
        for v in band:
            acc = v.normal.copy()
            for e in v.link_edges:
                acc += e.other_vert(v).normal
            new[v] = acc.normalized()
        for v in band:
            fade = 1.0 - smoothstep(0.6 * NORMAL_BAND, NORMAL_BAND, abs((v.co - plane_co).dot(n)))
            v.normal = v.normal.lerp(new[v], fade).normalized()
    hb.free()
    return bm, {"cut_verts": len(cut), "ring_verts": na, "bridge_tris": len(bridge),
                "head_verts": len(vmap), "ring_head_weight": round(hw_ring, 3),
                "neck_radius_ratio": round(rb(0.0) / rh(0.0), 3)}


def split(bm, body, arm):
    """welded bmesh -> 'body' (part 0 + 2) and 'head_skin' (part 1), welded normals on both"""
    part = bm.faces.layers.int["part"]
    nrm = [v.normal.copy() for v in bm.verts]
    nx = bm.verts.layers.float.new("nx")
    ny = bm.verts.layers.float.new("ny")
    nz = bm.verts.layers.float.new("nz")
    for v, n in zip(bm.verts, nrm):
        v[nx], v[ny], v[nz] = n
    head_me = bpy.data.meshes.new("head_skin")
    head = bpy.data.objects.new("head_skin", head_me)
    bpy.context.scene.collection.objects.link(head)
    for g in body.vertex_groups:        # the mesh needs its group names before the weights land
        head.vertex_groups.new(name=g.name)
    for name, keep in (("head", (1,)), ("body", (0, 2))):
        b2 = bm.copy()
        p2 = b2.faces.layers.int["part"]
        bmesh.ops.delete(b2, geom=[f for f in b2.faces if f[p2] not in keep], context="FACES")
        bmesh.ops.delete(b2, geom=[v for v in b2.verts if not v.link_faces], context="VERTS")
        normals = [V((v[b2.verts.layers.float["nx"]], v[b2.verts.layers.float["ny"]],
                      v[b2.verts.layers.float["nz"]])) for v in b2.verts]
        me = body.data if name == "body" else head_me
        b2.to_mesh(me)
        b2.free()
        # head-piece verts (hw >= 0) get Head/Neck weights on BOTH objects: the head's cut ring
        # is shared by the bridge strip, which belongs to 'body'
        ob = head if name == "head" else body
        hw = [0.0] * len(me.vertices)
        me.attributes["hw"].data.foreach_get("value", hw)
        gh = ob.vertex_groups["J_Bip_C_Head"]
        gn = ob.vertex_groups["J_Bip_C_Neck"]
        for i, w in enumerate(hw):
            if w < 0:
                continue
            gh.add([i], w, "REPLACE")
            if w < 1.0:
                gn.add([i], 1.0 - w, "REPLACE")
        for a in ("nx", "ny", "nz", "part", "hw"):
            if a in me.attributes:
                me.attributes.remove(me.attributes[a])
        for p in me.polygons:
            p.use_smooth = True
        me["welded_normals"] = [c for n in normals for c in n]
    head.parent = arm
    m = head.modifiers.new("Armature", "ARMATURE")
    m.object = arm
    # drop empty groups on the head (it only uses Head and Neck)
    used = {g.group for v in head_me.vertices for g in v.groups if g.weight > 0}
    drop = [g.name for g in head.vertex_groups if g.index not in used]   # names: removal reindexes
    for n in drop:
        head.vertex_groups.remove(head.vertex_groups[n])
    return head


def set_normals(ob, face_flatten=None):
    me = ob.data
    flat = me["welded_normals"]
    normals = [V(flat[i * 3:i * 3 + 3]).normalized() for i in range(len(me.vertices))]
    if face_flatten:
        normals = face_flatten(ob, normals)
    me.normals_split_custom_set_from_vertices(normals)
    del me["welded_normals"]


def face_flattener(arm, chin, top, head_len):
    """v1's anime face normals (rosace/body.py flatten_face_normals: the front of the face takes
    a smooth ellipsoid's normals so the toon bands fall as clean shapes), with two changes: the
    ellipsoid scales with the head, and it fades out below the chin so the neck (and the weld
    ring) keeps the welded normals."""
    k = head_len / 0.317        # v1 radii were tuned on a 0.317 m head
    rx, ry, rz = 0.10 * k, 0.11 * k, 0.14 * k
    hb = arm.data.bones["J_Bip_C_Head"]
    c = V((0.0, hb.head_local.y + 0.01 * k, (chin + top) / 2 + 0.01 * k))

    def run(ob, normals, strength=0.85):
        out = []
        for v, n0 in zip(ob.data.vertices, normals):
            p = v.co
            d = p - c
            n_ell = V((d.x / rx ** 2, d.y / ry ** 2, d.z / rz ** 2)).normalized()
            front = smoothstep(0.02 * k, -0.05 * k, p.y - c.y)
            gate = smoothstep(chin - 0.005, chin + 0.03, p.z)
            n_face = n_ell.lerp(V((0.0, -1.0, 0.1)), 0.55).normalized()
            out.append(n0.lerp(n_face, strength * front * gate).normalized())
        return out
    return run


def feature_objects(meshes, P, arm, coll_name="head_ref"):
    """the source's eyes, brows, lashes and mouth, parented to the head, never rendered: a
    placement reference for the face stamps (the face itself is authored as pixels)"""
    coll = bpy.data.collections.new(coll_name)
    bpy.context.scene.collection.children.link(coll)
    out = []
    for name in FEATURES:
        me = meshes[name]
        me.transform(Matrix.Translation(V()))
        for v in me.vertices:
            v.co = P["head_map"](v.co)
        ob = bpy.data.objects.new(f"ref_{name[3:].lower()}", me)
        coll.objects.link(ob)
        ob.parent = arm
        g = ob.vertex_groups.new(name="J_Bip_C_Head")
        g.add(list(range(len(me.vertices))), 1.0, "REPLACE")
        m = ob.modifiers.new("Armature", "ARMATURE")
        m.object = arm
        ob.hide_render = True
        ob["part"] = "head_ref"
        out.append(ob)
    coll.hide_render = True
    return out
