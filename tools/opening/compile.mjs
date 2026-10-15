// The opening's runtime data, compiled from the opening lane's plan (so final timings and art drop in by
// re-running this, never by editing code):
//
//   node tools/opening/compile.mjs [--lane D:\Dex\Temp\dexplace-v2\lanes\opening]
//
// Reads   <lane>\BEATS.json                      the plan's machine-readable twin (bars, beats, camera, captions ...)
//         <lane>\bones\data\ofuda_flight.json    the bones' baked flight of the talisman (60 Hz, T 0.67 to 16.6)
//         <lane>\anchor\ofuda\ofuda_flat_*.png   the talisman's faces at 96 and 192 px
// Writes  src/tesu/opening/beats.ts              numbers only (the runtime's timeline; checked in)
//         public/tesu/opening/ofuda-flight.json  the flight's centreline, delta-coded integers
//         public/tesu/opening/ofuda-*.png        the faces, copied as they are
//
// Every number is read from BEATS.json; where the plan states it in words (a "T 27.49" inside a sentence) it is
// parsed out, and a sentence that no longer says it fails the compile instead of shipping a stale number.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const LANE = resolve(arg("lane", "D:/Dex/Temp/dexplace-v2/lanes/opening"));

const B = JSON.parse(readFileSync(join(LANE, "BEATS.json"), "utf8"));

const fail = (what) => { throw new Error(`BEATS.json: ${what}`); };
/** The first number after `label` in `text` (e.g. num("... skip to T 27.49 ...", /T\s+/) -> 27.49). */
const num = (text, re, what) => {
  const m = String(text ?? "").match(new RegExp(re.source + "(-?\\d+(?:\\.\\d+)?)"));
  if (!m) fail(`no ${what} in "${String(text).slice(0, 80)}"`);
  return Number(m[1]);
};
const beat = (id) => B.beats.find((b) => b.id === id) ?? fail(`no beat ${id}`);
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// --- the music: bar lines (measured), the delivery's cut points
const bars = Object.keys(B.track.bars).map(Number).sort((a, b) => a - b).map((k) => r4(B.track.bars[k]));
const dl = B.track.delivery;
const sr = num(dl.seam, /sample \d+ at\s+/, "sample rate (kHz)") * 1000;
const track = {
  sampleRate: sr,
  seconds: B.track.seconds,
  seam: num(dl.seam, /crossing at\s+/, "seam"),
  /** Piece A: samples [0, aEnd] (inclusive); piece B from sample bFrom. */
  aEnd: num(dl.chunk_A, /samples 0 to\s+/, "piece A's last sample"),
  bFrom: num(dl.chunk_B, /from sample\s+/, "piece B's first sample"),
  /** The equal-gain join's full width, s ("Across the seam a 10 ms equal-GAIN (linear) cross-fade"). */
  fade: num(dl.join, /Across the seam a\s+/, "join width (ms)") / 1000,
  /** Piece B must be decoded by this T, else A fades over its last bar. */
  bLateT: num(dl.if_B_is_late, /by T\s+/, "piece B's deadline"),
  bLateFadeFrom: num(dl.if_B_is_late, /from\s+/, "A's fade start"),
  files: { a: ["/audio/opening/track1-a.opus", "/audio/opening/track1-a.m4a"], b: ["/audio/opening/track1-b.opus", "/audio/opening/track1-b.m4a"] },
  /** Codec priming left in by a browser's decoder (samples), per codec; CI measures it (plan section 6). */
  prime: { opus: 0, m4a: 0 },
};

