"""Route F3 overrides, applied inside Blender after rosace/outfit.py, rosace/outfit_art.py and
rosace/hair_v3.py are imported and before build_rosace_v2.py runs. Those files are not edited:
this module swaps two outfit_art functions for parameterised copies and registers a hair_v3
variant, the same way build_rosace_v2.use_hair swaps the hair builder.

  install(variant_name) -> report dict

The copies keep the object names, parts, chains, materials and anchors of the originals
(tabard, tabard_cross, outfit_tabx_c/t; sleeve.L/R, sleeve_cross.L/R, outfit_slvx_L/R), so poses,
drapes, glyph stamps and the pixel passes treat the result the same.
"""
import copy
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
if PIPE not in sys.path:
    sys.path.insert(0, PIPE)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import bmesh  # noqa: E402
from mathutils import Vector as V  # noqa: E402

import variants as VT  # noqa: E402
from rosace import hair_v3, rig  # noqa: E402
from rosace import outfit as O  # noqa: E402
from rosace import outfit_art as OA  # noqa: E402
from rosace.common import gauss, lerp, smoothstep  # noqa: E402
from rosace.geo import (bm_to_object, chain_weights, fleur_cross_outline, grid_sheet,  # noqa: E402
                        polygon_prism, set_weights)

SLV = dict(VT.SLEEVE_BASE)
TABF = dict(VT.TABARD_BASE)
REPORT = {}


# ---------------------------------------------------------------------------- sleeves
def sleeves_f3(Bd, arm, anchors=False, lip=0.0):
    """outfit_art.sleeves_r2 with its constants as SLV parameters (bell size, horizontal and top
    flare, flute depth, the trumpet lip that turns the indigo lining out, where the flare starts)"""
    P = SLV
    lip = P["lip"] if P.get("lip") is not None else lip
    out = []
    for s in ("L", "R"):
        sh = arm.data.bones[f"J_Bip_{s}_UpperArm"].head_local.copy()
        el = arm.data.bones[f"J_Bip_{s}_LowerArm"].head_local.copy()
        wr = arm.data.bones[f"J_Bip_{s}_Hand"].head_local.copy()
        ax = (wr - sh).normalized()
        x0 = 0.128
        x_el = (el - sh).length
        x_wr = (wr - sh).length
        z_axis, front = V((0, 0, 1)), V((0, -1, 0))

        def point(t, phi, out_=0.0):
            up = math.sin(phi)
            bottom = max(0.0, -up)
            scallop = P["scallop"] * (0.5 + 0.5 * math.cos(phi * 3 + 0.2 + math.pi / 2)) * (0.35 + 0.65 * bottom)
            x_end = x_wr - P["short"] + (P["lip_hang"] + P["short"] - 0.01) * bottom ** 1.3 + scallop
            a = lerp(x0, x_end, t)
            flare = smoothstep(x_el - P["el_off"], x_wr - 0.02, a)
            grow = smoothstep(x0, x_wr, a)
            r_arm = lerp(P["r_arm0"], P["r_arm1"], max(0.0, min(1.0, (a - x0) / (x_el - x0))))
            flute = 1.0 + P["flute"] * math.sin(phi * 3 + 0.2) * grow * (0.35 + 0.65 * bottom)
            rt = (r_arm + P["rt"] * flare) * flute
            rh = (r_arm + P["rh"] * flare) * flute
            rb = (r_arm + P["bell"] * flare ** 1.2) * flute
            lipk = lip * smoothstep(0.82, 1.0, t) ** 2
            rt, rh, rb = rt + lipk, rh + lipk, rb + lipk
            v = up * (rt if up > 0 else rb)
            h = math.cos(phi) * rh
            c = sh + ax * a
            n = (front * math.cos(phi) / max(rh, 1e-4) + z_axis * up / max(rt if up > 0 else rb, 1e-4)).normalized()
            return c + front * h + z_axis * v + n * out_, n, a
        nr, nseg = 22, 30
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
                f.material_index = 2
        ob = bm_to_object(f"sleeve.{s}", bm, ["white", "lining", "gold"], arm=arm, part="sleeves")
        cr = []
        for v in ob.data.vertices:
            i, k = divmod(v.index, nseg)
            phi, t = 2 * math.pi * k / nseg, i / nr
            bottom = max(0.0, -math.sin(phi))
            valley = (-math.sin(phi * 3 + 0.2) - 0.70) / 0.30
            cr.append(max(0.0, valley) * smoothstep(0.10, 0.45, t) * (0.4 + 0.6 * bottom) * P["crease"])
        O.set_crease(ob, cr)
        m = ob.modifiers.new("thick", "SOLIDIFY")
        m.thickness = 0.006
        m.offset = -1.0
        m.material_offset = 1
        m.material_offset_rim = 2
        p0 = el + V((0, 0, -0.05))
        p1 = wr + ax * 0.02 + V((0, 0, -0.14 - 0.5 * (P["bell"] - 0.092)))
        tip = sh + ax * (x_wr + P["lip_hang"]) + V((0, 0, -0.055 - P["bell"]))
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
        pos, n, _ = point(0.93, math.radians(-80), out_=0.004)
        bmx = bmesh.new()
        u = ax - n * ax.dot(n)
        polygon_prism(bmx, fleur_cross_outline(0.075, 0.011, 0.012, 0.05), pos, u.normalized(),
                      n.cross(u).normalized(), n, 0.004)
        crx = bm_to_object(f"sleeve_cross.{s}", bmx, ["gold"], arm=arm, smooth=False, part="sleeves")
        cw = [chain_weights(v.co, [p0, p1, tip], names, None, 0.0) for v in crx.data.vertices]
        set_weights(crx, cw)
        out.append(crx)
        if anchors:
            out.append(OA.anchor(arm, f"outfit_slvx_{s}", pos + n * 0.004, cw[0], bone=f"J_Bip_{s}_LowerArm"))
    OA.LOG["sleeves"] = {"r2": True, "f3": dict(P, lip=lip)}
    return out


