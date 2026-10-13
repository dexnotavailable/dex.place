// Kagami's near shore (P5, the near-front plane): the closest things to the camera, dark
// silhouettes that frame the bottom of every lake view the way reference 4's grassy rise and
// its foliage frame its near corners. Never a band: separate masses, each well under a quarter
// of the frame wide, with low wet ground between them where the lake comes right up to the
// camera:
// - a reed and cattail clump (its tall reeds are op.reeds sprites: a gust runs through them);
// - a half-sunk mossy boulder, ferns at its foot;
// - a grassy hummock with a dead branch fallen across it;
// - an old stone lantern leaning in tall grass;
// - a limestone crag, where the shore ends: its outer face drops off the bottom of the frame;
// - a small grass tuft.
// Every mass runs down off the bottom of the frame (its body goes on under the waterline into
// the dark ground, darker and quieter with depth): no underside, no floating slab, ever. The
// ground between the masses sits just above the waterline: wet mud, pebbles in clusters, low
// grass, lily pads lying on the water beyond it.
//
// Tops are shaped by noise at three scales (the mass's envelope, lumps, grit); rock tops are
// facets (rock breaks, it does not melt). Light from the upper left: a thin lit rim on the upper
// left of each mass only. Two or three tones per mass (the plane shader darkens P5 toward ink).
// One density at every level: at the close band (level 2) every feature is drawn in whole
// level-1 px (2 x 2 art px), never as lone 1 px strokes.
//
// Anchor: the waterline at the shore's left end. Sizes in level-1 px of the near plane.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm1, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { cached, clump } from "./kit.ts";

export type MassKind = "reeds" | "boulder" | "hummock" | "lantern" | "crag" | "tuft";

export interface MassSpec {
  kind: MassKind;
  /** Left end along the shore and width, px. */
  x: number;
  w: number;
  /** Height of the mass's body above the waterline, px (a lantern: the lantern's height). */
  h: number;
  /** A crag at an end of the shore: its outer face drops off the bottom (-1 left, 1 right). */
  drop?: -1 | 1;
  /** Reed stands: height of the tallest reeds (the op.reeds sprites), px (default 2.2 x h + 40). */
  reed?: number;
  /** Reed stands: reeds per 10 px (default 3). */
  dense?: number;
  /** A lantern's tilt, radians (positive leans right; default a few degrees). */
  lean?: number;
}

export interface BankP {
  /** Length along the shore and depth of the ground below the waterline, px. */
  w: number;
  h: number;
  /** Generated shores (no `masses`): the ends finish in a crag whose face drops off the bottom. */
  endR?: number;
  startR?: number;
  /** Generated shores: share of masses that are reed stands, 0..1 (default 0.45). */
  reeds?: number;
  /** Authored masses (the frames' composition), in paint order. */
  masses?: MassSpec[];
}

interface Mass extends MassSpec {
  seed: number;
  /** Facet vertices of a rock's top [x, height, ...] (boulder, crag). */
  v: number[];
  /** A crag's limestone columns [x0, x1, height, ...]. */
  cols: number[];
}

// ---------------------------------------------------------------------------
// layout

/** A shore composed from a seed (the generated path; Kagami authors its masses). */
function generate(p: BankP, seed: number): MassSpec[] {
  const r = rng(seed + 11);
  const reeds = p.reeds ?? 0.45;
  const out: MassSpec[] = [];
  const x0 = p.startR ? 260 : 20, x1 = p.endR ? p.w - 280 : p.w - 20;
  if (p.startR) out.push({ kind: "crag", x: -40, w: 320, h: 70 + r() * 50, drop: -1 });
  let x = x0 + r() * 40;
  while (x < x1 - 60) {
    const k = r();
    const kind: MassKind = k < reeds ? "reeds" : k < reeds + 0.2 ? "hummock" : k < reeds + 0.36 ? "boulder" : k < reeds + 0.46 ? "lantern" : "tuft";
    const w = Math.min(x1 - x, kind === "tuft" ? 60 + r() * 70 : kind === "lantern" ? 150 + r() * 80 : 150 + r() * 260);
    if (w < 40) break;
    const h = kind === "reeds" ? 22 + r() * 30 : kind === "boulder" ? 50 + r() * 60 : kind === "hummock" ? 40 + r() * 60 : kind === "lantern" ? 90 + r() * 40 : 14 + r() * 18;
    out.push({ kind, x, w, h });
    // rhythm without repetition: two or three close, then a wide gap
    x += w + (r() < 0.4 ? -w * 0.12 : 40 + r() * r() * 360);
  }
  if (p.endR) out.push({ kind: "crag", x: p.w - 300, w: 340, h: 80 + r() * 60, drop: 1 });
  return out;
}

/** A rock's envelope across its width, 0..1: an end crag stays high toward its outer face. */
function rockEnv(s: MassSpec, u: number, peak: number, crag: boolean): number {
  let prof = u < peak ? Math.pow(Math.sin((Math.PI / 2) * (u / peak)), crag ? 0.45 : 0.6) : Math.pow(Math.cos((Math.PI / 2) * ((u - peak) / (1 - peak))), crag ? 0.5 : 0.8);
  if (s.drop === 1 && u > peak) prof = 1 - 0.45 * Math.pow((u - peak) / (1 - peak), 1.5);
  if (s.drop === -1 && u < peak) prof = 1 - 0.45 * Math.pow((peak - u) / peak, 1.5);
  return prof;
}

/**
 * A crag's limestone: columns of mixed widths standing side by side, each with a rounded head
 * (reference s2b's cliff), their heights following the crag's envelope with a step here and
 * there; the top is the skyline of their heads.
 */
function cragCols(s: MassSpec, seed: number): { cols: number[]; v: number[] } {
  const r = rng(seed + 7);
  const peak = s.drop === 1 ? 0.55 + 0.2 * r() : s.drop === -1 ? 0.25 + 0.2 * r() : 0.3 + 0.35 * r();
  const cols: number[] = [];
  for (let x = s.x; x < s.x + s.w - 6;) {
    // two or three narrow columns, then a broad one
    const cw = Math.min(s.x + s.w - x, r() < 0.3 ? 22 + r() * 26 : 60 + r() * 110);
    const u = clamp((x + cw / 2 - s.x) / s.w, 0, 1);
    // most heads follow the envelope closely (columns fused into one mass); the odd one stands
    // proud or has broken away lower
    const kk = r();
    let hh = s.h * rockEnv(s, u, peak, true) * (kk < 0.2 ? 0.55 + 0.25 * r() : kk > 0.85 ? 1.05 + 0.1 * r() : 0.88 + 0.12 * r());
    if ((u < 0.08 && s.drop !== -1) || (u > 0.92 && s.drop !== 1)) hh = Math.min(hh, 10 + r() * 8);
    cols.push(x, x + cw, hh);
    x += cw;
  }
  // the top: broken ledges and risers, not the columns' heads (those only shade the face)
  const v: number[] = [];
  if (s.drop !== -1) v.push(s.x - 8, -6);
  let x = s.x, hPrev = s.drop === -1 ? s.h * rockEnv(s, 0, peak, true) : 4;
  v.push(x, hPrev);
  while (x < s.x + s.w - 4) {
    const seg = Math.min(s.x + s.w - x, 26 + r() * 70);
    const u = clamp((x + seg - s.x) / s.w, 0, 1);
    let hh = s.h * rockEnv(s, u, peak, true) * (0.78 + 0.3 * r());
    if ((u > 0.95 && s.drop !== 1)) hh = 4;
    // a ledge (level-ish, a slight tilt), then a riser up or down to the next one
    const tilt = (r() - 0.5) * 0.25 * seg;
    v.push(x + seg * (0.75 + 0.15 * r()), hPrev + tilt);
    v.push(x + seg, hh);
    hPrev = hh;
    x += seg;
  }
  if (s.drop !== 1) v.push(s.x + s.w + 8, -6);
  for (let i = 2; i < v.length; i += 2) if (v[i]! <= v[i - 2]!) v[i] = v[i - 2]! + 0.5;
  return { cols, v };
}

