import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import type {WorldProgress} from '../game/contracts';
import {accountRequest,loadAccountSession,readGuestProgress,readUnsyncedProgress,storeGuestProgress,privateProgressKey,eventId,AccountError,type AccountSession,type ProgressState,type Contribution,type DonationClaim,type TreasuryState} from './client';

interface AccountContextValue {session:AccountSession|null;status:'checking'|'ready'|'unavailable';message:string;progress:ProgressState|null;refresh:()=>Promise<void>;saveProgress:(snapshot:WorldProgress,id:string)=>Promise<void>;signOut:()=>Promise<void>}
const Context=createContext<AccountContextValue|null>(null);
export function useDexAccount(){const context=useContext(Context);if(!context)throw new Error('AccountProvider is required.');return context;}
export function AccountProvider({children}:{children:React.ReactNode}) {
  const [session,setSession]=useState<AccountSession|null>(null),[status,setStatus]=useState<AccountContextValue['status']>('checking'),[message,setMessage]=useState(''),[progress,setProgress]=useState<ProgressState|null>(null);
  const current=useRef<{session:AccountSession|null;progress:ProgressState|null;ready:boolean}>({session:null,progress:null,ready:false}),generation=useRef(0),queue=useRef<Promise<void>>(Promise.resolve());
  const held=useRef<{snapshot:WorldProgress;id:string;subject:string|null}|null>(null),writeRef=useRef<(snapshot:WorldProgress,id:string)=>Promise<void>>(async()=>{});
  const expire=useCallback(()=>{if(!current.current.session?.user&&!current.current.progress)return;generation.current++;current.current={session:null,progress:null,ready:false};setSession(null);setProgress(null);setStatus('unavailable');window.dispatchEvent(new Event('dex-account-signed-out'));},[]);
  useEffect(()=>{window.addEventListener('dex-account-invalidated',expire);return()=>window.removeEventListener('dex-account-invalidated',expire);},[expire]);
  const refresh=useCallback(async()=>{
    const turn=++generation.current;current.current.ready=false;setStatus('checking');
    try{
      const next=await loadAccountSession();if(turn!==generation.current)return;
      const changed=next.user?.id!==current.current.session?.user?.id;
      current.current.session=next;setSession(next);setMessage('');
      if(changed){setProgress(null);current.current.progress=null;window.dispatchEvent(new Event('dex-account-signed-out'));}
      if(next.user){const data=await accountRequest<ProgressState>('progress');if(turn!==generation.current)return;current.current.progress=data;setProgress(data);if(!data.progress&&readGuestProgress())setMessage('Your local world remains separate. Import it from Progress when you want to save it to this account.');}
      current.current.ready=true;setStatus('ready');
      const pending=held.current;held.current=null;
      if(pending&&pending.subject===(next.user?.id||null))void writeRef.current(pending.snapshot,pending.id);
    }catch(error){if(turn!==generation.current)return;if(error instanceof AccountError&&error.status===401)expire();else setStatus('unavailable');setMessage((error as Error).message);}
  },[expire]);
  useEffect(()=>{void refresh();return()=>{generation.current++;};},[refresh]);
  const saveProgress=useCallback((snapshot:WorldProgress,id:string)=>{
    const accountId=current.current.session?.user?.id;
    if(!current.current.ready){held.current={snapshot,id,subject:accountId||null};return Promise.resolve();}
    if(!accountId){if(!storeGuestProgress(snapshot))setMessage('Progress is available for this visit; browser storage is unavailable.');return Promise.resolve();}
    // A full snapshot from an existing guest world is never an implicit account import.
    if(!current.current.progress?.progress&&readGuestProgress()){storeGuestProgress(snapshot);setMessage('This local world remains separate until you choose Import local progress.');return Promise.resolve();}
    try{localStorage.setItem(privateProgressKey(accountId),JSON.stringify({snapshot,eventId:id}));}catch{setMessage('Your latest progress has not been saved on this device.');}
    const task=queue.current.then(async()=>{if(current.current.session?.user?.id!==accountId)return;try{const result=await accountRequest<ProgressState>('progress',{method:'POST',body:{accountId,eventId:id,revision:current.current.progress?.revision??0,progress:snapshot}});if(current.current.session?.user?.id!==accountId)return;current.current.progress=result;setProgress(result);setMessage('');try{const pending=JSON.parse(localStorage.getItem(privateProgressKey(accountId))||'null');if(pending?.eventId===id)localStorage.removeItem(privateProgressKey(accountId));}catch{/* preserve data if unreadable */}}catch(error){if(error instanceof AccountError&&error.status===401)expire();setMessage((error as Error).message);}});queue.current=task;return task;
  },[expire]);
  writeRef.current=saveProgress;
  const signOut=useCallback(async()=>{generation.current++;current.current={session:null,progress:null,ready:false};held.current=null;setSession(null);setProgress(null);setStatus('checking');window.dispatchEvent(new Event('dex-account-signed-out'));try{await accountRequest('account/sign-out',{method:'POST',body:{}});await refresh();}catch(error){setStatus('unavailable');setMessage('Website sign-out could not be confirmed. Capture is stopped; retry the account connection.');throw error;}},[refresh]);
  return <Context.Provider value={{session,status,message,progress,refresh,saveProgress,signOut}}>{children}</Context.Provider>;
}

