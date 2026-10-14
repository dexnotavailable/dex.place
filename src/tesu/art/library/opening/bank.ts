// Kagami's near shore (P5, the near-front plane) and the catch's near shallows (the front plane):
// what stands in the water nearest the camera.
//
// Since the lake runs on to the bottom edge of every frame, the near shore is no ground at the
// camera's feet: it is a few separate masses standing in mirror water, with nothing painted between
// them (the lake shows there). Per frame one dominant dark mass in one bottom corner, a smaller one
// of another kind in the other, and a few small accents at irregular gaps (reference 4's grassy rise
// in its corner, g3's pieces in water). The kinds, all different:
// - limestone, built from chunks (Dex's sketch): bedded blocks of very different sizes overlapping
//   at different depths, stepping into an irregular skyline, green only as a cap on each top ledge,
//   lit on the left, a shadow core on the right, a cast shadow where one chunk stands before
//   another, grooves only where water runs down a face, rubble and grass at the foot: a "shelf"
//   stepping down into the water, an "outcrop" standing in it;
// - grass: a "rise" (or a smaller "knoll") of tussocks, each a fountain of blades lit on its top
//   left, dark under its own overhang, a dead twig breaking the crown, an earth flank with mud
//   shelves stepping into the water, stones at its foot;
// - mud: a reed bed's low "reeds" bank (the reeds themselves are op.reeds sprites) and a "mud"
//   bank of roots and sedge;
// - small accents: a driftwood "snag", a lily-pad bed ("pads"), a half-sunk "stone".
// Every mass meets the water the way g3 shows: a dark wet band, a broken 1 px bright waterline, and
// its own reflection painted under that line (P5 and the front plane are drawn after the lake, so
// nothing mirrors them): the same strokes mirrored about the contact, a step darker and lower in
// contrast, matched to the lake's mirror tint, broken by ripples into runs and fading downward. A
// mass may instead run off the bottom of the frame (a bank coming toward the camera).
// One density at every level: at the close band (level 2) every feature is drawn in whole level-1
// px (2 x 2 art px), dither included. Light from the one sun, up and to the left.
//
// Anchor: P5's (or the shallows') waterline at the shore's left end. Sizes in level-1 px.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P, paletteRGBA } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

export type MassKind =
  | "shelf" | "outcrop" | "rise" | "knoll" | "reeds" | "mud" | "snag" | "pads" | "stone"
  // (the round-2 names, still painted: a hummock is a rise, a boulder an outcrop, a crag a shelf,
  // a tuft a small knoll, a lantern a stone lantern on a knoll)
  | "boulder" | "hummock" | "lantern" | "crag" | "tuft";

export interface MassSpec {
  kind: MassKind;
  /** Left end along the shore and width, px. */
  x: number;
  w: number;
  /** Height of the mass's body above its waterline, px (a lantern: the lantern's height). */
  h: number;
  /** A shelf's (or crag's) tall end: -1 its right end is tall and it steps down to the left, 1 the
   *  reverse (default 1). */
  drop?: -1 | 1;
  /** Reed beds: height of the tallest reeds (the op.reeds sprites), px (default 2.2 x h + 40). */
  reed?: number;
  /** Reed beds: reeds per 10 px (default 3). */
  dense?: number;
  /** A lantern's tilt or a snag's lean, radians (positive leans right). */
  lean?: number;
  /** Where its crown sits across its width, 0..1 (default from its seed). */
  peak?: number;
  /** Its foot stands this far nearer the camera than the shore's waterline, px (default 0). */
  foot?: number;
  /** A second crown along a long rise: [its place across the width 0..1, its height share 0..1]. */
  crown?: [number, number];
  /** Share of it (from its tall end) that runs off the bottom of the frame as a bank, 0..1 (0: it
   *  stands in the water whole and mirrors; 1: all of it runs off the bottom, no water at its foot). */
  bank?: number;
  /** A bank's inner edge: how far it recedes toward its outer side by the bottom, 0..1 (default 0.4;
   *  1 closes it to a point, for a plane whose bottom is not the frame's). */
  taper?: number;
  /** Limestone: how many chunks (default from its kind and width). */
  n?: number;
  /** A dead twig breaking a rise's or knoll's crown (default true for a rise). */
  twig?: boolean;
  /** A half-sunk stone by a reed bed or a mud bank. */
  stone?: boolean;
  /** (round 5) A snag lying half sunk in the shallows: no mud bar under it. */
  sunk?: boolean;
  /**
   * (round 6, the critic's near framing, E8) Painted only on plates of a density in [min, max]: the
   * plane's level picks out the camera's band, so a mass can frame only the pull-back (level 2,
   * zoom 1 to 1.6), only the play frames (level 1) or only the vista (level 0.43, zoom 0.5)
   * without standing in the frames between. Unset: every level.
   */
  levels?: [number, number];
  /** (round 6) A rise whose flank is grown over all the way down (no bare earth or mud shelves showing). */
  closed?: boolean;
}

export interface BankP {
  /** Length along the shore and how far below the waterline it may paint (reflections, banks), px. */
  w: number;
  h: number;
  /** Generated shores (no `masses`): the ends finish in limestone running off the bottom. */
  endR?: number;
  startR?: number;
  /** Generated shores: share of masses that are reed beds, 0..1 (default 0.45). */
  reeds?: number;
  /** Authored masses (the frames' composition), in paint order (back to front where they overlap). */
  masses?: MassSpec[];
  /** (round 2, the near ground; no longer used: there is no ground between the masses) */
  fall?: number;
  low?: number;
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

/** Something that puts one level-1 px: straight onto the plane, or mirrored into a reflection. */
type Pen = (lx: number, ly: number, col: number) => void;

/** A stroke of `width` level-1 px along a path of points, through a pen. */
function strokeP(pen: Pen, d: number, pts: [number, number][], width: (u: number) => number, col: (u: number, side: number) => number): void {
  const step = Math.min(0.5, 0.5 / Math.max(d, 0.5));
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!;
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.ceil(len / step));
    const nx = -(by - ay) / Math.max(1e-6, len), ny = (bx - ax) / Math.max(1e-6, len);
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = (k + t) / (pts.length - 1);
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const w = width(u);
      if (w <= 1.05) { pen(x, y, col(u, 0)); continue; }
      for (let o = -w / 2 + 0.5; o <= w / 2 - 0.49; o += 0.5) pen(x + nx * o, y + ny * o, col(u, o / (w / 2)));
    }
  }
}

