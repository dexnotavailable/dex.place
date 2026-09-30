"""Fixed immutable cold-profile output comparison, never producer execution."""
import argparse
import hashlib
import io
import json
import math
import stat
import struct
import sys
import zlib
from pathlib import Path
sys.dont_write_bytecode = True
from PIL import Image

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[6]
REQUEST = Path('D:/Dex/Automation/reports/dex-suite-resumption-20260930/lanes/rosace-motion/proofs/profile-v1/run-2/native-request-build/native-request.json')
REQUEST_SHA = 'd7985e326f211fde3d2869457439c7ae7f0784e9ed48433b643bb13b43f6c46f'
BINDING_SHA = '8ce3d4d64803a85b44745cde8ab9a1fea984678c5ebc2318e4b72e55ebf8900a'
ORIGINAL_SOURCE = Path('D:/Dex/Temp/rosace-sharp-face-native-20260930')
ORIGINAL_REF = ORIGINAL_SOURCE/'review/rosace/art/next/sharp-face-preservation-delivery'
DEPTH2 = {
    'reconstruction-raw/idle/px144/depth2.png': ('fe6941ba53ee2e8ea70b670054f6b915484d2280c08d9fed1222ad1bea322de8',153053),
    'reconstruction-raw/idle/px80/depth2.png': ('f7186a4c098e3ba7ff47bd245a22ed68691b8c4833e64e6d5328c01b8e75b4e9',61585),
}
PASSES = ('id','normal','depth','depth2','light','beauty','noise')
JSON_NAMES = ('meta.json','reconstruction.json','window_geometry.json','haft_grips.json')
RELOCATIONS = {'/pose_file': ('art/rosace/poses/idle_appeal.json','a89f0ddf1fcb2b6a8e623abba51a790aee676603d004d61ce9b04eb6578df958'),
    '/d9/r2': ('tools/pixel-pipeline/drive9/r2_model.json','1b30ca8eccc324cda999d90e3bae20f58e62970483ea3f9f877b8d61f73cebf3')}


def require(ok,message):
    if not ok: raise ValueError(message)


class ComparisonMismatch(ValueError):
    def __init__(self,kind,details):
        super().__init__(kind+' comparison mismatch')
        self.details=dict(details,kind=kind)


def sha(data): return hashlib.sha256(data).hexdigest()


def no_links(path,boundary=None,exists=True):
    path=Path(path)
    require(path.is_absolute() and path.drive.lower()=='d:', 'explicit D-backed path required')
    for parent in reversed((path,*path.parents)):
        try:info=parent.lstat()
        except FileNotFoundError:continue
        require(not parent.is_symlink() and not parent.is_junction() and not (getattr(info,'st_file_attributes',0)&getattr(stat,'FILE_ATTRIBUTE_REPARSE_POINT',0x400)), 'symlink/junction/reparse input forbidden')
    resolved=path.resolve(strict=exists)
    if boundary is not None:
        require(resolved.is_relative_to(Path(boundary).resolve()) and resolved!=Path(boundary).resolve(), 'resolved input escapes its bound root')
    return resolved


def bounded_file(root,name):
    relative=Path(name)
    require(not relative.is_absolute() and '..' not in relative.parts, 'relative pin path required')
    path=no_links(Path(root)/relative,root)
    require(path.is_file(), 'ordinary bound file required')
    return path


def captured(path,expected=None,size=None):
    data=no_links(path).read_bytes()
    if expected is not None: require(sha(data)==expected,'frozen byte pin mismatch: '+str(path))
    if size is not None: require(len(data)==size,'frozen byte length mismatch')
    return data


def strict_read(data):
    def pairs(items):
        result={}
        for key,value in items:
            require(key not in result,'duplicate JSON field')
            result[key]=value
        return result
    def constant(value): raise ValueError('nonfinite JSON scalar: '+value)
    value=json.loads(data.decode('utf-8-sig'),object_pairs_hook=pairs,parse_constant=constant)
    def finite(item):
        if type(item) is float: require(math.isfinite(item),'nonfinite JSON number')
        elif type(item) is list:
            for v in item: finite(v)
        elif type(item) is dict:
            for v in item.values(): finite(v)
    finite(value)
    return value


