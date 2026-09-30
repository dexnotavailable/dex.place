"""Actual FC1 install on supplied CPU meshes: one field/ref/original cleanup."""
import copy
import struct
import sys
import types
import unittest
from unittest.mock import patch
import facecage_blender as C
import facecage_geometry as G
from check_facecage_support import mesh_fixture


def f32(v): return struct.unpack('f',struct.pack('f',v))[0]


class Vertex:
    def __init__(self,index,point,neck=False):
        self.index=index; self.co=point
        self.groups=[types.SimpleNamespace(group=0,weight=1.0)] if neck else []
    @property
    def co(self): return self._co
    @co.setter
    def co(self,value): self._co=tuple(f32(v) for v in value)


def native_mesh(points,faces,neck=False):
    mesh=mesh_fixture(); mesh.shape_keys=None; mesh.has_custom_normals=True
    mesh.vertices=[Vertex(i,p,neck and i==0) for i,p in enumerate(points)]
    mesh.polygons=[]; mesh.loops=[]; mesh.loop_triangles=[]; mesh.edges=[]
    pairs={}
    for face in faces:
        indices=[]
        for a,b in zip(face,face[1:]+face[:1]):
            pair=tuple(sorted((a,b)))
            if pair not in pairs:
                pairs[pair]=len(mesh.edges); mesh.edges.append(types.SimpleNamespace(vertices=pair,use_seam=False,use_edge_sharp=False))
            i=len(mesh.loops); indices.append(i)
            mesh.loops.append(types.SimpleNamespace(index=i,vertex_index=a,edge_index=pairs[pair]))
        mesh.polygons.append(types.SimpleNamespace(vertices=face,loop_indices=indices,material_index=0,use_smooth=False))
        mesh.loop_triangles.append(types.SimpleNamespace(vertices=face))
    row_type=type(mesh.attr.data[0]); mesh.attr.data=[row_type((i+1,10)) for i in range(len(mesh.loops))]
    mesh.targets=[(0.,-1.,0.)]*len(mesh.loops)
    mesh.uv_layers=[]; mesh.materials=[types.SimpleNamespace(name='skin')]
    mesh.calc_loop_triangles=lambda:None
    mesh.copy=lambda:copy.deepcopy(mesh)
    return mesh


class SharedField(unittest.TestCase):
    def test_actual_adapter_one_final_cfg_all_refs_original_readback_restore(self):
        fixed=[(-.01,-.09,1.588),(.01,-.09,1.589),(0,-.08,1.590),
               (-.02,-.09,1.89),(.02,-.09,1.89),(0,-.08,1.90),
               (-.02,.01,1.68),(.02,.01,1.68),(0,.02,1.69)]
        fixed.extend([(0,-.09,1.588)]*(941-len(fixed)))
        active=[(-.03,-.09,1.66),(.03,-.09,1.66),(0,-.10,1.73)]
        rig=types.SimpleNamespace(name='rosace_rig',data=types.SimpleNamespace(bones={
            'J_Adj_L_FaceEye':types.SimpleNamespace(head_local=(.0506,-.0873,1.7027)),
            'J_Adj_R_FaceEye':types.SimpleNamespace(head_local=(-.0506,-.0873,1.7027))}))
        class Groups(list):
            def get(self,name): return next((g for g in self if g.name==name),None)
        group=types.SimpleNamespace(name='J_Bip_C_Neck',index=0)
        class Object:
            def __init__(self,name,mesh,hidden):
                self.name=name; self.data=mesh; self.type='MESH'; self.parent=rig; self.hide_render=hidden
                self.vertex_groups=Groups([group]); self.pass_index=1
                self.modifiers=[types.SimpleNamespace(type='ARMATURE',object=rig)]
                self.matrix_world=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
            def get(self,name): return 'head'
        head=Object('head_skin',native_mesh(fixed+active,[(0,1,2),(3,4,5),(6,7,8),(941,942,943)],True),False)
        refs=[Object(name,native_mesh(active,[(0,1,2)]),True) for name in C.FEATURES]
        objects={'rosace_rig':rig,'head_skin':head,**{o.name:o for o in refs}}
        originals={o.name:o.data for o in [head,*refs]}; removed=[]
        bpy=types.SimpleNamespace(app=types.SimpleNamespace(version_string='CPU fixture, not Blender'),
             data=types.SimpleNamespace(objects=objects,meshes=types.SimpleNamespace(remove=lambda me:removed.append(me))))
        with patch.dict(sys.modules,{'bpy':bpy}),patch.object(G,'validate',wraps=G.validate) as calls:
            state=C.install(True)
            self.assertEqual(state['report']['originalP0VertexCount'],941)
            self.assertEqual(len(calls.call_args_list),1+len(refs))
            self.assertTrue(all(call.args[2] is state['config'] for call in calls.call_args_list))
            self.assertTrue(all(row['finalSharedConfig'] is state['config'] for row in state['report']['objects'].values()))
            self.assertTrue(all(o.data is not originals[o.name] for o in [head,*refs]))
            C.restore(state)
        self.assertTrue(all(o.data is originals[o.name] for o in [head,*refs]))
        self.assertEqual(len(removed),1+len(refs))


if __name__=='__main__':
    import json
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(SharedField))
    print(json.dumps({'kind':'actual FC1 adapter with supplied CPU mesh/normal boundary','tests':result.testsRun,'pass':result.wasSuccessful(),'nativeExecuted':False}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
