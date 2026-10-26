// Motion captures of the grey-box mechanisms (judge motion through a cycle,
// not single frames): the map cord cut in the yard (pixel matter in the
// world), the rope bridge cut from the east bank, the crane hook down the
// hollow mouth, the spire lift to the break. 20 fps, 960 px wide GIFs.
//   node src/world/tools/gif-round.mjs [--port 24001]
// Output: review/world/phase2/W0/gif/<name>.gif

import { createRequire } from "node:module";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const i = process.argv.indexOf("--port");
const PORT = i >= 0 ? process.argv[i + 1] : process.env.WORLD_PORT ?? "24001";
const FFMPEG = process.env.FFMPEG ?? "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
const OUT = "review/world/phase2/W0/gif";
mkdirSync(OUT, { recursive: true });
const BOT = readFileSync(new URL("./bot.js", import.meta.url), "utf8");

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
await page.addScriptTag({ content: BOT });
const ev = (fn, a) => page.evaluate(fn, a);
for (let k = 0; k < 300 && (await ev(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await ev(() => window.__world.advance(1));
}
await ev(() => window.__world.begin());

async function at(room, spawn, x) {
  await ev(([r, s]) => window.__world.teleport(r, s), [room, spawn]);
  for (let k = 0; k < 100; k++) {
    if (await ev(() => { const b = window.__world.game.room.backdrop; return !b || b.ready(); })) break;
    await page.waitForTimeout(100);
  }
  if (x !== undefined) await ev((x) => window.__bot.walk(x, 900), x);
  await ev(() => window.__world.advance(40));
}
async function record(name, frames, step) {
  const dir = `${OUT}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (let f = 0; f < frames; f++) {
    await step(f);
    await ev(() => window.__world.advance(3));
    await page.screenshot({ path: `${dir}/${String(f).padStart(4, "0")}.png` });
  }
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", "20", "-i", `${dir}/%04d.png`, "-vf", "scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=none", `${OUT}/${name}.gif`]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${OUT}/${name}.gif`);
}

await at("A4", "west", 68.2);
await record("a4-map-cord", 110, async (f) => {
  if (f === 8) await ev(() => window.__bot.slash(1));
  if (f === 70) await ev(() => window.__bot.walk(69.8, 60));
  if (f === 80) await ev(() => window.__bot.use());
});
await ev(() => window.__bot.closePanel());
await at("B1", "channel-east", 98.9);
await record("b1-rope-bridge", 90, async (f) => {
  if (f === 6) await ev(() => window.__bot.slash(-1));
});
await at("B5", "culvert", 186.4);
await record("b5-crane-hook", 80, async (f) => {
  if (f === 4) await ev(() => window.__bot.use());
  if (f > 4) await ev(() => window.__world.advance(3));
});
await at("D1", "bottom");
await record("d1-lift-ride", 110, async (f) => {
  if (f > 2) await ev(() => window.__world.advance(3));
});
await browser.close();
