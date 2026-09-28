#!/usr/bin/env node
// dex.place origin server.
//
// Serves the build that ops/deploy.mjs marked active in <deployRoot>/state.json,
// plus /downloads/* from a directory that is not in git. Zero dependencies:
// node: built-ins only. See ops/README.md for the operating picture.
//
// CLI contract (deploy.mjs smoke tests rely on it, keep it stable):
//   node server.mjs [--port N] [--deploy-root DIR] [--downloads DIR]
//                   [--log FILE | --no-log] [--root DIST_DIR] [--sha SHA]
//                   [--sp13-root DIR]
//   --root serves one fixed directory instead of following state.json.
//   --sp13-root is the SP13 WebGL deploy served at /sp13/ (default below).
//   On success prints one JSON line to stdout: {"event":"listening","port":N,...}

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const DEFAULT_DEPLOY_ROOT = 'D:\\Dex\\Servers\\dex.place';
export const DEFAULT_SP13_ROOT = 'D:\\Dex\\GameDev\\Deploy\\SP13\\WebGL';
const LISTEN_HOST = '127.0.0.1';
const CANONICAL_ORIGIN = 'https://dex.place';
const REDIRECT_HOSTS = new Set(['www.dex.place']);
const STATE_REFRESH_MS = 100;
const LOG_MAX_BYTES = 10 * 1024 * 1024;
const SHUTDOWN_GRACE_MS = 5000;
const BUILD_NAME = /^[0-9a-f]{7,40}$/;
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3]|conin\$|conout\$)(\..*)?$/i;

// /sp13/ serves only these files from the SP13 root, the same allowlist as the v2
// origin (serve-production.mjs): four root files, plus release manifests and players.
const SP13_ROOT_FILES = new Set(['index.html', 'sp13-launcher.js', 'sp13.css', 'current.json']);
const SP13_RELEASE_PATH = /^releases\/[a-z0-9][a-z0-9-]{0,159}\/(?:release\.json|player\/.+)$/;
// Unity ships pre-compressed player files (player.wasm.br and so on).
const PRECOMPRESSED = Object.freeze({ '.br': 'br', '.gz': 'gzip' });

export const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.sha256': 'text/plain; charset=utf-8',
  '.sha1': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.vrm': 'model/gltf-binary',
  '.ktx2': 'image/ktx2',
  '.bin': 'application/octet-stream',
  '.data': 'application/octet-stream',
  '.unityweb': 'application/octet-stream',
  '.zip': 'application/zip',
  '.exe': 'application/vnd.microsoft.portable-executable',
});

const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
});

export const CACHE = Object.freeze({
  html: 'no-cache, no-transform', // no-transform stops Cloudflare injecting scripts into HTML
  immutable: 'public, max-age=31536000, immutable',
  revalidate: 'no-cache',
  download: 'private, no-store',
  none: 'no-store',
  redirect: 'public, max-age=3600',
});

const iso = () => new Date().toISOString();

// ---------------------------------------------------------------- logging

class FileLog {
  constructor(file) {
    this.file = file || null;
    this.stream = null;
    this.size = 0;
    this.rotating = false;
    this.pending = [];
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    try { this.size = fs.statSync(this.file).size; } catch { this.size = 0; }
    this.stream = this.#open();
  }

  #open() {
    const stream = fs.createWriteStream(this.file, { flags: 'a' });
    stream.on('error', () => {});
    return stream;
  }

  write(line) {
    if (!this.file) return;
    const text = `${line}\n`;
    if (this.rotating) { this.pending.push(text); return; }
    this.stream.write(text);
    this.size += Buffer.byteLength(text);
    if (this.size >= LOG_MAX_BYTES) this.#rotate();
  }

  #rotate() {
    this.rotating = true;
    const old = this.stream;
    old.end(() => {
      try {
        fs.rmSync(`${this.file}.1`, { force: true });
        fs.renameSync(this.file, `${this.file}.1`);
      } catch { /* keep appending to the same file */ }
      this.stream = this.#open();
      this.size = 0;
      this.rotating = false;
      const queued = this.pending;
      this.pending = [];
      for (const text of queued) this.write(text.slice(0, -1));
    });
  }

  close() {
    return new Promise((resolve) => {
      if (!this.stream) return resolve();
      const stream = this.stream;
      this.stream = null;
      this.file = null;
      stream.end(resolve);
    });
  }
}

