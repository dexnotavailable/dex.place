// Ground masses seen in cross-section on the play plane: the massif's rock under a moss
// cap, a band's rock, a path's packed earth. One painter, any density: the facet sizes,
// strata and tufts are in level-1 px and fade out at the wide levels.

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { Spans, bayer4, clamp, fbm, hash, tone, vnoise, vnoise1 } from "../raster.ts";

export interface MassP {
  /** Top polyline, level-1 px relative to the anchor, x increasing. */
  top: number[];
  /** Bottom: a y (flat) or a polyline (x decreasing, closing the shape). */
  bottom: number | number[];
  rock?: "karst" | "stone" | "earth";
  cap?: "moss" | "earth" | "none";
  /** Cap thickness, level-1 px (default 12). */
  capH?: number;
  /** Grass blades above the top line, 0..1 (default 0.6). */
  tufts?: number;
  /** Extra darkening of the rock body (0..1), e.g. for masses in shade. */
  shade?: number;
}

function topAt(top: number[], x: number): number {
  const n = top.length;
  if (x <= top[0]!) return top[1]!;
  if (x >= top[n - 2]!) return top[n - 1]!;
  let lo = 0, hi = n / 2 - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (top[m * 2]! <= x) lo = m;
    else hi = m;
  }
  const x0 = top[lo * 2]!, y0 = top[lo * 2 + 1]!, x1 = top[hi * 2]!, y1 = top[hi * 2 + 1]!;
  return y0 + ((x - x0) / Math.max(1e-6, x1 - x0)) * (y1 - y0);
}

function outline(p: MassP): number[] {
  const pts = [...p.top];
  if (typeof p.bottom === "number") {
    pts.push(p.top[p.top.length - 2]!, p.bottom, p.top[0]!, p.bottom);
  } else pts.push(...p.bottom);
  return pts;
}

/**
 * Rock facets: a stretched cell pattern. Returns [cell shade 0..1, crack 0..1].
 * lx, ly in level-1 px.
 */
function facets(lx: number, ly: number, seed: number, size: number): [number, number] {
  const sx = size * 1.7, sy = size;
  const gx = lx / sx, gy = ly / sy;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let d1 = 1e9, d2 = 1e9, best = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j;
      const px = cx + 0.15 + 0.7 * hash(cx, cy, seed), py = cy + 0.15 + 0.7 * hash(cx, cy, seed + 17);
      const dx = (gx - px) * sx, dy = (gy - py) * sy;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; best = hash(cx, cy, seed + 31); }
      else if (d < d2) d2 = d;
    }
  }
  const edge = Math.sqrt(d2) - Math.sqrt(d1);
  return [best, edge < 1.6 ? 1 - edge / 1.6 : 0];
}

