"""Direct real postguard fixtures; no masked/mocked ROI or post run."""
import copy
import hashlib
import json
import struct
import tempfile
import zlib
from pathlib import Path
import facecage_inputs as I
import facecage_native_post as P


def reject(call):
    try: call()
    except (AssertionError,ValueError): return
    raise AssertionError('mutated postguard input was admitted')


def controls(shot,px):
    frozen=P.read(I.R2/shot/f'px{px}/meta.json')
    failed=P.read(I.FAILED/shot/f'px{px}/meta.json')
    control=copy.deepcopy(failed)
    name=Path(frozen['pose_file']).name
    control['pose_file']=str(I.REPO/'art/rosace/poses'/name)
    control['pose_sha1']=hashlib.sha1(Path(control['pose_file']).read_bytes()).hexdigest()[:12]
    control['d9']['r2']=str(I.REPO/'tools/pixel-pipeline/drive9/r2_model.json')
    candidate=copy.deepcopy(control)
    anchors=candidate['anchors']; originals={side:copy.deepcopy(anchors[f'eye_{side}']) for side in 'LR'}
    placement={side:originals[side][:3] for side in 'LR'}
    anchors.update(facecage_rig_eye_anchors=originals,facecage_eye_placement=placement,facecage_anchor_role=P.ANCHOR_ROLE)
    return control,candidate,frozen,failed


def chunk(kind,data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def png(w,h):
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress((b'\0'+bytes([0,0,0,255])*w)*h))+chunk(b'IEND',b'')


def main():
    binding=I.verify(); cases=0
    for shot in ('idle','back'):
        for px in (144,80):
            args=controls(shot,px); record={'sourceInputBinding':binding}
            proof=P.guard_metadata(*args,record,record,binding)
            assert proof['allOtherMetadataExact']; cases+=1
    am,bm,old,failed=controls('idle',144); record={'sourceInputBinding':binding}
    for field in ('ppm','height_m','yaw','elev'):
        a,b=copy.deepcopy(am),copy.deepcopy(bm); a[field]+=1; b[field]+=1
        reject(lambda:P.guard_metadata(a,b,old,failed,record,record,binding)); cases+=1
    a,b=copy.deepcopy(am),copy.deepcopy(bm)
    a['cam']['loc'][0]+=1; b['cam']['loc'][0]+=1
    reject(lambda:P.guard_metadata(a,b,old,failed,record,record,binding)); cases+=1
    altered={'sourceInputBinding':dict(binding,inputBindingSha256='tampered')}
    reject(lambda:P.guard_metadata(am,bm,old,failed,altered,record,binding)); cases+=1
    reject(lambda:P.guard_metadata(am,bm,old,failed,record,altered,binding)); cases+=1
    a,b=copy.deepcopy(am),copy.deepcopy(bm); a['pose_sha1']=b['pose_sha1']='000000000000'
    reject(lambda:P.guard_metadata(a,b,old,failed,record,record,binding)); cases+=1
    for role in ('frozen','failed'):
        f,d=copy.deepcopy(old),copy.deepcopy(failed)
        (f if role=='frozen' else d)['depth_range'][0]+=.001
        reject(lambda:P.guard_metadata(am,bm,f,d,record,record,binding)); cases+=1
    with tempfile.TemporaryDirectory(prefix='postguards-',dir=I.HERE) as directory:
        root=Path(directory); first=root/'a.json'; second=root/'b.json'
        first.write_bytes(b'{\r\n"number":1,"text":"fixed"\r\n}\r\n')
        second.write_bytes(first.read_bytes().replace(b'\r\n',b'\n'))
        left,_=P.source_identity(str(first),'a.json')
        # Same filename in separate directories, exact LF bytes equivalence.
        sub=root/'second'; sub.mkdir(); same=sub/'a.json'; same.write_bytes(second.read_bytes())
        right,_=P.source_identity(str(same),'a.json'); assert left==right; cases+=1
        for changed in (b'{\n"number":2,"text":"fixed"\n}\n',b'{\n"number":1,"text":"changed"\n}\n',second.read_bytes()+b' '):
            same.write_bytes(changed); changed_id,_=P.source_identity(str(same),'a.json')
            reject(lambda:P.exact_metadata_value(changed_id,left)); cases+=1
        a=root/'control'; b=root/'candidate'; a.mkdir(); b.mkdir()
        meta={'canvas':[3,4],'ss':1}
        for path in (a,b):
            for name in P.PASSES: (path/name).write_bytes(png(3,4))
        P.guarded_raw_images(a,b,meta,meta); cases+=1
        for name in P.PASSES:
            (b/name).write_bytes(png(3,1))
            reject(lambda:P.guarded_raw_images(a,b,meta,meta)); cases+=1
            (b/name).write_bytes(png(3,4))
        # The discriminating case formerly broadcast H1 against H4 into an
        # equal all-zero RGB difference. The actual guard rejects before ROI.
        (a/'normal.png').write_bytes(png(3,1))
        reject(lambda:P.guarded_raw_images(a,b,meta,meta)); cases+=1
    for path in I.HERE.glob('*.py'): compile(path.read_text(),str(path),'exec')
    print(json.dumps({'kind':'direct FC1 post binding/frozen-semantic/dimension guards, no actual post',
        'cases':cases,'actualDualFrozenMetadataLfSourceEquivalencePairs':4,'allSevenRawShapesBeforeRoi':True,
        'inputBinding':binding,'sourceCompiled':True,'postRun':False,'nativeExecuted':False},indent=2))


if __name__=='__main__': main()
