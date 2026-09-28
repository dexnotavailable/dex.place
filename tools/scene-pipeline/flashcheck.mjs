// Counts flash accents over simulated time and checks the rate limit:
//   node tools/scene-pipeline/flashcheck.mjs <scene> [seconds] [reduced]
import { chromium } from "playwright-core";
const [scene = "ring-lake", secs = "120", reduced = ""] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`http://127.0.0.1:${process.env.SCENES_PORT ?? "19517"}/scenes/?manual&scene=${scene}${reduced ? "&reduced" : ""}`);
await page.waitForFunction(() => window.__scenes?.engine?.sceneId);
const r = await page.evaluate((secs) => {
  const e = window.__scenes.engine;
  const sys = e.layers.filter((l) => l.def.kind === "points" && l.def.system.specs).map((l) => ({ name: l.def.name, s: l.def.system }));
  const starts = [];
  const seen = new Set();
  // every flash, from any emitter (FlashAccents or a scene's own system), passes the global gate
  const gateStarts = [];
  const allow = e.gate.allow.bind(e.gate);
  e.gate.allow = (now, red) => {
    const ok = allow(now, red);
    if (ok) gateStarts.push(now);
    return ok;
  };
  const dt = 1 / 60;
  let maxInWindow = 0;
  let maxGate = 0;
  let onScreen = 0;
  for (let i = 0; i < secs * 60; i++) {
    e.update(dt);
    for (const { name, s } of sys)
      for (const l of s.live) {
        if (seen.has(l)) continue;
        seen.add(l);
        starts.push(e.time);
        const x = l.x - e.camera.offset(34);
        if (x >= 0 && x < e.W && l.y >= 0 && l.y < e.H) onScreen++;
      }
    const t = e.time;
    maxInWindow = Math.max(maxInWindow, starts.filter((s) => t - s < 1).length);
    maxGate = Math.max(maxGate, gateStarts.filter((s) => t - s < 1).length);
  }
  return { gateStarts: gateStarts.length, gatePerMinute: (gateStarts.length / secs) * 60, maxGateStartsInAnySecond: maxGate, flashes: starts.length, perMinute: (starts.length / secs) * 60, maxStartsInAnySecond: maxInWindow, onScreen, reduced: e.reduced };
}, Number(secs));
console.log(JSON.stringify(r));
await browser.close();
