#!/usr/bin/env node
// Slot a finished world effect into the game (lane C 10-19; lanes/engine/EFFECTS-CONTRACT.md). One command per effect:
//
//   node tools/fx/slot-in.mjs <id> [--from <dir>] [--palette <file.json>]... [--dry] [--no-verify]
//
//   <dir>        default: ../lanes/fx/v2/built/<id>/ beside this worktree (else ../lanes/fx/built/<id>/): fx.json + fNNN.png
//   --palette    palette files whose "colors" ([[r, g, b], ...]) the drawings may use; default: her 256
//                (../lanes/anim/kit/palette-256.json) plus every *.json with "colors" under ../lanes/fx/v2/palette/
//   --dry        check only, change nothing
//   --no-verify  skip check / test / build (never before a commit that goes to the coordinator)
//
// Checks the effect against the contract (fx/contract.ts: fx.json's rules, drawings at most 4096 x 4096, alpha 0 or 255,
// colours on the palette, the stored-px and PNG budgets after the loader's cells, nothing from the H3 tree), copies it
// into public/assets/fx/<id>/ (an older copy moved aside, never deleted), runs check / test / build and commits that
// folder on the current branch. It never pushes or merges (the coordinator does) and refuses to commit on main.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { readPng, underH3 } from "../zhusha/slotin-lib.mjs";
import { checkFxDrawing, fxCells, FX_MAX_BYTES, FX_MAX_STORED, validateFx } from "../../src/tesu/fx/contract.ts";

const REPO = resolve(import.meta.dirname, "../..");
const LANES = resolve(REPO, "../lanes");
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opts = (n) => argv.flatMap((a, i) => (a === n && argv[i + 1] ? [argv[i + 1]] : []));
const id = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--from" && argv[i - 1] !== "--palette");
const out = (s) => process.stdout.write(`${s}\n`);
const fail = (s, code = 2) => { process.stderr.write(`fx slot-in: ${s}\n`); process.exit(code); };
if (!id) fail("usage: node tools/fx/slot-in.mjs <id> [--from <dir>] [--palette <file.json>]... [--dry] [--no-verify]");

const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8" }).trim();
const rel = `public/assets/fx/${id}`;
const dest = join(REPO, rel);
const from = resolve(opts("--from")[0] ?? [join(LANES, "fx/v2/built", id), join(LANES, "fx/built", id)].find((d) => existsSync(d)) ?? join(LANES, "fx/v2/built", id));
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

// --- the palette: her 256 + the effects' added entries
const paletteFiles = opts("--palette").length ? opts("--palette").map((p) => resolve(p)) : [
  join(LANES, "anim/kit/palette-256.json"),
  ...(existsSync(join(LANES, "fx/v2/palette")) ? readdirSync(join(LANES, "fx/v2/palette")).filter((f) => f.endsWith(".json")).map((f) => join(LANES, "fx/v2/palette", f)) : []),
];
const palette = new Set();
for (const f of paletteFiles) {
  try {
    const j = JSON.parse(readFileSync(f, "utf8"));
    for (const c of j.colors ?? []) if (Array.isArray(c) && c.length >= 3) palette.add((c[0] << 16) | (c[1] << 8) | c[2]);
  } catch { /* not a palette file */ }
}

