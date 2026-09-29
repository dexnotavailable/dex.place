// Motion captures for region E (lane R-E): judge motion through a cycle, not single frames.
//   node src/world/rooms/chapel/_tools/gif.mjs [--port 24601]
// Frames every 3 ticks (20 fps) at 960x540 CSS (the world at 0.75x, sharp-bilinear), with the
// thumbnails (DOM) in the page screenshot. Output: review/world/phase2/R-E/gif/<name>.gif
import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const i = process.argv.indexOf("--port");
const PORT = i >= 0 ? process.argv[i + 1] : process.env.WORLD_PORT ?? "24601";
const FFMPEG = process.env.FFMPEG ?? "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
const OUT = "review/world/phase2/R-E/gif";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&mute`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
const ev = (fn, a) => page.evaluate(fn, a);
const adv = (n) => ev((n) => window.__world.advance(n), n);
for (let k = 0; k < 300 && (await ev(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await adv(1);
}
await ev(() => window.__world.begin());
async function go(room, spawn, x) {
  await ev(([r, s, x]) => {
    const w = window.__world;
    w.teleport(r, s);
    if (x !== undefined) {
      const o = w.game.room.def.origin;
      const px = (x - o[0]) * 80;
      w.place(px, w.game.room.collision.groundAt(px, 0));
    }
  }, [room, spawn, x]);
  for (let k = 0; k < 400; k++) {
    if (await ev(() => { const g = window.__world.game; const b = g.room.backdrop; return !g.loading && (!b || b.ready()); })) break;
    await page.waitForTimeout(80);
    await adv(1);
  }
  await adv(150);
}
async function record(name, frames, each = 3, act) {
  const dir = `${OUT}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (let f = 0; f < frames; f++) {
    if (act) await act(f);
    await adv(each);
    await page.screenshot({ path: `${dir}/${String(f).padStart(4, "0")}.png` });
  }
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(60 / each), "-i", `${dir}/%04d.png`, "-vf", "split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=none", `${OUT}/${name}.gif`]);
  console.log(name);
}
// the rose window: the crank, the leaves swing back, the light sweeps east down the nave
await go("E3", "", 414.4);
await record("rose-sweep", 170, 6, async (f) => {
  if (f === 5) await ev(() => window.__world.game.room.pixel.world.find("rose-crank").use());
});
// the same sweep seen from the middle of the nave
await ev(() => localStorage.clear());
await go("E1", "", 341.1);
await ev(() => { const w = window.__world; const o = w.game.room.def.origin; w.place((341.5 - o[0]) * 80, (90 - 70.9) * 80); });
await record("rib-bell", 120, 3, async (f) => {
  if (f === 10) await ev(() => window.__world.game.room.pixel.world.find("rib-bell").act("ring", 1));
});
// the terrace at dusk: clouds, colossi, the ring, motes (a slow scene)
await go("E1", "", 354.5);
await record("terrace-dusk", 120, 12);
// the balcony: the latch rings the bell by itself, the rail drops, the door opens and takes you home
await go("E4", "balcony");
await adv(160);
await record("latch", 110, 3, async (f) => {
  if (f === 12) await ev(() => window.__world.use());
});
await browser.close();
