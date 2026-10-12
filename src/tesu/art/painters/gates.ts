// Gate Road's vermilion gates, drawn face-on so each one frames her as she walks through
// it: torii (two round pillars, a tie beam, a black-capped lintel that sweeps up at the
// ends, a strut with a plaque) and a paifang (a ceremonial arch with tiled roofs). Each
// gate carries one plaque; its glyph comes from data (gate plaques are the composer's).
// Also the road's railing and the terrace furniture.

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { clamp, hash, tone } from "../raster.ts";

export interface GateP {
  kind?: "torii" | "paifang";
  /** Distance between the pillar centres, level-1 px. */
  span: number;
  /** Height of the lintel's top above the ground, px. */
  h: number;
  /** Pillar width, px (default 18). */
  pw?: number;
  /** Draw only the pillar bases (the near half of a gate drawn in front of her). */
  part?: "all" | "front";
}

/** A vertical round pillar from y0 to y1 (level-1 local), lit from the left. */
function pillar(c: PaintCtx, cx: number, y0: number, y1: number, w: number, ramp: readonly number[], baseH: number): void {
  const X0 = Math.round(c.X(cx - w / 2)), X1 = Math.max(X0 + 2, Math.round(c.X(cx + w / 2)));
  const Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  const Yb = Math.round(c.Y(y1 - baseH));
  for (let y = Y0; y < Y1; y++) {
    for (let x = X0; x < X1; x++) {
      const u = (x - X0 + 0.5) / (X1 - X0);
      const base = y >= Yb;
      // black lacquer sleeve at the foot, vermilion above
      const r = base ? P.lacquer : ramp;
      let t = u < 0.22 ? 0.12 : u < 0.62 ? 0.38 : u < 0.86 ? 0.62 : 0.82;
      if (x === X0 || x === X1 - 1) t = 0.95;
      if (base && y === Yb) t = 0.2;
      c.buf.set(x, y, tone(r, t, x, y, 0.3));
    }
  }
}

/** A horizontal beam from x0 to x1 at y (top) with thickness th; ends may sweep up. */
function beam(c: PaintCtx, x0: number, x1: number, y: number, th: number, ramp: readonly number[], sweep = 0, capRamp?: readonly number[], capTh = 0): void {
  const steps = Math.max(2, Math.ceil((x1 - x0) * c.d));
  const mid = (x0 + x1) / 2, half = (x1 - x0) / 2;
  for (let i = 0; i <= steps; i++) {
    const lx = x0 + ((x1 - x0) * i) / steps;
    const k = Math.abs(lx - mid) / half;
    const lift = sweep * Math.pow(Math.max(0, k - 0.55) / 0.45, 2);
    const yt = y - lift;
    const X = Math.round(c.X(lx));
    const Y0 = Math.round(c.Y(yt)), Yc = Math.round(c.Y(yt + capTh)), Y1 = Math.round(c.Y(yt + capTh + th));
    for (let yy = Y0; yy < Y1; yy++) {
      if (yy < Yc && capRamp) {
        c.buf.set(X, yy, tone(capRamp, yy === Y0 ? 0.15 : 0.7, X, yy, 0.3));
        continue;
      }
      const v = (yy - Yc) / Math.max(1, Y1 - Yc);
      let t = v < 0.3 ? 0.18 : v < 0.75 ? 0.42 : 0.7;
      if (yy === Y1 - 1) t = 0.95;
      c.buf.set(X, yy, tone(ramp, t, X, yy, 0.3));
    }
  }
}

function plaque(c: PaintCtx, cx: number, y: number, w: number, h: number): void {
  const X0 = Math.round(c.X(cx - w / 2)), X1 = Math.round(c.X(cx + w / 2));
  const Y0 = Math.round(c.Y(y)), Y1 = Math.round(c.Y(y + h));
  for (let yy = Y0; yy < Y1; yy++) {
    for (let x = X0; x < X1; x++) {
      const edge = x === X0 || x === X1 - 1 || yy === Y0 || yy === Y1 - 1;
      const rim = x === X0 + 1 || x === X1 - 2 || yy === Y0 + 1 || yy === Y1 - 2;
      c.buf.set(x, yy, edge ? P.ink[0]! : rim ? P.gold[2]! : P.lacquer[2]!);
    }
  }
  // the glyph's place: a gold mark (the plaque's glyph comes from data)
  if (c.d >= 0.5) {
    const gx = Math.round(c.X(cx)), gy0 = Math.round(c.Y(y + h * 0.25)), gy1 = Math.round(c.Y(y + h * 0.75));
    for (let yy = gy0; yy < gy1; yy++) c.buf.set(gx, yy, P.gold[1]!);
  }
}

