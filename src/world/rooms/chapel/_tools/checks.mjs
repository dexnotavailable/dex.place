// The common checks (WORLD-PLAN section 13) for region E (lane R-E):
//   node src/world/rooms/chapel/_tools/checks.mjs [--port 24601] [--only shots,flash,cost]
//
// shots  each view of E1 to E4 at 1280x720 (1x), 1920x1080 (1.5x sharp-bilinear), 2560x1440
//        (2x nearest) and a phone in landscape (844x390 @3, touch): the presentation mode, the
//        scale, the player's height in world px, where her feet sit in the view
// flash  60 s of simulated time per room, normal and reduced motion, with the bells struck and
//        the rose window swept: the most flash starts through the global gate in any one second
// cost   frame cost per view at 1280x720 (render + 1 px readback), d3d11 on this GPU, and
//        SwiftShader for the record
// Writes review/world/phase2/R-E/checks/checks.json and PNGs.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(process.env.PW_ROOT ?? new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24601");
const ONLY = new Set(arg("only", "shots,flash,cost").split(","));
const OUT = arg("out", "review/world/phase2/R-E/checks");
mkdirSync(OUT, { recursive: true });

/** The views: [name, room, x in world H (or a spawn), flags to set first]. */
const VIEWS = [
  ["E1-top", "E1", "west", []],
  ["E1-gap", "E1", 334.4, []],
  ["E1-rib", "E1", 341.1, []],
  ["E1-terrace", "E1", 354.5, []],
  ["E1-lamps", "E1", 379.0, ["shrine:5"]],
  ["E1-bottom", "E1", 392.0, ["shrine:5"]],
  ["E2", "E2", 402.0, []],
  ["E3-west", "E3", 413.6, []],
  ["E3-nave", "E3", 431.8, []],
  ["E3-east", "E3", 449.0, []],
  ["E3-rose-lit", "E3", 427.0, ["rose:open"]],
  ["E4-foot", "E4", "west", []],
  ["E4-landing", "E4", 469.0, []],
  ["E4-balcony", "E4", "balcony", []],
];
const report = { shots: {}, flash: {}, cost: {} };

async function world(browser, opts, flags) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (flags.length) {
    await page.addInitScript((fl) => localStorage.setItem("dex.world.v1", JSON.stringify({ v: 1, flags: Object.fromEntries(fl.map((k) => [k, true])), rest: null, sound: false, props: {} })), flags);
  }
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&mute${flags.length ? "" : "&fresh"}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  for (let k = 0; k < 300 && (await page.evaluate(() => window.__world.game.loading)); k++) {
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__world.advance(1));
  }
  await page.evaluate(() => window.__world.begin());
  return { page, ctx, errors };
}
async function goView(page, room, at) {
  await page.evaluate(([room, at]) => {
    const w = window.__world;
    w.teleport(room, typeof at === "string" ? at : "");
    if (typeof at === "number") {
      const o = w.game.room.def.origin ?? [0, 0];
      const px = (at - o[0]) * 80;
      w.place(px, w.game.room.collision.groundAt(px, 0));
    }
  }, [room, at]);
  for (let k = 0; k < 400; k++) {
    const ok = await page.evaluate(() => { const g = window.__world.game; const b = g.room.backdrop; return !g.loading && (!b || b.ready()); });
    if (ok) break;
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__world.advance(1));
  }
  await page.evaluate(() => window.__world.advance(170));
}
const byFlags = (list) => {
  const m = new Map();
  for (const v of list) {
    const k = v[3].join(",");
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(v);
  }
  return m;
};

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });

