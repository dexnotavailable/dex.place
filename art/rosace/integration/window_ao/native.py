"""Delivery-only real native AO patch, strict typed preservation and readback."""
import hashlib
import json
import math
import sys
import struct
from pathlib import Path
import geometry as G
import rest_geometry as REST

REPO=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(REPO/'tools/pixel-pipeline/next'))
import mesh_preservation as P


def hash_rows(rows):
    digest=hashlib.sha256()
    for row in rows:
        data=json.dumps(row,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
        digest.update(len(data).to_bytes(8,'big')); digest.update(data)
    return digest.hexdigest()


def scalar_attr(me,name):
    a=me.attributes.get(name)
    if a is None or a.domain!='POINT' or a.data_type!='FLOAT' or len(a.data)!=len(me.vertices):
        raise ValueError(f'required exact FLOAT/POINT {name}')
    for row in a.data:
        value=P.typed_value(row)
        if set(value)!={'value'} or value['value']['rnaType']!='FLOAT' or value['value']['array']:
            raise ValueError(f'unsupported {name} native typed schema')
        G.finite([value['value']['value']])
        if not 0<=value['value']['value']<=1:
            raise ValueError(f'{name} native scalar outside canonical0..1')
    return a


def snapshot(ob,allowed=()):
    """Streaming native hashes; only selected named ao payloads may be omitted."""
    me=ob.data; allowed=set(allowed)
    if me.shape_keys and me.shape_keys.animation_data:
        raise ValueError('animated body shape keys unsupported for exact AO diagnostic')
    if not hasattr(me,'corner_normals') or not hasattr(me,'has_custom_normals'):
        raise ValueError('decoded native corner normal snapshot unavailable')
    decoded=hash_rows(P.plain(n.vector) for n in me.corner_normals)
    uv=[]
    for layer in me.uv_layers:
        uv.append((layer.name,bool(layer.active_render),bool(layer.active_clone),
                   hash_rows(P.typed_value(row) for row in layer.data)))
    schemas=[]; attrs=[]
    for a in me.attributes:
        if a.domain not in ('POINT','EDGE','FACE','CORNER'):
            raise ValueError(f'unsupported native domain {a.name}/{a.domain}')
        schemas.append([a.name,a.domain,a.data_type,bool(a.is_required),len(a.data)])
        attrs.append((a.name,hash_rows(P.typed_value(row) for i,row in enumerate(a.data)
                                     if not (a.name=='ao' and i in allowed))))
    result={
        'schema':schemas,'attributes':attrs,'uv':uv,
        'positionsNormalsWeights':hash_rows([P.plain(v.co),P.plain(v.normal),[(g.group,g.weight) for g in v.groups]] for v in me.vertices),
        'edges':hash_rows([list(e.vertices),bool(e.use_seam),bool(e.use_edge_sharp)] for e in me.edges),
        'faces':hash_rows([list(f.vertices),list(f.loop_indices),f.material_index,bool(f.use_smooth),P.plain(f.normal)] for f in me.polygons),
        'loops':hash_rows([l.vertex_index,l.edge_index] for l in me.loops),
        'decodedCornerNormals':decoded,'hasCustomNormals':bool(me.has_custom_normals),
        'keys':None if not me.shape_keys else {
            'mode':[me.shape_keys.use_relative,me.shape_keys.eval_time],
            'blocks':[[k.name,k.relative_key.name,k.value,k.mute,k.interpolation,k.vertex_group,k.slider_min,k.slider_max,
                       hash_rows(P.plain(v.co) for v in k.data)] for k in me.shape_keys.key_blocks]},
        'groups':[g.name for g in ob.vertex_groups],
        'materials':[[m.name,m.as_pointer()] if m else None for m in me.materials],
        'object':{'name':ob.name,'pointer':ob.as_pointer(),'matrix':P.plain(ob.matrix_world),
                  'matrixLocal':P.plain(ob.matrix_local),'matrixBasis':P.plain(ob.matrix_basis),
                  'matrixParentInverse':P.plain(ob.matrix_parent_inverse),
                  'parent':None if ob.parent is None else [ob.parent.name,ob.parent.as_pointer()],
                  'parentType':ob.parent_type,'parentBone':ob.parent_bone,
                  'location':P.plain(ob.location),'scale':P.plain(ob.scale),
                  'rotationMode':ob.rotation_mode,'rotationEuler':P.plain(ob.rotation_euler),
                  'rotationQuaternion':P.plain(ob.rotation_quaternion),'rotationAxisAngle':P.plain(ob.rotation_axis_angle),
                  'deltaLocation':P.plain(ob.delta_location),'deltaScale':P.plain(ob.delta_scale),
                  'deltaRotationEuler':P.plain(ob.delta_rotation_euler),'deltaRotationQuaternion':P.plain(ob.delta_rotation_quaternion),
                  'activeShapeKeyIndex':ob.active_shape_key_index,'showOnlyShapeKey':ob.show_only_shape_key,
                  'part':ob.get('part'),'passIndex':ob.pass_index,
                  'properties':properties(dict(ob.items())),
                  'meshProperties':properties(dict(me.items()))},
    }
    # P.plain handles iterable numeric values; mappings need explicit recursion.
    return result


def properties(value):
    if isinstance(value,dict):
        return {str(k):properties(v) for k,v in value.items()}
    if hasattr(value,'items'):
        return {str(k):properties(v) for k,v in value.items()}
    return P.plain(value)


def assert_preserved(before,after):
    if before!=after:
        fields=[k for k in before if before.get(k)!=after.get(k)]
        raise AssertionError('native body changed outside selected ao: '+','.join(fields))


def install(ring,window,state):
    import bpy
    from mathutils.bvhtree import BVHTree
    from mathutils import Vector
    from rosace import bake,render
    body=bpy.data.objects['body']
    if not window['retainedFacePreservation']['exactSemanticEqual']:
        raise AssertionError('unmodified strict W2 guard must finish first')
    if body.get('no_ao'):
        raise ValueError('body disables AO; cannot retune authored semantics')
    dist=float(body.get('ao_dist',.075)); strength=float(body.get('ao_strength',.9))
    if dist!=.075 or strength!=.9:
        raise ValueError('unexpected native body settings; preserve and report, never retune')
    original=body.data
    ao=scalar_attr(original,'ao'); crease=original.attributes.get('crease')
    if crease:
        scalar_attr(original,'crease')
    occluders=render.render_objects(bpy.context.scene)
    if body not in occluders or ring not in occluders or bpy.data.objects['bodice'] not in occluders:
        raise ValueError('actual body/cut bodice/gold ring must be visible base occluders')
    rest={ob.name:REST.evaluate(ob) for ob in occluders}
    body_geometry=rest[body.name]; ring_geometry=rest[ring.name]
    if any(k['name']=='figure_bust' and k['value']!=0 and not k['mute']
           for k in body_geometry['shapeState']['blocks']) and not body_geometry['changedFromBasisVertices']:
        raise AssertionError('active current figure_bust returned Basis geometry')
    vertices=body_geometry['vertices']; faces=body_geometry['faces']; normals=body_geometry['faceNormals']
    count=len(ring.data.vertices)//2
    if len(ring.data.vertices)!=2*count or count<3 or not ring.get('window2_rim'):
        raise ValueError('actual preserved W2 ring identity/count required')
    inner=ring_geometry['vertices'][:count]
    plan=G.select(vertices,faces,normals,inner,dist)
    selected=plan['selectedPoints']
    before=snapshot(body,selected); original_exact=snapshot(body)
    state.update(body=body,originalBody=original,originalBodySnapshot=original_exact)
    old=[float(ao.data[i].value) for i in selected]
    candidate=original.copy(); state['bodyCopy']=candidate
    candidate.name='rosace_open_window_ao_private_body'
    body.data=candidate
    assert_preserved(before,snapshot(body,selected))
    verts=[]; polys=[]; sources=[]
    for ob in occluders:
        base=len(verts); geometry=rest[ob.name]
        positions=geometry['vertices']
        polygons=[[base+i for i in f] for f in geometry['faces']]
        verts.extend(positions); polys.extend(polygons)
        sources.append({'name':ob.name,'vertices':len(positions),'faces':len(polygons),
                        'geometrySha256':geometry['geometrySourceSha256'],
                        'changedFromBasisVertices':geometry['changedFromBasisVertices'],
                        'maxWorldDisplacementFromBasisMeters':geometry['maxWorldDisplacementFromBasisMeters'],
                        'shapeState':geometry['shapeState'],'sourceIndexIdentity':geometry['sourceIndexIdentity'],
                        'restMethod':geometry['method']})
    bvh=BVHTree.FromPolygons(verts,polys)
    directions=bake.hemisphere_dirs(24)
    if len(directions)!=24:
        raise ValueError('canonical deterministic hemisphere changed')
    field=scalar_attr(candidate,'ao'); values=[]; ray_receipts=[]
    for i in selected:
        p=Vector(vertices[i]); n=Vector(body_geometry['vertexNormals'][i])
        G.finite([*p,*n])
        if n.length<.5:
            raise ValueError('selected body point has invalid world normal')
        q=n.to_track_quat('Z','Y').to_matrix(); origin=p+n*.0015
        distances=[]
        for direction in directions:
            w=q@direction; G.finite(w)
            hit,_,_,distance=bvh.ray_cast(origin,w,dist)
            distances.append(None if hit is None else float(distance))
        cv=0.0 if crease is None else float(candidate.attributes['crease'].data[i].value)
        value=G.ray_value(distances,dist,strength,cv)
        field.data[i].value=value
        readback=float(field.data[i].value)
        if readback!=struct.unpack('f',struct.pack('f',value))[0]:
            raise AssertionError('native FLOAT AO readback differs from calculated float32')
        values.append(readback)
        ray_receipts.append({'index':i,'old':old[len(values)-1],'newNative':values[-1],
                            'calculated':value,'crease':cv,'distance':dist,'strength':strength,
                            'origin':list(origin),'worldNormal':list(n),'hitDistances':distances})
    candidate.update()
    if [float(candidate.attributes['ao'].data[i].value) for i in selected]!=values:
        raise AssertionError('native selected AO changed after mesh update')
    assert_preserved(before,snapshot(body,selected))
    body.data=original
    try:
        assert_preserved(original_exact,snapshot(body))
    finally:
        body.data=candidate
    report={'kind':'bounded physical AO cache recomputation after real W2 opening',
            'nativeVersion':bpy.app.version_string,'plan':plan,'restInnerWorld':inner,
            'bodyGeometrySourceSha256':body_geometry['geometrySourceSha256'],
            'bodyRestShapeState':body_geometry['shapeState'],'ringRestShapeState':ring_geometry['shapeState'],
            'preservedOutsideSelectedAoSha256':hash_rows([before]),
            'originalExactSha256':hash_rows([original_exact]),
            'fieldSourceSha256':hash_rows([sources,list(map(list,directions)),plan,dist,strength,.0015]),
            'nativeSelectedAoSha256':hash_rows(zip(selected,values)),
            'occluders':sources,'occluderSemantics':'actual render-visible active-relative-shape REST meshes on owned temporary copies; no Armature/Solidify/other modifiers, constraints, parent or hidden references',
            'rays':24,'originOffsetMeters':.0015,'bodyAoDistance':dist,'bodyAoStrength':strength,
            'points':ray_receipts,'schema':before['schema'],'paletteSha256':hashlib.sha256((REPO/'art/rosace/palette.json').read_bytes()).hexdigest(),
            'preservation':'exact native typed schema/payload/topology/decoded normals/UV/keys/weights/transforms/materials/IDs; only named ao selected indices differ',
            'cause':'stale closed-clothing AO hypothesis; no causal/quality verdict from this receipt'}
    state['aoReport']=report
    return report


def restore(state):
    if 'originalBody' not in state:
        return
    import bpy
    state['body'].data=state['originalBody']
    error=None
    try:
        assert_preserved(state['originalBodySnapshot'],snapshot(state['body']))
    except Exception as failure:
        error=failure
    copy=state.get('bodyCopy')
    if copy is not None:
        if copy.users:
            raise AssertionError('private body mesh still has users after restoration')
        bpy.data.meshes.remove(copy)
    if error:
        raise error
