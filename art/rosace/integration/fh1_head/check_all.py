"""Finite CPU receipt producer, invoked only inside existing rosace-source gate."""
import datetime
import hashlib
import json
import subprocess
import sys
from pathlib import Path
import fh1_binding as B
import fh1_inputs as I


def main():
    started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    before=B.verify(); inputs=I.verify(); results=[]
    for name in ('check_fh1.py','check_fh1_post.py','check_fh1_inputs.py','check_fh1_relocation.py','check_fh1_binding.py'):
        command=[sys.executable,str(B.HERE/name)]
        result=subprocess.run(command,cwd=B.REPO,text=True,encoding='utf-8',capture_output=True)
        results.append({'file':name,'sha256':B.sha(B.HERE/name),'argv':command,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
        if result.returncode: break
    after=B.verify()
    if before!=after or inputs!=I.verify(): raise AssertionError('source/input drift during finite CPU checks')
    receipt={'schema':'fh1.source-cpu-checks/1','startedUTC':started,'finishedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'gate':'D:/Dex/Automation/reports/dex-suite-resumption-20260930/resource-gate.ps1 -Owner rosace-source',
             'sourceBinding':after,'reusedFrozenInputBinding':inputs,'sourceInventorySha256':B.sha(B.MANIFEST),'results':results,'passed':len(results)==5 and all(r['exitCode']==0 for r in results),
             'fixtureScope':'synthetic typed5120 encoding/decoded disclosure, exact construction topology, actual wrapper injected cleanup/import/argv, direct actual metadata/PNG guard helpers, model relocation and source binding; no actual native object/geometry or post run',
             'nativeExecuted':False,'nativeMembershipOrSafetyPassed':False,'candidatePixelsExist':False,'art9':False,'commitOrPushPerformed':False}
    path=B.HERE/'source-checks.json'; path.write_bytes((json.dumps(receipt,indent=2)+'\n').encode('utf-8'))
    print(json.dumps({'receipt':str(path),'sha256':B.sha(path),'passed':receipt['passed'],'checks':len(results),'sourceBinding':after,'inputBinding':inputs},indent=2))
    raise SystemExit(0 if receipt['passed'] else 1)


if __name__=='__main__': main()
