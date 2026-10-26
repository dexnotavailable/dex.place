"""Figure-pose lane: the pose applier (DESIGN.md revision 3.5 item 7, art-rules/pose.md section 7).

A generic applier that runs AFTER rosace/posing.py: it imports posing.py's building blocks
(reset, set_world_rel, place_foot, place_pole, place_weapon, grip_hand, orient_hand, curl_fingers,
drape) and runs them in posing.apply_pose's exact order, so any existing pose file comes out
bone-for-bone identical (the `roundtrip` command proves it). An optional "figure" block adds what
appeal poses need, at fixed stages of that order. Pose designers work only in JSON; this file is
not theirs to edit.

POSE JSON (art/rosace/poses/*.json). Angles in degrees, positions in metres, in the rest model's
world frame: +Z up, she faces -Y, her left is +X. Everything posing.py reads works unchanged:
  name, note, camera {yaw, elev}, root {loc, rot}, bones {J_Bip_*: [x,y,z], "<bone>.loc",
  "<bone>.scale"}, feet {R|L: {pos, yaw, pitch}}, poles {leg.L|leg.R|arm.L|arm.R: [x,y,z]},
  weapon {butt, dir, edge} | {at, socket, dir, edge}, hands {R|L: {grip, slide, thumb, back} |
  {pos, fdir, palm, at_grip}}, fingers {R|L: {curl, thumb, spread}}, drape {gravity, wind,
  chains}, expression.
Rotation convention (posing.py's): [x, y, z] about the rest-world axes carried by the parent,
applied X first, then Y, then Z. For a torso/head bone:
  +x = bend forward (chin down)   -x = lean back / lift the chest
  +y = tilt toward HER LEFT (+X)  -y = tilt toward her right
  +z = turn toward her left       -z = turn toward her right (toward a camera at yaw > 0)
The camera: yaw 0 = in front of her, yaw 90 = on her right (-X side); elev = degrees above.

"figure" (all optional; stage in brackets):
  appeal       true/false: run the appeal (PS-*) checks. Default: the name starts with
               idle_appeal or back_appeal
  joints       {name: [x,y,z]} [after bones] rotations by friendly name, COMPOSED on top of any
               "bones" rotation of the same bone (q = q_joint * q_bones). Names: hips, spine,
               chest, upper_chest, neck, head, shoulder.L/R, upper_arm.L/R, lower_arm.L/R,
               hand.L/R, upper_leg.L/R, lower_leg.L/R, foot.L/R, toe.L/R, bust.L/R, or any bone
  torso        {bend: [x,y,z], split: [spine, chest, upper_chest]} [after joints] one rotation
               shared over the three torso bones (default split 0.3/0.35/0.35): the S-curve,
               chest lift and chest turn in one number each
  hips_loc     [dx,dy,dz] [after bones] metres, added to bones["J_Bip_C_Hips.loc"]
  weight       {leg: "R"|"L", knee: 178, over: "neck"|"com"|null, offset: [dx,dy]} [after the
               feet] the hips are moved so that (1) the pit of the neck ("neck") or the body's
               centre of mass ("com") sits over the weight ankle (+offset, root frame, metres) and
               (2) the weight knee's interior angle is `knee` (180 = locked straight) with the
               weight foot exactly on its target. PS-P07 by construction
  feet         {R|L: {roll, toe}} [with the feet] roll = rotation about the foot's long axis
               (+ = sole turns toward her midline), toe = toe bend (+ = toes up, for a raised
               heel with the ball on the floor). pos/yaw/pitch stay in the top-level "feet"
  hands        {R|L: {rel: <bone>, pos, fdir, palm}} [with the hands] replaces that side's
               top-level hand: pos/fdir/palm are given in the REST pose (world frame) and carried
               by the posed bone `rel`, so a hand set on the rest hip stays on the hip whatever
               the hips do. pos = the wrist (or the grip point with at_grip: true)
  fingers      {R|L: {curl, per: {Index|Middle|Ring|Little: deg | [j1,j2,j3]}, spread: deg |
               {finger: deg}, thumb: deg | {fold, curl, swing}}} [after the hands] per-finger
               curls (a number is spread over the joints as 0.9/1.1/0.8 of it, as posing.py
               does; a list sets each joint), spread fans the fingers apart (+) at the knuckle
               (Index/Middle/Ring/Little at -1/-0.33/+0.33/+1 of it, or per finger), thumb as
               posing.py's number or {fold across the palm, curl, swing about the palm normal}
  look         {at: "camera" | [x,y,z], amount: 1, neck: 0.35, offset: [yaw, pitch], tilt, chin,
               max: 75} [after the fingers] turn the head (and `neck` of the turn on the neck) so
               the face points at the camera or at a root-frame point; offset aims off it
               (+yaw = to screen right, +pitch = up); then tilt (+ = crown toward her left) and
               chin (+ = chin down) are added in the head's own frame; the turn is capped at max
Stages: reset, root, bones, [joints, torso, hips_loc], feet [+roll, toe], [weight], poles, weapon,
hands [+rel], fingers [+per-finger], [look], scales, drape.

Run (Blender, one at a time; absolute paths; default --blend lanes/figure-pose-base.blend):
  python tools/pixel-pipeline/blender_env.py run -b --python-exit-code 1 --python \\
      tools/pixel-pipeline/rosace_v2/figure_pose.py -- check --pose idle_appeal_a [--out <json>] [--clip]
          (no render, no GPU: the landmarks and every rig-measurable PS check, printed + JSON)
  ... figure_pose.py -- render --pose idle_appeal_a --out <dir> [--views cam,side:@left,back:@back]
          [--px 144,80] [--ss 4] [--hi 0] [--passes beauty,albedo,id,normal,depth]
          (per view <dir>/<view>/px<N>/: passes, meta.json, landmarks.json)
  ... figure_pose.py -- roundtrip --pose idle_hero [--out <json>]   (posing.py vs this applier)
  ... figure_pose.py -- apply --pose idle_appeal_a --save <lanes/figure-pose*.blend>
  python tools/pixel-pipeline/rosace_v2/figure_pose.py post --root <dir>          (plain python)
  python tools/pixel-pipeline/rosace_v2/figure_pose.py sheet --root <dir> --out <review dir>
  python tools/pixel-pipeline/rosace_v2/figure_pose.py diff --a <dir> --b <dir>   (still.png)
Views: cam = the pose file's camera; name:<yaw> a fixed yaw; name:@front|@q34|@left|@right|@back
relative to the posed chest (side = @left, the profile the bust breaks toward at yaw > 0).
Never writes rosace.blend, rosace_v1.blend or rosace_v2.blend; saves only lanes/figure-pose*.blend.
"""
import hashlib
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PIPE = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(PIPE))
POSES = os.path.join(REPO, "art", "rosace", "poses")
BUILD = os.environ.get("ROSACE_BUILD", r"D:\Dex\Projects\dex-place-art\rosace\build")
BASE_BLEND = os.path.join(BUILD, "lanes", "figure-pose-base.blend")
FORBIDDEN = ("rosace.blend", "rosace_v1.blend", "rosace_v2.blend")

