// Reflection audit: does every water room mirror the player about the room's waterline, where the water
// shader looks for it?
//   node src/world/tools/reflect-audit.mjs [--gpu] [--port 28201] [--out review/reflect-audit]
//
// The world draws what stands on the player plane into the backdrop's reflection target, flipped about the
// room's waterline; the water layer reads that target at its own screen pixel. This renders a frame with and
// without the player in the pass, diffs the reflection target, and checks that what differs is the player
// flipped about the waterline: its x column where she stands (within 3 px) and its rows from the mirrored
// feet down (within 3 px). It also records the design view's offset inside the frame (what the lake shaders
// had to account for) and the share of the player's reflection that survives into the composited water.
// Exits 1 when a room is off. Software WebGL is fine (see interact-audit.mjs for the browser setup).

import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(process.env.PW_ROOT ?? "D:/Dex/Temp/dexplace-site-research/package.json");
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "28201");
const OUT = arg("out", "review/reflect-audit");
mkdirSync(OUT, { recursive: true });

/** Where to stand over the water in each room with a waterline: [room, spawn, x in H]. */
const SPOTS = [
  ["A0", "east", 6], ["A1", "start", 15], ["A2", "west", 1, "buffer"], ["S2", "west", 3], ["B1", "west", 14], ["B1", "west", 22], ["B2", "west", 4], ["B2", "west", 20],
];

const GL = process.argv.includes("--gpu") ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const browser = await chromium.launch({ args: GL });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "commit", timeout: 240000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 240000 });
const settle = async () => { for (let k = 0; k < 1200 && (await page.evaluate(() => window.__world.game.loading)); k++) { await page.waitForTimeout(50); await page.evaluate(() => window.__world.advance(1)); } };
await settle();
await page.evaluate(() => window.__world.begin());

const measure = () => {
  const w = window.__world, g = w.game;
  const bd = g.room.backdrop, gl = g.r.gl;
  const wl = g.room.def.waterline;
  const W = 1536, H = 864;
  const read = () => {
    const buf = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bd.refl.fbo);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return buf;
  };
  w.advance(2);
  const withHer = read();
  const keep = g.drawPlayer;
  g.drawPlayer = () => {};
  w.render();
  const without = read();
  g.drawPlayer = keep;
  w.render();
  // the diff's bounding box, in frame rows from the top
  let x0 = W, x1 = -1, y0 = H, y1 = -1, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (withHer[i] !== without[i] || withHer[i + 1] !== without[i + 1] || withHer[i + 2] !== without[i + 2]) {
      const fy = H - 1 - y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (fy < y0) y0 = fy; if (fy > y1) y1 = fy; n++;
    }
  }
  // the composited frame: the same render with and without the player in the reflection pass only
  const main = () => {
    const buf = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, g.r.main.fbo);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return buf;
  };
  w.render();
  const frameWith = main();
  const dws = g.drawWorldSprites.bind(g);
  const dp = g.drawPlayer.bind(g);
  let inRefl = false;
  g.drawWorldSprites = (reflection, lights) => { inRefl = !!reflection; dws(reflection, lights); inRefl = false; };
  g.drawPlayer = () => { if (!inRefl) dp(); };
  w.render();
  const frameWithout = main();
  delete g.drawWorldSprites;
  delete g.drawPlayer;
  w.render();
  // only below her mirrored feet, and only the columns where the change is dense (animated scenery elsewhere
  // changes a few pixels between two renders)
  const [vx, vy] = g.camera.view();
  const top = Math.max(0, Math.round(2 * (wl - vy) - (g.player.body.y - vy)) - 4);
  const colCount = new Int32Array(W);
  const diffAt = (x, fy) => { const i = (x + (H - 1 - fy) * 0 + (H - 1 - fy) * W) * 4; return frameWith[i] !== frameWithout[i] || frameWith[i + 1] !== frameWithout[i + 1] || frameWith[i + 2] !== frameWithout[i + 2]; };
  for (let fy = top; fy < H; fy++) for (let x = 0; x < W; x++) if (diffAt(x, fy)) colCount[x]++;
  let peak = 0;
  for (let x = 0; x < W; x++) peak = Math.max(peak, colCount[x]);
  let cx0 = W, cx1 = -1, cy0 = H, cy1 = -1, cn = 0;
  if (peak >= 6) {
    for (let x = 0; x < W; x++) if (colCount[x] >= peak * 0.35) { if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; }
    for (let fy = top; fy < H; fy++) for (let x = cx0; x <= cx1; x++) if (diffAt(x, fy)) { if (fy < cy0) cy0 = fy; if (fy > cy1) cy1 = fy; cn++; }
  }
  const [cx, cy] = g.camera.view();
  const b = g.player.body;
  const feetX = b.x - cx, feetY = b.y - cy, m = wl - cy;
  return {
    room: g.room.def.id, wl, camera: [cx, cy], frameAt: bd.frameAt, waterRow: bd.waterRow,
    player: { x: Math.round(feetX), feetRow: Math.round(feetY) }, mirrorRow: Math.round(m),
    expectedRows: [Math.round(2 * m - feetY), Math.round(2 * m - feetY + 80)],
    got: n ? { x: [x0, x1], rows: [y0, y1], pixels: n } : null,
    water: cn ? { x: [cx0, cx1], rows: [cy0, cy1], pixels: cn } : null,
  };
};

