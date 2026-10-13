// The opening's furniture and props, side-on, in the jetty's weathered timber and the road's
// stone: the road's balustrade (stone rails on posts with vermilion caps, following the ground,
// posts sunk into it), the terrace's stone bench, water barrels, a crate, a jar, the jetty's
// bucket, coil of rope and moored sampan. Each sits in its world: a contact shadow under it, the
// odd tuft or puddle at its foot. Props that break follow the builder's contract (anchor at the
// feet; the builder cuts the pieces from these pixels).

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, tone, vnoise, vnoise1 } from "../../raster.ts";
import { wood } from "./jetty.ts";

function fill(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (x: number, y: number, u: number, v: number) => number): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.max(Math.round(c.X(x0)) + 1, Math.round(c.X(x1)));
  const Y0 = Math.round(c.Y(y0)), Y1 = Math.max(Math.round(c.Y(y0)) + 1, Math.round(c.Y(y1)));
  if (!c.buf.touches(X0, Y0, X1, Y1)) return;
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = col(x, y, (x - X0 + 0.5) / (X1 - X0), (y - Y0 + 0.5) / (Y1 - Y0));
      if (v) c.buf.set(x, y, v);
    }
  }
}

/** A soft contact shadow on the ground under a prop, from x0 to x1 (dithered, darkest in the middle). */
export function contact(c: PaintCtx, x0: number, x1: number, y = 0): void {
  fill(c, x0, y - 1, x1, y + 2, (x, yy, u, v) => {
    const k = 1 - Math.abs(u - 0.5) * 2;
    if (bayer4(x, yy) > k * (v < 0.5 ? 0.9 : 0.5)) return 0;
    return P.karst[7]!;
  });
}

// --- the balustrade --------------------------------------------------------------------------

export interface RailP {
  /** Run of the rail, following the ground: [x, y, ...] relative to the anchor, x increasing. */
  pts: number[];
  /** Height of the top rail above the ground, px (default 46). */
  h?: number;
  /** Post spacing, px (default 62). */
  every?: number;
}

function railY(pts: number[], lx: number): number {
  if (lx <= pts[0]!) return pts[1]!;
  for (let i = 2; i < pts.length; i += 2) if (pts[i]! >= lx) return pts[i - 1]! + ((lx - pts[i - 2]!) / (pts[i]! - pts[i - 2]!)) * (pts[i + 1]! - pts[i - 1]!);
  return pts[pts.length - 1]!;
}

/** A stone balustrade: square posts with vermilion lacquered caps, a top rail and a lower rail. */
export const rail = definePainter<RailP>("op.rail", {
  bounds(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.pts.length; i += 2) {
      x0 = Math.min(x0, p.pts[i]!); x1 = Math.max(x1, p.pts[i]!);
      y0 = Math.min(y0, p.pts[i + 1]!); y1 = Math.max(y1, p.pts[i + 1]!);
    }
    return [x0 - 10, y0 - (p.h ?? 46) - 14, x1 + 10, y1 + 8];
  },
  paint(c, p) {
    const hgt = p.h ?? 46, every = p.every ?? 62, d = c.d, seed = c.seed;
    const pts = p.pts;
    const x0 = pts[0]!, x1 = pts[pts.length - 2]!;
    // rails first (posts stand in front of their ends): a rounded top rail, a thinner lower rail
    for (let lx = x0; lx <= x1; lx += 0.5 / d) {
      const g = railY(pts, lx);
      const X = Math.round(c.X(lx));
      if (X < c.buf.ox || X >= c.buf.x1) continue;
      for (const [off, th] of [[hgt - 2, 7], [hgt * 0.42, 4]] as const) {
        const Y0 = Math.round(c.Y(g - off)), Y1 = Math.round(c.Y(g - off + th));
        for (let y = Y0; y < Y1; y++) {
          const v = (y - Y0 + 0.5) / (Y1 - Y0);
          let t = v < 0.25 ? 0.08 : v < 0.7 ? 0.32 : 0.62;
          if (d >= 0.5 && vnoise(lx / 7, off, seed) > 0.7) t += 0.12;
          // moss where rain sits on the top rail
          if (off > hgt * 0.5 && v < 0.3 && vnoise1(lx / 9, seed + 3) > 0.7) { c.buf.set(X, y, P.moss[v < 0.12 ? 2 : 4]!); continue; }
          c.buf.set(X, y, tone(P.stone, clamp(t, 0, 1), X, y, 0.3));
        }
      }
      // balusters: short stone spindles between the rails, every few px
      const k = ((lx - x0) % 10 + 10) % 10;
      if (k < 2.6 && d >= 0.5) {
        const Y0 = Math.round(c.Y(g - hgt + 5)), Y1 = Math.round(c.Y(g - hgt * 0.42));
        for (let y = Y0; y < Y1; y++) c.buf.set(X, y, tone(P.stone, k < 1 ? 0.2 : 0.55, X, y, 0.3));
      }
    }
    // posts, with their caps and a contact shadow at their foot
    for (let lx = x0; lx <= x1 + 0.1; lx += every) {
      const g = railY(pts, lx);
      const tilt = (hash1(Math.round(lx), seed) - 0.5) * 1.2;
      fill(c, lx - 5, g - hgt - 6, lx + 5, g + 3, (x, y, u, v) => {
        const top = v < 0.12;
        const xs = u + tilt * (v - 1) * 0.02;
        let t = xs < 0.25 ? 0.12 : xs < 0.7 ? 0.38 : 0.68;
        if (u > 0.88) t = 0.85;
        if (top) return tone(P.red, clamp(t + (v < 0.03 ? -0.1 : 0), 0, 1), x, y, 0.3);
        if (Math.abs(v - 0.13) < 0.02) return P.lacquer[3]!;
        if (v > 0.9 && vnoise(c.lx(x), c.ly(y) / 2, seed + 5) > 0.5) return tone(P.moss, 0.6, x, y, 0.3);
        if (d >= 0.5 && hash(x, Math.floor(y / 3), seed + 6) < 0.05) t += 0.15;
        return tone(P.stone, clamp(t, 0, 1), x, y, 0.3);
      });
      contact(c, lx - 8, lx + 8, g + 2);
    }
  },
});

