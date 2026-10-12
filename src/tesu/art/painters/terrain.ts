// Ground masses seen in cross-section on the play plane: the massif's rock under a moss
// cap, a band's rock, a path's packed earth. One painter, any density: the facet sizes,
// strata and tufts are in level-1 px and fade out at the wide levels.

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { Spans, bayer4, clamp, fbm1, hash, tone, vnoise1 } from "../raster.ts";

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
 * Weathered limestone as chunky boulders: a stretched cell pattern where every cell is
 * shaded like a rounded block in the morning light (lit along its upper-left rim, shadowed
 * along its lower-right rim, a dark crack between cells). Returns a tone (0 light .. 1
 * dark) or -1 for a crack. lx, ly in level-1 px.
 */
function boulders(lx: number, ly: number, seed: number, d: number, depth: number): number {
  const sx = 104, sy = 50;
  const wob = (fbm1(lx / 210, seed + 2, 2) - 0.5) * 16;
  const gx = lx / sx, gy = (ly + wob) / sy;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let d1 = 1e9, d2 = 1e9, c1x = 0, c1y = 0, c2x = 0, c2y = 0, id = 0, k1 = 0, k2 = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ix + i, cy = iy + j;
      const px = (cx + 0.08 + 0.84 * hash(cx, cy, seed)) * sx, py = (cy + 0.12 + 0.76 * hash(cx, cy, seed + 17)) * sy;
      const dx = lx - px, dy = ly + wob - py;
      const dd = dx * dx + dy * dy * 1.8;
      const kk = cx * 7919 + cy * 104729;
      if (dd < d1) { d2 = d1; c2x = c1x; c2y = c1y; k2 = k1; d1 = dd; c1x = px; c1y = py; k1 = kk; id = hash(cx, cy, seed + 31); }
      else if (dd < d2) { d2 = dd; c2x = px; c2y = py; k2 = kk; }
    }
  }
  // distance to the border between the two nearest cells (along their centre line)
  const ux = c2x - c1x, uy = (c2y - c1y) * 1.34;
  const ul = Math.hypot(ux, uy) || 1;
  const mx = (c1x + c2x) / 2, my = (c1y + c2y) / 2;
  const edge = ((mx - lx) * ux + (my - (ly + wob)) * uy) / ul;
  const px = 1 / d;
  // some borders are weathered away, so cells join into bigger, irregular masses
  const merged = hash(Math.min(k1, k2), Math.max(k1, k2), seed + 5) < 0.18;
  if (!merged && d >= 0.25 && edge < px * 0.9) return -1;
  // which way that border faces: toward the light (up and left) is lit
  const face = (-0.62 * ux - 0.78 * uy) / ul;
  let t = 0.2 + 0.16 * id;
  const rim = Math.max(2.5, 5 * Math.min(1, d)) / Math.max(d, 0.25);
  if (!merged && edge < rim) t += face > 0.25 ? -0.17 : face < -0.25 ? 0.24 : 0;
  // water stains: thin darker streaks running down from some cracks
  if (d >= 0.5 && hash(Math.floor(lx / 3), Math.floor((ly + wob) / sy), seed + 61) < 0.05) t += 0.08;
  // deeper rock is darker, in steps
  t += Math.min(0.56, Math.floor(depth / 150) * 0.07);
  if (d >= 0.5 && hash(Math.floor(lx), Math.floor(ly), seed + 77) < 0.003) t += 0.3;
  return clamp(t, 0, 1);
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
    const capH = p.capH ?? 16;
    const seed = c.seed;
    const shade = p.shade ?? 0;
    const b = c.buf;
    const ink = rock[rock.length - 1]!;
    for (let y = Math.max(sp.y0, b.oy); y < Math.min(sp.y1, b.y1); y++) {
      const row = sp.row(y);
      for (let k = 0; k + 1 < row.length; k += 2) {
        const xa = Math.max(row[k]!, b.ox), xb = Math.min(row[k + 1]!, b.x1 - 1);
        for (let x = xa; x <= xb; x++) {
          const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
          const ty = topAt(p.top, lx);
          const depth = ly - ty;
          const topEdge = !sp.inside(x, y - 1);
          const edge = !sp.inside(x - 1, y) || !sp.inside(x + 1, y) || !sp.inside(x, y + 1);
          // the cap: a lit rim, light moss, darker moss, and a ragged hem that drips
          // the hem: a scalloped edge with the odd longer tuft hanging over the rock
          const scal = Math.abs(Math.sin(lx / 7.5 + vnoise1(lx / 23, seed) * 3)) * 3;
          const tuft = hash(Math.floor(lx / 5), 11, seed) < 0.12 ? 3 + 6 * hash(Math.floor(lx / 5), 13, seed) : 0;
          const capLimit = capKind === "none" ? 0 : capH * (0.85 + 0.3 * vnoise1(lx / 13, seed + 3)) + scal + tuft;
          if (topEdge) {
            b.set(x, y, capKind === "none" ? ink : cap[cap.length - 2]!);
            continue;
          }
          if (depth < capLimit) {
            const u = depth / Math.max(1, capLimit);
            let t = depth < 1.4 / d ? 0.04 : u < 0.35 ? 0.2 : u < 0.75 ? 0.42 : 0.62;
            if (edge || depth > capLimit - 1 / d) t = 0.85;
            b.set(x, y, tone(cap, t, x, y, 0.25));
            continue;
          }
          if (edge) {
            b.set(x, y, ink);
            continue;
          }
          let t = boulders(lx, ly, seed, d, depth);
          if (t < 0) {
            b.set(x, y, rock[rock.length - 2]!);
            continue;
          }
          // the shadow the cap throws on the rock right under it
          if (depth - capLimit < 4 / d + 3) t = Math.max(t, 0.6);
          t = clamp(t + shade * 0.25, 0, 1);
          b.set(x, y, tone(rock, t, x, y, 0.2));
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
        if (hash(x, 1, seed + 71) > tufts * (0.25 + 0.9 * clump)) continue;
        const ty = c.Y(topAt(p.top, lx));
        const hgt = Math.max(1, Math.round((1 + hash(x, 2, seed + 73) * 4 * clump) * Math.min(1, d)));
        const col = hash(x, 3, seed + 79) < 0.5 ? P.moss[2]! : P.moss[3]!;
        for (let k = 1; k <= hgt; k++) {
          const yy = Math.floor(ty) - k;
          if (b.get(x, yy)) break;
          b.set(x, yy, k === hgt && hgt > 2 ? P.moss[1]! : col);
        }
        if (d >= 1 && hash(x, 4, seed + 83) < 0.025 * tufts) {
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
