"""Delivery-only copied head/reference FC1 adapter, never save/rig-edit."""
import hashlib
import json
import struct
from pathlib import Path

import facecage_geometry as G
import facecage_support as S
import facecage_normals as N

FEATURES = ("ref_eyes","ref_eyes_white","ref_eyes_highlight","ref_eyeblow",
    "ref_eyelid","ref_eyelush","ref_mouth","ref_tongue","ref_tooth")


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,allow_nan=False,separators=(",",":")).encode()).hexdigest()


def invariant(obj):
    mesh = obj.data
    # Legacy UV access may create internal selection attributes. Materialize
    # every typed UV field before taking the complete attribute snapshot.
    uv={a.name:{'activeRender':bool(a.active_render),'activeClone':bool(a.active_clone),
                'rows':[N.P.typed_value(p) for p in a.data]} for a in mesh.uv_layers}
    attributes = {}
    for attr in mesh.attributes:
        rows=[N.P.typed_value(item) for item in attr.data]
        payload_schema=[{name:{k:v for k,v in value.items() if k!='value'} for name,value in row.items()} for row in rows]
        attributes[attr.name]={'name':attr.name,'domain':attr.domain,'dataType':attr.data_type,
            'required':bool(attr.is_required),'count':len(rows),'payloadSchema':payload_schema,
            'rows':'declared position/encoded-normal payload scope' if attr.name in ('position','custom_normal','.custom_normal') else rows}
    return {"faces":[[list(p.vertices),p.material_index,p.use_smooth] for p in mesh.polygons],
        "edges":[[list(e.vertices),e.use_seam,e.use_edge_sharp] for e in mesh.edges],
        "loops":[[p.vertex_index,p.edge_index] for p in mesh.loops],"attributes":attributes,
        "uv":uv,
        "weights":[[[g.group,g.weight] for g in v.groups] for v in mesh.vertices],
        "groups":[g.name for g in obj.vertex_groups],"materials":[m.name for m in mesh.materials],
        "part":obj.get("part"),"passIndex":obj.pass_index,"hideRender":obj.hide_render,
        "parent":obj.parent.name if obj.parent else None,"matrix":[list(r) for r in obj.matrix_world]}


def write_diagnostic(path,report):
    if path is None:
        return
    path=Path(path).resolve()
    repo=Path(__file__).resolve().parents[5]
    if path.exists() or (repo/'review/rosace/specialists/refinement/facecage').resolve() not in path.parents:
        raise ValueError('fresh executing private FC1 diagnostic required')
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes((json.dumps(report,indent=2,allow_nan=False)+'\n').encode('utf-8'))


