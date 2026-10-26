// Builds public/audio/world/ (lane S1): the music copied from legacy/, the
// ambience beds, the effects and the footsteps, plus manifest.json with sizes,
// hashes, levels and provenance for every file.
//
//   DEX_AUDIO_SOURCES=<folder holding the CC0 packs> node src/world/sound/build/build.mjs [--only beds|sfx|steps|music] [--id <id>]
//
// The CC0 packs (Kenney Impact Sounds; rubberduck's 100 CC0 SFX #2;
// TinyWorlds' Different steps) are read from DEX_AUDIO_SOURCES in the layout
// sources.mjs names; nothing is downloaded. The build is deterministic (seeded).
// Every file is listening-pending until Dex approves it by ear.

import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  SR, add, db, decode, encodeBed, env, filt, level, lfo, loud, mul, onset, panAdd, peak, rate, reverb, reverse, rms, rng, scale,
  seam, sec, sha256, shape, smooth, todb, trim, white, writeWav, zeros, pink, chirp,
} from "./dsp.mjs";
import * as S from "./synth.mjs";
import { LEGACY, PACKS, REPO, src } from "./sources.mjs";

const OUT = join(REPO, "public/audio/world");
const TMP = join(REPO, "review/world/phase2/S1/build-tmp");
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const onlyId = args.includes("--id") ? args[args.indexOf("--id") + 1] : null;
for (const d of ["music", "beds", "sfx", "steps"]) mkdirSync(join(OUT, d), { recursive: true });
mkdirSync(TMP, { recursive: true });

const manifestPath = join(OUT, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { entries: {} };
manifest.schema = "dex.world.audio/1";
manifest.note = "Built by src/world/sound/build/build.mjs (lane S1). listening: every file is pending until Dex approves it by ear.";

function fileInfo(p) {
  return { bytes: statSync(p).size, sha256: sha256(p) };
}

function record(id, e) {
  manifest.entries[id] = { ...e, listening: e.listening ?? "pending" };
}

// --- music (copied byte for byte) ------------------------------------------------------------

function music() {
  const copies = [
    ["music/theme-b", "world-v1/suno-theme-b-v1/support", "Dex's chosen Suno \"B\" arrangement of the original dex.place theme (legacy id support, suno-theme-b-v1); bytes unchanged.", "approved (theme choice, 2026-09)"],
    ["music/arena-chamber", "v2/arena-chamber-v1", "Original dex.place motif for strings and cello, FluidSynth 2.6.0 + GeneralUser GS 2.0.3 (recordings permitted); bytes unchanged. Stand-in for the arena (WORLD-PLAN section 14 default 5).", "pending"],
    ["beds/exterior", "world-v1/exterior", "Original deterministic synthesis (legacy world-v1, seed 9062031); kept for the test world.", "reviewed in the 2026-09-08 playtest"],
    ["beds/interior", "world-v1/interior", "Original deterministic synthesis (legacy world-v1, seed 9062031); kept for the test world.", "reviewed in the 2026-09-08 playtest"],
  ];
  for (const [to, from, provenance, listening] of copies) {
    const files = {};
    for (const ext of ["opus", "m4a"]) {
      copyFileSync(join(LEGACY, `${from}.${ext}`), join(OUT, `${to}.${ext}`));
      files[ext] = fileInfo(join(OUT, `${to}.${ext}`));
    }
    const d = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(OUT, `${to}.opus`)]).toString());
    record(to, { kind: to.startsWith("music") ? "music" : "bed", files, seconds: +d.toFixed(3), provenance, sources: [{ pack: "legacy", file: `${from}.opus/.m4a`, license: "see ATTRIBUTION.md" }], listening });
  }
  copyFileSync(join(LEGACY, "world-v1/suno-theme-b-v1/ATTRIBUTION.md"), join(OUT, "music/ATTRIBUTION-theme-b.md"));
  for (const f of ["GeneralUser-GS-LICENSE.txt", "FluidSynth-LICENSE.txt"]) copyFileSync(join(LEGACY, "world-v1/original-theme-v1", f), join(OUT, "music", f));
}

// --- beds ----------------------------------------------------------------------------------------

const BED_LEN = 36;

/** Mix helpers for stereo beds. */
const st = (n) => [zeros(n), zeros(n)];
function mix(dst, srcSt, g = 1) {
  add(dst[0], srcSt[0], g);
  add(dst[1], srcSt[1], g);
}
function monoTo(dst, x, g = 1, pan = 0) {
  panAdd(dst[0], dst[1], x, 0, g, pan, false);
}
function wet(dry, o) {
  const w = reverb(dry, { ...o, loop: true });
  return w;
}
/** Scatter events around the loop: `count` placements of clip(r) at random times, wrapped. */
function scatter(dst, r, count, clip, { g = [0.5, 1], pan = [-0.7, 0.7], spacing = null } = {}) {
  const n = dst[0].length;
  let t = Math.floor(r() * n);
  for (let i = 0; i < count; i++) {
    const c = clip(r, i);
    panAdd(dst[0], dst[1], c, t, r.range(g[0], g[1]), r.range(pan[0], pan[1]), true);
    t = spacing ? (t + sec(r.range(spacing[0], spacing[1]))) % n : Math.floor(r() * n);
  }
}
function lowpass(stBuf, f, q = 0.7) {
  for (const c of stBuf) filt(c, "lp", f, q, { loop: 1 });
  return stBuf;
}
function highpass(stBuf, f, q = 0.7) {
  for (const c of stBuf) filt(c, "hp", f, q, { loop: 1 });
  return stBuf;
}

