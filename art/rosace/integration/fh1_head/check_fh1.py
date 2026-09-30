"""Discriminating pure CPU fixtures; never native geometry/art acceptance."""
import ast
import copy
import importlib.util
import json
import math
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

import fh1_boundary as B
import fh1_field as G
import fh1_preserve as P
import fh1_native as C
import fh1_trial as T


def zipper():
    # Finite native-float32 ring geometry; the same angular zipper count and
    # winding contract as construction, without using guessed canonical IDs.
    hp=list(P.native([(math.cos(2*math.pi*i/30)*.04, math.sin(2*math.pi*i/30)*.04, 1.5) for i in range(30)]))
    hp.append((0.,0.,1.75)); hf=[(i,(i+1)%30,30) for i in range(30)]
    bp=hp[:30]+list(P.native([(math.cos(2*math.pi*i/16)*.04,math.sin(2*math.pi*i/16)*.04,1.45) for i in range(16)]))+list(P.native([(0.,0.,1.40)]))
    bf=[]; i=j=0
    while i<16 or j<30:
        a0,a1=30+i%16,30+(i+1)%16; b0,b1=j%30,(j+1)%30
        if j>=30 or (i<16 and (i+1)/16 <= (j+1)/30): bf.append((a0,a1,b0)); i+=1
        else: bf.append((a0,b1,b0)); j+=1
    bf += [(30+(i+1)%16,30+i,46) for i in range(16)]
    hw=[{'J_Bip_C_Head':.375,'J_Bip_C_Neck':.625} for _ in hp]
    bw=[{'J_Bip_C_Head':.375,'J_Bip_C_Neck':.625} for _ in bp]
    return hp,hf,bp,bf,hw,bw


class BoundaryTests(unittest.TestCase):
    def test_actual_constructor_contract_bijective_oriented_strip(self):
        r=B.identify(*zipper()); self.assertEqual(r['constructionCounts'],{'cut':30,'bodyRing':16,'bridgeTriangles':46})
        self.assertEqual(len(r['headToBodyVertexPairs']),30)
    def test_duplicate_extra_shared_coordinate_rejects(self):
        data=list(zipper()); data[2].append(data[0][0]); data[5].append(data[5][0])
        with self.assertRaises(B.BoundaryFailure): B.identify(*data)
    def test_one_float32_step_not_nearest_match(self):
        data=list(zipper()); p=list(data[2][0]); p[0]=P.native([(p[0]+1e-7,p[1],p[2])])[0][0]; data[2][0]=tuple(p)
        with self.assertRaises(B.BoundaryFailure): B.identify(*data)
    def test_orientation_and_weight_drift_reject(self):
        for kind in ('orientation','weight','bridge'):
            data=list(zipper())
            if kind=='orientation': data[1]=[tuple(reversed(f)) for f in data[1]]
            elif kind=='weight': data[5][0]={'J_Bip_C_Head':.5,'J_Bip_C_Neck':.5}
            else: data[3].pop(0)
            with self.subTest(kind=kind),self.assertRaises(B.BoundaryFailure): B.identify(*data)
    def test_nonfinite_and_unstored_double_reject(self):
        for p in ((math.nan,0.,0.),(.1,0.,0.)):
            with self.assertRaises(ValueError): B.point_key(p)
    def test_positive_neck_one_neighbor_only(self):
        seam,protect=B.anatomy([(0.,0.,0.)]*5,[(0,1),(1,2),(2,3),(3,4)],[{'J_Bip_C_Neck':.01},{},{},{},{}])
        self.assertEqual(seam,{0}); self.assertEqual(protect,{0,1})


def row(value,rna_type='INT',array=True):
    prop=types.SimpleNamespace(identifier='value',type=rna_type,is_array=array)
    return types.SimpleNamespace(value=value,bl_rna=types.SimpleNamespace(properties=[prop]))


def normal_mesh(count=5120):
    attr=types.SimpleNamespace(name='custom_normal',domain='CORNER',data_type='INT16_2D',is_required=False,data=[row((i%100,2)) for i in range(count)])
    mesh=types.SimpleNamespace(attributes=[attr],loops=[types.SimpleNamespace(index=i,vertex_index=i%3) for i in range(count)],corner_normals=[types.SimpleNamespace(vector=(0.,0.,1.)) for _ in range(count)],has_custom_normals=True)
    def forbidden(*args): raise AssertionError('normal setter forbidden')
    mesh.normals_split_custom_set=forbidden; mesh.normals_split_custom_set_from_vertices=forbidden
    return mesh


