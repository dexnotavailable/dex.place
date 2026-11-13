"""Hair v3 (hair lane, round 1): the hair and veil redesigned as a readable clump table.

Why (the v2 stills, 2026-09-29, review/rosace/art/hair/round-1/): the v1 hair builder laid on the v2
head hugs the skull (no volume past it, a smooth helmet outline at 144 and 80 px), a filler lock
crosses the near cheek like a scar, the ahoge reads as a dark antenna (HR-N05), and the veil (23 x 34
px at 144, DESIGN asks 18 x 24) hides the whole back of the head, so the back view is a white slab.

Construction order (ART-RULES HR-P01): skull (head_metrics' fitted ellipsoid) -> hairline and parting
-> flow lines (every clump is a centreline of control points given in head space: azimuth,
elevation, radius factor on the skull ellipsoid) -> clump blobs (lens-section tubes that taper to a
point, hair.lens_clump) -> shadow (one toon ramp over proxy normals, so the hair lights as one mass)
-> the designed highlight (the 'ring' spec in the hair material, tuned here as a palette override).

The clump table (SPEC below), from the face outwards:
  fringe   4 clumps of unequal width from an off-centre parting (DESIGN 6 revision 3.2: about
           4 / 6 / 5 / 3 px), tips on different rows, windows over the brows, the near clumps
           swinging to the near side; two framing clumps beside the eyes (HR-P04), never across
           the eye or down the middle of the face (FC-N17)
  sidelock one each side, temple -> beside the jaw (outside the face contour) -> collarbone,
           S-flow, flicking out to a tapered azure tip; gold cross clasp; chain side_L / side_R
  temple   one silhouette-breaking clump each side above the ear, swinging out and down to a lit
           tip past the skull (HR-P13); no crown cowlick, no ahoge (FC-P01, HR-N05)
  mantle   big crown-to-ring clumps standing off the skull (HR-P02: 2 px of volume at the crown)
  layer    outer back layers that end at the shoulders in outward flicks (the hime cut's long
           layers, ref 09's jagged side silhouette), weighted to the back chain so they swing
  tail     three clumps from the gold ring to mid-thigh, fanning to five tapered azure tips;
           chain hair_tail (4 bones, one more than v2, so the tail arcs instead of hinging)

Variants: build(arm, face) reads VARIANT (a dict merged over SPEC) so the lane can A/B one axis at a
time without editing this file (hair_lane_build.py sets it from --variant).

Runs inside Blender. The chains keep the v2 names (hair_back, hair_tail, side_L, side_R, veil):
posing.drape and the motion lane's springs (tools/motion-ai/hero_layer.CHAIN_DYN) key on them.
"""
import copy
import math

import bmesh
import bpy
from mathutils import Vector

from . import hair as H
from . import rig
from .common import lerp, smoothstep
from .geo import bm_to_object, catmull, chain_weights, set_weights, tube

V = Vector
E = H.E

