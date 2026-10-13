// Kagami's land (art loop, painter p3): the near shore's masses (P5), the four islets, the west
// shore and its far headland. Same checks as opening.test.mjs: every case paints something,
// stays inside its declared bounds, is deterministic and is seamless across plate tiles (a
// region painted whole equals the same region painted as four tiles), at the camera levels it
// is used at (the near plane's close band is level 2, the back plane's 1.449).
//   node --test src/tesu/art/library/opening/land.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import "./index.ts";
import { painter, ctxFor } from "../../painter.ts";
import { IdxBuf } from "../../raster.ts";
import { bankTopAt, reedBeds, shallowsTopAt } from "./bank.ts";

const MASSES = [
  { kind: "crag", x: -80, w: 300, h: 110, drop: -1 },
  { kind: "hummock", x: 260, w: 260, h: 90 },
  { kind: "reeds", x: 540, w: 160, h: 30, reed: 110, dense: 3.4 },
  { kind: "tuft", x: 720, w: 90, h: 22 },
  { kind: "boulder", x: 860, w: 200, h: 84 },
  { kind: "lantern", x: 1080, w: 200, h: 120 },
  { kind: "crag", x: 1300, w: 360, h: 140 },
  { kind: "crag", x: 1640, w: 300, h: 50, drop: 1 },
];

const CASES = [
  ["op.bank", { w: 1900, h: 220, masses: MASSES }],
  ["op.bank", { w: 900, h: 160, masses: [{ kind: "lantern", x: 200, w: 240, h: 136, lean: -0.1 }, { kind: "boulder", x: 520, w: 230, h: 96 }] }],
  ["op.bank", { w: 1600, h: 150, reeds: 0.55, endR: 300, startR: 300 }],
  ["op.islet", { kind: "piles", w: 150, h: 12 }],
  ["op.islet", { kind: "reedbed", w: 170, h: 9 }],
  ["op.islet", { kind: "crag", w: 110, h: 62, dir: 1 }],
  ["op.islet", { kind: "crag", w: 90, h: 50, dir: -1 }],
  ["op.islet", { kind: "torii", w: 96, h: 13 }],
  ["op.headland", { w: 1100, h: 300 }],
  ["op.shore", { w: 672, end: 538, walk: [-768, 163, -288, 96, 96, 48, 490, 34, 672, 0] }],
  ["op.scree", { w: 140, deep: 82, h: 28 }],
  // (round 2) the catch's near corners: the near shallows, the bank off either corner
  ["op.shallows", { w: 211, wl: 64, deep: 170, side: -1, h: 30, wood: "log" }],
  ["op.shallows", { w: 235, wl: 62, deep: 170, side: 1, h: 26, wood: "stubs" }],
  // (round 2) a shore with the low ground past a point and a fall at its end, a rise with a crown,
  // a mass standing on the ground
  ["op.bank", { w: 1400, h: 200, low: 800, fall: 1250, masses: [{ kind: "hummock", x: 100, w: 500, h: 110, peak: 0.3, crown: [0.7, 0.6] }, { kind: "boulder", x: 900, w: 150, h: 30, foot: 24 }] }],
  ["op.scree", { w: 90, deep: 40 }],
  ["op.reeds", { w: 160, h: 140, density: 3.6, frame: 3, loop: 8, ox: 7440, ground: [0, 8, 16, 22, 24, 22, 18, 14, 10, 8, 6, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0] }],
];
const LEVELS = [2, 1.449, 1, 0.5, 0.25, 0.125];

function paintBox(kind, p, level, x0, y0, w, h, seed = 4242) {
  const buf = new IdxBuf(w, h, x0, y0, level);
  painter(kind).paint(ctxFor(buf, level, 0, 0, seed), p);
  return buf;
}