ALIASES = {"hips": "J_Bip_C_Hips", "spine": "J_Bip_C_Spine", "chest": "J_Bip_C_Chest",
           "upper_chest": "J_Bip_C_UpperChest", "neck": "J_Bip_C_Neck", "head": "J_Bip_C_Head"}
for _s in "LR":
    for _k, _b in (("shoulder", "Shoulder"), ("upper_arm", "UpperArm"), ("lower_arm", "LowerArm"),
                   ("hand", "Hand"), ("upper_leg", "UpperLeg"), ("lower_leg", "LowerLeg"),
                   ("foot", "Foot"), ("toe", "ToeBase")):
        ALIASES[f"{_k}.{_s}"] = f"J_Bip_{_s}_{_b}"
    ALIASES[f"bust.{_s}"] = f"J_Sec_{_s}_Bust1"
TORSO = ("J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest")
TORSO_SPLIT = (0.3, 0.35, 0.35)
FINGERS = ("Index", "Middle", "Ring", "Little")
JOINT_K = (0.9, 1.1, 0.8)                 # posing.curl_fingers' share per joint
SPREAD_K = {"Index": -1.0, "Middle": -0.33, "Ring": 0.33, "Little": 1.0}
# segment masses (share of body mass; de Leva 1996, female) for the centre-of-mass balance
SEG_MASS = [("J_Bip_C_Head", 0.067, "head"), ("J_Bip_C_UpperChest", 0.16, "tail"), ("J_Bip_C_Chest", 0.10, "mid"),
            ("J_Bip_C_Spine", 0.14, "mid"), ("J_Bip_C_Hips", 0.125, "mid")] + \
    [(f"J_Bip_{s}_{b}", m, "mid") for s in "LR" for b, m in
     (("UpperArm", 0.026), ("LowerArm", 0.014), ("Hand", 0.006), ("UpperLeg", 0.148), ("LowerLeg", 0.048),
      ("Foot", 0.013))]


def pose_path(p):
    if os.path.isabs(p) or os.path.exists(p):
        return os.path.abspath(p)
    return os.path.join(POSES, p if p.endswith(".json") else p + ".json")


def load_pose(p):
    path = pose_path(p)
    with open(path, encoding="utf-8") as f:
        P = json.load(f)
    return P, path


def is_appeal(P):
    F = P.get("figure", {})
    if "appeal" in F:
        return bool(F["appeal"])
    n = P.get("name", "")
    return n.startswith("idle_appeal") or n.startswith("back_appeal")


# ============================================================================ Blender side
def _bl():
    import bpy
    from mathutils import Matrix, Quaternion, Vector
    sys.path.insert(0, PIPE)
    from rosace import posing
    return bpy, Matrix, Quaternion, Vector, posing


def bone_name(n):
    return ALIASES.get(n, n)


def world_rot(arm, name):
    """posed world rotation of a bone relative to its rest orientation (a rest-frame vector v maps
    to world_rot @ v)"""
    pb = arm.pose.bones[name]
    return (arm.matrix_world.to_3x3() @ pb.matrix.to_3x3() @ pb.bone.matrix_local.to_3x3().inverted())


def carried(arm, name, p_rest):
    """a rest-pose world point, carried rigidly by the posed bone"""
    from mathutils import Vector
    pb = arm.pose.bones[name]
    M = arm.matrix_world @ pb.matrix @ pb.bone.matrix_local.inverted()
    return M @ Vector(p_rest)


def compose_world_rel(arm, name, q_world):
    """add a rotation about the world-rest axes on top of the bone's current pose rotation
    (posing.set_world_rel's convention: local = r^-1 q r)"""
    pb = arm.pose.bones[name]
    r = pb.bone.matrix_local.to_quaternion()
    pb.rotation_quaternion = (r.inverted() @ q_world @ r) @ pb.rotation_quaternion


def loc_to_local(arm, name, delta_world):
    """pose-location increment for a bone that moves its head by delta_world"""
    from mathutils import Matrix
    pb = arm.pose.bones[name]
    # pb.matrix = parent.matrix @ parent_rest^-1 @ rest @ basis, so a basis translation t moves the
    # head by (parent.matrix @ parent_rest^-1 @ rest).3x3 @ t
    Mp = (pb.parent.matrix.to_3x3() @ pb.parent.bone.matrix_local.to_3x3().inverted()) if pb.parent else \
        Matrix.Identity(3)
    A = arm.matrix_world.to_3x3() @ Mp @ pb.bone.matrix_local.to_3x3()
    return A.inverted() @ delta_world


def com(arm):
    from mathutils import Vector
    pb = arm.pose.bones
    M = arm.matrix_world
    tot, acc = 0.0, Vector()
    for n, m, where in SEG_MASS:
        b = pb[n]
        p = b.head if where == "head" else (b.tail if where == "tail" else (b.head + b.tail) / 2)
        if n == "J_Bip_C_Head":
            p = b.head + (b.tail - b.head) * 0.5
        acc += (M @ p) * m
        tot += m
    return acc / tot


PIT_OFFSET = (0.0, -0.035, -0.01)      # the jugular notch: in front of and below the neck bone's head


def neck_pit(arm):
    """the pit of the neck (PS-P07's landmark), carried by the upper chest"""
    from mathutils import Vector
    return carried(arm, "J_Bip_C_UpperChest", arm.data.bones["J_Bip_C_Neck"].head_local + Vector(PIT_OFFSET))


