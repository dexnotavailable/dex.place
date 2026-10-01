// Checks the installed Rosace package against the contract and the clip definitions (no browser, no GPU):
//   node tools/rosace-package/verify_package.mjs [--root public/world]
// - both manifests pass validatePackage and the World's own validateExportPair (same clips, loop/next, counts,
//   durations, holds, phases, non-empty pose keys)
// - every PLAYER_CLIPS clip and sit exists; frame counts/durations/holds/phases equal the clip source's
// - atlas PNG headers match the manifest sizes (albedo and normal), pivots are finite, rects inside the atlas
// - no clip's drawings are all one rect (no placeholder duplication), and no clip but idle/sit shares idle's drawings
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
registerHooks({ load(url, context, next) {
  const u = new URL(url);
  if (u.search === "?raw") return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(readFileSync(u, "utf8"))}` };
  if (u.protocol === "file:" && u.pathname.endsWith(".ts")) {
    return { format: "module", shortCircuit: true, source: stripTypeScriptTypes(readFileSync(u, "utf8"), { mode: "transform", sourceUrl: url }) };
  }
  return next(url, context);
} });
const imp = (p) => import(pathToFileURL(path.join(REPO, p)).href);
const { validatePackage, frameTicks } = await imp("src/lab/contracts.ts");
const { validateExportPair } = await imp("src/world/player/export-validation.ts");
const { PLAYER_CLIPS } = await imp("src/lab/game/player.ts");
const { WORLD_CLIPS } = await imp("src/world/player/standin.ts");

const root = path.resolve(REPO, process.argv.includes("--root") ? process.argv[process.argv.indexOf("--root") + 1] : "public/world");
const DIRS = { 80: "character", 144: "character-closeup" };
const lab = JSON.parse(readFileSync(path.join(REPO, "src/lab/data/player.clips.json"), "utf8"));
const source = [...lab.clips, ...WORLD_CLIPS];
const required = [...PLAYER_CLIPS, ...WORLD_CLIPS.map((c) => c.id)];
const issues = [];
const pkgs = {};
const pngSize = (p) => { const b = readFileSync(p); if (b.toString("latin1", 1, 4) !== "PNG") throw new Error(`${p}: not a PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
for (const [px, dir] of Object.entries(DIRS)) {
  const base = path.join(root, dir);
  const pkg = validatePackage(JSON.parse(readFileSync(path.join(base, "manifest.json"), "utf8")), `${dir}/manifest.json`);
  pkgs[px] = pkg;
  const a = pkg.atlases[0];
  const [w, h] = pngSize(path.join(base, a.albedo));
  const [nw, nh] = pngSize(path.join(base, a.normal));
  if (w !== a.width || h !== a.height) issues.push(`${dir}: albedo ${w}x${h} != manifest ${a.width}x${a.height}`);
  if (nw !== a.width || nh !== a.height) issues.push(`${dir}: normal ${nw}x${nh} != manifest ${a.width}x${a.height}`);
  const byId = new Map(pkg.clips.map((c) => [c.id, c]));
  for (const id of required) if (!byId.has(id)) issues.push(`${dir}: missing clip ${id}`);
  for (const sc of source) {
    const c = byId.get(sc.id);
    if (!c) continue;
    if (c.frames.length !== sc.frames.length) { issues.push(`${dir} ${sc.id}: ${c.frames.length} frames, definition has ${sc.frames.length}`); continue; }
    sc.frames.forEach((f, i) => {
      const g = c.frames[i];
      if (g.duration !== f.duration || (g.hold ?? 0) !== (f.hold ?? 0) || (g.phase ?? null) !== (f.phase ?? null)) issues.push(`${dir} ${sc.id}[${i}]: timing/phase differs from the definition`);
      if (g.pose !== f.pose) issues.push(`${dir} ${sc.id}[${i}]: pose key ${g.pose} != ${f.pose}`);
      const [x, y, rw, rh] = g.rect;
      if (x < 0 || y < 0 || x + rw > a.width || y + rh > a.height) issues.push(`${dir} ${sc.id}[${i}]: rect outside atlas`);
      // airborne drawings legitimately have the foot pivot outside (below) their rect, as the stand-in's do
      if (!g.pivot.every(Number.isFinite)) issues.push(`${dir} ${sc.id}[${i}]: pivot not finite`);
    });
    if (new Set(c.frames.map((f) => f.rect.join(","))).size === 1 && c.frames.length > 1) issues.push(`${dir} ${sc.id}: every drawing is the same rect`);
  }
  const idle = new Set(byId.get("idle").frames.map((f) => f.rect.join(",")));
  for (const c of pkg.clips) if (c.id !== "idle" && c.id !== "sit" && c.frames.every((f) => idle.has(f.rect.join(",")))) issues.push(`${dir} ${c.id}: all drawings alias idle`);
}
validateExportPair(pkgs[80], pkgs[144], required);
const total = (p) => p.clips.reduce((n, c) => n + c.frames.length, 0);
const rep = Object.fromEntries(Object.entries(pkgs).map(([px, p]) => [px, {
  clips: p.clips.length, frames: total(p), atlas: `${p.atlases[0].width}x${p.atlases[0].height}`,
  ticks: Object.fromEntries(p.clips.map((c) => [c.id, c.frames.reduce((n, f) => n + frameTicks(f), 0)])),
}]));
console.log(JSON.stringify(rep));
if (issues.length) { console.error(issues.join("\n")); process.exit(1); }
console.log("package ok: both sizes valid, pair aligned, definitions matched");
