// Quick look at the /props/ sandbox: one world-pixel frame (nearest upscale only).
//   node src/pixel/tools/shot.mjs "<query>" <out.png> [--steps 90] [--scale 2] [--crop x,y,w,h] [--eval "js"]
// e.g. node src/pixel/tools/shot.mjs "prop=door" review/world/phase2/P0/door.png --scale 2
// Port: --port or PIXEL_PORT (default 24100). Needs Edge (playwright-core from tools/scene-pipeline).

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const require = createRequire(resolve("tools/scene-pipeline/package.json"));
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1];
};
const [query = "", out = "review/world/phase2/P0/shot.png"] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const port = opt("port", process.env.PIXEL_PORT ?? "24100");
const steps = Number(opt("steps", "90"));
const scale = Number(opt("scale", "1"));
const crop = opt("crop", "") ? opt("crop").split(",").map(Number) : null;
const code = opt("eval", "");
const ffmpeg = "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/props/?manual&${query}`);
await page.waitForFunction(() => window.__pixel && window.__pixel.world, null, { timeout: 60000 });
await page.evaluate(() => document.getElementById("panel").classList.add("hidden"));
if (code) await page.evaluate(code);
await page.evaluate((n) => window.__pixel.step(n), steps);
const data = await page.evaluate((c) => window.__pixel.png(c ?? undefined), crop);
mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, Buffer.from(data.split(",")[1], "base64"));
if (scale > 1) {
  const tmp = out.replace(/.png$/, ".tmp.png");
  spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-i", out, "-vf", `scale=iw*${scale}:ih*${scale}:flags=neighbor`, tmp]);
  renameSync(tmp, out);
}
console.log(out, logs.length ? `\n${logs.join("\n")}` : "");
await browser.close();