/** A stroke of `width` level-1 px along a path of points (local). */
export function stroke(c: PaintCtx, pts: [number, number][], width: (u: number) => number, col: (u: number, side: number) => number): void {
  strokeP((x, y, k) => dot(c, x, y, k), c.d, pts, width, col);
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
  grassP((px, py, k) => dot(c, px, py, k), c.d, x, y, len, a0, bend, lit, wide);
}
function grassP(pen: Pen, d: number, x: number, y: number, len: number, a0: number, bend: number, lit: number, wide = false): void {
  const pts = bladePath(x, y, len, a0, bend);
  const facing = a0 + bend * 0.5 < 0.15;
  strokeP(pen, d, pts, (u) => (wide && u < 0.45 ? 2 : 1), (u) => {
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

/** The bank's deep shade: dark, quieter with depth, big soft shapes (kept for other painters). */
export function deepCol(lx: number, ly: number, x: number, y: number, seed: number): number {
  const blob = vnoise(lx / 44, ly / 30, seed + 9) * 0.65 + vnoise(lx / 16, ly / 12, seed + 10) * 0.35;
  const t = clamp(0.6 + clamp(ly / 60, 0, 1) * 0.4 + (blob - 0.5) * 0.3, 0, 1);
  return tone(P.pine, 0.55 + t * 0.45, x, y, 0.2);
}

/** Ordered dither on whole level-1 cells (one density at the close band). */
function dith(c: PaintCtx, x: number, y: number): number {
  return c.d > 1 ? bayer4(Math.floor((x + 0.5) / c.d), Math.floor((y + 0.5) / c.d)) : bayer4(x, y);
}

/** A ramp step for t (0 light .. 1 dark), dithered only on a thin seam between two steps. */
function step(c: PaintCtx, ramp: readonly number[], t: number, x: number, y: number, band = 0.22): number {
  const n = ramp.length;
  const pos = clamp(t, 0, 1) * (n - 1);
  let i = Math.floor(pos);
  const f = pos - i;
  const lo = 0.5 - band / 2;
  const k = (f - lo) / band;
  if (k >= 1 || (k > 0 && dith(c, x, y) < k)) i++;
  return ramp[clamp(i, 0, n - 1)]!;
}

// ---------------------------------------------------------------------------
// reflections: what the lake would show of a thing standing in it, matched to its mirror

const PAL = paletteRGBA();
const rgbOf = (i: number): [number, number, number] => [PAL[i * 4]!, PAL[i * 4 + 1]!, PAL[i * 4 + 2]!];
/** The plane ink (render/planes.ts), the lake's mirror tint and deep (kagami-backdrop.ts), and the
 *  near water as it reads on screen (the deep carrying the sky). */
const INK = [27, 25, 34];
const MIRROR = [0.58, 0.76, 0.75];
// (round-3 integration: p1's glassier lake, deep #528995 and the near water as it now reads on
// screen, so the painted reflections stay one step under the lake instead of two)
const DEEP = [82, 137, 149];
// (round 5: the near water as it now reads at play zoom, so a fading reflection stays a step under it
// instead of turning into a paler green block)
// (round 6: the sky lane's near water darkens and cools toward the camera, about [62, 115, 142] at
// the bottom rows; reflections fade toward it, so a long one no longer reads a step lighter than
// the water round it)
const NEAR = [66, 120, 146];
// (round 5: no umber and no roof-tile blue-greys among them: a rise's earth mirrored as red-brown
// ovals, the limestone as a lavender block)
const REFL = [
  ...P.jade.slice(2), ...P.pine, ...P.moss.slice(3), ...P.karst.slice(4), ...P.earth.slice(4),
  ...P.range.slice(4), ...P.timber.slice(3),
] as number[];
const reflMemo = new Map<number, number>();

/**
 * The colour a reflection paints for a thing of colour `col` (a palette index): as the lake would
 * mirror it on screen (the thing as it reads after its plane's ink, times the mirror tint, over the
 * deep), a step darker, `f` (0..3) steps further toward the near water as it fades; painted so that
 * after the plane's own ink (`ink`) it reads as that.
 */
export function reflOf(col: number, f: number, ink: number): number {
  const key = col * 64 + f * 16 + Math.round(ink * 10);
  const hit = reflMemo.get(key);
  if (hit !== undefined) return hit;
  const c = rgbOf(col);
  const k = [0.1, 0.22, 0.34, 0.46][clamp(f, 0, 3)]!;
  const want: number[] = [];
  for (let i = 0; i < 3; i++) {
    const seen = c[i]! * (1 - 0.3) + INK[i]! * 0.3;
    const mirrored = (0.16 * DEEP[i]! + 0.84 * seen * MIRROR[i]!) * 0.86;
    const t = mirrored * (1 - k) + NEAR[i]! * k;
    want.push((t - ink * INK[i]!) / (1 - ink));
  }
  let best = REFL[0]!, bd = Infinity;
  for (const q of REFL) {
    const r = rgbOf(q);
    const dr = r[0] - want[0]!, dg = r[1] - want[1]!, db = r[2] - want[2]!;
    const e = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (e < bd) { bd = e; best = q; }
  }
  reflMemo.set(key, best);
  return best;
}

/**
 * The bright line where a thing meets the water, as it reads on screen whatever its plane's ink:
 * the near water's own glassy blue a step lighter (never the jade's saturated cyan, which read
 * as an outline on the front plane), lighter on the sun side. Set per paint (paintBodies).
 */
let lineInk = 0;
const LINE = [...P.jade, ...P.range, ...P.cloud, ...P.karst.slice(2, 6)] as number[];
const lineMemo = new Map<number, number>();
function lineCol(lit: boolean): number {
  const key = (lit ? 1 : 0) + Math.round(lineInk * 100) * 2;
  const hit = lineMemo.get(key);
  if (hit !== undefined) return hit;
  // (between a dark mass and its dark reflection a pale line stands out hard: keep it a quiet step)
  const want = lit ? [132, 172, 176] : [112, 156, 162];
  let best = LINE[0]!, bd = Infinity;
  for (const q of LINE) {
    const r = rgbOf(q);
    const seen = r.map((v, i) => v * (1 - lineInk) + INK[i]! * lineInk);
    const e = 2 * (seen[0]! - want[0]!) ** 2 + 4 * (seen[1]! - want[1]!) ** 2 + 3 * (seen[2]! - want[2]!) ** 2;
    if (e < bd) { bd = e; best = q; }
  }
  lineMemo.set(key, best);
  return best;
}
/** The bright line's two colours on a plane of ink `ink` (lit, shaded): for tests. */
export function waterlineCols(ink: number): [number, number] {
  const was = lineInk;
  lineInk = ink;
  const out: [number, number] = [lineCol(true), lineCol(false)];
  lineInk = was;
  return out;
}

/** A reflection's waterline, length and ripples. */
interface Ripple {
  wl: number;
  len: number;
  seed: number;
  ink: number;
}

/**
 * The ripples breaking a reflection at lx, s px under its waterline: the row's sideways shift (whole
 * level-1 px, growing downward), or NaN where the water shows through (a whole ripple line facing
 * the sky now and then; runs of different lengths missing, more of them further down).
 */
function ripple(R: Ripple, lx: number, s: number): number {
  if (s < 0) return NaN;
  // (round 5, the critic: "scanline reflections") one soft mirrored copy: the rows sway together
  // in a slow wave that grows downward; two or three thin ripple lines of water cross it, each
  // broken into long runs; past the middle of its length it thins out by an ordered dither into
  // the water, never into dashes
  const fade = clamp(s / R.len, 0, 1.3);
  const row = Math.floor(s);
  for (let k = 0; k < 3; k++) {
    if (k === 2 && hash1(5, R.seed + 70) < 0.4) break;
    const ry = Math.floor(R.len * (0.2 + 0.24 * k + 0.08 * hash1(k, R.seed + 71)));
    if (row !== ry || ry < 3) continue;
    const L = 26 + 40 * hash1(k, R.seed + 72);
    const si = Math.floor((lx + L * hash1(k, R.seed + 73)) / L);
    if (hash(si, k, R.seed + 74) < 0.62) return NaN;
  }
  if (fade > 0.38 && bayer4(Math.floor(lx), row) < (fade - 0.38) * 1.5) return NaN;
  const amp = Math.min(1.6, 0.15 + s / 22);
  return Math.round((vnoise1(s / 6.5, R.seed + 75) - 0.5) * 2 * amp);
}
// (round 4: it fades toward the water faster, so where a mass's mirrored top ends there is little
// left to end: no hard window of water in a long reflection)
const fadeOf = (R: Ripple, s: number): number => Math.min(3, Math.floor(clamp(s / (R.len * 0.62), 0, 1) * 3.6));

/** A pen that puts what it is given mirrored about the waterline, through the ripples. */
function mirrorPen(c: PaintCtx, R: Ripple): Pen {
  return (lx, ly, col) => {
    const s = R.wl - ly;
    if (s < 0) return;
    const sh = ripple(R, lx, s);
    if (Number.isNaN(sh)) return;
    dot(c, lx + sh, R.wl + s, reflOf(col, fadeOf(R, s), R.ink));
  };
}

/**
 * For a sprite standing in water the lake does not mirror (P5, the front plane): a pen that puts
 * each px it is given mirrored about local y `wl`, a step darker and matched to the lake's mirror,
 * broken by ripples and fading over `len` px; `ink` is its plane's ink.
 */
export function reflectionPen(c: PaintCtx, wl: number, len: number, seed: number, ink: number): (lx: number, ly: number, col: number) => void {
  return mirrorPen(c, { wl, len: Math.max(6, len), seed, ink });
}

// ---------------------------------------------------------------------------
// the parts of a mass

/** One part of a mass: a fill (a colour per point, 0 outside) and strokes on top. */
interface Part {
  /** Local box of what it paints above its waterline: x0, y0, x1, y1. */
  box: [number, number, number, number];
  /** Its waterline (local y): it stands in the water there and mirrors about it; Infinity: it runs
   *  off the bottom (no water at its foot, nothing to mirror). */
  wl: number;
  fill?: (c: PaintCtx, lx: number, ly: number, x: number, y: number) => number;
  dress?: (pen: Pen, d: number) => void;
  /** No bright line where it meets the water (a part that only lies on another). */
  noLine?: boolean;
  /** Not mirrored (it lies on the water, or another part mirrors for it). */
  noRefl?: boolean;
  /** Only mirrored (another part paints it). */
  noPaint?: boolean;
  /** Its waterline per column where it wanders (a foot of mud shelves at different depths); `wl` is
   *  then its farthest (highest) row. */
  wlAt?: (lx: number) => number;
  /** A lily-pad bed (paints itself, its sedge mirrored blade by blade). */
  pads?: PadSpec;
  /** A stone lantern standing on it. */
  lantern?: { x: number; y: number; H: number; lean: number; seed: number };
}

interface Body {
  parts: Part[];
  seed: number;
  /** Its reflection's length, px. */
  len: number;
  /** Local box of everything it paints, reflection included. */
  box: [number, number, number, number];
  /** The body's top per px from floor(box[0]) (height above the shore's waterline; -1e9: none). */
  tops: Float32Array;
  spec: MassSpec;
}

// --- limestone chunks

/** A block of bedded limestone, side-on: a hand-wobbly, roughly rectangular silhouette. */
interface Chunk {
  x0: number;
  x1: number;
  /** Local y of its top at x0, and of its bottom (Infinity: runs off the bottom of the frame). */
  top: number;
  bot: number;
  /** Its bottom is a waterline (it stands in the water there: a wet band and a bright line). */
  wet: boolean;
  /** The waterline it mirrors about (its own foot, or the foot of the block it sits on; Infinity none). */
  mw: number;
  /** Its top's slope (px per px), and how its sides lean (px right per px up). */
  tilt: number;
  lean: number;
  /** 0 standing forward (lit, lighter) .. 1 recessed (darker, cooler). */
  dep: number;
  /** Its green cap on the top ledge, 0 none .. 1 thick. */
  cap: number;
  /** Weathered corners, px. */
  r: number;
  seed: number;
  /** Solution grooves where water runs down its face: [place across 0..1, length share, width]. */
  grooves: [number, number, number][];
  /** Vertical joints across its face (shares 0..1) and each facet's turn (a value offset, the first lit). */
  joints: number[];
  turn: number[];
  /** A bedding seam across part of it: [depth share, from 0..1, to 0..1] (or null). */
  seam: [number, number, number] | null;
  /** A block running off the bottom with the lake against one side (-1 left, 1 right; 0 none):
   *  below `wfrom` that side is wet, the water lapping it in a broken bright line. */
  wside: number;
  wfrom: number;
  /** Quick reject box. */
  bx0: number;
  bx1: number;
}

function chunkTop(k: Chunk, lx: number): number {
  const s = k.seed;
  let t = k.top + k.tilt * (lx - k.x0) + (vnoise1(lx / 17, s + 1) - 0.5) * 3.4 + (vnoise1(lx / 5.3, s + 2) - 0.5) * 1.5 + (vnoise1(lx / 1.9, s + 3) - 0.5) * 0.7;
  // blocky chips out of the top edge here and there, never evenly spaced
  const w = lx + 6 * vnoise1(lx / 11, s + 4);
  const ci = Math.floor(w / (7 + 5 * hash1(2, s)));
  if (hash1(ci, s + 5) < 0.2) t += 1 + 3.5 * hash1(ci, s + 6);
  return t;
}

function chunkSide(k: Chunk, ly: number, side: number): number {
  const s = k.seed + (side > 0 ? 50 : 0);
  // a side breaks along the joints: short runs with a jog between them
  // (round 5: longer runs, smaller jogs: a sawtooth profile read as noise down a tall column)
  const jh = 14 + 16 * hash1(1, s);
  const j = Math.floor((ly + 4 * vnoise1(ly / 9, s + 7)) / jh);
  const jog = (hash1(j, s + 8) - 0.5) * 3.4;
  return (side < 0 ? k.x0 : k.x1) - k.lean * (ly - k.top) + side * ((vnoise1(ly / 14, s + 9) - 0.5) * 6 + (vnoise1(ly / 4.3, s + 10) - 0.5) * 1.8 + jog);
}

function inChunk(k: Chunk, lx: number, ly: number): boolean {
  if (ly >= k.bot || lx < k.bx0 || lx > k.bx1) return false;
  const yT = chunkTop(k, lx);
  if (ly < yT) return false;
  const xL = chunkSide(k, ly, -1), xR = chunkSide(k, ly, 1);
  if (lx < xL || lx > xR) return false;
  // weathered top corners
  const dy = ly - yT, r = k.r;
  if (dy < r) {
    const a = r - Math.min(lx - xL, xR - lx), b = r - dy;
    if (a > 0 && a * a + b * b > r * r) return false;
  }
  return true;
}

const ROCK = [P.karst[2]!, P.karst[3]!, P.karst[4]!, P.karst[5]!, P.karst[6]!, P.karst[7]!, P.pine[4]!, P.pine[5]!];
const CAP = [P.moss[2]!, P.moss[3]!, P.moss[4]!, P.moss[5]!, P.moss[6]!, P.moss[7]!];

/**
 * A chunk's colour (side-on, the sun up and to the left): a green cap on its top ledge dripping
 * over the lip in places, a broken lit lip and left edge, the face lit on the left going into a
 * shadow core on the right, a shadow under the cap's lip, the cast shadow of any chunk standing in
 * front of it (down and right), grooves where water runs, a bedding seam, the wet band at the water.
 */
function chunkCol(c: PaintCtx, ks: Chunk[], i: number, lx: number, ly: number, x: number, y: number): number {
  const k = ks[i]!;
  const sd = k.seed;
  const yT = chunkTop(k, lx), xL = chunkSide(k, ly, -1), xR = chunkSide(k, ly, 1);
  const s = ly - yT, w = Math.max(4, xR - xL), u = clamp((lx - xL) / w, 0, 1);
  const H = k.bot === Infinity ? 160 : Math.max(5, k.bot - k.top);
  if (k.wet) {
    const wd = k.bot - ly, wh = Math.min(H * 0.45, 2 + 3.6 * vnoise1(lx / 7, sd + 20));
    if (wd < wh) return wd > wh * 0.5 && vnoise1(lx / 3.2, sd + 21) > 0.58 ? P.moss[6]! : P.pine[5]!;
  }
  if (k.wside && ly > k.wfrom) {
    const de = k.wside < 0 ? lx - xL : xR - lx;
    if (de < 2 + 2.6 * vnoise1(ly / 6, sd + 28)) return vnoise1(ly / 2.6, sd + 29) > 0.66 ? P.moss[6]! : P.pine[5]!;
  }
  const drip = vnoise1(lx / 3.1, sd + 22);
  const capT = k.cap * (1.2 + 3.8 * vnoise1(lx / 13, sd + 23)) + (drip > 0.72 ? (drip - 0.72) * 34 * k.cap : 0);
  if (s < capT) {
    if (s < 1) return u < 0.45 ? P.moss[2]! : u < 0.85 ? P.moss[3]! : P.moss[4]!;
    return step(c, CAP, 0.12 + (s / Math.max(1, capT)) * 0.5 + u * 0.25 + k.dep * 0.2, x, y);
  }
  if (s < 1.05 && k.dep < 0.75) return u < 0.55 ? P.karst[2]! : P.karst[4]!;
  if (lx - xL < 1.05 && s < H * 0.8 && k.dep < 0.6 && vnoise1(ly / 6, sd + 24) > 0.35) return P.karst[3]!;
  let t = 0.27 + k.dep * 0.3 + u * 0.3 + clamp(s / 150, 0, 0.14) + (vnoise(lx / 8, ly / 46, sd + 25) - 0.5) * 0.08;
  // (round 5, the critic: "cinder-block faces: a rectangular crack grid on flat dithered grey")
  // limestone is bedded: beds of very different thicknesses (a thin one weathered back into a
  // shadowed band, a thick one standing proud), their planes wavy, running most of the way across
  // or dying out part way; the few vertical joints run straight down through several beds and stop
  // at one (never shifting at every bed, so no brick bond); long stains run down the face
  let bi = 0;
  const bedOf = (i: number): { thin: boolean; rec: boolean } => {
    const thin = hash1(i, sd + 82) < 0.36;
    return { thin, rec: hash1(i, sd + 87) < (thin ? 0.72 : 0.14) };
  };
  if (H > 22) {
    const sw = s + (vnoise1(lx / 19, sd + 80) - 0.5) * 4 + (vnoise1(lx / 5, sd + 81) - 0.5) * 1.1 + k.tilt * 0.5 * (lx - k.x0);
    let b0 = 0, yb = 3 + 9 * hash1(6, sd);
    while (yb <= sw && bi < 40) {
      b0 = yb;
      bi++;
      yb += bedOf(bi).thin ? 3 + 7 * hash1(bi, sd + 83) : 14 + 46 * hash1(bi, sd + 84) * hash1(bi, sd + 93);
    }
    if (bi > 0) {
      const me = bedOf(bi), up = bedOf(bi - 1);
      const full = hash1(bi, sd + 85) < 0.35;
      const ua = full ? -1 : 0.04 + 0.4 * hash1(bi, sd + 86), ub = full ? 2 : 0.5 + 0.48 * hash1(bi, sd + 88);
      const ds = sw - b0;
      if (u > ua && u < ub) {
        if (me.rec && !up.rec && ds < 2 + 2.5 * hash1(bi, sd + 89)) t += 0.34;
        else if (!me.rec && up.rec && ds < 1.3) t -= 0.2;
        else if (me.rec === up.rec && ds < 0.7) t += 0.28;
        else if (me.rec === up.rec && ds < 1.7) t -= 0.07;
      }
      if (me.rec) t += 0.12;
      else t += (hash1(bi, sd + 90) - 0.5) * 0.08;
      // its weathered front edge turning under into shade at the bed's foot
      if (yb - sw < 1.8 && !me.rec && bedOf(bi + 1).rec) t += 0.12;
    }
  }
  // its planes: which facet, a crack at each joint (through a run of beds) with a lit lip beyond it
  let fi = 0;
  for (let j = 0; j < k.joints.length; j++) {
    const jx = xL + w * clamp(k.joints[j]!, 0.08, 0.92) + (vnoise1(ly / 13, sd + 60 + j) - 0.5) * 2.4 + (vnoise1(ly / 3.1, sd + 64 + j) - 0.5) * 0.7;
    const dd = lx - jx;
    if (dd >= 0) fi = j + 1;
    const j0 = Math.floor(hash1(j, sd + 91) * 3), j1 = j0 + 2 + Math.floor(hash1(j, sd + 92) * 5);
    const shown = H <= 22 || (bi >= j0 && bi <= j1);
    if (Math.abs(dd) < 0.55 && s > 2 && shown) t += 0.38;
    else if (dd >= 0.55 && dd < 1.6 && s > 2 && shown) t -= 0.12;
  }
  t += (k.turn[fi] ?? 0) * 0.8;
  if (k.joints.length === 0 && u > 0.76 + (vnoise1(ly / 8, sd + 26) - 0.5) * 0.18) t += 0.18;
  // long stains running down the face from the ledges
  const st = vnoise(lx / 3.3 + sd * 0.013, ly / 40, sd + 95);
  if (st > 0.7) t += 0.1;
  else if (st < 0.2) t -= 0.05;
  // moss streaks hanging from the cap where water seeps over the lip
  const mc = Math.floor((lx + 3 * vnoise1(ly / 9, sd + 66)) / 3.5);
  if (k.cap > 0.3 && hash1(mc, sd + 67) < 0.12 && s < capT + 4 + 22 * hash1(mc, sd + 68)) return s < capT + 3 ? P.moss[5]! : P.moss[6]!;
  // pits and small solution hollows on the lit planes, in clusters
  if (fi === 0 && vnoise1(ly / 17 + lx / 23, sd + 69) > 0.62) {
    const ph = hash(Math.floor(lx / 2.2), Math.floor(ly / 2), sd + 70);
    if (ph < 0.06) return ph < 0.025 ? P.karst[7]! : P.karst[6]!;
  }
  if (s < capT + 1.5 + vnoise1(lx / 5, sd + 27) * 2.5) t += 0.17;
  // a nearer block's cast shadow on it (down and to the right), the darkest darks in the crevice
  // right at its edge
  for (let j = i + 1; j < ks.length; j++) {
    if (inChunk(ks[j]!, lx - 1, ly - 0.8)) { t += 0.7; break; }
    if (inChunk(ks[j]!, lx - 2.5, ly - 1.8)) { t += 0.4; break; }
    if (inChunk(ks[j]!, lx - 6, ly - 4.5)) { t += 0.2; break; }
  }
  for (let g = 0; g < k.grooves.length; g++) {
    const [gu, gl, gw] = k.grooves[g]!;
    const len = H * gl;
    if (s > len) continue;
    const gx = xL + w * gu + (vnoise1(ly / 8, sd + 30 + g) - 0.5) * 2.2 + s * 0.04 * (hash1(g, sd + 31) - 0.5);
    const wdt = gw * (1 - 0.6 * s / len);
    const dd = lx - gx;
    if (dd >= 0 && dd < Math.max(0.6, wdt)) { t += 0.36; break; }
    if (dd < 0 && dd > -1.3) t -= 0.12;
  }
  if (k.seam && u > k.seam[1] && u < k.seam[2]) {
    const sy = yT + H * k.seam[0] + (vnoise1(lx / 23, sd + 33) - 0.5) * 3;
    const dd = ly - sy;
    if (dd >= -0.6 && dd < 0.6) t += 0.34;
    else if (dd >= 0.6 && dd < 2.2) t -= 0.1;
  }
  return step(c, ROCK, t, x, y, 0.12);
}

/** A chunk, with its grooves and seam from its seed. */
function chunk(x0: number, x1: number, top: number, bot: number, dep: number, cap: number, seed: number, tilt = 0, lean = 0, mw?: number): Chunk {
  const r = rng(seed + 5);
  const H = bot === Infinity ? 140 : bot - top;
  const grooves: [number, number, number][] = [];
  const ng = H > 30 && dep < 0.65 ? Math.floor(r() * 3.2) : 0;
  for (let i = 0; i < ng; i++) grooves.push([0.18 + 0.66 * r(), 0.3 + 0.5 * r(), 1 + r() * 1.2]);
  const seam: [number, number, number] | null = H > 40 && r() < 0.7 ? [0.32 + 0.3 * r(), r() * 0.3, 0.45 + 0.5 * r()] : null;
  // the face breaks along a joint or two into planes turned a little differently: lit, then turning away
  const w = x1 - x0;
  const nj = w > 44 ? 1 + Math.floor(r() * 2.4) : w > 22 ? Math.floor(r() * 1.8) : 0;
  const joints: number[] = [];
  for (let i = 0; i < nj; i++) joints.push(0.22 + 0.62 * r());
  joints.sort((a, b) => a - b);
  const turn: number[] = [-0.12 - 0.08 * r()];
  for (let i = 0; i < nj; i++) turn.push(turn[i]! + 0.07 + 0.12 * r());
  const reach = Math.abs(lean) * (bot === Infinity ? 300 : H) + 10;
  const wet = mw === undefined && bot !== Infinity;
  return { x0, x1, top, bot, wet, mw: mw ?? bot, tilt, lean, dep, cap, r: 3 + Math.min(7, w * 0.09) * r(), seed, grooves, seam, joints, turn, wside: 0, wfrom: 0, bx0: x0 - reach, bx1: x1 + reach };
}

/** Limestone: what is in a chunk list at a point (the last one in the list stands in front). */
function rockFill(c: PaintCtx, ks: Chunk[], lx: number, ly: number, x: number, y: number, lines: boolean): number {
  for (let i = ks.length - 1; i >= 0; i--) if (inChunk(ks[i]!, lx, ly)) return chunkCol(c, ks, i, lx, ly, x, y);
  if (!lines) return 0;
  // the bright line where a block meets the water: 1 px, broken, brightest on the sun side
  const e1 = Math.max(1, 1 / c.d);
  for (const k of ks) {
    if (!k.wside || ly <= k.wfrom || ly >= k.bot || lx < k.bx0 - e1 || lx > k.bx1 + e1) continue;
    const xs = chunkSide(k, ly, k.wside);
    const out = k.wside < 0 ? xs - lx : lx - xs;
    // (the side the water laps is a wet dark edge: a bright line up a side reads as an outline)
    if (out > 0 && out <= e1 && inChunk(k, xs - k.wside * 0.6, ly) && vnoise1(ly / 3.4, k.seed + 41) > 0.5) return P.pine[5]!;
  }
  for (const k of ks) {
    if (!k.wet || ly < k.bot || ly >= k.bot + e1) continue;
    if (!inChunk(k, lx, k.bot - 0.7) || vnoise1(lx / 4.2, k.seed + 40) < 0.45) continue;
    return lineCol(lx - chunkSide(k, k.bot - 1, -1) < (k.x1 - k.x0) * 0.6);
  }
  return 0;
}

/** Grass on the capped ledges: clumps of blades of very different sizes, gaps between them. */
function capGrass(pen: Pen, d: number, ks: Chunk[], on: number, seed: number): void {
  if (on <= 0 || d < 0.2) return;
  for (const k of ks) {
    if (k.cap < 0.3) continue;
    const r = rng(k.seed + seed + 81);
    let cx = k.x0 + r() * 8;
    while (cx < k.x1 - 3) {
      const n = 2 + Math.floor(r() * 7 * on), big = 0.5 + r() * r() * 1.6;
      for (let i = 0; i < n; i++) {
        const x = cx + (r() - 0.5) * 7 * big;
        if (x < k.x0 + 1 || x > k.x1 - 1) continue;
        const len = (3 + r() * 10) * big, a0 = (r() - 0.45) * 1.1, bend = (r() - 0.4) * 1.3;
        const lit = (x - k.x0) / Math.max(1, k.x1 - k.x0) < 0.6 && k.dep < 0.6;
        hemBladeP(pen, d, x, chunkTop(k, x) + 1.5, len, a0, bend, lit ? 1 : r() < 0.3 ? 0.5 : 0);
      }
      cx += 6 + r() * r() * 46;
    }
  }
}

/**
 * Limestone as parts: one that paints all its chunks together (recessed first, so the forward ones
 * cast their shadows on them) with the bright lines at their feet, and one reflection per waterline
 * the chunks stand on.
 */
function rockParts(ks0: Chunk[], bladesOn: number, seed: number, deep: number): Part[] {
  const ks = [...ks0].sort((p, q) => q.dep - p.dep);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const k of ks) { x0 = Math.min(x0, k.bx0); x1 = Math.max(x1, k.bx1); y0 = Math.min(y0, k.top - 6); y1 = Math.max(y1, k.bot === Infinity ? deep : k.bot + 2); }
  const parts: Part[] = [{
    box: [x0, y0 - 16, x1, y1], wl: Infinity, noRefl: true,
    fill: (c, lx, ly, x, y) => rockFill(c, ks, lx, ly, x, y, true),
    dress: (pen, d) => capGrass(pen, d, ks, bladesOn, seed),
  }];
  const feet = [...new Set(ks.map((k) => k.mw).filter((f) => f !== Infinity))].sort((a, b) => a - b);
  for (const f of feet) {
    const sub = ks.filter((k) => k.mw === f);
    let a = Infinity, b = -Infinity, t = Infinity;
    for (const k of sub) { a = Math.min(a, k.bx0); b = Math.max(b, k.bx1); t = Math.min(t, k.top - 6); }
    parts.push({ box: [a, t - 16, b, f], wl: f, noPaint: true, fill: (c, lx, ly, x, y) => rockFill(c, sub, lx, ly, x, y, false), dress: (pen, d) => capGrass(pen, d, sub, bladesOn, seed) });
  }
  return parts;
}

/** A blade of a grass hem along a ledge: dark at its foot, its tip catching the sun warm. */
function hemBladeP(pen: Pen, d: number, x: number, y: number, len: number, a0: number, bend: number, sun: number): void {
  strokeP(pen, d, bladePath(x, y, len, a0, bend), (u) => (len > 14 && u < 0.3 ? 2 : 1), (u) => {
    if (u > 0.68) return sun >= 1 ? P.moss[2]! : sun > 0 ? P.moss[3]! : P.moss[5]!;
    if (u > 0.4) return sun >= 1 ? P.moss[4]! : P.moss[5]!;
    return u > 0.18 ? P.moss[6]! : P.moss[7]!;
  });
}

/** Small stones of very different sizes, half sunk, standing nearer than the mass. */
function rubble(at: (u: number) => number, us: [number, number], n: number, wl: number, seed: number, deep: number): Part[] {
  const r = rng(seed);
  const out: Part[] = [];
  for (let i = 0; i < n; i++) {
    const u = us[0] + (us[1] - us[0]) * r(), sw = 3 + r() * r() * 14;
    const foot = wl + 2 + r() * 16;
    const k = chunk(at(u) - sw / 2, at(u) + sw / 2, foot - (2 + sw * (0.3 + 0.3 * r())), foot, 0.04, r() < 0.45 ? 0.7 : 0, seed + 10 + i * 7, (r() - 0.5) * 0.3);
    out.push(...rockParts([k], 0, k.seed, deep));
  }
  return out;
}

// --- grass tussocks

/** A tussock: a fountain of blades from a low dark base. */
interface Tuft {
  x: number;
  /** Local y of its foot. */
  y: number;
  rx: number;
  ry: number;
  /** 0..1: how much sun it takes; 0..1: how far it sinks into shade. */
  lit: number;
  dark: number;
  seed: number;
}

function inTuft(t: Tuft, lx: number, ly: number): boolean {
  if (ly > t.y + 0.5) return false;
  const dx = (lx - t.x) / t.rx, dy = (ly - (t.y - t.ry * 0.42)) / (t.ry * 0.6);
  return dx * dx + dy * dy < 1 + (vnoise1(lx / 4.5, t.seed) - 0.5) * 0.4 + (vnoise1(lx / 1.7, t.seed + 1) - 0.5) * 0.12;
}

const BASE = [P.moss[4]!, P.moss[5]!, P.moss[6]!, P.moss[7]!, P.pine[4]!, P.pine[5]!];
function tuftCol(c: PaintCtx, t: Tuft, lx: number, ly: number, x: number, y: number): number {
  const v = clamp((ly - (t.y - t.ry)) / t.ry, 0, 1);
  const dx = (lx - t.x) / t.rx;
  return step(c, BASE, 0.18 + v * 0.62 + t.dark * 0.5 - t.lit * 0.14 + Math.max(0, dx) * 0.14, x, y);
}

/** Lit to dark, for blades: the warm sunlit tip to the shade at the foot. */
const BLADE = [P.moss[0]!, P.moss[1]!, P.moss[2]!, P.moss[3]!, P.moss[4]!, P.moss[5]!, P.moss[6]!, P.moss[7]!, P.pine[4]!];

/** A tussock's blades: they rise from its foot and arch outward, lit on their tips on the sun side. */
function tuftBlades(pen: Pen, d: number, t: Tuft, warm: boolean): void {
  if (d < 0.2) return;
  const n = Math.round(5 + t.rx * 2.3 * Math.min(1, d * 1.5));
  const bl: { pts: [number, number][]; L: number; w: number }[] = [];
  for (let i = 0; i < n; i++) {
    const s = t.seed + i * 13;
    const out = hash1(1, s) - 0.5;
    const rx = t.x + out * t.rx * 1.15, ry = t.y - t.ry * (0.05 + 0.35 * hash1(2, s)) * (1 - Math.abs(out) * 1.3);
    const a0 = out * 2.1 + (hash1(3, s) - 0.5) * 0.55;
    const len = t.ry * (0.85 + 0.85 * hash1(4, s)) * (1 - 0.22 * Math.abs(a0));
    const bend = (a0 >= 0 ? 1 : -1) * (0.3 + 1.2 * hash1(5, s)) * (0.4 + Math.abs(a0));
    const pts = bladePath(rx, ry, len, a0, bend);
    const tip = pts[pts.length - 1]!;
    const droop = tip[1] > ry - len * 0.25;
    const L = t.lit * (0.62 + 0.38 * (0.5 - out)) * (droop ? 0.5 : 1) - t.dark * 0.85 + (hash1(6, s) - 0.5) * 0.2;
    bl.push({ pts, L, w: len > 20 ? 2 : 1 });
  }
  bl.sort((a, b) => a.L - b.L);
  bl.forEach((b, i) => {
    const tipI = b.L > 0.84 ? 1 : b.L > 0.64 ? 2 : b.L > 0.44 ? 3 : b.L > 0.26 ? 4 : b.L > 0.1 ? 5 : 6;
    const sunRim = warm && b.L > 0.86 && hash1(i, t.seed + 7) < 0.35;
    strokeP(pen, d, b.pts, (u) => (b.w > 1 && u < 0.3 ? 2 : 1), (u) => {
      if (u > 0.74) return sunRim && u > 0.88 ? (hash1(i, t.seed + 8) < 0.25 ? P.ember[1]! : P.moss[0]!) : BLADE[tipI]!;
      if (u > 0.42) return BLADE[Math.min(8, tipI + 1)]!;
      return BLADE[Math.min(8, tipI + 2 + (u < 0.15 ? 1 : 0))]!;
    });
  });
}

function tuftPart(t: Tuft, wl: number, warm: boolean): Part {
  return {
    box: [t.x - t.rx * 2.6, t.y - t.ry * 2.1, t.x + t.rx * 2.6, Math.min(wl, t.y + 1)],
    wl,
    noLine: wl - t.y > 2,
    fill: (c, lx, ly, x, y) => (inTuft(t, lx, ly) ? tuftCol(c, t, lx, ly, x, y) : 0),
    dress: (pen, d) => tuftBlades(pen, d, t, warm),
  };
}

// --- earth: the flank of a rise, a mud bank

/** Earth under a top line: lit where it faces the sun, mud shelves stepping down to the water. */
interface Earth {
  x0: number;
  x1: number;
  /** Its top (local y) at lx (Infinity: none there). */
  top: (lx: number) => number;
  /** Its farthest waterline (local y), and its foot per column (mud shelves at different depths). */
  bot: number;
  foot: (lx: number) => number;
  /** 0 dry earth .. 1 wet black mud. */
  wet: number;
  /** Heights of its mud shelves above its foot. */
  shelves: number[];
  seed: number;
}

/**
 * A foot that wanders in steps: runs of very different lengths, each its own depth (0 to `amp` px
 * nearer the camera than `f`), sloping from one to the next, so no waterline is ruled for long.
 */
function wanderFoot(f: number, amp: number, seed: number): (lx: number) => number {
  const L = [0, 0.22, 0.45, 0.7, 1];
  return (lx: number): number => {
    const w = lx + 40 * vnoise1(lx / 97, seed);
    const C = 46 + 30 * hash1(1, seed);
    const ci = Math.floor(w / C), fr = w / C - ci;
    const a = L[Math.floor(hash1(ci, seed + 1) * 5)]!, b = L[Math.floor(hash1(ci + 1, seed + 1) * 5)]!;
    const k = clamp((fr - 0.55) / 0.45, 0, 1);
    return f + amp * (a + (b - a) * k * k * (3 - 2 * k)) + (vnoise1(lx / 3.1, seed + 2) - 0.5) * 0.9;
  };
}

// (round-3 integration: a step lighter than p3's, which ended in near-black umber, so a mud bank
// reads as wet brown earth with its darkest darks only in the undercuts and the wet band, never
// as a black raft on the water)
const EARTH = [P.earth[3]!, P.earth[4]!, P.earth[5]!, P.umber[2]!, P.umber[3]!, P.umber[4]!, P.pine[5]!];

function earthCol(c: PaintCtx, e: Earth, lx: number, ly: number, x: number, y: number): number {
  if (lx < e.x0 || lx > e.x1 || ly < e.bot - 400) return 0;
  const F = e.foot(lx);
  if (ly >= F) return 0;
  const T = e.top(lx);
  if (ly < T) return 0;
  const s = ly - T, sd = e.seed, up = F - ly;
  if (up < 1.4 + 2.4 * vnoise1(lx / 6, sd + 1)) return vnoise1(lx / 2.6, sd + 2) > 0.66 ? P.moss[6]! : P.pine[5]!;
  const sl = e.top(lx + 2) - e.top(lx - 2);
  if (s < 1) return sl > 0.5 ? P.earth[3]! : P.earth[4]!;
  // under the grass that overhangs its top: deep shade, the grass's own dark (round 4: a brown
  // band here read as a stripe of mud across the rise)
  if (s < 5 + 4 * vnoise1(lx / 7, sd + 3)) return step(c, [P.moss[7]!, P.pine[4]!, P.pine[5]!], 0.25 + s * 0.08 + (vnoise(lx / 5, ly / 3, sd + 14) - 0.5) * 0.3, x, y);
  // (round 6, the critic's "red-brown mud slab": wet peat, a step darker, its mid browns only in
  // patches where it dries)
  let t = 0.52 + e.wet * 0.2 + (s < 6 + 4 * vnoise1(lx / 7, sd + 3) ? 0.3 : 0) + (vnoise(lx / 22, ly / 9, sd + 4) - 0.5) * 0.3;
  // mud shelves: a lit lip on each, a dark undercut under it, each wandering along
  for (const h of e.shelves) {
    // (round 4: short shelves that wander, never a stripe across the bank)
    const dd = ly - (F - h + (vnoise1(lx / 19, sd + 5 + Math.round(h)) - 0.5) * 7 + (vnoise1(lx / 6, sd + 15 + Math.round(h)) - 0.5) * 2.5);
    if (dd >= 0 && dd < 1.1 && vnoise1(lx / 11, sd + 6 + Math.round(h)) > 0.6) return sl > -0.6 && vnoise1(lx / 5, sd + 7) > 0.45 ? P.earth[3]! : P.earth[4]!;
    if (dd < 0 && dd > -2.4) t += 0.2;
  }
  // pebbles in the mud by the water, in clusters
  if (up < 12 && vnoise1(lx / 23, sd + 8) > 0.5) {
    const cx = Math.floor(lx / 5), cy = Math.floor(ly / 4);
    for (let i = -1; i <= 0; i++) for (let j = -1; j <= 0; j++) {
      const h = hash(cx + i, cy + j, sd + 9);
      if (h > 0.12) continue;
      const px = (cx + i + 0.5) * 5 + (h - 0.06) * 20, py = (cy + j + 0.5) * 4, pr = 1.2 + 16 * h;
      const dx = (lx - px) / (pr * 1.3), dy = (ly - py) / pr;
      if (dx * dx + dy * dy < 1) return dy < -0.3 && dx < 0.2 ? P.karst[4]! : dy > 0.4 ? P.karst[8]! : P.karst[6]!;
    }
  }
  // a root running across here and there
  const rt = Math.abs(ly - (T + 6 + 20 * vnoise1(lx / 31, sd + 10)) - (vnoise1(lx / 6, sd + 11) - 0.5) * 3);
  if (rt < 0.6 && vnoise1(lx / 17, sd + 12) > 0.55) return P.umber[4]!;
  return step(c, EARTH, t, x, y);
}

function earthPart(e: Earth): Part {
  let y0 = Infinity, y1 = e.bot;
  for (let x = e.x0; x <= e.x1; x += 2) { y0 = Math.min(y0, e.top(x)); y1 = Math.max(y1, e.foot(x)); }
  return { box: [e.x0, (y0 === Infinity ? e.bot : y0) - 2, e.x1, y1 + 1], wl: e.bot, wlAt: e.foot, fill: (c, lx, ly, x, y) => earthCol(c, e, lx, ly, x, y) };
}

// --- a dead twig, a driftwood snag

/** A dead twig: a kinked, tapering stem with two or three forks, every end a point. */
function twigStrokes(pen: Pen, d: number, x: number, y: number, H: number, lean: number, seed: number): void {
  const r = rng(seed);
  const col = (u: number, sd: number): number => (sd < -0.25 ? (u > 0.5 ? P.timber[1]! : P.timber[2]!) : u > 0.82 ? P.timber[3]! : sd < 0.4 ? P.timber[4]! : P.umber[2]!);
  const limb = (x0: number, y0: number, len: number, a: number, w0: number, depth: number): void => {
    const pts: [number, number][] = [[x0, y0]];
    const nk = 3 + Math.floor(r() * 2);
    let px = x0, py = y0, aa = a;
    for (let i = 0; i < nk; i++) {
      aa += (r() - 0.5) * 0.7;
      const l = (len / nk) * (0.7 + 0.6 * r());
      px += Math.sin(aa) * l;
      py -= Math.cos(aa) * l;
      pts.push([px, py]);
    }
    strokeP(pen, d, pts, (u) => Math.max(1, w0 * (1 - u * 0.85)), col);
    if (depth > 0) {
      const nf = 1 + Math.floor(r() * 2);
      for (let f = 0; f < nf; f++) {
        const k = Math.min(pts.length - 1, Math.floor((0.45 + 0.4 * r()) * (pts.length - 1)));
        const [fx, fy] = pts[k]!;
        limb(fx, fy, len * (0.3 + 0.25 * r()), aa + (r() < 0.5 ? -1 : 1) * (0.5 + 0.5 * r()), Math.max(1, w0 * 0.5), depth - 1);
      }
    }
  };
  limb(x, y, H, lean, 4, 2);
}

/** A driftwood snag: a root plate at the water, a trunk leaning up out of it, kinked, tapering, a broken limb. */
function snagStrokes(pen: Pen, d: number, x: number, wl: number, H: number, lean: number, seed: number): void {
  const r = rng(seed);
  // weathered driftwood: grain running along it in streaks, the lit side a pale timber, a knot
  // here and there, wet and dark at the water (never a smooth tube)
  const grain = (u: number, sd: number, k: number): number => hash1(Math.floor(sd * 3.2 + 4) * 31 + Math.floor(u * (14 + k)), seed + 3);
  const col = (u: number, sd: number): number => {
    if (u < 0.08) return sd < -0.3 ? P.timber[4]! : P.umber[3]!;
    const g = grain(u, sd, 0);
    if (g < 0.06) return P.umber[3]!;
    if (sd < -0.45) return g < 0.3 ? P.timber[2]! : u > 0.5 ? P.timber[1]! : P.timber[2]!;
    if (sd < 0.05) return g < 0.35 ? P.timber[4]! : P.timber[3]!;
    if (sd < 0.5) return g < 0.3 ? P.umber[1]! : P.timber[4]!;
    return P.umber[2]!;
  };
  const wT = Math.max(7, H * 0.2);
  // the root plate at the water: gnarled roots fanning out, some arching up out of the water
  for (let i = 0; i < 7; i++) {
    const a = -1.7 + 3.4 * (i / 6) + (r() - 0.5) * 0.5;
    const l = H * (0.14 + 0.18 * r());
    const pts = bladePath(x, wl - 4, l, a, (r() - 0.5) * 2.2);
    strokeP(pen, d, pts, (u) => Math.max(1, wT * 0.42 * (1 - u * 0.9)), (u, sd) => (u > 0.8 ? P.umber[2]! : col(0.3 + u * 0.4, sd)));
  }
  // the trunk: runs of different lengths with kinks where it broke and healed, tapering
  const pts: [number, number][] = [[x, wl - 3]];
  let px = x, py = wl - 3, a = lean;
  const n = 5;
  for (let i = 0; i < n; i++) {
    a += (r() - 0.5) * 0.9 - lean * 0.06;
    const l = (H / Math.max(0.4, Math.cos(Math.min(1.1, Math.abs(a))))) / n * (0.7 + 0.6 * r());
    px += Math.sin(a) * l;
    py = Math.max(wl - H, py - Math.cos(a) * l);
    pts.push([px, py]);
  }
  strokeP(pen, d, pts, (u) => Math.max(1.5, wT * (1 - u * 0.7) * (1 + 0.12 * Math.sin(u * 17 + seed))), col);
  // a broken limb off its back, and the snapped top in splinters
  const [mx, my] = pts[2]!;
  strokeP(pen, d, bladePath(mx, my, H * (0.18 + 0.1 * r()), a - 1.2 * Math.sign(lean || 1), -0.4), (u) => Math.max(1, wT * 0.38 * (1 - u)), col);
  const [ex, ey] = pts[pts.length - 1]!;
  for (let i = 0; i < 3; i++) strokeP(pen, d, bladePath(ex + (i - 1) * wT * 0.12, ey, 3 + r() * wT * 0.5, a + (i - 1) * 0.35, (r() - 0.5) * 0.4), (u) => Math.max(1, wT * 0.2 * (1 - u)), (_u, sd) => (sd < 0 ? P.timber[1]! : P.timber[3]!));
}

// --- lily pads and sedge

interface PadSpec { x0: number; w: number; wl: number; deep: number; sedge: number; seed: number; ink: number; n: number }

/** A bed of lily pads lying on the water (seen almost edge-on), a few sedge blades, a flower or two. */
function padStrokes(c: PaintCtx, p: PadSpec): void {
  const d = c.d;
  if (d < 0.2) return;
  const pen: Pen = (x, y, k) => dot(c, x, y, k);
  const r = rng(p.seed);
  // (round 4: lying at one waterline, a few of them, not a crowd)
  const n = Math.min(p.n, 3 + Math.round(p.w / 10));
  let gx = p.x0 + p.w * 0.5;
  for (let i = 0; i < n; i++) {
    // in drifts of three or four, then a jump
    if (i % 4 === 0) gx = p.x0 + p.w * (0.1 + 0.8 * r());
    // (round 4: the critic's "lily-pad ladder": pads float, so side-on they are thin slivers at
    // one waterline, overlapping in a drift, never lozenges stacked down the water)
    const v = r() * r();
    const py = p.wl + 1 + v * Math.min(5, (p.deep - p.wl) * 0.06);
    const rx = (3 + r() * 6) * (0.8 + 0.5 * v), th = Math.max(1, rx * 0.13);
    const px = clamp(gx + (r() - 0.5) * 22, p.x0, p.x0 + p.w);
    const notch = rx * (0.6 * r() - 0.3);
    for (let ox = -rx; ox <= rx; ox += 0.5) {
      if (Math.abs(ox - notch) < 0.6 && i % 3 !== 1) continue;
      const k = Math.sqrt(Math.max(0, 1 - (ox / rx) ** 2));
      for (let oy = -th * k; oy <= 0.01; oy += 0.5) pen(px + ox, py + oy, oy < -th * k + 0.6 ? (ox < rx * 0.1 ? P.moss[3]! : P.moss[4]!) : P.moss[5]!);
      // its dark rim on the water and a sliver of its reflection
      if (k > 0.3) pen(px + ox, py + 0.6, P.pine[3]!);
      if (k > 0.5 && hash1(Math.floor(px + ox), p.seed + 3) < 0.7) pen(px + ox, py + 1.4, reflOf(P.moss[4]!, 1, p.ink));
    }
    if (hash1(i, p.seed + 4) < 0.12) { pen(px + rx * 0.2, py - th - 1, P.paper[0]!); pen(px + rx * 0.2 + 1, py - th - 1, P.blossom[1]!); pen(px + rx * 0.2 + 0.5, py - th - 1.6, P.paper[1]!); }
  }
  // the sedge: a few blades from among the pads, each mirrored where it stands
  for (let i = 0; i < p.sedge; i++) {
    // (they stand among the nearer pads, never rising above the bed's own far row)
    const sx = p.x0 + p.w * (0.15 + 0.7 * r()), sy = p.wl + 12 + r() * (p.deep - p.wl - 12) * 0.5;
    const len = Math.min(8 + r() * 16, sy - p.wl - 3), a0 = (r() - 0.5) * 0.7, bend = (r() - 0.5) * 0.9, lit = r();
    grassP(mirrorPen(c, { wl: sy, len: len * 1.4, seed: p.seed + i * 7, ink: p.ink }), d, sx, sy, len, a0, bend, lit * 0.5);
    grassP(pen, d, sx, sy, len, a0, bend, lit);
  }
}

// ---------------------------------------------------------------------------
// the masses, by kind

/** An envelope at three scales over [x0, x0 + w]: a crown, a shoulder, lumps, grit; never a dome. */
function envelope(x0: number, w: number, h: number, peak: number, seed: number, rough = 1): (lx: number) => number {
  const sh = 0.45 + 0.25 * hash1(1, seed), shU = peak < 0.5 ? 0.62 + 0.15 * hash1(2, seed) : 0.2 + 0.15 * hash1(2, seed);
  return (lx: number): number => {
    const u = (lx - x0) / w;
    if (u < -0.02 || u > 1.02) return -Infinity;
    const a = u < peak ? Math.pow(Math.max(0, u / peak), 0.75) : Math.pow(Math.max(0, (1 - u) / (1 - peak)), 0.85);
    const crown = Math.pow(Math.sin((Math.PI / 2) * clamp(a, 0, 1)), 1.5);
    const shoulder = sh * Math.exp(-(((u - shU) / 0.16) ** 2));
    const base = Math.max(crown, shoulder * Math.sin(Math.PI * clamp(u, 0, 1)));
    const n = (vnoise1(lx / 37, seed + 3) - 0.5) * 0.28 + (vnoise1(lx / 11, seed + 4) - 0.5) * 0.12 * rough + (vnoise1(lx / 3.7, seed + 5) - 0.5) * 0.04 * rough;
    return h * clamp(base + n * Math.min(1, a * 3 + 0.3), 0, 1.15);
  };
}

/** Limestone stepping down from its tall end into the water (or, its bank share, off the bottom). */
function shelfBody(s: MassSpec, seed: number, wl: number, deep: number): Part[] {
  const r = rng(seed + 1);
  const dir = s.drop ?? 1;
  const at = (u: number): number => (dir > 0 ? s.x + s.w * u : s.x + s.w * (1 - u));
  const bank = s.bank ?? 0;
  // the steps: [from, to (share along it from the tall end), height share, depth, foot nearer by, cap]
  const steps: [number, number, number, number, number, number][] = [
    // (round 5, the critic: "still a tall-left, low-right staircase") its crown stands inward of
    // its tall end: a block at the end, the tallest standing forward of it a third of the way in,
    // a lower one recessed behind that one's far side, a low slab and a small block in the water
    // nearer still; the skyline rises to the crown and falls away both ways
    // (round 6, the critic: "still steps down left to right with evenly striped bedding: give it a
    // different silhouette, a low front ledge with a taller chunk set back and overlapping") two
    // depths, not a staircase: the tall chunk set back (recessed, darker, cooler), a second lower
    // one beside it further back still, a long low ledge standing forward across their feet (its
    // top lit, green on it), a block and a stone nearer still in the water
    [0.1 + 0.03 * r(), 0.5 + 0.04 * r(), 1, 0.62, 0, 0.9],
    [0.47 + 0.03 * r(), 0.74 + 0.04 * r(), 0.56 + 0.08 * r(), 0.72, 2 + 2 * r(), 0.8],
    [-0.04, 0.8 + 0.04 * r(), 0.34 + 0.05 * r(), 0.1, 12 + 3 * r(), 0.9],
    [0.66 + 0.03 * r(), 0.9 + 0.03 * r(), 0.17 + 0.04 * r(), 0.05, 20 + 4 * r(), 0.6],
    [0.9 + 0.02 * r(), 1.0, 0.08 + 0.03 * r(), 0.03, 27 + 5 * r(), 0.5],
  ];
  const ks: Chunk[] = [];
  steps.slice(0, Math.min(steps.length, s.n ?? steps.length)).forEach(([a, b, hk, dep, nearer, cap], i) => {
    const xa = Math.min(at(a), at(b)), xb = Math.max(at(a), at(b));
    const runs = (a + b) / 2 < bank;
    const foot = runs ? Infinity : wl + nearer * (bank > 0 ? 1 : 0.5);
    const H = s.h * hk;
    const k = chunk(xa, xb, (runs ? wl + nearer * 0.5 : foot) - H, foot, dep, cap, seed + 10 + i * 17, (r() - 0.5) * 0.08 - dir * 0.03, (r() - 0.5) * 0.05);
    if (runs) { k.wside = dir; k.wfrom = wl + nearer * 0.5; }
    ks.push(k);
  });
  const parts = rockParts(ks, 1, seed + 3, deep);
  parts.push(...rubble(at, [Math.max(0.55, bank), 1.02], 3 + Math.floor(r() * 3), wl, seed + 200, deep));
  // grass and a fern at the foot of the low steps
  for (let i = 0; i < 2; i++) {
    const x = at(0.45 + 0.4 * r()), y = wl + 6 + r() * 10;
    parts.push(tuftPart({ x, y, rx: 6 + r() * 8, ry: 9 + r() * 9, lit: 0.55, dark: 0.2, seed: seed + 300 + i * 11 }, y, false));
  }
  return parts;
}

/**
 * Limestone running off the bottom (no water at its foot but on one side): bedded blocks stacked as
 * Dex's sketch has them, wide footing beds, smaller blocks on them stepping down to its low end,
 * one perched high, a front block lower down lapped by the lake on its water side.
 */
function stackBody(s: MassSpec, seed: number, wl: number, deep: number): Part[] {
  const r = rng(seed + 1);
  const dir = s.drop ?? 1;
  const at = (u: number): number => (dir > 0 ? s.x + s.w * u : s.x + s.w * (1 - u));
  const span = (a: number, b: number): [number, number] => [Math.min(at(a), at(b)), Math.max(at(a), at(b))];
  const H = s.h;
  const wside = -dir;
  const ks: Chunk[] = [];
  const add = (a: number, b: number, top: number, bot: number, dep: number, cap: number, i: number, perched: boolean): void => {
    const [x0, x1] = span(a, b);
    const k = chunk(x0, x1, top, bot, dep, cap, seed + 10 + i * 17, (r() - 0.5) * 0.1 - dir * 0.04, (r() - 0.5) * 0.04, perched ? Infinity : undefined);
    if (bot === Infinity && a < 0.05) { k.wside = wside; k.wfrom = wl; }
    ks.push(k);
  };
  // (round 5, Dex's crop 19, the critic: "organ pipes: near-equal widths, even spacing, flat grass
  // tops") columns of very different widths (2:1 and more) standing at two depths: the back row
  // recessed, darker and cooler, the front row standing forward, lit on the left and lighter,
  // overlapping the back ones with a shadow between; their tops at their own heights; one in front
  // broken off along a joint, its top a slanted break, its fallen blocks lying at the low end
  if (s.w < 140) {
    // a small stack: one broad block, a lower one standing forward of its low end, a fallen
    // block on that one's ledge
    add(-0.02, 0.64 + 0.06 * r(), wl - H, Infinity, 0.5, 0.9, 0, false);
    add(0.5 + 0.05 * r(), 1.0, wl - H * (0.55 + 0.1 * r()), Infinity, 0.1, 0.8, 1, false);
    const low = ks[1]!;
    const [fa, fb] = span(0.78 + 0.04 * r(), 0.92);
    const lt = Math.min(chunkTop(low, fa), chunkTop(low, fb));
    ks.push(chunk(fa, fb, lt - 2 - (fb - fa) * 0.6, lt + 2, 0.02, 0.4, seed + 10 + 6 * 17, dir * -0.25, 0, Infinity));
    return rockParts(ks, 1, seed + 3, deep);
  }
  // back row: the tall column at the tall end, a broad lower block, running off the bottom
  add(-0.02, 0.3 + 0.05 * r(), wl - H, Infinity, 0.62, 0.9, 0, false);
  add(0.4 + 0.04 * r(), 0.9 + 0.04 * r(), wl - H * (0.56 + 0.08 * r()), Infinity, 0.56, 0.8, 1, false);
  // front row: a footing bed across most of it, standing forward, and blocks stacked on it: a
  // narrow tall one across the joint between the back ones, one broken off along a joint (its top a
  // slanted break), its fallen blocks lying on the footing's ledge beyond it
  // (its low end stays under 30 px over the water: guard-gate1's arch reads to the bottom past it)
  add(0.17 + 0.03 * r(), 0.97, wl - H * (0.2 + 0.04 * r()), Infinity, 0.18, 0.9, 2, false);
  const foot = ks[ks.length - 1]!;
  const on = (a: number, b: number): number => Math.max(chunkTop(foot, span(a, b)[0]), chunkTop(foot, span(a, b)[1])) + 3;
  {
    const a = 0.24 + 0.03 * r(), b = a + 0.15 + 0.04 * r();
    add(a, b, wl - H * (0.76 + 0.08 * r()), on(a, b), 0.1, 0.7, 3, true);
  }
  {
    const a = 0.58 + 0.03 * r(), b = a + 0.12 + 0.03 * r();
    const [x0, x1] = span(a, b);
    ks.push(chunk(x0, x1, wl - H * (0.5 + 0.06 * r()), on(a, b), 0.05, 0, seed + 10 + 4 * 17, dir * (0.34 + 0.12 * r()), 0.02, Infinity));
    const [fa, fb] = span(b + 0.02, b + 0.1 + 0.03 * r());
    const lt = Math.max(chunkTop(foot, fa), chunkTop(foot, fb));
    ks.push(chunk(fa, fb, lt - 3 - (fb - fa) * (0.55 + 0.2 * r()), lt + 3, 0.02, 0.5, seed + 10 + 6 * 17, dir * -0.3, 0.12 * dir, Infinity));
    const [ga, gb] = span(b + 0.14 + 0.03 * r(), b + 0.19 + 0.03 * r());
    const gt = Math.max(chunkTop(foot, ga), chunkTop(foot, gb));
    ks.push(chunk(ga, gb, gt - 2 - (gb - ga) * 0.6, gt + 2, 0.04, 0, seed + 10 + 7 * 17, dir * 0.2, 0, Infinity));
  }
  // and a low block nearer the camera at the tall end, its water side lapped by the lake
  add(-0.07, 0.2 + 0.05 * r(), wl + 12 + 8 * r(), Infinity, 0.04, 0.6, 5, false);
  const parts = rockParts(ks, 1, seed + 3, deep);
  // grass in the joints between the beds
  for (let i = 0; i < 3; i++) {
    const x = at(0.08 + 0.6 * r()), y = wl - H * (0.15 + 0.3 * r());
    parts.push(tuftPart({ x, y, rx: 5 + r() * 6, ry: 7 + r() * 7, lit: 0.5, dark: 0.25, seed: seed + 300 + i * 11 }, Infinity, false));
  }
  return parts;
}

/** A chunked limestone outcrop standing in the water: blocks stacked at different depths. */
function outcropBody(s: MassSpec, seed: number, wl: number, deep: number): Part[] {
  const r = rng(seed + 1);
  const at = (u: number): number => s.x + s.w * u;
  const H = s.h;
  const f = wl + (s.foot ?? 0);
  // [from, to, top share, depth, foot nearer by, cap]
  const plan: [number, number, number, number, number, number][] = [
    // (round 5, the critic: "tall-left, low-right staircase, like play-west's") an islet with a
    // spire: a broad low block, a middling one, a narrow tall pillar right of middle leaning out
    // over the water, a lower block recessed behind its far side, a small one nearest
    [0.0, 0.36 + 0.04 * r(), 0.46 + 0.06 * r(), 0.45, 0, 0.9],
    [0.6 + 0.03 * r(), 0.88 + 0.03 * r(), 0.34 + 0.06 * r(), 0.55, 1, 0.8],
    [0.3 + 0.03 * r(), 0.54 + 0.03 * r(), 0.66 + 0.06 * r(), 0.24, 3, 0.9],
    [0.82 + 0.03 * r(), 0.98, 0.18 + 0.05 * r(), 0.05, 10, 0.6],
  ];
  const ks: Chunk[] = [];
  plan.slice(0, s.n ?? plan.length).forEach(([a, b, hk, dep, nearer, cap], i) => {
    const foot = f + nearer;
    ks.push(chunk(at(a), at(b), foot - H * hk, foot, dep, cap, seed + 30 + i * 19, (r() - 0.5) * 0.1, (r() - 0.5) * 0.06));
  });
  // the spire: narrow, tall, leaning out over the water to the right, standing forward
  {
    const a = 0.5 + 0.03 * r(), b2 = a + 0.13 + 0.03 * r();
    ks.push(chunk(at(a), at(b2), f + 2 - H, f + 2, 0.16, 1, seed + 140, -0.1 - 0.06 * r(), 0.07 + 0.03 * r()));
  }
  // a block perched on the broad one's top, proud of it, stepping the skyline up at the left
  const back = ks[0]!;
  const pa = 0.06 + 0.05 * r(), pb = pa + 0.14 + 0.05 * r();
  const pTop = Math.min(chunkTop(back, at(pa)), chunkTop(back, at(pb))) + 2;
  ks.push(chunk(at(pa), at(pb), pTop - H * (0.16 + 0.05 * r()), pTop + 3, 0.36, 1, seed + 141, (r() - 0.5) * 0.12, 0, f));
  const parts = rockParts(ks, 1, seed + 3, deep);
  parts.push(...rubble(at, [0.0, 0.25], 2, f, seed + 300, deep), ...rubble(at, [0.6, 1.0], 3, f, seed + 310, deep));
  for (let i = 0; i < 3; i++) {
    const x = at(i === 0 ? 0.04 + 0.15 * r() : 0.62 + 0.3 * r()), y = f + 2 + r() * 8;
    parts.push(tuftPart({ x, y, rx: 7 + r() * 9, ry: 9 + r() * 10, lit: 0.55 + 0.3 * r(), dark: 0.15, seed: seed + 400 + i * 11 }, y, false));
  }
  return parts;
}

/**
 * The near end of a mass running off the bottom of the frame: a bank coming toward the camera,
 * dark grass and wet mud, its inner edge wandering down to the bottom through mud shelves (each
 * with a lit lip), a wet band and a broken bright line where the water laps it. Its outer side is
 * `out` (-1 left, 1 right) of [x0, x1].
 */
function bankParts(x0: number, x1: number, out: number, wl: number, deep: number, seed: number, rough: number, taper = 0.4): Part[] {
  const dir = out < 0 ? 1 : -1, outer = out < 0 ? x0 : x1, reach = x1 - x0;
  const C = 8 + 6 * hash1(1, seed);
  const edge = (ly: number): number => {
    const v = clamp((ly - wl) / Math.max(1, deep - wl), 0, 1);
    const k = Math.floor((ly - wl + 5 * vnoise1(ly / 13, seed + 1)) / C);
    // (round 4: small jogs; its edge wanders down, never a stair cut)
    const jog = (hash1(k, seed + 2) - 0.5) * reach * 0.07 * rough;
    return outer + dir * (reach * (1 - taper * Math.pow(v, 0.8)) + jog * (1 - v * taper) + (vnoise1(ly / 23, seed + 3) - 0.5) * reach * 0.14 * (1 - v * taper) + (vnoise1(ly / 4.6, seed + 4) - 0.5) * 2.5);
  };
  // its outer side wanders too (where it is seen, it is a shore of its own, never a cut)
  const oedge = (ly: number): number => {
    const v = clamp((ly - wl) / Math.max(1, deep - wl), 0, 1);
    return outer + dir * (reach * 0.12 * v + (vnoise1(ly / 17, seed + 30) - 0.5) * reach * 0.12 + (vnoise1(ly / 5.1, seed + 31) - 0.5) * 2.2);
  };
  const parts: Part[] = [{
    box: [x0 - reach * 0.3, wl - 2, x1 + reach * 0.3, deep], wl: Infinity, noRefl: true,
    fill: (c, lx, ly, x, y) => {
      if (ly < wl - 0.5) return 0;
      const e = edge(ly), o = oedge(ly);
      const din = Math.min(dir > 0 ? e - lx : lx - e, dir > 0 ? lx - o : o - lx);
      if (din < 0) return 0;
      const sd = seed + 9;
      // the lip of a shelf: where the edge steps out, its top catches the light
      const above = edge(ly - 1.2), dinA = dir > 0 ? above - lx : lx - above;
      if (dinA < 0 && din < 14) return din < 1.2 && vnoise1(lx / 4, sd + 8) > 0.4 ? lineCol(false) : vnoise1(lx / 5, sd) > 0.4 ? P.earth[3]! : P.earth[4]!;
      // (its wet inner edge running down toward the camera: dark, never a bright outline)
      if (din < 1 && vnoise1(ly / 3, sd + 1) > 0.35) return P.pine[5]!;
      if (din < 2.5 + 3 * vnoise1(ly / 6, sd + 2)) return vnoise1(ly / 2.2 + lx / 9, sd + 3) > 0.7 ? P.moss[6]! : vnoise1(lx / 7, sd + 4) > 0.5 ? P.earth[5]! : P.pine[5]!;
      const v = clamp((ly - wl) / Math.max(1, deep - wl), 0, 1);
      const g = vnoise(lx / 19, ly / 8, sd + 5);
      const t = 0.3 + v * 0.5 + (g - 0.5) * 0.3 + (din < 10 ? 0.12 : 0);
      // (round 4: bare earth only in small dark patches: brighter umber read as red blobs)
      // (round 5: the critic's "red ovals": the earth patches dark peat, never red-brown)
      return g < 0.22 ? step(c, [P.earth[5]!, P.pine[5]!, P.pine[5]!], t, x, y) : step(c, [P.moss[6]!, P.moss[7]!, P.pine[4]!, P.pine[5]!], t, x, y);
    },
  }];
  // dark tussocks on it in rows, darker toward the camera, keeping clear of its wet inner edge
  const r = rng(seed + 20);
  // (round 4: from its very top, so no band of bare earth runs along it under the crown)
  for (let y = wl + 3; y < Math.min(deep, wl + 150); y += 9 + r() * 7) {
    const e = edge(y);
    let x = oedge(y) + dir * 6;
    while (dir > 0 ? x < e - 10 : x > e + 10) {
      const rx = 7 + r() * 11, ry = rx * (0.8 + 0.3 * r());
      const v = clamp((y - wl) / Math.max(1, deep - wl), 0, 1);
      parts.push(tuftPart({ x, y, rx, ry, lit: clamp(0.5 - v * 0.6, 0, 1), dark: 0.45 + v * 0.5, seed: seed + 100 + Math.round(x * 3 + y) }, Infinity, false));
      x += dir * rx * (1 + 0.6 * r());
    }
  }
  return parts;
}

/**
 * A grassy rise (reference 4's corner; g3's first piece): tussocks of very different sizes heaped
 * along a crown, lit on the sun side, sinking into shade lower down; the earth of its inner flank
 * showing between them with mud shelves stepping into the water at different depths; a dead twig
 * breaking its crown; stones at its foot. Its bank share (from its outer side) runs off the bottom.
 */
function riseBody(s: MassSpec, seed: number, wl: number, deep: number, small = false): Part[] {
  const r = rng(seed + 1);
  const peak = s.peak ?? 0.3 + 0.4 * r();
  const f = wl + (s.foot ?? 0);
  const E = envelope(s.x, s.w, s.h * 0.8, peak, seed + 2);
  const inner = peak < 0.5 ? 1 : -1;
  const parts: Part[] = [];
  const foot = wanderFoot(f, Math.min(small ? 7 : 13, 3 + s.h * 0.08), seed + 7);
  parts.push(earthPart({
    x0: s.x - 4, x1: s.x + s.w + 4, bot: f, foot, wet: 0.3, shelves: [3 + 3 * r(), 9 + 5 * r(), 18 + 8 * r()], seed: seed + 5,
    top: (lx) => {
      const e = E(lx);
      return e === -Infinity || e < 1 ? Infinity : f - Math.max(1, e - 7 - 8 * vnoise1(lx / 19, seed + 6) - 7 * vnoise1(lx / 6.5, seed + 16));
    },
  }));
  // tussocks: a crown band along the envelope, then bands lower down, darker, overlapping, down to
  // the mud at its foot; the inner flank's lower part thins out so its earth and shelves show
  const base = clamp(s.h / 11, 3.5, small ? 8 : 11);
  const eMax = s.h * 0.8;
  for (let dy = 0, band = 0; dy < eMax; band++) {
    let x = s.x - 6 + (r() - 0.3) * 14;
    while (x < s.x + s.w + 4) {
      const big = band === 0 ? 0.65 + r() * r() * 1.6 : 0.5 + r() * 0.85;
      const rx = base * big + r() * base * 0.5, ry = rx * (0.8 + 0.35 * r());
      const u = (x - s.x) / s.w;
      const e = E(x);
      if (e > 3) {
        const q = dy / Math.max(1, e);
        const y = f - e + dy + (r() - 0.5) * 5 + ry * 0.95;
        const io = inner > 0 ? u - peak : peak - u;
        const open = band > 0 && io > 0.18 && r() < clamp((q - 0.25) * 1.6 + io, 0, 0.88) && !s.closed;
        // (round 4: in stretches the tussocks come down to the water over the mud, so its foot is
        // never one long band of earth)
        if (y < foot(x) - (vnoise1(x / 37, seed + 17) > 0.52 ? 1.5 : 5 + e * 0.07) && !open) {
          // (round 4, the critic: the near corner is ref 04's dark mass lit only along its rim) the
          // crown band catches the sun on its tips, everything under it sinks into shade fast
          const lit = clamp(0.84 - q * 1.6 - Math.max(0, io) * 0.5 + (r() - 0.5) * 0.15, 0, 1);
          parts.push(tuftPart({ x, y, rx, ry, lit, dark: clamp(q * 0.95 + Math.max(0, io) * 0.25, 0, 1), seed: seed + 1000 + band * 300 + Math.round(x) }, f, band === 0 && !small));
        }
      }
      x += rx * (0.72 + 0.45 * r());
    }
    dy += base * (0.95 + 0.5 * r());
  }
  // the twig breaking the crown, a little to the inner side of it
  if (s.twig ?? !small) {
    const tx = s.x + s.w * clamp(peak + inner * (0.07 + 0.08 * r()), 0.05, 0.95);
    const ty = f - E(tx) + 3;
    const th = clamp(s.h * 0.22, 9, small ? 20 : 34) + r() * s.h * 0.07;
    const tl = inner * (0.12 + 0.25 * hash1(9, seed));
    parts.push({ box: [tx - th, ty - th - 6, tx + th, ty], wl: f, noLine: true, dress: (pen, d) => twigStrokes(pen, d, tx, ty, th, tl, seed + 77) });
    // (and a tussock in front of the twig's foot so it grows out of the grass)
    parts.push(tuftPart({ x: tx + inner * 3, y: ty + 9, rx: 9 + r() * 5, ry: 11 + r() * 4, lit: 0.85, dark: 0, seed: seed + 88 }, f, !small));
  }
  const su: [number, number] = inner > 0 ? [0.6, 1.02] : [-0.02, 0.4];
  parts.push(...rubble((u) => s.x + s.w * u, su, 2 + Math.floor(r() * 3), f + 4, seed + 500, deep));
  // its outer end coming toward the camera off the bottom
  const bank = s.bank ?? 0;
  if (bank > 0) {
    const bx0 = inner > 0 ? s.x - s.w * 0.15 : s.x + s.w * (1 - bank), bx1 = inner > 0 ? s.x + s.w * bank : s.x + s.w * 1.15;
    parts.push(...bankParts(bx0, bx1, -inner, f + 2, deep, seed + 900, 1, s.taper));
  }
  return parts;
}

/** A lumpy bar at three scales over [x0, x0 + w]: low, ragged at its ends, never a dome. */
function bar(x0: number, w: number, h: number, seed: number): (lx: number) => number {
  const a = 0.1 + 0.12 * hash1(1, seed), b = 0.1 + 0.12 * hash1(2, seed);
  return (lx: number): number => {
    const u = (lx - x0) / w;
    if (u < 0 || u > 1) return -Infinity;
    const ends = Math.min(1, u / a, (1 - u) / b);
    const lump = 0.62 + 0.3 * (vnoise1(lx / 41, seed + 3) - 0.5) * 2 + 0.12 * (vnoise1(lx / 13, seed + 4) - 0.5) * 2 + 0.05 * (vnoise1(lx / 3.4, seed + 5) - 0.5) * 2;
    // the ends fall away unevenly, a lump or a notch on the way down
    const e = ends >= 1 ? 1 : Math.pow(ends, 0.7) * (0.8 + 0.4 * vnoise1(lx / 6, seed + 6));
    return h * clamp(lump, 0.25, 1.05) * clamp(e, 0, 1);
  };
}

/** A low mud bank: wet earth with roots and shelves, sedge tussocks, a stone (its reeds are sprites). */
function mudBody(s: MassSpec, seed: number, wl: number, deep: number, dark: number): Part[] {
  const r = rng(seed + 1);
  const f = wl + (s.foot ?? 0);
  // (round 4: the critic's "mud raft": a lens with a flat bottom floating on the water) its ends
  // break up and sink: lower lumps with water between them, so it rises out of the shallows
  const E0 = bar(s.x, s.w, s.h, seed + 2);
  const E = (lx: number): number => {
    const u = (lx - s.x) / s.w;
    const e = E0(lx);
    if (u > 0.2 && u < 0.8) return e;
    const k = u <= 0.2 ? u / 0.2 : (1 - u) / 0.2;
    const g = clamp((vnoise1(lx / 6.5, seed + 8) - 0.4 - 0.3 * (1 - k)) / 0.1, 0, 1);
    return g > 0 ? e * (0.45 + 0.5 * k) * Math.sqrt(g) : -Infinity;
  };
  const foot = wanderFoot(f, Math.min(10, 3 + s.h * 0.2), seed + 3);
  const parts: Part[] = [];
  parts.push(earthPart({ x0: s.x, x1: s.x + s.w, bot: f, foot, wet: dark, shelves: [2 + 2 * r(), 6 + 4 * r()], seed: seed + 5, top: (lx) => { const e = E(lx); return e < 0.8 ? Infinity : f - e; } }));
  // roots hanging over its face (a mud bank under reeds is a tangle of them)
  if (s.h > 12) {
    const nr = 2 + Math.floor(r() * 4);
    const roots: [number, number, number, number][] = [];
    for (let i = 0; i < nr; i++) roots.push([s.x + s.w * (0.15 + 0.7 * r()), 4 + r() * s.h * 0.5, (r() - 0.5) * 0.8, seed + 40 + i]);
    parts.push({
      box: [s.x - 10, f - s.h - 4, s.x + s.w + 10, f], wl: f, noLine: true,
      dress: (pen, d) => {
        for (const [rx, len, a, rs] of roots) {
          const e = E(rx);
          if (e < 4) continue;
          strokeP(pen, d, bladePath(rx, f - e + 2, len, Math.PI + a, (hash1(1, rs) - 0.5) * 1.5), (u) => (u < 0.4 ? 2 : 1), (u, sd) => (sd < -0.3 && u < 0.5 ? P.umber[1]! : u > 0.8 ? P.umber[3]! : P.umber[2]!));
        }
      },
    });
  }
  // sedge tussocks along its top in clumps, a gap here and there
  let x = s.x + r() * 6;
  while (x < s.x + s.w) {
    const e = E(x);
    const rx = 4 + r() * (4 + s.h * 0.18), ry = rx * (0.9 + 0.5 * r());
    if (e > 2 && r() > (dark > 0.8 ? 0.62 : 0.35)) parts.push(tuftPart({ x, y: f - e + ry * 0.75, rx, ry, lit: 0.35 + 0.35 * r(), dark: 0.25 + dark * 0.35, seed: seed + 600 + Math.round(x) }, f, false));
    x += rx * (0.8 + 0.9 * r());
  }
  // (round 6, the critic's "red-brown mud slab with a ruled bottom") a front row of sedge lower
  // down its face, darker, hanging toward the water, so the mud shows in gaps between clumps and
  // the bank's foot is broken by them, never one band
  if (s.h >= 10) {
    const rf = rng(seed + 31);
    let fx = s.x + rf() * 10;
    while (fx < s.x + s.w) {
      const e = E(fx);
      const rx = 3.5 + rf() * (3 + s.h * 0.14), ry = rx * (0.8 + 0.4 * rf());
      if (e > 3 && rf() > 0.3) parts.push(tuftPart({ x: fx, y: f - e * (0.25 + 0.3 * rf()) + ry * 0.5, rx, ry, lit: 0.2 + 0.25 * rf(), dark: 0.55 + dark * 0.3, seed: seed + 800 + Math.round(fx) }, f, false));
      fx += rx * (0.9 + 1.1 * rf());
    }
  }
  if (s.stone) {
    const u = 0.62 + 0.3 * r(), sw = 12 + r() * 10, ft = f + 3 + r() * 5;
    const k = chunk(s.x + s.w * u - sw / 2, s.x + s.w * u + sw / 2, ft - sw * (0.5 + 0.2 * r()), ft, 0.05, 0.8, seed + 700, (r() - 0.5) * 0.2);
    const k2 = chunk(s.x + s.w * u + sw * 0.35, s.x + s.w * u + sw * 0.85, ft + 2 - sw * 0.28, ft + 2, 0.02, 0, seed + 701, 0.2);
    parts.push(...rockParts([k, k2], 0.6, seed + 702, deep));
  }
  const bank = s.bank ?? 0;
  if (bank > 0) {
    const out = (s.drop ?? 1) > 0 ? 1 : -1;
    const bx0 = out > 0 ? s.x + s.w * (1 - bank) : s.x - s.w * 0.15, bx1 = out > 0 ? s.x + s.w * 1.15 : s.x + s.w * bank;
    parts.push(...bankParts(bx0, bx1, out, f + 3, deep, seed + 900, 1.2, s.taper));
  }
  return parts;
}

/** A half-sunk stone: two blocks of very different sizes, a moss patch, its foot wet. */
function stoneBody(s: MassSpec, seed: number, wl: number, deep: number): Part[] {
  const r = rng(seed + 1);
  const f = wl + (s.foot ?? 3);
  const ks = [
    chunk(s.x, s.x + s.w * 0.7, f - s.h, f, 0.15, 0.8, seed + 10, (r() - 0.5) * 0.25),
    chunk(s.x + s.w * 0.5, s.x + s.w, f + 1 - s.h * 0.55, f + 1, 0.0, 0.4, seed + 11, (r() - 0.3) * 0.3),
  ];
  return rockParts(ks, 0.8, seed + 12, deep);
}

/** A driftwood snag on a low mud bar, sedge round it. */
function snagBody(s: MassSpec, seed: number, wl: number, deep: number): Part[] {
  const r = rng(seed + 1);
  const f = wl + (s.foot ?? 4);
  const parts = s.sunk ? [] : mudBody({ kind: "mud", x: s.x, w: s.w * 0.75, h: Math.min(20, s.h * 0.22), foot: s.foot ?? 4 }, seed + 3, wl, deep, 0.5);
  const sx = s.x + s.w * (0.18 + 0.1 * r());
  const lean = s.lean ?? 0.75;
  const reach = s.h * Math.abs(Math.sin(lean)) * 1.4 + 30;
  parts.push({ box: [sx - reach, f - s.h - 20, sx + reach, f], wl: f, noLine: true, dress: (pen, d) => snagStrokes(pen, d, sx, f, s.h, lean, seed + 9) });
  for (let i = 0; i < (s.sunk ? 0 : 2); i++) {
    const x = s.x + s.w * (0.05 + 0.6 * r()), ry = 7 + r() * 10;
    parts.push(tuftPart({ x, y: f + 1, rx: 5 + r() * 7, ry, lit: 0.6, dark: 0.15, seed: seed + 20 + i }, f + 1, false));
  }
  return parts;
}

/** The parts of a mass, from its spec. */
function bodyOf(s: MassSpec, seed: number, wl: number, ink: number, deep: number): Part[] {
  switch (s.kind) {
    case "shelf": case "crag": return (s.bank ?? 0) >= 0.95 ? stackBody(s, seed, wl, deep) : shelfBody(s, seed, wl, deep);
    case "outcrop": case "boulder": return outcropBody(s, seed, wl, deep);
    case "rise": case "hummock": return riseBody(s, seed, wl, deep);
    case "knoll": case "tuft": return riseBody({ ...s, twig: s.twig ?? s.kind === "knoll" }, seed, wl, deep, true);
    case "reeds": return mudBody(s, seed, wl, deep, 0.6);
    case "mud": return mudBody(s, seed, wl, deep, 0.9);
    case "snag": return snagBody(s, seed, wl, deep);
    case "stone": return stoneBody(s, seed, wl, deep);
    case "pads": {
      const pd = wl + Math.max(10, s.h * 2.5);
      // (round 6, the critic: "stray reed threads in open water", "pads that read as letters") no
      // sedge stands alone in front of the pads
      const pads: PadSpec = { x0: s.x, w: s.w, wl, deep: pd, sedge: 0, seed, ink, n: Math.round((s.w / 10) * (s.dense ?? 1.1)) + 3 };
      return [{ box: [s.x - 14, wl - 30, s.x + s.w + 14, pd + 32], wl: Infinity, noRefl: true, pads }];
    }
    case "lantern": {
      const kh = Math.min(26, s.h * 0.2);
      const k = riseBody({ ...s, h: kh, twig: false }, seed, wl, deep, true);
      const lx = s.x + s.w * 0.5;
      k.push({ box: [lx - s.h * 0.5, wl - kh - s.h * 1.1, lx + s.h * 0.5, wl], wl: Infinity, noRefl: true, lantern: { x: lx, y: wl - kh * 0.6, H: s.h, lean: s.lean ?? 0.06, seed: seed + 54 } });
      return k;
    }
  }
}

/** A mass laid out from its parts: its box, reflection length and top line. */
function bodyFrom(parts: Part[], seed: number, wl: number, deep: number, spec: MassSpec): Body {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity;
  for (const q of parts) { x0 = Math.min(x0, q.box[0]); x1 = Math.max(x1, q.box[2]); y0 = Math.min(y0, q.box[1]); }
  const len = Math.max(12, (wl - y0) * 0.95);
  const box: [number, number, number, number] = [x0 - 4, y0 - 4, x1 + 4, deep];
  // its top per px (the fills only), for what stands on it
  const n = Math.max(1, Math.ceil(x1) - Math.floor(x0) + 1);
  const tops = new Float32Array(n).fill(-1e9);
  for (const q of parts) {
    if (!q.fill || q.noPaint) continue;
    const yb = Math.min(q.box[3], wl + 40);
    for (let i = 0; i < n; i++) {
      const lx = Math.floor(x0) + i;
      if (lx < q.box[0] || lx > q.box[2]) continue;
      for (let ly = Math.floor(q.box[1]); ly < yb; ly += 1) {
        if (q.fill(NULLC, lx, ly, 0, 0)) { tops[i] = Math.max(tops[i]!, wl - ly); break; }
      }
    }
  }
  return { parts, seed, len, box, tops, spec };
}

function massOf(s: MassSpec, seed: number, wl: number, ink: number, deep: number): Body {
  return bodyFrom(bodyOf(s, seed, wl, ink, deep), seed, wl, deep, s);
}

/** A stand-in paint context for shape queries (fills ask it only for dither and density). */
const NULLC = { d: 1, buf: null, ax: 0, ay: 0, seed: 0, X: (v: number) => v, Y: (v: number) => v, lx: (v: number) => v, ly: (v: number) => v } as unknown as PaintCtx;

// ---------------------------------------------------------------------------
// painting

/** A part's reflection: its fill mirrored point by point and its strokes through a mirror pen. */
function paintPartRefl(c: PaintCtx, q: Part, R: Ripple): void {
  const b = c.buf;
  if (q.fill) {
    const reach = Math.min(R.len * 1.3, R.wl - q.box[1]);
    const lowest = q.wlAt ? q.box[3] : R.wl;
    const X0 = Math.max(b.ox, Math.floor(c.X(q.box[0] - 3))), X1 = Math.min(b.x1, Math.ceil(c.X(q.box[2] + 3)));
    const Y0 = Math.max(b.oy, Math.floor(c.Y(R.wl))), Y1 = Math.min(b.y1, Math.ceil(c.Y(lowest + reach)));
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      const w = q.wlAt ? q.wlAt(lx) : R.wl;
      for (let y = Math.max(Y0, Math.floor(c.Y(w))); y < Y1; y++) {
        const ly = LY(c, y), s = ly - w;
        if (s < 0) continue;
        if (s > reach) break;
        const sh = ripple(R, lx, s);
        if (Number.isNaN(sh)) continue;
        const col = q.fill(c, lx - sh, w - s, x, y);
        if (col) b.set(x, y, reflOf(col, fadeOf(R, s), R.ink));
      }
    }
  }
  if (q.dress) q.dress(mirrorPen(c, R), c.d);
}

/** A part: its fill, the bright line where it meets the water, its strokes. */
function paintPart(c: PaintCtx, q: Part): void {
  const b = c.buf, d = c.d;
  if (q.pads) { padStrokes(c, q.pads); return; }
  if (q.lantern) { const L = q.lantern; lantern(c, L.x, L.y, L.H, L.lean, L.seed); return; }
  if (q.fill) {
    const e1 = Math.max(1, 1 / d);
    const X0 = Math.max(b.ox, Math.floor(c.X(q.box[0] - 3))), X1 = Math.min(b.x1, Math.ceil(c.X(q.box[2] + 3)));
    const yEnd = q.wl === Infinity ? q.box[3] : q.wlAt ? q.box[3] + e1 : Math.min(q.box[3], q.wl) + (q.noLine ? 0 : e1);
    const Y0 = Math.max(b.oy, Math.floor(c.Y(q.box[1]))), Y1 = Math.min(b.y1, Math.ceil(c.Y(yEnd)));
    const ls = Math.round(q.wl === Infinity ? 0 : q.wl) * 7;
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      const w = q.wlAt ? q.wlAt(lx) : q.wl;
      for (let y = Y0; y < Y1; y++) {
        const ly = LY(c, y);
        if (ly >= w) {
          // the bright line where it meets the water: 1 px, broken, brightest on the sun side
          // (only along a level contact: where a wandering foot steps, a line would trace the step)
          const flat = !q.wlAt || Math.abs(q.wlAt(lx + 1.5) - q.wlAt(lx - 1.5)) < 1.1;
          if (!q.noLine && flat && ly < w + e1 && vnoise1(lx / 4.2, ls + 3) > 0.62 && q.fill(c, lx, w - 0.7, x, y)) {
            const lit = q.fill(c, lx - 4, w - 0.7, x, y) === 0 || vnoise1(lx / 9, ls + 5) > 0.55;
            b.set(x, y, lineCol(lit));
          }
          if (ly >= w + e1) break;
          continue;
        }
        const col = q.fill(c, lx, ly, x, y);
        if (col) b.set(x, y, col);
      }
    }
  }
  if (q.dress) q.dress((x, y, k) => dot(c, x, y, k), d);
}