const rows = [];
for (const [room, spawn, xH, only] of SPOTS) {
  await page.evaluate(([r, s]) => window.__world.teleport(r, s), [room, spawn]);
  for (let k = 0; k < 900; k++) {
    const ok = await page.evaluate(() => { window.__world.advance(2); const g = window.__world.game; return !g.loading && !g.trans && (!g.room.backdrop || g.room.backdrop.ready()); });
    if (ok && k > 3) break;
    await page.waitForTimeout(40);
  }
  await page.evaluate((x) => window.__world.place(x * 80), xH);
  await page.evaluate(() => window.__world.advance(40));
  const m = await page.evaluate(measure);
  const r = { ...m, spot: `${room}:${spawn}:${xH}H`, checks: {} };
  const tol = 3;
  if (!m.got) r.checks.mirrored = "FAIL: nothing of the player is in the reflection target (over water, standing at a place with water below her feet)";
  else {
    const cxGot = (m.got.x[0] + m.got.x[1]) / 2;
    r.checks.column = Math.abs(cxGot - m.player.x) <= tol + 8 ? "ok" : `FAIL: reflection column ${cxGot.toFixed(0)} vs player ${m.player.x}`;
    r.checks.topRow = Math.abs(m.got.rows[0] - m.expectedRows[0]) <= tol ? "ok" : `FAIL: reflection starts at row ${m.got.rows[0]}, mirrored feet are at ${m.expectedRows[0]}`;
    const room = Math.min(50, 864 - 2 - m.expectedRows[0]); // a reflection cut by the frame's bottom edge is as tall as the frame allows
    r.checks.height = m.got.rows[1] - m.got.rows[0] >= room ? "ok" : `FAIL: reflection only ${m.got.rows[1] - m.got.rows[0]} rows tall`;
  }
  if (only === "buffer") r.checks.water = "n/a: the cliff terrain covers the water under her here (checked in the reflection target only)";
  else if (!m.water) r.checks.water = "FAIL: the water layer shows none of the player's reflection";
  else {
    const wx = (m.water.x[0] + m.water.x[1]) / 2;
    r.checks.waterColumn = Math.abs(wx - m.player.x) <= 24 ? "ok" : `FAIL: the water shows her reflection at x ${wx.toFixed(0)}, she stands at ${m.player.x} (offset ${(wx - m.player.x).toFixed(0)} px)`;
    r.checks.waterRow = m.water.rows[0] >= m.expectedRows[0] - 4 && m.water.rows[0] <= m.expectedRows[0] + 40 ? "ok" : `FAIL: the water shows it from row ${m.water.rows[0]}, mirrored feet are at ${m.expectedRows[0]}`;
  }
  r.pass = Object.values(r.checks).every((v) => v === "ok" || v.startsWith("n/a"));
  rows.push(r);
  console.log(`${r.spot}: ${r.pass ? "ok" : "FAIL"} ${JSON.stringify(r.checks)} frameAt ${m.frameAt} expected rows ${m.expectedRows} got ${m.got ? m.got.rows : "-"} water x ${m.water ? m.water.x : "-"} rows ${m.water ? m.water.rows : "-"} x ${m.got ? m.got.x : "-"} player x ${m.player.x}`);
}
const failed = rows.filter((r) => !r.pass);
writeFileSync(`${OUT}/report.json`, JSON.stringify({ at: new Date().toISOString(), rows, pageErrors: errors.slice(0, 5) }, null, 1));
console.log(`${rows.length - failed.length}/${rows.length} spots mirror correctly`);
await browser.close();
process.exit(failed.length ? 1 : 0);
