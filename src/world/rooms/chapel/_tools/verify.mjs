// Region E end to end with real input (lane R-E): node src/world/rooms/chapel/_tools/verify.mjs [--port 24601]
//
// From the top of the pilgrim path to the keeper's loft, playing through the real game with the
// round's walker (src/world/tools/bot.js: real key presses, real E, real transitions):
//   E1  walk down the flights (the missing panel is jumped), rest at shrine 5 -> the lamp posts
//       below light one after another; strike the rib bell from its bracket
//   E2  rest at shrine 6; the chapel doors: one E opens them and takes you in
//   E3  the art: every frame opens its own work (panel, one image, alt text, previous / next /
//       all works, arrow keys); the catalogue shows all nine; frames ignore hits and nothing
//       fractures in the nave (every move, cells counted before and after); the thumbnails sit
//       exactly on their frames; the crank opens the rose window and the light sweeps; the bench
//       sits you down and the camera holds on the niches
//   E4  up the stair; the latch: E releases the rail, the bell rings once by itself, the door
//       opens onto the A3 loft (latch:sky-door, round:done)
//   then a reload: rose:open, latch:sky-door, shrine:5/6 persist; the loft door leads back to E4
// Writes review/world/phase2/R-E/verify/verify.json and PNGs.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24601");
const OUT = "review/world/phase2/R-E/verify";
mkdirSync(OUT, { recursive: true });
const BOT = readFileSync(new URL("../../../tools/bot.js", import.meta.url), "utf8");

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});
const ev = (fn, a) => page.evaluate(fn, a);
const report = { checks: {}, errors };
const ok = (name, pass, detail) => {
  report.checks[name] = { pass: !!pass, ...(detail === undefined ? {} : { detail }) };
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail !== undefined ? ` ${JSON.stringify(detail).slice(0, 300)}` : ""}`);
};

async function open(query) {
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&mute&${query}`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  await page.addScriptTag({ content: BOT });
  for (let k = 0; k < 400; k++) {
    if (!(await ev(() => window.__world.game.loading))) break;
    await page.waitForTimeout(100);
    await ev(() => window.__world.advance(1));
  }
  await ev(() => window.__world.begin());
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
    r = await run("walk", x, 4000);
    const s = await st();
    if (s.room === before) return r;
    await run("wait", 20);
    const ox = await ev(() => { const d = window.__world.game.room.def; return [d.origin?.[0] ?? 0, (d.origin?.[0] ?? 0) + d.w / 80]; });
    if (x < ox[0] || x > ox[1] || Math.abs((await st()).x - x) < 0.3) return r;
  }
  return r;
}
const use = () => run("use");
const wait = (t, until) => run("wait", t, until);
async function ready() {
  for (let k = 0; k < 400; k++) {
    if (await ev(() => { const g = window.__world.game; const b = g.room.backdrop; return !g.loading && !g.trans && (!b || b.ready()); })) return;
    await page.waitForTimeout(80);
    await ev(() => window.__world.advance(1));
  }
}
async function shot(name) {
  await ev(() => window.__world.render());
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
const px = (id) => ev((id) => { const p = window.__world.game.room.pixel?.world.find(id); return p ? { state: p.state, data: { ...p.data } } : null; }, id);
const cellsOf = (ids) => ev((ids) => { const w = window.__world.game.room.pixel.world; const out = {}; for (const id of ids) { const p = w.find(id); if (!p) continue; out[id] = p.parts.reduce((n, q) => n + (q.dynamic ? 0 : q.grid.count), 0); } return out; }, ids);

// ------------------------------------------------------------------ E1
await open("fresh");
await ev(() => window.__world.teleport("E1", "west"));
await ready();
await run("wait", 30);
await shot("e1-top");
const e1Start = await st();
ok("E1 starts at the top of the path (x 316.5, y 84)", e1Start.room === "E1" && Math.abs(e1Start.y - 84) < 0.05, e1Start);
await walk(356.6);
const jumps = await ev(() => window.__bot.jumps().filter((j) => j.room === "E1"));
ok("E1 walkable to the terrace; every jump inside the limits (gaps <= 1.1 H, ledges <= 0.9 H)", (await st()).x > 356 && jumps.every((j) => (j.gap === null || j.gap <= 1.15) && j.rise <= 0.95), jumps);
const lampsBefore = await ev(() => ["lamp-5-0", "lamp-5-1", "lamp-5-2", "lamp-5-3"].map((id) => window.__world.game.room.pixel.world.find(id)?.state));
await use();
const litAt = [];
for (let k = 0; k < 24; k++) {
  await run("wait", 15);
  const s = await ev(() => ["lamp-5-0", "lamp-5-1", "lamp-5-2", "lamp-5-3"].map((id) => window.__world.game.room.pixel.world.find(id)?.state));
  litAt.push(s.map((q) => (q === "on" ? 1 : 0)).join(""));
}
const flag5 = await ev(() => window.__world.game.save.get("shrine:5"));
ok("shrine 5: resting lights it (shrine:5) and the lamp posts come on one after another", flag5 && lampsBefore.every((q) => q === "off") && litAt.at(-1) === "1111" && new Set(litAt).size >= 4, { lampsBefore, litAt });
await shot("e1-shrine5-lit");
// the rib bell: climb the bracket and strike
await ev(() => { const w = window.__world; const o = w.game.room.def.origin; w.place((341.5 - o[0]) * 80, (90 - 70.9) * 80); });
await run("wait", 20);
const bellBefore = (await px("rib-bell")).state;
await run("slash", 1);
const bellAfter = (await px("rib-bell")).state;
ok("E1 rib bell: from its bracket a strike swings and rings it", bellBefore === "rest" && bellAfter === "swinging", { bellBefore, bellAfter });
await shot("e1-rib-bell");
await walk(396.4);
ok("E1 -> E2 at the bottom of the path", (await st()).room === "E2");

// ------------------------------------------------------------------ E2
await ready();
await walk(399.0);
await use();
await run("wait", 100);
ok("shrine 6 (the last lamp): resting lights it (shrine:6)", await ev(() => window.__world.game.save.get("shrine:6")));
await shot("e2-porch");
await walk(407.9);
const doorNear = (await use()).near;
await run("wait", 1200, "room", "E2");
ok("E2 chapel doors: one E opens them and takes you into E3", (await st()).room === "E3", { near: doorNear });

// ------------------------------------------------------------------ E3
await ready();
await run("wait", 30);
await shot("e3-arrival");
const breakage = await ev(() => window.__world.game.room.pixel.world.breakage);
ok("the nave rule is on in E3 (pixel matter sway-only)", breakage === "sway", breakage);
// every frame opens its own work in the panel
const works = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];
const panelChecks = [];
for (const w of works) {
  const x = await ev((id) => { const g = window.__world.game; const p = g.room.pixel.world.find(`art-${id}`); const o = g.room.def.origin; return o[0] + p.x / 80; }, w);
  await walk(x - 0.2);
  const u = await use();
  await run("wait", 3);
  const pan = await ev(() => { const el = document.getElementById("panel"); const img = el.querySelector(".body figure img"); return { open: !el.hidden, kind: el.dataset.kind, src: img?.getAttribute("src"), alt: img?.alt, nav: !!el.querySelector(".art-nav"), title: el.querySelector("h2")?.textContent }; });
  panelChecks.push({ w, near: u.near, ...pan });
  if (w === "03") await shot("e3-panel-03");
  await run("closePanel");
}
ok("E on each frame opens that work alone (panel, its own image from public/gallery, alt text)", panelChecks.every((c) => c.open && c.kind === "gallery" && c.src === `/gallery/${c.w}.webp` && c.alt && c.alt.length > 8), panelChecks);
ok("the work panel has previous / next / all works", panelChecks.every((c) => c.nav));
// previous / next / arrow keys
await ev(() => window.__world.game.panels.show("gallery", "05"));
await ev(() => document.querySelector("#panel .art-nav .next").click());
const afterNext = await ev(() => document.querySelector("#panel .body figure img")?.getAttribute("src"));
await ev(() => document.getElementById("panel").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
const afterLeft = await ev(() => document.querySelector("#panel .body figure img")?.getAttribute("src"));
await ev(() => document.querySelector("#panel .art-nav .all").click());
const allCount = await ev(() => document.querySelectorAll("#panel .catalogue img").length);
await ev(() => window.__world.game.panels.close());
ok("next / left arrow / all works step through the real gallery", afterNext === "/gallery/06.webp" && afterLeft === "/gallery/05.webp" && allCount === 9, { afterNext, afterLeft, allCount });
// the catalogue lectern
await walk(416.5);
const lec = await use();
await run("wait", 3);
const cat = await ev(() => ({ kind: document.getElementById("panel").dataset.kind, n: document.querySelectorAll("#panel .catalogue img").length, alts: [...document.querySelectorAll("#panel .catalogue img")].every((i) => i.alt.length > 8) }));
await shot("e3-catalogue");
await run("closePanel");
ok("the lectern opens the catalogue: all nine, alt text kept", lec.near === "catalogue" && cat.kind === "gallery" && cat.n === 9 && cat.alts, { near: lec.near, ...cat });
// thumbnails pinned on their frames (CSS rect == frame board rect through the presenter)
await walk(431.8);
await run("wait", 5);
const pin = await ev(() => {
  const g = window.__world.game;
  g.render();
  const canvas = g.r.canvas, pr = g.r.presenter.rect, k = canvas.clientWidth / canvas.width;
  const [cx, cy] = g.camera.view();
  const top = canvas.height - pr.y - pr.h;
  const u = (f) => Math.round(f * 80);
  return window.__chapelArt.report().filter((r) => r.visible).map((r) => {
    const id = r.key.replace("thumb-", "");
    const f = g.room.pixel.world.find(`art-${id}`);
    // the frame's board from its own placement (origin, sizes in H), independent of the overlay's code
    const x0 = f.x - Math.floor(u(f.params.w) / 2);
    const y1 = f.y - (u(f.params.sill) + u(0.15));
    const y0 = y1 - u(f.params.h);
    const L = (pr.x + (x0 - cx) * pr.scale) * k, T = (top + (y0 - cy) * pr.scale) * k;
    return { id, dl: +(r.left - L).toFixed(2), dt: +(r.top - T).toFixed(2), w: +r.width.toFixed(1), h: +r.height.toFixed(1), src: r.src.replace(/^.*\/gallery\//, "") };
  });
});
ok("thumbnails sit exactly on their frames' boards at 1080p (1.5x): within half a CSS px, 288 x 162 for a 2.4 x 1.35 H work", pin.length >= 2 && pin.every((p) => Math.abs(p.dl) <= 0.5 && Math.abs(p.dt) <= 0.5 && p.w === 288 && p.h === 162), pin);
await shot("e3-thumbs-1080");
// frames ignore hits; nothing fractures in the nave
const ids = ["art-03", "art-04", "pew-429.7", "pew-435.1", "rack-419.9", "censer", "tapestry-0", "candelabra-west"];
const before = await cellsOf(ids);
for (const x of [431.8, 434.6, 437.6]) {
  await walk(x);
  for (const m of ["m1", "m1", "m1"]) {
    await ev((m) => window.__world.press(m), m);
    await run("wait", 3);
    await ev((m) => window.__world.release(m), m);
    await run("wait", 22);
  }
  for (const act of ["skill", "ult"]) {
    await ev((a) => window.__world.press(a), act);
    await run("wait", 3);
    await ev((a) => window.__world.release(a), act);
    await run("wait", 90);
  }
}
const after = await cellsOf(ids);
const chunks = await ev(() => window.__world.game.room.pixel.world.chunks.length);
ok("nave rule: slashes, Q and R near the frames, pews, candles, censer and tapestry remove no cell", ids.every((id) => before[id] === after[id]) && chunks === 0, { before, after, chunks });
// candelabras gutter when struck and relight by themselves (WORLD-PLAN E3: "gutter out and relight if hit")
const flames = () => ev(() => { const p = window.__world.game.room.pixel.world.find("candelabra-west"); return { state: p.state, out: p.refs.flames.filter((f) => f.target === 0).length, n: p.refs.flames.length }; });
await walk(419.0);
let struck = await flames();
for (let k = 0; k < 6 && struck.out === 0; k++) {
  await ev(() => window.__world.press("m1"));
  await run("wait", 3);
  await ev(() => window.__world.release("m1"));
  await run("wait", 14);
  struck = await flames();
}
await walk(421.5); // step away: nobody presses E
await run("wait", 60 * 7);
const relit = await flames();
ok("a candelabra struck in the nave gutters and relights by itself within 7 s (no E)", struck.out > 0 && relit.out === 0 && relit.state === "lit", { struck, relit });
// the rose window: the crank opens it, the light sweeps and settles
await walk(414.4);
const crank = await use();
const roseStates = [];
for (let k = 0; k < 20; k++) {
  await run("wait", 60);
  roseStates.push((await px("rose-window")).state);
}
const roseFlag = await ev(() => window.__world.game.save.get("rose:open"));
ok("the crank opens the rose shutter (rose:open) and the light sweeps down the nave, then settles", crank.near === "rose-crank" && roseFlag && roseStates.includes("sweeping") && roseStates.at(-1) === "lit", { near: crank.near, roseStates });
await shot("e3-rose-open");
// sit and look
await walk(445.1);
const sit = await use();
await run("wait", 200);
const sitState = await ev(() => { const g = window.__world.game; return { sitting: !!g.sitting, override: g.camera.override, camX: g.camera.x }; });
await shot("e3-sit-look");
ok("the bench to sit and look: E sits, the camera holds on the east niches", sit.near === "look-bench" && sitState.sitting && sitState.override?.cx > 0, { near: sit.near, ...sitState });
await ev((a) => window.__world.press(a), "right");
await run("wait", 5);
await ev((a) => window.__world.release(a), "right");

// ------------------------------------------------------------------ E4
await walk(458.4);
ok("E3 -> E4 through the east arch", (await st()).room === "E4");
await ready();
await walk(484.4);
await run("wait", 150);
await shot("e4-balcony");
const bellRest = (await px("chapel-bell")).state;
const latch = await use();
const seq = [];
for (let k = 0; k < 60; k++) {
  const r = await run("wait", 4);
  const s = await st();
  const b = s.room === "E4" ? await px("chapel-bell") : null;
  const d = s.room === "E4" ? await px("sky-door-balcony") : null;
  seq.push([s.room, b?.state ?? "-", d?.state ?? "-"].join("/"));
  if (s.room === "A3") break;
  void r;
}
await ready();
const home = await ev(() => ({ room: window.__world.game.room.def.id, latch: window.__world.game.save.get("latch:sky-door"), round: window.__world.game.save.get("round:done") }));
ok("the latch: E releases the rail, the chapel bell rings once by itself, the door opens onto the A3 loft", latch.near === "sky-door-balcony" && bellRest === "rest" && seq.some((q) => q.includes("/swinging/")) && home.room === "A3" && home.latch && home.round, { near: latch.near, seq: [...new Set(seq)], home });
await shot("a3-loft-arrival");

// ------------------------------------------------------------------ reload
await open("");
const persisted = await ev(() => ["shrine:5", "shrine:6", "rose:open", "latch:sky-door", "round:done"].map((k) => [k, window.__world.game.save.get(k)]));
ok("after a reload the region's flags persist", persisted.every(([, v]) => v), persisted);
await ev(() => window.__world.teleport("E3", "west"));
await ready();
await run("wait", 30);
ok("after a reload the rose window stays open (the nave stays sunlit)", (await px("rose-window")).state === "lit");
await shot("e3-reload-rose-lit");
await ev(() => window.__world.teleport("E1", "shrine"));
await ready();
await run("wait", 30);
const lampsReload = await ev(() => ["lamp-5-0", "lamp-5-1", "lamp-5-2", "lamp-5-3"].map((id) => window.__world.game.room.pixel.world.find(id)?.state));
ok("after a reload the path's lamp posts are on", lampsReload.every((q) => q === "on"), lampsReload);
await ev(() => window.__world.teleport("E4", "balcony"));
await ready();
await run("wait", 20);
const doorReload = await px("sky-door-balcony");
ok("after a reload the balcony's rail stays released", doorReload?.data?.unlatched === true, doorReload);

ok("no console errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/verify.json`, JSON.stringify(report, null, 1));
await browser.close();
const fails = Object.entries(report.checks).filter(([, c]) => !c.pass);
console.log(`\n${Object.keys(report.checks).length - fails.length}/${Object.keys(report.checks).length} checks passed`);
process.exit(fails.length ? 1 : 0);
