// The engine lane's pixel grid (10-18): the zoomed-out reduction (render/reduce.ts, its CPU reference of the shaders'
// rule) and the screen-res actor layer's camera (render/actors.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { actorLayerPlan, actorMap, reduceFootprint, REDUCE_OPAQUE, screenCam } from "./render/grid.ts";
import { planeXf } from "./render/view.ts";

// keys: 0 clear, 1 light ground, 2 dark line, 3 rope, 4..9 a texture's colours
const LUMA = [0, 0.8, 0.1, 0.35, 0.5, 0.52, 0.54, 0.56, 0.58, 0.6];
const luma = (k) => LUMA[k] ?? 0.5;

/** Reduces a W x H key image at scale s (s < 1) with the frame offset off (whole px), as a plane is drawn. */
function reduceImage(img, W, H, s, off = [0, 0]) {
  const inv = 1 / s;
  const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : img[y * W + x]);
  const ow = Math.floor(W * s), oh = Math.floor(H * s);
  const out = new Int32Array(ow * oh);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) out[y * ow + x] = reduceFootprint(get, luma, [(x - off[0]) * inv, (y - off[1]) * inv], inv);
  return { out, ow, oh };
}

test("reduction: at a level (one texel a footprint) it is the texel itself", () => {
  const img = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) assert.equal(reduceFootprint((a, b) => img[b * 3 + a] ?? 0, luma, [x, y], 1), img[y * 3 + x]);
});

test("reduction: palette-keeping, every pick is one of the footprint's own colours (no blend, no new colour)", () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const W = 64, H = 48, img = Array.from({ length: W * H }, () => Math.floor(rnd() * 10));
  for (const s of [0.9, 0.7, 0.55, 0.4, 0.2]) {
    const inv = 1 / s;
    for (let n = 0; n < 200; n++) {
      const a0 = [rnd() * (W - 6), rnd() * (H - 6)];
      const got = reduceFootprint((x, y) => img[y * W + x] ?? 0, luma, a0, inv);
      if (got === 0) continue;
      const seen = new Set();
      for (let y = Math.floor(a0[1]); y < a0[1] + inv; y++) for (let x = Math.floor(a0[0]); x < a0[0] + inv; x++) seen.add(img[y * W + x]);
      assert.ok(seen.has(got), `pick ${got} at scale ${s} is from the footprint`);
    }
  }
});

test("reduction: a 1 px line never drops out between levels (down to 2/3 a side), at any phase", () => {
  const W = 40, H = 40;
  for (const s of [0.95, 0.9, 0.8, 0.75, 0.7, 0.67]) {
    for (let row = 10; row < 13; row++) {
      for (let p = 0; p < 4; p++) {
        // a dark line on light ground, a light thread on dark ground, and a rope over clear (the plane behind shows)
        for (const [ground, line] of [[1, 2], [2, 1], [0, 3]]) {
          const img = Array.from({ length: W * H }, (_, i) => (Math.floor(i / W) === row ? line : ground));
          const { out, ow, oh } = reduceImage(img, W, H, s, [p, p]);
          let hits = 0;
          for (let y = 0; y < oh; y++) if (out[y * ow + 5] === line) hits++;
          assert.ok(hits >= 1, `line ${line} on ${ground} at row ${row}, scale ${s}, phase ${p}: ${hits} rows`);
          assert.ok(hits <= 2, `and at most two rows thick (${hits})`);
        }
      }
    }
  }
});

test("reduction: a 1 px diagonal line never breaks between levels (down to 2/3 a side), at any phase", () => {
  const W = 40, H = 40;
  for (const s of [0.9, 0.8, 0.72, 0.67]) {
    for (let p = 0; p < 4; p++) {
      const img = Array.from({ length: W * H }, (_, i) => (i % W === Math.floor(i / W) ? 2 : 1));
      const { out, ow, oh } = reduceImage(img, W, H, s, [p, 0]);
      // every output row from 4 to the end holds the line somewhere, and it never jumps more than 2 columns a row
      let last = -1;
      for (let y = 4; y < oh - 4; y++) {
        const xs = [];
        for (let x = 0; x < ow; x++) if (out[y * ow + x] === 2) xs.push(x);
        assert.ok(xs.length >= 1, `diagonal at scale ${s}, phase ${p}: row ${y} empty`);
        if (last >= 0) assert.ok(Math.abs(xs[0] - last) <= 2, `diagonal jumps at row ${y}`);
        last = xs[0];
      }
    }
  }
});

