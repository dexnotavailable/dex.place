"""Stand-in pose -> Rosace rig pose (side view).

The stand-in's per-frame poses (src/lab/art/standin-poses.ts, solved to a 2D skeleton by standin_dump.mjs) are the
code-authored motion for every clip, so driving the Rosace rig from them keeps the game timing, phases and
reach identical to the clip definitions. This module turns one solved stand-in pose into a pose dict in the format
art/rosace/poses/*.json uses (rosace/posing.py + rosace_v2/figure_pose.py read it). Pure python: it runs inside
Blender (the renderer imports it) and outside it (tests).

Coordinates. Stand-in figure space: x forward (screen right), y down, feet on y = 0, a 96 px character. The rig:
+Z up, she faces -Y, her left is +X. The camera is an orthographic view from her right-front (yaw ~62, elev 8), so a
screen point (u right, v up) plus its world X (her left/right) fixes a world point.
Feet, knees, hips, hands and the glaive are placed by their stand-in SCREEN positions, so what the game's hitboxes
and root motion assume about reach and stance is what the rig is asked to draw. Hip height follows the leg
flexion of the stand-in (the rig's legs are longer), the glaive is clamped to what the near arm can reach.
"""
import math

DEG = math.pi / 180.0

# rig constants (probed from rosace.blend, read-only; review/probe/rig.json)
HIPS_HEAD = (0.0, -0.048, 1.165)
HIP_JOINT_DZ = 0.05           # hips bone head above the thigh joints
ANKLE_REST_Z = 0.105          # ik_foot head height at rest (high-heeled boots)
STAND_ANKLE_Y = 3.0           # the stand-in's flat ankle is 3 px above the floor
LEG_LEN = 1.01                # thigh 0.465 + shin 0.545
ARM_LEN = 0.48                # upper arm 0.244 + fore arm 0.236
GLAIVE = {"length": 2.567, "grip_main": 1.489, "grip_mid": 1.206, "grip_off": 0.924}
STANDIN_WEAPON = 110.0        # stand-in spear length in px; the glaive is 130 du (1.35 H)
TORSO_SPLIT_L = (0.30, 0.35, 0.35, 0.0)    # hips, spine, chest, upper chest share of the lower lean
TORSO_SPLIT_C = (0.0, 0.15, 0.45, 0.40)    # ... and of the chest bend


def v_add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def v_sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def v_mul(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def v_dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def v_len(a): return math.sqrt(v_dot(a, a))
def v_norm(a):
    l = v_len(a) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)
def v_cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def v_lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
def r3(v): return [round(float(x), 4) for x in v]


class Cam:
    """rosace/render.py camera_frame, without Blender: yaw 90 = on her right, so she faces screen right."""

    def __init__(self, yaw, elev, H):
        a, e = yaw * DEG, elev * DEG
        h = (-math.sin(a), -math.cos(a), 0.0)
        self.back = v_norm(v_add(v_mul(h, math.cos(e)), (0.0, 0.0, math.sin(e))))
        fwd = v_mul(self.back, -1.0)
        self.right = v_norm(v_cross(fwd, (0.0, 0.0, 1.0)))
        self.up = v_norm(v_cross(self.right, fwd))
        self.du = H / 96.0          # metres per stand-in px

    def w(self, x, y, X=0.0):
        """stand-in screen point (x right, y DOWN, px) at world X (her left +X; near side negative) -> world point"""
        u, v = x * self.du, -y * self.du
        r, up = self.right, self.up
        Y = (u - r[0] * X) / r[1]
        Z = (v - up[0] * X - up[1] * Y) / up[2]
        return (X, Y, Z)

    def dir2(self, dx, dy):
        """a stand-in screen direction (dx right, dy DOWN) as a world direction in the image plane"""
        return v_norm(v_add(v_mul(self.right, dx), v_mul(self.up, -dy)))


