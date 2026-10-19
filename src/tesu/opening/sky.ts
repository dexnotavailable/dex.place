// The opening's sky, the part that is the camera's own (Dex 10-16: "I need clouds, front fog layers on the camera, wind
// and stuff affecting the ofuda's path"): the air between the lens and the paper. Drawn LAST, over the world, the clouds
// and the paper: the one thing nearer than the paper.
//
// (fall loop, round 2, worker 2; rev 5's camera: the drop out of the black, the vast frame, the push-in, the fall)
// What it draws, all from one pass that reads a copy of the frame under it:
// - The lens fog (VEILS): layers of cloud lying in the camera's own space, each at its own depth, so they move as the
//   world does (they swell as the camera pushes in on them and rise past as it comes down; the nearer, the faster and
//   the bigger), drifting west on the east wind and churning inside (two noises of the same fog sliding past each
//   other: its holes open and close). The camera flies INTO the thick one on the push-in: the whole frame behind it
//   lifts toward the fog's own value (thick billows, thin patches, a few big torn holes), then it tears open as the
//   camera comes out of it. Its light is the sun's: a warm white on the sun's side, the clouds' own cool blue in its
//   shade, the sky's blue brightened where it is thin (never grey). Its translucency is a few flat steps whose edges
//   are clusters on the frame's own two-px grid (no blur of the world behind, no grain, no ordered dither).
// - The wind made visible (W2-6): ribbons of air (a long tapered stroke drawn on and wiped off along its own path, a
//   gentle wave and a curl at its head, as an anime wind line is drawn), sweeping west in the gusts; a few leaves
//   blown up from Kagami's trees tumbling across in them (two greens, lit on the sun's side); the fog's west edges
//   dragged out by the wind. All keyed to the paper's own gust envelope (beats.ts ofuda.gusts: lane F's, read only),
//   so the strongest wind lines up with the kink in its path.
// - The plunge (W2-11): as the camera drops out of the black slab (bar 0) and falls, streaks of air rush up past the
//   lens at full strength on the hit frame itself, dying as the fall slows into the vast frame (which stays clean).
// - The paper stays readable: the fog opens a torn hole round it, and no ribbon, leaf or streak comes near it.
// Pixel fog in the world's manner (DEX-EYE 6-7: authored in code; no image generation for fog, Dex 10-12).

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { FULL_VS } from "../../lab/engine/shaders.ts";
import type { Target } from "../../world/render/renderer.ts";
import { H } from "../config.ts";
import { BEATS } from "./beats.ts";
import { keysAt, monotone, paperScreenAt, type Way } from "./timeline.ts";
import type { PlaneId } from "../world/types.ts";
import { planeXf, rowOf, type CamState } from "../render/view.ts";

/**
 * A layer of the lens fog. It lies in the camera's space: at T its middle is at (fx, fy) on the frame, it spans
 * 2 w x 2 half of the frame, and it is `depth` from the lens (in the camera's 1 / zoom units: the play plane is 1 / zoom
 * away); from there it moves as the camera does. `through` > 0: the camera passes INTO it on the push-in and is
 * inside it for that many seconds round T (the frame inside the cloud); 0: it passes the lens beside the camera.
 * `speed`: how fast it crosses (render.mjs's fog strip spans 1.2 / speed s round T; its `lens-fog` frame is the layer
 * with the largest half x density). `pan`: the share of the camera's own pan it follows (1: as a world plane would;
 * less keeps a layer this near from streaking). `drift`: the east wind's push on it (layer px / s, gusts x 3).
 */
export interface Veil {
  T: number;
  speed: number;
  half: number;
  density: number;
  w: number;
  fx: number;
  fy: number;
  depth: number;
  through: number;
  pan: number;
  drift: number;
  tone: "lit" | "base";
}

/**
 * The fog layers (ways 1-3). Nothing in the vast frame (1.6-4.6: Dex's "wtf, there's a world below" stays clean).
 * The push-in (4.6-7.6, "pushed in on the paper, into the clouds") flies through a thin veil, then INTO the thick
 * cloud (the `lens-fog` frame) and out of it onto the paper among the clouds as the strongest gust begins; on the way
 * down (8.6-10.6) the deck's near fringe rises past the lens; the break-out under the deck is clear.
 */
export const VEILS: readonly Veil[] = [
  { T: 6.05, speed: 0.7, half: 0.34, density: 0.62, w: 0.62, fx: 0.62, fy: 0.5, depth: 0.32, through: 0.3, pan: 0.12, drift: 40, tone: "lit" },
  { T: 6.95, speed: 0.6, half: 0.62, density: 0.95, w: 0.8, fx: 0.44, fy: 0.48, depth: 0.2, through: 0.9, pan: 0.12, drift: 46, tone: "lit" },
  { T: 7.5, speed: 0.7, half: 0.26, density: 0.7, w: 0.5, fx: 0.18, fy: 0.62, depth: 0.42, through: 0, pan: 0.2, drift: 60, tone: "lit" },
  { T: 9.45, speed: 0.8, half: 0.22, density: 0.8, w: 0.9, fx: 0.42, fy: 0.55, depth: 0.42, through: 0, pan: 1, drift: 34, tone: "base" },
];

/** A fog layer on the frame now: its middle (frame px), scale (frame px per layer px), strength; its half sizes
 *  (layer px = frame px at its T), seed, tone (0 lit, 1 base); the churn's clock, the gust, how far the camera is
 *  through it (0..1: it tears open as the camera leaves), 0. */
export interface VeilDraw {
  cx: number;
  cy: number;
  g: number;
  alpha: number;
  hw: number;
  hh: number;
  seed: number;
  tone: number;
  churn: number;
  gust: number;
  out: number;
}

const GUSTS = BEATS.ofuda.gusts;
const GMAX = Math.max(...GUSTS.map((g) => Math.abs(g.dx)));

/** How hard the east wind gusts at T (0..1; the strongest gust peaks at 1): the paper's own envelope. */
export function gustAt(T: number): number {
  let g = 0;
  for (const q of GUSTS) {
    const u = (T - q.T) / q.dur;
    if (u > 0 && u < 1) g = Math.max(g, (Math.sin(Math.PI * u) * Math.abs(q.dx)) / GMAX);
  }
  return g;
}

/** The gusts' run to T: the integral of gustAt (seconds at full gust), so a drift speeds up in them and never jumps. */
export function gustRun(T: number): number {
  let s = 0;
  for (const q of GUSTS) {
    const u = Math.min(1, Math.max(0, (T - q.T) / q.dur));
    s += (Math.abs(q.dx) / GMAX) * (q.dur / Math.PI) * (1 - Math.cos(Math.PI * u));
  }
  return s;
}

/** The wind's run for a drift: base seconds plus `gain` times the gusts' run. */
const run = (T: number, gain: number): number => T + gain * gustRun(T);

const KEYS = BEATS.camera.keys;
/** How high the camera still is (H above her feet). */
export function altAt(T: number): number {
  return monotone(KEYS.map((k) => k.T), KEYS.map((k) => k.alt), T);
}

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const fr = (x: number): number => x - Math.floor(x);
const hash = (n: number): number => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);

/** The camera at T for the fall's own sums: 1 / zoom (its distance to the play plane), its middle x and eye-level
 *  row (world px, relative to her feet's row), the horizon row (frame px), the scale. */
