"""Outfit as real geometry, after ref 14 (DESIGN.md section 3).

Two construction routes:
  * shells: body faces selected by a region function (angle around the torso, height, skin
    masks), subdivided, boundary smoothed and re-projected, pushed out along the body normal;
    trims are the faces within a geodesic distance of the garment edge (gold, slightly raised).
    Bodice + back yoke, mid-back strap, garter belt, thong, thigh-highs, boots, armbands.
  * cloth that hangs: collar (tube), front tabard (curved sheet), detached sleeves (flared
    cones with the lower lip long), with thickness (solidify) so they never go edge-on into a
    1 px ribbon, and bone chains (tabard, sleeve) for lag.
Gold fittings (crosses, rings, charms, medallions) are small slabs.
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from . import rig
from .common import gauss, lerp, smoothstep
from .geo import (bm_to_object, catmull, chain_weights, copy_weights_nearest, fleur_cross_outline,
                  geodesic_from, grid_sheet, object_bvh, plain_cross_outline, polygon_prism,
                  set_weights, tube)

V = Vector
ARM_KEYS = ("Shoulder", "UpperArm", "LowerArm", "Hand", "Thumb", "Index", "Middle", "Ring", "Little")


# ---------------------------------------------------------------------------- landmarks
class Body:
    def __init__(self, arm, body):
        self.arm, self.ob = arm, body
        B = arm.data.bones
        self.B = B
        self.spine = sorted([(B[n].head_local.z, B[n].head_local.y) for n in
                             ("J_Bip_C_Hips", "J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest",
                              "J_Bip_C_Neck")])
        self.hips = B["J_Bip_C_Hips"].head_local.z
        self.hipj = B["J_Bip_L_UpperLeg"].head_local.z
        self.knee = B["J_Bip_L_LowerLeg"].head_local.z
        self.ankle = B["J_Bip_L_Foot"].head_local.z
        self.neck = B["J_Bip_C_Neck"].head_local.z
        self.bust = B["J_Sec_L_Bust1"].head_local.copy()
        self.shoulder = B["J_Bip_L_UpperArm"].head_local.copy()
        self.elbow = B["J_Bip_L_LowerArm"].head_local.copy()
        self.wrist = B["J_Bip_L_Hand"].head_local.copy()
        self.chin = arm["head_metrics"]["chin"]
        self.bvh, _ = object_bvh([body])
        names = {g.index: g.name for g in body.vertex_groups}
        self.masks = []
        for v in body.data.vertices:
            m = {"arm": 0.0, "legL": 0.0, "legR": 0.0, "head": 0.0, "foot": 0.0}
            tot = 0.0
            for g in v.groups:
                n = names.get(g.group, "")
                tot += g.weight
                if any(k in n for k in ARM_KEYS):
                    m["arm"] += g.weight
                if "_L_UpperLeg" in n or "_L_LowerLeg" in n or "_L_Foot" in n or "_L_Toe" in n:
                    m["legL"] += g.weight
                if "_R_UpperLeg" in n or "_R_LowerLeg" in n or "_R_Foot" in n or "_R_Toe" in n:
                    m["legR"] += g.weight
                if "Foot" in n or "Toe" in n:
                    m["foot"] += g.weight
                if "Head" in n or "FaceEye" in n:
                    m["head"] += g.weight
            if tot > 0:
                for k in m:
                    m[k] /= tot
            self.masks.append(m)

    def yc(self, z):
        s = self.spine
        if z <= s[0][0]:
            return s[0][1]
        for (za, ya), (zb, yb) in zip(s, s[1:]):
            if za <= z <= zb:
                return lerp(ya, yb, (z - za) / (zb - za))
        return s[-1][1]

    def theta(self, p):
        """degrees around the torso: 0 front, +90 her left, +-180 back"""
        return math.degrees(math.atan2(p.x, -(p.y - self.yc(p.z))))

    def front_y(self, z, x0, x1, default=-0.1):
        """most forward body point in a horizontal strip"""
        best = None
        for x in [x0 + (x1 - x0) * i / 8 for i in range(9)]:
            hit = self.bvh.ray_cast(V((x, -1.0, z)), V((0, 1, 0)), 2.0)
            if hit[0] is not None:
                best = hit[0].y if best is None else min(best, hit[0].y)
        return best if best is not None else default


# ---------------------------------------------------------------------------- shell
def shell(Bd, name, region, offset, mats, trim=0.0, trim_raise=0.0015, part=None, subdiv=1,
          smooth_iters=8, trim_seeds=None, extra=None, coarse=None):
    """Garment shell from body faces where region(p, masks) is True (p = face centre).
    mats: [cloth, trim]. coarse(p, masks), if given, replaces region for the first (whole-face)
    pick only; the cut on the subdivided mesh always uses region. Returns the object (weights
    transferred from the body)."""
    body = Bd.ob
    me = body.data
    keep_coarse = set()
    pick = coarse or region
    for f in me.polygons:
        ms = _avg_masks(Bd, f.vertices)
        if pick(f.center, ms):
            keep_coarse.add(f.index)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    sel = {bm.faces[i] for i in keep_coarse}
    # grow 2 rings so the precise cut after subdivision has room
    for _ in range(2):
        grow = set()
        for f in sel:
            for e in f.edges:
                grow.update(e.link_faces)
        sel |= grow
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in sel], context="FACES")
    if subdiv:
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=subdiv, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    # precise region on the fine mesh; masks from the nearest body vertex
    kd = _kd(Bd)
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        _, idx, _ = kd.find(c)
        if not region(c, Bd.masks[idx]):
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    # remove tiny islands (< 12 faces)
    _drop_small_islands(bm, 12)
    # smooth the boundary and re-project onto the body
    for _ in range(smooth_iters):
        moves = {}
        for v in bm.verts:
            if not v.is_boundary:
                continue
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                moves[v] = (nb[0].co + nb[1].co) * 0.5
        for v, q in moves.items():
            v.co = v.co.lerp(q, 0.6)
        for v in bm.verts:
            q, n, _, _ = Bd.bvh.find_nearest(v.co)
            if q is not None:
                v.co = q
    # offset along the body normal; trims raised
    dist = geodesic_from(bm, trim_seeds(bm) if trim_seeds else [v for v in bm.verts if v.is_boundary]) if trim else {}
    for v in bm.verts:
        q, n, _, _ = Bd.bvh.find_nearest(v.co)
        off = offset + (trim_raise if trim and dist.get(v.index, 1e9) < trim else 0.0)
        v.co = q + n * off
    if trim:
        for f in bm.faces:
            d = sum(dist.get(v.index, 1e9) for v in f.verts) / len(f.verts)
            f.material_index = 1 if d < trim else 0
    if extra:
        extra(bm, dist)
    ob = bm_to_object(name, bm, mats, arm=Bd.arm, part=part or name)
    copy_weights_nearest(ob, body)
    return ob


_KD = {}


def _kd(Bd):
    if "kd" not in _KD:
        from mathutils.kdtree import KDTree
        me = Bd.ob.data
        kd = KDTree(len(me.vertices))
        for v in me.vertices:
            kd.insert(v.co, v.index)
        kd.balance()
        _KD["kd"] = kd
    return _KD["kd"]


def _avg_masks(Bd, vids):
    out = {}
    for i in vids:
        for k, w in Bd.masks[i].items():
            out[k] = out.get(k, 0.0) + w / len(vids)
    return out


def _drop_small_islands(bm, n):
    seen = set()
    for f in list(bm.faces):
        if f in seen or not f.is_valid:
            continue
        isl, stack = {f}, [f]
        while stack:
            g = stack.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if h not in isl:
                        isl.add(h)
                        stack.append(h)
        seen |= isl
        if len(isl) < n:
            bmesh.ops.delete(bm, geom=list(isl), context="FACES")


# ---------------------------------------------------------------------------- pieces
BODICE_WRAP = 100.0   # half-angle of the front panel at the bust (r3: 78)


def bodice(Bd):
    WRAP = BODICE_WRAP
    zc = Bd.bust.z            # bust line
    z_top = Bd.neck - 0.005   # collar base
    z_arm = Bd.shoulder.z - 0.07   # armpit
    z_waist = zc - 0.14
    z_low = Bd.hipj - 0.01    # where the tabard takes over (front)
    win_top, win_bot, win_w = z_top - 0.012, zc - 0.095, 0.052
    win_mid = zc + 0.005

    def front_half_angle(z):
        if z > z_top:
            return 0.0
        # round 3 critics: from the rear three-quarter view the front panel stopped at 78
        # degrees, so the side of the bust showed as bare skin and she read topless in the
        # pivot. The panel now wraps round the side of the bust (its gold edge becomes a side
        # seam visible from behind); the open side stays below it, armpit-low to hip.
        if z > z_arm:
            return lerp(WRAP, 30, (z - z_arm) / (z_top - z_arm))
        if z > zc - 0.05:
            return WRAP
        if z > z_waist:
            return lerp(44, WRAP, smoothstep(z_waist, zc - 0.05, z))
        return lerp(34, 44, smoothstep(z_low, z_waist, z))

    def back_half_angle(z):
        top = z_top + 0.01
        v_bot = z_arm + 0.005
        if z > top:
            return 0.0
        if z > z_arm + 0.045:
            return 48.0
        if z > v_bot:
            return 48.0 * (z - v_bot) / 0.04
        return 0.0

    def region(p, m):
        if m["arm"] > 0.35 or m["head"] > 0.3 or p.z < z_low or p.z > z_top + 0.015:
            return False
        th = Bd.theta(p)
        if abs(th) < front_half_angle(p.z):
            # diamond window between the breasts
            if win_bot < p.z < win_top:
                h = (win_top - p.z) / (win_top - win_mid) if p.z > win_mid else (p.z - win_bot) / (win_mid - win_bot)
                if abs(p.x) < win_w * max(0.0, min(1.0, h)) ** 0.85:
                    return False
            return True
        if 180 - abs(th) < back_half_angle(p.z):
            return True
        return False

    # 0.0065 off the skin: at 0.0045 the chord sag of the shell over the (restyled) bust let the
    # skin poke through at the apex, a dot that read as a nipple at 1x (round 1)
    ob = shell(Bd, "bodice", region, 0.0065, ["white", "gold"], trim=0.0135, part="bodice")   # r2: trim 0.0105 broke into dotted 1 px runs
    return ob


def midback_strap(Bd):
    z0 = Bd.bust.z - 0.125

    def region(p, m):
        if m["arm"] > 0.3 or abs(p.z - z0 + 0.012 * math.cos(math.radians(Bd.theta(p)))) > 0.0085:
            return False
        return abs(Bd.theta(p)) > 60
    return shell(Bd, "midback_strap", region, 0.0055, ["gold", "gold"], part="gold_harness")


def garter_belt(Bd):
    """low gold belt: dips to a V at the centre back (where the thong starts) and runs under
    the tabard in front"""
    zs = Bd.hipj + 0.062

    def zline(th):
        a = abs(th)
        # over the iliac crest at the sides, a V down to the top of the thong at the back
        # (ref 14's back), and a shallower dip under the tabard in front
        return zs - 0.022 * gauss(a, 180, 30) - 0.035 * gauss(a, 0, 35) + 0.010 * gauss(a, 90, 30)

    def region(p, m):
        if p.z < zs - 0.09 or p.z > zs + 0.05:
            return False
        th = Bd.theta(p)
        return abs(p.z - zline(th)) < 0.0095 and m["arm"] < 0.1
    return shell(Bd, "garter_belt", region, 0.0065, ["gold", "gold"], part="gold_harness"), zline


def thong(Bd, zline, arm):
    """T-back after ref 14: a gold-edged triangle bridging the top of the gluteal cleft from the
    belt's V, then a narrow strap into the cleft; a small front panel sits under the tabard.
    Built as ray-cast patches on the body (a body shell breaks up in the cleft's concavity)."""
    bm = bmesh.new()
    top_b = zline(180) + 0.006
    bot_b = top_b - 0.24
    nr, nc = 16, 9
    rows = []
    for i in range(nr + 1):
        v = i / nr
        z = lerp(top_b, bot_b, v)
        w = 0.068 * (1 - v) ** 2.1 + 0.0055
        row = []
        for j in range(nc + 1):
            u = j / nc * 2 - 1
            x = u * w
            hit = Bd.bvh.ray_cast(V((x, 0.6, z)), V((0, -1, 0)), 1.0)
            q = hit[0] + hit[1] * 0.0045 if hit[0] is not None else V((x, 0.1, z))
            # bridge the cleft near the top: never sink more than 1 cm behind the rim line
            row.append(q)
        ymax = max(p.y for p in row)
        for p in row:
            p.y = max(p.y, ymax - (0.010 if v < 0.5 else 0.03))
        rows.append(row)
    g = grid_sheet(bm, rows)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y < 0:
            f.normal_flip()
    bm.verts.index_update()
    for f in bm.faces:
        cols = [v.index % (nc + 1) for v in f.verts]
        if min(cols) == 0 or max(cols) == nc:
            f.material_index = 1
    # front panel (under the tabard)
    top_f = zline(0) + 0.006
    rows = []
    for i in range(9):
        v = i / 8
        z = lerp(top_f, top_f - 0.13, v)
        w = 0.075 * (1 - v) ** 1.3 + 0.012
        row = []
        for j in range(7):
            x = (j / 6 * 2 - 1) * w
            hit = Bd.bvh.ray_cast(V((x, -0.6, z)), V((0, 1, 0)), 1.0)
            row.append(hit[0] + hit[1] * 0.0045 if hit[0] is not None else V((x, -0.08, z)))
        rows.append(row)
    g2 = grid_sheet(bm, rows)
    ob = bm_to_object("thong", bm, ["thong", "gold"], arm=arm, part="thong")
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.002
    m.offset = 1.0
    copy_weights_nearest(ob, Bd.ob)
    return ob


def stockings(Bd, top_z, bottom_z=0.0):
    def region(p, m):
        return (m["legL"] + m["legR"]) > 0.6 and bottom_z < p.z < top_z and m["arm"] < 0.1

    def seeds(bm):
        return [v for v in bm.verts if v.is_boundary and v.co.z > top_z - 0.03]
    ob = shell(Bd, "stockings", region, 0.0028, ["stocking", "gold"], trim=0.012, part="stockings",
               trim_seeds=seeds)
    cr = []
    for v in ob.data.vertices:
        p = v.co
        back = smoothstep(0.0, 0.04, p.y - 0.01)
        cr.append(0.75 * gauss(p.z, Bd.knee + 0.01, 0.018) * back)
    set_crease(ob, cr)
    return ob


def thigh_bands(Bd, z):
    def region(p, m):
        return (m["legL"] + m["legR"]) > 0.7 and abs(p.z - z) < 0.009
    return shell(Bd, "thigh_bands", region, 0.0065, ["gold", "gold"], part="gold_harness")


def boots(Bd, top_z):
    def region(p, m):
        return ((m["legL"] + m["legR"]) > 0.5 and p.z < top_z) or m["foot"] > 0.3

    def seeds(bm):
        return [v for v in bm.verts if v.is_boundary and v.co.z > top_z - 0.03]

    def finish(bm, dist):
        # hide the toes: relax the foot region hard, then push back out of the body
        foot = [v for v in bm.verts if v.co.z < Bd.ankle + 0.02]
        for _ in range(12):
            for v in foot:
                nb = [e.other_vert(v).co for e in v.link_edges]
                v.co = v.co.lerp(sum(nb, V()) / len(nb), 0.5)
        for v in foot:
            q, n, _, _ = Bd.bvh.find_nearest(v.co)
            if q is not None and (v.co - q).dot(n) < 0.009:
                v.co = q + n * 0.009
        toe_y = min(v.co.y for v in bm.verts)
        for f in bm.faces:
            c = f.calc_center_median()
            if f.material_index == 0 and c.z < 0.06 and c.y < toe_y + 0.030:
                f.material_index = 1      # gold toe cap
    ob = shell(Bd, "boots", region, 0.0075, ["boot", "gold"], trim=0.012, part="boots",
               trim_seeds=seeds, extra=finish)
    return ob


def heels(Bd, arm):
    """heel blocks (gold heel caps) under each boot heel"""
    bm = bmesh.new()
    per = []
    for s in "LR":
        foot = arm.data.bones[f"J_Bip_{s}_Foot"]
        A = foot.head_local.copy()
        # heel bottom of the (tilted) foot: cast down behind the ankle
        hx, hy = A.x, A.y + 0.035
        hit = Bd.bvh.ray_cast(V((hx, hy, A.z)), V((0, 0, -1)), 1.0)
        ztop = (hit[0].z if hit[0] is not None else 0.06) - 0.004
        pts = [V((hx, hy - 0.004, ztop)), V((hx, hy + 0.004, ztop * 0.45)), V((hx, hy + 0.006, 0.0))]
        tube(bm, pts, [(0.020, 0.024), (0.011, 0.012), (0.012, 0.012)], nseg=10, ref=V((1, 0, 0)))
    ob = bm_to_object("heels", bm, ["boot", "gold"], arm=arm, part="boots")
    for p in ob.data.polygons:
        if p.center.z < 0.02:
            p.material_index = 1
    set_weights(ob, [{f"J_Bip_{'L' if v.co.x > 0 else 'R'}_Foot": 1.0} for v in ob.data.vertices])
    return ob


def armbands(Bd):
    x0, x1 = Bd.shoulder.x + 0.085, Bd.shoulder.x + 0.113

    def region(p, m):
        return m["arm"] > 0.6 and x0 < abs(p.x) < x1
    return shell(Bd, "armbands", region, 0.0065, ["gold", "gold"], part="gold_arm")


def collar(Bd, arm):
    n = arm.data.bones["J_Bip_C_Neck"]
    base = n.head_local.copy()
    zb = base.z - 0.018
    # r2: 1 px lower, its dark trim line read as jowls against the jaw; r3-fix (body critic:
    # ~3 px of neck above the collar): the front dips a further ~1.5 px so the longer neck shows
    zt_front, zt_back = Bd.chin - 0.030, Bd.chin + 0.030
    bm = bmesh.new()
    nseg, nr = 24, 7
    rings = []
    for i in range(nr):
        t = i / (nr - 1)
        ring = []
        for k in range(nseg):
            a = 2 * math.pi * k / nseg
            back = (1 - math.cos(a)) / 2          # 0 front, 1 back (a=0 front)
            zt = lerp(zt_front, zt_back, back ** 1.5)
            z = lerp(zb, zt, t)
            r = lerp(0.056, 0.043, smoothstep(0, 0.45, t)) + 0.004 * t
            cy = base.y + 0.004
            ring.append(bm.verts.new(V((math.sin(a) * r * 1.02, cy - math.cos(a) * r * 0.98, z))))
        rings.append(ring)
    for i in range(nr - 1):
        for k in range(nseg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % nseg], rings[i + 1][(k + 1) % nseg], rings[i + 1][k]))
    ob = bm_to_object("collar", bm, ["white", "gold"], arm=arm, part="collar")
    me = ob.data
    # gold: top band and bottom band (by ring index via height fraction per column)
    # round 4 craft critic: gold is mid-tone noise on the chest -> the collar keeps only its
    # top band (the bottom band merged with the bodice trim into one gold cluster)
    for p in me.polygons:
        ri = min(p.vertices) // nseg
        if ri >= nr - 2:
            p.material_index = 1
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.005
    m.offset = 1.0
    set_weights(ob, [{"J_Bip_C_Neck": 1.0} if v.co.z > base.z + 0.02 else
                     {"J_Bip_C_Neck": 0.5, "J_Bip_C_UpperChest": 0.5} for v in me.vertices])
    return ob