def body_pose(entry, cam, yaw, elev, expr_map):
    """Everything but the arms and the weapon: root, torso, head, legs, cloth. Also returns the facts pass 2 needs."""
    p, sk = entry["pose"], entry["sk"]
    st = p.get("stretch", 1.0)
    du = cam.du
    # ankles (screen, px) -> world; the rig's boots stand on their toes at ankle z 0.105
    ank = {}
    for s, key, d in (("R", "ankleN", -0.085), ("L", "ankleF", 0.085)):
        x, y = sk[key]
        pt = cam.w(x, y, d)
        ank[s] = (pt[0], pt[1], pt[2] + (ANKLE_REST_Z - STAND_ANKLE_Y * du))
    # hip height from the stand-in's leg flexion: d_rig = (|hip-ankle| / (thigh+shin)) * rig leg length
    pelvis = sk["pelvis"]
    need = []
    for s, hk, ak, d in (("R", "hipN", "ankleN", -0.085), ("L", "hipF", "ankleF", 0.085)):
        hx, hy = sk[hk]
        ax, ay = sk[ak]
        r = min(0.985, math.hypot(hx - ax, hy - ay) / 46.0)
        dist = r * LEG_LEN
        dy_m = abs(hx - ax) * du / max(0.35, math.sin(yaw * DEG))        # horizontal run along the walking axis
        need.append(ank[s][2] + math.sqrt(max(dist * dist - dy_m * dy_m, (0.25 * dist) ** 2)))
    hip_z = sum(need) / 2.0
    if str(entry.get("key", "")).startswith("sit"):
        # seated: the pelvis rests on the bench (seat top 0.28 H), thighs run forward, knees rise above the hips
        hip_z = -pelvis[1] * du
    hip_world = cam.w(pelvis[0], pelvis[1], 0.0)
    hips_head = (hip_world[0], hip_world[1], hip_z + HIP_JOINT_DZ)
    loc = v_sub(hips_head, HIPS_HEAD)
    # torso: lean at the pelvis, chest bend above it (degrees about the world X axis; + = bend forward)
    L, C = p["lean"], p["chest"]
    hips_x = TORSO_SPLIT_L[0] * L + TORSO_SPLIT_C[0] * C
    spine_x = TORSO_SPLIT_L[1] * L + TORSO_SPLIT_C[1] * C
    chest_x = TORSO_SPLIT_L[2] * L + TORSO_SPLIT_C[2] * C
    uchest_x = TORSO_SPLIT_L[3] * L + TORSO_SPLIT_C[3] * C
    # the stand-in head points along 0.6*torso + 0.5*nod; the rig's neck+head add to the torso angle
    target = 0.6 * (L + C) + 0.5 * p["head"]
    delta = target - (L + C)
    neck_x, head_x = 0.4 * delta, 0.6 * delta
    # feet: pitch from the stand-in toe angle (+ = toes down = heel up), yaw 0 (toes forward)
    feet = {}
    for s, tk in (("R", "toeN"), ("L", "toeF")):
        feet[s] = {"pos": r3(ank[s]), "yaw": 0.0, "pitch": round(float(p.get(tk, 0.0)) * 0.9, 2)}
    # knee poles: toward the stand-in knee, off the hip-ankle line
    poles = {}
    for s, hk, kk, ak, d in (("R", "hipN", "kneeN", "ankleN", -0.09), ("L", "hipF", "kneeF", "ankleF", 0.09)):
        h = cam.w(sk[hk][0], sk[hk][1], d)
        a = cam.w(sk[ak][0], sk[ak][1], d)
        k = cam.w(sk[kk][0], sk[kk][1], d)
        mid = v_lerp(h, a, 0.5)
        off = v_sub(k, mid)
        if v_len(off) < 0.012:
            off = v_add(cam.dir2(1, 0), (d * 2.0, 0.0, 0.0))
        poles[f"leg.{s}"] = r3(v_add(mid, v_mul(v_norm(off), 0.55)))
    # drape: wind in the image plane, backward = screen left
    def wind(flow, lift, g=1.0):
        w = v_add(v_mul(cam.right, -flow / 60.0 * g), v_mul(cam.up, lift * 0.6))
        return r3(w)

    hair, cloth = p["hair"], p["cloth"]
    sleeve = p.get("sleeve", cloth * 0.8)
    hl, cl = p.get("hairLift", 0.0), p.get("clothLift", 0.0)
    hw = wind(hair, hl)
    cw = wind(cloth, cl)
    sw = wind(sleeve, cl)
    drape = {"gravity": [0, 0, -1], "wind": hw, "chains": {
        "hair_back": {"g": 0.45, "wind": hw}, "hair_tail": {"g": 0.4, "wind": wind(hair * 1.1, hl)},
        "side_L": {"g": 0.5, "wind": hw}, "side_R": {"g": 0.5, "wind": hw}, "veil": {"g": 0.55, "wind": wind(hair * 0.9, hl)},
        "tabard": {"g": 0.6, "wind": cw}, "sleeve_L": {"g": 0.4, "wind": sw}, "sleeve_R": {"g": 0.4, "wind": sw},
        "stole_A": {"g": 0.3, "wind": wind(cloth * 1.15, cl)}, "stole_B": {"g": 0.3, "wind": wind(cloth * 1.25, cl)}}}
    pose = {
        "name": entry.get("key", "frame"),
        "camera": {"yaw": yaw, "elev": elev},
        "root": {"loc": [0, 0, 0], "rot": [0, 0, 0]},
        "bones": {
            "J_Bip_C_Hips.loc": r3(loc),
            "J_Bip_C_Hips": [round(hips_x, 2), 0, 0],
            "J_Bip_C_Spine": [round(spine_x, 2), 0, 0],
            "J_Bip_C_Chest": [round(chest_x, 2), 0, 0],
            "J_Bip_C_UpperChest": [round(uchest_x, 2), 0, 0],
            "J_Bip_C_Neck": [round(neck_x, 2), 0, 0],
            "J_Bip_C_Head": [round(head_x, 2), 0, 0],
            # the bell sleeves are shrunk as the hand-posed hero keys do (n1_contact: 0.62 / 0.68), or they read as gold rings
            "sleeve_R_1.scale": 0.62, "sleeve_L_1.scale": 0.68,
        },
        "feet": feet,
        "poles": poles,
        "drape": drape,
        "expression": expr_map.get(p.get("expr", "open"), "idle_hero"),
    }
    return pose, {"hip_z": hip_z}