class EncodingTests(unittest.TestCase):
    def before(self,mesh):
        schema,pairs=P.encoded(mesh,True)
        return {'encodedSchema':schema,'pairs':pairs,'decoded':P.decoded(mesh),'coordinates':((0.,0.,1.),(0.,0.,1.1),(0.,0.,1.2))}
    def test_full5120_exact_and_stationary_decoding_declared_without_setter(self):
        mesh=normal_mesh(); before=self.before(mesh)
        mesh.corner_normals[1].vector=(0.,.5,.5)
        r=P.normals_report(mesh,before,before['coordinates'],{0},{'neckProtectedThrough':1.05},G)
        self.assertTrue(r['encodedExact']); self.assertEqual(r['fullEncodedPairCount'],5120)
        self.assertEqual(r['stationaryDecodedMismatchIndices'],[1]); self.assertFalse(r['setterCalled'])
    def test_anatomical_decoded_and_any_encoded_drift_reject_complete_rows(self):
        for kind in ('protectedDecoded','encodedOnly','schema'):
            mesh=normal_mesh(); before=self.before(mesh)
            if kind=='protectedDecoded': mesh.corner_normals[0].vector=(0.,1.,0.)
            elif kind=='encodedOnly': mesh.attributes[0].data[411].value=(12,13)
            else: mesh.attributes[0].is_required=True
            with self.subTest(kind=kind),self.assertRaises(P.NormalFailure) as caught:
                P.normals_report(mesh,before,before['coordinates'],{0},{'neckProtectedThrough':1.05},G)
            self.assertIn('fullEncodedSha256',caught.exception.report)
    def test_unsupported_normal_schema_reject(self):
        mesh=normal_mesh(); mesh.attributes[0].data_type='FLOAT2'
        with self.assertRaises(ValueError): P.encoded(mesh,True)
    def test_no_native_normal_write_call_exists(self):
        for path in (T.HERE/'fh1_native.py',T.HERE/'fh1_preserve.py'):
            tree=ast.parse(path.read_text(encoding='utf-8'))
            forbidden={'normals_split_custom_set','normals_split_custom_set_from_vertices','transport_normal'}
            self.assertFalse(any(isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr in forbidden for n in ast.walk(tree)))


class NativeSafetyTests(unittest.TestCase):
    def test_native_quantized_original_field_and_triangle_guard(self):
        cfg=G.config(1.5,1.83,[(-.034,-.10,1.61),(.034,-.10,1.61)])
        points=P.native([(-.03,-.12,1.59),(.03,-.12,1.59),(0.,-.12,1.63)])
        expected,_=G.validate(points,[(0,1,2)],cfg)
        r=C.actual_geometry(points,P.native(expected),[(0,1,2)],cfg)
        self.assertTrue(r['nativeFloat32ReadbackExact'])
        bad=list(P.native(expected)); bad[0]=(0.,0.,0.)
        with self.assertRaises(C.GeometryFailure): C.actual_geometry(points,tuple(bad),[(0,1,2)],cfg)
    def test_cleanup_restores_every_pointer_before_all_removals(self):
        events=[]; orig=[object(),object()]; owned=[object(),object()]
        objs=[types.SimpleNamespace(name=str(i),data=owned[i]) for i in range(2)]
        def remove(mesh):
            self.assertEqual([o.data for o in objs],orig); events.append(mesh)
            if mesh is owned[1]: raise RuntimeError('injected remove failure')
        fake=types.SimpleNamespace(data=types.SimpleNamespace(meshes=types.SimpleNamespace(remove=remove)))
        state={'handles':list(zip(objs,orig,owned)),'originals':[]}
        with patch.dict(sys.modules,{'bpy':fake}),self.assertRaises(RuntimeError): C.restore(state)
        self.assertEqual(events,[owned[1],owned[0]]); self.assertEqual(state['cleanup']['pointerMismatchNames'],[])
    def test_actual_failure_diagnostic_retained_after_cleanup(self):
        import tempfile
        with tempfile.TemporaryDirectory(dir=T.REPO/'review') as temporary:
            base=Path(temporary); target=base/'diagnostic.json'
            with patch.object(C,'PRIVATE',base): C.write(target,{'status':'rejected-before-image','failureDetail':{'protectedCorners':[1,3],'pairsSha256':'typed'},'cleanup':{'pointersExact':True}})
            self.assertEqual(json.loads(target.read_text())['failureDetail']['protectedCorners'],[1,3])
            with patch.object(C,'PRIVATE',base),self.assertRaises(ValueError): C.write(target,{})


