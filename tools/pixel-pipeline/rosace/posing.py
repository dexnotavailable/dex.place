"""Pose library runtime: apply art/rosace/poses/*.json to the rig.

Pose JSON (all angles in degrees, positions in metres, world frame of the rest model:
+Z up, she faces -Y, her left is +X):
  name, camera {yaw, elev}
  root {loc, rot}                      rot = [x, y, z] rotation about world axes (applied Z, Y, X)
  bones {J_Bip_*: [x, y, z]}           rotation relative to rest, about world-rest axes carried
                                       by the parent (the spike's convention); hips may also
                                       take "J_Bip_C_Hips.loc": [dx, dy, dz]; any bone may take
                                       "<bone>.scale": k or [x, y, z] (exaggeration: foreshortened
                                       hands, stretched limbs), applied after IK
  weapon {butt, dir, edge} | {grip: "hand.R", socket, dir, edge}
                                       dir = butt -> tip, edge = where the cutting edge points
  hands {R|L: {grip: socket, thumb: "tip"|"butt", back: [x,y,z]}
          or {pos, fdir, palm}}        IK targets; 'back' = back-of-hand direction
  poles {arm.R: [x,y,z], leg.L: ...}   world positions for IK poles
  feet {R|L: {pos, yaw, pitch}}        ankle position, toe yaw/pitch relative to rest
  fingers {R|L: {curl, thumb}}
  drape {gravity, wind, chains: {chain: {g, wind, bend}}}
  expression                            face stamp id for the post-process (stamps are authored
                                        pixels, never 3D)
"""
import json
import math
import os

import bpy
from mathutils import Matrix, Quaternion, Vector

from .common import POSES_DIR, lerp

V = Vector
FINGERS = ("Index", "Middle", "Ring", "Little")
# chains and their default drape stiffness (0 = follows the parent, 1 = hangs straight down)
CHAIN_DEFAULTS = {
    "hair_back": 0.55, "hair_tail": 0.85, "side_L": 0.6, "side_R": 0.6, "veil": 0.7,
    "tabard": 0.92, "sleeve_L": 0.9, "sleeve_R": 0.9, "stole_A": 0.9, "stole_B": 0.9,
}


def arm_obj():
    return bpy.data.objects["rosace_rig"]


def eul_q(r):
    return (Quaternion((0, 0, 1), math.radians(r[2])) @ Quaternion((0, 1, 0), math.radians(r[1])) @
            Quaternion((1, 0, 0), math.radians(r[0])))


def reset(arm):
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Quaternion()
        pb.location = V()
        pb.scale = V((1, 1, 1))
        for c in pb.constraints:
            if c.name in ("ik", "ik_rot"):
                c.mute = True


def set_world_rel(arm, name, q_world):
    """rotation about world-rest axes, relative to rest, as a local pose rotation"""
    pb = arm.pose.bones[name]
    r = pb.bone.matrix_local.to_quaternion()
    pb.rotation_quaternion = r.inverted() @ q_world @ r


def set_bone_matrix(arm, name, M):
    """armature-space target matrix for a bone"""
    pb = arm.pose.bones[name]
    pb.matrix = M
    bpy.context.view_layer.update()


def update():
    bpy.context.view_layer.update()


# ---------------------------------------------------------------------------- weapon
def weapon_frame(dir_, edge):
    d = V(dir_).normalized()
    e = V(edge)
    e = (e - d * e.dot(d)).normalized()
    return d, e


def glaive_rest_axes(arm):
    b = arm.data.bones["glaive"]
    M = b.matrix_local.to_3x3()
    # bone Y is the haft (toward the tip); edge axis was aligned as the roll reference (bone Z)
    return M


