// R-C: where a room's frame goes (simulation vs render; per pixel prop update time).
//   node src/world/rooms/hollow/_tools/prof.mjs <room> <x> [--port 24401]
import { createRequire } from "node:module";
const require = createRequire(process.env.PW_ROOT ?? new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const [room = "C1", xs = "214"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const i = process.argv.indexOf("--port");
const PORT = i >= 0 ? process.argv[i + 1] : "24401";
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh&mute&room=${room}`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
for (let k = 0; k < 600 && (await page.evaluate(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__world.advance(1));
}
await page.evaluate(() => window.__world.begin());
await page.evaluate((x) => {
  const w = window.__world;
  const o = w.game.room.def.origin;
  const px = (x - o[0]) * 80;
  w.place(px, w.game.room.collision.groundAt(px, w.game.player.body.y - 240));
}, +xs);
for (let k = 0; k < 300 && !(await page.evaluate(() => { const b = window.__world.game.room.backdrop; return !b || b.ready(); })); k++) await page.waitForTimeout(100);
const r = await page.evaluate(() => {
  const w = window.__world;
  const g = w.game;
  const gl = g.r.gl;
  const px = new Uint8Array(4);
  w.advance(600);
  const world = g.room.pixel?.world;
  const per = new Map();
  if (world)
    for (const p of world.props) {
      const u = p.update.bind(p);
      p.update = (dt) => {
        const t0 = performance.now();
        u(dt);
        per.set(p.id, (per.get(p.id) ?? 0) + performance.now() - t0);
      };
    }
  let stepT = 0;
  if (world) {
    const st = world.step.bind(world);
    world.step = (dt) => { const a = performance.now(); st(dt); stepT += performance.now() - a; };
  }
  let sim = 0, ren = 0;
  const N = 120;
  for (let k = 0; k < N; k++) {
    const a = performance.now();
    g.realTick();
    const b = performance.now();
    g.render();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    ren += performance.now() - b;
    sim += b - a;
  }
  const top = [...per].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k, +(v / N).toFixed(3)]);
  let bgT = 0;
  const bd = g.room.backdrop;
  if (bd) {
    const a = performance.now();
    for (let k = 0; k < 30; k++) {
      bd.render(g.r.main, "back");
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    bgT = (performance.now() - a) / 30;
  }
  const awake = world ? { cloths: world.props.flatMap((p) => p.cloths).filter((c) => !c.sleeping).map((c) => 1).length, ropes: world.props.flatMap((p) => p.ropes).filter((r) => !r.sleeping).length, dynamic: world.props.flatMap((p) => p.parts).filter((q) => q.dynamic).length, particles: world.particles?.count ?? world.particles?.n, big: world.props.flatMap((p) => p.parts.map((q) => [p.id + "/" + q.name, q.grid.W * q.grid.Hh])).sort((a, b) => b[1] - a[1]).slice(0, 6) } : null;
  // what the step spends on: turn one kind off at a time and time the step again
  const trial = (label, off, on) => {
    off();
    let t = 0;
    for (let k = 0; k < 60; k++) { const a = performance.now(); world.step(1 / 60); t += performance.now() - a; }
    on();
    return [label, +(t / 60).toFixed(2)];
  };
  const kinds = [];
  if (world) {
    const saveC = world.props.map((p) => p.cloths), saveR = world.props.map((p) => p.ropes), saveD = world.props.flatMap((p) => p.parts.map((q) => [q, q.dynamic]));
    kinds.push(trial("all", () => {}, () => {}));
    for (const p of world.props) if (p.ropes.length) {
      const q = p.ropes;
      const dq = p.parts.filter((x) => x.dynamic).map((x) => [x, x.dynamic]);
      kinds.push(trial(`without ${p.id} (${p.parts.map((x) => x.grid.W + "x" + x.grid.Hh).join(",")})`, () => { p.ropes = []; }, () => { p.ropes = q; }));
      kinds.push(trial(`without ${p.id} redraw`, () => dq.forEach(([x]) => (x.dynamic = null)), () => dq.forEach(([x, d]) => (x.dynamic = d))));
    }
    kinds.push(trial("no cloth", () => world.props.forEach((p) => (p.cloths = [])), () => world.props.forEach((p, i) => (p.cloths = saveC[i]))));
    kinds.push(trial("no ropes", () => world.props.forEach((p) => (p.ropes = [])), () => world.props.forEach((p, i) => (p.ropes = saveR[i]))));
    kinds.push(trial("all again", () => {}, () => {}));
    kinds.push(trial("no dynamic parts", () => saveD.forEach(([q]) => (q.dynamic = null)), () => saveD.forEach(([q, d]) => (q.dynamic = d))));
  }
  return { kinds, stepMs: +(stepT / N).toFixed(2), awake, simMs: +(sim / N).toFixed(2), renderMs: +(ren / N).toFixed(2), backdropBackMs: +bgT.toFixed(2), layers: bd?.stats, pixelProps: world?.props.length, parts: world?.props.reduce((n, p) => n + p.parts.length, 0), topUpdates: top };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
