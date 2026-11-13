// Lane I1: the whole round, played once from a fresh save with every region's
// real rooms, the way a first-time visitor who looks around would play it.
//   node src/world/story/_tools/round.mjs [--port 24801] [--rec 1] [--w 1280 --h 720]
//
// Real input through W0's bot (src/world/tools/bot.js): it only decides when to
// press what. Times are the game's travel log (simulation seconds since Enter),
// so a room's shaders compiling in real time never inflate them.
//
// 1. First round: the dock, the lodge (the keeper's first line, the ledger, the
//    product board, the box), shrine 1 and the map, the reeds (wade, cut the
//    bridge), the causeway and shelter, the culvert lever and the hook, the
//    market, the archive (the index), the lift, the climb, the Crown (the
//    terminal's interim, the express lever), the Blade, the path, the porch,
//    the chapel (a work, the catalogue, the rose, the look pew), the balcony
//    latch, the sky door home, the evening, the keeper at Pier's End.
//    Every beat of WORLD-PLAN section 10 is time-stamped with what the game
//    measured there (weather, music state, camera, room size).
// 2. A reload (a later visit): every flag kept, Ringwater morning again, the
//    keeper's chair and cup in the loft, the lamps still lit.
// 3. Returning-visitor runs through the shortcuts, against section 6.
// 4. The website scroll-away from every room.
// With --rec 1: key-beat clips (20 fps, MP4 + GIF) and a timelapse of the
// whole first round (one frame per 0.5 s of play) under review/world/phase2/I1/.
// Flash starts through the global gate are counted over the whole round.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire(new URL("../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24801");
const REC = arg("rec", "0") === "1";
const VW = +arg("w", 1280), VH = +arg("h", 720);
const OUT = arg("out", "review/world/phase2/I1");
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
mkdirSync(`${OUT}/beats`, { recursive: true });
const BOT = readFileSync(new URL("../../tools/bot.js", import.meta.url), "utf8");

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
// every console error counts, 404s included, and every response of 400 or more and every failed
// request; only a media request the page cancels itself (a music element let go) is set apart
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
});
const aborted = [];
page.on("requestfailed", (r) => {
  const why = r.failure()?.errorText ?? "";
  if (/ERR_ABORTED/.test(why)) aborted.push(r.url());
  else errors.push(`request failed ${r.url()} ${why}`);
});
const ev = (fn, a) => page.evaluate(fn, a);
const FROM = arg("from", null); // debug: start the first round at a section ("D2 ", "E3 " ...) with the flags before it
let skip = !!FROM;
const FROM_AT = { "D2": ["D2", "lift", 4], "D3": ["D3", "west", 4], "D4": ["D4", "west", 4], "E1": ["E1", "west", 4], "E3": ["E3", "west", 6], "E4": ["E4", "balcony", 6], "A0": ["A1", "start", 6] };
const note = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);
async function section(name, text) {
  note(`${name} ${text}`);
  if (!skip || !name.startsWith(FROM)) return;
  skip = false;
  const [room, spawn, lit] = FROM_AT[FROM];
  await ev(([room, spawn, lit]) => {
    const g = window.__world.game;
    for (let n = 1; n <= lit; n++) g.save.set(`shrine:${n}`, true);
    for (const k of ["cut:map-banner", "cut:rope-bridge", "lever:culvert", "keeper:greeted"]) g.save.set(k, true);
    if (lit >= 6) for (const k of ["lever:express", "blade:cleared"]) g.save.set(k, true);
    if (room === "A1") for (const k of ["rose:open", "latch:sky-door", "round:done"]) g.save.set(k, true);
    window.__world.teleport(room, spawn);
  }, [room, spawn, lit]);
  await wait(30);
}

