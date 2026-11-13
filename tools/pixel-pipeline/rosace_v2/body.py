"""SiroinoSotai body: append, bake the chosen body-shape keys, restore quads, rename to J_Bip_*.

Runs inside Blender. Units here are the source's own (it is a ~1.14 m headless avatar); the
uniform scale to Rosace's height happens in build_rosace_v2.py once the head is planned.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector

from .sources import SOURCES, append, verify

V = Vector

# ---------------------------------------------------------------------------- body shape
# Dex (2026-09-29): "take the busty SiroinoSotai body". The source's own keys, all relative to
# Basis, summed (a value past 1.0 extrapolates the key linearly). Chosen on the assemble review
# (review/rosace/base-v2/assemble/keys/: hi-res presets, then k1-k4 at 144 and 80 px):
#   Breasts_LLL and All_L read grotesque at hi-res; Breasts_LL 1.0 is the fullest bust that
#   still sits inside the ribcage silhouette from the front. Chest_02_Slim pinches the waist but
#   takes the underside of the bust with it (k4: bust width 17.4 px at 144), so the ribcage is
#   slimmed with Chest_Slim 0.5 and the waist with Spine_Slim 1.8 instead. k2 below (measured
#   with LEG_STRETCH 1.18; final numbers in PIPELINE.md 3.6b): waist
#   12.1 / hips 25.8 / bust 19.2 wide, 16.2 deep (px at 144) against k1's (LL 0.8, Spine_Slim
#   1.0) 13.3 / 25.8 / 18.8 / 15.8: the hourglass reads at 80 px, where k1 read as a column.
#   Hips_01/02_L give the hip shelf the bust needs; Heels puts the feet in the heeled-boot pose
#   (v1 did this with a 24 deg restyle).
# Adopt fixes (2026-09-29, after the blind A/B, PIPELINE.md 3.6e; sweep: rosace_v2/key_sweep.py):
#   the A/B found the bust no bigger than v1's (depth 15.8 px at 144) and the thighs heavy (11.8),
#   so Breasts_LLL 0.5 is stacked on LL 1.0 (depth 18.1; LLL at 1.0 read grotesque, LL 1.4 alone
#   gave only 17.7) and UpperLeg_L goes to 0 (10.8). The waist comes from WAIST_PINCH and the leg
#   length from LEG_STRETCH + TORSO_K below, not from more keys: Spine_Slim 2.5-3.0 bought only
#   0.6-1.1 px, Chest_01/02_Slim cost bust, Hips_0x_L past 1.0 lowered the crotch.
BODY_KEYS = {
    "Breasts_LL": 1.00,
    "Breasts_LLL": 0.50,
    "Hips_01_L": 1.00,
    "Hips_02_L": 1.00,
    "Spine_Slim": 1.80,
    "Chest_Slim": 0.50,
    "Heels": 1.00,
}

# Unity Humanoid (SiroinoSotai) -> VRoid J_Bip_* (what rosace/posing.py, the pose library, the
# motion retarget map tools/motion-ai/bone_map_vrm.json and hair/outfit/glaive expect).
# 'Chest' is split into J_Bip_C_Chest + J_Bip_C_UpperChest afterwards (split_chest).
BONE_MAP = {
    "Hips": "J_Bip_C_Hips", "Spine": "J_Bip_C_Spine", "Chest": "J_Bip_C_Chest",
    "Neck": "J_Bip_C_Neck", "Head": "J_Bip_C_Head",
    "Breast_Root": "J_Sec_C_BustRoot",
}
for s in "LR":
    BONE_MAP.update({
        f"Shoulder_{s}": f"J_Bip_{s}_Shoulder", f"UpperArm_{s}": f"J_Bip_{s}_UpperArm",
        f"LowerArm_{s}": f"J_Bip_{s}_LowerArm", f"Hand_{s}": f"J_Bip_{s}_Hand",
        f"UpperArm_Twist_{s}": f"J_Adj_{s}_UpperArmTwist", f"LowerArm_Twist_{s}": f"J_Adj_{s}_LowerArmTwist",
        f"UpperLeg_{s}": f"J_Bip_{s}_UpperLeg", f"LowerLeg_{s}": f"J_Bip_{s}_LowerLeg",
        f"Foot_{s}": f"J_Bip_{s}_Foot", f"Toe_{s}": f"J_Bip_{s}_ToeBase",
        f"Breast_{s}": f"J_Sec_{s}_Bust1", f"Breast_{s}_end": f"J_Sec_{s}_Bust2",
    })
    for f in ("Thumb", "Index", "Middle", "Ring", "Little"):
        for j, part in enumerate(("Proximal", "Intermediate", "Distal"), 1):
            BONE_MAP[f"{f}{part}_{s}"] = f"J_Bip_{s}_{f}{j}"

# joints the key bake moves with the skin (the Heels key lifts the ankle; the bust keys move the
# nipple): each is refitted by the kernel-weighted mean displacement of the skin around it
REFIT = ("Foot", "Toe", "LowerLeg")


def import_body():
    path = verify("siroino")
    obs = append(path, SOURCES["siroino"]["objects"])
    arm, ob = obs["Armature"], obs["SiroinoSotai_PC"]
    for o in (arm, ob):
        assert o.matrix_world == o.matrix_world.Identity(4), f"{o.name} is not at identity"
    arm.name = arm.data.name = "rosace_rig"
    ob.name = ob.data.name = "body"
    ob.data.materials.clear()
    for uv in list(ob.data.uv_layers)[1:]:        # nail-shape UV variants
        ob.data.uv_layers.remove(uv)
    return arm, ob


def bake_keys(arm, ob, keys=BODY_KEYS):
    """basis + sum(v_k * (key_k - basis)); every key is relative to Basis in the source"""
    kb = ob.data.shape_keys.key_blocks
    n = len(ob.data.vertices)
    base = np.empty(n * 3)
    kb[0].data.foreach_get("co", base)
    base = base.reshape(n, 3)
    delta = np.zeros_like(base)
    for name, val in keys.items():
        k = kb[name]
        assert k.relative_key.name == kb[0].name, name
        co = np.empty(n * 3)
        k.data.foreach_get("co", co)
        delta += val * (co.reshape(n, 3) - base)
    new = base + delta
    ob.shape_key_clear()
    ob.data.vertices.foreach_set("co", new.ravel())
    ob.data.update()
    # refit the joints the keys moved
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    moved = {}

    def disp(p, sigma=0.018, reach=0.05):
        d2 = ((base - np.array(p)) ** 2).sum(1)
        m = d2 < reach * reach
        if not m.any():
            return V()
        w = np.exp(-0.5 * d2[m] / sigma ** 2)
        return V((delta[m] * w[:, None]).sum(0) / w.sum())
    ends = {}
    for b in eb:
        if any(b.name.startswith(k) for k in REFIT):
            h, t = V(disp(b.head)), V(disp(b.tail))
            moved[b.name] = (round(h.length, 4), round(t.length, 4))
            ends[b.name] = (b.head + h, b.tail + t)
    for n, (h, t) in ends.items():       # set after measuring: connected joints are shared
        eb[n].head, eb[n].tail = h, t
    # bust: the chain runs from the chest wall to the front-most skin of each breast
    for s in "LR":
        g = ob.vertex_groups[f"Breast_{s}"].index
        pts = [new[v.index] for v in ob.data.vertices
               if any(x.group == g and x.weight > 0.5 for x in v.groups)]
        tip = V(min(pts, key=lambda p: p[1]))
        b1, b2 = eb[f"Breast_{s}"], eb[f"Breast_{s}_end"]
        L2 = (b2.tail - b2.head).length
        b1.tail = tip
        b2.head = tip
        b2.tail = tip + (tip - b1.head).normalized() * L2
        moved[b1.name] = ("tip", [round(c, 4) for c in tip])
    bpy.ops.object.mode_set(mode="OBJECT")
    return moved


def restore_quads(ob):
    """the PC mesh ships triangulated; the quads come back by joining each split quad"""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    n0 = len(bm.faces)
    bmesh.ops.join_triangles(bm, faces=list(bm.faces), angle_face_threshold=math.radians(40),
                             angle_shape_threshold=math.radians(40), cmp_seam=True, cmp_uvs=True)
    stats = {"faces_in": n0, "quads": sum(1 for f in bm.faces if len(f.verts) == 4),
             "tris": sum(1 for f in bm.faces if len(f.verts) == 3)}
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = True
    return stats


def rename_bones(arm, ob):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    for old, new in BONE_MAP.items():
        if old in eb:
            eb[old].name = new
    bpy.ops.object.mode_set(mode="OBJECT")
    for g in ob.vertex_groups:          # bone renames normally carry the groups; make sure
        if g.name in BONE_MAP:
            g.name = BONE_MAP[g.name]
    missing = [n for n in BONE_MAP.values() if n not in arm.data.bones and n != "J_Bip_C_UpperChest"]
    assert not missing, missing


def split_chest(arm, ob, band=0.03):
    """Unity's single Chest -> J_Bip_C_Chest + J_Bip_C_UpperChest (the pose library and the
    SOMA retarget both drive UpperChest). The weight moves over a smooth band at the split."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    ch = eb["J_Bip_C_Chest"]
    mid = (ch.head + ch.tail) / 2
    up = eb.new("J_Bip_C_UpperChest")
    up.head, up.tail, up.roll = mid.copy(), ch.tail.copy(), ch.roll
    up.parent = ch
    up.use_connect = True
    for b in list(eb):
        if b.parent == ch and b != up:
            b.use_connect = False
            b.parent = up
    ch.tail = mid
    zs = mid.z
    bpy.ops.object.mode_set(mode="OBJECT")
    gc = ob.vertex_groups["J_Bip_C_Chest"]
    gu = ob.vertex_groups.new(name="J_Bip_C_UpperChest")
    for v in ob.data.vertices:
        for x in v.groups:
            if x.group == gc.index and x.weight > 0:
                t = max(0.0, min(1.0, (v.co.z - (zs - band)) / (2 * band)))
                t = t * t * (3 - 2 * t)
                w = x.weight
                gc.add([v.index], w * (1 - t), "REPLACE")
                if t > 0:
                    gu.add([v.index], w * t, "REPLACE")
                break
    return zs


