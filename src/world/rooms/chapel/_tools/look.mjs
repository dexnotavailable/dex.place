// Quick look at a region E room in /world/ (lane R-E):
//   node src/world/rooms/chapel/_tools/look.mjs <out.png> <room> [--x 440] [--spawn west] [--ticks 120]
//        [--w 1280 --h 720 --dpr 1] [--flags rose:open,shrine:5] [--eval "js"] [--after "js"] [--port 24601] [--touch]
// Opens /world/?manual&fresh, starts, teleports, places the player at world x (H), runs the
// simulation for --ticks, optionally evaluates JS (window.__world is there), renders, and
// saves a screenshot of the page. Prints the state, the thumbnail overlay and errors.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const has = (n) => args.includes(`--${n}`);
const [out, room] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const PORT = opt("port", process.env.WORLD_PORT ?? "24601");
const W = +opt("w", "1280"), H = +opt("h", "720"), DPR = +opt("dpr", "1");
const flags = opt("flags", "").split(",").filter(Boolean);
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: has("touch"), isMobile: has("touch") });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});
if (flags.length) {
  await page.addInitScript((fl) => {
    const d = { v: 1, flags: Object.fromEntries(fl.map((k) => [k, true])), rest: null, sound: false, props: {} };
    localStorage.setItem("dex.world.v1", JSON.stringify(d));
  }, flags);
}
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&mute${flags.length ? "" : "&fresh"}`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
for (let k = 0; k < 300 && (await page.evaluate(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__world.advance(1));
}
await page.evaluate(() => window.__world.begin());
if (room) {
  await page.evaluate(([id, spawn]) => window.__world.teleport(id, spawn), [room, opt("spawn", "")]);
  for (let k = 0; k < 400; k++) {
    const ok = await page.evaluate(() => { const g = window.__world.game; const b = g.room.backdrop; return !g.loading && (!b || b.ready()); });
    if (ok) break;
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__world.advance(1));
  }
}
const x = opt("x", "");
if (x) {
  await page.evaluate((x) => {
    const w = window.__world;
    const o = w.game.room.def.origin ?? [0, 0];
    const px = (x - o[0]) * 80;
    w.place(px, w.game.room.collision.groundAt(px, 0));
  }, +x);
}
const code = opt("eval", "");
if (code) console.log("eval:", JSON.stringify(await page.evaluate(code)));
await page.evaluate((n) => window.__world.advance(n), +opt("ticks", "120"));
const after = opt("after", "");
if (after) {
  console.log("after:", JSON.stringify(await page.evaluate(after)));
  await page.evaluate((n) => window.__world.advance(n), +opt("ticks2", "60"));
}
await page.evaluate(() => window.__world.render());
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out });
const st = await page.evaluate(() => {
  const g = window.__world.game;
  const s = g.state();
  const o = g.room.def.origin ?? [0, 0];
  return { room: s.room, x: +(o[0] + g.player.body.x / 80).toFixed(2), y: +(o[1] - g.player.body.y / 80).toFixed(2), camera: s.camera, mode: s.cameraMode, present: s.present, near: s.near, panel: g.panels.kind, frameMs: s.frameMs, px: g.room.pixel?.props.length };
});
console.log(JSON.stringify(st));
const ov = await page.evaluate(() => (window.__chapelArt ? window.__chapelArt.report().filter((r) => r.visible) : []));
if (ov.length) console.log("thumbs:", JSON.stringify(ov.map((r) => [r.key, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)])));
if (errors.length) console.log("errors:", errors.slice(0, 8).join("\n"));
await browser.close();
