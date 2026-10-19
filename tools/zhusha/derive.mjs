#!/usr/bin/env node
// Derives her attacks' hit boxes, active drawings and planted-foot movement from the slotted drawings
// (src/tesu/zhusha/derive.ts) and writes src/tesu/zhusha/derived.json, which the controller reads. Run it whenever a
// move is slotted or re-slotted (slot-in.mjs runs it); the tests fail while derived.json disagrees with the drawings.
//
//   node tools/zhusha/derive.mjs [--check] [--print]
//
//   --check  write nothing; exit 1 when derived.json is stale
//   --print  a per-drawing table of what was derived
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { derivedFor, derivedText } from "./derive-lib.mjs";

const REPO = resolve(import.meta.dirname, "../..");
const OUT = join(REPO, "src", "tesu", "zhusha", "derived.json");
const argv = process.argv.slice(2);
const fresh = derivedFor(REPO);
const text = derivedText(fresh);

if (argv.includes("--print")) {
  for (const s of Object.values(fresh.slots)) {
    process.stdout.write(`== ${s.slot} (${s.hash}) hits ${s.hits.map((r) => `f${r.first}-f${r.last} @${r.at}+${r.len}`).join(", ") || "none"}\n`);
    s.frames.forEach((f, i) => process.stdout.write(`  f${String(i).padStart(3, "0")} t${s.ticks[i]} area ${f.area} sweep ${f.sweep}${f.active ? " ACTIVE" : ""} root ${f.root} feet ${JSON.stringify(f.feet)} rects ${f.rects.length}\n`));
  }
}
if (argv.includes("--check")) {
  const old = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (old !== text) {
    process.stderr.write("derive: src/tesu/zhusha/derived.json is stale: run node tools/zhusha/derive.mjs\n");
    process.exit(1);
  }
  process.stdout.write("derive: derived.json matches the drawings\n");
} else {
  writeFileSync(OUT, text);
  process.stdout.write(`derive: wrote ${Object.keys(fresh.slots).length} slots -> src/tesu/zhusha/derived.json\n`);
}
