// R as a cut-in cinematic and the ult form's warps (lane U, zhusha/ult.ts, ultform.ts): the beats from the press to
// control back (the white box and the drawings' own lengths), the slash storm carving the huge letter (she is gone in
// it), the stop, the dive straight down onto the floor, the camera's shots (cuts only where planned, moves continuous,
// the stop dead still, reduced motion held), the sound cues on the beats, the letterbox, control back on any input after
// the nuke, and the form's warps and ghost blades.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";

register("./zhusha/test-raw-hooks.mjs", import.meta.url);

const ULT = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/ult.json"), "utf8"));
const FEEL = JSON.parse(readFileSync(join(import.meta.dirname, "zhusha/feel.json"), "utf8"));
const H = 96;

const host = (log = [], reduced = false) => ({
  vfx: { spawn() {} },
  feel: { freeze() {}, slowmo() {}, impactFrame() {}, sound(id) { log.push(id); }, reducedMotion: reduced },
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
// flat ground at y = 0, a wall at x = wall (if given)
const flat = (wall = Infinity) => ({
  move(b, dx, dy) {
    b.x = Math.min(wall - 6, b.x + dx);
    b.y += dy;
    let landed = false;
    if (b.y >= 0) { landed = !b.grounded; b.y = 0; b.vy = 0; b.grounded = true; } else b.grounded = false;
    return { landed };
  },
  groundBelow: () => ({ y: 0 }),
});
const loadZ = async () => (await import("./zhusha/controller.ts")).Zhusha;
const step = (z, inp, w, n = 1) => { for (let i = 0; i < n; i++) { inp.tick++; z.update(inp, w); } };
const frames = (n, ticks, src) => Array.from({ length: n }, (_, i) => ({ file: `f${String(i).padStart(3, "0")}.png`, ticks, ...(src ? { src: src(i) } : {}) }));
const def = (id, fr) => ({ id, stage: "pixel", frames: fr, pivot: [64, 140], figure_h: 128 });

/** Presses R on flat ground and steps until control is back; per tick: the phase, her position, the shot. */
async function playR({ clipOf = null, input = null, reduced = false, facing = 1, wall = Infinity, log = [] } = {}) {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(log, reduced), [0, 0]);
  if (clipOf) z.clipOf = clipOf;
  const inp = new FakeInput(), w = flat(wall);
  z.facing = facing;
  step(z, inp, w, 5);
  inp.press("ult");
  const ticks = [];
  for (let i = 0; i < 900; i++) {
    if (input && z.r.phase === input.phase && z.r.t === input.at) input.act(inp);
    step(z, inp, w);
    ticks.push({ phase: z.r.phase, state: z.state, x: z.body.x, y: z.body.y, shot: z.r.shot && { ...z.r.shot }, bars: z.r.bars, role: z.anim.role, hidden: z.anim.hidden, iframes: z.iframes, hits: z.hitboxes().map((h) => h.hb.group) });
    if (z.state !== "ult" && ticks.length > 2) break;
  }
  return { z, ticks, log, inp, w };
}
const runs = (ticks) => {
  const out = [];
  for (const t of ticks) {
    const last = out[out.length - 1];
    if (last && last.phase === t.phase) last.n++;
    else out.push({ phase: t.phase, n: 1 });
  }
  return out;
};

test("ult: R on the white box runs call > flurry (the slash storm) > the stop > dive > the nuke > reveal, then idle in the form", async () => {
  const { z, ticks } = await playR();
  const r = runs(ticks).filter((x) => x.phase !== null);
  assert.deepEqual(r.map((x) => x.phase), ["call", "flurry", "hold", "dive", "impact", "reveal"]);
  // the press tick shows the call's first drawing
  assert.equal(r[0].n, ULT.clips.r_call, "the call");
  assert.equal(r[1].n, ULT.beats.flurry.storm[1] + ULT.letter.ticks, "she bursts into ash, then the storm");
  assert.ok(ULT.letter.ticks >= 180, "the storm runs ~3 s or more (Dex 10-19)");
  assert.equal(r[2].n, ULT.hold, "the stop");
  assert.ok(r[3].n <= ULT.dive.ticks, `the dive ${r[3].n}`);
  assert.equal(r[4].n, ULT.impact.ticks, "the nuke");
  assert.equal(r[5].n, ULT.clips.r_reveal - 1, "the reveal (its last tick hands over)");
  assert.equal(z.state, "free");
  assert.ok(z.ultForm, "in the form");
  assert.equal(z.anim.role, "idle");
  assert.ok(ticks.filter((t) => t.state === "ult").every((t) => t.iframes), "untouchable through R");
  // she is gone through the storm (she IS the slashes) and back for the stop
  const fl = ticks.filter((t) => t.phase === "flurry");
  assert.ok(fl.slice(ULT.beats.flurry.vanish[1] + 1).every((t) => t.hidden), "hidden in the storm");
  assert.ok(ticks.filter((t) => t.phase === "hold").every((t) => !t.hidden), "there for the stop");
});

test("ult: with the drawings in, the call and the reveal last their own clips (the call at its original speed); r_flurry plays to the storm", async () => {
  const log = [];
  const call = def("r_call", frames(30, 4, (i) => i * 2)); // 120 ticks; src 0, 2, 4 ...
  const flurry = def("r_flurry", frames(20, 5, (i) => 4 + i * 4)); // src 4, 8, ...
  const reveal = def("r_reveal", frames(10, 7)); // 70 ticks, no src
  const clipOf = (role) => ({ r_call: call, r_flurry: flurry, r_reveal: reveal })[role] ?? null;
  const { ticks, z } = await playR({ clipOf, log });
  const r = runs(ticks).filter((x) => x.phase !== null);
  assert.equal(r[0].n, 120);
  assert.equal(r[5].n, 69);
  // her line on the first drawing at or past src 7 (src 8 = drawing 4 = tick 16); the boom past src 10 (drawing 5, 20)
  assert.equal(z.r.beat.line, 16);
  assert.equal(z.r.beat.boom, 20);
  // the storm starts on r_flurry's src 8 drawing (drawing 1, tick 5); until then she is drawn, then gone
  assert.equal(z.r.beat.storm, 5);
  assert.equal(r[1].n, 5 + ULT.letter.ticks);
  const fl = ticks.filter((t) => t.phase === "flurry");
  assert.ok(fl.slice(0, 5).every((t) => !t.hidden && t.role === "r_flurry") && fl.slice(5).every((t) => t.hidden));
  // r_reveal has no src: its pose beat scales with its length
  assert.equal(z.r.beat.pose, Math.round((ULT.beats.reveal.pose[1] * 70) / ULT.clips.r_reveal));
});

test("ult: the letter is huge and ahead of her; she stops above it, dives straight down through it onto the floor; the nuke (group r) lands once", async () => {
  const { ticks, z } = await playR();
  const st = z.r.stage, Lt = ULT.letter;
  assert.equal(st.size, Lt.size * H);
  assert.ok(st.size >= 6 * H, "absolutely huge (a nuke): many times her height");
  assert.equal(st.gx, (Lt.ahead + Lt.size / 2) * H);
  const zy = -(Lt.low + Lt.size + Lt.zenithAbove) * H;
  const hold = ticks.filter((t) => t.phase === "hold");
  assert.ok(hold.every((t) => Math.abs(t.x - st.gx) < 1e-9 && Math.abs(t.y - zy) < 1e-9), "above the letter");
  const dive = ticks.filter((t) => t.phase === "dive");
  assert.ok(dive.every((t) => t.x === st.gx), "straight down");
  for (let i = 1; i < dive.length; i++) assert.ok(dive[i].y > dive[i - 1].y, "always falling, faster and faster");
  const imp = ticks.filter((t) => t.phase === "impact");
  assert.equal(imp[0].y, 0, "on the floor");
  const nukes = ticks.filter((t) => t.hits.includes("r"));
  assert.ok(nukes.length >= 1 && nukes.length <= 3, "the nuke's box is live on the landing (hit groups take each target once)");
  assert.ok(dive.every((t) => t.hits.includes("r-dive")), "the dive breaks its column");
  assert.ok(ticks.some((t) => t.hits.some((g) => g.startsWith("r-cut-"))), "the storm cuts where it carves");
  // facing left, the stage is to her left; near a wall it stays inside it
  const L = await playR({ facing: -1 });
  assert.equal(L.z.r.stage.gx, -(Lt.ahead + Lt.size / 2) * H);
  const W = await playR({ wall: 3 * H });
  assert.ok(W.z.r.stage.left + W.z.r.stage.size < 3 * H, `the letter inside the wall: ${W.z.r.stage.left + W.z.r.stage.size}`);
});

test("ult: the camera has a shot every tick of R; hard cuts only at the press and the flurry; the stop is dead still; moves are continuous", async () => {
  const { ticks } = await playR();
  const r = ticks.filter((t) => t.state === "ult");
  assert.ok(r.every((t) => t.shot), "a shot every tick");
  const cuts = r.filter((t) => t.shot.cut).map((t) => t.phase);
  assert.deepEqual(cuts, ["call", "flurry"], "the cut-in on the press, the cut wide onto the letter");
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1].shot, b = r[i].shot;
    if (b.cut) continue;
    const zr = Math.max(a.zoom / b.zoom, b.zoom / a.zoom);
    assert.ok(zr < 1.13, `zoom step ${a.zoom} -> ${b.zoom} at ${r[i].phase}`);
    assert.ok(Math.abs(b.x - a.x) < 0.8 * H && Math.abs(b.y - a.y) < 1.2 * H, `frame step at ${r[i].phase}: ${a.x},${a.y} -> ${b.x},${b.y}`);
  }
  for (const t of r) assert.ok(t.shot.zoom >= 0.35 && t.shot.zoom <= 2 + 1e-9, `zoom ${t.shot.zoom} within the painted levels`);
  assert.ok(r[0].shot.zoom >= ULT.camera.call.zoomIn - 1e-9, "the cut-in is close on her");
  const fl = r.filter((t) => t.phase === "flurry");
  assert.ok(fl[fl.length - 1].shot.zoom <= ULT.camera.flurry.zoomEnd + 1e-6, "pulled out on the whole letter");
  const hold = r.filter((t) => t.phase === "hold");
  assert.ok(hold.every((t) => t.shot.x === hold[0].shot.x && t.shot.y === hold[0].shot.y && t.shot.zoom === hold[0].shot.zoom), "the stop: dead still");
  const imp = r.filter((t) => t.phase === "impact");
  assert.ok(imp[imp.length - 1].shot.zoom < 0.42, "the pull-out on the nuke");
  // after control is back the world's framing has the camera again
  assert.equal(ticks[ticks.length - 1].shot, null);
});

