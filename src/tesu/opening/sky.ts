// The opening's sky, the part that is the camera's own (Dex 10-16: "I need clouds, front fog layers on the camera, wind
// and stuff affecting the ofuda's path"): the air between the lens and the paper. Drawn LAST, over the world, the clouds
// and the paper: the one thing nearer than the paper.
//
// (fall loop, round 2, worker 2; rev 5's camera: the drop out of the black, the vast frame, the push-in, the fall)
// What it draws, all from one pass that reads a copy of the frame under it:
// - The lens fog (VEILS): layers of cloud lying in the camera's own space, each at its own depth, so they move as the
//   world does (they swell as the camera pushes in on them and rise past as it comes down; the nearer, the faster and
//   the bigger), drifting west on the east wind. Each is a soft milky body (thick and thin at a large scale) torn by a
//   few big holes stretched along the wind; the tear field slides west and churns, so the holes open, stream and
//   close. The camera flies INTO the thick one on the push-in: it sweeps in already big, the whole frame behind it lifts
//   toward its value (ref 04's milky depth: the clouds behind keep their forms, faded), its tears closed while the
//   camera nears it and widening into streaks as the camera comes out of it. Its light is the sun's: a warm white
//   toward the sun and high, the clouds' cool blue away from it and low (a thin film over the deep sky is the sky's
//   own light, never grey). The lift is smooth (no blur of the world behind, no grain, no dither); the holes' and the
//   rim's torn edges thin in a few clean steps on the frame's own pixels. Over a cloud a tear opens less (a slit of
//   crisp cloud reads as a scan line).
// - The wind made visible (W2-6): wisps of cloud torn off and streaming west (a soft tapered body, lit along its upper
//   side, hooking over at its head, thinner over a cloud's body so it reads as torn off that cloud's edge), sweeping
//   west in the gusts; a few leaves blown up from Kagami's trees tumbling across in them (two greens, lit on the sun's
//   side); the fog's west edges dragged out by the wind. All keyed to the paper's own gust envelope (beats.ts
//   ofuda.gusts: lane F's, read only), so the strongest wind lines up with the kink in its path.
// - The plunge (W2-11): as the camera drops out of the black slab (bar 0) and falls, streaks of air rush up past the
//   lens at full strength on the hit frame itself, dying as the fall slows into the vast frame (which stays clean).
// - Under the deck (W2-8): a fan of warm rays from the deck's gap round the sun, only through open air, pooling
//   brighter where they land on the mist.
// - The paper stays readable: the fog opens a torn hole round it, and no wisp, leaf or streak comes near it.
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
  /** Its tears: the share of it that is torn open (0.25: a few holes; 0.45: more hole than fog). */
  tear: number;
}

/**
 * The fog layers (ways 1-3). Nothing in the vast frame (1.6-4.6: Dex's "wtf, there's a world below" stays clean).
 * The push-in (4.6-7.6, "pushed in on the paper, into the clouds") flies through a thin veil, then INTO the thick
 * cloud (the `lens-fog` frame) and out of it onto the paper among the clouds as the strongest gust begins; on the way
 * down (8.6-10.6) the deck's near fringe rises past the lens; the break-out under the deck is clear.
 */
