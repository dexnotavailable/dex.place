// The Hall of Works, indoors grand (GDK A.3): a huge, lively, lacquered hall. Its back wall
// of timber, paper and gold on the near-back plane; red columns near and far; a polished
// floor; the Long Gallery upstairs on a timber floor with a vermilion railing; the stair
// whose underside roofs the reading nook; and every service as a piece of furniture with
// its own silhouette (a notice wall, a desk, an offering box, a crane desk, a map pillar, a
// request board, a docs shelf, frames for the emperor's art).

import { definePainter, type PaintCtx } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4, clamp, hash, tone } from "../raster.ts";

/** Fills a level-1 local rectangle with a per-pixel colour (u, v run 0..1 across it). */
function fill(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, col: (x: number, y: number, u: number, v: number) => number): void {
  const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Math.max(Y0, c.buf.oy); y < Math.min(Y1, c.buf.y1); y++) {
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const v = col(x, y, (x - X0 + 0.5) / Math.max(1, X1 - X0), (y - Y0 + 0.5) / Math.max(1, Y1 - Y0));
      if (v) c.buf.set(x, y, v);
    }
  }
}

/** A dark outline around a filled box (selective: darker on the shadow sides). */
function box(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, ramp: readonly number[], t: (u: number, v: number) => number): void {
  fill(c, x0, y0, x1, y1, (x, y, u, v) => {
    const X0 = Math.round(c.X(x0)), X1 = Math.round(c.X(x1)) - 1, Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1)) - 1;
    if (x === X0 || x === X1 || y === Y0 || y === Y1) return P.ink[0]!;
    return tone(ramp, clamp(t(u, v), 0, 1), x, y, 0.35);
  });
}

// ---------------------------------------------------------------------------
// The back wall (near-back plane): bays of red posts and gold-framed paper lattice that
// glows warm, a dark wainscot, a frieze of brackets, beams above; long and tall.
// ---------------------------------------------------------------------------
export interface HallWallP {
  w: number;
  /** Height above the anchor line (the floor), px; the wall also runs `below` px down. */
  h: number;
  below: number;
  /** The gallery's line above the floor (a balcony band crosses the wall there), px. */
  gallery: number;
}

export const hallwall = definePainter<HallWallP>("hallwall", {
  bounds(p) {
    return [0, -p.h, p.w, p.below];
  },
  paint(c, p) {
    const bay = 210;
    fill(c, 0, -p.h, p.w, p.below, (x, y) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      const above = -ly;
      const k = ((lx % bay) + bay) % bay;
      // below the floor: the dark of the foundation
      if (ly > 0) return tone(P.lacquer, 0.85, x, y, 0.3);
      // posts
      if (k < 18) return tone(P.red, k < 5 ? 0.3 : k < 12 ? 0.5 : 0.75, x, y, 0.3);
      // wainscot along the floor and along the gallery line
      const g = p.gallery;
      if (above < 46 || (above > g - 12 && above < g + 30)) {
        if (above < 4 || Math.abs(above - (g - 12)) < 3) return P.gold[3]!;
        return tone(P.lacquer, 0.45 + 0.2 * bayer4(x, y), x, y, 0.3);
      }
      // a frieze of brackets high up, then the beams in shadow
      if (above > p.h - 120) return tone(P.lacquer, 0.8, x, y, 0.3);
      if (above > p.h - 160) {
        const kk = ((lx % 40) + 40) % 40;
        return kk < 22 ? (above > p.h - 140 ? P.gold[2]! : P.blue[3]!) : P.lacquer[3]!;
      }
      // paper lattice panels between the posts, warm with light from inside
      const band = above < g ? [46, g - 12] : [g + 30, p.h - 160];
      const v = (above - band[0]!) / Math.max(1, band[1]! - band[0]!);
      const kx = k - 18;
      if (kx < 4 || kx > bay - 22 || v < 0.03 || v > 0.97) return P.gold[3]!;
      const gx = kx % 22, gy = Math.floor((above - band[0]!) % 22);
      if (gx < 2 || gy < 2) return P.lacquer[2]!;
      return tone(P.paper, 0.5 + 0.3 * v + (hash(Math.floor(lx / 22), Math.floor(above / 22), c.seed) < 0.08 ? 0.12 : 0), x, y, 0.4);
    });
  },
});

