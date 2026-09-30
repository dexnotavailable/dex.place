"""Delivery-only Cuff2 adapter. Reuse copied-mesh guards, never save a blend."""
import math

import cuff2_geometry as G
from _reuse import load

C1 = load("cuff_blender")


def coordinates(mesh):
    return tuple(tuple(v.co) for v in mesh.vertices)


def modifier_state(obj):
    result = []
    for modifier in obj.modifiers:
        fields = {}
        for prop in modifier.bl_rna.properties:
            if prop.identifier == "rna_type" or prop.is_readonly:
                continue
            kind = prop.type
            if kind not in ("BOOLEAN", "INT", "FLOAT", "STRING", "ENUM", "POINTER"):
                raise ValueError("unsupported mutable modifier property: "+prop.identifier+"/"+kind)
            value = getattr(modifier, prop.identifier)
            if kind == "POINTER":
                value = None if value is None else [value.bl_rna.identifier, value.name_full]
            elif kind == "STRING":
                if type(value) is not str:
                    raise ValueError("invalid modifier string: "+prop.identifier)
            elif kind == "ENUM":
                if isinstance(value, set) and all(type(v) is str for v in value):
                    value = sorted(value)
                elif type(value) is not str:
                    raise ValueError("invalid modifier enum/flag set: "+prop.identifier)
            else:
                # Only numeric/boolean RNA descriptors support array readout.
                # StringProperty and EnumProperty do not expose is_array.
                array = bool(getattr(prop, "is_array", False))
                try:
                    values = list(value) if array else [value]
                except TypeError as error:
                    raise ValueError("invalid modifier array: "+prop.identifier) from error
                valid = {"BOOLEAN": lambda v: type(v) is bool,
                         "INT": lambda v: type(v) is int,
                         "FLOAT": lambda v: type(v) in (int, float) and math.isfinite(v)}[kind]
                if not all(valid(v) for v in values):
                    raise ValueError("invalid/nonfinite modifier numeric value: "+prop.identifier)
                if array:
                    value = values
            fields[prop.identifier] = value
        result.append([modifier.name, modifier.type, fields])
    return result


def structure(obj):
    result = C1.structure(obj)
    result.update(modifiers=modifier_state(obj),
                  matrixBasis=[list(row) for row in obj.matrix_basis],
                  matrixParentInverse=[list(row) for row in obj.matrix_parent_inverse],
                  uvState=[[layer.name, layer.active_render, layer.active_clone] for layer in obj.data.uv_layers],
                  uvActiveIndex=obj.data.uv_layers.active_index)
    return result


def install(enabled):
    if type(enabled) is not bool:
        raise ValueError("explicit boolean Cuff2 mode required")
    if not enabled:
        return None, {"enabled": False, "construction": "cuff2", "changedVertices": 0, "copiedMesh": False}
    import bpy
    left, right = bpy.data.objects["sleeve.L"], bpy.data.objects["sleeve.R"]
    rig = bpy.data.objects["rosace_rig"]
    originals = (left.data, right.data)
    before = tuple(coordinates(mesh) for mesh in originals)
    invariant = tuple(C1.digest(structure(obj)) for obj in (left, right))
    shoulder = rig.data.bones["J_Bip_L_UpperArm"].head_local
    wrist = rig.data.bones["J_Bip_L_Hand"].head_local
    axis = tuple((wrist-shoulder).normalized())
    faces = tuple(tuple(p.vertices) for p in originals[0].polygons)
    G.validate_loft(before[0], faces, axis)
    G.validate_azimuth(before[0], axis, tuple(shoulder))
    handle = None
    original_geometry = C1.G
    try:
        # Reuse C1's identity/rig/stack/material/custom-normal/key/copy guards.
        # Only its pure geometry dependency is replaced, and always restored.
        C1.G = G
        handle, report = C1.install(True)
        actual = coordinates(left.data)
        report.update(G.audit(before[0], actual, faces, axis))
        if tuple(C1.digest(structure(obj)) for obj in (left, right)) != invariant:
            raise AssertionError("Cuff2 changed typed topology/UV/attrs/weights/modifiers/materials/transforms")
        if right.data is not originals[1] or tuple(coordinates(mesh) for mesh in originals) != before:
            raise AssertionError("one of the two original sleeve meshes changed")
        radial_error = max(abs(delta[j]-G.dot(delta, axis)*axis[j])
                           for delta in (G.sub(a, b) for a, b in zip(actual, before[0])) for j in range(3))
        if radial_error > 1e-7:
            raise AssertionError("stored float32 coordinates changed radial components beyond storage precision")
        report.update(construction="cuff2", bothOriginalMeshesUnchanged=True,
                      typedInvariantSha256=list(invariant), storedRadialMaxErrorM=radial_error,
                      reusedPrimitives="read-only C1 install/restore/structure/attributes; scoped G replacement",
                      preservedScope="row0 and lower sector exact; upper rows1..22 refitted; sleeve.R exact",
                      limits="CPU guards are not actual holding-hand anatomy, appearance, cloth or motion acceptance")
        return handle, report
    except BaseException:
        C1.restore(handle)
        raise
    finally:
        C1.G = original_geometry


def restore(handle):
    C1.restore(handle)
