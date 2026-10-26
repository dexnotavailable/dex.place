"""Hair (authored clump geometry), veil and the gold rose pin.

Design (DESIGN.md section 6): long indigo hime cut. Straight bangs in 3 clumps, face-framing
sidelocks to the collarbone held by gold cross clasps, back hair in big clumps that gather
at a loose gold ring above the seat and continue as one ribbon to mid-thigh, tips shifting
to azure. Every clump is a lens-section tube along a smoothed centreline that is pushed off
the body surface (no helmet: the cap only fills the scalp between clump roots).
Secondary motion: chains hair_back (mantle -> tail), side_L / side_R, veil.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from . import rig
from .common import gauss, lerp, smoothstep
from .geo import bm_to_object, catmull, chain_weights, object_bvh, set_weights, tube, vgroup_weights

V = Vector


# ---------------------------------------------------------------------------- metrics
def head_metrics(arm, body, face):
    ws = vgroup_weights(body)
    pts = [v.co.copy() for v in face.data.vertices]
    head_bones = {b.name for b in arm.data.bones if b.name == "J_Bip_C_Head" or
                  (b.parent and b.parent.name == "J_Bip_C_Head")}
    for v, w in zip(body.data.vertices, ws):
        if sum(w.get(n, 0) for n in head_bones) > 0.6:
            pts.append(v.co.copy())
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    top = max(zs)
    B = arm.data.bones
    eye = (B["J_Adj_L_FaceEye"].head_local.copy() + B["J_Adj_R_FaceEye"].head_local) / 2
    chin = min(p.z for p in face.data.vertices for p in [p.co] if abs(p.x) < 0.02)
    # skull ellipsoid: fit to the cranium (above the eyes)
    cran = [p for p in pts if p.z > eye.z]
    cx = 0.0
    cy = (max(p.y for p in cran) + min(p.y for p in cran)) / 2
    rx = max(abs(p.x) for p in cran)
    ry = (max(p.y for p in cran) - min(p.y for p in cran)) / 2
    cz = eye.z + 0.01
    rz = top - cz
    forehead_y = min(p.y for p in pts if eye.z + 0.02 < p.z < eye.z + 0.06 and abs(p.x) < 0.03)
    m = {
        "C": V((cx, cy, cz)), "R": V((rx, ry, rz)), "top": top, "eye": eye, "chin": chin,
        "forehead_y": forehead_y,
        "neck": B["J_Bip_C_Neck"].head_local.copy(),
        "shoulder_z": B["J_Bip_L_UpperArm"].head_local.z,
        "chest": B["J_Bip_C_UpperChest"].head_local.copy(),
        "hips": B["J_Bip_C_Hips"].head_local.copy(),
        "knee_z": B["J_Bip_L_LowerLeg"].head_local.z,
        "hip_joint_z": B["J_Bip_L_UpperLeg"].head_local.z,
    }
    return m


def E(M, az, el, k=1.0, dz=0.0):
    """point on the skull ellipsoid: az 0 = front (-Y), 90 = her left (+X), 180 = back."""
    a, e = math.radians(az), math.radians(el)
    C, R = M["C"], M["R"]
    return V((C.x + math.sin(a) * math.cos(e) * R.x * k,
              C.y - math.cos(a) * math.cos(e) * R.y * k,
              C.z + math.sin(e) * R.z * k + dz))


class Surface:
    """Pushes points off the body so hair and cloth never sink into it."""

    def __init__(self, obs):
        self.bvh, _ = object_bvh(obs)

    def push(self, p, clearance):
        q, n, _, d = self.bvh.find_nearest(p)
        if q is None:
            return p
        off = (p - q)
        if off.dot(n) < clearance:
            return q + n * clearance
        return p

    def push_line(self, pts, clear, iters=4):
        pts = [V(p) for p in pts]
        for _ in range(iters):
            pts = [self.push(p, c) for p, c in zip(pts, clear)]
            sm = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]
            pts = sm
        return [self.push(p, c) for p, c in zip(pts, clear)]


def core_point(M, p):
    """axis the hair's thickness direction points away from"""
    C = M["C"]
    if p.z >= C.z - 0.02:
        return V((0.0, C.y, min(p.z, C.z)))
    # below the head: along the spine, a bit in front of the back
    return V((0.0, lerp(C.y, M["hips"].y, smoothstep(C.z, M["hips"].z, p.z)), p.z))


