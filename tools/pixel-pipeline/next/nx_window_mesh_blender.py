"""Delivery-only actual aperture experiment; never run by the source owner.

The preserved R2 body stays intact. An in-memory bodice mesh copy loses only
front aperture faces; a separate thin gold ring follows its boundary with
the same weights/shape-key deltas. Disabled mode is the unchanged R2 driver.
Preservation is asserted on installed native data, not inferred from code.
"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nx_hands_blender as H
import window_mesh_recipe as R
import mesh_preservation as P


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def mesh_invariants(ob):
    me = ob.data
    keys = me.shape_keys
    return {
        "vertices": [[*v.co] for v in me.vertices],
        "weights": [[(g.group, g.weight) for g in v.groups] for v in me.vertices],
        "groups": [g.name for g in ob.vertex_groups],
        "shapeKeys": [] if not keys else [{"name": k.name, "value": k.value,
            "relative": k.relative_key.name, "mute": k.mute, "interpolation": k.interpolation,
            "vertexGroup": k.vertex_group, "sliderMin": k.slider_min, "sliderMax": k.slider_max,
            "coordinates": [[*p.co] for p in k.data]} for k in keys.key_blocks],
        "shapeKeyMode": None if not keys else [keys.use_relative, keys.eval_time],
        "pointAttributes": P.attributes(me,"POINT",range(len(me.vertices))),
        "materials": [m.name if m else None for m in me.materials],
        "part": ob.get("part"), "passIndex": ob.pass_index,
    }


def face_data(me, f):
    return P.face_data(me,f)


def install(state):
    import bpy
    import bmesh
    from mathutils import Vector
    bodice = bpy.data.objects["bodice"]
    body = bpy.data.objects["body"]
    protected = {name: digest(mesh_invariants(bpy.data.objects[name])) for name in
                 ("body", "collar", "collar_cross", "collar_plate")}
    for ob in (bodice, body):
        if any(abs(ob.matrix_world[i][j]-(1 if i == j else 0)) > 1e-6 for i in range(4) for j in range(4)):
            raise ValueError("expected canonical identity mesh transforms")
    anchors = []
    for name in ("anchor_outfit_win_t", "anchor_outfit_win_b"):
        ob = bpy.data.objects[name]
        anchors.append(list(sum((ob.matrix_world @ v.co for v in ob.data.vertices), Vector()) / len(ob.data.vertices)))
    original = bodice.data
    # Record the rollback pointer before any mutation, including a failed
    # native preservation assertion midway through installation.
    state["originalMesh"] = original
    before = mesh_invariants(bodice)
    faces = [list(f.vertices) for f in original.polygons]
    planned = R.plan(before["vertices"], faces, *anchors)
    expected_faces = [face_data(original, original.polygons[i]) for i in planned["retainedFaces"]]
    # Legacy UV access may initialize internal schema; snapshot point data
    # after that read so any lazy materialization is represented consistently.
    before = mesh_invariants(bodice)
    copy = original.copy()
    copy.name = "rosace_window2_private_bodice"
    bodice.data = copy
    bm = bmesh.new()
    try:
        bm.from_mesh(copy)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in planned["removedFaces"]], context="FACES_ONLY")
        bm.to_mesh(copy)
        copy.update()
    finally:
        bm.free()
    if mesh_invariants(bodice) != before:
        raise AssertionError("face-only cut changed vertices, weights, shape keys, point data, materials or IDs")
    actual_faces = [face_data(copy, f) for f in copy.polygons]
    preservation=P.compare(expected_faces,actual_faces)
    preservation.update(vertexKeyWeightPointGuard="exact pass",nativeVersion=bpy.app.version_string,
                        hypothesis="old native trace lacks records; cause not assumed")
    if state.get("preservationOutput"):
        folder=Path(state["preservationOutput"])
        folder.mkdir(parents=True,exist_ok=True)
        (folder/"retained-face-preservation.json").write_text(json.dumps(preservation,indent=2),encoding="utf-8")
    state["preservationReport"]=preservation
    if not preservation["exactSemanticEqual"]:
        raise AssertionError("retained faces/UV/corner attributes were not preserved exactly")
    # Gold is actual geometry, outside the cut; its inside is not filled.
    count = len(planned["loop"])
    vertices = [[p[0], p[1]-.0008, p[2]] for p in planned["inner"]] + planned["outer"]
    quads = [(i, (i+1)%count, (i+1)%count+count, i+count) for i in range(count)]
    normal = (Vector(vertices[quads[0][1]])-Vector(vertices[quads[0][0]])).cross(
        Vector(vertices[quads[0][3]])-Vector(vertices[quads[0][0]]))
    if normal.y > 0:
        quads = [tuple(reversed(q)) for q in quads]
    ring_mesh = bpy.data.meshes.new("rosace_window2_gold_rim")
    ring_mesh.from_pydata(vertices, [], quads)
    ring_mesh.update()
    ring = bpy.data.objects.new("window2_rim", ring_mesh)
    state["ring"] = ring
    for collection in bodice.users_collection:
        collection.objects.link(ring)
    ring.data.materials.append(bpy.data.materials["gold"])
    ring["part"] = bodice.get("part", "bodice")
    ring["window2_rim"] = True
    ring.pass_index = bodice.pass_index
    ring.matrix_world = bodice.matrix_world.copy()
    for g in bodice.vertex_groups:
        ring.vertex_groups.new(name=g.name)
    for new_index, old_index in enumerate(planned["loop"] * 2):
        for g in original.vertices[old_index].groups:
            ring.vertex_groups[g.group].add([new_index], g.weight, "REPLACE")
    # The existing shader multiplies lighting by the POINT-domain ao value.
    # Missing ao would make the new gold geometry falsely black. Carry its
    # boundary samples and bundled bust AO variants rather than changing ramps.
    for attr in original.attributes:
        if attr.domain == "POINT" and attr.data_type == "FLOAT" and attr.name.startswith("ao"):
            target = ring_mesh.attributes.new(attr.name, "FLOAT", "POINT")
            for i, index in enumerate(planned["loop"] * 2):
                target.data[i].value = attr.data[index].value
    if not ring_mesh.attributes.get("ao"):
        raise ValueError("preserved bodice lacks required ao shader data")
    armatures = [m for m in bodice.modifiers if m.type == "ARMATURE"]
    if len(armatures) != 1:
        raise ValueError("expected one preserved bodice Armature")
    arm = ring.modifiers.new("Armature", "ARMATURE")
    arm.object = armatures[0].object
    arm.use_vertex_groups = armatures[0].use_vertex_groups
    arm.use_bone_envelopes = armatures[0].use_bone_envelopes
    arm.use_deform_preserve_volume = armatures[0].use_deform_preserve_volume
    if original.shape_keys:
        old_keys = original.shape_keys.key_blocks
        for key in old_keys:
            k = ring.shape_key_add(name=key.name, from_mix=False)
            for i, index in enumerate(planned["loop"] * 2):
                k.data[i].co = Vector(vertices[i]) + key.data[index].co - old_keys[0].data[index].co
            k.value, k.mute, k.interpolation = key.value, key.mute, key.interpolation
            k.slider_min, k.slider_max = key.slider_min, key.slider_max
            k.vertex_group = key.vertex_group
        for key in old_keys:
            ring.data.shape_keys.key_blocks[key.name].relative_key = ring.data.shape_keys.key_blocks[key.relative_key.name]
        ring.data.shape_keys.use_relative = original.shape_keys.use_relative
        ring.data.shape_keys.eval_time = original.shape_keys.eval_time
        if original.shape_keys.animation_data:
            raise ValueError("animated/driven shape keys need an explicit rim synchronization route")
    if any(digest(mesh_invariants(bpy.data.objects[name])) != value for name, value in protected.items()):
        raise AssertionError("window experiment touched skin/collar/cross geometry")
    report = {"kind": "actual face-only bodice cut plus separate5mm gold boundary ring",
        "removedFaceCount": len(planned["removedFaces"]), "boundaryVertexCount": count,
        "singleClosedBoundary": True, "unchangedBodiceVertexCount": len(copy.vertices),
        "preservedBodiceInvariantHash": digest(before), "protectedGeometry": protected,
        "retainedFacePreservation":preservation,
        "halfWidthMeters": planned["halfWidthMeters"], "heightMeters": planned["heightMeters"],
        "rimWidthMeters": planned["rimWidthMeters"], "nativePixelsPending": True,
        "limitations": "whole-face border may be jagged; actual skin visibility/rim continuity/144+80 appeal require pixels"}
    return original, ring, report


def main():
    argv = sys.argv[sys.argv.index("--")+1:]
    mode = H.argument(argv, "--window-mode")
    if mode not in ("control", "mesh"):
        raise ValueError("explicit control or mesh window mode required")
    if H.argument(argv, "--hand-scale", "1.0") != "1.0" or H.argument(argv, "--shots") != "idle":
        raise ValueError("window proof is isolated preserved idle, hand-scale1.0")
    output = Path(H.argument(argv, "--out")).resolve()
    if not (H.REPO / "review/rosace").resolve() in output.parents:
        raise ValueError("fresh output must be in executing worktree's private review tree")
    original_library = H.library
    state = {"preservationOutput":str(output/"mesh-preservation")}

    def library(path, name):
        module = original_library(path, name)
        if path.resolve() == (H.PIPE / "drive9/d9_blender.py").resolve() and mode == "mesh":
            prior = module.head_scale.install
            state["headScale"] = (module.head_scale, prior)
            def head_install(cfg):
                result = prior(cfg)
                original, ring, report = install(state)
                state.update(originalMesh=original, ring=ring, report=report)
                return result
            module.head_scale.install = head_install
            prior_f1 = module.f1_module
            state["f1module"] = (module, prior_f1)
            def f1():
                component = prior_f1()
                prior_face = component.facepass
                state["faceComponent"] = (component, prior_face)
                def face(scene, meta, directory):
                    prior_face(scene, meta, directory)
                    from bpy_extras.object_utils import world_to_camera_view
                    import bpy
                    ring = state["ring"]
                    evaluated = ring.evaluated_get(bpy.context.evaluated_depsgraph_get())
                    coords = []
                    for v in evaluated.data.vertices:
                        p = world_to_camera_view(scene, scene.camera, evaluated.matrix_world @ v.co)
                        coords.append([p.x*scene.render.resolution_x/meta["ss"],
                                       (1-p.y)*scene.render.resolution_y/meta["ss"], p.z])
                    Path(directory, "window_geometry.json").write_text(json.dumps(
                        dict(state["report"], boundaryProjectedPx=coords[:len(coords)//2],
                             rimOuterProjectedPx=coords[len(coords)//2:], px=meta["px"]), indent=2))
                component.facepass = face
                return component
            module.f1_module = f1
        return module
    H.library = library
    try:
        H.main()
        if mode == "mesh":
            Path(output, "_window_geometry.json").write_text(json.dumps(state["report"], indent=2))
    finally:
        H.library = original_library
        if "headScale" in state:
            state["headScale"][0].install = state["headScale"][1]
        for key in ("f1module", "faceComponent"):
            if key in state:
                setattr(state[key][0], "f1_module" if key == "f1module" else "facepass", state[key][1])
        if "originalMesh" in state:
            import bpy
            bpy.data.objects["bodice"].data = state["originalMesh"]
        if "ring" in state:
            import bpy
            bpy.data.objects.remove(state["ring"], do_unlink=True)


if __name__ == "__main__":
    main()
