#!/usr/bin/env node
// Slot a finished Zhusha move into the game (Dex 10-16: "set up whatever system to have the workers slot in stuff
// as they go"). One command per move:
//
//   node tools/zhusha/slot-in.mjs <slot> [--from <dir>] [--dry] [--local] [--remove] [--no-verify]
//
//   <dir>        default: ../lanes/anim/moves/<slot>/final/ beside this worktree (frames + anim.json)
//   --dry        check only, change nothing
//   --local      copy into the game for a look on the dev server only: no tests, no commit, slots.json untouched; its
//                anim.json is stamped "local", which the contract refuses everywhere but the dev server's loader (the
//                tests, the build and a production load all refuse it); undo with --remove
//   --remove     take a --local slot back out (moved aside, never deleted)
//   --no-verify  skip check / test / build (never use before a commit that goes to the coordinator)
//
// It checks the move against the contract (slotin-lib.mjs: stage "pixel", 128 px, a measured 128 px figure in every
// drawing, nothing that looks like an H3 render), copies the drawings + anim.json into public/assets/zhusha/<slot>/
// (an older drop is moved aside, the folder replaced whole), adds a role to slots.json if no role plays the slot yet,
// re-derives the attacks' hit boxes and movement from the drawings (tools/zhusha/derive.mjs -> derived.json), runs
// `npm run check`, `npm test` and `npm run build`, and commits those paths on the current branch. It never pushes
// and never merges (the coordinator does), and it refuses to commit on main.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { derivedFor, derivedText } from "./derive-lib.mjs";
import { addRoleText, checkMove, ensureRole } from "./slotin-lib.mjs";

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
const derivedPath = join(REPO, "src", "tesu", "zhusha", "derived.json");
const asideRoot = existsSync(resolve(REPO, "../lanes/zhusha")) ? resolve(REPO, "../lanes/zhusha/_moved-aside") : join(tmpdir(), "zhusha-moved-aside");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

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

if (flag("--remove")) {
  if (!existsSync(dest)) fail(`${rel} is not there`);
  if (git("ls-files", rel)) fail(`${rel} is committed; take it out with git (revert the slot-in commit), not --remove`);
  let stamped = false;
  try { stamped = !!JSON.parse(readFileSync(join(dest, "anim.json"), "utf8")).local; } catch { /* no anim.json */ }
  if (!stamped) fail(`${rel} is not a --local drop`);
  const to = aside(dest, "local");
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
if (added && !local) writeFileSync(slotsPath, addRoleText(slotsText, added, slots.roles[added]));
out(`copied ${res.files.length} files into ${rel}${before ? ` (the previous drop moved aside to ${before})` : ""}${added && !local ? `; slots.json: new role "${added}"` : ""}`);

if (local) {
  const aj = join(dest, "anim.json");
  writeFileSync(aj, `${JSON.stringify({ ...JSON.parse(readFileSync(aj, "utf8")), local: "LOCAL ONLY: a look on the dev server; never commit (slot-in --remove)" }, null, 1)}\n`);
  if (added) out(`note: no role plays ${slot} yet (slots.json untouched for a local look)`);
  out(`LOCAL ONLY: ${rel} is stamped "local" (only the dev server shows it; tests, build and production refuse it). Then: node tools/zhusha/slot-in.mjs ${slot} --remove`);
  process.exit(0);
}

// the attacks' hit boxes, live drawings and planted-foot movement, read off the drawings as they now are
const derivedOld = existsSync(derivedPath) ? readFileSync(derivedPath, "utf8") : null;
writeFileSync(derivedPath, derivedText(derivedFor(REPO)));
out("derived.json re-derived from the drawings");

const undo = (why) => {
  aside(dest, "refused");
  if (before) renameSync(before, dest);
  if (added) writeFileSync(slotsPath, slotsText);
  if (derivedOld !== null) writeFileSync(derivedPath, derivedOld);
  fail(`${why}: the copy is undone (the refused drop moved aside)`, 1);
};
if (!flag("--no-verify")) {
  for (const s of ["check", "test", "build"]) {
    out(`npm run ${s} ...`);
    const r = spawnSync(`npm run ${s}`, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", shell: true });
    if (r.status !== 0) {
      process.stderr.write(`${(r.stdout ?? "").slice(-3000)}\n${(r.stderr ?? "").slice(-3000)}\n`);
      undo(`npm run ${s} failed`);
    }
  }
}
git("add", "-A", "--", rel, "src/tesu/zhusha/slots.json", "src/tesu/zhusha/derived.json");
const msg = `Zhusha: ${slot} slotted in (${res.def.frames.length} drawings at 128 px${res.def.source ? `, from ${res.def.source}` : ""})\n\n` +
  `By tools/zhusha/slot-in.mjs from ${from.replace(/\\/g, "/")}: contract, check, test and build passed.\n\n` +
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
execFileSync("git", ["commit", "-q", "-m", msg, "--", rel, "src/tesu/zhusha/slots.json", "src/tesu/zhusha/derived.json"], { cwd: REPO, stdio: "inherit" });
out(`committed ${git("rev-parse", "--short", "HEAD")} on ${branch} (not pushed: the coordinator merges)`);