function camAt(T: number, Hf: number, W: number): { iz: number; cx: number; eye: number; hz: number; zoom: number } {
  const s = keysAt(T, BEATS.her.catchXH * H, W, Hf);
  return { iz: 1 / s.zoom, cx: s.cx, eye: -((s.anchor - s.horizon) * Hf) / s.zoom, hz: s.horizon * Hf, zoom: s.zoom };
}

/** The point the push-in flies toward (the paper's place on the frame; the frame's middle when it is not in it). */
function focusAt(T: number, W: number, Hf: number): [number, number] {
  const p = paperScreenAt(T);
  return p ? [p[0] * W, p[1] * Hf] : [W / 2, Hf / 2];
}

/** The fog layers on the frame at T (none on way 4, none with reduced motion: they are pure motion). */
export function fallVeils(T: number, W: number, Hf: number, way: Way, reduced: boolean): VeilDraw[] {
  if (way === "bottom" || reduced) return [];
  const out: VeilDraw[] = [];
  const now = camAt(T, Hf, W);
  const fNow = focusAt(T, W, Hf);
  VEILS.forEach((v, i) => {
    if (Math.abs(T - v.T) > 3.2) return;
    const key = camAt(v.T, Hf, W);
    let s: number, sk: number, alpha: number, outN = 0;
    if (v.through > 0) {
      // the near face is met at T - through / 2, the far face left at T + through / 2 (the push-in only: 1 / zoom falls)
      const pn = camAt(v.T - v.through / 2, Hf, W).iz, pf = camAt(v.T + v.through / 2, Hf, W).iz;
      const D = now.iz - pn;
      const inside = pn > pf ? Math.min(1, Math.max(0, (pn - now.iz) / (pn - pf))) : 0;
      if (now.iz < pf || T > v.T + v.through) return;
      // approaching it swells from far away; inside, a slow swell; it tears open over the last part of the way out
      s = (1 / (v.depth + Math.max(D, 0))) * (1 + 0.7 * inside);
      sk = (1 / v.depth) * 1.35;
      alpha = smooth(1.6, 0.35, D);
      outN = smooth(0.3, 1, inside);
      alpha *= 1 - smooth(0.55, 1, inside);
    } else {
      // beside the camera: it nears and goes as the camera's distance to it changes (never through it)
      const p = key.iz - v.depth;
      const D = Math.max(0.05, now.iz - p);
      s = 1 / D;
      sk = 1 / v.depth;
      alpha = smooth(v.depth * 3.2, v.depth * 1.6, D) * smooth(1.5, 0.55, Math.abs(T - v.T));
    }
    if (alpha <= 0.003) return;
    const g = s / sk;
    // its middle: the push-in's swell about the point it flies toward, the camera's own pan (a share), the wind
    const fKey = focusAt(v.T, W, Hf);
    const mx = v.fx * W, my = v.fy * Hf;
    const wind = (run(T, 3) - run(v.T, 3)) * v.drift * g;
    const panX = -(now.cx - key.cx) * s * v.pan, panY = -(now.eye - key.eye) * s * v.pan;
    out.push({
      cx: fNow[0] + (mx - fKey[0]) * g + panX - wind,
      cy: fNow[1] + (my - fKey[1]) * g + panY,
      g, alpha: alpha * v.density,
      hw: v.w * W, hh: v.half * Hf, seed: i * 17.3 + 3.1, tone: v.tone === "base" ? 1 : 0,
      churn: T - v.T, gust: gustAt(T), out: outN,
    });
  });
  return out;
}

/** The wind's ribbons on the frame (W2-6): up to six at once in the strongest gust, one or two in a weak one. */
export const RIBBONS = 5;
/** Points along a ribbon (its visible stretch, tail to head). */
export const RIBBON_PTS = 24;

/**
 * The ribbons at T: RIBBON_PTS points each ([x, y, width px, alpha]), tail first. Each is a stroke of air carried west:
 * drawn on from its tail toward a curl at its head, then wiped off from the tail, over about a second and a half;
 * a gentle wave along it and a lift to the west (the gusts shove the paper west and up). They start round the paper
 * (the wind that moves it) and keep clear of it.
 */
export function fallRibbons(T: number, W: number, Hf: number, paper: readonly [number, number] | null, zoom: number): number[][][] {
  const out: number[][][] = [];
  const vast = zoom < 0.35;
  // each gust sends its own: more and longer in a stronger one, spread over it (the paper's own gust envelope)
  const sched: [number, number, number][] = [];
  GUSTS.forEach((q, gi) => {
    const m = Math.abs(q.dx) / GMAX;
    // (two at most in the vast frame: the world below stays the picture)
    const wide = keysAt(q.T + q.dur / 2, BEATS.her.catchXH * H, W, Hf).zoom < 0.35;
    const n = Math.min(wide ? 2 : 9, Math.round(1 + 6 * m * m));
    for (let j = 0; j < n; j++) {
      const t0 = q.T - 0.15 + q.dur * (0.04 + (0.78 * (j + 0.35 * hash(gi * 13.1 + j * 2.7))) / n);
      sched.push([t0, gi * 10 + j, m]);
    }
  });
  for (const [t0, k, m] of sched) {
    if (out.length >= RIBBONS) break;
    const r = (j: number): number => hash(k * 31.7 + j * 1.91 + 0.37);
    const life = 1.25 + 0.35 * r(1);
    const u = (T - t0) / life;
    if (u <= 0 || u >= 1) continue;
    const g = Math.max(m * 0.6, gustAt(t0 + 0.45 * life));
    const scale = vast ? 0.55 : 1;
    const L = (240 + 260 * r(2)) * scale;
    const A = (5 + 9 * r(3)) * scale;
    const lam = (170 + 160 * r(4)) * scale;
    const phi = r(5) * 6.283;
    const lift = (0.05 + 0.08 * r(6));
    const curlDir = r(7) < 0.7 ? -1 : 1;
    const r0 = (13 + 9 * r(8)) * scale;
    // where it starts (its east end): round where the paper was when it set off, never through it
    const [px, py] = focusAt(t0 + 0.3, W, Hf);
    let x0 = px + (0.06 + 0.32 * r(9)) * W * (vast ? 0.5 : 1);
    let y0 = py + (r(10) - 0.5) * Hf * (vast ? 0.32 : 0.62);
    if (Math.abs(y0 - py) < 56 * scale) y0 = py + Math.sign(y0 - py || 1) * (56 + 30 * r(11)) * scale;
    y0 = Math.min(Hf * 0.86, Math.max(Hf * 0.14, y0));
    // the wind carries the whole stroke west as it is drawn
    const carry = (T - t0) * (60 + 140 * g) * scale;
    x0 -= carry;
    const head = Math.min(1, smooth(0, 0.62, u) * 1.0);
    const tail = smooth(0.32, 1, u);
    if (head - tail < 0.02) continue;
    const curlFrom = 0.8;
    const at = (s: number): [number, number] => {
      const sm = Math.min(s, curlFrom);
      const x = x0 - sm * L;
      const y = y0 + A * Math.sin((6.283 * sm * L) / lam + phi) - lift * sm * L;
      if (s <= curlFrom) return [x, y];
      // the curl: from the body's end, turning on itself, its radius closing
      const e = 0.002;
      const xa = x0 - (curlFrom - e) * L, ya = y0 + A * Math.sin((6.283 * (curlFrom - e) * L) / lam + phi) - lift * (curlFrom - e) * L;
      let tx = x - xa, ty = y - ya;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      // the normal toward the curl's side (up: -y on the frame)
      let nx = -ty, ny = tx;
      if ((ny > 0 ? 1 : -1) !== curlDir) { nx = -nx; ny = -ny; }
      const cxp = x + nx * r0, cyp = y + ny * r0;
      const v0x = -nx * r0, v0y = -ny * r0;
      // the turning sense that carries on along the body's direction
      const sg = (-v0y * tx + v0x * ty) > 0 ? 1 : -1;
      const q = (s - curlFrom) / (1 - curlFrom);
      const ang = sg * q * 5.6;
      const rr = 1 - 0.62 * q;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      return [cxp + (v0x * ca - v0y * sa) * rr, cyp + (v0x * sa + v0y * ca) * rr];
    };
    // (gone before its tail reaches the curl: a curl left alone reads as a stray hook)
    const fade = smooth(0, 0.12, u) * (1 - smooth(0.45, 0.72, tail));
    const pts: number[][] = [];
    for (let j = 0; j < RIBBON_PTS; j++) {
      // (denser toward the head, where the curl turns)
      const v = 1 - Math.pow(1 - j / (RIBBON_PTS - 1), 1.45);
      const s = tail + (head - tail) * v;
      const [x, y] = at(s);
      // thick behind the head, a hair at the tail, thinner round the curl
      let wd = (1 + 1.7 * smooth(0.08, 0.6, v) * (1 - 0.45 * smooth(0.85, 1, v))) * (s > curlFrom ? 0.75 : 1) * (vast ? 0.75 : 1);
      let a = (0.22 + 0.6 * smooth(0, 0.65, v)) * fade;
      if (paper) {
        const d = Math.hypot(x - paper[0], y - paper[1]);
        a *= smooth(28, 56, d);
        wd *= 1;
      }
      pts.push([x, y, wd, a]);
    }
    out.push(pts);
  }
  return out;
}