async function open(query) {
  await page.goto(`http://127.0.0.1:${PORT}/world/?${query}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  await page.addScriptTag({ content: BOT });
  for (let k = 0; k < 600; k++) {
    if (!(await ev(() => window.__world.game.loading))) break;
    await page.waitForTimeout(100);
    await ev(() => window.__world.advance(1));
  }
  // count every flash start through the global gate (WORLD-PLAN section 13: at most 3 in any second)
  await ev(() => {
    const g = window.__world.game;
    window.__flashes = [];
    const allow = g.gate.allow.bind(g.gate);
    g.gate.allow = (now, red) => {
      const ok = allow(now, red);
      if (ok) window.__flashes.push([+now.toFixed(3), g.room.def.id]);
      return ok;
    };
  });
}

// ---- recording ---------------------------------------------------------------------------
let clip = null; // { name, n }
let lapse = 0;
let lastLapseTick = -1e9;
let lastClipTick = -1e9;
const tickNow = () => ev(() => window.__world.game.realTicks);
async function frame(force = false) {
  if (!REC) return;
  const t = await tickNow();
  const wantClip = clip && (force || t - lastClipTick >= 3);
  const wantLapse = t - lastLapseTick >= 30;
  if (!wantClip && !wantLapse) return;
  await ev(() => window.__world.render());
  const buf = await page.screenshot({ type: "jpeg", quality: 88 });
  if (wantClip) {
    writeFileSync(`${OUT}/clips/${clip.name}/f${String(clip.n++).padStart(5, "0")}.jpg`, buf);
    lastClipTick = t;
  }
  if (wantLapse) {
    writeFileSync(`${OUT}/timelapse/f${String(lapse++).padStart(5, "0")}.jpg`, buf);
    lastLapseTick = t;
  }
}
function clipStart(name) {
  if (!REC || skip) return;
  const dir = `${OUT}/clips/${name}`;
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  clip = { name, n: 0 };
  lastClipTick = -1e9;
}
const clips = [];
function clipStop() {
  if (!REC || !clip) return;
  clips.push({ ...clip });
  clip = null;
}
function encode() {
  if (!REC) return;
  mkdirSync(`${OUT}/video`, { recursive: true });
  const mp4 = (inDir, out, fps) =>
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${inDir}/f%05d.jpg`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", out]);
  const gif = (inDir, out, fps) =>
    execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${inDir}/f%05d.jpg`, "-vf", "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", out]);
  for (const c of clips) {
    if (c.n < 4) continue;
    mp4(`${OUT}/clips/${c.name}`, `${OUT}/video/${c.name}.mp4`, 20);
    gif(`${OUT}/clips/${c.name}`, `${OUT}/video/${c.name}.gif`, 20);
  }
  if (lapse > 4) mp4(`${OUT}/timelapse`, `${OUT}/video/first-round-timelapse.mp4`, 30);
  // all key beats in order, one film
  const list = clips.filter((c) => c.n >= 4).map((c) => `file '${process.cwd().replace(/\\/g, "/")}/${OUT}/video/${c.name}.mp4'`).join("\n");
  writeFileSync(`${OUT}/video/beats.txt`, list);
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${OUT}/video/beats.txt`, "-c", "copy", `${OUT}/video/first-round-key-beats.mp4`]);
}

