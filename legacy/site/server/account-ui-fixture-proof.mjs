/** Actual current AccountPanel + HTTP/session/store, explicitly isolated identity fixtures. */
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {createWebsiteService} from './index.mjs';

const proof='D:/Dex/Automation/Proofs/dex-place/20260908-v2-services/account-ui-fixture';
const base='http://127.0.0.1:5188';
await mkdir(proof,{recursive:true});await mkdir(resolve(proof,'browser-temp'),{recursive:true});
process.env.TEMP=resolve(proof,'browser-temp');process.env.TMP=process.env.TEMP;
let requested,exchanges=0,passwordChanges=0,browser;
const result={scope:'Actual current browser UI and website HTTP/session/store with explicitly isolated identity fixtures. No real account, email, microphone or payment.',checks:[],errors:[],startedAt:new Date().toISOString()};
const check=(name,pass)=>{result.checks.push({name,pass});if(!pass)throw new Error(name);};
const identity={
 capabilities:async()=>({password:true,signup:true,confirmation:true,recovery:true,google:false,providerReady:true}),
 signUp:async(email,password,name,challenge,redirectTo)=>{requested={kind:'signup',redirectTo};return {};},
 recover:async(email,challenge,redirectTo)=>{requested={kind:'recover',redirectTo};return {};},
 exchange:async()=>{exchanges++;return {access_token:'isolated-access',refresh_token:'isolated-refresh',expires_in:3600};},
 verify:async()=>({id:'isolated-ui-user',email:'fixture@example.invalid'}),
 changePassword:async()=>{passwordChanges++;},
};
const dataRoot=await mkdtemp(resolve(proof,'data-'));
const service=await createWebsiteService({origin:base,dataRoot,identity,map:{worldRevision:'fixture',rooms:[]},voice:{ready:false},ownerIds:[]});
service.server.listen(0,'127.0.0.1');await once(service.server,'listening');
const api=`http://127.0.0.1:${service.server.address().port}`;
try{
 browser=await chromium.launch({executablePath:'C:/Users/sanic/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url());const reply=await route.fetch({url:api+url.pathname+url.search,maxRedirects:0});await route.fulfill({response:reply});});
 const panel=()=>page.locator('.account-page:visible').first();
 const state=()=>page.evaluate(async()=>{const d=await(await fetch('/api/account/session')).json();return {id:d.user?.id||null,recovery:!!d.recoverySession,owner:!!d.user?.owner};});
 await page.goto(base+'/account',{waitUntil:'domcontentloaded'});
 await panel().getByRole('button',{name:'Create account',exact:true}).first().click();
 await panel().getByLabel('Display name',{exact:true}).fill('Fixture visitor');
 await panel().getByLabel('Email',{exact:true}).fill('fixture@example.invalid');
 await panel().getByLabel('Password',{exact:true}).fill('isolated-fixture-password');
 await panel().locator('form').getByRole('button',{name:'Create account',exact:true}).click();
 await panel().getByText('Check your email to continue. No website session has been created.',{exact:true}).waitFor();
 check('signup-waits-for-confirmation-without-session',(await state()).id===null&&requested.kind==='signup');
 const signup=new URL(requested.redirectTo);signup.searchParams.set('code','fixture-code');
 await page.goto(signup.href,{waitUntil:'domcontentloaded'});
 await panel().getByLabel('Display name',{exact:true}).waitFor();
 check('verified-fixture-signup-keeps-chosen-display-name',await panel().getByLabel('Display name',{exact:true}).inputValue()==='Fixture visitor');
 check('verified-new-user-is-not-owner',!(await state()).owner);
 await panel().getByRole('button',{name:'Sign out',exact:true}).click();
 await panel().getByLabel('Password',{exact:true}).waitFor();
 await panel().getByRole('button',{name:'Forgot password',exact:true}).click();
 await panel().getByLabel('Email',{exact:true}).fill('fixture@example.invalid');
 await panel().getByRole('button',{name:'Send recovery link',exact:true}).click();
 await panel().getByText('If recovery is available for that address, an email will arrive shortly.',{exact:true}).waitFor();
 const canceled=new URL(requested.redirectTo);canceled.searchParams.set('code','fixture-code');
 await panel().getByRole('button',{name:'Cancel recovery',exact:true}).click();
 await panel().getByText('Recovery canceled. Your password was not changed.',{exact:true}).waitFor();
 check('pending-recovery-cancel-returns-to-signin',await panel().getByLabel('Password',{exact:true}).isVisible()&&(await state()).id===null);
 await page.goto(canceled.href,{waitUntil:'domcontentloaded'});
 await panel().getByText('This account link expired or belongs to another browser. Start again here.',{exact:true}).waitFor();
 check('canceled-link-cannot-create-session-or-exchange',exchanges===1&&(await state()).id===null);
 await panel().getByRole('button',{name:'Forgot password',exact:true}).click();await panel().getByLabel('Email',{exact:true}).fill('fixture@example.invalid');
 await panel().getByRole('button',{name:'Send recovery link',exact:true}).click();await panel().getByText('If recovery is available for that address, an email will arrive shortly.',{exact:true}).waitFor();
 const recovery=new URL(requested.redirectTo);recovery.searchParams.set('code','fixture-code');await page.goto(recovery.href,{waitUntil:'domcontentloaded'});
 await panel().getByLabel('New password',{exact:true}).waitFor();check('fixture-recovery-enters-empty-password-form',(await state()).recovery&&await panel().getByLabel('New password',{exact:true}).inputValue()==='');
 await panel().getByRole('button',{name:'Cancel recovery',exact:true}).click();await panel().getByLabel('Password',{exact:true}).waitFor();
 check('verified-recovery-cancel-ends-only-website-session',(await state()).id===null&&!(await state()).recovery&&passwordChanges===0);
 await page.reload({waitUntil:'domcontentloaded'});await panel().getByLabel('Password',{exact:true}).waitFor();check('cancel-remains-signed-out-after-reload',(await state()).id===null);
 result.status='pass';
}catch(error){result.status='fail';result.error=String(error.message).replace(/https?:\/\/\S+/g,'[fixture URL omitted]');}
finally{await browser?.close();await new Promise(resolve=>service.server.close(resolve));await service.close();result.completedAt=new Date().toISOString();result.browserClosed=true;result.serviceClosed=true;await writeFile(resolve(proof,'receipt.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify({status:result.status,passed:result.checks.filter(v=>v.pass).length,total:result.checks.length,error:result.error,proof},null,2));