/** The leaves blown across in the gusts (W2-6, ref 04's leaves): ten at most. */
export const LEAVES = 10;

/**
 * The leaves at T: [x, y, turn (rad), face (-1..1: its tumble; the sign is which side shows), length px, kind, alpha]
 * each. Blown up from Kagami's trees, they come in from the east edge in the gusts and tumble west across the frame,
 * bobbing and rising a little; never near the paper. Not in the vast frame (a leaf would be the paper's size there).
 */
export function fallLeaves(T: number, W: number, Hf: number, paper: readonly [number, number] | null, zoom: number): number[][] {
  const out: number[][] = [];
  if (zoom < 0.45) return out;
  const sched: [number, number][] = [];
  GUSTS.forEach((q, gi) => {
    const m = Math.abs(q.dx) / GMAX;
    if (q.T < 6) return;
    const n = Math.round(2 + 7 * m * m);
    for (let j = 0; j < n; j++) sched.push([q.T - 0.3 + q.dur * ((j + 0.6 * hash(gi * 7.7 + j * 3.3)) / n) * 0.85, gi * 20 + j]);
  });
  for (const [t0, k] of sched) {
    if (out.length >= LEAVES) break;
    const r = (j: number): number => hash(k * 17.9 + j * 2.31 + 0.71);
    const age = T - t0;
    if (age < 0) continue;
    const v0 = 330 + 330 * r(1);
    const x = W + 24 - v0 * (age + 2.2 * (gustRun(T) - gustRun(t0)));
    if (x < -30 || age > 9) continue;
    const y0 = (0.12 + 0.76 * r(2)) * Hf;
    const y = y0 + 18 * Math.sin(age * (2.4 + 2 * r(3)) + r(4) * 6.283) - (36 + 50 * r(5)) * age;
    let a = 1;
    if (paper) a *= smooth(26, 44, Math.hypot(x - paper[0], y - paper[1]));
    if (a <= 0.05) continue;
    const turn = r(6) * 6.283 + (r(7) < 0.5 ? -1 : 1) * (3 + 5 * r(8)) * age;
    const face = Math.cos(r(9) * 6.283 + (5 + 6 * r(10)) * age);
    const len = 7 + 3.5 * r(11);
    out.push([Math.round(x), Math.round(y), turn, face, len, r(12) < 0.65 ? 0 : 1, a]);
  }
  return out;
}

/** The plunge's streaks of air (W2-11): rushing up past the lens while the camera falls out of the black. */
export const STREAKS = 8;

/**
 * The streaks at T: [x, y (its top), length, width, alpha, sway px, phase] each. From the moment the camera starts to
 * drop (the slab's black is drawn over them until its edge has passed: the sky and they come in together, at full
 * strength by bar 0), dying as the fall slows into the vast frame (gone by 2.3 s: the world below stays clean).
 * Tapered hair-thin lines, pointed at both ends, a little curved (never ruled), rushing up (their tops brightest),
 * clear of the paper's column.
 */
export function fallStreaks(T: number, W: number, Hf: number, paper: readonly [number, number] | null): number[][] {
  const out: number[][] = [];
  const from = KEYS[1]?.T ?? 0.3;
  if (T < from) return out;
  const k = 1 - smooth(1.2, 2.3, T);
  if (k <= 0) return out;
  // how far the air has rushed past (frame px): the camera's fall, quick
  const rushed = (T - from) * 4600 * (0.55 + 0.45 * k);
  for (let i = 0; i < STREAKS; i++) {
    // (hair-thin lines only: a broad shred read as a candle)
    const broad = false;
    let fx = hash(i * 9.7 + 0.3);
    // keep the paper's column clear (the middle fifth of the frame)
    if (fx > 0.4 && fx < 0.6) fx = fx < 0.5 ? fx - 0.19 : fx + 0.19;
    const x = fx * W;
    const speed = 0.7 + 0.6 * hash(i * 3.3 + 1.1);
    const len = (broad ? 300 : 150) + 260 * k * speed;
    const span = Hf + len + 200;
    const y = fr(hash(i * 5.1 + 2.7) - (rushed * speed) / span) * span - len - 100;
    let a = (broad ? 0.2 : 0.55) * (0.5 + 0.5 * k);
    if (paper && Math.abs(x - paper[0]) < 90) a *= Math.min(1, Math.abs(x - paper[0]) / 90);
    const wd = broad ? 18 + 22 * hash(i * 2.2) : 1.4 + 0.8 * hash(i * 4.4);
    out.push([Math.round(x), Math.round(y), len, wd, a, (broad ? 10 : 5) * (hash(i * 6.6) - 0.5) * 2, hash(i * 8.8) * 6.283]);
  }
  return out;
}

/** What the pass draws this frame. */
export interface FallAir {
  veils: VeilDraw[];
  gust: number;
  ribbons: number[][][];
  leaves: number[][];
  streaks: number[][];
  paper: [number, number] | null;
  sun: [number, number];
  /** Warm light shafts slanting from the deck's gaps (top-left) under the cloud deck: strength 0..1. */
  shafts: number;
}

