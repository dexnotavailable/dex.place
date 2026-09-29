"""Delivery-only actual Cloth modifiers on preserved Rosace garment meshes.

The source scene is read-only on disk. Caller supplies an animated rig/action,
then installs and chronologically bakes this separate physical fabric lever.
Actual sprite clips/pixel acceptance are still required; this is not runtime
mesh cloth or a promise from a successful modifier install.
"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import contract  # noqa: E402

EXPECTED_BLEND = "aef28c7f5cdddee6f18bd12c06d988b5436eeac24049ddf4f6ca37f654394373"


def set_required(owner, values):
    for key, value in values.items():
        if not hasattr(owner, key):
            raise ValueError(f"installed Blender lacks required RNA property {key}")
        setattr(owner, key, value)


def install(scene, config, output, start=0, end=120):
    import bpy
    from mathutils import Vector

    contract.validate(config)
    output = Path(output).resolve()
    repo = Path(__file__).resolve().parents[4]
    if not (repo / "review/rosace/physics").resolve() in output.parents:
        raise ValueError("physics writes only to this lane's ignored physics tree")
    if output.exists():
        raise ValueError("physics output must be fresh; never overwrite a trial")
    source = Path(bpy.data.filepath)
    if hashlib.sha256(source.read_bytes()).hexdigest() != EXPECTED_BLEND:
        raise ValueError("physical fabric qualification needs exact preserved R2 scene")
    arm = bpy.data.objects["rosace_rig"]
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    if end <= start:
        raise ValueError("moving physics trial requires a positive frame range")
    warm_start = start - config["warmupFrames"]
    scene.frame_set(start)
    bpy.context.view_layer.update()
    entry = {bone.name: [list(row) for row in bone.matrix] for bone in arm.pose.bones}
    scene.frame_set(warm_start)
    bpy.context.view_layer.update()
    if any(abs(value - entry[bone.name][i][j]) > 1e-5
           for bone in arm.pose.bones for i, row in enumerate(bone.matrix) for j, value in enumerate(row)):
        raise ValueError("warmup must hold the intended entry pose, not a different rest pose")
    scene.frame_start, scene.frame_end = warm_start, end
    output.mkdir(parents=True)
    scene.render.fps = config["fps"]
    scene.render.fps_base = 1.0
    set_required(scene, {"use_gravity": True})
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.gravity = config["gravity"]
    collider_collection = bpy.data.collections.new("rosace_physical_colliders")
    scene.collection.children.link(collider_collection)
    colliders = [ob for ob in scene.objects if ob.type == "MESH" and (
        ob.get("part") in config["colliderParts"] or
        str(ob.get("part", "")).startswith(config["weaponPartPrefix"]))]
    if not any(ob.get("part") == "body" for ob in colliders) or not any(
            str(ob.get("part", "")).startswith("glaive") for ob in colliders):
        raise ValueError("actual animated body and weapon colliders are required")
    for ob in colliders:
        ob.modifiers.new("physical_fabric_collision", "COLLISION")
        set_required(ob.collision, {"thickness_outer": 0.003, "thickness_inner": 0.002,
                                    "cloth_friction": 5.0, "damping": 0.2})
        collider_collection.objects.link(ob)
    records = []
    cloth_objects = []
    for spec in config["garments"]:
        ob = bpy.data.objects.get(spec["object"])
        if ob is None or ob.type != "MESH" or ob.get("part") != spec["part"]:
            raise ValueError(f"garment mesh identity differs: {spec['object']}")
        if any(m.type == "CLOTH" for m in ob.modifiers):
            raise ValueError("do not stack a second cloth simulation")
        faces = [list(p.vertices) for p in ob.data.polygons]
        boundaries = contract.boundary_vertices(faces)
        if not boundaries:
            raise ValueError("fabric must have identified open attachment and hem boundaries")
        bone = arm.data.bones[spec["rootBone"]]
        axis = (bone.tail_local - bone.head_local).normalized()
        pins = contract.seam_indices([list(v.co) for v in ob.data.vertices], boundaries,
                                    spec["seam"], config["pinToleranceMeters"],
                                    list(bone.head_local), list(axis), contract.boundary_components(faces))
        count = len(ob.data.vertices)
        if len(pins) < 4 or len(pins) / count > config["pinFractionMaximum"]:
            raise ValueError(f"attachment pins invalid/free fabric lost: {ob.name}")
        expected_pins = 25 if spec["seam"] == "top-boundary" else 30
        if len(pins) != expected_pins:
            raise ValueError(f"native seam topology differs: {ob.name} pins{len(pins)} expected{expected_pins}")
        # Pinned positions must follow the wearer, not the old spring-chain
        # fabric animation. Keep the free fabric's rest pose but reassign only
        # seam deformation weights to hips/upper arm.
        for group in ob.vertex_groups:
            if group.name in arm.data.bones:
                group.remove(pins)
        wearer = ob.vertex_groups.get(spec["rootBone"]) or ob.vertex_groups.new(name=spec["rootBone"])
        wearer.add(pins, 1.0, "REPLACE")
        pin_group = ob.vertex_groups.new(name="physical_attachment_seam")
        pin_group.add(pins, 1.0, "REPLACE")
        mod = ob.modifiers.new("physical_fabric", "CLOTH")
        # The original garment's Armature precedes Cloth. Thickness/lining
        # remains after simulation, rather than becoming duplicate cloth nodes.
        modifiers = list(ob.modifiers)
        index = next((i for i, item in enumerate(modifiers) if item.type == "ARMATURE"), None)
        if index is None:
            raise ValueError("animated garment attachment needs its armature driver")
        ob.modifiers.move(len(modifiers) - 1, index + 1)
        set_required(mod.settings, config["settings"])
        mod.settings.vertex_group_mass = pin_group.name
        set_required(mod.collision_settings, config["collisions"])
        inward_shell = max((abs(item.thickness) * (1.0 - item.offset) * 0.5
                            for item in ob.modifiers if item.type == "SOLIDIFY"), default=0.0)
        # The solver uses the midsurface; protect the approved inward lining
        # shell too. This margin is recorded, not treated as clipping proof.
        mod.collision_settings.distance_min = config["collisions"]["distance_min"] + inward_shell
        mod.collision_settings.self_distance_min = config["collisions"]["self_distance_min"] + 2.0 * inward_shell
        mod.collision_settings.collection = collider_collection
        mod.settings.effector_weights.gravity = 1.0
        mod.settings.effector_weights.wind = 1.0
        mod.point_cache.frame_start, mod.point_cache.frame_end = warm_start, end
        if mod.point_cache.frame_start != warm_start or mod.point_cache.frame_end != end:
            raise ValueError("installed point cache cannot represent the declared warmup range")
        records.append({"object": ob.name, "vertices": count, "pinVertices": pins,
                        "pinGroup": pin_group.name, "freeVertices": count - len(pins),
                        "rootBone": spec["rootBone"], "seam": spec["seam"],
                        "modifierOrder": [m.type for m in ob.modifiers],
                        "settings": config["settings"], "collisions": dict(config["collisions"],
                            distance_min=mod.collision_settings.distance_min,
                            self_distance_min=mod.collision_settings.self_distance_min),
                        "inwardShellMeters": inward_shell,
                        "ornaments": spec["ornaments"]})
        cloth_objects.append(ob)
    bpy.ops.object.effector_add(type="WIND", location=(0, -2, 1))
    wind = bpy.context.object
    wind.name = "rosace_physical_wind"
    wind.rotation_euler = Vector(config["wind"]["direction"]).to_track_quat("Z", "Y").to_euler()
    wind.field.strength = config["wind"]["strength"]
    wind.field.noise = config["wind"]["noise"]
    # Decorative garment pieces must follow the actual simulated fabric.
    # Bind at the first simulation pose and snapshot only in-memory evaluated
    # geometry; their old chain animation is not allowed to leave them floating.
    decorations = []
    for spec in config["garments"]:
        target = bpy.data.objects[spec["object"]]
        for name in spec["ornaments"]:
            ob = bpy.data.objects.get(name)
            if ob is None:
                raise ValueError(f"approved garment ornament missing: {name}")
            hidden = ob.hide_render
            deps = bpy.context.evaluated_depsgraph_get()
            mesh = bpy.data.meshes.new_from_object(ob.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
            ob.data = mesh
            for old in list(ob.modifiers):
                ob.modifiers.remove(old)
            follow = ob.modifiers.new("physical_fabric_ornament", "SURFACE_DEFORM")
            follow.target = target
            with bpy.context.temp_override(object=ob, active_object=ob):
                bpy.ops.object.surfacedeform_bind(modifier=follow.name)
            if not follow.is_bound:
                raise ValueError(f"cloth ornament bind failed: {name}")
            if ob.hide_render != hidden:
                raise AssertionError("ornament visibility changed")
            decorations.append({"object": name, "target": target.name, "bound": True,
                                "hideRender": hidden})
    provenance = {"contract": "dex.cloth/1", "blender": bpy.app.version_string,
                  "canonicalSource": str(source), "canonicalSha256": EXPECTED_BLEND,
                  "status": "installed-native-bake-pending", "fps": config["fps"],
                  "gravity": config["gravity"], "garments": records,
                  "colliders": [ob.name for ob in colliders], "wind": config["wind"],
                  "ornamentBindings": decorations, "runtime": "baked2Dsprites, no runtime mesh claim",
                  "driverAction": arm.animation_data.action.name if arm.animation_data and arm.animation_data.action else None,
                  "driverContract": "body/weapon keys prepared before install; no pose applier during solver stepping"}
    (output / "setup.json").write_text(json.dumps(provenance, indent=2), encoding="utf-8")
    return {"output": output, "config": config, "source": source,
            "objects": cloth_objects, "provenance": provenance,
            "start": start, "end": end, "entry": entry}


def chronological_bake(scene, state, start, end, render_frame=None):
    """Evaluate every60Hz step, preserve cloth state, export actual mesh frames.

    render_frame(scene, frame, output) is delivery's pixel-render callback. It
    must use one fixed canvas/root framing for the whole transition trajectory.
    No sparse frame jumps or per-clip simulator restart can count as continuity.
    """
    import bpy
    output = state["output"]
    config = state["config"]
    if end <= start:
        raise ValueError("moving cloth proof needs more than one frame")
    if start != state["start"] or end != state["end"]:
        raise ValueError("bake range must match the prepared entry pose/cache range")
    warm_start = start - config["warmupFrames"]
    scene.frame_start, scene.frame_end = warm_start, end
    for ob in state["objects"]:
        cache = next(m for m in ob.modifiers if m.type == "CLOTH").point_cache
        cache.frame_start, cache.frame_end = warm_start, end
    frames = []
    for frame in range(warm_start, end + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        if frame < start:
            arm = bpy.data.objects["rosace_rig"]
            if any(abs(value - state["entry"][bone.name][i][j]) > 1e-5
                   for bone in arm.pose.bones for i, row in enumerate(bone.matrix) for j, value in enumerate(row)):
                raise ValueError("entry pose moved during chronological warmup")
        deps = bpy.context.evaluated_depsgraph_get()
        geometry = {}
        for ob in state["objects"]:
            evaluated = ob.evaluated_get(deps)
            mesh = evaluated.to_mesh()
            try:
                geometry[ob.name] = [list(evaluated.matrix_world @ vertex.co) for vertex in mesh.vertices]
            finally:
                evaluated.to_mesh_clear()
        if frame >= start:
            path = output / f"fabric-{frame:05d}.json"
            path.write_text(json.dumps(geometry, separators=(",", ":")), encoding="utf-8")
            frames.append({"frame": frame, "geometry": str(path),
                           "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
            if render_frame is not None:
                arm = bpy.data.objects["rosace_rig"]
                before_callback = {bone.name: [list(row) for row in bone.matrix] for bone in arm.pose.bones}
                render_frame(scene, frame, output)
                if scene.frame_current != frame:
                    raise ValueError("render callback changed simulation frame")
                if any(abs(value - before_callback[bone.name][i][j]) > 1e-6
                       for bone in arm.pose.bones for i, row in enumerate(bone.matrix) for j, value in enumerate(row)):
                    raise ValueError("render callback changed driver pose after cloth solver step")
    if hashlib.sha256(state["source"].read_bytes()).hexdigest() != EXPECTED_BLEND:
        raise AssertionError("canonical source changed during cloth qualification")
    record = dict(state["provenance"], status="simulated-geometry-baked-pixel-acceptance-pending",
                  first=start, last=end, warmupFirst=warm_start, frames=frames,
                  pixelCallbackExecuted=render_frame is not None,
                  limitations="no claim of clipping-free loops/transitions/gameplay until actual moving clips inspected")
    (output / "bake.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record