for (const [kind, p] of CASES) {
  test(`${kind} ${JSON.stringify(p).slice(0, 60)}: paints, in bounds, deterministic, seamless`, () => {
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

test("op.bank: every mass runs off the bottom (no underside, no hole under the waterline)", () => {
  // between the end crags' outer faces, every column is painted from its top to the bank's foot
  const p = { w: 1900, h: 220, masses: MASSES };
  const level = 0.5;
  const x0 = Math.floor(200 * level), x1 = Math.floor(1700 * level), y0 = Math.floor(2 * level), y1 = Math.floor(219 * level);
  const buf = paintBox("op.bank", p, level, x0, y0, x1 - x0, y1 - y0);
  for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) assert.ok(buf.get(x, y) > 0, `hole under the waterline at ${x},${y}`);
});

test("op.bank: masses are separate (the top dips to the ground between them) and reed beds stand on it", () => {
  const p = { w: 1900, h: 220, masses: MASSES };
  const seed = 4242;
  // a dip between the reeds (540..700) and the boulder (860..1060)
  // (round 2: the ground between the masses stands 3 to 40 px above the waterline, never on it)
  let low = Infinity;
  for (let x = 700; x < 860; x += 2) low = Math.min(low, bankTopAt(p, seed, x));
  assert.ok(low < 40 && low >= 3, `no gap between masses (lowest top ${low})`);
  let high = 0;
  for (let x = 880; x < 1040; x += 2) high = Math.max(high, bankTopAt(p, seed, x));
  assert.ok(high > 60, `the boulder does not rise (${high})`);
  const beds = reedBeds(p, seed);
  assert.equal(beds.length, 1);
  assert.equal(beds[0][2], 110);
  assert.equal(beds[0][3], 3.4);
});

test("op.reeds: a dense tall bed's frames move", () => {
  const p = { w: 160, h: 140, density: 3.6, loop: 8, ox: 7440 };
  const [bx0, by0, bx1, by1] = painter("op.reeds").bounds(p);
  const x0 = Math.floor(bx0), y0 = Math.floor(by0), w = Math.ceil(bx1) - x0, h = Math.ceil(by1) - y0;
  const a = paintBox("op.reeds", { ...p, frame: 0 }, 1, x0, y0, w, h), b = paintBox("op.reeds", { ...p, frame: 2 }, 1, x0, y0, w, h);
  let diff = 0;
  for (let i = 0; i < a.px.length; i++) if (a.px[i] !== b.px[i]) diff++;
  assert.ok(diff > 20, `frames 0 and 2 differ in only ${diff} px`);
});

test("op.bank (round 2): the ground's top stands 3 to 40 px above the waterline and is never level for long", () => {
  const p = { w: 6000, h: 290, masses: [] };
  const seed = 7919 * 3000;
  const T = [];
  for (let x = 0; x <= 6000; x++) T.push(bankTopAt(p, seed, x));
  for (const t of T) assert.ok(t >= 3 && t <= 40, `ground top ${t} outside 3..40`);
  // along any 120 px it moves by at least 6 px (no ruled waterline)
  for (let x = 0; x + 120 < T.length; x += 30) {
    let a = Infinity, b = -Infinity;
    for (let k = 0; k <= 120; k++) { a = Math.min(a, T[x + k]); b = Math.max(b, T[x + k]); }
    assert.ok(b - a >= 6, `ground top level from ${x} to ${x + 120} (range ${b - a})`);
  }
});

test("op.bank (round 2): past its low point the ground lies low, so what stands behind reads over it", () => {
  const p = { w: 3000, h: 290, masses: [], low: 1000 };
  const seed = 7919 * 3000;
  for (let x = 1200; x < 2900; x += 7) assert.ok(bankTopAt(p, seed, x) <= 20, `ground at ${x} too high (${bankTopAt(p, seed, x)})`);
});

test("op.bank (round 2): no mass paints a row of saw-teeth or an outline (a rise's body is one form)", () => {
  // a rise's body below its crown is filled column by column with no holes down to the bank's foot
  const p = { w: 900, h: 200, masses: [{ kind: "hummock", x: 200, w: 500, h: 120, peak: 0.35 }] };
  const level = 1;
  const buf = paintBox("op.bank", p, level, 300, 20, 300, 170);
  for (let x = 300; x < 600; x++) for (let y = 20; y < 190; y++) assert.ok(buf.get(x, y) > 0, `hole in the rise at ${x},${y}`);
});

test("op.shallows: dark near corners, open water at the inner end, its reeds stand on its bank", () => {
  const p = { w: 211, wl: 64, deep: 170, side: -1, h: 30, wood: "log" };
  const seed = 7919 * 3230;
  // the bank runs off the bottom at the outer end and rounds down into the water at the inner end
  assert.ok(shallowsTopAt(p, seed, 10) > 18, `the corner's bank is too low (${shallowsTopAt(p, seed, 10)})`);
  assert.equal(shallowsTopAt(p, seed, 205), 0);
  const buf = paintBox("op.shallows", p, 1, -20, 120, 120, 50, seed);
  let n = 0;
  for (let i = 0; i < buf.px.length; i++) if (buf.px[i]) n++;
  assert.ok(n > 0.85 * buf.px.length, `the corner is not solid near the bottom (${n} of ${buf.px.length})`);
  // the right corner mirrors it
  const q = { w: 235, wl: 62, deep: 170, side: 1, h: 26, wood: "stubs" };
  assert.ok(shallowsTopAt(q, seed, 225) > 12 && shallowsTopAt(q, seed, 4) === 0);
});
