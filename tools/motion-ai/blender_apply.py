"""Put a retimed SOMA motion on the Rosace rig and render it through the pixel pipeline.

Headless only, through the isolated wrapper (never Dex's own Blender, never the Blender MCP):

  python tools/pixel-pipeline/blender_env.py run --python tools/motion-ai/blender_apply.py -- \
      --npz D:/Dex/Projects/dex-place-art/rosace/motion-ai/retimed/n1.npz \
      --blend D:/Dex/Projects/dex-place-art/rosace/motion-ai/work/rosace_snapshot_0258.blend \
      --out D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders/n1 [--px 144] [--yaw 60] [--elev 8] \
      [--no-render] [--no-drape] [--save-blend PATH] [--keep-root] [--expression resolute]
      [--hero tools/motion-ai/timing/n1_r2.json]   (round 2: hand-posed hero keys + spring cloth)
      [--no-jiggle]   (v2 base: skip the bust / glute / thigh springs stored on the rig)

Then the pixel post-process (outside Blender):
  python tools/pixel-pipeline/rosace_post.py --raw <out>/px144 --frames

What happens (RETIME.md has the why):
 1. Retarget. SOMA77 and the VRoid humanoid both rest in a T-pose facing the same way once the
    axes are swapped (SOMA x,y,z -> Blender x,-z,y), so every mapped J_Bip bone takes the source
    joint's world rotation relative to rest (bone_map_vrm.json); unmapped bones follow their
    parent. Hips height is rescaled by leg length (hips-to-ankle), and in-place by default: the
    smoothed root's horizontal travel is taken out and reported as rootMotion px instead
    (RUNTIME-CONTRACT: the engine moves her).
 2. Glaive. Two-handed frames aim the haft from the right hand's grip point through the left
    hand's; one-handed frames use the timing sheet's direction (default: upright at her side).
    The right hand's grip point is the rig's grip_off socket; the edge faces away from her body.
 3. Hand IK. Both hands are IK-gripped to sockets on the shaft (right: grip_off, left: grip_main
    slid along the haft to where the source hand was), elbow poles from the source elbows. The
    left hand lets go (IK influence -> 0) when the source hands are more than 0.75 m apart.
 4. Foot lock. Frames the retime flagged as planted lock the ankle IK target where the foot
    landed (in ground space, so in-place playback keeps the foot still relative to the floor);
    knee poles from the source knees.
 5. Secondary chains (hair, veil, sleeves, tabard, stoles): the rig's own static drape per
    rendered frame, with a wind that lags the chest's motion (a cheap follow-through).
 6. Only frames that show a new drawing are rendered; meta.json maps every game frame to one.

With --hero SHEET (round 2, hero_layer.py): after step 4 the sheet's hand-posed hero keys replace
the AI pose at their keys and their deltas ride on the AI in between (hands and feet re-solved by
IK, planted feet locked on the hero spots); step 5 becomes spring cloth that lags, overshoots and
settles through held drawings (cloth-only redraws every 2 f while it moves); every rendered frame
gets rig_measure.py numbers, plant drift and cloth lag in meta.json.
"""
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.join(os.path.dirname(HERE), "pixel-pipeline")
sys.path.insert(0, PIPE)
from rosace import materials, posing, render  # noqa: E402  (read-only use of the pipeline)

T0 = time.time()


def log(*a):
    print(f"[apply {time.time() - T0:6.1f}s]", *a, flush=True)


argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def opt(name, default=None, cast=str):
    if name in argv:
        i = argv.index(name)
        if cast is bool:
            return True
        return cast(argv[i + 1])
    return default


NPZ = opt("--npz")
BLEND = opt("--blend", r"D:\Dex\Projects\dex-place-art\rosace\motion-ai\work\rosace_snapshot_0258.blend")
OUT = opt("--out")
PX = opt("--px", 144, int)
YAW = opt("--yaw", 60.0, float)
ELEV = opt("--elev", 8.0, float)
SS = opt("--ss", 1, int)
RENDER = not opt("--no-render", False, bool)
DRAPE = not opt("--no-drape", False, bool)
SAVE = opt("--save-blend", None)
KEEP_ROOT = opt("--keep-root", False, bool)
EXPR = opt("--expression", "resolute")
HERO = opt("--hero", None)
PAD = opt("--pad", 6, int)          # round 3b: canvas margin (px) so a wide smear fits
JIGGLE = not opt("--no-jiggle", False, bool)   # v2 base: soft-tissue springs, when the rig carries them
for _p in (OUT, SAVE, BLEND, NPZ, HERO):
    # a relative path resolves against Blender's cwd (round 1 leaked frames to C:/review)
    assert _p is None or os.path.isabs(_p), f"absolute paths only: {_p}"
PASSES = opt("--passes", "beauty,albedo,id,normal,depth").split(",")

SKEL = json.load(open(os.path.join(HERE, "soma77.json")))
BM = json.load(open(os.path.join(HERE, "bone_map_vrm.json")))
NAMES = SKEL["names"]
PAR = SKEL["parents"]
IDX = {n: i for i, n in enumerate(NAMES)}
MAP = BM["map"]
INV = {v: k for k, v in MAP.items()}
MC = np.array([[1.0, 0, 0], [0, 0, -1.0], [0, 1.0, 0]])     # SOMA -> Blender axes
I3 = np.eye(3)
V = Vector


def mat3(a):
    return Matrix([list(r) for r in a])


def npm(M):
    return np.array([list(r) for r in M])


# ---------------------------------------------------------------------------- load
d = np.load(NPZ)
L = d["local_rot_mats"].astype(float)            # (F, 77, 3, 3)
ROOTP = d["root_positions"].astype(float)
SROOT = d["smooth_root_pos"].astype(float)
SAMPLE = d["sample_frame"].astype(int)
CONTACT = d["contacts"].astype(bool)
GW = d["glaive_w"].astype(float)
GDIR = d["glaive_dir"].astype(float)
DRAWING = [str(x) for x in d["drawing"]]
F = len(L)
G = np.zeros_like(L)                              # source global rotations
for j in range(len(NAMES)):
    p = PAR[j]
    G[:, j] = L[:, j] if p < 0 else np.einsum("fij,fjk->fik", G[:, p], L[:, j])
