"""Hero-key layer and spring cloth (runs inside Blender; used by blender_apply.py --hero SHEET).

Hero keys are hand-authored poses on Rosace's rig; the AI (Kimodo, retargeted) is kept only for
the in-betweens and weight shifts. RETIME.md "Round 2" explains the tuning side.

A hero key is an ordinary pose-library JSON (tools/pixel-pipeline/rosace/posing.py), plus two
conveniences resolved here before posing.apply_pose:
  weapon.hand_R: [x, y, z]   put the right hand's grip point there (instead of the grip_off socket);
                             the socket is moved back along the haft by hands.R.slide, so a hand
                             choked down toward the butt is authored where the hand is
  hands.L.free: true         the left hand lets go (no IK; its arm is posed by 'bones' FK)

The layer works on a per-frame rig STATE (capture):
  q        visual local rotation of every J_Bip bone (IK results baked in, so a blend between two
           keys blends real arm and leg poses, not a T-pose rest)
  hips     the hips' pose location
  p, R     the right hand's grip point on the haft and the glaive bone's rotation, both in the
           upper chest's frame, so a held weapon rides with the torso between keys
  slideR, slideL, wL   grip slides along the haft and how much the left hand grips
  backR, backL         back-of-hand hints (chest frame)
  poleA    elbow poles (chest frame); poleL knee poles (armature)
  foot     ankle IK target matrices (armature, in-place ground)
Delta of a hero key k: D_k = AI(k)^-1 * HERO(k) for rotations, HERO(k) - AI(k) for vectors and
scalars. Each retime key gets a delta from the sheet's "hero" section (pose / carry / mix / none);
between keys the deltas are slerped and lerped by the retime's own eased progress and laid on the
AI state of that frame. At a hero key the rig shows exactly the authored pose; in between it shows
the AI's weight shifts carried into the authored extremes.

Feet: the sheet's "plants" lock a foot on the spot a hero key puts it for a frame span (0 drift by
construction, world-anchored against in-place root motion). Between two different plant spots the
foot steps: position eased from spot to spot with a lift of up to 8 cm.

Cloth: spring chains. Each chain bone's tip is a damped spring (omega, zeta per DESIGN.md 8's lag
order) pulled toward the static drape of the current drawing (posing.drape with the drape spec
blended between hero keys), with inertia in armature space and a length constraint, stepped at
60 fps. So the cloth trails the body's drawing changes by 1-3 drawings, overshoots and settles,
and it keeps moving through a held drawing. Held drawings get a cloth-only redraw every 2 frames
(30 fps, MOVESET 0.1's drawing rate) while any chain tip still moves 0.75 px or more.
"""
import copy
import math

import bpy
from mathutils import Matrix, Quaternion, Vector

V = Vector
Y = V((0.0, 1.0, 0.0))

# omega (rad per 60 fps frame), zeta; DESIGN.md 8: veil / sidelocks / sleeves lag 1 drawing,
# tabard and hair tail 2, stole tails 2-3; settle in 2-4 drawings
CHAIN_DYN = {
    "veil": (0.70, 0.50), "side_L": (0.70, 0.50), "side_R": (0.70, 0.50),
    "sleeve_L": (0.55, 0.40), "sleeve_R": (0.55, 0.40),
    "tabard": (0.36, 0.42), "hair_tail": (0.26, 0.40), "hair_back": (0.36, 0.45),
    "stole_A": (0.22, 0.34), "stole_B": (0.22, 0.34),
}
NO_COLLIDE = ("stole_A", "stole_B", "side_L", "side_R")
FLOOR_Z = 0.008
# round 3: DESIGN.md 8 asks the stole tails to trail by 2-3 drawings. A spring alone can't: the stoles
# don't collide, so the length limit drags the tip along with the anchor in the same frame (round 2
# measured a 1-frame lag). A lag offset does it: the stole springs toward the drape SHAPE of the drawing
# shown `lag` frames earlier, hung from where its root is now. Per sheet: hero.cloth_lag, e.g.
# {"stole_A": 4, "stole_B": 4} (4 f = 2 drawings); round-2 sheets have none, so they render as before.
CHAIN_LAG = {}