if (ONLY.has("shots")) {
  const sizes = [
    ["720", { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }],
    ["1080", { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }],
    ["1440", { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 }],
    ["phone", { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }],
  ];
  for (const [tag, opts] of sizes) {
    for (const [flags, views] of byFlags(VIEWS)) {
      const { page, ctx, errors } = await world(browser, opts, flags ? flags.split(",") : []);
      for (const [name, room, at] of views) {
        await goView(page, room, at);
        await page.evaluate(() => window.__world.render());
        await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
        const s = await page.evaluate(() => {
          const g = window.__world.game;
          const s = g.state();
          return { room: s.room, present: s.present, heights: s.heights, camera: s.cameraMode, anchor: +g.camera.anchor.toFixed(2), feetInView: +((g.player.body.y - g.camera.view()[1]) / 720).toFixed(3), thumbs: window.__chapelArt ? window.__chapelArt.report().filter((r) => r.visible).length : 0 };
        });
        (report.shots[tag] ??= {})[name] = s;
      }
      if (errors.length) (report.shots[`${tag}-errors`] ??= []).push(...errors);
      await ctx.close();
    }
    console.log("shots", tag);
  }
}

if (ONLY.has("flash")) {
  for (const reduced of [false, true]) {
    const { page, ctx } = await world(browser, { viewport: { width: 1280, height: 720 }, reducedMotion: reduced ? "reduce" : "no-preference" }, []);
    for (const [name, room, at] of [["E1", "E1", 341.1], ["E2", "E2", 402], ["E3", "E3", 414.2], ["E4", "E4", "balcony"]]) {
      await goView(page, room, at);
      const r = await page.evaluate(() => {
        const g = window.__world.game;
        const w = g.room.pixel?.world;
        const starts = [];
        const allow = g.gate.allow.bind(g.gate);
        g.gate.allow = (now, red) => {
          const ok = allow(now, red);
          if (ok) starts.push(now);
          return ok;
        };
        // the room's pixel matter has its own gate (a bell's ring of light): count both on one clock
        const pstarts = [];
        const pallow = w ? w.flashGate.allow.bind(w.flashGate) : null;
        if (w) w.flashGate.allow = (now, red) => {
          const ok = pallow(now, red);
          if (ok) pstarts.push(g.seconds);
          return ok;
        };
        let max = 0;
        for (let i = 0; i < 60 * 60; i++) {
          // strike every bell in the room twice a second, open the rose window once
          if (w && i % 30 === 0) for (const p of w.props) if (p.recipe.id === "hangingBell") p.act("ring", 1);
          if (w && i === 60) w.find("rose-crank")?.use();
          g.realTick();
          const t = g.seconds;
          max = Math.max(max, starts.filter((s) => t - s < 1).length + pstarts.filter((s) => t - s < 1).length);
        }
        g.gate.allow = allow;
        if (w) w.flashGate.allow = pallow;
        const denied = w?.stats.flashDenied ?? 0;
        return { worldStarts: starts.length, propStarts: pstarts.length, maxInAnySecond: max, reduced: g.reduced, propDenied: denied };
      });
      (report.flash[reduced ? "reduced" : "normal"] ??= {})[name] = r;
    }
    await ctx.close();
    console.log("flash", reduced ? "reduced" : "normal");
  }
}

if (ONLY.has("cost")) {
  for (const angle of arg("angles", "d3d11,swiftshader").split(",")) {
    const args = [`--use-angle=${angle}`, "--ignore-gpu-blocklist"];
    if (angle === "swiftshader") args.push("--enable-unsafe-swiftshader");
    const b2 = await chromium.launch({ channel: "msedge", args });
    for (const [flags, views] of byFlags(VIEWS)) {
      const { page, ctx } = await world(b2, { viewport: { width: 1280, height: 720 } }, flags ? flags.split(",") : []);
      for (const [name, room, at] of views) {
        if (angle === "swiftshader" && !["E1-terrace", "E2", "E3-nave", "E3-rose-lit", "E4-balcony"].includes(name)) continue;
        await goView(page, room, at);
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
        (report.cost[angle] ??= {})[name] = ms;
      }
      await ctx.close();
    }
    await b2.close();
    console.log("cost", angle);
  }
}

writeFileSync(`${OUT}/checks.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ flash: report.flash, cost: report.cost }, null, 0));
await browser.close();