def place_weapon(arm, spec):
    G = arm["glaive"]
    L = G["length"]
    grips = G["grips"]
    d, e = weapon_frame(spec.get("dir", (0, 0, 1)), spec.get("edge", (0, -1, 0)))
    if "butt" in spec:
        butt = V(spec["butt"])
    else:
        # socket at a given world point
        sock = spec.get("socket", "grip_main")
        z = grips[sock] if sock in grips else (L if sock == "glaive_tip" else 0.0)
        butt = V(spec["at"]) - d * z
    main = butt + d * grips["grip_main"]
    # bone frame: Y = haft, Z = edge (align_roll used the edge as reference for Z)
    y = d
    z = e
    x = y.cross(z).normalized()
    z = x.cross(y).normalized()
    M = Matrix((x, y, z)).transposed().to_4x4()
    M.translation = main
    set_bone_matrix(arm, "glaive", M)
    return {"butt": butt, "dir": d, "edge": e}


def socket_world(arm, name):
    pb = arm.pose.bones[name]
    return (arm.matrix_world @ pb.head).copy()


# ---------------------------------------------------------------------------- hands
def hand_rest(arm, s):
    b = arm.data.bones[f"J_Bip_{s}_Hand"]
    fx = 1.0 if s == "L" else -1.0
    head = b.head_local.copy()
    fdir0 = V((fx, 0, 0))
    palm0 = V((0, 0, -1))
    grip0 = head + fdir0 * 0.048 + palm0 * 0.026
    return b.matrix_local.copy(), head, fdir0, palm0, grip0


def frame(a, b):
    a = a.normalized()
    b = (b - a * b.dot(a)).normalized()
    return Matrix((a, b, a.cross(b))).transposed()


def orient_hand(arm, s, fdir, palm, at=None, at_is_grip=False):
    """IK target so the hand's fingers point along fdir with the palm facing palm.
    at = world position of the wrist (or of the grip point if at_is_grip)."""
    Mrest, head0, fdir0, palm0, grip0 = hand_rest(arm, s)
    R = frame(V(fdir), V(palm)) @ frame(fdir0, palm0).inverted()
    pivot0 = grip0 if at_is_grip else head0
    head = V(at) + R @ (head0 - pivot0)
    M = (R.to_4x4() @ Mrest.to_3x3().to_4x4())
    M.translation = head
    set_bone_matrix(arm, f"ik_hand.{s}", M)
    c = arm.pose.bones[f"J_Bip_{s}_LowerArm"].constraints["ik"]
    c.mute = False
    arm.pose.bones[f"J_Bip_{s}_Hand"].constraints["ik_rot"].mute = False


def grip_hand(arm, s, socket, thumb="tip", back=None, slide=0.0):
    """close the hand around the haft at a socket; back = back-of-hand direction hint"""
    wp = arm.pose.bones["glaive"]
    d = (wp.tail - wp.head).normalized()
    P = socket_world(arm, socket) + d * slide
    u = d if thumb == "tip" else -d
    b = V(back) if back else V((-1, 0, 0) if s == "R" else (1, 0, 0))
    b = (b - d * b.dot(d)).normalized()
    palm = -b
    fdir = palm.cross(u) if s == "R" else u.cross(palm)
    orient_hand(arm, s, fdir, palm, at=P, at_is_grip=True)


def curl_fingers(arm, s, curl=75.0, thumb=40.0, spread=0.0):
    ax = V((0, -1, 0)) if s == "R" else V((0, 1, 0))
    for f in FINGERS:
        for j, k in ((1, 0.9), (2, 1.1), (3, 0.8)):
            n = f"J_Bip_{s}_{f}{j}"
            if n in arm.pose.bones:
                set_world_rel(arm, n, Quaternion(ax, math.radians(curl * k)))
    # thumb: fold across the palm
    tax = V((1, 0, 0)) if s == "R" else V((-1, 0, 0))
    for j, k in ((1, 0.5), (2, 0.8), (3, 0.8)):
        n = f"J_Bip_{s}_Thumb{j}"
        if n in arm.pose.bones:
            set_world_rel(arm, n, Quaternion(tax, math.radians(thumb * k)) @
                          Quaternion(ax, math.radians(thumb * 0.5 * k)))


