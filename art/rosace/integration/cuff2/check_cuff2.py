"""CPU source evidence: actual F3 point AST and actual Cuff2/H1 wrapper.

Injected native dependencies do not execute Blender, render or qualify pixels.
"""
import ast
import copy
import hashlib
import importlib.util
import json
import math
import sys
import types
import unittest
from pathlib import Path
from unittest import mock

import cuff2_geometry as G
import cuff2_trial as T
from _reuse import C1, REPO, load

HERE = Path(__file__).resolve().parent


def module(path, name):
    prior_path = sys.path[:]
    try:
        sys.path.insert(0, str(path.parent))
        spec = importlib.util.spec_from_file_location(name, path)
        result = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(result)
        return result
    finally:
        sys.path[:] = prior_path


class Vector(tuple):
    def __add__(self, other):
        return Vector(a+b for a,b in zip(self,other))

    def __sub__(self, other):
        return Vector(a-b for a,b in zip(self,other))

    def __mul__(self, amount):
        return Vector(v*amount for v in self)

    def __truediv__(self, amount):
        return Vector(v/amount for v in self)

    def normalized(self):
        return self / math.sqrt(G.dot(self,self))


def extract_function(path, name, namespace, parent=None):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    nodes = tree.body
    if parent:
        nodes = ast.walk(next(n for n in nodes if isinstance(n, ast.FunctionDef) and n.name == parent))
    function = next(n for n in nodes if isinstance(n, ast.FunctionDef) and n.name == name)
    exec(compile(ast.Module(body=[function],type_ignores=[]), str(path), "exec"), namespace)
    return namespace[name]


def actual_f3_fixture(length=0.42, axis=(1.0,0.0,0.0), shoulder=(0.0,0.0,1.4)):
    variants = module(REPO/"tools/pixel-pipeline/finish_f3/variants.py", "cuff2_fixture_variants")
    parameters = dict(variants.SLEEVE_BASE, **variants.SLEEVE_BIG)
    env = {"math":math, "P":parameters, "lip":parameters["lip"],
           "x0":0.128, "x_el":length*0.61, "x_wr":length,
           "sh":Vector(shoulder), "ax":Vector(axis),
           "front":Vector((0,-1,0)), "z_axis":Vector((0,0,1))}
    common = REPO/"tools/pixel-pipeline/rosace/common.py"
    for function in ("lerp", "smoothstep"):
        extract_function(common, function, env)
    point = extract_function(REPO/"tools/pixel-pipeline/finish_f3/overrides.py", "point", env, "sleeves_f3")
    return tuple(tuple(point(row/G.ROWS, 2*math.pi*k/G.COLUMNS)[0])
                 for row in range(G.ROWS+1) for k in range(G.COLUMNS)), G.loft_faces(), axis


def old_fixture(length=0.28):
    # Execute the unchanged C1 fixture itself, with its original geometry module.
    return module(C1/"check_cuff.py", "cuff2_rejected_c1_fixture").fixture(length)


