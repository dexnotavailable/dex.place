// Run: node --test src/site/vietqr.test.mjs   (Node 24 strips the .ts types itself)
//
// 1. The payload matches the legacy, bank-app-checked generator byte for byte
//    wherever the legacy had an amount, and 0 VND gives the static no-amount form.
// 2. The QR encodes that payload: every code is rasterised and read back with
//    jsQR, both from the module grid and from the SVG path the page will show.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import jsQR from "jsqr";
import { crc16, isDonationAmount, MAX_VND, MB_BANK, tlv, vietQrPayload } from "./vietqr.ts";
import { qrGrid, qrPath, qrSvg } from "./qr.ts";

// ---- legacy oracle: copied verbatim from legacy/site/src/worldsite/sections/Donate.tsx
function legacyCrc16(input){let crc=0xffff;for(const char of input){crc^=char.charCodeAt(0)<<8;for(let i=0;i<8;i++)crc=crc&0x8000?(crc<<1)^0x1021:crc<<1;crc&=0xffff}return crc.toString(16).toUpperCase().padStart(4,'0')}
const legacyField=(id,value)=>id+String(value.length).padStart(2,'0')+value;
function legacyVietQrPayload(amount){const bank=legacyField('00','970422')+legacyField('01','0585739325');const merchant=legacyField('00','A000000727')+legacyField('01',bank)+legacyField('02','QRIBFTTA');const payload=legacyField('00','01')+legacyField('01','12')+legacyField('38',merchant)+legacyField('53','704')+legacyField('54',String(amount))+legacyField('58','VN')+legacyField('62',legacyField('08','dex support'))+'6304';return payload+legacyCrc16(payload)}
// ----

// Pinned outputs. 100,000 is the code Dex checked in his MB Bank app (2026-09-07).
const GOLDEN = {
  0: "00020101021138540010A00000072701240006970422011005857393250208QRIBFTTA53037045802VN62150811dex support6304BA1A",
  100000: "00020101021238540010A00000072701240006970422011005857393250208QRIBFTTA530370454061000005802VN62150811dex support630480C7",
  10000000: "00020101021238540010A00000072701240006970422011005857393250208QRIBFTTA53037045408100000005802VN62150811dex support6304FE96",
};

/** Splits a TLV string into [tag, value] pairs, checking every length. */
function parseTlv(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const id = text.slice(i, i + 2);
    const len = Number(text.slice(i + 2, i + 4));
    assert.match(id, /^\d{2}$/);
    assert.ok(Number.isInteger(len) && i + 4 + len <= text.length, `field ${id} overruns`);
    out.push([id, text.slice(i + 4, i + 4 + len)]);
    i += 4 + len;
  }
  return out;
}

