// R-C quick capture: one room, standing at world x (H), after n ticks.
//   node src/world/rooms/hollow/_tools/shot.mjs <out.png> <room> [x] [--w 1920 --h 1080 --dpr 1 --ticks 150 --port 24401 --y <H> --query ""]
// Uses playwright-core from tools/scene-pipeline driving Edge (d3d11).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
const require = createRequire(process.env.PW_ROOT ?? new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const [out, room, xs] = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const PORT = arg("port", process.env.WORLD_PORT ?? "24401");
const W = +arg("w", 1920), H = +arg("h", 1080), DPR = +arg("dpr", 1), TICKS = +arg("ticks", 150);
const mobile = arg("phone", "0") === "1";
mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: mobile, isMobile: mobile, reducedMotion: arg("reduced", "0") === "1" ? "reduce" : "no-preference" });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&mute&room=${room}${arg("query", "") ? "&" + arg("query", "") : ""}`, { waitUntil: "load", timeout: 120000 });
try {
  await page.waitForFunction(() => !!window.__world, null, { timeout: 60000 });
} catch (e) {
  console.log(JSON.stringify({ error: String(e).slice(0, 200), logs }));
  await browser.close();
  process.exit(1);
}
for (let k = 0; k < 600 && (await page.evaluate(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__world.advance(1));
}
await page.evaluate(() => window.__world.begin());
if (xs !== undefined) {
  await page.evaluate(([x, y]) => {
    const w = window.__world;
    const o = w.game.room.def.origin ?? [0, 0];
    const px = (x - o[0]) * 80;
    const py = y !== undefined ? (o[1] - y) * 80 : w.game.room.collision.groundAt(px, w.game.player.body.y - 80 * 3);
    w.place(px, py);
  }, [+xs, arg("y", undefined) !== undefined ? +arg("y") : undefined]);
}
for (let k = 0; k < 300; k++) {
  const ok = await page.evaluate(() => { const b = window.__world.game.room.backdrop; return !b || b.ready(); });
  if (ok) break;
  await page.waitForTimeout(100);
}
await page.evaluate((n) => window.__world.advance(n), TICKS);
await page.screenshot({ path: out });
const state = await page.evaluate(() => { const s = window.__world.state(); return { room: s.room, x: s.x, y: s.y, camera: s.camera, present: s.present, anchor: s.anchor, cameraMode: s.cameraMode }; });
console.log(JSON.stringify({ state, logs: logs.slice(0, 20) }));
await browser.close();
