// Movement reach, measured in /world/ at the locked scale (WORLD-PLAN section 1:
// "Measuring them is part of lane W0's acceptance"). On the flat pier of A0:
// run speed, single jump height and distance at a run, jump + double jump,
// ground dash, and jump + double jump + air dash. Real input, 60 Hz ticks.
//   node src/world/tools/reach.mjs [--port 24001]
// Writes review/world/phase2/W0/reach.json.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const i = process.argv.indexOf("--port");
const PORT = i >= 0 ? process.argv[i + 1] : process.env.WORLD_PORT ?? "24001";
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&room=A0&spawn=east`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
for (let k = 0; k < 300 && (await page.evaluate(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__world.advance(1));
}
const out = await page.evaluate(() => {
  const w = window.__world;
  const g = w.game;
  const H = 80;
  const b = g.player.body;
  w.begin();
  const tick = (n = 1) => { for (let k = 0; k < n; k++) g.realTick(); };
  const reset = () => { for (const a of ["left", "right", "jump", "m2"]) w.release(a); w.place(1 * H, undefined); tick(40); };
  /** Run right from the west end for `lead` ticks, then do `act`, and measure until landed. */
  const trial = (act) => {
    reset();
    w.place(0.6 * H);
    tick(10);
    w.press("right");
    tick(50);
    const x0 = b.x, y0 = b.y;
    let top = b.y;
    const seq = act();
    let t = 0;
    let left = false;
    for (; t < 240; t++) {
      const step = seq[t];
      if (step) for (const [k, a] of step) k === "d" ? w.press(a) : w.release(a);
      tick();
      top = Math.min(top, b.y);
      if (!b.grounded) left = true;
      if (left && b.grounded) break;
    }
    w.release("right"); w.release("jump"); w.release("m2");
    return { acrossH: +((b.x - x0) / H).toFixed(2), upH: +((y0 - top) / H).toFixed(2), ticks: t };
  };
  // run speed
  reset(); w.place(0.6 * H); tick(5); w.press("right"); tick(40); const a = b.x; tick(60); const run = +((b.x - a) / H).toFixed(2); w.release("right");
  const single = trial(() => ({ 0: [["d", "jump"]], 20: [["u", "jump"]] }));
  const double = trial(() => ({ 0: [["d", "jump"]], 20: [["u", "jump"]], 22: [["d", "jump"]], 42: [["u", "jump"]] }));
  const dashAir = trial(() => ({ 0: [["d", "jump"]], 20: [["u", "jump"]], 22: [["d", "jump"]], 36: [["u", "jump"], ["d", "m2"]], 40: [["u", "m2"]] }));
  // ground dash from a standstill
  reset(); w.place(1 * H); tick(20); const d0 = b.x; w.press("right"); tick(1); w.press("m2"); tick(3); w.release("m2"); w.release("right"); tick(40);
  const dash = +((b.x - d0) / H).toFixed(2);
  return { runHperSecond: run, single, double, dashAir, groundDashH: dash };
});
mkdirSync("review/world/phase2/W0", { recursive: true });
writeFileSync("review/world/phase2/W0/reach.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
