// Capture /scenes/ for review: stills at several camera positions and a frame
// sequence turned into a GIF and MP4 (frame cost: gpucost.mjs). Frames come straight
// from the low-res target (window.__scenes.png) and are upscaled here with
// nearest-neighbour only, so what you see is the real pixel grid.
//
//   node tools/scene-pipeline/capture.mjs --scene ring-lake --port 19517
//     [--out review/scenes/ring-lake] [--far] [--stills 0,0.5,1] [--t 20]
//     [--frames 150 --dt 0.0667 --cam 0.5 --pan] [--headed] [--tag v1] [--query reduced] [--gifscale 1]
//
// Needs the dev server running (npm run dev -- --port <port>) and Microsoft Edge.

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const scene = opt("scene", "ring-lake");
const port = opt("port", "19517");
const far = opt("far", false) === true;
const tag = opt("tag", far ? "far" : "near");
const out = resolve(opt("out", `review/scenes/${scene}`));
const stills = String(opt("stills", "0,0.5,1")).split(",").filter(Boolean).map(Number);
const t0 = Number(opt("t", 12));
const frames = Number(opt("frames", 0));
const dt = Number(opt("dt", 1 / 15));
const camAt = Number(opt("cam", 0.5));
const pan = opt("pan", false) === true;
const headed = opt("headed", false) === true;
const extra = opt("query", "");
const upscale = Number(opt("upscale", far ? 2 : 3));
const ffmpeg = "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: !headed,
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

const base = `http://127.0.0.1:${port}/scenes/?scene=${scene}${far ? "&far" : ""}${extra ? `&${extra}` : ""}`;

const saveData = (file, dataUrl) => writeFileSync(file, Buffer.from(dataUrl.split(",")[1], "base64"));
const up = (src, dst, k = upscale) =>
  spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-i", src, "-vf", `scale=iw*${k}:ih*${k}:flags=neighbor`, dst]);

async function open(query) {
  await page.goto(`${base}${query}`);
  await page.waitForFunction(() => window.__scenes && window.__scenes.engine && window.__scenes.engine.sceneId, null, { timeout: 30000 });
  const fail = await page.$eval("#fail", (el) => (el.hidden ? "" : el.textContent));
  if (fail) throw new Error(fail);
}

const info = {};
await open("&manual");
info.renderer = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
  return gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : "no webgl2";
});
info.layers = await page.evaluate(() => window.__scenes.engine.layerNames());

// stills
for (const c of stills) {
  await page.evaluate(([c, t]) => {
    const s = window.__scenes;
    s.setCam(c);
    s.step(Math.round(t * 30), 1 / 30);
  }, [c, t0]);
  const name = `${tag}-cam${String(c).replace(".", "")}`;
  saveData(join(out, `${name}.png`), await page.evaluate(() => window.__scenes.png()));
  up(join(out, `${name}.png`), join(out, `${name}-x${upscale}.png`));
}
// full window as shown (letterboxed, integer scale)
await page.screenshot({ path: join(out, `${tag}-window.png`) });

// no-figure still for composition
await open("&manual&nochar");
await page.evaluate(([t]) => {
  window.__scenes.setCam(0.5);
  window.__scenes.step(Math.round(t * 30), 1 / 30);
}, [t0]);
saveData(join(out, `${tag}-nofigure.png`), await page.evaluate(() => window.__scenes.png()));
up(join(out, `${tag}-nofigure.png`), join(out, `${tag}-nofigure-x${upscale}.png`));

// frame sequence
if (frames > 0) {
  const dir = join(out, `${tag}-frames`);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  await open("&manual");
  await page.evaluate(([c, t]) => {
    window.__scenes.setCam(c);
    window.__scenes.step(Math.round(t * 30), 1 / 30);
  }, [camAt, t0]);
  for (let i = 0; i < frames; i++) {
    const url = await page.evaluate(
      ([i, n, dt, pan, c]) => {
        const s = window.__scenes;
        if (pan) s.setCam(0.5 - 0.5 * Math.cos((i / n) * 2 * Math.PI));
        else s.setCam(c);
        s.step(Math.max(1, Math.round(dt * 30)), dt / Math.max(1, Math.round(dt * 30)));
        return s.png();
      },
      [i, frames, dt, pan, camAt],
    );
    saveData(join(dir, `f${String(i).padStart(4, "0")}.png`), url);
  }
  const fps = Math.round(1 / dt);
  const scale = Number(opt("gifscale", far || pan ? 1 : 2));
  const run = (a) => {
    const r = spawnSync(ffmpeg, a, { encoding: "utf8" });
    if (r.status !== 0) console.error("ffmpeg failed:", r.error ?? r.stderr);
  };
  run([
    "-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "f%04d.png"),
    "-vf", `scale=iw*${scale}:ih*${scale}:flags=neighbor,split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=none`,
    join(out, `${tag}${pan ? "-pan" : ""}.gif`),
  ]);
  run([
    "-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "f%04d.png"),
    "-vf", `scale=iw*3:ih*3:flags=neighbor`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16",
    join(out, `${tag}${pan ? "-pan" : ""}.mp4`),
  ]);
}

info.logs = logs;
writeFileSync(join(out, `${tag}-info.json`), JSON.stringify(info, null, 2));
console.log(JSON.stringify({ ...info, logs: logs.slice(0, 20) }, null, 2));
await browser.close();