const errorMessage=(error:unknown)=>(error as Error)?.message||'This request could not be completed.';
const displayAmount=(minor:number,currency:string)=>new Intl.NumberFormat(undefined,{style:'currency',currency}).format(minor/(['VND','JPY'].includes(currency)?1:100));
const minorAmount=(value:string,currency:string)=>Math.round(Number(value)*(['VND','JPY'].includes(currency)?1:100));
const contributionCurrencies=['VND','USD','EUR','GBP','AUD','CAD','JPY','BRL','SGD','THB','NZD'];
function Notice({children}:{children:React.ReactNode}){return children?<p className="account-notice" role="status" aria-live="polite">{children}</p>:null;}

export function AccountPanel({onClose}:{onClose?:()=>void}) {
  const account=useDexAccount(),[mode,setMode]=useState<'signin'|'signup'|'recover'|'profile'|'history'|'progress'>('signin'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[shown,setShown]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [linkError,setLinkError]=useState(()=>({expired:'This account link expired or belongs to another browser. Start again here.',invalid:'This account link could not be verified. Request a fresh link.',unavailable:'The account service could not complete that link. Try again shortly.'} as Record<string,string>)[new URLSearchParams(location.search).get('authError')||'']||'');
  const user=account.session?.user,caps=account.session?.capabilities;
  const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{setName(user?.displayName||'');setNotice('');setPassword('');},[user?.id]);
  async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setNotice('');setLinkError('');const clean=new URL(location.href);if(clean.searchParams.has('authError')){clean.searchParams.delete('authError');history.replaceState(history.state,'',clean.pathname+clean.search+clean.hash);}try{await action();}catch(error){if(alive.current)setNotice(errorMessage(error));}finally{if(alive.current){setBusy(false);setPassword('');}}}
  async function submit(event:React.FormEvent){event.preventDefault();await run(async()=>{
    if(account.session?.recoverySession){await accountRequest('account/password',{method:'POST',body:{password}});await account.refresh();setNotice('Password saved. Sign in with the new password.');return;}
    if(mode==='profile'){await accountRequest('account/profile',{method:'POST',body:{displayName:name,revision:user?.profileRevision}});await account.refresh();setNotice('Profile saved.');return;}
    const path=mode==='signup'?'sign-up':mode==='recover'?'recover':'sign-in';
    const result=await accountRequest<{message?:string}>(`account/${path}`,{method:'POST',body:{email,password,displayName:name}});
    await account.refresh();setNotice(result.message||'Signed in.');
  });}
  const recovery=account.session?.recoverySession;
  return <section className="dex-account account-page" aria-labelledby="account-title">
    <header><h2 id="account-title">dex account</h2>{onClose&&<button type="button" data-control="ACC-014" onClick={onClose}>Close</button>}</header>
    <Notice>{notice||linkError||account.message|| (account.status==='checking'?'Checking account…':'')}</Notice>
    {account.status==='unavailable'&&<button type="button" onClick={()=>void account.refresh()} data-control="ACC-021">Retry account</button>}
    {user&&!recovery?<>
      <p className="account-identity">{user.displayName||'Your account'} <span>{user.email}</span></p>
      <nav aria-label="Account"><button onClick={()=>setMode('profile')} data-control="ACC-015">Profile</button><button onClick={()=>setMode('progress')} data-control="ACC-018">Progress</button><button onClick={()=>setMode('history')} data-control="ACC-019">Donation history</button><button disabled={busy} onClick={()=>void run(account.signOut)} data-control="ACC-020">Sign out</button></nav>
      {mode==='profile'||mode==='signin'||mode==='signup'?<form onSubmit={submit}><label>Display name<input data-control="ACC-016" value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={32} required autoComplete="nickname"/></label><p>Your name is shown to nearby visitors. Donation aliases are chosen separately.</p><button data-control="ACC-017" disabled={busy||name.trim().length<2}>{busy?'Saving…':'Save profile'}</button></form>:null}
      {mode==='progress'&&<AccountProgressPanel key={`progress:${user.id}`}/>}
      {mode==='history'&&<HistoryPanel key={`history:${user.id}`}/>}
      {user.owner&&<OwnerPanel key={`owner:${user.id}`}/>}
    </>:<>
      {!recovery&&<nav aria-label="Account access"><button data-control="ACC-002" onClick={()=>setMode('signin')}>Sign in</button><button data-control="ACC-003" onClick={()=>setMode('signup')}>Create account</button></nav>}
      <form onSubmit={submit} aria-busy={busy}>
        {mode==='signup'&&!recovery&&<label>Display name<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={32} autoComplete="nickname" required/></label>}
        {!recovery&&<label>Email<input data-control="ACC-004" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required maxLength={254}/></label>}
        {(mode!=='recover'||recovery)&&<><label>{recovery?'New password':'Password'}<input data-control={recovery?'ACC-011':'ACC-005'} type={shown?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signup'||recovery?'new-password':'current-password'} minLength={mode==='signup'||recovery?8:1} maxLength={256} required/></label><button type="button" data-control="ACC-006" aria-pressed={shown} onClick={()=>setShown(!shown)}>{shown?'Hide password':'Show password'}</button></>}
        {mode==='signup'&&!caps?.confirmation&&<p>Account creation is awaiting email service setup. Existing accounts can sign in.</p>}
        {mode==='recover'&&!caps?.recovery&&<p>Password recovery is awaiting email service setup.</p>}
        <button data-control={recovery?'ACC-012':mode==='recover'?'ACC-010':'ACC-007'} disabled={busy||account.status==='checking'||(!recovery&&mode==='signup'&&!caps?.confirmation)||(!recovery&&mode==='recover'&&!caps?.recovery)}>{busy?'Please wait…':recovery?'Save new password':mode==='signup'?'Create account':mode==='recover'?'Send recovery link':'Sign in'}</button>
      </form>
      {(recovery||mode==='recover')&&<button type="button" data-control="ACC-014" disabled={busy} onClick={()=>void run(async()=>{await account.signOut();setMode('signin');setNotice('Recovery canceled. Your password was not changed.');onClose?.();})}>Cancel recovery</button>}
      {!recovery&&<><button data-control="ACC-009" onClick={()=>setMode('recover')}>Forgot password</button>{caps?.google&&<button data-control="ACC-008" disabled={busy} onClick={()=>void run(async()=>{const result=await accountRequest<{url:string}>('account/oauth',{method:'POST',body:{}});location.assign(result.url);})}>Continue with Google</button>}{caps?.confirmation&&<button data-control="ACC-013" disabled={busy||!email} onClick={()=>void run(async()=>{const result=await accountRequest<{message:string}>('account/resend',{method:'POST',body:{email}});setNotice(result.message);})}>Resend confirmation</button>}</>}
    </>}
  </section>;
}

function AccountProgressPanel(){
  const account=useDexAccount(),user=account.session?.user;
  const guest=readGuestProgress(),pending=readUnsyncedProgress(user?.id);
  const [draft,setDraft]=useState<{progress:WorldProgress;id:string;kind:'guest'|'unsynced'}|null>(null),[preference,setPreference]=useState<'account'|'guest'>('account'),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  if(!user)return null;
  return <div className="account-progress">
    <Notice>{notice}</Notice>
    <p>{account.progress?.progress?`${account.progress.progress.discoveredRooms.length} rooms remembered · ${account.progress.progress.cuts.length} cuts saved`:'No account exploration has been saved yet.'}</p>
    <p>Exploration persists. Each new visit to a world product menu still needs a fresh fight.</p>
    <button data-control="ACC-021" disabled={busy} onClick={()=>void account.refresh()}>Refresh account progress</button>
    {guest&&<><button data-control="ACC-022" onClick={()=>setDraft({progress:guest,id:eventId('guest-merge'),kind:'guest'})}>Import local progress</button><button data-control="ACC-023" onClick={()=>{setDraft(null);setNotice('Local progress remains separate.');}}>Keep local progress separate</button></>}
    {pending&&<><p>This device has unsynced exploration for this account.</p><button onClick={()=>setDraft({progress:pending,id:eventId('unsynced-merge'),kind:'unsynced'})}>Review unsynced progress</button></>}
    {draft&&<form onSubmit={async event=>{
      event.preventDefault();if(busy)return;setBusy(true);setNotice('');
      try{
        const result=await accountRequest<ProgressState>('progress/merge',{method:'POST',body:{accountId:user.id,revision:account.progress?.revision??0,eventId:draft.id,progress:draft.progress,preference}});
        await account.refresh();
        if(result.progress)window.dispatchEvent(new CustomEvent('dex-progress-imported',{detail:result.progress}));
        if(draft.kind==='unsynced')try{localStorage.removeItem(privateProgressKey(user.id));}catch{/* server merge already confirmed */}
        setDraft(null);setNotice('Exploration imported. The original source is retained in the merge record.');
      }catch(error){setNotice(errorMessage(error));}finally{setBusy(false);}
    }}>
      <p>Import {draft.progress.discoveredRooms.length} rooms and {draft.progress.cuts.length} cuts into {user.displayName||'this account'} ({user.email}). Compatible discoveries are combined.</p>
      <label>Checkpoint and settings<select value={preference} onChange={e=>setPreference(e.target.value as 'account'|'guest')}><option value="account">Keep account checkpoint and settings</option><option value="guest">Use local checkpoint and settings</option></select></label>
      <button data-control="ACC-024" disabled={busy}>Confirm progress import</button><button type="button" disabled={busy} onClick={()=>setDraft(null)}>Cancel import</button>
    </form>}
  </div>;
}

function HistoryPanel(){
  const [data,setData]=useState<{contributions:Contribution[];claims:DonationClaim[]}|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[claim,setClaim]=useState(false);
  const [source,setSource]=useState('mbbank'),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[amount,setAmount]=useState('100000'),[currency,setCurrency]=useState('VND'),[reference,setReference]=useState('');
  const claimEvent=useRef('');if(!claimEvent.current)claimEvent.current=eventId('claim');
  const load=useCallback(async()=>{try{setData(await accountRequest('treasury/history'));}catch(e){setNotice(errorMessage(e));}},[]);useEffect(()=>{void load();},[load]);
  return <div className="donation-history"><h3>Donation history</h3><Notice>{notice}</Notice>{!data?<button onClick={()=>void load()}>Retry history</button>:<>{data.contributions.length===0&&<p>No confirmed contributions are linked to this account.</p>}{data.contributions.map(row=><article key={row.id}><p>{displayAmount(row.amountMinor,row.currency)} · {row.source==='mbbank'?'MB Bank':'Ko-fi'} · {row.status}</p><VisibilityForm row={row} onSaved={load}/></article>)}{data.claims.map(row=><p key={row.id}>{displayAmount(row.amountMinor,row.currency)} · Claim {row.status}{row.reason?` — ${row.reason}`:''}</p>)}</>}
    <button data-control="TRE-005" onClick={()=>setClaim(!claim)}>Add to my history</button>{claim&&<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);try{await accountRequest('treasury/claims',{method:'POST',body:{eventId:claimEvent.current,source,receivedAt:new Date(date).toISOString(),amountMinor:minorAmount(amount,currency),currency,reference}});setNotice('Claim received for review. It does not confirm a payment.');claimEvent.current=eventId('claim');setClaim(false);await load();}catch(error){setNotice(errorMessage(error));}finally{setBusy(false);}}}>
      <label>Donation source<select data-control="TRE-006" value={source} onChange={e=>{setSource(e.target.value);if(e.target.value==='mbbank')setCurrency('VND');}}><option value="mbbank">MB Bank</option><option value="kofi">Ko-fi</option></select></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Amount<input type="number" min="1" step={currency==='VND'?'1':'.01'} value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label>Currency<select value={currency} onChange={e=>setCurrency(e.target.value)} disabled={source==='mbbank'}>{contributionCurrencies.map(item=><option key={item}>{item}</option>)}</select></label><label>Reference (if available)<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={180}/></label><p>Do not enter bank credentials or upload a statement. This claim stays private and pending until reviewed.</p><button data-control="TRE-008" disabled={busy}>Submit claim</button><button data-control="TRE-014" type="button" onClick={()=>setClaim(false)}>Cancel</button>
    </form>}
  </div>;
}
function VisibilityForm({row,onSaved}:{row:Contribution;onSaved:()=>Promise<void>}){
  const [value,setValue]=useState(row.visibility),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  return <form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await accountRequest('treasury/visibility',{method:'POST',body:{id:row.id,revision:row.revision,visibility:value}});await onSaved();setNotice('Visibility saved.');}catch(error){setNotice(errorMessage(error));}finally{setBusy(false);}}}><label><input data-control="TRE-009" type="checkbox" checked={value.listed} onChange={e=>setValue({...value,listed:e.target.checked})}/>Public listing</label><label>Public name (blank means Anonymous)<input data-control="TRE-010" value={value.alias} maxLength={32} onChange={e=>setValue({...value,alias:e.target.value})}/></label><label><input data-control="TRE-011" type="checkbox" checked={value.showAmount} onChange={e=>setValue({...value,showAmount:e.target.checked})}/>Show amount</label><button data-control="TRE-012" disabled={busy}>Save visibility</button><Notice>{notice}</Notice></form>;
}
export function TreasuryPanel({onBack}:{onBack?:()=>void}){
  const [data,setData]=useState<TreasuryState|null>(null),[currency,setCurrency]=useState('VND'),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);const turn=useRef(0);
  const load=useCallback(async(cursor='')=>{const request=++turn.current;setBusy(true);try{const next=await accountRequest<TreasuryState>(`treasury?currency=${currency}${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`);if(request!==turn.current)return;setData(prior=>cursor&&prior?{...next,rows:[...prior.rows,...next.rows.filter(row=>!prior.rows.some(old=>old.id===row.id))]}:next);setNotice('');}catch(error){if(request===turn.current)setNotice(errorMessage(error));}finally{if(request===turn.current)setBusy(false);}},[currency]);useEffect(()=>{setData(null);void load();return()=>{turn.current++;};},[load]);
  return <section className="treasury-page">
    <header><h2>Treasury</h2>{onBack&&<button data-control="TRE-004" onClick={onBack}>Back to Donate</button>}</header>
    <label>Currency<select data-control="TRE-002" value={currency} onChange={e=>setCurrency(e.target.value)}>{contributionCurrencies.map(item=><option key={item}>{item}</option>)}</select></label>
    <Notice>{notice||(busy&&!data?'Loading treasury…':'')}</Notice>
    {notice&&<button data-control="TRE-013" onClick={()=>void load()}>Retry treasury</button>}
    {data&&<>
      <p>Only confirmed contributions with public display enabled appear here.</p>
      {data.totals.map(total=><p key={total.currency}>{displayAmount(total.amountMinor,total.currency)} publicly shared</p>)}
      {data.rows.length===0?<p>No public confirmed contributions yet.</p>:<ol className="treasury-contributions">{data.rows.map(row=><li key={row.id}><span>{row.alias}</span><span>{row.amountMinor===null?'Private':displayAmount(row.amountMinor,row.currency)}</span><time dateTime={row.receivedAt}>{new Date(row.receivedAt).toLocaleDateString()}</time></li>)}</ol>}
      {data.ranks.length>0&&<><h3>Contributors</h3><ol>{data.ranks.map((row,index)=><li key={`${row.alias}:${index}`}>{row.alias} · {displayAmount(row.amountMinor,row.currency)}</li>)}</ol></>}
      {data.nextCursor&&<button data-control="TRE-003" disabled={busy} onClick={()=>void load(data.nextCursor!)}>More contributions</button>}
    </>}
  </section>;
}

