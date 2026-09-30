"""Delivery-only optional C1 copied-mesh adapter; never saves a blend."""
import hashlib
import json
import math

import cuff_geometry as G


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def attributes(mesh):
    result = {}
    for attr in mesh.attributes:
        if attr.name == "position":
            continue
        values = []
        for item in attr.data:
            fields = {}
            for prop in item.bl_rna.properties:
                if prop.identifier == "rna_type":
                    continue
                value = getattr(item, prop.identifier)
                fields[prop.identifier] = list(value) if prop.is_array else value
            values.append(fields)
        result[attr.name] = [attr.domain, attr.data_type, values]
    return result


def structure(obj):
    mesh = obj.data
    return {"edges": [[list(e.vertices), e.use_seam, e.use_edge_sharp] for e in mesh.edges],
        "polygons": [[list(p.vertices), p.material_index, p.use_smooth] for p in mesh.polygons],
        "loops": [[loop.vertex_index, loop.edge_index] for loop in mesh.loops],
        "materials": [m.name if m else None for m in mesh.materials],
        "attributes": attributes(mesh), "vertexGroups": [[v.index, [[g.group,g.weight] for g in v.groups]] for v in mesh.vertices],
        "groupNames": [g.name for g in obj.vertex_groups],
        "parent": obj.parent.name if obj.parent else None, "part": obj.get("part"), "passIndex": obj.pass_index,
        "matrix": [list(row) for row in obj.matrix_world]}


def install(enabled):
    # A disabled hook must not inspect/copy/update mesh data or normals.
    if not enabled:
        return None, {"enabled": False, "changedVertices": 0, "copiedMesh": False}
    import bpy
    rig = bpy.data.objects["rosace_rig"]
    obj = bpy.data.objects["sleeve.L"]
    if obj.type != "MESH" or obj.parent != rig or obj.data.shape_keys or obj.data.has_custom_normals:
        raise ValueError("C1 needs unkeyed F3 sleeve.L without custom normals, parented to rosace_rig")
    for matrix in (obj.matrix_world, rig.matrix_world):
        if any(abs(matrix[r][c]-(1.0 if r==c else 0.0)) > 1e-6 for r in range(4) for c in range(4)):
            raise ValueError("canonical identity object/rig rest transforms required")
    if [m.name for m in obj.modifiers] != ["arm", "thick"]:
        raise ValueError("unexpected sleeve modifier stack; no physics/stack bypass")
    arm, thick = obj.modifiers
    if arm.type != "ARMATURE" or arm.object != rig or thick.type != "SOLIDIFY" or abs(thick.thickness-0.006)>1e-6 or thick.offset != -1.0:
        raise ValueError("preserved F3 armature/solidify contract required")
    if [m.name for m in obj.data.materials] != ["white", "lining", "gold"]:
        raise ValueError("preserved sleeve palette slots required")
    shoulder = rig.data.bones["J_Bip_L_UpperArm"].head_local
    wrist = rig.data.bones["J_Bip_L_Hand"].head_local
    axis = tuple((wrist-shoulder).normalized())
    original = obj.data
    before = tuple(tuple(v.co) for v in original.vertices)
    faces = tuple(tuple(p.vertices) for p in original.polygons)
    # Check source azimuth identity, not just count/connectivity: ring k=0 points
    # forward (-Y), k=quarter above, k=half back. Axis is source shoulder->wrist.
    for row in (0, G.ROWS):
        points = before[row*G.COLUMNS:(row+1)*G.COLUMNS]
        if not (points[0][1] < points[15][1] and points[7][2] > points[22][2]):
            raise ValueError("unexpected F3 azimuth index semantics")
    candidate, report = G.deform(before, faces, axis, True)
    invariant = digest(structure(obj))
    copy = original.copy()
    try:
        # Vertex coords only. Copy retains UV/corner/point/crease/limb attributes,
        # material faces and rig weights without a BMesh reconstruction.
        for vertex, coordinate in zip(copy.vertices, candidate):
            vertex.co = coordinate
        copy.update()
        obj.data = copy
        if digest(structure(obj)) != invariant:
            raise AssertionError("C1 changed topology/UV/attributes/weights/materials/part/transform")
        actual = tuple(tuple(v.co) for v in copy.vertices)
        changed = set(report["changedIndices"])
        if any(actual[i] != before[i] for i in range(len(before)) if i not in changed):
            raise AssertionError("protected proximal/lower coordinates changed")
        if any(abs(actual[i][j]-candidate[i][j]) > 1e-7 for i in changed for j in range(3)):
            raise AssertionError("stored cuff coordinates differ from fixed recipe")
        if tuple(tuple(v.co) for v in original.vertices) != before:
            raise AssertionError("original mesh changed")
        report.update(object="sleeve.L", copiedMesh=True, sourceRestAxis=list(axis),
            invariantSha256=invariant, originalCoordinatesSha256=digest(before),
            candidateCoordinatesSha256=digest(actual), originalUnchanged=True,
            limits="source geometry only; visibility/contact/collision/physical cloth require actual pixels and playback")
        return (obj, original, copy), report
    except BaseException:
        obj.data = original
        bpy.data.meshes.remove(copy)
        raise


def restore(handle):
    if handle is not None:
        import bpy
        obj, original, copy = handle
        obj.data = original
        bpy.data.meshes.remove(copy)
