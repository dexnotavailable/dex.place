#!/usr/bin/env node
// dex.place puller: GitHub main decides the live site.
//
// Every --interval seconds: fetch origin/<branch>; if it differs from the live
// commit (and is not the last failed or a rolled-back commit), materialise it into
// builds/<sha12>/, npm ci + npm run build, then verify it before it can go live:
//   1. its own ops/server.mjs serves dist/ in --root mode (GET / and /healthz);
//   2. the same server.mjs in follow mode (--deploy-root, the way the origin runs
//      it) serves the live build, then switches to the candidate when a scratch
//      state.json changes, and serves the same GET / as step 1;
//   3. if ops/ differs from the live commit: node --check on ops/*.mjs, every
//      ops/*.ps1 parses under Windows PowerShell 5.1 with every named command
//      resolvable, and the candidate's deploy.mjs deploys a scratch repo end to end
//      (--once, --status, --rollback) in tmp/.
// Only then is state.json switched atomically. server.mjs follows state.json, so
// no restart is needed for site changes.
//
// ops-good/ holds the ops/ tree of the last deployer that completed a cycle from
// repo/ops. The supervisor runs ops-good/deploy.mjs if repo/ops/deploy.mjs keeps
// crashing, and `node ops-good/deploy.mjs --rollback` works when repo/ops cannot.
//
//   node ops/deploy.mjs                 run forever (the supervisor starts this)
//   node ops/deploy.mjs --once          one cycle, then exit
//   node ops/deploy.mjs --once --force  same, but also retry a failed or rolled-back commit
//   node ops/deploy.mjs --rollback      make the previous build live again
//   node ops/deploy.mjs --status        print state.json
// Options: --deploy-root, --repo-url, --branch, --interval (s), --keep,
//   --smoke-ports (0 = ephemeral, or a range like 18600-18699), --install-timeout,
//   --build-timeout (s). Env: DEX_DEPLOY_ROOT, DEX_DEPLOY_REPO_URL, DEX_DEPLOY_SMOKE_PORTS.
//
// Exit codes: 0 ok / nothing to do, 1 failed, 2 usage, 73 another deployer holds
// the lock, 75 the live commit changed ops/ (supervisor restarts with new code).

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DEPLOY_ROOT = 'D:\\Dex\\Servers\\dex.place';
export const DEFAULT_REPO_URL = 'https://github.com/dexnotavailable/dex.place.git';
export const EXIT = Object.freeze({ OK: 0, FAILED: 1, USAGE: 2, LOCKED: 73, RESTART: 75 });

const MARKER = '.dex-build.json';
const OPS_MARKER = '.dex-ops.json';
// Files the origin cannot run without: the scheduled task starts start-origin.ps1,
// which runs deploy.mjs and server.mjs.
const OPS_ENTRY_POINTS = ['deploy.mjs', 'server.mjs', 'start-origin.ps1'];
// Set for a candidate deployer running inside another deployer's self-test.
const SELFTEST_ENV = 'DEX_DEPLOY_SELFTEST';
const LOCK_STALE_MS = 60_000;
const LOCK_HEARTBEAT_MS = 10_000;
const HISTORY_MAX = 30;
const BUILD_LOGS_KEEP = 40;
const LOG_MAX_BYTES = 10 * 1024 * 1024;
const IDLE_LOG_EVERY_MS = 60 * 60 * 1000;
const CAPTURE_MAX = 64 * 1024;

const iso = () => new Date().toISOString();
const stamp = () => iso().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const short = (sha) => String(sha || '').slice(0, 12);

class UserError extends Error {}

// ----------------------------------------------------------------- options

function parseOptions(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'deploy-root': { type: 'string' },
      'repo-url': { type: 'string' },
      branch: { type: 'string' },
      interval: { type: 'string' },
      keep: { type: 'string' },
      'smoke-ports': { type: 'string' },
      'install-timeout': { type: 'string' },
      'build-timeout': { type: 'string' },
      once: { type: 'boolean', default: false },
      rollback: { type: 'boolean', default: false },
      status: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'self-update': { type: 'boolean' },
      'no-self-update': { type: 'boolean' },
    },
    strict: true,
  });
  const num = (value, fallback, min, name) => {
    const n = Number(value ?? fallback);
    if (!Number.isFinite(n) || n < min) throw new UserError(`invalid --${name}: ${value}`);
    return n;
  };
  const modes = ['once', 'rollback', 'status'].filter((m) => values[m]);
  if (modes.length > 1) throw new UserError(`choose one of --${modes.join(', --')}`);
  const repoUrl = values['repo-url'] ?? process.env.DEX_DEPLOY_REPO_URL;
  const branch = values.branch ?? process.env.DEX_DEPLOY_BRANCH ?? 'main';
  if (!/^[A-Za-z0-9._/-]+$/.test(branch) || branch.includes('..')) throw new UserError(`invalid --branch: ${branch}`);
  return {
    mode: modes[0] || 'daemon',
    deployRoot: path.resolve(values['deploy-root'] ?? process.env.DEX_DEPLOY_ROOT ?? DEFAULT_DEPLOY_ROOT),
    repoUrl: repoUrl ?? DEFAULT_REPO_URL,
    repoUrlExplicit: repoUrl !== undefined,
    branch,
    intervalMs: num(values.interval, process.env.DEX_DEPLOY_INTERVAL ?? 30, 1, 'interval') * 1000,
    keep: Math.floor(num(values.keep, 5, 1, 'keep')),
    smokePorts: values['smoke-ports'] ?? process.env.DEX_DEPLOY_SMOKE_PORTS ?? '0',
    installTimeoutMs: num(values['install-timeout'], 1200, 10, 'install-timeout') * 1000,
    buildTimeoutMs: num(values['build-timeout'], 1200, 10, 'build-timeout') * 1000,
    force: values.force,
    selfUpdate: values['no-self-update'] ? false : (values['self-update'] ? true : null),
  };
}

function layout(root) {
  return {
    root,
    repo: path.join(root, 'repo'),
    opsGood: path.join(root, 'ops-good'),
    builds: path.join(root, 'builds'),
    downloads: path.join(root, 'downloads'),
    logs: path.join(root, 'logs'),
    buildLogs: path.join(root, 'logs', 'builds'),
    npmCache: path.join(root, 'cache', 'npm'),
    tmp: path.join(root, 'tmp'),
    state: path.join(root, 'state.json'),
    lock: path.join(root, 'deploy.lock'),
    stateLock: path.join(root, 'state.lock'),
    log: path.join(root, 'logs', 'deploy.log'),
  };
}

// ----------------------------------------------------------------- logging