# ---------------------------------------------------------------------------- pose JSON helpers
def resolve(P, arm=None):
    """pose JSON -> the plain posing.py form (hand_R -> socket position; free left hand dropped)"""
    P = copy.deepcopy(P)
    W = P.get("weapon")
    if W and "hand_R" in W:
        d = V(W["dir"]).normalized()
        slide = float(P.get("hands", {}).get("R", {}).get("slide", 0.0))
        at = V(W.pop("hand_R")) - d * slide
        W["socket"] = "grip_off"
        W["at"] = list(at)
    hands = P.get("hands", {})
    if hands.get("L", {}).get("free"):
        hands.pop("L")
    return P


def free_left(P):
    return bool(P.get("hands", {}).get("L", {}).get("free"))


# ---------------------------------------------------------------------------- state
def j_order(arm):
    from rosace import posing
    return [n for n in posing._hierarchy(arm) if n.startswith("J_Bip")]


def visual_basis(arm, pb):
    return arm.convert_space(pose_bone=pb, matrix=pb.matrix, from_space="POSE", to_space="LOCAL")


def capture(arm, order, info):
    """the rig's evaluated state now; info = {slideR, slideL, wL, backR, backL} (armature vectors)"""
    pbs = arm.pose.bones
    C = pbs["J_Bip_C_UpperChest"].matrix.copy()
    Ci = C.inverted()
    Cr = C.to_3x3().normalized()
    Cri = Cr.inverted()
    st = {"q": {}}
    for n in order:
        st["q"][n] = visual_basis(arm, pbs[n]).to_quaternion()
    st["hips"] = pbs["J_Bip_C_Hips"].location.copy()
    g = pbs["glaive"].matrix
    d = (g.to_3x3() @ Y).normalized()
    p = pbs["grip_off"].head + d * info["slideR"]
    st["p"] = Ci @ p
    st["R"] = (Cri @ g.to_3x3().normalized()).to_quaternion()
    st["slideR"], st["slideL"], st["wL"] = float(info["slideR"]), float(info["slideL"]), float(info["wL"])
    st["backR"] = Cri @ V(info["backR"])
    st["backL"] = Cri @ V(info["backL"])
    st["poleA"] = {s: Ci @ pbs[f"pole_arm.{s}"].matrix.translation for s in "LR"}
    st["poleL"] = {s: pbs[f"pole_leg.{s}"].matrix.translation.copy() for s in "LR"}
    st["foot"] = {s: pbs[f"ik_foot.{s}"].matrix.copy() for s in "LR"}
    return st


VEC = ("hips", "p", "backR", "backL")
SCAL = ("slideR", "slideL", "wL")


def delta(ai, he):
    D = {"q": {n: ai["q"][n].inverted() @ he["q"][n] for n in ai["q"]},
         "R": ai["R"].inverted() @ he["R"]}
    for k in VEC:
        D[k] = he[k] - ai[k]
    for k in SCAL:
        D[k] = he[k] - ai[k]
    D["poleA"] = {s: he["poleA"][s] - ai["poleA"][s] for s in "LR"}
    D["poleL"] = {s: he["poleL"][s] - ai["poleL"][s] for s in "LR"}
    D["foot"] = {s: (he["foot"][s].translation - ai["foot"][s].translation,
                     he["foot"][s].to_quaternion() @ ai["foot"][s].to_quaternion().inverted()) for s in "LR"}
    return D


def zero_delta(like):
    I = Quaternion()
    D = {"q": {n: I.copy() for n in like["q"]}, "R": I.copy()}
    for k in VEC:
        D[k] = V((0, 0, 0))
    for k in SCAL:
        D[k] = 0.0
    D["poleA"] = {s: V((0, 0, 0)) for s in "LR"}
    D["poleL"] = {s: V((0, 0, 0)) for s in "LR"}
    D["foot"] = {s: (V((0, 0, 0)), I.copy()) for s in "LR"}
    return D


