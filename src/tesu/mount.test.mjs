// The world window's loader progress (mount.ts): monotonic stages, exactly 1 when the world can start the opening.
import test from "node:test";
import assert from "node:assert/strict";
import { progressValue } from "./mount.ts";

const full = { plates: 1, close: true, font: true, ofuda: true, warming: false };

test("progress: exactly 1 once playable with the whole opening set in (no 0.9999999999999999)", () => {
  assert.equal(progressValue({ started: true, booted: true, drawn: true, playable: true, set: full }), 1);
  assert.equal(progressValue({ started: true, booted: true, drawn: true, playable: true, set: { ...full, plates: 0.7 + 0.1 + 0.1 + 0.1 } }), 1);
});

test("progress: below 1 until then, and in order", () => {
  const at = (o) => progressValue({ started: false, booted: false, drawn: false, playable: false, set: null, ...o });
  const steps = [
    at({}),
    at({ started: true }),
    at({ started: true, booted: true }),
    at({ started: true, booted: true, drawn: true, set: { ...full, plates: 0, close: false, font: false, ofuda: false } }),
    at({ started: true, booted: true, drawn: true, set: { ...full, plates: 0.5 } }),
    at({ started: true, booted: true, drawn: true, set: full }),
    at({ started: true, booted: true, drawn: true, playable: true, set: full }),
  ];
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] >= steps[i - 1], `step ${i}: ${steps[i]} < ${steps[i - 1]}`);
  assert.ok(steps[5] < 1, "the set in but not playable yet stays under 1");
  assert.equal(steps[6], 1);
});
