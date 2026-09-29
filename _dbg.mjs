import { createRequire } from "node:module";
const require = createRequire("D:/Dex/Projects/dex.place/tools/scene-pipeline/package.json");
const { chromium } = require("playwright-core");
const b = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11"] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
page.on("console", (m) => { if (m.type() === "error") console.log("ERR", m.text()); });
await page.goto("http://127.0.0.1:25001/world/?manual&fresh&mute&room=D3&spawn=west", { timeout: 180000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 180000 });
for (let k = 0; k < 900 && await page.evaluate(() => window.__world.game.loading); k++) { await page.waitForTimeout(100); await page.evaluate(() => window.__world.advance(1)); }
await page.evaluate(() => window.__world.begin());
for (let k = 0; k < 300 && !(await page.evaluate(() => { const g = window.__world.game; return !g.trans && g.room.backdrop.ready(); })); k++) { await page.waitForTimeout(80); await page.evaluate(() => window.__world.advance(1)); }
const r = await page.evaluate(() => {
  const w = window.__world, g = w.game, o = g.room.def.origin[0];
  const out = [];
  for (const x of [254.9, 255.3, 255.6]) {
    w.place((x - o) * 80); w.advance(30);
    out.push({ x, near: w.state().near, px: (g.player.body.x / 80 + o).toFixed(2), mode: g.mode });
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