const BEDS = {
  // A: water lap, far gull, rope creak; still morning air
  lake: { seed: 101, target: -33, desc: "water lapping at the dock, a rope creaking, a far gull, still air", build(n, r) {
    const o = st(n);
    for (let c = 0; c < 2; c++) {
      const w = pink(n, r);
      filt(w, "bp", 480, 0.5, { loop: 1 });
      filt(w, "lp", 1400, 0.7, { loop: 1 });
      mul(w, shape(lfo(n, r, 4, 9, 5), 0.3, 1, 1.4));
      add(o[c], w, 0.9);
    }
    scatter(o, r, 16, (rr) => S.lap(rr, 1), { g: [0.25, 0.8], spacing: [1.3, 3.2] });
    mix(o, S.wind(n, r, { low: 0.25, whistle: 0, hiss: 0.3, gustCycles: [2, 5], calm: 0.5 }), 0.7);
    const f = st(n);
    scatter(f, r, 3, (rr) => S.creak(rr, undefined, 1), { g: [0.1, 0.22], spacing: [9, 14] });
    scatter(f, r, 1, (rr) => S.gull(rr, 1), { g: [0.05, 0.07], pan: [-0.8, -0.3] });
    mix(o, f, 1);
    mix(o, wet(o, { t60: 1.3, size: 1.3, damp: 3500, seed: 11 }), 0.25);
    return o;
  } },
  // B1: reed hiss in a light wind, shallow water
  reeds: { seed: 202, target: -32, desc: "reeds hissing and rustling in a light wind, shallow water moving", build(n, r) {
    const o = st(n);
    const wd = S.wind(n, r, { low: 0.5, whistle: 0.08, hiss: 0.15, gustCycles: [3, 9], calm: 0.3 });
    const gust = wd.gust;
    mix(o, S.rustle(n, r, gust, { rate: 520, lo: 2600, hi: 8000, amp: 0.8 }), 1);
    for (let c = 0; c < 2; c++) {
      const h = white(n, r);
      filt(h, "hp", 3200, 0.7, { loop: 1 });
      filt(h, "lp", 9500, 0.7, { loop: 1 });
      mul(h, gust);
      add(o[c], h, 0.07);
    }
    mix(o, wd, 0.8);
    scatter(o, r, 9, (rr) => S.lap(rr, 1), { g: [0.12, 0.35], spacing: [2.5, 5] });
    mix(o, wet(o, { t60: 0.9, size: 1.1, damp: 4000, seed: 12 }), 0.15);
    return o;
  } },
  // B2-B5 outdoors: wind layers, grass hiss, distant thunder
  plain: { seed: 303, target: -31, desc: "layered wind rising and falling, grass hiss, thunder far off", build(n, r) {
    const o = st(n);
    const w = S.wind(n, r, { low: 1.2, whistle: 0.35, hiss: 0.35, gustCycles: [3, 9], calm: 0.2 });
    mix(o, w, 1);
    mix(o, S.rustle(n, r, w.gust, { rate: 300, lo: 3000, hi: 9000, amp: 0.45 }), 1);
    const t = st(n);
    scatter(t, r, 2, (rr) => S.farThunder(rr, undefined, 1), { g: [0.25, 0.45], spacing: [15, 20] });
    mix(o, t, 1);
    mix(o, wet(t, { t60: 3, size: 2, damp: 1200, seed: 13 }), 0.6);
    return o;
  } },
  // B5, D1: the machine hum rising from below
  shaft: { seed: 404, target: -32, desc: "a deep machine hum rising from below, far metal knocks in a big shaft, air moving", build(n, r, use) {
    const o = st(n);
    for (let c = 0; c < 2; c++) {
      add(o[c], S.hum(n, r, 49, [[1, 1], [2, 0.55], [3, 0.3], [4, 0.18], [6, 0.08], [8, 0.04]], 0.22));
      const b = S.hum(n, r, 49.4, [[1, 0.5], [3, 0.2]], 0.12);
      add(o[c], b);
      const rum = pink(n, r);
      filt(rum, "lp", 110, 0.8, { loop: 1 });
      mul(rum, shape(lfo(n, r, 2, 6, 4), 0.5, 1));
      add(o[c], rum, 1.6);
      const air = pink(n, r);
      filt(air, "bp", shape(lfo(n, r, 1, 3, 3), 260, 620), 1.2, { loop: 1 });
      add(o[c], air, 0.25);
    }
    const hit = use("kenney", "impactMetal_heavy_001.ogg");
    const knocks = st(n);
    scatter(knocks, r, 3, (rr) => rate(onset(hit), rr.range(0.42, 0.55)), { g: [0.02, 0.05], spacing: [10, 13] });
    lowpass(knocks, 2500);
    mix(o, knocks, 0.4);
    mix(o, wet(knocks, { t60: 3.8, size: 2.2, damp: 2000, seed: 14 }), 1.2);
    mix(o, S.wind(n, r, { low: 0.35, whistle: 0.12, hiss: 0.05, gustCycles: [2, 6], calm: 0.4 }), 0.5);
    return o;
  } },
  // C1: murmur with no words, hammering, steam, furnace, a freighter horn
  market: { seed: 505, target: -30, desc: "a market murmur with no words, hammering at a forge, steam, a furnace roar, a far freighter horn, all inside a huge space", build(n, r, use) {
    const o = st(n);
    mix(o, S.murmur(n, r, 12), 0.9);
    const hs = [use("kenney", "impactMetal_medium_000.ogg"), use("kenney", "impactPlate_medium_001.ogg"), use("kenney", "impactMetal_medium_003.ogg")];
    const ham = st(n);
    let t = Math.floor(r() * n);
    for (let g = 0; g < 5; g++) {
      const clip = onset(r.pick(hs)), rt = r.range(0.8, 1.05), pan = r.range(-0.8, 0.8);
      const strikes = Math.floor(r.range(3, 7)), gap = r.range(0.42, 0.56);
      for (let s = 0; s < strikes; s++) panAdd(ham[0], ham[1], rate(clip, rt * r.range(0.98, 1.02)), (t + sec(s * gap * r.range(0.97, 1.03))) % n, r.range(0.03, 0.05) * (s === 0 ? 1.1 : 1), pan, true);
      t = (t + sec(r.range(5.5, 9))) % n;
    }
    lowpass(ham, 5000);
    mix(o, ham, 1);
    scatter(o, r, 3, (rr) => S.steam(rr, undefined, 1), { g: [0.04, 0.08], spacing: [10, 14] });
    const f = S.fire(n, r, { roar: 1, crackle: 0.2, rate: 5 });
    mix(o, [f[0], scale(f[1], 0.4)], 0.18);
    const h = st(n);
    scatter(h, r, 1, (rr) => S.horn(rr, 3.6, 55, 1), { g: [0.1, 0.1], pan: [0.3, 0.5] });
    lowpass(h, 700);
    mix(o, h, 0.6);
    mix(o, wet(o, { t60: 2.4, size: 1.7, damp: 3000, seed: 15 }), 0.5);
    return o;
  } },
  // C2: room tone, a clock, paper
  archive: { seed: 606, target: -41, desc: "a quiet reading room: room tone, a slow clock, now and then a page", build(n, r, use) {
    const o = st(n);
    for (let c = 0; c < 2; c++) {
      const x = pink(n, r);
      filt(x, "lp", 650, 0.7, { loop: 1 });
      filt(x, "hp", 60, 0.7, { loop: 1 });
      add(o[c], x, 0.08);
    }
    const tap = onset(use("kenney", "impactWood_light_000.ogg"));
    const tick = S.tickFrom(rate(tap, 2.5)), tock = S.tickFrom(rate(tap, 2.1));
    const cl = st(n);
    for (let s = 0; s < BED_LEN; s++) panAdd(cl[0], cl[1], s % 2 ? tock : tick, sec(s + 0.013 * (s % 3)), 0.02, 0.35, true);
    lowpass(cl, 4500);
    mix(o, cl, 1);
    const paper = use("legacy", "world-v1/paper-open.wav");
    scatter(o, r, 2, (rr) => rate(paper, rr.range(0.85, 1)), { g: [0.02, 0.03], spacing: [15, 19], pan: [-0.6, -0.2] });
    mix(o, wet(o, { t60: 0.9, size: 0.8, damp: 3500, seed: 16 }), 0.35);
    return o;
  } },
  // C3: fluorescent hum
  waiting: { seed: 707, target: -38, desc: "a waiting room under fluorescent tubes: the hum and buzz, a flicker now and then, far lift machinery", build(n, r) {
    const o = st(n);
    const bz = S.buzz(n, r, 100, 1);
    // two flickers: short dropouts and stutters
    const gate = new Float32Array(n).fill(1);
    for (let f = 0; f < 2; f++) {
      const at = Math.floor(r() * n);
      for (let k = 0; k < 6; k++) {
        const s = at + sec(k * r.range(0.04, 0.09)), m = sec(r.range(0.01, 0.04));
        for (let i = 0; i < m; i++) gate[(s + i) % n] = 0.1;
      }
    }
    smooth(gate, 200, { loop: 1 });
    mul(bz, gate);
    monoTo(o, bz, 0.06, -0.2);
    const h = S.hum(n, r, 100, [[1, 1], [2, 0.4], [3, 0.2]], 0.06);
    mul(h, gate);
    monoTo(o, h, 1, 0.1);
    for (let c = 0; c < 2; c++) {
      const x = pink(n, r);
      filt(x, "lp", 900, 0.7, { loop: 1 });
      add(o[c], x, 0.05);
      add(o[c], S.hum(n, r, 44, [[1, 1], [2, 0.4]], 0.03));
    }
    mix(o, wet(o, { t60: 0.8, size: 0.9, damp: 4000, seed: 17 }), 0.3);
    return o;
  } },
  // D2, D3: rain on metal and stone, gusts, a pennant flapping (thunder comes from the runtime)
  storm: { seed: 808, target: -29, desc: "heavy rain on metal and stone, gusting wind, a pennant snapping; thunder is added live after each flash", build(n, r) {
    const o = st(n);
    mix(o, S.rain(n, r, { density: 1100, bright: 1, body: 1 }), 0.9);
    scatter(o, r, 260, (rr) => S.plink(rr, 1), { g: [0.01, 0.05], pan: [-1, 1] });
    const w = S.wind(n, r, { low: 1.1, whistle: 0.35, hiss: 0.3, gustCycles: [4, 11], calm: 0.25 });
    mix(o, w, 0.9);
    scatter(o, r, 6, (rr) => S.flap(rr, undefined, 1), { g: [0.05, 0.12], spacing: [4, 8] });
    mix(o, wet(o, { t60: 1.2, size: 1.4, damp: 3000, seed: 18 }), 0.2);
    return o;
  } },
  // D2 alcove: rain on glass, from inside
  alcove: { seed: 909, target: -34, desc: "sheltered: rain on the glass, muffled downpour outside, drops tapping and trickling", build(n, r) {
    const o = st(n);
    const rn = S.rain(n, r, { density: 400, bright: 0.5, body: 1 });
    lowpass(rn, 1100);
    mix(o, rn, 1.1);
    scatter(o, r, 220, (rr) => {
      const n2 = sec(0.05);
      const f = rr.range(2600, 6000);
      const x = chirp(n2, f, f * 0.98, 1, SR, rr() * 6);
      mul(x, env(n2, 0.0004, 0.008));
      return x;
    }, { g: [0.005, 0.03], pan: [-0.9, 0.9] });
    scatter(o, r, 60, (rr) => S.bubble(rr, rr.range(900, 2400), rr.range(0.01, 0.03), 1), { g: [0.005, 0.015] });
    for (let c = 0; c < 2; c++) {
      const x = pink(n, r);
      filt(x, "lp", 400, 0.7, { loop: 1 });
      add(o[c], x, 0.05);
    }
    mix(o, wet(o, { t60: 0.7, size: 0.7, damp: 4500, seed: 19 }), 0.3);
    return o;
  } },
  // D4 after the break, E1, E2, E4: wind dying away, drips
  dusk: { seed: 1010, target: -36, desc: "after the storm: a soft wind with long lulls, water dripping off stone and metal", build(n, r) {
    const o = st(n);
    mix(o, S.wind(n, r, { low: 0.55, whistle: 0.06, hiss: 0.12, gustCycles: [2, 5], calm: 0.05 }), 1);
    const d = st(n);
    scatter(d, r, 20, (rr) => S.drip(rr, 1), { g: [0.03, 0.12], pan: [-0.8, 0.8] });
    mix(o, d, 1);
    mix(o, wet(d, { t60: 1.4, size: 1.2, damp: 5000, seed: 20 }), 0.6);
    return o;
  } },
  // E3: a big stone room: a long reverb tail, candle hiss
  chapel: { seed: 1111, target: -40, desc: "a large stone chapel: deep air and a long reverb tail, candles hissing, the building settling", build(n, r) {
    const o = st(n);
    const dry = st(n);
    for (let c = 0; c < 2; c++) {
      const x = pink(n, r);
      filt(x, "lp", 380, 0.7, { loop: 1 });
      filt(x, "hp", 35, 0.7, { loop: 1 });
      add(o[c], x, 0.12);
    }
    mix(dry, S.fire(n, r, { roar: 0.05, crackle: 0.12, rate: 2.5 }), 0.5);
    scatter(dry, r, 1, (rr) => S.creak(rr, 1.2, 1), { g: [0.04, 0.04] });
    mix(o, dry, 0.5);
    const air = st(n);
    for (let c = 0; c < 2; c++) {
      const x = pink(n, r);
      filt(x, "bp", 700, 0.6, { loop: 1 });
      mul(x, shape(lfo(n, r, 1, 4, 3), 0.4, 1));
      add(air[c], x, 0.05);
    }
    mix(air, dry, 1);
    mix(o, wet(air, { t60: 5.5, size: 2.4, damp: 2600, pre: 0.04, seed: 21 }), 0.9);
    return o;
  } },
  // A3: stove, kettle, clock
  lodge: { seed: 1212, target: -34, desc: "a small warm room: the stove ticking and crackling, a kettle simmering, a clock, wind outside the walls", build(n, r, use) {
    const o = st(n);
    const f = S.fire(n, r, { roar: 0.6, crackle: 0.9, rate: 6 });
    mix(o, [f[0], scale(f[1], 0.45)], 0.35);
    monoTo(o, S.simmer(n, r, 1), 0.3, 0.5);
    const tap = onset(use("kenney", "impactWood_light_002.ogg"));
    const tick = S.tickFrom(rate(tap, 2.2)), tock = S.tickFrom(rate(tap, 1.85));
    const cl = st(n);
    for (let s = 0; s < BED_LEN; s++) panAdd(cl[0], cl[1], s % 2 ? tock : tick, sec(s), 0.035, -0.3, true);
    lowpass(cl, 5000);
    mix(o, cl, 1);
    const w = S.wind(n, r, { low: 0.6, whistle: 0.05, hiss: 0, gustCycles: [3, 8], calm: 0.3 });
    lowpass(w, 380);
    mix(o, w, 0.5);
    scatter(o, r, 2, (rr) => S.creak(rr, undefined, 1), { g: [0.04, 0.07], spacing: [14, 20] });
    mix(o, wet(o, { t60: 0.6, size: 0.6, damp: 5000, seed: 22 }), 0.25);
    return o;
  } },
};

