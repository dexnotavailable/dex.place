// Walks the opening in a headless browser and reports the route clock and the terrain
// grammar checks: no fall off the required route, the hall door reached, the leap drops
// to Shiraito with no damage, the void tugs her back.
//   node src/tesu/tools/route.mjs [--url http://127.0.0.1:24100/tesu/] [--shots dir]
// Needs playwright-core (tools/scene-pipeline: npm ci there once).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const base = arg("url", "http://127.0.0.1:24100/tesu/");
const shots = arg("shots", "");
if (shots) mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await p.goto(`${base}?manual&at=catch`, { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForFunction(() => !!window.__tesu, null, { timeout: 120000 });
const T = (js, ...a) => p.evaluate(js, ...a);
const report = {};
// walk right from the catch until the hall door, counting ticks
await T(() => window.__tesu.advance(30));
await T(() => window.__tesu.press("right"));
let ticks = 0, minGround = 1e9, airborne = 0;
const marks = {};
const at = { gate1: 115, terrace: 124, tunnel: 130.4, door: 145.6 };
for (; ticks < 60 * 60; ticks += 6) {
  const s = await T(() => window.__tesu.advance(6));
  if (!s.grounded) airborne += 6;
  for (const [k, x] of Object.entries(at)) if (marks[k] === undefined && s.xH >= x) marks[k] = +(ticks / 60).toFixed(2);
  if (s.xH >= at.door) break;
  if (shots && ticks % 240 === 0) await p.screenshot({ path: `${shots}/walk-${String(ticks).padStart(5, "0")}.png` });
}
await T(() => window.__tesu.release("right"));
report.walk = { seconds: +(ticks / 60).toFixed(2), marks, airborneTicks: airborne, end: await T(() => window.__tesu.state()) };
// the leap: stand on the plank, down + jump
await T(() => window.__tesu.place(129.2));
await T(() => window.__tesu.advance(20));
await T(() => window.__tesu.press("down"));
await T(() => window.__tesu.press("jump"));
await T(() => window.__tesu.advance(4));
await T(() => { window.__tesu.release("jump"); window.__tesu.release("down"); });
let leap = null;
for (let i = 0; i < 400; i++) {
  const s = await T(() => window.__tesu.advance(3));
  if (s.cloudDrop && !leap) leap = { cloudDrop: true };
  if (s.grounded && i > 5) { leap = { ...(leap ?? {}), landed: s.on, yH: s.yH, xH: s.xH }; break; }
}
report.leap = leap;
if (shots) await p.screenshot({ path: `${shots}/leap-landed.png` });
// the void: walk off the diagonal's lower (west) end
await T(() => window.__tesu.place(102, 120));
await T(() => window.__tesu.advance(10));
await T(() => window.__tesu.press("left"));
let tug = null;
for (let i = 0; i < 300; i++) {
  const s = await T(() => window.__tesu.advance(4));
  if (s.fade > 0.9 && !tug) {
    tug = { faded: true, at: [s.xH, s.yH] };
    await T(() => window.__tesu.release("left"));
  }
  if (tug && s.fade < 0.05 && s.grounded) { tug.back = [s.xH, s.yH, s.on]; break; }
}
await T(() => window.__tesu.release("left"));
report.void = tug;
report.errors = errors;
console.log(JSON.stringify(report, null, 2));
await b.close();