// --- the terrace bench ------------------------------------------------------------------------

export interface BenchP {
  w: number;
}

/** A stone bench: a thick slab on two carved legs, worn smooth on top, lichen on the legs. */
export const bench = definePainter<BenchP>("op.bench", {
  bounds(p) {
    return [-8, -38, p.w + 8, 4];
  },
  paint(c, p) {
    const w = p.w, seed = c.seed;
    contact(c, -6, w + 6, 1);
    for (const lx of [10, w - 26]) {
      fill(c, lx, -24, lx + 16, 0, (x, y, u, v) => {
        // a waisted leg: narrower in the middle
        const waist = 0.18 * Math.sin(v * Math.PI);
        if (u < waist || u > 1 - waist) return 0;
        let t = u < 0.3 ? 0.18 : u < 0.72 ? 0.4 : 0.66;
        if (vnoise(c.lx(x) / 3, c.ly(y) / 3, seed) > 0.68) return tone(P.moss, 0.5 + v * 0.3, x, y, 0.3);
        if (v > 0.9) t += 0.2;
        return tone(P.stone, clamp(t, 0, 1), x, y, 0.3);
      });
    }
    fill(c, -2, -34, w + 2, -23, (x, y, u, v) => {
      const end = Math.min(u, 1 - u) * (w + 4);
      if (end < 2 && v < 0.3) return 0;
      let t = v < 0.18 ? 0.05 : v < 0.65 ? 0.3 : 0.6;
      if (u > 0.97) t += 0.25;
      if (c.d >= 0.5 && hash(Math.floor(c.lx(x) / 3), Math.floor(c.ly(y)), seed + 2) < 0.06) t += 0.15;
      return tone(P.stone, clamp(t, 0, 1), x, y, 0.3);
    });
  },
});

// --- barrels, crates, jars, a bucket --------------------------------------------------------

export interface BarrelP {
  h?: number;
  /** A ladle resting on the lid. */
  ladle?: boolean;
}

/** A water barrel: bulging staves of weathered timber, two iron hoops, a lid, a wet ring at its foot. */
export const barrel = definePainter<BarrelP>("op.barrel", {
  bounds(p) {
    const hh = p.h ?? 40;
    return [-hh * 0.5, -hh * 1.3 - 6, hh * 0.5, 3];
  },
  paint(c, p) {
    const hh = p.h ?? 40, seed = c.seed, d = c.d;
    const rw = hh * 0.36;
    contact(c, -rw - 4, rw + 4, 1);
    fill(c, -rw - 3, -hh, rw + 3, 0, (x, y, _u, v) => {
      const bulge = rw + 3 * Math.sin(v * Math.PI);
      const lx = c.lx(x + 0.5);
      if (Math.abs(lx) > bulge) return 0;
      const u = (lx + bulge) / (2 * bulge);
      const hoop = Math.abs(v - 0.2) < 0.055 || Math.abs(v - 0.8) < 0.055;
      if (hoop) return u < 0.3 ? P.ink[1]! : u > 0.8 ? P.ink[1]! : (d >= 1 && bayer4(x, y) < 0.2 ? P.timber[3]! : P.ink[1]!);
      // staves: vertical seams, each its own tone
      const stave = Math.floor(u * 7);
      let t = (u < 0.18 ? 0.12 : u < 0.6 ? 0.32 : u < 0.85 ? 0.5 : 0.75) + (hash1(stave, seed) - 0.5) * 0.1;
      if (d >= 0.5 && Math.abs(u * 7 - Math.round(u * 7)) < 0.06 * (2 / Math.max(1, d))) t += 0.2;
      if (v > 0.9) t += 0.15;
      return wood(x, y, clamp(t, 0, 1));
    });
    // the lid's rim (seen side-on: a dark line with a lit lip), water just under it
    fill(c, -rw - 1, -hh - 3, rw + 1, -hh, (x, y, u, v) => (v < 0.4 ? wood(x, y, u < 0.5 ? 0.05 : 0.3) : P.timber[5]!));
    if (p.ladle) {
      for (let s = 0; s < hh * 0.5; s += 0.5 / d) c.buf.set(Math.round(c.X(rw * 0.2 + s * 0.6)), Math.round(c.Y(-hh - 3 - s * 0.45)), P.timber[3]!);
      fill(c, -rw * 0.4, -hh - 7, rw * 0.15, -hh - 2, (x, y, u) => wood(x, y, u < 0.4 ? 0.1 : 0.45));
    }
  },
});