# ---------------------------------------------------------------------------- feet
def place_foot(arm, s, pos, yaw=0.0, pitch=0.0):
    """ankle target; yaw about world Z, pitch about the foot's own sideways axis (+ = heel up)"""
    b = arm.data.bones[f"ik_foot.{s}"]
    R = (Quaternion((0, 0, 1), math.radians(yaw)) @ Quaternion((1, 0, 0), math.radians(pitch))).to_matrix()
    M = (R @ b.matrix_local.to_3x3()).to_4x4()
    M.translation = V(pos)
    set_bone_matrix(arm, f"ik_foot.{s}", M)
    arm.pose.bones[f"J_Bip_{s}_LowerLeg"].constraints["ik"].mute = False
    arm.pose.bones[f"J_Bip_{s}_Foot"].constraints["ik_rot"].mute = False


def place_pole(arm, name, pos):
    M = arm.pose.bones[name].matrix.copy()
    M.translation = V(pos)
    set_bone_matrix(arm, name, M)


# ---------------------------------------------------------------------------- drape
def body_capsules(arm):
    pb = arm.pose.bones
    caps = []

    def cap(a, b, r):
        caps.append((a.copy(), b.copy(), r))
    for s in "LR":
        ul, ll = pb[f"J_Bip_{s}_UpperLeg"], pb[f"J_Bip_{s}_LowerLeg"]
        cap(ul.head, ul.tail, 0.078)
        cap(ll.head, ll.tail, 0.058)
        ua, la = pb[f"J_Bip_{s}_UpperArm"], pb[f"J_Bip_{s}_LowerArm"]
        cap(ua.head, ua.tail, 0.045)
        cap(la.head, la.tail, 0.038)
    hips, sp, ch, uc = pb["J_Bip_C_Hips"], pb["J_Bip_C_Spine"], pb["J_Bip_C_Chest"], pb["J_Bip_C_UpperChest"]
    Mh = hips.matrix.to_3x3()
    back = Mh @ V((0, 1, 0))
    # pelvis + seat: a capsule across the hips, pushed back toward the glutes
    for s in (-1, 1):
        side = Mh @ V((s * 0.075, 0, 0))
        cap(hips.head + side + back * 0.02 + Mh @ V((0, 0, -0.11)), hips.head + side + back * 0.02 + Mh @ V((0, 0, -0.03)), 0.10)
    cap(sp.head, ch.tail, 0.10)
    cap(uc.head, uc.tail, 0.10)
    return caps


def push_caps(p, caps, margin=0.012):
    for a, b, r in caps:
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
        c = a + ab * t
        d = p - c
        L = d.length
        if L < r + margin:
            if L < 1e-6:
                d, L = V((0, 1, 0)), 1e-6
            p = c + d / L * (r + margin)
    return p


def drape(arm, spec):
    chains = arm.data.get("chains", {})
    grav = V(spec.get("gravity", (0, 0, -1))).normalized()
    wind = V(spec.get("wind", (0, 0, 0)))
    per = spec.get("chains", {})
    update()
    caps = body_capsules(arm)
    order = ["hair_back", "hair_tail", "side_L", "side_R", "veil", "tabard", "sleeve_L", "sleeve_R",
             "stole_A", "stole_B"]
    for ch in order:
        if ch not in chains:
            continue
        cs = per.get(ch, {})
        g = cs.get("g", CHAIN_DEFAULTS.get(ch, 0.8))
        w = V(cs.get("wind", wind))
        bend = cs.get("bend", 0.0)
        collide = cs.get("collide", ch not in ("stole_A", "stole_B", "side_L", "side_R"))
        for i, bn in enumerate(chains[ch]):
            pb = arm.pose.bones[bn]
            update()
            head = pb.head.copy()
            cur = (pb.tail - pb.head)
            L = cur.length
            cur.normalize()
            gi = min(1.0, g * (0.75 + 0.25 * i))
            tgt = cur.lerp(grav, gi) + w * (0.6 + 0.4 * i) + cur * bend
            if tgt.length < 1e-6:
                tgt = cur
            tgt.normalize()
            tail = head + tgt * L
            if collide:
                for _ in range(3):
                    tail = push_caps(tail, caps)
                    tail = head + (tail - head).normalized() * L
            q = cur.rotation_difference((tail - head).normalized())
            M = pb.matrix.copy()
            R = q.to_matrix().to_4x4()
            M2 = Matrix.Translation(head) @ R @ Matrix.Translation(-head) @ M
            pb.matrix = M2
    update()


