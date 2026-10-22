// The see-through scan (cutoffs 10-21, round 4; src/tesu/seethrough.test.mjs runs it in the gate). An edit that thins a
// drawing (a cut end healed, a frayed edge) must not punch holes into it: round 1 left a 50% screen-door through the
// ult finisher's ghost sword, ate her blade's tip and opened hairline gaps inside the ult Q's field, and an edge-only
// audit missed all of it. This looks INSIDE the shapes, per drawing, at its alpha (opaque = alpha > 0):
//   chk  checker cells: a pixel whose 4 neighbours all differ from it and whose 4 diagonals all match it (a 50% dither);
//   pin  pinpricks: a clear pixel with all 4 neighbours opaque;
//   gap  every clear pixel a 3 x 3 closing of the shape covers: pinpricks, 1-2 px slits, notches and hairline gaps.
// Each of her drawings (public/assets/zhusha/<slot>/, and the carried trails fx/<move>_trail/) has a baseline in
// src/tesu/zhusha/seethrough.json; a drawing may not get more see-through than that. One with no baseline (a new move)
// may carry no screen-door. Re-made a drawing on purpose? Look at it first, then:
//   node tools/zhusha/seethrough.mjs --write      (rewrites the baseline from the drawings as they are)
//   node tools/zhusha/seethrough.mjs              (lists what the gate would refuse)
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readPng } from "./slotin-lib.mjs";

export const ROOT = join(import.meta.dirname, "../..");
export const ASSETS = join(ROOT, "public/assets");
export const BASELINE = join(ROOT, "src/tesu/zhusha/seethrough.json");
/** Slack over the baseline: checker cells and pinpricks a couple, gap a few px or 4 %. */
export const SLACK = { chk: 2, pin: 2, gap: (base) => Math.max(6, Math.round(base * 0.04)) };
/** A drawing with no baseline may carry at most this many checker cells (her live drawings: 7 at most). */
export const NEW_CHK = 8;

/** [chk, pin, gap] of an alpha mask (Uint8Array, 1 = opaque), w x h. */
export function scanMask(m, w, h) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0);
  let chk = 0, pin = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = m[y * w + x], n = at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1);
      if (!c && n === 4) pin++;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1 && n === (c ? 0 : 4)) {
        const d = at(x - 1, y - 1) + at(x + 1, y - 1) + at(x - 1, y + 1) + at(x + 1, y + 1);
        if (d === (c ? 4 : 0)) chk++;
      }
    }
  }
  // 3 x 3 closing on the frame padded by 2 clear px: dilate, then erode (separably, rows then columns)
  const W = w + 4, H = h + 4, p = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p[(y + 2) * W + x + 2] = m[y * w + x];
  const pass = (src, horiz, dil) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = dil ? 0 : 1;
        for (let k = -1; k <= 1; k++) {
          const xx = horiz ? x + k : x, yy = horiz ? y : y + k;
          const s = xx >= 0 && yy >= 0 && xx < W && yy < H ? src[yy * W + xx] : 0;
          v = dil ? v | s : v & s;
        }
        out[y * W + x] = v;
      }
    }
    return out;
  };
  const closed = pass(pass(pass(pass(p, true, true), false, true), true, false), false, false);
  let gap = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!m[y * w + x] && closed[(y + 2) * W + x + 2]) gap++;
  return [chk, pin, gap];
}

/** [chk, pin, gap] of a PNG's bytes. */
export function scanPng(buf) {
  const { w, h, rgba } = readPng(buf);
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = rgba[i * 4 + 3] > 0 ? 1 : 0;
  return scanMask(m, w, h);
}

/** Her drawings, as "zhusha/<slot>/<file>" / "fx/<move>_trail/<file>". */
export function drawings(assets = ASSETS) {
  const out = [];
  const add = (group, keep) => {
    const dir = join(assets, group);
    if (!existsSync(dir)) return;
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory() || !keep(d.name)) continue;
      for (const f of readdirSync(join(dir, d.name)).sort()) if (f.endsWith(".png")) out.push(`${group}/${d.name}/${f}`);
    }
  };
  add("zhusha", () => true);
  add("fx", (n) => n.endsWith("_trail"));
  return out.sort();
}

/** The baseline as a map "zhusha/<slot>/<file>" -> [chk, pin, gap]. */
export function loadBaseline(path = BASELINE) {
  const j = JSON.parse(readFileSync(path, "utf8"));
  const out = new Map();
  for (const [folder, frames] of Object.entries(j.drawings)) for (const [f, v] of Object.entries(frames)) out.set(`${folder}/${f}.png`, v);
  return out;
}

/** What is wrong with one drawing's scan against its baseline (empty: fine). */
export function judge(rel, [chk, pin, gap], base) {
  if (!base) return chk > NEW_CHK ? [`${rel}: ${chk} checker cells (a 50% screen-door; a new drawing may have ${NEW_CHK})`] : [];
  const bad = [];
  if (chk > base[0] + SLACK.chk) bad.push(`${rel}: ${chk} checker cells (baseline ${base[0]}): a 50% screen-door`);
  if (pin > base[1] + SLACK.pin) bad.push(`${rel}: ${pin} pinpricks (baseline ${base[1]}): see-through holes inside the shape`);
  if (gap > base[2] + SLACK.gap(base[2])) bad.push(`${rel}: ${gap} px of slits / notches / holes (baseline ${base[2]})`);
  return bad;
}

function main() {
  const write = process.argv.includes("--write");
  const scans = drawings().map((rel) => [rel, scanPng(readFileSync(join(ASSETS, rel)))]);
  if (write) {
    const by = {};
    for (const [rel, v] of scans) {
      const [g, slot, f] = rel.split("/");
      (by[`${g}/${slot}`] ??= {})[f.replace(/\.png$/, "")] = v;
    }
    const lines = Object.keys(by).sort().map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(by[k])}`);
    const about = "tools/zhusha/seethrough.mjs: [checker cells, pinpricks, closing gap px] per drawing; the gate (src/tesu/seethrough.test.mjs) refuses a drawing that gets more see-through than this";
    writeFileSync(BASELINE, `{\n  "about": ${JSON.stringify(about)},\n  "drawings": {\n${lines.join(",\n")}\n  }\n}\n`);
    console.log(`baseline: ${scans.length} drawings -> ${BASELINE}`);
    return;
  }
  const base = existsSync(BASELINE) ? loadBaseline() : new Map();
  const bad = scans.flatMap(([rel, v]) => judge(rel, v, base.get(rel)));
  console.log(bad.length ? bad.join("\n") : `${scans.length} drawings: none more see-through than the baseline`);
  process.exitCode = bad.length ? 1 : 0;
}

if (process.argv[1] && import.meta.filename === process.argv[1]) main();
