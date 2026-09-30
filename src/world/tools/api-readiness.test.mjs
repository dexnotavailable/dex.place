import { test } from "node:test";
import assert from "node:assert/strict";
import { waitForWarmNeighbour, probeRebuildBoundary, assessRebuildBoundary } from "./api-readiness.mjs";

// Declared adapter controls only: these do not measure actual frame warming,
// browser execution, room disposal or native/API acceptance.
function fixture({ settled = true, timeout = false, warmOther = false, neighbours = ["A0", "A2"] } = {}) {
  const calls = [], rooms = new Map(["A1", "A0", "A2"].map((id) => [id, { built: id === "A1" }]));
  const g = { room: { def: { id: "A1", neighbours }, backdrop: { ready: () => true } }, roomIds: () => ["A1", "A0", "A2"], trans: null, loading: false,
    stream: { rooms, status: () => [...rooms].filter(([, r]) => r.built).map(([id]) => `${id}*`).join(" "), get: () => { throw new Error("must not create/build a room"); }, warmOne: () => { throw new Error("must not force warming"); } },
    api: { rebuild(id) { calls.push(id); if (id === "A1" || !rooms.get(id)?.built) return false; rooms.get(id).built = false; return true; } } };
  let waits = 0, yielded = false;
  const p = { ev: async (fn, arg) => fn(arg), page: { async waitForFunction(fn, arg, options) {
    waits++; assert.deepEqual(options, { timeout: 30000, polling: 100 });
    assert.equal(fn(arg), false, "cold target cannot be ready before the yield");
    await new Promise((resolve) => setImmediate(resolve)); yielded = true;
    if (!timeout) rooms.get(warmOther ? "A2" : arg.target).built = true;
    if (timeout || !fn(arg)) { const e = new Error("declared timeout control"); e.name = "TimeoutError"; throw e; }
  } } };
  return { g, p, calls, rooms, settled, get waits() { return waits; }, get yielded() { return yielded; } };
}
async function run(f, callback) {
  const old = globalThis.window; globalThis.window = { __world: { game: f.g } };
  try {
    const warmReadiness = await waitForWarmNeighbour(f.p, "A1", f.settled);
    if (callback) callback(f, warmReadiness);
    const boundary = await f.p.ev(probeRebuildBoundary, { roomId: "A1", target: warmReadiness.target, ready: warmReadiness.passed });
    return { ...boundary, warmReadiness };
  } finally { if (old === undefined) delete globalThis.window; else globalThis.window = old; }
}
test("yield to the specific target and capture release atomically", async () => {
  const f = fixture(), r = await run(f);
  assert.equal(f.yielded, true); assert.equal(f.waits, 1);
  assert.equal(r.warmReadiness.before.built.length, 0); assert.equal(r.warmReadiness.after.built.includes("A0"), true);
  assert.equal(r.builtBefore, true); assert.deepEqual(r.rebuildNeighbour, ["A0", true, false]);
  assert.deepEqual(f.calls, ["A1", "A0", "nowhere"]); assert.equal(assessRebuildBoundary(r).passed, true);
});
test("failed settle records failure without a wait or positive call", async () => {
  const f = fixture({ settled: false }), r = await run(f);
  assert.equal(f.waits, 0); assert.equal(r.positiveExercised, false); assert.deepEqual(f.calls, ["A1", "nowhere"]);
  assert.equal(assessRebuildBoundary(r).passed, false);
});
test("no valid declared target never calls undefined", async () => {
  const f = fixture({ neighbours: ["A1", "", "unknown"] }), r = await run(f);
  assert.equal(r.warmReadiness.target, null); assert.equal(f.waits, 0); assert.equal(r.positiveExercised, false);
  assert.deepEqual(f.calls, ["A1", "nowhere"]); assert.equal(assessRebuildBoundary(r).passed, false);
});
test("warm timeout retains diagnostics and fails unexercised", async () => {
  const f = fixture({ timeout: true }), r = await run(f);
  assert.equal(r.warmReadiness.timedOut, true); assert.equal(r.warmReadiness.after.warm, "A1*");
  assert.equal(r.positiveExercised, false); assert.deepEqual(f.calls, ["A1", "nowhere"]); assert.equal(assessRebuildBoundary(r).passed, false);
});
test("warming a different neighbour cannot satisfy selected target", async () => {
  const f = fixture({ warmOther: true }), r = await run(f);
  assert.equal(r.warmReadiness.after.built.includes("A2"), true); assert.equal(r.warmReadiness.passed, false);
  assert.equal(r.positiveExercised, false); assert.equal(assessRebuildBoundary(r).passed, false);
});
test("target lost between readiness and probe fails without positive call", async () => {
  const f = fixture(), r = await run(f, (f) => { f.rooms.get("A0").built = false; });
  assert.equal(r.warmReadiness.passed, true); assert.equal(r.builtBefore, false); assert.equal(r.positiveExercised, false);
  assert.deepEqual(f.calls, ["A1", "nowhere"]); assert.equal(assessRebuildBoundary(r).passed, false);
});
const invalid = [
  ["current room accepted", (r) => { r.rebuildCurrent = true; }],
  ["unknown room accepted", (r) => { r.rebuildUnknown = true; }],
  ["valid positive refused", (r) => { r.rebuildNeighbour[1] = false; }],
  ["room not actually released", (r) => { r.rebuildNeighbour[2] = true; }],
  ["wrong selected target", (r) => { r.rebuildNeighbour[0] = "A2"; }],
  ["missing positive observation", (r) => { r.positiveExercised = false; }],
  ["missing readiness", (r) => { delete r.warmReadiness; }],
  ["undeclared target", (r) => { r.targetDeclared = false; }],
  ["unbuilt target", (r) => { r.builtBefore = false; }],
];
for (const [name, mutate] of invalid) test(`reject ${name}`, async () => { const r = await run(fixture()); mutate(r); assert.equal(assessRebuildBoundary(r).passed, false); });
