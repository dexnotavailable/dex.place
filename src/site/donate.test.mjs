// Run: node --test src/site/donate.test.mjs
//
// The /donate/ amount rules Dex set on 2026-09-29: no amount by default, a
// slider from 100,000 to 10,000,000 VND (never 0), and every QR it can make
// decodes to the matching VietQR payload.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import jsQR from "jsqr";
import {
  QUICK_PICKS, SLIDER_MAX_VND, SLIDER_MIN_VND, STOPS, TICKS, amountAt, donateQr, fineText, formatVnd, indexOf, shortVnd, trackPos,
} from "./donate.ts";
import { qrGrid } from "./qr.ts";
import { MB_BANK, vietQrPayload } from "./vietqr.ts";

describe("donation amounts", () => {
  test("stops run from 100,000 to 10,000,000, ascending, round, never 0", () => {
    assert.equal(STOPS[0], 100_000);
    assert.equal(STOPS.at(-1), 10_000_000);
    assert.equal(SLIDER_MIN_VND, 100_000);
    assert.equal(SLIDER_MAX_VND, 10_000_000);
    for (let i = 1; i < STOPS.length; i += 1) assert.ok(STOPS[i] > STOPS[i - 1]);
    for (const s of STOPS) {
      assert.ok(s > 0 && s % 50_000 === 0, `${s}`);
      assert.doesNotThrow(() => vietQrPayload(s));
    }
  });

  test("steps: 50k to 1M, 250k to 5M, 500k to 10M", () => {
    const gaps = STOPS.slice(1).map((s, i) => [STOPS[i], s - STOPS[i]]);
    for (const [from, gap] of gaps) {
      assert.equal(gap, from < 1_000_000 ? 50_000 : from < 5_000_000 ? 250_000 : 500_000, `after ${from}`);
    }
  });

  test("slider index and amount round-trip; out-of-range indexes clamp", () => {
    STOPS.forEach((s, i) => {
      assert.equal(amountAt(i), s);
      assert.equal(indexOf(s), i);
    });
    assert.equal(amountAt(-5), 100_000);
    assert.equal(amountAt(10_000), 10_000_000);
    assert.equal(trackPos(100_000), 0);
    assert.equal(trackPos(10_000_000), 1);
  });

  test("quick picks and ticks sit on stops", () => {
    for (const n of [...QUICK_PICKS, ...TICKS]) assert.ok(STOPS.includes(n), `${n}`);
  });

  test("labels", () => {
    assert.equal(formatVnd(1_250_000), "1,250,000 VND");
    assert.deepEqual(TICKS.map(shortVnd), ["100k", "500k", "1M", "5M", "10M"]);
    assert.equal(shortVnd(2_500_000), "2.5M");
    assert.match(fineText(0), /no amount/);
    assert.match(fineText(500_000), /500,000 VND/);
  });
});

/** Rasterises a QR grid (4-module quiet zone) and reads it back. */
function decode(text) {
  const grid = qrGrid(text);
  const scale = 4;
  const side = (grid.size + 8) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      if (grid.get(Math.floor(x / scale) - 4, Math.floor(y / scale) - 4)) {
        const o = (y * side + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = 0;
      }
    }
  }
  return { size: grid.size, text: jsQR(data, side, side)?.data };
}

describe("donate QR", () => {
  test("default is the account-only code; every stop decodes to its own amount", () => {
    for (const amount of [0, ...STOPS]) {
      const payload = vietQrPayload(amount);
      const { size, text } = decode(payload);
      assert.equal(text, payload, `amount ${amount}`);
      // One size for every amount, so the page's pixel-per-module sizing holds.
      assert.equal(size, 37, `amount ${amount}`);
      assert.equal(payload.includes("5406") || payload.includes("5407") || payload.includes("5408"), amount > 0);
    }
  });

  test("the SVG names the account and the amount", () => {
    assert.match(donateQr(0), /no amount set/);
    assert.match(donateQr(0), new RegExp(MB_BANK.account));
    assert.match(donateQr(2_000_000), /2,000,000 VND prefilled/);
    assert.match(donateQr(0), /viewBox="0 0 45 45"/);
  });
});