def tabard(Bd, arm):
    top = Bd.hipj + 0.02
    bot = lerp(Bd.knee, Bd.ankle, 0.52)      # mid-shin (DESIGN 2)
    nr, nc = 30, 18
    # round 3 body critic: the tabard hung like a board over the far leg (no knee, calf or
    # thigh taper that side) -> a narrower panel (DESIGN 2: 9 px at 128 ~ 0.062 half-width)
    w_top, w_bot = 0.054, 0.066
    rows = []
    # forward-most body line (cumulative so the cloth hangs straight from where it leaves the body)
    yline = []
    ymin = 0.0
    for i in range(nr + 1):
        z = lerp(top, bot, i / nr)
        w = lerp(w_top, w_bot, i / nr)
        fy = Bd.front_y(z, -w - 0.03, w + 0.03, default=ymin) - 0.018
        ymin = min(ymin, fy) if i else fy
        yline.append(ymin)
    for i in range(nr + 1):
        t = i / nr
        z = lerp(top, bot, t)
        w = lerp(w_top, w_bot, t ** 0.8)
        row = []
        for j in range(nc + 1):
            u = j / nc * 2 - 1
            bulge = 0.018 * (1 - u * u)
            # soft vertical folds that deepen toward the hem (fabric, not a board)
            fold = (0.002 + 0.009 * t ** 1.4) * math.sin(u * math.pi * 2.5 + 0.6) * (0.35 + 0.65 * smoothstep(0.1, 0.45, abs(u)))
            bulge += fold
            zz = z - 0.085 * (1 - abs(u)) * smoothstep(0.55, 1.0, t)     # V point hem
            row.append(V((u * w, yline[i] - bulge, zz)))
        rows.append(row)
    bm = bmesh.new()
    grid_sheet(bm, rows)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()
    ob = bm_to_object("tabard", bm, ["white", "gold", "lining", "gold"], arm=arm, part="tabard")
    me = ob.data
    cr = []
    for v in me.vertices:
        i, j = divmod(v.index, nc + 1)
        u, t = j / nc * 2 - 1, i / nr
        valley = (-math.sin(u * math.pi * 2.5 + 0.6) - 0.55) / 0.45
        cr.append(max(0.0, valley) * smoothstep(0.08, 0.45, t) * 0.8)
    set_crease(ob, cr)
    for p in me.polygons:
        vs = p.vertices
        cols = [i % (nc + 1) for i in vs]
        rws = [i // (nc + 1) for i in vs]
        # two columns of gold (~1.3 px at 144): a one-column edge (0.6 px) broke into dots
        if min(cols) <= 1 or max(cols) >= nc - 1 or max(rws) >= nr:
            p.material_index = 1
    # round 3 craft critic (value plan): dark indigo inside the tabard, so a lift, a swing
    # or the side edge shows a dark accent instead of more white. The cloth grows backward
    # (offset -1) from a front surface moved 7 mm forward; the new back shell is the lining.
    for v in me.vertices:
        v.co.y -= 0.007
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.007
    m.offset = -1.0
    m.material_offset = 2
    m.material_offset_rim = 1
    # chain down the middle
    pts = [V((0, yline[int(nr * k / 4)], lerp(top, bot, k / 4))) for k in range(5)]
    pts[-1].z -= 0.06
    names = rig.add_chain(arm, "tabard", pts, "J_Bip_C_Hips")
    set_weights(ob, [chain_weights(v.co, pts, names, "J_Bip_C_Hips", 0.5) for v in me.vertices])
    # big fleur-cross near the hem
    zc = lerp(top, bot, 0.80)
    iy = int(nr * 0.80)
    bmx = bmesh.new()
    # in front of the cloth: bulge (0.018) + fold (<= 0.009) + thickness (0.007); round 1 sat
    # inside the folds and showed as gold specks
    polygon_prism(bmx, fleur_cross_outline(0.17, 0.024, 0.035, 0.10), V((0, yline[iy] - 0.018 - 0.020, zc)),
                  V((1, 0, 0)), V((0, 0, 1)), V((0, -1, 0)), 0.004)
    cr = bm_to_object("tabard_cross", bmx, ["gold"], arm=arm, smooth=False, part="tabard")
    set_weights(cr, [chain_weights(v.co, pts, names, "J_Bip_C_Hips", 0.5) for v in cr.data.vertices])
    return ob, cr


SLEEVE_LIP = 0.17      # hanging lip past the mouth (round 1: 0.21 read as a shield)
SLEEVE_BELL = 0.092    # lower bell radius (round 1: 0.125)
SLEEVE_SHORT = 0.065   # the mouth ends this far before the wrist: forearm and wrist show


def sleeve_profile(sh, ax, x0, x_el, x_wr):
    """point on the detached sleeve for ring parameter t and angle phi (0 = front, 90 = up).
    Teardrop section: snug over the top of the forearm, the width and length going into a
    hanging panel below, so the mouth shows a sliver of lining instead of a full disc."""
    z_axis, front = V((0, 0, 1)), V((0, -1, 0))

    def point(t, phi, out=0.0):
        up = math.sin(phi)
        bottom = max(0.0, -up)
        # round 2 gear critic: the flare read as a rigid ellipse plate -> a trumpet with a
        # scalloped hem (the mouth edge dips between the flutes) and deeper flutes
        scallop = 0.020 * (0.5 + 0.5 * math.cos(phi * 5 + 0.4 + math.pi / 2)) * (0.35 + 0.65 * bottom)
        x_end = x_wr - SLEEVE_SHORT + (SLEEVE_LIP + SLEEVE_SHORT - 0.01) * bottom ** 1.3 + scallop
        a = lerp(x0, x_end, t)
        flare = smoothstep(x_el - 0.04, x_wr - 0.02, a)
        r_arm = lerp(0.047, 0.055, max(0.0, min(1.0, (a - x0) / (x_el - x0))))
        flute = 1.0 + 0.11 * math.sin(phi * 5 + 0.4) * flare * (0.3 + 0.7 * bottom)
        rt = (r_arm + 0.012 * flare) * flute
        rh = (r_arm + 0.050 * flare) * flute
        rb = (r_arm + SLEEVE_BELL * flare ** 1.2) * flute
        v = up * (rt if up > 0 else rb)
        h = math.cos(phi) * rh
        c = sh + ax * a
        n = (front * math.cos(phi) / max(rh, 1e-4) + z_axis * up / max(rt if up > 0 else rb, 1e-4)).normalized()
        return c + front * h + z_axis * v + n * out, n, a
    return point


def sleeves(Bd, arm):
    out = []
    for s, sx in (("L", 1), ("R", -1)):
        sh = arm.data.bones[f"J_Bip_{s}_UpperArm"].head_local.copy()
        el = arm.data.bones[f"J_Bip_{s}_LowerArm"].head_local.copy()
        wr = arm.data.bones[f"J_Bip_{s}_Hand"].head_local.copy()
        ax = (wr - sh).normalized()
        x0 = 0.128                           # just past the armband
        x_el = (el - sh).length
        x_wr = (wr - sh).length
        point = sleeve_profile(sh, ax, x0, x_el, x_wr)
        nr, nseg = 22, 28
        bm = bmesh.new()
        rings = []
        for i in range(nr + 1):
            rings.append([bm.verts.new(point(i / nr, 2 * math.pi * k / nseg)[0]) for k in range(nseg)])
        for i in range(nr):
            for k in range(nseg):
                bm.faces.new((rings[i][k], rings[i][(k + 1) % nseg], rings[i + 1][(k + 1) % nseg], rings[i + 1][k]))
        bm.normal_update()
        for f in bm.faces:
            c = f.calc_center_median()
            axis_pt = sh + ax * (c - sh).dot(ax)
            if f.normal.dot(c - axis_pt) < 0:
                f.normal_flip()
        bm.verts.index_update()
        for f in bm.faces:
            vi = max(v.index for v in f.verts)
            if vi >= (nr - 1) * nseg or vi < nseg:
                f.material_index = 2         # gold hem and top band
        ob = bm_to_object(f"sleeve.{s}", bm, ["white", "lining", "gold"], arm=arm, part="sleeves")
        cr = []
        for v in ob.data.vertices:
            i, k = divmod(v.index, nseg)
            phi, t = 2 * math.pi * k / nseg, i / nr
            valley = (-math.sin(phi * 5 + 0.4) - 0.6) / 0.4
            cr.append(max(0.0, valley) * smoothstep(0.35, 0.8, t) * 0.8)
        set_crease(ob, cr)
        m = ob.modifiers.new("thick", "SOLIDIFY")
        m.thickness = 0.006
        m.offset = -1.0
        m.material_offset = 1
        m.material_offset_rim = 2
        # chain along the hanging panel
        p0 = el + V((0, 0, -0.05))
        p1 = wr + ax * 0.02 + V((0, 0, -0.14))
        tip = sh + ax * (x_wr + SLEEVE_LIP) + V((0, 0, -0.055 - SLEEVE_BELL))
        names = rig.add_chain(arm, f"sleeve_{s}", [p0, p1, tip], f"J_Bip_{s}_LowerArm")
        me = ob.data
        per = []
        for v in me.vertices:
            p = v.co
            a = (p - sh).dot(ax)
            below = max(0.0, (sh.z - p.z) / 0.12)
            if a < x_el - 0.03:
                w = smoothstep(x_el - 0.08, x_el - 0.03, a)
                per.append({f"J_Bip_{s}_UpperArm": 1 - w, f"J_Bip_{s}_LowerArm": w})
                continue
            wc = smoothstep(x_el + 0.03, x_wr + 0.05, a) * min(1.0, 0.15 + below)
            cw = chain_weights(p, [p0, p1, tip], names, None, 0.0)
            ws = {f"J_Bip_{s}_LowerArm": 1 - wc}
            for bn, w in cw.items():
                ws[bn] = ws.get(bn, 0) + w * wc
            per.append(ws)
        set_weights(ob, per)
        out.append(ob)
        # fleur cross on the outer face of the hanging panel, near the hem
        pos, n, _ = point(0.86, math.radians(-35), out=0.004)
        bmx = bmesh.new()
        u = ax - n * ax.dot(n)
        polygon_prism(bmx, fleur_cross_outline(0.075, 0.011, 0.012, 0.05), pos, u.normalized(),
                      n.cross(u).normalized(), n, 0.004)
        cr = bm_to_object(f"sleeve_cross.{s}", bmx, ["gold"], arm=arm, smooth=False, part="sleeves")
        set_weights(cr, [chain_weights(v.co, [p0, p1, tip], names, None, 0.0) for v in cr.data.vertices])
        out.append(cr)
    return out


def fittings(Bd, arm, zline, thigh_z, belt):
    """collar cross, back yoke cross, belt medallion + O-rings, garter straps, charms"""
    obs = []
    # collar cross (front)
    nb = arm.data.bones["J_Bip_C_Neck"].head_local.copy()
    bm = bmesh.new()
    # r2: collar cross unreadable -> larger, clear of the jaw; r3-fix: follows the lower collar
    # front. Round 4 gear critic ('the collar cross doesn't exist at pixel scale: a gold choker
    # line'): 5 x 7 px at 144 on a 1 px indigo backing plate, so gold sits on a dark field
    # it hangs as a pendant just under the collar's front edge (at the chin line the tilted
    # head hid it), over the top of the chest window
    zc = nb.z - 0.018 - 0.05
    cc = V((0, Bd.front_y(zc, -0.012, 0.012, default=nb.y - 0.06) - 0.012, zc))
    polygon_prism(bm, fleur_cross_outline(0.100, 0.021, 0.019, 0.070), cc,
                  V((1, 0, 0)), V((0, 0, 1)), V((0, -1, 0)), 0.005)
    ob = bm_to_object("collar_cross", bm, ["gold"], arm=arm, smooth=False, part="collar_cross")
    set_weights(ob, [{"J_Bip_C_UpperChest": 1.0} for _ in ob.data.vertices])
    obs.append(ob)
    bm = bmesh.new()
    hw, hh = 0.054, 0.074
    lozenge = [(0, hh), (hw * 0.55, hh * 0.55), (hw, 0.012), (hw * 0.55, -hh * 0.45), (0, -hh), (-hw * 0.55, -hh * 0.45),
               (-hw, 0.012), (-hw * 0.55, hh * 0.55)]
    polygon_prism(bm, lozenge, cc + V((0, 0.005, 0.002)), V((1, 0, 0)), V((0, 0, 1)), V((0, -1, 0)), 0.004)
    ob = bm_to_object("collar_plate", bm, ["indigo"], arm=arm, smooth=False, part="collar_plate")
    set_weights(ob, [{"J_Bip_C_UpperChest": 1.0} for _ in ob.data.vertices])
    ob["no_ao"] = True
    obs.append(ob)
    # back yoke cross
    zy = Bd.shoulder.z + 0.005
    hit = Bd.bvh.ray_cast(V((0, 0.5, zy)), V((0, -1, 0)), 1.0)
    yb = hit[0].y if hit[0] is not None else 0.06
    bm = bmesh.new()
    polygon_prism(bm, fleur_cross_outline(0.060, 0.011, 0.012, 0.042), V((0, yb + 0.010, zy)),
                  V((-1, 0, 0)), V((0, 0, 1)), V((0, 1, 0)), 0.005)
    ob = bm_to_object("yoke_cross", bm, ["gold"], arm=arm, smooth=False, part="bodice")
    copy_weights_nearest(ob, Bd.ob)
    obs.append(ob)
    # garter straps: from the belt (front-side and back-side of each hip) down to the thigh band
    bm = bmesh.new()
    rings_at = []
    strap_pts = []
    for s in (1, -1):
        for th_top, th_bot in ((s * 42, s * 22), (s * 140, s * 160)):
            pts = []
            for i in range(9):
                t = i / 8
                th = math.radians(lerp(th_top, th_bot, t))
                z = lerp(zline(math.degrees(th)) - 0.006, thigh_z + 0.006, t)
                # cast toward the body axis to land on the skin
                d = V((math.sin(th), -math.cos(th), 0))
                leg_x = 0.07 * s * smoothstep(Bd.hipj, thigh_z, z)
                o = V((leg_x, Bd.yc(z), z)) + d * 0.4
                hit = Bd.bvh.ray_cast(o, -d, 1.0)
                q = hit[0] + hit[1] * 0.007 if hit[0] is not None else o - d * 0.3
                pts.append(q)
            pts = catmull(pts, 16)
            strap_pts.append(pts)
            tube(bm, pts, [(0.0078, 0.0034)] * len(pts), nseg=6,    # >= 1 px at 144 so the strap reads as a line, not gold dirt
                 refs=[(p - V((0.07 * s, Bd.yc(p.z), p.z))).normalized() for p in pts])
            rings_at.append(pts[0])
    straps = bm_to_object("garter_straps", bm, ["gold"], arm=arm, part="gold_harness")
    copy_weights_nearest(straps, Bd.ob)
    obs.append(straps)
    # O-rings on the belt at the strap tops, medallion front and back, charms at the strap feet
    bm = bmesh.new()
    for p in rings_at:
        n = (p - V((0, Bd.yc(p.z), p.z)))
        n.z = 0
        n.normalize()
        u = n.cross(V((0, 0, 1))).normalized()
        ring = []
        for k in range(12):
            a = 2 * math.pi * k / 12
            ring.append(p + n * 0.004 + (u * math.cos(a) + V((0, 0, 1)) * math.sin(a)) * 0.011)
        tube(bm, ring + [ring[0]], [(0.0028, 0.0028)] * 13, nseg=5, cap0=False, cap1=False, ref=n)
    for back in (False, True):
        th = 180 if back else 0
        z = zline(th) + 0.001
        d = V((0, 1 if back else -1, 0))
        hit = Bd.bvh.ray_cast(V((0, Bd.yc(z), z)) + d * 0.5, -d, 1.0)
        if hit[0] is not None:
            c = hit[0] + d * 0.008
            ring = []
            for k in range(14):
                a = 2 * math.pi * k / 14
                ring.append(c + V((math.cos(a) * 0.020, 0, math.sin(a) * 0.016)))
            cc = bm.verts.new(c + d * 0.004)
            vs = [bm.verts.new(q) for q in ring]
            for k in range(14):
                bm.faces.new((vs[k], vs[(k + 1) % 14], cc) if not back else (vs[(k + 1) % 14], vs[k], cc))
    rings_ob = bm_to_object("belt_rings", bm, ["gold"], arm=arm, part="gold_harness")
    copy_weights_nearest(rings_ob, Bd.ob)
    obs.append(rings_ob)
    # rose medallion centres: one azure glass cell in each belt medallion (DESIGN 3 #7)
    bm = bmesh.new()
    for back in (False, True):
        th = 180 if back else 0
        z = zline(th) + 0.001
        d = V((0, 1 if back else -1, 0))
        hit = Bd.bvh.ray_cast(V((0, Bd.yc(z), z)) + d * 0.5, -d, 1.0)
        if hit[0] is not None:
            c = hit[0] + d * 0.0135
            bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.0075,
                                      matrix=Matrix.Translation(c) @ Matrix.Scale(0.6, 4, d))
    glass = bm_to_object("belt_glass", bm, ["glasscore"], arm=arm, part="gold_harness")
    copy_weights_nearest(glass, Bd.ob)
    obs.append(glass)
    # cross charms hanging under the thigh band at each strap foot, on a short chain bone
    bm = bmesh.new()
    per_charm = []
    for i, pts in enumerate(strap_pts):
        foot = pts[-1]
        n = (foot - V((0.07 * (1 if foot.x > 0 else -1), Bd.yc(foot.z), foot.z)))
        n.z = 0
        n.normalize()
        c = foot + V((0, 0, -0.035)) + n * 0.006
        u = n.cross(V((0, 0, 1))).normalized()
        polygon_prism(bm, fleur_cross_outline(0.062, 0.012, 0.012, 0.040), c, u, V((0, 0, 1)), n, 0.005)
        # little link
        tube(bm, [foot + n * 0.006, c + V((0, 0, 0.02)) + n * 0.006], [(0.003, 0.003)] * 2, nseg=5, ref=n)
    charms = bm_to_object("charms", bm, ["gold"], arm=arm, smooth=False, part="gold_harness")
    copy_weights_nearest(charms, Bd.ob)
    obs.append(charms)
    # back halter straps: collar sides -> under the arms, framing the open back
    bm = bmesh.new()
    for s in (1, -1):
        pts = []
        for i in range(10):
            t = i / 9
            th = math.radians(s * lerp(150, 98, t))
            z = lerp(Bd.neck - 0.005, Bd.shoulder.z - 0.075, t)
            d = V((math.sin(th), -math.cos(th), 0))
            o = V((0, Bd.yc(z), z)) + d * 0.5
            hit = Bd.bvh.ray_cast(o, -d, 1.0)
            if hit[0] is not None:
                pts.append(hit[0] + hit[1] * 0.0065)
        if len(pts) > 3:
            pts = catmull(pts, 14)
            tube(bm, pts, [(0.0048, 0.0026)] * len(pts), nseg=6,
                 refs=[(p - V((0, Bd.yc(p.z), p.z))).normalized() for p in pts])
    halter = bm_to_object("halter_straps", bm, ["gold"], arm=arm, part="gold_harness")
    copy_weights_nearest(halter, Bd.ob)
    obs.append(halter)
    return obs


