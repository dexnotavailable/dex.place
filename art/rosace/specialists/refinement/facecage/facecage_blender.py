"""Delivery-only copied head/reference FC1 adapter, never save/rig-edit."""
import hashlib
import json

import facecage_geometry as G

FEATURES = ("ref_eyes","ref_eyes_white","ref_eyes_highlight","ref_eyeblow",
    "ref_eyelid","ref_eyelush","ref_mouth","ref_tongue","ref_tooth")


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,allow_nan=False,separators=(",",":")).encode()).hexdigest()


def invariant(obj):
    mesh = obj.data
    attributes = {}
    for attr in mesh.attributes:
        if attr.name in ("position","custom_normal",".custom_normal"):
            continue
        attributes[attr.name] = [attr.domain,attr.data_type,[[
            getattr(item,f) if isinstance(getattr(item,f),(int,float,bool,str)) else list(getattr(item,f))
            for f in ("value","vector","color") if hasattr(item,f)] for item in attr.data]]
    return {"faces":[[list(p.vertices),p.material_index,p.use_smooth] for p in mesh.polygons],
        "edges":[[list(e.vertices),e.use_seam,e.use_edge_sharp] for e in mesh.edges],
        "loops":[[p.vertex_index,p.edge_index] for p in mesh.loops],"attributes":attributes,
        "uv":{a.name:[list(p.uv) for p in a.data] for a in mesh.uv_layers},
        "weights":[[[g.group,g.weight] for g in v.groups] for v in mesh.vertices],
        "groups":[g.name for g in obj.vertex_groups],"materials":[m.name for m in mesh.materials],
        "part":obj.get("part"),"passIndex":obj.pass_index,"hideRender":obj.hide_render,
        "parent":obj.parent.name if obj.parent else None,"matrix":[list(r) for r in obj.matrix_world]}


