"""Native typed snapshots and complete authored normal encoding readback."""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

_path = sys.path[:]
try:
    sys.path.insert(0, str(Path(__file__).resolve().parents[4] / 'tools/pixel-pipeline/next'))
    import mesh_preservation as P
finally:
    sys.path[:] = _path


def plain(value):
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    return P.plain(value)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False, separators=(',', ':')).encode('utf-8')).hexdigest()


def points(mesh): return tuple(tuple(v.co) for v in mesh.vertices)
def native(points): return tuple(tuple(struct.unpack('<3f', struct.pack('<3f', *p))) for p in points)
def decoded(mesh):
    result = [tuple(n.vector) for n in mesh.corner_normals]
    if len(result) != len(mesh.loops) or any(len(n) != 3 or any(not math.isfinite(v) for v in n) for n in result):
        raise ValueError('finite full decoded corner-normal array required')
    return result


def encoded(mesh, required=False):
    attrs = [a for a in mesh.attributes if a.name in ('custom_normal', '.custom_normal')]
    if not attrs and not required and not mesh.has_custom_normals: return None, []
    if len(attrs) != 1: raise ValueError('one native custom-normal attribute required')
    a = attrs[0]
    schema = {'name': a.name, 'domain': a.domain, 'dataType': a.data_type, 'required': bool(a.is_required), 'count': len(a.data)}
    if a.domain != 'CORNER' or a.data_type != 'INT16_2D' or len(a.data) != len(mesh.loops):
        raise ValueError('unsupported native custom-normal schema: ' + repr(schema))
    pairs = []
    for item in a.data:
        row = P.typed_value(item)
        if set(row) != {'value'} or row['value']['rnaType'] != 'INT' or row['value']['array'] is not True:
            raise ValueError('unsupported authored INT16_2D RNA')
        pair = row['value']['value']
        if len(pair) != 2 or any(type(v) is not int or not -32768 <= v <= 32767 for v in pair):
            raise ValueError('invalid signed16 authored normal pair')
        pairs.append(tuple(pair))
    schema['valueRNA'] = {'value': {'rnaType': 'INT', 'array': True, 'length': 2}}
    return schema, pairs


def rna(obj, role=None):
    """All scalar settings plus pointer identities; arrays retain exact values."""
    result = {}
    for prop in obj.bl_rna.properties:
        name = prop.identifier
        if name in ('rna_type', 'id_data'): continue
        if role == 'modifier' and name == 'execution_time':
            if prop.type != 'FLOAT' or not getattr(prop, 'is_readonly', False) or getattr(prop, 'is_array', False):
                raise ValueError('unsupported Modifier.execution_time derived runtime schema')
            result[name] = {'type': prop.type, 'array': False, 'readonly': True,
                            'derivedRuntime': 'Modifier.execution_time is evaluation duration, measured separately; never an authored setting'}
            continue
        if prop.type in ('BOOLEAN', 'INT', 'FLOAT', 'STRING', 'ENUM'):
            result[name] = {'type': prop.type, 'array': bool(getattr(prop, 'is_array', False)), 'value': plain(getattr(obj, name))}
        elif prop.type == 'POINTER':
            value = getattr(obj, name)
            result[name] = None if value is None else {'pointer': int(value.as_pointer()), 'type': value.bl_rna.identifier}
    return result


def invariant(obj, mesh=None, allow_position=False):
    mesh = obj.data if mesh is None else mesh
    # UV accessor can materialize selection attributes; order is deliberate.
    uv = {a.name: {'activeRender': bool(a.active_render), 'activeClone': bool(a.active_clone), 'rows': [P.typed_value(p) for p in a.data]} for a in mesh.uv_layers}
    attrs = {}
    for a in mesh.attributes:
        rows = [P.typed_value(item) for item in a.data]
        attrs[a.name] = {'name': a.name, 'domain': a.domain, 'dataType': a.data_type, 'required': bool(a.is_required), 'count': len(rows), 'rows': rows}
        if allow_position and a.name == 'position':
            attrs[a.name]['rows'] = [{n: {k: v for k, v in f.items() if k != 'value'} for n, f in row.items()} for row in rows]
    keys = mesh.shape_keys
    return {'counts': [len(mesh.vertices), len(mesh.edges), len(mesh.polygons), len(mesh.loops)],
        'faces': [[list(p.vertices), p.material_index, bool(p.use_smooth)] for p in mesh.polygons],
        'edges': [[list(e.vertices), bool(e.use_seam), bool(e.use_edge_sharp)] for e in mesh.edges],
        'loops': [[p.vertex_index, p.edge_index] for p in mesh.loops], 'attributes': attrs, 'uv': uv,
        'weights': [[[g.group, g.weight] for g in v.groups] for v in mesh.vertices],
        'groups': [[g.name, g.index, bool(g.lock_weight)] for g in obj.vertex_groups],
        'materials': [[m.name, int(m.as_pointer())] if m else None for m in mesh.materials],
        'meshCustomProperties': plain(dict(mesh.items())), 'objectCustomProperties': plain(dict(obj.items())),
        'matrixWorld': [list(r) for r in obj.matrix_world], 'matrixLocal': [list(r) for r in obj.matrix_local],
        'matrixParentInverse': [list(r) for r in obj.matrix_parent_inverse], 'parentPointer': int(obj.parent.as_pointer()) if obj.parent else None,
        'hideRender': bool(obj.hide_render), 'hideViewport': bool(obj.hide_viewport), 'hideGet': bool(obj.hide_get()), 'passIndex': obj.pass_index,
        'collections': [[c.name, bool(c.hide_render), bool(c.hide_viewport)] for c in obj.users_collection],
        'modifiers': [rna(m, role='modifier') for m in obj.modifiers], 'constraints': [rna(c) for c in obj.constraints],
        'shapeKeys': None if keys is None else {'rna': rna(keys), 'blocks': [{'rna': rna(k), 'coordinates': [list(p.co) for p in k.data]} for k in keys.key_blocks]}}