class Logger {
  constructor(file, echo) {
    this.file = file;
    this.echo = echo;
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  #write(level, message) {
    const line = `${iso()} ${level} ${message}\n`;
    if (this.echo) (level === 'error' ? process.stderr : process.stdout).write(line);
    try {
      const st = fs.statSync(this.file, { throwIfNoEntry: false });
      if (st && st.size > LOG_MAX_BYTES) {
        fs.rmSync(`${this.file}.1`, { force: true });
        fs.renameSync(this.file, `${this.file}.1`);
      }
      fs.appendFileSync(this.file, line);
    } catch { /* logging must never break a deploy */ }
  }

  info(message) { this.#write('info', message); }
  warn(message) { this.#write('warn', message); }
  error(message) { this.#write('error', message); }
}

function openSink(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'a');
  const sink = (chunk) => { try { fs.writeSync(fd, chunk); } catch { /* ignore */ } };
  sink.line = (text) => sink(`${iso()} ${text}\n`);
  sink.close = () => { try { fs.closeSync(fd); } catch { /* ignore */ } };
  return sink;
}

// ---------------------------------------------------------------- processes

const activeChildren = new Set();

function childEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|NAMESPACE|PREFIX)$/i.test(key)) delete env[key];
  }
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
  env[pathKey] = [path.dirname(process.execPath), env[pathKey]].filter(Boolean).join(path.delimiter);
  return Object.assign(env, extra);
}

function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

function run(cmd, args, { cwd, env, timeoutMs = 0, sink = null, shell = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeChildren.delete(child);
      resolve({ code: code ?? -1, signal, stdout, stderr, timedOut });
    };
    let child;
    try {
      child = spawn(cmd, args, { cwd, env: env || childEnv(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], shell });
    } catch (err) {
      resolve({ code: -1, signal: null, stdout: '', stderr: String(err && err.message), timedOut: false });
      return;
    }
    activeChildren.add(child);
    const timer = timeoutMs ? setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs) : null;
    child.stdout.on('data', (d) => { stdout = (stdout + d).slice(-CAPTURE_MAX); if (sink) sink(d); });
    child.stderr.on('data', (d) => { stderr = (stderr + d).slice(-CAPTURE_MAX); if (sink) sink(d); });
    child.on('error', (err) => { stderr += String(err && err.message); finish(-1, null); });
    child.on('close', (code, signal) => finish(code, signal));
  });
}

const lastLine = (text) => String(text || '').trim().split(/\r?\n/).filter(Boolean).pop() || '';

// The most useful line of a crash: the last "...Error: ..." line (node ends a crash
// with its own version line), else the last line.
function errorLine(text) {
  const lines = String(text || '').trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/\b[A-Za-z]*Error\b/.test(lines[i]) && !/^at /.test(lines[i])) return lines[i].slice(0, 300);
  }
  return (lines.pop() || '').slice(0, 300);
}

function gitEnv(extra) {
  return childEnv({ GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', ...extra });
}

async function git(ctx, args, opts = {}) {
  const res = await run('git', args, {
    cwd: opts.cwd ?? ctx.paths.repo,
    env: gitEnv(opts.env),
    timeoutMs: opts.timeoutMs ?? 120_000,
    sink: opts.sink,
  });
  if (!opts.allowFail && res.code !== 0) {
    const sub = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '-c');
    throw new Error(`git ${sub} failed (exit ${res.code}${res.timedOut ? ', timed out' : ''}): ${lastLine(res.stderr)}`);
  }
  return res;
}

function npmCommand(args) {
  const cli = process.env.DEX_NPM_CLI || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (fs.existsSync(cli)) return { cmd: process.execPath, args: [cli, ...args], shell: false };
  return { cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm', args, shell: process.platform === 'win32' };
}

// ------------------------------------------------------------ files + state

async function retrying(fn, attempts = 25) {
  for (let i = 0; ; i += 1) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || !['EPERM', 'EACCES', 'EBUSY'].includes(err.code)) throw err;
      await sleep(40 * (i + 1));
    }
  }
}

async function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}-${Date.now()}.tmp`;
  const fh = await fsp.open(tmp, 'w');
  try {
    await fh.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await fh.sync();
  } finally {
    await fh.close();
  }
  try {
    await retrying(() => fsp.rename(tmp, file));
  } catch (err) {
    await fsp.rm(tmp, { force: true });
    throw err;
  }
}

async function rmrf(target) {
  await fsp.rm(target, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}

async function readState(ctx) {
  let text;
  try {
    text = await retrying(() => fsp.readFile(ctx.paths.state, 'utf8'), 10);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
  try {
    const parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    const aside = `${ctx.paths.state}.corrupt-${stamp()}`;
    await fsp.copyFile(ctx.paths.state, aside).catch(() => {});
    ctx.log.warn(`state.json is not valid JSON; copied to ${path.basename(aside)} and starting from empty state`);
    return {};
  }
}

async function withStateLock(ctx, fn) {
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      const fh = await fsp.open(ctx.paths.stateLock, 'wx');
      await fh.writeFile(JSON.stringify({ pid: process.pid, at: iso() }));
      await fh.close();
      break;
    } catch (err) {
      if (!['EEXIST', 'EPERM', 'EACCES', 'EBUSY'].includes(err.code)) throw err;
      const st = await fsp.stat(ctx.paths.stateLock).catch(() => null);
      if (st && Date.now() - st.mtimeMs > LOCK_STALE_MS) {
        await fsp.rm(ctx.paths.stateLock, { force: true }).catch(() => {});
        continue;
      }
      if (Date.now() > deadline) throw new Error('state.lock is busy');
      await sleep(50);
    }
  }
  try {
    return await fn();
  } finally {
    await retrying(() => fsp.rm(ctx.paths.stateLock, { force: true }), 10).catch(() => {});
  }
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

class DeployLock {
  constructor(file) {
    this.file = file;
    this.timer = null;
    this.held = false;
  }

  async acquire(mode) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const fh = await fsp.open(this.file, 'wx');
        await fh.writeFile(`${JSON.stringify({ pid: process.pid, mode, startedAt: iso(), host: os.hostname() })}\n`);
        await fh.close();
        this.held = true;
        this.timer = setInterval(() => {
          const now = new Date();
          fs.utimes(this.file, now, now, () => {});
        }, LOCK_HEARTBEAT_MS);
        this.timer.unref();
        return { ok: true };
      } catch (err) {
        if (!['EEXIST', 'EPERM', 'EACCES'].includes(err.code)) throw err;
        let holder = null;
        try { holder = JSON.parse(await fsp.readFile(this.file, 'utf8')); } catch { holder = null; }
        const st = await fsp.stat(this.file).catch(() => null);
        const fresh = st && Date.now() - st.mtimeMs < LOCK_STALE_MS;
        if (holder && pidAlive(holder.pid) && fresh) return { ok: false, holder };
        if (!holder && fresh) {
          await sleep(200); // being written right now
          continue;
        }
        await fsp.rm(this.file, { force: true }).catch(() => {});
      }
    }
    return { ok: false, holder: null };
  }

  releaseSync() {
    if (!this.held) return;
    this.held = false;
    clearInterval(this.timer);
    try {
      const holder = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (holder.pid === process.pid) fs.rmSync(this.file, { force: true });
    } catch { /* already gone */ }
  }
}

// ------------------------------------------------------------------- repo

async function revParse(ctx, ref) {
  const res = await git(ctx, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFail: true });
  return res.code === 0 ? res.stdout.trim() : null;
}

async function ensureRepo(ctx) {
  const { repo, root } = ctx.paths;
  if (fs.existsSync(path.join(repo, '.git'))) {
    if (ctx.opts.repoUrlExplicit) {
      const current = (await git(ctx, ['remote', 'get-url', 'origin'], { allowFail: true })).stdout.trim();
      if (current !== ctx.opts.repoUrl) {
        ctx.log.warn(`repo origin was ${current || '(none)'}; setting it to ${ctx.opts.repoUrl}`);
        await git(ctx, ['remote', current ? 'set-url' : 'add', 'origin', ctx.opts.repoUrl]);
      }
    }
    return;
  }
  if (fs.existsSync(repo) && fs.readdirSync(repo).length) {
    throw new UserError(`${repo} exists but is not a git clone; move it aside`);
  }
  fs.mkdirSync(root, { recursive: true });
  ctx.log.info(`cloning ${ctx.opts.repoUrl} (${ctx.opts.branch}) into repo/`);
  await git(ctx, [
    'clone', '--no-tags', '--single-branch', '--branch', ctx.opts.branch,
    '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true',
    ctx.opts.repoUrl, repo,
  ], { cwd: root, timeoutMs: 15 * 60_000 });
}

async function fetchTarget(ctx) {
  const { branch } = ctx.opts;
  await git(ctx, ['fetch', '--prune', '--no-tags', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`], { timeoutMs: 5 * 60_000 });
  const target = await revParse(ctx, `refs/remotes/origin/${branch}`);
  if (!target) throw new Error(`origin/${branch} does not resolve to a commit`);
  return target;
}

