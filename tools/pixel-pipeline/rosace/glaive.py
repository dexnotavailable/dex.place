"""The processional glaive "Lancet" (DESIGN.md section 7), 1.35 H long.

Weapon space: +Z from butt (z=0) to blade tip, cutting edge toward +X, the flat of the blade
and the rose disc face +/-Y (so at rest they face the camera and read as a cross).
Parts, butt to tip: gold butt spike + knop, dark indigo lacquer haft with three gold grip
bands, gold knop, rose disc (gold ring, 8 glass cells A2/A3 in gold leading, A5 core),
trefoil cross arms, half-lancet blade (straight spine, convex edge into the point, bevelled
cutting edge, gold fuller holding 3 glass cells, fleur barb on the spine), two stole tails.
Rig: bone 'glaive' (head at the main grip) with sockets grip_main, grip_off, grip_mid,
glaive_tip, glaive_butt; stole chains stole_A, stole_B.
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

from . import rig
from .geo import bm_to_object, chain_weights, fleur_cross_outline, polygon_prism, set_weights, tube

V = Vector


# Style variants (glaive-hands lane, round 1). The default "r4" is the shipped round-4 glaive,
# unchanged. A lane build picks another with the environment variable ROSACE_GLAIVE=<name> (or a
# JSON object of overrides), so parallel lanes that build from this file keep the shipped weapon.
# Values are in design units (du, 1 du = 1.5 px at 144, 0.83 px at 80).
STYLES = {
    "r4": {},
    # l2: more mass so the weapon reads at 80 px: a 2 px-core haft at 80, a wider blade, a bolder
    # rose-disc ring and cross arms, a bigger gem; lengths unchanged (DESIGN 7 table)
    "l2": {"haft_r": 1.2, "blade_w": 9.5, "ring_w": 1.35, "arm_r": 1.1, "arm_r2": 1.35, "gem_r": 1.0},
    # l3: l2 plus a disc 10.5 du across (DESIGN says 9) and a blade 31 du long
    "l3": {"haft_r": 1.2, "blade_w": 9.5, "ring_w": 1.4, "arm_r": 1.1, "arm_r2": 1.35, "gem_r": 1.05,
           "disc_r": 5.25, "blade_len": 31.0},
    # l4 (round 2): l3 with the stole tails short and hanging (critique 7b: the 17 du tails curled under the disc
    # read as a second hooked blade or a claw, in N1 as a dangling whip): 10 du long, no outward lean, and a
    # half twist so the beige back shows on the lower half (cloth, not a blade); the tie set 1 du apart
    "l4": {"haft_r": 1.2, "blade_w": 9.5, "ring_w": 1.4, "arm_r": 1.1, "arm_r2": 1.35, "gem_r": 1.05,
           "disc_r": 5.25, "blade_len": 31.0, "streamer_len": 10.0, "streamer_w": 2.1,
           "stole_lean": 0.02, "stole_twist": 1.5, "stole_taper": 0.45},
    # l5 (round 2, critique 7 fix: 'give them a darker beige back so they read as cloth and not as a second blade'):
    # l4 with the tails 8 du and the beige face out (B1/B2 against the white of l4), a quarter twist so both faces
    # show a fold; A/B against l4 in round 2
    "l5": {"haft_r": 1.2, "blade_w": 9.5, "ring_w": 1.4, "arm_r": 1.1, "arm_r2": 1.35, "gem_r": 1.05,
           "disc_r": 5.25, "blade_len": 31.0, "streamer_len": 8.0, "streamer_w": 2.1,
           "stole_lean": 0.02, "stole_twist": 0.8, "stole_taper": 0.45, "stole_front": "beige"},
}
# style keys without a length (not scaled by k)
UNITLESS = ("stole_lean", "stole_twist", "stole_taper", "stole_front")


def style():
    v = os.environ.get("ROSACE_GLAIVE", "r4").strip() or "r4"
    if v.startswith("{"):
        return "custom", json.loads(v)
    return v, STYLES[v]


def dims(H):
    k = H / 96.0          # metres per pixel at the 96 px design size
    L = 130 * k
    d = {
        "k": k, "L": L,
        # haft_r: round 2 gear critic, the 5 px haft at 144 read as a pole -> ~3 px + outline
        "butt": 6 * k, "haft_r": 1.05 * k, "haft_top": 6 * k + 87 * k,
        "disc_r": 4.5 * k, "arm_half": 8.5 * k, "blade_len": 28 * k, "blade_w": 8 * k,
        # round 1's 26 x 3 read as a plank or a flag; round 3 gear critic: at 19 the tails still
        # floated off the haft as a detached white shape -> short tails tied at the knop
        "stole_len": 12 * k, "stole_w": 2.2 * k,
        # round 4 gear critic: the tails + their end crosses read as a lumpy 6 x 8 px blob ->
        # two thin tapered streamers (2 px -> 1 px at 144), longer, set apart, no end crosses
        "streamer_len": 17 * k, "streamer_w": 1.9 * k,
        "ring_w": 1.05 * k, "arm_r": 0.9 * k, "arm_r2": 1.1 * k, "gem_r": 0.85 * k,
    }
    name, st = style()
    for key, val in st.items():
        d[key] = val if key in UNITLESS else val * k
    d["style"] = name
    d["haft_top"] = d["butt"] + 87 * k
    d["disc_c"] = d["haft_top"] + d["disc_r"] * 0.95
    d["blade_base"] = d["disc_c"] + d["disc_r"] * 0.95
    d["grips"] = {"grip_off": 0.36 * L, "grip_main": 0.58 * L, "grip_mid": 0.47 * L}
    d["bands"] = [0.36 * L, 0.58 * L, d["haft_top"] - 3 * k]
    # round 3 gear critic: the indigo haft shares the hair's ramp and vanished behind the hair
    # tail -> thin gold ferrules every ~13 px (96) / ~20 px (144) so the shaft stays traceable
    # (every 8 px read as a candy-striped pole in the idle)
    # round 4 gear critic: evenly spaced bands still read as a barber pole -> the ferrules are
    # grouped (a triple above the butt, a pair under the knop) and the middle of the haft stays
    # plain lacquer between the two grip bands
    lo, hi = d["butt"] + 5 * k, d["haft_top"] - 9 * k
    d["ferrules"] = [lo, lo + 2.6 * k, lo + 5.2 * k, hi, hi - 2.6 * k]
    return d


def build_parts(D):
    """returns list of (name, bm, materials, part) in weapon space"""
    k = D["k"]
    out = []
    # --- haft
    bm = bmesh.new()
    tube(bm, [V((0, 0, D["butt"] - k)), V((0, 0, D["haft_top"]))], [(D["haft_r"], D["haft_r"])] * 2,
         nseg=10, ref=V((1, 0, 0)))
    out.append(("glaive_haft", bm, ["haft"], "glaive"))
    # --- gold: butt spike + knop, bands, top knop, cross arms, ring
    bm = bmesh.new()
    b = D["butt"]
    tube(bm, [V((0, 0, 0)), V((0, 0, b * 0.45)), V((0, 0, b * 0.7)), V((0, 0, b))],
         [(0.2 * k, 0.2 * k), (1.7 * k, 1.7 * k), (1.9 * k, 1.9 * k), (1.6 * k, 1.6 * k)], nseg=10,
         ref=V((1, 0, 0)))
    for z in D["bands"]:
        tube(bm, [V((0, 0, z - k)), V((0, 0, z + k))], [(D["haft_r"] + 0.35 * k,) * 2] * 2, nseg=12,
             ref=V((1, 0, 0)))
    for z in D.get("ferrules", []):
        tube(bm, [V((0, 0, z - 0.45 * k)), V((0, 0, z + 0.45 * k))], [(D["haft_r"] + 0.3 * k,) * 2] * 2,
             nseg=12, ref=V((1, 0, 0)))
    # knop under the disc (where the stole is tied)
    zt = D["haft_top"]
    tube(bm, [V((0, 0, zt - 3.2 * k)), V((0, 0, zt - 2.2 * k)), V((0, 0, zt - 0.6 * k)), V((0, 0, zt + 0.4 * k))],
         [(1.7 * k,) * 2, (2.3 * k,) * 2, (2.0 * k,) * 2, (1.6 * k,) * 2], nseg=12, ref=V((1, 0, 0)))
    # cross arms with trefoil nubs, through the disc
    zc = D["disc_c"]
    ah = D["arm_half"]
    for s in (1, -1):
        tube(bm, [V((s * D["disc_r"] * 0.8, 0, zc)), V((s * (ah - 1.6 * k), 0, zc))],
             [(D["arm_r"], D["arm_r2"])] * 2,
             nseg=8, ref=V((0, 1, 0)), cap0=False)
        c = V((s * (ah - 0.9 * k), 0, zc))
        for dz, dx in ((0, 1.0), (1.1, -0.1), (-1.1, -0.1)):
            q = c + V((s * dx * k * 0.9, 0, dz * k))
            bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=1.0 * k,
                                      matrix=Matrix.Translation(q))
    # disc ring (flat annulus with thickness) and leading spokes
    ring_o, ring_i, th = D["disc_r"], D["disc_r"] - D["ring_w"], 1.1 * k
    n = 32
    ov = [[], []]
    iv = [[], []]
    for j, y in enumerate((-th / 2, th / 2)):
        for i in range(n):
            a = 2 * math.pi * i / n
            ov[j].append(bm.verts.new(V((math.cos(a) * ring_o, y, zc + math.sin(a) * ring_o))))
            iv[j].append(bm.verts.new(V((math.cos(a) * ring_i, y, zc + math.sin(a) * ring_i))))
    for i in range(n):
        i2 = (i + 1) % n
        bm.faces.new((ov[0][i], ov[0][i2], iv[0][i2], iv[0][i]))
        bm.faces.new((iv[1][i], iv[1][i2], ov[1][i2], ov[1][i]))
        bm.faces.new((ov[1][i], ov[1][i2], ov[0][i2], ov[0][i]))
        bm.faces.new((iv[0][i], iv[0][i2], iv[1][i2], iv[1][i]))
    for i in range(8):
        a = 2 * math.pi * (i + 0.5) / 8
        d = V((math.cos(a), 0, math.sin(a)))
        tube(bm, [V((0, 0, zc)) + d * 0.9 * k, V((0, 0, zc)) + d * (ring_i + 0.2 * k)], [(0.35 * k, 0.75 * k)] * 2,
             nseg=6, ref=V((0, 1, 0)))
    # hub
    tube(bm, [V((0, -0.7 * k, zc)), V((0, 0.7 * k, zc))], [(1.1 * k, 1.1 * k)] * 2, nseg=10, ref=V((1, 0, 0)))
    # blade collar (socket) + fleur barb on the spine
    bb = D["blade_base"]
    tube(bm, [V((0, 0, bb - 0.8 * k)), V((0, 0, bb + 1.2 * k))], [(1.4 * k, 1.0 * k), (1.1 * k, 0.8 * k)], nseg=10,
         ref=V((1, 0, 0)))
    polygon_prism(bm, fleur_cross_outline(4.0 * k, 0.9 * k, 0.3 * k, 3.6 * k), V((-2.2 * k, 0, bb + 3.0 * k)),
                  V((1, 0, 0)), V((0, 0, 1)), V((0, 1, 0)), 0.8 * k)
    out.append(("glaive_gold", bm, ["gold"], "glaive"))
    # --- glass cells in the disc
    bm = bmesh.new()
    bm2 = bmesh.new()
    for i in range(8):
        tgt = bm if i % 2 == 0 else bm2
        a0 = 2 * math.pi * i / 8 + 0.06
        a1 = 2 * math.pi * (i + 1) / 8 - 0.06
        pts = [V((math.cos(a0) * 1.1 * k, 0, math.sin(a0) * 1.1 * k))]
        for j in range(5):
            a = a0 + (a1 - a0) * j / 4
            pts.append(V((math.cos(a) * (ring_i + 0.1 * k), 0, math.sin(a) * (ring_i + 0.1 * k))))
        pts.append(V((math.cos(a1) * 1.1 * k, 0, math.sin(a1) * 1.1 * k)))
        uv = [(p.x, p.z) for p in pts]
        polygon_prism(tgt, uv, V((0, 0, zc)), V((1, 0, 0)), V((0, 0, 1)), V((0, 1, 0)), 0.7 * k)
    out.append(("glaive_glass", bm, ["glass"], "glaive_glass"))
    out.append(("glaive_glass2", bm2, ["glass2"], "glaive_glass"))
    bm = bmesh.new()
    # round 4 gear critic: keep the gem 3 x 3 px or larger (0.55 k -> 0.85 k)
    tube(bm, [V((0, -0.9 * k, zc)), V((0, 0.9 * k, zc))], [(D["gem_r"], D["gem_r"])] * 2, nseg=8, ref=V((1, 0, 0)))
    out.append(("glaive_core", bm, ["glasscore"], "glaive_glass"))
    # --- blade: half lancet, spine along x = -spine_x, edge convex to the point
    bm = bmesh.new()
    N = 22
    Lb, W = D["blade_len"], D["blade_w"]
    sx = -1.3 * k
    t_sp = 0.9 * k           # half thickness at the spine
    spine, edge, bev, mid = [], [], [], []
    for i in range(N + 1):
        t = i / N
        z = bb + 0.6 * k + Lb * t
        w = W * (1 - t ** 1.9) ** 0.72 * (0.82 + 0.18 * min(1.0, t * 6))
        xs = sx + 0.35 * k * t            # spine leans very slightly toward the edge at the point
        xe = xs + max(w, 0.05 * k)
        spine.append((xs, z))
        edge.append((xe, z))
        bev.append((xs + (xe - xs) * 0.84, z))      # narrow bevel: a 1-2 px A5 cutting edge
        mid.append((xs + (xe - xs) * 0.40, z))      # spine band (dark steel) | flat
    tip = V((sx + 0.35 * k, 0, bb + 0.6 * k + Lb + 1.6 * k))
    Sp = [bm.verts.new(V((x, t_sp, z))) for x, z in spine]
    Sn = [bm.verts.new(V((x, -t_sp, z))) for x, z in spine]
    Mp = [bm.verts.new(V((x, t_sp * 0.8, z))) for x, z in mid]
    Mn = [bm.verts.new(V((x, -t_sp * 0.8, z))) for x, z in mid]
    Bp = [bm.verts.new(V((x, t_sp * 0.55, z))) for x, z in bev]
    Bn = [bm.verts.new(V((x, -t_sp * 0.55, z))) for x, z in bev]
    Ed = [bm.verts.new(V((x, 0, z))) for x, z in edge]
    T = bm.verts.new(tip)
    edge_faces, spine_faces = [], []
    for i in range(N):
        spine_faces.append(bm.faces.new((Sp[i], Mp[i], Mp[i + 1], Sp[i + 1])))
        spine_faces.append(bm.faces.new((Sn[i + 1], Mn[i + 1], Mn[i], Sn[i])))
        bm.faces.new((Mp[i], Bp[i], Bp[i + 1], Mp[i + 1]))
        bm.faces.new((Mn[i + 1], Bn[i + 1], Bn[i], Mn[i]))
        edge_faces.append(bm.faces.new((Bp[i], Ed[i], Ed[i + 1], Bp[i + 1])))
        edge_faces.append(bm.faces.new((Bn[i + 1], Ed[i + 1], Ed[i], Bn[i])))
        spine_faces.append(bm.faces.new((Sn[i], Sp[i], Sp[i + 1], Sn[i + 1])))
    bm.faces.new((Sp[0], Sn[0], Mn[0], Bn[0], Ed[0], Bp[0], Mp[0]))
    for a_, b_ in ((Sp[N], Mp[N]), (Mp[N], Bp[N]), (Bp[N], Ed[N]), (Ed[N], Bn[N]), (Bn[N], Mn[N]),
                   (Mn[N], Sn[N]), (Sn[N], Sp[N])):
        bm.faces.new((a_, b_, T))
    for f in edge_faces:
        f.material_index = 1
    for f in spine_faces:
        f.material_index = 2
    bm.normal_update()
    out.append(("glaive_blade", bm, ["steel", "edge", "steeldark"], "glaive"))
    # round 4 gear critic: the pale blade has no weight and goes soft on grey / beige grounds ->
    # a 1 px dark lacquer spine line along the back of the blade (haft material: OL / I4)
    bm = bmesh.new()
    sp_pts = [V((x - 0.25 * k, 0, z)) for (x, z) in spine[:-1]] + [V((tip.x - 0.1 * k, 0, tip.z - 0.8 * k))]
    tube(bm, sp_pts, [(0.72 * k, t_sp * 1.12)] * (len(sp_pts) - 1) + [(0.3 * k, 0.3 * k)], nseg=8,
         ref=V((1, 0, 0)))
    out.append(("glaive_spine", bm, ["haft"], "glaive"))
    # --- fuller: gold strip on both flats with 3 glass cells (the Q cooldown spine)
    bm = bmesh.new()
    bmg = bmesh.new()
    for yy in (1, -1):
        pts = []
        for i in range(0, 16):
            t = 0.08 + 0.72 * i / 15
            z = bb + 0.6 * k + Lb * t
            w = W * (1 - t ** 1.9) ** 0.72
            pts.append(V((sx + w * 0.22, yy * (t_sp * 0.95 + 0.15 * k), z)))
        tube(bm, pts, [(0.8 * k, 0.2 * k)] * len(pts), nseg=6, ref=V((1, 0, 0)))
        for t in (0.20, 0.40, 0.60):
            z = bb + 0.6 * k + Lb * t
            w = W * (1 - t ** 1.9) ** 0.72
            c = V((sx + w * 0.22, yy * (t_sp * 0.95 + 0.35 * k), z))
            dia = [(0, 1.0 * k), (0.6 * k, 0), (0, -1.0 * k), (-0.6 * k, 0)]
            polygon_prism(bmg, dia, c, V((1, 0, 0)), V((0, 0, 1)), V((0, yy, 0)), 0.3 * k)
    out.append(("glaive_fuller", bm, ["gold"], "glaive"))
    out.append(("glaive_spine_glass", bmg, ["glass2"], "glaive_glass"))
    return out


def build(arm):
    H = arm["rosace_height"]
    D = dims(H)
    # rest placement: standing upright at her right side, butt on the floor, edge forward
    place = Matrix.Translation(V((-0.36, -0.06, 0.0))) @ Matrix.Rotation(math.radians(-90), 4, "Z")
    grip = D["grips"]["grip_main"]
    head = place @ V((0, 0, grip))
    tail = place @ V((0, 0, grip + 0.25))
    rig.add_bone(arm, "glaive", head, tail, "Root", deform=True, roll_ref=place.to_3x3() @ V((1, 0, 0)))
    for nm, z in list(D["grips"].items()) + [("glaive_tip", D["L"]), ("glaive_butt", 0.0)]:
        if nm == "grip_main":
            nm = "grip_main"
        rig.add_bone(arm, nm, place @ V((0, 0, z)), place @ V((0, 0, z + 0.08)), "glaive", deform=False,
                     roll_ref=place.to_3x3() @ V((1, 0, 0)))
    obs = []
    for name, bm, mats, part in build_parts(D):
        bm.transform(place)
        ob = bm_to_object(name, bm, mats, arm=arm, smooth=name in ("glaive_haft", "glaive_blade"), part=part)
        if name == "glaive_blade":
            blade_normals(ob, D, place)
        ob["no_ao"] = True
        set_weights(ob, [{"glaive": 1.0} for _ in ob.data.vertices])
        obs.append(ob)
    obs += build_stole(arm, D, place)
    arm["glaive"] = {"length": D["L"], "grips": D["grips"], "disc_c": D["disc_c"], "blade_base": D["blade_base"],
                     "px_per_H": 130, "style": D["style"]}
    return obs


def blade_normals(ob, D, place):
    """Round 2 gear critic: the blade read as a flat slate slab whose value jumped between
    frames (dark in idle, near-white in the pivot), because each flat faced the fixed light
    as one plane. Give the flats a convex cross-section normal (tilting from the spine side
    toward the edge side), so every facing shows a spine-to-edge steel ramp and a glint band
    somewhere across it, whatever the blade's angle to the light."""
    k = D["k"]
    inv = place.inverted()
    R = place.to_3x3()
    W = D["blade_w"]
    sx = -1.3 * k
    out = []
    for v in ob.data.vertices:
        p = inv @ v.co                      # weapon space: flats face +/-Y, edge toward +X
        u = max(-1.0, min(1.0, ((p.x - sx) / max(W, 1e-6)) * 2.0 - 1.0))
        if abs(p.y) < 1e-6:                 # the cutting edge line itself
            n = Vector((1.0, 0.0, 0.0))
        else:
            n = Vector((0.85 * u, 1.0 if p.y > 0 else -1.0, 0.0)).normalized()
        out.append((R @ n).normalized())
    ob.data.normals_split_custom_set_from_vertices(out)


