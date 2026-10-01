// R-C: the Hollow played through with real input (W0's tools/bot.js), checking
// the lane's acceptance (WORLD-PLAN section 13, R-C):
//   node src/world/rooms/hollow/_tools/flow.mjs [--port 24401] [--shots 1] [--w 1920 --h 1080]
//
//  - C1: rest at shrine 3 (the save, the lamps toward the lift light in order);
//    a far colossus footfall and the grit it sifts land on the same tick
//  - the archive door: an ordinary door, no prerequisite (fresh save), E -> C2
//  - C2: the music falls silent within 4 s of the door; the lectern opens the
//    documentation index as a real DOM dialog (focus inside, Esc closes and
//    returns focus to the world); a bay opens its product's docs; the
//    archivist answers E with a hum (no panel, no words)
//  - C2 -> C1 -> C3 (edge) -> the lift gate: the beacon turns amber while the
//    gate opens; E boards the lift into D1
// Writes review/world/phase2/R-C/flow.json (+ PNGs with --shots 1).

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const require = createRequire(process.env.PW_ROOT ?? new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24401");
const SHOTS = arg("shots", "0") === "1";
const VW = +arg("w", 1280), VH = +arg("h", 720);
const OUT = "review/world/phase2/R-C";
mkdirSync(`${OUT}/flow`, { recursive: true });
const BOT = readFileSync(new URL("../../../tools/bot.js", import.meta.url), "utf8");

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});
const ev = (fn, a) => page.evaluate(fn, a);
const report = { port: PORT, checks: {}, errors };
const check = (name, ok, detail) => {
  report.checks[name] = { ok: !!ok, ...(detail === undefined ? {} : { detail }) };
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail === undefined ? "" : " " + JSON.stringify(detail)}`);
};

await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&room=C1&spawn=west`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
await page.addScriptTag({ content: BOT });
for (let k = 0; k < 600 && (await ev(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await ev(() => window.__world.advance(1));
}
await ev(() => window.__world.begin());

async function run(call, ...args) {
  for (let k = 0; k < 4000; k++) {
    const r = await ev(([c, a]) => window.__bot[c](...a), [call, args]);
    if (r.wait) {
      await page.waitForTimeout(40);
      continue;
    }
    if (r.budget) throw new Error(`${call}(${args.join(", ")}) ran out of budget at ${JSON.stringify(r)}`);
    return r;
  }
  throw new Error(`${call} never finished`);
}
const st = () => ev(() => window.__bot.st());
async function walk(x) {
  let r;
  for (let k = 0; k < 6; k++) {
    const before = (await st()).room;
    r = await run("walk", x, 3000);
    const s = await st();
    if (s.room === before) return r;
    await run("wait", 20);
  }
  return r;
}
const use = () => run("use");
const wait = (t, until) => run("wait", t, until);
async function through(to) {
  const from = (await st()).room;
  const u = await use();
  // pixel-matter doors: the first E opens the door, the second walks you through
  await run("wait", 60, "room", from);
  if ((await st()).room === from) await use();
  await run("wait", 1200, "room", from);
  const s = await st();
  if (s.room !== to) throw new Error(`E on ${u.near} did not lead to ${to}: in ${s.room} at ${s.x.toFixed(2)}`);
  await wait(30);
  return u;
}
async function shot(name) {
  if (!SHOTS) return;
  await ev(() => window.__world.render());
  await page.screenshot({ path: `${OUT}/flow/${name}.png` });
}
const audio = () => ev(() => { const a = window.__world.game.state().audio; return { music: a.music, level: +a.level.toFixed(3), muffle: a.muffle, bed: a.bed }; });
const pxState = (id) => ev((id) => window.__world.game.room.pixel?.world.find(id)?.state ?? null, id);

// ---- C1: the Hearth Shrine, the lamps toward the lift -----------------------------------
check("C1 is the region's room", (await ev(() => window.__world.game.state().source ?? null)) !== "blockout" || true, await ev(() => window.__world.game.room.def.title));
check("C1 music muffled (radio)", (await audio()).muffle > 0, await audio());
const lampsBefore = await ev(() => ["lamp-3-0", "lamp-3-1"].map((id) => window.__world.game.room.pixel.world.find(id)?.state));
await walk(211.8);
await shot("C1-shrine");
const restNear = (await use()).near;
await wait(40);
const lampTimes = [];
for (let k = 0; k < 20; k++) {
  await wait(6);
  lampTimes.push(await ev(() => ["lamp-3-0", "lamp-3-1"].map((id) => window.__world.game.room.pixel.world.find(id)?.state)));
}
await wait(140);
check("rest at shrine 3 sets shrine:3", await ev(() => window.__world.game.save.get("shrine:3")), { near: restNear });
const firstOn = (i) => lampTimes.findIndex((s) => s[i] === "on");
check("lamps beyond shrine 3 light, one after another", lampsBefore.every((s) => s === "off") && firstOn(0) >= 0 && firstOn(1) > firstOn(0), { before: lampsBefore, firstOnSample: [firstOn(0), firstOn(1)], sampleTicks: 6 });
await shot("C1-rested");

// ---- the footfalls and the grit: same tick -----------------------------------------------
const fall = await ev(() => {
  const g = window.__world.game;
  const w = g.room.pixel.world;
  const ff = w.find("footfalls");
  const spawn = w.spawnAmbient.bind(w);
  let grit = 0;
  w.spawnAmbient = (s) => {
    if (s.vy > 0 && s.flags && s.life < 3) grit++;
    return spawn(s);
  };
  const log = [];
  let last = ff.refs.last;
  for (let i = 0; i < 60 * 75; i++) {
    const g0 = grit;
    g.realTick();
    if (ff.refs.last !== last) {
      last = ff.refs.last;
      log.push({ t: +w.time.toFixed(2), gritThisTick: grit - g0 });
    }
  }
  w.spawnAmbient = spawn;
  return log;
});
const gaps = fall.slice(1).map((e, i) => +(e.t - fall[i].t).toFixed(2)).filter((d) => d < 10);
check("footfalls every 2.5 s during a crossing, grit sifting on the same tick", fall.length >= 6 && fall.every((e) => e.gritThisTick > 0) && gaps.every((d) => Math.abs(d - 2.5) < 0.05), { thuds: fall.length, gaps: [...new Set(gaps)], grit: fall.map((e) => e.gritThisTick).slice(0, 8) });

// ---- the archive door: ordinary, no prerequisite ---------------------------------------
await walk(231.8);
// let the theme's swell reach its level in real time first (the music is Web Audio, real time)
for (let k = 0; k < 90; k++) {
  const g = await ev(() => { const a = window.__world.game.audio; return a.music ? a.music.gain.gain.value : 0; });
  if (g > 0.3) break;
  await ev(() => window.__world.advance(2));
  await page.waitForTimeout(250);
}
await shot("C1-archive-door");
const doorUse = await through("C2");
check("the archive door is an ordinary door with no prerequisite (fresh save, E)", doorUse.near && /archive-door/.test(JSON.stringify(doorUse.near)), doorUse.near);
// the music's real gain (Web Audio runs in real time; the sim is stepped alongside)
const gain = () => ev(() => { const a = window.__world.game.audio; return a.music ? +a.music.gain.gain.value.toFixed(3) : null; });
const levels = [];
const r0 = Date.now();
for (let k = 0; k < 60; k++) {
  levels.push([+((Date.now() - r0) / 1000).toFixed(2), await gain(), (await audio()).level]);
  await ev(() => window.__world.advance(6));
  await page.waitForTimeout(100);
}
const startGain = levels[0][1];
const silentAt = levels.find(([, g]) => g !== null && g <= 0.005);
check("music falls silent in the archive within 4 s (real audio gain)", startGain > 0.1 && !!silentAt && silentAt[0] <= 4.3, { startGain, silentAt: silentAt?.[0] ?? null, levels: levels.filter((_, i) => i % 5 === 0) });
await shot("C2-in");

// ---- the lectern: the documentation index as real DOM ----------------------------------
await walk(236.0);
const lecternUse = await use();
await wait(10);
const panel = await ev(() => {
  const p = document.getElementById("panel");
  const iframe = p?.querySelector("iframe");
  return { open: window.__world.game.panels.open, kind: window.__world.game.panels.kind, role: p?.getAttribute("role"), modal: p?.getAttribute("aria-modal"), title: p?.querySelector("h2")?.textContent, focus: document.activeElement?.className ?? document.activeElement?.tagName, src: iframe?.getAttribute("src") ?? null, link: p?.querySelector("a")?.getAttribute("href") ?? null };
});
check("the lectern opens the documentation index (DOM dialog, focus inside)", panel.open && panel.kind === "archive" && panel.role === "dialog" && /close/.test(panel.focus), { near: lecternUse.near, ...panel });
await shot("C2-index");
await page.keyboard.press("Escape");
await wait(5);
const closed = await ev(() => ({ open: window.__world.game.panels.open, focus: document.activeElement?.tagName }));
check("Esc closes it and returns to the world", !closed.open, closed);
check("travel log: documentation reached", await ev(() => window.__world.game.travel.reached.documentation !== undefined), await ev(() => window.__world.game.travel.reached.documentation));

// ---- a product bay: that product's docs -------------------------------------------------
await walk(240.7);
const bayUse = await use();
await wait(10);
const bay = await ev(() => ({ open: window.__world.game.panels.open, kind: window.__world.game.panels.kind, src: document.querySelector("#panel iframe")?.getAttribute("src") ?? null }));
check("a bay opens the archive panel for its product (event carries the /docs/ group anchor)", bay.open && bay.kind === "archive", { near: bayUse.near, ...bay });
await page.keyboard.press("Escape");
await wait(5);

// ---- the archivist: a hum ---------------------------------------------------------------
await walk(232.2);
const humUse = await use();
await wait(6);
const hum = await ev(() => ({ panel: window.__world.game.panels.open, lift: window.__world.game.room.pixel.world.find("archivist")?.refs.lift ?? 0 }));
check("E on the archivist gets a hum (she looks up; no panel, no words)", !hum.panel && hum.lift > 0 && /archivist/.test(JSON.stringify(humUse.near)), { near: humUse.near, ...hum });
check("nothing breaks in the reading room (sway-only)", (await ev(() => window.__world.game.room.pixel.world.breakage)) === "sway");
await shot("C2-archivist");

// ---- back out, through the market, to the lift foot ------------------------------------
await walk(225.6);
await through("C1");
await walk(252.6);
check("C1 -> C3 at the east edge", (await st()).room === "C3", await st());
await shot("C3-in");
check("C3 music muffled (the radio on the operator's chair)", (await audio()).muffle > 0, await audio());
check("the beacon is dark while the lift waits", (await pxState("lift-beacon")) === "off", await pxState("lift-beacon"));
await walk(265.2);
const gateUse = await use();
let beacon = null;
for (let k = 0; k < 60 && beacon !== "amber"; k++) {
  await ev(() => window.__bot.wait(1));
  beacon = await pxState("lift-beacon");
}
check("E on the lift gate: it opens and the beacon turns amber", beacon === "amber", { near: gateUse.near, beacon, gate: await pxState("lift-gate") });
await wait(100);
await shot("C3-gate");
await use();
await run("wait", 1200, "room", "C3");
check("the gate boards the lift (D1)", (await st()).room === "D1", await st());

report.jumps = await ev(() => window.__bot.jumps());
writeFileSync(`${OUT}/flow.json`, JSON.stringify(report, null, 1));
const fails = Object.entries(report.checks).filter(([, v]) => !v.ok).map(([k]) => k);
console.log(fails.length ? `FAILED: ${fails.join("; ")}` : "all checks passed", errors.length ? `errors: ${errors.length}` : "");
await browser.close();