def set_crease(ob, values):
    """authored fold/crease mask (0..1) per vertex; the occlusion bake multiplies (1 - crease)
    into 'ao', so fold valleys and contact lines fall into the deep band as 1 px lines"""
    me = ob.data
    a = me.attributes.get("crease") or me.attributes.new("crease", "FLOAT", "POINT")
    a.data.foreach_set("value", [max(0.0, min(1.0, v)) for v in values])


def set_thong_variant(which):
    ob = bpy.data.objects.get("thong")
    if not ob:
        return
    ob.data.materials[0] = bpy.data.materials["thong" if which == "black" else "white"]


# ---------------------------------------------------------------------------- build
# art lane (2026-09-29): the outfit variant to build. "r0" is the pre-lane outfit exactly; the
# others live in outfit_art.py (VARIANTS). The lane driver (tools/pixel-pipeline/outfit_lane.py)
# sets ROSACE_OUTFIT per lane build; the default is the variant the lane last kept.
OUTFIT_DEFAULT = "r0"


def build(arm, body):
    variant = os.environ.get("ROSACE_OUTFIT", OUTFIT_DEFAULT)
    if variant != "r0":
        from . import outfit_art
        return outfit_art.build(arm, body, variant)
    _KD.clear()
    Bd = Body(arm, body)
    parts = {}
    parts["bodice"] = bodice(Bd)
    parts["midback"] = midback_strap(Bd)
    belt, zline = garter_belt(Bd)
    parts["belt"] = belt
    parts["thong"] = thong(Bd, zline, arm)
    thigh_z = lerp(Bd.knee, Bd.hipj, 0.36)
    boot_top = lerp(Bd.ankle, Bd.knee, 0.47)   # r2: shaft ~4 px longer so the lower leg reads long; mid-calf (DESIGN 3 #12; round 1 knee-high ate the stocking)
    parts["stockings"] = stockings(Bd, thigh_z, boot_top - 0.05)
    parts["thigh_bands"] = thigh_bands(Bd, thigh_z - 0.006)
    parts["boots"] = boots(Bd, boot_top)
    parts["heels"] = heels(Bd, arm)
    parts["armbands"] = armbands(Bd)
    parts["collar"] = collar(Bd, arm)
    parts["tabard"] = tabard(Bd, arm)
    parts["sleeves"] = sleeves(Bd, arm)
    parts["fittings"] = fittings(Bd, arm, zline, thigh_z, belt)
    arm["outfit_levels"] = {"thigh_band": thigh_z, "boot_top": boot_top}
    body_creases(Bd)
    return parts