// repo/ always mirrors the live commit exactly: it is reset every cycle and never
// edited by hand. It only differs from origin/main while origin/main is a failed
// or rolled-back commit, so the supervisor never runs untested ops code.
async function syncRepoTree(ctx, sha) {
  const head = await revParse(ctx, 'HEAD');
  const dirty = (await git(ctx, ['status', '--porcelain', '--untracked-files=all', '--ignored'], { allowFail: true })).stdout.trim();
  if (head === sha && !dirty) return;
  await git(ctx, ['reset', '--quiet', '--hard', sha]);
  await git(ctx, ['clean', '-ffdxq']);
  if (head !== sha) ctx.log.info(`repo/ now at ${short(sha)}`);
}

// --------------------------------------------------------------- building

// Writes the files of a commit (or any tree-ish, e.g. `<sha>:ops`) into dir
// through a throwaway index, leaving repo/ untouched.
async function materialize(ctx, treeish, dir, sink) {
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(ctx.paths.tmp, { recursive: true });
  const index = path.join(ctx.paths.tmp, `index-${short(treeish)}-${process.pid}-${Date.now().toString(36)}`);
  const gitDir = path.join(ctx.paths.repo, '.git');
  const env = { GIT_INDEX_FILE: index };
  try {
    await git(ctx, [`--git-dir=${gitDir}`, '--work-tree=.', 'read-tree', treeish], { cwd: dir, env, sink });
    await git(ctx, [`--git-dir=${gitDir}`, '--work-tree=.', 'checkout-index', '--all', '--force'], { cwd: dir, env, sink, timeoutMs: 10 * 60_000 });
  } finally {
    await fsp.rm(index, { force: true }).catch(() => {});
  }
}

async function npmStep(ctx, dir, args, timeoutMs, sink) {
  const { cmd, args: fullArgs, shell } = npmCommand(args);
  sink.line(`$ npm ${args.join(' ')}`);
  const res = await run(cmd, fullArgs, {
    cwd: dir,
    timeoutMs,
    sink,
    shell,
    env: childEnv({
      npm_config_cache: ctx.paths.npmCache,
      npm_config_update_notifier: 'false',
      npm_config_fund: 'false',
      npm_config_audit: 'false',
      npm_config_progress: 'false',
    }),
  });
  if (res.code !== 0) {
    throw new Error(`npm ${args[0] === 'run' ? `run ${args[1]}` : args[0]} failed (exit ${res.code}${res.timedOut ? ', timed out' : ''})`);
  }
}

function httpGet(port, pathname, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pathname, agent: false, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, raw, body: raw.toString('utf8') });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`GET ${pathname} timed out`)));
    req.on('error', reject);
  });
}

function smokePorts(spec) {
  const text = String(spec).trim();
  if (text === '' || text === '0') return [0];
  const range = /^(\d+)-(\d+)$/.exec(text);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    if (lo < 1 || hi > 65535 || hi < lo) throw new UserError(`invalid --smoke-ports: ${spec}`);
    const ports = [];
    for (let i = 0; i < 8; i += 1) ports.push(lo + Math.floor(Math.random() * (hi - lo + 1)));
    return ports;
  }
  const single = Number(text);
  if (!Number.isInteger(single) || single < 1 || single > 65535) throw new UserError(`invalid --smoke-ports: ${spec}`);
  return [single];
}

// Starts a candidate ops/server.mjs and resolves once it prints its
// {"event":"listening"} line. Rejects (and kills it) if it exits or stays silent.
function launchCandidate(script, args, cwd, sink, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv() });
    activeChildren.add(child);
    let out = '';
    let err = '';
    let settled = false;
    let exitCode = null;
    const exited = new Promise((r) => child.once('close', (code) => { exitCode = code; activeChildren.delete(child); r(code); }));
    const handle = {
      port: null,
      exited,
      exitInfo: () => (exitCode === null ? null : `exit ${exitCode}: ${errorLine(err)}`),
      stop: async () => {
        killTree(child);
        await Promise.race([exited, sleep(5000)]);
        activeChildren.delete(child);
      },
    };
    const fail = async (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      await handle.stop();
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error(`${label} smoke server did not start within 20 s`)), 20_000);
    child.stderr.on('data', (d) => { err = (err + d).slice(-CAPTURE_MAX); sink(d); });
    child.stdout.on('data', (d) => {
      if (settled) return; // keep draining the pipe
      out = (out + d).slice(-CAPTURE_MAX);
      const complete = out.split(/\r?\n/).slice(0, -1); // ignore a line still being written
      const line = complete.find((l) => l.startsWith('{') && l.includes('"listening"'));
      if (!line) return;
      let port = null;
      try { ({ port } = JSON.parse(line)); } catch { port = null; }
      if (!Number.isInteger(port) || port <= 0) {
        fail(new Error(`${label} smoke server printed a bad listening line: ${line.slice(0, 200)}`));
        return;
      }
      settled = true;
      clearTimeout(timer);
      handle.port = port;
      resolve(handle);
    });
    child.once('close', (code) => {
      if (settled) return;
      const error = new Error(`${label} smoke server exited early (exit ${code}): ${errorLine(err)}`);
      error.retryable = /EADDRINUSE/.test(err);
      fail(error);
    });
  });
}

