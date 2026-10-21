// R as a cut-in cinematic and the ult form (lane U, zhusha/ult.ts, ultform.ts): the beats from the press to
// control back (the white box and the drawings' own lengths), the slash storm carving the huge letter (she is gone in
// it), the stop, the dive straight down onto the floor, the camera's shots (cuts only where planned, moves continuous,
// the stop dead still, reduced motion held), the sound cues on the beats, the letterbox, control back on any input after
// the nuke, and the form (its chain moves her as the normal chain does; its ghost blades).
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
  assert.deepEqual(r.map((x) => x.phase), ["call", "flurry", "hold", "dive", "impact", "aftermath", "reveal"]);
  // the press tick shows the call's first drawing
  assert.equal(r[0].n, ULT.clips.r_call, "the call");
  assert.equal(r[1].n, ULT.beats.flurry.storm[1] + ULT.letter.ticks, "she bursts into ash, then the storm");
  assert.ok(ULT.letter.ticks >= 180, "the storm runs ~3 s or more (Dex 10-19)");
  assert.equal(r[2].n, ULT.hold, "the stop");
  assert.ok(r[3].n <= ULT.dive.ticks, `the dive ${r[3].n}`);
  assert.equal(r[4].n, ULT.impact.ticks, "the nuke");
  const A = ULT.aftermath;
  assert.equal(r[5].n, A.hold + Math.round(A.clear * A.revealFrom), "held on the wreck while the smoke clears");
  assert.ok(A.hold >= 60 && A.clear >= 150, "it stays on the destruction; the smoke takes seconds to clear (Dex 10-19)");
  assert.equal(r[6].n, ULT.clips.r_reveal - 1, "the reveal (its last tick hands over)");
  assert.ok(ticks.filter((t) => t.phase === "aftermath").every((t) => t.hidden), "unseen in the smoke until the reveal");
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
  assert.equal(r[6].n, 69);
  // her line on the first drawing at or past src 7 (src 8 = drawing 4 = tick 16); the boom past src 10 (drawing 5, 20)
  assert.equal(z.r.beat.line, 16);
  assert.equal(z.r.beat.boom, 20);
  // the storm starts on r_flurry's src 8 drawing (drawing 1, tick 5); until then she is drawn, then gone
  assert.equal(z.r.beat.storm, 5);
  assert.equal(r[1].n, 5 + ULT.letter.ticks);
  const fl = ticks.filter((t) => t.phase === "flurry");
  assert.ok(fl.slice(0, 5).every((t) => !t.hidden && t.role === "r_flurry") && fl.slice(5).every((t) => t.hidden));
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
  // a dive hits once she is grounded (Dex 10-21): nothing on the way down, the nuke on the landing
  assert.ok(dive.every((t) => t.hits.length === 0), "the dive hits nothing in the air");
  assert.ok(ticks.some((t) => t.hits.some((g) => g.startsWith("r-cut-"))), "the storm cuts where it carves");
  // facing left, the stage is to her left; near a wall it stays inside it
  const L = await playR({ facing: -1 });
  assert.equal(L.z.r.stage.gx, -(Lt.ahead + Lt.size / 2) * H);
  const W = await playR({ wall: 3 * H });
  assert.ok(W.z.r.stage.left + W.z.r.stage.size < 3 * H, `the letter inside the wall: ${W.z.r.stage.left + W.z.r.stage.size}`);
});

