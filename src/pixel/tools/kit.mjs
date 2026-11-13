// Record every registered recipe (kit and region folders) on its sandbox
// stage through its capture script: a GIF of the whole run, a still after
// each step, and a JSON line of facts per recipe (size against the plan's
// standard, breakage class, cues, lights, collision, idle cost, flash starts,
// console errors). Frames come from the 1280x720 world-pixel target and are
// only ever upscaled nearest.
//
//   bash src/pixel/tools/restart-capture-server.sh          (port 24101, no HMR)
//   node src/pixel/tools/kit.mjs [--port 24101] [--only door,bench] [--out review/world/phase2/P0/kit] [--scale 2] [--fps 15]
//
// Region lanes: add a `demo` (with a `script`) to your recipe and run this
// with --only <your ids> --out review/world/phase2/<lane>/kit.

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(resolve("tools/scene-pipeline/package.json"));
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1];
};
const port = opt("port", process.env.PIXEL_PORT ?? "24101");
const out = resolve(opt("out", "review/world/phase2/P0/kit"));
const only = opt("only", "") ? String(opt("only")).split(",") : null;
const scale = Number(opt("scale", "2"));
const fps = Number(opt("fps", "15"));
const every = Math.max(1, Math.round(60 / fps));
const ffmpeg = "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
let logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));

async function open(query) {
  await page.goto(`http://127.0.0.1:${port}/props/?manual&${query}`);
  await page.waitForFunction(() => window.__pixel && window.__pixel.world, null, { timeout: 60000 });
  await page.evaluate(() => document.getElementById("panel").classList.add("hidden"));
}

const png = (crop) => page.evaluate((c) => window.__pixel.png(c), crop);
const step = (n) => page.evaluate((k) => window.__pixel.step(k), n);

function encodeGif(dir, name) {
  const vf = `scale=iw*${scale}:ih*${scale}:flags=neighbor,split[a][b];[a]palettegen=max_colors=255:stats_mode=full[p];[b][p]paletteuse=dither=none`;
  spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(Math.round(60 / every)), "-i", join(dir, "f%04d.png"), "-vf", vf, "-loop", "0", join(out, `${name}.gif`)]);
}

function saveStill(data, file) {
  writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
  if (scale > 1) {
    const up = file.replace(/\.png$/, `@${scale}x.png`);
    spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-i", file, "-vf", `scale=iw*${scale}:ih*${scale}:flags=neighbor`, up]);
  }
}

// the registry, as the page sees it
await open("kit");
const registry = await page.evaluate(() => window.__pixel.registry());
const registryErrors = await page.evaluate(() => window.__pixel.registryErrors);
const ids = registry.map((r) => r.id).filter((id) => id !== "gauge" && id !== "wall" && (!only || only.includes(id)));
const summary = [];

for (const id of ids) {
  logs = [];
  await open(`prop=${encodeURIComponent(id)}`);
  const info = await page.evaluate((i) => window.__pixel.recipeInfo(i), id);
  await page.evaluate(() => window.__pixel.watchFlashes());
  // let ropes, cloth and chunks settle and sleep before measuring what an undisturbed prop costs
  await step(300);
  const crop = await page.evaluate(() => window.__pixel.stageRect(0.6));
  const dir = join(out, `_${id}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const stillDir = join(out, id);
  rmSync(stillDir, { recursive: true, force: true });
  mkdirSync(stillDir, { recursive: true });
  const size = await page.evaluate((i) => window.__pixel.measure(i), id);
  const idle = await page.evaluate(() => window.__pixel.idleCost(90));
  const script = info.demo?.script ?? [{ label: "idle", wait: 2 }];
  const states = new Set();
  // variants run their own states when a step targets them (`variant: label`)
  const variantLabels = (await page.evaluate(() => window.__pixel.slots()))[0]?.variants ?? [];
  const variantStates = Object.fromEntries(variantLabels.map((l) => [l, new Set()]));
  const seeVariants = async () => {
    const got = await page.evaluate(([i, ls]) => ls.map((l) => window.__pixel.prop(`${i}: ${l}`)?.state), [id, variantLabels]);
    got.forEach((st, k) => st && variantStates[variantLabels[k]].add(st));
  };
  await seeVariants();
  let f = 0;
  saveStill(await png(crop), join(stillDir, "00-start.png"));
  for (let k = 0; k < script.length; k++) {
    const s = script[k];
    await page.evaluate(([i, st]) => window.__pixel.apply(i, st), [id, s]);
    const frames = Math.max(1, Math.round((s.wait * 60) / every));
    for (let q = 0; q < frames; q++) {
      writeFileSync(join(dir, `f${String(f++).padStart(4, "0")}.png`), Buffer.from((await png(crop)).split(",")[1], "base64"));
      await step(every);
      states.add(await page.evaluate((i) => window.__pixel.prop(i)?.state, id));
      if (variantLabels.length) await seeVariants();
    }
    const label = (s.label ?? `step ${k + 1}`).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40);
    saveStill(await png(crop), join(stillDir, `${String(k + 1).padStart(2, "0")}-${label}.png`));
  }
  encodeGif(dir, id);
  rmSync(dir, { recursive: true, force: true });
  const flashes = await page.evaluate(() => {
    const s = window.__flashLog?.starts ?? [];
    let max = 0;
    for (const t of s) max = Math.max(max, s.filter((u) => u >= t && u - t < 1).length);
    return { starts: s.length, maxInAnySecond: max };
  });
  const H = 80;
  const std = info.standard;
  const sizeCheck = std ? {
    standard: std,
    measured: { w: size.w, h: size.h },
    wOk: std.w === undefined || Math.abs(size.w - Math.round(std.w * H)) <= 1,
    hOk: std.h === undefined || Math.abs(size.h - Math.round(std.h * H)) <= 1,
  } : null;
  const row = {
    id, region: info.region, file: info.file, breakage: info.breakage, states: info.states, statesSeen: [...states], variantStates: Object.fromEntries(Object.entries(variantStates).map(([l, v]) => [l, [...v]])),
    statesCovered: info.states.filter((st) => states.has(st) || Object.values(variantStates).some((v) => v.has(st))), use: info.use, persist: info.persist, actions: info.actions,
    cues: info.cues, size, sizeCheck, idle, flashes, gif: `${id}.gif`, errors: logs,
  };
  summary.push(row);
  const missing = info.states.filter((st) => !row.statesCovered.includes(st));
  console.log(`${id}: ${[...states].join(" > ")}${missing.length ? ` | NOT RECORDED: ${missing.join(", ")}` : ""} | idle sim ${idle.simMs.toFixed(3)} ms, uploads ${idle.uploadsPerFrame.toFixed(2)}/f (${idle.uploadKBPerFrame.toFixed(1)} KB) | flashes max ${flashes.maxInAnySecond}/s${sizeCheck ? ` | size ${size.w}x${size.h} ${sizeCheck.wOk && sizeCheck.hOk ? "ok" : "OFF"}` : ""}${logs.length ? ` | ${logs.length} console problems` : ""}`);
}

writeFileSync(join(out, "summary.json"), JSON.stringify({ registryErrors, recipes: summary }, null, 2));
await browser.close();