async function startCandidate(ctx, script, args, cwd, sink, label) {
  let lastError = null;
  for (const port of smokePorts(ctx.opts.smokePorts)) {
    try {
      const srv = await launchCandidate(script, [...args, '--port', String(port)], cwd, sink, label);
      sink.line(`${label} smoke server listening on ${srv.port}`);
      return srv;
    } catch (err) {
      lastError = err;
      sink.line(`${label} smoke server on port ${port} failed: ${err.message}`);
      if (!err.retryable) break;
    }
  }
  throw lastError || new Error(`${label} smoke server did not start`);
}

// GET against a smoke server; a failed request names the crash if the server died.
async function probe(srv, pathname, label, sink) {
  try {
    const res = await httpGet(srv.port, pathname);
    if (sink) sink.line(`${label} GET ${pathname} -> ${res.status} (${res.raw.length} bytes)`);
    return res;
  } catch (err) {
    await Promise.race([srv.exited, sleep(500)]);
    const exit = srv.exitInfo();
    throw new Error(`${label} smoke: GET ${pathname} failed: ${exit ? `server exited (${exit})` : err.message}`);
  }
}

// 1. The candidate's server.mjs serving dist/ directly (--root).
async function smokeFixed(ctx, script, dir, sha, sink) {
  const label = 'fixed-root';
  const srv = await startCandidate(ctx, script, [
    '--root', path.join(dir, 'dist'), '--sha', sha, '--no-log', '--downloads', ctx.paths.downloads,
  ], dir, sink, label);
  try {
    const home = await probe(srv, '/', label, sink);
    if (home.status !== 200) throw new Error(`${label} smoke: GET / returned ${home.status}`);
    const health = await probe(srv, '/healthz', label, sink);
    if (health.status !== 200 || health.body.trim() !== 'ok') {
      throw new Error(`${label} smoke: GET /healthz returned ${health.status} ${JSON.stringify(health.body.trim().slice(0, 80))}`);
    }
    return { home: home.raw };
  } finally {
    await srv.stop();
  }
}

async function removeLinkIfAny(p) {
  const st = await fsp.lstat(p).catch(() => null);
  if (st && st.isSymbolicLink()) await retrying(() => fsp.unlink(p));
}

// Deletes a scratch folder, unlinking its junctions first so nothing behind them is touched.
async function clearScratch(dir, links) {
  for (const link of links) await removeLinkIfAny(link);
  await rmrf(dir);
}

// 2. The candidate's server.mjs the way the origin runs it: following
// <deploy-root>/state.json. A scratch deploy root whose builds/ is a junction to
// the real builds/ starts on a copy of the live state, then switches to the state
// this deploy is about to write. The server must pick up the switch, stay healthy,
// and serve the same GET / as the fixed-root smoke.
async function smokeFollow(ctx, script, sha, name, before, expectedHome, sink) {
  const label = 'follow-mode';
  const box = path.join(ctx.paths.tmp, `follow-${name}-${process.pid}`);
  const link = path.join(box, 'builds');
  await clearScratch(box, [link]);
  await fsp.mkdir(box, { recursive: true });
  await fsp.symlink(ctx.paths.builds, link, 'junction');
  const statePath = path.join(box, 'state.json');
  const liveIndex = before.build ? path.join(ctx.paths.builds, before.build, 'dist', 'index.html') : null;
  const liveServable = Boolean(liveIndex && fs.existsSync(liveIndex));
  await writeJsonAtomic(statePath, before);
  let srv = null;
  let ok = false;
  try {
    srv = await startCandidate(ctx, script, ['--deploy-root', box, '--downloads', ctx.paths.downloads], box, sink, label);
    const first = await probe(srv, '/healthz', label, sink);
    if (liveServable) {
      if (first.status !== 200 || first.body.trim() !== 'ok') {
        throw new Error(`${label} smoke: /healthz returned ${first.status} while following the live build ${before.build}`);
      }
      const live = await probe(srv, '/', label, sink);
      if (live.status !== 200) throw new Error(`${label} smoke: GET / returned ${live.status} for the live build ${before.build}`);
    }

    await writeJsonAtomic(statePath, nextDeployState(before, sha, name, iso()));
    sink.line(`${label}: scratch state.json now points at ${name}`);
    const deadline = Date.now() + 10_000;
    for (;;) {
      const res = await probe(srv, '/__deploy', label, null);
      let info = null;
      try { info = JSON.parse(res.body); } catch { info = null; }
      if (res.status === 200 && info && info.sha === sha) break;
      if (Date.now() > deadline) {
        throw new Error(`${label} smoke: server did not pick up the new state.json within 10 s (/__deploy ${res.status} ${res.body.trim().slice(0, 120)})`);
      }
      await sleep(100);
    }
    const health = await probe(srv, '/healthz', label, sink);
    if (health.status !== 200 || health.body.trim() !== 'ok') {
      throw new Error(`${label} smoke: /healthz returned ${health.status} ${JSON.stringify(health.body.trim().slice(0, 80))} after the switch`);
    }
    const home = await probe(srv, '/', label, sink);
    if (home.status !== 200) throw new Error(`${label} smoke: GET / returned ${home.status} after the switch`);
    if (!home.raw.equals(expectedHome)) {
      throw new Error(`${label} smoke: after the switch GET / differs from the fixed-root smoke of the same build (still serving the old build?)`);
    }
    ok = true;
  } finally {
    if (srv) await srv.stop();
    if (!ok) {
      const log = await fsp.readFile(path.join(box, 'logs', 'server.log'), 'utf8').catch(() => '');
      if (log) sink.line(`${label} server.log (tail):\n${log.slice(-4000)}`);
    }
    await clearScratch(box, [link]).catch((err) => ctx.log.warn(`could not remove ${path.relative(ctx.paths.root, box)}: ${err.message}`));
  }
}

// ----------------------------------------------------------- ops/ checks

async function opsTree(ctx, sha) {
  if (!sha) return null;
  const res = await git(ctx, ['rev-parse', '--verify', '--quiet', `${sha}:ops`], { allowFail: true });
  return res.code === 0 ? res.stdout.trim() : null;
}

// Every ops/*.mjs must at least parse.
async function checkNodeSyntax(opsDir, sink) {
  const files = (await fsp.readdir(opsDir)).filter((f) => f.endsWith('.mjs')).sort();
  for (const file of files) {
    const res = await run(process.execPath, ['--check', path.join(opsDir, file)], { cwd: opsDir, timeoutMs: 60_000, sink });
    if (res.code !== 0) throw new Error(`node --check ops/${file} failed: ${errorLine(res.stderr)}`);
  }
  sink.line(`node --check passed: ${files.map((f) => `ops/${f}`).join(', ')}`);
}