def _reach_point(target, shoulder, reach):
    d = v_sub(target, shoulder)
    L = v_len(d)
    if L <= reach:
        return target
    return v_add(shoulder, v_mul(d, reach / L))


def _point_on_line(origin, direction, t0, shoulder, reach, tmin, tmax):
    """the shaft point nearest t0 (clamped to [tmin, tmax]) that the shoulder can reach"""
    t = max(tmin, min(tmax, t0))
    P = v_add(origin, v_mul(direction, t))
    if v_len(v_sub(P, shoulder)) <= reach:
        return t
    # distance^2 to the shoulder as a function of t is a parabola; find the admissible interval
    w = v_sub(origin, shoulder)
    b = v_dot(w, direction)
    c = v_dot(w, w) - reach * reach
    disc = b * b - c
    if disc < 0:
        return max(tmin, min(tmax, -b))          # closest approach
    lo, hi = -b - math.sqrt(disc), -b + math.sqrt(disc)
    lo, hi = max(lo, tmin), min(hi, tmax)
    if lo > hi:
        return max(tmin, min(tmax, -b))
    return max(lo, min(hi, t0))


def arms_pose(entry, cam, shoulders, reach=0.9):
    """Weapon, hands, arm poles and fingers given the posed shoulders (world, from pass 1)."""
    p, sk = entry["pose"], entry["sk"]
    du = cam.du
    k_w = GLAIVE["length"] / (STANDIN_WEAPON * du)            # glaive vs stand-in spear length
    dir_s = (sk["wDir"][0], sk["wDir"][1])
    d3 = cam.dir2(*dir_s)
    # edge: perpendicular to the shaft in the image plane, facing forward (up when the shaft is level)
    e1 = (-dir_s[1], dir_s[0])
    e2 = (dir_s[1], -dir_s[0])
    pick = e1 if (e1[0] > 0.25 or (abs(e1[0]) <= 0.25 and e1[1] < 0)) else e2
    if abs(pick[0]) < 0.25:
        pick = e1 if e1[1] < 0 else e2            # screen y is down: negative = up
    edge3 = cam.dir2(*pick)
    slide_px = p.get("slide", 40.0)
    slide_m = slide_px * du * k_w
    max_reach = ARM_LEN * reach
    far_only = "handN" in p and p["handN"] is not None
    wb = bool(p.get("wBack"))
    # world X of the grip: near-hand holds sit outside the near shoulder, a far-hand hold in front of the chest, wBack behind
    x_w = -0.27 if not far_only else -0.06
    if wb and not far_only:
        x_w = 0.22
    g_world = cam.w(sk["wGrip"][0], sk["wGrip"][1], x_w)
    holder = "L" if far_only else "R"
    holder_sh = shoulders[holder]
    g_clamped = _reach_point(g_world, holder_sh, max_reach)
    butt = v_sub(g_clamped, v_mul(d3, slide_m))
    hands = {}
    poles = {}
    fingers = {}
    main_slide = slide_m - GLAIVE["grip_main"]
    hands[holder] = {"grip": "grip_main", "slide": round(main_slide, 4), "thumb": "tip",
                     "back": r3((-1, 0, 0) if holder == "R" else (1, 0, 0))}
    fingers[holder] = {"curl": 85, "thumb": 55}
    other = "R" if holder == "L" else "L"
    if far_only:
        # the free near hand, in the stand-in's free position
        hx, hy = p["handN"]
        fx, fy = sk["haN"]
        ft = cam.w(fx, fy, -0.30)
        sh = shoulders["R"]
        ft = _reach_point(ft, sh, max_reach)
        fd = v_norm(v_sub(ft, sh))
        hands["R"] = {"pos": r3(ft), "fdir": r3(fd), "palm": r3((1.0, 0.0, 0.0)), "at_grip": False}
        fingers["R"] = {"curl": 40, "thumb": 20}
    else:
        hf = p.get("handF")
        if isinstance(hf, (int, float)) and not isinstance(hf, bool):
            t0 = main_slide + float(hf) * du
            origin = v_add(butt, v_mul(d3, GLAIVE["grip_main"]))
            t = _point_on_line(origin, d3, t0, shoulders["L"], max_reach, -GLAIVE["grip_main"] + 0.2, GLAIVE["length"] - GLAIVE["grip_main"] - 0.5)
            hands["L"] = {"grip": "grip_main", "slide": round(t, 4), "thumb": "tip", "back": r3((1, 0, 0))}
            fingers["L"] = {"curl": 85, "thumb": 55}
        else:
            # a free far hand (pumping arm): the stand-in's far-hand point, on the far side
            fx, fy = sk["haF"]
            ft = _reach_point(cam.w(fx, fy, 0.30), shoulders["L"], max_reach)
            fd = v_norm(v_sub(ft, shoulders["L"]))
            hands["L"] = {"pos": r3(ft), "fdir": r3(fd), "palm": r3((-1.0, 0.0, 0.0)), "at_grip": False}
            fingers["L"] = {"curl": 35, "thumb": 15}
    # arm poles: the stand-in elbow's side, outside the body
    hand_w = {}
    for s_, h in hands.items():
        if "grip" in h:
            base = butt if True else None
            hand_w[s_] = v_add(v_add(butt, v_mul(d3, GLAIVE["grip_main"])), v_mul(d3, h["slide"]))
        else:
            hand_w[s_] = tuple(h["pos"])
    for s_, ek, d in (("R", "elN", -0.32), ("L", "elF", 0.32)):
        el = cam.w(sk[ek][0], sk[ek][1], d)
        mid = v_lerp(shoulders[s_], hand_w[s_], 0.5)
        off = v_sub(el, mid)
        if v_len(off) < 0.02:
            off = v_add(cam.dir2(-1, 1), (d * 2.0, 0.0, 0.0))
        poles[f"arm.{s_}"] = r3(v_add(mid, v_mul(v_norm(off), 0.5)))
    weapon = {"butt": r3(butt), "dir": r3(d3), "edge": r3(edge3)}
    return {"weapon": weapon, "hands": hands, "poles": poles, "fingers": fingers}, {"grip": r3(g_clamped)}