def build_stole(arm, D, place):
    """two tapered ribbon streamers tied under the knop (chains stole_A, stole_B: they lag in
    motion). Round 4: thinner, longer, apart, no end crosses (they read as one lumpy blob)."""
    k = D["k"]
    zt = D["haft_top"] - 2.6 * k
    obs = []
    ln = D.get("stole_lean")
    for name, dx, dy, length, lean in (("stole_A", 2.0 * k, -1.2 * k, D["streamer_len"], 0.16 if ln is None else ln),
                                       ("stole_B", -1.8 * k, 1.0 * k, D["streamer_len"] * 0.8,
                                        -0.12 if ln is None else -ln)):
        top = V((dx, dy, zt))
        pts = [V((dx + lean * length * (i / 3) ** 1.5, dy, zt - length * i / 3)) for i in range(4)]
        bm = bmesh.new()
        rows = []
        nrow = 16
        for i in range(nrow + 1):
            t = i / nrow
            p = V((dx + lean * length * t ** 1.5, dy, zt - length * t))
            tw = D.get("stole_twist", 0.35) * math.sin(t * math.pi * 0.9) if "stole_twist" not in D else                 D["stole_twist"] * t
            w = D["streamer_w"] * (1.0 - D.get("stole_taper", 0.62) * t ** 1.2)
            ax = V((math.cos(tw), math.sin(tw), 0))
            rows.append([p - ax * w / 2, p, p + ax * w / 2])
        g = [[bm.verts.new(q) for q in row] for row in rows]
        for i in range(nrow):
            for j in range(2):
                bm.faces.new((g[i][j], g[i][j + 1], g[i + 1][j + 1], g[i + 1][j]))
        bm.transform(place)
        wpts = [place @ q for q in pts]
        names = rig.add_chain(arm, name, wpts, "glaive")
        mats = ["beige", "white"] if D.get("stole_front") == "beige" else ["white", "beige"]
        ob = bm_to_object(name, bm, mats, arm=arm, part="stole")
        m = ob.modifiers.new("thick", "SOLIDIFY")
        m.thickness = 0.5 * k
        m.offset = 0.0
        m.material_offset = 1
        m.material_offset_rim = 0
        set_weights(ob, [chain_weights(v.co, wpts, names, "glaive", 0.15) for v in ob.data.vertices])
        ob["no_ao"] = True
        obs.append(ob)
    return obs
