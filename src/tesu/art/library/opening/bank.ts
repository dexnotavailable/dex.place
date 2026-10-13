// Kagami's near shore (P5, the near-front plane): the ground at the camera's feet along the whole
// lake, and the few big landforms on it that frame the bottom of every lake view the way reference
// 4's grassy rise, its lit lawn and its dark bushes frame its near edge.
//
// The structural fact: the lake's surface stops at this plane's waterline (local y 0), so below it
// there is only what this painter paints. The ground runs the whole length, and it is never a band:
// - its top always stands 3 to 40 px above the waterline, shaped at three scales by mud lumps,
//   stones and reed bases, with lily pads lying on the water's last rows beyond it; no stretch of
//   it is level;
// - its body is the near shore seen from just above it: wet mud and grass in big soft patches
//   stretched along the shore, puddles holding the sky (two pale jade steps in a dark mud lip), the
//   odd lit stone and grass clump, darker and quieter toward the bottom of the frame; no repeated
//   marks, no boundary rows;
// - on it stand a few landforms (one dominant and one secondary per frame): grassy rises (slumped
//   domes with a grass hem, lit on the upper left, their lower flank in shade), limestone (rounded
//   fused lobes, a crack or two, a moss cap on the lit top, a wet dark foot), reed clumps (their
//   tall reeds are op.reeds sprites) and grass tufts. Each is a few lobes shaded as rounded forms in
//   the one sun (upper left): a warm 1 px rim on the sun side, the form tone, a shadow core lower
//   right, and a shadow cast down and right on the ground. Rises in the corners run off the bottom
//   of the frame; smaller things stand on the ground with a contact shadow at their foot.
// One density at every level: at the close band (level 2) every feature is drawn in whole level-1
// px (2 x 2 art px), dither included.
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
  /** A crag at an end of the shore: its outer face drops away (-1 left, 1 right). */
  drop?: -1 | 1;
  /** Reed stands: height of the tallest reeds (the op.reeds sprites), px (default 2.2 x h + 40). */
  reed?: number;
  /** Reed stands: reeds per 10 px (default 3). */
  dense?: number;
  /** A lantern's tilt, radians (positive leans right; default a few degrees); rock: its lean. */
  lean?: number;
  /** Where its crown sits across its width, 0..1 (default from its seed). */
  peak?: number;
  /** It stands on the near ground with its foot this far below the waterline, px (unset: a rise or a
   *  crag runs off the bottom of the frame; reeds, tufts and lanterns stand at the ground's top). */
  foot?: number;
  /** A second crown along a long rise: [its place across the width 0..1, its height share 0..1]. */
  crown?: [number, number];
}

