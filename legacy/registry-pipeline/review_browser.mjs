import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire('D:/Dex/Projects/dex-place-world/site/package.json');
const {chromium}=require(require.resolve('playwright',{paths:[require.resolve('@playwright/test')]}));
const out='D:/Dex/Automation/Proofs/dex-place/registry-20260913-root-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/sanic/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe',args:['--mute-audio']});
const rows=[];
async function capture(room,viewport={width:1600,height:900},mobile=false){
 const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({room})=>{localStorage.setItem('dex.registry.guest.v1',JSON.stringify({version:'registry-1',checkpoint:room,rooms:['arrival',room],courtyard:false,acknowledged:false,cuts:['map'],art:[],wins:0}));localStorage.setItem('dex.registry.preferences.v1',JSON.stringify({sound:false,reduced:true}))},{room});
 await page.goto('http://127.0.0.1:5194/registry.html');await page.getByRole('button',{name:'Enter',exact:true}).click({timeout:30000});await page.waitForTimeout(900);
 const suffix=room+'-'+viewport.width;
 const before=await page.evaluate(()=>__registry.snapshot());await page.screenshot({path:out+'/'+suffix+'-room.png'});
 const target=await page.evaluate(async room=>{const {ROOMS}=await import('/src/worldsite/registry/rooms.ts');return ROOMS[room].props.find(p=>room==='registry'?p.kind==='npc':room==='junction'?p.kind==='map':room==='archive'?p.kind==='docs':p.kind==='catalogue')?.x},room);
 if(target&&viewport.width===1600){
  const key=target>before.player.x?'d':'a';await page.keyboard.down(key);
  await page.waitForFunction(({target,key})=>{const p=__registry.snapshot().player;return key==='d'?p.x>=target:p.x<=target},{target,key},{timeout:15000});await page.keyboard.up(key);await page.waitForTimeout(100);await page.keyboard.press('e');
  await page.getByRole('dialog').waitFor({timeout:5000});await page.screenshot({path:out+'/'+suffix+'-panel.png'});
 }
 if(viewport.width<1600){await page.getByRole('button',{name:'Pause menu',exact:true}).tap();await page.getByRole('button',{name:'Settings',exact:true}).tap();await page.screenshot({path:out+'/'+suffix+'-settings.png'});}
 rows.push({room,viewport,seededVisualReview:true,snapshot:await page.evaluate(()=>__registry.snapshot()),errors});await page.close();
}
try{for(const room of ['registry','junction','archive','exhibit','pool','sky-walk','courtyard'])await capture(room);await capture('registry',{width:390,height:844},true);await capture('exhibit',{width:1024,height:768},true);}catch(e){rows.push({error:String(e.stack||e)});console.error(String(e));process.exitCode=1}finally{await fs.writeFile(out+'/review.json',JSON.stringify({scope:'Independent root visual review of actual textures and native panel input. Saved-room seeds are for camera inspection, not route completion proof.',rows},null,2));await browser.close();console.log(out);}
