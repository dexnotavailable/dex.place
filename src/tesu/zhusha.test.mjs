// Zhusha in Tesu: the sprite contract at 128 px (one size), its marks (apex, active, root motion, cancel
// windows), the idle variant player, her units (charScale, metres, run speeds), the art transform (128 px art
// at her drawn height on the play plane), the real controller (charScale body, m/s speeds, marks driving a move),
// and a guard on what is in public/assets/zhusha/ (only finished pixel art ships: no placeholders, no renders).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";
import {
  AnimError, FIGURE_H, artMarks, clipAtRoot, drawingIndex, headOf, moveToClip, opaqueBox, rootAt, timeline, validateAnim,
} from "./zhusha/contract.ts";
import { IdlePlayer, seeded } from "./zhusha/idle.ts";
import { clipToMove, resolveMove } from "./zhusha/timing.ts";
import { artPx, artTransform, checkUnits, drawnH, mpsToHps, pxPerTick, runHps } from "./zhusha/units.ts";

register("./zhusha/test-raw-hooks.mjs", import.meta.url);

const FEEL = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/feel.json"), "utf8"));
const H = 96;

const good = (o = {}) => ({ id: "m1_1", stage: "pixel", frames: [{ file: "f000.png", ticks: 2 }, { file: "f001.png", ticks: 3 }], pivot: [70, 140], figure_h: 128, hits: [1], ...o });

// --- the contract at 128 ----------------------------------------------------------

test("zhusha contract: a 128 px move validates; placeholders, other sizes and bad files are refused", () => {
  assert.equal(FIGURE_H, 128);
  assert.equal(validateAnim(good(), "m1_1").id, "m1_1");
  assert.throws(() => validateAnim(good({ figure_h: 192 }), "m1_1"), /figure_h 192/);
  assert.throws(() => validateAnim(good({ figure_h: 96 }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ stage: "placeholder" }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ key: [89, 115, 99] }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ id: "m1_2" }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ frames: [{ file: "../x.png", ticks: 2 }] }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ frames: [{ file: "f000.png", ticks: 0 }] }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ hits: [5] }), "m1_1"), AnimError);
  assert.throws(() => validateAnim(good({ pivot: [1] }), "m1_1"), AnimError);
});

test("zhusha contract: a slot-in --local drop passes only on the dev server's loader, never the tests, build or production", () => {
  const local = good({ local: "LOCAL ONLY" });
  assert.throws(() => validateAnim(local, "m1_1"), /local-only drop/);
  assert.ok(validateAnim(local, "m1_1", { allowLocal: true }));
});

test("zhusha contract: a drawing's measured figure must be 128 px (within 2)", () => {
  const fr = (fig) => good({ frames: [{ file: "f000.png", ticks: 2, fig: 128 }, { file: "f001.png", ticks: 3, fig }] });
  assert.ok(validateAnim(fr(127), "m1_1"));
  assert.ok(validateAnim(fr(130), "m1_1"));
  assert.throws(() => validateAnim(fr(192), "m1_1"), /figure 192 px/);
  assert.throws(() => validateAnim(fr(96), "m1_1"), /figure 96 px/);
});

test("zhusha contract: the marks validate (apex, active, root, cancel) and bad ones are named", () => {
  const f = (o) => good({ frames: [{ file: "f000.png", ticks: 2 }, { file: "f001.png", ticks: 3, ...o }] });
  assert.ok(validateAnim(f({ apex: true, active: true, root: 4.5, cancel: ["chain", "move"] }), "m1_1"));
  assert.ok(validateAnim(f({ active: 2 }), "m1_1"));
  assert.throws(() => validateAnim(f({ apex: 1 }), "m1_1"), /apex/);
  assert.throws(() => validateAnim(f({ active: -1 }), "m1_1"), /active/);
  assert.throws(() => validateAnim(f({ root: "far" }), "m1_1"), /root/);
  assert.throws(() => validateAnim(f({ root: 400 }), "m1_1"), /root/);
  assert.throws(() => validateAnim(f({ cancel: ["teleport"] }), "m1_1"), /cancel/);
});