# ---------------------------------------------------------------------------- apply
def apply_pose(P):
    """Positions/directions in feet, weapon, hands, poles and wind are authored in her own frame
    (as if she faced -Y at the origin); the root transform carries them into the world."""
    arm = arm_obj()
    bpy.context.view_layer.objects.active = arm
    reset(arm)
    update()
    root = P.get("root", {})
    Rq = eul_q(root.get("rot", (0, 0, 0)))
    R3 = Rq.to_matrix()
    T = V(root.get("loc", (0, 0, 0)))

    def tp(p):
        return T + R3 @ V(p)

    def td(d):
        return R3 @ V(d)
    if root:
        pb = arm.pose.bones["Root"]
        set_world_rel(arm, "Root", Rq)
        pb.location = pb.bone.matrix_local.to_3x3().inverted() @ T
    scales = {}
    for n, r in P.get("bones", {}).items():
        if n.endswith(".loc"):
            bn = n[:-4]
            pb = arm.pose.bones[bn]
            pb.location = pb.bone.matrix_local.to_3x3().inverted() @ V(r)
            continue
        if n.endswith(".scale"):
            scales[n[:-6]] = r      # applied after IK (a scaled IK chain would mis-solve)
            continue
        if n in arm.pose.bones:
            set_world_rel(arm, n, eul_q(r))
    update()
    yaw0 = root.get("rot", (0, 0, 0))[2]
    for s, f in P.get("feet", {}).items():
        place_foot(arm, s, tp(f["pos"]), f.get("yaw", 0.0) + yaw0, f.get("pitch", 0.0))
    update()
    # poles after the feet: leg poles are children of the foot targets
    for name, pos in P.get("poles", {}).items():
        place_pole(arm, f"pole_{name}", tp(pos))
    update()
    wmeta = None
    if "weapon" in P:
        W = dict(P["weapon"])
        for k in ("butt", "at"):
            if k in W:
                W[k] = tp(W[k])
        for k in ("dir", "edge"):
            if k in W:
                W[k] = td(W[k])
        wmeta = place_weapon(arm, W)
    update()
    for s, h in P.get("hands", {}).items():
        if "grip" in h:
            grip_hand(arm, s, h["grip"], h.get("thumb", "tip"), td(h["back"]) if h.get("back") else None,
                      h.get("slide", 0.0))
        else:
            orient_hand(arm, s, td(h["fdir"]), td(h["palm"]), at=tp(h["pos"]), at_is_grip=h.get("at_grip", False))
    for s, f in P.get("fingers", {}).items():
        curl_fingers(arm, s, f.get("curl", 70), f.get("thumb", 40), f.get("spread", 0))
    update()
    # per-drawing exaggeration (RESEARCH 4.2, Guilty Gear): foreshortened hands, a stretched
    # reaching limb; uniform scale on the bone, children follow
    for bn, k in scales.items():
        pb = arm.pose.bones[bn]
        pb.scale = V(k) if isinstance(k, (list, tuple)) else V((k, k, k))
    update()
    D = dict(P.get("drape", {}))
    if "wind" in D:
        D["wind"] = list(td(D["wind"]))
    ch = {}
    for k, v in D.get("chains", {}).items():
        v = dict(v)
        if "wind" in v:
            v["wind"] = list(td(v["wind"]))
        ch[k] = v
    D["chains"] = ch
    drape(arm, D)
    return {"name": P.get("name"), "camera": P.get("camera", {}), "expression": P.get("expression", "serene"),
            "weapon": {k: list(v) for k, v in (wmeta or {}).items()}}


def apply_pose_file(path):
    if not os.path.isabs(path) and not os.path.exists(path):
        path = os.path.join(POSES_DIR, path)
    with open(path, encoding="utf-8") as f:
        P = json.load(f)
    return apply_pose(P)


