"""Source-only fresh baseline command/environment/input contract; never launches."""
import copy
import hashlib
import json
import os
import subprocess
from pathlib import Path

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
BASE='54518211eb9a342bc5f6689562c5a0179d466a52'
INTAKE=Path('D:/Dex/Automation/reports/dex-suite-resumption-20260930/source-findings/character-fresh-baseline-recipe-intake-20260930.md')
BASES=Path('D:/Dex/Projects/dex-place-art/rosace/bases')
CACHE=Path('D:/Dex/Projects/dex-place-art/rosace/build')
PRIVATE=REPO/'review/rosace/integration/source_baseline/fresh-diagnostic-20260930'
PYTHON=Path('C:/Users/sanic/AppData/Local/Programs/Python/Python313/python.exe')
BLENDER=Path('C:/Program Files/Blender Foundation/Blender 5.1/blender.exe')
PINNED={
    CACHE/'rosace.blend':'aef28c7f5cdddee6f18bd12c06d988b5436eeac24049ddf4f6ca37f654394373',
    CACHE/'rosace_build.json':'4530f21971c885d31b9096f33f5ef6b1deac6095543a4d15fb268163e5fe56e7',
    BASES/'siroino/SiroinoSotai_1.0/SiroinoSotai.blend':'d5bc3c6031d0f095c6ae509b19a71c3e2b33f3f9f1f43fbc4dc5b1132d7dd677',
    BASES/'primero/MMD用女性素体/mmdBodyWoman.blend':'ff62d62fa0e30c2dfc805136cb1b6f942416722c76e325ae3b8ca71073f3609e'}
MANIFEST=HERE/'binding.json'
REMOVE=('ROSACE_OUTFIT','ROSACE_GLAIVE','ROSACE_HAIR','ROSACE_CHAIN')


def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for part in iter(lambda:f.read(1024*1024),b''): h.update(part)
    return h.hexdigest()


def contained(root,path):
    root,path=Path(root).resolve(),Path(path).resolve()
    if path==root or root not in path.parents:
        raise ValueError('write target escapes strict fresh private root')
    return path


def destination(path,require_absent=True):
    path=Path(path).resolve(); allowed=(REPO/'review/rosace/integration/source_baseline').resolve()
    if path.drive.lower()!='d:' or allowed not in path.parents:
        raise ValueError('bound D private baseline diagnostic root required')
    if require_absent and path.exists():
        raise ValueError('fresh admission requires a non-existing diagnostic root')
    return path


def child_environment(parent,root):
    """From scratch; no inherited secrets/ROSACE/Python/Blender/proxy injection."""
    before=copy.deepcopy(parent); root=Path(root).resolve()
    system=parent.get('SYSTEMROOT',parent.get('SystemRoot','C:\\Windows'))
    env={'SYSTEMROOT':system,'WINDIR':system,'COMSPEC':str(Path(system)/'System32/cmd.exe'),
         'SYSTEMDRIVE':Path(system).drive,'PATHEXT':'.COM;.EXE;.BAT;.CMD',
         'PATH':os.pathsep.join(map(str,(PYTHON.parent,BLENDER.parent,Path(system)/'System32',Path(system)))),
         'TEMP':str(root/'temp'),'TMP':str(root/'temp'),
         'USERPROFILE':str(root/'profile'),'HOME':str(root/'profile'),
         'APPDATA':str(root/'profile/AppData/Roaming'),'LOCALAPPDATA':str(root/'profile/AppData/Local'),
         'PYTHONDONTWRITEBYTECODE':'1','PYTHONNOUSERSITE':'1','PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8',
         'ROSACE_BASES':str(BASES),'ROSACE_BUILD':str(root),
         'DEXPLACE_BLENDER_EXE':str(BLENDER),'DEXPLACE_BLENDER_ROOT':str(root/'blender-user'),
         'DEXPLACE_DOWNLOADS':str(root/'downloads')}
    if parent!=before: raise AssertionError('parent environment mutated')
    return env