def blend2(A, B, u):
    """delta between A (u=0) and B (u=1)"""
    D = {"q": {n: A["q"][n].slerp(B["q"][n], u) for n in A["q"]}, "R": A["R"].slerp(B["R"], u)}
    for k in VEC:
        D[k] = A[k].lerp(B[k], u)
    for k in SCAL:
        D[k] = A[k] + (B[k] - A[k]) * u
    D["poleA"] = {s: A["poleA"][s].lerp(B["poleA"][s], u) for s in "LR"}
    D["poleL"] = {s: A["poleL"][s].lerp(B["poleL"][s], u) for s in "LR"}
    D["foot"] = {s: (A["foot"][s][0].lerp(B["foot"][s][0], u), A["foot"][s][1].slerp(B["foot"][s][1], u))
                 for s in "LR"}
    return D


def mix(parts, like):
    """[(delta, weight), ...] -> one delta (sequential slerps; the rest of the weight is identity)"""
    acc, accw = None, 0.0
    for D, w in parts:
        if acc is None:
            acc, accw = D, w
            continue
        acc = blend2(acc, D, w / (accw + w))
        accw += w
    if acc is None:
        return zero_delta(like)
    if accw < 0.999:
        acc = blend2(zero_delta(like), acc, accw)
    return acc


def state_mix(parts):
    """[(state, weight)] -> one absolute state (round 3 'blend': exact spacing between hero keys,
    independent of the AI's own in-between; weights are normalised)"""
    acc, accw = None, 0.0
    for S, w in parts:
        if acc is None:
            acc, accw = S, w
            continue
        u = w / (accw + w)
        B = S
        st = {"q": {n: acc["q"][n].slerp(B["q"][n], u) for n in acc["q"]}, "R": acc["R"].slerp(B["R"], u)}
        for k in VEC:
            st[k] = acc[k].lerp(B[k], u)
        for k in SCAL:
            st[k] = acc[k] + (B[k] - acc[k]) * u
        st["poleA"] = {s: acc["poleA"][s].lerp(B["poleA"][s], u) for s in "LR"}
        st["poleL"] = {s: acc["poleL"][s].lerp(B["poleL"][s], u) for s in "LR"}
        st["foot"] = {}
        for s in "LR":
            t = acc["foot"][s].translation.lerp(B["foot"][s].translation, u)
            q = acc["foot"][s].to_quaternion().slerp(B["foot"][s].to_quaternion(), u)
            M = q.to_matrix().to_4x4()
            M.translation = t
            st["foot"][s] = M
        acc, accw = st, accw + w
    return acc


def apply_delta(ai, D):
    st = {"q": {n: ai["q"][n] @ D["q"][n] for n in ai["q"]}, "R": ai["R"] @ D["R"]}
    for k in VEC:
        st[k] = ai[k] + D[k]
    for k in SCAL:
        st[k] = ai[k] + D[k]
    st["poleA"] = {s: ai["poleA"][s] + D["poleA"][s] for s in "LR"}
    st["poleL"] = {s: ai["poleL"][s] + D["poleL"][s] for s in "LR"}
    st["foot"] = {}
    for s in "LR":
        t = ai["foot"][s].translation + D["foot"][s][0]
        r = D["foot"][s][1] @ ai["foot"][s].to_quaternion()
        M = r.to_matrix().to_4x4()
        M.translation = t
        st["foot"][s] = M
    return st


def floor_clamp(p, d, back_len, fwd_len, floor=0.012):
    """pitch the haft up about the right grip point until neither end is under the floor"""
    for k in (fwd_len, -back_len):
        z = p.z + d.z * k
        if z < floor:
            h = V((d.x, d.y, 0.0))
            if h.length < 1e-6:
                h = V((0, -1, 0))
            h.normalize()
            dz = max(-0.999, min(0.999, (floor - p.z) / k))
            d = (h * math.sqrt(1 - dz * dz) + V((0, 0, dz))).normalized()
    return d


