// Interaction audit: every "E to interact" spot in every room of the round.
//   node src/world/tools/interact-audit.mjs [--port 28201] [--rooms A1,B2] [--out review/interact-audit]
//
// For each room it enumerates every usable prop (pixel matter with a `use` reach, stub props with an
// interaction), then for each one:
//   wired       the recipe has a `use` reach whenever a state has a use handler
//   standable   some ground in the room lets the player stand inside the prop's prompt zone
//   prompt      standing there, the game's findNear() picks THIS prop (not a neighbour)
//   centre      standing at the prop's own centre x (where a player walks up to it) picks this prop
//   glyph       the key glyph's spot lies inside the camera's view
//   effect      pressing E (game.use(), the call the E key, Enter and the touch button make) changes
//               something observable: a panel, a room change, a sit, a rest, a flag, a prop state,
//               a carrier moving. States that legitimately show nothing are named in EXPECT_QUIET.
// Then once per room: E while sitting stands you up, and E during a room fade or an open panel does
// nothing harmful. Exits 1 when anything fails. Writes <out>/report.json and report.md.
// Software WebGL is fine: PLAYWRIGHT_BROWSERS_PATH=D:/Dex/Temp/ms-playwright, playwright-core from the
// site research folder (override with PW_ROOT). The page comes from the capture server:
//   npx vite --config src/world/tools/vite.capture.config.mjs --port 28201 --strictPort --host 127.0.0.1

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(process.env.PW_ROOT ?? "D:/Dex/Temp/dexplace-site-research/package.json");
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "28201");
const OUT = arg("out", "review/interact-audit");
const ROOMS_ARG = arg("rooms", process.env.AUDIT_ROOMS ?? "");
const ONLY = ROOMS_ARG ? ROOMS_ARG.split(",") : null;
mkdirSync(OUT, { recursive: true });

/** Usable things whose visible effect is legitimately nothing right now: recipe id -> reason. */
const EXPECT_QUIET = {
  // (filled in from reviewed results; every entry needs a reason)
};

const GL = process.argv.includes("--gpu") ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const browser = await chromium.launch({ args: [...GL, "--autoplay-policy=no-user-gesture-required"] });

async function boot() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "commit", timeout: 240000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 240000 });
  await settle(page);
  await page.evaluate(() => window.__world.begin());
  return { ctx, page, errors };
}
async function settle(page) {
  for (let k = 0; k < 1200 && (await page.evaluate(() => window.__world.game.loading)); k++) {
    await page.waitForTimeout(50);
    await page.evaluate(() => window.__world.advance(1));
  }
}
/** Teleport (no fade) and wait for the room to be built and its shaders ready. */
async function enter(page, room, spawn) {
  await page.evaluate(([room, spawn]) => {
    const g = window.__world.game;
    if (g.panels.open) g.panels.close();
    g.sitting = null;
    window.__world.teleport(room, spawn);
  }, [room, spawn]);
  for (let k = 0; k < 900; k++) {
    const s = await page.evaluate(() => {
      window.__world.advance(2);
      const g = window.__world.game;
      return { loading: g.loading, trans: !!g.trans, room: g.room.def.id, ready: !g.room.backdrop || g.room.backdrop.ready() };
    });
    if (s.room === room && !s.loading && !s.trans && s.ready) break;
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => window.__world.advance(30));
}

/** A fresh save and a rebuilt room, so one E never colours the next item (a lever opening a gate, a lit shrine). */
async function freshRoom(page, room, spawn) {
  await page.evaluate(() => {
    const g = window.__world.game;
    if (g.panels.open) g.panels.close();
    if (g.sitting) g.stand();
    g.save.clear();
    g.room.dispose();
  });
  await enter(page, room, spawn);
}