def neck_ring(ob):
    """the open boundary loop at the top of the headless neck (source coords)"""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    loops = []
    seen = set()
    for e in bm.edges:
        if not e.is_boundary or e in seen:
            continue
        loop, stack = set(), [e]
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            loop.add(x)
            for v in x.verts:
                stack += [y for y in v.link_edges if y.is_boundary and y not in seen]
        vs = {v.index for x in loop for v in x.verts}
        loops.append(vs)
    co = [v.co.copy() for v in bm.verts]
    bm.free()

    def c(vs):
        return sum((co[i] for i in vs), V()) / len(vs)
    ring = max((vs for vs in loops if abs(c(vs).x) < 0.02), key=lambda vs: c(vs).z)
    return sorted(ring)


# Leg length. With a head on, the source's crotch sits at ~49% of the height (it is 55% of the
# headless body); DESIGN.md 2 asks 52% ("long gacha legs"). v1 stretched its legs 1.30. The
# stretch runs from the ankle joint to the hip joint (feet keep their shape), everything above
# moves up; bones and skin get the same map, so the weights stay valid.
LEG_STRETCH = 1.30        # with TORSO_K 0.92: crotch at 53.7% of H (1.22 alone gave 51.6%, 1.0 gave 48.6%)


# Torso length (Adopt fixes, PIPELINE.md 3.6e). With the head size fixed (HEADS) and the height
# fixed, a longer leg stretch shrinks the whole body in the uniform scale (at 1.34 the shoulders
# lose 1.3 px and the hips 2 px at 144). Shortening the torso between the hip joint and the neck
# instead raises the crotch AND grows the body scale: a gacha short torso. 1.0 = the source's.
TORSO_K = 0.92           # 1.0 = the source torso; 0.92 with LEG_STRETCH 1.30 (sweep variant A)


