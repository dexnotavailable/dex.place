// Tests for the dex.place hosting tooling. Run from the repo root:
//   node --test ops/test/ops.test.mjs
// Uses a temp deploy root under D:\Dex\Temp\dex-place-ops-test\ (override with
// DEX_OPS_TEST_ROOT), a local bare git repo instead of GitHub, and only ports
// 18000-18999. Never touches 8088, the scheduled tasks, or the real deploy root.

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const OPS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(OPS, 'server.mjs');
const DEPLOY = path.join(OPS, 'deploy.mjs');
const TEST_ROOT = process.env.DEX_OPS_TEST_ROOT || 'D:\\Dex\\Temp\\dex-place-ops-test';
const RUN = path.join(TEST_ROOT, `run-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}-${process.pid}`);
const SMOKE_PORTS = '18600-18699';
const IS_WINDOWS = process.platform === 'win32';
const POWERSHELL = IS_WINDOWS ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : null;

const spawned = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

// ------------------------------------------------------------------ helpers

function request(port, { method = 'GET', target = '/', headers = {}, agent = false, timeout = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: target, headers, agent, timeout }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`timeout ${target}`)));
    req.on('error', reject);
    req.end();
  });
}

async function waitFor(fn, timeoutMs, label, intervalMs = 200) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await fn();
      if (last) return last;
    } catch (err) {
      last = err;
    }
    await sleep(intervalMs);
  }
  throw new Error(`timed out waiting for ${label} (last: ${last && last.message ? last.message : JSON.stringify(last)})`);
}

function killTree(pid) {
  if (!pid) return;
  if (IS_WINDOWS) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ }
}

async function startServer(args, [lo, hi] = [18100, 18499]) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const port = rand(lo, hi);
    const child = spawn(process.execPath, [SERVER, '--port', String(port), ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    spawned.add(child.pid);
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const ok = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 10_000);
      child.stdout.on('data', () => { if (out.includes('"listening"')) { clearTimeout(timer); resolve(true); } });
      child.once('exit', () => { clearTimeout(timer); resolve(false); });
    });
    if (ok) {
      return {
        port,
        child,
        stop: async () => {
          const exited = new Promise((r) => child.once('exit', r));
          killTree(child.pid);
          await Promise.race([exited, sleep(5000)]);
          spawned.delete(child.pid);
        },
      };
    }
    killTree(child.pid);
    if (!/EADDRINUSE/.test(err)) throw new Error(`server did not start: ${err || out}`);
  }
  throw new Error('no free port for server');
}

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=ops-test', '-c', 'user.email=ops-test@localhost', '-c', 'core.autocrlf=false', ...args], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  }).trim();
}

function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

// The current source of ops/<name> with one exact edit; fails loudly if the anchor
// is gone, so a stale patch can never turn a test into a no-op.
function patchOps(name, find, replace) {
  const source = fs.readFileSync(path.join(OPS, name), 'utf8');
  assert.ok(source.includes(find), `ops/${name} no longer contains ${JSON.stringify(find.slice(0, 60))}`);
  return source.replace(find, replace);
}

// ------------------------------------------------------ tunnel script patch

// The live v2 Cloudflare Tunnel script. Tests only ever read it (and patch copies).
const REAL_TUNNEL_SCRIPT = 'D:\\Dex\\Projects\\SUMMER PROJECT 3\\dex-client\\site\\scripts\\start-cloudflare-tunnel.ps1';
// Where install-hosting.ps1 keeps its backups (its -BackupRoot default).
const TUNNEL_BACKUP_ROOT = process.env.DEX_OPS_TUNNEL_BACKUPS || 'D:\\Dex\\Automation\\backups\\dex-place';
const TUNNEL_COMMENT = [
  '# Origin fallback removed by dex.place ops/install-hosting.ps1: the origin on 127.0.0.1:8088',
  '# is owned by the "Dex Site Origin" task running dex.place/ops/start-origin.ps1.',
];
const FALLBACK_BLOCK = /^try \{\r?\n[ \t]+\$health = Invoke-WebRequest [^\n]*\$OriginHealthUrl[^\n]*\n[\s\S]*?\n\} catch \{\r?\n[ \t]+& \$originLauncher \| Out-Null\r?\n\}/m;

// A small stand-in for start-cloudflare-tunnel.ps1: the same fallback block, plus
// look-alike blocks that must survive (inside a function, and one that is not it).
function syntheticTunnelScript(nl = '\n') {
  return [
    '[CmdletBinding()]',
    'param(',
    '    [string]$OriginHealthUrl = "http://127.0.0.1:8088/healthz",',
    '    [switch]$KeepAlive',
    ')',
    '',
    '$ErrorActionPreference = "Stop"',
    '$originLauncher = Join-Path $PSScriptRoot "start-production-origin.ps1"',
    '',
    'try {',
    '    $health = Invoke-WebRequest -Uri $OriginHealthUrl -UseBasicParsing -TimeoutSec 2',
    '    if ($health.StatusCode -ne 200) {',
    '        throw "unhealthy"',
    '    }',
    '} catch {',
    '    & $originLauncher | Out-Null',
    '}',
    '',
    'function Get-TunnelToken {',
    '    param([string]$Target)',
    '    try { Invoke-WebRequest -Uri $OriginHealthUrl } catch { & $originLauncher | Out-Null }',
    '    return "token-for-$Target"',
    '}',
    '',
    'do {',
    '    try { $token = Get-TunnelToken -Target "x" } finally { $token = $null }',
    '} while ($false)',
    '',
  ].join(nl);
}

// Independent oracle: the file with exactly the fallback block replaced by the comment.
function expectedTunnelPatch(bytes) {
  const text = bytes.toString('latin1');
  const m = FALLBACK_BLOCK.exec(text);
  assert.ok(m, 'fixture contains the origin-fallback block');
  const nl = m[0].includes('\r\n') ? '\r\n' : '\n';
  return Buffer.from(text.slice(0, m.index) + TUNNEL_COMMENT.join(nl) + text.slice(m.index + m[0].length), 'latin1');
}

// The real tunnel script as it was before the hosting patch, for fixture
// copies. Production has since patched the live file, so once it no longer
// carries the fallback block, its original comes from the newest install
// backup whose metadata names the live script and whose bytes match the
// recorded original SHA-256. Read-only: neither the live script nor a backup is
// ever written; tests only patch copies under RUN. null when neither exists
// (another machine): the synthetic cases still run.
function realTunnelOriginal() {
  const hasBlock = (bytes) => FALLBACK_BLOCK.test(bytes.toString('latin1'));
  if (fs.existsSync(REAL_TUNNEL_SCRIPT)) {
    const live = fs.readFileSync(REAL_TUNNEL_SCRIPT);
    if (hasBlock(live)) return live;
  }
  if (!fs.existsSync(TUNNEL_BACKUP_ROOT)) return null;
  for (const stamp of fs.readdirSync(TUNNEL_BACKUP_ROOT).sort().reverse()) {
    const metaFile = path.join(TUNNEL_BACKUP_ROOT, stamp, 'start-cloudflare-tunnel.backup.json');
    const backup = path.join(TUNNEL_BACKUP_ROOT, stamp, 'start-cloudflare-tunnel.ps1');
    if (!fs.existsSync(metaFile) || !fs.existsSync(backup)) continue;
    const raw = fs.readFileSync(metaFile);
    const text = raw[0] === 0xff && raw[1] === 0xfe ? raw.subarray(2).toString('utf16le') : raw.toString('utf8').replace(/^\uFEFF/, '');
    let meta;
    try { meta = JSON.parse(text); } catch { continue; }
    if (String(meta.path ?? '').toLowerCase() !== REAL_TUNNEL_SCRIPT.toLowerCase()) continue;
    const bytes = fs.readFileSync(backup);
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    if (sha !== String(meta.originalSha256 ?? '').toLowerCase() || !hasBlock(bytes)) continue;
    return bytes;
  }
  return null;
}

// ------------------------------------------------------------------ fixture

const SECRET = 'TOP-SECRET';
let fixture;
let site;

before(() => {
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  for (const old of fs.readdirSync(TEST_ROOT)) {
    if (old.startsWith('run-')) fs.rmSync(path.join(TEST_ROOT, old), { recursive: true, force: true, maxRetries: 5 });
  }
  fs.mkdirSync(RUN, { recursive: true });

  fixture = path.join(RUN, 'fixture');
  const dist = path.join(fixture, 'dist');
  writeFiles(fixture, {
    'outside-secret.txt': `${SECRET}-OUTSIDE`,
    'outside/secret2.txt': `${SECRET}-JUNCTION`,
    'dist/index.html': '<h1>fixture home</h1>',
    'dist/404.html': '<h1>fixture 404</h1>',
    'dist/.secret': `${SECRET}-DOT`,
    'dist/.git/config': `${SECRET}-GIT`,
    'dist/sub/index.html': '<p>sub index</p>',
    'dist/sub/.hidden': `${SECRET}-HIDDEN`,
    'dist/assets/app-abc12345.js': 'console.log(1)',
    'dist/data.json': '{"a":1}',
    'dist/downloads/index.html': '<h1>downloads page</h1>',
    'dist/downloads/setup.exe': 'decoy from the build',
    'downloads/setup.exe': 'MZ fake installer',
    'downloads/.hidden-dl': `${SECRET}-DL`,
  });
  const big = Buffer.alloc(1024 * 1024);
  for (let i = 0; i < big.length; i += 1) big[i] = (i * 31 + 7) & 0xff;
  fs.writeFileSync(path.join(fixture, 'downloads', 'big.bin'), big);
  for (const ext of ['html', 'js', 'mjs', 'css', 'json', 'svg', 'png', 'webp', 'gif', 'otf', 'ttf', 'woff', 'woff2', 'ogg', 'mp3', 'wav', 'webm', 'mp4', 'wasm', 'zip', 'exe', 'sha256', 'txt']) {
    fs.mkdirSync(path.join(dist, 'mime'), { recursive: true });
    fs.writeFileSync(path.join(dist, 'mime', `file.${ext}`), `x-${ext}`);
  }
  fs.symlinkSync(path.join(fixture, 'outside'), path.join(dist, 'link'), 'junction');

  // SP13 WebGL deploy (served at /sp13/), laid out like D:\Dex\GameDev\Deploy\SP13\WebGL.
  const player = 'sp13/releases/r1-abc/player';
  writeFiles(fixture, {
    'sp13/index.html': '<h1>sp13 launcher</h1>',
    'sp13/sp13-launcher.js': 'launch()',
    'sp13/sp13.css': 'body{}',
    'sp13/current.json': '{"releaseId":"r1-abc"}',
    'sp13/sp13-realm-proof-contract.js': 'not allowlisted',
    'sp13/publish.lock': 'lock',
    'sp13/history/old.json': '{}',
    'sp13/staging/next.json': '{}',
    'sp13/.secret-sp13': `${SECRET}-SP13-DOT`,
    'sp13/releases/r1-abc/release.json': '{"id":"r1-abc"}',
    'sp13/releases/r1-abc/notes.txt': 'not allowlisted',
    'sp13/releases/R1-UPPER/release.json': '{}',
    [`${player}/index.html`]: '<p>player</p>',
    [`${player}/.hidden`]: `${SECRET}-SP13-HIDDEN`,
    [`${player}/Build/player.loader.js`]: 'loader()',
    [`${player}/Build/player.wasm.br`]: zlib.brotliCompressSync(Buffer.from('\0asm wasm bytes')),
    [`${player}/Build/player.framework.js.br`]: zlib.brotliCompressSync(Buffer.from('framework()')),
    [`${player}/Build/player.data.br`]: zlib.brotliCompressSync(Buffer.alloc(4096, 7)),
    [`${player}/Build/player.data.gz`]: zlib.gzipSync(Buffer.alloc(4096, 7)),
    [`${player}/Build/player.data`]: Buffer.alloc(64, 7),
    [`${player}/Build/legacy.unityweb`]: Buffer.alloc(64, 9),
  });
  fs.symlinkSync(path.join(fixture, 'outside'), path.join(fixture, player, 'escape'), 'junction');
});

