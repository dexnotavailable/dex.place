// The opening's sky, the part that is the camera's own (Dex 10-16: "I need clouds, front fog layers on the camera, wind
// and stuff affecting the ofuda's path"): the air between the lens and the paper. Drawn LAST, over the world, the clouds
// and the paper: the one thing nearer than the paper.
//
// (fall loop, round 2, worker 2; rev 5's camera: the drop out of the black, the vast frame, the push-in, the fall)
// (fall loop, round 3, worker 2; rev 6's close ride at zoom 4) The fog layers now rise past on the camera's FALL (each
// at its own share of the play plane's rise: near fast, far slow) and leave by the frame's edge, never an opacity snap;
// they are big soft lumpy forms lit from the sun's side, no stepped rims; near-lens mist crosses the frame's corners in
// every close frame; the paper keeps a soft rift-shaped pocket (22% fog at most on it); the wind's strokes come in mixed
// groups (wisps, broken strands, faint sheets) torn off the gust's lobe; the plunge's air is broken streaks and puffs;
// at the catch a darker, cooler pocket behind the paper, puffs instead of a ribbon on the water, and a last breath of
// mist at her height.
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
 * A layer of the lens fog (round 3, worker 2: re-timed to the close ride's FALL, not its zoom). At T its middle is at
 * (fx, fy) on the frame; it spans 2 w x 2 half of the frame. From there it moves as the camera does: it rises past the
 * lens at `par` times the play plane's own rise on the frame (rev 6's zoom-4 ride: the play plane rises ~1390 px/s, so
 * par 0.7 is ~390 px per 0.4 s), entering from below the frame and leaving off its top (never an opacity snap), and
 * follows `pan` of the camera's sideways move. `drift`: the east wind's push on it (frame px / s, gusts x 3).
 * `speed`: render.mjs's fog strip spans 1.2 / speed s round T; its `lens-fog` frame is the layer with the largest
 * half x density (keep the four leading keys in this order: render.mjs reads them).
 * The look: `soft` 1 is the lens's own out-of-focus mist (big blurred torn forms, the softest thing in frame), 0.3 a
 * mid-distance lobe (still soft, a little crisper); `edge` 1 thickens it toward the frame's edges and corners and thins
 * it in the middle (the camera inside the cloud); `tail` drags its west side out into torn strands on the wind (its east
 * edge stays dense and round); `tear`: the share of it torn open into rifts streaming west.
 */
export interface Veil {
  T: number;
  speed: number;
  half: number;
  density: number;
  w: number;
  fx: number;
  fy: number;
  par: number;
  pan: number;
  drift: number;
  tone: "lit" | "base";
  tear: number;
  soft: number;
  edge: number;
  tail: number;
}

/**
 * The fog layers along the close ride (2.5-14.6; nothing in the drop or the glimpse: "wtf, there's a world below" stays
 * clean). Near forms (soft 1, par 1.1) cross the frame's edges and corners in every close frame, never the paper's
 * column: bottom left in `ride`, top right in `gust`, left in `deck`, top left in `come-out`. The thick passage at 6.95
 * (`lens-fog`) is three depths rising past at their own speeds (far slow, near fast) with a thin sheet ahead of it; the
 * gust's lobe hangs in the mid distance below the paper, its tails streaming west; the deck's fringe rises past at 9.6.
 */
export const VEILS: readonly Veil[] = [
  { T: 6.95, speed: 0.6, half: 0.72, density: 1, w: 1.1, fx: 0.46, fy: 0.5, par: 0.8, pan: 0.1, drift: 40, tone: "lit", tear: 0.34, soft: 0.6, edge: 1, tail: 0 },
  { T: 3.35, speed: 0.8, half: 0.3, density: 0.8, w: 0.22, fx: 0.94, fy: 0.42, par: 1.1, pan: 0.1, drift: 30, tone: "lit", tear: 0.3, soft: 1, edge: 0, tail: 0.2 },
  { T: 4.633, speed: 0.8, half: 0.38, density: 0.95, w: 0.26, fx: 0.08, fy: 0.82, par: 1.1, pan: 0.1, drift: 40, tone: "lit", tear: 0.28, soft: 1, edge: 0, tail: 0.25 },
  { T: 4.633, speed: 0.8, half: 0.17, density: 0.7, w: 0.16, fx: 0.99, fy: 0.16, par: 1.25, pan: 0.1, drift: 40, tone: "lit", tear: 0.3, soft: 1, edge: 0, tail: 0.3 },
  { T: 5.95, speed: 0.7, half: 0.26, density: 0.72, w: 0.55, fx: 0.7, fy: 0.5, par: 0.85, pan: 0.1, drift: 40, tone: "lit", tear: 0.44, soft: 0.7, edge: 0, tail: 0.35 },
  { T: 6.75, speed: 0.6, half: 0.62, density: 0.55, w: 1.2, fx: 0.52, fy: 0.46, par: 0.34, pan: 0.1, drift: 30, tone: "lit", tear: 0.38, soft: 0.4, edge: 0.4, tail: 0 },
  { T: 7.2, speed: 0.6, half: 0.48, density: 0.9, w: 0.7, fx: 0.24, fy: 0.56, par: 1.1, pan: 0.1, drift: 55, tone: "lit", tear: 0.26, soft: 1, edge: 1, tail: 0.3 },
  { T: 8.2, speed: 0.8, half: 0.12, density: 0.9, w: 0.15, fx: 0.57, fy: 0.57, par: 0.22, pan: 0.1, drift: 22, tone: "lit", tear: 0.3, soft: 0.3, edge: 0, tail: 1 },
  { T: 8.2, speed: 0.8, half: 0.26, density: 0.92, w: 0.2, fx: 0.98, fy: 0.2, par: 1.1, pan: 0.1, drift: 60, tone: "lit", tear: 0.3, soft: 1, edge: 0, tail: 0.7 },
  { T: 9.3, speed: 0.8, half: 0.28, density: 0.92, w: 0.22, fx: 0.05, fy: 0.8, par: 1.1, pan: 0.1, drift: 45, tone: "lit", tear: 0.3, soft: 1, edge: 0, tail: 0.4 },
  { T: 9.6, speed: 0.8, half: 0.2, density: 0.42, w: 0.9, fx: 0.46, fy: 0.62, par: 0.5, pan: 0.1, drift: 30, tone: "base", tear: 0.42, soft: 0.5, edge: 0, tail: 0.3 },
  { T: 10.617, speed: 0.8, half: 0.3, density: 0.92, w: 0.2, fx: 0.05, fy: 0.5, par: 1.1, pan: 0.1, drift: 40, tone: "base", tear: 0.28, soft: 1, edge: 0, tail: 0.3 },
  { T: 11.8, speed: 0.8, half: 0.3, density: 0.92, w: 0.22, fx: 0.95, fy: 0.72, par: 1.1, pan: 0.1, drift: 40, tone: "base", tear: 0.3, soft: 1, edge: 0, tail: 0.3 },
  { T: 12.9, speed: 0.8, half: 0.26, density: 0.92, w: 0.2, fx: 0.05, fy: 0.24, par: 1.1, pan: 0.1, drift: 40, tone: "base", tear: 0.3, soft: 1, edge: 0, tail: 0.3 },
  { T: 13.75, speed: 0.8, half: 0.24, density: 0.92, w: 0.2, fx: 0.95, fy: 0.3, par: 1.1, pan: 0.1, drift: 40, tone: "base", tear: 0.3, soft: 1, edge: 0, tail: 0.3 },
  { T: 14.6, speed: 0.8, half: 0.27, density: 0.92, w: 0.24, fx: 0.06, fy: 0.13, par: 1.0, pan: 0.1, drift: 40, tone: "lit", tear: 0.3, soft: 1, edge: 0, tail: 0.4 },
];

