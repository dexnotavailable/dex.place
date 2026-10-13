// Kagami's built things (art loop, painter p2): the jetty's plate and lit face, its landings, the
// lift's top station, broken stubs, mooring posts, the fisher's props and the pines. Every new
// painter and parameter paints something, stays inside its declared bounds, is deterministic and
// seamless across plate tiles at the levels it is used at; the lit face covers the plate's shadowed
// deck exactly (so the jetty reads whole while the lake mirrors only its underside).
//   node --test src/tesu/art/library/opening/built.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import "./index.ts";
import { painter, ctxFor } from "../../painter.ts";
import { IdxBuf } from "../../raster.ts";
import { jettyPlan } from "./jetty.ts";

const WEST = [-384, 9.6, -38.4, 24, 96, 72, 384, 81.6];
const EAST = [1100, 81.6, 1426, 67.2, 1570, 43.4, 1580, 0];
const JETTY = { w: 1580, water: 57.6, west: WEST, east: EAST, gap: [1364, 1486] };

const CASES = [
  ["op.jetty", { w: 900, water: 58 }],
  ["op.jetty", { ...JETTY, part: "plate" }],
  ["op.jetty", { ...JETTY, part: "face", from: 300, to: 1100, plan: 4242 }],
  ["op.jetty", { w: 900, water: 58, posts: [[2, 40]] }],
  ["op.station", { h: 221, water: 57.6, cable: [6, -19.2] }],
  ["op.landing", { end: "west", ground: WEST, water: 57.6, feet: [[26, 5], [80, 6]] }],
  ["op.landing", { end: "east", ground: [-480, 81.6, -154, 67.2, -10, 43.4, 0, 0], water: 57.6, feet: [[-80, 6], [-36, 5]] }],
  ["op.stub", { piles: [[0, 48, 8, 3], [-27, 21, 5.5, -2], [22, 11, 4.5, 1]], lilies: 9, spread: 58, sedge: [84, 30], shade: 0.18 }],
  ["op.stub", { piles: [[0, 30, 3.6, -2], [-14, 16, 3, 1]], lilies: 4, spread: 22 }],
  ["op.post", { h: 54, down: 57.6, rope: true, hw: 6.5 }],
  ["op.crate", { w: 30, h: 26 }],
  ["op.jar", { h: 20, glaze: "clay" }],
  ["op.jar", { h: 26, glaze: "celadon" }],
  ["op.net", { w: 30, h: 9, drape: 14 }],
  ["op.basket", { h: 17 }],
  ["op.bucket", { h: 20 }],
  ["op.coil", { r: 13, hang: 10 }],
  ["op.boat", { w: 250 }],
  ["op.pine", { h: 230, dir: -1 }],
  ["op.pine", { h: 530, dir: -1, arm: [570, 0.86], bend: -0.25, armsFrom: 0.8, roots: 64, grip: 22 }],
];
const LEVELS = [2, 1, 0.5, 0.25, 0.125];

function paintBox(kind, p, level, x0, y0, w, h, seed = 4242) {
  const buf = new IdxBuf(w, h, x0, y0, level);
  painter(kind).paint(ctxFor(buf, level, 0, 0, seed), p);
  return buf;
}

for (const [kind, p] of CASES) {
  test(`${kind} ${JSON.stringify(p).slice(0, 56)}: paints, in bounds, deterministic, seamless`, () => {
    const [bx0, by0, bx1, by1] = painter(kind).bounds(p);
    for (const level of LEVELS) {
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

test("op.jetty: the plate under its lit face sprites is the whole jetty (the face covers the shadowed deck)", () => {
  const seed = 4242;
  for (const level of [2, 1, 0.5]) {
    const [bx0, by0, bx1, by1] = painter("op.jetty").bounds({ ...JETTY });
    const x0 = Math.floor(bx0 * level), y0 = Math.floor(by0 * level);
    const w = Math.ceil(bx1 * level) - x0, h = Math.ceil(by1 * level) - y0;
    const all = paintBox("op.jetty", { ...JETTY }, level, x0, y0, w, h, seed);
    const plate = paintBox("op.jetty", { ...JETTY, part: "plate" }, level, x0, y0, w, h, seed);
    // the face in windows, as the sprites paint it (their own seeds; the plan's seed passed in)
    for (let i = 0, fx = -4; fx < JETTY.w; i++, fx += 400) {
      const face = paintBox("op.jetty", { ...JETTY, part: "face", from: fx, to: Math.min(JETTY.w, fx + 400), plan: seed }, level, x0, y0, w, h, 7919 * (2000 + i));
      for (let k = 0; k < face.px.length; k++) if (face.px[k]) plate.px[k] = face.px[k];
    }
    let diff = 0;
    for (let k = 0; k < all.px.length; k++) if (all.px[k] !== plate.px[k]) diff++;
    assert.equal(diff, 0, `plate + face differs from the whole jetty in ${diff} px at level ${level}`);
  }
});

test("op.jetty: an irregular, hand-built plan (bays, piles, runs, planks)", () => {
  const plan = jettyPlan({ w: 6240, water: 57.6 }, 7919 * 3);
  const bays = plan.bents.slice(1).map((x, i) => x - plan.bents[i]);
  const mean = bays.reduce((a, v) => a + v, 0) / bays.length;
  const sd = Math.sqrt(bays.reduce((a, v) => a + (v - mean) ** 2, 0) / bays.length);
  assert.ok(sd / mean > 0.3, `bays too even: mean ${mean.toFixed(1)}, sd ${sd.toFixed(1)}`);
  assert.ok(plan.runs.some((r) => r.age > 0) && plan.runs.some((r) => r.age === 0), "a rebuilt run among old ones");
  assert.ok(plan.piles.some((q) => q.back) && plan.piles.some((q) => q.broken), "far piles and broken stubs");
  assert.ok(plan.braces.length > 3 && plan.braces.length < bays.length * 0.6, `braces on some bays only (${plan.braces.length} of ${bays.length})`);
  const fronts = plan.piles.filter((q) => !q.back && !q.broken);
  for (let i = 1; i < fronts.length; i++) {
    const a = fronts[i - 1], b = fronts[i];
    assert.ok(Math.abs(a.hw - b.hw) > 0.05 || Math.abs(a.wet - b.wet) > 0.5, `piles ${i - 1} and ${i} alike`);
  }
  const widths = plan.planks.map((q) => Math.round(q.w));
  assert.ok(new Set(widths).size > 6, "plank ends of many widths");
});

for (const [kind, p] of [["op.reeds", { w: 34, h: 42, density: 3.4, ox: 9140 }]]) {
  test(`${kind}: its frames move`, () => {
    const [bx0, by0, bx1, by1] = painter(kind).bounds(p);
    const x0 = Math.floor(bx0), y0 = Math.floor(by0), w = Math.ceil(bx1) - x0, h = Math.ceil(by1) - y0;
    const a = paintBox(kind, { ...p, frame: 0 }, 1, x0, y0, w, h), b = paintBox(kind, { ...p, frame: 1 }, 1, x0, y0, w, h);
    let diff = 0;
    for (let i = 0; i < a.px.length; i++) if (a.px[i] !== b.px[i]) diff++;
    assert.ok(diff > 20, `${kind} frames 0 and 1 differ in only ${diff} px`);
  });
}