def lens_clump(bm, pts, half_w, half_t, M, out_override=None, nseg=8, flat_side=None):
    """lens-section tube along pts. half_w/half_t: per-point lists. Thickness points outward
    from core_point(); width is perpendicular. Returns (rings, params 0..1)."""
    n = len(pts)
    outs = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        o = V(out_override[i]) if out_override else (p - core_point(M, p))
        o = (o - t * o.dot(t))
        if o.length < 1e-6:
            o = V((0, 1, 0)) - t * t.y
        outs.append(o.normalized())
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        o = outs[i]
        s = t.cross(o).normalized()
        ring = []
        for k in range(nseg):
            a = 2 * math.pi * k / nseg
            ca, sa = math.cos(a), math.sin(a)
            # lens: thickness shrinks toward the edges, slightly flatter underside
            th = half_t[i] * (1.0 if sa > 0 else 0.7)
            ring.append(bm.verts.new(p + s * ca * half_w[i] + o * sa * th * (0.25 + 0.75 * abs(sa)) ** 0.5))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(nseg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % nseg], rings[i + 1][(k + 1) % nseg], rings[i + 1][k]))
    # caps
    c0 = bm.verts.new(pts[0])
    for k in range(nseg):
        bm.faces.new((rings[0][(k + 1) % nseg], rings[0][k], c0))
    tip = pts[-1] + (pts[-1] - pts[-2]).normalized() * 0.004
    c1 = bm.verts.new(tip)
    for k in range(nseg):
        bm.faces.new((rings[-1][k], rings[-1][(k + 1) % nseg], c1))
    return rings


def taper(n, w0, w_mid=None, tip=0.0, peak=0.3, tip_len=0.25, root=0.8):
    """width profile: root -> peak -> taper to tip over the last tip_len"""
    w_mid = w_mid or w0
    out = []
    for i in range(n):
        t = i / (n - 1)
        if t < peak:
            w = lerp(w0 * root, w_mid, smoothstep(0, peak, t))
        elif t < 1 - tip_len:
            w = w_mid
        else:
            u = (t - (1 - tip_len)) / tip_len
            w = lerp(w_mid, tip, u ** 0.8)
        out.append(max(w, 0.0008))
    return out