// ---- driving (chunked so frames can be taken between chunks) ----------------------------------
const CHUNK = () => (clip ? 3 : 30);
const st = () => ev(() => window.__bot.st());
async function call(name, ...a) {
  if (skip) return { done: true };
  for (let k = 0; k < 20000; k++) {
    const r = await ev(([c, a]) => window.__bot[c](...a), [name, a]);
    if (r.wait) {
      await page.waitForTimeout(40);
      continue;
    }
    return r;
  }
  throw new Error(`${name} never finished`);
}
/** Walk to world x, through edge exits (a room change ends a bot walk; keep going if x lies beyond). */
async function walk(x, o = {}) {
  if (skip) return { done: true };
  let total = 0;
  for (let hop = 0; hop < 10; hop++) {
    const before = (await st()).room;
    let r;
    for (;;) {
      r = await call("walk", x, CHUNK(), o);
      if (process.env.DEBUGWALK) console.log("  walk", x, JSON.stringify(r), JSON.stringify(await st()));
      await frame();
      if (!r.budget) break;
      // a chunk that ended inside an edge transition: the next room is not this walk's to cross
      const now = await st();
      if (now.room !== before) {
        for (let k = 0; k < 400 && (await st()).trans; k++) await call("wait", 1);
        break;
      }
      total += CHUNK();
      if (total > 6000) {
        const s = await st();
        throw new Error(`walk(${x}) stuck in ${s.room} at ${s.x.toFixed(2)}, ${s.y.toFixed(2)}`);
      }
    }
    const s = await st();
    if (s.room === before) return r;
    await ev(() => window.__bot.releaseAll());
    await wait(20);
    const d = await st();
    const ox = await ev(() => { const d = window.__world.game.room.def; return [d.origin?.[0] ?? 0, (d.origin?.[0] ?? 0) + d.w / 80]; });
    if (x < ox[0] || x > ox[1] || Math.abs(d.x - x) < 0.3) return r;
  }
}
/** Let `ticks` pass (stops early: "room" on a room change, "idle" when rides stop, "panel" when one opens). */
async function wait(ticks, until) {
  if (skip) return { done: true };
  const from = (await st()).room;
  let left = ticks;
  let done = 0;
  while (left > 0) {
    const n = Math.min(CHUNK(), left);
    const r = await call("wait", n, until === "idle" ? undefined : until, from);
    await frame();
    left -= n;
    done += n;
    if (until === "idle") {
      if (done > 10 && (await ev(() => { const g = window.__world.game; return !g.trans && !g.room.props.some((p) => p.moving); }))) return { done: true };
    } else if (until && r.x === undefined) return r; // ended early on its condition
  }
  return { done: true };
}
/** Seconds the visitor spent standing to look or read (not moving): the round's stops. */
let stopped = 0;
async function look(ticks) {
  stopped += ticks / 60;
  return wait(ticks);
}
async function use() {
  const r = await call("use");
  await frame(true);
  return r;
}
const nearNow = () => ev(() => window.__world.game.state().near);
/** Walk to x, then E on the prop `id` (nudging along if something else is nearer). */
async function useOn(id, x) {
  if (skip) return { done: true };
  await walk(x);
  for (let k = 0; k < 6; k++) {
    await wait(2);
    const n = await nearNow();
    if (n === id) return use();
    await walk(x + (k % 2 ? -1 : 1) * 0.15 * (1 + (k >> 1)));
  }
  const s = await st();
  throw new Error(`nothing called ${id} in reach at ${s.room} ${s.x.toFixed(2)} (near: ${await nearNow()})`);
}
async function expectRoom(id) {
  if (skip) return;
  const s = await st();
  if (s.room !== id) throw new Error(`expected room ${id}, in ${s.room} at ${s.x.toFixed(1)}, ${s.y.toFixed(1)}`);
}
/** E on a door or a ride until the next room (pixel doors: the first E opens, the second goes through). */
async function through(to) {
  if (skip) return;
  const from = (await st()).room;
  let u;
  for (let k = 0; k < 3 && (await st()).room === from; k++) {
    u = await use();
    await wait(k === 2 ? 1400 : 160, "room");
  }
  const s = await st();
  if (s.room !== to) throw new Error(`E on ${u?.near} did not lead to ${to}: in ${s.room} at ${s.x.toFixed(2)}, ${s.y.toFixed(2)}`);
  await wait(30);
}
async function closePanel(hold = 0) {
  if (hold) await look(hold);
  await call("closePanel");
}
const travel = () => ev(() => { const t = window.__world.game.travel; return { t: t.t, reached: { ...t.reached }, events: t.events.slice() }; });
const pxState = (id) => ev((id) => window.__world.game.room.pixel?.world.find(id)?.state ?? null, id);

// ---- what the game says at a beat ------------------------------------------------------------
const beats = [];
async function beat(n, label, name) {
  if (skip) return;
  const m = await ev(() => {
    const g = window.__world.game;
    const s = g.state();
    const d = g.room.def;
    const a = g.audioFor();
    const w = s.weather;
    return {
      t: +g.travel.t.toFixed(1),
      room: d.id,
      area: g.area?.id ?? null,
      screens: [+(d.w / 1280).toFixed(2), +(d.h / 720).toFixed(2)],
      camera: s.cameraMode,
      anchor: s.anchor,
      interior: !!w.interior || !!d.weather?.interior,
      roofed: !!g.area?.roofed,
      underground: !!d.underground,
      weather: { label: w.label, rain: +(w.rain ?? 0).toFixed(2), storm: +(w.storm ?? 0).toFixed(2), overcast: +(w.overcast ?? 0).toFixed(2), wind: +(w.wind ?? 0).toFixed(2), clear: +(w.clear ?? 0).toFixed(2) },
      music: { want: g.arena ? "arena" : a.music, level: +(s.audio.level ?? 0).toFixed(2), muffle: s.audio.muffle, silent: !!a.silent, bed: s.audio.bed, cue: +g.audio.cueTime().toFixed(1) },
      arena: g.arena,
      session: { ...g.save.session },
    };
  });
  beats.push({ n, label, stops: +stopped.toFixed(1), ...m });
  if (name) {
    await ev(() => window.__world.render());
    await page.screenshot({ path: `${OUT}/beats/${String(n).padStart(2, "0")}-${name}.png` });
  }
  note(`beat ${n} ${label}: t ${m.t} s in ${m.room}${m.area ? `/${m.area}` : ""}`);
}

