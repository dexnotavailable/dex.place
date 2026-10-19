// World effects as pixel sprite animations (lane C 10-19; lanes/engine/EFFECTS-CONTRACT.md): fx.json's rules, the
// player's clock, and every shipped effect checked against the contract.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkFxDrawing, FX_MAX_LIVE, FxClock, fxFrameAt, validateFx } from "./fx/contract.ts";

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
  assert.match(checkFxDrawing(new Uint8Array(0), 4096, 10, "f001.png")[0], /over 2048 x 1024/);
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