# ---------------------------------------------------------------------------- tabard
def tabard_f3(Bd, arm, lining="white", fold=1, hem2=False, tabx=False):
    """outfit_art.tabard_r2 with TABF parameters: length (bot_t between knee and ankle), width,
    point depth, the break-plane turn, one pipe fold per side from the hip band (pipes, with a
    crease in its valley), and an optional slit from slit_t down that splits the hem into two
    pointed tails (the slit edges get the gold border)"""
    P = TABF
    T = dict(OA.TAB, brk=0.52, turn=P["turn"], bulge=P["bulge"], w_top=P["w_top"], w_bot=P["w_bot"],
             v_point=P["v_point"])
    top = Bd.hipj + 0.02
    bot = lerp(Bd.knee, Bd.ankle, P["bot_t"])
    nr, nc = T["rows"], T["cols"]
    nr = int(round(nr * (P["bot_t"] + 0.9) / (0.52 + 0.9)))       # keep the row pitch as the tabard grows
    slit_t, slit_w = P.get("slit_t"), P["slit_w"]
    yline, ymin = [], 0.0
    for i in range(nr + 1):
        z = lerp(top, bot, i / nr)
        w = lerp(T["w_top"], T["w_bot"], i / nr)
        fy = Bd.front_y(z, -w - 0.03, w + 0.03, default=ymin) - 0.018
        ymin = min(ymin, fy) if i else fy
        yline.append(ymin)

    def half_w(t):
        return lerp(T["w_top"], T["w_bot"], smoothstep(0.0, 1.0, t) ** T["flare"])

    def depth(u, t):
        su = u * fold
        d = T["bulge"] * (1 - u * u)
        open_ = 0.30 + 0.70 * smoothstep(0.02, 0.85, t)
        d -= T["turn"] * open_ * max(0.0, (-su - T["brk"]) / (1 - T["brk"]))
        d -= 0.010 * smoothstep(0.80, 1.0, su) ** 1.5
        if P["pipes"]:
            # one pipe fold per side, from the hip band (CL-P01) opening toward the hem: a valley at
            # pipe_u and a ridge outboard of it (tabard_r1's profile)
            a = abs(u)
            amp = P["pipes"] * smoothstep(0.05, 0.95, t)
            d += amp * (-gauss(a, P["pipe_u"], 0.07) + 0.55 * gauss(a, P["pipe_u"] + 0.2, 0.08))
        return d

    def hem_profile(u):
        a = abs(u)
        if slit_t is None:
            return 1 - a                               # one point on the centre line (ref 14)
        uc, hw = (slit_w + 1) / 2, (1 - slit_w) / 2     # a point at the middle of each tail
        return max(0.0, 1 - abs(a - uc) / hw)

    rows = []
    for i in range(nr + 1):
        t = i / nr
        z = lerp(top, bot, t)
        w = half_w(t)
        row = []
        for j in range(nc + 1):
            u = j / nc * 2 - 1
            x = u * w                                   # tabard_r2's 'narrow' is 0 in the build
            if slit_t is not None and t > slit_t:
                # the tails part a little as they fall, so the slit reads as a gap, not a line
                x += (1 if u > 0 else -1 if u < 0 else 0) * 0.012 * smoothstep(slit_t, 1.0, t)
            zz = z - T["v_point"] * hem_profile(u) * smoothstep(0.55, 1.0, t)
            row.append(V((x, yline[i] - depth(u, t), zz)))
        rows.append(row)
    bm = bmesh.new()
    grid_sheet(bm, rows)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()
    slit_rows = set()
    if slit_t is not None:
        kill = []
        bm.verts.index_update()
        for f in bm.faces:
            ids = [v.index for v in f.verts]
            cols = [k % (nc + 1) for k in ids]
            rws = [k // (nc + 1) for k in ids]
            if min(rws) / nr >= slit_t and all(abs(c / nc * 2 - 1) <= slit_w + 1e-6 for c in cols):
                kill.append(f)
                slit_rows.update(rws)
        bmesh.ops.delete(bm, geom=kill, context="FACES_ONLY")
        loose = [v for v in bm.verts if not v.link_faces]
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    ob = bm_to_object("tabard", bm, ["white", "gold", lining, "gold"], arm=arm, part="tabard")
    me = ob.data
    # recover (row, col) from the position: rows by z order is unreliable after the hem shaping, so
    # match each vertex to the nearest grid point
    grid = {(i, j): rows[i][j] for i in range(nr + 1) for j in range(nc + 1)}
    from mathutils import kdtree
    kd = kdtree.KDTree(len(grid))
    keys = list(grid)
    for n_, k in enumerate(keys):
        kd.insert(grid[k], n_)
    kd.balance()
    rc = []
    for v in me.vertices:
        _, n_, _ = kd.find(v.co)
        rc.append(keys[n_])
    cr = []
    for (i, j) in rc:
        u, t = j / nc * 2 - 1, i / nr
        c = 0.35 * gauss(-u * fold, T["brk"], 0.035) * smoothstep(0.25, 0.6, t)
        if P["pipe_crease"]:
            c = max(c, P["pipe_crease"] * gauss(abs(u), P["pipe_u"], 0.05) * smoothstep(0.12, 0.45, t))
        cr.append(c)
    O.set_crease(ob, cr)
    for p in me.polygons:
        cols = [rc[k][1] for k in p.vertices]
        rws = [rc[k][0] for k in p.vertices]
        edge = min(cols) <= 1 or max(cols) >= nc - 1 or max(rws) >= nr
        if slit_t is not None and max(rws) / nr > slit_t:
            # the slit's own edges: the column next to the cut, and the row just above its top
            cu = [abs(c / nc * 2 - 1) for c in cols]
            if min(cu) <= slit_w + 2.0 / nc + 1e-6:
                edge = True
        if edge:
            p.material_index = 1
        elif hem2 and min(rws) == nr - 4 and 3 <= min(cols) and max(cols) <= nc - 3:
            p.material_index = 1
    for v in me.vertices:
        v.co.y -= 0.007
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.007
    m.offset = -1.0
    m.material_offset = 2
    m.material_offset_rim = 2 if lining != "white" else 1
    pts = [V((0, yline[int(nr * k / 4)], lerp(top, bot, k / 4))) for k in range(5)]
    pts[-1].z -= 0.06
    names = rig.add_chain(arm, "tabard", pts, "J_Bip_C_Hips")
    set_weights(ob, [chain_weights(v.co, pts, names, "J_Bip_C_Hips", 0.5) for v in me.vertices])
    tc = P["cross_t"] if P.get("cross_t") is not None else (0.74 if hem2 else 0.78)
    zc = lerp(top, bot, tc)
    iy = int(nr * tc)
    bmx = bmesh.new()
    polygon_prism(bmx, fleur_cross_outline(T["cross_h"], T["cross_arm"], T["cross_bar"], T["cross_w"]),
                  V((0.006 * fold, yline[iy] - T["bulge"] - 0.007 - 0.006, zc)),
                  V((1, 0, 0)), V((0, 0, 1)), V((0, -1, 0)), 0.004)
    cr_ob = bm_to_object("tabard_cross", bmx, ["gold"], arm=arm, smooth=False, part="tabard")
    set_weights(cr_ob, [chain_weights(v.co, pts, names, "J_Bip_C_Hips", 0.5) for v in cr_ob.data.vertices])
    if tabx:
        cr_ob.hide_render = True
        yc = yline[iy] - T["bulge"] - 0.007 - 0.004
        bone = names[min(len(names) - 1, 2 if tc > 0.5 else 1)]
        for nm, dz in (("outfit_tabx_c", 0.0), ("outfit_tabx_t", 0.06)):
            q = V((0.006 * fold, yc, zc + dz))
            OA.anchor(arm, nm, q, chain_weights(q, pts, names, "J_Bip_C_Hips", 0.5), bone=bone)
        OA.LOG["tabard_cross"] = {"stamp": True, "bone": bone}
    OA.LOG["tabard"] = {"r2": True, "fold": fold, "hem2": hem2, "lining": lining, "brk": T["brk"], "f3": dict(P),
                        "rows": nr, "len_m": round(top - bot + T["v_point"], 4)}
    return ob, cr_ob


# ---------------------------------------------------------------------------- hair
def hair_variant(over):
    """r2f (the integrated hair pick) with F3's volume overrides, registered as hair_v3 variant 'f3'"""
    H = copy.deepcopy(hair_v3.VARIANTS["r2f"])
    over = copy.deepcopy(over)
    sc = over.pop("scale", {})
    base = hair_v3.SPEC
    if sc.get("mantle_w"):
        H["mantle"] = [(az, w * sc["mantle_w"]) for az, w in H.get("mantle", base["mantle"])]
    if sc.get("layer_w"):
        H["layers"] = [(az, w * sc["layer_w"], d) for az, w, d in H.get("layers", base["layers"])]
    if sc.get("tail_w") or sc.get("tail_dx"):
        H["tail"] = [(dx * sc.get("tail_dx", 1.0), w * sc.get("tail_w", 1.0), dl)
                     for dx, w, dl in H.get("tail", base["tail"])]
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(H.get(k), dict):
            H[k] = dict(H[k], **v)
        else:
            H[k] = v
    hair_v3.VARIANTS["f3"] = H
    return H


def install(name):
    V_ = VT.get(name)
    REPORT.clear()
    REPORT["variant"] = name
    if "sleeve" in V_:
        SLV.update(V_["sleeve"])
        # outfit.SLEEVE_* are read by other code (the chain tip in the originals, drapes): keep them in step
        O.SLEEVE_BELL, O.SLEEVE_LIP, O.SLEEVE_SHORT = SLV["bell"], SLV["lip_hang"], SLV["short"]
        OA.sleeves_r2 = sleeves_f3
        REPORT["sleeve"] = dict(SLV)
    if "tabard" in V_:
        TABF.update(V_["tabard"])
        OA.tabard_r2 = tabard_f3
        REPORT["tabard"] = dict(TABF)
    if "hair" in V_:
        hair_variant(V_["hair"])
        os.environ["ROSACE_HAIR"] = "f3"
        REPORT["hair"] = V_["hair"]
    return REPORT