def solve_weight(arm, W, tp, td, feet, posing):
    """move the hips so the pit of the neck (or the CoM) is over the weight ankle and the weight
    knee has the asked interior angle, with that foot on its target"""
    from mathutils import Vector
    s = W["leg"]
    if s not in feet:
        raise SystemExit(f"figure.weight.leg {s}: the top-level 'feet' needs a {s} entry (the ankle target)")
    ankle = tp(feet[s]["pos"])
    hips = arm.pose.bones["J_Bip_C_Hips"]
    rep = {}
    for _ in range(4):
        posing.update()
        over = W.get("over", "neck")
        if over:
            ref = neck_pit(arm) if over == "neck" else com(arm)
            off = W.get("offset", (0.0, 0.0))
            goal = ankle + td((off[0], off[1], 0.0))
            d = Vector((goal.x - ref.x, goal.y - ref.y, 0.0))
            hips.location = hips.location + loc_to_local(arm, "J_Bip_C_Hips", d)
            posing.update()
        if "knee" in W:
            ul, ll = arm.pose.bones[f"J_Bip_{s}_UpperLeg"], arm.pose.bones[f"J_Bip_{s}_LowerLeg"]
            L1, L2 = ul.bone.length, ll.bone.length
            k = math.radians(max(1.0, min(180.0, float(W["knee"]))))
            want = math.sqrt(max(L1 * L1 + L2 * L2 - 2 * L1 * L2 * math.cos(k), 1e-9))
            hip = arm.matrix_world @ ul.head
            v = hip - ankle
            h2 = v.x * v.x + v.y * v.y
            if want * want <= h2:
                raise SystemExit(f"figure.weight: the {s} ankle target is {math.sqrt(h2):.3f} m sideways from the hip, "
                                 f"more than a {W['knee']} deg leg reaches ({want:.3f} m); move the foot in")
            dz = math.sqrt(want * want - h2) - v.z
            hips.location = hips.location + loc_to_local(arm, "J_Bip_C_Hips", Vector((0, 0, dz)))
            posing.update()
    rep["hips_loc"] = [round(x, 4) for x in hips.location]
    return rep


def place_foot_ext(arm, s, pos, yaw, pitch, roll, posing):
    from mathutils import Quaternion
    if not roll:
        posing.place_foot(arm, s, pos, yaw, pitch)
        return
    b = arm.data.bones[f"ik_foot.{s}"]
    sg = 1.0 if s == "L" else -1.0          # + roll turns the sole toward her midline
    R = (Quaternion((0, 0, 1), math.radians(yaw)) @ Quaternion((1, 0, 0), math.radians(pitch)) @
         Quaternion((0, 1, 0), math.radians(roll * sg))).to_matrix()
    M = (R @ b.matrix_local.to_3x3()).to_4x4()
    M.translation = pos
    posing.set_bone_matrix(arm, f"ik_foot.{s}", M)
    arm.pose.bones[f"J_Bip_{s}_LowerLeg"].constraints["ik"].mute = False
    arm.pose.bones[f"J_Bip_{s}_Foot"].constraints["ik_rot"].mute = False


def fingers_ext(arm, s, f, posing):
    """per-finger curls, spread and a three-part thumb (see the module docstring)"""
    from mathutils import Quaternion, Vector
    simple = set(f) <= {"curl", "thumb", "spread"} and not isinstance(f.get("spread", 0), dict) and \
        not isinstance(f.get("thumb", 0), dict)
    if simple:
        posing.curl_fingers(arm, s, f.get("curl", 70), f.get("thumb", 40), f.get("spread", 0))
        return
    ax = Vector((0, -1, 0)) if s == "R" else Vector((0, 1, 0))
    zax = Vector((0, 0, 1))
    side = 1.0 if s == "L" else -1.0
    base = float(f.get("curl", 70))
    per = f.get("per", {})
    spread = f.get("spread", 0.0)
    for fi in FINGERS:
        c = per.get(fi, base)
        cs = [c * k for k in JOINT_K] if not isinstance(c, (list, tuple)) else list(c)
        sp = spread.get(fi, 0.0) if isinstance(spread, dict) else float(spread) * SPREAD_K[fi]
        for j in (1, 2, 3):
            n = f"J_Bip_{s}_{fi}{j}"
            if n not in arm.pose.bones:
                continue
            q = Quaternion(ax, math.radians(cs[j - 1]))
            if j == 1 and sp:
                q = Quaternion(zax, math.radians(sp * side)) @ q
            posing.set_world_rel(arm, n, q)
    t = f.get("thumb", 40)
    tax = Vector((1, 0, 0)) if s == "R" else Vector((-1, 0, 0))
    if isinstance(t, dict):
        fold, curl, swing = float(t.get("fold", 0)), float(t.get("curl", 0)), float(t.get("swing", 0))
    else:
        fold, curl, swing = float(t), float(t) * 0.5, 0.0
    for j, k in ((1, 0.5), (2, 0.8), (3, 0.8)):
        n = f"J_Bip_{s}_Thumb{j}"
        if n not in arm.pose.bones:
            continue
        q = Quaternion(tax, math.radians(fold * k)) @ Quaternion(ax, math.radians(curl * k))
        if j == 1 and swing:
            q = Quaternion(zax, math.radians(swing * side)) @ q
        posing.set_world_rel(arm, n, q)


def head_fwd(arm):
    from mathutils import Vector
    return (world_rot(arm, "J_Bip_C_Head") @ Vector((0, -1, 0))).normalized()


def rotate_bone_world(arm, name, q):
    """rotate a posed bone about its head by the world rotation q (children follow)"""
    from mathutils import Matrix
    pb = arm.pose.bones[name]
    Mw = arm.matrix_world
    M = Mw @ pb.matrix
    h = M.translation.copy()
    M2 = Matrix.Translation(h) @ q.to_matrix().to_4x4() @ Matrix.Translation(-h) @ M
    pb.matrix = Mw.inverted() @ M2
    import bpy
    bpy.context.view_layer.update()


def look(arm, L, P, tp, posing):
    from mathutils import Quaternion, Vector
    sys.path.insert(0, PIPE)
    from rosace.render import camera_frame
    posing.update()
    pb = arm.pose.bones
    E = arm.matrix_world @ ((pb["J_Adj_L_FaceEye"].head + pb["J_Adj_R_FaceEye"].head) / 2)
    at = L.get("at", "camera")
    if at == "camera":
        cam = P.get("camera", {})
        back, right, up, _ = camera_frame(cam.get("yaw", 60.0), cam.get("elev", 10.0))
        d = back.copy()
    else:
        d = (tp(at) - E).normalized()
        right = d.cross(Vector((0, 0, 1))).normalized()
        up = right.cross(d).normalized()
    oy, op = (L.get("offset") or (0.0, 0.0))
    if oy or op:
        # + yaw = to screen right as seen from the camera (the camera's right is -right of the
        # direction toward it); + pitch = up
        d = (Quaternion(Vector((0, 0, 1)), math.radians(oy)) @ d)
        d = (Quaternion(d.cross(Vector((0, 0, 1))).normalized(), math.radians(op)) @ d).normalized()
    f0 = head_fwd(arm)
    q = f0.rotation_difference(d)
    ang = math.degrees(q.angle)
    amt = float(L.get("amount", 1.0))
    cap = float(L.get("max", 75.0))
    if ang * amt > cap:
        amt = cap / max(ang, 1e-6)
    q = Quaternion().slerp(q, amt)
    d_eff = (q @ f0).normalized()
    share = float(L.get("neck", 0.35))
    if share:
        rotate_bone_world(arm, "J_Bip_C_Neck", Quaternion().slerp(q, share))
    f1 = head_fwd(arm)
    rotate_bone_world(arm, "J_Bip_C_Head", f1.rotation_difference(d_eff))
    if L.get("tilt"):
        rotate_bone_world(arm, "J_Bip_C_Head", Quaternion(d_eff, math.radians(-float(L["tilt"]))))
    if L.get("chin"):
        lat = (world_rot(arm, "J_Bip_C_Head") @ Vector((1, 0, 0))).normalized()
        rotate_bone_world(arm, "J_Bip_C_Head", Quaternion(lat, math.radians(float(L["chin"]))))
    return {"turn_deg": round(ang * amt, 2), "capped": amt < float(L.get("amount", 1.0)) - 1e-9}