function rockVerts(s: MassSpec, seed: number): number[] {
  const r = rng(seed + 5);
  const habit = Math.floor(r() * 3);
  const flip = r() < 0.5;
  // [u, height share] key points, left to right, before the flip
  const keys: [number, number][] = habit === 0
    ? [[0, -0.05], [0.07, 0.55], [0.2, 0.92], [0.34, 1], [0.55, 0.86], [0.78, 0.6], [0.93, 0.32], [1, -0.05]]
    : habit === 1
      ? [[0, -0.05], [0.05, 0.6], [0.14, 0.9], [0.32, 0.98], [0.47, 0.84], [0.58, 0.95], [0.82, 0.9], [0.94, 0.55], [1, -0.05]]
      : [[0, -0.05], [0.1, 0.3], [0.32, 0.62], [0.58, 0.88], [0.76, 1], [0.86, 0.9], [0.95, 0.5], [1, -0.05]];
  const out: number[] = [];
  const pts = keys.map(([u, k], i) => {
    const uu = i === 0 || i === keys.length - 1 ? u : u + (r() - 0.5) * 0.06;
    const kk = k <= 0 ? k : k * (0.9 + 0.14 * r());
    return [flip ? 1 - uu : uu, kk] as [number, number];
  });
  if (flip) pts.reverse();
  for (const [u, k] of pts) out.push(s.x + u * s.w, k <= 0 ? -5 : s.h * k);
  return out;
}

function layoutOf(p: BankP, seed: number): Mass[] {
  return cached(`bank2|${seed}|${p.w}|${p.h}|${p.reeds}|${p.startR}|${p.endR}|${p.masses ? JSON.stringify(p.masses) : ""}`, () => {
    const specs = p.masses ?? generate(p, seed);
    return specs.map((s, i) => {
      const ms = seed + 1000 + i * 37;
      if (s.kind === "crag") return { ...s, seed: ms, ...cragCols(s, ms) };
      return { ...s, seed: ms, v: s.kind === "boulder" ? rockVerts(s, ms) : [], cols: [] };
    });
  });
}

/** Where the ground strip runs: inside the outer faces of the end crags. */
function groundSpan(p: BankP, L: Mass[]): [number, number] {
  let a = 0, b = p.w;
  for (const m of L) {
    if (m.drop === -1) a = Math.max(a, m.x + m.w * 0.3);
    if (m.drop === 1) b = Math.min(b, m.x + m.w * 0.7);
  }
  return [a, b];
}

/** Horizontal reach of a mass's body, local px (an end crag's face may lean out past its top). */
function massSpan(m: Mass): [number, number] {
  if (m.v.length) return [m.v[0]! - (m.drop === -1 ? 40 : 0), m.v[m.v.length - 2]! + (m.drop === 1 ? 40 : 0)];
  return [m.x, m.x + m.w];
}

/**
 * An end crag's outer face at depth ly (local y): the x past which the crag is open air. It
 * wanders with ledges and bulges as it goes down, never a ruled edge.
 */
function faceX(m: Mass, ly: number): number {
  const s = m.seed;
  const end = m.drop === 1 ? m.v[m.v.length - 2]! : m.v[0]!;
  const top = -(m.drop === 1 ? m.v[m.v.length - 1]! : m.v[1]!);
  const k = Math.max(0, ly - top);
  // rounding over at the top, then a face that bulges and steps back with ledges
  const round = -Math.max(0, 10 - k) * 0.9;
  const wander = (fbm1(ly / 55, s + 91, 3) - 0.5) * 26 + (vnoise1(ly / 11, s + 92) - 0.5) * 6 + (vnoise1(ly / 3, s + 93) - 0.5) * 1.6;
  const ledge = Math.floor(k / 37 + hash1(1, s)) % 3 === 0 ? -4 : 0;
  return end + m.drop! * (round + wander + ledge + k * 0.06);
}

// ---------------------------------------------------------------------------
// shapes (heights above the waterline, px, positive up)

/** The ground between the masses: just above the waterline, never level for long. */
function groundTop(lx: number, seed: number): number {
  // (low hummocks every hundred px or so: never level for long)
  const swell = fbm1(lx / 150, seed + 31, 3);
  const hum = vnoise1(lx / 47, seed + 34);
  return 3 + 22 * swell * swell + 14 * hum * hum * hum + 5 * vnoise1(lx / 19, seed + 35) + 2.6 * (vnoise1(lx / 7, seed + 32) - 0.5) + 0.9 * (vnoise1(lx / 3.1, seed + 33) - 0.5);
}

function lerpVerts(v: number[], lx: number): number {
  const n = v.length / 2;
  if (lx <= v[0]!) return v[1]!;
  if (lx >= v[n * 2 - 2]!) return v[n * 2 - 1]!;
  for (let i = 1; i < n; i++) {
    const x1 = v[i * 2]!;
    if (lx <= x1) {
      const x0 = v[i * 2 - 2]!, y0 = v[i * 2 - 1]!, y1 = v[i * 2 + 1]!;
      return y0 + ((lx - x0) / Math.max(1e-6, x1 - x0)) * (y1 - y0);
    }
  }
  return v[n * 2 - 1]!;
}

/** The mound's envelope 0..1 across a soft mass (lopsided, from its seed). */
function moundEnv(m: Mass, u: number): number {
  if (u <= 0 || u >= 1) return 0;
  const sk = 0.7 + 0.7 * hash1(3, m.seed);
  return Math.pow(Math.sin(Math.PI * Math.pow(u, sk)), 0.62);
}

/** Height of a mass's body top at lx, or -Infinity outside it. */
function massTop(m: Mass, lx: number): number {
  const [a, b] = massSpan(m);
  if (lx < a || lx > b) return -Infinity;
  const s = m.seed;
  if (m.v.length) {
    // facets, then lumps and grit (past an end crag's last vertex its top runs on to the face)
    return lerpVerts(m.v, lx) + (vnoise1(lx / 7, s + 1) - 0.5) * 2.6 + (vnoise1(lx / 2.2, s + 2) - 0.5) * 1.1;
  }
  const u = (lx - m.x) / m.w;
  const env = moundEnv(m, u);
  if (env <= 0) return -Infinity;
  const body = m.kind === "lantern" ? Math.min(22, m.h * 0.16) : m.kind === "reeds" ? m.h * 0.45 : m.h;
  const lump = m.kind === "hummock" ? (vnoise1(lx / 16, s + 6) - 0.5) * 0.22 * body : 0;
  return body * env * (0.72 + 0.56 * fbm1(lx / 46, s + 3, 2)) + lump * env + (vnoise1(lx / 7, s + 4) - 0.5) * 4 * env + (vnoise1(lx / 2.6, s + 5) - 0.5) * 1.4 - 3 * (1 - env);
}

