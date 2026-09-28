import type { WorldProgress } from '../game/contracts';

export interface DexAccountUser { id:string; email:string; displayName:string; profileRevision:number; owner:boolean }
export interface AccountCapabilities { password:boolean; signup:boolean; google:boolean; recovery:boolean; confirmation:boolean; providerReady:boolean }
export interface AccountSession { user:DexAccountUser|null; csrf:string; capabilities:AccountCapabilities; recoverySession?:boolean }
export interface ProgressState { progress:WorldProgress|null; revision:number; provenance:'client-reported-exploration' }
export interface Contribution { id:string; source:'kofi'|'mbbank'; amountMinor:number; currency:string; receivedAt:string; status:string; revision:number; visibility:{listed:boolean;alias:string;showAmount:boolean} }
export interface DonationClaim { id:string; source:'kofi'|'mbbank'; amountMinor:number; currency:string; receivedAt:string; reference:string; status:string; reason?:string }
export interface TreasuryState { rows:{id:string;alias:string;amountMinor:number|null;currency:string;receivedAt:string}[]; ranks:{alias:string;amountMinor:number;currency:string}[]; totals:{currency:string;amountMinor:number;count:number}[]; nextCursor:string|null }
export class AccountError extends Error { constructor(public code:string,message:string,public status:number) {super(message);} }
let csrf = '', sessionLoad:Promise<AccountSession>|null = null, identityEpoch=0, knownIdentity:string|null=null;
export async function accountRequest<T>(path:string, options:{method?:string;body?:unknown;signal?:AbortSignal} = {}):Promise<T> {
  const method = options.method || 'GET';
  if (method !== 'GET' && !csrf) await loadAccountSession();
  const requestEpoch=identityEpoch;
  let response:Response;
  try { response = await fetch(`/api/${path}`,{method,credentials:'same-origin',headers:{accept:'application/json',...(method==='GET'?{}:{'content-type':'application/json','x-csrf-token':csrf})},body:options.body===undefined?undefined:JSON.stringify(options.body),signal:options.signal ?? AbortSignal.timeout(16000)}); }
  catch(error) { if((error as Error).name==='AbortError')throw error;throw new AccountError('unavailable','The service could not be reached. Your local progress is retained.',0); }
  const data = await response.json().catch(()=>({code:'invalid-response',message:'The service returned an unreadable response.'}));
  if (!response.ok) {
    if(requestEpoch===identityEpoch&&response.status===401&&['session-expired','sign-in-required'].includes(data.code))window.dispatchEvent(new Event('dex-account-invalidated'));
    if(response.status===403&&data.code==='request-origin'){
      csrf='';try{const next=await loadAccountSession();if(!next.user)window.dispatchEvent(new Event('dex-account-invalidated'));}catch{/* preserve the original failed-action result */}
    }
    throw new AccountError(data.code||'request-failed',data.message||'This request could not be completed.',response.status);
  }
  const currentResponse=requestEpoch===identityEpoch;
  if(!currentResponse)throw new AccountError('account-changed','The account changed while this request was pending. Refresh before continuing.',409);
  if(Object.hasOwn(data,'user')){const next=data.user?.id||null;if(next!==knownIdentity){knownIdentity=next;identityEpoch++;}}
  if (typeof data.csrf === 'string') csrf=data.csrf;
  return data as T;
}
export function loadAccountSession():Promise<AccountSession> {
  if(!sessionLoad)sessionLoad=accountRequest<AccountSession>('account/session').finally(()=>{sessionLoad=null;});
  return sessionLoad;
}
export function eventId(prefix='event'):string { return `${prefix}:${crypto.randomUUID()}`; }
const guestKey='dex.place.guest-progress.v2';
export function readGuestProgress():WorldProgress|null { try{const value=JSON.parse(localStorage.getItem(guestKey)||'null');return value?.schemaVersion===1?value:null;}catch{return null;} }
export function storeGuestProgress(snapshot:WorldProgress):boolean { try{localStorage.setItem(guestKey,JSON.stringify(snapshot));return true;}catch{return false;} }
export function clearGuestProgress():void { try{localStorage.removeItem(guestKey);}catch{/* session-only storage */} }
export function privateProgressKey(accountId:string):string{return `dex.place.unsynced.${accountId}.v2`;}
export function readUnsyncedProgress(accountId?:string):WorldProgress|null{if(!accountId)return null;try{const value=JSON.parse(localStorage.getItem(privateProgressKey(accountId))||'null');return value?.snapshot?.schemaVersion===1?value.snapshot:null;}catch{return null;}}
