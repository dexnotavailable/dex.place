// The round, end to end, in the grey-box (lane W0's acceptance):
//   node src/world/tools/round.mjs [--port 24001] [--shots 1] [--w 1920 --h 1080]
//
// 1. A first round from the dock through every room of WORLD-PLAN section 3
//    to the chapel, the balcony latch, the sky door home and Pier's End,
//    using real input (bot.js): resting at all six shrines, cutting the map
//    cord and the rope bridge, the culvert lever, the crane hook, the lift,
//    the terminal, the express lever, the latch. Times come from the game's
//    travel-time logger (simulation seconds since Enter).
// 2. A reload: every flag of section 11 must still be set.
// 3. Returning-visitor runs from the dock through the shortcuts (the ferry,
//    the express lift, the sky door), each timed.
// 4. The website scroll-away in every room.
// Writes review/world/phase2/W0/round.json (and PNGs with --shots 1).

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24001");
const SHOTS = arg("shots", "0") === "1";
const VW = +arg("w", 1280), VH = +arg("h", 720);
const OUT = "review/world/phase2/W0";
mkdirSync(`${OUT}/round`, { recursive: true });
const BOT = readFileSync(new URL("./bot.js", import.meta.url), "utf8");

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});
const ev = (fn, a) => page.evaluate(fn, a);
const log = [];
const note = (s) => {
  log.push(s);
  console.log(s);
};

