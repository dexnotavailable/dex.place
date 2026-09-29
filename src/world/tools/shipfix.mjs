// Evidence for the ship-fix pass (the cross-lane problems I1's integrated round found).
//   node src/world/tools/shipfix.mjs <check> [--port 25001]
// Checks: smoke, strike, summon, archive, lift, blade, lamps, sit, api, all.
// Every check records console errors and every HTTP response of 400 or more,
// unfiltered, and writes to review/world/phase2/ship-fix/<check>/.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "25001");
const ROOT = "review/world/phase2/ship-fix";
const which = process.argv[2] ?? "all";
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const out = {};
const note = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

/** A world page: size, device scale, query. Collects errors and bad responses. */
async function open(query, { w = 1280, h = 720, dpr = 1, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  const bad = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
  });
  page.on("requestfailed", (r) => bad.push(`failed ${r.url()} ${r.failure()?.errorText ?? ""}`));
  await page.goto(`http://127.0.0.1:${PORT}/world/?${query}`, { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 180000 });
  const ev = (fn, a) => page.evaluate(fn, a);
  for (let k = 0; k < 900 && (await ev(() => window.__world.game.loading)); k++) {
    await page.waitForTimeout(100);
    if (query.includes("manual")) await ev(() => window.__world.advance(1));
  }
  return { ctx, page, ev, errors, bad };
}
/** Wait (advancing a manual world) until the current room's backdrop is ready and no transition runs. */
async function settle(p, id, manual = true) {
  for (let k = 0; k < 600; k++) {
    const ok = await p.ev((id) => {
      const g = window.__world.game;
      return !g.trans && (!id || g.room.def.id === id) && (!g.room.backdrop || g.room.backdrop.ready());
    }, id);
    if (ok) return true;
    await p.page.waitForTimeout(80);
    if (manual) await p.ev(() => window.__world.advance(1));
  }
  return false;
}
const dir = (name) => {
  const d = `${ROOT}/${name}`;
  mkdirSync(d, { recursive: true });
  return d;
};
const save = (name, data) => writeFileSync(`${ROOT}/${name}/${name}.json`, JSON.stringify(data, null, 1));

// --- smoke: a fresh load, no errors, no 404 (the sprite probe is quiet) ---------------------
async function smoke() {
  const d = dir("smoke");
  const res = {};
  for (const [name, o] of [["720p", {}], ["1080p", { w: 1920, h: 1080 }], ["1440p", { w: 2560, h: 1440 }], ["phone", { w: 844, h: 390, dpr: 3, mobile: true }]]) {
    const p = await open("fresh&go", o);
    await settle(p, "A1", false);
    await p.page.waitForTimeout(3000);
    const s = await p.ev(() => ({ room: window.__world.game.room.def.id, sprite: window.__world.game.player.sprite?.source ?? null, sit: !!window.__world.game.worldSprite?.clips.get("sit") }));
    await p.page.screenshot({ path: `${d}/A1-${name}.png` });
    res[name] = { ...s, errors: p.errors, bad: p.bad };
    note(`smoke ${name}: ${p.errors.length} errors, ${p.bad.length} bad responses`);
    await p.ctx.close();
  }
  save("smoke", res);
  out.smoke = res;
}

/** Put her at world x in the current room (manual world) and let the camera settle. */
async function placeAt(p, wx) {
  await p.ev((wx) => {
    const g = window.__world.game;
    window.__world.place((wx - (g.room.def.origin?.[0] ?? 0)) * 80);
  }, wx);
  await p.ev(() => window.__world.advance(90));
}
/** A crop around the player, scaled from the 1280x720 view to the page size. */
async function shotPlayer(p, path, box = [90, 120, 180, 150]) {
  const r = await p.ev(() => {
    const g = window.__world.game;
    const b = g.player.body;
    const [cx, cy] = g.camera.view();
    const cr = g.r.canvas.getBoundingClientRect();
    return { x: b.x - cx, y: b.y - cy, rect: g.r.presenter.rect, dpr: g.r.canvas.width / cr.width, left: cr.left, top: cr.top };
  });
  // the presenter's rect is in canvas pixels; the screenshot clip is in CSS pixels
  const k = r.rect.scale / r.dpr;
  const ox = r.left + r.rect.x / r.dpr, oy = r.top + r.rect.y / r.dpr;
  const clip = { x: Math.max(0, ox + (r.x - box[0]) * k), y: Math.max(0, oy + (r.y - box[1]) * k), width: box[2] * k, height: box[3] * k };
  await p.page.screenshot({ path, clip });
  return { at: [r.x, r.y], scale: k };
}

// --- sit: the stand-in sits on benches (stub and kit), at 1080p / 1440p / phone -------------
async function sit() {
  const d = dir("sit");
  const res = {};
  const spots = [
    ["A0-pier-bench", "A0", "east", -11.65],
    ["C1-market-bench", "C1", "", 215.9],
    ["D4-blade-bench", "D4", "east", 314.3],
    ["E3-look-pew", "E3", "", 445.1],
  ];
  for (const [vname, vo] of [["1080p", { w: 1920, h: 1080 }], ["1440p", { w: 2560, h: 1440 }], ["phone", { w: 844, h: 390, dpr: 3, mobile: true }]]) {
    const p = await open("manual&fresh&mute", vo);
    await p.ev(() => window.__world.begin());
    for (const [name, room, spawn, x] of spots) {
      if (vname !== "1080p" && name !== "A0-pier-bench" && name !== "D4-blade-bench") continue;
      await p.ev(([room, spawn]) => window.__world.teleport(room, spawn), [room, spawn]);
      await settle(p, room);
      await placeAt(p, x);
      const before = await shotPlayer(p, `${d}/${name}-${vname}-standing.png`);
      await p.ev(() => window.__world.use());
      await p.ev(() => window.__world.advance(150));
      const s = await p.ev(() => {
        const g = window.__world.game;
        const sd = g.player.spriteDraw();
        return { sitting: g.sitting, drawn: sd ? { x: sd.x, y: sd.y, w: sd.sw, h: sd.sh } : null, feet: g.player.body.y };
      });
      await p.page.screenshot({ path: `${d}/${name}-${vname}-full.png` });
      const crop = await shotPlayer(p, `${d}/${name}-${vname}-sitting.png`);
      // any move stands her up
      await p.ev(() => window.__world.press("right"));
      await p.ev(() => window.__world.advance(20));
      await p.ev(() => window.__world.release("right"));
      const stood = await p.ev(() => !window.__world.game.sitting && window.__world.game.player.spriteDraw().sh);
      res[`${name}-${vname}`] = { ...s, before, crop, stoodUp: !!stood };
      note(`sit ${name} ${vname}: sitting ${!!s.sitting}, drawn ${JSON.stringify(s.drawn)}`);
    }
    res[`errors-${vname}`] = p.errors;
    res[`bad-${vname}`] = p.bad;
    await p.ctx.close();
  }
  save("sit", res);
  out.sit = res;
}

const checks = { smoke, sit };
for (const [k, f] of Object.entries(checks)) if (which === k || which === "all") await f();
await browser.close();
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
