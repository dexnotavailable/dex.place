// Windows into the world (Dex 10-18: "we start with the whole background white, then punch in some windows into the
// world, each window showing something different"; 10-19: bigger, the world dominates). The page is plain white; with
// each section a window looks into Tesu, each onto a different place in its own light: the Walker wading through the
// clouds, the palace at dawn, the floating isles at noon, Kagami's lake and its torii islet, a pine over the karst at
// dusk, the hall door in the morning mist. Each is composed from the world's own painters (motion/painters.ts starts
// the worker a place needs) over a dithered sky, and lives a little: clouds drift, the isles and the boat bob, egrets
// cross, the lake shimmers, the mist creeps. Its edge is a hole torn in the paper, drawn into the window itself, seeded
// per window so no two holes look alike. How the windows move with the scroll and arrive is a look (motion/looks.ts).
//
// Light: a window paints only the first time it comes near the screen; only windows on screen animate (a few frames
// a second, every frame only while the page scrolls under a look that follows it or a window is arriving; nothing when
// none is on screen); reduced motion: each is drawn once, still. Whole pixels only (k device px per art px).

import { LOOK, initCutEntries } from "./looks.ts";
import type { Look } from "./look-mode.ts";
import { painterWorker, type PainterEntry } from "./painters.ts";
import { rampIndex } from "./sky-plan.ts";
import type { CloudDone, CloudJob } from "./paint-core.ts";

export type SceneId = "sky" | "palace" | "isles" | "lake" | "pine" | "door";

type Rgb = [number, number, number];

export interface ScenePiece {
  kind: string;
  p: Record<string, unknown>;
  /** The piece's height as a share of the window's (its density is chosen to fit). */
  fit: number;
  /** Where its anchor sits, shares of the window (x across, y down). */
  x: number;
  y: number;
  /** Slow sway across (art px) and its speed; a bob up and down (art px); a crossing (art px / s, wraps). */
  sway?: number;
  speed?: number;
  bob?: number;
  cross?: number;
  seed?: number;
  /** How far it sinks into the sky's haze (0..1: far things paler). */
  haze?: number;
  /** How near it is, 0 (the sky) .. 1 (the nearest): how much it moves under a look with depth (default by kind). */
  z?: number;
}

export interface Scene {
  /** The worker whose painters draw it. */
  entry: PainterEntry;
  /** Sky colours, top to bottom (a dithered ramp between them). */
  sky: Rgb[];
  pieces: ScenePiece[];
  /** A lake from this height down (share of the window), its colours top to bottom. */
  water?: { y: number; tones: Rgb[] };
  /** A band of mist (white, dithered) at this height, this deep (shares), drawn before piece `before`; `dens` its
   *  thickest (0..1, 0.75 if not given). */
  mist?: { y: number; h: number; before: number; dens?: number };
  /** The Walker (the world's own frame, public/tesu/walker), far off in the haze: height share, anchor, haze. */
  walker?: { fit: number; x: number; y: number; haze: number; before: number };
  /** The same place framed for a wide window (wider than WIDE : 1, across the page): its own pieces (and mist). */
  wide?: Pick<Scene, "pieces"> & Partial<Pick<Scene, "mist" | "water" | "walker">>;
}

/** A window this much wider than tall shows its place's wide framing (the windows across the page). */
export const WIDE = 1.8;

// the world's light, through the day (its painters are lit for the morning key; these are the skies they stand in)
const NOON: Rgb[] = [[30, 84, 156], [56, 122, 192], [104, 166, 222], [168, 208, 240], [214, 234, 249]];
const HIGH: Rgb[] = [[22, 66, 132], [36, 92, 164], [64, 128, 196], [120, 176, 228], [196, 226, 248]];
const DAWN: Rgb[] = [[70, 128, 196], [128, 178, 226], [190, 218, 240], [242, 230, 214], [252, 236, 214]];
const DUSK: Rgb[] = [[52, 62, 120], [118, 96, 156], [212, 132, 148], [246, 176, 132], [254, 214, 160]];
const AFTER: Rgb[] = [[40, 92, 164], [78, 140, 202], [138, 188, 228], [204, 222, 230], [244, 230, 204]];
const MIST: Rgb[] = [[150, 170, 186], [178, 194, 206], [204, 214, 222], [224, 230, 234], [238, 240, 242]];
const LAKE: Rgb[] = [[219, 242, 235], [176, 226, 212], [131, 204, 191], [90, 178, 167], [63, 145, 140]];

