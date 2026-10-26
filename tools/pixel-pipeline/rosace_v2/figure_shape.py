"""Figure-pose lane: bust shape variants on the v2 body (DESIGN.md revision 3.5, item 4).

A non-destructive, parameterised change: one shape key 'figure_bust' on the body (the baked
human-authored base stays the Basis key, untouched) and a MATCHING shape key on every garment,
strap, pendant and hair piece that sits on the chest, so the bodice, the chest window, the
halter straps, the collar and the collar cross follow the new form in any pose. No remesh, no
sculpt: the key is an analytic displacement field, masked by the source author's own bust
weights (J_Sec_*_Bust1), evaluated in the rest pose, so the armature still poses it.

Parameters (art/rosace/figure/shape.json, one entry per variant; 'current' names the variant
every command uses when --variant is not given):
  volume      target ratio of the added volume to the bust mound's volume on the adopted base
              (1.20 = +20%). The mound is the volume in front of each breast's base plane (a
              plane fitted through the rim of the bust weights). The script solves the scale
              gain k that hits it, AFTER every other term (lift, projection, raise, fill) is
              applied, so variants with the same volume differ in shape, not size.
  lift_deg    rotation of the mass upward about a lateral hinge (the lower pole rises)
  hinge_frac  where the hinge sits, as a fraction of the base's upper radius above the base
              centre (0.5 = the FP1 variants; 1.0 = the top of the base, so nothing above the
              hinge is swung back into the chest: the S3 shelf came from that backward swing)
  projection  extra stretch along the base plane's normal, as a fraction of the height above
              the plane (0.15 = the apex stands 15% further out)
  raise_m     translation of the masked mass straight up, metres (a higher attachment)
  fill_m      upper-pole fill, metres: the chest above the mound is pushed out along the forward
              part of the base normal by a bump that is 0 at fill_top_m below the shoulder-joint
              line (negative = above it), 1 at fill_peak_m and 0 again at fill_bottom_m (1 px at
              144 = 13.2 mm); laterally a Gaussian of sigma fill_width_m about x = +-fill_x_m
              (null = each mound's apex column).
              It sits ABOVE the ledge a lifted mound makes and turns it into a ramp
  under_m     the same kind of bump just under the underbust fold (under_top_m / under_peak_m /
              under_bottom_m below the shoulder line), so the lower curve runs into the ribcage
              over a few rows instead of overhanging a crease
  mask_smooth, h0_frac  the mask's smoothing passes and height ramp (defaults 6 and 0.35)
The field: p1 = P0 + (p - P0)(1 + k m); p2 = p1 + n h(p1) proj m; p3 = rot(hinge, lift m) p2;
p4 = p3 + z raise m; p5 = p4 + sum of the fill bumps at p, where m is the smoothed bust weight times
smoothstep(0, H0, height above the base plane), so it is exactly 0 at the chest wall and the
transition has no crease; the fill is 0 behind the chest front and on the arms.

Garments: the displacement of a garment vertex is the same field evaluated at the garment's own
position, with the mask of the nearest body vertex, faded out between 2 and 8 cm from the skin
(so a shell 6.5 mm off the skin moves with it and keeps its gap; a hair lock 5 cm out is pushed
part of the way). Rigid pieces (the collar cross and its plate) take the mean displacement, so
they stay rigid. The 'ao' occlusion attribute is re-baked on the new shape near the bust (the
underbust shadow lives in it), with bake.py's settings.

Run (one Blender at a time; absolute paths):
  python tools/pixel-pipeline/blender_env.py run --python-exit-code 1 --python \
      tools/pixel-pipeline/rosace_v2/figure_shape.py -- build --variant S3 \
      [--src D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend] \
      [--out D:/Dex/Projects/dex-place-art/rosace/build/lanes/figure-pose-shape_S3.blend]
  ... figure_shape.py -- render --blend <lane .blend> --out <dir> [--views q34:30,side:-90,back:180]
      [--px 144,80] [--hi 480] [--pose idle_hero] [--variant S2  (bundle files)]
  ... figure_shape.py -- bundle [--variants S0,S1,S2,S3,S4] [--select S0]   (every variant as keys in
      lanes/figure-pose-shape.blend: key figure_bust_<V> + attribute ao_<V>)
  ... figure_shape.py -- select --blend <lane bundle .blend> --variant S2 [--out <lane .blend>]
  ... figure_shape.py -- sweep --out <json> [--src <blend>] --params '[{"k": "a", "volume": 1.28, ...}]'
      (no file written: each parameter set is solved and measured on the side profile, PS-N20)
  ... figure_shape.py -- measure --blends <a.blend,b.blend> --out <json>   (rest measures + profile)
  python tools/pixel-pipeline/rosace_v2/figure_shape.py post --root <renders dir>     (plain python)
  python tools/pixel-pipeline/rosace_v2/figure_shape.py sheets --root <renders dir> \
      --out review/rosace/art/figure-pose/shape [--seed N]
Never writes rosace.blend, rosace_v1.blend or rosace_v2.blend (only the Integrate step does).
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
SHAPE_JSON = os.path.join(REPO, "art", "rosace", "figure", "shape.json")
BUILD = os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build")
FORBIDDEN = ("rosace.blend", "rosace_v1.blend", "rosace_v2.blend")

KEY = "figure_bust"
SIDES = {"L": "J_Sec_L_Bust1", "R": "J_Sec_R_Bust1"}
RIGID = ("collar_cross", "collar_plate")          # pendant + backing: move as one piece
SKIP = ("body", "head_skin")                      # the body gets the field itself; the head is far
SKIP_PARTS = ("glaive",)
MASK_SMOOTH = 6          # Laplacian passes over the bust weights (a 1-2 ring weight edge -> no crease)
H0_FRAC = 0.35           # the height mask reaches 1 at this fraction of the mound's max height
FADE = (0.02, 0.08)      # garment/hair displacement: full within 2 cm of the skin, 0 past 8 cm
AO_REACH = 0.10          # re-bake 'ao' on verts within this distance of any displaced vert


# every parameter a variant may set, with the value that reproduces the FP1 variants (S0-S4)
PARAM_DEFAULTS = {"volume": 1.0, "lift_deg": 0.0, "hinge_frac": 0.5, "projection": 0.0, "raise_m": 0.0,
                  "fill_m": 0.0, "fill_top_m": -0.013, "fill_peak_m": 0.026, "fill_bottom_m": 0.046,
                  "fill_width_m": 0.05, "fill_x_m": None,
                  "under_m": 0.0, "under_top_m": 0.165, "under_peak_m": 0.186, "under_bottom_m": 0.225,
                  "mask_smooth": MASK_SMOOTH, "h0_frac": H0_FRAC}
PPM144 = 144 / 1.8956     # px per metre at 144 (rosace_height of the v2 base)


def load_shape(path=SHAPE_JSON):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def current_variant(path=SHAPE_JSON):
    """the variant shape.json names as 'current' (the one every lane build applies by default)"""
    return load_shape(path).get("current") or "S0"


def variant_params(name=None, path=SHAPE_JSON):
    d = load_shape(path)
    name = name or d.get("current") or "S0"
    p = dict(PARAM_DEFAULTS)
    p.update(d.get("defaults", {}))
    p.update(d["variants"][name])
    return p


def full_params(params):
    p = dict(PARAM_DEFAULTS)
    p.update(params)
    return p


def is_identity(p):
    p = full_params(p)
    return (abs(p["volume"] - 1.0) < 1e-9 and not p["lift_deg"] and not p["projection"] and not p["raise_m"]
            and not p["fill_m"] and not p["under_m"])


# ============================================================================ Blender side
def _np():
    import numpy as np
    return np


def mesh_co(ob):
    np = _np()
    n = len(ob.data.vertices)
    co = np.empty(n * 3)
    ob.data.vertices.foreach_get("co", co)
    return co.reshape(n, 3)


def mesh_tris(ob):
    np = _np()
    me = ob.data
    me.calc_loop_triangles()
    t = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get("vertices", t)
    return t.reshape(-1, 3)


def signed_volume(co, tris):
    a, b, c = co[tris[:, 0]], co[tris[:, 1]], co[tris[:, 2]]
    return float((a * _np().cross(b, c)).sum() / 6.0)


def smoothstep_np(e0, e1, x):
    np = _np()
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def arm_weights(body):
    """per vertex: the share of its weight on shoulder/arm/hand bones (the fill leaves the arms)"""
    np = _np()
    names = {g.index: g.name for g in body.vertex_groups}
    armw = np.zeros(len(body.data.vertices))
    for v in body.data.vertices:
        tot = sum(g.weight for g in v.groups) or 1.0
        armw[v.index] = sum(g.weight for g in v.groups if any(k in names[g.group] for k in ARM_KEYS)) / tot
    return armw


def shoulder_z():
    import bpy
    arm = bpy.data.objects["rosace_rig"]
    return float(sum((arm.matrix_world @ arm.data.bones[f"J_Bip_{s}_UpperArm"].head_local).z for s in "LR") / 2)


def bust_frames(body, params=None):
    """per side: the smoothed bust weight, the base plane (P0, n) fitted through the weight's rim,
    the hinge axis for lift, and the height mask. All in rest-pose world coords (the body sits at
    identity)."""
    np = _np()
    P = full_params(params or {})
    n_smooth, h0_frac = int(P["mask_smooth"]), float(P["h0_frac"])
    co = mesh_co(body)
    n = len(co)
    me = body.data
    ed = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", ed)
    ed = ed.reshape(-1, 2)
    deg = np.bincount(ed.ravel(), minlength=n).astype(float)
    frames = {}
    for s, g in SIDES.items():
        gi = body.vertex_groups[g].index
        w = np.zeros(n)
        for v in me.vertices:
            for x in v.groups:
                if x.group == gi:
                    w[v.index] = x.weight
        raw = w.copy()
        for _ in range(n_smooth):
            acc = np.zeros(n)
            np.add.at(acc, ed[:, 0], w[ed[:, 1]])
            np.add.at(acc, ed[:, 1], w[ed[:, 0]])
            w = np.where(deg > 0, 0.5 * w + 0.5 * acc / np.maximum(deg, 1), w)
        # base plane through the rim of the raw weights
        rim = (raw > 0.02) & (raw < 0.35)
        P = co[rim]
        P0 = P.mean(0)
        _, _, vt = np.linalg.svd(P - P0)
        nrm = vt[2]
        core = co[raw > 0.5]
        if (core.mean(0) - P0) @ nrm < 0:        # the normal points out of the chest
            nrm = -nrm
        tip = core[np.argmax((core - P0) @ nrm)]
        h = (co - P0) @ nrm
        hmax = float(h[raw > 0.5].max())
        up = np.array([0.0, 0.0, 1.0])
        u_up = up - nrm * (up @ nrm)
        u_up /= np.linalg.norm(u_up)
        axis = np.cross(nrm, up)
        axis /= np.linalg.norm(axis)
        r_up = float(((P - P0) @ u_up).max())
        hinge = P0 + u_up * 0.5 * r_up
        m = np.clip(w, 0, 1) * smoothstep_np(0.0, h0_frac * hmax, h)
        frames[s] = {"P0": P0, "n": nrm, "axis": axis, "hinge": hinge, "hmax": hmax, "mask": m,
                     "u_up": u_up, "r_up": r_up,
                     "raw": raw, "tip": tip, "rim_n": int(rim.sum()),
                     "r_base": float(np.linalg.norm(P - P0, axis=1).mean())}
    return co, frames


def field(p, m, F, k, P):
    """displaced positions for points p (N,3) with mask m (N,) under frame F (no fill)"""
    np = _np()
    P0, nrm = F["P0"], F["n"]
    proj, lift_deg = float(P["projection"]), float(P["lift_deg"])
    p1 = P0 + (p - P0) * (1.0 + k * m)[:, None]
    h = np.clip((p1 - P0) @ nrm, 0.0, None)
    p2 = p1 + nrm[None, :] * (h * proj * m)[:, None]
    if lift_deg:
        th = math.radians(lift_deg) * m
        a = F["axis"]
        hinge = P0 + F["u_up"] * float(P["hinge_frac"]) * F["r_up"]
        d = p2 - hinge
        c, s = np.cos(th)[:, None], np.sin(th)[:, None]
        d = d * c + np.cross(a[None, :], d) * s + a[None, :] * (d @ a)[:, None] * (1 - c)
        p2 = hinge + d
    if P["raise_m"]:
        p2 = p2 + np.array([0.0, 0.0, 1.0])[None, :] * (float(P["raise_m"]) * m)[:, None]
    return p2


def fill_dir(F):
    """the fill pushes along the base normal's forward (y) and up (z) parts, never sideways"""
    np = _np()
    d = np.array([0.0, F["n"][1], F["n"][2]])
    return d / np.linalg.norm(d)


