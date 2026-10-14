// Kagami's air, distance and mirror (the art loop's painter p1): the new painter kinds and
// parameters paint something, stay inside their declared bounds, are deterministic, and are
// seamless across plate tiles at the camera levels they are used at; animated sprites differ
// between frames; the wading contact keeps in step with the Walker's stride. (Round 2: the high
// cloud field, the shroud, the isles, the spray's wet foot, the birds.)
// (Round 3: no screen door: mist, veils and clouds are solid lobes with one cell of dither on
// their edges; the catch's 2x reads at one density.)
// (Round 4, the sky lane: one cloud family, every kind a heap of billows in the cumulus ramp; the
// Walker set far off with its wake at half size; the clump of pillows round it is gone.)
//   node --test src/tesu/art/library/opening/backdrop.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import "./index.ts";
import { painter, ctxFor } from "../../painter.ts";
import { IdxBuf } from "../../raster.ts";
import { STRIDE } from "./wade.ts";
import { P } from "../../palette.ts";

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
  // round 2: the floating isles; spray with a wet foot
  ["op.isle", { w: 110, h: 96, tower: "drum" }],
  ["op.isle", { w: 92, h: 120, tower: "bell", frame: 3 }],
  ["op.spray", { w: 120, h: 64, at: [[62, 26]], foot: [-3, 66], frame: 1 }],
  // round 3: the wall's west foot with fallen chunks and foam, the clustered cumulus at the
  // postcard's density, a low thin stratus, a thick and a thin high band
  ["op.spray", { w: 120, h: 84, at: [[30, 15], [62, 26], [98, 17]], foot: [-3, 66], chunks: [6, 78], frame: 2 }],
  ["op.cloud", { kind: "stratus", w: 980, h: 12, layers: 1, frame: 3 }],
  ["op.cloud", { kind: "field", w: 900, h: 170, density: 0.85, strands: 2 }],
  ["op.cloud", { kind: "field", w: 1000, h: 150, density: 0.3, strands: 3, frame: 2 }],
  // round 4: the one cloud family at its sizes (the great heap, a sun companion in the haze, a
  // small heap, a low flattened one, a deck of small heaps), and the far Walker's wake at half size
  ["op.cloud", { kind: "cumulus", w: 760, h: 345, tower: 0.9, frame: 1 }],
  ["op.cloud", { kind: "cumulus", w: 290, h: 104, tower: 0.45, haze: 0.2 }],
  ["op.cloud", { kind: "cumulus", w: 130, h: 46, tower: 0.4, frame: 3 }],
  ["op.cloud", { kind: "cumulus", w: 330, h: 54, tower: 0.3, haze: 0.3 }],
  ["op.cloud", { kind: "deck", w: 600, h: 40, frame: 2 }],
  ["op.wade", { sub: 4, scale: 0.5, mist: false, frame: 49 }],
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
  ["op.wade", { sub: 4, scale: 0.5, mist: false }, 2, 50],
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

// Round 3: no screen door. A 1 px ordered checker paints most of its px with no painted
// neighbour left, right, above or below; solid lobes with one cell of dither on their edges
// paint few. At the catch's 2x a dither cell is two px, so no px there stands alone at all.
function isolatedShare(buf) {
  const { w, h, px } = buf;
  let n = 0, iso = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (!px[y * w + x]) continue;
    n++;
    if (!px[y * w + x - 1] && !px[y * w + x + 1] && !px[(y - 1) * w + x] && !px[(y + 1) * w + x]) iso++;
  }
  return n ? iso / n : 0;
}
for (const [kind, p, most] of [
  ["op.cloud", { kind: "cumulus", w: 130, h: 46, tower: 0.4 }, 0.03],
  ["op.cloud", { kind: "deck", w: 600, h: 40 }, 0.04],
  ["op.wade", { sub: 4, frame: 49 }, 0.12],
  ["op.karst", { w: 0, h: 380, rows: 1, look: "near", forms: [[0, 420, 330, "massif"], [-250, 70, 200, "pillar"], [260, 150, 170, "cone"]], mist: 34, green: 0.85, falls: 0.6, veil: 4, fallOn: [0, 1], wet: [-2633, -104] }, 0.04],
  ["op.sea", { w: 1400, depth: 300, swell: 10, ends: 60, west: 260, rise: [[330, 210, 330], [80, 35, 200]], torn: 0.55, wetFloor: 70, wetTo: 226 }, 0.04],
  ["op.cloud", { kind: "cumulus", w: 840, h: 330, frame: 1 }, 0.02],
  ["op.cloud", { kind: "stratus", w: 760, h: 22, layers: 2, frame: 1 }, 0.08],
  ["op.cloud", { kind: "field", w: 900, h: 170, density: 0.85, strands: 2 }, 0.08],
]) {
  test(`${kind}: no screen door (${JSON.stringify(p).slice(0, 40)})`, () => {
    const [bx0, by0, bx1, by1] = painter(kind).bounds(p);
    const one = paintBox(kind, p, 1, Math.floor(bx0), Math.floor(by0), Math.ceil(bx1 - bx0), Math.ceil(by1 - by0));
    const s1 = isolatedShare(one);
    assert.ok(s1 <= most, `${kind}: ${(s1 * 100).toFixed(1)}% of its px stand alone at play zoom (a checker)`);
    if ((bx1 - bx0) * 2 <= 2400) {
      const two = paintBox(kind, p, 2, Math.floor(bx0 * 2), Math.floor(by0 * 2), Math.ceil((bx1 - bx0) * 2), Math.ceil((by1 - by0) * 2));
      const s2 = isolatedShare(two);
      assert.ok(s2 <= 0.01, `${kind}: ${(s2 * 100).toFixed(1)}% of its px stand alone at the catch's 2x (1 px dither)`);
    }
  });
}

