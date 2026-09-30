// The position rule (save.ts): a load under 3 minutes after the last activity
// resumes at the exact place; at or over 3 minutes, or with no record, it
// starts at the spawn. Progress (flags, props, rest, sound) is never reset.
// Fake clock and a Map-backed localStorage; no DOM.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
};
const { Save, RESUME_MS, startPlace, isRecent } = await import("./save.ts");

const KEY = "dex.world.v1";
const T0 = 1_790_000_000_000; // a fixed wall clock (ms)
const SPAWN = { room: "A1", spawn: "start" };
const ROOMS = new Set(["A1", "B2", "C1"]);
const at = (o = {}) => ({ start: SPAWN, has: (id) => ROOMS.has(id), spotOk: () => true, ...o });
const PLACE = { room: "B2", x: 812.5, y: 604, facing: -1 };
const progress = { v: 1, flags: { "shrine:1": true, "cut:map-banner": true }, rest: { room: "C1", spawn: "shrine" }, sound: false, props: { "map-banner": { cut: true } } };

beforeEach(() => store.clear());

test("RESUME_MS is 3 minutes", () => {
  assert.equal(RESUME_MS, 180000);
});

test("under 3 minutes resumes at the exact saved place", () => {
  for (const age of [0, 1, 60_000, RESUME_MS - 1]) {
    const s = startPlace({ ...progress, place: PLACE, lastSeen: T0 }, T0 + age, at());
    assert.equal(s.why, "place", `age ${age}`);
    assert.deepEqual(s.at, PLACE);
    assert.equal(s.room, "B2");
  }
});

test("at or over 3 minutes starts at the spawn (not the rest place)", () => {
  for (const age of [RESUME_MS, RESUME_MS + 1, 4 * 60_000, 86_400_000]) {
    const s = startPlace({ ...progress, place: PLACE, lastSeen: T0 }, T0 + age, at());
    assert.deepEqual(s, { room: "A1", spawn: "start", why: "spawn" }, `age ${age}`);
  }
});

test("an old save without lastSeen (or place) starts at the spawn", () => {
  assert.deepEqual(startPlace(progress, T0, at()), { room: "A1", spawn: "start", why: "spawn" });
  assert.deepEqual(startPlace({ ...progress, place: PLACE }, T0, at()), { room: "A1", spawn: "start", why: "spawn" });
  assert.equal(isRecent(null, T0), false);
  assert.equal(isRecent("123", T0), false);
  assert.equal(isRecent(Number.NaN, T0), false);
});

test("a future lastSeen (clock moved back) is not recent", () => {
  assert.equal(isRecent(T0 + 1, T0), false);
  assert.equal(startPlace({ ...progress, place: PLACE, lastSeen: T0 + 5000 }, T0, at()).why, "spawn");
});

test("recent but the room is gone: falls back to the rest place, else the spawn", () => {
  const gone = { ...PLACE, room: "arrival" }; // a phase 1 test room, not in the public graph
  assert.deepEqual(startPlace({ ...progress, place: gone, lastSeen: T0 }, T0 + 1000, at()), { room: "C1", spawn: "shrine", why: "rest" });
  assert.deepEqual(startPlace({ ...progress, rest: { room: "plain", spawn: "shrine" }, place: gone, lastSeen: T0 }, T0 + 1000, at()), { room: "A1", spawn: "start", why: "spawn" });
  assert.deepEqual(startPlace({ ...progress, rest: null, place: gone, lastSeen: T0 }, T0 + 1000, at()), { room: "A1", spawn: "start", why: "spawn" });
});

test("recent but the spot is not standable or malformed: falls back to the rest place", () => {
  let asked = null;
  const s = startPlace({ ...progress, place: PLACE, lastSeen: T0 }, T0 + 1000, at({ spotOk: (p) => ((asked = p), false) }));
  assert.deepEqual(asked, PLACE);
  assert.equal(s.why, "rest");
  for (const bad of [{ ...PLACE, x: Number.NaN }, { ...PLACE, y: "604" }, { ...PLACE, facing: 0 }, { ...PLACE, room: "" }, null, "B2"]) {
    assert.equal(startPlace({ ...progress, place: bad, lastSeen: T0 }, T0 + 1000, at()).why, "rest", JSON.stringify(bad));
  }
});

test("setPlace stores place and lastSeen under the same key; progress is untouched", () => {
  store.set(KEY, JSON.stringify(progress));
  const save = new Save();
  save.setPlace(PLACE, T0);
  const d = JSON.parse(store.get(KEY));
  assert.deepEqual(d.place, PLACE);
  assert.equal(d.lastSeen, T0);
  assert.deepEqual(d.flags, progress.flags);
  assert.deepEqual(d.rest, progress.rest);
  assert.equal(d.sound, false);
  assert.deepEqual(d.props, progress.props);
  // the next load resumes within the window and spawns after it; flags stay either way
  const again = new Save();
  assert.equal(startPlace(again.data, T0 + 2 * 60_000, at()).why, "place");
  const later = new Save();
  assert.equal(startPlace(later.data, T0 + 4 * 60_000, at()).why, "spawn");
  assert.equal(later.get("shrine:1"), true);
  assert.deepEqual(later.data.rest, progress.rest);
});

test("setPlace merges into what is stored: another tab's newer flags survive", () => {
  const save = new Save(); // this tab loaded an empty save
  store.set(KEY, JSON.stringify({ ...progress, flags: { ...progress.flags, "shrine:2": true } })); // the other tab progressed
  save.setPlace(PLACE, T0);
  const d = JSON.parse(store.get(KEY));
  assert.equal(d.flags["shrine:2"], true);
  assert.deepEqual(d.place, PLACE);
});

test("an old save loads unchanged (backward compatible) and ?fresh clears the place", () => {
  store.set(KEY, JSON.stringify(progress));
  const save = new Save();
  assert.deepEqual(save.data.flags, progress.flags);
  assert.deepEqual(save.data.rest, progress.rest);
  assert.equal(save.data.place ?? null, null);
  assert.equal(save.data.lastSeen ?? null, null);
  save.setPlace(PLACE, T0);
  save.clear();
  const d = JSON.parse(store.get(KEY));
  assert.equal(d.place, null);
  assert.equal(d.lastSeen, null);
  assert.equal(d.sound, false);
});

test("blocked storage: setPlace keeps the visit's record in memory", () => {
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  try {
    const save = new Save();
    save.setPlace(PLACE, T0);
    assert.deepEqual(save.data.place, PLACE);
    assert.equal(save.data.lastSeen, T0);
  } finally {
    globalThis.localStorage = saved;
  }
});