test("ult: reduced motion holds its framings: the call in the close band, the rest at play zoom, no moves inside a phase", async () => {
  const { ticks } = await playR({ reduced: true });
  const r = ticks.filter((t) => t.state === "ult");
  assert.ok(r.every((t) => t.shot.zoom === 1 || t.shot.zoom === 2));
  for (let i = 1; i < r.length; i++) {
    if (r[i].phase !== r[i - 1].phase) continue;
    assert.deepEqual([r[i].shot.x, r[i].shot.y, r[i].shot.zoom], [r[i - 1].shot.x, r[i - 1].shot.y, r[i - 1].shot.zoom], `held in ${r[i].phase}`);
  }
});

test("ult: the storm carves the letter piece by piece: hundreds of slashes from every direction, the whole letter at once (not a wave), the closing cut last", async () => {
  const { LETTERS, storm, letterStrokes, slashBox } = await import("./zhusha/ult.ts");
  assert.equal(LETTERS["断"].length, 11);
  assert.equal(LETTERS["天"].length, 4);
  assert.ok(["断", "天"].includes(ULT.letter.char), "a letter from her R line 一筆――天を断つ");
  const S = storm(letterStrokes(), ULT.letter.slashes, ULT.letter.ticks, ULT.letter.pieces, ULT.letter.slashLen);
  assert.equal(S.length, ULT.letter.slashes);
  assert.ok(S.length >= 200, "hundreds");
  assert.ok(S.every((s, i) => i === 0 || s.at >= S[i - 1].at), "in time order");
  assert.ok(S[S.length - 1].last && S.filter((s) => s.last).length === 1, "the closing cut last");
  // every piece is carved once, by its first slash; re-cuts come after it
  const carved = new Map();
  for (const s of S) {
    if (s.carves) { assert.ok(!carved.has(s.piece)); carved.set(s.piece, s.at); }
    else if (!s.sweep) assert.ok(carved.has(s.piece) && s.at > carved.get(s.piece), "a re-cut follows its carve");
  }
  // then a closing sweep down each stroke, in stroke order, the last on the storm's last tick; nothing after it
  const sweeps = S.filter((s) => s.sweep);
  assert.deepEqual(sweeps.map((s) => s.stroke), letterStrokes().map((_, i) => i));
  assert.equal(sweeps[sweeps.length - 1].at, ULT.letter.ticks - 1);
  assert.ok(S.filter((s) => !s.sweep).every((s) => s.at < sweeps[0].at), "the storm ends before the sweeps");
  // not a wave: in the storm's first third, pieces of most strokes are already being carved
  const early = new Set(S.filter((s) => s.carves && s.at < ULT.letter.ticks / 3).map((s) => s.stroke));
  assert.ok(early.size >= Math.ceil(letterStrokes().length * 0.5), `strokes started early: ${early.size}`);
  // from every direction
  const quads = new Set(S.map((s) => Math.floor((((s.ang % Math.PI) + Math.PI) % Math.PI) / (Math.PI / 4))));
  assert.equal(quads.size, 4);
  // in the game all of it plays, and facing left the same letter moves to her left, not flipped
  const { z } = await playR();
  assert.equal(z.r.cut, ULT.letter.slashes);
  const L = await playR({ facing: -1 });
  const a = slashBox(z.r.stage, S[10], 0), b = slashBox(L.z.r.stage, S[10], 0);
  assert.ok(Math.abs(b.x - a.x + 2 * (ULT.letter.ahead + ULT.letter.size / 2) * H) < 1e-6 && Math.abs(b.w - a.w) < 1e-6 && b.y === a.y, JSON.stringify([a, b]));
});

