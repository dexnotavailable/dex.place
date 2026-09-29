// Region B quick capture (lane R-B): one world frame of a room at a place.
//   node src/world/rooms/plain/_tools/cap.mjs <out.png> <room> [--spawn west] [--x 95.2] [--y 0.2]
//        [--t 2] [--w 1280 --h 720 --dpr 1] [--flags cut:rope-bridge,shrine:1] [--reduced 1]
//        [--port 24301] [--angle d3d11] [--eval "js run in the page before the shot"]
// --x/--y are world H (the plan's coordinates). --t is seconds of simulation after arriving.
import { createRequire } from "node:module";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const argv = process.argv.slice(2);
const out = argv[0];
const room = argv[1];
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24301");
const W = +arg("w", 1280), H = +arg("h", 720), DPR = +arg("dpr", 1);
const angle = arg("angle", "d3d11");
const args = [`--use-angle=${angle}`, "--enable-gpu", "--ignore-gpu-blocklist"];
if (angle === "swiftshader") args.push("--enable-unsafe-swiftshader");
const browser = await chromium.launch({ channel: "msedge", args });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, reducedMotion: arg("reduced", "0") === "1" ? "reduce" : "no-preference", hasTouch: W < 1000, isMobile: W < 1000 });
const page = await ctx.newPage();
const logs = [];
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && logs.push(m.text()));
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
for (let k = 0; k < 300 && (await page.evaluate(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__world.advance(1));
}
await page.evaluate(() => window.__world.begin());
const flags = arg("flags", "");
if (flags) await page.evaluate((f) => f.split(",").forEach((k) => window.__world.game.save.set(k, true)), flags);
await page.evaluate(([r, s]) => window.__world.teleport(r, s), [room, arg("spawn", "west")]);
for (let k = 0; k < 300; k++) {
  const ok = await page.evaluate(() => { const b = window.__world.game.room.backdrop; return !window.__world.game.trans && (!b || b.ready()); });
  if (ok) break;
  await page.evaluate(() => window.__world.advance(1));
  await page.waitForTimeout(60);
}
const x = arg("x", null);
if (x !== null) {
  await page.evaluate(([x, y]) => {
    const w = window.__world;
    const d = w.game.room.def;
    const o = d.origin ?? [0, 0];
    const px = (x - o[0]) * 80;
    const py = y !== null ? (o[1] - y) * 80 : w.game.room.collision.groundAt(px, w.game.player.body.y - 80 * 3);
    w.place(px, py);
  }, [+x, arg("y", null) === null ? null : +arg("y", null)]);
}
const ev = arg("eval", "");
if (ev) await page.evaluate(ev);
const t = +arg("t", "2");
for (let i = 0; i < Math.round(t * 60); i += 30) await page.evaluate((n) => window.__world.advance(n), Math.min(30, Math.round(t * 60) - i));
await page.evaluate(() => window.__world.render());
await page.screenshot({ path: out });
const st = await page.evaluate(() => { const s = window.__world.state(); return { room: s.room, x: s.x, y: s.y, camera: s.camera, present: s.present, feet: +((s.y - s.camera[1]) / 720).toFixed(3) }; });
console.log(JSON.stringify({ st, logs }));
await browser.close();
