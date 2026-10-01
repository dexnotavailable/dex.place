// R-C: the common checks (WORLD-PLAN section 13) over the Hollow (adapted from W0's
// src/world/tools/checks.mjs; output in R-C's folder):
//   node src/world/rooms/hollow/_tools/checks.mjs [--port 24401] [--only shots,flash,cost] [--rooms C1,C2,C3]
//
// shots  every room at 1920x1080 (1.5x sharp-bilinear), 2560x1440 (2x nearest) and a
//        phone in landscape (844x390 @3, touch), with the presentation mode and scale
// flash  60 s of simulated time per room, normal and reduced motion: most flash starts
//        through the global gate in any one second (target 2, limit 3)
// cost   frame cost per room at 1280x720 (render + 1 px readback so the GPU finishes),
//        d3d11, and SwiftShader for the record
// Writes review/world/phase2/W0/checks.json and PNGs under review/world/phase2/W0/rooms/.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(process.env.PW_ROOT ?? new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24401");
const ONLY = new Set(arg("only", "shots,flash,cost").split(","));
const OUT = "review/world/phase2/R-C";
mkdirSync(`${OUT}/rooms`, { recursive: true });
const ROUTE = ["C1", "C1w", "C1e", "C1roof", "C2", "C2b", "C3"];
const ROOMS = arg("rooms", "") ? arg("rooms", "").split(",") : ROUTE;
/** Where to stand for each room's picture (spawn, then an x in world H). */
const AT = { C1: ["west", 214], C1w: ["west", 197.5], C1e: ["west", 244], C1roof: ["west", 226.4, -26], C2: ["door", 229.5], C2b: ["door", 241.8], C3: ["west", 257.8] };
const ROOM = (id) => id.replace(/[a-z]+$/, "");
const report = { shots: {}, flash: {}, cost: {} };

async function world(browser, opts, query) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&${query}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  for (let k = 0; k < 300 && (await page.evaluate(() => window.__world.game.loading)); k++) {
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__world.advance(1));
  }
  await page.evaluate(() => window.__world.begin());
  return { page, ctx, errors };
}
async function goRoom(page, id) {
  const [spawn, x, y] = AT[id] ?? [""];
  await page.evaluate(([id, spawn, x, y]) => {
    const w = window.__world;
    if (w.game.room.def.id !== id) w.teleport(id, spawn);
    for (let k = 0; k < 80 && w.game.trans; k++) w.advance(1);
    if (x !== undefined) {
      const o = w.game.room.def.origin ?? [0, 0];
      const px = (x - o[0]) * 80;
      w.place(px, y !== undefined && y !== null ? (o[1] - y) * 80 : w.game.room.collision.groundAt(px, w.game.player.body.y - 80 * 3));
    }
  }, [ROOM(id), spawn, x, y ?? null]);
  for (let k = 0; k < 200; k++) {
    const ok = await page.evaluate(() => { const b = window.__world.game.room.backdrop; return !b || b.ready(); });
    if (ok) break;
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.__world.advance(150));
}

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });

if (ONLY.has("shots")) {
  const sizes = [
    ["1080", { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }],
    ["1440", { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 }],
    ["phone", { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }],
  ];
  for (const [tag, opts] of sizes) {
    const { page, ctx, errors } = await world(browser, opts, "");
    for (const id of ROOMS) {
      await goRoom(page, id);
      await page.screenshot({ path: `${OUT}/rooms/${tag}-${id}.png` });
      const s = await page.evaluate(() => { const s = window.__world.state(); return { room: s.room, present: s.present, heights: s.heights, camera: s.cameraMode, anchor: s.anchor, feetInView: +((s.y - s.camera[1]) / 720).toFixed(3) }; });
      (report.shots[tag] ??= {})[id] = s;
    }
    report.shots[`${tag}-errors`] = errors;
    await ctx.close();
    console.log("shots", tag);
  }
}

if (ONLY.has("flash")) {
  for (const reduced of [false, true]) {
    const { page, ctx } = await world(browser, { viewport: { width: 1280, height: 720 }, reducedMotion: reduced ? "reduce" : "no-preference" }, "");
    for (const id of ROOMS) {
      await goRoom(page, id);
      const r = await page.evaluate(() => {
        const g = window.__world.game;
        const starts = [];
        const allow = g.gate.allow.bind(g.gate);
        g.gate.allow = (now, red) => {
          const ok = allow(now, red);
          if (ok) starts.push(now);
          return ok;
        };
        let max = 0;
        for (let i = 0; i < 60 * 60; i++) {
          g.realTick();
          const t = g.seconds;
          max = Math.max(max, starts.filter((s) => t - s < 1).length);
        }
        g.gate.allow = allow;
        return { starts: starts.length, maxInAnySecond: max, reduced: g.reduced };
      });
      (report.flash[reduced ? "reduced" : "normal"] ??= {})[id] = r;
    }
    await ctx.close();
    console.log("flash", reduced ? "reduced" : "normal");
  }
}

if (ONLY.has("cost")) {
  for (const angle of ["d3d11", "swiftshader"]) {
    const args = [`--use-angle=${angle}`, "--ignore-gpu-blocklist"];
    if (angle === "swiftshader") args.push("--enable-unsafe-swiftshader");
    const b2 = await chromium.launch({ channel: "msedge", args });
    const { page, ctx } = await world(b2, { viewport: { width: 1280, height: 720 } }, "");
    for (const id of angle === "swiftshader" ? ["C1", "C2", "C3"] : ROOMS) {
      await goRoom(page, id);
      const ms = await page.evaluate((n) => {
        const w = window.__world;
        const g = w.game;
        const gl = g.r.gl;
        const px = new Uint8Array(4);
        const frame = () => {
          g.realTick();
          g.render();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        };
        for (let i = 0; i < 10; i++) frame();
        const t0 = performance.now();
        for (let i = 0; i < n; i++) frame();
        return +((performance.now() - t0) / n).toFixed(2);
      }, angle === "swiftshader" ? 10 : 120);
      (report.cost[angle] ??= {})[id] = ms;
    }
    await ctx.close();
    await b2.close();
    console.log("cost", angle);
  }
}

writeFileSync(`${OUT}/checks.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ flash: report.flash, cost: report.cost }, null, 0));
await browser.close();
