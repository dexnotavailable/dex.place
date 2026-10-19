// Zhusha's combat (lane E, 10-19; PLAN-10-19.md, Dex's attack notes): what her attack drawings say (derived.json: live
// drawings, hit boxes that move with the slash, her planted foot), the chain's movement (m1_1 and m1_2 forward, m1_3
// a long lunge that locks onto a foe, m1_4 in place), the slower wind-down, the Q (BOOM in a few ticks, a hold, the camera pulled out over
// the exploded area), the E (a beam far in front, the recoil on the tap), heavier damage reactions, and how far each hit
// destroys (props.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
  const attacks = new Set(Object.keys(FEEL.moves).flatMap((r) => [ROLES[r]?.normal, ROLES[r]?.ult]).filter(Boolean));
  for (const [slot, s] of Object.entries(D)) {
    const def = liveAnim(slot);
    assert.ok(def, `${slot} is slotted`);
    if (!attacks.has(slot)) continue;
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

test("combat chain (Dex 10-19): m1_1 and m1_2 push her forward, m1_3 lunges one to two of her heights, m1_4 keeps her in place", async () => {
  const Zhusha = await loadZ();
  const K = H * FEEL.charScale;
  for (const clipOf of [null, liveClip]) {
    const tag = clipOf ? "with the drawings" : "white box";
    const [a, b, c, d] = ["m1_1", "m1_2", "m1_3", "m1_4"].map((id) => runMove(Zhusha, id, clipOf).body.x);
    assert.ok(a > 0.3 * H, `${tag}: m1_1 ${a / H} H`);
    assert.ok(b > 0.3 * H, `${tag}: m1_2 ${b / H} H`);
    assert.ok(c > 1 * K && c < 2 * K, `${tag}: m1_3 ${c / K} of her heights`);
    assert.ok(Math.abs(d) < 0.1 * H, `${tag}: m1_4 ${d / H} H`);
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

// --- every role she can reach plays a drawing, in both forms (the ult fallbacks) ------------------------------

test("combat roles: every role she can reach, in either form, resolves to a drawing (the form falls back to her normal one)", async () => {
  const { REACHABLE, slotChoices, slotFor } = await import("./zhusha/roles.ts");
  const present = new Set(readdirSync(ROOT).filter((d) => existsSync(join(ROOT, d, "anim.json"))));
  for (const form of ["normal", "ult"]) {
    for (const role of REACHABLE[form]) {
      // planned: a drawing is named for it (never the white box by design)
      assert.ok(slotChoices(role, form === "ult").length, `${form} ${role}: no slot planned`);
      // and wherever her normal form has its drawing now, the form plays one too (no ult white box)
      const normal = slotFor(role, false, (s) => present.has(s));
      if (normal) assert.ok(slotFor(role, form === "ult", (s) => present.has(s)), `${form} ${role}: the white box`);
    }
  }
  // the three mapped on purpose (10-19), once the form's drawings are in
  const all = () => true;
  assert.equal(slotFor("e_tap", true, all), "e_tap");
  assert.equal(slotFor("m1_4_ret", true, all), "uf_m1_3_tail");
  assert.equal(slotFor("knockdown", true, all), "ko_trip");
  // until uf_m1_3_tail is slotted the form's m1_4 return plays guard_to_rest
  assert.equal(slotFor("m1_4_ret", true, (s) => s === "guard_to_rest"), "guard_to_rest");
  // run_stop is out: no drawing, ever
  assert.deepEqual(slotChoices("run_stop", false), []);
});

// --- m1_3 locks onto a foe (Dex 10-19: "a forward lunge, like a body height or two forward, and lock onto the enemy") ---

test("combat m1_3 lock-on: she homes onto a foe in reach and stops at striking distance (its thrusts land), never into it", async () => {
  const Zhusha = await loadZ();
  const { lockTarget } = await import("./zhusha/timing.ts");
  const K = H * FEEL.charScale, L = FEEL.moves.m1_3.lock;
  const foeAt = (near, w = 120) => ({ x: near, y: -1.6 * K, w, h: 1.6 * K });
  /** m1_3 from rest at x 0 with foes (boxes, or a function of the tick for a moving one). */
  const lunge = (foes, clipOf = liveClip, facing = 1) => {
    const h = host();
    let tick = 0;
    h.foes = () => (typeof foes === "function" ? foes(tick) : foes);
    const z = new Zhusha(h, [0, 0]);
    if (clipOf) z.clipOf = clipOf;
    z.facing = facing;
    const inp = new FakeInput();
    step(z, inp, 5);
    z.chainIdx = 1; z.chainEnd = inp.tick;
    inp.press("m1");
    step(z, inp);
    assert.equal(z.lastAction, "m1_3");
    let hitFoe = false;
    for (let i = 0; i < 60 && z.state === "move"; i++) {
      tick++;
      step(z, inp);
      const fs = h.foes();
      for (const { box } of z.hitboxes()) for (const f of fs) if (box.x < f.x + f.w && box.x + box.w > f.x && box.y < f.y + f.h && box.y + box.h > f.y) hitFoe = true;
    }
    return { z, hitFoe };
  };
  // a foe 1.8 of her heights ahead: she ends with its edge `strike` ahead, and her thrusts reach it
  for (const clipOf of [null, liveClip]) {
    const { z, hitFoe } = lunge([foeAt(1.8 * K)], clipOf);
    assert.ok(Math.abs(1.8 * K - z.body.x - L.strike * K) < 3, `stopped ${(1.8 * K - z.body.x) / K} heights short (want ${L.strike})`);
    assert.ok(hitFoe, "the thrusts land on it");
  }
  // already at striking distance or closer: no lunge into it
  assert.ok(Math.abs(lunge([foeAt(0.3 * K)]).z.body.x) < 3);
  // far out of reach: no lock, the plain lunge
  const far = lunge([foeAt(6 * K)]).z.body.x;
  assert.ok(far > 1 * K && far < 2 * K, `${far / K}`);
  // a foe on the move is followed: it backs off during the lunge, she still stops at striking distance (within maxDist)
  const moving = (t) => [foeAt(1.2 * K + Math.min(t, 6) * 6)];
  const m = lunge(moving).z.body.x;
  assert.ok(Math.abs(moving(99)[0].x - m - L.strike * K) < 3, `moving: ${(moving(99)[0].x - m) / K}`);
  // never past maxDist, however far ahead (inside range) the foe stands
  assert.ok(lunge([foeAt((L.range - 0.1) * K)]).z.body.x <= L.maxDist * K + 3);
  // a foe right behind her: she turns to face it and lunges at it
  const back = lunge([{ x: -0.8 * K - 120, y: -1.6 * K, w: 120, h: 1.6 * K }]).z;
  assert.equal(back.facing, -1);
  assert.ok(back.body.x <= 0);
  // the pure aim: front first, the nearest, level with her only
  assert.deepEqual(lockTarget(0, 0, 1, [], L, K), { travel: L.dist * K, dir: 1, foe: -1 });
  assert.equal(lockTarget(0, 0, 1, [foeAt(2 * K), foeAt(1.2 * K)], L, K).foe, 1);
  assert.equal(lockTarget(0, 0, 1, [{ x: K, y: -8 * K, w: 100, h: K }], L, K).foe, -1, "a foe far above is not level with her");
});

// --- the dash (Dex 10-14: "a ground burst: a low, powerful lunge with the feet near or on the ground ... then a skid or plant to stop; only the air dash leaves the ground") ---

test("combat dash: a ground burst that stays on the ground, peaks on the burst drawing, skids its heels to a stop, then rises; breaks nothing", async () => {
  const Zhusha = await loadZ();
  const { timeline, drawingIndex } = await import("./zhusha/contract.ts");
  const D = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/derived.json"), "utf8")).slots;
  // what the drawings say: a foot on the ground in every dash drawing; the ult form's dash has none while she is a streak
  assert.ok(D.dash.frames.every((f) => f.feet.length), "every dash drawing touches the ground");
  if (D.uf_dash) assert.ok(D.uf_dash.frames.slice(4, 6).every((f) => !f.feet.length), "uf_dash f004-f005: gone");
  const def = liveAnim("dash");
  const { starts, total } = timeline(def.frames);
  const h = host();
  const fx = [];
  h.vfx.spawn = (id) => fx.push(id);
  const z = new Zhusha(h, [0, 0]);
  z.clipOf = liveClip;
  z.hasRole = (r) => ["dash", "idle", "run"].includes(r);
  z.clipDone = (a) => a.role !== "dash" || a.t >= total - 1;
  const cues = [];
  z.onCue = (c) => cues.push({ ...c, t: z.t, state: z.state });
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("m2");
  const rows = [];
  for (let i = 0; i < 60; i++) {
    const x0 = z.body.x;
    step(z, inp);
    rows.push({ t: z.t, state: z.state, y: z.body.y, v: z.body.x - x0, role: z.anim.role, d: drawingIndex(starts, total, z.anim.t, false), ifr: z.iframes, hb: z.hitboxes().length });
  }
  // the press tick (she takes the crouch), then the dash's ticks
  const dash = rows.filter((r) => r.state === "dash");
  assert.equal(dash.length, FEEL.dash.ticks + 1);
  assert.ok(dash.every((r) => r.y === 0), "on the ground all the way");
  const dist = dash.reduce((a, r) => a + r.v, 0) / H;
  assert.ok(Math.abs(dist - FEEL.dash.distance) < 0.15, `${dist} H`);
  const peak = dash.reduce((a, r) => (r.v > a.v ? r : a));
  assert.equal(dash.find((r) => r.t === peak.t).d, 1, "full speed on the burst drawing (f001)");
  const k = FEEL.dash.clips.dash.keys;
  assert.equal(dash.find((r) => r.t === k["5"]).d, 5, "the heel skid (f005) as the speed bleeds off");
  assert.ok(dash.filter((r) => r.d >= 5).every((r) => r.v < FEEL.dash.skidFrom * peak.v + 1e-9), "no skid drawing at speed");
  assert.equal(cues.filter((c) => c.id === "skid" && c.move === "dash").length, 1);
  assert.ok(fx.filter((id) => id === "dust.kick").length >= 3, "dust off the burst and the skid");
  // i-frames early, then none; no hit boxes: the dash breaks nothing
  assert.ok(dash.slice(0, FEEL.dash.iframes - 1).every((r) => r.ifr) && !dash[dash.length - 1].ifr);
  assert.ok(rows.every((r) => r.hb === 0));
  // standing after it: the rest of the clip (the skid, the rise to the idle) plays out, then the idle
  const after = rows.filter((r) => r.state === "free");
  const tail = after.filter((r) => r.role === "dash").map((r) => r.d);
  assert.ok(tail.includes(7) && tail.includes(9), `the rise plays: ${tail}`);
  assert.equal(after[after.length - 1].role, "idle");
  // holding on: she runs on out of it (no stop)
  const z2 = new Zhusha(host(), [0, 0]);
  z2.clipOf = liveClip;
  z2.hasRole = z.hasRole;
  z2.clipDone = z.clipDone;
  const i2 = new FakeInput();
  step(z2, i2, 5);
  i2.press("m2");
  i2.down.add("right");
  step(z2, i2, FEEL.dash.ticks + 3);
  assert.equal(z2.anim.role, "run");
});

test("combat air dash: a burst, not flight: level for a moment, then it arcs into the fall; never rises, never shows the skid", async () => {
  const Zhusha = await loadZ();
  const { timeline, drawingIndex } = await import("./zhusha/contract.ts");
  const def = liveAnim("dash");
  const { starts, total } = timeline(def.frames);
  const z = new Zhusha(host(), [0, 0]);
  z.clipOf = liveClip;
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("jump");
  inp.down.add("jump");
  step(z, inp, 14);
  inp.press("m2");
  const rows = [];
  for (let i = 0; i < 30; i++) { const y0 = z.body.y; step(z, inp); rows.push({ state: z.state, t: z.t, dy: z.body.y - y0, y: z.body.y, d: drawingIndex(starts, total, z.anim.t, false), role: z.anim.role }); }
  const air = rows.filter((r) => r.state === "dash");
  assert.equal(air.length, FEEL.dash.ticks + 1);
  assert.ok(air.every((r) => r.y < 0), "in the air");
  assert.ok(air.filter((r) => r.t <= FEEL.dash.airHold).every((r) => Math.abs(r.dy) < 1e-9), "level while it bursts");
  assert.ok(air.every((r) => r.dy >= 0), "never rises (no Superman)");
  assert.ok(air[air.length - 1].dy > 0, "arcs into the fall");
  assert.ok(air.every((r) => r.d < FEEL.dash.clips.dash.skid), "no skid drawings in the air");
  assert.equal(rows.find((r) => r.state === "free").role, "jump");
});

test("combat ult dash: she is gone (the streak) while she covers the distance, and reforms as she slows", async () => {
  const Zhusha = await loadZ();
  const { timeline, drawingIndex } = await import("./zhusha/contract.ts");
  const def = liveAnim("uf_dash");
  if (!def) return;
  const { starts, total } = timeline(def.frames);
  const z = new Zhusha(host(), [0, 0]);
  z.clipOf = liveClip;
  z.form = 5000;
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("m2");
  const rows = [];
  for (let i = 0; i < FEEL.dash.ticks; i++) { const x0 = z.body.x; step(z, inp); rows.push({ t: z.t, v: z.body.x - x0, d: drawingIndex(starts, total, z.anim.t, false) }); }
  const gone = rows.filter((r) => r.d === 4 || r.d === 5);
  const total_ = rows.reduce((a, r) => a + r.v, 0);
  assert.ok(gone.reduce((a, r) => a + r.v, 0) > 0.4 * total_, "most of the way covered while she is a streak");
  assert.ok(rows.filter((r) => r.t >= FEEL.dash.clips.uf_dash.keys["6"]).every((r) => r.d >= 6), "she reforms as she slows");
});

test("combat controls: Shift dashes (K and X still do); the controls card lists every key from the game's own map", async () => {
  const { KEYS } = await import("./keys.ts");
  const { controlRows, capOf } = await import("./controls.ts");
  for (const k of ["ShiftLeft", "ShiftRight", "KeyK", "KeyX"]) assert.deepEqual(KEYS[k], ["m2"], k);
  const rows = Object.fromEntries(controlRows(KEYS).map((r) => [r.what, r.caps]));
  assert.deepEqual(rows.dash, ["Shift", "K", "X"]);
  assert.deepEqual(rows.move, ["A", "D", "←", "→"]);
  assert.deepEqual(rows.jump, ["W", "Space", "↑"]);
  assert.deepEqual(rows.attack, ["J", "Z", "click"]);
  assert.deepEqual([rows.skill, rows.ofuda, rows.ult, rows.use], [["Q"], ["E"], ["R"], ["F"]]);
  // every action the keys can do is on the card (up / down only steer)
  const listed = new Set(["left", "right", "jump", "m1", "m2", "skill", "e", "ult"]);
  for (const acts of Object.values(KEYS)) for (const a of acts) assert.ok(listed.has(a) || a === "up" || a === "down", a);
  assert.equal(capOf("ArrowUp"), "↑");
  // H is free for "hold H": no game key on it
  assert.equal(KEYS.KeyH, undefined);
});

test("combat dash: no white-box afterimages over her drawing (they read as blue rectangles); the box keeps them", async () => {
  const Zhusha = await loadZ();
  const run = (drawn) => {
    const z = new Zhusha(host(), [0, 0]);
    if (drawn) { z.clipOf = liveClip; z.hasRole = (r) => r === "dash"; }
    const inp = new FakeInput();
    step(z, inp, 5);
    inp.press("m2");
    let most = 0;
    for (let i = 0; i < 16; i++) { step(z, inp); most = Math.max(most, z.ghosts.length); }
    return most;
  };
  assert.equal(run(true), 0);
  assert.ok(run(false) > 0);
});

test("combat wind-ups (Dex 10-19): in both forms the first live drawing lands on feel.json's first hit tick, within a few ticks of its BOOM; nothing before it freezes or crawls", async () => {
  const { timeline, drawingIndex, moveToClip } = await import("./zhusha/contract.ts");
  const D = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/derived.json"), "utf8")).slots;
  const A = (96 * FEEL.charScale) / 128;
  let n = 0;
  for (const [role, feel] of Object.entries(FEEL.moves)) {
    for (const slot of [ROLES[role]?.normal, ROLES[role]?.ult]) {
      const def = slot && liveAnim(slot);
      if (!def || !D[slot] || !(def.hits ?? []).length) continue;
      n++;
      const r = resolveMove(feel, def, A, { derived: D[slot], windRate: FEEL.windDown.rate });
      const { starts, total } = timeline(def.frames);
      // the derived hit the move fires first (feel.json artHits: e_tap fires on its second, the ofuda's vanish)
      const k = feel.artHits?.[0] ?? 0;
      const first = D[slot].hits[k].first, mark = [...def.hits].sort((x, y) => x - y)[k];
      const at = r.hits[0].at;
      const shown = (t) => drawingIndex(starts, total, moveToClip(windClock(t, r.wind), at, r.clipHitAt), false);
      assert.equal(shown(at), first, `${slot}: the first live drawing shows on the hit tick`);
      assert.ok(first <= mark && starts[mark] - starts[first] <= DERIVE.lead, `${slot}: the live window starts within ${DERIVE.lead} ticks of the BOOM (f${first} vs f${mark})`);
      // the wind-up is squeezed onto the hit tick (or near 1:1), never stretched: no drawing held longer than it is drawn
      assert.ok(r.clipHitAt / at >= 0.85, `${slot}: wind-up ${r.clipHitAt} clip ticks over ${at} move ticks`);
      for (let t = 1; t <= at; t++) assert.ok(shown(t) >= shown(t - 1), `${slot}: tick ${t} goes back`);
    }
  }
  assert.ok(n >= 8, `${n} slots checked`);
});

test("combat E (Dex 10-20): the shot lands on the drawing where the ofuda vanishes; the whip-out before it is the wind-up", async () => {
  const Zhusha = await loadZ();
  const { timeline, drawingIndex, moveToClip } = await import("./zhusha/contract.ts");
  const def = liveAnim("e_tap");
  const { starts, total } = timeline(def.frames);
  const D = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/derived.json"), "utf8")).slots.e_tap;
  // the vanish: the paper hanging in front of her (f005-f007) is gone in the drawing the shot is on
  const vanish = D.hits[FEEL.moves.e_tap.artHits[0]].first;
  assert.equal(vanish, 8);
  const h = host();
  const cues = [], frozen = [];
  h.feel.freeze = (n) => frozen.push(n);
  const z = new Zhusha(h, [0, 0]);
  z.clipOf = liveClip;
  z.onCue = (c) => cues.push({ ...c, t: z.t });
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("e");
  step(z, inp);
  const rows = [];
  for (let i = 0; i < 40 && z.state === "move"; i++) {
    const x0 = z.body.x;
    step(z, inp);
    rows.push({ t: z.t, d: drawingIndex(starts, total, moveToClip(windClock(z.t, z.anim.wind), z.anim.hitAt, z.anim.clipHitAt), false), v: z.body.x - x0, beam: z.hitboxes().some(({ hb }) => hb.brk?.area), live: z.hitboxes().length > 0 });
  }
  const shot = rows.find((r) => r.live);
  assert.equal(shot.t, FEEL.moves.e_tap.hits[0].at, "the shot on feel's hit tick");
  assert.equal(shot.d, vanish, "on the vanish drawing");
  assert.ok(shot.beam, "the beam's reach goes out with it");
  // before it only the wind-up (her feet's own small step, never the recoil's kick); the recoil after the shot
  assert.ok(rows.filter((r) => r.t < shot.t).every((r) => !r.live && Math.abs(r.v) < 4 && r.d < vanish), "before it: the wind-up only");
  assert.ok(rows.filter((r) => r.t > shot.t + 1 && r.t < shot.t + 8).every((r) => r.v < -4), "the recoil after the shot");
  const boom = cues.find((c) => c.phase === "boom");
  assert.equal(boom.t, shot.t, "the discharge cue on the shot");
  assert.equal(cues.filter((c) => c.move === "e_tap" && c.phase !== "windup").filter((c) => c.t < shot.t).length, 0);
  // one hit only (the burst at f003 is the throw)
  assert.equal(rows.filter((r, i) => r.live && !(rows[i - 1]?.live)).length, 1);
});

test("combat ult-form E (Dex 10-20): removed for now: E does nothing in the form; the flag brings it back", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  z.clipOf = liveClip;
  z.form = 5000;
  const inp = new FakeInput();
  step(z, inp, 5);
  inp.press("e");
  step(z, inp, 20);
  assert.notEqual(z.lastAction, "e_tap");
  assert.equal(z.state, "free");
  assert.equal(z.eCd, 0, "no cooldown either");
  assert.equal(inp.pressTick("e"), undefined, "the press is dropped, not kept for later");
  assert.equal(z.eLive, false, "the finish blow ignores E too");
  // the form ends: E is back
  z.form = 0;
  inp.press("e");
  step(z, inp);
  assert.equal(z.lastAction, "e_tap");
  assert.equal(FEEL.ult.e, false);
});

test("combat run (Dex 10-20): the normal run turns over ~15% faster, its planted foot now near the ground's 9 m/s; steps stay on the contact drawings", async () => {
  const { deriveSlot } = await import("./zhusha/derive.ts");
  const { readPng } = await import("../../tools/zhusha/slotin-lib.mjs");
  const { timeline } = await import("./zhusha/contract.ts");
  const { STEP_FRAMES } = await import("./sound.ts");
  const R = FEEL.run;
  assert.ok(Math.abs(R.playRate / 1.15 - 1.15) < 0.01, `normal ${R.playRate}: ~15% over 1.15`);
  assert.equal(R.ultPlayRate, 1.15, "the form's run unchanged");
  const def = liveAnim("run");
  const imgs = def.frames.map((f) => { const p = readPng(readFileSync(join(ROOT, "run", f.file))); return { w: p.w, h: p.h, data: p.rgba }; });
  const d = deriveSlot("run", def, imgs);
  const { starts } = timeline(def.frames);
  const A = (96 * FEEL.charScale) / 128, v = (R.mps / FEEL.units.metresPerH) * 96 / 60;
  // each step: the contact drawings after a landing; the planted foot's world x at each drawing's first tick
  const centre = (i) => { const f = d.frames[i].feet; return f.length ? (f[0][0] + f[f.length - 1][1]) / 2 : null; };
  const drift = (rate) => {
    const out = [];
    for (const land of STEP_FRAMES.run) {
      const xs = [];
      for (let i = land; i < def.frames.length && centre(i) !== null; i++) xs.push(v * (starts[i] / rate) + centre(i) * A);
      out.push(Math.max(...xs) - Math.min(...xs));
    }
    return Math.max(...out);
  };
  for (const s of STEP_FRAMES.run) assert.ok(d.frames[s].feet.length, `the step drawing f${s} has a foot on the ground`);
  assert.ok(drift(R.playRate) < 0.6 * drift(1.15), `drift ${drift(R.playRate)} px vs ${drift(1.15)} before`);
  assert.ok(drift(R.playRate) < 5, `${drift(R.playRate)} px per step`);
});
