"""One finite delivery-only Cuff2 dispatch around the exact existing H1 driver.

Inject dependencies for CPU cleanup checks. Native dependencies load only when
the real entry is invoked. Every mutated hook, including transitive posing,
restores to its original object on success and exceptions.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
PIPE = REPO / "tools/pixel-pipeline"
PARENT = "bcb220de03c0b84e8fa68851328cd1d799a11de5"


def main(argv=None, *, hands=None, recipe=None, adapter=None, bpy_module=None):
    prior_path = sys.path[:]
    if argv is None:
        argv = sys.argv[sys.argv.index("--")+1:]
    if hands is None or recipe is None or adapter is None:
        try:
            sys.path.insert(0, str(PIPE / "next"))
            import nx_hands_blender
            import reconstruction_recipe
            import cuff2_blender
            hands = nx_hands_blender if hands is None else hands
            recipe = reconstruction_recipe if recipe is None else recipe
            adapter = cuff2_blender if adapter is None else adapter
        finally:
            sys.path[:] = prior_path
    mode = hands.argument(argv, "--cuff-mode")
    if mode not in ("parent", "cuff2") or hands.argument(argv, "--hand-scale") != "1.3" or hands.argument(argv, "--shots") != "idle":
        raise ValueError("explicit parent/cuff2 idle seated1.30 required")
    output = Path(hands.argument(argv, "--out")).resolve()
    if (REPO / "review/rosace/integration/cuff2").resolve() not in output.parents:
        raise ValueError("fresh executing-worktree private Cuff2 output required")
    snapshots, state = [], {}

    def remember(obj, attribute):
        if not any(owner is obj and key == attribute for owner, key, _ in snapshots):
            snapshots.append((obj, attribute, getattr(obj, attribute)))
        return getattr(obj, attribute)

    original_library = remember(hands, "library")
    remember(hands, "hand_recipe")
    remember(recipe, "MODE")

    def library(path, name):
        module = original_library(path, name)
        if path.resolve() != (PIPE / "drive9/d9_blender.py").resolve():
            return module
        for obj, key in ((module.figure_pose, "apply_pose"), (module.posing, "apply_pose"),
                         (module.posing, "grip_hand"), (module.posing, "hand_rest"),
                         (module, "PASSES")):
            remember(obj, key)
        prior_install = remember(module.head_scale, "install")
        prior_f1 = remember(module, "f1_module")

        def install(config):
            result = prior_install(config)
            handle, geometry = adapter.install(mode == "cuff2")
            state.update(handle=handle, geometry=geometry)
            return result

        def f1():
            component = prior_f1()
            prior_face = remember(component, "facepass")

            def face(scene, meta, directory):
                prior_face(scene, meta, directory)
                if bpy_module is None:
                    import bpy
                else:
                    bpy = bpy_module
                rig = bpy.data.objects["rosace_rig"]
                record = {"schema": "rosace.cuff2.native/1", "mode": mode,
                          "parentSource": PARENT,
                          "parentRole": "diagnostic closed bcb gesture/seated1.30, not accepted canonical body",
                          "construction": "cuff2", "geometry": state["geometry"], "px": meta["px"],
                          "evaluatedBoneMatrices": {b.name: [list(row) for row in b.matrix] for b in rig.pose.bones},
                          "constructionPoseFields": recipe.CHANGES,
                          "windowMode": "unchanged closed", "finish": "unchanged R2"}
                Path(directory, "cuff2_trial.json").write_text(json.dumps(record, indent=2), encoding="utf-8")

            component.facepass = face
            return component

        module.head_scale.install, module.f1_module = install, f1
        return module

    hands.library, hands.hand_recipe, recipe.MODE = library, recipe, "reconstruction"
    prior_argv = sys.argv
    sys.argv = [str(HERE / "cuff2_trial.py"), "--", *argv]
    try:
        hands.main()
    finally:
        sys.argv = prior_argv
        sys.path[:] = prior_path
        try:
            adapter.restore(state.get("handle"))
        finally:
            for obj, key, original in reversed(snapshots):
                setattr(obj, key, original)


if __name__ == "__main__":
    main()
