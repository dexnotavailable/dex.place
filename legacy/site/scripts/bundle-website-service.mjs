import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createRequire,builtinModules} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readPackageLicense} from './package-license.mjs';

const ownedModules=new Set(['server/index.mjs','server/store.mjs','server/identity.mjs','server/treasury.mjs','server/social.mjs','server/voice.mjs','server/livekit-config.mjs','server/validation.mjs','server/kofi.mjs']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const within=(root,target)=>{const r=path.relative(root,target);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};

/** Private, importable Node factory. No account call, service start or data copy. */
export async function bundleWebsiteService({site,out}){
 site=path.resolve(site);out=path.resolve(out);
 if(path.basename(out)!=='server'||within(site,out))throw Error('Service bundle must be a private candidate sibling server directory, outside source/public');
 const runtime=path.join(out,'runtime.mjs');try{await stat(runtime);throw Error('Refusing to overwrite an existing service runtime')}catch(e){if(e.code!=='ENOENT')throw e;}
 const require=createRequire(path.join(site,'package.json')),viteRequire=createRequire(require.resolve('vite'));
 const esbuild=viteRequire('esbuild');
 const before={};for(const p of ownedModules)before[p]=sha(await readFile(path.join(site,p)));
 const result=await esbuild.build({absWorkingDir:site,entryPoints:['server/index.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:runtime,write:false,metafile:true,sourcemap:false,minify:false,legalComments:'inline',logLevel:'silent',banner:{js:"import { createRequire as __dexCreateRequire } from 'node:module';\nconst require = __dexCreateRequire(import.meta.url);"}});
 const builtin=new Set(builtinModules.flatMap(n=>[n,n.startsWith('node:')?n.slice(5):'node:'+n]));
 for(const output of Object.values(result.metafile.outputs))for(const imp of output.imports)if(imp.external&&!builtin.has(imp.path))throw Error('Unbundled non-builtin service dependency: '+imp.path);
 const sourceHashes={},packages=new Map();
 async function packageFor(file){let folder=path.dirname(file);for(let i=0;i<30;i++){try{const bytes=await readFile(path.join(folder,'package.json')),p=JSON.parse(bytes);if(p.name)return{folder,metadata:p,metadataSha256:sha(bytes)}}catch(e){if(e.code!=='ENOENT'&&e.code!=='ENOTDIR')throw e;}const parent=path.dirname(folder);if(parent===folder)break;folder=parent;}throw Error('Package owner missing: '+file);}
 for(const input of Object.keys(result.metafile.inputs)){
  const absolute=path.resolve(site,input),relative=path.relative(site,absolute).replaceAll(path.sep,'/');
  if(relative.includes('node_modules/')){
   const owner=await packageFor(absolute),key=owner.metadata.name+'@'+owner.metadata.version;
   if(!packages.has(key))packages.set(key,owner);
  }else if(!ownedModules.has(relative))throw Error('Unexpected private service source; tests/pilots/configs are not bundle inputs: '+relative);
  sourceHashes[relative]=sha(await readFile(absolute));
 }
 const notices=[];for(const owner of packages.values()){
  const license=await readPackageLicense(site,owner.folder,owner.metadata);notices.push({name:owner.metadata.name,version:owner.metadata.version,declaredLicense:owner.metadata.license,packageJsonSha256:owner.metadataSha256,licenseFile:license.file,licenseSha256:license.sha256,sourceUrl:license.sourceUrl,supplement:license.supplement,text:license.bytes.toString('utf8')});
 }
 for(const p of ownedModules)if(sha(await readFile(path.join(site,p)))!==before[p])throw Error('Service source changed during bundling: '+p);
 await mkdir(out,{recursive:true});const output=result.outputFiles.find(f=>path.resolve(f.path)===runtime);if(!output||result.outputFiles.length!==1)throw Error('Expected one standalone service module');
 const bytes=Buffer.from(output.contents);if(/\bsk[_-](?:proj-)?[A-Za-z0-9_-]{24,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString('utf8')))throw Error('Potential raw secret in private runtime; do not stage');
 await writeFile(runtime,bytes,{flag:'wx'});
 const originalNotice=await readFile(path.join(site,'server/THIRD-PARTY-NOTICES.md'),'utf8');
 const noticeText=originalNotice+'\n\n# Exact bundled Node dependencies\n\n'+notices.sort((a,b)=>a.name.localeCompare(b.name)).map(n=>'='.repeat(72)+'\n'+n.name+'@'+n.version+'\n'+n.text).join('\n\n');
 await writeFile(path.join(out,'THIRD-PARTY-NOTICES.txt'),noticeText);
 const probe=await promisify(execFile)(process.execPath,['--input-type=module','-e',`const m=await import(${JSON.stringify(pathToFileURL(runtime).href)});if(typeof m.createWebsiteService!=='function')throw Error('Missing service factory');console.log('service-factory-import-pass');`],{windowsHide:true,timeout:20000,maxBuffer:100000});
 if(probe.stdout.trim()!=='service-factory-import-pass')throw Error('Unexpected import probe output');
 const receipt={createdAt:new Date().toISOString(),status:'bundled-import-verified',nodeVersion:process.version,esbuildVersion:esbuild.version,entry:'server/index.mjs',runtime:{path:runtime,bytes:bytes.length,sha256:sha(bytes)},notice:{path:path.join(out,'THIRD-PARTY-NOTICES.txt'),sha256:sha(Buffer.from(noticeText))},sourceHashes,packages:notices.map(({text,...n})=>n),externalImports:[...new Set(Object.values(result.metafile.outputs).flatMap(o=>o.imports.filter(i=>i.external).map(i=>i.path)))],importProbe:{status:'pass',factory:'createWebsiteService',startedListener:false,createdStore:false,providerActions:0},deploymentContract:{visibility:'Private sibling server/runtime.mjs; never served from dist/public.',requiredOptions:['origin: canonical HTTPS origin','map: parsed staged world/rooms-v2.json','dataRoot: explicit persistent directory outside deployed and authoring roots'],runtimeDependencies:'Node22+ builtin APIs; Windows identity secret resolver remains an external owner reference, not copied credentials. LiveKit SDK is bundled; media server is separately operated.',lifecycle:'Root owns same-origin API mounting, one process/store owner, startup, shutdown, credentials and actual service verification.'}};
 await writeFile(path.join(out,'bundle-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 return receipt;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),at=args.indexOf('--out');if(at<0||!args[at+1])throw Error('Usage: node scripts/bundle-website-service.mjs --out <private-candidate/server>');
 const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const receipt=await bundleWebsiteService({site,out:args[at+1]});
 console.log(JSON.stringify({status:receipt.status,runtime:receipt.runtime,packages:receipt.packages.map(p=>p.name+'@'+p.version),importProbe:receipt.importProbe}));
}
