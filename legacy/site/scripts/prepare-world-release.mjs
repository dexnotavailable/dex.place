import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,readdir,lstat,realpath,copyFile,statfs,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {build} from 'vite';
import {inspectReleaseDependencies} from './release-dependencies.mjs';
import {inspectActiveAudioMap,inspectAudioRequirements,validateActiveAudio,projectActiveAudio} from './audio-runtime-selection.mjs';
import {bundleWebsiteService} from './bundle-website-service.mjs';
import {readPackageLicense} from './package-license.mjs';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const policyPath=path.join(site,'release-allowlist.json');
const policy=JSON.parse(await readFile(policyPath,'utf8'));
const publicRoot=path.join(site,'public');
const argv=process.argv.slice(2);const value=key=>{const i=argv.indexOf(key);return i<0?null:argv[i+1]};
const releaseId=value('--id')||new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(releaseId))throw new Error('Invalid release ID');
const out=path.resolve(value('--out')||path.join(policy.stagingRoot,releaseId));
const legacySite=path.resolve(value('--legacy-site')||policy.legacySite);
const relativeTo=(root,p)=>path.relative(root,p);
const within=(root,p)=>{const rel=relativeTo(root,p);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))};
const selectedStagingRoot=[policy.stagingRoot,...policy.additionalStagingRoots||[]].map(root=>path.resolve(root)).find(root=>out!==root&&within(root,out));
if(!selectedStagingRoot)throw new Error('Output must be a new child of a configured private staging root');
try{await lstat(out);throw new Error('Output already exists; use a new release ID. Nothing is removed.')}catch(error){if(error.code!=='ENOENT')throw error;}
const hashBuffer=data=>createHash('sha256').update(data).digest('hex');
async function hashFile(file){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex')}
async function files(root,relative=''){const result=[];for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){const rel=path.join(relative,entry.name);if(entry.isSymbolicLink())throw new Error('Reparse/symlink input is not allowed: '+rel);if(entry.isDirectory())result.push(...await files(root,rel));else if(entry.isFile())result.push(rel.replaceAll(path.sep,'/'));}return result}
function safeRelative(relative){if(typeof relative!=='string'||relative.startsWith('/')||relative.includes('\\')||relative.split('/').some(p=>!p||p==='.'||p==='..')||relative.includes('\0'))throw new Error('Unsafe release-relative path');return relative}
async function safePublicSource(relative){safeRelative(relative);const source=path.resolve(publicRoot,relative);const [rootReal,sourceReal,details]=await Promise.all([realpath(publicRoot),realpath(source),lstat(source)]);if(!within(rootReal,sourceReal)||!details.isFile()||details.isSymbolicLink())throw new Error('Public input escapes its owner or is not an ordinary file: '+relative);return sourceReal}
function scanText(text,label){
  const patterns=[/[A-Za-z]:[\\/](?:Dex|Users|Windows)[\\/]/,/wincred:\/\//i,/generated_images[\\/]/,/"(?:rawSource|generatedToolOutput|originalToolOutput|privateExport|sourceRecord)"\s*:/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bsk[_-](?:proj-)?[A-Za-z0-9_-]{24,}/];
  if(patterns.some(pattern=>pattern.test(text)))throw new Error('Private/source/credential material detected in release text: '+label);
}
const textExtensions=new Set(['.json','.js','.css','.html','.md','.txt','.svg','.sha1','.sha256']);
function localUrls(value,result=new Set()){if(typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//'))result.add(value);else if(Array.isArray(value))value.forEach(v=>localUrls(v,result));else if(value&&typeof value==='object')Object.values(value).forEach(v=>localUrls(v,result));return result}
function urlRelative(url,prefix,extensions){const parsed=new URL(url,'https://dex.place');if(parsed.origin!=='https://dex.place'||!parsed.pathname.startsWith(prefix)||parsed.search||parsed.hash)throw new Error('Unexpected runtime asset URL: '+url);const rel=safeRelative(decodeURIComponent(parsed.pathname.slice(1)));if(!extensions.includes(path.posix.extname(rel)))throw new Error('Unexpected runtime asset extension: '+url);return rel}
const entries=new Map();const inputHashes={};
async function addPublic(relative,group,expected={}){const source=await safePublicSource(relative);const existing=entries.get(relative);if(existing&&existing.source!==source)throw new Error('Duplicate release path');entries.set(relative,{path:relative,source,group,expected});}
async function readManifest(kind){const relative=policy.runtimeManifests[kind];const source=await safePublicSource(relative);const bytes=await readFile(source);inputHashes[relative]=hashBuffer(bytes);return JSON.parse(bytes.toString('utf8'));}
const [world,hero,audio,gallery,docs,download,preview,rooms,cast,fonts,ui]=await Promise.all(['world','hero','audio','gallery','documentation','download','preview','rooms','cast','fonts','ui'].map(readManifest));
const audioSelectionPath='src/worldsite/audio-runtime-selection.json';
const [audioSelectionBytes,activeMap]=await Promise.all([readFile(path.join(site,audioSelectionPath)),inspectActiveAudioMap(site)]);
inputHashes[audioSelectionPath]=hashBuffer(audioSelectionBytes);inputHashes[activeMap.relative]=activeMap.sha256;
for(const file of ['scripts/prepare-world-release.mjs','scripts/audio-runtime-selection.mjs','scripts/release-dependencies.mjs','scripts/export-world-docs.py','scripts/world-docs-export.json','scripts/bundle-website-service.mjs','scripts/package-license.mjs','scripts/licenses/bufbuild-protobuf-1.10.1-Apache-2.0.txt','scripts/serve-production.mjs','scripts/run-production.mjs','scripts/start-production-origin.ps1'])inputHashes[file]=await hashFile(path.join(site,file));
const audioRequirements=await inspectAudioRequirements(site,activeMap.map);
Object.assign(inputHashes,audioRequirements.sourceHashes);
const audioAudit=validateActiveAudio(audio,JSON.parse(audioSelectionBytes.toString('utf8')),audioRequirements);
const docsVersion=policy.documentationVersion,docsPrefix='content/documentation/v'+docsVersion,downloadPrefix='files/dex-place-documentation/v'+docsVersion;
if(!/^\d+(?:\.\d+)*$/.test(docsVersion)||docs.version!==docsVersion||download.version!==docsVersion)throw Error('Documentation edition differs from the reviewed candidate version');
if(rooms.rooms?.length!==policy.expectedRooms||cast.actors?.length!==policy.expectedCastActors)throw Error('V2 room/cast roster differs from reviewed release policy');
for(const [key,url] of Object.entries({map:activeMap.url,rooms:'/'+policy.runtimeManifests.rooms,scene:'/'+policy.runtimeManifests.world,hero:'/'+policy.runtimeManifests.hero,cast:'/'+policy.runtimeManifests.cast}))if(activeMap.assets[key]!==url)throw Error('Actual game asset declaration differs from release policy: '+key);
const htmlSource=await readFile(path.join(site,'index.html'),'utf8');if(!htmlSource.includes('src="/'+policy.entrySource+'"'))throw Error('Compiled entry is not the reviewed v2 source');
await addPublic(activeMap.url.slice(1),'world-map',{sha256:activeMap.sha256});
const previewSourceBytes=await readFile(path.join(site,policy.previewSource));
inputHashes[policy.previewSource]=hashBuffer(previewSourceBytes);
if(JSON.stringify(JSON.parse(previewSourceBytes.toString('utf8')))!==JSON.stringify(preview))throw new Error('Bundled/public preview manifests differ; recapture or synchronize them before staging');
if(preview.sceneSha256!==inputHashes[policy.runtimeManifests.world])throw new Error('Preview scene hash is stale against the current world manifest');
if(preview.mapSha256!==activeMap.sha256||preview.roomsSha256!==inputHashes[policy.runtimeManifests.rooms])throw Error('Preview map/room hashes are stale against the actual v2 geography');
if(JSON.stringify(Object.keys(preview.entries).sort())!==JSON.stringify([...policy.previewSections].sort()))throw new Error('Preview section roster differs');
const previewEntries=[];
for(const section of policy.previewSections){
  const profiles=preview.entries[section];if(JSON.stringify(Object.keys(profiles).sort())!==JSON.stringify([...policy.previewProfiles].sort()))throw new Error('Preview profiles differ: '+section);
  for(const profile of policy.previewProfiles){const image=profiles[profile];if(!/^[a-f0-9]{64}$/i.test(image.sha256)||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1)throw new Error('Preview metadata incomplete: '+section+'/'+profile);const relative=urlRelative(image.url,'/world/preview/',['.webp']);if(!new RegExp('^world/preview/'+section+'-'+profile+'-v[0-9]+\\.webp$').test(relative))throw new Error('Preview filename does not identify section/profile/revision');await addPublic(relative,'world-preview',{sha256:image.sha256});previewEntries.push({section,profile,...image});}
}
if(new Set(previewEntries.map(image=>image.url)).size!==policy.previewSections.length*policy.previewProfiles.length)throw new Error('Preview image URLs must be unique');
if(world.assets.length!==policy.expectedWorldRoles||new Set(world.assets.map(a=>a.id)).size!==policy.expectedWorldRoles)throw new Error('World role roster differs from reviewed release policy');
const sceneUrlRelative=url=>url==='/world/cast-v2/small-fire.png'?urlRelative(url,'/world/cast-v2/',['.png']):urlRelative(url,'/world/assets/',['.png','.webp']);
for(const asset of world.assets)await addPublic(sceneUrlRelative(asset.url),'world');
for(const url of localUrls(world))await addPublic(sceneUrlRelative(url),'world');
for(const clip of Object.values(hero.clips))await addPublic(urlRelative(clip.url,'/world/hero/',['.png']),'hero',{sha256:clip.sha256});
for(const relative of policy.fixedPublicFiles)await addPublic(relative,'public-content');
for(const kind of ['world','hero','gallery','documentation','download','preview','rooms','cast','fonts','ui'])await addPublic(policy.runtimeManifests[kind],kind+'-manifest');
for(const actor of cast.actors){if(actor.license!=='CC0-1.0')throw Error('Cast license changed; review before staging: '+actor.id);for(const clip of Object.values(actor.clips))await addPublic(urlRelative(clip.url,'/world/cast-v2/',['.png']),'cast',{bytes:clip.bytes,sha256:clip.sha256});}
for(const prop of cast.props||[])await addPublic(urlRelative(prop.url,'/world/cast-v2/',['.png']),'cast-prop',{bytes:prop.bytes,sha256:prop.sha256});
for(const font of fonts.fonts||[]){if(font.license!=='CC0-1.0')throw Error('Pixel font license changed');await addPublic(urlRelative(font.url,'/world/fonts-v2/',['.ttf','.otf','.woff2']),'pixel-font',{bytes:font.bytes,sha256:font.sha256});}
if(ui.license!=='CC0-1.0')throw Error('UI material license changed');for(const item of ui.items||[])await addPublic(urlRelative(item.url,'/world/cast-v2/ui/',['.png']),'ui-material',{bytes:item.bytes,sha256:item.sha256});
const publicAudio=projectActiveAudio(audio,audioAudit);
for(const kind of ['music','ambience','effects'])for(const track of audioAudit.selected[kind]){
  for(const file of Object.values(track.files)){if(!/^\/audio\/(?:world-v1|v2)\//.test(file.url))throw Error('Unreviewed audio family: '+file.url);await addPublic(urlRelative(file.url,'/audio/',['.wav','.opus','.m4a','.ogg','.mp3']),'audio',{bytes:file.bytes,sha256:file.sha256});}
  for(const note of track.attributions||[]){if(note.url?.startsWith('https://'))continue;await addPublic(urlRelative(note.url,'/audio/world-v1/',['.md','.txt']),'audio-license',{bytes:note.bytes,sha256:note.sha256});}
}
const sanitizedAudio=Buffer.from(JSON.stringify(publicAudio,null,2)+'\n');entries.set(policy.runtimeManifests.audio,{path:policy.runtimeManifests.audio,buffer:sanitizedAudio,group:'public-audio-manifest',transformation:'Only validated active runtime entries and unchanged listening states; reserved/rejected unused catalog files and private production metadata omitted.'});
if(gallery.items.length!==policy.expectedGalleryItems)throw new Error('Expected exactly nine gallery items');
for(const item of gallery.items){await addPublic(urlRelative(item.src,'/content/illustrations/',['.webp']),'gallery-display',{bytes:item.bytes,sha256:item.sha256});await addPublic(urlRelative(item.thumbnailSrc,'/content/illustrations/',['.webp']),'gallery-thumbnail',{bytes:item.thumbnailBytes,sha256:item.thumbnailSha256});}
const allowedDocs=new Set(policy.documentationFiles);if(docs.documents.length!==allowedDocs.size||new Set(docs.documents.map(d=>d.filename)).size!==allowedDocs.size)throw new Error('Documentation edition/file allowlist differs');
for(const doc of docs.documents){if(!allowedDocs.has(doc.filename))throw new Error('Unreviewed documentation file: '+doc.filename);await addPublic(docsPrefix+'/'+doc.filename,'documentation',{sha256:doc.sha256});}
const downloadRelative=urlRelative(download.url,'/'+downloadPrefix+'/', ['.zip']);if(new URL(download.publicUrl).origin!=='https://dex.place')throw new Error('Production artifact must use public dex.place HTTPS');await addPublic(downloadRelative,'documentation-zip',{bytes:download.bytes,sha256:download.sha256});
const retainedEditions=[];
for(const version of policy.retainedDocumentationVersions||[]){
 if(!/^\d+(?:\.\d+)*$/.test(version)||version===docsVersion)throw Error('Invalid retained documentation version');
 const prefix='content/documentation/v'+version,artifactPrefix='files/dex-place-documentation/v'+version;
 const release=JSON.parse(await readFile(await safePublicSource(artifactPrefix+'/release.json'),'utf8')),previous=JSON.parse(await readFile(await safePublicSource(prefix+'/manifest.json'),'utf8'));
 if(release.version!==version||previous.version!==version)throw Error('Retained edition identity differs');
 const seal=JSON.parse(await readFile(await safePublicSource(artifactPrefix+'/dex-place-documentation-v'+version+'.published'),'utf8'));
 if(seal.edition!==version||seal.sha256!==release.sha256||seal.bytes!==release.bytes)throw Error('Retained edition differs from its public promotion seal');
 for(const doc of previous.documents)await addPublic(prefix+'/'+safeRelative(doc.filename),'retained-documentation',{sha256:doc.sha256});
 for(const name of ['README.md','manifest.json','documents.json','physical-files.json'])await addPublic(prefix+'/'+name,'retained-documentation');
 await addPublic(artifactPrefix+'/release.json','retained-documentation-release');
 await addPublic(urlRelative(release.url,'/'+artifactPrefix+'/', ['.zip']),'retained-documentation-zip',{bytes:release.bytes,sha256:release.sha256});
 retainedEditions.push({version,releaseUrl:'/'+artifactPrefix+'/release.json',zip:release.url,bytes:release.bytes,sha256:release.sha256,documents:previous.documents.length});
}
const legacyRoot=path.join(legacySite,'public/downloads');
const actualLegacy=(await readdir(legacyRoot,{withFileTypes:true})).filter(e=>e.isFile()).map(e=>e.name).sort();
if(JSON.stringify(actualLegacy)!==JSON.stringify([...policy.legacyDownloads].sort()))throw new Error('Legacy download inventory changed; update the reviewed exact allowlist before preparing release');
for(const filename of policy.legacyDownloads){const source=path.join(legacyRoot,filename);const details=await lstat(source);if(!details.isFile()||details.isSymbolicLink())throw new Error('Legacy download is not an ordinary file');entries.set('downloads/'+filename,{path:'downloads/'+filename,source,group:'preserved-legacy-download'});}
let licenses='dex.place runtime third-party licenses\n\nMartial Hero — LuizMelo, CC0. See /world/hero/LICENSE.txt.\nDaniel font license: /world/brand/Daniel-license.txt.\nV2 cast: LuizMelo and Ansimuz, CC0-1.0; source credits in /world/cast-v2/manifest.json. Small fire: Stealthix, CC0-1.0. UI material: Kenney, CC0-1.0. m5x7: Daniel Linssen, CC0-1.0. CC0 text: https://creativecommons.org/publicdomain/zero/1.0/\nArena chamber recording: original composition/arrangement rendered with GeneralUser GS2.0.3 by S. Christian Collins. Recording use permitted by GeneralUser GS License v2; soundfont is not distributed. https://www.schristiancollins.com/generaluser.php\n\n';
const rootRequire=createRequire(path.join(site,'package.json'));
const packageResolvers=[rootRequire,createRequire(rootRequire.resolve('react-dom'))];
async function packageDirectory(name){
  for(const resolver of packageResolvers){
    try{return path.dirname(resolver.resolve(name+'/package.json'))}catch{}
    try{let dir=path.dirname(resolver.resolve(name));for(let i=0;i<12;i++){try{if(JSON.parse(await readFile(path.join(dir,'package.json'),'utf8')).name===name)return dir}catch{}const parent=path.dirname(dir);if(parent===dir)break;dir=parent}}catch{}
  }
  throw new Error('Installed package root unavailable for license: '+name);
}
const licensedPackages=new Map();
async function appendLicense(name,dir){const pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8')),key=name+'@'+pkg.version;if(licensedPackages.has(key))return;const license=await readPackageLicense(site,dir,pkg);licenses+='='.repeat(72)+'\n'+key+'\n'+'='.repeat(72)+'\n'+license.bytes.toString('utf8')+'\n\n';licensedPackages.set(key,{name,version:pkg.version,source:license.source,sha256:license.sha256,sourceUrl:license.sourceUrl,supplement:license.supplement});}
for(const name of [...policy.licensePackages,'vite'])await appendLicense(name,await packageDirectory(name));
entries.set('licenses/third-party.txt',{path:'licenses/third-party.txt',buffer:Buffer.from(licenses),group:'licenses'});

// Inspect the ZIP itself; trusted metadata alone is not an archive-content proof.
const zip=await readFile(entries.get(downloadRelative).source);let eocd=-1;
for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50){eocd=i;break;}
if(eocd<0)throw new Error('Docs ZIP has no central directory');
let cursor=zip.readUInt32LE(eocd+16);const zipCount=zip.readUInt16LE(eocd+10),zipEntries=[];
const zipAllowed=new Set(['README.md','manifest.json',...policy.documentationFiles]);
for(let index=0;index<zipCount;index++){
  if(zip.readUInt32LE(cursor)!==0x02014b50)throw new Error('Malformed docs ZIP directory');
  const method=zip.readUInt16LE(cursor+10),compressed=zip.readUInt32LE(cursor+20),uncompressed=zip.readUInt32LE(cursor+24),nameLength=zip.readUInt16LE(cursor+28),extra=zip.readUInt16LE(cursor+30),comment=zip.readUInt16LE(cursor+32),local=zip.readUInt32LE(cursor+42);
  const name=zip.subarray(cursor+46,cursor+46+nameLength).toString('utf8');safeRelative(name);if(!zipAllowed.has(name)||uncompressed>10*1024*1024)throw new Error('Unexpected docs ZIP member: '+name);
  const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);const data=zip.subarray(start,start+compressed);const decoded=method===0?data:method===8?inflateRawSync(data,{maxOutputLength:10*1024*1024}):null;
  if(!decoded||decoded.length!==uncompressed)throw new Error('Invalid docs ZIP member');scanText(decoded.toString('utf8'),'ZIP/'+name);
  const counterpart=await readFile(path.join(publicRoot,docsPrefix,name));if(hashBuffer(decoded)!==hashBuffer(counterpart))throw new Error('Reader/ZIP bytes differ: '+name);zipEntries.push(name);cursor+=46+nameLength+extra+comment;
}
if(zipEntries.length!==zipAllowed.size||new Set(zipEntries).size!==zipAllowed.size)throw new Error('Docs ZIP has missing or duplicate edition members');

const selectedBytes=(await Promise.all([...entries.values()].map(async e=>e.buffer?.length??(await stat(e.source)).size))).reduce((a,b)=>a+b,0);
await mkdir(selectedStagingRoot,{recursive:true});const space=await statfs(selectedStagingRoot);if(space.bavail*space.bsize<selectedBytes+512*1024*1024)throw new Error('Insufficient staging free space');
const criticalSources=await files(path.join(site,'src/worldsite'));
for(const rel of criticalSources){const key='src/worldsite/'+rel,hash=await hashFile(path.join(site,'src/worldsite',rel));if(inputHashes[key]&&inputHashes[key]!==hash)throw new Error('Manifest-linked source changed before build: '+key);inputHashes[key]=hash;}
inputHashes['index.html']=await hashFile(path.join(site,'index.html'));inputHashes['vite.config.ts']=await hashFile(path.join(site,'vite.config.ts'));
await mkdir(out);const buildRoot=path.join(out,'build'),stage=path.join(out,'site');await mkdir(stage);
const buildResult=await build({root:site,logLevel:'warn',build:{outDir:buildRoot,emptyOutDir:false,copyPublicDir:false,manifest:true,sourcemap:false}});
const privateService=await bundleWebsiteService({site,out:path.join(out,'server')});Object.assign(inputHashes,privateService.sourceHashes);
const moduleIds=new Set((Array.isArray(buildResult)?buildResult:[buildResult]).flatMap(result=>result.output||[]).filter(chunk=>chunk.type==='chunk').flatMap(chunk=>Object.entries(chunk.modules).filter(([,module])=>module.renderedLength>0).map(([id])=>id)));
const checkedPackageDirs=new Set();
for(const id of moduleIds){if(!id.includes('node_modules'))continue;let dir=path.dirname(id.replace(/^\0/,'').split('?')[0]);for(let depth=0;depth<16;depth++){if(checkedPackageDirs.has(dir))break;try{const pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));checkedPackageDirs.add(dir);if(pkg.name){await appendLicense(pkg.name,dir);break}}catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;}const parent=path.dirname(dir);if(parent===dir)break;dir=parent;}}
entries.set('licenses/third-party.txt',{path:'licenses/third-party.txt',buffer:Buffer.from(licenses),group:'licenses'});
for(const rel of await files(buildRoot)){
  if(rel.startsWith('.vite/'))continue;
  if(rel!=='index.html'&&(!rel.startsWith('assets/')||!['.js','.css','.woff','.woff2','.ttf','.otf','.svg','.png','.webp','.ico'].includes(path.extname(rel))))throw new Error('Unexpected compiled output: '+rel);
  entries.set(rel,{path:rel,source:path.join(buildRoot,rel),group:'compiled'});
}
const fileRecords=[];
for(const entry of entries.values()){
  const destination=path.join(stage,entry.path);await mkdir(path.dirname(destination),{recursive:true});
  if(entry.buffer){scanText(entry.buffer.toString('utf8'),entry.path);await writeFile(destination,entry.buffer);}
  else{
    if(textExtensions.has(path.extname(entry.path)))scanText(await readFile(entry.source,'utf8'),entry.path);
    const before=await hashFile(entry.source);await copyFile(entry.source,destination);if(await hashFile(destination)!==before)throw new Error('Source changed while copied: '+entry.path);
  }
  const bytes=(await stat(destination)).size,sha256=await hashFile(destination);
  if(entry.expected?.bytes!==undefined&&bytes!==entry.expected.bytes)throw new Error('Declared byte size mismatch: '+entry.path);
  if(entry.expected?.sha256&&sha256!==entry.expected.sha256.toLowerCase())throw new Error('Declared hash mismatch: '+entry.path);
  fileRecords.push({path:entry.path,bytes,sha256,group:entry.group});
}
for(const filename of policy.legacyDownloads.filter(n=>n.endsWith('.sha256'))){const text=await readFile(path.join(stage,'downloads',filename),'utf8');const expected=text.trim().split(/\s+/)[0].toLowerCase();const binary=fileRecords.find(f=>f.path==='downloads/'+filename.slice(0,-7));if(!binary||binary.sha256!==expected)throw new Error('Legacy checksum mismatch: '+filename);}
for(const filename of policy.legacyDownloads.filter(n=>n.endsWith('.sha1'))){const text=await readFile(path.join(stage,'downloads',filename),'utf8');const expected=text.trim().split(/\s+/)[0].toLowerCase();const actual=createHash('sha1').update(await readFile(path.join(stage,'downloads',filename.slice(0,-5)))).digest('hex');if(actual!==expected)throw new Error('Legacy SHA1 mismatch: '+filename);}
for(const [relative,expected] of Object.entries(inputHashes)){
  const source=relative.startsWith('src/')||relative.startsWith('scripts/')||relative.startsWith('server/')||relative.startsWith('node_modules/')||relative.startsWith('public/')||relative==='index.html'||relative==='vite.config.ts'?path.join(site,relative):path.join(publicRoot,relative);
  if(await hashFile(source)!==expected)throw new Error('Build input changed during staging; rerun under a new release ID: '+relative);
}
const totalBytes=fileRecords.reduce((sum,file)=>sum+file.bytes,0);
const dependencyClosure=await inspectReleaseDependencies(stage,{buildManifestPath:path.join(buildRoot,'.vite/manifest.json')});
await writeFile(path.join(out,'dependency-closure.json'),JSON.stringify(dependencyClosure,null,2)+'\n');
if(dependencyClosure.missing.length)throw new Error('Release dependency closure failed: '+dependencyClosure.missing.map(item=>item.url).join(', '));
const releaseManifest={schemaVersion:1,releaseId,builtAt:new Date().toISOString(),status:'staged-candidate',worldRoles:world.assets.length,galleryItems:gallery.items.length,totalBytes,files:fileRecords.sort((a,b)=>a.path.localeCompare(b.path))};
await writeFile(path.join(stage,'release-manifest.json'),JSON.stringify(releaseManifest,null,2)+'\n');
const allPublic=await files(publicRoot),includedPublic=new Set([...entries.values()].filter(e=>e.source&&within(publicRoot,e.source)).map(e=>e.path));
const reviewGates={galleryPending:gallery.items.filter(i=>!['approved','published','public'].includes(i.publicationStatus)).map(i=>i.id),audioPending:[...audioAudit.selected.music,...audioAudit.selected.ambience,...audioAudit.selected.effects].filter(t=>!['pass','approved','reviewed'].includes(t.listeningStatus)).map(t=>t.id),audioReserved:audioAudit.reserved,wholeSceneQuality:'root-owned; not proved by staging'};
const privateProof={...releaseManifest,stage,buildRoot,originalHostingOwner:legacySite,policySha256:await hashFile(policyPath),inputHashes,publicManifestSha256:await hashFile(path.join(stage,'release-manifest.json')),excludedPublicFiles:allPublic.filter(p=>!includedPublic.has(p)&&p!==policy.runtimeManifests.audio),transforms:[{file:policy.runtimeManifests.audio,operation:'runtime-only public projection; original production manifest retained outside staging'}],preservedLegacyFiles:policy.legacyDownloads,externalMounts:policy.externalMounts,docsZipMembersVerified:zipEntries,reviewGates,promotionPerformed:false};
privateProof.payloadFiles=fileRecords.length;privateProof.stagedFiles=fileRecords.length+1;privateProof.publicManifestBytes=(await stat(path.join(stage,'release-manifest.json'))).size;privateProof.stagedBytes=totalBytes+privateProof.publicManifestBytes;
privateProof.preview={manifest:policy.runtimeManifests.preview,bundledSource:policy.previewSource,sceneSha256:preview.sceneSha256,entries:previewEntries};privateProof.dependencyClosure={status:dependencyClosure.status,referenceCount:dependencyClosure.references.length,proof:path.join(out,'dependency-closure.json')};
privateProof.audioRuntimeSelection={selection:audioAudit.selection,requirements:audioAudit.requirements,reserved:audioAudit.reserved,ownerCatalogPreserved:true};
privateProof.runtime={entrySource:policy.entrySource,mapUrl:activeMap.url,mapSha256:activeMap.sha256,rooms:policy.runtimeManifests.rooms,cast:policy.runtimeManifests.cast,fonts:policy.runtimeManifests.fonts,ui:policy.runtimeManifests.ui};privateProof.documentation={currentVersion:docsVersion,currentRelease:'/'+policy.runtimeManifests.download,retainedEditions};
privateProof.websiteService=privateService;
privateProof.licensePackages=[...licensedPackages.values()];
const reviewedServerRoot=path.join(out,'reviewed-server');await mkdir(reviewedServerRoot);const reviewedServerFiles=[];
for(const name of ['serve-production.mjs','run-production.mjs','start-production-origin.ps1']){const relative='scripts/'+name,source=path.join(site,relative),destination=path.join(reviewedServerRoot,name);await copyFile(source,destination);const sha256=await hashFile(destination);if(sha256!==inputHashes[relative]||await hashFile(source)!==sha256)throw Error('Origin owner source changed while freezing: '+relative);reviewedServerFiles.push({path:destination,sha256,sourceRelative:relative,defaultOriginalOwnerTarget:path.join(legacySite,relative)});}
const primaryServer=reviewedServerFiles.find(file=>file.sourceRelative==='scripts/serve-production.mjs');privateProof.reviewedServer={path:primaryServer.path,sha256:primaryServer.sha256,defaultOriginalOwnerTarget:primaryServer.defaultOriginalOwnerTarget,files:reviewedServerFiles,runtimeConfiguration:{copied:false,contentsRead:false,authority:'External private production configuration; bind its enabled metadata hash at promotion. Credential values are resolved by the launcher and are never copied into this packet.'}};
await writeFile(path.join(out,'preparation-proof.json'),JSON.stringify(privateProof,null,2)+'\n');
if(argv.includes('--require-reviewed')&&(reviewGates.galleryPending.length||reviewGates.audioPending.length))throw new Error('Candidate prepared; publication/listening metadata reviews still pending. See private preparation proof.');
console.log(JSON.stringify({releaseId,stage,files:fileRecords.length,bytes:totalBytes,worldRoles:world.assets.length,galleryItems:gallery.items.length,preservedLegacyFiles:policy.legacyDownloads.length,excludedPublicFiles:privateProof.excludedPublicFiles.length,reviewGates,proof:path.join(out,'preparation-proof.json'),promotionPerformed:false},null,2));
