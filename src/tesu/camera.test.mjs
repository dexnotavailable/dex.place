// The camera's zoom (lane C 10-19, Dex: "remove zoom levels entirely; optimize without losing detail; crispness
// first"): a framing's zoom is where the camera rests, never snapped to an authored plate level, and it gets there
// continuously.
import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "./camera.ts";
import { ZOOMS } from "./config.ts";

const framing = (zoom) => ({ zoom, anchor: 0.67, horizon: 0.33, lead: 0, fixX: null, fixY: null, pin: null, bounds: null });

test("camera: a held framing between levels rests at its own zoom (no snapping to a level)", () => {
  for (const z of [0.72, 0.6, 0.35, 0.18]) {
    assert.ok(!ZOOMS.some((l) => Math.abs(l - z) < 1e-3), `${z} is between levels`);
    const c = new Camera();
    c.snap(0, 0, framing(1), 1);
    for (let i = 0; i < 600; i++) c.update(0, 0, 1, 0, framing(z));
    assert.ok(Math.abs(c.zoom - z) < 1e-6, `rested at ${c.zoom}, wanted ${z}`);
  }
});

test("camera: the zoom moves continuously toward the framing (no step larger than the ease)", () => {
  const c = new Camera();
  c.snap(0, 0, framing(1), 1);
  let last = c.zoom, worst = 0;
  for (let i = 0; i < 600; i++) {
    c.update(0, 0, 1, 0, framing(0.25));
    worst = Math.max(worst, Math.abs(Math.log(c.zoom) - Math.log(last)));
    last = c.zoom;
  }
  assert.ok(Math.abs(c.zoom - 0.25) < 1e-6);
  // the biggest step is the ease's first one (at most a fifth of the way in log space), never a jump to a level
  assert.ok(worst <= 0.2 * Math.abs(Math.log(0.25)) + 1e-9, `largest step ${worst}`);
});
