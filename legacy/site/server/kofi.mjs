import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {fail,audit} from './store.mjs';
import * as v from './validation.mjs';

const digest=value=>createHash('sha256').update(value).digest();
const authenticated=(supplied,expected)=>typeof supplied==='string'&&supplied.length<=512&&timingSafeEqual(digest(supplied),digest(expected));
const optionalText=(input,label,max)=>input===undefined||input===null||input===''?'':v.text(input,label,max);

export function kofiAmount(value,currency){
 if(typeof value!=='string'||!/^\d{1,12}(?:\.\d{1,2})?$/.test(value))fail(400,'receipt-amount','Invalid receipt amount.');
 const [whole,fraction='']=value.split('.'),zeroDecimal=['JPY','VND'].includes(currency);
 if(zeroDecimal&&/[1-9]/.test(fraction))fail(400,'receipt-amount','This currency requires an integer amount.');
 const minor=BigInt(whole)*(zeroDecimal?1n:100n)+(zeroDecimal?0n:BigInt(fraction.padEnd(2,'0')));
 if(minor<1n||minor>1_000_000_000_000n)fail(400,'receipt-amount','Receipt amount is out of range.');
 return Number(minor);
}

/** Ko-fi currently documents a shared plaintext token, not an asymmetric/HMAC signature. */
export function createKofiReceiver({verificationToken,mode='quarantine'}={}){
 if(!verificationToken)return null;
 if(typeof verificationToken!=='string'||verificationToken.length<16||verificationToken.length>512||!['quarantine','pending-review'].includes(mode))throw new Error('Invalid protected Ko-fi configuration.');
 return async function receive(req,store){
  if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')fail(415,'receipt-content-type','Use the provider form content type.');
  let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>65536)fail(413,'receipt-too-large','Receipt is too large.');chunks.push(chunk);}
  const form=new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  if(form.getAll('data').length!==1||[...form.keys()].some(key=>key!=='data'))fail(400,'receipt-form','The provider data field is required.');
  let payload;try{payload=JSON.parse(form.get('data'));}catch{fail(400,'receipt-json','Invalid receipt data.');}
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||!authenticated(payload.verification_token,verificationToken))fail(401,'receipt-auth','Receipt authentication failed.');
  const type=payload.type==='Tip'?'Donation':payload.type;
  if(!['Donation','Subscription','Commission','Shop Order'].includes(type))fail(400,'receipt-type','Unsupported payment event.');
  const currency=v.currency(payload.currency);
  if(currency==='VND')fail(400,'receipt-currency','This is not a supported Ko-fi receipt currency.');
  if(typeof payload.is_public!=='boolean'||typeof payload.is_subscription_payment!=='boolean'||typeof payload.is_first_subscription_payment!=='boolean')fail(400,'receipt-flags','Receipt flags are invalid.');
  if(payload.is_first_subscription_payment&&!payload.is_subscription_payment)fail(400,'receipt-flags','Subscription flags conflict.');
  const row={messageId:v.id(payload.message_id,'Message'),transactionId:v.id(payload.kofi_transaction_id,'Transaction'),receivedAt:v.isoDate(payload.timestamp),type,currency,amountMinor:kofiAmount(payload.amount,currency),providerPublic:payload.is_public,subscription:payload.is_subscription_payment,firstSubscription:payload.is_first_subscription_payment,senderName:optionalText(payload.from_name,'Provider name',120),senderEmail:payload.email?v.email(payload.email):'',explicitTest:payload.is_test===true||payload.test===true};
  // Only purpose-limited fields survive. No verification token, message, shipping, URL, cookies or raw body.
  const fingerprint=digest(JSON.stringify(row)).toString('hex');
  return store.transact(db=>{
   const receipts=db.providerReceipts||=[];
   const old=receipts.find(item=>item.provider==='kofi'&&(item.messageIds.includes(row.messageId)||item.transactionId===row.transactionId));
   if(old){
    const comparable={...row,messageId:old.messageId};
    const same=digest(JSON.stringify(comparable)).toString('hex')===old.fingerprint;
    if(!same){if(!old.conflicts.some(item=>item.fingerprint===fingerprint)){old.conflicts.push({fingerprint,at:new Date().toISOString(),transactionId:row.transactionId,messageId:row.messageId,amountMinor:row.amountMinor,currency:row.currency,type:row.type});old.conflicts=old.conflicts.slice(-5);old.revision++;audit(db,'provider:kofi','receipt-conflict',old.id);}return {ok:true,status:'conflict-pending-review'};}
    if(!old.messageIds.includes(row.messageId)){if(old.messageIds.length>=50)fail(429,'receipt-replay-limit','Receipt replay identifiers require review.');old.messageIds.push(row.messageId);old.revision++;}
    return {ok:true,status:'already-received'};
   }
   if(receipts.length>=5000)fail(507,'receipt-capacity','The receipt inbox requires owner review.');
   const receipt={id:randomUUID(),provider:'kofi',...row,messageIds:[row.messageId],fingerprint,revision:1,receivedBySiteAt:new Date().toISOString(),status:mode==='quarantine'||row.explicitTest?'quarantined':'pending-review',intakeMode:mode,conflicts:[],contributionId:null};
   receipts.push(receipt);audit(db,'provider:kofi','receipt-received',receipt.id,{intakeMode:mode,status:receipt.status});
   return {ok:true,status:receipt.status};
  });
 };
}