/** The places (art px are the world's; every piece is painted to fit its window). */
export const SCENES: Readonly<Record<SceneId, Scene>> = {
  // the Walker wading through the cloud sea, far off: Tesu's landmark in its sky
  sky: {
    entry: "sky",
    sky: HIGH,
    walker: { fit: 0.5, x: 0.6, y: 0.82, haze: 0.42, before: 2 },
    pieces: [
      { kind: "op.cloud", p: { kind: "tower", w: 230, h: 300 }, fit: 0.62, x: 0.2, y: 0.8, sway: 4, speed: 0.04, seed: 5, haze: 0.2 },
      { kind: "op.cloud", p: { kind: "wisp", w: 260, h: 30 }, fit: 0.07, x: 0.7, y: 0.24, sway: 10, speed: 0.07, seed: 7 },
      { kind: "op.cloud", p: { kind: "cumulus", w: 460, h: 150, tower: 0.45 }, fit: 0.32, x: 0.62, y: 1.02, sway: 5, speed: 0.04, seed: 3 },
      { kind: "op.cloud", p: { kind: "stratus", w: 640, h: 50 }, fit: 0.16, x: 0.3, y: 1.04, sway: 6, speed: 0.03, seed: 4 },
      { kind: "op.birds", p: { n: 4, w: 120, h: 40, kind: "egret", size: 5 }, fit: 0.1, x: 0.3, y: 0.42, cross: 5, seed: 9 },
    ],
  },
  // the palace at dawn, a gate tower before it, the far karst
  palace: {
    entry: "palace",
    sky: DAWN,
    pieces: [
      { kind: "op.cloud", p: { kind: "cumulus", w: 340, h: 180, tower: 0.9 }, fit: 0.36, x: 0.82, y: 0.55, sway: 5, speed: 0.04, seed: 11 },
      { kind: "op.farkarst", p: { w: 900, h: 178, rows: 2, groups: [[80, 380], [480, 860, 0.62]], haze: 0.6 }, fit: 0.26, x: 0.5, y: 0.8 },
      { kind: "op.palace", p: { w: 1200, h0: 537, h1: 403, h2: 307, door: [500, 200, 355] }, fit: 0.8, x: 0.22, y: 0.97 },
      { kind: "op.tower", p: { h: 420, w: 60 }, fit: 0.66, x: 0.08, y: 1.01 },
    ],
    // across the page: the palace between its gate towers, the karst ranges all along the dawn horizon
    wide: {
      pieces: [
        { kind: "op.cloud", p: { kind: "wisp", w: 280, h: 30 }, fit: 0.06, x: 0.62, y: 0.2, sway: 10, speed: 0.06, seed: 13 },
        { kind: "op.cloud", p: { kind: "cumulus", w: 340, h: 180, tower: 0.9 }, fit: 0.42, x: 0.84, y: 0.6, sway: 5, speed: 0.04, seed: 11 },
        { kind: "op.farkarst", p: { w: 900, h: 178, rows: 2, groups: [[80, 380], [480, 860, 0.62]], haze: 0.6 }, fit: 0.24, x: 0.24, y: 0.8 },
        { kind: "op.farkarst", p: { w: 900, h: 170, rows: 2, groups: [[60, 420], [560, 880]], haze: 0.6 }, fit: 0.2, x: 0.72, y: 0.82 },
        { kind: "op.palace", p: { w: 1200, h0: 537, h1: 403, h2: 307, door: [500, 200, 355] }, fit: 0.84, x: 0.4, y: 0.99 },
        { kind: "op.tower", p: { h: 420, w: 60 }, fit: 0.7, x: 0.2, y: 1.02 },
        { kind: "op.tower", p: { h: 420, w: 60 }, fit: 0.62, x: 0.62, y: 1.02 },
      ],
    },
  },
  // the floating isles at noon
  isles: {
    entry: "sky",
    sky: NOON,
    pieces: [
      { kind: "op.cloud", p: { kind: "wisp", w: 280, h: 30 }, fit: 0.07, x: 0.7, y: 0.2, sway: 8, speed: 0.06, seed: 17 },
      { kind: "op.isle", p: { w: 92, h: 120, tower: "bell" }, fit: 0.87, x: 0.32, y: 0.41, bob: 1, speed: 0.6, seed: 19 },
      { kind: "op.isle", p: { w: 110, h: 96, tower: "drum" }, fit: 0.66, x: 0.76, y: 0.57, bob: 1, speed: 0.5, seed: 23 },
      { kind: "op.cloud", p: { kind: "cumulus", w: 460, h: 150, tower: 0.45 }, fit: 0.36, x: 0.42, y: 1.03, sway: 6, speed: 0.03, seed: 29 },
      { kind: "op.birds", p: { n: 3, w: 90, h: 30, kind: "egret", size: 5 }, fit: 0.08, x: 0.55, y: 0.33, cross: 4, seed: 31 },
    ],
  },
  // Kagami's lake, its torii islet and a boat, in the warm afternoon
  lake: {
    entry: "kagami",
    sky: AFTER,
    water: { y: 0.64, tones: LAKE },
    pieces: [
      { kind: "op.cloud", p: { kind: "cumulus", w: 460, h: 150, tower: 0.45 }, fit: 0.3, x: 0.3, y: 0.5, sway: 6, speed: 0.04, seed: 37 },
      { kind: "op.farkarst", p: { w: 900, h: 170, rows: 2, groups: [[60, 420], [560, 880]], haze: 0.6 }, fit: 0.22, x: 0.5, y: 0.645 },
      { kind: "op.islet", p: { kind: "torii", w: 96, h: 13 }, fit: 0.26, x: 0.64, y: 0.7 },
      { kind: "op.boat", p: { w: 70 }, fit: 0.1, x: 0.24, y: 0.86, bob: 1, speed: 1.1, seed: 41 },
      { kind: "op.birds", p: { n: 3, w: 90, h: 30, kind: "egret", size: 5 }, fit: 0.08, x: 0.4, y: 0.34, cross: 4, seed: 43 },
    ],
    // across the page: the whole lake, karst along its far shore, the torii islet off-centre, a boat crossing
    wide: {
      water: { y: 0.66, tones: LAKE },
      pieces: [
        { kind: "op.cloud", p: { kind: "cumulus", w: 460, h: 150, tower: 0.45 }, fit: 0.32, x: 0.18, y: 0.52, sway: 6, speed: 0.04, seed: 37 },
        { kind: "op.cloud", p: { kind: "cumulus", w: 300, h: 150, tower: 0.6 }, fit: 0.26, x: 0.8, y: 0.5, sway: 5, speed: 0.05, seed: 39 },
        { kind: "op.cloud", p: { kind: "wisp", w: 280, h: 30 }, fit: 0.05, x: 0.5, y: 0.18, sway: 8, speed: 0.06, seed: 35 },
        { kind: "op.farkarst", p: { w: 900, h: 170, rows: 2, groups: [[60, 420], [560, 880]], haze: 0.6 }, fit: 0.2, x: 0.26, y: 0.665 },
        { kind: "op.farkarst", p: { w: 900, h: 178, rows: 2, groups: [[120, 460], [560, 860, 0.7]], haze: 0.6 }, fit: 0.24, x: 0.74, y: 0.665 },
        { kind: "op.islet", p: { kind: "torii", w: 96, h: 13 }, fit: 0.28, x: 0.6, y: 0.74 },
        { kind: "op.boat", p: { w: 70 }, fit: 0.1, x: 0.3, y: 0.88, bob: 1, speed: 1.1, cross: 3, seed: 41 },
        { kind: "op.birds", p: { n: 3, w: 90, h: 30, kind: "egret", size: 5 }, fit: 0.08, x: 0.4, y: 0.34, cross: 4, seed: 43 },
      ],
    },
  },
  // a pine over the karst, the mist in the valleys, at dusk
  pine: {
    entry: "kagami",
    sky: DUSK,
    mist: { y: 0.76, h: 0.14, before: 2 },
    pieces: [
      { kind: "op.cloud", p: { kind: "cumulus", w: 300, h: 150, tower: 0.6 }, fit: 0.32, x: 0.74, y: 0.58, sway: 5, speed: 0.05, seed: 47, haze: 0.3 },
      { kind: "op.farkarst", p: { w: 900, h: 178, rows: 2, groups: [[120, 460], [560, 860, 0.7]], haze: 0.6 }, fit: 0.32, x: 0.5, y: 0.84 },
      { kind: "op.pine", p: { h: 260, dir: 1 }, fit: 0.78, x: 0.1, y: 1.04, seed: 53 },
    ],
  },
  // the hall door in the morning mist: its red doors between two gate towers, the land's banners above
  door: {
    entry: "palace",
    sky: MIST,
    mist: { y: 0.84, h: 0.14, before: 4, dens: 0.3 },
    pieces: [
      { kind: "op.cloud", p: { kind: "stratus", w: 640, h: 50 }, fit: 0.14, x: 0.5, y: 0.34, sway: 6, speed: 0.03, seed: 61, haze: 0.4 },
      { kind: "op.tower", p: { h: 420, w: 60 }, fit: 0.86, x: 0.13, y: 1.0 },
      { kind: "op.tower", p: { h: 420, w: 60 }, fit: 0.86, x: 0.87, y: 1.0 },
      { kind: "op.doors", p: { w: 200, h: 355 }, fit: 0.6, x: 0.28, y: 1.0 },
      { kind: "op.banners", p: { w: 300, drop: 120, n: 4 }, fit: 0.3, x: 0.2, y: 0.12, sway: 1, speed: 0.2 },
    ],
    // across the page: the doors between their towers in the middle, the karst going grey into the mist both sides
    wide: {
      mist: { y: 0.8, h: 0.18, before: 4, dens: 0.4 },
      pieces: [
        { kind: "op.cloud", p: { kind: "stratus", w: 640, h: 50 }, fit: 0.12, x: 0.3, y: 0.3, sway: 6, speed: 0.03, seed: 61, haze: 0.4 },
        { kind: "op.cloud", p: { kind: "stratus", w: 640, h: 50 }, fit: 0.1, x: 0.78, y: 0.42, sway: 5, speed: 0.025, seed: 63, haze: 0.5 },
        { kind: "op.farkarst", p: { w: 900, h: 178, rows: 2, groups: [[80, 380], [480, 860, 0.62]], haze: 0.8 }, fit: 0.3, x: 0.16, y: 0.86 },
        { kind: "op.farkarst", p: { w: 900, h: 170, rows: 2, groups: [[60, 420], [560, 880]], haze: 0.8 }, fit: 0.26, x: 0.86, y: 0.86 },
        { kind: "op.tower", p: { h: 420, w: 60 }, fit: 0.86, x: 0.38, y: 1.0 },
        { kind: "op.tower", p: { h: 420, w: 60 }, fit: 0.86, x: 0.62, y: 1.0 },
        { kind: "op.doors", p: { w: 200, h: 355 }, fit: 0.6, x: 0.44, y: 1.0 },
        { kind: "op.banners", p: { w: 300, drop: 120, n: 4 }, fit: 0.3, x: 0.4, y: 0.12, sway: 1, speed: 0.2 },
      ],
    },
  },
};