test("ult: the camera has a shot every tick of R; one hard cut only, the cut-in on the press (Dex 10-19: no cut to the flurry); the stop is dead still; moves are continuous", async () => {
  const { ticks } = await playR();
  const r = ticks.filter((t) => t.state === "ult");
  assert.ok(r.every((t) => t.shot), "a shot every tick");
  const cuts = r.filter((t) => t.shot.cut).map((t) => t.phase);
  assert.deepEqual(cuts, ["call"], "the cut-in on the press, then one continuous camera");
  // (the flurry's snap out to the whole letter is a whip by design: its few ticks are checked below)
  const Sn = ULT.camera.flurry.snap, snap0 = r.findIndex((t) => t.phase === "flurry") + ULT.beats.flurry.storm[1] + Sn.at;
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1].shot, b = r[i].shot;
    if (b.cut || (i >= snap0 && i < snap0 + Sn.ticks)) continue;
    const zr = Math.max(a.zoom / b.zoom, b.zoom / a.zoom);
    assert.ok(zr < 1.13, `zoom step ${a.zoom} -> ${b.zoom} at ${r[i].phase}`);
    assert.ok(Math.abs(b.x - a.x) < 0.8 * H && Math.abs(b.y - a.y) < 1.2 * H, `frame step at ${r[i].phase}: ${a.x},${a.y} -> ${b.x},${b.y}`);
  }
  for (const t of r) assert.ok(t.shot.zoom >= 0.35 && t.shot.zoom <= 2 + 1e-9, `zoom ${t.shot.zoom} within the painted levels`);
  assert.ok(r[0].shot.zoom >= ULT.camera.call.zoomIn - 1e-9, "the cut-in is close on her");
  const fl = r.filter((t) => t.phase === "flurry");
  assert.ok(fl[fl.length - 1].shot.zoom <= ULT.camera.flurry.zoomEnd + 1e-6, "pulled out on the whole letter");
  // the flurry's camera (Dex 10-19: "from her call the camera tries to follow her - she moves too fast, it sorta gives
  // up, then zooms out as the R is filled"; 10-20: "follow her a little longer", "the zoom out to the whole letter should
  // be sudden"): it chases her up into the letter, whips past and swings back, keeps hunting through most of the storm,
  // gives up and settles, then snaps out wide; the letter's centre and the frame are in H from where she pressed
  const F = ULT.camera.flurry, storm = ULT.beats.flurry.storm[1];
  const x0 = r[0].x, gx = (ULT.letter.ahead + ULT.letter.size / 2) * H;
  const at = (k) => fl[k].shot;
  const chase = fl.slice(0, storm + F.chase.giveUp);
  const far = Math.max(...chase.map((t) => t.shot.x - x0));
  assert.ok(far > gx, `it chases her into the letter and whips past its middle (${(far / H).toFixed(2)} H vs ${(gx / H).toFixed(2)})`);
  // (10-21: on the painted letter's spines, with the storm's tail held for after the snap, the early carve is a little
  // slower, so the whip past and back lands ~20 ticks later than on the stand-in's strokes: looked for in the first 70)
  const first = fl.slice(0, storm + 70);
  const far1 = Math.max(...first.map((t) => t.shot.x - x0));
  assert.ok(first[first.length - 1].shot.x - x0 < far1 - 0.5 * H, "and swings back");
  assert.ok(F.chase.giveUp >= 0.7 * ULT.letter.ticks, "it keeps hunting her through most of the storm");
  const late = fl.slice(storm + 100, storm + F.chase.giveUp);
  assert.ok(late.some((t, i) => i > 0 && Math.hypot(t.shot.x - late[i - 1].shot.x, t.shot.y - late[i - 1].shot.y) > 0.05 * H), "still chasing late in the storm");
  assert.ok(chase[0].shot.zoom > 1.9 && chase[chase.length - 1].shot.zoom < chase[0].shot.zoom, "out of the close band as it chases");
  const settled = fl.slice(storm + F.chase.giveUp + 16, storm + F.snap.at);
  for (let i = 1; i < settled.length; i++) assert.ok(Math.hypot(settled[i].shot.x - settled[i - 1].shot.x, settled[i].shot.y - settled[i - 1].shot.y) < 0.03 * H, "it gave up: settled");
  // the snap: from the chase's close framing to wider than the whole letter in a few ticks, then settled on it
  const before = at(storm + F.snap.at - 1), whip = at(storm + F.snap.at + F.snap.ticks - 1), done = at(storm + F.snap.at + F.snap.ticks + F.snap.settle - 1);
  assert.ok(before.zoom > 1.4 && whip.zoom < F.zoomEnd, `sudden: ${before.zoom.toFixed(2)} -> ${whip.zoom.toFixed(2)} in ${F.snap.ticks} ticks, a touch past`);
  assert.ok(Math.abs(done.x - gx) < 1e-6 && Math.abs(done.zoom - F.zoomEnd) < 1e-6, "settled on the whole letter");
  assert.ok(storm + F.snap.at + F.snap.ticks + F.snap.settle <= fl.length, "landed before the stop");
  const hold = r.filter((t) => t.phase === "hold");
  assert.ok(hold.every((t) => t.shot.x === hold[0].shot.x && t.shot.y === hold[0].shot.y && t.shot.zoom === hold[0].shot.zoom), "the stop: dead still");
  const imp = r.filter((t) => t.phase === "impact");
  assert.ok(imp[imp.length - 1].shot.zoom < 0.42, "the pull-out on the nuke");
  // it stays on the destruction: held wide over the crater through the hold, then a slow push in as the smoke clears
  const am = r.filter((t) => t.phase === "aftermath");
  const held = am.slice(0, ULT.aftermath.hold);
  assert.ok(held.every((t) => t.shot.zoom <= ULT.camera.aftermath.zoom + 1e-6), "held wide on the wreck");
  for (let i = 1; i < held.length; i++) assert.ok(Math.abs(held[i].shot.zoom - held[i - 1].shot.zoom) < 0.002, "a barely moving frame");
  assert.ok(am[am.length - 1].shot.zoom > ULT.camera.aftermath.zoom + 0.1, "pushed in toward her as it clears");
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
  for (const k of ["press", "line", "boom", "fire", "draw", "vanish", "slash", "last", "hush", "dive", "impact", "rumble", "reveal"]) assert.ok(at(C[k]) >= 0, `${k} (${C[k]})`);
  assert.equal(C.lineUlt, undefined, "no line spoken on the reveal (Dex 10-19)");
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

