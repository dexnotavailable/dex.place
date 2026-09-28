import { createHash, randomUUID } from 'node:crypto';
import { fail } from './store.mjs';
import * as v from './validation.mjs';

/** Real SFU adapter. No automatic provisioning, recording or unrestricted subscription fallback. */
export async function createVoiceProvider({ url, apiKey, apiSecret, mode='native', now = Date.now, apiClient } = {}) {
  if(!url||!apiKey||!apiSecret)return null;
  if(mode==='cloud')mode='forwarded';
  const parsed=new URL(url);if(!['wss:','https:'].includes(parsed.protocol)&&!['127.0.0.1','localhost'].includes(parsed.hostname))throw new Error('Voice requires a secure remote endpoint.');
  const {AccessToken,RoomServiceClient,TrackSource}=await import('livekit-server-sdk');
  const apiUrl=url.replace(/^wss:/,'https:').replace(/^ws:/,'http:');
  const api=apiClient||new RoomServiceClient(apiUrl,apiKey,apiSecret);
  if(!['native','forwarded'].includes(mode))throw new Error('Unsupported voice topology.');
  const forwarded=mode==='forwarded',joined=new Map(),reserved=new Set(),pendingJoins=new Map();let polling=null;
  const roomName=lease=>`dex-place-${createHash('sha256').update(`${lease.worldRevision}:${lease.roomId}:${lease.geometryKey}${forwarded?':'+lease.id+':'+randomUUID():''}`).digest('hex').slice(0,24)}`;
  const permissions=canPublish=>({canPublish,canSubscribe:forwarded,canPublishData:false,canUpdateMetadata:false,canPublishSources:[TrackSource.MICROPHONE]});
  const ignoreMissing=error=>{if(error?.code!=='not_found'&&error?.status!==404)throw error;};
  const provider={
    ready:true,mode,
    async remove(id){const row=joined.get(id);if(!row)return;if(row.removal)return row.removal;row.removing=true;row.removal=(async()=>{if(forwarded)await api.deleteRoom(row.room).catch(ignoreMissing);else await api.removeParticipant(row.room,id).catch(ignoreMissing);joined.delete(id);for(const other of joined.values())other.forwarded.delete(id);})().finally(()=>{row.removal=null;});return row.removal;},
    async refreshAudiences(presence,urgent=false){
      if(polling){await polling;if(urgent)return provider.refreshAudiences(presence);return;}
      polling=(async()=>{
        const live=new Map([...presence.leases.values()].map(lease=>[lease.id,lease]));
        for(const[id,row]of joined){const lease=live.get(id);if(row.removing||!lease||now()-lease.activityAt>=60000||presence.restrictions(lease.userId,'voice')){await provider.remove(id);continue;}if(row.hold&& (now()-row.hold.startedAt>=60000||now()-row.hold.touchedAt>2500)){row.expiredHold=row.hold.id;row.hold=null;await api.updateParticipant(row.room,id,undefined,permissions(false));}}
        if(forwarded){
          const db=presence.store.read();
          for(const[id,row]of joined){
            const observer=live.get(id);if(!observer||row.removing)continue;
            const peers=presence.audience(observer).filter(peer=>now()-peer.activityAt<60000&&!presence.restrictions(peer.userId,'voice',db)&&Math.hypot(peer.x-observer.x,peer.y-observer.y)<=360&&!db.users[observer.userId]?.mutes.includes(peer.userId)&&joined.get(peer.id)?.hold&&!joined.get(peer.id)?.removing).slice(0,4);
            const desired=new Set(peers.map(peer=>peer.id));
            for(const sourceId of row.forwarded)if(!desired.has(sourceId)){await api.removeParticipant(row.room,sourceId).catch(ignoreMissing);row.forwarded.delete(sourceId);}
            for(const sourceId of desired)if(!row.forwarded.has(sourceId)){const source=joined.get(sourceId);if(!source)continue;try{await api.forwardParticipant(source.room,sourceId,row.room);row.forwarded.add(sourceId);}catch(error){ignoreMissing(error);}}
          }
          return;
        }
        const rooms=[...new Set([...joined.values()].map(row=>row.room))];
        for(const room of rooms){
          const participants=await api.listParticipants(room).catch(()=>[]);
          for(const[id,row]of joined){if(row.room!==room)continue;const observer=live.get(id);if(!observer)continue;
            const peers=presence.audience(observer).filter(peer=>now()-peer.activityAt<60000&&!presence.restrictions(peer.userId,'voice')&&Math.hypot(peer.x-observer.x,peer.y-observer.y)<=360&&!presence.store.read().users[observer.userId]?.mutes.includes(peer.userId));
            const allowed=new Set(peers.slice(0,4).map(peer=>peer.id));
            const all=participants.flatMap(p=>p.identity===id?[]:p.tracks.filter(track=>track.source===TrackSource.MICROPHONE).map(track=>({sid:track.sid,identity:p.identity})));
            const wanted=all.filter(track=>allowed.has(track.identity)).map(track=>track.sid).sort();
            const unwanted=all.filter(track=>!allowed.has(track.identity)).map(track=>track.sid).sort();
            const key=JSON.stringify([wanted,unwanted]);if(row.subscriptions===key)continue;
            if(unwanted.length)await api.updateSubscriptions(room,id,unwanted,false);
            if(wanted.length)await api.updateSubscriptions(room,id,wanted,true);
            row.subscriptions=key;
          }
        }
      })();try{await polling;}finally{polling=null;}
    },
    async route({path,method,body,session,user,presence}){
      if(method!=='POST')return undefined;
      const lease=presence.leases.get(session.key);
      if(path==='/api/voice/leave'){if(lease)await provider.remove(lease.id);return {ok:true};}
      if(!lease||now()-lease.seenAt>3000||presence.restrictions(user.id,'voice'))fail(403,'voice-ineligible','Enter the active compatible world before joining voice.');
      if(path==='/api/voice/join'){
        if(pendingJoins.has(lease.id))return pendingJoins.get(lease.id);
        const task=(async()=>{
          const occupied=new Set([...joined.keys(),...reserved]);
          if(!occupied.has(lease.id)&&occupied.size>=16)fail(429,'voice-capacity','Voice is full right now. Nearby visitors and the website remain available.');
          reserved.add(lease.id);let room;
          try{
            if(joined.has(lease.id))await provider.remove(lease.id);
            room=roomName(lease);await api.createRoom({name:room,maxParticipants:forwarded?5:9,emptyTimeout:60,departureTimeout:20});
            const current=presence.leases.get(session.key);if(current?.id!==lease.id)fail(409,'voice-ineligible','The world changed while voice was joining. Try again when ready.');
            const token=new AccessToken(apiKey,apiSecret,{identity:lease.id,name:lease.alias,ttl:'30s'});token.addGrant({roomJoin:true,room,canPublish:false,canSubscribe:forwarded,canPublishData:false,canUpdateOwnMetadata:false,canPublishSources:[TrackSource.MICROPHONE]});
            joined.set(lease.id,{room,userId:user.id,hold:null,expiredHold:null,subscriptions:'',forwarded:new Set(),removing:false});
            current.activityAt=now();current.dormant=false;
            return {url,token:await token.toJwt(),identity:lease.id,expiresIn:30,subscriptionPolicy:forwarded?'server-forwarded-private-room':'server-controlled'};
          }catch(error){if(room&&forwarded)await api.deleteRoom(room).catch(()=>{});throw error;}
          finally{reserved.delete(lease.id);}
        })().finally(()=>pendingJoins.delete(lease.id));
        pendingJoins.set(lease.id,task);return task;
      }
      if(path==='/api/voice/hold'){
        const row=joined.get(lease.id);if(!row||row.removing)fail(409,'voice-disconnected','Join voice again.');
        if(body.pressed!==true){row.hold=null;await api.updateParticipant(row.room,lease.id,undefined,permissions(false));return {ok:true};}
        const holdId=v.id(body.holdId,'Talk hold');
        if(row.expiredHold===holdId)fail(409,'hold-expired','Release and press again to talk.');
        if(!row.hold||row.hold.id!==holdId){row.hold={id:holdId,startedAt:now(),touchedAt:now()};await api.updateParticipant(row.room,lease.id,undefined,permissions(true));}else{if(now()-row.hold.startedAt>=60000){row.expiredHold=holdId;row.hold=null;await api.updateParticipant(row.room,lease.id,undefined,permissions(false));fail(409,'hold-expired','Release and press again to talk.');}row.hold.touchedAt=now();}
        const current=presence.leases.get(session.key);if(current?.id===lease.id){current.activityAt=now();current.dormant=false;}return {ok:true};
      }
      return undefined;
    },
    async close(){clearInterval(timer);await Promise.allSettled([...pendingJoins.values()]);await polling?.catch(()=>{});const ids=[...joined.keys()];for(let i=0;i<ids.length;i+=4)await Promise.all(ids.slice(i,i+4).map(id=>provider.remove(id)));},
    inspect:()=>[...joined].map(([id,row])=>({id,room:row.room,holding:!!row.hold,forwarded:[...row.forwarded],removing:row.removing})),
    capacity:()=>({limit:16,joined:joined.size,reserved:reserved.size,occupied:new Set([...joined.keys(),...reserved]).size}),
  };
  let boundPresence=null;provider.bind=presence=>{boundPresence=presence;};
  const timer=setInterval(()=>{if(boundPresence)void provider.refreshAudiences(boundPresence).catch(async()=>{for(const id of joined.keys())await provider.remove(id);});},500);timer.unref();
  return provider;
}
