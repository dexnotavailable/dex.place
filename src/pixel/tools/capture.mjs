// Capture the /props/ sandbox for review: stills of every proof prop's states
// and breakage, and GIFs of the motion. Frames come straight from the
// 1280x720 world-pixel target (window.__pixel.png) and are upscaled here with
// nearest-neighbour only, so what you see is the real pixel grid.
//
//   npx vite --config src/pixel/tools/vite.capture.config.mjs --port 22418 --strictPort --host 127.0.0.1
//   node src/pixel/tools/capture.mjs --port 22418 [--only banner,terminal] [--out review/world/props]
//
// Needs Microsoft Edge (playwright-core from tools/scene-pipeline).

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(resolve("tools/scene-pipeline/package.json"));
const { chromium } = require("playwright-core");

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const port = opt("port", "22418");
const out = resolve(opt("out", "review/world/props"));
const only = opt("only", "") ? String(opt("only")).split(",") : null;
const ffmpeg = "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));

async function open(query = "") {
  await page.goto(`http://127.0.0.1:${port}/props/?manual${query}`);
  await page.waitForFunction(() => window.__pixel && window.__pixel.world, null, { timeout: 30000 });
  await page.evaluate(() => { document.getElementById("panel").classList.add("hidden"); });
}

async function save(name, crop, scale = 1) {
  const data = await page.evaluate((c) => window.__pixel.png(c ?? undefined), crop ?? null);
  const buf = Buffer.from(data.split(",")[1], "base64");
  const file = join(out, `${name}.png`);
  writeFileSync(file, buf);
  if (scale > 1) {
    spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-i", file, "-vf", `scale=iw*${scale}:ih*${scale}:flags=neighbor`, file.replace(/\.png$/, `@${scale}x.png`)]);
  }
  return file;
}

const step = (n) => page.evaluate((k) => window.__pixel.step(k), n);
const ev = (fn, arg) => page.evaluate(fn, arg);

/** Record `frames` frames, `every` steps apart, cropped, into a GIF (nearest upscale). */
async function gif(name, frames, every, crop, scale = 2, before) {
  const dir = join(out, `_${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (before) await before();
  for (let i = 0; i < frames; i++) {
    const data = await page.evaluate((c) => window.__pixel.png(c ?? undefined), crop ?? null);
    writeFileSync(join(dir, `f${String(i).padStart(4, "0")}.png`), Buffer.from(data.split(",")[1], "base64"));
    await step(every);
  }
  const fps = Math.round(60 / every);
  const vf = `scale=iw*${scale}:ih*${scale}:flags=neighbor,split[a][b];[a]palettegen=max_colors=255:stats_mode=full[p];[b][p]paletteuse=dither=none`;
  spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "f%04d.png"), "-vf", vf, "-loop", "0", join(out, `${name}.gif`)]);
  rmSync(dir, { recursive: true, force: true });
}

const want = (k) => !only || only.includes(k);
const rect = (name, pad) => page.evaluate(([n, p]) => window.__pixel.frameRect(n, p), [name, pad ?? 16]);

// --------------------------------------------------------------------------
if (want("overview")) {
  await open();
  await step(90);
  await save("00-room-lit");
  await ev(() => { window.__pixel.state.view = "normals"; });
  await step(1);
  await save("01-room-normals");
  await ev(() => { window.__pixel.state.view = "layers"; });
  await step(1);
  await save("02-room-layers");
  await ev(() => { window.__pixel.state.view = "albedo"; });
  await step(1);
  await save("03-room-albedo");
  await ev(() => { window.__pixel.state.view = "lit"; window.__pixel.state.lab = true; });
  await step(1);
  await save("04-room-lab-lighting");
}

/** Crop rect (frame px) for a world rect given in H units relative to (x = 0, floor). */
async function worldCrop(x0, y0, x1, y1) {
  return page.evaluate(([a, b, c, d]) => {
    const P = window.__pixel, H = P.room.H, fy = P.room.floorY, cam = P.state.cam;
    const X0 = Math.max(0, Math.round(a * H - cam.x)), Y0 = Math.max(0, Math.round(fy + b * H - cam.y));
    const X1 = Math.min(1280, Math.round(c * H - cam.x)), Y1 = Math.min(720, Math.round(fy + d * H - cam.y));
    return [X0, Y0, X1 - X0, Y1 - Y0];
  }, [x0, y0, x1, y1]);
}

/** GIF with scripted actions at given frame indices. */
async function timeline(name, frames, every, crop, actions, scale = 2) {
  const dir = join(out, `_${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i++) {
    if (actions[i]) await actions[i]();
    const data = await page.evaluate((c) => window.__pixel.png(c ?? undefined), crop ?? null);
    writeFileSync(join(dir, `f${String(i).padStart(4, "0")}.png`), Buffer.from(data.split(",")[1], "base64"));
    await step(every);
  }
  const fps = Math.max(1, Math.round(60 / every));
  const vf = `scale=iw*${scale}:ih*${scale}:flags=neighbor,split[a][b];[a]palettegen=max_colors=255:stats_mode=full[p];[b][p]paletteuse=dither=none`;
  spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(Math.min(50, fps)), "-i", join(dir, "f%04d.png"), "-vf", vf, "-loop", "0", join(out, `${name}.gif`)]);
  rmSync(dir, { recursive: true, force: true });
}