// --- the camera, beat by beat (before the walk: held frames and authored moves on T)
const shots = [];
for (const b of B.beats) {
  if (b.T === null || !b.camera || b.T >= B.constants.anchor_T + 2) continue;
  const c = b.camera;
  if (c.zoom === undefined || typeof c.zoom === "string") continue;
  const pair = (v, prev) => (Array.isArray(v) ? v : v === undefined ? prev : [v, v]);
  const last = shots[shots.length - 1];
  const zoom = pair(c.zoom);
  const s = {
    from: r4(b.T),
    zoom,
    anchor: pair(c.anchor, last ? [last.anchor[1], last.anchor[1]] : undefined),
    horizon: pair(c.horizon, last ? [last.horizon[1], last.horizon[1]] : undefined),
    cx: pair(c.centre_x_H, last ? [last.cx[1], last.cx[1]] : undefined),
    moves: Array.isArray(c.zoom),
  };
  if (!s.anchor || !s.horizon || !s.cx) fail(`camera of ${b.id} is incomplete`);
  // a hold at the same framing as the shot before it adds nothing
  if (last && !s.moves && !last.moves && JSON.stringify([last.zoom, last.anchor, last.horizon, last.cx]) === JSON.stringify([s.zoom, s.anchor, s.horizon, s.cx])) continue;
  if (last && !s.moves && last.moves && last.zoom[1] === s.zoom[0] && last.cx[1] === s.cx[0] && last.anchor[1] === s.anchor[0]) {
    // the hold a move lands on
    shots.push({ ...s, from: r4(last.until ?? s.from) });
    continue;
  }
  s.until = c.until_T;
  shots.push(s);
}
const walkT = beat("C17").T;
const c17 = beat("C17").camera;
const c22 = beat("C22").camera;
const c25 = beat("C25").camera;
const c29 = beat("C29").camera;
const beatS = (bars[9] - bars[8]) / 4;
const camera = {
  shots: shots.map((s) => ({ from: s.from, to: s.moves ? r4(s.until) : null, zoom: s.zoom, anchor: s.anchor, horizon: s.horizon, cx: s.cx })),
  /** From the walk on the reveal track (keyed to her x) takes over, blended over one beat. */
  reveal: { from: r4(walkT), blend: r4(beatS), note: c17.mode.slice(0, 60) },
  whip: {
    from: r4(beat("C22").T), to: r4(c22.until_T), toZoom: c22.to_zoom,
    exp: num(c22.ease, /exponent\s+/, "whip ease exponent"),
    anchor: c22.anchor, horizon: c22.horizon,
    lead: num(c22.x, /lead\s+/, "whip lead"),
  },
  widest: { from: r4(beat("C25").T), zoom: c25.zoom, anchor: c25.anchor, horizon: c25.horizon, pin: { xH: c25.pin.x_H, at: c25.pin.at } },
  easeIn: { from: r4(beat("C29").T), to: r4(c29.until_T) },
  /** Released early (eases in) only if she has passed the tunnel's first gate. */
  releaseXH: B.constants.tunnel_first_gate_x_H,
  reduced: [],
};
// the reduced-motion holds' zooms, named in words ("postcard 0.5", "close 2x", "1x following her", "widest 1/8")
camera.reduced = B.reduced_motion.camera_holds.map((h) => {
  const t = h.hold;
  const zoom = /1\/8/.test(t) ? 0.125 : /2x/.test(t) ? 2 : /postcard\s+0\.5/.test(t) ? 0.5 : /^1x/.test(t) ? 1 : fail(`reduced hold "${t}"`);
  return { from: h.from, zoom, follow: /following/.test(t) || /^1x$/.test(t.trim()) };
});

// --- her path (the cutscene solves the walk so gate 3 passes on the crash)
const C = B.constants;
const her = {
  catchXH: C.catch_x_H,
  deckYH: C.deck_y_H,
  walkFrom: r4(walkT),
  walkHPerS: C.walk_H_per_s,
  pickup: r4(beat("C21").T),
  xPickupH: C.x_at_pickup_H,
  drop1: r4(beat("C22").T),
  xBreakH: C.x_at_break_H,
  runHPerS: C.run_H_per_s,
  runAccel: { s: C.run_accel_s_H[0], h: C.run_accel_s_H[1] },
  skid: C.skid_T,
  stop: C.stop_T,
  stopXH: C.stop_x_H,
  gates: C.gate_times_T,
};