class Geometry(unittest.TestCase):
    def test_disabled_container_identity(self):
        container = object()
        out, report = G.deform(container, None, None, False)
        self.assertIs(out,container)
        self.assertEqual(report["construction"],"cuff2")

    def test_rejected_c1_short_fixture_now_valid_same_55mm(self):
        source = old_fixture()
        with self.assertRaisesRegex(ValueError, "compresses/reverses"):
            load("cuff_geometry").deform(*source, True)
        out, report = G.deform(*source, True)
        self.assertEqual(report["requestedRetreatM"],0.055)
        self.assertEqual(report["protectedRows"],[0])
        self.assertAlmostEqual(report["maxRetreatM"],0.055)
        self.assertGreaterEqual(report["minAxialGapRatio"],0.25)
        self.assertNotEqual(out[G.COLUMNS],source[0][G.COLUMNS])

    def test_actual_f3_source_formula_and_protected_coordinates(self):
        points, faces, axis = actual_f3_fixture()
        G.validate_azimuth(points,axis,(0,0,1.4))
        out, report = G.deform(points,faces,axis,True)
        self.assertEqual(report["trianglesChecked"],2640)
        self.assertEqual(report["cornerJacobiansChecked"],2640)
        for i,(before,after) in enumerate(zip(points,out)):
            row,k = divmod(i,G.COLUMNS)
            if row==0 or math.sin(2*math.pi*k/G.COLUMNS)<=-.35:
                self.assertIs(after,before)
            self.assertEqual(before[1:],after[1:])
        self.assertEqual(points,actual_f3_fixture()[0])

    def test_nonuniform_actual_progress_and_bent_columns(self):
        points, faces, axis = actual_f3_fixture()
        mixed = []
        for i,p in enumerate(points):
            row,k = divmod(i,G.COLUMNS)
            t = (row/G.ROWS)**1.3
            axial = points[k][0]+(points[G.ROWS*G.COLUMNS+k][0]-points[k][0])*t
            mixed.append((axial,p[1]+0.003*math.sin(math.pi*row/G.ROWS),p[2]))
        out, report = G.deform(tuple(mixed),faces,axis,True)
        for k in range(G.COLUMNS):
            for row in range(G.ROWS):
                gap = G.dot(G.sub(mixed[(row+1)*G.COLUMNS+k],mixed[row*G.COLUMNS+k]),axis)
                after = G.dot(G.sub(out[(row+1)*G.COLUMNS+k],out[row*G.COLUMNS+k]),axis)
                self.assertAlmostEqual(after/gap,report["retainedColumnFactors"][k],places=11)
        self.assertEqual(out[10*G.COLUMNS+7][1:],mixed[10*G.COLUMNS+7][1:])

    def test_non_axis_aligned_actual_f3_preserves_radial_components(self):
        axis = (math.sqrt(.95),.1,-.2)
        points,faces,axis = actual_f3_fixture(.55,axis)
        G.validate_azimuth(points,axis,(0,0,1.4))
        out,_ = G.deform(points,faces,axis,True)
        for before,after in zip(points,out):
            delta = G.sub(after,before)
            self.assertLess(max(abs(v-G.dot(delta,axis)*a) for v,a in zip(delta,axis)),1e-14)

    def test_face_array_and_cyclic_start_preserve_oriented_input(self):
        points,faces,axis = old_fixture(.60)
        reordered = tuple(face[2:]+face[:2] for face in reversed(faces))
        a,_ = G.deform(points,faces,axis,True)
        b,_ = G.deform(points,reordered,axis,True)
        self.assertEqual(a,b)
        self.assertEqual(reordered,tuple(face[2:]+face[:2] for face in reversed(faces)))

    def test_wrong_schema_missing_duplicate_deleted_and_bowtie(self):
        points,faces,axis = old_fixture(.60)
        f = faces[0]
        bad_faces = (faces[:-1],(faces[1],)+faces[1:],((f[0],f[2],f[1],f[3]),)+faces[1:],
                     (tuple(float(v) for v in f),)+faces[1:],((True,*f[1:]),)+faces[1:])
        for broken in bad_faces:
            with self.subTest(broken=broken[0]), self.assertRaises(ValueError):
                G.deform(points,broken,axis,True)
        for broken in (points[:-1],((0,0),)+points[1:],((float("nan"),0,0),)+points[1:]):
            with self.assertRaises(ValueError):
                G.deform(broken,faces,axis,True)

    def test_short_total_span_reversal_zero_and_nonfinite_axes_reject(self):
        with self.assertRaisesRegex(ValueError,"25 percent"):
            G.deform(*old_fixture(.24),True)
        points,faces,axis = old_fixture(.60)
        for bad_axis in ((-1,0,0),(2,0,0),(float("inf"),0,0),(0,0,0)):
            with self.assertRaises(ValueError):
                G.deform(points,faces,bad_axis,True)
        for value in ("cuff2",1,None):
            with self.assertRaises(ValueError):
                G.deform(points,faces,axis,value)
        for changed in (points[:G.COLUMNS]+points[:G.COLUMNS]+points[2*G.COLUMNS:],
                        tuple(points[k%G.COLUMNS] for k in range(len(points)))):
            with self.assertRaises(ValueError):
                G.deform(changed,faces,axis,True)

    def test_azimuth_shift_reflection_duplicate_and_collapsed_basis_reject(self):
        points,_,axis = actual_f3_fixture()
        for mapping in (lambda k:(k+1)%G.COLUMNS,lambda k:(-k)%G.COLUMNS,lambda k:0 if k==1 else k):
            bad = tuple(points[row*G.COLUMNS+mapping(k)] for row in range(G.ROWS+1) for k in range(G.COLUMNS))
            with self.assertRaises(ValueError):
                G.validate_azimuth(bad,axis,(0,0,1.4))
        with self.assertRaises(ValueError):
            G.validate_azimuth(points,(0,0,1),(0,0,1.4))

    def test_degenerate_and_reversed_triangle_jacobian_reject(self):
        points,faces,axis = old_fixture(.60)
        degenerate = tuple(points[i-1] if i%G.COLUMNS==1 else p for i,p in enumerate(points))
        with self.assertRaisesRegex(ValueError,"triangle/Jacobian"):
            G.deform(degenerate,faces,axis,True)
        out,_ = G.deform(points,faces,axis,True)
        flipped = list(out)
        i=10*G.COLUMNS+1
        flipped[i]=(out[i][0],-1.0,3.0)
        with self.assertRaisesRegex(ValueError,"triangle|Jacobian"):
            G.audit(points,flipped,faces,axis)

    def test_finite_coordinates_with_computed_overflow_reject(self):
        points,faces,axis = old_fixture(.60)
        huge = tuple((p[0],p[1]*1e200,p[2]*1e200) for p in points)
        self.assertTrue(all(math.isfinite(v) for p in huge for v in p))
        with self.assertRaisesRegex(ValueError,"nonfinite computed"):
            G.deform(huge,faces,axis,True)
        with self.assertRaisesRegex(ValueError,"nonfinite"):
            G.validate_azimuth(huge,axis,(0,0,0))
        # Finite cross components can still overflow their squared norm/dot.
        with self.assertRaisesRegex(ValueError,"nonfinite computed"):
            G.positive_orientation((1e200,0,0),(1e200,0,0),"fixture")