/** How far a prop's cast shadow reaches past its right side, px (for its width). */
function shadowReach(w: number): number {
  return Math.min(14, w * 0.45 + 3);
}

/**
 * Contact on the deck under a prop: its shadow falling down and to the right over the deck's edge,
 * darkest at the foot (1 to 3 px); with damp, a wet ring darkening the boards round its foot.
 */
function footShadow(c: PaintCtx, x0: number, x1: number, damp = false): void {
  const b = c.buf;
  if (damp) {
    for (let y = Math.round(c.Y(0)); y < Math.round(c.Y(2.2)); y++) {
      for (let x = Math.round(c.X(x0 - 3)); x < Math.round(c.X(x1 + 4)); x++) {
        const u = (c.lx(x + 0.5) - x0 + 3) / (x1 - x0 + 7);
        if (bayer4(x, y) > (1 - Math.pow(Math.abs(u - 0.5) * 2, 2)) * 0.55) continue;
        b.set(x, y, P.timber[4]!);
      }
    }
  }
  // (round 3) the shadow it casts: the sun stands up and to the left beyond the lake, so it falls
  // toward us and to the right over the deck's lit edge: darkest right under its foot, a wedge
  // reaching out past its right side, thinning as it goes (hard steps, no dither field)
  const reach = shadowReach(x1 - x0);
  for (let y = Math.round(c.Y(0)); y < Math.round(c.Y(3.4)); y++) {
    const ly = c.ly(y + 0.5);
    const a = x0 + 0.4 + ly * 1.6, z = x1 + reach * (1 - ly / 3.6);
    for (let x = Math.round(c.X(a)); x < Math.round(c.X(z)); x++) {
      const lx = c.lx(x + 0.5);
      const out = (lx - x1) / Math.max(1, reach);
      // under the foot: the contact, darkest; out past it the cast shadow, a step lighter
      const col = out < 0 ? (ly < 1.2 ? P.timber[6]! : P.timber[5]!) : out < 0.55 - ly * 0.12 ? P.timber[5]! : P.umber[1]!;
      b.set(x, y, col);
    }
  }
}

