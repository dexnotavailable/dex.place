// The env-hall kit: materials, light and the small set of drawing helpers every hall and court
// painter shares, so the whole place is lit by one set of lights and shaded by one hand.
//
// Coordinates: painters work in level-1 local px of their plane (c.X, c.Y turn them into the
// buffer's art px). A piece that wants the scene's light is told where it stands in 3D world
// px (`at: [wx, wy, rate]`); a pixel at local (lx, ly) is then at world (wx + lx / rate,
// wy + ly / rate), and `light()` answers how lit that spot is and from where.

import type { PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm, hash, vnoise } from "../../raster.ts";

export type Ramp = readonly number[];

// ---------------------------------------------------------------------------
// Materials: ramps light to dark. Composite ones run on into the warm dark (umber) so a
// surface in deep shadow sinks into the hall's dark instead of a cool black.
// ---------------------------------------------------------------------------
export const M = {
  /** Black lacquer in lamplight (warm black, its lit edges brown). */
  lacq: P.umber,
  /** Black lacquer by day (the court): the cool palace lacquer. */
  lacqDay: P.lacquer,
  /** Vermilion lacquer: columns, rails, doors. */
  verm: [P.red[0]!, P.red[1]!, P.red[2]!, P.red[3]!, P.red[4]!, P.red[5]!, P.umber[3]!, P.umber[4]!] as Ramp,
  /** Old timber, running on into the dark. */
  wood: [...P.timber, P.umber[5]!] as Ramp,
  gold: [...P.gold, P.umber[4]!] as Ramp,
  bronze: P.bronze,
  stone: [...P.stone, P.umber[4]!] as Ramp,
  /** Paper lit from in front. */
  paper: [...P.paper, P.umber[0]!, P.umber[2]!] as Ramp,
  /** Paper glowing with light behind it (lanterns, screens). */
  glow: [P.ember[0]!, P.ember[1]!, P.ember[2]!, P.ember[3]!, P.ember[4]!, P.umber[1]!, P.umber[3]!] as Ramp,
  tile: P.tile,
  ink: P.ink,
  dark: P.umber,
} as const;

// ---------------------------------------------------------------------------
// Light. One environment per place: an ambient level and a list of lights. A light is a
// soft sphere (lanterns, lamps), a slanted shaft (the skylight) or a vertical slot (daylight
// round a door). `light()` returns how strongly a world point is lit (0 dark .. 1+ hot) and
// the direction the light comes from (unit vector in the picture plane, y down).
// ---------------------------------------------------------------------------
export interface PointLight { kind: "point"; x: number; y: number; r: number; k: number }
export interface ShaftLight { kind: "shaft"; /** top centre x, y and bottom centre x, y (world px) */ x0: number; y0: number; x1: number; y1: number; w: number; k: number; /** floor pool reach either side of the foot */ pool: number }
export type Light = PointLight | ShaftLight;

export interface LightEnv {
  /** Light everywhere, before any source (0..1). */
  ambient: number;
  /** Direction of the ambient's soft key (unit, y down): where unlit things are lit from. */
  dir: [number, number];
  lights: Light[];
}

export interface Lit {
  /** Total light 0..~1.4. */
  k: number;
  /** Direction toward the strongest source (unit, picture plane). */
  dx: number;
  dy: number;
}