/** The masses' reflections (back to front), then their bodies (back to front). */
function paintBodies(c: PaintCtx, bodies: Body[], ink: number): void {
  const b = c.buf;
  lineInk = ink;
  const vis = bodies.filter((B) => (!B.spec.levels || (c.d >= B.spec.levels[0] - 1e-6 && c.d <= B.spec.levels[1] + 1e-6)) && b.touches(Math.floor(c.X(B.box[0] - 8)), Math.floor(c.Y(B.box[1] - 8)), Math.ceil(c.X(B.box[2] + 8)), Math.ceil(c.Y(B.box[3]))));
  for (const B of vis) {
    for (const q of B.parts) {
      if (q.noRefl || q.wl === Infinity) continue;
      paintPartRefl(c, q, { wl: q.wl, len: B.len, seed: B.seed + Math.round(q.wl) * 13, ink });
    }
  }
  for (const B of vis) for (const q of B.parts) if (!q.noPaint) paintPart(c, q);
}

/** An old stone lantern (toro), its foot in the grass, leaning a little. Local (x, y) is its foot. */
function lantern(c: PaintCtx, x: number, y: number, H: number, lean: number, seed: number): void {
  const b = c.buf, d = c.d;
  const ca = Math.cos(lean), sa = Math.sin(lean);
  const R = H * 0.34;
  const X0 = Math.max(b.ox, Math.floor(c.X(x - R + Math.min(0, sa * H)) - d)), X1 = Math.min(b.x1, Math.ceil(c.X(x + R + Math.max(0, sa * H)) + d));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(y - H * 1.04) - d)), Y1 = Math.min(b.y1, Math.ceil(c.Y(y + 2)));
  if (X0 >= X1 || Y0 >= Y1) return;
  const half = (v: number): number => {
    if (v < 0.1) return 0.2;
    if (v < 0.12) return 0.15;
    if (v < 0.47) return 0.075 + (v > 0.27 && v < 0.3 ? 0.014 : 0) - (v - 0.12) * 0.02;
    if (v < 0.5) return 0.11;
    if (v < 0.57) return 0.11 + (v - 0.5) / 0.07 * 0.065;
    if (v < 0.59) return 0.175;
    if (v < 0.75) return 0.115;
    if (v < 0.77) return 0.16;
    if (v < 0.91) return 0.32 * Math.pow(1 - (v - 0.77) / 0.14, 1.6) + 0.035;
    if (v < 0.94) return 0.045;
    return 0.055 * Math.sin(Math.PI * clamp(0.15 + ((v - 0.94) / 0.06) * 0.85, 0, 1));
  };
  for (let yy = Y0; yy < Y1; yy++) {
    for (let xx = X0; xx < X1; xx++) {
      const lx = LX(c, xx) - x, ly = LY(c, yy) - y;
      const ux = lx * ca + ly * sa, uy = -lx * sa + ly * ca;
      const v = -uy / H;
      if (v < -0.02 || v > 1) continue;
      const hw = half(v) * H;
      if (Math.abs(ux) > hw) continue;
      const q = ux / Math.max(0.5, hw);
      let t = q < -0.55 ? 0.22 : q < 0.15 ? 0.42 : q < 0.6 ? 0.58 : 0.74;
      if ((v > 0.59 && v < 0.64) || (v > 0.47 && v < 0.5) || (v > 0.1 && v < 0.14)) t += 0.18;
      if (v > 0.63 && v < 0.72 && Math.abs(ux) < H * 0.045) { b.set(xx, yy, P.ink[1]!); continue; }
      const mv = vnoise(ux / 3, v * 40, seed + 41);
      if (v > 0.8 && v < 0.91 && mv > 0.45 && q < 0.7) { b.set(xx, yy, q < -0.3 ? P.moss[4]! : P.moss[5]!); continue; }
      t += (vnoise(ux / 2.5, v * 30, seed + 42) - 0.5) * 0.16;
      b.set(xx, yy, step(c, P.stone, clamp(0.4 + t * 0.62, 0, 1), xx, yy, 0.2));
    }
  }
}