/** How far a mass's base spreads under the waterline, px (its foot flares, then goes down steeply). */
function spreadOf(m: Mass): number {
  return m.kind === "crag" ? 70 : m.kind === "boulder" ? 55 : m.kind === "reeds" || m.kind === "tuft" ? 30 : 75;
}

/**
 * Is (lx, ly) in a mass's base past its ends? Under the waterline the base flares out like the
 * foot of a mound and then goes on down steeply, off the bottom of the frame, its edge wandering
 * (roots, stones, slumped earth); neighbouring bases meet below with a dark notch of ground
 * between them: never a floating lump, never a slab, never a straight slope.
 */
function inBase(m: Mass, lx: number, ly: number): boolean {
  const [a, b] = massSpan(m);
  if ((lx > b && m.drop === 1) || (lx < a && m.drop === -1)) return false;
  const side = lx < a ? -1 : 1;
  const e = side < 0 ? a : b;
  const te = -Math.min(0, massTop(m, side < 0 ? a + 0.5 : b - 0.5));
  const t = ly - te;
  if (t <= 0) return false;
  const k = m.seed + (side < 0 ? 0 : 50);
  const sp = spreadOf(m);
  const W = sp * (1 - Math.exp(-t / 45)) * (0.7 + 0.6 * fbm1(t / 60, k + 16, 2)) + t * 0.18 + (vnoise1(t / 9, k + 17) - 0.5) * 9 + (vnoise1(t / 3.2, k + 18) - 0.5) * 2.5;
  return Math.abs(lx - e) < W;
}

/** The farthest a base reaches past its mass's ends, px. */
const baseReach = (m: Mass, depth: number): number => spreadOf(m) * 1.4 + depth * 0.18 + 12;

/** The whole shore's top (ground and masses), px above the waterline. */
function topOf(p: BankP, L: Mass[], lx: number, seed: number): number {
  const [ga, gb] = groundSpan(p, L);
  let t = lx >= ga && lx <= gb ? groundTop(lx, seed) : -Infinity;
  for (const m of L) t = Math.max(t, massTop(m, lx));
  return t;
}

// ---------------------------------------------------------------------------
// drawing in whole level-1 px (one density at every level)

/**
 * Local level-1 x of art column x. Above level 1 every art px belongs to a whole level-1 cell
 * (cell k covers art px whose centre lies in [k d, (k + 1) d)) and samples at the cell's centre,
 * so the close band shows the plane at one density.
 */
export function LX(c: PaintCtx, x: number): number {
  return c.d > 1 ? c.lx((Math.floor((x + 0.5) / c.d) + 0.5) * c.d) : c.lx(x + 0.5);
}
export function LY(c: PaintCtx, y: number): number {
  return c.d > 1 ? c.ly((Math.floor((y + 0.5) / c.d) + 0.5) * c.d) : c.ly(y + 0.5);
}

/** One level-1 px at local (lx, ly): the whole cell's art px above level 1, one art px below it. */
export function dot(c: PaintCtx, lx: number, ly: number, col: number): void {
  const d = c.d;
  if (d > 1) {
    const kx = Math.floor(c.X(lx) / d), ky = Math.floor(c.Y(ly) / d);
    const x0 = Math.ceil(kx * d - 0.5), x1 = Math.ceil((kx + 1) * d - 0.5), y0 = Math.ceil(ky * d - 0.5), y1 = Math.ceil((ky + 1) * d - 0.5);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.buf.set(x, y, col);
  } else c.buf.set(Math.floor(c.X(lx)), Math.floor(c.Y(ly)), col);
}

/** A stroke of `width` level-1 px along a path of points (local). */
export function stroke(c: PaintCtx, pts: [number, number][], width: (u: number) => number, col: (u: number, side: number) => number): void {
  const step = Math.min(0.5, 0.5 / Math.max(c.d, 0.5));
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!;
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(len / step));
    const nx = -(by - ay) / Math.max(1e-6, len), ny = (bx - ax) / Math.max(1e-6, len);
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = (k + t) / (pts.length - 1);
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const w = width(u);
      if (w <= 1.05) { dot(c, x, y, col(u, 0)); continue; }
      for (let o = -w / 2 + 0.5; o <= w / 2 - 0.49; o += 0.5) dot(c, x + nx * o, y + ny * o, col(u, o / (w / 2)));
    }
  }
}

/** The path of a blade of grass or a leaf: rises at `a0` (radians from upright), bending as it goes. */
export function bladePath(x: number, y: number, len: number, a0: number, bend: number): [number, number][] {
  const pts: [number, number][] = [[x, y]];
  const n = Math.max(3, Math.ceil(len / 3));
  let px = x, py = y;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const a = a0 + bend * u * u;
    px += Math.sin(a) * (len / n);
    py -= Math.cos(a) * (len / n);
    pts.push([px, py]);
  }
  return pts;
}

/** Grass: a blade from its root, dark at the foot, lit at its tip when it faces the sun. */
export function grass(c: PaintCtx, x: number, y: number, len: number, a0: number, bend: number, lit: number, wide = false): void {
  const pts = bladePath(x, y, len, a0, bend);
  const facing = a0 + bend * 0.5 < 0.15;
  stroke(c, pts, (u) => (wide && u < 0.45 ? 2 : 1), (u) => {
    if (u > 0.72 && lit > 0.66 && facing) return P.moss[3]!;
    if (u > 0.55 && lit > 0.4) return P.moss[4]!;
    if (u > 0.3) return P.moss[5]!;
    return u > 0.12 ? P.moss[6]! : P.pine[3]!;
  });
}

/** A fern frond: an arching stem, leaflets on both sides shortening toward the tip. */
export function fern(c: PaintCtx, x: number, y: number, len: number, a0: number, seed: number): void {
  const bend = (a0 > 0 ? 1 : -1) * (1.1 + 0.6 * hash1(1, seed));
  const pts = bladePath(x, y, len, a0, bend);
  stroke(c, pts, () => 1, (u) => (u < 0.4 ? P.pine[3]! : P.moss[6]!));
  const n = pts.length;
  for (let i = 1; i < n - 1; i++) {
    const u = i / (n - 1);
    const [px, py] = pts[i]!, [qx, qy] = pts[i + 1]!;
    const dx = qx - px, dy = qy - py, dl = Math.max(1e-6, Math.hypot(dx, dy));
    const tx = dx / dl, ty = dy / dl;
    const ll = len * 0.22 * Math.sin(Math.PI * clamp(0.12 + u * 0.95, 0, 1)) * (1 - 0.35 * u);
    if (ll < 1.2) continue;
    for (const side of [-1, 1]) {
      // a leaflet: out from the stem, swept toward the tip, drooping a little
      const ox = -ty * side, oy = tx * side;
      const ex = px + (ox * 0.8 + tx * 0.55) * ll, ey = py + (oy * 0.8 + ty * 0.55) * ll + ll * 0.25;
      const up = oy < 0;
      stroke(c, [[px, py], [(px + ex) / 2, (py + ey) / 2 - ll * 0.08], [ex, ey]], () => 1, (v) => (up && v > 0.4 && hash1(i * 2 + side, seed) < 0.55 ? P.moss[4]! : v > 0.5 ? P.moss[5]! : P.moss[6]!));
    }
  }
}