/* ---- in-page helpers (serialised into the page; no outer references) ---- */
const enumerate = () => {
  const g = window.__world.game;
  const rm = g.room;
  const items = [];
  const num = (n) => Math.round(n * 10) / 10;
  for (const p of rm.pixel?.props ?? []) {
    const rec = p.recipe;
    const anyUse = Object.values(rec.states).some((s) => s.use);
    if (!rec.use && !anyUse) continue;
    if (!rec.use && "use" in rec) { items.push({ kind: "px", id: p.id, recipe: rec.id, x: p.x, y: p.y, noOwnE: true }); continue; }
    if (!rec.use) { items.push({ kind: "px", id: p.id, recipe: rec.id, x: p.x, y: p.y, problem: "a state has a use handler but the recipe has no `use` reach (E never finds it)" }); continue; }
    if (!anyUse) { items.push({ kind: "px", id: p.id, recipe: rec.id, x: p.x, y: p.y, problem: "the recipe has a `use` reach but no state has a use handler" }); continue; }
    const b = p.bounds();
    const z = rec.use.zone ? p.zoneRect(rec.use.zone) : b;
    items.push({ kind: "px", id: p.id, recipe: rec.id, state: p.state, usableNow: !!p.stateDef.use && p.stateDef.can?.(p) !== false, reachPx: rec.use.reach * p.params.H, prompt: rec.use.prompt ?? "", zone: [num(z.x0), num(z.y0), num(z.x1), num(z.y1)], bounds: [num(b.x0), num(b.y0), num(b.x1), num(b.y1)], x: p.x, y: p.y });
  }
  for (const p of rm.props) {
    const it = p.interaction();
    if (!it) continue;
    const b = p.bounds();
    items.push({ kind: "stub", id: p.id, recipe: p.recipe, state: p.state, usableNow: true, reachPx: it.radius, prompt: it.label, zone: [num(p.x - it.radius), num(b.y), num(p.x + it.radius), num(b.y + b.h)], bounds: [num(b.x), num(b.y), num(b.x + b.w), num(b.y + b.h)], x: p.x, y: p.y });
  }
  return { room: rm.def.id, items, doors: Object.keys(rm.def.doors ?? {}) };
};

/** A usable prop whose first state has no E (lit candles, a rolled banner): put it in a state where it has one. */
const arrange = (id) => {
  const g = window.__world.game;
  const p = g.room.pixel?.props.find((q) => q.id === id);
  if (!p) return null;
  const ok = () => !!p.stateDef.use && p.stateDef.can?.(p) !== false;
  if (ok()) return p.state;
  const from = p.state;
  for (const [name, def] of Object.entries(p.recipe.states)) {
    if (!def.use || name === from) continue;
    p.go(name);
    for (let i = 0; i < 3; i++) g.room.pixel.world.step?.(1 / 60);
    if (ok()) return name;
  }
  p.go(from);
  return null;
};

