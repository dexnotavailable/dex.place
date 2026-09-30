"""Pure contract guards; no Blender imports/process/build/render."""
import copy
import json
import importlib.util
import tempfile
from pathlib import Path
from unittest.mock import patch
import contract as C


def reject(call):
    try: call()
    except (AssertionError,ValueError): return
    raise AssertionError('mutated source contract accepted')


def lifecycle():
    allowed=C.REPO/'review/rosace/integration/source_baseline'; allowed.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='lifecycle-',dir=allowed) as folder:
        container=Path(folder); root=container/'fresh-output'; manifest=container/'binding.json'
        with patch.object(C,'MANIFEST',manifest):
            C.freeze(root)
            original=json.loads(manifest.read_text(encoding='utf-8'))
            before=C.verify(); assert not before['freshOutputExists']
            root.mkdir(); (root/'temp').mkdir()
            (root/'baseline-source.blend').write_bytes(b'CPU mock output, not Blender data')
            C.validate_plan(original['contract'])
            after=C.verify(); assert after['freshOutputExists'] and not after['existingOutputAcceptanceProven']
            reject(lambda:C.plan(root,parent=dict(C.os.environ)))
            reject(lambda:C.freeze(root))
            for kind in ('contract','source','input'):
                changed=copy.deepcopy(original)
                if kind=='contract': changed['contract']['selectedProvisionalRecipe']['initialBaseAoEnabled']=False
                else:
                    key='sourceSha256' if kind=='source' else 'inputSha256'
                    changed[key][next(iter(changed[key]))]='0'*64
                manifest.write_bytes((json.dumps(changed,ensure_ascii=False)+'\n').encode('utf-8'))
                reject(C.verify)
            manifest.write_bytes((json.dumps(original,ensure_ascii=False)+'\n').encode('utf-8'))
            C.verify()
    print(json.dumps({'status':'actual-source-verifier-lifecycle-pass','freshAdmissionRejectsOccupiedRoot':True,
                     'postPrecreateMockOutputVerifyPasses':True,'changedContractSourceInputReject':True,
                     'actualNativeOrBuildExecuted':False,'outputAcceptanceClaimed':False},indent=2))


def main():
    parent={'SYSTEMROOT':'C:\\Windows','ROSACE_HAIR':'f3','ROSACE_OUTFIT':'wrong','ROSACE_GLAIVE':'bad','ROSACE_CHAIN':'integrated',
            'rosace_hair':'lowercase','PYTHONPATH':'injected','BLENDER_SYSTEM_SCRIPTS':'elsewhere','BLENDER_USER_CONFIG':'DexProfile',
            'OPENAI_API_KEY':'synthetic-do-not-copy','HTTP_PROXY':'synthetic','PATH':'untrusted'}
    snapshot=copy.deepcopy(parent); env=C.child_environment(parent,C.PRIVATE)
    assert parent==snapshot and env is not parent
    assert not any(k in env for k in ('ROSACE_HAIR','ROSACE_OUTFIT','ROSACE_GLAIVE','ROSACE_CHAIN','PYTHONPATH','OPENAI_API_KEY','HTTP_PROXY'))
    assert not any(k.startswith('BLENDER_SYSTEM_') or k.startswith('BLENDER_USER_') for k in env)
    p=C.plan(parent=dict(C.os.environ)); C.validate_plan(p)
    assert '--no-ao' not in p['exactChildArgv'] and p['selectedProvisionalRecipe']['initialBaseAoEnabled']
    assert p['exactChildArgv']==C.argv(C.PRIVATE) and p['exactChildArgv'][2]=='run'
    assert 'bl_build.py' not in ' '.join(p['exactChildArgv'])
    spec=importlib.util.spec_from_file_location('source_contract_env_wrapper',C.REPO/'tools/pixel-pipeline/blender_env.py')
    wrapper=importlib.util.module_from_spec(spec); spec.loader.exec_module(wrapper)
    wrapper.BLENDER=str(C.BLENDER)
    assert wrapper.blender_cmd(p['exactChildArgv'][3:])==p['expectedNativeArgv']
    assert p['exactWrapperEnvironment']['DEXPLACE_BLENDER_ROOT'].startswith(str(C.PRIVATE))
    for path in p['builderExplicitFileWrites']+p['precreateWithinPrivateRoot']: C.contained(C.PRIVATE,path)
    for path in (C.PRIVATE.parent/'escaped.blend',C.PRIVATE/'..'/'escaped.blend',C.CACHE/'rosace.blend',C.BASES/'changed.blend',Path('C:/temp/unsafe.blend')):
        reject(lambda:C.contained(C.PRIVATE,path))
    for path in (C.CACHE,C.BASES,Path('C:/temp/fresh')): reject(lambda:C.destination(path))
    for mutation in ('noao','route','out','hair','profile','aochoice','history'):
        bad=copy.deepcopy(p)
        if mutation=='noao': bad['exactChildArgv'].append('--no-ao')
        elif mutation=='route': bad['exactChildArgv'][7]=str(C.REPO/'tools/pixel-pipeline/drive9/bl_build.py')
        elif mutation=='out': bad['exactChildArgv'][-1]=str(C.CACHE/'rosace.blend')
        elif mutation=='hair': bad['exactWrapperEnvironment']['ROSACE_HAIR']='f3'
        elif mutation=='profile': bad['exactWrapperEnvironment']['APPDATA']='C:/DexProfile'
        elif mutation=='aochoice': bad['selectedProvisionalRecipe']['initialBaseAoEnabled']=False
        else: bad['notHistoricalExactRebuildClaim']=False
        reject(lambda:C.validate_plan(bad))
    for path in C.HERE.glob('*.py'): compile(path.read_text(),str(path),'exec')
    print(json.dumps({'status':'pure-contract-guards-pass','parentEnvironmentUnchanged':True,
                     'envSanitizationArgIdentityWriteContainmentMutationRejections':True,
                     'nativeImportedOrExecuted':False,'actualBuildOrRender':False},indent=2))


if __name__=='__main__':
    import sys
    lifecycle() if sys.argv[1:]==['--lifecycle'] else main()