// Parses every file with Windows PowerShell 5.1's own parser, then checks that every
// statically named command resolves: a function defined in some ops/*.ps1, or a
// cmdlet / application Get-Command can find. Reads candidate files; runs none of them.
const PS_CHECK = String.raw`
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ne 5) { 'VERSION' + [char]9 + $PSVersionTable.PSVersion }
$files = @(Get-ChildItem -LiteralPath $env:DEX_OPS_CHECK_DIR -Filter '*.ps1' -File | Sort-Object Name)
$defined = @{}
$asts = @()
foreach ($f in $files) {
    $tokens = $null; $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errors)
    foreach ($e in $errors) { 'PARSE' + [char]9 + $f.Name + [char]9 + $e.Extent.StartLineNumber + [char]9 + $e.Message }
    $asts += ,@($f.Name, $ast)
    foreach ($fn in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) { $defined[$fn.Name] = $true }
}
$known = @{}
foreach ($pair in $asts) {
    foreach ($c in $pair[1].FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true)) {
        $name = $c.GetCommandName()
        if (-not $name -or $defined.ContainsKey($name)) { continue }
        if (-not $known.ContainsKey($name)) { $known[$name] = [bool](Get-Command -Name $name -ErrorAction SilentlyContinue) }
        if (-not $known[$name]) { 'COMMAND' + [char]9 + $pair[0] + [char]9 + $c.Extent.StartLineNumber + [char]9 + $name }
    }
}
'DONE' + [char]9 + $files.Count
`;

async function checkPowerShell(opsDir, sink) {
  const files = (await fsp.readdir(opsDir)).filter((f) => f.toLowerCase().endsWith('.ps1')).sort();
  const problems = [];
  for (const file of files) {
    const bytes = await fsp.readFile(path.join(opsDir, file));
    const at = bytes.findIndex((b) => b > 0x7f);
    if (at !== -1) problems.push(`ops/${file} has a non-ASCII byte at offset ${at} (Windows PowerShell 5.1 reads BOM-less files as ANSI)`);
  }
  if (process.platform !== 'win32') {
    sink.line('not on Windows: skipped the PowerShell 5.1 parse check');
  } else if (files.length) {
    const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const res = await run(exe, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-EncodedCommand', Buffer.from(PS_CHECK, 'utf16le').toString('base64'),
    ], { cwd: opsDir, env: childEnv({ DEX_OPS_CHECK_DIR: opsDir }), timeoutMs: 180_000 });
    const lines = res.stdout.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const [kind, file, lineNo, detail] = line.split('\t');
      if (kind === 'PARSE') problems.push(`ops/${file} line ${lineNo} does not parse: ${detail}`);
      if (kind === 'COMMAND') problems.push(`ops/${file} line ${lineNo} calls ${detail}, which no ops/*.ps1 defines and Get-Command cannot find`);
      if (kind === 'VERSION') problems.push(`expected Windows PowerShell 5.1 for the check, got ${file}`);
    }
    const done = lines.find((l) => l.startsWith('DONE\t'));
    if (res.code !== 0 || !done) {
      problems.push(`the PowerShell check did not finish (exit ${res.code}${res.timedOut ? ', timed out' : ''}): ${errorLine(res.stderr || res.stdout)}`);
    }
  }
  if (problems.length) {
    for (const p of problems) sink.line(`PowerShell check: ${p}`);
    throw new Error(`PowerShell check failed: ${problems[0]}${problems.length > 1 ? ` (+${problems.length - 1} more)` : ''}`);
  }
  sink.line(`PowerShell check passed: ${files.map((f) => `ops/${f}`).join(', ') || 'no .ps1 files'}`);
}

