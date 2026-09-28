/** Isolated protocol proof. No real account, user microphone, external endpoint or production data. */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium} from '@playwright/test';
import {AccessToken,RoomServiceClient,TrackSource} from 'livekit-server-sdk';

const exec=promisify(execFile),site=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite'))('esbuild');
const repairBinary=process.env.DEX_VOICE_REPAIR_BINARY;
const proof=repairBinary?'D:/Dex/Automation/Proofs/dex-place/20260908-v2-services/voice-repair/pilot':'D:/Dex/Automation/Proofs/dex-place/20260908-v2-services/voice-loopback';
const container='dex-place-voice-proof-20260908',image='livekit/livekit-server@sha256:e37d68f172556d02aa77968b9fc55ef481468c0315fa38e4fa6c56ce72e3a815';
const key=`fixture${randomBytes(10).toString('hex')}`,secret=randomBytes(36).toString('base64url');
const result={scope:'Actual local WebRTC/SFU protocol with two isolated synthetic-audio pages. No user microphone or cross-network/device claim.',serverVersion:'1.13.6',clientVersion:'2.22.1',serverSdk:'2.18.0',image,checks:[],browserErrors:0,cleanup:{}};
if(repairBinary)result.repairBinarySha256=createHash('sha256').update(await readFile(repairBinary)).digest('hex');
await mkdir(proof,{recursive:true});
const browserSource=`import {Room,RoomEvent,Track,LocalAudioTrack} from 'livekit-client';
const room=new Room();let oscillator,context,source,destination,replayTimer;let count=0,removed=0,replayAttempts=0;const tracks=new Map();
room.on(RoomEvent.TrackSubscribed,(track)=>{count++;const element=track.attach();element.muted=true;element.volume=0;document.body.append(element);void element.play();const ctx=new AudioContext();const input=ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));const analyser=ctx.createAnalyser();const silent=ctx.createGain();silent.gain.value=0;input.connect(analyser).connect(silent).connect(ctx.destination);void ctx.resume();tracks.set(track.sid,{track,ctx,input,analyser,element});});
room.on(RoomEvent.TrackUnsubscribed,track=>{removed++;const entry=tracks.get(track.sid);if(entry){track.detach(entry.element);entry.element.remove();entry.input.disconnect();void entry.ctx.close();tracks.delete(track.sid);}});
window.pilot={connect:async(url,token)=>{await room.connect(url,token,{autoSubscribe:false});return {state:room.state};},publish:async()=>{context=new AudioContext();await context.resume();oscillator=context.createOscillator();oscillator.frequency.value=440;const gain=context.createGain();gain.gain.value=.03;destination=context.createMediaStreamDestination();oscillator.connect(gain).connect(destination);oscillator.start();source=new LocalAudioTrack(destination.stream.getAudioTracks()[0]);const pub=await room.localParticipant.publishTrack(source,{source:Track.Source.Microphone});return {sid:pub.trackSid};},subscribe:()=>{for(const p of room.remoteParticipants.values())for(const publication of p.trackPublications.values())publication.setSubscribed(true);},replay:enabled=>{if(enabled)replayTimer=setInterval(()=>{for(const p of room.remoteParticipants.values())for(const publication of p.trackPublications.values()){publication.setSubscribed(false);publication.setSubscribed(true);replayAttempts++;}},10);else clearInterval(replayTimer);return replayAttempts;},sample:async()=>{let peak=0,bytes=0,packets=0,audioEnergy=0,samplesDuration=0;const contexts=[];for(const value of tracks.values()){const data=new Float32Array(value.analyser.fftSize);value.analyser.getFloatTimeDomainData(data);for(const sample of data)peak=Math.max(peak,Math.abs(sample));const stats=await value.track.getReceiverStats();bytes+=stats?.bytesReceived||0;packets+=stats?.packetsReceived||0;audioEnergy+=stats?.totalAudioEnergy||0;samplesDuration+=stats?.totalSamplesDuration||0;contexts.push({state:value.ctx.state,enabled:value.track.mediaStreamTrack.enabled,muted:value.track.mediaStreamTrack.muted,readyState:value.track.mediaStreamTrack.readyState});}return {subscribed:tracks.size,events:count,removed,peak,bytes,packets,audioEnergy,samplesDuration,contexts,state:room.state};},close:async()=>{source?.stop();oscillator?.stop();await room.disconnect();await context?.close();for(const entry of tracks.values())await entry.ctx.close();}};`;
await build({stdin:{contents:browserSource,resolveDir:site,sourcefile:'voice-pilot-fixture.js'},bundle:true,format:'iife',platform:'browser',target:'es2022',outfile:resolve(proof,'pilot.js'),logLevel:'silent'});
const script=await readFile(resolve(proof,'pilot.js'));
const http=createServer((req,res)=>{res.setHeader('cache-control','no-store');if(req.url==='/pilot.js'){res.setHeader('content-type','application/javascript');res.end(script);}else{res.setHeader('content-type','text/html');res.end('<!doctype html><meta charset="utf-8"><title>Isolated voice protocol proof</title><h1>Voice protocol fixture</h1><p>Synthetic audio only. Loopback server.</p><script src="/pilot.js"></script>');}});
let browser,started=false;
try{
  await exec('docker',['inspect',container],{windowsHide:true}).then(()=>{throw new Error('A container with the proof name already exists.');},()=>{});
  const config=`port: 5340\nbind_addresses: [\"0.0.0.0\"]\nrtc:\n  tcp_port: 5341\n  udp_port: 5342\n  use_external_ip: false\n  node_ip: 127.0.0.1\nkeys:\n  ${key}: ${secret}\nlogging:\n  level: error\n`;
  const repairArgs=repairBinary?['--mount',`type=bind,source=${dirname(resolve(repairBinary))},target=/repair,readonly`,'--entrypoint','/repair/livekit-server']:[];
  await exec('docker',['run','--detach','--rm','--name',container,'--label','dex.proof=voice-loopback-20260908','--publish','127.0.0.1:5340:5340/tcp','--publish','127.0.0.1:5341:5341/tcp','--publish','127.0.0.1:5342:5342/udp','--env','LIVEKIT_CONFIG',...repairArgs,image],{windowsHide:true,env:{...process.env,LIVEKIT_CONFIG:config},timeout:20000});started=true;
  let ready=false;for(let attempt=0;attempt<20;attempt++){try{const response=await fetch('http://127.0.0.1:5340',{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break;}}catch{}await pause(500);}if(!ready)throw new Error('The loopback SFU did not become ready.');
  result.binding=JSON.parse((await exec('docker',['inspect',container,'--format','{{json .NetworkSettings.Ports}}'],{windowsHide:true})).stdout);
  http.listen(5196,'127.0.0.1');await once(http,'listening');
  const service=new RoomServiceClient('http://127.0.0.1:5340',key,secret),roomName='isolated-dex-voice-policy';await service.createRoom({name:roomName,maxParticipants:2,emptyTimeout:30});
  const token=async(identity,publish)=>{const token=new AccessToken(key,secret,{identity,ttl:'2m'});token.addGrant({roomJoin:true,room:roomName,canPublish:publish,canSubscribe:false,canPublishData:false,canPublishSources:[TrackSource.MICROPHONE]});return token.toJwt();};
  browser=await chromium.launch({executablePath:'C:/Users/sanic/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const context=await browser.newContext(),publisher=await context.newPage(),receiver=await context.newPage();
  for(const page of[publisher,receiver]){page.on('pageerror',()=>result.browserErrors++);await page.goto('http://127.0.0.1:5196');}
  await publisher.evaluate(async token=>window.pilot.connect('ws://127.0.0.1:5340',token),await token('fixture-publisher',true));
  const receiverToken=await token('fixture-receiver',false);
  await receiver.evaluate(async token=>window.pilot.connect('ws://127.0.0.1:5340',token),receiverToken);
  const publication=await publisher.evaluate(()=>window.pilot.publish());await pause(1000);
  let sample=await receiver.evaluate(()=>window.pilot.sample());result.checks.push({name:'initial-deny',pass:sample.subscribed===0,sample});
  await receiver.evaluate(()=>window.pilot.subscribe());await pause(1000);sample=await receiver.evaluate(()=>window.pilot.sample());result.checks.push({name:'client-cannot-self-subscribe',pass:sample.subscribed===0,sample});
  if(repairBinary){const response=await fetch('http://127.0.0.1:5340/twirp/livekit.RoomService/UpdateSubscriptions',{method:'POST',headers:{authorization:`Bearer ${receiverToken}`,'content-type':'application/json'},body:JSON.stringify({room:roomName,identity:'fixture-receiver',track_sids:[publication.sid],subscribe:true})});result.checks.push({name:'participant-token-cannot-call-admin-grant-rpc',pass:[401,403].includes(response.status),status:response.status});}
  await service.updateSubscriptions(roomName,'fixture-receiver',[publication.sid],true);
  let delivered=false;for(let i=0;i<16;i++){await pause(500);sample=await receiver.evaluate(()=>window.pilot.sample());if(sample.subscribed>0&&sample.bytes>0&&sample.peak>.001){delivered=true;break;}}
  result.checks.push({name:'admin-override-denied-client-receives-real-audio',pass:delivered,sample});
  if(delivered&&repairBinary){
    const extra=await publisher.evaluate(()=>window.pilot.publish());await receiver.evaluate(()=>window.pilot.subscribe());await pause(1000);sample=await receiver.evaluate(()=>window.pilot.sample());const publisherState=await service.getParticipant(roomName,'fixture-publisher');result.checks.push({name:'approved-track-does-not-grant-unapproved-second-track',pass:extra.sid!==publication.sid&&publisherState.tracks.length===2&&sample.subscribed===1,publishedDistinctTracks:publisherState.tracks.length,sample});
    await service.updateParticipant(roomName,'fixture-receiver',{permission:{canPublish:false,canSubscribe:false,canPublishData:false}});await pause(750);sample=await receiver.evaluate(()=>window.pilot.sample());const receiverState=await service.getParticipant(roomName,'fixture-receiver');result.checks.push({name:'unrelated-permission-update-preserves-only-admin-approved-track',pass:receiverState.permission.canSubscribe===false&&sample.subscribed===1&&sample.bytes>0&&sample.peak>.001,generalCanSubscribe:receiverState.permission.canSubscribe,sample});
  }
  if(!delivered){
    // Diagnostic positive control ONLY, never a production permission fallback.
    await service.updateParticipant(roomName,'fixture-receiver',{permission:{canSubscribe:true,canPublish:false,canPublishData:false}});await pause(500);await receiver.evaluate(()=>window.pilot.subscribe());
    for(let i=0;i<16;i++){await pause(500);sample=await receiver.evaluate(()=>window.pilot.sample());if(sample.bytes>0&&sample.peak>.001)break;}
    result.checks.push({name:'isolated-unrestricted-positive-control-transport-only',pass:sample.bytes>0&&sample.peak>.001,sample});
  }
  if(repairBinary){await receiver.evaluate(()=>window.pilot.replay(true));await pause(50);}
  await service.updateSubscriptions(roomName,'fixture-receiver',[publication.sid],false);await pause(1000);sample=await receiver.evaluate(()=>window.pilot.sample());result.checks.push({name:'server-revocation-removes-track',pass:sample.subscribed===0,sample});
  if(repairBinary){const attempts=await receiver.evaluate(()=>window.pilot.replay(false));await pause(500);sample=await receiver.evaluate(()=>window.pilot.sample());result.checks.push({name:'revocation-wins-concurrent-client-subscribe-requests',pass:attempts>5&&sample.subscribed===0&&sample.state==='connected',attempts,sample});}
  if(repairBinary){await receiver.evaluate(()=>window.pilot.subscribe());await pause(750);sample=await receiver.evaluate(()=>window.pilot.sample());result.checks.push({name:'client-cannot-replay-revoked-grant',pass:sample.subscribed===0,sample});}
  await service.removeParticipant(roomName,'fixture-receiver');await pause(300);sample=await receiver.evaluate(()=>window.pilot.sample());result.checks.push({name:'server-removal-disconnects',pass:sample.state==='disconnected',sample});
  result.policyResult=delivered&&result.checks.every(check=>check.pass)?'pass-local-protocol-only':delivered?'failed-admission-proofs':'failed-admin-subscription-override';
  await publisher.evaluate(()=>window.pilot.close());await receiver.evaluate(()=>window.pilot.close());
}catch(error){result.error=String(error.message).replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted]');result.policyResult='incomplete';}
finally{
  await browser?.close().catch(()=>{});result.cleanup.browserClosed=true;http.close();result.cleanup.httpClosed=true;
  if(started){try{const label=(await exec('docker',['inspect',container,'--format','{{ index .Config.Labels "dex.proof" }}'],{windowsHide:true})).stdout.trim();if(label!=='voice-loopback-20260908')throw new Error('Proof container identity changed; no stop issued.');await exec('docker',['stop','--time','3',container],{windowsHide:true,timeout:10000});result.cleanup.containerStopped=true;}catch(error){result.cleanup.error=error.message;}}
  await writeFile(resolve(proof,'protocol-receipt.json'),JSON.stringify({...result,completedAt:new Date().toISOString()},null,2));
}
console.log(JSON.stringify({policyResult:result.policyResult,checks:result.checks.map(({name,pass})=>({name,pass})),error:result.error,cleanup:result.cleanup,receipt:resolve(proof,'protocol-receipt.json')},null,2));
