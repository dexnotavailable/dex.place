// Frame cost of the spire rooms at their busiest standpoints (lane R-D): 1280x720, render + a
// 1 px readback so the GPU finishes, on d3d11 and SwiftShader (the record). Needs /world/ on --port.
//   node src/world/rooms/spire/_tools/cost.mjs [--port 24501]   -> review/world/phase2/R-D/cost.json
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const pi = process.argv.indexOf("--port");
const PORT = pi >= 0 ? process.argv[pi + 1] : "24501";
const { chromium } = require("playwright-core");
const out = {};
for (const angle of ["d3d11", "swiftshader"]) {
  const args = [`--use-angle=${angle}`, "--ignore-gpu-blocklist"]; if (angle === "swiftshader") args.push("--enable-unsafe-swiftshader");
  const browser = await chromium.launch({ channel: "msedge", args });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&mute`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__world);
  for (let k = 0; k < 600 && (await page.evaluate(() => window.__world.game.loading)); k++) { await page.waitForTimeout(100); await page.evaluate(() => window.__world.advance(1)); }
  await page.evaluate(() => window.__world.begin());
  for (const [id, sp, x, y] of [["D1", "break", null, null], ["D2", "shrine", 263.5, 58], ["D3", "west", 262, 76], ["D4", "east", 312, 84]]) {
    await page.evaluate(([id, sp]) => window.__world.teleport(id, sp), [id, sp]);
    for (let k = 0; k < 900; k++) { if (await page.evaluate(() => { const g = window.__world.game; return !g.trans && (!g.room.backdrop || g.room.backdrop.ready()); })) break; await page.waitForTimeout(100); await page.evaluate(() => window.__world.advance(1)); }
    if (x !== null) await page.evaluate(([x, y]) => { const w = window.__world; const o = w.game.room.def.origin; w.place((x - o[0]) * 80, (o[1] - y) * 80); }, [x, y]);
    await page.evaluate(() => window.__world.advance(120));
    const ms = await page.evaluate((n) => { const g = window.__world.game; const gl = g.r.gl; const px = new Uint8Array(4); const f = () => { g.realTick(); g.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }; for (let i = 0; i < 5; i++) f(); const t0 = performance.now(); for (let i = 0; i < n; i++) f(); return +((performance.now() - t0) / n).toFixed(2); }, angle === "swiftshader" ? 8 : 120);
    (out[angle] ??= {})[`${id}@${sp}${x !== null ? "/" + x : ""}`] = ms;
  }
  await browser.close();
}
import("node:fs").then((fs) => fs.writeFileSync("review/world/phase2/R-D/cost.json", JSON.stringify(out, null, 1)));
console.log(JSON.stringify(out));
