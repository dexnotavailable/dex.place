"""Read-only evaluated mesh capture at the first144 render boundary.

Native APIs are deliberately unexecuted by source fixtures. Centre rays are
possible blocker diagnostics; opacity/visibility disagreements stay unknown.
"""
import math
from pathlib import Path
import numpy as np
from probe_math import project, footprint, ray_for, render_policy, classify_hits

HAND_PREFIXES = ("J_Bip_L_Hand","J_Bip_L_Index","J_Bip_L_Middle","J_Bip_L_Ring","J_Bip_L_Little","J_Bip_L_Thumb")
MAX_ACTORS, MAX_TRIANGLES = 512, 500000


def check_origins(driver, repo):
    for component,relative in ((driver,"drive9/d9_blender.py"),(driver.render,"rosace/render.py"),
                               (driver.materials,"rosace/materials.py"),(driver.posing,"rosace/posing.py"),
                               (driver.figure_pose,"rosace_v2/figure_pose.py"),(driver.head_scale,"finish_f2/head_scale.py")):
        if Path(component.__file__).resolve()!=(repo/"tools/pixel-pipeline"/relative).resolve():
            raise ValueError("unexpected cached driver dependency: "+relative)


def layer_names(layer, excluded=False):
    excluded = excluded or layer.exclude or layer.collection.hide_render
    names = set() if excluded else {obj.name for obj in layer.collection.objects}
    for child in layer.children:
        names |= layer_names(child,excluded)
    return names


def opacity(material, pass_nodes):
    if material is None:
        return "unknown", None
    nodes = pass_nodes.get(material.name,{})
    known = all(key in nodes and nodes[key].type=="EMISSION" for key in ("id","depth2"))
    culling = bool(material.use_backface_culling) if hasattr(material,"use_backface_culling") else None
    return ("categorical-opaque" if known else "unknown"),culling


def face_weights(obj, index):
    from rosace_v2.limbs import limb_of
    names = {g.index:g.name for g in obj.vertex_groups}
    hand,other = 0.0,0.0
    bones,limbs = {},{}
    for vi in obj.data.polygons[index].vertices:
        for group in obj.data.vertices[vi].groups:
            name = names[group.group]
            bones[name] = bones.get(name,0.0)+float(group.weight)
            label=limb_of(name)
            if label:
                limbs[label]=limbs.get(label,0.0)+float(group.weight)
            if name.startswith(HAND_PREFIXES):
                hand += group.weight
            else:
                other += group.weight
    return {"handFingerWeightSum":hand,"otherWeightSum":other,"boneWeightSums":bones,
            "limbWeightSums":limbs,"dominantSourceLimb":max(sorted(limbs),key=limbs.get) if limbs else 0}


def release_meshes(held):
    errors=[]
    for evaluated in reversed(held):
        try:
            evaluated.to_mesh_clear()
        except BaseException as error:
            errors.append(type(error).__name__+": "+str(error))
    if errors:
        raise RuntimeError("temporary evaluated-mesh cleanup failed: "+"; ".join(errors))


def ray_actor(actor, origin, direction, clip_start, clip_end, vector):
    if actor["tree"] is None:
        return None
    offset=0.0
    for attempt in range(8):
        location,normal,index,distance=actor["tree"].ray_cast(vector(origin+direction*offset),vector(direction),clip_end-clip_start-offset)
        if location is None:
            return None
        info=actor["faces"][index]
        offset+=distance
        if info["backfaceCulling"] is True and normal.dot(vector(direction))>=0:
            offset+=1e-6
            continue
        uncertainty=list(actor["record"]["uncertainties"])
        if info["backfaceCulling"] is None:
            uncertainty.append("backface-culling property unavailable")
        return dict(info,object=actor["record"]["object"],part=actor["record"]["part"],
                    depthM=offset+clip_start,uncertainties=uncertainty)
    return {"object":actor["record"]["object"],"depthM":offset+clip_start,
            "opacity":"unknown","uncertainties":["backface traversal bound reached"]}