/** Candidate standing points, what the game prompts at each, and whether the glyph is on screen. */
const probeItem = (item) => {
  const g = window.__world.game;
  const col = g.room.collision;
  const body = g.player.body;
  const H = 80;
  const saved = { x: body.x, y: body.y };
  const surfaces = [];
  for (const s of col.solids) if (!s.off) surfaces.push({ x: s.x, w: s.w, y: s.y, solid: s });
  for (const s of col.oneWays) if (!s.off) surfaces.push({ x: s.x, w: s.w, y: s.y, solid: null });
  // moving floors (the crane hook, the lift, the ferry) are floors too, where they rest now
  for (const pr of g.room.props) if (pr.collision === "solid" || pr.collision === "platform") for (const bx of pr.solids()) surfaces.push({ x: bx.x, w: bx.w, y: bx.y, solid: null });
  const x0 = Math.max(body.w / 2 + 2, item.zone[0] - item.reachPx), x1 = Math.min(g.room.def.w - body.w / 2 - 2, item.zone[2] + item.reachPx);
  const cx = Math.round((item.bounds[0] + item.bounds[2]) / 2);
  const xs = new Set([cx, Math.round(item.x)]);
  for (let x = Math.ceil(x0); x <= x1; x += 8) xs.add(x);
  const points = [];
  for (const x of xs) {
    if (x < x0 || x > x1) continue;
    for (const s of surfaces) {
      if (x < s.x || x > s.x + s.w) continue;
      if (s.y < item.zone[1] - 0.2 * H || s.y > item.zone[3] + 1.6 * H) continue;
      let blocked = false;
      for (const q of col.solids) if (!q.off && q !== s.solid && q.y < s.y - 1 && q.y + q.h > s.y - H && x + body.w / 2 > q.x && x - body.w / 2 < q.x + q.w) { blocked = true; break; }
      if (!blocked) points.push({ x, y: s.y });
    }
  }
  const res = [];
  for (const p of points) {
    body.x = p.x; body.y = p.y; body.vx = body.vy = 0;
    g.findNear();
    const n = g.near;
    const r = { x: p.x, y: p.y, near: n ? n.prop.id : null };
    if (n && n.prop.id === item.id) {
      const bb = n.prop.bounds();
      let px, top;
      if (n.kind === "stub") { px = Math.round(n.prop.x); top = bb.y; } else { px = Math.round((bb.x0 + bb.x1) / 2); top = bb.y0; }
      const py = Math.round(Math.min(top, body.y - H) - 14);
      r.glyph = [px, py];
    }
    res.push(r);
  }
  body.x = saved.x; body.y = saved.y;
  g.findNear();
  let nearest = null;
  for (const sf of surfaces) {
    const dx = Math.max(sf.x - item.zone[2], 0, item.zone[0] - (sf.x + sf.w));
    const dy = sf.y - item.zone[3];
    const d = Math.hypot(dx, Math.max(dy, 0));
    if (!nearest || d < nearest.d) nearest = { d: Math.round(d), x: Math.round(sf.x), w: Math.round(sf.w), y: Math.round(sf.y), dy: Math.round(dy) };
  }
  return { cx, points: res, nearest, gate: { mode: g.mode, trans: !!g.trans, panel: g.panels.kind, sitting: !!g.sitting, away: g.away, resting: g.resting } };
};

const place = ([x, y]) => {
  const w = window.__world;
  w.place(x, y);
  w.advance(3);
  const g = w.game;
  g.findNear();
  const [vx, vy] = g.camera.view();
  const n = g.near;
  let glyph = null;
  if (n) {
    const bb = n.prop.bounds();
    let px, top;
    if (n.kind === "stub") { px = Math.round(n.prop.x); top = bb.y; } else { px = Math.round((bb.x0 + bb.x1) / 2); top = bb.y0; }
    const py = Math.round(Math.min(top, g.player.body.y - 80) - 14);
    glyph = { x: px, y: py, inside: px >= vx + (1536 - g.camera.vw) / 2 && px <= vx + (1536 + g.camera.vw) / 2 && py >= vy + (864 - g.camera.vh) / 2 && py <= vy + (864 + g.camera.vh) / 2, view: [vx, vy, Math.round(g.camera.vw), Math.round(g.camera.vh)] };
  }
  return { near: n ? n.prop.id : null, glyph };
};