def argv(root):
    return [str(PYTHON),str(REPO/'tools/pixel-pipeline/blender_env.py'),'run','--factory-startup',
            '--python-exit-code','1','--python',str(REPO/'tools/pixel-pipeline/build_rosace_v2.py'),
            '--','--chain','drive9','--out',str(Path(root)/'baseline-source.blend')]


def plan(root=PRIVATE,parent=None,require_fresh=True):
    root=destination(root,require_absent=require_fresh); env=child_environment({} if parent is None else parent,root)
    directories=[root/'temp',root/'profile',root/'profile/AppData/Roaming',root/'profile/AppData/Local',root/'downloads',root/'blender-user']
    directories += [root/'blender-user'/sub for sub in ('config','scripts','extensions','datafiles','extensions/user_default')]
    for path in directories: contained(root,path)
    native_env=dict(env,BLENDER_USER_RESOURCES=str(root/'blender-user'))
    native_env.update({name:str(root/'blender-user'/sub) for name,sub in (
        ('BLENDER_USER_CONFIG','config'),('BLENDER_USER_SCRIPTS','scripts'),('BLENDER_USER_EXTENSIONS','extensions'),('BLENDER_USER_DATAFILES','datafiles'))})
    outputs=[root/'baseline-source.blend',root/'baseline-source_build.json']
    for path in outputs: contained(root,path)
    recipe=json.loads((CACHE/'rosace_build.json').read_text(encoding='utf-8'))
    return {'schema':'rosace.source-baseline-contract/1','id':'rosace-direct-drive9-fresh-source-baseline-20260930',
        'status':'source-contract-only-pending-review/native-diagnostic','sourceBase':BASE,
        'privateRoot':str(root),'exactChildArgv':argv(root),'shell':False,'cwd':str(REPO),
        'expectedNativeArgv':[str(BLENDER),'-b','--offline-mode','--disable-autoexec',*argv(root)[3:]],
        'exactWrapperEnvironment':env,'expectedInitialBlenderEnvironment':native_env,
        'precreateWithinPrivateRoot':list(map(str,directories)),
        'builderExplicitFileWrites':list(map(str,outputs)),'otherAllowedProcessWriteRoots':list(map(str,directories)),
        'parentEnvironmentMutationAllowed':False,'removedInheritedOverrides':list(REMOVE),
        'environmentPolicy':'complete child mapping from safe fixed essentials; no arbitrary parent values copied; wrapper strips BLENDER_SYSTEM/USER overrides then precreates its private resources',
        'selectedProvisionalRecipe':{'chain':'drive9','F3':'L by default promotion, not lane wrapper','outfit':'R2Q','glaive':'l5',
            'resultingHair':'f3 via F3.install, no initial ROSACE_HAIR override','bust':'S7','initialBaseAoEnabled':True,
            'forbiddenBuildFlags':['--no-ao','--no-glaive','--bare','--keys','--pinch','--leg-stretch','--torso-k'],
            'expectedChildOnlyBuilderEnvMutations':{'ROSACE_HAIR':'f3','ROSACE_OUTFIT':'R2Q','ROSACE_GLAIVE':'l5'}},
        'recordedCacheReceiptFacts':{'chain':recipe['chain'],'integrated':recipe['integrated'],'bodyKeys':recipe['body_keys'],
            'legStretch':recipe['leg_stretch'],'waistPinch':recipe['waist_pinch'],'assemblyHeight':recipe['rosace_height']},
        'historicalUnknown':['original argv','original full environment','original whole-model/base AO flag','original executable/runtime version','original build source hashes'],
        'notHistoricalExactRebuildClaim':True,'newExplicitAoChoiceDoesNotInferOldAo':True,
        'downstreamOnly':['head1.10','p5 pose/drape','r2_model render-time mesh/circlet/pin/pose edits','unchanged R2 finish'],
        'forbiddenRoutes':['drive9/bl_build.py','overwriting cached canonical/backups','feeding newSHA to old H.EXPECTED_BLEND guard','silent fresh-for-aef substitution'],
        'expectedFreshBinaryShaRelation':'different, separately identified; byte difference is expected and not by itself an art/structural mismatch or promotion',
        'nativeStillUnverified':['actual observed Blender/Python/NumPy/tool-package versions','unobserved OS/DLL/driver activity, neither absent claim nor blanket tracing prerequisite',
            'relevant external resources when observed, with path/hash/context','actual private project outputs/logs/owned cleanup and protected before-after hashes/file sets',
            'actual fresh build/schema/hash/receipt','native structural/render comparison'],
        'nativeExecutionAllowedHere':False,'defaultPromotionAllowed':False,'art9OrPipelineComplete':False}