RENDER_FRAMES = sorted(set(int(s) for s in SAMPLE))
log(f"{NPZ}: {F} frames, {len(RENDER_FRAMES)} distinct drawings")

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene
materials.rebind()
render.setup_engine(sc)
sc.render.fps = 60
sc.frame_start, sc.frame_end = 0, F - 1
arm = posing.arm_obj()
bpy.context.view_layer.objects.active = arm
posing.reset(arm)                                  # also mutes every ik / ik_rot constraint
bones = arm.data.bones
pbs = arm.pose.bones
order = [n for n in posing._hierarchy(arm) if n.startswith("J_Bip")]
REST = {n: npm(bones[n].matrix_local.to_3x3()) for n in order}
hips = "J_Bip_C_Hips"
hips_rest = V(bones[hips].head_local)
ankle_rest_z = bones["J_Bip_L_Foot"].head_local.z
S_LEG = (hips_rest.z - ankle_rest_z) / BM["source_hips_to_ankle_m"]
log(f"leg scale {S_LEG:.3f} (target hips {hips_rest.z:.3f} m, ankle {ankle_rest_z:.3f} m)")
GRIPS = arm["glaive"]["grips"]
SPACING = GRIPS["grip_main"] - GRIPS["grip_off"]


def ground_offset(f):
    """what in-place playback removed at frame f (Blender metres)"""
    if KEEP_ROOT:
        return V((0, 0, 0))
    s = SROOT[f]
    return V(MC @ (S_LEG * np.array([s[0], 0.0, s[2]])))


# ---------------------------------------------------------------------------- 1. retarget -> FK keys
for n in order:
    pbs[n].rotation_mode = "QUATERNION"
for f in range(F):
    Qt = {}
    for n in order:
        b = bones[n]
        par = b.parent.name if b.parent else None
        Qp = Qt.get(par, I3)
        Qn = MC @ G[f, IDX[INV[n]]] @ MC.T if n in INV else Qp
        Qt[n] = Qn
        basis = REST[n].T @ (Qp.T @ Qn) @ REST[n]
        pb = pbs[n]
        pb.rotation_quaternion = mat3(basis).to_quaternion()
        pb.keyframe_insert("rotation_quaternion", frame=f)
    p = ROOTP[f].copy()
    if not KEEP_ROOT:
        p[0] -= SROOT[f, 0]
        p[2] -= SROOT[f, 2]
    tgt = hips_rest + V(MC @ (S_LEG * (p - np.array([0.0, BM["source_hips_rest_height_m"], 0.0]))))
    pbs[hips].location = mat3(REST[hips]).transposed() @ (tgt - hips_rest)
    pbs[hips].keyframe_insert("location", frame=f)
log("retargeted FK keys")


# ---------------------------------------------------------------------------- 2. read the FK pose
def grip_point(s):
    Mrest, head0, fdir0, palm0, grip0 = posing.hand_rest(arm, s)
    pb = pbs[f"J_Bip_{s}_Hand"]
    M = pb.matrix @ bones[f"J_Bip_{s}_Hand"].matrix_local.inverted()
    back = (M.to_3x3() @ V((0, 0, 1))).normalized()
    return M @ grip0, back


FK = []
for f in range(F):
    sc.frame_set(f)
    r = {}
    for s in "LR":
        r[f"grip{s}"], r[f"back{s}"] = grip_point(s)
        r[f"sh{s}"] = pbs[f"J_Bip_{s}_UpperArm"].head.copy()
        r[f"el{s}"] = pbs[f"J_Bip_{s}_LowerArm"].head.copy()
        r[f"wr{s}"] = pbs[f"J_Bip_{s}_Hand"].head.copy()
        r[f"hip{s}"] = pbs[f"J_Bip_{s}_UpperLeg"].head.copy()
        r[f"kn{s}"] = pbs[f"J_Bip_{s}_LowerLeg"].head.copy()
        r[f"an{s}"] = pbs[f"J_Bip_{s}_Foot"].head.copy()
        r[f"foot{s}"] = pbs[f"J_Bip_{s}_Foot"].matrix.copy()
    r["chest"] = pbs["J_Bip_C_UpperChest"].head.copy()
    Mh = pbs[hips].matrix.to_3x3() @ bones[hips].matrix_local.to_3x3().inverted()
    r["fwd"] = (Mh @ V((0, -1, 0))).normalized()
    FK.append(r)
log("read FK")
# retarget check: the hand-to-hand and shoulder-to-wrist directions on the rig vs the source
PJ = d["posed_joints"].astype(float)
chk = []
for f in range(F):
    def src_dir(a, b):
        v = MC @ (PJ[f, IDX[b]] - PJ[f, IDX[a]])
        return V(v).normalized()
    r = FK[f]
    pairs = [(r["wrR"], r["wrL"], "RightHand", "LeftHand"), (r["shR"], r["wrR"], "RightArm", "RightHand"),
             (r["shL"], r["wrL"], "LeftArm", "LeftHand"), (r["hipR"], r["anR"], "RightLeg", "RightFoot")]
    chk.append([round(math.degrees((b - a).normalized().angle(src_dir(sa, sb))), 1) for a, b, sa, sb in pairs])
chk = np.array(chk)
log("retarget direction error deg (hands, R arm, L arm, R leg): max", chk.max(0).tolist(), "mean",
    chk.mean(0).round(1).tolist())


# ---------------------------------------------------------------------------- 3. glaive, hands, feet
def spans(flags):
    out, a = [], None
    for f, c in enumerate(list(flags) + [False]):
        if c and a is None:
            a = f
        if not c and a is not None:
            out.append((a, f - 1))
            a = None
    return out


