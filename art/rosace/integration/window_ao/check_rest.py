"""Injected CPU fixtures run actual shape-only rest helper and its cleanup.

The fake evaluator supplies nonzero relative/group/muted shape geometry;
this proves helper input/mapping/control flow, never Blender execution.
"""
import copy
import math
import sys
import types
import rest_geometry as R


class Vec(list):
    def normalized(self):
        length=math.sqrt(sum(v*v for v in self))
        return Vec(v/length for v in self) if length else Vec(self)


class Matrix(list):
    def copy(self):
        return Matrix([list(r) for r in self])
    def to_3x3(self):
        return Matrix([row[:3] for row in self[:3]])
    def inverted(self):
        # Fixture uses known identity transform only.
        assert self==[[1,0,0],[0,1,0],[0,0,1]]
        return self.copy()
    def transposed(self):
        return Matrix([list(r) for r in zip(*self)])
    def __matmul__(self,value):
        values=list(value)+([1] if len(self)==4 else [])
        return Vec(sum(a*b for a,b in zip(row,values)) for row in self[:3])


class ID:
    def as_pointer(self):
        return id(self)


class Rows(list):
    def foreach_set(self,name,values):
        assert len(self)==len(values)
        for row,value in zip(self,values):
            setattr(row,name,value)


class Attr:
    def __init__(self,name,domain,count):
        self.name=name; self.domain=domain; self.data_type='INT'; self.is_required=False
        rna=types.SimpleNamespace(properties=[types.SimpleNamespace(identifier='value',type='INT',is_array=False)])
        self.data=Rows(types.SimpleNamespace(value=0,bl_rna=rna) for _ in range(count))


class Attrs(list):
    def __init__(self,mesh):
        super().__init__(); self.mesh=mesh
    def get(self,name):
        return next((a for a in self if a.name==name),None)
    def new(self,name,type,domain):
        assert type=='INT'
        attr=Attr(name,domain,len(self.mesh.vertices) if domain=='POINT' else len(self.mesh.polygons))
        self.append(attr); return attr


def fixture(failure=None):
    objects={}; meshes={}; keys={}; removed={'objects':0,'meshes':0,'keys':0,'evaluated':0}
    linked_objects=set(); layer_objects=set()
    class KeyData(ID):
        def __init__(self):
            self.name='source-keys'; self.users=1; self.animation_data=None; self.use_relative=True; self.eval_time=0.0
            basis=types.SimpleNamespace(name='Basis',value=0.0,mute=False,interpolation='KEY_LINEAR',vertex_group='',slider_min=0.0,slider_max=1.0,frame=0.0,
                data=[types.SimpleNamespace(co=Vec(p)) for p in ([0,0,0],[1,0,0],[0,0,1])])
            basis.relative_key=basis
            bust=copy.deepcopy(basis); bust.name='figure_bust'; bust.relative_key=basis; bust.value=1.0; bust.data[2].co[1]=.04
            muted=copy.deepcopy(basis); muted.name='muted'; muted.relative_key=basis; muted.value=1.0; muted.mute=True
            for p in muted.data:
                p.co[1]=.2
            mask=copy.deepcopy(basis); mask.name='masked'; mask.relative_key=basis; mask.value=1.0; mask.vertex_group='front'
            for p in mask.data:
                p.co[1]=.08
            self.key_blocks=[basis,bust,muted,mask]
    class Mesh(ID):
        def __init__(self):
            self.name='source-mesh'; self.users=0; self.shape_keys=KeyData(); keys[self.shape_keys.name]=self.shape_keys
            self.animation_data=None; self.is_editmode=False
            self.vertices=[types.SimpleNamespace(co=Vec(p),normal=Vec([0,-1,0]),groups=[types.SimpleNamespace(group=0,weight=w)])
                           for p,w in zip(([0,0,0],[1,0,0],[0,0,1]),(.25,.5,.75))]
            self.polygons=[types.SimpleNamespace(vertices=[0,1,2],loop_indices=[0,1,2],material_index=0,use_smooth=False,normal=Vec([0,-1,0]))]
            self.loops=[types.SimpleNamespace(vertex_index=i,edge_index=i) for i in range(3)]
            self.attributes=Attrs(self)
        def copy(self):
            result=copy.deepcopy(self); result.name='owned-mesh'; result.users=0
            result.shape_keys.name='owned-keys'; result.shape_keys.users=1
            meshes[result.name]=result; keys[result.shape_keys.name]=result.shape_keys
            return result
    class Object(ID):
        def __init__(self,mesh):
            self.name='source-body'; self.type='MESH'; self.mode='OBJECT'; self._data=mesh; mesh.users+=1
            self.active_shape_key_index=1; self.show_only_shape_key=False; self.vertex_groups=[types.SimpleNamespace(name='front')]
            self.animation_data=None; self.parent=ID()
            self.hide_render=False; self.hide_viewport=False; self.hidden=True
            class Dependency(ID):
                def __init__(self,name,tp):
                    self.name=name; self.type=tp
            self.modifiers=[Dependency('Armature','ARMATURE'),Dependency('Shell','SOLIDIFY')]
            self.constraints=[Dependency('parent-pose','COPY_TRANSFORMS')]
            self.matrix_world=Matrix([[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]])
        @property
        def data(self):
            return self._data
        @data.setter
        def data(self,value):
            self._data.users-=1; self._data=value; value.users+=1
        def copy(self):
            result=copy.copy(self); result.name='owned-object'; result._data.users+=1
            result.modifiers=self.modifiers[:]; result.constraints=self.constraints[:]
            objects['allocated-copy']=result
            return result
        def animation_data_clear(self):
            self.animation_data=None
        def hide_set(self,value):
            if self not in linked_objects or self not in layer_objects:
                raise RuntimeError('hide_set requires linked object and current-view-layer Base')
            self.hidden=value
        def evaluated_get(self,depsgraph):
            if failure=='evaluated-get':
                raise RuntimeError('injected rest evaluator failure')
            assert not self.modifiers and not self.constraints and self.parent is None
            result=types.SimpleNamespace(matrix_world=self.matrix_world)
            def to_mesh(**kwargs):
                if failure=='to-mesh':
                    raise RuntimeError('injected temporary mesh evaluation failure')
                me=copy.deepcopy(self.data)
                for i,v in enumerate(me.vertices):
                    pos=list(me.shape_keys.key_blocks[0].data[i].co)
                    for key in me.shape_keys.key_blocks[1:]:
                        if key.mute:
                            continue
                        weight=v.groups[0].weight if key.vertex_group else 1.0
                        pos=[p+key.value*weight*(q-r) for p,q,r in zip(pos,key.data[i].co,key.relative_key.data[i].co)]
                    v.co=Vec(pos)
                a,b,c=[v.co for v in me.vertices]
                u=[q-p for p,q in zip(a,b)]; v=[q-p for p,q in zip(a,c)]
                normal=Vec([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]).normalized()
                for vert in me.vertices:
                    vert.normal=normal
                me.polygons[0].normal=normal
                if failure=='point-map':
                    me.attributes.get(R.POINT_ID).data[1].value=0
                elif failure=='face-map':
                    me.attributes.get(R.FACE_ID).data[0].value=1
                elif failure=='winding':
                    me.polygons[0].vertices.reverse()
                elif failure=='corner':
                    me.loops[0].edge_index=2
                return me
            def clear():
                removed['evaluated']+=1
            result.to_mesh=to_mesh; result.to_mesh_clear=clear
            return result
    source=Object(Mesh())
    class Registry:
        def __init__(self,kind,rows):
            self.kind=kind; self.rows=rows
        def get(self,name):
            return self.rows.get(name)
        def remove(self,obj,**kwargs):
            for name,value in list(self.rows.items()):
                if value is obj:
                    self.rows.pop(name)
            removed[self.kind]+=1
            if self.kind=='objects':
                linked_objects.discard(obj); layer_objects.discard(obj)
                obj.data.users-=1
            elif self.kind=='meshes':
                assert obj.users==0; obj.shape_keys.users-=1
    def link(obj):
        if failure=='link':
            raise RuntimeError('injected temporary link failure')
        objects[obj.name]=obj
        linked_objects.add(obj)
    def update():
        layer_objects.clear(); layer_objects.update(linked_objects)
    bpy=types.SimpleNamespace(data=types.SimpleNamespace(objects=Registry('objects',objects),meshes=Registry('meshes',meshes),shape_keys=Registry('keys',keys)),
        context=types.SimpleNamespace(scene=types.SimpleNamespace(collection=types.SimpleNamespace(objects=types.SimpleNamespace(link=link))),
                                     view_layer=types.SimpleNamespace(update=update),evaluated_depsgraph_get=lambda:object()))
    return source,bpy,removed,objects,meshes,keys


