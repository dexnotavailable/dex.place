"""Source/evidence drift and ancestor controlflow fixtures; no commits."""
import copy
import json
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import patch
import fh1_binding as B


def reject(call):
    try: call()
    except (AssertionError,subprocess.CalledProcessError): return
    raise AssertionError('binding drift admitted')


def main():
    source={'selected.py':'reviewed'}; proof={'files':{'witness':{'path':'fixed','sha256':'accepted'}}}; data={'sourceBase':B.BASE,'sourceHead':'runtime','sources':source,'evidence':proof}
    with tempfile.TemporaryDirectory(dir=B.HERE,prefix='binding-fixture-') as folder:
        manifest=Path(folder)/'binding.json'; manifest.write_text(json.dumps(data),encoding='utf-8')
        with patch.object(B,'MANIFEST',manifest),patch.object(B,'sources',return_value=copy.deepcopy(source)) as collect,patch.object(B,'evidence',return_value=proof),patch.object(B,'git',return_value='metadata-descendant'),patch.object(B.subprocess,'check_call') as ancestor:
            result=B.verify(); assert result['actualExecutingHead']=='metadata-descendant'; assert ancestor.call_count==2
            collect.return_value={'selected.py':'changed'}; reject(B.verify); collect.return_value=source
            ancestor.side_effect=subprocess.CalledProcessError(1,['git','merge-base']); reject(B.verify)
            ancestor.side_effect=None
            with patch.object(B,'git',return_value='wrongLiveHead'): reject(lambda:B.freeze('reviewedExactHead'))
    # Actual current source inventory catches own runtime files, request and
    # original-field equivalence; no real input or source mutation is made.
    actual=B.sources()
    for name in ('fh1_trial.py','fh1_native.py','fh1_preserve.py','fh1_boundary.py','fh1_field.py','native-request.json','evidence.json','.gitattributes'):
        assert ('art/rosace/integration/fh1_head/'+name) in actual
    old=B.REPO/'art/rosace/specialists/refinement/facecage/facecage_geometry.py'
    new=B.HERE/'fh1_field.py'
    assert old.read_bytes().replace(b'\r\n',b'\n')==new.read_bytes()
    print(json.dumps({'cases':6,'metadataOnlyDescendantSameSourcePass':True,'sourceDriftReject':True,'noAncestorReject':True,'freezeWrongLiveHeadReject':True,'actualSourceInventoryCount':len(actual),'originalFieldCanonicalLfExact':True,'noCommitsMade':True,'nativeExecuted':False}))


if __name__=='__main__': main()