// ------------------------------------------------------- active build state

const stripBom = (text) => text.replace(/^\uFEFF/, '');

class ActiveBuild {
  constructor(deployRoot, onEvent) {
    this.statePath = path.join(deployRoot, 'state.json');
    this.buildsDir = path.join(deployRoot, 'builds');
    this.onEvent = onEvent;
    this.current = null; // { root, build }
    this.state = null; // last parsed state.json
    this.key = null;
    this.lastCheck = 0;
    this.inflight = null;
    this.lastProblem = null;
  }

  async get() {
    if (Date.now() - this.lastCheck >= STATE_REFRESH_MS && !this.inflight) {
      this.inflight = this.#refresh()
        .catch((err) => this.#problem(`state refresh failed: ${err.message}`))
        .finally(() => { this.lastCheck = Date.now(); this.inflight = null; });
    }
    if (this.inflight) await this.inflight;
    return this.current;
  }

  #problem(message) {
    if (message !== this.lastProblem) this.onEvent('warn', message);
    this.lastProblem = message;
  }

  async #refresh() {
    let st;
    try {
      st = await fsp.stat(this.statePath, { bigint: true });
    } catch (err) {
      if (err.code === 'ENOENT') { this.#problem('state.json not found; no build deployed yet'); return; }
      throw err;
    }
    const key = `${st.mtimeNs}:${st.size}:${st.ino}`;
    if (key === this.key) return;

    let parsed;
    try {
      parsed = JSON.parse(stripBom(await fsp.readFile(this.statePath, 'utf8')));
    } catch (err) {
      // Mid-write or locked for a moment; keep serving the current build and retry.
      this.#problem(`state.json unreadable (${err.code || err.name}); keeping current build`);
      return;
    }
    this.state = parsed && typeof parsed === 'object' ? parsed : {};

    const build = this.state.build;
    if (typeof build !== 'string' || !BUILD_NAME.test(build)) {
      this.key = key;
      this.#problem('state.json has no active build');
      return;
    }
    const root = path.join(this.buildsDir, build, 'dist');
    let rootStat = null;
    try { rootStat = await fsp.stat(root); } catch { rootStat = null; }
    if (!rootStat || !rootStat.isDirectory()) {
      // Never switch to a directory that is not there; retry on the next request.
      this.#problem(`active build ${build} has no dist directory; keeping current build`);
      return;
    }
    const changed = !this.current || this.current.root !== root;
    this.current = { root, build };
    this.key = key;
    this.lastProblem = null;
    if (changed) this.onEvent('info', `serving build ${build} (${String(this.state.sha || '').slice(0, 12)})`);
  }
}

class FixedBuild {
  constructor(root, sha) {
    this.current = { root, build: null };
    this.state = { sha: sha || null, deployedAt: null, previousSha: null };
  }

  async get() { return this.current; }
}

// ----------------------------------------------------------- path handling

function splitTarget(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  const q = raw.indexOf('?');
  return q === -1 ? { rawPath: raw, search: '' } : { rawPath: raw.slice(0, q), search: raw.slice(q) };
}

// Returns { decoded, segments } or { error: status }.
export function parsePath(rawPath) {
  if (rawPath.length > 2048) return { error: 404 };
  if (rawPath.includes('\\') || /%5c/i.test(rawPath)) return { error: 404 };
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return { error: 400 }; }
  if (!decoded.startsWith('/')) return { error: 400 };
  // Control characters, backslash and Windows-reserved characters (':' also blocks ADS like ::$DATA).
  if (/[\u0000-\u001f\u007f\\:*?"<>|]/.test(decoded)) return { error: 404 };
  const segments = decoded.slice(1).split('/');
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg === '') {
      if (i === segments.length - 1) continue; // trailing slash = directory request
      return { error: 404 }; // empty segment ('//')
    }
    if (
      seg.startsWith('.') || // '.', '..', dotfiles
      seg.endsWith('.') || seg.endsWith(' ') || // Windows silently strips these (aliasing)
      seg.length > 255 ||
      WINDOWS_DEVICE.test(seg)
    ) return { error: 404 };
  }
  return { decoded, segments };
}