# ---------------------------------------------------------------------------- build
def build(arm, face):
    body = bpy.data.objects["body"]
    M = head_metrics(arm, body, face)
    arm["head_metrics"] = {k: (list(v) if hasattr(v, "__len__") else v) for k, v in M.items()}
    surf = Surface([body, face])
    C, R = M["C"], M["R"]
    head_bone = "J_Bip_C_Head"
    objs = {}

    # ---- chains
    hips = M["hips"]
    gather_z = hips.z + 0.02
    tail_end_z = lerp(M["hip_joint_z"], M["knee_z"], 0.45)     # mid-thigh
    def back_surface_y(z, x=0.0):
        hit = surf.bvh.ray_cast(V((x, 0.6, z)), V((0, -1, 0)), 1.0)
        return hit[0].y if hit[0] is not None else 0.1

    nape = E(M, 180, -40, 1.02)
    blade_z = M["chest"].z
    back_chain = [nape,
                  V((0, back_surface_y(blade_z) + 0.05, blade_z)),
                  V((0, back_surface_y(hips.z + 0.18) + 0.07, hips.z + 0.18)),
                  V((0, back_surface_y(gather_z) + 0.075, gather_z))]
    seat_z = lerp(gather_z, tail_end_z, 0.35)
    seat_y = max(back_surface_y(seat_z, 0.06), back_surface_y(seat_z, 0.0)) + 0.055
    tail_chain = [back_chain[-1], V((0, seat_y, seat_z)),
                  V((0, seat_y - 0.005, lerp(gather_z, tail_end_z, 0.7))), V((0, seat_y - 0.02, tail_end_z))]
    # the long hair hangs from the neck: an over-the-shoulder head turn must not swing the
    # whole mantle round her side (the scalp part above the nape still follows the head)
    b_back = rig.add_chain(arm, "hair_back", back_chain, "J_Bip_C_Neck")
    b_tail = rig.add_chain(arm, "hair_tail", tail_chain, b_back[-1])
    chain_pts = back_chain + tail_chain[1:]
    chain_bones = b_back + b_tail

    # ---- cap: ellipsoid shrunk onto the skull, face region removed
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=28, radius=1.0)
    kill = []
    for v in bm.verts:
        d = v.co.copy()
        az = math.degrees(math.atan2(d.x, -d.y))
        el = math.degrees(math.asin(max(-1, min(1, d.z))))
        p = E(M, az, el, 1.3)
        q, n, _, _ = surf.bvh.find_nearest(p)
        v.co = q + n * 0.010 if q is not None else p
        front = abs(az) < 70
        side = 70 <= abs(az) < 115
        if (front and el < 38) or (side and el < 5) or (not front and not side and el < -48):
            kill.append(v)
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    cap = bm_to_object("hair_cap", bm, ["hair"], arm=arm, part="hair")
    cap["ao_dist"], cap["ao_strength"] = 0.025, 0.35
    set_weights(cap, [{head_bone: 1.0} for _ in cap.data.vertices])
    objs["cap"] = cap

    bm = bmesh.new()
    tip_verts = []
    groups = []       # (first vert, end vert, group name)

    def add_clump(pts_ctrl, n, wprof, tprof, clear=0.012, push=True, tipmat=False, out=None, group="head"):
        pts = catmull(pts_ctrl, n)
        if push:
            clearance = [clear + tprof[i] * 0.8 for i in range(n)]
            pts = surf.push_line(pts, clearance)
        v0 = len(bm.verts)
        rings = lens_clump(bm, pts, wprof, tprof, M, out_override=out)
        groups.append((v0, len(bm.verts), group))
        if tipmat:
            L = len(rings)
            for i, ring in enumerate(rings):
                if i / (L - 1) > 0.72:      # azure tips (DESIGN 6); 0.80 in round 1 never showed
                    tip_verts.extend(ring)
            tip_verts.append(list(bm.verts)[-1])
        return pts

    # ---- bangs (round 2 face critic: "a flat curtain cut straight at brow level"): five
    # pointed clumps with uneven tips, the centre one dropping to the lash line, gaps between
    # the tips so the brows read through them; DESIGN 6 "5-7 big clumps, tips taper to 1 px"
    brow_z = M["eye"].z + 0.056
    fy = M["forehead_y"]
    # (azimuth, width, tip drop below brow_z, tip x pull toward the centre)
    # five wide clumps (seven thin ones lost their tips to the pixel grid at 144): tip drops
    # alternate so the V gaps between tips are ~4 px deep at 144
    for az, wz, dz, pull in ((-40, 0.036, 0.040, 0.35), (-20, 0.036, 0.008, 0.15), (0, 0.036, 0.058, 0.0),
                             (20, 0.036, 0.014, 0.15), (40, 0.036, 0.046, 0.35)):
        root = E(M, az * 0.3, 62, 1.02)
        mid = E(M, az * 0.85, 34, 1.10)
        front = E(M, az * 1.0, 16, 1.15)
        tip = V((front.x * (0.95 - 0.12 * pull), fy - 0.016, brow_z - dz))
        n = 16
        # long taper (60% of the clump) so neighbouring tips separate into V gaps 3-4 px deep
        add_clump([root, mid, front, tip], n, taper(n, wz, wz * 1.1, 0.004, 0.25, 0.6),
                  taper(n, 0.010, 0.012, 0.002, 0.25, 0.5), clear=0.006)
    # side fillers: the near one (her right, -X) is a long lock that crosses the cheek
    for s, drop in ((-1, 0.075), (1, 0.035)):
        root = E(M, s * 44, 55, 1.03)
        mid = E(M, s * 64, 18, 1.12)
        tip = E(M, s * 66, -22, 1.12, dz=-drop + 0.02)
        tip = V((tip.x * 0.92, min(tip.y, fy + 0.005), tip.z))
        n = 14
        add_clump([root, mid, tip], n, taper(n, 0.026, 0.030, 0.0, 0.3, 0.45),
                  taper(n, 0.010, 0.011, 0.002), clear=0.006)
    # ahoge: one thin strand rising off the crown and curling forward (silhouette break)
    top = V((C.x + 0.004, C.y - R.y * 0.25, C.z + R.z * 1.02))
    add_clump([top, top + V((0.006, 0.004, 0.040)), top + V((0.030, -0.012, 0.068)),
               top + V((0.058, -0.028, 0.052))], 12, taper(12, 0.010, 0.009, 0.0, 0.2, 0.5),
              taper(12, 0.004, 0.004, 0.001), push=False)
    # stray strands off the sides of the crown, breaking the dome outline
    for s, az, el in ((1, 104, 30), (-1, -112, 18)):
        r0 = E(M, az, el, 1.08)
        r1 = E(M, az + s * 8, el - 18, 1.24)
        r2 = E(M, az + s * 14, el - 40, 1.32)
        add_clump([r0, r1, r2], 10, taper(10, 0.012, 0.011, 0.0, 0.2, 0.5), taper(10, 0.005, 0.005, 0.001),
                  push=False)

    # ---- sidelocks (hime): temple -> collarbone, blunt, framing the face
    side_pts = {}
    for s, sd in ((1, "L"), (-1, "R")):
        # round 2: S-flow that tapers to a pointed tip flicking out below the shoulders
        # (critic: "parallel vertical stripes with square, hidden ends")
        root = E(M, s * 78, 30, 1.04)
        temple = E(M, s * 86, -8, 1.14)
        cheek = V((s * R.x * 1.10, C.y - R.y * 0.22, M["chin"] + 0.01))
        low = V((s * R.x * 1.02, C.y - R.y * 0.30, M["chin"] - 0.12))
        end = V((s * R.x * 1.30, C.y - R.y * 0.22, M["chin"] - 0.215))
        n = 18
        pts = add_clump([root, temple, cheek, low, end], n,
                        taper(n, 0.022, 0.030, 0.0, 0.25, 0.30),
                        taper(n, 0.010, 0.013, 0.002, 0.25, 0.25), clear=0.010, tipmat=True,
                        group="side_" + sd)
        side_pts[sd] = pts
    # side chains (from temple down)
    for sd in "LR":
        pts = side_pts[sd]
        chain = [pts[5], pts[9], pts[13], pts[-1]]
        rig.add_chain(arm, f"side_{sd}", chain, head_bone)

    # ---- back mantle: clumps from the crown converging to the gather ring
    G = tail_chain[0]
    mantle = [(95, 0.034), (118, 0.040), (142, 0.044), (165, 0.046), (180, 0.046), (195, 0.046),
              (218, 0.044), (242, 0.040), (265, 0.034)]
    for az, w in mantle:
        s = math.sin(math.radians(az))
        root = E(M, 180 + (az - 180) * 0.35, 74, 1.0)
        crown = E(M, az, 35, 1.10)
        ear = E(M, az, -20, 1.14)
        nk = E(M, 180 + (az - 180) * 0.75, -62, 1.12)
        spread = s * 0.13
        blade = V((spread, back_surface_y(blade_z, spread) + 0.035, blade_z))
        low = V((spread * 0.55, back_surface_y(hips.z + 0.12, spread * 0.55) + 0.05, hips.z + 0.12))
        g = V((G.x + s * 0.018, G.y + 0.004, G.z))
        n = 26
        add_clump([root, crown, ear, nk, blade, low, g], n,
                  taper(n, w * 0.7, w, w * 0.45, 0.18, 0.12, root=1.0),
                  taper(n, 0.012, 0.015, 0.010, 0.2, 0.2), clear=0.012, group="mantle")
    # ---- tail: three clumps side by side as one ribbon, fanning at the tips
    for dx, w, dl in ((-0.022, 0.024, 0.0), (0.0, 0.028, 0.03), (0.022, 0.024, -0.01)):
        pts_c = [V((G.x + dx * 0.5, G.y, G.z - 0.01))] + [V((p.x + dx * (0.6 + 0.8 * i / 3), p.y, p.z)) for i, p in enumerate(tail_chain[1:])]
        pts_c[-1] = pts_c[-1] + V((dx * 0.8, -0.005, -dl))
        n = 22
        add_clump(pts_c, n, taper(n, w * 0.9, w, 0.0, 0.2, 0.3, root=1.0),
                  taper(n, 0.011, 0.013, 0.002, 0.2, 0.3), clear=0.015, tipmat=True, group="tail")
    bm.verts.index_update()
    tipset = {v.index for v in tip_verts}
    clumps = bm_to_object("hair_clumps", bm, ["hair", "hairtip"], arm=arm, part="hair")
    clumps["ao_dist"], clumps["ao_strength"] = 0.025, 0.4
    me = clumps.data
    for p in me.polygons:
        if sum(1 for vi in p.vertices if vi in tipset) >= 3:
            p.material_index = 1
    # weights by clump group: bangs on the head, sidelocks on their chains, the mantle
    # blends from the head into the back chain below the nape, the tail on its chain
    grp = [None] * len(me.vertices)
    for v0, v1, g in groups:
        for i in range(v0, v1):
            grp[i] = g
    side_chains = {sd: rig.CHAINS[f"side_{sd}"] for sd in "LR"}
    per = []
    for v in me.vertices:
        p, g = v.co, grp[v.index]
        if g and g.startswith("side_"):
            sd = g[-1]
            sp = side_pts[sd]
            per.append(chain_weights(p, [sp[5], sp[9], sp[13], sp[-1]], side_chains[sd], head_bone, 0.35))
        elif g in ("mantle", "tail"):
            if p.z > nape.z + 0.01:
                per.append({head_bone: 1.0})
            else:
                per.append(chain_weights(p, chain_pts, chain_bones, head_bone, 0.3))
        else:
            per.append({head_bone: 1.0})
    set_weights(clumps, per)
    # one object per clump so each clump has its own part id: the post-process draws the
    # clump separation lines (one step darker than the shadow) where clumps overlap
    bpy.ops.object.select_all(action="DESELECT")
    clumps.select_set(True)
    bpy.context.view_layer.objects.active = clumps
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    pieces = [o for o in bpy.context.selected_objects if o.name.startswith("hair_clumps")]
    pieces.sort(key=lambda o: (-round(max(v.co.z for v in o.data.vertices), 3), round(sum(v.co.x for v in o.data.vertices), 2)))
    from .geo import set_part
    for i, o in enumerate(pieces):
        o.name = f"hair_clump_{i:02d}"
        o.data.name = o.name
        set_part(o, f"hair_{i:02d}")
        o["ao_dist"], o["ao_strength"] = 0.025, 0.4
    objs["clumps"] = pieces
    for o in pieces + [cap]:
        proxy_normals(o, M)

    # ---- gold ring at the gather, clasps on the sidelocks
    bm = bmesh.new()
    rpts = []
    for i in range(3):
        rpts.append(G + V((0, 0, 0.012 - i * 0.012)))
    tube(bm, rpts, [(0.042, 0.022)] * 3, nseg=12, ref=V((1, 0, 0)))
    ring = bm_to_object("hair_ring", bm, ["gold"], arm=arm, part="gold_hair")
    set_weights(ring, [{b_back[-1]: 1.0} for _ in ring.data.vertices])
    bm = bmesh.new()
    from .geo import plain_cross_outline, polygon_prism
    for sd in "LR":
        sp = side_pts[sd]
        c = sp[11]
        t = (sp[12] - sp[10]).normalized()
        o = (c - V((0, C.y, c.z))).normalized()
        o = (o - t * o.dot(t)).normalized()
        s_ax = t.cross(o).normalized()
        polygon_prism(bm, plain_cross_outline(0.040, 0.010, 0.006, 0.030), c + o * 0.016,
                      s_ax, -t, o, 0.006)
    clasps = bm_to_object("hair_clasps", bm, ["gold"], arm=arm, smooth=False, part="gold_hair")
    per = []
    for v in clasps.data.vertices:
        sd = "L" if v.co.x > 0 else "R"
        per.append({side_chains[sd][1]: 1.0})
    set_weights(clasps, per)

    # ---- veil: short white sheet over the back of the head to the shoulder blades
    objs["veil"] = build_veil(arm, M, surf)
    # ---- gold rose pin at the crown
    objs["pin"] = build_pin(arm, M)
    objs["veil_pins"] = build_veil_pins(arm, M)
    return objs


