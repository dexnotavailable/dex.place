"""Finite delivery-only fabric inertia diagnostic, not gameplay motion acceptance.

Exact R2 model/pose/finish; body-translation keys prepared before Cloth. Render
the same120tick trajectory without/with mesh physics in separate processes.
Only80px moving proof here; final144/80 gameplay and transitions remain required.
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import nx_hands_blender as H  # noqa: E402

PIPE = Path(__file__).resolve().parents[2]
REPO = PIPE.parents[1]


def main():
    import bpy
    from mathutils import Vector

    argv = sys.argv[sys.argv.index("--") + 1:]
    arg = lambda name, default=None: H.argument(argv, name, default)
    mode = arg("--physics")
    if mode not in ("off", "on"):
        raise ValueError("diagnostic physics must be explicit off/on")
    blend = Path(arg("--blend"))
    if hashlib.sha256(blend.read_bytes()).hexdigest() != H.EXPECTED_BLEND:
        raise ValueError("cloth diagnostic requires preserved R2 scene")
    output = Path(arg("--out")).resolve()
    if not (REPO / "review/rosace/physics").resolve() in output.parents or output.exists():
        raise ValueError("use a fresh private physics trial output")
    if "--save-lane" in argv or "--save-blend" in argv:
        raise ValueError("diagnostic never saves a scene")
    output.mkdir(parents=True)
    sys.path.insert(0, str(PIPE))
    sys.path.insert(0, str(PIPE / "drive9"))
    driver = H.library(PIPE / "drive9/d9_blender.py", "rosace_cloth_d9")
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    scene = bpy.context.scene
    driver.materials.rebind()
    driver.render.setup_engine(scene)
    model = json.loads((PIPE / "drive9/r2_model.json").read_text(encoding="utf-8"))
    if hashlib.sha256((PIPE / "drive9/r2_model.json").read_bytes()).hexdigest() != H.EXPECTED_MODEL:
        raise ValueError("cloth benchmark model differs from R2")
    import r2_blender
    r2_blender.mesh_edits(model["mesh_edits"])
    r2_blender.circlet(model["circlet"])
    for name in list(driver.materials.PASS_NODES):
        driver.add_noise_pass(name)
    driver.head_scale.install(driver.head_scale.cfg_from(driver.PICK["head"]))
    shot = driver.PICK["shots"]["idle"]
    pose, _ = driver.figure_pose.load_pose(driver.pose_file(shot["pose"]))
    drape = shot.get("drape")
    if drape:
        pose = driver.deep_merge(pose, driver.DRAPE[drape][pose["name"]])
    pose = driver.deep_merge(pose, model["poses"][pose["name"]])
    driver.posing.apply_pose(pose)
    arm = driver.posing.arm_obj()
    if arm.animation_data and arm.animation_data.action:
        raise ValueError("canonical diagnostic unexpectedly has animation; do not replace it")
    root = arm.pose.bones["Root"]
    initial = root.location.copy()
    inverse = root.bone.matrix_local.to_3x3().inverted()
    # An explicitly labelled inertia bench: a held idle transported smoothly,
    # not a authored run/dash/gameplay clip. No pose edits under the solver.
    for frame, x in ((-45, 0), (0, 0), (20, 0), (40, 0.16), (60, 0.16), (80, 0), (120, 0)):
        root.location = initial + inverse @ Vector((x, 0, 0))
        root.keyframe_insert(data_path="location", frame=frame)
    scene.render.fps, scene.render.fps_base = 60, 1.0
    scene.frame_set(0)
    camera = pose["camera"]
    # Bounds are computed before Cloth; padding is part of one shared framing.
    framing = driver.render.setup_shot(scene, 80, yaw=camera["yaw"], elev=camera["elev"], ss=4,
                                      frames=list(range(0, 121, 4)), pad=20)
    f1 = driver.f1_module()
    exports = []

    def render_frame(scene, frame, directory):
        if frame % 4:
            return
        raw = output / "frames" / f"f{frame:04d}" / "px80"
        raw.mkdir(parents=True)
        meta = driver.render.setup_shot(scene, 80, yaw=camera["yaw"], elev=camera["elev"], ss=4,
                                        canvas=framing["canvas"], anchor=framing["anchor"])
        driver.render.render_passes(scene, str(raw), driver.PASSES)
        driver.set_noise_scale(80)
        driver.materials.set_pass("noise")
        scene.render.filepath = str(raw / "noise.png")
        bpy.ops.render.render(write_still=True)
        driver.materials.set_pass("beauty")
        driver.render.write_meta(str(raw / "meta.json"), meta, {
            "pose": "idle_appeal", "frame": frame, "passes": [*driver.PASSES, "noise"],
            "anchors": driver.posing.anchors(scene, 80),
            "d9": {"shot": "idle", "expr": shot["expr"], "head": driver.PICK["head"]},
            "cloth": {"mode": mode, "diagnostic": True, "frame": frame}})
        f1.facepass(scene, json.loads((raw / "meta.json").read_text(encoding="utf-8")), str(raw))
        exports.append({"frame": frame, "raw": str(raw)})

    if mode == "on":
        path = Path(__file__).parent / "setup.py"
        spec = importlib.util.spec_from_file_location("rosace_physical_fabric_setup", path)
        physics = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(physics)
        config = json.loads((REPO / "art/rosace/next/cloth-physics.json").read_text(encoding="utf-8"))
        state = physics.install(scene, config, output / "simulation", start=0, end=120)
        physics.chronological_bake(scene, state, 0, 120, render_frame)
    else:
        for frame in range(-45, 121):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            if frame >= 0:
                render_frame(scene, frame, output)
    if hashlib.sha256(blend.read_bytes()).hexdigest() != H.EXPECTED_BLEND:
        raise AssertionError("canonical blend changed")
    (output / "frames.json").write_text(json.dumps({"diagnostic": "held-idle body translation fabric inertia",
        "physics": mode, "fps": 60, "drawEveryTicks": 4, "framing": framing,
        "canonicalSha256": H.EXPECTED_BLEND, "exports": exports,
        "limits": "not run/dash/jump/M1/Q/R or transition acceptance"}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
