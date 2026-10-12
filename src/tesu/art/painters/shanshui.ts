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

// --- a paper charm -----------------------------------------------------------------------------

export interface CharmP {
  /** 0, 1: hanging, swaying a little; 2: lit (just used, re-arming). */
  frame?: number;
}

/** A paper charm on a short string: a yellow slip with a red stroke; it glows white-gold when used. Anchor at the string's top. */
export const charm = definePainter<CharmP>("charm", {
  bounds() {
    return [-14, -2, 14, 52];
  },
  paint(c, p) {
    const f = p.frame ?? 0;
    const sway = f === 1 ? 2 : 0;
    const lit = f === 2;
    c.buf.line(c.X(0), c.Y(0), c.X(sway), c.Y(16), P.lacquer[2]!);
    rect(c, -7 + sway, 16, 7 + sway, 46, lit ? P.gold[0]! : P.paper[1]!);
    rect(c, -7 + sway, 16, 7 + sway, 18, lit ? P.gold[1]! : P.gold[2]!);
    rect(c, -2 + sway, 22, 2 + sway, 40, lit ? P.gold[2]! : P.red[3]!);
    rect(c, -5 + sway, 26, 5 + sway, 28, lit ? P.gold[2]! : P.red[3]!);
    if (lit) for (const [dx, dy] of [[-11, 30], [11, 24], [-10, 14], [10, 42]] as const) rect(c, dx + sway, dy, dx + sway + 2, dy + 2, P.gold[1]!);
  },
});

// --- the Kumo-bashi rope bridge ----------------------------------------------------------------

export interface BridgeP {
  /** "deck": a stretch of the dropped bridge along pts (world px relative to the anchor); "rolled": the deck lashed up at the Kumoji end. */
  part: "deck" | "rolled";
  pts?: number[];
  /** Rolled: how far east (px) its rope runs to the lashing post, and how high there. */
  tie?: [number, number];
}

/** Timber slats on two foot ropes with a hand rope above; rolled up, a bundle of slats hanging from its ropes. */
export const ropebridge = definePainter<BridgeP>("ropebridge", {
  bounds(p) {
    if (p.part === "rolled") return [-60, Math.min(-10, (p.tie?.[1] ?? 0) - 6), Math.max(16, (p.tie?.[0] ?? 0) + 6), 150];
    const pts = p.pts ?? [0, 0];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      x0 = Math.min(x0, pts[i]!); x1 = Math.max(x1, pts[i]!);
      y0 = Math.min(y0, pts[i + 1]!); y1 = Math.max(y1, pts[i + 1]!);
    }
    return [x0 - 4, y0 - 60, x1 + 4, y1 + 16];
  },
  paint(c, p) {
    if (p.part === "rolled") {
      // tied back to its post, hanging from the platform's edge down over the drop
      if (p.tie) c.buf.line(c.X(2), c.Y(-4), c.X(p.tie[0]), c.Y(p.tie[1]), P.timber[4]!);
      c.buf.line(c.X(0), c.Y(0), c.X(-28), c.Y(40), P.timber[4]!);
      c.buf.line(c.X(4), c.Y(0), c.X(-20), c.Y(40), P.timber[4]!);
      rect(c, -52, 40, 6, 132, (_x, y) => (Math.floor(c.ly(y + 0.5) / 7) % 2 ? P.timber[2]! : P.timber[3]!));
      rect(c, -52, 60, 6, 64, P.timber[5]!);
      rect(c, -52, 108, 6, 112, P.timber[5]!);
      return;
    }
    const pts = p.pts ?? [];
    for (let i = 2; i < pts.length; i += 2) {
      const ax = pts[i - 2]!, ay = pts[i - 1]!, bx = pts[i]!, by = pts[i + 1]!;
      const len = Math.hypot(bx - ax, by - ay);
      // slats every 9 px across the two foot ropes, the hand rope 48 px above
      for (let s = 0; s < len; s += 9) {
        const u = s / len, x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
        rect(c, x - 3, y - 1, x + 3, y + 5, Math.floor(s / 9) % 3 === 0 ? P.timber[3]! : P.timber[2]!);
      }
      c.buf.line(c.X(ax), c.Y(ay + 5), c.X(bx), c.Y(by + 5), P.timber[5]!);
      c.buf.line(c.X(ax), c.Y(ay - 48), c.X(bx), c.Y(by - 48), P.timber[4]!);
      // the hangers from hand rope to deck
      for (let s = 0; s < len; s += 64) {
        const u = s / len, x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
        c.buf.line(c.X(x), c.Y(y - 48), c.X(x), c.Y(y), P.timber[4]!);
      }
    }
  },
});

// --- the lashing post that holds the rolled bridge ---------------------------------------------

