// R, directed as a cut-in cinematic (lane U, 10-19). Dex: the call at its original speed ("it's an ult, it should feel
// wild"); then "during the flurry she disappears: she BECOMES the slashes that slash the letter into existence; then
// the slashes stop a moment before she dives and destroys all" (hundreds of slashes, each carving a piece of the
// letter, ~3 s or more; the letter ABSOLUTELY HUGE, a nuke, 断 or 天 from her R line 一筆――天を断つ); straight down
// from above, a vertical blur; the nuke (a white / orange / red first flash engulfed by her blue flames, a huge
// eruption); the camera stays on the destruction while the smoke takes its time to clear, then she is revealed in the
// ult form, no spoken line (Dex 10-19); control comes back after the nuke.
//
// This file owns R's timeline (the beats inside r_call / r_flurry / r_reveal, played 1:1 when their drawings are in,
// the white box on the same clock until then), the slash storm (which slash carves which piece of which stroke, when),
// the camera's shots (the cut-in close on her, the hard cut wide onto the letter pulling out as it is carved, the dead
// stop, the push down after the dive, the pull-out on the nuke, held on the wreck, back in on the reveal), the letterbox, the sound cues
// on the beats, what each beat hits, and the white box's pose. controller.ts hands R to it (startUlt / tickUlt /
// hitboxes / pose); game.ts frames the camera on `shot` and draws `bars`; ultdraw.ts draws the stand-ins from this
// state. Numbers: ult.json.

import ultRaw from "./ult.json?raw";
import type { HitBox } from "../../lab/contracts.ts";
import type { Action, Input } from "../../lab/engine/input.ts";
import type { WorldBox } from "../../lab/game/events.ts";
import type { Body } from "../collide.ts";
import { H } from "../config.ts";
import type { AnimDef } from "./contract.ts";
import type { Cue, MoveWorld, Zhusha, ZhushaHost } from "./controller.ts";

type Beat = [number, number];

export interface UltFile {
  clips: { r_call: number; r_flurry: number; r_reveal: number };
  beats: {
    call: { line: Beat; boom: Beat; fire: Beat; draw: Beat; coil: Beat };
    flurry: { vanish: Beat; storm: Beat };
  };
  letter: {
    char: string; size: number; low: number; ahead: number; ticks: number; slashes: number; pieces: number;
    slashLife: number; slashLen: [number, number]; thick: number; zenithAbove: number; wallMargin: number; sweepGap: number;
  };
  hold: number;
  dive: { ticks: number; cap: number; flipFrom: number; lineLife: number };
  impact: { ticks: number; flash: number; slowmo: number; slowmoTicks: number; invert: number; punch: number };
  aftermath: { hold: number; clear: number; revealFrom: number; coreGone: number };
  reveal: { visibleFrom: number };
  camera: {
    bars: number; barsIn: number; barsOut: number;
    call: { zoomIn: number; zoom: number; zoomFire: number; anchor: number; ahead: number; craneUp: number };
    flurry: {
      chase: { zoom: number; k: number; damp: number; vmax: number; follow: number; giveUp: number; settle: number; zoomEase: number; anchorEase: number };
      snap: { at: number; ticks: number; over: number; settle: number }; zoomEnd: number; anchor: number;
    };
    dive: { zoom: number; anchor: number; up: number };
    impact: { zoom: number; anchor: number };
    aftermath: { zoom: number; zoomClear: number; anchor: number };
    reveal: { zoom: number; anchor: number; ticks: number };
  };
  shake: { boom: number; slash: number; last: number; dive: number; impact: number };
  punch: { press: number; boom: number; last: number; impact: number };
  cues: Record<string, string>;
  fx: { callFire: string; letter: string; letterBreak: string; cuts: CutKinds; dive: string; nuke: string; clear: string };
  form: { reach: number; ahead: number; blades: number[]; summon: number; strike: number; fade: number; bladeLen: number; ring: number };
}

/** The storm's cuts over the real letter (ult.json fx.cuts): the shipped impact slashes by the cut's angle, drawn facing right. */
export interface CutKinds {
  flat: string[];
  rise: string[];
  fall: string[];
  steepRise: string[];
  steepFall: string[];
  cross: string[];
  crossEvery: number;
  cap: number;
  life: number;
  sweepCuts: number;
}

export const ULT = JSON.parse(ultRaw) as UltFile;

/** What each cue is, in the controller's cue terms (lane E's Cue.phase), by its ult.json key. */
const PHASES: Record<string, Cue["phase"]> = {
  press: "windup", line: "windup", boom: "boom", fire: "windup", draw: "windup", vanish: "move", slash: "swing", last: "boom",
  hush: "rise", dive: "move", impact: "boom", rumble: "land", reveal: "reveal", blade: "windup", cut: "hit",
};

/** Fires the cue under ult.json key `k` (its id is lane D's to map). */
export function say(c: { cue: UltCtx["cue"] }, k: string, volume: number, move: "r" | "uf" = "r"): void {
  c.cue(ULT.cues[k]!, volume, PHASES[k] ?? "boom", move);
}

/** call, flurry (she vanishes into the slash storm), hold (the stop), dive, impact (the nuke), aftermath (held on the
 * wreck while the smoke clears), reveal. */
export type UltPhase = "call" | "flurry" | "hold" | "dive" | "impact" | "aftermath" | "reveal";

/** A camera shot: world x at the frame's centre, world y on the anchor row, the zoom, the anchor row's share. */
export interface Shot {
  x: number;
  y: number;
  zoom: number;
  anchor: number;
  /** This shot starts a new cut (a hard cut, not a move). */
  cut: boolean;
}

/** What the director needs from the controller beyond her public fields (controller.ts builds it once). */
export interface UltCtx {
  z: Zhusha;
  host: ZhushaHost;
  /** Her drawn height, world px (H x charScale). */
  bodyH: number;
  /** feel.json's gameplay numbers for R. */
  feel: { impactRadius: number; impactDmg: number; impactKb: [number, number]; flurryDmg: number; hitstop: number };
  shake(trauma: number): void;
  ghost(life: number): void;
  /** A sound cue (lane D maps the id; the controller's cue() also tells what made it: R's move "r", the form's "uf"). */
  cue(id: string, volume: number, phase: Cue["phase"], move: "r" | "uf"): void;
  /** Hand control back: free movement, this tick's input read at once (a press during the reveal acts now). */
  release(input: Input, world: MoveWorld): void;
  /** The form begins (its length, its air dashes). */
  enterForm(): void;
}

