"""One zero-image PREPOSE audit through the exact existing5965 wrapper."""
import contextlib
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
_own_path = sys.path[:]
try:
    sys.path.insert(0, str(HERE))
    import key_state_audit as audit
    import probe_binding
finally:
    sys.path[:] = _own_path
    del _own_path

OLD = REPO / 'art/rosace/integration/window_ao'
MODULES = ('binding', 'native', 'geometry', 'rest_geometry', 'mesh_preservation',
           'nx_reconstruction_blender', 'nx_window_mesh_blender', 'nx_hands_blender',
           'window_mesh_recipe', 'hand_recipe', 'reconstruction_recipe')
WRAPPER_NAME = 'rosace_window_ao_key_state_original5965_wrapper'


class AuditComplete(BaseException):
    """Intentional termination AFTER all observations, BEFORE AO/pose/render."""


class BoundaryViolation(RuntimeError):
    pass


@contextlib.contextmanager
def original_wrapper():
    path_object, paths = sys.path, sys.path[:]
    saved = {name: sys.modules.get(name) for name in (*MODULES, WRAPPER_NAME)}
    try:
        for name in saved:
            sys.modules.pop(name, None)
        spec = importlib.util.spec_from_file_location(WRAPPER_NAME, OLD / 'wrapper.py')
        wrapper = importlib.util.module_from_spec(spec)
        sys.modules[WRAPPER_NAME] = wrapper
        spec.loader.exec_module(wrapper)
        yield wrapper
    finally:
        sys.path = path_object
        sys.path[:] = paths
        for name, value in saved.items():
            if value is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = value


class Patches:
    def __init__(self):
        self.rows = []

    def set(self, owner, name, value):
        if not any(o is owner and n == name for o, n, _ in self.rows):
            self.rows.append((owner, name, getattr(owner, name)))
        setattr(owner, name, value)

    def restore(self):
        errors = []
        for owner, name, value in reversed(self.rows):
            try:
                setattr(owner, name, value)
                if getattr(owner, name) is not value:
                    raise AssertionError('restored callable/module identity differs')
            except Exception as error:
                errors.append({'attribute': name, 'exceptionType': type(error).__name__, 'message': str(error)})
        return errors


class OpsNamespace:
    def __init__(self, target, category, reject):
        self.target, self.category, self.reject = target, category, reject

    def __getattr__(self, name):
        if self.category == 'render' or 'save' in name or 'bake' in name or name == 'screenshot' or self.category.startswith('export_'):
            return self.reject(self.category + '.' + name)
        return getattr(self.target, name)


class OpsGuard:
    def __init__(self, target, reject):
        self.target, self.reject = target, reject

    def __getattr__(self, category):
        if category == 'render' or category.startswith('export_'):
            return OpsNamespace(None, category, self.reject)
        return OpsNamespace(getattr(self.target, category), category, self.reject)