export interface LashingP {
  h?: number;
}

/** A timber bollard with turns of rope round it (break it and the bridge drops). Anchor at its foot, centre. */
export const lashing = definePainter<LashingP>("lashing", {
  bounds(p) {
    const h = p.h ?? 54;
    return [-14, -h - 4, 14, 1];
  },
  paint(c, p) {
    const h = p.h ?? 54;
    rect(c, -8, -h, 8, 0, (x) => (c.lx(x + 0.5) < -3 ? P.timber[2]! : P.timber[3]!));
    rect(c, -9, -h - 4, 9, -h, P.timber[5]!);
    for (let y = -h + 12; y < -12; y += 7) rect(c, -11, y, 11, y + 4, P.earth[2]!);
  },
});

// --- the bamboo flume -------------------------------------------------------------------------

export interface FlumeP {
  /** Its bed, world px (absolute; anchor 0, 0), from the mouth down. */
  pts: number[];
}

/** A split-bamboo flume: a green trough with a bright water line, on posts every few H. */
export const flume = definePainter<FlumeP>("flume", {
  bounds(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < p.pts.length; i += 2) {
      x0 = Math.min(x0, p.pts[i]!); x1 = Math.max(x1, p.pts[i]!);
      y0 = Math.min(y0, p.pts[i + 1]!); y1 = Math.max(y1, p.pts[i + 1]!);
    }
    return [x0 - 12, y0 - 12, x1 + 12, y1 + 300];
  },
  paint(c, p) {
    const pts = p.pts;
    for (let i = 2; i < pts.length; i += 2) {
      const ax = pts[i - 2]!, ay = pts[i - 1]!, bx = pts[i]!, by = pts[i + 1]!;
      for (const [off, col] of [[2, P.cloud[1]!], [4, P.bamboo[2]!], [6, P.bamboo[2]!], [8, P.bamboo[3]!], [10, P.bamboo[4]!]] as const) {
        c.buf.line(c.X(ax), c.Y(ay + off), c.X(bx), c.Y(by + off), col);
      }
      // posts down from the trough every 6 H or so
      const len = Math.hypot(bx - ax, by - ay);
      for (let s = 0; s < len; s += 576) {
        const u = s / len, x = ax + (bx - ax) * u, y = ay + (by - ay) * u;
        c.buf.line(c.X(x), c.Y(y + 10), c.X(x), c.Y(y + 290), P.bamboo[4]!);
      }
    }
  },
});

// --- Yuemen's ring ----------------------------------------------------------------------------

export interface RingP {
  /** Outer radius and the band's thickness, px; anchor at its centre. */
  r: number;
  w: number;
}

/** A great stone ring in flat values: lit along its top left, shaded toward its lower right. */
export const ring = definePainter<RingP>("ring", {
  bounds(p) {
    return [-p.r - 2, -p.r - 2, p.r + 2, p.r + 2];
  },
  paint(c, p) {
    const r0 = p.r - p.w, r1 = p.r;
    rect(c, -r1, -r1, r1, r1, (x, y) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      const d = Math.hypot(lx, ly);
      if (d < r0 || d > r1) return 0;
      // the outer and inner rims a step lighter and darker, the light from the upper left
      if (d > r1 - 3) return P.karst[2]!;
      if (d < r0 + 3) return P.karst[6]!;
      const a = (lx + ly) / Math.max(1, d);
      return a < -0.4 ? P.karst[3]! : a > 0.5 ? P.karst[5]! : P.karst[4]!;
    });
  },
});

// --- a kite for the Kite Line ------------------------------------------------------------------

/** A big paper kite (a diamond with a cross-spar and a tail of bows), its bridle down to her hands. Anchor at the bridle's foot. */
export const kite = definePainter<Record<string, never>>("kite", {
  bounds() {
    return [-70, -220, 70, 4];
  },
  paint(c) {
    const cy = -150, hw = 56, hh = 66;
    rect(c, -hw, cy - hh, hw, cy + hh, (x, y) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5) - cy;
      const k = Math.abs(lx) / hw + Math.abs(ly) / hh;
      if (k > 1) return 0;
      if (Math.abs(lx) < 2 || Math.abs(ly + 10) < 2) return P.timber[4]!;
      return lx < 0 ? P.red[2]! : P.paper[1]!;
    });
    c.buf.line(c.X(0), c.Y(0), c.X(-20), c.Y(cy), P.lacquer[2]!);
    c.buf.line(c.X(0), c.Y(0), c.X(20), c.Y(cy), P.lacquer[2]!);
    for (let i = 0; i < 5; i++) rect(c, 50 + i * 4, cy + hh - 6 + i * 14, 58 + i * 4, cy + hh - 2 + i * 14, P.red[3]!);
  },
});