// --- words on screen
const captions = B.beats.filter((b) => b.text?.caption).map((b) => ({ text: b.text.caption, from: r4(b.text.from), to: r4(b.text.to) }));
const tesu = beat("C25").text;
const title = {
  text: tesu.title, at: r4(beat("C25").T), hold: tesu.hold_s, fade: tesu.fade_s, maxWidth: tesu.max_width,
  after: (tesu.plane.match(/after '([a-z]+)'/) ?? fail("TESU's plane"))[1],
};
const c00 = beat("C00").ui;
const ui = {
  bars: {
    vh: num(c00.bars, /\(/, "bars' height (vh)"),
    in: num(c00.bars, /each,\s*/, "bars' slide-in"),
    out: num(beat("C22").ui.bars, /\(/, "bars' retract"),
  },
  /** Where Esc / the chip lands, and from when a return visit shows the chip. */
  skipTo: num(B.paths.skip, /resumes from T\s+/, "the skip target"),
  skipDip: num(B.paths.skip, /dips \(/, "the skip's dip"),
  chipFrom: num(B.paths.return, /from T\s+/, "the return chip"),
  chipHold: num(B.inputs.find((i) => /page fall/.test(i.state))["any key/click/tap"], /for\s+/, "the chip's hold"),
  hintAfter: num(beat("C30").ui.hint, /for\s+/, "the hand-back hint's wait"),
  handBack: r4(beat("C30").T),
  /** The mark's hold: first visit, return visit. */
  markHold: beat("L2").ui.hold_s,
  markHoldReturn: beat("L2").ui.repeat_visit_hold_s,
  slowAt: beat("L7").p,
  failAt: beat("L8").p,
  /** The continue guard (ms). */
  guardMs: num(B.inputs.find((i) => /waiting room, ready/.test(i.state)).guard, /for\s+/, "the continue guard"),
  loaderCaptions: B.loader.items.map((i) => i.caption),
  loaderCycle: B.loader.timing.cycle_s,
};

// --- the talisman's moments and the sound cues
const glints = [];
for (const b of B.beats) {
  for (const s of [...(b.effects ?? []), b.ofuda?.what ?? ""]) {
    const m = String(s).match(/glint[^.]*?(?:at|about)\s+T\s+(\d+(?:\.\d+)?)/i) ?? String(s).match(/glint \d at about T (\d+(?:\.\d+)?)/);
    if (m) glints.push(Number(m[1]));
  }
}
const sfx = [];
for (const b of B.beats) {
  if (b.T === null) continue;
  for (const s of b.sfx ?? []) {
    const m = String(s).match(/^(op\.[a-z-]+)/);
    if (m) sfx.push({ T: r4(b.T), id: m[1] });
  }
}
const ofuda = {
  /** The bake's units: chain points in 96 px from her pivot (deck y, catch x). */
  sizeAt96: [4, 10],
  glints: [...new Set(glints)].sort((a, b) => a - b),
  anchorT: C.anchor_T,
  /** Ambient wind: gusty until the hush, dead in it, the inhale swells into the drop. */
  hush: r4(beat("C19").T),
  inhale: r4(beat("C20").T),
};
const hush = { at: r4(beat("C19").T), duckDb: -num(beat("C19").sfx[0], /ducks\s+/, "the hush's duck"), over: num(beat("C19").sfx[0], /over\s+/, "the duck's time") };

const data = { rev: B.revision, schema: B.schema, bars, track, camera, her, captions, title, ui, ofuda, hush, sfx };

const banner = `// GENERATED by tools/opening/compile.mjs from the opening lane's BEATS.json (${B.schema}, ${B.revision}).\n// Do not edit by hand: change the plan and re-run \`node tools/opening/compile.mjs\`.\n\n`;
writeFileSync(join(ROOT, "src/tesu/opening/beats.ts"), `${banner}export const BEATS = ${JSON.stringify(data, null, 1)} as const;\n\nexport type Beats = typeof BEATS;\n`);

// --- the talisman's flight: per 60 Hz tick, 6 centreline points (1/8 px) and half-widths (1/100 px), delta-coded
const F = JSON.parse(readFileSync(join(LANE, "bones/data/ofuda_flight.json"), "utf8"));
const MODES = { free: "f", held: "h", drive: "d", pressed: "p", flip: "l", hat: "a" };
const frames = F.frames;
for (let i = 1; i < frames.length; i++) if (frames[i].tick !== frames[i - 1].tick + 1) fail(`flight ticks jump at ${frames[i].tick}`);
let modes = "", faces = "";
const pts = [], hw = [], depth = [];
let prevP = new Array(12).fill(0), prevW = new Array(6).fill(0), prevD = 0;
for (const f of frames) {
  modes += MODES[f.mode] ?? fail(`flight mode ${f.mode}`);
  faces += f.face === "back" ? "b" : "f";
  const p = f.chain96.flatMap((c) => [Math.round(c.p[0] * 8), Math.round(c.p[1] * 8)]);
  const w = f.chain96.map((c) => Math.round(c.half_w * 100));
  p.forEach((v, i) => pts.push(v - prevP[i]));
  w.forEach((v, i) => hw.push(v - prevW[i]));
  const d = Math.round(f.depth_px * 10);
  depth.push(d - prevD);
  prevP = p; prevW = w; prevD = d;
}
const flight = { schema: "dexplace.opening.ofuda_flight.compact/1", from: F.schema, units: "pts: 6 points (x, y) per tick in 1/8 px from her pivot (96 px scale, y down), delta-coded on the tick before; hw: half-widths in 1/100 px, delta-coded; depth: 1/10 px (+ behind her), delta-coded", hz: 60, tick0: frames[0].tick, modes, faces, pts, hw, depth };
mkdirSync(join(ROOT, "public/tesu/opening"), { recursive: true });
writeFileSync(join(ROOT, "public/tesu/opening/ofuda-flight.json"), JSON.stringify(flight));
for (const n of ["flat_front@96", "flat_back@96", "flat_front@192", "flat_back@192"]) {
  copyFileSync(join(LANE, `anchor/ofuda/ofuda_${n}.png`), join(ROOT, `public/tesu/opening/ofuda-${n.replace("flat_", "").replace("@", "-")}.png`));
}
console.log(`beats: ${shots.length} shots, ${captions.length} captions, ${sfx.length} cues, glints ${ofuda.glints.join(", ")}; flight: ${frames.length} ticks from ${frames[0].tick}`);