def stretch_legs(arm, ob, k=LEG_STRETCH, kt=None):
    kt = TORSO_K if kt is None else kt
    B = arm.data.bones
    z0 = B["J_Bip_L_Foot"].head_local.z
    z1 = B["J_Bip_L_UpperLeg"].head_local.z
    zn = B["J_Bip_C_Neck"].head_local.z

    def f(z):
        if z <= z0:
            return z
        if z <= z1:
            return z0 + (z - z0) * k
        a = z0 + (z1 - z0) * k
        if z <= zn:
            return a + (z - z1) * kt
        return a + (zn - z1) * kt + (z - zn)
    for v in ob.data.vertices:
        v.co.z = f(v.co.z)
    ob.data.update()
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    ends = {b.name: (b.head.copy(), b.tail.copy(), b.roll) for b in eb}
    for b in eb:
        h, t, r = ends[b.name]
        h.z, t.z = f(h.z), f(t.z)
        b.head, b.tail, b.roll = h, t, r
    bpy.ops.object.mode_set(mode="OBJECT")
    return {"k": k, "torso_k": kt, "ankle_z": round(z0, 4), "hip_z": round(z1, 4), "neck_z": round(zn, 4)}


# The headless neck runs ~0.08 (source units) from the jugular notch to its open top: it is built
# to hide inside a VRChat head's own neck. With the MMD head's neck under the chin on top, that
# read as a giraffe neck (assemble round 1). So the body's neck is cut lower, parallel to its
# own top ring, and the head's neck takes over from there.
NECK_DROP = 0.035