export const gate = definePainter<GateP>("gate", {
  bounds(p) {
    const over = p.kind === "paifang" ? 70 : 48;
    return [-p.span / 2 - over, -p.h - (p.kind === "paifang" ? 60 : 20), p.span / 2 + over, 6];
  },
  paint(c, p) {
    const pw = p.pw ?? 24;
    const half = p.span / 2;
    const R = P.red;
    if (p.part === "front") {
      // only the stone footings, drawn in front of her
      for (const sx of [-half, half]) {
        const X0 = Math.round(c.X(sx - pw * 0.8)), X1 = Math.round(c.X(sx + pw * 0.8));
        const Y0 = Math.round(c.Y(-8)), Y1 = Math.round(c.Y(4));
        for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) c.buf.set(x, y, tone(P.stone, y === Y0 ? 0.1 : x === X0 || x === X1 - 1 ? 0.9 : 0.4, x, y, 0.3));
      }
      return;
    }
    if (p.kind === "paifang") {
      // four posts, a wide central bay, two side bays; tiled roofs over each, the middle highest
      const posts = [-half, -half * 0.36, half * 0.36, half];
      for (const sx of posts) pillar(c, sx, -p.h + 30, 0, pw * (Math.abs(sx) < half ? 1 : 0.85), R, 18);
      beam(c, -half - 10, half + 10, -p.h + 52, 12, R);
      beam(c, -half * 0.36 - 6, half * 0.36 + 6, -p.h + 92, 9, R);
      plaque(c, 0, -p.h + 62, Math.min(46, half * 0.5), 26);
      const roof = (x0: number, x1: number, y: number, rh: number): void => {
        for (let ly = y - rh; ly < y + 2; ly += 1 / c.d) {
          const u = (y - ly) / rh;
          const flare = u < 0.25 ? 16 * (1 - u / 0.25) : 0;
          const xa = Math.round(c.X(x0 - 14 - flare + u * 10)), xb = Math.round(c.X(x1 + 14 + flare - u * 10));
          const Y = Math.round(c.Y(ly));
          for (let x = xa; x < xb; x++) {
            let col = u > 0.88 ? P.gold[2]! : tone(P.tile, clamp(0.3 + 0.4 * (1 - u) + (Math.floor((y - ly) * c.d / 3) % 2) * 0.12, 0, 1), x, Y, 0.3);
            if (ly > y) col = P.ink[0]!;
            if (x === xa || x === xb - 1) col = P.ink[0]!;
            c.buf.set(x, Y, col);
          }
        }
      };
      roof(-half - 8, -half * 0.36 + 8, -p.h + 40, 26);
      roof(half * 0.36 - 8, half + 8, -p.h + 40, 26);
      roof(-half * 0.36 - 6, half * 0.36 + 6, -p.h + 6, 34);
      return;
    }
    // torii: pillars, the tie beam (nuki) through them, the strut with its plaque, the lintel
    for (const sx of [-half, half]) pillar(c, sx, -p.h + 22, 0, pw, R, 16);
    beam(c, -half - 22, half + 22, -p.h + 52, 11, R);
    plaque(c, 0, -p.h + 26, Math.max(16, pw * 1.5), 24);
    beam(c, -half - 44, half + 44, -p.h, 13, R, 14, P.lacquer, 6);
    void hash;
  },
});

export interface RailP {
  /** Run of the rail, level-1 px, following the ground: [x, y, x, y ...] relative to the anchor. */
  pts: number[];
  /** Height of the top rail above the ground, px. */
  h?: number;
  /** Post spacing, px. */
  every?: number;
}