/** The air of the fall at T (null when there is nothing to draw: way 4, reduced motion). */
export function fallAir(T: number, W: number, Hf: number, way: Way, reduced: boolean, paper: [number, number] | null, sun: readonly number[] | null): FallAir | null {
  if (way === "bottom" || reduced) return null;
  // nothing of the air before the camera starts to drop out of the black slab (rev 5: lanes\art\fall\ASKS.txt,
  // 10-20); the slab's black is drawn over it until its edge has passed, so the sky and the rushing air come in
  // together: on bar 0 everything of ours on the frame is at full strength (no fade at the hit)
  if (T < (KEYS[1]?.T ?? 0.3)) return null;
  const zoom = keysAt(T, BEATS.her.catchXH * H, W, Hf).zoom;
  const sunAt: [number, number] = sun && (sun[0]! !== 0 || sun[1]! !== 0) ? [sun[0]!, sun[1]!] : [0.2 * W, 0.11 * Hf];
  // under the deck from the break-out to the orchestra: light breaking through its gaps onto the haze
  const shafts = Math.min(1, Math.max(0, (T - 9.7) / 0.8)) * Math.min(1, Math.max(0, (14.6 - T) / 1.4));
  return {
    veils: fallVeils(T, W, Hf, way, reduced), gust: gustAt(T),
    ribbons: fallRibbons(T, W, Hf, paper, zoom), leaves: fallLeaves(T, W, Hf, paper, zoom), streaks: fallStreaks(T, W, Hf, paper),
    paper, sun: sunAt, shafts,
  };
}

/**
 * The haze of the fall's last stretch (W2-8 / W2-9 / W2-10), lying at depths in the world (each at its own plane rate:
 * it parallaxes with the land it wraps; drawn by the plane loop before the plane named `before`). Heights are its own
 * depth's art px. Ref 01's valley: mist pooled in layered bands between the planes, each a little whiter than the air
 * behind it (it reads by its lit, heaped top), thicker low, brighter on the sun's side.
 * - `bank`: a mist bank on the far water behind the far karsts: a heaped, torn top, thick in its body, thin at its
 *   foot, so the lake's far edge meets Kagami's own waterline mist there (never a bank cut by the water's edge).
 * - `band`: a band of mist floating between two planes (its top heaped and lit, its underside flatter and cooler,
 *   torn into lengths with clear air between them), lifted off the water.
 * - `ribbon`: a thin torn ribbon low over the water, drifting west (at the catch: a last breath of the fall's air on
 *   the far water, there until she walks).
 * - `air`: the mid-air haze under the deck at the orchestra (0.3 of the frame above the horizon row).
 * `from` / `to`: T it fades in over 0.8 s and out over `out` s (1 by default).
 */
export const HAZE: readonly { kind: "bank" | "band" | "ribbon" | "air"; before: PlaneId; rate: number; from: number; to: number; out?: number; lift: number; height: number; density: number; drift: number; seed: number }[] = [
  { kind: "bank", before: "far", rate: 0.06, from: 9.3, to: 13.4, lift: 4, height: 300, density: 0.85, drift: 6, seed: 3.7 },
  { kind: "band", before: "mid", rate: 0.16, from: 9.4, to: 14.4, lift: 58, height: 84, density: 0.62, drift: 10, seed: 12.9 },
  { kind: "band", before: "back", rate: 0.42, from: 9.5, to: 12.0, out: 1.2, lift: 64, height: 60, density: 0.62, drift: 15, seed: 31.3 },
  { kind: "ribbon", before: "mid", rate: 0.2, from: 9.5, to: 14.6, lift: 13, height: 34, density: 0.72, drift: 13, seed: 9.1 },
  { kind: "ribbon", before: "mid", rate: 0.12, from: 14.2, to: BEATS.her.walkFrom, out: 1.6, lift: 7, height: 48, density: 0.92, drift: 9, seed: 21.4 },
  { kind: "air", before: "play", rate: 1, from: 11.2, to: 14.8, lift: 0, height: 0.18, density: 0.42, drift: 9, seed: 17.3 },
];

/** A haze layer on the frame now: its foot row, height (px), density, x offset; seed, kind (0 bank, 1 ribbon, 2 air,
 *  3 band). */
export interface HazeDraw {
  row: number;
  height: number;
  density: number;
  x: number;
  seed: number;
  kind: number;
}

const HAZE_KIND = { bank: 0, ribbon: 1, air: 2, band: 3 } as const;

/** The haze layers drawn before plane `before` at T (none on way 4 or with reduced motion). */
export function fallHaze(T: number, way: Way, reduced: boolean, before: PlaneId, cam: CamState, waterY: number | null): HazeDraw[] {
  if (way === "bottom" || reduced || waterY === null) return [];
  const out: HazeDraw[] = [];
  for (const h of HAZE) {
    if (h.before !== before) continue;
    const k = Math.min(1, Math.max(0, (T - h.from) / 0.8)) * Math.min(1, Math.max(0, (h.to - T) / (h.out ?? 1)));
    if (k <= 0) continue;
    const xf = planeXf(cam, h.rate);
    // (one art px at its depth is xf.g frame px)
    const g = xf.g;
    const x = Math.round(T * h.drift - xf.offX);
    if (h.kind === "air") {
      // between the deck's base and the far karsts' tops: a share of the frame above the horizon
      const hz = cam.horizon * cam.H;
      out.push({ row: hz - 0.3 * cam.H, height: h.height * cam.H, density: h.density * k, x, seed: h.seed, kind: 2 });
      continue;
    }
    const wl = rowOf(cam, h.rate, waterY);
    out.push({ row: wl - h.lift * g, height: Math.max(6, h.height * g), density: h.density * k, x, seed: h.seed, kind: HAZE_KIND[h.kind] });
  }
  return out;
}

