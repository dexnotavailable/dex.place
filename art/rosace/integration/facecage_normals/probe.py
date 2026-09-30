"""Sole-delivery, zero-render diagnosis of the actual FC1 normal failure.

All experiments use disposable head mesh copies. No tolerance waiver, source
mesh/rig edit, image/model generation, blend save or candidate acceptance.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,allow_nan=False).encode()).hexdigest()


def vector_delta(before,after):
    if len(before)!=3 or len(after)!=3 or not all(math.isfinite(v) for v in (*before,*after)):
        raise ValueError("finite native three-component normals required")
    delta=[b-a for a,b in zip(before,after)]
    lengths=[math.hypot(*row) for row in (before,after)]
    if not all(math.isfinite(v) for v in (*delta,*lengths)):
        raise ValueError("nonfinite computed normal delta/length")
    angle=None
    if all(lengths):
        cosine=sum((a/lengths[0])*(b/lengths[1]) for a,b in zip(before,after))
        angle=math.degrees(math.acos(max(-1.,min(1.,cosine))))
    return {"exact":tuple(before)==tuple(after),"before":list(before),"after":list(after),
        "componentDelta":delta,"maxComponentAbs":max(abs(v) for v in delta),
        "angularDegrees":angle,"normalLengths":lengths}


def regions(point,index,cfg,neck,seam,changed):
    result=[]
    if index in seam: result.append("explicit-neck-weight")
    elif index in neck: result.append("explicit-neck-neighborhood")
    if point[2]<=cfg["neckProtectedThrough"]: result.append("neck-height-region")
    if point[2]>=cfg["crownProtectedFrom"]: result.append("crown-region")
    if point[1]>=cfg["eyeY"]+.60*cfg["span"]: result.append("back-region")
    if index not in changed: result.append("zero-displacement")
    if not result: result.append("deformed-face")
    return result


def report_case(name,before,after,loops,points,cfg,neck,seam,changed,incident,faces,encoded_before,encoded_after):
    if not len(before)==len(after)==len(loops)==len(encoded_before)==len(encoded_after):
        raise ValueError("native corner count changed")
    rows=[];counts={};strict_fail=[]
    for loop,(old,new),encoded in zip(loops,zip(before,after),zip(encoded_before,encoded_after)):
        index,vertex=loop
        delta=vector_delta(old,new)
        if delta["exact"]: continue
        category=regions(points[vertex],vertex,cfg,neck,seam,changed)
        support=incident[vertex]
        adjacent=sorted({v for f in support for v in faces[f]}&changed)
        row={**delta,"cornerIndex":index,"vertexIndex":vertex,"regions":category,
            "incidentFaceIndices":support,"adjacentChangedVertexIndices":adjacent,
            "encodedBefore":encoded[0],"encodedAfter":encoded[1],
            "normalSupportLimit":"incident topology recorded; no inferred Blender smoothing fan"}
        rows.append(row)
        for label in category: counts[label]=counts.get(label,0)+1
        if vertex in neck or vertex not in changed: strict_fail.append(index)
    return {"case":name,"cornerCount":len(loops),"mismatchCount":len(rows),
        "encodedBeforeSha256":digest(encoded_before),"encodedAfterSha256":digest(encoded_after),
        "encodedExact":encoded_before==encoded_after,
        "encodedMismatchCount":sum(a!=b for a,b in zip(encoded_before,encoded_after)),
        "regionCounts":counts,"currentFC1StrictGuardWouldPass":not strict_fail,
        "currentStrictFailureCorners":strict_fail,"maxComponentAbs":max((r["maxComponentAbs"] for r in rows),default=0),
        "maxAngularDegrees":max((r["angularDegrees"] for r in rows if r["angularDegrees"] is not None),default=None),
        "completeMismatches":rows,"normalComparison":"exact components; no tolerance or acceptance waiver"}


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args(argv)
    output=a.out.resolve()
    if output.exists() or not (REPO/"review/rosace/integration/facecage_normals").resolve() in output.parents:
        raise ValueError("fresh private diagnostic root required")
    pipe=REPO/"tools/pixel-pipeline"
    specialist=REPO/"art/rosace/specialists/refinement/facecage"
    sys.path[:0]=[str(pipe),str(pipe/"drive9"),str(pipe/"next"),str(specialist)]
    import nx_hands_blender as H
    import facecage_geometry as G
    import facecage_blender as C
    import mesh_preservation as P
    import bpy
    from rosace import materials,posing
    canonical=Path("D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend")
    if sha(canonical)!=H.EXPECTED_BLEND or sha(pipe/"drive9/r2_model.json")!=H.EXPECTED_MODEL:
        raise ValueError("exact canonical/model input required")
    prior_apply=posing.apply_pose
    owned=[]
    head,original=None,None
    output.mkdir(parents=True)
    record={"schema":"rosace.fc1-normal-diagnostic/1","status":"native-probe-in-progress",
        "failedSource":"bd94059a13d5becd68b80c0d219fdb6ad1d989f9","nativeVersion":bpy.app.version_string,
        "canonicalSha256":H.EXPECTED_BLEND,"modelSha256":H.EXPECTED_MODEL,"renderedImages":0,
        "sourceSha256":{str(path.relative_to(REPO)):sha(path) for path in
            (Path(__file__),specialist/"facecage_geometry.py",specialist/"facecage_blender.py",pipe/"next/nx_hands_blender.py")},
        "cases":[],"guardRelaxed":False,"artAccepted":False}
    try:
        driver=H.library(pipe/"drive9/d9_blender.py","fc1_norm_diagnostic_driver")
        bpy.ops.wm.open_mainfile(filepath=str(canonical))
        materials.rebind()
        import r2_blender,r5_blender
        model=json.loads((pipe/"drive9/r2_model.json").read_text())
        r2_blender.mesh_edits(model.get("mesh_edits"));r2_blender.circlet(model.get("circlet"))
        if model.get("pin"): r5_blender.pin(model["pin"])
        driver.head_scale.install({"head":1.1,"neck_w":.4,"neck_l":1.,"fit_h":True})
        head=bpy.data.objects["head_skin"];rig=bpy.data.objects["rosace_rig"]
        original=head.data
        if original.shape_keys or not original.has_custom_normals:
            raise ValueError("diagnostic must match actual unkeyed custom-normal FC1 head")
        points=tuple(tuple(v.co) for v in original.vertices)
        eyes=[tuple(rig.data.bones[f"J_Adj_{s}_FaceEye"].head_local) for s in "LR"]
        front=[i for i,x in enumerate(points) if abs(x[0])<.012]
        chin=min((i for i in front if points[i][1]<eyes[0][1]+.02),key=lambda i:points[i][2])
        group=head.vertex_groups["J_Bip_C_Neck"]
        seam={v.index for v in original.vertices if any(g.group==group.index and g.weight>0 for g in v.groups)}
        neck=set(seam)
        for edge in original.edges:
            if any(i in seam for i in edge.vertices): neck.update(edge.vertices)
        cfg=G.config(points[chin][2],max(x[2] for x in points),eyes,max(points[i][2] for i in neck)+.001)
        original.calc_loop_triangles()
        candidate,geometry=G.validate(points,[tuple(t.vertices) for t in original.loop_triangles],cfg)
        changed=set(geometry["changedIndices"])
        loops=[(l.index,l.vertex_index) for l in original.loops]
        faces=[list(f.vertices) for f in original.polygons]
        incident=[[] for _ in points]
        for f,vertices in enumerate(faces):
            for v in vertices: incident[v].append(f)
        normals=[tuple(n.vector) for n in original.corner_normals]
        record["nativeAttributeSchema"]=[[x.name,x.domain,x.data_type,len(x.data)] for x in original.attributes]
        def encoded(mesh):
            attr=mesh.attributes.get("custom_normal") or mesh.attributes.get(".custom_normal")
            if attr is None or attr.domain!="CORNER" or len(attr.data)!=len(loops):
                raise ValueError("native encoded corner normal attribute unavailable; report actual schema")
            return [P.typed_value(row) for row in attr.data]
        encoded_original=encoded(original)
        invariant=C.digest(C.invariant(head));norm_sha=digest(normals)
        record.update(config=cfg,geometry=geometry,neckWeightVertexIndices=sorted(seam),
            neckNeighborhoodVertexIndices=sorted(neck),zeroDisplacementVertexIndices=[i for i in range(len(points)) if i not in changed],
            originalDecodedNormalsSha256=norm_sha,originalEncodedNormalsSha256=digest(encoded_original),
            topologySupport="all incident source faces and changed vertices; smoothing fan is not assumed")
        scenarios=("copy-only","copy-update-only","zero-deformation-normal-roundtrip",
                   "deformation-old-encoded-normals","deformation-transport-and-roundtrip")
        for name in scenarios:
            copy=original.copy();owned.append(copy)
            if name.startswith("deformation"):
                for vertex,point in zip(copy.vertices,candidate): vertex.co=point
            if name!="copy-only": copy.update()
            if name=="zero-deformation-normal-roundtrip": copy.normals_split_custom_set(normals);copy.update()
            elif name=="deformation-transport-and-roundtrip":
                transported=[G.transport_normal(points[v],normal,cfg) for (_,v),normal in zip(loops,normals)]
                copy.normals_split_custom_set(transported);copy.update()
            # Match the real FC1 adapter's data assignment before decoded read.
            # Only this private object pointer is temporary; source data is intact.
            head.data=copy
            after=[tuple(n.vector) for n in copy.corner_normals]
            case=report_case(name,normals,after,loops,points,cfg,neck,seam,changed,incident,faces,encoded_original,encoded(copy))
            record["cases"].append(case)
            (output/(name+".json")).write_text(json.dumps(case,indent=2,allow_nan=False),encoding="utf-8")
            print(json.dumps({k:v for k,v in case.items() if k not in ("completeMismatches","currentStrictFailureCorners")}),flush=True)
            head.data=original
            bpy.data.meshes.remove(copy);owned.remove(copy)
        if head.data is not original or tuple(tuple(v.co) for v in original.vertices)!=points or digest([tuple(n.vector) for n in original.corner_normals])!=norm_sha or digest(encoded(original))!=digest(encoded_original) or C.digest(C.invariant(head))!=invariant:
            raise AssertionError("original head changed during disposable probes")
        record.update(status="native-diagnostic-complete-no-render",originalHeadExact=True,
            diagnosis="compare controls against real deformation categories; no causal claim before reading actual case outputs")
    except BaseException as error:
        record.update(status="native-diagnostic-failed",failure=repr(error))
        raise
    finally:
        posing.apply_pose=prior_apply
        if head is not None and original is not None:
            head.data=original
        for mesh in owned:
            if mesh.users: raise AssertionError("disposable probe mesh unexpectedly has users")
            bpy.data.meshes.remove(mesh)
        record["canonicalUnchanged"]=sha(canonical)==H.EXPECTED_BLEND
        (output/"diagnostic.json").write_text(json.dumps(record,indent=2,allow_nan=False),encoding="utf-8")
        if not record["canonicalUnchanged"]: raise AssertionError("canonical blend changed")


if __name__=="__main__":
    main(sys.argv[sys.argv.index("--")+1:])