// Runs the candidate's deploy.mjs end to end against a scratch repo and deploy root
// under tmp/: a tiny site whose ops/ is a copy of the candidate's, with commit P
// seeded as live and T on main. The candidate must deploy T with --once (clone,
// fetch, build, its own smoke tests, switch), print it with --status, and put P back
// with --rollback. This is the code the supervisor runs next, and what
// `deploy.mjs --rollback` runs.
async function selfTestDeployer(ctx, opsDir, sink) {
  const box = path.join(ctx.paths.tmp, `selftest-${process.pid}-${Date.now().toString(36)}`);
  const src = path.join(box, 'src');
  const root = path.join(box, 'root');
  const script = path.join(opsDir, 'deploy.mjs');
  const env = childEnv({ [SELFTEST_ENV]: '1' });
  const g = async (args) => (await git(ctx, [
    '-c', 'user.name=dex.place deployer self-test', '-c', 'user.email=deployer@localhost',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', '-c', `core.hooksPath=${path.join(box, 'no-hooks')}`,
    ...args,
  ], { cwd: src })).stdout.trim();
  const write = (rel, text) => fsp.writeFile(path.join(src, rel), text);
  const readScratchState = async () => JSON.parse(await fsp.readFile(path.join(root, 'state.json'), 'utf8'));
  const candidate = async (args, timeoutMs) => {
    sink.line(`self-test $ node ops/deploy.mjs ${args.join(' ')}`);
    const res = await run(process.execPath, [script, ...args, '--deploy-root', root], { cwd: box, env, timeoutMs, sink });
    if (res.code !== 0) {
      throw new Error(`deployer self-test: ${args[0]} exited ${res.code}${res.timedOut ? ' (timed out)' : ''}: ${errorLine(res.stderr) || errorLine(res.stdout)}`);
    }
    return res;
  };
  try {
    await rmrf(box);
    await fsp.mkdir(src, { recursive: true });
    await fsp.cp(opsDir, path.join(src, 'ops'), { recursive: true });
    const pkg = { name: 'dex-place-deployer-selftest', version: '1.0.0', private: true, scripts: { build: 'node build.mjs' } };
    await write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
    await write('package-lock.json', `${JSON.stringify({
      name: pkg.name, version: pkg.version, lockfileVersion: 3, requires: true,
      packages: { '': { name: pkg.name, version: pkg.version } },
    }, null, 2)}\n`);
    await write('build.mjs', [
      "import fs from 'node:fs';",
      "const label = fs.readFileSync('label.txt', 'utf8').trim();",
      "fs.mkdirSync('dist', { recursive: true });",
      'fs.writeFileSync(\'dist/index.html\', `<!doctype html><title>${label}</title>\\n`);',
      '',
    ].join('\n'));
    await write('label.txt', 'selftest-previous\n');
    await g(['init', '-q']);
    await g(['symbolic-ref', 'HEAD', 'refs/heads/main']);
    await g(['add', '-A']);
    await g(['commit', '-q', '--no-verify', '-m', 'self-test: previous']);
    const prev = await g(['rev-parse', 'HEAD']);
    await write('label.txt', 'selftest-target\n');
    await g(['commit', '-q', '--no-verify', '-am', 'self-test: target']);
    const target = await g(['rev-parse', 'HEAD']);

    // Seed P as the live build, the way a real deploy root looks.
    const prevName = short(prev);
    const prevDist = path.join(root, 'builds', prevName, 'dist');
    await fsp.mkdir(prevDist, { recursive: true });
    await fsp.writeFile(path.join(prevDist, 'index.html'), '<!doctype html><title>selftest-previous</title>\n');
    await writeJsonAtomic(path.join(root, 'builds', prevName, MARKER), { sha: prev, builtAt: iso() });
    const seededAt = iso();
    await writeJsonAtomic(path.join(root, 'state.json'), {
      schema: 1, sha: prev, build: prevName, deployedAt: seededAt, previousSha: null, previousBuild: null,
      heldSha: null, history: [{ sha: prev, build: prevName, deployedAt: seededAt }],
    });

    await candidate(['--once', '--repo-url', src, '--branch', 'main', '--smoke-ports', String(ctx.opts.smokePorts)], 10 * 60_000);
    const deployed = await readScratchState();
    if (deployed.sha !== target || deployed.build !== short(target) || deployed.previousSha !== prev) {
      throw new Error(`deployer self-test: after --once state.json is ${JSON.stringify({ sha: deployed.sha, build: deployed.build, previousSha: deployed.previousSha })}, expected ${short(target)} live with ${short(prev)} previous`);
    }
    const index = await fsp.readFile(path.join(root, 'builds', short(target), 'dist', 'index.html'), 'utf8').catch(() => '');
    if (!index.includes('selftest-target')) throw new Error('deployer self-test: --once did not leave the built dist/index.html in builds/');

    const status = await candidate(['--status'], 60_000);
    let printed = null;
    try { printed = JSON.parse(status.stdout.slice(Math.max(0, status.stdout.search(/^\{/m)))); } catch { printed = null; }
    if (!printed || printed.sha !== target) throw new Error('deployer self-test: --status did not print the live state');

    await candidate(['--rollback'], 60_000);
    const back = await readScratchState();
    if (back.sha !== prev || back.build !== prevName) {
      throw new Error(`deployer self-test: --rollback left ${short(back.sha)} live, expected ${short(prev)}`);
    }
    sink.line(`deployer self-test passed (--once deployed ${short(target)}, --status, --rollback to ${short(prev)})`);
  } finally {
    await rmrf(box).catch((err) => ctx.log.warn(`could not remove ${path.relative(ctx.paths.root, box)}: ${err.message}`));
  }
}

async function checkOpsCode(ctx, opsDir, sha, before, sink) {
  const [liveTree, candidateTree] = await Promise.all([opsTree(ctx, before.sha), opsTree(ctx, sha)]);
  if (liveTree && candidateTree && liveTree === candidateTree) {
    sink.line(`ops/ is identical to the live commit ${short(before.sha)}; no ops code checks needed`);
    return;
  }
  sink.line(`ops/ differs from the live commit${before.sha ? ` ${short(before.sha)}` : ''}; checking the code the origin will run`);
  await checkNodeSyntax(opsDir, sink);
  await checkPowerShell(opsDir, sink);
  if (process.env[SELFTEST_ENV]) {
    sink.line('inside a deployer self-test: skipping the nested self-test');
    return;
  }
  await selfTestDeployer(ctx, opsDir, sink);
}

// Everything a candidate must pass before state.json may point at it.
async function verifyCandidate(ctx, dir, sha, name, before, sink) {
  const opsDir = path.join(dir, 'ops');
  const missing = OPS_ENTRY_POINTS.filter((f) => !fs.existsSync(path.join(opsDir, f)));
  if (missing.length) throw new Error(`commit has no ops/${missing.join(', ops/')}; the origin cannot run without it`);
  const server = path.join(opsDir, 'server.mjs');
  sink.line("smoke test 1/2: the commit's own ops/server.mjs with --root");
  const { home } = await smokeFixed(ctx, server, dir, sha, sink);
  sink.line('smoke test 2/2: the same server.mjs following state.json (--deploy-root), as the origin runs it');
  await smokeFollow(ctx, server, sha, name, before, home, sink);
  await checkOpsCode(ctx, opsDir, sha, before, sink);
}

async function readMarker(dir) {
  try {
    return JSON.parse(await fsp.readFile(path.join(dir, MARKER), 'utf8'));
  } catch {
    return null;
  }
}

async function stripWorkspace(dir) {
  for (const entry of await fsp.readdir(dir)) {
    if (entry === 'dist' || entry === MARKER) continue;
    await rmrf(path.join(dir, entry));
  }
}

async function buildCommit(ctx, sha, dir, sink) {
  const marker = await readMarker(dir);
  if (marker && marker.sha === sha && fs.existsSync(path.join(dir, 'dist', 'index.html'))) {
    sink.line(`reusing existing build of ${sha}`);
    // The workspace was trimmed to dist/ after it went live; the checks need ops/ back.
    const opsDir = path.join(dir, 'ops');
    await rmrf(opsDir);
    if (await opsTree(ctx, sha)) await materialize(ctx, `${sha}:ops`, opsDir, sink);
    return;
  }
  await rmrf(dir);
  sink.line(`materialising ${sha}`);
  await materialize(ctx, sha, dir, sink);

  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) throw new Error('commit has no package.json');
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, '')); } catch { throw new Error('package.json is not valid JSON'); }
  if (!pkg.scripts || typeof pkg.scripts.build !== 'string') throw new Error('package.json has no "build" script');

  const locked = ['package-lock.json', 'npm-shrinkwrap.json'].some((f) => fs.existsSync(path.join(dir, f)));
  await npmStep(ctx, dir, [locked ? 'ci' : 'install', '--include=dev', '--no-audit', '--no-fund'], ctx.opts.installTimeoutMs, sink);
  await npmStep(ctx, dir, ['run', 'build'], ctx.opts.buildTimeoutMs, sink);

  const index = path.join(dir, 'dist', 'index.html');
  const st = fs.statSync(index, { throwIfNoEntry: false });
  if (!st || !st.isFile()) throw new Error('build did not produce dist/index.html');
}

function protectedBuilds(state) {
  return new Set([state.build, state.previousBuild].filter(Boolean));
}

// The state.json that makes `sha` (built in builds/<name>) live after `current`.
function nextDeployState(current, sha, name, deployedAt) {
  const history = [{ sha, build: name, deployedAt }, ...(current.history || []).filter((h) => h && h.sha !== sha)].slice(0, HISTORY_MAX);
  return {
    ...current,
    schema: 1,
    sha,
    build: name,
    deployedAt,
    previousSha: current.sha || null,
    previousBuild: current.build || null,
    heldSha: null,
    history,
  };
}

