"""UTILITY ONLY: genuine pinned545 file copies; no producer/native output proof."""
import argparse
import copy
import io
import json
import shutil
import struct
import subprocess
import sys
import zlib
from pathlib import Path
sys.dont_write_bytecode=True
import compare_cold as C
from PIL import Image,PngImagePlugin


def write(path,value):
    with path.open('x',encoding='utf-8') as stream:stream.write(json.dumps(value,indent=2,allow_nan=False)+'\n')


def encoded(image):
    output=io.BytesIO();image.save(output,format='PNG',compress_level=9);return output.getvalue()


def prove(output):
    output=C.no_links(output,exists=False);assert not output.exists()
    context=C.verify_frozen()
    for root in (*context['roots'].values(),context['originalRoot'],C.ORIGINAL_SOURCE,C.REPO):
        assert not output.is_relative_to(root) and not root.is_relative_to(output)
    output.mkdir(parents=True)
    reference=output/'utility-reference-raw';candidate=output/'utility-candidate-raw'
    for name in C.complete_names():
        source=C.bounded_file(context['originalRoot']/'reconstruction-raw',name)
        for root in (reference,candidate):
            path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(C.captured(source))
    for px in (80,144):
        meta_path=candidate/f'idle/px{px}/meta.json';meta=C.strict_read(meta_path.read_bytes())
        for pointer,(relative,pin) in C.RELOCATIONS.items():
            assert context['sourceFilePins'][relative]==pin
            target=str(context['roots']['sourceRoot']/relative)
            if pointer=='/pose_file':meta['pose_file']=target
            else:meta['d9']['r2']=target
        meta_path.write_text(json.dumps(meta,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    # Encoding only: every RGBA sample, including RGB under alpha0, remains exact.
    beauty=candidate/'idle/px80/beauty.png'
    original_encoded=beauty.read_bytes()
    with Image.open(io.BytesIO(original_encoded)) as image:
        assert image.mode=='RGBA'
        info=PngImagePlugin.PngInfo();info.add_text('fixture','encoding-only UTILITY; no native run')
        output_bytes=io.BytesIO();image.save(output_bytes,format='PNG',compress_level=9,pnginfo=info)
    assert output_bytes.getvalue()!=original_encoded
    beauty.write_bytes(output_bytes.getvalue())
    result=C.compare_files(context,reference,candidate)
    assert result['comparedInventory']=={'png':14,'json':9,'total':23}
    assert len(result['authorizedRelocations'])==4
    assert sum(not row['encodedBytesEqual'] for row in result['pngComparisons'])>=1
    utility_result=dict(result,fixtureRole='UTILITY ONLY genuine545 copies, encoding change, explicit bound path leaves; NOT cold native output',
        referenceFixtureRoot=str(reference),candidateFixtureRoot=str(candidate))
    write(output/'utility-comparison.json',utility_result)
    negatives=[]
    def reject(name,call):
        try:call()
        except (ValueError,OSError,KeyError):negatives.append(name)
        else:raise AssertionError(name+' was admitted')
    reference_meta=C.strict_read((reference/'idle/px80/meta.json').read_bytes())
    candidate_meta=C.strict_read((candidate/'idle/px80/meta.json').read_bytes())
    allowed={pointer:(str(C.ORIGINAL_SOURCE/relative),str(context['roots']['sourceRoot']/relative),pin) for pointer,(relative,pin) in C.RELOCATIONS.items()}
    altered=copy.deepcopy(candidate_meta);altered['pose_file']=reference_meta['pose_file']
    reject('old root forbidden even when pixels match',lambda:C.exact_json(reference_meta,altered,relocations=allowed))
    altered=copy.deepcopy(candidate_meta);altered['d9']['r2']='D:/Dex/Temp/unauthorized-r2.json'
    reject('unauthorized metadata path',lambda:C.exact_json(reference_meta,altered,relocations=allowed))
    altered=copy.deepcopy(candidate_meta);altered['extra_field']='ignored?'
    reject('unknown extra JSON field',lambda:C.exact_json(reference_meta,altered,relocations=allowed))
    for field,delta in (('yaw',.001),('ppm',.000001)):
        altered=copy.deepcopy(candidate_meta);altered[field]+=delta
        reject('exact '+field+' mismatch',lambda:C.exact_json(reference_meta,altered,relocations=allowed))
    altered=copy.deepcopy(candidate_meta);altered['canvas'][0]+=1
    reject('exact canvas JSON mismatch',lambda:C.exact_json(reference_meta,altered,relocations=allowed))
    altered=copy.deepcopy(candidate_meta);altered['ss']=4.0
    reject('numeric type int versus float',lambda:C.exact_json(reference_meta,altered,relocations=allowed))
    reject('boolean versus integer',lambda:C.exact_json({'v':True},{'v':1}))
    reject('NaN JSON',lambda:C.strict_read(b'{"v":NaN}'))
    reject('overflow nonfinite JSON',lambda:C.strict_read(b'{"v":1e999}'))
    reject('duplicate JSON key',lambda:C.strict_read(b'{"v":1,"v":1}'))
    reconstruction=C.strict_read((reference/'idle/px80/reconstruction.json').read_bytes())
    altered=copy.deepcopy(reconstruction);bone=next(iter(altered['evaluatedBoneMatrices']));altered['evaluatedBoneMatrices'][bone][0][0]+=.000001
    reject('actual113bone rig matrix mismatch',lambda:C.exact_json(reconstruction,altered))
    geometry=C.strict_read((reference/'idle/px80/window_geometry.json').read_bytes())
    altered=copy.deepcopy(geometry);altered['boundaryProjectedPx'][0][0]+=.001
    reject('actual projected geometry mismatch',lambda:C.exact_json(geometry,altered))
    preserved=C.strict_read((reference/'mesh-preservation/retained-face-preservation.json').read_bytes())
    altered=copy.deepcopy(preserved);altered['afterFaceCount']+=1
    reject('actual4737retained face report mismatch',lambda:C.exact_json(preserved,altered))
    a=(reference/'idle/px80/beauty.png').read_bytes();dimensions,samples=C.png_samples(a)
    image=Image.frombytes('RGBA',dimensions,samples);pixel=next((i for i in range(0,len(samples),4) if samples[i+3]==0),0)
    xy=((pixel//4)%dimensions[0],(pixel//4)//dimensions[0]);color=list(image.getpixel(xy));color[0]=(color[0]+1)%256;image.putpixel(xy,tuple(color))
    reject('actual RGBA sample including transparent RGB',lambda:C.compare_png(a,encoded(image),dimensions))
    candidate_beauty=candidate/'idle/px80/beauty.png';before=candidate_beauty.read_bytes();candidate_beauty.write_bytes(encoded(image))
    pixel_failure=C.comparison_outcome(context,reference,candidate)
    assert pixel_failure['status']=='comparison-failed' and pixel_failure['comparisonPassed'] is False
    assert pixel_failure['failure']['file']=='idle/px80/beauty.png' and pixel_failure['failure']['kind']=='rgba8-samples'
    assert pixel_failure['failure']['firstPixel']['x']==xy[0] and pixel_failure['failure']['firstPixel']['y']==xy[1]
    write(output/'utility-pixel-failure-report.json',dict(pixel_failure,fixtureRole='UTILITY ONLY actual reference sample mutation; no native comparison'))
    candidate_beauty.write_bytes(before)
    candidate_geometry=candidate/'idle/px80/window_geometry.json';before=candidate_geometry.read_bytes()
    altered=C.strict_read(before);altered['boundaryProjectedPx'][0][0]+=.001
    candidate_geometry.write_text(json.dumps(altered,indent=2)+'\n',encoding='utf-8')
    geometry_failure=C.comparison_outcome(context,reference,candidate)
    assert geometry_failure['status']=='comparison-failed' and geometry_failure['comparisonPassed'] is False
    assert geometry_failure['failure']['file']=='idle/px80/window_geometry.json' and geometry_failure['failure']['jsonPointer']=='/boundaryProjectedPx/0/0'
    write(output/'utility-geometry-failure-report.json',dict(geometry_failure,fixtureRole='UTILITY ONLY geometry mutation; no native comparison'))
    candidate_geometry.write_bytes(before)
    image=Image.frombytes('RGBA',dimensions,samples).crop((0,0,dimensions[0]-1,dimensions[1]))
    reject('actual PNG dimensions',lambda:C.compare_png(a,encoded(image),dimensions))
    for field,value in ((24,16),(25,2)):
        header=bytearray(a);header[field]=value;header[29:33]=struct.pack('>I',zlib.crc32(header[12:29])&0xffffffff)
        reject('unsupported PNG header field '+str(field),lambda:C.png_samples(bytes(header)))
    image=Image.frombytes('RGBA',dimensions,samples);other=image.copy();other.putpixel((0,0),(1,2,3,4))
    animated=io.BytesIO();image.save(animated,format='PNG',save_all=True,append_images=[other],duration=[16,17],loop=0)
    reject('animated PNG rejected',lambda:C.png_samples(animated.getvalue()))
    missing=output/'utility-missing-depth2'
    for name in C.complete_names():
        if name=='idle/px80/depth2.png':continue
        target=missing/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((candidate/name).read_bytes())
    reject('missing supplemental depth2',lambda:C.compare_files(context,reference,missing))
    extras=C.strict_read((C.HERE/'depth2-supplement.json').read_bytes());extras['files'][0]['sha256']='0'*64
    reject('supplemental pin mismatch',lambda:C.supplement(json.dumps(extras).encode()))
    reject('frozen input pin mismatch',lambda:C.captured(reference/'idle/px80/meta.json','0'*64))
    # Containment fixture only, with no privileged file-symlink attempt.
    sibling=output/'junction-sibling';sibling.mkdir();(sibling/'outside.txt').write_bytes(b'boundary fixture only\n')
    linked=output/'junction-input'
    pwsh=shutil.which('pwsh');assert pwsh
    command="New-Item -ItemType Junction -Path '"+str(linked).replace("'","''")+"' -Target '"+str(sibling).replace("'","''")+"' | Out-Null"
    subprocess.run([pwsh,'-NoProfile','-Command',command],check=True)
    assert linked.is_junction() and not linked.is_symlink()
    reject('junction input rejected',lambda:C.captured(linked/'outside.txt'))
    # Production CLI has no utility-root override. A function-only absent path
    # proves missing classification without touching the actual cold root.
    absent=output/'utility-absent-raw'
    assert not absent.exists() and C.missing_names(absent)==C.complete_names()
    production_missing=None
    if not context['coldRoot'].exists():
        command=[sys.executable,str(C.HERE/'compare_cold.py'),'--out',str(output/'missing-production-cli')]
        process=subprocess.run(command,capture_output=True,text=True)
        assert process.returncode==2,(process.returncode,process.stdout,process.stderr)
        production_missing=C.strict_read((output/'missing-production-cli/comparison.json').read_bytes())
        assert production_missing['status']=='missing-cold-output' and len(production_missing['missing'])==23
    else:
        production_missing={'status':'not-executed-actual-output-present','isolatedMissingFunctionFixture':'23/23missing',
            'limits':'actual cold output read-only; source utility worker does not run production comparison or claim native output absent'}
    proof={'status':'pass-bounded-comparison-utilities','fixtureRole':'UTILITY ONLY; actual expected coldRoot never populated',
        'comparisonOnly':True,'nativeExecutionProven':False,'fullPipelineProven':False,
        'requestSha256':C.REQUEST_SHA,'bindingSha256':C.BINDING_SHA,'supplementSha256':context['supplementSha256'],
        'sourceTreeCounts':[t['count'] for t in context['binding']['sourceTrees']],
        'frozenInputCohortsVerified':{'sourcePins':12,'privatePins':1,'frozenReferencePins':23,'sameOriginalReferencePins':23,'newDepth2Pins':2},
        'utilityCompared':result['comparedInventory'],'authorizedRelocations':result['authorizedRelocations'],
        'encodingOnlyPixelEquality':True,'negativeCount':len(negatives),'negatives':negatives,
        'boundedFailureReports':{'actualSample':pixel_failure['failure'],'geometry':geometry_failure['failure']},
        'productionMissingCheck':production_missing['status'],
        'sourceFiles':{p.name:C.sha(p.read_bytes()) for p in (C.HERE/'compare_cold.py',Path(__file__),C.HERE/'depth2-supplement.json')},
        'limits':'not producer execution, cold native provenance, appearance9, finished/six-still post, cloth, full pipeline or World acceptance'}
    write(output/'proof.json',proof);print(json.dumps({'proof':str(output/'proof.json'),'negativeCount':len(negatives),'nativeExecutionProven':False}))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__,allow_abbrev=False);parser.add_argument('--out',required=True,type=Path)
    args=parser.parse_args();prove(args.out)