test("zhusha contract: idle_variant must name a base loop inside the take and a loop count range", () => {
  const frames = Array.from({ length: 8 }, (_, i) => ({ file: `f00${i}.png`, ticks: 5 }));
  const idle = (v) => ({ id: "idle", stage: "pixel", frames, pivot: [64, 140], figure_h: 128, loop: true, idle_variant: v });
  assert.ok(validateAnim(idle({ base: [0, 3], every: [2, 4] }), "idle"));
  assert.throws(() => validateAnim(idle({ base: [3, 3], every: [2, 4] }), "idle"), /idle_variant.base/);
  assert.throws(() => validateAnim(idle({ base: [0, 8], every: [2, 4] }), "idle"), /idle_variant.base/);
  assert.throws(() => validateAnim(idle({ base: [0, 3], every: [0, 4] }), "idle"), /idle_variant.every/);
  assert.throws(() => validateAnim(idle({ base: [0, 3], every: [5, 4] }), "idle"), /idle_variant.every/);
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
  // and back
  for (const t of [0, 2.5, 5, 9]) assert.ok(Math.abs(clipToMove(moveToClip(t, 5, 12), 5, 12) - t) < 1e-9);
});

test("zhusha contract: opaque box and head", () => {
  const w = 10, h = 10, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 3; y < 9; y++) for (let x = 4; x < 7; x++) d[(y * w + x) * 4 + 3] = 255;
  assert.deepEqual(opaqueBox(d, w, h), [4, 3, 7, 9]);
  assert.deepEqual(headOf(d, w, h, 5, 6), [5, 3]);
  assert.equal(opaqueBox(new Uint8ClampedArray(16), 2, 2), null);
});

// --- marks as clip ticks ------------------------------------------------------------

// a swing: 2 wind-up drawings, 2 active (one hit), a recovery with a second, separate hit, root motion on the step
const SWING = [
  { file: "f000.png", ticks: 3, root: 0 },
  { file: "f001.png", ticks: 2, root: 6, apex: true },
  { file: "f002.png", ticks: 2, root: 10, active: true },
  { file: "f003.png", ticks: 4, root: 4, active: true, cancel: ["chain"] },
  { file: "f004.png", ticks: 3, active: 1, cancel: ["hit"] },
  { file: "f005.png", ticks: 6, cancel: ["cancel", "move"] },
  { file: "f006.png", ticks: 6 },
];

test("zhusha marks: active runs become hit windows, cancel marks open at their first drawing, apex and root as ticks", () => {
  const m = artMarks({ frames: SWING, hits: [2] });
  assert.equal(m.total, 26);
  assert.equal(m.apex, 3);
  assert.deepEqual(m.active, [{ at: 5, len: 6 }, { at: 11, len: 3 }]);
  assert.deepEqual(m.cancel, { chain: 7, hit: 11, cancel: 14, move: 14 });
  assert.deepEqual(m.root, [0, 0, 6, 16, 20, 20, 20, 20]);
  assert.deepEqual(m.hitTicks, [5]);
  // no marks: nothing overrides feel.json
  const none = artMarks({ frames: [{ file: "f000.png", ticks: 4 }], segments: undefined });
  assert.equal(none.active, null);
  assert.equal(none.root, null);
  assert.equal(none.cancel, null);
  assert.equal(none.apex, null);
  // jump_arc's segments still give the apex when no drawing is marked
  assert.equal(artMarks({ frames: SWING.map(({ apex, ...f }) => f), segments: [4, 5] }).apex, 11);
});

test("zhusha marks: root motion spreads over a drawing's ticks, and a cycle maps distance back to its clip tick", () => {
  const cum = artMarks({ frames: SWING }).root;
  assert.equal(rootAt(SWING, cum, 0), 0);
  assert.equal(rootAt(SWING, cum, 3), 0);
  assert.equal(rootAt(SWING, cum, 4), 3);
  assert.equal(rootAt(SWING, cum, 5), 6);
  assert.equal(rootAt(SWING, cum, 99), 20);
  // a run cycle: 4 drawings of 4 ticks, 8 art px each (a 32 px stride)
  const run = Array.from({ length: 4 }, (_, i) => ({ file: `f00${i}.png`, ticks: 4, root: 8 }));
  const rc = artMarks({ frames: run }).root;
  assert.equal(clipAtRoot(run, rc, 0), 0);
  assert.equal(clipAtRoot(run, rc, 8), 4);
  assert.equal(clipAtRoot(run, rc, 12), 6);
  assert.equal(clipAtRoot(run, rc, 32 + 12), 6, "the cycle repeats every stride");
});

