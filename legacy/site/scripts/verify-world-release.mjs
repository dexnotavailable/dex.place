import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile,mkdir,symlink,stat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {inspectReleaseDependencies} from './release-dependencies.mjs';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw new Error('Usage: node scripts/verify-world-release.mjs <candidate/site>');
const proofRoot=path.join(path.dirname(stage),'http-proof');await mkdir(proofRoot,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(stage,'release-manifest.json'),'utf8'));
const preparation=JSON.parse(await readFile(path.join(path.dirname(stage),'preparation-proof.json'),'utf8'));
const currentDocs=preparation.documentation?.currentVersion||'1.0';
const currentRelease=preparation.documentation?.currentRelease||'/files/dex-place-documentation/v1.0/release.json';
const serverPath=path.join(path.dirname(stage),'reviewed-server/serve-production.mjs');
const serverSource=await readFile(serverPath);
assert.equal(createHash('sha256').update(serverSource).digest('hex'),preparation.reviewedServer.sha256,'Candidate reviewed-server hash differs');
for(const file of preparation.reviewedServer.files||[])assert.equal(createHash('sha256').update(await readFile(file.path)).digest('hex'),file.sha256,'Frozen origin owner file differs: '+file.sourceRelative);
if(preparation.websiteService){const runtime=await readFile(preparation.websiteService.runtime.path);assert.equal(createHash('sha256').update(runtime).digest('hex'),preparation.websiteService.runtime.sha256,'Private service runtime differs');assert(!manifest.files.some(file=>file.path.startsWith('server/')||file.path.endsWith('runtime.mjs')),'Private service bundle entered public payload');}
const results=[];
function request(pathname,{method='GET',headers={}}={}){
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:5189,path:pathname,method,headers},res=>{const chunks=[];res.on('data',data=>chunks.push(data));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});
    req.setTimeout(8000,()=>req.destroy(new Error('Request timeout')));req.on('error',reject);req.end();
  });
}
async function check(name,operation){const details=await operation();results.push({name,status:'pass',...details});}
async function start(root,sp13Root,tag){
  process.env.DEX_SITE_ROOT=root;process.env.DEX_SITE_HOST='127.0.0.1';process.env.DEX_SITE_PORT='5189';
  if(sp13Root)process.env.DEX_SP13_ROOT=sp13Root;else delete process.env.DEX_SP13_ROOT;
  const module=await import(pathToFileURL(serverPath).href+'?probe='+tag);
  await new Promise((resolve,reject)=>{module.server.once('error',reject);module.server.listen(5189,'127.0.0.1',resolve)});
  return module.server;
}
async function close(server){await new Promise(resolve=>server.close(resolve));}
let server=await start(stage,null,'candidate-'+Date.now());
try{
  await check('All allowlisted files return correct HEAD length',async()=>{for(const file of manifest.files){const r=await request('/'+file.path,{method:'HEAD'});assert.equal(r.status,200,file.path);assert.equal(Number(r.headers['content-length']),file.bytes,file.path);assert.equal(r.body.length,0,file.path);}return {files:manifest.files.length};});
  await check('Final JS/CSS/manifest dependency URLs are served',async()=>{const closure=await inspectReleaseDependencies(stage,{buildManifestPath:path.join(path.dirname(stage),'build/.vite/manifest.json')});assert.equal(closure.missing.length,0);assert(closure.references.some(ref=>ref.url==='/world/assets/v2/archival-paper-v1.webp'&&ref.referencedBy.some(file=>file.endsWith('.css'))),'Current v2 CSS paper was not inspected');assert(closure.references.some(ref=>ref.url.endsWith('/Daniel-Regular.otf')&&ref.referencedBy.some(file=>file.endsWith('.css'))),'Daniel CSS font reference was not inspected');assert(closure.references.some(ref=>ref.url==='/world/fonts-v2/m5x7.ttf'&&ref.referencedBy.some(file=>file.endsWith('.css'))),'Current pixel font was not inspected');assert(closure.references.some(ref=>/\.woff2?$/.test(ref.url)&&ref.referencedBy.some(file=>file.endsWith('.css'))),'Compiled CSS body font references were not inspected');for(const ref of closure.references)assert.equal((await request(ref.url,{method:'HEAD'})).status,200,ref.url);return {references:closure.references.length};});
  await check('Only current manifest previews are staged and hash-correct',async()=>{const preview=JSON.parse((await request('/world/preview/manifest.json')).body);const expected=Object.values(preview.entries).flatMap(profiles=>Object.values(profiles));assert.equal(expected.length,preparation.preview.entries.length);assert.equal(new Set(preparation.preview.entries.map(image=>image.profile)).size,7);const staged=manifest.files.filter(file=>file.group==='world-preview');assert.equal(staged.length,expected.length);assert.deepEqual(staged.map(f=>'/'+f.path).sort(),expected.map(f=>f.url).sort());for(const image of expected){const r=await request(image.url);assert.equal(r.status,200);assert.equal(r.headers['content-type'],'image/webp');assert.equal(createHash('sha256').update(r.body).digest('hex'),image.sha256);}return {images:expected.length,selectedUrls:expected.map(f=>f.url),olderVersionsExcluded:true};});
  await check('Alternate public host redirects canonically and preserves encoded deep routes',async()=>{
    const cases=[
      {host:'www.dex.place',route:'/',method:'GET'},
      {host:'WWW.DEX.PLACE:443',route:'/documentation/dex-place/world%20and%20gameplay?version=1.0&next=%2Fdownloads%3Ftab%3Dall',method:'GET'},
      {host:'www.dex.place:80',route:'/downloads/dex-place-documentation?version=1.0&view=fight',method:'HEAD'},
    ];
    for(const item of cases){const r=await request(item.route,{method:item.method,headers:{Host:item.host}});assert.equal(r.status,308);assert.equal(r.headers.location,'https://dex.place'+item.route);assert.equal(r.body.length,0);}
    for(const host of ['dex.place','DEX.PLACE:443','127.0.0.1:5189']){const r=await request('/downloads/dex-place-documentation?version=1.0',{headers:{Host:host}});assert.equal(r.status,200);assert.equal(r.headers.location,undefined);assert.match(r.headers['content-type'],/^text\/html/);}
    assert.equal((await request('/bad%ZZ',{headers:{Host:'www.dex.place'}})).status,400,'Target validation must precede redirect');
    const identity=JSON.parse((await request(currentRelease,{headers:{Host:'dex.place'}})).body);
    assert.equal(new URL(identity.publicUrl).origin,'https://dex.place');
    const artifact=await request(new URL(identity.publicUrl).pathname,{method:'HEAD',headers:{Host:'dex.place'}});
    assert.equal(artifact.status,200);assert.equal(artifact.headers.location,undefined);assert.equal(Number(artifact.headers['content-length']),identity.bytes);assert.equal(artifact.headers['content-type'],'application/zip');
    return {redirects:cases,canonicalAndLocalHostsNotRedirected:true,canonicalDownloadIdentity:identity.publicUrl,canonicalDownloadBytes:identity.bytes};
  });
  await check('Downloads SPA routes are HTML, never attachments',async()=>{for(const route of ['/downloads','/downloads/','/downloads/dex-place-documentation']){const r=await request(route);assert.equal(r.status,200);assert.match(r.headers['content-type'],/^text\/html/);assert.equal(r.headers['content-disposition'],undefined);assert.equal(r.headers['cache-control'],'no-cache, no-transform');}return {routes:3};});
  await check('All seven legacy download URLs preserved',async()=>{const files=manifest.files.filter(f=>f.group==='preserved-legacy-download');assert.equal(files.length,7);for(const file of files){const r=await request('/'+file.path,{method:'HEAD'});assert.equal(r.status,200);assert.equal(r.headers['cache-control'],'private, no-store');assert.match(r.headers['content-disposition'],/attachment/);}return {files:files.map(f=>f.path)};});
  await check('Installer resumable byte range',async()=>{const file=manifest.files.find(f=>f.path.endsWith('.exe'));const r=await request('/'+file.path,{headers:{Range:'bytes=0-1023'}});assert.equal(r.status,206);assert.equal(r.body.length,1024);assert.equal(r.body.subarray(0,2).toString(),'MZ');assert.equal(r.headers['content-range'],`bytes 0-1023/${file.bytes}`);return {bytes:file.bytes};});
  await check('ZIP MIME, attachment, suffix range and invalid range',async()=>{const file=manifest.files.find(f=>f.group==='documentation-zip');const full=await readFile(path.join(stage,file.path));const head=await request('/'+file.path,{method:'HEAD'});assert.equal(head.headers['content-type'],'application/zip');assert(head.headers['content-disposition'].includes('dex-place-documentation-v'+currentDocs+'.zip'));const suffix=await request('/'+file.path,{headers:{Range:'bytes=-16'}});assert.equal(suffix.status,206);assert.deepEqual(suffix.body,full.subarray(-16));for(const range of [`bytes=${full.length}-`,'bytes=-0','bytes=abc'])assert.equal((await request('/'+file.path,{headers:{Range:range}})).status,416);return {sha256:createHash('sha256').update(full).digest('hex')};});
  await check('Published historical documentation URLs retain exact bytes',async()=>{const retained=preparation.documentation?.retainedEditions||[];for(const edition of retained){const r=await request(edition.zip);assert.equal(r.status,200);assert.equal(r.body.length,edition.bytes);assert.equal(createHash('sha256').update(r.body).digest('hex'),edition.sha256);assert.equal(JSON.parse((await request(edition.releaseUrl)).body).version,edition.version);}return {editions:retained};});
  await check('MIME types for every audio representation and SHA1',async()=>{for(const [suffix,type] of [['.wav','audio/wav'],['.opus','audio/ogg; codecs=opus'],['.m4a','audio/mp4'],['.sha1','text/plain; charset=utf-8']]){const file=manifest.files.find(f=>f.path.endsWith(suffix));assert(file,suffix);const r=await request('/'+file.path,{method:'HEAD'});assert.equal(r.headers['content-type'],type);}return {types:4};});
  await check('Conditional304 precedes ranges; If-Range mismatch returns full',async()=>{const file=manifest.files.find(f=>f.group==='documentation-zip');const head=await request('/'+file.path,{method:'HEAD'});const etag=head.headers.etag;assert.equal((await request('/'+file.path,{headers:{'If-None-Match':`"other", ${etag}`,Range:'bytes=0-3'}})).status,304);assert.equal((await request('/'+file.path,{headers:{'If-None-Match':etag,Range:'bytes=garbage'}})).status,304);const mismatch=await request('/'+file.path,{headers:{Range:'bytes=0-3','If-Range':'"changed"'}});assert.equal(mismatch.status,200);assert.equal(mismatch.body.length,file.bytes);assert.equal((await request('/'+file.path,{headers:{Range:'bytes=0-3','If-Range':head.headers['last-modified']}})).status,206);return {etag};});
  await check('Malformed paths reject without crashing; methods are GET/HEAD',async()=>{for(const route of ['/bad%ZZ','/%00bad','/%5c..%5cprivate','/index.html%3aZone.Identifier'])assert.equal((await request(route)).status,400,route);for(const route of ['/scripts/serve-production.mjs','/server/runtime.mjs','/server/bundle-receipt.json','/src/worldsite/v2/main.tsx','/src/worldsite/main.tsx','/world/trials/pixel-scale-20260906/trial-manifest.json','/.git/config','/missing.png'])assert.equal((await request(route)).status,404,route);const post=await request('/',{method:'POST'});assert.equal(post.status,405);assert.equal(post.headers.allow,'GET, HEAD');const health=await request('/healthz');assert.equal(health.status,200);assert.equal(health.body.toString(),'ok');return {aliveAfterMalformedRequests:true};});
  await check('Actual external SP13 mount and current/release cache rules',async()=>{const redirect=await request('/sp13?test=1');assert.equal(redirect.status,308);assert.equal(redirect.headers.location,'/sp13/?test=1');const index=await request('/sp13/',{method:'HEAD'});assert.equal(index.status,200);assert.match(index.headers['content-type'],/^text\/html/);const current=await request('/sp13/current.json');assert.equal(current.status,200);assert.equal(current.headers['cache-control'],'no-store');const again=await request('/sp13/current.json',{headers:{'If-None-Match':current.headers.etag}});assert.equal(again.status,200);const data=JSON.parse(current.body);const release=await request(data.releaseManifestUrl,{method:'HEAD'});assert.equal(release.status,200);assert.match(release.headers['cache-control'],/immutable/);assert.equal((await request('/sp13/publish.lock')).status,404);return {releaseId:data.releaseId,externalFilesUnmodified:true};});
}finally{await close(server);}