export function OwnerPanel(){
  const account=useDexAccount(),[data,setData]=useState<any>(null),[moderation,setModeration]=useState<any>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState('');
  const load=useCallback(async()=>{try{const [a,b]=await Promise.all([accountRequest('treasury/admin'),accountRequest('social/admin')]);setData(a);setModeration(b);}catch(error){setNotice(errorMessage(error));}},[]);
  useEffect(()=>{if(account.session?.user?.owner)void load();},[account.session?.user?.owner,load]);
  if(!account.session?.user?.owner)return null;
  async function submit(event:React.FormEvent<HTMLFormElement>,path:string,extra:Record<string,unknown>={}){event.preventDefault();if(busy)return;const form=event.currentTarget,fields=Object.fromEntries(new FormData(form));setBusy(true);try{const body:Record<string,unknown>={...fields,...extra};for(const key of ['amountMinor','minutes'])if(key in body)body[key]=Number(body[key]);await accountRequest(path,{method:'POST',body});await load();setNotice('Review saved.');}catch(error){setNotice(errorMessage(error));}finally{setBusy(false);}}
  const row=data?.contributions.find((item:any)=>item.id===selected);
  return <section className="owner-panel"><h3>Contribution review</h3><Notice>{notice}</Notice><p>Private owner controls. Confirm only actual incoming records supported by trusted evidence. This interface never initiates a payment or refund.</p><button disabled={busy} onClick={()=>void load()}>Refresh review</button>
    <section aria-label="Ko-fi receipt inbox" data-control="ADM-007"><h4>Ko-fi receipts</h4><p>Notifications enter review. They do not confirm money or publish donor details. Tests and quarantine records stay outside the contribution ledger.</p>{data?.receipts?.length?data.receipts.map((receipt:any)=><ReceiptReview key={receipt.id} receipt={receipt} onSaved={load}/>):<p>No Ko-fi receipt notifications received.</p>}</section>
    <form onSubmit={e=>void submit(e,'treasury/admin/source')}><h4>Add verified source record</h4><label>Source<select name="source"><option value="mbbank">MB Bank</option><option value="kofi">Ko-fi</option></select></label><label>Provider/bank record identity<input name="sourceIdentity" required maxLength={180}/></label><label>Amount in minor units<input name="amountMinor" type="number" min="1" step="1" required/></label><label>Currency<select name="currency">{contributionCurrencies.map(item=><option key={item}>{item}</option>)}</select></label><label>Received date<input name="receivedAt" type="date" required/></label><label>Trusted evidence reference<input name="evidenceReference" required maxLength={500}/></label><button data-control="ADM-002" disabled={busy}>Add pending source record</button></form>
    {data&&<><label>Review record<select aria-label="Review record" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a record</option>{data.contributions.map((item:any)=><option key={item.id} value={item.id}>{item.source} · {displayAmount(item.amountMinor,item.currency)} · {item.status}</option>)}</select></label>{row&&<article><p>{row.sourceIdentity} · {displayAmount(row.amountMinor,row.currency)} · {row.receivedAt}</p><p>Evidence: {row.evidenceReference}</p><form onSubmit={e=>void submit(e,'treasury/admin/review',{id:row.id,revision:row.revision,reviewedAmountMinor:row.amountMinor,reviewedCurrency:row.currency,reviewedSourceIdentity:row.sourceIdentity})}><label>Action<select name="action"><option value="confirm">Confirm reviewed contribution</option><option value="match">Match verified account</option><option value="reverse">Reverse record (no refund)</option><option value="correct">Create correction for review</option></select></label><label>Verified account<select name="accountId"><option value="">Unmatched</option>{data.users.map((person:any)=><option key={person.id} value={person.id}>{person.displayName||'Unnamed account'} · {person.id}</option>)}</select></label><label>Claim ID, when matching<input name="claimId"/></label><label>Correction amount in minor units<input name="amountMinor" type="number" min="1" step="1"/></label><label>Correction currency<input name="currency" maxLength={3}/></label><label>Correction evidence<input name="evidenceReference" maxLength={500}/></label><label>Review reason<input name="reason" required maxLength={300}/></label><button data-control="ADM-004" disabled={busy}>Save reviewed action</button></form></article>}{data.claims.map((claim:any)=><article key={claim.id}><p>{claim.id} · {claim.accountId} · {claim.status} · {displayAmount(claim.amountMinor,claim.currency)} · {claim.reference}</p>{claim.status==='pending-review'&&<form onSubmit={e=>void submit(e,'treasury/admin/review',{id:claim.id,action:'reject-claim'})}><label>Claimant-safe reason<input name="reason" required maxLength={300}/></label><button data-control="ADM-005" disabled={busy}>Reject claim</button></form>}</article>)}</>}
    <h3>Social reports</h3>{moderation?.reports.map((report:any)=><p key={report.id}>{report.accountId} · {report.roomId} · {report.reason} · Reported {new Date(report.at).toLocaleString()}</p>)}<form onSubmit={e=>void submit(e,'social/admin')}><label>Account ID<input name="accountId" required/></label><label>Action<select name="action"><option value="remove">Remove from room</option><option value="voice">Restrict voice</option><option value="social">Restrict social access</option></select></label><label>Minutes<input name="minutes" type="number" min="1" max="10080" defaultValue="60"/></label><label>Reason<input name="reason" required maxLength={300}/></label><button disabled={busy}>Apply restriction</button></form>{moderation?.restrictions.filter((item:any)=>!item.liftedAt).map((item:any)=><form key={item.id} onSubmit={e=>void submit(e,'social/admin',{id:item.id,accountId:item.accountId,action:'lift'})}><p>{item.accountId} · {item.kind} · until {item.until}</p><label>Reason to lift<input name="reason" required maxLength={300}/></label><button disabled={busy}>Lift restriction</button></form>)}
  </section>;
}