// ---------------------------------------------------------------------------
// A vermilion column with gold bands and a stone base (any plane).
// ---------------------------------------------------------------------------
export interface ColumnP {
  h: number;
  w?: number;
}

export const column = definePainter<ColumnP>("column", {
  bounds(p) {
    const w = p.w ?? 34;
    return [-w / 2 - 8, -p.h, w / 2 + 8, 2];
  },
  paint(c, p) {
    const w = p.w ?? 34;
    fill(c, -w / 2 - 7, -26, w / 2 + 7, 0, (x, y, u, v) => tone(P.stone, v < 0.12 ? 0.1 : u < 0.3 ? 0.3 : u < 0.75 ? 0.5 : 0.8, x, y, 0.3));
    fill(c, -w / 2, -p.h, w / 2, -26, (x, y, u, v) => {
      if (u < 0.05 || u > 0.95) return P.ink[0]!;
      const band = (v * p.h) % 220;
      if (band < 9 && v < 0.98) return u < 0.3 ? P.gold[1]! : P.gold[3]!;
      return tone(P.red, u < 0.22 ? 0.15 : u < 0.55 ? 0.38 : u < 0.8 ? 0.6 : 0.82, x, y, 0.3);
    });
  },
});

// ---------------------------------------------------------------------------
// Floors: the polished ground floor and the gallery's timber floor (cross-sections).
// ---------------------------------------------------------------------------
export interface FloorP {
  w: number;
  /** Thickness, px. */
  t?: number;
  kind?: "ground" | "gallery";
}

export const hallfloor = definePainter<FloorP>("hallfloor", {
  bounds(p) {
    return [0, -2, p.w, (p.t ?? 34) + (p.kind === "gallery" ? 2 : 240)];
  },
  paint(c, p) {
    const t = p.t ?? 34;
    fill(c, 0, 0, p.w, t, (x, y, _u, v) => {
      const lx = c.lx(x + 0.5);
      if (v < 0.06) return P.timber[0]!;
      const plank = Math.floor(lx / 120);
      const seam = Math.abs(((lx % 120) + 120) % 120) < 1 / c.d;
      if (seam && v < 0.5) return P.timber[5]!;
      if (p.kind === "gallery") return tone(P.red, v < 0.35 ? 0.3 + 0.1 * hash(plank, 0, c.seed) : 0.75, x, y, 0.3);
      return tone(P.timber, v < 0.4 ? 0.3 + 0.15 * hash(plank, 0, c.seed) : 0.7, x, y, 0.3);
    });
    if (p.kind !== "gallery") fill(c, 0, t, p.w, t + 240, (x, y) => tone(P.lacquer, 0.9, x, y, 0.3));
  },
});

// ---------------------------------------------------------------------------
// The gallery's railing (front plane): a vermilion balustrade with gold caps.
// ---------------------------------------------------------------------------
export interface BalusterP {
  w: number;
  h?: number;
}

export const balustrade = definePainter<BalusterP>("balustrade", {
  bounds(p) {
    return [-4, -(p.h ?? 60) - 6, p.w + 4, 4];
  },
  paint(c, p) {
    const h = p.h ?? 60;
    fill(c, 0, -h, p.w, -h + 9, (x, y, _u, v) => (v < 0.3 ? P.gold[2]! : tone(P.red, 0.4 + 0.3 * v, x, y, 0.3)));
    fill(c, 0, -14, p.w, -6, (x, y) => tone(P.red, 0.55, x, y, 0.3));
    for (let lx = 6; lx < p.w; lx += 26) {
      fill(c, lx, -h + 9, lx + 6, -6, (x, y, u) => tone(P.red, u < 0.35 ? 0.25 : 0.7, x, y, 0.3));
    }
  },
});