/** A cord or rope band across a shape: twisted strands, lit on top. */
function cord(c: PaintCtx, ax: number, ay: number, bx: number, by: number, th: number): void {
  const d = c.d;
  const len = Math.hypot(bx - ax, by - ay);
  const n = Math.max(2, Math.ceil(len * d * 1.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    for (let o = 0; o < th; o += 0.5 / d) {
      const X = Math.round(c.X(x)), Y = Math.round(c.Y(y + o));
      const tw = ((X + Y * 2) % 3 + 3) % 3;
      c.buf.set(X, Y, o < th * 0.4 ? P.earth[tw === 0 ? 0 : 1]! : P.earth[tw === 0 ? 2 : 3]!);
    }
  }
}

export interface CrateP {
  /** Width and height, px; anchor at the bottom centre. */
  w?: number;
  h?: number;
}

/**
 * A fisher's crate: rough boards of different widths nailed to corner battens, one board split
 * and chipped, the top edge worn, a rope lashed round it twice with a knot on top, a shadow at
 * its foot. Cosmetic breakable: anchor at the feet.
 */
export const crateOp = definePainter<CrateP>("op.crate", {
  bounds(p) {
    const w = p.w ?? 40, h = p.h ?? 36;
    return [-w / 2 - 2, -h - 4, w / 2 + shadowReach(w) + 2, 4];
  },
  paint(c, p) {
    const w = p.w ?? 40, h = p.h ?? 36, seed = c.seed, d = c.d;
    footShadow(c, -w / 2, w / 2);
    // the boards: their own heights and tones
    const boards: [number, number, number][] = [];
    let y = 0;
    let i = 0;
    while (y < h) {
      const bh = Math.min(h - y, 5 + hash1(i, seed) * 5);
      boards.push([y, bh, hash1(i, seed + 1)]);
      y += bh;
      i++;
    }
    const split = Math.floor(hash1(9, seed) * boards.length);
    boards.forEach(([by, bh, k], bi) => {
      fill(c, -w / 2, -by - bh, w / 2, -by, (x, yy, u, v) => {
        const lx = c.lx(x + 0.5);
        // a chipped corner on the split board
        if (bi === split && u > 0.86 && v < 0.5) return 0;
        let t = 0.3 + k * 0.25 + v * 0.15;
        if (v < 0.18) t -= 0.15;
        if (v > 0.82) t = 0.85;
        if (bi === split && Math.abs(v - 0.45 - (u - 0.5) * 0.15) < 0.12 && u > 0.2) t = 0.95;
        if (d >= 0.5 && vnoise(lx / 9, c.ly(yy) / 1.2, seed + bi) > 0.7) t += 0.1;
        if (u > 0.92) t += 0.2;
        return wood(x, yy, clamp(t, 0, 1), true);
      });
    });
    // corner battens, nailed
    for (const [bx, sh] of [[-w / 2, 0], [w / 2 - 4, 0.25]] as const) {
      fill(c, bx, -h, bx + 4, 0, (x, yy, u, v) => {
        if (v < 0.04 && u > 0.5) return 0;
        const t = (u < 0.3 ? 0.18 : u > 0.75 ? 0.8 : 0.5) + sh;
        if (d >= 1 && Math.abs(u - 0.5) < 0.2 && (Math.round(c.ly(yy) + h) % 7) === 3) return P.ink[1]!;
        return wood(x, yy, clamp(t, 0, 1), false);
      });
    }
    // the rope: twice round, a knot on the top
    for (const fx of [-0.18, 0.24]) {
      const x = w * fx;
      cord(c, x, -h - 1, x + 1, 0.2, 2);
      for (let yy = Math.round(c.Y(-h - 1)); yy < Math.round(c.Y(0)); yy++) {
        c.buf.set(Math.round(c.X(x + 1.5)), yy, ((yy & 1) ? P.earth[1] : P.earth[2])!);
        c.buf.set(Math.round(c.X(x - 0.5)), yy, P.earth[3]!);
      }
    }
    cord(c, -w * 0.18, -h - 1.5, w * 0.24, -h - 1.5, 1.6);
    const kx = w * 0.04;
    fill(c, kx - 2.5, -h - 4, kx + 2.5, -h, (_x, _y, u, v) => ((u - 0.5) * (u - 0.5) + (v - 0.6) * (v - 0.6) < 0.2 ? (u < 0.5 ? P.earth[0]! : P.earth[2]!) : 0));
    for (let s = 0; s < 6; s += 0.5 / d) c.buf.set(Math.round(c.X(kx + 2 + s * 0.4)), Math.round(c.Y(-h + s * 0.9)), P.earth[2]!);
  },
});

export interface JarP {
  h?: number;
  /** "clay" (terracotta, the default), "celadon" or "ink". */
  glaze?: string;
}

/**
 * A storage jar with a narrow neck, a cloth tied over its mouth, a cord net round its belly for
 * carrying, worn and dusty at its foot. Cosmetic breakable: anchor at the feet.
 */
export const jarOp = definePainter<JarP>("op.jar", {
  bounds(p) {
    const h = p.h ?? 34;
    return [-h * 0.45 - 2, -h - 5, Math.max(h * 0.45 + 3, h * 0.42 * 0.6 + shadowReach(h * 0.5) + 2), 4];
  },
  paint(c, p) {
    const h = p.h ?? 34, d = c.d;
    const ramp = p.glaze === "ink" ? P.lacquer : p.glaze === "celadon" ? P.jade : P.earth;
    const r = h * 0.42;
    footShadow(c, -r * 0.6, r * 0.6);
    const half = (t: number): number => (t > 0.84 ? r * 0.4 : t > 0.74 ? r * (0.4 + (0.84 - t) * 3) : r * Math.pow(Math.sin(Math.min(1, (t + 0.1) / 0.84) * Math.PI), 0.62));
    fill(c, -r - 1, -h, r + 1, 0, (x, y, _u, v) => {
      const ly = c.ly(y + 0.5), lx = c.lx(x + 0.5);
      const t = -ly / h;
      const hw = half(t);
      if (Math.abs(lx) > hw) return 0;
      // the cloth over its mouth, tied
      if (t > 0.84) return tone(P.paper, lx < 0 ? 0.15 : 0.45, x, y, 0.3);
      if (Math.abs(t - 0.82) < 0.03) return P.red[4]!;
      // the carrying net: a diamond lattice of cord over the belly
      if (d >= 1 && t < 0.62 && t > 0.08) {
        const a = (lx / hw) * 3.2 + t * 9, bq = -(lx / hw) * 3.2 + t * 9;
        if (Math.abs(a - Math.round(a)) < 0.09 || Math.abs(bq - Math.round(bq)) < 0.09) return P.earth[t < 0.3 ? 3 : 2]!;
      }
      if (Math.abs(lx) > hw - 1.1) return ramp[ramp.length - 1]!;
      const lit = (-lx / Math.max(1, hw)) * 0.6 - (v - 0.5) * 0.8;
      if (p.glaze !== "clay" && p.glaze !== undefined && lit > 0.55 && bayer4(x, y) > 0.3) return P.paper[0]!;
      let tt = 0.45 - lit * 0.35;
      // dust and wear toward the foot
      if (t < 0.12) tt += 0.15;
      return tone(ramp, clamp(tt, 0.05, 0.95), x, y, 0.35);
    });
    // the net's cord gathered at the neck, its tail hanging
    if (d >= 0.5) for (let s = 0; s < h * 0.35; s += 0.5 / d) c.buf.set(Math.round(c.X(r * 0.35 + s * 0.2)), Math.round(c.Y(-h * 0.78 + s)), P.earth[2]!);
  },
});

export interface NetP {
  /** Width and height of the heap, px; anchor at its foot on the deck, middle. */
  w: number;
  h: number;
  /** Net hanging over the deck's edge, px below the deck top (0: none). */
  drape?: number;
}

/** Is (lx, ly) on a cord of the net's diamond mesh (cell size m)? */
function onMesh(lx: number, ly: number, m: number, d: number): boolean {
  const a = (lx + ly) / m, q = (lx - ly) / m;
  const tol = Math.max(0.12, 0.6 / (m * Math.max(0.5, d)));
  return Math.abs(a - Math.round(a)) < tol || Math.abs(q - Math.round(q)) < tol;
}

/**
 * A fishing net heaped on the deck and draped over its edge: folds of dark mesh slumped higher
 * on one side, cord catching the light where the mesh crosses, a float line of cork floats
 * looping over the heap and down the drape, the drape a ragged curtain of open mesh hanging down
 * the deck's face, its lowest floats dangling. Anchor: its foot on the deck, middle.
 */
export const net = definePainter<NetP>("op.net", {
  bounds(p) {
    return [-p.w / 2 - 4, -p.h - 4, p.w / 2 + Math.max(8, shadowReach(p.w) + 2), Math.max(4, (p.drape ?? 0) + 8)];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const W = p.w / 2, H = p.h;
    footShadow(c, -W, W);
    const top = (lx: number): number => {
      const u = lx / W;
      if (Math.abs(u) > 1) return 0;
      // slumped: high on the left where it was thrown down, sliding off to the right
      const env = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 1.6)), 0.65) * (1 - 0.32 * (u + 1) / 2);
      return -H * env * (0.72 + 0.45 * vnoise1(lx / 5, seed)) - 1.4 * (vnoise1(lx / 1.8, seed + 1) - 0.5);
    };
    const X0 = Math.max(b.ox, Math.round(c.X(-W - 2))), X1 = Math.min(b.x1, Math.round(c.X(W + 2)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const T = top(lx);
      if (T > -0.5) continue;
      for (let y = Math.max(Math.round(c.Y(T)), b.oy); y < Math.min(Math.round(c.Y(0)), b.y1); y++) {
        const ly = c.ly(y + 0.5);
        const v = (ly - T) / Math.max(1, -T);
        // folds: dark creases following the lumps, the top of each fold lit
        const crease = vnoise(lx / 3.6, ly / 2, seed + 2);
        let t = 0.42 + v * 0.35 + (lx / W > 0.35 ? 0.12 : 0);
        if (crease > 0.64) t += 0.28;
        else if (crease < 0.3 && v < 0.6) t -= 0.12;
        if (ly - T < 1.1 / d) t -= 0.18;
        if (onMesh(lx, ly, 3.2, d) && t < 0.8) t -= 0.18;
        b.set(x, y, tone(P.earth, clamp(0.3 + t * 0.65, 0, 1), x, y, 0.3));
      }
    }
    // the drape: a ragged curtain of open mesh down the deck's face, from the heap's right side
    const dr = p.drape ?? 0;
    const hx0 = W * 0.05, hx1 = W * 1.05;
    if (dr > 0) {
      for (let x = Math.max(b.ox, Math.round(c.X(hx0))); x < Math.min(b.x1, Math.round(c.X(hx1))); x++) {
        const lx = c.lx(x + 0.5), u = (lx - hx0) / (hx1 - hx0);
        const edge = dr * (0.45 + 0.55 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.85)) + 2.2 * (vnoise1(lx / 2.5, seed + 4) - 0.5);
        for (let y = Math.max(Math.round(c.Y(0)), b.oy); y < Math.min(Math.round(c.Y(edge)), b.y1); y++) {
          const ly = c.ly(y + 0.5);
          // the mesh stretches as it hangs: wider cells lower down
          if (!onMesh(lx + ly * 0.15, ly, 3 + ly * 0.12, d) && ly > 1.2) continue;
          b.set(x, y, ly < 1.2 ? P.earth[3]! : tone(P.earth, clamp(0.4 + ly / dr * 0.4, 0, 1), x, y, 0.3));
        }
      }
    }
    // the float line: cork floats looping over the heap, then down with the drape
    const nf = 3 + Math.floor(hash1(1, seed) * 2);
    for (let i = 0; i < nf; i++) {
      const fx = -W * 0.7 + (W * 1.5 * (i + 0.3 * hash1(i, seed + 3))) / nf;
      const fy = fx > hx0 + 2 && dr > 0 ? Math.min(dr * 0.85, (fx - hx0) / (hx1 - hx0) * dr + 1) : top(fx) * 0.55 + 0.4;
      for (let y = Math.round(c.Y(fy - 1.3)); y < Math.round(c.Y(fy + 1.3)); y++) {
        for (let x = Math.round(c.X(fx - 1.7)); x < Math.round(c.X(fx + 1.7)); x++) {
          const ex = (c.lx(x + 0.5) - fx) / 1.7, ey = (c.ly(y + 0.5) - fy) / 1.3;
          if (ex * ex + ey * ey > 1) continue;
          b.set(x, y, ex + ey < -0.4 ? P.paper[2]! : ex + ey < 0.5 ? P.earth[1]! : P.earth[3]!);
        }
      }
    }
  },
});

