"""Sole-delivery entry: pinned body + evaluated action + one chronological Cloth bake.

Importing performs no native action. Invoke only inside delivery's exclusive
native/GPU turn after freeze_body has bound the completed construction result.
No model launch, scene save, canonical/default edit, export or publication.
"""
import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
import motion_fx_contract as C
import native_motion_channels as channels
PIPE=C.REPO/"tools/pixel-pipeline"


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--body-binding",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args(argv)
    binding=C.read(a.body_binding)
    C.validate_binding(binding)  # before opening a scene or starting the native action
    output=a.out.resolve()
    if output.exists() or not (C.REPO/"review/rosace/physics").resolve() in output.parents:
        raise ValueError("fresh private physics output required")
    import bpy
    from mathutils import Vector
    sys.path[:0]=[str(PIPE),str(PIPE/"drive9"),str(PIPE/"next"),str(C.REPO/"tools/motion-ai"),
        str(C.REPO/"art/rosace/specialists/motion")]
    import nx_hands_blender as H
    import nx_window_mesh_blender as W
    import author_sequence as A
    import native_driver as N
    import hero_layer as HL
    import rig_measure
    from rosace import posing,materials,render
    driver=H.library(PIPE/"drive9/d9_blender.py","motion_body_driver")
    old_apply=posing.apply_pose
    blend=Path("D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend")
    if C.sha(blend)!=C.BLEND_SHA: raise ValueError("preserved canonical blend changed")
    scratch=output.parent/(output.name+"-preparation")
    if scratch.exists(): raise ValueError("fresh body preparation scratch required")
    scratch.mkdir(parents=True)
    try:
        bpy.ops.wm.open_mainfile(filepath=str(blend))
        scene=bpy.context.scene
        materials.rebind()
        render.setup_engine(scene)
        import r2_blender,r5_blender
        model=C.read(PIPE/"drive9/r2_model.json")
        r2_blender.mesh_edits(model.get("mesh_edits"))
        r2_blender.circlet(model.get("circlet"))
        if model.get("pin"): r5_blender.pin(model["pin"])
        for name in list(materials.PASS_NODES): driver.add_noise_pass(name)
        driver.head_scale.install(binding["head"])
        head_apply=posing.apply_pose
        def apply(pose):
            pose=copy.deepcopy(pose)
            for side in "LR": pose.setdefault("bones",{})[f"J_Bip_{side}_Hand.scale"]=binding["handScale"]
            return head_apply(pose)
        posing.apply_pose=apply
        state={"preservationOutput":str(scratch/"mesh-preservation")}
        W.install(state)
        # The Cloth colliders must actually contain current hands/forearms.
        body=bpy.data.objects["body"]
        limb_groups={f"J_Bip_{s}_{part}":body.vertex_groups.get(f"J_Bip_{s}_{part}")
            for s in "LR" for part in ("Hand","LowerArm")}
        collision_counts={n:sum(any(g.group==group.index and g.weight>0 for g in v.groups)
            for v in body.data.vertices) if group else 0 for n,group in limb_groups.items()}
        if any(v==0 for v in collision_counts.values()):
            raise ValueError("body collider lacks actual constructed hand/forearm weights")
        arm=posing.arm_obj()
        # Fit H once before native_driver captures its root-distance scale.
        posing.apply_pose(A.read(C.REPO/"art/rosace/poses/idle_hero.json"))
        planner=C.REPO/"art/rosace/specialists/attacks/n1-n2.json"
        packet=A.export(planner,scratch/"motion-ticks.json")
        C.validate_ticks(packet)
        with channels.bridge(HL,posing,rig_measure,arm,binding["handScale"]) as expected:
            proof=N.build_action(planner,scratch/"motion-ticks.json")
        if not proof["numericGatesPassed"]: raise ValueError("native motion numeric gate failed")
        proof["postKeyEvaluation"]=channels.verify_keyed(scene,arm,expected,posing)
        proof["bodyBindingSha256"]=C.sha(a.body_binding)
        proof["bodyId"]=binding["bodyId"]
        C.write(scratch/"native-driver.json",proof)
        # Fixed large FX corridor, equal H/ppm, integer world origin; no zoom.
        shots={px:{"canvas":[6*px,4*px],"anchor":[3*px,7*px//2]} for px in (80,144)}
        frame_records=[]
        f1=driver.f1_module()
        def capture(sc,frame,geometry_root,cloth):
            row=packet["ticks"][frame-1] if frame else {"clip":"idle","tick":0,"recipe":"stance"}
            for px in (80,144):
                directory=scratch/("cloth-on" if cloth else "cloth-off")/f"f{frame:03d}/px{px}"
                directory.mkdir(parents=True)
                shot=render.setup_shot(sc,px,yaw=60,elev=8,ss=4,**shots[px])
                render.render_passes(sc,str(directory),(*driver.PASSES,"depth2"),frames=None)
                driver.set_noise_scale(px)
                materials.set_pass("noise")
                sc.render.filepath=str(directory/"noise.png")
                bpy.ops.render.render(write_still=True)
                materials.set_pass("beauty")
                anchors=posing.anchors(sc,px)
                for s in "LR":
                    anchors[f"toe_{s}"]=render.project(sc,arm.matrix_world@arm.pose.bones[f"J_Bip_{s}_ToeBase"].head)
                anchors["depth_plane"]=render.project(sc,arm.matrix_world@arm.pose.bones["J_Bip_C_UpperChest"].head)
                dg=bpy.context.evaluated_depsgraph_get()
                ring=state.get("ring")
                # W.install returns the ring; recover its exact object via part/id.
                if ring is None:
                    ring=next(o for o in sc.objects if o.name.startswith("rosace_window2_gold_rim"))
                ev=ring.evaluated_get(dg)
                mesh=ev.to_mesh()
                try: boundary=[render.project(sc,ev.matrix_world@v.co) for v in mesh.vertices[:len(mesh.vertices)//2]]
                finally: ev.to_mesh_clear()
                geometry=geometry_root/f"fabric-{frame:05d}.json" if cloth else None
                identity={"simulationFrame":frame,"bodyBindingSha256":proof["bodyBindingSha256"],
                    "driverSha256":C.sha(scratch/"native-driver.json"),"solverEpoch":str(output) if cloth else "legacy-static-guide-control",
                    "clothGeometrySha256":C.sha(geometry) if geometry else None,
                    "bodyId":binding["bodyId"],"sceneSha256":C.BLEND_SHA}
                render.write_meta(str(directory/"meta.json"),shot,{"anchors":anchors,
                    "pose":row["recipe"],"motionRow":row,"nativeIdentity":identity,
                    "windowBoundarySS":boundary,"d9":{"shot":"motion","expr":row["recipe"],"head":binding["head"]},
                    "passes":[*driver.PASSES,"depth2","noise"]})
                meta=C.read(directory/"meta.json")
                f1.facepass(sc,meta,str(directory))
                frame_records.append({"frame":frame,"px":px,"cloth":cloth,"raw":str(directory),"identity":identity,
                    "rawSha256":{n:C.sha(directory/n) for n in ("id.png","normal.png","depth.png","depth2.png","meta.json","facepass.json","noise.png","light.png","beauty.png")}})
                print(f"MOTION FRAME {frame}/77 H{px} cloth={cloth}",flush=True)
        # Off is a bounded diagnostic: no simulator, identical body/action/camera.
        for f in (0,9,15,16,23,53,77):
            scene.frame_set(f)
            posing.update()
            capture(scene,f,scratch,False)
        scene.frame_set(0)
        posing.update()
        bake=N.physical_bake(scene,output,lambda sc,f,g:capture(sc,f,g,True),77,proof)
        setup=C.read(output/"setup.json")
        if "body" not in setup["colliders"] or {r["object"] for r in setup["garments"]}!={"tabard","sleeve.L","sleeve.R"}:
            raise ValueError("actual three garments/body collision installation incomplete")
        C.write(scratch/"native-batch.json",{"contract":"rosace.n1-n2-native-batch/1","bodyId":binding["bodyId"],
            "binding":str(a.body_binding.resolve()),"packet":str(scratch/"motion-ticks.json"),"driver":str(scratch/"native-driver.json"),
            "bake":str(output/"bake.json"),"collisionWeightedVertices":collision_counts,"frames":frame_records,
            "status":"native generated; finish/FX/playback/visual checks pending","runtimeExported":False})
    finally:
        posing.apply_pose=old_apply
        if C.sha(blend)!=C.BLEND_SHA: raise AssertionError("canonical blend changed")


if __name__=="__main__":
    main(sys.argv[sys.argv.index("--")+1:])
