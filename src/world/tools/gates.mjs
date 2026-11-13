// W0 re-verification after the critic pass (real time, no ?manual; real keyboard, real CDP touch):
//   node src/world/tools/gates.mjs [--port 24001] [--only sky,swipe,held,site]
//
// sky    fresh save: the loft sky door (S4) stays barred and the room does not change;
//        the latch from the E4 balcony; a real reload; the sky door then leads to E4
// swipe  phone landscape (844x390 @3, touch): a real vertical swipe on the world scrolls to
//        the website in every room of the round, the world waits, and a swipe back resumes it
// held   a key held through an edge exit and through a door keeps walking afterwards (no re-press)
// site   the website underneath ends at its content (no empty black past the links)
// Writes review/world/phase2/W0/fix/gates.json and PNGs beside it.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24001");
const ONLY = new Set(arg("only", "sky,swipe,held,site").split(","));
const OUT = "review/world/phase2/W0/fix";
mkdirSync(OUT, { recursive: true });
const URL0 = `http://127.0.0.1:${PORT}/world/`;
const ROUTE = ["A0", "A1", "A2", "A3", "A4", "B1", "B2", "B5", "C1", "C2", "C3", "D1", "D2", "D3", "D4", "E1", "E2", "E3", "E4", "S2"];
const report = {};
const save = () => writeFileSync(`${OUT}/gates.json`, JSON.stringify(report, null, 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });

async function open(opts, q) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(URL0 + q, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world && !window.__world.game.loading, null, { timeout: 120000 });
  await settle(page);
  return { ctx, page, errors };
}
async function settle(page) {
  for (let k = 0; k < 300; k++) {
    const ok = await page.evaluate(() => {
      const g = window.__world.game;
      const b = g.room.backdrop;
      return !g.loading && (!b || b.ready()) && !g.trans;
    });
    if (ok) return;
    await sleep(100);
  }
}
const S = (page) =>
  page.evaluate(() => {
    const g = window.__world.game;
    const s = g.state();
    const o = g.room.def.origin ?? [0, 0];
    return { room: s.room, x: +(o[0] + s.x / 80).toFixed(2), near: s.near, trans: s.transition, away: s.away, flags: { ...g.save.data.flags } };
  });
const tp = async (page, room, spawn) => {
  await page.evaluate(([r, s]) => window.__world.teleport(r, s), [room, spawn]);
  await settle(page);
  await sleep(500);
};
/** Hold a key (never re-pressed) until pred or timeout; returns the last state. */
async function hold(page, key, pred, ms) {
  await page.keyboard.down(key);
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await S(page);
    if (pred(s)) break;
    await sleep(30);
  }
  await page.keyboard.up(key);
  return s;
}
async function waitRoom(page, id, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await S(page);
    if (s.room === id && !s.trans) return true;
    await sleep(50);
  }
  return false;
}