export interface BankP {
  /** Length along the shore and depth of the ground below the waterline, px. */
  w: number;
  h: number;
  /** Generated shores (no `masses`): the ends finish in a crag whose face drops away. */
  endR?: number;
  startR?: number;
  /** Generated shores: share of masses that are reed stands, 0..1 (default 0.45). */
  reeds?: number;
  /** Authored masses (the frames' composition), in paint order. */
  masses?: MassSpec[];
  /** Past this x (local px) the ground rounds over and falls away off the bottom (past the lake). */
  fall?: number;
  /** From this x (local px) on, the ground lies low (3 to about 16 px), so what stands behind it reads over it. */
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

/** A blade of the grass hem along a backlit crown: dark at its foot, its tip catching the sun warm. */
function hemBlade(c: PaintCtx, x: number, y: number, len: number, a0: number, bend: number, sun: number): void {
  stroke(c, bladePath(x, y, len, a0, bend), (u) => (len > 14 && u < 0.3 ? 2 : 1), (u) => {
    if (u > 0.68) return sun >= 1 ? P.moss[2]! : sun > 0 ? P.moss[3]! : P.moss[5]!;
    if (u > 0.4) return sun >= 1 ? P.moss[4]! : P.moss[5]!;
    return u > 0.18 ? P.moss[6]! : P.moss[7]!;
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
// the light: one sun, up and to the left of every frame and beyond the scene, so the near shore
// is backlit: what faces the camera stands in its own shade, what faces up takes the sun and the
// sky, the sunward edges catch a warm rim

const LIT = ((): [number, number, number] => {
  const v: [number, number, number] = [-0.55, -0.8, -0.18];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

// ---------------------------------------------------------------------------
// layout

/** A rounded lobe of a landform: a superellipse, wider on one side, its crown leaning over its base. */
interface Lobe {
  cx: number;
  /** Local y of its crown (negative: above the waterline) and of its bottom (past the frame for a
   *  lobe that runs off it). */
  top: number;
  bot: number;
  /** Local y of its widest row (a lobe that runs off the bottom keeps that width below it). */
  mid: number;
  /** Half widths left and right of the centre, at its widest. */
  aL: number;
  aR: number;
  /** 2 an ellipse; more is a flatter crown and steeper flanks. */
  k: number;
  /** px its crown leans right (+) or left (-) over its middle. */
  lean: number;
  rock: boolean;
  seed: number;
}

interface Mass extends MassSpec {
  seed: number;
  lobes: Lobe[];
  /** Horizontal reach of the body, local px. */
  x0: number;
  x1: number;
  /** Top of the body per px from floor(x0) (height above the waterline; -1e9 where none). */
  tops: Float32Array;
  /** Local y of the foot (where it stands on the ground), Infinity when it runs off the bottom. */
  footY: number;
  /** A crag's face: past this x (drop 1) or before it (drop -1) the mass is open air. */
  face?: number;
  /** Its own waterline (local y; 0 on P5): depth below it darkens the form. */
  base?: number;
  /** A darker setting for a plane the shader does not darken (the front plane), 0..0.3. */
  dark?: number;
}

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

/** The lobes of a landform (its rounded parts), from its spec. */
function lobesOf(s: MassSpec, seed: number, deep: number, footY: number): Lobe[] {
  const r = rng(seed + 3);
  const L: Lobe[] = [];
  const peak = s.peak ?? 0.3 + 0.4 * r();
  // a lobe that runs off the bottom is widest a little under the waterline and keeps that width
  // on down off the frame; one that stands on the ground is widest near its foot, where the
  // ground cuts it
  void deep;
  const run = footY === Infinity;
  // small things stand on the ground's top: their heights count from their foot
  const base = s.kind === "reeds" || s.kind === "tuft" || s.kind === "lantern" ? Math.min(0, footY) : 0;
  const add = (cx: number, h: number, aL: number, aR: number, k: number, lean: number, rock: boolean): void => {
    const top = base - h;
    const mid = run ? 26 + 0.2 * h + 14 * r() : footY - (footY - top) * 0.22;
    const bot = run ? Infinity : footY + (footY - mid) * 1.2 + 4;
    L.push({ cx, top, bot, mid, aL, aR, k, lean, rock, seed: seed + 100 + L.length * 31 });
  };
  const sk = r() < 0.5 ? -1 : 1;
  switch (s.kind) {
    case "hummock": {
      // a grassy rise: one slumped crown, a lower shoulder on its long side, a third small knoll
      const cx = s.x + s.w * peak;
      add(cx, s.h, s.w * peak * 1.15 + 20, s.w * (1 - peak) * 1.15 + 20, 2.3 + 0.4 * r(), (r() - 0.5) * s.w * 0.06, false);
      const far = peak < 0.5 ? 1 : -1;
      add(cx + far * s.w * (0.3 + 0.12 * r()), s.h * (0.52 + 0.12 * r()), s.w * (0.24 + 0.08 * r()), s.w * (0.24 + 0.08 * r()), 2.1, 0, false);
      if (s.crown) add(s.x + s.w * s.crown[0], s.h * s.crown[1], s.w * 0.2, s.w * 0.24, 2.4, (r() - 0.5) * 10, false);
      if (r() < 0.7) add(cx - far * s.w * (0.18 + 0.1 * r()), s.h * (0.3 + 0.15 * r()), s.w * 0.14, s.w * 0.18, 2, 0, false);
      break;
    }
    case "boulder": {
      // rounded limestone: a main lobe and one or two fused to it, of very different sizes
      const cx = s.x + s.w * peak;
      const lean = s.lean ?? (r() - 0.5) * s.h * 0.25;
      add(cx, s.h, s.w * (0.3 + 0.1 * r()), s.w * (0.32 + 0.1 * r()), 2.7 + 0.5 * r(), lean, true);
      add(cx + sk * s.w * (0.26 + 0.1 * r()), s.h * (0.45 + 0.2 * r()), s.w * (0.2 + 0.06 * r()), s.w * (0.22 + 0.06 * r()), 2.6, lean * 0.5, true);
      if (r() < 0.6) add(cx - sk * s.w * (0.28 + 0.1 * r()), s.h * (0.25 + 0.12 * r()), s.w * 0.14, s.w * 0.16, 2.4, 0, true);
      break;
    }
    case "crag": {
      // limestone of fused, leaning masses of very different widths
      const n = s.w > 380 ? 3 : 2;
      const lean = s.lean ?? (s.drop ?? sk) * s.h * 0.12;
      // the tallest broad and leaning, a fused shoulder lower down, a low block by the outer end
      const parts: [number, number, number][] = n === 3
        ? [[0.3, 1, 0.3], [0.62 + 0.04 * r(), 0.66 + 0.1 * r(), 0.19], [0.86, 0.4 + 0.08 * r(), 0.15]]
        : [[0.32, 1, 0.34], [0.78, 0.6 + 0.15 * r(), 0.2]];
      for (const [u, hk, a] of parts) {
        const uu = s.drop === -1 ? 1 - u : u;
        add(s.x + s.w * uu, s.h * hk, s.w * a * (0.9 + 0.3 * r()), s.w * a * (0.9 + 0.3 * r()), 2.8 + 0.8 * r(), lean * hk, true);
      }
      break;
    }
    case "reeds": {
      // the stand's foot: a low dark mound of reed bases and mud at the water's edge
      add(s.x + s.w * 0.5, Math.max(6, s.h * 0.55), s.w * 0.55, s.w * 0.55, 1.8, 0, false);
      break;
    }
    case "tuft": {
      add(s.x + s.w * 0.5, Math.max(4, Math.min(s.h * 0.35, s.w * 0.12)), s.w * 0.4, s.w * 0.45, 2, 0, false);
      break;
    }
    case "lantern": {
      // a low grassy knoll it stands on
      add(s.x + s.w * 0.5, Math.min(24, s.h * 0.18), s.w * 0.5, s.w * 0.5, 2.2, 0, false);
      break;
    }
  }
  return L;
}

/** A lobe's centre at local y (its crown leans over its middle). */
function lobeCx(L: Lobe, ly: number): number {
  return L.cx + L.lean * clamp((L.mid - ly) / Math.max(1, L.mid - L.top), 0, 1.2);
}

/** Normalised radius of a point in a lobe, its true (smooth) shape: 0 at the core, 1 on the edge. */
function lobeR(L: Lobe, lx: number, ly: number): number {
  const v = ly < L.mid ? (L.mid - ly) / Math.max(1, L.mid - L.top) : L.bot === Infinity ? 0 : (ly - L.mid) / Math.max(1, L.bot - L.mid);
  if (v >= 1.6) return 1.6;
  const u = lx - lobeCx(L, ly);
  // (one that runs off the bottom keeps spreading under its widest row: a flank, never a wall)
  const a = (u < 0 ? L.aL : L.aR) + (L.bot === Infinity && ly > L.mid ? (ly - L.mid) * 0.55 : 0);
  return Math.pow(Math.pow(Math.abs(u) / a, L.k) + Math.pow(v, L.k), 1 / L.k);
}

/**
 * Normalised radius of a point in a lobe as drawn (inside below 1): the silhouette wanders at three
 * scales (the lobe itself is the envelope; lumps; grit), more along the crown than down the flanks.
 */
function lobeQ(L: Lobe, lx: number, ly: number): number {
  const s = L.seed;
  const amp = Math.min(L.rock ? 8 : 12, (L.mid - L.top) * 0.12);
  const wy = ly + (vnoise1(lx / 21, s + 1) - 0.5) * amp + (vnoise1(lx / 7.3, s + 2) - 0.5) * (L.rock ? 2.6 : 2.4) + (vnoise1(lx / 2.7, s + 3) - 0.5) * (L.rock ? 0.8 : 1.2);
  const wx = lx + (vnoise1(ly / 17, s + 4) - 0.5) * (L.rock ? 6 : 9) + (vnoise1(ly / 5.2, s + 5) - 0.5) * 2;
  return lobeR(L, wx, wy);
}

/** The smooth union of a mass's lobes (their true shapes blended where they meet): its form for the light. */
function formR(m: Mass, lx: number, ly: number): number {
  let a = 9;
  for (const L of m.lobes) {
    const b = lobeR(L, lx, ly);
    const h = Math.max(0.3 - Math.abs(a - b), 0) / 0.3;
    a = Math.min(a, b) - h * h * 0.3 * 0.25;
  }
  return a;
}

/** Which lobe of a mass holds a point (the last one painted wins), or -1. */
function lobeOf(m: Mass, lx: number, ly: number): number {
  if (lx < m.x0 || lx > m.x1 || ly > footLine(m, lx)) return -1;
  if (m.face !== undefined && (m.drop === 1 ? lx > faceAt(m, ly) : lx < faceAt(m, ly))) return -1;
  for (let i = m.lobes.length - 1; i >= 0; i--) if (lobeQ(m.lobes[i]!, lx, ly) < 1) return i;
  return -1;
}

/** Where a mass standing on the ground meets it: a gentle smile, lower under its middle. */
function footLine(m: Mass, lx: number): number {
  if (m.footY === Infinity) return Infinity;
  const u = clamp((lx - m.x0) / Math.max(1, m.x1 - m.x0), 0, 1);
  return m.footY + 3 * Math.sin(Math.PI * u) + (vnoise1(lx / 13, m.seed + 7) - 0.5) * 3 + (vnoise1(lx / 4, m.seed + 8) - 0.5) * 1.2;
}

/** A crag's outer face at local y: it wanders with ledges and bulges going down, never a ruled edge. */
function faceAt(m: Mass, ly: number): number {
  const s = m.seed;
  const k = Math.max(0, ly + m.h);
  const wander = (fbm1(ly / 50, s + 91, 3) - 0.5) * 30 + (vnoise1(ly / 11, s + 92) - 0.5) * 8 + (vnoise1(ly / 3.4, s + 93) - 0.5) * 2;
  // the face goes in under its crown (an undercut), then spreads out lower down into its own
  // fallen blocks under the low ground
  return m.face! + m.drop! * (wander - 12 * Math.sin(clamp(k / 80, 0, 1) * Math.PI) + Math.max(0, k - 60) * 0.55);
}

function layoutOf(p: BankP, seed: number): Mass[] {
  return cached(`bank3|${seed}|${p.w}|${p.h}|${p.reeds}|${p.startR}|${p.endR}|${p.fall}|${p.low}|${p.masses ? JSON.stringify(p.masses) : ""}`, () => {
    const specs = p.masses ?? generate(p, seed);
    return specs.map((s, i) => {
      const ms = seed + 1000 + i * 37;
      let footY = Infinity;
      if (s.foot !== undefined) footY = s.foot;
      else if (s.kind === "reeds" || s.kind === "tuft" || s.kind === "lantern") footY = -groundTop(p, s.x + s.w * 0.5, seed) + 4 + Math.min(8, s.h * 0.12);
      const lobes = lobesOf(s, ms, p.h, footY);
      let x0 = Infinity, x1 = -Infinity;
      for (const L of lobes) {
        const reach = lobeReach(L, p.h);
        x0 = Math.min(x0, L.cx - reach);
        x1 = Math.max(x1, L.cx + reach);
      }
      const m: Mass = { ...s, seed: ms, lobes, x0, x1, tops: new Float32Array(0), footY };
      if (s.drop) {
        m.face = s.drop === 1 ? s.x + s.w : s.x;
        if (s.drop === 1) m.x1 = Math.min(m.x1, m.face + 40);
        else m.x0 = Math.max(m.x0, m.face - 40);
      }
      return finishMass(m, p.h);
    });
  });
}

/** How far a lobe reaches out from its centre down to the given depth (a flank keeps spreading). */
function lobeReach(L: Lobe, deep: number): number {
  return Math.max(L.aL, L.aR) + Math.abs(L.lean) * 1.2 + 14 + (L.bot === Infinity ? Math.max(0, deep - L.mid) * 0.55 : 0);
}

/** A mass's reach and the top of its body per px (scanning down each column). */
function finishMass(m: Mass, deep: number): Mass {
  if (m.x0 === Infinity) {
    for (const L of m.lobes) {
      const reach = lobeReach(L, deep);
      m.x0 = Math.min(m.x0, L.cx - reach);
      m.x1 = Math.max(m.x1, L.cx + reach);
    }
  }
  const n = Math.ceil(m.x1) - Math.floor(m.x0) + 1;
  const tops = new Float32Array(n);
  const yTop = Math.min(...m.lobes.map((L) => L.top)) - 16;
  for (let i = 0; i < n; i++) {
    const lx = Math.floor(m.x0) + i;
    let t = -1e9;
    for (let ly = yTop; ly < Math.min(deep, footLine(m, lx)); ly += 1.5) {
      if (lobeOf(m, lx, ly) >= 0) {
        let y = ly;
        while (y > ly - 1.5 && lobeOf(m, lx, y - 0.25) >= 0) y -= 0.25;
        t = -y;
        break;
      }
    }
    tops[i] = t;
  }
  m.tops = tops;
  return m;
}

/** A mass's body top at lx (height above the waterline), or -Infinity outside it. */
function massTop(m: Mass, lx: number): number {
  if (lx < m.x0 || lx > m.x1) return -Infinity;
  const k = lx - Math.floor(m.x0), i = Math.floor(k), f = k - i;
  const a = m.tops[i] ?? -1e9, b = m.tops[i + 1] ?? a;
  if (a < -1e8 || b < -1e8) return Math.max(a, b) < -1e8 ? -Infinity : Math.max(a, b);
  return a + (b - a) * f;
}

// ---------------------------------------------------------------------------
// the ground

/** The ground's top at lx, px above the waterline: 3 to 40, never level for long. */
function groundTop(p: BankP, lx: number, seed: number): number {
  // the shore's own lie, slow, and its banks and bays
  const swell = 2 + 34 * Math.pow(fbm1(lx / 300, seed + 31, 3), 1.6) + 11 * (vnoise1(lx / 83, seed + 36) - 0.5) + 7 * (vnoise1(lx / 31, seed + 37) - 0.5);
  // mud lumps, one in every cell of ~44 px, rounded, of very different sizes; small ones between
  let lump = 0;
  for (const [C, k, w0, w1, h0, h1] of [[44, 41, 10, 52, 2, 14], [21, 44, 5, 16, 1.2, 5], [11, 47, 3, 8, 0.6, 2.4]] as const) {
    const ci = Math.floor(lx / C);
    let lm = 0;
    for (let i = ci - 2; i <= ci + 2; i++) {
      const cxl = (i + 0.1 + 0.8 * hash1(i, seed + k)) * C, wl = w0 + (w1 - w0) * hash1(i, seed + k + 1), hl = h0 + (h1 - h0) * Math.pow(hash1(i, seed + k + 2), 1.4);
      const t = (lx - cxl) / wl;
      if (Math.abs(t) < 1) lm = Math.max(lm, hl * (1 - t * t) * (1 - 0.3 * t * t));
    }
    lump += lm;
  }
  const grit = (vnoise1(lx / 6.5, seed + 32) - 0.5) * 2.4 + (vnoise1(lx / 2.3, seed + 33) - 0.5) * 1.1;
  // (soft limits: the slow lie eases toward its top, the lumps and grit ride on it, and the
  // whole eases toward 40 and toward 3, so it never lies on one row)
  const sw = swell > 20 ? 20 + 7 * (1 - Math.exp(-(swell - 20) / 7)) : swell;
  const raw = sw + lump + grit;
  let T = raw > 36 ? 36 + 3.6 * (1 - Math.exp(-(raw - 36) / 3.6)) : raw > 6 ? raw : 3.2 + 2.8 * Math.exp((raw - 6) / 2.8);
  if (p.low !== undefined && lx > p.low) T = 3.2 + (T - 3.2) * (1 - 0.62 * clamp((lx - p.low) / 160, 0, 1));
  // past the lake's end the ground rounds over and falls away into the valley
  if (p.fall !== undefined && lx > p.fall) T -= Math.pow((lx - p.fall) / 70, 2) * 30;
  return T;
}

interface Feature {
  kind: "puddle" | "stone" | "tuft" | "pad";
  x: number;
  y: number;
  r: number;
  s: number;
}

/** The ground's things in cells along the shore (each cell decides its own, so tiles agree). */
function featuresIn(p: BankP, x0: number, x1: number, seed: number): Feature[] {
  const out: Feature[] = [];
  const C = 140;
  for (let i = Math.floor(x0 / C) - 1; i <= Math.floor(x1 / C) + 1; i++) {
    const r = rng(seed * 31 + i * 7919 + 5);
    // a puddle in some cells, lying in the low ground (a lens: the ground is seen from just above),
    // sometimes a smaller one beside it
    if (r() < 0.5) {
      const x = (i + r()) * C, y = 10 + r() * r() * 60, rx = 18 + r() * 50;
      out.push({ kind: "puddle", x, y, r: rx, s: Math.floor(r() * 1e6) });
      if (r() < 0.4) out.push({ kind: "puddle", x: x + (r() < 0.5 ? -1 : 1) * rx * (0.9 + 0.6 * r()), y: y + 3 + r() * 10, r: rx * (0.25 + 0.3 * r()), s: Math.floor(r() * 1e6) });
    }
    // stones in a loose cluster (two or three, then none for a while)
    if (r() < 0.6) {
      const cx = (i + r()) * C, n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const x = cx + (r() - 0.5) * 40, edge = r() < 0.55;
        out.push({ kind: "stone", x, y: edge ? -groundTop(p, x, seed) + 1 + r() * 2 : 6 + r() * 70, r: 2 + r() * r() * 9, s: Math.floor(r() * 1e6) });
      }
    }
    // grass clumps of very different sizes, in groups
    const nt = Math.floor(r() * r() * 8);
    const gx = (i + r()) * C;
    for (let k = 0; k < nt; k++) {
      const x = gx + (r() - 0.5) * 70, y = r() < 0.5 ? -groundTop(p, x, seed) + 1.5 : 4 + r() * 90;
      out.push({ kind: "tuft", x, y, r: 5 + r() * r() * 26, s: Math.floor(r() * 1e6) });
    }
    // lily pads on the water's last rows, by the mud
    if (r() < 0.5) {
      const cx = (i + r()) * C, n = 1 + Math.floor(r() * 5);
      for (let k = 0; k < n; k++) {
        const x = cx + (r() - 0.5) * 50;
        out.push({ kind: "pad", x, y: -groundTop(p, x, seed) - 1 - r() * 4, r: 3 + r() * 8, s: Math.floor(r() * 1e6) });
      }
    }
  }
  return out;
}

/** Puddles holding this point: its lens [rx, ry], centre, or null. */
function puddleAt(fs: Feature[], lx: number, ly: number): Feature | null {
  for (const f of fs) {
    if (f.kind !== "puddle") continue;
    if (Math.abs(lx - f.x) > f.r * 1.4) continue;
    // a lens drawn out along the shore, its rim wandering (never an ellipse)
    const ry = f.r * 0.2 + 2;
    const dx = (lx - f.x) / f.r, dy = (ly - f.y - (vnoise1(lx / 23, f.s + 1) - 0.5) * ry * 0.8) / ry;
    const wob = (vnoise1(lx / 13, f.s) - 0.5) * 0.4 + (vnoise1(lx / 4, f.s + 2) - 0.5) * 0.12;
    if (dx * dx + dy * dy < 1 + wob) return f;
  }
  return null;
}

/**
 * The ground's body at (lx, ly): s px under its top. The near shore from just above it, at the
 * camera's feet and in the bank's shade: a wet edge at the water, then grass and mud in big soft
 * patches drawn out along the shore, a few lit stretches where it lies open to the sky, darker and
 * quieter toward the camera.
 */
function groundCol(c: PaintCtx, lx: number, ly: number, s: number, slope: number, x: number, y: number, seed: number): number {
  const near = clamp((ly + 10) / 140, 0, 1);
  const m = vnoise(lx / 150, ly / 24, seed + 50) * 0.8 + vnoise(lx / 47, ly / 11, seed + 51) * 0.2;
  const mud = m < 0.4 - 0.1 * near + (s < 12 ? 0.08 : 0);
  // the top edge: the sunward side of a lump catches a warm rim; mud meeting the water has a broken
  // bright wet line, then a dark wet band
  if (s < 1) {
    if (slope > 0.22) return mud ? P.earth[2]! : P.moss[2]!;
    if (mud && vnoise1(lx / 5, seed + 53) > 0.62) return P.jade[2]!;
    return mud ? P.earth[4]! : P.moss[4]!;
  }
  const wetH = (mud ? 2 : 1) + 3 * vnoise1(lx / 9, seed + 54);
  if (s < wetH) return mud ? P.pine[4]! : P.moss[6]!;
  // light: big shapes of light and shade along the shore, a lit lawn along the top going down into
  // the bank's shade, darker and quieter nearer the camera
  const big = vnoise(lx / 190, ly / 34, seed + 55) * 0.75 + vnoise(lx / 60, ly / 16, seed + 56) * 0.25;
  const lawn = clamp(1 - s / (16 + 30 * vnoise1(lx / 70, seed + 57)), 0, 1);
  let t = 0.28 + near * 0.6 + (big - 0.5) * (0.95 - near * 0.5) - lawn * 0.26;
  if (mud) return step(c, [P.earth[3]!, P.earth[4]!, P.earth[5]!, P.pine[4]!, P.pine[5]!], t + 0.08, x, y);
  return step(c, [P.moss[4]!, P.moss[5]!, P.moss[6]!, P.moss[7]!, P.pine[4]!, P.pine[5]!], t, x, y);
}

// ---------------------------------------------------------------------------
// the landforms' bodies

/**
 * A mass's colour at a point of lobe j: shaded as a rounded form (a sphere-ish normal from the lobe,
 * bumped by lumps at two scales) in the one sun; a warm rim where the sunward silhouette is; a moss
 * cap on rock that faces up; cracks and fused fissures in rock; wet and dark at a foot in the ground.
 */
function massCol(c: PaintCtx, m: Mass, j: number, lx: number, ly: number, s: number, x: number, y: number): number {
  const L = m.lobes[j]!;
  const sd = L.seed;
  // the form's normal: the gradient of the lobes' smooth union, its tilt growing toward the edge
  const e = 2;
  const f0 = formR(m, lx, ly);
  let gx = formR(m, lx + e, ly) - formR(m, lx - e, ly), gy = formR(m, lx, ly + e) - formR(m, lx, ly - e);
  const gl = Math.hypot(gx, gy) || 1;
  gx /= gl; gy /= gl;
  const r = Math.pow(clamp(f0, 0, 1), 1.4) * 0.96;
  const nx = gx * r, ny = gy * r;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  // backlit: the sun on what faces up and left, the sky on what faces up, the rest in shade
  const sun = Math.max(0, nx * LIT[0] + ny * LIT[1] + nz * LIT[2]);
  const lam = sun * 0.78 + (0.5 - 0.5 * ny) * 0.32 - 0.16;
  // deeper down (nearer the ground and the camera) the form sinks into the bank's shade
  let t = (L.rock ? 0.86 : 0.84) - lam * 0.95 + clamp((ly - (m.base ?? 0) - 10) / 220, 0, 0.18) + (m.dark ?? 0);
  // the steps' edges wander so no tone follows the outline round: grass in tussocks drawn out along
  // the slope; limestone in long vertical stains where water runs down it
  if (L.rock) t += (vnoise(lx / 31, ly / 23, sd + 30) - 0.5) * 0.26 + (vnoise(lx / 9, ly / 8, sd + 31) - 0.5) * 0.08;
  else t += (vnoise(lx / 19, ly / 6, sd + 30) - 0.5) * 0.2 + (vnoise(lx / 6, ly / 2.5, sd + 31) - 0.5) * 0.06;
  // the sunward silhouette: a warm rim
  const e1 = Math.max(1, 1 / c.d);
  const rimEdge = lam > 0.3 && lobeOf(m, lx - e1 * 0.6, ly - e1) < 0;
  // wet and dark at a foot standing in the ground
  const foot = footLine(m, lx);
  const wet = foot !== Infinity && ly > foot - (L.rock ? 4 + 3 * vnoise1(lx / 9, sd + 13) : 2.5);
  if (L.rock) {
    // a moss cap on what faces up, thick on the lit crown, dripping over the lip
    const up = clamp(-ny / Math.max(0.2, r) - 0.3, 0, 1);
    // (in patches: thick, dripping, then bare rock; never a line along the outline)
    const patch = vnoise1(lx / 37, sd + 15) * 0.75 + vnoise1(lx / 11, sd + 18) * 0.25;
    const mossD = patch < 0.42 ? 0 : (3 + 14 * up * (0.4 + 0.6 * vnoise1(lx / 13, sd + 14))) * clamp((patch - 0.42) * 6, 0, 1) + (vnoise1(lx / 3.3, sd + 16) > 0.7 && up > 0.15 ? 7 * vnoise1(lx / 1.7, sd + 17) : 0);
    if (s < mossD && !wet) {
      if (rimEdge || s < 1) return lam > 0.55 ? P.moss[2]! : P.moss[3]!;
      return step(c, [P.moss[2]!, P.moss[3]!, P.moss[4]!, P.moss[5]!, P.moss[6]!, P.moss[7]!, P.pine[4]!], t - 0.05, x, y);
    }
    if (rimEdge) return lam > 0.6 ? P.paper[2]! : P.karst[2]!;
    // fissures where two lobes meet: open low down in places, closed (fused) up on the crown
    for (let i = 0; i < m.lobes.length; i++) {
      if (i === j) continue;
      const qi = lobeQ(m.lobes[i]!, lx, ly), qj = lobeQ(L, lx, ly);
      if (qi < 1.06 && Math.abs(qi - qj) < 0.03 && s > 14 && vnoise1(ly / 19 + i * 3.1, sd + 25) > 0.62 && lam < 0.5) return P.karst[8]!;
    }
    // broken bedding: a ledge here and there across the lobe, its lip catching the light and a dark
    // undercut under it; it runs a while, then dies out (never a ruled line, never a grid)
    const per = 42 + 30 * hash1(3, sd);
    const bed = ly + (lx - L.cx) * (hash1(4, sd) - 0.5) * 0.3 + (vnoise1(lx / 31, sd + 32) - 0.5) * 9;
    const bi = Math.floor(bed / per), bp = bed - bi * per;
    const shelf = vnoise1(lx / 70 + bi * 5.3, sd + 33);
    if (s > 16 && shelf > 0.6) {
      // a shelf where the beds step back: a soft shadow under the overhanging bed, darkest at its
      // deepest; no lit line, no ruled edge (it fades in and out along the face)
      const dep = (shelf - 0.6) / 0.4;
      const sw = 3 + 6 * dep;
      if (bp > per - sw) t += 0.2 * dep + 0.1;
    }
    // stains where water runs down from a ledge or the crown: a few channels, each its own width
    const ch = Math.floor((lx + (vnoise1(ly / 17, sd + 34) - 0.5) * 5) / 11);
    if (hash1(ch, sd + 35) < 0.22 && s > 4) t += 0.14 * clamp(1 - (s - 4) / (50 + 60 * hash1(ch, sd + 36)), 0, 1);
    // karren: rain-cut grooves down from the crown, a few in a group, each its own length (a dark
    // groove, its left lip lit), dying out down the face
    const gw = 5 + 3 * vnoise1(ly / 40, sd + 38);
    const gx = lx + (vnoise1(ly / 9, sd + 39) - 0.5) * 2.2;
    const gi = Math.floor(gx / gw), gf = gx / gw - gi;
    const gl = 8 + 26 * hash1(gi, sd + 40);
    if (vnoise1(gi * 0.31, sd + 41) > 0.55 && hash1(gi, sd + 42) < 0.6 && s > mossD + 1 && s < gl && lam > 0.1) {
      if (gf < 0.2) return P.karst[6]!;
      if (gf < 0.36) t -= 0.18;
    }
    // pits and lichen on the lit stone, sparse
    if (lam > 0.25 && s > 3) {
      const ph = hash(Math.floor(lx / 2), Math.floor(ly / 1.5), sd + 43);
      if (ph < 0.01) return P.karst[7]!;
    }
    // a crack or two down from notches in the crown, closing as they go
    for (let f = 0; f < 2; f++) {
      if (hash1(f + 20, sd) > 0.6) continue;
      const fx0 = L.cx + (hash1(f + 21, sd) - 0.5) * (L.aL + L.aR) * 0.6;
      const len = (L.mid - L.top) * (0.35 + 0.5 * hash1(f + 22, sd));
      const d0 = ly + massTop(m, fx0);
      if (d0 < 0 || d0 > len) continue;
      // (it zigzags: short runs, then a jog sideways where it follows a joint)
      const jog = Math.floor(d0 / (5 + 6 * hash1(f + 25, sd)));
      const fx = fx0 + (hash1(jog, sd + 26 + f) - 0.5) * 5 + (vnoise1(ly / 4, sd + 23 + f) - 0.5) * 1.6 + d0 * (hash1(f + 24, sd) - 0.5) * 0.5;
      const wdt = 2 * (1 - d0 / len);
      const dd = lx - fx;
      if (dd >= 0 && dd < Math.max(0.7, wdt)) return wet ? P.pine[5]! : P.karst[8]!;
      if (dd >= -1.2 && dd < 0 && lam > 0) return P.karst[3]!;
    }
    if (wet) t += 0.3;
    return step(c, [P.karst[2]!, P.karst[3]!, P.karst[4]!, P.karst[5]!, P.karst[6]!, P.karst[7]!, P.karst[8]!, P.pine[5]!], t, x, y);
  }
  if (rimEdge) return lam > 0.55 ? P.moss[1]! : P.moss[2]!;
  if (wet) t += 0.25;
  return step(c, [P.moss[2]!, P.moss[3]!, P.moss[4]!, P.moss[5]!, P.moss[6]!, P.moss[7]!, P.pine[4]!, P.pine[5]!], t, x, y);
}

// ---------------------------------------------------------------------------
// painting

/** The ground: its body from the top down, the puddles, the shadows the masses cast on it. */
function paintGround(c: PaintCtx, p: BankP, L: Mass[], fs: Feature[]): void {
  const b = c.buf, seed = c.seed;
  const X0 = Math.max(b.ox, Math.floor(c.X(-40))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w + 40)));
  for (let x = X0; x < X1; x++) {
    const lx = LX(c, x);
    const T = groundTop(p, lx, seed);
    const slope = (groundTop(p, lx + 1.5, seed) - groundTop(p, lx - 1.5, seed)) / 3;
    const near = L.filter((m) => lx > m.x0 - 30 && lx < m.x1 + 60);
    const Y0 = Math.max(b.oy, Math.floor(c.Y(-T) - 1)), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.h)));
    for (let y = Y0; y < Y1; y++) {
      const ly = LY(c, y);
      if (ly < -T) continue;
      const s = ly + T;
      let col = groundCol(c, lx, ly, s, slope, x, y, seed);
      // a puddle of sky: two pale jade steps (the far half paler) inside a dark mud lip
      const pd = s > 5 ? puddleAt(fs, lx, ly) : null;
      if (pd) {
        // the lip: dark mud all round, thicker along the near (lower) rim; inside, the sky: the far
        // half paler, the near half a step deeper, the far bank's grass a dark line under the lip
        const e1 = Math.max(1, 1 / c.d);
        const inIn = puddleAt([pd], lx, ly - e1) !== null, inOut = puddleAt([pd], lx, ly + e1 * 1.6) !== null;
        const inL = puddleAt([pd], lx - e1 * 1.5, ly) !== null, inR = puddleAt([pd], lx + e1 * 1.5, ly) !== null;
        if (!inOut) col = P.pine[5]!;
        else if (!inIn || !inL || !inR) col = P.earth[5]!;
        else if (puddleAt([pd], lx, ly - e1 * 2.2) === null) col = P.pine[3]!;
        else {
          const dy = (ly - pd.y) / (pd.r * 0.2 + 2);
          col = dy < -0.05 + (vnoise1(lx / 7, pd.s) - 0.5) * 0.5 ? P.jade[1]! : P.jade[3]!;
        }
      }
      // the shadows the masses cast on the ground (down and right, away from the sun) and the dark
      // contact under a foot
      for (const m of near) {
        const f = footLine(m, lx);
        if (f !== Infinity && ly >= f - 0.5 && ly < f + 3 && lobeOf(m, lx, f - 1.5) >= 0) { col = ly < f + 1.5 ? P.pine[5]! : P.pine[4]!; break; }
        let hit = false;
        for (const dd of [3, 7, 12, 19]) if (lobeOf(m, lx + LIT[0] * dd * 1.4, ly + LIT[1] * dd) >= 0) { hit = true; break; }
        if (hit) { col = shade(col); break; }
      }
      b.set(x, y, col);
    }
  }
}

