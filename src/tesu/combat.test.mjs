// Zhusha's combat (lane E, 10-19; PLAN-10-19.md, Dex's attack notes): what her attack drawings say (derived.json: live
// drawings, hit boxes that move with the slash, her planted foot), the chain's movement (m1_1 and m1_2 forward, m1_3
// recoils back, m1_4 in place), the slower wind-down, the Q (BOOM in a few ticks, a hold, the camera pulled out over
// the exploded area), the E (a beam far in front, the recoil on the tap), heavier damage reactions, and how far each hit
// destroys (props.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";
import { DERIVE, deriveSlot, isEnergy } from "./zhusha/derive.ts";
import { resolveMove, windClock } from "./zhusha/timing.ts";
import { derivedFor, derivedText } from "../../tools/zhusha/derive-lib.mjs";

register("./zhusha/test-raw-hooks.mjs", import.meta.url);

const FEEL = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/feel.json"), "utf8"));
const REPO = join(import.meta.dirname, "../..");
const ROOT = join(REPO, "public/assets/zhusha");
const H = 96;

const liveAnim = (slot) => {
  const p = join(ROOT, slot, "anim.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};
const ROLES = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/slots.json"), "utf8")).roles;
/** The game's clipOf with the live drawings: the anim.json of the slot a role plays. */
const liveClip = (role, ult) => {
  const id = ROLES[role]?.[ult ? "ult" : "normal"];
  return id ? liveAnim(id) : null;
};

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

// --- what the drawings say -------------------------------------------------------------

test("combat derive: derived.json is exactly what the slotted drawings say (re-run tools/zhusha/derive.mjs after a slot-in)", () => {
  const text = readFileSync(join(import.meta.dirname, "zhusha/derived.json"), "utf8");
  assert.equal(text, derivedText(derivedFor(REPO)), "derived.json is stale: node tools/zhusha/derive.mjs");
});

test("combat derive: the blade and its effects are told from her body by colour", () => {
  for (const c of [[95, 220, 230], [40, 90, 200], [120, 200, 255], [235, 245, 255], [30, 140, 160]]) assert.ok(isEnergy(...c), `energy ${c}`);
  for (const c of [[222, 190, 176], [180, 30, 40], [20, 20, 28], [230, 190, 90], [60, 55, 60], [30, 40, 60], [255, 255, 240]]) assert.ok(!isEnergy(...c), `body ${c}`);
});

/** A synthetic drawing w x h: a dark body block, red feet in the 4 rows above row h - 10, cyan energy rects. */
function drawing(w, h, { feet = [], energy = [] } = {}) {
  const data = new Uint8Array(w * h * 4);
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.set([...c, 255], (y * w + x) * 4); };
  for (const [x0, x1] of feet) fill(x0, h - 14, x1, h - 10, [180, 30, 40]);
  for (const r of energy) fill(...r, [95, 220, 230]);
  return { w, h, data };
}

test("combat derive: an active drawing is new energy in front of her; its boxes hug it; her planted foot gives the move", () => {
  // canvas 140 x 90, pivot [50, 80]: the ground row 80, feet in rows 76-79
  const W = 140, Hh = 90, def = { frames: [0, 1, 2, 3].map((i) => ({ file: `f00${i}.png`, ticks: 3 })), pivot: [50, 80], hits: [1] };
  const imgs = [
    drawing(W, Hh, { feet: [[38, 44], [56, 62]] }),
    // the feet 4 px further back in the frame: she moved 4 px forward; a 40 x 40 slash in front
    drawing(W, Hh, { feet: [[34, 40], [52, 58]], energy: [[70, 20, 110, 60]] }),
    // the same slash held: nothing new, not active
    drawing(W, Hh, { feet: [[34, 40], [52, 58]], energy: [[70, 20, 110, 60]] }),
    // energy only behind her: never a hit
    drawing(W, Hh, { feet: [[34, 40], [52, 58]], energy: [[0, 20, 40, 60]] }),
  ];
  const d = deriveSlot("t", def, imgs);
  assert.deepEqual(d.frames.map((f) => f.active), [false, true, false, false]);
  assert.equal(d.frames[1].area, 1600);
  assert.equal(d.frames[3].area, 0, "behind the pivot column is not in front of her");
  assert.deepEqual(d.frames.map((f) => f.root), [0, 4, 0, 0]);
  // the boxes cover the slash (20..60 art px ahead, 20..60 px above the ground row) and stay near it
  const rs = d.frames[1].rects;
  let area = 0;
  for (const [x0, y0, x1, y1] of rs) {
    assert.ok(x0 >= 16 && x1 <= 64 && y0 >= -64 && y1 <= -16, JSON.stringify(rs));
    area += (x1 - x0) * (y1 - y0);
  }
  assert.ok(area >= 1600 && area <= 2600, `boxes ${area} px over a 1600 px slash`);
  assert.deepEqual(d.hits, [{ first: 1, last: 1, at: 3, len: 3 }]);
  assert.ok(DERIVE.areaMin <= 1600);
});

test("combat derive: on the live attacks every hit has boxes in front of her, one hit per marked BOOM, and m1_1's boxes move", () => {
  const D = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/derived.json"), "utf8")).slots;
  assert.ok(Object.keys(D).length >= 1);
  for (const [slot, s] of Object.entries(D)) {
    const def = liveAnim(slot);
    assert.ok(def, `${slot} is slotted`);
    assert.equal(s.hits.length, Math.max(1, (def.hits ?? []).length), slot);
    for (const h of s.hits) {
      const boxes = [];
      for (let i = h.first; i <= h.last; i++) boxes.push(...s.frames[i].rects);
      assert.ok(boxes.length, `${slot}: the hit at f${h.first} has boxes`);
      for (const [x0, , x1] of boxes) assert.ok(x0 >= 0 && x1 > x0, `${slot}: a box behind her`);
    }
  }
  if (D.m1_1) assert.ok(new Set(D.m1_1.frames.filter((f) => f.rects.length).map((f) => JSON.stringify(f.rects))).size >= 3);
});

test("combat timing: derived hits keep feel.json's first hit tick, then the drawing times and boxes them; the wind-down slows the clock", () => {
  const feel = { ticks: 20, hits: [{ at: 5, len: 3, box: [0, 0, 1, 1], dmg: 9, weight: "light", kb: [1, 1], fx: "slash_up" }], cancelFrom: 11, moveFrom: 17 };
  const frames = [2, 3, 4, 5].map((ticks, i) => ({ file: `f00${i}.png`, ticks }));
  const f = (rects, root = 0) => ({ area: rects.length ? 2000 : 0, sweep: 0, active: !!rects.length, rects, root, feet: [] });
  const derived = { slot: "t", hash: "0", ticks: [2, 3, 4, 5], frames: [f([]), f([[0, -10, 8, 0]], 2), f([[8, -20, 16, -10]]), f([])], hits: [{ first: 1, last: 2, at: 2, len: 7 }] };
  const r = resolveMove(feel, { frames }, 1, { derived, windRate: 0.5 });
  assert.equal(r.fromArt.derived, true);
  assert.equal(r.rootFrom, "derived");
  assert.deepEqual(r.hits.map((h) => [h.at, h.len]), [[5, 7]]);
  assert.equal(r.clipHitAt, 2, "the clip's first live drawing lands on feel.json's hit tick");
  assert.equal(r.rects[4], null);
  assert.deepEqual(r.rects[5], [[0, -10, 8, 0]], "tick 5 shows f001");
  assert.deepEqual(r.rects[8], [[8, -20, 16, -10]], "tick 8 shows f002");
  assert.equal(r.rects[12], null, "after the hit: no boxes");
  assert.deepEqual(r.wind, { from: 12, rate: 0.5 });
  assert.equal(windClock(14, r.wind), 13);
  assert.ok(Math.abs(r.root.reduce((a, b) => a + b, 0) - 2) < 1e-9, "her planted foot's 2 art px");
  // a derived slot whose ticks no longer match the clip is ignored: feel.json's numbers
  const stale = resolveMove(feel, { frames }, 1, { derived: { ...derived, ticks: [9, 9, 9, 9] } });
  assert.equal(stale.fromArt.derived, false);
  assert.equal(stale.rects, null);
});

// --- the controller ------------------------------------------------------------------------

/** Starts a move from rest (an m1 as that link of the chain) and returns her when it is over and she has settled. */
function runMove(Zhusha, id, clipOf = null, settle = 40) {
  const z = new Zhusha(host(), [0, 0]);
  if (clipOf) z.clipOf = clipOf;
  const inp = new FakeInput();
  step(z, inp, 5);
  const idx = ["m1_1", "m1_2", "m1_3", "m1_4"].indexOf(id);
  if (idx > 0) { z.chainIdx = idx - 1; z.chainEnd = inp.tick; }
  inp.press(id === "skill_q" ? "skill" : id === "e_tap" ? "e" : "m1");
  step(z, inp);
  assert.equal(z.lastAction, id);
  for (let i = 0; i < 120 && z.state === "move"; i++) step(z, inp);
  step(z, inp, settle);
  return z;
}

test("combat chain (Dex 10-19): m1_1 and m1_2 push her forward, m1_3 recoils her back, m1_4 keeps her in place", async () => {
  const Zhusha = await loadZ();
  for (const clipOf of [null, liveClip]) {
    const tag = clipOf ? "with the drawings" : "white box";
    const [a, b, c, d] = ["m1_1", "m1_2", "m1_3", "m1_4"].map((id) => runMove(Zhusha, id, clipOf).body.x / H);
    assert.ok(a > 0.3, `${tag}: m1_1 ${a} H`);
    assert.ok(b > 0.3, `${tag}: m1_2 ${b} H`);
    assert.ok(c < -0.35, `${tag}: m1_3 ${c} H`);
    assert.ok(Math.abs(d) < 0.1, `${tag}: m1_4 ${d} H`);
  }
  // m1_4 out of a run: her momentum stops with it
  const z = new Zhusha(host(), [0, 0]);
  const inp = new FakeInput();
  inp.down.add("right");
  step(z, inp, 30);
  inp.down.delete("right");
  z.chainIdx = 2; z.chainEnd = inp.tick;
  inp.press("m1");
  step(z, inp);
  assert.equal(z.lastAction, "m1_4");
  const x0 = z.body.x;
  for (let i = 0; i < 60 && z.state === "move"; i++) step(z, inp);
  assert.ok(Math.abs(z.body.x - x0) < 2, `m1_4 from a run slid ${z.body.x - x0} px`);
});

test("combat hits from the drawings: m1_1's live boxes are its drawing's, in front of her, and change as the slash moves", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  z.clipOf = liveClip;
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("m1");
  step(z, inp);
  const seen = [];
  for (let i = 0; i < 30 && z.state === "move"; i++) {
    step(z, inp);
    const hb = z.hitboxes();
    if (!hb.length) continue;
    for (const { box } of hb) assert.ok(box.x >= z.body.x - 1e-6, "a box behind her");
    seen.push(JSON.stringify(hb.map(({ box }) => [Math.round(box.x - z.body.x), Math.round(box.y), Math.round(box.w), Math.round(box.h)])));
  }
  assert.ok(seen.length >= 5, `live for ${seen.length} ticks`);
  assert.ok(new Set(seen).size >= 3, "the boxes move with the slash");
});