def apply_pose(P):
    """posing.apply_pose's sequence with the "figure" stages (module docstring). Returns posing's
    meta plus a 'figure' report."""
    bpy, Matrix, Quaternion, Vector, posing = _bl()
    arm = posing.arm_obj()
    bpy.context.view_layer.objects.active = arm
    F = P.get("figure", {}) or {}
    rep = {}
    posing.reset(arm)
    posing.update()
    root = P.get("root", {})
    Rq = posing.eul_q(root.get("rot", (0, 0, 0)))
    R3 = Rq.to_matrix()
    T = Vector(root.get("loc", (0, 0, 0)))

    def tp(p):
        return T + R3 @ Vector(p)

    def td(d):
        return R3 @ Vector(d)
    if root:
        pb = arm.pose.bones["Root"]
        posing.set_world_rel(arm, "Root", Rq)
        pb.location = pb.bone.matrix_local.to_3x3().inverted() @ T
    scales = {}
    for n, r in P.get("bones", {}).items():
        if n.endswith(".loc"):
            bn = n[:-4]
            pb = arm.pose.bones[bn]
            pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector(r)
            continue
        if n.endswith(".scale"):
            scales[n[:-6]] = r
            continue
        if n in arm.pose.bones:
            posing.set_world_rel(arm, n, posing.eul_q(r))
    # ---- figure: joints, torso, hips_loc
    for n, r in F.get("joints", {}).items():
        bn = bone_name(n)
        if bn not in arm.pose.bones:
            raise SystemExit(f"figure.joints: no bone '{n}' ({bn})")
        compose_world_rel(arm, bn, posing.eul_q(r))
    if "torso" in F:
        bend = F["torso"].get("bend", (0, 0, 0))
        split = F["torso"].get("split", TORSO_SPLIT)
        for bn, w in zip(TORSO, split):
            compose_world_rel(arm, bn, posing.eul_q([a * w for a in bend]))
    if "hips_loc" in F:
        pb = arm.pose.bones["J_Bip_C_Hips"]
        pb.location = pb.location + pb.bone.matrix_local.to_3x3().inverted() @ Vector(F["hips_loc"])
    posing.update()
    feet = P.get("feet", {})
    yaw0 = root.get("rot", (0, 0, 0))[2]
    fx = F.get("feet", {})
    for s, f in feet.items():
        e = fx.get(s, {})
        place_foot_ext(arm, s, tp(f["pos"]), f.get("yaw", 0.0) + yaw0, f.get("pitch", 0.0), e.get("roll", 0.0), posing)
        if e.get("toe"):
            posing.set_world_rel(arm, f"J_Bip_{s}_ToeBase", Quaternion((1, 0, 0), math.radians(-float(e["toe"]))))
    posing.update()
    if "weight" in F:
        rep["weight"] = solve_weight(arm, F["weight"], tp, td, feet, posing)
    for name, pos in P.get("poles", {}).items():
        posing.place_pole(arm, f"pole_{name}", tp(pos))
    posing.update()
    wmeta = None
    if "weapon" in P:
        W = dict(P["weapon"])
        for k in ("butt", "at"):
            if k in W:
                W[k] = tp(W[k])
        for k in ("dir", "edge"):
            if k in W:
                W[k] = td(W[k])
        wmeta = posing.place_weapon(arm, W)
    posing.update()
    hands = dict(P.get("hands", {}))
    hands.update(F.get("hands", {}))
    for s, h in hands.items():
        if "rel" in h:
            bn = bone_name(h["rel"])
            pos = carried(arm, bn, h["pos"])
            Rr = world_rot(arm, bn)
            posing.orient_hand(arm, s, Rr @ Vector(h["fdir"]), Rr @ Vector(h["palm"]), at=pos,
                               at_is_grip=h.get("at_grip", False))
        elif "grip" in h:
            posing.grip_hand(arm, s, h["grip"], h.get("thumb", "tip"), td(h["back"]) if h.get("back") else None,
                             h.get("slide", 0.0))
        else:
            posing.orient_hand(arm, s, td(h["fdir"]), td(h["palm"]), at=tp(h["pos"]), at_is_grip=h.get("at_grip", False))
    fingers = dict(P.get("fingers", {}))
    for s, f in F.get("fingers", {}).items():
        fingers[s] = f
    for s, f in fingers.items():
        fingers_ext(arm, s, f, posing)
    posing.update()
    if "look" in F:
        rep["look"] = look(arm, F["look"], P, tp, posing)
    for bn, k in scales.items():
        pb = arm.pose.bones[bn]
        pb.scale = Vector(k) if isinstance(k, (list, tuple)) else Vector((k, k, k))
    posing.update()
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
    posing.drape(arm, D)
    return {"name": P.get("name"), "camera": P.get("camera", {}), "expression": P.get("expression", "serene"),
            "weapon": {k: list(v) for k, v in (wmeta or {}).items()}, "figure": rep}


def apply_pose_file(p):
    P, path = load_pose(p)
    return apply_pose(P), P, path