function beds() {
  for (const [id, b] of Object.entries(BEDS)) {
    if (onlyId && onlyId !== id) continue;
    const r = rng(b.seed);
    const n = sec(BED_LEN);
    const sources = [];
    const use = (pack, file) => {
      const x = src(pack, file);
      sources.push(x.info);
      return x;
    };
    const o = b.build(n, r, use);
    for (const c of o) filt(c, "hp", 28, 0.7, { loop: 2 });
    level(o, b.target, -8);
    const wav = join(TMP, `bed-${id}.wav`);
    writeWav(wav, o, SR, b.seed);
    encodeBed(wav, join(OUT, "beds", id), { opus: 48, aac: 64 });
    record(`beds/${id}`, {
      kind: "bed",
      files: { opus: fileInfo(join(OUT, "beds", `${id}.opus`)), m4a: fileInfo(join(OUT, "beds", `${id}.m4a`)) },
      seconds: BED_LEN,
      channels: 2,
      loop: true,
      peakDbFS: +todb(peak(o)).toFixed(1),
      rmsDbFS: +todb(rms(o)).toFixed(1),
      loopSeam: +seam(o).toFixed(2),
      describes: b.desc,
      provenance: `Original deterministic synthesis (seed ${b.seed}), built as an exact ${BED_LEN} s loop${sources.length ? "; recorded CC0 hits layered in, processed" : ""}.`,
      sources,
    });
    console.log(`bed ${id}: rms ${todb(rms(o)).toFixed(1)} peak ${todb(peak(o)).toFixed(1)} seam ${seam(o).toFixed(2)}`);
  }
}

