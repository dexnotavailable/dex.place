"""Actual authored shape_state and original wrapper lifecycle with CPU fakes."""
import copy
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch
import probe as P


class ID:
    def as_pointer(self):
        return id(self)


class Keys(ID):
    def __init__(self, real=True):
        self.animation_data = None
        self.use_relative, self.eval_time = True, 0.0
        self.key_blocks = []
        if real:
            basis = types.SimpleNamespace(name='Basis', value=0.0, mute=False,
                vertex_group='', interpolation='KEY_LINEAR', slider_min=0.0, slider_max=1.0, frame=0.0,
                data=[types.SimpleNamespace(co=p) for p in ((0.,0.,0.),(1.,0.,0.),(0.,0.,1.))])
            basis.relative_key = basis
            bust = copy.deepcopy(basis)
            bust.name, bust.value, bust.relative_key = 'figure_bust', 1.0, basis
            self.key_blocks = [basis, bust]


class Mesh(ID):
    def __init__(self, name, keys):
        self.name, self.shape_keys, self.users = name, keys, 0
        self.animation_data, self.is_editmode = None, False
        self.vertices = [types.SimpleNamespace(co=p, groups=[]) for p in ((0.,0.,0.),(1.,0.,0.),(0.,0.,1.))]


class Object(ID):
    def __init__(self, name, keys):
        self.name, self.type, self.mode = name, 'MESH', 'OBJECT'
        self._data = Mesh(name+'-mesh', keys)
        self._data.users += 1
        self.active_shape_key_index, self.show_only_shape_key = 0, False
        self.vertex_groups, self.modifiers, self.constraints = [], [], []
        self.animation_data, self.hide_render = None, False

    @property
    def data(self):
        return self._data

    @data.setter
    def data(self, value):
        self._data.users -= 1
        self._data = value
        value.users += 1


def fixture(wrapper, failure=None):
    body, bodice = Object('body', Keys()), Object('bodice', Keys())
    body.active_shape_key_index = 1
    hidden = Object('ref_hidden', None)
    hidden.hide_render = True
    scene = types.SimpleNamespace(objects=[body, bodice, hidden])
    removed, calls = [], {'open':0, 'render':0, 'save':0, 'bake':0, 'screenshot':0, 'pose':0, 'window':0}

    class Objects(dict):
        def remove(self, ob, **kwargs):
            del self[ob.name]
            scene.objects.remove(ob)
            ob.data.users -= 1
            removed.append(('object', ob.name))
    objects = Objects(body=body, bodice=bodice, ref_hidden=hidden)

    def remove_mesh(me):
        assert me.users == 0
        removed.append(('mesh', me.name))

    def operation(name):
        def call(*args, **kwargs):
            calls[name] += 1
        return call
    ops = types.SimpleNamespace(wm=types.SimpleNamespace(open_mainfile=operation('open'), save_mainfile=operation('save')),
                               render=types.SimpleNamespace(render=operation('render')),
                               object=types.SimpleNamespace(bake=operation('bake')),
                               screen=types.SimpleNamespace(screenshot=operation('screenshot')))
    bpy = types.SimpleNamespace(app=types.SimpleNamespace(version_string='supplied CPU fixture, not Blender'),
        ops=ops, data=types.SimpleNamespace(objects=objects, meshes=types.SimpleNamespace(remove=remove_mesh)),
        context=types.SimpleNamespace(scene=scene))
    original_bodice = bodice.data

    def window(state):
        calls['window'] += 1
        state['originalMesh'] = bodice.data
        bodice.data = Mesh('private-bodice', Keys())
        ring = Object('window2_rim', Keys(False))  # allocated empty Key, not None
        objects[ring.name] = ring
        scene.objects.append(ring)
        state['ring'] = ring
        if failure == 'window':
            raise RuntimeError('injected failure after original W2 owned-copy boundary')
        return state['originalMesh'], ring, {'retainedFacePreservation': {'exactSemanticEqual':True}}

    def pose(*args, **kwargs):
        calls['pose'] += 1
    figure = types.SimpleNamespace(apply_pose=pose)
    posing = types.SimpleNamespace(apply_pose=pose, anchors=lambda *a:None, grip_hand=lambda *a:None, hand_rest=lambda *a:None)
    def head_install(cfg):
        posing.apply_pose = lambda *args: figure.apply_pose(*args)
        return cfg
    def render_objects(sc):
        if failure == 'filter':
            raise RuntimeError('injected occluder read failure')
        return [o for o in sc.objects if o.type=='MESH' and not o.hide_render]
    render = types.SimpleNamespace(render_objects=render_objects,
        render_passes=operation('render'), write_meta=operation('render'))
    driver = types.SimpleNamespace(figure_pose=figure, posing=posing,
        head_scale=types.SimpleNamespace(install=head_install), render=render,
        f1_module=lambda:types.SimpleNamespace(facepass=lambda *args:None))

    def library(path, name):
        return driver
    def hand_main():
        module = wrapper.X.H.library(wrapper.X.H.PIPE/'drive9/d9_blender.py', 'cpu-fixture')
        bpy.ops.wm.open_mainfile(filepath='fixture-only')
        if failure == 'render': bpy.ops.render.render(write_still=True)
        if failure == 'save': bpy.ops.wm.save_mainfile()
        if failure == 'bake': bpy.ops.object.bake()
        if failure == 'screenshot': bpy.ops.screen.screenshot()
        if failure == 'pose': module.figure_pose.apply_pose({})
        module.head_scale.install({'head':1.10})
        raise AssertionError('controlled audit stop failed to terminate before pose/render')
    return bpy, window, library, hand_main, driver, calls, removed, original_bodice