def exact_json(reference,candidate,*,relocations=None,pointer='',observed=None):
    relocations=relocations or {};observed=[] if observed is None else observed
    if pointer in relocations:
        old,new,pin=relocations[pointer]
        require(type(reference) is str and reference==old,'authorized old path value differs: '+pointer)
        require(type(candidate) is str and candidate==new,'cold metadata must target bound NEW root: '+pointer)
        observed.append({'pointer':pointer,'reference':old,'candidate':candidate,'expectedNew':new,'sourceFileSha256':pin})
        return observed
    require(type(reference) is type(candidate),'JSON scalar/container type differs: '+pointer)
    if type(reference) is dict:
        require(set(reference)==set(candidate),'JSON fields differ: '+pointer)
        for key in reference:
            exact_json(reference[key],candidate[key],relocations=relocations,pointer=pointer+'/'+key.replace('~','~0').replace('/','~1'),observed=observed)
    elif type(reference) is list:
        require(len(reference)==len(candidate),'JSON array length differs: '+pointer)
        for index,(a,b) in enumerate(zip(reference,candidate)):
            exact_json(a,b,relocations=relocations,pointer=pointer+'/'+str(index),observed=observed)
    else:
        if type(reference) is float: require(math.isfinite(reference) and math.isfinite(candidate),'nonfinite JSON comparison')
        require(reference==candidate,'JSON value differs: '+pointer)
    return observed


def png_samples(data):
    require(data[:8]==b'\x89PNG\r\n\x1a\n','PNG signature required')
    offset=8;header=None;ended=False
    while offset<len(data):
        require(offset+12<=len(data),'truncated PNG chunk')
        size=struct.unpack('>I',data[offset:offset+4])[0];kind=data[offset+4:offset+8]
        end=offset+8+size
        require(end+4<=len(data),'truncated PNG payload')
        chunk=data[offset+8:end]
        require(zlib.crc32(kind+chunk)&0xffffffff==struct.unpack('>I',data[end:end+4])[0],'PNG CRC mismatch')
        require(kind not in (b'acTL',b'fcTL',b'fdAT'),'animated PNG unsupported')
        if header is None:
            require(kind==b'IHDR' and size==13,'first PNG chunk must be IHDR')
            header=struct.unpack('>IIBBBBB',chunk)
            w,h,depth,color,compression,filtering,interlace=header
            require(w>0 and h>0 and depth==8 and color==6 and compression==0 and filtering==0 and interlace==0,'only noninterlaced8bitRGBA PNG supported')
        else: require(kind!=b'IHDR','duplicate PNG header')
        offset=end+4
        if kind==b'IEND':
            require(size==0 and offset==len(data),'invalid/trailing PNG end');ended=True;break
    require(ended,'PNG IEND required')
    with Image.open(io.BytesIO(data)) as image:
        require(image.format=='PNG' and image.mode=='RGBA' and image.size==header[:2] and getattr(image,'n_frames',1)==1,'decoded PNG format/grid/channel mismatch')
        image.load();samples=image.tobytes('raw','RGBA')
    require(len(samples)==header[0]*header[1]*4,'RGBA8 sample length differs')
    return header[:2],samples