# ---------------------------------------------------------------------------- the design table
# lengths in metres at the build scale (1 px at 144 = 0.0132 m); angles in degrees
SPEC = {
    # skull volume: radius factor on the fitted skull ellipsoid where the mantle crosses the crown
    # and the ears (v2 hair: 1.10 / 1.14, which the MMD skull's bulge ate; ~1 px at 144)
    "crown_k": 1.17, "ear_k": 1.21, "cap_off": 0.016,
    "parting_az": 14.0,
    # fringe: (root az, tip x (m, her frame), tip dz from the eye centre (m), root width, peak width)
    # tip x None = follow the root azimuth; widths give 4 / 6 / 5 / 3 px in three-quarter view
    "fringe": [
        {"az": -52, "tip_x": -0.116, "tip_dz": 0.012, "w": 0.026, "name": "frame_near"},
        {"az": -28, "tip_x": -0.052, "tip_dz": 0.068, "w": 0.052, "name": "over_near"},
        {"az": -4, "tip_x": -0.010, "tip_dz": 0.030, "w": 0.044, "name": "centre"},
        {"az": 22, "tip_x": 0.048, "tip_dz": 0.074, "w": 0.040, "name": "over_far"},
        {"az": 48, "tip_x": 0.114, "tip_dz": 0.016, "w": 0.024, "name": "frame_far"},
    ],
    "fringe_sweep": True,            # one lock from the parting across the near clumps (DESIGN 6)
    "fringe_front_k": 1.14,
    # sidelocks: x at the jaw (m from the centre line), end drop below the chin, end flick out
    "side_jaw_x": 0.122, "side_drop": 0.215, "side_flick": 0.055, "side_w": 0.030, "side_ear_w": 0.048,
    # round 2 (critique 6: framing): extra x per side at the jaw (L = her left = the far side in the
    # idle), the hime cut (None = v3's tapered flick; a dict = a blunt panel cut straight across at
    # 'drop' below the chin, 'w' half-width at the cut, azure over the last 'tip_from' of the lock),
    # and the near lock split into two clumps (the second one outboard and a little behind)
    "side_jaw_dx": {"L": 0.0, "R": 0.0}, "side_cut": None, "side_split": None,
    "layer_tips": True,              # azure tips on the shoulder layers too
    # temple breakers: tip radius factor and drop below the eye (m)
    "temple": True,
    # (root azimuth and elevation, the radius factor where it swings out, the tip in metres: x from
    # the centre line, dy from the skull centre, dz from the chin)
    "flicks": [
        {"az": 78, "el": 44, "k": 1.26, "x": 0.200, "dy": -0.035, "dz": 0.035, "w": 0.040, "part": "temple"},
        {"az": 108, "el": 34, "k": 1.30, "x": 0.228, "dy": 0.030, "dz": -0.045, "w": 0.042, "part": "flick"},
    ],
    # mantle clumps: (azimuth, width)
    "mantle": [(118, 0.058), (148, 0.072), (180, 0.076), (212, 0.072), (242, 0.058)],
    # outer layers ending in shoulder flicks: (azimuth, width, tip drop below the shoulder joint)
    "layers": [(104, 0.040, 0.03), (128, 0.046, 0.075), (232, 0.046, 0.06), (256, 0.040, 0.02)],
    "layer_flick": 1.55,             # tip x as a factor of the skull x radius
    # tail: sub-clumps (dx at the ring, width, extra length)
    "tail": [(-0.030, 0.020, -0.03), (-0.013, 0.024, 0.02), (0.004, 0.026, 0.045),
             (0.020, 0.022, 0.0), (0.034, 0.018, -0.045)],
    "tail_bones": 4,
    # round 2 (critique 3: the back view's hose): the tail as n ribbons with their own part ids (a
    # separation line where one overlaps the next) and an S-curve of amplitude tail_s (m) along it
    "tail_ribbons": 0, "tail_s": 0.0,
    # round 2: the mantle's back masses swing apart at the shoulder blades and back (m)
    "mantle_s": 0.0,
    "ahoge": False,
    "tip_start": 0.70,
    "part_mode": "grouped",          # 'grouped': part ids per design group; 'each': per tube (v2)
    # lit strands (u = lateral position on the parent clump, -1..1 of its half-width); t0..t1 the
    # stretch of the parent they run along; w the strand half-width (m: 0.006 ~ 1 px at 144)
    "strands": {"on": True, "groups": {"mantle": [-0.35, 0.4], "layer": [0.1], "temple": [0.0],
                                       "side_L": [0.25], "side_R": [0.25]},
                "t0": 0.22, "t1": 0.78, "w": 0.0062, "lift": 0.0025, "wobble": 0.18, "tilt": 55},
    # the side masses behind the sidelock share one part per side (v3 r1: temple, flick, layer and
    # mantle stacked 4 separation lines into 8 px beside the near cheek, parallel stripes: HR-N04)
    "side_parts": {"temple": "sidemass", "flick": "sidemass", "layer": "sidemass"},
    # the designed angel ring (sheen_normals): band centre and half-width in skull elevation, the
    # normal elevation it is re-aimed to (inside the hair spec's y window at the game camera's 8
    # degree elevation), the band-free zone every other normal is kept out of, per-group row offsets
    "sheen": {"on": True, "el": 40, "half": 4.5, "normal_el": 50, "clear": (34, 68), "min_el": 12,
              "offsets": {"mantle_L": -3, "mantle_C": 0, "mantle_R": 3, "fringe_over_near": 5,
                          "fringe_centre": 2, "fringe_over_far": -2, "fringe_sweep": 6, "layer_L": -5,
                          "layer_R": 4, "temple_L": -6, "temple_R": -6, "flick_L": -4, "flick_R": -4,
                          "sidemass_L": -4, "sidemass_R": -5,
                          "fringe_frame_near": 1, "fringe_frame_far": -1}},          # 'grouped': part ids per design group; 'each': per tube (v2)
    # hair materials (palette overrides on the v2 scene). v2's hair ramp put the whole shadow side in
    # I4: the unlit value is the ambient term 0.16 x ao, under t[1] = 0.22, so 50-67% of the hair
    # was I4 at 144 and 80 (HR-P07 wants I4 <= 15%, HR-N03). t[1] = 0.13 puts the open shadow side
    # in I3 and leaves I4 to baked occlusion (overlaps, under the sidelocks: HR-P12); the ring gate
    # (lit = light > t[1]) then passes on the shadow side too, so the ring is fenced to the side
    # facing the key light by xmin
    "materials": {
        "hair": {"ramp": ["I4", "I3", "I2", "I1"], "t": [0.0, 0.13, 0.42, 0.78],
                 "spec": {"code": "I0", "mode": "ring", "y0": 0.52, "y1": 0.84, "zmin": 0.3, "xmin": -0.15}},
        # tips: A3 in shadow, A4 lit (HR-P09: no A2 step, A2 on I1/I2 is under 1.5:1)
        "hairtip": {"ramp": ["I3", "A3", "A3", "A4"], "t": [0.0, 0.12, 0.40, 0.66]},
    },               # azure from this fraction of a tipped clump (HR-P09)
    # veil (refit.build_veil_v2 replaced by build_veil): top edge elevation at the back centre and
    # at the sides, azimuth span at the top and at the hem, radius factors, hem drop, point depth
    # round 1 pick: az 50 / 70 (v3_veilwide) measured 17 x 24 px in the N2 back view at 144 (DESIGN 2:
    # 18 x 24) and shows 2-3 px of white past the hair in the idle (the veil-behind-the-head read);
    # 36 / 44 hid behind the bigger hair mass (idle: 2 veil px; N2: 14 x 23)
    "veil": {"top_el": 32, "side_el": 14, "az_top": 50, "az_hem": 70, "k": 1.16, "k_hang": 1.20,
             "hem_z_off": 0.035, "point": 0.085, "folds": 0.006, "flare": 0.05, "hem_mat": 3},
    # the gold rose pin (DESIGN 1): direction on the veil's top edge and size (m radius)
    "pin": {"az": 150, "el": 70, "r": 0.026, "lift": 0.012},
}
VARIANT = {}
INFO = {}


def spec():
    S = copy.deepcopy(SPEC)
    for k, v in VARIANT.items():
        if isinstance(v, dict) and isinstance(S.get(k), dict):
            S[k].update(v)
        else:
            S[k] = v
    return S


