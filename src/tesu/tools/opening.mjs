// Plays the opening on a fresh visit in a headless browser and saves a frame every
// `--every` seconds while she walks right (or dashes with --dash), with the beat log.
//   node src/tesu/tools/opening.mjs --out <dir> [--url http://127.0.0.1:24100/tesu/] [--every 1] [--dash] [--w 1920 --h 1080]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const base = arg("url", "http://127.0.0.1:24100/tesu/");
const out = arg("out", "opening");
const every = Number(arg("every", "1"));
const dash = process.argv.includes("--dash");
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: +arg("w", "1920"), height: +arg("h", "1080") }, reducedMotion: process.argv.includes("--reduced") ? "reduce" : "no-preference" });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(`${base}?manual&fresh`, { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForFunction(() => !!window.__tesu, null, { timeout: 120000 });
const T = (js, ...a) => p.evaluate(js, ...a);
const log = [];
let t = 0;
let last = "";
const shot = async (tag) => p.screenshot({ path: `${out}/${String(Math.round(t * 10)).padStart(4, "0")}-${tag}.png` });
await shot("start");
await T(() => window.__tesu.press("right"));
for (let i = 0; t < 40; i++) {
  if (dash && i % 20 === 0) {
    await T(() => window.__tesu.press("m2"));
  }
  const s = await T((n) => window.__tesu.advance(n), Math.round(every * 60));
  if (dash) await T(() => window.__tesu.release("m2"));
  t += every;
  if (s.opening !== last) {
    log.push({ t: +t.toFixed(1), state: s.opening, xH: s.xH, zoom: s.zoom });
    last = s.opening;
  }
  await shot(`${s.opening}-z${s.zoom.toFixed(3)}`);
  if (s.xH > 146 && s.opening === "done") break;
}
console.log(JSON.stringify({ log, errors }, null, 2));
await b.close();