/** One step darker in the ground's own materials (a cast shadow). */
function shade(col: number): number {
  for (const ramp of [P.moss, P.earth, P.pine, P.jade, P.karst, P.stone] as readonly (readonly number[])[]) {
    const i = ramp.indexOf(col);
    if (i >= 0) return ramp === P.jade ? P.jade[Math.min(ramp.length - 1, i + 3)]! : i + 2 < ramp.length ? ramp[i + 2]! : P.pine[5]!;
  }
  return col;
}

/** The ground's things: stones (lit upper left, a wet foot), grass clumps, lily pads on the water. */
function paintFeatures(c: PaintCtx, p: BankP, L: Mass[], fs: Feature[]): void {
  const b = c.buf, d = c.d, seed = c.seed;
  const covered = (x: number, y: number): boolean => L.some((m) => lobeOf(m, x, y) >= 0);
  for (const f of fs) {
    if (!b.touches(Math.floor(c.X(f.x - f.r * 2 - 30)), Math.floor(c.Y(f.y - 60)), Math.ceil(c.X(f.x + f.r * 2 + 30)), Math.ceil(c.Y(f.y + 10)))) continue;
    if (f.kind === "stone") {
      if (covered(f.x, f.y - 1)) continue;
      // a rounded stone half in the mud: lit on its upper left, a dark right flank, a wet foot
      const R = f.r, lean = (hash1(1, f.s) - 0.5) * 0.6;
      for (let oy = -R; oy <= 0.6; oy += 0.5) for (let ox = -R * 1.35; ox <= R * 1.35; ox += 0.5) {
        const qx = ox / (R * 1.35) - lean * (oy / R), qy = oy / R;
        if (qx * qx + qy * qy > 1) continue;
        const lit = -0.62 * qx - 0.78 * qy;
        const col = oy > -1.1 ? P.karst[8]! : lit > 0.62 ? P.stone[2]! : lit > 0.15 ? P.stone[3]! : lit > -0.35 ? P.stone[4]! : P.stone[5]!;
        dot(c, f.x + ox, f.y + oy, col);
      }
      // its shadow on the ground, down and right
      for (let ox = 0; ox <= R * 1.6; ox += 0.5) dot(c, f.x + R * 0.4 + ox, f.y + 1, P.pine[5]!);
    } else if (f.kind === "tuft") {
      if (d < 0.18 || covered(f.x, f.y - 2)) continue;
      const n = 4 + Math.floor(f.r * 0.5);
      for (let k = 0; k < n; k++) {
        const hk = hash1(k + 9, f.s);
        const len = f.r * (0.35 + 0.65 * hk);
        // nearer (lower) clumps are darker; the sunlit ones lean their tips into the light
        const lit = hash1(k + 1, f.s) * (1 - clamp(f.y / 90, 0, 0.8));
        grass(c, f.x + (hash1(k, f.s) - 0.5) * (4 + f.r * 0.5), f.y, len, (hash1(k + 19, f.s) - 0.45) * 1.1, (hash1(k + 29, f.s) - 0.45) * 1.4 * (len / 20), lit, len > 20 && hk > 0.6);
      }
    } else if (f.kind === "pad") {
      if (d < 0.2 || covered(f.x, -groundTop(p, f.x, seed) - 1)) continue;
      // a lily pad lying on the water just beyond the edge: a thin lens, notched, lit on top
      const rx = f.r, notch = rx * (0.3 - 0.6 * hash1(2, f.s));
      for (let ox = -rx; ox <= rx; ox += 0.5) {
        if (Math.abs(ox - notch) < 0.8) continue;
        const th = 1.5 * Math.sqrt(Math.max(0, 1 - (ox / rx) ** 2));
        dot(c, f.x + ox, f.y - th * 0.5, Math.abs(ox + rx * 0.2) < rx * 0.6 ? P.moss[4]! : P.moss[5]!);
        if (th > 0.8) dot(c, f.x + ox, f.y + 0.6, P.pine[3]!);
      }
      if (hash1(3, f.s) < 0.15) { dot(c, f.x, f.y - 2, P.paper[0]!); dot(c, f.x + 1, f.y - 2, P.blossom[1]!); }
    }
  }
}

