// Region B's common checks (WORLD-PLAN section 13, lane R-B):
//   node src/world/rooms/plain/_tools/check.mjs [--port 24301] [--only shots,flash,cost]
// shots  every view below at 1920x1080 (1.5x sharp-bilinear), 2560x1440 (2x nearest),
//        a phone in landscape (844x390 @3) and 1280x720 (1x), with the presentation mode,
//        the player's height and where her feet sit in the view
// flash  60 s of simulated time per room, normal and reduced motion: most flash starts
//        through the global gate in any one second (target 2, limit 3)
// cost   frame cost per view at 1280x720 (render + 1 px readback so the GPU finishes) on
//        d3d11, and SwiftShader for the record
// Writes review/world/phase2/R-B/checks.json and PNGs under review/world/phase2/R-B/views/.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24301");
const ONLY = new Set(arg("only", "shots,flash,cost").split(","));
const OUT = "review/world/phase2/R-B";
mkdirSync(`${OUT}/views`, { recursive: true });
/** Views: [name, room, spawn, world x or null, elevation or null]. */
const VIEWS = [
  ["B1-yard", "B1", "west", null, null],
  ["B1-boardwalk", "B1", "west", 86.6, 0.2],
  ["B1-channel", "B1", "channel-east", 95.3, null],
  ["B1-east", "B1", "east", 101.5, 0.2],
  ["B2-s1-stones", "B2", "west", 113.4, 1.0],
  ["B2-s2-colonnade", "B2", "west", 128.2, 1.2],
  ["B2-s2-crater", "B2", "west", 139, null],
  ["B2-s3-ribs", "B2", "west", 149.2, 1.6],
  ["B3-shelter", "B2", "shrine", 163.6, 2.0],
  ["B4-stonetop", "B2", "east", 163.4, 17.3],
  ["B5-top", "B5", "top", null, null],
  ["B5-culvert", "B5", "culvert", null, null],
  ["B5-shaft", "B5", "top", 175.9, -15],
  ["B5-low", "B5", "top", 173.2, -27],
  ["B5-street", "B5", "bottom", null, null],
];
// runs merge into the last report, so --only shots keeps the flash and cost numbers
const report = existsSync(`${OUT}/checks.json`) ? { shots: {}, flash: {}, cost: {}, ...JSON.parse(readFileSync(`${OUT}/checks.json`, "utf8")) } : { shots: {}, flash: {}, cost: {} };
for (const k of ONLY) report[k] = {};

async function world(browser, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  for (let k = 0; k < 300 && (await page.evaluate(() => window.__world.game.loading)); k++) {
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__world.advance(1));
  }
  await page.evaluate(() => window.__world.begin());
  return { page, ctx, errors };
}
async function goView(page, [, room, spawn, x, y]) {
  await page.evaluate(([r, s]) => window.__world.teleport(r, s), [room, spawn]);
  for (let k = 0; k < 300; k++) {
    const ok = await page.evaluate(() => { const b = window.__world.game.room.backdrop; return !window.__world.game.trans && (!b || b.ready()); });
    if (ok) break;
    await page.evaluate(() => window.__world.advance(1));
    await page.waitForTimeout(60);
  }
  if (x !== null)
    await page.evaluate(([x, y]) => {
      const w = window.__world;
      const o = w.game.room.def.origin ?? [0, 0];
      const px = (x - o[0]) * 80;
      w.place(px, y !== null ? (o[1] - y) * 80 : w.game.room.collision.groundAt(px, w.game.player.body.y - 80 * 3));
    }, [x, y]);
  await page.evaluate(() => window.__world.advance(200));
}

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });

if (ONLY.has("shots")) {
  const sizes = [
    ["720", { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }],
    ["1080", { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }],
    ["1440", { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 }],
    ["phone", { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }],
  ];
  for (const [tag, opts] of sizes) {
    const { page, ctx, errors } = await world(browser, opts);
    for (const v of VIEWS) {
      if (tag === "phone" && !["B1-channel", "B2-s2-colonnade", "B3-shelter", "B4-stonetop", "B5-culvert", "B5-street"].includes(v[0])) continue;
      await goView(page, v);
      await page.screenshot({ path: `${OUT}/views/${tag}-${v[0]}.png` });
      const s = await page.evaluate(() => { const s = window.__world.state(); return { room: s.room, area: s.area, present: s.present, heights: s.heights, camera: s.cameraMode, anchor: s.anchor, feetInView: +((s.y - s.camera[1]) / 720).toFixed(3) }; });
      (report.shots[tag] ??= {})[v[0]] = s;
    }
    report.shots[`${tag}-errors`] = errors;
    await ctx.close();
    console.log("shots", tag);
  }
}

if (ONLY.has("flash")) {
  for (const reduced of [false, true]) {
    const { page, ctx } = await world(browser, { viewport: { width: 1280, height: 720 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    for (const v of VIEWS.filter((q) => ["B1-channel", "B2-s2-colonnade", "B4-stonetop", "B5-culvert"].includes(q[0]))) {
      await goView(page, v);
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
        let shakeTicks = 0;
        for (let i = 0; i < 60 * 60; i++) {
          g.realTick();
          const t = g.seconds;
          max = Math.max(max, starts.filter((s) => t - s < 1).length);
          if (g.camera.offX !== 0 || g.camera.offY !== 0) shakeTicks++;
        }
        g.gate.allow = allow;
        return { starts: starts.length, maxInAnySecond: max, reduced: g.reduced, shakeTicks };
      });
      (report.flash[reduced ? "reduced" : "normal"] ??= {})[v[0]] = r;
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
    const { page, ctx } = await world(b2, { viewport: { width: 1280, height: 720 } });
    for (const v of angle === "swiftshader" ? VIEWS.filter((q) => ["B1-channel", "B2-s2-colonnade", "B4-stonetop", "B5-culvert"].includes(q[0])) : VIEWS) {
      await goView(page, v);
      const ms = await page.evaluate((n) => {
        const g = window.__world.game;
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
      }, angle === "swiftshader" ? 8 : 120);
      (report.cost[angle] ??= {})[v[0]] = ms;
    }
    await ctx.close();
    await b2.close();
    console.log("cost", angle);
  }
}

writeFileSync(`${OUT}/checks.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ flash: report.flash, cost: report.cost }, null, 0));
await browser.close();
