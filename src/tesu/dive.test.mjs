// Stage 4 of her chain is a dive (Dex 10-21: "it's a dive so it only hits when you're fully grounded"; feel.json m1_4
// dive): m1_4 and the ult form's uf_m1_4 hit only while she stands on something, a dive from the air plunges until it
// touches down (the chop the tick after), the normal chain's 7-tick press-to-hit from the ground is kept, every windup
// drawing shows and none that stands on the floor is drawn in the air, the chop's floor effects stand on the floor at
// the blade's contact (none over a drop, past a wall or on a slope), the landing dust goes behind her, and her landing
// crouch never replays after the move.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";
import { diveClip, diveSlot, hopSpeed } from "./zhusha/timing.ts";
import { lipAt, lipJag, lipStrips } from "./zhusha/lip.ts";
import { drawingIndex, moveToClip, timeline } from "./zhusha/contract.ts";

register("./zhusha/test-raw-hooks.mjs", import.meta.url);

const FEEL = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/feel.json"), "utf8"));
const ROOT = join(import.meta.dirname, "../../public/assets/zhusha");
const H = 96;
const DIVE = FEEL.moves.m1_4.dive;

const liveAnim = (slot) => {
  const p = join(ROOT, slot, "anim.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};
const ROLES = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/slots.json"), "utf8")).roles;
const liveClip = (role, ult) => {
  const id = ROLES[role]?.[ult ? "ult" : "normal"];
  return id ? liveAnim(id) : null;
};

const host = (log = []) => ({
  vfx: { spawn(id, o) { log.push({ kind: "vfx", id, ...o }); } },
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
/** A floor at y = 0 where `floor(x)` says (null: no floor there, a drop), the ground at `at(x)` (a slope). */
const world = ({ floor = () => true, at = () => 0 } = {}) => ({
  move(b, dx, dy) {
    b.x += dx;
    b.y += dy;
    let landed = false;
    const g = floor(b.x) ? at(b.x) : null;
    if (g !== null && b.y >= g) { landed = !b.grounded; b.y = g; b.vy = 0; b.grounded = true; } else b.grounded = false;
    return { landed };
  },
  groundBelow: (x, y) => {
    if (!floor(x)) return null;
    const g = at(x);
    return g >= y ? { y: g } : null;
  },
});
const loadZ = async () => (await import("./zhusha/controller.ts"));

/**
 * Starts stage 4 (the chain's 4th press) in `form` at height `up` H over the floor (0: standing on it), steps `n` ticks
 * and logs every tick: move tick, grounded, height, vy, the hit boxes (and their impact y), the drawing shown.
 */
async function dive({ ult = false, up = 0, w = world(), n = 90, fx = null, log = [], clipOf = liveClip } = {}) {
  const { Zhusha } = await loadZ();
  const z = new Zhusha(host(log), [0, 0]);
  z.clipOf = clipOf;
  if (fx) z.fx = fx;
  if (ult) z.form = 3000;
  const inp = new FakeInput();
  for (let i = 0; i < 5; i++) { inp.tick++; z.update(inp, w); }
  if (up > 0) {
    z.body.y = -up * H;
    z.body.vy = 0;
    z.body.grounded = false;
  }
  z.chainIdx = 2;
  z.chainEnd = inp.tick;
  inp.press("m1");
  const ticks = [];
  const shown = () => {
    const clip = clipOf(z.anim.role, ult);
    if (!clip || z.state !== "move") return null;
    const { starts, total } = timeline(clip.frames);
    return drawingIndex(starts, total, moveToClip(z.anim.t, z.anim.hitAt, z.anim.clipHitAt ?? null), false);
  };
  for (let i = 0; i <= n; i++) {
    inp.tick++;
    z.update(inp, w);
    const hb = z.hitboxes();
    ticks.push({ i, state: z.state, move: z.lastAction, t: z.t, gr: z.body.grounded, x: z.body.x, y: z.body.y, vy: z.body.vy, hits: hb.length, fxY: hb.map((h) => h.hb.fxY), fxX: hb.map((h) => h.hb.fxX), role: z.anim.role, d: shown(), splash: z.diveSplash });
  }
  assert.equal(z.lastAction, "m1_4");
  return { z, ticks };
}

test("dive (Dex 10-21): from the ground the chop comes out 7 ticks after the press (the normal chain's timing), on the floor, in both forms", async () => {
  for (const ult of [false, true]) {
    const tag = ult ? "uf_m1_4" : "m1_4";
    const { ticks } = await dive({ ult });
    const first = ticks.findIndex((k) => k.hits > 0);
    // ticks[0] is the press tick (the move starts there): the hit is live on the 7th tick after it
    assert.equal(first, 7, `${tag}: first hit ${first} ticks after the press`);
    for (const k of ticks) if (k.hits) assert.ok(k.gr && Math.abs(k.y) < 1e-6, `${tag}: a hit box at tick ${k.i} off the floor (y ${k.y})`);
  }
});

test("dive (Dex 10-21): no hit box while she is in the air: the plunge runs until she touches down, the chop the tick after", async () => {
  for (const ult of [false, true]) {
    for (const up of [1.2, 3.4, 6.5, 14]) {
      const tag = `${ult ? "uf_m1_4" : "m1_4"} from ${up} H`;
      const { ticks } = await dive({ ult, up, n: 120 });
      const air = ticks.filter((k) => !k.gr && k.state === "move");
      assert.ok(air.length > 0, `${tag}: she starts in the air`);
      for (const k of air) assert.equal(k.hits, 0, `${tag}: ${k.hits} hit boxes in the air at tick ${k.i}, ${(-k.y / H).toFixed(2)} H up`);
      const down = ticks.findIndex((k) => k.gr);
      const first = ticks.findIndex((k) => k.hits > 0);
      assert.ok(down >= 0 && first === down + 1, `${tag}: touched down at ${down}, first hit at ${first}`);
      // the plunge never slows in the air (it was a fixed 7 ticks: on the hit tick it dropped to the max fall speed)
      const plunge = (FEEL.moves.m1_4.plunge * H) / 60;
      for (const k of air) if (k.i >= DIVE.plungeAt) assert.ok(k.vy >= plunge - 1e-6, `${tag}: vy ${k.vy.toFixed(1)} < the plunge's ${plunge.toFixed(1)} at tick ${k.i}`);
    }
  }
});

test("dive (Dex 10-21): off into the void (no floor) it never hits, and gives up after its hold: she falls on as herself", async () => {
  const w = world({ floor: () => false });
  const { ticks } = await dive({ up: 0.01, w, n: 160 });
  assert.equal(ticks.filter((k) => k.hits > 0).length, 0, "a hit with no floor");
  const end = ticks.findIndex((k) => k.state !== "move");
  assert.ok(end > 0 && end <= DIVE.plungeAt + DIVE.hold + 12, `the move ended at tick ${end}`);
  assert.equal(ticks[end].role, "jump", "she falls as herself");
});

test("dive (Dex 10-21): a live chop stops the moment the floor goes from under her (a hit box only while grounded)", async () => {
  const { z } = await dive({ n: 7 });
  assert.ok(z.hitboxes().length > 0, "live on the floor");
  z.body.grounded = false;
  assert.equal(z.hitboxes().length, 0, "live with no floor under her");
  z.body.grounded = true;
  assert.ok(z.hitboxes().length > 0);
});

test("dive drawings (Dex 10-21: cut off animations, floating feet): every windup drawing shows; the planted ones only on the floor; the form never leaves it", async () => {
  const want = { false: DIVE.slots.m1_4, true: DIVE.slots.uf_m1_4 };
  for (const ult of [false, true]) {
    const tag = ult ? "uf_m1_4" : "m1_4", s = want[ult];
    const { ticks } = await dive({ ult });
    const first = ticks.findIndex((k) => k.hits > 0);
    const wind = ticks.slice(0, first);
    const seen = new Set(wind.map((k) => k.d));
    for (let i = s.ground[0]; i <= s.land; i++) assert.ok(seen.has(i), `${tag}: windup drawing f${String(i).padStart(3, "0")} never shows (${wind.map((k) => k.d).join(",")})`);
    // in order, never back
    for (let i = 1; i < wind.length; i++) assert.ok(wind[i].d >= wind[i - 1].d, `${tag}: the windup goes back (${wind.map((k) => k.d).join(",")})`);
    for (const k of wind) {
      const planted = k.d >= s.ground[0] && k.d <= s.ground[1] && k.d !== s.air;
      if (planted) assert.ok(k.gr || k.i === 0, `${tag}: planted drawing ${k.d} in the air at tick ${k.i} (${(-k.y / H).toFixed(2)} H up)`);
      if (!k.gr) assert.equal(k.d, s.air, `${tag}: in the air at tick ${k.i} it shows ${k.d}, not the air drawing`);
    }
    assert.equal(wind[wind.length - 1].d, s.land, `${tag}: the touchdown drawing`);
    assert.equal(ticks[first].d, s.land + 1, `${tag}: the chop drawing on the hit tick`);
    if (!s.hop) for (const k of ticks) assert.ok(k.gr && k.y === 0, `${tag}: she leaves the floor at tick ${k.i}`);
    else {
      // the hop: planted for hopAt ticks, then up to `hop` H by the plunge
      assert.ok(ticks.slice(0, DIVE.hopAt).every((k) => k.gr), `${tag}: off the floor before hopAt`);
      const top = Math.min(...ticks.slice(0, first).map((k) => k.y));
      assert.ok(Math.abs(-top - FEEL.moves.m1_4.hop * H) < 0.08 * H, `${tag}: the hop's top ${(-top / H).toFixed(2)} H`);
    }
  }
});

test("dive (Dex 10-21): after it her landing crouch never replays (it cut the move's last drawings and its return)", async () => {
  for (const ult of [false, true]) {
    for (const up of [0, 3.4]) {
      const { ticks } = await dive({ ult, up, n: 140 });
      const after = ticks.filter((k) => k.state !== "move" && k.gr);
      assert.ok(after.length > 20);
      for (const k of after) assert.notEqual(k.role, "jump", `${ult ? "uf" : "m1"} from ${up} H: the landing crouch at tick ${k.i}`);
    }
  }
});

test("dive effects (Dex 10-21: effects know where the ground is): the landing dust on the floor behind her; no lab chips, specks or crack lines, on any floor", async () => {
  const run = async (opts) => {
    const played = [], log = [];
    const r = await dive({ ...opts, log, fx: { has: () => true, play: (id, o) => { played.push({ id, ...o }); return { stop() {} }; } } });
    return { played, log, ...r };
  };
  const C = DIVE.slots.m1_4.contact;
  const floors = {
    flat: world(),
    // a drop just ahead (the court's open edge), a wall with the floor far lower past it, a slope
    edge: world({ floor: (x) => x < 40 }),
    wall: world({ at: (x) => (x > 20 ? 650 : 0) }),
    slope: world({ at: (x) => -0.53 * x }),
  };
  for (const ult of [false, true]) {
    const tag = ult ? "uf_m1_4" : "m1_4";
    for (const [name, w] of Object.entries(floors)) {
      const { played, log, ticks } = await run({ ult, w });
      assert.ok(ticks.some((k) => k.hits > 0), `${tag} ${name}: it hit`);
      // the lab's procedural chips, specks and crack lines are gone from the dive; nothing else is put on the floor ahead
      for (const id of ["debris.stone", "dust.land", "cracks"]) assert.equal(log.filter((l) => l.id === id).length, 0, `${tag} ${name}: spawned ${id}`);
      for (const p of played) assert.ok(p.id.startsWith("land_dust"), `${tag} ${name}: played ${p.id}`);
    }
    // the landing dust (off the normal form's hop) under her soles, behind her; the form never left the floor
    const { played } = await run({ ult });
    const land = played.filter((p) => p.id.startsWith("land_dust"));
    if (!ult) assert.ok(land.length === 1 && land[0].id === "land_dust_s" && land[0].layer === "back" && land[0].y > 0, `${tag}: ${JSON.stringify(land)}`);
    else assert.equal(land.length, 0, `${tag}: it never left the floor`);
    // a high dive lands the big dust, still behind her, on the floor
    const high = await run({ ult, up: 3.4 });
    const big = high.played.filter((p) => p.id.startsWith("land_dust"));
    assert.ok(big.length === 1 && big[0].id === "land_dust" && big[0].layer === "back" && big[0].y > 0, `${tag}: ${JSON.stringify(big)}`);
  }
  assert.ok(C > 0);
});

test("dive impacts (Dex 10-21): its impact slash on a foe comes down onto the floor the blade struck, not mid-body", async () => {
  const { ART_PX } = await loadZ();
  for (const ult of [false, true]) {
    for (const [w, floor] of [[world(), 0], [world({ at: (x) => (x > 20 ? 30 : 0) }), 30], [world({ floor: (x) => x < 20 }), 0]]) {
      // the floor under the blade's contact (a step down ahead: that floor; a drop: hers)
      const { ticks } = await dive({ ult, w });
      const k = ticks.find((t) => t.hits > 0);
      for (const y of k.fxY) assert.ok(Math.abs(y - (floor - DIVE.impactDrop * ART_PX)) < 1e-6, `${ult ? "uf" : "m1"}: impact y ${y} over the floor ${floor}`);
    }
  }
});

test("dive timing helpers: the hop's take-off speed reaches its top on time; the drawings by phase", () => {
  // top after n ticks of (speed += g, then move)
  for (const [top, n, g] of [[35, 3, 0.9], [50, 4, 1.2], [10, 1, 0.5]]) {
    let v = -hopSpeed(top, n, g), y = 0;
    for (let i = 0; i < n; i++) { v += g; y += v; }
    assert.ok(Math.abs(-y - top) < 1e-9, `${top} ${n} ${g}: ${-y}`);
  }
  const s = { ground: [0, 2], airFrom: 2, air: 3, land: 4, contact: 54, hop: true };
  const ticks = [2, 2, 3, 4, 2, 6], { starts } = timeline(ticks.map((t) => ({ ticks: t })));
  const at = (st) => drawingIndex(starts, 19, diveClip(s, starts, ticks, st), false);
  assert.deepEqual([0, 1, 2].map((t) => at({ phase: "ground", t, groundTicks: 3, air: 0, fromAir: false })), [0, 1, 2]);
  assert.equal(at({ phase: "air", t: 4, groundTicks: 3, air: 1, fromAir: false }), 3);
  assert.deepEqual([0, 1, 2, 9].map((air) => at({ phase: "air", t: air, groundTicks: 3, air, fromAir: true })), [2, 2, 3, 3]);
  assert.equal(at({ phase: "land", t: 6, groundTicks: 3, air: 3, fromAir: false }), 4);
});

test("dive impacts: along the foe, its impact slash plays where the blade comes down (the contact), not the overlap's middle", async () => {
  const { ART_PX } = await loadZ();
  for (const ult of [false, true]) {
    const c = (ult ? DIVE.slots.uf_m1_4 : DIVE.slots.m1_4).contact;
    const { ticks } = await dive({ ult });
    const k = ticks.find((t) => t.hits > 0);
    for (const x of k.fxX) assert.ok(Math.abs(x - (k.x + c * ART_PX)) < 1e-6, `${ult ? "uf" : "m1"}: impact x ${x}, her x ${k.x}`);
  }
  // court.ts / props.ts keep it inside the overlap
  const src = readFileSync(join(import.meta.dirname, "court.ts"), "utf8") + readFileSync(join(import.meta.dirname, "props.ts"), "utf8");
  assert.equal(src.split("Math.max(ov.x, Math.min(ov.x + ov.w, bx))").length - 1, 2, "fxX clamped into the overlap in court.ts and props.ts");
});

test("dive slots (dive r2): an entry holds for the drawings it was authored for; a redrawn clip is read from its first hit drawing", () => {
  for (const id of ["m1_4", "uf_m1_4"]) {
    const a = liveAnim(id);
    if (!a) continue;
    const s = diveSlot(DIVE, "m1_4", { id, ticks: a.frames.map((f) => f.ticks) }, a.hits?.[0] ?? null);
    assert.equal(s, DIVE.slots[id], `${id}: its own entry (ticks ${a.frames.map((f) => f.ticks).join(",")} vs ${DIVE.slots[id].ticks?.join(",")})`);
    // every drawing it names exists, in order, before the hit drawing
    const n = a.frames.length, hit = a.hits?.[0] ?? n;
    for (const k of [...s.ground, s.airFrom, s.air, s.land]) assert.ok(k >= 0 && k < hit, `${id}: drawing ${k} of ${n} (hit ${hit})`);
    if (s.splash) assert.ok(s.splash.from >= hit && s.splash.to < n && s.splash.keep[0] < 0 && s.splash.keep[1] > 0 && s.splash.band > 0, `${id}: splash ${JSON.stringify(s.splash)}`);
  }
  // a redraw (the ult chain's uf_m1_4: a kneel, the blade raised through the hop, the hit on drawing 2)
  const r = diveSlot(DIVE, "m1_4", { id: "uf_m1_4", ticks: [2, 10, 5, 3, 3, 3, 4, 4, 4, 5, 6] }, 2);
  assert.deepEqual({ ...r, contact: 0 }, { ground: [0, 0], airFrom: 1, air: 1, land: 1, contact: 0, hop: true });
  const r2 = diveSlot(DIVE, "m1_4", { id: "m1_4", ticks: [2, 2, 2, 2, 2, 2, 2, 2] }, 5);
  assert.deepEqual({ ...r2, contact: 0 }, { ground: [0, 3], airFrom: 4, air: 4, land: 4, contact: 0, hop: true });
  // no clip (the white box): the move's own entry
  assert.equal(diveSlot(DIVE, "m1_4", null, null), DIVE.slots.m1_4);
});

test("dive with a redrawn ult finisher (dive r2): still only on the floor, the 7-tick press-to-hit, every windup drawing, no drawing skipped", async () => {
  const ticks = [2, 10, 5, 3, 3, 3, 4, 4, 4, 5, 6];
  const redraw = { id: "uf_m1_4", stage: "pixel", figure_h: 128, pivot: [134, 166], loop: false, hits: [2], frames: ticks.map((t, i) => ({ file: `f${String(i).padStart(3, "0")}.png`, ticks: t })) };
  const clipOf = (role, ult) => (ult && role === "m1_4" ? redraw : liveClip(role, ult));
  for (const up of [0, 3.4]) {
    const { ticks: tk } = await dive({ ult: true, up, clipOf, n: 120 });
    const first = tk.findIndex((k) => k.hits > 0);
    for (const k of tk) if (k.hits) assert.ok(k.gr, `from ${up} H: a hit box in the air at tick ${k.i}`);
    if (up === 0) assert.equal(first, 7, `first hit ${first} ticks after the press`);
    const wind = tk.slice(0, first).map((k) => k.d);
    if (up === 0) assert.deepEqual([...new Set(wind)], [0, 1], `windup drawings ${wind.join(",")}`);
    else assert.ok(wind.every((d) => d === 1), `from the air the dive drawing: ${wind.join(",")}`);
    assert.equal(tk[first].d, 2, "the hit drawing on the hit tick");
  }
});

test("dive splash (dive r2): the chop's floor splash is placed only after touchdown, standing; never in the air", async () => {
  for (const ult of [false, true]) {
    for (const up of [0, 3.4]) {
      const { ticks } = await dive({ ult, up, n: 60 });
      for (const k of ticks) {
        if (k.splash) assert.ok(k.gr && k.state === "move", `${ult ? "uf" : "m1"} from ${up} H: a splash at tick ${k.i} in the air`);
      }
      const hit = ticks.find((k) => k.hits > 0);
      assert.ok(hit.splash, `${ult ? "uf" : "m1"} from ${up} H: no splash on the chop`);
    }
  }
});

test("dive splash at the floor's end (lip.ts): cut from the first probe off her floor, never inside her own extent", () => {
  const keep = [-58, 62], tol = 9, A = 0.65;
  const ends = (end) => (d) => (d < end ? 0 : null);
  // the court's open edge 78 art px ahead; a drop 40 ahead (inside her reach: the cut starts past her blade)
  assert.deepEqual(lipAt(ends(78), -120, 200, keep, tol), { ahead: 78, behind: null });
  assert.deepEqual(lipAt(ends(40), -120, 200, keep, tol), { ahead: 63, behind: null });
  // a wall (the floor past it far lower or higher), a step up or down more than tol: the floor ends there
  assert.deepEqual(lipAt((d) => (d < 90 ? 0 : 650), -120, 200, keep, tol), { ahead: 90, behind: null });
  assert.deepEqual(lipAt((d) => (d < 100 ? 0 : -15), -120, 200, keep, tol), { ahead: 100, behind: null });
  assert.deepEqual(lipAt((d) => (d < 100 ? 0 : 12), -120, 200, keep, tol), { ahead: 100, behind: null });
  // a slope (Dex's court-gate ramp, ~0.53) carries it on both ways: it changes under a px a probe
  assert.deepEqual(lipAt((d) => -0.53 * d * A, -120, 200, keep, tol), { ahead: null, behind: null });
  // the probe looks near the floor found before it (a slope rising into the band is still found)
  const seen = [];
  lipAt((d, near) => { seen.push(near); return -0.53 * d * A; }, -10, 10, keep, tol);
  assert.deepEqual(seen.slice(0, 3).map((v) => (v === null ? null : v + 0)), [null, 0, -0.53 * 2 * A]);
  // behind her (facing away from the edge), and both ways
  assert.deepEqual(lipAt((d) => (d > -90 ? 0 : null), -120, 200, keep, tol), { ahead: null, behind: -90 });
  assert.deepEqual(lipAt((d) => (d > -20 && d < 150 ? 0 : null), -120, 200, keep, tol), { ahead: 150, behind: -59 });
  // a floor all the way: nothing cut; the edge past the drawing: nothing cut; no floor under her: nothing to place
  assert.deepEqual(lipAt(() => 0, -120, 200, keep, tol), { ahead: null, behind: null });
  assert.deepEqual(lipAt(ends(300), -120, 200, keep, tol), { ahead: null, behind: null });
  assert.deepEqual(lipAt(() => null, -120, 200, keep, tol), { ahead: null, behind: null });
  // strips: a 247 x 165 drawing, its top-left 67 / 154 art px from the pivot (m1_4), band 20, cut past +78
  const off = [-67, -154], sw = 247, sh = 165, band = 20;
  const st = lipStrips(sw, sh, off, { ahead: 78, behind: null }, band);
  // the strips cover every column once, in order
  assert.equal(st[0].c0, 0);
  assert.equal(st[st.length - 1].c1, sw);
  for (let i = 1; i < st.length; i++) assert.equal(st[i].c0, st[i - 1].c1);
  for (const s of st) {
    for (let c = s.c0; c < s.c1; c++) {
      const x = off[0] + c;
      if (x < 78) assert.equal(s.rows, sh, `column ${x}: cut before the lip`);
      // nothing of the band: its last row ends `band` art px over her ground row, a ragged 0-3 more
      else assert.equal(off[1] + s.rows, -band - lipJag(x), `column ${x}: rows ${s.rows}`);
    }
  }
  // the ragged edge is not a ruled line: it varies along the cut
  const rows = new Set(st.filter((s) => off[0] + s.c0 >= 78).map((s) => s.rows));
  assert.ok(rows.size >= 3, `cut rows ${[...rows]}`);
  // a drawing whose rect ends above the band loses nothing
  assert.deepEqual(lipStrips(10, 30, [100, -120], { ahead: 0, behind: null }, band), [{ c0: 0, c1: 10, rows: 30 }]);
});
