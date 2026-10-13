// Kagami's air, distance and mirror (the art loop's painter p1): the new painter kinds and
// parameters paint something, stay inside their declared bounds, are deterministic, and are
// seamless across plate tiles at the camera levels they are used at; animated sprites differ
// between frames; the wading contact keeps in step with the Walker's stride. (Round 2: the high
// cloud field, the shroud, the isles, the spray's wet foot, the birds.)
//   node --test src/tesu/art/library/opening/backdrop.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import "./index.ts";
import { painter, ctxFor } from "../../painter.ts";
import { IdxBuf } from "../../raster.ts";
import { STRIDE } from "./wade.ts";

const CASES = [
  // far karst in clusters, the farthest row erased into the haze
  ["op.karst", { w: 1700, h: 230, rows: 3, look: "far", mist: 44, green: 0.7, groups: [[340, 760], [1230, 1660]], haze: 0.7, wet: [640, 1970] }],
  // a P2 group with veil falls on chosen forms, its mist climbing their feet and thinning on the water
  ["op.karst", { w: 0, h: 380, rows: 1, look: "near", forms: [[0, 420, 330, "massif"], [-250, 70, 200, "pillar"], [260, 150, 170, "cone"]], mist: 34, green: 0.85, falls: 0.6, veil: 4, fallOn: [0, 1], wet: [-2633, -104] }],
  ["op.karst", { w: 1200, h: 300, rows: 2, look: "mid", mist: 40, green: 0.8, wet: [-2903, -374] }],
  // the seas: a bank climbing feet with a torn west end over a cloud floor; a floor-only west run
  ["op.sea", { w: 1400, depth: 300, swell: 10, ends: 60, west: 260, rise: [[330, 210, 330], [80, 35, 200]], torn: 0.55, wetFloor: 70, wetTo: 226 }],
  ["op.sea", { w: 900, depth: 400, swell: 16, ends: 80, west: 160, torn: 0.3, bankFrom: 330, floorWest: 0 }],
  // round 2: the lake running on under the mist past its west end (floor only); a high cloud field
  ["op.sea", { w: 900, depth: 160, swell: 10, ends: 60, floorWest: 0, wetFloor: 70, wetFrom: 597, veilTo: 380, bank: false }],
  ["op.cloud", { kind: "field", w: 900, h: 170, density: 0.45, strands: 2, frame: 1 }],
  // the cauliflower cumulus, the low heap by the sun, a torn stratus
  ["op.cloud", { kind: "cumulus", w: 840, h: 330, frame: 2 }],
  ["op.cloud", { kind: "cumulus", w: 330, h: 112, low: true }],
  ["op.cloud", { kind: "stratus", w: 760, h: 22, layers: 2, frame: 1 }],
  // Shiraito's veils
  ["op.wall", { w: 900, h: 600, falls: 1.7, fadeY: 400, fadeH: 120, lip: [0, 10, 300, -6, 900, 40] }],
  // spray where a veil reaches the lake
  ["op.spray", { w: 120, h: 44, at: [[62, 24]], frame: 1 }],
  // the Walker's wading contact, at a footfall and mid-stride, and with a hoof lifted (pouring, dripping)
  ["op.wade", { sub: 4, frame: 0 }],
  ["op.wade", { sub: 4, frame: 49 }],
  ["op.wade", { sub: 4, frame: 41 }],
  // round 2: the low cloud round the Walker's upper body; the floating isles; spray with a wet foot
  ["op.shroud", { frames: 24, frame: 5 }],
  ["op.isle", { w: 110, h: 96, tower: "drum" }],
  ["op.isle", { w: 92, h: 120, tower: "bell", frame: 3 }],
  ["op.spray", { w: 120, h: 64, at: [[62, 26]], foot: [-3, 66], frame: 1 }],
  // egrets crossing the massif, far specks of birds
  ["op.birds", { n: 5, w: 170, h: 70, kind: "egret", size: 6, frame: 3 }],
  ["op.birds", { n: 5, w: 150, h: 50, kind: "speck", size: 2, frame: 7 }],
];
const LEVELS = [2, 1, 0.5, 0.25, 0.125];

