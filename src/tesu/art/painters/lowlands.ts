// Neutral stand-ins for Hoài Phố and the way down to it (no environment owner yet): flat
// values and simple silhouettes only, to be replaced in the same slots. A covered bridge's
// roof on posts, the waterwheel lift's cable and cage, and the mill race falling down the
// gap between Shiraito's village and the massif.

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4 } from "../raster.ts";

function rect(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: number | ((x: number, y: number) => number)): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = typeof col === "number" ? col : col(x, y);
      if (v) c.buf.set(x, y, v);
    }
  }
}

export interface CanopyP {
  /** Length, px; anchor at the walk's line at its west end. */
  w: number;
  /** Height of the eaves above the walk, px. */
  h: number;
}

/** A covered bridge's roof: posts every 1.4 H, a flat dark roof with a lighter ridge line. */
export const canopy = definePainter<CanopyP>("canopy", {
  bounds(p) {
    return [-16, -p.h - 40, p.w + 16, 2];
  },
  paint(c, p) {
    for (let x = 0; x <= p.w; x += 134) rect(c, x - 4, -p.h, x + 4, 0, P.timber[4]!);
    rect(c, -14, -p.h - 14, p.w + 14, -p.h, P.tile[3]!);
    rect(c, 6, -p.h - 30, p.w - 6, -p.h - 14, P.tile[2]!);
    rect(c, 10, -p.h - 32, p.w - 10, -p.h - 30, P.tile[0]!);
  },
});

export interface LiftP {
  /** The cable's path, world px (absolute; anchor 0, 0), from the top station down. */
  pts: number[];
  /** The cage hangs at this share of the way down (0 top, 1 bottom). */
  at?: number;
}

/** The waterwheel lift: a pair of cables down the massif's face and the cage on them. */
export const liftcable = definePainter<LiftP>("liftcable", {
  bounds(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.pts.length; i += 2) {
      x0 = Math.min(x0, p.pts[i]!); x1 = Math.max(x1, p.pts[i]!);
      y0 = Math.min(y0, p.pts[i + 1]!); y1 = Math.max(y1, p.pts[i + 1]!);
    }
    return [x0 - 40, y0 - 80, x1 + 40, y1 + 10];
  },
  paint(c, p) {
    const pts = p.pts;
    for (let i = 2; i < pts.length; i += 2) {
      for (const off of [-6, 6]) c.buf.line(c.X(pts[i - 2]! + off), c.Y(pts[i - 1]!), c.X(pts[i]! + off), c.Y(pts[i + 1]!), P.lacquer[3]!);
    }
    // the cage, parked at the bottom station
    const n = pts.length;
    const cx = pts[n - 2]!, cy = pts[n - 1]!;
    rect(c, cx - 30, cy - 78, cx + 30, cy - 4, (x, y) => ((x + y) % 6 === 0 ? P.timber[3]! : 0));
    rect(c, cx - 32, cy - 82, cx + 32, cy - 76, P.timber[4]!);
    rect(c, cx - 32, cy - 6, cx + 32, cy, P.timber[4]!);
  },
});

export interface ChuteP {
  /** Width and drop, px; anchor at the top centre (the lip it pours from). */
  w: number;
  h: number;
}

/** The mill race pouring down the gap: a flat strip of falling water, its edges dithered thin. */
export const chute = definePainter<ChuteP>("chute", {
  bounds(p) {
    return [-p.w / 2 - 2, -2, p.w / 2 + 2, p.h + 2];
  },
  paint(c, p) {
    const hw = p.w / 2;
    rect(c, -hw, 0, hw, p.h, (x, y) => {
      const u = (c.lx(x + 0.5) + hw) / p.w;
      const edge = u < 0.18 || u > 0.82;
      if (edge) return bayer4(x, y) > 0.5 ? P.cloud[2]! : 0;
      return u > 0.4 && u < 0.55 ? P.cloud[0]! : P.cloud[1]!;
    });
  },
});
