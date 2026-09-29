#!/usr/bin/env node
// PC -> GitHub work-in-progress sync for cloud handoff.
//
// Snapshots the whole working tree (everything not git-ignored) plus a generated
// docs/handoff/ folder into the `pc-sync` branch and pushes it. It never touches
// main, the real index or the working tree: the snapshot is built in a private
// index file. Runs every 10 minutes from the "\Dex\Dex Place PC Sync" scheduled
// task (ops/install-pc-sync.ps1), so work keeps reaching GitHub even when no agent
// is running. See HANDOFF.md.
//
// Guards: one run at a time (lock file), files over 25 MB are skipped, and a
// secret-pattern hit in the new diff aborts the push and writes an alert.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BRANCH = 'pc-sync'
const LOG = 'D:/Dex/Temp/pc-sync.log'
const LOCK = path.join(REPO, '.git', 'pc-sync.lock')
const INDEX = path.join(REPO, '.git', 'pc-sync-index')
const MAX_BYTES = 25 * 1024 * 1024
const HOME = os.homedir()
const CLAUDE_PROJECTS = path.join(HOME, '.claude', 'projects')
const SECRET = /(hf_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{32,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY)/

const log = (m) => { try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`) } catch {} }
const git = (args, opts = {}) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts }).trim()
const gi = (args, input) => git(args, { env: { ...process.env, GIT_INDEX_FILE: INDEX }, input })
const tryGit = (args) => { try { return git(args) } catch { return '' } }

function lock() {
  try {
    const st = fs.statSync(LOCK)
    if (Date.now() - st.mtimeMs < 30 * 60 * 1000) { log('skip: another run holds the lock'); return false }
  } catch {}
  fs.writeFileSync(LOCK, String(process.pid))
  return true
}

// ---------- generated handoff material (added to the snapshot only) ----------
function recentJournals(hours) {
  const out = []
  const cutoff = Date.now() - hours * 3600 * 1000
  let projects = []
  try { projects = fs.readdirSync(CLAUDE_PROJECTS) } catch { return out }
  for (const p of projects) {
    const pdir = path.join(CLAUDE_PROJECTS, p)
    let sessions = []
    try { sessions = fs.readdirSync(pdir) } catch { continue }
    for (const s of sessions) {
      const wdir = path.join(pdir, s, 'subagents', 'workflows')
      let runs = []
      try { runs = fs.readdirSync(wdir) } catch { continue }
      for (const r of runs) {
        const j = path.join(wdir, r, 'journal.jsonl')
        try {
          const st = fs.statSync(j)
          if (st.mtimeMs >= cutoff && isDexPlaceRun(path.join(wdir, r))) out.push({ run: r, file: j, mtime: st.mtimeMs })
        } catch {}
      }
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime)
}

// Only dex.place runs belong in this public repo: other projects' workflows share
// ~/.claude/projects, so check that the run's agents were briefed on this repo.
function isDexPlaceRun(runDir) {
  let agents = []
  try { agents = fs.readdirSync(runDir).filter(f => /^agent-.*\.jsonl$/.test(f)) } catch { return false }
  for (const a of agents.slice(0, 3)) {
    try {
      const fd = fs.openSync(path.join(runDir, a), 'r')
      const buf = Buffer.alloc(65536)
      const n = fs.readSync(fd, buf, 0, buf.length, 0)
      fs.closeSync(fd)
      const head = buf.subarray(0, n).toString('utf8')
      if (/Projects\\\\dex\.place|Projects\/dex\.place|dex\.place (world|player character)|Repo D:\\\\Dex\\\\Projects\\\\dex\.place/i.test(head)) return true
    } catch {}
  }
  return false
}

function brief(result) {
  if (result == null) return ''
  if (typeof result !== 'object') return String(result).slice(0, 300)
  const bits = []
  if ('verdict' in result) bits.push(`verdict ${result.verdict}`)
  if ('score' in result) bits.push(`score ${result.score}`)
  if ('prefersOurs' in result) bits.push(`prefers ours: ${result.prefersOurs}`)
  if (Array.isArray(result.scores)) bits.push('scores ' + result.scores.map(s => `${s.candidate || s.letter} ${s.score}`).join(', '))
  if (Array.isArray(result.ranking)) bits.push('ranking ' + result.ranking.map(s => `${s.variant} ${s.score}`).join(', '))
  if (Array.isArray(result.blocking) && result.blocking.length) bits.push('blocking: ' + result.blocking.join(' | ').slice(0, 400))
  if (Array.isArray(result.topFixes) && result.topFixes.length) bits.push('top fixes: ' + result.topFixes.slice(0, 3).join(' | ').slice(0, 400))
  if (result.summary) bits.push(String(result.summary).replace(/\s+/g, ' ').slice(0, 420))
  return bits.join(' · ')
}

function workflowSection() {
  const lines = []
  for (const j of recentJournals(72).slice(0, 12)) {
    let entries = []
    try { entries = fs.readFileSync(j.file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) } catch { continue }
    const label = {}, status = {}, res = {}
    for (const e of entries) {
      if (e.type === 'started') { label[e.key] = e.label; status[e.key] = 'running' }
      else if (e.type === 'result') { status[e.key] = 'done'; res[e.key] = e.result }
      else if (e.type === 'failed') status[e.key] = 'failed'
    }
    const keys = Object.keys(label)
    const count = (s) => keys.filter(k => status[k] === s).length
    const age = Math.round((Date.now() - j.mtime) / 60000)
    lines.push(`### ${j.run} — last activity ${age} min ago`)
    lines.push(`${keys.length} agents: ${count('done')} done, ${count('running')} running or stopped mid-way, ${count('failed')} failed.`)
    lines.push('')
    for (const k of keys.slice(-14)) lines.push(`- **${label[k]}** (${status[k]})${res[k] ? ': ' + brief(res[k]) : ''}`)
    lines.push('')
  }
  return lines.length ? lines.join('\n') : '_No workflow activity in the last 72 hours._'
}