// --- effects -------------------------------------------------------------------------------------

/** Normalise a mono clip so its loud part (95th percentile of 20 ms frames) sits at `target` dBFS. */
function loudTo(x, target) {
  return scale(x, db(target) / Math.max(1e-9, loud(x)));
}
function mono(x) {
  return x;
}
function withTail(x, o) {
  const [l, r] = reverb([x], { ...o, tail: o.tail ?? o.t60 });
  const out = new Float32Array(l.length);
  for (let i = 0; i < l.length; i++) out[i] = (x[i] ?? 0) + (l[i] + r[i]) * 0.5 * (o.mix ?? 0.3);
  const fo = sec(0.2);
  for (let i = 0; i < fo; i++) out[out.length - 1 - i] *= i / fo;
  return out;
}

// Copies of the legacy effects (original offline synthesis; CC0 recorded steps are in steps/)
const LEGACY_SFX = ["slash-1", "slash-2", "hit-metal", "cable-cut", "paper-open", "paper-cut", "lift-start", "lift-dock", "telegraph", "landing", "hurt", "confirm"];

const SFX = {
  // bells (WORLD-PLAN section 9 "still missing")
  "bell-chapel": { sr: 32000, desc: "the chapel bell: deep, long", build: (r) => S.bell(r, { f: 196, decay: 4.2, dur: 4.6, bright: 0.6, amp: 1, sr: 32000 }), loud: -16 },
  "bell-rib": { sr: 32000, desc: "the rib bell on the causeway: mid, weathered", build: (r) => S.bell(r, { f: 330, decay: 2.6, dur: 3.2, bright: 0.8, amp: 1, sr: 32000 }), loud: -17 },
  "bell-ferry": { sr: 32000, desc: "the ferry bell: small and bright", build: (r) => S.bell(r, { f: 740, decay: 1.4, dur: 2, bright: 1, amp: 1, sr: 32000 }), loud: -18 },
  // water
  "splash-1": { desc: "a splash into shallow water", build: (r) => S.splash(r, { size: 1 }), loud: -18 },
  "splash-2": { desc: "a small splash", build: (r) => S.splash(r, { size: 0.5 }), loud: -20 },
  // cloth
  "cloth-1": { desc: "a cloth swish", build: (r) => S.swish(r, 0.3, 1, 600, 2400), loud: -22 },
  "cloth-2": { desc: "a heavier cloth swish", build: (r) => S.swish(r, 0.42, 1, 400, 1800), loud: -22 },
  "cloth-tear": { desc: "cloth tearing", build: (r) => S.tear(r, 0.45), loud: -20 },
  "cloth-flap": { desc: "a banner flapping", build: (r) => S.flap(r, 1, 1), loud: -22 },
  // glass (recorded CC0, processed)
  "glass-hit": { desc: "a light knock on glass", build: (r, use) => trim(onset(use("kenney", "impactGlass_light_001.ogg")), 0.2, 0.05), loud: -20 },
  "glass-shatter": { desc: "a pane shattering, then tinkling pieces", build: (r, use) => {
    const h = onset(use("kenney", "impactGlass_heavy_001.ogg"));
    const t = [use("kenney", "impactGlass_light_000.ogg"), use("kenney", "impactGlass_light_002.ogg"), use("kenney", "impactGlass_light_004.ogg")].map(onset);
    const x = zeros(sec(1.2));
    add(x, h, 1);
    for (let i = 0; i < 9; i++) add(x, rate(r.pick(t), r.range(1.1, 1.8)), r.range(0.1, 0.35) * (1 - i / 12), sec(0.12 + i * r.range(0.05, 0.1)));
    return trim(x, 1.2, 0.2);
  }, loud: -16 },
  "shard-reassemble": { desc: "shards flying back and setting (the stained glass healing): tinkles in reverse, rising, a soft chime", build: (r, use) => {
    const t = [use("kenney", "impactGlass_light_001.ogg"), use("kenney", "impactGlass_light_003.ogg")].map(onset);
    const n = sec(1.1);
    const x = zeros(n);
    for (let i = 0; i < 10; i++) add(x, reverse(rate(r.pick(t), r.range(1.4, 2.2))), r.range(0.08, 0.2) * (0.4 + i / 10), sec(0.05 + i * 0.07));
    const c = chirp(sec(0.7), 1200, 2400, 0.05);
    for (let i = 0; i < c.length; i++) c[i] *= Math.sin((Math.PI * i) / c.length) ** 2;
    add(x, c, 1, sec(0.2));
    const bell = S.bell(r, { f: 1480, decay: 0.8, dur: 0.9, bright: 0.5, amp: 0.25 });
    add(x, bell, 1, sec(0.82));
    return trim(withTail(x, { t60: 1.2, size: 0.9, damp: 7000, mix: 0.3 }), 2, 0.3);
  }, loud: -22 },
  // the colossus
  "colossus-footfall": { sr: 24000, desc: "the colossus's foot coming down: a sub-bass thud, then a long wash", build: (r) => S.footfall(r, { dur: 5, amp: 1, sr: 24000 }), loud: -14, sr0: 24000 },
  // horn and crank
  horn: { sr: 24000, desc: "the causeway horn: long and low", build: (r) => S.horn(r, 3, 82, 1, 24000), loud: -16, sr0: 24000 },
  crank: { desc: "the rose-window crank: a ratchet turning a heavy gear", build: (r, use) => {
    const click = trim(rate(onset(use("kenney", "impactMetal_light_002.ogg")), 1.7), 0.04, 0.02);
    return S.crank(r, click, { clicks: 9, dur: 1.3, amp: 1 });
  }, loud: -20 },
  // doors, locks, levers (recorded CC0, processed)
  "door-open": { desc: "a wooden door opening", build: (r, use) => trim(onset(use("sfx100", "sfx100v2_door_01.ogg")), 0.42, 0.08), loud: -20 },
  "door-close": { desc: "a wooden door closing", build: (r, use) => trim(onset(use("sfx100", "sfx100v2_door_03.ogg")), 0.7, 0.15), loud: -19 },
  "door-rattle": { desc: "a latched door rattling", build: (r, use) => trim(onset(use("sfx100", "sfx100v2_door_05.ogg")), 0.32, 0.06), loud: -21 },
  unlatch: { desc: "a latch lifting", build: (r, use) => trim(onset(use("sfx100", "sfx100v2_lock_open_01.ogg")), 0.62, 0.1), loud: -21 },
  "lever-pull": { desc: "a heavy lever thrown", build: (r, use) => {
    const s = onset(use("sfx100", "sfx100v2_switch_01.ogg"));
    const m = onset(use("kenney", "impactMetal_heavy_001.ogg"));
    const x = zeros(sec(0.6));
    add(x, s, 0.7);
    add(x, rate(m, 0.75), 0.6, sec(0.09));
    return trim(x, 0.6, 0.15);
  }, loud: -18 },
  // hits and breaks by material (recorded CC0, processed)
  "wood-knock": { desc: "a knock on wood", build: (r, use) => trim(onset(use("kenney", "impactWood_light_000.ogg")), 0.25, 0.05), loud: -21 },
  "wood-hit": { desc: "a blow on wood", build: (r, use) => trim(onset(use("kenney", "impactWood_medium_001.ogg")), 0.32, 0.06), loud: -19 },
  "wood-break": { desc: "wood splintering", build: (r, use) => {
    const a = onset(use("kenney", "impactWood_heavy_002.ogg"));
    const b = onset(use("kenney", "impactPlank_medium_001.ogg"));
    const x = zeros(sec(0.8));
    add(x, a, 1);
    add(x, b, 0.6, sec(0.05));
    return trim(x, 0.8, 0.2);
  }, loud: -17 },
  "stone-hit": { desc: "a blow on stone", build: (r, use) => trim(onset(use("kenney", "impactMining_001.ogg")), 0.35, 0.1), loud: -19 },
  "stone-break": { desc: "stone cracking and falling in pieces", build: (r, use) => {
    const a = onset(use("kenney", "impactMining_003.ogg"));
    const b = onset(use("sfx100", "sfx100v2_stones_02.ogg"));
    const x = zeros(sec(1));
    add(x, a, 0.8);
    add(x, b, 0.9, sec(0.08));
    return trim(x, 1, 0.25);
  }, loud: -16 },
  "metal-hit": { desc: "a blow on metal", build: (r, use) => trim(onset(use("kenney", "impactMetal_medium_000.ogg")), 0.27, 0.05), loud: -20 },
  "metal-heavy": { desc: "a heavy metal clank", build: (r, use) => trim(onset(use("kenney", "impactMetal_heavy_001.ogg")), 0.36, 0.08), loud: -18 },
  clink: { desc: "a small tin clink", build: (r, use) => trim(onset(use("kenney", "impactTin_medium_000.ogg")), 0.16, 0.04), loud: -22 },
  chain: { desc: "a chain rattling", build: (r, use) => {
    const t = [use("kenney", "impactTin_medium_001.ogg"), use("kenney", "impactTin_medium_003.ogg")].map(onset);
    const x = zeros(sec(0.6));
    for (let i = 0; i < 6; i++) add(x, rate(r.pick(t), r.range(1.1, 1.6)), r.range(0.4, 1) * (1 - i / 8), sec(i * r.range(0.05, 0.08)));
    return trim(x, 0.6, 0.15);
  }, loud: -21 },
  thud: { desc: "a soft heavy thud (earth, luggage, a sack)", build: (r, use) => trim(onset(use("kenney", "impactSoft_heavy_000.ogg")), 0.4, 0.1), loud: -18 },
  "leaf-rustle": { desc: "leaves and straw rustling", build: (r, use) => trim(onset(use("tinyworlds", "leaves01.ogg")), 0.39, 0.08), loud: -24 },
  "bench-sit": { desc: "sitting down on a wooden bench", build: (r, use) => {
    const a = onset(use("kenney", "impactWood_light_003.ogg"));
    const x = zeros(sec(0.4));
    add(x, rate(a, 0.72), 1);
    add(x, S.swish(r, 0.25, 0.4, 400, 1200), 0.4, sec(0.02));
    return trim(x, 0.4, 0.1);
  }, loud: -23 },
  // flame and light
  "flame-light": { desc: "a wick or lamp catching: a soft whump", build: (r) => {
    const n = sec(0.5);
    const x = pink(n, r);
    const f = new Float32Array(n);
    for (let i = 0; i < n; i++) f[i] = 300 + 1600 * Math.sin((Math.PI * i) / n);
    filt(x, "bp", f, 0.7);
    const e = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      e[i] = t < 0.18 ? Math.pow(t / 0.18, 2) : Math.pow(1 - (t - 0.18) / 0.82, 2);
    }
    mul(x, e);
    return x;
  }, loud: -24 },
  "flame-gutter": { desc: "a flame guttering in a draught", build: (r) => S.flap(r, 0.6, 0.6), loud: -28 },
  "neon-buzz": { desc: "a neon sign buzzing on", build: (r) => S.neonBuzz(r, 0.6, 1), loud: -26 },
  "neon-spark": { desc: "a neon tube sparking", build: (r) => trim(S.tear(r, 0.18, 1), 0.18, 0.04), loud: -22 },
  "grit-sift": { desc: "grit sifting down from the ceiling", build: (r) => S.sift(r, 1.4, 1), loud: -30 },
  whoosh: { desc: "a quick air whoosh (dash, jump)", build: (r, use) => trim(onset(use("sfx100", "sfx100v2_air_03.ogg")), 0.28, 0.08), loud: -22 },
};