/** A mass's body. */
function paintMassBody(c: PaintCtx, deep: number, m: Mass): void {
  const b = c.buf, d = c.d;
  const X0 = Math.max(b.ox, Math.floor(c.X(m.x0))), X1 = Math.min(b.x1, Math.ceil(c.X(m.x1)));
  for (let x = X0; x < X1; x++) {
    const lx = LX(c, x);
    const T = massTop(m, lx);
    if (T === -Infinity) continue;
    const Y0 = Math.max(b.oy, Math.floor(c.Y(-T) - d)), Y1 = Math.min(b.y1, Math.ceil(c.Y(Math.min(deep, footLine(m, lx) + 1))));
    for (let y = Y0; y < Y1; y++) {
      const ly = LY(c, y);
      const j = lobeOf(m, lx, ly);
      if (j < 0) continue;
      b.set(x, y, massCol(c, m, j, lx, ly, ly + T, x, y));
    }
  }
}

/** What grows and lies on a mass: the grass hem along a rise's crown, ferns at a rock's foot. */
function paintMassDress(c: PaintCtx, m: Mass, deep: number): void {
  const d = c.d;
  const r = rng(m.seed + 50);
  const top = (x: number): number => massTop(m, x);
  const lod = (k: number): boolean => hash1(k, m.seed + 51) < Math.min(1, d * 1.6);
  if (m.kind === "hummock" || m.kind === "lantern" || m.kind === "tuft") {
    // the grass hem: clumps of very different sizes along the crown, gaps between them, longest
    // on the crown, lit on the sunward side; never a fringe of even blades
    const n = Math.round((m.x1 - m.x0) * (m.kind === "tuft" ? 0.9 : 0.6));
    let cx = m.x0 + r() * 20, left = 0, big = 1;
    for (let i = 0; i < n; i++) {
      if (left <= 0) { cx += 4 + r() * r() * 60; left = 3 + Math.floor(r() * 14); big = 0.5 + r() * r() * 1.4; }
      left--;
      const x = cx + (r() - 0.5) * 10 * big;
      const T = top(x);
      if (T === -Infinity || T < -2) continue;
      const sl = (top(x + 2) - top(x - 2)) / 4;
      const len = (4 + r() * (m.kind === "tuft" ? m.h * 1.4 : 18) * big) * (0.55 + 0.45 * clamp(T / Math.max(1, m.h), 0, 1));
      const a0 = (r() - 0.42) * 0.9 - sl * 0.35, bend = (r() - 0.45) * 1.4 * (len / 18);
      if (lod(i)) hemBlade(c, x, -T + 2, len, a0, bend, sl > 0.08 || a0 < -0.2 ? 1 : r() < 0.3 ? 0.5 : 0);
    }
    // clumps on its face: tufts in groups, lit on the sunward side, dark ones in the shade; they
    // break the fill without ever lining up
    if (m.kind === "hummock" && d >= 0.3) {
      const nc = Math.round((m.x1 - m.x0) / 40);
      for (let i = 0; i < nc; i++) {
        const x = m.x0 + (m.x1 - m.x0) * r(), dep = 6 + r() * r() * 120;
        const T = top(x);
        if (T === -Infinity || -T + dep > deep - 30 || lobeOf(m, x, -T + dep) < 0 || lobeOf(m, x, -T + dep - 6) < 0) continue;
        const y = -T + dep;
        const sl = (top(x + 3) - top(x - 3)) / 6;
        const sunny = sl > 0.05 && dep < 40;
        const nb = 5 + Math.floor(r() * 9), sz = 5 + r() * 11 * (1 - dep / 160);
        for (let k = 0; k < nb; k++) {
          const bx = x + (r() - 0.5) * (6 + sz * 1.4), len = sz * (0.4 + 0.8 * r());
          const a0 = (r() - 0.5) * 1.1, bend = (r() - 0.5) * 1.4;
          stroke(c, bladePath(bx, y + r() * 3, len, a0, bend), () => 1, (u) => (sunny ? (u > 0.6 ? P.moss[4]! : P.moss[5]!) : dep > 40 ? (u > 0.6 ? P.moss[7]! : P.pine[4]!) : u > 0.6 ? P.moss[5]! : P.moss[6]!));
        }
      }
    }
  } else if (m.kind === "reeds") {
    // the stand's foot: broad reed leaves, dark, arching out (the tall reeds are sprites)
    const n = Math.round(m.w * 0.5);
    for (let i = 0; i < n; i++) {
      const x = m.x + m.w * (0.04 + 0.92 * r());
      const u = (x - m.x) / m.w;
      const T = top(x);
      const len = (6 + r() * m.h * 1.1) * (0.4 + 0.6 * Math.sin(Math.PI * clamp(u, 0.05, 0.95)));
      if (T !== -Infinity && lod(i)) grass(c, x, -T + 1.5, len, (r() - 0.5) * 0.6, (r() - 0.5) * 2.2 * (len / 30), r() * 0.6, len > 16);
    }
  } else if (m.kind === "boulder" || m.kind === "crag") {
    // where the rock stands above the ground: its visible ends at the waterline
    let ra = Infinity, rb = -Infinity;
    for (let x = m.x0; x <= m.x1; x += 2) if (top(x) > 4) { ra = Math.min(ra, x); rb = Math.max(rb, x); }
    if (ra === Infinity) return;
    // grass and ferns where its foot meets the ground (more on the lit side)
    const nf = 2 + Math.floor(r() * 3);
    for (let i = 0; i < nf; i++) {
      const side = r() < 0.6 ? -1 : 1;
      const fx = side < 0 ? ra + 4 + r() * 18 : rb - 4 - r() * 18;
      const foot = footLine(m, fx);
      const fy = foot !== Infinity ? foot : 8 + r() * 20;
      if (d >= 0.4) fern(c, fx, fy, 12 + r() * 20, side * (0.35 + 0.6 * r()), m.seed + 60 + i);
    }
    // on its crown: a shrub or two rooted in the moss and grass in tufts, lit on the sun side;
    // they break its skyline (never a clean dome)
    const ns = m.kind === "crag" ? 2 + Math.floor(r() * 2) : r() < 0.6 ? 1 : 0;
    for (let i = 0; i < ns; i++) {
      // the flattest place on the crown near a random spot
      let x = ra + (rb - ra) * (0.15 + 0.6 * r()), best = Infinity;
      for (let k = -30; k <= 30; k += 3) {
        const xx = x + k, ss = Math.abs(top(xx + 4) - top(xx - 4)) / 8 - top(xx) * 0.004;
        if (ss < best) { best = ss; x = xx; }
      }
      const T = top(x), sl = (top(x + 4) - top(x - 4)) / 8;
      if (T < 12 || Math.abs(sl) > 0.8 || d < 0.3) continue;
      const R = (m.kind === "crag" ? 9 : 6) + r() * 9;
      clump(c, x, -T - R * 0.35, R, P.moss.slice(1, 6), P.pine.slice(1), 0.5, m.seed + 90 + i * 13, 0.72);
      clump(c, x + R * (0.6 + 0.4 * r()) * (r() < 0.5 ? -1 : 1), -T - R * 0.15, R * (0.45 + 0.25 * r()), P.moss.slice(2, 7), P.pine.slice(2), 0.58, m.seed + 95 + i * 13, 0.7);
    }
    let cx = ra + r() * 10, left = 0;
    for (let i = 0; i < Math.round((rb - ra) * 0.35); i++) {
      if (left <= 0) { cx += 6 + r() * r() * 70; left = 2 + Math.floor(r() * 8); }
      left--;
      const x = cx + (r() - 0.5) * 8;
      const T = top(x);
      if (T === -Infinity || T < 8) continue;
      const sl = (top(x + 2) - top(x - 2)) / 4;
      if (lod(i)) hemBlade(c, x, -T + 1.5, 3 + r() * 9, (r() - 0.45) * 1.1, (r() - 0.4) * 1.1, sl > 0.05 ? 1 : 0);
    }
  }
}

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
    if (v < 0.1) return 0.2;
    if (v < 0.12) return 0.15;
    if (v < 0.47) return 0.075 + (v > 0.27 && v < 0.3 ? 0.014 : 0) - (v - 0.12) * 0.02;
    if (v < 0.5) return 0.11;
    if (v < 0.57) return 0.11 + (v - 0.5) / 0.07 * 0.065;
    if (v < 0.59) return 0.175;
    if (v < 0.75) return 0.115;
    if (v < 0.77) return 0.16;
    if (v < 0.91) {
      const k = (v - 0.77) / 0.14;
      return 0.32 * Math.pow(1 - k, 1.6) + 0.035;
    }
    if (v < 0.94) return 0.045;
    const k = (v - 0.94) / 0.06;
    return 0.055 * Math.sin(Math.PI * clamp(0.15 + k * 0.85, 0, 1));
  };
  for (let yy = Y0; yy < Y1; yy++) {
    for (let xx = X0; xx < X1; xx++) {
      const lx = LX(c, xx) - x, ly = LY(c, yy) - y;
      const ux = lx * ca + ly * sa, uy = -lx * sa + ly * ca;
      const v = -uy / H;
      if (v < -0.02 || v > 1) continue;
      let hw = half(v) * H;
      if (v >= 0.77 && v < 0.84) hw += H * 0.02 * Math.max(0, 1 - Math.abs(v - 0.785) / 0.02);
      if (Math.abs(ux) > hw) continue;
      const q = ux / Math.max(0.5, hw);
      let t = q < -0.55 ? 0.22 : q < 0.15 ? 0.42 : q < 0.6 ? 0.58 : 0.74;
      if ((v > 0.59 && v < 0.64) || (v > 0.47 && v < 0.5) || (v > 0.1 && v < 0.14)) t += 0.18;
      if (v > 0.63 && v < 0.72 && Math.abs(ux) < H * 0.045) { b.set(xx, yy, P.ink[1]!); continue; }
      const roof = v > 0.8 && v < 0.91;
      const mv = vnoise(ux / 3, v * 40, seed + 41);
      if ((roof && mv > 0.45 && q < 0.7) || (v > 0.55 && v < 0.59 && mv > 0.6)) {
        b.set(xx, yy, q < -0.3 ? P.moss[4]! : P.moss[5]!);
        continue;
      }
      t += (vnoise(ux / 2.5, v * 30, seed + 42) - 0.5) * 0.16;
      if (v < 0.3) t += 0.1 * (1 - v / 0.3);
      b.set(xx, yy, step(c, P.stone, clamp(0.4 + t * 0.62, 0, 1), xx, yy, 0.2));
    }
  }
}

