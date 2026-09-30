// Real PixelRoom/Room build and PixelWorld/FlashGate/emitter source on the CPU.
// Vite discovery, backdrop GL allocation and renderer disposal are declared
// fixtures. This does not qualify native pixels, emission rates or devices.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";

const recipes = new Map();
globalThis.__sharedFlashRecipes = recipes;
registerHooks({ load(url, context, next) {
  const u = new URL(url);
  if (u.search === "?raw") return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(readFileSync(u, "utf8"))}` };
  if (u.pathname.endsWith("/pixel/registry.ts")) return { format: "module", shortCircuit: true, source: "export const findRecipe = name => globalThis.__sharedFlashRecipes.get(name);" };
  if (u.pathname.endsWith("/world/backdrop/engine.ts")) return { format: "module", shortCircuit: true, source: "export class Backdrop { constructor(...args) { this.gate = args[4]; } dispose() {} }" };
  if (u.protocol === "file:" && u.pathname.endsWith(".ts")) return {
    format: "module", shortCircuit: true,
    source: stripTypeScriptTypes(readFileSync(u, "utf8"), { mode: "transform", sourceUrl: url }),
  };
  return next(url, context);
} });
const { PixelRoom } = await import("../pixel/adapter.ts");
const { Room } = await import("../room/room.ts");
const { PixelWorld } = await import("../../pixel/world.ts");
const { defineRecipe } = await import("../../pixel/prop.ts");
const { sign } = await import("../../pixel/props/sign.ts");
const { FlashGate, FlashAccents } = await import("../../scenes/engine/flashes.ts");
const { Weather } = await import("../weather.ts");

function host(now = 185.2, reduced = false) {
  const h = { now, reduced, gateOwner: new FlashGate(), calls: [], caller: "host" };
  h.gate = () => {
    const allowed = h.gateOwner.allow(h.now, h.reduced);
    h.calls.push({ now: h.now, reduced: h.reduced, caller: h.caller, allowed });
    return allowed;
  };
  h.state = { gate: h.gate, reduced: () => h.reduced };
  return h;
}
function pixelRoom(h) {
  return new PixelRoom(1280, 720, 80, {}, () => false, h?.state);
}
function light(w, options) { return w.flashLight(100, 100, [1, 0.5, 0.2], 60, 1, 0.18, options); }
function glow(w, options) {
  return w.flashGlow({ kind: "disc", x: 100, y: 100, colour: [1, 0.5, 0.2], radius: 40, intensity: 1, flat: 1, x1: 0, y1: 0, width1: 0, thick: 0 }, 0.3, options);
}
function backdrop(h) {
  h.caller = "backdrop";
  const accents = new FlashAccents([{ kind: "glint", rate: 60, at: () => [0, 0], size: 3, row: 0 }]);
  accents.update(1 / 60, { ctx: { rng: () => 0 }, reduced: h.reduced, flashGate: h.gate });
  return h.calls.at(-1).allowed;
}
function weather(h) {
  h.caller = "weather";
  const w = new Weather(h.gate), prog = { state: "storm", time: "day" };
  w.snap(prog, 0);
  const original = Math.random;
  try { Math.random = () => 0; w.update(1 / 60, prog, 0, 1280, 0, h.reduced); }
  finally { Math.random = original; }
  return { allowed: h.calls.at(-1).allowed, strikes: w.strikes.length };
}
function neon(r) {
  const p = r.add(sign, "neon", 100, 100, { kind: "neon", lines: ["ARCHIVE"], scale: 1 }, false);
  p.refs.nextFlicker = 0;
  return p;
}
const quiet = defineRecipe({ id: "flash-cpu-quiet", reason: "Declared CPU control", breakage: "never", defaults: {}, build: () => ({}), initial: "idle", states: { idle: {} } });
const onEntry = defineRecipe({ ...quiet, id: "flash-cpu-entry", states: { idle: { enter(c) { c.refs.started = light(c.world); c.refs.reduced = c.world.reduced; } } } });
recipes.set(quiet.id, quiet); recipes.set(onEntry.id, onEntry);
function builtRoom(h, recipe = quiet) {
  const def = { id: "cpu", w: 1280, h: 720, backdrop: { scene: {}, vertical: 0 }, terrain: [], exits: [], props: [{ engine: "pixel", recipe: recipe.id, id: "control", x: 100, y: 100 }] };
  const deps = { r: { gl: { deleteTexture() {} }, emptyVao: null }, ...h.state, engine: { has: () => false }, flag: () => false, pixelDraw: () => ({ release() {} }), pixelSave: () => ({}) };
  const r = new Room(def, deps); r.build(); return r;
}

test("historical C1 mixed starts deny the fourth request", () => {
  const h = host(), r = pixelRoom(h); h.caller = "pixel";
  assert.equal(light(r.world), true);
  h.now = 185.283333333; assert.equal(glow(r.world), true);
  h.now = 185.633333333; assert.equal(r.world.flashGate.allow(r.world.time, false), true);
  h.now = 186.083333333; assert.equal(backdrop(h), false);
  assert.equal(h.calls.filter(c => c.allowed).length, 3);
});
test("pixel, actual weather and backdrop emitters share one same-tick budget", () => {
  const h = host(300), r = pixelRoom(h); h.caller = "pixel";
  assert.equal(light(r.world), true);
  assert.deepEqual(weather(h), { allowed: true, strikes: 1 });
  assert.equal(backdrop(h), true);
  h.caller = "pixel"; assert.equal(glow(r.world), false);
  assert.equal(h.calls.length, 4); assert.equal(h.calls.filter(c => c.allowed).length, 3);
  assert.deepEqual(h.calls.map(c => c.caller), ["pixel", "weather", "backdrop", "pixel"]);
});
test("two rooms with divergent clocks retain the same rolling history", () => {
  const h = host(200), a = pixelRoom(h), b = pixelRoom(h);
  a.world.time = 60; b.world.time = 0;
  assert.equal(light(a.world), true); assert.equal(glow(a.world), true); assert.equal(backdrop(h), true);
  h.now = 200.5; assert.equal(light(b.world), false);
  assert.equal(b.world.flashGate.allow(-1000, true), false, "room arguments cannot replace host clock/mode");
  h.now = 201; assert.equal(light(b.world), true);
  assert.ok(h.calls.every(c => c.now >= 200 && !c.reduced));
});
test("reduced host budget denies every other emitter before two seconds", () => {
  const h = host(200, true), a = pixelRoom(h), b = pixelRoom(h);
  assert.equal(light(a.world), true);
  h.now = 201.999; assert.equal(glow(b.world), false); assert.equal(backdrop(h), false);
  assert.deepEqual(weather(h), { allowed: false, strikes: 0 });
  h.now = 202; assert.equal(glow(b.world), true);
  assert.equal(h.calls.filter(c => c.allowed).length, 2);
});
test("constructor propagates reduced attenuation before the first step", () => {
  const h = host(200, true), r = pixelRoom(h);
  assert.equal(r.world.reduced, true); assert.equal(light(r.world), true);
  const L = r.world.lights()[0]; assert.equal(L.intensity, 0.6);
  r.world.step(0.2); assert.equal(r.world.lights().length, 1, "reduced light lasts at least .25s");
});
test("live reduced toggles reach actual neon recipe before each step", () => {
  const h = host(), r = pixelRoom(h), p = neon(r);
  h.reduced = true; r.step(0, 0, [], 1);
  assert.equal(r.world.reduced, true); assert.equal(p.state, "lit"); assert.equal(h.calls.length, 0);
  h.reduced = false; p.refs.nextFlicker = 0; r.step(0, 0, [], 2);
  assert.equal(r.world.reduced, false); assert.equal(p.state, "flicker"); assert.equal(h.calls.length, 1);
});
test("direct neon recipe gate cannot bypass exhausted host budget", () => {
  const h = host(), r = pixelRoom(h), p = neon(r);
  for (let i = 0; i < 3; i++) assert.equal(h.gate(), true);
  r.step(0, 0, [], 1); assert.equal(p.state, "lit"); assert.equal(h.calls.at(-1).allowed, false);
});
test("paused or slow room time does not stall the host flash clock", () => {
  const h = host(500), r = pixelRoom(h);
  for (let i = 0; i < 3; i++) assert.equal(light(r.world), true);
  r.world.paused = true; r.world.timeScale = 0.1; r.world.update(1 / 60);
  assert.equal(r.world.time, 0); h.now = 501; assert.equal(light(r.world), true);
});
test("Room.build binds host policy before an entry-state flash", () => {
  const h = host(50, true), r = builtRoom(h, onEntry);
  assert.equal(r.pixel.props[0].refs.reduced, true); assert.equal(r.pixel.props[0].refs.started, true);
  assert.equal(r.pixel.world.lights()[0].intensity, 0.6);
  assert.equal(r.backdrop.gate(), false, "backdrop sees the consumed pixel entry allowance");
});
test("Room disposal and rebuild cannot reset host history", () => {
  const h = host(50), r = builtRoom(h);
  for (let i = 0; i < 3; i++) assert.equal(light(r.pixel.world), true);
  const previous = r.pixel.world; r.dispose(); r.build();
  assert.notEqual(r.pixel.world, previous); assert.equal(r.pixel.world.time, 0);
  h.now = 50.5; assert.equal(glow(r.pixel.world), false);
});
test("flash denial returns and counters are preserved", () => {
  const h = host(50, true), r = pixelRoom(h);
  assert.equal(light(r.world), true); assert.equal(light(r.world), false); assert.equal(glow(r.world), false);
  assert.equal(r.world.stats.flashDenied, 2); assert.equal(r.world.lights().length, 1);
  assert.equal(h.calls.length, 3, "one authoritative request per delegated call");
});
test("existing forced slow-light path still skips admission", () => {
  const h = host(50, true), r = pixelRoom(h);
  assert.equal(light(r.world, { force: true }), true); assert.equal(glow(r.world, { force: true }), true);
  assert.equal(h.calls.length, 0); assert.equal(r.world.lights()[0].intensity, 0.6);
  assert.equal(light(r.world), true);
});
test("standalone PixelWorld retains local writable defaults and reduced policy", () => {
  const a = new PixelWorld(), b = new PixelWorld();
  for (let i = 0; i < 3; i++) assert.equal(light(a), true);
  assert.equal(light(a), false); assert.equal(light(b), true);
  a.time = 1; assert.equal(light(a), true);
  const c = new PixelWorld(); c.reduced = true; assert.equal(light(c), true); assert.equal(glow(c), false);
  c.time = 2; assert.equal(glow(c), true);
  let calls = 0; c.flashGate = { allow() { calls++; return false; } };
  assert.equal(light(c), false); assert.equal(calls, 1);
});
test("hostless PixelRoom retains the standalone gate and writable reduced mode", () => {
  const a = pixelRoom(), b = pixelRoom();
  for (let i = 0; i < 3; i++) assert.equal(light(a.world), true);
  assert.equal(light(a.world), false); assert.equal(light(b.world), true);
  const p = neon(b); b.world.reduced = true; b.step(0, 0, [], 1);
  assert.equal(b.world.reduced, true); assert.equal(p.state, "lit");
});