/** One stroke: a polyline in the character's box (0..1, y down), in stroke order. */
export type Stroke = [number, number][];

/** The letters her R line offers (一筆――天を断つ), stroke by stroke. Stand-ins for the FX v2 loop's letter. */
export const LETTERS: Record<string, Stroke[]> = {
  // 断: 米 (six strokes), the frame ㇗ around it, then 斤 (four)
  断: [
    [[0.14, 0.17], [0.2, 0.28]],
    [[0.41, 0.16], [0.34, 0.28]],
    [[0.1, 0.38], [0.47, 0.38]],
    [[0.27, 0.09], [0.27, 0.8]],
    [[0.26, 0.44], [0.09, 0.67]],
    [[0.29, 0.46], [0.45, 0.62]],
    [[0.04, 0.07], [0.04, 0.9], [0.5, 0.9]],
    [[0.93, 0.05], [0.62, 0.2]],
    [[0.62, 0.18], [0.62, 0.6], [0.53, 0.96]],
    [[0.62, 0.48], [0.98, 0.48]],
    [[0.82, 0.48], [0.82, 1]],
  ],
  // 天: two horizontals, the left-falling stroke from under the top one through the middle, the right-falling one.
  // The spines of the FX v2 loop's brushed 天 (lanes/fx/v2/letter/tian3.py, r_letter), so the storm's slashes, its hits
  // and the camera's chase follow the painted strokes (it is wider than the box: u runs -0.02 .. 1.11)
  天: [
    [[0.219, 0.105], [0.368, 0.139], [0.53, 0.125], [0.685, 0.136]],
    [[-0.021, 0.38], [0.204, 0.42], [0.443, 0.404], [0.682, 0.382], [0.911, 0.386]],
    [[0.435, 0.137], [0.466, 0.268], [0.455, 0.404], [0.42, 0.535], [0.355, 0.654], [0.262, 0.754], [0.147, 0.828], [0.021, 0.879]],
    [[0.476, 0.474], [0.574, 0.605], [0.68, 0.727], [0.802, 0.836], [0.951, 0.894], [1.114, 0.9]],
  ],
};

/** The letter R carves (ult.json letter.char). */
export const letterStrokes = (): Stroke[] => LETTERS[ULT.letter.char] ?? LETTERS["断"]!;

/** A slash of the storm: when, which stroke and which piece of it (fractions of its length), its angle and length (H). */
export interface Slash {
  at: number;
  stroke: number;
  /** Which piece of the letter it cuts (an index into the storm's pieces; -1 for a sweep down a whole stroke). */
  piece: number;
  u0: number;
  u1: number;
  ang: number;
  len: number;
  /** It carves its piece (the first slash on it); the rest re-cut. */
  carves: boolean;
  /** A closing sweep down a whole stroke (one per stroke, at the end). */
  sweep: boolean;
  /** The last closing sweep: then the slashes stop. */
  last: boolean;
}

const strokeLen = (s: Stroke): number => s.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - s[i]![0], p[1] - s[i]![1]), 0);

/** The point u (0..1 of its length) along a stroke, in the character's box. */
export function along(s: Stroke, u: number): [number, number] {
  const L = strokeLen(s);
  let d = Math.max(0, Math.min(1, u)) * L;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1]!, b = s[i]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l || i === s.length - 1) {
      const k = l > 0 ? Math.min(1, d / l) : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    d -= l;
  }
  return s[s.length - 1]!;
}

/** A deterministic 0..1 sequence. */
const rnd = (i: number): number => { const a = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return a - Math.floor(a); };

/**
 * The storm: `count` slashes over `ticks`, each carving a piece of a stroke into existence (a share `pieces` of them
 * carve new pieces, the rest re-cut carved ones), from every direction. Not a wave: each stroke's pieces come in a wide
 * window that overlaps its neighbours', so the letter fills in everywhere at once, roughly in stroke order, and denser as
 * it goes. Then a closing sweep down each stroke, `gap` ticks apart, the last on the storm's last tick.
 */
export function storm(strokes: Stroke[], count: number, ticks: number, pieceShare: number, len: [number, number], gap = 4): Slash[] {
  const lens = strokes.map(strokeLen), total = lens.reduce((a, b) => a + b, 0);
  const nPieces = Math.max(strokes.length, Math.round(count * pieceShare));
  const out: Slash[] = [];
  const pieces: { s: number; u0: number; u1: number }[] = [];
  strokes.forEach((_, s) => {
    const n = Math.max(1, Math.round((lens[s]! / total) * nPieces));
    for (let j = 0; j < n; j++) pieces.push({ s, u0: Math.max(0, j / n - 0.02), u1: Math.min(1, (j + 1) / n + 0.02) });
  });
  const S = strokes.length, end = ticks - 6 - S * gap;
  // density builds: a slash's share of the storm u lands at end * u^0.8 (more of them late)
  const when = (u: number): number => Math.round(Math.pow(Math.max(0, Math.min(1, u)), 0.8) * end);
  pieces.forEach((p, k) => {
    const c = ((p.s + 0.5) / S) * 0.7 + 0.05;
    const at = when(Math.max(0.02, Math.min(0.92, c + (rnd(k * 3 + 1) - 0.5) * 0.6)));
    // half the cuts run with the stroke (carving it), half across it from anywhere
    const a = along(strokes[p.s]!, p.u0), b = along(strokes[p.s]!, p.u1);
    const withIt = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const ang = rnd(k * 3 + 2) < 0.5 ? withIt + (rnd(k * 7) - 0.5) * 0.5 : rnd(k * 5 + 3) * Math.PI;
    out.push({ at, stroke: p.s, piece: k, u0: p.u0, u1: p.u1, ang, len: len[0] + (len[1] - len[0]) * rnd(k * 11 + 4), carves: true, sweep: false, last: false });
  });
  // a piece is carved by its first slash: the re-cuts come after it (never into thin air)
  const carvedAt = out.map((sl) => sl.at);
  for (let i = out.length; i < count - S; i++) {
    const pi = Math.floor(rnd(i * 13 + 5) * pieces.length), p = pieces[pi]!;
    const after = carvedAt[pi] ?? 0;
    const at = Math.max(after + 1, when(after / end + (1 - after / end) * rnd(i * 17 + 6)));
    out.push({ at, stroke: p.s, piece: pi, u0: p.u0, u1: p.u1, ang: rnd(i * 19 + 7) * Math.PI, len: len[0] + (len[1] - len[0]) * rnd(i * 23 + 8), carves: false, sweep: false, last: false });
  }
  // the closing sweeps, one down each stroke in stroke order, the last on the storm's last tick
  strokes.forEach((st, k) => {
    const a = along(st, 0), b = along(st, 1);
    out.push({ at: ticks - 1 - (S - 1 - k) * gap, stroke: k, piece: -1, u0: 0, u1: 1, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), len: len[1] * 2, carves: false, sweep: true, last: k === S - 1 });
  });
  return out.sort((p, q) => p.at - q.at);
}

