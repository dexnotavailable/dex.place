// Cut-off animations (cutoffs 10-21, Dex: "I'm still seeing some cut off parts of animations ... it's mostly trails"):
// a slash trail carries on as its own effect when the next move cuts her drawing short; a landing during a move ages
// (the move's end and return play, not the landing crouch); hurt and knockdown play their recovery out.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";

register("./zhusha/test-raw-hooks.mjs", import.meta.url);

const FEEL = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/feel.json"), "utf8"));

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
const flat = { move(b, dx, dy) { b.x += dx; b.y += dy; let landed = false; if (b.y >= 0) { landed = !b.grounded; b.y = 0; b.vy = 0; b.grounded = true; } else b.grounded = false; return { landed }; }, groundBelow: () => ({ y: 0 }) };
const loadZ = async () => (await import("./zhusha/controller.ts")).Zhusha;
const step = (z, inp, n = 1) => { for (let i = 0; i < n; i++) { inp.tick++; z.update(inp, flat); } };

test("cutoffs: a landing inside a move ages with it, so the move's end plays instead of the landing crouch (m1_4's hop)", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  const inp = new FakeInput();
  step(z, inp, 30);
  z.startMove("m1_4", inp);
  assert.equal(z.body.grounded, false, "m1_4 hops");
  let landedAt = -1;
  const roles = [];
  for (let i = 0; i < 120; i++) {
    const was = z.body.grounded;
    step(z, inp);
    if (!was && z.body.grounded && landedAt < 0) landedAt = i;
    roles.push(z.anim.role);
  }
  assert.ok(landedAt > 0 && landedAt < FEEL.moves.m1_4.ticks - 12, `she lands inside the move (tick ${landedAt})`);
  assert.ok(!roles.includes("jump"), `no landing crouch once the move is over: ${[...new Set(roles)].join(", ")}`);
});

test("cutoffs: hurt plays its recovery out after the stun (it was cut to idle at the stun's end)", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  const total = 52;
  z.hasRole = () => true;
  z.clipDone = (a) => a.t >= total - 1;
  const inp = new FakeInput();
  step(z, inp, 5);
  z.hit(5, 1);
  assert.equal(z.state, "hurt");
  step(z, inp, FEEL.hurt.stun + 2);
  assert.equal(z.state, "free");
  assert.equal(z.anim.role, "hurt", "the hurt drawing plays on into its recovery");
  step(z, inp, total);
  assert.equal(z.anim.role, "idle", "then she rests");
});

test("cutoffs: a slash trail carries on as its own effect from where the next move cut her drawing; never while her drawing plays", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  const calls = [];
  z.fx = { has: (id) => id === "m1_1_trail", play: () => ({ stop() {} }), playFrom: (id, o, from) => { calls.push({ id, ...o, from }); } };
  z.clipAt = (a) => (a.role === "m1_1" || a.role === "m1_2" ? { slot: a.role, t: a.t, total: 40 } : null);
  z.clipDone = (a) => a.t >= 39;
  const inp = new FakeInput();
  step(z, inp, 30);
  // m1_1 alone: it plays out (the same drawing goes on into its wind-down): no effect
  inp.press("m1");
  step(z, inp, 80);
  assert.equal(calls.length, 0, "a drawing that plays out carries its own trail");
  // mashed: m1_2 takes over on m1_1's chain tick; m1_1's trail goes on from the next clip tick, where it was drawn
  step(z, inp, 60);
  inp.press("m1");
  step(z, inp, FEEL.moves.m1_1.chainFrom - 2);
  const at = { x: z.body.x, t: z.anim.t };
  inp.press("m1");
  step(z, inp, 3);
  assert.equal(z.anim.role, "m1_2");
  assert.equal(calls.length, 1, `one trail: ${JSON.stringify(calls)}`);
  const c = calls[0];
  assert.equal(c.id, "m1_1_trail");
  assert.ok(c.from >= at.t && c.from <= at.t + 3, `from the clip tick it was cut at (${c.from} vs ${at.t})`);
  assert.equal(c.facing, 1);
  assert.ok(Math.abs(c.y - z.soleY) < 1e-6, "at her soles, as her drawing");
});

test("cutoffs: an effect played from a tick shows that tick's drawing at once", async () => {
  const { FxClock, fxFrameAt, validateFx } = await import("./fx/contract.ts");
  const def = validateFx({ id: "t_trail", stage: "pixel", px: 1, pivot: [0, 0], frames: [{ file: "f000.png", ticks: 2 }, { file: "f001.png", ticks: 2 }, { file: "f002.png", ticks: 2 }] }, "t_trail");
  const clock = new FxClock(new Map([["t_trail", def]]));
  clock.playFrom("t_trail", { x: 5, y: 7 }, 3);
  const e = clock.live[0];
  assert.equal(e.t, 3);
  assert.equal(fxFrameAt(def, e.t), 1);
  clock.tick(); clock.tick(); clock.tick();
  assert.equal(clock.live.length, 0, "and ends where the drawing would have");
});