def proxy_normals(ob, M, strength=0.8):
    """Toon-hair normal transfer: on the head the hair takes the normals of a smooth
    ellipsoid round the skull, below the ears those of a cylinder round the body axis,
    blended with the clump's own normal. The light then falls on the hair as one mass (a
    clean lit side, shadow side and an angel-ring arc), and the clumps read through their
    separation lines instead of each clump's own facets (round 1: mottled camouflage)."""
    C, R = M["C"], M["R"]
    me = ob.data
    out = []
    z_ear = M["eye"].z - 0.03
    for v in me.vertices:
        p = v.co
        d = p - C
        n_ell = V((d.x / R.x ** 2, d.y / R.y ** 2, d.z / R.z ** 2)).normalized()
        cp = core_point(M, p)
        n_cyl = V((p.x - cp.x, p.y - cp.y, 0.0))
        n_cyl = n_cyl.normalized() if n_cyl.length > 1e-6 else V((0, 1, 0))
        k = smoothstep(z_ear - 0.10, z_ear + 0.02, p.z)
        n_proxy = n_cyl.lerp(n_ell, k).normalized()
        w = strength * (0.55 + 0.45 * k)
        out.append(v.normal.lerp(n_proxy, w).normalized())
    me.normals_split_custom_set_from_vertices(out)


