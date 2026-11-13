"""Outfit art lane, round 1 (2026-09-29): variants of the outfit pieces, picked by the flags in
ROSACE_OUTFIT (e.g. "tab+wht"). outfit.build() hands over here for any variant but "r0" (the
pre-lane outfit). Each flag changes one axis, so a round can A/B one thing at a time:

  tab    tabard, construction first: a flared panel (DESIGN 2: 11 x 51 px at 144, ref 14's
         front panel widening to the hem), a flat centre for the cross, two pipe folds that start
         at the hip band (the tension points, CL-P01) and deepen toward the hem, side planes rolled
         back so they turn away from the key light (a designed W3 plane, not a ramp band), a deeper
         V hem; creases only in the two valleys
  tabw   'tab' with a white lining (the back of the panel): the indigo lining merged with the
         dark thigh-highs behind the legs (PIPELINE 3.6c, open) and read as a third leg
  wht    white cloth value plan (PX-P25): W1 only on the strongly lit planes, W2 the base, W3 the
         shadow side from 0.12, W4 only in occlusion and creases
  whts   'wht' with W1 as a specular only (a highlight, never a base)
  trim   gold that reaches a pixel: trims and straps sized to >= 1 px at 144 and ~1 px at 80
         (bodice trim 13.5 -> 19 mm, belt and bands 19 -> 24 mm, straps 1.5x)
  win    the chest window below the collar pendant: wider and lower, so the diamond of skin
         reads under the cross at 144 (DESIGN 3 row 2)
  col    the collar at DESIGN size (7-8 px at 144) with a gold base band on a W4 step, so the
         collar and the bodice don't melt into one white mass (CL-P03)

Every flag keeps the object names, parts, chains and materials of r0, so poses, drapes, glyphs
and the post-process treat the result the same.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import outfit as O
from . import rig
from .common import gauss, lerp, smoothstep
from .geo import (bm_to_object, catmull, chain_weights, copy_weights_nearest, fleur_cross_outline,
                  grid_sheet, polygon_prism, set_weights, tube)

V = Vector
LOG = {}


def log(*a):
    print("[outfit_art]", *a, flush=True)


# ---------------------------------------------------------------------------- tabard
TAB = dict(w_top=0.060, w_bot=0.092, flare=0.85, bulge=0.012, fold_valley=0.46, fold_ridge=0.70,
           fold_a0=0.003, fold_a1=0.017, roll=0.022, v_point=0.105, cols=24, rows=32,
           crease=0.85, cross_h=0.18, cross_arm=0.026, cross_bar=0.036, cross_w=0.105)


def tabard_r1(Bd, arm, lining="lining"):
    """the front tabard: a flared panel with designed pipe folds (see the module doc, 'tab')"""
    T = TAB
    top = Bd.hipj + 0.02
    bot = lerp(Bd.knee, Bd.ankle, 0.52)      # mid-shin (DESIGN 2)
    nr, nc = T["rows"], T["cols"]
    yline, ymin = [], 0.0
    for i in range(nr + 1):
        z = lerp(top, bot, i / nr)
        w = lerp(T["w_top"], T["w_bot"], i / nr)
        fy = Bd.front_y(z, -w - 0.03, w + 0.03, default=ymin) - 0.018
        ymin = min(ymin, fy) if i else fy
        yline.append(ymin)

    def half_w(t):
        return lerp(T["w_top"], T["w_bot"], smoothstep(0.0, 1.0, t) ** T["flare"])

    def fold_amp(t):
        # the folds start at the hip band (tension points) and open toward the hem
        return T["fold_a0"] + T["fold_a1"] * smoothstep(0.05, 0.95, t)

    def depth(u, t):
        a = abs(u)
        d = T["bulge"] * (1 - u * u)
        d += fold_amp(t) * (-gauss(a, T["fold_valley"], 0.075) + 0.55 * gauss(a, T["fold_ridge"], 0.08))
        d -= T["roll"] * smoothstep(0.74, 1.0, a) ** 1.5      # side planes turn back
        return d

    rows = []
    for i in range(nr + 1):
        t = i / nr
        z = lerp(top, bot, t)
        w = half_w(t)
        row = []
        for j in range(nc + 1):
            u = j / nc * 2 - 1
            # the pipe folds pull the cloth in a little where they open (the hem swings wider
            # between them), so the outline waves instead of running as a straight board edge
            x = u * w * (1 + 0.05 * math.sin(abs(u) * math.pi) * smoothstep(0.4, 1.0, t))
            zz = z - T["v_point"] * (1 - abs(u)) * smoothstep(0.55, 1.0, t)
            row.append(V((x, yline[i] - depth(u, t), zz)))
        rows.append(row)
    bm = bmesh.new()
    grid_sheet(bm, rows)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()
    ob = bm_to_object("tabard", bm, ["white", "gold", lining, "gold"], arm=arm, part="tabard")
    me = ob.data
    cr = []
    for v in me.vertices:
        i, j = divmod(v.index, nc + 1)
        u, t = j / nc * 2 - 1, i / nr
        # a crease only in the two valleys: two dark lines from the hip band to the hem
        # ~1.3 px wide at 144 where the fold is open (sigma 0.06 of the half-width): a 1-column
        # crease (r1 first try, sigma 0.035) fell under a pixel and never reached the deep band
        cr.append(T["crease"] * gauss(abs(u), T["fold_valley"], 0.06) * smoothstep(0.12, 0.45, t))
    O.set_crease(ob, cr)
    for p in me.polygons:
        cols = [k % (nc + 1) for k in p.vertices]
        rws = [k // (nc + 1) for k in p.vertices]
        if min(cols) <= 1 or max(cols) >= nc - 1 or max(rws) >= nr:
            p.material_index = 1
    for v in me.vertices:
        v.co.y -= 0.007
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.007
    m.offset = -1.0
    m.material_offset = 2
    m.material_offset_rim = 1
    pts = [V((0, yline[int(nr * k / 4)], lerp(top, bot, k / 4))) for k in range(5)]
    pts[-1].z -= 0.06
    names = rig.add_chain(arm, "tabard", pts, "J_Bip_C_Hips")
    set_weights(ob, [chain_weights(v.co, pts, names, "J_Bip_C_Hips", 0.5) for v in me.vertices])
    # the fleur-cross on the flat centre, near the hem, in front of the centre bulge
    tc = 0.78
    zc = lerp(top, bot, tc)
    iy = int(nr * tc)
    bmx = bmesh.new()
    polygon_prism(bmx, fleur_cross_outline(T["cross_h"], T["cross_arm"], T["cross_bar"], T["cross_w"]),
                  V((0, yline[iy] - T["bulge"] - 0.007 - 0.006, zc)),
                  V((1, 0, 0)), V((0, 0, 1)), V((0, -1, 0)), 0.004)
    cr_ob = bm_to_object("tabard_cross", bmx, ["gold"], arm=arm, smooth=False, part="tabard")
    set_weights(cr_ob, [chain_weights(v.co, pts, names, "J_Bip_C_Hips", 0.5) for v in cr_ob.data.vertices])
    LOG["tabard"] = {"w_top": T["w_top"], "w_bot": T["w_bot"], "top": round(top, 4), "bot": round(bot, 4),
                     "lining": lining}
    return ob, cr_ob


# ---------------------------------------------------------------------------- bodice
def bodice_r1(Bd, trim=0.0135, win=None):
    """outfit.bodice with the trim width and the chest window as parameters"""
    WRAP = O.BODICE_WRAP
    zc = Bd.bust.z
    z_top = Bd.neck - 0.005
    z_arm = Bd.shoulder.z - 0.07
    z_waist = zc - 0.14
    z_low = Bd.hipj - 0.01
    if win:
        win_top, win_bot, win_w, win_mid = z_top - win["top"], zc - win["bot"], win["w"], zc - win["mid"]
    else:
        win_top, win_bot, win_w = z_top - 0.012, zc - 0.095, 0.052
        win_mid = zc + 0.005
    LOG["bodice"] = {"z_top": round(z_top, 4), "bust_z": round(zc, 4), "win": [round(win_top, 4), round(win_mid, 4),
                                                                              round(win_bot, 4), win_w], "trim": trim}

    def front_half_angle(z):
        if z > z_top:
            return 0.0
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
            if win_bot < p.z < win_top:
                h = (win_top - p.z) / (win_top - win_mid) if p.z > win_mid else (p.z - win_bot) / (win_mid - win_bot)
                if abs(p.x) < win_w * max(0.0, min(1.0, h)) ** 0.85:
                    return False
            return True
        if 180 - abs(th) < back_half_angle(p.z):
            return True
        return False
    return O.shell(Bd, "bodice", region, 0.0065, ["white", "gold"], trim=trim, part="bodice")


# ---------------------------------------------------------------------------- bands
def band(Bd, name, zfun, half, off, part, arm_max=0.1, need=None):
    def region(p, m):
        if need and not need(p, m):
            return False
        return abs(p.z - zfun(p)) < half and m["arm"] < arm_max
    return O.shell(Bd, name, region, off, ["gold", "gold"], part=part)


def garter_belt_r1(Bd, half=0.0095):
    zs = Bd.hipj + 0.062

    def zline(th):
        a = abs(th)
        return zs - 0.022 * gauss(a, 180, 30) - 0.035 * gauss(a, 0, 35) + 0.010 * gauss(a, 90, 30)

    def region(p, m):
        if p.z < zs - 0.09 or p.z > zs + 0.05:
            return False
        th = Bd.theta(p)
        return abs(p.z - zline(th)) < half and m["arm"] < 0.1
    return O.shell(Bd, "garter_belt", region, 0.0065, ["gold", "gold"], part="gold_harness"), zline


def midback_strap_r1(Bd, half=0.0085):
    z0 = Bd.bust.z - 0.125

    def region(p, m):
        if m["arm"] > 0.3 or abs(p.z - z0 + 0.012 * math.cos(math.radians(Bd.theta(p)))) > half:
            return False
        return abs(Bd.theta(p)) > 60
    return O.shell(Bd, "midback_strap", region, 0.0055, ["gold", "gold"], part="gold_harness")


def thigh_bands_r1(Bd, z, half=0.009):
    def region(p, m):
        return (m["legL"] + m["legR"]) > 0.7 and abs(p.z - z) < half
    return O.shell(Bd, "thigh_bands", region, 0.0065, ["gold", "gold"], part="gold_harness")


def stockings_r1(Bd, top_z, bottom_z, trim=0.012):
    def region(p, m):
        return (m["legL"] + m["legR"]) > 0.6 and bottom_z < p.z < top_z and m["arm"] < 0.1

    def seeds(bm):
        return [v for v in bm.verts if v.is_boundary and v.co.z > top_z - 0.03]
    ob = O.shell(Bd, "stockings", region, 0.0028, ["stocking", "gold"], trim=trim, part="stockings",
                 trim_seeds=seeds)
    cr = []
    for v in ob.data.vertices:
        p = v.co
        back = smoothstep(0.0, 0.04, p.y - 0.01)
        cr.append(0.75 * gauss(p.z, Bd.knee + 0.01, 0.018) * back)
    O.set_crease(ob, cr)
    return ob


# ---------------------------------------------------------------------------- collar
def collar_r1(Bd, arm, tall=True, base_band=True, foot=0.032, foot_r=0.060, top_gap=0.018):
    """the stand collar at DESIGN size: 7-8 px at 144 in front (the r0 collar dipped to ~4 px so
    the neck showed; a tall collar is the priest read of ref 14), a gold top band and, with
    base_band, a narrow gold band where it meets the bodice, stepped out so the post-process
    draws a W4 line under it (CL-P03)"""
    n = arm.data.bones["J_Bip_C_Neck"]
    base = n.head_local.copy()
    zb = base.z - (foot if tall else 0.018)
    zt_front, zt_back = (Bd.chin - top_gap, Bd.chin + 0.036) if tall else (Bd.chin - 0.030, Bd.chin + 0.030)
    bm = bmesh.new()
    nseg, nr = 24, 9
    rings = []
    for i in range(nr):
        t = i / (nr - 1)
        ring = []
        for k in range(nseg):
            a = 2 * math.pi * k / nseg
            back = (1 - math.cos(a)) / 2
            zt = lerp(zt_front, zt_back, back ** 1.5)
            z = lerp(zb, zt, t)
            # a flared foot (the collar stands out of the yoke), then the column, then a lip
            r = lerp(foot_r, 0.043, smoothstep(0, 0.40, t)) + 0.005 * t
            cy = base.y + 0.004
            ring.append(bm.verts.new(V((math.sin(a) * r * 1.02, cy - math.cos(a) * r * 0.98, z))))
        rings.append(ring)
    for i in range(nr - 1):
        for k in range(nseg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % nseg], rings[i + 1][(k + 1) % nseg], rings[i + 1][k]))
    ob = bm_to_object("collar", bm, ["white", "gold"], arm=arm, part="collar")
    me = ob.data
    for p in me.polygons:
        ri = min(p.vertices) // nseg
        if ri >= nr - 2 or (base_band and ri == 0):
            p.material_index = 1
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.005
    m.offset = 1.0
    set_weights(ob, [{"J_Bip_C_Neck": 1.0} if v.co.z > base.z + 0.02 else
                     {"J_Bip_C_Neck": 0.5, "J_Bip_C_UpperChest": 0.5} for v in me.vertices])
    LOG["collar"] = {"front_h_px144": round((zt_front - zb) * 75.97, 1), "back_h_px144": round((zt_back - zb) * 75.97, 1)}
    # round 2b: where the collar's front face is, for the cross at the throat ('ccol')
    rm = 0.043 + 0.005 * 0.5
    COLLAR.update(zb=zb, zt=zt_front, y_front=base.y + 0.004 - rm * 0.98 - 0.005)
    return ob


COLLAR = {}


# ---------------------------------------------------------------------------- straps
def scale_tubes(ob, k):
    """thicken a tube object (garter / halter straps) about each vertex ring's centre"""
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    # each tube ring: vertices sharing a ring have a common centre; approximate with the
    # nearest-neighbour average of 6 (nseg) vertices by index order (tube() writes rings in order)
    vs = list(bm.verts)
    n = 6
    for i in range(0, len(vs) - n + 1, n):
        ring = vs[i:i + n]
        c = sum((v.co for v in ring), V()) / n
        for v in ring:
            v.co = c + (v.co - c) * k
    bm.to_mesh(me)
    bm.free()