def bumps(P):
    """the fill bumps a parameter set asks for: (amount_m, top_m, peak_m, bottom_m), heights below
    the shoulder-joint line"""
    out = []
    if P["fill_m"]:
        out.append((float(P["fill_m"]), float(P["fill_top_m"]), float(P["fill_peak_m"]), float(P["fill_bottom_m"])))
    if P["under_m"]:
        out.append((float(P["under_m"]), float(P["under_top_m"]), float(P["under_peak_m"]), float(P["under_bottom_m"])))
    return out


def fill_disp(p, F, P, sh_z, armw):
    """(N,3) fill displacement for points p under side frame F: the sum of the bumps along fill_dir"""
    np = _np()
    d = np.zeros((len(p), 3))
    for amt, top, pk, bot in bumps(P):
        d += fill_dir(F)[None, :] * (amt * fill_weight(p, F, P, sh_z, armw, top, pk, bot))[:, None]
    return d


def fill_weight(p, F, P, sh_z, armw, top, pk, bot):
    """fill bump weight (N,) for points p: a vertical bump that is 0 at `top` below the
    shoulder-joint line (negative = above it), 1 at `pk` and 0 again at `bot`; a lateral Gaussian
    about the apex column; 0 behind the chest front and on the arms"""
    np = _np()
    z_top = sh_z - top
    z_pk = sh_z - pk
    z_bot = sh_z - bot
    z = p[:, 2]
    up = smoothstep_np(z_top, z_pk, z)             # 0 at z_top, 1 at the peak (z decreasing)
    down = 1.0 - smoothstep_np(z_pk, z_bot, z)     # 1 at the peak, 0 at the bottom
    wz = np.where(z >= z_pk, up, down)
    cx = F["tip"][0] if P.get("fill_x_m") is None else math.copysign(float(P["fill_x_m"]), F["tip"][0])
    wx = np.exp(-((p[:, 0] - cx) / float(P["fill_width_m"])) ** 2)
    front = 1.0 - smoothstep_np(-0.03, 0.01, p[:, 1])
    notarm = 1.0 - smoothstep_np(0.1, 0.35, armw)
    return wz * wx * front * notarm