# ---------------------------------------------------------------------------- anchors
def anchors(sc, px):
    """projected face anchors for the stamp step (pixels, y down) + head facing"""
    from .render import project
    arm = arm_obj()
    pb = arm.pose.bones
    M = arm.matrix_world
    out = {}
    head = pb["J_Bip_C_Head"]
    Mh = M @ head.matrix
    rest_inv = head.bone.matrix_local.inverted()
    fwd = (Mh.to_3x3() @ rest_inv.to_3x3() @ V((0, -1, 0))).normalized()
    cam = sc.camera
    cam_back = (cam.matrix_world.to_3x3() @ V((0, 0, 1))).normalized()
    right = (cam.matrix_world.to_3x3() @ V((1, 0, 0))).normalized()
    up = (cam.matrix_world.to_3x3() @ V((0, 1, 0))).normalized()
    out["head_fwd_dot_cam"] = fwd.dot(cam_back)
    out["head_fwd_screen"] = [fwd.dot(right), -fwd.dot(up)]
    hm = arm["head_metrics"]
    for s in "LR":
        e = pb[f"J_Adj_{s}_FaceEye"]
        wp = M @ e.head
        n = (Mh.to_3x3() @ rest_inv.to_3x3() @ V((0.35 if s == "L" else -0.35, -1, 0.05))).normalized()
        out[f"eye_{s}"] = project(sc, wp) + [n.dot(cam_back)]
    # mouth: on the face surface below the eyes
    eyes = (pb["J_Adj_L_FaceEye"].head + pb["J_Adj_R_FaceEye"].head) / 2
    mouth_rest = V((0.0, hm["forehead_y"] + 0.012, hm["chin"] + 0.030))
    mw = M @ (head.matrix @ rest_inv @ mouth_rest)
    out["mouth"] = project(sc, mw) + [fwd.dot(cam_back)]
    out["head"] = project(sc, M @ head.head)
    out["root"] = project(sc, M @ pb["Root"].head)
    # hands and weapon sockets, for placing hand-authored override patches
    for s in "LR":
        hb = pb.get(f"J_Bip_{s}_Hand")
        if hb:
            out[f"hand_{s}"] = project(sc, M @ hb.head)
            tip = pb.get(f"J_Bip_{s}_Middle3") or hb
            out[f"hand_{s}_tip"] = project(sc, M @ tip.tail)
    for s in "LR":
        out[f"knee_{s}"] = project(sc, M @ pb[f"J_Bip_{s}_LowerLeg"].head)
    for n in ("grip_main", "grip_mid", "grip_off", "glaive_tip", "glaive_butt"):
        if n in pb:
            out[n] = project(sc, M @ pb[n].head)
    return out


# ---------------------------------------------------------------------------- animation
def _hierarchy(arm):
    out = []

    def walk(b):
        out.append(b.name)
        for c in b.children:
            walk(c)
    for b in arm.data.bones:
        if b.parent is None:
            walk(b)
    return out


def bake_keys(keys, action_name="rosace_seq"):
    """Key poses into an action for frame rendering: keys = [(frame, pose_file_or_dict), ...].
    Each pose is applied (IK, grips, drape all solved), its evaluated bone matrices are captured,
    then written back as plain FK keys with every IK constraint muted, so frame_set() plays
    the sequence without re-solving. Timing and easing between keys stay ours to tune
    (keyframe interpolation / extra keys), whatever produced the key poses."""
    arm = arm_obj()
    snaps = []
    meta = []
    for frame, P in keys:
        m = apply_pose_file(P) if isinstance(P, str) else apply_pose(P)
        update()
        snaps.append((frame, {pb.name: pb.matrix.copy() for pb in arm.pose.bones}))
        meta.append((frame, m))
    for pb in arm.pose.bones:
        for c in pb.constraints:
            if c.name in ("ik", "ik_rot"):
                c.mute = True
    arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions.new(action_name)
    order = _hierarchy(arm)
    for frame, mats in snaps:
        for n in order:
            pb = arm.pose.bones[n]
            pb.matrix = mats[n]
            update()
        for n in order:
            pb = arm.pose.bones[n]
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            pb.keyframe_insert("location", frame=frame)
    sc = bpy.context.scene
    sc.frame_start = min(f for f, _ in keys)
    sc.frame_end = max(f for f, _ in keys)
    return meta