/** One cut effect over the real letter: on slash `slash`'s tick (+ `delay`), at `u` along its stroke. */
export interface CutSpawn {
  slash: number;
  id: string;
  facing: 1 | -1;
  u: number;
  delay: number;
}

/** Every effect id a cut can use. */
export const cutIds = (C: CutKinds): string[] => [...new Set([...C.flat, ...C.rise, ...C.fall, ...C.steepRise, ...C.steepFall, ...C.cross])];

/**
 * Which of the storm's slashes fly over the real letter as shipped impact slashes: the carving ones (and each closing
 * sweep as `sweepCuts` cuts down its stroke, a tick apart), at most `cap` alive at once (each lives `life` ticks: the
 * game holds 64 effects, and the letter must never be the one pushed out), each picked by its angle: flat, rising or
 * falling, steep (a falling cut is a rising one mirrored, and the other way round), every `crossEvery`th an X.
 */
export function cutPlan(S: Slash[], C: CutKinds): CutSpawn[] {
  const out: CutSpawn[] = [];
  const ends: number[] = [];
  let n = 0;
  const pick = (l: string[], k: number): string => l[Math.floor(rnd(k * 31 + 9) * l.length) % l.length]!;
  const kind = (ang: number, k: number): { id: string; facing: 1 | -1 } => {
    const flip: 1 | -1 = rnd(k * 17 + 3) < 0.5 ? 1 : -1;
    if (C.crossEvery > 0 && n % C.crossEvery === C.crossEvery - 1) return { id: pick(C.cross, k), facing: flip };
    // the cut's line, -90 .. 90 degrees (y down: below 0 it rises to the right)
    let a = ((ang % Math.PI) + Math.PI) % Math.PI;
    if (a > Math.PI / 2) a -= Math.PI;
    const rising = a < 0, m = Math.abs(a);
    if (m < 0.26) return { id: pick(C.flat, k), facing: flip };
    // drawn rising, or a falling one mirrored (and the other way round)
    if (m < 0.9) return flip > 0 ? { id: pick(rising ? C.rise : C.fall, k), facing: 1 } : { id: pick(rising ? C.fall : C.rise, k), facing: -1 };
    return flip > 0 ? { id: pick(rising ? C.steepRise : C.steepFall, k), facing: 1 } : { id: pick(rising ? C.steepFall : C.steepRise, k), facing: -1 };
  };
  S.forEach((sl, i) => {
    if (!sl.carves && !sl.sweep) return;
    if (sl.sweep) {
      for (let k = 0; k < C.sweepCuts; k++) {
        out.push({ slash: i, ...kind(sl.ang, i * 7 + k), u: (k + 0.5) / C.sweepCuts, delay: k });
        ends.push(sl.at + k + C.life);
        n++;
      }
      return;
    }
    if (ends.filter((e) => e > sl.at).length >= C.cap) return;
    out.push({ slash: i, ...kind(sl.ang, i), u: (sl.u0 + sl.u1) / 2, delay: 0 });
    ends.push(sl.at + C.life);
    n++;
  });
  return out;
}

/** The game's effects (game.ts wires game.fx): whether one is in, and playing one at a world point. */
export interface UltFx {
  has(id: string): boolean;
  play(id: string, o: { x?: number; y?: number; facing?: number; attach?: "world" | "her"; delay?: number }): { stop(): void };
}

/** Where R happens: where she pressed, her facing, the letter's box (world px), the floor under it, the zenith. */
export interface Stage {
  x0: number;
  y0: number;
  f: 1 | -1;
  /** The letter's centre x, its left edge, top, size (world px). */
  gx: number;
  left: number;
  top: number;
  size: number;
  floor: number;
  /** A real floor under the letter (else the dive falls until it lands, or the cap). */
  solid: boolean;
  zx: number;
  zy: number;
}

/** A world point of the letter's box (u, v in 0..1). */
export const letterAt = (st: Stage, u: number, v: number): [number, number] => [st.left + u * st.size, st.top + v * st.size];

/** The world box a slash cuts (its piece, padded). */
export function slashBox(st: Stage, sl: Slash, pad: number): WorldBox {
  const s = letterStrokes()[sl.stroke]!;
  const a = letterAt(st, ...along(s, sl.u0)), b = letterAt(st, ...along(s, sl.u1));
  const x0 = Math.min(a[0], b[0]) - pad, y0 = Math.min(a[1], b[1]) - pad;
  return { x: x0, y: y0, w: Math.abs(b[0] - a[0]) + 2 * pad, h: Math.abs(b[1] - a[1]) + 2 * pad };
}

const ACTS: Action[] = ["jump", "m1", "m2", "skill", "e"];

const clamp01 = (u: number): number => Math.max(0, Math.min(1, u));
const smooth = (u: number): number => { const k = clamp01(u); return k * k * (3 - 2 * k); };
const easeOut = (u: number): number => { const k = clamp01(u); return 1 - (1 - k) * (1 - k); };
const easeIn = (u: number): number => { const k = clamp01(u); return k * k; };
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
/** Zoom moves even in log space (a push reads even all the way). */
const zlerp = (a: number, b: number, u: number): number => Math.exp(lerp(Math.log(a), Math.log(b), u));

