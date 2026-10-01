// Loads /world/ headless (software WebGL) on a local vite dev server and captures the real package in the real game:
//   - every clip (PLAYER_CLIPS + sit), every drawing, at 80 px (the world sprite) and at 144 px (the close-up sprite)
//   - idle / run / attack / ult played through the actual controller in two rooms
// Raw crops land in <out>/<group>/<name>.png plus a capture.json with what the game reported (sprite source, errors).
//   node tools/rosace-package/capture_world.mjs --out review/world [--port 29010] [--rooms arrival:,plain:west] [--probe]
// Run through the shared gate (browser run): bash tools/rosace-package/gate.sh node tools/rosace-package/capture_world.mjs ...
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
process.env.PLAYWRIGHT_BROWSERS_PATH = "D:/Dex/Temp/ms-playwright";
const require = createRequire("file:///D:/Dex/Temp/dexplace-site-research/package.json");
const { chromium } = require("playwright-core");

const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(REPO, arg("out", "review/world"));
const port = Number(arg("port", "29010"));
const query = arg("query", "&world=test");
const noclips = process.argv.includes("--noclips");
const groups = arg("groups", "clips80,clips144").split(",");
const rooms = arg("rooms", "arrival:start,house:entry").split(",").map((s) => s.split(":"));
const CLIPS = ["idle", "run", "jump", "apex", "fall", "land", "double_jump", "dash", "dash_attack", "m1_1", "m1_2", "m1_3", "m1_4", "skill_q", "ult_r", "hurt", "sit"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const vite = spawn(process.execPath, [path.join(REPO, "node_modules/vite/bin/vite.js"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
let viteLog = "";
vite.stdout.on("data", (d) => (viteLog += d));
vite.stderr.on("data", (d) => (viteLog += d));
const stopVite = () => { try { spawn("taskkill", ["/pid", String(vite.pid), "/t", "/f"], { stdio: "ignore" }); } catch { /* already gone */ } };
process.on("exit", stopVite);
for (let i = 0; i < 120 && !/Local:|ready in/.test(viteLog); i++) await sleep(500);
if (!/Local:|ready in/.test(viteLog)) { console.error("vite did not start:\n" + viteLog); stopVite(); process.exit(1); }

const report = { errors: [], rooms: {}, sprite: null };
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-gl=angle"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => report.errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") report.errors.push(m.text()); });
const go = async () => {
  await page.goto(`http://127.0.0.1:${port}/world/?go&mute&fresh${process.argv.includes("--debug") ? "&debug" : ""}${query}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 180000 });
  for (let k = 0; k < 400 && (await page.evaluate(() => window.__world.game.loading)); k++) await page.evaluate(() => window.__world.advance(1));
  await page.evaluate(() => window.__world.begin());
  // the capture drives render()/advance() itself: stop the software-GL frame loop so it cannot compete for the CPU
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__world.advance(30));
};
await go();
report.sprite = await page.evaluate(() => { const g = window.__world.game; return { world: g.player.sprite.source, closeup: g.closeupSprite.source, names: [g.player.sprite.pkg.name, g.closeupSprite.pkg.name], clips: [...g.player.sprite.clips.keys()] }; });
console.log(JSON.stringify(report.sprite));
if (process.argv.includes("--probe")) {   // rollback / load check only: which sprite source did the game load?
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "probe.json"), JSON.stringify({ sprite: report.sprite, errors: report.errors }, null, 1));
  await browser.close();
  stopVite();
  console.log("errors:", report.errors.length);
  process.exit(report.errors.length ? 1 : 0);
}

/** Grab the whole canvas right after a fresh render() (same task, so the drawing buffer is valid and the software-GL
 * loop cannot interleave), and find the player's pixels by rendering the same state again with her drawing suppressed
 * and diffing: the bounding box is exactly what the game drew for her, wherever the camera put her. */
const frames = {};
async function shot(group, name) {
  mkdirSync(path.join(out, group), { recursive: true });
  const data = await page.evaluate(() => {
    const g = window.__world.game, cv = document.getElementById("view");
    const grab = () => {
      if (window.__forceCloseup) { g.camera.closeup = 1; g.camera.closeupTarget = 1; }
      g.render();
      const c2 = document.createElement("canvas");
      c2.width = cv.width; c2.height = cv.height;
      const ctx = c2.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(cv, 0, 0);
      return { c2, px: ctx.getImageData(0, 0, c2.width, c2.height).data };
    };
    const A = grab();
    const draw0 = g.player.spriteDraw, close0 = g.closeupSprite;
    g.player.spriteDraw = () => { const d = draw0(); return d ? { ...d, sw: 0, sh: 0 } : d; };
    g.closeupSprite = { ...close0, clips: new Map() };
    let B;
    try { B = grab(); } finally { g.player.spriteDraw = draw0; g.closeupSprite = close0; }
    // changed-pixel profile per column and row; the player is the heaviest contiguous run (stray lighting noise is thin)
    const W = cv.width, H = cv.height, cols = new Uint32Array(W), rows = new Uint32Array(H);
    let total = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (Math.abs(A.px[i] - B.px[i]) + Math.abs(A.px[i + 1] - B.px[i + 1]) + Math.abs(A.px[i + 2] - B.px[i + 2]) > 24) { cols[x]++; rows[y]++; total++; }
    }
    const run = (arr, minv) => {
      let best = [0, -1, 0], cur = null;
      for (let i = 0; i <= arr.length; i++) {
        const on = i < arr.length && arr[i] >= minv;
        if (on) { if (!cur) cur = [i, i, 0]; cur[1] = i; cur[2] += arr[i]; }
        else if (cur) { if (cur[2] > best[2]) best = cur; cur = null; }
      }
      return best;
    };
    const rx = run(cols, 3), ry = run(rows, 3);
    const bbox = rx[1] < 0 || ry[1] < 0 ? null : [rx[0], ry[0], rx[1] + 1, ry[1] + 1];
    const x1 = bbox ? 1 : -1;
    g.render();
    return { url: A.c2.toDataURL("image/png"), bbox, changed: total, size: [cv.width, cv.height] };
  });
  writeFileSync(path.join(out, group, name + ".png"), Buffer.from(data.url.split(",")[1], "base64"));
  (frames[group] ??= {})[name] = { bbox: data.bbox, size: data.size };
  return data.bbox;
}
async function fullShot(file) {
  const url = await page.evaluate(() => { window.__world.game.render(); return document.getElementById("view").toDataURL("image/png"); });
  writeFileSync(file, Buffer.from(url.split(",")[1], "base64"));
}

// 1. every clip, every drawing, forced through the real ClipPlayer (world sprite), then again in the close-up
for (const [group, closeup] of noclips ? [] : [["clips80", false], ["clips144", true]].filter(([g]) => groups.includes(g))) {
  await page.evaluate((c) => { window.__forceCloseup = c; const g = window.__world.game; if (g.sitting) g.stand(); g.camera.override = null; g.camera.closeup = c ? 1 : 0; g.camera.closeupTarget = c ? 1 : 0; }, closeup);
  await page.evaluate(() => window.__world.advance(30));
  for (const id of CLIPS) {
    const n = await page.evaluate((id) => window.__world.game.player.sprite.clips.get(id).frames.length, id);
    for (let i = 0; i < n; i++) {
      if (id === "sit" && !closeup) {
        await page.evaluate((i) => {
          const g = window.__world.game;
          if (!g.sitting) { g.teleport("arrival", "start"); g.openPanel("sit", "arrival-bench"); }
          const fr = g.worldSprite.clips.get("sit").frames;
          g.sitTicks = fr.slice(0, i).reduce((s, f) => s + (f.duration || 1) + (f.hold || 0), 0);
          g.render();
        }, i);
      } else {
        await page.evaluate(({ id, i }) => {
          const g = window.__world.game, p = g.player;
          if (g.sitting) g.stand();
          const sprite = g.camera.closeup > 0.5 ? g.closeupSprite : p.sprite;
          p.clip.play(p.sprite.clips.get(id));
          p.clip.index = i;
          p.clip.tick = 0;
        }, { id, i });
      }
      await shot(group, `${id}_${String(i).padStart(2, "0")}`);
    }
  }
  await page.evaluate(() => { const g = window.__world.game; if (g.sitting) g.stand(); });
}
await page.evaluate(() => { window.__forceCloseup = false; const g = window.__world.game; g.camera.closeup = 0; g.camera.closeupTarget = 0; });
await page.evaluate(() => window.__world.advance(60));

// 2. the moves through the real controller in two rooms
for (const [room, spawn] of rooms) {
  const tag = (room || "current") + (spawn ? "-" + spawn : "");
  if (room) await page.evaluate(([r, s]) => window.__world.teleport(r, s), [room, spawn]);
  await page.evaluate(() => window.__world.advance(60));
  report.rooms[tag] = await page.evaluate(() => window.__world.state());
  const seq = async (name, act, ticks, every) => {
    await page.evaluate((a) => { if (a) window.__world.press(a); }, act);
    for (let t = 0; t < ticks; t += every) {
      await page.evaluate((n) => window.__world.advance(n), every);
      const clip = await page.evaluate(() => window.__world.game.player.clip.clip.id);
      await shot(`rooms/${tag}`, `${name}_${String(t).padStart(3, "0")}_${clip}`);
    }
    await page.evaluate((a) => { if (a) window.__world.release(a); }, act);
  };
  await seq("idle", null, 60, 15);
  await seq("run", "right", 48, 6);
  await page.evaluate(() => window.__world.advance(30));
  // the M1 string: four taps (m1_1 .. m1_4), the controller chains them; sampled every 4 ticks
  for (let t = 0; t < 72; t += 4) {
    if (t % 16 === 0 && t < 64) await page.evaluate(() => { window.__world.press("m1"); window.__world.advance(1); window.__world.release("m1"); });
    await page.evaluate(() => window.__world.advance(4));
    const clip = await page.evaluate(() => window.__world.game.player.clip.clip.id);
    await shot(`rooms/${tag}`, `attack_${String(t).padStart(3, "0")}_${clip}`);
  }
  await page.evaluate(() => window.__world.advance(60));
  // the ultimate: one press, sampled every 6 ticks through the call, rise, cleave and hold
  await page.evaluate(() => { window.__world.press("ult"); window.__world.advance(1); window.__world.release("ult"); });
  for (let t = 0; t < 150; t += 6) {
    await page.evaluate(() => window.__world.advance(6));
    const clip = await page.evaluate(() => window.__world.game.player.clip.clip.id);
    await shot(`rooms/${tag}`, `ult_${String(t).padStart(3, "0")}_${clip}`);
  }
  await page.evaluate(() => window.__world.release("ult"));
  await fullShot(path.join(out, `room_${tag}.png`));
}
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "capture.json"), JSON.stringify(report, null, 1));
writeFileSync(path.join(out, "frames.json"), JSON.stringify(frames));
await browser.close();
stopVite();
console.log("errors:", report.errors.length);
