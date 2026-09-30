"""CPU fixtures only: real925 wrappers, fake native dependency boundaries."""
import copy
import ast
import hashlib
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest import mock
import numpy as np

import probe_entry as E
import probe_math as M
import probe_native as N
from probe_shot import ShotSnapshot

HERE=Path(__file__).resolve().parent


def module(path,name):
    prior=sys.path[:]
    try:
        sys.path.insert(0,str(path.parent))
        spec=importlib.util.spec_from_file_location(name,path)
        result=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(result)
        return result
    finally:
        sys.path[:]=prior


def shot():
    return {"px":144,"ss":4,"canvas":[20,20],"anchor":[10,10],"ppm":10.,"height_m":14.4,
            "cam":{"loc":[0,0,10],"right":[1,0,0],"up":[0,1,0],"fwd":[0,0,-1]}}


class MathAndFilter(unittest.TestCase):
    def test_runtime_driver_module_origins(self):
        def component(relative):return types.SimpleNamespace(__file__=str(E.PIPE/relative))
        driver=component("drive9/d9_blender.py")
        driver.render=component("rosace/render.py");driver.materials=component("rosace/materials.py")
        driver.posing=component("rosace/posing.py");driver.figure_pose=component("rosace_v2/figure_pose.py")
        driver.head_scale=component("finish_f2/head_scale.py")
        N.check_origins(driver,E.REPO)
        driver.render.__file__="D:/Dex/Temp/wrong-repo/render.py"
        with self.assertRaises(ValueError):N.check_origins(driver,E.REPO)

    def test_frozen_camera_and_projection_ray(self):
        expected=shot();M.check_shot(copy.deepcopy(expected),expected)
        self.assertEqual(M.project([[.2,.3,0]],expected).tolist(),[[12.,7.]])
        origin,direction=M.ray_for([47,27],expected,.1)
        self.assertAlmostEqual(origin[0],.1875)
        self.assertAlmostEqual(origin[1],.3125)
        self.assertAlmostEqual(origin[2],9.9)
        self.assertEqual(direction.tolist(),[0,0,-1])
        for key,value in (("px",80),("ss",1),("anchor",[9,10]),("ppm",9.0)):
            bad=copy.deepcopy(expected);bad[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):M.check_shot(bad,expected)
        bad=copy.deepcopy(expected);bad["cam"]["loc"][0]=float("nan")
        with self.assertRaises(ValueError):M.check_shot(bad,expected)

    def test_hand_only_union_and_edge_on_geometry_are_not_gpu_coverage(self):
        triangles=np.array([[[10,10],[11,10],[10,11]],[[10,10],[10,11],[11,10]]],float)
        cells,summary=M.footprint(triangles,shot())
        self.assertEqual(len(cells),10)
        self.assertEqual(summary["anyCentreCoveredNativeCells"],1)
        self.assertEqual(summary["summedTriangleAreaNativePx2OverlapCounted"],1)
        with self.assertRaises(ValueError):M.footprint(np.full((1,3,2),np.nan),shot())
        with self.assertRaises(ValueError):M.footprint(np.array([[[0,0],[1000,0],[0,1000]]]),dict(shot(),canvas=[1000,1000]))

    def test_hidden_refs_layers_modifiers_and_camera_semantics(self):
        r={"hideRender":False,"cameraVisible":True,"renderLayerExcluded":False,"viewportVisible":True,"modifierVisibilityMismatch":[]}
        self.assertEqual(M.render_policy(r),("possible",[]))
        for key in ("hideRender","renderLayerExcluded"):
            self.assertEqual(M.render_policy(dict(r,**{key:True}))[0],"excluded")
        self.assertTrue(M.render_policy(dict(r,viewportVisible=False))[1])
        self.assertTrue(M.render_policy(dict(r,modifierVisibilityMismatch=[["arm",False,True]]))[1])
        self.assertEqual(M.render_policy(dict(r,cameraVisible=False))[0],"possible")
        self.assertEqual(M.render_policy(dict(r,cameraVisible=False,cameraVisibilitySupported=True))[0],"excluded")

    def test_unknown_transparency_is_not_an_opaque_winner(self):
        hits=[{"depthM":2.,"opacity":"unknown","uncertainties":[],"object":"unknown-window"},
              {"depthM":3.,"opacity":"categorical-opaque","uncertainties":[],"object":"hand"}]
        report=M.classify_hits(hits)
        self.assertEqual(report["knownOpaqueCentreCandidate"]["object"],"hand")
        self.assertTrue(report["ambiguousBeforeKnownCandidate"])
        self.assertEqual(N.opacity(types.SimpleNamespace(name="unknown",use_backface_culling=False),{}),("unknown",False))
        nodes={"id":types.SimpleNamespace(type="EMISSION"),"depth2":types.SimpleNamespace(type="EMISSION")}
        self.assertEqual(N.opacity(types.SimpleNamespace(name="skin",use_backface_culling=True),{"skin":nodes}),("categorical-opaque",True))

    def test_fake_bvh_backface_queries_and_cleanup_failure(self):
        class Vec(np.ndarray):
            def dot(self,other):return float(np.asarray(self)@np.asarray(other))
        def vector(value):return np.asarray(value,float).view(Vec)
        calls=[]
        def cast(origin,direction,distance):
            calls.append(origin.copy())
            normal=vector([0,0,-1] if len(calls)==1 else [0,0,1])
            return origin+direction,normal,0,1.
        actor={"tree":types.SimpleNamespace(ray_cast=cast),"record":{"object":"cuff","part":30,"uncertainties":[]},
               "faces":[{"backfaceCulling":True,"opacity":"categorical-opaque"}]}
        hit=N.ray_actor(actor,np.array([0,0,10.]),np.array([0,0,-1.]),.1,20.,vector)
        self.assertEqual(len(calls),2);self.assertAlmostEqual(hit["depthM"],2.100001)
        freed=[]
        def broken():freed.append("broken");raise RuntimeError("clear failure")
        with self.assertRaisesRegex(RuntimeError,"cleanup"):
            N.release_meshes([types.SimpleNamespace(to_mesh_clear=lambda:freed.append("other")),types.SimpleNamespace(to_mesh_clear=broken)])
        self.assertEqual(freed,["broken","other"])

    def test_actual_limb_rules_audit_original_hand_finger_weights(self):
        source=E.PIPE/"rosace_v2/limbs.py"
        tree=ast.parse(source.read_text())
        nodes=[node for node in tree.body if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=="LIMBS" for t in node.targets) or isinstance(node,ast.FunctionDef) and node.name=="limb_of"]
        scope={};exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),"exec"),scope)
        obj=types.SimpleNamespace(vertex_groups=[types.SimpleNamespace(index=0,name="J_Bip_L_Middle1"),types.SimpleNamespace(index=1,name="J_Bip_L_LowerArm")],
            data=types.SimpleNamespace(polygons=[types.SimpleNamespace(vertices=(0,1,2))],vertices=[types.SimpleNamespace(groups=[types.SimpleNamespace(group=0,weight=.6),types.SimpleNamespace(group=1,weight=.4)]) for _ in range(3)]))
        with mock.patch.dict(sys.modules,{"rosace_v2":types.SimpleNamespace(__path__=[]),"rosace_v2.limbs":types.SimpleNamespace(limb_of=scope["limb_of"])}):
            audit=N.face_weights(obj,0)
        self.assertEqual(audit["dominantSourceLimb"],14)
        self.assertAlmostEqual(audit["handFingerWeightSum"],1.8)
        self.assertAlmostEqual(audit["limbWeightSums"][12],1.2)

    def test_actual_camera_and_pass_snapshot_restores_all_values_and_owned_objects(self):
        class Objects(list):
            def get(self,name):return next((o for o in self if o.name==name),None)
        def obj(name,kind):
            result=types.SimpleNamespace(name=name,type=kind,data=types.SimpleNamespace(users=1,ortho_scale=4.,clip_start=.1,clip_end=34.),
                location=[1,2,3],rotation_mode="XYZ",rotation_quaternion=[1,0,0,0],rotation_euler=[.1,.2,.3],rotation_axis_angle=[0,1,0,0])
            result.as_pointer=lambda:id(result)
            return result
        camera,light=obj("render_cam","CAMERA"),obj("key_light","LIGHT")
        scene=types.SimpleNamespace(objects=Objects([camera,light]),camera=camera,
            render=types.SimpleNamespace(resolution_x=10,resolution_y=20,resolution_percentage=100,filepath="before"))
        sockets=[types.SimpleNamespace(default_value=v) for v in (.2,.3,.4)]
        mins={name:types.SimpleNamespace(default_value=value) for name,value in (("From Min",9.),("From Max",15.))}
        nodes={"spec_h":types.SimpleNamespace(inputs=sockets),"depth_map":types.SimpleNamespace(inputs=mins)}
        bpy=types.SimpleNamespace(data=types.SimpleNamespace(materials={"skin":types.SimpleNamespace(node_tree=types.SimpleNamespace(nodes=nodes))}))
        driver=types.SimpleNamespace(materials=types.SimpleNamespace(PASS_NODES={"skin":{}}))
        snapshot=ShotSnapshot(scene,driver,bpy)
        camera.location=[7,8,9];camera.rotation_mode="QUATERNION";camera.data.clip_end=99.;scene.render.filepath="after"
        sockets[0].default_value=.99;mins["From Min"].default_value=2.
        snapshot.restore()
        self.assertEqual(camera.location,[1,2,3]);self.assertEqual(camera.rotation_mode,"XYZ")
        self.assertEqual(camera.data.clip_end,34.);self.assertEqual(scene.render.filepath,"before")
        self.assertEqual(sockets[0].default_value,.2);self.assertEqual(mins["From Min"].default_value,9.)
        scene.objects=Objects();scene.camera=None
        removed=[]
        def remove(o,do_unlink):scene.objects.remove(o);o.data.users-=1
        bpy.data.objects=types.SimpleNamespace(remove=remove)
        bpy.data.cameras=types.SimpleNamespace(remove=lambda data:removed.append("camera"))
        bpy.data.lights=types.SimpleNamespace(remove=lambda data:removed.append("light"))
        snapshot=ShotSnapshot(scene,driver,bpy)
        scene.objects.extend([obj("render_cam.001","CAMERA"),obj("key_light.001","LIGHT")]);scene.camera=scene.objects[0]
        snapshot.restore()
        self.assertIsNone(scene.camera);self.assertFalse(scene.objects);self.assertEqual(removed,["camera","light"])


