// Batch screenshots of region E rooms in one browser (lane R-E):
//   node src/world/rooms/chapel/_tools/shots.mjs <outDir> [--port 28700] [--only E1,E3] [--phone] [--soft]
// GPU (d3d11, Edge headless) by default; --soft uses SwiftShader. Each shot teleports to the room,
// places the player at world x (H), runs the simulation, renders and saves <outDir>/<name>.png.
// Shots are grouped by save flags (one page per flag set). Prints state and errors per shot.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(process.env.PW_ROOT ?? "D:/Dex/Temp/dexplace-site-research/package.json");
const { chromium } = require("playwright-core");
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const out = args[0];
const PORT = opt("port", "28700");
const ONLY = opt("only", "") ? opt("only").split(",") : null;
const PHONE = args.includes("--phone");
const SOFT = args.includes("--soft");
mkdirSync(out, { recursive: true });

const LIT = ["shrine:1", "shrine:2", "shrine:3", "shrine:4", "shrine:5", "shrine:6"];
/** name, room, spawn, x (H), flags, extra ticks */
const SHOTS = [
  ["E1-top", "E1", "west", 318.5, LIT],
  ["E1-gap", "E1", "west", 333.5, LIT],
  ["E1-rib", "E1", "west", 341.1, LIT],
  ["E1-shrine", "E1", "shrine", 355.0, LIT],
  ["E1-shrine-dark", "E1", "shrine", 355.0, []],
  ["E1-lamps", "E1", "east", 372.0, LIT],
  ["E1-bottom", "E1", "east", 392.0, LIT],
  ["E2-west", "E2", "west", 397.6, LIT],
  ["E2-door", "E2", "chapel", 405.5, LIT],
  ["E3-west", "E3", "west", 414.0, []],
  ["E3-mid", "E3", "west", 430.0, []],
  ["E3-east", "E3", "east", 449.0, []],
  ["E3-west-open", "E3", "west", 414.0, ["rose:open"]],
  ["E3-mid-open", "E3", "west", 432.0, ["rose:open"]],
  ["E3-east-open", "E3", "east", 450.5, ["rose:open"]],
  ["E4-foot", "E4", "west", 461.0, LIT],
  ["E4-landing", "E4", "west", 469.0, LIT],
  ["E4-balcony", "E4", "balcony", 482.0, LIT],
];
const PHONE_SHOTS = [
  ["phone-E1-shrine", "E1", "shrine", 355.0, LIT],
  ["phone-E2", "E2", "west", 400.0, LIT],
  ["phone-E3", "E3", "west", 430.0, ["rose:open"]],
  ["phone-E4", "E4", "balcony", 482.0, LIT],
];
const list = (PHONE ? PHONE_SHOTS : SHOTS).filter((s) => !ONLY || ONLY.includes(s[1]) || ONLY.includes(s[0]));
const GL = SOFT ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
const browser = await chromium.launch({ channel: "msedge", headless: true, args: [...GL, "--autoplay-policy=no-user-gesture-required"] });
const groups = new Map();
for (const s of list) {
  const k = s[4].join(",");
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(s);
}
for (const [key, shots] of groups) {
  const flags = key ? key.split(",") : [];
  const ctx = await browser.newContext(PHONE ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.addInitScript((fl) => {
    // the rose window keeps its own state (prop persistence) beside the flag: an opened save has both
    const props = fl.includes("rose:open") ? { "rose-window": { open: true }, "rose-crank": { done: true } } : {};
    const d = { v: 1, flags: Object.fromEntries(fl.map((k) => [k, true])), rest: null, sound: false, props };
    localStorage.setItem("dex.world.v1", JSON.stringify(d));
  }, flags);
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&mute`, { waitUntil: "load", timeout: 240000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 240000 });
  for (let k = 0; k < 600 && (await page.evaluate(() => window.__world.game.loading)); k++) {
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__world.advance(1));
  }
  await page.evaluate(() => window.__world.begin());
  for (const [name, room, spawn, x, , ticks] of shots) {
    await page.evaluate(([id, sp]) => window.__world.teleport(id, sp), [room, spawn]);
    for (let k = 0; k < 600; k++) {
      const ok = await page.evaluate(() => { const g = window.__world.game; const b = g.room.backdrop; return !g.loading && (!b || b.ready()); });
      if (ok) break;
      await page.waitForTimeout(100);
      await page.evaluate(() => window.__world.advance(1));
    }
    await page.evaluate((x) => {
      const w = window.__world;
      const o = w.game.room.def.origin ?? [0, 0];
      const px = (x - o[0]) * 80;
      w.place(px, w.game.room.collision.groundAt(px, 0));
    }, x);
    await page.evaluate((n) => window.__world.advance(n), ticks ?? 240);
    await page.evaluate(() => window.__world.render());
    // the gallery's thumbnails are real <img>s: let the ones in view finish decoding before the shot
    await page.waitForFunction(() => [...document.querySelectorAll("#chapel-art img")].every((i) => i.style.visibility === "hidden" || (i.complete && i.naturalWidth > 0)), null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => window.__world.render());
    await page.screenshot({ path: `${out}/${name}.png` });
    const st = await page.evaluate(() => {
      const g = window.__world.game;
      const s = g.state();
      const o = g.room.def.origin ?? [0, 0];
      return { room: s.room, x: +(o[0] + g.player.body.x / 80).toFixed(2), y: +(o[1] - g.player.body.y / 80).toFixed(2), near: s.near, frameMs: s.frameMs };
    });
    console.log(name, JSON.stringify(st), errors.length ? `errors: ${errors.splice(0).slice(0, 4).join(" | ")}` : "");
  }
  await ctx.close();
}
await browser.close();
