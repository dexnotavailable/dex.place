import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[require.resolve('@playwright/test')]}));
const browser=await chromium.connectOverCDP(process.argv[2]);
const context=await browser.newContext({reducedMotion:'no-preference'});const page=await context.newPage();
const errors=[],hmr=[];page.on('pageerror',e=>errors.push(e.message));
page.on('websocket',ws=>ws.on('framereceived',e=>{try{const m=JSON.parse(String(e.payload));if(['update','full-reload'].includes(m.type))hmr.push(m.type)}catch{}}));
await page.addInitScript(()=>{
 window.__posterArtCanvasWrites=[];
 const record=(kind,args)=>{for(const a of args){const url=a&&typeof a==='object'&&(a.currentSrc||a.src);if(typeof url==='string'&&url.includes('/content/illustrations/'))window.__posterArtCanvasWrites.push({kind,url})}};
 const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...a){record('drawImage',a);return draw.apply(this,a)};
 for(const name of ['WebGLRenderingContext','WebGL2RenderingContext'])if(window[name])for(const method of ['texImage2D','texSubImage2D']){const original=window[name].prototype[method];window[name].prototype[method]=function(...a){record(name+'.'+method,a);return original.apply(this,a)}}
});
const fixtureRoot=process.argv[4];
if(fixtureRoot&&!fixtureRoot.startsWith('D:/Dex/Projects/dex-place-art-production/provenance/'))throw Error('Fixture capture requires a private production directory');
const mapBytes=await readFile(fixtureRoot?fixtureRoot+'/full-route-mechanisms.json':'public/world/maps/causeway.json');
const scene=await readFile(fixtureRoot?fixtureRoot+'/full-scene-candidate.json':'public/world/scene-assets.json');
if(fixtureRoot){
 await context.route('**/world/maps/causeway.json',route=>route.fulfill({body:mapBytes,contentType:'application/json'}));
 await context.route('**/world/scene-assets.json',route=>route.fulfill({body:scene,contentType:'application/json'}));
}
const dir=process.argv[3];if(!dir||!dir.startsWith('D:/Dex/Projects/dex-place-art-production/source/exports/world-posters-'))throw Error('Supply a dedicated D-backed poster capture directory');await mkdir(dir,{recursive:true});
const hash=data=>createHash('sha256').update(data).digest('hex');
async function gameSources(root='src/worldsite/game'){const result=[];for(const e of await readdir(root,{withFileTypes:true})){const p=root+'/'+e.name;if(e.isDirectory())result.push(...await gameSources(p));else if(/\.(ts|json)$/.test(p))result.push(p)}return result}
// Every canvas module, including lighting/platforms, plus shell sizing and
// annotation dependencies. The generated poster JSON is an output, excluded
// deliberately so updating it does not create a self-invalidating hash cycle.
const domOnlyInputs=['src/worldsite/WorldAnnotations.tsx','src/worldsite/world-annotations.css','src/worldsite/gallery-displays.ts','src/worldsite/hero-occlusion.json','src/worldsite/WorldPreview.tsx'];
const renderFiles=[...await gameSources(),'src/worldsite/camera-frame.ts','src/worldsite/main.tsx',...domOnlyInputs,'src/worldsite/worldsite.css','src/worldsite/arrival.css','src/worldsite/control-preview.css','src/worldsite/experience.ts','src/worldsite/ui.tsx','package.json','pnpm-lock.yaml','vite.config.ts','index.html','scripts/capture-world-posters.mjs'].sort();
const sceneData=JSON.parse(scene.toString('utf8').replace(/^\uFEFF/,'')),heroPath='public/world/hero/manifest.json',heroData=JSON.parse(await readFile(heroPath,'utf8'));
const assetFiles=[...new Set([...sceneData.assets.map(a=>'public'+a.url),...Object.values(heroData.clips).map(c=>'public'+c.url),heroPath])].sort();
async function hashes(files){return Object.fromEntries(await Promise.all(files.map(async file=>[file,hash(await readFile(file))])))}
const renderSourceHashes=await hashes(renderFiles),assetSourceHashes=await hashes(assetFiles),mapSha256=hash(mapBytes),sceneSha256=hash(scene);
async function assertStable(){
 const current={...await hashes(renderFiles),...await hashes(assetFiles)},initial={...renderSourceHashes,...assetSourceHashes};
 const changed=Object.keys(current).filter(file=>current[file]!==initial[file]);
 if(hash(await readFile(fixtureRoot?fixtureRoot+'/full-route-mechanisms.json':'public/world/maps/causeway.json'))!==mapSha256)changed.push('map');
 if(hash(await readFile(fixtureRoot?fixtureRoot+'/full-scene-candidate.json':'public/world/scene-assets.json'))!==sceneSha256)changed.push('scene');
 if(changed.length||errors.length||hmr.length){await writeFile(dir+'/capture-failure.json',JSON.stringify({complete:false,changed,errors,hmr},null,2));throw Error('Capture invalidated by runtime/source change: '+JSON.stringify({changed,errors,hmr}))}
}
const frames=[];
try{
for(const profile of [{name:'wide',width:3440,height:1440},{name:'portrait',width:1000,height:1400}]) {
  await page.setViewportSize({width:profile.width,height:profile.height});
  await page.goto('http://127.0.0.1:5188/');await page.getByRole('button',{name:'Enter world',exact:true}).waitFor();
  await page.waitForFunction(()=>window.__dexWorld?.snapshot().ready);
  for(const section of ['home','Downloads','Documentation','Illustrations','Donate']) {
    if(section!=='home') {
      await page.getByRole('link',{name:section,exact:true}).first().click();
      await page.getByRole('button',{name:section==='Donate'?'Close donate to dex':`Close ${section}`,exact:true}).click();
    }
    await page.waitForTimeout(180);await assertStable();
    const filename=`${section.toLowerCase()}-${profile.name}.png`;
    // Read only the world canvas at a rendered RAF boundary. A DOM-clipped
    // screenshot includes overlays and must never be used for a loading plate.
    const data=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve(document.querySelector('.world-canvas canvas').toDataURL('image/png')))));
    const png=Buffer.from(data.split(',')[1],'base64');if(png.length<5000)throw Error('Unexpected blank world capture');
    await writeFile(dir+'/'+filename,png);
    const snapshot=await page.evaluate(()=>window.__dexWorld.snapshot());if(!snapshot.ready||snapshot.contextLost)throw Error('Renderer not ready for '+filename);
    const galleryEvidence=await page.evaluate(()=>({personalArtCanvasWrites:[...window.__posterArtCanvasWrites],domImages:[...document.querySelectorAll('.world-exhibit img')].map(img=>({src:img.currentSrc||img.src,loaded:img.complete&&img.naturalWidth>0,rect:img.getBoundingClientRect().toJSON()}))}));
    if(galleryEvidence.personalArtCanvasWrites.length)throw Error('Personal artwork entered a canvas; poster rejected');
    if(section==='Illustrations')await page.screenshot({path:dir+'/proof-gallery-'+profile.name+'-dom-only.png'});
    frames.push({filename,profile,sha256:hash(png),snapshot,galleryEvidence});
  }
}
const map=JSON.parse(mapBytes.toString('utf8').replace(/^\uFEFF/,''));
const mapProperties=Object.fromEntries((map.properties||[]).map(p=>[p.name,p.value]));
const cameraBounds={left:Number(mapProperties.cameraMinX??0),right:Number(mapProperties.cameraMaxX??map.width*map.tilewidth)};
const home=map.layers.flatMap(l=>l.objects||[]).find(o=>(o.type||o.class)==='home');
const post=JSON.parse(scene.toString('utf8').replace(/^\uFEFF/,'')).assets.find(a=>a.id==='P04');
const origin=post.attachments.origin,lens=post.attachments.lensCenter;
const arrivalSignal={x:home.x-origin.x+lens.x-1,y:home.y-origin.y+lens.y-1,width:3,height:3};
await assertStable();
await writeFile(dir+'/receipt.json',JSON.stringify({createdAt:new Date().toISOString(),complete:true,renderSourceHashes,domOnlyInputs,assetSourceHashes,stabilityChecked:true,errors,hmr,fixtureRoot:fixtureRoot||null,mapWidth:map.width*map.tilewidth,cameraBounds,arrivalSignal,mapSha256,source:'raw actual world canvas at rendered RAF, no DOM overlay pixels; no state injection; DOM-only inputs are hashed for exclusion evidence and session stability, not composited',sceneSha256,frames},null,2));
console.log(JSON.stringify({dir,count:frames.length}));
}catch(error){await writeFile(dir+'/capture-failure.json',JSON.stringify({complete:false,message:String(error),errors,hmr,completedFrames:frames.map(f=>f.filename)},null,2));throw error}
finally{await context.close();await browser.close()}