const HAZE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec4 uH[6];    // foot row, height (px), density, x offset
uniform vec4 uH2[6];   // seed, kind (0 bank, 1 ribbon, 2 air, 3 band), 0, 0
uniform int uHN;
uniform vec2 uSun;
out vec4 o;
float h2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h2(i), b = h2(i + vec2(1.0, 0.0)), c = h2(i + vec2(0.0, 1.0)), d = h2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vn(p);
    p = p * 2.07 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return s / 0.9375;
}
void main() {
  vec2 p = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  float A = 0.0, lit = 0.0;
  vec2 anc = vec2(0.0);
  for (int i = 0; i < 6; i++) {
    if (i >= uHN) break;
    vec4 h = uH[i], hk = uH2[i];
    float x = p.x + h.w;
    float d = 0.0, l = 0.0;
    if (hk.y < 0.5) {
      // the bank: a heaped, torn top (big heaps carrying smaller ones), thickest in its body; thin at its foot, so the
      // lake's far edge meets Kagami's own waterline mist there, never a bright bank cut by the water's straight edge
      float heap = 0.6 * fbm(vec2(x / 260.0, hk.x)) + 0.4 * fbm(vec2(x / 90.0, hk.x + 3.0));
      float top = h.x - h.y * (0.35 + 0.85 * heap);
      float u = (p.y - top) / max(1.0, h.x - top);
      float tear = fbm(vec2(x / 70.0, (p.y - h.x) / 14.0) + hk.x * 2.0);
      float foot = 0.2 + 0.8 * smoothstep(0.0, h.y * 0.35, h.x - p.y + 10.0 * (tear - 0.5));
      d = smoothstep(-0.12, 0.45, u + (tear - 0.5) * 0.5) * foot * step(p.y, h.x + 2.0);
      l = 1.0 - smoothstep(0.0, 0.5, u);
    } else if (hk.y < 1.5) {
      // the ribbon: thin, torn into lengths with gaps of clear air
      float n = fbm(vec2(x / 170.0, hk.x));
      float hw = h.y * 0.5 * (0.3 + 0.9 * n);
      // it rides up and down along its length (never a ruled line), in lengths with clear air between them
      float c = h.x - h.y * 0.5 + h.y * 0.9 * (fbm(vec2(x / 260.0, hk.x + 5.0)) - 0.5);
      float e = 1.0 - abs(p.y - c) / max(1.0, hw);
      float st = fbm(vec2(x / 46.0, (p.y - c) / 3.0) + hk.x);
      d = smoothstep(0.0, 0.55, e + (st - 0.5) * 0.6) * smoothstep(0.46, 0.62, n);
      l = 1.0 - smoothstep(-0.5, 0.5, (p.y - c) / max(1.0, hw));
    } else if (hk.y < 2.5) {
      // the air: a soft haze lying under the deck, thickest at its middle row, its top and foot torn
      float u = (p.y - h.x) / h.y;
      float n = fbm(vec2(x / 320.0, p.y / 70.0) + hk.x);
      d = exp(-u * u * 2.2) * (0.55 + 0.7 * n);
      l = 1.0 - smoothstep(-1.0, 1.0, u);
    } else {
      // the band: floating between planes, its top heaped (big heaps carrying small), its underside flatter, torn into
      // lengths with clear air between them; lit along its top, cooler underneath
      float heap = 0.6 * fbm(vec2(x / 230.0, hk.x)) + 0.4 * fbm(vec2(x / 70.0, hk.x + 3.0));
      float mid = h.x - h.y * 0.45 + h.y * 0.35 * (fbm(vec2(x / 520.0, hk.x + 5.0)) - 0.5);
      float top = mid - h.y * (0.2 + 0.7 * heap);
      float bot = mid + h.y * (0.18 + 0.22 * fbm(vec2(x / 150.0, hk.x + 8.0)));
      float len = smoothstep(0.38, 0.5, fbm(vec2(x / 380.0, hk.x + 11.0)));
      float tear = fbm(vec2(x / 90.0, p.y / 9.0) + hk.x * 2.0);
      float inT = (p.y - top) / max(1.0, bot - top);
      d = step(0.0, inT) * step(inT, 1.0 + 0.12 * (tear - 0.5)) * len * (0.75 + 0.25 * smoothstep(0.0, 0.3, inT));
      d *= smoothstep(-0.05, 0.25, (bot - p.y) / max(1.0, bot - top) + 0.4 * (tear - 0.5));
      l = 1.0 - smoothstep(0.0, 0.7, inT);
    }
    d = clamp(d, 0.0, 1.0) * h.z;
    if (d > A) { A = d; lit = l; anc = vec2(h.w, 0.0); }
  }
  if (A <= 0.004) discard;
  // fine steps, their edges clustered noise riding on the drift (no ordered dither, no outline ring)
  vec2 ac = vec2(p.x + anc.x, p.y);
  float t = clamp(0.5 + 0.7 * (vn(ac / 4.0) - 0.5) + 0.25 * (vn(ac / 11.0 + 3.0) - 0.5), 0.02, 0.98);
  float a = floor(A * 0.88 * 8.0 + t) / 8.0;
  if (a <= 0.0) discard;
  // Kagami's mist family, a little whiter than the hazy air behind it so each layer reads by its lit top: a milky
  // white-cyan body, its underside cooler, warm-lit along its top, brighter on the sun's side (where light falls)
  float sunSide = 1.0 - smoothstep(0.0, uRes.x * 0.9, abs(p.x - uSun.x));
  vec3 body = vec3(0.915, 0.945, 0.94), shade = vec3(0.845, 0.9, 0.915), top = vec3(1.0, 0.975, 0.93);
  float lq = floor(lit * 3.0 + t) / 3.0;
  vec3 c = mix(mix(shade, body, step(0.33, lq)), top, step(0.99, lq) * (0.55 + 0.45 * sunSide));
  c = min(c + vec3(0.025, 0.02, 0.01) * sunSide, vec3(1.0));
  o = vec4(c * a, a);
}`;

const FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D uSrc;   // the frame under the pass (the world, the clouds, the paper)
uniform sampler2D uSky;   // (fall loop r1, integration) the frame with only the sky drawn (the fall's sky, the sun)
uniform float uSkyOn;     // 1 when uSky holds this frame's sky
uniform vec4 uL0[6];      // a fog layer: its middle (frame px), scale (frame px per layer px), strength
uniform vec4 uL1[6];      // its half sizes (layer px), seed, tone (0 lit, 1 base)
uniform vec4 uL2[6];      // the churn's clock (s), the gust (0..1), how far through it the camera is (0..1), 0
uniform int uN;
uniform vec4 uPaper;      // x, y, on, 0
uniform vec4 uSun;        // x, y
uniform vec4 uRib[120];   // the wind's ribbons: 5 x 24 points (x, y, width, alpha), tail first
uniform int uNR;
uniform vec4 uLeaf[20];   // the leaves: (x, y, turn, face), (length, kind, alpha, 0)
uniform int uNL;
uniform vec4 uStreak[20]; // the plunge's streaks: (x, top, length, width), (alpha, sway px, phase, 0)
uniform int uNS;
uniform vec4 uShaft;      // the light shafts' strength (0..1)
out vec4 o;

float h2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h2(i), b = h2(i + vec2(1.0, 0.0)), c = h2(i + vec2(0.0, 1.0)), d = h2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// three octaves: the fog's forms (no fine grain: its edges are the frame's own clusters, below)
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vn(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return s / 0.875;
}
// two octaves: the billows' broad forms (their light is read from these: broad lit sides, never a mottle)
float fbm2(vec2 p) {
  return (0.5 * vn(p) + 0.25 * vn(p * 2.03 + vec2(17.1, 9.7))) / 0.75;
}
vec3 src(vec2 p) {
  vec2 q = clamp(p, vec2(0.0), uRes - 1.0);
  return texelFetch(uSrc, ivec2(int(q.x), int(uRes.y - 1.0 - q.y)), 0).rgb;
}
vec3 skySrc(vec2 p) {
  vec2 q = clamp(p, vec2(0.0), uRes - 1.0);
  return texelFetch(uSky, ivec2(int(q.x), int(uRes.y - 1.0 - q.y)), 0).rgb;
}
// (fall loop r1, integration) the deck's shadow on the air under it: a shaft shows only over open air (never over the
// deck's body or a karst) and only where the way back up toward the sun leaves the frame through open air (a gap in
// the deck); a long run of something drawn over the sky on that way (the deck's body, a karst, an isle) shades it.
// Thin haze changes the sky by less than the threshold; short crossings are forgiven.
float shaftLit(vec2 p, vec2 dir) {
  if (uSkyOn < 0.5) return 1.0;
  vec3 d0 = abs(src(p) - skySrc(p));
  if (max(d0.r, max(d0.g, d0.b)) > 0.1) return 0.0;
  float runB = 0.0, best = 0.0;
  for (int k = 1; k < 48; k++) {
    vec2 q = p - dir * (float(k) * 14.0);
    if (q.y < 0.0) break;
    vec3 d = abs(src(q) - skySrc(q));
    runB = max(d.r, max(d.g, d.b)) > 0.1 ? runB + 1.0 : 0.0;
    best = max(best, runB);
    if (best >= 5.0) break;
  }
  return 1.0 - smoothstep(2.0, 5.0, best);
}

// --- the fog: each layer is a few veils of cloud laid over one another, each a flat translucent shape with a torn,
// billowing pixel edge (the clouds' own family, thinned: lit along its sun-side edge, cooler along its underside), so
// the fog builds up in clean layers where they overlap and the sky shows where none lies (its torn holes). A painter's
// fog, never a gradient, never grain. q: layer px from its middle (frame px at the layer's T).
// the layer's mass: where its veils may lie (a soft outline torn at its own scale; its west side trailing in the gusts)
float massOf(vec2 q, int i) {
  vec4 b = uL1[i], c = uL2[i];
  float sd = b.z;
  float L = clamp(min(b.x, b.y) * 0.8, 120.0, 520.0);
  vec2 wq = q / (L * 0.85) + vec2(sd, sd * 0.37) + vec2(c.x * 0.05, 0.0);
  vec2 w = vec2(fbm3(wq), fbm3(wq + vec2(5.2, 1.9))) - 0.5;
  vec2 qe = q + w * L * 1.1;
  float west = smoothstep(0.25, -0.9, qe.x / b.x);
  float ex = qe.x / (b.x * mix(1.0, 1.45 + 0.7 * c.y, west));
  float ey = qe.y / b.y;
  return 1.0 - ex * ex - ey * ey;
}
// veil k of layer i at q: > 0 inside (its billowing edge where it crosses 0)
float veilOf(vec2 q, int i, int k, float mass) {
  vec4 b = uL1[i], c = uL2[i];
  float fk = float(k);
  float sc = 300.0 * (k == 0 ? 1.15 : (k == 1 ? 0.85 : (k == 2 ? 0.66 : 1.0)));
  // each veil a little nearer or farther than the next (they swell at different rates) and sliding west at its own
  // speed, so they pass over one another and the holes between them open and close
  vec2 qk = q / (1.0 + 0.07 * (fk - 1.5) * clamp(log(uL0[i].z), -2.0, 2.0));
  qk.x += c.x * (14.0 + 16.0 * fk) * (1.0 + 1.5 * c.y);
  // (the gusts drag it out along the wind: its forms stretch west-east)
  vec2 v = vec2(qk.x / (sc * 1.9 * (1.0 + 1.3 * c.y)), qk.y / sc) + vec2(b.z * (1.3 + fk), b.z * 0.7 + fk * 3.1);
  vec2 w = vec2(fbm3(v * 0.7 + 3.3), fbm3(v * 0.7 + 8.1)) - 0.5;
  vec2 vw = v + w * 0.9;
  vw += (vec2(vn(vw * 3.1 + 2.2), vn(vw * 3.1 + 6.6)) - 0.5) * 0.22;
  float f = (fbm3(vw) * 0.875 + 0.1 * (vn(vw * 4.3 + 23.0) - 0.5)) / 0.875;
  return f - 0.5 + 0.55 * (mass - 0.25) - 0.22 * c.z;
}

// the plunge's streaks, the wind's ribbons and the leaves: drawn over the fog (they are nearer still)
vec4 ribbonAt(vec2 p) {
  float best = 0.0;
  for (int r = 0; r < 5; r++) {
    if (r >= uNR) break;
    // its box first (most pixels are far from every ribbon)
    vec2 lo = vec2(1e5), hi = vec2(-1e5);
    for (int j = 0; j < 24; j += 2) { lo = min(lo, uRib[r * 24 + j].xy); hi = max(hi, uRib[r * 24 + j].xy); }
    lo = min(lo, uRib[r * 24 + 23].xy); hi = max(hi, uRib[r * 24 + 23].xy);
    if (p.x < lo.x - 24.0 || p.x > hi.x + 24.0 || p.y < lo.y - 24.0 || p.y > hi.y + 24.0) continue;
    for (int j = 0; j < 23; j++) {
      vec4 a = uRib[r * 24 + j], b = uRib[r * 24 + j + 1];
      vec2 ab = b.xy - a.xy;
      float t = clamp(dot(p - a.xy, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
      float d = length(p - a.xy - ab * t);
      float w = mix(a.z, b.z, t) * 0.5;
      float al = mix(a.w, b.w, t);
      // a hard core and one softer px beside it (a drawn line, not a blur)
      float cov = d < w + 0.25 ? 1.0 : (d < w + 1.1 ? 0.38 : 0.0);
      best = max(best, cov * al);
    }
  }
  return vec4(vec3(0.985, 0.98, 0.965), best);
}

void main() {
  vec2 px = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  vec2 toP = uPaper.z > 0.5 ? px - uPaper.xy : vec2(1e4);
  float paperD = length(toP);
  bool touched = false;
  vec3 bg = src(px);

  // --- the fog: a milky lift over the whole of each layer's mass (its few big torn holes thinner), and veil over veil
  // on it, each a faint flat sheet with a crisp torn pixel edge, so the fog builds up in clean layers where they
  // overlap; the paper keeps a thinner patch round it
  // (a hole of its own: a torn edge, crisp like the veils', long along the wind; right at the paper a smaller one)
  vec2 tp = toP / vec2(230.0, 72.0);
  float rag = (fbm3(px / 46.0 + 7.7) - 0.5) * 1.3 + (vn(px / 9.0 + 1.1) - 0.5) * 0.25;
  float tear = uPaper.z > 0.5 ? step(dot(tp, tp) + rag, 0.62) : 0.0;
  float clear = uPaper.z > 0.5 ? (paperD + (vn(px / 4.0 + 3.7) - 0.5) * 4.0 < 7.0 ? 1.0 : 0.0) : 0.0;
  float keep = 1.0, baseW = 0.0, wsum = 0.0, lightS = 0.0;
  vec2 anchor = vec2(0.0);
  float amax = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uN) break;
    vec4 l0 = uL0[i], b = uL1[i], c = uL2[i];
    vec2 q = (px - l0.xy) / l0.z;
    if (abs(q.x) > b.x * 2.6 || abs(q.y) > b.y * 2.4) continue;
    float mass = massOf(q, i);
    if (mass < -0.9) continue;
    // the lift: steps of the mass (its outline torn), lower in its holes (few, big, long along the wind; they open
    // as the camera comes out of it)
    vec2 hq = vec2(q.x / (1.7 * 330.0), q.y / 330.0) + vec2(b.z * 2.1 - c.x * 0.14, b.z * 1.1 + c.x * 0.04) + 5.0;
    float hn = fbm3(hq + 0.35 * (vec2(fbm3(hq * 1.9 + 4.4), fbm3(hq * 1.9 + 9.2)) - 0.5));
    float th = 0.3 + 0.3 * c.z;
    vec2 fp = px - l0.xy;
    // (its rim torn at the frame's own scale too, whatever the layer's swell)
    hn += 0.028 * (vn(fp / vec2(18.0, 11.0) + 9.9) - 0.5);
    float hole = step(hn, th);
    vec2 mq = vec2(q.x / 1.6, q.y) / 150.0 + b.z * 3.0;
    float m = mass + (fbm3(mq + 0.5 * (vec2(vn(mq * 2.3 + 1.0), vn(mq * 2.3 + 7.0)) - 0.5)) - 0.5) * 1.5;
    m += 0.14 * (vn(fp / vec2(22.0, 13.0) + 4.4) - 0.5);
    float lift = (m > 0.4 ? 0.48 : (m > -0.05 ? 0.27 : 0.0)) * (1.0 - 0.72 * hole);
    float a = 1.0 - (1.0 - lift * l0.w);
    float k1 = 1.0 - a;
    for (int k = 0; k < 2; k++) {
      // (its edge torn at the frame's own scale too, whatever the layer's swell: lumps and tongues of a few px)
      float fk = float(k);
      float f = veilOf(q, i, k, mass) + 0.05 * (vn(fp / vec2(16.0, 10.0) + fk * 5.3) - 0.5);
      if (f <= 0.0) continue;
      // a veil's own light: a touch brighter along its sun-side edge
      k1 *= 1.0 - l0.w * (k == 0 ? 0.24 : 0.2) * (1.0 - 0.6 * hole);
    }
    a = 1.0 - k1;
    a *= 1.0 - 0.7 * clear;
    if (a <= 0.003) continue;
    keep *= 1.0 - a;
    // the light of the mass: lit on its sun side (upper left), cool in its own shade (lower right, broad)
    float ml = clamp(0.5 + 0.9 * (massOf(q + normalize(uSun.xy - px + vec2(0.001)) * 120.0 / l0.z, i) - mass) * -1.0, 0.0, 1.0);
    lightS += ml * a;
    wsum += a;
    baseW += b.w * a;
    if (a > amax) { amax = a; anchor = l0.xy; }
  }
  float D = 1.0 - keep;
  if (D > 0.003) {
    float base = baseW / max(wsum, 1e-4);
    float sunNear = 1.0 - smoothstep(0.0, uRes.x * 0.9, length(px - uSun.xy));
    float light = clamp(0.25 * (lightS / max(wsum, 1e-4)) + 0.62 * sunNear + 0.12 - 0.22 * (px.y / uRes.y), 0.0, 1.0);
    // round the paper the fog lies in its own shade (a cooler, deeper patch of it: the bright paper reads on it)
    if (tear > 0.5) light = min(light, 0.2);
    vec2 ap = px - anchor;
    float lq = floor(light * 4.0 + 0.5 + 0.2 * (vn(ap / 8.0) - 0.5) + 0.3 * (vn(ap / 23.0 + 5.0) - 0.5)) / 4.0;
    vec3 c4 = mix(vec3(1.0, 0.978, 0.945), vec3(0.95, 0.962, 0.978), base);
    vec3 c3 = mix(vec3(0.935, 0.955, 0.98), vec3(0.87, 0.905, 0.955), base);
    vec3 c2 = mix(vec3(0.85, 0.905, 0.965), vec3(0.77, 0.84, 0.93), base);
    vec3 c1 = mix(vec3(0.74, 0.835, 0.935), vec3(0.65, 0.76, 0.89), base);
    vec3 fog = lq >= 1.0 ? c4 : (lq >= 0.75 ? c3 : (lq >= 0.5 ? c2 : c1));
    // a film this thin over the deep sky is the sky's own light scattered (a luminous cerulean, never grey)
    vec3 glow = min(bg * vec3(1.04, 1.08, 1.06) + vec3(0.3, 0.33, 0.29), vec3(1.0));
    fog = mix(glow, fog, smoothstep(0.1, 0.24, D));
    bg = mix(bg, fog, D);
    touched = true;
  }

  // --- the light shafts under the deck: warm and faint, slanting down-right from its gaps on the sun's side
  if (uShaft.x > 0.003) {
    vec2 dir = normalize(vec2(0.42, 1.0));
    vec2 perp = vec2(dir.y, -dir.x);
    vec2 r = px - vec2(uSun.x + 0.04 * uRes.x, uRes.y * 0.06);
    float along = dot(r, dir), across = dot(r, perp);
    if (along > 0.0) {
      float sh = smoothstep(0.56, 0.8, vn(vec2(across / 52.0, 3.0))) * (0.55 + 0.45 * vn(vec2(across / 14.0, 7.0)));
      float fade = exp(-along / (uRes.y * 0.7)) * smoothstep(0.0, 140.0, along) * (1.0 - smoothstep(0.2, 0.55, abs(across) / uRes.x));
      float a = uShaft.x * 0.16 * sh * fade * smoothstep(40.0, 90.0, paperD);
      if (uSkyOn > 0.5) {
        float beam = (0.5 + 0.5 * smoothstep(0.35, 0.75, vn(vec2(across / 52.0, 3.0)))) * (0.6 + 0.4 * vn(vec2(across / 14.0, 7.0)));
        float drop = exp(-max(0.0, px.y - uRes.y * 0.1) / (uRes.y * 0.6)) * smoothstep(0.0, 140.0, along);
        a = uShaft.x * 0.22 * beam * drop * smoothstep(40.0, 90.0, paperD);
        if (a > 0.004) a *= shaftLit(px, dir);
      }
      float t = clamp(0.5 + 0.8 * (vn(px / 2.6 + 19.0) - 0.5), 0.05, 0.95);
      float aq = floor(a * 30.0 + t) / 30.0;
      if (aq > 0.0) {
        bg = mix(bg, vec3(1.0, 0.95, 0.82), aq);
        touched = true;
      }
    }
  }

  // --- the plunge's streaks: air rushing up past the lens: tapered spindles, a little curved, their tops brightest
  for (int i = 0; i < 10; i++) {
    if (i >= uNS) break;
    vec4 s = uStreak[i * 2], s2 = uStreak[i * 2 + 1];
    if (px.y < s.y || px.y > s.y + s.z) continue;
    float u = (px.y - s.y) / s.z;
    float cx = s.x + s2.y * sin(u * 2.6 + s2.z);
    float hw = s.w * 0.5 * pow(sin(3.14159 * u), 0.7) * (1.0 - 0.35 * u);
    float dx = abs(px.x - cx);
    if (dx > hw + 0.6) continue;
    float a = s2.x * (1.0 - smoothstep(0.1, 1.0, u)) * smoothstep(0.0, 0.08, u);
    // a broad one is a soft shred of cloud: its sides fall off in two steps
    if (s.w > 3.0) a *= dx < hw * 0.4 ? 1.0 : (dx < hw * 0.75 ? 0.62 : 0.3);
    float aq = floor(a * 6.0 + 0.5) / 6.0;
    if (aq > 0.0) {
      bg = mix(bg, vec3(0.965, 0.98, 1.0), aq);
      touched = true;
    }
  }

  // --- the wind's ribbons
  if (uNR > 0) {
    vec4 rb = ribbonAt(px);
    float aq = floor(rb.a * 5.0 + 0.45) / 5.0;
    if (aq > 0.0) {
      bg = mix(bg, rb.rgb, aq);
      touched = true;
    }
  }

  // --- the leaves: a pointed leaf, turned and tumbling (its width the tumble), two greens; the half toward the sun lit
  for (int i = 0; i < 10; i++) {
    if (i >= uNL) break;
    vec4 a = uLeaf[i * 2], b = uLeaf[i * 2 + 1];
    vec2 d = px + 0.5 - a.xy;
    if (abs(d.x) > 9.0 || abs(d.y) > 9.0) continue;
    float c = cos(a.z), s = sin(a.z);
    vec2 l = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
    float hl = b.x * 0.5;
    float wid = b.x * 0.34 * max(abs(a.w), 0.18);
    float u = l.x / hl;
    if (u > 1.12 || u < -1.5) continue;
    // its stem
    if (u < -1.0) {
      if (abs(l.y) > 0.55 || abs(a.w) < 0.3) continue;
      bg = mix(bg, vec3(0.2, 0.33, 0.2), b.z);
      touched = true;
      continue;
    }
    float edge = wid * (1.0 - u * u) + 0.35;
    // a one-px darker rim round it (it reads against sky and cloud alike), a stem at its base
    bool rimPx = abs(l.y) > edge;
    if (rimPx && abs(l.y) > edge + 0.95) continue;
    vec2 sd = normalize(uSun.xy - a.xy + vec2(0.001));
    bool lit = dot(d, sd) > -0.3;
    bool front = a.w > 0.0;
    vec3 col;
    if (b.y < 0.5) col = front ? (lit ? vec3(0.66, 0.82, 0.32) : vec3(0.38, 0.6, 0.25)) : (lit ? vec3(0.5, 0.68, 0.36) : vec3(0.27, 0.45, 0.26));
    else col = front ? (lit ? vec3(0.8, 0.85, 0.4) : vec3(0.54, 0.64, 0.26)) : (lit ? vec3(0.62, 0.7, 0.38) : vec3(0.37, 0.49, 0.25));
    // the midrib along a face seen flat
    if (!rimPx && abs(a.w) > 0.55 && abs(l.y) < 0.5 && abs(u) < 0.75) col *= 0.82;
    if (rimPx) col = vec3(0.13, 0.26, 0.2);
    bg = mix(bg, col, b.z);
    touched = true;
  }

  if (!touched) discard;
  o = vec4(bg, 1.0);
}`;

