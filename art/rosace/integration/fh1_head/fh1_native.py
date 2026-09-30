"""FH1 original field, owned mesh copies, zero normal setter or reset."""
import json
import math
from pathlib import Path

import fh1_boundary as B
import fh1_field as G
import fh1_preserve as P

REPO = Path(__file__).resolve().parents[4]
PRIVATE = REPO / 'review/rosace/integration/fh1_head'
FEATURES = ('ref_eyes', 'ref_eyes_white', 'ref_eyes_highlight', 'ref_eyeblow', 'ref_eyelid', 'ref_eyelush', 'ref_mouth', 'ref_tongue', 'ref_tooth')


def weights(obj):
    names = {g.index: g.name for g in obj.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if g.weight > 0} for v in obj.data.vertices]


def write(path, report):
    if path is None: return
    path = Path(path).resolve()
    if PRIVATE.resolve() not in path.parents or path.exists():
        raise ValueError('fresh executing private FH1 diagnostic required')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(report, indent=2, allow_nan=False) + '\n').encode('utf-8'))


class GeometryFailure(AssertionError):
    def __init__(self, message, report): super().__init__(message); self.report = report


def actual_geometry(before, actual, triangles, cfg, require_change=True):
    expected, report = G.validate(before, triangles, cfg, require_change=require_change)
    if P.native(expected) != actual:
        raise GeometryFailure('native coordinates differ from original field float32 readback', {'expectedSha256': P.digest(P.native(expected)), 'actualSha256': P.digest(actual)})
    changed = {i for i, (a, b) in enumerate(zip(before, actual)) if a != b}
    if not changed and require_change: raise ValueError('native cage changes no geometry')
    for i in changed:
        displacement = math.dist(before[i], actual[i])
        jacobian = G.jacobian(before[i], cfg); det = G.determinant(jacobian)
        if not math.isfinite(det) or not .35 < det < 2.0 or displacement > .17 * cfg['span']:
            raise GeometryFailure('unchanged original geometry bound failed on native readback', {'vertexIndex': i, 'original': before[i], 'actual': actual[i], 'jacobian': jacobian, 'determinant': det, 'displacementMeters': displacement, 'bounds': {'detLowerExclusive': .35, 'detUpperExclusive': 2.0, 'displacementSpanMaximum': .17}})
    def normal(a, b, c):
        u = [b[i]-a[i] for i in range(3)]; v = [c[i]-a[i] for i in range(3)]
        return (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
    for ti, (a, b, c) in enumerate(triangles):
        if not {a, b, c} & changed: continue
        old = normal(before[a], before[b], before[c]); new = normal(actual[a], actual[b], actual[c])
        aa, bb = sum(x*x for x in old), sum(x*x for x in new)
        if aa <= 1e-18 or bb < .20*aa or sum(x*y for x,y in zip(old,new)) <= 0:
            raise GeometryFailure('unchanged triangle bound fails native readback', {'triangleIndex': ti, 'vertices': [a,b,c], 'oldNormal': old, 'actualNormal': new, 'oldSquaredArea': aa, 'actualSquaredArea': bb})
    report.update(nativeFloat32ReadbackExact=True, actualChangedVertexIndices=sorted(changed), actualChangedVertexCount=len(changed), maxNativeDisplacementMeters=max((math.dist(before[i],actual[i]) for i in changed), default=0), originalSafetyBoundsUnchanged=True)
    return report


def original_token(obj, mesh):
    schema, pairs = P.encoded(mesh, required=obj.name == 'head_skin')
    return P.digest({'invariant': P.invariant(obj, mesh), 'coordinates': P.points(mesh), 'decoded': P.decoded(mesh), 'encodedSchema': schema, 'encodedPairs': pairs})


def recheck_originals(state):
    failures = []
    expected_owned={obj.name:owned for obj,original,owned in state.get('handles',[])}
    for obj, mesh, token in state.get('originals', []):
        if obj.data is not expected_owned.get(obj.name,mesh) or original_token(obj, mesh) != token: failures.append(obj.name)
    if failures: raise AssertionError('complete original typed/coordinates/normals snapshot drift: ' + ','.join(failures))
    return {'allOriginalMeshCount': len(state.get('originals', [])), 'completeOriginalReadbackExact': True}


def restore(state):
    if not state: return
    import bpy
    handles = list(reversed(state.get('handles', []))); errors = []
    # Restore all pointers before attempting deletion, even if one removal fails.
    for obj, original, owned in handles:
        try: obj.data = original
        except BaseException as error: errors.append(repr(error))
    for obj, original, owned in handles:
        try: bpy.data.meshes.remove(owned)
        except BaseException as error: errors.append(repr(error))
    state['cleanup'] = {'attemptedOwnedMeshes': len(handles), 'pointerMismatchNames': [o.name for o,m,c in handles if o.data is not m], 'errors': errors}
    state['cleanup']['allOriginalPointerMismatchNames']=[obj.name for obj,mesh,token in state.get('originals',[]) if obj.data is not mesh]
    state['cleanup']['derivedRuntimeMetadataAfter']={obj.name:P.derived_runtime(obj) for obj,mesh,token in state.get('originals',[])}
    state['handles'] = []
    try: state['cleanup']['originals'] = recheck_originals(state)
    except BaseException as error: errors.append(repr(error))
    if errors: raise RuntimeError('FH1 cleanup attempted all pointers/owned meshes: ' + '; '.join(errors))


def install(enabled, diagnostic_output=None):
    if not enabled:
        return {'handles': [], 'enabled': False, 'report': {'enabled': False, 'copiedMeshes': 0}}
    import bpy
    state = {'handles': [], 'originals': [], 'enabled': True, 'report': {'enabled': True, 'status': 'FH1-install-in-progress', 'renderedCandidateImages': 0, 'nativeVersion': bpy.app.version_string, 'objects': {}, 'method': 'original unattenuated bd field; complete authored INT16_2D retained; no normal setter/reset; nonanatomical decoded changes declared'}}
    try:
        rig = bpy.data.objects['rosace_rig']; head = bpy.data.objects['head_skin']; body = bpy.data.objects['body']
        eyes = [tuple(rig.data.bones[f'J_Adj_{s}_FaceEye'].head_local) for s in 'LR']
        hp, bp = P.points(head.data), P.points(body.data)
        hw, bw = weights(head), weights(body)
        seam, anatomy = B.anatomy(hp, [tuple(e.vertices) for e in head.data.edges], hw)
        boundary = B.identify(hp, [tuple(p.vertices) for p in head.data.polygons], bp, [tuple(p.vertices) for p in body.data.polygons], hw, bw)
        state['report']['constructionInterface'] = boundary
        protected = anatomy | set(boundary['headCutRingIndices'])
        front = [i for i,p in enumerate(hp) if abs(p[0]) < .012]
        chin = min((i for i in front if hp[i][1] < eyes[0][1]+.02), key=lambda i: hp[i][2])
        eye_z = sum(e[2] for e in eyes)/2
        nose = min((i for i in front if hp[i][2] < hp[chin][2]+.8*(eye_z-hp[chin][2])), key=lambda i: hp[i][1])
        # This is the ORIGINAL bd config, including its anatomical neck bound.
        # No polygon-star expansion, back/crown change or amplitude retune.
        cfg = G.config(hp[chin][2], max(p[2] for p in hp), eyes, max(hp[i][2] for i in anatomy)+.001)
        state.update(config=cfg, eyes=dict(zip('LR', eyes)), noseId=nose, chinId=chin)
        state['report'].update(config=cfg, positiveNeckVertexIndices=sorted(seam), neckNeighborhoodVertexIndices=sorted(anatomy), protectedInterfaceAnatomyVertexIndices=sorted(protected), originalP0CountDisclosed=sum(G.move(p,cfg)==p for p in hp), original941P0DecodedGuardInherited=False)
        if not all(n in bpy.data.objects for n in FEATURES): raise ValueError('ALL actual canonical feature references required')
        objects = [head] + [bpy.data.objects[n] for n in FEATURES]
        rig_before = P.rig_snapshot(rig)
        # Read every original render/reference mesh, not merely the copied head.
        for obj in bpy.data.objects:
            if obj.type == 'MESH': state['originals'].append((obj, obj.data, original_token(obj, obj.data)))
        state['report']['derivedRuntimeMetadataBefore']={obj.name:P.derived_runtime(obj) for obj,mesh,token in state['originals']}
        originals = {obj.name: P.snapshot(obj) for obj in objects}
        if len(originals['head_skin']['pairs']) != 5120:
            raise ValueError('actual canonical head must retain all5120 authored encoded pairs')
        for obj in objects:
            state['report']['currentObject'] = obj.name
            original = obj.data; before = originals[obj.name]
            if original.shape_keys or obj.parent is not rig or len(obj.modifiers) != 1 or obj.modifiers[0].type != 'ARMATURE' or obj.modifiers[0].object is not rig:
                raise ValueError('original unkeyed head/ref with sole canonical Armature required')
            if obj is head and not original.has_custom_normals:
                raise ValueError('authored custom head normals required')
            if [list(r) for r in obj.matrix_world] != [[int(r==c) for c in range(4)] for r in range(4)]:
                raise ValueError('exact identity rest object transform required')
            if obj is not head and (not obj.hide_render or obj.get('part') != 'head_ref'):
                raise ValueError('actual feature references must retain hidden head_ref state')
            original.calc_loop_triangles(); tris = [tuple(t.vertices) for t in original.loop_triangles]
            target, preliminary = G.validate(before['coordinates'], tris, cfg, require_change=obj is head)
            owned = original.copy(); state['handles'].append((obj, original, owned))
            for vertex, point in zip(owned.vertices, target): vertex.co = point
            owned.update(); obj.data = owned
            actual = P.points(owned)
            geometry = actual_geometry(before['coordinates'], actual, tris, cfg, require_change=obj is head)
            object_protected = protected if obj is head else B.anatomy(before['coordinates'], [tuple(e.vertices) for e in owned.edges], weights(obj))[1] if any(r.get('J_Bip_C_Neck',0)>0 for r in weights(obj)) else set()
            if any(actual[i] != before['coordinates'][i] for i in object_protected):
                raise AssertionError('actual anatomy/interface coordinates changed')
            normal_report = P.normals_report(owned, before, actual, object_protected, cfg, G)
            if P.invariant(obj, allow_position=True) != before['outside']:
                raise AssertionError('copied full typed outside/schema/UV/weights/topology/material/modifier/hidden invariant changed')
            state['report']['objects'][obj.name] = {'geometry': geometry, 'normals': normal_report, 'originalCoordinateSha256': P.digest(before['coordinates']), 'actualCoordinateSha256': P.digest(actual), 'outsideInvariantSha256': P.digest(before['outside']), 'finalSharedConfig': cfg, 'hidden': obj.hide_render}
        # Re-identify paired interface on actual native readback, without a
        # cross-object normal equality claim or a generated index map.
        actual_boundary = B.identify(P.points(head.data), [tuple(p.vertices) for p in head.data.polygons], P.points(body.data), [tuple(p.vertices) for p in body.data.polygons], weights(head), weights(body))
        if actual_boundary != boundary: raise AssertionError('actual construction interface membership changed')
        if P.rig_snapshot(rig) != rig_before: raise AssertionError('rest rig/eye bones/head metrics or constraints changed during candidate installation')
        state['report'].update(recheck_originals(state), constructionInterfaceAfter=actual_boundary, interfaceCoordinatesDecodedEncodedExact=True, fullEncodedNormalsExact=True, positiveNeckNeighborhoodDecodedEncodedExact=True, rigBeforeSha256=P.digest(rig_before), rigAfterSha256=P.digest(P.rig_snapshot(rig)), status='native-candidate-guards-passed-before-first-image', copiedMeshes=len(objects), normalSetterOrResetCalls=0, noArtAcceptance=True)
        write(diagnostic_output, state['report'])
        return state
    except BaseException as error:
        if hasattr(error, 'report'): state['report']['failureDetail'] = error.report
        state['report'].update(status='FH1-rejected-before-candidate-image', failure=repr(error))
        try: restore(state)
        except BaseException as cleanup: state['report']['cleanupFailure'] = repr(cleanup)
        state['report']['cleanup'] = state.get('cleanup')
        write(diagnostic_output, state['report'])
        raise


def placement(state, scene):
    import bpy
    from mathutils import Vector
    from rosace import render
    rig = bpy.data.objects['rosace_rig']; bone = rig.pose.bones['J_Bip_C_Head']
    matrix = rig.matrix_world @ bone.matrix @ bone.bone.matrix_local.inverted()
    result = {'eyes': {side: render.project(scene, matrix @ Vector(G.move(p,state['config']))) for side,p in state['eyes'].items()}}
    obj = bpy.data.objects['head_skin'].evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = obj.to_mesh()
    try:
        for name,index in (('nose',state['noseId']), ('chin',state['chinId'])):
            result[name] = render.project(scene, obj.matrix_world @ mesh.vertices[index].co)
    finally: obj.to_mesh_clear()
    return result