const report = { port: PORT, viewport: [VW, VH], first: {}, later: {}, returning: {}, scroll: {}, errors, aborted };

// =====================================================================================
// 1. the first round
if (REC) {
  for (const d of ["clips", "timelapse"]) if (existsSync(`${OUT}/${d}`)) rmSync(`${OUT}/${d}`, { recursive: true });
  mkdirSync(`${OUT}/clips`, { recursive: true });
  mkdirSync(`${OUT}/timelapse`, { recursive: true });
}
await open("manual&fresh");
report.first.hooks = await ev(() => window.__world.game.hooks.ids);
await ev(() => window.__world.begin());

await section("A1", "the dock: stand and look (ambience first)");
clipStart("01-dock-arrival");
await beat(1, "A1 Dock (arrival)", null);
report.first.firstFrame = await ev(() => ({ near: window.__world.game.state().near, usable: window.__world.game.room.props.filter((p) => p.interaction?.()).map((p) => p.id) }));
await look(60 * 8);
// the first frame once the fade-in is done (nothing to use in it: report.first.firstFrame)
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/01-A1-dock.png` });
await walk(24);
clipStop();
await walk(34.5);
await expectRoom("A2");
await beat(2, "A2 Cliff Stair", "A2-stair");
await walk(45.3);
await through("A3");
await beat(3, "A3 Keeper's Lodge", "A3-lodge");

await section("A3", "the lodge: the keeper, the ledger, the product board, the box");
clipStart("02-lodge-keeper");
await useOn("keeper", 50.95);
await wait(150);
report.first.keeperLine1 = { greeted: await ev(() => window.__world.game.save.get("keeper:greeted")), state: await pxState("keeper") };
await useOn("registry", 50.4);
await wait(5);
report.first.accountPanel = await ev(() => ({ kind: window.__world.game.panels.kind, text: document.getElementById("panel")?.innerText?.slice(0, 300) }));
await closePanel(90);
clipStop();
await useOn("product-board", 53.15);
await wait(5);
report.first.productPanel = await ev(() => ({ kind: window.__world.game.panels.kind, text: document.getElementById("panel")?.innerText?.slice(0, 300) }));
await closePanel(60);
await useOn("box-lodge", 55.4);
await wait(5);
report.first.donatePanel = await ev(() => window.__world.game.panels.kind);
await closePanel(60);
await walk(59.0);
await through("A4");
await beat(4, "A4 Yard", "A4-yard");

await section("A4", "the yard: shrine 1 lights the lamps, the map banner");
clipStart("03-shrine1-lamps-and-banner");
await useOn("shrine-1", 64.2);
await wait(200);
report.first.shrine1 = { flag: await ev(() => window.__world.game.save.get("shrine:1")), lamps: [await pxState("lamp-1-3"), await pxState("lamp-1-4")] };
await walk(68.2);
await call("slash", 1);
await wait(200);
report.first.banner = await pxState("map-banner");
clipStop();
await walk(70.4);
for (let k = 0; k < 4 && (await ev(() => window.__world.game.panels.kind)) !== "map"; k++) {
  await use();
  await wait(5);
  if ((await ev(() => window.__world.game.panels.kind)) !== "map") await walk(70.4 + (k % 2 ? -0.3 : 0.3));
}
report.first.mapPanel = await ev(() => ({ kind: window.__world.game.panels.kind }));
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/04b-map-panel.png` });
await closePanel(120);
await walk(76.4);
await expectRoom("B1");
await beat(5, "B1 Reed Shallows", "B1-reeds");

await section("B1", "the reeds: wade the channel, cut the bridge from the east bank");
await walk(97.2);
report.first.waded = await ev(() => window.__world.game.wading);
clipStart("04-reeds-rope-bridge");
await walk(98.9);
await call("slash", -1);
await wait(120);
clipStop();
report.first.bridgeCut = await ev(() => window.__world.game.save.get("cut:rope-bridge"));
await walk(108.4);
await expectRoom("B2");
await beat(6, "B2 Causeway", "B2-causeway");
clipStart("05-causeway-walk");
await walk(124);
clipStop();