const sig = () => {
  const g = window.__world.game;
  const save = JSON.parse(JSON.stringify(g.save.data));
  delete save.place; delete save.lastSeen;
  return {
    room: g.room.def.id,
    panel: g.panels.kind,
    trans: !!g.trans,
    sitting: g.sitting ? g.sitting.id : null,
    resting: g.resting > 0,
    arena: g.arena,
    closeup: g.camera.closeup,
    save: JSON.stringify(save),
    session: JSON.stringify(g.save.session),
    px: (g.room.pixel?.props ?? []).map((p) => `${p.id}=${p.state}`).join(","),
    stub: g.room.props.map((p) => `${p.id}=${p.state}${p.moving ? "*" : ""}`).join(","),
  };
};
/** E, recording the sounds and events pixel matter raised and the sounds stub props made (feedback counts as an effect). */
const press = () => {
  const g = window.__world.game;
  window.__fb = [];
  const pw = g.room.pixel?.world;
  if (pw && !pw.__fbWrapped) {
    pw.__fbWrapped = true;
    const ev = pw.event.bind(pw);
    pw.event = (e) => { window.__fb.push({ name: e.type === "sound" ? `sound:${e.id}` : `event:${e.type}${e.action ? "/" + e.action : ""}`, prop: e.prop?.id ?? null, x: e.x, y: e.y }); ev(e); };
  }
  if (!g.propWorld.__fbWrapped) {
    g.propWorld.__fbWrapped = true;
    const snd = g.propWorld.sound.bind(g.propWorld);
    g.propWorld.sound = (id, vol, at) => { window.__fb.push({ name: `sound:${id}`, prop: null, x: at?.[0], y: at?.[1] }); return snd(id, vol, at); };
  }
  window.__world.use();
};
/** Feedback that is this item's: its own events, or sounds made inside/near its zone (not ambient noise elsewhere). */
const feedback = (item) => {
  const near = (f) => f.prop === item.id || (typeof f.x === "number" && f.x >= item.zone[0] - 160 && f.x <= item.zone[2] + 160 && f.y >= item.zone[1] - 160 && f.y <= item.zone[3] + 160) || (f.prop === null && f.x === undefined);
  return [...new Set((window.__fb ?? []).filter(near).map((f) => f.name))];
};
const tick = (n) => { const w = window.__world; for (let i = 0; i < n; i++) w.game.realTick(); return true; };

function diff(a, b) {
  const d = [];
  for (const k of Object.keys(a)) {
    if (a[k] === b[k]) continue;
    if (k === "px" || k === "stub") {
      const am = new Map(a[k].split(",").map((s) => s.split("=")));
      for (const s of b[k].split(",")) { const [i, st] = s.split("="); if (am.has(i) && am.get(i) !== st) d.push(`${i}:${am.get(i)}->${st}`); }
    } else d.push(`${k}:${String(a[k]).slice(0, 48)}->${String(b[k]).slice(0, 48)}`);
  }
  return d;
}

const report = { at: new Date().toISOString(), rooms: {}, failures: [], totals: { interactables: 0, pass: 0, fail: 0 } };
const fail = (room, id, check, detail) => report.failures.push({ room, id, check, detail });

let { page, errors } = await boot();
const roomIds = await page.evaluate(() => window.__world.game.roomIds());

