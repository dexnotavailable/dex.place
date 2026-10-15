// The opening's timing, checked without a browser: her path lands on the plan's marks (gate 3 on the
// crash), the camera is continuous at every hand-over and lands on the widest frame on drop 2, captions and
// bars sit on their bars, the heard clock subtracts only the latency it is missing and never jumps, the
// "continue" rules hold, and the compiled data agree with the plan and the bones' bake.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { BEATS, barsAt, beatAt, cameraAt, captionAt, centreOf, fallAt, herPhase, herSpeedH, herXH, letterBox, mixShot, nextBarLine, widestShot } from "./opening/timeline.ts";
import { Opening } from "./opening.ts";
import { TileStore } from "./plates/store.ts";
import { HeardClock, onGrid } from "./opening/clock.ts";
import { pressContinues } from "./opening/press.ts";

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (±${eps})`);
const H = 96;

test("her path: the catch spot until the walk, the solved walk, the pickup and the break, gate 3 on the crash", () => {
  const h = BEATS.her;
  assert.equal(herXH(0), h.catchXH);
  assert.equal(herXH(h.walkFrom - 0.01), h.catchXH);
  near(herXH(h.pickup), h.xPickupH, 1e-6, "x at the pickup");
  near(herXH(h.drop1), h.xBreakH, 1e-6, "x at the break");
  near(herSpeedH(20), 1.1, 0.002, "the walk (the plan's 1.1 H/s)");
  near(herSpeedH(29.5), h.runHPerS, 1e-3, "the run");
  // the gates, from the plan's own gate times
  [115, 119, 123].forEach((g, i) => near(herXH(h.gates[i]), g, 0.03, `gate ${i + 1}`));
  near(herXH(BEATS.title.at), BEATS.her.gates[2] < BEATS.title.at + 0.02 ? 122.94 : 0, 0.05, "x on the crash");
  near(herXH(h.stop), h.stopXH, 1e-6, "she stops at the overlook");
  assert.equal(herPhase(h.stop + 1), "stand");
  // never steps back
  let last = -Infinity;
  for (let T = 0; T < 40; T += 1 / 60) {
    const x = herXH(T);
    assert.ok(x >= last - 1e-9, `backwards at T ${T.toFixed(3)}`);
    last = x;
  }
});

// a stand-in for the world's tracks: the reveal's keys as world/sections/opening.ts has them, and a terrace vista
const revealKeys = [[99.6, 2, 0.62, 0.27, 0], [101.6, 1.5, 0.64, 0.27, 0.02], [104.2, 1.1, 0.66, 0.28, 0.04], [107, 1, 0.68, 0.28, 0.04], [110, 0.8, 0.68, 0.3, 0.02], [115, 0.5, 0.67, 0.33, 0]];
const smooth = (u) => u * u * (3 - 2 * u);
const reveal = (x) => {
  const xH = x / H;
  let a = revealKeys[0], b = a, u = 0;
  if (xH >= revealKeys[revealKeys.length - 1][0]) a = b = revealKeys[revealKeys.length - 1];
  else for (let i = 1; i < revealKeys.length; i++) if (revealKeys[i][0] >= xH) { a = revealKeys[i - 1]; b = revealKeys[i]; u = smooth(Math.max(0, (xH - a[0]) / (b[0] - a[0]))); break; }
  return { zoom: Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * u), anchor: a[2] + (b[2] - a[2]) * u, horizon: a[3] + (b[3] - a[3]) * u, lead: a[4] + (b[4] - a[4]) * u, fixX: null, pin: null };
};
const world = () => ({ zoom: 0.5, anchor: 0.74, horizon: 0.4, lead: 0, fixX: null, pin: null });
const W = 1536;
const camAt = (T, extra = {}) => cameraAt(T, { x: herXH(T) * H, W, reveal, world, ...extra });

test("the camera: the postcard, the close band at 12.4, the whip lands on the widest frame on drop 2, the hand-back at 36.35", () => {
  const c0 = camAt(0);
  assert.equal(c0.zoom, 0.5);
  near(c0.cx, 100 * H, 1e-6, "the postcard's centre");
  const close = camAt(12.4);
  assert.equal(close.zoom, 2);
  near(close.cx, 101 * H, 1e-6, "the close band's centre (1 H ahead: she sits at 37.5% of the width)");
  near(camAt(BEATS.camera.whip.from).zoom, 0.626, 0.002, "the zoom at the break");
  near(camAt(BEATS.her.gates[0]).zoom, 0.568, 0.004, "the zoom at gate 1");
  near(camAt(BEATS.her.gates[1]).zoom, 0.341, 0.004, "the zoom at gate 2");
  const wide = camAt(BEATS.camera.widest.from);
  assert.deepEqual(wide, widestShot(W));
  assert.equal(wide.zoom, 0.125);
  // the palace's west gate pinned at 0.8 of the width
  near((143 * H - wide.cx) * wide.zoom + W / 2, 0.8 * W, 1e-6, "the pin");
  assert.equal(camAt(BEATS.ui.handBack), null);
  // the ease-in ends on the world's own framing at her x
  const end = camAt(BEATS.ui.handBack - 1e-4);
  near(end.zoom, 0.5, 0.001, "eased in to the terrace vista");
});

test("the camera never jumps: continuous across every hand-over (a tick apart, nothing more than its own motion)", () => {
  const marks = [6.626, 8.622, 10.616, 12.4, BEATS.camera.reveal.from, BEATS.camera.reveal.from + BEATS.camera.reveal.blend, BEATS.camera.whip.from, BEATS.camera.widest.from, BEATS.camera.easeIn.from];
  for (const m of marks) {
    const a = camAt(m - 1e-4), b = camAt(m + 1e-4);
    near(Math.log(b.zoom / a.zoom), 0, 0.002, `zoom at ${m}`);
    near(b.anchor - a.anchor, 0, 0.002, `anchor at ${m}`);
    near(b.horizon - a.horizon, 0, 0.002, `horizon at ${m}`);
    near(b.cx - a.cx, 0, 2, `centre at ${m}`);
  }
  // the whip is a hard stop on the crash: slow at first, fastest at the end
  const z = (T) => Math.log(camAt(T).zoom);
  const w = BEATS.camera.whip;
  assert.ok(Math.abs(z(w.from + 0.1) - z(w.from)) < Math.abs(z(w.to) - z(w.to - 0.1)), "accelerating into the crash");
});

test("the camera, reduced motion: held frames, cut on the plan's beats", () => {
  const r = (T) => cameraAt(T, { x: herXH(T) * H, W, reveal, world, reduced: true });
  assert.equal(r(5).zoom, 0.5);
  assert.equal(r(13).zoom, 2);
  assert.equal(r(18.5).zoom, 2);
  assert.equal(r(20).zoom, 1);
  assert.equal(r(31).zoom, 0.125);
  assert.equal(r(35).zoom, 1);
  assert.equal(r(BEATS.ui.handBack), null);
});

test("captions one per bar, the bars stepped in and out on drop 1, the fall lands on bar 2", () => {
  assert.equal(captionAt(0.5), null);
  assert.equal(captionAt(0.7), "To Zhusha, hunter of the western school.");
  assert.equal(captionAt(3), "The Emperor of Tesu opens his court to challengers.");
  assert.equal(captionAt(5), "A prize for every bout. Bring your sword.");
  assert.equal(captionAt(7), null);
  assert.equal(barsAt(0), 0);
  assert.deepEqual([0.05, 0.15, 0.25, 0.35].map((T) => barsAt(T)), [1 / 3, 2 / 3, 1, 1]);
  assert.equal(barsAt(BEATS.her.drop1 - 0.01), 1);
  assert.equal(barsAt(BEATS.her.drop1 + 0.1), 0.5);
  assert.equal(barsAt(BEATS.her.drop1 + 0.3), 0);
  assert.equal(fallAt(0), 0);
  assert.equal(fallAt(BEATS.bars[2]), 1);
  assert.equal(fallAt(10), 1);
  near(beatAt(20), (BEATS.bars[10] - BEATS.bars[9]) / 4, 1e-9, "a beat (bar 9)");
  assert.equal(nextBarLine(28.4), BEATS.bars[14]);
  near(nextBarLine(41), BEATS.bars[20] + (BEATS.bars[20] - BEATS.bars[19]), 1e-9, "past the measured bars");
});

test("mixShot and centreOf: zoom in log space, a pin by the frame's width", () => {
  const m = mixShot({ zoom: 0.5, anchor: 0, horizon: 0, cx: 0 }, { zoom: 2, anchor: 1, horizon: 1, cx: 10 }, 0.5);
  near(m.zoom, 1, 1e-9, "log midpoint");
  assert.equal(centreOf({ zoom: 0.5, anchor: 0, horizon: 0, lead: 0, fixX: null, pin: { x: 1000, at: 0.75 } }, 0, 800), 1000 - 0.25 * 1600);
});

/** A fake context whose output stamp lags currentTime by `inStamp` s and whose stated latency is base + output. */
function fakeCtx({ base = 0.01, output = 0.03, inStamp = 0, stamp = true } = {}) {
  const c = { t: 10, p: 1000, state: "running", baseLatency: base, outputLatency: output, sampleRate: 48000 };
  return {
    c,
    get currentTime() { return c.t; },
    get state() { return c.state; },
    get baseLatency() { return c.baseLatency; },
    get outputLatency() { return c.outputLatency; },
    getOutputTimestamp: stamp ? () => ({ contextTime: c.t - inStamp, performanceTime: c.p }) : undefined,
    advance(ms) { c.t += ms / 1000; c.p += ms; },
  };
}

test("the heard clock: only the latency the output stamp is missing is subtracted, never twice", () => {
  for (const inStamp of [0, 0.02, 0.04, 0.1]) {
    const ctx = fakeCtx({ inStamp });
    const clock = new HeardClock(ctx, () => ctx.c.p);
    clock.anchor(10, 0);
    for (let i = 0; i < 30; i++) { ctx.advance(16); clock.T(); }
    const L = 0.04;
    const expect = (ctx.c.t - 10) - Math.max(inStamp, L);
    near(clock.T(), expect, 0.002, `stamp already ${inStamp * 1000} ms behind`);
  }
  // no output stamp: currentTime minus the whole stated latency
  const ctx = fakeCtx({ stamp: false });
  const clock = new HeardClock(ctx, () => ctx.c.p);
  clock.anchor(10, 0);
  for (let i = 0; i < 10; i++) { ctx.advance(16); clock.T(); }
  near(clock.T(), ctx.c.t - 10 - 0.04, 0.002, "no stamp");
});

test("the heard clock: smooth (at most 1 ms a frame), re-anchors past 50 ms, holds while suspended, never backwards", () => {
  const ctx = fakeCtx({ inStamp: 0.04 });
  let p = 1000;
  const clock = new HeardClock(ctx, () => p);
  clock.anchor(10, 0);
  const step = (ms, ctxMs = ms) => { p += ms; ctx.c.p = p; ctx.c.t += ctxMs / 1000; return clock.T(); };
  let prev = step(16);
  for (let i = 0; i < 20; i++) prev = step(16);
  // the audio clock drifts 0.5 ms a frame slower than the page's: the picture follows by at most 1 ms a frame
  for (let i = 0; i < 20; i++) {
    const v = step(16, 15.5);
    assert.ok(v - prev <= 0.016 + 1e-9 && v - prev >= 0.016 - 0.001 - 1e-9, `nudged ${(v - prev - 0.016) * 1000} ms`);
    prev = v;
  }
  // a seek: re-anchored at once, and T jumps (the only time it may go anywhere but forward)
  ctx.c.t += 0.2;
  clock.anchor(ctx.c.t - 0.05, 27.49);
  const after = step(16);
  near(after, 27.49 + 0.05 + 0.016 - 0.04, 0.003, "after the seek");
  // suspended: T holds; resumed: it re-anchors and carries on
  ctx.c.state = "suspended";
  const held = step(16, 0);
  for (let i = 0; i < 10; i++) assert.equal(step(16, 0), held);
  ctx.c.state = "running";
  const back = step(16);
  near(back, held + 0.016, 0.003, "resumes where it held");
  // never backwards on its own
  let last = back;
  for (let i = 0; i < 50; i++) {
    const v = step(16, 16 - (i % 2) * 8);
    assert.ok(v >= last, "backwards");
    last = v;
  }
  near(onGrid(1.00001, 48000) * 48000 % 1, 0, 1e-6, "on the sample grid");
  assert.ok(onGrid(1.00001, 48000) >= 1.00001);
});

test("the page clock stands in without music, and pauses", () => {
  let p = 0;
  const clock = new HeardClock(null, () => p);
  clock.usePage(0);
  p = 500;
  near(clock.T(), 0.5, 1e-9, "page clock");
  clock.pausePage(true);
  p = 900;
  near(clock.T(), 0.5, 1e-9, "paused");
  clock.pausePage(false);
  p = 1000;
  near(clock.T(), 0.6, 1e-9, "resumed");
});

test("continue: a click on the letter pokes, the 300 ms guard, a press from before never counts, Space and Enter only, never on another control", () => {
  const base = { ready: true, readyAt: 1000, guardMs: 300, onStage: false, onOtherControl: false };
  assert.equal(pressContinues({ ...base, downAt: 1400 }), true);
  assert.equal(pressContinues({ ...base, downAt: 1400, onStage: true }), false, "the letter pokes");
  assert.equal(pressContinues({ ...base, downAt: 1200 }), false, "inside the guard");
  assert.equal(pressContinues({ ...base, downAt: 900 }), false, "began before the button");
  assert.equal(pressContinues({ ...base, ready: false, downAt: 1400 }), false, "not ready");
  assert.equal(pressContinues({ ...base, downAt: 1400, key: "Enter" }), true);
  assert.equal(pressContinues({ ...base, downAt: 1400, key: " " }), true);
  assert.equal(pressContinues({ ...base, downAt: 1400, key: "Escape" }), false, "Esc never starts it");
  assert.equal(pressContinues({ ...base, downAt: 1400, key: "Enter", repeat: true }), false, "auto-repeat");
  assert.equal(pressContinues({ ...base, downAt: 1400, key: "Enter", onOtherControl: true }), false, "the skip link's Enter");
});

// (the plan and the bones' bake live in the opening lane's folder on Dex's PC; elsewhere this one is skipped)
const LANE = "D:/Dex/Temp/dexplace-v2/lanes/opening";
test("the compiled data: the plan's bars and marks, the join's cut points, and the bones' bake decodes onto its own ties", { skip: !existsSync(`${LANE}/BEATS.json`) }, () => {
  const plan = JSON.parse(readFileSync(`${LANE}/BEATS.json`, "utf8").replace(/^\uFEFF/, ""));
  const bars = Object.keys(plan.track.bars).map(Number).sort((a, b) => a - b).map((k) => plan.track.bars[k]);
  bars.forEach((b, i) => near(BEATS.bars[i], b, 1e-4, `bar ${i}`));
  const tr = BEATS.track;
  // the seam sits inside both pieces with 0.1 s to spare each side
  near((tr.aEnd + 1) / tr.sampleRate - tr.seam, 0.1, 0.001, "A runs 0.1 s past the seam");
  near(tr.seam - tr.bFrom / tr.sampleRate, 0.1, 0.001, "B starts 0.1 s before it");
  assert.equal(tr.fade, 0.01);
  near(BEATS.title.at, 30.446, 0.001, "TESU on drop 2");
  near(BEATS.ui.skipTo, 27.49, 1e-9, "the skip lands on the hush's quietest beat");
  const f = JSON.parse(readFileSync(new URL("../../public/tesu/opening/ofuda-flight.json", import.meta.url), "utf8"));
  const raw = JSON.parse(readFileSync(`${LANE}/bones/data/ofuda_flight.json`, "utf8"));
  // decode the deltas and compare a few ticks against the bake
  const n = f.modes.length;
  assert.equal(n, raw.frames.length);
  const p = new Array(12).fill(0);
  for (let t = 0; t < n; t++) {
    for (let i = 0; i < 12; i++) p[i] += f.pts[t * 12 + i];
    if (t % 97 !== 0 && t !== n - 1) continue;
    const r = raw.frames[t];
    near(p[0] / 8, r.chain96[0].p[0], 0.07, `tick ${r.tick} tie x`);
    near(p[1] / 8, r.chain96[0].p[1], 0.07, `tick ${r.tick} tie y`);
    near(r.tie_H[0], 100 + r.chain96[0].p[0] / H, 0.01, "chain96 is px from her pivot at the catch");
  }
});

// --- the film v0 critic's must-fixes (lanes/opening/film-v0/CRITIC.md) -----------------------------------------

const WINDOWS = [[1280, 720], [1366, 768], [1536, 864], [1920, 1080], [1920, 912], [1266, 585], [390, 844]];
const BARS = BEATS.ui.bars.vh / 100;
/** The letter's box on the frame (shares of the width and height) and her feet's row and column, for a shot. */
const onFrame = (s, T, w, h) => {
  const b = letterBox(T);
  const feet = s.anchor * h, col = w / 2 + (100 * H - s.cx) * s.zoom;
  return {
    letter: b && { top: (feet + b[1] * s.zoom) / h, left: (w / 2 + (100 * H + b[0] - s.cx) * s.zoom) / w, right: (w / 2 + (100 * H + b[2] - s.cx) * s.zoom) / w },
    feet: feet / h, her: col / w,
  };
};

test("the letter stays out from under the bars on every window, from the landing to the catch (must-fix 2)", () => {
  for (const [w, h] of WINDOWS) {
    for (let T = BEATS.bars[2]; T < 12.6; T += 1 / 60) {
      const f = onFrame(cameraAt(T, { x: herXH(T) * H, W: w, H: h, reveal, world }), T, w, h);
      assert.ok(f.letter.top > BARS + 0.005, `${w}x${h} T ${T.toFixed(2)}: the letter at ${(100 * f.letter.top).toFixed(1)}% from the top, under the bar`);
      assert.ok(f.letter.left > 0 && f.letter.right < 1, `${w}x${h} T ${T.toFixed(2)}: the letter off the side`);
    }
  }
});

test("from the notice she stays in frame and clear of the bottom bar; the close band is the plan's on every window", () => {
  for (const [w, h] of WINDOWS) {
    for (let T = BEATS.bars[5]; T < BEATS.camera.reveal.from; T += 1 / 60) {
      const s = cameraAt(T, { x: herXH(T) * H, W: w, H: h, reveal, world });
      const f = onFrame(s, T, w, h);
      assert.ok(f.feet < 1 - BARS, `${w}x${h} T ${T.toFixed(2)}: her feet under the bottom bar (${f.feet.toFixed(3)})`);
      assert.ok(f.her > 0.05 && f.her < 0.95, `${w}x${h} T ${T.toFixed(2)}: she is off the side (${f.her.toFixed(3)})`);
      if (T >= 12.4) {
        assert.equal(s.zoom, 2);
        near(s.anchor, 0.66, 1e-9, `${w}x${h} the close band's feet row`);
        near(s.horizon, 0.27, 1e-9, `${w}x${h} the close band's horizon`);
        near(f.her, 0.375, 1e-6, `${w}x${h} her place across the close band (the plan's 37.5%)`);
      }
    }
  }
});