test("ult: the sound cues land on the beats (lane D's ids)", async () => {
  const log = [];
  const { z } = await playR({ log });
  const C = ULT.cues;
  const at = (id) => log.indexOf(id);
  for (const k of ["press", "line", "boom", "fire", "draw", "vanish", "slash", "last", "hush", "dive", "impact", "rumble", "reveal", "lineUlt"]) assert.ok(at(C[k]) >= 0, `${k} (${C[k]})`);
  const n = log.filter((id) => id === C.slash).length;
  assert.ok(n >= 30 && n <= 50, `a dense roll of slash sounds, not hundreds of files: ${n}`);
  const order = ["press", "line", "boom", "vanish", "slash", "last", "hush", "dive", "impact", "rumble", "reveal"].map((k) => at(C[k]));
  assert.deepEqual([...order].sort((p, q) => p - q), order, "in the order of the beats");
  assert.ok(log.lastIndexOf(C.slash) < at(C.last) && at(C.last) < at(C.hush), "the slashes stop before the stop");
  assert.ok(z.ultForm);
});

test("ult: the letterbox slides in with R and out after", async () => {
  const { ticks, z, inp, w } = await playR();
  const r = ticks.filter((t) => t.state === "ult");
  assert.ok(r[ULT.camera.barsIn + 2].bars === ULT.camera.bars);
  step(z, inp, w, ULT.camera.barsOut + 2);
  assert.equal(z.r.bars, 0);
});