class Guards(unittest.TestCase):
    def test_actual_shape_state_none_empty_valid_out_of_range_show_only(self):
        with P.original_wrapper() as wrapper:
            scenarios = ((None,99,False,True,'none'), (Keys(False),0,False,False,'nonnull-empty'),
                         (Keys(),1,False,True,'real-key-blocks'), (Keys(),99,False,False,'real-key-blocks'),
                         (Keys(),1,True,False,'real-key-blocks'))
            for keys, index, show_only, accepted, kind in scenarios:
                ob = Object('observed-original', keys)
                ob.active_shape_key_index, ob.show_only_shape_key = index, show_only
                result = P.audit.observe(ob, wrapper.native.REST, 'supplied-CPU-source')
                self.assertEqual(result['original']['keysState'], kind)
                self.assertEqual(result['original']['activeShapeKeyIndexRaw']['value'], index)
                self.assertEqual(result['authoredGuard']['accepted'], accepted)
                self.assertTrue(result['originalRawStateUnchanged'])
                if kind == 'nonnull-empty' or index == 99 and keys is not None:
                    self.assertEqual(result['authoredGuard']['message'], 'invalid active native shape-key index')

    def test_actual_wrapper_audit_stop_failure_cleanup_pose_render_save_sentinels(self):
        for failure in (None, 'window', 'filter', 'pose', 'render', 'save', 'bake', 'screenshot'):
            with self.subTest(failure=failure), P.original_wrapper() as wrapper:
                bpy, window, library, hand_main, driver, calls, removed, original = fixture(wrapper, failure)
                argv_object, argv = sys.argv, sys.argv[:]
                path_object, path = sys.path, sys.path[:]
                old_native, old_eval = wrapper.native.install, wrapper.native.REST.evaluate
                old_render, old_pose, old_ops = driver.render.render_passes, driver.figure_pose.apply_pose, bpy.ops
                with tempfile.TemporaryDirectory(prefix='key-state-cpu-', dir=P.REPO/'review/rosace') as directory:
                    with patch.dict(sys.modules, {'bpy':bpy}), patch.object(wrapper.binding, 'verify', return_value={'sourceCount':946,'fixture':True}), \
                         patch.object(wrapper.X.W, 'install', window), patch.object(wrapper.X.H, 'library', library), \
                         patch.object(wrapper.X.H, 'main', hand_main):
                        before = P.audit.raw_state(bpy.data.objects['body'])
                        report, error = P.execute(wrapper, Path(directory)/'probe', {'fixture':True}, bpy)
                        self.assertEqual(report['status'], 'zero-image-prepose-audit-complete' if failure is None else 'zero-image-prepose-probe-rejected')
                        self.assertEqual(error is None, failure is None)
                        self.assertIs(wrapper.X.W.install, window)
                        self.assertIs(wrapper.X.H.library, library)
                        self.assertIs(wrapper.native.install, old_native)
                        self.assertIs(wrapper.native.REST.evaluate, old_eval)
                        self.assertIs(driver.render.render_passes, old_render)
                        self.assertIs(driver.figure_pose.apply_pose, old_pose)
                        self.assertIs(bpy.ops, old_ops)
                        self.assertIs(bpy.data.objects['bodice'].data, original)
                        self.assertNotIn('window2_rim', bpy.data.objects)
                        self.assertEqual(P.audit.raw_state(bpy.data.objects['body']), before)
                        self.assertEqual(calls['render'], 0)
                        self.assertEqual(calls['save'], 0)
                        self.assertEqual(calls['bake'], 0)
                        self.assertEqual(calls['screenshot'], 0)
                        self.assertEqual(calls['pose'], 0)
                        if failure in ('bake', 'screenshot'):
                            self.assertIsInstance(error, P.BoundaryViolation)
                            self.assertEqual(report['blockedBoundaryCalls'],
                                ['object.bake' if failure == 'bake' else 'screen.screenshot'])
                        self.assertTrue(report['outerArgvAndPathRestored'])
                        self.assertFalse(report['outerRestorationErrors'])
                        if failure is None:
                            self.assertEqual(report['occluders']['objectNames'], ['body','bodice','window2_rim'])
                            self.assertEqual(report['occluders']['rejectedObjects'], ['window2_rim'])
                            self.assertFalse(report['authoredRestGuardAcceptedForAllObjects'])
                            self.assertEqual(report['strictW2InstallCalls'], 1)
                            self.assertEqual(report['auditInstallCalls'], 1)
                            self.assertTrue(report['bodiceOriginalPointerRestored'])
                            self.assertTrue(report['bodyRawStateRestored'])
                            self.assertTrue(report['privateRingRemoved'])
                            self.assertEqual(len(removed), 3)
                        self.assertIs(sys.argv, argv_object)
                        self.assertEqual(sys.argv, argv)
                        self.assertIs(sys.path, path_object)
                        self.assertEqual(sys.path, path)


if __name__ == '__main__':
    (P.REPO/'review/rosace').mkdir(parents=True, exist_ok=True)
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Guards))
    print(json.dumps({'kind':'actual authored shape_state and original5965 wrapper with supplied CPU boundaries',
        'tests':result.testsRun, 'actualShapeStateCases':5, 'actualWrapperLifecycleCases':8,
        'passed':result.wasSuccessful(), 'nativeExecuted':False, 'aoResumed':False, 'renderedImages':0}))
    raise SystemExit(0 if result.wasSuccessful() else 1)