test("zhusha timing: with no drawing a move is exactly feel.json's; with marks the drawing times it", () => {
  const feel = FEEL.moves.m1_1;
  const plain = resolveMove(feel, null, 0.825);
  assert.deepEqual(plain.hits, feel.hits);
  assert.equal(plain.cancelFrom, feel.cancelFrom);
  assert.equal(plain.root, null);
  assert.deepEqual(plain.fromArt, { hits: false, root: false, cancel: false });

  const a = 0.825;
  const r = resolveMove(feel, { frames: SWING }, a);
  assert.deepEqual(r.fromArt, { hits: true, root: true, cancel: true });
  assert.deepEqual(r.hits.map((h) => [h.at, h.len]), [[5, 6], [11, 3]]);
  // the hits keep feel.json's boxes, damage and weight (the second run reuses the last feel hit)
  assert.deepEqual(r.hits[0].box, feel.hits[0].box);
  assert.equal(r.hits[1].dmg, feel.hits[0].dmg);
  assert.equal(r.chainFrom, 7);
  assert.equal(r.hitCancelFrom, 11);
  assert.equal(r.cancelFrom, 14);
  assert.equal(r.moveFrom, 14);
  assert.equal(r.clipHitAt, 5, "art hits: the move is the clip's own clock");
  assert.ok(r.ticks >= 15);
  // root: per tick world px, summing to the drawing's 20 art px at her drawn scale
  const sum = r.root.reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(sum - 20 * a) < 1e-9, `root total ${sum}`);
  assert.equal(r.root[1], 0, "no step during the first drawing");
});

test("zhusha timing: root marks without active marks follow the clip as fitted to feel.json's hit", () => {
  const feel = FEEL.moves.m1_1; // first hit at tick 5
  const frames = SWING.map(({ active, cancel, ...f }) => f);
  const r = resolveMove(feel, { frames, hits: [2] }, 1);
  assert.equal(r.fromArt.hits, false);
  assert.equal(r.hits[0].at, feel.hits[0].at);
  assert.equal(r.clipHitAt, 5);
  assert.ok(Math.abs(r.root.reduce((x, y) => x + y, 0) - 20) < 1e-9);
});

// --- the idle variant player ---------------------------------------------------------

test("zhusha idle: the base loop plays forward and back, then the whole take once, then the base loop", () => {
  const ticks = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
  const p = new IdlePlayer(ticks, { base: [0, 3], every: [2, 2] }, seeded(1));
  assert.deepEqual(p.loopSeq, [0, 1, 2, 3, 2, 1]);
  assert.equal(p.loopTicks, 24);
  const seq = [];
  for (let t = 0; t < 2 * 24 + 40 + 24; t += 4) seq.push(p.at(t).index);
  assert.deepEqual(seq, [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 2, 1]);
  assert.equal(p.at(48).kind, "full");
  assert.equal(p.at(88).kind, "base");
});

test("zhusha idle: the loop count before each full play-through is random in [min, max] and repeatable for a seed", () => {
  const ticks = Array(12).fill(5);
  const v = { base: [0, 4], every: [2, 5] };
  const a = new IdlePlayer(ticks, v, seeded(42)), b = new IdlePlayer(ticks, v, seeded(42)), c = new IdlePlayer(ticks, v, seeded(43));
  const counts = a.segments(60 * 600).filter((s) => s.kind === "base").map((s) => s.loops);
  assert.ok(counts.length > 20);
  assert.ok(counts.every((n) => n >= 2 && n <= 5), JSON.stringify(counts));
  assert.ok(new Set(counts).size > 1, "it varies");
  for (let t = 0; t < 4000; t += 7) assert.equal(a.at(t).index, b.at(t).index);
  let differs = false;
  for (let t = 0; t < 4000 && !differs; t += 7) differs = a.at(t).index !== c.at(t).index;
  assert.ok(differs, "another seed, another idle");
  // every full play-through shows every drawing of the take, each held its ticks
  const full = a.segments(4000).find((s) => s.kind === "full");
  for (let i = 0; i < 12; i++) assert.equal(a.at(full.start + i * 5).index, i);
});

// --- units: charScale, metres, speeds -----------------------------------------------------

test("zhusha units: charScale 0.88 by default (Dex 10-19, 20% smaller); 128 art at her drawn height is 1.32 screen px per art px at play zoom", () => {
  checkUnits(FEEL);
  assert.equal(FEEL.charScale, 0.88);
  assert.ok(Math.abs(drawnH(FEEL, H) - 84.48) < 1e-9);
  assert.ok(Math.abs(artPx(FEEL, H) - 0.66) < 1e-9);
  const screenPerWorld = 2; // play zoom: 1 world px = 2 screen px
  assert.ok(Math.abs(artPx(FEEL, H) * screenPerWorld - 1.32) < 1e-9);
  // 20% smaller than the 10-18 size (1.1: 1.65 screen px per art px)
  assert.ok(Math.abs(artPx({ ...FEEL, charScale: 1.1 }, H) * 0.8 - artPx(FEEL, H)) < 1e-9);
  // on a 1080p screen (1 world px = 1 screen px) an art px is under one px: game.ts reduces her there, never nearest
  assert.ok(artPx(FEEL, H) < 1);
});

