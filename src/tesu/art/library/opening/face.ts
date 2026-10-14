// The karst face model shared by the opening's rock (rock.ts, wall.ts): what a point on a cliff
// face looks like, side-on, in the morning light.
//
// (art loop round 3, after Dex's own sketch of how terrain is built) A cliff is a STACK OF CHUNKS,
// never one flat columnar texture. Bedded karst limestone breaks along its vertical joints and its
// bedding planes into blocks, so the face is:
//
// - Columns between the joints, of very different widths (a joint now and then missing, so a few
//   broad blocks stand between narrow ones), each joint hand-wobbly and leaning a little its own way.
// - Inside each column, breaks at its own irregular heights (never lined up with the next column's),
//   each tilting and wobbling: so the blocks step up and down across the face like the sketch, every
//   one a different size.
// - Each block stands forward or sits back by its own amount, grouped first into a few big masses
//   (a slow field across the face, the giant buttresses where given) and then block by block.
//   Forward blocks are lit and lighter, recessed ones darker and cooler. Where one block stands in
//   front of its neighbour it casts a shadow on it (down and to the right: the sun is up and left);
//   where a block steps forward of the one above, its top is a ledge carrying a cap of green (the only
//   green on the face); where the one above overhangs, a shadow lies under it. Every block is a rounded
//   form (a lit left flank, its right side turning into shade, corners chipped, never square).
// - Grooves and dark stains only where water runs: down from a green ledge or from the lip.
// - Near levels add the grain (a crack, a fine bedding line); far levels keep only the blocks.
// - Giant masses (optional) group the blocks into big buttresses and gullies for the wide frames.

