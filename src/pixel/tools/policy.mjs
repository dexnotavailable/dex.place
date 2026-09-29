// Breakage policy and budgets, checked on the /props/?kit lineup (every
// registered recipe):
//  1. normal room: every move (heavy, Q, R, slash, dash wind, and a point at
//     the prop's centre) from both sides of every prop. `never` props lose no
//     cell and no form; after 14 s every part of every prop is whole again and
//     every prop's form is back at its built value (cords of `cut` props
//     excepted: they stay cut on purpose).
//  2. sway-only room (?nave): the same hits; no prop loses a cell or any form,
//     no cloth tears, no rope is cut, and the floor has no crater or scar.
//  Cells are counted on static parts. Matter drawn in code (grass blades, vine
//  strands: dynamic parts, redrawn every frame) is invisible to that count, so
//  a recipe with such parts declares `form` (Recipe.form: total blade height,
//  strand points) and the check holds that number too.
//  3. spam: a heavy, Q, R, slash or dash every 8 frames for 17 s across the
//     lineup; particles, chunks and ambient motes stay under their caps;
//     simulation p50/p95; flash starts in any second (normal and reduced).
//
//   node src/pixel/tools/policy.mjs [--port 24101] [--out review/world/phase2/P0/policy.json]

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(resolve("tools/scene-pipeline/package.json"));
const { chromium } = require("playwright-core");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? def : args[i + 1];
};
const port = opt("port", process.env.PIXEL_PORT ?? "24101");
const out = resolve(opt("out", "review/world/phase2/P0/policy.json"));

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function open(q) {
  await page.goto(`http://127.0.0.1:${port}/props/?manual&kit${q}`);
  await page.waitForFunction(() => window.__pixel && window.__pixel.world, null, { timeout: 60000 });
  await page.evaluate(() => {
    const P = window.__pixel;
    P.step(300);
    // built form of every prop that declares one (Recipe.form)
    window.__form0 = Object.fromEntries(P.world.props.filter((p) => p.recipe.form).map((p) => [p.id, p.recipe.form(p)]));
  });
}

/** Hit every slot with heavy, Q and R; return per-prop loss right after. */
const hitAll = () => page.evaluate(() => {
  const P = window.__pixel, w = P.world, H = P.room.H;
  const count = (p) => p.parts.filter((q) => !q.dynamic && !q.worldSpace).reduce((n, q) => n + q.grid.count, 0);
  const orig = (p) => p.parts.filter((q) => !q.dynamic && !q.worldSpace).reduce((n, q) => {
    const o = q.grid.orig; let c = 0; if (o) for (let i = 0; i < o.mat.length; i++) if (o.mat[i]) c++; return n + c;
  }, 0);
  const form = (p) => (p.recipe.form ? p.recipe.form(p) : 0);
  const moves = ["heavy", "q", "r", "slash", "wind", "point"];
  const res = [];
  for (const s of P.slots()) {
    const props = [P.prop(s.id), ...s.variants.map((v) => P.prop(`${s.id}: ${v}`))].filter(Boolean);
    for (const p of props) {
      if (p.recipe.id === "floor") continue;
      const before = { cells: orig(p), form: form(p), torn: p.cloths.reduce((n, c) => n + c.torn, 0), cut: p.ropes.reduce((n, r) => n + (r.isCut ? 1 : 0), 0) };
      const b = p.bounds();
      const centre = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
      for (const face of [1, -1]) {
        for (const t of moves) {
          P.moveFigure(p.x - H * 0.8 * face, face);
          P.fire(t, face, t === "point" ? centre : undefined);
          w.step(1 / 60);
        }
      }
      for (let i = 0; i < 6; i++) w.step(1 / 60);
      const after = { cells: count(p), form: form(p), torn: p.cloths.reduce((n, c) => n + c.torn, 0), cut: p.ropes.reduce((n, r) => n + (r.isCut ? 1 : 0), 0) };
      res.push({
        id: p.id, breakage: p.recipe.breakage, lost: before.cells - after.cells, torn: after.torn - before.torn, cut: after.cut - before.cut,
        ...(p.recipe.form ? { form: +before.form.toFixed(2), formAfter: +after.form.toFixed(2), formLost: +(before.form - after.form).toFixed(2) } : {}),
      });
    }
  }
  return res;
});