test("ult: control is back after the nuke: a press while the smoke clears plays at once in the form; an R mashed in it does not end the form", async () => {
  // in the aftermath (held on the wreck): out at once, in the form, attacking
  const A = await playR({ input: { phase: "aftermath", at: 20, act: (inp) => inp.press("m1") } });
  assert.ok(A.ticks.filter((t) => t.phase === "aftermath").length <= 22 && !A.ticks.some((t) => t.phase === "reveal"), "out of the hold on the press");
  assert.equal(A.z.lastAction, "m1_1");
  assert.ok(A.z.ultForm);
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
  const cuts = new Set(Object.values(F.cuts).flat());
  const ground = new Set([...F.skirt, ...F.wreck, ...F.flames]);
  assert.deepEqual(played.filter((p) => !cuts.has(p.id) && !ground.has(p.id)).map((p) => p.id), [F.callFire, F.letter, F.letterBreak, F.dive, F.cut, F.nuke, F.pall]);
  assert.ok(Object.values(z.r.real).every(Boolean), "every stand-in steps aside");
  const by = (id) => played.find((p) => p.id === id);
  assert.equal(by(F.callFire).attach, "her");
  assert.deepEqual(stopped.filter((id) => !cuts.has(id) && !ground.has(id)), [F.callFire, F.letter, F.letterBreak, F.dive], "her fire carpet ends as she vanishes; the letter as the dive starts, its pieces and her comet on the impact");
  const st = z.r.stage;
  assert.deepEqual([by(F.letter).x, by(F.letter).y, by(F.letter).facing], [st.gx, st.top + st.size, 1], "at the letter's foot, as written (facing left too)");
  assert.ok(st.gx < 0, "facing left: the letter is to her left");
  assert.deepEqual([by(F.dive).phase, by(F.dive).attach], ["dive", "her"], "her comet rides her through the dive");
  for (const id of [F.cut, F.nuke, F.pall]) assert.deepEqual([by(id).x, by(id).y, by(id).phase], [st.gx, 0, "impact"], `${id} from the contact, on the landing`);
  // the ground pieces: each on the ground under it (flat here: y 0), facing out, the far ones later
  const gp = played.filter((p) => ground.has(p.id));
  assert.ok(gp.length >= 12, `the skirt, the flames and the wreck laid along the ground (${gp.length})`);
  assert.ok(gp.every((p) => p.y === 0), "on the ground");
  const skirt = played.filter((p) => F.skirt.includes(p.id));
  assert.ok(skirt.length >= 6 && skirt.every((p) => Math.sign(p.x - st.gx) === p.facing), "the skirt rolls out both ways");
  const near = skirt.reduce((a, p) => (Math.abs(p.x - st.gx) < Math.abs(a.x - st.gx) ? p : a));
  const far = skirt.reduce((a, p) => (Math.abs(p.x - st.gx) > Math.abs(a.x - st.gx) ? p : a));
  assert.ok(far.delay > near.delay, "the surge reaches the far pieces later");
});