if (ONLY.has("sky")) {
  const k = {};
  const { ctx, page, errors } = await open({ viewport: { width: 1920, height: 1080 } }, "?fresh&go");
  // fresh save: the loft sky door stays barred (E rattles it; no transition)
  await tp(page, "A3", "sky");
  const pre = await hold(page, "ArrowRight", (s) => s.near === "sky-door" || s.x >= 58.7, 3000);
  k.fresh = { near: pre.near, doorState: await page.evaluate(() => window.__world.game.room.prop("sky-door")?.state) };
  await page.keyboard.press("KeyE");
  await sleep(2500);
  const after = await S(page);
  k.fresh.afterE = { room: after.room, flags: after.flags, doorState: await page.evaluate(() => window.__world.game.room.prop("sky-door")?.state) };
  await page.screenshot({ path: `${OUT}/sky-fresh-barred-A3.png` });
  // re-entering the loft (the entry close() runs again) must not unbar it either
  await tp(page, "A3", "sky");
  k.fresh.reentered = await page.evaluate(() => window.__world.game.room.prop("sky-door")?.state);
  // the latch from the balcony
  await tp(page, "E4", "balcony");
  await hold(page, "ArrowRight", (s) => s.near === "sky-door-balcony" || s.x >= 485.1, 3000);
  await page.keyboard.press("KeyE");
  k.latchTo = (await waitRoom(page, "A3", 20000)) ? "A3" : (await S(page)).room;
  await settle(page);
  await sleep(600);
  k.flagsBefore = (await S(page)).flags;
  // a real reload (no ?fresh)
  await page.goto(URL0 + "?go", { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__world && !window.__world.game.loading, null, { timeout: 120000 });
  await settle(page);
  k.flagsAfterReload = (await S(page)).flags;
  await tp(page, "A3", "sky");
  k.latchedState = await page.evaluate(() => window.__world.game.room.prop("sky-door")?.state);
  await hold(page, "ArrowRight", (s) => s.near === "sky-door" || s.x >= 58.7, 3000);
  await page.keyboard.press("KeyE");
  k.skyTo = (await waitRoom(page, "E4", 20000)) ? "E4" : (await S(page)).room;
  await settle(page);
  await sleep(800);
  await page.screenshot({ path: `${OUT}/sky-latched-through-E4.png` });
  k.errors = errors;
  k.pass = k.fresh.afterE.room === "A3" && !k.fresh.afterE.flags["latch:sky-door"] && k.fresh.reentered === "locked" && k.latchTo === "A3" && !!k.flagsAfterReload["latch:sky-door"] && k.skyTo === "E4" && !errors.length;
  report.sky = k;
  save();
  console.log("sky", JSON.stringify(k));
  await ctx.close();
}

if (ONLY.has("swipe")) {
  const rooms = {};
  const opts = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
  const { ctx, page, errors } = await open(opts, "?fresh&go&room=A1");
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (from, to) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 422, y: from }] });
    for (let i = 1; i <= 20; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 422, y: from + ((to - from) * i) / 20 }] });
      await sleep(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(1200);
  };
  const sim = () => page.evaluate(() => window.__world.game.simTicks);
  for (const id of ROUTE) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await tp(page, id, "");
    // up the page: a finger drags up across the middle of the world (clear of the touch pad)
    await swipe(300, 40);
    const d = await page.evaluate(() => ({ scrollY, max: document.documentElement.scrollHeight - innerHeight, away: window.__world.game.away }));
    const s1 = await sim();
    await sleep(600);
    const s2 = await sim();
    if (id === "A1" || id === "D3" || id === "E4") await page.screenshot({ path: `${OUT}/swipe-up-${id}.png` });
    // and back down to the world: the finger drags down on the site
    await swipe(60, 380);
    await swipe(60, 380);
    const u = await page.evaluate(() => ({ scrollY, away: window.__world.game.away }));
    const s3 = await sim();
    await sleep(600);
    const s4 = await sim();
    rooms[id] = { room: (await S(page)).room, up: d.scrollY, max: d.max, away: d.away, waits: s2 === s1, backY: u.scrollY, back: !u.away, resumes: s4 > s3 };
    rooms[id].pass = rooms[id].room === id && d.away && d.scrollY > 0 && rooms[id].waits && u.scrollY === 0 && !u.away && rooms[id].resumes;
  }
  // the touch pad itself still moves the player (it keeps touch-action none)
  await page.evaluate(() => window.scrollTo(0, 0));
  await tp(page, "A1", "start");
  const x0 = (await S(page)).x;
  const pad = await page.evaluate(() => {
    const b = [...document.querySelectorAll("#touch button")].find((e) => /▶|right/i.test(e.textContent + (e.getAttribute("aria-label") ?? "")) && !e.hidden);
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  let padMoved = null;
  if (pad) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pad.x, y: pad.y }] });
    await sleep(900);
    // a slight vertical wobble while held must not scroll the page away
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: pad.x, y: pad.y - 12 }] });
    await sleep(300);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(200);
    const s = await S(page);
    padMoved = { dx: +(s.x - x0).toFixed(2), scrollY: await page.evaluate(() => scrollY), away: s.away };
  }
  await page.screenshot({ path: `${OUT}/swipe-pad-A1.png` });
  report.swipe = { rooms, pad: padMoved, errors, pass: Object.values(rooms).every((r) => r.pass) && !!padMoved && padMoved.dx > 0.5 && padMoved.scrollY === 0 && !errors.length };
  save();
  console.log("swipe", JSON.stringify(report.swipe));
  await ctx.close();
}

if (ONLY.has("held")) {
  const k = {};
  const { ctx, page, errors } = await open({ viewport: { width: 1920, height: 1080 } }, "?fresh&go");
  // edge exit: hold right from the dock's east end into the cliff stair and on up the first steps
  await tp(page, "A1", "east");
  const e = await hold(page, "ArrowRight", (s) => s.room === "A2" && !s.trans && s.x >= 35.6, 8000);
  k.edge = { room: e.room, x: e.x, pass: e.room === "A2" && e.x >= 35.6 };
  // a door: hold right to the lodge's front door, press E while still holding, keep walking inside
  await tp(page, "A2", "lodge");
  await page.keyboard.down("ArrowRight");
  for (let i = 0; i < 60 && (await S(page)).near !== "lodge-front-out"; i++) await sleep(30);
  await page.keyboard.press("KeyE");
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < 8000) {
    s = await S(page);
    if (s.room === "A3" && !s.trans && s.x >= 48.4) break;
    await sleep(30);
  }
  await page.keyboard.up("ArrowRight");
  k.door = { room: s.room, x: s.x, pass: s.room === "A3" && s.x >= 48.4 };
  await page.screenshot({ path: `${OUT}/held-through-door-A3.png` });
  k.errors = errors;
  k.pass = k.edge.pass && k.door.pass && !errors.length;
  report.held = k;
  save();
  console.log("held", JSON.stringify(k));
  await ctx.close();
}

if (ONLY.has("site")) {
  const k = {};
  for (const [tag, opts] of [
    ["1080", { viewport: { width: 1920, height: 1080 } }],
    ["phone", { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }],
  ]) {
    const { ctx, page, errors } = await open(opts, "?fresh&go&room=A1");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(900);
    k[tag] = await page.evaluate(() => {
      const site = document.getElementById("site").getBoundingClientRect();
      const nav = document.querySelector("#site nav").getBoundingClientRect();
      return { scrollY, siteTop: Math.round(site.top), siteBottom: Math.round(site.bottom), innerHeight, emptyBelowLinks: Math.round(innerHeight - nav.bottom), away: window.__world.game.away };
    });
    k[tag].pass = k[tag].siteTop === 0 && k[tag].siteBottom === k[tag].innerHeight && k[tag].away;
    k[tag].errors = errors;
    await page.screenshot({ path: `${OUT}/site-bottom-${tag}.png` });
    await ctx.close();
  }
  report.site = k;
  save();
  console.log("site", JSON.stringify(k));
}
await browser.close();