test("the safe follow: none on the plan's 1080p frame, never a jerk, the reduced postcard still one held frame", () => {
  // 1920 x 1080 shows the letter clear of the bars all along: the vertical keys are the plan's
  for (let T = 0; T < 16.6; T += 0.05) {
    const a = cameraAt(T, { x: herXH(T) * H, W: 1920, H: 1080, reveal, world }), b = cameraAt(T, { x: herXH(T) * H, W: 1920, reveal, world });
    near(a.anchor * 1080, b.anchor * 1080, 0.5, `T ${T.toFixed(2)} feet row at 1080p (px)`);
    near(a.cx * a.zoom, b.cx * b.zoom, 0.5, `T ${T.toFixed(2)} centre at 1080p (px)`);
  }
  for (const [w, h] of WINDOWS) {
    let prev = null;
    for (let T = 0; T < 17; T += 1 / 60) {
      const s = cameraAt(T, { x: herXH(T) * H, W: w, H: h, reveal, world });
      if (prev) {
        const dy = Math.abs(s.anchor - prev.anchor) * h, dx = Math.abs(s.cx - prev.cx) * s.zoom;
        assert.ok(dy < 6 && dx < 8, `${w}x${h} T ${T.toFixed(3)}: the frame moved ${dx.toFixed(1)}, ${dy.toFixed(1)} px in one tick`);
      }
      prev = s;
    }
  }
  // reduced motion: the postcard is one frame for its whole hold, the letter clear of the bar in it at 720p
  const held = (T) => cameraAt(T, { x: herXH(T) * H, W: 1280, H: 720, reveal, world, reduced: true });
  const p0 = held(0.5);
  for (let T = 0.5; T < 12.4; T += 0.1) {
    const s = held(T);
    assert.deepEqual([s.zoom, s.anchor, s.horizon, s.cx], [p0.zoom, p0.anchor, p0.horizon, p0.cx], `the held postcard moved at T ${T.toFixed(1)}`);
    if (T > BEATS.bars[2]) assert.ok(onFrame(s, T, 1280, 720).letter.top > BARS, `reduced 720p: the letter under the bar at T ${T.toFixed(1)}`);
  }
});