// Round 4 (the sky lane): one cloud family. Every kind of cloud paints only the cumulus ramp (warm
// lit tops, lavender shade, the blue-grey base), never another material or a second look.
test("op.cloud: every kind is the same family, in the cumulus ramp only", () => {
  const ramp = new Set(P.cumulus);
  for (const p of [{ kind: "cumulus", w: 520, h: 240 }, { kind: "cumulus", w: 160, h: 60, tower: 0.3, haze: 0.5 }, { kind: "deck", w: 600, h: 40 }, { kind: "stratus", w: 760, h: 22 }, { kind: "field", w: 900, h: 170 }]) {
    const [bx0, by0, bx1, by1] = painter("op.cloud").bounds(p);
    const buf = paintBox("op.cloud", p, 1, Math.floor(bx0), Math.floor(by0), Math.ceil(bx1 - bx0), Math.ceil(by1 - by0));
    let n = 0;
    for (const v of buf.px) if (v) { n++; assert.ok(ramp.has(v), `${p.kind} painted index ${v}, outside the cumulus ramp`); }
    assert.ok(n > 200, `${p.kind} painted only ${n} px`);
  }
});

// Its lit tops are warm and its base cool: the sun's side of a heap holds the cream and peach,
// its lowest rows only the lavender and blue-grey steps.
test("op.cloud: warm lit tops, cool base", () => {
  const p = { kind: "cumulus", w: 520, h: 240, tower: 0.8 };
  const [bx0, by0, bx1, by1] = painter("op.cloud").bounds(p);
  const x0 = Math.floor(bx0), y0 = Math.floor(by0), w = Math.ceil(bx1 - bx0), h = Math.ceil(by1 - by0);
  const buf = paintBox("op.cloud", p, 1, x0, y0, w, h);
  const warm = new Set([P.cumulus[0], P.cumulus[1]]), cool = new Set([P.cumulus[5], P.cumulus[6], P.cumulus[7]]);
  let warmTop = 0, warmBase = 0, coolBase = 0, base = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const v = buf.get(x, y);
    if (!v) continue;
    if (y < -150 && warm.has(v)) warmTop++;
    if (y > -8) { base++; if (warm.has(v)) warmBase++; if (cool.has(v)) coolBase++; }
  }
  assert.ok(warmTop > 300, `only ${warmTop} warm px on its upper part`);
  assert.ok(base > 100 && warmBase === 0 && coolBase / base > 0.6, `its base is not cool (${coolBase} of ${base} cool, ${warmBase} warm)`);
});

// The far Walker's wake is the same painting at half its size: it stays inside half the bounds.
test("op.wade: at half size it paints inside half its bounds", () => {
  const full = painter("op.wade").bounds({ sub: 4 }), half = painter("op.wade").bounds({ sub: 4, scale: 0.5 });
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(half[i] - full[i] * 0.5) < 1e-6);
  const buf = paintBox("op.wade", { sub: 4, scale: 0.5, mist: false, frame: 2 }, 1, Math.floor(half[0]) - 2, Math.floor(half[1]) - 2, Math.ceil(half[2] - half[0]) + 4, Math.ceil(half[3] - half[1]) + 4);
  assert.ok(buf.px.some((v) => v), "it paints");
});