def compare_png(reference_bytes,candidate_bytes,dimensions):
    a,rgba_a=png_samples(reference_bytes)
    require(a==tuple(dimensions),'frozen reference PNG dimensions differ from binding')
    try:b,rgba_b=png_samples(candidate_bytes)
    except (ValueError,OSError) as error:raise ComparisonMismatch('png-format',{'reason':str(error)}) from error
    if b!=a:raise ComparisonMismatch('dimensions',{'expected':list(a),'candidate':list(b)})
    if rgba_a!=rgba_b:
        index=next(i for i,(left,right) in enumerate(zip(rgba_a,rgba_b)) if left!=right)
        pixel=index//4;start=pixel*4
        raise ComparisonMismatch('rgba8-samples',{'firstPixel':{'x':pixel%a[0],'y':pixel//a[0],
            'referenceRGBA':list(rgba_a[start:start+4]),'candidateRGBA':list(rgba_b[start:start+4]),
            'firstChannel':'RGBA'[index%4]},'transparentRGBIncluded':True,
            'referenceEncodedSha256':sha(reference_bytes),'candidateEncodedSha256':sha(candidate_bytes)})
    return {'dimensions':list(a),'rgba8Bytes':len(rgba_a),'decodedSamplesEqual':True,
        'referenceEncodedSha256':sha(reference_bytes),'candidateEncodedSha256':sha(candidate_bytes),
        'encodedBytesEqual':reference_bytes==candidate_bytes}


def supplement(data):
    value=strict_read(data)
    require(set(value)=={'contract','scope','requestSha256','bindingSha256','originalReferenceRoot','files'},'supplement fields differ')
    require(value['contract']=='dex.cold-depth2-supplement/1' and value['requestSha256']==REQUEST_SHA and value['bindingSha256']==BINDING_SHA,'supplement request/binding differs')
    require(Path(value['originalReferenceRoot'])==ORIGINAL_REF,'supplement original cohort differs')
    rows=value['files'];require(type(rows)is list and len(rows)==2 and len({p['path'] for p in rows})==2,'exact two supplemental depth2 pins required')
    for row in rows:
        require(set(row)=={'path','sha256','bytes'} and row['path'] in DEPTH2 and type(row['bytes']) is int and (row['sha256'],row['bytes'])==DEPTH2[row['path']],'supplement depth2 pin mismatch')
    return value


def source_membership(source_root,tree):
    directory=no_links(Path(source_root)/tree['path'],source_root)
    rows=[]
    def walk(folder):
        for path in folder.iterdir():
            resolved=no_links(path,source_root)
            if resolved.is_dir(): walk(resolved)
            elif resolved.is_file() and resolved.suffix in tree['extensions']:
                rows.append({'path':resolved.relative_to(source_root).as_posix(),'sha256':sha(captured(resolved))})
    walk(directory)
    rows.sort(key=lambda r:r['path'])
    require(rows==tree['files'] and len(rows)==tree['count'],'frozen source tree membership/hash differs: '+tree['path'])
    return rows


