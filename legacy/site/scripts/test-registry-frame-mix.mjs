import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(require.resolve('playwright',{paths:[require.resolve('@playwright/test')]}));
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/sanic/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe'}),page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/__registry-frame-mix',route=>route.fulfill({contentType:'text/html',body:`<html><body style="margin:0"><div id="game"></div><script type="module">
import Phaser from '/node_modules/.vite/deps/phaser.js';
import {FrameMixPipeline} from '/src/worldsite/registry/FrameMixPipeline.ts';
new Phaser.Game({type:Phaser.WEBGL,width:32,height:32,parent:'game',transparent:true,banner:false,render:{antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true},scene:{create(){
 this.game.renderer.pipelines.add('Mix',new FrameMixPipeline(this.game));const c=document.createElement('canvas');c.width=32;c.height=16;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,16,16);x.fillStyle='#0000ff';x.fillRect(16,0,16,16);this.textures.addSpriteSheet('opaque',c,{frameWidth:16,frameHeight:16});this.add.sprite(16,16,'opaque',0).setPipeline('Mix',{nextFrame:1,frameMix:.5});this.time.delayedCall(180,()=>this.game.renderer.snapshotPixel(16,16,p=>{window.__mixResult={red:p.red,green:p.green,blue:p.blue,alpha:p.alpha}}));
}}});</script></body></html>`}));
try{await page.goto('http://127.0.0.1:5194/__registry-frame-mix');await page.waitForFunction(()=>window.__mixResult);const pixel=await page.evaluate(()=>__mixResult);assert.equal(pixel.alpha,255,'Midpoint must retain opaque alpha');assert(Math.abs(pixel.red-128)<=1&&Math.abs(pixel.blue-128)<=1,'Midpoint colour is the real two-frame mix');assert.equal(errors.length,0);const out='D:/Dex/Automation/Proofs/dex-place/registry-20260913-runtime/frame-mix.json';await fs.writeFile(out,JSON.stringify({scope:'Actual WebGL pipeline midpoint pixel on isolated opaque red/blue two-frame test texture; not game art.',pixel,errors},null,2));console.log(JSON.stringify({pass:true,pixel,out}));}finally{await browser.close()}