// ---------------------------------------------------------------------------
// fills

/** The ground under the lip and every mass's foot: dark, quieter with depth, big soft shapes. */
export function deepCol(lx: number, ly: number, x: number, y: number, seed: number): number {
  const blob = vnoise(lx / 44, ly / 30, seed + 9) * 0.65 + vnoise(lx / 16, ly / 12, seed + 10) * 0.35;
  const t = clamp(0.6 + clamp(ly / 60, 0, 1) * 0.4 + (blob - 0.5) * 0.3, 0, 1);
  return tone(P.pine, 0.55 + t * 0.45, x, y, 0.2);
}

/** A mass's base under the waterline, past its ends: a step lighter than the ground's notch. */
function baseCol(m: Mass, lx: number, ly: number, x: number, y: number): number {
  // (deeper down every base melts into the same dark ground: no row of bells along the bottom)
  if (ly > 40 + 34 * vnoise1(lx / 13, m.seed + 20)) return deepCol(lx, ly, x, y, m.seed);
  const k = clamp(ly / 100, 0, 0.9);
  if (m.v.length) return bayer4(x, y) < k ? P.karst[8]! : hash(Math.floor(lx / 3), Math.floor(ly / 9), m.seed + 19) < 0.2 ? P.pine[4]! : m.kind === "crag" ? P.karst[8]! : P.karst[7]!;
  if (bayer4(x, y) < k) return P.pine[4]!;
  return hash(Math.floor(lx / 1.5), Math.floor(ly / 7), m.seed + 12) < 0.3 ? P.moss[7]! : P.pine[3]!;
}

/** A soft mass's body (earth under grass): a lit grass rim, grass stems, then the dark foot. */
function softCol(m: Mass, lx: number, ly: number, s: number, lit: number, x: number, y: number): number {
  // under the waterline: stems, roots and wet earth going on down, darker with depth
  if (ly > 0 && s > 9) {
    if (ly > 44 + 36 * vnoise1(lx / 15, m.seed + 21)) return deepCol(lx, ly, x, y, m.seed);
    const k = clamp(ly / 90, 0, 1);
    if (bayer4(x, y) < k * 0.9) return P.pine[4]!;
    return hash(Math.floor(lx / 1.5), Math.floor(ly / 7), m.seed + 12) < 0.32 - k * 0.25 ? P.moss[6]! : P.moss[7]!;
  }
  if (s < 1.2) return lit > 0.7 ? P.moss[3]! : lit > 0.45 ? P.moss[4]! : P.moss[5]!;
  // grass stems in the top layer: dark, a lighter strand here and there on the sunward side
  if (s < 4 + 5 * vnoise1(lx / 6, m.seed + 8)) return hash(Math.floor(lx), Math.floor(ly / 4), m.seed + 9) < 0.08 + 0.3 * lit ? P.moss[5]! : P.moss[6]!;
  if (s < 9 + 6 * vnoise1(lx / 11, m.seed + 10)) return hash(Math.floor(lx), Math.floor(ly / 5), m.seed + 11) < 0.25 ? P.moss[6]! : P.moss[7]!;
  return deepCol(lx, ly, x, y, m.seed);
}

/**
 * A rock's body, two or three tones: the planes facing up lit (a rim on the upper left), the
 * sunward side face mid, the far side in shade, cracks; a crag is limestone columns, each lit on
 * its left and rounding into shade on its right, dark fissures between them that open and
 * close. Moss on whatever faces up. Wet and dark at the waterline; under it the rock goes on
 * down, darker and darker, into the ground (an end crag's face goes on off the bottom).
 */