/** A ramp of `n` steps through the key colours. */
function ramp(keys: Rgb[], n: number): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * (keys.length - 1);
    const a = keys[Math.floor(u)]!, b = keys[Math.min(keys.length - 1, Math.floor(u) + 1)]!, f = u - Math.floor(u);
    out.push([Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)]);
  }
  return out;
}

const hash = (a: number, b: number, s = 0): number => {
  let h = Math.imul(a * 374761393 + b * 668265263 + s * 2246822519, 3266489917) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

/**
 * The window's edge: a hole torn in the white paper by hand (Dex 10-19: "patches of the world punched into a white
 * page"; not a stamped speckle frame). W x H art px; the paper (white) all round a hole whose outline wanders: a slow
 * swell and a few smaller bites along it, the corners rounded each its own way, the line itself jagged a pixel or two;
 * at the tear the paper's fibres show, a thin fringe of white pixels thinning into the world (the dissolve Dex asked for
 * on 10-16, kept to the torn edge). Seeded per window, so no two holes are alike. The outermost pixel all round is
 * paper, so no colour line can frame the hole. Pure (checks read it): RGBA bytes, white with alpha 255 or nothing.
 */
export function holeMask(W: number, H: number, seed: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(W * H * 4);
  const sh = tearShape(W, H, seed);
  const { fringe } = sh;
  const far = sh.inset + sh.amp * 2 + fringe + 4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (sh.dist(x, y) > far) continue;
      const { d, edge, along } = sh.at(x, y);
      let white = d < edge;
      let alpha = 255;
      if (!white && d < edge + fringe + 3) {
        // the paper's fibres at the tear: short hairs reaching into the world, thicker in places along the edge, a
        // few loose flecks; and a breath of white just inside it (the light through the torn paper's edge)
        const out1 = d - edge;
        const clump = hash(Math.floor(along / 14), seed, 31);
        const hair = hash(along, seed, 23) < 0.06 + 0.3 * clump ? 1 + Math.floor(hash(along, seed, 29) * (fringe + 1)) : 0;
        white = out1 < hair || hash(x, y, seed + 13) < 0.05 * Math.max(0, 1 - out1 / (fringe + 1));
        if (!white && out1 < 3) { white = true; alpha = out1 < 1 ? 110 : out1 < 2 ? 56 : 24; }
      }
      if (!white) continue;
      const i = (y * W + x) * 4;
      out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; out[i + 3] = alpha;
    }
  }
  return out;
}

