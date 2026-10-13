// Kagami's land (art loop, painter p3): the near masses standing in the water (P5), the catch's
// near shallows and lily bed (front plane), the reeds, the four islets, the west shore and its far
// headland. Same checks as opening.test.mjs: every case paints something, stays inside its
// declared bounds, is deterministic and is seamless across plate tiles (a region painted whole
// equals the same region painted as four tiles), at the camera levels it is used at (the near
// plane's close band is level 2, the back plane's 1.449). Then the round-3 design: separate masses
// with nothing painted between them, each meeting the water through a bright line and its own
// reflection (or running off the bottom), heights to the zone table, open water along the bottom
// edge of every play frame, the catch's corners.
//   node --test src/tesu/art/library/opening/land.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import "./index.ts";
import { painter, ctxFor } from "../../painter.ts";
import { P } from "../../palette.ts";
import { IdxBuf } from "../../raster.ts";
import { bankTopAt, reedBeds, shallowsTopAt } from "./bank.ts";
import { NEAR_MASSES } from "../../../world/sections/kagami-land.ts";

const MASSES = [
  { kind: "shelf", x: 20, w: 300, h: 110, drop: 1, bank: 0.3 },
  { kind: "rise", x: 420, w: 320, h: 120, peak: 0.4 },
  { kind: "reeds", x: 820, w: 160, h: 30, reed: 110, dense: 3.4, stone: true },
  { kind: "pads", x: 1040, w: 90, h: 12 },
  { kind: "outcrop", x: 1200, w: 260, h: 130 },
  { kind: "snag", x: 1540, w: 180, h: 70, lean: 0.6 },
  { kind: "mud", x: 1800, w: 150, h: 40, reed: 50 },
  { kind: "stone", x: 2020, w: 30, h: 14 },
  { kind: "shelf", x: 2100, w: 260, h: 100, drop: 1, bank: 1 },
];