await section("B2", "the causeway to the shelter (shrine 2)");
await walk(160.2);
await beat(7, "B3 Bus Shelter", null);
await useOn("shrine-2", 161.0).catch(async () => {
  await walk(161.0);
  await use();
});
await wait(150);
await beat(7.1, "B3 Bus Shelter, rested", "B3-shelter");
await walk(172.4);
await expectRoom("B5");
await beat(9, "B5 Hollow Mouth", "B5-mouth");

await section("B5", "the culvert lever, the hook down");
await walk(182.6);
await use();
await wait(90);
report.first.culvert = await ev(() => window.__world.game.save.get("lever:culvert"));
await walk(186.4);
clipStart("06-hook-ride-down");
await use();
await wait(900, "idle");
await wait(40);
clipStop();
await walk(188.4);
await expectRoom("C1");
await beat(10, "C1 Foundry Market", "C1-market");

await section("C1", "shrine 3, the archive");
await walk(212.0);
await use();
await wait(150);
report.first.shrine3 = await ev(() => window.__world.game.save.get("shrine:3"));
await walk(231.8);
await through("C2");
await beat(11, "C2 Archive", "C2-archive");
clipStart("07-archive-silence");
await walk(236.2);
await use();
await wait(8);
report.first.docsPanel = await ev(() => ({ kind: window.__world.game.panels.kind, frame: document.querySelector("#panel iframe")?.getAttribute("src") ?? null }));
await closePanel(120);
await look(200);
clipStop();
report.first.archiveMusic = await ev(() => ({ level: window.__world.game.state().audio.level, silent: !!window.__world.game.audioFor().silent }));
await walk(225.6);
await through("C1");
await walk(252.4);
await expectRoom("C3");
await beat(12, "C3 Lift Foot", "C3-liftfoot");

await section("C3", "-> D1 the lift ride");
await walk(265.2);
clipStart("08-lift-ride");
await through("D1");
await beat(13, "D1 Lift Ride", null);
await wait(2400, "idle");
clipStop();
await walk(268.4);
await expectRoom("D2");
await beat(14, "D2 Outer Climb", "D2-climb");

await section("D2", "the climb, the storm alcove (shrine 4)");
clipStart("09-climb-gusts");
await walk(281.2);
await walk(253.2);
clipStop();
await walk(277.2);
await walk(262.4);
await beat(15, "D2 Storm Alcove", null);
await use();
await wait(150);
await beat(15.1, "D2 Storm Alcove, rested", "D2-alcove");
report.first.shrine4 = await ev(() => window.__world.game.save.get("shrine:4"));
await walk(249.2);
await walk(271.2);
await walk(245.5);
await expectRoom("D3");

await section("D3", "the Crown: the terminal's interim, the express lever");
await walk(255.6);
clipStart("10-crown-terminal");
await use();
await wait(60);
await use();
await wait(120);
await beat(16, "D3 Crown (summoning)", "D3-summoning");
await wait(700, "panel");
report.first.terminal = await ev(() => ({ panel: window.__world.game.panels.kind, text: document.getElementById("panel")?.innerText?.slice(0, 300) }));
await closePanel(90);
await wait(120);
clipStop();
await walk(282.6);
await use();
await wait(30);
report.first.express = await ev(() => window.__world.game.save.get("lever:express"));
await walk(284.4);
await expectRoom("D4");

