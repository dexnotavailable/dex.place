"""Delivery-only coherent authored reconstruction, one native entry dispatch.

Control: original R2, all new hooks disabled, hand1.0. Candidate: explicit
gesture recipe through the reviewed H1 seated1.30 solve, actual W2 copied-mesh
aperture before pose, then genuine pose/contact/window landmark capture.
No image input, AI raster paste, blend save or canonical replacement.
"""
import copy
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
import nx_hands_blender as H
import nx_window_mesh_blender as W
import reconstruction_recipe as R


def main():
    argv=sys.argv[sys.argv.index("--")+1:]
    mode=H.argument(argv,"--reconstruction-mode")
    if mode not in ("control","construction-control","reconstruction"):
        raise ValueError("explicit control/construction-control/reconstruction mode required")
    scale=float(H.argument(argv,"--hand-scale","1.0"))
    if scale != (1.0 if mode=="control" else 1.3) or H.argument(argv,"--shots") != "idle":
        raise ValueError("control1.0 or explicit reconstruction1.30, idle only")
    output=Path(H.argument(argv,"--out")).resolve()
    if not (H.REPO/"review/rosace").resolve() in output.parents:
        raise ValueError("fresh output in executing private review tree required")
    original_library,original_recipe=H.library,H.hand_recipe
    state={"mode":mode,"handScale":scale,"recipeHash":R.recipe_hash(),
        "sourceGuideRole":"additional semantic reference only; no raster input"}
    R.MODE="control" if mode=="control" else "reconstruction"

    def library(path,name):
        module=original_library(path,name)
        if path.resolve() != (H.PIPE/"drive9/d9_blender.py").resolve():
            return module
        prior_apply=module.figure_pose.apply_pose
        state["poseApply"]=(module.figure_pose,prior_apply)
        def apply_pose(pose):
            state["effectivePose"]=copy.deepcopy(pose)
            return prior_apply(pose)
        module.figure_pose.apply_pose=apply_pose
        if mode != "reconstruction":
            return module
        prior_install=module.head_scale.install
        state["headInstall"]=(module.head_scale,prior_install)
        def install(cfg):
            result=prior_install(cfg)
            original,ring,report=W.install(state)
            state.update(originalMesh=original,ring=ring,window=report)
            return result
        module.head_scale.install=install
        prior_f1=module.f1_module
        state["f1Module"]=(module,prior_f1)
        def f1():
            component=prior_f1()
            prior_face=component.facepass
            state["faceComponent"]=(component,prior_face)
            def face(scene,meta,directory):
                prior_face(scene,meta,directory)
                import bpy
                from bpy_extras.object_utils import world_to_camera_view
                ring=state["ring"]
                evaluated=ring.evaluated_get(bpy.context.evaluated_depsgraph_get())
                coords=[]
                for v in evaluated.data.vertices:
                    p=world_to_camera_view(scene,scene.camera,evaluated.matrix_world@v.co)
                    coords.append([p.x*scene.render.resolution_x/meta["ss"],
                                   (1-p.y)*scene.render.resolution_y/meta["ss"],p.z])
                window=dict(state["window"],boundaryProjectedPx=coords[:len(coords)//2],
                    rimOuterProjectedPx=coords[len(coords)//2:],px=meta["px"])
                Path(directory,"window_geometry.json").write_text(json.dumps(window,indent=2))
            component.facepass=face
            return component
        module.f1_module=f1
        return module
    H.library=library
    if mode!="control":
        H.hand_recipe=R
    try:
        H.main()
        for px in (144,80):
            raw=output/"idle"/f"px{px}"
            contact=json.loads((raw/"haft_grips.json").read_text())
            record={k:v for k,v in state.items() if k in ("mode","handScale","recipeHash","sourceGuideRole","window")}
            import bpy
            rig=bpy.data.objects["rosace_rig"]
            record.update(changedPoseFields=R.CHANGES if mode!="control" else {},
                effectivePose=state["effectivePose"],
                evaluatedBoneMatrices={b.name:[[float(v) for v in row] for row in b.matrix] for b in rig.pose.bones},
                contact=contact.get("grips"),px=px,
                sourceRecipeSha256=hashlib.sha256(Path(R.__file__).read_bytes()).hexdigest(),
                limits="integrated letter; no attribution to individual levers, real skin/rim/pose/grip pixels and3freshcritics required")
            Path(raw,"reconstruction.json").write_text(json.dumps(record,indent=2))
    finally:
        H.library,H.hand_recipe=original_library,original_recipe
        R.MODE="control"
        for key,attribute in (("poseApply","apply_pose"),("headInstall","install"),("f1Module","f1_module"),("faceComponent","facepass")):
            if key in state:
                setattr(state[key][0],attribute,state[key][1])
        if "originalMesh" in state:
            import bpy
            bpy.data.objects["bodice"].data=state["originalMesh"]
        if "ring" in state:
            import bpy
            bpy.data.objects.remove(state["ring"],do_unlink=True)


if __name__=="__main__":
    main()
