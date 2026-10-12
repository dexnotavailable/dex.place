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
      if (hoop) return u < 0.3 ? P.ink[1]! : u > 0.8 ? P.ink[0]! : (d >= 1 && bayer4(x, y) < 0.2 ? P.timber[3]! : P.ink[1]!);
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

export interface BucketP {
  h?: number;
}

/** A wooden bucket with a rope handle. */
export const bucket = definePainter<BucketP>("op.bucket", {
  bounds(p) {
    const hh = p.h ?? 20;
    return [-hh * 0.7, -hh * 1.7, hh * 0.7, 3];
  },
  paint(c, p) {
    const hh = p.h ?? 20, d = c.d, seed = c.seed;
    contact(c, -hh * 0.6, hh * 0.6, 1);
    fill(c, -hh * 0.55, -hh, hh * 0.55, 0, (x, y, _u, v) => {
      const half = hh * (0.55 - 0.1 * v);
      const lx = c.lx(x + 0.5);
      if (Math.abs(lx) > half) return 0;
      const u = (lx + half) / (2 * half);
      if (Math.abs(v - 0.25) < 0.07 || Math.abs(v - 0.78) < 0.07) return u < 0.35 ? P.ink[1]! : P.ink[0]!;
      const t = (u < 0.2 ? 0.1 : u < 0.6 ? 0.3 : 0.6) + (hash1(Math.floor(u * 5), seed) - 0.5) * 0.1;
      return wood(x, y, t);
    });
    // the handle: a rope arc
    for (let a = 0; a <= Math.PI; a += 0.05 / Math.max(1, d)) {
      c.buf.set(Math.round(c.X(Math.cos(a) * hh * 0.5)), Math.round(c.Y(-hh - Math.sin(a) * hh * 0.6)), P.earth[2]!);
    }
  },
});

export interface CoilP {
  r?: number;
}

/** A coil of rope lying on the deck: loops seen side-on, fibres lit on top, the free end trailing. */
export const coil = definePainter<CoilP>("op.coil", {
  bounds(p) {
    const r = p.r ?? 12;
    return [-r - 16, -r - 2, r + 3, 3];
  },
  paint(c, p) {
    const r = p.r ?? 12, d = c.d;
    contact(c, -r - 2, r + 2, 1);
    for (let k = 0; k < 4; k++) {
      const rr = r * (1 - k * 0.16);
      const yb = -k * 2.4;
      for (let lx = -rr; lx <= rr; lx += 0.5 / d) {
        const X = Math.round(c.X(lx));
        const top = yb - Math.sqrt(Math.max(0, 1 - (lx / rr) ** 2)) * rr * 0.3;
        for (let s = 0; s < 3; s += 0.5 / d) {
          const Y = Math.round(c.Y(top + s));
          const twist = ((X + Y + k) % 3) === 0;
          c.buf.set(X, Y, s < 1 ? P.earth[twist ? 0 : 1]! : P.earth[twist ? 2 : 3]!);
        }
      }
    }
    // the free end trailing off to the left along the deck
    for (let s = 0; s < 16; s += 0.5 / d) c.buf.set(Math.round(c.X(-r - s)), Math.round(c.Y(-1 - Math.sin(s / 3) * 0.8)), P.earth[s % 2 < 1 ? 1 : 2]!);
  },
});

export interface BoatP {
  /** Hull length, px; anchor at the waterline at the bow (left) end. */
  w: number;
  /** Bob frame (0..7). */
  frame?: number;
}

/**
 * A moored sampan: a long low hull of dark weathered planks with a rising bow and stern, a woven
 * bamboo half-canopy, a pole lying along it; its mooring line runs up to the jetty. The hull
 * bobs a pixel and rocks a touch over the cycle.
 */
export const boat = definePainter<BoatP>("op.boat", {
  bounds(p) {
    return [-12, -64, p.w + 12, 18];
  },
  paint(c, p) {
    const w = p.w, d = c.d, seed = c.seed;
    const f = p.frame ?? 0;
    const bob = Math.round(Math.sin((f / 8) * Math.PI * 2) * 1);
    const rock = Math.sin((f / 8) * Math.PI * 2 + 1) * 0.012;
    const yOf = (lx: number, ly: number): number => ly + bob + (lx - w / 2) * rock;
    // hull: sheer line rising to bow and stern, a rounded bottom, plank seams along it
    for (let lx = -4; lx <= w + 4; lx += 0.5 / d) {
      const u = lx / w;
      const end = Math.pow(Math.abs(u - 0.5) * 2, 3);
      const sheer = -10 - 16 * end - (u < 0.5 ? 4 * end : 0);
      const keel = 9 - 9 * Math.pow(Math.abs(u - 0.5) * 2, 2.2);
      if (u < -0.02 || u > 1.02) continue;
      const X = Math.round(c.X(lx));
      const Y0 = Math.round(c.Y(yOf(lx, sheer))), Y1 = Math.round(c.Y(yOf(lx, keel)));
      for (let y = Y0; y < Y1; y++) {
        const v = (y - Y0 + 0.5) / Math.max(1, Y1 - Y0);
        let t = v < 0.1 ? 0.15 : v < 0.25 ? 0.6 : 0.5 + v * 0.35;
        // plank seams following the sheer
        if (d >= 0.5 && Math.abs(((v * 4) % 1) - 0.5) < 0.06 && v > 0.25) t += 0.2;
        if (y === Y1 - 1 || u < 0.01 || u > 0.99) t = 0.95;
        // wet and darker at the waterline
        if (c.ly(y + 0.5) - bob > -2) t = Math.min(1, t + 0.25);
        c.buf.set(X, y, wood(X, y, clamp(t, 0, 1), v < 0.12));
      }
    }
    // the canopy: woven bamboo matting on hoops, over the middle third
    const cx0 = w * 0.36, cx1 = w * 0.7;
    for (let lx = cx0; lx <= cx1; lx += 0.5 / d) {
      const u = (lx - cx0) / (cx1 - cx0);
      const top = -12 - 30 * Math.sqrt(Math.max(0, 1 - (u * 2 - 1) ** 2));
      const X = Math.round(c.X(lx));
      for (let y = Math.round(c.Y(yOf(lx, top))); y < Math.round(c.Y(yOf(lx, -12))); y++) {
        const weave = d >= 0.5 && ((X + y) & 3) === 0;
        const rib = d >= 0.5 && Math.abs(((u * 6) % 1) - 0.5) < 0.05;
        c.buf.set(X, y, rib ? P.timber[4]! : weave ? P.earth[3]! : tone(P.earth, u < 0.25 ? 0.12 : u < 0.7 ? 0.35 : 0.55, X, y, 0.3));
      }
    }
    // a pole lying along the gunwale
    for (let lx = w * 0.08; lx < w * 1.05; lx += 0.5 / d) c.buf.set(Math.round(c.X(lx)), Math.round(c.Y(yOf(lx, -12 - (lx - w * 0.08) * 0.04))), P.timber[2]!);
    void seed;
  },
});