export interface BasketP {
  /** Height, px; anchor at its foot, middle. */
  h: number;
}

/**
 * A fisher's creel of woven bamboo, squat and wide: a round belly in weave rows, a short neck,
 * a domed lid with its knob, a rope handle; lit on its upper left, the weave darker in its
 * shade. Anchor: its foot, middle.
 */
export const basket = definePainter<BasketP>("op.basket", {
  bounds(p) {
    return [-p.h * 0.75 - 2, -p.h * 1.4, Math.max(p.h * 0.75 + 4, p.h * 0.64 * 0.8 + shadowReach(p.h * 1.02) + 2), 4];
  },
  paint(c, p) {
    const hh = p.h, d = c.d;
    const r = hh * 0.64;
    footShadow(c, -r * 0.8, r * 0.8);
    const half = (t: number): number => (t > 0.84 ? r * 0.42 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.84) / 0.17, 2))) + r * 0.05 : t > 0.74 ? r * 0.46 : r * (0.72 + 0.28 * Math.sin(Math.min(1, (t + 0.06) / 0.8) * Math.PI)) * (t < 0.08 ? 0.88 + t * 1.5 : 1));
    fill(c, -r - 1, -hh, r + 1, 0, (x, y, _u, v) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      const t = -ly / hh;
      const hw = half(t);
      if (Math.abs(lx) > hw) return 0;
      const q = lx / hw;
      // the lid and its rim
      if (t > 0.84) return tone(P.earth, q < -0.3 ? 0.15 : q < 0.4 ? 0.35 : 0.62, x, y, 0.3);
      if (t > 0.74) return P.earth[t > 0.8 ? 4 : 3]!;
      // the weave: rows of strands over and under the uprights
      const row = Math.floor(ly / (d >= 1 ? 1.6 : 2.2));
      const colw = Math.floor(q * 5 + 5 + (row & 1) * 0.5);
      let tt = (q < -0.45 ? 0.12 : q < 0.3 ? 0.32 : 0.58) + ((colw + row) & 1 ? 0.12 : 0);
      if (Math.abs(q) > 0.9) tt += 0.22;
      if (v > 0.88) tt += 0.15;
      return tone(P.earth, clamp(0.08 + tt * 0.82, 0, 1), x, y, 0.3);
    });
    // the lid's knob and the rope handle
    fill(c, -1.2, -hh - 1.6, 1.2, -hh + 0.2, () => P.earth[3]!);
    for (let a = 0.25; a <= Math.PI - 0.25; a += 0.05 / Math.max(1, d)) c.buf.set(Math.round(c.X(Math.cos(a) * r * 0.55)), Math.round(c.Y(-hh * 0.8 - Math.sin(a) * hh * 0.42)), P.earth[2]!);
  },
});