/** The clip's total ticks, or null with no drawing. */
export function clipLen(def: AnimDef | null): number | null {
  if (!def) return null;
  return def.frames.reduce((n, f) => n + f.ticks, 0);
}

/**
 * A beat's clip tick: the first drawing at or past the take's source frame (anim.json frames carry `src`, kit v1.4);
 * a drawing without src marks scales the planned tick to its length; no drawing: the planned tick.
 */
export function beatTick(def: AnimDef | null, beat: Beat, planned: number): number {
  const [src, tick] = beat;
  if (!def) return tick;
  const frames = def.frames as (AnimDef["frames"][number] & { src?: number })[];
  if (frames.some((f) => typeof f.src === "number")) {
    let t = 0;
    for (const f of frames) {
      if ((f.src ?? -1) >= src) return t;
      t += f.ticks;
    }
    return Math.max(0, t - 1);
  }
  const len = clipLen(def) ?? planned;
  return Math.round((tick * len) / planned);
}

export class UltDirector {
  phase: UltPhase | null = null;
  /** Ticks into the phase (the one being played); ticks since the press. */
  t = 0;
  T = 0;
  stage: Stage | null = null;
  /** The camera's shot this tick (null: the world's framing has it). */
  shot: Shot | null = null;
  /** The letterbox, a share of the frame's height (the presenter draws it). */
  bars = 0;
  /** The storm, its own clock (-1 before it starts; it keeps counting through the stop and the dive), slashes played. */
  slashes: Slash[] = [];
  stormT = -1;
  cut = 0;
  /** The dive's progress (the letter shatters on it). */
  peel = 0;
  /** The beats' lengths and inner ticks, resolved at the press from the drawings in the game. */
  len = { call: 0, flurry: 0, hold: 0, dive: 0, impact: 0, aftermath: 0, reveal: 0 };
  beat = { line: 0, boom: 0, fire: 0, draw: 0, coil: 0, vanish: 0, storm: 0 };
  /** Whether each beat's drawing is in (else the white box stands in). */
  art = { call: false, flurry: false, reveal: false };
  /** The game's effects (null: tests, or none wired) and which of R's are in (else ultdraw.ts's stand-ins draw). */
  fx: UltFx | null = null;
  real = { callFire: false, letter: false, letterBreak: false, cuts: false, dive: false, nuke: false, clear: false };
  /** The cuts over the real letter, by slash (cutPlan). */
  cutsBy = new Map<number, CutSpawn[]>();
  private callFire: { stop(): void } | null = null;
  /** The real letter while it is carved and held, then its pieces breaking at the dive (stopped on the impact). */
  private letterFx: { stop(): void } | null = null;
  private breakFx: { stop(): void } | null = null;
  private cutNext = false;
  private lastShot: Shot | null = null;
  /** Where a phase's camera move starts: the last shot of the phase before (moves never jump). */
  private from: Shot | null = null;
  /** The flurry's camera: a lagging spring after her (position, velocity), its zoom and anchor row. */
  private chase: { x: number; y: number; vx: number; vy: number; tx: number; ty: number; zoom: number; anchor: number } | null = null;
  /** Where the flurry's snap out to the whole letter starts (the chase's last shot). */
  private snapFrom: Omit<Shot, "cut"> | null = null;
  /** The phase that starts on the next tick. */
  private next: UltPhase | null = null;

  get active(): boolean {
    return this.phase !== null;
  }

  /** The press: the stage is set, the beats resolved, the storm laid out, the cut-in. */
  start(c: UltCtx, world: MoveWorld | null): void {
    const z = c.z, b = z.body, s = c.host, f = z.facing;
    const Lt = ULT.letter;
    const call = z.clipOf("r_call", false), flurry = z.clipOf("r_flurry", false), reveal = z.clipOf("r_reveal", true);
    this.art = { call: !!call, flurry: !!flurry, reveal: !!reveal };
    const C = ULT.clips, B = ULT.beats;
    this.beat = {
      line: beatTick(call, B.call.line, C.r_call), boom: beatTick(call, B.call.boom, C.r_call), fire: beatTick(call, B.call.fire, C.r_call),
      draw: beatTick(call, B.call.draw, C.r_call), coil: beatTick(call, B.call.coil, C.r_call),
      vanish: beatTick(flurry, B.flurry.vanish, C.r_flurry), storm: beatTick(flurry, B.flurry.storm, C.r_flurry),
    };
    this.len = {
      call: clipLen(call) ?? C.r_call,
      flurry: this.beat.storm + Lt.ticks,
      hold: ULT.hold,
      dive: ULT.dive.ticks,
      impact: ULT.impact.ticks,
      aftermath: ULT.aftermath.hold + Math.round(ULT.aftermath.clear * ULT.aftermath.revealFrom),
      reveal: clipLen(reveal) ?? C.r_reveal,
    };
    this.slashes = storm(letterStrokes(), Lt.slashes, Lt.ticks, Lt.pieces, Lt.slashLen, Lt.sweepGap);
    const FX = ULT.fx, has = (id: string): boolean => !!this.fx?.has(id);
    const letter = has(FX.letter);
    this.real = {
      callFire: has(FX.callFire), letter, letterBreak: letter && has(FX.letterBreak), cuts: letter && cutIds(FX.cuts).every(has),
      dive: has(FX.dive), nuke: has(FX.nuke), clear: has(FX.clear),
    };
    this.cutsBy = new Map();
    if (this.real.cuts) for (const k of cutPlan(this.slashes, FX.cuts)) this.cutsBy.set(k.slash, [...(this.cutsBy.get(k.slash) ?? []), k]);
    this.letterFx?.stop();
    this.breakFx?.stop();
    this.letterFx = this.breakFx = null;
    this.callFire = null;
    this.cut = 0;
    this.stormT = -1;
    this.peel = 0;
    // the stage: the letter ahead of her (kept a margin inside a wall), the floor under it, the zenith above its top
    const size = Lt.size * H;
    let gx = b.x + f * (Lt.ahead * H + size / 2);
    if (world) {
      const probe: Body = { ...b };
      world.move(probe, gx - probe.x, 0);
      if (Math.abs(probe.x - gx) > 1) gx = probe.x - f * (Lt.wallMargin * H + size / 2);
    }
    const g = world?.groundBelow?.(gx, b.y - 2 * H);
    const solid = !!g && g.y < b.y + 2.5 * H;
    const floor = solid ? g!.y : b.y;
    const top = floor - (Lt.low * H + size);
    this.stage = { x0: b.x, y0: b.y, f, gx, left: gx - size / 2, top, size, floor, solid, zx: gx, zy: top - Lt.zenithAbove * H };
    this.T = 0;
    this.lastShot = null;
    this.from = null;
    this.next = null;
    this.enter("call");
    b.vx = 0;
    b.vy = 0;
    z.anim = { role: "r_call", t: 0, hitAt: null, hidden: false, flame: 0 };
    z.ultPhase = "call";
    s.vfx.spawn("flash.gold", { x: b.x, y: b.y - 0.6 * H, facing: f, scale: 1.4 });
    say(c, "press", 1);
    s.camera.zoomPunch(ULT.punch.press);
    // the press tick shows the call's first drawing (and the cut-in); the next tick plays on from its second
    this.shot = this.frame(c, 0);
    this.t = 1;
  }