def body_new(co, frames, k, P, fills=None):
    """fills: {side: fill_disp of the body verts} (constant in k, so the solver passes it in)"""
    out = co.copy()
    for s, F in frames.items():
        out += field(co, F["mask"], F, k, P) - co
        if fills is not None:
            out += fills[s]
    return out


def mound_volume(body_co, tris, frames, step=0.002):
    """volume in front of each side's base plane, over the raw bust weight's footprint
    (ray grid along -n; the adopted base's value is the denominator of 'volume')"""
    np = _np()
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    bvh = BVHTree.FromPolygons([Vector(p) for p in body_co], tris.tolist())
    total = 0.0
    per = {}
    for s, F in frames.items():
        P0, nrm = F["P0"], F["n"]
        e1 = F["axis"]
        e2 = np.cross(nrm, e1)
        R = 1.6 * F["r_base"]
        vol = 0.0
        ks = np.arange(-R, R + 1e-9, step)
        raw = F["raw"]
        for u in ks:
            for v in ks:
                o = P0 + e1 * u + e2 * v + nrm * 0.4
                hit, _, fi, _ = bvh.ray_cast(Vector(o), Vector(-nrm), 0.8)
                if hit is None:
                    continue
                h = (np.array(hit) - P0) @ nrm
                if h <= 0:
                    continue
                if raw[tris[fi]].max() < 0.02:
                    continue
                vol += h * step * step
        per[s] = vol
        total += vol
    return total, per


def solve_k(co, tris, frames, V0, P, fills=None):
    """bisection on the scale gain k so that V0 + dV(k) = volume * V0 (dV from the exact mesh
    volume change; the neck ring, the only open boundary, never moves)"""
    v_ref = signed_volume(co, tris)
    target = float(P["volume"])

    def ratio(k):
        return 1.0 + (signed_volume(body_new(co, frames, k, P, fills), tris) - v_ref) / V0
    lo, hi = -0.5, 1.5
    if is_identity(P):
        return 0.0, 1.0
    for _ in range(40):
        mid = 0.5 * (lo + hi)
        if ratio(mid) < target:
            lo = mid
        else:
            hi = mid
    k = 0.5 * (lo + hi)
    return k, ratio(k)


def garment_new(ob, co_body, frames, k, P, kd, sh_z=None, armw=None):
    """matching displacement for a non-body mesh (rest pose, world = local: identity objects)"""
    np = _np()
    co = mesh_co(ob)
    if not len(co):
        return None
    M = ob.matrix_world
    assert M == M.Identity(4), f"{ob.name} not at identity"
    idx = np.empty(len(co), dtype=np.int64)
    dist = np.empty(len(co))
    for i, p in enumerate(co):
        _, j, d = kd.find(p)
        idx[i], dist[i] = j, d
    fade = 1.0 - smoothstep_np(FADE[0], FADE[1], dist)
    if not (fade > 0).any():
        return None
    disp = np.zeros_like(co)
    for F in frames.values():
        m = F["mask"][idx] * fade
        if (m > 1e-6).any():
            disp += field(co, m, F, k, P) - co
        if bumps(P):
            disp += fill_disp(co, F, P, sh_z, armw[idx]) * fade[:, None]
    if np.abs(disp).max() < 1e-6:
        return None
    if ob.name in RIGID:
        disp[:] = disp.mean(0)
    return co + disp


def rebake_ao(targets, near_pts, reach=AO_REACH, dist=0.075, strength=0.9, rays=24):
    """bake.ensure_ao's occlusion, recomputed only on vertices within `reach` of a displaced
    point (the rest keep the canonical bake bit for bit). Occluders: every visible mesh, at the
    coordinates currently in the mesh data (the caller swaps the new shape in)."""
    import bpy
    np = _np()
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from mathutils.kdtree import KDTree
    from rosace.bake import ensure_attr, hemisphere_dirs
    obs = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_render]
    verts, polys = [], []
    for ob in obs:
        Mw = ob.matrix_world
        base = len(verts)
        verts += [Mw @ v.co for v in ob.data.vertices]
        polys += [[base + i for i in p.vertices] for p in ob.data.polygons]
    bvh = BVHTree.FromPolygons(verts, polys)
    kd = KDTree(len(near_pts))
    for i, p in enumerate(near_pts):
        kd.insert(Vector(p), i)
    kd.balance()
    dirs = hemisphere_dirs(rays)
    n_done = 0
    for ob in targets:
        if ob.get("no_ao") or ob.hide_render:
            continue
        me = ob.data
        a = ensure_attr(ob, "ao", 1.0)
        vals = np.empty(len(me.vertices))
        a.data.foreach_get("value", vals)
        crease = me.attributes.get("crease")
        cv = np.zeros(len(me.vertices))
        if crease:
            crease.data.foreach_get("value", cv)
        Mw = ob.matrix_world
        N3 = Mw.to_3x3().inverted().transposed()
        o_dist = ob.get("ao_dist", dist)
        o_str = ob.get("ao_strength", strength)
        for i, v in enumerate(me.vertices):
            p = Mw @ v.co
            if kd.find(p)[2] > reach:
                continue
            nn = (N3 @ v.normal).normalized()
            if nn.length < 0.5:
                vals[i] = 1.0
                continue
            q = nn.to_track_quat("Z", "Y").to_matrix()
            origin = p + nn * 0.0015
            occ = 0.0
            for d in dirs:
                hit, _, _, dd = bvh.ray_cast(origin, q @ d, o_dist)
                if hit is not None:
                    occ += 1.0 - (dd / o_dist) ** 2
            vals[i] = max(0.0, min(1.0, (1.0 - o_str * occ / len(dirs)) * (1.0 - cv[i])))
            n_done += 1
        a.data.foreach_set("value", vals)
    return n_done