def run():
    old=sys.modules.get('bpy')
    paths=0
    try:
        for failure in (None,'link','evaluated-get','to-mesh','point-map','face-map','winding','corner'):
            source,bpy,removed,objects,meshes,keys=fixture(failure)
            sys.modules['bpy']=bpy; before=R.source_state(source)
            try:
                source.hide_set(False)
            except RuntimeError:
                pass
            else:
                raise AssertionError('pre-link hide_set fixture accepted an object without Base')
            if failure is None:
                result=R.evaluate(source)
                assert result['vertices']==[[0,.02,0],[1,.04,0],[0,.1,1]]
                assert result['vertexNormals'][0]!=[0,-1,0]
                assert result['shapeState']['blocks'][1]['value']==1.0
                assert result['shapeState']['blocks'][2]['mute'] is True
                assert result['shapeState']['blocks'][3]['vertexGroup']=='front'
            else:
                try:
                    R.evaluate(source)
                except (ValueError,AssertionError,RuntimeError):
                    pass
                else:
                    raise AssertionError('temporary/mapping failure fixture passed')
            assert R.source_state(source)==before
            assert source.hide_render is False and source.hide_viewport is False and source.hidden is True
            assert not objects and not meshes and set(keys)=={'source-keys'}
            assert removed['objects']==removed['meshes']==removed['keys']==1
            paths+=1
        for unsupported in ('absolute','show-only','animated-key','missing-group'):
            source,bpy,removed,*_=fixture(); sys.modules['bpy']=bpy
            if unsupported=='absolute': source.data.shape_keys.use_relative=False
            elif unsupported=='show-only': source.show_only_shape_key=True
            elif unsupported=='animated-key': source.data.shape_keys.animation_data=object()
            else: source.data.shape_keys.key_blocks[3].vertex_group='missing'
            try:
                R.evaluate(source)
            except ValueError:
                pass
            else:
                raise AssertionError('unsupported rest context accepted')
            assert removed['objects']==removed['meshes']==removed['keys']==0
            paths+=1
    finally:
        if old is None: sys.modules.pop('bpy',None)
        else: sys.modules['bpy']=old
    return {'actualRestHelperInjectedPaths':paths,'nativeExecuted':False,
            'activeRelativeS7LikeMixinGroupMuteAndNormals':'pass, supplied CPU evaluator',
            'indexIdentityTemporaryFailureOriginalGuardCleanup':'pass',
            'absoluteShowOnlyDrivenMissingGroup':'explicit rejection'}