# ---------------------------------------------------------------------------- landmarks + checks
def landmarks_3d(arm):
    """world positions of the joints pose.md section 7 names (rest-frame offsets carried by bones)"""
    from mathutils import Vector
    pb = arm.pose.bones
    M = arm.matrix_world
    L = {}
    L["pit_neck"] = neck_pit(arm)
    L["neck_base"] = M @ pb["J_Bip_C_Neck"].head
    L["head_joint"] = M @ pb["J_Bip_C_Head"].head
    L["crown"] = carried(arm, "J_Bip_C_Head", Vector((0, 0, arm.get("rosace_height", 1.8956))))
    for s, nm in (("L", "left"), ("R", "right")):
        ua = arm.data.bones[f"J_Bip_{s}_UpperArm"].head_local
        L[f"shoulder_{nm}"] = M @ pb[f"J_Bip_{s}_UpperArm"].head
        L[f"acromion_{nm}"] = carried(arm, f"J_Bip_{s}_Shoulder", ua + Vector((0, 0, 0.03)))
        L[f"elbow_{nm}"] = M @ pb[f"J_Bip_{s}_LowerArm"].head
        L[f"wrist_{nm}"] = M @ pb[f"J_Bip_{s}_Hand"].head
        hj = arm.data.bones[f"J_Bip_{s}_UpperLeg"].head_local
        L[f"hip_{nm}"] = M @ pb[f"J_Bip_{s}_UpperLeg"].head
        L[f"asis_{nm}"] = carried(arm, "J_Bip_C_Hips", Vector((hj.x * 1.45, hj.y - 0.075, hj.z + 0.07)))
        L[f"knee_{nm}"] = M @ pb[f"J_Bip_{s}_LowerLeg"].head
        L[f"ankle_{nm}"] = M @ pb[f"J_Bip_{s}_Foot"].head
        fh = arm.data.bones[f"J_Bip_{s}_Foot"].head_local
        L[f"heel_{nm}"] = carried(arm, f"J_Bip_{s}_Foot", Vector((fh.x, fh.y + 0.035, 0.02)))
        L[f"toe_{nm}"] = M @ pb[f"J_Bip_{s}_ToeBase"].tail
        L[f"ball_{nm}"] = M @ pb[f"J_Bip_{s}_ToeBase"].head
        if f"J_Sec_{s}_Bust1" in pb:
            L[f"bust_apex_{nm}"] = M @ pb[f"J_Sec_{s}_Bust1"].tail
    L["com"] = com(arm)
    return L


def frame_yaw(arm, bone, back, right):
    """signed yaw (deg) between the bone's facing (rest -Y carried) and the direction to the camera,
    horizontal; 0 = square to the camera, + = her front turned toward screen right"""
    from mathutils import Vector
    f = world_rot(arm, bone) @ Vector((0, -1, 0))
    fh = Vector((f.x, f.y, 0)).normalized()
    bh = Vector((back.x, back.y, 0)).normalized()
    rh = Vector((right.x, right.y, 0)).normalized()
    return math.degrees(math.atan2(fh.dot(rh), fh.dot(bh)))


