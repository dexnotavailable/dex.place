// The audio lanes' wiring, checked without a browser: nothing in the game synthesizes sound any more (Dex 10-19: the
// procedural / chiptune score and the oscillator stand-ins are gone); every cue the game emits is in the table (a
// sound, or silent on purpose); which game event plays which file; that every audio file the code references is
// Dex-approved (best or ok in audio-vetting.json, by source name), one of the audio lane's new takes waiting for his
// ear (on the vetting page), or on the one list of still-unvetted legacy files (ratchets: the lists must match what the
// code references, so a new unlisted sound fails here); her footsteps on the drawings where a foot lands; the region
// themes on real places; and that no generator tag rode into an encode.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BEDS, CUES, DOUBLED, Footsteps, STEP_FRAMES, STEP_TAKES, SURFACES, Sound, VOICE, voiceFor, voiceForState } from "./sound.ts";
import { SPACES, spaceFor } from "./mix.ts";
import { REGION_THEMES, placeAt } from "./region-music.ts";
import { BEATS } from "./opening/beats.ts";
import { INTERIOR_Y } from "./config.ts";
import { buildWorld } from "./world/index.ts";

const AUDIO = fileURLToPath(new URL("../../public/audio/", import.meta.url));
const TESU = fileURLToPath(new URL("./", import.meta.url));
const vetting = JSON.parse(readFileSync(new URL("./audio-vetting.json", import.meta.url), "utf8"));
const verdicts = vetting.verdicts;
const voiceOk = (take) => vetting.voice[take] === "best" || vetting.voice[take] === "ok";
const approved = (name) => verdicts[name] === "best" || verdicts[name] === "ok";

/** The court's events: each one's approved files (the cue table's entries, by name). */
const COURT_EVENTS = {
  gong: ["gong-b"],
  poof: ["poof-c"],
  cheer: ["crowd-cheer-b"],
  "wood.break": ["wood-break-a", "wood-break-b"],
  "clay.break": ["clay-break-a"],
  "paper.break": ["paper-break-b"],
  tink: ["tink-a", "tink-c", "tink-d"],
};
/** Moments with no sound yet: silent on purpose (the court: FOR DEX; her Q / E / R: wave 2, on the combat lane's timing). */
const SILENT = ["installed", "lion-windup", "lion-land", "stagger", "finish", "charge", "rise", "op.inhale"];
/** The legacy library files the code still references, none vetted yet (FOR DEX). This list may only shrink. */
const LEGACY = [
  "door-open.wav", "glass-hit.wav", "metal-heavy.wav", "metal-hit.wav", "stone-break.wav", "stone-hit.wav", "thud.wav",
  "wood-hit.wav",
];
/** The audio lane's ElevenLabs takes in the game, waiting for Dex's ear on the vetting page (lanes/audio/lane2). */
const NEW_TAKES = [
  "her/swing-a", "her/swing-b", "her/swing-d", "her/swing-e", "her/windup-a", "her/hit-c", "her/hit-d", "her/hit-heavy-a", "her/hit-heavy-b",
  "her/slam-a", "her/dash-a", "her/dash-b", "her/jump-a", "her/djump-a", "her/land-a", "her/land-b", "her/hurt-d",
  "her/body-a", "her/body-b", "her/tail-a", "her/tail-b", "her/sub-boom-a", "her/sub-boom-b", "her/sub-drop-a",
  "her/q-boom-a", "her/q-boom-b",
  ...SURFACES.flatMap((m) => Array.from({ length: STEP_TAKES }, (_, i) => `steps/${m}-${i + 1}`)),
  "opening/gust", "opening/flutter", "opening/catch", "opening/read", "opening/slap", "opening/jam", "opening/brim",
  "opening/hatgrip", "opening/burst", "opening/skid",
  "props/splash", "props/debris", "props/paper-hit", "props/panel-open", "props/lift-start", "props/lift-dock",
];

/** Every .ts file under src/tesu. */
function sources(dir = TESU) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** The cue ids a source emits through feel.sound(...): the string literals passed (directly or as a ?: branch). */
function emitted(src) {
  const ids = new Set();
  for (const m of src.matchAll(/feel\.sound\(([^;]*?)\)(?:;|,)/g)) {
    for (const l of m[1].matchAll(/(?:^|\?|:)\s*"([^"]+)"/g)) ids.add(l[1]);
    if (/`\$\{m\}\.(hit|break)`/.test(m[1])) for (const k of ["wood", "stone", "clay", "paper", "metal"]) ids.add(`${k}.${m[1].includes(".hit") ? "hit" : "break"}`);
  }
  return ids;
}