/** A stone balustrade with vermilion posts, following the ground (drawn in front of her). */
export const rail = definePainter<RailP>("rail", {
  bounds(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.pts.length; i += 2) {
      x0 = Math.min(x0, p.pts[i]!); x1 = Math.max(x1, p.pts[i]!);
      y0 = Math.min(y0, p.pts[i + 1]!); y1 = Math.max(y1, p.pts[i + 1]!);
    }
    return [x0 - 8, y0 - (p.h ?? 50) - 8, x1 + 8, y1 + 8];
  },
  paint(c, p) {
    const hgt = p.h ?? 50;
    const every = p.every ?? 64;
    const pts = p.pts;
    const yAt = (lx: number): number => {
      if (lx <= pts[0]!) return pts[1]!;
      for (let i = 2; i < pts.length; i += 2) if (pts[i]! >= lx) return pts[i - 1]! + ((lx - pts[i - 2]!) / (pts[i]! - pts[i - 2]!)) * (pts[i + 1]! - pts[i - 1]!);
      return pts[pts.length - 1]!;
    };
    const x0 = pts[0]!, x1 = pts[pts.length - 2]!;
    // the top rail and a lower rail
    for (let lx = x0; lx <= x1; lx += 1 / c.d) {
      const g = yAt(lx);
      const X = Math.round(c.X(lx));
      for (const [off, th, ramp] of [[hgt, 7, P.stone], [hgt * 0.45, 4, P.stone]] as const) {
        const Y0 = Math.round(c.Y(g - off)), Y1 = Math.round(c.Y(g - off + th));
        for (let y = Y0; y < Y1; y++) c.buf.set(X, y, tone(ramp, y === Y0 ? 0.08 : y === Y1 - 1 ? 0.85 : 0.35, X, y, 0.3));
      }
    }
    // posts with vermilion caps
    for (let lx = x0; lx <= x1 + 0.1; lx += every) {
      const g = yAt(lx);
      const X0 = Math.round(c.X(lx - 5)), X1 = Math.round(c.X(lx + 5));
      const Y0 = Math.round(c.Y(g - hgt - 8)), Y1 = Math.round(c.Y(g + 2));
      const Yc = Math.round(c.Y(g - hgt - 1));
      for (let y = Y0; y < Y1; y++) {
        for (let x = X0; x < X1; x++) {
          const u = (x - X0 + 0.5) / Math.max(1, X1 - X0);
          const cap = y < Yc;
          let t = u < 0.3 ? 0.12 : u < 0.7 ? 0.38 : 0.7;
          if (x === X0 || x === X1 - 1) t = 0.92;
          c.buf.set(x, y, tone(cap ? P.red : P.stone, t, x, y, 0.3));
        }
      }
    }
  },
});

export interface BenchP {
  w: number;
}

/** A stone bench (the terrace's scale object). */
export const bench = definePainter<BenchP>("bench", {
  bounds(p) {
    return [-4, -34, p.w + 4, 2];
  },
  paint(c, p) {
    const slab = (x0: number, x1: number, y0: number, y1: number): void => {
      const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
      for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
        let t = y === Y0 ? 0.05 : 0.35 + 0.3 * ((y - Y0) / Math.max(1, Y1 - Y0));
        if (x === X0 || x === X1 - 1 || y === Y1 - 1) t = 0.92;
        c.buf.set(x, y, tone(P.stone, t, x, y, 0.3));
      }
    };
    slab(8, 20, -24, 0);
    slab(p.w - 20, p.w - 8, -24, 0);
    slab(0, p.w, -32, -22);
  },
});

export interface BarrelP {
  h?: number;
}

/** A wooden water barrel bound with iron. */
export const barrel = definePainter<BarrelP>("barrel", {
  bounds(p) {
    const hh = p.h ?? 40;
    return [-18, -hh - 2, 18, 2];
  },
  paint(c, p) {
    const hh = p.h ?? 40;
    const X0 = Math.round(c.X(-15)), X1 = Math.round(c.X(15)), Y0 = Math.round(c.Y(-hh)), Y1 = Math.round(c.Y(0));
    for (let y = Y0; y < Y1; y++) {
      const v = (y - Y0) / Math.max(1, Y1 - Y0);
      const bulge = Math.round(2 * Math.sin(v * Math.PI) * c.d);
      for (let x = X0 - bulge; x < X1 + bulge; x++) {
        const u = (x - X0 + bulge + 0.5) / (X1 - X0 + 2 * bulge);
        const hoop = Math.abs(v - 0.2) < 0.05 || Math.abs(v - 0.8) < 0.05;
        let t = u < 0.3 ? 0.18 : u < 0.7 ? 0.42 : 0.7;
        if (x === X0 - bulge || x === X1 + bulge - 1 || y === Y1 - 1) t = 0.95;
        c.buf.set(x, y, hoop ? (u < 0.4 ? P.ink[1]! : P.ink[0]!) : y === Y0 ? P.jade[3]! : tone(P.timber, t, x, y, 0.3));
      }
    }
  },
});