after(async () => {
  for (const pid of spawned) killTree(pid);
  if (IS_WINDOWS) {
    // Safety net: anything still running from this run's folder.
    const needle = RUN.replace(/'/g, "''");
    spawnSync(POWERSHELL, ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='powershell.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${needle}') -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ], { stdio: 'ignore', windowsHide: true });
  }
});

// ------------------------------------------------------------------ server

describe('server.mjs', () => {
  let srv;
  before(async () => {
    srv = await startServer(['--root', path.join(fixture, 'dist'), '--downloads', path.join(fixture, 'downloads'), '--sha', 'f1x7ure',
      '--sp13-root', path.join(fixture, 'sp13')]);
  });
  after(async () => { if (srv) await srv.stop(); });

  test('blocks traversal, encoded traversal, backslashes, dotfiles, junction escapes', async () => {
    const attempts = [
      '/../outside-secret.txt',
      '/..%2foutside-secret.txt',
      '/%2e%2e/outside-secret.txt',
      '/%2E%2E%2Foutside-secret.txt',
      '/%2e%2e%2f%2e%2e%2foutside-secret.txt',
      '/sub/../../outside-secret.txt',
      '/sub/%2e%2e/%2e%2e/outside-secret.txt',
      '/%252e%252e/outside-secret.txt',
      '/..\\outside-secret.txt',
      '/sub\\..\\..\\outside-secret.txt',
      '/..%5coutside-secret.txt',
      '/%5c..%5coutside-secret.txt',
      '//outside-secret.txt',
      '/.secret',
      '/%2esecret',
      '/sub/.hidden',
      '/.git/config',
      '/%2egit/config',
      '/link/secret2.txt',
      '/index.html::$DATA',
      '/index.html%3a%3a$DATA',
      '/index.html.',
      '/index.html%00.txt',
      '/%00',
      '/con',
      '/downloads/../outside-secret.txt',
      '/downloads/%2e%2e/outside-secret.txt',
      '/downloads/..%5c..%5coutside-secret.txt',
      '/downloads/%2e%2e%2f..%2foutside-secret.txt',
      '/downloads/.hidden-dl',
      '/downloads/%2ehidden-dl',
    ];
    for (const target of attempts) {
      const res = await request(srv.port, { target });
      assert.ok([400, 404].includes(res.status), `${target} -> ${res.status}`);
      assert.ok(!res.body.toString().includes(SECRET), `${target} leaked a secret`);
    }
  });

  test('HTML, hashed assets, other static files, 404 page, directories: headers per class', async () => {
    const home = await request(srv.port, { target: '/' });
    assert.equal(home.status, 200);
    assert.equal(home.body.toString(), '<h1>fixture home</h1>');
    assert.equal(home.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(home.headers['cache-control'], 'no-cache, no-transform');
    assert.equal(home.headers['x-content-type-options'], 'nosniff');
    assert.equal(home.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    assert.equal(home.headers['x-frame-options'], 'SAMEORIGIN');
    assert.ok(home.headers.etag);
    assert.ok(home.headers['last-modified']);

    for (const target of ['/sub/', '/sub']) {
      const sub = await request(srv.port, { target });
      assert.equal(sub.status, 200, target);
      assert.equal(sub.body.toString(), '<p>sub index</p>');
      assert.equal(sub.headers['cache-control'], 'no-cache, no-transform');
    }

    const asset = await request(srv.port, { target: '/assets/app-abc12345.js' });
    assert.equal(asset.status, 200);
    assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.equal(asset.headers['content-type'], 'text/javascript; charset=utf-8');

    const data = await request(srv.port, { target: '/data.json' });
    assert.equal(data.headers['cache-control'], 'no-cache');
    assert.equal(data.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(data.headers['x-content-type-options'], 'nosniff');

    const missing = await request(srv.port, { target: '/nope/nothing-here' });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.toString(), '<h1>fixture 404</h1>');
    assert.equal(missing.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(missing.headers['cache-control'], 'no-cache, no-transform');

    const head = await request(srv.port, { method: 'HEAD', target: '/' });
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.equal(head.headers['content-length'], String('<h1>fixture home</h1>'.length));

    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const res = await request(srv.port, { method, target: '/' });
      assert.equal(res.status, 405, method);
      assert.equal(res.headers.allow, 'GET, HEAD');
    }
  });

  test('MIME types', async () => {
    const expected = {
      html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json',
      svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp', gif: 'image/gif', otf: 'font/otf', ttf: 'font/ttf',
      woff: 'font/woff', woff2: 'font/woff2', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'video/webm',
      mp4: 'video/mp4', wasm: 'application/wasm', zip: 'application/zip', exe: 'application/vnd.microsoft.portable-executable',
      sha256: 'text/plain', txt: 'text/plain',
    };
    for (const [ext, type] of Object.entries(expected)) {
      const res = await request(srv.port, { target: `/mime/file.${ext}` });
      assert.equal(res.status, 200, ext);
      assert.equal(res.headers['content-type'].split(';')[0], type, ext);
    }
  });

  test('downloads: attachment, no-store, Range 206/416, HEAD, If-Range, no 304', async () => {
    const big = fs.readFileSync(path.join(fixture, 'downloads', 'big.bin'));
    const size = big.length;

    const full = await request(srv.port, { target: '/downloads/big.bin' });
    assert.equal(full.status, 200);
    assert.equal(full.headers['cache-control'], 'private, no-store');
    assert.equal(full.headers['accept-ranges'], 'bytes');
    assert.equal(full.headers['content-disposition'], 'attachment; filename="big.bin"; filename*=UTF-8\'\'big.bin');
    assert.equal(full.headers['content-length'], String(size));
    assert.ok(full.body.equals(big));

    const exe = await request(srv.port, { target: '/downloads/setup.exe' });
    assert.equal(exe.status, 200);
    assert.equal(exe.headers['content-type'], 'application/vnd.microsoft.portable-executable');
    assert.match(exe.headers['content-disposition'], /^attachment; filename="setup\.exe"/);

    const first = await request(srv.port, { target: '/downloads/big.bin', headers: { range: 'bytes=0-99' } });
    assert.equal(first.status, 206);
    assert.equal(first.headers['content-range'], `bytes 0-99/${size}`);
    assert.equal(first.headers['content-length'], '100');
    assert.ok(first.body.equals(big.subarray(0, 100)));

    const open = await request(srv.port, { target: '/downloads/big.bin', headers: { range: 'bytes=1000-' } });
    assert.equal(open.status, 206);
    assert.equal(open.headers['content-range'], `bytes 1000-${size - 1}/${size}`);
    assert.ok(open.body.equals(big.subarray(1000)));

    const suffix = await request(srv.port, { target: '/downloads/big.bin', headers: { range: 'bytes=-10' } });
    assert.equal(suffix.status, 206);
    assert.equal(suffix.headers['content-range'], `bytes ${size - 10}-${size - 1}/${size}`);
    assert.ok(suffix.body.equals(big.subarray(size - 10)));

    const clamped = await request(srv.port, { target: '/downloads/big.bin', headers: { range: `bytes=${size - 5}-${size + 500}` } });
    assert.equal(clamped.status, 206);
    assert.equal(clamped.headers['content-range'], `bytes ${size - 5}-${size - 1}/${size}`);

    for (const range of [`bytes=${size}-`, `bytes=${size + 10}-${size + 20}`, 'bytes=-0']) {
      const bad = await request(srv.port, { target: '/downloads/big.bin', headers: { range } });
      assert.equal(bad.status, 416, range);
      assert.equal(bad.headers['content-range'], `bytes */${size}`);
      assert.equal(bad.body.length, 0);
    }

    const multi = await request(srv.port, { target: '/downloads/big.bin', headers: { range: 'bytes=0-1,5-6' } });
    assert.equal(multi.status, 200);
    assert.equal(multi.body.length, size);

    const head = await request(srv.port, { method: 'HEAD', target: '/downloads/big.bin' });
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-length'], String(size));
    assert.equal(head.headers['accept-ranges'], 'bytes');
    assert.equal(head.headers['cache-control'], 'private, no-store');
    assert.equal(head.body.length, 0);

    const headRange = await request(srv.port, { method: 'HEAD', target: '/downloads/big.bin', headers: { range: 'bytes=0-9' } });
    assert.equal(headRange.status, 206);
    assert.equal(headRange.headers['content-length'], '10');
    assert.equal(headRange.body.length, 0);

    const staleIfRange = await request(srv.port, { target: '/downloads/big.bin', headers: { range: 'bytes=0-9', 'if-range': '"stale"' } });
    assert.equal(staleIfRange.status, 200);
    const goodIfRange = await request(srv.port, { target: '/downloads/big.bin', headers: { range: 'bytes=0-9', 'if-range': full.headers.etag } });
    assert.equal(goodIfRange.status, 206);

    const noConditional = await request(srv.port, { target: '/downloads/big.bin', headers: { 'if-none-match': full.headers.etag } });
    assert.equal(noConditional.status, 200);

    const missing = await request(srv.port, { target: '/downloads/nope.exe' });
    assert.equal(missing.status, 404);
    assert.match(missing.body.toString(), /fixture 404/);
  });

  test('downloads: the /downloads/ page comes from the build; published files still win', async () => {
    for (const target of ['/downloads/', '/downloads']) {
      const page = await request(srv.port, { target });
      assert.equal(page.status, 200, target);
      assert.match(page.headers['content-type'], /^text\/html/, target);
      assert.equal(page.headers['cache-control'], 'no-cache, no-transform', target);
      assert.equal(page.headers['content-disposition'], undefined, target);
      assert.match(page.body.toString(), /downloads page/, target);
    }
    // The downloads folder wins over a same-named file in the build.
    const exe = await request(srv.port, { target: '/downloads/setup.exe' });
    assert.equal(exe.status, 200);
    assert.equal(exe.body.toString(), 'MZ fake installer');
    assert.equal(exe.headers['cache-control'], 'private, no-store');
    assert.match(exe.headers['content-disposition'], /^attachment;/);
  });

  test('304 via ETag and If-Modified-Since', async () => {
    const first = await request(srv.port, { target: '/data.json' });
    const etag = first.headers.etag;
    assert.match(etag, /^"[0-9a-f]+-[0-9a-f]+"$/);

    const again = await request(srv.port, { target: '/data.json', headers: { 'if-none-match': etag } });
    assert.equal(again.status, 304);
    assert.equal(again.body.length, 0);
    assert.equal(again.headers.etag, etag);
    assert.equal(again.headers['cache-control'], 'no-cache');

    const weak = await request(srv.port, { target: '/data.json', headers: { 'if-none-match': `"zzz", W/${etag}` } });
    assert.equal(weak.status, 304);

    const html = await request(srv.port, { target: '/', headers: { 'if-modified-since': first.headers['last-modified'] } });
    assert.equal(html.status, 304);

    const changed = await request(srv.port, { target: '/data.json', headers: { 'if-none-match': '"other"' } });
    assert.equal(changed.status, 200);
  });

  test('www.dex.place redirects to https://dex.place with path and query', async () => {
    for (const host of ['www.dex.place', 'WWW.DEX.PLACE:443']) {
      const res = await request(srv.port, { target: '/some/deep/path?x=1&y=two', headers: { host } });
      assert.equal(res.status, 301, host);
      assert.equal(res.headers.location, 'https://dex.place/some/deep/path?x=1&y=two');
    }
    const apex = await request(srv.port, { target: '/', headers: { host: 'dex.place' } });
    assert.equal(apex.status, 200);
  });

  test('/healthz and /__deploy', async () => {
    const health = await request(srv.port, { target: '/healthz' });
    assert.equal(health.status, 200);
    assert.equal(health.body.toString(), 'ok');
    assert.equal(health.headers['cache-control'], 'no-store');

    const deploy = await request(srv.port, { target: '/__deploy' });
    assert.equal(deploy.status, 200);
    assert.equal(deploy.headers['content-type'], 'application/json; charset=utf-8');
    assert.deepEqual(JSON.parse(deploy.body.toString()), { sha: 'f1x7ure', deployedAt: null, previousSha: null });
  });

  // ---------------------------------------------------------------- /sp13/
  // Same behaviour as the v2 origin (SUMMER PROJECT 3 serve-production.mjs).

  const REL = '/sp13/releases/r1-abc';
  const BUILD = `${REL}/player/Build`;
  const IMMUTABLE = 'public, max-age=31536000, immutable';

  test('/sp13 redirects (308) to /sp13/, keeping the query, never cached', async () => {
    for (const [target, location] of [['/sp13', '/sp13/'], ['/sp13?x=1&y=two', '/sp13/?x=1&y=two'], ['/sp13?', '/sp13/']]) {
      const res = await request(srv.port, { target });
      assert.equal(res.status, 308, target);
      assert.equal(res.headers.location, location, target);
      assert.equal(res.headers['cache-control'], 'no-store', target);
      assert.equal(res.body.length, 0, target);
    }
  });

  test('/sp13/ serves the allowlisted root files and releases with the v2 cache headers', async () => {
    const expect = [
      ['/sp13/', 200, 'text/html; charset=utf-8', 'no-cache', '<h1>sp13 launcher</h1>'],
      ['/sp13/index.html', 200, 'text/html; charset=utf-8', 'no-cache', '<h1>sp13 launcher</h1>'],
      ['/sp13/?v=2', 200, 'text/html; charset=utf-8', 'no-cache', '<h1>sp13 launcher</h1>'],
      ['/sp13/sp13-launcher.js', 200, 'text/javascript; charset=utf-8', 'no-cache', 'launch()'],
      ['/sp13/sp13.css', 200, 'text/css; charset=utf-8', 'no-cache', 'body{}'],
      ['/sp13/current.json', 200, 'application/json; charset=utf-8', 'no-store', '{"releaseId":"r1-abc"}'],
      [`${REL}/release.json`, 200, 'application/json; charset=utf-8', IMMUTABLE, '{"id":"r1-abc"}'],
      [`${REL}/player/index.html`, 200, 'text/html; charset=utf-8', IMMUTABLE, '<p>player</p>'],
      [`${BUILD}/player.loader.js`, 200, 'text/javascript; charset=utf-8', IMMUTABLE, 'loader()'],
    ];
    for (const [target, status, type, cache, body] of expect) {
      const res = await request(srv.port, { target });
      assert.equal(res.status, status, target);
      assert.equal(res.headers['content-type'], type, target);
      assert.equal(res.headers['cache-control'], cache, target);
      assert.equal(res.headers['cloudflare-cdn-cache-control'], cache, target);
      assert.equal(res.headers['content-encoding'], undefined, target);
      assert.equal(res.headers['x-content-type-options'], 'nosniff', target);
      assert.ok(res.headers.etag && res.headers['last-modified'], target);
      assert.equal(res.body.toString(), body, target);
    }

    // Everything else under /sp13/ is 404, directories included.
    for (const target of [
      '/sp13/sp13-realm-proof-contract.js', '/sp13/publish.lock', '/sp13/history/old.json', '/sp13/staging/next.json',
      '/sp13/history/', '/sp13/releases/', `${REL}/`, `${REL}/player/`, `${BUILD}/`, `${REL}/notes.txt`,
      '/sp13/releases/R1-UPPER/release.json', '/sp13/releases/-bad/release.json', '/sp13/releases/r1-abc/release.json/',
      '/sp13/index.html/', '/sp13/INDEX.HTML', '/sp13/nope.js', `${BUILD}/missing.wasm.br`, '/SP13/',
    ]) {
      const res = await request(srv.port, { target });
      assert.equal(res.status, 404, target);
      assert.equal(res.headers['cloudflare-cdn-cache-control'], undefined, target);
    }

    // Only /sp13/ responses carry the Cloudflare CDN header.
    for (const target of ['/', '/data.json', '/assets/app-abc12345.js']) {
      assert.equal((await request(srv.port, { target })).headers['cloudflare-cdn-cache-control'], undefined, target);
    }
  });

  test('pre-compressed player files: Content-Encoding plus the MIME type of the underlying file; Range and HEAD work', async () => {
    const files = [
      ['player.wasm.br', 'br', 'application/wasm', '\0asm wasm bytes'],
      ['player.framework.js.br', 'br', 'text/javascript; charset=utf-8', 'framework()'],
      ['player.data.br', 'br', 'application/octet-stream', Buffer.alloc(4096, 7).toString()],
      ['player.data.gz', 'gzip', 'application/octet-stream', Buffer.alloc(4096, 7).toString()],
      ['player.data', undefined, 'application/octet-stream', Buffer.alloc(64, 7).toString()],
      ['legacy.unityweb', undefined, 'application/octet-stream', Buffer.alloc(64, 9).toString()],
    ];
    for (const [name, encoding, type, plain] of files) {
      const onDisk = fs.readFileSync(path.join(fixture, 'sp13', 'releases', 'r1-abc', 'player', 'Build', name));
      const res = await request(srv.port, { target: `${BUILD}/${name}`, headers: { 'accept-encoding': 'identity' } });
      assert.equal(res.status, 200, name);
      assert.equal(res.headers['content-encoding'], encoding, name);
      assert.equal(res.headers['content-type'], type, name);
      assert.equal(res.headers['cache-control'], IMMUTABLE, name);
      assert.equal(res.headers['cloudflare-cdn-cache-control'], IMMUTABLE, name);
      assert.equal(res.headers['content-length'], String(onDisk.length), name);
      assert.ok(res.body.equals(onDisk), `${name}: bytes sent as stored`);
      const decoded = encoding === 'br' ? zlib.brotliDecompressSync(res.body) : encoding === 'gzip' ? zlib.gunzipSync(res.body) : res.body;
      assert.equal(decoded.toString(), plain, `${name}: decodes to the original`);
    }

    const wasm = fs.readFileSync(path.join(fixture, 'sp13', 'releases', 'r1-abc', 'player', 'Build', 'player.wasm.br'));
    const part = await request(srv.port, { target: `${BUILD}/player.wasm.br`, headers: { range: 'bytes=0-9' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers['content-range'], `bytes 0-9/${wasm.length}`);
    assert.equal(part.headers['content-encoding'], 'br');
    assert.equal(part.headers['cloudflare-cdn-cache-control'], IMMUTABLE);
    assert.ok(part.body.equals(wasm.subarray(0, 10)));

    const head = await request(srv.port, { method: 'HEAD', target: `${BUILD}/player.wasm.br` });
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-length'], String(wasm.length));
    assert.equal(head.headers['content-encoding'], 'br');
    assert.equal(head.body.length, 0);

    const bad = await request(srv.port, { target: `${BUILD}/player.wasm.br`, headers: { range: `bytes=${wasm.length + 5}-` } });
    assert.equal(bad.status, 416);
    assert.equal(bad.headers['cache-control'], 'no-store', 'an error is never cached for a year');
    assert.equal(bad.headers['cloudflare-cdn-cache-control'], undefined);
    assert.equal(bad.headers['content-encoding'], undefined);
  });

  test('/sp13/ revalidation: 304 repeats Cache-Control as Cloudflare-CDN-Cache-Control; current.json is never 304', async () => {
    for (const [target, cache] of [[`${BUILD}/player.wasm.br`, IMMUTABLE], ['/sp13/sp13.css', 'no-cache'], ['/sp13/', 'no-cache'], [`${REL}/release.json`, IMMUTABLE]]) {
      const first = await request(srv.port, { target });
      for (const inm of [first.headers.etag, `W/${first.headers.etag}`, '*']) {
        const again = await request(srv.port, { target, headers: { 'if-none-match': inm } });
        assert.equal(again.status, 304, `${target} ${inm}`);
        assert.equal(again.body.length, 0);
        assert.equal(again.headers['cache-control'], cache, target);
        assert.equal(again.headers['cloudflare-cdn-cache-control'], cache, target);
        assert.equal(again.headers.etag, first.headers.etag, target);
        assert.equal(again.headers['content-encoding'], undefined, 'a 304 has no Content-Encoding (as in v2)');
      }
    }
    const current = await request(srv.port, { target: '/sp13/current.json' });
    for (const headers of [{ 'if-none-match': current.headers.etag }, { 'if-none-match': '*' }, { 'if-modified-since': current.headers['last-modified'] }]) {
      const again = await request(srv.port, { target: '/sp13/current.json', headers });
      assert.equal(again.status, 200, JSON.stringify(headers));
      assert.equal(again.body.toString(), '{"releaseId":"r1-abc"}');
      assert.equal(again.headers['cloudflare-cdn-cache-control'], 'no-store');
    }
  });

  test('/sp13/ blocks traversal, dotfiles, junction escapes and Windows aliases like the rest of the server', async () => {
    const attempts = [
      '/sp13/../outside-secret.txt',
      '/sp13/%2e%2e/outside-secret.txt',
      '/sp13/%2e%2e%2f%2e%2e%2foutside-secret.txt',
      '/sp13/releases/%2e%2e/%2e%2e/outside-secret.txt',
      `${REL}/player/%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2foutside-secret.txt`,
      `${REL}/player/..%5c..%5c..%5c..%5coutside-secret.txt`,
      `${REL}/player\\..\\..\\..\\..\\outside-secret.txt`,
      `${REL}/player/escape/secret2.txt`,
      `${REL}/player/.hidden`,
      `${REL}/player/%2ehidden`,
      '/sp13/.secret-sp13',
      '/sp13/%2esecret-sp13',
      `${REL}/player//Build/player.loader.js`,
      `${BUILD}/player.wasm.br::$DATA`,
      `${BUILD}/player.wasm.br%3a%3a$DATA`,
      `${BUILD}/player.wasm.br.`,
      `${BUILD}/player.wasm.br%00`,
      `${REL}/player/con`,
      `${REL}/player/aux.js`,
    ];
    for (const target of attempts) {
      const res = await request(srv.port, { target });
      assert.ok([400, 404].includes(res.status), `${target} -> ${res.status}`);
      assert.ok(!res.body.toString().includes(SECRET), `${target} leaked a secret`);
    }
  });

  test('a missing SP13 root answers 404 under /sp13/ (no crash) and is picked up once it exists', async () => {
    const missing = path.join(RUN, 'sp13-later');
    const other = await startServer(['--root', path.join(fixture, 'dist'), '--downloads', path.join(fixture, 'downloads'), '--sp13-root', missing]);
    try {
      for (const target of ['/sp13/', '/sp13/current.json', `${BUILD}/player.wasm.br`]) {
        assert.equal((await request(other.port, { target })).status, 404, target);
      }
      assert.equal((await request(other.port, { target: '/sp13' })).status, 308);
      assert.equal((await request(other.port, { target: '/healthz' })).body.toString(), 'ok');
      assert.equal((await request(other.port, { target: '/' })).status, 200);
      writeFiles(missing, { 'index.html': '<h1>late sp13</h1>' });
      const late = await request(other.port, { target: '/sp13/' });
      assert.equal(late.status, 200);
      assert.equal(late.body.toString(), '<h1>late sp13</h1>');
    } finally {
      await other.stop();
    }
  });
});

// ------------------------------------------------------------------ deploy

describe('deploy.mjs', () => {
  let bare;
  let work;
  let root;
  let srv;
  const commits = {};

  const sitePackage = { name: 'dex-place-ops-fixture', version: '1.0.0', private: true, scripts: { build: 'node build.mjs' } };
  const lockfile = {
    name: 'dex-place-ops-fixture', version: '1.0.0', lockfileVersion: 3, requires: true,
    packages: { '': { name: 'dex-place-ops-fixture', version: '1.0.0' } },
  };
  const goodBuild = [
    "import fs from 'node:fs';",
    "const label = fs.readFileSync('label.txt', 'utf8').trim();",
    "fs.mkdirSync('dist/assets', { recursive: true });",
    'fs.writeFileSync(\'dist/index.html\', `<h1>build-${label}</h1>`);',
    "fs.writeFileSync('dist/404.html', '<h1>missing</h1>');",
    'fs.writeFileSync(`dist/assets/app-${label.toLowerCase()}1234567.js`, `console.log(${JSON.stringify(label)})`);',
    "console.log('built', label);",
  ].join('\n');
  const failingBuild = "console.error('intentional failure'); process.exit(1);";

  function opsFiles(extra = {}) {
    const files = {};
    for (const name of fs.readdirSync(OPS)) {
      if (/\.(mjs|ps1|md)$/.test(name)) files[`ops/${name}`] = fs.readFileSync(path.join(OPS, name));
    }
    return { ...files, ...extra };
  }

  function commit(label, files, { lock = false } = {}) {
    for (const name of ['package-lock.json']) fs.rmSync(path.join(work, name), { force: true });
    writeFiles(work, {
      'package.json': JSON.stringify(sitePackage, null, 2),
      'label.txt': label,
      ...(lock ? { 'package-lock.json': JSON.stringify(lockfile, null, 2) } : {}),
      ...files,
    });
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', `commit ${label}`);
    git(work, 'push', '-q', 'origin', 'HEAD:main');
    commits[label] = git(work, 'rev-parse', 'HEAD');
    return commits[label];
  }

  function deployArgs(extra) {
    return ['--deploy-root', root, '--repo-url', bare, '--smoke-ports', SMOKE_PORTS, ...extra];
  }

  function runDeploy(extra, script = DEPLOY) {
    const res = spawnSync(process.execPath, [script, ...deployArgs(extra)], { encoding: 'utf8', timeout: 300_000, windowsHide: true });
    return { code: res.status, out: `${res.stdout}${res.stderr}` };
  }

  function runDeployAsync(extra, script = DEPLOY) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [script, ...deployArgs(extra)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      spawned.add(child.pid);
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { out += d; });
      child.on('close', (code) => { spawned.delete(child.pid); resolve({ code, out }); });
    });
  }

  const state = () => JSON.parse(fs.readFileSync(path.join(root, 'state.json'), 'utf8'));
  const page = async () => (await request(srv.port, { target: '/' })).body.toString();
  const deployInfo = async () => JSON.parse((await request(srv.port, { target: '/__deploy' })).body.toString());
  const short = (sha) => sha.slice(0, 12);
  const goodDeploy = () => path.join(root, 'ops-good', 'deploy.mjs');

  // Pushes a commit whose ops/ is the current source plus `opsOverrides` (or exactly
  // `files`), runs one deploy, and checks that it was refused before going live:
  // A stays live and served, repo/ stays on A, the failure names the reason, and
  // the candidate's workspace and scratch folders are gone.
  async function expectRejected(label, opsOverrides, reason, files = null) {
    const sha = commit(label, files || { 'build.mjs': goodBuild, ...opsFiles(opsOverrides) });
    const res = runDeploy(['--once']);
    assert.equal(res.code, 1, res.out);
    const s = state();
    assert.equal(s.sha, commits.A, 'A stays live');
    assert.equal(s.lastFailedSha, sha);
    assert.match(s.lastFailedReason, reason);
    assert.equal(await page(), '<h1>build-A</h1>');
    assert.equal(git(path.join(root, 'repo'), 'rev-parse', 'HEAD'), commits.A, 'repo/ (what the supervisor runs) stays on A');
    assert.ok(!fs.existsSync(path.join(root, 'builds', short(sha))), 'rejected workspace removed');
    assert.deepEqual(fs.readdirSync(path.join(root, 'tmp')), [], 'scratch folders cleaned up');
    return sha;
  }

  before(async () => {
    bare = path.join(RUN, 'origin.git');
    work = path.join(RUN, 'work');
    root = path.join(RUN, 'deploy-root');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'main', bare], { windowsHide: true });
    fs.mkdirSync(work, { recursive: true });
    git(work, 'init', '-q', '-b', 'main');
    git(work, 'remote', 'add', 'origin', bare);
    fs.mkdirSync(root, { recursive: true });
    srv = await startServer(['--deploy-root', root], [18500, 18599]);
  });
  after(async () => { if (srv) await srv.stop(); });

  test('before any deploy the server answers 503 and /healthz is not ok', async () => {
    const health = await request(srv.port, { target: '/healthz' });
    assert.equal(health.status, 503);
    const home = await request(srv.port, { target: '/' });
    assert.equal(home.status, 503);
  });

  test('deploys commit A (npm ci path) and the running server picks it up without restart', async () => {
    const a = commit('A', { 'build.mjs': goodBuild, ...opsFiles() }, { lock: true });
    const res = runDeploy(['--once']);
    assert.equal(res.code, 0, res.out);
    const s = state();
    assert.equal(s.sha, a);
    assert.equal(s.build, short(a));
    assert.equal(s.previousSha, null);
    const buildDir = path.join(root, 'builds', short(a));
    assert.ok(fs.existsSync(path.join(buildDir, 'dist', 'index.html')));
    assert.deepEqual(fs.readdirSync(buildDir).sort(), ['.dex-build.json', 'dist'], 'workspace trimmed to dist + marker');
    assert.equal(git(path.join(root, 'repo'), 'rev-parse', 'HEAD'), a);

    await waitFor(async () => (await page()) === '<h1>build-A</h1>', 5000, 'build A served');
    assert.equal((await request(srv.port, { target: '/healthz' })).body.toString(), 'ok');
    const info = await deployInfo();
    assert.equal(info.sha, a);
    assert.equal(info.previousSha, null);
    assert.ok(!('lastFailedSha' in info));
    const serialized = JSON.stringify(info);
    assert.ok(!serialized.includes('\\\\') && !serialized.includes(':\\'), '/__deploy has no local paths');
  });

  test('deploys commit B (npm install path) with zero failed requests while hammering GET /', async () => {
    const a = commits.A;
    const b = commit('B', { 'build.mjs': goodBuild, ...opsFiles() });
    const agent = new http.Agent({ keepAlive: true, maxSockets: 16 });
    const seen = new Set();
    const failures = [];
    let total = 0;
    let stop = false;
    const worker = async () => {
      while (!stop) {
        try {
          const res = await request(srv.port, { target: '/', agent });
          total += 1;
          if (res.status !== 200) failures.push(`status ${res.status}`);
          const m = /build-([A-Z])/.exec(res.body.toString());
          if (m) seen.add(m[1]); else failures.push(`body ${res.body.toString().slice(0, 40)}`);
        } catch (err) {
          total += 1;
          failures.push(err.code || err.message);
        }
      }
    };
    const workers = Array.from({ length: 16 }, worker);
    const res = await runDeployAsync(['--once']);
    await sleep(750);
    stop = true;
    await Promise.all(workers);
    agent.destroy();

    assert.equal(res.code, 0, res.out);
    assert.deepEqual(failures, [], `failed requests: ${failures.slice(0, 5).join(', ')}`);
    assert.ok(total > 200, `only ${total} requests`);
    assert.ok(seen.has('A') && seen.has('B'), `saw builds ${[...seen]}`);
    console.log(`# hammer: ${total} requests during the A->B switch, ${failures.length} failed`);

    assert.equal(await page(), '<h1>build-B</h1>');
    const info = await deployInfo();
    assert.equal(info.sha, b);
    assert.equal(info.previousSha, a);
    assert.ok(fs.existsSync(path.join(root, 'builds', short(a), 'dist', 'index.html')), 'previous build kept');
  });

  test('a failing build keeps B live and records lastFailedSha', async () => {
    const b = commits.B;
    const c = commit('C', { 'build.mjs': failingBuild });
    const res = runDeploy(['--once']);
    assert.equal(res.code, 1, res.out);
    const s = state();
    assert.equal(s.sha, b);
    assert.equal(s.lastFailedSha, c);
    assert.ok(s.lastFailedLog && !path.isAbsolute(s.lastFailedLog));
    const log = fs.readFileSync(path.join(root, s.lastFailedLog), 'utf8');
    assert.match(log, /intentional failure/);
    assert.match(log, /FAILED: npm run build failed/);
    assert.ok(!fs.existsSync(path.join(root, 'builds', short(c))), 'failed workspace removed');
    assert.equal(git(path.join(root, 'repo'), 'rev-parse', 'HEAD'), b, 'repo/ stays on the live commit');

    assert.equal(await page(), '<h1>build-B</h1>');
    const info = await deployInfo();
    assert.equal(info.sha, b);
    assert.equal(info.lastFailedSha, c);

    const again = runDeploy(['--once']);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /failed before; waiting for a new commit/);
    assert.equal(state().sha, b);
  });

  test('single-instance lock: a second deployer exits 73', () => {
    const lock = path.join(root, 'deploy.lock');
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, mode: 'test', startedAt: new Date().toISOString() }));
    try {
      const res = runDeploy(['--once']);
      assert.equal(res.code, 73, res.out);
    } finally {
      fs.rmSync(lock, { force: true });
    }
    fs.writeFileSync(lock, JSON.stringify({ pid: 999999, mode: 'stale', startedAt: '2020-01-01T00:00:00Z' }));
    const stale = runDeploy(['--once']);
    assert.equal(stale.code, 0, `stale lock should be taken over: ${stale.out}`);
    assert.ok(!fs.existsSync(lock), 'lock released on exit');
  });

  test('--rollback switches back to the previous build and holds the rolled-back commit', async () => {
    const res = runDeploy(['--rollback']);
    assert.equal(res.code, 0, res.out);
    const s = state();
    assert.equal(s.sha, commits.A);
    assert.equal(s.previousSha, commits.B);
    assert.equal(s.heldSha, commits.B);
    await waitFor(async () => (await page()) === '<h1>build-A</h1>', 5000, 'build A served after rollback');
    const info = await deployInfo();
    assert.equal(info.sha, commits.A);
    assert.equal(info.previousSha, commits.B);
  });

  test('a commit that changes ops/ deploys and exits 75 when run from repo/ops (self-update), pruning to --keep', async () => {
    const d = commit('D', { 'build.mjs': goodBuild, ...opsFiles({ 'ops/NOTE.txt': 'ops changed in D' }) });
    const repoDeploy = path.join(root, 'repo', 'ops', 'deploy.mjs');
    assert.ok(fs.existsSync(repoDeploy));
    const res = runDeploy(['--once', '--keep', '1'], repoDeploy);
    assert.equal(res.code, 75, res.out);
    const s = state();
    assert.equal(s.sha, d);
    assert.equal(s.previousSha, commits.A);
    assert.equal(git(path.join(root, 'repo'), 'rev-parse', 'HEAD'), d);
    assert.ok(fs.existsSync(path.join(root, 'repo', 'ops', 'NOTE.txt')));
    await waitFor(async () => (await page()) === '<h1>build-D</h1>', 5000, 'build D served');
    assert.deepEqual(fs.readdirSync(path.join(root, 'builds')).sort(), [short(commits.A), short(d)].sort(), 'keep=1 retains live + previous only');
  });

  test('a rolled-back commit is not redeployed until main moves', async () => {
    const back = runDeploy(['--rollback']);
    assert.equal(back.code, 0, back.out);
    assert.equal(state().sha, commits.A);
    const res = runDeploy(['--once']);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /was rolled back; waiting for a new commit/);
    assert.equal(state().sha, commits.A);
    assert.equal(state().heldSha, commits.D);
    assert.equal(await page(), '<h1>build-A</h1>');
  });

  test('--force redeploys a rolled-back commit by reusing its trimmed build, re-checking its ops/ first', async () => {
    const buildDir = path.join(root, 'builds', short(commits.D));
    assert.deepEqual(fs.readdirSync(buildDir).sort(), ['.dex-build.json', 'dist'], 'D was trimmed after it went live');
    const res = runDeploy(['--once', '--force']);
    assert.equal(res.code, 0, res.out);
    assert.equal(state().sha, commits.D);
    await waitFor(async () => (await page()) === '<h1>build-D</h1>', 5000, 'D served again');
    const log = fs.readFileSync(path.join(root, 'logs', 'builds', fs.readdirSync(path.join(root, 'logs', 'builds')).sort().pop()), 'utf8');
    assert.match(log, /reusing existing build/);
    assert.match(log, /follow-mode GET \/ -> 200/);
    assert.match(log, /deployer self-test passed/);
    assert.deepEqual(fs.readdirSync(buildDir).sort(), ['.dex-build.json', 'dist'], 'trimmed again after going live');

    const back = runDeploy(['--rollback']);
    assert.equal(back.code, 0, back.out);
    assert.equal(state().sha, commits.A);
    assert.equal(state().heldSha, commits.D);
    await waitFor(async () => (await page()) === '<h1>build-A</h1>', 5000, 'A served after rolling back again');
  });

  test('ops-good/ holds the ops/ that repo/ops last ran a full cycle with; --status and --rollback work from it', async () => {
    // The D test ran repo/ops/deploy.mjs while repo/ was at B, so B's ops/ is the proven code.
    const marker = JSON.parse(fs.readFileSync(path.join(root, 'ops-good', '.dex-ops.json'), 'utf8'));
    assert.equal(marker.sha, commits.B);
    assert.equal(marker.tree, git(path.join(root, 'repo'), 'rev-parse', `${commits.B}:ops`));
    assert.equal(fs.readFileSync(goodDeploy(), 'utf8'), fs.readFileSync(DEPLOY, 'utf8'));
    assert.ok(fs.existsSync(path.join(root, 'ops-good', 'start-origin.ps1')));

    const status = runDeploy(['--status'], goodDeploy());
    assert.equal(status.code, 0, status.out);
    assert.equal(JSON.parse(status.out.slice(status.out.search(/^\{/m))).sha, commits.A);

    const there = runDeploy(['--rollback'], goodDeploy());
    assert.equal(there.code, 0, there.out);
    assert.equal(state().sha, commits.D);
    await waitFor(async () => (await page()) === '<h1>build-D</h1>', 5000, 'D served after ops-good rollback');
    const back = runDeploy(['--rollback'], goodDeploy());
    assert.equal(back.code, 0, back.out);
    assert.equal(state().sha, commits.A);
    assert.equal(state().heldSha, commits.D);
    await waitFor(async () => (await page()) === '<h1>build-A</h1>', 5000, 'A served again');
  });

  test("a commit whose own ops/server.mjs is broken fails the smoke test and stays off", async () => {
    const e = commit('E', { 'build.mjs': goodBuild, ...opsFiles({ 'ops/server.mjs': 'this is not javascript (' }) });
    const res = runDeploy(['--once']);
    assert.equal(res.code, 1, res.out);
    const s = state();
    assert.equal(s.sha, commits.A);
    assert.equal(s.lastFailedSha, e);
    assert.match(s.lastFailedReason, /smoke server exited early/);
    assert.equal(await page(), '<h1>build-A</h1>');
  });

  test('a server.mjs that only crashes when following state.json is rejected by the follow-mode smoke test', async () => {
    const serverSource = patchOps('server.mjs',
      '  constructor(deployRoot, onEvent) {\n',
      "  constructor(deployRoot, onEvent) {\n    throw new Error('follow mode broken');\n");
    await expectRejected('followcrash', { 'ops/server.mjs': serverSource }, /follow-mode smoke server exited early.*follow mode broken/);
  });

  test('a server.mjs that stops switching builds when state.json changes is rejected', async () => {
    const serverSource = patchOps('server.mjs',
      '    const changed = !this.current || this.current.root !== root;\n',
      '    if (this.current) return;\n    const changed = !this.current || this.current.root !== root;\n');
    await expectRejected('stuck', { 'ops/server.mjs': serverSource }, /follow-mode smoke: after the switch GET \/ differs/);
  });

  test('a deploy.mjs that does not parse never goes live, and the live puller in repo/ops keeps working', async () => {
    const broken = `${fs.readFileSync(DEPLOY, 'utf8')}\nthis is not javascript {{{\n`;
    await expectRejected('deploysyntax', { 'ops/deploy.mjs': broken }, /node --check ops\/deploy\.mjs failed/);
    const repoDeploy = path.join(root, 'repo', 'ops', 'deploy.mjs');
    const again = runDeploy(['--once'], repoDeploy);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /failed before; waiting for a new commit/);
  });

  test('a deploy.mjs that cannot complete a deploy is rejected by the deployer self-test', async () => {
    const broken = patchOps('deploy.mjs', 'async function cycle(ctx) {\n', "async function cycle(ctx) {\n  throw new Error('cycle broken');\n");
    await expectRejected('deploycycle', { 'ops/deploy.mjs': broken }, /deployer self-test: --once exited 1: .*cycle broken/);
  });

  test('a deploy.mjs whose --rollback is broken is rejected by the deployer self-test', async () => {
    const broken = patchOps('deploy.mjs', 'async function rollback(ctx) {\n', "async function rollback(ctx) {\n  throw new UserError('rollback broken');\n");
    await expectRejected('deployrollback', { 'ops/deploy.mjs': broken }, /deployer self-test: --rollback exited 1: .*rollback broken/);
  });

  test('a commit without ops/start-origin.ps1 (the scheduled task entry point) is rejected', async () => {
    writeFiles(work, opsFiles());
    fs.rmSync(path.join(work, 'ops', 'start-origin.ps1'));
    await expectRejected('nostart', null, /commit has no ops\/start-origin\.ps1/, { 'build.mjs': goodBuild });
  });

  test('PowerShell that does not parse, calls an undefined function, or is not ASCII is rejected', { skip: !IS_WINDOWS && 'Windows only' }, async () => {
    await expectRejected('psparse', {
      'ops/hosting-common.ps1': `${fs.readFileSync(path.join(OPS, 'hosting-common.ps1'), 'utf8')}\nfunction Broken( {\n`,
    }, /PowerShell check failed: ops\/hosting-common\.ps1 line \d+ does not parse/);
    await expectRejected('pscommand', {
      'ops/start-origin.ps1': patchOps('start-origin.ps1', 'Get-DexOriginPaths -DeployRoot $DeployRoot', 'Get-DexOriginPathz -DeployRoot $DeployRoot'),
    }, /PowerShell check failed: ops\/start-origin\.ps1 line \d+ calls Get-DexOriginPathz/);
    await expectRejected('psascii', {
      'ops/rollback-to-v2.ps1': `${fs.readFileSync(path.join(OPS, 'rollback-to-v2.ps1'), 'utf8')}\n# caf\u00e9\n`,
    }, /PowerShell check failed: ops\/rollback-to-v2\.ps1 has a non-ASCII byte/);
  });

  test('running from ops-good/ (the fallback role) deploys a fixed main and exits 75 once the live ops/ changes', async () => {
    const before = fs.readFileSync(path.join(root, 'ops-good', '.dex-ops.json'), 'utf8');
    const fixed = commit('fallback', { 'build.mjs': goodBuild, ...opsFiles({ 'ops/NOTE.txt': 'ops changed for the fallback test' }) });
    const res = runDeploy(['--once'], goodDeploy());
    assert.equal(res.code, 75, res.out);
    assert.equal(state().sha, fixed);
    assert.equal(git(path.join(root, 'repo'), 'rev-parse', 'HEAD'), fixed);
    await waitFor(async () => (await page()) === '<h1>build-fallback</h1>', 5000, 'fixed commit served');
    assert.equal(fs.readFileSync(path.join(root, 'ops-good', '.dex-ops.json'), 'utf8'), before, 'the fallback copy does not promote itself');
  });

  test('daemon mode picks up a new commit on its own and recovers a stale lock after being killed', async () => {
    const f = commit('F', { 'build.mjs': goodBuild, ...opsFiles() });
    const child = spawn(process.execPath, [DEPLOY, ...deployArgs(['--interval', '1'])], { windowsHide: true, stdio: 'ignore' });
    spawned.add(child.pid);
    try {
      await waitFor(async () => (await deployInfo()).sha === f, 120_000, 'daemon deploys F', 500);
      assert.equal(await page(), '<h1>build-F</h1>');
      const lock = JSON.parse(fs.readFileSync(path.join(root, 'deploy.lock'), 'utf8'));
      assert.equal(lock.pid, child.pid);
    } finally {
      killTree(child.pid);
      spawned.delete(child.pid);
    }
    await sleep(500);
    const res = runDeploy(['--once']);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /already live/);
  });

  test('server wrote an access log under the deploy root', () => {
    const log = fs.readFileSync(path.join(root, 'logs', 'server.log'), 'utf8');
    assert.match(log, / req 200 GET \/ /);
    assert.match(log, /serving build /);
  });

  // ---------------------------------------------------------------- PowerShell

  describe('PowerShell scripts', { skip: !IS_WINDOWS && 'Windows only' }, () => {
    const psFiles = () => fs.readdirSync(OPS).filter((f) => f.endsWith('.ps1')).map((f) => path.join(OPS, f));

    function ps(args, opts = {}) {
      const res = spawnSync(POWERSHELL, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args], {
        encoding: 'utf8', timeout: opts.timeout || 120_000, windowsHide: true, env: { ...process.env, ...(opts.env || {}) },
      });
      return { code: res.status, out: `${res.stdout}${res.stderr}` };
    }

    function taskXml() {
      const res = spawnSync('schtasks', ['/query', '/tn', '\\Dex\\Dex Site Origin', '/xml'], { encoding: 'utf8', windowsHide: true });
      return res.status === 0 ? res.stdout : null;
    }

    test('every .ps1 parses under Windows PowerShell 5.1 and is ASCII-only', () => {
      const files = psFiles();
      assert.ok(files.length >= 4);
      const script = [
        '$v = $PSVersionTable.PSVersion; if ($v.Major -ne 5) { throw "expected 5.1, got $v" }',
        ...files.map((f) => `$t=$null; $e=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('${f}', [ref]$t, [ref]$e); "${path.basename(f)} " + $e.Count; foreach ($x in $e) { "  line " + $x.Extent.StartLineNumber + ": " + $x.Message }`),
      ].join('; ');
      const res = ps(['-Command', script]);
      assert.equal(res.code, 0, res.out);
      for (const f of files) assert.match(res.out, new RegExp(`${path.basename(f).replace('.', '\\.')} 0\\b`), res.out);
      for (const f of files) assert.ok(!/[^\x00-\x7f]/.test(fs.readFileSync(f, 'latin1')), `${path.basename(f)} has non-ASCII bytes`);
    });

    test('tunnel script patch: only the origin-fallback block becomes a comment, verified, idempotent, restorable', () => {
      const dir = path.join(RUN, 'tunnel-patch');
      fs.mkdirSync(dir, { recursive: true });
      const cases = {
        lf: Buffer.from(syntheticTunnelScript('\n'), 'latin1'),
        crlf: Buffer.from(syntheticTunnelScript('\r\n'), 'latin1'),
        // UTF-8 BOM and a non-ASCII comment elsewhere: every byte outside the block survives.
        bom: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`# caf\u00e9 \u2713\r\n${syntheticTunnelScript('\r\n')}`, 'utf8')]),
      };
      // Fixture copy of the real script as it was before the patch (never the live file).
      const real = realTunnelOriginal();
      if (real) cases.real = real;
      for (const [name, bytes] of Object.entries(cases)) fs.writeFileSync(path.join(dir, `${name}.ps1`), bytes);
      fs.writeFileSync(path.join(dir, 'changed.ps1'), cases.lf);
      const noBlock = Buffer.from(syntheticTunnelScript('\n').replace('} catch {\n    & $originLauncher | Out-Null\n}', '} catch {\n    Write-Warning "origin down"\n}'), 'latin1');
      fs.writeFileSync(path.join(dir, 'noblock.ps1'), noBlock);
      // Files the verifier must reject: an extra change elsewhere, and one that does not parse.
      const good = expectedTunnelPatch(cases.lf).toString('latin1');
      fs.writeFileSync(path.join(dir, 'extra.ps1'), good.replace('$ErrorActionPreference = "Stop"', '$ErrorActionPreference = "Continue"'), 'latin1');
      fs.writeFileSync(path.join(dir, 'broken.ps1'), `${good}function Broken( {\n`, 'latin1');
      fs.writeFileSync(path.join(dir, 'good.ps1'), good, 'latin1');

      const script = path.join(dir, 'run.ps1');
      fs.writeFileSync(script, String.raw`param([string]$Ops, [string]$Dir, [string]$Names)
$ErrorActionPreference = 'Stop'
. (Join-Path $Ops 'hosting-common.ps1')
$quiet = { param($m) }
$result = [ordered]@{}
foreach ($name in ($Names -split ',')) {
    $file = Join-Path $Dir "$name.ps1"
    $backup = Join-Path $Dir "backup-$name"
    $r = [ordered]@{}
    $r.first = Invoke-DexTunnelScriptPatch -Path $file -BackupDir $backup -Log $quiet
    Copy-Item -LiteralPath $file -Destination (Join-Path $Dir "$name.patched")
    $r.second = Invoke-DexTunnelScriptPatch -Path $file -BackupDir (Join-Path $Dir "backup2-$name") -Log $quiet
    $r.secondBackup = Test-Path -LiteralPath (Join-Path $Dir "backup2-$name")
    $r.plan = (Get-DexTunnelRestorePlan -BackupDir $backup).Status
    $r.restore = Restore-DexTunnelScript -BackupDir $backup -Log $quiet
    $r.after = (Get-DexTunnelRestorePlan -BackupDir $backup).Status
    $result[$name] = $r
}
$file = Join-Path $Dir 'changed.ps1'
$null = Invoke-DexTunnelScriptPatch -Path $file -BackupDir (Join-Path $Dir 'backup-changed') -Log $quiet
[System.IO.File]::AppendAllText($file, "# edited by hand after the patch" + [char]10)
$result.changed = Restore-DexTunnelScript -BackupDir (Join-Path $Dir 'backup-changed') -Log $quiet
try {
    $null = Invoke-DexTunnelScriptPatch -Path (Join-Path $Dir 'noblock.ps1') -BackupDir (Join-Path $Dir 'backup-noblock') -Log $quiet
    $result.noblock = 'patched'
} catch {
    $result.noblock = $_.Exception.Message
}
$result.noblockBackup = Test-Path -LiteralPath (Join-Path $Dir 'backup-noblock')
$original = Join-Path $Dir 'backup-lf\start-cloudflare-tunnel.ps1'
$result.verifyGood = @(Test-DexTunnelScriptPatch -Original $original -Patched (Join-Path $Dir 'good.ps1'))
$result.verifyExtra = @(Test-DexTunnelScriptPatch -Original $original -Patched (Join-Path $Dir 'extra.ps1'))
$result.verifyBroken = @(Test-DexTunnelScriptPatch -Original $original -Patched (Join-Path $Dir 'broken.ps1'))
'RESULT ' + ($result | ConvertTo-Json -Depth 4 -Compress)
`);
      const names = Object.keys(cases);
      const res = ps(['-File', script, '-Ops', OPS, '-Dir', dir, '-Names', names.join(',')]);
      assert.equal(res.code, 0, res.out);
      const line = res.out.split(/\r?\n/).find((l) => l.startsWith('RESULT '));
      assert.ok(line, res.out);
      const result = JSON.parse(line.slice(7));

      for (const [name, original] of Object.entries(cases)) {
        const r = result[name];
        assert.equal(r.first, 'patched', name);
        const patched = fs.readFileSync(path.join(dir, `${name}.patched`));
        assert.ok(patched.equals(expectedTunnelPatch(original)), `${name}: only the fallback block changed`);
        assert.ok(!/Invoke-WebRequest -Uri \$OriginHealthUrl -UseBasicParsing/.test(patched.toString('latin1').split('function ')[0]), `${name}: fallback gone`);
        assert.equal(r.second, 'already-patched', name);
        assert.equal(r.secondBackup, false, `${name}: an already-patched file is not backed up again`);
        assert.equal(r.plan, 'restore', name);
        assert.equal(r.restore, 'restore', name);
        assert.equal(r.after, 'original', name);
        assert.ok(fs.readFileSync(path.join(dir, `${name}.ps1`)).equals(original), `${name}: restored byte for byte`);
        assert.ok(fs.readFileSync(path.join(dir, `backup-${name}`, 'start-cloudflare-tunnel.ps1')).equals(original), `${name}: backup is the original`);
        const meta = JSON.parse(fs.readFileSync(path.join(dir, `backup-${name}`, 'start-cloudflare-tunnel.backup.json'), 'utf8'));
        assert.equal(meta.path.toLowerCase(), path.join(dir, `${name}.ps1`).toLowerCase());
      }
      if (cases.real) {
        const removed = cases.real.toString('latin1').split(/\r?\n/).length - expectedTunnelPatch(cases.real).toString('latin1').split(/\r?\n/).length;
        assert.equal(removed, 6, 'the real tunnel script loses 8 lines and gains the 2-line comment');
      }
      assert.equal(result.changed, 'changed', 'a script edited after the patch is left alone');
      assert.match(fs.readFileSync(path.join(dir, 'changed.ps1'), 'latin1'), /# edited by hand after the patch\n$/);
      assert.match(result.noblock, /cannot patch .*noblock\.ps1: expected one top-level origin-fallback block .*found 0/);
      assert.equal(result.noblockBackup, false);
      assert.ok(fs.readFileSync(path.join(dir, 'noblock.ps1')).equals(noBlock), 'an unrecognized script is not touched');
      assert.deepEqual(result.verifyGood, []);
      assert.ok(result.verifyExtra.some((p) => /^diff: /.test(p)), JSON.stringify(result.verifyExtra));
      assert.ok(result.verifyBroken.some((p) => /does not parse under Windows PowerShell 5\.1/.test(p)), JSON.stringify(result.verifyBroken));
    });

    test('install-hosting.ps1 -WhatIf prints the plan (tunnel patch included) and changes nothing', { skip: taskXml() === null && 'origin task not present' }, () => {
      const whatIfRoot = path.join(RUN, 'whatif-root');
      const whatIfBackups = path.join(RUN, 'whatif-backups');
      const tunnelCopy = path.join(RUN, 'whatif-tunnel', 'start-cloudflare-tunnel.ps1');
      fs.mkdirSync(path.dirname(tunnelCopy), { recursive: true });
      // Fixture copy of the real script as it was before the patch (never the live file).
      const tunnelBytes = realTunnelOriginal() ?? Buffer.from(syntheticTunnelScript());
      fs.writeFileSync(tunnelCopy, tunnelBytes);
      const before = taskXml();
      const install = (tunnel) => ps(['-File', path.join(OPS, 'install-hosting.ps1'), '-WhatIf', '-DeployRoot', whatIfRoot,
        '-BackupRoot', whatIfBackups, '-Port', '18999', '-TunnelScript', tunnel]);
      const res = install(tunnelCopy);
      assert.equal(res.code, 0, res.out);
      assert.match(res.out, /dex\.place hosting cutover plan \(WhatIf: nothing will be changed\)/);
      assert.match(res.out, /tunnel script +.*start-cloudflare-tunnel\.ps1 \(origin fallback at lines \d+-\d+\)/);
      assert.match(res.out, /4\. back up the tunnel script to .*whatif-backups\\\d{8}-\d{6}\\start-cloudflare-tunnel\.ps1,\r?\n +replace its origin-fallback block \(lines \d+-\d+\) with a comment/);
      assert.match(res.out, /\n +- try \{\r?\n/);
      assert.match(res.out, /\n +- +& \$originLauncher \| Out-Null\r?\n/);
      assert.match(res.out, /\n +\+ # Origin fallback removed by dex\.place ops\/install-hosting\.ps1: the origin on 127\.0\.0\.1:8088\r?\n/);
      assert.match(res.out, /\n +\+ # is owned by the "Dex Site Origin" task running dex\.place\/ops\/start-origin\.ps1\.\r?\n/);
      assert.match(res.out, /8\. start the task/);
      assert.match(res.out, /WhatIf: no changes made\./);
      assert.doesNotMatch(res.out, /BLOCKED/);
      assert.doesNotMatch(res.out, /What if: Performing/);
      assert.equal(taskXml(), before, 'task XML unchanged');
      assert.ok(fs.readFileSync(tunnelCopy).equals(tunnelBytes), 'tunnel script unchanged');
      assert.deepEqual(fs.readdirSync(path.dirname(tunnelCopy)), ['start-cloudflare-tunnel.ps1'], 'nothing written next to the tunnel script');
      assert.ok(!fs.existsSync(whatIfRoot), 'deploy root not created');
      assert.ok(!fs.existsSync(whatIfBackups), 'backup root not created');

      // A tunnel script without the block the patch knows is a blocker, not a guess.
      const odd = path.join(RUN, 'whatif-tunnel', 'odd.ps1');
      fs.writeFileSync(odd, '"no origin fallback in here"\n');
      const blocked = install(odd);
      assert.equal(blocked.code, 0, blocked.out);
      assert.match(blocked.out, /BLOCKED: tunnel script .*odd\.ps1: UNRECOGNIZED: expected one top-level origin-fallback block/);
      assert.match(blocked.out, /WhatIf: a real run would stop here\./);

      // rollback -WhatIf: plain backup folder, then one that also holds a tunnel backup.
      const plainDir = path.join(RUN, 'rollback-plain');
      fs.mkdirSync(plainDir, { recursive: true });
      fs.writeFileSync(path.join(plainDir, 'dex-site-origin.task.xml'), before);
      const back = ps(['-File', path.join(OPS, 'rollback-to-v2.ps1'), '-WhatIf', '-BackupXml', path.join(plainDir, 'dex-site-origin.task.xml'), '-DeployRoot', whatIfRoot, '-Port', '18999']);
      assert.equal(back.code, 0, back.out);
      assert.match(back.out, /tunnel script +no tunnel script backup next to the XML; nothing to do/);
      assert.match(back.out, /WhatIf: no changes made\./);

      const tunnelDir = path.join(RUN, 'rollback-tunnel');
      fs.mkdirSync(tunnelDir, { recursive: true });
      fs.writeFileSync(path.join(tunnelDir, 'dex-site-origin.task.xml'), before);
      const patchedCopy = path.join(RUN, 'whatif-tunnel', 'patched.ps1');
      fs.writeFileSync(patchedCopy, tunnelBytes);
      const patch = ps(['-Command', `. '${path.join(OPS, 'hosting-common.ps1')}'; Invoke-DexTunnelScriptPatch -Path '${patchedCopy}' -BackupDir '${tunnelDir}'`]);
      assert.equal(patch.code, 0, patch.out);
      const patchedBytes = fs.readFileSync(patchedCopy);
      assert.ok(patchedBytes.equals(expectedTunnelPatch(tunnelBytes)));
      const back2 = ps(['-File', path.join(OPS, 'rollback-to-v2.ps1'), '-WhatIf', '-BackupXml', path.join(tunnelDir, 'dex-site-origin.task.xml'), '-DeployRoot', whatIfRoot, '-Port', '18999']);
      assert.equal(back2.code, 0, back2.out);
      assert.match(back2.out, /tunnel script +.*patched\.ps1: restore the original from .*rollback-tunnel\\start-cloudflare-tunnel\.ps1/);
      assert.match(back2.out, /WhatIf: no changes made\./);
      assert.ok(fs.readFileSync(patchedCopy).equals(patchedBytes), 'rollback -WhatIf does not touch the tunnel script');
      assert.equal(taskXml(), before, 'task XML unchanged after rollback -WhatIf');
    });

    // ------------------------------------------------ boot race with the v2 origin

    // A stand-in for the v2 origin: a node process whose command line contains
    // run-production.mjs. It keeps retrying the port until it gets it, like the v2
    // origin started by the tunnel script while something else is shutting down.
    const fakeScript = (dir, name, body) => {
      const file = path.join(dir, name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, [
        "import fs from 'node:fs';",
        "import http from 'node:http';",
        'const [port, pidFile] = [Number(process.argv[2]), process.argv[3]];',
        "const server = http.createServer((req, res) => res.end(req.url === '/healthz' ? 'ok' : " + JSON.stringify(body) + '));',
        "const listen = () => server.listen(port, '127.0.0.1', () => { if (pidFile) fs.writeFileSync(pidFile, String(process.pid)); console.log('listening'); });",
        "server.on('error', (err) => { if (err.code === 'EADDRINUSE') setTimeout(listen, 50); else throw err; });",
        'listen();',
        '',
      ].join('\n'));
      return file;
    };

    function startFake(file, port) {
      const child = spawn(process.execPath, [file, String(port)], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      spawned.add(child.pid);
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      const exited = new Promise((resolve) => child.once('exit', resolve));
      return { child, pid: child.pid, listening: () => out.includes('listening'), exited };
    }

    const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

    // A deploy root whose live build is main's head, so start-origin.ps1 skips the first
    // deploy and its deployer has nothing to do.
    function preparedRoot(name) {
      const dir = path.join(RUN, name);
      const hasMain = spawnSync('git', ['--git-dir', bare, 'rev-parse', '--verify', '-q', 'refs/heads/main'], { windowsHide: true }).status === 0;
      if (!hasMain) commit('prep', { 'build.mjs': goodBuild, ...opsFiles() }); // only when run on its own
      execFileSync('git', ['clone', '-q', '-c', 'core.autocrlf=false', bare, path.join(dir, 'repo')], { windowsHide: true, stdio: 'ignore' });
      const head = git(path.join(dir, 'repo'), 'rev-parse', 'HEAD');
      writeFiles(dir, {
        [`builds/${short(head)}/dist/index.html`]: `<h1>${name}</h1>`,
        'state.json': JSON.stringify({ sha: head, build: short(head), deployedAt: new Date().toISOString() }),
      });
      return dir;
    }

    test('start-origin.ps1 takes the port from a v2 origin at startup and in the keep-alive loop, and from nothing else', { timeout: 300_000 }, async () => {
      const root = preparedRoot('displace-root');
      const port = rand(18800, 18849);
      const fakes = path.join(RUN, 'fake-v2', 'scripts');
      const v2 = fakeScript(fakes, 'run-production.mjs', 'fake v2 origin');
      const stranger = fakeScript(path.join(RUN, 'fake-other'), 'some-other-app.mjs', 'someone else');
      const supervisorLog = path.join(root, 'logs', 'supervisor.log');
      const readLog = () => (fs.existsSync(supervisorLog) ? fs.readFileSync(supervisorLog, 'utf8') : '');
      const pids = (re) => [...readLog().matchAll(re)].map((m) => Number(m[1]));
      const body = async () => (await request(port, { target: '/', timeout: 3000 })).body.toString();
      const ours = async () => (await body()) === '<h1>displace-root</h1>';

      const first = startFake(v2, port);
      await waitFor(first.listening, 10_000, 'fake v2 origin listening');
      assert.equal(await body(), 'fake v2 origin');

      const supervisor = spawn(POWERSHELL, [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(OPS, 'start-origin.ps1'),
        '-KeepAlive', '-DeployRoot', root, '-Port', String(port), '-RepoUrl', bare, '-DeployIntervalSeconds', '3600', '-V2OriginSettleSeconds', '1',
      ], { windowsHide: true, stdio: 'ignore', env: { ...process.env, DEX_DEPLOY_SMOKE_PORTS: SMOKE_PORTS } });
      spawned.add(supervisor.pid);
      const others = [];
      try {
        // 1. At startup: the v2 origin holds the port, so it is stopped and ours starts.
        await waitFor(ours, 90_000, 'our server took the port from the v2 origin', 300);
        await Promise.race([first.exited, sleep(5000)]);
        assert.ok(!alive(first.pid), 'the v2 origin was stopped');
        assert.match(readLog(), new RegExp(`port ${port} is held by the v2 origin pid ${first.pid} \\(.*run-production\\.mjs`));
        assert.match(readLog(), new RegExp(`stopped the v2 origin pid ${first.pid}; port ${port} is free`));
        await waitFor(() => pids(/server pid (\d+) started/g).length >= 1, 30_000, 'server start logged');
        const [server1] = pids(/server pid (\d+) started/g);
        assert.ok(server1);

        // 2. Keep-alive loop: our server dies and a v2 origin grabs the port first.
        const second = startFake(v2, port);
        others.push(second.pid);
        killTree(server1);
        await waitFor(second.listening, 10_000, 'second v2 origin grabbed the port');
        await waitFor(() => new RegExp(`stopped the v2 origin pid ${second.pid}`).test(readLog()), 60_000, 'second v2 origin displaced', 300);
        await waitFor(ours, 30_000, 'our server is back', 300);
        assert.ok(!alive(second.pid), 'the second v2 origin was stopped');
        await waitFor(() => pids(/server pid (\d+) started/g).length >= 2, 30_000, 'server restart logged');
        const [, server2] = pids(/server pid (\d+) started/g);
        assert.ok(server2 && server2 !== server1);

        // 3. Anything that is not the v2 origin is left alone; the supervisor keeps retrying.
        const other = startFake(stranger, port);
        others.push(other.pid);
        killTree(server2);
        await waitFor(other.listening, 10_000, 'another program grabbed the port');
        await waitFor(() => new RegExp(`server start failed: port ${port} is held by pid ${other.pid} .*some-other-app\\.mjs.*not starting a second origin`).test(readLog()),
          60_000, 'supervisor refuses to touch an unknown holder', 300);
        assert.ok(alive(other.pid), 'the unknown holder was not stopped');
        assert.equal(await body(), 'someone else');
        killTree(other.pid);
        await waitFor(ours, 60_000, 'our server is back once the port is free', 500);
        assert.doesNotMatch(readLog(), new RegExp(`stopped the v2 origin pid ${other.pid}`));
      } finally {
        killTree(supervisor.pid);
        spawned.delete(supervisor.pid);
        for (const pid of [first.pid, ...others, ...pids(/server pid (\d+) started/g), ...pids(/deployer pid (\d+) started/g)]) killTree(pid);
      }
    });

    test('start-origin.ps1 leaves a v2 origin alone while a v2 keeper (start-production-origin.ps1) supervises it', { timeout: 120_000 }, async () => {
      const root = preparedRoot('keeper-root');
      const port = rand(18850, 18899);
      const fakes = path.join(RUN, 'fake-v2-kept', 'scripts');
      const v2 = fakeScript(fakes, 'run-production.mjs', 'kept v2 origin');
      const pidFile = path.join(fakes, 'v2.pid');
      const keeperScript = path.join(fakes, 'start-production-origin.ps1');
      fs.writeFileSync(keeperScript, [
        'param([int]$Port, [string]$PidFile)',
        '$node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source',
        `$p = Start-Process -FilePath $node -ArgumentList @('${v2}', [string]$Port, $PidFile) -WindowStyle Hidden -PassThru`,
        'Wait-Process -Id $p.Id',
        '',
      ].join('\r\n'));
      const keeper = spawn(POWERSHELL, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', keeperScript, '-Port', String(port), '-PidFile', pidFile],
        { windowsHide: true, stdio: 'ignore' });
      spawned.add(keeper.pid);
      try {
        await waitFor(() => fs.existsSync(pidFile), 30_000, 'kept v2 origin listening');
        const v2Pid = Number(fs.readFileSync(pidFile, 'utf8'));
        const res = ps(['-File', path.join(OPS, 'start-origin.ps1'), '-DeployRoot', root, '-Port', String(port), '-RepoUrl', bare, '-V2OriginSettleSeconds', '0'], { timeout: 60_000 });
        assert.notEqual(res.code, 0, res.out);
        const log = fs.readFileSync(path.join(root, 'logs', 'supervisor.log'), 'utf8');
        assert.match(log, new RegExp(`server start failed: port ${port} is held by the v2 origin pid ${v2Pid}, which is supervised by pid ${keeper.pid} \\(.*start-production-origin\\.ps1`));
        assert.ok(alive(v2Pid), 'the kept v2 origin is still running');
        assert.equal((await request(port, { target: '/' })).body.toString(), 'kept v2 origin');
        assert.doesNotMatch(log, /taking the port over|server pid \d+ started|deployer pid \d+ started/);
      } finally {
        killTree(keeper.pid);
        spawned.delete(keeper.pid);
      }
    });

    test('start-origin.ps1 -KeepAlive: first run clones + deploys, restarts a killed server, self-updates on ops/ changes', { timeout: 600_000 }, async () => {
      const soRoot = path.join(RUN, 'so-root');
      const port = rand(18700, 18799);
      const supervisorLog = path.join(soRoot, 'logs', 'supervisor.log');
      const readLog = () => (fs.existsSync(supervisorLog) ? fs.readFileSync(supervisorLog, 'utf8') : '');
      const pids = (re) => [...readLog().matchAll(re)].map((m) => Number(m[1]));
      const health = async () => {
        const res = await request(port, { target: '/healthz', timeout: 3000 });
        return res.status === 200 && res.body.toString() === 'ok';
      };
      const info = async () => JSON.parse((await request(port, { target: '/__deploy', timeout: 3000 })).body.toString());

      const supervisor = spawn(POWERSHELL, [
        '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(OPS, 'start-origin.ps1'),
        '-KeepAlive', '-DeployRoot', soRoot, '-Port', String(port), '-RepoUrl', bare, '-DeployIntervalSeconds', '5',
      ], { windowsHide: true, stdio: 'ignore', env: { ...process.env, DEX_DEPLOY_SMOKE_PORTS: SMOKE_PORTS } });
      spawned.add(supervisor.pid);
      try {
        await waitFor(health, 240_000, 'first run healthy', 500);
        assert.equal((await info()).sha, commits.F, 'first run deployed origin/main');
        assert.ok(fs.existsSync(path.join(soRoot, 'repo', '.git')), 'repo cloned');
        assert.match(readLog(), /no live build yet; running one deploy/);

        // Kill the server: the supervisor must bring it back.
        await waitFor(() => /deployer pid \d+ started/.test(readLog()), 30_000, 'supervisor startup logged', 200);
        const [firstServer] = pids(/server pid (\d+) started/g);
        assert.ok(firstServer);
        killTree(firstServer);
        await waitFor(() => pids(/server pid (\d+) started/g).length >= 2, 60_000, 'server restarted', 500);
        await waitFor(health, 30_000, 'healthy after server restart', 300);
        assert.match(readLog(), new RegExp(`server pid ${firstServer} exited`));

        // A commit that touches ops/ (not server.mjs): deployer exits 75 and is restarted at once.
        const g = commit('G', { 'build.mjs': goodBuild, ...opsFiles({ 'ops/NOTE.txt': 'ops changed in G' }) });
        await waitFor(async () => (await info()).sha === g, 180_000, 'supervised deployer ships G', 1000);
        await waitFor(() => /deployer pid \d+ exited \(code 75\)/.test(readLog()), 60_000, 'deployer exit 75', 500);
        await waitFor(() => pids(/deployer pid (\d+) started/g).length >= 2, 30_000, 'deployer restarted', 500);

        // A commit that changes server.mjs: the supervisor restarts the server as well.
        const serversBefore = pids(/server pid (\d+) started/g).length;
        const serverSource = `${fs.readFileSync(SERVER, 'utf8')}\n// self-update test ${Date.now()}\n`;
        const h = commit('H', { 'build.mjs': goodBuild, ...opsFiles({ 'ops/server.mjs': serverSource }) });
        await waitFor(async () => (await info()).sha === h, 180_000, 'supervised deployer ships H', 1000);
        await waitFor(() => /server\.mjs changed on disk; restarting the server/.test(readLog()), 60_000, 'server restart on server.mjs change', 500);
        await waitFor(() => pids(/server pid (\d+) started/g).length > serversBefore, 60_000, 'new server pid', 500);
        await waitFor(health, 30_000, 'healthy after self-update', 300);
        assert.equal((await request(port, { target: '/' })).body.toString(), '<h1>build-H</h1>');

        // The safety net. Commit I carries a deploy.mjs that passes every gate (it only
        // crashes when --deploy-root is this supervisor's root, not in the self-test's
        // scratch root), so it goes live and the supervisor restarts into it. It
        // crash-loops; the supervisor must switch to ops-good/ (H's proven copy), which
        // deploys the fix J and exits 75 so the supervisor goes back to repo/ops.
        const goodMarker = path.join(soRoot, 'ops-good', '.dex-ops.json');
        await waitFor(() => fs.existsSync(goodMarker) && JSON.parse(fs.readFileSync(goodMarker, 'utf8')).sha === h, 60_000, 'ops-good holds H', 500);
        const crashingDeploy = patchOps('deploy.mjs',
          "import { parseArgs } from 'node:util';\n",
          "import { parseArgs } from 'node:util';\n" +
          "{ const i = process.argv.indexOf('--deploy-root'); if (i > 0 && path.basename(process.argv[i + 1] || '') === 'so-root') { process.stderr.write('simulated crash that only happens in production\\n'); process.exit(1); } }\n");
        const i = commit('I', { 'build.mjs': goodBuild, ...opsFiles({ 'ops/deploy.mjs': crashingDeploy, 'ops/NOTE.txt': 'ops changed in I' }) });
        await waitFor(async () => (await info()).sha === i, 180_000, 'I goes live (it passes the gates)', 1000);
        await waitFor(() => /failed 3 times in a row, each within \d+ s; starting the last-known-good copy/.test(readLog()), 120_000, 'fallback to ops-good', 500);
        await waitFor(() => /deployer pid \d+ started from ops-good/.test(readLog()), 30_000, 'ops-good deployer started', 500);
        assert.ok(await health(), 'the site stays up while the deployer crash-loops');

        const j = commit('J', { 'build.mjs': goodBuild, ...opsFiles({ 'ops/NOTE.txt': 'fixed in J' }) });
        await waitFor(async () => (await info()).sha === j, 180_000, 'ops-good deployer ships the fix J', 1000);
        await waitFor(() => /the live commit changed ops\\; going back to repo\\ops\\deploy\.mjs/.test(readLog()), 60_000, 'back to repo/ops', 500);
        await waitFor(() => /deployer pid \d+ started\r?\n/.test(readLog().split('going back to repo')[1] || ''), 30_000, 'repo/ops deployer restarted', 500);
        await waitFor(() => JSON.parse(fs.readFileSync(goodMarker, 'utf8')).sha === j, 60_000, 'ops-good promoted to J after a clean cycle', 500);
        await waitFor(health, 30_000, 'healthy after recovery', 300);
        assert.equal((await request(port, { target: '/' })).body.toString(), '<h1>build-J</h1>');
      } finally {
        killTree(supervisor.pid);
        spawned.delete(supervisor.pid);
        for (const pid of [...pids(/server pid (\d+) started/g), ...pids(/deployer pid (\d+) started/g)]) killTree(pid);
      }
    });
  });
});
