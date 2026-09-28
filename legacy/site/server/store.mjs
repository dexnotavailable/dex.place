import { mkdir, readFile, writeFile, rename, copyFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';

export class ServiceError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const fail = (status, code, message) => { throw new ServiceError(status, code, message); };
export const freshDatabase = () => ({ schemaVersion: 1, revision: 0, users: {}, contributions: [], claims: [], providerReceipts: [], audit: [], reports: [], restrictions: [] });

/** One process owns this store. Atomic replacement, serialized writes and previous snapshot recovery. */
export async function openStore(directory, { forbiddenRoot, maxBytes = 16 * 1024 * 1024 } = {}) {
  const root = resolve(directory);
  if (forbiddenRoot) {
    const rel = relative(resolve(forbiddenRoot), root);
    if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('Runtime data must be outside the site source/public root.');
  }
  await mkdir(root, { recursive: true });
  const actual = await realpath(root);
  if (actual.toLowerCase() !== root.toLowerCase()) throw new Error('Runtime data root must not redirect through a junction.');
  const file = resolve(root, 'state-v1.json');
  let state;
  try { state = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Stored data could not be read; original retained.'); state = freshDatabase(); }
  if (state.schemaVersion !== 1 || !state.users || !Array.isArray(state.audit)) throw new Error('Unsupported stored data; original retained.');
  let queue = Promise.resolve();
  return {
    read: () => structuredClone(state),
    transact(fn) {
      const task = queue.then(async () => {
        const draft = structuredClone(state);
        const result = await fn(draft);
        draft.revision++;
        // Retain bounded operational metadata, never positions, session credentials or audio.
        draft.audit = draft.audit.slice(-10000);
        draft.reports = draft.reports.slice(-2000);
        const bytes = JSON.stringify(draft);
        if (Buffer.byteLength(bytes) > maxBytes) fail(507, 'storage-capacity', 'The service has reached its storage limit. Nothing was discarded.');
        const temporary = resolve(root, `state-${randomUUID()}.tmp`);
        await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
        await copyFile(file, `${file}.previous`).catch(error => { if (error.code !== 'ENOENT') throw error; });
        await rename(temporary, file);
        state = draft;
        return result;
      });
      queue = task.catch(() => {});
      return task;
    },
  };
}

export function audit(db, actor, action, subject, details = {}) {
  db.audit.push({ id: randomUUID(), at: new Date().toISOString(), actor, action, subject, ...details });
}
export function person(db, id) {
  return db.users[id] ||= { displayName: '', profileRevision: 0, progress: null, progressRevision: 0, applied: [], mutes: [], blocks: [], mergeReceipts: [] };
}
