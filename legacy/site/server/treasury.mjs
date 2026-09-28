import { randomUUID } from 'node:crypto';
import { fail, audit, person } from './store.mjs';
import * as v from './validation.mjs';
import {reviewKofiReceipt} from './kofi.mjs';

const visibility = input => ({ listed: input?.listed === true, alias: input?.alias ? v.text(input.alias, 'Public name', 32) : '', showAmount: input?.showAmount === true });
export function publicTreasury(db, { currency, cursor = '', limit = 25 } = {}) {
  const rows = db.contributions.filter(row => row.status === 'confirmed' && row.visibility.listed && (!currency || row.currency === currency)).sort((a,b) => b.receivedAt.localeCompare(a.receivedAt) || a.id.localeCompare(b.id));
  const offset = cursor ? rows.findIndex(row => row.id === cursor) + 1 : 0;
  const page = rows.slice(offset, offset + limit);
  const totals = new Map(), ranks = new Map();
  for (const row of rows) {
    if (!row.visibility.showAmount) continue;
    const total = totals.get(row.currency) || { currency: row.currency, amountMinor: 0, count: 0 };
    total.amountMinor += row.amountMinor; total.count++; totals.set(row.currency, total);
    // No correlation of separate anonymous/unmatched contributions into a person.
    if (row.accountId && row.visibility.alias) {
      const key = `${row.currency}:${row.accountId}:${row.visibility.alias}`;
      const rank = ranks.get(key) || { alias: row.visibility.alias, amountMinor: 0, currency: row.currency };
      rank.amountMinor += row.amountMinor; ranks.set(key, rank);
    }
  }
  return { rows: page.map(row => ({ id: row.id, alias: row.visibility.alias || 'Anonymous', amountMinor: row.visibility.showAmount ? row.amountMinor : null, currency: row.currency, receivedAt: row.receivedAt })), ranks: [...ranks.values()].sort((a,b) => a.currency.localeCompare(b.currency) || b.amountMinor-a.amountMinor).slice(0,25), totals: [...totals.values()], nextCursor: offset + limit < rows.length ? page.at(-1)?.id : null, scope: 'Public amount-visible confirmed contributions only' };
}
export function ownHistory(db, accountId) {
  return { contributions: db.contributions.filter(row => row.accountId === accountId).map(({ evidenceReference, sourceIdentity, operator, providerReceiptId, accountId: _, ...row }) => row), claims: db.claims.filter(row => row.accountId === accountId).map(({ accountId: _, ...row }) => row) };
}
export async function treasuryRoute(ctx) {
  const { path, method, body, store, user, owner } = ctx;
  if (path === '/api/treasury' && method === 'GET') return publicTreasury(store.read(), { currency: ctx.url.searchParams.get('currency') || undefined, cursor: ctx.url.searchParams.get('cursor') || '' });
  if (path === '/api/treasury/history' && method === 'GET') { ctx.requireUser(); return ownHistory(store.read(), user.id); }
  if (path === '/api/treasury/claims' && method === 'POST') {
    ctx.requireUser();
    const eventId = v.id(body.eventId), row = { source: v.source(body.source), amountMinor: v.amount(body.amountMinor), currency: v.currency(body.currency), receivedAt: v.isoDate(body.receivedAt), reference: body.reference ? v.text(body.reference, 'Reference', 180) : '' };
    if (row.source === 'mbbank' && row.currency !== 'VND') fail(400,'invalid-currency','MB Bank claims use VND.');
    return store.transact(db => {
      const old = db.claims.find(item => item.accountId === user.id && item.eventId === eventId); if(old) {if(Object.keys(row).some(key=>old[key]!==row[key]))fail(409,'claim-intent-changed','This claim was already received with different details. Refresh your history before submitting another.');return { claim: old, repeated: true };}
      if (db.claims.filter(item => item.accountId === user.id && item.status === 'pending-review').length >= 20) fail(429,'claims-limit','Your pending claims need review before adding more.');
      const claim = { id: randomUUID(), eventId, accountId: user.id, ...row, status: 'pending-review', submittedAt: new Date().toISOString() };
      db.claims.push(claim); audit(db,user.id,'claim-submitted',claim.id); return { claim };
    });
  }
  if (path === '/api/treasury/visibility' && method === 'POST') {
    ctx.requireUser(); const preferences = visibility(body.visibility);
    return store.transact(db => { const row=db.contributions.find(item=>item.id===body.id && item.accountId===user.id);if(!row)fail(404,'record-missing','Contribution not found.');if(row.revision!==body.revision)fail(409,'revision-conflict','This contribution changed. Refresh before saving.');row.visibility=preferences;row.revision++;audit(db,user.id,'visibility-changed',row.id);return { contribution: ownHistory(db,user.id).contributions.find(item=>item.id===row.id) }; });
  }
  if (path.startsWith('/api/treasury/admin')) {
    ctx.requireOwner();
    if(path==='/api/treasury/admin' && method==='GET')return { contributions: store.read().contributions, claims: store.read().claims, receipts:store.read().providerReceipts||[], users: Object.entries(store.read().users).map(([id,p])=>({id,displayName:p.displayName})) };
    if(path==='/api/treasury/admin/receipt' && method==='POST')return reviewKofiReceipt({store,user,body});
    if(path==='/api/treasury/admin/source' && method==='POST') {
      const row = { source: v.source(body.source), sourceIdentity: v.text(body.sourceIdentity,'Provider/bank record identity',180), amountMinor:v.amount(body.amountMinor), currency:v.currency(body.currency), receivedAt:v.isoDate(body.receivedAt), evidenceReference:v.text(body.evidenceReference,'Trusted evidence reference',500) };
      if(row.source==='mbbank' && row.currency!=='VND')fail(400,'invalid-currency','MB Bank records use VND.');
      return store.transact(db=>{const old=db.contributions.find(item=>item.source===row.source&&item.sourceIdentity===row.sourceIdentity);if(old){if(Object.keys(row).some(key=>old[key]!==row[key]))fail(409,'source-record-conflict','That source record already exists with different details. Review the existing record.');return {record:old,repeated:true};}const record={...row,id:randomUUID(),accountId:null,status:'pending-review',revision:1,visibility:visibility(),operator:user.id};db.contributions.push(record);audit(db,user.id,'source-record-added',record.id);return {record};});
    }
    if(path==='/api/treasury/admin/review' && method==='POST') {
      const action=v.text(body.action,'Action',30), reason=v.text(body.reason,'Review reason',300);
      if(!['match','confirm','reverse','correct','reject-claim'].includes(action))fail(400,'invalid-action','Unknown review action.');
      return store.transact(db=>{
        if(action==='reject-claim') {const claim=db.claims.find(item=>item.id===body.id);if(!claim)fail(404,'claim-missing','Claim not found.');if(claim.status!=='pending-review')fail(409,'claim-reviewed','This claim was already reviewed.');claim.status='rejected';claim.reason=reason;audit(db,user.id,action,claim.id,{reason});return {claim};}
        const row=db.contributions.find(item=>item.id===body.id);if(!row)fail(404,'record-missing','Record not found.');if(row.revision!==body.revision)fail(409,'revision-conflict','This record changed. Review it again.');
        if(action==='match') {const target=v.id(body.accountId,'Account');if(!db.users[target])fail(404,'account-missing','Verified account not found.');row.accountId=target;if(body.claimId){const claim=db.claims.find(item=>item.id===body.claimId&&item.accountId===target);if(!claim)fail(400,'claim-mismatch','Claim does not belong to that account.');claim.status='matched';claim.contributionId=row.id;}}
        if(action==='confirm') {if(row.status!=='pending-review'||!row.evidenceReference)fail(409,'record-state','Only an evidenced pending source record can be confirmed.');if(body.reviewedAmountMinor!==row.amountMinor||body.reviewedCurrency!==row.currency||body.reviewedSourceIdentity!==row.sourceIdentity)fail(409,'review-mismatch','The reviewed amount, currency or source changed.');row.status='confirmed';row.confirmedAt=new Date().toISOString();}
        if(action==='reverse') {if(row.status!=='confirmed')fail(409,'record-state','Only a confirmed record can be reversed.');row.status='reversed';}
        if(action==='correct') {if(row.status!=='confirmed')fail(409,'record-state','Only a confirmed record can be corrected.');const replacement={...row,id:randomUUID(),amountMinor:v.amount(body.amountMinor),currency:v.currency(body.currency),sourceIdentity:`${row.sourceIdentity}:correction:${row.revision}`,evidenceReference:v.text(body.evidenceReference,'Correction evidence',500),status:'pending-review',revision:1,corrects:row.id};row.status='corrected';db.contributions.push(replacement);}
        row.revision++;audit(db,user.id,action,row.id,{reason});return {record:row};
      });
    }
  }
  return undefined;
}