export const bank = definePainter<BankP>("op.bank", {
  bounds(p) {
    let x0 = -60, x1 = p.w + 60, y0 = -90;
    const specs = p.masses ?? generate(p, 0);
    for (const m of specs) {
      const tall = m.kind === "lantern" ? m.h * 1.1 : m.h * 1.25 + 40;
      // (a flank that runs off the bottom keeps spreading down to the bank's foot)
      x0 = Math.min(x0, m.x - m.w * 0.6 - 120 - p.h * 0.55);
      x1 = Math.max(x1, m.x + m.w * 1.6 + 120 + p.h * 0.55);
      y0 = Math.min(y0, -tall - 20);
    }
    if (!p.masses) { x0 = Math.min(x0, -400 - p.h * 0.55); x1 = Math.max(x1, p.w + 400 + p.h * 0.55); y0 = Math.min(y0, -260); }
    return [x0, y0, x1, p.h + 4];
  },
  paint(c, p) {
    const b = c.buf;
    const L = layoutOf(p, c.seed);
    const lx0 = c.lx(b.ox) - 60, lx1 = c.lx(b.x1) + 60;
    const fs = featuresIn(p, lx0, lx1, c.seed).filter((f) => f.x > 30 && f.x < p.w - 30);
    paintGround(c, p, L, fs);
    paintFeatures(c, p, L, fs);
    for (const m of L) {
      if (!b.touches(Math.floor(c.X(m.x0 - 40)), Math.floor(c.Y(-m.h * 1.3 - 40)), Math.ceil(c.X(m.x1 + 40)), b.y1)) continue;
      paintMassBody(c, p.h, m);
      paintMassDress(c, m, p.h);
      if (m.kind === "lantern") {
        const lx0m = m.x + m.w * (0.38 + 0.2 * hash1(4, m.seed));
        const lean = m.lean ?? (hash1(5, m.seed) < 0.5 ? -1 : 1) * (0.06 + 0.06 * hash1(6, m.seed));
        lantern(c, lx0m, -massTop(m, lx0m) + 3, m.h, lean, m.seed + 54);
      }
    }
    // (the lantern's tall grass in front of its foot)
    for (const m of L) {
      if (m.kind !== "lantern") continue;
      const r = rng(m.seed + 70);
      for (let i = 0; i < 40; i++) {
        const x = m.x + m.w * (0.2 + 0.6 * r());
        const T = massTop(m, x);
        const len = 8 + r() * 30;
        if (T !== -Infinity) grass(c, x, -T + 2, len, (r() - 0.45) * 0.8, (r() - 0.45) * 1.4 * (len / 30), r(), len > 24);
      }
    }
  },
});