# ============================================================================ round 2
# Round 2 (2026-09-29, after the round-2 critique, 5.5/10): the flags below each answer one
# critique line. The pixel-exact details that a render cannot hold (the chest window, the hip
# rose, the sleeve corner crosses, the stocking welt, the thigh squeeze, the clip dots) are drawn
# by tools/pixel-pipeline/outfit_px2.py on projected anchors; the build only places the anchors.
#
#   win0   no 3D chest window (the bodice closes); the window is an authored stamp at two anchors
#          on the centre line under the collar cross (DESIGN 3 row 2: 5x9 front, 3x9 three-quarter)
#   anc    the anchors: outfit_win_t / outfit_win_b (window top and bottom on the sternum),
#          outfit_rose_f / outfit_rose_b (hip-band medallions), outfit_slvx_L/R (sleeve corners)
#   gar2   garter straps re-routed: the front pair to the outer front of each thigh (they ran over
#          the inner thigh and read as scribble across the crotch in N1 and Q), the back pair
#          diagonally over each cheek (a vertical box in the back view); straight, 2 per thigh
#   nochm  no cross charms under the thigh bands (1x2 px dirt at 144; the critique: 'don't read')
#   thb    the thigh bands as their own part ('gold_thigh') so the pixel pass finds the attach
#          points, the welt and the squeeze
#   belt2  a shallower front dip of the hip band (the V pointed the eye at the crotch)
#   tabf   one lengthwise fold break on the tabard (a lit plane and a shadow plane) instead of two
#          symmetric pipe folds; tabf- puts the shadow plane on the other side
#   hem2   a second gold line parallel to the tabard's V hem (the hem motif of ref 09's panels)
#   tabd   the tabard's back in the lining (dark), so the leg gap stays dark in back views
#   slv    sleeves: 3 flutes and fold lines from the cuff to the bell mouth, the corner cross on
#          the lowest corner (the hanging lip)
#   thg    thong as a narrow wedge: gold edges only near the hip band, a 2 px strap into the gap
#   glute  skin creases: a shadow under each glute and a deeper crease (outfit.body_creases r2)
#   mat2   stocking matte (I3/I2 with a thin I1 core, no streak), boot a step darker (I4/I3) with
#          a sharp I0 streak, the lining I4/I3 (the sleeve mouth reads as an I3 crescent)
#   wht3   white in three tones: W1 lit, W2 a real mid band, W3/W4 shadow

