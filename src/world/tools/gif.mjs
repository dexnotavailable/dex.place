// Short motion captures of the test world as GIFs (judge motion through a
// cycle, not single frames). Frames every 3 ticks (20 fps) at 960x540 CSS
// (the world presented at 0.75x, sharp-bilinear), assembled with ffmpeg.
//   node src/world/tools/gif.mjs [--port 22763]
// Output: review/world/runtime/gif/<name>.gif

import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const i = process.argv.indexOf("--port");
const PORT = i >= 0 ? process.argv[i + 1] : process.env.WORLD_PORT ?? "22763";
const FFMPEG = process.env.FFMPEG ?? "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
const OUT = "review/world/runtime/gif";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
const ev = (fn, a) => page.evaluate(fn, a);
const adv = (n) => ev((n) => window.__world.advance(n), n);
for (let k = 0; k < 200; k++) {
  if (!(await ev(() => window.__world.game.loading))) break;
  await page.waitForTimeout(250);
  await adv(1);
}
await ev(() => window.__world.begin());
await adv(30);

async function record(name, frames, step) {
  const dir = `${OUT}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (let f = 0; f < frames; f++) {
    // a step may run its own ticks (returns true); otherwise 3 ticks per frame
    if (!(await step(f))) await adv(3);
    await page.screenshot({ path: `${dir}/${String(f).padStart(4, "0")}.png` });
  }
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", "20", "-i", `${dir}/%04d.png`, "-vf", "scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=none", `${OUT}/${name}.gif`]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${OUT}/${name}.gif`);
}
const press = (a) => ev((a) => window.__world.press(a), a);
const release = (a) => ev((a) => window.__world.release(a), a);

// the arrival: a few steps, then hop the pilings to the shore
await record("arrival-pilings", 120, async (f) => {
  if (f === 2) await press("right");
  if (f === 112) await release("right");
  // jump at the far edge of whatever she stands on: a player's timing, checked every tick
  await ev(() => {
    const w = window.__world, g = w.game, b = g.player.body;
    for (let t = 0; t < 3; t++) {
      const on = g.room.collision.standingOn;
      const st = (w.__held ?? 0);
      if (st > 0) { w.__held = st - 1; if (st === 1) w.release("jump"); }
      else if (b.grounded && on && on.x + on.w - b.x < 7 && b.x > 1300) { w.press("jump"); w.__held = 16; }
      w.advance(1);
    }
  });
  return true;
});
// the plain in the storm: wind, rain, flags, lightning
await ev(() => window.__world.teleport("plain", "west"));
for (let k = 0; k < 80; k++) {
  if (await ev(() => { const r = window.__world.game.stream.rooms.get("plain"); return r.backdrop.ready(); })) break;
  await page.waitForTimeout(250);
}
await ev(() => { const g = window.__world.game; return window.__world.place(g.room.def.w * 0.74); });
await adv(60);
await record("plain-storm", 120, async (f) => {
  if (f === 10) await press("right");
  if (f === 40) await release("right");
  if (f === 50) await press("m1");
  if (f === 52) await release("m1");
  if (f === 62) await press("m1");
  if (f === 64) await release("m1");
});
// indoors: up the lift
await ev(() => window.__world.teleport("house", "entry"));
for (let k = 0; k < 80; k++) {
  if (await ev(() => { const r = window.__world.game.stream.rooms.get("house"); return r.backdrop.ready(); })) break;
  await page.waitForTimeout(250);
}
await ev(() => { const g = window.__world.game; const l = g.room.def.props.find((p) => p.id === "lift"); return window.__world.place(l.x); });
await adv(30);
await record("house-lift", 90, async (f) => {
  if (f === 5) await ev(() => window.__world.use());
});
await browser.close();
