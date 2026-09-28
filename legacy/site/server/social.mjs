import { randomUUID } from 'node:crypto';
import { fail, audit, person } from './store.mjs';
import * as v from './validation.mjs';
const clips = new Set(['idle','run','jump','fall','attack1','attack2','takeHit','hurt','death','dash']);

export class PresenceService {
  constructor({ store, rooms, revision, now = Date.now, voice = null }) { this.store=store;this.rooms=new Map(rooms.map(room=>[room.id,room]));this.revision=revision;this.now=now;this.voice=voice;this.leases=new Map(); }
  restrictions(accountId, kind, db=this.store.read()) {return db.restrictions.some(row=>row.accountId===accountId&&(row.kind===kind||row.kind==='social')&&!row.liftedAt&&Date.parse(row.until)>this.now());}
  remove(sessionId) {const old=this.leases.get(sessionId);this.leases.delete(sessionId);if(old)this.voice?.remove(old.id).catch(()=>{});}
  cleanup() {for(const [key,row] of this.leases){if(this.now()-row.seenAt>12000)this.remove(key);else if(this.now()-row.activityAt>=62000&&!row.dormant){row.dormant=true;this.voice?.remove(row.id).catch(()=>{});}}}
  compatible(a,b,db=this.store.read()) {
    if(a.userId===b.userId||a.roomId!==b.roomId||a.geometryKey!==b.geometryKey||a.worldRevision!==b.worldRevision)return false;
    const ua=person(db,a.userId),ub=person(db,b.userId);
    if(ua.blocks.includes(b.userId)||ub.blocks.includes(a.userId))return false;
    const support = key=>key?.startsWith('bridge.reservoir')?'bridge.reservoir':key?.startsWith('lift.gallery-return')?'lift.gallery-return':null;
    for(const actor of [a,b]){const dynamic=support(actor.supportKey);if(dynamic&&(!a.dynamicSupports?.[dynamic]||a.dynamicSupports[dynamic]!==b.dynamicSupports?.[dynamic]))return false;if(dynamic==='bridge.reservoir'&&a.dynamicSupports[dynamic]!=='settled')return false;if(dynamic==='lift.gallery-return'&&a.dynamicSupports[dynamic]==='locked')return false;}
    return true;
  }
  audience(lease) {
    this.cleanup();if(!lease)return [];
    const db=this.store.read();return [...this.leases.values()].filter(peer=>this.now()-peer.activityAt<62000&&this.compatible(lease,peer,db)&&!this.restrictions(peer.userId,'social',db)).sort((a,b)=>Math.hypot(a.x-lease.x,a.y-lease.y)-Math.hypot(b.x-lease.x,b.y-lease.y)||a.id.localeCompare(b.id)).slice(0,8);
  }
  packet(sessionId,user,input) {
    this.cleanup();if(this.restrictions(user.id,'social'))fail(403,'social-restricted','Social access is temporarily restricted.');
    if(input.active!==true){this.remove(sessionId);return {peers:[],idle:false,capacity:false,voiceAvailable:!!this.voice?.ready};}
    const room=this.rooms.get(input.roomId);if(!room||input.worldRevision!==this.revision||input.geometryKey!==room.geometryKey)fail(409,'world-version','Nearby visitors need a compatible world version.');
    const dynamicSupports={};
    if(input.dynamicSupports){v.exactKeys(input.dynamicSupports,room.id==='reservoir'?['bridge.reservoir']:room.id==='return-shaft'?['lift.gallery-return']:[]);for(const[key,state]of Object.entries(input.dynamicSupports)){if(key==='bridge.reservoir'&&!['held','lowering','settled'].includes(state))fail(400,'invalid-support','Bridge state is invalid.');if(key==='lift.gallery-return'&&!['locked','lower','upper'].includes(state)){if(typeof state!=='string'||!/^moving:\d+$/.test(state)||Number(state.split(':')[1])<1040||Number(state.split(':')[1])>1500)fail(400,'invalid-support','Lift state is invalid.');}dynamicSupports[key]=state;}}
    for(const key of ['x','y'])if(!Number.isFinite(input[key]))fail(400,'invalid-pose','Position is invalid.');
    if(input.x<room.x-64||input.x>room.x+room.width+64||input.y<room.y-128||input.y>room.y+room.height+128)fail(400,'invalid-pose','Position is outside this room.');
    const seq=v.integer(input.sequence,'Pose sequence',0),frame=v.integer(input.frame,'Animation frame',0,32);
    if(!clips.has(input.clip)||![1,-1].includes(input.facing))fail(400,'invalid-pose','Pose is not supported.');
    const now=this.now(),prior=this.leases.get(sessionId);
    if(prior&&seq<=prior.sequence)fail(409,'stale-pose','An older pose was ignored.');
    if(prior&&now-prior.seenAt<65)fail(429,'pose-rate','Pose updates are too frequent.');
    const distance=prior&&prior.roomId===room.id?Math.hypot(input.x-prior.x,input.y-prior.y):0;
    if(prior&&prior.roomId===room.id&&distance>Math.max(160,(now-prior.seenAt)*1.4))fail(400,'implausible-pose','Movement update is out of range.');
    for(const [key,row] of this.leases)if(key!==sessionId&&row.userId===user.id)this.remove(key);
    if(!prior&&this.leases.size>=128)fail(503,'social-capacity','Nearby visitors are at capacity. Try again later.');
    const activity=!!(input.moving||input.meaningfulMovement)&&distance>=.5;
    const row={id:prior?.id||randomUUID(),userId:user.id,alias:user.displayName||'Visitor',roomId:room.id,worldRevision:this.revision,geometryKey:room.geometryKey,supportKey:input.supportKey?v.text(input.supportKey,'Support',160):'',dynamicSupports,x:input.x,y:input.y,facing:input.facing,clip:input.clip,frame,grounded:input.grounded===true,sequence:seq,seenAt:now,activityAt:activity?now:(prior?.activityAt||now),dormant:activity?false:prior?.dormant===true};
    this.leases.set(sessionId,row);return this.snapshot(sessionId);
  }
  snapshot(sessionId) {
    this.cleanup();const own=this.leases.get(sessionId),db=this.store.read(),preferences=own?person(db,own.userId):{mutes:[],blocks:[]},now=this.now();
    const peers=this.audience(own).map(row=>({id:row.id,accountId:row.userId,alias:row.alias,roomId:row.roomId,worldRevision:row.worldRevision,geometryKey:row.geometryKey,supportKey:row.supportKey,dynamicSupports:row.dynamicSupports,x:row.x,y:row.y,facing:row.facing,clip:row.clip,frame:row.frame,grounded:row.grounded,sequence:row.sequence,opacity:Math.max(0,Math.min(1,(62000-(now-row.activityAt))/2000)),muted:preferences.mutes.includes(row.userId),speaking:false,voiceEligible:now-row.activityAt<60000&&Math.hypot(row.x-own.x,row.y-own.y)<=360&&!preferences.mutes.includes(row.userId)}));
    return {peers,capacity:peers.length>=8,idle:!!own&&now-own.activityAt>=60000,voiceAvailable:!!this.voice?.ready};
  }
  async preferences(accountId,action,target) {
    if(target===accountId)fail(400,'invalid-person','Choose another person.');
    await this.store.transact(db=>{if(!db.users[target])fail(404,'person-missing','Person not found.');const row=person(db,accountId);const key=action==='mute'||action==='unmute'?'mutes':'blocks';if(!['mute','unmute','block','unblock'].includes(action))fail(400,'invalid-action','Unknown person action.');if(action==='mute'||action==='block')row[key]=[...new Set([...row[key],target])].slice(-300);else row[key]=row[key].filter(value=>value!==target);audit(db,accountId,action,target);});
    // Provider cleanup is mandatory when connected; a UI-only hide is insufficient.
    await this.voice?.refreshAudiences?.(this,true);
  }
}
