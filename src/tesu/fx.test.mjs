// World effects as pixel sprite animations (lane C 10-19; lanes/engine/EFFECTS-CONTRACT.md): fx.json's rules, the
// player's clock, and every shipped effect checked against the contract.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkFxDrawing, fxCells, FX_CELL, FX_MAX_LIVE, FxClock, fxClipRows, fxFrameAt, fxGroundClip, validateFx } from "./fx/contract.ts";

const good = (o = {}) => ({
  id: "spark", stage: "pixel", px: 1, pivot: [12, 20], layer: "front", attach: "world",
  frames: [{ file: "f000.png", ticks: 2 }, { file: "f001.png", ticks: 3, off: [2, 0] }, { file: "f002.png", ticks: 1, opacity: 0.5 }],
  ...o,
});

test("fx contract: a finished effect validates, with defaults (layer front, attach world, reflect, one-shot)", () => {
  const d = validateFx(good(), "spark");
  assert.equal(d.layer, "front");
  assert.equal(d.attach, "world");
  assert.equal(d.reflect, true);
  assert.equal(d.loop, false);
  const m = validateFx({ id: "m", stage: "pixel", px: 1, pivot: [0, 0], frames: [{ file: "f000.png", ticks: 1 }] }, "m");
  assert.equal(m.layer, "front");
  assert.equal(m.attach, "world");
});

test("fx contract: wrong id, stage, px, pivot, layer, attach, frames are refused and named", () => {
  const bad = [
    [good({ id: "other" }), /folder/],
    [good({ stage: "h3" }), /stage/],
    [good({ px: 2 }), /her art px/],
    [good({ pivot: [1.5, 2] }), /pivot/],
    [good({ layer: "over" }), /layer/],
    [good({ attach: "blade" }), /attach/],
    [good({ frames: [] }), /no frames/],
    [good({ frames: [{ file: "a.png", ticks: 1 }] }), /fNNN/],
    [good({ frames: [{ file: "f000.png", ticks: 0 }] }), /ticks/],
    [good({ frames: [{ file: "f000.png", ticks: 1, opacity: 2 }] }), /opacity/],
  ];
  for (const [j, re] of bad) assert.throws(() => validateFx(j, "spark"), re);
  assert.throws(() => validateFx(good({ id: "Bad-Id" }), "Bad-Id"), /valid id/);
});

test("fx contract: drawings are hard pixels within the size limit", () => {
  const px = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < 16; i++) px[i * 4 + 3] = i % 2 ? 255 : 0;
  assert.deepEqual(checkFxDrawing(px, 4, 4, "f000.png"), []);
  px[3] = 128;
  assert.match(checkFxDrawing(px, 4, 4, "f000.png")[0], /half-transparent/);
  assert.deepEqual(checkFxDrawing(new Uint8Array(0), 4096, 4096, "f001.png"), [], "4096 a side is allowed (10-19 v2)");
  assert.match(checkFxDrawing(new Uint8Array(0), 5000, 10, "f001.png")[0], /over 4096 x 4096/);
});

test("fx cells: a big sparse drawing stores only its painted cells, trimmed; a repeated cell has one key", () => {
  const W = 3000, H = 1200, px = new Uint8Array(W * H * 4);
  const dot = (x, y, c) => { const i = (y * W + x) * 4; px[i] = c; px[i + 1] = 2; px[i + 2] = 3; px[i + 3] = 255; };
  // two identical 3 x 2 strokes in different cells, one different stroke, the rest empty
  for (const [ox, oy] of [[10, 10], [10 + 5 * FX_CELL, 3 * FX_CELL + 10]]) for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) dot(ox + x, oy + y, 200);
  dot(2999, 1199, 7);
  const cells = fxCells(px, W, H);
  assert.equal(cells.length, 3);
  const [a, b, c] = cells;
  assert.deepEqual([a.x, a.y, a.w, a.h], [10, 10, 3, 2], "trimmed to the stroke");
  assert.equal(a.key, b.key, "the same pixels: stored once");
  assert.notEqual(a.key, c.key);
  assert.deepEqual([c.x, c.y, c.w, c.h], [2999, 1199, 1, 1]);
  assert.equal(cells.reduce((n, q) => n + q.w * q.h, 0), 13, "13 stored px for a 3000 x 1200 canvas");
});

