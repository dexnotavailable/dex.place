// The opening's sky, the part that is the camera's own (Dex 10-16: "I need clouds, front fog layers on the camera, wind
// and stuff affecting the ofuda's path"): the air between the lens and the paper. Drawn LAST, over the world, the clouds
// and the paper: the one thing nearer than the paper.
//
// (fall loop, round 1, worker 2) What it draws, all from one pass that reads a copy of the frame under it:
// - The lens fog (VEILS): each layer is two to four masses of very different size (thick cores, thin veils, torn holes
//   the sky shows through), never a full-width band. It rises across the frame as the camera comes down and drifts west
//   on the east wind; two noise layers of the same fog move at different speeds, so its holes open and close; its
//   downwind (west) side trails out into torn streaks, longer in the gusts. Lit warm on the sun's side, cool blue-grey in
//   its own shade (the light is read from the fog's own density toward the sun). Its translucency comes in flat steps
//   whose edges are clustered noise anchored to the fog (never an ordered dither, never an outline ring). Where it lies
//   over the world, what is behind it fades toward the fog's value and its crisp edges break up (the frame under the fog
//   is read through a small torn displacement).
// - The near masses (NEAR_FOG): big soft fog masses on the near plane, entering from a frame edge, cut by it, rising
//   two to three times faster than the mid clouds, near the sky's value: falling INTO weather.
// - The wind made visible: wisps torn off the clouds' upper west shoulders (the clouds' own colours, read from the
//   frame, so they follow whatever the sky lane places), and small shreds of mist and paper dust crossing the near plane
//   faster than the paper. Both follow the paper's own gust envelope (beats.ts ofuda.gusts: lane F's, read only), so
//   the strongest streaming lines up with the kink in its path; outside the gusts only a slow drift (the lines are calm).
// - The paper stays readable: the fog thins to a torn hole round it and its rim goes to the fog's cool shade, and no
//   wisp or shred comes within 40 px of it.
// Pixel fog in the world's manner (DEX-EYE 6-7: authored in code; no image generation for fog, Dex 10-12).

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { FULL_VS } from "../../lab/engine/shaders.ts";
import type { Target } from "../../world/render/renderer.ts";
import { BEATS } from "./beats.ts";
import { monotone, type Way } from "./timeline.ts";
import { PLANES, type PlaneId } from "../world/types.ts";
import { planeXf, rowOf, type CamState } from "../render/view.ts";

/** One mass of a fog layer: [middle x (share of the width at the layer's T), half width (share of the width), its
 *  middle's offset from the layer's row (share of the height), density (0..1)]. */
export type Mass = readonly [number, number, number, number];

export interface Veil {
  /** T at which its row crosses the frame's middle. */
  T: number;
  /** How fast it rises across the frame (frame heights a second). */
  speed: number;
  /** Half its thickness (share of the frame's height), how dense at its heart (0..1), its westward drift (px/s). */
  half: number;
  density: number;
  drift: number;
  /** Its tone: lit (the sky's whites, warm on the sun's side) or the cloud base's cool grey. */
  tone: "lit" | "base";
  /** Its masses (two to four, of very different size). */
  masses: readonly Mass[];
}

/**
 * The fog layers on the lens (ways 1-3): a thin one high up, the thick bank the paper goes through (the `lens-fog`
 * frame), a thin one after it, the cloud base's in the gust, and the deck's underside the camera falls out of (gone
 * above the frame by bar 5, so the break-out is clear).
 */
export const VEILS: readonly Veil[] = [
  // (round 1b) the thin high veil at T 2 is gone: over the fall's deep sky it read as a small stepped oval; the
  // high frames' near air is the near masses below
  { T: 5.6, speed: 0.4, half: 0.22, density: 0.95, drift: 22, tone: "lit", masses: [[0.19, 0.31, -0.05, 1], [0.88, 0.15, 0.12, 0.8], [0.58, 0.07, -0.13, 0.55]] },
  { T: 6.5, speed: 0.42, half: 0.06, density: 0.5, drift: 30, tone: "lit", masses: [[0.68, 0.19, 0.0, 0.8], [0.12, 0.08, 0.03, 0.55]] },
  { T: 8.7, speed: 0.5, half: 0.12, density: 0.66, drift: 26, tone: "base", masses: [[0.16, 0.24, 0.0, 1], [0.74, 0.17, 0.04, 0.8], [0.47, 0.06, -0.05, 0.5]] },
  { T: 9.55, speed: 0.62, half: 0.18, density: 0.7, drift: 20, tone: "base", masses: [[0.36, 0.36, 0.0, 1], [0.9, 0.14, 0.05, 0.7]] },
];

/**
 * The near plane's fog masses (W2-6): big and soft, near the sky's value, each entering from a frame edge (cut by it)
 * and rising past the lens two to three times faster than the mid clouds; clear of the paper's path.
 * `at`: when its middle is at (fx, fy) (shares); `w`, `h`: half sizes (shares); `rise`: frame heights a second.
 */
