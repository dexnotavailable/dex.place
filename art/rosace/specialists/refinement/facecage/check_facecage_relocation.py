"""Actual collect/verify under an isolated executing-code root; no inputs edit."""
import json
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch
import facecage_inputs as I


def rejects(call):
    try: call()
    except AssertionError: return
    raise AssertionError('changed relocation input admitted')


def main():
    expected=I.collect(); manifest_sha=I.sha(I.MANIFEST); meta_sha=I.sha(I.META_SOURCES)
    with tempfile.TemporaryDirectory(prefix='executing-root-',dir=I.HERE) as folder:
        root=Path(folder); target=root/'art/rosace/integration/facecage_support'; target.mkdir(parents=True)
        shutil.copyfile(I.MANIFEST,target/'inputs.json'); shutil.copyfile(I.META_SOURCES,target/'metadata-sources.json')
        for name in I.metadata_sources()['executingReferencedSources']:
            path=root/name; path.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(I.REPO/name,path)
        with patch.object(I,'REPO',root),patch.object(I,'ROOT',target),patch.object(I,'MANIFEST',target/'inputs.json'),patch.object(I,'META_SOURCES',target/'metadata-sources.json'):
            # Only code root moved. Every frozen data root remains original.
            assert I.collect()==expected
            binding=I.verify()
            assert binding['inputBindingSha256']==manifest_sha and binding['metadataSourceBindingSha256']==meta_sha
            model=root/I.MODEL_RELATIVE; original=model.read_bytes(); model.write_bytes(original+b' ')
            rejects(I.verify); model.write_bytes(original)
            # Shadow only the historical read in the test, keep its frozen key
            # and real comparison. Never alter the actual historical input.
            historical=root/'historical-model.json'; historical.write_bytes(original)
            with patch.object(I,'HISTORICAL_MODEL_FILE',historical):
                assert I.collect()==expected; I.verify()
                historical.write_bytes(original+b' ')
                assert I.collect()!=expected; rejects(I.verify)
    assert I.sha(I.MANIFEST)==manifest_sha and I.sha(I.META_SOURCES)==meta_sha
    print(json.dumps({'kind':'actual collect/verify executing-root relocation with byte-exact model/poses',
        'relocatedSameBytesPass':True,'changedExecutingModelRejected':True,'changedHistoricalModelRejected':True,
        'originalInputsByteExact':manifest_sha,'metadataSourceBindingByteExact':meta_sha,
        'realInputsEdited':False,'nativeExecuted':False},indent=2))


if __name__=='__main__': main()
