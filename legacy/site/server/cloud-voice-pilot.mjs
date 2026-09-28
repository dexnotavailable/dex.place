/** Actual approved Cloud project, two synthetic clients; no microphone or recording. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium} from '@playwright/test';
import {RoomServiceClient,AccessToken,TrackSource} from 'livekit-server-sdk';
import {loadConfiguredVoice} from './livekit-config.mjs';

const config=await loadConfiguredVoice();
const api=new RoomServiceClient(config.url.replace('wss:','https:'),config.apiKey,config.apiSecret);
const proof='D:/Dex/Automation/Proofs/dex-place/20260908-v2-services/voice-cloud';await mkdir(proof,{recursive:true});
const script=await readFile('D:/Dex/Automation/Proofs/dex-place/20260908-v2-services/voice-repair/pilot/pilot.js');
const http=createServer((req,res)=>{res.setHeader('cache-control','no-store');if(req.url==='/pilot.js'){res.setHeader('content-type','application/javascript');res.end(script);}else{res.setHeader('content-type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>Private Cloud voice protocol fixture</title><h1>Synthetic audio fixture</h1><script src="/pilot.js"></script>');}});
const prefix=`dex-proof-${randomUUID()}`,rooms=[],result={scope:'Actual LiveKit Cloud SDK/media proof; two synthetic clients on one Windows machine. No real user microphone, recording, or physical/cross-network device acceptance.',projectId:'p_2zea1z3fqmh',url:config.url,client:'2.22.1',sdk:'2.18.0',checks:[],cleanup:{},mode:null};
let browser;
const record=(name,pass,extra={})=>result.checks.push({name,pass,...extra});
const createRoom=async suffix=>{const name=`${prefix}-${suffix}`;await api.createRoom({name,maxParticipants:4,emptyTimeout:30,departureTimeout:10});rooms.push(name);return name;};
const grant=async(room,identity,publish,subscribe)=>{const token=new AccessToken(config.apiKey,config.apiSecret,{identity,name:'Isolated fixture',ttl:'2m'});token.addGrant({roomJoin:true,room,canPublish:publish,canSubscribe:subscribe,canPublishData:false,canPublishSources:[TrackSource.MICROPHONE]});return token.toJwt();};
async function pages(roomA,roomB,canSubscribe){const context=await browser.newContext();const a=await context.newPage(),b=await context.newPage();for(const page of[a,b])await page.goto('http://127.0.0.1:5196');await a.evaluate(([url,token])=>window.pilot.connect(url,token),[config.url,await grant(roomA,'fixture-publisher',true,false)]);await b.evaluate(([url,token])=>window.pilot.connect(url,token),[config.url,await grant(roomB,'fixture-listener',false,canSubscribe)]);return {context,a,b};}
async function waitAudio(page,expected){let sample;for(let i=0;i<20;i++){await pause(350);sample=await page.evaluate(()=>window.pilot.sample());if(sample.subscribed===expected&&(expected===0||sample.bytes>0&&sample.peak>.001))break;}return sample;}
try{
  http.listen(5196,'127.0.0.1');await once(http,'listening');
  browser=await chromium.launch({executablePath:'C:/Users/sanic/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  const room=await createRoom('native');const native=await pages(room,room,false);
  const publication=await native.a.evaluate(()=>window.pilot.publish());await pause(700);await native.b.evaluate(()=>window.pilot.subscribe());let sample=await waitAudio(native.b,0);record('native-client-cannot-self-subscribe',sample.subscribed===0,{sample});
  await api.updateSubscriptions(room,'fixture-listener',[publication.sid],true);sample=await waitAudio(native.b,1);const nativeWorks=sample.subscribed===1&&sample.bytes>0&&sample.peak>.001;record('native-admin-authorized-audio',nativeWorks,{sample});
  if(nativeWorks){const extra=await native.a.evaluate(()=>window.pilot.publish());await native.b.evaluate(()=>window.pilot.subscribe());await pause(700);sample=await native.b.evaluate(()=>window.pilot.sample());record('native-grant-does-not-authorize-other-track',extra.sid!==publication.sid&&sample.subscribed===1,{sample});await api.updateSubscriptions(room,'fixture-listener',[publication.sid],false);sample=await waitAudio(native.b,0);record('native-server-revocation',sample.subscribed===0,{sample});await native.b.evaluate(()=>window.pilot.subscribe());await pause(700);sample=await native.b.evaluate(()=>window.pilot.sample());record('native-revoked-client-replay-denied',sample.subscribed===0,{sample});result.mode='native';}
  await native.context.close();
  if(!nativeWorks){
    const sourceRoom=await createRoom('source-private'),listenerRoom=await createRoom('listener-private');const forwarded=await pages(sourceRoom,listenerRoom,true);
    const sourceTrack=await forwarded.a.evaluate(()=>window.pilot.publish());await pause(500);await forwarded.b.evaluate(()=>window.pilot.subscribe());sample=await waitAudio(forwarded.b,0);record('private-listener-room-starts-with-no-audio',sample.subscribed===0,{sample});
    const wrongToken=await grant(listenerRoom,'fixture-listener',false,true);const denied=await fetch(config.url.replace('wss:','https:')+'/twirp/livekit.RoomService/ForwardParticipant',{method:'POST',headers:{authorization:`Bearer ${wrongToken}`,'content-type':'application/json'},body:JSON.stringify({room:sourceRoom,identity:'fixture-publisher',destination_room:listenerRoom})});record('listener-token-cannot-forward-anyone',denied.status===401||denied.status===403,{status:denied.status});
    await api.forwardParticipant(sourceRoom,'fixture-publisher',listenerRoom);await pause(600);await forwarded.b.evaluate(()=>window.pilot.subscribe());sample=await waitAudio(forwarded.b,1);record('server-forwarded-audio-is-decoded',sample.subscribed===1&&sample.bytes>0&&sample.peak>.001,{sample});
    const remote=await api.getParticipant(listenerRoom,'fixture-publisher');record('forwarded-identity-matches-source',remote.identity==='fixture-publisher'&&remote.tracks.some(track=>track.sid===sourceTrack.sid),{kind:remote.kind});
    await api.removeParticipant(listenerRoom,'fixture-publisher');sample=await waitAudio(forwarded.b,0);record('removing-forwarded-instance-revokes-audio',sample.subscribed===0,{sample});
    await forwarded.b.evaluate(()=>window.pilot.subscribe());await pause(500);sample=await forwarded.b.evaluate(()=>window.pilot.sample());record('removed-forward-cannot-be-reacquired-by-listener',sample.subscribed===0,{sample});
    const source=await api.getParticipant(sourceRoom,'fixture-publisher');record('revocation-preserves-original-publisher',source.tracks.length===1);
    await forwarded.context.close();result.mode='forwarded';
  }
}catch(error){result.error=String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted]');}
finally{
  await browser?.close().catch(()=>{});http.close();result.cleanup.browserClosed=true;result.cleanup.fixtureHttpClosed=true;
  result.cleanup.rooms=[];for(const room of rooms){try{await api.deleteRoom(room);result.cleanup.rooms.push({room,deleted:true});}catch{result.cleanup.rooms.push({room,deleted:false});}}
  result.completedAt=new Date().toISOString();await writeFile(resolve(proof,'cloud-protocol-receipt.json'),JSON.stringify(result,null,2));
}
console.log(JSON.stringify({mode:result.mode,checks:result.checks.map(({name,pass})=>({name,pass})),error:result.error,cleanup:result.cleanup,receipt:resolve(proof,'cloud-protocol-receipt.json')},null,2));
