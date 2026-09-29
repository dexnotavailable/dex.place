// The whole kit at game size, through the real presenter: the /props/?kit
// lineup (every registered recipe in one room beside the H gauge) paged
// across, screenshotted at 1080p (1.5x sharp-bilinear), 1440p (2x nearest)
// and a phone, plus the world-pixel frame at 1x. Also measures the frame
// cost of the lineup room (render + 1 px readback) on the given ANGLE
// backend, and whether any frame came out through plain bilinear.
//
//   bash src/pixel/tools/restart-capture-server.sh
//   node src/pixel/tools/lineup.mjs [--port 24101] [--out review/world/phase2/P0/lineup] [--angle d3d11|swiftshader] [--only 1080,1440,phone]

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(resolve("tools/scene-pipeline/package.json"));
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1];
};
const port = opt("port", process.env.PIXEL_PORT ?? "24101");
const out = resolve(opt("out", "review/world/phase2/P0/lineup"));
const angle = opt("angle", "d3d11");
const only = opt("only", "") ? String(opt("only")).split(",") : null;
mkdirSync(out, { recursive: true });

const VIEWS = [
  { tag: "1080", width: 1920, height: 1080, dpr: 1 },
  { tag: "1440", width: 2560, height: 1440, dpr: 1 },
  { tag: "phone", width: 844, height: 390, dpr: 3, mobile: true },
  { tag: "phone-portrait", width: 390, height: 844, dpr: 3, mobile: true },
];

const launchArgs = [`--use-angle=${angle}`, "--ignore-gpu-blocklist"];
if (angle === "swiftshader") launchArgs.push("--enable-unsafe-swiftshader");
const browser = await chromium.launch({ channel: "msedge", headless: true, args: launchArgs });
const report = { angle, views: [] };

for (const v of VIEWS) {
  if (only && !only.includes(v.tag)) continue;
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, isMobile: !!v.mobile, hasTouch: !!v.mobile });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => { if (m.type() === "error") logs.push(m.text()); });
  page.on("pageerror", (e) => logs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/props/?manual&kit`);
  await page.waitForFunction(() => window.__pixel && window.__pixel.world, null, { timeout: 60000 });
  await page.evaluate(() => document.getElementById("panel").classList.add("hidden"));
  const slots = await page.evaluate(() => window.__pixel.slots());
  const W = await page.evaluate(() => window.__pixel.world.width);
  const H = await page.evaluate(() => window.__pixel.room.H);
  const pages = [];
  // one camera page per 16 H (one screen), the gauge at its centre
  for (let x = 0, k = 0; x < W; x += 16 * H, k++) {
    await page.evaluate((gx) => { window.__pixel.moveFigure(gx, 1); window.__pixel.step(40); }, x + 8 * H);
    const fit = await page.evaluate(() => ({ ...window.__pixel.renderer.fit }));
    const cam = await page.evaluate(() => ({ ...window.__pixel.state.cam }));
    const inView = slots.filter((s) => s.x >= cam.x && s.x <= cam.x + 1280).map((s) => s.id);
    const file = `${v.tag}-${String(k).padStart(2, "0")}.png`;
    await page.screenshot({ path: join(out, file) });
    if (v.tag === "1080") {
      const data = await page.evaluate(() => window.__pixel.png());
      writeFileSync(join(out, `1x-${String(k).padStart(2, "0")}.png`), Buffer.from(data.split(",")[1], "base64"));
    }
    pages.push({ file, cam, fit, inView, gaugeScreenPx: +(H * fit.scale / v.dpr).toFixed(2) });
  }
  const cost = v.tag === "1080" ? await page.evaluate(() => window.__pixel.frameCost(120)) : null;
  report.views.push({ ...v, pages, cost, errors: logs, plainBilinear: pages.some((p) => p.fit.mode !== "integer" && p.fit.mode !== "sharp-bilinear") });
  console.log(`${v.tag}: ${pages.length} pages, ${pages[0].fit.mode} ${pages[0].fit.scale.toFixed(3)}x, gauge ${pages[0].gaugeScreenPx} css px${cost ? `, frame ${cost.msPerFrame} ms (sim ${cost.simMs})` : ""}${logs.length ? `, ${logs.length} errors` : ""}`);
  await ctx.close();
}

writeFileSync(join(out, `report-${angle}.json`), JSON.stringify(report, null, 2));
await browser.close();