/** The reed stands' places, for the reed sprites: [x, width, height, density] in the shore's own px. */
export function reedBeds(p: BankP, seed: number): [number, number, number, number][] {
  return layoutOf(p, seed).filter((m) => m.kind === "reeds").map((m) => [m.x + m.w * 0.06, m.w * 0.88, m.reed ?? Math.round(m.h * 2.2 + 40), m.dense ?? 3] as [number, number, number, number]);
}

/** The shore's top at x, px above the waterline (so reeds stand on it, not in the air). */
export function bankTopAt(p: BankP, seed: number, x: number): number {
  let t = groundTop(p, x, seed);
  for (const m of layoutOf(p, seed)) t = Math.max(t, massTop(m, x));
  return t;
}

// ---------------------------------------------------------------------------
// op.shallows (front plane): the shore's near shallows, framing the catch's bottom corners (the
// close band does not draw P5, so these are the near ground there; at play zoom they are a layer of
// shallows between the jetty's reflection and P5). A corner of the near shore curving toward the
// camera: a mud bank on its outer side running off the bottom of the frame, its inner flank going
// down into the water; a half-sunk mossy boulder standing in the water by it; a sunk log or old
// broken stubs; lily pads on the open water at its inner end. Every thing standing in the water
// meets it through a wet dark band and a 1 px bright wet line and has its own reflection painted
// under its waterline (a step darker, broken by ripples, fading), because the lake does not mirror
// front-plane parts below its own waterline. Backlit like P5: dark bodies, lit tops, a warm rim.
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
  /** "log" (a sunk trunk) or "stubs" (old broken piles) by the boulder (default "log"). */
  wood?: "log" | "stubs";
}