function rockCol(m: Mass, lx: number, ly: number, top: number, s: number, slope: number, x: number, y: number, fd = Infinity): number {
  const seed = m.seed;
  const crag = m.kind === "crag";
  const [a, b] = massSpan(m);
  const u = clamp((lx - a) / Math.max(1, b - a), 0, 1);
  // (deep in the bank's shadow every rock melts into the same dark ground, but an end crag's
  // outer face goes on off the bottom)
  if (!(m.drop && (m.drop === 1 ? lx > (m.x + m.w * 0.5) : lx < m.x + m.w * 0.5)) && ly > (crag ? 80 : 52) + 30 * vnoise1(lx / 14, seed + 50)) return deepCol(lx, ly, x, y, seed);
  const lit = (0.62 * slope + 0.78) / Math.sqrt(1 + slope * slope);
  // moss and grass where the rock faces up, thicker on flat tops, hanging in drips
  const flat = clamp((lit - 0.5) / 0.45, 0, 1);
  const dv = vnoise1(lx / 4.5, seed + 21);
  const drip = dv > 0.72 ? (dv - 0.72) * (crag ? 46 : 34) * flat : 0;
  const mossD = (crag ? 2.5 : 1.5) + (crag ? 6 : 5) * flat * vnoise1(lx / 9, seed + 22) + drip;
  if (s < mossD && ly < 0) {
    if (s < 1.2) return lit > 0.82 ? P.moss[3]! : lit > 0.6 ? P.moss[4]! : P.moss[5]!;
    return s / mossD < 0.5 && lit > 0.7 ? P.moss[5]! : P.moss[6]!;
  }
  // which face: 0 rim, 1 lit, 2 body, 3 shade, 4 crevice
  let k: number;
  if (crag && m.cols.length) {
    // the column holding this point (its edges wander and lean a little going down)
    const wx = lx + (vnoise1(ly / 29, seed + 25) - 0.5) * 7 + ly * 0.05 * (hash1(2, seed) - 0.5);
    const n = m.cols.length / 3;
    let i = 0;
    while (i < n - 1 && wx > m.cols[i * 3 + 1]!) i++;
    const c0 = m.cols[i * 3]!, c1 = m.cols[i * 3 + 1]!, ch = m.cols[i * 3 + 2]!;
    const q = clamp((wx - (c0 + c1) / 2) / Math.max(1, (c1 - c0) / 2), -1.2, 1.2);
    const cap = s < Math.min(10, ch * 0.3) + 2;
    k = q < -0.5 ? 1 : q < 0.35 ? 2 : 3;
    if (cap && q < 0.2 && lit > 0.6) k = s < mossD + 1.3 ? 0 : 1;
    // the fissure on the column's left: open in places, closed (fused) in others
    const fused = hash1(i, seed + 35) < 0.55;
    const reach = (0.3 + 0.7 * hash1(i, seed + 36)) * (ch + 30);
    const open = !fused && s < reach && vnoise1(ly / 31 + i * 2.3, seed + 26) > 0.4 - 0.2 * hash1(i, seed + 27);
    if (q < -0.9 && open && s > 3) k = 4;
    else if (q < -0.8 && open && s > 3) k = 3;
    else if (fused && q < -0.93 && s > 6 && k < 3) k += 1;
    // the odd ledge across one column: a dark undercut, lit lip above
    const per = 28 + 30 * hash1(i, seed + 33);
    const ly2 = ly + (vnoise1(wx / 19, seed + 28) - 0.5) * 5 + (wx - c0) * (hash1(i, seed + 34) - 0.5) * 0.3;
    const L = Math.floor(ly2 / per + hash1(i, seed + 29));
    const lf = ly2 / per + hash1(i, seed + 29) - L;
    if (hash(i, L, seed + 30) < 0.09 && s > 8) {
      if (lf < 0.06) k = 4;
      else if (lf > 0.94 && k > 1) k = 1;
    }
  } else {
    const upD = (2 + 9 * clamp(lit - 0.35, 0, 1)) * (0.6 + 0.8 * vnoise1(lx / 8, seed + 42));
    if (s < mossD + 1.2 && lit > 0.8) k = 0;
    else if (s < mossD + upD) k = lit > 0.72 ? 1 : 2;
    else {
      const e1 = 0.2 + 0.1 * (vnoise1(ly / 13 + 3, seed + 43) - 0.5) * 2;
      const e2 = 0.62 + 0.14 * (vnoise1(ly / 17 + 7, seed + 44) - 0.5) * 2;
      k = u < e1 ? 1 : u < e2 ? 2 : 3;
    }
    // a crack or two running down from a notch in the top
    for (let i = 2; i + 2 < m.v.length; i += 2) {
      if (hash1(i, seed + 27) > 0.45) continue;
      const vx = m.v[i]!, vy = -m.v[i + 1]!;
      if (ly < vy + 2) continue;
      const len = 14 + 34 * hash1(i, seed + 29);
      if (ly - vy > len) continue;
      const cx = vx + (ly - vy) * (hash1(i, seed + 28) - 0.5) * 0.9 + (vnoise1(ly / 6, seed + i) - 0.5) * 2.4;
      const dd = lx - cx;
      if (dd >= 0 && dd < 1) k = 4;
      else if (dd >= -1 && dd < 0 && k > 1) k -= 1;
    }
  }
  // an end crag's outer face: in shade facing right, catching the sun facing left
  if (fd < 3 + 5 * vnoise1(ly / 9, seed + 45)) k = m.drop === 1 ? (fd < 1 ? 4 : 3) : fd < 1.2 ? 0 : 1;
  // wet and dark at the waterline (its top edge wandering), darker still going down
  if (ly > -(2.5 + 5 * vnoise1(lx / 11, seed + 40)) && k < 3) k += 1;
  // under the water the rock goes on down off the bottom, wet, then in the bank's shadow
  if (ly > 8 + 18 * vnoise1(lx / 13, seed + 47) && k < 3) k += 1;
  if (ly > 24 + 20 * vnoise1(lx / 17, seed + 49) && k < 3) k = 3;
  if (ly > 30 && k < 4 && bayer4(x, y) < clamp((ly - 30 - 20 * vnoise1(lx / 21, seed + 48)) / 90, 0, 0.85)) k += 1;
  // a little grain: the odd px a step off
  if (hash(Math.floor(lx / 2), Math.floor(ly / 2), seed + 31) < 0.05 && k > 0 && k < 4) k += hash1(Math.floor(lx), seed + 32) < 0.5 ? -1 : 1;
  const R = crag ? [P.karst[4]!, P.karst[6]!, P.karst[7]!, P.karst[8]!, P.ink[0]!] : [P.karst[3]!, P.karst[5]!, P.karst[6]!, P.karst[7]!, P.ink[0]!];
  void top;
  return R[k]!;
}

// ---------------------------------------------------------------------------
// the things on the masses

/** An old stone lantern (toro), its foot in the grass, leaning a little. Local (x, y) is its foot. */
function lantern(c: PaintCtx, x: number, y: number, H: number, lean: number, seed: number): void {
  const b = c.buf, d = c.d;
  const ca = Math.cos(lean), sa = Math.sin(lean);
  const R = H * 0.34;
  const X0 = Math.max(b.ox, Math.floor(c.X(x - R + Math.min(0, sa * H)) - d)), X1 = Math.min(b.x1, Math.ceil(c.X(x + R + Math.max(0, sa * H)) + d));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(y - H * 1.04) - d)), Y1 = Math.min(b.y1, Math.ceil(c.Y(y + 2)));
  if (X0 >= X1 || Y0 >= Y1) return;
  // the parts' half widths by height (0 foot .. 1 top), side-on
  const half = (v: number): number => {
    if (v < 0.1) return 0.2;                       // the foot stone
    if (v < 0.12) return 0.15;
    if (v < 0.47) return 0.075 + (v > 0.27 && v < 0.3 ? 0.014 : 0) - (v - 0.12) * 0.02; // the post, a ring round it
    if (v < 0.5) return 0.11;
    if (v < 0.57) return 0.11 + (v - 0.5) / 0.07 * 0.065; // the platform flaring out
    if (v < 0.59) return 0.175;
    if (v < 0.75) return 0.115;                    // the firebox
    if (v < 0.77) return 0.16;
    if (v < 0.91) {
      // the cap: a wide roof, its eaves curling up at the tips, sloping in to the top
      const k = (v - 0.77) / 0.14;
      return 0.32 * Math.pow(1 - k, 1.6) + 0.035;
    }
    if (v < 0.94) return 0.045;
    // the jewel on top
    const k = (v - 0.94) / 0.06;
    return 0.055 * Math.sin(Math.PI * clamp(0.15 + k * 0.85, 0, 1));
  };
  for (let yy = Y0; yy < Y1; yy++) {
    for (let xx = X0; xx < X1; xx++) {
      const lx = LX(c, xx) - x, ly = LY(c, yy) - y;
      // into the lantern's own frame (it leans about its foot)
      const ux = lx * ca + ly * sa, uy = -lx * sa + ly * ca;
      const v = -uy / H;
      if (v < -0.02 || v > 1) continue;
      let hw = half(v) * H;
      // the eaves' tips curl up
      const eave = v >= 0.77 && v < 0.8;
      if (v >= 0.77 && v < 0.84) hw += H * 0.02 * Math.max(0, 1 - Math.abs(v - 0.785) / 0.02);
      if (Math.abs(ux) > hw) continue;
      const q = ux / Math.max(0.5, hw);
      // light from the upper left: the left of each part lit, the right in shade, under the
      // cap and the platform a band of shadow
      let t = q < -0.55 ? 0.22 : q < 0.15 ? 0.42 : q < 0.6 ? 0.58 : 0.74;
      if ((v > 0.59 && v < 0.64) || (v > 0.47 && v < 0.5) || (v > 0.1 && v < 0.14)) t += 0.18;
      if (eave || (v > 0.91 && v < 0.94)) t += 0.12;
      // the firebox's window: dark, a square hole
      if (v > 0.63 && v < 0.72 && Math.abs(ux) < H * 0.045) { b.set(xx, yy, P.ink[1]!); continue; }
      // moss on the cap's top and the platform, lichen and age on the stone
      const roof = v > 0.8 && v < 0.91;
      const mv = vnoise(ux / 3, v * 40, seed + 41);
      if ((roof && mv > 0.45 && q < 0.7) || (v > 0.55 && v < 0.59 && mv > 0.6)) {
        b.set(xx, yy, q < -0.3 ? P.moss[4]! : P.moss[5]!);
        continue;
      }
      t += (vnoise(ux / 2.5, v * 30, seed + 42) - 0.5) * 0.16;
      if (v < 0.3) t += 0.1 * (1 - v / 0.3);
      b.set(xx, yy, tone(P.stone, clamp(0.4 + t * 0.62, 0, 1), xx, yy, 0.2));
    }
  }
}