export function light(env: LightEnv, wx: number, wy: number): Lit {
  // the sum of every source; the direction is the light-weighted mean of where they lie, so
  // it turns smoothly between sources instead of jumping to the strongest one
  let k = env.ambient;
  let sx = env.dir[0] * env.ambient * 0.5, sy = env.dir[1] * env.ambient * 0.5;
  for (const L of env.lights) {
    let v = 0, ex = 0, ey = 0;
    if (L.kind === "point") {
      const ddx = L.x - wx, ddy = L.y - wy;
      const q = (ddx * ddx + ddy * ddy) / (L.r * L.r);
      if (q >= 1) continue;
      const f = 1 - q;
      v = L.k * f * f;
      const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      ex = ddx / d;
      ey = ddy / d;
    } else {
      // the shaft: soft-edged beam, brighter toward the floor; a pool spreads on the floor
      const t = clamp((wy - L.y0) / Math.max(1, L.y1 - L.y0), 0, 1.05);
      const ax = L.x0 + (L.x1 - L.x0) * t;
      const half = L.w / 2;
      const d = Math.abs(wx - ax) / (half * 1.5);
      const inBeam = d < 1 ? (1 - d * d) * (1 - d * d) : 0;
      const q = ((wx - L.x1) / L.pool) ** 2 + ((wy - L.y1) / (L.pool * 0.55)) ** 2;
      const pool = q < 1 ? (1 - q) * (1 - q) : 0;
      v = L.k * Math.max(inBeam * (0.5 + 0.5 * t), pool * 0.75);
      const ux = L.x0 - L.x1, uy = L.y0 - L.y1;
      const ul = Math.hypot(ux, uy);
      ex = ux / ul;
      ey = uy / ul;
    }
    k += v;
    sx += ex * v;
    sy += ey * v;
  }
  const l = Math.hypot(sx, sy) || 1;
  return { k, dx: sx / l, dy: sy / l };
}

/** Where a piece stands, so its pixels can ask the light. */
export interface At {
  wx: number;
  wy: number;
  rate: number;
}

/** Light at a local pixel of a piece (or the environment's ambient if the piece has no `at`). */
export function litAt(env: LightEnv, at: At | undefined, lx: number, ly: number): Lit {
  if (!at) return { k: env.ambient, dx: env.dir[0], dy: env.dir[1] };
  return light(env, at.wx + lx / at.rate, at.wy + ly / at.rate);
}

/**
 * Light sampled on a coarse grid over a piece (lights change slowly; per-pixel sums of every
 * lantern would be slow), blended bilinearly. Ask it in level-1 local px of the piece.
 */
export class LitField {
  private cache = new Map<number, Lit>();
  private env: LightEnv;
  private at: At | undefined;
  private step: number;
  private dim: number;
  constructor(env: LightEnv, at: At | undefined, step = 12, dim = 1) {
    this.env = env;
    this.at = at;
    this.step = step;
    this.dim = dim;
  }
  private node(i: number, j: number): Lit {
    const key = i * 100003 + j;
    let v = this.cache.get(key);
    if (!v) {
      v = litAt(this.env, this.at, i * this.step, j * this.step);
      if (this.dim !== 1) v = { k: v.k * this.dim, dx: v.dx, dy: v.dy };
      this.cache.set(key, v);
    }
    return v;
  }
  get(lx: number, ly: number): Lit {
    const fx = lx / this.step, fy = ly / this.step;
    const i = Math.floor(fx), j = Math.floor(fy);
    const u = fx - i, v = fy - j;
    const a = this.node(i, j), b = this.node(i + 1, j), c = this.node(i, j + 1), d = this.node(i + 1, j + 1);
    const k = (a.k * (1 - u) + b.k * u) * (1 - v) + (c.k * (1 - u) + d.k * u) * v;
    const dx = (a.dx * (1 - u) + b.dx * u) * (1 - v) + (c.dx * (1 - u) + d.dx * u) * v;
    const dy = (a.dy * (1 - u) + b.dy * u) * (1 - v) + (c.dy * (1 - u) + d.dy * u) * v;
    const l = Math.hypot(dx, dy) || 1;
    return { k, dx: dx / l, dy: dy / l };
  }
}

/**
 * The shade of a surface: light k on a surface whose normal (nx, ny) leans out of the
 * picture (0, 0 = facing us). Returns a ramp position (0 light .. 1 dark).
 */
export function lum(l: Lit, nx = 0, ny = 0): number {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  // the light sits a little in front of the picture plane, toward its direction
  const lz = 0.6;
  const ll = Math.hypot(l.dx, l.dy, lz);
  const dot = (nx * l.dx + ny * l.dy + nz * lz) / ll;
  return clamp(l.k * (0.35 + 0.65 * clamp(dot, 0, 1)), 0, 1.2);
}

/**
 * A lacquered cylinder's light across its width (u -1..1), lit from `side` (-1 left .. 1 right,
 * the sign of where the light lies): lit face, a core shadow, reflected light at the dark edge,
 * and a lacquer sheen (a thin bright streak) when spec > 0.
 */