/**
 * The torn outline of a window W x H art px, seeded: at a pixel, how far in it is from the paper's edge (d, the
 * corners rounded each its own way) and where the tear runs there (edge: the paper's margin, a slow swell and smaller
 * bites around the hole, a pixel's jag), with its place along the outline.
 */
function tearShape(W: number, H: number, seed: number) {
  const s = Math.min(W, H);
  const r = (i: number): number => hash(seed * 31 + i, seed * 17 + 3, 11);
  const inset = Math.max(2, Math.round(s * 0.03));
  const amp = Math.max(1.5, s * 0.034);
  const fringe = Math.max(2, Math.round(s * 0.014));
  // the outline's wander: a few waves around the hole (whole numbers of them, so it closes), random phases
  const waves = [[2, 0.5], [3, 0.36], [5, 0.24], [8, 0.15], [13, 0.09], [21, 0.06]] as const;
  const ph = waves.map((_, i) => r(i) * Math.PI * 2);
  const norm = waves.reduce((m, [, a]) => m + a, 0);
  const rad = [0, 1, 2, 3].map((i) => s * (0.05 + 0.1 * r(10 + i)));
  const cx = W / 2, cy = H / 2;
  const per = 2 * (W + H);
  const dist = (x: number, y: number): number => {
    const dx = Math.min(x + 0.5, W - x - 0.5), dy = Math.min(y + 0.5, H - y - 0.5);
    const rq = rad[(x < cx ? 0 : 1) + (y < cy ? 0 : 2)]!;
    return dx < rq && dy < rq ? rq - Math.hypot(rq - dx, rq - dy) : Math.min(dx, dy);
  };
  const edgeAtAngle = (th: number): number => {
    let n = 0;
    for (let i = 0; i < waves.length; i++) n += waves[i]![1] * Math.sin(waves[i]![0] * th + ph[i]!);
    const along = Math.floor(((th + Math.PI) / (Math.PI * 2)) * per);
    return inset + amp * (1 + n / norm) + (hash(along >> 1, seed, 5) < 0.3 ? 1 : 0);
  };
  return {
    inset, amp, fringe, dist, edgeAtAngle,
    at(x: number, y: number): { d: number; edge: number; along: number } {
      const th = Math.atan2((y + 0.5 - cy) / H, (x + 0.5 - cx) / W);
      const along = Math.floor(((th + Math.PI) / (Math.PI * 2)) * per);
      return { d: dist(x, y), edge: edgeAtAngle(th), along };
    },
  };
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * The tear's signed distance at every pixel, in quarter art px: below 0 is paper, above it the world (the same outline
 * as holeMask, without the fibres). A window's arrival grows its hole from a smaller tear (motion/looks.ts): paper
 * wherever the field is below the extra margin. Pure.
 */
