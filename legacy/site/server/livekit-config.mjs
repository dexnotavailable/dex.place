import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import nodePath from 'node:path';
const exec=promisify(execFile);
/** Finite UTF-16 WinCred refs; private child stdout is parsed in this process and never logged. */
export async function loadConfiguredVoice(path='D:/Dex/Projects/dex-place-world/runtime-v2/livekit-provider.json',mode='native') {
  if(mode==='cloud')mode='forwarded';
  const metadata=JSON.parse(await readFile(path,'utf8'));
  if(metadata.apiKeyRef!=='wincred://DEX_PLACE_LIVEKIT_API_KEY'||metadata.apiSecretRef!=='wincred://DEX_PLACE_LIVEKIT_API_SECRET')throw new Error('Unrecognized voice credential references.');
  const url=new URL(metadata.projectUrl);
  if(url.protocol!=='wss:'||!url.hostname.endsWith('.livekit.cloud'))throw new Error('The configured voice endpoint is not the approved managed origin.');
  const read=async target=>{
    try{const {stdout}=await exec(nodePath.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File','D:/Dex/Automation/Secrets/Get-DexCredential.ps1','-Target',target,'-RevealJson'],{windowsHide:true,timeout:15000,maxBuffer:16000});const result=JSON.parse(stdout);if(typeof result.Password!=='string'||!result.Password.trim())throw new Error('Missing credential');return result.Password;}
    catch{throw new Error('Protected voice configuration could not be resolved.');}
  };
  const [apiKey,apiSecret]=await Promise.all([read('DEX_PLACE_LIVEKIT_API_KEY'),read('DEX_PLACE_LIVEKIT_API_SECRET')]);
  if(!['native','forwarded'].includes(mode))throw new Error('Choose a supported, verified voice topology.');
  return {url:url.href,apiKey,apiSecret,mode};
}
