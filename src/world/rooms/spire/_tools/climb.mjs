// The spire end to end (lane R-D), with real input through the round's bot
// (src/world/tools/bot.js): from the Lift Foot (C3) onto the lift, the ride
// to the break, the whole outer climb with its gusts (resting at shrine 4 in
// the alcove), the Crown (the terminal woken and summoned, the website
// pointer, the express lever), the Blade (the storm breaks) and on to E1.
// Then a returning run through the express lift (S3) straight to the Crown.
//   node src/world/rooms/spire/_tools/climb.mjs [--port 24501] [--shots 1] [--w 1920 --h 1080]
// Records: every jump the bot made (rise and gap in H), the lowest elevation
// on each catwalk while a gust blew (a gust never pushes anyone off), pits
// taken, rooms and times, the terminal's states and panel, flags set.
// Writes review/world/phase2/R-D/climb/climb.json (+ PNGs with --shots 1).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", "24501");
const SHOTS = arg("shots", "0") === "1";
const VW = +arg("w", 1280), VH = +arg("h", 720);
const OUT = arg("out", "review/world/phase2/R-D/climb");
mkdirSync(OUT, { recursive: true });
const BOT = readFileSync(new URL("../../../tools/bot.js", import.meta.url), "utf8");

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

// a watcher that runs inside the page every tick: gusts, falls, pits
const WATCH = `
(() => {
  const g = () => window.__world.game;
  const w = { falls: [], gustLow: {}, pits: 0, lastY: null, maxDrop: 0, rooms: [], pushes: 0, pushedPx: 0 };
  const orig = g().realTick.bind(g());
  g().realTick = () => {
    orig();
    const G = g();
    const b = G.player.body;
    const d = G.room.def;
    const o = d.origin ?? [0, 0];
    const room = d.id;
    if (w.rooms[w.rooms.length - 1] !== room) w.rooms.push(room);
    const ey = o[1] - b.y / 80;
    if (G.trans && G.trans.kind === "pit" && !w._pit) { w.pits++; w._pit = true; }
    if (!G.trans) w._pit = false;
    const st = G.room.props.find((p) => p.recipe === "spire-storm");
    if (st && st.mover && Math.abs(st.mover.dx) > 0) {
      w.pushes++;
      w.pushedPx += Math.abs(st.mover.dx);
      const key = room + "@" + Math.round(ey);
      w.gustLow[key] = Math.min(w.gustLow[key] ?? 1e9, +ey.toFixed(2));
    }
    if (b.grounded) {
      if (w.lastY !== null && w.lastRoom === room && w.lastY - ey > 1.5) w.falls.push({ room, from: +w.lastY.toFixed(2), to: +ey.toFixed(2), x: +(o[0] + b.x / 80).toFixed(2) });
      w.lastY = ey;
      w.lastRoom = room;
    }
  };
  window.__watch = w;
})();`;