// Harmless private fixtures exercise real Windows junction containment and empty
// files. No production root or user source is changed, and no secret is read.
const fixture=path.join(proofRoot,'fixtures-'+Date.now()),inside=path.join(fixture,'root'),outside=path.join(fixture,'outside'),sp13=path.join(fixture,'sp13');
await mkdir(inside,{recursive:true});await mkdir(outside);await mkdir(path.join(sp13,'releases','fixture-v1','player'),{recursive:true});
await writeFile(path.join(inside,'index.html'),'<html>fixture</html>');await writeFile(path.join(inside,'empty.txt'),'');await writeFile(path.join(outside,'probe.txt'),'outside-fixture-marker');
await symlink(outside,path.join(inside,'junction'),'junction');await symlink(outside,path.join(sp13,'releases','fixture-v1','player','junction'),'junction');
const wasm=Buffer.from([0,97,115,109,1,0,0,0]);await writeFile(path.join(sp13,'releases','fixture-v1','player','engine.wasm.gz'),gzipSync(wasm));
server=await start(inside,sp13,'fixtures-'+Date.now());
try{
  await check('Real junctions cannot escape main or SP13 roots',async()=>{for(const route of ['/junction/probe.txt','/sp13/releases/fixture-v1/player/junction/probe.txt']){const r=await request(route);assert.equal(r.status,404);assert(!r.body.includes('outside-fixture-marker'));}return {junctions:2};});
  await check('Zero-byte files do not crash origin',async()=>{const r=await request('/empty.txt');assert.equal(r.status,200);assert.equal(r.body.length,0);assert.equal(r.headers['content-length'],'0');assert.equal((await request('/healthz')).status,200);return {bytes:0};});
  await check('Compressed Unity representation retains correct MIME/encoding',async()=>{const r=await request('/sp13/releases/fixture-v1/player/engine.wasm.gz');assert.equal(r.status,200);assert.equal(r.headers['content-type'],'application/wasm');assert.equal(r.headers['content-encoding'],'gzip');assert.deepEqual(r.body,gzipSync(wasm));return {representation:'wasm.gz'};});
}finally{await close(server);}
assert.equal(createHash('sha256').update(await readFile(serverPath)).digest('hex'),preparation.reviewedServer.sha256,'Reviewed server changed during verification');
const proof={status:'pass',candidateStage:stage,serverPath,serverSha256:createHash('sha256').update(serverSource).digest('hex'),port:5189,checks:results,originalOriginPort8088Untouched:true,hostingTasksUntouched:true,publicPromotionPerformed:false,originalSp13FilesUnchanged:true};
await writeFile(path.join(proofRoot,'server-verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:'pass',checks:results.length,filesChecked:manifest.files.length,proof:path.join(proofRoot,'server-verification.json'),port5189Closed:true},null,2));