export function tearField(W: number, H: number, seed: number): Int16Array {
  const out = new Int16Array(W * H);
  const sh = tearShape(W, H, seed);
  // the tear's line by angle round the hole, looked up (an atan2 a pixel, no sines): 4096 steps round
  const N = 4096, cx = W / 2, cy = H / 2;
  const edgeBy = new Float32Array(N);
  for (let k = 0; k < N; k++) edgeBy[k] = sh.edgeAtAngle(((k + 0.5) / N) * Math.PI * 2 - Math.PI);
  for (let y = 0; y < H; y++) {
    const fy = (y + 0.5 - cy) / H;
    for (let x = 0; x < W; x++) {
      const th = Math.atan2(fy, (x + 0.5 - cx) / W);
      const e = edgeBy[Math.min(N - 1, ((th + Math.PI) / (Math.PI * 2)) * N | 0)]!;
      out[y * W + x] = Math.max(-32000, Math.min(32000, Math.round((sh.dist(x, y) - e) * 4)));
    }
  }
  return out;
}

interface Art { img: HTMLCanvasElement; ax: number; ay: number }

/** The place as a window of W x H art px shows it: its wide framing in a window across the page. Pure. */
export function framed(base: Scene, W: number, H: number): Scene {
  if (!base.wide || W / Math.max(1, H) <= WIDE) return base;
  const { wide } = base;
  return { ...base, pieces: wide.pieces, mist: wide.mist, water: wide.water ?? base.water, walker: wide.walker };
}

/** Where a window is, for the looks that move with the scroll or play as it arrives (motion/looks.ts). */
export interface WinState {
  W: number;
  H: number;
  /** Its order on the page (seeds, alternation). */
  index: number;
  /** The window's box and its band's box, viewport css px; the viewport's height. */
  top: number;
  bottom: number;
  bandTop: number;
  bandBottom: number;
  vh: number;
  /** When it came well into view the first time (performance.now() ms), or -1. */
  arrived: number;
}

/**
 * How the windows move (motion/looks.ts has the looks; none = the windows as they were: a few frames a second of
 * life, the torn edge still).
 */
export interface WindowMotion {
  /** Frames a second of the windows' life while one is on screen. */
  fps: number;
  /** Draw on every scroll frame (a look that moves with the scroll). */
  scrollLinked?: boolean;
  /** A piece's extra offset, art px (whole pixels). */
  offset?(s: WinState, pc: ScenePiece, i: number, now: number): readonly [number, number];
  /** The sky's (and the lake's) extra offset, art px. */
  backOffset?(s: WinState, now: number): readonly [number, number];
  /**
   * Paper (or anything) over the window while it arrives: write RGBA into `out` (W x H, cleared before each call);
   * return true while it still has something to draw, false once the window is simply open. `field()` is the tear's
   * signed distance (tearField), made on first ask.
   */
  cover?(s: WinState, field: () => Int16Array, out: Uint8ClampedArray, now: number): boolean;
  /** What the cover would draw now, as a number (a frame with the same key and nothing else moved is skipped); none:
   *  the cover is drawn every frame while it lasts. */
  coverKey?(s: WinState, now: number): number;
}

interface Win {
  el: HTMLElement;
  band: HTMLElement;
  index: number;
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** The place, and how this window frames it now (its wide framing when it is wide). */
  base: Scene;
  scene: Scene;
  W: number;
  H: number;
  k: number;
  /** The window height the art was painted for (repaint when the window has really changed size). */
  paintedH: number;
  back: HTMLCanvasElement | null;
  edge: HTMLCanvasElement | null;
  mist: HTMLCanvasElement | null;
  field: Int16Array | null;
  over: { img: ImageData; cv: HTMLCanvasElement } | null;
  covering: boolean;
  /** The last frame's plan (every position, the cover's key): an unchanged plan is not painted again. */
  plan: number[] | null;
  art: (Art | null)[];
  walker: HTMLCanvasElement | null;
  visible: boolean;
  seen: boolean;
  gen: number;
  dirty: boolean;
  st: WinState;
}

let walkerFrame: Promise<HTMLImageElement | null> | null = null;
const loadWalker = (): Promise<HTMLImageElement | null> =>
  (walkerFrame ??= new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = "/tesu/walker/wade-280/00.webp";
  }));

/** The windows as they were before the looks: a frame every 160 ms of life, nothing else. */
const STILL: WindowMotion = { fps: 6.25 };
/** How far into view a window comes before it has arrived (share of its height). */
const ARRIVE = 0.3;