/** At most this many fog layers on the frame at once (the shader's arrays). */
export const VEIL_MAX = 8;

/** A fog layer on the frame now: its middle (frame px), scale, strength; its half sizes (frame px), seed, tone (0 lit,
 *  1 base); the churn's clock, the gust, its softness, its tears; its tails, its edge weight. */
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
  soft: number;
  tear: number;
  tail: number;
  edge: number;
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

/** The camera at T for the fall's own sums: its middle x and eye-level row (world px, relative to her feet's row), the
 *  scale (frame px per play-plane px). */
function camAt(T: number, Hf: number, W: number): { cx: number; eye: number; zoom: number } {
  const s = keysAt(T, BEATS.her.catchXH * H, W, Hf);
  return { cx: s.cx, eye: -((s.anchor - s.horizon) * Hf) / s.zoom, zoom: s.zoom };
}

/** How far the play plane has moved on the frame from T0 to T (frame px; y < 0: it has risen as the camera fell). */
function playShift(T0: number, T: number, W: number, Hf: number): [number, number] {
  const a = camAt(T0, Hf, W), b = camAt(T, Hf, W);
  return [-(b.cx * b.zoom - a.cx * a.zoom), -(b.eye * b.zoom - a.eye * a.zoom)];
}

/** The point the camera holds (the paper's place on the frame; the frame's middle when it is not in it). */
function focusAt(T: number, W: number, Hf: number): [number, number] {
  const p = paperScreenAt(T);
  return p ? [p[0] * W, p[1] * Hf] : [W / 2, Hf / 2];
}

/**
 * The close ride's span: fog layers only inside it (never in the drop, the glimpse or at the catch). It starts on the
 * camera's first close key (Dex 10-21: the glimpse eases back in to it; a fog layer placed by the camera's fall would
 * whip across the frame in a frame or two while it zooms in); they fade in over its first 0.4 s and out over its last.
 */
const RIDE: readonly [number, number] = [BEATS.camera.keys.find((k) => k.zoom >= 4)?.T ?? 2.5, 16.2];

/** The fog layers on the frame at T (none on way 4, none with reduced motion: they are pure motion). */
export function fallVeils(T: number, W: number, Hf: number, way: Way, reduced: boolean): VeilDraw[] {
  if (way === "bottom" || reduced || T < RIDE[0] || T > RIDE[1]) return [];
  const out: VeilDraw[] = [];
  const S = Hf / 1080;
  VEILS.forEach((v, i) => {
    if (Math.abs(T - v.T) > 4.5 || out.length >= VEIL_MAX) return;
    // (it rises with the camera's fall at its own share: from below the frame, up and off its top)
    const [sx, sy] = playShift(v.T, T, W, Hf);
    const wind = (run(T, 3) - run(v.T, 3)) * v.drift * S;
    const cx = v.fx * W + sx * v.pan - wind;
    const cy = v.fy * Hf + sy * v.par;
    const hw = v.w * W, hh = v.half * Hf;
    // its reach: the west tails stretch it; the torn rim reaches a little past its outline
    const west = hw * (1 + 2 * v.tail) * 1.5, east = hw * 1.5, rh = hh * 1.5;
    if (cy - rh > Hf || cy + rh < 0 || cx - west > W || cx + east < 0) return;
    out.push({
      cx, cy, g: 1, alpha: v.density * smooth(RIDE[0], RIDE[0] + 0.4, T) * (1 - smooth(RIDE[1] - 0.4, RIDE[1], T)),
      hw, hh, seed: i * 17.3 + 3.1, tone: v.tone === "base" ? 1 : 0,
      churn: T - v.T, gust: gustAt(T), soft: v.soft, tear: v.tear, tail: v.tail, edge: v.edge,
    });
  });
  return out;
}