function sfx() {
  for (const id of LEGACY_SFX) {
    if (onlyId && onlyId !== id) continue;
    const to = join(OUT, "sfx", `${id}.wav`);
    copyFileSync(join(LEGACY, `world-v1/${id}.wav`), to);
    const x = decode(to);
    record(`sfx/${id}`, { kind: "sfx", files: { wav: fileInfo(to) }, seconds: +(x[0].length / SR).toFixed(3), peakDbFS: +todb(peak(x)).toFixed(1), provenance: "Original offline synthesis from the legacy world-v1 set (confirm: derived from the original soft motif instrument); bytes unchanged.", sources: [{ pack: "legacy", file: `world-v1/${id}.wav`, license: "original, dex.place" }], listening: ["hurt", "paper-cut", "telegraph"].includes(id) ? "pending" : "reviewed in the 2026-09-08 playtest" });
  }
  let seed = 5000;
  for (const [id, s] of Object.entries(SFX)) {
    seed += 17;
    if (onlyId && onlyId !== id) continue;
    const r = rng(seed);
    const sources = [];
    const use = (pack, file) => {
      const x = src(pack, file);
      sources.push(x.info);
      return x;
    };
    let x = s.build(r, use);
    const sr = s.sr ?? SR;
    if (s.sr && !s.sr0 && sr !== SR) {
      // bells are built at their own rate already
    }
    // peak-safe level
    loudTo(x, s.loud);
    const p = peak([x]);
    if (p > db(-1)) scale(x, db(-1) / p);
    // a 12 ms guard fade at the end, so a clip cut while still sounding never clicks
    const fo = Math.min(x.length, Math.round(sr * 0.012));
    for (let i = 0; i < fo; i++) x[x.length - 1 - i] *= i / fo;
    const to = join(OUT, "sfx", `${id}.wav`);
    writeWav(to, [x], sr, seed);
    record(`sfx/${id}`, {
      kind: "sfx",
      files: { wav: fileInfo(to) },
      seconds: +(x.length / sr).toFixed(3),
      sampleRate: sr,
      peakDbFS: +todb(peak([x])).toFixed(1),
      loudDbFS: +todb(loud(x, sr)).toFixed(1),
      describes: s.desc,
      provenance: sources.length ? "CC0 recordings, processed (mono, trimmed, fixed gain; layered where listed)." : `Original deterministic synthesis (seed ${seed}).`,
      sources,
    });
  }
}

