import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const exec=promisify(execFile);
const windowsShell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const configPath=process.env.DEX_SITE_RUNTIME_CONFIG||'D:/Dex/Projects/dex-place-world/runtime-v2/production-config.json';
const config=JSON.parse(await readFile(configPath,'utf8').then(text=>text.replace(/^\uFEFF/,'')));
if(config.schemaVersion!==1||config.publicOrigin!=='https://dex.place'||config.enabled!==true)throw new Error('Reviewed website runtime configuration is required.');
const expectedDataRoot=path.resolve('D:/Dex/Projects/dex-place-world/runtime-v2/production-data');
if(typeof config.dataRoot!=='string'||path.resolve(config.dataRoot).toLowerCase()!==expectedDataRoot.toLowerCase())throw new Error('Website data requires the reviewed private production directory.');
const ids=config.ownerIds||[];
if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!(/^[a-f0-9]{8}-[a-f0-9-]{27}$/i).test(id)))throw new Error('Owner access requires reviewed account UUIDs.');
const supportedRefs=new Set(['DEX_PLACE_LIVEKIT_API_KEY','DEX_PLACE_LIVEKIT_API_SECRET','DEX_PLACE_KOFI_VERIFICATION_TOKEN']);
async function credential(ref){
 const target=String(ref||'').replace(/^wincred:\/\//,'');
 if(!supportedRefs.has(target))throw new Error('Unrecognized website credential reference.');
 // The protected value travels through this child pipe into process memory;
 // it is never written into the deployment, arguments, receipts or HTTP output.
 try{
  const {stdout}=await exec(windowsShell,['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File','D:/Dex/Automation/Secrets/Get-DexCredential.ps1','-Target',target,'-RevealJson'],{windowsHide:true,timeout:15000,maxBuffer:16000});
  const value=JSON.parse(stdout).Password;if(typeof value!=='string'||value.length<12)throw new Error('Invalid protected value');return value;
 }catch{throw new Error('Protected website credential could not be resolved.');}
}
process.env.DEX_SITE_SERVICES='1';
process.env.DEX_SITE_PUBLIC_ORIGIN=config.publicOrigin;
process.env.DEX_SITE_DATA_ROOT=config.dataRoot;
process.env.DEX_SITE_OWNER_IDS=ids.join(',');
process.env.DEX_SITE_EMAIL_READY=config.emailReady===true?'1':'0';
process.env.DEX_SITE_TRUST_CLOUDFLARE_PROXY='1';
process.env.DEX_SITE_OAUTH_READY='0';
for(const name of ['DEX_SITE_LIVEKIT_CONFIG','DEX_SITE_LIVEKIT_URL','DEX_SITE_LIVEKIT_API_KEY','DEX_SITE_LIVEKIT_API_SECRET','DEX_SITE_LIVEKIT_MODE'])delete process.env[name];
delete process.env.DEX_SITE_KOFI_VERIFICATION_TOKEN;delete process.env.DEX_SITE_KOFI_MODE;
if(config.kofi?.enabled===true){
 if(!['quarantine','pending-review'].includes(config.kofi.mode))throw new Error('Ko-fi receipts require a reviewed intake mode.');
 if(config.kofi.verificationTokenRef!=='wincred://DEX_PLACE_KOFI_VERIFICATION_TOKEN')throw new Error('Unrecognized Ko-fi reference.');
 process.env.DEX_SITE_KOFI_VERIFICATION_TOKEN=await credential(config.kofi.verificationTokenRef);
 process.env.DEX_SITE_KOFI_MODE=config.kofi.mode;
}
if(config.voice?.enabled===true){
 const endpoint=new URL(config.voice.url);if(endpoint.protocol!=='wss:'||endpoint.hostname!=='dex-place-7ptgm75w.livekit.cloud')throw new Error('Unreviewed voice endpoint.');
 process.env.DEX_SITE_LIVEKIT_URL=endpoint.href;
 process.env.DEX_SITE_LIVEKIT_API_KEY=await credential(config.voice.apiKeyRef);
 process.env.DEX_SITE_LIVEKIT_API_SECRET=await credential(config.voice.apiSecretRef);
 process.env.DEX_SITE_LIVEKIT_MODE='forwarded';
}
const {startProductionOrigin}=await import('./serve-production.mjs');
await startProductionOrigin();