def cut_neck(ob, ring_ids, drop=NECK_DROP):
    """cut the body's neck with a plane parallel to its open top ring, `drop` below it; returns
    the new ring's vertex indices (weights are interpolated on the new verts by the split)"""
    me = ob.data
    ring = [me.vertices[i].co.copy() for i in ring_ids]
    front = min(ring, key=lambda p: p.y)
    back = max(ring, key=lambda p: p.y)
    t = back - front
    t.x = 0
    t.normalize()
    n = V((0.0, -t.z, t.y)).normalized()
    if n.z < 0:
        n = -n
    c = sum(ring, V()) / len(ring)
    co = c - n * drop
    bm = bmesh.new()
    bm.from_mesh(me)
    geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=n, clear_outer=True)
    # only the neck: anything above the plane that is far from the neck axis (hands, arms in the
    # T-pose sit far below it anyway) would have been cut too; check nothing but the neck went
    bm.to_mesh(me)
    bm.free()
    me.update()
    ids = [v.index for v in me.vertices if abs((v.co - co).dot(n)) < 1e-5 and abs(v.co.x) < 0.1]
    return ids, {"plane_co": [round(x, 4) for x in co], "normal": [round(x, 4) for x in n]}


def fill_unweighted(ob):
    """bisect_plane leaves the new cut verts without deform weights (seen in assemble round 2:
    30 neck verts stayed at rest and stretched into a tube in every pose). Give each one the
    mean weights of its weighted edge neighbours, repeating until none are left."""
    me = ob.data
    nb = [[] for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    W = [{g.group: g.weight for g in v.groups if g.weight > 0} for v in me.vertices]
    todo = [i for i, w in enumerate(W) if not w]
    fixed = 0
    while todo:
        nxt = []
        for i in todo:
            src = [W[j] for j in nb[i] if W[j]]
            if not src:
                nxt.append(i)
                continue
            acc = {}
            for w in src:
                for g, x in w.items():
                    acc[g] = acc.get(g, 0.0) + x / len(src)
            W[i] = acc
            for g, x in acc.items():
                ob.vertex_groups[g].add([i], x, "REPLACE")
            fixed += 1
        if len(nxt) == len(todo):
            break
        todo = nxt
    return {"filled": fixed, "left": len(todo)}


def transform_all(arm, meshes, M):
    """apply one affine map to the armature's rest bones and to the meshes' vertices"""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    # all ends first: a connected child's head IS its parent's tail, so moving bones one at a
    # time would map shared joints twice
    ends = {b.name: (M @ b.head, M @ b.tail, b.roll) for b in eb}
    for b in eb:
        h, t, r = ends[b.name]
        b.head, b.tail = h, t
        b.roll = r
    bpy.ops.object.mode_set(mode="OBJECT")
    for ob in meshes:
        ob.data.transform(M)
        ob.data.update()


# Waist pinch (Adopt fixes, 2026-09-29; PIPELINE.md 3.6e). The blind A/B found v2's waist/hip at
# 0.47 against v1's 0.429: the hourglass read came from shading, not from the waist. Spine_Slim
# past ~2.5 starts to flatten the belly and Chest_02_Slim takes the underside of the bust with it,
# so the waist is narrowed directly: x only (the waist is already 0.095 m deep), a smooth bump
# centred WAIST_AT of the way up J_Bip_C_Spine, narrower above (the bust) than below (the hips).
# Runs in final metres, after the uniform scale; no bone moves (the spine is at x = 0).
WAIST_PINCH = {"amount": 0.17, "at": 0.63, "sigma_lo": 0.060, "sigma_hi": 0.045}


def waist_pinch(arm, ob, p=None):
    p = dict(WAIST_PINCH, **(p or {}))
    if not p["amount"]:
        return {**p, "z": None}
    b = arm.data.bones["J_Bip_C_Spine"]
    zc = b.head_local.z + p["at"] * (b.tail_local.z - b.head_local.z)
    n = len(ob.data.vertices)
    co = np.empty(n * 3)
    ob.data.vertices.foreach_get("co", co)
    co = co.reshape(n, 3)
    dz = co[:, 2] - zc
    s = np.where(dz < 0, p["sigma_lo"], p["sigma_hi"])
    co[:, 0] *= 1.0 - p["amount"] * np.exp(-0.5 * (dz / s) ** 2)
    ob.data.vertices.foreach_set("co", co.ravel())
    ob.data.update()
    return {**p, "z": round(float(zc), 4)}
