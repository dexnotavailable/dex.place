// Per-layer cost (solo each layer, synchronous): node tools/scene-pipeline/layercost.mjs <scene> [angle] [far]
import { chromium } from "playwright-core";
const [scene = "ring-lake", angle = "swiftshader", far = ""] = process.argv.slice(2);
const args = [`--use-angle=${angle}`, "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ channel: "msedge", headless: true, args });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://127.0.0.1:${process.env.SCENES_PORT ?? "19517"}/scenes/?manual&scene=${scene}${far ? "&far" : ""}`);
await page.waitForFunction(() => window.__scenes?.engine?.sceneId);
const r = await page.evaluate(() => {
  const e = window.__scenes.engine;
  const gl = e.gl;
  const px = new Uint8Array(4);
  const time = (n) => {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      e.update(1 / 60);
      e.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    return (performance.now() - t0) / n;
  };
  e.solo = new Set(["__none__"]);
  time(3);
  const base = time(8);
  const out = { base: +base.toFixed(1) };
  for (const l of e.layers) {
    e.solo = new Set([l.def.name]);
    time(2);
    out[l.def.name] = +(time(6) - base).toFixed(1);
  }
  e.solo = new Set();
  out.all = +time(6).toFixed(1);
  return out;
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