// --- footsteps --------------------------------------------------------------------------------

// Per surface, two contacts (the runtime alternates them). One fixed gain per
// material, set so its loud part matches the reference (the stone pair Dex heard
// in the 2026-09-08 playtest); no per-hit normalisation, so the recorded
// variation between the two contacts stays.
const REF_LOUD = -36;
const STEPS = {
  stone: { rel: 0, legacy: ["world-v1/recorded-steps-v1/step-concrete-1.wav", "world-v1/recorded-steps-v1/step-concrete-2.wav"] },
  wood: { rel: 0.5, kenney: ["footstep_wood_001.ogg", "footstep_wood_004.ogg"], len: 0.22 },
  earth: { rel: -1.5, kenney: ["footstep_grass_001.ogg", "footstep_grass_002.ogg"], len: 0.34 },
  tile: { rel: 0.5, kenney: ["footstep_concrete_000.ogg", "footstep_concrete_004.ogg"], post: (x) => filt(x, "hs", 3500, 0.7, { gain: 3 }), room: true },
  rug: { rel: -5, kenney: ["footstep_carpet_000.ogg", "footstep_carpet_003.ogg"], len: 0.16 },
  grating: { rel: 3, legacy: ["world-v1/recorded-steps-v1/step-metal-1.wav", "world-v1/recorded-steps-v1/step-metal-2.wav"] },
  metal: { rel: 2, legacy: ["world-v1/recorded-steps-v1/step-metal-1.wav", "world-v1/recorded-steps-v1/step-metal-2.wav"], post: (x) => filt(filt(x, "lp", 3200, 0.7), "peak", 240, 1.2, { gain: 3 }) },
  water: { rel: 2.5, sfx100: ["sfx100v2_footstep_wet_02.ogg", "sfx100v2_footstep_wet_03.ogg"], slosh: true },
  "wet-metal": { rel: 2.5, legacy: ["world-v1/recorded-steps-v1/step-metal-1.wav", "world-v1/recorded-steps-v1/step-metal-2.wav"], wet: ["sfx100v2_footstep_wet_01.ogg", "sfx100v2_footstep_wet_02.ogg"] },
};

