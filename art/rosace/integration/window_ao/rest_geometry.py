"""Native active-relative-shape rest geometry, evaluated on owned copies only.

Armature, Solidify, every other modifier, constraints and parent/object
animation are stripped from the temporary object. Blender retains original
relative shape settings/group masks. Absolute or driven shape contexts fail.
No visible mesh, original key value or original modifier is changed.
"""
import hashlib
import json
import sys
from pathlib import Path
import geometry as G

REPO=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(REPO/'tools/pixel-pipeline/next'))
import mesh_preservation as P

POINT_ID='__rosace_ao_rest_source_point'
FACE_ID='__rosace_ao_rest_source_face'


def digest(rows):
    h=hashlib.sha256()
    for row in rows:
        raw=json.dumps(row,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
        h.update(len(raw).to_bytes(8,'big')); h.update(raw)
    return h.hexdigest()


def shape_state(ob):
    me=ob.data; keys=me.shape_keys
    if ob.mode!='OBJECT' or getattr(me,'is_editmode',False):
        raise ValueError('rest shape evaluation requires Object-mode source data')
    if getattr(me,'animation_data',None) or keys and keys.animation_data:
        raise ValueError('animated/driven mesh or shape keys need an explicit rest-evaluation contract')
    if keys and not keys.use_relative:
        raise ValueError('absolute shape keys unsupported in bounded relative-shape rest evaluation')
    if ob.show_only_shape_key:
        raise ValueError('show-only/pinned shape evaluation needs an explicit native contract')
    if keys:
        G.finite([keys.eval_time])
    groups=[g.name for g in ob.vertex_groups]
    blocks=[]
    for key in ([] if keys is None else keys.key_blocks):
        if len(key.data)!=len(me.vertices) or key.relative_key is None:
            raise ValueError('shape-key source-index/relative identity mismatch')
        if key.vertex_group and key.vertex_group not in groups:
            raise ValueError('shape-key vertex-group mask is missing from source')
        G.finite([key.value,key.slider_min,key.slider_max,key.frame])
        blocks.append({'name':key.name,'relative':key.relative_key.name,'value':float(key.value),
                       'mute':bool(key.mute),'interpolation':key.interpolation,'vertexGroup':key.vertex_group,
                       'sliderMin':float(key.slider_min),'sliderMax':float(key.slider_max),'frame':float(key.frame),
                       'coordinatesSha256':digest(P.plain(v.co) for v in key.data)})
    active=int(ob.active_shape_key_index)
    if keys and not 0<=active<len(blocks):
        raise ValueError('invalid active native shape-key index')
    return {'useRelative':None if keys is None else bool(keys.use_relative),
            'evalTime':None if keys is None else float(keys.eval_time),
            'activeShapeKeyIndex':active,'showOnlyShapeKey':bool(ob.show_only_shape_key),
            'groups':groups,'weightsSha256':digest([(g.group,g.weight) for g in v.groups] for v in me.vertices),
            'blocks':blocks}


def source_state(ob):
    me=ob.data
    return {'objectPointer':ob.as_pointer(),'meshPointer':me.as_pointer(),
            'world':P.plain(ob.matrix_world),'shape':shape_state(ob),
            'vertices':digest([P.plain(v.co),P.plain(v.normal)] for v in me.vertices),
            'faces':digest([list(f.vertices),list(f.loop_indices),f.material_index,bool(f.use_smooth)] for f in me.polygons),
            'attributes':[[a.name,a.domain,a.data_type,bool(a.is_required),
                           digest(P.typed_value(v) for v in a.data)] for a in me.attributes],
            'modifiers':[[m.name,m.type,m.as_pointer()] for m in ob.modifiers],
            'constraints':[[c.name,c.type,c.as_pointer()] for c in ob.constraints],
            'parentPointer':None if ob.parent is None else ob.parent.as_pointer(),
            'objectAnimationPointer':None if ob.animation_data is None else ob.animation_data.as_pointer()}


def validate_identity(source,evaluated):
    if len(source.vertices)!=len(evaluated.vertices) or len(source.polygons)!=len(evaluated.polygons) or len(source.loops)!=len(evaluated.loops):
        raise AssertionError('rest evaluation changed source vertex/face/corner counts')
    for name,domain,count in ((POINT_ID,'POINT',len(source.vertices)),(FACE_ID,'FACE',len(source.polygons))):
        attr=evaluated.attributes.get(name)
        if attr is None or attr.domain!=domain or attr.data_type!='INT' or len(attr.data)!=count:
            raise AssertionError('rest evaluation lost exact source-index stamp')
        if [v.value for v in attr.data]!=list(range(count)):
            raise AssertionError('rest evaluation reordered/changed source-index stamp')
    if any(list(a.vertices)!=list(b.vertices) or list(a.loop_indices)!=list(b.loop_indices)
           for a,b in zip(source.polygons,evaluated.polygons)):
        raise AssertionError('rest evaluation changed oriented original face/corner identities')
    if any(a.vertex_index!=b.vertex_index or a.edge_index!=b.edge_index for a,b in zip(source.loops,evaluated.loops)):
        raise AssertionError('rest evaluation changed native corner source association')


def evaluate(ob):
    import bpy
    if ob.type!='MESH':
        raise ValueError('native rest geometry source must be a mesh')
    before=source_state(ob); world=ob.matrix_world.copy()
    if any(ob.data.attributes.get(name) is not None for name in (POINT_ID,FACE_ID)):
        raise ValueError('source already uses reserved temporary source-index names')
    temporary=None; owned_mesh=None; evaluated=None; key_identity=None
    errors=[]
    try:
        temporary=ob.copy()
        temporary.name='__rosace_ao_rest_'+ob.name
        owned_mesh=ob.data.copy()
        temporary.data=owned_mesh
        if owned_mesh.as_pointer()==ob.data.as_pointer():
            raise AssertionError('rest evaluator did not receive an owned mesh copy')
        if ob.data.shape_keys:
            if not owned_mesh.shape_keys or owned_mesh.shape_keys.as_pointer()==ob.data.shape_keys.as_pointer():
                raise AssertionError('rest evaluator needs independent copied shape-key data')
            key_identity=(owned_mesh.shape_keys.name,owned_mesh.shape_keys.as_pointer())
        temporary.modifiers.clear()
        temporary.constraints.clear()
        temporary.animation_data_clear()
        temporary.parent=None
        temporary.matrix_world=world
        temporary.hide_render=True
        temporary.hide_viewport=False
        if shape_state(temporary)!=before['shape']:
            raise AssertionError('temporary native shape settings/group masks differ from original')
        for name,domain,count in ((POINT_ID,'POINT',len(owned_mesh.vertices)),(FACE_ID,'FACE',len(owned_mesh.polygons))):
            stamp=owned_mesh.attributes.new(name=name,type='INT',domain=domain)
            if stamp.name!=name or stamp.domain!=domain or stamp.data_type!='INT':
                raise AssertionError('native temporary source-index schema mismatch')
            stamp.data.foreach_set('value',list(range(count)))
        bpy.context.scene.collection.objects.link(temporary)
        bpy.context.view_layer.update()
        # hide_set needs an Object Base in the current view layer. An Object
        # copy is unlinked until the preceding link/update completes.
        temporary.hide_set(False)
        depsgraph=bpy.context.evaluated_depsgraph_get()
        if temporary.modifiers or temporary.constraints or temporary.parent or temporary.animation_data:
            raise AssertionError('rest evaluator still has pose/modifier/constraint dependencies')
        if P.plain(temporary.matrix_world)!=before['world']:
            raise AssertionError('temporary rest world transform differs exactly')
        evaluated=temporary.evaluated_get(depsgraph)
        if P.plain(evaluated.matrix_world)!=before['world']:
            raise AssertionError('evaluated rest world transform differs exactly')
        mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=depsgraph)
        if mesh is None:
            raise ValueError('native shape-only evaluation returned no mesh')
        validate_identity(ob.data,mesh)
        normal_world=world.to_3x3().inverted().transposed()
        vertices=[list(world@v.co) for v in mesh.vertices]
        vertex_normals=[list((normal_world@v.normal).normalized()) for v in mesh.vertices]
        face_normals=[list((normal_world@f.normal).normalized()) for f in mesh.polygons]
        for p in vertices+vertex_normals+face_normals:
            G.finite(p)
        faces=[list(f.vertices) for f in mesh.polygons]
        basis_world=[list(world@v.co) for v in ob.data.vertices]
        displacements=[math_distance(a,b) for a,b in zip(vertices,basis_world)]
        result={'name':ob.name,'vertices':vertices,'vertexNormals':vertex_normals,
                'faceNormals':face_normals,'faces':faces,'shapeState':before['shape'],
                'world':before['world'],'geometrySourceSha256':digest([vertices,vertex_normals,faces,face_normals,before['shape'],before['world']]),
                'changedFromBasisVertices':sum(a!=b for a,b in zip(vertices,basis_world)),
                'maxWorldDisplacementFromBasisMeters':max(displacements,default=0.0),
                'sourceIndexIdentity':'exact POINT/FACE index stamps plus oriented face/corner topology, no topology change',
                'method':'Blender active relative shape mix on owned object+mesh+key copies; original show_only/active/mute/group/settings preserved; all modifiers/constraints/object animation/parent stripped; original world transform exact'}
    finally:
        if evaluated is not None:
            try:
                evaluated.to_mesh_clear()
            except Exception as error:
                errors.append('evaluated mesh release: '+str(error))
        if temporary is not None:
            try:
                bpy.data.objects.remove(temporary,do_unlink=True)
            except Exception as error:
                errors.append('owned rest object removal: '+str(error))
        if owned_mesh is not None:
            try:
                if owned_mesh.users:
                    raise AssertionError('owned rest mesh still has users')
                bpy.data.meshes.remove(owned_mesh)
            except Exception as error:
                errors.append('owned rest mesh removal: '+str(error))
        if key_identity is not None:
            try:
                key=bpy.data.shape_keys.get(key_identity[0])
                if key is not None:
                    if key.as_pointer()!=key_identity[1] or key.users:
                        raise AssertionError('owned rest key identity/users changed during cleanup')
                    bpy.data.shape_keys.remove(key)
            except Exception as error:
                errors.append('owned rest shape-key removal: '+str(error))
        try:
            if source_state(ob)!=before:
                raise AssertionError('rest evaluation mutated original source/key/modifier/transform data')
        except Exception as error:
            errors.append('original source guard: '+str(error))
        if errors:
            raise RuntimeError('native rest geometry cleanup failed: '+'; '.join(errors))
    return result


def math_distance(a,b):
    import math
    value=math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))
    G.finite([value])
    return value