describe("vietqr payload", () => {
  test("CRC-16/CCITT-FALSE check value", () => {
    assert.equal(crc16("123456789"), "29B1");
    assert.equal(crc16(""), "FFFF");
  });

  test("golden payloads for 0, 100,000 and 10,000,000 VND", () => {
    for (const [amount, expected] of Object.entries(GOLDEN)) {
      assert.equal(vietQrPayload(Number(amount)), expected);
    }
  });

  test("byte-for-byte equal to the legacy generator for every amount it could make", () => {
    // Legacy range: 100,000..10,000,000 in steps of 10,000.
    for (let amount = 100_000; amount <= MAX_VND; amount += 10_000) {
      assert.equal(vietQrPayload(amount), legacyVietQrPayload(amount), `amount ${amount}`);
    }
    // And any other positive whole amount.
    for (const amount of [1, 999, 12_345, 99_999, 5_555_555, 9_999_999]) {
      assert.equal(vietQrPayload(amount), legacyVietQrPayload(amount), `amount ${amount}`);
    }
  });

  test("0 VND is the legacy layout made static: 01 = 11 and no tag 54", () => {
    const legacyZero = legacyVietQrPayload(0); // what the legacy would have made: amount "0", dynamic
    const body = legacyZero.slice(0, -4).replace("010212", "010211").replace("5303704" + "54010", "5303704");
    assert.equal(vietQrPayload(0), body + crc16(body));
    assert.notEqual(vietQrPayload(0), legacyZero);
  });

  test("field structure, with and without an amount", () => {
    for (const amount of [0, 100_000, MAX_VND]) {
      const payload = vietQrPayload(amount);
      const fields = parseTlv(payload);
      const tags = fields.map(([id]) => id);
      assert.deepEqual(tags, amount > 0
        ? ["00", "01", "38", "53", "54", "58", "62", "63"]
        : ["00", "01", "38", "53", "58", "62", "63"]);
      const get = (id) => fields.find(([t]) => t === id)[1];
      assert.equal(get("00"), "01");
      assert.equal(get("01"), amount > 0 ? "12" : "11");
      assert.equal(get("53"), "704");
      assert.equal(get("58"), "VN");
      if (amount > 0) assert.equal(get("54"), String(amount));
      const merchant = parseTlv(get("38"));
      assert.deepEqual(merchant.map(([t]) => t), ["00", "01", "02"]);
      assert.equal(merchant[0][1], "A000000727");
      assert.equal(merchant[2][1], "QRIBFTTA");
      assert.deepEqual(parseTlv(merchant[1][1]), [["00", "970422"], ["01", "0585739325"]]);
      assert.deepEqual(parseTlv(get("62")), [["08", "dex support"]]);
      // CRC covers everything up to and including "6304".
      assert.equal(get("63"), crc16(payload.slice(0, -4)));
      assert.ok(payload.endsWith("6304" + get("63")));
    }
    assert.equal(MB_BANK.account, "0585739325");
  });

  test("rejects amounts outside 0..10,000,000 whole VND", () => {
    for (const bad of [-1, 0.5, 100_000.5, MAX_VND + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(isDonationAmount(bad), false);
      assert.throws(() => vietQrPayload(bad), RangeError);
    }
    assert.throws(() => tlv("5", "x"), RangeError);
    assert.throws(() => tlv("62", "x".repeat(100)), RangeError);
    assert.throws(() => crc16("đ"), RangeError);
  });
});

/** Paints a module predicate into RGBA pixels with a quiet zone, like a screenshot would. */
function rasterise(size, isDark, { quiet = 4, scale = 4 } = {}) {
  const side = (size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isDark(x, y)) continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const p = (((y + quiet) * scale + dy) * side + (x + quiet) * scale + dx) * 4;
          data[p] = data[p + 1] = data[p + 2] = 0;
        }
      }
    }
  }
  return { data, side };
}

/** Reads the dark modules back out of qrPath()'s "M x y h n v1 h -n z" runs. */
function modulesFromPath(d, size, offset) {
  const dark = new Set();
  for (const [, x, y, n] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(n); i += 1) dark.add(`${Number(x) + i - offset},${Number(y) - offset}`);
  }
  assert.equal(d.replace(/M\d+ \d+h\d+v1h-\d+z/g, ""), "", "path has only run rectangles");
  return (x, y) => dark.has(`${x},${y}`);
}

describe("QR encoding decodes back to the payload", () => {
  const amounts = [0, 100_000, 250_000, 1_000_000, 4_560_000, MAX_VND];

  test("module grid, read with jsQR", () => {
    for (const amount of amounts) {
      const payload = vietQrPayload(amount);
      const grid = qrGrid(payload);
      const { data, side } = rasterise(grid.size, (x, y) => grid.get(x, y));
      const read = jsQR(data, side, side, { inversionAttempts: "dontInvert" });
      assert.ok(read, `jsQR found no code for ${amount}`);
      assert.equal(read.data, payload);
    }
  });

  test("SVG path, read with jsQR", () => {
    for (const amount of amounts) {
      const payload = vietQrPayload(amount);
      const grid = qrGrid(payload);
      const quiet = 4;
      const svg = qrSvg(payload, { quiet, label: "MB Bank QR" });
      const d = /<path d="([^"]+)"/.exec(svg)[1];
      assert.equal(d, qrPath(grid, quiet));
      assert.match(svg, new RegExp(`viewBox="0 0 ${grid.size + quiet * 2} ${grid.size + quiet * 2}"`));
      const isDark = modulesFromPath(d, grid.size, quiet);
      const { data, side } = rasterise(grid.size, isDark, { quiet, scale: 3 });
      const read = jsQR(data, side, side, { inversionAttempts: "dontInvert" });
      assert.ok(read, `jsQR found no code in the SVG for ${amount}`);
      assert.equal(read.data, payload);
    }
  });
});