// ---------------------------------------------------------------------------
// The stair to the Long Gallery: treads on a timber stringer; its underside roofs the nook.
// From (0, 0) at its top to (dx, dy) at its foot (dy positive, going down to the right).
// ---------------------------------------------------------------------------
export interface StairP {
  dx: number;
  dy: number;
}

export const hallstair = definePainter<StairP>("hallstair", {
  bounds(p) {
    return [-6, -10, p.dx + 6, p.dy + 60];
  },
  paint(c, p) {
    const n = Math.max(4, Math.round(p.dy / 22));
    const run = p.dx / n, rise = p.dy / n;
    for (let i = 0; i < n; i++) {
      const x0 = run * i, y0 = rise * (i + 1) - 6;
      box(c, x0, y0, x0 + run + 2, y0 + 12, P.timber, (_u, v) => (v < 0.3 ? 0.1 : 0.45));
    }
    // the stringer and the underside boards (the nook's ceiling)
    const steps = Math.ceil(Math.hypot(p.dx, p.dy) * c.d);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lx = p.dx * t, ly = p.dy * t + 6;
      const X = Math.round(c.X(lx));
      for (let k = 0; k < 46; k += 1 / c.d) {
        const Y = Math.round(c.Y(ly + k));
        const col = k < 14 ? tone(P.red, k < 3 ? 0.3 : 0.7, X, Y, 0.3) : k > 43 ? P.ink[0]! : tone(P.timber, 0.6 + 0.15 * (((lx / 30) | 0) % 2), X, Y, 0.3);
        c.buf.set(X, Y, col);
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Furniture: every service has its own silhouette.
// ---------------------------------------------------------------------------
export interface FurnP {
  w: number;
  h: number;
}

/** The Notice Wall: a lacquer board under a little roof, paper proclamations pinned on it. */
export const noticewall = definePainter<FurnP>("noticewall", {
  bounds(p) {
    return [-30, -p.h - 60, p.w + 30, 4];
  },
  paint(c, p) {
    // posts
    for (const sx of [6, p.w - 6]) fill(c, sx - 6, -p.h - 30, sx + 6, 0, (x, y, u) => tone(P.red, u < 0.4 ? 0.3 : 0.7, x, y, 0.3));
    box(c, 0, -p.h, p.w, -36, P.lacquer, (_u, v) => 0.5 + 0.2 * v);
    // a little tiled roof on top
    for (let ly = -p.h - 46; ly < -p.h; ly += 1 / c.d) {
      const u = (-p.h - ly) / 46;
      const half = p.w / 2 + 26 - u * 22;
      fill(c, p.w / 2 - half, ly, p.w / 2 + half, ly + 1 / c.d, (x, y) => (u > 0.85 ? P.gold[2]! : tone(P.tile, 0.3 + 0.4 * (1 - u), x, y, 0.3)));
    }
    // the proclamations: paper sheets, a few lines of script, a red seal on each
    const n = Math.max(2, Math.floor(p.w / 52));
    for (let i = 0; i < n; i++) {
      const sx = 10 + i * ((p.w - 20) / n) + 4 * hash(i, 1, c.seed);
      const sy = -p.h + 14 + 10 * hash(i, 2, c.seed);
      const sw = (p.w - 20) / n - 10, sh = (p.h - 70) * (0.7 + 0.25 * hash(i, 3, c.seed));
      box(c, sx, sy, sx + sw, sy + sh, P.paper, (_u, v) => 0.08 + 0.2 * v);
      if (c.d >= 0.5) {
        for (let ly = sy + 10; ly < sy + sh - 18; ly += 7) fill(c, sx + 6, ly, sx + 6 + (sw - 14) * (0.6 + 0.4 * hash(i, ly, c.seed)), ly + 2, () => P.ink[1]!);
        fill(c, sx + sw - 16, sy + sh - 16, sx + sw - 6, sy + sh - 6, () => P.red[3]!);
      }
      fill(c, sx + sw / 2 - 2, sy + 2, sx + sw / 2 + 2, sy + 6, () => P.gold[2]!);
    }
  },
});

/** Hanko's desk: a long counter of lacquer and gold, a ledger open on it, ink, her seal. */
export const desk = definePainter<FurnP>("desk", {
  bounds(p) {
    return [-6, -p.h - 30, p.w + 6, 4];
  },
  paint(c, p) {
    box(c, 0, -p.h, p.w, -p.h + 14, P.timber, (_u, v) => (v < 0.3 ? 0.05 : 0.35));
    box(c, 6, -p.h + 14, p.w - 6, 0, P.lacquer, (u, v) => 0.35 + 0.25 * v + (u > 0.9 ? 0.2 : 0));
    // gold panels on the front
    const n = Math.max(2, Math.round(p.w / 90));
    for (let i = 0; i < n; i++) {
      const x0 = 18 + i * ((p.w - 36) / n), x1 = x0 + (p.w - 36) / n - 12;
      fill(c, x0, -p.h + 28, x1, -14, (_x, _y, u, v) => (u < 0.04 || u > 0.96 || v < 0.05 || v > 0.95 ? P.gold[2]! : 0));
    }
    // on the desk: an open ledger, an inkstone, a brush in a pot, a stack of slips
    fill(c, 24, -p.h - 8, 84, -p.h, (x, y, u) => (Math.abs(u - 0.5) < 0.03 ? P.paper[3]! : tone(P.paper, 0.1, x, y, 0.3)));
    fill(c, 96, -p.h - 6, 112, -p.h, () => P.ink[1]!);
    fill(c, 120, -p.h - 14, 128, -p.h, () => P.lacquer[2]!);
    fill(c, 123, -p.h - 26, 125, -p.h - 14, () => P.timber[3]!);
    fill(c, p.w - 60, -p.h - 10, p.w - 30, -p.h, (x, y, _u, v) => tone(P.paper, 0.1 + 0.3 * v, x, y, 0.3));
  },
});

/** An offering box: a timber box with a slot and gold bands, a bell rope, the ticket wheel under it. */
export const offerbox = definePainter<FurnP>("offerbox", {
  bounds(p) {
    return [-8, -p.h - 70, p.w + 8, 4];
  },
  paint(c, p) {
    box(c, 0, -p.h, p.w, -p.h * 0.32, P.timber, (u, v) => (v < 0.15 ? 0.1 : u < 0.2 ? 0.25 : 0.5));
    for (const v of [0.18, 0.62]) fill(c, 0, -p.h + p.h * 0.68 * v, p.w, -p.h + p.h * 0.68 * v + 4, () => P.gold[2]!);
    fill(c, p.w * 0.2, -p.h + 3, p.w * 0.8, -p.h + 6, () => P.ink[0]!);
    // the paper drum of the ticket wheel (idle), seen from the front under the box
    box(c, p.w * 0.06, -p.h * 0.32, p.w * 0.94, 0, P.paper, (u) => (Math.floor(u * 10) % 2 ? 0.15 : 0.32));
    // the bell rope up to a small bell
    fill(c, p.w / 2 - 1, -p.h - 60, p.w / 2 + 2, -p.h, (_x, y) => (y % 4 < 2 ? P.red[2]! : P.red[4]!));
    fill(c, p.w / 2 - 7, -p.h - 70, p.w / 2 + 7, -p.h - 58, (_x, _y, u) => (u < 0.4 ? P.gold[1]! : P.gold[3]!));
  },
});

/** The Crane Desk: a small writing desk with folded paper cranes and a brush. */
export const cranedesk = definePainter<FurnP>("cranedesk", {
  bounds(p) {
    return [-6, -p.h - 30, p.w + 6, 4];
  },
  paint(c, p) {
    box(c, 0, -p.h, p.w, -p.h + 10, P.timber, (_u, v) => (v < 0.3 ? 0.05 : 0.35));
    for (const lx of [8, p.w - 16]) fill(c, lx, -p.h + 10, lx + 8, 0, (x, y, u) => tone(P.timber, u < 0.4 ? 0.4 : 0.7, x, y, 0.3));
    // three cranes
    for (let i = 0; i < 3; i++) {
      const cx = 18 + i * ((p.w - 36) / 2), cy = -p.h - 4;
      const pts = [cx - 10, cy, cx, cy - 12, cx + 2, cy - 4, cx + 12, cy - 9, cx + 5, cy];
      for (let k = 0; k < pts.length - 2; k += 2) c.buf.line(c.X(pts[k]!), c.Y(pts[k + 1]!), c.X(pts[k + 2]!), c.Y(pts[k + 3]!), P.paper[i === 1 ? 0 : 1]!);
      fill(c, cx - 6, cy - 6, cx + 6, cy, () => (i === 1 ? P.red[2]! : P.paper[1]!));
    }
  },
});

/** The central pillar, thick, with the land's map rolled tight on its cord. */
export const mappillar = definePainter<FurnP>("mappillar", {
  bounds(p) {
    return [-p.w / 2 - 30, -p.h, p.w / 2 + 30, 4];
  },
  paint(c, p) {
    fill(c, -p.w / 2 - 10, -30, p.w / 2 + 10, 0, (x, y, u, v) => tone(P.stone, v < 0.1 ? 0.1 : u < 0.3 ? 0.3 : 0.6, x, y, 0.3));
    fill(c, -p.w / 2, -p.h, p.w / 2, -30, (x, y, u, v) => {
      if (u < 0.04 || u > 0.96) return P.ink[0]!;
      if ((v * p.h) % 260 < 10) return P.gold[2]!;
      return tone(P.red, u < 0.2 ? 0.15 : u < 0.55 ? 0.38 : u < 0.8 ? 0.6 : 0.82, x, y, 0.3);
    });
    // the rolled map: a scroll hanging on a red cord at standing height, gold end-knobs
    const sy = -150;
    fill(c, -p.w / 2 - 22, sy, p.w / 2 + 22, sy + 22, (x, y, u, v) => {
      if (u < 0.06 || u > 0.94) return P.gold[v < 0.4 ? 1 : 3]!;
      return tone(P.paper, v < 0.25 ? 0.05 : v < 0.7 ? 0.2 : 0.45, x, y, 0.3);
    });
    fill(c, -2, -260, 2, sy, (_x, y) => (y % 4 < 2 ? P.red[2]! : P.red[4]!));
  },
});

/** The Request Board: a slatted board with pins and a few empty hooks. */
export const reqboard = definePainter<FurnP>("reqboard", {
  bounds(p) {
    return [-8, -p.h - 10, p.w + 8, 4];
  },
  paint(c, p) {
    for (const sx of [8, p.w - 8]) fill(c, sx - 5, -p.h, sx + 5, 0, (x, y, u) => tone(P.timber, u < 0.4 ? 0.3 : 0.65, x, y, 0.3));
    box(c, 0, -p.h, p.w, -p.h * 0.35, P.timber, (_u, v) => (Math.floor(v * 7) % 2 ? 0.45 : 0.3));
    for (let i = 0; i < 5; i++) {
      const hx = 16 + i * ((p.w - 32) / 4);
      fill(c, hx - 2, -p.h + 14, hx + 2, -p.h + 18, () => P.gold[2]!);
    }
    // one slip: "requests open later"
    box(c, p.w * 0.42, -p.h + 24, p.w * 0.58, -p.h + 60, P.paper, () => 0.1);
  },
});

/** The docs shelf: tall shelves of books, one row per product, a warm lamp. */
export const bookshelf = definePainter<FurnP>("bookshelf", {
  bounds(p) {
    return [-6, -p.h - 6, p.w + 6, 4];
  },
  paint(c, p) {
    box(c, 0, -p.h, p.w, 0, P.timber, (u) => (u < 0.06 || u > 0.94 ? 0.3 : 0.75));
    const shelves = 4;
    const sh = (p.h - 16) / shelves;
    const spines = [P.red, P.blue, P.moss, P.gold, P.paper, P.lacquer];
    for (let s = 0; s < shelves; s++) {
      const y1 = -p.h + 8 + sh * (s + 1);
      fill(c, 4, y1 - 4, p.w - 4, y1, (x, y) => tone(P.timber, 0.2, x, y, 0.3));
      let x = 8;
      let k = 0;
      while (x < p.w - 14) {
        const bw = 6 + Math.floor(hash(s, k, c.seed) * 8);
        const bh = sh * (0.62 + 0.3 * hash(k, s, c.seed));
        const ramp = spines[Math.floor(hash(s * 7, k, c.seed) * spines.length)]!;
        fill(c, x, y1 - 4 - bh, x + bw - 1, y1 - 4, (xx, yy, u, v) => (v < 0.08 || v > 0.92 ? P.gold[3]! : tone(ramp, u < 0.3 ? 0.2 : 0.55, xx, yy, 0.3)));
        x += bw;
        k++;
      }
    }
  },
});

/** A frame for one of the emperor's pieces: lacquer and gold (the picture is a sprite inside). */
export const artframe = definePainter<FurnP>("artframe", {
  bounds(p) {
    return [-14, -p.h - 14, p.w + 14, 30];
  },
  paint(c, p) {
    fill(c, -12, -p.h - 12, p.w + 12, 12, (_x, _y, u, v) => {
      const e = Math.min(u, 1 - u) * (p.w + 24), f = Math.min(v, 1 - v) * (p.h + 24);
      const d = Math.min(e, f);
      if (d < 1.5) return P.ink[0]!;
      if (d < 4) return P.gold[1]!;
      if (d < 9) return P.lacquer[2]!;
      if (d < 12) return P.gold[3]!;
      return P.ink[1]!;
    });
    // a little brass plate under it (no title: the piece is only ever itself)
    fill(c, p.w / 2 - 14, 16, p.w / 2 + 14, 24, (_x, _y, _u, v) => (v < 0.3 ? P.gold[1]! : P.gold[3]!));
  },
});

/** Interior double doors (the front doors from inside; the great doors to the court). */
export const idoor = definePainter<FurnP>("idoor", {
  bounds(p) {
    return [-24, -p.h - 30, p.w + 24, 4];
  },
  paint(c, p) {
    fill(c, -20, -p.h - 26, p.w + 20, 0, (_x, _y, u, v) => (u < 0.05 || u > 0.95 || v < 0.06 ? P.gold[2]! : 0));
    box(c, 0, -p.h, p.w, 0, P.red, (u, v) => (Math.abs(u - 0.5) < 0.02 ? 0.05 : 0.3 + 0.35 * v));
    if (c.d >= 0.5) {
      for (let ly = -p.h + 20; ly < -10; ly += 18) for (let lx = 14; lx < p.w - 8; lx += 18) {
        if (Math.abs(lx - p.w / 2) < 8) continue;
        fill(c, lx, ly, lx + 4, ly + 4, () => P.gold[1]!);
      }
    }
  },
});

/** A shuttered door (the Teahouse, upstairs): paper shutters latched shut, a sign. */
export const shutter = definePainter<FurnP>("shutter", {
  bounds(p) {
    return [-10, -p.h - 30, p.w + 10, 4];
  },
  paint(c, p) {
    box(c, 0, -p.h, p.w, 0, P.timber, (u) => (Math.floor(u * 8) % 2 ? 0.45 : 0.6));
    fill(c, 0, -p.h * 0.55, p.w, -p.h * 0.55 + 6, () => P.ink[0]!);
    box(c, p.w * 0.25, -p.h - 26, p.w * 0.75, -p.h - 4, P.paper, () => 0.1);
  },
});

/** A brush stand and a box of slips (commissions). */
export const brushstand = definePainter<FurnP>("brushstand", {
  bounds(p) {
    return [-6, -p.h - 40, p.w + 6, 4];
  },
  paint(c, p) {
    box(c, 0, -p.h * 0.5, p.w, 0, P.lacquer, (_u, v) => 0.4 + 0.3 * v);
    fill(c, 6, -p.h * 0.5 - 14, p.w * 0.5, -p.h * 0.5, (x, y) => tone(P.paper, 0.15, x, y, 0.3));
    for (let i = 0; i < 4; i++) {
      const bx = p.w * 0.62 + i * 6;
      fill(c, bx, -p.h - 30 + i * 4, bx + 2, -p.h * 0.5, (_x, y) => (y < c.Y(-p.h - 18 + i * 4) ? P.ink[0]! : P.timber[2]!));
    }
  },
});

/** A hanging paper lantern on a cord from the beams. */
export interface LanternP {
  drop: number;
  r?: number;
}

export const hanglantern = definePainter<LanternP>("hanglantern", {
  bounds(p) {
    const r = p.r ?? 18;
    return [-r - 4, 0, r + 4, p.drop + r * 2.6 + 12];
  },
  paint(c, p) {
    const r = p.r ?? 18;
    fill(c, -1, 0, 1, p.drop, () => P.ink[0]!);
    const cy = p.drop + r * 1.2;
    fill(c, -r * 0.5, p.drop, r * 0.5, p.drop + 5, () => P.gold[3]!);
    fill(c, -r, cy - r * 1.1, r, cy + r * 1.1, (x, y, u, v) => {
      const du = (u - 0.5) * 2, dv = (v - 0.5) * 2;
      if (du * du + dv * dv > 1) return 0;
      if (Math.abs(dv) > 0.86) return P.gold[3]!;
      const rib = (Math.floor(v * 7) % 2) === 0 && Math.abs(du) > 0.1;
      return tone(P.red, du < -0.3 ? 0.02 : du < 0.3 ? 0.15 + (rib ? 0.1 : 0) : 0.42, x, y, 0.3);
    });
    fill(c, -r * 0.5, cy + r * 1.05, r * 0.5, cy + r * 1.2, () => P.gold[3]!);
    fill(c, -1, cy + r * 1.2, 2, cy + r * 1.2 + 14, () => P.red[3]!);
  },
});

/** A skylight's beam of warm light: a dithered shaft drawn over the room (front plane). */
export interface ShaftP {
  w: number;
  h: number;
  /** Lean: how far the bottom is shifted right of the top, px. */
  lean?: number;
}

export const lightshaft = definePainter<ShaftP>("lightshaft", {
  bounds(p) {
    return [-4, -p.h, p.w + Math.max(0, p.lean ?? 0) + 4, 4];
  },
  paint(c, p) {
    const lean = p.lean ?? 0;
    fill(c, Math.min(0, lean), -p.h, p.w + Math.max(0, lean), 0, (x, y) => {
      const ly = c.ly(y + 0.5), lx = c.lx(x + 0.5);
      const v = 1 + ly / p.h; // 0 at the top .. 1 at the floor
      const off = lean * v;
      const u = (lx - off) / p.w;
      if (u < 0 || u > 1) return 0;
      const edge = Math.min(u, 1 - u) * 2;
      const a = (0.32 + 0.2 * (1 - v)) * Math.min(1, edge * 3);
      if (bayer4(x, y) >= a * 0.5) return 0;
      return P.paper[0]!;
    });
  },
});

/** A plain hanging scroll (the patrons' spot until the first real patron). */
export const hangscroll = definePainter<FurnP>("hangscroll", {
  bounds(p) {
    return [-8, -p.h - 14, p.w + 8, 6];
  },
  paint(c, p) {
    fill(c, -6, -p.h - 10, p.w + 6, -p.h - 4, (_x, _y, u) => (u < 0.06 || u > 0.94 ? P.gold[1]! : P.timber[3]!));
    fill(c, p.w / 2 - 1, -p.h - 14, p.w / 2 + 1, -p.h - 10, () => P.ink[0]!);
    box(c, 0, -p.h - 4, p.w, -4, P.paper, (_u, v) => 0.08 + 0.1 * v);
    fill(c, -6, -4, p.w + 6, 2, (_x, _y, u) => (u < 0.06 || u > 0.94 ? P.gold[1]! : P.timber[3]!));
  },
});