test("fx parts: an effect's `with` parts start with it (same point, facing, delay, clock) and stop with it", () => {
  const core = validateFx(good({ id: "q_core", with: ["q_smoke"] }), "q_core");
  const smoke = validateFx(good({ id: "q_smoke", loop: true, layer: "back" }), "q_smoke");
  assert.throws(() => validateFx(good({ id: "q_core", with: ["q_core"] }), "q_core"), /with/);
  const c = new FxClock(new Map([["q_core", core], ["q_smoke", smoke]]));
  const h = c.play("q_core", { x: 5, y: 6, facing: -1, delay: 3 });
  assert.equal(c.live.length, 2);
  const [p0, p1] = c.live;
  assert.deepEqual([p1.def.id, p1.x, p1.y, p1.facing, p1.t, p1.layer], ["q_smoke", 5, 6, -1, p0.t, "back"]);
  for (let i = 0; i < 4; i++) { c.tick(); assert.equal(c.live[0].t, c.live[1].t, "one clock"); }
  h.stop();
  c.tick();
  assert.equal(c.live.length, 0, "the looping part stopped with it");
});

test("fx clock: a one-shot shows each drawing for its ticks, then is gone; a delay holds it back", () => {
  const def = validateFx(good(), "spark");
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((t) => fxFrameAt(def, t)), [0, 0, 1, 1, 1, 2, null]);
  const c = new FxClock(new Map([["spark", def]]));
  const h = c.play("spark", { x: 10, y: 20, facing: -1, delay: 2 });
  assert.equal(c.live.length, 1);
  assert.equal(c.live[0].facing, -1);
  assert.equal(c.live[0].t, -2);
  // 2 ticks of delay, then 6 ticks of drawings (t = 0 .. 5)
  for (let i = 0; i < 7; i++) c.tick();
  assert.equal(c.live.length, 1, "on its last drawing");
  assert.equal(fxFrameAt(def, c.live[0].t), 2);
  assert.equal(h.alive, true);
  c.tick();
  assert.equal(c.live.length, 0);
  assert.equal(h.alive, false);
});

test("fx clock: a loop runs until stopped; an unknown id is a dead handle; the oldest one-shot goes past the cap", () => {
  const loop = validateFx(good({ id: "smoke", loop: true }), "smoke");
  const one = validateFx(good(), "spark");
  const c = new FxClock(new Map([["smoke", loop], ["spark", one]]));
  const h = c.play("smoke", { attach: "her" });
  for (let i = 0; i < 100; i++) c.tick();
  assert.equal(c.live.length, 1);
  assert.equal(c.live[0].attach, "her");
  assert.equal(fxFrameAt(loop, 6), 0, "a loop wraps");
  h.stop();
  c.tick();
  assert.equal(c.live.length, 0);
  const dead = c.play("nope");
  assert.equal(dead.alive, false);
  assert.equal(c.live.length, 0);
  c.play("smoke");
  for (let i = 0; i < FX_MAX_LIVE + 5; i++) c.play("spark", { x: i });
  assert.equal(c.live.length, FX_MAX_LIVE);
  assert.ok(c.live.some((e) => e.def.id === "smoke"), "the loop stays; one-shots make room");
});

test("public/assets/fx holds only effects that pass the contract", () => {
  const dir = join(import.meta.dirname, "../../public/assets/fx");
  if (!existsSync(dir)) return;
  for (const id of readdirSync(dir)) {
    const f = join(dir, id, "fx.json");
    if (!existsSync(f)) continue;
    const def = validateFx(JSON.parse(readFileSync(f, "utf8")), id);
    for (const fr of def.frames) assert.ok(existsSync(join(dir, id, fr.file)), `${id}/${fr.file} is missing`);
  }
});

test("ground effects dip into the ground and stop at its line; hits in the air and impact frames are left whole", () => {
  const ids = ["dust_roll_", "ghost_blade_"];
  const floor = () => 500;
  // on the ground: cut at the floor; a hit in the air or an effect not on the list: not cut
  assert.equal(fxGroundClip("dust_roll_s", 10, 500, ids, floor), 500);
  assert.equal(fxGroundClip("ghost_blade_y0_t0", 10, 501.5, ids, floor), 500);
  assert.equal(fxGroundClip("dust_roll_s", 10, 440, ids, floor), null);
  assert.equal(fxGroundClip("q_cut", 10, 500, ids, floor), null);
  assert.equal(fxGroundClip("dust_roll_s", 10, 500, ids, null), null);
  assert.equal(fxGroundClip("dust_roll_s", 10, 500, ids, () => null), null);
  // spawned at her soleY (already dipped 2.64 world px): still on the ground
  assert.equal(fxGroundClip("dust_roll_s", 10, 502.64, ids, floor, 2.64), 500);
  assert.equal(fxGroundClip("dust_roll_s", 10, 502.64, ids, floor), null);
  // rows: a 30-row cell whose top is 26 art px above a pivot drawn 4 art px low (a = 0.5 world px per art px) keeps 22 rows
  assert.equal(fxClipRows(30, -26, 502, 500, 0.5), 22);
  assert.equal(fxClipRows(30, -40, 502, 500, 0.5), 30);
  assert.equal(fxClipRows(30, 0, 502, 500, 0.5), 0);
});
