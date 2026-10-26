// Region B in motion (judge motion through a cycle, not single frames), lane R-B:
//   node src/world/rooms/plain/_tools/gifs.mjs [--port 24301] [--only bridge,culvert,crane,wind,stonetop]
// bridge    B1: the rope cut at the cleat from the east bank, the deck swinging down
// culvert   B5: the lever pulled, the gate lifting, the horn, the lake's light
// crane     B5: the hook ride down the shaft (32 H in 10 s)
// wind      B2: the red cloth, flags and grass in the rising wind by the second break
// stonetop  B4: the colossus passing at eye level from the summit
// 20 fps (10 for the long ones), 960 px wide GIFs in review/world/phase2/R-B/gif/.
import { createRequire } from "node:module";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24301");
const ONLY = new Set(arg("only", "bridge,culvert,crane,wind,stonetop").split(","));
const FFMPEG = process.env.FFMPEG ?? "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
const OUT = "review/world/phase2/R-B/gif";
mkdirSync(OUT, { recursive: true });
const BOT = readFileSync(new URL("../../../tools/bot.js", import.meta.url), "utf8");
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const ev = (fn, a) => page.evaluate(fn, a);
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
await page.addScriptTag({ content: BOT });
for (let k = 0; k < 300 && (await ev(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await ev(() => window.__world.advance(1));
}
await ev(() => window.__world.begin());

async function at(room, spawn, x, y) {
  await ev(([r, s]) => window.__world.teleport(r, s), [room, spawn]);
  for (let k = 0; k < 300; k++) {
    if (await ev(() => { const b = window.__world.game.room.backdrop; return !window.__world.game.trans && (!b || b.ready()); })) break;
    await ev(() => window.__world.advance(1));
    await page.waitForTimeout(50);
  }
  if (x !== undefined)
    await ev(([x, y]) => {
      const w = window.__world;
      const o = w.game.room.def.origin ?? [0, 0];
      const px = (x - o[0]) * 80;
      w.place(px, y !== undefined && y !== null ? (o[1] - y) * 80 : w.game.room.collision.groundAt(px, w.game.player.body.y - 80 * 3));
    }, [x, y ?? null]);
  await ev(() => window.__world.advance(60));
}
async function record(name, seconds, every = 3, act) {
  const dir = `${OUT}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const n = Math.round((seconds * 60) / every);
  for (let i = 0; i < n; i++) {
    if (act) await act(i);
    await ev((k) => window.__world.advance(k), every);
    await page.screenshot({ path: `${dir}/${String(i).padStart(4, "0")}.png` });
  }
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(60 / every), "-i", `${dir}/%04d.png`, "-vf", "scale=960:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=none", `${OUT}/${name}.gif`]);
  console.log(`${OUT}/${name}.gif`);
}

if (ONLY.has("bridge")) {
  await at("B1", "channel-east", 98.9, 0.2);
  await ev(() => { window.__world.press("left"); window.__world.advance(1); window.__world.release("left"); });
  await record("bridge", 4, 3, async (i) => {
    if (i === 6) await ev(() => { window.__world.press("m1"); window.__world.advance(4); window.__world.release("m1"); });
  });
}
if (ONLY.has("culvert")) {
  await at("B5", "culvert", 182.6, 0);
  await record("culvert", 4.5, 3, async (i) => {
    if (i === 5) await ev(() => window.__world.use());
  });
}
if (ONLY.has("crane")) {
  await at("B5", "culvert", 186.4, 0);
  await record("crane", 12, 6, async (i) => {
    if (i === 3) await ev(() => window.__world.use());
  });
}
if (ONLY.has("wind")) {
  await at("B2", "west", 144.2, 1.4);
  await record("wind", 5, 3);
}
if (ONLY.has("stonetop")) {
  await at("B2", "east", 163.4, 17.3);
  // wait until the keeper says the colossus is passing, then a few seconds of it
  for (let k = 0; k < 200; k++) {
    const st = await ev(() => { window.__world.advance(60); return window.__world.game.room.prop("keeper")?.state; });
    if (st === "passing") break;
  }
  await record("stonetop", 16, 6);
}
await browser.close();