export const NEAR_FOG: readonly { at: number; fx: number; fy: number; w: number; h: number; rise: number; drift: number; density: number }[] = [
  // (round 1b) carried in from the east edge by the wind over the open sky of the upper right (over the deep sky its
  // body reads; over a white cloud a near mass is only a blur), rising out through the top bar by the lens fog
  { at: 3.6, fx: 0.99, fy: 0.36, w: 0.3, h: 0.24, rise: 0.3, drift: 95, density: 0.82 },
];

/** A fog layer on the frame now (frame px): its row, half thickness, density, the two noise layers' x offsets, seed,
 *  tone (0 lit, 1 base, 2 near), and its masses (x middle, half width, y offset, density). */
export interface VeilDraw {
  row: number;
  half: number;
  density: number;
  x: number;
  x2: number;
  seed: number;
  tone: number;
  masses: [number, number, number, number][];
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
/** How high the camera still is (H above her feet): the near air rises past the lens as it comes down. */
export function altAt(T: number): number {
  return monotone(KEYS.map((k) => k.T), KEYS.map((k) => k.alt), T);
}

/** The fog layers on the frame at T (none on way 4, none with reduced motion: they are pure motion). */
export function fallVeils(T: number, W: number, Hf: number, way: Way, reduced: boolean): VeilDraw[] {
  if (way === "bottom" || reduced) return [];
  const out: VeilDraw[] = [];
  VEILS.forEach((v, i) => {
    const row = Hf * (0.5 - (T - v.T) * v.speed);
    const half = v.half * Hf;
    if (row < -2.5 * half || row > Hf + 2.5 * half) return;
    const gain = 3.2;
    const shift = (run(T, gain) - run(v.T, gain)) * v.drift;
    out.push({
      row, half, density: v.density, x: Math.round(run(T, gain) * v.drift), x2: Math.round(run(T, gain) * v.drift * 1.75 + T * 9),
      seed: i * 17.3 + 3.1, tone: v.tone === "base" ? 1 : 0,
      masses: v.masses.map((m) => [m[0] * W - shift, m[1] * W, m[2] * Hf, m[3]]),
    });
  });
  NEAR_FOG.forEach((n, i) => {
    const row = Hf * (n.fy - (T - n.at) * n.rise);
    const half = n.h * Hf;
    if (row < -1.6 * half || row > Hf + 1.6 * half) return;
    const gain = 2.5;
    const shift = (run(T, gain) - run(n.at, gain)) * n.drift;
    const x = n.fx * W - shift;
    if (x + n.w * W * 1.6 < 0 || x - n.w * W * 1.2 > W) return;
    out.push({
      row, half, density: n.density, x: Math.round(run(T, gain) * n.drift), x2: Math.round(run(T, gain) * n.drift * 1.6 + T * 14),
      seed: 101.7 + i * 23.9, tone: 2, masses: [[x, n.w * W, 0, 1]],
    });
  });
  return out;
}

/** The shreds of mist and paper dust on the near plane (W2-5): 5 in the calm, up to 28 in the strongest gust. */
export const SHREDS = 28;

/**
 * The shreds on the frame at T: [x, y, length, alpha (negative: paper dust)] each, frame px. They drift west on the
 * wind (fast in the gusts, slow in the calm), rise past the lens as the camera comes down, and keep 40 px or more from
 * the paper (fading out from 64 px).
 */
export function fallShreds(T: number, W: number, Hf: number, paper: readonly [number, number] | null): number[][] {
  const g = gustAt(T), gr = gustRun(T);
  const fallen = (KEYS[0]!.alt - altAt(T)) * 62;
  // (from the hand-off's blend) a last few slow specks, high on the frame, clear of her and her hand
  const late = Math.min(1, Math.max(0, (T - 15.2) / 1.2));
  const shown = (5 + 23 * g) * (1 - late) + 3 * late;
  const out: number[][] = [];
  const fr = (x: number): number => x - Math.floor(x);
  for (let i = 0; i < SHREDS; i++) {
    const vis = Math.min(1, Math.max(0, shown - i));
    if (vis <= 0) continue;
    const d = 0.7 + 0.6 * fr(i * 0.7548 + 0.13);
    const spanX = W + 160, spanY = Hf + 120;
    const x = fr((fr(i * 0.6180339 + 0.21) * spanX - (34 * T + 560 * gr) * d) / spanX) * spanX - 80;
    let y = fr((fr(i * 0.3819661 + 0.57) * spanY - fallen * d) / spanY) * spanY - 60;
    if (late > 0) y = y * (1 - late) + (0.14 + 0.26 * fr(i * 0.513 + 0.2)) * Hf * late;
    let a = vis * (0.55 + 0.4 * fr(i * 0.271 + 0.4));
    if (paper) {
      const dist = Math.hypot(x - paper[0], y - paper[1]);
      a *= Math.min(1, Math.max(0, (dist - 40) / 24));
    }
    if (a <= 0.01) continue;
    const len = 2 + Math.floor(fr(i * 0.31 + 0.05) * 4) + Math.round(7 * g * d);
    const dust = i % 7 === 3;
    out.push([Math.round(x), Math.round(y), dust ? Math.min(3, len) : len, dust ? -a : a]);
  }
  return out;
}

/** What the pass draws this frame: the fog layers, the wind (gust 0..1, the wisps' reach and strength), the shreds,
 *  the paper's point and the sun's (frame px). */
export interface FallAir {
  veils: VeilDraw[];
  gust: number;
  wisp: [number, number];
  run: number;
  shreds: number[][];
  paper: [number, number] | null;
  sun: [number, number];
  sky: number;
  /** Warm light shafts slanting from the deck's gaps (top-left) under the cloud deck: strength 0..1. */
  shafts: number;
}

/** The air of the fall at T (null when there is nothing to draw: way 4, reduced motion). */
export function fallAir(T: number, W: number, Hf: number, way: Way, reduced: boolean, paper: [number, number] | null, sun: readonly number[] | null): FallAir | null {
  if (way === "bottom" || reduced) return null;
  // (round 1b) nothing of the air before bar 0, when the sky hits: lane F's rev 5 holds the camera inside the black
  // slab above everything until then (lanes\art\fall\ASKS.txt, 10-20), and no speck may show on that black
  if (T < BEATS.bars[0]!) return null;
  const veils = fallVeils(T, W, Hf, way, reduced);
  const g = gustAt(T);
  // the wisps live in the sky of the fall: gone once the camera is down at the lake
  const sky = Math.min(1, Math.max(0, (altAt(T) - 3) / 5));
  const shreds = fallShreds(T, W, Hf, paper);
  const sunAt: [number, number] = sun && (sun[0]! !== 0 || sun[1]! !== 0) ? [sun[0]!, sun[1]!] : [0.2 * W, 0.11 * Hf];
  // under the deck from the break-out to the orchestra: light breaking through its gaps onto the haze
  const shafts = Math.min(1, Math.max(0, (T - 9.7) / 0.8)) * Math.min(1, Math.max(0, (14.6 - T) / 1.4));
  return { veils, gust: g, wisp: [24 + 150 * g, sky * (0.12 + 0.88 * g)], run: run(T, 3.2), shreds, paper, sun: sunAt, sky, shafts };
}

/**
 * The haze of the fall's last stretch (W2-8 / W2-9), lying at a depth in the world (it parallaxes with the land it
 * wraps; drawn by the plane loop before the plane named `before`). Heights are the far plane's art px.
 * - `bank`: a mist bank behind the far karsts on the far water (the break-out's gap between the deck and the lake): a
 *   heaped, torn top, thick at its foot, fading into the waterline (Kagami's own mist lies over it, untouched).
 * - `ribbon`: a thin torn ribbon in front of the far plane (the Walker's legs at the break-out; at the catch, a last
 *   breath of mist on the far water behind the islets' feet), drifting west.
 * - `air`: the mid-air haze under the deck at the orchestra, between the deck and the far karsts, so the deck's
 *   lower half fades into the sky (0.3 of the frame above the horizon row: it is air, not mist on the water).
 * `from` / `to`: T it fades in over 0.8 s and out over 1 s.
 */
export const HAZE: readonly { kind: "bank" | "ribbon" | "air"; before: PlaneId; from: number; to: number; lift: number; height: number; density: number; drift: number; seed: number }[] = [
  { kind: "bank", before: "far", from: 9.3, to: 12.2, lift: 6, height: 260, density: 0.8, drift: 7, seed: 3.7 },
  { kind: "ribbon", before: "mid", from: 9.5, to: 14.6, lift: 13, height: 34, density: 0.72, drift: 13, seed: 9.1 },
  { kind: "ribbon", before: "mid", from: 14.2, to: 18.4, lift: 7, height: 16, density: 0.5, drift: 9, seed: 21.4 },
  { kind: "air", before: "play", from: 11.2, to: 14.8, lift: 0, height: 0.18, density: 0.42, drift: 9, seed: 17.3 },
];

/** A haze layer on the frame now: its foot row, height (px), density, x offset; seed, kind (0 bank, 1 ribbon, 2 air). */
export interface HazeDraw {
  row: number;
  height: number;
  density: number;
  x: number;
  seed: number;
  kind: number;
}

/** The haze layers drawn before plane `before` at T (none on way 4 or with reduced motion). */
export function fallHaze(T: number, way: Way, reduced: boolean, before: PlaneId, cam: CamState, waterY: number | null): HazeDraw[] {
  if (way === "bottom" || reduced || waterY === null) return [];
  const out: HazeDraw[] = [];
  for (const h of HAZE) {
    if (h.before !== before) continue;
    const k = Math.min(1, Math.max(0, (T - h.from) / 0.8)) * Math.min(1, Math.max(0, (h.to - T) / 1));
    if (k <= 0) continue;
    const xf = planeXf(cam, PLANES.far.rate);
    // (one far art px is xf.g frame px: its world px are 1 / rate of it, shown at rate * xf.g)
    const g = xf.g;
    const x = Math.round(T * h.drift - xf.offX);
    if (h.kind === "air") {
      // between the deck's base and the far karsts' tops: a share of the frame above the horizon
      const hz = cam.horizon * cam.H;
      out.push({ row: hz - 0.3 * cam.H, height: h.height * cam.H, density: h.density * k, x, seed: h.seed, kind: 2 });
      continue;
    }
    const wl = rowOf(cam, PLANES.far.rate, waterY);
    out.push({ row: wl - h.lift * g, height: Math.max(6, h.height * g), density: h.density * k, x, seed: h.seed, kind: h.kind === "bank" ? 0 : 1 });
  }
  return out;
}

const HAZE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec4 uH[4];    // foot row, height (px), density, x offset
uniform vec4 uH2[4];   // seed, kind (0 bank, 1 ribbon, 2 air), 0, 0
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
  for (int i = 0; i < 4; i++) {
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
    } else {
      // the air: a soft haze lying under the deck, thickest at its middle row, its top and foot torn
      float u = (p.y - h.x) / h.y;
      float n = fbm(vec2(x / 320.0, p.y / 70.0) + hk.x);
      d = exp(-u * u * 2.2) * (0.55 + 0.7 * n);
      l = 1.0 - smoothstep(-1.0, 1.0, u);
    }
    d = clamp(d, 0.0, 1.0) * h.z;
    if (d > A) { A = d; lit = l; anc = vec2(h.w, 0.0); }
  }
  if (A <= 0.004) discard;
  // fine steps, their edges clustered noise riding on the drift (no ordered dither, no outline ring)
  vec2 ac = vec2(p.x + anc.x, p.y);
  float t = clamp(0.5 + 0.8 * (vn(ac / 2.6) - 0.5) + 0.3 * (h2(floor(ac / 2.0)) - 0.5), 0.02, 0.98);
  float a = floor(A * 0.85 * 12.0 + t) / 12.0;
  if (a <= 0.0) discard;
  // Kagami's mist family: a milky teal-white, warm-lit along its top on the sun's side, cooler in its body
  float sunSide = 1.0 - smoothstep(0.0, uRes.x * 0.9, abs(p.x - uSun.x));
  vec3 body = vec3(0.87, 0.915, 0.905), shade = vec3(0.79, 0.855, 0.87), top = vec3(0.985, 0.958, 0.91);
  vec3 c = mix(mix(shade, body, smoothstep(0.0, 0.5, lit)), top, smoothstep(0.55, 1.0, lit) * (0.45 + 0.55 * sunSide));
  o = vec4(c * a, a);
}`;

const FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform sampler2D uSrc;   // the frame under the pass (the world, the clouds, the paper)
uniform vec4 uA[8];       // row, half, density, tone (0 lit, 1 base, 2 near)
uniform vec4 uB[8];       // seed, the first noise's x offset, the second's, 0
uniform vec4 uM[32];      // masses: x middle, half width, y offset, density (4 a layer)
uniform int uN;
uniform vec4 uPaper;      // x, y, on, 0
uniform vec4 uSun;        // x, y
uniform vec4 uWind;       // gust 0..1, the wisps' reach (px), their strength, the wind's run (s)
uniform vec4 uShred[28];  // x, y, length, alpha (negative: paper dust)
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
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vn(p);
    p = p * 2.07 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return s / 0.9375;
}
// two octaves (the outlines' warp: cheap, it runs for every mass)
float fbm2(vec2 p) {
  return (0.5 * vn(p) + 0.25 * vn(p * 2.07 + vec2(17.1, 9.7))) / 0.75;
}
vec3 src(vec2 p) {
  vec2 q = clamp(p, vec2(0.0), uRes - 1.0);
  return texelFetch(uSrc, ivec2(int(q.x), int(uRes.y - 1.0 - q.y)), 0).rgb;
}
// open sky (the fall's blues: green well above red, 56-82 / 255 in the deep sky, 37-44 in rev 4's paler one), never a
// cloud's blue-grey shade (green at most red + 32: the fall's cumulus ramp; op.cloud's lavender greys about + 10) nor
// its lit crown
float skyOf(vec3 c) { return smoothstep(0.13, 0.15, c.g - c.r); }
// a lit crown: bright and not sky
float crownOf(vec3 c) { return smoothstep(0.62, 0.76, dot(c, vec3(0.299, 0.587, 0.114))) * (1.0 - skyOf(c)); }

// the layer's masses: soft ellipses of very different size; each one's downwind (west) side trails out longer and
// thinner (longer still in the gusts). Positive inside, falling off outside (the noise tears the edge out of it).
float envOf(vec2 p, int i) {
  vec4 a = uA[i];
  float env = -1.0;
  // its top and foot heave along its length (never a long flat edge): the row wobbles, the thickness swells
  // (its heave is a few tens of px whatever the layer's size, and longer on the big near masses: a tall heave over a
  // short length would comb the edge into vertical lobes)
  float xs = p.x + uB[i].y;
  float wl = mix(1.0, 2.4, step(1.5, a.w));
  float wob = 0.5 * (vn(vec2(xs / (150.0 * wl), float(i) * 3.7 + 0.5)) - 0.5) + 0.25 * (vn(vec2(xs / (61.0 * wl), float(i) * 5.1 + 2.0)) - 0.5);
  float swell = 0.7 + 0.6 * vn(vec2(xs / (210.0 * wl), float(i) * 1.3 + 9.0));
  p.y += min(a.y, 64.0) * wob;
  for (int k = 0; k < 4; k++) {
    vec4 m = uM[i * 4 + k];
    if (m.w <= 0.0) continue;
    // (round 1b) the outline billows and tears at the mass's own scale (a warp of its domain by a noise riding with it
    // and slowly changing): a small mass is never a clean disc, a big one never a rounded slab
    float s = max(m.y, 70.0);
    vec2 q = vec2((p.x - m.x) / (s * 0.62), (p.y - a.x - m.z) / (s * 0.42)) + vec2(float(k) * 7.13 + float(i) * 3.31, float(i) * 1.7) + uB[i].z * 0.0016;
    float wx = fbm2(q) - 0.5, wy = fbm2(q * 1.4 + vec2(5.2, 1.9)) - 0.5;
    float dx = p.x - m.x + wx * s * 0.62;
    // (eased across its middle: a hard switch there would kink the mass and cut a vertical seam into its light)
    float west = smoothstep(0.35, -0.7, dx / m.y);
    float hw = m.y * mix(1.0, 1.35 + 0.9 * uWind.x, west);
    float ex = dx / hw;
    float hy = a.y * swell * (0.55 + 0.45 * m.w) * mix(1.0, 1.0 - 0.5 * clamp(-ex, 0.0, 1.0), west);
    float ey = (p.y - (a.x + m.z)) / hy + wy * 1.1;
    env = max(env, (1.0 - ex * ex - ey * ey) * m.w);
  }
  return env;
}
// the density of layer i at p (0..1): the masses torn by two layers of the same fog moving at different speeds,
// stretched along the wind; holes where the second layer thins
float densOf(vec2 p, int i, float env) {
  vec4 a = uA[i], b = uB[i];
  float near = step(1.5, a.w);
  float sc = mix(1.0, 1.6, near);
  float st = 1.0 + 0.7 * uWind.x;
  vec2 q1 = vec2((p.x + b.y) / (280.0 * sc * st), (p.y - a.x) / (84.0 * sc)) + b.x;
  vec2 q2 = vec2((p.x + b.z) / (160.0 * sc * st), (p.y - a.x * 0.88) / (56.0 * sc)) + b.x * 1.7 + 5.3;
  float w2 = fbm(q2);
  float n = fbm(q1 + vec2(0.9 * (w2 - 0.5), 0.25 * (w2 - 0.5)));
  float d = env * mix(1.4, 1.15, near) + (n - 0.5) * 1.55 - 0.08;
  // torn holes the sky shows through (long along the wind), opening and closing as the layers slide past each other
  // (their rims torn by the first layer's grain, so a hole is never a clean oval); few and large, never a scatter of
  // small dark slots
  float hn = vn(vec2((p.x + b.z) / (260.0 * st), (p.y - a.x * 0.88) / 42.0) + b.x * 0.7 + 2.1) * 0.62 + 0.26 * w2
    + 0.12 * vn(vec2((p.x + b.y) / 31.0, (p.y - a.x) / 12.0) + b.x * 3.1);
  // (the near masses stay milky: only faint thinnings, never dark sky stains)
  d *= 1.0 - mix(0.75, 0.25, near) * smoothstep(0.34, 0.2, hn);
  // (round 1b) where it thins it frays into wisps combed out along the wind (rising a little to the west, the way the
  // tails lift), of uneven width and length: its edge is torn, never a smooth oval with rings round it; the cores stay
  // milky; the near masses keep a soft edge (combed threads read as high, far cirrus)
  float fy = p.y - a.x + 0.07 * (p.x + b.y) + 26.0 * (w2 - 0.5) + 14.0 * (n - 0.5);
  float fib = fbm(vec2((p.x + b.y * 1.25) / (190.0 * st), fy / 15.0) + b.x * 1.9 + 7.7);
  fib = mix(fib, vn(vec2((p.x + b.y * 1.25) / 60.0, fy / 9.0) + 3.1), 0.25);
  float thin = 1.0 - smoothstep(0.2, 0.6, d);
  d = mix(d, d * smoothstep(0.38, 0.68, fib) * 1.6, thin * 0.75 * (1.0 - near));
  return clamp(d, 0.0, 1.0) * a.z;
}
// the layer's body for its light: the masses and the first layer's broad heave only (no holes, no fine grain), so the
// shade is a broad cool side of each mass, never a scatter of dark blots
float bodyOf(vec2 p, int i, float env) {
  vec4 a = uA[i], b = uB[i];
  float near = step(1.5, a.w);
  float sc = mix(1.0, 1.6, near);
  float n = vn(vec2((p.x + b.y) / (420.0 * sc), (p.y - a.x) / (130.0 * sc)) + b.x);
  return clamp(env * 1.3 + (n - 0.5) * 0.9, 0.0, 1.0);
}

void main() {
  vec2 px = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  // the fog is the nearest thing on the frame: its own cells are two px
  vec2 pc = floor(px / 2.0) * 2.0;
  vec2 toP = uPaper.z > 0.5 ? px - uPaper.xy : vec2(1e4);
  float paperD = length(toP);
  bool touched = false;

  // --- the fog: every layer's density and light (toward the sun: lit where its own fog thins that way)
  vec2 sunDir = normalize(uSun.xy - pc + vec2(0.001));
  float keep = 1.0;   // what is left of the frame behind (1 - the fog's cover)
  float lightSum = 0.0, wsum = 0.0, toneN = 0.0, toneB = 0.0, dmax = 0.0;
  vec2 anchor = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uN) break;
    float env = envOf(pc, i);
    if (env < -0.55) continue;
    float d = densOf(pc, i, env);
    if (d <= 0.004) continue;
    // lit where the mass's body thins toward the sun (read 56 px that way), its top a little lighter, its foot cooler
    vec2 ps = pc + sunDir * 56.0;
    float b1 = bodyOf(pc, i, env), b2 = bodyOf(ps, i, envOf(ps, i));
    float l = 0.56 + 1.5 * (b1 - b2) - 0.2 * clamp((pc.y - uA[i].x) / uA[i].y, -1.0, 1.0);
    // thin fog is lit through: where it thins (holes, torn edges) it never goes to its deepest shade
    l = max(l, 0.5 - 0.9 * d);
    keep *= 1.0 - d;
    lightSum += clamp(l, 0.0, 1.0) * d;
    wsum += d;
    toneN += step(1.5, uA[i].w) * d;
    toneB += step(0.5, uA[i].w) * step(uA[i].w, 1.5) * d;
    if (d > dmax) { dmax = d; anchor = vec2(uB[i].y, uA[i].x); }
  }
  float D = 1.0 - keep;
  // the paper keeps a torn hole of sky round it, and the hole's rim goes to the fog's shade
  float hole = 0.0;
  if (D > 0.0 && uPaper.z > 0.5) {
    float rag = (vn(pc / 7.0 + 3.7) - 0.5) * 26.0;
    hole = 1.0 - smoothstep(24.0, 78.0, paperD + rag);
    D *= 1.0 - 0.92 * hole;
  }
  float aq = 0.0;
  vec3 fog = vec3(0.0);
  vec2 ac = vec2(pc.x + anchor.x, pc.y - anchor.y);
  if (D > 0.004) {
    float light = lightSum / max(wsum, 1e-4);
    light = clamp(light - 0.55 * hole, 0.0, 1.0);
    float near = toneN / max(wsum, 1e-4), base = toneB / max(wsum, 1e-4);
    float amax = mix(mix(0.94, 0.86, base), 0.82, near);
    // fine steps of translucency (twenty), each step's edge a clustered noise anchored to the fog (it moves with it):
    // soft, never an outline ring, never an ordered dither (over the fall's deep sky a step is a big jump in value:
    // twenty of them, their edges broken into clusters, so no ring shows)
    float t = clamp(0.5 + 0.95 * (vn(ac / 3.6) - 0.5) + 0.3 * (vn(ac / 1.6 + 11.0) - 0.5), 0.02, 0.98);
    aq = floor(D * amax * 20.0 + t) / 20.0;
    // (round 1b) the fall's light: the lit side a warm white (cream only at its brightest, never a yellow wash over the
    // clouds), the body a pale cool white, the shade the blue-grey of the clouds' own shade, lighter than the deep sky
    vec3 hi = mix(mix(vec3(1.0, 0.972, 0.935), vec3(0.93, 0.94, 0.95), base), vec3(0.93, 0.955, 0.98), near);
    vec3 mi = mix(mix(vec3(0.875, 0.91, 0.955), vec3(0.79, 0.845, 0.91), base), vec3(0.84, 0.9, 0.96), near);
    vec3 lo = mix(mix(vec3(0.72, 0.795, 0.895), vec3(0.64, 0.72, 0.84), base), vec3(0.74, 0.83, 0.93), near);
    fog = light > 0.5 ? mix(mi, hi, smoothstep(0.5, 0.85, light)) : mix(lo, mi, smoothstep(0.12, 0.5, light));
    // thin fog is the sky's own light scattered: what is behind it brightened in its own hue (over the deep sky a
    // luminous cerulean, never a grey film), so a frayed edge melts into the sky instead of printing a white rim on it
    vec3 behind = src(px);
    vec3 glow = min(behind * vec3(1.05, 1.1, 1.08) + vec3(0.3, 0.33, 0.27), vec3(1.0));
    // (only its frayed fringe takes the sky's hue: a body of fog in front is its own white over sky and cloud alike,
    // so the silhouettes behind do not print through it; the near masses, near the sky's value, keep more of it)
    fog = mix(glow, fog, smoothstep(0.06, mix(0.34, 0.62, near), D));
  }

  // behind the fog the frame loses its crisp edges (a small blur under the thicker fog)
  vec3 bg = src(px);
  float soft = smoothstep(0.2, 0.55, aq) * (1.0 - hole);
  if (soft > 0.0) {
    vec3 bl = (src(px + vec2(-3.0, 0.0)) + src(px + vec2(3.0, 0.0)) + src(px + vec2(0.0, -3.0)) + src(px + vec2(0.0, 3.0))
      + src(px + vec2(-2.0, -2.0)) + src(px + vec2(2.0, 2.0)) + src(px + vec2(2.0, -2.0)) + src(px + vec2(-2.0, 2.0))) / 8.0;
    bg = mix(bg, mix(bg, bl, 0.75), soft);
    touched = true;
  }

  // --- the wisps: a cloud's crown torn into soft tails streaming west (in its own colours), thick at the root,
  // thinning and fraying toward the tip; only in the gusts' strength, only in the fall's sky
  if (uWind.z > 0.003 && paperD > 30.0) {
    // (round 1b) open sky is the fall's blues (green well above red); a cloud's blue-grey shade is not (green about
    // red + 30): a tail is laid only on open sky, and only off a lit crown that meets that sky directly (a shaded
    // face in between ends the search), so no streak is ever ruled across a cloud's own shade
    if (skyOf(src(px)) > 0.5) {
      float reach = uWind.y;
      for (int k = 1; k <= 40; k++) {
        float dx = float(k) * 4.0;
        if (dx > reach + 4.0) break;
        // (the tails lift a little as they stream west: the crown that sheds here lies a little lower, east)
        vec3 c = src(px + vec2(dx, 0.07 * dx));
        if (skyOf(c) > 0.5) continue;
        if (crownOf(c) < 0.5) break;
        // the exact edge (so the tail never repeats the outline in steps), its colour from just inside it
        float edge = dx;
        for (int j = 3; j >= 1; j--) {
          vec3 e = src(px + vec2(dx - float(j), 0.07 * (dx - float(j))));
          if (skyOf(e) < 0.5) { edge = dx - float(j); break; }
        }
        if (edge > reach) break;
        c = src(px + vec2(edge + 3.0, 0.07 * edge));
        // only off a crown: open sky above where it is struck (a notch in a cloud's west face is not a crown: it
        // would shed a ruled one-px line)
        float up = 0.0;
        for (int j = 0; j < 3; j++) up += skyOf(src(px + vec2(edge + 4.0, 0.07 * edge - 9.0 - 8.0 * float(j)))) / 3.0;
        // the plume: the crown's own stuff pulled out along the wind in a few soft ribbons (rows of its west shoulder,
        // thick and soft-edged), long and unbroken from the root and thinning toward the tip, where it frays; a row's
        // strand value decides how far it is pulled, so they never end together like a comb or bristle like spikes
        float tip = edge / max(reach, 1.0);
        float wy = px.y - 0.07 * px.x + 3.0 * sin(px.x / 61.0 + px.y * 0.04);
        float strand = fbm(vec2((px.x + edge) / 420.0 + uWind.w * 0.35, wy / 17.0) + 3.3);
        float fray = vn(vec2((px.x + uWind.w * 140.0) / 17.0, wy / 4.0) + 9.1);
        float th = 0.36 + 0.3 * tip + 0.16 * tip * tip * fray;
        float a = 0.8 * uWind.z * smoothstep(0.35, 0.85, up) * smoothstep(th, th + 0.24, strand) * pow(1.0 - tip, 1.2);
        a *= smoothstep(30.0, 52.0, paperD);
        a *= smoothstep(110.0, 230.0, length(px - uSun.xy));
        // a few flat steps, their edges clustered noise (thin cloud, never a gradient, never a ruled line)
        float t = clamp(0.5 + 0.8 * (vn(px / 2.6 + 7.0) - 0.5), 0.05, 0.95);
        float wq = floor(a * 0.9 * 5.0 + t) / 5.0;
        if (wq > 0.0) {
          bg = mix(bg, mix(c, vec3(0.97, 0.975, 0.985), 0.2), wq);
          touched = true;
        }
        break;
      }
    }
  }

  if (aq > 0.0) {
    bg = mix(bg, fog, aq);
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
      // strongest near the deck, gone into the haze below; a fan of a few, never across the whole sky
      float fade = exp(-along / (uRes.y * 0.7)) * smoothstep(0.0, 140.0, along) * (1.0 - smoothstep(0.2, 0.55, abs(across) / uRes.x));
      float a = uShaft.x * 0.16 * sh * fade * smoothstep(40.0, 90.0, paperD);
      float t = clamp(0.5 + 0.8 * (vn(px / 2.6 + 19.0) - 0.5), 0.05, 0.95);
      float aq = floor(a * 30.0 + t) / 30.0;
      if (aq > 0.0) {
        bg = mix(bg, vec3(1.0, 0.95, 0.82), aq);
        touched = true;
      }
    }
  }

  // --- the shreds: small torn bits of mist (and a few of paper dust) crossing the near plane on the wind
  for (int i = 0; i < 28; i++) {
    if (i >= uNS) break;
    vec4 s = uShred[i];
    vec2 d = px - s.xy;
    if (d.y < -1.0 || d.y > 1.0 || d.x < -1.0 || d.x > s.z + 3.0) continue;
    float a = abs(s.w);
    bool dust = s.w < 0.0;
    // a head of one or two rows, a thinner tail trailing east (it moves west)
    float body = step(0.0, d.x) * step(d.x, s.z * 0.45) * step(-0.5, d.y) * step(d.y, dust ? 0.5 : 0.5 + step(2.5, s.z));
    float tail = step(s.z * 0.45, d.x) * step(d.x, s.z) * step(-0.5, d.y) * step(d.y, 0.5);
    float ta = body > 0.5 ? a : (tail > 0.5 ? a * 0.45 : 0.0);
    if (ta > 0.01) {
      vec3 c = dust ? vec3(0.93, 0.86, 0.73) : vec3(0.95, 0.96, 0.975);
      bg = mix(bg, c, ta > 0.6 ? 0.85 : (ta > 0.3 ? 0.5 : 0.28));
      touched = true;
    }
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
    const A = new Float32Array(16), B = new Float32Array(16);
    bands.slice(0, 4).forEach((b, i) => {
      A.set([b.row, Math.max(1, b.height), b.density, b.x], i * 4);
      B.set([b.seed, b.kind, 0, 0], i * 4);
    });
    gl.uniform4fv(u.uH!, A);
    gl.uniform4fv(u.uH2!, B);
    gl.uniform1i(u.uHN!, Math.min(4, bands.length));
    gl.uniform2f(u.uSun!, sun && sun[0] ? sun[0] : 0.2 * W, sun && sun[1] ? sun[1] : 0.11 * Hf);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** The copy of the frame the pass reads (made once, remade when the frame's size changes). */
  private copyOf(w: number, h: number): { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number } | null {
    const gl = this.gl;
    if (this.copy && this.copy.w === w && this.copy.h === h) return this.copy;
    if (this.copy) {
      gl.deleteFramebuffer(this.copy.fbo);
      gl.deleteTexture(this.copy.tex);
      this.copy = null;
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
    this.copy = { fbo, tex, w, h };
    return this.copy;
  }

  /** Draws `air` over `target` (the frame, bound as it was before: the pass rebinds it). */
  draw(target: Target, W: number, Hf: number, air: FallAir | null): void {
    if (!air || !this.prog) return;
    if (!air.veils.length && !air.shreds.length && air.wisp[1] <= 0.003 && air.shafts <= 0.003) return;
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
    gl.uniform2f(u.uRes!, W, Hf);
    const A = new Float32Array(32), B = new Float32Array(32), M = new Float32Array(128);
    const vs = air.veils.slice(0, 8);
    vs.forEach((v, i) => {
      A.set([v.row, Math.max(1, v.half), v.density, v.tone], i * 4);
      B.set([v.seed, v.x, v.x2, 0], i * 4);
      v.masses.slice(0, 4).forEach((m, k) => M.set(m, (i * 4 + k) * 4));
    });
    gl.uniform4fv(u.uA!, A);
    gl.uniform4fv(u.uB!, B);
    gl.uniform4fv(u.uM!, M);
    gl.uniform1i(u.uN!, vs.length);
    gl.uniform4f(u.uPaper!, air.paper?.[0] ?? 0, air.paper?.[1] ?? 0, air.paper ? 1 : 0, 0);
    gl.uniform4f(u.uSun!, air.sun[0], air.sun[1], 0, 0);
    gl.uniform4f(u.uWind!, air.gust, air.wisp[0], air.wisp[1], air.run);
    const S = new Float32Array(28 * 4);
    const ss = air.shreds.slice(0, 28);
    ss.forEach((s, i) => S.set(s, i * 4));
    if (u.uShred) gl.uniform4fv(u.uShred, S);
    gl.uniform1i(u.uNS!, ss.length);
    if (u.uShaft) gl.uniform4f(u.uShaft, air.shafts, 0, 0, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}