def validate_plan(value):
    expected=plan(value['privateRoot'],dict(os.environ),require_fresh=False)
    if value!=expected: raise AssertionError('frozen command/env/write/recipe contract changed')
    if any(key.upper() in REMOVE or key.upper().startswith(('BLENDER_SYSTEM_','BLENDER_USER_')) for key in value['exactWrapperEnvironment']):
        raise AssertionError('build-affecting inherited override survived')


def source_files():
    files=set()
    for folder in ('tools/pixel-pipeline','tools/art-construct'):
        files.update(p for p in (REPO/folder).rglob('*') if p.is_file() and p.suffix in ('.py','.json'))
    files.update(p for p in (REPO/'art/rosace').rglob('*.json') if 'source_baseline' not in p.parts)
    files.update(HERE.glob('*.py'))
    files.update(HERE/name for name in ('audit.json','native-request.json'))
    return {p.relative_to(REPO).as_posix():sha(p) for p in sorted(files)}


def input_files():
    for path,expected in PINNED.items():
        if sha(path)!=expected: raise AssertionError('verified intake input changed: '+str(path))
    files=set(PINNED)|{INTAKE,PYTHON,BLENDER}
    for source in ('siroino','primero'):
        files.update(p for p in (BASES/source).rglob('*') if p.is_file())
    files.update(p for p in CACHE.glob('rosace*.blend') if p.is_file())
    files.update(p for p in (CACHE/'lanes/drive9/raw/R2').rglob('*') if p.is_file())
    return {str(p.resolve()):sha(p) for p in sorted(files)}


def freeze(root=PRIVATE):
    if subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()!=BASE:
        raise ValueError('source contract freeze requires explicit545 base before root checkpoint')
    p=plan(root,parent=dict(os.environ)); validate_plan(p)
    data={'schema':'rosace.source-baseline-binding/1','contract':p,'sourceSha256':source_files(),'inputSha256':input_files(),
          'bindingRole':'source/input/tool/child-environment/write declaration only, no native execution evidence'}
    MANIFEST.write_bytes((json.dumps(data,indent=2,ensure_ascii=False)+'\n').encode('utf-8'))
    MANIFEST.with_name('contract.json').write_bytes((json.dumps(p,indent=2,ensure_ascii=False)+'\n').encode('utf-8'))
    return data


def verify():
    data=json.loads(MANIFEST.read_text(encoding='utf-8')); validate_plan(data['contract'])
    if json.loads(MANIFEST.with_name('contract.json').read_text(encoding='utf-8'))!=data['contract']:
        raise AssertionError('standalone contract/command differs from bound contract')
    if data['sourceSha256']!=source_files() or data['inputSha256']!=input_files():
        raise AssertionError('complete frozen source/input/tool/intake file set or SHA changed')
    return {'bindingSha256':sha(MANIFEST),'sourceFileCount':len(data['sourceSha256']),'inputFileCount':len(data['inputSha256']),
            'actualNativeExecuted':False,'freshOutputExists':Path(data['contract']['privateRoot']).exists(),
            'existingOutputAcceptanceProven':False}


if __name__=='__main__':
    import sys
    result=freeze() if sys.argv[1:]==['freeze'] else verify() if sys.argv[1:]==['verify'] else None
    if result is None: raise ValueError('explicit source-only freeze/verify')
    print(json.dumps({k:v for k,v in result.items() if k not in ('sourceSha256','inputSha256','contract')},indent=2))