function ReceiptReview({receipt,onSaved}:{receipt:any;onSaved:()=>Promise<void>}){
 const eligible=receipt.status==='pending-review'&&receipt.intakeMode==='pending-review'&&!receipt.explicitTest&&!receipt.conflicts.length&&receipt.type==='Donation';
 const [action,setAction]=useState(eligible?'prepare':'reject'),[reason,setReason]=useState(''),[evidence,setEvidence]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const pending=['pending-review','quarantined'].includes(receipt.status);
 return <article className="owner-receipt"><p>{receipt.type} · {displayAmount(receipt.amountMinor,receipt.currency)} · {receipt.status}</p><p>{receipt.transactionId} · {receipt.receivedAt}</p><p>Private provider identity: {receipt.senderName||'Unnamed'}{receipt.senderEmail?` · ${receipt.senderEmail}`:''}</p>{receipt.conflicts.length>0&&<p>Conflicting notifications require separate evidence review.</p>}<Notice>{notice}</Notice>{pending&&<form onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);try{await accountRequest('treasury/admin/receipt',{method:'POST',body:{id:receipt.id,revision:receipt.revision,action,reason,evidenceReference:evidence,reviewedAmountMinor:receipt.amountMinor,reviewedCurrency:receipt.currency,reviewedTransactionId:receipt.transactionId}});await onSaved();setNotice(action==='prepare'?'Pending source record prepared. It still needs contribution confirmation.':'Receipt rejected; retained outside confirmed contributions.');}catch(error){setNotice(errorMessage(error));}finally{setBusy(false);}}}>
  <label>Receipt action<select aria-label="Receipt action" value={action} onChange={event=>setAction(event.target.value)}>{eligible&&<option value="prepare">Prepare pending source record</option>}<option value="reject">Reject receipt</option></select></label>
  {action==='prepare'&&<label>Trusted provider or payment evidence<input value={evidence} onChange={event=>setEvidence(event.target.value)} required maxLength={500}/></label>}
  <label>Receipt review reason<input value={reason} onChange={event=>setReason(event.target.value)} required maxLength={300}/></label><button data-control="ADM-008" disabled={busy}>Save receipt review</button>
 </form>}</article>;
}
