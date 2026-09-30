"""Actual stripped-path/cache import; no native dependency is invoked."""
import importlib.abc
import importlib.util
import sys
import subprocess
from pathlib import Path

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
MODULES=('binding','native','geometry','rest_geometry','mesh_preservation',
         'nx_reconstruction_blender','nx_window_mesh_blender','nx_hands_blender',
         'window_mesh_recipe','hand_recipe','reconstruction_recipe')
PROBE='rosace_ao_actual_entry_import_probe'


def run():
    original_path=sys.path[:]; path_object=sys.path
    original_modules={name:sys.modules.get(name) for name in (*MODULES,PROBE)}
    original_meta=sys.meta_path[:]
    original_bpy=sys.modules.get('bpy')
    routes=0
    class RejectNative(importlib.abc.MetaPathFinder):
        def find_spec(self,fullname,path=None,target=None):
            if fullname=='native':
                raise ModuleNotFoundError('injected sibling import failure')
    try:
        for failure in (False,True):
            for name in (*MODULES,PROBE):
                sys.modules.pop(name,None)
            sys.path[:]=[entry for entry in original_path
                         if Path(entry or '.').resolve() not in (HERE,(REPO/'tools/pixel-pipeline/next').resolve())]
            stripped=sys.path[:]
            assert str(HERE) not in sys.path and str(REPO/'tools/pixel-pipeline/next') not in sys.path
            if failure:
                sys.meta_path.insert(0,RejectNative())
            spec=importlib.util.spec_from_file_location(PROBE,HERE/'wrapper.py')
            module=importlib.util.module_from_spec(spec)
            sys.modules[PROBE]=module
            if failure:
                try:
                    spec.loader.exec_module(module)
                except ModuleNotFoundError as error:
                    assert str(error)=='injected sibling import failure'
                else:
                    raise AssertionError('import failure probe unexpectedly passed')
                assert Path(sys.modules['binding'].__file__).resolve()==HERE/'binding.py'
            else:
                spec.loader.exec_module(module)
                for name in ('binding','native','geometry','rest_geometry'):
                    assert Path(sys.modules[name].__file__).resolve()==HERE/(name+'.py')
                assert module.binding is sys.modules['binding']
                assert module.native is sys.modules['native']
                assert module.native.REST is sys.modules['rest_geometry']
                assert module.X is sys.modules['nx_reconstruction_blender']
                assert Path(module.X.__file__).resolve()==REPO/'tools/pixel-pipeline/next/nx_reconstruction_blender.py'
            assert sys.path is path_object and sys.path==stripped
            assert sys.modules.get('bpy') is original_bpy
            sys.meta_path[:]=original_meta
            routes+=1
        for name in ('geometry.py','native.py','rest_geometry.py','post.py','check_rest.py'):
            frozen=subprocess.check_output(['git','show',
                '1295062e2454c85d584751ba58448a1b18bef34c:art/rosace/integration/window_ao/'+name],cwd=REPO)
            if (HERE/name).read_bytes()!=frozen:
                raise AssertionError('bounded entry repair changed frozen calculation/rest source: '+name)
    finally:
        sys.path[:]=original_path
        sys.meta_path[:]=original_meta
        for name,old in original_modules.items():
            if old is None:
                sys.modules.pop(name,None)
            else:
                sys.modules[name]=old
    return {'actualImportRoutes':routes,'realSiblingLoadWithoutHereOrHelperPath':'pass',
            'sysPathIdentityAndContentsRestoredOnSuccessAndFailure':'pass',
            'fiveFrozenCalculationRestFilesByteExact129':True,
            'bpyImportedOrNativeCalled':False}