/** A dead branch fallen across a hummock, its far end forking into bare twigs. */
function branch(c: PaintCtx, pts: [number, number][], seed: number): void {
  const r = rng(seed);
  stroke(c, pts, (u) => 2.5 + 4.5 * (1 - u) * (1 - u * 0.3), (u, side) => (side < -0.4 ? P.timber[3]! : side > 0.5 ? P.timber[6]! : hash1(Math.floor(u * 40), seed) < 0.15 ? P.timber[5]! : P.timber[4]!));
  // twigs: from the far half, up and out, forking once or twice
  const n = 3 + Math.floor(r() * 3);
  const twig = (x: number, y: number, a: number, len: number, depth: number): void => {
    const path = bladePath(x, y, len, a, (r() - 0.5) * 0.8);
    stroke(c, path, (u) => (depth === 0 && u < 0.4 ? 2 : 1), (u) => (u < 0.5 ? P.timber[5]! : P.timber[4]!));
    if (depth < 2) {
      const [ex, ey] = path[Math.floor(path.length * (0.5 + 0.3 * r()))]!;
      twig(ex, ey, a + (r() < 0.5 ? -1 : 1) * (0.35 + 0.4 * r()), len * (0.45 + 0.25 * r()), depth + 1);
      if (depth === 0 && r() < 0.6) twig(path[path.length - 1]![0], path[path.length - 1]![1], a + (r() - 0.5) * 0.6, len * 0.5, depth + 1);
    }
  };
  for (let i = 0; i < n; i++) {
    const u = 0.45 + 0.55 * (i / Math.max(1, n - 1)) * (0.85 + 0.15 * r());
    const k = Math.min(pts.length - 1, Math.round(u * (pts.length - 1)));
    const [x, y] = pts[k]!;
    twig(x, y, 0.2 + r() * 0.9, 10 + r() * 22, 0);
  }
}

// ---------------------------------------------------------------------------
// painting

function lipCol(lx: number, ly: number, s: number, G: number, seed: number, x: number, y: number): number {
  const mud = fbm1(lx / 110, seed + 34, 2) > 0.5;
  if (s < 1.1) return mud ? (vnoise1(lx / 4, seed + 38) > 0.7 ? P.earth[4]! : P.earth[5]!) : vnoise1(lx / 5, seed + 35) > 0.6 ? P.moss[4]! : P.moss[5]!;
  if (s < 3) return mud ? P.earth[5]! : P.moss[6]!;
  void G;
  // the bank's face: grass stems and roots hanging, darker going down
  if (s < 26 && hash(Math.floor(lx / 1.5), Math.floor((ly + 40) / (5 + 4 * hash1(Math.floor(lx / 1.5), seed + 37))), seed + 36) < 0.3 * (1 - s / 26)) return mud ? P.earth[5]! : P.moss[6]!;
  return deepCol(lx, ly, x, y, seed);
}

/** The ground strip: the lip just above the water, the dark ground below it. */
function paintGround(c: PaintCtx, p: BankP, L: Mass[]): void {
  const b = c.buf, seed = c.seed;
  const [ga, gb] = groundSpan(p, L);
  const X0 = Math.max(b.ox, Math.floor(c.X(ga))), X1 = Math.min(b.x1, Math.ceil(c.X(gb)));
  for (let x = X0; x < X1; x++) {
    const lx = LX(c, x);
    if (lx < ga || lx > gb) continue;
    const G = groundTop(lx, seed);
    const Y0 = Math.max(b.oy, Math.floor(c.Y(-G - 1))), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.h)));
    for (let y = Y0; y < Y1; y++) {
      const ly = LY(c, y);
      if (ly < -G) continue;
      b.set(x, y, lipCol(lx, ly, ly + G, G, seed, x, y));
    }
  }
}

/** Pebbles, low grass and lily pads along the lip where no mass stands. */
function paintLip(c: PaintCtx, p: BankP, L: Mass[]): void {
  const b = c.buf, d = c.d, seed = c.seed;
  const [ga, gb] = groundSpan(p, L);
  const free = (x: number): boolean => {
    const G = groundTop(x, seed);
    for (const m of L) if (massTop(m, x) > G - 1) return false;
    return true;
  };
  const r = rng(seed + 61);
  // things come in clusters: a cluster every 40 to 200 px, several things in it
  for (let x = ga + 10 + r() * 30; x < gb - 10; x += 22 + r() * 90) {
    const kind = r();
    const n = 2 + Math.floor(r() * 6);
    const spread = 10 + r() * 36;
    for (let i = 0; i < n; i++) {
      const px = x + (r() - 0.5) * spread;
      const sz = r(), s2 = r(), s3 = r();
      if (!b.touches(Math.floor(c.X(px - 30)), b.oy - 1, Math.ceil(c.X(px + 30)), b.y1 + 1)) continue;
      if (!free(px)) continue;
      const G = groundTop(px, seed);
      const ps = Math.round(px * 7);
      if (kind < 0.24) {
        // a lily pad lying on the water just beyond the lip: a thin lens, notched, lit on top
        if (d < 0.2) continue;
        const rx = 5 + sz * 9, cy = -G - 1.5 - s2 * 3;
        for (let ox = -rx; ox <= rx; ox += 0.5) {
          if (Math.abs(ox - rx * (0.3 - 0.6 * s3)) < 0.8) continue; // the notch
          const th = 1.6 * Math.sqrt(Math.max(0, 1 - (ox / rx) ** 2));
          dot(c, px + ox, cy - th * 0.5, Math.abs(ox) < rx * 0.75 ? P.moss[4]! : P.moss[5]!);
          if (th > 0.8) dot(c, px + ox, cy + 0.6, P.moss[6]!);
        }
        if (s3 < 0.18) { dot(c, px, cy - 2, P.paper[0]!); dot(c, px + 1, cy - 2, P.blossom[1]!); dot(c, px, cy - 3, P.paper[1]!); }
      } else if (kind < 0.46) {
        // pebbles heaped on the lip, lit on their upper left
        const R = 1.5 + sz * 3.5;
        for (let oy = -R; oy <= R * 0.4; oy += 0.5) for (let ox = -R * 1.3; ox <= R * 1.3; ox += 0.5) {
          if ((ox / (R * 1.3)) ** 2 + (oy / R) ** 2 > 1) continue;
          const lit = -0.62 * ox / R - 0.78 * oy / R;
          dot(c, px + ox, -G + 0.5 + oy, lit > 0.55 ? P.stone[3]! : lit > -0.1 ? P.stone[4]! : P.stone[5]!);
        }
      } else if (kind < 0.86) {
        // sedge: a clump of long blades, arching out
        if (d < 0.18) continue;
        const m = 5 + Math.floor(sz * 9);
        const tall = 10 + s2 * 26;
        for (let k = 0; k < m; k++) {
          const hk = hash1(k + 9, ps);
          grass(c, px + (hash1(k, ps) - 0.5) * (6 + sz * 10), -G + 1, tall * (0.35 + 0.65 * hk), (hash1(k + 19, ps) - 0.5) * 1.0, (hash1(k + 29, ps) - 0.5) * 1.6 * (tall / 24), s3 * hk, tall > 24 && hk > 0.6);
        }
      } else {
        // a low tuft of grass
        if (d < 0.2) continue;
        const m = 3 + Math.floor(sz * 6);
        for (let k = 0; k < m; k++) grass(c, px + (hash1(k, ps) - 0.5) * 8, -G + 1, 4 + hash1(k + 9, ps) * 10 * (0.6 + s2), (hash1(k + 19, ps) - 0.5) * 1.1, (hash1(k + 29, ps) - 0.5) * 0.8, s3);
      }
    }
  }
}