function liveSha() {
  try {
    const out = execFileSync('curl', ['-s', '--max-time', '5', 'http://127.0.0.1:8088/__deploy'], { encoding: 'utf8' })
    return JSON.parse(out).sha || 'unknown'
  } catch { return 'unknown (origin not reachable)' }
}

function generated() {
  const files = {} // repo-relative path -> Buffer
  const now = new Date()
  const resume = (() => { try { return fs.readFileSync(path.join(REPO, 'review', 'RESUME-AFTER-RESET.md'), 'utf8') } catch { return '_missing_' } })()
  const status = tryGit(['status', '--short'])
  const changed = status ? status.split('\n').length : 0
  files['docs/handoff/STATUS.md'] = Buffer.from(`# Live status (generated)

Written by \`ops/pc-sync.mjs\` on the PC at ${now.toISOString()} (${now.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' })} Bangkok).
Read \`HANDOFF.md\` first; this file is the moving part.

- main: \`${tryGit(['rev-parse', '--short', 'HEAD'])}\` "${tryGit(['log', '-1', '--format=%s'])}"
- live on dex.place: \`${liveSha().slice(0, 7)}\`
- uncommitted on the PC (all included in this pc-sync snapshot): ${changed} paths

## Workflow lanes in the last 72 hours (newest first)

Each entry is one orchestration run; agents are listed with their latest result.
"running or stopped mid-way" means the agent had no result when this was written.

${workflowSection()}

## Driver's resume notes (copied from the git-ignored review/RESUME-AFTER-RESET.md)

${resume}
`)
  // Orchestration scripts (the workflow sources) and the agent's memory notes for this project.
  try {
    for (const p of fs.readdirSync(CLAUDE_PROJECTS).filter(p => /dex-place/i.test(p))) {
      const pdir = path.join(CLAUDE_PROJECTS, p)
      for (const s of fs.readdirSync(pdir)) {
        const sdir = path.join(pdir, s, 'workflows', 'scripts')
        let scripts = []
        try { scripts = fs.readdirSync(sdir) } catch { continue }
        for (const f of scripts.filter(f => f.endsWith('.js'))) files[`docs/handoff/workflows/${f}`] = fs.readFileSync(path.join(sdir, f))
      }
    }
  } catch {}
  try {
    for (const p of fs.readdirSync(CLAUDE_PROJECTS)) {
      const mdir = path.join(CLAUDE_PROJECTS, p, 'memory')
      let mem = []
      try { mem = fs.readdirSync(mdir) } catch { continue }
      for (const f of mem.filter(f => /^dex-place-.*\.md$/.test(f) || f === 'workflow-resume-gotchas.md')) files[`docs/handoff/memory/${f}`] = fs.readFileSync(path.join(mdir, f))
    }
  } catch {}
  // Own-render media only (never sheets with third-party refs): the merged character stills
  // and anything curated into review/handoff-media/.
  const media = [path.join(REPO, 'review', 'rosace', 'art', 'integrated', 'look'), path.join(REPO, 'review', 'handoff-media')]
  for (const dir of media) {
    let list = []
    try { list = fs.readdirSync(dir) } catch { continue }
    for (const f of list.filter(f => /\.(png|gif|webp|jpg)$/i.test(f) && /_x3\.|_x4\.|handoff/i.test(f + dir))) {
      const full = path.join(dir, f)
      if (fs.statSync(full).size <= 4 * 1024 * 1024) files[`docs/handoff/media/${path.basename(dir)}-${f}`] = fs.readFileSync(full)
    }
  }
  return files
}