def set_state(arm, order, st, fingersL=None):
    """pose the rig from a state: FK for the body, then the glaive, then hand and foot IK targets"""
    from rosace import posing
    pbs = arm.pose.bones
    for n in order:
        pbs[n].rotation_mode = "QUATERNION"
        pbs[n].rotation_quaternion = st["q"][n]
    pbs["J_Bip_C_Hips"].location = st["hips"]
    posing.update()
    C = pbs["J_Bip_C_UpperChest"].matrix.copy()
    Cr = C.to_3x3().normalized()
    G = arm["glaive"]
    grips = G["grips"]
    p = C @ st["p"]
    Rg = Cr @ st["R"].to_matrix()
    d = (Rg @ Y).normalized()
    back_len = grips["grip_off"] + st["slideR"]
    d2 = floor_clamp(p, d, back_len, G["length"] - back_len)
    if (d2 - d).length > 1e-6:
        Rg = d.rotation_difference(d2).to_matrix() @ Rg
        d = d2
    butt = p - d * back_len
    M = Rg.to_4x4()
    M.translation = butt + d * grips["grip_main"]
    posing.set_bone_matrix(arm, "glaive", M)
    posing.grip_hand(arm, "R", "grip_off", "tip", back=list(Cr @ st["backR"]), slide=st["slideR"])
    posing.grip_hand(arm, "L", "grip_main", "tip", back=list(Cr @ st["backL"]), slide=st["slideL"])
    for s in "LR":
        posing.place_pole(arm, f"pole_arm.{s}", C @ st["poleA"][s])
    for s in "LR":
        posing.set_bone_matrix(arm, f"ik_foot.{s}", st["foot"][s])
    for s in "LR":
        posing.place_pole(arm, f"pole_leg.{s}", st["poleL"][s])
    wL = max(0.0, min(1.0, st["wL"]))
    infl = {("R", "arm"): 1.0, ("L", "arm"): wL, ("L", "leg"): 1.0, ("R", "leg"): 1.0}
    for (s, limb), val in infl.items():
        cs = ([pbs[f"J_Bip_{s}_LowerArm"].constraints["ik"], pbs[f"J_Bip_{s}_Hand"].constraints["ik_rot"]]
              if limb == "arm" else
              [pbs[f"J_Bip_{s}_LowerLeg"].constraints["ik"], pbs[f"J_Bip_{s}_Foot"].constraints["ik_rot"]])
        for c in cs:
            c.mute = False
            c.influence = val
    posing.curl_fingers(arm, "R", 80, 50)
    posing.curl_fingers(arm, "L", 20 + 62 * wL, 15 + 38 * wL)
    posing.update()
    return {"glaive_dir": list(d), "wL": wL}


KEYED = ("ik_hand.L", "ik_hand.R", "ik_foot.L", "ik_foot.R", "pole_arm.L", "pole_arm.R", "pole_leg.L",
         "pole_leg.R", "glaive")


def key_state(arm, order, finger_bones, f):
    pbs = arm.pose.bones
    for n in order:
        pbs[n].keyframe_insert("rotation_quaternion", frame=f)
    pbs["J_Bip_C_Hips"].keyframe_insert("location", frame=f)
    for n in KEYED:
        pbs[n].keyframe_insert("location", frame=f)
        pbs[n].keyframe_insert("rotation_quaternion", frame=f)
    for n in finger_bones:
        pbs[n].keyframe_insert("rotation_quaternion", frame=f)
    for s in "LR":
        for bn, cn in ((f"J_Bip_{s}_LowerArm", "ik"), (f"J_Bip_{s}_Hand", "ik_rot"),
                       (f"J_Bip_{s}_LowerLeg", "ik"), (f"J_Bip_{s}_Foot", "ik_rot")):
            pbs[bn].constraints[cn].keyframe_insert("influence", frame=f)