/**
 * The shallows' bank: a grassy mound high at the outer end, its inner end rounding down into the
 * water, its flanks spreading as they come toward the camera (it runs off the bottom of the frame).
 */
function shoreOf(p: ShallowsP, seed: number): Mass {
  return cached(`shallows|${seed}|${p.w}|${p.wl}|${p.deep}|${p.side}|${p.h}`, () => {
    const H = p.h ?? 30, dir = p.side < 0 ? 1 : -1, out = p.side < 0 ? 0 : p.w;
    const r = rng(seed + 41);
    const lobe = (cx: number, h: number, aIn: number, aOut: number, k: number, n: number): Lobe => ({
      cx, top: p.wl - h, mid: p.wl + 10 + 8 * r(), bot: Infinity, aL: dir > 0 ? aOut : aIn, aR: dir > 0 ? aIn : aOut, k, lean: dir * (r() - 0.3) * 6, rock: false, seed: seed + 300 + n * 31,
    });
    // (a low bank: flat-topped, slumped, its inner end a long low shoulder into the water)
    const lobes = [
      lobe(out + dir * p.w * 0.02, H, p.w * 0.42, p.w * 0.4, 3.2, 0),
      lobe(out + dir * p.w * 0.4, H * 0.42, p.w * 0.3, p.w * 0.2, 2.8, 1),
    ];
    const m: Mass = { kind: "hummock", x: Math.min(out, out + dir * p.w), w: p.w, h: H, seed: seed + 400, lobes, x0: Infinity, x1: -Infinity, tops: new Float32Array(0), footY: Infinity, base: p.wl, dark: 0.12 };
    return finishMass(m, p.deep);
  });
}

function inShore(p: ShallowsP, lx: number, ly: number, seed: number): boolean {
  return lobeOf(shoreOf(p, seed), lx, ly) >= 0;
}