// ---------------------------------------------------------------------------
// op.bank: the near shore's masses (P5)

/** P5's ink (world/types.ts): what it paints is darkened by it on screen. */
const NEAR_INK = 0.3;

/** A shore composed from a seed (the generated path; Kagami authors its masses). */
function generate(p: BankP, seed: number): MassSpec[] {
  const r = rng(seed + 11);
  const reeds = p.reeds ?? 0.45;
  const out: MassSpec[] = [];
  const x0 = p.startR ? 260 : 20, x1 = p.endR ? p.w - 280 : p.w - 20;
  if (p.startR) out.push({ kind: "shelf", x: -40, w: 300, h: 70 + r() * 40, drop: -1, bank: 0.5 });
  let x = x0 + r() * 40;
  const kinds: MassKind[] = ["rise", "outcrop", "snag", "pads", "mud", "stone", "knoll"];
  let last: MassKind | null = null;
  while (x < x1 - 60) {
    let kind: MassKind = r() < reeds ? "reeds" : kinds[Math.floor(r() * kinds.length)]!;
    if (kind === last) kind = kind === "reeds" ? "knoll" : "reeds";
    last = kind;
    const w = Math.min(x1 - x, kind === "pads" || kind === "stone" ? 40 + r() * 60 : 150 + r() * 200);
    if (w < 30) break;
    const h = kind === "reeds" || kind === "mud" ? 20 + r() * 25 : kind === "pads" || kind === "stone" ? 10 + r() * 10 : 50 + r() * 60;
    out.push({ kind, x, w, h });
    // open water between, its gaps of very different widths
    x += w + 60 + r() * r() * 600;
  }
  if (p.endR) out.push({ kind: "shelf", x: p.w - 300, w: 320, h: 80 + r() * 50, drop: 1, bank: 0.5 });
  return out;
}