export function initWindows(reduced: MediaQueryList, motion: WindowMotion = LOOK[document.documentElement.dataset.motion as Look] ?? STILL): void {
  if (document.documentElement.dataset.motion === "cuts") initCutEntries(reduced);
  const els = [...document.querySelectorAll<HTMLElement>("[data-window]")];
  if (!els.length) return;
  const wins: Win[] = [];
  let nextId = 1000;
  const pending = new Map<number, [Win, number, number]>();
  const listening = new Set<PainterEntry>();
  const listen = (e: PainterEntry): Worker => {
    const w = painterWorker(e);
    if (listening.has(e)) return w;
    listening.add(e);
    w.addEventListener("message", (ev: MessageEvent<CloudDone>) => {
      const job = pending.get(ev.data.id);
      if (!job) return;
      pending.delete(ev.data.id);
      const [win, i, gen] = job;
      if (gen !== win.gen) return;
      const d = ev.data;
      const img = document.createElement("canvas");
      img.width = d.w;
      img.height = d.h;
      img.getContext("2d")!.putImageData(new ImageData(d.rgba as Uint8ClampedArray<ArrayBuffer>, d.w, d.h), 0, 0);
      win.art[i] = { img, ax: d.ax, ay: d.ay };
      win.dirty = true;
      kick();
    });
    return w;
  };

  // --- sizing: read every window's box first, then write; a canvas is reset only when its pixel size changes, and
  // the art is painted again only when the window's height has really changed from the height it was painted for
  const measure = (win: Win): { W: number; H: number; k: number; dpr: number } | null => {
    const dpr = window.devicePixelRatio || 1;
    const r = win.el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const k = Math.max(1, Math.round(2 * dpr));
    return { W: Math.ceil((r.width * dpr) / k), H: Math.ceil((r.height * dpr) / k), k, dpr };
  };
  const apply = (win: Win, m: { W: number; H: number; k: number; dpr: number }): void => {
    const scene = framed(win.base, m.W, m.H);
    if (scene !== win.scene) {
      // the window changed shape enough to frame its place the other way: paint it again
      win.scene = scene;
      win.paintedH = 0;
      win.back = win.mist = null;
      win.walker = null;
    }
    if (m.W !== win.W || m.H !== win.H || m.k !== win.k) {
      win.W = win.st.W = m.W;
      win.H = win.st.H = m.H;
      win.k = m.k;
      win.cv.width = m.W;
      win.cv.height = m.H;
      win.cv.style.width = `${(m.W * m.k) / m.dpr}px`;
      win.cv.style.height = `${(m.H * m.k) / m.dpr}px`;
      win.back = win.edge = win.mist = null;
      win.field = null;
      win.over = null;
      win.dirty = true;
    }
    if (win.seen && (!win.paintedH || Math.abs(win.H - win.paintedH) / win.paintedH > 0.08)) paint(win);
  };
  const paint = (win: Win): void => {
    win.paintedH = win.H;
    win.gen++;
    win.art = win.scene.pieces.map(() => null);
    const w = listen(win.scene.entry);
    win.scene.pieces.forEach((pc, i) => {
      const id = nextId++;
      pending.set(id, [win, i, win.gen]);
      const job: CloudJob = { id, kind: pc.kind, p: pc.p, seed: pc.seed ?? 7 + i, fitH: Math.max(4, Math.round(pc.fit * win.H)) };
      w.postMessage(job);
    });
    if (win.scene.walker) {
      const wk = win.scene.walker;
      const H = win.H, sky = ramp(win.scene.sky, 5)[3]!;
      void loadWalker().then((img) => {
        if (!img || H !== win.paintedH) return;
        // its own frame, made smaller on whole pixels and sunk into the sky's haze
        const h = Math.max(8, Math.round(wk.fit * H));
        const w0 = Math.round((img.width * h) / img.height);
        const c = document.createElement("canvas");
        c.width = w0;
        c.height = h;
        const g = c.getContext("2d")!;
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, w0, h);
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = `rgba(${sky[0]},${sky[1]},${sky[2]},${wk.haze})`;
        g.fillRect(0, 0, w0, h);
        win.walker = c;
        win.dirty = true;
        kick();
      });
    }
  };
  const layoutAll = (): void => {
    const ms = wins.map(measure);
    wins.forEach((win, i) => { const m = ms[i]; if (m) apply(win, m); });
  };

  // --- the sky behind, the lake, the mist and the edge: drawn once per size. The sky has a margin above and below
  // (BACK_M art px) so a look may slide it a little without showing its end.
  const BACK_M = 12;
  const backdrop = (win: Win): HTMLCanvasElement => {
    if (win.back) return win.back;
    const { W, H, scene } = win;
    const HH = H + BACK_M * 2;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = HH;
    const g = c.getContext("2d")!;
    const img = g.createImageData(W, HH);
    const sky = ramp(scene.sky, 18);
    const lakeTop = scene.water ? Math.round(scene.water.y * H) : H;
    const lake = scene.water ? ramp(scene.water.tones, 8) : [];
    for (let yy = 0; yy < HH; yy++) {
      const y = Math.max(0, Math.min(H - 1, yy - BACK_M));
      for (let x = 0; x < W; x++) {
        const col = y < lakeTop ? sky[rampIndex(x, y, lakeTop, sky.length)]! : lake[rampIndex(x, y - lakeTop, H - lakeTop, lake.length)]!;
        const i = (yy * W + x) * 4;
        img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    win.back = c;
    return c;
  };
  const edge = (win: Win): HTMLCanvasElement => {
    if (win.edge) return win.edge;
    const { W, H } = win;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.getContext("2d")!.putImageData(new ImageData(holeMask(W, H, win.index + 1) as Uint8ClampedArray<ArrayBuffer>, W, H), 0, 0);
    win.edge = c;
    return c;
  };
  // the mist: a band of white a little wider than the window, slid sideways (drawn once, never per pixel); its
  // density rises and falls through the band on an ordered (Bayer) dither in soft clumps: pixel-art fog, not static
  const MIST_SLIDE = 64;
  const mistBand = (win: Win): HTMLCanvasElement | null => {
    const m = win.scene.mist;
    if (!m) return null;
    if (win.mist) return win.mist;
    const { W, H } = win;
    const y0 = Math.round(m.y * H), y1 = Math.round((m.y + m.h) * H);
    const c = document.createElement("canvas");
    c.width = W + MIST_SLIDE;
    c.height = Math.max(1, y1 - y0);
    const g = c.getContext("2d")!;
    const img = g.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const dens = Math.sin(((y + 0.5) / c.height) * Math.PI) * (m.dens ?? 0.75);
      for (let x = 0; x < c.width; x++) {
        const xx = x % (W + MIST_SLIDE);
        // soft clumps: a smooth wave along the band, so the fog thickens and thins in drifts
        const clump = 0.6 + 0.4 * Math.sin(xx * 0.045 + Math.sin((y + y0) * 0.21) * 1.7);
        if ((BAYER4[(y & 3) * 4 + (xx & 3)]! + 0.5) / 16 < dens * clump) {
          const i = (y * c.width + x) * 4;
          img.data[i] = 250; img.data[i + 1] = 250; img.data[i + 2] = 250; img.data[i + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
    win.mist = c;
    return c;
  };

  const animated = !reduced.matches;
  // A frame is planned first (every position in whole art px) and painted only if something moved since the last
  // one: most frames of slow drifts and of a scroll move nothing by a whole pixel, and are skipped.
  const draw = (win: Win, t: number, now: number): void => {
    const { ctx, W, H, scene, st } = win;
    if (!W || !H) return;
    const tt = animated ? t : 0;
    const bo = animated && motion.backOffset ? motion.backOffset(st, now) : null;
    const plan: number[] = [bo ? bo[0] : 0, bo ? bo[1] : 0, scene.water ? Math.floor(tt * 3) : 0];
    const at: ([number, number] | null)[] = [];
    let mist: [number, number] | null = null;
    let walker: [number, number] | null = null;
    scene.pieces.forEach((pc, i) => {
      const off = animated && motion.offset ? motion.offset(st, pc, i, now) : null;
      if (scene.mist && i === scene.mist.before) {
        mist = [-Math.floor(tt * 2) % MIST_SLIDE, Math.round(scene.mist.y * H) + (off ? off[1] : 0)];
        plan.push(mist[0], mist[1]);
      }
      if (scene.walker && i === scene.walker.before && win.walker) {
        const wk = scene.walker;
        const wo = animated && motion.offset ? motion.offset(st, { kind: "walker", p: {}, fit: wk.fit, x: wk.x, y: wk.y, haze: wk.haze }, -1, now) : null;
        walker = [
          Math.round(wk.x * W - win.walker.width / 2 + (animated ? Math.sin(tt * 0.02) * 3 : 0)) + (wo ? wo[0] : 0),
          Math.round(wk.y * H - win.walker.height) + (wo ? wo[1] : 0),
        ];
        plan.push(walker[0], walker[1]);
      }
      const art = win.art[i];
      if (!art) { at.push(null); plan.push(-1e9); return; }
      let x = pc.x * W + (pc.sway ? Math.sin(tt * (pc.speed ?? 0.05) * 6.28 + i) * pc.sway : 0);
      const y = pc.y * H + (pc.bob ? Math.round(Math.sin(tt * (pc.speed ?? 0.5) * 6.28 + i * 1.7) * pc.bob) : 0);
      if (pc.cross) {
        const span = W + art.img.width;
        x = ((((pc.x * W + tt * pc.cross) % span) + span) % span) - art.img.width / 2;
      }
      const p: [number, number] = [Math.round(x) - art.ax + (off ? off[0] : 0), Math.round(y) - art.ay + (off ? off[1] : 0)];
      at.push(p);
      plan.push(p[0], p[1]);
    });
    // a look's paper over the window while it arrives: a look that can say what it would draw (coverKey) is skipped
    // when that has not changed either
    const covering = animated && !!motion.cover && win.covering;
    if (covering) plan.push(motion.coverKey ? motion.coverKey(st, now) : now);
    if (!win.dirty && win.plan && win.plan.length === plan.length && win.plan.every((v, i) => v === plan[i])) return;
    win.dirty = false;
    win.plan = plan;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(backdrop(win), bo ? bo[0] : 0, -BACK_M + (bo ? bo[1] : 0));
    scene.pieces.forEach((pc, i) => {
      if (mist && scene.mist && i === scene.mist.before) {
        const band = mistBand(win);
        if (band) ctx.drawImage(band, mist[0], mist[1]);
      }
      if (walker && scene.walker && i === scene.walker.before && win.walker) ctx.drawImage(win.walker, walker[0], walker[1]);
      const art = win.art[i], p = at[i];
      if (!art || !p) return;
      if (pc.haze) {
        ctx.save();
        ctx.globalAlpha = 1 - pc.haze * 0.5;
      }
      ctx.drawImage(art.img, p[0], p[1]);
      if (pc.haze) ctx.restore();
    });
    if (scene.water) ripples(win, tt, bo ? bo[1] : 0);
    ctx.drawImage(edge(win), 0, 0);
    if (covering) {
      if (!win.over) {
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        win.over = { img: new ImageData(W, H), cv: c };
      }
      const o = win.over;
      o.img.data.fill(0);
      win.covering = motion.cover!(st, () => (win.field ??= tearField(W, H, win.index + 1)), o.img.data, now);
      o.cv.getContext("2d")!.putImageData(o.img, 0, 0);
      ctx.drawImage(o.cv, 0, 0);
      if (!win.covering) { win.field = null; win.over = null; win.plan = null; }
    }
  };

  const ripples = (win: Win, t: number, dy: number): void => {
    const { ctx, W, H, scene } = win;
    const top = Math.round(scene.water!.y * H) + dy;
    const frame = Math.floor(t * 3);
    for (let y = top + 2; y < H; y += 2) {
      const n = Math.round((W / 40) * (0.5 + (y - top) / (H - top)));
      for (let i = 0; i < n; i++) {
        const h1 = hash(i * 7 + frame, y - dy), h2 = hash(i * 13, (y - dy) * 3 + frame);
        ctx.fillStyle = h2 < 0.5 ? "#dbf2eb" : "#3f918c";
        ctx.fillRect(Math.floor(h1 * W), y, 2 + Math.floor(h2 * 5), 1);
      }
    }
  };

  els.forEach((el, index) => {
    const scene = SCENES[el.dataset.window as SceneId] ?? SCENES.sky;
    const cv = document.createElement("canvas");
    el.prepend(cv);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const band = el.parentElement ?? el;
    const st: WinState = { W: 0, H: 0, index, top: 0, bottom: 0, bandTop: 0, bandBottom: 0, vh: innerHeight, arrived: -1 };
    wins.push({
      el, band, index, cv, ctx, base: scene, scene, W: 0, H: 0, k: 0, paintedH: 0, back: null, edge: null, mist: null,
      field: null, over: null, covering: !!motion.cover && animated, plan: null, art: [], walker: null, visible: false, seen: false,
      gen: 0, dirty: true, st,
    });
  });

  // --- the loop. Life: a frame every 1/fps s while a window is on screen (a timer, not a frame callback every frame);
  // while the page scrolls (a look that moves with it) or a window is arriving: every frame; nothing when no window is
  // on screen.
  const t0 = performance.now();
  let timer = 0;
  let raf = 0;
  let scrollUntil = 0;
  const readBoxes = (live: Win[]): void => {
    const vh = window.innerHeight;
    for (const win of live) {
      const r = win.el.getBoundingClientRect(), b = win.band.getBoundingClientRect();
      const s = win.st;
      s.top = r.top; s.bottom = r.bottom; s.bandTop = b.top; s.bandBottom = b.bottom; s.vh = vh;
      if (s.arrived < 0 && r.height > 0 && (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / r.height >= ARRIVE) s.arrived = performance.now();
    }
  };
  const drawLive = (): Win[] => {
    const live = wins.filter((w) => w.visible);
    if (!live.length) return live;
    const now = performance.now();
    const t = (now - t0) / 1000;
    readBoxes(live);
    for (const win of live) {
      if (!animated && !win.dirty) continue;
      draw(win, t, now);
    }
    return live;
  };
  const busy = (live: Win[]): boolean => animated && (performance.now() < scrollUntil || live.some((w) => w.covering && w.seen));
  const frame = (): void => {
    raf = 0;
    const live = drawLive();
    if (!live.length) return;
    if (busy(live)) raf = requestAnimationFrame(frame);
    else life();
  };
  const life = (): void => {
    if (timer || raf) return;
    if (!animated) return;
    timer = window.setTimeout(() => {
      timer = 0;
      const live = drawLive();
      if (!live.length) return;
      if (busy(live)) raf = requestAnimationFrame(frame);
      else life();
    }, 1000 / motion.fps);
  };
  const kick = (): void => {
    if (raf) return;
    clearTimeout(timer);
    timer = 0;
    raf = requestAnimationFrame(frame);
  };
  if (animated && (motion.scrollLinked || motion.cover)) {
    window.addEventListener("scroll", () => {
      if (!motion.scrollLinked && !wins.some((w) => w.visible && w.covering)) return;
      scrollUntil = performance.now() + 120;
      if (!raf) kick();
    }, { passive: true });
  }

  // a window paints the first time it comes near (half a screen ahead), and animates only while on screen
  const near = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        const win = wins.find((x) => x.el === e.target);
        if (!win || !e.isIntersecting || win.seen) continue;
        win.seen = true;
        const m = measure(win);
        if (m) apply(win, m);
      }
    }, { rootMargin: "50% 0px" })
    : null;
  const onScreen = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        const win = wins.find((x) => x.el === e.target);
        if (!win) continue;
        win.visible = e.isIntersecting;
        if (win.visible) { win.dirty = true; kick(); }
      }
    })
    : null;
  for (const win of wins) {
    if (near && onScreen) { near.observe(win.el); onScreen.observe(win.el); }
    else { win.seen = win.visible = true; win.covering = false; }
  }
  if (!near) { layoutAll(); kick(); }

  let resizeT = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = window.setTimeout(() => { layoutAll(); kick(); }, 150);
  });
}