const healCheck = () => page.evaluate(() => {
  const P = window.__pixel, w = P.world;
  for (let i = 0; i < 60 * 14; i++) w.step(1 / 60);
  const out = [];
  for (const p of w.props) {
    if (p.recipe.id === "floor" || p.recipe.id === "gauge") continue;
    let missing = 0;
    for (const q of p.parts) {
      if (q.dynamic || q.worldSpace || !q.grid.orig) continue;
      const o = q.grid.orig;
      for (let i = 0; i < o.mat.length; i++) if (o.mat[i] && !q.grid.mat[i]) missing++;
    }
    const f0 = window.__form0[p.id];
    const formMissing = p.recipe.form && f0 !== undefined ? +(f0 - p.recipe.form(p)).toFixed(2) : 0;
    if (missing || Math.abs(formMissing) > 0.01) out.push({ id: p.id, breakage: p.recipe.breakage, state: p.state, missing, formMissing });
  }
  const floor = w.props.find((p) => p.recipe.id === "floor");
  let floorMissing = 0;
  for (const q of floor.parts) { const o = q.grid.orig; for (let i = 0; i < o.mat.length; i++) if (o.mat[i] !== q.grid.mat[i]) floorMissing++; }
  return { notWhole: out, floorCellsDiffering: floorMissing, chunksLeft: w.chunks.length };
});

// 1. normal room
await open("");
const normal = await hitAll();
const heal = await healCheck();
const lostAny = (r) => r.lost > 0 || r.torn > 0 || r.cut > 0 || (r.formLost ?? 0) > 0.01;
const neverViolations = normal.filter((r) => r.breakage === "never" && lostAny(r));
const formed = (rows) => rows.filter((r) => r.form !== undefined);

// 2. sway-only room
await open("&nave");
const sway = await hitAll();
const swayViolations = sway.filter(lostAny);
const swayFloorCellsDiffering = await page.evaluate(() => {
  const floor = window.__pixel.world.props.find((p) => p.recipe.id === "floor");
  let n = 0;
  for (const q of floor.parts) { const o = q.grid.orig; for (let i = 0; i < o.mat.length; i++) if (o.mat[i] !== q.grid.mat[i]) n++; }
  return n;
});

// 3. spam, normal and reduced motion
async function spam(q) {
  await open(q);
  return page.evaluate(() => {
    const P = window.__pixel, w = P.world, H = P.room.H;
    P.watchFlashes();
    const types = ["heavy", "q", "r", "slash", "wind"];
    const slots = P.slots();
    const sims = [];
    let maxP = 0, maxC = 0, maxA = 0;
    for (let f = 0; f < 60 * 17; f++) {
      if (f % 8 === 0) {
        const s = slots[Math.floor(f / 8) % slots.length];
        P.moveFigure(s.x - H * 0.8, 1);
        P.fire(types[(f / 8) % types.length], 1);
      }
      w.step(1 / 60);
      sims.push(w.stats.simMs);
      maxP = Math.max(maxP, w.particles.n);
      maxC = Math.max(maxC, w.chunks.length);
      maxA = Math.max(maxA, w.stats.ambient);
    }
    sims.sort((a, b) => a - b);
    const starts = window.__flashLog.starts;
    let maxFlash = 0;
    for (const t of starts) maxFlash = Math.max(maxFlash, starts.filter((u) => u >= t && u - t < (w.reduced ? 2 : 1)).length);
    return {
      reduced: w.reduced, budget: w.budget, maxParticles: maxP, maxChunks: maxC, maxAmbient: maxA,
      simP50: +sims[Math.floor(sims.length * 0.5)].toFixed(2), simP95: +sims[Math.floor(sims.length * 0.95)].toFixed(2),
      flashStarts: starts.length, maxFlashStartsInWindow: maxFlash, window: w.reduced ? "2 s" : "1 s", denied: w.stats.flashDenied,
    };
  });
}
const spamNormal = await spam("");
const spamReduced = await spam("&reduced");

const report = { moves: ["heavy", "q", "r", "slash", "wind", "point"], sides: [1, -1], normal, neverViolations, heal, sway, swayViolations, swayFloorCellsDiffering, formNormal: formed(normal), formSway: formed(sway), spamNormal, spamReduced, errors };
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`never props hit: ${normal.filter((r) => r.breakage === "never").length}, violations: ${neverViolations.length}`);
console.log(`heal after 14 s: ${heal.notWhole.length} props not whole ${JSON.stringify(heal.notWhole)}; floor cells differing ${heal.floorCellsDiffering}; chunks left ${heal.chunksLeft}`);
console.log(`sway room: ${sway.length} props hit, violations: ${swayViolations.length} ${JSON.stringify(swayViolations)}; floor cells differing ${swayFloorCellsDiffering}`);
console.log(`form (normal room, heal props may lose it): ${JSON.stringify(formed(normal).map((r) => [r.id, r.form, r.formAfter]))}`);
console.log(`form (sway room, must hold): ${JSON.stringify(formed(sway).map((r) => [r.id, r.form, r.formAfter]))}`);
console.log(`spam: ${JSON.stringify(spamNormal)}`);
console.log(`spam reduced: ${JSON.stringify(spamReduced)}`);
console.log(`page errors: ${errors.length}`);
await browser.close();