LOCK = {s: np.zeros(F) for s in "LR"}
LOCKM = {s: [None] * F for s in "LR"}
ramp = 0 if len(RENDER_FRAMES) < F else 2          # stepped clips: no blend frames
LEG = {s: bones[f"J_Bip_{s}_UpperLeg"].length + bones[f"J_Bip_{s}_LowerLeg"].length for s in "LR"}
REPLANT_M = 0.05
for si, s in enumerate("LR"):
    for a, b in spans(CONTACT[:, si]):
        # split a long plant where the source foot has crept more than REPLANT_M away from the
        # locked spot, or the spot is out of the leg's reach: a small re-plant, not a stretched leg
        pieces, start = [], a
        g0 = FK[a][f"foot{s}"].translation + ground_offset(a)
        for f in range(a + 1, b + 1):
            g = FK[f][f"foot{s}"].translation + ground_offset(f)
            hip = FK[f][f"hip{s}"] + ground_offset(f)
            if (g - g0).length > REPLANT_M or (hip - g0).length > LEG[s] * 0.995:
                pieces.append((start, f - 1))
                start, g0 = f, g
        pieces.append((start, b))
        for pa, pb_ in pieces:
            M0 = FK[pa][f"foot{s}"].copy()
            gp = M0.translation + ground_offset(pa)
            for f in range(max(0, pa - ramp), min(F - 1, pb_ + ramp) + 1):
                w = 1.0 if pa <= f <= pb_ else 1.0 - (pa - f if f < pa else f - pb_) / (ramp + 1)
                if w > LOCK[s][f]:
                    M = M0.copy()
                    M.translation = gp - ground_offset(f)
                    LOCK[s][f], LOCKM[s][f] = w, M
        if len(pieces) > 1:
            log(f"  foot {s} plant f{a}-f{b} re-planted at", [p[0] for p in pieces[1:]])


GL_LEN = arm["glaive"]["length"]


def floor_clamp(pR, dvec, floor=0.012):
    """pitch the haft up just enough that neither end goes through the floor (the N1 scoop
    scrapes it; a pose that would bury the blade stops on the floor instead)"""
    ends = ((GL_LEN - GRIPS["grip_off"]), -GRIPS["grip_off"])
    for k in ends:
        z = pR.z + dvec.z * k
        if z < floor:
            h = V((dvec.x, dvec.y, 0.0))
            if h.length < 1e-6:
                h = V((0, -1, 0))
            h.normalize()
            # choose the pitch so this end sits on the floor: dz * k = floor - pR.z
            dz = max(-0.999, min(0.999, (floor - pR.z) / k))
            dvec = (h * math.sqrt(1 - dz * dz) + V((0, 0, dz))).normalized()
    return dvec


def pole_from(joint_a, mid, joint_b, fallback, dist):
    c = (joint_a + joint_b) / 2
    v = mid - c
    if v.length < 0.01:
        v = fallback
    return mid + v.normalized() * dist


gate0, gate1 = BM["two_hand_gate_m"]
ARM_L = bones["J_Bip_L_UpperArm"].length + bones["J_Bip_L_LowerArm"].length
lo, hi = BM["left_slide_range_m"]
for n in ("ik_hand.L", "ik_hand.R", "ik_foot.L", "ik_foot.R", "pole_arm.L", "pole_arm.R", "pole_leg.L",
          "pole_leg.R", "glaive"):
    pbs[n].rotation_mode = "QUATERNION"
for pb in pbs:
    for c in pb.constraints:
        if c.name in ("ik", "ik_rot"):
            c.mute = False
            c.influence = 0.0
finger_bones = [pb.name for pb in pbs if any(k in pb.name for k in ("Thumb", "Index", "Middle", "Ring", "Little"))
                and pb.name.startswith("J_Bip")]
GL = []
AIINFO = []
for f in range(F):
    sc.frame_set(f)
    r = FK[f]
    pR, pL = r["gripR"], r["gripL"]
    # haft direction and left-hand weight come from retime.py (glaive_track): the source wrists
    # where they hold the authored grip spacing, bridged in time where they don't, blended with
    # the sheet's one-hand hint. The rig's own hands are too close together for their difference
    # to be a stable direction (measured: up to 53 deg off, while the limbs agree within 5 deg).
    w = float(GW[f])
    dvec = V(MC @ GDIR[f]).normalized()
    dvec = floor_clamp(pR, dvec)
    away = (pR + dvec * 0.5) - r["chest"]
    e = away - dvec * away.dot(dvec)
    if e.length < 0.02:
        e = r["fwd"] - dvec * r["fwd"].dot(dvec)
    posing.place_weapon(arm, {"socket": "grip_off", "at": list(pR), "dir": list(dvec), "edge": list(e.normalized())})
    GL.append((w, dvec))
    posing.grip_hand(arm, "R", "grip_off", "tip", back=list(r["backR"]))
    # left hand: the point on the haft nearest its source grip, kept inside the arm's reach
    t = float(np.clip((pL - pR).dot(dvec), lo, hi))
    shL = r["shL"]
    reach = ARM_L - 0.01
    oc = pR - shL
    bq = oc.dot(dvec)
    disc = bq * bq - (oc.dot(oc) - reach * reach)
    if disc > 0:
        t1, t2 = -bq - math.sqrt(disc), -bq + math.sqrt(disc)
        t = float(np.clip(t, max(t1, lo), min(t2, hi))) if max(t1, lo) <= min(t2, hi) else t
    slide = t - SPACING
    posing.grip_hand(arm, "L", "grip_main", "tip", back=list(r["backL"]), slide=slide)
    AIINFO.append({"slideR": 0.0, "slideL": float(slide), "wL": w, "backR": list(r["backR"]),
                   "backL": list(r["backL"])})
    for s in "LR":
        posing.place_pole(arm, f"pole_arm.{s}", pole_from(r[f"sh{s}"], r[f"el{s}"], r[f"wr{s}"], -r["fwd"], 0.45))
    for s in "LR":
        M = LOCKM[s][f] if LOCKM[s][f] is not None else r[f"foot{s}"]
        posing.set_bone_matrix(arm, f"ik_foot.{s}", M)
        posing.place_pole(arm, f"pole_leg.{s}", pole_from(r[f"hip{s}"], r[f"kn{s}"], r[f"an{s}"], r["fwd"], 0.5))
    infl = {("R", "arm"): 1.0, ("L", "arm"): w, ("L", "leg"): float(LOCK["L"][f]), ("R", "leg"): float(LOCK["R"][f])}
    for (s, limb), val in infl.items():
        cs = ([pbs[f"J_Bip_{s}_LowerArm"].constraints["ik"], pbs[f"J_Bip_{s}_Hand"].constraints["ik_rot"]]
              if limb == "arm" else
              [pbs[f"J_Bip_{s}_LowerLeg"].constraints["ik"], pbs[f"J_Bip_{s}_Foot"].constraints["ik_rot"]])
        for c in cs:
            c.influence = val
            c.keyframe_insert("influence", frame=f)
    posing.curl_fingers(arm, "R", 75, 40)
    posing.curl_fingers(arm, "L", 20 + 55 * w, 15 + 25 * w)
    for n in ("ik_hand.L", "ik_hand.R", "ik_foot.L", "ik_foot.R", "pole_arm.L", "pole_arm.R", "pole_leg.L",
              "pole_leg.R", "glaive"):
        pbs[n].keyframe_insert("location", frame=f)
        pbs[n].keyframe_insert("rotation_quaternion", frame=f)
    for n in finger_bones:
        pbs[n].keyframe_insert("rotation_quaternion", frame=f)
