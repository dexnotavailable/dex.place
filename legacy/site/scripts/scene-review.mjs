import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(require.resolve('playwright',{paths:[require.resolve('@playwright/test')]}));
const browser=await chromium.connectOverCDP(process.argv[2]);
const context=browser.contexts()[0];
const page=context.pages()[0]||await context.newPage();
await page.setViewportSize({width:1440,height:900});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const dir=process.argv[3]||'D:/Dex/Automation/Proofs/dex-place/20260906-build/layered-scene-v1';await mkdir(dir,{recursive:true});
await page.goto('http://127.0.0.1:5188/');
await page.getByRole('button',{name:'Enter world',exact:true}).waitFor();
await page.waitForTimeout(950);
await page.screenshot({path:dir+'/arrival.png'});
await page.getByRole('button',{name:'Enter world',exact:true}).click();
await page.waitForTimeout(150);
const frames=[];
for(const label of ['Downloads','Documentation','Illustrations','Donate']) {
  await page.getByRole('link',{name:label,exact:true}).first().click();
  const close=page.getByRole('button',{name:label==='Donate'?'Close donate to dex':`Close ${label}`,exact:true});
  await close.waitFor();await close.click();await page.waitForTimeout(500);
  const enter=page.getByRole('button',{name:'Enter world',exact:true});if(await enter.isVisible())await enter.click();
  frames.push({label,snapshot:await page.evaluate(()=>window.__dexWorld.snapshot())});
  await page.screenshot({path:dir+'/'+label.toLowerCase()+'.png'});
}
await writeFile(dir+'/frames.json',JSON.stringify({frames,errors},null,2));
console.log(JSON.stringify({dir,errors,frames:frames.map(f=>({label:f.label,player:f.snapshot.player,camera:f.snapshot.camera}))}));
await browser.close();