function layoutOf(p: BankP, seed: number): Body[] {
  return cached(`bank4|${seed}|${p.w}|${p.h}|${p.reeds}|${p.startR}|${p.endR}|${p.masses ? JSON.stringify(p.masses) : ""}`, () => {
    const specs = p.masses ?? generate(p, seed);
    return specs.map((s, i) => massOf(s, seed + 1000 + i * 37, 0, NEAR_INK, p.h));
  });
}

export const bank = definePainter<BankP>("op.bank", {
  bounds(p) {
    let x0 = -60, x1 = p.w + 60, y0 = -90;
    const specs = p.masses ?? generate(p, 0);
    for (const m of specs) {
      const tall = m.kind === "lantern" ? m.h * 1.4 + 40 : m.kind === "snag" ? m.h * 1.6 + 30 : m.h * 1.25 + 110;
      x0 = Math.min(x0, m.x - 160);
      x1 = Math.max(x1, m.x + m.w + 160 + (m.kind === "snag" ? m.h * 1.4 : 0));
      y0 = Math.min(y0, -tall - 20);
    }
    if (!p.masses) { x0 = Math.min(x0, -400); x1 = Math.max(x1, p.w + 400); y0 = Math.min(y0, -330); }
    return [x0, y0, x1, p.h + 4];
  },
  paint(c, p) {
    paintBodies(c, layoutOf(p, c.seed), NEAR_INK);
  },
});