def verify_frozen():
    request=strict_read(captured(REQUEST,REQUEST_SHA))
    binding=strict_read(captured(REQUEST.with_name('profile-binding.json'),BINDING_SHA))
    exact_json(binding,request['binding'])
    require(binding['declaredSourceHead']=='54518211eb9a342bc5f6689562c5a0179d466a52','fixed producer identity differs')
    roots={name:no_links(value,exists=name not in ('renderRoot','exportRoot')) for name,value in binding['roots'].items()}
    require(len(binding['sourcePins'])==12 and len(binding['privatePins'])==1 and len(binding['referencePins'])==23,'frozen pin inventory differs')
    files={}
    for tree in binding['sourceTrees']:
        for row in source_membership(roots['sourceRoot'],tree):files[row['path']]=row['sha256']
    require([t['count'] for t in binding['sourceTrees']]==[174,48,717],'frozen source tree cohort differs')
    for row in binding['sourcePins']:
        captured(bounded_file(roots['sourceRoot'],row['path']),row['sha256']);files[row['path']]=row['sha256']
    for row in binding['privatePins']:captured(bounded_file(roots['privateRoot'],row['path']),row['sha256'])
    original=no_links(ORIGINAL_REF)
    for row in binding['referencePins']:
        captured(bounded_file(roots['referenceRoot'],row['path']),row['sha256'])
        captured(bounded_file(original,row['path']),row['sha256'])
    extra=supplement(captured(HERE/'depth2-supplement.json'))
    for row in extra['files']:captured(bounded_file(original,row['path']),row['sha256'],row['bytes'])
    argv=request['command']['argv'];require(argv.count('--out')==1,'single literal bound --out required')
    cold=no_links(argv[argv.index('--out')+1],exists=False)
    require(cold==roots['renderRoot']/'reconstruction-raw','literal output/binding differs')
    require(len(request['expectedOutputs'])==21,'immutable old21 expected inventory differs')
    relative=[f'idle/px{px}/{name}' for px in (80,144) for name in ('meta.json',*[p+'.png' for p in PASSES if p!='depth2'],'reconstruction.json','window_geometry.json','haft_grips.json')]+['mesh-preservation/retained-face-preservation.json']
    require(set(request['expectedOutputs'])=={str(cold/name) for name in relative},'old21 bound output paths differ')
    for pointer,(relative,pin) in RELOCATIONS.items(): require(files.get(relative)==pin,'relocation source file pin differs: '+pointer)
    return {'request':request,'binding':binding,'roots':roots,'coldRoot':cold,'originalRoot':original,
        'supplementSha256':sha(captured(HERE/'depth2-supplement.json')),'sourceFilePins':files,
        'sourceTreeMembershipPolicy':'exact trusted filelists, count and every SHA; aggregate digest not regenerated'}


def complete_names():
    return [f'idle/px{px}/{p}.png' for px in (80,144) for p in PASSES]+[f'idle/px{px}/{n}' for px in (80,144) for n in JSON_NAMES]+['mesh-preservation/retained-face-preservation.json']


def missing_names(raw_root):
    raw_root=no_links(raw_root,exists=False)
    for name in complete_names():no_links(raw_root/name,raw_root,exists=False)
    return [name for name in complete_names() if not (raw_root/name).exists()]


def compare_files(context,reference_raw,candidate_raw):
    """Functions accept labelled utility file roots; the CLI never does."""
    reference_raw=no_links(reference_raw);candidate_raw=no_links(candidate_raw)
    names=complete_names()
    for name in names:bounded_file(reference_raw,name);bounded_file(candidate_raw,name)
    png_rows=[];json_rows=[];relocation_rows=[]
    comparisons={r['px']:r for r in context['binding']['comparison']}
    for px in (80,144):
        comp=comparisons[px];dims=[v*comp['ss'] for v in comp['canvas']]
        for name in PASSES:
            relative=f'idle/px{px}/{name}.png'
            try:result=compare_png(captured(bounded_file(reference_raw,relative)),captured(bounded_file(candidate_raw,relative)),dims)
            except ComparisonMismatch as error:
                error.details['file']=relative;raise
            png_rows.append(dict(result,file=relative))
        for name in JSON_NAMES:
            relative=f'idle/px{px}/{name}'
            a=strict_read(captured(bounded_file(reference_raw,relative)));b=strict_read(captured(bounded_file(candidate_raw,relative)))
            allowed={}
            if name=='meta.json':
                expected={'px':px,'ss':comp['ss'],'yaw':float(comp['camera'][0]),'elev':float(comp['camera'][1]),'canvas':comp['canvas'],'anchor':comp['anchor'],'ppm':comp['ppm']}
                exact_json(expected,{k:a[k] for k in expected})
                require(set(PASSES).issubset(a['passes']),'required frozen seven pass metadata missing')
                for pointer,(source,pin) in RELOCATIONS.items():
                    allowed[pointer]=(str(ORIGINAL_SOURCE/source),str(context['roots']['sourceRoot']/source),pin)
            try:
                relocated=exact_json(a,b,relocations=allowed)
                if name=='meta.json':exact_json(expected,{k:b[k] for k in expected})
            except ValueError as error:
                message=str(error)
                raise ComparisonMismatch('json',{'file':relative,'jsonPointer':message.split(': ',1)[1] if ': ' in message else '',
                    'reason':message}) from error
            if name=='meta.json':require({r['pointer'] for r in relocated}==set(RELOCATIONS),'all four authorized relocation leaves required')
            relocation_rows.extend(dict(r,file=relative) for r in relocated)
            json_rows.append({'file':relative,'exactOutsideAuthorizedLeaves':True})
    relative='mesh-preservation/retained-face-preservation.json'
    a=strict_read(captured(bounded_file(reference_raw,relative)));b=strict_read(captured(bounded_file(candidate_raw,relative)))
    try:exact_json(a,b)
    except ValueError as error:
        message=str(error);raise ComparisonMismatch('json',{'file':relative,'jsonPointer':message.split(': ',1)[1] if ': ' in message else '',
            'reason':message}) from error
    json_rows.append({'file':relative,'exactOutsideAuthorizedLeaves':True})
    return {'pngComparisons':png_rows,'jsonComparisons':json_rows,'authorizedRelocations':relocation_rows,
        'comparedInventory':{'png':14,'json':9,'total':23},'originalExpectedOutputs':21,'newSupplementalDepth2':2,
        'comparisonOnly':True,'nativeExecutionProven':False,'fullPipelineProven':False,'appearance9':False,
        'limits':'exact raw comparison only; not native execution provenance, finished/six-still post, physical cloth, accepted appearance or World proof'}