# ---------------------------------------------------------------------------- feet
def plant_spots(plants, hero_states, key_frame, ground_offset):
    """{'L': [(a, b, world_matrix)]}: each plant's ankle matrix at its hero key, in ground space"""
    out = {}
    for s, spans in (plants or {}).items():
        if s.startswith("_"):
            continue
        out[s] = []
        for a, b, key in spans:
            M = hero_states[key]["foot"][s].copy()
            M.translation = M.translation + ground_offset(key_frame[key])
            out[s].append((int(a), int(b), M))
    return out


def foot_override(spots, s, f, ground_offset, layered):
    """planted: the spot; stepping between two different spots: an eased, lifted step; else None"""
    sp = spots.get(s, [])
    for a, b, M in sp:
        if a <= f <= b:
            R = M.copy()
            R.translation = M.translation - ground_offset(f)
            return R, "plant"
    prev = [x for x in sp if x[1] < f]
    nxt = [x for x in sp if x[0] > f]
    if prev and nxt:
        a0, e0, M0 = prev[-1]
        s1, b1, M1 = nxt[0]
        if (M1.translation - M0.translation).length <= 0.03:
            # a pivot on the planted foot: same spot, the heading turns
            u = (f - e0) / max(1, s1 - e0)
            q = M0.to_quaternion().slerp(M1.to_quaternion(), u * u * (3 - 2 * u))
            R = q.to_matrix().to_4x4()
            R.translation = M0.translation - ground_offset(f)
            return R, "pivot"
        if (M1.translation - M0.translation).length > 0.03:
            u = (f - e0) / max(1, s1 - e0)
            us = u * u * (3 - 2 * u)
            t = M0.translation.lerp(M1.translation, us) - ground_offset(f)
            t.z += 0.08 * math.sin(math.pi * u)
            q = M0.to_quaternion().slerp(M1.to_quaternion(), us)
            R = q.to_matrix().to_4x4()
            R.translation = t
            return R, "step"
    return None, "free"


# ---------------------------------------------------------------------------- cloth
def lerp_spec(A, B, u, chains):
    """two drape specs (armature space) -> a blended one, every chain explicit"""
    from rosace.posing import CHAIN_DEFAULTS

    def full(S):
        g0 = V(S.get("wind", (0, 0, 0)))
        ch = S.get("chains", {})
        return {c: (float(ch.get(c, {}).get("g", CHAIN_DEFAULTS.get(c, 0.8))), V(ch.get(c, {}).get("wind", g0)))
                for c in chains}
    fa, fb = full(A), full(B)
    return {"gravity": (0, 0, -1), "wind": [0, 0, 0],
            "chains": {c: {"g": fa[c][0] + (fb[c][0] - fa[c][0]) * u, "wind": list(fa[c][1].lerp(fb[c][1], u))}
                       for c in chains}}


def static_drape(arm, chains, spec):
    """static drape of the current body: per chain [(head, tail)] armature space, and body capsules"""
    from rosace import posing
    pbs = arm.pose.bones
    for bl in chains.values():
        for n in bl:
            pbs[n].rotation_mode = "QUATERNION"
            pbs[n].rotation_quaternion = Quaternion()
    posing.update()
    caps = posing.body_capsules(arm)
    posing.drape(arm, spec)
    out = {c: [(pbs[n].head.copy(), pbs[n].tail.copy()) for n in bl] for c, bl in chains.items()}
    return out, caps