test("zhusha units: run speeds are 9 and 11 m/s at 1.77 m per H, and charScale does not change them", () => {
  assert.equal(FEEL.units.metresPerH, 1.77);
  assert.equal(FEEL.run.mps, 9);
  assert.equal(FEEL.run.ultMps, 11);
  assert.ok(Math.abs(runHps(FEEL, false) - 9 / 1.77) < 1e-12);
  assert.ok(Math.abs(runHps(FEEL, true) - 11 / 1.77) < 1e-12);
  assert.ok(Math.abs(runHps(FEEL, false) - 5.085) < 0.001);
  assert.ok(Math.abs(runHps(FEEL, true) - 6.215) < 0.001);
  const big = { ...FEEL, charScale: 1.5 };
  assert.equal(runHps(big, false), runHps(FEEL, false));
  assert.equal(mpsToHps(big, 9), mpsToHps(FEEL, 9));
  // back to metres: px per tick * 60 / H * 1.77
  assert.ok(Math.abs((pxPerTick(runHps(FEEL, false), H) * 60) / H * 1.77 - 9) < 1e-9);
  assert.throws(() => checkUnits({ ...FEEL, charScale: 0 }), /charScale/);
  assert.throws(() => checkUnits({ ...FEEL, units: {} }), /metresPerH/);
  assert.throws(() => checkUnits({ ...FEEL, run: { mps: 9 } }), /ultMps/);
});

test("zhusha units: the art transform puts every art px on a fixed frame px around her snapped pivot", () => {
  // the world renderer under setTransform(z, focus): frame = round((x - cam - focus) * z + focus), x a whole px
  const sx = (x, cam, z, f) => (z === 1 ? Math.round(x) - cam : Math.round((Math.round(x) - cam - f) * z + f));
  for (const view of [{ s: 1, focus: [768, 560], mirror: null }, { s: 2, focus: [768, 560], mirror: null }, { s: 0.5, focus: [700, 600], mirror: 640 }]) {
    const camX = 4123, camY = 900, px = 4900.4, py = 1312.7, a = 0.825;
    const xf = artTransform(view, camX, camY, px, py, a);
    assert.ok(Math.abs(xf.z - view.s * a) < 1e-12);
    // the pivot is where the play plane puts her feet (whole px)
    const Px = Math.round((Math.round(px) - camX - view.focus[0]) * view.s + view.focus[0]);
    assert.deepEqual(xf.pivot[0], Px);
    // art column i lands on round(pivot + i * z), the same in every drawing
    for (const i of [-60, -1, 0, 1, 37, 64]) {
      assert.equal(sx(xf.q[0] + i, camX, xf.z, xf.focus[0]), Math.round(xf.pivot[0] + i * xf.z), `col ${i} at s ${view.s}`);
      assert.equal(sx(xf.q[1] + i, camY, xf.z, xf.focus[1]), Math.round(xf.pivot[1] + i * xf.z), `row ${i} at s ${view.s}`);
    }
  }
  // 128 art rows over her drawn height: 105 or 106 frame rows at play zoom, 211 or 212 at the close band's 2x
  for (const [s, lo, hi] of [[1, 105, 106], [2, 211, 212]]) {
    const xf = artTransform({ s, focus: [768, 560], mirror: null }, 0, 0, 500, 700, 0.825);
    const top = Math.round(xf.pivot[1] - 128 * xf.z);
    assert.ok(xf.pivot[1] - top >= lo && xf.pivot[1] - top <= hi);
  }
  // exactly 1 world px per art px at zoom 1 (z = 1): a plain offset
  const one = artTransform({ s: 1, focus: [0, 0], mirror: null }, 10, 20, 100, 200, 1);
  assert.equal(one.z, 1);
  assert.deepEqual([one.q[0] - 10, one.q[1] - 20], one.pivot);
});

// --- the real controller (charScale body, speeds, marks) -----------------------------------