  /** The next phase: from the next tick (its tick 0), or at once (the impact lands on the tick she touches down). */
  private go(p: UltPhase, now = false): void {
    if (now) this.enter(p);
    else this.next = p;
  }

  private enter(p: UltPhase): void {
    this.phase = p;
    this.t = 0;
    // one cut only: the cut-in on the press; from there one continuous camera (Dex 10-19: no cut to the flurry)
    this.cutNext = p === "call";
    this.from = this.lastShot;
    if (p === "flurry") {
      this.chase = null;
      this.snapFrom = null;
    }
  }

  /** One tick of R. Returns false once control is back (the controller is free again). */
  tick(c: UltCtx, input: Input, world: MoveWorld): boolean {
    const z = c.z, b = z.body, s = c.host, st = this.stage!, f = st.f;
    const L = this.len, K = this.beat;
    if (this.next) {
      const p = this.next;
      this.next = null;
      this.enter(p);
      // what each phase does as it starts
      if (p === "hold") {
        // the slashes stop: she is there, upside down above the letter's top, in dead silence
        this.toZenith(z, world);
        say(c, "hush", 1);
      } else if (p === "dive") {
        say(c, "dive", 1);
        // the real letter breaks: its pieces take over from it, cut down the middle where she dives
        if (this.real.letterBreak) {
          this.letterFx?.stop();
          this.letterFx = null;
          this.breakFx = this.fx!.play(ULT.fx.letterBreak, { x: st.gx, y: st.top + st.size, facing: 1 });
        }
        if (this.real.dive) this.fx!.play(ULT.fx.dive, { x: st.gx, y: st.floor, facing: 1 });
        c.shake(ULT.shake.dive);
      } else if (p === "aftermath") {
        // the change happens unseen in the smoke: the form begins now (control can come back from here)
        c.enterForm();
      }
    }
    const t = this.t;
    this.T++;
    if (this.stormT >= 0) this.stormT++;
    switch (this.phase) {
      case "call": {
        // the call at its original speed: the drawing plays 1:1 where she stands
        b.vx = b.vy = 0;
        z.anim = { role: "r_call", t, hitAt: null, hidden: false, flame: 0 };
        if (t === K.line) say(c, "line", 1);
        if (t === K.boom) {
          say(c, "boom", 1);
          if (this.real.callFire) this.callFire = this.fx!.play(ULT.fx.callFire, { attach: "her", facing: f });
          c.shake(ULT.shake.boom);
          s.camera.zoomPunch(ULT.punch.boom);
          s.vfx.spawn("burst.red", { x: b.x, y: b.y - 0.55 * H, facing: f, scale: 1.3 });
          if (!this.art.call) s.vfx.spawn("embers.gold", { x: b.x, y: b.y - 0.4 * H, facing: f, scale: 1.4 });
        }
        if (t === K.fire) say(c, "fire", 0.8);
        if (t === K.draw) say(c, "draw", 0.8);
        if (!this.art.call && t > K.boom && t < K.coil && t % 6 === 0) s.vfx.spawn("embers.gold", { x: b.x, y: b.y - 0.4 * H, facing: f });
        if (t + 1 >= L.call) this.go("flurry");
        break;
      }
      case "flurry": {
        // she bursts into ash and is gone: she IS the slashes that carve the letter into existence
        b.vx = b.vy = 0;
        const gone = t >= (this.art.flurry ? K.storm : K.vanish);
        z.anim = { role: "r_flurry", t: Math.min(t, K.storm), hitAt: null, hidden: gone, flame: 0 };
        if (t === K.vanish) {
          say(c, "vanish", 0.9);
          this.callFire?.stop();
          this.callFire = null;
          s.vfx.spawn("smoke.dark", { x: b.x, y: b.y - 0.4 * H, facing: f });
          s.vfx.spawn("embers.gold", { x: b.x, y: b.y - 0.4 * H, facing: f, scale: 1.4 });
        }
        if (t === K.storm) {
          this.stormT = 0;
          // the letter at its foot, never mirrored (facing 1: the effect is drawn as written)
          if (this.real.letter) this.letterFx = this.fx!.play(ULT.fx.letter, { x: st.gx, y: st.top + st.size, facing: 1 });
        }
        if (this.stormT >= 0) {
          const S = this.slashes;
          let n = 0;
          while (this.cut < S.length && S[this.cut]!.at <= this.stormT) {
            const sl = S[this.cut]!;
            if (sl.last) {
              say(c, "last", 1);
              c.shake(ULT.shake.last);
              s.camera.zoomPunch(ULT.punch.last);
            } else if (sl.sweep) {
              say(c, "slash", 1);
              c.shake(ULT.shake.last * 0.6);
            } else if (this.cut % 10 === 0) say(c, "slash", 0.5 + 0.3 * rnd(this.cut));
            // the cuts flying over the real letter, at the piece they carve
            for (const k of this.cutsBy.get(this.cut) ?? []) {
              const [x, y] = letterAt(st, ...along(letterStrokes()[sl.stroke]!, k.u));
              this.fx!.play(k.id, { x, y, facing: k.facing, delay: k.delay });
            }
            n++;
            this.cut++;
          }
          if (n > 0) c.shake(ULT.shake.slash * Math.min(2, n));
        }
        if (t + 1 >= L.flurry) this.go("hold");
        break;
      }
      case "hold": {
        // the stop: a beat of stillness, the letter hanging huge, her above it
        b.vx = b.vy = 0;
        z.anim = { role: "r_hold", t, hitAt: null, hidden: false, flame: 0 };
        if (t + 1 >= L.hold) this.go("dive");
        break;
      }
      case "dive": {
        // straight down from above, a vertical blur through the letter: powered, accelerating, breaking its column
        const D = ULT.dive;
        const u = (t + 1) / L.dive;
        this.peel = clamp01(u);
        z.anim = { role: "r_dive", t, hitAt: null, hidden: false, flame: 1 };
        b.vx = 0;
        const dy = t < L.dive ? Math.max(1, st.zy + (st.floor - st.zy) * easeIn(u) - b.y) : ((st.floor - st.zy) / L.dive) * 2;
        b.vy = dy;
        const { landed } = world.move(b, 0, dy);
        z.streak = { x0: st.zx, y0: st.zy - 0.5 * c.bodyH, x1: b.x, y1: b.y - 0.5 * c.bodyH, life: D.lineLife };
        if (t % 2 === 0) c.ghost(8);
        if (landed || b.grounded || (st.solid && b.y >= st.floor - 0.5) || t > L.dive + D.cap) this.impact(c);
        break;
      }
      case "impact": {
        // the nuke: the flash, her blue flames over it, the eruption; the dust hides the change (Dex 10-16)
        b.vx = b.vy = 0;
        z.anim = { role: "r_smoke", t, hitAt: null, hidden: true, flame: 0 };
        if (t === 3) say(c, "rumble", 1);
        if (t + 1 >= L.impact) this.go("aftermath");
        break;
      }
      case "aftermath": {
        // the frame stays on the destruction: the wreck burns out, the smoke hangs, then clears slowly (Dex 10-19);
        // she is in the form now, unseen; any input plays on at once
        b.vx = b.vy = 0;
        z.anim = { role: "r_smoke", t, hitAt: null, hidden: true, flame: 0 };
        if (t === ULT.aftermath.hold) {
          say(c, "reveal", 1);
          if (this.real.clear) this.fx!.play(ULT.fx.clear, { x: b.x, y: b.y, facing: f });
        }
        if (this.wants(input)) {
          this.end();
          c.release(input, world);
          return false;
        }
        if (t + 1 >= L.aftermath) this.go("reveal");
        break;
      }
      case "reveal": {
        // the last of the smoke clears off her ult form (r_reveal 1:1 into uf_idle), no spoken line; any input plays on at once
        b.vx = b.vy = 0;
        z.anim = { role: "r_reveal", t, hitAt: null, hidden: t < ULT.reveal.visibleFrom, flame: 0 };
        if (this.wants(input) || t + 1 >= L.reveal) {
          this.end();
          c.release(input, world);
          return false;
        }
        break;
      }
      default:
        this.end();
        c.release(input, world);
        return false;
    }
    z.ultPhase = this.phase;
    this.shot = this.frame(c, this.t);
    this.t++;
    return true;
  }