class WrapperCleanup(unittest.TestCase):
    def test_real_dependency_bootstrap_without_script_directory_or_cached_modules(self):
        # Blender --python does not reliably insert the script's directory.
        # Load the real adapters, then intentionally fail mode validation before
        # H1.main can import bpy or open a scene. Injected dependencies cannot
        # satisfy this regression.
        names=("cuff2_blender","cuff2_geometry","_reuse","nx_hands_blender",
               "reconstruction_recipe","hand_recipe","cuff_geometry")
        saved={name:sys.modules.get(name) for name in names}
        prior_path=sys.path[:]
        try:
            sys.path[:]=[p for p in prior_path if Path(p or '.').resolve() not in
                         (HERE.resolve(),(REPO/"tools/pixel-pipeline/next").resolve())]
            for name in names: sys.modules.pop(name,None)
            stripped=sys.path[:]
            with self.assertRaisesRegex(ValueError,"explicit parent/cuff2"):
                T.main(["--cuff-mode","invalid-source-fixture","--hand-scale","1.3","--shots","idle"])
            self.assertEqual(sys.path,stripped)
            self.assertEqual(Path(sys.modules["cuff2_blender"].__file__).resolve(),HERE/"cuff2_blender.py")
            self.assertEqual(Path(sys.modules["cuff2_geometry"].__file__).resolve(),HERE/"cuff2_geometry.py")
            self.assertEqual(Path(sys.modules["_reuse"].__file__).resolve(),HERE/"_reuse.py")
        finally:
            sys.path[:]=prior_path
            for name,old in saved.items():
                sys.modules.pop(name,None)
                if old is not None: sys.modules[name]=old

    def test_actual_adapters_copy_restore_and_custom_normal_rejection(self):
        import cuff2_blender as adapter
        points,faces,_=old_fixture(.60)
        class ActiveList(list):
            active_index=0
        class Object(types.SimpleNamespace):
            def get(self,key):
                return "sleeves" if key=="part" else None
        scalar_prop=types.SimpleNamespace(identifier="value",is_array=False)
        crease=types.SimpleNamespace(name="crease",domain="POINT",data_type="FLOAT",
            data=[types.SimpleNamespace(value=i/1000,bl_rna=types.SimpleNamespace(properties=[scalar_prop])) for i in range(len(points))])
        def mesh():
            result=types.SimpleNamespace(vertices=[types.SimpleNamespace(index=i,co=p,groups=[]) for i,p in enumerate(points)],
                polygons=[types.SimpleNamespace(vertices=f,material_index=2 if max(f)>630 else 0,use_smooth=True) for f in faces],
                edges=[],loops=[],attributes=[copy.deepcopy(crease)],uv_layers=ActiveList(),
                materials=[types.SimpleNamespace(name=n) for n in ("white","lining","gold")],
                shape_keys=None,has_custom_normals=False,update=lambda:None)
            def copied():
                duplicate=copy.copy(result)
                for key in ("vertices","polygons","attributes","edges","loops","uv_layers"):
                    setattr(duplicate,key,copy.deepcopy(getattr(result,key)))
                return duplicate
            result.copy=copied
            return result
        identity=[[1.0 if i==j else 0.0 for j in range(4)] for i in range(4)]
        rig=types.SimpleNamespace(name="rosace_rig",matrix_world=identity,
            data=types.SimpleNamespace(bones={"J_Bip_L_UpperArm":types.SimpleNamespace(head_local=Vector((0,0,0))),"J_Bip_L_Hand":types.SimpleNamespace(head_local=Vector((.6,0,0)))}))
        def obj(name):
            mods=[types.SimpleNamespace(name="arm",type="ARMATURE",object=rig,bl_rna=types.SimpleNamespace(properties=[])),
                  types.SimpleNamespace(name="thick",type="SOLIDIFY",thickness=.006,offset=-1.0,bl_rna=types.SimpleNamespace(properties=[]))]
            return Object(name=name,type="MESH",parent=rig,data=mesh(),modifiers=mods,vertex_groups=[],pass_index=5,
                          matrix_world=identity,matrix_basis=identity,matrix_parent_inverse=identity)
        left,right=obj("sleeve.L"),obj("sleeve.R")
        original=(left.data,right.data)
        removed=[]
        fake_bpy=types.SimpleNamespace(data=types.SimpleNamespace(objects={"sleeve.L":left,"sleeve.R":right,"rosace_rig":rig},meshes=types.SimpleNamespace(remove=removed.append)))
        prior_geometry=adapter.C1.G
        with mock.patch.dict(sys.modules,{"bpy":fake_bpy}):
            handle,report=adapter.install(True)
            self.assertIsNot(left.data,original[0])
            self.assertIs(right.data,original[1])
            self.assertTrue(report["bothOriginalMeshesUnchanged"])
            self.assertEqual(adapter.coordinates(original[0]),points)
            self.assertEqual(adapter.C1.digest(adapter.C1.attributes(left.data)),adapter.C1.digest(adapter.C1.attributes(original[0])))
            private=left.data
            adapter.restore(handle)
            self.assertIs(left.data,original[0])
            self.assertIs(right.data,original[1])
            self.assertEqual(removed,[private])
            original[0].has_custom_normals=True
            with self.assertRaisesRegex(ValueError,"custom normals"):
                adapter.install(True)
            self.assertIs(left.data,original[0])
        self.assertIs(adapter.C1.G,prior_geometry)

    def scenario(self, failure):
        hands = module(REPO/"tools/pixel-pipeline/next/nx_hands_blender.py", "cuff2_real_hands_driver")
        recipe = module(REPO/"tools/pixel-pipeline/next/reconstruction_recipe.py", "cuff2_real_recipe")
        recipe.MODE = "prior-sentinel-mode"
        original_face = lambda *args: None
        component = types.SimpleNamespace(facepass=original_face)
        matrix = types.SimpleNamespace(to_scale=lambda:(1.3,1.3,1.3))
        bones = {"J_Bip_"+s+"_Hand":types.SimpleNamespace(matrix=matrix) for s in "LR"}
        arm = types.SimpleNamespace(pose=types.SimpleNamespace(bones=bones))
        posing = types.SimpleNamespace(apply_pose=lambda p:p, grip_hand=lambda *a:None,
                                       hand_rest=lambda *a:None, arm_obj=lambda:arm)
        pose = types.SimpleNamespace(apply_pose=lambda p:p)
        def native_install(config):
            posing.apply_pose = lambda p:pose.apply_pose(p)
            if failure == "install":
                raise RuntimeError("injected install failure")
            return posing.apply_pose
        head = types.SimpleNamespace(install=native_install)
        driver = types.SimpleNamespace(figure_pose=pose, posing=posing, head_scale=head,
                                       f1_module=lambda:component, PASSES=("id","normal"))
        observed = {}
        def native_main():
            driver.f1_module()
            driver.head_scale.install({})
            effective = driver.figure_pose.apply_pose({"name":"idle_appeal"})
            observed["effectivePose"]=effective
            if failure == "driver":
                raise RuntimeError("injected driver failure")
        driver.main=native_main
        def library(path,name):
            if failure == "library":
                raise RuntimeError("injected library failure")
            return driver if path.name=="d9_blender.py" else types.SimpleNamespace()
        hands.library=library
        handle = object()
        restores=[]
        def install(enabled):
            if failure == "geometry":
                raise RuntimeError("injected geometry failure")
            return handle,{"enabled":enabled,"construction":"cuff2"}
        def restore(value):
            restores.append(value)
            if failure == "restore":
                raise RuntimeError("injected restore failure")
        adapter=types.SimpleNamespace(install=install,restore=restore)
        watched=((hands,"library"),(hands,"hand_recipe"),(recipe,"MODE"),
                 (pose,"apply_pose"),(posing,"apply_pose"),(posing,"grip_hand"),(posing,"hand_rest"),
                 (head,"install"),(driver,"f1_module"),(driver,"PASSES"),(component,"facepass"))
        original=[getattr(obj,key) for obj,key in watched]
        old_argv,old_path=sys.argv,sys.path[:]
        blend=HERE/"injected-unused.blend"
        actual_read=Path.read_bytes
        def read(path):
            return b"injected-original-blend" if path==blend else actual_read(path)
        argv=["--cuff-mode","cuff2","--hand-scale","1.3","--shots","idle",
              "--out",str(REPO/"review/rosace/integration/cuff2/injected-never-written"),
              "--blend",str(blend),"--r2",str(REPO/"tools/pixel-pipeline/drive9/r2_model.json")]
        with mock.patch.object(Path,"read_bytes",read), mock.patch.object(hands,"EXPECTED_BLEND",hashlib.sha256(b"injected-original-blend").hexdigest()):
            if failure:
                with self.assertRaisesRegex(RuntimeError,"injected"):
                    T.main(argv,hands=hands,recipe=recipe,adapter=adapter)
            else:
                T.main(argv,hands=hands,recipe=recipe,adapter=adapter)
                self.assertEqual(observed["effectivePose"]["figure"]["torso"]["bend"],recipe.CHANGES["figure.torso.bend"])
        for (obj,key),prior in zip(watched,original):
            self.assertIs(getattr(obj,key),prior,(failure,key))
        self.assertIs(sys.argv,old_argv)
        self.assertEqual(sys.path,old_path)
        self.assertEqual(len(restores),1)
        self.assertIs(restores[0],handle if failure in (None,"driver","restore") else None)

    def test_actual_h1_driver_success_and_exception_cleanup(self):
        for failure in (None,"library","install","geometry","driver","restore"):
            with self.subTest(failure=failure):
                self.scenario(failure)

    def test_actual_adapter_geometry_dependency_restores_on_failure(self):
        import cuff2_blender as adapter
        points,faces,_=old_fixture(.60)
        left=types.SimpleNamespace(data=types.SimpleNamespace(vertices=[types.SimpleNamespace(co=p) for p in points],polygons=[types.SimpleNamespace(vertices=f) for f in faces]))
        right=types.SimpleNamespace(data=left.data)
        sh,wr=Vector((0,0,0)),Vector((.6,0,0))
        rig=types.SimpleNamespace(data=types.SimpleNamespace(bones={"J_Bip_L_UpperArm":types.SimpleNamespace(head_local=sh),"J_Bip_L_Hand":types.SimpleNamespace(head_local=wr)}))
        fake_bpy=types.SimpleNamespace(data=types.SimpleNamespace(objects={"sleeve.L":left,"sleeve.R":right,"rosace_rig":rig}))
        prior=adapter.C1.G
        sentinel=object()
        try:
            for cleanup_failure in (False,True):
                adapter.C1.G=sentinel  # Exact arbitrary prior dependency must survive.
                def failed_install(enabled):
                    self.assertIs(adapter.C1.G,G)
                    raise RuntimeError("injected C1 primitive failure")
                with self.subTest(cleanup_failure=cleanup_failure), mock.patch.dict(sys.modules,{"bpy":fake_bpy}), mock.patch.object(adapter,"structure",lambda obj:{}), mock.patch.object(adapter.C1,"install",side_effect=failed_install), mock.patch.object(adapter.C1,"restore",side_effect=RuntimeError("injected mesh cleanup failure") if cleanup_failure else None) as restore:
                    with self.assertRaisesRegex(RuntimeError,"injected"):
                        adapter.install(True)
                    restore.assert_called_once_with(None)
                self.assertIs(adapter.C1.G,sentinel)
        finally:
            adapter.C1.G=prior