def snapshot(obj):
    inv = invariant(obj)
    schema, pairs = encoded(obj.data, required=obj.name == 'head_skin')
    return {'invariant': inv, 'outside': invariant(obj, allow_position=True), 'coordinates': points(obj.data),
            'decoded': decoded(obj.data), 'encodedSchema': schema, 'pairs': pairs}


def derived_runtime(obj):
    return [{'modifierIndex':i,'modifierName':m.name,'modifierRNAClass':m.bl_rna.identifier,
             'field':'Modifier.execution_time','observedSeconds':float(m.execution_time),
             'scope':'derived readonly evaluation duration, separate from exact authored-settings invariant'}
            for i,m in enumerate(obj.modifiers) if hasattr(m,'execution_time')]


def rig_snapshot(rig):
    return {'matrix': [list(r) for r in rig.matrix_world], 'properties': plain(dict(rig.items())),
            'dataProperties': plain(dict(rig.data.items())), 'dataRNA': rna(rig.data),
            'bones': {b.name: {'rna': rna(b), 'matrix': [list(r) for r in b.matrix_local], 'properties': plain(dict(b.items()))} for b in rig.data.bones},
            'pose': {b.name: {'rna': rna(b), 'constraints': [rna(c) for c in b.constraints], 'properties': plain(dict(b.items()))} for b in rig.pose.bones},
            'constraints': [rna(c) for c in rig.constraints]}


class NormalFailure(AssertionError):
    def __init__(self, message, report): super().__init__(message); self.report = report


def normals_report(mesh, before, actual_points, protected_vertices, cfg, field):
    schema, pairs = encoded(mesh, required=before['encodedSchema'] is not None)
    current = decoded(mesh)
    old = before['decoded']
    if len(current) != len(old): raise ValueError('normal corner count differs')
    encoded_mismatch = [i for i, (a, b) in enumerate(zip(before['pairs'], pairs)) if a != b]
    changed = [i for i, (a, b) in enumerate(zip(old, current)) if a != b]
    protected = [l.index for l in mesh.loops if l.vertex_index in protected_vertices]
    rows = [{'cornerIndex': i, 'vertexIndex': mesh.loops[i].vertex_index,
             'stationaryVertex': actual_points[mesh.loops[i].vertex_index] == before['coordinates'][mesh.loops[i].vertex_index],
             'region': 'protected-anatomical-interface' if i in protected else ('neck-height-nonanatomical' if before['coordinates'][mesh.loops[i].vertex_index][2] <= cfg['neckProtectedThrough'] else 'nonanatomical-head'),
             'original': old[i], 'actual': current[i], 'delta': [b-a for a,b in zip(old[i], current[i])],
             'originalPair': before['pairs'][i] if before['pairs'] else None, 'actualPair': pairs[i] if pairs else None} for i in sorted(set(changed) | set(encoded_mismatch))]
    report = {'schemaOriginal': before['encodedSchema'], 'schemaActual': schema, 'fullEncodedPairCount': len(pairs),
              'fullEncodedSha256': {'original': digest(before['pairs']), 'actual': digest(pairs)},
              'fullDecodedSha256': {'original': digest(old), 'actual': digest(current)}, 'encodedMismatchIndices': encoded_mismatch,
              'decodedMismatchIndices': changed, 'completeDecodedOrEncodedChanges': rows, 'stationaryDecodedMismatchIndices': [r['cornerIndex'] for r in rows if r['stationaryVertex'] and r['cornerIndex'] in changed],
              'protectedCornerIndices': protected, 'protectedDecodedMismatchIndices': [i for i in protected if old[i] != current[i]],
              'decodedContract': 'nonanatomical head decoding may change on moved AND stationary vertices under retained authored encoding; ALL positive Neck+neighbor and construction interface exact; no old941 P0 shading claim',
              'setterCalled': False, 'encodedExact': schema == before['encodedSchema'] and pairs == before['pairs']}
    if not report['encodedExact'] or report['protectedDecodedMismatchIndices']:
        raise NormalFailure('authored encoding or anatomical/interface decoded normals changed', report)
    return report
