// Quick world screenshot: node src/world/tools/shot.mjs <out.png> "<query>" [w h dpr waitMs port]
// Uses playwright-core from tools/scene-pipeline (installed there) driving Edge.
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const [out, query = "go", w = "1920", h = "1080", dpr = "1", wait = "3000", port = process.env.WORLD_PORT ?? "24001"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/world/?${query}`, { waitUntil: "load" });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
const state = await page.evaluate(() => (window.__world ? window.__world.state() : null));
console.log(JSON.stringify({ state, logs }, null, 1).slice(0, 4000));
await browser.close();