def capture(scene, shot, driver, bpy, frozen, geometry):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    from bpy_extras.object_utils import world_to_camera_view
    check_origins(driver,Path(__file__).resolve().parents[4])
    bpy.context.view_layer.update()
    if scene.camera.data.type!="ORTHO" or [scene.render.resolution_x,scene.render.resolution_y]!=[n*4 for n in shot["canvas"]] or scene.render.resolution_percentage!=100:
        raise ValueError("actual first144 orthographic camera/render dimensions differ")
    rig = bpy.data.objects["rosace_rig"]
    bones = {b.name:[list(row) for row in b.matrix] for b in rig.pose.bones}
    if set(bones)!=set(frozen["trial"]["evaluatedBoneMatrices"]):
        raise ValueError("actual bone set differs from frozen925")
    errors = [abs(x-y) for name,rows in bones.items() for row,old in zip(rows,frozen["trial"]["evaluatedBoneMatrices"][name]) for x,y in zip(row,old)]
    if not all(math.isfinite(v) for v in errors) or max(errors)>1e-6:
        raise ValueError("actual pose differs from frozen925")
    for key in ("candidateCoordinatesSha256","originalCoordinatesSha256","typedInvariantSha256","requestedRetreatM","maxRetreatM"):
        if geometry[key]!=frozen["trial"]["geometry"][key]:
            raise ValueError("actual cuff recipe/coordinates differ: "+key)
    expected = frozen["meta"]
    if driver.render.material_table()!=expected["materials"]:
        raise ValueError("material categorical table differs from frozen925")
    materials = expected["materials"]
    hand_bones={}
    for bone in rig.pose.bones:
        if bone.name.startswith(HAND_PREFIXES):
            points=[list(rig.matrix_world@point) for point in (bone.head,bone.tail)]
            hand_bones[bone.name]={"worldHeadTail":points,"nativeHeadTail":project(points,shot).tolist(),"matrix":[list(row) for row in bone.matrix]}
    allowed = layer_names(bpy.context.view_layer.layer_collection)
    graph = bpy.context.evaluated_depsgraph_get()
    entries = [(obj,obj.evaluated_get(graph),obj.matrix_world,False) for obj in scene.objects if obj.type=="MESH"]
    for instance in graph.object_instances:
        if instance.is_instance and instance.object.type=="MESH":
            entries.append((instance.object.original,instance.object,instance.matrix_world,True))
    if len(entries)>MAX_ACTORS:
        raise ValueError("evaluated actor budget exceeded")
    inventory,actors,hand_triangles,hand_faces,held,weight_audit = [],[],[],[],[],[]
    primary = set()
    projection_errors = []
    try:
        total_triangles = 0
        for number,(obj,evaluated,matrix,is_instance) in enumerate(entries):
            mismatch = [[m.name,bool(m.show_viewport),bool(m.show_render)] for m in obj.modifiers if m.show_viewport!=m.show_render]
            record = {"actor":f"{obj.name}#{number}","object":obj.name,"part":obj.pass_index,
                      "hideRender":bool(obj.hide_render),"cameraVisible":getattr(obj,"visible_camera",None),
                      "renderLayerExcluded":obj.name not in allowed and not is_instance,
                      "viewportVisible":bool(obj.visible_get(view_layer=bpy.context.view_layer)),
                      "modifierVisibilityMismatch":mismatch,"instance":is_instance}
            policy,uncertainties = render_policy(record)
            if record["cameraVisible"] is None:
                uncertainties.append("camera visibility property unavailable")
            if is_instance:
                uncertainties.append("instance render/viewport eligibility not proven")
            record.update(policy=policy,uncertainties=uncertainties)
            inventory.append(record)
            if policy=="excluded":
                continue
            me = evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=graph)
            held.append(evaluated)
            if me is None:
                raise ValueError("render-relevant object has no evaluated mesh: "+obj.name)
            me.calc_loop_triangles()
            verts = [matrix@v.co for v in me.vertices]
            tris = [tuple(t.vertices) for t in me.loop_triangles]
            total_triangles += len(tris)
            if total_triangles>MAX_TRIANGLES:
                raise ValueError("evaluated triangle budget exceeded")
            mapped = len(me.vertices)==len(obj.data.vertices) and len(me.polygons)==len(obj.data.polygons) and all(tuple(a.vertices)==tuple(b.vertices) for a,b in zip(me.polygons,obj.data.polygons))
            record.update(evaluatedTriangles=len(tris),sourceFaceMappingProven=mapped)
            limb_attr = me.attributes.get("limb")
            if limb_attr and limb_attr.domain!="FACE":
                raise ValueError("unexpected limb attribute domain")
            faces = []
            weights_by_face={}
            for tri in me.loop_triangles:
                poly = me.polygons[tri.polygon_index]
                material = evaluated.material_slots[poly.material_index].material if poly.material_index<len(evaluated.material_slots) else None
                name = material.name if material else None
                mid = materials.get(name,{}).get("id")
                raw_limb = float(limb_attr.data[poly.index].value) if limb_attr else None
                if raw_limb is not None and (not math.isfinite(raw_limb) or int(raw_limb)!=raw_limb or not 0<=raw_limb<=25):
                    raise ValueError("invalid evaluated limb label")
                label = int(raw_limb) if raw_limb is not None else None
                state,cull = opacity(material,driver.materials.PASS_NODES)
                face = {"evaluatedFace":poly.index,"sourceFace":poly.index if mapped else None,
                        "generatedOrUnmapped":not mapped,"material":name,"materialId":mid,
                        "limb":label,"opacity":state,"backfaceCulling":cull}
                faces.append(face)
                if obj.pass_index==36 and mid==1 and mapped and poly.index not in weights_by_face:
                    weights=face_weights(obj,poly.index)
                    weights_by_face[poly.index]=weights
                    if weights["handFingerWeightSum"]>0 or label==14:
                        weight_audit.append({"object":obj.name,"sourceFace":poly.index,"encodedLimb":label,
                                             "tagMatchesDominantWeights":label==weights["dominantSourceLimb"],**weights})
                if obj.pass_index==36 and mid==1 and label==14:
                    primary.add(record["actor"])
                    if uncertainties:
                        raise ValueError("primary hand evaluated geometry differs from render visibility/modifiers")
                    if not mapped:
                        raise ValueError("primary hand source face mapping unproven")
                    world = [list(verts[vi]) for vi in tri.vertices]
                    projected = project(world,shot)
                    for point,xy in zip(world,projected):
                        view = world_to_camera_view(scene,scene.camera,Vector(point))
                        api = np.array([view.x*shot["canvas"][0],(1-view.y)*shot["canvas"][1]])
                        projection_errors.append(float(np.max(np.abs(api-xy))))
                    hand_triangles.append(projected)
                    hand_faces.append(dict(face,worldTriangle=world,projectedTriangle=projected.tolist(),
                                           weights=weights_by_face[poly.index]))
            actors.append({"record":record,"faces":faces,"tree":BVHTree.FromPolygons(verts,tris,all_triangles=True) if tris else None})
        if len(primary)!=1 or not hand_triangles or max(projection_errors,default=float("inf"))>1e-4:
            raise ValueError("primary hand/camera projection could not be established")
        samples,summary = footprint(hand_triangles,shot)
        ids,depth2 = frozen["id"],frozen["depth2"]
        h,w = shot["canvas"][1]*4,shot["canvas"][0]*4
        if ids.shape!=(h,w,4) or depth2.shape!=(h,w,4):
            raise ValueError("frozen actual raster shape differs from camera")
        actual_mask = (ids[...,3]>0)&(ids[...,0]==1)&(ids[...,1]==36)&(depth2[...,2]==14)
        clip_start,clip_end = scene.camera.data.clip_start,scene.camera.data.clip_end
        rays = []
        for sample in samples:
            origin,direction = ray_for(sample,shot,clip_start)
            hits = []
            for actor in actors:
                hit=ray_actor(actor,origin,direction,clip_start,clip_end,Vector)
                if hit:
                    hits.append(hit)
            x,y = map(int,sample)
            classified = classify_hits(hits)
            known = classified["knownOpaqueCentreCandidate"]
            actual = {"materialId":int(ids[y,x,0]),"part":int(ids[y,x,1]),"limb":int(depth2[y,x,2]),"alpha":int(ids[y,x,3])}
            agreement = None if known is None or classified["ambiguousBeforeKnownCandidate"] else actual["alpha"]>0 and all(known[key]==actual[key] for key in ("materialId","part","limb"))
            rays.append(dict(sample=[x,y],actualRaw=actual,categoryAgreement=agreement,**classified))
        summary.update(actualVisibleFrozen144HandSupersamples=int(actual_mask.sum()),
                       actualVisibleMaskCells=np.argwhere(actual_mask).tolist(),
                       nativeChosenVisibility=frozen["native_visibility"],projectionMaxErrorNativePx=max(projection_errors),
                       centreRayAgreement=sum(row["categoryAgreement"] is True for row in rays),
                       centreRayDisagreement=sum(row["categoryAgreement"] is False for row in rays),
                       centreRayUnknown=sum(row["categoryAgreement"] is None for row in rays))
        return {"shot":shot,"boneMatrixMaxError":max(errors),"handFingerBones":hand_bones,"cuffGeometry":geometry,
                "evaluatedObjects":inventory,"handFaces":hand_faces,"handWeightLabelAudit":weight_audit,
                "handFootprint":summary,"rays":rays,
                "causeEstablished":False,"appearanceAccepted":False,
                "limits":"limb14 is the frozen face-weight category, not an independent anatomical segmentation; centre rays ignore raster jitter/edge rules and unknown transparency/visibility remains unknown; generated faces are unmapped unless exact source topology is proven"}
    finally:
        release_meshes(held)