await section("D4", "the Blade: the storm breaks");
clipStart("11-blade-storm-breaks");
await walk(290.5);
await beat(17, "D4 Blade (the storm breaks)", null);
await walk(297);
await wait(150);
await walk(306);
await beat(17.1, "D4 Blade, clear", "D4-clear");
await walk(313.1);
await look(60 * 5);
clipStop();
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/17b-D4-tip-vista.png` });
report.first.bladeCleared = await ev(() => window.__world.game.save.get("blade:cleared"));
await walk(316.4);
await expectRoom("E1");
await beat(18, "E1 Pilgrim Path", "E1-path");

await section("E1", "the path down, shrine 5");
await walk(356.6);
await use();
clipStart("12-shrine5-lamps");
await wait(240);
clipStop();
await beat(19, "E1 Pilgrim Shrine (shrine 5)", "E1-shrine5");
await walk(396.4);
await expectRoom("E2");
await beat(20, "E2 Chapel Porch", "E2-porch");
await walk(399.0);
await use();
await wait(150);
report.first.shrine6 = await ev(() => window.__world.game.save.get("shrine:6"));
await walk(407.9);
await through("E3");
await beat(21, "E3 Chapel of Light", "E3-chapel");

await section("E3", "the chapel: a work, the catalogue, the rose, the look pew");
const art1 = await ev(() => { const g = window.__world.game; const p = g.room.pixel?.world.find("art-01"); return p ? g.room.def.origin[0] + p.x / 80 : 0; });
await walk(art1 - 0.2);
await use();
await wait(5);
report.first.artPanel = await ev(() => { const el = document.getElementById("panel"); const img = el.querySelector("figure img"); return { kind: window.__world.game.panels.kind, src: img?.getAttribute("src") ?? null, alt: img?.alt ?? null }; });
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/21b-E3-artwork-panel.png` });
await closePanel(60);
await walk(416.5);
await use();
await wait(5);
report.first.catalogue = await ev(() => ({ kind: window.__world.game.panels.kind, works: document.querySelectorAll("#panel img").length }));
await closePanel(60);
await walk(414.4);
clipStart("13-rose-window");
await use();
await wait(60);
await walk(436);
await wait(300);
clipStop();
report.first.rose = await ev(() => window.__world.game.save.get("rose:open"));
await walk(445.1);
await use();
await look(60 * 5);
report.first.pewSitting = await ev(() => window.__world.game.sitting);
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/21c-E3-look-pew.png` });
await walk(458.4);
await expectRoom("E4");
await beat(22, "E4 Balcony", null);
await walk(484.4);
await look(60 * 3);
await beat(22.1, "E4 Balcony, the view", "E4-balcony");

await section("E4", "the latch: the bell, the sky door home");
clipStart("14-latch-sky-door-home");
await use();
for (let k = 0; k < 120 && (await st()).room === "E4"; k++) await wait(4);
await expectRoom("A3");
await wait(90);
report.first.home = await ev(() => { const g = window.__world.game; return { latch: g.save.get("latch:sky-door"), round: g.save.get("round:done"), evening: g.save.getSession("evening"), keeper: g.room.pixel?.world.find("keeper")?.state ?? null, backdrop: g.room.backdrop?.def.title }; });
await beat(23, "A3 Lodge loft (through the sky door)", "A3-loft-home");
await walk(53.5);
await walk(47.0);
clipStop();
await walk(46.6);
await through("A2");
await walk(33.6);
await expectRoom("A1");
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/23b-A1-evening.png` });
report.first.a1Evening = await ev(() => window.__world.game.room.backdrop?.def.title);
await walk(-0.4);
await expectRoom("A0");

await section("A0", "home: the keeper and two cups, her second line");
clipStart("15-home-the-keeper");
await walk(-11.65);
await wait(30);
for (let k = 0; k < 4 && !(await ev(() => window.__world.game.sitting)); k++) {
  await use();
  await wait(10);
  if (!(await ev(() => window.__world.game.sitting))) await walk(-11.65 + (k % 2 ? 0.2 : -0.2));
}
await look(60 * 9);
clipStop();
await beat(24, "A0 Pier's End (home, the keeper)", "A0-home");
report.first.ending = await ev(() => { const g = window.__world.game; return { sitting: g.sitting, keeper: g.room.pixel?.world.find("keeper-pier")?.state ?? null, cups: !!g.room.pixel?.world.find("pier-cups"), backdrop: g.room.backdrop?.def.title, evening: g.save.getSession("evening") }; });
if (REC) {
  // hold the ending for a few seconds of timelapse
  for (let k = 0; k < 6; k++) await wait(30);
}
const t1 = await travel();
report.first.time = +t1.t.toFixed(1);
report.first.stops = +stopped.toFixed(1);
report.first.reached = t1.reached;
report.first.events = t1.events;
report.first.save = await ev(() => ({ ...window.__world.game.save.data.flags }));
report.first.audioHistory = await ev(() => window.__world.game.audio.state.history ?? null);
report.first.flashes = await ev(() => window.__flashes);
report.first.jumps = await ev(() => window.__bot.jumps());
report.beats = beats;