function isInside(base, candidate) {
  const rel = path.relative(base, candidate);
  if (rel === '') return true;
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

function hasHiddenSegment(base, candidate) {
  const rel = path.relative(base, candidate);
  // Also catches 8.3 short-name aliases of dotfiles, because realpath returns long names.
  return rel !== '' && rel.split(path.sep).some((seg) => seg.startsWith('.'));
}

const baseRealCache = new Map();
async function realBase(base) {
  const cached = baseRealCache.get(base);
  if (cached) return cached;
  const real = await fsp.realpath(base);
  if (baseRealCache.size > 16) baseRealCache.clear();
  baseRealCache.set(base, real);
  return real;
}

// Resolves request segments to a regular file whose real path stays inside base.
export async function resolveFile(base, segments, allowIndex = true) {
  const parts = segments.filter((seg) => seg !== '');
  let baseReal;
  try { baseReal = await realBase(base); } catch { baseRealCache.delete(base); return null; }
  const candidate = path.join(baseReal, ...parts);
  if (!isInside(baseReal, candidate)) return null;
  let real;
  try { real = await fsp.realpath(candidate); } catch { return null; }
  if (!isInside(baseReal, real) || hasHiddenSegment(baseReal, real)) return null;
  let stat;
  try { stat = await fsp.stat(real); } catch { return null; }
  if (stat.isDirectory()) {
    if (!allowIndex) return null;
    return resolveFile(base, [...parts, 'index.html'], false);
  }
  if (!stat.isFile()) return null;
  return { file: real, stat };
}

// ------------------------------------------------------ conditional + range

const etagFor = (stat) => `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
const httpDate = (ms) => new Date(Math.floor(ms / 1000) * 1000).toUTCString();

function isNotModified(req, etag, mtimeMs) {
  const inm = req.headers['if-none-match'];
  if (inm !== undefined) {
    if (inm.trim() === '*') return true;
    const bare = etag.replace(/^W\//, '');
    return inm.split(',').map((tag) => tag.trim().replace(/^W\//, '')).includes(bare);
  }
  const ims = req.headers['if-modified-since'];
  if (ims !== undefined) {
    const since = Date.parse(ims);
    if (!Number.isNaN(since) && Math.floor(mtimeMs / 1000) * 1000 <= since) return true;
  }
  return false;
}

function ifRangeAllows(req, etag, lastModified) {
  const value = req.headers['if-range'];
  if (value === undefined) return true;
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) return trimmed === etag; // strong comparison
  return trimmed === lastModified;
}

// Returns null (no/ignored range), 'unsatisfiable', or { start, end }.
export function parseRange(header, size) {
  if (typeof header !== 'string') return null;
  const match = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  if (!match) return null; // unknown unit, multiple ranges, junk: serve the full body
  const [, first, last] = match;
  if (first === '' && last === '') return null;
  let start;
  let end;
  if (first === '') {
    const suffix = Number(last);
    if (!Number.isSafeInteger(suffix)) return null;
    if (suffix === 0 || size === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(first);
    if (!Number.isSafeInteger(start)) return null;
    if (last !== '') {
      const lastPos = Number(last);
      if (!Number.isSafeInteger(lastPos) || lastPos < start) return null;
      end = Math.min(lastPos, size - 1);
    } else {
      end = size - 1;
    }
    if (start >= size) return 'unsatisfiable';
  }
  return { start, end };
}

function contentDisposition(name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// ------------------------------------------------------------- responders

function sendBody(req, res, status, type, cache, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(req.method === 'HEAD' ? undefined : body);
}

const sendText = (req, res, status, body, cache) => sendBody(req, res, status, 'text/plain; charset=utf-8', cache, body);

// options.precompressed: a file.<ext>.br / .gz is sent as-is with Content-Encoding and
// the type of <ext>. options.cdnCache: repeat Cache-Control as Cloudflare-CDN-Cache-Control.
async function sendFile(req, res, found, options) {
  const { status = 200, cache, conditional = true, ranges = true, disposition = null, precompressed = false, cdnCache = false } = options;
  const { file, stat } = found;
  let mediaName = file.toLowerCase();
  let encoding = null;
  if (precompressed) {
    encoding = PRECOMPRESSED[path.extname(mediaName)] || null;
    if (encoding) mediaName = mediaName.slice(0, -path.extname(mediaName).length);
  }
  const type = MIME[path.extname(mediaName)] || 'application/octet-stream';
  const etag = etagFor(stat);
  const lastModified = httpDate(stat.mtimeMs);

  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  if (cdnCache) res.setHeader('Cloudflare-CDN-Cache-Control', cache);
  if (status === 200) {
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', lastModified);
    if (ranges) res.setHeader('Accept-Ranges', 'bytes');
  }
  if (disposition) res.setHeader('Content-Disposition', disposition);

  if (conditional && status === 200 && isNotModified(req, etag, stat.mtimeMs)) {
    res.statusCode = 304;
    res.removeHeader('Content-Type');
    res.end();
    return;
  }

  let start = 0;
  let end = stat.size - 1;
  let code = status;
  if (ranges && status === 200 && req.headers.range !== undefined && ifRangeAllows(req, etag, lastModified)) {
    const range = parseRange(req.headers.range, stat.size);
    if (range === 'unsatisfiable') {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      res.setHeader('Content-Length', 0);
      res.setHeader('Cache-Control', CACHE.none); // never let a cache keep an error for a year
      res.removeHeader('Cloudflare-CDN-Cache-Control');
      res.removeHeader('Content-Type');
      res.end();
      return;
    }
    if (range) {
      ({ start, end } = range);
      code = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    }
  }

  const length = stat.size === 0 ? 0 : end - start + 1;
  res.statusCode = code;
  if (encoding) res.setHeader('Content-Encoding', encoding);
  res.setHeader('Content-Length', length);
  if (req.method === 'HEAD' || length === 0) {
    res.end();
    return;
  }
  const stream = fs.createReadStream(file, { start, end });
  try {
    await pipeline(stream, res);
  } catch {
    // Client went away or the file vanished mid-stream; nothing more to send.
    if (!res.destroyed) res.destroy();
  }
}

// ----------------------------------------------------------------- routing

function normalizeHost(value) {
  return String(value || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

async function notFound(ctx, req, res, root) {
  if (root) {
    const page = await resolveFile(root, ['404.html'], false);
    if (page) {
      await sendFile(req, res, page, { status: 404, cache: CACHE.html, conditional: false, ranges: false });
      return;
    }
  }
  sendText(req, res, 404, 'not found\n', CACHE.revalidate);
}

// SP13 WebGL game at /sp13/, served from ctx.sp13Root (outside the build, like
// /downloads). Mirrors the v2 origin: allowlisted paths only, pre-compressed Unity
// files, current.json never cached, releases immutable, and every file response
// (304 too) repeats Cache-Control as Cloudflare-CDN-Cache-Control.
async function routeSp13(ctx, req, res, target, rest, root) {
  if (rest.length === 0) {
    // '/sp13' -> '/sp13/', keeping the query ('?' alone is dropped, as URL.search does).
    res.statusCode = 308;
    res.setHeader('Location', `/sp13/${target.search === '?' ? '' : target.search}`);
    res.setHeader('Cache-Control', CACHE.none);
    res.setHeader('Content-Length', 0);
    res.end();
    return;
  }
  const isRoot = rest.length === 1 && rest[0] === '';
  const relative = isRoot ? 'index.html' : rest.join('/');
  const directory = !isRoot && rest[rest.length - 1] === ''; // no directory listings or indexes below /sp13/
  if (directory || (!SP13_ROOT_FILES.has(relative) && !SP13_RELEASE_PATH.test(relative))) {
    await notFound(ctx, req, res, root);
    return;
  }
  const found = await resolveFile(ctx.sp13Root, relative.split('/'), false);
  if (!found) { await notFound(ctx, req, res, root); return; }
  let cache = CACHE.revalidate;
  let conditional = true;
  if (relative === 'current.json') {
    cache = CACHE.none;
    conditional = false; // the launcher must always see the release it points at
  } else if (rest[0] === 'releases') {
    cache = CACHE.immutable;
  }
  await sendFile(req, res, found, { cache, conditional, precompressed: true, cdnCache: true });
}

async function route(ctx, req, res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  if (ctx.closing) res.setHeader('Connection', 'close');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendText(req, res, 405, 'method not allowed\n', CACHE.none);
    return;
  }

  const target = splitTarget(req.url);
  if (!target) { sendText(req, res, 400, 'bad request\n', CACHE.none); return; }

  if (REDIRECT_HOSTS.has(normalizeHost(req.headers.host))) {
    res.setHeader('Location', `${CANONICAL_ORIGIN}${target.rawPath}${target.search}`);
    sendText(req, res, 301, 'moved permanently\n', CACHE.redirect);
    return;
  }

  const parsed = parsePath(target.rawPath);
  if (parsed.error === 400) { sendText(req, res, 400, 'bad request\n', CACHE.none); return; }

  if (parsed.decoded === '/healthz') {
    const active = await ctx.active.get();
    if (active) sendText(req, res, 200, 'ok', CACHE.none);
    else sendText(req, res, 503, 'no-build', CACHE.none);
    return;
  }

  if (parsed.decoded === '/__deploy') {
    await ctx.active.get();
    const s = ctx.active.state || {};
    const body = { sha: s.sha ?? null, deployedAt: s.deployedAt ?? null, previousSha: s.previousSha ?? null };
    if (s.lastFailedSha) {
      body.lastFailedSha = s.lastFailedSha;
      body.lastFailedAt = s.lastFailedAt ?? null;
    }
    sendBody(req, res, 200, 'application/json; charset=utf-8', CACHE.none, `${JSON.stringify(body)}\n`);
    return;
  }

  const active = await ctx.active.get();
  const root = active ? active.root : null;

  if (parsed.error) { await notFound(ctx, req, res, root); return; }

  if (parsed.segments[0] === 'downloads') {
    const rest = parsed.segments.slice(1);
    const found = rest.length && rest[rest.length - 1] !== ''
      ? await resolveFile(ctx.downloadsDir, rest, false)
      : null;
    if (!found) { await notFound(ctx, req, res, root); return; }
    await sendFile(req, res, found, {
      cache: CACHE.download,
      conditional: false,
      disposition: contentDisposition(path.basename(found.file)),
    });
    return;
  }

  if (parsed.segments[0] === 'sp13') {
    await routeSp13(ctx, req, res, target, parsed.segments.slice(1), root);
    return;
  }

  if (!root) { sendText(req, res, 503, 'no build deployed\n', CACHE.none); return; }

  const found = await resolveFile(root, parsed.segments, true);
  if (!found) { await notFound(ctx, req, res, root); return; }

  const ext = path.extname(found.file).toLowerCase();
  let cache = CACHE.revalidate;
  if (ext === '.html' || ext === '.htm') cache = CACHE.html;
  else if (parsed.segments[0] === 'assets' && parsed.segments.length > 1) cache = CACHE.immutable;
  await sendFile(req, res, found, { cache });
}

function logPath(url) {
  const raw = String(url || '');
  const q = raw.indexOf('?');
  return (q === -1 ? raw : raw.slice(0, q)).slice(0, 200).replace(/[^\x21-\x7e]/g, '?');
}

// ------------------------------------------------------------------ server

export function createOriginServer(options) {
  const log = new FileLog(options.logFile);
  const event = (level, message) => log.write(`${iso()} ${level} ${message}`);
  const active = options.root
    ? new FixedBuild(path.resolve(options.root), options.sha)
    : new ActiveBuild(path.resolve(options.deployRoot), event);
  const ctx = {
    active,
    downloadsDir: path.resolve(options.downloadsDir),
    sp13Root: path.resolve(options.sp13Root ?? DEFAULT_SP13_ROOT),
    closing: false,
  };

  const server = http.createServer(async (req, res) => {
    const started = process.hrtime.bigint();
    res.on('close', () => {
      const pathname = logPath(req.url);
      if (pathname === '/healthz') return;
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const length = res.getHeader('content-length');
      log.write(`${iso()} req ${res.statusCode} ${req.method} ${pathname} ${length ?? '-'} ${ms.toFixed(1)}ms${res.writableFinished ? '' : ' aborted'}`);
    });
    try {
      await route(ctx, req, res);
    } catch (err) {
      event('error', `${req.method} ${logPath(req.url)}: ${err && err.stack ? err.stack : err}`);
      if (!res.headersSent) sendText(req, res, 500, 'internal error\n', CACHE.none);
      else res.destroy();
    }
  });
  // cloudflared keeps idle origin connections open for up to 90 s; outlive that.
  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 125_000;

  const close = () => new Promise((resolve) => {
    if (ctx.closing) { resolve(); return; }
    ctx.closing = true;
    event('info', 'shutting down');
    const timer = setTimeout(() => server.closeAllConnections(), SHUTDOWN_GRACE_MS);
    timer.unref();
    server.close(() => {
      clearTimeout(timer);
      log.close().then(resolve);
    });
    server.closeIdleConnections();
  });

  return { server, ctx, event, close };
}

export function parseOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: 'string' },
      'deploy-root': { type: 'string' },
      downloads: { type: 'string' },
      log: { type: 'string' },
      'no-log': { type: 'boolean', default: false },
      root: { type: 'string' },
      sha: { type: 'string' },
      'sp13-root': { type: 'string' },
    },
    strict: true,
  });
  const port = Number(values.port ?? process.env.DEX_SITE_PORT ?? 8088);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`invalid port: ${values.port}`);
  const deployRoot = path.resolve(values['deploy-root'] ?? process.env.DEX_DEPLOY_ROOT ?? DEFAULT_DEPLOY_ROOT);
  const downloadsDir = path.resolve(values.downloads ?? process.env.DEX_DOWNLOADS_DIR ?? path.join(deployRoot, 'downloads'));
  let logFile = null;
  if (!values['no-log']) logFile = values.log ? path.resolve(values.log) : (values.root ? null : path.join(deployRoot, 'logs', 'server.log'));
  // A missing SP13 root is fine: /sp13/* then answers 404.
  const sp13Root = path.resolve(values['sp13-root'] ?? process.env.DEX_SP13_ROOT ?? DEFAULT_SP13_ROOT);
  return { port, deployRoot, downloadsDir, sp13Root, logFile, root: values.root ?? null, sha: values.sha ?? null };
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseOptions(argv);
  } catch (err) {
    process.stderr.write(`server: ${err.message}\n`);
    process.exit(2);
  }
  if (options.root && !fs.existsSync(options.root)) {
    process.stderr.write(`server: --root does not exist: ${options.root}\n`);
    process.exit(2);
  }

  const origin = createOriginServer(options);
  const { server, event, close } = origin;

  server.on('error', (err) => {
    process.stderr.write(`server: ${err.code || ''} ${err.message}\n`);
    event('error', `listen failed: ${err.message}`);
    process.exitCode = 1;
    close().finally(() => process.exit(1));
  });

  server.listen(options.port, LISTEN_HOST, () => {
    const { port } = server.address();
    event('info', `listening on ${LISTEN_HOST}:${port} pid ${process.pid}${options.root ? ' (fixed root)' : ''}`);
    process.stdout.write(`${JSON.stringify({ event: 'listening', host: LISTEN_HOST, port, pid: process.pid })}\n`);
  });

  const stop = (signal) => {
    event('info', `received ${signal}`);
    close().finally(() => process.exit(0));
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGBREAK', () => stop('SIGBREAK'));
  process.on('uncaughtException', (err) => {
    event('error', `uncaught: ${err && err.stack ? err.stack : err}`);
    process.stderr.write(`server: uncaught ${err && err.stack ? err.stack : err}\n`);
    close().finally(() => process.exit(1));
  });
}

function isEntryPoint() {
  try {
    const invoked = fs.realpathSync.native(process.argv[1]);
    const self = fs.realpathSync.native(fileURLToPath(import.meta.url));
    return process.platform === 'win32' ? invoked.toLowerCase() === self.toLowerCase() : invoked === self;
  } catch {
    return false;
  }
}

if (isEntryPoint()) main();
