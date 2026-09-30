"""Real historical pixel/pivot utility + labelled CPU/admission negatives only.

Never fabricates a completed Stage3 batch/post or invokes native/finish work.
"""
import argparse,copy,hashlib,json,math,subprocess,shutil
from pathlib import Path
import receive_stage3 as R

def write(path,value):
    with path.open('x',encoding='utf-8') as stream: stream.write(json.dumps(value,indent=2,allow_nan=False)+'\n')

def prove(out,source_root):
    out=Path(out);assert not out.exists();out.mkdir(parents=True)
    repo=Path(__file__).resolve().parents[6]
    packet_root=Path('D:/Dex/Automation/reports/dex-suite-resumption-20260930/lanes/stage3-motion')
    receipt=packet_root/'proofs/first-slice-v2/first-slice-source-receipt.json'
    binding=packet_root/'proofs/first-slice-v2/frozen-inputs/stage3-first-slice-v2.json'
    negatives=[]
    def reject(name,call):
        try:call()
        except (ValueError,KeyError,FileNotFoundError):negatives.append(name)
        else:raise AssertionError(name+' was admitted')
    # Windows boundary fixture only: ordinary text files, never native/post
    # success data. A junction is not a symlink on this Python/Windows surface.
    regular=out/'tree-regular';regular.mkdir();(regular/'nested').mkdir()
    (regular/'a.txt').write_bytes(b'regular-file-control\n')
    (regular/'nested'/'b.txt').write_bytes(b'nested-regular-control\n')
    expected_rows=[[name,R.sha((regular/name).read_bytes())] for name in ('a.txt','nested/b.txt')]
    expected_digest=R.sha(json.dumps(expected_rows,separators=(',',':'),ensure_ascii=False).encode())
    assert R.tree_digest(regular)==expected_digest
    junction_root=out/'tree-junction';junction_root.mkdir()
    sibling=out/'external-sibling';sibling.mkdir();(sibling/'outside.txt').write_bytes(b'external-sibling-junction-negative\n')
    link=junction_root/'escape'
    pwsh=shutil.which('pwsh')
    assert pwsh is not None,'Windows junction fixture needs existing PowerShell'
    # Static filesystem creation inside this fresh owned proof root only.
    ps="New-Item -ItemType Junction -Path '"+str(link).replace("'","''")+"' -Target '"+str(sibling).replace("'","''")+"' | Out-Null"
    subprocess.run([pwsh,'-NoProfile','-Command',ps],check=True)
    assert not link.is_symlink() and link.is_junction() and not link.resolve().is_relative_to(junction_root.resolve())
    attempted_reads=[];original_captured=R.captured
    def trace_read(path,expected=None):
        attempted_reads.append(str(path))
        assert Path(path).resolve().is_relative_to(junction_root.resolve()),'junction external file reached read/hash'
        return original_captured(path,expected)
    R.captured=trace_read
    try:reject('Windows junction rejected before external read/hash',lambda:R.tree_digest(junction_root))
    finally:R.captured=original_captured
    assert attempted_reads==[]
    boundary_proof={'fixtureRole':'regular text and Windows junction boundary only; no native/post success',
        'regularTreeDigest':expected_digest,'regularTreeDigestMatched':True,
        'junctionIsSymlink':link.is_symlink(),'junctionIsJunction':link.is_junction(),
        'junctionReparseAttributes':link.lstat().st_file_attributes,
        'junctionResolvesOutsideRoot':not link.resolve().is_relative_to(junction_root.resolve()),
        'junctionRejected':True,'fileReadHashAttempts':attempted_reads}
    write(out/'junction-boundary-proof.json',boundary_proof)
    C=R.guards(Path(source_root),receipt,R.RECEIPT)
    # Nine-child containment utility only: these .png/.json-named files contain
    # labelled text, not raw native passes or a positive batch/receiver dataset.
    native_control=out/'native-child-control';native_control.mkdir()
    raw_control=native_control/'raw';raw_control.mkdir()
    for name in sorted(C.S.RAW_FILES):(raw_control/name).write_bytes(('regular raw-child path control '+name+'\n').encode())
    checked=R.validate_raw_children(C,[{'raw':str(raw_control)}],native_control.resolve())
    assert len(checked)==9 and {p.name for p in checked}==set(C.S.RAW_FILES)
    native_negative=out/'native-child-negative';native_negative.mkdir()
    raw_negative=native_negative/'raw';raw_negative.mkdir()
    for name in sorted(C.S.RAW_FILES-{'meta.json'}):(raw_negative/name).write_bytes(b'raw-child boundary negative text only\n')
    raw_link=raw_negative/'meta.json'
    ps="New-Item -ItemType Junction -Path '"+str(raw_link).replace("'","''")+"' -Target '"+str(sibling).replace("'","''")+"' | Out-Null"
    subprocess.run([pwsh,'-NoProfile','-Command',ps],check=True)
    assert raw_link.is_junction() and not raw_link.resolve().is_relative_to(native_negative.resolve())
    raw_read_attempts=[];original_captured=R.captured
    def raw_trace(path,expected=None):
        raw_read_attempts.append(str(path));raise AssertionError('raw-child utility must not read/hash')
    R.captured=raw_trace
    try:
        try:R.validate_raw_children(C,[{'raw':str(raw_negative)}],native_negative.resolve())
        except ValueError as error:
            require_message=str(error);assert require_message=='input leaves its explicit root'
            negatives.append('raw child junction containment rejected before Stage3 reads')
        else:raise AssertionError('outside raw child admitted')
    finally:R.captured=original_captured
    assert raw_read_attempts==[]
    missing=out/'native-child-missing';missing.mkdir();(missing/'raw').mkdir()
    for name in sorted(C.S.RAW_FILES-{'meta.json'}):(missing/'raw'/name).write_bytes(b'missing raw-child control text only\n')
    reject('missing ordinary raw child rejected',lambda:R.validate_raw_children(C,[{'raw':str(missing/'raw')}],missing.resolve()))
    raw_boundary={'fixtureRole':'nine regular text children plus outside directory-junction child; no raw/native batch/post success',
        'owningRawNames':sorted(C.S.RAW_FILES),'regularChildCount':len(checked),'allRegularChildrenBound':True,
        'outsideDirectoryJunctionChildRejected':True,'rejectionReason':require_message,'fileReadHashAttempts':raw_read_attempts,
        'fileSymlinkExploitDemonstrated':False,'limits':'directory junction tests path containment only; no privileged file-symlink fixture attempted'}
    write(out/'raw-child-boundary-proof.json',raw_boundary)
    body=C.validate_frozen_binding(binding,R.BODY)
    packet=C.read(body['motionTicks']['path']);C.validate_ticks(packet)
    reject('wrong frozen overlay source head/hash',lambda:R.guards(Path(source_root),receipt,'0'*64))
    reject('incomplete bare source root',lambda:R.guards(repo,receipt,R.RECEIPT))
    reject('body binding mutated hash',lambda:C.validate_frozen_binding(binding,'0'*64))
    wrong_packet=copy.deepcopy(packet);wrong_packet['ticks'][0]['frame']=0
    reject('simulation inventory wrong frame',lambda:C.validate_ticks(wrong_packet))
    for route in C.CONTACT_ROUTES:
        clock=C.playback(packet,route)
        for row in clock['ticks']:
            f=row['simulationFrame'];row.update(sprite=f'px80/f{f:03d}/FX-{route}.png',matchedNoFX=f'px80/f{f:03d}/noFX.png',matchedClothOff=f'cloth-off/px80/f{f:03d}/noFX.png')
        R.validate_clock(C,clock,packet,80,route)
        bad=copy.deepcopy(clock);bad['ticks'][0]['matchedClothOff']='px80/f001/noFX.png'
        reject('wrong cloth control clock '+route,lambda:R.validate_clock(C,bad,packet,80,route))
        bad=copy.deepcopy(clock);bad['ticks'][0]['actorTick']+=1
        reject('wrong actor clock '+route,lambda:R.validate_clock(C,bad,packet,80,route))
    # Small synthetic identity dictionaries exercise join checks, not a full
    # native/post success fixture or an installation candidate.
    record={'identity':{k:'synthetic-'+k for k in R.NATIVE_KEYS},'rawSha256':{k:'0'*64 for k in ('id.png','normal.png','depth2.png','meta.json','facepass.json')}}
    identity=dict(record['identity'],rawSha256=record['rawSha256'],finishSha256='1'*64)
    R.finished_identity(identity,record,'1'*64)
    for key in ('simulationFrame','bodyBindingSha256','driverSha256','clothGeometrySha256','sceneSha256'):
        bad=dict(identity);bad[key]='wrong'
        reject('synthetic finished join '+key,lambda:R.finished_identity(bad,record,'1'*64))
    bad=dict(identity,rawSha256={});reject('synthetic raw identity mismatch',lambda:R.finished_identity(bad,record,'1'*64))
    reject('synthetic finish identity mismatch',lambda:R.finished_identity(identity,record,'2'*64))
    bad=dict(identity,normal='unsupported.png');reject('unsupported finished normals',lambda:R.finished_identity(bad,record,'1'*64))
    # Feed the actual current preflight request as an intake: reject before any
    # output, even though it is an externally hashed genuine source artifact.
    request=packet_root/'NATIVE-PREFLIGHT-V2.json'
    args=argparse.Namespace(source_root=Path(source_root),native_root=packet_root,post_root=out,
        out=out.parent/(out.name+'-must-not-exist.json'),batch=request,batch_sha256=R.sha(request.read_bytes()),
        body_binding=binding,body_binding_sha256=R.BODY,ticks_sha256=R.TICKS,source_fingerprint_sha256=R.SOURCE,
        source_receipt=receipt,source_receipt_sha256=R.RECEIPT,post_proof_sha256='0'*64,post_tree_sha256='0'*64,finish_sha256='0'*64)
    reject('actual preflight ready request cannot export',lambda:R.receive(args));assert not args.out.exists()
    args.batch_sha256='0'*64;reject('native batch external hash mismatch',lambda:R.receive(args));assert not args.out.exists()
    partial=out/'synthetic-partial-admission-negative.json'
    write(partial,{'contract':'rosace.n1-n2-native-batch/1','runtimeExported':False,'frames':[],
        'fixtureRole':'intentionally incomplete SYNTHETIC ADMISSION NEGATIVE; never native output'})
    args.native_root=out;args.batch=partial;args.batch_sha256=R.sha(partial.read_bytes())
    args.body_binding_sha256='0'*64;reject('partial wrong body rejected',lambda:R.receive(args))
    args.body_binding_sha256=R.BODY;args.ticks_sha256='0'*64;reject('partial wrong packet rejected',lambda:R.receive(args))
    args.ticks_sha256=R.TICKS;reject('partial native inventory rejected',lambda:R.receive(args));assert not args.out.exists()
    # Labelled synthetic camera matrix trajectories test utility math and paired
    # H units. There are no synthetic PNG/native identity/post-success outputs.
    yaw,elev=math.radians(60),math.radians(8)
    right=[math.cos(yaw),math.sin(yaw),0];up=[-math.sin(yaw)*math.sin(elev),math.cos(yaw)*math.sin(elev),math.cos(elev)]
    matrix_rows=[]
    for px in (80,144):
        height=1.8956;ppm=px/height;origin=[px*3,px*3.5];previous=origin[:];previous_h=0
        for row in packet['ticks']:
            h=row['rootForwardH'];absolute=[ppm*(-h*height*right[1]),-ppm*(-h*height*up[1])]
            root_point=[(origin[0]+absolute[0])*4,(origin[1]+absolute[1])*4,12]
            meta={'px':px,'ss':4,'height_m':height,'ppm':ppm,'cam':{'right':right,'up':up},'anchors':{'root':root_point,**{k:root_point[:] for k in R.ANCHORS.values()}}}
            mapped=R.mapping(meta,row,previous_h,[0,-1,0]);residual=R.validate_projected_increment(mapped['pivot'],previous,mapped['rootMotion'],px)
            assert max(abs(v) for v in residual)<1e-12
            matrix_rows.append({'height':px,'frame':row['frame'],'rootMotion':mapped['rootMotion']})
            bad=dict(meta,ss=0);reject(f'synthetic grid guard H{px} f{row["frame"]}',lambda:R.mapping(bad,row,previous_h,[0,-1,0]))
            if row['frame']==1:reject('native increment mismatch H'+str(px),lambda:R.validate_projected_increment([1,1],previous,[0,0],px))
            previous=mapped['pivot'];previous_h=h
    for f in range(1,78):
        a=matrix_rows[f-1]['rootMotion'];b=matrix_rows[77+f-1]['rootMotion']
        assert max(abs(a[i]/80-b[i]/144) for i in (0,1))<1e-12
    # REAL oldN1 native metadata and PNGs validate the dynamic-root-pivot utility
    # and unchanged9da pixel packing. They are explicitly not currentStage3 frames.
    old=Path('D:/Dex/Automation/reports/dex-suite-resumption-20260930/lanes/rosace-motion/proofs/profile-v1/run-2/original-build/authored-review-input.json')
    value=json.loads(old.read_text());render=Path('D:/Dex/Projects/dex-place-art/rosace/motion-ai/renders')
    source_meta={px:R.read(render/f'n1_r3c_integrated/px{px}/meta.json') for px in (80,144)}
    for variant in value['variants']:
        px=variant['height'];meta=source_meta[px];clip=variant['clips'][0]
        clip['id']='review_historical_pivot_utility';clip['tags']=['review-only','historical-pixel-utility']
        previous_h=0
        for index,frame in enumerate(clip['frames'],1):
            sample=int(Path(frame['image']).stem.split('_')[-1]);per=dict(meta,anchors=meta['anchors'][str(sample)])
            h=previous_h+frame['rootMotion'][0]/px
            mapped=R.mapping(per,{'rootForwardH':h},previous_h,[0,-1,0]);frame.update(mapped)
            previous_h=h
    value['provenance']={'fixtureRole':'REAL historicalN1 native pixels + dynamic root pivot utility ONLY; source-camera impulses are utility inputs, not nativeStage3 proof',
        'historicalInputSha256':R.sha(old.read_bytes()),'receiverUtilitySha256':R.sha(Path(R.__file__).read_bytes())}
    normalized=out/'historical-utility-input.json';write(normalized,value)
    script=out/'run_export.mjs'
    script.write_text("import {exportFrames} from "+json.dumps((repo/'art/rosace/specialists/motion/export/export_frames.mjs').as_uri())+";exportFrames({inputPath:"+json.dumps(str(normalized))+",sourceRoot:"+json.dumps(str(render))+",outputRoot:"+json.dumps(str(out/'historical-utility-packages'))+",mode:'review',python:'python'});\n")
    subprocess.run(['node',str(script)],check=True,cwd=repo)
    atlas=[]
    prior=Path('D:/Dex/Automation/reports/dex-suite-resumption-20260930/lanes/rosace-motion/proofs/export-v1/run-2/original-root-export')
    for directory in ('character','character-closeup'):
        produced=out/'historical-utility-packages'/directory
        assert not (produced/'manifest.json').exists()
        assert R.sha((produced/'body.png').read_bytes())==R.sha((prior/directory/'body.png').read_bytes())
        envelope=R.read(produced/'review-manifest.json');assert envelope['releaseEligible'] is False
        provenance=R.read(produced/'provenance.json')
        frames=envelope['package']['clips'][0]['frames'];variant=next(v for v in value['variants'] if v['height']==(80 if directory=='character' else 144))
        for index,frame in enumerate(frames):
            trim=next(r for r in provenance['frames'] if r['index']==index)['trim']
            pivot=variant['clips'][0]['frames'][index]['pivot']
            assert [frame['pivot'][i]+trim[i] for i in (0,1)]==pivot
            assert frame['duration']==1
        atlas.append({'directory':directory,'sha256':R.sha((produced/'body.png').read_bytes()),'actualHistoricalPixelBytesUnchanged':True,'dynamicPivotsReconstructed':33})
    proof={'status':'pass-bounded-utilities-and-admission-negatives','realHistoricalPixels':atlas,'syntheticCameraRows':154,
        'syntheticCameraPurpose':'projection math only; no finished/native batch fabricated','negativeCount':len(negatives),'negatives':negatives,
        'postTreeBoundary':boundary_proof,'rawChildBoundary':raw_boundary,'nativeExecuted':False,'completedStage3ReceiverPositive':False,'sourceBodyValidation':'actual frozenV2 source/body/packet guards pass on preparedbase+overlay',
        'limits':'genuine Stage3 native batch/post absent; full positive intake,cloth/currentmotion/appearance/World/release acceptance unproven'}
    write(out/'proof.json',proof);print(json.dumps({'proof':str(out/'proof.json'),'negativeCount':len(negatives),'completedStage3ReceiverPositive':False}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--source-root',required=True);a=p.parse_args();prove(a.out,a.source_root)