// =====================================================================================
// 2. a later visit (a reload): the save keeps everything; Ringwater is morning again
note("reload: a later visit");
await open("manual");
const flags = await ev(() => window.__world.game.save.data.flags);
const need = ["shrine:1", "shrine:2", "shrine:3", "shrine:4", "shrine:5", "shrine:6", "cut:map-banner", "cut:rope-bridge", "lever:culvert", "lever:express", "blade:cleared", "rose:open", "latch:sky-door", "round:done", "keeper:greeted"];
report.later.missing = need.filter((k) => !flags[k]);
report.later.rest = await ev(() => window.__world.game.save.data.rest);
await ev(() => window.__world.begin());
await ev(() => window.__world.teleport("A1", "start"));
await wait(90);
report.later.a1 = await ev(() => ({ backdrop: window.__world.game.room.backdrop?.def.title, evening: window.__world.game.save.getSession("evening") }));
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/later-A1-morning.png` });
await ev(() => window.__world.teleport("A3", "sky"));
await wait(90);
report.later.loft = await ev(() => ({ pixel: window.__world.game.state().pixel.filter((p) => /keeper|cup|chair|board/.test(p.id)), sky: window.__world.game.room.pixel?.world.find("sky-door")?.state ?? null }));
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/later-A3-loft.png` });
await ev(() => window.__world.teleport("A0", "east"));
await walk(-11);
await wait(60);
report.later.a0 = await ev(() => ({ keeper: window.__world.game.room.pixel?.world.find("keeper-pier")?.state ?? null, backdrop: window.__world.game.room.backdrop?.def.title }));
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/later-A0-morning.png` });

// =====================================================================================
// 3. the returning visitor: from the dock through the shortcuts they opened
async function fromDock() {
  await ev(() => window.__bot.releaseAll());
  await ev(() => {
    window.__world.teleport("A1", "start");
    window.__world.game.travel.reset();
  });
  await wait(20);
}
note("returning: S1 the bridge");
await ev(() => window.__world.teleport("B1", "west"));
await wait(20);
await walk(91.6);
let wadedOnBridge = false;
for (let k = 0; k < 40 && !wadedOnBridge; k++) {
  await call("walk", 91.8 + k * 0.17, 200);
  wadedOnBridge = await ev(() => window.__world.game.wading);
}
report.returning.S1 = { waded: wadedOnBridge };

note("returning: documentation by the ferry (S2) and the hook");
await fromDock();
await walk(-3.0);
await expectRoom("A0");
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/beats/returning-A0-ferry.png` });
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

note("returning: downloads by the ferry, the hook and the express lift (S3)");
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
await wait(2600, "idle");
await walk(268.4);
await expectRoom("D3");
await walk(255.6);
report.returning.downloads = (await travel()).reached.downloads ?? null;

note("returning: illustrations by the sky door (S4)");
await fromDock();
await walk(34.5);
await walk(45.1);
await through("A3");
await call("hop", 1);
await walk(58.4);
await through("E4");
await walk(457.6);
await expectRoom("E3");
await walk(455.0);
report.returning.illustrations = (await travel()).reached.illustrations ?? null;

note("returning: account, donate, map");
await fromDock();
await walk(34.5);
await walk(45.1);
await through("A3");
await walk(55.4);
await walk(59.0);
await through("A4");
await walk(70.4);
const tr = await travel();
report.returning.account = tr.reached.account ?? null;
report.returning.donate = tr.reached.donate ?? null;
report.returning.map = tr.reached.map ?? null;

// =====================================================================================
// 4. the website, one scroll away, from every room
note("scroll-away in every room");
const ids = await ev(() => window.__world.game.roomIds().filter((id) => !["arrival", "plain", "house"].includes(id)));
for (const id of ids) {
  await ev((id) => window.__world.teleport(id, ""), id);
  await wait(10);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);
  const s = await ev(() => ({ away: window.__world.game.away, site: document.getElementById("site").getBoundingClientRect().top < innerHeight * 0.5 }));
  const before = await ev(() => window.__world.game.simTicks);
  await ev(() => window.__world.advance(30));
  const after = await ev(() => window.__world.game.simTicks);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const back = await ev(() => !window.__world.game.away);
  report.scroll[id] = s.away && s.site && after === before && back;
}

writeFileSync(`${OUT}/round.json`, JSON.stringify(report, null, 1));
await browser.close();
note("encoding");
encode();
note(`done: first round ${report.first.time} s, ${errors.length} errors`);