/** Is the mass painted at play density (level 1)? */
const atPlay = (m: MassSpec): boolean => !m.levels || (m.levels[0] <= 1 + 1e-6 && m.levels[1] >= 1 - 1e-6);

/** The reed stands' places, for the reed sprites: [x, width, height, density] in the shore's own px. */
export function reedBeds(p: BankP, seed: number): [number, number, number, number][] {
  return layoutOf(p, seed).filter((B) => atPlay(B.spec) && (B.spec.kind === "reeds" || (B.spec.kind === "mud" && B.spec.reed !== undefined))).map((B) => {
    const m = B.spec;
    return [m.x + m.w * 0.06, m.w * 0.88, m.reed ?? Math.round(m.h * 2.2 + 40), m.dense ?? 3] as [number, number, number, number];
  });
}

/** The shore's top at x, px above the waterline (0 over open water), so reeds stand on it. */
export function bankTopAt(p: BankP, seed: number, x: number): number {
  let t = 0;
  for (const B of layoutOf(p, seed)) {
    // (a mass not painted at play density carries no reeds: they stand on the water there)
    if (!atPlay(B.spec)) continue;
    const v = B.tops[Math.floor(x) - Math.floor(B.box[0] + 4)];
    if (v !== undefined && v > t) t = v;
  }
  return t;
}