def measure(arm, P, pxs=(144, 80), anchors=None):
    """landmarks on screen at each size + the rig-measurable PS checks. anchors: {px: [ax, ay]} of
    a render (absolute pixel coords); without it the coords are relative to the world origin."""
    from mathutils import Vector
    sys.path.insert(0, PIPE)
    from rosace.render import camera_frame
    cam = P.get("camera", {})
    yaw, elev = cam.get("yaw", 60.0), cam.get("elev", 10.0)
    back, right, up, fwd = camera_frame(yaw, elev)
    H = arm.get("rosace_height", 1.8956)
    L3 = landmarks_3d(arm)
    out = {"camera": {"yaw": yaw, "elev": elev}, "height_m": H, "appeal": is_appeal(P),
           "world": {k: [round(c, 4) for c in v] for k, v in L3.items()}, "screen": {}}
    for px in pxs:
        ppm = px / H
        a = (anchors or {}).get(px, (0, 0))
        out["screen"][str(px)] = {k: [round(a[0] + v.dot(right) * ppm, 2), round(a[1] - v.dot(up) * ppm, 2)]
                                  for k, v in L3.items()}
    # --- 3D measures
    pb = arm.pose.bones

    def knee_bend(s):
        h, k, a = (pb[f"J_Bip_{s}_UpperLeg"].head, pb[f"J_Bip_{s}_LowerLeg"].head, pb[f"J_Bip_{s}_Foot"].head)
        return 180.0 - math.degrees((h - k).angle(a - k))

    def elbow_bend(s):
        h, k, a = (pb[f"J_Bip_{s}_UpperArm"].head, pb[f"J_Bip_{s}_LowerArm"].head, pb[f"J_Bip_{s}_Hand"].head)
        return 180.0 - math.degrees((h - k).angle(a - k))
    up_h = world_rot(arm, "J_Bip_C_Hips") @ Vector((0, 0, 1))
    up_c = world_rot(arm, "J_Bip_C_UpperChest") @ Vector((0, 0, 1))
    fwd_h = world_rot(arm, "J_Bip_C_Hips") @ Vector((0, -1, 0))
    lat_h = world_rot(arm, "J_Bip_C_Hips") @ Vector((1, 0, 0))
    # chest pitch against the pelvis in the pelvis's sagittal plane; + = chest back (arched)
    uc = (up_c - lat_h * up_c.dot(lat_h)).normalized()
    pitch = math.degrees(math.atan2(-uc.dot(fwd_h), uc.dot(up_h)))
    head_pitch_cam = math.degrees(math.asin(max(-1, min(1, (world_rot(arm, "J_Bip_C_Head") @ Vector((0, -1, 0))).dot(up)))))
    m3 = {"knee_bend": {s: round(knee_bend(s), 1) for s in "LR"},
          "elbow_bend": {s: round(elbow_bend(s), 1) for s in "LR"},
          "yaw": {"pelvis": round(frame_yaw(arm, "J_Bip_C_Hips", back, right), 1),
                  "chest": round(frame_yaw(arm, "J_Bip_C_UpperChest", back, right), 1),
                  "head": round(frame_yaw(arm, "J_Bip_C_Head", back, right), 1)},
          "chest_pitch_vs_pelvis": round(pitch, 1), "head_pitch_to_camera": round(head_pitch_cam, 1),
          "foot_pitch": {}, "ik_miss_mm": {}}
    for s in "LR":
        fdir = (pb[f"J_Bip_{s}_ToeBase"].head - pb[f"J_Bip_{s}_Foot"].head).normalized()
        m3["foot_pitch"][s] = round(math.degrees(math.asin(max(-1, min(1, -fdir.z)))), 1)
        for nm, tgt, eff in ((f"foot.{s}", f"ik_foot.{s}", f"J_Bip_{s}_Foot"), (f"hand.{s}", f"ik_hand.{s}", f"J_Bip_{s}_Hand")):
            c = pb[f"J_Bip_{s}_LowerLeg" if nm.startswith("foot") else f"J_Bip_{s}_LowerArm"].constraints.get("ik")
            if c is not None and not c.mute:
                m3["ik_miss_mm"][nm] = round((pb[tgt].head - pb[eff].head).length * 1000, 1)
    # weight leg: the named one, else the ankle nearer (horizontally) under the pit of the neck
    W = P.get("figure", {}).get("weight", {})
    pit = L3["pit_neck"]

    def hd(a, b):
        return math.hypot(a.x - b.x, a.y - b.y)
    wl = W.get("leg") or min("LR", key=lambda s: hd(L3[f"ankle_{'left' if s == 'L' else 'right'}"], pit))
    fl = "L" if wl == "R" else "R"
    wn, fn = ("left" if wl == "L" else "right"), ("left" if fl == "L" else "right")
    wv = L3[f"ankle_{wn}"] - L3[f"hip_{wn}"]
    m3["weight_leg"] = wl
    m3["weight_leg_off_vertical"] = round(math.degrees(wv.angle(Vector((0, 0, -1)))), 1)
    m3["pit_over_weight_ankle_mm"] = round(hd(pit, L3[f"ankle_{wn}"]) * 1000, 1)
    m3["com_over_weight_ankle_mm"] = round(hd(L3["com"], L3[f"ankle_{wn}"]) * 1000, 1)
    out["rig"] = m3
    # --- screen measures and checks, per size
    checks = {}
    for px in pxs:
        S = out["screen"][str(px)]

        def v(k):
            return Vector((S[k][0], S[k][1]))

        def tilt(a, b):
            d = v(b) - v(a)
            if d.x < 0:
                d = -d
            return math.degrees(math.atan2(-d.y, d.x))      # + = the screen-right end is higher

        sw = (v("shoulder_left") - v("shoulder_right")).length
        c = {}
        sh_t, hip_t = tilt("acromion_left", "acromion_right"), tilt("asis_left", "asis_right")
        sh_drop = abs(S["acromion_left"][1] - S["acromion_right"][1])
        hip_drop = abs(S["asis_left"][1] - S["asis_right"][1])
        opp = sh_t * hip_t < 0
        if px == 144:
            ok = 8 <= abs(sh_t) <= 14 and 8 <= abs(hip_t) <= 14 and opp
        else:
            ok = 2 <= sh_drop <= 4 and 2 <= hip_drop <= 3 and opp
        c["PS-P01"] = {"shoulder_deg": round(sh_t, 1), "hip_deg": round(hip_t, 1), "shoulder_drop_px": round(sh_drop, 1),
                       "hip_drop_px": round(hip_drop, 1), "opposite": opp, "pass": ok}
        c["PS-P03"] = {"chest_pitch_deg": m3["chest_pitch_vs_pelvis"], "pass": 5 <= m3["chest_pitch_vs_pelvis"] <= 12,
                       "note": "sagitta of the back contour: from the still (not computed here)"}
        yp, yc, yh = (abs(m3["yaw"][k]) for k in ("pelvis", "chest", "head"))
        c["PS-P04"] = {"pelvis": m3["yaw"]["pelvis"], "chest": m3["yaw"]["chest"], "head": m3["yaw"]["head"],
                       "pass": 35 <= yp <= 60 and 30 <= yc <= 50 and 10 <= yh <= 30 and yp >= yc >= yh}
        na = v("head_joint") - v("neck_base")
        ha = v("crown") - v("head_joint")
        # signed on a y-up screen (+ = the head axis turned counter-clockwise from the neck axis,
        # the same sense as a + shoulder tilt), so 'opposite' is a sign difference
        ht_s = math.degrees(math.atan2(-(na.x * ha.y - na.y * ha.x), na.dot(ha)))
        c["PS-P05"] = {"head_tilt_deg": round(ht_s, 1), "shoulder_deg": round(sh_t, 1),
                       "pass": 5 <= abs(ht_s) <= 10 and (ht_s * sh_t < 0)}
        heel_gap = abs(S["heel_left"][0] - S["heel_right"][0])
        knee_gap = abs(S["knee_left"][0] - S["knee_right"][0])
        ratio = knee_gap / heel_gap if heel_gap > 1e-6 else 99.0
        lo, hi = (35, 43) if px == 144 else (20, 24)
        c["PS-P06"] = {"heel_gap_px": round(heel_gap, 1), "heel_gap_sw": round(heel_gap / sw, 2) if sw else None,
                       "knee_over_heel": round(ratio, 2), "pass": lo <= heel_gap <= hi and ratio <= 0.6}
        dx = S[f"ankle_{wn}"][0] - S["pit_neck"][0]
        tol = 2 if px == 144 else 1
        c["PS-P07"] = {"weight_leg": wl, "off_vertical_deg": m3["weight_leg_off_vertical"],
                       "knee_bend_deg": m3["knee_bend"][wl], "ankle_minus_pit_px": round(dx, 1),
                       "pass": m3["weight_leg_off_vertical"] <= 5 and m3["knee_bend"][wl] <= 5 and abs(dx) <= tol}
        lift = S[f"heel_{wn}"][1] - S[f"heel_{fn}"][1]           # + = the free heel is higher
        fa = v(f"toe_{fn}") - v(f"heel_{fn}")
        wa = v(f"toe_{wn}") - v(f"heel_{wn}")
        turn = math.degrees(fa.angle(wa)) if fa.length > 0.5 and wa.length > 0.5 else 0.0
        toe_dy = abs(S[f"toe_{fn}"][1] - S[f"toe_{wn}"][1])
        llo, lhi, tmin = (3, 8, 2) if px == 144 else (2, 4, 1)
        fb = m3["knee_bend"][fl]
        c["PS-P08"] = {"free_leg": fl, "knee_bend_deg": fb, "heel_lift_px": round(lift, 1),
                       "foot_pitch_deg": m3["foot_pitch"][fl], "turn_out_deg": round(turn, 1),
                       "toe_row_offset_px": round(toe_dy, 1),
                       "pass": 10 <= fb <= 30 and llo <= lift <= lhi and 15 <= turn <= 40 and toe_dy >= tmin}
        tl, tr = v("knee_left") - v("hip_left"), v("knee_right") - v("hip_right")
        splay = math.degrees(tl.angle(tr)) if tl.length and tr.length else 0.0
        c["PS-P09"] = {"thigh_splay_deg": round(splay, 1), "pass": splay <= 20}
        c["PS-N01"] = {"fail": (yp < 20 and heel_gap > 1.2 * sw and ratio > 0.8) or splay > 25}
        c["PS-N01"]["pass"] = not c["PS-N01"]["fail"]
        sole_eq = abs(S["heel_left"][1] - S["heel_right"][1]) < 1.0
        n02 = turn < 10 and sole_eq and m3["knee_bend"]["L"] < 5 and m3["knee_bend"]["R"] < 5
        c["PS-N02"] = {"pass": not n02}
        c["PS-N03"] = {"feet_angle_deg": round(turn, 1), "pass": turn >= 10}
        c["PS-N04"] = {"pass": not (m3["knee_bend"]["L"] < 5 and m3["knee_bend"]["R"] < 5)}
        c["PS-N13"] = {"chest_yaw": m3["yaw"]["chest"], "pass": yc >= 20}
        c["PS-N14"] = {"head_pitch_up_deg": m3["head_pitch_to_camera"], "pass": m3["head_pitch_to_camera"] <= 5}
        c["PS-N05"] = {"chest_pitch_deg": m3["chest_pitch_vs_pelvis"], "pass": m3["chest_pitch_vs_pelvis"] >= 0,
                       "note": "neck rows: from the still (not computed here)"}
        checks[str(px)] = c
    out["checks"] = checks
    out["checks_doc"] = ("rig-measurable PS rules (docs/character/art-rules/pose.md 4, checklist.json). Fill-based "
                         "rules (PS-P02, P10, P16, P17, N07, N10) need the still and the id map: SKIP here.")
    fails = sorted({k for c in checks.values() for k, r in c.items() if not r.get("pass", True)})
    out["summary"] = {"appeal": out["appeal"], "fails": fails, "weight_leg": wl,
                      "ik_miss_mm": m3["ik_miss_mm"]}
    return out


