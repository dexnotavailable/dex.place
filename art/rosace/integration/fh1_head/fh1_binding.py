"""Reviewed source/evidence binding; ROOT admits exact final executing HEAD."""
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
BASE = 'bd94059a13d5becd68b80c0d219fdb6ad1d989f9'
MANIFEST = HERE / 'binding.json'
EVIDENCE = HERE / 'evidence.json'


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def git(*argv): return subprocess.check_output(['git', '-C', str(REPO), *argv], text=True).strip()


def sources():
    paths = {p for p in (REPO/'tools/pixel-pipeline').rglob('*') if p.is_file() and p.suffix in ('.py','.json') and '__pycache__' not in p.parts}
    paths.update(p for p in (REPO/'art/rosace').rglob('*.json') if p.is_file() and 'integration' not in p.relative_to(REPO/'art/rosace').parts)
    paths.update(p for p in HERE.iterdir() if p.is_file() and p.suffix in ('.py','.json') and p.name not in ('binding.json','source-checks.json'))
    # d9_post lazily imports wh2_px from this bounded shared finish subtree.
    paths.update(p for p in (REPO/'tools/art-construct').rglob('*') if p.is_file() and p.suffix in ('.py','.json') and '__pycache__' not in p.parts)
    paths.update((REPO/'docs/character/FH1-AUTHORED-ENCODING.md', HERE/'.gitattributes'))
    return {p.relative_to(REPO).as_posix(): sha(p) for p in sorted(paths)}


def evidence():
    data = json.loads(EVIDENCE.read_text(encoding='utf-8'))
    for name, row in data['files'].items():
        if sha(Path(row['path'])) != row['sha256']: raise AssertionError('actual accepted FH1 supporting evidence drift: ' + name)
    return data


def freeze(expected_source_head):
    head = git('rev-parse','HEAD')
    if head != expected_source_head: raise AssertionError('freeze requires exact reviewed live runtime source HEAD')
    subprocess.check_call(['git','-C',str(REPO),'merge-base','--is-ancestor',BASE,head])
    result = {'schema':'fh1.source-evidence-binding/1','sourceBase':BASE,'sourceHead':head,'sources':sources(),'evidence':evidence(),
              'admission':'reviewed runtime head remains ancestor; full source fingerprints exact; ROOT external READY MUST bind exact executing finalHEAD; no tracked commit-hash self-reference'}
    MANIFEST.write_bytes((json.dumps(result,indent=2)+'\n').encode('utf-8'))
    return verify()


def verify():
    data = json.loads(MANIFEST.read_text(encoding='utf-8')); head = git('rev-parse','HEAD')
    if data.get('sourceBase') != BASE: raise AssertionError('FH1 frozen source base differs')
    for ancestor in (BASE,data['sourceHead']):
        subprocess.check_call(['git','-C',str(REPO),'merge-base','--is-ancestor',ancestor,head])
    if data['sources'] != sources() or data['evidence'] != evidence():
        raise AssertionError('FH1 source/evidence drift or source inventory omission')
    return {'sourceBindingSha256':sha(MANIFEST),'reviewedSourceHead':data['sourceHead'],'actualExecutingHead':head,'sourceCount':len(data['sources']),'supportingEvidenceCount':len(data['evidence']['files'])}


if __name__ == '__main__':
    import argparse
    parser=argparse.ArgumentParser(); parser.add_argument('operation',choices=('freeze','verify')); parser.add_argument('--expected-source-head')
    args=parser.parse_args()
    print(json.dumps(freeze(args.expected_source_head) if args.operation=='freeze' else verify(),indent=2))