def apply(params, name="custom", key=KEY, value=1.0):
    """apply one variant to the open file: body key + matching keys + ao re-bake. Returns a report.
    `key`/`value`: the shape-key name and its slider (the bundle adds one key per variant at 0)."""
    import bpy
    np = _np()
    from mathutils.kdtree import KDTree
    body = bpy.data.objects["body"]
    assert body.data.shape_keys is None or key not in body.data.shape_keys.key_blocks, (
        "already applied: since round WH2 (2026-09-29) the canonical rosace.blend carries figure_bust "
        + str(bpy.data.objects["rosace_rig"].get("figure_shape", "?"))
        + " (integrated.json build.bust); for a variant on the pre-bust base use --src build/rosace_wh1.blend")
    P = full_params(params)
    co, frames = bust_frames(body, P)
    tris = mesh_tris(body)
    V0, per0 = mound_volume(co, tris, frames)
    sh_z, armw = shoulder_z(), arm_weights(body)
    fills = {s: fill_disp(co, F, P, sh_z, armw) for s, F in frames.items()}
    k, ratio = solve_k(co, tris, frames, V0, P, fills)
    new_body = body_new(co, frames, k, P, fills)
    V1, per1 = mound_volume(new_body, tris, frames)
    kd = KDTree(len(co))
    for i, p in enumerate(co):
        kd.insert(p, i)
    kd.balance()
    news = {body.name: new_body}
    for ob in bpy.data.objects:
        if ob.type != "MESH" or ob.name in SKIP or ob.get("part") in SKIP_PARTS or ob.name.startswith("glaive"):
            continue
        nc = garment_new(ob, co, frames, k, P, kd, sh_z, armw)
        if nc is not None:
            news[ob.name] = nc
    moved = {}
    near = []
    olds = {}
    for nm, nc in news.items():
        ob = bpy.data.objects[nm]
        old = mesh_co(ob)
        d = np.linalg.norm(nc - old, axis=1)
        moved[nm] = {"verts": int((d > 1e-5).sum()), "max_mm": round(float(d.max()) * 1000, 2)}
        near.append(old[d > 1e-4])
        near.append(nc[d > 1e-4])
        olds[nm] = old
    near = np.concatenate(near) if near else np.zeros((0, 3))
    # ao on the new shape: swap the new coords into the mesh data, bake, swap back
    for nm, nc in news.items():
        me = bpy.data.objects[nm].data
        me.vertices.foreach_set("co", nc.ravel())
        me.update()
    ao_n = rebake_ao([bpy.data.objects[nm] for nm in news] +
                     [o for o in bpy.data.objects if o.type == "MESH" and o.name not in news], near) if len(near) else 0
    for nm, old in olds.items():
        me = bpy.data.objects[nm].data
        me.vertices.foreach_set("co", old.ravel())
        me.update()
    # the keys: the baked base is the Basis, the variant is 'figure_bust' at 1.0
    for nm, nc in news.items():
        ob = bpy.data.objects[nm]
        if ob.data.shape_keys is None:
            ob.shape_key_add(name="Basis", from_mix=False)
        kb = ob.shape_key_add(name=key, from_mix=False)
        kb.data.foreach_set("co", nc.ravel())
        kb.slider_min, kb.slider_max = 0.0, 1.0
        kb.value = value
    rep = {"variant": name, "params": params, "k": round(k, 5), "volume_ratio_solved": round(ratio, 4),
           "mound_ml": {"before": round(V0 * 1e6, 1), "after": round(V1 * 1e6, 1),
                        "per_side_before": {s: round(v * 1e6, 1) for s, v in per0.items()},
                        "per_side_after": {s: round(v * 1e6, 1) for s, v in per1.items()}},
           "grid_ratio": round(V1 / V0, 4) if V0 else None,
           "frames": {s: {"P0": [round(x, 4) for x in F["P0"]], "n": [round(x, 3) for x in F["n"]],
                          "hmax_mm": round(F["hmax"] * 1000, 1), "r_base_mm": round(F["r_base"] * 1000, 1),
                          "rim_verts": F["rim_n"]} for s, F in frames.items()},
           "moved": moved, "ao_rebaked_verts": ao_n,
           "profile": profile_summary(side_profile(body, new_body))}
    if key == KEY:
        bpy.data.objects["rosace_rig"]["figure_shape"] = json.dumps({"variant": name, "params": params, "k": k})
    return rep


def _ao_get(ob):
    np = _np()
    a = ob.data.attributes.get("ao")
    if a is None:
        return None
    v = np.empty(len(a.data))
    a.data.foreach_get("value", v)
    return v


def _ao_store(ob, name, vals):
    from rosace.bake import ensure_attr
    ensure_attr(ob, name, 1.0)
    ob.data.attributes[name].data.foreach_set("value", vals)


def bundle(variants):
    """every variant in one file: per variant a shape key 'figure_bust_<V>' (slider 0) on the body
    and on the garments it moves, and its re-baked occlusion as the attribute 'ao_<V>' (the
    canonical bake is kept as 'ao_S0'). The occlusion is a vertex attribute, not a key, so it can't
    ride on the slider: select() switches keys and copies the matching 'ao_<V>' into 'ao'."""
    import bpy
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    ao0 = {o.name: _ao_get(o) for o in meshes}
    reps = {}
    for v in variants:
        p = variant_params(v)
        if is_identity(p):
            continue                                   # S0: the Basis itself
        reps[v] = apply(p, v, key=f"{KEY}_{v}", value=0.0)
        for o in meshes:
            cur = _ao_get(o)
            if cur is None:
                continue
            if (cur != ao0[o.name]).any():
                _ao_store(o, f"ao_{v}", cur)
                if o.data.attributes.get("ao_S0") is None:
                    _ao_store(o, "ao_S0", ao0[o.name])
                o.data.attributes["ao"].data.foreach_set("value", ao0[o.name])
    bpy.data.objects["rosace_rig"]["figure_shape_bundle"] = json.dumps(
        {"variants": variants, "params": {v: variant_params(v) for v in variants},
         "k": {v: r["k"] for v, r in reps.items()}})
    select("S0")
    return reps


def select(variant):
    """bundle file: key 'figure_bust_<variant>' to 1, every other figure_bust_* key to 0, and the
    variant's occlusion into 'ao' ('S0' = the canonical base)."""
    import bpy
    np = _np()
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        sk = o.data.shape_keys
        if sk:
            for kb in sk.key_blocks:
                if kb.name.startswith(KEY + "_"):
                    kb.value = 1.0 if kb.name == f"{KEY}_{variant}" else 0.0
        src = o.data.attributes.get(f"ao_{variant}") or o.data.attributes.get("ao_S0")
        if src is not None and o.data.attributes.get("ao") is not None:
            v = np.empty(len(src.data))
            src.data.foreach_get("value", v)
            o.data.attributes["ao"].data.foreach_set("value", v)
    bpy.data.objects["rosace_rig"]["figure_shape"] = json.dumps({"variant": variant, "bundle": True})


ARM_KEYS = ("Shoulder", "UpperArm", "LowerArm", "Hand", "Thumb", "Index", "Middle", "Ring", "Little")


