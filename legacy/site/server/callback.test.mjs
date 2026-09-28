import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {once} from 'node:events';
import {createWebsiteService} from './index.mjs';

test('isolated callback is browser-bound, single-use, carries chosen name, and fails into themed account',async t=>{
  let requested,exchanges=0;
  const identity={capabilities:async()=>({password:true,signup:true,confirmation:true,recovery:true,google:false,providerReady:true}),signUp:async(email,password,name,challenge,redirectTo)=>{requested={email,name,challenge,redirectTo};return {};},exchange:async(code,verifier)=>{assert.equal(code,'isolated-valid-code');assert.ok(verifier.length>=43);exchanges++;return {access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600};},verify:async()=>({id:'fixture-confirmed-user',email:'fixture@example.invalid'})};
  const dataRoot=await mkdtemp('D:/Dex/Projects/dex-place-world/runtime-v2-tests/callback-');
  const service=await createWebsiteService({identity,dataRoot,map:{worldRevision:'fixture',rooms:[]},origin:'http://127.0.0.1:5188'});service.server.listen(0,'127.0.0.1');await once(service.server,'listening');t.after(async()=>{await new Promise(resolve=>service.server.close(resolve));await service.close();});
  const base=`http://127.0.0.1:${service.server.address().port}`;let cookie='',csrf='';
  async function request(path,method='GET',body,withCookie=true){const response=await fetch(base+path,{method,redirect:'manual',headers:{origin:'http://127.0.0.1:5188',cookie:withCookie?cookie:'','content-type':'application/json','x-csrf-token':csrf},body:body===undefined?undefined:JSON.stringify(body)});if(withCookie&&response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=response.status===303?null:await response.json();if(data?.csrf)csrf=data.csrf;return {response,data};}
  await request('/api/account/session');const initial=cookie;
  const created=await request('/api/account/sign-up','POST',{email:'fixture@example.invalid',password:'isolated-fixture-password',displayName:'Chosen fixture name'});
  assert.equal(created.data.status,'confirmation-required');assert.equal((await request('/api/account/session')).data.user,null);
  const valid=new URL(requested.redirectTo);valid.searchParams.set('code','isolated-valid-code');
  const foreign=await request(valid.pathname+valid.search,'GET',undefined,false);assert.equal(foreign.response.status,303);assert.match(foreign.response.headers.get('location'),/authError=expired$/);assert.equal(exchanges,0);
  const wrong=await request('/api/account/callback?state=wrong&code=isolated-valid-code');assert.match(wrong.response.headers.get('location'),/authError=expired$/);assert.equal(exchanges,0);
  const confirmed=await request(valid.pathname+valid.search);assert.equal(confirmed.response.status,303);assert.equal(confirmed.response.headers.get('location'),'http://127.0.0.1:5188/account');assert.notEqual(cookie,initial);assert.equal(exchanges,1);
  const profile=(await request('/api/account/session')).data;assert.equal(profile.user.displayName,'Chosen fixture name');assert.equal(profile.user.owner,false);assert.ok(!JSON.stringify(profile).includes('fixture-access'));
  const replay=await request(valid.pathname+valid.search);assert.match(replay.response.headers.get('location'),/authError=expired$/);assert.equal(exchanges,1);
});