def simulate(chains, targets, caps, F, sample, substeps=4, warm=60, lags=None, dyn=None, world=None, override=None):
    """targets[s][chain] = [(head, tail)] static drape of drawing s. Returns tips[f][chain] = [tip]

    round 3b: world = {chain: w} pins a lagged chain in space. Its spring target is the lagged drawing's
    drape where it hung THEN (absolute, weight w) instead of that shape re-hung from the root NOW, so when
    the body moves the tail stays behind on screen for the lag and then swings through (the root stays
    attached: the length limit). override = {f: (targets, caps)} replaces a frame's drape target (a held
    drawing whose cloth keeps winding up, 'hold_build')."""
    from rosace.posing import push_caps
    state = {}
    tips = []
    override = override or {}

    def tg(f):
        return override[f][0] if f in override else targets[sample[f]]
    for f in range(F):
        s = sample[f]
        T = tg(f)
        cp = override[f][1] if f in override else caps[s]
        frame = {}
        for c, bones in T.items():
            om, ze = (dyn or {}).get(c) or CHAIN_DYN.get(c, (0.5, 0.45))
            lag = int((lags if lags is not None else CHAIN_LAG).get(c, 0))
            shape = tg(max(0, f - lag))[c] if lag else bones
            wpin = float((world or {}).get(c, 0.0))
            L = [(t - h).length for h, t in bones]
            if c not in state:
                state[c] = {"x": [t.copy() for _, t in bones], "v": [V((0, 0, 0)) for _ in bones]}
            st = state[c]
            reps = warm if f == 0 else 1
            for _ in range(reps):
                for _k in range(substeps):
                    dt = 1.0 / substeps
                    head = bones[0][0]
                    for i, (h0, t0) in enumerate(shape):
                        dirT = (t0 - h0).normalized()
                        tgt = head + dirT * L[i]
                        if wpin > 0.0:
                            tgt = tgt * (1.0 - wpin) + t0 * wpin
                        a = (tgt - st["x"][i]) * (om * om) - st["v"][i] * (2 * ze * om)
                        st["v"][i] = st["v"][i] + a * dt
                        x = st["x"][i] + st["v"][i] * dt
                        if c not in NO_COLLIDE:
                            x = push_caps(x, cp)
                        r = (x - head)
                        r = r.normalized() if r.length > 1e-9 else dirT
                        x = head + r * L[i]
                        if x.z < FLOOR_Z:           # round 3b: cloth lies on the floor (the kneel's tabard went through it)
                            x.z = FLOOR_Z
                            r = (x - head)
                            r = r.normalized() if r.length > 1e-9 else dirT
                            x = head + r * L[i]
                            if x.z < FLOOR_Z:
                                x.z = FLOOR_Z
                        st["v"][i] = st["v"][i] - r * st["v"][i].dot(r)
                        st["x"][i] = x
                        head = x
            frame[c] = [x.copy() for x in st["x"]]
        tips.append(frame)
    return tips


def pose_chains(arm, chains, tips_f):
    """set chain bones so each bone points at its simulated tip (root to tip, like posing.drape)"""
    from rosace import posing
    pbs = arm.pose.bones
    for c, bl in chains.items():
        for i, n in enumerate(bl):
            pb = pbs[n]
            posing.update()
            head = pb.head.copy()
            cur = (pb.tail - pb.head)
            want = tips_f[c][i] - head
            if cur.length < 1e-9 or want.length < 1e-9:
                continue
            q = cur.normalized().rotation_difference(want.normalized())
            M = pb.matrix.copy()
            R = q.to_matrix().to_4x4()
            pb.matrix = Matrix.Translation(head) @ R @ Matrix.Translation(-head) @ M
    posing.update()


def cloth_frames(tips, sample, right, up, ppm, step=2, thresh=0.75):
    """display map: game frame -> the frame whose image it shows. A new body drawing is always a
    new image; inside a held drawing a cloth-only image every `step` frames while any chain tip
    moved >= thresh px since the last image."""
    F = len(sample)
    disp = [0] * F

    def scr(p):
        return (p.dot(right) * ppm, p.dot(up) * ppm)

    last = None
    for f in range(F):
        new_drawing = f == 0 or sample[f] != sample[f - 1]
        if new_drawing:
            last = f
        elif (f - last) >= step:
            mv = 0.0
            for c, xs in tips[f].items():
                a, b = scr(xs[-1]), scr(tips[last][c][-1])
                mv = max(mv, math.hypot(a[0] - b[0], a[1] - b[1]))
            if mv >= thresh:
                last = f
        disp[f] = last
    return disp