def measure_rest(body, co=None, H=1.8956, pxs=(144, 80)):
    """bare rest-pose sections (base_search.py's method: edge crossings of a z plane, torso edges
    only, arms excluded by their weights), in px at each height: the bust's front-to-back depth
    at its deepest section, the smallest depth in the 5-16 cm below it (the waist), their difference (how far the bust
    stands off the ribcage in a true profile), the bust's width and the waist's width."""
    np = _np()
    co = mesh_co(body) if co is None else co
    names = {g.index: g.name for g in body.vertex_groups}
    armw = np.zeros(len(co))
    for v in body.data.vertices:
        tot = sum(g.weight for g in v.groups) or 1.0
        armw[v.index] = sum(g.weight for g in v.groups if any(k in names[g.group] for k in ARM_KEYS)) / tot
    me = body.data
    E = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", E)
    E = E.reshape(-1, 2)
    ok = (armw[E[:, 0]] < 0.35) & (armw[E[:, 1]] < 0.35)
    A, B = co[E[ok, 0]], co[E[ok, 1]]

    def section(z):
        c = (A[:, 2] - z) * (B[:, 2] - z) <= 0
        a, b = A[c], B[c]
        dz = b[:, 2] - a[:, 2]
        t = np.where(np.abs(dz) > 1e-12, (z - a[:, 2]) / np.where(np.abs(dz) > 1e-12, dz, 1), 0.5)
        return a + (b - a) * t[:, None]

    def depth(q):
        return float(q[:, 1].max() - q[:, 1].min()) if len(q) else 0.0

    def width(q):
        return float(q[:, 0].max() - q[:, 0].min()) if len(q) else 0.0
    zs = np.arange(1.25, 1.50, 0.002)
    d = [depth(section(z)) for z in zs]
    ib = int(np.argmax(d))
    zb = float(zs[ib])
    under = [(depth(section(z)), z) for z in np.arange(zb - 0.16, zb - 0.05, 0.002)]
    du, zu = min(under)
    wz = [(width(section(z)), z) for z in np.arange(1.15, zb - 0.06, 0.002)]
    ww, zw = min(wz)
    m = {"bust_z": round(zb, 4), "depth_min_below_z": round(float(zu), 4), "waist_z": round(float(zw), 4)}
    for px in pxs:
        k = px / H
        m[str(px)] = {"bust_depth": round(d[ib] * k, 1), "depth_min_below": round(du * k, 1),
                      "bust_minus_below": round((d[ib] - du) * k, 1),
                      "bust_width": round(width(section(zb)) * k, 1), "waist_width": round(ww * k, 1)}
    return m


def side_profile(body, co=None):
    """rest-pose side profile of the torso front, one row per px at 144 (the method of
    review/.../research/measure_bust.py, moved into the repo): exact cross-sections of the body's
    edges at each row, arm/hand/shoulder-weighted vertices (> 0.3) dropped, |x| < 18 cm. Returns
    the raw numbers; profile_summary() turns them into the PS-N20 / PS-P10 / PS-P11 measures."""
    np = _np()
    import bpy
    co = mesh_co(body) if co is None else co
    arm = bpy.data.objects["rosace_rig"]
    names = {g.index: g.name for g in body.vertex_groups}
    armg = {i for i, n in names.items() if any(k in n for k in ARM_KEYS)}
    keep = np.ones(len(co), bool)
    for v in body.data.vertices:
        if sum(g.weight for g in v.groups if g.group in armg) > 0.3:
            keep[v.index] = False
    me = body.data
    E = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", E)
    E = E.reshape(-1, 2)
    E = E[keep[E[:, 0]] & keep[E[:, 1]]]
    A, B = co[E[:, 0]], co[E[:, 1]]

    def section(zc):
        m = (A[:, 2] - zc) * (B[:, 2] - zc) <= 0
        a, b = A[m], B[m]
        dz = b[:, 2] - a[:, 2]
        t = np.where(np.abs(dz) > 1e-9, (zc - a[:, 2]) / np.where(np.abs(dz) > 1e-9, dz, 1), 0.5)
        return a + (b - a) * t[:, None]

    def front(zc, xlim=0.18):
        q = section(zc)
        q = q[np.abs(q[:, 0]) < xlim]
        return float((-q[:, 1]).max()) if len(q) else None       # she faces -Y

    def back(zc, xlim=0.18):
        q = section(zc)
        q = q[np.abs(q[:, 0]) < xlim]
        return float((-q[:, 1]).min()) if len(q) else None
    sh_z = shoulder_z()
    ua_len = arm.data.bones["J_Bip_L_UpperArm"].length
    zs = np.arange(sh_z - 0.40, sh_z - 0.02, 0.004)
    prof = [(float(z), front(z), back(z)) for z in zs]
    prof = [q for q in prof if q[1] is not None and q[2] is not None]
    bz, bf, bb = max(prof, key=lambda q: q[1])
    below = [q for q in prof if bz - 0.16 < q[0] < bz - 0.02]
    uz, uf, ub = min(below, key=lambda q: q[1])

    def ext(zc, right, side):
        v = section(zc) @ right
        return float(v.max()) if side > 0 else float(-v.min())
    breaks = {}
    for yaw in (30, 45, 90):
        a = math.radians(yaw)
        right = np.array([math.cos(a), -math.sin(a), 0.0]) if yaw != 90 else np.array([0.0, -1.0, 0.0])
        for side, nm in ((1, "right"), (-1, "left")):
            e_b = max(ext(z, right, side) for z in np.arange(bz - 0.03, bz + 0.03, 0.004))
            breaks[f"yaw{yaw}_{nm}"] = round((e_b - ext(uz, right, side)) * PPM144, 2)
    step = 1.0 / PPM144
    rows = []
    z = sh_z + 4 * step
    while z > sh_z - 0.62:
        f, b = front(z), back(z)
        if f is not None:
            rows.append([round((sh_z - z) * PPM144, 2), round((bf - f) * PPM144, 2), round((f - b) * PPM144, 2)])
        z -= step
    return {"sh_z": sh_z, "apex_z": bz, "underbust_z": uz, "upperarm_px": ua_len * PPM144,
            "side_projection_px": (bf - uf) * PPM144, "bust_depth_px": (bf - bb) * PPM144,
            "underbust_depth_px": (uf - ub) * PPM144, "breaks_px": breaks,
            "rows": rows, "rows_doc": "[px below the shoulder-joint line, px behind the apex front, depth px] at 144"}


def profile_summary(pr):
    """the side profile as the checks read it (px at 144):
    shelf_px        largest one-row drop of the upper slope, collar to apex (PS-N20: <= 3.5)
    upper_rows      rows of the upper slope (setback falling from within 1 px of the flat chest to
                    the apex); lower_rows: apex to the row before the underbust fold (PS-P11 >= 1.5x)
    lower_step_px   largest one-row step of the lower curve before the fold
    fold_px         the jump into the underbust fold (the overhang; smaller = grows out of the chest)
    flat_rows       rows of flat chest (within 1 px of the top row) above the slope (PS-P11 >= 3)
    apex_below_sh_px, apex_frac_upperarm (PS-P11: 0.40-0.55), side_projection_px (PS-P10 9-12)"""
    rows = pr["rows"]
    sb = [r[1] for r in rows]
    ia = min(range(len(sb)), key=lambda i: (sb[i], i))
    top = sb[0]
    i0 = next((i for i in range(ia + 1) if sb[i] < top - 1.0), 0)
    steps_up = [sb[i - 1] - sb[i] for i in range(1, ia + 1)]
    jf = next((i for i in range(ia + 1, len(sb)) if sb[i] - sb[i - 1] > 3.0), len(sb) - 1)
    steps_lo = [sb[i] - sb[i - 1] for i in range(ia + 1, jf)]
    return {"shelf_px": round(max(steps_up) if steps_up else 0.0, 2),
            "shelf_row": rows[1 + steps_up.index(max(steps_up))][0] if steps_up else None,
            "upper_rows": ia - i0 + 1, "flat_rows": i0, "lower_rows": jf - ia,
            "lower_step_px": round(max(steps_lo) if steps_lo else 0.0, 2),
            "fold_px": round(sb[jf] - sb[jf - 1], 2),
            "apex_below_sh_px": round(rows[ia][0], 2),
            "apex_frac_upperarm": round(rows[ia][0] / pr["upperarm_px"], 3),
            "side_projection_px": round(pr["side_projection_px"], 2),
            "bust_depth_px": round(pr["bust_depth_px"], 2), "breaks_px": pr["breaks_px"],
            "setback_to_fold": sb[:jf + 1]}