class NativeReceiptGuards(unittest.TestCase):
    def fixture(self):
        import cuff2_native_post as post
        matrices={"hand":[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]}
        _,geometry=G.deform(*old_fixture(.60),True)
        geometry.update(bothOriginalMeshesUnchanged=True,storedRadialMaxErrorM=0.0)
        common={"schema":"rosace.cuff2.native/1","construction":"cuff2","parentSource":post.PARENT,
                "constructionPoseFields":{"gesture":"unchanged"},"windowMode":"unchanged closed",
                "finish":"unchanged R2","evaluatedBoneMatrices":matrices}
        a=dict(common,mode="parent",geometry={"enabled":False})
        b=dict(common,mode="cuff2",geometry=geometry)
        meta={"canvas":[320,240],"anchor":[160,215],"ss":4,"px":80,"cam":{"yaw":60},"ppm":45}
        frozen={"mode":"construction-control","handScale":1.3,"evaluatedBoneMatrices":copy.deepcopy(matrices)}
        grip={"hand_trial":{"scale":1.3},"grips":{"L":{"gap_cm":.0},"R":{"gap_cm":.0}}}
        return post,[copy.deepcopy(v) for v in (a,b,meta,meta,meta,frozen,grip,grip)]

    def test_cuff2_schema_method_pose_camera_grip_guards(self):
        post,records=self.fixture()
        self.assertEqual(post.guard_pair(*records),(0,0,0))
        mutations=((1,"schema","rosace.cuff1.native/1"),(1,"mode","cuff1"),
                   (1,"parentSource","moving-head"),(1,"windowMode","open"),
                   (1,"finish","FC1"),(3,"anchor",[160,214]),(3,"ppm",44))
        for index,field,value in mutations:
            bad=copy.deepcopy(records)
            bad[index][field]=value
            with self.subTest(field=field),self.assertRaises(AssertionError):
                post.guard_pair(*bad)
        for field,value in (("requestedRetreatM",.025),("minAxialGapRatio",float("nan")),
                            ("protectedRows",list(range(15))),("bothOriginalMeshesUnchanged",False),
                            ("cornerJacobiansChecked",0),("storedRadialMaxErrorM",1e-4)):
            bad=copy.deepcopy(records)
            bad[1]["geometry"][field]=value
            with self.subTest(field=field),self.assertRaises(AssertionError):
                post.guard_pair(*bad)
        for index in (1,5):
            bad=copy.deepcopy(records)
            bad[index]["evaluatedBoneMatrices"]["hand"][0][3]=.01
            with self.assertRaises(AssertionError):
                post.guard_pair(*bad)
        for gap in (float("nan"),-1,2):
            bad=copy.deepcopy(records)
            for index in (6,7):
                bad[index]["grips"]["L"]["gap_cm"]=gap
            with self.assertRaises(AssertionError):
                post.guard_pair(*bad)

    def test_frozen_hash_binding_complete_exact_and_mutation_rejected(self):
        import cuff2_native_post as post
        root=Path("D:/Dex/Temp/injected-frozen-bcb")
        filenames={f"idle/px{px}/{filename}" for px in (144,80) for filename in (*post.C1.PASSES,"meta.json","haft_grips.json","reconstruction.json")}
        binding={"schema":"rosace.cuff2.frozen-parent/1","parentSource":post.PARENT,"root":str(root),
                 "sha256":{name:hashlib.sha256(b"frozen").hexdigest() for name in filenames}}
        with mock.patch.object(post,"read",return_value=binding),mock.patch.object(Path,"read_bytes",return_value=b"frozen"):
            self.assertEqual(post.guard_frozen(root),binding)
        with mock.patch.object(post,"read",return_value=binding),mock.patch.object(Path,"read_bytes",return_value=b"changed"):
            with self.assertRaisesRegex(AssertionError,"changed"):
                post.guard_frozen(root)
        incomplete=copy.deepcopy(binding)
        incomplete["sha256"].pop(next(iter(filenames)))
        with mock.patch.object(post,"read",return_value=incomplete):
            with self.assertRaisesRegex(AssertionError,"omits"):
                post.guard_frozen(root)


def main():
    suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromTestCase(cls) for cls in (Geometry,WrapperCleanup,NativeReceiptGuards))
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    report={"schema":"rosace.cuff2.cpu/1","kind":"CPU source fixtures and injected actual-wrapper cleanup",
            "sourceBase":"bd94059a13d5becd68b80c0d219fdb6ad1d989f9","tests":result.testsRun,
            "passed":result.wasSuccessful(),"nativeExecuted":False,"visualAcceptance":False,
            "fixtureSource":"actual F3 sleeves_f3.point AST; unchanged rejected C1 check_cuff.fixture(.28)",
            "cleanupSource":"actual cuff2_trial.main and actual nx_hands_blender.main; injected native dependencies",
            "sourceHashes":{str(path.relative_to(REPO)):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(HERE.glob("*.py"))}}
    (HERE/"cpu-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8",newline="\n")
    print(json.dumps(report))
    return 0 if result.wasSuccessful() else 1


if __name__=="__main__":
    raise SystemExit(main())