# ---------------------------------------------------------------------------- weapon (absolute)
# The weapon and hands are NOT layered as AI + delta: the AI's glaive direction comes from its
# wrists and swings wildly through regrips (round 1 bridged it; with hero deltas on top the haft
# pointed at the camera in N1's A3). Each retime key gets an absolute weapon state in the chest
# frame (hero / carried / mixed with the AI's own at that key), and drawings interpolate between
# the two keys around them. The body under it still carries the AI's motion, so a weapon held
# still in the chest frame still travels with every turn of the torso.
WKEYS_V = ("p", "backR", "backL")
WKEYS_S = ("slideR", "slideL", "wL")


ARM_PARTS = ("_Shoulder", "_UpperArm", "_LowerArm", "_Hand")


def is_arm(n):
    return n.startswith("J_Bip_") and any(n.endswith(k) for k in ARM_PARTS)


def weapon_of(st):
    """the absolute part of a state: weapon, grips, arms (FK seed and the free hand) and every IK pole.
    The AI's arms and knee poles follow its noisy wrists and knees, so they are interpolated from key
    to key like the weapon instead of being layered as deltas (N1's A3 threw the free hand at her face)."""
    return {"p": st["p"].copy(), "R": st["R"].copy(), "backR": st["backR"].copy(), "backL": st["backL"].copy(),
            "slideR": st["slideR"], "slideL": st["slideL"], "wL": st["wL"],
            "poleA": {s: st["poleA"][s].copy() for s in "LR"},
            "poleL": {s: st["poleL"][s].copy() for s in "LR"},
            "armq": {n: q.copy() for n, q in st["q"].items() if is_arm(n)}}


def weapon_blend(A, B, u):
    W = {"R": A["R"].slerp(B["R"], u), "poleA": {s: A["poleA"][s].lerp(B["poleA"][s], u) for s in "LR"},
         "poleL": {s: A["poleL"][s].lerp(B["poleL"][s], u) for s in "LR"},
         "armq": {n: A["armq"][n].slerp(B["armq"][n], u) for n in A["armq"]}}
    for k in WKEYS_V:
        W[k] = A[k].lerp(B[k], u)
    for k in WKEYS_S:
        W[k] = A[k] + (B[k] - A[k]) * u
    return W


def weapon_mix(parts, base):
    """[(W, weight)] on top of base (the AI's own weapon at that key) for the remaining weight"""
    acc, accw = None, 0.0
    for W, w in parts:
        if acc is None:
            acc, accw = W, w
        else:
            acc = weapon_blend(acc, W, w / (accw + w))
            accw += w
    if acc is None:
        return base
    return weapon_blend(base, acc, min(1.0, accw))


def set_weapon(st, W):
    st = dict(st)
    st.update({k: W[k] for k in ("p", "R", "backR", "backL", "slideR", "slideL", "wL")})
    st["poleA"] = W["poleA"]
    st["poleL"] = W["poleL"]
    st["q"] = dict(st["q"])
    st["q"].update(W["armq"])
    return st


# ---------------------------------------------------------------------------- weapon in world (round 3)
# Round 2 interpolated the glaive in the upper chest's frame. Through N5's spin the chest twists ~200
# degrees and pitches, so the blade rode up over her head and the haft crossed her face. A retime key
# can now give its glaive in world (her ground frame, she faces -Y at the origin, yaw + = toward +X):
#   {"hand_R": [x, y, z], "dir": [...], "edge": [...]}                 explicit
#   {"yaw": deg, "pitch": deg, "grip_az": deg, "grip_r": m, "grip_h": m} around the hips' vertical axis
#   "edge": "lead" (the cutting edge leads a sweep turning `turn` = +1 / -1)
#   "like": "<key>"   backs, elbow poles, slides and wL copied from that key, turned about the hips
#                     by the difference in glaive yaw (so a sweep drawing holds the contact grip)
#   "slideR", "slideL", "wL", "backR", "backL", "poleR", "poleL" (world) override any of those
def yaw_of(d):
    return math.degrees(math.atan2(d.x, -d.y))