const fire = (tool, face = 1, at = null) => page.evaluate(([t, f, a]) => { window.__pixel.fire(t, f, a ?? undefined); }, [tool, face, at]);
const move = (xH, face = 1) => page.evaluate(([x, f]) => window.__pixel.moveFigure(x * window.__pixel.room.H, f), [xH, face]);
const use = () => page.evaluate(() => window.__pixel.use()?.id ?? null);
const go = (n, st) => page.evaluate(([a, b]) => window.__pixel.go(a, b), [n, st]);
const propState = (n) => page.evaluate((a) => window.__pixel.prop(a).state, n);
const speed = (v) => page.evaluate((x) => { window.__pixel.state.speed = x; }, v);

// --------------------------------------------------------------------------
if (want("banner")) {
  await open();
  await step(60);
  let fx = null;
  for (let x = 7.6; x <= 9.4; x += 0.025) {
    if (await page.evaluate(([xx]) => window.__pixel.probeCut("map banner", xx * window.__pixel.room.H, 1), [x])) { fx = x; break; }
  }
  console.log("banner: slash from x =", fx);
  await move((fx ?? 8.6) + 0.05, 1);
  await step(2);
  const crop = await worldCrop(8.0, -3.75, 11.4, 0.25);
  await save("10-banner-rolled", crop, 2);
  await timeline("11-banner-cut-unroll", 150, 1, crop, { 4: () => fire("slash", 1) });
  console.log("banner state after cut:", await propState("map banner"));
  await step(240);
  await save("12-banner-unrolled", crop, 2);
  await move(10.1, 1);
  await step(1);
  console.log("banner use ->", await use(), await propState("map banner"));
  const map = await page.evaluate(() => window.__pixel.mapImage(3));
  writeFileSync(join(out, "13-banner-map-read@3x.png"), Buffer.from(map.split(",")[1], "base64"));
  await timeline("14-banner-slash-sway", 90, 1, crop, { 2: () => fire("slash", 1) });
  // persistence: rebuild keeping the save -> it arrives unrolled
  await page.evaluate(() => window.__pixel.setH(80));
  await step(30);
  console.log("banner after rebuild with save:", await propState("map banner"));
  await save("15-banner-cut-persists", await worldCrop(8.0, -3.75, 11.4, 0.25), 2);
}

if (want("terminal")) {
  await open();
  await step(30);
  await move(12.1, 1);
  await step(1);
  const crop = await worldCrop(10.9, -5.6, 15.3, 0.45);
  await save("20-terminal-dormant", crop, 2);
  console.log("terminal use ->", await use(), await propState("boss terminal"));
  await step(40);
  await save("21-terminal-woken", crop, 2);
  await use();
  await step(50);
  await save("22-terminal-summoning", crop, 2);
  await step(120);
  await save("23-terminal-summoned", crop, 2);
  console.log("terminal:", await propState("boss terminal"));
  await go("boss terminal", "cooldown");
  await step(70);
  await save("24-terminal-cooldown", crop, 2);
  await step(520);
  console.log("terminal after cooldown:", await propState("boss terminal"));
  await save("25-terminal-dormant-again", crop, 2);
  await timeline("26-terminal-sequence", 180, 2, crop, { 5: use, 45: use, 150: () => go("boss terminal", "cooldown") });
  await go("boss terminal", "dormant");
  await step(60);
  await timeline("27-terminal-hit", 40, 1, crop, { 2: () => fire("heavy", 1) });
  await save("28-terminal-dented", crop, 2);
}

if (want("donation")) {
  await open();
  await step(30);
  await move(2.0, -1);
  await step(1);
  const crop = await worldCrop(0.55, -1.75, 3.2, 0.3);
  await save("30-donation-idle", crop, 3);
  await timeline("31-donation-use", 60, 1, crop, { 3: use });
  await go("donation box", "used");
  await step(10);
  await save("32-donation-used", crop, 3);
  await move(2.6, 1);
  await step(1);
  console.log("plaque use ->", await use());
  await step(6);
  await save("33-plaque-read-glint", crop, 3);
  await move(2.4, -1);
  await step(200);
  await timeline("34-donation-hit", 40, 1, crop, { 2: () => fire("heavy", -1) });
  await save("35-donation-chipped", crop, 3);
  await step(60 * 12);
  await save("36-donation-mended", crop, 3);
}

