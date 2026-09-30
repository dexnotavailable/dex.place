"""Immutable5965 failure corpus plus unchanged946-source admission."""
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
BASE = '5965e24337551120ad5c7a0f87dff1aa726a6ce4'
PACKET = Path('D:/Dex/Automation/reports/dex-suite-resumption-20260930')
DELIVERY = PACKET / 'lanes/delivery/rosace-window-ao-entry-5965'
RECEIPT = DELIVERY / 'WINDOW-AO-ENTRY-DELIVERY.json'
RECEIPT_SHA = '9fa791e9711b38aa06a767265d3b38e0bb8bc7ad411c8706fa924ed63fdd1cfb'
MANIFEST = HERE / 'inputs.json'
FROZEN = PACKET / 'lanes/delivery/WINDOW-AO-ENTRY-FROZEN.json'
READY = PACKET / 'lanes/rosace/STAGE2-WINDOW-AO-ENTRY-READY.json'
CALCULATION = ('wrapper.py', 'native.py', 'rest_geometry.py', 'geometry.py', 'binding.py')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def collect(old_binding):
    if sha(RECEIPT) != RECEIPT_SHA:
        raise AssertionError('immutable actual5965 failed native receipt changed')
    receipt = json.loads(RECEIPT.read_text())
    if receipt['head'] != BASE or len(receipt['collectedFiles']) != 31 or len(receipt['outputFiles']) != 31:
        raise AssertionError('exact5965 failure and all31 retained output files required')
    outputs = {}
    for row in receipt['collectedFiles']:
        for name in ('source', 'collected'):
            path = Path(row[name])
            actual = sha(path)
            if actual != row['sha256']:
                raise AssertionError('immutable failed native output changed: ' + str(path))
            outputs[str(path)] = actual
    logs = {str(p): sha(p) for p in sorted(DELIVERY.iterdir()) if p.is_file()}
    if len(logs) != 19:
        raise AssertionError('exact19 original command receipt/stdout/stderr/failure receipt files required')
    data = json.loads(old_binding.MANIFEST.read_text())
    if len(data['source']) != 946 or len(data['inputs']) != 2:
        raise AssertionError('old complete946 source and canonical/S7 input binding required')
    return {'actualFailureReceiptSha256': RECEIPT_SHA, 'originalFailureLogs': logs,
            'all31OriginalAndCollectedFailureFiles': outputs,
            'originalFailureSourceFileCount': 31, 'originalFailureCollectedFileCount': 31,
            'originalSourceBinding': {'path': 'art/rosace/integration/window_ao/binding.json',
                                     'sha256': sha(old_binding.MANIFEST), 'sourceCount': 946,
                                     'canonicalAndS7Inputs': data['inputs']},
            'oldCalculationSourcePins': {name: sha(old_binding.HERE / name) for name in CALCULATION},
            'frozenNativeInputsAndReady': {str(FROZEN): sha(FROZEN), str(READY): sha(READY)}}


def freeze(old_binding):
    provenance = old_binding.verify()
    if provenance['sourceCount'] != 946:
        raise AssertionError('new probe namespace changed original runtime source footprint')
    data = {'schema': 'window-ao-key-state-probe-inputs/1', 'base': BASE, 'inputs': collect(old_binding),
            'nativeExecutedBySource': False, 'parentFailureCauseObjectKnown': False,
            'originalGuardRelaxed': False, 'renderedImages': 0}
    if MANIFEST.exists():
        raise ValueError('never overwrite key-state probe input binding')
    MANIFEST.write_bytes((json.dumps(data, indent=2) + '\n').encode())
    return provenance


def verify(old_binding):
    data = json.loads(MANIFEST.read_text())
    if data.get('base') != BASE or data.get('inputs') != collect(old_binding):
        raise AssertionError('key-state failure/log/native-input/source binding mutation or omission')
    if subprocess.run(['git', 'merge-base', '--is-ancestor', BASE, 'HEAD'], cwd=REPO, check=False).returncode:
        raise AssertionError('probe executing checkout must descend from exact5965')
    provenance = old_binding.verify()  # actual unchanged946-source/canonical/S7 contract
    if provenance['sourceCount'] != 946:
        raise AssertionError('original runtime source footprint changed')
    return {'probeInputBindingSha256': sha(MANIFEST), 'actualFailureReceiptSha256': RECEIPT_SHA,
            'originalFailureFiles': 31, 'oldRuntime': provenance,
            'newProbeCodeAdmission': 'ROOT exact-source READY independently pins this new namespace'}
