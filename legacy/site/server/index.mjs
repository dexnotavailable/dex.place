import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, fail, person, audit } from './store.mjs';
import { createIdentity, pkce } from './identity.mjs';
import { treasuryRoute } from './treasury.mjs';
import { PresenceService } from './social.mjs';
import { createVoiceProvider } from './voice.mjs';
import { loadConfiguredVoice } from './livekit-config.mjs';
import { createKofiReceiver } from './kofi.mjs';
import * as v from './validation.mjs';

const siteRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const secret=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

export async function createWebsiteService(options={}) {
  const origin=options.origin||process.env.DEX_SITE_PUBLIC_ORIGIN||'http://127.0.0.1:5188';
  const originUrl=new URL(origin); const secure=originUrl.protocol==='https:';
  if(!secure&&!['127.0.0.1','localhost','[::1]'].includes(originUrl.hostname))throw new Error('Non-loopback service origins require HTTPS.');
  const allowedOrigins=new Set([origin,...(options.allowedOrigins||[])]);
  const trustCloudflareProxy=options.trustCloudflareProxy===true||process.env.DEX_SITE_TRUST_CLOUDFLARE_PROXY==='1';
  const cookieName=secure?'__Host-dex_session':'dex_site_local_session';
  const store=options.store||await openStore(options.dataRoot||process.env.DEX_SITE_DATA_ROOT||'D:/Dex/Projects/dex-place-world/runtime-v2',{forbiddenRoot:siteRoot});
  const identity=options.identity||createIdentity();
  const ownerIds=new Set(options.ownerIds||String(process.env.DEX_SITE_OWNER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
  const receiveKofi=createKofiReceiver(options.kofi||{verificationToken:process.env.DEX_SITE_KOFI_VERIFICATION_TOKEN,mode:process.env.DEX_SITE_KOFI_MODE||'quarantine'});
  const map=options.map||JSON.parse(await readFile(resolve(siteRoot,'public/world/rooms-v2.json'),'utf8'));
  const voiceConfig=options.voiceConfig||(process.env.DEX_SITE_LIVEKIT_CONFIG?await loadConfiguredVoice(process.env.DEX_SITE_LIVEKIT_CONFIG,process.env.DEX_SITE_LIVEKIT_MODE||'native'):{url:process.env.DEX_SITE_LIVEKIT_URL,apiKey:process.env.DEX_SITE_LIVEKIT_API_KEY,apiSecret:process.env.DEX_SITE_LIVEKIT_API_SECRET,mode:process.env.DEX_SITE_LIVEKIT_MODE||'native'});
  const voice=options.voice||await createVoiceProvider(voiceConfig);
  const presence=new PresenceService({store,rooms:map.rooms,revision:map.worldRevision||map.revision,voice,now:options.now||Date.now});voice?.bind?.(presence);
  const sessions=new Map(),rates=new Map(); const now=options.now||Date.now;
  const absoluteMs=12*3600000,idleMs=30*60000;
  const cookie=(res,value,maxAge=1800)=>res.setHeader('set-cookie',`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`);
  const projectUser=record=>{
    const p=person(store.read(),record.id);
    return {id:record.id,email:record.email||'',displayName:p.displayName||'',profileRevision:p.profileRevision,owner:ownerIds.has(record.id)};
  };
  function createSession(res, previous) {
    if(previous){sessions.delete(previous.key);presence.remove(previous.key);}
    if(sessions.size>=2048)fail(503,'session-capacity','The account service is at capacity. Try again shortly.');
    const value=secret(),key=hash(value),session={key,csrf:secret(),createdAt:now(),seenAt:now(),user:null,tokens:null,flow:null};sessions.set(key,session);cookie(res,value);return session;
  }
  async function authenticate(session,providerSession,res) {
    if(!providerSession?.access_token||!providerSession?.refresh_token)fail(502,'invalid-session','The identity service returned no usable session.');
    const verified=await identity.verify(providerSession.access_token);
    if(!verified?.id)fail(502,'invalid-session','Identity could not be verified.');
    v.id(verified.id,'Account');
    await store.transact(db=>{person(db,verified.id);});
    const next=createSession(res,session);next.user={id:verified.id,email:verified.email||''};next.tokens={access:providerSession.access_token,refresh:providerSession.refresh_token,expiresAt:now()+Math.max(60,Math.min(3600,providerSession.expires_in||3600))*1000};return next;
  }
  function ratelimit(key,limit,window=60000) {
    const entry=rates.get(key);if(!entry||now()-entry.at>window){rates.set(key,{at:now(),count:1});return;}if(++entry.count>limit)fail(429,'rate-limit','Please wait before trying again.');
  }
  async function readBody(req) {
    if(!String(req.headers['content-type']||'').startsWith('application/json'))fail(415,'content-type','Use JSON for this request.');
    let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>100000)fail(413,'body-too-large','This request is too large.');parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');}catch{fail(400,'invalid-json','The request is not valid JSON.');}
  }
  async function handler(req,res) {
    res.setHeader('cache-control','no-store');res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
    const send=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    let callbackRequest=false;
    try {
      const url=new URL(req.url,'http://localhost'),path=url.pathname,method=req.method;
      callbackRequest=path==='/api/account/callback'&&method==='GET';
      if(path==='/api/health'&&method==='GET')return send(200,{ok:true,service:'dex.place-services',version:1,identity:'shared-dex-account',voice:!!voice?.ready});
      if(!path.startsWith('/api/'))return send(404,{ok:false,code:'not-found',message:'Not found.'});
      const socketPeer=req.socket.remoteAddress||'unknown',forwardedPeer=req.headers['cf-connecting-ip'];
      const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(socketPeer);
      const peer=trustCloudflareProxy&&loopback&&typeof forwardedPeer==='string'&&isIP(forwardedPeer)?forwardedPeer:socketPeer;
      if(secure&&String(req.headers.host||'').toLowerCase().replace(/:443$/,'')!==originUrl.hostname.toLowerCase())fail(421,'host-mismatch','Use the canonical website origin.');
      if(path==='/api/webhooks/kofi'){
        if(method!=='POST'){res.setHeader('allow','POST');return send(405,{ok:false,code:'method-not-allowed'});}
        ratelimit(`kofi:${peer}`,120);
        if(!receiveKofi)fail(503,'receipt-unavailable','Ko-fi receipt intake is not connected.');
        return send(200,await receiveKofi(req,store));
      }
      const match=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${cookieName}=`));
      let session=match?sessions.get(hash(match.slice(cookieName.length+1))):null;
      if(session&&(now()-session.createdAt>absoluteMs||now()-session.seenAt>idleMs)){presence.remove(session.key);sessions.delete(session.key);session=null;}
      if(!session)session=createSession(res);session.seenAt=now();
      ratelimit(`api:${session.key}`,1200);if(!session.user)ratelimit(`anonymous:${peer}`,600);
      if(!['GET','HEAD'].includes(method)) {
        if(!allowedOrigins.has(String(req.headers.origin||''))||!equal(req.headers['x-csrf-token'],session.csrf))fail(403,'request-origin','This request is no longer valid. Reload the page and try again.');
      }
      const body=['POST','PATCH','PUT'].includes(method)?await readBody(req):{};
      if(session.user&&session.tokens&&session.tokens.expiresAt-now()<60000) {
        try {if(!session.refreshing)session.refreshing=(async()=>{const refreshed=await identity.refresh(session.tokens.refresh);const verified=await identity.verify(refreshed.access_token);if(verified.id!==session.user.id)fail(401,'session-expired','Sign in again.');session.tokens={access:refreshed.access_token,refresh:refreshed.refresh_token,expiresAt:now()+Math.min(3600,refreshed.expires_in||3600)*1000};})().finally(()=>{session.refreshing=null;});await session.refreshing;}
        catch {presence.remove(session.key);sessions.delete(session.key);cookie(res,'',0);fail(401,'session-expired','Your website session expired. Local progress is retained.');}
      }
      let user=session.user?projectUser(session.user):null;
      const requireUser=()=>{if(!user)fail(401,'sign-in-required','Sign in to your dex account.');};
      const requireOwner=()=>{requireUser();if(!ownerIds.has(user.id))fail(403,'owner-required','This action requires the verified site owner.');};
      if(path==='/api/account/session'&&method==='GET')return send(200,{user,csrf:session.csrf,capabilities:await identity.capabilities(),recoverySession:session.recovery===true});
      if(path==='/api/account/sign-in'&&method==='POST') {
        const email=v.email(body.email),password=v.password(body.password);ratelimit(`login:${peer}:${hash(email.toLowerCase())}`,6,600000);
        session=await authenticate(session,await identity.signIn(email,password),res);return send(200,{user:projectUser(session.user),csrf:session.csrf});
      }
      if(path==='/api/account/sign-out'&&method==='POST') {session=createSession(res,session);return send(200,{user:null,csrf:session.csrf});}
      if(['/api/account/sign-up','/api/account/recover','/api/account/resend','/api/account/oauth'].includes(path)&&method==='POST') {
        ratelimit(`mail:${peer}:${hash(String(body.email||'oauth').toLowerCase())}`,3,600000);const capabilities=await identity.capabilities(),flow=path.split('/').at(-1);
        if(flow==='sign-up'&&(!capabilities.signup||!capabilities.confirmation))fail(503,'signup-unavailable','Account creation is awaiting email service setup. Existing accounts can sign in.');
        if(flow==='recover'&&!capabilities.recovery)fail(503,'recovery-unavailable','Password recovery is awaiting email service setup.');
        if(flow==='resend'&&!capabilities.confirmation)fail(503,'confirmation-unavailable','Confirmation email is not available yet.');
        if(flow==='oauth'&&!capabilities.google)fail(503,'oauth-unavailable','Google sign-in is not available for this account service yet.');
        if(flow==='resend'){
          const address=v.email(body.email),pending=session.flow;
          if(!pending||pending.kind!=='sign-up'||pending.email!==address||now()-pending.at>15*60000)fail(400,'confirmation-start-required','Start account creation in this browser before resending its confirmation.');
          await identity.resend(address,`${origin}/api/account/callback?state=${pending.state}`,pending.challenge);return send(200,{status:'email-requested',message:'If confirmation is needed, an email will arrive shortly.'});
        }
        const challenge=pkce(),state=secret(),callback=`${origin}/api/account/callback?state=${state}`;
        session.flow={...challenge,state,kind:flow,at:now()};
        if(flow==='oauth')return send(200,{url:identity.oauthUrl(challenge.challenge,callback)});
        const address=v.email(body.email);
        session.flow.email=address;
        if(flow==='sign-up'){const displayName=v.text(body.displayName||'Visitor','Display name',32,2);session.flow.displayName=displayName;await identity.signUp(address,v.password(body.password,8),displayName,challenge.challenge,callback);return send(200,{status:'confirmation-required',message:'Check your email to continue. No website session has been created.'});}
        if(flow==='recover'){await identity.recover(address,challenge.challenge,callback);return send(200,{status:'email-requested',message:'If recovery is available for that address, an email will arrive shortly.'});}
        fail(404,'account-route','Account action not found.');
      }
      if(path==='/api/account/callback'&&method==='GET') {
        const flow=session.flow;
        if(!flow||now()-flow.at>15*60000||!equal(flow.state,url.searchParams.get('state')))fail(400,'login-link-expired','This sign-in link is expired or belongs to another browser. Start again from dex account.');
        session.flow=null;
        const providerSession=await identity.exchange(v.text(url.searchParams.get('code'),'Authorization code',2048),flow.verifier);
        session=await authenticate(session,providerSession,res);session.recovery=flow.kind==='recover';
        if(flow.kind==='sign-up'&&flow.displayName)await store.transact(db=>{const p=person(db,session.user.id);if(!p.displayName&&p.profileRevision===0){p.displayName=flow.displayName;p.profileRevision=1;}});
        res.statusCode=303;res.setHeader('location',`${origin}/account${session.recovery?'?recovery=1':''}`);return res.end();
      }
      if(path==='/api/account/password'&&method==='POST') {requireUser();if(!session.recovery)fail(403,'recovery-required','Use a fresh recovery link first.');await identity.changePassword(session.tokens.access,v.password(body.password,8));session=createSession(res,session);return send(200,{status:'password-saved',user:null,csrf:session.csrf});}
      if(path==='/api/account/profile'&&method==='POST') {requireUser();const displayName=v.text(body.displayName,'Display name',32,2);await store.transact(db=>{const p=person(db,user.id);if(p.profileRevision!==body.revision)fail(409,'revision-conflict','Your profile changed. Refresh before saving.');p.displayName=displayName;p.profileRevision++;});return send(200,{user:projectUser(session.user)});}
      if(path==='/api/progress'&&method==='GET') {requireUser();const p=person(store.read(),user.id);return send(200,{progress:p.progress,revision:p.progressRevision,provenance:'client-reported-exploration'});}
      if(['/api/progress','/api/progress/merge'].includes(path)&&method==='POST') {
        requireUser();ratelimit(`progress:${user.id}`,120);const incoming=v.progress(body.progress),eventId=v.id(body.eventId);
        const result=await store.transact(db=>{const p=person(db,user.id);if(p.applied.includes(eventId))return {progress:p.progress,revision:p.progressRevision,repeated:true};if(body.accountId!==user.id)fail(409,'account-changed','The destination account changed. Your local progress is retained.');if(body.revision!==p.progressRevision)fail(409,'revision-conflict','Your account progress changed. Refresh before saving.');
          if(path.endsWith('/merge')){if(!['account','guest'].includes(body.preference))fail(400,'merge-choice','Choose which checkpoint/settings to retain.');const merged=v.mergeProgress(p.progress,incoming,body.preference);p.mergeReceipts.push({id:eventId,at:new Date(now()).toISOString(),source:incoming,destination:p.progress,preference:body.preference});p.mergeReceipts=p.mergeReceipts.slice(-10);p.progress=merged;}else p.progress=incoming;
          p.progressRevision++;p.applied=[...p.applied,eventId].slice(-500);return {progress:p.progress,revision:p.progressRevision,provenance:'client-reported-exploration'};});return send(200,result);
      }
      const ctx={path,method,body,store,user,owner:!!user?.owner,url,requireUser,requireOwner};
      if(path.startsWith('/api/treasury')){ratelimit(`treasury:${user?.id||peer}`,method==='GET'?120:20);const result=await treasuryRoute(ctx);if(result!==undefined)return send(200,result);}
      if(path.startsWith('/api/social')) {
        requireUser();
        if(path==='/api/social/pose'&&method==='POST')return send(200,presence.packet(session.key,user,body));
        if(path==='/api/social/leave'&&method==='POST'){presence.remove(session.key);return send(200,{ok:true});}
        if(path==='/api/social'&&method==='GET')return send(200,{...presence.snapshot(session.key),blocked:person(store.read(),user.id).blocks.map(id=>({id,alias:person(store.read(),id).displayName||'Visitor'}))});
        if(path==='/api/social/person'&&method==='POST'){await presence.preferences(user.id,v.text(body.action,'Action',12),v.id(body.accountId,'Person'));return send(200,{ok:true});}
        if(path==='/api/social/report'&&method==='POST'){ratelimit(`report:${user.id}`,5,3600000);const target=v.id(body.accountId,'Person'),reason=v.text(body.reason,'Reason',160);await store.transact(db=>{if(!db.users[target])fail(404,'person-missing','Person not found.');db.reports.push({id:secret(),reporter:user.id,accountId:target,reason,at:new Date(now()).toISOString(),roomId:presence.leases.get(session.key)?.roomId||null,status:'unreviewed'});});return send(200,{status:'received'});}
        if(path==='/api/social/admin'&&method==='GET'){requireOwner();const db=store.read();return send(200,{reports:db.reports,restrictions:db.restrictions});}
        if(path==='/api/social/admin'&&method==='POST'){requireOwner();const target=v.id(body.accountId,'Person'),reason=v.text(body.reason,'Reason',300);await store.transact(db=>{if(body.action==='lift'){const row=db.restrictions.find(item=>item.id===body.id&&item.accountId===target);if(!row)fail(404,'restriction-missing','Restriction not found.');row.liftedAt=new Date(now()).toISOString();}else{if(!['social','voice','remove'].includes(body.action))fail(400,'invalid-action','Unknown moderation action.');db.restrictions.push({id:secret(),accountId:target,kind:body.action==='remove'?'social':body.action,until:new Date(now()+(body.action==='remove'?60000:v.integer(body.minutes,'Minutes',1,10080)*60000)).toISOString(),reason,operator:user.id});}audit(db,user.id,`moderation:${body.action}`,target,{reason});});for(const [key,row]of presence.leases)if(row.userId===target)presence.remove(key);return send(200,{ok:true});}
      }
      if(path.startsWith('/api/voice')) {requireUser();if(!voice?.ready)fail(503,'voice-unavailable','Voice transport has not been connected yet. Nearby visitors can still be shown.');const result=await voice.route({path,method,body,session,user,presence,requireUser});if(result!==undefined)return send(200,result);}
      send(404,{ok:false,code:'not-found',message:'Not found.'});
    }catch(error){
      if(callbackRequest&&error.status!==421){const reason=error.code==='login-link-expired'?'expired':error.status>=500?'unavailable':'invalid';res.statusCode=303;res.setHeader('location',`${origin}/account?authError=${reason}`);return res.end();}
      send(error.status||500,{ok:false,code:error.code||'service-error',message:error.status?error.message:'This request could not be completed. No success was recorded.'});
    }
  }
  const server=createServer(handler);server.requestTimeout=20000;server.headersTimeout=10000;
  const cleanup=setInterval(()=>{for(const [key,s]of sessions)if(now()-s.createdAt>absoluteMs||now()-s.seenAt>idleMs){presence.remove(key);sessions.delete(key);}for(const[key,r]of rates)if(now()-r.at>3600000)rates.delete(key);presence.cleanup();},5000);cleanup.unref();
  let closing;
  const close=()=>closing||=(async()=>{clearInterval(cleanup);presence.leases.clear();sessions.clear();await voice?.close?.();})();
  server.on('close',()=>{void close().catch(()=>{});});
  return {server,store,presence,handler,close};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {server,close}=await createWebsiteService();
  server.listen(Number(process.env.DEX_SITE_API_PORT||5191),'127.0.0.1',()=>console.log('dex.place services ready on loopback. No provider credentials are logged.'));
  let stopping=false;const stop=()=>{if(stopping)return;stopping=true;server.close(()=>{void close().then(()=>process.exit(0),()=>process.exit(1));});};process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
