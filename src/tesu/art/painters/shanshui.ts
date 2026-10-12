// Neutral stand-ins for Shanshui (no environment owner yet): the Silk Line's cable and cars,
// and stone pillars in flat values (a lit top, a lit west edge, the body, a shaded east edge;
// the silhouette stepped, never textured), to be replaced in the same slots.

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { hash } from "../raster.ts";

function rect(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: number | ((x: number, y: number) => number)): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = typeof col === "number" ? col : col(x, y);
      if (v) c.buf.set(x, y, v);
    }
  }
}

// --- a stone pillar ----------------------------------------------------------------------------

export interface PillarP {
  /** Width and height, px; anchor at the top, centre. */
  w: number;
  h: number;
  /** A flat green band on its crown (the pillars of the forest carry trees; Kumoji's do not). */
  crown?: boolean;
}

/** One stone pillar: stepped flanks (its width changes in a few blocks down its height), flat values. */
export const pillar = definePainter<PillarP>("pillar", {
  bounds(p) {
    return [-p.w * 0.7, -16, p.w * 0.7, p.h + 2];
  },
  paint(c, p) {
    const hw = p.w / 2;
    // the flanks step in and out every block of rows: a simple silhouette, the same at any density
    const block = Math.max(40, p.w * 1.3);
    const halfAt = (ly: number): [number, number] => {
      const k = Math.floor(ly / block);
      const a = (hash(k, 1, c.seed) - 0.5) * 0.28, b = (hash(k, 2, c.seed) - 0.5) * 0.28;
      return [-hw * (1 + a), hw * (1 + b)];
    };
    const X0 = Math.round(c.X(-p.w * 0.7)), X1 = Math.round(c.X(p.w * 0.7));
    const Y0 = Math.round(c.Y(p.crown ? -12 : 0)), Y1 = Math.round(c.Y(p.h));
    for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
      const ly = c.ly(y + 0.5);
      if (ly < 0) {
        // the crown: a flat band of green, rounded at its ends
        const r = hw * 0.95 * Math.sqrt(Math.max(0, 1 - ((ly + 12) / 12) ** 2 * 0.6));
        for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
          const lx = c.lx(x + 0.5);
          if (Math.abs(lx) <= r) c.buf.set(x, y, lx < -r * 0.3 ? P.moss[4]! : P.moss[5]!);
        }
        continue;
      }
      const [l, r] = halfAt(ly);
      for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
        const lx = c.lx(x + 0.5);
        if (lx < l || lx > r) continue;
        const u = (lx - l) / Math.max(1, r - l);
        const t = ly < 3 ? P.karst[1]! : u < 0.16 ? P.karst[3]! : u > 0.8 ? P.karst[6]! : P.karst[4]!;
        c.buf.set(x, y, t);
      }
    }
  },
});

// --- the ropeway's cable -----------------------------------------------------------------------

export interface CableP {
  /** The cable's path, world px (absolute; anchor 0, 0). */
  pts: number[];
}

/** The Silk Line's cable: one dark line, doubled for weight. */
export const ropecable = definePainter<CableP>("ropecable", {
  bounds(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.pts.length; i += 2) {
      x0 = Math.min(x0, p.pts[i]!); x1 = Math.max(x1, p.pts[i]!);
      y0 = Math.min(y0, p.pts[i + 1]!); y1 = Math.max(y1, p.pts[i + 1]!);
    }
    return [x0 - 8, y0 - 8, x1 + 8, y1 + 8];
  },
  paint(c, p) {
    const pts = p.pts;
    for (let i = 2; i < pts.length; i += 2) {
      for (const off of [0, 1]) c.buf.line(c.X(pts[i - 2]!), c.Y(pts[i - 1]!) + off, c.X(pts[i]!), c.Y(pts[i + 1]!) + off, P.lacquer[2]!);
    }
  },
});

// --- a ropeway car -----------------------------------------------------------------------------

export interface CarP {
  /** "front": the waist-high front panel and the corner posts, drawn in front of her. */
  part?: "front";
  w?: number;
  /** The cabin's height and the hanger's length, px. Anchor at the grip on the cable. */
  h?: number;
  hanger?: number;
}

export const CAR = { w: 104, h: 132, hanger: 58 };

/** A ropeway car hanging from its grip: hanger arm, a dark roof, the cabin with a window band. */
export const ropecar = definePainter<CarP>("ropecar", {
  bounds(p) {
    const w = p.w ?? CAR.w, h = p.h ?? CAR.h, hg = p.hanger ?? CAR.hanger;
    return [-w / 2 - 10, -10, w / 2 + 10, hg + h + 2];
  },
  paint(c, p) {
    const w = p.w ?? CAR.w, h = p.h ?? CAR.h, hg = p.hanger ?? CAR.hanger;
    const hw = w / 2, top = hg, floor = hg + h;
    if (p.part === "front") {
      rect(c, -hw, floor - h * 0.42, hw, floor - 8, P.timber[2]!);
      rect(c, -hw, floor - h * 0.42 - 5, hw, floor - h * 0.42, P.timber[1]!);
      rect(c, -hw, floor - 8, hw, floor, P.timber[5]!);
      for (const sx of [-hw, hw - 6]) rect(c, sx, top + 12, sx + 6, floor, P.timber[4]!);
      return;
    }
    // the grip and the hanger arm
    rect(c, -10, -8, 10, 4, P.lacquer[1]!);
    rect(c, -3, 0, 3, top, P.lacquer[2]!);
    // the roof
    rect(c, -hw - 6, top, hw + 6, top + 12, P.tile[3]!);
    rect(c, -hw + 4, top - 4, hw - 4, top, P.tile[2]!);
    // the cabin: its back wall, a window band, the floor
    rect(c, -hw, top + 12, hw, floor, (x, y) => {
      const ly = c.ly(y + 0.5), lx = c.lx(x + 0.5);
      const win = ly > top + 22 && ly < top + 70;
      if (win) return Math.abs(((lx + hw) % 26) - 13) < 2 ? P.timber[4]! : P.cloud[3]!;
      return P.timber[3]!;
    });
    rect(c, -hw, floor - 8, hw, floor, P.timber[5]!);
  },
});
