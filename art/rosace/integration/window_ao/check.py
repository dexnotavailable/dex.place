"""CPU source fixtures; mocks prove guards/cleanup, never native execution."""
import copy
import json
import math
import shutil
import sys
import tempfile
import types
from pathlib import Path
import binding as B
import geometry as G
import native as N
import wrapper as W
import check_rest


def refuses(call):
    try:
        call()
    except (ValueError,AssertionError,RuntimeError):
        return
    raise AssertionError('negative fixture unexpectedly passed')


def geometry_checks():
    inner=[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1]]
    verts=[[-.5,.02,-.5],[.5,.02,-.5],[.5,.02,.5],[-.5,.02,.5],
           [2,.02,2],[3,.02,2],[3,.02,3],[2,.02,3],
           [1,.02,-.5],[2,.02,-.5],[2,.02,.5],[1,.02,.5]]
    faces=[[0,1,2,3],[4,5,6,7],[8,9,10,11],[0,3,2,1]]
    normals=[[0,-1,0],[0,-1,0],[0,-1,0],[0,1,0]]
    result=G.select(verts,faces,normals,inner,.075)
    assert result['selectedFaces']==[0] and result['selectedPoints']==[0,1,2,3]
    assert result['supportFaces']==[0,3] # shared-point interpolation is explicitly admitted
    assert G.select(verts,faces,normals,list(reversed(inner)),.075)==result
    for gap in (0,-.01,.076):
        bad=copy.deepcopy(verts)
        for v in bad:
            v[1]=gap
        refuses(lambda:G.select(bad,faces,normals,inner,.075))
    mixed=copy.deepcopy(verts); mixed[0][1]=-.01
    refuses(lambda:G.select(mixed,faces,normals,inner,.075))
    nonfinite=copy.deepcopy(verts); nonfinite[0][0]=math.nan
    refuses(lambda:G.select(nonfinite,faces,normals,inner,.075))
    badfaces=copy.deepcopy(faces); badfaces[0][0]=-1
    refuses(lambda:G.select(verts,badfaces,normals,inner,.075))
    badfaces=copy.deepcopy(faces); badfaces[0][1]=0
    refuses(lambda:G.select(verts,badfaces,normals,inner,.075))
    bow=[[-1,0,-1],[1,0,1],[-1,0,1],[1,0,-1]]
    refuses(lambda:G.triangles(bow))
    concave=[[-1,0,-1],[1,0,-1],[1,0,1],[0,0,0],[-1,0,1]]
    assert len(G.triangles(concave))==3
    assert not G.clip([(1,0),(2,0),(1,1)],[(0,0),(1,0),(0,1)])
    assert G.ray_value([None]*24,.075,.9,0)==1
    assert G.ray_value([0]*24,.075,.9,0)==1-.9
    assert G.ray_value([.075]*24,.075,.9,.25)==.75
    assert G.ray_value([.0375]*24,.075,.9,.25)==(1-.9*sum([.75]*24)/24)*.75
    for payload in ([None]*23,[math.nan]*24,[-.001]*24,[.076]*24):
        refuses(lambda:G.ray_value(payload,.075,.9,0))
    refuses(lambda:G.ray_value([None]*24,.075,.9,1.01))
    return 'pass'


def preservation_binding_checks():
    before={'pointSchema':['ao','crease'],'outsideAoHash':'original','positions':[[0.0,0.0,0.0]],'UV':[[.1,.2]]}
    N.assert_preserved(before,copy.deepcopy(before))
    for key,value in (('pointSchema',['ao']),('outsideAoHash','changed'),('positions',[[1e-15,0,0]]),('UV',[[.1,.2000000001]])):
        changed=copy.deepcopy(before); changed[key]=value
        refuses(lambda:N.assert_preserved(before,changed))
    payload={'contract':B.contract(),'source':{'a':'0'},'inputs':{'blend':'1'},'actual545Evidence':{'actual-open':'2'}}
    B.verify_data(payload,payload['source'],payload['inputs'],payload['actual545Evidence'])
    for key in ('source','inputs','actual545Evidence'):
        for mutation in ('value','addition','deletion'):
            changed=copy.deepcopy(payload[key])
            if mutation=='value':
                changed[next(iter(changed))]='mutated'
            elif mutation=='addition':
                changed['new']='unbound'
            else:
                changed.pop(next(iter(changed)))
            args=[payload['source'],payload['inputs'],payload['actual545Evidence']]
            args[('source','inputs','actual545Evidence').index(key)]=changed
            refuses(lambda:B.verify_data(payload,*args))
    changed=copy.deepcopy(payload); changed['contract']['bodyAo']['strength']=.8
    refuses(lambda:B.verify_data(changed,payload['source'],payload['inputs'],payload['actual545Evidence']))
    fake=types.SimpleNamespace(data=types.SimpleNamespace(shape_keys=None,uv_layers=[],corner_normals=[],has_custom_normals=False,attributes=[
        types.SimpleNamespace(domain='UNSUPPORTED',name='x')]))
    refuses(lambda:N.snapshot(fake))
    return 'pass'