def anchor(arm, name, pos, weights, bone="J_Bip_C_UpperChest"):
    """an invisible 3-vertex mesh whose posed centre posing.anchors projects as 'glyph_<name>'
    (glyphs.py prints 'no stamp' and skips it; outfit_px2.py reads it from meta.json)"""
    bm = bmesh.new()
    for d in (V((0.001, 0, 0)), V((-0.001, 0, 0)), V((0, 0, 0.001))):
        bm.verts.new(pos + d)
    bm.faces.new(bm.verts)
    ob = bm_to_object("anchor_" + name, bm, ["skin"], arm=arm, part="anchor")
    set_weights(ob, [dict(weights)] * 3)
    ob["glyph"] = name
    ob["glyph_bone"] = bone
    ob.hide_render = True
    ob["no_ao"] = True
    return ob


def fittings_r2(Bd, arm, zline, thigh_z, flags):
    """outfit.fittings with the round-2 changes (gar2, nochm, anc); same object and part names"""
    obs = []
    nb = arm.data.bones["J_Bip_C_Neck"].head_local.copy()
    # collar cross + its backing plate (unchanged; refit.hang_collar_cross moves both forward)
    zc = nb.z - 0.018 - 0.05
    zc_win = zc
    cc = V((0, Bd.front_y(zc, -0.012, 0.012, default=nb.y - 0.06) - 0.012, zc))
    size = (0.100, 0.021, 0.019, 0.070)
    if "ccol" in flags and COLLAR:
        # round 2b (critique 13a): the cross on the collar's centre line at the throat, not hung
        # in front of the bust (in the three-quarter idle the pendant projected 6-7 px right of
        # and below the throat, a brooch on the far breast); sized inside the 7x7 glyph
        zc = lerp(COLLAR["zb"], COLLAR["zt"], 0.42)
        cc = V((0, COLLAR["y_front"] - 0.006, zc))
        size = (0.066, 0.014, 0.013, 0.046)
    bm = bmesh.new()
    polygon_prism(bm, fleur_cross_outline(*size), cc,
                  V((1, 0, 0)), V((0, 0, 1)), V((0, -1, 0)), 0.005)
    ob = bm_to_object("collar_cross", bm, ["gold"], arm=arm, smooth=False, part="collar_cross")
    set_weights(ob, [{"J_Bip_C_UpperChest": 1.0} for _ in ob.data.vertices])
    obs.append(ob)
    bm = bmesh.new()
    hw, hh = (0.034, 0.040) if "ccol" in flags and COLLAR else (0.054, 0.074)
    lozenge = [(0, hh), (hw * 0.55, hh * 0.55), (hw, 0.012), (hw * 0.55, -hh * 0.45), (0, -hh), (-hw * 0.55, -hh * 0.45),
               (-hw, 0.012), (-hw * 0.55, hh * 0.55)]
    polygon_prism(bm, lozenge, cc + V((0, 0.005, 0.002)), V((1, 0, 0)), V((0, 0, 1)), V((0, -1, 0)), 0.004)
    ob = bm_to_object("collar_plate", bm, ["indigo"], arm=arm, smooth=False, part="collar_plate")
    set_weights(ob, [{"J_Bip_C_UpperChest": 1.0} for _ in ob.data.vertices])
    ob["no_ao"] = True
    obs.append(ob)
    if "anc" in flags:
        # the window runs from just under the pendant's lower tip down the sternum (9 px at 144)
        zt = zc_win - 0.050 - 0.010
        if "ccol" in flags and COLLAR:
            # the window starts just under the collar's foot (the pendant no longer sits there)
            # (the old top, 6 cm under the pendant, sat below the bust line: a drop pendant)
            zt = COLLAR["zb"] - 0.016
        zb = zt - 0.118
        for nm, z in (("outfit_win_t", zt), ("outfit_win_b", zb)):
            y = Bd.front_y(z, -0.006, 0.006, default=nb.y - 0.08)
            obs.append(anchor(arm, nm, V((0, y - 0.004, z)), {"J_Bip_C_UpperChest": 1.0}))
        LOG["window"] = {"top": round(zt, 4), "bot": round(zb, 4), "bust_z": round(Bd.bust.z, 4)}
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
    # garter straps: two per thigh, straight from the hip band to the thigh band
    if "gar4" in flags:
        # round 3: the front pair a little further out than gar3 (in the idle gar3's front straps ran
        # down the inner thighs beside the tabard: strap + its two S4 border lines read as a hard
        # dark inner-thigh outline, critique 12b); gar2's 62 put them on the thigh outline
        routes = ((57, 40), (160, 118))
    elif "gar3" in flags:
        # the front pair between r1 and gar2 (the idle kept its thigh-framing line, clear of the
        # inner thigh); the back pair as an A from beside the thong down to the outer back of each
        # thigh: three lines radiate from the back medallion (thong + two straps)
        routes = ((52, 34), (160, 118))
    elif "gar2" in flags:
        routes = ((62, 44), (118, 168))     # (theta at the hip band, theta at the thigh band)
    else:
        routes = ((42, 22), (140, 160))
    bm = bmesh.new()
    rings_at, strap_pts = [], []
    for s in (1, -1):
        for th_top, th_bot in routes:
            th_top, th_bot = s * th_top, s * th_bot
            pts = []
            for i in range(9):
                t = i / 8
                th = math.radians(lerp(th_top, th_bot, t))
                z = lerp(zline(math.degrees(th)) - 0.006, thigh_z + 0.006, t)
                d = V((math.sin(th), -math.cos(th), 0))
                leg_x = 0.07 * s * smoothstep(Bd.hipj, thigh_z, z)
                o = V((leg_x, Bd.yc(z), z)) + d * 0.4
                hit = Bd.bvh.ray_cast(o, -d, 1.0)
                q = hit[0] + hit[1] * 0.007 if hit[0] is not None else o - d * 0.3
                pts.append(q)
            if flags & {"gar2", "gar3", "gar4"}:
                # straight: keep the ends and the surface offset, drop the wander between them
                a, b = pts[0], pts[-1]
                straight = []
                for i, p in enumerate(pts):
                    t = i / 8
                    line = a.lerp(b, t)
                    # back onto the skin along the ray to the leg axis (the strap lies on the curve)
                    d = (line - V((0.07 * s * smoothstep(Bd.hipj, thigh_z, line.z), Bd.yc(line.z), line.z)))
                    d.z = 0
                    if d.length > 1e-6:
                        d.normalize()
                        hit = Bd.bvh.ray_cast(line + d * 0.3, -d, 1.0)
                        if hit[0] is not None:
                            line = hit[0] + hit[1] * 0.007
                    straight.append(line)
                pts = straight
            pts = catmull(pts, 16)
            strap_pts.append(pts)
            tube(bm, pts, [(0.0078, 0.0034)] * len(pts), nseg=6,
                 refs=[(p - V((0.07 * s, Bd.yc(p.z), p.z))).normalized() for p in pts])
            rings_at.append(pts[0])
    straps = bm_to_object("garter_straps", bm, ["gold"], arm=arm, part="gold_harness")
    copy_weights_nearest(straps, Bd.ob)
    obs.append(straps)
    # O-rings at the strap tops, medallions front and back (+ anchors for the pixel rose)
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
    med = {}
    for back in (False, True):
        th = 180 if back else 0
        z = zline(th) + 0.001
        d = V((0, 1 if back else -1, 0))
        hit = Bd.bvh.ray_cast(V((0, Bd.yc(z), z)) + d * 0.5, -d, 1.0)
        if hit[0] is not None:
            c = hit[0] + d * 0.008
            med[back] = c
            ring = []
            for k in range(14):
                a = 2 * math.pi * k / 14
                ring.append(c + V((math.cos(a) * 0.020, 0, math.sin(a) * 0.016)))
            cc2 = bm.verts.new(c + d * 0.004)
            vs = [bm.verts.new(q) for q in ring]
            for k in range(14):
                bm.faces.new((vs[k], vs[(k + 1) % 14], cc2) if not back else (vs[(k + 1) % 14], vs[k], cc2))
    rings_ob = bm_to_object("belt_rings", bm, ["gold"], arm=arm, part="gold_harness")
    copy_weights_nearest(rings_ob, Bd.ob)
    obs.append(rings_ob)
    bm = bmesh.new()
    for back, c in med.items():
        d = V((0, 1 if back else -1, 0))
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.0075,
                                  matrix=Matrix.Translation(c + d * 0.0055) @ Matrix.Scale(0.6, 4, d))
    glass = bm_to_object("belt_glass", bm, ["glasscore"], arm=arm, part="gold_harness")
    copy_weights_nearest(glass, Bd.ob)
    obs.append(glass)
    if "anc" in flags:
        for back, c in med.items():
            obs.append(anchor(arm, "outfit_rose_b" if back else "outfit_rose_f", c + V((0, 0.012 if back else -0.012, 0)),
                              {"J_Bip_C_Hips": 1.0}, bone="J_Bip_C_Hips"))
    if "nochm" not in flags:
        bm = bmesh.new()
        for pts in strap_pts:
            foot = pts[-1]
            n = (foot - V((0.07 * (1 if foot.x > 0 else -1), Bd.yc(foot.z), foot.z)))
            n.z = 0
            n.normalize()
            c = foot + V((0, 0, -0.035)) + n * 0.006
            u = n.cross(V((0, 0, 1))).normalized()
            polygon_prism(bm, fleur_cross_outline(0.062, 0.012, 0.012, 0.040), c, u, V((0, 0, 1)), n, 0.005)
            tube(bm, [foot + n * 0.006, c + V((0, 0, 0.02)) + n * 0.006], [(0.003, 0.003)] * 2, nseg=5, ref=n)
        charms = bm_to_object("charms", bm, ["gold"], arm=arm, smooth=False, part="gold_harness")
        copy_weights_nearest(charms, Bd.ob)
        obs.append(charms)
    # back halter straps (unchanged)
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
    LOG["garters"] = {"routes": routes, "charms": "nochm" not in flags}
    return obs