# ---------------------------------------------------------------------------- render
def chest_yaw(arm):
    from mathutils import Vector
    f = world_rot(arm, "J_Bip_C_UpperChest") @ Vector((0, -1, 0))
    return math.degrees(math.atan2(-f.x, -f.y))


def parse_views(spec, P, arm):
    rel = {"@front": 0.0, "@q34": 35.0, "@left": -90.0, "@right": 90.0, "@back": 180.0}
    cam = P.get("camera", {})
    out = []
    cy = chest_yaw(arm)
    for tok in spec.split(","):
        parts = tok.split(":")
        nm = parts[0]
        if nm == "cam" and len(parts) == 1:
            out.append(("cam", float(cam.get("yaw", 60.0)), float(cam.get("elev", 10.0))))
            continue
        y = parts[1]
        yaw = cy + rel[y] if y.startswith("@") else float(y)
        elev = float(parts[2]) if len(parts) > 2 else float(cam.get("elev", 8.0))
        out.append((nm, yaw, elev))
    return out


def open_blend(blend):
    bpy, *_ = _bl()
    blend = os.path.abspath(blend)
    if not os.path.exists(blend):
        raise SystemExit(f"{blend} does not exist: build it with figure_shape.py -- build --out {blend}")
    bpy.ops.wm.open_mainfile(filepath=blend)
    return blend


def render_pose(blend, pose, out, views, pxs, ss=4, hi=0, passes=("beauty", "albedo", "id", "normal", "depth"),
                use_posing=False):
    bpy, Matrix, Quaternion, Vector, posing = _bl()
    from rosace import materials, render
    open_blend(blend)
    sc = bpy.context.scene
    materials.rebind()
    render.setup_engine(sc)
    P, path = load_pose(pose)
    meta_p = posing.apply_pose(P) if use_posing else apply_pose(P)
    bpy.context.view_layer.update()
    arm = posing.arm_obj()
    sha = hashlib.sha1(open(path, "rb").read()).hexdigest()[:12]
    vs = parse_views(views, P, arm)
    rep = {"blend": os.path.abspath(blend), "pose": path, "pose_sha1": sha, "applier": "posing" if use_posing else "figure_pose",
           "chest_yaw": round(chest_yaw(arm), 2), "views": {}, "figure": meta_p.get("figure")}
    for vname, yaw, elev in vs:
        Pv = dict(P)
        Pv["camera"] = {"yaw": yaw, "elev": elev}
        for px, s2, ps in [(p, ss, list(passes)) for p in pxs] + ([(hi, 1, ["beauty"])] if hi else []):
            shot = render.setup_shot(sc, px, yaw=yaw, elev=elev, ss=s2)
            d = os.path.join(out, vname, f"px{px}")
            render.render_passes(sc, d, ps)
            anchors = posing.anchors(sc, px)
            render.write_meta(os.path.join(d, "meta.json"), shot,
                              {"pose": meta_p.get("name"), "expression": meta_p.get("expression"),
                               "pose_sha1": sha, "passes": ps, "anchors": anchors, "frames": None, "thong": None,
                               "applier": rep["applier"]})
            lm = measure(arm, Pv, pxs=(px,), anchors={px: shot["anchor"]})
            lm["view"], lm["pose"], lm["pose_sha1"] = vname, meta_p.get("name"), sha
            with open(os.path.join(d, "landmarks.json"), "w", encoding="utf-8") as f:
                json.dump(lm, f, indent=1)
            rep["views"].setdefault(vname, {})[str(px)] = {"canvas": shot["canvas"], "yaw": round(yaw, 2), "elev": elev,
                                                           "fails": lm["summary"]["fails"]}
            print("RENDERED", d, shot["canvas"], flush=True)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "_render.json"), "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=1)
    return rep


def roundtrip(blend, pose):
    """apply the pose with posing.py, snapshot every pose bone's matrix, apply it with this applier,
    compare. Returns the largest differences (matrix entries, metres for translations)."""
    bpy, Matrix, Quaternion, Vector, posing = _bl()
    open_blend(blend)
    P, path = load_pose(pose)
    arm = posing.arm_obj()
    posing.apply_pose(P)
    posing.update()
    a = {pb.name: pb.matrix.copy() for pb in arm.pose.bones}
    apply_pose(P)
    posing.update()
    b = {pb.name: pb.matrix.copy() for pb in arm.pose.bones}
    worst, worst_bone = 0.0, None
    for n in a:
        d = max(abs(a[n][i][j] - b[n][i][j]) for i in range(4) for j in range(4))
        if d > worst:
            worst, worst_bone = d, n
    # evaluated mesh check on the body
    dg = bpy.context.evaluated_depsgraph_get()
    body = bpy.data.objects["body"]
    return {"pose": path, "bones": len(a), "max_matrix_diff": worst, "worst_bone": worst_bone,
            "identical": worst < 1e-5, "body_verts": len(body.evaluated_get(dg).data.vertices)}