class ActualWrappers(unittest.TestCase):
    def scenario(self,failure=None):
        T=module(E.C2/"cuff2_trial.py","probe_real_T")
        H=module(E.PIPE/"next/nx_hands_blender.py","probe_real_H")
        R=module(E.PIPE/"next/reconstruction_recipe.py","probe_real_R")
        R.MODE="original sentinel"
        saved=object();private=types.SimpleNamespace(name="private-probe-copy")
        obj=types.SimpleNamespace(data=saved)
        meshes={}
        component=types.SimpleNamespace(facepass=lambda *a:None)
        matrix=types.SimpleNamespace(to_scale=lambda:(1.3,1.3,1.3))
        arm=types.SimpleNamespace(pose=types.SimpleNamespace(bones={"J_Bip_"+s+"_Hand":types.SimpleNamespace(matrix=matrix) for s in "LR"}))
        posing=types.SimpleNamespace(apply_pose=lambda p:p,grip_hand=lambda *a:None,hand_rest=lambda *a:None,arm_obj=lambda:arm)
        figure=types.SimpleNamespace(apply_pose=lambda p:p)
        def head_install(cfg):posing.apply_pose=lambda p:figure.apply_pose(p)
        render=types.SimpleNamespace(setup_shot=lambda scene,px,**kw:dict(shot(),ppm=9.0 if failure=="camera" else 10.0),render_passes=lambda *a:None)
        driver=types.SimpleNamespace(posing=posing,figure_pose=figure,head_scale=types.SimpleNamespace(install=head_install),
            f1_module=lambda:component,PASSES=("id","beauty"),render=render)
        def install(enabled):
            obj.data=private;meshes[private.name]=private
            return (obj,saved,private),{"enabled":True}
        def restore(handle):
            if handle:
                obj.data=saved;meshes.pop(private.name,None)
            if failure=="mesh-cleanup":raise RuntimeError("mesh-cleanup failure")
        C=types.SimpleNamespace(install=install,restore=restore)
        bpy=types.SimpleNamespace(ops=types.SimpleNamespace(render=types.SimpleNamespace(render=lambda **kw:None),wm=types.SimpleNamespace(open_mainfile=lambda **kw:None)),
                                  data=types.SimpleNamespace(meshes=types.SimpleNamespace(get=meshes.get)))
        def main():
            driver.f1_module();driver.head_scale.install({})
            driver.figure_pose.apply_pose({"name":"idle_appeal"})
            driver.render.setup_shot(None,144,ss=4)
            driver.render.render_passes(None,"private",driver.PASSES)
        driver.main=main
        H.library=lambda path,name:driver if path.name=="d9_blender.py" else types.SimpleNamespace()
        restored=[]
        class Snapshot:
            def __init__(self,*a):pass
            def restore(self):
                restored.append(True)
                if failure=="shot-cleanup":raise RuntimeError("shot-cleanup failure")
        def capture(*args):
            if failure=="capture":raise RuntimeError("capture failure")
            if failure=="forbidden":bpy.ops.render.render(write_still=True)
            if failure=="wrong-stop":raise E.DiagnosticStop("unexpected stop")
            return {"causeEstablished":False}
        watched=[(H,"library"),(H,"hand_recipe"),(R,"MODE"),(C,"install"),(bpy,"ops"),
                 (posing,"apply_pose"),(posing,"grip_hand"),(posing,"hand_rest"),(figure,"apply_pose"),
                 (driver.head_scale,"install"),(driver,"f1_module"),(driver,"PASSES"),(render,"setup_shot"),(render,"render_passes"),(component,"facepass")]
        originals=[getattr(owner,key) for owner,key in watched]
        old_path,old_argv=sys.path[:],sys.argv
        blend=HERE/"unused-test.blend"
        original_read=Path.read_bytes
        def read(path):return b"fixture canonical" if path==blend else original_read(path)
        argv=["--cuff-mode","cuff2","--hand-scale","1.3","--shots","idle","--blend",str(blend),
              "--r2",str(E.PIPE/"drive9/r2_model.json"),"--out",str(E.REPO/"review/rosace/integration/cuff2/probe-fixture-never-written")]
        with mock.patch.object(Path,"read_bytes",read),mock.patch.object(H,"EXPECTED_BLEND",hashlib.sha256(b"fixture canonical").hexdigest()):
            if failure:
                with self.assertRaises((RuntimeError,ValueError,E.DiagnosticStop)):
                    E.execute(T,H,R,C,bpy,argv,{"meta":shot()},capture,Snapshot)
            else:
                result=E.execute(T,H,R,C,bpy,argv,{"meta":shot()},capture,Snapshot)
                self.assertEqual(result["nativeRenderedImages"],0)
        for (owner,key),old in zip(watched,originals):self.assertIs(getattr(owner,key),old,(failure,key))
        self.assertEqual(sys.path,old_path);self.assertIs(sys.argv,old_argv)
        self.assertIs(obj.data,saved);self.assertFalse(meshes);self.assertEqual(len(restored),1)

    def test_actual925_wrappers_controlled_stop_and_all_failure_cleanup(self):
        for failure in (None,"camera","capture","forbidden","wrong-stop","mesh-cleanup","shot-cleanup"):
            with self.subTest(failure=failure):self.scenario(failure)

    def test_operator_guard_denies_images_saves_bakes_without_calling_original(self):
        calls=[]
        source=types.SimpleNamespace(render=types.SimpleNamespace(render=lambda **kw:calls.append("render")),
            wm=types.SimpleNamespace(save_as_mainfile=lambda **kw:calls.append("save"),open_mainfile=lambda **kw:calls.append("open")),
            object=types.SimpleNamespace(bake=lambda **kw:calls.append("bake")))
        guard=E.OpsGuard(source)
        for func in (guard.render.render,guard.wm.save_as_mainfile,guard.object.bake):
            with self.assertRaises(RuntimeError):func()
        guard.wm.open_mainfile()
        self.assertEqual(calls,["open"]);self.assertEqual(len(guard.attempts),3)

    def test_entry_import_without_own_path_or_cached_math_restores_path(self):
        original_path=sys.path[:];prior=sys.modules.pop("probe_math",None)
        try:
            sys.path[:]=[p for p in sys.path if Path(p or ".").resolve()!=HERE]
            clean=sys.path[:]
            spec=importlib.util.spec_from_file_location("probe_native_bootstrap_fixture",HERE/"probe_entry.py")
            entry=importlib.util.module_from_spec(spec);spec.loader.exec_module(entry)
            self.assertEqual(sys.path,clean);self.assertTrue(callable(entry.execute))
        finally:
            sys.path[:]=original_path
            if prior is None:sys.modules.pop("probe_math",None)
            else:sys.modules["probe_math"]=prior


def main():
    suite=unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromTestCase(cls) for cls in (MathAndFilter,ActualWrappers))
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    binding=json.loads((HERE/"input-bindings.json").read_text())
    E.verify_bindings(binding)
    report={"schema":"rosace.hand-visibility-probe.cpu/1","sourceBase":binding["renderSource"],
            "tests":result.testsRun,"passed":result.wasSuccessful(),"nativeExecuted":False,"nativeRenderedImages":0,
            "limits":"native bpy/BVH/evaluated-mesh APIs are unexecuted; fake boundaries do not prove native geometry or renderer occlusion",
            "inputBindingsSha256":hashlib.sha256((HERE/"input-bindings.json").read_bytes()).hexdigest(),
            "sourceHashes":{str(path.relative_to(E.REPO)):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(HERE.glob("*.py"))}}
    (HERE/"cpu-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8",newline="\n")
    print(json.dumps(report));return 0 if result.wasSuccessful() else 1


if __name__=="__main__":raise SystemExit(main())