export interface BucketP {
  h?: number;
}

/** A wooden bucket with a rope handle: staves, two iron hoops, a wet dark ring on the deck under it. */
export const bucket = definePainter<BucketP>("op.bucket", {
  bounds(p) {
    const hh = p.h ?? 20;
    return [-hh * 0.7, -hh * 1.7, Math.max(hh * 0.7 + 3, hh * 0.62 + shadowReach(hh * 1.24) + 2), 4];
  },
  paint(c, p) {
    const hh = p.h ?? 20, d = c.d, seed = c.seed;
    footShadow(c, -hh * 0.62, hh * 0.62, true);
    fill(c, -hh * 0.55, -hh, hh * 0.55, 0, (x, y, _u, v) => {
      const half = hh * (0.55 - 0.1 * v);
      const lx = c.lx(x + 0.5);
      if (Math.abs(lx) > half) return 0;
      const u = (lx + half) / (2 * half);
      if (Math.abs(v - 0.25) < 0.07 || Math.abs(v - 0.78) < 0.07) return u < 0.3 ? P.lacquer[1]! : u > 0.8 ? P.ink[1]! : P.ink[1]!;
      // staves, each its own tone, seams between
      const st = Math.floor(u * 6);
      let t = (u < 0.2 ? 0.1 : u < 0.6 ? 0.3 : 0.6) + (hash1(st, seed) - 0.5) * 0.14;
      if (d >= 1 && Math.abs(u * 6 - Math.round(u * 6)) < 0.08) t += 0.2;
      // wet and dark toward the foot
      if (v > 0.86) t += 0.2;
      if (v < 0.06) t = 0.02;
      return wood(x, y, clamp(t, 0, 1), v < 0.8);
    });
    // the handle: a rope arc
    for (let a = 0; a <= Math.PI; a += 0.05 / Math.max(1, d)) {
      c.buf.set(Math.round(c.X(Math.cos(a) * hh * 0.5)), Math.round(c.Y(-hh - Math.sin(a) * hh * 0.6)), P.earth[2]!);
    }
  },
});

export interface CoilP {
  r?: number;
  /** Its free end hangs over the deck's edge this far, px (default 0: it trails along the deck). */
  hang?: number;
}

/**
 * A coil of rope lying on the deck, seen side-on: a short stack of fat loops (each a twisted band
 * of strands, lit along its top, a dark gap under it), the top loop's opening a dark slit, its
 * free end trailing off and over the deck's edge.
 */
