// R-C motion captures: short GIFs of the Hollow's moving parts at game size
// (1280x720 world frames, nearest only), judged through a full cycle.
//   node src/world/rooms/hollow/_tools/gif.mjs [--port 24401] [--only name,name]
// Writes review/world/phase2/R-C/gif/<name>.gif (+ a contact sheet PNG per clip).
import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
const require = createRequire(process.env.PW_ROOT ?? new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24401");
const ONLY = arg("only", "") ? new Set(arg("only").split(",")) : null;
const OUT = "review/world/phase2/R-C/gif";
const FF = "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
mkdirSync(OUT, { recursive: true });

/** name, room, x (H), y (H or null), seconds, ticks per frame, actions [at frame, js] */
const CLIPS = [
  ["c1-footfalls", "C1", 213.0, null, 7.5, 6, []],
  ["c1-vent-awning", "C1", 207.2, null, 12, 6, [[20, "press:right"], [24, "release:right"], [70, "m1"]]],
  ["c1-crane-hook", "C1", 222.0, -26, 7, 6, [[6, "m1"]]],
  ["c1-hearth", "C1", 216.2, null, 4, 4, [[10, "m1"]]],
  ["c2-archive", "C2", 234.4, null, 10, 6, [[30, "dash-right"], [70, "use-archivist"]]],
  ["c2-bay-knock", "C2", 240.0, null, 6, 5, [[6, "skill"]]],
  ["c3-gate", "C3", 264.6, null, 7, 5, [[8, "use"]]],
];

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
for (const [name, room, x, y, secs, tpf, acts] of CLIPS) {
  if (ONLY && !ONLY.has(name)) continue;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&mute&room=${room}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  for (let k = 0; k < 600 && (await page.evaluate(() => window.__world.game.loading)); k++) {
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__world.advance(1));
  }
  await page.evaluate(() => window.__world.begin());
  await page.evaluate(([x, y]) => {
    const w = window.__world;
    const o = w.game.room.def.origin ?? [0, 0];
    const px = (x - o[0]) * 80;
    w.place(px, y !== null ? (o[1] - y) * 80 : w.game.room.collision.groundAt(px, w.game.player.body.y - 240));
  }, [x, y]);
  for (let k = 0; k < 300 && !(await page.evaluate(() => { const b = window.__world.game.room.backdrop; return !b || b.ready(); })); k++) await page.waitForTimeout(100);
  await page.evaluate(() => window.__world.advance(60));
  const dir = `${OUT}/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = Math.round((secs * 60) / tpf);
  for (let f = 0; f < frames; f++) {
    for (const [at, a] of acts) {
      if (at !== f) continue;
      await page.evaluate((a) => {
        const w = window.__world;
        if (a === "m1" || a === "skill") {
          w.press(a);
          w.advance(3);
          w.release(a);
        } else if (a === "use") w.use();
        else if (a === "use-archivist") {
          const g = w.game;
          const p = g.room.pixel.world.find("archivist");
          w.place(p.x + 60, g.player.body.y);
          w.advance(2);
          w.use();
        } else if (a === "dash-right") {
          w.press("right");
          w.press("m2");
          w.advance(4);
          w.release("m2");
          w.advance(20);
          w.release("right");
        } else if (a.startsWith("press:")) w.press(a.slice(6));
        else if (a.startsWith("release:")) w.release(a.slice(8));
      }, a);
    }
    await page.evaluate((n) => window.__world.advance(n), tpf);
    await page.screenshot({ path: `${dir}/${String(f).padStart(4, "0")}.png` });
  }
  const fps = Math.round(60 / tpf);
  spawnSync(FF, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${dir}/%04d.png`, "-vf", "scale=640:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none", `${OUT}/${name}.gif`]);
  spawnSync(FF, ["-y", "-loglevel", "error", "-i", `${dir}/%04d.png`, "-vf", `select='not(mod(n\\,${Math.max(1, Math.floor(frames / 6))}))',scale=640:-1:flags=neighbor,tile=3x2`, "-frames:v", "1", `${OUT}/${name}-sheet.png`]);
  console.log(name, frames, "frames");
  await page.close();
}
await browser.close();
