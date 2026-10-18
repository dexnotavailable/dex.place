// The audio lane's wiring, checked without a browser: which game event plays which approved file; that every audio
// file the code references is Dex-approved (best or ok in audio-vetting.json, by source name) or on the one list of
// still-unvetted legacy files (a ratchet: the list must match what the code references, so new unvetted sounds fail
// here); that each region theme sits on a real place and that the place she stands in picks its theme; and that no
// generator tag rode into an encode.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BEDS, CUES } from "./sound.ts";
import { REGION_THEMES, placeAt } from "./region-music.ts";
import { BEATS } from "./opening/beats.ts";
import { INTERIOR_Y } from "./config.ts";
import { buildWorld } from "./world/index.ts";

const AUDIO = fileURLToPath(new URL("../../public/audio/", import.meta.url));
const verdicts = JSON.parse(readFileSync(new URL("./audio-vetting.json", import.meta.url), "utf8")).verdicts;
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
/** Court moments with no approved sound yet: silent on purpose (FOR DEX). */
const SILENT_COURT = ["installed", "lion-windup", "lion-land", "stagger", "finish"];
/** The legacy library files the code still references, none vetted yet (FOR DEX). This list may only shrink. */
const LEGACY = [
  "cloth-1.wav", "cloth-2.wav", "cloth-flap.wav", "door-open.wav", "glass-hit.wav", "grit-sift.wav", "hurt.wav",
  "landing.wav", "lift-dock.wav", "lift-start.wav", "metal-heavy.wav", "metal-hit.wav", "paper-cut.wav", "paper-open.wav",
  "splash-1.wav", "stone-break.wav", "stone-hit.wav", "thud.wav", "whoosh.wav", "wood-hit.wav", "wood-knock.wav",
];


test("the cue table: the court's and the props' approved sounds play, and the court's silent moments stay silent", () => {
  for (const [id, names] of Object.entries(COURT_EVENTS)) {
    assert.deepEqual(CUES[id].files, names.map((n) => `court/${n}`), `cue ${id}`);
  }
  for (const id of SILENT_COURT) assert.deepEqual(CUES[id].files, [], `silent cue ${id}`);
  assert.equal(CUES["paper.break"].rate, 1.25, "Dex: paper-break-b 'good but speed up'");
});

test("the court emits only cues the table knows, and each one is approved or deliberately silent", () => {
  const src = readFileSync(new URL("./court.ts", import.meta.url), "utf8");
  const ids = [...new Set([...src.matchAll(/feel\.sound\("([^"]+)"/g)].map((m) => m[1]))];
  assert.ok(ids.includes("cheer") && ids.includes("gong") && ids.includes("poof"), `court emits ${ids.join(", ")}`);
  for (const id of ids) {
    assert.ok(id in CUES, `court cue ${id} is in the table`);
    const want = COURT_EVENTS[id] ? COURT_EVENTS[id].map((n) => `court/${n}`) : [];
    assert.deepEqual(CUES[id].files, want, `court cue ${id}`);
  }
});

test("the court's props break and tink with approved sounds", () => {
  const sec = readFileSync(new URL("./world/sections/court.ts", import.meta.url), "utf8");
  const materials = [...new Set([...sec.matchAll(/material: "(\w+)"/g)].map((m) => m[1]))].sort();
  assert.deepEqual(materials, ["clay", "paper", "wood"]);
  for (const m of materials) {
    const id = `${m}.break`;
    assert.ok(CUES[id].files.length > 0 && CUES[id].files.every((f) => f.startsWith("court/")), `${id} is approved`);
  }
  assert.ok(CUES.tink.files.length === 3 && CUES.tink.files.every((f) => f.startsWith("court/")), "tink is approved");
});

test("every audio file the code references is approved, or on the legacy list (which matches exactly)", () => {
  const referenced = new Set();
  const check = (name) => {
    if (!approved(name)) referenced.add(name);
    assert.ok(verdicts[name] !== "bad", `${name} is not rated bad`);
  };
  for (const cue of Object.values(CUES)) {
    for (const f of cue.files) {
      if (f.startsWith("court/")) check(`${basename(f)}.wav`);
      else check(basename(f));
    }
  }
  for (const f of Object.values(BEDS)) check(`${basename(f)}.m4a`);
  // Track 1 (the opening's music) is approved: its two pieces, by the take's source name
  for (const f of [...BEATS.track.files.a, ...BEATS.track.files.b]) check(basename(f).replace(/\.(opus|m4a)$/, ".m4a"));
  assert.deepEqual([...referenced].sort(), [...LEGACY].sort());
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
  for (const dir of ["court", "regions"]) {
    for (const f of readdirSync(join(AUDIO, dir))) {
      const bytes = readFileSync(join(AUDIO, dir, f)).toString("latin1");
      assert.ok(!tag.test(bytes), `${dir}/${f} carries no generator tag`);
    }
  }
});