def build_veil(arm, M, surf):
    C, R = M["C"], M["R"]
    rows = []
    nr, nc = 14, 19
    # round 2: wider so 2-3 px of white frame the hair past the jaw in front views, longer (to
    # the shoulder blades, DESIGN 16 x 21 at 128) with a point at the back centre (the "white
    # veil point" silhouette landmark); round 1-2 read as a 1-2 px sliver
    top_el, bot_z = 62, M["chest"].z - 0.03
    for i in range(nr + 1):
        t = i / nr
        row = []
        for j in range(nc + 1):
            u = j / nc
            az = lerp(96, 264, u)
            if t < 0.45:
                el = lerp(top_el, -15, t / 0.45)
                p = E(M, az, el, 1.20 + 0.04 * t)
            else:
                k = (t - 0.45) / 0.55
                p0 = E(M, az, -15, 1.22)
                # hangs down and flares out a little over the hair
                sway = math.sin(math.radians(az))
                # round 4 gear / overall critics ('a flat 12 x 40 px white rectangle'): the
                # veil tapers to a deeper centre point instead of flaring, and hangs in 3 soft
                # folds (radial undulation growing toward the hem; the fold valleys carry a
                # crease so they fall into the deep band as lines)
                p = V((p0.x * (1 + 0.10 * k) + sway * 0.02 * k,
                       p0.y + 0.03 * k + 0.02 * k * k,
                       lerp(p0.z, bot_z - 0.10 * (1 - abs(u * 2 - 1)) ** 1.2, k)))
                out_d = V((p.x, p.y - C.y, 0.0))
                if out_d.length > 1e-6:
                    out_d.normalize()
                    p = p + out_d * 0.011 * k ** 0.8 * math.sin(u * math.pi * 6 + 0.5)
            row.append(p)
        rows.append(row)
    bm = bmesh.new()
    from .geo import grid_sheet
    g = grid_sheet(bm, rows)
    # outward normals (the solidify grows outward, occlusion rays look outward)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median() - V((0, C.y, min(f.calc_center_median().z, C.z)))) < 0:
            f.normal_flip()
    ob = bm_to_object("veil", bm, ["veil", "beige", "lining", "gold"], arm=arm, part="veil")
    # round 4: a gold-edged hem (the last row) instead of the beige lace band
    for p in ob.data.polygons:
        if max(p.vertices) >= nr * (nc + 1):
            p.material_index = 3
    cr = ob.data.attributes.get("crease") or ob.data.attributes.new("crease", "FLOAT", "POINT")
    vals = []
    for v in ob.data.vertices:
        i, j = divmod(v.index, nc + 1)
        t, u = i / nr, j / nc
        valley = (-math.sin(u * math.pi * 6 + 0.5) - 0.5) / 0.5
        vals.append(max(0.0, min(1.0, valley * smoothstep(0.5, 0.9, t) * 0.8)))
    cr.data.foreach_set("value", vals)
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.008
    m.offset = 1.0
    m.use_even_offset = True
    m.material_offset_rim = 0
    # chain
    top = E(M, 180, top_el - 10, 1.20)
    mid = E(M, 180, -15, 1.22)
    low = V((0, mid.y + 0.07, bot_z))
    names = rig.add_chain(arm, "veil", [top, mid, low], "J_Bip_C_Head")
    per = []
    for v in ob.data.vertices:
        p = v.co
        if p.z > mid.z + 0.02:
            per.append({"J_Bip_C_Head": 1.0})
        else:
            k = smoothstep(mid.z + 0.02, bot_z, p.z)
            per.append({"J_Bip_C_Head": 1 - k, names[1]: k})
    set_weights(ob, per)
    ob["no_ao"] = False
    return ob