export function cyl(k: number, u: number, side: number, spec = 0): number {
  const nz = Math.sqrt(Math.max(0, 1 - u * u));
  const dot = clamp(u * side * 0.7 + nz * 0.7, 0, 1);
  const core = Math.abs(u + side * 0.62) < 0.16 ? -0.07 : 0;
  const bounce = u * -side > 0.84 ? 0.08 : 0;
  const sp = spec > 0 && Math.abs(u - side * 0.48) < 0.06 ? spec : 0;
  return clamp(k * (0.32 + 0.68 * dot) + core + (bounce + sp) * Math.min(1, k), 0, 1.2);
}

/**
 * Light on a flat face seen side-on, tilted at its bevels: nx -1 at a left bevel .. 1 at a
 * right one; ny -1 where it turns up to the light (a top edge) .. 1 where it turns down.
 */
export function face(k: number, side: number, nx = 0, ny = 0): number {
  const dot = clamp(0.6 + nx * side * 0.45 - ny * 0.55, 0, 1.4);
  return clamp(k * (0.33 + 0.67 * dot), 0, 1.25);
}

/** Bevel normals for a point (u, v in 0..1 across a box) with bevel widths bu, bv (share). */
export function bevel(u: number, v: number, bu: number, bv: number): [number, number] {
  const nx = u < bu ? -1 : u > 1 - bu ? 1 : 0;
  const ny = v < bv ? -1 : v > 1 - bv ? 1 : 0;
  return [nx, ny];
}

/**
 * A column's light: the mean over its height (so its lit and shaded bands run straight down
 * it, as on a real lacquered column) and the side its light comes from.
 */
export function colLight(lf: LitField, x: number, y0: number, y1: number): { k: number; side: number } {
  let k = 0, dx = 0;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const l = lf.get(x, y0 + ((y1 - y0) * (i + 0.5)) / n);
    k += l.k;
    dx += l.dx * l.k;
  }
  return { k: k / n, side: clamp((dx / Math.max(1e-6, k)) * 1.6, -1, 1) };
}

/** Glowing paper (screens, lanterns): cream at the hot middle, amber, then the warm dark. */
export const SCREEN: Ramp = [P.ember[0]!, P.ember[1]!, P.paper[2]!, P.paper[3]!, P.ember[4]!, P.umber[0]!, P.umber[1]!, P.umber[2]!];

/** A material's ramp at light `lit` (0 dark .. 1 lit): the ramp's [lo, hi] share is its range. */
export function mt(ramp: Ramp, lit: number, X: number, Y: number, lo = 0, hi = 1, band = 0.45): number {
  return tn(ramp, lo + (hi - lo) * (1 - clamp(lit, 0, 1)), X, Y, band);
}

/** Ramp index at position t, dithered across a band of the step (ordered, bayer 4). */
export function tn(ramp: Ramp, t: number, x: number, y: number, band = 0.45): number {
  const n = ramp.length;
  const pos = clamp(t, 0, 1) * (n - 1);
  let i = Math.floor(pos);
  const f = pos - i;
  const lo = 0.5 - band / 2;
  const k = (f - lo) / Math.max(1e-6, band);
  if (k >= 1 || (k > 0 && bayer4(x, y) < k)) i++;
  return ramp[clamp(i, 0, n - 1)]!;
}

// ---------------------------------------------------------------------------
// Drawing: every helper takes level-1 local coordinates and walks the buffer's art px.
// ---------------------------------------------------------------------------
export type PxFn = (X: number, Y: number, lx: number, ly: number) => number;

/** Calls fn for every art px in the local rectangle (clipped to the buffer). */
export function rect(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, fn: PxFn): void {
  const X0 = Math.max(Math.round(c.X(x0)), c.buf.ox), X1 = Math.min(Math.round(c.X(x1)), c.buf.x1);
  const Y0 = Math.max(Math.round(c.Y(y0)), c.buf.oy), Y1 = Math.min(Math.round(c.Y(y1)), c.buf.y1);
  for (let Y = Y0; Y < Y1; Y++) {
    const ly = c.ly(Y + 0.5);
    for (let X = X0; X < X1; X++) {
      const v = fn(X, Y, c.lx(X + 0.5), ly);
      if (v > 0) c.buf.set(X, Y, v);
    }
  }
}

