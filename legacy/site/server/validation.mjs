import { fail } from './store.mjs';

export function text(value, name, maximum = 120, minimum = 1) {
  if (typeof value !== 'string') fail(400, 'invalid-input', `${name} is required.`);
  const result = value.trim();
  if (result.length < minimum || result.length > maximum || /[\u0000-\u001f\u007f]/.test(result)) fail(400, 'invalid-input', `${name} is not valid.`);
  return result;
}
export function id(value, name = 'ID') {
  const result = text(value, name, 120);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(result) || Object.hasOwn(Object.prototype,result) || result==='prototype') fail(400, 'invalid-input', `${name} is not valid.`);
  return result;
}
export function integer(value, name, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(400, 'invalid-input', `${name} is not valid.`);
  return value;
}
export function exactKeys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(400, 'invalid-input', 'Unsupported fields were supplied.');
}
export function email(value) {
  const result = text(value, 'Email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, 'invalid-email', 'Enter a valid email.');
  return result;
}
export function password(value, minimum = 1) {
  if(typeof value!=='string'||value.length<minimum||value.length>256||value.includes('\0'))fail(400,'invalid-password',`Password must contain ${minimum} to 256 characters.`);
  return value;
}
export function isoDate(value, name = 'Date') {
  const result = text(value, name, 40); const date = new Date(result);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 86400000 || date.getUTCFullYear() < 2000) fail(400, 'invalid-date', `${name} is not valid.`);
  return date.toISOString();
}
export function amount(value) { return integer(value, 'Amount in minor units', 1, 1_000_000_000_000); }
export function currency(value) {
  const result = text(value, 'Currency', 3).toUpperCase();
  if (!['VND', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'BRL', 'SGD', 'THB', 'NZD'].includes(result)) fail(400, 'invalid-currency', 'Choose a supported currency.');
  return result;
}
export function source(value) { if (!['kofi', 'mbbank'].includes(value)) fail(400, 'invalid-source', 'Choose Ko-fi or MB Bank.'); return value; }
const list = (value, name) => {
  if (!Array.isArray(value) || value.length > 500) fail(400, 'invalid-progress', `${name} is not valid.`);
  return [...new Set(value.map(item => id(item, name)))].sort();
};
export function progress(input) {
  exactKeys(input, ['schemaVersion', 'worldRevision', 'discoveredRooms', 'discoveredContent', 'cuts', 'shortcuts', 'checkpointId', 'encounterHistory', 'settings']);
  if (input.schemaVersion !== 1) fail(409, 'progress-version', 'This progress version needs a compatible site version. Your original data is retained.');
  if (!Array.isArray(input.encounterHistory) || input.encounterHistory.length > 500) fail(400, 'invalid-progress', 'Encounter history is not valid.');
  const seen = new Set();
  const encounterHistory = input.encounterHistory.map(event => {
    exactKeys(event, ['eventId', 'encounterId', 'outcome', 'recordedAt']);
    if (!['win', 'defeat'].includes(event.outcome)) fail(400, 'invalid-progress', 'Encounter outcome is not valid.');
    return { eventId: id(event.eventId), encounterId: id(event.encounterId), outcome: event.outcome, recordedAt: isoDate(event.recordedAt) };
  }).filter(event => { if (seen.has(event.eventId)) return false; seen.add(event.eventId); return true; });
  const result = { schemaVersion: 1, worldRevision: id(input.worldRevision), discoveredRooms: list(input.discoveredRooms, 'Rooms'), discoveredContent: list(input.discoveredContent, 'Content'), cuts: list(input.cuts, 'Cuts'), shortcuts: list(input.shortcuts, 'Shortcuts'), checkpointId: id(input.checkpointId), encounterHistory };
  if (input.settings) {
    exactKeys(input.settings, ['reducedMotion', 'quality', 'shake', 'holdToSlash', 'assistance']);
    result.settings = {};
    for (const key of ['reducedMotion', 'shake', 'holdToSlash', 'assistance']) if (typeof input.settings[key] === 'boolean') result.settings[key] = input.settings[key];
    if (['auto', 'low', 'high'].includes(input.settings.quality)) result.settings.quality = input.settings.quality;
  }
  return result;
}
export function mergeProgress(account, guest, preference = 'account') {
  if (!account) return guest;
  if (account.worldRevision !== guest.worldRevision) fail(409, 'map-migration-required', 'The local and account maps differ. Restore and migrate the local map before importing; both originals are retained.');
  const result = { ...account };
  for (const key of ['discoveredRooms', 'discoveredContent', 'cuts', 'shortcuts']) result[key] = [...new Set([...account[key], ...guest[key]])].sort();
  result.encounterHistory = [...new Map([...account.encounterHistory, ...guest.encounterHistory].map(event => [event.eventId, event])).values()].slice(-500);
  if (preference === 'guest') { result.checkpointId = guest.checkpointId; if (guest.settings) result.settings = guest.settings; }
  return result;
}