test("combat wind-down (Dex 10-16): after the last hit her drawing plays slower than its windup, into a slower return; control is unchanged", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  z.clipOf = liveClip;
  let done = false;
  z.clipDone = (a) => done || a.t > 400;
  z.hasRole = (role) => ["m1_1", "m1_1_ret"].includes(role);
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("m1");
  step(z, inp);
  const rate = FEEL.windDown.rate;
  assert.ok(rate < 1);
  const w = z.anim.wind;
  assert.ok(w && w.rate === rate && w.from > FEEL.moves.m1_1.hits[0].at);
  const ts = [];
  for (let i = 0; i < 50; i++) { step(z, inp); ts.push([z.t, z.anim.t, z.state, z.anim.role]); }
  const moveTs = ts.filter(([, , s]) => s === "move");
  for (const [t, at] of moveTs) assert.ok(Math.abs(at - windClock(t, w)) < 1e-9, `tick ${t}: ${at}`);
  // the move ends on feel.json's clock (its windows unchanged), then the tail plays on at `rate`
  assert.ok(moveTs.length <= FEEL.moves.m1_1.ticks + 12);
  const tail = ts.filter(([, , s, r]) => s === "free" && r === "m1_1");
  assert.ok(tail.length > 2, "the tail plays while she stands");
  for (let i = 1; i < tail.length; i++) assert.ok(Math.abs(tail[i][1] - tail[i - 1][1] - rate) < 1e-9);
  done = true;
  step(z, inp);
  assert.equal(z.anim.role, "m1_1_ret");
  assert.equal(z.anim.wind.rate, rate);
});