def sweep(sets):
    """solve and measure parameter sets on the open file without writing anything (the body's
    mesh data is restored after each set)"""
    import bpy
    body = bpy.data.objects["body"]
    base = mesh_co(body)
    tris = mesh_tris(body)
    sh_z, armw = shoulder_z(), arm_weights(body)
    out = {}
    cache = {}
    for ps in sets:
        name = ps.get("k", str(len(out)))
        P = full_params({k: v for k, v in ps.items() if k != "k"})
        mk = (int(P["mask_smooth"]), float(P["h0_frac"]))
        if mk not in cache:
            co, frames = bust_frames(body, P)
            cache[mk] = (frames, mound_volume(co, tris, frames)[0])
        frames, V0 = cache[mk]
        fills = {s: fill_disp(base, F, P, sh_z, armw) for s, F in frames.items()}
        k, ratio = solve_k(base, tris, frames, V0, P, fills)
        nb = body_new(base, frames, k, P, fills)
        summ = profile_summary(side_profile(body, nb))
        d = __import__("numpy").linalg.norm(nb - base, axis=1)
        out[name] = {"params": {k2: v for k2, v in P.items()}, "k": round(k, 5), "ratio": round(ratio, 4),
                     "max_move_mm": round(float(d.max()) * 1000, 1), "profile": summ}
        print("SWEEP", name, json.dumps({k2: summ[k2] for k2 in ("shelf_px", "fold_px", "lower_step_px", "upper_rows",
                                                              "lower_rows", "flat_rows", "apex_below_sh_px",
                                                              "apex_frac_upperarm", "side_projection_px")}),
              "k", round(k, 4), flush=True)
    return out


# ---------------------------------------------------------------------------- render + checks
def clip_check(sc):
    """posed state: every non-body vertex within 25 cm of either bust tip that sits BEHIND the
    body's surface (signed distance along the nearest surface normal < -0.5 mm, within 3 cm)
    counts as clipping; also garments on the chest closer than 1.5 mm to the skin (they alias
    into skin pixels at 144). Returns per-object counts."""
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    body = bpy.data.objects["body"]
    bvh = BVHTree.FromObject(body, dg)
    arm = bpy.data.objects["rosace_rig"]
    pb = arm.pose.bones
    tips = [arm.matrix_world @ pb[f"J_Sec_{s}_Bust1"].tail for s in "LR"]
    out = {}
    for ob in sc.objects:
        if ob.type != "MESH" or ob.name in SKIP or ob.hide_render or ob.name.startswith("glaive"):
            continue
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        inside = close = 0
        for v in me.vertices:
            p = ob.matrix_world @ v.co
            if min((p - t).length for t in tips) > 0.25:
                continue
            q, nrm, _, d = bvh.find_nearest(p, 0.03)
            if q is None:
                continue
            sd = (p - q).dot(nrm)
            if sd < -0.0005:
                inside += 1
            elif sd < 0.0015:
                close += 1
        ev.to_mesh_clear()
        if inside or close:
            out[ob.name] = {"inside": inside, "close": close}
    return out


