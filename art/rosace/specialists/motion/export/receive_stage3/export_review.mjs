// Receives a genuine completed Stage3 batch, then calls unchanged9da review
// export. No native launcher/finish or release switch exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { exportFrames } from '../export_frames.mjs';
import { resolveRoot, within } from '../profile/character_profile.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const args=process.argv.slice(2), values=new Map();
try {
  if(args.length%2) throw new Error('explicit --option value pairs required');
  for(let i=0;i<args.length;i+=2) {
    if(!args[i].startsWith('--') || !args[i+1] || args[i+1].startsWith('--') || values.has(args[i])) throw new Error('missing/duplicate option');
    values.set(args[i],args[i+1]);
  }
  const outputRoot=resolveRoot(values.get('--output-root')),python=values.get('--python')??'python';
  if(!outputRoot || fs.existsSync(outputRoot)) throw new Error('fresh review output root required');
  if(outputRoot.split(/[\\/]/).some(s=>s.toLowerCase()==='public')) throw new Error('review only; public output forbidden');
  for(const name of ['--source-root','--native-root','--post-root']) {
    const consumed=resolveRoot(values.get(name));
    if(within(consumed,outputRoot)||within(outputRoot,consumed)) throw new Error('export output overlaps consumed root');
  }
  const normalized=resolveRoot(values.get('--out'));
  if(within(outputRoot,normalized)||within(normalized,outputRoot)) throw new Error('normalized input/export roots collide');
  const forwarded=args.filter((v,i)=>!['--output-root','--python'].includes(i%2===0?v:args[i-1]));
  const result=spawnSync(python,[path.join(HERE,'receive_stage3.py'),...forwarded],{windowsHide:true,encoding:'utf8',timeout:180_000,maxBuffer:10*1024*1024});
  if(result.error || result.status!==0) throw new Error(result.error?.message??result.stderr.trim());
  const input=values.get('--out'), source=values.get('--post-root');
  const exported=exportFrames({inputPath:input,sourceRoot:source,outputRoot,mode:'review',python});
  process.stdout.write(JSON.stringify({receiver:JSON.parse(result.stdout),exported,releaseEligible:false})+'\n');
} catch(e) { process.stderr.write(e.message+'\n');process.exitCode=1; }