export const mass = definePainter<MassP>("mass", {
  bounds(p) {
    const pts = outline(p);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      x0 = Math.min(x0, pts[i]!); x1 = Math.max(x1, pts[i]!);
      y0 = Math.min(y0, pts[i + 1]!); y1 = Math.max(y1, pts[i + 1]!);
    }
    return [x0 - 2, y0 - 12, x1 + 2, y1 + 2];
  },
  paint(c, p) {
    const d = c.d;
    const pts = outline(p).map((v, i) => (i % 2 ? c.Y(v) : c.X(v)));
    const sp = new Spans(pts, c.buf.oy - 2, c.buf.y1 + 2);
    const rock = p.rock === "stone" ? P.stone : p.rock === "earth" ? P.earth : P.karst;
    const capKind = p.cap ?? "moss";
    const cap = capKind === "earth" ? P.earth : P.moss;
    const capH = (p.capH ?? 12) ;
    const seed = c.seed;
    const shade = p.shade ?? 0;
    const fine = d >= 0.5;
    const b = c.buf;
    for (let y = Math.max(sp.y0, b.oy); y < Math.min(sp.y1, b.y1); y++) {
      const row = sp.row(y);
      for (let k = 0; k + 1 < row.length; k += 2) {
        const xa = Math.max(row[k]!, b.ox), xb = Math.min(row[k + 1]!, b.x1 - 1);
        for (let x = xa; x <= xb; x++) {
          const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
          const ty = topAt(p.top, lx);
          const depth = ly - ty;
          const edge = !sp.inside(x - 1, y) || !sp.inside(x + 1, y) || !sp.inside(x, y + 1);
          const topEdge = !sp.inside(x, y - 1);
          // the cap: moss with a ragged lower edge
          const capLimit = capKind === "none" ? 0 : capH * (0.75 + 0.5 * vnoise1(lx / 9, seed + 3)) + (fine ? (hash(Math.floor(lx), 0, seed) < 0.12 ? 3 : 0) : 0);
          if (topEdge) {
            b.set(x, y, capKind === "none" ? rock[rock.length - 1]! : cap[cap.length - 2]!);
            continue;
          }
          if (depth < capLimit) {
            // a lit rim one art px under the top, then the cap body darkening downward
            const rim = depth < 1.5 / d + 0.01 && !topEdge;
            let t = rim ? 0.05 : 0.22 + 0.45 * (depth / Math.max(1, capLimit)) + 0.18 * (vnoise(lx / 6, ly / 4, seed + 5) - 0.5);
            if (edge) t = 1;
            b.set(x, y, tone(cap, clamp(t, 0, 1), x, y, 0.6));
            continue;
          }
          // the rock body: facets, cracks, strata, darker with depth and right under the cap
          const [cell, crack] = facets(lx, ly, seed, fine ? 26 : 40);
          const under = depth - capLimit;
          let t = 0.2 + cell * 0.32;
          t += clamp(depth / 520, 0, 0.42);
          if (under < 6) t += 0.28 * (1 - under / 6);
          const strata = Math.sin((ly + 18 * fbm(lx / 140, 0, seed + 9, 2)) / 23);
          if (strata > 0.86) t += 0.12;
          t += (vnoise(lx / 3.5, ly / 3.5, seed + 13) - 0.5) * 0.12;
          if (fine && crack > 0.55 && hash(Math.floor(lx / 12), Math.floor(ly / 12), seed + 41) < 0.7) t += 0.3 * crack;
          t += shade * 0.3;
          if (edge) t = 1;
          b.set(x, y, tone(rock, clamp(t, 0, 1), x, y, 0.5));
        }
      }
    }
    // grass blades and the odd flower above the top line
    const tufts = (p.tufts ?? 0.6) * (capKind === "moss" ? 1 : 0);
    if (tufts > 0 && d >= 0.25) {
      const x0 = Math.max(b.ox, Math.floor(c.X(p.top[0]!))), x1 = Math.min(b.x1, Math.ceil(c.X(p.top[p.top.length - 2]!)));
      for (let x = x0; x < x1; x++) {
        const lx = c.lx(x + 0.5);
        const clump = vnoise1(lx / 18, seed + 61);
        if (hash(x, 1, seed + 71) > tufts * (0.35 + 0.9 * clump)) continue;
        const ty = c.Y(topAt(p.top, lx));
        const hgt = Math.max(1, Math.round((1 + hash(x, 2, seed + 73) * 4 * clump) * Math.min(1, d)));
        const col = hash(x, 3, seed + 79) < 0.5 ? P.moss[3]! : P.moss[4]!;
        for (let k = 1; k <= hgt; k++) {
          const yy = Math.floor(ty) - k;
          if (b.get(x, yy)) break;
          b.set(x, yy, k === hgt && hgt > 2 ? P.moss[2]! : col);
        }
        if (d >= 1 && hash(x, 4, seed + 83) < 0.02 * tufts) {
          const fy = Math.floor(ty) - hgt - 1;
          b.set(x, fy, hash(x, 5, seed) < 0.5 ? P.paper[0]! : P.violet[1]!);
        }
      }
    }
  },
});

/** Stone steps cut into a slope: treads every `rise` px between two points (level-1 local px). */
export interface StepsP {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Visible depth of the stone under the treads. */
  depth?: number;
}

export const steps = definePainter<StepsP>("steps", {
  bounds(p) {
    return [Math.min(p.x0, p.x1) - 2, Math.min(p.y0, p.y1) - 4, Math.max(p.x0, p.x1) + 2, Math.max(p.y0, p.y1) + (p.depth ?? 30) + 2];
  },
  paint(c: PaintCtx, p) {
    const b = c.buf;
    const n = Math.max(1, Math.round(Math.abs(p.y1 - p.y0) / 11));
    const run = (p.x1 - p.x0) / n, rise = (p.y1 - p.y0) / n;
    const depth = p.depth ?? 30;
    for (let i = 0; i < n; i++) {
      const sx0 = p.x0 + run * i, sx1 = sx0 + run;
      const sy = p.y0 + rise * (i + 1);
      const X0 = Math.round(c.X(Math.min(sx0, sx1))), X1 = Math.round(c.X(Math.max(sx0, sx1)));
      const Y0 = Math.round(c.Y(sy)), Y1 = Math.round(c.Y(sy + depth));
      for (let y = Y0; y < Y1; y++) {
        for (let x = X0; x < X1; x++) {
          const top = y === Y0, side = x === X0 || x === X1 - 1;
          const t = top ? 0.05 : side ? 0.85 : 0.35 + 0.35 * ((y - Y0) / Math.max(1, Y1 - Y0)) + 0.1 * (bayer4(x, y) - 0.5);
          b.set(x, y, tone(P.stone, t, x, y, 0.5));
        }
      }
    }
  },
});

/** Still water in cross-section on the play plane (seen at the wide levels, under the lake's surface). */
export interface WaterBodyP {
  w: number;
  /** Depth to the bed, px. */
  depth: number;
}

export const waterBody = definePainter<WaterBodyP>("waterBody", {
  bounds(p) {
    return [0, 0, p.w, p.depth];
  },
  paint(c, p) {
    const b = c.buf;
    const X0 = Math.round(c.X(0)), X1 = Math.round(c.X(p.w));
    const Y0 = Math.round(c.Y(0)), Y1 = Math.round(c.Y(p.depth));
    for (let y = Y0; y < Y1; y++) {
      const t = y === Y0 ? 0.1 : 0.35 + 0.5 * ((y - Y0) / Math.max(1, Y1 - Y0));
      b.span(y, X0, X1 - 1, (x) => tone(P.jade, t, x, y, 0.5));
    }
  },
});