export const coil = definePainter<CoilP>("op.coil", {
  bounds(p) {
    const r = p.r ?? 12;
    return [-r - 18, -r - 3, r + shadowReach(2 * r) + 2, Math.max(4, (p.hang ?? 0) + 3)];
  },
  paint(c, p) {
    const r = p.r ?? 12, d = c.d, seed = c.seed;
    footShadow(c, -r, r);
    // a stack of loops of rope, each the same size give or take (a coil, not a mound), each a
    // fat twisted band whose ends turn round out of sight, a dark crease between loops
    const loops = 4;
    const th = r * 0.27;
    for (let k = 0; k < loops; k++) {
      const off = (hash1(k, seed) - 0.5) * r * 0.16;
      const rr = r * (0.94 + 0.08 * hash1(k, seed + 1)) - (k === loops - 1 ? r * 0.06 : 0);
      const yb = -k * th * 0.92;
      for (let lx = -rr; lx <= rr; lx += 0.5 / d) {
        const X = Math.round(c.X(lx + off));
        const q = lx / rr;
        // the loop's ends round off: its band thins where the rope turns away
        const e = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(q), 6)));
        const y0 = yb - th * (0.25 + 0.75 * e), y1 = yb - th * 0.08 * (1 - e);
        for (let s = y0; s < y1; s += 0.5 / d) {
          const Y = Math.round(c.Y(s));
          const v = (s - y0) / Math.max(0.5, y1 - y0);
          // strands: twists slanting across the band, lit on top, a lit left end
          const tw = ((lx * 1.25 - s * 1.7 + k * 0.9) % 2.6 + 2.6) % 2.6;
          let i = v < 0.3 ? 0 : v < 0.65 ? 1 : 3;
          if (d >= 0.5 && tw < 0.8) i += 1;
          if (q > 0.55) i += 1;
          if (q < -0.8 && v < 0.6) i = Math.max(0, i - 1);
          c.buf.set(X, Y, P.earth[Math.min(5, i)]!);
        }
        if (k > 0 && e > 0.3) c.buf.set(X, Math.round(c.Y(yb - 0.1)), P.earth[5]!);
      }
    }
    // the free end: out of the top loop, over its side and off along the deck, then over the edge
    const yt = -(loops - 1) * th * 0.92 - th * 0.6;
    const pts: [number, number][] = [[-r * 0.3, yt], [-r * 0.9, yt + 0.5], [-r - 2, yt + th * 1.4], [-r - 4, -1.5], [-r - 10, -1], [-r - 16, -1.2]];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!;
      const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * d * 2));
      for (let j = 0; j <= n; j++) {
        const t = j / n;
        const X = Math.round(c.X(ax + (bx - ax) * t)), Y = Math.round(c.Y(ay + (by - ay) * t));
        c.buf.set(X, Y, P.earth[((X + Y) & 1) ? 1 : 2]!);
        c.buf.set(X, Y + 1, P.earth[4]!);
      }
    }
    const hang = p.hang ?? 0;
    for (let s = 0; s < hang; s += 0.5 / d) {
      const X = Math.round(c.X(-r - 16 - Math.sin(s / hang * 1.4) * 2)), Y = Math.round(c.Y(-0.5 + s));
      c.buf.set(X, Y, P.earth[(Math.round(s * 2) & 1) ? 1 : 2]!);
      if (d >= 1) c.buf.set(X + 1, Y, P.earth[4]!);
    }
    // a frayed tip
    if (d >= 1) for (let k = -1; k <= 1; k++) c.buf.set(Math.round(c.X(-r - 16 + k * 0.6)), Math.round(c.Y(hang + 0.8)), P.earth[2]!);
  },
});

export interface BoatP {
  /** Hull length, px; anchor at the waterline at the bow (left) end. */
  w: number;
  /** Bob frame (0..7). */
  frame?: number;
}

/**
 * A moored sampan seen side-on, floating: a long low hull of dark weathered planks with a sheer
 * rising to the bow and a little to the stern (nothing under the water: the lake hides it), a
 * rubbing strake, the planks dark and wet at the waterline with a slick line on it, a low woven
 * canopy over its middle with its dark open end toward the bow, a bamboo pole lying along it
 * past the stern, a coil of rope and the bow post its line is tied to, and a dark line where it
 * sits in the water. Lit from the upper left.
 */