// ---------------------------------------------------------------------------
// op.shallows (front plane): the catch's near corners and the lily bed under her. The close band
// does not draw P5, so in the catch these are the near ground; at play zoom they are low shallows
// between the jetty's reflection and P5, lighter than P5 and under it.
// - the left corner (side -1): the dominant, a grassy rise cutting in from the left edge, blades and
//   a twig breaking its crown against the bright lake, a warm rim on its upper left, a dark
//   underside, wet mud shelves stepping into the water; a dark bank under its tall end runs off the
//   bottom corner;
// - the right corner (side 1): smaller and of another kind, a low mud spit (its reeds and cattails
//   are op.reeds sprites) and one stone;
// - "pads": a quiet bed of lily pads with a few sedge blades lying on the water.
// Each paints its own reflection (the lake mirrors no front-plane part below its waterline).
// Anchor: its left end at the lake's waterline (the play plane's); sizes in level-1 px.

export interface ShallowsP {
  /** Width along the shore, px. */
  w: number;
  /** Its own waterline: how far below the anchor its things stand in the water, px. */
  wl: number;
  /** How far down it runs (past the bottom of the frame), px. */
  deep: number;
  /** Which end is the shore running off the frame's corner: -1 the left end, 1 the right end. */
  side: -1 | 1;
  /** Height of its tallest thing above its waterline, px (default 30). */
  h?: number;
  /** A snag lying from the bank into the water ("log") or old broken stubs ("stubs"). */
  wood?: "log" | "stubs";
  /** "rise" (the default on the left), "spit" (the default on the right) or "pads". */
  kind?: "rise" | "spit" | "pads";
  /** (round 6) Painted only at plate densities in [min, max] (see MassSpec.levels). */
  levels?: [number, number];
}

