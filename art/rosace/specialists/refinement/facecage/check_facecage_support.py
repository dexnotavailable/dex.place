"""Meaningful support/encoded/UV/cleanup rejection fixtures; no native proof."""
import copy
import json
import math
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch
import facecage_geometry as G
import facecage_support as S
import facecage_normals as N
import facecage_blender as C


def cfg(): return G.config(1.588,1.896,((.0506,-.0873,1.7027),(-.0506,-.0873,1.7027)),1.625)


def mesh_fixture():
    rna=types.SimpleNamespace(properties=[types.SimpleNamespace(identifier='value',type='INT',is_array=True)])
    class Row:
        bl_rna=rna
        def __init__(self,value): self.value=value
    class Mesh:
        def __init__(self):
            self.loops=[types.SimpleNamespace(index=i,vertex_index=i) for i in range(3)]
            self.attr=types.SimpleNamespace(name='custom_normal',domain='CORNER',data_type='INT16_2D',is_required=False,
                data=[Row((i+1,10)) for i in range(3)])
            class Attrs(list):
                def get(self,name): return next((a for a in self if a.name==name),None)
            self.attributes=Attrs([self.attr])
            self.targets=[(0.,-1.,0.)]*3
        @property
        def corner_normals(self):
            return [types.SimpleNamespace(vector=n) for n in self.targets]
        def update(self): pass
        def normals_split_custom_set(self,target):
            self.targets=list(target)
            for row in self.attr.data: row.value=(row.value[0]+100,row.value[1])
    return Mesh()