// --- the checks
const problems = [];
if (!existsSync(from)) fail(`${from} does not exist`);
if (underH3(from)) problems.push(`${from} is inside the H3 tree: only finished pixel art ships`);
let def = null;
try {
  def = validateFx(JSON.parse(readFileSync(join(from, "fx.json"), "utf8")), id);
} catch (e) {
  problems.push(e instanceof Error ? e.message : String(e));
}
let bytes = 0, stored = 0;
const seen = new Set();
const files = ["fx.json"];
for (const fr of def?.frames ?? []) {
  const f = join(from, fr.file);
  if (!existsSync(f)) { problems.push(`${fr.file} is missing`); continue; }
  const buf = readFileSync(f);
  bytes += buf.length;
  if (!files.includes(fr.file)) files.push(fr.file);
  let img;
  try { img = readPng(buf); } catch (e) { problems.push(`${fr.file}: ${e.message}`); continue; }
  if (img.animated) problems.push(`${fr.file}: an animated PNG, not a drawing`);
  problems.push(...checkFxDrawing(img.rgba, img.w, img.h, fr.file));
  if (palette.size) {
    let off = 0;
    for (let i = 0; i < img.w * img.h; i++) {
      if (img.rgba[i * 4 + 3] < 128) continue;
      if (!palette.has((img.rgba[i * 4] << 16) | (img.rgba[i * 4 + 1] << 8) | img.rgba[i * 4 + 2])) off++;
    }
    if (off) problems.push(`${fr.file}: ${off} px off the palette (${paletteFiles.length} palette file(s), ${palette.size} colours)`);
  }
  for (const c of fxCells(img.rgba, img.w, img.h)) if (!seen.has(c.key)) { seen.add(c.key); stored += c.w * c.h; }
}
const extra = existsSync(from) ? readdirSync(from).filter((f) => statSync(join(from, f)).isFile() && !files.includes(f)) : [];
if (extra.length) out(`note: not copied (not part of the effect): ${extra.join(", ")}`);
if (bytes > FX_MAX_BYTES) problems.push(`${bytes} bytes of PNG (budget ${FX_MAX_BYTES})`);
if (stored > FX_MAX_STORED) problems.push(`${stored} stored px after the cells (budget ${FX_MAX_STORED})`);
if (!palette.size) out("note: no palette file found: colours not checked");
if (problems.length) {
  for (const p of problems) process.stderr.write(`  REFUSED ${p}\n`);
  fail(`${id} from ${from}: ${problems.length} problem(s), nothing changed`);
}
out(`${id}: ${def.frames.length} drawings, ${def.frames.reduce((t, f) => t + f.ticks, 0)} ticks, ${stored} stored px, ${bytes} bytes: passes the contract`);
if (flag("--dry")) process.exit(0);

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch === "main" || branch === "master" || branch === "HEAD") fail(`on ${branch}: slot-in commits on a lane branch; the coordinator merges to main`);
const asideRoot = join(LANES, "fx/_moved-aside");
const aside = (dir, why) => {
  mkdirSync(asideRoot, { recursive: true });
  const to = join(asideRoot, `${id}-${why}-${stamp}`);
  try { renameSync(dir, to); } catch { cpSync(dir, to, { recursive: true }); rmSync(dir, { recursive: true }); }
  return to;
};
const before = existsSync(dest) ? aside(dest, "previous") : null;
mkdirSync(dest, { recursive: true });
for (const f of files) cpSync(join(from, f), join(dest, f));
out(`copied ${files.length} files into ${rel}${before ? ` (the previous copy moved aside to ${before})` : ""}`);
if (!flag("--no-verify")) {
  for (const s of ["check", "test", "build"]) {
    out(`npm run ${s} ...`);
    const r = spawnSync(`npm run ${s}`, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", shell: true });
    if (r.status !== 0) {
      process.stderr.write(`${(r.stdout ?? "").slice(-3000)}\n${(r.stderr ?? "").slice(-3000)}\n`);
      aside(dest, "refused");
      if (before) renameSync(before, dest);
      fail(`npm run ${s} failed: the copy is undone (moved aside)`, 1);
    }
  }
}
git("add", "-A", "--", rel);
const msg = `Effects: ${id} slotted in (${def.frames.length} drawings at her art px)\n\n` +
  `By tools/fx/slot-in.mjs from ${from.replace(/\\/g, "/")}: contract, palette, budgets, check, test and build passed.\n\n` +
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
execFileSync("git", ["commit", "-q", "-m", msg, "--", rel], { cwd: REPO, stdio: "inherit" });
out(`committed ${git("rev-parse", "--short", "HEAD")} on ${branch} (not pushed: the coordinator merges)`);
