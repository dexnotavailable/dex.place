// Shiraito 白糸 (GDK A.3), stand-ins for its place's owner to replace in the same slots:
// the plank walks bolted to the cliff (planks on iron brackets, open air beneath), the Prow
// Stair's gallery cut into the palace cliff (a dark recess with steps and lanterns), the
// water mill's wheel (a sprite that turns), a timber hut with a tiled roof, rice-drying
// racks, and the rice terraces stepping down into the mist behind (P3).

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4, clamp, hash, tone } from "../raster.ts";

function fill(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (x: number, y: number, u: number, v: number) => number): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = col(x, y, (x - X0 + 0.5) / Math.max(1, X1 - X0), (y - Y0 + 0.5) / Math.max(1, Y1 - Y0));
      if (v) c.buf.set(x, y, v);
    }
  }
}

function yAt(pts: number[], x: number): number {
  if (x <= pts[0]!) return pts[1]!;
  for (let i = 2; i < pts.length; i += 2) if (pts[i]! >= x) return pts[i - 1]! + ((x - pts[i - 2]!) / (pts[i]! - pts[i - 2]!)) * (pts[i + 1]! - pts[i - 1]!);
  return pts[pts.length - 1]!;
}

function boxOf(pts: number[], pad: [number, number, number, number]): [number, number, number, number] {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]!); x1 = Math.max(x1, pts[i]!);
    y0 = Math.min(y0, pts[i + 1]!); y1 = Math.max(y1, pts[i + 1]!);
  }
  return [x0 - pad[0], y0 - pad[1], x1 + pad[2], y1 + pad[3]];
}

// --- the plank walk bolted to the cliff ---------------------------------------------------------

export interface BoardwalkP {
  /** The walk's surface, world px (absolute; the piece's anchor is 0, 0). */
  pts: number[];
}

/** Timber planks along the path on iron brackets bolted back into the cliff; open air beneath. */
export const boardwalk = definePainter<BoardwalkP>("boardwalk", {
  bounds(p) {
    return boxOf(p.pts, [4, 4, 4, 70]);
  },
  paint(c, p) {
    const x0 = p.pts[0]!, x1 = p.pts[p.pts.length - 2]!;
    for (let lx = x0; lx <= x1; lx += 1 / c.d) {
      const y = yAt(p.pts, lx);
      const X = Math.round(c.X(lx));
      const seam = ((lx - x0) % 22) < 1.2;
      // the deck's edge (planks end-on, a seam every board) and a stringer beam under it
      for (let k = 0; k < 16; k++) {
        const Y = Math.round(c.Y(y + k));
        const t = k === 0 ? 0.1 : k < 7 ? 0.42 + (seam ? 0.3 : 0) : k < 9 ? 0.85 : 0.6;
        c.buf.set(X, Y, k === 15 ? P.timber[6]! : tone(P.timber, t, X, Y, 0.3));
      }
    }
    // iron brackets every 1.2 H: a strut from under the planks back and down into the cliff
    for (let lx = x0 + 30; lx < x1; lx += 115) {
      const y = yAt(p.pts, lx);
      for (let k = 0; k < 50; k++) {
        const X = Math.round(c.X(lx - k * 0.45)), Y = Math.round(c.Y(y + 15 + k));
        c.buf.set(X, Y, P.lacquer[2]!);
        c.buf.set(X + 1, Y, P.lacquer[4]!);
      }
      fill(c, lx - 3, y + 14, lx + 3, y + 18, () => P.lacquer[3]!);
    }
  },
});

// --- the Prow Stair's gallery ----------------------------------------------------------------

export interface GalleryP {
  /** The stair's line, world px (absolute). */
  pts: number[];
  /** Headroom above the steps, px. */
  head?: number;
}

/**
 * The Prow Stair cut down the palace cliff (GDK A.4: a sheltered stair with the whole valley
 * open beside it): a dark recess in the rock along the stair, stone steps, a lantern every
 * few steps.
 */
export const stairgallery = definePainter<GalleryP>("stairgallery", {
  bounds(p) {
    return boxOf(p.pts, [6, (p.head ?? 110) + 8, 6, 16]);
  },
  paint(c, p) {
    const head = p.head ?? 110;
    const x0 = p.pts[0]!, x1 = p.pts[p.pts.length - 2]!;
    for (let lx = x0; lx <= x1; lx += 1 / c.d) {
      const y = yAt(p.pts, lx);
      const X = Math.round(c.X(lx));
      const Ytop = Math.round(c.Y(y - head)), Yb = Math.round(c.Y(y));
      for (let Y = Ytop; Y < Yb; Y++) {
        const v = (Y - Ytop) / Math.max(1, Yb - Ytop);
        // the recess: darkest at the back top, a lit rim along its upper edge
        if (Y - Ytop < 2) { c.buf.set(X, Y, P.karst[3]!); continue; }
        c.buf.set(X, Y, tone(P.karst, clamp(0.88 - v * 0.25, 0, 1), X, Y, 0.4));
      }
      // the steps: a tread line every 14 px, risers a step darker
      const step = Math.floor((lx - x0) / 14);
      const sy = yAt(p.pts, x0 + step * 14);
      for (let k = 0; k < 10; k++) {
        const Y = Math.round(c.Y(Math.min(y, sy) + k));
        c.buf.set(X, Y, k === 0 ? P.stone[1]! : tone(P.stone, 0.45 + k * 0.03, X, Y, 0.3));
      }
    }
    // lanterns hung in the recess every few steps
    for (let lx = x0 + 60; lx < x1 - 20; lx += 240) {
      const y = yAt(p.pts, lx) - head + 10;
      fill(c, lx - 1, y, lx + 1, y + 16, () => P.ink[0]!);
      fill(c, lx - 8, y + 16, lx + 8, y + 36, (x, yy, u, v) => {
        const du = (u - 0.5) * 2, dv = (v - 0.5) * 2;
        if (du * du + dv * dv > 1) return 0;
        return tone(P.red, du < -0.2 ? 0.02 : 0.25, x, yy, 0.3);
      });
    }
  },
});