function paintMass(c: PaintCtx, p: BankP, m: Mass): void {
  const b = c.buf, d = c.d;
  const [a, bb] = massSpan(m);
  const reach = m.kind === "hummock" ? m.w * 0.45 : 40;
  const tall = m.kind === "lantern" ? m.h * 1.1 : m.h + 70;
  const reachB = Math.max(reach, baseReach(m, p.h));
  if (!b.touches(Math.floor(c.X(a - reachB)), Math.floor(c.Y(-tall)), Math.ceil(c.X(bb + reachB)), Math.ceil(c.Y(p.h)))) return;
  const rocky = m.v.length > 0;
  // the body
  const ext = baseReach(m, p.h);
  const X0 = Math.max(b.ox, Math.floor(c.X(a - (m.drop === -1 ? 0 : ext)))), X1 = Math.min(b.x1, Math.ceil(c.X(bb + (m.drop === 1 ? 0 : ext))));
  for (let x = X0; x < X1; x++) {
    const lx = LX(c, x);
    if (lx < a || lx > bb) {
      // the base past the mass's ends: dark, its own material going down
      if ((lx > bb && m.drop === 1) || (lx < a && m.drop === -1)) continue;
      const Y0 = Math.max(b.oy, Math.floor(c.Y(0))), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.h)));
      for (let y = Y0; y < Y1; y++) {
        const ly = LY(c, y);
        if (!inBase(m, lx, ly)) continue;
        b.set(x, y, baseCol(m, lx, ly, x, y));
      }
      continue;
    }
    const T = massTop(m, lx);
    if (T === -Infinity) continue;
    const slope = (massTop(m, Math.min(bb, lx + 1.5)) - massTop(m, Math.max(a, lx - 1.5))) / 3;
    const lit = isFinite(slope) ? (0.62 * slope + 0.78) / Math.sqrt(1 + slope * slope) : 0.5;
    const Y0 = Math.max(b.oy, Math.floor(c.Y(-T) - d)), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.h)));
    for (let y = Y0; y < Y1; y++) {
      const ly = LY(c, y);
      if (ly < -T) continue;
      const s = ly + T;
      // an end crag: open air past its outer face
      let fd = Infinity;
      if (m.drop) {
        fd = (faceX(m, ly) - lx) * m.drop;
        if (fd < 0) continue;
      }
      b.set(x, y, rocky ? rockCol(m, lx, ly, T, s, isFinite(slope) ? slope : 0, x, y, fd) : softCol(m, lx, ly, s, lit * (1 - 0.4 * clamp((lx - m.x) / m.w, 0, 1)), x, y));
    }
  }
  const r = rng(m.seed + 50);
  const top = (x: number): number => massTop(m, x);
  const lod = (k: number): boolean => hash1(k, m.seed + 51) < Math.min(1, d * 1.6);
  if (m.kind === "hummock") {
    // the grass: dense, in tufts, longest on the crown, a few lit blades on the upper left
    const n = Math.round(m.w * 0.9);
    const blades: [number, number, number, number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const x = m.x + m.w * (0.03 + 0.94 * r());
      const u = (x - m.x) / m.w;
      const tuft = vnoise1(x / 19, m.seed + 52);
      const e = moundEnv(m, u);
      const len = (5 + r() * 24 * (0.4 + tuft)) * (0.35 + 0.65 * Math.sqrt(e));
      const a0 = (r() - 0.42) * 0.9, bend = (r() - 0.4) * 1.4 * (len / 25);
      blades.push([x, len, a0, bend, r(), i]);
    }
    // the fallen branch lies across it: stiff, its broken butt sunk in the grass on the crown,
    // its far end resting on the ground beyond the hummock, a kink where it once forked
    const ax = m.x + m.w * (0.28 + 0.16 * r()), bx = m.x + m.w * (1.12 + 0.22 * r());
    const ay = -top(ax) + 3, by = -groundTop(bx, c.seed) - 2.5;
    const kx = ax + (bx - ax) * (0.5 + 0.2 * r()), kink = (r() - 0.5) * 6;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const u = k / 16, x = ax + (bx - ax) * u;
      const y = ay + (by - ay) * u + (x < kx ? kink * (x - ax) / (kx - ax) : kink * (bx - x) / (bx - kx)) - Math.sin(u * Math.PI) * 1.5;
      pts.push([x, Math.min(y, -top(x) + 3)]);
    }
    for (const [x, len, a0, bend, l, i] of blades) if (i % 3 === 0 && lod(i)) grass(c, x, -top(x) + 1.5, len, a0, bend, l * 0.5, len > 20);
    branch(c, pts, m.seed + 53);
    for (const [x, len, a0, bend, l, i] of blades) if (i % 3 !== 0 && lod(i)) grass(c, x, -top(x) + 1.5, len * 0.85, a0, bend, l * (1 - (x - m.x) / m.w * 0.7), len > 22);
  } else if (m.kind === "reeds") {
    // the stand's foot: broad reed leaves, dark, arching out (the tall reeds are sprites)
    const n = Math.round(m.w * 0.55);
    for (let i = 0; i < n; i++) {
      const x = m.x + m.w * (0.04 + 0.92 * r());
      const u = (x - m.x) / m.w;
      const len = (8 + r() * m.h * 1.3) * (0.4 + 0.6 * Math.sin(Math.PI * clamp(u, 0.05, 0.95)));
      const a0 = (r() - 0.5) * 0.5, bend = (r() - 0.5) * 2.2 * (len / 30);
      if (lod(i)) grass(c, x, -top(x) + 1.5, len, a0, bend, r() * 0.7, len > 18);
    }
  } else if (m.kind === "tuft") {
    const n = Math.round(m.w * 0.6);
    for (let i = 0; i < n; i++) {
      const x = m.x + m.w * (0.05 + 0.9 * r());
      const u = (x - m.x) / m.w;
      const len = (4 + r() * m.h * 1.6) * Math.sin(Math.PI * clamp(u, 0.05, 0.95));
      if (lod(i)) grass(c, x, -top(x) + 1.5, len, (r() - 0.45) * 1.1, (r() - 0.45) * 1.5 * (len / 20), r(), len > 22);
    }
  } else if (m.kind === "lantern") {
    // grass behind, the lantern, then tall grass in front of its foot
    const lx0 = m.x + m.w * (0.38 + 0.2 * hash1(4, m.seed));
    const lean = m.lean ?? (hash1(5, m.seed) < 0.5 ? -1 : 1) * (0.06 + 0.06 * hash1(6, m.seed));
    const n = Math.round(m.w * 0.8);
    const blades: [number, number, number, number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const x = m.x + m.w * (0.03 + 0.94 * r());
      const near = Math.max(0, 1 - Math.abs(x - lx0) / (m.w * 0.45));
      const len = (8 + r() * (16 + 46 * near)) * (0.5 + 0.5 * moundEnv(m, (x - m.x) / m.w));
      blades.push([x, len, (r() - 0.45) * 0.8, (r() - 0.45) * 1.6 * (len / 30), r(), i]);
    }
    for (const [x, len, a0, bend, l, i] of blades) if (i % 2 === 0 && lod(i)) grass(c, x, -top(x) + 1.5, len, a0, bend, l * 0.4, len > 24);
    lantern(c, lx0, -top(lx0) + 3, m.h, lean, m.seed + 54);
    for (const [x, len, a0, bend, l, i] of blades) if (i % 2 === 1 && lod(i)) grass(c, x, -top(x) + 1.5, len * 0.9, a0, bend, l, len > 24);
  } else if (m.kind === "boulder") {
    // ferns at its foot, a little grass where it meets the ground
    const nf = 3 + Math.floor(r() * 4);
    for (let i = 0; i < nf; i++) {
      const side = r() < 0.55 ? 1 : -1;
      const fx = side > 0 ? bb - m.w * (0.05 + 0.25 * r()) : a + m.w * (0.05 + 0.25 * r());
      const len = 14 + r() * 26;
      const fy = -Math.max(0, Math.min(top(fx), 6)) + 1;
      if (d >= 0.4) fern(c, fx, fy, len, side * (0.35 + 0.6 * r()), m.seed + 60 + i);
    }
    for (let i = 0; i < 14; i++) {
      const x = a + (bb - a) * r();
      const len = 3 + r() * 10;
      const y = -Math.max(groundTop(x, c.seed), Math.min(top(x), 4)) + 1;
      if (lod(i)) grass(c, x, y, len, (r() - 0.5) * 1.2, (r() - 0.5), 0.3);
    }
  } else if (m.kind === "crag") {
    // grass and shrubs on its top, ferns in its clefts, strands hanging on the outer face
    const n = Math.round(m.w * 0.35);
    for (let i = 0; i < n; i++) {
      const x = a + (bb - a) * r();
      const T = top(x);
      if (T < 4) continue;
      const len = 3 + r() * 14 * vnoise1(x / 30, m.seed + 55);
      if (lod(i)) grass(c, x, -T + 1.5, len, (r() - 0.45) * 1.2, (r() - 0.4) * 1.2, r() * 0.9);
    }
    // shrubs and grass rooted in the notches between the columns' heads
    for (let i = 3; i < m.cols.length; i += 3) {
      const x = m.cols[i]!;
      const pick = r(), R = 5 + r() * 11, dx = (r() - 0.5) * 6;
      const T = top(x + dx);
      if (pick < 0.55 && T > 10 && d >= 0.18) clump(c, x + dx, -T - R * 0.25, R, P.moss.slice(3, 7), P.pine.slice(2), 0.46, m.seed + 70 + i, 0.7);
      else if (pick < 0.8 && T > 8) for (let k = 0; k < 7; k++) if (lod(i * 7 + k)) grass(c, x + dx + (hash1(k, m.seed + i) - 0.5) * 10, -T + 2, 6 + hash1(k + 7, m.seed + i) * 16, (hash1(k + 17, m.seed + i) - 0.5) * 1.2, (hash1(k + 27, m.seed + i) - 0.4) * 1.4, 0.7);
    }
    const nf = 2 + Math.floor(r() * 3);
    for (let i = 0; i < nf; i++) {
      const x = m.x + m.w * (0.1 + 0.8 * r());
      const T = top(x);
      if (T > 8 && d >= 0.4) fern(c, x, -T * (0.35 + 0.4 * r()), 12 + r() * 16, (r() < 0.5 ? -1 : 1) * (0.5 + 0.5 * r()), m.seed + 80 + i);
    }
    if (m.drop) {
      // the outer face: strands of creeper hanging over it
      const fx = m.drop === 1 ? m.v[m.v.length - 6]! : m.v[4]!;
      for (let i = 0; i < 5; i++) {
        const sx = fx + m.drop * (2 + r() * 14), sy = -Math.max(0, top(sx - m.drop * 4)) + 2;
        const len = 12 + r() * 40;
        if (d >= 0.18) stroke(c, bladePath(sx, sy, len, Math.PI + m.drop * 0.08, (r() - 0.5) * 0.4), () => 1, (u) => (u < 0.3 ? P.moss[5]! : P.moss[6]!));
      }
    }
  }
}

