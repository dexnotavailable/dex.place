// The colossus's footfall in a region B room, measured and recorded (lane R-B):
//   node src/world/rooms/plain/_tools/footfall.mjs --room B1 --spawn channel-east --x 95.3 --plants reeds-3,reeds-5 [--reduced 1] [--gif 1]
// Steps the game in manual mode until the colossus's big plant (the one per
// pass whose ring crosses the water), then records: the camera shake it
// causes (whole-pixel offsets, per tick), the wash (the room's reeds or grass:
// their mean lean before and after the ring reaches the player plane), the
// times (plant, wash) on the backdrop clock, and a GIF of the moment.
// Writes review/world/phase2/R-B/footfall/<room>[-reduced].json (+ .gif).
import { createRequire } from "node:module";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24301");
const ROOM = arg("room", "B1");
const REDUCED = arg("reduced", "0") === "1";
const GIF = arg("gif", "1") === "1";
const PLANTS = arg("plants", "").split(",").filter(Boolean);
const FFMPEG = process.env.FFMPEG ?? "D:/Dex/Tools/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe";
const OUT = "review/world/phase2/R-B/footfall";
const tag = `${ROOM}${REDUCED ? "-reduced" : ""}`;
const FR = `${OUT}/frames-${tag}`;
mkdirSync(OUT, { recursive: true });
rmSync(FR, { recursive: true, force: true });
mkdirSync(FR, { recursive: true });

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: REDUCED ? "reduce" : "no-preference" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ev = (fn, a) => page.evaluate(fn, a);
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
for (let k = 0; k < 300 && (await ev(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await ev(() => window.__world.advance(1));
}
await ev(() => window.__world.begin());
await ev(([r, s]) => window.__world.teleport(r, s), [ROOM, arg("spawn", "west")]);
for (let k = 0; k < 300; k++) {
  if (await ev(() => { const b = window.__world.game.room.backdrop; return !window.__world.game.trans && (!b || b.ready()); })) break;
  await ev(() => window.__world.advance(1));
  await page.waitForTimeout(50);
}
const x = arg("x", null);
if (x !== null) await ev((x) => { const w = window.__world; const o = w.game.room.def.origin ?? [0, 0]; const px = (x - o[0]) * 80; w.place(px, w.game.room.collision.groundAt(px, w.game.player.body.y - 80 * 3)); }, +x);
await ev(() => window.__world.advance(30));

/** One tick: real tick, and what we measure. */
const probe = (ids) => {
  const g = window.__world.game;
  g.realTick();
  const P = globalThis.__plain;
  const lean = (id) => {
    const p = g.room.pixel?.world.find(id);
    const st = p?.refs?.stems ?? p?.refs?.blades;
    if (!st) return null;
    return st.reduce((n, s) => n + Math.abs(s.lean - s.rest), 0) / st.length;
  };
  return { t: P?.t ?? 0, log: P?.log.length ?? 0, off: [g.camera.offX, g.camera.offY], lean: ids.map(lean), reduced: g.reduced };
};
// 1: run until a big plant is logged (at most two loops of the walk)
const start = await ev(() => globalThis.__plain?.log.length ?? 0);
let plantAt = null;
for (let i = 0; i < 60 * 220 && plantAt === null; i += 60) {
  plantAt = await ev(([n, start]) => {
    for (let k = 0; k < n; k++) {
      window.__world.game.realTick();
      const L = globalThis.__plain?.log ?? [];
      for (let j = start; j < L.length; j++) if (L[j].id === "big-plant") return { t: L[j].t, x: L[j].x };
    }
    return null;
  }, [60, start]);
}
if (!plantAt) throw new Error("no big plant within two loops");
// 2: the next pass: step to 1.2 s before its big plant, then record 5 s tick by tick
const report = { room: ROOM, reduced: REDUCED, firstPlant: plantAt, ticks: [], events: [], errors };
// find the loop period from the feed through the keeper's walker: simpler, wait for the next big plant
const next = await ev(([t0]) => {
  const g = window.__world.game;
  for (let k = 0; k < 60 * 200; k++) {
    g.realTick();
    const hit = globalThis.__plain.log.find((e) => e.id === "big-plant" && e.t > t0 + 1);
    if (hit) return { t: hit.t, k };
  }
  return null;
}, [plantAt.t]);
report.period = next ? +(next.t - plantAt.t).toFixed(2) : null;
// now step to 1.2 s before the following one
if (!report.period) throw new Error("no second plant");
const target = next.t + report.period - 1.2;
await ev((target) => { const g = window.__world.game; for (let k = 0; k < 60 * 200 && globalThis.__plain.t < target; k++) g.realTick(); }, target);
const log0 = await ev(() => globalThis.__plain.log.length);
for (let i = 0; i < 60 * 5; i++) {
  const r = await ev(probe, PLANTS);
  report.ticks.push(r);
  if (GIF && i % 3 === 0) {
    await ev(() => window.__world.render());
    await page.screenshot({ path: `${FR}/${String(i / 3).padStart(4, "0")}.png` });
  }
}
report.events = await ev((n) => globalThis.__plain.log.slice(n), log0);
const big = report.events.find((e) => e.id === "big-plant");
const wash = report.events.find((e) => e.type === "wash");
const shakeTicks = report.ticks.filter((k) => k.off[0] !== 0 || k.off[1] !== 0);
const maxOff = Math.max(0, ...report.ticks.map((k) => Math.max(Math.abs(k.off[0]), Math.abs(k.off[1]))));
const leanAt = (t0, t1) => {
  const xs = report.ticks.filter((k) => k.t >= t0 && k.t < t1).map((k) => k.lean.filter((v) => v !== null).reduce((a, b) => a + b, 0) / Math.max(1, k.lean.filter((v) => v !== null).length));
  return xs.length ? +Math.max(...xs).toFixed(3) : null;
};
report.summary = {
  bigPlantAt: big?.t ?? null,
  washAt: wash?.t ?? null,
  washDelay: big && wash ? +(wash.t - big.t).toFixed(2) : null,
  shake: { maxPx: maxOff, ticks: shakeTicks.length },
  leanBeforeWash: wash ? leanAt(wash.t - 0.8, wash.t) : null,
  leanAfterWash: wash ? leanAt(wash.t, wash.t + 1.4) : null,
};
report.ticks = report.ticks.filter((_, i) => i % 3 === 0);
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ period: report.period, summary: report.summary, errors }, null, 1));
if (GIF) {
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", "20", "-i", `${FR}/%04d.png`, "-vf", "scale=960:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=none", `${OUT}/${tag}.gif`]);
  console.log(`${OUT}/${tag}.gif`);
}
await browser.close();
