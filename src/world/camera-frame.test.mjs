// Frame width follows the window (no side borders) and the action camera's punch, ult zoom and
// reduced-motion behaviour.
import test from "node:test";
import assert from "node:assert/strict";
import { FRAME, FRAME_W, frameWidthFor } from "./config.ts";
import { WorldCamera } from "./room/camera.ts";

test("frame width covers the window's shape, within its range", () => {
  assert.equal(frameWidthFor(16 / 9), 1536);
  assert.equal(frameWidthFor(21 / 9), 2016);
  assert.equal(frameWidthFor(16 / 10), 1384);
  assert.equal(frameWidthFor(4 / 3), FRAME_W.min);
  assert.equal(frameWidthFor(9 / 19.5), FRAME_W.min);
  assert.equal(frameWidthFor(32 / 9), FRAME_W.max);
  for (const a of [1.5, 1.6, 1.78, 2, 2.2, 2.39, 2.6]) {
    const w = frameWidthFor(a);
    assert.ok(w >= FRAME.h * a - 1e-6 && w - FRAME.h * a < FRAME_W.step, `aspect ${a}: ${w}`);
  }
});

const bounds = [0, 0, 4000, 900];
const cam = () => { const c = new WorldCamera(); c.mode = { mode: "free" }; c.snapTo(800, 700, 1, bounds); return c; };

test("punch eases in fast, out slower, and ends at rest", () => {
  const c = cam();
  c.punch(0.07);
  let peak = 0;
  for (let i = 0; i < 12; i++) { c.update(800, 700, 1, bounds, false); peak = Math.max(peak, c.actionZoom); }
  assert.ok(peak > 1.02 && peak < 1.15, `peak ${peak}`);
  for (let i = 0; i < 200; i++) c.update(800, 700, 1, bounds, false);
  assert.equal(c.actionZoom, 1);
});

test("ult zoom eases in, holds while active, eases out", () => {
  const c = cam();
  c.ultActive = true;
  const seen = [];
  for (let i = 0; i < 60; i++) { c.update(800, 700, 1, bounds, false); seen.push(c.actionZoom); }
  assert.ok(seen[5] > 1 && seen[5] < seen[20], "eases in");
  assert.ok(Math.abs(seen[59] - seen[40]) < 1e-9 && seen[59] > 1.3, "holds at the top");
  c.ultActive = false;
  for (let i = 0; i < 120; i++) c.update(800, 700, 1, bounds, false);
  assert.equal(c.actionZoom, 1);
});

test("reduced motion: no punch, no ult zoom", () => {
  const c = cam();
  c.reducedMotion = true;
  c.punch(0.1);
  c.ultActive = true;
  for (let i = 0; i < 30; i++) c.update(800, 700, 1, bounds, false);
  assert.equal(c.actionZoom, 1);
});

test("running look-ahead leads the way she moves and grows with speed", () => {
  const a = cam(), b = cam();
  for (let i = 0; i < 200; i++) { a.update(800, 700, 1, bounds, true, 0, 0.8); b.update(800, 700, 1, bounds, true, 0, 2.6); }
  assert.ok(b.x > a.x, `${b.x} > ${a.x}`);
  const l = cam();
  for (let i = 0; i < 200; i++) l.update(800, 700, 1, bounds, true, 0, -2.6);
  assert.ok(l.x < a.x);
});
