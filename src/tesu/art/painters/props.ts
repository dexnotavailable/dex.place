// Things that break (GDK 5.6, Appendix G): crates, jars, a lantern post and its paper
// lantern, drawn as sprite painters so they can be hit, fall and come apart; and "chunk",
// which paints any prop and keeps only one of its broken pieces, so the debris is the prop's
// own pixels. The pieces are irregular cells (jittered nearest-site regions) laid over the
// prop's bounds, the same for a given seed at every density.

import { definePainter, painter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4, hash, tone } from "../raster.ts";

function fill(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (x: number, y: number, u: number, v: number) => number): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = col(x, y, (x - X0 + 0.5) / Math.max(1, X1 - X0), (y - Y0 + 0.5) / Math.max(1, Y1 - Y0));
      if (v) c.buf.set(x, y, v);
    }
  }
}

// --- a crate -------------------------------------------------------------------------------

export interface CrateP {
  /** Width and height, px; anchor at the bottom centre. */
  w?: number;
  h?: number;
}

/** A timber crate with corner boards and a cross brace. */
export const crate = definePainter<CrateP>("crate", {
  bounds(p) {
    const w = p.w ?? 40, h = p.h ?? 36;
    return [-w / 2 - 1, -h - 1, w / 2 + 1, 1];
  },
  paint(c, p) {
    const w = p.w ?? 40, h = p.h ?? 36;
    fill(c, -w / 2, -h, w / 2, 0, (x, y, u, v) => {
      if (u < 0.05 || u > 0.95 || v < 0.06 || v > 0.94) return P.timber[5]!;
      if (u < 0.14 || u > 0.86 || v < 0.15 || v > 0.85) return tone(P.timber, u < 0.5 ? 0.25 : 0.45, x, y, 0.3);
      const d1 = Math.abs((u - 0.14) / 0.72 - (v - 0.15) / 0.7);
      if (d1 < 0.07) return tone(P.timber, 0.3, x, y, 0.3);
      const plank = Math.floor((v - 0.15) / 0.7 * 3);
      if (Math.abs(((v - 0.15) / 0.7) * 3 - Math.round(((v - 0.15) / 0.7) * 3)) < 0.06 && plank > 0) return P.timber[5]!;
      return tone(P.timber, 0.5 + 0.12 * u, x, y, 0.3);
    });
  },
});

// --- a jar ----------------------------------------------------------------------------------

export interface JarP {
  h?: number;
  /** Glaze: "celadon" (jade), "ink" (lacquer) or "clay". */
  glaze?: string;
}

/** A glazed storage jar with a narrow neck and a cloth tied over its mouth. */
export const jar = definePainter<JarP>("jar", {
  bounds(p) {
    const h = p.h ?? 34;
    return [-h * 0.42 - 1, -h - 3, h * 0.42 + 1, 1];
  },
  paint(c, p) {
    const h = p.h ?? 34;
    const ramp = p.glaze === "ink" ? P.lacquer : p.glaze === "clay" ? P.earth : P.jade;
    const r = h * 0.42;
    fill(c, -r, -h, r, 0, (x, y, _u, v) => {
      const ly = c.ly(y + 0.5), lx = c.lx(x + 0.5);
      // the profile: a round belly, a narrow neck, a lip
      const t = -ly / h;
      const half = t > 0.86 ? r * 0.42 : t > 0.76 ? r * (0.42 + (0.86 - t) * 3) : r * Math.sin(Math.min(1, (t + 0.08) / 0.84) * Math.PI) ** 0.6;
      if (Math.abs(lx) > half) return 0;
      if (t > 0.86) return tone(P.paper, lx < 0 ? 0.1 : 0.35, x, y, 0.3);
      if (Math.abs(lx) > half - 1.2) return ramp[ramp.length - 1]!;
      const lit = -lx / Math.max(1, half) * 0.6 - (v - 0.5) * 0.8;
      if (lit > 0.55 && bayer4(x, y) > 0.3) return P.paper[0]!;
      return tone(ramp, Math.min(0.9, Math.max(0.05, 0.45 - lit * 0.35)), x, y, 0.35);
    });
    // a red cord round the neck
    fill(c, -r * 0.45, -h * 0.86, r * 0.45, -h * 0.83, () => P.red[3]!);
  },
});

// --- a lantern post and a paper lantern -------------------------------------------------------

export interface PostP {
  /** Height of the post, px; its arm reaches `arm` px to the right at the top. */
  h: number;
  arm?: number;
}

