"""Finite delivery-only R2 control vs semantic FC1; C1 cuff not imported."""
import copy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
PIPE = REPO/"tools/pixel-pipeline"
sys.path.insert(0,str(HERE))
sys.path.insert(0,str(PIPE/"next"))
import nx_hands_blender as H
import facecage_blender as C


def main():
    argv = sys.argv[sys.argv.index("--")+1:]
    mode = H.argument(argv,"--facecage-mode")
    if mode not in ("control","facecage1") or H.argument(argv,"--hand-scale")!="1.0" or H.argument(argv,"--shots")!="idle,back":
        raise ValueError("explicit control/facecage1,hand1.0 and matched idle,back required")
    output = Path(H.argument(argv,"--out")).resolve()
    if not (REPO/"review/rosace/specialists/refinement/facecage").resolve() in output.parents:
        raise ValueError("fresh executing-worktree private facecage output required")
    original_library = H.library
    state = {}

    def library(path,name):
        module = original_library(path,name)
        if path.resolve()!=(PIPE/"drive9/d9_blender.py").resolve():
            return module
        prior_install = module.head_scale.install
        prior_anchors = module.posing.anchors
        prior_apply_pose = module.posing.apply_pose
        prior_f1 = module.f1_module
        state["restore"] = (module,prior_install,prior_anchors,prior_apply_pose,prior_f1)
        def install(cfg):
            result = prior_install(cfg)
            state["cage"] = C.install(mode=="facecage1")
            return result
        def anchors(scene,px):
            result = prior_anchors(scene,px)
            if mode=="control":
                return result
            original = {s:copy.deepcopy(result[f"eye_{s}"]) for s in "LR"}
            placement = C.placement(state["cage"],scene)
            for side in "LR":
                result[f"eye_{side}"] = placement["eyes"][side]+[original[side][3]]
            result["facecage_rig_eye_anchors"] = original
            result["facecage_eye_placement"] = placement["eyes"]
            result["facecage_anchor_role"] = "cage geometry placement only; actual eye bones/pose/facing unchanged"
            return result
        def f1():
            component = prior_f1()
            prior_face = component.facepass
            def face(scene,meta,directory):
                prior_face(scene,meta,directory)
                cage = state["cage"]
                if mode!="control":
                    path = Path(directory,"facepass.json")
                    fp = json.loads(path.read_text())
                    place = C.placement(cage,scene)
                    fp["facecage_source_heuristic_nose_chin"] = {k:fp[k] for k in ("nose","chin")}
                    fp["nose"],fp["chin"] = [round(v/meta["ss"],3) if i<2 else round(v,4) for i,v in enumerate(place["nose"])], [round(v/meta["ss"],3) if i<2 else round(v,4) for i,v in enumerate(place["chin"])]
                    fp["cage_eye_placement"] = {s:[round(v/meta["ss"],3) if i<2 else round(v,4) for i,v in enumerate(p)] for s,p in place["eyes"].items()}
                    fp["facecage_landmark_role"] = "frozen original semantic vertex IDs projected from actual evaluated candidate; actual eye_bones retained"
                    path.write_text(json.dumps(fp,indent=2),encoding="utf-8")
                import bpy
                rig = bpy.data.objects["rosace_rig"]
                record = {"mode":mode,"geometry":cage["report"],"px":meta["px"],
                    "evaluatedBoneMatrices":{b.name:[list(row) for row in b.matrix] for b in rig.pose.bones},
                    "headMetrics":{k:list(v) if hasattr(v,"__len__") and not isinstance(v,str) else v for k,v in rig["head_metrics"].items()},"finish":"exact unchanged R2 ramps/stamps/expressions",
                    "cuffC1Included":False,"bodyPoseChanged":False,"eyeRigChanged":False,
                    "limits":"new geometry/placement only; stamp fit/fringe/openness/jaw/profile need actual native144/80 and3freshcritics"}
                Path(directory,"facecage_trial.json").write_text(json.dumps(record,indent=2),encoding="utf-8")
            component.facepass = face
            return component
        module.head_scale.install,module.posing.anchors,module.f1_module = install,anchors,f1
        return module
    H.library = library
    try:
        H.main()
    finally:
        H.library = original_library
        if "restore" in state:
            module,install,anchors,apply_pose,f1 = state["restore"]
            module.head_scale.install,module.posing.anchors,module.posing.apply_pose,module.f1_module = install,anchors,apply_pose,f1
        C.restore(state.get("cage"))


if __name__=="__main__":
    main()
