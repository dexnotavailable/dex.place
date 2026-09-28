import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceProvider} from './voice.mjs';

test('Cloud voice reserves concurrent joins, leaving ghosts independent',async()=>{
  const pending=[],created=[],deleted=[];
  const apiClient={createRoom:options=>new Promise(resolve=>{created.push(options);pending.push(resolve);}),deleteRoom:async name=>{deleted.push(name);}};
  const voice=await createVoiceProvider({url:'wss://capacity.fixture.invalid',apiKey:'isolated-fixture-key',apiSecret:'isolated-fixture-secret-never-production',mode:'cloud',apiClient});
  const leases=new Map();for(let i=0;i<17;i++)leases.set(`s${i}`,{id:`lease-${i}`,userId:`user-${i}`,alias:'Fixture',worldRevision:'fixture-v1',roomId:'arrival',geometryKey:'fixture:arrival',seenAt:Date.now(),activityAt:Date.now()});
  const presence={leases,restrictions:()=>false};
  const join=i=>voice.route({path:'/api/voice/join',method:'POST',body:{},session:{key:`s${i}`},user:{id:`user-${i}`},presence});
  const first=Array.from({length:16},(_,i)=>join(i));
  assert.equal(voice.capacity().reserved,16);assert.equal(created.length,16);
  await assert.rejects(join(16),error=>error.status===429&&error.code==='voice-capacity');
  assert.equal(leases.size,17,'Voice capacity must not remove social leases');
  const duplicate=join(0);assert.equal(created.length,16,'Duplicate join cannot create another private room');
  pending.splice(0).forEach(resolve=>resolve({}));await Promise.all([...first,duplicate]);
  assert.equal(voice.inspect().length,16);assert.equal(voice.capacity().reserved,0);
  assert.ok(created.every(room=>room.maxParticipants===5));
  assert.equal(16*5,80,'Conservative participant-instance ceiling, not a billing claim');
  await voice.remove('lease-0');const replacement=join(16);pending.splice(0).forEach(resolve=>resolve({}));await replacement;
  assert.equal(voice.inspect().length,16);assert.equal(leases.size,17);
  await voice.close();assert.equal(voice.inspect().length,0);assert.equal(deleted.length,17);
});