export const bank = definePainter<BankP>("op.bank", {
  bounds(p) {
    // (a mass's base spreads under the waterline by up to 1.15 px a px down)
    const base = 75 * 1.4 + (p.h + 10) * 0.18 + 20;
    let x0 = -60, x1 = p.w + 60, y0 = -150;
    if (p.masses) {
      for (const m of p.masses) {
        x0 = Math.min(x0, m.x - 120 - base);
        x1 = Math.max(x1, m.x + m.w * (m.kind === "hummock" ? 1.6 : 1) + 120 + base);
        y0 = Math.min(y0, -(m.kind === "lantern" ? m.h * 1.1 : m.h * 1.3 + 70) - 20);
      }
    } else {
      x0 = -160 - base;
      x1 = p.w + 160 + base;
      y0 = -260;
    }
    return [x0, y0, x1, p.h + 4];
  },
  paint(c, p) {
    const L = layoutOf(p, c.seed);
    paintGround(c, p, L);
    paintLip(c, p, L);
    for (const m of L) paintMass(c, p, m);
  },
});

/** The reed stands' places, for the reed sprites: [x, width, height, density] in the shore's own px. */
export function reedBeds(p: BankP, seed: number): [number, number, number, number][] {
  return layoutOf(p, seed).filter((m) => m.kind === "reeds").map((m) => [m.x + m.w * 0.06, m.w * 0.88, m.reed ?? Math.round(m.h * 2.2 + 40), m.dense ?? 3] as [number, number, number, number]);
}

/** The shore's top at x, px above the waterline (so reeds stand on it, not in the air). */
export function bankTopAt(p: BankP, seed: number, x: number): number {
  return topOf(p, layoutOf(p, seed), x, seed);
}
