"""Read-only original-object key-state observations and authored guard calls."""
import hashlib
import json
import math


def plain(value):
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else {'nonfiniteRepresentation': repr(value)}
    return {'pythonType': type(value).__name__, 'representation': repr(value)}


def typed(value):
    return {'pythonType': type(value).__name__, 'value': plain(value)}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def pointer(value):
    return None if value is None else int(value.as_pointer())


def animation(value):
    if value is None:
        return {'present': False}
    action = getattr(value, 'action', None)
    drivers = list(getattr(value, 'drivers', ()))
    return {'present': True, 'pointer': pointer(value),
            'action': None if action is None else {'name': action.name, 'pointer': pointer(action)},
            'driverCount': len(drivers),
            'drivers': [{'dataPath': d.data_path, 'arrayIndex': d.array_index,
                         'mute': bool(d.mute), 'isValid': bool(d.is_valid),
                         'driverType': d.driver.type,
                         'variableNames': [v.name for v in d.driver.variables]} for d in drivers]}


def modifier(value):
    fields = ('show_viewport', 'show_render', 'show_in_editmode', 'show_on_cage',
              'use_vertex_groups', 'use_bone_envelopes', 'use_deform_preserve_volume',
              'thickness', 'offset', 'use_rim', 'use_rim_only', 'use_flip_normals')
    target = getattr(value, 'object', None)
    return {'name': value.name, 'type': value.type, 'pointer': pointer(value),
            'fields': {name: typed(getattr(value, name)) for name in fields if hasattr(value, name)},
            'objectTarget': None if target is None else {'name': target.name, 'pointer': pointer(target)}}


def raw_state(ob):
    """No truthiness collapse of None, an allocated empty Key, and real keys."""
    me = ob.data
    keys = me.shape_keys
    blocks = [] if keys is None else list(keys.key_blocks)
    active = ob.active_shape_key_index
    real_integer = type(active) is int
    return {'objectName': ob.name, 'objectPointer': pointer(ob), 'objectType': ob.type,
            'meshName': me.name, 'meshPointer': pointer(me), 'vertexCount': len(me.vertices),
            'objectMode': typed(ob.mode), 'meshIsEditMode': typed(getattr(me, 'is_editmode', False)),
            'keysState': 'none' if keys is None else 'nonnull-empty' if not blocks else 'real-key-blocks',
            'keysPointer': pointer(keys), 'keysNativeTruthiness': None if keys is None else bool(keys),
            'keyCount': len(blocks), 'keyNames': [k.name for k in blocks],
            'activeShapeKeyIndexRaw': typed(active),
            'activeShapeKeyIndexRange': {'applicable': keys is not None,
                'rawTypeIsInteger': real_integer,
                'inRangeWithoutConversion': None if keys is None else real_integer and 0 <= active < len(blocks),
                'minimum': None if keys is None else 0, 'exclusiveMaximum': None if keys is None else len(blocks)},
            'showOnlyShapeKey': typed(ob.show_only_shape_key),
            'useRelative': None if keys is None else typed(keys.use_relative),
            'evalTime': None if keys is None else typed(keys.eval_time),
            'keyBlocks': [{'name': k.name, 'value': typed(k.value), 'mute': typed(k.mute),
                          'relativeKeyName': None if k.relative_key is None else k.relative_key.name,
                          'vertexGroup': k.vertex_group, 'coordinateCount': len(k.data),
                          'interpolation': k.interpolation, 'sliderMin': typed(k.slider_min),
                          'sliderMax': typed(k.slider_max), 'frame': typed(k.frame)} for k in blocks],
            'vertexGroupNames': [g.name for g in ob.vertex_groups],
            'animation': {'object': animation(getattr(ob, 'animation_data', None)),
                          'mesh': animation(getattr(me, 'animation_data', None)),
                          'keys': animation(None if keys is None else keys.animation_data)},
            'modifiers': [modifier(m) for m in ob.modifiers],
            'constraints': [{'name': c.name, 'type': c.type, 'pointer': pointer(c)} for c in ob.constraints],
            'hideRender': bool(ob.hide_render)}


def observe(ob, rest, phase):
    # This object/mesh/key schema is captured BEFORE the authored exception.
    before = raw_state(ob)
    report = {'phase': phase, 'original': before, 'beforeRawStateSha256': digest(before)}
    try:
        state = rest.shape_state(ob)  # exact existing function; no evaluate/copy or waiver
    except Exception as error:
        report['authoredGuard'] = {'accepted': False, 'exceptionType': type(error).__name__,
                                  'message': str(error), 'function': 'window_ao.rest_geometry.shape_state'}
    else:
        report['authoredGuard'] = {'accepted': True, 'state': state,
                                  'function': 'window_ao.rest_geometry.shape_state'}
    after = raw_state(ob)
    report.update(afterRawStateSha256=digest(after), originalRawStateUnchanged=before == after)
    if before != after:
        raise AssertionError('read-only authored shape-state observation changed original state: ' + ob.name)
    return report


def occluders(scene, render, rest):
    objects = render.render_objects(scene)  # the SAME actual filter called by native.install
    reports = [observe(ob, rest, 'after-W2-before-AO-original-occluder') for ob in objects]
    return {'filter': 'actual rosace.render.render_objects(scene), unchanged native.install filter',
            'objectCount': len(objects), 'objectNames': [ob.name for ob in objects], 'objects': reports,
            'rejectedObjects': [r['original']['objectName'] for r in reports if not r['authoredGuard']['accepted']],
            'originalRawStatesUnchanged': all(r['originalRawStateUnchanged'] for r in reports)}