export const shallows = definePainter<ShallowsP>("op.shallows", {
  bounds(p) {
    const H = p.h ?? 30;
    return [-p.w * 0.6 - 40 - p.deep * 0.55, p.wl - H * 1.6 - 34, p.w * 1.6 + 40 + p.deep * 0.55, p.deep + 4];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const H = p.h ?? 30;
    const r = rng(seed + 9);
    const out = p.side < 0 ? 0 : p.w, inn = p.side < 0 ? p.w : 0, dir = p.side < 0 ? 1 : -1;
    // the boulder in the water: x centre, half width, height above the waterline
    const bx = out + dir * p.w * (0.68 + 0.06 * r()), bhw = p.w * (0.17 + 0.04 * r()), bh = H * (0.85 + 0.15 * r());
    const lean = (hash1(1, seed) - 0.5) * 0.5;
    const boulder = (lx: number, ly: number): boolean => {
      // a lopsided rounded top, the water cutting it (half sunk); lumps at three scales
      const q = (lx - bx) / bhw;
      if (Math.abs(q) > 1.3) return false;
      const qq = q - (lean * (p.wl - ly)) / Math.max(1, bh);
      if (Math.abs(qq) >= 1) return false;
      const top = p.wl - bh * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(qq), 2.4)), 0.45) - (vnoise1(lx / 9, seed + 5) - 0.5) * 4 - (vnoise1(lx / 3, seed + 6) - 0.5) * 1.2;
      return ly >= top;
    };
    const X0 = Math.max(b.ox, Math.floor(c.X(-p.w * 0.6 - 40 - p.deep * 0.55))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w * 1.6 + 40 + p.deep * 0.55)));
    // --- reflections under the waterline (the boulder's and the bank's), broken by ripples, fading
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      for (let y = Math.max(b.oy, Math.floor(c.Y(p.wl))); y < Math.min(b.y1, Math.ceil(c.Y(p.wl + H * 1.7))); y++) {
        const ly = LY(c, y);
        if (inShore(p, lx, ly, seed)) continue;
        const my = 2 * p.wl - ly;
        const row = Math.floor((ly - p.wl) / 2.2);
        const shift = (hash1(row, seed + 11) - 0.5) * 2.4 * Math.min(1, (ly - p.wl) / 20);
        const fade = (ly - p.wl) / (H * 1.6);
        if (hash1(row, seed + 12) < 0.18 + fade * 0.5 || dith(c, x, y) < fade * 0.9) continue;
        const mx = lx + shift;
        if (boulder(mx, my)) b.set(x, y, my > p.wl - 4 ? P.pine[5]! : fade < 0.35 ? P.karst[7]! : P.jade[6]!);
        else if (my < p.wl && inShore(p, mx, my, seed)) b.set(x, y, fade < 0.3 ? P.pine[4]! : P.jade[6]!);
      }
    }
    // --- the bank: backlit grass and mud, its top lit, a grass hem; where its flank meets the water
    // (below its waterline the shore curves toward the camera) a dark wet band and a bright wet line
    const bank = shoreOf(p, seed);
    paintMassBody(c, p.deep, bank);
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      for (let y = Math.max(b.oy, Math.floor(c.Y(p.wl - 2))); y < Math.min(b.y1, Math.ceil(c.Y(p.deep))); y++) {
        const ly = LY(c, y);
        if (!inShore(p, lx, ly, seed)) continue;
        const e1 = Math.max(1, 1 / d);
        // how far in from the water on the open side
        let k = 0;
        while (k < 6 && inShore(p, lx + dir * e1 * (k + 1), ly, seed)) k++;
        if (k >= 6) continue;
        b.set(x, y, k < 1 ? (vnoise1(ly / 6, seed + 14) > 0.45 ? P.jade[3]! : P.pine[5]!) : k < 3 + 2 * vnoise1(ly / 7, seed + 13) ? P.pine[5]! : P.pine[4]!);
      }
    }
    paintMassDress(c, bank, p.deep);
    // --- lily pads on the open water off the bank's inner end, in a loose drift
    const nl = 7 + Math.floor(r() * 6);
    for (let i = 0; i < nl; i++) {
      const px = inn - dir * p.w * (0.05 + 0.4 * r() * r()), py = p.wl + 6 + r() * (p.deep - p.wl) * 0.55, rx = 3 + r() * 7 * (0.6 + (py - p.wl) / (p.deep - p.wl));
      if (inShore(p, px, py, seed) || d < 0.2) continue;
      const th = Math.max(1.2, rx * 0.22);
      for (let ox = -rx; ox <= rx; ox += 0.5) {
        const v = Math.sqrt(Math.max(0, 1 - (ox / rx) ** 2));
        if (Math.abs(ox - rx * 0.25) < 0.7 && i % 3 !== 0) continue;
        for (let oy = -th * v; oy <= th * v * 0.6; oy += 0.5) dot(c, px + ox, py + oy, oy < -th * v * 0.4 ? (ox < 0 ? P.moss[3]! : P.moss[4]!) : oy > 0 ? P.pine[4]! : P.moss[5]!);
      }
      if (hash1(i, seed + 15) < 0.2) { dot(c, px + rx * 0.3, py - th - 1, P.paper[1]!); dot(c, px + rx * 0.3 + 1, py - th - 1, P.blossom[1]!); }
    }
    // --- the boulder: backlit limestone, a moss cap on its crown, wet dark at the water
    for (let x = Math.max(b.ox, Math.floor(c.X(bx - bhw * 1.3))); x < Math.min(b.x1, Math.ceil(c.X(bx + bhw * 1.3))); x++) {
      const lx = LX(c, x);
      for (let y = Math.max(b.oy, Math.floor(c.Y(p.wl - bh - 4))); y < Math.min(b.y1, Math.ceil(c.Y(p.wl + 1))); y++) {
        const ly = LY(c, y);
        if (!boulder(lx, ly)) continue;
        // (the wet line where the water laps it: broken, a px here and there)
        if (ly > p.wl) { if (vnoise1(lx / 4, seed + 20) > 0.55) b.set(x, y, P.jade[2]!); continue; }
        const e1 = Math.max(1, 1 / d);
        const up = !boulder(lx, ly - e1), left = !boulder(lx - e1, ly);
        const q = (lx - bx) / bhw, v = (p.wl - ly) / bh;
        const mossy = vnoise1(lx / 9, seed + 16) > 0.35;
        let s = 0;
        while (s < 14 && boulder(lx, ly - s - 1)) s++;
        let col: number;
        if (up && q < 0.3) col = mossy ? P.moss[1]! : P.paper[2]!;
        else if (up || (left && q < -0.6)) col = mossy ? P.moss[3]! : P.karst[3]!;
        else if (mossy && s < 3 + 6 * vnoise1(lx / 5, seed + 17) && v > 0.35) col = q < 0 ? P.moss[4]! : P.moss[5]!;
        else if (p.wl - ly < 3 + 2 * vnoise1(lx / 6, seed + 18)) col = P.pine[5]!;
        else col = step(c, [P.karst[4]!, P.karst[5]!, P.karst[6]!, P.karst[7]!, P.karst[8]!, P.pine[5]!], 0.62 + q * 0.3 - v * 0.4 + (vnoise(lx / 3, ly / 14, seed + 19) - 0.5) * 0.18, x, y);
        b.set(x, y, col);
      }
    }
    // --- the wood: a sunk trunk lying from the bank out into the water, or old broken stubs
    if ((p.wood ?? "log") === "log") {
      const x0 = out + dir * p.w * 0.25, x1 = out + dir * p.w * (0.95 + 0.1 * r());
      const y0 = p.wl + 14 + r() * 8, y1 = p.wl + 6 + r() * 6;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 14; k++) {
        const u = k / 14;
        pts.push([x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 2.5 + (u > 0.6 ? (u - 0.6) * 6 : 0)]);
      }
      // its reflection under it, then the log (only its upper half shows above the water)
      for (const [lx, ly] of pts) for (let o = 1; o < 6; o += 0.5) if (hash1(Math.floor(lx / 2) + o * 13, seed + 21) > 0.3) dot(c, lx, ly + o, o < 3 ? P.pine[5]! : P.jade[6]!);
      stroke(c, pts, (u) => 7 - 2.5 * u, (u, sd) => (sd < -0.55 ? (hash1(Math.floor(u * 40), seed + 22) < 0.45 ? P.moss[3]! : P.timber[3]!) : sd < 0 ? P.timber[4]! : sd < 0.45 ? P.timber[5]! : P.pine[5]!));
      for (const [lx, ly] of pts) dot(c, lx, ly + 3, P.jade[2]!);
      // its broken end: a jagged stump of a branch
      const [ex, ey] = pts[pts.length - 1]!;
      stroke(c, bladePath(ex, ey, 9 + r() * 6, dir * 0.6, -dir * 0.3), (u) => (u < 0.5 ? 2 : 1), () => P.timber[4]!);
    } else {
      const piles: [number, number, number][] = [[out + dir * p.w * 0.93, H * 1.1, 4.5], [out + dir * p.w * 1.02, H * 0.55, 3.5]];
      for (const [sx, sh, sw] of piles) {
        const ln = (r() - 0.5) * 4, top = p.wl - sh;
        // its reflection
        for (let ly = p.wl + 1; ly < p.wl + sh * 1.1; ly += 0.5) {
          const row = Math.floor((ly - p.wl) / 2.2), fade = (ly - p.wl) / (sh * 1.2);
          if (hash1(row, seed + 31) < 0.2 + fade * 0.5) continue;
          for (let o = -sw; o <= sw; o += 0.5) dot(c, sx + o + (hash1(row, seed + 32) - 0.5) * 2 - (ln * (ly - p.wl)) / sh, ly, fade < 0.4 ? P.pine[4]! : P.jade[6]!);
        }
        for (let ly = top - 3; ly <= p.wl; ly += 0.5) {
          const v = (p.wl - ly) / sh;
          const cx = sx + ln * v;
          // a jagged split top
          for (let o = -sw; o <= sw; o += 0.5) {
            const jag = top + 3 * hash1(Math.floor((o + sw) * 1.5), seed + 33 + Math.round(sx));
            if (ly < jag) continue;
            const q = o / sw;
            const col = p.wl - ly < 2.5 ? P.pine[5]! : ly - jag < 1.2 ? P.timber[2]! : q < -0.5 ? P.timber[3]! : q < 0.3 ? (v < 0.4 && hash1(Math.floor(ly), seed + 34) < 0.5 ? P.moss[5]! : P.timber[4]!) : P.timber[5]!;
            dot(c, cx + o, ly, col);
          }
        }
        for (let o = -sw - 1; o <= sw + 1; o += 0.5) dot(c, sx + o, p.wl + 0.5, P.jade[2]!);
      }
    }
  },
});

/** The shallows' bank top at x, px above its own waterline (0 where there is no bank): for its reeds. */
export function shallowsTopAt(p: ShallowsP, seed: number, x: number): number {
  const T = massTop(shoreOf(p, seed), x);
  return T === -Infinity ? 0 : Math.max(0, p.wl + T);
}