function paintBox(kind, p, level, x0, y0, w, h, seed = 4242) {
  const buf = new IdxBuf(w, h, x0, y0, level);
  painter(kind).paint(ctxFor(buf, level, 0, 0, seed), p);
  return buf;
}

for (const [kind, p] of CASES) {
  test(`${kind} ${JSON.stringify(p).slice(0, 60)}: paints, in bounds, deterministic, seamless`, () => {
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

for (const [kind, p, a, b] of [
  ["op.wade", { sub: 4 }, 0, 1],
  ["op.wade", { sub: 4 }, 2, 50],
  ["op.cloud", { kind: "cumulus", w: 520, h: 240 }, 0, 1],
  ["op.spray", { w: 120, h: 44, at: [[62, 24]] }, 0, 2],
  ["op.shroud", { frames: 24 }, 0, 6],
  ["op.birds", { n: 5, w: 170, h: 70, kind: "egret", size: 6 }, 0, 2],
  ["op.cloud", { kind: "field", w: 700, h: 150 }, 0, 2],
  ["op.falls", { w: 900, h: 600, falls: 1.7, fadeY: 400, fadeH: 120, lip: [0, 10, 900, -10], wallSeed: 77, from: 0, to: 12 }, 0, 1],
]) {
  test(`${kind}: frames ${a} and ${b} move`, () => {
    const [bx0, by0, bx1, by1] = painter(kind).bounds(p);
    const x0 = Math.floor(bx0), y0 = Math.floor(by0), w = Math.ceil(bx1) - x0, h = Math.ceil(by1) - y0;
    const A = paintBox(kind, { ...p, frame: a }, 1, x0, y0, w, h), B = paintBox(kind, { ...p, frame: b }, 1, x0, y0, w, h);
    let diff = 0;
    for (let i = 0; i < A.px.length; i++) if (A.px[i] !== B.px[i]) diff++;
    assert.ok(diff > 20, `${kind} frames ${a} and ${b} differ in only ${diff} px`);
  });
}

test("op.wade: one stride loops seamlessly (the Walker's 48 frames are two strides)", () => {
  assert.equal(STRIDE, 24);
  const p = { sub: 4 };
  const [bx0, by0, bx1, by1] = painter("op.wade").bounds(p);
  const x0 = Math.floor(bx0), y0 = Math.floor(by0), w = Math.ceil(bx1) - x0, h = Math.ceil(by1) - y0;
  // its frame f and f + one stride paint the same legs (the sprite's frame count is one stride)
  const A = paintBox("op.wade", { ...p, frame: 8 }, 1, x0, y0, w, h), B = paintBox("op.wade", { ...p, frame: 8 + STRIDE * 4 }, 1, x0, y0, w, h);
  let diff = 0;
  for (let i = 0; i < A.px.length; i++) if (A.px[i] !== B.px[i]) diff++;
  assert.ok(diff <= 4, `a stride later it paints the same (${diff} px differ)`);
});

test("op.sea: west of bankFrom only the floor below the line is painted", () => {
  const p = { w: 900, depth: 200, swell: 16, ends: 80, west: 160, bankFrom: 330, floorWest: 0 };
  const buf = paintBox("op.sea", p, 1, -60, -90, 360, 300);
  for (let y = -90; y < -1; y++) for (let x = -60; x < 300 - 160 * 0.3 - 2; x++) assert.equal(buf.get(x, y), 0, `bank painted at ${x},${y} west of bankFrom`);
  let floor = 0;
  for (let y = 2; y < 200; y++) for (let x = 0; x < 300; x++) if (buf.get(x, y)) floor++;
  assert.ok(floor > 300 * 190, "the floor runs solid to the west end");
});
