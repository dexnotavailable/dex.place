// Stonetop (B4): the colossus passing at eye level, measured (lane R-B):
//   node src/world/rooms/plain/_tools/stonetop.mjs [--port 24301] [--w 1280 --h 720]
// Stands on the summit bench's shelf, waits for the vista hold, then steps
// until the keeper says the colossus is passing mid-frame, and measures how
// much of the frame it fills: the frame rendered with and without the
// colossus's layers, diffed, above its waterline. Also measures it from the
// causeway's road for comparison, and saves both frames.
// Writes review/world/phase2/R-B/stonetop.json and PNGs.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PORT = arg("port", process.env.WORLD_PORT ?? "24301");
const OUT = "review/world/phase2/R-B";
mkdirSync(`${OUT}/stonetop`, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: +arg("w", 1280), height: +arg("h", 720) } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const ev = (fn, a) => page.evaluate(fn, a);
await page.goto(`http://127.0.0.1:${PORT}/world/?manual&fresh`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
for (let k = 0; k < 300 && (await ev(() => window.__world.game.loading)); k++) {
  await page.waitForTimeout(100);
  await ev(() => window.__world.advance(1));
}
await ev(() => window.__world.begin());
await ev(() => window.__world.teleport("B2", "east"));
for (let k = 0; k < 300; k++) {
  if (await ev(() => { const b = window.__world.game.room.backdrop; return !window.__world.game.trans && (!b || b.ready()); })) break;
  await ev(() => window.__world.advance(1));
  await page.waitForTimeout(50);
}

/** Read back the world target (1280 x 720) with or without the colossus's layers. */
const grab = () =>
  ev(() => {
    const g = window.__world.game;
    const bd = g.room.backdrop;
    const names = ["colossus", "colossus-dust", "spray", "wheelers", "eye-glint"];
    const frame = () => {
      g.render();
      const gl = g.r.gl;
      const t = g.r.main;
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo ?? t.fb ?? t.framebuffer);
      const px = new Uint8Array(1280 * 720 * 4);
      gl.readPixels(0, 0, 1280, 720, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return px;
    };
    const a = frame();
    const saved = [];
    for (const l of bd.layers) if (names.includes(l.def.name)) { saved.push([l, l.def.opacity]); l.def.opacity = 0; }
    const b = frame();
    for (const [l, o] of saved) l.def.opacity = o;
    // rows (top-down) where the colossus changed the frame, and its waterline on screen
    let top = -1, bottom = -1, n = 0;
    for (let y = 0; y < 720; y++) {
      let any = false;
      for (let x = 0; x < 1280 && !any; x += 2) {
        const i = ((719 - y) * 1280 + x) * 4;
        if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 18) any = true;
      }
      if (any) {
        if (top < 0) top = y;
        bottom = y;
        n++;
      }
    }
    const surf = bd.layers.find((l) => l.def.name === "colossus")?.def.bounds?.y1 ?? null;
    return { top, bottom, rows: n, surfaceLayerRow: surf, camY: g.camera.y, keeper: g.room.prop("keeper")?.state, player: Math.round(g.player.body.y - g.camera.y) };
  });

async function waitPassing(maxS) {
  for (let s = 0; s < maxS; s += 1) {
    const st = await ev(() => { for (let k = 0; k < 60; k++) window.__world.game.realTick(); return window.__world.game.room.prop("keeper")?.state; });
    if (st === "passing") return s;
  }
  return -1;
}
const report = { errors };
// on the causeway's road first (for comparison)
await ev(() => { const w = window.__world; const o = w.game.room.def.origin; const px = (126.8 - o[0]) * 80; w.place(px, (o[1] - 1.2) * 80); });
report.road = { waited: await waitPassing(200) };
await ev(() => { for (let k = 0; k < 60 * 6; k++) window.__world.game.realTick(); });
Object.assign(report.road, await grab());
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/stonetop/road-pass.png` });
// then on the summit (B4): the vista holds after 2 s standing still
await ev(() => { const w = window.__world; const o = w.game.room.def.origin; const px = (163.4 - o[0]) * 80; w.place(px, (o[1] - 17.3) * 80); });
await ev(() => { for (let k = 0; k < 60 * 3; k++) window.__world.game.realTick(); });
report.summit = { waited: await waitPassing(200) };
await ev(() => { for (let k = 0; k < 60 * 6; k++) window.__world.game.realTick(); });
Object.assign(report.summit, await grab(), { area: await ev(() => window.__world.game.area?.id ?? null), cameraMode: await ev(() => window.__world.state().cameraMode) });
await ev(() => window.__world.render());
await page.screenshot({ path: `${OUT}/stonetop/summit-pass.png` });
for (const k of ["road", "summit"]) {
  const r = report[k];
  // the body above its waterline on screen (its reflection below is not the body)
  r.waterlineOnScreen = r.surfaceLayerRow - Math.floor(r.camY / 9 + 0.5);
  const bottom = Math.min(r.bottom, r.waterlineOnScreen);
  r.fillsFrame = r.top >= 0 ? +((bottom - r.top + 1) / 720).toFixed(3) : 0;
  r.playerFeetOnScreen = r.player ? r.player : undefined;
}
writeFileSync(`${OUT}/stonetop.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