test("the effects are scheduled ahead on the context's clock, through any output delay (must-fix 3)", () => {
  for (const latency of [0.01, 0.06, 0.3, 0.45]) {
    const ctx = { state: "running", currentTime: 10 };
    const t0 = 10.05;
    const calls = [];
    const host = {
      herX: () => 100 * H, moveTo() {}, pose() {}, touchedSince: () => false, inputTick: () => 0, release() {}, title() {}, titleAt() {},
      sfx: (id, at) => calls.push({ id, at, now: ctx.currentTime }), sfxCancel() {}, bed() {},
      framing: () => world(), frameW: () => 1280, frameH: () => 720, cut() {}, cine() {},
    };
    const link = {
      T: () => ctx.currentTime - t0 - latency, epoch: 0, reduced: false, repeat: false, music: true,
      ctxTimeOf: (T) => t0 + T, skip: () => false, input() {}, ctx,
    };
    const o = new Opening(host);
    o.start(link);
    while (ctx.currentTime < t0 + 32 + latency) {
      ctx.currentTime += 1 / 60;
      o.tick();
    }
    assert.equal(calls.length, BEATS.sfx.length, `latency ${latency}: every cue asked for once`);
    for (const c of BEATS.sfx) {
      const call = calls.find((k) => k.id === c.id);
      if (c.T === 0) continue; // the press's own gust: at once if the first tick is late
      near(call.at, t0 + c.T, 1e-9, `latency ${latency}: ${c.id} on its beat on the context's clock`);
      assert.ok(call.at - call.now >= 0.2, `latency ${latency}: ${c.id} asked for ${(call.at - call.now).toFixed(3)} s ahead`);
    }
  }
});

