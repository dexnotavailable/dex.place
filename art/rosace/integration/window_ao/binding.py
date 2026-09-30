"""Complete bounded source/input/CLI and genuine actual545 opening binding."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
BASE='54518211eb9a342bc5f6689562c5a0179d466a52'
PARENT_REPO=Path('D:/Dex/Temp/rosace-sharp-face-native-20260930')
PARENT=PARENT_REPO/'review/rosace/art/next/sharp-face-preservation-delivery'
PACKET=Path('D:/Dex/Automation/reports/dex-suite-resumption-20260930')
MANIFEST=HERE/'binding.json'
RAW=('beauty.png','depth.png','depth2.png','id.png','light.png','noise.png','normal.png',
     'meta.json','facepass.json','landmarks.json')
BLEND=Path('D:/Dex/Projects/dex-place-art/rosace/build/rosace.blend')
BUILD_RECEIPT=BLEND.with_name('rosace_build.json')


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


def contract():
    args=native_args('<FRESH_PRIVATE_OUTPUT>')
    args[args.index('--r2')+1]='<EXECUTING_REPO>/tools/pixel-pipeline/drive9/r2_model.json'
    return {'base':BASE,'parentMode':'actual545 reconstruction opening','nativeArgs':args,
            'rawPasses':list(RAW[:7]),'finish':'unchanged reconstruction_finish.finish_recipe over exact R2 base; no compositing',
            'bodyAo':{'distance':.075,'strength':.9,'rays':24,'originOffset':.0015},
            'newModes':['control','rebaked'],'newStills':4,'reuseParentControlAllowed':False}


def freeze():
    if subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()!=BASE:
        raise ValueError('freeze requires exact authorized base HEAD')
    if subprocess.check_output(['git','rev-parse','HEAD'],cwd=PARENT_REPO,text=True).strip()!=BASE:
        raise ValueError('actual545 parent source HEAD changed')
    data={'schemaVersion':1,'contract':contract(),'source':sources(),
          'inputs':{str(BLEND):sha(BLEND),str(BUILD_RECEIPT):sha(BUILD_RECEIPT)},'actual545Evidence':evidence(),
          'sourceOnly':True,'nativeQualification':'pending; manifest hashes are read-only evidence binding'}
    MANIFEST.write_text(json.dumps(data,indent=2),encoding='utf-8')
    return data


def verify_data(data,current_source,current_inputs,current_evidence):
    if data['contract']!=contract() or data['source']!=current_source or data['inputs']!=current_inputs or data['actual545Evidence']!=current_evidence:
        raise AssertionError('source/input/CLI/frozen actual545 binding mutation or set change')


def verify():
    data=json.loads(MANIFEST.read_text(encoding='utf-8'))
    verify_data(data,sources(),{str(BLEND):sha(BLEND),str(BUILD_RECEIPT):sha(BUILD_RECEIPT)},evidence())
    subprocess.run(['git','merge-base','--is-ancestor',BASE,'HEAD'],cwd=REPO,check=True)
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
    return {'bindingSha256':sha(MANIFEST),'executingHead':head,'authorizedBase':BASE,
            'sourceCount':len(data['source']),'actual545EvidenceCount':len(data['actual545Evidence']),
            'canonicalBlendSha256':data['inputs'][str(BLEND)],'contract':data['contract']}


if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('operation',choices=('freeze','verify'))
    args=p.parse_args()
    result=freeze() if args.operation=='freeze' else verify()
    print(json.dumps({k:v for k,v in result.items() if k not in ('source','inputs','actual545Evidence')},indent=2))
