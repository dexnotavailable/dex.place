// Shared tools for the opening's painters: organic outlines (a straight builder polyline turned
// into an edge with noise at several scales), leaf clumps lit from the morning sun, and the
// small maths every painter here needs. Everything is deterministic in level-1 px, so a piece
// paints the same in every plate tile and at every density.

import type { PaintCtx } from "../../painter.ts";
import { Spans, bayer4, clamp, fbm1, hash, hash1, vnoise1 } from "../../raster.ts";

/** The morning key's light: from the upper left (art bible 3). */
export const LIGHT: [number, number] = [-0.62, -0.78];

/** y on a polyline (x increasing) at x, clamped at its ends. */
export function yAt(pts: readonly number[], x: number): number {
  const n = pts.length;
  if (x <= pts[0]!) return pts[1]!;
  if (x >= pts[n - 2]!) return pts[n - 1]!;
  let lo = 0, hi = n / 2 - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (pts[m * 2]! <= x) lo = m;
    else hi = m;
  }
  const x0 = pts[lo * 2]!, y0 = pts[lo * 2 + 1]!, x1 = pts[hi * 2]!, y1 = pts[hi * 2 + 1]!;
  return y0 + ((x - x0) / Math.max(1e-6, x1 - x0)) * (y1 - y0);
}

export interface RoughOpts {
  /** Large wander of the edge, px. */
  amp: number;
  /** Subdivision step along the edge, px. */
  step?: number;
  /** Hanging teeth on downward-facing edges (karst drips, roots), 0..1. */
  teeth?: number;
  /** Keep the first and last `keep` px of the edge where they are (joins). */
  keepStart?: number;
  keepEnd?: number;
  seed: number;
}

/**
 * Turns a polyline into an organic edge: subdivides it and pushes every point along the edge's
 * normal by noise at three scales (a slow wander, lumps, grit), plus hanging teeth where the
 * edge faces down. The result never self-intersects badly because the displacement is a small
 * share of the step-to-step spacing at the finest scale.
 */
export function roughen(pts: readonly number[], o: RoughOpts): number[] {
  const step = o.step ?? 4;
  const out: number[] = [];
  let s = 0;
  const n = pts.length / 2;
  // total length (for the keeps)
  let total = 0;
  for (let i = 1; i < n; i++) total += Math.hypot(pts[i * 2]! - pts[i * 2 - 2]!, pts[i * 2 + 1]! - pts[i * 2 - 1]!);
  for (let i = 0; i < n - 1; i++) {
    const ax = pts[i * 2]!, ay = pts[i * 2 + 1]!, bx = pts[i * 2 + 2]!, by = pts[i * 2 + 3]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 1e-6) continue;
    // outward normal for a polygon traced clockwise in screen space (y down): (dy, -dx)
    const nx = (by - ay) / len, ny = -(bx - ax) / len;
    const k = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < k; j++) {
      const u = j / k;
      const px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
      const ss = s + len * u;
      const keep = Math.min(1, (o.keepStart !== undefined ? clamp((ss - 0) / Math.max(1, o.keepStart), 0, 1) : 1), (o.keepEnd !== undefined ? clamp((total - ss) / Math.max(1, o.keepEnd), 0, 1) : 1));
      let d = o.amp * ((fbm1(ss / 90, o.seed, 3) - 0.5) * 1.6 + (vnoise1(ss / 17, o.seed + 5) - 0.5) * 0.7 + (hash1(Math.floor(ss / step), o.seed + 9) - 0.5) * 0.25);
      // teeth: where the edge faces down, the odd hanging point (a drip of rock, a root)
      if (o.teeth && ny > 0.45) {
        const cell = Math.floor(ss / 14);
        const h = hash1(cell, o.seed + 13);
        if (h < o.teeth * 0.5) {
          const f = (ss / 14 - cell - 0.5) * 2;
          const sharp = Math.max(0, 1 - Math.abs(f) * (1.6 + 2 * hash1(cell, o.seed + 17)));
          d += o.amp * (0.8 + 2.4 * hash1(cell, o.seed + 19)) * sharp * sharp;
        }
      }
      out.push(px + nx * d * keep, py + ny * d * keep);
    }
    s += len;
  }
  out.push(pts[n * 2 - 2]!, pts[n * 2 - 1]!);
  return out;
}