test("reduction: a small solid shape (a 4 x 4 stud) keeps its size, no growth or holes, at any phase", () => {
  const W = 30, H = 30;
  for (const s of [0.9, 0.8, 0.72, 0.6]) {
    for (let p = 0; p < 5; p++) {
      const img = Array.from({ length: W * H }, (_, i) => { const x = i % W, y = Math.floor(i / W); return x >= 12 && x < 16 && y >= 12 && y < 16 ? 4 : 2; });
      const { out, ow, oh } = reduceImage(img, W, H, s, [p, p]);
      let n = 0, x0 = 99, x1 = -1, y0 = 99, y1 = -1;
      for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) if (out[y * ow + x] === 4) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const side = 4 * s;
      assert.ok(x1 - x0 + 1 <= Math.ceil(side) + 1 && y1 - y0 + 1 <= Math.ceil(side) + 1, `stud at ${s} phase ${p}: ${x1 - x0 + 1} x ${y1 - y0 + 1}, wanted about ${side.toFixed(1)}`);
      assert.ok(n >= Math.floor(side) ** 2 * 0.6, `stud at ${s} phase ${p}: only ${n} px`);
      // no hole: every px inside the box but one row/column in is the stud
      for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) assert.equal(out[y * ow + x], 4, `a hole at ${x},${y}`);
    }
  }
});

test("reduction: opaque only where opaque art covers a third of the px (silhouettes keep their size)", () => {
  assert.ok(Math.abs(REDUCE_OPAQUE - 1 / 3) < 1e-9);
  // a half-covered footprint of solid art is opaque; a quarter-covered one clear
  const half = (x) => (x < 1 ? 1 : 0);
  assert.equal(reduceFootprint((x) => half(x), luma, [0, 0], 2), 1);
  assert.equal(reduceFootprint((x, y) => (x < 1 && y < 1 ? 1 : 0), luma, [0, 0], 2), 0);
});

test("reduction: a pan moves the picture by whole px and never changes it (footprints anchored to the art)", () => {
  let seed = 3;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  const W = 60, H = 30, img = Array.from({ length: W * H }, () => Math.floor(rnd() * 10));
  const s = 0.62;
  const a = reduceImage(img, W, H, s, [0, 0]), b = reduceImage(img, W, H, s, [3, 1]);
  for (let y = 1; y < a.oh - 1; y++) for (let x = 0; x < a.ow - 3; x++) assert.equal(b.out[(y + 1) * b.ow + x + 3], a.out[y * a.ow + x]);
});

test("screen-res actors: the layer's camera is the frame's play transform times k, whole px exactly", () => {
  for (const cam of [
    { cx: 9612.3, cy: 5952.7, zoom: 1, anchor: 0.66, horizon: 0.38, W: 1280, H: 720 },
    { cx: 9600, cy: 5952, zoom: 2, anchor: 0.62, horizon: 0.27, W: 1920, H: 1080 },
    { cx: 17841.6, cy: 3301.2, zoom: 1.37, anchor: 0.7, horizon: 0.4, W: 1288, H: 724 },
  ]) {
    for (const k of [2, 3, 4]) {
      const xf = planeXf(cam, 1), sx = planeXf(screenCam(cam, xf, k), 1);
      assert.ok(Math.abs(sx.s - xf.s * k) < 1e-9, "scale x k");
      assert.equal(sx.offX, xf.offX * k);
      assert.equal(sx.offY, xf.offY * k);
    }
  }
});