def body_creases(Bd):
    """authored skin creases (into the occlusion bake, so they land in the deep band):
    the gluteal fold where each glute meets the thigh, curving up toward the outer hip,
    and a short inner-thigh line (round-1 critics: the seat read as stacked rectangles with
    no fold; the thighs as straight cylinders)"""
    me = Bd.ob.data
    vals = []
    fold_z = Bd.hipj - 0.075
    for v in me.vertices:
        p = v.co
        yc = Bd.yc(p.z)
        back = smoothstep(0.01, 0.05, p.y - yc)
        ax = abs(p.x)
        # fold line rises from the cleft toward the outer hip
        zf = fold_z + 0.03 * smoothstep(0.03, 0.12, ax)
        glute = gauss(p.z, zf, 0.009) * back * gauss(ax, 0.065, 0.045)
        cleft = gauss(ax, 0.0, 0.006) * back * smoothstep(fold_z - 0.01, fold_z + 0.04, p.z) *             smoothstep(Bd.hipj + 0.08, Bd.hipj + 0.02, p.z)
        inner = gauss(p.x * (1 if p.x > 0 else -1), 0.035, 0.008) * gauss(p.z, Bd.hipj - 0.10, 0.04) *             smoothstep(0.03, -0.01, p.y - yc)
        vals.append(min(1.0, 0.85 * glute + 0.6 * cleft + 0.35 * inner))
    set_crease(Bd.ob, vals)