async function open(query) {
  await page.goto(`http://127.0.0.1:${PORT}/world/?${query}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  await page.addScriptTag({ content: BOT });
  for (let k = 0; k < 400; k++) {
    if (!(await ev(() => window.__world.game.loading))) break;
    await page.waitForTimeout(100);
    await ev(() => window.__world.advance(1));
  }
  await page.addScriptTag({ content: WATCH });
}
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
  for (let k = 0; k < 8; k++) {
    const before = (await st()).room;
    r = await run("walk", x, 3000, {});
    const s = await st();
    if (s.room === before) return r;
    await wait(20);
    const d = await st();
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
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
async function through(to) {
  const from = (await st()).room;
  let u = await use();
  await run("wait", 150, "room", from);
  // a closed gate (the Lift Foot's) opens on the first E and takes you through on the second
  if ((await st()).room === from) {
    u = await use();
    await run("wait", 1200, "room", from);
  }
  const s = await st();
  if (s.room !== to) throw new Error(`E on ${u.near} did not lead to ${to}: in ${s.room} at ${s.x.toFixed(2)}, ${s.y.toFixed(2)}`);
  await wait(30);
}
const t = () => ev(() => window.__world.game.travel.t);
const report = { port: PORT, legs: {}, terminal: {}, flags: {}, returning: {}, errors };

// ------------------------------------------------------------------------------------
await open("manual&fresh&mute&room=C3&spawn=west");
await ev(() => window.__world.begin());
let t0 = await t();
note("C3 -> D1: board the lift");
await walk(265.2);
await through("D1");
await shot("D1-boarded");
await wait(2000, "idle");
await shot("D1-break");
report.legs.ride = +((await t()) - t0).toFixed(1);
t0 = await t();
await walk(268.4);
await expectRoom("D2");
note("D2 the climb");
await walk(281.2);
await shot("D2-row46");
await walk(253.2);
await walk(277.2);
await walk(262.4);
await use();
await wait(120);
await shot("D2-alcove");
report.flags.shrine4 = await ev(() => window.__world.game.save.get("shrine:4"));
await walk(249.2);
await walk(271.2);
await walk(245.5);
await expectRoom("D3");
report.legs.climb = +((await t()) - t0).toFixed(1);
t0 = await t();
note("D3 the crown");
await walk(255.6);
await use();
await wait(40);
report.terminal.woken = await ev(() => ({ state: window.__world.game.room.pixel.world.find("terminal").state, roster: window.__world.game.room.pixel.world.find("roster").refs.mode }));
await shot("D3-woken");
await use();
await wait(90);
report.terminal.summoning = await ev(() => ({ state: window.__world.game.room.pixel.world.find("terminal").state, seals: window.__world.game.room.pixel.world.find("seals").state, shutters: ["shutter-w", "shutter-e"].map((id) => window.__world.game.room.pixel.world.find(id).state), arenaClamp: window.__world.game.arenaClamp }));
await shot("D3-summoning");
await wait(600, "panel");
report.terminal.panel = await ev(() => ({ kind: window.__world.game.panels.kind, text: document.querySelector(".world-panel, [role=dialog]")?.textContent?.trim().slice(0, 200) ?? null, state: window.__world.game.room.pixel.world.find("terminal").state, roster: window.__world.game.room.pixel.world.find("roster").refs.mode }));
await shot("D3-cooldown");
await run("closePanel");
await wait(30);
await walk(282.6);
await use();
await wait(40);
report.flags.express = await ev(() => window.__world.game.save.get("lever:express"));
await walk(284.4);
await expectRoom("D4");
report.legs.crown = +((await t()) - t0).toFixed(1);
t0 = await t();
note("D4 the blade");
await walk(300);
await wait(200);
await shot("D4-break");
report.flags.blade = await ev(() => window.__world.game.save.get("blade:cleared"));
await walk(316.4);
report.legs.blade = +((await t()) - t0).toFixed(1);
report.after = await st();
report.jumps = await ev(() => window.__bot.jumps());
report.watch = await ev(() => ({ falls: window.__watch.falls, gustLow: window.__watch.gustLow, pits: window.__watch.pits, rooms: window.__watch.rooms, pushes: window.__watch.pushes, pushedH: +(window.__watch.pushedPx / 80).toFixed(2) }));

// ------------------------------------------------------------------------------------
// returning: the express lift from the Lift Foot straight to the Crown (S3)
note("returning: express lift C3 -> D3");
await open("manual&mute&room=C3&spawn=west");
await ev(() => window.__world.begin());
t0 = await t();
await walk(265.2);
await through("D1");
await wait(2400, "idle");
await walk(268.4);
await expectRoom("D3");
report.returning.express = +((await t()) - t0).toFixed(1);
report.returning.at = await st();

writeFileSync(`${OUT}/climb.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ legs: report.legs, terminal: report.terminal, flags: report.flags, returning: report.returning, watch: report.watch, jumps: report.jumps.length, errors }, null, 1));
await browser.close();