/** A timber lantern post with an arm at the top (a paper lantern hangs from it). */
export const lanternpost = definePainter<PostP>("lanternpost", {
  bounds(p) {
    return [-12, -p.h - 8, (p.arm ?? 40) + 8, 2];
  },
  paint(c, p) {
    const arm = p.arm ?? 40;
    fill(c, -10, -12, 10, 0, (x, y, u) => tone(P.stone, u < 0.3 ? 0.2 : 0.5, x, y, 0.3));
    fill(c, -5, -p.h, 5, -12, (x, y, u) => (u < 0.15 || u > 0.85 ? P.timber[6]! : tone(P.timber, u < 0.5 ? 0.35 : 0.6, x, y, 0.3)));
    fill(c, -5, -p.h - 6, arm + 4, -p.h, (x, y, _u, v) => (v < 0.25 ? P.timber[1]! : tone(P.timber, 0.55, x, y, 0.3)));
    fill(c, arm - 1, -p.h, arm + 1, -p.h + 10, () => P.ink[0]!);
  },
});

export interface PaperLanternP {
  /** Radius, px; anchor at the hook the cord hangs from. */
  r?: number;
}

/** A red paper lantern on a short cord, anchored at its hook. */
export const paperlantern = definePainter<PaperLanternP>("paperlantern", {
  bounds(p) {
    const r = p.r ?? 14;
    return [-r - 2, -1, r + 2, r * 2.8 + 16];
  },
  paint(c, p) {
    const r = p.r ?? 14;
    const cy = 8 + r * 1.2;
    fill(c, -1, 0, 1, 8, () => P.ink[0]!);
    fill(c, -r * 0.5, 6, r * 0.5, 9, () => P.gold[3]!);
    fill(c, -r, cy - r * 1.1, r, cy + r * 1.1, (x, y, u, v) => {
      const du = (u - 0.5) * 2, dv = (v - 0.5) * 2;
      if (du * du + dv * dv > 1) return 0;
      if (Math.abs(dv) > 0.86) return P.gold[3]!;
      const rib = Math.floor(v * 6) % 2 === 0 && Math.abs(du) > 0.1;
      return tone(P.red, du < -0.3 ? 0.02 : du < 0.3 ? 0.15 + (rib ? 0.1 : 0) : 0.42, x, y, 0.3);
    });
    fill(c, -r * 0.5, cy + r * 1.05, r * 0.5, cy + r * 1.2, () => P.gold[3]!);
    fill(c, -1, cy + r * 1.2, 2, cy + r * 1.2 + 8, () => P.red[3]!);
  },
});

// --- broken pieces --------------------------------------------------------------------------

export interface ChunkP {
  /** The prop's painter and params. */
  of: string;
  op: Record<string, unknown>;
  /** Which piece, of how many, cut with which seed. */
  i: number;
  n: number;
  cut: number;
}

/** The piece (0..n-1) a level-1 point of a prop's bounds belongs to: jittered nearest site. */
export function pieceOf(lx: number, ly: number, b: [number, number, number, number], n: number, cut: number): number {
  const [x0, y0, x1, y1] = b;
  const w = x1 - x0, h = y1 - y0;
  let best = 0, bd = Infinity;
  // sites spread along the longer side (a post breaks into stacked lengths, a beam into
  // spans), scattered across the shorter one
  const tall = h >= w;
  for (let i = 0; i < n; i++) {
    const along = (i + 0.5 + 0.35 * hash(i, 1, cut)) / n, across = 0.5 + 0.4 * hash(i, 2, cut);
    const sx = x0 + w * (tall ? across : along), sy = y0 + h * (tall ? along : across);
    // a little noise in the distance makes the break lines ragged
    const d = Math.hypot(lx - sx, ly - sy) + 3 * hash(Math.floor(lx / 3), Math.floor(ly / 3), cut + i);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** One broken piece of a prop: the prop painted whole, everything but the piece cleared. */
export const chunk = definePainter<ChunkP>("chunk", {
  bounds(p) {
    return painter(p.of).bounds(p.op);
  },
  paint(c, p) {
    const pt = painter(p.of);
    pt.paint(c, p.op);
    const b = pt.bounds(p.op);
    const buf = c.buf;
    for (let y = 0; y < buf.h; y++) {
      for (let x = 0; x < buf.w; x++) {
        const k = y * buf.w + x;
        if (!buf.px[k]) continue;
        const lx = c.lx(buf.ox + x + 0.5), ly = c.ly(buf.oy + y + 0.5);
        if (pieceOf(lx, ly, b, p.n, p.cut) !== p.i) buf.px[k] = 0;
      }
    }
  },
});