export const VEILS: readonly Veil[] = [
  { T: 6.05, speed: 0.7, half: 0.34, density: 0.62, w: 0.62, fx: 0.62, fy: 0.5, depth: 0.32, through: 0.3, pan: 0.12, drift: 40, tone: "lit", tear: 0.42 },
  { T: 6.95, speed: 0.6, half: 0.95, density: 0.95, w: 1.15, fx: 0.44, fy: 0.48, depth: 0.2, through: 0.9, pan: 0.12, drift: 46, tone: "lit", tear: 0.3 },
  { T: 7.5, speed: 0.7, half: 0.3, density: 0.85, w: 0.5, fx: 0.18, fy: 0.62, depth: 0.42, through: 0, pan: 0.2, drift: 60, tone: "lit", tear: 0.32 },
  { T: 9.45, speed: 0.8, half: 0.22, density: 0.8, w: 0.9, fx: 0.42, fy: 0.55, depth: 0.42, through: 0, pan: 1, drift: 34, tone: "base", tear: 0.34 },
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
  tear: number;
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
      // (it sweeps in big, already near: a far, small fog bank would read as one blurred blob)
      alpha = smooth(0.6, 0.1, D);
      // (deepest at its key: it tears open over the second half of the way out, then thins away; while the camera
      // nears it, it is a whole bank, its tears closed: they open as the camera reaches it)
      outN = inside > 0 ? smooth(0.5, 1, inside) : -0.7 * smooth(0.0, 0.45, D);
      alpha *= 1 - smooth(0.72, 1, inside);
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
      churn: T - v.T, gust: gustAt(T), out: outN, tear: v.tear,
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
    const r0 = (20 + 12 * r(8)) * scale;
    // (a wisp of cloud: its body this thick behind the head, a hair at its tail)
    const thick = (10 + 10 * r(13)) * scale;
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
      // (half a turn: a wisp hooking over, never a spiral)
      const ang = sg * q * 2.4;
      const rr = 1 - 0.35 * q;
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
      let wd = (1.5 + thick * smooth(0.05, 0.62, v) * (1 - 0.55 * smooth(0.82, 1, v))) * (s > curlFrom ? 0.6 : 1) * (vast ? 0.6 : 1);
      let a = (0.3 + 0.55 * smooth(0, 0.6, v)) * fade;
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
 * - `band`: mist floating between two planes, in lengths with clear air between them: each length heaps up in its
 *   middle (heaps carrying smaller heaps, lit along the top) and thins out at its ends, its body thinning downward into
 *   the air (no ruled underside), lifted off the water. Soft: no dither, no grain.
 * - `ribbon`: a thin torn ribbon low over the water, drifting west (at the catch: a last breath of the fall's air on
 *   the far water, there until she walks).
 * - `air`: the mid-air haze under the deck at the orchestra (0.3 of the frame above the horizon row).
 * `from` / `to`: T it fades in over 0.8 s and out over `out` s (1 by default).
 */
export const HAZE: readonly { kind: "bank" | "band" | "ribbon" | "air"; before: PlaneId; rate: number; from: number; to: number; out?: number; lift: number; height: number; density: number; drift: number; seed: number }[] = [
  { kind: "bank", before: "far", rate: 0.06, from: 9.3, to: 13.4, lift: 4, height: 300, density: 0.85, drift: 6, seed: 3.7 },
  { kind: "band", before: "mid", rate: 0.16, from: 9.4, to: 14.4, lift: 58, height: 120, density: 0.66, drift: 10, seed: 12.9 },
  { kind: "band", before: "back", rate: 0.42, from: 9.5, to: 12.0, out: 1.2, lift: 64, height: 60, density: 0.62, drift: 15, seed: 31.3 },
  { kind: "ribbon", before: "mid", rate: 0.2, from: 9.5, to: 14.6, lift: 13, height: 34, density: 0.72, drift: 13, seed: 9.1 },
  { kind: "ribbon", before: "mid", rate: 0.12, from: 14.2, to: BEATS.her.walkFrom, out: 1.6, lift: 7, height: 48, density: 0.92, drift: 9, seed: 21.4 },
  { kind: "air", before: "play", rate: 1, from: 11.2, to: 14.8, lift: 0, height: 0.18, density: 0.34, drift: 9, seed: 17.3 },
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
  for (int i = 0; i < 6; i++) {
    if (i >= uHN) break;
    vec4 h = uH[i], hk = uH2[i];
    float x = p.x + h.w;
    float d = 0.0, l = 0.0;
    if (hk.y < 0.5) {
      // the bank: mist pooled on the far water, its top heaped (big heaps carrying smaller ones) and lit, thick in its
      // body, thinning toward its foot so the lake's far edge meets Kagami's own waterline mist (never a cut)
      float heap = 0.52 * fbm(vec2(x / 260.0, hk.x)) + 0.34 * fbm(vec2(x / 85.0, hk.x + 3.0)) + 0.14 * vn(vec2(x / 40.0, hk.x + 6.0));
      float top = h.x - h.y * (0.3 + 0.9 * heap);
      float len = smoothstep(0.3, 0.46, fbm(vec2(x / 520.0, hk.x + 11.0)));
      float u = (p.y - top) / max(1.0, h.x - top);
      d = smoothstep(-0.03, 0.12, u) * (1.0 - 0.55 * smoothstep(0.55, 1.05, u)) * step(p.y, h.x + 2.0) * mix(0.55, 1.0, len);
      l = 1.0 - smoothstep(0.0, 0.45, u);
    } else if (hk.y < 1.5) {
      // the ribbon: a thin length of mist low over the water, riding up and down along its length, torn into lengths
      float n = fbm(vec2(x / 170.0, hk.x));
      float hw = h.y * 0.5 * (0.35 + 0.8 * n);
      float c = h.x - h.y * 0.5 + h.y * 0.8 * (fbm(vec2(x / 260.0, hk.x + 5.0)) - 0.5);
      float e = 1.0 - abs(p.y - c) / max(1.0, hw);
      d = smoothstep(0.0, 0.5, e) * smoothstep(0.44, 0.6, n);
      l = 1.0 - smoothstep(-0.6, 0.6, (p.y - c) / max(1.0, hw));
    } else if (hk.y < 2.5) {
      // the air: a soft haze lying under the deck, thickest at its middle row
      float u = (p.y - h.x) / h.y;
      float n = fbm(vec2(x / 420.0, p.y / 170.0) + hk.x);
      d = exp(-u * u * 2.2) * (0.55 + 0.7 * n) * smoothstep(0.32, 0.6, fbm(vec2(x / 560.0, hk.x + 2.0)));
      l = 1.0 - smoothstep(-1.0, 1.0, u);
    } else {
      // the band: mist floating between planes, its top heaped and lit (big heaps carrying small ones), its body
      // thinning downward into the air (no ruled underside), in lengths with clear air between them
      // (heaps carrying smaller heaps carrying smaller ones: never a wave of one length)
      float heap = smoothstep(0.15, 0.9, 0.52 * fbm(vec2(x / 300.0, hk.x)) + 0.34 * fbm(vec2(x / 95.0, hk.x + 3.0)) + 0.14 * vn(vec2(x / 40.0, hk.x + 6.0)));
      float mid = h.x - h.y * 0.45 + h.y * 0.4 * (fbm(vec2(x / 520.0, hk.x + 5.0)) - 0.5);
      float len = smoothstep(0.4, 0.58, fbm(vec2(x / 420.0, hk.x + 11.0)));
      // (a length heaps up in its middle and thins out at its ends: never a band of one height)
      float top = mid - h.y * (0.1 + 0.85 * heap) * (0.35 + 0.65 * len);
      float bot = mid + h.y * (0.45 + 0.35 * fbm(vec2(x / 150.0, hk.x + 8.0)));
      float inT = (p.y - top) / max(1.0, bot - top);
      d = smoothstep(-0.02, 0.1, inT) * (1.0 - smoothstep(0.35, 1.0, inT)) * len;
      l = 1.0 - smoothstep(0.0, 0.6, inT);
    }
    d = clamp(d, 0.0, 1.0) * h.z;
    if (d > A) { A = d; lit = l; }
  }
  if (A <= 0.004) discard;
  // soft (no dither, no grain): mist is the one thing here with lost edges
  float a = A * 0.88;
  // Kagami's mist family, a little whiter than the hazy air behind it so each layer reads by its lit top: a milky
  // white-cyan body, its underside cooler, warm-lit along its top, brighter on the sun's side (where light falls)
  float sunSide = 1.0 - smoothstep(0.0, uRes.x * 0.9, abs(p.x - uSun.x));
  vec3 body = vec3(0.915, 0.945, 0.94), shade = vec3(0.845, 0.9, 0.915), top = vec3(1.0, 0.975, 0.93);
  vec3 c = mix(shade, body, smoothstep(0.1, 0.5, lit));
  c = mix(c, top, smoothstep(0.75, 0.98, lit) * (0.55 + 0.45 * sunSide));
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
uniform vec4 uL2[6];      // the churn's clock (s), the gust (0..1), how far through it the camera is (0..1), its tears
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
float shaftLit(vec2 p, vec2 dir, bool onMist) {
  if (uSkyOn < 0.5) return 1.0;
  vec3 d0 = abs(src(p) - skySrc(p));
  if (!onMist && max(d0.r, max(d0.g, d0.b)) > 0.1) return 0.0;
  float runB = 0.0, best = 0.0;
  for (int k = 1; k < 48; k++) {
    vec2 q = p - dir * (float(k) * 14.0);
    if (q.y < 0.0 || dot(q - uSun.xy, dir) < 0.0) break;
    vec3 d = abs(src(q) - skySrc(q));
    runB = max(d.r, max(d.g, d.b)) > 0.1 ? runB + 1.0 : 0.0;
    best = max(best, runB);
    if (best >= 5.0) break;
  }
  return 1.0 - smoothstep(2.0, 5.0, best);
}

// --- the fog (round 2, session b): each layer is a soft milky body (thick and thin at a large scale, inside a torn
// envelope) torn by a few big holes stretched along the wind, their rims thinning in a few steps; it lifts the whole
// frame behind it toward its own value (ref 04's milky depth). The tear field slides west and churns (its warp drifts),
// so the holes open, stream and close; as the camera comes out of a layer its tears widen until it is gone.
// The tear field at layer px q (below the layer's threshold: a hole).
float tearOf(vec2 q, int i) {
  vec4 b = uL1[i], c = uL2[i];
  float sd = b.z;
  // (the gusts drag it out along the wind)
  vec2 u = vec2(q.x / (560.0 * (1.0 + 1.0 * c.y)) + sd * 1.3 + c.x * 0.05, q.y / 170.0 + sd * 0.7);
  vec2 w = vec2(fbm3(u * 0.6 + vec2(3.3 + c.x * 0.035, 1.1)), fbm3(u * 0.6 + vec2(8.1 - c.x * 0.03, 4.4))) - 0.5;
  u += w * vec2(1.1, 0.8);
  float f = fbm3(u);
  // its torn rims drawn out into fibres along the wind
  f += 0.08 * (vn(vec2(q.x / 90.0 + sd, q.y / 9.0)) - 0.5) + 0.035 * (vn(vec2(q.x / 26.0, q.y / 6.0 + sd)) - 0.5);
  return f;
}

// the plunge's streaks, the wind's ribbons and the leaves: drawn over the fog (they are nearer still)
vec4 ribbonAt(vec2 p) {
  // a wisp of cloud torn off and streaming west: a dense core, its edges thinning in two steps, its upper side lit
  // (warm white), its underside in the clouds' cool shade
  float best = 0.0, side = 0.0;
  for (int r = 0; r < 5; r++) {
    if (r >= uNR) break;
    // its box first (most pixels are far from every ribbon)
    vec2 lo = vec2(1e5), hi = vec2(-1e5);
    for (int j = 0; j < 24; j += 2) { lo = min(lo, uRib[r * 24 + j].xy); hi = max(hi, uRib[r * 24 + j].xy); }
    lo = min(lo, uRib[r * 24 + 23].xy); hi = max(hi, uRib[r * 24 + 23].xy);
    if (p.x < lo.x - 30.0 || p.x > hi.x + 30.0 || p.y < lo.y - 30.0 || p.y > hi.y + 30.0) continue;
    for (int j = 0; j < 23; j++) {
      vec4 a = uRib[r * 24 + j], b = uRib[r * 24 + j + 1];
      vec2 ab = b.xy - a.xy;
      float t = clamp(dot(p - a.xy, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
      vec2 off = p - a.xy - ab * t;
      float d = length(off);
      float w = mix(a.z, b.z, t) * 0.5;
      if (d > w + 0.5) continue;
      float al = mix(a.w, b.w, t);
      // (its edges torn along its length: a fibre noise along the stroke)
      float u = d / max(w, 0.5) + 0.25 * (vn(vec2(dot(p, normalize(ab + 1e-4)) / 7.0, float(r) * 3.1)) - 0.5);
      float cov = u < 0.45 ? 1.0 : (u < 0.78 ? 0.55 : (u < 1.0 ? 0.25 : 0.0));
      if (cov * al > best) {
        best = cov * al;
        // which side: up on the frame is lit
        side = w > 2.0 ? clamp(-off.y / w, -1.0, 1.0) : 0.0;
      }
    }
  }
  vec3 col = side > 0.35 ? vec3(1.0, 0.982, 0.95) : (side < -0.35 ? vec3(0.8, 0.85, 0.92) : vec3(0.93, 0.94, 0.955));
  return vec4(col, best);
}

void main() {
  vec2 px = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  vec2 toP = uPaper.z > 0.5 ? px - uPaper.xy : vec2(1e4);
  float paperD = length(toP);
  bool touched = false;
  vec3 bg = src(px);

  // --- the fog: layer over layer (premultiplied), each a milky body with its torn holes
  vec2 pq = toP / vec2(150.0, 70.0);
  float nearP = uPaper.z > 0.5 ? exp(-dot(pq, pq)) : 0.0;
  float keep = 1.0;
  vec3 acc = vec3(0.0);
  float dsun = length(px - uSun.xy) / uRes.x;
  float overSky = 1.0;
  if (uSkyOn > 0.5) {
    vec3 dd = abs(bg - skySrc(px));
    overSky = 1.0 - smoothstep(0.06, 0.16, max(dd.r, max(dd.g, dd.b)));
  }
  for (int i = 0; i < 6; i++) {
    if (i >= uN) break;
    vec4 l0 = uL0[i], b = uL1[i], c = uL2[i];
    vec2 q = (px - l0.xy) / l0.z;
    // (its west side dragged out by the gusts)
    vec2 qe = vec2(q.x / (q.x < 0.0 ? 1.0 + 0.7 * c.y : 1.0), q.y);
    float er = length(qe / b.xy);
    if (er > 1.3) continue;
    // its envelope: a soft outline torn at its own scale (its rim far outside the frame while the camera is inside it)
    // (its rim torn like its holes: drawn out along the wind, a soft fringe of two steps)
    float rim = er + 0.3 * (fbm3(qe / vec2(420.0, 200.0) + b.z) - 0.5) + 0.05 * (vn(vec2(q.x / 70.0, q.y / 7.0) + b.z) - 0.5);
    float env = floor(smoothstep(1.0, 0.86, rim) * 3.0 + 0.5) / 3.0 * mix(0.55, 1.0, smoothstep(1.0, 0.6, rim));
    if (env <= 0.0) continue;
    // thick and thin at a large scale
    float body = fbm3(vec2(q.x / 520.0 + b.z * 2.1 + c.x * 0.02, q.y / 312.0 + b.z));
    float D = env * mix(0.72, 0.93, smoothstep(0.3, 0.7, body)) * l0.w;
    // the holes: few, big, stretched along the wind; wider as the camera comes out of it; a torn opening round the
    // paper (the threshold raised there, so the opening follows the tears: never a porthole)
    float th = c.w + 0.3 * c.z + 0.16 * nearP;
    float hole = smoothstep(th + 0.05, th - 0.015, tearOf(q, i));
    hole = floor(hole * 3.0 + 0.5) / 3.0;
    // (over a cloud a tear opens less: a slit of crisp cloud through the fog reads as a scan line)
    float a = D * (1.0 - (0.45 + 0.37 * overSky) * hole);
    if (a <= 0.002) continue;
    // its light: a warm white toward the sun and high, the clouds' cool blue away from it, low and where it is thick;
    // the deck's fringe (tone 1) in its cooler base
    float warm = clamp(1.0 - dsun * 1.1, 0.0, 1.0) * 0.8 + 0.2 * (1.0 - px.y / uRes.y) - 0.25 * smoothstep(0.5, 0.85, body);
    warm = mix(warm, warm * 0.55, b.w);
    warm = clamp(warm, 0.0, 1.0);
    vec3 col = mix(vec3(0.788, 0.839, 0.91), vec3(0.984, 0.969, 0.941), warm);
    acc = col * a + acc * (1.0 - a);
    keep *= 1.0 - a;
  }
  float Dt = 1.0 - keep;
  if (Dt > 0.004) {
    vec3 fog = acc / max(Dt, 1e-4);
    // a film this thin over the deep sky is the sky's own light scattered (a cerulean, never grey)
    vec3 glow = min(bg * vec3(1.02, 1.04, 1.03) + vec3(0.07, 0.08, 0.07), vec3(1.0));
    fog = mix(glow, fog, smoothstep(0.05, 0.22, Dt));
    bg = mix(bg, fog, Dt);
    touched = true;
  }

  // --- the light shafts under the deck: a fan of warm rays of varied width from the deck's gap round the sun, down
  // and to the right, only through open air (the deck's body, the karsts and the isles shade them); where a ray lands
  // on the mist it pools brighter (ref 01's light breaking through onto the valley's mist)
  if (uShaft.x > 0.003) {
    vec2 r = px - uSun.xy;
    float dist = length(r);
    vec2 dir = r / max(dist, 1.0);
    // 0: straight down; +: toward the right
    float ang = atan(dir.x, dir.y);
    float cone = 1.0 - smoothstep(0.32, 0.62, abs(ang - 0.36));
    if (cone > 0.0 && dist > 60.0) {
      float beam = smoothstep(0.4, 0.78, vn(vec2(ang * 30.0, 3.0))) * (0.5 + 0.5 * vn(vec2(ang * 110.0, 7.0)));
      float drop = exp(-dist / (uRes.y * 0.8)) * smoothstep(60.0, 240.0, dist);
      float a = uShaft.x * 0.3 * beam * drop * cone * smoothstep(40.0, 90.0, paperD);
      if (uSkyOn > 0.5 && a > 0.003) {
        vec3 c0 = src(px);
        float lum = dot(c0, vec3(0.299, 0.587, 0.114));
        float sat = max(c0.r, max(c0.g, c0.b)) - min(c0.r, min(c0.g, c0.b));
        float mist = smoothstep(0.78, 0.84, lum) * (1.0 - smoothstep(0.1, 0.15, sat)) * smoothstep(uRes.y * 0.36, uRes.y * 0.6, px.y);
        vec3 d0 = abs(c0 - skySrc(px));
        float air = 1.0 - smoothstep(0.08, 0.12, max(d0.r, max(d0.g, d0.b)));
        a *= shaftLit(px, dir, true) * max(air, mist) * (1.0 + 1.3 * mist);
      }
      if (a > 0.003) {
        bg = mix(bg, vec3(1.0, 0.95, 0.82), min(a, 0.45));
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
    // (over a cloud's body a wisp thins: it reads as torn off that cloud's edge, at its depth)
    float aq = floor(rb.a * mix(0.3, 1.0, overSky) * 8.0 + 0.45) / 8.0;
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
      L2.set([v.churn, v.gust, v.out, v.tear], i * 4);
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