/** Converts level-1 local points to this buffer's absolute art px. */
export function toAbs(c: PaintCtx, pts: readonly number[]): number[] {
  return pts.map((v, i) => (i % 2 ? c.Y(v) : c.X(v)));
}

/** Bounds [x0, y0, x1, y1] of a flat point list. */
export function boxOf(pts: readonly number[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]!); x1 = Math.max(x1, pts[i]!);
    y0 = Math.min(y0, pts[i + 1]!); y1 = Math.max(y1, pts[i + 1]!);
  }
  return [x0, y0, x1, y1];
}

/** A per-piece cache (painters run once per tile; outlines and plant lists are built once). */
const CACHE = new Map<string, unknown>();
export function cached<T>(key: string, make: () => T): T {
  let v = CACHE.get(key) as T | undefined;
  if (v === undefined) {
    if (CACHE.size > 400) CACHE.clear();
    v = make();
    CACHE.set(key, v);
  }
  return v;
}

/** Ordered-dither keep test for a coverage a (0..1). */
export const keep = (x: number, y: number, a: number): boolean => bayer4(x, y) < a;

/** Spans over this buffer's rows for absolute points (a margin so edge tests see past the tile). */
export function spansFor(c: PaintCtx, abs: readonly number[]): Spans {
  return new Spans(abs, c.buf.oy - 6, c.buf.y1 + 6);
}

/**
 * One leaf clump (a cauliflower crown, a shrub, a tuft of moss) centred at (cx, cy) in level-1
 * local px with radius r: a lumpy rim of small leaf bumps, lit on its upper left, a darker
 * underside, a few highlight flecks. `ramps` is [lit ramp, shade ramp]; `t0` is the clump's
 * mid tone in the lit ramp (0 light .. 1 dark). Paints only where `ok(x, y)` (default all).
 */
export function clump(c: PaintCtx, cx: number, cy: number, r: number, lit: readonly number[], shade: readonly number[], t0: number, seed: number, flat = 1): void {
  const b = c.buf, d = c.d;
  const R = r * 1.35;
  const X0 = Math.floor(c.X(cx - R)), X1 = Math.ceil(c.X(cx + R)), Y0 = Math.floor(c.Y(cy - R * flat)), Y1 = Math.ceil(c.Y(cy + R * flat));
  if (!b.touches(X0, Y0, X1, Y1)) return;
  const bump = Math.max(1.2, r * 0.42);
  for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
    for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
      const dx = c.lx(x + 0.5) - cx, dy = (c.ly(y + 0.5) - cy) / flat;
      const ang = Math.atan2(dy, dx);
      // leafy rim: bumps all round, bigger on top
      const rim = r * (0.82 + 0.22 * vnoise1(ang * (r / bump) * 0.35 + 7, seed) + (d >= 0.5 ? 0.1 * vnoise1(ang * (r / bump) * 1.1 + 3, seed + 1) : 0)) * (dy < 0 ? 1 : 0.9);
      const q = Math.hypot(dx, dy) / rim;
      if (q > 1) continue;
      // light: the upper-left of the clump, and the upper-left of each leaf bump inside it
      const lit0 = (LIGHT[0] * dx + LIGHT[1] * dy) / Math.max(1e-3, rim);
      const inner = d >= 0.5 ? (vnoise1((dx + dy * 0.7) / bump + seed * 0.13, seed + 3) - 0.5) * 0.35 : 0;
      let t = t0 - lit0 * 0.3 + q * 0.12 + inner;
      if (q > 0.86 && lit0 < -0.2) t += 0.2;
      if (t > 0.72) {
        // into the shade ramp
        const tt = clamp(0.3 + (t - 0.72) * 1.6, 0, 1);
        b.set(x, y, shade[Math.min(shade.length - 1, Math.round(tt * (shade.length - 1)))]!);
        continue;
      }
      if (d >= 0.5 && lit0 > 0.45 && q > 0.55 && hash(x >> 1, y, seed) < 0.18) t -= 0.2;
      const i = clamp(t, 0, 1) * (lit.length - 1);
      const k = Math.floor(i);
      b.set(x, y, lit[Math.min(lit.length - 1, k + (bayer4(x, y) < i - k ? 1 : 0))]!);
    }
  }
}