test("combat Q (Dex 10-15): BOOM a few ticks after the press, a hold on it, the camera pulled out over the exploded area, then back", async () => {
  const Zhusha = await loadZ();
  const h = host();
  const frozen = [];
  h.feel.freeze = (n) => frozen.push(n);
  const z = new Zhusha(h, [0, 0]);
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("skill");
  step(z, inp);
  let boomAt = null, reach = null;
  for (let i = 0; i < 10 && boomAt === null; i++) {
    step(z, inp);
    const hb = z.hitboxes();
    if (hb.length) { boomAt = z.t; reach = hb.find(({ hb: b }) => b.brk?.area)?.box ?? null; }
  }
  assert.ok(boomAt !== null && boomAt <= 4, `BOOM at tick ${boomAt}`);
  assert.ok(frozen.includes(FEEL.q.hold), "the frame holds on the boom with no target");
  assert.ok(reach && reach.w >= 10 * H && reach.x > -H, "its reach: a big area in its direction");
  assert.equal(z.camZoom, FEEL.q.camZoom);
  assert.ok(z.camAt > z.body.x, "centred ahead of her, on the blast");
  step(z, inp, FEEL.q.camTicks + 2);
  assert.equal(z.camZoom, null);
  assert.equal(z.camAt, null);
});

