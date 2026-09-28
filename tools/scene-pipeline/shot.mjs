// Quick single still for tuning: node tools/scene-pipeline/shot.mjs <out.png> "<query>" [t] [cam] [upscale]
//   e.g. shot.mjs review/scenes/tune.png "scene=ring-lake&solo=sky,ring" 10 0.5 2
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const [out, query = "", t = "10", cam = "0.5", k = "2", port = "19517"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(m.text()));
page.on("pageerror", (e) => logs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/scenes/?manual&${query}`);
await page.waitForFunction(() => window.__scenes?.engine?.sceneId || !document.getElementById("fail").hidden, null, { timeout: 30000 });
const fail = await page.$eval("#fail", (el) => (el.hidden ? "" : el.textContent));
if (fail) {
  console.log("FAIL", fail, logs.join("\n"));
  process.exit(1);
}
const url = await page.evaluate(([t, c]) => {
  window.__scenes.setCam(Number(c));
  window.__scenes.step(Math.round(Number(t) * 30), 1 / 30);
  return window.__scenes.png();
}, [t, cam]);
writeFileSync(out, Buffer.from(url.split(",")[1], "base64"));
spawnSync("D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe", ["-y", "-loglevel", "error", "-i", out, "-vf", `scale=iw*${k}:ih*${k}:flags=neighbor`, out.replace(/\.png$/, `-x${k}.png`)]);
if (logs.length) console.log(logs.join("\n"));
await browser.close();