# ---------------------------------------------------------------------------- build
def build(arm, face):
    S = spec()
    body = bpy.data.objects["body"]
    M = H.head_metrics(arm, body, face)
    arm["head_metrics"] = {k: (list(v) if hasattr(v, "__len__") else v) for k, v in M.items()}
    surf = H.Surface([body, face])
    C, R = M["C"], M["R"]
    head_bone = "J_Bip_C_Head"
    B = arm.data.bones
    eyeL = B["J_Adj_L_FaceEye"].head_local.copy()
    eye_z = M["eye"].z
    fy = M["forehead_y"]
    objs = {}

    def back_y(z, x=0.0):
        hit = surf.bvh.ray_cast(V((x, 0.6, z)), V((0, -1, 0)), 1.0)
        return hit[0].y if hit[0] is not None else 0.1

    # ---- chains (as v2: the long hair hangs from the neck)
    hips = M["hips"]
    gather_z = hips.z + 0.02
    tail_end_z = lerp(M["hip_joint_z"], M["knee_z"], 0.45)       # mid-thigh (DESIGN 2)
    nape = E(M, 180, -40, 1.02)
    blade_z = M["chest"].z
    back_chain = [nape, V((0, back_y(blade_z) + 0.05, blade_z)),
                  V((0, back_y(hips.z + 0.18) + 0.07, hips.z + 0.18)),
                  V((0, back_y(gather_z) + 0.075, gather_z))]
    nb = S["tail_bones"]
    tail_chain = [back_chain[-1]]
    for i in range(1, nb + 1):
        u = i / nb
        z = lerp(gather_z, tail_end_z, u)
        y = max(back_y(z, 0.06), back_y(z, 0.0)) + 0.055 - 0.02 * u * u
        tail_chain.append(V((0, y, z)))
    b_back = rig.add_chain(arm, "hair_back", back_chain, "J_Bip_C_Neck")
    b_tail = rig.add_chain(arm, "hair_tail", tail_chain, b_back[-1])
    chain_pts = back_chain + tail_chain[1:]
    chain_bones = b_back + b_tail

    # ---- cap: the scalp between clump roots, lifted with the crown volume
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=28, radius=1.0)
    kill = []
    for v in bm.verts:
        d = v.co.copy()
        az = math.degrees(math.atan2(d.x, -d.y))
        el = math.degrees(math.asin(max(-1, min(1, d.z))))
        p = E(M, az, el, 1.3)
        q, n, _, _ = surf.bvh.find_nearest(p)
        lift = S["cap_off"] * smoothstep(-30, 40, el) + 0.008
        v.co = q + n * lift if q is not None else p
        # the hairline: the forehead edge under the fringe, dropping at the temples to the
        # sideburn in front of the ear (v3 round 1: a flat el < 40 cut left the scalp showing
        # between the fringe's outer clump and the sidelock root)
        a = abs(az)
        line = (24 if a < 40 else lerp(24, 2, (a - 40) / 35) if a < 75 else
                lerp(2, -14, (a - 75) / 30) if a < 105 else lerp(-14, -48, min(1, (a - 105) / 15)))
        if el < line:
            kill.append(v)
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    cap = bm_to_object("hair_cap", bm, ["hair"], arm=arm, part="hair")
    cap["ao_dist"], cap["ao_strength"] = 0.025, 0.35
    set_weights(cap, [{head_bone: 1.0} for _ in cap.data.vertices])
    objs["cap"] = cap

    bm = bmesh.new()
    tip_idx = []
    groups = []
    clump_log = []

    def add_clump(ctrl, n, wprof, tprof, clear=0.012, push=True, tipmat=False, group="head", tip_from=None,
                  part=None):
        pts = catmull(ctrl, n)
        if push:
            pts = surf.push_line(pts, [clear + tprof[i] * 0.8 for i in range(n)])
        v0 = len(bm.verts)
        rings = H.lens_clump(bm, pts, wprof, tprof, M)
        v1 = len(bm.verts)
        groups.append((v0, v1, group, part or group))
        clump_log.append({"pts": pts, "w": wprof, "t": tprof, "part": part or group, "group": group})
        if tipmat:
            L, ns = len(rings), len(rings[0])
            t0 = S["tip_start"] if tip_from is None else tip_from
            for i in range(L):
                if i / (L - 1) > t0:
                    tip_idx.extend(range(v0 + i * ns, v0 + (i + 1) * ns))
            tip_idx.append(v1 - 1)                     # the tip cap vertex (created last)
        return pts

    # ---- fringe from the parting
    par = S["parting_az"]
    for f in S["fringe"]:
        az = f["az"]
        root = E(M, par + (az - par) * 0.35, 66, 1.03)
        mid = E(M, par + (az - par) * 0.85, 38, 1.10)
        front = E(M, az, 16, S["fringe_front_k"])
        tx = f["tip_x"] if f.get("tip_x") is not None else front.x
        tip = V((tx, fy - 0.014 - 0.02 * abs(tx) / 0.1, eye_z + f["tip_dz"]))
        # the tip curls toward its own side (near clumps to the near side, far to the far)
        n = 16
        add_clump([root, mid, front, tip], n, H.taper(n, f["w"] * 0.8, f["w"], 0.0, 0.25, 0.55),
                  H.taper(n, 0.010, 0.013, 0.002, 0.25, 0.5), clear=0.006, group="fringe",
                  part=f.get("part", "fringe_" + f["name"]))
    if S["fringe_sweep"]:
        root = E(M, par + 4, 72, 1.04)
        mid = E(M, par - 12, 46, 1.13)
        front = E(M, -18, 22, S["fringe_front_k"] + 0.03)
        tip = V((-0.034, fy - 0.022, eye_z + 0.088))
        n = 14
        add_clump([root, mid, front, tip], n, H.taper(n, 0.022, 0.030, 0.0, 0.3, 0.5),
                  H.taper(n, 0.009, 0.011, 0.002, 0.3, 0.5), clear=0.016, group="fringe", part="fringe_sweep")

    # ---- sidelocks: temple -> beside the jaw -> collarbone, flicking out
    side_pts = {}
    chin = M["chin"]
    for s, sd in ((1, "L"), (-1, "R")):
        root = E(M, s * 64, 36, 1.04)
        jdx = S["side_jaw_dx"].get(sd, 0.0)
        jx = S["side_jaw_x"] + jdx
        temple = V((s * (R.x * 1.12 + jdx * 0.5), C.y - R.y * 0.30, eye_z + 0.005))
        jaw = V((s * jx, C.y - R.y * 0.38, chin + 0.03))
        cut = S["side_cut"]
        n = 20
        w = S["side_w"]
        if cut:
            # the hime cut: the panel hangs straight past the jaw and stops blunt, cut straight
            # across (the lens tube keeps its width to the last ring; the end cap is the flat cut)
            low = V((s * (jx + 0.002), C.y - R.y * 0.36, chin - cut["drop"] * 0.45))
            end = V((s * (jx + cut.get("out", 0.006)), C.y - R.y * 0.33, chin - cut["drop"]))
            wp = H.taper(n, w * 0.8, w, cut["w"], 0.25, 0.30)
            tprof = H.taper(n, 0.011, 0.014, 0.008, 0.25, 0.3)
            tip_from = cut.get("tip_from", 0.86)
        else:
            low = V((s * (jx - 0.004), C.y - R.y * 0.34, chin - 0.10))
            end = V((s * (jx + S["side_flick"]), C.y - R.y * 0.20, chin - S["side_drop"]))
            # half-widths: wide over the ear (the MMD head has ears; v3 first build showed the lobe
            # between the lock and the jaw), narrowing to the jaw, then the long taper
            wp = H.taper(n, w * 0.8, w, 0.0, 0.25, 0.32)
            tprof = H.taper(n, 0.011, 0.014, 0.002, 0.25, 0.3)
            tip_from = None
        for i in range(n):
            wp[i] = max(wp[i], S["side_ear_w"] * math.exp(-((i / (n - 1) - 0.16) / 0.10) ** 2))
        pts = add_clump([root, temple, jaw, low, end], n, wp, tprof, clear=0.010, tipmat=True,
                        group="side_" + sd, tip_from=tip_from)
        side_pts[sd] = pts
        sp2 = S["side_split"]
        if sp2 and sd == sp2.get("side", "R"):
            # a second clump outboard of the near lock and a little behind it, ending in a taper
            # on a different row: the near slab reads as two clumps (critique 6)
            o = sp2.get("dx", 0.022)
            r2 = E(M, s * 74, 30, 1.05)
            t2 = V((s * (R.x * 1.16 + o * 0.5), C.y - R.y * 0.18, eye_z - 0.01))
            j2 = V((s * (jx + o), C.y - R.y * 0.22, chin + 0.01))
            e2 = V((s * (jx + o + sp2.get("flick", 0.03)), C.y - R.y * 0.10, chin - sp2.get("drop", 0.16)))
            add_clump([r2, t2, j2, e2], 16, H.taper(16, 0.020, sp2.get("w", 0.026), 0.0, 0.25, 0.4),
                      H.taper(16, 0.010, 0.012, 0.002, 0.25, 0.4), clear=0.014, tipmat=True,
                      group="side_" + sd, part="side_" + sd + "2", tip_from=0.78)
    for sd in "LR":
        pts = side_pts[sd]
        rig.add_chain(arm, f"side_{sd}", [pts[5], pts[10], pts[15], pts[-1]], head_bone)

    # ---- temple breakers (above the ear, behind the sidelock) and side flicks: the pointed
    # tips that break the head's silhouette past the skull (HR-P13; refs 07, 08, 09 all carry
    # 3-5 px tips flaring out at the cheek, jaw and shoulder). The tip is given in explicit
    # metres from the centre line: v3's first temple tip sat at E(108, -40, 1.46), which is only
    # 0.136 m out (cos -40), inside the mass, so it never reached the silhouette
    if S["temple"]:
        for s in (1, -1):
            for fl in S["flicks"]:
                r0 = E(M, s * fl["az"], fl["el"], 1.03)
                r1 = E(M, s * (fl["az"] + 12), fl["el"] - 36, fl["k"])
                tip = V((s * fl["x"], C.y + fl["dy"], chin + fl["dz"]))
                r2 = r1.lerp(tip, 0.55) + V((s * 0.012, 0, 0.01))
                n = 14
                w = fl["w"]
                add_clump([r0, r1, r2, tip], n, H.taper(n, w * 0.8, w, 0.0, 0.25, 0.45),
                          H.taper(n, 0.010, 0.012, 0.002, 0.25, 0.45), clear=0.012, group="temple",
                          part=S["side_parts"].get(fl["part"], fl["part"]) + ("_L" if s > 0 else "_R"))

    # ---- mantle: crown -> nape -> gather ring
    G = tail_chain[0]
    for az, w in S["mantle"]:
        s = math.sin(math.radians(az))
        root = E(M, 180 + (az - 180) * 0.30, 62, 1.0)
        crown = E(M, az, 32, S["crown_k"])
        ear = E(M, az, -22, S["ear_k"])
        nk = E(M, 180 + (az - 180) * 0.78, -62, S["ear_k"] - 0.04)
        spread = s * 0.13
        ms = S["mantle_s"] * (1 if az < 175 else -1 if az > 185 else 0.4)
        blade = V((spread + ms, back_y(blade_z, spread) + 0.035, blade_z))
        low = V((spread * 0.55 - ms * 0.8, back_y(hips.z + 0.12, spread * 0.55) + 0.05, hips.z + 0.12))
        g = V((G.x + s * 0.018, G.y + 0.004, G.z))
        n = 26
        add_clump([root, crown, ear, nk, blade, low, g], n,
                  H.taper(n, w * 0.7, w, w * 0.45, 0.18, 0.12, root=1.0),
                  H.taper(n, 0.013, 0.017, 0.010, 0.2, 0.2), clear=0.012, group="mantle",
                  part="mantle_" + ("L" if az < 165 else "R" if az > 195 else "C"))

    # ---- outer layers: crown side -> shoulder, flicking outward to a point
    for az, w, drop in S["layers"]:
        s = 1 if az < 180 else -1
        root = E(M, 180 + (az - 180) * 0.45, 50, 1.02)
        crown = E(M, az, 20, S["crown_k"] + 0.02)
        ear = E(M, az, -30, S["ear_k"] + 0.05)
        sh = V((s * R.x * 1.30, C.y + R.y * 0.25, M["shoulder_z"] + 0.03))
        tip = V((s * R.x * S["layer_flick"], C.y + R.y * 0.15, M["shoulder_z"] - drop))
        n = 18
        add_clump([root, crown, ear, sh, tip], n, H.taper(n, w * 0.8, w, 0.0, 0.2, 0.40),
                  H.taper(n, 0.011, 0.014, 0.002, 0.2, 0.4), clear=0.012, tipmat=S["layer_tips"], group="layer", part=S["side_parts"].get("layer", "layer") + ("_L" if s > 0 else "_R"),
                  tip_from=0.82)

    # ---- tail: fans out of the ring to tapered azure tips
    nrib = S["tail_ribbons"]
    for ti, (dx, w, dl) in enumerate(S["tail"]):
        # ribbons: sub-clumps grouped left to right into nrib parts; each ribbon's S-curve has its
        # own phase so they overlap and cross (critique 3: 2-3 ribbons, not one hose)
        rib = min(nrib - 1, ti * nrib // len(S["tail"])) if nrib else 0
        amp = S["tail_s"]
        ph = rib * 1.9
        pts_c = [V((G.x + dx * 0.4, G.y, G.z - 0.01))]
        for i, p in enumerate(tail_chain[1:]):
            u = (i + 1) / nb
            sx = amp * math.sin(u * math.pi * 1.6 + ph) * u
            pts_c.append(V((p.x + dx * (0.5 + 1.4 * u * u) + sx,
                            p.y + 0.004 * math.sin(7 * dx + u * 3) + (0.006 * rib if nrib else 0), p.z)))
        pts_c[-1] = pts_c[-1] + V((dx * 0.9, -0.005, -dl))
        n = 24
        add_clump(pts_c, n, H.taper(n, w * 0.9, w, 0.0, 0.2, 0.34, root=1.0),
                  H.taper(n, 0.011, 0.013, 0.002, 0.2, 0.3), clear=0.015, tipmat=True, group="tail",
                  part=("tail_" + "abc"[rib]) if nrib else "tail")

    if S["ahoge"]:
        top = V((C.x + 0.004, C.y - R.y * 0.25, C.z + R.z * 1.02))
        add_clump([top, top + V((0.006, 0.004, 0.040)), top + V((0.030, -0.012, 0.068)),
                   top + V((0.058, -0.028, 0.052))], 12, H.taper(12, 0.010, 0.009, 0.0, 0.2, 0.5),
                  H.taper(12, 0.004, 0.004, 0.001), push=False)

    # ---- lit strands over the masses (the refs' lighter strands along the flow inside dark hair:
    # 07's grey strands in the black mass, 09's shading lines): thin tubes lying on a clump's outer
    # surface, in that clump's own part (so the post-process draws no separation line round them)
    # and with normals tilted up and out (strand_normals), so they read one tone lighter than the
    # shadow side they cross; each wanders 1 px every few rows (HR-N04)
    st = S["strands"]
    n_strands = 0
    if st["on"]:
        base = list(clump_log)
        for ci, c in enumerate(base):
            us = st["groups"].get(c["group"])
            if not us:
                continue
            pts, wp, tp = c["pts"], c["w"], c["t"]
            n = len(pts)
            for k, u in enumerate(us):
                i0, i1 = int(n * st["t0"]), int(n * st["t1"])
                i0 += (ci + k) % 3
                sp, hw, ht = [], [], []
                for i in range(i0, i1):
                    p = pts[i]
                    t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
                    o = p - H.core_point(M, p)
                    o = (o - t * o.dot(t)).normalized()
                    sx = t.cross(o).normalized()
                    f = (i - i0) / max(1, i1 - i0 - 1)
                    wob = st["wobble"] * math.sin(f * math.pi * 3.0 + ci * 1.7 + k)
                    sp.append(p + o * (tp[i] * 0.95 + st["lift"]) + sx * (u + wob) * wp[i])
                    hw.append(st["w"] * math.sin(math.pi * min(1.0, 0.15 + 0.85 * f)) ** 0.6 + 0.0008)
                    ht.append(0.0025)
                if len(sp) < 4:
                    continue
                v0 = len(bm.verts)
                H.lens_clump(bm, sp, hw, ht, M, nseg=6)
                groups.append((v0, len(bm.verts), "strand", c["part"]))
                n_strands += 1
    INFO["strands"] = n_strands

    tipset = set(tip_idx)
    clumps = bm_to_object("hair_clumps", bm, ["hair", "hairtip"], arm=arm, part="hair")
    me = clumps.data
    # bm_to_object may reorder faces but keeps vertex order
    for p in me.polygons:
        if sum(1 for vi in p.vertices if vi in tipset) >= 3:
            p.material_index = 1
    grp = [None] * len(me.vertices)
    pname = sorted({g[3] for g in groups})
    pidx = [0] * len(me.vertices)
    for v0, v1, g, pn in groups:
        for i in range(v0, v1):
            grp[i] = g
            pidx[i] = pname.index(pn)
    at = me.attributes.new("hpart", "INT", "POINT")
    at.data.foreach_set("value", pidx)
    at = me.attributes.new("hstrand", "INT", "POINT")
    at.data.foreach_set("value", [1 if g == "strand" else 0 for g in grp])
    side_chains = {sd: rig.CHAINS[f"side_{sd}"] for sd in "LR"}
    per = []
    for v in me.vertices:
        p, g = v.co, grp[v.index]
        if g and g.startswith("side_"):
            sp = side_pts[g[-1]]
            per.append(chain_weights(p, [sp[5], sp[10], sp[15], sp[-1]], side_chains[g[-1]], head_bone, 0.35))
        elif g in ("mantle", "tail"):
            per.append({head_bone: 1.0} if p.z > nape.z + 0.01 else
                       chain_weights(p, chain_pts, chain_bones, head_bone, 0.3))
        elif g == "layer":
            # the layers swing from the nape down: head above the ear, then the first back bone
            k = smoothstep(M["eye"].z - 0.06, M["shoulder_z"] - 0.02, p.z)
            k = 1.0 - k
            per.append({head_bone: k, b_back[0]: 1.0 - k} if k < 0.999 else {head_bone: 1.0})
        else:
            per.append({head_bone: 1.0})
    set_weights(clumps, per)
    # one object per clump: each clump its own part id, so the post-process draws the separation
    # lines where clumps overlap (rosace_post: nearer, different clump)
    bpy.ops.object.select_all(action="DESELECT")
    clumps.select_set(True)
    bpy.context.view_layer.objects.active = clumps
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    pieces = [o for o in bpy.context.selected_objects if o.name.startswith("hair_clumps")]
    pieces.sort(key=lambda o: (-round(max(v.co.z for v in o.data.vertices), 3),
                               round(sum(v.co.x for v in o.data.vertices), 2)))
    from .geo import set_part
    # part ids by design group (SPEC part_mode 'grouped'): the separation lines then fall only
    # between the designed clumps (fringe clumps, sidelocks, temples, the three back masses, the
    # layers, the tail), not between every tube of one mass (v3 first build: 24 part ids drew a
    # crosshatch of I4 lines over the back hair at 144)
    for i, o in enumerate(pieces):
        o.name = f"hair_clump_{i:02d}"
        o.data.name = o.name
        pn = pname[o.data.attributes["hpart"].data[0].value]
        set_part(o, f"hair_{pn}" if S["part_mode"] == "grouped" else f"hair_{i:02d}")
        o["hair_group"] = pn
        o["hair_strand"] = bool(o.data.attributes["hstrand"].data[0].value)
        o["ao_dist"], o["ao_strength"] = 0.025, 0.4
    if S["part_mode"] == "grouped":
        set_part(cap, "hair_mantle_C")
    objs["clumps"] = pieces
    for o in pieces + [cap]:
        if o.get("hair_strand"):
            strand_normals(o, M, S["strands"]["tilt"])
            continue
        H.proxy_normals(o, M, S.get("proxy", 0.8))
        if S["sheen"]["on"]:
            sheen_normals(o, M, S["sheen"], o.get("hair_group", "mantle_C"))
    INFO["clumps"] = len(pieces)

    # ---- gold ring at the gather, clasps on the sidelocks
    bm = bmesh.new()
    tube(bm, [G + V((0, 0, 0.012 - i * 0.012)) for i in range(3)], [(0.042, 0.022)] * 3, nseg=12,
         ref=V((1, 0, 0)))
    ring = bm_to_object("hair_ring", bm, ["gold"], arm=arm, part="gold_hair")
    set_weights(ring, [{b_back[-1]: 1.0} for _ in ring.data.vertices])
    bm = bmesh.new()
    from .geo import plain_cross_outline, polygon_prism
    for sd in "LR":
        sp = side_pts[sd]
        ci = S.get("clasp_i", 13)
        c = sp[ci]
        t = (sp[ci + 1] - sp[ci - 1]).normalized()
        o = (c - V((0, C.y, c.z))).normalized()
        o = (o - t * o.dot(t)).normalized()
        s_ax = t.cross(o).normalized()
        polygon_prism(bm, plain_cross_outline(0.040, 0.010, 0.006, 0.030), c + o * 0.016, s_ax, -t, o, 0.006)
    clasps = bm_to_object("hair_clasps", bm, ["gold"], arm=arm, smooth=False, part="gold_hair")
    set_weights(clasps, [{side_chains["L" if v.co.x > 0 else "R"][1]: 1.0} for v in clasps.data.vertices])

    # ---- veil, pins: through rosace.hair's names so the v2 refit's swap still applies
    objs["veil"] = H.build_veil(arm, M, surf)
    objs["pin"] = H.build_pin(arm, M)
    objs["veil_pins"] = H.build_veil_pins(arm, M)
    return objs


def _on_veil(M, az, el, lift=0.010):
    """point and outward normal on the veil's outer surface in the direction (az, el) from the skull
    centre; None when the veil does not cover that direction"""
    from .geo import object_bvh
    bvh, _ = object_bvh([bpy.data.objects["veil"]])
    C = M["C"]
    d = (E(M, az, el, 1.0) - C).normalized()
    hit = bvh.ray_cast(C + d * 0.6, -d, 0.6)
    if hit[0] is None:
        return None, None
    n = hit[1] if hit[1].dot(d) > 0 else -hit[1]
    return hit[0] + n * lift, n


def _edge_dir(M, az, el0, step=-1.0, lift=0.010):
    """walk the elevation from el0 until the ray meets the veil: the first covered point is the
    veil's top edge in that azimuth"""
    el = el0
    for _ in range(80):
        c, n = _on_veil(M, az, el, lift)
        if c is not None:
            return c, n, el
        el += step
    return None, None, None


def build_pin(arm, M):
    """the gold rose at the crown (DESIGN 1), pinned on the veil's top edge, a little off the back
    centre toward the far (lit) side so it reads in the idle three-quarter view"""
    S_ = spec()
    P = S_["pin"]
    if P.get("on") == "hair":
        # round 2: on the hair of the crown's lit side, where the idle's three-quarter view shows it
        # (on the veil's top edge it sat behind the crown in every front view)
        c = E(M, P["az"], P["el"], S_["crown_k"] + P.get("k", 0.06))
        n = (c - M["C"]).normalized()
    else:
        c, n, _ = _edge_dir(M, P["az"], P["el"], lift=P["lift"])
    bm = bmesh.new()
    u = n.orthogonal().normalized()
    w = n.cross(u)
    ring = [bm.verts.new(c + (u * math.cos(2 * math.pi * k / 16) + w * math.sin(2 * math.pi * k / 16))
                         * P["r"] * (1.0 if k % 2 == 0 else 0.78)) for k in range(16)]
    ctr = bm.verts.new(c + n * 0.008)
    back = bm.verts.new(c - n * 0.006)
    for k in range(16):
        bm.faces.new((ring[k], ring[(k + 1) % 16], ctr))
        bm.faces.new((ring[(k + 1) % 16], ring[k], back))
    ob = bm_to_object("rose_pin", bm, ["gold"], arm=arm, smooth=False, part="gold_hair")
    set_weights(ob, [{"J_Bip_C_Head": 1.0} for _ in ob.data.vertices])
    return ob


def build_veil_pins(arm, M):
    """a small gold cross each side where the veil's front edge meets the hair (round 4 face
    critic: something gold and cross-shaped on the head ties it to the outfit)"""
    from .geo import plain_cross_outline, polygon_prism
    V_ = spec()["veil"]
    bm = bmesh.new()
    for s in (1, -1):
        # on the veil's side edge at the ear line, where it shows past the hair in a turned head
        az = 180 - s * (V_["az_hem"] - 4)
        c, n, _ = _edge_dir(M, az, 5, lift=0.004)
        if c is None:
            continue
        u = V((0, 0, 1)).cross(n).normalized()
        w = n.cross(u).normalized()
        polygon_prism(bm, plain_cross_outline(0.050, 0.012, 0.009, 0.036), c, u, w, n, 0.006)
    ob = bm_to_object("veil_pins", bm, ["gold"], arm=arm, smooth=False, part="gold_hair")
    set_weights(ob, [{"J_Bip_C_Head": 1.0} for _ in ob.data.vertices])
    return ob


# ---------------------------------------------------------------------------- designed highlight
def strand_normals(ob, M, tilt):
    """a lit strand: the normal points out from the hair's core, tilted up by 'tilt' degrees, so
    the key light (camera-relative, from above and the right) lights it on the shadow side too"""
    e = math.radians(tilt)
    out = []
    for v in ob.data.vertices:
        o = v.co - H.core_point(M, v.co)
        o = V((o.x, o.y, 0.0))
        o = o.normalized() if o.length > 1e-6 else V((0, 1, 0))
        out.append((o * math.cos(e) + V((0, 0, math.sin(e)))).normalized())
    ob.data.normals_split_custom_set_from_vertices(out)


def sheen_normals(ob, M, sh, group):
    """The angel ring as a designed band, not wherever N happens to meet the ring window.

    The hair material's 'ring' spec paints I0 where the camera-space normal points up by a set
    amount (y0..y1), faces the viewer and sits on the key-light side. With the smooth proxy normals
    alone that window caught only the top 1-2 rows of the crown at 144 (v3 first builds: 16-27 I0 px,
    all on rows 55-60, a rim along the top edge, not a ring). Here the band is placed on the skull:
    vertices whose skull elevation is within sh['half'] of the band's centre (sh['el'] plus a per-
    group offset, so the dashes of neighbouring clumps land on different rows, HR-P08) take the
    ellipsoid normal re-aimed to sh['normal_el'], inside the window; every other vertex whose normal
    would fall in the window is pushed out of it (to clear[0] below the band, clear[1] above), so
    no stray I0 appears. Elevations are on the fitted skull ellipsoid, in degrees."""
    C, R = M["C"], M["R"]
    me = ob.data
    if hasattr(me, "corner_normals"):                # the proxy normals just set, per corner
        cur = [V(c.vector) for c in me.corner_normals]
    else:
        me.calc_normals_split()
        cur = [V(l.normal) for l in me.loops]
    per_v = [V() for _ in me.vertices]
    for l, n in zip(me.loops, cur):
        per_v[l.vertex_index] += n
    off = sh["offsets"].get(group, 0.0)
    out = []
    changed = 0
    for v, n0 in zip(me.vertices, per_v):
        d = v.co - C
        q = V((d.x / R.x, d.y / R.y, d.z / R.z))
        if q.length < 1e-6:
            out.append(n0.normalized())
            continue
        el = math.degrees(math.asin(max(-1.0, min(1.0, q.z / q.length))))
        az = math.atan2(q.x, -q.y)
        n = n0.normalized()
        nel = math.degrees(math.asin(max(-1.0, min(1.0, n.z))))
        if el < sh["min_el"]:
            out.append(n)
            continue
        centre = sh["el"] + off
        if abs(el - centre) <= sh["half"]:
            e = math.radians(sh["normal_el"])
            m = V((math.sin(az) * math.cos(e) / R.x, -math.cos(az) * math.cos(e) / R.y, math.sin(e) / R.z))
            n = m.normalized()
            changed += 1
        elif sh["clear"][0] < nel < sh["clear"][1]:
            tgt = sh["clear"][0] if el < centre else sh["clear"][1]
            h = V((n.x, n.y, 0.0))
            h = h.normalized() if h.length > 1e-6 else V((math.sin(az), -math.cos(az), 0.0))
            e = math.radians(tgt)
            n = (h * math.cos(e) + V((0, 0, math.sin(e)))).normalized()
        out.append(n)
    me.normals_split_custom_set_from_vertices(out)
    ob["sheen_verts"] = changed


# ---------------------------------------------------------------------------- veil
def build_veil(arm, M, surf):
    """A short kerchief veil on the back of the head (DESIGN 2: 18 x 24 px at 144, back of the head
    to the shoulder blades; DESIGN 1: 'a dark head with a white veil point'). The top edge sits
    back on the crown and sweeps down toward the ears, so the dark crown and the fringe read from
    the front and 2-3 px of white frame the hair at the sides; the hem narrows to a point at the
    back centre, and the hair mass shows on both sides of it in the back view. Same topology,
    materials, crease folds, gold hem and 'veil' chain as refit.build_veil_v2."""
    from .geo import grid_sheet
    V_ = spec()["veil"]
    C = M["C"]
    nr, nc = 14, 19
    hem_z = M["shoulder_z"] + V_["hem_z_off"]
    rows = []
    for i in range(nr + 1):
        t = i / nr
        row = []
        for j in range(nc + 1):
            u = j / nc
            c = abs(u * 2 - 1)                                       # 0 at the back centre
            half_top, half_hem = V_["az_top"], V_["az_hem"]
            if t < 0.45:
                k = t / 0.45
                half = lerp(half_top, half_hem * 0.95, k)
                az = 180 + (u * 2 - 1) * half
                el_top = lerp(V_["top_el"], V_["side_el"], c ** 1.4)
                el = lerp(el_top, -18, k)
                p = E(M, az, el, V_["k"] + 0.03 * k)
            else:
                k = (t - 0.45) / 0.55
                az = 180 + (u * 2 - 1) * V_["az_hem"]
                p0 = E(M, az, -18, V_["k_hang"])
                sway = math.sin(math.radians(az))
                z1 = hem_z - V_["point"] * (1 - c) ** 1.3
                p = V((p0.x * (1 + 0.05 * k) + sway * V_["flare"] * k,
                       p0.y + 0.035 * k + 0.02 * k * k, lerp(p0.z, z1, k)))
                out_d = V((p.x, p.y - C.y, 0.0))
                if out_d.length > 1e-6:
                    out_d.normalize()
                    p = p + out_d * V_["folds"] * k ** 0.8 * math.sin(u * math.pi * 5 + 0.5)
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
            p.material_index = V_.get("hem_mat", 3)
    cr = ob.data.attributes.get("crease") or ob.data.attributes.new("crease", "FLOAT", "POINT")
    vals = []
    for v in ob.data.vertices:
        i, j = divmod(v.index, nc + 1)
        t, u = i / nr, j / nc
        valley = (-math.sin(u * math.pi * 5 + 0.5) - 0.5) / 0.5
        vals.append(max(0.0, min(1.0, valley * smoothstep(0.5, 0.9, t) * 0.8)))
    cr.data.foreach_set("value", vals)
    m = ob.modifiers.new("thick", "SOLIDIFY")
    m.thickness = 0.008
    m.offset = 1.0
    m.use_even_offset = True
    m.material_offset_rim = 0
    top = E(M, 180, V_["top_el"] - 10, V_["k"])
    mid = E(M, 180, -18, V_["k_hang"])
    low = V((0, mid.y + 0.05, hem_z - V_["point"]))
    names = rig.add_chain(arm, "veil", [top, mid, low], "J_Bip_C_Head")
    per = []
    for v in ob.data.vertices:
        p = v.co
        if p.z > mid.z + 0.02:
            per.append({"J_Bip_C_Head": 1.0})
        else:
            k = smoothstep(mid.z + 0.02, low.z, p.z)
            per.append({"J_Bip_C_Head": 1 - k, names[1]: k})
    set_weights(ob, per)
    ob["no_ao"] = False
    INFO["veil"] = {"top_el": V_["top_el"], "hem_z": round(hem_z, 4), "point_z": round(low.z, 4)}
    return ob


# ---------------------------------------------------------------------------- lane variants
# one design axis each (ART-RULES WF-P04 / saint11-1): 'v3' is the table above as designed
RING_LOW = {"hair": {"ramp": ["I4", "I3", "I2", "I1"], "t": [0.0, 0.13, 0.42, 0.78],
                     "spec": {"code": "I0", "mode": "ring", "y0": 0.42, "y1": 0.62, "zmin": 0.4, "xmin": -0.05}},
            "hairtip": {"ramp": ["I3", "A3", "A3", "A4"], "t": [0.0, 0.12, 0.40, 0.66]}}
VARIANTS = {
    "v3": {},
    "v3_each": {"part_mode": "each"},
    "v3_nostrands": {"strands": {"on": False}},
    "v3_proxy55": {"proxy": 0.55},
    "v3_proxy65": {"proxy": 0.65},
    "v3_sidesplit": {"side_parts": {}},
    "v3_nosheen": {"sheen": {"on": False},
                   "materials": {"hair": {"ramp": ["I4", "I3", "I2", "I1"], "t": [0.0, 0.13, 0.42, 0.78],
                                          "spec": {"code": "I0", "mode": "ring", "y0": 0.6, "y1": 0.8,
                                                   "zmin": 0.4, "xmin": -0.05}},
                                 "hairtip": {"ramp": ["I3", "A3", "A3", "A4"], "t": [0.0, 0.12, 0.40, 0.66]}}},
    "v3_nosweep": {"fringe_sweep": False},
    "v3_ringlow": {"materials": RING_LOW},
    "v3_plainlayers": {"layer_tips": False},
    "v3_big": {"crown_k": 1.24, "ear_k": 1.30, "layer_flick": 1.75},
    "v3_veilmid": {"veil": {"top_el": 40, "az_top": 48, "az_hem": 60, "side_el": 12, "flare": 0.04}},
    "v3_veilnarrow": {"veil": {"az_top": 36, "az_hem": 44, "side_el": 6, "flare": 0.03}},
}

# ---------------------------------------------------------------------------- round 2 variants
# (the round-1 critique, 5/10: a smooth dome, no framing, a far lock hugging the cheek, a hose tail,
# plates for a sheen). Construction here; the pixel-exact parts (dashes, tapers, windows, stamps) are
# rosace/hair_px.py's, run on the render.
R2 = {
    "crown_k": 1.22, "ear_k": 1.26,
    "side_jaw_dx": {"L": 0.014, "R": 0.0},
    "side_cut": {"drop": 0.10, "w": 0.026, "tip_from": 0.86},
    "side_split": {"side": "R", "dx": 0.024, "drop": 0.14, "flick": 0.03},
    "tail_ribbons": 3, "tail_s": 0.03, "mantle_s": 0.02,
    "veil": {"hem_mat": 1},
    "pin": {"az": 128, "el": 64, "r": 0.030, "lift": 0.014},
    "materials": {
        "hair": {"ramp": ["I4", "I3", "I2", "I1"], "t": [0.0, 0.13, 0.38, 0.80],
                 "spec": {"code": "I0", "mode": "ring", "y0": 0.52, "y1": 0.84, "zmin": 0.3, "xmin": -0.15}},
        "hairtip": {"ramp": ["I3", "A3", "A3", "A4"], "t": [0.0, 0.12, 0.40, 0.66]},
    },
}
VARIANTS.update({
    "r2": R2,
    "r2_jaw": dict(R2, side_cut={"drop": 0.045, "w": 0.026, "tip_from": 0.80}),
    "r2_flick": dict(R2, side_cut=None),
    "r2_nosplit": dict(R2, side_split=None),
})

# r2b: the fringe re-cut round the brows (critique 6: no brow windows). The clumps over each eye stop
# above the brow (the face lane's brows then land on skin), the centre clump drops between the eyes to
# the lash row, the framing clumps run past the outer eye corners, the sweep ends over the near brow's
# outer end. Tips land on four different rows (HR-P11).
FRINGE_B = [
    {"az": -52, "tip_x": -0.118, "tip_dz": -0.004, "w": 0.026, "name": "frame_near"},
    {"az": -28, "tip_x": -0.056, "tip_dz": 0.112, "w": 0.046, "name": "over_near"},
    {"az": -4, "tip_x": -0.004, "tip_dz": 0.004, "w": 0.036, "name": "centre"},
    {"az": 22, "tip_x": 0.050, "tip_dz": 0.118, "w": 0.040, "name": "over_far"},
    {"az": 48, "tip_x": 0.116, "tip_dz": 0.008, "w": 0.024, "name": "frame_far"},
]
VARIANTS.update({
    "r2b": dict(R2, fringe=FRINGE_B, fringe_sweep=False),
})

# r2c: the silhouette as clump bulges with tips (critique 2): two more flicks a side, above the temple
# one and below the shoulder one, on different rows; the back masses and the tail ribbons swing wider
# (critique 3); the clasp on the blunt end (critique 7); the rose on the lit crown (critique 7); the
# veil standing 1-2 px past the hair so it reads as one white edge behind the head (critique 7)
FLICKS_C = [
    {"az": 70, "el": 52, "k": 1.24, "x": 0.182, "dy": -0.050, "dz": 0.105, "w": 0.034, "part": "temple"},
    {"az": 78, "el": 44, "k": 1.26, "x": 0.205, "dy": -0.035, "dz": 0.030, "w": 0.040, "part": "temple"},
    {"az": 108, "el": 34, "k": 1.30, "x": 0.232, "dy": 0.030, "dz": -0.050, "w": 0.042, "part": "flick"},
    {"az": 128, "el": 20, "k": 1.30, "x": 0.215, "dy": 0.070, "dz": -0.125, "w": 0.036, "part": "flick"},
]
R2C = dict(R2, fringe=FRINGE_B, fringe_sweep=False, flicks=FLICKS_C, tail_s=0.06, mantle_s=0.04, clasp_i=16,
           pin={"az": 62, "el": 58, "r": 0.030, "lift": 0.014, "on": "hair", "k": 0.05},
           veil={"hem_mat": 1, "k": 1.22, "k_hang": 1.28})
VARIANTS.update({
    "r2c": R2C,
})
# r2d: r2c with the veil standing clear of the bigger hair (k 1.22 hid it: 7 veil px in the idle) and the
# rose lower on the lit side (at el 58 it stood on the crown like a knob)
R2D = dict(R2C, pin={"az": 66, "el": 44, "r": 0.030, "lift": 0.014, "on": "hair", "k": 0.05},
           veil={"hem_mat": 1, "k": 1.34, "k_hang": 1.42, "top_el": 38, "az_top": 56, "az_hem": 74})
VARIANTS.update({"r2d": R2D})
# r2e: the veil between r2c and r2d: k 1.34 all round made a white cape over the whole back hair in the
# back view; here the top hugs the hair and only the hem flares past it, so the 3/4 view shows a white
# edge behind the head and the back view keeps the hair visible on both sides of the veil
R2E = dict(R2D, veil={"hem_mat": 1, "k": 1.27, "k_hang": 1.38, "top_el": 34, "az_top": 50, "az_hem": 64,
                      "flare": 0.07})
VARIANTS.update({"r2e": R2E})
# r2f: r2e with the hair ramp's lit step lower (t[2] 0.38 -> 0.33): more of the form in I2 so the lights
# stay a third of the hair after the pixel pass takes the crown's I1 plates (HR-P07)
R2F = dict(R2E, materials={
    "hair": {"ramp": ["I4", "I3", "I2", "I1"], "t": [0.0, 0.13, 0.33, 0.80],
             "spec": {"code": "I0", "mode": "ring", "y0": 0.52, "y1": 0.84, "zmin": 0.3, "xmin": -0.15}},
    "hairtip": {"ramp": ["I3", "A3", "A3", "A4"], "t": [0.0, 0.12, 0.40, 0.66]}})
VARIANTS.update({"r2f": R2F})