  /** R is over (control back, or cut short): the camera goes back to the world, the bars slide out. */
  end(): void {
    this.callFire?.stop();
    this.callFire = null;
    this.letterFx?.stop();
    this.breakFx?.stop();
    this.letterFx = this.breakFx = null;
    this.phase = null;
    this.next = null;
    this.shot = null;
    this.lastShot = null;
    this.stormT = -1;
  }

  /** Each tick after the controller's: the bars slide in during R and out after it; R left any other way ends here. */
  after(inUlt: boolean): void {
    if (!inUlt && this.phase !== null) this.end();
    const C = ULT.camera;
    const want = this.phase !== null ? C.bars : 0;
    const rate = C.bars / (this.phase !== null ? C.barsIn : C.barsOut);
    this.bars = this.bars < want ? Math.min(want, this.bars + rate) : Math.max(want, this.bars - rate);
  }

  /** A press or a direction since a moment ago (the reveal hands control back on it; R itself is not one). */
  private wants(input: Input): boolean {
    if (input.axis() !== 0) return true;
    for (const a of ACTS) {
      const p = input.pressTick(a);
      if (p !== undefined && input.tick - p <= 10) return true;
    }
    return false;
  }

  /** Puts her at the zenith, upside down above the letter (a blink: walls stop it, ceilings too). */
  private toZenith(z: Zhusha, world: MoveWorld): void {
    const st = this.stage!, b = z.body;
    world.move(b, st.gx - b.x, 0);
    world.move(b, 0, st.zy - b.y);
    b.grounded = false;
    st.zx = b.x;
    st.zy = b.y;
  }

  /** The dive lands: everything near breaks, the frame freezes white, the nuke goes off. */
  private impact(c: UltCtx): void {
    const z = c.z, b = z.body, s = c.host, I = ULT.impact;
    this.go("impact", true);
    this.peel = 1;
    // the letter is gone in the flash
    this.letterFx?.stop();
    this.breakFx?.stop();
    this.letterFx = this.breakFx = null;
    this.stormT = -1;
    b.vx = b.vy = 0;
    z.anim = { role: "r_smoke", t: 0, hitAt: null, hidden: true, flame: 0 };
    z.smoke = { x: b.x, y: b.y, t: 0, life: I.ticks + ULT.aftermath.hold + ULT.aftermath.clear + 12 };
    s.feel.freeze(c.feel.hitstop);
    s.feel.impactFrame("invert", I.invert);
    s.feel.slowmo(I.slowmo, I.slowmoTicks);
    c.shake(ULT.shake.impact);
    s.camera.zoomPunch(ULT.punch.impact);
    // side-on (Dex 10-19: no rings on the ground): rock thrown up, dust; the flash, the flames and the column are
    // ultdraw.ts's stand-ins
    if (this.real.nuke) this.fx!.play(ULT.fx.nuke, { x: b.x, y: b.y, facing: 1 });
    s.vfx.spawn("debris.stone", { x: b.x, y: b.y - 0.2 * H, facing: 1, scale: 2.4 });
    s.vfx.spawn("debris.stone", { x: b.x - 2 * H, y: b.y - 0.1 * H, facing: -1, scale: 1.6 });
    s.vfx.spawn("debris.stone", { x: b.x + 2 * H, y: b.y - 0.1 * H, facing: 1, scale: 1.6 });
    s.vfx.spawn("dust.land", { x: b.x, y: b.y, facing: 1, scale: 3 });
    say(c, "impact", 1);
  }