log("glaive, hand IK, foot locks keyed")

# ---------------------------------------------------------------------------- 3b. hero layer (--hero)
chains = {k: list(v) for k, v in arm.data.get("chains", {}).items()}
chain_bones = [b for v in chains.values() for b in v]
DISPLAY = [int(x) for x in SAMPLE]
HERO_META = None
if HERO:
    sys.path.insert(0, HERE)
    import hero_layer as HL  # noqa: E402
    import rig_measure  # noqa: E402
    from rosace.common import POSES_DIR  # noqa: E402
    hero = json.load(open(HERO, encoding="utf-8"))["hero"]
    KN = [str(x) for x in d["key_names"]]
    KF = [int(x) for x in d["key_frames"]]
    KA, KB, KU = d["key_a"].astype(int), d["key_b"].astype(int), d["key_u"].astype(float)
    kf = dict(zip(KN, KF))
    S = list(RENDER_FRAMES)
    # 1. the AI state of every drawing
    AI = {}
    for s_ in S:
        sc.frame_set(s_)
        AI[s_] = HL.capture(arm, order, AIINFO[s_])
    # 2. the hand-posed hero keys, captured the same way
    HS, HP = {}, {}
    for name, spec in hero["keys"].items():
        if "pose" not in spec:
            continue
        assert kf[name] in S, f"hero key {name!r} (f{kf[name]}) is not shown by any drawing"
        P = json.load(open(os.path.join(POSES_DIR, spec["pose"]), encoding="utf-8"))
        sc.frame_set(kf[name])
        posing.apply_pose(HL.resolve(P))
        hands = P.get("hands", {})
        free = HL.free_left(P)
        ai_i = AIINFO[kf[name]]
        info = {"slideR": hands.get("R", {}).get("slide", 0.0),
                "slideL": ai_i["slideL"] if free else hands.get("L", {}).get("slide", 0.0),
                "wL": 0.0 if free else 1.0,
                "backR": hands.get("R", {}).get("back", [-1, 0, 0]),
                "backL": ai_i["backL"] if free else hands.get("L", {}).get("back", [1, 0, 0])}
        HS[name] = HL.capture(arm, order, info)
        HP[name] = P
        log(f"  hero key {name!r} f{kf[name]} <- {spec['pose']}")
    for pb in pbs:
        for c in pb.constraints:
            if c.name in ("ik", "ik_rot"):
                c.mute = False
    # 3. a delta per retime key (pose / carry / mix / none)
    DH = {n: HL.delta(AI[kf[n]], HS[n]) for n in HS}
    like = AI[S[0]]
    DK = []
    for name in KN:
        spec = hero["keys"].get(name, {})
        if "pose" in spec:
            DK.append(DH[name])
        elif "carry" in spec:
            DK.append(DH[spec["carry"]])
        elif "mix" in spec:
            DK.append(HL.mix([(DH[k], w) for k, w in spec["mix"]], like))
        else:
            DK.append(HL.zero_delta(like))
    # 3b. an absolute weapon state per retime key (hero_layer.py "weapon (absolute)")
    WK = []
    for name, f_k in zip(KN, KF):
        spec = hero["keys"].get(name, {})
        base = HL.weapon_of(AI[f_k] if f_k in AI else AI[min(S, key=lambda x: abs(x - f_k))])
        if "pose" in spec:
            WK.append(HL.weapon_of(HS[name]))
        elif "carry" in spec:
            WK.append(HL.weapon_of(HS[spec["carry"]]))
        elif "mix" in spec:
            WK.append(HL.weapon_mix([(HL.weapon_of(HS[k]), w) for k, w in spec["mix"]], base))
        else:
            WK.append(base)
    # 3c. round 3: "blend" = an absolute mix of other keys' states (exact slow-in spacing, the AI's own
    # in-between ignored); "glaive" = the weapon given in world (hero_layer "weapon in world")
    KS = {}
    for i, name in enumerate(KN):
        spec = hero["keys"].get(name, {})
        if "blend" in spec or KF[i] not in AI:
            continue
        KS[name] = HS[name] if "pose" in spec else HL.set_weapon(HL.apply_delta(AI[KF[i]], DK[i]), WK[i])
    for i, name in enumerate(KN):
        spec = hero["keys"].get(name, {})
        if "blend" not in spec:
            continue
        assert KF[i] in AI, f"blend key {name!r} (f{KF[i]}) is not shown by any drawing"
        KS[name] = HL.state_mix([(KS[k], float(w)) for k, w in spec["blend"]])
        DK[i] = HL.delta(AI[KF[i]], KS[name])
        WK[i] = HL.weapon_mix([(HL.weapon_of(KS[k]), float(w)) for k, w in spec["blend"]], WK[i])
        log(f"  blend key {name!r} f{KF[i]} <- {spec['blend']}")

    # 3c'. round 3b: "sink": the key's state with the hips lowered (metres, world down); planted feet stay,
    # so the knees bend (a 1-2 px settle into a held pose instead of a new pose)
    for i, name in enumerate(KN):
        spec = hero["keys"].get(name, {})
        if not spec.get("sink") or KF[i] not in AI:
            continue
        st_ = KS[name] if name in KS else HL.apply_delta(AI[KF[i]], DK[i])
        st_ = dict(st_)
        st_["hips"] = st_["hips"] + mat3(REST[hips]).transposed() @ V((0.0, 0.0, -float(spec["sink"])))
        KS[name] = st_
        DK[i] = HL.delta(AI[KF[i]], st_)
        log(f"  sink key {name!r} f{KF[i]}: {spec['sink']} m")

    def body_of(i):
        st_ = HL.set_weapon(HL.apply_delta(AI[KF[i]], DK[i]), WK[i])
        sc.frame_set(KF[i])
        for n in order:
            pbs[n].rotation_mode = "QUATERNION"
            pbs[n].rotation_quaternion = st_["q"][n]
        pbs[hips].location = st_["hips"]
        posing.update()
        return pbs["J_Bip_C_UpperChest"].matrix.copy(), pbs[hips].head.copy()
    WW = {}
    for i, name in enumerate(KN):
        g = hero["keys"].get(name, {}).get("glaive")
        if not g:
            continue
        C_, hp_ = body_of(i)
        like = None
        if "like" in g:
            j = KN.index(g["like"])
            Cj, hj = body_of(j)
            like = HL.weapon_to_world(WK[j], Cj, hj)
            C_, hp_ = body_of(i)
        WK[i] = HL.weapon_from_world(g, C_, hp_, WK[i], like)
        WW[name] = g
        log(f"  world glaive at {name!r} f{KF[i]}: {g}")
    # round 3b: "wL" on a key sets how much the left hand grips there (a blend of a two-handed and a one-handed
    # key would otherwise leave the hand half-way between IK and its own arm pose)
    for i, name in enumerate(KN):
        spec = hero["keys"].get(name, {})
        if "wL" in spec:
            WK[i] = dict(WK[i])
            WK[i]["wL"] = float(spec["wL"])
    # 4. every drawing: AI state + blended delta, planted feet, then key it on every frame it shows
    # round 3b: a plant can name any key (the idle "stance"/"ready" too), not only a hand-posed one
    spots = HL.plant_spots(hero.get("plants"), dict(KS, **HS), kf, ground_offset)
    frames_of = {s_: [f for f in range(F) if SAMPLE[f] == s_] for s_ in S}
    LAY, FOOTMODE = {}, {}
    for s_ in S:
        a, b, u = int(KA[s_]), int(KB[s_]), float(KU[s_])
        D = DK[a] if a == b else HL.blend2(DK[a], DK[b], u)
        st = HL.apply_delta(AI[s_], D)
        st = HL.set_weapon(st, WK[a] if a == b else HL.weapon_blend(WK[a], WK[b], u))
        FOOTMODE[s_] = {}
        for side in "LR":
            M, mode = HL.foot_override(spots, side, s_, ground_offset, None)
            FOOTMODE[s_][side] = mode
            if M is not None:
                st["foot"][side] = M
        sc.frame_set(s_)
        LAY[s_] = HL.set_state(arm, order, st)
        for f in frames_of[s_]:
            HL.key_state(arm, order, finger_bones, f)
    GL = [(LAY[int(SAMPLE[f])]["wL"], V(LAY[int(SAMPLE[f])]["glaive_dir"])) for f in range(F)]
    log(f"hero layer: {len(HS)} hero keys, {len(S)} drawings layered")

    # ------------------------------------------------------------------------ 4b. spring cloth
    neutral = {"gravity": (0, 0, -1), "wind": [0, 0, 0]}
    cn = list(chains)

    def spec_of(name):
        sp = hero["keys"].get(name, {})
        if "pose" in sp:
            dr = HP[name].get("drape", neutral)
            return HL.lerp_spec(dr, dr, 0.0, cn)
        if "carry" in sp:
            return spec_of(sp["carry"])
        if "blend" in sp:
            # round 3b: a blend key's cloth target is the same weighted mix of its sources' drapes (it fell through
            # to the neutral, windless drape before, so mid-spin and recovery blends hung limp)
            acc, accw = None, 0.0
            for k, w in sp["blend"]:
                sk = spec_of(k)
                if acc is None:
                    acc, accw = sk, float(w)
                else:
                    acc, accw = HL.lerp_spec(acc, sk, float(w) / (accw + float(w)), cn), accw + float(w)
            return acc
        if "mix" in sp:
            acc, accw = None, 0.0
            for k, w in sp["mix"]:
                sk = spec_of(k)
                if acc is None:
                    acc, accw = sk, w
                else:
                    acc, accw = HL.lerp_spec(acc, sk, w / (accw + w), cn), accw + w
            return HL.lerp_spec(neutral, acc, min(1.0, accw), cn)
        return HL.lerp_spec(neutral, neutral, 0.0, cn)
    SPK = [spec_of(n) for n in KN]
    targets, caps = {}, {}
    for s_ in S:
        a, b, u = int(KA[s_]), int(KB[s_]), float(KU[s_])
        spec = SPK[a] if a == b else HL.lerp_spec(SPK[a], SPK[b], u, cn)
        sc.frame_set(s_)
        targets[s_], caps[s_] = HL.static_drape(arm, chains, spec)
    # round 3b: a held drawing whose cloth keeps winding up ("hold_build": {drawing: {"wind": [a, b], "g": [a, b]}}):
    # the drape target's wind and gravity scale from a to b across the hold (per frame; the body doesn't move)
    OVR = {}
    for dname, hb in {k: v for k, v in hero.get("hold_build", {}).items() if not k.startswith("_")}.items():
        fr = [f for f in range(F) if DRAWING[f] == dname]
        if not fr:
            continue
        s_ = int(SAMPLE[fr[0]])
        a, b, u = int(KA[s_]), int(KB[s_]), float(KU[s_])
        base = SPK[a] if a == b else HL.lerp_spec(SPK[a], SPK[b], u, cn)
        w0, w1 = hb.get("wind", [1.0, 1.0])
        g0, g1 = hb.get("g", [1.0, 1.0])
        sc.frame_set(s_)
        for k, f in enumerate(fr):
            t = k / max(1, len(fr) - 1)
            ws, gs = w0 + (w1 - w0) * t, g0 + (g1 - g0) * t
            spec = {"gravity": base["gravity"], "wind": base["wind"],
                    "chains": {c: {"g": v["g"] * gs, "wind": [x * ws for x in v["wind"]]} for c, v in base["chains"].items()}}
            OVR[f] = HL.static_drape(arm, chains, spec)
        log(f"  hold_build {dname}: f{fr[0]}-f{fr[-1]} wind x{w0}->{w1}, gravity x{g0}->{g1}")
    WORLD = {k: float(v) for k, v in hero.get("cloth_world", {}).items() if not k.startswith("_")}
    TIPS = HL.simulate(chains, targets, caps, F, [int(x) for x in SAMPLE], lags=hero.get("cloth_lag", {}),
                         dyn={k: tuple(v) for k, v in hero.get("cloth_dyn", {}).items() if not k.startswith("_")},
                         world=WORLD, override=OVR)
    _, CR, CU, _ = render.camera_frame(YAW, ELEV)
    PPM0 = PX / float(arm.get("rosace_height", 1.8634))
    DISPLAY = HL.cloth_frames(TIPS, [int(x) for x in SAMPLE], CR, CU, PPM0)
    IMG = sorted(set(DISPLAY))
    for f in IMG:
        sc.frame_set(f)
        HL.pose_chains(arm, chains, TIPS[f])
        for n in chain_bones:
            pbs[n].rotation_mode = "QUATERNION"
            pbs[n].keyframe_insert("rotation_quaternion", frame=f)
    log(f"spring cloth: {len(IMG)} images ({len(IMG) - len(S)} cloth-only redraws on holds)")

    def scr(p):
        return V((p.dot(CR) * PPM0, p.dot(CU) * PPM0))
    # lag: frames until a chain tip has covered half its way to the new drawing's drape
    lag = {}
    for c in cn:
        lags = []
        for f0 in range(1, F):
            if SAMPLE[f0] == SAMPLE[f0 - 1]:
                continue
            s_ = int(SAMPLE[f0])
            tgt = scr(targets[s_][c][-1][1])
            d0 = (scr(TIPS[f0 - 1][c][-1]) - tgt).length
            if d0 < 2.0:
                continue
            hold = len(frames_of[s_])
            t50 = next((t for t in range(hold) if (scr(TIPS[f0 + t][c][-1]) - tgt).length <= 0.5 * d0), None)
            lags.append(t50 + 1 if t50 is not None else hold + 1)
        # round 3: the same, measured on the chain's SHAPE (tip relative to its root on the body), so a
        # root that moves with the body doesn't count as the cloth having caught up. Frames past the
        # drawing's hold keep counting on the next drawings (up to 12 f).
        rl = []
        for f0 in range(1, F):
            if SAMPLE[f0] == SAMPLE[f0 - 1]:
                continue
            s_ = int(SAMPLE[f0])
            root = targets[s_][c][0][0]
            tgt = scr(targets[s_][c][-1][1]) - scr(root)
            r_prev = targets[int(SAMPLE[f0 - 1])][c][0][0]
            d0 = ((scr(TIPS[f0 - 1][c][-1]) - scr(r_prev)) - tgt).length
            if d0 < 2.0:
                continue
            t50 = None
            for t in range(min(12, F - f0)):
                s2 = int(SAMPLE[f0 + t])
                rel = scr(TIPS[f0 + t][c][-1]) - scr(targets[s2][c][0][0])
                tg2 = scr(targets[s2][c][-1][1]) - scr(targets[s2][c][0][0])
                if (rel - tg2).length <= 0.5 * d0:
                    t50 = t
                    break
            rl.append(t50 + 1 if t50 is not None else 13)
        # round 3b: trailing on screen over the whole clip: the shift k (frames) that best lines the chain tip's
        # screen path up with its drape target's path, tip(f) ~ target(f - k); plus overshoot count (the tip
        # passing its target and coming back) after each drawing change
        tp = [scr(TIPS[f][c][-1]) for f in range(F)]
        tt = [scr((OVR[f][0] if f in OVR else targets[int(SAMPLE[f])])[c][-1][1]) for f in range(F)]
        errs = []
        for k in range(0, 11):
            e = [(tp[f] - tt[f - k]).length for f in range(k, F)]
            errs.append(sum(e) / max(1, len(e)))
        xk = min(range(len(errs)), key=lambda k: errs[k])
        # round 3b: streaming. The stole hangs from the glaive head, so it can never trail its root by more than
        # its own length on screen; what reads is its DIRECTION. After a drawing change that moves the chain's
        # root >= 6 px on screen, count the frames (up to 12) in which the chain (root -> tip, on screen) points
        # back along that move (within 60 deg of -move): the drawings it visibly streams behind the blade.
        stream = []
        for f0 in range(1, F):
            if SAMPLE[f0] == SAMPLE[f0 - 1]:
                continue
            r0 = scr(targets[int(SAMPLE[f0 - 1])][c][0][0])
            r1 = scr(targets[int(SAMPLE[f0])][c][0][0])
            mv = r1 - r0
            if mv.length < 6.0:
                continue
            back = -mv.normalized()
            n_ = 0
            for t in range(min(12, F - f0)):
                s2 = int(SAMPLE[f0 + t])
                rv = scr(TIPS[f0 + t][c][-1]) - scr(targets[s2][c][0][0])
                if rv.length > 1e-6 and rv.normalized().dot(back) > 0.5:
                    n_ += 1
                else:
                    break
            stream.append({"f": f0, "drawing": DRAWING[f0], "move_px": round(mv.length, 1), "stream_frames": n_})
        lag[c] = {"n": len(lags), "median_frames_to_half": (sorted(lags)[len(lags) // 2] if lags else None),
                  "trail_frames_xcorr": xk, "trail_err_px": [round(x, 2) for x in errs], "stream": stream,
                  "stream_median_frames": (sorted(x["stream_frames"] for x in stream)[len(stream) // 2] if stream else None),
                  "max": max(lags) if lags else None,
                  "shape_n": len(rl), "shape_median_frames_to_half": (sorted(rl)[len(rl) // 2] if rl else None)}
    # secondary motion on holds: how far each chain tip moves on screen while the body is frozen
    holds = []
    for s_ in S:
        fr = frames_of[s_]
        if len(fr) < 3:
            continue
        per = {}
        for c in cn:
            p0 = scr(TIPS[DISPLAY[fr[0]]][c][-1])
            per[c] = round(max((scr(TIPS[DISPLAY[f]][c][-1]) - p0).length for f in fr), 2)
        holds.append({"drawing": DRAWING[fr[0]], "start": fr[0], "frames": len(fr),
                      "images": len(set(DISPLAY[f] for f in fr)), "tip_disp_px": per,
                      "max_px": max(per.values())})
    HERO_META = {"sheet": HERO, "hero_keys": {n: {"frame": kf[n], "pose": hero["keys"][n]["pose"]} for n in HS},
                 "cloth_dyn": dict(HL.CHAIN_DYN, **{k: v for k, v in hero.get("cloth_dyn", {}).items() if not k.startswith("_")}), "cloth_lag": lag, "cloth_lag_offset_f": hero.get("cloth_lag", {}), "holds": holds,
                 "foot_mode": {str(k): v for k, v in FOOTMODE.items()},
                 "plants": {sd: [[a, b] for a, b, _ in v] for sd, v in spots.items()}}
    RENDER_FRAMES = IMG
    DRAPE = False

# ---------------------------------------------------------------------------- 4. drape per drawing
if DRAPE:
    prev = None
    for f in RENDER_FRAMES:
        sc.frame_set(f)
        for n in chain_bones:
            pbs[n].rotation_mode = "QUATERNION"
            pbs[n].rotation_quaternion = Quaternion()
        posing.update()
        chest_g = pbs["J_Bip_C_UpperChest"].head + ground_offset(f)
        wind = V((0, 0, 0))
        if prev is not None and f > prev[0]:
            v = (chest_g - prev[1]) * (60.0 / (f - prev[0]))     # m/s
            wind = -v * 0.12
            if wind.length > 0.9:
                wind = wind.normalized() * 0.9
        posing.drape(arm, {"gravity": (0, 0, -1), "wind": list(wind)})
        for n in chain_bones:
            pbs[n].keyframe_insert("rotation_quaternion", frame=f)
        prev = (f, chest_g.copy())
    log("draped", len(RENDER_FRAMES), "drawings")

# ---------------------------------------------------------------------------- 4b. soft tissue (v2 base)
# The v2 rig (tools/pixel-pipeline/rosace_v2) stores damped-spring settings for the bust, glutes and
# thighs in arm.data['jiggle']; they are simulated over every game frame once the body is keyed, so
# held drawings keep settling. v1 rigs have no settings: nothing changes for them.
JIGGLE_META = None
if JIGGLE and arm.data.get("jiggle"):
    sys.path.insert(0, PIPE)
    from rosace_v2 import jiggle as _jig  # noqa: E402
    _sim = _jig.bake(arm, 0, F - 1)
    _lag = {}
    for _f, _bones in _sim.items():
        for _n, (_x, _t, _h) in _bones.items():
            _lag[_n] = max(_lag.get(_n, 0.0), (_x - _t).length)
    JIGGLE_META = {"settings": _jig.settings(arm), "max_tip_lag_cm": {k: round(v * 100, 2) for k, v in _lag.items()}}
    log("jiggle baked", JIGGLE_META["max_tip_lag_cm"])

# stepped exposure: every game frame shows its drawing's pose exactly (constant interpolation
# between keys is not needed: every frame is keyed; held frames repeat the drawing's values)
# ---------------------------------------------------------------------------- 5. measurements
meas = {"hand_gap_to_shaft_cm": [], "left_ik_influence": [], "foot_lock_slide_cm": []}
for f in RENDER_FRAMES:
    sc.frame_set(f)
    wp = pbs["glaive"]
    a, b = wp.head, wp.tail
    dd = (b - a).normalized()
    for s in "LR":
        gp, _ = grip_point(s)
        off = gp - a
        gap = (off - dd * off.dot(dd)).length
        if s == "R" or GL[f][0] > 0.9:
            meas["hand_gap_to_shaft_cm"].append(round(gap * 100, 2))
            if gap > 0.03:
                el, wr = pbs[f"J_Bip_{s}_LowerArm"].head, pbs[f"J_Bip_{s}_Hand"].head
                reach = (pbs[f"J_Bip_{s}_UpperArm"].head - pbs[f"ik_hand.{s}"].head).length
                log(f"  f{f} {s} hand {gap * 100:.1f} cm off the shaft (IK target {reach:.3f} m from the "
                    f"shoulder; arm {bones[f'J_Bip_{s}_UpperArm'].length + bones[f'J_Bip_{s}_LowerArm'].length:.3f} m)")
    meas["left_ik_influence"].append(round(GL[f][0], 2))
for s in "LR":
    for f in RENDER_FRAMES:
        if LOCK[s][f] >= 1.0:
            sc.frame_set(f)
            gap = (pbs[f"J_Bip_{s}_Foot"].head - LOCKM[s][f].translation).length
            meas["foot_lock_slide_cm"].append(round(gap * 100, 2))
            if gap > 0.02:
                log(f"  f{f} foot {s} {gap * 100:.1f} cm off its planted spot")
log("measured", {k: (max(v) if v else None) for k, v in meas.items()})
if HERO:
    rig = {}
    drift = {"L": [], "R": []}
    for f in RENDER_FRAMES:
        sc.frame_set(f)
        m = rig_measure.measure(arm, grips=("R", "L") if GL[f][0] > 0.9 else ("R",), ground=ground_offset(f))
        m["drawing"] = DRAWING[f]
        m["wL"] = round(GL[f][0], 2)
        rig[str(f)] = m
    for side, spans in HERO_META["plants"].items():
        for a, b in spans:
            pts = []
            for f in range(a, b + 1):
                sc.frame_set(DISPLAY[f])
                pts.append(pbs[f"J_Bip_{side}_Foot"].head + ground_offset(f))
            dmax = max((q - pts[0]).length for q in pts)
            drift[side].append({"span": [a, b], "max_drift_cm": round(dmax * 100, 2)})
    HERO_META["rig"] = rig
    HERO_META["foot_drift"] = drift
    # round 3: the rendered blade of every image (armature = the render's world; in place), for the
    # tracked smear (smear.py) and the sweep checks (pitch, height, blade over the head, haft on the face)
    GD = arm["glaive"]
    blade = {}
    for f in RENDER_FRAMES:
        sc.frame_set(f)
        g = pbs["glaive"]
        dd = (g.tail - g.head).normalized()
        butt = g.head - dd * GD["grips"]["grip_main"]
        hd = pbs["J_Bip_C_Head"]
        blade[str(f)] = {"butt": list(butt), "dir": list(dd), "edge": list((g.matrix.to_3x3() @ V((0, 0, 1))).normalized()),
                         "tip": list(butt + dd * GD["length"]), "base": list(butt + dd * GD["blade_base"]),
                         "grip_R": list(butt + dd * (GD["grips"]["grip_off"])),
                         "hips": list(pbs[hips].head), "head": list(hd.head), "head_top": list(hd.tail),
                         "knee_z": [pbs[f"J_Bip_{s}_LowerLeg"].head.z for s in "LR"],
                         "chest_z": pbs["J_Bip_C_UpperChest"].head.z, "neck_z": pbs["J_Bip_C_Neck"].head.z,
                         # joints for the spacing metric (r3_report.py): how far each moves on screen per drawing
                         "joints": {n: list(pbs[n].head) for n in (
                             "J_Bip_C_Hips", "J_Bip_C_UpperChest", "J_Bip_C_Head", "J_Bip_L_Hand", "J_Bip_R_Hand",
                             "J_Bip_L_LowerArm", "J_Bip_R_LowerArm", "J_Bip_L_LowerLeg", "J_Bip_R_LowerLeg",
                             "J_Bip_L_Foot", "J_Bip_R_Foot")}}
    HERO_META["blade"] = blade
    HERO_META["glaive_length"] = GD["length"]
    HERO_META["blade_base"] = GD["blade_base"]
    HERO_META["world_glaive_keys"] = WW
    meas["hand_gap_to_shaft_cm"] = [v for m in rig.values() for v in m.get("hand_gap_cm", {}).values()]
    meas["foot_lock_slide_cm"] = [x["max_drift_cm"] for v in drift.values() for x in v]
    log("hero measured: hand gap max", max(meas["hand_gap_to_shaft_cm"] or [0]), "cm; plant drift max",
        max(meas["foot_lock_slide_cm"] or [0]), "cm")

if SAVE:
    os.makedirs(os.path.dirname(SAVE), exist_ok=True)
    arm.animation_data.action.name = os.path.splitext(os.path.basename(NPZ))[0]
    bpy.ops.wm.save_as_mainfile(filepath=SAVE, copy=True)
    log("saved", SAVE)

# ---------------------------------------------------------------------------- 6. render
HIDE = []
if HERO:
    _sh = json.load(open(HERO, encoding="utf-8"))
    HIDE = [k for k, v in _sh.get("smear", {}).items() if not k.startswith("_") and v.get("hide_glaive")]
# the stole tails hang from the glaive head (DESIGN.md 7: "the weapon's built-in motion trail"), so they go
# with it: on a smear drawing the smear is the trail
GLAIVE_OBS = [o for o in sc.objects if o.type == "MESH" and o.get("part", o.name) in ("glaive", "glaive_glass", "stole")]
if HIDE:
    # round 3b: a smear drawing replaces the solid glaive with the smear and a bent glaive (smear.py v2), so
    # the body renders without it (the depth pass then holds the body only)
    for f in RENDER_FRAMES:
        hide = DRAWING[f] in HIDE
        for o in GLAIVE_OBS:
            o.hide_render = hide
            o.keyframe_insert("hide_render", frame=f)
    log("glaive hidden on", [f for f in RENDER_FRAMES if DRAWING[f] in HIDE])
    sc.frame_set(RENDER_FRAMES[0])
if RENDER:
    for o in GLAIVE_OBS:          # the canvas is sized with the glaive in every frame
        o.hide_render = False
    shot = render.setup_shot(sc, PX, yaw=YAW, elev=ELEV, ss=SS, frames=RENDER_FRAMES, pad=PAD)
    out = os.path.join(OUT, f"px{PX}")
    render.render_passes(sc, out, PASSES, RENDER_FRAMES)
    anchors = {}
    for f in RENDER_FRAMES:
        sc.frame_set(f)
        anchors[str(f)] = posing.anchors(sc, PX)
    ppm = shot["ppm"]
    fwd_m = [float((ground_offset(f) - ground_offset(0)).dot(V((0, -1, 0)))) for f in range(F)]
    root_motion = [round((fwd_m[f] - fwd_m[f - 1]) * ppm, 3) if f else 0.0 for f in range(F)]
    render.write_meta(os.path.join(out, "meta.json"), shot, {
        "pose": os.path.basename(NPZ), "expression": EXPR, "anchors": anchors, "frames": RENDER_FRAMES,
        "passes": PASSES, "thong": None,
        "motion": {"npz": NPZ, "blend": BLEND, "game_frames": F, "sample_frame": [int(x) for x in DISPLAY],
                   "body_sample_frame": [int(x) for x in SAMPLE],
                   "drawing": DRAWING, "root_motion_px": root_motion,
                   "root_motion_total_px": round(sum(root_motion), 2), "in_place": not KEEP_ROOT,
                   "leg_scale": S_LEG, "measurements": meas, "hero": HERO_META, "jiggle": JIGGLE_META}})
    log("rendered", out, shot["canvas"])
print("APPLY_DONE", json.dumps({"frames": F, "drawings": len(RENDER_FRAMES),
                                "max_hand_gap_cm": max(meas["hand_gap_to_shaft_cm"] or [0]),
                                "max_foot_slide_cm": max(meas["foot_lock_slide_cm"] or [0])}))