test("ult: control is back after the nuke: a press during the reveal plays at once in the form; an R mashed in it does not end the form", async () => {
  const { z, ticks } = await playR({ input: { phase: "reveal", at: 10, act: (inp) => { inp.press("m1"); inp.press("ult"); } } });
  const rev = ticks.filter((t) => t.phase === "reveal").length;
  assert.ok(rev <= 12, `out of the reveal on the press (${rev} ticks)`);
  assert.equal(z.state, "move");
  assert.equal(z.lastAction, "m1_1");
  assert.ok(z.ultForm, "still in the form");
});

test("ult: the FX v2 loop's effects play on the beats when the game has them (the letter as written, never mirrored); the stand-ins step aside", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  const played = [], stopped = [];
  z.r.fx = { has: () => true, play: (id, o) => { played.push({ id, ...o, T: z.r.T, phase: z.r.phase }); return { stop: () => stopped.push(id) }; } };
  z.facing = -1;
  const inp = new FakeInput(), w = flat();
  step(z, inp, w, 5);
  inp.press("ult");
  for (let i = 0; i < 900 && (i < 3 || z.state === "ult"); i++) step(z, inp, w);
  const F = ULT.fx;
  assert.deepEqual(played.map((p) => p.id), [F.callFire, F.letter, F.dive, F.nuke, F.clear]);
  assert.ok(Object.values(z.r.real).every(Boolean), "every stand-in steps aside");
  const by = (id) => played.find((p) => p.id === id);
  assert.equal(by(F.callFire).attach, "her");
  assert.deepEqual(stopped, [F.callFire], "her fire carpet ends as she vanishes");
  const st = z.r.stage;
  assert.deepEqual([by(F.letter).x, by(F.letter).y, by(F.letter).facing], [st.gx, st.top + st.size, 1], "at the letter's foot, as written (facing left too)");
  assert.ok(st.gx < 0, "facing left: the letter is to her left");
  assert.equal(by(F.dive).phase, "dive");
  assert.deepEqual([by(F.nuke).x, by(F.nuke).y], [st.gx, 0], "the nuke at the crater");
  assert.equal(by(F.clear).phase, "reveal");
});