test("combat E (Dex 10-19): the tap fires a beam that reaches far in front, holds the frame, and kicks her back", async () => {
  const Zhusha = await loadZ();
  for (const clipOf of [null, liveClip]) {
    const h = host();
    const frozen = [];
    h.feel.freeze = (n) => frozen.push(n);
    const z = new Zhusha(h, [0, 0]);
    if (clipOf) z.clipOf = clipOf;
    const inp = new FakeInput();
    step(z, inp, 5);
    inp.press("e");
    step(z, inp);
    let beam = null;
    for (let i = 0; i < 40 && z.state === "move"; i++) {
      step(z, inp);
      const r = z.hitboxes().find(({ hb }) => hb.brk?.area);
      if (r) beam = r.box;
    }
    assert.ok(beam && beam.w >= 14 * H && beam.x >= -1, "a beam 15 drawn H long in front of her");
    assert.ok(frozen.includes(FEEL.e.hold));
    step(z, inp, 40);
    assert.ok(z.body.x < -1.2 * H, `recoiled ${z.body.x / H} H`);
  }
});

test("combat damage reactions: a knockdown stops the frame long, lands hard and bounces once; a hurt skids back", async () => {
  const Zhusha = await loadZ();
  const h = host();
  const frozen = [];
  h.feel.freeze = (n) => frozen.push(n);
  const z = new Zhusha(h, [0, 0]);
  const inp = new FakeInput();
  step(z, inp, 5);
  z.hit(30, 1);
  assert.equal(z.state, "down");
  assert.ok(frozen.includes(FEEL.hurt.heavyFreeze));
  // airborne, she lands (y 0), bounces back up off the ground once, and lands again to lie there
  const ys = [];
  for (let i = 0; i < 70; i++) { step(z, inp); ys.push(z.body.y); }
  const first = ys.findIndex((y) => y === 0);
  assert.ok(first > 0, "she lands");
  const after = ys.slice(first + 1);
  assert.ok(Math.min(...after) < -2, "a bounce off the ground");
  const back = after.findIndex((y) => y === 0);
  assert.ok(back > 0 && after.slice(back).every((y) => y === 0), "one bounce, then she lies there");
  const z2 = new Zhusha(host(), [0, 0]);
  step(z2, inp, 5);
  z2.hit(5, 1);
  assert.equal(z2.state, "hurt");
  step(z2, inp, FEEL.hurt.stun + 5);
  assert.ok(z2.body.x > 0.5 * H, `knocked back ${z2.body.x / H} H`);
});

// --- how far each hit destroys (props.ts) ---------------------------------------------------