/** Fills a local polygon ([x, y, ...]) calling fn for each art px inside. */
export function poly(c: PaintCtx, pts: readonly number[], fn: PxFn): void {
  const abs: number[] = [];
  for (let i = 0; i < pts.length; i += 2) abs.push(c.X(pts[i]!), c.Y(pts[i + 1]!));
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 1; i < abs.length; i += 2) { y0 = Math.min(y0, abs[i]!); y1 = Math.max(y1, abs[i]!); }
  const A = Math.max(Math.floor(y0), c.buf.oy), B = Math.min(Math.ceil(y1), c.buf.y1);
  const n = abs.length / 2;
  for (let Y = A; Y < B; Y++) {
    const yc = Y + 0.5;
    const xs: number[] = [];
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = abs[i * 2]!, yi = abs[i * 2 + 1]!, xj = abs[j * 2]!, yj = abs[j * 2 + 1]!;
      if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi));
    }
    xs.sort((a, b) => a - b);
    const ly = c.ly(yc);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(Math.ceil(xs[k]! - 0.5), c.buf.ox), b = Math.min(Math.floor(xs[k + 1]! - 0.5), c.buf.x1 - 1);
      for (let X = a; X <= b; X++) {
        const v = fn(X, Y, c.lx(X + 0.5), ly);
        if (v > 0) c.buf.set(X, Y, v);
      }
    }
  }
}

/**
 * A solid of revolution seen from the side (columns, lanterns, posts, jars): half width hw(ly)
 * about the axis x = cx between y0 and y1; fn gets u (-1..1 across) as well.
 */
export function lathe(c: PaintCtx, cx: number, y0: number, y1: number, hw: (ly: number) => number, fn: (X: number, Y: number, u: number, lx: number, ly: number) => number): void {
  const Y0 = Math.max(Math.round(c.Y(y0)), c.buf.oy), Y1 = Math.min(Math.round(c.Y(y1)), c.buf.y1);
  for (let Y = Y0; Y < Y1; Y++) {
    const ly = c.ly(Y + 0.5);
    const w = hw(ly);
    if (w <= 0) continue;
    const X0 = Math.max(Math.round(c.X(cx - w)), c.buf.ox), X1 = Math.min(Math.round(c.X(cx + w)), c.buf.x1);
    for (let X = X0; X < X1; X++) {
      const lx = c.lx(X + 0.5);
      const v = fn(X, Y, clamp((lx - cx) / w, -1, 1), lx, ly);
      if (v > 0) c.buf.set(X, Y, v);
    }
  }
}

/** A line of art px between two local points (1 art px wide, or `w` level-1 px). */
export function line(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: number | ((X: number, Y: number, t: number) => number), w = 0): void {
  const n = Math.max(1, Math.ceil(Math.hypot(c.X(x1) - c.X(x0), c.Y(y1) - c.Y(y0))));
  const r = Math.max(0, Math.floor((w * c.d) / 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const X = Math.round(c.X(x0 + (x1 - x0) * t)), Y = Math.round(c.Y(y0 + (y1 - y0) * t));
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
      const v = typeof col === "number" ? col : col(X + ox, Y + oy, t);
      if (v > 0) c.buf.set(X + ox, Y + oy, v);
    }
  }
}

/** A hanging cord or chain that sags between two points (catenary-ish parabola). */
export function cord(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, sag: number, col: number | ((X: number, Y: number, t: number) => number)): void {
  const n = Math.max(2, Math.ceil(Math.hypot(c.X(x1) - c.X(x0), c.Y(y1) - c.Y(y0)) * 1.2));
  let px = NaN, py = NaN;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const X = Math.round(c.X(x0 + (x1 - x0) * t));
    const Y = Math.round(c.Y(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)));
    if (X === px && Y === py) continue;
    const v = typeof col === "number" ? col : col(X, Y, t);
    if (v > 0) c.buf.set(X, Y, v);
    px = X; py = Y;
  }
}

// ---------------------------------------------------------------------------
// Texture: wear and grain that stay put across densities (they read level-1 coords).
// ---------------------------------------------------------------------------