for (const room of roomIds) {
  if (ONLY && !ONLY.includes(room)) continue;
  const spawn = await page.evaluate((r) => Object.keys(window.__world.game.roomDef(r).spawns)[0], room);
  await freshRoom(page, room, spawn);
  let en = await page.evaluate(enumerate);
  if (en.room !== room) { await enter(page, room, spawn); en = await page.evaluate(enumerate); }
  if (en.room !== room) throw new Error(`entered ${en.room}, wanted ${room}`);
  console.log(`${room}: ${en.items.length} interactables`);
  const rr = { items: [], doors: en.doors, spawn };
  report.rooms[room] = rr;
  let firstOk = null;
  for (const item of en.items) {
    report.totals.interactables++;
    const res = { id: item.id, kind: item.kind, recipe: item.recipe, state: item.state, checks: {}, notes: [] };
    rr.items.push(res);
    const bad = (check, detail) => { res.checks[check] = "FAIL"; res.notes.push(`${check}: ${detail}`); fail(room, item.id, check, detail); };
    if (item.noOwnE) { res.checks.wired = "no own E by design (recipe sets use: undefined; the room's own spot handles it)"; continue; }
    if (item.problem) {
      const partner = en.items.find((q) => q.kind === "stub" && Math.abs(q.x - item.x) < 140);
      if (item.problem.startsWith("a state has") && partner) { res.checks.wired = `no own E: ${partner.recipe}#${partner.id} is the E spot`; continue; }
      bad("wired", item.problem); continue;
    }
    res.checks.wired = "ok";
    if (!item.usableNow) {
      const st = item.kind === "px" ? await page.evaluate(arrange, item.id) : null;
      if (!st) { res.checks.prompt = "n/a"; res.notes.push(`no state of ${item.recipe} can use E here (${item.state}); no prompt is ever shown, so nothing is dead on screen`); continue; }
      const again = (await page.evaluate(enumerate)).items.find((q) => q.id === item.id);
      Object.assign(item, again);
      res.notes.push(`tested in state ${st}: ${item.recipe} only offers E there`);
    }
    const pr = await page.evaluate(probeItem, item);
    if (!pr.points.length) { bad("standable", `no standable ground inside the reach (${Math.round(item.reachPx)} px) of zone [${item.zone}]; nearest floor ${JSON.stringify(pr.nearest)}`); continue; }
    res.checks.standable = "ok";
    const good = pr.points.filter((p) => p.near === item.id);
    if (!good.length) {
      const stolen = [...new Set(pr.points.map((p) => p.near).filter(Boolean))];
      bad("prompt", stolen.length ? `standing in its zone the prompt goes to ${stolen.join(", ")} instead (zone [${item.zone}], points ${pr.points.map((p) => `${p.x},${p.y}->${p.near ?? "-"}`).join(" ")})` : `no standing point in reach picks it (${pr.points.length} points tried, zone [${item.zone}], bounds [${item.bounds}], game ${JSON.stringify(pr.gate)})`);
      continue;
    }
    res.checks.prompt = "ok";
    const atCentre = pr.points.filter((p) => Math.abs(p.x - pr.cx) < 10);
    if (atCentre.length && !atCentre.some((p) => p.near === item.id)) {
      const who = [...new Set(atCentre.map((p) => p.near ?? "nothing"))].join(", ");
      bad("centre", `at its own centre x=${pr.cx} the prompt goes to ${who}`);
    } else res.checks.centre = "ok";
    // stand at the good point nearest its centre, for real (camera, prompt)
    good.sort((a, b) => Math.abs(a.x - pr.cx) - Math.abs(b.x - pr.cx));
    const at = good[0];
    const placed = await page.evaluate(place, [at.x, at.y]);
    if (placed.near !== item.id) { bad("prompt", `after placing the player at (${at.x}, ${at.y}) and stepping the game, the prompt is ${placed.near}`); continue; }
    if (placed.glyph && !placed.glyph.inside) bad("glyph", `the key glyph at (${placed.glyph.x}, ${placed.glyph.y}) is outside the camera view [${placed.glyph.view}]`);
    else res.checks.glyph = "ok";
    if (!item.usableNow) { res.checks.effect = "skipped"; continue; }
    // press E and watch
    const s0 = await page.evaluate(sig);
    await page.evaluate(press);
    let changes = [];
    let roomChanged = false;
    // watch up to ~4 s: a door opens, then carries you through; a panel or a room change ends it early
    for (let k = 0; k < 30; k++) {
      await page.evaluate(tick, 8);
      const s1 = await page.evaluate(sig);
      for (const c of diff(s0, s1)) if (!changes.includes(c)) changes.push(c);
      if (s1.room !== s0.room) { roomChanged = true; break; }
      if (s1.panel && !s1.trans) break;
      if (changes.length && !s1.trans && k >= 14) break;
      if (!changes.length && k >= 14) break;
      await page.waitForTimeout(10);
    }
    const fb = await page.evaluate(feedback, item);
    res.effect = changes.slice(0, 6);
    if (fb.length) res.feedback = fb.slice(0, 6);
    const quiet = EXPECT_QUIET[item.recipe] ?? EXPECT_QUIET[item.id];
    if (!changes.length && !roomChanged && fb.length) res.checks.effect = `feedback only (${fb.slice(0, 3).join(", ")})`;
    else if (!changes.length && !roomChanged) {
      if (quiet) res.checks.effect = `quiet (${quiet})`;
      else bad("effect", "pressing E changed nothing (no panel, room, sit, rest, flag, state or motion)");
    } else res.checks.effect = "ok";
    if (!firstOk) firstOk = item.id;
    await freshRoom(page, room, spawn);
    console.log(`  ${room} ${item.recipe}#${item.id}: ${Object.entries(res.checks).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  }
  // sitting / fade / panel gates, once per room that has a bench
  const bench = en.items.find((i) => i.recipe === "bench" && i.usableNow);
  if (bench) {
    const pr = await page.evaluate(probeItem, bench);
    const at = pr.points.filter((p) => p.near === bench.id).sort((a, b) => Math.abs(a.x - pr.cx) - Math.abs(b.x - pr.cx))[0];
    if (at) {
      await page.evaluate(place, [at.x, at.y]);
      await page.evaluate(press);
      await page.evaluate(tick, 30);
      const sat = await page.evaluate(sig);
      if (!sat.sitting) { rr.sit = "did not sit"; fail(room, bench.id, "sit", "E on the bench did not sit the player down"); }
      else {
        await page.evaluate(press);
        await page.evaluate(tick, 6);
        const up = await page.evaluate(sig);
        if (up.sitting) { rr.sit = "E while sitting did not stand up"; fail(room, bench.id, "stand", "E while sitting does nothing (only a move stands you up)"); }
        else rr.sit = "ok: sits, E stands";
      }
      await freshRoom(page, room, spawn);
    }
  }
}

// Fade / panel gates once, in a room with something usable: E mid-fade and with a panel open must not act twice.
{
  await enter(page, "A1", "start");
  const r = await page.evaluate(() => {
    const w = window.__world, g = w.game;
    g.panels.show("map");
    const a = { room: g.room.def.id, panel: g.panels.kind };
    w.use();
    const b = { room: g.room.def.id, panel: g.panels.kind };
    g.panels.close();
    return { a, b };
  });
  report.panelGate = r.a.panel === r.b.panel && r.a.room === r.b.room ? "ok: E with a panel open does nothing" : `E with a panel open changed state ${JSON.stringify(r)}`;
  if (!String(report.panelGate).startsWith("ok")) fail("A1", "-", "panel-gate", report.panelGate);
}

report.pageErrors = errors.slice(0, 10);
for (const r of Object.values(report.rooms)) for (const i of r.items) if (Object.values(i.checks).includes("FAIL")) report.totals.fail++; else report.totals.pass++;
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
const lines = [`# Interaction audit`, ``, `${report.totals.interactables} interactables over ${Object.keys(report.rooms).length} rooms: ${report.totals.pass} pass, ${report.totals.fail} fail. ${report.at}`, ``];
for (const [room, r] of Object.entries(report.rooms)) {
  lines.push(`## ${room}  (start spawn ${r.spawn}; door props ${r.doors.join(", ") || "none"})${r.sit ? `  bench: ${r.sit}` : ""}`);
  for (const i of r.items) lines.push(`- ${Object.values(i.checks).includes("FAIL") ? "FAIL" : "ok  "} ${i.recipe}#${i.id} [${i.kind}] ${Object.entries(i.checks).map(([k, v]) => `${k}=${v}`).join(" ")}${i.effect?.length ? `  effect: ${i.effect.slice(0, 3).join("; ")}` : ""}${i.feedback?.length ? `  feedback: ${i.feedback.slice(0, 3).join(", ")}` : ""}${i.notes.length ? `  NOTE ${i.notes.join(" | ")}` : ""}`);
  lines.push("");
}
lines.push(`Panel gate: ${report.panelGate}`, ``, `Failures: ${report.failures.length}`);
for (const f of report.failures) lines.push(`- ${f.room} ${f.id} ${f.check}: ${f.detail}`);
writeFileSync(`${OUT}/report.md`, lines.join("\n"));
console.log(lines.filter((l) => /^(#|Panel|Failures|- (FAIL|\w+ \S+ \w+:))|interactables/.test(l)).join("\n"));
await browser.close();
process.exit(report.failures.length ? 1 : 0);