def comparison_outcome(context,reference_raw,candidate_raw):
    # Only compared candidate differences become bounded failure reports.
    # Frozen-input/format/path admission errors remain exceptions with no report.
    try:return dict(compare_files(context,reference_raw,candidate_raw),status='exact-raw-comparison-pass',comparisonPassed=True)
    except ComparisonMismatch as error:
        return {'status':'comparison-failed','comparisonPassed':False,'failure':error.details,
            'comparisonOnly':True,'nativeExecutionProven':False,'fullPipelineProven':False}


def production_compare(output):
    context=verify_frozen();output=no_links(output,exists=False)
    require(not output.exists(),'fresh report root required')
    consumed=[*context['roots'].values(),context['originalRoot'],ORIGINAL_SOURCE,context['coldRoot'],REPO,HERE]
    for base in consumed:require(not output.is_relative_to(base) and not base.is_relative_to(output),'report root overlaps consumed root')
    require(not any(part.lower()=='public' for part in output.parts),'private report root required')
    cold=context['coldRoot'];missing=missing_names(cold)
    if missing:
        result={'status':'missing-cold-output','comparisonPassed':False,'missing':missing,'comparisonOnly':True,'nativeExecutionProven':False,'fullPipelineProven':False}
    else:result=comparison_outcome(context,context['originalRoot']/'reconstruction-raw',cold)
    result.update(requestSha256=REQUEST_SHA,bindingSha256=BINDING_SHA,supplementSha256=context['supplementSha256'],
        originalColdOutputRoot=str(cold),frozenPinVerification='all source/private/frozen23+same original23+two supplemental depth2 verified',
        sourceTreeMembershipPolicy=context['sourceTreeMembershipPolicy'])
    output.mkdir(parents=True)
    with (output/'comparison.json').open('x',encoding='utf-8') as stream:stream.write(json.dumps(result,indent=2,allow_nan=False)+'\n')
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__,allow_abbrev=False)
    parser.add_argument('--out',required=True,type=Path)
    try:
        args=parser.parse_args();result=production_compare(args.out)
        print(json.dumps({'status':result['status'],'report':str(args.out/'comparison.json'),'nativeExecutionProven':False,'fullPipelineProven':False}))
        sys.exit(2 if result['status']=='missing-cold-output' else 1 if result['status']=='comparison-failed' else 0)
    except (ValueError,OSError,KeyError) as error:
        print(str(error),file=sys.stderr);sys.exit(1)
