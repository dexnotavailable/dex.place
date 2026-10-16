// Zhusha's sprite contract in Tesu: the anim.json rules, timing, the 2x reduction, and a guard on
// what is in public/assets/zhusha/ (only traced pixel art ships: no placeholders, no raw renders).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { AnimError, drawingIndex, headOf, moveToClip, opaqueBox, reducePixels, timeline, validateAnim } from "./zhusha/contract.ts";

const good = (o = {}) => ({ id: "m1_1", stage: "pixel", frames: [{ file: "f000.png", ticks: 2 }, { file: "f001.png", ticks: 3 }], pivot: [100, 200], figure_h: 192, hits: [1], ...o });

test("zhusha contract: a traced move validates; placeholders and bad files are refused", () => {
  assert.equal(validateAnim(good(), "m1_1").id, "m1_1");
  assert.throws(() => validateAnim(good({ stage: "placeholder" }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ key: [89, 115, 99] }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ id: "m1_2" }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ frames: [{ file: "../x.png", ticks: 2 }] }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ frames: [{ file: "f000.png", ticks: 0 }] }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ hits: [5] }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ pivot: [1] }), "m1_1"), AnimError);
});

test("zhusha contract: drawings hold their ticks; loops wrap, one-shots hold the last drawing", () => {
  const { starts, total } = timeline([{ ticks: 2 }, { ticks: 3 }, { ticks: 1 }]);
  assert.deepEqual(starts, [0, 2, 5]);
  assert.equal(total, 6);
  assert.deepEqual([0, 1, 2, 4, 5].map((t) => drawingIndex(starts, total, t, false)), [0, 0, 1, 1, 2]);
  assert.equal(drawingIndex(starts, total, 99, false), 2);
  assert.equal(drawingIndex(starts, total, 7, true), 0);
  assert.equal(drawingIndex(starts, total, -1, false), 0);
});

test("zhusha contract: a move's hit tick lands on the clip's hit drawing, then the clip plays at its own speed", () => {
  assert.equal(moveToClip(5, 5, 12), 12);
  assert.equal(moveToClip(0, 5, 12), 0);
  assert.ok(Math.abs(moveToClip(2.5, 5, 12) - 6) < 1e-9);
  assert.equal(moveToClip(9, 5, 12), 16);
  assert.equal(moveToClip(7, null, 12), 7);
});

test("zhusha contract: the 2x reduction keeps the outline, thin lines and only existing colours", () => {
  // 8 x 8: a white 6 x 6 square with a 1 px dark outline, and a 1 px diagonal line beside it
  const w = 12, h = 8, d = new Uint8ClampedArray(w * h * 4);
  const set = (x, y, c) => { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
  const INK = [30, 25, 35], WHITE = [250, 248, 240], BLADE = [120, 220, 255];
  for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) set(x, y, x === 1 || x === 6 || y === 1 || y === 6 ? INK : WHITE);
  for (let i = 0; i < 6; i++) set(8 + Math.floor(i / 2), 1 + i, BLADE);
  const r = reducePixels(d, w, h, 2, 0, 0);
  assert.equal(r.w, 6);
  assert.equal(r.h, 4);
  const at = (x, y) => { const i = (y * r.w + x) * 4; return r.data[i + 3] ? [r.data[i], r.data[i + 1], r.data[i + 2]] : null; };
  const colours = new Set();
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const c = at(x, y); if (c) colours.add(c.join()); }
  for (const c of colours) assert.ok([INK, WHITE, BLADE].some((k) => k.join() === c), `new colour ${c}`);
  // the square's corners keep the outline colour
  assert.deepEqual(at(0, 0), INK);
  assert.deepEqual(at(3, 3), INK);
  // the thin blade survives in every row it crosses
  for (let y = 0; y < 4; y++) assert.ok([4, 5].some((x) => at(x, y) && at(x, y).join() === BLADE.join()), `blade broken at row ${y}`);
});

test("zhusha contract: opaque box and head", () => {
  const w = 10, h = 10, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 3; y < 9; y++) for (let x = 4; x < 7; x++) d[(y * w + x) * 4 + 3] = 255;
  assert.deepEqual(opaqueBox(d, w, h), [4, 3, 7, 9]);
  assert.deepEqual(headOf(d, w, h, 5, 6), [5, 3]);
  assert.equal(opaqueBox(new Uint8ClampedArray(16), 2, 2), null);
});

// --- what ships ------------------------------------------------------------------

const ROOT = join(import.meta.dirname, "../../public/assets/zhusha");

test("public/assets/zhusha holds only traced pixel art that passes the contract", () => {
  if (!existsSync(ROOT)) return;
  for (const slot of readdirSync(ROOT)) {
    const dir = join(ROOT, slot);
    if (!statSync(dir).isDirectory()) {
      assert.fail(`stray file in public/assets/zhusha: ${slot}`);
    }
    const json = JSON.parse(readFileSync(join(dir, "anim.json"), "utf8"));
    const def = validateAnim(json, slot);
    const listed = new Set(def.frames.map((f) => f.file));
    for (const f of listed) assert.ok(existsSync(join(dir, f)), `${slot}: ${f} missing`);
    for (const f of readdirSync(dir)) {
      if (f === "anim.json") continue;
      assert.ok(listed.has(f), `${slot}: ${f} is not one of its drawings (only the drawings and anim.json ship)`);
      // a traced drawing is a PNG of a 192 px figure, not a video frame or a full render
      const size = statSync(join(dir, f)).size;
      assert.ok(size < 400_000, `${slot}: ${f} is ${size} bytes, too big for a traced drawing`);
    }
    assert.equal(def.figure_h, 192, `${slot}: figure_h must be 192 (one scale for every move)`);
  }
});