/** The shallows' bodies: the corner's mass and what stands by it, or the lily bed. */
function shallowsOf(p: ShallowsP, seed: number): Body[] {
  return cached(`shallows4|${seed}|${p.w}|${p.wl}|${p.deep}|${p.side}|${p.h}|${p.wood}|${p.kind}`, () => {
    const H = p.h ?? 30;
    const kind = p.kind ?? (p.side < 0 ? "rise" : "spit");
    const r = rng(seed + 41);
    const L = p.side < 0;
    const out: Body[] = [];
    if (kind === "pads") {
      out.push(massOf({ kind: "pads", x: 0, w: p.w, h: Math.max(8, (p.deep - p.wl) / 2.5), dense: 4.2 }, seed + 1, p.wl, 0, p.deep));
      return out;
    }
    if (kind === "rise") {
      // the rise, its crown toward the outer end, that end coming toward the camera off the corner
      // (round-3 integration: its bank wider and less tapered, run deep enough to leave every
      // frame by its bottom edge, so the catch's bottom-left corner is the rise's dark bank coming
      // at the camera, not open water under a strip; at play zoom P5's rise stands over most of it)
      out.push(massOf({ kind: "rise", x: L ? -p.w * 0.15 : p.w * 0.15, w: p.w, h: H, peak: L ? 0.38 : 0.62, bank: 0.7, taper: 0.45 }, seed + 2, p.wl, 0, p.deep));
      if ((p.wood ?? "log") === "log") {
        // a kinked snag lying out from its inner end into the water
        const sx = L ? p.w * (0.7 + 0.08 * r()) : p.w * (0.22 + 0.08 * r());
        out.push(massOf({ kind: "snag", x: sx, w: 30, h: H * 0.42, lean: L ? 1.15 : -1.15, foot: 9 }, seed + 5, p.wl, 0, p.deep));
      }
      return out;
    }
    // the spit: a low mud bank off the corner, its inner end a point in the water, one stone
    out.push(massOf({ kind: "mud", x: L ? -p.w * 0.1 : p.w * 0.1, w: p.w, h: H * 0.6, foot: 2 }, seed + 2, p.wl, 0, p.deep));
    const su = L ? 0.6 + 0.1 * r() : 0.26 + 0.08 * r();
    out.push(massOf({ kind: "stone", x: p.w * su, w: 14 + r() * 6, h: 9 + r() * 4, foot: 9 }, seed + 6, p.wl, 0, p.deep));
    if (p.wood === "stubs") {
      for (let i = 0; i < 2; i++) {
        const sx = p.w * (L ? 0.82 + 0.07 * i : 0.12 + 0.07 * i);
        out.push(massOf({ kind: "snag", x: sx, w: 10, h: H * (0.9 - 0.4 * i), lean: (r() - 0.5) * 0.3, foot: 3 + 3 * i }, seed + 7 + i, p.wl, 0, p.deep));
      }
    }
    return out;
  });
}

export const shallows = definePainter<ShallowsP>("op.shallows", {
  bounds(p) {
    const H = p.h ?? 30;
    return [-p.w * 0.6 - 120, p.wl - H * 1.6 - 120, p.w * 1.6 + 120, p.deep + 4];
  },
  paint(c, p) {
    if (p.levels && (c.d < p.levels[0] - 1e-6 || c.d > p.levels[1] + 1e-6)) return;
    paintBodies(c, shallowsOf(p, c.seed), 0);
  },
});

/** The shallows' bank top at x, px above its own waterline (0 where there is no bank): for its reeds. */
export function shallowsTopAt(p: ShallowsP, seed: number, x: number): number {
  let t = 0;
  for (const B of shallowsOf(p, seed)) {
    const v = B.tops[Math.floor(x) - Math.floor(B.box[0] + 4)];
    if (v !== undefined && v > t) t = v;
  }
  return t;
}