test("nothing in the game synthesizes sound: no oscillators, no lab synth, no placeholder score", () => {
  for (const f of sources()) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/createOscillator|OscillatorNode/.test(src), `${f} makes no oscillator`);
    assert.ok(!/lab\/engine\/sfx/.test(src), `${f} does not use the lab's synth sounds`);
  }
  const sound = readFileSync(new URL("./sound.ts", import.meta.url), "utf8");
  assert.ok(!/class Music\b|createBiquadFilter|createBuffer\(/.test(sound), "sound.ts has no score of its own");
});

test("every cue the game emits is in the table: a sound, or silent on purpose", () => {
  const all = new Set();
  for (const f of sources()) for (const id of emitted(readFileSync(f, "utf8"))) all.add(id);
  for (const id of ["swing", "hit", "dash", "jump", "djump", "land", "hurt", "slam", "gong", "cheer", "tink", "wood.break"]) {
    assert.ok(all.has(id), `the scan finds ${id}`);
  }
  for (const id of all) {
    assert.ok(id in CUES, `cue ${id} is in the table`);
    if (!SILENT.includes(id)) assert.ok(CUES[id].files.length > 0, `cue ${id} has a sound`);
  }
  for (const id of SILENT) assert.deepEqual(CUES[id].files, [], `silent cue ${id}`);
  // the opening's booked effects (BEATS.json sfx)
  for (const s of BEATS.sfx) {
    assert.ok(s.id in CUES, `opening cue ${s.id}`);
    if (!SILENT.includes(s.id)) assert.ok(CUES[s.id].files.every((f) => f.startsWith("opening/")), `opening cue ${s.id} plays the opening's own sound`);
  }
});