def execute(wrapper, output, provenance, bpy):
    patches = Patches()
    argv_object, argv_before = sys.argv, sys.argv[:]
    path_object, path_before = sys.path, sys.path[:]
    report = {'kind': 'original5965 zero-image PREPOSE authored key-state audit',
              'sourceBase': '5965e24337551120ad5c7a0f87dff1aa726a6ce4',
              'nativeVersion': bpy.app.version_string, 'inputProvenance': provenance,
              'nativeSemanticsQualifiedBySource': False, 'aoResumed': False,
              'aoPlanCalled': False, 'aoRaysCalled': False, 'bodyCopyCreated': False,
              'poseCalled': False, 'renderedImages': 0, 'blendSaved': False,
              'blockedBoundaryCalls': [], 'strictW2InstallCalls': 0, 'auditInstallCalls': 0}
    old_window = wrapper.X.W.install
    old_library = wrapper.X.H.library
    render_module = None
    window_originals = {}

    def reject(name):
        def forbidden(*args, **kwargs):
            report['blockedBoundaryCalls'].append(name)
            raise BoundaryViolation('zero-image PREPOSE boundary forbids ' + name)
        return forbidden

    def window(state):
        report['strictW2InstallCalls'] += 1
        if report['strictW2InstallCalls'] != 1:
            raise BoundaryViolation('one original W2 preparation only')
        window_originals['bodiceMesh'] = bpy.data.objects['bodice'].data
        report['bodyBeforeW2'] = audit.observe(bpy.data.objects['body'], wrapper.native.REST, 'before-original-W2')
        try:
            return old_window(state)  # unmodified W2, one original model-preparation path
        finally:
            if state.get('ring') is not None:
                window_originals['ring'] = state['ring']
                window_originals['ringName'] = state['ring'].name
            report['bodyAfterW2'] = audit.observe(bpy.data.objects['body'], wrapper.native.REST, 'after-original-W2')

    def library(path, name):
        nonlocal render_module
        module = old_library(path, name)
        if path.resolve() == (wrapper.X.H.PIPE / 'drive9/d9_blender.py').resolve():
            render_module = module.render
            for owner, attr, label in ((module.figure_pose, 'apply_pose', 'figure_pose.apply_pose'),
                                       (module.posing, 'apply_pose', 'posing.apply_pose'),
                                       (module.posing, 'anchors', 'posing.anchors'),
                                       (module.render, 'render_passes', 'render.render_passes'),
                                       (module.render, 'write_meta', 'render.write_meta')):
                patches.set(owner, attr, reject(label))
        return module

    def install(ring, window_report, state):
        report['auditInstallCalls'] += 1
        if report['auditInstallCalls'] != 1 or report['strictW2InstallCalls'] != 1:
            raise BoundaryViolation('one audit after one original W2 install required')
        if not window_report['retainedFacePreservation']['exactSemanticEqual']:
            raise AssertionError('original unmodified strict retained-face guard did not pass')
        if render_module is None:
            raise AssertionError('actual driver render module not captured')
        observed = audit.occluders(bpy.context.scene, render_module, wrapper.native.REST)
        required = {bpy.data.objects['body'].name, bpy.data.objects['bodice'].name, ring.name}
        if not required <= set(observed['objectNames']):
            raise AssertionError('actual body/cut bodice/ring are absent from original occluder filter')
        report.update(occluders=observed, strictRetainedFacePreservation=window_report['retainedFacePreservation'],
                      authoredRestGuardAcceptedForAllObjects=not observed['rejectedObjects'],
                      auditComplete=True, status='zero-image-prepose-audit-complete')
        raise AuditComplete()

    failure = None
    try:
        patches.set(bpy, 'ops', OpsGuard(bpy.ops, reject))
        patches.set(wrapper.X.W, 'install', window)
        patches.set(wrapper.X.H, 'library', library)
        patches.set(wrapper.native, 'install', install)
        for owner, name, label in ((wrapper.native.REST, 'evaluate', 'REST.evaluate'),
                                    (wrapper.native.G, 'select', 'AO geometry.select'),
                                    (wrapper.native.G, 'ray_value', 'AO geometry.ray_value'),
                                    (wrapper.native, 'scalar_attr', 'AO scalar_attr'),
                                    (wrapper.native, 'snapshot', 'AO body snapshot')):
            patches.set(owner, name, reject(label))
        sys.argv = [argv_before[0], '--', '--window-ao-mode', 'rebaked', '--out', str(output / 'preflight')]
        try:
            wrapper.main()  # actual5965 entry/binding/model/W2/finally, never a new AO entry
        except AuditComplete:
            if not report.get('auditComplete') or report['auditInstallCalls'] != 1:
                raise AssertionError('controlled stop arrived before complete audit')
        else:
            raise BoundaryViolation('original wrapper returned without the zero-image controlled stop')
    except BaseException as error:
        failure = error
        report.update(status='zero-image-prepose-probe-rejected',
                      failure={'exceptionType': type(error).__name__, 'message': str(error)})
    finally:
        try:
            if 'bodiceMesh' in window_originals:
                report['bodiceOriginalPointerRestored'] = bpy.data.objects['bodice'].data is window_originals['bodiceMesh']
                report['bodyAfterCleanup'] = audit.observe(bpy.data.objects['body'], wrapper.native.REST, 'after-original-wrapper-cleanup')
                report['bodyRawStateRestored'] = report['bodyAfterCleanup']['beforeRawStateSha256'] == report['bodyBeforeW2']['beforeRawStateSha256']
                report['privateRingRemoved'] = 'ringName' not in window_originals or bpy.data.objects.get(window_originals['ringName']) is None
                if not all(report[name] for name in ('bodiceOriginalPointerRestored', 'bodyRawStateRestored', 'privateRingRemoved')):
                    raise AssertionError('actual original W2/body/ring cleanup readback failed')
        except Exception as error:
            report['originalCleanupReadbackFailure'] = {'exceptionType': type(error).__name__, 'message': str(error)}
            failure = error
            report['status'] = 'zero-image-prepose-probe-cleanup-rejected'
        errors = patches.restore()
        sys.argv = argv_object
        sys.argv[:] = argv_before
        sys.path = path_object
        sys.path[:] = path_before
        report['outerRestorationErrors'] = errors
        report['outerArgvAndPathRestored'] = sys.argv is argv_object and sys.argv == argv_before and sys.path is path_object and sys.path == path_before
        if errors:
            report['status'] = 'zero-image-prepose-probe-cleanup-rejected'
            failure = RuntimeError('probe intercept restoration failed: ' + json.dumps(errors))
    return report, failure


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 2 or args[0] != '--out':
        raise ValueError('only --out <fresh-private-zero-image-probe-output> accepted')
    output = Path(args[1]).resolve()
    private = (REPO / 'review/rosace/integration/window_ao_key_state').resolve()
    if output.exists() or private not in output.parents:
        raise ValueError('fresh executing private key-state-probe output required')
    with original_wrapper() as wrapper:
        provenance = probe_binding.verify(wrapper.binding)
        import bpy
        report, failure = execute(wrapper, output, provenance, bpy)
        try:
            report['inputsAfterCleanup'] = probe_binding.verify(wrapper.binding)
        except Exception as error:
            report['inputPreservationFailure'] = {'exceptionType': type(error).__name__, 'message': str(error)}
            failure = error
        image_files = [str(p.relative_to(output)) for p in output.rglob('*')
                       if p.is_file() and p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.gif', '.webp', '.exr', '.blend')]
        report['forbiddenImageOrBlendFiles'] = image_files
        if image_files:
            report['status'] = 'zero-image-prepose-output-boundary-rejected'
            failure = BoundaryViolation('probe produced forbidden image or blend files')
        output.mkdir(parents=True, exist_ok=True)
        diagnostic = output / 'key-state-audit.json'
        if diagnostic.exists():
            raise ValueError('never overwrite key-state diagnostic')
        diagnostic.write_bytes((json.dumps(report, indent=2, allow_nan=False) + '\n').encode())
        print(json.dumps({'diagnostic': str(diagnostic), 'status': report['status'],
                          'rejectedObjects': report.get('occluders', {}).get('rejectedObjects'),
                          'renderedImages': 0, 'aoResumed': False}))
        if failure is not None:
            raise failure


if __name__ == '__main__':
    main()