def render_views(blend, out, views, pxs, hi, pose, variant=None):
    import bpy
    from mathutils import Vector
    sys.path.insert(0, PIPE)
    from rosace import materials, posing, render
    bpy.ops.wm.open_mainfile(filepath=blend)
    if variant:
        select(variant)                       # a bundle file: pick the variant first
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    pose_path = pose if os.path.isabs(pose) else os.path.join(REPO, "art", "rosace", "poses", pose + ".json")
    meta_p = posing.apply_pose_file(pose_path)
    bpy.context.view_layer.update()
    import hashlib
    sha = hashlib.sha1(open(pose_path, "rb").read()).hexdigest()[:12]
    # the chest's facing in the pose: views named '@left' / '@back' / '@front' / '@q34' take their
    # yaw from it, so 'side' is a true profile of the ribcage, not of the rest frame
    arm = bpy.data.objects["rosace_rig"]
    uc = arm.pose.bones["J_Bip_C_UpperChest"]
    f = (arm.matrix_world @ uc.matrix).to_3x3() @ uc.bone.matrix_local.to_3x3().inverted() @ Vector((0, -1, 0))
    chest_yaw = math.degrees(math.atan2(-f.x, -f.y))      # yaw of a camera straight in front of the chest
    rel = {"@front": 0.0, "@q34": 35.0, "@left": -90.0, "@right": 90.0, "@back": 180.0}
    views = [(nm, (chest_yaw + rel[y]) if isinstance(y, str) else y, e) for nm, y, e in views]
    report = {"blend": blend, "pose": pose_path, "clip": clip_check(sc), "views": {},
              "chest_yaw": round(chest_yaw, 2), "yaws": {nm: round(y, 2) for nm, y, _ in views}}
    for vname, yaw, elev in views:
        for px, ss, passes in [(p, 4, ["beauty", "albedo", "id", "normal", "depth"]) for p in pxs] + \
                              ([(hi, 1, ["beauty"])] if hi else []):
            shot = render.setup_shot(sc, px, yaw=yaw, elev=elev, ss=ss)
            d = os.path.join(out, vname, f"px{px}")
            render.render_passes(sc, d, passes)
            anchors = posing.anchors(sc, px)
            render.write_meta(os.path.join(d, "meta.json"), shot,
                              {"pose": meta_p.get("name"), "expression": meta_p.get("expression"),
                               "pose_sha1": sha, "passes": passes, "anchors": anchors, "frames": None,
                               "thong": None})
            report["views"].setdefault(vname, {})[str(px)] = shot["canvas"]
            print("RENDERED", d, shot["canvas"], flush=True)
    with open(os.path.join(out, "_render.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=1)


def blender_main(argv):
    import bpy
    sys.path.insert(0, PIPE)
    from rosace import common
    cmd = argv[0]
    if cmd == "build":
        var = common.arg(argv, "--variant", None) or current_variant()
        src = os.path.abspath(common.arg(argv, "--src", os.path.join(BUILD, "rosace.blend")))
        out = os.path.abspath(common.arg(argv, "--out", os.path.join(BUILD, "lanes", f"figure-pose-shape_{var}.blend")))
        assert os.path.basename(out) not in FORBIDDEN, f"the figure-pose lane never writes {os.path.basename(out)}"
        assert os.path.basename(out).startswith("figure-pose"), "lane builds are lanes/figure-pose*.blend"
        assert out != src
        bpy.ops.wm.open_mainfile(filepath=src)
        params = variant_params(var)
        rep = apply(params, var)
        rep["src"] = src
        bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
        with open(os.path.splitext(out)[0] + "_build.json", "w", encoding="utf-8") as f:
            json.dump(rep, f, indent=1)
        print("FIGURE_SHAPE", json.dumps({k: rep[k] for k in ("variant", "k", "volume_ratio_solved", "grid_ratio", "profile")}))
    elif cmd == "bundle":
        # every variant as keys in one lane file (default lanes/figure-pose-shape.blend), S0 selected
        vs = common.arg(argv, "--variants", ",".join(load_shape()["variants"])).split(",")
        src = os.path.abspath(common.arg(argv, "--src", os.path.join(BUILD, "rosace.blend")))
        out = os.path.abspath(common.arg(argv, "--out", os.path.join(BUILD, "lanes", "figure-pose-shape.blend")))
        assert os.path.basename(out) not in FORBIDDEN and os.path.basename(out).startswith("figure-pose") and out != src
        bpy.ops.wm.open_mainfile(filepath=src)
        reps = bundle(vs)
        sel = common.arg(argv, "--select", None) or (current_variant() if current_variant() in vs else "S0")
        select(sel)
        bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
        for r in reps.values():
            r.pop("frames", None)
        with open(os.path.splitext(out)[0] + "_build.json", "w", encoding="utf-8") as f:
            json.dump({"src": src, "variants": vs, "selected": sel, "builds": reps}, f, indent=1)
        print("FIGURE_SHAPE_BUNDLE", out, {v: r["k"] for v, r in reps.items()})
    elif cmd == "select":
        # switch a bundle file to one variant and save it (lane files only)
        blend = os.path.abspath(common.arg(argv, "--blend"))
        assert os.path.basename(blend) not in FORBIDDEN and os.path.basename(blend).startswith("figure-pose")
        bpy.ops.wm.open_mainfile(filepath=blend)
        select(common.arg(argv, "--variant"))
        out = os.path.abspath(common.arg(argv, "--out", blend))
        assert os.path.basename(out) not in FORBIDDEN and os.path.basename(out).startswith("figure-pose")
        bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
        print("SELECTED", common.arg(argv, "--variant"), out)
    elif cmd == "sweep":
        src = os.path.abspath(common.arg(argv, "--src", os.path.join(BUILD, "rosace.blend")))
        bpy.ops.wm.open_mainfile(filepath=src)
        sets = json.loads(common.arg(argv, "--params"))
        res = sweep(sets)
        with open(os.path.abspath(common.arg(argv, "--out")), "w", encoding="utf-8") as f:
            json.dump({"src": src, "sets": res}, f, indent=1)
    elif cmd == "measure":
        # rest-pose measures of the body's figure_bust key (or the mesh, if there is no key)
        res = {}
        for blend in common.arg(argv, "--blends").split(","):
            bpy.ops.wm.open_mainfile(filepath=os.path.abspath(blend))
            body = bpy.data.objects["body"]
            sk = body.data.shape_keys
            co = None
            if sk and KEY in sk.key_blocks:
                np = _np()
                co = np.empty(len(body.data.vertices) * 3)
                sk.key_blocks[KEY].data.foreach_get("co", co)
                co = co.reshape(-1, 3)
            res[os.path.basename(blend)] = measure_rest(body, co, bpy.data.objects["rosace_rig"]["rosace_height"])
            res[os.path.basename(blend)]["profile"] = profile_summary(side_profile(body, co))
        out = os.path.abspath(common.arg(argv, "--out"))
        with open(out, "w", encoding="utf-8") as f:
            json.dump(res, f, indent=1)
        print("MEASURED", json.dumps(res))
    elif cmd == "render":
        blend = os.path.abspath(common.arg(argv, "--blend"))
        out = os.path.abspath(common.arg(argv, "--out"))
        vs = []
        for tok in common.arg(argv, "--views", "q34:30,side:-90,back:180").split(","):
            nm, yaw = tok.split(":")[:2]
            elev = float(tok.split(":")[2]) if tok.count(":") > 1 else 8.0
            vs.append((nm, yaw if yaw.startswith("@") else float(yaw), elev))
        pxs = [int(x) for x in common.arg(argv, "--px", "144,80").split(",")]
        render_views(blend, out, vs, pxs, common.arg(argv, "--hi", 480, int), common.arg(argv, "--pose", "idle_hero"),
                     common.arg(argv, "--variant", None))
    else:
        raise SystemExit(f"unknown command {cmd}")


# ============================================================================ plain python
def post_all(root):
    import subprocess
    for dp, dn, fn in os.walk(root):
        if "meta.json" in fn and "id.png" in fn:
            r = subprocess.run([sys.executable, os.path.join(PIPE, "rosace_post.py"), "--raw", dp, "--tag", "still"],
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            if r.returncode:
                print(r.stdout[-2000:], r.stderr[-2000:])
                raise SystemExit(f"post failed in {dp}")
            print("post", dp)


# ---------------------------------------------------------------------------- measures + sheets
REF_DIR = os.path.join(REPO, "review", "refs", "character", "native")
# finish-bar refs at their native grid (crop boxes on the native files; third-party: review/ only)
REFS = [("ref 07", "07-anim-amberowl-wrench_top_native-p2.png", (55, 20, 175, 195)),
        ("ref 09", "09-anim-amberowl-katana-cats_1x.png", (60, 44, 225, 212)),
        ("ref 04a", "04-style-grid9_native-p2.158.png", (140, 178, 222, 340)),
        ("ref 04b", "04-style-grid9_native-p2.158.png", (222, 178, 318, 340))]
SEED = 20260929                       # PIPELINE 5.2's fixed shuffle seed
BGC = (104, 102, 98, 255)
TORSO_PARTS = ("body", "bodice", "collar_cross", "collar_plate", "gold_harness", "collar")


def _still(root, v, view, px):
    from PIL import Image
    d = os.path.join(root, v, view, f"px{px}")
    meta = json.load(open(os.path.join(d, "meta.json"), encoding="utf-8"))
    return (Image.open(os.path.join(d, "still.png")).convert("RGBA"), tuple(meta["anchor"]),
            Image.open(os.path.join(d, "still_id.png")).convert("RGBA"), meta)


def measure(root, v, view, px):
    """side view: how far the bust stands out of the torso's front line (apex minus the deepest
    point of the front contour in the 0.14 H below it), in px. Every view: small skin islands
    (<= 3 px) wholly inside the bodice, the pixel trace of skin poking through cloth."""
    np = _np()
    img, anc, idim, meta = _still(root, v, view, px)
    ida = np.asarray(idim)
    part = ida[..., 1]
    alpha = ida[..., 3] > 0
    P = meta["parts"]
    torso = alpha & np.isin(part, [P[n] for n in TORSO_PARTS if n in P])
    out = {}
    if view == "side":
        H = px
        rows = range(max(0, anc[1] - int(0.80 * H)), anc[1] - int(0.55 * H))
        front = {r: int(np.nonzero(torso[r])[0].min()) for r in rows if torso[r].any()}
        if front:
            r_apex = min(front, key=lambda r: (front[r], r))
            below = [r for r in front if r_apex < r <= r_apex + int(0.14 * H)]
            r_under = max(below, key=lambda r: front[r]) if below else r_apex
            out.update({"bust_out_px": front[r_under] - front[r_apex], "apex_row_above_ground": anc[1] - r_apex})
    # skin islands inside the bodice
    from collections import deque
    skin = alpha & (part == P["body"])
    bod = alpha & (part == P["bodice"])
    seen = np.zeros_like(skin)
    isl = 0
    Hh, Ww = skin.shape
    for y, x in zip(*np.nonzero(skin)):
        if seen[y, x]:
            continue
        q, comp, border = deque([(y, x)]), [], set()
        seen[y, x] = True
        while q:
            cy, cx = q.popleft()
            comp.append((cy, cx))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if not (0 <= ny < Hh and 0 <= nx < Ww):
                    border.add("edge")
                    continue
                if skin[ny, nx]:
                    if not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
                else:
                    border.add("bodice" if bod[ny, nx] else "other")
        if len(comp) <= 3 and border == {"bodice"}:
            isl += 1
    out["skin_islands_in_bodice"] = isl
    out["colours"] = len({tuple(c) for c in np.asarray(img)[alpha][:, :3].tolist()})
    return out


def _font(n):
    from PIL import ImageFont
    try:
        return ImageFont.load_default(size=n)
    except TypeError:
        return ImageFont.load_default()


def _on_ground(items, margin=3):
    from PIL import Image
    L = max(a[0] for _, a in items)
    T = max(a[1] for _, a in items)
    R = max(im.width - a[0] for im, a in items)
    B = max(im.height - a[1] for im, a in items)
    out = []
    for im, a in items:
        c = Image.new("RGBA", (L + R, T + B), (0, 0, 0, 0))
        c.alpha_composite(im, (L - a[0], T - a[1]))
        out.append(c)
    box = None
    for c in out:
        b = c.getchannel("A").getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    box = (max(0, box[0] - margin), max(0, box[1] - margin), min(L + R, box[2] + margin), min(T + B, box[3] + margin))
    return [c.crop(box) for c in out]


def _silhouette(im):
    from PIL import Image
    a = im.getchannel("A").point(lambda x: 255 if x > 0 else 0)
    s = Image.new("RGBA", im.size, (0, 0, 0, 0))
    s.paste(Image.new("RGBA", im.size, (18, 16, 22, 255)), (0, 0), a)
    return s


def _sheet(title, sub, panels, zoom, bottom_align=True):
    """panels: [(label, RGBA or RGB image)], one integer zoom, one background, bottoms aligned"""
    from PIL import Image, ImageDraw
    gap, lab, pad = 18, 28, 14
    H = max(im.height for _, im in panels) * zoom
    W = pad * 2 + sum(im.width * zoom for _, im in panels) + gap * (len(panels) - 1)
    hdr = 56 if zoom > 1 else 44
    S = Image.new("RGB", (max(W, 520 if zoom > 1 else 360), hdr + lab + H + pad), (24, 22, 30))
    d = ImageDraw.Draw(S)
    d.text((pad, 6), title, fill=(232, 228, 220), font=_font(20 if zoom > 1 else 13))
    d.text((pad, 30 if zoom > 1 else 24), sub, fill=(190, 184, 170), font=_font(14 if zoom > 1 else 10))
    x = pad
    for l, im in panels:
        t = im
        if t.mode == "RGBA":
            c = Image.new("RGBA", t.size, BGC)
            c.alpha_composite(t)
            t = c
        t = t.convert("RGB").resize((t.width * zoom, t.height * zoom), Image.NEAREST)
        y = hdr + lab + (H - t.height if bottom_align else 0)
        S.paste(t, (x, y))
        d.text((x, hdr + 2), l, fill=(232, 228, 220), font=_font(20 if zoom > 1 else 11))
        x += t.width + gap
    return S


def build_sheets(root, out, seed=None):
    import random
    from PIL import Image
    os.makedirs(out, exist_ok=True)
    variants = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)) and d[0] == "S")
    rnd = random.Random(SEED if seed is None else seed)
    order = variants[:]
    rnd.shuffle(order)
    letters = {chr(65 + i): v for i, v in enumerate(order)}
    refs = [(n, Image.open(os.path.join(REF_DIR, f)).convert("RGB").crop(b)) for n, f, b in REFS]
    shape = load_shape()
    measures = {}
    views = [("q34", "idle_hero camera (yaw 30)"), ("side", "true side (chest yaw -90)"),
             ("back", "back (chest yaw 180)")]
    made = []
    for view, vdesc in views:
        for px in (144, 80):
            items = [_still(root, letters[L], view, px)[:2] for L in letters]
            ims = _on_ground(items)
            for L, v in letters.items():
                measures.setdefault(v, {})[f"{view}_{px}"] = measure(root, v, view, px)
            for z in (3, 1):
                sub = (f"{px} px render, native grid, x{z}. Letters are shuffled variants (key.json: do not open "
                       f"before your verdict). Refs at their own native grid.")
                pan = [(L, im) for L, im in zip(letters, ims)] + (refs if view != "back" else refs[:2])
                S = _sheet(f"Bust shape study - idle_hero, {vdesc}, {px} px", sub, pan, z)
                fn = f"{view}_{px}_x{z}.png"
                S.save(os.path.join(out, fn))
                made.append(fn)
                sil = [(L, _silhouette(im)) for L, im in zip(letters, ims)]
                S = _sheet(f"Silhouettes - idle_hero, {vdesc}, {px} px", f"black fill of each render, x{z}", sil, z)
                fn = f"{view}_{px}_sil_x{z}.png"
                S.save(os.path.join(out, fn))
                made.append(fn)
    # overview: every letter in all three views, per size, x3 and x1
    for px in (144, 80):
        for z in (3, 1):
            pan = []
            for view, _ in views:
                items = [_still(root, letters[L], view, px)[:2] for L in letters]
                for L, im in zip(letters, _on_ground(items)):
                    pan.append((L, view, im))
            from PIL import ImageDraw
            rows = []
            for L in letters:
                row = [(f"{L} {vw}", im) for l2, vw, im in pan if l2 == L]
                rows.append(_sheet(f"{L}", "", row, z))
            W = max(r.width for r in rows)
            S = Image.new("RGB", (W, sum(r.height for r in rows)), (24, 22, 30))
            y = 0
            for r in rows:
                S.paste(r, (0, y))
                y += r.height
            ImageDraw.Draw(S)
            fn = f"overview_{px}_x{z}.png"
            S.save(os.path.join(out, fn))
            made.append(fn)
    key = {"seed": SEED if seed is None else seed, "letters": letters,
           "variants": {v: shape["variants"].get(v) for v in variants},
           "builds": {v: json.load(open(os.path.join(BUILD, "lanes", f"figure-pose-shape_{v}_build.json"),
                                        encoding="utf-8"))
                      for v in variants if os.path.exists(os.path.join(BUILD, "lanes", f"figure-pose-shape_{v}_build.json"))},
           "renders": {v: json.load(open(os.path.join(root, v, "_render.json"), encoding="utf-8")) for v in variants},
           "measures": measures, "sheets": made,
           "refs": [{"name": n, "file": f, "box": b} for n, f, b in REFS]}
    for v in key["builds"].values():
        v.pop("frames", None)
    with open(os.path.join(out, "key.json"), "w", encoding="utf-8") as f:
        json.dump(key, f, indent=1, ensure_ascii=False)
    print("sheets:", len(made), "->", out)


def main_plain(argv):
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["post", "sheets"])
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", default=os.path.join(REPO, "review", "rosace", "art", "figure-pose", "shape"))
    ap.add_argument("--seed", type=int, default=None)
    a = ap.parse_args(argv)
    if a.cmd == "post":
        post_all(a.root)
    else:
        build_sheets(a.root, a.out, a.seed)


if __name__ == "__main__":
    try:
        import bpy  # noqa: F401
        IN_BLENDER = True
    except ImportError:
        IN_BLENDER = False
    if IN_BLENDER:
        a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
        blender_main(a)
    else:
        main_plain(sys.argv[1:])