import type { PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { clamp, fbm1, hash, hash1, tone, vnoise, vnoise1 } from "../../raster.ts";

export interface FaceOpts {
  /** Base width of a joint cell, px (columns are runs of 1 to 4 cells). */
  col?: number;
  /** Base height of a block, px. */
  bed?: number;
  /** Giant masses this wide (on average), px; 0 or unset for none. */
  giant?: number;
  /** Moss on ledges, 0..1. */
  veg?: number;
  /** Extra shade over the whole face, 0..1. */
  shade?: number;
}

export type FaceMat = "rock" | "moss" | "warm";

export interface FaceOut {
  /** Tone, 0 lit .. 1 dark. */
  t: number;
  mat: FaceMat;
}

/**
 * Detail by level, nested: a mark shows at a level only if its importance clears the level's
 * threshold, so a far level's structure is a coarser subset of the near one's (the pull-back never
 * pops; the small breaks just drop away). The blocks themselves are the same at every level.
 */
export const thrOf = (d: number): number => (d >= 0.5 ? 0 : d >= 0.25 ? 0.5 : 0.78);

/** A block of the face: its column (joint index and x span at this depth), its break span and how far forward it stands. */
export interface Chunk {
  /** Column (its left joint's index) and break index. */
  L: number;
  k: number;
  xl: number;
  xr: number;
  yt: number;
  yb: number;
  /** 0 recessed .. 1 standing forward. */
  z: number;
  /** The column's nominal width (its joints' places, without their wander). */
  w: number;
}

const cellW = (o: FaceOpts): number => (o.col ?? 22) * 3;

/** The joint i's place (no wander). */
const jointBase = (i: number, cw: number, seed: number): number => (i + 0.5 + (hash1(i, seed + 146) - 0.5) * 0.56) * cw;
/** The joint i's x at depth ly: its place and a hand-wobbly wander (never crossing its neighbours). */
function jointX(i: number, ly: number, cw: number, seed: number): number {
  return jointBase(i, cw, seed) + (vnoise1(ly / 52 + i * 3.1, seed + 159) - 0.5) * cw * 0.16 + (vnoise1(ly / 9 + i * 1.7, seed + 160) - 0.5) * 1.6;
}
/** Does joint i exist (some are missing, so columns are 1 to 4 cells wide)? */
const hasJoint = (i: number, seed: number): boolean => hash1(i, seed + 149) > 0.36;

/** The existing joints round lx at depth ly: [index, x] in order. */
function jointsNear(lx: number, ly: number, cw: number, seed: number): [number, number][] {
  const i0 = Math.floor(lx / cw);
  const out: [number, number][] = [];
  for (let i = i0 - 7; i <= i0 + 8; i++) if (hasJoint(i, seed)) out.push([i, jointX(i, ly, cw, seed)]);
  return out;
}

/** How far forward the blocks stand here, slowly over the face (a few big masses of light and shade). */
function macroZ(x: number, y: number, o: FaceOpts, seed: number): number {
  let m = fbm1(x / 560 + 3.1, seed + 90, 3) * 0.75 + vnoise1(x / 170 + y / 400, seed + 96) * 0.25;
  if (o.giant) {
    // a giant buttress stands forward as a whole; the gully at its left sits far back
    const g = o.giant, cw = g * 0.45;
    const gx = x + (fbm1(y / 520, seed + 91, 3) - 0.5) * g * 0.5;
    const i0 = Math.floor(gx / cw);
    let xl = -Infinity, L = 0;
    for (let i = i0 - 7; i <= i0; i++) {
      if (hash1(i, seed + 93) <= 0.5) continue;
      const e = (i + 0.5 + (hash1(i, seed + 92) - 0.5) * 0.8) * cw;
      if (e <= gx && e > xl) { xl = e; L = i; }
    }
    if (isFinite(xl)) {
      const gw = g * (0.04 + 0.05 * hash1(L, seed + 94));
      m = m * 0.6 + 0.4 * (0.35 + 0.5 * hash1(L, seed + 95));
      if (gx - xl < gw) m -= 0.55 * (1 - (gx - xl) / gw);
    }
  }
  return m;
}

/** The chunk of column [L, xl, xr] (nominal width w) holding depth ly (its own breaks: irregular, tilted, wobbly, some missing). */
function chunkIn(L: number, w: number, xl: number, xr: number, lx: number, ly: number, o: FaceOpts, seed: number): Chunk {
  const bed = o.bed ?? 78;
  // a block is roughly as tall as its column is wide, within the bedding's own range
  // (round 4, the critic: "an even grid of rectangles") block heights vary far more, column to column
  const bc = clamp(w * (0.32 + 1.05 * hash1(L, seed + 170)), bed * 0.42, bed * 2.1);
  const y0 = hash1(L, seed + 171) * bc;
  // (the block's nominal middle, so its tilt and how far forward it stands never swim row by row)
  const xc = jointBase(L, cellW(o), seed) + w / 2;
  const tilt = (hash1(L, seed + 172) - 0.5) * 0.12;
  const brk = (k: number): number => y0 + (k + (hash(L, k, seed + 173) - 0.5) * 0.55) * bc + tilt * (lx - xc) + (vnoise1(lx / 14 + k * 2.9, seed + 174) - 0.5) * 2.6 + (vnoise1(lx / 4 + k * 1.3, seed + 175) - 0.5) * 0.9;
  const has = (k: number): boolean => hash(L, k, seed + 176) > 0.18;
  let k = Math.floor((ly - y0) / bc);
  while (brk(k) > ly) k--;
  while (brk(k + 1) <= ly) k++;
  let a = k;
  while (!has(a) && a > k - 6) a--;
  let b = k + 1;
  while (!has(b) && b < k + 7) b++;
  const yt = brk(a), yb = brk(b);
  // (round 4: the face first grouped into a few big masses of light and shade, then block by
  // block; a strong per-block term read as a checkerboard of light and dark tiles)
  const z = clamp(0.5 + (macroZ(xc, (yt + yb) / 2, o, seed) - 0.5) * 1.9 + (hash(L, a, seed + 177) - 0.5) * 0.6, 0, 1);
  return { L, k: a, xl, xr, yt, yb, z, w };
}

/** The chunk at a level-1 point, and its neighbours to the left and right at the same depth. */
export function chunkAt(lx: number, ly: number, o: FaceOpts, seed: number): { c: Chunk; left: Chunk; right: Chunk } {
  const cw = cellW(o);
  const J = jointsNear(lx, ly, cw, seed).sort((a, q) => a[1] - q[1]);
  let j = -1;
  for (let n = 0; n < J.length; n++) if (J[n]![1] <= lx) j = n;
  const at = (n: number, x: number): Chunk => {
    if (n < 0) return chunkIn(J[0]![0] - 1, cw * 2, J[0]![1] - cw * 2, J[0]![1], x, ly, o, seed);
    if (n >= J.length - 1) { const [i, xj] = J[J.length - 1]!; return chunkIn(i, cw * 2, xj, xj + cw * 2, x, ly, o, seed); }
    return chunkIn(J[n]![0], Math.max(4, jointBase(J[n + 1]![0], cw, seed) - jointBase(J[n]![0], cw, seed)), J[n]![1], J[n + 1]![1], x, ly, o, seed);
  };
  const c = at(j, lx);
  return { c, left: at(j - 1, c.xl - 0.5), right: at(j + 1, c.xr + 0.5) };
}

/** What the face shows at a level-1 point; depth is px below the mass's top line. */
export function face(lx: number, ly: number, depth: number, o: FaceOpts, seed: number, d: number): FaceOut {
  const px = 1 / Math.max(d, 0.125);
  const thr = thrOf(d);
  const { c: C, left: Lc, right: Rc } = chunkAt(lx, ly, o, seed);
  const above = chunkIn(C.L, C.w, C.xl, C.xr, lx, C.yt - 0.5, o, seed);
  const below = chunkIn(C.L, C.w, C.xl, C.xr, lx, C.yb + 0.5, o, seed);
  const w = Math.max(1, C.xr - C.xl), S = Math.max(1, C.yb - C.yt);
  const xIn = lx - C.xl, xR = C.xr - lx, s = ly - C.yt, sb = C.yb - ly;
  const z = C.z;
  const id = C.L * 131 + C.k * 7;
  // the big picture: forward chunks lighter, recessed darker; light falls off down the face
  let t = 0.8 - 0.52 * z + 0.14 * (1 - Math.exp(-depth / 320)) + (o.shade ?? 0) * 0.3;
  let mat: FaceMat = "rock";
  // its own rounded form: a lit left flank, the body, the right side turning into shade
  const u = xIn / w;
  const litW = Math.max(px * 1.5, Math.min(10, w * (0.06 + 0.1 * z)));
  if (xIn < litW) t -= 0.14 + 0.1 * z;
  else t += 0.17 * Math.pow(clamp((u - 0.45) / 0.55, 0, 1), 1.3);
  // the top of a block rounds over into the light; its foot turns under into its own shade
  if (s < Math.min(6, S * 0.2)) t -= 0.06;
  if (sb < Math.min(5, S * 0.18)) t += 0.07;
  // --- where it meets its neighbours
  // left: a forward neighbour casts its shadow on it (wider lower down, its edge wobbling); or this
  // block stands forward and its left edge catches the sun; or a joint between equals
  const dzL = Lc.z - z;
  if (dzL > 0.1) {
    const cast = 1.5 + dzL * 26 + s * 0.05 + (vnoise1(ly / 6, seed + 181 + C.L) - 0.5) * 2.2;
    if (xIn < cast) return { t: Math.max(t + 0.28 + 0.12 * Math.min(1, dzL * 2.5), 0.78), mat };
  } else if (dzL < -0.1) {
    if (xIn < px * 1.6) t -= 0.22;
  } else if (xIn < px * 0.95 && (d >= 0.5 || hash1(C.L, seed + 182) > thr) && vnoise1(ly / 11 + C.L, seed + 183) > 0.3) {
    t += 0.3;
  }
  // above: the block over it overhangs (a shadow under it), or this block steps forward of it (a
  // ledge: its top lit and carrying green), or the bedding plane between equals
  const dzA = above.z - z;
  if (dzA > 0.1) {
    const sh = 2 + dzA * 24 + (vnoise1(lx / 7, seed + 184 + C.k) - 0.5) * 2;
    if (s < sh) return { t: Math.max(t + 0.3 + 0.1 * Math.min(1, dzA * 2.5), 0.8), mat };
  } else if (dzA < -0.1) {
    const veg = o.veg ?? 0.6;
    const cap = (1.5 + 4.5 * vnoise1(lx / 13 + C.k, seed + 185) * veg) * Math.min(1, -dzA * 4) + (hash1(Math.floor(lx / 3), seed + 186 + C.k) < 0.12 * veg ? 2.5 : 0);
    if (s < cap && w > 6) return { t: 0.2 + (s / Math.max(1, cap)) * 0.45, mat: "moss" };
    if (s < cap + px * 1.4) t += 0.2;
    else if (s < cap + px * 2.6) t -= 0.1;
  } else if (s < px * 0.95 && (d >= 0.5 || hash1(id, seed + 187) > thr) && vnoise1(lx / 13 + C.k, seed + 188) > 0.35) {
    t += 0.24;
  }
  // below: this block overhangs a recessed one (its underside in shade)
  if (below.z < z - 0.1 && sb < 2 + (z - below.z) * 6) t += 0.22;
  // right: a recessed neighbour (the form turns away) or a forward one (a dark slot under its edge)
  if (Rc.z < z - 0.1 && xR < 2.5) t += 0.12;
  else if (Rc.z > z + 0.1 && xR < px * 1.2) t += 0.26;
  // chipped corners: every block's corners turn away into shadow (no square blocks)
  const rc = Math.min(7, w * 0.22, S * 0.22);
  const cornerX = Math.min(xIn, xR), cornerY = Math.min(s, sb);
  if (cornerX < rc && cornerY < rc) {
    const q = (rc - cornerX) / rc, v = (rc - cornerY) / rc;
    if (q * q + v * v > 1) return { t: Math.max(t + 0.3, 0.76), mat };
  }
  // the stone's own surface: weathering runs down it in long vertical streaks (never blotches)
  const m = vnoise(lx / 5 + C.k * 7.3, ly / 70 + C.L * 1.7, seed + 206) * 0.7 + vnoise1(lx / 23 + C.k * 3.3, seed + 207) * 0.3;
  if (m > 0.68) t += 0.07;
  else if (m < 0.26) t -= 0.05;
  // warm light on the sunlit upper part of a block standing forward
  if (z > 0.7 && t < 0.34 && s < S * 0.5) mat = "warm";
  // --- water's marks: grooves and stains only where it runs down from a green ledge or the lip
  const wet = dzA < -0.1 || depth < S + 4;
  if (wet && d >= 0.5) {
    const ng = 1 + Math.floor(hash1(id, seed + 190) * 3);
    for (let g = 0; g < ng; g++) {
      if (hash1(id + g * 17, seed + 191) < 0.35) continue;
      const gx = C.xl + w * (0.18 + 0.64 * hash1(id + g * 17, seed + 192)) + (vnoise1(ly / 9 + g, seed + 193) - 0.5) * 1.6;
      const gl = S * (0.3 + 0.6 * hash1(id + g * 17, seed + 194));
      if (s > gl) continue;
      const dxg = lx - gx;
      // a groove: a dark cut with the light catching its left lip, thinning toward its end
      const gw = 0.6 + 0.9 * (1 - s / gl);
      if (dxg > -gw - px && dxg < -gw) t -= 0.12;
      else if (Math.abs(dxg) < gw) t += 0.24;
    }
    // a dark stain under the green, wandering down and thinning out
    if (dzA < -0.1) {
      const sx = C.xl + w * (0.2 + 0.6 * hash1(id, seed + 195)) + (vnoise1(s / 10, seed + 196) - 0.5) * 3;
      const sl = S * (0.25 + 0.5 * hash1(id, seed + 197));
      if (s < sl && Math.abs(lx - sx) < (2 + 4 * hash1(id, seed + 198)) * (1 - s / sl)) t += 0.1;
    }
  }
  // near only: a crack down a big block, a fine bedding line in it
  if (d >= 1 && w > 30 && S > 30) {
    const cx = C.xl + w * (0.3 + 0.4 * hash1(id, seed + 199)) + (vnoise1(ly / 7, seed + 200) - 0.5) * 3;
    if (hash1(id, seed + 201) < 0.4 && Math.abs(lx - cx) < 0.5 && s > S * 0.25 && s < S * (0.5 + 0.5 * hash1(id, seed + 202))) t += 0.26;
    const by = C.yt + S * (0.35 + 0.4 * hash1(id, seed + 203)) + (vnoise1(lx / 17, seed + 204) - 0.5) * 3;
    if (hash1(id, seed + 205) < 0.5 && Math.abs(ly - by) < 0.5 && u > 0.15 && u < 0.85) t += 0.08;
  }
  return { t, mat };
}

/**
 * The next exposed ledge (the top of a block that steps forward of the block over it) below
 * level-1 y at x, as local y, or null: where soil collects and plants grow.
 */
export function nextLedge(lx: number, ly: number, o: FaceOpts, seed: number): { y: number; ov: number } | null {
  let y = ly;
  for (let n = 0; n < 6; n++) {
    const { c } = chunkAt(lx, y, o, seed);
    const below = chunkIn(c.L, c.w, c.xl, c.xr, lx, c.yb + 0.5, o, seed);
    if (below.z < c.z - 0.1 || below.xr - below.xl < 8) { y = c.yb + 0.5; continue; }
    if (c.z < below.z - 0.1) return { y: c.yb, ov: c.z - below.z };
    y = c.yb + 0.5;
  }
  return null;
}

// ---------------------------------------------------------------------------
// One limestone chunk on its own (round 3): the west shore's blocks, the fallen blocks of the
// scree, the jetty's east landing. The same logic as the face, for a single block standing in
// mud or water: a hand-wobbly outline (noise at three scales, corners chipped, sides battered a
// little), lit along its top rim and left flank, its right side turning into shade, a crack or
// two where water runs down from its top, a cap of moss on its top ledge, and where it stands in
// the lake a dark wet band and a bright line at the water. Whole level-1 px at every density.

export interface LimeChunk {
  /** Its sides at its foot and its top's height, local px (y down: a top above the water is negative). */
  x0: number;
  x1: number;
  top: number;
  /** Where its foot goes (local y; past the waterline it is under water and the lake covers it). */
  foot: number;
  /** Its own top line instead of a straight one (local y at x), e.g. a walk line it carries. */
  topAt?: (x: number) => number;
  /** The top's tilt (px down per px to the right). */
  tilt?: number;
  /** 0 standing back (darker, cooler) .. 1 standing forward (lit, lighter). */
  z: number;
  /** Moss on its top ledge, px (0: bare). */
  cap?: number;
  /** The waterline (local y) where it stands in the lake. */
  water?: number;
  /** Extra shade, 0..0.4 (in a nearer thing's shadow, or turned away). */
  shade?: number;
  /** (round 4) How round its corners are (default 1; less is a fresher, blockier break). */
  round?: number;
  /** (round 5) How far it stands back in the haze, 0..1 (default 0): paler, its darks lifted. */
  haze?: number;
  seed: number;
}

const wob = (v: number, seed: number): number => (vnoise1(v / 15, seed + 3) - 0.5) * 4.4 + (vnoise1(v / 5.5, seed) - 0.5) * 2.2 + (vnoise1(v / 2, seed + 1) - 0.5) * 0.9;

/** The chunk's top (local y) at x, with its chipped, rounded corners; Infinity outside its span. */
export function chunkTop(k: LimeChunk, x: number): number {
  if (x < k.x0 - 3 || x > k.x1 + 3) return Infinity;
  const w = k.x1 - k.x0;
  // (a free block's top is a little domed and lumpy at three scales; a carried walk line is kept)
  const q = (x - k.x0) / Math.max(1, w) * 2 - 1;
  let base = k.topAt ? k.topAt(x) + Math.min(0, wob(x, k.seed + 3)) * 0.25 : k.top + (k.tilt ?? 0) * (x - k.x0) + wob(x, k.seed + 3) - (1 - q * q) * Math.min(4, w * 0.05);
  // a block broken along a joint: one part of its top stands higher, a short slant between
  if (!k.topAt && w > 14 && hash1(30, k.seed) > 0.35) {
    const nu = 0.28 + 0.44 * hash1(31, k.seed), drop = Math.min(7, (k.foot - k.top) * 0.3) * (0.5 + 0.5 * hash1(32, k.seed));
    const f = clamp(((x - k.x0) / w - nu) * w / 2.5 + 0.5, 0, 1);
    base += (hash1(33, k.seed) < 0.5 ? f : 1 - f) * drop;
  }
  const rc = Math.min(10, w * 0.22, Math.max(1, k.foot - k.top) * 0.4) * (k.round ?? 1);
  const e = Math.min(x - k.x0, k.x1 - x);
  return e < rc ? base + (rc - Math.sqrt(Math.max(0, rc * rc - (rc - e) * (rc - e)))) * 1.2 : base;
}

/**
 * Its foot (local y) at x. Standing in the lake it is the waterline's business; out of the water
 * it wobbles, part of it hangs lower where it broke along a joint, and its corners round off (never
 * a ruled bottom).
 */
export function chunkFoot(k: LimeChunk, x: number): number {
  if (k.water !== undefined) return k.foot;
  const w = k.x1 - k.x0;
  let f = k.foot + wob(x * 1.2, k.seed + 40) * 0.8;
  if (w > 20) {
    const nu = 0.3 + 0.4 * hash1(41, k.seed), st = 3 + 6 * hash1(42, k.seed);
    f += (x - k.x0) / w > nu ? (hash1(43, k.seed) < 0.5 ? st : -st) : 0;
  }
  const e = Math.min(x - k.x0, k.x1 - x), rc = Math.min(6, w * 0.15);
  if (e < rc) f -= rc - Math.sqrt(Math.max(0, rc * rc - (rc - e) * (rc - e)));
  return Math.max(k.top + 4, f);
}

/** Its left and right sides at local y (battered in a little toward the top, wobbling). */
export function chunkSides(k: LimeChunk, y: number): [number, number] {
  const H = Math.max(1, k.foot - k.top);
  const up = clamp((k.foot - y) / H, 0, 1);
  const bat = Math.min(3, (k.x1 - k.x0) * 0.06);
  return [k.x0 + bat * up + wob(y, k.seed + 7) * 0.9, k.x1 - bat * up * 0.6 + wob(y, k.seed + 11) * 0.9];
}

/** Is local (x, y) inside the chunk? */
export function inChunk(k: LimeChunk, x: number, y: number): boolean {
  if (y > chunkFoot(k, x)) return false;
  const [a, b] = chunkSides(k, y);
  return x >= a && x <= b && y >= chunkTop(k, x);
}

/** Paints a chunk; `casters` are nearer chunks whose shadow falls on it (down and to the right). */
export function limeChunk(c: PaintCtx, k: LimeChunk, casters: LimeChunk[] = []): void {
  const b = c.buf;
  const X0 = Math.max(b.ox, Math.floor(c.X(k.x0 - 5))), X1 = Math.min(b.x1, Math.ceil(c.X(k.x1 + 5)));
  const ty = k.topAt ? Math.min(k.topAt(k.x0), k.topAt((k.x0 + k.x1) / 2), k.topAt(k.x1)) - 8 : Math.min(k.top, k.top + (k.tilt ?? 0) * (k.x1 - k.x0)) - 4;
  const Y0 = Math.max(b.oy, Math.floor(c.Y(ty))), Y1 = Math.min(b.y1, Math.ceil(c.Y(k.foot + 11)));
  if (X0 >= X1 || Y0 >= Y1) return;
  const w = Math.max(1, k.x1 - k.x0);
  const cap = k.cap ?? 0;
  const s0 = k.seed;
  // cracks where water runs down from its top: one or two, wobbling, each its own length
  const nCr = w > 18 ? 1 + (hash1(1, s0) < 0.55 ? 1 : 0) : 0;
  // a bedding split across a tall block, part of the way
  const bedY = hash1(2, s0) < 0.6 ? 0.35 + 0.3 * hash1(3, s0) : -1;
  for (let y = Y0; y < Y1; y++) {
    const ly = LYc(c, y);
    const [sa, sb] = chunkSides(k, ly);
    for (let x = X0; x < X1; x++) {
      const lx = LXc(c, x);
      if (lx < sa || lx > sb) continue;
      const T = chunkTop(k, lx), F = chunkFoot(k, lx);
      if (ly < T || ly > F) continue;
      const s = ly - T, H = Math.max(1, (k.water ?? k.foot) - T);
      const u = (lx - sa) / Math.max(1, sb - sa);
      // under the water: dark and wet (the lake covers most of it)
      if (k.water !== undefined && ly > k.water + 0.5) { b.set(x, y, P.karst[8]!); continue; }
      // (round 4: the bright line where it meets the water broken into runs, a quiet step, never a
      // ruled cyan line under every block)
      // (round 5: quieter still, runs of it only, a step darker: long cyan dashes read as ruled lines)
      if (k.water !== undefined && ly > k.water - 0.5) { b.set(x, y, u > 0.08 && u < 0.92 && vnoise1(lx / 3.2, s0 + 19) > 0.62 ? (u < 0.5 ? P.jade[3]! : P.jade[5]!) : P.karst[8]!); continue; }
      // the moss on its top ledge: a lit top row, the body, a ragged hem hanging over the stone
      const hem = cap > 0 ? cap * (0.55 + 0.7 * vnoise1(lx / 5, s0 + 13)) + (vnoise1(lx / 1.8, s0 + 14) > 0.72 ? 1.8 : 0) : 0;
      if (s < hem) { b.set(x, y, s < 1 ? (u < 0.55 ? P.moss[2]! : P.moss[3]!) : s > hem - 1 ? P.moss[6]! : u > 0.7 ? P.moss[5]! : P.moss[4]!); continue; }
      // its edges: a dark crevice down its right side and along its foot where it meets the next
      if (sb - lx < 0.9 || (k.water === undefined && F - ly < 0.9)) { b.set(x, y, P.karst[8 - Math.round((k.haze ?? 0) * 4)]!); continue; }
      // (the sun stands beyond the lake: a face toward us is in its own shade, its top and its
      // upper-left rim catch the light)
      let t = 0.7 - 0.3 * k.z + (k.shade ?? 0);
      // the shadow under the moss, then the stone's rim (or its bare top) catching the sun
      if (cap > 0 && s < hem + 1.2) t += 0.16;
      else if (s < hem + (cap > 0 ? 2.6 : 1.6)) t -= 0.38;
      // its lit left flank and the right side turning into shade
      if (u < 0.1) t -= 0.2;
      else if (u < 0.2) t -= 0.08;
      else t += 0.24 * Math.pow(clamp((u - 0.5) / 0.5, 0, 1), 1.2);
      // darker toward its foot; the wet zone over the water dark with a film of algae
      t += 0.16 * clamp((s - H * 0.45) / (H * 0.55), 0, 1);
      if (k.water !== undefined) {
        const wetH = 2.5 + 4 * vnoise1(lx / 6, s0 + 15);
        if (k.water - ly < wetH) {
          if (k.water - ly > wetH - 1.4 && vnoise1(lx / 2.5, s0 + 16) > 0.45) { b.set(x, y, P.moss[6]!); continue; }
          t = Math.max(t + 0.3, 0.84);
        }
      }
      // a fracture down the block: the part beyond it turned a little away from the sun
      if (w > 20) {
        const fu = 0.38 + 0.34 * hash1(34, s0) + (s / Math.max(1, H)) * (hash1(35, s0) - 0.5) * 0.25;
        if (Math.abs(u - fu) < 0.5 / Math.max(1, sb - sa)) t = Math.max(t + 0.3, 0.82);
        else if (u > fu) t += 0.1;
      }
      // the stone's own surface: long stains running down from its top, a cluster of pits
      if (vnoise(lx / 3.4 + s0 * 0.01, ly / 22, s0 + 17) > 0.66) t += 0.1;
      if (vnoise(lx / 2.2, ly / 2.2, s0 + 18) > 0.8 && s > hem + 2) t += 0.18;
      // cracks: a dark line with the light catching its left lip, narrowing to its end
      for (let i = 0; i < nCr; i++) {
        const cx = k.x0 + w * (0.22 + 0.56 * hash1(10 + i, s0)) + wob(ly * 1.3, s0 + 20 + i) * 0.8;
        const cl = H * (0.3 + 0.6 * hash1(12 + i, s0));
        if (s > hem && s < cl) {
          if (Math.abs(lx - cx) < 0.55) t = Math.max(t + 0.34, 0.82);
          else if (lx - cx > -1.6 && lx - cx < -0.5) t -= 0.1;
        }
      }
      if (bedY > 0 && H > 14) {
        const by = T + H * bedY + wob(lx * 0.8, s0 + 25) * 0.6;
        if (Math.abs(ly - by) < 0.55 && u > 0.08 + 0.3 * hash1(4, s0) && u < 0.95) t = Math.max(t + 0.3, 0.8);
        else if (ly - by > 0.5 && ly - by < 1.6 && u < 0.9) t -= 0.08;
      }
      // a nearer chunk's shadow on it, down and to the right
      for (const q of casters) if (!inChunk(q, lx, ly) && inChunk(q, lx - 4, ly - 3)) { t = Math.max(t + 0.3, 0.8); break; }
      const hz = k.haze ?? 0;
      b.set(x, y, tone(P.karst, clamp((0.12 + t * 0.85) * (1 - hz * 0.55), 0, 1), x, y, 0));
    }
  }
}

function LXc(c: PaintCtx, x: number): number {
  return c.d > 1 ? c.lx((Math.floor((x + 0.5) / c.d) + 0.5) * c.d) : c.lx(x + 0.5);
}
function LYc(c: PaintCtx, y: number): number {
  return c.d > 1 ? c.ly((Math.floor((y + 0.5) / c.d) + 0.5) * c.d) : c.ly(y + 0.5);
}
