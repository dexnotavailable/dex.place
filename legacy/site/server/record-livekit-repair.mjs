import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),base='A:/Dex/Builds/dex-place-livekit-1.13.6',proof='D:/Dex/Automation/Proofs/dex-place/20260908-v2-services/voice-repair';
const receipt=JSON.parse(await readFile(resolve(proof,'source-receipt.json'),'utf8'));
const hash=data=>createHash('sha256').update(data).digest('hex');
let patch='';const compiledSources=[];
for(const entry of receipt.before){const before=resolve(base,'original',entry.path),after=resolve(base,'source',entry.path),data=await readFile(after);compiledSources.push({path:entry.path,sha256:hash(data)});let diff='';try{diff=(await exec('git',['diff','--no-index','--',before,after],{windowsHide:true,maxBuffer:200000})).stdout;}catch(error){if(error.code!==1)throw error;diff=error.stdout;}diff=diff.split('\n').map(line=>line.startsWith('diff --git ')?`diff --git a/${entry.path} b/${entry.path}`:line.startsWith('--- ')?`--- a/${entry.path}`:line.startsWith('+++ ')?`+++ b/${entry.path}`:line).join('\n');patch+=diff;}
const unitPath='pkg/rtc/dex_admin_subscription_test.go',unit=await readFile(resolve(base,'source',unitPath),'utf8');
patch+=`diff --git a/${unitPath} b/${unitPath}\nnew file mode 100644\n--- /dev/null\n+++ b/${unitPath}\n@@ -0,0 +1,${unit.trimEnd().split('\n').length} @@\n`+unit.trimEnd().split('\n').map(line=>'+'+line).join('\n')+'\n';
await writeFile(resolve(proof,'livekit-1.13.6-dex-admin-tracks.patch'),patch);
const binary=await readFile(resolve(proof,'bin/livekit-server'));
const protocol=JSON.parse(await readFile(resolve(proof,'pilot/protocol-receipt.json'),'utf8'));
const final={...receipt,compiledSources,newTestSha256:hash(unit),patchSha256:hash(patch),binary:{path:resolve(proof,'bin/livekit-server'),bytes:binary.length,sha256:hash(binary)},goTests:{command:'go test ./pkg/rtc -run TestDexAdminSubscription -count=1',exitCode:0,observed:'ok github.com/livekit/livekit-server/pkg/rtc 0.020s',scope:'Two focused grant/revoke/concurrency tests; not the entire upstream suite'},protocol:{path:resolve(proof,'pilot/protocol-receipt.json'),status:protocol.policyResult,passed:protocol.checks.filter(check=>check.pass).length,total:protocol.checks.length,matchingBinary:protocol.repairBinarySha256===hash(binary),cleanup:protocol.cleanup},completedAt:new Date().toISOString()};
if(!final.protocol.matchingBinary||final.protocol.passed!==final.protocol.total)throw new Error('Protocol proof does not match this final binary.');
await writeFile(resolve(proof,'final-receipt.json'),JSON.stringify(final,null,2));
console.log(JSON.stringify({patch:resolve(proof,'livekit-1.13.6-dex-admin-tracks.patch'),binary:final.binary,protocol:final.protocol},null,2));