// ---------- snapshot + push ----------
function main() {
  if (process.env.PC_SYNC_DRY) { process.stdout.write(generated()['docs/handoff/STATUS.md'].toString('utf8')); return }
  if (!lock()) return
  try {
    const head = git(['rev-parse', 'HEAD'])
    const remote = tryGit(['ls-remote', 'origin', `refs/heads/${BRANCH}`]).split(/\s+/)[0] || ''
    if (remote) tryGit(['fetch', '-q', 'origin', `refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`])
    const prev = remote || ''

    try { fs.unlinkSync(INDEX) } catch {}
    gi(['read-tree', 'HEAD'])
    // Everything not ignored, minus oversized files.
    const cand = git(['ls-files', '-o', '-m', '--exclude-standard']).split('\n').filter(Boolean)
    const big = cand.filter(f => { try { return fs.statSync(path.join(REPO, f)).size > MAX_BYTES } catch { return false } })
    gi(['add', '-A', '--', '.', ...big.map(f => `:(exclude)${f}`)])
    for (const [rel, buf] of Object.entries(generated())) {
      const sha = gi(['hash-object', '-w', '--stdin'], buf)
      gi(['update-index', '--add', '--cacheinfo', `100644,${sha},${rel}`])
    }
    const tree = gi(['write-tree'])

    if (prev) {
      const prevTree = tryGit(['rev-parse', `${prev}^{tree}`])
      if (prevTree === tree) { log('skip: nothing changed'); return }
      let onlyStatus = false
      try { git(['diff', '--quiet', prevTree, tree, '--', '.', ':(exclude)docs/handoff/STATUS.md']); onlyStatus = true } catch {}
      const prevTime = Number(tryGit(['log', '-1', '--format=%ct', prev])) * 1000
      if (onlyStatus && Date.now() - prevTime < 60 * 60 * 1000) { log('skip: only STATUS.md changed, under an hour since the last push'); return }
      const diff = git(['diff', '-U0', prevTree, tree])
      const hit = diff.split('\n').find(l => l.startsWith('+') && SECRET.test(l))
      if (hit) { log('ABORT: secret-like pattern in the new diff; nothing pushed'); fs.writeFileSync('D:/Dex/Temp/pc-sync-ALERT.txt', `pc-sync aborted ${new Date().toISOString()}: secret-like pattern in the diff. Check the working tree.\n`); return }
    } else {
      const all = git(['diff', '-U0', git(['rev-parse', 'HEAD^{tree}']), tree])
      if (all.split('\n').find(l => l.startsWith('+') && SECRET.test(l))) { log('ABORT: secret-like pattern in the first snapshot'); return }
    }

    const parents = prev ? ['-p', prev] : []
    // Record main as a parent whenever it moved past the last snapshot, so the branch stays mergeable.
    if (!prev || !isAncestor(head, prev)) parents.push('-p', head)
    const msg = `pc-sync: work-in-progress snapshot ${new Date().toISOString()}\n\nAutomatic snapshot of the PC working tree for cloud handoff (see HANDOFF.md).\nmain at ${head.slice(0, 7)}.${big.length ? '\nSkipped (over 25 MB): ' + big.join(', ') : ''}`
    const commit = git(['commit-tree', tree, ...parents, '-m', msg])
    git(['push', '-q', 'origin', `${commit}:refs/heads/${BRANCH}`, `--force-with-lease=refs/heads/${BRANCH}:${prev}`])
    git(['update-ref', `refs/heads/${BRANCH}`, commit])
    log(`pushed ${commit.slice(0, 7)} (${big.length} big files skipped)`)
  } catch (e) {
    log(`ERROR ${String(e && e.message || e).split('\n')[0]}`)
    process.exitCode = 1
  } finally {
    try { fs.unlinkSync(LOCK) } catch {}
  }
}

function isAncestor(a, b) {
  try { git(['merge-base', '--is-ancestor', a, b]); return true } catch { return false }
}

main()