  /** Her hits this tick: the storm's slashes cut where they carve, the dive's column, the nuke (group "r": the court's whole ring). */
  hitboxes(c: UltCtx): { box: WorldBox; hb: HitBox }[] {
    const st = this.stage, b = c.z.body, K = c.bodyH, F = c.feel;
    if (!st) return [];
    const pt = (hps: number): number => (hps * H) / 60;
    if (this.phase === "flurry" && this.stormT >= 0) {
      const out: { box: WorldBox; hb: HitBox }[] = [];
      for (let i = this.cut - 1; i >= 0; i--) {
        const sl = this.slashes[i]!;
        if (sl.at < this.stormT - 1) break;
        const box = slashBox(st, sl, 0.25 * H);
        // ten slashes share a hit group: the storm grinds a target down without hundreds of hits
        out.push({ box, hb: { ...box, damage: F.flurryDmg, knockback: [pt(0.6) * st.f, -pt(0.8)], hitstop: 0, group: `r-cut-${Math.floor(i / 10)}`, hitVfx: "hit.light" } });
      }
      return out;
    }
    if (this.phase === "dive") {
      const w = 0.9 * K, top = Math.min(st.zy, b.y) - K;
      const box = { x: b.x - w / 2, y: top, w, h: b.y - top };
      return [{ box, hb: { ...box, damage: 8, knockback: [0, pt(4)], hitstop: 1, group: "r-dive", hitVfx: "hit.light" } }];
    }
    if (this.phase === "impact" && this.t <= 2) {
      const R = F.impactRadius * K;
      const box = { x: b.x - R, y: b.y - 6 * K, w: 2 * R, h: 7 * K };
      return [{ box, hb: { ...box, damage: F.impactDmg, knockback: [pt(F.impactKb[0]), -pt(F.impactKb[1])], hitstop: F.hitstop, group: "r", heavy: true, hitVfx: "hit.heavy" } }];
    }
    return [];
  }

  /** How heavy a connected hit of R is (the slashes and the dive's column are light; the nuke is the ult). */
  weight(): "light" | "ult" {
    return this.phase === "impact" ? "ult" : "light";
  }

  /** The white box's pose this tick (sx, sy, lean, rot), for the controller's springs. */
  pose(): { sx: number; sy: number; lean: number; rot: number } {
    const t = this.t - 1, K = this.beat, f = this.stage?.f ?? 1;
    switch (this.phase) {
      case "call":
        if (t >= K.coil) return { sx: 1.14, sy: 0.8, lean: 0.08 * f, rot: 0 };
        if (t >= K.boom && t < K.boom + 8) return { sx: 1.12, sy: 0.9, lean: -0.05 * f, rot: 0 };
        return { sx: 1, sy: 1 + 0.04 * Math.sin(this.T * 0.6), lean: 0, rot: 0 };
      case "flurry":
        return { sx: 1.14, sy: 0.8, lean: 0.08 * f, rot: 0 };
      case "hold":
        return { sx: 1, sy: 1, lean: 0, rot: Math.PI };
      case "dive": {
        const flip = t / Math.max(1, this.len.dive) >= ULT.dive.flipFrom;
        return { sx: 0.5, sy: 1.8, lean: 0, rot: flip ? 0 : Math.PI };
      }
      case "impact":
      case "aftermath":
        return { sx: 1.2, sy: 0.8, lean: 0, rot: 0 };
      default:
        return { sx: 1, sy: 1, lean: 0, rot: 0 };
    }
  }