test("ult: the real letter is carved on the storm's clock, breaks at the dive, is gone on the impact; the cuts fly over it; each stand-in steps aside only for what is in", async () => {
  const { cutPlan, cutIds } = await import("./zhusha/ult.ts");
  const F = ULT.fx;
  const run = async (has) => {
    const Zhusha = await loadZ();
    const z = new Zhusha(host(), [0, 0]);
    const log = [];
    z.r.fx = {
      has,
      play: (id, o) => { const e = { id, ...o, T: z.r.T, phase: z.r.phase, stormT: z.r.stormT, t: z.r.t, stop: null }; log.push(e); return { stop: () => { e.stop = { phase: z.r.phase, t: z.r.t }; } }; },
    };
    const inp = new FakeInput(), w = flat();
    step(z, inp, w, 5);
    inp.press("ult");
    for (let i = 0; i < 900 && (i < 3 || z.state === "ult"); i++) step(z, inp, w);
    return { z, log };
  };
  const all = await run(() => true);
  const letter = all.log.find((e) => e.id === F.letter), brk = all.log.find((e) => e.id === F.letterBreak);
  assert.equal(letter.stormT, 0, "the letter starts with the storm (its drawings are on the storm's ticks)");
  assert.deepEqual(letter.stop, { phase: "dive", t: 0 }, "stopped as the dive starts");
  assert.deepEqual([brk.phase, brk.t, brk.x, brk.y, brk.facing], ["dive", 0, letter.x, letter.y, 1], "its pieces take over in place, as written");
  assert.deepEqual(brk.stop, { phase: "impact", t: ULT.impact.breakAfter }, "the pieces go under the impact frame (auditor 10-21: never popping out mid-fall after it)");
  // Dex: the camera "gives up, then zooms out as the R is filled": the storm's last carving and its closing sweeps land
  // after the snap out to the whole letter, so the wide shot sees it filled
  const snap = ULT.camera.flurry.snap.at, carves = all.z.r.slashes.filter((s) => s.carves);
  const late = carves.filter((s) => s.at > snap).length / carves.length;
  assert.ok(late >= 0.15 && late <= 0.25, `the last ${(late * 100).toFixed(0)} % of the carving in the wide shot`);
  const lastAt = all.z.r.slashes[all.z.r.slashes.length - 1].at;
  assert.ok(lastAt - snap >= 20 && lastAt - snap <= 40, `the closing sweeps finish ${lastAt - snap} ticks after the snap`);
  // the cuts: on the carving slashes' ticks, at their piece, never more than `cap` alive (the letter is never pushed out)
  const cutLog = all.log.filter((e) => cutIds(F.cuts).includes(e.id));
  const S = all.z.r.slashes, plan = cutPlan(S, F.cuts);
  assert.equal(cutLog.length, plan.length);
  assert.ok(plan.length >= 100, `a storm of cuts: ${plan.length}`);
  assert.ok(cutLog.every((e) => e.phase === "flurry" && e.stormT === S[plan[cutLog.indexOf(e)].slash].at), "each on its slash's tick");
  assert.ok(plan.every((c) => S[c.slash].carves || S[c.slash].sweep), "the carving slashes and the closing sweeps");
  for (let t = 0; t < ULT.letter.ticks + 30; t++) {
    const live = plan.filter((c) => S[c.slash].at + c.delay <= t && S[c.slash].at + c.delay + F.cuts.life > t).length;
    assert.ok(live <= F.cuts.cap + F.cuts.sweepCuts, `at most cap alive (${live} at ${t})`);
  }
  assert.ok(new Set(plan.map((c) => c.id)).size >= 6 && plan.some((c) => c.facing < 0) && plan.some((c) => c.facing > 0), "every angle, both ways");
  // only what is in steps aside: no cuts without the letter; with the letter alone the stand-in's streaks stay
  const noLetter = await run((id) => id !== F.letter);
  assert.deepEqual([noLetter.z.r.real.letter, noLetter.z.r.real.letterBreak, noLetter.z.r.real.cuts], [false, false, false]);
  assert.ok(!noLetter.log.some((e) => cutIds(F.cuts).includes(e.id) || e.id === F.letterBreak));
  const letterOnly = await run((id) => id === F.letter);
  assert.deepEqual([letterOnly.z.r.real.letter, letterOnly.z.r.real.letterBreak, letterOnly.z.r.real.cuts], [true, false, false]);
  const lo = letterOnly.log.find((e) => e.id === F.letter);
  assert.equal(lo.stop.phase, "impact", "with no pieces, the letter stays to the impact");
});