/** Draws the fall's air over the frame (after the world and the paper, before the titles). */
export class Veils {
  private prog: WebGLProgram | null = null;
  private u: Record<string, WebGLUniformLocation> = {};
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;
  private copy: { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number } | null = null;
  /** (fall loop r1, integration) the frame with only the sky drawn, taken by skyShot before the planes. */
  private skyCopy: { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number } | null = null;
  private skyFresh = false;
  private hazeProg: WebGLProgram | null = null;
  private hu: Record<string, WebGLUniformLocation> = {};

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.vao = vao;
    // (a driver that refuses the shader loses the fog, never the world)
    try {
      this.prog = compile(gl, FULL_VS, FS, "tesu-opening-veils");
      this.u = uniforms(gl, this.prog);
    } catch (e) {
      console.warn("[opening] the fog layers' shader", e);
    }
    try {
      this.hazeProg = compile(gl, FULL_VS, HAZE_FS, "tesu-opening-haze");
      this.hu = uniforms(gl, this.hazeProg);
    } catch (e) {
      console.warn("[opening] the haze's shader", e);
    }
  }

  /** Draws haze layers at their depth (premultiplied over what is drawn so far; the plane loop calls it). */
  haze(W: number, Hf: number, bands: HazeDraw[], sun: readonly number[] | null): void {
    if (!bands.length || !this.hazeProg) return;
    const gl = this.gl, u = this.hu;
    gl.useProgram(this.hazeProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(u.uRes!, W, Hf);
    const A = new Float32Array(24), B = new Float32Array(24);
    bands.slice(0, 6).forEach((b, i) => {
      A.set([b.row, Math.max(1, b.height), b.density, b.x], i * 4);
      B.set([b.seed, b.kind, 0, 0], i * 4);
    });
    gl.uniform4fv(u.uH!, A);
    gl.uniform4fv(u.uH2!, B);
    gl.uniform1i(u.uHN!, Math.min(6, bands.length));
    gl.uniform2f(u.uSun!, sun && sun[0] ? sun[0] : 0.2 * W, sun && sun[1] ? sun[1] : 0.11 * Hf);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * (fall loop r1, integration) Keeps the frame as it is right after the sky pass (the fall's sky and the sun, before
   * any plane): the wisps lie only where the finished frame still shows that sky, whatever colours the clouds take.
   */
  skyShot(target: Target): void {
    if (!this.prog) return;
    const gl = this.gl;
    const w = target.color.w, h = target.color.h;
    const shot = this.copyOf(w, h, "skyCopy");
    if (!shot) return;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, shot.fbo);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, w, h);
    this.skyFresh = true;
  }

  /** The copy of the frame the pass reads (made once, remade when the frame's size changes). */
  private copyOf(w: number, h: number, key: "copy" | "skyCopy" = "copy"): { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number } | null {
    const gl = this.gl;
    const have = this[key];
    if (have && have.w === w && have.h === h) return have;
    if (have) {
      gl.deleteFramebuffer(have.fbo);
      gl.deleteTexture(have.tex);
      this[key] = null;
    }
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    this[key] = { fbo, tex, w, h };
    return this[key];
  }

  /** Draws `air` over `target` (the frame, bound as it was before: the pass rebinds it). */
  draw(target: Target, W: number, Hf: number, air: FallAir | null): void {
    const skyFresh = this.skyFresh;
    this.skyFresh = false;
    if (!air || !this.prog) return;
    if (!air.veils.length && !air.ribbons.length && !air.leaves.length && !air.streaks.length && air.shafts <= 0.003) return;
    const gl = this.gl, u = this.u;
    const w = target.color.w, h = target.color.h;
    const copy = this.copyOf(w, h);
    if (!copy) return;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, copy.fbo);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.prog);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, copy.tex);
    gl.uniform1i(u.uSrc!, 0);
    const sky = skyFresh && this.skyCopy && this.skyCopy.w === w && this.skyCopy.h === h ? this.skyCopy : null;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sky ? sky.tex : copy.tex);
    if (u.uSky) gl.uniform1i(u.uSky, 1);
    if (u.uSkyOn) gl.uniform1f(u.uSkyOn, sky ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(u.uRes!, W, Hf);
    const L0 = new Float32Array(24), L1 = new Float32Array(24), L2 = new Float32Array(24);
    const vs = air.veils.slice(0, 6);
    vs.forEach((v, i) => {
      L0.set([v.cx, v.cy, Math.max(1e-3, v.g), v.alpha], i * 4);
      L1.set([Math.max(1, v.hw), Math.max(1, v.hh), v.seed, v.tone], i * 4);
      L2.set([v.churn, v.gust, v.out, 0], i * 4);
    });
    if (u.uL0) gl.uniform4fv(u.uL0, L0);
    if (u.uL1) gl.uniform4fv(u.uL1, L1);
    if (u.uL2) gl.uniform4fv(u.uL2, L2);
    gl.uniform1i(u.uN!, vs.length);
    gl.uniform4f(u.uPaper!, air.paper?.[0] ?? 0, air.paper?.[1] ?? 0, air.paper ? 1 : 0, 0);
    gl.uniform4f(u.uSun!, air.sun[0], air.sun[1], 0, 0);
    const R = new Float32Array(RIBBONS * RIBBON_PTS * 4);
    const rs = air.ribbons.slice(0, RIBBONS);
    rs.forEach((pts, r) => pts.slice(0, RIBBON_PTS).forEach((p, j) => R.set(p, (r * RIBBON_PTS + j) * 4)));
    if (u.uRib) gl.uniform4fv(u.uRib, R);
    if (u.uNR) gl.uniform1i(u.uNR, rs.length);
    const Lf = new Float32Array(LEAVES * 8);
    const ls = air.leaves.slice(0, LEAVES);
    ls.forEach((l, i) => Lf.set([l[0]!, l[1]!, l[2]!, l[3]!, l[4]!, l[5]!, l[6]!, 0], i * 8));
    if (u.uLeaf) gl.uniform4fv(u.uLeaf, Lf);
    if (u.uNL) gl.uniform1i(u.uNL, ls.length);
    const S = new Float32Array(STREAKS * 8);
    const ss = air.streaks.slice(0, STREAKS);
    ss.forEach((q, i) => S.set([q[0]!, q[1]!, q[2]!, q[3]!, q[4]!, q[5]!, q[6]!, 0], i * 8));
    if (u.uStreak) gl.uniform4fv(u.uStreak, S);
    if (u.uNS) gl.uniform1i(u.uNS, ss.length);
    if (u.uShaft) gl.uniform4f(u.uShaft, air.shafts, 0, 0, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}