def hdir(yaw_deg):
    a = math.radians(yaw_deg)
    return V((math.sin(a), -math.cos(a), 0.0))


def rot_z(v, deg, about=None):
    q = Quaternion((0, 0, 1), math.radians(deg))
    if about is None:
        return q @ v
    return about + q @ (v - about)


def weapon_to_world(W, C, hips):
    """a chest-frame weapon state -> world pieces"""
    Cr = C.to_3x3().normalized()
    Rg = Cr @ W["R"].to_matrix()
    return {"p": C @ W["p"], "d": (Rg @ Y).normalized(), "e": (Rg @ V((0, 0, 1))).normalized(),
            "backR": Cr @ W["backR"], "backL": Cr @ W["backL"],
            "poleR": C @ W["poleA"]["R"], "poleL": C @ W["poleA"]["L"],
            "slideR": W["slideR"], "slideL": W["slideL"], "wL": W["wL"], "hips": V((hips.x, hips.y, 0.0))}


def glaive_frame(d, e):
    d = d.normalized()
    e = (e - d * e.dot(d)).normalized()
    x = d.cross(e).normalized()
    z = x.cross(d).normalized()
    return Matrix((x, d, z)).transposed()


def weapon_from_world(g, C, hips, base_W, like_world=None):
    """world spec g -> a chest-frame weapon state (base_W supplies arms/poles not given)"""
    hc = V((hips.x, hips.y, 0.0))
    if "hand_R" in g:
        p = V(g["hand_R"])
        d = V(g["dir"]).normalized()
        yaw = yaw_of(d)
    else:
        yaw, pitch = float(g["yaw"]), float(g.get("pitch", 0.0))
        cp = math.cos(math.radians(pitch))
        d = V((math.sin(math.radians(yaw)) * cp, -math.cos(math.radians(yaw)) * cp, math.sin(math.radians(pitch))))
        az = float(g.get("grip_az", yaw))
        p = hc + hdir(az) * float(g.get("grip_r", 0.3))
        p.z = float(g.get("grip_h", 0.8))
    ed = g.get("edge", "lead")
    if ed == "lead":
        t = V((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0.0)) * float(g.get("turn", 1))
        e = t
    else:
        e = V(ed)
    out = {}
    if like_world is not None:
        dy = yaw - yaw_of(like_world["d"])
        out["backR"] = rot_z(like_world["backR"], dy)
        out["backL"] = rot_z(like_world["backL"], dy)
        out["poleR"] = rot_z(like_world["poleR"], dy, like_world["hips"]) + (hc - like_world["hips"])
        out["poleL"] = rot_z(like_world["poleL"], dy, like_world["hips"]) + (hc - like_world["hips"])
        for k in ("slideR", "slideL", "wL"):
            out[k] = like_world[k]
    for k in ("backR", "backL", "poleR", "poleL"):
        if k in g:
            out[k] = V(g[k]) if not k.startswith("pole") else V(g[k])
    for k in ("slideR", "slideL", "wL"):
        if k in g:
            out[k] = float(g[k])
    Ci = C.inverted()
    Cr = C.to_3x3().normalized()
    Cri = Cr.inverted()
    W = {k: (v.copy() if hasattr(v, "copy") else v) for k, v in base_W.items()}
    W["poleA"] = {s: base_W["poleA"][s].copy() for s in "LR"}
    W["p"] = Ci @ p
    W["R"] = (Cri @ glaive_frame(d, e)).to_quaternion()
    if "backR" in out:
        W["backR"] = Cri @ out["backR"]
    if "backL" in out:
        W["backL"] = Cri @ out["backL"]
    if "poleR" in out:
        W["poleA"]["R"] = Ci @ out["poleR"]
    if "poleL" in out:
        W["poleA"]["L"] = Ci @ out["poleL"]
    for k in ("slideR", "slideL", "wL"):
        if k in out:
            W[k] = out[k]
    return W
