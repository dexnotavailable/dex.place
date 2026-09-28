// Synchronous frame cost (render + 1-pixel readback, so GPU work must finish):
//   node tools/scene-pipeline/gpucost.mjs <scene> [angle: d3d11|swiftshader]
import { chromium } from "playwright-core";
const [scene = "ring-lake", angle = "d3d11"] = process.argv.slice(2);
const args = [`--use-angle=${angle}`, "--ignore-gpu-blocklist"];
if (angle === "swiftshader") args.push("--enable-unsafe-swiftshader");
const browser = await chromium.launch({ channel: "msedge", headless: true, args });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const out = {};
for (const mode of ["near", "far"]) {
  await page.goto(`http://127.0.0.1:${process.env.SCENES_PORT ?? "19517"}/scenes/?manual&scene=${scene}${mode === "far" ? "&far" : ""}`);
  await page.waitForFunction(() => window.__scenes?.engine?.sceneId);
  out[mode] = await page.evaluate(() => {
    const e = window.__scenes.engine;
    const gl = e.gl;
    const px = new Uint8Array(4);
    const frame = () => {
      e.update(1 / 60);
      e.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    };
    for (let i = 0; i < 20; i++) frame();
    const n = 120;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) frame();
    return +((performance.now() - t0) / n).toFixed(2);
  });
}
console.log(JSON.stringify({ scene, angle, msPerFrame: out }));
await browser.close();