class TypedOriginalTests(unittest.TestCase):
    def fixture(self):
        mesh=types.SimpleNamespace(shape_keys=None,materials=[],attributes=[],has_custom_normals=False,
            vertices=[types.SimpleNamespace(co=(0.,0.,0.),groups=[])],polygons=[],edges=[],loops=[],items=lambda:{}.items())
        mesh.attributes=[types.SimpleNamespace(name='position',domain='POINT',data_type='FLOAT_VECTOR',is_required=True,data=[row([0.,0.,0.],'FLOAT')])]
        class UV:
            name='UVMap'; active_render=True; active_clone=False
            @property
            def data(layer):
                if not any(a.name=='.uv_selection' for a in mesh.attributes):
                    mesh.attributes.append(types.SimpleNamespace(name='.uv_selection',domain='CORNER',data_type='BOOLEAN',is_required=False,data=[row(False,'BOOLEAN',False)]))
                return [row([0.,0.],'FLOAT')]
        mesh.uv_layers=[UV()]
        matrix=[[int(r==c) for c in range(4)] for r in range(4)]
        obj=types.SimpleNamespace(data=mesh,vertex_groups=[],matrix_world=matrix,matrix_local=matrix,matrix_parent_inverse=matrix,parent=None,hide_render=False,hide_viewport=False,hide_get=lambda:False,pass_index=1,users_collection=[],modifiers=[],constraints=[],items=lambda:{}.items())
        return obj
    def test_uv_materialization_precedes_complete_required_rna_snapshot(self):
        obj=self.fixture(); before=P.invariant(obj)
        self.assertIn('.uv_selection',before['attributes'])
        self.assertEqual(before,P.invariant(obj))
        obj.data.attributes[-1].is_required=True
        self.assertNotEqual(before,P.invariant(obj))
    def test_outside_typed_value_rna_drift_and_original_position_reject(self):
        obj=self.fixture(); before=P.invariant(obj); outside=P.invariant(obj,allow_position=True)
        obj.data.attributes[0].data[0].value=[1.,0.,0.]
        self.assertNotEqual(before,P.invariant(obj)); self.assertEqual(outside,P.invariant(obj,allow_position=True))
        obj.data.attributes[-1].data[0].bl_rna.properties[0].type='INT'
        self.assertNotEqual(outside,P.invariant(obj,allow_position=True))
    def test_only_modifier_execution_time_is_separate_other_readonly_values_exact(self):
        runtime=types.SimpleNamespace(identifier='execution_time',type='FLOAT',is_array=False,is_readonly=True)
        authored=types.SimpleNamespace(identifier='use_vertex_groups',type='BOOLEAN',is_array=False,is_readonly=False)
        readonly_authored=types.SimpleNamespace(identifier='show_on_cage',type='BOOLEAN',is_array=False,is_readonly=True)
        modifier=types.SimpleNamespace(execution_time=0.,use_vertex_groups=True,show_on_cage=False,bl_rna=types.SimpleNamespace(properties=[runtime,authored,readonly_authored]))
        before=P.rna(modifier,role='modifier'); modifier.execution_time=2.
        self.assertEqual(before,P.rna(modifier,role='modifier'))
        modifier.show_on_cage=True
        self.assertNotEqual(before,P.rna(modifier,role='modifier'))
        modifier.show_on_cage=False; modifier.use_vertex_groups=False
        self.assertNotEqual(before,P.rna(modifier,role='modifier'))
        self.assertNotEqual(P.rna(modifier)['execution_time'],before['execution_time'])