test("ult: the storm's hits never stop the frame (R owns its weight: only the nuke freezes it, once)", async () => {
  const Zhusha = await loadZ();
  const freezes = [];
  const h = host();
  h.feel.freeze = (n) => freezes.push(n);
  const z = new Zhusha(h, [0, 0]);
  const inp = new FakeInput(), w = flat();
  step(z, inp, w, 5);
  inp.press("ult");
  for (let i = 0; i < 900 && !(z.r.phase === "flurry" && z.r.stormT > 20); i++) step(z, inp, w);
  // a prop in the letter takes a cut
  z.clip.hitGroups.set("r-cut-0", new Set([{}]));
  z.afterHits();
  assert.deepEqual(freezes, [], "no hitstop in the storm");
  for (let i = 0; i < 900 && z.r.phase !== "impact"; i++) step(z, inp, w);
  z.clip.hitGroups.set("r", new Set([{}, {}]));
  z.afterHits();
  assert.equal(freezes.length, 1, "the nuke's one freeze");
});

test("ult form: M1 warps her around a foe (ahead, across facing back, above, back off) and summons ghost blades that strike on the ghost hit", async () => {
  const Zhusha = await loadZ();
  const log = [];
  const z = new Zhusha(host(log), [0, 0]);
  const inp = new FakeInput(), w = flat();
  const foe = { x: 4 * H, y: 0 };
  z.uf.foe = () => foe;
  z.form = 5000;
  step(z, inp, w, 5);
  const spots = [];
  for (let k = 0; k < 4; k++) {
    inp.press("m1");
    step(z, inp, w);
    spots.push({ x: z.body.x, y: z.body.y, facing: z.facing, act: z.lastAction });
    // the chain window
    step(z, inp, w, k === 3 ? 1 : (FEEL.moves[`m1_${k + 1}`].chainFrom ?? 10) - 1);
  }
  const S = ULT.form.steps;
  assert.deepEqual(spots.map((s) => s.act), ["m1_1", "m1_2", "m1_3", "m1_4"]);
  assert.ok(Math.abs(spots[0].x - (foe.x + S[0].at * H)) < 1, `ahead of it: ${spots[0].x}`);
  assert.ok(spots[1].x > foe.x && spots[1].facing === -1, "across it, facing back");
  assert.ok(spots[2].y < -H, "above it");
  // the finisher: backed off on the side she is on, facing it
  const side = Math.sign(spots[2].x - foe.x);
  assert.ok(Math.sign(spots[3].x - foe.x) === side && Math.abs(spots[3].x - foe.x) > 1.5 * H && spots[3].facing === -side, "backed off for the finisher");
  assert.ok(log.includes(ULT.cues.warp));
  // blades: summoned before the hit, striking ghostDelay after it, through the foe
  const bl = z.uf.blades;
  assert.ok(bl.length > 0);
  assert.ok(bl.every((b) => b.born < b.at && b.at < b.end));
  const cy = foe.y - 0.55 * (FEEL.charScale * H);
  assert.ok(bl.every((b) => Math.abs((b.x0 + b.x1) / 2 - foe.x) < 1.2 * H && b.y0 < cy), "from above, through the foe");
});

test("ult form: with no foe in reach the warps carry her forward; walls stop a warp", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  const inp = new FakeInput(), w = flat(2 * H);
  z.form = 5000;
  step(z, inp, w, 5);
  inp.press("m1");
  step(z, inp, w);
  assert.ok(Math.abs(z.body.x - ULT.form.free[0] * H) < 1, `forward ${z.body.x}`);
  step(z, inp, w, FEEL.moves.m1_1.chainFrom - 1);
  inp.press("m1");
  step(z, inp, w);
  assert.ok(z.body.x <= 2 * H - 6, "stopped at the wall");
  // never off a ledge: with the ground ending 2 H out, a warp from 1.5 H shortens to stay on it
  const z3 = new Zhusha(host(), [1.5 * H, 0]);
  const i3 = new FakeInput(), w3 = { ...flat(), groundBelow: (x) => (x < 2 * H ? { y: 0 } : null) };
  z3.form = 5000;
  step(z3, i3, w3, 5);
  i3.press("m1");
  step(z3, i3, w3);
  assert.ok(z3.body.x > 1.5 * H && z3.body.x < 2 * H, `kept on the ground: ${z3.body.x / H} H`);
  // the normal form never warps
  const n = new Zhusha(host(), [0, 0]);
  const i2 = new FakeInput();
  step(n, i2, flat(), 5);
  i2.press("m1");
  step(n, i2, flat());
  assert.ok(Math.abs(n.body.x) < 0.3 * H);
});
