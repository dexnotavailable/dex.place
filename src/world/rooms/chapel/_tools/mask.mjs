// Rosace in front of Dex's art, measured in pixels (lane R-E):
//   node src/world/rooms/chapel/_tools/mask.mjs [--port 24601] [--only 1080,1440,phone]
// For each of the nine works in E3, at 1080p (1.5x), 1440p (2x) and a phone in
// landscape (844x390 at 3x, touch): Rosace stands under the frame (where E is
// pressed) and then jumps in front of it. At each moment three captures of the
// work's rect are taken on the same rendered frame:
//   S1 the page as shown, S2 the thumbnail with no mask (the art alone),
//   S3 the overlay hidden (the canvas: the board and her),
//   S4 the overlay hidden and the same frame rendered without her (the board alone),
//   S5 the same with her drawn flat magenta (where she is, even her dark ink).
// A pixel of S1 that matches S3 but not S2 is canvas showing through the art;
// it is "her" where S5 differs from S4 (she is drawn there), else it is the
// board showing through: a leak. The report counts both per capture, how many
// leak pixels sit within 3 px of her (a mask too big or misplaced would show
// there) and the biggest connected leak patch (a box or strip is hundreds of px)
// and writes S1 plus a leak map (leaks red, her green) under
// review/world/phase2/R-E/mask/<viewport>/.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(new URL("../../../../../tools/scene-pipeline/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const PORT = opt("port", process.env.WORLD_PORT ?? "24601");
const ONLY = opt("only", "1080,1440,phone").split(",");
const WORKS = opt("works", "");
const OUT = "review/world/phase2/R-E/mask";
const VPS = [
  { name: "1080", w: 1920, h: 1080, dpr: 1, touch: false },
  { name: "1440", w: 2560, h: 1440, dpr: 1, touch: false },
  { name: "phone", w: 844, h: 390, dpr: 3, touch: true },
].filter((v) => ONLY.includes(v.name));

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const summary = {};
for (const vp of VPS) {
  const dir = `${OUT}/${vp.name}`;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, hasTouch: vp.touch, isMobile: vp.touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  const lab = await ctx.newPage();
  await lab.setContent("<canvas></canvas>");
  await page.goto(`http://127.0.0.1:${PORT}/world/?manual&mute&fresh`, { waitUntil: "load", timeout: 120000 });
  await page.waitForFunction(() => !!window.__world, null, { timeout: 120000 });
  for (let k = 0; k < 300 && (await page.evaluate(() => window.__world.game.loading)); k++) {
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__world.advance(1));
  }
  await page.evaluate(() => { window.__world.begin(); window.__world.teleport("E3", "west"); });
  for (let k = 0; k < 400; k++) {
    const ok = await page.evaluate(() => { const g = window.__world.game; const b = g.room.backdrop; return !g.loading && !g.trans && (!b || b.ready()); });
    if (ok) break;
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__world.advance(1));
  }
  const works = await page.evaluate(() => window.__world.game.room.def.props.filter((p) => p.recipe === "art-thumb").map((p) => ({ id: p.id, x: p.x })));

  /** The three captures of one thumbnail's rect on the current frame, and the counts. */
  const measure = async (key, tag) => {
    const r = await page.evaluate((key) => {
      const im = window.__chapelArt.report().find((q) => q.key === key);
      const el = [...document.querySelectorAll("#chapel-art img")].find((e) => e.getBoundingClientRect().left === im.left && e.getBoundingClientRect().top === im.top);
      el.id = "probe";
      return { ...im, mask: el.dataset.mask || "", masked: window.__chapelArt.masked };
    }, key);
    // the art must be on screen before anything is measured (a thumbnail still loading would
    // read as "no art" and hide the very thing this tool looks for)
    let loaded = false;
    for (let k = 0; k < 100 && !loaded; k++) {
      loaded = await page.evaluate(() => { const e = document.getElementById("probe"); return !!e && e.complete && e.naturalWidth > 0; });
      if (!loaded) await page.waitForTimeout(100);
    }
    if (!loaded) errors.push(`${tag}: thumbnail not loaded`);
    if (!r.visible) errors.push(`${tag}: thumbnail hidden`);
    const clip = { x: Math.max(0, Math.floor(r.left)), y: Math.max(0, Math.floor(r.top)), width: Math.floor(r.width), height: Math.floor(r.height) };
    const s1 = await page.screenshot({ clip });
    await page.evaluate(() => { const s = document.getElementById("probe").style; s.mask = "none"; s.webkitMask = "none"; });
    const s2 = await page.screenshot({ clip });
    await page.evaluate(() => { document.getElementById("chapel-art").style.opacity = "0"; });
    const s3 = await page.screenshot({ clip });
    await page.evaluate(() => { const p = window.__world.game.player; p.draw = () => {}; window.__world.render(); });
    const s4 = await page.screenshot({ clip });
    await page.evaluate(() => { const p = window.__world.game.player; p.draw = function (r) { const d = this.spriteDraw(); if (d) r.sprite({ ...d, tint: [1, 0, 1, 1] }); }; window.__world.render(); });
    const s5 = await page.screenshot({ clip });
    await page.evaluate(() => { const e = document.getElementById("probe"); const p = window.__world.game.player; delete p.draw; document.getElementById("chapel-art").style.opacity = ""; delete e.dataset.mask; e.removeAttribute("id"); window.__world.render(); });
    writeFileSync(`${dir}/${tag}.png`, s1);
    if (process.env.MASK_DEBUG) { writeFileSync(`${dir}/${tag}-s2.png`, s2); writeFileSync(`${dir}/${tag}-s3.png`, s3); writeFileSync(`${dir}/${tag}-s5.png`, s5); }
    const res = await lab.evaluate(async ([a, b, c, e, f]) => {
      const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = `data:image/png;base64,${s}`; });
      const [i1, i2, i3, i4, i5] = await Promise.all([load(a), load(b), load(c), load(e), load(f)]);
      const W = i1.width, H = i1.height;
      const px = (i) => { const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, W, H).data; };
      const [p1, p2, p3, p4, p5] = [px(i1), px(i2), px(i3), px(i4), px(i5)];
      const d = (p, q, o) => Math.max(Math.abs(p[o] - q[o]), Math.abs(p[o + 1] - q[o + 1]), Math.abs(p[o + 2] - q[o + 2]));
      // board colour: median of the canvas in the rect (luma)
      const lum = [];
      for (let o = 0; o < p3.length; o += 4) lum.push(p3[o] * 0.3 + p3[o + 1] * 0.59 + p3[o + 2] * 0.11);
      const sorted = [...lum].sort((u, v) => u - v);
      const board = sorted[sorted.length >> 1];
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const x = cv.getContext("2d"); x.drawImage(i1, 0, 0);
      const m = x.getImageData(0, 0, W, H);
      let leak = 0, her = 0;
      const isLeak = new Uint8Array(W * H), isHer = new Uint8Array(W * H);
      for (let o = 0, k = 0; o < p1.length; o += 4, k++) {
        if (d(p5, p4, o) > 24) isHer[k] = 1; // she is drawn here
        if (d(p1, p2, o) <= 24) continue; // the art
        if (d(p1, p3, o) > 12) continue; // not the canvas (a blend at her edge, or resampling noise of the art)
        if (!isHer[k]) { leak++; isLeak[k] = 1; m.data[o] = 255; m.data[o + 1] = 0; m.data[o + 2] = 0; }
        else { her++; m.data[o] = m.data[o] * 0.4; m.data[o + 1] = 255; m.data[o + 2] = m.data[o + 2] * 0.4; }
      }
      // where the leaks are: within 3 px of her drawn pixels (a mask too big or misplaced),
      // and the biggest 8-connected patch (a box or strip of board is hundreds of px; the
      // art's own decode/resample noise between captures is isolated single pixels)
      let nearHer = 0, maxPatch = 0;
      const seen = new Uint8Array(W * H);
      for (let k = 0; k < W * H; k++) {
        if (!isLeak[k]) continue;
        const kx = k % W, ky = (k / W) | 0;
        let near = false;
        for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) {
          const qx = kx + dx, qy = ky + dy;
          if (qx >= 0 && qy >= 0 && qx < W && qy < H && isHer[qy * W + qx]) { near = true; break; }
        }
        if (near) nearHer++;
        if (seen[k]) continue;
        let n = 0;
        const st = [k];
        seen[k] = 1;
        while (st.length) {
          const q = st.pop();
          n++;
          const qx = q % W, qy = (q / W) | 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const rx = qx + dx, ry = qy + dy, r2 = ry * W + rx;
            if (rx >= 0 && ry >= 0 && rx < W && ry < H && isLeak[r2] && !seen[r2]) { seen[r2] = 1; st.push(r2); }
          }
        }
        maxPatch = Math.max(maxPatch, n);
      }
      x.putImageData(m, 0, 0);
      return { W, H, board: Math.round(board), leak, her, nearHer, maxPatch, map: cv.toDataURL("image/png").split(",")[1] };
    }, [s1.toString("base64"), s2.toString("base64"), s3.toString("base64"), s4.toString("base64"), s5.toString("base64")]);
    writeFileSync(`${dir}/${tag}-map.png`, Buffer.from(res.map, "base64"));
    return { tag, key, rect: clip, artLoaded: loaded && r.visible, masked: !!r.mask, board: res.board, leakPx: res.leak, leakNearHerPx: res.nearHer, leakMaxPatch: res.maxPatch, herPx: res.her, px: res.W * res.H };
  };

  const rows = [];
  for (const w of works.filter((q) => !WORKS || WORKS.split(",").includes(q.id))) {
    // stand under the frame, a little left of centre (where the critic stood to press E)
    for (const dx of [-0.2, 0, 0.3]) {
      await page.evaluate(([x, dx]) => {
        const g = window.__world;
        const px = x + dx * 80;
        g.place(px, g.game.room.collision.groundAt(px, 0));
        g.advance(90);
      }, [w.x, dx]);
      rows.push(await measure(w.id, `${w.id}-stand${dx}`));
    }
    // jump in front of it: capture on the rise, at the apex and on the fall
    await page.evaluate(([x]) => {
      const g = window.__world;
      const px = x;
      g.place(px, g.game.room.collision.groundAt(px, 0));
      g.advance(60);
      g.press("jump");
    }, [w.x]);
    let prevVy = -1;
    let n = 0;
    for (let k = 0; k < 70 && n < 3; k++) {
      const s = await page.evaluate(() => { window.__world.advance(1); const b = window.__world.game.player.body; return { vy: b.vy, grounded: b.grounded }; });
      const apex = prevVy < 0 && s.vy >= 0;
      if (k === 6 || apex || (n === 2 && s.vy > 2)) {
        rows.push(await measure(w.id, `${w.id}-jump${n}`));
        n++;
      }
      prevVy = s.vy;
      if (s.grounded && k > 4) break;
    }
    await page.evaluate(() => { window.__world.release("jump"); window.__world.advance(40); });
  }
  const leaks = rows.filter((r) => r.leakPx > 0);
  summary[vp.name] = { captures: rows.length, artLoaded: rows.filter((r) => r.artLoaded).length, masked: rows.filter((r) => r.masked).length, withLeak: leaks.length, maxLeakPx: Math.max(0, ...rows.map((r) => r.leakPx)), maxLeakNearHerPx: Math.max(0, ...rows.map((r) => r.leakNearHerPx)), maxLeakPatch: Math.max(0, ...rows.map((r) => r.leakMaxPatch)), herShownMax: Math.max(0, ...rows.map((r) => r.herPx)), errors };
  writeFileSync(`${dir}/mask.json`, JSON.stringify({ viewport: vp, rows, errors }, null, 1));
  console.log(vp.name, JSON.stringify(summary[vp.name]));
  await ctx.close();
}
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
await browser.close();