async function open(query) {
  await page.goto(`http://127.0.0.1:${PORT}/world/?${query}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  await page.addScriptTag({ content: BOT });
  for (let k = 0; k < 400; k++) {
    if (!(await ev(() => window.__world.game.loading))) break;
    await page.waitForTimeout(100);
    await ev(() => window.__world.advance(1));
  }
}

/** Run a bot call to completion, waiting in real time while a room compiles. */
async function run(call, ...args) {
  for (let k = 0; k < 4000; k++) {
    const r = await ev(([c, a]) => window.__bot[c](...a), [call, args]);
    if (r.wait) {
      await page.waitForTimeout(40);
      continue;
    }
    if (r.budget) {
      const s = await ev(() => { const g = window.__world.game; const s = g.state(); return { ...s, travel: undefined, save: undefined, solidsNear: g.room.collision.solids.filter((q) => Math.abs(q.x + q.w / 2 - g.player.body.x) < 200).map((q) => [q.x, q.y, q.w, q.h, q.id]), onesNear: g.room.collision.oneWays.filter((q) => Math.abs(q.x - g.player.body.x) < 300).map((q) => [q.x, q.y, q.w, q.id]) }; });
      throw new Error(`${call}(${args.join(", ")}) ran out of budget at ${JSON.stringify(r)}
${JSON.stringify(s).slice(0, 3000)}`);
    }
    return r;
  }
  throw new Error(`${call} never finished`);
}
const st = () => ev(() => window.__bot.st());
/** Walk to world x, through edge exits on the way (a room change ends one bot walk; keep going). */
async function walk(x, o = {}) {
  let r;
  for (let k = 0; k < 8; k++) {
    const before = (await st()).room;
    r = await run("walk", x, 3000, o);
    const s = await st();
    if (s.room === before) return r;
    await wait(20);
    const d = await st();
    // a new room: stop if the target was the edge itself (it lies outside this room), else carry on
    const ox = await ev(() => { const d = window.__world.game.room.def; return [d.origin?.[0] ?? 0, (d.origin?.[0] ?? 0) + d.w / 80]; });
    if (x < ox[0] || x > ox[1] || Math.abs(d.x - x) < 0.3) return r;
  }
  return r;
}
const use = () => run("use");
const wait = (t, until) => run("wait", t, until);
async function expectRoom(id) {
  const s = await st();
  if (s.room !== id) throw new Error(`expected room ${id}, in ${s.room} at ${s.x.toFixed(1)}, ${s.y.toFixed(1)}`);
}
async function shot(name) {
  if (!SHOTS) return;
  await ev(() => window.__world.render());
  await page.screenshot({ path: `${OUT}/round/${name}.png` });
}
/** Go through a door or onto a ride: E, then wait for the next room. */
async function through(to) {
  const from = (await st()).room;
  const u = await use();
  await run("wait", 1200, "room", from);
  const s = await st();
  if (s.room !== to) throw new Error(`E on ${u.near} did not lead to ${to}: in ${s.room} at ${s.x.toFixed(2)}, ${s.y.toFixed(2)}`);
  await wait(30);
}
const travel = () => ev(() => window.__world.game.travel);
/** The music machine's state here (not a listening test: Dex's ears are the approval). */
const audio = {};
async function sound(label) {
  audio[label] = await ev(() => { const g = window.__world.game; const a = g.state().audio; return { room: g.room.def.id, area: g.area?.id ?? null, music: a.music, level: +a.level.toFixed(2), muffle: a.muffle, bed: a.bed, entries: a.entries, lastEntry: a.lastEntry, cue: +g.audio.cueTime().toFixed(1) }; });
}

const report = { port: PORT, first: {}, reload: {}, returning: {}, scroll: {}, errors };

// ------------------------------------------------------------------------------------
// 1. the first round
await open("manual&fresh");
await ev(() => window.__world.begin());
await shot("A1-start");
note("A1 dock -> A2");
await walk(34.5);
await expectRoom("A2");
await walk(45.3);
await shot("A2-top");
await sound("A2 after the swell");
await through("A3");
note("A3 lodge: counter, donation box, yard door");
await walk(50.6);
await walk(55.0);
await shot("A3-lodge");
await sound("A3 lodge (muffled)");
await walk(59.0);
await through("A4");
note("A4 yard: shrine 1, the map banner");
await walk(69.0);
await walk(64.0);
await use();
await wait(120);
await walk(68.2);
await run("slash", 1);
await wait(200);
report.first.mapBanner = await ev(() => window.__world.game.state().pixel.find((p) => p.id === "map-banner"));
await shot("A4-banner");
await walk(76.4);
await expectRoom("B1");
note("B1 reeds: wade the channel, cut the bridge from the east bank");
await walk(97.2);
report.first.wadingInChannel = await ev(() => window.__world.game.wading);
await walk(98.9);
await run("slash", -1);
await wait(90);
await shot("B1-bridge");
report.first.bridgeCut = await ev(() => window.__world.game.save.get("cut:rope-bridge"));
await walk(108.4);
await expectRoom("B2");
note("B2 causeway: the break, the crater, the wade, the shelter (shrine 2)");
await walk(161.0);
await use();
await wait(120);
await shot("B3-shelter");
await walk(172.4);
await expectRoom("B5");
note("B5 hollow mouth: the culvert lever, the crane hook down");
await walk(182.6);
await use();
await wait(30);
report.first.culvert = await ev(() => window.__world.game.save.get("lever:culvert"));
await walk(186.4);
await use();
await wait(900, "idle");
await shot("B5-bottom");
await sound("B5 mouth");
await walk(188.4);
await expectRoom("C1");
note("C1 market: shrine 3, the archive");
await walk(212.0);
await use();
await wait(120);
await walk(231.8);
await through("C2");
report.first.c2 = [(await travel()).t];
await walk(236.2);
report.first.c2.push((await travel()).t, await st());
await wait(250);
await sound("C2 archive (silence)");
await shot("C2-archive");
await walk(225.6);
await through("C1");
await walk(252.4);
await expectRoom("C3");
note("C3 lift foot -> D1 lift ride");
await sound("C1 market (muffled)");
await walk(265.2);
await through("D1");
await wait(2000, "idle");
await shot("D1-break");
await walk(268.4);
await expectRoom("D2");
note("D2 outer climb (shrine 4 in the alcove)");
await walk(281.2);
await walk(253.2);
await walk(277.2);
await walk(262.4);
await use();
await wait(120);
await shot("D2-alcove");
await sound("D2 storm alcove");
await walk(249.2);
await walk(271.2);
await walk(245.5);
await expectRoom("D3");
note("D3 crown: the terminal, the express lever");
await walk(255.6);
await use();
await wait(30);
await use();
await wait(600, "panel");
await shot("D3-summon");
report.first.terminal = await ev(() => ({ panel: window.__world.game.panels.kind, pixel: window.__world.game.state().pixel.find((p) => p.id === "terminal") }));
await run("closePanel");
await walk(282.6);
await use();
await wait(30);
report.first.express = await ev(() => window.__world.game.save.get("lever:express"));
await walk(284.4);
await expectRoom("D4");
note("D4 blade");
await walk(300);
await sound("D4 the storm breaks");
await shot("D4-break");
await walk(316.4);
await expectRoom("E1");
note("E1 pilgrim path (shrine 5)");
await walk(357.4);
await use();
await wait(120);
await walk(396.4);
await expectRoom("E2");
note("E2 porch (shrine 6), E3 chapel, E4 balcony");
await walk(399.0);
await use();
await wait(120);
await walk(407.9);
await through("E3");
await walk(444.6);
await shot("E3-chapel");
await sound("E3 chapel (from the top)");
await walk(458.4);
await expectRoom("E4");
await walk(484.4);
await shot("E4-balcony");
await sound("E4 balcony (carries on)");
await through("A3");
report.first.home = await ev(() => ({ latch: window.__world.game.save.get("latch:sky-door"), round: window.__world.game.save.get("round:done") }));
note("A3 loft -> down the stair -> Pier's End");
await walk(53.5);
await walk(47.0);
await walk(46.6);
await through("A2");
await walk(33.6);
await expectRoom("A1");
await walk(-0.4);
await expectRoom("A0");
await walk(-12);
await use();
await wait(150);
await shot("A0-home");
report.first.sitting = await ev(() => window.__world.game.sitting);
const t1 = await travel();
report.first.time = +t1.t.toFixed(1);
report.first.reached = t1.reached;
report.first.rooms = t1.events.filter((e) => e.kind === "room" || e.kind === "area").map((e) => `${e.id}@${e.t}`);
report.first.save = await ev(() => window.__world.game.save.data.flags);
report.first.audioHistory = await ev(() => window.__world.game.audio.state.history);
// every jump the first round needed: a ledge (rise) or a gap (width), against the section 1 limits
const jumps = await ev(() => window.__bot.jumps());
report.first.jumps = jumps;
report.first.limits = {
  ledges: jumps.filter((j) => j.why === "ledge").map((j) => j.rise),
  maxLedgeRise: Math.max(0, ...jumps.filter((j) => j.why === "ledge").map((j) => j.rise)),
  gaps: jumps.filter((j) => j.why === "gap").map((j) => j.gap),
  maxGap: Math.max(0, ...jumps.filter((j) => j.why === "gap").map((j) => j.gap ?? 0)),
  ok: jumps.every((j) => (j.why === "ledge" ? j.rise <= 0.9 : (j.gap ?? 0) <= 1.1)),
};

// ------------------------------------------------------------------------------------
// 2. reload: the save keeps every flag
await open("manual");
const flags = await ev(() => window.__world.game.save.data.flags);
const need = ["shrine:1", "shrine:2", "shrine:3", "shrine:4", "shrine:5", "shrine:6", "cut:map-banner", "cut:rope-bridge", "lever:culvert", "lever:express", "blade:cleared", "latch:sky-door", "round:done"];
report.reload = { missing: need.filter((k) => !flags[k]), rest: await ev(() => window.__world.game.save.data.rest), room: (await st()).room };

// ------------------------------------------------------------------------------------
// 3. returning visitor: from the dock through the shortcuts
async function fromDock() {
  await ev(() => window.__bot.releaseAll());
  await ev(() => {
    window.__world.teleport("A1", "start");
    window.__world.game.travel.reset();
  });
  await wait(20);
}
await ev(() => window.__world.begin());
// S1: across the lowered bridge, no wading
await ev(() => window.__world.teleport("B1", "west"));
await wait(20);
await walk(91.6);
let wadedOnBridge = false;
for (let k = 0; k < 40 && !wadedOnBridge; k++) {
  await run("walk", 91.8 + k * 0.17, 200);
  wadedOnBridge = await ev(() => window.__world.game.wading);
}
report.returning.S1 = { waded: wadedOnBridge, at: await st() };
// S2 + documentation: ferry, crane, walk
await fromDock();
await walk(-3.0);
await expectRoom("A0");
await through("S2");
await wait(1400, "idle");
await walk(34.5);
await expectRoom("B5");
await walk(186.4);
await use();
await wait(900, "idle");
await walk(188.4);
await walk(231.8);
await through("C2");
await walk(236.2);
report.returning.documentation = (await travel()).reached.documentation ?? null;
// S3 + downloads: ferry, crane, walk, express lift
await fromDock();
await walk(-3.0);
await through("S2");
await wait(1400, "idle");
await walk(34.5);
await walk(186.4);
await use();
await wait(900, "idle");
await walk(188.4);
await walk(252.4);
await walk(265.2);
await through("D1");
await wait(2400, "idle");
await walk(268.4);
await expectRoom("D3");
await walk(255.6);
report.returning.downloads = (await travel()).reached.downloads ?? null;
// S4 + illustrations: the sky door
await fromDock();
await walk(34.5);
await walk(45.1);
await through("A3");
await run("hop", 1);
await walk(58.4);
await through("E4");
await walk(457.6);
await expectRoom("E3");
await walk(455.0);
report.returning.illustrations = (await travel()).reached.illustrations ?? null;
// account, donate and map as the first time
await fromDock();
await walk(34.5);
await walk(45.1);
await through("A3");
await walk(55.4);
const pnl = await use();
await wait(5);
report.returning.donatePanel = { near: pnl.near, panel: await ev(() => window.__world.game.panels.kind) };
await run("closePanel");
await walk(59.0);
await through("A4");
await walk(70.4);
const tr = await travel();
report.returning.account = tr.reached.account ?? null;
report.returning.donate = tr.reached.donate ?? null;
report.returning.map = tr.reached.map ?? null;

// ------------------------------------------------------------------------------------
// 4. the website scroll-away from every room
await page.setViewportSize({ width: 1280, height: 720 });
const ids = await ev(() => window.__world.game.roomIds().filter((id) => !["arrival", "plain", "house"].includes(id)));
for (const id of ids) {
  await ev((id) => window.__world.teleport(id, ""), id);
  await wait(10);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(120);
  const s = await ev(() => ({ away: window.__world.game.away, bars: window.__world.game.camera.extraBars, site: (() => { const r = document.getElementById("site").getBoundingClientRect(); return r.top < innerHeight * 0.5; })() }));
  const before = await ev(() => window.__world.game.simTicks);
  await ev(() => window.__world.advance(30));
  const after = await ev(() => window.__world.game.simTicks);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  const back = await ev(() => !window.__world.game.away);
  report.scroll[id] = { away: s.away, siteUp: s.site, waits: after === before, back };
}

report.log = log;
report.audio = audio;
writeFileSync(`${OUT}/round.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ first: { time: report.first.time, reached: report.first.reached }, reload: report.reload, returning: report.returning, errors }, null, 1));
await browser.close();