function steps() {
  for (const [surface, s] of Object.entries(STEPS)) {
    if (onlyId && onlyId !== surface) continue;
    const per = [[], []];
    let cur = 0;
    const use = (pack, file) => {
      const x = src(pack, file);
      per[cur].push(x.info);
      return x;
    };
    const r = rng(9000 + surface.length * 31);
    const pack = s.kenney ? "kenney" : s.sfx100 ? "sfx100" : "legacy";
    const files = s.kenney ?? s.sfx100 ?? s.legacy;
    let clips = files.map((f, i) => {
      cur = i;
      return onset(use(pack, f), -45);
    });
    clips = clips.map((c, i) => {
      cur = i;
      let x = s.len ? trim(c, s.len, 0.05) : Float32Array.from(c);
      if (s.post) x = s.post(x);
      if (s.slosh) {
        const sl = S.lap(r, 1);
        filt(sl, "lp", 1200, 0.7);
        const y = zeros(Math.max(x.length, sl.length));
        add(y, x, 1);
        add(y, sl, 0.15 * loud(x) / Math.max(1e-6, loud(sl)), sec(0.01));
        x = trim(y, 0.42, 0.1);
      }
      if (s.wet) {
        const w = onset(use("sfx100", s.wet[i]));
        const y = zeros(Math.max(x.length, w.length));
        add(y, x, 1);
        add(y, w, 0.35 * loud(x) / Math.max(1e-6, loud(w)));
        x = trim(y, 0.4, 0.08);
      }
      if (s.room) {
        const tail = withTail(x, { t60: 0.35, size: 0.4, damp: 6000, mix: 0.12 });
        x = trim(tail, Math.min(0.3, tail.length / SR), 0.08);
      }
      return x;
    });
    // one gain for the pair
    const mean = (loud(clips[0]) + loud(clips[1])) / 2;
    const g = db(REF_LOUD + s.rel) / mean;
    clips.forEach((x, i) => {
      scale(x, g);
      const to = join(OUT, "steps", `${surface}-${i + 1}.wav`);
      writeWav(to, [x], SR, 77 + i);
      record(`steps/${surface}-${i + 1}`, {
        kind: "step",
        surface,
        files: { wav: fileInfo(to) },
        seconds: +(x.length / SR).toFixed(3),
        peakDbFS: +todb(peak([x])).toFixed(1),
        loudDbFS: +todb(loud(x)).toFixed(1),
        materialGainDb: +todb(g).toFixed(1),
        provenance: `CC0 recorded footstep${s.slosh ? " with a synthesised water slosh under it" : ""}${s.wet ? " with a CC0 wet step layered in" : ""}${s.post ? ", EQ" : ""}${s.room ? ", a short room" : ""}; one fixed gain for the pair, no per-hit normalisation.`,
        sources: per[i],
      });
    });
  }
}