def build_pin(arm, M):
    """small gold rose: disc with eight bumps and an azure centre, at the crown front of the veil"""
    C, R = M["C"], M["R"]
    c = E(M, 138, 58, 1.24)
    n = (c - C).normalized()
    bm = bmesh.new()
    u, _ = n.orthogonal().normalized(), None
    u = n.orthogonal().normalized()
    w = n.cross(u)
    ring = []
    for k in range(16):
        a = 2 * math.pi * k / 16
        r = 0.026 * (1.0 if k % 2 == 0 else 0.78)
        ring.append(bm.verts.new(c + (u * math.cos(a) + w * math.sin(a)) * r))
    ctr = bm.verts.new(c + n * 0.008)
    for k in range(16):
        bm.faces.new((ring[k], ring[(k + 1) % 16], ctr))
    back = bm.verts.new(c - n * 0.006)
    for k in range(16):
        bm.faces.new((ring[(k + 1) % 16], ring[k], back))
    ob = bm_to_object("rose_pin", bm, ["gold"], arm=arm, smooth=False, part="gold_hair")
    set_weights(ob, [{"J_Bip_C_Head": 1.0} for _ in ob.data.vertices])
    return ob


def build_veil_pins(arm, M):
    """round 4 face critic: nothing gold or cross-shaped on the head ties it to the outfit ->
    a small gold cross pin each side where the veil's front edge meets the hair (3 x 4 px at 144)"""
    from .geo import plain_cross_outline, polygon_prism
    C = M["C"]
    bm = bmesh.new()
    for s in (1, -1):
        c = E(M, s * 97, 30, 1.27)
        n = (c - C).normalized()
        up = V((0, 0, 1))
        u = up.cross(n).normalized()
        w = n.cross(u).normalized()
        polygon_prism(bm, plain_cross_outline(0.050, 0.012, 0.009, 0.036), c, u, w, n, 0.006)
    ob = bm_to_object("veil_pins", bm, ["gold"], arm=arm, smooth=False, part="gold_hair")
    set_weights(ob, [{"J_Bip_C_Head": 1.0} for _ in ob.data.vertices])
    return ob