if (want("window")) {
  await open();
  await step(30);
  await move(5.55, 1);
  await step(1);
  const crop = await worldCrop(4.6, -5.25, 8.0, 0.35);
  await save("40-window-idle", crop, 2);
  await speed(0.25);
  await timeline("41-window-shatter-slowmo", 100, 1, crop, { 2: () => fire("slash", 1) });
  await speed(1);
  await step(60);
  console.log("window:", await propState("window"));
  await save("42-window-broken", crop, 2);
  await timeline("43-window-restore", 170, 6, crop, {});
  console.log("window after restore:", await propState("window"));
  await save("44-window-restored", crop, 2);
  await move(6.3, 1);
  await timeline("45-window-q-shatter", 80, 1, crop, { 2: () => fire("q", 1) });
  await save("46-window-q-broken", crop, 2);
}

if (want("candelabra")) {
  await open();
  await step(30);
  await move(2.95, 1);
  await step(1);
  const crop = await worldCrop(2.6, -1.75, 4.9, 0.25);
  await save("50-candelabra-lit", crop, 3);
  await timeline("51-candelabra-hit-wobble-gutter", 100, 1, crop, { 2: () => fire("slash", 1) });
  await step(60);
  console.log("candelabra:", await propState("candelabra"));
  await save("52-candelabra-out", crop, 3);
  await timeline("53-candelabra-relight", 50, 1, crop, { 2: use });
  await step(60);
  await move(2.7, 1);
  await timeline("54-candelabra-dash-wind", 70, 1, crop, { 2: () => fire("wind", 1) });
  await go("candelabra", "relighting");
  await step(80);
  await move(3.2, 1);
  await timeline("55-candelabra-heavy", 70, 1, crop, { 2: () => fire("heavy", 1) });
  await save("56-candelabra-heavy-after", crop, 3);
}

if (want("floor")) {
  await open();
  await step(30);
  await move(8.4, 1);
  await step(1);
  const crop = await worldCrop(6.6, -1.4, 10.6, 1.0);
  await timeline("60-floor-q-crater", 60, 1, crop, { 2: () => fire("q", 1) });
  await save("61-floor-q-crater", crop, 2);
  await move(9.6, -1);
  await fire("slash", -1);
  await step(20);
  await fire("heavy", -1);
  await step(40);
  await save("62-floor-scar-and-heavy", crop, 2);
  await timeline("63-floor-heal", 130, 5, crop, {});
  await save("64-floor-healed", crop, 2);
  await move(8.0, 1);
  await fire("r", 1);
  await step(30);
  await save("65-room-after-r");
  await step(90);
  await save("66-room-after-r-settled");
}

if (want("scale")) {
  await open("&h=144");
  await step(60);
  await save("70-room-H144-closeup");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open();
  await step(30);
  await page.screenshot({ path: join(out, "71-present-1920x1080-sharp-bilinear.png") });
  const fit = await page.evaluate(() => window.__pixel.renderer.fit);
  console.log("1080p fit:", JSON.stringify(fit));
  await page.setViewportSize({ width: 1280, height: 720 });
}

if (want("fx")) {
  await open();
  await step(30);
  await move(4.3, 1);
  await step(1);
  const crop = await worldCrop(3.9, -1.2, 5.6, 0.25);
  await save("80-font-still", crop, 3);
  await timeline("81-font-ripple-splash", 90, 1, crop, { 2: () => page.evaluate(() => { const P = window.__pixel; const f = P.prop("font"); const [x, y] = f.refs.water.toWorld(20, 2); P.fire("point", 1, [x, y]); }) });
  const pc = await worldCrop(1.9, -2.0, 3.2, -0.7);
  await timeline("82-plaque-disintegrate-assemble", 150, 1, pc, { 2: () => page.evaluate(() => window.__pixel.fx("donor plaque", "disintegrate")), 80: () => page.evaluate(() => window.__pixel.fx("donor plaque", "assemble")) }, 3);
  const bc = await worldCrop(0.9, -1.2, 2.3, 0.1);
  await timeline("83-box-dissolve-reveal", 110, 1, bc, { 2: () => page.evaluate(() => window.__pixel.fx("donation box", "dissolve")), 60: () => page.evaluate(() => window.__pixel.fx("donation box", "reveal")) }, 3);
  // cost: 600 steps + renders with the room active
  const perf = await page.evaluate(() => {
    const P = window.__pixel;
    P.fire("q", 1);
    const t0 = performance.now();
    let sim = 0;
    for (let i = 0; i < 300; i++) { const a = performance.now(); P.world.step(1 / 60); sim += performance.now() - a; P.render(); }
    const total = performance.now() - t0;
    P.renderer.gl.finish();
    let cells = 0; for (const part of P.world.allParts()) cells += part.grid.count;
    return { msPerFrame: total / 300, simMs: sim / 300, cells, particles: P.world.particles.n, chunks: P.world.chunks.length, stats: P.renderer.stats };
  });
  console.log("perf (headless, after a Q):", JSON.stringify(perf));
}

console.log(logs.filter((l) => !l.includes("[vite]")).join("\n"));
await browser.close();
