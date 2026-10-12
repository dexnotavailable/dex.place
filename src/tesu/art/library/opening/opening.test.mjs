// env-opening library checks: every painter paints something, stays inside its declared bounds,
// is deterministic, and is seamless across plate tiles (a region painted whole equals the same
// region painted as four tiles), at the camera levels it is used at; animated sprites differ
// between frames.
//   node --test src/tesu/art/library/opening/opening.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import "./index.ts";
import { painter, ctxFor } from "../../painter.ts";
import { IdxBuf } from "../../raster.ts";

const CASES = [
  ["op.rock", { top: [0, 0, 300, -12, 600, -30], bottom: [610, 120, 420, 300, 200, 260, -10, 140], cap: "grass", veg: 0.7, fadeY: 200, fadeH: 80, giant: 300, forest: [60] }],
  ["op.rock", { top: [0, 0, 400, -20], bottom: [410, 60, 200, 90, -10, 50], cap: "path", veg: 0.6 }],
  ["op.wall", { w: 600, h: 400, falls: 1.7, fadeY: 240, fadeH: 120, lip: [0, 10, 600, -10] }],
  ["op.karst", { w: 900, h: 230, rows: 3, look: "far", mist: 44 }],
  ["op.karst", { w: 0, h: 300, rows: 1, look: "near", forms: [[0, 300, 240, "massif"], [-170, 60, 150, "pillar"], [190, 110, 110, "cone"]], mist: 34, falls: 0.6 }],
  ["op.islet", { w: 110, h: 26, on: ["tree", "pine", "posts", "lantern", "torii", "reeds"], at: -0.5 }],
  ["op.sea", { w: 1200, depth: 300, swell: 12 }],
  ["op.bank", { w: 1600, h: 150, reeds: 0.55, endR: 300, startR: 300 }],
  ["op.spring", { mw: 80, mh: 50, w: 44, drop: 500 }],
  ["op.jetty", { w: 900, water: 58 }],
  ["op.post", { h: 58, down: 58, rope: true }],
  ["op.plank", { w: 150 }],
  ["op.gate", { kind: "torii", span: 326, h: 480 }],
  ["op.gate", { kind: "paifang", span: 326, h: 538 }],
  ["op.gate", { kind: "torii", span: 202, h: 355, part: "front" }],
  ["op.palace", { w: 2890, h0: 538, h1: 403, h2: 307, door: [29, 230, 355] }],
  ["op.tower", { h: 960, w: 72 }],
  ["op.stay", { dx: -422, dy: 800 }],
  ["op.banners", { w: 680, drop: 211, n: 5, frame: 2 }],
  ["op.rail", { pts: [0, 0, 300, -20, 600, -30], h: 46, every: 62 }],
  ["op.bench", { w: 144 }],
  ["op.barrel", { h: 40, ladle: true }],
  ["op.bucket", { h: 20 }],
  ["op.coil", { r: 12 }],
  ["op.boat", { w: 250 }],
  ["op.cloud", { kind: "cumulus", w: 520, h: 240, frame: 1 }],
  ["op.cloud", { kind: "stratus", w: 700, h: 8, layers: 2 }],
  ["op.isle", { w: 92, h: 120, tower: "bell", frame: 3 }],
  ["op.pine", { h: 260, dir: 1 }],
  ["op.bamboo", { w: 70, h: 420, frame: 1 }],
  ["op.terrace", { w: 538, depth: 125 }],
  ["op.reeds", { w: 220, h: 70, frame: 2 }],
  ["op.flags", { h: 150, dx: -163, dy: 92, n: 8, frame: 1 }],
];
const LEVELS = [2, 1, 0.5, 0.25, 0.125];

function paintBox(kind, p, level, x0, y0, w, h, seed = 4242) {
  const buf = new IdxBuf(w, h, x0, y0, level);
  painter(kind).paint(ctxFor(buf, level, 0, 0, seed), p);
  return buf;
}

for (const [kind, p] of CASES) {
  test(`${kind} ${JSON.stringify(p).slice(0, 48)}: paints, in bounds, deterministic, seamless`, () => {
    const [bx0, by0, bx1, by1] = painter(kind).bounds(p);
    for (const level of LEVELS) {
      // the big pieces are checked at the wide levels only (the test stays quick)
      if ((bx1 - bx0) * level > 2400) continue;
      const x0 = Math.floor(bx0 * level) - 4, y0 = Math.floor(by0 * level) - 4;
      const w = Math.ceil(bx1 * level) - x0 + 8, h = Math.ceil(by1 * level) - y0 + 8;
      const whole = paintBox(kind, p, level, x0, y0, w, h);
      const n = whole.px.reduce((a, v) => a + (v ? 1 : 0), 0);
      if (level >= 0.25) assert.ok(n > 0, `${kind} painted nothing at level ${level}`);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!whole.px[y * w + x]) continue;
        const ax = x0 + x, ay = y0 + y;
        assert.ok(ax >= Math.floor(bx0 * level) - 1 && ax <= Math.ceil(bx1 * level) + 1 && ay >= Math.floor(by0 * level) - 1 && ay <= Math.ceil(by1 * level) + 1, `${kind} pixel outside bounds at level ${level}: ${ax},${ay} (bounds ${bx0},${by0},${bx1},${by1})`);
      }
      assert.deepEqual(paintBox(kind, p, level, x0, y0, w, h).px, whole.px, `${kind} not deterministic at ${level}`);
      const mx = x0 + Math.floor(w / 2) + 3, my = y0 + Math.floor(h / 2) - 5;
      for (const [tx0, ty0, tx1, ty1] of [[x0, y0, mx, my], [mx, y0, x0 + w, my], [x0, my, mx, y0 + h], [mx, my, x0 + w, y0 + h]]) {
        if (tx1 <= tx0 || ty1 <= ty0) continue;
        const t = paintBox(kind, p, level, tx0, ty0, tx1 - tx0, ty1 - ty0);
        for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) {
          assert.equal(t.get(x, y), whole.get(x, y), `${kind} seam at level ${level}, ${x},${y}`);
        }
      }
    }
  });
}

for (const [kind, p] of [["op.falls", { w: 600, h: 400, falls: 1.7, fadeY: 240, fadeH: 120, lip: [0, 10, 600, -10], wallSeed: 77, from: 0, to: 4 }], ["op.reeds", { w: 220, h: 70 }], ["op.banners", { w: 680, drop: 211, n: 5 }], ["op.flags", { h: 150, dx: -163, dy: 92 }], ["op.bamboo", { w: 70, h: 420 }], ["op.spring", { mw: 80, mh: 50, w: 44, drop: 500, fallOnly: true }]]) {
  test(`${kind}: its frames move`, () => {
    const [bx0, by0, bx1, by1] = painter(kind).bounds(p);
    const x0 = Math.floor(bx0), y0 = Math.floor(by0), w = Math.ceil(bx1) - x0, h = Math.ceil(by1) - y0;
    const a = paintBox(kind, { ...p, frame: 0 }, 1, x0, y0, w, h), b = paintBox(kind, { ...p, frame: 1 }, 1, x0, y0, w, h);
    let diff = 0;
    for (let i = 0; i < a.px.length; i++) if (a.px[i] !== b.px[i]) diff++;
    assert.ok(diff > 20, `${kind} frames 0 and 1 differ in only ${diff} px`);
  });
}