test("combat destruction: the m1 chain breaks what it touches; the Q obliterates a big area in its direction as a wave; the E's beam everything in front", async () => {
  const Zhusha = await loadZ();
  const { Props } = await import("./props.ts");
  const mk = (id, xH, o = {}) => ({ id, kind: "crate", p: { w: 30, h: 26 }, x: xH * H, y: 0, cls: "cosmetic", material: "wood", ...o });
  const run = (press, defs) => {
    const z = new Zhusha(host(), [0, 0]);
    const sprites = new Map();
    const props = new Props({
      player: z, vfx: { spawn() {} }, feel: { freeze() {}, sound() {} }, camera: { shake() {} },
      ground: () => 0, addSprite: () => {}, removeSprite: () => {}, setFlag: () => {}, hasFlag: () => false, usables: () => [], bottom: 9999,
    }, defs, (id) => { let s = sprites.get(id); if (!s) sprites.set(id, (s = { id, seed: 7, x: 0, y: 0 })); return s; });
    const inp = new FakeInput();
    step(z, inp, 5);
    inp.press(press);
    const broke = {};
    for (let i = 0; i < 90; i++) {
      step(z, inp);
      props.takeHits(z);
      props.tick();
      for (const [id, st] of Object.entries(props.state())) if (st.startsWith("broken") && broke[id] === undefined) broke[id] = i;
    }
    return broke;
  };
  // m1_1: local (a crate in reach goes, one 4 H away does not)
  const m1 = run("m1", [mk("near", 0.9), mk("far", 4)]);
  assert.ok("near" in m1 && !("far" in m1), JSON.stringify(m1));
  // the Q: everything breakable ~10 H ahead goes (a 3 HP post too), nearer first; behind her and the permanent stay
  const q = run("skill", [mk("q1", 2), mk("q2", 5), mk("q3", 9), mk("post", 6, { hp: 3 }), mk("behind", -3), mk("perm", 7, { cls: "permanent" })]);
  for (const id of ["q1", "q2", "q3", "post"]) assert.ok(id in q, `the Q broke ${id}: ${JSON.stringify(q)}`);
  assert.ok(!("behind" in q) && !("perm" in q), JSON.stringify(q));
  assert.ok(q.q1 < q.q3, "the wave travels out");
  // the E: a beam in front, 14 H out; nothing behind
  const e = run("e", [mk("e1", 3), mk("e2", 12), mk("e3", -2)]);
  assert.ok("e1" in e && "e2" in e && !("e3" in e), JSON.stringify(e));
});

test("combat cues: every sound keeps its old name and says move, phase, tier and form; hits fire on the drawing's live ticks", async () => {
  const Zhusha = await loadZ();
  const heard = [];
  const h = host();
  h.feel.sound = (id, v) => heard.push(id);
  const z = new Zhusha(h, [0, 0]);
  z.clipOf = liveClip;
  const cues = [];
  z.onCue = (c) => cues.push({ ...c, t: z.t });
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("m1");
  step(z, inp);
  for (let i = 0; i < 30 && z.state === "move"; i++) step(z, inp);
  const w = cues.find((c) => c.phase === "windup");
  assert.deepEqual([w.id, w.move, w.tier, w.ult], ["swing", "m1_1", "light", false]);
  const sw = cues.find((c) => c.phase === "swing");
  assert.equal(sw.move, "m1_1");
  assert.equal(sw.t, FEEL.moves.m1_1.hits[0].at, "the swing cue on the hit tick the drawing is fitted to");
  assert.equal(sw.hit, 0);
  assert.deepEqual(heard, cues.map((c) => c.id), "feel.sound hears every cue by its old name");
  // the Q: a charge windup, then the boom at q intensity; the E: the boom, then the recoil's skid; the form says so
  const q = new Zhusha(host(), [0, 0]);
  const qc = [];
  q.onCue = (c) => qc.push(c);
  const i2 = new FakeInput();
  step(q, i2, 5);
  q.form = 5000;
  i2.press("skill");
  step(q, i2, 12);
  assert.deepEqual(qc.map((c) => [c.id, c.phase]).slice(0, 2), [["charge", "windup"], ["wave", "boom"]]);
  assert.equal(qc[1].intensity, 0.9);
  assert.ok(qc.every((c) => c.ult));
  const e = new Zhusha(host(), [0, 0]);
  e.clipOf = liveClip;
  const ec = [];
  e.onCue = (c) => ec.push(c);
  const i3 = new FakeInput();
  step(e, i3, 5);
  i3.press("e");
  step(e, i3, 20);
  assert.deepEqual(ec.filter((c) => c.phase !== "windup").map((c) => [c.id, c.phase]).slice(0, 2), [["hit", "boom"], ["skid", "recoil"]]);
});
