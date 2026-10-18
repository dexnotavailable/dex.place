#!/usr/bin/env node
// Slot a finished Zhusha move into the game (Dex 10-16: "set up whatever system to have the workers slot in stuff
// as they go"). One command per move:
//
//   node tools/zhusha/slot-in.mjs <slot> [--from <dir>] [--dry] [--local] [--remove] [--no-verify]
//
//   <dir>        default: ../lanes/anim/moves/<slot>/final/ beside this worktree (frames + anim.json)
//   --dry        check only, change nothing
//   --local      copy into the game for a local look only: no tests, no commit, and git is told to ignore the folder
//                (.git/info/exclude) so it cannot be committed by accident; undo with --remove
//   --remove     take a --local slot back out (moved aside, never deleted)
//   --no-verify  skip check / test / build (never use before a commit that goes to the coordinator)
//
// It checks the move against the contract (slotin-lib.mjs: stage "pixel", 128 px, a measured 128 px figure in every
// drawing, nothing that looks like an H3 render), copies the drawings + anim.json into public/assets/zhusha/<slot>/
// (an older drop is moved aside, the folder replaced whole), adds a role to slots.json if no role plays the slot yet,
// runs `npm run check`, `npm test` and `npm run build`, and commits those paths on the current branch. It never pushes
// and never merges (the coordinator does), and it refuses to commit on main.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkMove, ensureRole } from "./slotin-lib.mjs";

const REPO = resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const slot = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--from");
const out = (s) => process.stdout.write(`${s}\n`);
const fail = (s, code = 2) => { process.stderr.write(`slot-in: ${s}\n`); process.exit(code); };

if (!slot) fail("usage: node tools/zhusha/slot-in.mjs <slot> [--from <dir>] [--dry] [--local] [--remove] [--no-verify]");
const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8" }).trim();
const dest = join(REPO, "public", "assets", "zhusha", slot);
const rel = `public/assets/zhusha/${slot}`;
const slotsPath = join(REPO, "src", "tesu", "zhusha", "slots.json");
const asideRoot = existsSync(resolve(REPO, "../lanes/zhusha")) ? resolve(REPO, "../lanes/zhusha/_moved-aside") : join(tmpdir(), "zhusha-moved-aside");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const exclude = resolve(REPO, git("rev-parse", "--git-path", "info/exclude"));

/** Moves a folder aside (never deletes); returns where it went. */
function aside(dir, why) {
  mkdirSync(asideRoot, { recursive: true });
  const to = join(asideRoot, `${slot}-${why}-${stamp}`);
  try {
    renameSync(dir, to);
  } catch {
    // another drive: a move is a copy, then the original goes once the copy is there
    cpSync(dir, to, { recursive: true });
    rmSync(dir, { recursive: true });
  }
  return to;
}

const excluded = () => (existsSync(exclude) ? readFileSync(exclude, "utf8").split(/\r?\n/).includes(`/${rel}/`) : false);

if (flag("--remove")) {
  if (!existsSync(dest)) fail(`${rel} is not there`);
  const tracked = git("ls-files", rel);
  if (tracked) fail(`${rel} is committed; take it out with git (revert the slot-in commit), not --remove`);
  const to = aside(dest, "local");
  if (excluded()) writeFileSync(exclude, readFileSync(exclude, "utf8").split(/\r?\n/).filter((l) => l !== `/${rel}/`).join("\n"));
  out(`removed the local ${slot} (moved aside to ${to})`);
  process.exit(0);
}

const from = resolve(opt("--from") ?? resolve(REPO, "../lanes/anim/moves", slot, "final"));
const res = checkMove(slot, from);
if (res.extra?.length) out(`note: not copied (not drawings of the move): ${res.extra.join(", ")}`);
if (!res.ok) {
  for (const p of res.problems) process.stderr.write(`  REFUSED ${p}\n`);
  fail(`${slot} from ${from}: ${res.problems.length} problem(s), nothing changed`);
}
out(`${slot}: ${res.def.frames.length} drawings, ${res.def.frames.reduce((t, f) => t + f.ticks, 0)} ticks, source ${res.def.source ?? "?"}: passes the contract`);
if (flag("--dry")) process.exit(0);

const local = flag("--local");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (!local && (branch === "main" || branch === "master" || branch === "HEAD")) fail(`on ${branch}: slot-in commits on a lane branch; the coordinator merges to main`);

// copy: an older drop is moved aside, the folder replaced whole
const before = existsSync(dest) ? aside(dest, "previous") : null;
mkdirSync(dest, { recursive: true });
for (const f of res.files) cpSync(join(from, f), join(dest, f));
const slotsText = readFileSync(slotsPath, "utf8");
const slots = JSON.parse(slotsText);
const added = ensureRole(slots, slot);
if (added) writeFileSync(slotsPath, `${JSON.stringify(slots, null, 2)}\n`);
out(`copied ${res.files.length} files into ${rel}${before ? ` (the previous drop moved aside to ${before})` : ""}${added ? `; slots.json: new role "${added}"` : ""}`);

if (local) {
  if (!excluded()) appendFileSync(exclude, `\n/${rel}/\n`);
  out(`LOCAL ONLY: ${rel} is ignored by git (info/exclude). Look at it, then: node tools/zhusha/slot-in.mjs ${slot} --remove`);
  process.exit(0);
}

const undo = (why) => {
  aside(dest, "refused");
  if (before) renameSync(before, dest);
  if (added) writeFileSync(slotsPath, slotsText);
  fail(`${why}: the copy is undone (the refused drop moved aside)`, 1);
};
if (!flag("--no-verify")) {
  for (const s of ["check", "test", "build"]) {
    out(`npm run ${s} ...`);
    const r = spawnSync("npm", ["run", s], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", shell: process.platform === "win32" });
    if (r.status !== 0) {
      process.stderr.write(`${(r.stdout ?? "").slice(-3000)}\n${(r.stderr ?? "").slice(-3000)}\n`);
      undo(`npm run ${s} failed`);
    }
  }
}
git("add", "-A", "--", rel, "src/tesu/zhusha/slots.json");
const msg = `Zhusha: ${slot} slotted in (${res.def.frames.length} drawings at 128 px${res.def.source ? `, from ${res.def.source}` : ""})\n\n` +
  `By tools/zhusha/slot-in.mjs from ${from.replace(/\\/g, "/")}: contract, check, test and build passed.\n\n` +
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
execFileSync("git", ["commit", "-q", "-m", msg, "--", rel, "src/tesu/zhusha/slots.json"], { cwd: REPO, stdio: "inherit" });
out(`committed ${git("rev-parse", "--short", "HEAD")} on ${branch} (not pushed: the coordinator merges)`);