class SupportGuards(unittest.TestCase):
    def source(self):
        points=((-.03,-.08,1.61),(.03,-.08,1.79),(.03,.01,1.68),
                (-.03,-.07,1.635),(.03,-.07,1.65),(.03,-.07,1.765),(-.03,-.03,1.69),(.01,-.09,1.70),
                (.01,-.08,1.77),(.01,-.11,1.705),(-.01,-.105,1.72))
        faces=((0,3,4),(1,5,8),(2,6,7),(3,4,7),(7,9,10))
        return points,faces

    def test_full_polygon_stars_monotonic_original_p0_immutable(self):
        points,faces=self.source(); old=cfg(); original=copy.deepcopy(old)
        final,report=S.plan(points,faces,old,{0})
        self.assertEqual(old,original)
        self.assertEqual(report['originalP0VertexIndices'],[0,1,2])
        self.assertGreaterEqual(final['neckProtectedThrough'],old['neckProtectedThrough'])
        self.assertLessEqual(final['crownProtectedFrom'],old['crownProtectedFrom'])
        self.assertLessEqual(final['backProtectionY'],old['backProtectionY'])
        for region,indices in report['fullPolygonStarVertexIndices'].items():
            self.assertTrue(indices)
            self.assertTrue(all(G.move(points[i],final)==points[i] for i in indices))
        self.assertEqual(final['backProtectionY'],-.09) # full polygon, not only edge endpoints
        self.assertEqual(final['orbitalLiftSpan'],old['orbitalLiftSpan'])

    def test_space_rejections_keep_attempted_planes_sets(self):
        points,faces=self.source()
        for index,axis,value,phrase in ((4,2,1.69,'neck'),(5,2,1.73,'crown'),(6,1,-.10,'back')):
            bad=[list(p) for p in points]; bad[index][axis]=value; bad=tuple(tuple(p) for p in bad)
            with self.assertRaises(S.SupportFailure) as found: S.plan(bad,faces,cfg(),{0})
            self.assertIn(phrase,str(found.exception))
            self.assertIn('finalConfig',found.exception.report)
            self.assertIn('fullPolygonStarVertexIndices',found.exception.report)
            self.assertIn('originalP0VertexIndices',found.exception.report)

    def test_nonfinite_and_invalid_polygon_reject(self):
        points,faces=self.source()
        bad=list(points); bad[0]=(math.nan,0,1.6)
        with self.assertRaises(ValueError): S.plan(tuple(bad),faces,cfg(),{0})
        with self.assertRaises(ValueError): S.plan(points,((0,0,4),),cfg(),{0})

    def test_both_back_cutoff_and_taper_use_final_plane(self):
        final=cfg(); final['backProtectionY']=-.04
        point=(.03,-.03,1.70)
        self.assertEqual(G.move(point,final),point)
        self.assertNotEqual(G.move(point,cfg()),point)
        self.assertEqual(G.transport_normal(point,(0.,-1.,0.),final),(0.,-1.,0.))

    def test_actual_geometry_fold_and_nonfinite_reject(self):
        points=((-.03,-.08,1.65),(.03,-.08,1.65),(.03,-.08,1.70))
        candidate=(points[0],points[2],points[1])
        with self.assertRaises(ValueError): G.validate_candidate(points,candidate,((0,1,2),),cfg())
        with self.assertRaises(ValueError): G.validate_candidate(points,(points[0],(math.inf,0,0),points[2]),((0,1,2),),cfg())

    def test_expanded_support_leaving_no_final_change_rejects(self):
        points,faces=self.source(); points=points[:9]; faces=faces[:4]
        final,_=S.plan(points,faces,cfg(),{0})
        triangles=((0,3,4),(1,5,8),(2,6,7),(3,4,7))
        with self.assertRaisesRegex(ValueError,'changes no geometry'): G.validate(points,triangles,final)

    def test_complete_preservable_set_excludes_support_target_drift(self):
        old=[(0.,-1.,0.)]*3
        deform=[old[0],(.1,-.9,0.),old[2]]
        target=[old[0],old[1],(.1,-.9,0.)]
        self.assertEqual(N.preservable(old,deform,target),[0])

    def test_encoded_only_setter_changes_restored_complete_set(self):
        original=mesh_fixture(); candidate=copy.deepcopy(original)
        obj=types.SimpleNamespace(data=original)
        points=((0,0,1.60),(0,0,1.80),(0,.01,1.70))
        report=N.correct(obj,original,candidate,points,cfg(),{0,1,2})
        self.assertTrue(report['passed'])
        self.assertEqual(report['preservableCornerIndices'],[0,1,2])
        self.assertEqual(report['preservableEncodedOnlySetterChanges'],[0,1,2])
        self.assertEqual(N.encoded(original),N.encoded(candidate))

    def test_original_p0_guard_failure_retains_all_mismatch_pairs(self):
        original=mesh_fixture(); candidate=copy.deepcopy(original)
        # Actual-style deformation changed a protected decoding context. The
        # old pair cannot be restored as if that context were unchanged.
        candidate.targets[0]=(.1,-.9,0.)
        obj=types.SimpleNamespace(data=original)
        points=((0,0,1.60),(0,0,1.80),(0,.01,1.70))
        with self.assertRaises(N.NormalFailure) as found: N.correct(obj,original,candidate,points,cfg(),{0,1,2})
        report=found.exception.report
        self.assertEqual(report['originalProtectedEncodedMismatchIndices'],[0])
        self.assertEqual(report['completeMismatches'][0]['cornerIndex'],0)
        self.assertIn('encodedOriginal',report['completeMismatches'][0])
        self.assertEqual(report['cornerCount'],3)

    def test_normal_schema_and_outside_rna_type_reject(self):
        original=mesh_fixture(); original.attr.data_type='FLOAT2'
        with self.assertRaises(ValueError): N.encoded(original)
        original=mesh_fixture(); original.attr.data[0].value=(True,1)
        with self.assertRaises(ValueError): N.encoded(original)

    def test_real_invariant_materializes_uv_before_complete_attrs(self):
        props=types.SimpleNamespace(properties=[types.SimpleNamespace(identifier='value',type='BOOLEAN',is_array=False)])
        attr=types.SimpleNamespace(name='.uv_select',domain='CORNER',data_type='BOOLEAN',is_required=False,
                                  data=[types.SimpleNamespace(value=False,bl_rna=props)])
        mesh=types.SimpleNamespace(attributes=[],polygons=[],edges=[],loops=[],vertices=[],materials=[])
        class UV:
            name='UV'; active_render=True; active_clone=False
            @property
            def data(self):
                if attr not in mesh.attributes: mesh.attributes.append(attr)
                return []
        mesh.uv_layers=[UV()]
        obj=types.SimpleNamespace(data=mesh,vertex_groups=[],pass_index=0,hide_render=False,parent=None,
            matrix_world=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]],get=lambda name:None)
        before=C.invariant(obj)
        self.assertIn('.uv_select',before['attributes'])
        self.assertEqual(before,C.invariant(obj))
        attr.is_required=True
        self.assertNotEqual(before,C.invariant(obj))

    def test_failure_json_retained_and_cleanup_all_original_pointers(self):
        with tempfile.TemporaryDirectory(prefix='support-failure-',dir=Path(__file__).resolve().parents[5]/'review/rosace/specialists/refinement/facecage') as directory:
            path=Path(directory)/'failed.json'
            C.write_diagnostic(path,{'status':'rejected','completeMismatches':[{'cornerIndex':0,'encodedOriginal':[1,2],'encodedFinal':[3,2]}]})
            self.assertEqual(json.loads(path.read_text())['completeMismatches'][0]['cornerIndex'],0)
        old=[object(),object()]; copies=[object(),object()]
        objects=[types.SimpleNamespace(name=str(i),data=copies[i]) for i in range(2)]
        calls=[]
        def remove(mesh):
            calls.append(mesh)
            if mesh is copies[1]: raise RuntimeError('owned removal failure')
        state={'handles':[(objects[i],old[i],copies[i]) for i in range(2)]}
        with patch.dict(sys.modules,{'bpy':types.SimpleNamespace(data=types.SimpleNamespace(meshes=types.SimpleNamespace(remove=remove)))}):
            with self.assertRaises(RuntimeError): C.restore(state)
        self.assertEqual([o.data for o in objects],old)
        self.assertEqual(len(calls),2)
        self.assertEqual(state['restoreReport']['originalPointerMismatches'],[])


if __name__=='__main__':
    private=Path(__file__).resolve().parents[5]/'review/rosace/specialists/refinement/facecage'
    private.mkdir(parents=True,exist_ok=True)
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(SupportGuards))
    print(json.dumps({'kind':'FC1 support/normal/UV/failure CPU fixtures','tests':result.testsRun,'pass':result.wasSuccessful(),'nativeExecuted':False}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
