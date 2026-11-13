// The gust acceptance checks (lane R-D; WORLD-PLAN D2): a gust is told at
// least 1 s ahead, and never pushes anyone off.
//   node src/world/rooms/spire/_tools/gusts.mjs [--port 24501]
// 1. Tell lead: over three gust cycles, the time from the tell starting (the
//    pennants start to snap: STORM.gust.tell > 0.05) to the push starting.
// 2. Safety: standing still (no input) on every catwalk, at its middle and
//    right against its downwind stop (the lip or the next flight's machinery),
//    for two full cycles: the feet stay on the catwalk's height, never cross
//    the stop, no pit is taken.
// 3. Walking into the wind and with it through a gust on each catwalk: no fall.
// 4. The secret: from row 70's lip, jump + double jump + air dash to the lone
//    perch (2.8 H), and that the catch ledge below it is there.
// Writes review/world/phase2/R-D/gusts.json.
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const i = process.argv.indexOf("--port");
const PORT = i >= 0 ? process.argv[i + 1] : "24501";
mkdirSync("review/world/phase2/R-D", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const ev = (fn, a) => page.evaluate(fn, a);
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&mute&room=D2&spawn=lift`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__world);
for (let k = 0; k < 300 && (await ev(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await ev(() => window.__world.advance(1));
}
await ev(() => window.__world.begin());
for (let k = 0; k < 400; k++) {
  if (await ev(() => { const g = window.__world.game; return !g.trans && g.room.backdrop.ready(); })) break;
  await page.waitForTimeout(80);
  await ev(() => window.__world.advance(1));
}
const report = {};

// 1. the tell's lead over three cycles (ticks at 60 Hz)
report.lead = await ev(async () => {
  const w = window.__world;
  const mod = await import("/src/pixel/props/spire/storm.ts");
  const leads = [];
  let tellAt = -1, prevTell = 0, prevLevel = 0;
  for (let t = 0; t < 60 * 9 * 3 + 60; t++) {
    w.game.realTick();
    const g = mod.STORM.gust;
    if (g.tell > 0.05 && prevTell <= 0.05 && g.level <= 0) tellAt = t;
    if (g.level > 0 && prevLevel <= 0 && tellAt >= 0) {
      leads.push(+((t - tellAt) / 60).toFixed(2));
      tellAt = -1;
    }
    prevTell = g.tell;
    prevLevel = g.level;
  }
  return { leadsS: leads, min: Math.min(...leads) };
});

// 2 + 3. every catwalk: stand in the middle and against the stop through two cycles; walk both ways through a gust
report.decks = await ev(() => {
  const w = window.__world;
  const g = w.game;
  const storm = g.room.props.find((p) => p.recipe === "spire-storm");
  const decks = storm.decks;
  const out = [];
  let pits = 0;
  const trans = () => { if (g.trans && g.trans.kind === "pit") pits++; };
  for (const d of decks) {
    const r = { y: d.y, x0: d.x0, x1: d.x1, stop: d.stop, standing: [], walking: [] };
    const spots = [(d.x0 + (Number.isFinite(d.stop) ? d.stop : d.x1)) / 2, (Number.isFinite(d.stop) ? d.stop : d.x1) - 24];
    for (const x of spots) {
      w.place(x, d.y);
      let maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (let t = 0; t < 60 * 18; t++) {
        g.realTick();
        trans();
        const b = g.player.body;
        maxX = Math.max(maxX, b.x);
        minY = Math.min(minY, b.y);
        maxY = Math.max(maxY, b.y);
      }
      r.standing.push({ from: +x.toFixed(1), maxX: +maxX.toFixed(1), overStop: Number.isFinite(d.stop) ? +(maxX - d.stop).toFixed(1) : null, dropPx: +(maxY - d.y).toFixed(1) });
    }
    // (row 76's west end is the way on to the Crown: walking off it leaves the room)
    for (const dir of d.x0 <= 1 ? ["right"] : ["left", "right"]) {
      w.place((d.x0 + (Number.isFinite(d.stop) ? d.stop : d.x1)) / 2, d.y);
      let maxY = -1e9;
      w.press(dir);
      for (let t = 0; t < 60 * 5; t++) {
        g.realTick();
        trans();
        maxY = Math.max(maxY, g.player.body.y);
      }
      w.release(dir);
      r.walking.push({ dir, dropPx: +(maxY - d.y).toFixed(1) });
    }
    out.push(r);
  }
  return { decks: out, pits };
});

// 4. the secret: dash across from row 70's lip to the perch
await ev(() => window.__world.teleport("D2", "lift"));
for (let k = 0; k < 400; k++) {
  if (await ev(() => { const g = window.__world.game; return !g.trans && g.room.def.id === "D2" && g.room.backdrop.ready(); })) break;
  await page.waitForTimeout(80);
  await ev(() => window.__world.advance(1));
}
report.secret = await ev(() => {
  const w = window.__world;
  const g = w.game;
  const o = g.room.def.origin;
  const X = (wx) => (wx - o[0]) * 80, Y = (wy) => (o[1] - wy) * 80;
  const results = [];
  for (const dashAt of [8, 14, 20]) {
    // a run-up west along row 52, a jump off its open end, the double jump at the top, then the air dash
    w.place(X(258), Y(52));
    for (let t = 0; t < 20; t++) g.realTick();
    w.press("left");
    let t = 0;
    while (o[0] + g.player.body.x / 80 > 252.15 && t++ < 400) g.realTick();
    w.press("jump");
    for (let k = 0; k < 16; k++) g.realTick();
    w.release("jump");
    for (let k = 0; k < 3; k++) g.realTick();
    w.press("jump");
    for (let k = 0; k < dashAt; k++) g.realTick();
    w.release("jump");
    w.press("m2");
    for (let k = 0; k < 4; k++) g.realTick();
    w.release("m2");
    for (let k = 0; k < 90; k++) g.realTick();
    w.release("left");
    for (let k = 0; k < 20; k++) g.realTick();
    const b = g.player.body;
    const ex = o[0] + b.x / 80, ey = o[1] - b.y / 80;
    results.push({ dashAfterTicks: dashAt, x: +ex.toFixed(2), y: +ey.toFixed(2), onPerch: Math.abs(ey - 52) < 0.05 && ex < 249.2, onCatch: Math.abs(ey - 51) < 0.05 });
  }
  // and back up from the catch ledge: a double jump onto row 52
  w.place(X(249), Y(51));
  for (let t = 0; t < 20; t++) g.realTick();
  w.press("right");
  for (let k = 0; k < 90 && o[0] + g.player.body.x / 80 < 252.1; k++) g.realTick();
  w.release("right");
  w.press("jump");
  for (let k = 0; k < 14; k++) g.realTick();
  w.release("jump");
  for (let k = 0; k < 3; k++) g.realTick();
  w.press("jump");
  for (let k = 0; k < 14; k++) g.realTick();
  w.release("jump");
  for (let k = 0; k < 60; k++) g.realTick();
  results.push({ backUp: +(o[1] - g.player.body.y / 80).toFixed(2) });
  return results;
});
writeFileSync("review/world/phase2/R-D/gusts.json", JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
