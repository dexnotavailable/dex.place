"""Refit Rosace's hair, veil, outfit and materials onto the v2 base (runs inside Blender).

The v1 builders in ../rosace (hair.py, outfit.py, glaive.py) are procedural: every piece is laid
out from the rig's landmarks (bone heads, head metrics) and from the body surface (ray casts,
shells cut from the body's own faces), and weighted from the body or onto its own chains. So the
refit calls them on the v2 body and rig, with these v2 corrections (found on the refit's first
renders, review/rosace/base-v2/refit/):

  * Boots (outfit.boots is swapped for boots_v2 during the build). SiroinoSotai has modelled
    toes, and a shell cut from them keeps five toes under the boot (v1's "relax the foot" trick
    left gold toenails). The shaft stays a body shell down to the ankle; the foot is a new
    envelope: sections along the foot's long axis, each ring found by casting rays inward from
    outside, so the rays land on the tops of the toes and bridge the gaps between them. A gold
    toe cap and a gold cuff band at the boot top (DESIGN 3 row 12, revision 3: the stocking and
    the boot are both indigo, and a 1 px gold line is what separates them; the trim of the shell
    alone was too narrow for the v2 leg's face size and never reached a pixel).
  * Collar cross (hang_collar_cross): the pendant rests on the upper slope of the bust (v1's sat
    in the v2 cleavage and lost its dark backing), and its pixels come from an authored glyph
    (glyphs.py, art/rosace/glyphs/): DESIGN specifies it in pixels, which a 7 px render can't hold.
  * Veil (hair.build_veil, build_pin and build_veil_pins are swapped). v1's veil hangs to the upper chest bone minus 13 cm: a
    white slab ~45 px long at 144 (DESIGN 2 asks 18 x 24 px, back of the head to the shoulder
    blades). v2 hangs it to the shoulder line, and pushes it clear of the hair: the hair is laid
    on the real skull, the veil on a fitted ellipsoid, and where the MMD skull bulges past the
    ellipsoid the crown clumps came through the veil.

Palette (DESIGN.md revision 3, ART-RULES O-6 / O-8): dark indigo thigh-highs (I2 core, I1 sheen,
I3 shadow side, I4 deep) and boots one step darker (I3 core). These live on the v2 scene as
scene['rosace_palette_overrides'] (rosace/materials.palette() merges them), so the render's
meta.json, and so the post-process, see the same ramps as the Blender materials. palette.json and
v1 are untouched until the Adopt step.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

V = Vector

# material overrides for v2 (merged over art/rosace/palette.json by materials.palette())
PALETTE_OVERRIDES = {
    # DESIGN 3 row 11: I2 core, I1 sheen, I3 shadow side, I4 deep (6.8:1 against the W1 tabard)
    "stocking": {"ramp": ["I4", "I3", "I2", "I1"], "t": [0.0, 0.14, 0.40, 0.80],
                 "line": "OL", "selout": "I4", "inner": "OL", "spec": {"code": "I1", "thr": 0.97}},
    # DESIGN 3 row 12: one step darker than the stocking, I3 core, I2 only on the brightest lit
    # strip, one I0 gloss streak; the shadow side stays I3 (I4 only in real occlusion: ART-RULES
    # O-8, a wide I4 patch sits within 1.3:1 of OL)
    "boot": {"ramp": ["I4", "I3", "I3", "I2"], "t": [0.0, 0.10, 0.30, 0.90],
             "line": "OL", "selout": "I4", "inner": "I4", "spec": {"code": "I0", "thr": 0.975}},
}

VEIL_DROP = 0.02          # veil sides end this far below the shoulder joints (m); centre point 0.10 lower
VEIL_CLEAR = 0.010        # veil base surface kept this far outside the hair (m)
BOOT = dict(shell=0.0075, foot=0.0095, cuff=0.0105, cuff_half=0.0075, toe_cap=0.34, rings=18, seg=20,
            smooth=6, split=0.42, overlap=0.02, sector_deg=16.0)


def apply_palette():
    bpy.context.scene["rosace_palette_overrides"] = PALETTE_OVERRIDES
    from rosace import materials
    materials.PAL = None


# ---------------------------------------------------------------------------- boots
def _side_foot_points(Bd, sx):
    me = Bd.ob.data
    pts = []
    for v, m in zip(me.vertices, Bd.masks):
        if m["foot"] > 0.5 and v.co.x * sx > 0:
            pts.append(v.co.copy())
    return pts


def foot_axis(Bd, sx):
    """the foot's long axis (PCA of the skin weighted to the foot and toes), pointing to the toes;
    returns (centre, axis, t_heel, t_toe)"""
    foot = np.array([p[:] for p in _side_foot_points(Bd, sx)])
    c = foot.mean(0)
    u, s, vt = np.linalg.svd(foot - c, full_matrices=False)
    ax = V(vt[0]).normalized()
    if ax.y > 0:                  # toward the toes (she faces -Y)
        ax = -ax
    t = (foot - c) @ np.array(ax[:])
    return V(c[:]), ax, float(t.min()), float(t.max())


def forefoot(Bd, p, axes):
    sx = 1 if p.x > 0 else -1
    c, ax, t0, t1 = axes[sx]
    return (p - c).dot(ax) > t0 + (t1 - t0) * BOOT["split"]


def boot_foot(Bd, arm, sx, axes):
    """envelope over one forefoot: rings perpendicular to the foot's long axis; each ring's radius
    per angular sector is the farthest skin sample in that sector and slab (a radial hull), so it
    bridges the gaps between the toes and never dips into them. The heel and mid-foot stay on the
    boot shell, which is smooth there."""
    c, ax, ft0, ft1 = axes[sx]
    me = Bd.ob.data
    co = [v.co for v in me.vertices]
    ts = ft0 + (ft1 - ft0) * BOOT["split"] - BOOT["overlap"]
    pts = []
    for p in me.polygons:
        if p.center.x * sx <= 0 or (p.center - c).dot(ax) < ts - 0.01:
            continue
        if sum(Bd.masks[i]["foot"] for i in p.vertices) / len(p.vertices) < 0.3:
            continue
        vs = list(p.vertices)
        pts.append(p.center.copy())
        for k, i in enumerate(vs):
            pts.append(co[i].copy())
            pts.append((co[i] + co[vs[(k + 1) % len(vs)]]) / 2)
    P = np.array([q[:] for q in pts])
    A = np.array(ax[:])
    c = np.array(c[:])
    tp = (P - c) @ A
    t0, t1 = ts, tp.max()
    side = V((sx, 0, 0))
    up = ax.cross(side).normalized()
    if up.z < 0:
        up = -up
    side = up.cross(ax).normalized()
    Up, Sd = np.array(up[:]), np.array(side[:])
    nr, nseg = BOOT["rings"], BOOT["seg"]
    rel = P - c - np.outer(tp, A)
    ang = np.arctan2(rel @ Sd, rel @ Up)
    rad = np.sqrt((rel ** 2).sum(1))
    step = (t1 - t0) / nr
    R = np.full((nr + 1, nseg), np.nan)
    for i in range(nr + 1):
        ti = t0 + step * i
        m = np.abs(tp - ti) < step * 0.9
        for j in range(nseg):
            a = 2 * math.pi * j / nseg
            da = np.abs((ang[m] - a + math.pi) % (2 * math.pi) - math.pi)
            w = da < math.radians(BOOT["sector_deg"])
            if w.any():
                R[i, j] = rad[m][w].max()
    # fill empty sectors from their neighbours
    for i in range(nr + 1):
        row = R[i]
        if np.isnan(row).all():
            row[:] = 0.02
        for _ in range(nseg):
            nanm = np.isnan(row)
            if not nanm.any():
                break
            with np.errstate(all="ignore"):
                nb = np.fmax(np.roll(row, 1), np.roll(row, -1))
            row[nanm] = nb[nanm]
    rings = [(V(c[:]) + ax * float(t0 + step * i),
              [(up * math.cos(2 * math.pi * j / nseg) + side * math.sin(2 * math.pi * j / nseg)).normalized()
               for j in range(nseg)]) for i in range(nr + 1)]
    R0 = R.copy()
    for _ in range(BOOT["smooth"]):
        R = 0.5 * R + 0.25 * (np.roll(R, 1, 1) + np.roll(R, -1, 1))
        R[1:-1] = 0.5 * R[1:-1] + 0.25 * (R[:-2] + R[2:])
        R = np.maximum(R, R0 * 0.97)          # smoothing may round it, never sink into the skin
    bm = bmesh.new()
    vs = []
    for i, (o, dirs) in enumerate(rings):
        vs.append([bm.verts.new(o + d * (R[i, j] + BOOT["foot"])) for j, d in enumerate(dirs)])
    for i in range(nr):
        for j in range(nseg):
            bm.faces.new((vs[i][j], vs[i][(j + 1) % nseg], vs[i + 1][(j + 1) % nseg], vs[i + 1][j]))
    # rounded caps: heel and toe
    for i, sgn in ((nr, 1),):
        o = rings[i][0]
        cap = bm.verts.new(o + ax * sgn * float(R[i].mean()) * 0.55)
        for j in range(nseg):
            a, b = vs[i][j], vs[i][(j + 1) % nseg]
            bm.faces.new((b, a, cap) if sgn > 0 else (a, b, cap))
    bm.normal_update()
    for f in bm.faces:            # open at the heel end: outward normals by hand
        cc = f.calc_center_median()
        tt = (cc - V(c[:])).dot(ax)
        radial = cc - (V(c[:]) + ax * tt)
        out = ax if (tt > t1 - 0.002 or radial.length < 0.004) else radial
        if f.normal.dot(out) < 0:
            f.normal_flip()
    # never below the floor, and a gold toe cap
    for v in bm.verts:
        v.co.z = max(v.co.z, 0.0005)
    for f in bm.faces:
        tt = (f.calc_center_median() - V(c[:])).dot(ax)
        f.material_index = 1 if tt > t1 - (t1 - t0) * BOOT["toe_cap"] else 0
    return bm


def boots_v2(Bd, top_z):
    """v2 boots: shell over the leg, heel and mid-foot + a toe-free forefoot envelope + a gold cuff"""
    from rosace import outfit
    from rosace.geo import bm_to_object, copy_weights_nearest
    axes = {sx: foot_axis(Bd, sx) for sx in (1, -1)}

    def region(p, m):
        return (((m["legL"] + m["legR"]) > 0.5 and p.z < top_z) or m["foot"] > 0.3) and not forefoot(Bd, p, axes)

    def seeds(bm):
        return [v for v in bm.verts if v.is_boundary and v.co.z > top_z - 0.03]
    shaft = outfit.shell(Bd, "boots", region, BOOT["shell"], ["boot", "gold"], trim=0.012, part="boots",
                         trim_seeds=seeds, subdiv=2)
    for sx, S in ((1, "L"), (-1, "R")):
        foot = bm_to_object(f"boot_foot.{S}", boot_foot(Bd, Bd.arm, sx, axes), ["boot", "gold"], arm=Bd.arm,
                            part="boots")
        # own side's leg bones only: nearest-surface transfer across the feet gave one vertex the
        # other foot's weights (a spike in the Q stamp)
        copy_weights_nearest(foot, Bd.ob, only={g.name for g in Bd.ob.vertex_groups
                                                if f"_{S}_" in g.name and any(k in g.name for k in ("Foot", "Toe", "LowerLeg"))})
    # gold cuff band at the boot top, just outside the shaft
    cz = top_z - BOOT["cuff_half"] - 0.002

    def cuff_region(p, m):
        return (m["legL"] + m["legR"]) > 0.6 and abs(p.z - cz) < BOOT["cuff_half"]
    cuff = outfit.shell(Bd, "boot_cuffs", cuff_region, BOOT["cuff"], ["gold", "gold"], part="gold_harness", subdiv=2)
    return shaft


# ---------------------------------------------------------------------------- veil
def _veil_clear(veil, hair_obs, C):
    """push the veil's base surface outside the hair: per vertex, the outermost hair surface along
    the direction from the head's core (radial on the skull, horizontal below it)"""
    verts, polys = [], []
    for ob in hair_obs:
        M = ob.matrix_world
        b = len(verts)
        verts += [M @ v.co for v in ob.data.vertices]
        polys += [[b + i for i in p.vertices] for p in ob.data.polygons]
    bvh = BVHTree.FromPolygons(verts, polys)
    me = veil.data
    push = []
    for v in me.vertices:
        p = v.co
        core = V((0.0, C.y, min(p.z, C.z)))
        d = p - core
        if d.length < 1e-6:
            push.append(0.0)
            continue
        d.normalize()
        hit = bvh.ray_cast(core + d * 0.6, -d, 0.6)
        need = 0.0
        if hit[0] is not None:
            need = max(0.0, (hit[0] - core).dot(d) + VEIL_CLEAR - (p - core).dot(d))
        push.append(need)
    # spread the push to the neighbours so the veil moves as cloth, not in dents
    nb = [[] for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    P = push[:]
    for _ in range(4):
        P = [max(P[i], 0.7 * max((P[j] for j in nb[i]), default=0.0)) for i in range(len(P))]
    moved = 0
    for v, k in zip(me.vertices, P):
        if k > 0:
            core = V((0.0, C.y, min(v.co.z, C.z)))
            v.co = v.co + (v.co - core).normalized() * k
            moved += 1
    me.update()
    return {"moved": moved, "max_push_mm": round(max(P) * 1000, 1)}


# veil shape (v1 hair.build_veil: top_el 62, az 96-264, radius 1.20-1.24 x the skull ellipsoid,
# centre point 0.10 m): at 144 px that is ~37 x 38 px once pushed clear of the v2 hair; DESIGN 2
# asks 18 x 24. v2 starts lower on the skull (the dark crown shows, DESIGN 1 "a dark head with a
# white veil point"), wraps less of the head and sits closer to it.
VEIL = dict(top_el=44, az0=112, az1=248, k=1.10, k_hang=1.12, point=0.075, folds=0.008)


def build_veil_v2(arm, M, surf):
    """hair.build_veil with the v2 shape (VEIL); same topology, materials, crease folds, gold hem
    and 'veil' chain, so the posing drape and the motion lane's cloth treat it the same"""
    from rosace import rig
    from rosace.common import lerp, smoothstep
    from rosace.geo import bm_to_object, grid_sheet, set_weights
    from rosace.hair import E
    C = M["C"]
    rows = []
    nr, nc = 14, 19
    top_el, bot_z = VEIL["top_el"], M["shoulder_z"] - VEIL_DROP
    for i in range(nr + 1):
        t = i / nr
        row = []
        for j in range(nc + 1):
            u = j / nc
            az = lerp(VEIL["az0"], VEIL["az1"], u)
            if t < 0.45:
                el = lerp(top_el, -15, t / 0.45)
                p = E(M, az, el, VEIL["k"] + 0.02 * t)
            else:
                k = (t - 0.45) / 0.55
                p0 = E(M, az, -15, VEIL["k_hang"])
                sway = math.sin(math.radians(az))
                p = V((p0.x * (1 + 0.06 * k) + sway * 0.012 * k,
                       p0.y + 0.03 * k + 0.02 * k * k,
                       lerp(p0.z, bot_z - VEIL["point"] * (1 - abs(u * 2 - 1)) ** 1.2, k)))
                out_d = V((p.x, p.y - C.y, 0.0))
                if out_d.length > 1e-6:
                    out_d.normalize()
                    p = p + out_d * VEIL["folds"] * k ** 0.8 * math.sin(u * math.pi * 6 + 0.5)
            row.append(p)
        rows.append(row)
    bm = bmesh.new()
    grid_sheet(bm, rows)
    bm.normal_update()
    for f in bm.faces:
        cc = f.calc_center_median()
        if f.normal.dot(cc - V((0, C.y, min(cc.z, C.z)))) < 0:
            f.normal_flip()
    ob = bm_to_object("veil", bm, ["veil", "beige", "lining", "gold"], arm=arm, part="veil")
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
    top = E(M, 180, top_el - 10, VEIL["k"])
    mid = E(M, 180, -15, VEIL["k_hang"])
    low = V((0, mid.y + 0.05, bot_z))
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


def _on_veil(M, az, el, lift=0.013):
    """point on the veil's outer surface in the direction (az, el) from the skull centre"""
    from rosace.hair import E
    from rosace.geo import object_bvh
    veil = bpy.data.objects["veil"]
    bvh, _ = object_bvh([veil])
    C = M["C"]
    d = (E(M, az, el, 1.0) - C).normalized()
    hit = bvh.ray_cast(C + d * 0.6, -d, 0.6)
    if hit[0] is None:
        return E(M, az, el, VEIL["k"] + 0.05), d
    n = hit[1] if hit[1].dot(d) > 0 else -hit[1]
    return hit[0] + n * lift, n


def build_pin_v2(arm, M):
    """hair.build_pin (the gold rose at the crown) placed on the v2 veil's top edge"""
    from rosace.geo import bm_to_object, set_weights
    c, n = _on_veil(M, 146, VEIL["top_el"] - 5)
    bm = bmesh.new()
    u = n.orthogonal().normalized()
    w = n.cross(u)
    ring = [bm.verts.new(c + (u * math.cos(2 * math.pi * k / 16) + w * math.sin(2 * math.pi * k / 16))
                         * 0.026 * (1.0 if k % 2 == 0 else 0.78)) for k in range(16)]
    ctr = bm.verts.new(c + n * 0.008)
    back = bm.verts.new(c - n * 0.006)
    for k in range(16):
        bm.faces.new((ring[k], ring[(k + 1) % 16], ctr))
        bm.faces.new((ring[(k + 1) % 16], ring[k], back))
    ob = bm_to_object("rose_pin", bm, ["gold"], arm=arm, smooth=False, part="gold_hair")
    set_weights(ob, [{"J_Bip_C_Head": 1.0} for _ in ob.data.vertices])
    return ob


def build_veil_pins_v2(arm, M):
    """hair.build_veil_pins (a gold cross each side where the veil's front edge meets the hair)
    on the v2 veil's front edge"""
    from rosace.geo import bm_to_object, plain_cross_outline, polygon_prism, set_weights
    bm = bmesh.new()
    for s, az in ((1, VEIL["az0"] + 5), (-1, 360 - VEIL["az0"] - 5)):
        c, n = _on_veil(M, az, 22, lift=0.004)
        u = V((0, 0, 1)).cross(n).normalized()
        w = n.cross(u).normalized()
        polygon_prism(bm, plain_cross_outline(0.050, 0.012, 0.009, 0.036), c, u, w, n, 0.006)
    ob = bm_to_object("veil_pins", bm, ["gold"], arm=arm, smooth=False, part="gold_hair")
    set_weights(ob, [{"J_Bip_C_Head": 1.0} for _ in ob.data.vertices])
    return ob


def hang_collar_cross(body):
    """v1 lays the collar cross and its indigo backing plate on the sternum. On the v2 bust the
    11 cm plate sinks into the cleavage, the backing disappears and the cross reads as a gold smear
    at 144 (DESIGN 3 row 1, revision 3: the cross needs its dark backing). Hang both in front of
    the bust instead: the plate's back sits PENDANT_GAP in front of the most forward skin under it."""
    from rosace.geo import object_bvh
    plate, cross = bpy.data.objects.get("collar_plate"), bpy.data.objects.get("collar_cross")
    if not plate or not cross:
        return {}
    bvh, _ = object_bvh([body])
    ps = [v.co for v in plate.data.vertices]
    x0, x1 = min(p.x for p in ps), max(p.x for p in ps)
    z0, z1 = min(p.z for p in ps), max(p.z for p in ps)
    z0 = (z0 + z1) / 2            # it rests on the upper slope of the bust, not at the nipple plane
    front = None
    for i in range(9):
        for k in range(9):
            o = V((x0 + (x1 - x0) * i / 8, -1.0, z0 + (z1 - z0) * k / 8))
            hit = bvh.ray_cast(o, V((0, 1, 0)), 2.0)
            if hit[0] is not None:
                front = hit[0].y if front is None else min(front, hit[0].y)
    back = max(p.y for p in ps)
    dy = (front - PENDANT_GAP) - back if front is not None else 0.0
    if dy < 0:
        for ob in (plate, cross):
            for v in ob.data.vertices:
                v.co.y += dy
            ob.data.update()
    # the pixels come from an authored glyph (art/rosace/glyphs/collar_cross_<px>.json, glyphs.py):
    # at 144 a 7 px 3D cross on its plate renders as a gold smear
    cross["glyph"] = "collar_cross"
    return {"moved_forward_mm": round(-dy * 1000, 1) if dy < 0 else 0.0, "glyph": "collar_cross"}


PENDANT_GAP = 0.004


INFO = {}


def _retry_empty_shells(outfit):
    """A narrow band shell (armbands: a 28 mm band across the upper arm) picks whole body faces
    by their CENTRE first; when the faces are bigger than the band, no centre lands in it and the
    shell comes out empty. The Adopt fixes (PIPELINE.md 3.6e) grew the v2 body scale (1.27) and the
    armbands went to 0 vertices. An empty shell is rebuilt once with a coarse pick that also tests
    the centre shifted +-1..3 cm in x and z, and 2 more subdivisions; the final cut on the fine
    mesh is still the garment's own region (build_v1_match.py does the same for v1's bands)."""
    from mathutils import Vector
    orig = outfit.shell
    INFO["empty_retried"] = []

    def shell(Bd, name, region, *a, **k):
        ob = orig(Bd, name, region, *a, **k)
        if ob is not None and len(ob.data.vertices) == 0 and "coarse" not in k:
            me = ob.data
            bpy.data.objects.remove(ob)
            bpy.data.meshes.remove(me)
            shifts = [Vector((dx, 0, dz)) for dx in (0, -.01, .01, -.02, .02, -.03, .03)
                      for dz in (0, -.01, .01, -.02, .02, -.03, .03)]

            def coarse(p, m):
                return any(region(p + s, m) for s in shifts)
            k = dict(k, coarse=coarse)
            k["subdiv"] = k.get("subdiv", 1) + 2
            ob = orig(Bd, name, region, *a, **k)
            INFO["empty_retried"].append({"name": name, "verts": len(ob.data.vertices)})
        return ob
    outfit.shell = shell
    return orig


def build(arm, body, head):
    """hair + veil + pin, then the outfit; returns {'hair': ..., 'outfit': ...}"""
    from rosace import hair, outfit
    orig = (hair.build_veil, hair.build_pin, hair.build_veil_pins, outfit.boots)
    orig_shell = _retry_empty_shells(outfit)

    def veil_v2(arm_, M, surf):
        ob = build_veil_v2(arm_, M, surf)
        hair_obs = [o for o in bpy.data.objects if o.type == "MESH" and
                    (o.name.startswith("hair_clump") or o.name == "hair_cap")]
        INFO["veil"] = _veil_clear(ob, hair_obs, M["C"])
        INFO["veil"]["bottom_z"] = round(M["shoulder_z"] - VEIL_DROP, 4)
        return ob
    hair.build_veil, hair.build_pin, hair.build_veil_pins, outfit.boots = (
        veil_v2, build_pin_v2, build_veil_pins_v2, boots_v2)
    try:
        parts = {"hair": hair.build(arm, head), "outfit": outfit.build(arm, body)}
        INFO["collar_cross"] = hang_collar_cross(body)
    finally:
        hair.build_veil, hair.build_pin, hair.build_veil_pins, outfit.boots = orig
        outfit.shell = orig_shell
    return parts


def report(arm, parts):
    obs = sorted(o.name for o in bpy.data.objects if o.type == "MESH" and not o.hide_render)
    chains = {k: list(v) for k, v in arm.data.get("chains", {}).items()}
    return {"objects": len(obs), "names": obs, "chains": chains, "v2_fixes": INFO,
            "palette_overrides": sorted(PALETTE_OVERRIDES),
            "outfit_levels": {k: round(v, 4) for k, v in arm.get("outfit_levels", {}).items()}}