def garter_belt_r2(Bd, half, front_dip):
    zs = Bd.hipj + 0.062

    def zline(th):
        a = abs(th)
        return zs - 0.022 * gauss(a, 180, 30) - front_dip * gauss(a, 0, 35) + 0.010 * gauss(a, 90, 30)

    def region(p, m):
        if p.z < zs - 0.09 or p.z > zs + 0.05:
            return False
        th = Bd.theta(p)
        return abs(p.z - zline(th)) < half and m["arm"] < 0.1
    return O.shell(Bd, "garter_belt", region, 0.0065, ["gold", "gold"], part="gold_harness"), zline


def tabard_r2(Bd, arm, lining="white", fold=1, hem2=False, tabx=False):
    """the front tabard (tabard_r1's panel) with ONE lengthwise fold break: the flat centre (the
    cross) is one lit plane and the panel beyond the break turns back as one shadow plane, the
    fold opening from the hip band (its tension point) toward the hem; with hem2 a second gold
    line runs parallel to the V hem"""
    # turn 0.050 with a 10% narrowing of that side made the panel a thin strip at 80 px (a 3/4
    # view foreshortens the turned plane): 0.034, no narrowing
    T = dict(TAB, brk=0.52, turn=0.034, bulge=0.010, narrow=0.0)
    top = Bd.hipj + 0.02
    bot = lerp(Bd.knee, Bd.ankle, 0.52)
    nr, nc = T["rows"], T["cols"]
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
        # the shadow side: beyond the break the cloth is a plane turning back (linear, so it
        # renders as one tone, not a ramp band); the fold opens from the hip band
        open_ = 0.30 + 0.70 * smoothstep(0.02, 0.85, t)
        d -= T["turn"] * open_ * max(0.0, (-su - T["brk"]) / (1 - T["brk"]))
        # the lit side: a small roll at the edge only
        d -= 0.010 * smoothstep(0.80, 1.0, su) ** 1.5
        return d

    rows = []
    for i in range(nr + 1):
        t = i / nr
        z = lerp(top, bot, t)
        w = half_w(t)
        row = []
        for j in range(nc + 1):
            u = j / nc * 2 - 1
            # the turned-back plane narrows the silhouette a little on that side
            su = u * fold
            x = u * w * (1 - T["narrow"] * max(0.0, (-su - T["brk"]) / (1 - T["brk"])) * smoothstep(0.1, 0.9, t))
            zz = z - T["v_point"] * (1 - abs(u)) * smoothstep(0.55, 1.0, t)
            row.append(V((x, yline[i] - depth(u, t), zz)))
        rows.append(row)
    bm = bmesh.new()
    grid_sheet(bm, rows)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y > 0:
            f.normal_flip()
    ob = bm_to_object("tabard", bm, ["white", "gold", lining, "gold"], arm=arm, part="tabard")
    me = ob.data
    cr = []
    for v in me.vertices:
        i, j = divmod(v.index, nc + 1)
        u, t = j / nc * 2 - 1, i / nr
        # a thin contact crease only along the break, from a third of the way down
        cr.append(0.35 * gauss(-u * fold, T["brk"], 0.035) * smoothstep(0.25, 0.6, t))
    O.set_crease(ob, cr)
    for p in me.polygons:
        cols = [k % (nc + 1) for k in p.vertices]
        rws = [k // (nc + 1) for k in p.vertices]
        if min(cols) <= 1 or max(cols) >= nc - 1 or max(rws) >= nr:
            p.material_index = 1
        elif hem2 and min(rws) == nr - 4 and 3 <= min(cols) and max(cols) <= nc - 3:
            p.material_index = 1
    for v in me.vertices:
        v.co.y -= 0.007
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.007
    m.offset = -1.0
    m.material_offset = 2
    # a dark back keeps a dark rim (a gold rim read as a gold strap in the leg gap, back view)
    m.material_offset_rim = 2 if lining != "white" else 1
    pts = [V((0, yline[int(nr * k / 4)], lerp(top, bot, k / 4))) for k in range(5)]
    pts[-1].z -= 0.06
    names = rig.add_chain(arm, "tabard", pts, "J_Bip_C_Hips")
    set_weights(ob, [chain_weights(v.co, pts, names, "J_Bip_C_Hips", 0.5) for v in me.vertices])
    tc = 0.74 if hem2 else 0.78
    zc = lerp(top, bot, tc)
    iy = int(nr * tc)
    bmx = bmesh.new()
    polygon_prism(bmx, fleur_cross_outline(T["cross_h"], T["cross_arm"], T["cross_bar"], T["cross_w"]),
                  V((0.006 * fold, yline[iy] - T["bulge"] - 0.007 - 0.006, zc)),
                  V((1, 0, 0)), V((0, 0, 1)), V((0, -1, 0)), 0.004)
    cr_ob = bm_to_object("tabard_cross", bmx, ["gold"], arm=arm, smooth=False, part="tabard")
    set_weights(cr_ob, [chain_weights(v.co, pts, names, "J_Bip_C_Hips", 0.5) for v in cr_ob.data.vertices])
    if tabx:
        # round 2b (critique 13c): the 3D cross (18 cm, a 7x10 gold mass at 144) is not rendered;
        # outfit_px2 'tabx' stamps DESIGN's 5x7 fleur-cross with a dark centre on these anchors,
        # which ride the tabard chain (so the stamp follows the drape and its facing)
        cr_ob.hide_render = True
        yc = yline[iy] - T["bulge"] - 0.007 - 0.004
        bone = names[min(len(names) - 1, 2)]
        for nm, dz in (("outfit_tabx_c", 0.0), ("outfit_tabx_t", 0.06)):
            q = V((0.006 * fold, yc, zc + dz))
            a = anchor(arm, nm, q, chain_weights(q, pts, names, "J_Bip_C_Hips", 0.5), bone=bone)
        LOG["tabard_cross"] = {"stamp": True, "bone": bone}
    LOG["tabard"] = {"r2": True, "fold": fold, "hem2": hem2, "lining": lining, "brk": T["brk"]}
    return ob, cr_ob


def sleeves_r2(Bd, arm, anchors=False, lip=0.0):
    """outfit.sleeves with three flutes whose fold lines run from the cuff to the bell mouth
    (CL-P01: the armband and the elbow are the tension points) and the corner cross on the lowest
    corner of the hanging lip"""
    out = []
    for s, sx in (("L", 1), ("R", -1)):
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
            scallop = 0.018 * (0.5 + 0.5 * math.cos(phi * 3 + 0.2 + math.pi / 2)) * (0.35 + 0.65 * bottom)
            x_end = x_wr - O.SLEEVE_SHORT + (O.SLEEVE_LIP + O.SLEEVE_SHORT - 0.01) * bottom ** 1.3 + scallop
            a = lerp(x0, x_end, t)
            flare = smoothstep(x_el - 0.04, x_wr - 0.02, a)
            grow = smoothstep(x0, x_wr, a)          # the flutes start at the cuff and open to the mouth
            r_arm = lerp(0.047, 0.055, max(0.0, min(1.0, (a - x0) / (x_el - x0))))
            flute = 1.0 + 0.13 * math.sin(phi * 3 + 0.2) * grow * (0.35 + 0.65 * bottom)
            rt = (r_arm + 0.012 * flare) * flute
            rh = (r_arm + 0.050 * flare) * flute
            rb = (r_arm + O.SLEEVE_BELL * flare ** 1.2) * flute
            # slvf: the last 15% turns out like a trumpet's bell, so the lining shows as a
            # crescent inside the rim from the side (the rim was edge-on and hid it)
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
            cr.append(max(0.0, valley) * smoothstep(0.10, 0.45, t) * (0.4 + 0.6 * bottom) * 0.9)
        O.set_crease(ob, cr)
        m = ob.modifiers.new("thick", "SOLIDIFY")
        m.thickness = 0.006
        m.offset = -1.0
        m.material_offset = 1
        m.material_offset_rim = 2
        p0 = el + V((0, 0, -0.05))
        p1 = wr + ax * 0.02 + V((0, 0, -0.14))
        tip = sh + ax * (x_wr + O.SLEEVE_LIP) + V((0, 0, -0.055 - O.SLEEVE_BELL))
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
        # the corner cross on the lowest corner of the hanging lip (DESIGN 3 row 5)
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
            a_ob = anchor(arm, f"outfit_slvx_{s}", pos + n * 0.004, cw[0], bone=f"J_Bip_{s}_LowerArm")
            out.append(a_ob)
    LOG["sleeves"] = {"r2": True}
    return out


def thong_r2(Bd, zline, arm):
    """the T-back as a narrow wedge (critique: 'a 2 px I4/OL wedge with a 1 px gold edge, from the
    hip band into the leg gap'): about 6 px wide at the band, 2 px where it enters the gap, gold
    edge columns only in the upper half; the front panel as outfit.thong"""
    bm = bmesh.new()
    top_b = zline(180) + 0.006
    bot_b = top_b - 0.24
    nr, nc = 16, 6
    rows = []
    for i in range(nr + 1):
        v = i / nr
        z = lerp(top_b, bot_b, v)
        w = 0.030 * (1 - v) ** 1.6 + 0.0135
        row = []
        for j in range(nc + 1):
            u = j / nc * 2 - 1
            x = u * w
            hit = Bd.bvh.ray_cast(V((x, 0.6, z)), V((0, -1, 0)), 1.0)
            q = hit[0] + hit[1] * 0.0045 if hit[0] is not None else V((x, 0.1, z))
            row.append(q)
        ymax = max(p.y for p in row)
        for p in row:
            p.y = max(p.y, ymax - (0.010 if v < 0.5 else 0.03))
        rows.append(row)
    grid_sheet(bm, rows)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y < 0:
            f.normal_flip()
    bm.verts.index_update()
    for f in bm.faces:
        cols = [v.index % (nc + 1) for v in f.verts]
        rws = [v.index // (nc + 1) for v in f.verts]
        if (min(cols) == 0 or max(cols) == nc) and max(rws) <= nr * 0.45:
            f.material_index = 1
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
    grid_sheet(bm, rows)
    ob = bm_to_object("thong", bm, ["thong", "gold"], arm=arm, part="thong")
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.002
    m.offset = 1.0
    copy_weights_nearest(ob, Bd.ob)
    return ob


def thong_string(Bd, zline, arm):
    """DESIGN rev 5 item 5 (critique 12b): the back strap as a string, 1 px black at 144, from the
    back medallion down the cleft into the leg gap; no gold edge (the gold harness stays). The
    mesh is ~1 px wide at 144 so the skin under the old wedge renders as skin (the glutes get
    their own shading); outfit_px2 'string' makes the line continuous and exactly 1 px. The
    front panel as thong_r2."""
    ob = thong_r2(Bd, zline, arm)
    bm = bmesh.new()
    top_b = zline(180) + 0.004
    bot_b = top_b - 0.24
    nr, nc = 16, 2
    rows = []
    for i in range(nr + 1):
        v = i / nr
        z = lerp(top_b, bot_b, v)
        w = 0.0075 - 0.002 * v
        row = []
        for j in range(nc + 1):
            x = (j / nc * 2 - 1) * w
            hit = Bd.bvh.ray_cast(V((x, 0.6, z)), V((0, -1, 0)), 1.0)
            row.append(hit[0] + hit[1] * 0.0045 if hit[0] is not None else V((x, 0.1, z)))
        ymax = max(p.y for p in row)
        for p in row:
            p.y = max(p.y, ymax - 0.004)
        rows.append(row)
    grid_sheet(bm, rows)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.y < 0:
            f.normal_flip()
    # the front panel of thong_r2 (its second sheet), kept as is
    me = ob.data
    nb_back = (16 + 1) * (6 + 1)
    bm2 = bmesh.new()
    bm2.from_mesh(me)
    bm2.verts.ensure_lookup_table()
    back = [v for v in bm2.verts if v.index < nb_back]
    bmesh.ops.delete(bm2, geom=back, context="VERTS")
    for f in bm2.faces:
        f.material_index = 0
    tmp = bpy.data.meshes.new("thong_front_tmp")
    bm2.to_mesh(tmp)
    bm2.free()
    bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)
    mods = [(m.name, m.type) for m in ob.modifiers]
    bpy.data.objects.remove(ob)
    ob = bm_to_object("thong", bm, ["thong", "gold"], arm=arm, part="thong")
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.002
    m.offset = 1.0
    copy_weights_nearest(ob, Bd.ob)
    LOG["thong"] = {"string_half_w_mm": [7.5, 5.5], "replaced": mods}
    return ob


def body_anchors_r2b(Bd, arm, zline):
    """round 2b anchors for outfit_px2 (projected by posing.anchors like the glyphs; skinned by the
    nearest body weights so they follow the hips, legs and chest):
      outfit_gl{T,F,I,O}_{L,R}  each glute's top (under the hip band), fold, cleft and outer side:
                                 the ellipse the 'glute' pass shades as a form (critique 12b)
      outfit_ubust_{L,R}         under each breast's apex, on the bodice: the start of the tension
                                 folds and the cast shadow (critique 13b)
      outfit_waist               the bodice's front at the waist: where the folds run to"""
    obs = []

    def surf(o, d, off):
        hit = Bd.bvh.ray_cast(o, d, 2.0)
        return hit[0] - d * off if hit[0] is not None else None

    def add(nm, q, bone):
        ob = anchor(arm, nm, q, {}, bone=bone)
        for g in list(ob.vertex_groups):
            ob.vertex_groups.remove(g)
        copy_weights_nearest(ob, Bd.ob)
        obs.append(ob)

    fold_z = Bd.hipj - 0.075
    for s, side in ((1, "L"), (-1, "R")):
        ax = 0.065
        zf = fold_z + 0.03 * smoothstep(0.03, 0.12, ax)
        zt = zline(s * 160) - 0.012
        zm = (zf + zt) / 2
        pts = {
            "T": surf(V((s * ax, 0.6, zt)), V((0, -1, 0)), -0.004),
            "F": surf(V((s * ax, 0.6, zf)), V((0, -1, 0)), -0.004),
            "I": surf(V((s * 0.012, 0.6, zm)), V((0, -1, 0)), -0.004),
        }
        th = math.radians(s * 115)
        d = V((math.sin(th), -math.cos(th), 0))
        pts["O"] = surf(V((0, Bd.yc(zm), zm)) + d * 0.6, -d, -0.004)
        for k, q in pts.items():
            if q is not None:
                add(f"outfit_gl{k}_{side}", q, "J_Bip_C_Hips")
    # the bust apex: the most forward skin point on the bust line, per side
    zc = Bd.bust.z
    for s, side in ((1, "L"), (-1, "R")):
        best = None
        for i in range(12):
            x = s * (0.03 + 0.008 * i)
            for dz in (-0.02, -0.01, 0.0, 0.01, 0.02):
                q = surf(V((x, -0.8, zc + dz)), V((0, 1, 0)), 0.0)
                if q is not None and (best is None or q.y < best.y):
                    best = q
        if best is None:
            continue
        # walk down until the surface falls back 3 cm: the underbust
        z = best.z
        under = None
        while z > zc - 0.16:
            z -= 0.004
            q = surf(V((best.x, -0.8, z)), V((0, 1, 0)), 0.0)
            if q is not None and q.y - best.y > 0.03:
                under = V((best.x, q.y - 0.0075, z))
                break
        if under is not None:
            add(f"outfit_ubust_{side}", under, "J_Bip_C_UpperChest")
    # the waist end of the folds: just over the hip band (the bodice runs down to it); zc - 0.14
    # projected only 2-4 px under the underbust in the idle
    zw = Bd.hipj + 0.045
    q = surf(V((0, -0.8, zw)), V((0, 1, 0)), 0.0075)
    if q is not None:
        add("outfit_waist", q, "J_Bip_C_Spine")
    LOG["anchors_r2b"] = [o.name for o in obs]
    return obs


def body_creases_r2(Bd):
    """outfit.body_creases plus a designed shadow under each glute (DESIGN 3 row 10: 'lit, shadow,
    deep crease'), so the seat reads as two rounded forms and not a skin rectangle"""
    me = Bd.ob.data
    vals = []
    fold_z = Bd.hipj - 0.075
    for v in me.vertices:
        p = v.co
        yc = Bd.yc(p.z)
        back = smoothstep(0.01, 0.05, p.y - yc)
        ax = abs(p.x)
        zf = fold_z + 0.03 * smoothstep(0.03, 0.12, ax)
        glute = gauss(p.z, zf, 0.009) * back * gauss(ax, 0.065, 0.045)
        # the underside of the glute: a band above the fold, strongest near the cleft, fading up
        under = gauss(p.z, zf + 0.022, 0.016) * back * gauss(ax, 0.055, 0.05)
        cleft = gauss(ax, 0.0, 0.007) * back * smoothstep(fold_z - 0.01, fold_z + 0.04, p.z) * \
            smoothstep(Bd.hipj + 0.08, Bd.hipj + 0.02, p.z)
        inner = gauss(p.x * (1 if p.x > 0 else -1), 0.035, 0.008) * gauss(p.z, Bd.hipj - 0.10, 0.04) * \
            smoothstep(0.03, -0.01, p.y - yc)
        vals.append(min(1.0, 0.95 * glute + 0.45 * under + 0.8 * cleft + 0.35 * inner))
    O.set_crease(Bd.ob, vals)


# ---------------------------------------------------------------------------- materials
MATS = {
    # W1 only on the strongly lit planes (a highlight), W2 the flat base, W3 the shadow side
    "wht": {"white": {"ramp": ["W4", "W3", "W2", "W1"], "t": [0.0, 0.12, 0.40, 0.80],
                      "line": "OL", "selout": "W4", "inner": "W4"}},
    # the opposite plan: two values with a sharp terminator (lit W1, shadow W3), W2 only a thin
    # half-tone between them, W4 in occlusion (ref 04's white skirt: white and lavender)
    "whtk": {"white": {"ramp": ["W4", "W3", "W2", "W1"], "t": [0.0, 0.12, 0.44, 0.54],
                       "line": "OL", "selout": "W4", "inner": "W4"}},
    "whts": {"white": {"ramp": ["W4", "W3", "W2", "W2"], "t": [0.0, 0.12, 0.40, 0.99],
                       "line": "OL", "selout": "W4", "inner": "W4", "spec": {"code": "W1", "thr": 0.90}}},
    # round 2: three tones on every white part (critique 14: sleeves, tabard, veil read flat W1)
    # (W1 from 0.60 put the tabard's front-facing lit plane, N.L about 0.55-0.6, into W2: a dim
    # lavender panel at 80 px; 0.55 keeps it W1 and leaves W2 to the planes turning away)
    "wht3": {"white": {"ramp": ["W4", "W3", "W2", "W1"], "t": [0.0, 0.12, 0.40, 0.55],
                       "line": "OL", "selout": "W4", "inner": "W4"}},
    # round 2: cloth and leather read differently (critique 13: one long vinyl boot). The stocking
    # is matte: I3 shadow, I2 base, a thin I1 core, no streak; the boot a step darker, I4 shadow,
    # I3 base, a sharp I0 streak; the lining I4/I3 so the sleeve mouth reads as a dark crescent
    # (the unlit side sits at v = 0.16 * ao, the ambient term: an I3 threshold at 0.16 put the
    # whole shadow side in I4 (29% of the stocking), so it stays under the ambient, at 0.12)
    "mat2": {"stocking": {"ramp": ["I4", "I3", "I2", "I1"], "t": [0.0, 0.12, 0.42, 0.90],
                          "line": "OL", "selout": "I4", "inner": "OL", "spec": {}},
             "boot": {"ramp": ["I4", "I4", "I3", "I3"], "t": [0.0, 0.12, 0.34, 0.95],
                      "line": "OL", "selout": "I4", "inner": "I4", "spec": {"code": "I0", "thr": 0.955}},
             "lining": {"ramp": ["I4", "I4", "I3", "I3"], "t": [0.0, 0.30, 0.55, 0.90],
                        "line": "OL", "selout": "I4", "inner": "OL"}},
}


# round 3 (critique 12/13, 6/10: 'a matte mid-indigo tube ... merges with the boot, so at 80 the
# leg reads as one long boot'). The stocking core goes a step darker and matte; the one sheen is a
# continuous I1 line the pixel pass draws (outfit_px3 'sheen3'); the boot sits a step darker again
# with its own gloss (outfit_px3 'boot3'), so the two differ in value AND in finish.
#   mat3   stocking: shadow I4, core I3 (critic 12's 'push the core to I3'); boot: deep K3, core I4,
#          lit I3 only on the top planes
#   mat3k  stocking on the shading lane's dark K ramp (palette.json K1-K3: shadow K2, core K1,
#          contact K3), the refs' near-black; boot as mat3 (I4 core: 1.4:1 under K1)
MATS.update({
    "mat3": {"stocking": {"ramp": ["I4", "I4", "I3", "I3"], "t": [0.0, 0.10, 0.30, 0.99],
                          "line": "OL", "selout": "I4", "inner": "OL", "spec": {}},
             "boot": {"ramp": ["K3", "K3", "I4", "I3"], "t": [0.0, 0.08, 0.20, 0.80],
                      "line": "OL", "selout": "I4", "inner": "K3", "spec": {}}},
    "mat3k": {"stocking": {"ramp": ["K3", "K2", "K1", "K1"], "t": [0.0, 0.08, 0.30, 0.99],
                           "line": "OL", "selout": "K2", "inner": "OL", "spec": {}},
              "boot": {"ramp": ["K3", "K3", "I4", "I3"], "t": [0.0, 0.08, 0.20, 0.80],
                       "line": "OL", "selout": "I4", "inner": "K3", "spec": {}}},
    # (round 3 second pass: the stocking's K2 shadow from 0.30 made K2 the idle's median tone, K2/K3 only
# 1.21:1 against the boot; from 0.22 the K1 core holds the leg)
# mat3k2: the K stocking with a glossy near-black boot: K3 core, I4 only on the top-lit planes
    # (mat3k's I4 boot read the same value as the K1 stocking at x5); the boot's gloss is the
    # pass's I0 streak, so the pair differ in value (K1/K3 1.6:1) and in finish
    "mat3k2": {"stocking": {"ramp": ["K3", "K2", "K1", "K1"], "t": [0.0, 0.06, 0.22, 0.99],
                            "line": "OL", "selout": "K2", "inner": "OL", "spec": {}},
               "boot": {"ramp": ["OL", "K3", "K3", "I4"], "t": [0.0, 0.04, 0.30, 0.78],
                        "line": "OL", "selout": "I4", "inner": "K3", "spec": {}}},
})
# mat3i: the critic's literal stocking (core I3, shadow I4) with mat3k2's glossy near-black boot
MATS["mat3i"] = {"stocking": dict(MATS["mat3"]["stocking"]), "boot": dict(MATS["mat3k2"]["boot"])}


def apply_materials(flags):
    ov = {}
    # a fixed order, later flags win (round 2 over round 1): a set has no order
    for f in ("wht", "whtk", "whts", "wht3", "mat2", "mat3", "mat3k", "mat3k2", "mat3i"):
        if f in flags:
            ov.update(MATS[f])
    if not ov:
        return
    sc = bpy.context.scene
    cur = sc.get("rosace_palette_overrides")
    cur = cur.to_dict() if hasattr(cur, "to_dict") else dict(cur or {})
    cur.update(ov)
    sc["rosace_palette_overrides"] = cur
    from . import materials
    for name in ov:
        materials.make_material(name)
    LOG["materials"] = ov


# ---------------------------------------------------------------------------- build
# named flag sets (so lane file names stay short): R2A = every round-2 construction change
ALIASES = {
    "R2A": "R2+win0+anc+gar2+nochm+thb+belt2+tabf+hem2+tabd+slv+thg+glute+mat2+wht3",
    "R2B": "R2+win0+anc+gar3+nochm+thb+belt2+tabf+hem2+tabd+slv+thg+glute+mat2+wht3",
    # round-2 lane pick (WF-P11, painter): R2B with the sleeve lip and the tabard's shadow plane on
    # the side away from the key light; render with the pose patches qtab+hair+tabn2
    "R2P": "R2+win0+anc+gar3+nochm+thb+belt2+tabf-+hem2+tabd+slv+slvf+thg+glute+mat2+wht3",
    # round 2b (second critique of round 2): the cross at the throat on a taller collar, the thong
    # as a 1 px string (DESIGN rev 5 item 5)
    "R2Q": "R2P+ccol+col2+str+tabx+anc2",
    # round 3 (critique 6/10): the straps as their own part, the back cross as a stamp, and the
    # stocking/boot split; R3A = the critic's literal I3 stocking core, R3K = the K ramp
    "R3A": "R2Q+strp+ykx+mat3",
    "R3K": "R2Q+strp+ykx+mat3k",
    "R3K2": "R2Q+strp+ykx+mat3k2",
    "R3K3": "R2Q+strp+ykx+mat3k2+gar4",
    "R3I3": "R2Q+strp+ykx+mat3i+gar4",
}


def round3(Bd, arm, flags):
    """round 3 construction: 'strp' puts the garter straps on their own part ('gold_strap') so the
    pixel pass can thin them to 1 px at 144 and drop them at 80 (critique 13, gold budget); 'ykx'
    hides the 3D yoke cross (a 6 cm prism: a gold blob, and under the hair) and places two anchors
    on it, outfit_ykx_c (centre) and outfit_ykx_t (top), for outfit_px3's 3x5 stamp"""
    from .geo import set_part
    obs = []
    if "strp" in flags:
        ob = bpy.data.objects.get("garter_straps")
        if ob:
            set_part(ob, "gold_strap")
    if "ykx" in flags:
        yk = bpy.data.objects.get("yoke_cross")
        if yk:
            vs = [yk.matrix_world @ v.co for v in yk.data.vertices]
            c = sum(vs, V()) / len(vs)
            top = max(vs, key=lambda p: p.z)
            back_y = max(p.y for p in vs)
            yk.hide_render = True
            for nm, q in (("outfit_ykx_c", V((c.x, back_y + 0.004, c.z))),
                          ("outfit_ykx_t", V((c.x, back_y + 0.004, top.z)))):
                a = anchor(arm, nm, q, {}, bone="J_Bip_C_UpperChest")
                for g in list(a.vertex_groups):
                    a.vertex_groups.remove(g)
                copy_weights_nearest(a, Bd.ob)
                obs.append(a)
            LOG["yoke_cross"] = {"stamp": True, "c": [round(c.x, 4), round(back_y, 4), round(c.z, 4)]}
    return obs


def expand(variant):
    out = []
    for f in variant.split("+"):
        out += expand(ALIASES[f]) if f in ALIASES else [f]
    return out


def build(arm, body, variant):
    flags = set(expand(variant))
    flags -= {f[1:] for f in list(flags) if f.startswith("~")} | {f for f in flags if f.startswith("~")}
    if "R2" in flags:           # round 2 base = the round-1 pick
        flags |= {"tabw", "whtk", "trim", "win", "col"}
    log("variant", variant, sorted(flags))
    O._KD.clear()
    Bd = O.Body(arm, body)
    parts = {}
    trim = "trim" in flags
    win = dict(top=0.10, mid=0.035, bot=0.125, w=0.062) if "win" in flags else None
    if "win0" in flags:
        win = dict(top=0.10, mid=0.035, bot=0.125, w=0.0)
    parts["bodice"] = bodice_r1(Bd, trim=0.019 if trim else 0.0135, win=win)
    parts["midback"] = midback_strap_r1(Bd, half=0.0115 if trim else 0.0085)
    if "belt2" in flags:
        belt, zline = garter_belt_r2(Bd, 0.012 if trim else 0.0095, 0.015)
    else:
        belt, zline = garter_belt_r1(Bd, half=0.012 if trim else 0.0095)
    parts["belt"] = belt
    if "str" in flags:
        parts["thong"] = thong_string(Bd, zline, arm)
    else:
        parts["thong"] = thong_r2(Bd, zline, arm) if "thg" in flags else O.thong(Bd, zline, arm)
    thigh_z = lerp(Bd.knee, Bd.hipj, 0.36)
    boot_top = lerp(Bd.ankle, Bd.knee, 0.47)
    parts["stockings"] = stockings_r1(Bd, thigh_z, boot_top - 0.05, trim=0.016 if trim else 0.012)
    tb = thigh_bands_r1(Bd, thigh_z - 0.006, half=0.012 if trim else 0.009)
    if "thb" in flags:
        from .geo import set_part
        set_part(tb, "gold_thigh")
    parts["thigh_bands"] = tb
    parts["boots"] = O.boots(Bd, boot_top)
    parts["heels"] = O.heels(Bd, arm)
    parts["armbands"] = O.armbands(Bd)
    COLLAR.clear()
    if "col2" in flags:
        # round 2b (critique 13a): a 7-8 px white stand collar in front: the foot lower on the
        # yoke (flaring onto the trapezius), the top closer under the chin
        parts["collar"] = collar_r1(Bd, arm, foot=0.058, foot_r=0.068, top_gap=0.010)
    else:
        parts["collar"] = collar_r1(Bd, arm) if "col" in flags else O.collar(Bd, arm)
    lining = "lining" if "tabd" in flags else ("white" if "tabw" in flags else "lining")
    if "tabf" in flags or "tabf-" in flags:
        parts["tabard"] = tabard_r2(Bd, arm, lining=lining, fold=-1 if "tabf-" in flags else 1, hem2="hem2" in flags,
                                    tabx="tabx" in flags)
    elif "tab" in flags or "tabw" in flags:
        parts["tabard"] = tabard_r1(Bd, arm, lining=lining)
    else:
        parts["tabard"] = O.tabard(Bd, arm)
    parts["sleeves"] = (sleeves_r2(Bd, arm, anchors="anc" in flags, lip=0.022 if "slvf" in flags else 0.0)
                        if "slv" in flags else O.sleeves(Bd, arm))
    if flags & {"gar2", "gar3", "gar4", "nochm", "anc"}:
        parts["fittings"] = fittings_r2(Bd, arm, zline, thigh_z, flags)
    else:
        parts["fittings"] = O.fittings(Bd, arm, zline, thigh_z, belt)
    if trim:
        for nm in ("garter_straps", "halter_straps"):
            ob = bpy.data.objects.get(nm)
            if ob:
                scale_tubes(ob, 1.45)
    if "anc2" in flags:
        parts["anchors_r2b"] = body_anchors_r2b(Bd, arm, zline)
    if flags & {"strp", "ykx"}:
        parts["round3"] = round3(Bd, arm, flags)
    arm["outfit_levels"] = {"thigh_band": thigh_z, "boot_top": boot_top}
    if "glute" in flags:
        body_creases_r2(Bd)
    else:
        O.body_creases(Bd)
    apply_materials(flags)
    arm["outfit_variant"] = variant
    LOG["landmarks"] = {"neck": round(Bd.neck, 4), "chin": round(Bd.chin, 4), "bust_z": round(Bd.bust.z, 4),
                        "shoulder_z": round(Bd.shoulder.z, 4), "hipj": round(Bd.hipj, 4), "knee": round(Bd.knee, 4)}
    log("log", LOG)
    return parts
