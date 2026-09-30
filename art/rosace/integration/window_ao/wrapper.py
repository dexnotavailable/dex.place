"""Opt-in delivery entry; actual preserved reconstruction wrapper runs unchanged."""
import json
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
REPO=Path(__file__).resolve().parents[4]
_import_path=sys.path[:]
try:
    # Blender --python/importlib does not guarantee the entry's directory is
    # searchable. Scope both sibling/helper paths to dependency import only.
    sys.path.insert(0,str(REPO/'tools/pixel-pipeline/next'))
    sys.path.insert(0,str(HERE))
    import binding
    import native
    import nx_reconstruction_blender as X
finally:
    sys.path[:]=_import_path
    del _import_path


def execute(mode,output,provenance):
    if mode not in ('control','rebaked'):
        raise ValueError('explicit matched open-geometry control/rebaked mode')
    state={}; restorations=[]
    old_install=X.W.install
    old_library=X.H.library
    old_recipe=X.H.hand_recipe
    old_mode=X.R.MODE
    old_argv=sys.argv[:]
    def remember(obj,name):
        key=(id(obj),name)
        if not any((id(a),n)==key for a,n,_ in restorations):
            restorations.append((obj,name,getattr(obj,name)))
    def install(window_state):
        state['windowState']=window_state
        try:
            result=old_install(window_state) # complete unmodified W2 strict guards
        finally:
            import bpy
            if 'originalMesh' in window_state:
                current=bpy.data.objects['bodice'].data
                if current is not window_state['originalMesh']:
                    state['privateBodice']=current
            if 'ring' in window_state:
                ring=window_state['ring']
                state.update(ringName=ring.name,ringPointer=ring.as_pointer(),privateRingMesh=ring.data)
        if mode=='rebaked':
            native.install(result[1],result[2],state)
        return result
    def library(path,name):
        module=old_library(path,name)
        if path.resolve()!=(X.H.PIPE/'drive9/d9_blender.py').resolve():
            return module
        for obj,attr in ((module.posing,'apply_pose'),(module.figure_pose,'apply_pose'),
                         (module.posing,'grip_hand'),(module.posing,'hand_rest'),
                         (module.head_scale,'install'),(module,'f1_module')):
            remember(obj,attr)
        prior_f1=module.f1_module
        def f1():
            component=prior_f1(); remember(component,'facepass')
            prior_face=component.facepass
            def face(scene,meta,directory):
                result=prior_face(scene,meta,directory)
                record={'mode':mode,'provenance':provenance,
                        'bodyDataTouched':mode=='rebaked','controlHook':'no body copy, update or AO inspection'}
                if mode=='rebaked':
                    import bpy
                    from bpy_extras.object_utils import world_to_camera_view
                    ob=state['body'].evaluated_get(bpy.context.evaluated_depsgraph_get())
                    mesh=ob.to_mesh()
                    try:
                        source=state['body'].data
                        if len(mesh.vertices)!=len(source.vertices) or len(mesh.polygons)!=len(source.polygons) or any(list(a.vertices)!=list(b.vertices) for a,b in zip(mesh.polygons,source.polygons)):
                            raise AssertionError('evaluated body source indices/topology changed')
                        support=[]
                        for index in state['aoReport']['plan']['supportFaces']:
                            points=[]
                            for i in mesh.polygons[index].vertices:
                                p=world_to_camera_view(scene,scene.camera,ob.matrix_world@mesh.vertices[i].co)
                                native.G.finite(p)
                                points.append([p.x*scene.render.resolution_x/meta['ss'],
                                               (1-p.y)*scene.render.resolution_y/meta['ss'],p.z])
                            support.append({'sourceFaceIndex':index,'points':points})
                        record.update(ao=state['aoReport'],supportProjectedPx=support,
                                      evaluatedBodyGeometrySha256=native.hash_rows(
                                          [list(ob.matrix_world@v.co) for v in mesh.vertices]))
                    finally:
                        ob.to_mesh_clear()
                Path(directory,'window_ao.json').write_text(json.dumps(record,indent=2,allow_nan=False),encoding='utf-8')
                return result
            component.facepass=face
            return component
        module.f1_module=f1
        return module
    X.W.install=install
    X.H.library=library
    # Forward only the frozen reconstruction invocation. AO is the sole difference.
    sys.argv=[old_argv[0],'--',*binding.native_args(output)]
    errors=[]
    try:
        X.main()
    finally:
        # Run every restoration even if a native guard, render, or cleanup raises.
        sys.argv=old_argv
        X.W.install=old_install; X.H.library=old_library
        X.H.hand_recipe=old_recipe; X.R.MODE=old_mode
        for obj,name,value in reversed(restorations):
            try:
                setattr(obj,name,value)
            except Exception as error:
                errors.append(f'{name}: {error}')
        try:
            native.restore(state)
        except Exception as error:
            errors.append(f'body restoration: {error}')
        # The unchanged reconstruction wrapper normally does this first. This
        # idempotent fallback covers its own cleanup exceptions/partial install.
        window=state.get('windowState',{})
        if window:
            import bpy
            try:
                if 'originalMesh' in window:
                    bpy.data.objects['bodice'].data=window['originalMesh']
            except Exception as error:
                errors.append(f'bodice rollback: {error}')
            try:
                ring=bpy.data.objects.get(state.get('ringName',''))
                if ring is not None:
                    if ring.as_pointer()!=state['ringPointer']:
                        raise AssertionError('private ring identity changed during cleanup')
                    bpy.data.objects.remove(ring,do_unlink=True)
            except Exception as error:
                errors.append(f'W2 ring rollback: {error}')
            for key in ('privateBodice','privateRingMesh'):
                try:
                    mesh=state.get(key)
                    if mesh is not None:
                        if mesh.users:
                            raise AssertionError(f'{key} still has users after rollback')
                        bpy.data.meshes.remove(mesh)
                except Exception as error:
                    errors.append(f'{key} removal: {error}')
        if errors:
            raise RuntimeError('AO wrapper cleanup failed: '+'; '.join(errors))


def main():
    args=sys.argv[sys.argv.index('--')+1:]
    if len(args)!=4 or args[0]!='--window-ao-mode' or args[2]!='--out':
        raise ValueError('only --window-ao-mode control|rebaked --out <fresh-private-path> accepted')
    output=Path(args[3]).resolve()
    if output.exists() or (REPO/'review/rosace').resolve() not in output.parents:
        raise ValueError('fresh executing private output required')
    provenance=binding.verify()
    execute(args[1],output,provenance)
    binding.verify() # no source/frozen-input mutation during actual native run


if __name__=='__main__':
    main()