// --- attribution notes -------------------------------------------------------------------------

function attributions() {
  const cc0 = Object.entries(PACKS)
    .filter(([k]) => k !== "legacy")
    .map(([, p]) => `- **${p.creator}**, *${p.title}*. License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). [Source](${p.page})`)
    .join("\n");
  writeFileSync(
    join(OUT, "ATTRIBUTION.md"),
    `# dex.place world audio

What is here and where it came from. \`manifest.json\` lists every file with its size, SHA-256,
levels, what it is for, and the exact source files (with their SHA-256) for anything derived from a
recording. Everything is **listening-pending** until Dex approves it by ear, except the theme,
which Dex chose.

## Music (\`music/\`)

- \`theme-b\`: the original dex.place theme, arrangement produced with Suno and selected by Dex.
  Used under Suno's paid-download terms; not CC0 and not a redistributable asset. See
  \`music/ATTRIBUTION-theme-b.md\` (copied unchanged from the legacy set).
- \`arena-chamber\`: an original dex.place motif for strings and cello, rendered with FluidSynth
  2.6.0 and GeneralUser GS 2.0.3 by S. Christian Collins (its licence permits recordings; the
  SoundFont is not distributed). Licences: \`music/GeneralUser-GS-LICENSE.txt\`,
  \`music/FluidSynth-LICENSE.txt\`. A stand-in for the arena until an orchestral B exists.

## Ambience beds (\`beds/\`)

Original deterministic synthesis for dex.place (seeded, no external samples), built as exact
loops by \`src/world/sound/build/build.mjs\`. Three beds layer processed CC0 hits from Kenney's
Impact Sounds (the shaft's far knocks, the market's hammering, the clocks in the lodge and the
archive), and the archive's page turns reuse the original \`paper-open\` effect. \`exterior\` and
\`interior\` are the legacy beds, unchanged (original synthesis).

## Effects (\`sfx/\`) and footsteps (\`steps/\`)

- The legacy effects (\`slash-*\`, \`hit-metal\`, \`cable-cut\`, \`paper-*\`, \`lift-*\`, \`telegraph\`,
  \`landing\`, \`hurt\`, \`confirm\`): original offline synthesis, unchanged.
- Bells, splashes, cloth, the horn, the colossus's footfall, flame, neon and grit: original
  deterministic synthesis.
- Glass, doors, the latch, the lever, wood, stone and metal hits, the chain, the thud, leaves,
  the crank's pawl and the whoosh: processed derivatives (mono, trimmed, fixed gain, some layered
  or pitched) of these CC0 recordings:

${cc0}

- Footsteps: stone is the legacy Kenney concrete pair; grating, metal and wet metal derive from
  **SoftDistortionFX, Metal Footsteps** ([CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/),
  [source](https://freesound.org/people/SoftDistortionFX/sounds/398937/)), as in the legacy
  \`recorded-steps-v1/ATTRIBUTION.md\`; wood, earth, tile and rug are Kenney's; water is
  rubberduck's wet steps with a synthesised slosh. One fixed gain per material, no per-hit
  normalisation.

CC0 needs no credit; it is given anyway.
`,
  );
}

if (!only || only === "music") music();
if (!only || only === "beds") beds();
if (!only || only === "sfx") sfx();
if (!only || only === "steps") steps();
attributions();
// drop entries whose files no longer exist
for (const [id, e] of Object.entries(manifest.entries)) {
  const ok = Object.keys(e.files).every((ext) => existsSync(join(OUT, `${id}.${ext}`)));
  if (!ok) delete manifest.entries[id];
}
manifest.entries = Object.fromEntries(Object.entries(manifest.entries).sort(([a], [b]) => a.localeCompare(b)));
let total = 0;
for (const e of Object.values(manifest.entries)) for (const f of Object.values(e.files)) total += f.bytes;
manifest.totalBytes = total;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
console.log(`public/audio/world: ${Object.keys(manifest.entries).length} entries, ${(total / 1e6).toFixed(2)} MB`);
if (!onlyId && !only) rmSync(TMP, { recursive: true, force: true });