def blender_main(argv):
    bpy, *_ = _bl()
    from rosace import common
    cmd = argv[0]
    blend = common.arg(argv, "--blend", BASE_BLEND)
    pose = common.arg(argv, "--pose", None)
    if cmd == "check":
        open_blend(blend)
        P, path = load_pose(pose)
        meta = apply_pose(P)
        arm = bpy.data.objects["rosace_rig"]
        m = measure(arm, P)
        m["pose"], m["pose_file"], m["figure"] = P.get("name"), path, meta.get("figure")
        if common.arg(argv, "--clip", False, bool):
            # PS-P21: garment vertices behind the posed skin near the bust (figure_shape.clip_check)
            sys.path.insert(0, HERE)
            import figure_shape
            m["clip"] = figure_shape.clip_check(bpy.context.scene)
        out = common.arg(argv, "--out", None)
        if out:
            os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
            with open(out, "w", encoding="utf-8") as f:
                json.dump(m, f, indent=1)
        print("FIGURE_POSE_CHECK", json.dumps({"pose": P.get("name"), "summary": m["summary"], "rig": m["rig"],
                                               "checks_144": m["checks"]["144"]}))
    elif cmd == "render":
        out = os.path.abspath(common.arg(argv, "--out"))
        pxs = [int(x) for x in common.arg(argv, "--px", "144,80").split(",")]
        passes = common.arg(argv, "--passes", "beauty,albedo,id,normal,depth").split(",")
        rep = render_pose(blend, pose, out, common.arg(argv, "--views", "cam"), pxs, common.arg(argv, "--ss", 4, int),
                          common.arg(argv, "--hi", 0, int), passes, common.arg(argv, "--posing", False, bool))
        print("FIGURE_POSE_RENDER", json.dumps(rep["views"]))
    elif cmd == "roundtrip":
        r = roundtrip(blend, pose or "idle_hero")
        out = common.arg(argv, "--out", None)
        if out:
            with open(out, "w", encoding="utf-8") as f:
                json.dump(r, f, indent=1)
        print("FIGURE_POSE_ROUNDTRIP", json.dumps(r))
        if not r["identical"]:
            raise SystemExit(1)
    elif cmd == "apply":
        save = os.path.abspath(common.arg(argv, "--save"))
        assert os.path.basename(save) not in FORBIDDEN and os.path.basename(save).startswith("figure-pose"), \
            "the figure-pose lane saves only lanes/figure-pose*.blend"
        open_blend(blend)
        meta = apply_pose(load_pose(pose)[0])
        bpy.ops.wm.save_as_mainfile(filepath=save, compress=True)
        print("FIGURE_POSE_APPLIED", save, json.dumps(meta.get("figure")))
    else:
        raise SystemExit(f"unknown command {cmd}")


# ============================================================================ plain python
def post_all(root):
    import subprocess
    for dp, dn, fn in os.walk(root):
        if "meta.json" in fn and "id.png" in fn:
            r = subprocess.run([sys.executable, os.path.join(PIPE, "rosace_post.py"), "--raw", dp, "--tag", "still"],
                               capture_output=True, text=True, encoding="utf-8", errors="replace")
            if r.returncode:
                print(r.stdout[-2000:], r.stderr[-2000:])
                raise SystemExit(f"post failed in {dp}")
            print("post", dp)


def stills(root):
    """{(view, px): dir} for every post-processed still under root"""
    out = {}
    for v in sorted(os.listdir(root)):
        vd = os.path.join(root, v)
        if not os.path.isdir(vd):
            continue
        for p in sorted(os.listdir(vd)):
            d = os.path.join(vd, p)
            if p.startswith("px") and os.path.exists(os.path.join(d, "still.png")):
                out[(v, int(p[2:]))] = d
    return out


def sheet(root, out, label=None):
    """one sheet per view and size: the still beside the finish-bar refs at their native grid, at
    x3 and x1 (WF-P11), plus its silhouette. Refs are third-party: sheets go to review/ only."""
    from PIL import Image
    sys.path.insert(0, HERE)
    import figure_shape as fs
    os.makedirs(out, exist_ok=True)
    refs = [(n, Image.open(os.path.join(fs.REF_DIR, f)).convert("RGB").crop(b)) for n, f, b in fs.REFS]
    label = label or os.path.basename(os.path.normpath(root))
    made = []
    for (view, px), d in stills(root).items():
        meta = json.load(open(os.path.join(d, "meta.json"), encoding="utf-8"))
        im = Image.open(os.path.join(d, "still.png")).convert("RGBA")
        items = fs._on_ground([(im, tuple(meta["anchor"]))])
        for z in (3, 1):
            pan = [(label, items[0]), ("silhouette", fs._silhouette(items[0]))] + (refs if view != "back" else refs[:2])
            S = fs._sheet(f"{label} - {view}, {px} px", f"native grid, x{z}; refs at their own native grid", pan, z)
            fn = f"{label}_{view}_{px}_x{z}.png"
            S.save(os.path.join(out, fn))
            made.append(fn)
    print("sheets:", made)
    return made


def diff(a, b):
    from PIL import Image, ImageChops
    res = {}
    sa, sb = stills(a), stills(b)
    for k in sorted(set(sa) | set(sb)):
        if k not in sa or k not in sb:
            res[f"{k[0]}/{k[1]}"] = "missing"
            continue
        ia = Image.open(os.path.join(sa[k], "still.png")).convert("RGBA")
        ib = Image.open(os.path.join(sb[k], "still.png")).convert("RGBA")
        if ia.size != ib.size:
            res[f"{k[0]}/{k[1]}"] = {"size": [ia.size, ib.size]}
            continue
        dpx = sum(1 for p in ImageChops.difference(ia, ib).get_flattened_data() if any(p))             if hasattr(Image.Image, "get_flattened_data") else             sum(1 for p in ImageChops.difference(ia, ib).getdata() if any(p))
        res[f"{k[0]}/{k[1]}"] = {"size": list(ia.size), "pixels_differing": dpx}
    print(json.dumps(res, indent=1))
    return res


def main_plain(argv):
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["post", "sheet", "diff"])
    ap.add_argument("--root")
    ap.add_argument("--out", default=os.path.join(REPO, "review", "rosace", "art", "figure-pose", "poses"))
    ap.add_argument("--label", default=None)
    ap.add_argument("--a")
    ap.add_argument("--b")
    a = ap.parse_args(argv)
    if a.cmd == "post":
        post_all(a.root)
    elif a.cmd == "sheet":
        sheet(a.root, a.out, a.label)
    else:
        diff(a.a, a.b)


if __name__ == "__main__":
    try:
        import bpy  # noqa: F401
        IN_BLENDER = True
    except ImportError:
        IN_BLENDER = False
    if IN_BLENDER:
        blender_main(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    else:
        main_plain(sys.argv[1:])
