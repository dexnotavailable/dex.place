import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentity} from './identity.mjs';

test('raw GoTrue resend keeps redirect query and PKCE challenge, not SDK options',async()=>{
  const calls=[];const identity=createIdentity({anonKey:'isolated-fixture-key',fetchImpl:async(url,options)=>{calls.push({url,options});return new Response('{}',{status:200,headers:{'content-type':'application/json'}});}});
  const callback='https://dex.place/api/account/callback?state=isolated-nonce',challenge='C'.repeat(43);
  await identity.resend('isolated@example.invalid',callback,challenge);
  assert.equal(calls.length,1);const url=new URL(calls[0].url),body=JSON.parse(calls[0].options.body);
  assert.equal(url.pathname,'/auth/v1/resend');assert.equal(url.searchParams.get('redirect_to'),callback);
  assert.equal(body.code_challenge,challenge);assert.equal(body.code_challenge_method,'s256');assert.equal(body.type,'signup');assert.equal(Object.hasOwn(body,'options'),false);
});
