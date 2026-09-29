// Lane I1: W0's common checks (WORLD-PLAN section 13) re-run over every room of the
// integrated round (every region's real rooms, the story hooks loaded):
//   node src/world/story/_tools/checks.mjs [--port 24801] [--only shots,flash,cost] [--rooms A1,B2]
//
// shots  every room at 1920x1080 (1.5x sharp-bilinear), 2560x1440 (2x nearest) and a
//        phone in landscape (844x390 @3, touch), with the presentation mode and scale
// flash  60 s of simulated time per room, normal and reduced motion: most flash starts
//        through the global gate in any one second (target 2, limit 3)
// cost   frame cost per room at 1280x720 (render + 1 px readback so the GPU finishes),
//        d3d11, and SwiftShader for the record
// Writes review/world/phase2/I1/checks/checks.json and PNGs under .../rooms/.

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24801");
const ONLY = new Set(arg("only", "shots,flash,cost").split(","));
const OUT = "review/world/phase2/I1/checks";
mkdirSync(`${OUT}/rooms`, { recursive: true });
const ROUTE = ["A0", "A1", "A2", "A3", "A4", "B1", "B2", "B5", "C1", "C2", "C3", "D1", "D2", "D3", "D4", "E1", "E2", "E3", "E4", "S2"];
const ROOMS = arg("rooms", "") ? arg("rooms", "").split(",") : ROUTE;
/** Where to stand for each room's picture (spawn, then an x in world H). */
const AT = { A1: ["start"], B2: ["west", 163], D2: ["lift", 265], E1: ["west", 358], E3: ["west", 436], E4: ["west", 482], B5: ["top", 176], D1: ["bottom"], C1: ["west", 214] };
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
  const [spawn, x] = AT[id] ?? [""];
  await page.evaluate(([id, spawn, x]) => {
    const w = window.__world;
    w.teleport(id, spawn);
    if (x !== undefined) {
      const o = w.game.room.def.origin ?? [0, 0];
      const px = (x - o[0]) * 80;
      w.place(px, w.game.room.collision.groundAt(px, w.game.player.body.y - 80 * 3));
    }
  }, [id, spawn, x]);
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
    for (const id of angle === "swiftshader" ? ["A1", "B2", "C1", "D2", "E3"] : ROOMS) {
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