export async function reviewKofiReceipt({store,user,body}){
 const action=v.text(body.action,'Receipt action',20),reason=v.text(body.reason,'Receipt review reason',300);
 if(!['reject','prepare'].includes(action))fail(400,'receipt-action','Choose a receipt review action.');
 return store.transact(db=>{
  const receipt=(db.providerReceipts||[]).find(row=>row.id===body.id&&row.provider==='kofi');
  if(!receipt)fail(404,'receipt-missing','Receipt not found.');
  if(receipt.revision!==body.revision)fail(409,'revision-conflict','This receipt changed. Review it again.');
  if(!['pending-review','quarantined'].includes(receipt.status))fail(409,'receipt-state','This receipt was already reviewed.');
  if(action==='reject'){receipt.status='rejected';receipt.reason=reason;receipt.revision++;audit(db,user.id,'receipt-rejected',receipt.id,{reason});return {receipt};}
  if(receipt.explicitTest||receipt.intakeMode==='quarantine'||receipt.conflicts.length)fail(409,'receipt-quarantined','Test, quarantine or conflicting receipts cannot enter the contribution ledger. Use the manual source workflow only with separately verified genuine evidence.');
  if(receipt.type!=='Donation')fail(409,'receipt-purpose','Shop, commission and membership payments require separate manual purpose review; they are not automatically donations.');
  if(body.reviewedAmountMinor!==receipt.amountMinor||body.reviewedCurrency!==receipt.currency||body.reviewedTransactionId!==receipt.transactionId)fail(409,'review-mismatch','The reviewed receipt details changed.');
  const evidenceReference=v.text(body.evidenceReference,'Trusted provider or payment evidence',500);
  const sourceIdentity=receipt.transactionId;
  const old=db.contributions.find(row=>row.source==='kofi'&&row.sourceIdentity===sourceIdentity);
  if(old)fail(409,'source-record-conflict','This Ko-fi transaction already has a source record. Review that record without importing again.');
  const record={id:randomUUID(),source:'kofi',sourceIdentity,amountMinor:receipt.amountMinor,currency:receipt.currency,receivedAt:receipt.receivedAt,evidenceReference,accountId:null,status:'pending-review',revision:1,visibility:{listed:false,alias:'',showAmount:false},operator:user.id,providerReceiptId:receipt.id};
  db.contributions.push(record);receipt.status='prepared';receipt.contributionId=record.id;receipt.reason=reason;receipt.revision++;
  audit(db,user.id,'receipt-prepared',receipt.id,{reason,contributionId:record.id});return {receipt,record};
 });
}