// --- the water mill's wheel (a sprite) ----------------------------------------------------------

export interface WheelP {
  /** Radius, px; anchor at the hub. */
  r: number;
  /** 0..7: the wheel's turn. */
  frame?: number;
}

/** A timber undershot wheel turning in the mill race: rim, spokes and paddles (8 frames a turn of one paddle). */
export const millwheel = definePainter<WheelP>("millwheel", {
  bounds(p) {
    return [-p.r - 12, -p.r - 12, p.r + 12, p.r + 12];
  },
  paint(c, p) {
    const r = p.r, f = p.frame ?? 0;
    const spokes = 8;
    const a0 = (f / 8) * ((Math.PI * 2) / spokes);
    fill(c, -r - 12, -r - 12, r + 12, r + 12, (x, y) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      const d = Math.hypot(lx, ly);
      const a = Math.atan2(ly, lx) - a0;
      const sector = ((a / ((Math.PI * 2) / spokes)) % 1 + 1) % 1;
      // the rim (two rings), spokes, and paddles standing out from the rim
      if (d > r - 6 && d < r) return tone(P.timber, ly < 0 ? 0.35 : 0.6, x, y, 0.3);
      if (d >= r && d < r + 11 && (sector < 0.07 || sector > 0.93)) return tone(P.timber, 0.5, x, y, 0.3);
      if (d < r - 6 && d > 7 && (sector < 0.035 || sector > 0.965)) return P.timber[4]!;
      if (d <= 7) return P.lacquer[3]!;
      return 0;
    });
  },
});

// --- a timber hut ------------------------------------------------------------------------------

export interface HutP {
  w: number;
  h: number;
}

/** A timber hut on short stilts with a dark tiled roof and a paper window; anchor at its foot, centre. */
export const hut = definePainter<HutP>("hut", {
  bounds(p) {
    return [-p.w / 2 - 22, -p.h - 46, p.w / 2 + 22, 2];
  },
  paint(c, p) {
    const hw = p.w / 2;
    for (const sx of [-hw + 8, hw - 14]) fill(c, sx, -14, sx + 6, 0, (x, y) => tone(P.timber, 0.7, x, y, 0.3));
    fill(c, -hw, -p.h, hw, -14, (x, y, u, v) => {
      if (u < 0.03 || u > 0.97 || v > 0.94) return P.timber[6]!;
      const board = Math.floor(c.lx(x + 0.5) / 9) % 2 === 0;
      const win = u > 0.56 && u < 0.84 && v > 0.25 && v < 0.6;
      if (win) return (Math.floor(c.lx(x) / 6) + Math.floor(c.ly(y) / 6)) % 2 ? P.paper[1]! : P.paper[2]!;
      return tone(P.timber, board ? 0.45 : 0.55, x, y, 0.3);
    });
    // the roof: courses of dark tile rising to a ridge
    const steps = Math.max(2, Math.ceil(40 * c.d));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const half = (hw + 20) * (1 - 0.55 * u);
      const Y = Math.round(c.Y(-p.h - u * 40));
      for (let x = Math.round(c.X(-half)); x < Math.round(c.X(half)); x++) c.buf.set(x, Y, i === steps ? P.tile[0]! : tone(P.tile, 0.3 + 0.45 * (1 - u), x, Y, 0.3));
    }
  },
});

// --- rice-drying racks ----------------------------------------------------------------------

export interface RackP {
  w: number;
}

/** A rice-drying rack: poles, a rail, sheaves hung over it (the scale object of the terraces). */
export const rack = definePainter<RackP>("rack", {
  bounds(p) {
    return [-4, -70, p.w + 4, 2];
  },
  paint(c, p) {
    for (let x = 0; x <= p.w; x += 46) fill(c, x - 2, -66, x + 2, 0, () => P.timber[4]!);
    fill(c, 0, -60, p.w, -57, () => P.timber[3]!);
    for (let x = 6; x < p.w - 6; x += 9) {
      const len = 22 + 6 * hash(x, 3, 9);
      fill(c, x, -57, x + 7, -57 + len, (xx, y, u) => tone(P.gold, u < 0.4 ? 0.2 : 0.45, xx, y, 0.3));
    }
  },
});

// --- the rice terraces behind (P3) --------------------------------------------------------------

export interface PaddiesP {
  /** Width and how many terraces step down; anchor at the top terrace's left end. */
  w: number;
  steps: number;
  /** Rise of each terrace, px. */
  rise?: number;
}

/** Rice terraces stepping down into the mist: green banks, water lines that hold the sky. */
export const paddies = definePainter<PaddiesP>("paddies", {
  bounds(p) {
    return [-4, -4, p.w + 4, p.steps * (p.rise ?? 34) + 40];
  },
  paint(c, p) {
    const rise = p.rise ?? 34;
    for (let i = 0; i < p.steps; i++) {
      const y0 = i * rise, inset = i * 18;
      fill(c, inset, y0, p.w, y0 + rise + 6, (x, y, _u, v) => {
        const ly = c.ly(y + 0.5) - y0;
        if (ly < 3) return v < 0.1 && bayer4(x, y) > 0.5 ? P.cloud[0]! : P.jade[1]!;
        if (ly < 6) return P.moss[2]!;
        return tone(P.moss, clamp(0.35 + v * 0.4, 0, 1), x, y, 0.4);
      });
    }
  },
});