def install(enabled,diagnostic_output=None):
    if not enabled:
        return {"handles":[],"enabled":False,"report":{"enabled":False,"copiedMeshes":0}}
    import bpy
    state={"handles":[],"enabled":True,"report":{"status":"support-install-in-progress","nativeVersion":bpy.app.version_string,
            "sourceParent":"bd94059a13d5becd68b80c0d219fdb6ad1d989f9","renderedImages":0,
            "objects":{},"guardContract":"immutable ALL ORIGINAL P0 + explicit neck anatomy, exact decoded and encoded; originally active newly pinned support stays within original active normal footprint"}}
    try:
        rig=bpy.data.objects['rosace_rig']; head=bpy.data.objects['head_skin']
        eyes=[tuple(rig.data.bones[f'J_Adj_{s}_FaceEye'].head_local) for s in 'LR']
        points=tuple(tuple(v.co) for v in head.data.vertices)
        front=[i for i,p in enumerate(points) if abs(p[0])<.012]
        chin_id=min((i for i in front if points[i][1]<eyes[0][1]+.02),key=lambda i:points[i][2])
        eye_z=sum(e[2] for e in eyes)/2
        nose_id=min((i for i in front if points[i][2]<points[chin_id][2]+.8*(eye_z-points[chin_id][2])),key=lambda i:points[i][1])
        group=head.vertex_groups.get('J_Bip_C_Neck')
        if group is None: raise ValueError('canonical explicit Neck anatomy group missing')
        seam={v.index for v in head.data.vertices if any(g.group==group.index and g.weight>0 for g in v.groups)}
        anatomy=set(seam)
        for edge in head.data.edges:
            if set(edge.vertices)&seam: anatomy.update(edge.vertices)
        if not anatomy: raise ValueError('actual neck anatomy missing')
        original_cfg=G.config(points[chin_id][2],max(p[2] for p in points),eyes,max(points[i][2] for i in anatomy)+.001)
        state['report']['actualAttributeSchema']=[[a.name,a.domain,a.data_type,len(a.data)] for a in head.data.attributes]
        schema,pairs=N.encoded(head.data); original_decoded=N.decoded(head.data)
        state['report'].update(originalConfig=original_cfg,originalEncodedSchema=schema,
            originalEncodedCount=len(pairs),originalFullEncodedSha256=N.digest(pairs),
            originalDecodedCount=len(original_decoded),originalFullDecodedSha256=N.digest(original_decoded),
            actualAttributeSchema=[[a.name,a.domain,a.data_type,len(a.data)] for a in head.data.attributes])
        baseline_p0={i for i,p in enumerate(points) if G.move(p,original_cfg)==p}
        state['report'].update(originalP0VertexIndices=sorted(baseline_p0),originalP0VertexCount=len(baseline_p0),
            originalP0CornerIndices=[l.index for l in head.data.loops if l.vertex_index in baseline_p0],
            protectedOriginalCornerIndices=[l.index for l in head.data.loops if l.vertex_index in baseline_p0|anatomy])
        cfg,support=S.plan(points,[tuple(p.vertices) for p in head.data.polygons],original_cfg,anatomy)
        state['report']['support']=support
        p0=set(support['originalP0VertexIndices']); protected=p0|anatomy
        corners=[l.index for l in head.data.loops if l.vertex_index in protected]
        state['report'].update(originalP0VertexCount=len(p0),protectedOriginalCornerIndices=corners,
                              originalP0CornerIndices=[l.index for l in head.data.loops if l.vertex_index in p0])
        if len(p0)!=941:
            raise ValueError('actual canonical ORIGINAL P0 count differs from frozen941; no omission/retune')
        state.update(config=cfg,originalConfig=original_cfg,eyes=dict(zip('LR',eyes)),noseId=nose_id,chinId=chin_id,
                     protectedIndices=sorted(protected))
        objects=[head]+[bpy.data.objects[name] for name in FEATURES if name in bpy.data.objects]
        if not all(name in bpy.data.objects for name in FEATURES[:7]):
            raise ValueError('canonical placement references missing')
        records = {}; baselines={}
        for obj in objects:
            state['report']['currentObject']=obj.name
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
            original_normals=N.decoded(original) if original.has_custom_normals else None
            original_pairs=N.encoded(original)[1] if original.has_custom_normals else None
            baselines[obj.name]=(inv,before,original_normals,original_pairs)
            copy = original.copy()
            state["handles"].append((obj,original,copy))
            for v,p in zip(copy.vertices,changed):
                v.co = p
            copy.update()
            obj.data = copy
            actual=tuple(tuple(v.co) for v in copy.vertices)
            expected_native=tuple(tuple(struct.unpack('f',struct.pack('f',v))[0] for v in p) for p in changed)
            if actual!=expected_native:
                raise AssertionError('actual geometry differs from exact native-float FINAL shared field')
            _,actual_geometry=G.validate_candidate(before,actual,tris,cfg,require_change=obj==head)
            object_p0={i for i,p in enumerate(before) if G.move(p,original_cfg)==p}
            object_protected=protected if obj==head else object_p0
            if any(actual[i]!=before[i] for i in object_protected):
                raise AssertionError('actual final geometry moves original P0/anatomy')
            normal_report=N.correct(obj,original,copy,before,cfg,object_protected) if original.has_custom_normals else None
            if digest(invariant(obj))!=inv or tuple(tuple(v.co) for v in original.vertices)!=before:
                raise AssertionError("head/ref topology/UV/attributes/weights/materials/hidden/original changed")
            actual = tuple(tuple(v.co) for v in copy.vertices)
            changed_ids = set(geometry["changedIndices"])
            if any(actual[i]!=before[i] for i in range(len(before)) if i not in changed_ids):
                raise AssertionError("protected crown/back/seam coordinates changed")
            if original.has_custom_normals and (N.decoded(original)!=original_normals or N.encoded(original)[1]!=original_pairs):
                raise AssertionError('original encoded/decoded normal data changed')
            obj.data=original
            try:
                if digest(invariant(obj))!=inv:
                    raise AssertionError('full original typed topology/UV/attribute/weight/material/hidden invariant changed')
            finally:
                obj.data=copy
            records[obj.name] = dict(geometry,actualGeometry=actual_geometry,normalCorrection=normal_report,
                invariantSha256=inv,originalCoordinatesSha256=digest(before),candidateCoordinatesSha256=digest(actual),
                originalP0VertexIndices=sorted(object_p0),originalActiveNormalFootprintCornerIndices=[l.index for l in original.loops if l.vertex_index not in object_protected],
                originalUnchanged=True,hidden=obj.hide_render,finalSharedConfig=cfg)
            state['report']['objects']=records
        # Recheck ALL originals after ALL head/ref normal operations, including
        # the full typed invariant captured after UV schema materialization.
        for obj,original,copy in state['handles']:
            inv,before,old_decoded,old_pairs=baselines[obj.name]
            obj.data=original
            try:
                if digest(invariant(obj))!=inv or tuple(tuple(v.co) for v in original.vertices)!=before:
                    raise AssertionError('full original readback failed after all normal operations: '+obj.name)
                if old_decoded is not None and (N.decoded(original)!=old_decoded or N.encoded(original)[1]!=old_pairs):
                    raise AssertionError('original normal readback failed after all head/ref operations: '+obj.name)
            finally:
                obj.data=copy
        state["report"].update(enabled=True,status='source-installed-native-original-guard-pass',copiedMeshes=len(objects),config=cfg,
            protectedNeckVertexCount=len(anatomy),protectedDecodedNormalsExact=True,protectedEncodedNormalsExact=True,
            normalMethod='final shared field targets plus complete deform-only/target-original INT16_2D pair preservation, actual readback',
            noseVertexId=nose_id,chinVertexId=chin_id,rigChanged=False,headMetricsChanged=False,
            limits="polygon-star support hypothesis only; exact original941 P0/anatomy guard passed if this record exists, no smoothing-fan inference; actual pixels/quality remain unqualified")
        write_diagnostic(diagnostic_output,state['report'])
        return state
    except BaseException as error:
        if hasattr(error,'report'):
            state['report']['failureDetail']=error.report
            if isinstance(error,S.SupportFailure): state['report']['support']=error.report
        state['report'].update(status='support-install-rejected-before-candidate-image',failure=repr(error))
        try: restore(state)
        except BaseException as cleanup: state['report']['cleanupFailure']=repr(cleanup)
        state['report']['cleanup']=state.get('restoreReport')
        state['report']['originalPointersRestored']=not state.get('restoreReport',{}).get('originalPointerMismatches',[])
        write_diagnostic(diagnostic_output,state['report'])
        raise


def restore(state):
    if state and state.get("handles"):
        import bpy
        errors=[]
        handles=list(reversed(state['handles']))
        for obj,original,copy in handles:
            try: obj.data=original
            except BaseException as error: errors.append(repr(error))
        for obj,original,copy in handles:
            try: bpy.data.meshes.remove(copy)
            except BaseException as error: errors.append(repr(error))
        state['restoreReport']={'originalPointerMismatches':[obj.name for obj,original,copy in handles if obj.data is not original],
                                'cleanupErrors':errors,'attemptedOwnedMeshCount':len(handles)}
        state["handles"] = []
        if errors: raise RuntimeError('FC1 cleanup attempted all original pointers/owned meshes: '+'; '.join(errors))


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