// (lane C 10-19) the actor layer at her art density (render/reduce.ts ActorLayer, grid.ts actorMap)
test("actor layer: at her art density her anchor starts a footprint, footprints are d / s a side, and d = 1 is the 10-18 mapping", () => {
  const W = 1920, Hh = 1080, w = 3840, h = 2160;
  for (const d of [1, 1 / 0.66]) {
    for (const [zoom, cx, ax, ay] of [[1, 9700, 9733, 8400], [0.72, 17800, 17811.4, 9017.6], [0.25, 12000, 12007, 8888]]) {
      const cam = { cx, cy: 8300, zoom, anchor: 0.67, horizon: 0.3, W, H: Hh };
      const dst = planeXf(cam, 1);
      // the layer as ActorLayer.begin sets it: centred on (vx, vy), its own play transform at scale d
      const x0 = Math.floor(ax - w / (2 * d)), y0 = Math.floor(ay - h / (2 * d));
      const lay = planeXf({ cx: w / (2 * d) + x0, cy: (0.5 * h) / d + y0, zoom: d, anchor: 0.5, horizon: 0.5, W: w, H: h }, 1);
      assert.ok(Math.abs(lay.s - d) < 1e-12);
      const m = actorMap(lay, dst, w, h, [ax, ay]);
      assert.ok(Math.abs(m.inv - d / dst.s) < 1e-12, "a footprint is d / s layer px a side");
      // her anchor's layer px is where the first destination px at or past it starts reading
      const lx = Math.round(Math.round(ax) * d + lay.offX), ly = Math.round(Math.round(ay) * d + lay.offY);
      const nx = Math.ceil(Math.round(ax) * dst.s + dst.offX - 1e-6), ny = Math.ceil(Math.round(ay) * dst.s + dst.offY - 1e-6);
      assert.ok(Math.abs((nx - dst.offX) * m.inv + m.cx - lx) < 1e-6 && Math.abs((ny - dst.offY) * m.inv + m.cy - ly) < 1e-6);
      // the rect covers the layer's px [0, w) x [0, h) and no more than a px past them
      const [fx0, fy0, fx1, fy1] = m.rect;
      assert.ok((fx0 - dst.offX) * m.inv + m.cx <= 0 && (fx0 + 1 - dst.offX) * m.inv + m.cx > 0);
      assert.ok((fx1 - dst.offX) * m.inv + m.cx >= w && (fx1 - 1 - dst.offX) * m.inv + m.cx < w);
      assert.ok((fy0 - dst.offY) * m.inv + m.cy <= 0 && (fy1 - dst.offY) * m.inv + m.cy >= h);
      if (d === 1) {
        // the 10-18 formula: phase = a - (n* - off) / s, layer = (n - off) / s + phase - x0
        const phX = Math.round(ax) - (nx - dst.offX) / dst.s;
        assert.ok(Math.abs(m.cx - (phX - x0)) < 1e-6);
      }
    }
  }
});

test("actor layer plan: her art density where the view fits, else the view covered at 1 or more, else on her", () => {
  const artD = 1 / 0.66;
  for (const [W, H] of [[1280, 720], [1920, 1080]]) {
    for (let zoom = 1.5; zoom >= 0.1; zoom *= 0.93) {
      const p = actorLayerPlan(W, H, zoom, artD, 4096);
      assert.ok(p.w <= 4096 && p.h <= 4096);
      // fixed per frame size: a moving zoom never reallocates the layer
      assert.deepEqual([p.w, p.h], [actorLayerPlan(W, H, 1, artD, 4096).w, actorLayerPlan(W, H, 1, artD, 4096).h]);
      assert.ok(p.d <= artD + 1e-12);
      if (p.onView) {
        assert.ok(p.d >= 1 - 1e-12, `${W} at ${zoom.toFixed(3)}: density ${p.d}`);
        assert.ok((W / zoom) * p.d <= p.w + 1e-6 && (H / zoom) * p.d <= p.h + 1e-6, "the whole view is in the layer");
      } else {
        assert.equal(p.d, artD);
        assert.ok((W / zoom) * 1 > p.w, "only when not even density 1 would cover the view");
      }
    }
  }
  // at play zoom on a 1080p screen and down to 1/2 on 1280 x 720 (the court's vista): art density, the whole view
  assert.deepEqual([actorLayerPlan(1920, 1080, 1, artD, 4096).onView, actorLayerPlan(1920, 1080, 1, artD, 4096).d], [true, artD]);
  assert.deepEqual([actorLayerPlan(1280, 720, 0.5, artD, 4096).onView, actorLayerPlan(1280, 720, 0.5, artD, 4096).d], [true, artD]);
  // a 1080p screen at 1/2: the view covered at a lower density
  const p = actorLayerPlan(1920, 1080, 0.5, artD, 4096);
  assert.ok(p.onView && p.d < artD && p.d >= 1);
});

test("loading: the world is plain data, so a plate worker can hand it to the page (structured clone, no class, no function)", async () => {
  const { buildWorld } = await import("./world/index.ts");
  const w = buildWorld();
  const seen = new Set();
  const bad = [];
  const walk = (v, path) => {
    if (typeof v === "function") { bad.push(`${path}: a function`); return; }
    if (v === null || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    const p = Object.getPrototypeOf(v);
    if (!(p === Object.prototype || p === Array.prototype || p === null || ArrayBuffer.isView(v) || v instanceof Map || v instanceof Set)) bad.push(`${path}: a ${p?.constructor?.name}`);
    if (v instanceof Map) { for (const [, x] of v) walk(x, `${path}[map]`); return; }
    for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`);
  };
  walk(w, "world");
  assert.deepEqual(bad.slice(0, 5), [], "WorldDef must stay plain data (plates/store.ts startPlateWorkers hands it over)");
  assert.deepEqual(structuredClone(w), w);
});