async function recordFailure(ctx, sha, logFile, reason) {
  await withStateLock(ctx, async () => {
    const current = await readState(ctx);
    await writeJsonAtomic(ctx.paths.state, {
      ...current,
      schema: 1,
      lastFailedSha: sha,
      lastFailedAt: iso(),
      lastFailedLog: path.relative(ctx.paths.root, logFile),
      lastFailedReason: String(reason).slice(0, 500),
    });
  });
}

async function deployCommit(ctx, sha, before) {
  const name = short(sha);
  const dir = path.join(ctx.paths.builds, name);
  const logFile = path.join(ctx.paths.buildLogs, `${stamp()}-${name}.log`);
  const sink = openSink(logFile);
  ctx.log.info(`deploying ${name} (build log ${path.relative(ctx.paths.root, logFile)})`);
  sink.line(`deploy ${sha} (live: ${before.sha || 'none'})`);
  ctx.building = name;
  try {
    if (protectedBuilds(before).has(name) && !(await readMarker(dir))) {
      throw new Error(`builds/${name} is live or previous but has no build marker; refusing to overwrite`);
    }
    await buildCommit(ctx, sha, dir, sink);
    if (ctx.stopping) throw new Error('stopping');
    await verifyCandidate(ctx, dir, sha, name, before, sink);
    if (ctx.stopping) throw new Error('stopping');
    await writeJsonAtomic(path.join(dir, MARKER), { sha, builtAt: iso() });

    const switched = await withStateLock(ctx, async () => {
      const current = await readState(ctx);
      if ((current.sha || null) !== (before.sha || null)) return 'state changed while building (rollback?)';
      if (current.heldSha === sha && !ctx.opts.force) return 'commit was rolled back while building';
      await writeJsonAtomic(ctx.paths.state, nextDeployState(current, sha, name, iso()));
      return null;
    });
    if (switched) {
      sink.line(`not switching: ${switched}`);
      ctx.log.warn(`built ${name} but did not switch: ${switched}`);
      return { status: 'aborted' };
    }
    sink.line(`live: ${sha}`);
    ctx.log.info(`live: ${name} (previous ${short(before.sha) || 'none'})`);
    await stripWorkspace(dir).catch((err) => ctx.log.warn(`could not trim builds/${name}: ${err.message}`));
    return { status: 'deployed' };
  } catch (err) {
    sink.line(`FAILED: ${err.message}`);
    if (ctx.stopping) {
      ctx.log.warn(`deploy of ${name} interrupted by shutdown`);
      return { status: 'interrupted' };
    }
    ctx.log.error(`deploy of ${name} failed: ${err.message}; ${short(before.sha) || 'nothing'} stays live`);
    await recordFailure(ctx, sha, logFile, err.message);
    if (!protectedBuilds(await readState(ctx)).has(name)) await rmrf(dir).catch(() => {});
    else if (await readMarker(dir)) await stripWorkspace(dir).catch(() => {}); // live/previous: back to dist/ only
    return { status: 'failed', error: err.message };
  } finally {
    ctx.building = null;
    sink.close();
  }
}

async function prune(ctx) {
  const state = await readState(ctx);
  // Keep the newest `keep` successful builds, plus live and previous no matter what.
  const newest = [];
  for (const entry of state.history || []) {
    if (entry && entry.build && !newest.includes(entry.build)) newest.push(entry.build);
    if (newest.length >= ctx.opts.keep) break;
  }
  const retain = new Set([...protectedBuilds(state), ...newest]);
  let entries = [];
  try { entries = await fsp.readdir(ctx.paths.builds); } catch { return; }
  for (const entry of entries) {
    if (retain.has(entry) || entry === ctx.building) continue;
    ctx.log.info(`pruning builds/${entry}`);
    await rmrf(path.join(ctx.paths.builds, entry)).catch((err) => ctx.log.warn(`prune ${entry}: ${err.message}`));
  }
  try {
    const logs = (await fsp.readdir(ctx.paths.buildLogs)).filter((f) => f.endsWith('.log')).sort();
    for (const file of logs.slice(0, Math.max(0, logs.length - BUILD_LOGS_KEEP))) {
      await fsp.rm(path.join(ctx.paths.buildLogs, file), { force: true });
    }
  } catch { /* no logs yet */ }
}

// ------------------------------------------------------------------ cycles

async function cycle(ctx) {
  await ensureRepo(ctx);
  const target = await fetchTarget(ctx);
  const before = await readState(ctx);
  let outcome;
  if (before.sha === target) {
    outcome = { status: 'current' };
  } else if (!ctx.opts.force && before.lastFailedSha === target) {
    outcome = { status: 'skipped', reason: `origin/${ctx.opts.branch} ${short(target)} failed before; waiting for a new commit` };
  } else if (!ctx.opts.force && before.heldSha === target) {
    outcome = { status: 'skipped', reason: `origin/${ctx.opts.branch} ${short(target)} was rolled back; waiting for a new commit` };
  } else {
    outcome = await deployCommit(ctx, target, before);
  }
  if (outcome.status === 'skipped' && outcome.reason !== ctx.lastSkipReason) ctx.log.info(outcome.reason);
  ctx.lastSkipReason = outcome.status === 'skipped' ? outcome.reason : null;

  const after = await readState(ctx);
  try {
    await syncRepoTree(ctx, after.sha || target);
  } catch (err) {
    ctx.log.warn(`could not reset repo/ to ${short(after.sha || target)}: ${err.message}; using origin/${ctx.opts.branch}`);
    await syncRepoTree(ctx, target).catch((e) => ctx.log.error(`repo/ reset failed: ${e.message}`));
  }
  await prune(ctx);
  return { ...outcome, target, live: after.sha || null };
}

// After a cycle completes, a deployer running from repo/ops copies the ops/ tree
// it was started from (ctx.startupHead, read from git, not from the working tree
// that the cycle may have just reset) into ops-good/. That copy is what the
// supervisor falls back to when repo/ops/deploy.mjs keeps crashing.
async function promoteOps(ctx) {
  if (ctx.role !== 'repo' || ctx.promoted || !ctx.startupHead) return;
  const tree = await opsTree(ctx, ctx.startupHead);
  if (!tree) return;
  const good = ctx.paths.opsGood;
  let marker = null;
  try { marker = JSON.parse(await fsp.readFile(path.join(good, OPS_MARKER), 'utf8')); } catch { marker = null; }
  if (marker && marker.tree === tree && fs.existsSync(path.join(good, 'deploy.mjs'))) {
    ctx.promoted = true;
    return;
  }
  const staging = path.join(ctx.paths.tmp, `ops-good-new-${process.pid}`);
  const old = path.join(ctx.paths.tmp, `ops-good-old-${process.pid}`);
  await rmrf(staging);
  await rmrf(old);
  await materialize(ctx, tree, staging, null);
  await writeJsonAtomic(path.join(staging, OPS_MARKER), { sha: ctx.startupHead, tree, savedAt: iso() });
  if (fs.existsSync(good)) await retrying(() => fsp.rename(good, old));
  await retrying(() => fsp.rename(staging, good));
  await rmrf(old).catch(() => {});
  ctx.promoted = true;
  ctx.log.info(`ops-good/ now holds ops/ from ${short(ctx.startupHead)}, the deployer code that just completed a cycle`);
}