  /** The camera's shot for tick t of this phase (the phase's move; reduced motion: held framings, cuts between them). */
  private frame(c: UltCtx, t: number): Shot {
    const st = this.stage!, b = c.z.body, C = ULT.camera, K = this.beat, L = this.len;
    const f = st.f;
    const cut = this.cutNext;
    this.cutNext = false;
    const mid = st.top + st.size / 2;
    let shot: Shot;
    if (c.host.feel.reducedMotion) {
      // no swings: the call in the close band, the rest held at play zoom (the game cross-fades the cuts)
      const p = this.phase;
      if (p === "call") shot = { x: st.x0 + f * C.call.ahead * H, y: st.y0, zoom: 2, anchor: C.call.anchor, cut };
      else if (p === "flurry" || p === "hold") shot = { x: st.gx, y: mid, zoom: 1, anchor: 0.5, cut };
      else shot = { x: st.gx, y: st.floor, zoom: 1, anchor: C.impact.anchor, cut };
      return this.keep(shot);
    }
    switch (this.phase) {
      case "call": {
        // the cut-in: close on her, pushing in to the BOOM; the frame cranes up a little with the fire, then pushes
        // back in and settles as she coils
        const A = C.call;
        let zoom: number, up: number;
        if (t < K.boom) { zoom = zlerp(A.zoomIn, A.zoom, easeOut(t / Math.max(1, K.boom))); up = 0; }
        else if (t < K.fire) { zoom = A.zoom; up = 0; }
        else if (t < K.coil) { const u = smooth((t - K.fire) / Math.max(1, K.coil - K.fire)); zoom = zlerp(A.zoom, A.zoomFire, u); up = A.craneUp * u; }
        else { const u = smooth((t - K.coil) / Math.max(1, L.call - K.coil)); zoom = zlerp(A.zoomFire, A.zoom, u); up = A.craneUp * (1 - u); }
        shot = { x: st.x0 + f * A.ahead * H, y: st.y0 - up * H, zoom, anchor: A.anchor, cut };
        break;
      }
      case "flurry": {
        // no cut (Dex 10-19): from the call the camera tries to follow her (through most of the storm, Dex 10-20); she is too
        // fast, it gives up; then it SNAPS out to the whole letter as the letter completes (Dex 10-20: "sudden")
        const A = C.flurry, S = A.chase, ts = t - K.storm;
        const a = this.from ?? { x: st.x0, y: st.y0, zoom: C.call.zoom, anchor: C.call.anchor };
        const ch = (this.chase ??= { x: a.x, y: a.y, vx: 0, vy: 0, tx: a.x, ty: a.y, zoom: a.zoom, anchor: a.anchor });
        if (ts < S.giveUp) {
          // the chase: she darts from slash to slash (`follow` smooths her path a little, she is still far too fast); a
          // loose spring goes after her: it accelerates, lags, whips past and swings back, easing out of the close band
          const g = this.her(st, t);
          ch.tx += (g[0] - ch.tx) * S.follow;
          ch.ty += (g[1] - ch.ty) * S.follow;
          ch.vx = (ch.vx + (ch.tx - ch.x) * S.k) * S.damp;
          ch.vy = (ch.vy + (ch.ty - ch.y) * S.k) * S.damp;
          const v = Math.hypot(ch.vx, ch.vy), cap = S.vmax * H;
          if (v > cap) { ch.vx *= cap / v; ch.vy *= cap / v; }
          ch.zoom = zlerp(ch.zoom, S.zoom, S.zoomEase);
        } else {
          // it has lost her: it coasts to a stop where it is
          ch.vx *= S.settle;
          ch.vy *= S.settle;
        }
        ch.x += ch.vx;
        ch.y += ch.vy;
        ch.anchor += (A.anchor - ch.anchor) * S.anchorEase;
        const Sn = A.snap;
        if (ts < Sn.at) shot = { x: ch.x, y: ch.y, zoom: ch.zoom, anchor: ch.anchor, cut: false };
        else {
          // the snap: a whip out to the whole letter in a few ticks, past it a touch, then settling on it
          const s0 = (this.snapFrom ??= { x: ch.x, y: ch.y, zoom: ch.zoom, anchor: ch.anchor });
          const wide = A.zoomEnd * Sn.over;
          if (ts < Sn.at + Sn.ticks) {
            const k = 1 - Math.pow(1 - (ts - Sn.at + 1) / Sn.ticks, 3);
            shot = { x: lerp(s0.x, st.gx, k), y: lerp(s0.y, mid, k), zoom: zlerp(s0.zoom, wide, k), anchor: lerp(s0.anchor, A.anchor, k), cut: false };
          } else {
            const k = smooth((ts - Sn.at - Sn.ticks + 1) / Sn.settle);
            shot = { x: st.gx, y: mid, zoom: zlerp(wide, A.zoomEnd, k), anchor: A.anchor, cut: false };
          }
        }
        break;
      }
      case "hold":
        // the stop: dead still
        shot = { ...(this.from ?? { x: st.gx, y: mid, zoom: C.flurry.zoomEnd, anchor: C.flurry.anchor }), cut: false };
        break;
      case "dive": {
        // a push down after her as she drops through the letter, arriving over the crater as she lands
        const A = C.dive;
        shot = this.move({ x: st.gx, y: st.floor - A.up * H, zoom: A.zoom, anchor: A.anchor }, easeIn((t + 1) / Math.max(1, L.dive)));
        break;
      }
      case "impact":
        // the pull-out on the nuke: the flash, the flames and the eruption all in frame
        shot = this.move({ x: st.gx, y: st.floor, zoom: C.impact.zoom, anchor: C.impact.anchor }, easeOut(t / Math.max(1, L.impact * 0.6)));
        break;
      case "aftermath": {
        // held on the wreck (the frame barely drifts), then, as the smoke clears, a slow push toward where she stands
        const A = C.aftermath, Hd = ULT.aftermath.hold;
        const held = { x: st.gx, y: st.floor, zoom: A.zoom, anchor: A.anchor };
        if (t < Hd) shot = this.move(held, smooth(t / Math.max(1, Hd)));
        else {
          const u = smooth((t - Hd) / Math.max(1, L.aftermath - Hd));
          shot = { x: lerp(held.x, b.x, u), y: st.floor, zoom: zlerp(A.zoom, A.zoomClear, u), anchor: A.anchor, cut: false };
        }
        break;
      }
      default:
        // the reveal: the dust clears and the frame pushes back in on her
        shot = this.move({ x: b.x, y: st.floor, zoom: C.reveal.zoom, anchor: C.reveal.anchor }, smooth(t / Math.max(1, C.reveal.ticks)));
    }
    return this.keep(shot);
  }

  /** Where she is in the flurry, for the chase: her body until she bursts into ash, then the newest slash (she IS the slashes). */
  private her(st: Stage, t: number): [number, number] {
    const b = this.stage && this.cut > 0 ? this.slashes[this.cut - 1] : null;
    if (t < this.beat.vanish || !b) {
      // launching: from where she stood toward the letter
      const u = clamp01((t - this.beat.vanish) / 6);
      return [lerp(st.x0, st.left + (st.f > 0 ? 0 : st.size), u), lerp(st.y0 - 0.5 * H, st.top + st.size * 0.6, u)];
    }
    return letterAt(st, ...along(letterStrokes()[b.stroke]!, (b.u0 + b.u1) / 2));
  }

  /** A camera move from where the phase began (the last shot before it) to `to`, u of the way (zoom even in log). */
  private move(to: Omit<Shot, "cut">, u: number): Shot {
    const a = this.from ?? { ...to, cut: false };
    return { x: lerp(a.x, to.x, u), y: lerp(a.y, to.y, u), zoom: zlerp(a.zoom, to.zoom, u), anchor: lerp(a.anchor, to.anchor, u), cut: false };
  }

  private keep(s: Shot): Shot {
    this.lastShot = s;
    return s;
  }
}
