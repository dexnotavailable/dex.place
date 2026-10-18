// The engine lane's pixel grid (10-18): the zoomed-out reduction (render/reduce.ts, its CPU reference of the shaders'
// rule) and the screen-res actor layer's camera (render/actors.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { reduceFootprint, REDUCE_OPAQUE, screenCam } from "./render/grid.ts";
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
