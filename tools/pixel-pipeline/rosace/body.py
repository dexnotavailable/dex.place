"""Base body: import the CC0 VRoid sample, strip it to the bare body, restyle proportions.

The restyle is one deterministic mapping p -> f(p) applied to every mesh vertex and every
bone head/tail, so skin weights stay valid and the rest pose stays consistent (no pose ->
rest baking, no sculpting by hand). Masks come from the VRM's own skin weights.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

from .common import BASE_VRM, gauss, lerp, smoothstep

V = Vector

# ---------------------------------------------------------------------------- knobs
HEAD_SCALE = 1.265         # round 2 critics: 27 px head at 144 (5.3 heads); r3 1.05 -> 25 px; r3-fix 1.10 keeps the head as the legs grow
# r4-fix (face / overall / craft critics: the head is 20-22 px wide at 144 against the refs' 24-30;
# 'enlarge 15-20%', 'about 26 px'): 1.11 -> 1.265 (+14%)
# round 3 body critic: crotch at 48% of the height (gacha heroines sit at 50-55%), neck ~3 px:
# legs +6-8 px at 144 and neck +2 px, paid for by a shorter ribcage so the head keeps its size
LEG_STRETCH = 1.30         # shin + thigh length (sole to crotch); r3 1.09 (crotch 49% of height) -> 52%
PELVIS_SCALE = 0.92        # crotch to waist; r3 0.97
RIB_SCALE = 0.97           # waist to neck base; r3 1.12 (waist to head joint)
NECK_STRETCH = 1.30        # neck base to head joint (r3-fix: the neck read as 3 px of skin above the collar)
SHOULDER_WIDEN = 0.028     # arms and shoulder girdle move out (m, each side): hourglass from the front
# r4-fix body critic ('narrow, sloped shoulders; the upper half looks childlike next to adult hips;
# widen 2 px each side'): 0.014 -> 0.028 (+1 px each side at 144, plus the lats below)
NECK_SLIM = 0.86
# r4-fix: the base's arms (shoulder to wrist 0.25 H) came out short once the legs were
# stretched and the head scaled (anime: ~0.3 H); akimbo, reach and two-hand grips could not open
# up. Upper arm + forearm stretch along the T-pose arm axis; the hand is carried, not stretched.
ARM_STRETCH = 1.18
BUST_SCALE = 1.45
BUST_LIFT = 0.008
HEEL_DEG = 24.0            # plantar flexion for the heeled boots
SOLE = 0.018               # boot sole under the forefoot
Z_FOOT, Z_CROTCH, Z_WAIST, Z_HEADJ = 0.14, 0.80, 1.075, 1.422   # knots of the vertical remap (base coords)

# torso cross-section scale profile by base z: (centre z, sigma, dx, dy)
PROFILE = [
    (1.075, 0.050, -0.19, -0.08),   # waist (r2: 1-2 px narrower each side at 144)
    (1.180, 0.045, +0.00, -0.01),   # lower ribcage
    (1.290, 0.050, +0.10, +0.00),   # upper ribcage / lats: shoulders read wider than the waist (r4-fix 0.07)
    (0.905, 0.060, +0.035, +0.03),  # hip bone
    (0.850, 0.060, +0.062, +0.045), # hips / seat: the hip shelf breaks the silhouette (r2: straight hip-to-thigh line); r4-fix 0.075/0.05 (body critic: pelvis 1.6x the shoulders in q_stamp, seat ~8% smaller)
    (0.720, 0.070, +0.00, +0.02),   # upper thigh
]
GLUTE = dict(z=0.815, sz=0.050, push=0.025, drop=0.012)   # r4-fix push 0.028
THIGH = dict(z=0.66, sz=0.09, s=0.035)           # r4-fix 0.05 (body critic: thighs too heavy for the shins)
CALF = dict(z=0.37, sz=0.055, s=0.13)          # r2: calf swell on the stocking contour
KNEE = dict(z=0.475, sz=0.022, s=-0.08)       # r2: a knee notch (the stockings read as straight tubes); r4-fix -0.05: narrower knee
ANKLE = dict(z=0.215, sz=0.05, s=-0.16)       # r2: ankle taper above the boot; r4-fix -0.12
INNER_THIGH = dict(z=0.62, sz=0.08, s=0.10)   # inner-thigh curve: taper toward the knee, gap at the top

ARM_KEYS = ("Shoulder", "UpperArm", "LowerArm", "Hand", "Thumb", "Index", "Middle", "Ring", "Little")


def reset_scene():
    bpy.ops.wm.read_homefile(use_empty=True)
    sc = bpy.context.scene
    return sc


def import_base():
    bpy.ops.import_scene.vrm(filepath=BASE_VRM)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    arm.name = "rosace_rig"
    arm.data.name = "rosace_rig"
    # drop collider empties and the spring bone setup of the sample's dress and hair
    for o in list(bpy.data.objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o, do_unlink=True)
    ext = arm.data.vrm_addon_extension
    try:
        ext.vrm0.secondary_animation.bone_groups.clear()
        ext.vrm0.secondary_animation.collider_groups.clear()
    except Exception as e:  # noqa: BLE001 - optional cleanup
        print("spring cleanup skipped:", e)
    hair = bpy.data.objects.get("Hair001")
    if hair:
        bpy.data.objects.remove(hair, do_unlink=True)
    body, face = bpy.data.objects["Body"], bpy.data.objects["Face"]
    for ob in (body, face):
        # MToon outline node modifiers: not used (outlines come from the pixel post-process)
        for m in list(ob.modifiers):
            if m.type != "ARMATURE":
                ob.modifiers.remove(m)
        if ob.data.shape_keys:
            ob.shape_key_clear()
        # the importer leaves a 180 degree Z rotation on the meshes; bake it into the data
        ob.data.transform(ob.matrix_parent_inverse @ ob.matrix_basis)
        ob.matrix_basis = Matrix.Identity(4)
        ob.matrix_parent_inverse = Matrix.Identity(4)
    # body: keep skin only
    bm = bmesh.new()
    bm.from_mesh(body.data)
    mats = body.data.materials
    kill = [f for f in bm.faces if "SKIN" not in mats[f.material_index].name]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    for f in bm.faces:
        f.material_index = 0
    bm.to_mesh(body.data)
    bm.free()
    # face: keep the skin and the eye-white/mouth fill (they become skin); drop lashes, lines,
    # brows, iris and highlights: the face is stamped as pixels, never rendered from 3D
    bm = bmesh.new()
    bm.from_mesh(face.data)
    mats = face.data.materials
    drop = ("Eyelash", "Eyeline", "Brow", "EyeIris", "EyeHighlight", "EyeExtra", "EyeWhite", "FaceMouth")
    kill = [f for f in bm.faces if any(k in mats[f.material_index].name for k in drop)]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    # close the eye and mouth openings flush with the skin (small front boundary loops)
    _fill_front_holes(bm)
    for f in bm.faces:
        f.material_index = 0
    bm.to_mesh(face.data)
    bm.free()
    for ob in (body, face):
        ob.data.materials.clear()
    # unused bones of the sample's dress and hair
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    for b in list(eb):
        if b.name.startswith("J_Sec_") and "Bust" not in b.name:
            eb.remove(b)
    bpy.ops.object.mode_set(mode="OBJECT")
    for ob in (body, face):
        for g in list(ob.vertex_groups):
            if g.name.startswith("J_Sec_") and "Bust" not in g.name:
                ob.vertex_groups.remove(g)
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)
    for im in list(bpy.data.images):
        if im.users == 0:
            bpy.data.images.remove(im)
    body.name, face.name = "body", "head_skin"
    body.data.name, face.data.name = "body", "head_skin"
    return arm, body, face


def _boundary_loops(bm):
    """boundary edge loops, walked in index order so the fill is identical on every build"""
    bm.edges.index_update()
    order = sorted((e for e in bm.edges if e.is_boundary), key=lambda e: e.index)
    edges = set(order)
    loops = []
    for e0 in order:
        if e0 not in edges:
            continue
        edges.discard(e0)
        loop, stack = {e0}, [e0]
        while stack:
            e = stack.pop()
            for v in e.verts:
                for e2 in v.link_edges:
                    if e2 in edges:
                        edges.discard(e2)
                        loop.add(e2)
                        stack.append(e2)
        loops.append(sorted(loop, key=lambda e: e.index))
    return loops


def _fill_front_holes(bm):
    for loop in _boundary_loops(bm):
        vs = {v for e in loop for v in e.verts}
        c = sum((v.co for v in vs), V()) / len(vs)
        span = max((v.co - c).length for v in vs)
        # base (unrotated-back) coords: face front is +Y before the transform? use the span only
        if span < 0.05 and len(loop) >= 6:
            res = bmesh.ops.holes_fill(bm, edges=loop, sides=0)
            faces = res.get("faces", [])
            if faces:
                bmesh.ops.triangulate(bm, faces=faces)
                # relax the fill so it bulges with the surrounding skin
                inner = [v for f in faces for v in f.verts if v not in vs]
                for _ in range(4):
                    for v in inner:
                        nb = [e.other_vert(v).co for e in v.link_edges]
                        v.co = v.co.lerp(sum(nb, V()) / len(nb), 0.5)


# ---------------------------------------------------------------------------- mapping
def _descendants(arm, root):
    out, stack = set(), [arm.data.bones[root]]
    while stack:
        b = stack.pop()
        out.add(b.name)
        stack += list(b.children)
    return out


class Restyle:
    def __init__(self, arm):
        bones = arm.data.bones
        self.head_set = _descendants(arm, "J_Bip_C_Head")
        self.pivot = bones["J_Bip_C_Head"].head_local.copy()
        self.neck_c = bones["J_Bip_C_Neck"].head_local.copy()
        self.bust_c = {s: bones[f"J_Sec_{s}_Bust1"].head_local.copy() for s in "LR"}
        self.leg = {s: (bones[f"J_Bip_{s}_UpperLeg"].head_local.copy(),
                        bones[f"J_Bip_{s}_LowerLeg"].head_local.copy(),
                        bones[f"J_Bip_{s}_Foot"].head_local.copy()) for s in "LR"}
        # spine centre line (y) by z
        self.spine = sorted([(bones[n].head_local.z, bones[n].head_local.y) for n in
                             ("J_Bip_C_Hips", "J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest",
                              "J_Bip_C_Neck")])
        # knots of the vertical remap
        z1 = Z_FOOT + (Z_CROTCH - Z_FOOT) * LEG_STRETCH
        zw = z1 + (Z_WAIST - Z_CROTCH) * PELVIS_SCALE
        zn0 = self.neck_c.z
        zn = zw + (zn0 - Z_WAIST) * RIB_SCALE
        z2 = zn + (Z_HEADJ - zn0) * NECK_STRETCH
        self.knots = [(0.0, 0.0), (Z_FOOT, Z_FOOT), (Z_CROTCH, z1), (Z_WAIST, zw), (zn0, zn), (Z_HEADJ, z2)]
        self.heel = None
        self.arm_x = {s: (abs(bones[f"J_Bip_{s}_UpperArm"].head_local.x), abs(bones[f"J_Bip_{s}_Hand"].head_local.x)) for s in "LR"}

    def spine_y(self, z):
        s = self.spine
        if z <= s[0][0]:
            return s[0][1]
        for (za, ya), (zb, yb) in zip(s, s[1:]):
            if za <= z <= zb:
                return lerp(ya, yb, (z - za) / (zb - za))
        return s[-1][1]

    def remap_z(self, z):
        k = self.knots
        if z <= k[1][0]:
            return z
        for (a0, b0), (a1, b1) in zip(k, k[1:]):
            if z <= a1:
                return b0 + (z - a0) * (b1 - b0) / (a1 - a0)
        return k[-1][1] + (z - k[-1][0])

    @staticmethod
    def masks_from_weights(ws, head_set):
        m = {"arm": 0.0, "shoulder": 0.0, "head": 0.0, "neck": 0.0, "bustL": 0.0, "bustR": 0.0,
             "legL": 0.0, "legR": 0.0, "footL": 0.0, "footR": 0.0, "toeL": 0.0, "toeR": 0.0}
        for n, w in ws.items():
            if any(k in n for k in ARM_KEYS):
                m["arm"] += w
                if "Shoulder" in n:
                    m["shoulder"] += w
            if n in head_set:
                m["head"] += w
            if n == "J_Bip_C_Neck":
                m["neck"] += w
            if "Bust" in n:
                m["bust" + ("L" if "_L_" in n else "R")] += w
            for s in "LR":
                if n in (f"J_Bip_{s}_UpperLeg", f"J_Bip_{s}_LowerLeg"):
                    m["leg" + s] += w
                if n in (f"J_Bip_{s}_Foot", f"J_Bip_{s}_ToeBase", f"J_Bip_{s}_ToeBase_end"):
                    m["foot" + s] += w
                if n.startswith(f"J_Bip_{s}_ToeBase"):
                    m["toe" + s] += w
        tot = sum(ws.values()) or 1.0
        for k in m:
            m[k] = min(1.0, m[k] / tot)
        return m

    def shape(self, p, m):
        """base-space restyle (everything but the vertical remap and heels)"""
        p = p.copy()
        body = 1.0 - m["arm"]
        # neck: slimmer
        if m["neck"] > 0:
            c = V((0.0, self.neck_c.y, p.z))
            k = lerp(1.0, NECK_SLIM, m["neck"])
            p = c + (p - c) * k
        # bust
        for s in "LR":
            w = m["bust" + s]
            if w > 0:
                c = self.bust_c[s]
                q = c + (p - c) * BUST_SCALE + V((0, 0, BUST_LIFT))
                p = p.lerp(q, w)
        # torso profile (x/y about the spine line)
        if body > 0 and m["head"] < 0.5:
            dx = sum(g[2] * gauss(p.z, g[0], g[1]) for g in PROFILE)
            dy = sum(g[3] * gauss(p.z, g[0], g[1]) for g in PROFILE)
            yc = self.spine_y(p.z)
            p.x = lerp(p.x, p.x * (1 + dx), body)
            p.y = lerp(p.y, yc + (p.y - yc) * (1 + dy), body)
            # glutes: rounder and higher at the back
            back = smoothstep(0.0, 0.06, p.y - yc)
            g = gauss(p.z, GLUTE["z"], GLUTE["sz"]) * back * body
            side = gauss(abs(p.x), 0.07, 0.05)
            p.y += GLUTE["push"] * g * side
            p.z -= GLUTE["drop"] * gauss(p.z, GLUTE["z"] - 0.05, 0.03) * back * side * body
        # thighs and calves: thicker about each leg axis
        for s in "LR":
            w = m["leg" + s]
            if w <= 0:
                continue
            hip, knee, ankle = self.leg[s]
            for (a, b, spec) in ((hip, knee, THIGH), (knee, ankle, CALF), (knee, ankle, KNEE), (knee, ankle, ANKLE)):
                ab = b - a
                t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
                c = a + ab * t
                r = p - c
                r.z = 0.0
                k = spec["s"] * gauss(p.z, spec["z"], spec["sz"]) * w
                if spec is THIGH:
                    # inner side of the thigh slimmer toward the knee: the legs taper and the
                    # thigh gap reads (round 1: straight cylinders)
                    inner = max(0.0, -r.x * (1 if s == "L" else -1)) / max(r.length, 1e-6)
                    k -= INNER_THIGH["s"] * inner * gauss(p.z, INNER_THIGH["z"], INNER_THIGH["sz"]) * w
                p += r * k
        # arm length (T-pose: the arm runs along x); weighted by the arm mask so the deltoid blends
        if m["arm"] > 0:
            x0, xw = self.arm_x["L" if p.x > 0 else "R"]
            ax = abs(p.x)
            if ax > x0:
                seg = min(ax - x0, xw - x0)
                ax2 = x0 + seg * ARM_STRETCH + max(0.0, ax - xw)
                p.x = lerp(p.x, ax2 * (1 if p.x > 0 else -1), m["arm"])
        # shoulders: the arm (and the deltoid that blends into it) moves out
        if m["arm"] > 0 or m.get("shoulder", 0) > 0:
            k = max(m["arm"], m.get("shoulder", 0))
            p.x += SHOULDER_WIDEN * k * (1 if p.x > 0 else -1)
        # head
        if m["head"] > 0:
            q = self.pivot + (p - self.pivot) * HEAD_SCALE
            p = p.lerp(q, m["head"])
        return p

    def vertical(self, p):
        return V((p.x, p.y, self.remap_z(p.z)))

    # heels: rotate each foot about its ankle (toes down), keep the toes flat, lift all
    def setup_heels(self, arm_bones_mapped):
        th = math.radians(HEEL_DEG)
        self.heel = {"th": th, "A": {}, "B": {}}
        for s in "LR":
            A = arm_bones_mapped[f"J_Bip_{s}_Foot"][0]
            B = arm_bones_mapped[f"J_Bip_{s}_ToeBase"][0]
            self.heel["A"][s] = A
            self.heel["B"][s] = B

    def heel_map(self, p, m):
        if not self.heel:
            return p
        th = self.heel["th"]
        s = "L" if p.x > 0 else "R"
        wf = m["foot" + s]
        wt = m["toe" + s]
        if wf <= 0:
            return p
        A, B = self.heel["A"][s], self.heel["B"][s]
        R1 = Matrix.Rotation(th * wf, 3, "X")
        q = A + R1 @ (p - A)
        if wt > 0:
            B1 = A + Matrix.Rotation(th, 3, "X") @ (B - A)
            R2 = Matrix.Rotation(-th * wt, 3, "X")
            q = B1 + R2 @ (q - B1)
        return q


def restyle(arm, meshes):
    R = Restyle(arm)
    # bones: masks from membership
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    mapped = {}
    for b in eb:
        ws = {b.name: 1.0}
        m = R.masks_from_weights(ws, R.head_set)
        for s in "LR":   # joints of the leg sit on the axis; they only need the foot flags
            if b.name in (f"J_Bip_{s}_Foot",):
                m["foot" + s] = 0.0     # the ankle itself is the heel pivot
            if b.name.startswith(f"J_Bip_{s}_ToeBase"):
                m["foot" + s] = 1.0
        mapped[b.name] = [R.vertical(R.shape(b.head, m)), R.vertical(R.shape(b.tail, m)), m, b.roll]
    R.setup_heels(mapped)
    # foot bone tail = ball (rotates with the foot)
    for s in "LR":
        mapped[f"J_Bip_{s}_Foot"][2] = dict(mapped[f"J_Bip_{s}_Foot"][2], **{"foot" + s: 1.0})
    for name, (h, t, m, roll) in mapped.items():
        mh = dict(m)
        if name.startswith("J_Bip_") and name.endswith("_Foot"):
            mh["foot" + name[6]] = 0.0
        h2 = R.heel_map(h, mh)
        t2 = R.heel_map(t, m)
        mapped[name] = [h2, t2, m, roll]
    # meshes
    new_co = {}
    for ob in meshes:
        names = {g.index: g.name for g in ob.vertex_groups}
        cos = []
        for v in ob.data.vertices:
            ws = {names[g.group]: g.weight for g in v.groups if g.group in names}
            m = R.masks_from_weights(ws, R.head_set)
            p = R.heel_map(R.vertical(R.shape(v.co, m)), m)
            cos.append(p)
        new_co[ob.name] = cos
    lift = -min(p.z for cos in new_co.values() for p in cos) + SOLE
    for name, (h, t, m, roll) in mapped.items():
        b = eb[name]
        b.head = h + V((0, 0, lift))
        b.tail = t + V((0, 0, lift))
    # Root bone stays on the floor
    eb["Root"].head = V((0, 0, 0))
    bpy.ops.object.mode_set(mode="OBJECT")
    for ob in meshes:
        for v, p in zip(ob.data.vertices, new_co[ob.name]):
            v.co = p + V((0, 0, lift))
        ob.data.update()
    return {"lift": lift, "knots": R.knots}


# ---------------------------------------------------------------------------- face normals
def flatten_face_normals(face, arm, strength=0.85):
    """Anime face normals: the front of the face takes the normals of a smooth ellipsoid
    around the skull, so toon bands fall as clean shapes instead of smearing over the
    nose, lips and eye sockets. The jaw keeps a clean edge (its sides are unchanged)."""
    head = arm.data.bones["J_Bip_C_Head"]
    me = face.data
    zs = [v.co.z for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zc = (max(zs) + min(zs)) * 0.5 + 0.01
    c = V((0.0, head.head_local.y + 0.01, zc))
    rx, ry, rz = 0.10, 0.11, 0.14
    normals = []
    ymin = min(ys)
    for v in me.vertices:
        p = v.co
        d = p - c
        n_ell = V((d.x / rx ** 2, d.y / ry ** 2, d.z / rz ** 2)).normalized()
        # front of the face only (the -Y side), fading out toward the ears
        front = smoothstep(0.02, -0.05, p.y - c.y)
        k = strength * front
        # bias toward the face's forward axis: anime faces are lit as one plane, the
        # shadow only turns in at the sides and under the jaw
        n_face = n_ell.lerp(V((0.0, -1.0, 0.1)), 0.55).normalized()
        n = v.normal.lerp(n_face, k).normalized()
        normals.append(n)
    me.normals_split_custom_set_from_vertices(normals)
