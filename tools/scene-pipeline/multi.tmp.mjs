// node multi.tmp.mjs <outdir> "<query>" "t1,t2,..." [cam] [k] [port]
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
const [dir, query = "", ts = "10", cam = "0.5", k = "2", port = "19741"] = process.argv.slice(2);
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && logs.push(m.text()));
page.on("pageerror", (e) => logs.push(e.message));
await page.goto(`http://127.0.0.1:${port}/scenes/?manual&${query}`);
await page.waitForFunction(() => window.__scenes?.engine?.sceneId || !document.getElementById("fail").hidden, null, { timeout: 60000 });
const fail = await page.$eval("#fail", (el) => (el.hidden ? "" : el.textContent));
if (fail) { console.log("FAIL", fail, logs.join("\n")); process.exit(1); }
let prev = 0;
for (const t of ts.split(",").map(Number)) {
  const url = await page.evaluate(([t, c, prev]) => {
    window.__scenes.setCam(Number(c));
    window.__scenes.step(Math.round((t - prev) * 30), 1 / 30);
    return window.__scenes.png();
  }, [t, cam, prev]);
  prev = t;
  const out = `${dir}/t${String(t).replace(".", "_")}.png`;
  writeFileSync(out, Buffer.from(url.split(",")[1], "base64"));
  spawnSync("D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe", ["-y", "-loglevel", "error", "-i", out, "-vf", `scale=iw*${k}:ih*${k}:flags=neighbor`, out.replace(/\.png$/, `-x${k}.png`)]);
}
if (logs.length) console.log(logs.join("\n"));
await browser.close();