def install(enabled):
    if not enabled:
        return {"handles":[],"enabled":False,"report":{"enabled":False,"copiedMeshes":0}}
    import bpy
    rig = bpy.data.objects["rosace_rig"]
    head = bpy.data.objects["head_skin"]
    eyes = [tuple(rig.data.bones[f"J_Adj_{s}_FaceEye"].head_local) for s in "LR"]
    points = tuple(tuple(v.co) for v in head.data.vertices)
    front = [i for i,p in enumerate(points) if abs(p[0])<.012]
    chin_id = min((i for i in front if points[i][1]<eyes[0][1]+.02),key=lambda i:points[i][2])
    eye_z = sum(e[2] for e in eyes)/2
    nose_id = min((i for i in front if points[i][2]<points[chin_id][2]+.8*(eye_z-points[chin_id][2])),key=lambda i:points[i][1])
    neck_group = head.vertex_groups.get("J_Bip_C_Neck")
    if neck_group is None:
        raise ValueError("canonical welded neck group required")
    seam = {v.index for v in head.data.vertices if any(g.group==neck_group.index and g.weight>0 for g in v.groups)}
    protected = set(seam)
    # Protect every mixed Neck-weight vertex and one topological neighborhood.
    for edge in head.data.edges:
        if any(i in seam for i in edge.vertices):
            protected.update(edge.vertices)
    if not protected:
        raise ValueError("actual neck seam protection missing")
    neck_top = max(points[i][2] for i in protected)+.001
    cfg = G.config(points[chin_id][2],max(p[2] for p in points),eyes,neck_top)
    state = {"handles":[],"enabled":True,"config":cfg,"eyes":dict(zip("LR",eyes)),
        "noseId":nose_id,"chinId":chin_id,"protectedIndices":sorted(protected),"report":{}}
    objects = [head]+[bpy.data.objects[name] for name in FEATURES if name in bpy.data.objects]
    if not all(name in bpy.data.objects for name in FEATURES[:7]):
        raise ValueError("canonical placement references missing")
    try:
        records = {}
        for obj in objects:
            original = obj.data
            if obj.type!="MESH" or original.shape_keys or obj.parent!=rig or len(obj.modifiers)!=1 or obj.modifiers[0].type!="ARMATURE" or obj.modifiers[0].object!=rig:
                raise ValueError("expected unkeyed canonical head/ref mesh with sole armature modifier")
            if any(abs(obj.matrix_world[r][c]-(1 if r==c else 0))>1e-6 for r in range(4) for c in range(4)):
                raise ValueError("identity rest mesh transform required")
            if obj!=head and not obj.hide_render:
                raise ValueError("placement references must remain hidden")
            if obj==head and not original.has_custom_normals:
                raise ValueError("actual welded custom head normals required; do not rebuild")
            before = tuple(tuple(v.co) for v in original.vertices)
            original.calc_loop_triangles()
            tris = [tuple(t.vertices) for t in original.loop_triangles]
            changed,geometry = G.validate(before,tris,cfg,require_change=obj==head)
            if obj==head and any(before[i]!=changed[i] for i in protected):
                raise AssertionError("cage touches protected neck neighborhood")
            inv = digest(invariant(obj))
            old_normals = [tuple(n.vector) for n in original.corner_normals]
            copy = original.copy()
            state["handles"].append((obj,original,copy))
            for v,p in zip(copy.vertices,changed):
                v.co = p
            copy.update()
            if original.has_custom_normals:
                normals = [G.transport_normal(before[loop.vertex_index],normal,cfg)
                    for loop,normal in zip(original.loops,old_normals)]
                copy.normals_split_custom_set(normals)
                copy.update()
            obj.data = copy
            if digest(invariant(obj))!=inv or tuple(tuple(v.co) for v in original.vertices)!=before:
                raise AssertionError("head/ref topology/UV/attributes/weights/materials/hidden/original changed")
            actual = tuple(tuple(v.co) for v in copy.vertices)
            changed_ids = set(geometry["changedIndices"])
            if any(actual[i]!=before[i] for i in range(len(before)) if i not in changed_ids):
                raise AssertionError("protected crown/back/seam coordinates changed")
            if obj==head:
                protected_loops = [loop.index for loop in copy.loops if loop.vertex_index in protected or changed[loop.vertex_index]==before[loop.vertex_index]]
                after_normals = [tuple(n.vector) for n in copy.corner_normals]
                if len(after_normals)!=len(old_normals) or any(after_normals[i]!=old_normals[i] for i in protected_loops):
                    raise AssertionError("protected decoded welded/crown normals changed; no tolerance waiver")
            records[obj.name] = dict(geometry,invariantSha256=inv,originalCoordinatesSha256=digest(before),
                candidateCoordinatesSha256=digest(actual),originalUnchanged=True,hidden=obj.hide_render)
        state["report"] = {"enabled":True,"copiedMeshes":len(objects),"config":cfg,"objects":records,
            "protectedNeckVertexCount":len(protected),"protectedDecodedNormalsExact":True,
            "normalMethod":"existing corner normal inverse-transpose numerical cage Jacobian; protected values returned unchanged",
            "noseVertexId":nose_id,"chinVertexId":chin_id,"rigChanged":False,"headMetricsChanged":False,
            "limits":"source geometry only; real fringe clearance/feature openness/profile/pixel fitting and appeal remain native tests"}
        return state
    except BaseException:
        restore(state)
        raise


def restore(state):
    if state and state.get("handles"):
        import bpy
        for obj,original,copy in reversed(state["handles"]):
            obj.data = original
            bpy.data.meshes.remove(copy)
        state["handles"] = []


def placement(state, scene):
    """Cage placement and actual rig stay separate. Native pixels, not a sketch."""
    import bpy
    from mathutils import Vector
    from rosace import render
    rig = bpy.data.objects["rosace_rig"]
    bone = rig.pose.bones["J_Bip_C_Head"]
    matrix = rig.matrix_world @ bone.matrix @ bone.bone.matrix_local.inverted()
    result = {"eyes":{}}
    for side,p in state["eyes"].items():
        result["eyes"][side] = render.project(scene,matrix @ Vector(G.move(p,state["config"])))
    evaluated = bpy.data.objects["head_skin"].evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    try:
        for name,index in (("nose",state["noseId"]),("chin",state["chinId"])):
            result[name] = render.project(scene,evaluated.matrix_world @ mesh.vertices[index].co)
    finally:
        evaluated.to_mesh_clear()
    return result