// True when the live commit's ops/ differs from the code this process started
// with, and the new code is already on disk in repo/.
async function opsChanged(ctx) {
  if (!ctx.selfUpdate || !ctx.startupHead) return false;
  const head = await revParse(ctx, 'HEAD');
  const state = await readState(ctx);
  if (!head || !state.sha || head !== state.sha || head === ctx.startupHead) return false;
  const diff = await git(ctx, ['diff', '--quiet', ctx.startupHead, head, '--', 'ops'], { allowFail: true });
  return diff.code !== 0;
}

async function rollback(ctx) {
  return withStateLock(ctx, async () => {
    const current = await readState(ctx);
    if (!current.previousSha || !current.previousBuild) throw new UserError('no previous build recorded; nothing to roll back to');
    const index = path.join(ctx.paths.builds, current.previousBuild, 'dist', 'index.html');
    if (!fs.existsSync(index)) throw new UserError(`previous build ${current.previousBuild} is no longer on disk`);
    const now = iso();
    const next = {
      ...current,
      schema: 1,
      sha: current.previousSha,
      build: current.previousBuild,
      deployedAt: now,
      previousSha: current.sha || null,
      previousBuild: current.build || null,
      heldSha: current.sha || null,
      rolledBackAt: now,
    };
    await writeJsonAtomic(ctx.paths.state, next);
    return next;
  });
}

function installSignalHandlers(ctx) {
  const stop = (signal) => {
    if (ctx.stopping) return;
    ctx.stopping = true;
    ctx.log.info(`received ${signal}; stopping`);
    for (const child of activeChildren) killTree(child);
    if (ctx.wake) ctx.wake();
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGBREAK', () => stop('SIGBREAK'));
}

function isInside(base, candidate) {
  const rel = path.relative(base, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

function realOr(p) {
  try { return fs.realpathSync.native(p); } catch { return path.resolve(p); }
}

// repo: the live commit's code in repo/ops (what the supervisor normally runs).
// fallback: the last-known-good copy in ops-good/ (the supervisor runs it while
//   repo/ops/deploy.mjs keeps crashing; it exits 75 once the live ops/ changes).
// standalone: anything else, e.g. a checkout or a candidate under self-test.
function detectRole(paths) {
  const here = realOr(HERE);
  if (isInside(realOr(paths.repo), here)) return 'repo';
  if (isInside(realOr(paths.opsGood), here)) return 'fallback';
  return 'standalone';
}

async function afterCycle(ctx, result) {
  if (result.status === 'interrupted') return;
  try {
    await promoteOps(ctx);
  } catch (err) {
    ctx.log.warn(`could not update ops-good/: ${err.message}`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseOptions(argv);
  } catch (err) {
    process.stderr.write(`deploy: ${err.message}\n`);
    return EXIT.USAGE;
  }
  const paths = layout(opts.deployRoot);
  for (const dir of [paths.root, paths.builds, paths.downloads, paths.logs, paths.buildLogs, paths.npmCache, paths.tmp]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const role = detectRole(paths);
  const ctx = {
    opts,
    paths,
    log: new Logger(paths.log, opts.mode !== 'daemon' || process.stdout.isTTY),
    stopping: false,
    building: null,
    wake: null,
    lastSkipReason: null,
    role,
    selfUpdate: opts.selfUpdate ?? role !== 'standalone',
    startupHead: null,
    promoted: false,
  };

  if (opts.mode === 'status') {
    process.stdout.write(`${JSON.stringify(await readState(ctx), null, 2)}\n`);
    return EXIT.OK;
  }

  if (opts.mode === 'rollback') {
    try {
      const next = await rollback(ctx);
      ctx.log.info(`rolled back: live ${short(next.sha)} (was ${short(next.previousSha)}); ${short(next.heldSha)} will not redeploy until origin/${opts.branch} moves`);
      return EXIT.OK;
    } catch (err) {
      ctx.log.error(`rollback failed: ${err.message}`);
      return EXIT.FAILED;
    }
  }

  const lock = new DeployLock(paths.lock);
  const got = await lock.acquire(opts.mode);
  if (!got.ok) {
    ctx.log.warn(`another deployer holds ${path.basename(paths.lock)}${got.holder ? ` (pid ${got.holder.pid}, ${got.holder.mode})` : ''}; exiting`);
    return EXIT.LOCKED;
  }
  process.on('exit', () => lock.releaseSync());
  installSignalHandlers(ctx);

  try {
    if ((ctx.selfUpdate || ctx.role === 'repo') && fs.existsSync(path.join(paths.repo, '.git'))) ctx.startupHead = await revParse(ctx, 'HEAD');

    if (opts.mode === 'once') {
      let result;
      try {
        result = await cycle(ctx);
      } catch (err) {
        ctx.log.error(`cycle failed: ${err.message}`);
        return EXIT.FAILED;
      }
      await afterCycle(ctx, result);
      if (result.status === 'current') ctx.log.info(`already live: ${short(result.live)}`);
      if (result.status === 'failed' || result.status === 'interrupted') return EXIT.FAILED;
      if (await opsChanged(ctx)) {
        ctx.log.info('live commit changed ops/; exit 75 so the supervisor restarts with the new code');
        return EXIT.RESTART;
      }
      return EXIT.OK;
    }

    ctx.log.info(`deployer started (pid ${process.pid}, every ${opts.intervalMs / 1000}s, origin/${opts.branch}, ${ctx.role === 'fallback' ? 'running the last-known-good ops-good/ copy, ' : ''}self-update ${ctx.selfUpdate ? 'on' : 'off'})`);
    let lastIdleLog = 0;
    while (!ctx.stopping) {
      try {
        const result = await cycle(ctx);
        await afterCycle(ctx, result);
        if (result.status === 'current' && Date.now() - lastIdleLog > IDLE_LOG_EVERY_MS) {
          ctx.log.info(`up to date at ${short(result.live)}`);
          lastIdleLog = Date.now();
        }
        if (await opsChanged(ctx)) {
          ctx.log.info('live commit changed ops/; exit 75 so the supervisor restarts with the new code');
          return EXIT.RESTART;
        }
      } catch (err) {
        if (!ctx.stopping) ctx.log.error(`cycle failed: ${err.message}`);
      }
      if (ctx.stopping) break;
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, opts.intervalMs);
        ctx.wake = () => { clearTimeout(timer); resolve(); };
      });
      ctx.wake = null;
    }
    return EXIT.OK;
  } finally {
    lock.releaseSync();
  }
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

if (isEntryPoint()) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`deploy: ${err && err.stack ? err.stack : err}\n`);
      process.exit(EXIT.FAILED);
    },
  );
}
