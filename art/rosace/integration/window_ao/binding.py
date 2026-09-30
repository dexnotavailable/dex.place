"""Complete bounded source/input/CLI and genuine actual545 opening binding."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
BASE='54518211eb9a342bc5f6689562c5a0179d466a52'
SOURCE_BASE='1295062e2454c85d584751ba58448a1b18bef34c'
PARENT_REPO=Path('D:/Dex/Temp/rosace-sharp-face-native-20260930')
PARENT=PARENT_REPO/'review/rosace/art/next/sharp-face-preservation-delivery'
PACKET=Path('D:/Dex/Automation/reports/dex-suite-resumption-20260930')
MANIFEST=HERE/'binding.json'
RAW=('beauty.png','depth.png','depth2.png','id.png','light.png','noise.png','normal.png',
     'meta.json','facepass.json','landmarks.json')
BLEND=Path('D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend')
BUILD_RECEIPT=BLEND.with_name('rosace_build.json')
PNG_FINDING=PACKET/'source-findings/rosace-cuff2-parent-decoded-replay-20260930.json'
PNG_FINDING_SHA='313c299a9fc8b266fd36e8edf2c2773475613001ee66fb1b27f4a67e05c800a2'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def native_args(output):
    return ['--reconstruction-mode','reconstruction','--hand-scale','1.3','--shots','idle',
            '--blend',str(BLEND),'--r2',str(REPO/'tools/pixel-pipeline/drive9/r2_model.json'),
            '--head','1.10','--ss','4','--px','144,80','--out',str(output)]


def sources():
    # Superset closes dynamic Python imports/data loads in existing renderer/finish.
    files=set()
    for root in ('tools/pixel-pipeline','tools/art-construct'):
        files.update(p for p in (REPO/root).rglob('*') if p.is_file() and p.suffix in ('.py','.json'))
    files.update(p for p in (REPO/'art/rosace').rglob('*.json') if 'integration' not in p.parts)
    files.update(p for p in HERE.iterdir() if p.suffix=='.py')
    return {p.relative_to(REPO).as_posix():sha(p) for p in sorted(files)}


def evidence():
    files=[PARENT/'PREVIEW.json',PARENT/'reconstruction-native-proof.json',
           PARENT/'reconstruction-faces.json',
           PARENT/'reconstruction-raw/mesh-preservation/retained-face-preservation.json',
           PACKET/'lanes/delivery/rosace-sharp-face/native-render.json',
           PACKET/'lanes/rosace/STAGE2-WINDOW-LIGHT-DIAGNOSTIC.json']
    for px in (80,144):
        raw=PARENT/f'reconstruction-raw/idle/px{px}'
        files.extend(raw/name for name in RAW)
        files.extend(raw/name for name in ('reconstruction.json','window_geometry.json','haft_grips.json','R2/still.png','R2/still_ground.png'))
    return {str(p.resolve()):sha(p) for p in files}


def supporting_evidence():
    actual=sha(PNG_FINDING)
    if actual!=PNG_FINDING_SHA:
        raise AssertionError('actual PNG decoded-replay supporting finding changed')
    return {str(PNG_FINDING.resolve()):actual}


def contract():
    args=native_args('<FRESH_PRIVATE_OUTPUT>')
    args[args.index('--r2')+1]='<EXECUTING_REPO>/tools/pixel-pipeline/drive9/r2_model.json'
    return {'base':BASE,'entryRepairSourceBase':SOURCE_BASE,'parentMode':'actual545 reconstruction opening','nativeArgs':args,
            'rawPasses':list(RAW[:7]),'finish':'unchanged reconstruction_finish.finish_recipe over exact R2 base; no compositing',
            'rawPngComparison':'validated8bit RGBA IHDR/dimensions/native decoded sample bytes exact; original file SHA retained as provenance, no tolerance or mode/depth conversion',
            'bodyAo':{'distance':.075,'strength':.9,'rays':24,'originOffset':.0015},
            'newModes':['control','rebaked'],'newStills':4,'reuseParentControlAllowed':False}


def authorize_source_head(expected,actual,geometry_ancestor,entry_ancestor):
    if not isinstance(expected,str) or re.fullmatch('[0-9a-f]{40}',expected) is None:
        raise ValueError('explicit full lowercase expected source HEAD is required')
    if actual!=expected or not geometry_ancestor or not entry_ancestor:
        raise ValueError('source admission requires exact expected HEAD descending from frozen545 and authorized129')


def admission(expected_source_head):
    actual=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
    ancestors=[subprocess.run(['git','merge-base','--is-ancestor',ancestor,'HEAD'],cwd=REPO,check=False).returncode==0
               for ancestor in (BASE,SOURCE_BASE)]
    authorize_source_head(expected_source_head,actual,*ancestors)
    return {'sourceBase':SOURCE_BASE,'sourceHead':expected_source_head,'geometryParent':BASE}


def authorize_runtime_head(source_head,actual,geometry_ancestor,entry_ancestor,source_ancestor,fingerprint_equal):
    if any(not isinstance(value,str) or re.fullmatch('[0-9a-f]{40}',value) is None for value in (source_head,actual)):
        raise ValueError('full bounded source and actual executing HEADs are required')
    if not all((geometry_ancestor,entry_ancestor,source_ancestor,fingerprint_equal)):
        raise ValueError('runtime source HEAD must be an ancestor and complete source fingerprints must remain exact')


def runtime_admission(source_head,fingerprint_equal):
    actual=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
    ancestors=[subprocess.run(['git','merge-base','--is-ancestor',ancestor,'HEAD'],cwd=REPO,check=False).returncode==0
               for ancestor in (BASE,SOURCE_BASE,source_head)]
    authorize_runtime_head(source_head,actual,*ancestors,fingerprint_equal)
    return {'sourceBase':SOURCE_BASE,'sourceHead':source_head,'geometryParent':BASE,
            'executingHead':actual,'sourceFingerprintExact':True,
            'finalHeadAdmission':'external ROOT READY/delivery exact executing HEAD remains mandatory'}


def freeze(expected_source_head):
    source_admission=admission(expected_source_head)
    if subprocess.check_output(['git','rev-parse','HEAD'],cwd=PARENT_REPO,text=True).strip()!=BASE:
        raise ValueError('actual545 parent source HEAD changed')
    data={'schemaVersion':2,'sourceAdmission':source_admission,'contract':contract(),'source':sources(),
          'inputs':{str(BLEND):sha(BLEND),str(BUILD_RECEIPT):sha(BUILD_RECEIPT)},'actual545Evidence':evidence(),
          'supportingEvidence':supporting_evidence(),
          'sourceOnly':True,'nativeQualification':'pending; manifest hashes are read-only evidence binding'}
    # Explicit bytes keep LF stable across Windows writes/fresh Git checkouts.
    MANIFEST.write_bytes((json.dumps(data,indent=2)+'\n').encode('utf-8'))
    return data


def verify_data(data,current_source,current_inputs,current_evidence,current_supporting):
    source_admission=data.get('sourceAdmission',{})
    if source_admission.get('sourceBase')!=SOURCE_BASE or source_admission.get('geometryParent')!=BASE or re.fullmatch('[0-9a-f]{40}',str(source_admission.get('sourceHead',''))) is None:
        raise AssertionError('exact authorized source admission missing or changed')
    if data['contract']!=contract() or data['source']!=current_source or data['inputs']!=current_inputs or data['actual545Evidence']!=current_evidence or data.get('supportingEvidence')!=current_supporting:
        raise AssertionError('source/input/CLI/frozen actual545 binding mutation or set change')
    return True


def verify():
    data=json.loads(MANIFEST.read_text(encoding='utf-8'))
    fingerprint_equal=verify_data(data,sources(),{str(BLEND):sha(BLEND),str(BUILD_RECEIPT):sha(BUILD_RECEIPT)},evidence(),supporting_evidence())
    source_admission=runtime_admission(data['sourceAdmission']['sourceHead'],fingerprint_equal)
    head=source_admission['executingHead']
    return {'bindingSha256':sha(MANIFEST),'executingHead':head,'authorizedBase':BASE,
            'sourceCount':len(data['source']),'actual545EvidenceCount':len(data['actual545Evidence']),
            'canonicalBlendSha256':data['inputs'][str(BLEND)],'sourceAdmission':source_admission,'contract':data['contract']}


if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('operation',choices=('freeze','verify','check-admission'))
    p.add_argument('--expected-source-head')
    args=p.parse_args()
    if args.operation in ('freeze','check-admission') and args.expected_source_head is None:
        p.error('--expected-source-head is required for explicit source admission')
    result=(freeze(args.expected_source_head) if args.operation=='freeze' else
            admission(args.expected_source_head) if args.operation=='check-admission' else verify())
    print(json.dumps({k:v for k,v in result.items() if k not in ('source','inputs','actual545Evidence')},indent=2))