test("her sounds: the swing on the hit tick, the windup on the move's first tick, heavier hits sound heavy", () => {
  const ctl = readFileSync(new URL("./zhusha/controller.ts", import.meta.url), "utf8");
  // swingFx runs on each hit's tick (t === h.at), and says "swing" there
  assert.match(ctl, /if \(t === h\.at && !m\.fxDone\.has\(i\)\)[\s\S]{0,80}this\.swingFx\(h, m\)/);
  const fx = ctl.slice(ctl.indexOf("private swingFx("), ctl.indexOf("afterHits(): void"));
  assert.match(fx, /feel\.sound\("swing"/);
  const game = readFileSync(new URL("./game.ts", import.meta.url), "utf8");
  assert.match(game, /herSound\(id, v, \{ first: p\.state === "move" && p\.anim\.t === 0, role: p\.anim\.role, state: p\.state, ult: p\.ultForm \}\)/);
  const snd = readFileSync(new URL("./sound.ts", import.meta.url), "utf8");
  assert.match(snd, /this\.sfx\(id === "swing" && info\.first \? "windup" : id, volume\)/);
  assert.equal(Sound.resolve("hit", 0.6), "hit");
  assert.equal(Sound.resolve("hit", 1), "hit.heavy");
  assert.equal(Sound.resolve("swing", 1), "swing");
  for (const id of ["swing", "windup", "hit", "hit.heavy", "slam", "dash", "land", "hurt"]) {
    assert.ok(CUES[id].files.every((f) => f.startsWith("her/")), `${id} is one of her own sounds`);
  }
  // the hit in layers: the slice, a body, a tail (heavy: a sub); the big hits duck the rest
  assert.deepEqual(CUES.hit.with, ["hit.body", "hit.tail"]);
  assert.deepEqual(CUES["hit.heavy"].with, ["hit.body", "hit.tail", "hit.sub"]);
  for (const c of Object.values(CUES)) for (const w of c.with ?? []) assert.ok(CUES[w] && !CUES[w].with, `layer ${w} exists and has no layers of its own`);
  assert.ok(CUES.wave.duck < 0 && CUES.wave.with.includes("sub.drop"), "the Q's blast: a sub drop under it, the rest ducked");
});

test("her voice: Dex-approved takes, on the right moments, the ult register with its double and sub hits", () => {
  for (const [kind, m] of Object.entries(VOICE)) {
    for (const take of [...m.normal, ...m.ult]) {
      assert.ok(voiceOk(take), `${kind}: ${take} is ok in Dex's voice verdicts`);
      for (const ext of ["opus", "m4a"]) assert.ok(existsSync(join(AUDIO, "voice", `${take}.${ext}`)), `voice/${take}.${ext}`);
    }
    if (m.sub) assert.ok(CUES[m.sub]?.files.length, `${kind}'s sub ${m.sub}`);
  }
  for (const take of DOUBLED) for (const ext of ["opus", "m4a"]) assert.ok(existsSync(join(AUDIO, "voice", `${take}-dbl.${ext}`)), `the double of ${take}`);
  for (const take of Object.keys(vetting.voice)) if (vetting.voice[take] === "bad") {
    for (const m of Object.values(VOICE)) assert.ok(![...m.normal, ...m.ult].includes(take), `${take} (bad) is never used`);
  }
  const at = { first: false, role: "m1_1", state: "move" };
  assert.equal(voiceFor("swing", at), "kiai");
  assert.equal(voiceFor("swing", { ...at, first: true }), null, "the windup is silent");
  assert.equal(voiceFor("swing", { ...at, first: true, role: "e_tap" }), "e");
  assert.equal(voiceFor("swing", { ...at, state: "ult" }), null, "the R's flurry: no kiai");
  assert.equal(voiceFor("charge", at), "q");
  assert.equal(voiceFor("charge", { ...at, state: "ult" }), null, "the R's charge: its call phase speaks");
  assert.equal(voiceFor("hurt", at), "hurt");
  assert.equal(voiceFor("wood.break", at), null);
  const st = (state, phase = null) => ({ state, phase, ult: false });
  assert.equal(voiceForState(st("free"), st("down")), "knockdown");
  assert.equal(voiceForState(st("hurt"), st("dead")), "defeat");
  assert.equal(voiceForState(st("dead"), st("free")), "respawn");
  assert.equal(voiceForState(st("free"), st("ult", "call")), "r");
  assert.equal(voiceForState(st("ult", "smoke"), st("ult", "transform")), "transform");
  assert.equal(voiceForState(st("ult", "call"), st("ult", "call")), null);
  assert.equal(VOICE.r.register, "ult");
  assert.equal(VOICE.transform.register, "ult");
});

test("the mix: a baked reverb per space (and the ult's), the space by place, nothing synthesized", () => {
  for (const k of [...SPACES, "ult"]) for (const ext of ["opus", "m4a"]) assert.ok(existsSync(join(AUDIO, "ir", `${k}.${ext}`)), `ir/${k}.${ext}`);
  assert.equal(spaceFor("hall-of-works", true), "hall");
  assert.equal(spaceFor("prize-court", false), "hall");
  assert.equal(spaceFor("kagami", false), "open");
  assert.equal(spaceFor(null, true), "room");
  const mix = readFileSync(new URL("./mix.ts", import.meta.url), "utf8");
  assert.ok(!/createOscillator|createBuffer\(|createConstantSource/.test(mix), "the mix only processes files");
});

test("footsteps: on the drawings where a foot lands, by the ground's material, once per drawing", () => {
  assert.deepEqual(STEP_FRAMES, { run: [1, 5], walk: [2, 6] });
  for (const slot of Object.keys(STEP_FRAMES)) {
    const n = JSON.parse(readFileSync(join(AUDIO, "../assets/zhusha", slot, "anim.json"), "utf8")).frames.length;
    for (const i of STEP_FRAMES[slot]) assert.ok(i < n, `${slot} drawing ${i} exists`);
  }
  for (const m of SURFACES) assert.equal(CUES[`step.${m}`].files.length, STEP_TAKES, `${m} has its takes`);
  const f = new Footsteps();
  const seq = [0, 1, 1, 2, 3, 4, 5, 5, 6, 7, 0, 1].map((i) => f.update("run", i, true, "wood")?.id ?? null);
  assert.deepEqual(seq, [null, "step.wood", null, null, null, null, "step.wood", null, null, null, null, "step.wood"]);
  assert.equal(f.update("walk", 2, false, "stone"), null, "in the air: no step");
  assert.equal(f.update("walk", 6, true, "stone").id, "step.stone");
  assert.ok(f.update("walk", 2, true, "lava").id === "step.stone", "an unknown surface steps on stone");
  assert.equal(f.update("idle", 1, true, "stone"), null);
});

test("the cue table: the court's and the props' approved sounds play", () => {
  for (const [id, names] of Object.entries(COURT_EVENTS)) {
    assert.deepEqual(CUES[id].files, names.map((n) => `court/${n}`), `cue ${id}`);
  }
  assert.equal(CUES["paper.break"].rate, 1.25, "Dex: paper-break-b 'good but speed up'");
  const sec = readFileSync(new URL("./world/sections/court.ts", import.meta.url), "utf8");
  const materials = [...new Set([...sec.matchAll(/material: "(\w+)"/g)].map((m) => m[1]))].sort();
  assert.deepEqual(materials, ["clay", "paper", "wood"]);
  for (const m of materials) assert.ok(CUES[`${m}.break`].files.every((f) => f.startsWith("court/")), `${m}.break is approved`);
});

test("every audio file the code references is approved, a new take for Dex's ear, or legacy (the lists match exactly)", () => {
  const legacy = new Set(), fresh = new Set();
  for (const cue of Object.values(CUES)) {
    for (const f of cue.files) {
      if (f.endsWith(".wav")) {
        const name = basename(f);
        assert.ok(verdicts[name] !== "bad", `${name} is not rated bad`);
        if (!approved(name)) legacy.add(name);
      } else if (f.startsWith("court/")) {
        assert.ok(approved(`${basename(f)}.wav`), `${f} is approved`);
      } else if (/^opening\/line\d$/.test(f)) {
        assert.ok(voiceOk(`op-${basename(f)}-b`), `${f}: Dex's pick`);
      } else fresh.add(f);
      if (!f.endsWith(".wav")) {
        for (const ext of ["opus", "m4a"]) assert.ok(existsSync(join(AUDIO, `${f}.${ext}`)), `${f}.${ext} exists`);
      } else assert.ok(existsSync(join(AUDIO, f)), `${f} exists`);
    }
  }
  for (const f of Object.values(BEDS)) assert.ok(approved(`${basename(f)}.m4a`), `bed ${f} is approved`);
  for (const f of [...BEATS.track.files.a, ...BEATS.track.files.b]) assert.ok(approved(basename(f).replace(/\.(opus|m4a)$/, ".m4a")), `${f} is approved`);
  assert.deepEqual([...legacy].sort(), [...LEGACY].sort());
  assert.deepEqual([...fresh].sort(), [...NEW_TAKES].sort());
});

test("the region themes: approved takes, encoded as pairs that exist, small enough to stream", () => {
  for (const [place, theme] of Object.entries(REGION_THEMES)) {
    assert.ok(approved(theme.source), `${place}: ${theme.source} is best or ok`);
    for (const ext of ["opus", "m4a"]) {
      const p = join(AUDIO, `${theme.file}.${ext}`);
      assert.ok(existsSync(p), `${place}: ${p} exists`);
      if (ext === "opus") assert.ok(statSync(p).size < 3_000_000, `${place}: ${theme.file}.opus streams small`);
    }
  }
});

test("the region themes sit on real places, and the place she stands in picks its theme", () => {
  const world = buildWorld();
  const ids = new Set(world.places.map((p) => p.id));
  for (const place of Object.keys(REGION_THEMES)) assert.ok(ids.has(place), `${place} is a place`);
  const at = (x, y) => placeAt(world.places, x, y, INTERIOR_Y);
  assert.equal(at(1000, 1000), "kagami", "the lake");
  assert.equal(at(12000, 3000), "gate-road", "the ridge road, open air");
  assert.equal(at(9000, 9000), "shiraito", "the village band beats the open lake");
  assert.equal(at(14000, 5000), "ink-palace", "the palace band beats the open road");
  assert.equal(at(17000, 5000), "prize-court", "the court's open column above the harbour");
  assert.equal(at(17000, 18000), "hoai-pho", "the harbour under the court is the harbour");
  assert.equal(at(14000, 27000), "hall-of-works", "the hall, indoors");
  assert.equal(at(30000, 27000), null, "indoors with no band: no theme");
});

test("no generator tag rode into an encode (the Ogg vendor string is the muxer's, and is allowed)", () => {
  const tag = /suno|lavf|lavc|isft|eleven|provenance|encoder/i;
  for (const dir of ["court", "regions", "her", "steps", "opening", "props", "voice", "ir"]) {
    for (const f of readdirSync(join(AUDIO, dir))) {
      if (/^track1-/.test(f)) continue; // Track 1: the opening lane's encodes, checked there
      const bytes = readFileSync(join(AUDIO, dir, f)).toString("latin1");
      assert.ok(!tag.test(bytes), `${dir}/${f} carries no generator tag`);
    }
  }
});