class EntryTests(unittest.TestCase):
    def run_case(self,mode,failure):
        token=object(); prior_apply=lambda pose:(token,pose); prior_anchors=lambda *args:token; prior_f1=lambda:token
        prior_grip=lambda *args:token; prior_rest=lambda *args:token; prior_figure=lambda *args:token
        posing=types.SimpleNamespace(apply_pose=prior_apply,anchors=prior_anchors,grip_hand=prior_grip,hand_rest=prior_rest)
        def prior_install(cfg):
            posing.apply_pose=lambda p:('headscale',p)
            if failure=='install': raise RuntimeError('install partially mutated pose')
        prior_passes=('id','normal')
        module=types.SimpleNamespace(posing=posing,head_scale=types.SimpleNamespace(install=prior_install),f1_module=prior_f1,PASSES=prior_passes,figure_pose=types.SimpleNamespace(apply_pose=prior_figure))
        prior_library=lambda path,name:module; clean=[]
        def construct(enabled,path):
            if failure=='candidate': raise RuntimeError('candidate failure after own cleanup')
            return {'handles':[],'report':{'enabled':enabled}}
        def enclosing():
            d=T.H.library(T.PIPE/'drive9/d9_blender.py','fixture')
            if failure=='preinstall': raise RuntimeError('preinstall')
            d.PASSES=(*d.PASSES,'depth2'); d.figure_pose.apply_pose=lambda *args:None
            d.posing.grip_hand=lambda *args:None; d.posing.hand_rest=lambda *args:None
            d.head_scale.install({'head':1.10})
            if failure=='render': raise RuntimeError('render')
        def restore(state):
            clean.append(state)
            if failure=='cleanup': raise RuntimeError('cleanup')
        args=['--fh1-mode',mode,'--hand-scale','1.0','--shots','idle','--out',str(T.REPO/'review/rosace/integration/fh1_head/entry-fixture'/mode)]
        original_argv=['blender','-b','--python',str(T.__file__),'--',*args]; before_path=sys.path[:]
        with patch.object(sys,'argv',original_argv),patch.object(T.INPUTS,'verify',return_value={'fixtureInputs':True}),patch.object(T.BINDING,'verify',return_value={'fixtureSource':True}),patch.object(T.H,'library',prior_library),patch.object(T.H,'main',enclosing),patch.object(T.C,'install',construct),patch.object(T.C,'restore',restore),patch.object(T.C,'write') as diagnostic:
            if failure:
                with self.assertRaises(RuntimeError): T.main()
            else: T.main()
            self.assertIs(sys.argv,original_argv); self.assertEqual(sys.path,before_path)
            self.assertIs(T.H.library,prior_library); self.assertIs(module.head_scale.install,prior_install)
            self.assertIs(module.posing.apply_pose,prior_apply); self.assertIs(module.posing.anchors,prior_anchors); self.assertIs(module.f1_module,prior_f1)
            self.assertIs(module.PASSES,prior_passes); self.assertIs(module.figure_pose.apply_pose,prior_figure)
            self.assertIs(module.posing.grip_hand,prior_grip); self.assertIs(module.posing.hand_rest,prior_rest)
            self.assertTrue(diagnostic.call_args.args[1]['hooksRestoredExact'])
        self.assertEqual(len(clean),1)
    def test_actual_main_blender_separator_cleanup_both_modes(self):
        for mode in ('control','FH1'):
            for fail in (None,'preinstall','install','candidate','render','cleanup'):
                with self.subTest(mode=mode,failure=fail): self.run_case(mode,fail)
    def test_no_separator_blender_args_reject_before_imported_native(self):
        with patch.object(sys,'argv',['blender','--python','entry.py','--out','private']),self.assertRaises(ValueError): T.main()
    def test_real_importlib_stripped_path_cache_restoration(self):
        names=['fh1_trial','fh1_native','fh1_inputs','fh1_boundary','fh1_field','fh1_preserve','fh1_binding','nx_hands_blender','hand_recipe','mesh_preservation']
        saved={n:sys.modules.pop(n,None) for n in names}; old=sys.path[:]
        try:
            sys.path[:]=[p for p in old if Path(p or '.').resolve()!=T.HERE.resolve() and '/pixel-pipeline' not in p.replace('\\','/')]
            stripped=sys.path[:]
            spec=importlib.util.spec_from_file_location('fh1_trial_import_regression',T.HERE/'fh1_trial.py'); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
            self.assertEqual(sys.path,stripped); self.assertTrue(module.C.__file__.endswith('fh1_native.py'))
        finally:
            sys.path[:]=old
            for n in names:
                sys.modules.pop(n,None)
                if saved[n] is not None: sys.modules[n]=saved[n]


if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__]))
    print(json.dumps({'tests':result.testsRun,'pass':result.wasSuccessful(),'nativeExecuted':False,'limits':'synthetic native typed/topology/helper lifecycle fixtures; actual canonical geometry,5120 readback/interface and pixels remain native requirements'}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