const host = () => ({
  vfx: { spawn() {} },
  feel: { freeze() {}, slowmo() {}, impactFrame() {}, sound() {}, reducedMotion: false },
  camera: { shake() {}, zoomPunch() {} },
});
class FakeInput {
  tick = 0; down = new Set(); presses = new Map();
  isDown(a) { return this.down.has(a); }
  pressTick(a) { return this.presses.get(a); }
  consume(a) { this.presses.delete(a); }
  axis() { return (this.down.has("right") ? 1 : 0) - (this.down.has("left") ? 1 : 0); }
  press(a) { this.presses.set(a, this.tick); }
}
// flat ground at y = 0
const flat = { move(b, dx, dy) { b.x += dx; b.y += dy; let landed = false; if (b.y >= 0) { landed = !b.grounded; b.y = 0; b.vy = 0; b.grounded = true; } else b.grounded = false; return { landed }; }, groundBelow: () => ({ y: 0 }) };
const loadZ = async () => (await import("./zhusha/controller.ts")).Zhusha;
const step = (z, inp, n = 1) => { for (let i = 0; i < n; i++) { inp.tick++; z.update(inp, flat); } };

test("zhusha controller: her hurtbox and attack boxes follow her drawn body (H x charScale)", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  const hb = z.hurtboxes()[0];
  assert.ok(Math.abs(hb.h - FEEL.body.hurtH * 96 * FEEL.charScale) < 1e-9, `hurtbox h ${hb.h}`);
  assert.ok(Math.abs(hb.w - FEEL.body.hurtW * 96 * FEEL.charScale) < 1e-9);
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("m1");
  const at = FEEL.moves.m1_1.hits[0].at;
  let box = null;
  for (let i = 0; i < 12 && !box; i++) { step(z, inp); box = z.hitboxes()[0]?.box ?? null; }
  assert.ok(box, "m1_1 hit came out");
  const [, , w, h] = FEEL.moves.m1_1.hits[0].box;
  const body = 96 * FEEL.charScale;
  assert.ok(Math.abs(box.w - w * body) < 1e-6 && Math.abs(box.h - h * body) < 1e-6, JSON.stringify(box));
  assert.equal(z.t, at);
});

test("zhusha controller: she runs at 9 m/s, 11 m/s in the ult form, whatever charScale says", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  const inp = new FakeInput();
  inp.down.add("right");
  step(z, inp, 30);
  const x0 = z.body.x;
  step(z, inp, 60);
  const mps = ((z.body.x - x0) / 96) * 1.77;
  assert.ok(Math.abs(mps - 9) < 1e-6, `normal ${mps} m/s`);
  z.form = 5000;
  step(z, inp, 30);
  const x1 = z.body.x;
  step(z, inp, 60);
  const ult = ((z.body.x - x1) / 96) * 1.77;
  assert.ok(Math.abs(ult - 11) < 1e-6, `ult ${ult} m/s`);
});

test("zhusha controller: a drawing's marks drive the move (hit windows, the chain window, root motion)", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  z.clipOf = (role) => (role === "m1_1" ? { id: "m1_1", stage: "pixel", frames: SWING, pivot: [64, 140], figure_h: 128 } : null);
  const inp = new FakeInput();
  step(z, inp, 5);
  const x0 = z.body.x;
  inp.press("m1");
  step(z, inp); // the move starts on this tick
  assert.equal(z.state, "move");
  const live = [];
  for (let t = 1; t < 15; t++) { step(z, inp); if (z.hitboxes().length) live.push(z.t); }
  assert.deepEqual(live, [5, 6, 7, 8, 9, 10, 11, 12, 13], "active drawings: ticks 5-10 and 11-13");
  step(z, inp, 40);
  const moved = z.body.x - x0;
  assert.ok(Math.abs(moved - 20 * (96 * FEEL.charScale) / 128) < 1e-6, `root motion moved her ${moved} px`);
  // the chain: a press early in the move waits for the drawing's chain window (tick 7)
  const z2 = new Zhusha(host(), [0, 0]);
  z2.clipOf = z.clipOf;
  const i2 = new FakeInput();
  step(z2, i2, 5);
  i2.press("m1");
  step(z2, i2);
  step(z2, i2);
  i2.press("m1");
  let chainedAt = null;
  for (let t = 0; t < 20 && chainedAt === null; t++) { const was = z2.t; step(z2, i2); if (z2.lastAction === "m1_2") chainedAt = was + 1; }
  assert.equal(chainedAt, 7);
});

// --- what ships ------------------------------------------------------------------

const ROOT = join(import.meta.dirname, "../../public/assets/zhusha");

test("public/assets/zhusha holds only finished 128 px pixel art that passes the contract", () => {
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
      // a drawing is a small PNG of a 128 px figure, not a video frame or a full render
      const size = statSync(join(dir, f)).size;
      assert.ok(size < 200_000, `${slot}: ${f} is ${size} bytes, too big for a 128 px drawing`);
    }
    assert.equal(def.figure_h, 128, `${slot}: figure_h must be 128 (one size for every character)`);
  }
});
