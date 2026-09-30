"""Frozen R2 six-pass input plus separately proven failedbd control depth2."""
import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
ROOT=HERE
MANIFEST=ROOT/'inputs.json'
META_SOURCES=ROOT/'metadata-sources.json'
R2=Path('D:/Dex/Projects/dex-place-art/rosace/build/lanes/drive9/raw/R2')
FAILED=Path('D:/Dex/Temp/rosace-facecage1-native-20260930/review/rosace/specialists/refinement/facecage/stage2-delivery/control')
DIAGNOSTIC=Path('D:/Dex/Temp/rosace-fc1-normal-probe-native-20260930/review/rosace/integration/facecage_normals/native-20260930/diagnostic.json')
DIAGNOSTIC_SHA='df39907e0d9f8240cdc988653d2c9da667a78ab896f1f54d33a06ef32ae70e43'
PACKET=Path('D:/Dex/Automation/reports/dex-suite-resumption-20260930')
RAW6=('id.png','normal.png','depth.png','light.png','beauty.png','noise.png')
MODEL_RELATIVE='tools/pixel-pipeline/drive9/r2_model.json'
# This is the named historical INPUT reference stored byte-exact in574ecde6.
# Execution may use another exact-code checkout; it is checked separately.
HISTORICAL_MODEL_KEY=str(Path('D:/Dex/Temp/dex-place-rosace-facecage-support-20260930')/MODEL_RELATIVE)
HISTORICAL_MODEL_FILE=Path(HISTORICAL_MODEL_KEY)


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def collect():
    if sha(DIAGNOSTIC)!=DIAGNOSTIC_SHA: raise AssertionError('preserved418 actual diagnostic changed')
    inputs={}
    inputs['normalDiagnostic']={str(DIAGNOSTIC):DIAGNOSTIC_SHA}
    files=[FAILED/'_render.json',PACKET/'lanes/delivery/FC1-FROZEN-READY.json',PACKET/'lanes/delivery/rosace-facecage1/native-render.json']
    inputs['failedBdControlProvenance']={str(p):sha(p) for p in files}
    canonical=Path('D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend')
    inputs['canonicalAndModel']={str(canonical):sha(canonical),HISTORICAL_MODEL_KEY:sha(HISTORICAL_MODEL_FILE)}
    frozen={}; extra={}
    for shot in ('idle','back'):
        for px in (144,80):
            folder=R2/shot/f'px{px}'
            if (folder/'depth2.png').exists(): raise AssertionError('frozen R2 baseline unexpectedly gained depth2; no substitution')
            for name in (*RAW6,'meta.json','facepass.json','R2/still.png','R2/still_ground.png'):
                frozen[str(folder/name)]=sha(folder/name)
            for name in ('depth2.png','meta.json','facecage_trial.json'):
                p=FAILED/shot/f'px{px}'/name; extra[str(p)]=sha(p)
    inputs['frozenR2SixRawAndFinished']=frozen
    inputs['separateFailedBdDepth2AndMeta']=extra
    return inputs


def freeze():
    data={'schema':'fc1.support-inputs/1','sourceBase':'bd94059a13d5becd68b80c0d219fdb6ad1d989f9',
          'inputs':collect(),'depth2Provenance':'actual failed FC1 bd94059 control, not invented as frozen R2 seventh pass',
          'actualSupportPlanesQualified':False,'nativeNewCandidateExists':False}
    ROOT.mkdir(parents=True,exist_ok=True)
    MANIFEST.write_bytes((json.dumps(data,indent=2)+'\n').encode('utf-8'))
    return data


def metadata_sources():
    fixed={}; executing={}
    for base in (R2,FAILED):
        for shot in ('idle','back'):
            for px in (144,80):
                meta=json.loads((base/shot/f'px{px}/meta.json').read_text())
                for value in (meta['pose_file'],meta['d9']['r2']):
                    path=Path(value).resolve(); raw=path.read_bytes()
                    fixed[str(path)]={'filename':path.name,'rawSha256':hashlib.sha256(raw).hexdigest(),
                        'canonicalLfSha256':hashlib.sha256(raw.replace(b'\r\n',b'\n')).hexdigest()}
                pose=Path(meta['pose_file']).name
                for relative in (f'art/rosace/poses/{pose}','tools/pixel-pipeline/drive9/r2_model.json'):
                    path=REPO/relative; raw=path.read_bytes()
                    executing[relative]={'filename':path.name,'rawSha256':hashlib.sha256(raw).hexdigest(),
                        'canonicalLfSha256':hashlib.sha256(raw.replace(b'\r\n',b'\n')).hexdigest()}
    return {'frozenReferencedSources':fixed,'executingReferencedSources':executing,
            'equivalence':'ONLY CRLF->LF; retain raw SHA256 and verify pose_sha1 against its own raw bytes; no other normalization'}


def freeze_metadata_sources():
    data=metadata_sources()
    META_SOURCES.write_bytes((json.dumps(data,indent=2)+'\n').encode('utf-8'))
    return {'metadataSourceBindingSha256':sha(META_SOURCES)}


def verify():
    data=json.loads(MANIFEST.read_text())
    if data.get('sourceBase')!='bd94059a13d5becd68b80c0d219fdb6ad1d989f9' or data.get('inputs')!=collect():
        raise AssertionError('frozen R2/failedbd depth2/probe/canonical input mutation or omission')
    if json.loads(META_SOURCES.read_text())!=metadata_sources():
        raise AssertionError('actual referenced metadata source file/raw SHA or LF-only equivalence changed')
    actual_model_sha=sha(REPO/MODEL_RELATIVE)
    historical_model_sha=data['inputs']['canonicalAndModel'][HISTORICAL_MODEL_KEY]
    if actual_model_sha!=historical_model_sha:
        raise AssertionError('actual executing model differs from exact frozen historical model SHA')
    return {'inputBindingSha256':sha(MANIFEST),'depth2Provenance':data['depth2Provenance'],
            'metadataSourceBindingSha256':sha(META_SOURCES),'executionModelSha256':actual_model_sha,
            'historicalModelReference':HISTORICAL_MODEL_KEY}


if __name__=='__main__':
    import sys
    result=(freeze() if sys.argv[1:]==['freeze-inputs'] else freeze_metadata_sources() if sys.argv[1:]==['freeze-metadata-sources']
            else verify() if sys.argv[1:]==['verify-inputs'] else None)
    if result is None: raise ValueError('explicit freeze-inputs/verify-inputs operation')
    print(json.dumps({k:v for k,v in result.items() if k!='inputs'},indent=2))