/** The wind's ribbons on the frame (W2-5): up to eight strokes at once in the strongest gust. */
export const RIBBONS = 8;
/** Points along a ribbon (its visible stretch, tail to head). */
export const RIBBON_PTS = 16;

/** How far a point is from the paper, in the paper's own shape (it is tall at zoom 4: the ellipse is too). */
const paperGap = (x: number, y: number, p: readonly [number, number], S: number): number => Math.hypot((x - p[0]) / S, (y - p[1]) / (1.45 * S));

/**
 * The ribbons at T (W2-5): RIBBON_PTS points each ([x, y, width px, alpha]), tail first. Each gust sends GROUPS of
 * strokes, never one repeated tadpole: a wisp with a mist body (sometimes flicking over at its head), broken dashed
 * strands, and faint wide sheets, in pairs and trios flowing together at their own lengths and widths. They are torn
 * off something: off the west end of a fog lobe when one is on the frame (its tails), else off the frame's clouds
 * round the paper; they rise with the camera's fall (they are in the air) and are carried west, and keep well clear of
 * the paper (no halo across its head).
 */
export function fallRibbons(T: number, W: number, Hf: number, paper: readonly [number, number] | null, zoom: number, veils: readonly VeilDraw[] = []): number[][][] {
  const out: number[][][] = [];
  const vast = zoom < 0.35;
  const S = Hf / 1080;
  // each gust sends its own groups: more in a stronger one, spread over it (the paper's own gust envelope)
  const sched: [number, number, number][] = [];
  GUSTS.forEach((q, gi) => {
    const m = Math.abs(q.dx) / GMAX;
    const wide = keysAt(q.T + q.dur / 2, BEATS.her.catchXH * H, W, Hf).zoom < 0.35;
    const n = Math.min(wide ? 1 : 5, Math.round(1 + 4 * m * m));
    for (let j = 0; j < n; j++) {
      const t0 = q.T - 0.15 + q.dur * (0.04 + (0.8 * (j + 0.35 * hash(gi * 13.1 + j * 2.7))) / n);
      sched.push([t0, gi * 10 + j, m]);
    }
  });
  // the lobe the wind tears strands off (the most-tailed layer on the frame)
  const lobe = veils.filter((v) => v.tail >= 0.8 && v.alpha > 0.2).sort((a, b) => b.tail - a.tail)[0] ?? null;
  for (const [t0, k, m] of sched) {
    const r = (j: number): number => hash(k * 31.7 + j * 1.91 + 0.37);
    // the group: 1-3 strokes of mixed kinds (0 wisp, 1 strand, 2 sheet)
    const size = r(20) < 0.3 ? 1 : r(20) < 0.72 ? 2 : 3;
    const kinds = [r(21) < 0.55 ? 0 : 2, r(22) < 0.7 ? 1 : 0, 1];
    // where it is torn off (its east end), when it sets off
    const [px, py] = focusAt(t0 + 0.3, W, Hf);
    let x0: number, y0: number;
    if (lobe) {
      // the lobe's west end, at a height inside its body (the strands stream on west from it)
      x0 = lobe.cx - lobe.hw * (0.6 + 0.9 * r(9));
      y0 = lobe.cy + (r(10) - 0.5) * lobe.hh * 1.3;
    } else {
      x0 = px + (0.08 + 0.34 * r(9)) * W * (vast ? 0.5 : 1);
      y0 = py + (r(10) - 0.5) * Hf * (vast ? 0.32 : 0.66);
    }
    // (never through the paper's head: start a full paper's length above or below it)
    if (Math.abs(y0 - py) < 150 * S) y0 = py + Math.sign(y0 - py || 1) * (150 + 60 * r(11)) * S;
    y0 = Math.min(Hf * 0.84, Math.max(Hf * 0.15, y0));
    for (let mi = 0; mi < size; mi++) {
      if (out.length >= RIBBONS) break;
      const kind = kinds[mi]!;
      const rr = (j: number): number => hash(k * 31.7 + mi * 7.3 + j * 1.91 + 0.37);
      const ts = t0 + (mi ? 0.06 + 0.18 * rr(1) : 0);
      const life = (kind === 2 ? 1.7 : 1.2) + 0.5 * rr(2);
      const u = (T - ts) / life;
      if (u <= 0 || u >= 1) continue;
      const g = Math.max(m * 0.6, gustAt(ts + 0.45 * life));
      const scale = (vast ? 0.55 : 1) * S;
      const L = (kind === 0 ? 180 + 300 * rr(3) : kind === 1 ? 260 + 420 * rr(3) : 380 + 420 * rr(3)) * scale;
      const A = (kind === 2 ? 4 + 6 * rr(4) : 4 + 10 * rr(4)) * scale;
      const lam = (160 + 220 * rr(5)) * scale;
      const phi = rr(6) * 6.283;
      const lift = 0.04 + 0.08 * rr(7);
      // (only some wisps flick over at the head; strands and sheets run out straight)
      const curl = kind === 0 && rr(8) < 0.45;
      const curlDir = rr(9) < 0.7 ? -1 : 1;
      const r0 = (16 + 14 * rr(10)) * scale;
      const thick = (kind === 0 ? 5 + 16 * rr(11) : kind === 1 ? 1 + 2.4 * rr(11) : 26 + 34 * rr(11)) * scale;
      const peak = kind === 0 ? 0.62 + 0.25 * rr(12) : kind === 1 ? 0.5 + 0.25 * rr(12) : 0.13 + 0.1 * rr(12);
      // the group flows together: each member a little off the first, never on top of it
      const ox = mi ? (20 + 70 * rr(13)) * scale : 0;
      const oy = mi ? (rr(14) < 0.5 ? -1 : 1) * (12 + 26 * rr(15)) * scale : 0;
      // the wind carries it west as it is drawn; it rises with the camera's fall (it is in the air, mid distance)
      const carry = (T - ts) * (70 + 160 * g) * scale;
      const rise = playShift(ts, T, W, Hf)[1] * 0.12;
      const bx = x0 + ox - carry, by = y0 + oy + rise;
      const head = smooth(0, 0.6, u);
      const tail = smooth(0.3, 1, u);
      if (head - tail < 0.02) continue;
      const curlFrom = curl ? 0.86 : 1.01;
      const at = (s: number): [number, number] => {
        const sm = Math.min(s, curlFrom);
        const x = bx - sm * L;
        const y = by + A * Math.sin((6.283 * sm * L) / lam + phi) - lift * sm * L;
        if (s <= curlFrom) return [x, y];
        const e = 0.002;
        const xa = bx - (curlFrom - e) * L, ya = by + A * Math.sin((6.283 * (curlFrom - e) * L) / lam + phi) - lift * (curlFrom - e) * L;
        let tx = x - xa, ty = y - ya;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        let nx = -ty, ny = tx;
        if ((ny > 0 ? 1 : -1) !== curlDir) { nx = -nx; ny = -ny; }
        const cxp = x + nx * r0, cyp = y + ny * r0;
        const v0x = -nx * r0, v0y = -ny * r0;
        const sg = (-v0y * tx + v0x * ty) > 0 ? 1 : -1;
        const q = (s - curlFrom) / (1 - curlFrom);
        const ang = sg * q * 1.4;
        const rad = 1 - 0.2 * q;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        return [cxp + (v0x * ca - v0y * sa) * rad, cyp + (v0x * sa + v0y * ca) * rad];
      };
      const fade = smooth(0, 0.14, u) * (1 - smooth(0.45, 0.75, tail));
      // a strand breaks into dashes of its own lengths
      const dashL = (50 + 70 * rr(16)) * scale, dashP = rr(17) * 10;
      const pts: number[][] = [];
      for (let j = 0; j < RIBBON_PTS; j++) {
        const v = 1 - Math.pow(1 - j / (RIBBON_PTS - 1), kind === 0 ? 1.45 : 1.1);
        const s = tail + (head - tail) * v;
        const [x, y] = at(s);
        // a wisp: thick behind its head, a hair at its tail; a sheet: widest in its middle; a strand: a hair
        let wd = kind === 2 ? 2 + thick * Math.sin(Math.PI * Math.min(1, Math.max(0, v))) : (1.2 + thick * smooth(0.05, 0.62, v) * (1 - 0.55 * smooth(0.82, 1, v))) * (s > curlFrom ? 0.6 : 1);
        if (vast) wd *= 0.6;
        let a = (kind === 2 ? peak * Math.sin(Math.PI * v) : (0.35 + 0.65 * smooth(0, 0.6, v)) * peak) * fade;
        if (kind === 1) a *= 0.25 + 0.75 * smooth(-0.15, 0.35, Math.sin((s * L) / dashL + dashP));
        if (paper) a *= smooth(110, 170, paperGap(x, y, paper, S));
        pts.push([x, y, wd, a]);
      }
      out.push(pts);
    }
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

/** The plunge's air (W2-6): streaks and puffs rushing up past the lens while the camera falls out of the black. */
export const STREAKS = 10;

/**
 * The plunge's air at T: [x, y (its top), length, width, alpha, sway px, phase] each. Only while the camera itself
 * moves fast: from the moment it starts to drop out of the black slab (the slab's black is drawn over them until its
 * edge has passed: the sky and they come in together, at full strength by bar 0), gone before the glimpse (the world
 * below stays clean). Never ruled lines: each streak is broken into dashes of its own lengths, tapered at both ends and
 * a little curved, varied in length, width and brightness; among them short soft puffs of mist and specks (width > 3:
 * the shader draws those as soft shreds). All clear of the paper's column.
 */
export function fallStreaks(T: number, W: number, Hf: number, paper: readonly [number, number] | null): number[][] {
  const out: number[][] = [];
  const from = KEYS[1]?.T ?? 0.3;
  if (T < from) return out;
  // (the camera's fastest stretch is the hit and the pull-out; by the glimpse's frame they are gone)
  const k = 1 - smooth(1.0, 1.28, T);
  if (k <= 0) return out;
  // how far the air has rushed past (frame px): the camera's fall, quick
  const rushed = (T - from) * 4600 * (0.55 + 0.45 * k);
  for (let i = 0; i < STREAKS; i++) {
    // every other one a puff of mist or a speck, the rest short broken streaks
    const puff = i % 2 === 1;
    let fx = hash(i * 9.7 + 0.3);
    // keep the paper's column clear (the middle fifth of the frame)
    if (fx > 0.4 && fx < 0.6) fx = fx < 0.5 ? fx - 0.19 : fx + 0.19;
    const x = fx * W;
    const speed = 0.7 + 0.6 * hash(i * 3.3 + 1.1);
    const len = puff ? 18 + 60 * hash(i * 7.1) : (50 + 110 * hash(i * 5.9)) + 120 * k * speed;
    const span = Hf + len + 200;
    const y = fr(hash(i * 5.1 + 2.7) - (rushed * speed) / span) * span - len - 100;
    let a = (puff ? 0.2 + 0.22 * hash(i * 2.9) : 0.16 + 0.26 * hash(i * 2.9)) * (0.4 + 0.6 * k);
    if (paper && Math.abs(x - paper[0]) < 120) a *= Math.min(1, Math.abs(x - paper[0]) / 120);
    const wd = puff ? 5 + 13 * hash(i * 2.2) : 1 + 1.4 * hash(i * 4.4);
    out.push([Math.round(x), Math.round(y), len, wd, a, (puff ? 3 : 4 + 6 * hash(i * 6.1)) * (hash(i * 6.6) - 0.5) * 2, hash(i * 8.8) * 6.283]);
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
  /** (round 3, W2-8) The catch's pocket behind the paper: a darker, cooler haze round it so it keeps a value gap over
   *  the Walker's pale reflection on its last stretch to her hand (0..1). */
  pocket: number;
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
  const veils = fallVeils(T, W, Hf, way, reduced);
  return {
    veils, gust: gustAt(T),
    ribbons: fallRibbons(T, W, Hf, paper, zoom, veils), leaves: fallLeaves(T, W, Hf, paper, zoom), streaks: fallStreaks(T, W, Hf, paper),
    paper, sun: sunAt, shafts, pocket: smooth(16.4, 17.0, T),
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
 * - `ribbon`: low over the water, drifting west: a line of separate puffs of mist of their own sizes and strengths
 *   with uneven, torn edges and clear water between them (never one ruled bar; round 3, W2-8).
 * - `breath`: the fall's last breath at the catch (W2-8): a thin torn streamer of mist drifting west across the frame
 *   at her height, behind her and the jetty (rows: a share of the frame below the horizon row).
 * - `air`: the mid-air haze under the deck at the orchestra (0.3 of the frame above the horizon row).
 * `from` / `to`: T it fades in over 0.8 s and out over `out` s (1 by default).
 */
export const HAZE: readonly { kind: "bank" | "band" | "ribbon" | "air" | "breath"; before: PlaneId; rate: number; from: number; to: number; out?: number; lift: number; height: number; density: number; drift: number; seed: number }[] = [
  { kind: "bank", before: "far", rate: 0.06, from: 9.3, to: 15.9, out: 1.5, lift: 4, height: 300, density: 0.85, drift: 6, seed: 3.7 },
  { kind: "band", before: "mid", rate: 0.16, from: 9.4, to: 14.4, lift: 58, height: 120, density: 0.66, drift: 10, seed: 12.9 },
  { kind: "band", before: "back", rate: 0.42, from: 9.5, to: 12.0, out: 1.2, lift: 64, height: 60, density: 0.62, drift: 15, seed: 31.3 },
  { kind: "ribbon", before: "mid", rate: 0.2, from: 9.5, to: 14.6, lift: 13, height: 34, density: 0.72, drift: 13, seed: 9.1 },
  { kind: "ribbon", before: "mid", rate: 0.12, from: 14.2, to: BEATS.her.walkFrom, out: 1.6, lift: 7, height: 48, density: 0.92, drift: 9, seed: 21.4 },
  { kind: "air", before: "play", rate: 1, from: 11.2, to: 14.8, lift: 0, height: 0.18, density: 0.34, drift: 9, seed: 17.3 },
  { kind: "breath", before: "play", rate: 1, from: 16.3, to: BEATS.her.walkFrom, out: 1.4, lift: 0.27, height: 0.07, density: 0.52, drift: 46, seed: 27.7 },
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

const HAZE_KIND = { bank: 0, ribbon: 1, air: 2, band: 3, breath: 4 } as const;

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
    if (h.kind === "breath") {
      // at her height: a share of the frame below the horizon row (her body at the catch), drifting on the frame
      const hz = cam.horizon * cam.H;
      out.push({ row: hz + h.lift * cam.H, height: h.height * cam.H, density: h.density * k, x: Math.round(T * h.drift), seed: h.seed, kind: 4 });
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
      float len = smoothstep(0.3, 0.46, fbm(vec2(x / 520.0, hk.x + 11.0)));
      // (round 3, W2-9: banks of their own heights, tall heaps and low runs, never one level line)
      float tall = smoothstep(0.32, 0.7, fbm(vec2(x / 700.0, hk.x + 19.0)));
      float top = h.x - h.y * (0.12 + (0.35 + 0.9 * tall) * heap * mix(0.5, 1.0, len));
      float u = (p.y - top) / max(1.0, h.x - top);
      d = smoothstep(-0.03, 0.12, u) * (1.0 - 0.55 * smoothstep(0.55, 1.05, u)) * step(p.y, h.x + 2.0) * mix(0.55, 1.0, len);
      l = 1.0 - smoothstep(0.0, 0.45, u);
    } else if (hk.y < 1.5) {
      // the puffs (round 3, W2-8): separate drifting puffs of mist low over the water, each its own size, height and
      // strength, its edge torn; clear water between them (never one ruled bar)
      float cw = h.y * 3.2;
      float ci = floor(x / cw);
      for (int k = -1; k <= 1; k++) {
        float id = ci + float(k);
        float r1 = h2(vec2(id, hk.x)), r2 = h2(vec2(id + 7.1, hk.x)), r3 = h2(vec2(id + 3.3, hk.x + 1.0));
        if (r3 < 0.25) continue;
        float pcx = (id + 0.2 + 0.6 * r1) * cw;
        float pw = cw * (0.35 + 0.5 * r2), ph = h.y * (0.3 + 0.55 * r3);
        float pcy = h.x - ph * 0.6 - h.y * 0.35 * (r1 - 0.5);
        vec2 dq = vec2((x - pcx) / pw, (p.y - pcy) / ph);
        // (its top heaped, its underside flatter and thin; torn at its edge)
        float ed = length(vec2(dq.x, dq.y * (dq.y < 0.0 ? 1.0 : 1.6))) + 0.45 * (fbm(vec2(x / 46.0, p.y / 18.0) + hk.x + id) - 0.5);
        float dd = (1.0 - smoothstep(0.45, 1.0, ed)) * (0.45 + 0.55 * r2);
        if (dd > d) { d = dd; l = 1.0 - smoothstep(-0.8, 0.6, dq.y); }
      }
    } else if (hk.y < 2.5) {
      // the air: a soft haze lying under the deck, thickest at its middle row
      float u = (p.y - h.x) / h.y;
      float n = fbm(vec2(x / 420.0, p.y / 170.0) + hk.x);
      d = exp(-u * u * 2.2) * (0.55 + 0.7 * n) * smoothstep(0.32, 0.6, fbm(vec2(x / 560.0, hk.x + 2.0)));
      l = 1.0 - smoothstep(-1.0, 1.0, u);
    } else if (hk.y > 3.5) {
      // the breath (round 3, W2-8): a thin torn streamer drifting west at her height, riding up and down, broken into
      // lengths with fibres along the wind
      float c = h.x + h.y * 1.6 * (fbm(vec2(x / 520.0, hk.x + 5.0)) - 0.5);
      float hw = h.y * 0.5 * (0.3 + 0.9 * fbm(vec2(x / 190.0, hk.x + 2.0)));
      float e = 1.0 - abs(p.y - c) / max(1.0, hw);
      float len = smoothstep(0.42, 0.62, fbm(vec2(x / 300.0, hk.x + 9.0)));
      float fib = 0.75 + 0.5 * (vn(vec2(x / 60.0, p.y / 4.0 + hk.x)) - 0.5);
      d = smoothstep(0.0, 0.7, e) * len * fib;
      l = 1.0 - smoothstep(-0.8, 0.8, (p.y - c) / max(1.0, hw));
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
uniform vec4 uL0[8];      // a fog layer: its middle (frame px), scale, strength
uniform vec4 uL1[8];      // its half sizes (frame px), seed, tone (0 lit, 1 base)
uniform vec4 uL2[8];      // the churn's clock (s), the gust (0..1), its softness (1: the lens's own blur), its tears
uniform vec4 uL3[8];      // its west tails, its weight toward the frame's edges, 0, 0
uniform int uN;
uniform vec4 uPaper;      // x, y, on, 0
uniform vec4 uSun;        // x, y
uniform vec4 uRib[128];   // the wind's ribbons: 8 x 16 points (x, y, width, alpha), tail first
uniform int uNR;
uniform vec4 uLeaf[20];   // the leaves: (x, y, turn, face), (length, kind, alpha, 0)
uniform int uNL;
uniform vec4 uStreak[20]; // the plunge's air: (x, top, length, width), (alpha, sway px, phase, 0)
uniform int uNS;
uniform vec4 uShaft;      // the light shafts' strength (0..1)
uniform vec4 uPocket;     // the catch's pocket behind the paper (0..1)
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

// --- the fog (round 3, worker 2): each layer is a big soft torn form, thick and thin inside, its outline torn at its
// own scale (blurred as the lens would: the nearer, the softer), torn open by long rifts streaming west, lit by the sun
// (warm on the side toward it and on its sun-facing lumps, the clouds' cool blue in its shade). No steps anywhere: the
// one thing in the frame with lost edges. The rift field at layer px q (below the layer's threshold: open sky).
float riftOf(vec2 q, int i) {
  vec4 b = uL1[i], c = uL2[i];
  float sd = b.z;
  float sc = max(b.y, 160.0);
  // it slides west on the wind (faster in the gusts), sheared: lifting a little toward the west
  float slide = c.x * (50.0 + 160.0 * c.y);
  vec2 u = vec2((q.x + slide) / (sc * 1.5 * (1.0 + 0.8 * c.y)) + sd * 1.3, (q.y + 0.08 * q.x) / (sc * 0.34) + sd * 0.7);
  vec2 w = vec2(fbm3(u * 0.7 + vec2(3.3 + c.x * 0.05, 1.1)), fbm3(u * 0.7 + vec2(8.1 - c.x * 0.04, 4.4))) - 0.5;
  u += w * vec2(0.9, 0.55);
  float f = fbm3(u);
  // fibrous along the wind at a finer scale (soft: no steps)
  f += 0.07 * (vn(vec2((q.x + slide) / (sc * 0.7) + sd, q.y / (sc * 0.06))) - 0.5);
  return f;
}

// the plunge's streaks, the wind's ribbons and the leaves: drawn over the fog (they are nearer still)
vec4 ribbonAt(vec2 p) {
  // a stroke of air streaming west: a wisp (a mist body), a strand (a hair, broken) or a sheet (wide and faint); soft
  // across, torn along its length, its upper side lit warm white, its underside the clouds' cool shade
  float best = 0.0, side = 0.0;
  for (int r = 0; r < 8; r++) {
    if (r >= uNR) break;
    vec2 lo = vec2(1e5), hi = vec2(-1e5);
    float wmax = 0.0;
    for (int j = 0; j < 16; j++) { vec4 a = uRib[r * 16 + j]; lo = min(lo, a.xy); hi = max(hi, a.xy); wmax = max(wmax, a.z); }
    float pad = wmax * 0.6 + 4.0;
    if (p.x < lo.x - pad || p.x > hi.x + pad || p.y < lo.y - pad || p.y > hi.y + pad) continue;
    for (int j = 0; j < 15; j++) {
      vec4 a = uRib[r * 16 + j], b = uRib[r * 16 + j + 1];
      vec2 ab = b.xy - a.xy;
      float t = clamp(dot(p - a.xy, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
      vec2 off = p - a.xy - ab * t;
      float d = length(off);
      float w = mix(a.z, b.z, t) * 0.5;
      if (d > w + 1.0) continue;
      float al = mix(a.w, b.w, t);
      float u = d / max(w, 0.6) + 0.22 * (vn(vec2(dot(p, normalize(ab + 1e-4)) / (6.0 + w * 0.8), float(r) * 3.1)) - 0.5);
      // (a hair stays a hair; a wide sheet melts away across its width)
      float cov = w < 1.6 ? 1.0 - smoothstep(0.7, 1.15, u) : 1.0 - smoothstep(w > 10.0 ? 0.05 : 0.35, 1.0, u);
      if (cov * al > best) {
        best = cov * al;
        side = w > 2.0 ? clamp(-off.y / w, -1.0, 1.0) : 0.0;
      }
    }
  }
  vec3 col = mix(vec3(0.8, 0.85, 0.92), vec3(1.0, 0.982, 0.95), smoothstep(-0.6, 0.6, side));
  return vec4(col, best);
}

void main() {
  vec2 px = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  vec2 toP = uPaper.z > 0.5 ? px - uPaper.xy : vec2(1e4);
  float paperD = length(toP);
  bool touched = false;
  vec3 bg = src(px);

  // --- the fog: layer over layer (premultiplied)
  float keep = 1.0;
  vec3 acc = vec3(0.0);
  float dsun = length(px - uSun.xy) / uRes.x;
  float overSky = 1.0;
  if (uSkyOn > 0.5) {
    vec3 dd = abs(bg - skySrc(px));
    overSky = 1.0 - smoothstep(0.06, 0.16, max(dd.r, max(dd.g, dd.b)));
  }
  vec2 toSun = normalize(uSun.xy - px + vec2(0.001));
  vec2 fe = (px / uRes - 0.5) * vec2(1.0, 1.15);
  float rv = smoothstep(0.16, 0.62, length(fe));
  // the paper's pocket (its shape: tall), torn: the rifts open wider round it
  // (stretched west along the wind and warped at a large scale: it reads as a rift the paper falls in, never a porthole)
  vec2 tw = toP + 90.0 * (vec2(fbm3(px / 260.0 + 4.1), fbm3(px / 260.0 + 9.6)) - 0.5);
  float pd = uPaper.z > 0.5 ? length(vec2(tw.x * (tw.x < 0.0 ? 0.5 : 0.8), tw.y / 1.45)) : 1e4;
  float nearP = 1.0 - smoothstep(70.0, 260.0, pd);
  for (int i = 0; i < 8; i++) {
    if (i >= uN) break;
    vec4 l0 = uL0[i], b = uL1[i], c = uL2[i], e = uL3[i];
    vec2 q = (px - l0.xy) / l0.z;
    float soft = c.z;
    // its west side dragged out along the wind (more in the gusts)
    float tl = e.x * (1.0 + 0.6 * c.y);
    // (eased in across its middle: no seam where the stretch begins)
    vec2 qe = vec2(q.x / (1.0 + 2.0 * tl * (1.0 - smoothstep(-0.5 * b.x, 0.2 * b.x, q.x))), q.y);
    float er = length(qe / b.xy);
    if (er > 1.7) continue;
    float sc = b.y;
    // its form: big lobes carrying smaller ones round a core (a cloud's own silhouette, never an ellipse), the lobes
    // churning slowly; a tailed lobe's east edge denser and rounder
    vec2 wq = qe / (sc * vec2(0.62, 0.5)) + b.z + vec2(c.x * 0.05, c.x * 0.02);
    vec2 wp = vec2(fbm3(wq * 0.6 + 7.7), fbm3(wq * 0.6 + 2.9)) - 0.5;
    float rough = e.x > 0.01 ? mix(1.0, 0.6, smoothstep(-0.25 * b.x, 0.35 * b.x, q.x)) : 1.0;
    float shape = (1.0 - er) * 1.25 + rough * (1.1 * (fbm3(wq + wp * 1.2) - 0.5) + 0.3 * (vn(qe / (sc * 0.15) + b.z * 1.7) - 0.5));
    float ew = mix(0.1, 0.42, soft);
    float env = smoothstep(0.0, ew, shape);
    // the tails: the west side breaks into long strands that taper to nothing
    if (e.x > 0.0 && q.x < 0.0) {
      float along = clamp(-q.x / (b.x * (1.0 + 2.0 * tl)), 0.0, 1.0);
      float st = 0.62 * vn(vec2(q.x / (b.x * 0.9) + c.x * 0.3 + b.z, q.y / (sc * 0.16) + b.z * 0.3)) + 0.38 * vn(vec2(q.x / (b.x * 0.35) + b.z, q.y / (sc * 0.07)));
      float strands = smoothstep(0.38, 0.72, st) * (1.0 - smoothstep(0.5, 1.0, along));
      env = mix(env, max(env * strands, strands * smoothstep(-0.5, 0.2, shape)), smoothstep(0.08, 0.5, along) * min(1.0, e.x));
    }
    if (env <= 0.002) continue;
    // thick and thin inside
    float body = fbm3(qe / (sc * vec2(0.5, 0.32)) + b.z * 2.1 + vec2(c.x * 0.04, 0.0));
    // (the lens's own fog is thicker toward the frame's edges and corners, thinner in the middle)
    float edgeW = mix(1.0, mix(0.5, 1.0, rv), e.y);
    float D = env * mix(mix(0.4, 0.6, soft), 1.0, smoothstep(0.3, 0.66, body)) * edgeW * l0.w;
    // the rifts: long, streaming west, more of them toward the frame's middle and round the paper
    float th = c.w + 0.1 * e.y * (1.0 - rv) + 0.06 * nearP;
    float hw = mix(0.035, 0.1, soft);
    float hole = smoothstep(th + hw, th - hw, riftOf(q, i));
    float a = D * (1.0 - (0.45 + 0.55 * overSky) * hole);
    // (over a cloud it ghosts the cloud, never bleaches it to one flat white)
    // (the lens's own near mist is in front of everything: it veils a cloud as much as the sky)
    a *= mix(0.6 + 0.35 * smoothstep(0.8, 1.0, soft), 1.0, overSky);
    if (a <= 0.002) continue;
    // its light: its form seen from the sun's side (where the form thins toward the sun, its face is lit; where it
    // thickens toward the sun, it is in its own shade), warm toward the sun and high, the clouds' cool blue away
    vec2 sq = qe + toSun * sc * 0.16;
    float erS = length(sq / b.xy);
    vec2 wqS = sq / (sc * vec2(0.62, 0.5)) + b.z + vec2(c.x * 0.05, c.x * 0.02);
    float shapeS = (1.0 - erS) * 1.25 + rough * 1.1 * (fbm3(wqS + wp * 1.2) - 0.5);
    float face = clamp((shape - shapeS) * 2.6, -1.0, 1.0);
    float warm = 0.5 + 0.42 * face + 0.22 * (1.0 - clamp(dsun * 1.3, 0.0, 1.0)) - 0.1 + 0.08 * (1.0 - px.y / uRes.y) - 0.18 * smoothstep(0.55, 0.85, body) * (1.0 - env * 0.0);
    warm = mix(warm, warm * 0.7, b.w);
    warm = clamp(warm, 0.0, 1.0);
    vec3 shade = vec3(0.64, 0.71, 0.85), mid = vec3(0.865, 0.895, 0.945), lit = vec3(1.0, 0.972, 0.928);
    vec3 col = warm < 0.5 ? mix(shade, mid, warm * 2.0) : mix(mid, lit, warm * 2.0 - 1.0);
    acc = col * a + acc * (1.0 - a);
    keep *= 1.0 - a;
  }
  float Dt = 1.0 - keep;
  // the paper keeps a soft pocket: 22% at most within ~110 px of it, easing out by ~230 px (never an edge across it)
  if (uPaper.z > 0.5 && Dt > 0.004) {
    float cap = mix(0.22, 1.0, smoothstep(80.0, 330.0, pd));
    if (Dt > cap) { acc *= cap / Dt; Dt = cap; }
  }
  if (Dt > 0.004) {
    vec3 fog = acc / max(Dt, 1e-4);
    // a film this thin over the deep sky is the sky's own light scattered (a cerulean, never grey)
    vec3 glow = min(bg * vec3(1.02, 1.04, 1.03) + vec3(0.07, 0.08, 0.07), vec3(1.0));
    fog = mix(glow, fog, smoothstep(0.05, 0.22, Dt));
    bg = mix(bg, fog, Dt);
    touched = true;
  }

  // --- the catch's pocket (round 3, W2-8): behind the paper (never on it: its warm pixels are left alone) a soft torn
  // patch of darker, cooler haze, so the paper keeps a value gap over the Walker's pale reflection to her hand
  if (uPocket.x > 0.003 && uPaper.z > 0.5) {
    float r = length(toP / vec2(104.0, 70.0)) + 0.4 * (fbm3(px / 34.0 + 2.2) - 0.5);
    float m = (1.0 - smoothstep(0.3, 1.0, r)) * uPocket.x;
    float paperish = smoothstep(0.1, 0.2, bg.r - bg.b);
    if (m * (1.0 - paperish) > 0.003) {
      bg = mix(bg, bg * vec3(0.7, 0.82, 0.88), 0.6 * m * (1.0 - paperish));
      touched = true;
    }
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

  // --- the plunge's air: streaks rushing up past the lens, broken into dashes and tapered (never a ruled line), and
  // soft puffs of mist among them; their tops brightest
  for (int i = 0; i < 10; i++) {
    if (i >= uNS) break;
    vec4 s = uStreak[i * 2], s2 = uStreak[i * 2 + 1];
    if (px.y < s.y || px.y > s.y + s.z) continue;
    float u = (px.y - s.y) / s.z;
    float cx = s.x + s2.y * sin(u * 2.6 + s2.z);
    bool puff = s.w > 3.0;
    float hw = s.w * 0.5 * pow(sin(3.14159 * u), puff ? 0.5 : 0.7) * (1.0 - 0.35 * u);
    float dx = abs(px.x - cx);
    if (dx > hw + 0.8) continue;
    float a = s2.x * (1.0 - smoothstep(0.1, 1.0, u)) * smoothstep(0.0, 0.08, u);
    if (puff) a *= 1.0 - smoothstep(0.2, 1.0, dx / max(hw, 0.5));
    else a *= smoothstep(0.32, 0.56, vn(vec2(u * s.z / 30.0, float(i) * 7.3 + s2.z))) * (1.0 - 0.6 * smoothstep(0.55, 1.0, dx / max(hw, 0.5)));
    if (a > 0.004) {
      bg = mix(bg, vec3(0.965, 0.98, 1.0), a);
      touched = true;
    }
  }

  // --- the wind's ribbons
  if (uNR > 0) {
    vec4 rb = ribbonAt(px);
    // (over a cloud's body a stroke thins: it reads as torn off that cloud's edge, at its depth)
    float aq = rb.a * mix(0.65, 1.0, overSky);
    if (aq > 0.004) {
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
    if (!air.veils.length && !air.ribbons.length && !air.leaves.length && !air.streaks.length && air.shafts <= 0.003 && air.pocket <= 0.003) return;
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
    const L0 = new Float32Array(VEIL_MAX * 4), L1 = new Float32Array(VEIL_MAX * 4), L2 = new Float32Array(VEIL_MAX * 4), L3 = new Float32Array(VEIL_MAX * 4);
    const vs = air.veils.slice(0, VEIL_MAX);
    vs.forEach((v, i) => {
      L0.set([v.cx, v.cy, Math.max(1e-3, v.g), v.alpha], i * 4);
      L1.set([Math.max(1, v.hw), Math.max(1, v.hh), v.seed, v.tone], i * 4);
      L2.set([v.churn, v.gust, v.soft, v.tear], i * 4);
      L3.set([v.tail, v.edge, 0, 0], i * 4);
    });
    if (u.uL0) gl.uniform4fv(u.uL0, L0);
    if (u.uL1) gl.uniform4fv(u.uL1, L1);
    if (u.uL2) gl.uniform4fv(u.uL2, L2);
    if (u.uL3) gl.uniform4fv(u.uL3, L3);
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
    if (u.uPocket) gl.uniform4f(u.uPocket, air.pocket, 0, 0, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}
