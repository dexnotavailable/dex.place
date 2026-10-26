// Spire captures (lane R-D): stills of the spire rooms from named standpoints,
// in one browser session per viewport so each room's shaders compile once.
//   node src/world/rooms/spire/_tools/views.mjs [--port 24501] [--out dir] [--w 1280 --h 720 --dpr 1]
//        [--only D2,D3] [--views name,name] [--t 4] [--fresh 1] [--flags shrine:1,shrine:2]
// A view: room, where to stand (world H x, elevation y), how long to let it run, and optional
// actions (use E, hold still for the vista). Frames are the game's own canvas (the presenter's
// output at the viewport's size), so 1920x1080 shows the 1.5x sharp-bilinear fit.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", "24501");
const OUT = arg("out", "review/world/phase2/R-D/views");
const VW = +arg("w", 1280), VH = +arg("h", 720), DPR = +arg("dpr", 1);
const ONLY = arg("only", "") ? new Set(arg("only", "").split(",")) : null;
const PICK = arg("views", "") ? new Set(arg("views", "").split(",")) : null;
const RUN = +arg("t", 3);
const FLAGS = arg("flags", "") ? arg("flags", "").split(",") : [];
mkdirSync(OUT, { recursive: true });

/** [name, room, spawn, x (world H) or null, elevation or null, extra seconds, actions] */
export const VIEWS = [
  ["D1-bottom", "D1", "bottom", null, null, 0.2, []],
  ["D1-mid", "D1", "bottom", null, null, 7.5, ["ride"]],
  ["D1-top", "D1", "bottom", null, null, 16.5, ["ride"]],
  ["D2-lift", "D2", "lift", 266.5, 40, 1, []],
  ["D2-row46", "D2", "lift", 262, 46, 1, []],
  ["D2-west52", "D2", "lift", 253.2, 52, 1, []],
  ["D2-alcove", "D2", "shrine", 263.5, 58, 2, []],
  ["D2-perch", "D2", "lift", 248.2, 52, 3, ["still"]],
  ["D2-row64", "D2", "lift", 256, 64, 1, []],
  ["D2-top", "D2", "top", 249, 76, 1, []],
  ["D3-west", "D3", "west", 256.5, 76, 1, []],
  ["D3-mid", "D3", "west", 268, 76, 1, []],
  ["D3-east", "D3", "lift", 279, 76, 1, []],
  ["D4-west", "D4", "west", 287, null, 1, []],
  ["D4-break", "D4", "west", 296, null, 5, []],
  ["D4-tip", "D4", "east", 313.1, null, 4, ["still"]],
];

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&mute`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
for (let k = 0; k < 300 && (await page.evaluate(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__world.advance(1));
}
await page.evaluate((flags) => {
  const w = window.__world;
  w.begin();
  for (const f of flags) w.game.save.set(f, true);
}, FLAGS);

const report = {};
for (const [name, room, spawn, x, y, extra, acts] of VIEWS) {
  if (ONLY && !ONLY.has(room)) continue;
  if (PICK && !PICK.has(name)) continue;
  await page.evaluate(([room, spawn]) => window.__world.teleport(room, spawn), [room, spawn]);
  for (let k = 0; k < 400; k++) {
    const ok = await page.evaluate(() => {
      const g = window.__world.game;
      const b = g.room.backdrop;
      return !g.trans && (!b || b.ready());
    });
    if (ok) break;
    await page.waitForTimeout(80);
    await page.evaluate(() => window.__world.advance(1));
  }
  if (x !== null) {
    await page.evaluate(([x, y]) => {
      const w = window.__world;
      const d = w.game.room.def;
      const o = d.origin ?? [0, 0];
      const px = (x - o[0]) * 80;
      const py = y === null ? w.game.room.collision.groundAt(px, 0) : (o[1] - y) * 80;
      w.place(px, py);
    }, [x, y]);
  }
  if (acts.includes("ride")) await page.evaluate(() => window.__world.use());
  const ticks = Math.round((RUN + extra) * 60);
  for (let k = 0; k < ticks; k += 30) await page.evaluate((n) => window.__world.advance(n), Math.min(30, ticks - k));
  await page.evaluate(() => window.__world.render());
  await page.screenshot({ path: `${OUT}/${name}.png` });
  report[name] = await page.evaluate(() => {
    const g = window.__world.game;
    const s = g.state();
    return { room: s.room, area: s.area, x: s.x, y: s.y, camera: s.camera, weather: s.weather?.label, flash: s.weather?.flash, frameMs: s.frameMs ?? null };
  });
  console.log(name, JSON.stringify(report[name]));
}
writeFileSync(`${OUT}/views.json`, JSON.stringify({ report, errors }, null, 1));
if (errors.length) console.log("errors:", errors.slice(0, 10));
await browser.close();