/** Wood grain along the given axis: -0.5..0.5, long streaks and the odd knot. */
export function grain(lx: number, ly: number, seed: number, vertical = true): number {
  const a = vertical ? lx : ly, b = vertical ? ly : lx;
  const g = vnoise(a * 0.35, b * 0.02, seed) * 0.7 + vnoise(a * 1.1, b * 0.05, seed + 7) * 0.3;
  return g - 0.5;
}

/** Wear: 0 clean .. 1 worn, in soft patches (edges, feet, handholds). */
export function wear(lx: number, ly: number, seed: number, scale = 0.06): number {
  return clamp((fbm(lx * scale, ly * scale, seed, 3) - 0.45) * 2.4, 0, 1);
}

/** A sparse speckle (dust, chips), 0 or 1. */
export function speck(X: number, Y: number, seed: number, density: number): boolean {
  return hash(X, Y, seed) < density;
}

/** Ordered-dither transparency: keep this art px at coverage a (0..1)? */
export function keep(X: number, Y: number, a: number): boolean {
  return bayer4(X, Y) < a;
}

export { clamp, hash, vnoise, fbm };

/**
 * A column's stone base, the classic two parts seen side-on: a square plinth with a chamfered top edge, and on it a
 * carved drum (round 4, W2-n: the lotus basin's chips and grooves read as a grey noise lump at play zoom) that swells
 * out from the shaft: its top edge lit where the shaft stands on it, a raised fillet under that, a ring of drum studs,
 * a second fillet near its foot; turned smooth, shaded as a cylinder in a few clean steps. `top` is the base's height
 * (it stands on y = 0, centred on cx).
 */
export function colBase(c: PaintCtx, cx: number, r: number, top: number, k: number, side: number, seed: number): void {
  const plinthH = top * 0.34, plinthW = r * 1.55;
  // the plinth
  rect(c, cx - plinthW, -plinthH, cx + plinthW, 0, (X, Y, lx, ly) => {
    const u = (lx - cx) / plinthW, v = (ly + plinthH) / plinthH;
    const chamfer = v < 0.2;
    const ny = chamfer ? -0.85 : v > 0.9 ? 0.6 : 0;
    const nx = Math.abs(u) > 0.94 ? Math.sign(u) : 0;
    const chip = fbm(lx * 0.3, ly * 0.3, seed, 2) > 0.8 ? 0.08 : 0;
    const dust = v > 0.8 ? -0.06 : 0;
    return mt(M.stone, face(k, side, nx, ny) * 0.92 + chip + dust, X, Y, 0.2, 1, 0.2);
  });
  // the drum
  const dh = top - plinthH;
  lathe(c, cx, -top, -plinthH, (ly) => {
    const t = (ly + top) / dh; // 0 at the shaft .. 1 at the plinth
    return r * (1.06 + 0.3 * Math.sin(clamp(t, 0, 1) * Math.PI) + (t > 0.9 ? 0.04 : 0));
  }, (X, Y, u, lx, ly) => {
    const t = (ly + top) / dh;
    const px = 1 / Math.max(1, dh);
    let n = cyl(k, u, side);
    // the lit top edge where the drum turns in under the shaft
    if (t < px * 2) n = cyl(k, u, side) * 1.1 + 0.12;
    // a raised fillet: its top catches the light, its underside a dark line
    else if (Math.abs(t - 0.17) < px * 1.6) n += 0.1;
    else if (Math.abs(t - 0.17 - px * 2) < px * 0.9) n -= 0.12;
    // the ring of drum studs
    else if (Math.abs(t - 0.3) < px * 1.6) {
      const a = Math.asin(clamp(u, -1, 1));
      if (Math.cos(a * 9) > 0.7) n = n * 1.05 + 0.1;
    }
    // the fillet near the foot
    else if (Math.abs(t - 0.86) < px * 1.4) n += 0.08;
    else if (Math.abs(t - 0.86 - px * 1.8) < px * 0.9) n -= 0.1;
    // the drum's belly a touch darker under its swell (it turns away from the light above)
    if (t > 0.55) n -= (t - 0.55) * 0.12;
    const wear = fbm(lx * 0.2, ly * 0.2, seed + 3, 2) > 0.82 ? -0.05 : 0;
    return mt(M.stone, n * 0.95 + wear, X, Y, 0.2, 1, 0.15);
  });
}
