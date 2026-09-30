"""Finite delivery entry: exact bcb closed-gesture parent vs cuff C1.

Both modes use the same reconstruction_recipe + seated authored1.30 hands.
No window/face/head/pose changes, no build/save, no canonical file writes.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
PIPE = REPO / "tools/pixel-pipeline"
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(PIPE / "next"))
import nx_hands_blender as H
import reconstruction_recipe as R
import cuff_blender as C


def main():
    argv = sys.argv[sys.argv.index("--")+1:]
    mode = H.argument(argv, "--cuff-mode")
    if mode not in ("parent", "cuff1") or H.argument(argv,"--hand-scale") != "1.3" or H.argument(argv,"--shots") != "idle":
        raise ValueError("explicit parent/cuff1, idle and hand-scale1.3 required")
    output = Path(H.argument(argv, "--out")).resolve()
    if not (REPO / "review/rosace/specialists/refinement").resolve() in output.parents:
        raise ValueError("fresh executing-worktree private refinement output required")
    original_library, original_recipe, original_mode = H.library, H.hand_recipe, R.MODE
    state = {}

    def library(path, name):
        module = original_library(path,name)
        if path.resolve() != (PIPE/"drive9/d9_blender.py").resolve():
            return module
        prior_install = module.head_scale.install
        prior_f1 = module.f1_module
        state["restoreInstall"] = (module.head_scale, prior_install)
        def install(config):
            result = prior_install(config)
            handle, report = C.install(mode == "cuff1")
            state.update(handle=handle, geometry=report)
            return result
        module.head_scale.install = install
        def f1():
            component = prior_f1()
            prior_face = component.facepass
            def face(scene, meta, directory):
                prior_face(scene,meta,directory)
                import bpy
                rig = bpy.data.objects["rosace_rig"]
                record = {"mode": mode, "parent": "bcb construction-control: gesture+seated1.30, closed window",
                    "geometry": state["geometry"], "px": meta["px"],
                    "evaluatedBoneMatrices": {b.name:[list(row) for row in b.matrix] for b in rig.pose.bones},
                    "constructionPoseFields": R.CHANGES, "windowMode": "unchanged closed", "finish": "unchanged R2"}
                Path(directory,"cuff_trial.json").write_text(json.dumps(record,indent=2),encoding="utf-8")
            component.facepass = face
            return component
        module.f1_module = f1
        return module
    H.library, H.hand_recipe, R.MODE = library, R, "reconstruction"
    try:
        H.main()
    finally:
        H.library, H.hand_recipe, R.MODE = original_library, original_recipe, original_mode
        if "restoreInstall" in state:
            module, prior = state["restoreInstall"]
            module.install = prior
        C.restore(state.get("handle"))


if __name__ == "__main__":
    main()