test("ult: the shipped letter fits R's clock and box: its storm drawings on the storm's ticks, held past the dive; its six pieces one clock", () => {
  const fx = (id) => JSON.parse(readFileSync(join(import.meta.dirname, `../../public/assets/fx/${id}/fx.json`), "utf8"));
  const F = ULT.fx, L = fx(F.letter), B = fx(F.letterBreak);
  const total = L.frames.reduce((n, f) => n + f.ticks, 0);
  assert.ok(total >= ULT.letter.ticks + ULT.hold + ULT.dive.ticks + ULT.dive.cap, `held until the director stops it: ${total}`);
  let at = 0;
  for (const f of L.frames) { if (at < ULT.letter.ticks - 2) assert.ok(f.ticks <= 2, "a drawing every 2 ticks through the storm"); at += f.ticks; }
  assert.equal(L.layer, "back", "behind her (she dives through it)");
  assert.equal(B.with.length, 5);
  for (const id of [F.letterBreak, ...B.with]) {
    const p = fx(id);
    assert.deepEqual(p.pivot, B.pivot, `${id} on the pieces' one pivot (their canvas padded for the fall)`);
    assert.ok(p.frames.reduce((n, f) => n + f.ticks, 0) >= ULT.dive.ticks + ULT.dive.cap - 12, `${id} lasts the dive`);
  }
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

/** Plays the M1 chain (a press as each chain window opens) and records her per tick; `form` puts her in the ult form. */
async function chain(form, foes = null) {
  const Zhusha = await loadZ();
  const h = host();
  if (foes) h.foes = () => foes;
  const z = new Zhusha(h, [0, 0]);
  const inp = new FakeInput(), w = flat();
  if (form) z.form = 5000;
  step(z, inp, w, 5);
  const xs = [], acts = [];
  for (let k = 0; k < 4; k++) {
    inp.press("m1");
    for (let i = 0; i < 45; i++) {
      step(z, inp, w);
      xs.push(z.body.x);
      if (i > 2 && z.lastAction === `m1_${k + 1}` && (k === 3 ? i > 40 : z.t >= (FEEL.moves[`m1_${k + 1}`].chainFrom ?? 8))) break;
    }
    acts.push(z.lastAction);
  }
  return { z, xs, acts };
}

test("ult form: the M1 chain moves her as the normal chain does (Dex: no teleports in the chain), lock-on and all", async () => {
  const N = await chain(false), U = await chain(true);
  assert.deepEqual(U.acts, ["m1_1", "m1_2", "m1_3", "m1_4"]);
  assert.deepEqual(U.xs, N.xs, "the same steps, lunges and recoils, tick for tick");
  for (let i = 1; i < U.xs.length; i++) assert.ok(Math.abs(U.xs[i] - U.xs[i - 1]) < 0.5 * H, `no blink: ${U.xs[i - 1]} -> ${U.xs[i]}`);
  // m1_3's lock-on works in the form too: with a foe 2.5 H ahead her lunge stops at striking distance, as in the normal form
  const foe = [{ x: 2.5 * H, y: -1.0 * H, w: 0.8 * H, h: 1.0 * H }];
  const Nf = await chain(false, foe), Uf = await chain(true, foe);
  assert.deepEqual(Uf.xs, Nf.xs, "the lock-on lunge, the same");
  assert.ok(Uf.xs.some((x, i) => i > 0 && x !== U.xs[i]), "the foe changes her path (she locks onto it)");
});

test("ult form: each hit summons ghost blades around her that strike through the foe in front (else where the swing lands) as the ghost hit lands", async () => {
  const F = ULT.form;
  const Zhusha = await loadZ();
  const log = [];
  const h = host(log);
  const foe = { x: 2.2 * H, y: -1.0 * H, w: 0.8 * H, h: 1.0 * H };
  let foes = [foe];
  h.foes = () => foes;
  const z = new Zhusha(h, [0, 0]);
  const inp = new FakeInput(), w = flat();
  z.form = 5000;
  step(z, inp, w, 5);
  inp.press("m1");
  step(z, inp, w);
  const t0 = z.uf.clock - 1, hit = FEEL.moves.m1_1.hits[0].at, gd = FEEL.ult.ghostDelay;
  let bl = [];
  for (let i = 0; i < 20 && !bl.length; i++) { step(z, inp, w); bl = [...z.uf.blades]; }
  assert.equal(bl.length, F.blades[0], "m1_1: one blade");
  const b = bl[0], bodyH = FEEL.charScale * H, chest = z.body.y - 0.6 * bodyH;
  assert.equal(b.born, t0 + hit - F.summon, "summoned a moment before the hit");
  assert.equal(b.at, t0 + hit + gd, "it strikes as the ghost hit lands");
  assert.ok((b.x0 - z.body.x) * z.facing <= 0.2 * H && b.y0 < chest, "from behind / above her shoulders");
  // it flies through the foe's middle
  const cx = foe.x + foe.w / 2, cy = foe.y + foe.h * 0.45;
  const cross = Math.abs((b.x1 - b.x0) * (cy - b.y0) - (b.y1 - b.y0) * (cx - b.x0)) / Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
  assert.ok(cross < 2, `through the foe: ${cross}`);
  assert.ok(log.includes(ULT.cues.blade), "the summon cue");
  // no foe: the next volleys strike where her swing lands, in front of her
  foes = [];
  for (let i = 0; i < 40; i++) step(z, inp, w);
  inp.press("m1");
  let more = [];
  for (let i = 0; i < 30 && !more.length; i++) { step(z, inp, w); more = z.uf.blades.filter((x) => x.born > b.born); }
  assert.ok(more.length > 0);
  assert.equal(z.uf.target.foe, false);
  assert.ok((z.uf.target.x - z.body.x) * z.facing > 0.8 * H, "ahead of her");
  // the normal form summons none
  const n = new Zhusha(host(), [0, 0]);
  const i2 = new FakeInput();
  step(n, i2, flat(), 5);
  i2.press("m1");
  step(n, i2, flat(), 20);
  assert.equal(n.uf.blades.length, 0);
});

test("ult (rfinish 10-21): the impact's freeze is short, so the slow-mo plays the eruption; the nuke's hit freezes no longer", async () => {
  const I = ULT.impact;
  // the freeze counts down at the slow-mo's rate: it must leave most of the slow-mo for the eruption
  const frozenReal = Math.ceil(I.freeze / I.slowmo);
  assert.ok(frozenReal <= 14, `a short impact frame (${frozenReal} real ticks)`);
  assert.ok(I.slowmoTicks - frozenReal >= 40, "the eruption plays slowed after it");
  const Zhusha = await loadZ();
  const freezes = [], slows = [];
  const h = host();
  h.feel.freeze = (n) => freezes.push(n);
  h.feel.slowmo = (f, d) => slows.push([f, d]);
  const z = new Zhusha(h, [0, 0]);
  const inp = new FakeInput(), w = flat();
  step(z, inp, w, 5);
  inp.press("ult");
  let hit = null;
  for (let i = 0; i < 900 && z.r.phase !== "aftermath"; i++) {
    step(z, inp, w);
    const hb = z.hitboxes().find((x) => x.hb.group === "r");
    if (hb && !hit) hit = hb.hb;
  }
  assert.deepEqual(freezes, [I.freeze]);
  assert.deepEqual(slows, [[I.slowmo, I.slowmoTicks]]);
  assert.ok(hit && hit.hitstop <= I.freeze, "the nuke's hit on a foe freezes no longer than the impact frame");
});

test("ult (rfinish 10-21): on a stair rising ahead of her the letter stands on the stair, and the shots after the landing aim where she landed", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  // a floor at 0 under her, a stair 2.2 H up from 3 H ahead
  const stairY = -2.2 * H;
  const gy = (x) => (x > 3 * H ? stairY : 0);
  const world = {
    move(b, dx, dy) {
      b.x += dx;
      b.y += dy;
      let landed = false;
      const g = gy(b.x);
      if (b.y >= g) { landed = !b.grounded; b.y = g; b.vy = 0; b.grounded = true; } else b.grounded = false;
      return { landed };
    },
    groundBelow: (x, y) => (gy(x) >= y - 1e-6 ? { y: gy(x) } : null),
  };
  const inp = new FakeInput();
  step(z, inp, world, 5);
  inp.press("ult");
  let landedY = null;
  for (let i = 0; i < 900 && (i < 3 || z.state === "ult"); i++) {
    step(z, inp, world);
    if (z.r.phase === "impact" && landedY === null) landedY = z.body.y;
  }
  const st = z.r.stage;
  assert.equal(st.solid, true, "the stair is the letter's floor");
  assert.ok(Math.abs(landedY - stairY) < 1e-6, "she lands on the stair");
  assert.ok(Math.abs(st.floor - stairY) < 1e-6, "the shots after the landing aim at where she landed");
});

test("ult (rfinish 10-21): the finish's ground pieces follow the ground and stop at a ledge", async () => {
  const { groundAround } = await import("./zhusha/ult.ts");
  const P = { step: 0.5, reach: 4, rise: 1.2 };
  // steps down to the left (0.5 H each H), a drop of 5 H at 2.6 H to the right
  const gy = (x) => (x < 0 ? -0.5 * x : x > 2.6 * H ? 5 * H : 0);
  const below = (x, y) => (gy(x) >= y - 1e-6 ? { y: gy(x) } : null);
  const spots = groundAround(0, 0, P, below);
  const left = spots.filter((s) => s.side < 0), right = spots.filter((s) => s.side > 0);
  assert.equal(left.length, 8, "down the steps all the way");
  assert.ok(left.every((s) => Math.abs(s.y - gy(s.x)) < 1e-9), "each on the ground under it");
  assert.equal(right.length, 5, "the right side ends at the ledge (no dust over the drop)");
  assert.ok(right.every((s) => s.y === 0));
});

test("ult (rfinish 10-21): control back in the smoke clears it on (it never hides her once she moves)", async () => {
  const Zhusha = await loadZ();
  const z = new Zhusha(host(), [0, 0]);
  const sped = [], faded = [];
  z.r.fx = {
    has: () => true,
    play: (id) => ({ stop() {}, speed: (k) => sped.push([id, k]), fadeOut: (n) => faded.push([id, n]) }),
  };
  const inp = new FakeInput(), w = flat();
  step(z, inp, w, 5);
  inp.press("ult");
  for (let i = 0; i < 900 && !(z.r.phase === "aftermath" && z.r.t === 20); i++) step(z, inp, w);
  inp.press("m1");
  step(z, inp, w);
  assert.notEqual(z.state, "ult");
  const F = ULT.fx;
  assert.ok(sped.some(([id, k]) => id === F.pall && k === ULT.ground.skip), "the pall clears on, faster");
  assert.ok(faded.some(([id, n]) => id === F.pall && n === ULT.ground.skipSmoke), "and breaks up soon");
  assert.ok(sped.some(([id]) => F.skirt.includes(id)), "the dust skirt too");
  assert.ok(faded.some(([id]) => F.flames.includes(id)) && faded.some(([id]) => F.wreck.includes(id)), "her flames and the rubble break up");
});

test("ult (rfinish 10-22): the pall is built on R's clock: it hides her through the aftermath, she steps out of its last wisps, the rest is gone by the end of the clear", async () => {
  const { readPng } = await import("../../tools/zhusha/slotin-lib.mjs");
  const dir = join(import.meta.dirname, "../../public/assets/fx", ULT.fx.pall);
  const def = JSON.parse(readFileSync(join(dir, "fx.json"), "utf8"));
  // the pall plays from the landing, on the same ticks as R's impact + aftermath (fx clock = the game's)
  const I = ULT.impact.ticks, A = ULT.aftermath;
  const reveal = I + A.hold + Math.round(A.clear * A.revealFrom);
  const core = I + A.hold + Math.round(A.clear * A.coreGone);
  assert.ok(core > reveal && core - reveal <= 10, "the middle goes a few ticks into r_reveal");
  const frameAt = (t) => {
    let at = 0;
    for (const f of def.frames) if (t < (at += f.ticks)) return f;
    return null;
  };
  // how much of the box her drawing fills (her 128 art px up from her soles, 48 each side) is smoke
  const over = (t) => {
    const f = frameAt(t);
    if (!f) return 0;
    const { w, h, rgba } = readPng(readFileSync(join(dir, f.file)));
    const k = def.px, [cx, cy] = def.pivot;
    let n = 0, on = 0;
    for (let y = Math.round(cy - 128 / k); y < cy; y++) {
      for (let x = Math.round(cx - 48 / k); x <= Math.round(cx + 48 / k); x++) {
        n++;
        if (x >= 0 && y >= 0 && x < w && y < h && rgba[(y * w + x) * 4 + 3] > 0) on++;
      }
    }
    return on / n;
  };
  // (r_pall takes over from r_nuke_b at tick 64)
  for (const t of [I + 30, I + A.hold, reveal - 30, reveal - 8]) assert.ok(over(t) > 0.9, `she is under the smoke before the reveal (tick ${t}: ${over(t).toFixed(2)})`);
  assert.ok(over(reveal + 1) < 0.6, `she shows as r_reveal starts (${over(reveal + 1).toFixed(2)})`);
  assert.equal(over(core), 0, "nothing over her once the middle is gone (critic 10-22: the stem hid 25 ticks of the reveal)");
  const total = def.frames.reduce((a, f) => a + f.ticks, 0);
  assert.ok(total <= I + A.hold + A.clear + 1, `all of it gone by the end of the clear (${total})`);
});

test("ult (rfinish 10-22): the finish's pieces are never cut by their own drawing's edge (only the floor cuts them)", async () => {
  const { readPng } = await import("../../tools/zhusha/slotin-lib.mjs");
  const F = ULT.fx;
  const root = join(import.meta.dirname, "../../public/assets/fx");
  for (const id of [F.dive, F.cut, F.nuke, `${F.nuke}_b`, F.pall, ...F.skirt, ...F.wreck]) {
    const def = JSON.parse(readFileSync(join(root, id, "fx.json"), "utf8"));
    for (const f of def.frames) {
      const { w, h, rgba } = readPng(readFileSync(join(root, id, f.file)));
      const a = (x, y) => rgba[(y * w + x) * 4 + 3] > 0;
      let edge = 0;
      for (let x = 0; x < w; x++) if (a(x, 0)) edge++;
      for (let y = 0; y < h; y++) if (a(0, y) || a(w - 1, y)) edge++;
      assert.equal(edge, 0, `${id}/${f.file}: ${edge} painted px on its top / side edge (a piece clipped by its frame)`);
    }
  }
});