const CASES = [
  ["op.bank", { w: 2400, h: 220, masses: MASSES }],
  // (the round-2 names still paint: a hummock is a rise, a boulder an outcrop, a crag a shelf)
  ["op.bank", { w: 900, h: 160, masses: [{ kind: "lantern", x: 200, w: 240, h: 136, lean: -0.1 }, { kind: "boulder", x: 520, w: 230, h: 96 }] }],
  ["op.bank", { w: 1100, h: 160, masses: [{ kind: "hummock", x: 60, w: 300, h: 90 }, { kind: "crag", x: 500, w: 260, h: 90, drop: -1 }, { kind: "tuft", x: 860, w: 90, h: 22 }, { kind: "knoll", x: 960, w: 120, h: 50 }] }],
  ["op.bank", { w: 1600, h: 150, reeds: 0.55, endR: 300, startR: 300 }],
  ["op.islet", { kind: "piles", w: 150, h: 12 }],
  ["op.islet", { kind: "reedbed", w: 170, h: 9 }],
  ["op.islet", { kind: "crag", w: 110, h: 62, dir: 1 }],
  ["op.islet", { kind: "crag", w: 90, h: 50, dir: -1 }],
  ["op.islet", { kind: "torii", w: 96, h: 13 }],
  ["op.headland", { w: 1100, h: 300 }],
  ["op.shore", { w: 672, end: 538, walk: [-768, 163, -288, 96, 96, 48, 490, 34, 672, 0] }],
  ["op.scree", { w: 140, deep: 82, h: 28 }],
  // (round 3) the catch's near corners and the lily bed under her
  ["op.shallows", { w: 326, wl: 60, deep: 170, side: -1, h: 52, wood: "log" }],
  ["op.shallows", { w: 221, wl: 96, deep: 170, side: 1, h: 40 }],
  ["op.shallows", { w: 235, wl: 62, deep: 170, side: 1, h: 26, wood: "stubs" }],
  ["op.shallows", { w: 53, wl: 52, deep: 144, side: 1, h: 6, kind: "pads" }],
  ["op.scree", { w: 90, deep: 40 }],
  ["op.reeds", { w: 160, h: 140, density: 3.6, frame: 3, loop: 8, ox: 7440, ground: [0, 8, 16, 22, 24, 22, 18, 14, 10, 8, 6, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0] }],
  ["op.reeds", { w: 120, h: 90, density: 3, frame: 5, loop: 8, ox: 2300, refl: 0.3 }],
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

const BRIGHT = new Set([P.jade[1], P.jade[2]]);

test("op.bank (round 3): separate masses, nothing painted between them (the lake shows there)", () => {
  const p = { w: 2400, h: 220, masses: MASSES };
  // between the rise (420..740) and the reed bank (820..980) and between the snag's group and the mud bank
  for (const [a, b] of [[770, 800], [1495, 1520]]) {
    const buf = paintBox("op.bank", p, 1, a, -220, b - a, 440);
    const n = buf.px.reduce((s, v) => s + (v ? 1 : 0), 0);
    assert.equal(n, 0, `${n} px painted in the open water between ${a} and ${b}`);
    assert.equal(bankTopAt(p, 4242, (a + b) / 2), 0);
  }
});

test("op.bank (round 3): a mass standing in the water meets it with a bright line and mirrors under it", () => {
  for (const m of [{ kind: "rise", x: 100, w: 320, h: 120, peak: 0.4 }, { kind: "outcrop", x: 100, w: 260, h: 130 }, { kind: "mud", x: 100, w: 200, h: 40 }, { kind: "stone", x: 100, w: 40, h: 16 }]) {
    const p = { w: 600, h: 220, masses: [m] };
    const buf = paintBox("op.bank", p, 1, 0, -200, 600, 400);
    let bright = 0, under = 0, above = 0;
    for (let x = m.x; x < m.x + m.w; x++) {
      for (let y = -2; y < 30; y++) if (BRIGHT.has(buf.get(x, y))) bright++;
      for (let y = 4; y < 4 + Math.min(40, m.h * 0.6); y++) if (buf.get(x, y)) under++;
      for (let y = -m.h * 0.3; y < -2; y++) if (buf.get(x, y)) above++;
    }
    assert.ok(bright >= m.w * 0.15, `${m.kind}: no bright waterline (${bright} px)`);
    assert.ok(under >= m.w * 2, `${m.kind}: no reflection under its waterline (${under} px)`);
    assert.ok(above > 0, `${m.kind}: nothing above the water`);
    // the reflection breaks up and fades: well under its own height, most of it is open water
    let deep = 0, n = 0;
    for (let x = m.x; x < m.x + m.w; x++) for (let y = Math.round(m.h * 0.85); y < Math.round(m.h * 0.85) + 6; y++) { n++; if (buf.get(x, y)) deep++; }
    assert.ok(deep < n * 0.5, `${m.kind}: its reflection does not fade (${deep} of ${n})`);
  }
});

test("op.bank (round 3): a bank runs off the bottom (no hole under it), its side lapped by the water", () => {
  const m = { kind: "shelf", x: 100, w: 300, h: 100, drop: 1, bank: 1 };
  const p = { w: 600, h: 200, masses: [m] };
  const buf = paintBox("op.bank", p, 1, 0, 0, 600, 200);
  for (const x of [150, 220, 300]) for (let y = 30; y < 199; y++) assert.ok(buf.get(x, y) > 0, `hole in the bank at ${x},${y}`);
  let lap = 0;
  for (let y = 4; y < 199; y++) for (let x = 60; x < 140; x++) if (buf.get(x, y) === P.jade[2]) lap++;
  assert.ok(lap > 20, `its water side is not lapped (${lap} px)`);
});

test("op.bank (round 3): no lawn: the near shore paints nothing over most of its length", () => {
  const p = { w: 11400, h: 290, masses: NEAR_MASSES };
  let open = 0, n = 0;
  for (let x = 0; x < 11400; x += 7) { n++; if (bankTopAt(p, 7919 * 3000, x) === 0) open++; }
  assert.ok(open > n * 0.5, `the shore stands above the water over ${n - open} of ${n} samples`);
});

/** The zone table (near px; P5's waterline is screen y 963 at play zoom): [from, to, lowest top, highest top]. */
const ZONES = [
  [517, 950, 95, 143], // play-west's dominant, top at y 820 or lower
  [1000, 2080, 0, 50],
  [2100, 2437, 0, 90],
  [5183, 5600, 110, 175], // play-walker's dominant
  [5600, 6640, 0, 40],
  [6660, 7090, 0, 60],
  [7256, 7700, 110, 175], // play-catch's dominant
  [7720, 8200, 0, 40],
  [8208, 8400, 0, 60],
  [8420, 9000, 0, 40],
  [9000, 9230, 0, 60], // the jetty's east landing
  [9260, 9420, 0, 110], // the east limestone
  [9490, 9950, 0, 30], // guard-gate1's arch
];

test("op.bank (round 3): Kagami's near masses keep to the zone table", () => {
  const p = { w: 11400, h: 290, masses: NEAR_MASSES };
  for (const [a, b, lo, hi] of ZONES) {
    let top = 0;
    for (let x = a; x < b; x += 2) top = Math.max(top, bankTopAt(p, 7919 * 3000, x));
    assert.ok(top >= lo && top <= hi, `near px ${a}..${b}: top ${top.toFixed(1)} outside ${lo}..${hi}`);
  }
});

test("op.bank (round 3): open water across at least 40% of every play frame's bottom edge", () => {
  const p = { w: 11400, h: 290, masses: NEAR_MASSES };
  // the bottom edge, screen row 1075, is 112 px under P5's waterline at play zoom
  for (const [name, a] of [["play-west", 517], ["play-walker", 5183], ["play-catch", 7256], ["play-east", 8034]]) {
    const buf = paintBox("op.bank", p, 1, a, 110, 1920, 4, 7919 * 3000);
    let lake = 0;
    for (let x = a; x < a + 1920; x++) if (!buf.get(x, 112)) lake++;
    assert.ok(lake >= 1920 * 0.4, `${name}: lake on only ${lake} of 1920 px of the bottom edge`);
  }
});

test("op.bank (round 3): reed beds stand on their banks and keep their heights", () => {
  const p = { w: 2400, h: 220, masses: MASSES };
  const beds = reedBeds(p, 4242);
  assert.equal(beds.length, 2);
  assert.equal(beds[0][2], 110);
  assert.equal(beds[0][3], 3.4);
  assert.equal(beds[1][2], 50);
  let t = 0;
  for (let x = 840; x < 960; x += 2) t = Math.max(t, bankTopAt(p, 4242, x));
  assert.ok(t > 5 && t < 60, `the reed bank's top ${t}`);
});

test("op.shallows (round 3): the catch's corners, the left dominant, nothing high under her", () => {
  // catch (2x): screen x = (world x - 9123) * 2, row = 792 + 2 * (y below the lake's line)
  const L = { w: 326, wl: 60, deep: 170, side: -1, h: 52, wood: "log" }, Lx = 9091;
  const R = { w: 221, wl: 96, deep: 170, side: 1, h: 40 }, Rx = 9917;
  const D = { w: 53, wl: 52, deep: 144, side: 1, h: 6, kind: "pads" }, Dx = 9576;
  const count = (p, px, seed, x0, x1, y0, y1) => {
    const buf = paintBox("op.shallows", p, 1, x0 - px, y0, x1 - x0, y1 - y0, seed);
    return buf.px.reduce((s, v) => s + (v ? 1 : 0), 0);
  };
  // rows 900 to 1080: 54 to 144 under the lake's line; the left half and the right half of the frame
  const left = count(L, Lx, 7919 * 3230, 9123, 9603, 54, 144), right = count(R, Rx, 7919 * 3234, 9603, 10083, 54, 144);
  assert.ok(right > 0, "the right corner is empty");
  assert.ok(left >= right * 1.5, `the left corner (${left}) is not the dominant one (right ${right})`);
  // the right corner's top no higher than row 880 (44 under the line)
  assert.equal(count(R, Rx, 7919 * 3234, 9603, 10083, -60, 44), 0, "the right corner rises above row 880");
  // nothing above row 895 (51 under the line) between catch x 600 and 1300 (world 9423..9773)
  for (const [p, px, seed] of [[L, Lx, 7919 * 3230], [R, Rx, 7919 * 3234], [D, Dx, 7919 * 3300]]) assert.equal(count(p, px, seed, 9423, 9773, -100, 51), 0, `${p.kind ?? p.side} rises above row 895 under her`);
  // the lily bed covers where her reflection would be (catch x 915..995, rows 895..1080)
  assert.ok(count(D, Dx, 7919 * 3300, 9580, 9620, 51, 144) > 40, "the lily bed does not cover her missing reflection");
  // its reeds stand on its bank
  assert.ok(shallowsTopAt(R, 7919 * 3234, 100) > 5, "the spit's top is too low for its reeds");
});

test("op.reeds: a dense tall bed's frames move; with refl it mirrors itself under its anchor", () => {
  const p = { w: 160, h: 140, density: 3.6, loop: 8, ox: 7440 };
  const [bx0, by0, bx1, by1] = painter("op.reeds").bounds(p);
  const x0 = Math.floor(bx0), y0 = Math.floor(by0), w = Math.ceil(bx1) - x0, h = Math.ceil(by1) - y0;
  const a = paintBox("op.reeds", { ...p, frame: 0 }, 1, x0, y0, w, h), b = paintBox("op.reeds", { ...p, frame: 2 }, 1, x0, y0, w, h);
  let diff = 0;
  for (let i = 0; i < a.px.length; i++) if (a.px[i] !== b.px[i]) diff++;
  assert.ok(diff > 20, `frames 0 and 2 differ in only ${diff} px`);
  // nothing below the anchor without refl; a broken reflection with it
  const below = (q) => { const k = paintBox("op.reeds", q, 1, -60, 4, 280, 120); return k.px.reduce((s, v) => s + (v ? 1 : 0), 0); };
  assert.equal(below({ ...p, frame: 0 }), 0);
  const n = below({ ...p, frame: 0, refl: 0.3 });
  assert.ok(n > 100, `no reflection (${n} px)`);
});

test("op.islet (round 3): the torii's islet stands on a base that meets the water", () => {
  const buf = paintBox("op.islet", { kind: "torii", w: 96, h: 13 }, 1, -60, -20, 120, 22, 7919 * 3103);
  let base = 0, high = 0;
  for (let x = -50; x < 40; x++) {
    if (buf.get(x, -1)) base++;
    for (let y = -14; y < -6; y++) if (buf.get(x, y)) { high++; break; }
  }
  assert.ok(base > 40, `its base hardly meets the water (${base} px)`);
  assert.ok(high > 10, `its base has no height (${high} columns above 6 px)`);
});
