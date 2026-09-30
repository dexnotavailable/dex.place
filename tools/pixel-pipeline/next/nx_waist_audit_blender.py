"""Delivery-only matched-pose body diagnostic; no waist correction or art claim.

Emit full R2 controls plus body-only masks under the identical camera/canvas.
Record camera-projected mesh sections separately from raw front/rest widths.
This avoids treating cuffs, tabard or front-table numbers as bare3/4anatomy.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nx_hands_blender as H  # noqa: E402

PIPE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPE))


def main():
    import bpy
    from rosace_v2.limbs import limb_of

    argv = sys.argv[sys.argv.index("--") + 1:]
    if H.argument(argv, "--hand-scale", "1.0") != "1.0" or H.argument(argv, "--shots") != "idle":
        raise ValueError("body audit is exact R2 idle, no candidate hand/pose lever")
    original_library = H.library

    def library(path, name):
        module = original_library(path, name)
        if path.name != "d9_blender.py":
            return module
        original_f1 = module.f1_module

        def f1():
            face_module = original_f1()
            original_face = face_module.facepass

            def facepass(scene, meta, directory):
                original_face(scene, meta, directory)
                body = bpy.data.objects["body"]
                arm = module.posing.arm_obj()
                spine = arm.data.bones["J_Bip_C_Spine"]
                center = spine.head_local.z + 0.63 * (spine.tail_local.z - spine.head_local.z)
                hip = sum(arm.data.bones[f"J_Bip_{side}_UpperLeg"].head_local.z for side in "LR") / 2
                groups = {group.index: limb_of(group.name) for group in body.vertex_groups}
                selected = {"waist": [], "hips": []}
                for vertex in body.data.vertices:
                    totals = {}
                    for weight in vertex.groups:
                        label = groups.get(weight.group, 0)
                        totals[label] = totals.get(label, 0.0) + weight.weight
                    label = max(totals, key=totals.get) if totals else 0
                    if label == 1 and abs(vertex.co.z - center) <= 0.015:
                        selected["waist"].append(vertex.index)
                    if label in (1, 4, 5, 18, 19) and hip - 0.06 <= vertex.co.z <= hip + 0.04:
                        selected["hips"].append(vertex.index)
                evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
                mesh = evaluated.to_mesh()
                try:
                    if len(mesh.vertices) != len(body.data.vertices):
                        raise ValueError("body vertex topology changed; section indices not transferable")
                    sections = {}
                    for label, indices in selected.items():
                        if len(indices) < 8:
                            raise ValueError(f"insufficient body section samples {label}")
                        points = [module.render.project(scene, evaluated.matrix_world @ mesh.vertices[i].co)
                                  for i in indices]
                        xs = [point[0] / meta["ss"] for point in points]
                        ys = [point[1] / meta["ss"] for point in points]
                        rest_x = [body.data.vertices[i].co.x for i in indices]
                        sections[label] = {"sampleVertices": len(indices),
                            "projectedWidthPx": max(xs) - min(xs), "projectedYRangePx": [min(ys), max(ys)],
                            "restXWidthMeters": max(rest_x) - min(rest_x),
                            "limits": "declared mesh-band envelope; not a desired winner or clothing silhouette"}
                finally:
                    evaluated.to_mesh_clear()
                target = Path(directory) / "body-audit"
                target.mkdir()
                visibility = {ob.name: ob.hide_render for ob in scene.objects if ob.type == "MESH"}
                try:
                    for ob in scene.objects:
                        if ob.type == "MESH":
                            ob.hide_render = ob != body
                    module.render.render_passes(scene, str(target), ("id", "depth2", "beauty"))
                finally:
                    for name, hidden in visibility.items():
                        bpy.data.objects[name].hide_render = hidden
                (target / "diagnostic.json").write_text(json.dumps({
                    "px": meta["px"], "waistPinch": {"active": 0.25, "sourceDefault": 0.17, "z": center},
                    "sections": sections, "canvas": meta["canvas"], "anchor": meta["anchor"],
                    "pose": "exactR2idle", "camera": meta["cam"],
                    "clothingHidden": True, "armsExcludedFromSectionSelection": True,
                    "limits": "native pose-band/body-only diagnostics; rest-front table and desired3/4target are distinct"}, indent=2), encoding="utf-8")
            face_module.facepass = facepass
            return face_module
        module.f1_module = f1
        return module

    H.library = library
    try:
        H.main()
    finally:
        H.library = original_library


if __name__ == "__main__":
    main()