test("the plate store keeps the opening's tiles until the camera is past them (must-fix 1)", () => {
  const store = new TileStore({ layers: 3, upload() {} }, { sync: true });
  const px = new Uint8Array(1);
  const put = (k, onScreen = false) => {
    const [id, lv, tx, ty] = k.split("|");
    if (onScreen) store.get(id, Number(lv), Number(tx), Number(ty), 0);
    else store.want(id, Number(lv), Number(tx), Number(ty), 30);
    store.finish(k, px, 0);
  };
  const A = "play|1|0|0", B = "play|1|1|0", C = "play|1|2|0";
  store.keepT = 5;
  store.keep(A, 10, 20);
  store.keep(B, 6, 8);
  store.keep(C, 30, 40);
  [A, B, C].forEach((k) => put(k));
  store.frame += 2;
  // a margin tile asked ahead may not take a kept tile's place
  put("play|1|9|9");
  assert.equal(store.layerOf("play|1|9|9"), undefined);
  assert.ok([A, B, C].every((k) => store.layerOf(k) >= 0), "every kept tile still there");
  // a tile on screen now takes the one kept for latest (TESU's at 30 before the walk's at 10)
  put("play|1|5|5", true);
  assert.equal(store.layerOf(C), undefined, "the latest kept tile gave way");
  assert.ok(store.layerOf(A) >= 0 && store.layerOf(B) >= 0);
  // past its span a kept tile is like any other (least recently used first)
  store.keepT = 9;
  store.frame += 2;
  put("play|1|7|7");
  assert.equal(store.layerOf(B), undefined, "B (needed to T 8) went at T 9");
  assert.ok(store.layerOf(A) >= 0, "A (needed from T 10) stays");
  store.clearKeep();
  assert.equal(store.keptLayers(), 0);
});
