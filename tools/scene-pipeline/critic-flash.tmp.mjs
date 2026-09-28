import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
for (const red of ["", "&reduced"]) {
await page.goto(`http://127.0.0.1:19782/scenes/?manual&scene=ring-lake${red}`);
await page.waitForFunction(() => window.__scenes?.engine?.sceneId && window.__scenes.engine.layers.length > 0); await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  const e = window.__scenes.engine;
  const info = { sceneId: e.sceneId, reduced: e.reduced, hasGate: !!e.gate };
  const starts = [];
  const orig = e.gate.allow.bind(e.gate);
  let calls = 0;
  e.gate.allow = (now, rd) => { calls++; const ok = orig(now, rd); if (ok) starts.push(+now.toFixed(2)); return ok; };
  for (let i = 0; i < 120 * 60; i++) e.update(1 / 60);
  let maxWin = 0;
  for (const s of starts) maxWin = Math.max(maxWin, starts.filter((t) => t >= s && t < s + 1).length);
  const pts = e.layers.filter((l) => l.def.kind === "points").map((l) => l.def.name + ":" + (l.def.system.constructor?.name));
  return { ...info, calls, n: starts.length, perMin: starts.length / 2, maxWin, first: starts.slice(0, 15), pts };
});
console.log(JSON.stringify(r));
}
await browser.close();