def post_scope_checks():
    import post
    import numpy as np
    image=np.zeros((4,4,4),dtype=np.uint8); image[...,3]=255
    allow=np.zeros((4,4),bool); allow[1:3,1:3]=True
    candidate=image.copy(); candidate[1,1,1]=12
    assert post.compare_data(image,candidate,allow,allow)=={'changed':1,'outside':0,'alpha':0}
    # Represent adaptive quantization changing an unrelated skin pixel.
    candidate[3,3,1]=24
    assert post.compare_data(image,candidate,allow,allow)=={'changed':2,'outside':1,'alpha':0}
    candidate[1,1,3]=0
    assert post.compare_data(image,candidate,allow,allow)=={'changed':2,'outside':1,'alpha':1}
    refuses(lambda:post.compare_data(image,candidate,allow[:2],allow))
    # Compile every new source without writing Python bytecode artifacts.
    for path in B.HERE.glob('*.py'):
        compile(path.read_text(encoding='utf-8'),str(path),'exec')
    return 'pass'


def wrapper_checks():
    """Run the actual wrapper -> actual X.main through injected CPU surfaces."""
    X=W.X; H=X.H
    class Mesh:
        def __init__(self,name):
            self.name=name; self.users=0
    class Object:
        def __init__(self,name,mesh):
            self.name=name; self._data=mesh; mesh.users+=1
        @property
        def data(self):
            return self._data
        @data.setter
        def data(self,value):
            self._data.users-=1; self._data=value; value.users+=1
        def as_pointer(self):
            return id(self)
    class Objects(dict):
        def remove(self,obj,do_unlink=True):
            self.pop(obj.name,None); obj.data.users-=1
    class Meshes:
        def __init__(self):
            self.removed=[]
        def remove(self,mesh):
            assert mesh.users==0; self.removed.append(mesh)
    saved={k:getattr(H,k) for k in ('main','library','REPO','hand_recipe')}
    old_install=X.W.install; old_native=N.install; old_snapshot=N.snapshot
    old_bpy=sys.modules.get('bpy'); old_mode=X.R.MODE; old_argv=sys.argv[:]
    try:
        for failure in (None,'partial-window','AO','render','cleanup'):
            with tempfile.TemporaryDirectory(prefix='cpu-wrapper-',dir=B.HERE) as temp:
                root=Path(temp); H.REPO=root; output=root/'review/rosace/run'
                body=Object('body',Mesh('original-body')); bodice=Object('bodice',Mesh('original-bodice'))
                original_body=body.data; original_bodice=bodice.data
                objects=Objects(body=body,bodice=bodice)
                rig=types.SimpleNamespace(pose=types.SimpleNamespace(bones=[types.SimpleNamespace(name='b',matrix=[[1.0]])]))
                objects['rosace_rig']=rig; meshes=Meshes()
                sys.modules['bpy']=types.SimpleNamespace(data=types.SimpleNamespace(objects=objects,meshes=meshes))
                prior=lambda *a,**k:None
                component=types.SimpleNamespace(facepass=prior)
                posing=types.SimpleNamespace(apply_pose=prior,grip_hand=prior,hand_rest=prior)
                figure=types.SimpleNamespace(apply_pose=prior)
                def head_install(cfg):
                    posing.apply_pose=lambda pose:figure.apply_pose(pose)
                head=types.SimpleNamespace(install=head_install)
                original_f1=lambda:component
                driver=types.SimpleNamespace(posing=posing,figure_pose=figure,head_scale=head,f1_module=original_f1)
                def library(path,name):
                    return driver
                def install(state):
                    state['originalMesh']=original_bodice
                    bodice.data=Mesh('private-bodice')
                    ring=Object('window2_rim',Mesh('private-ring')); objects[ring.name]=ring; state['ring']=ring
                    if failure=='partial-window':
                        raise RuntimeError('injected W2 strict-guard failure')
                    return original_bodice,ring,{'retainedFacePreservation':{'exactSemanticEqual':True}}
                def snapshot(ob,allowed=()):
                    if failure=='cleanup' and ob is body and ob.data is original_body and seen_ao:
                        raise RuntimeError('injected cleanup verification error after pointer restoration')
                    return {'identity':ob.data.name}
                seen_ao=False
                def ao(ring,window,state):
                    nonlocal seen_ao
                    state.update(body=body,originalBody=original_body,originalBodySnapshot={'identity':original_body.name})
                    candidate=Mesh('private-body'); state['bodyCopy']=candidate; body.data=candidate; seen_ao=True
                    if failure=='AO':
                        raise RuntimeError('injected partially written AO')
                    return {}
                def main():
                    loaded=H.library(H.PIPE/'drive9/d9_blender.py','fixture')
                    loaded.f1_module() # exercise nested F1 hook mutation
                    loaded.head_scale.install({})
                    loaded.posing.apply_pose({'name':'idle_appeal'})
                    if failure=='render':
                        raise RuntimeError('injected render failure')
                    for px in (144,80):
                        raw=output/'idle'/f'px{px}'; raw.mkdir(parents=True)
                        (raw/'haft_grips.json').write_text(json.dumps({'grips':{}}))
                H.library=library; H.main=main; X.W.install=install; N.install=ao; N.snapshot=snapshot
                X.R.MODE='prior-test-mode'
                if failure:
                    refuses(lambda:W.execute('rebaked',output,{'fixture':True}))
                else:
                    W.execute('rebaked',output,{'fixture':True})
                assert body.data is original_body and bodice.data is original_bodice
                assert 'window2_rim' not in objects
                assert H.library is library and X.W.install is install
                assert H.hand_recipe is saved['hand_recipe'] and X.R.MODE=='prior-test-mode'
                assert posing.apply_pose is prior and posing.grip_hand is prior and posing.hand_rest is prior
                assert figure.apply_pose is prior and head.install is head_install and driver.f1_module is original_f1
                assert component.facepass is prior
                assert sys.argv==old_argv
                assert len(meshes.removed)==(2 if failure=='partial-window' else 3)
        # Matched control must not invoke any body AO install/restore path.
        with tempfile.TemporaryDirectory(prefix='cpu-control-',dir=B.HERE) as temp:
            root=Path(temp); H.REPO=root; output=root/'review/rosace/run'
            H.main=lambda:(_ for _ in ()).throw(RuntimeError('control render interruption'))
            N.install=lambda *a:(_ for _ in ()).throw(AssertionError('control touched body'))
            refuses(lambda:W.execute('control',output,{}))
        return 6
    finally:
        for key,value in saved.items():
            setattr(H,key,value)
        X.W.install=old_install; N.install=old_native; N.snapshot=old_snapshot
        X.R.MODE=old_mode; sys.argv=old_argv
        if old_bpy is None:
            sys.modules.pop('bpy',None)
        else:
            sys.modules['bpy']=old_bpy


def main():
    counts={'geometryRayFixtures':geometry_checks(),
            'typedOutsideBindingFixtures':preservation_binding_checks(),
            'actualWrapperInjectedCleanupPaths':wrapper_checks(),
            'shapeAwareRestHelper':check_rest.run(),
            'outsideScopeAndSourceSyntax':post_scope_checks()}
    print(json.dumps({'status':'source-fixtures-pass','counts':counts,
                      'nativeExecuted':False,'artAccepted':False,
                      'limits':'injected CPU fixtures test actual wrapper control flow; native Blender schemas/BVH/readback/render remain pending'},indent=2))


if __name__=='__main__':
    main()