export const boat = definePainter<BoatP>("op.boat", {
  bounds(p) {
    return [-12, -46, p.w * 1.12 + 4, 4];
  },
  paint(c, p) {
    const b = c.buf, w = p.w, d = c.d;
    const f = p.frame ?? 0;
    const bob = Math.round(Math.sin((f / 8) * Math.PI * 2) * 1);
    const rock = Math.sin((f / 8) * Math.PI * 2 + 1) * 0.012;
    const yOf = (lx: number, ly: number): number => ly + bob + (lx - w / 2) * rock;
    const sheerAt = (u: number): number => {
      const e = Math.abs(u - 0.5) * 2;
      return -8 - 9 * Math.pow(e, 3.2) - (u < 0.5 ? 6 * Math.pow(e, 4) : 0);
    };
    // the hull, down to the waterline
    for (let lx = -2; lx <= w + 2; lx += 0.5 / d) {
      const u = lx / w;
      if (u < -0.01 || u > 1.01) continue;
      const X = Math.round(c.X(lx));
      if (X < b.ox - 1 || X > b.x1) continue;
      // the bow and stern rake: the hull draws in toward the water at its ends
      const e = Math.abs(u - 0.5) * 2;
      const rake = Math.pow(Math.max(0, e - 0.82) / 0.18, 1.6);
      const bot = -rake * 7;
      const sh = sheerAt(u);
      const Y0 = Math.round(c.Y(yOf(lx, sh))), Y1 = Math.round(c.Y(yOf(lx, bot)));
      for (let y = Y0; y < Y1; y++) {
        const ly = c.ly(y + 0.5) - bob;
        const v = (ly - sh) / Math.max(1, bot - sh);
        let t: number;
        if (y === Y0) t = u < 0.55 ? 0.02 : 0.2;
        else if (v < 0.18) t = 0.4;
        else if (Math.abs(v - 0.26) < 0.06) t = 0.86;
        else t = 0.5 + v * 0.25 + (u > 0.75 ? 0.08 : 0);
        if (d >= 0.5 && v > 0.32 && Math.abs(((v * 3.2) % 1) - 0.5) < 0.07) t += 0.16;
        if (d >= 1 && hash(Math.floor(lx / 5), Math.floor(v * 6), 7) < 0.06) t += 0.14;
        // wet and dark for the last few px above the water, a slick line at it
        const above = -ly;
        if (above < 4.5) t = Math.min(1, t + 0.32 + (4.5 - Math.max(0, above)) * 0.05);
        if (above < 1.1 && u > 0.04 && u < 0.96 && d >= 0.5) { b.set(X, y, u < 0.5 ? P.jade[4]! : P.jade[5]!); continue; }
        b.set(X, y, wood(X, y, clamp(t, 0, 1), y === Y0));
      }
      // where it sits in the water: a dark line under it, a little longer than its foot
      if (u > 0.02 && u < 0.98) {
        const Yw = Math.round(c.Y(yOf(lx, 0)));
        b.set(X, Yw, P.jade[7]!);
        if (d >= 1 && bayer4(X, Yw + 1) < 0.5 - Math.abs(u - 0.5)) b.set(X, Yw + 1, P.jade[7]!);
      }
    }
    // the canopy: woven bamboo matting on hoops over the middle, low and long, its open end dark
    const cx0 = w * 0.4, cx1 = w * 0.74;
    for (let lx = cx0; lx <= cx1; lx += 0.5 / d) {
      const u = (lx - cx0) / (cx1 - cx0);
      const base = sheerAt(lx / w) + 1;
      const top = base - 15 * Math.pow(Math.sin(Math.min(1, u * 1.08 + 0.04) * Math.PI), 0.35);
      const X = Math.round(c.X(lx));
      for (let y = Math.round(c.Y(yOf(lx, top))); y < Math.round(c.Y(yOf(lx, base))); y++) {
        const ly = c.ly(y + 0.5) - bob;
        const v = (ly - top) / Math.max(1, base - top);
        if (u < 0.07) { b.set(X, y, v < 0.15 ? P.earth[3]! : P.timber[6]!); continue; }
        const rib = d >= 0.5 && Math.abs(((u * 5.5) % 1) - 0.5) < 0.06;
        const weave = d >= 1 && ((X + y) & 3) === 0;
        let t = v < 0.2 ? 0.08 : v < 0.6 ? 0.3 : 0.55;
        if (u > 0.7) t += 0.14;
        if (rib) t += 0.3;
        if (weave) t += 0.12;
        b.set(X, y, tone(P.earth, clamp(t, 0, 1), X, y, 0.3));
      }
    }
    // a bamboo pole lying along the gunwale, past the stern
    for (let lx = w * 0.12; lx < w * 1.1; lx += 0.5 / d) {
      const yy = sheerAt(Math.min(1, lx / w)) - 2.5 - (lx - w * 0.12) * 0.02;
      const node = (lx % 22) < 0.8;
      for (let o = 0; o < 2.2; o += 0.5 / d) {
        const X = Math.round(c.X(lx)), Y = Math.round(c.Y(yOf(lx, yy + o)));
        b.set(X, Y, node ? P.earth[3]! : o < 0.7 ? P.earth[0]! : o < 1.5 ? P.earth[1]! : P.earth[3]!);
      }
    }
    // the bow post the mooring line is tied to, and a coil of rope by it
    const px = w * 0.07, py = sheerAt(0.07);
    for (let y = Math.round(c.Y(yOf(px, py - 6))); y < Math.round(c.Y(yOf(px, py + 2))); y++) {
      b.set(Math.round(c.X(px - 0.8)), y, P.timber[3]!);
      b.set(Math.round(c.X(px + 0.8)), y, P.timber[5]!);
    }
    for (let k = 0; k < 3; k++) for (let lx = w * 0.13; lx < w * 0.13 + 7; lx += 0.5 / d) b.set(Math.round(c.X(lx)), Math.round(c.Y(yOf(lx, sheerAt(lx / w) - 1 - k * 1.1))), P.earth[k === 2 ? 1 : 2 + (k & 1)]!);
  },
});
