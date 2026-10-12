// The Hall of Works' back wall (near-back plane, P3): the far side of the great room, a
// two-storey colonnade of vermilion columns on carved stone bases, its bays alternating
// glowing lattice screens, moon gates into the deeper hall (P2 shows through them), archive
// shelves of scrolls and long brush banners; the back balcony along its middle (where the
// hall's crowd leans on the rail), lattice windows above it, the painted lintel and its gold
// bracket sets, and the dark roof structure going up out of the frame. Below the floor line:
// the polished timber floor receding toward us, the lit bays and columns doubled in it.
//
// Everything is lit by the hall's light (lights.ts): lantern pools warm the wall, the doors'
// daylight and the skylight shaft reach in from the play plane's side.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, SCREEN, LitField, clamp, colBase, colLight, cyl, fbm, grain, hash, keep, lathe, lum, mt, rect, tn, vnoise, type At } from "./kit.ts";

/** A bay of the back wall between two columns, in local plane px. */
export interface Bay {
  x0: number;
  x1: number;
  /** Lower storey: lattice screens, a moon gate, archive shelves or a banner. */
  low: "lattice" | "moon" | "archive" | "banner";
  /** Upper storey: lattice windows, an opening into the roof space, or a hanging scroll. */
  high: "window" | "open" | "scroll";
  seed: number;
}

export interface BackWallP {
  /** Width in plane px (the anchor is the west end, on the floor line). */
  w: number;
  /** Plane px per H (96 x the plane's rate). */
  u: number;
  /** Height above the floor line and depth below it, plane px. */
  top: number;
  below: number;
  bays: Bay[];
  /** Column centres (local plane px). */
  cols: number[];
  at?: At;
}

// heights in H above the floor (multiplied by p.u). The back balcony sits well clear of the
// Long Gallery's line in every framing (at the entrance shot's eye level the two would
// otherwise coincide on screen).
const PLINTH = 0.42;
const DOOR_TOP = 4.9;
const FRIEZE_TOP = 5.45;
const LOW_TOP = 8.1;
const BAL_FLOOR = 8.6;
const BAL_RAIL = 9.3;
const HIGH_TOP = 13.2;
const LINTEL = 14.2;
const BRACKETS = 15.6;

export const backwall = definePainter<BackWallP>("hall.backwall", {
  bounds(p) {
    return [0, -p.top, p.w, p.below];
  },
  paint(c, p) {
    const U = p.u;
    const lf = new LitField(HALL_LIGHT, p.at, 14, 0.78);
    const seed = c.seed;

    // 1. the wall itself: dark lacquer boarding, warm where a lantern reaches it
    rect(c, 0, -p.top, p.w, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const board = Math.abs(((lx % 26) + 26) % 26 - 13) > 12.2 ? 0.12 : 0;
      const g = grain(lx, ly, seed) * 0.12;
      return mt(M.lacq, lum(l) * 0.85 - board + g, X, Y, 0.15, 1);
    });

    // 2. the lower storey's bays
    for (const b of p.bays) lowBay(c, p, b, lf);
    // 3. the plinth: a stone skirting with a lit top edge, worn and dusty
    rect(c, 0, -PLINTH * U, p.w, 0, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const top = ly < -PLINTH * U + 2 / c.d;
      const joint = ((lx % 64) + 64) % 64 < 1.2 / c.d;
      const w = fbm(lx * 0.08, ly * 0.2, seed + 3, 3);
      if (joint) return mt(M.stone, lum(l) * 0.4, X, Y, 0.45, 1);
      return mt(M.stone, lum(l, 0, top ? -0.8 : 0) * (top ? 1.25 : 0.8) + (w - 0.5) * 0.25, X, Y, 0.25, 1);
    });

    // 4. the back balcony: its fascia, floor edge and rail
    balcony(c, p, lf);
    // 5. the upper storey
    for (const b of p.bays) highBay(c, p, b, lf);
    // 6. the lintel, painted teal and gold, and the gold bracket sets on it
    lintel(c, p, lf);
    // 7. the roof structure, going up into the dark
    roof(c, p, lf);
    // 8. columns over everything
    for (const cx of p.cols) column(c, p, cx, lf);
    // 9. the polished floor receding toward us, the wall doubled in it
    floor(c, p, lf);
  },
});

// ---------------------------------------------------------------------------
// The lower storey
// ---------------------------------------------------------------------------
function lowBay(c: PaintCtx, p: BackWallP, b: Bay, lf: LitField): void {
  const U = p.u;
  const x0 = b.x0 + 0.42 * U, x1 = b.x1 - 0.42 * U;
  const y0 = -DOOR_TOP * U, y1 = -PLINTH * U;
  clerestory(c, p, b, lf);
  carvedBand(c, b.x0 + 0.3 * U, -FRIEZE_TOP * U, b.x1 - 0.3 * U, -DOOR_TOP * U, lf, b.seed + 11);
  if (b.low === "lattice") {
    // four tall screen doors, paper glowing with the corridor's light behind them
    const n = 4;
    const dw = (x1 - x0) / n;
    const pat = Math.floor(hash(b.seed, 1) * 3);
    for (let i = 0; i < n; i++) {
      const a = x0 + i * dw, z = a + dw;
      screenDoor(c, p, a, y0 + 0.25 * U, z, y1, pat, b.seed + i * 13, lf, 0.42 + 0.18 * Math.sin(i * 1.7 + b.seed));
    }
    // a transom over the doors: a carved band
    carvedBand(c, x0, y0, x1, y0 + 0.25 * U, lf, b.seed);
  } else if (b.low === "moon") {
    // a round moon gate cut through a panelled wall; the deeper hall shows through it
    const cx = (b.x0 + b.x1) / 2, r = Math.min((x1 - x0) * 0.46, 2.0 * U);
    const cy = y1 - r - 0.05 * U;
    // the panelled wall around the gate
    rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const d = Math.hypot(lx - cx, ly - cy);
      if (d < r + 0.32 * U) return 0;
      const pu = ((lx - x0) % (0.9 * U) + 0.9 * U) % (0.9 * U), pv = ((ly - y0) % (1.1 * U) + 1.1 * U) % (1.1 * U);
      const frame = pu < 0.08 * U || pv < 0.08 * U;
      return mt(M.lacq, lum(l) * (frame ? 0.65 : 0.9) + grain(lx, ly, b.seed) * 0.1, X, Y, 0.1, 1);
    });
    // the carved surround: a gold ring of cloud scrolls, lit on the side toward the light
    rect(c, cx - r - 0.35 * U, cy - r - 0.35 * U, cx + r + 0.35 * U, Math.min(y1, cy + r + 0.35 * U), (X, Y, lx, ly) => {
      const dx = lx - cx, dy = ly - cy;
      const d = Math.hypot(dx, dy);
      if (d < r || d > r + 0.32 * U) return 0;
      const l = lf.get(lx, ly);
      const k = (d - r) / (0.32 * U);
      const ang = Math.atan2(dy, dx);
      const scroll = Math.sin(ang * 22 + k * 5.5) > 0.35 ? 0.25 : 0;
      const nx = (dx / d) * (k < 0.5 ? -1 : 1) * 0.7, ny = (dy / d) * (k < 0.5 ? -1 : 1) * 0.7;
      if (k < 0.12 || k > 0.88) return mt(M.lacq, lum(l) * 0.5, X, Y, 0.3, 1);
      return mt(M.gold, lum(l, nx, ny) * 0.95 - scroll, X, Y, 0.15, 1);
    });
    // the threshold step inside the gate
    rect(c, cx - r * 0.75, y1 - 0.14 * U, cx + r * 0.75, y1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      return mt(M.stone, lum(l) * (ly < y1 - 0.12 * U ? 1.2 : 0.75), X, Y, 0.2, 1);
    });
    // the opening itself is left empty: the deeper hall (P2) shows through
    rect(c, cx - r, cy - r, cx + r, y1 - 0.14 * U, (X, _Y, lx, ly) => {
      if (Math.hypot(lx - cx, ly - cy) < r - 0.5 / c.d) c.buf.clear(X, _Y);
      return 0;
    });
  } else if (b.low === "archive") {
    // the Hall of Works' archive: pigeonholes of rolled scrolls and lacquer boxes, floor to lintel
    rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const cw = 0.62 * U, ch = 0.62 * U;
      const ci = Math.floor((lx - x0) / cw), cj = Math.floor((ly - y0) / ch);
      const u = (lx - x0) - ci * cw, v = (ly - y0) - cj * ch;
      const shelf = v > ch - 0.1 * U, side = u < 0.07 * U;
      if (shelf) return mt(M.wood, lum(l, 0, v > ch - 0.07 * U ? 0 : -0.6) * 0.9, X, Y, 0.2, 1);
      if (side) return mt(M.wood, lum(l, 0.6, 0) * 0.55, X, Y, 0.3, 1);
      // what the hole holds: scroll ends (rings), boxes, or nothing (dark)
      const what = hash(ci, cj, 77 + Math.floor(b.seed));
      const inner = clamp(1 - Math.abs(v / (ch - 0.1 * U) - 0.55) * 1.2, 0, 1);
      if (what < 0.5) {
        // a stack of scroll ends: discs in rows
        const sr = 0.085 * U;
        const gx = ((u - 0.1 * U) % (sr * 2.1) + sr * 2.1) % (sr * 2.1) - sr * 1.05;
        const gy = ((ch - 0.1 * U - v) % (sr * 2.0) + sr * 2.0) % (sr * 2.0) - sr;
        const d = Math.hypot(gx, gy) / sr;
        if (v < 0.22 * U) return mt(M.lacq, lum(l) * 0.2, X, Y, 0.4, 1);
        if (d < 0.45) return mt(M.lacq, lum(l) * 0.3, X, Y, 0.3, 1);
        if (d < 1) {
          const tint = hash(Math.floor((u - 0.1 * U) / (sr * 2.1)), Math.floor(v / (sr * 2)), ci * 31 + cj);
          return mt(tint < 0.3 ? M.verm : M.paper, lum(l, gx / sr * 0.5, gy / sr * 0.5) * 0.35 * inner, X, Y, 0.5, 1);
        }
        return mt(M.lacq, lum(l) * 0.25, X, Y, 0.3, 1);
      }
      if (what < 0.8) {
        // lacquer boxes, a gold clasp each
        const bh = 0.24 * U;
        const row = Math.floor((ch - 0.1 * U - v) / bh);
        if (row > 1) return mt(M.lacq, lum(l) * 0.2, X, Y, 0.4, 1);
        const vb = (ch - 0.1 * U - v) - row * bh;
        if (vb < 1 / c.d) return mt(M.lacq, 0, X, Y, 0.8, 1);
        if (Math.abs(u - cw / 2) < 0.04 * U && Math.abs(vb - bh / 2) < 0.04 * U) return mt(M.gold, lum(l) * 1.1, X, Y, 0.1, 1);
        return mt(row ? M.verm : M.lacq, lum(l, 0, vb > bh - 2 ? -0.6 : 0) * 0.9 * inner + 0.05, X, Y, 0.35, 1);
      }
      return mt(M.lacq, lum(l) * 0.12, X, Y, 0.5, 1);
    });
    // a rolling ladder leaning on the shelves
    const lx0 = x0 + (x1 - x0) * (0.25 + 0.5 * hash(b.seed, 4));
    for (const s of [0, 0.42 * U]) {
      rect(c, lx0 + s, y0 + 0.3 * U, lx0 + s + 0.07 * U, y1, (X, Y, lx, ly) => mt(M.wood, lum(lf.get(lx, ly), -0.6, 0) * 0.9, X, Y, 0.1, 1));
    }
    for (let ly = y0 + 0.6 * U; ly < y1 - 0.2 * U; ly += 0.45 * U) {
      rect(c, lx0, ly, lx0 + 0.49 * U, ly + 0.05 * U, (X, Y, lx, ly2) => mt(M.wood, lum(lf.get(lx, ly2), 0, -0.7) * 0.9, X, Y, 0.1, 1));
    }
  } else {
    // a long brush banner on dark panelling
    const cx = (b.x0 + b.x1) / 2, bw = 0.95 * U;
    const by0 = y0 + 0.35 * U, by1 = y1 - 0.55 * U;
    banner(c, cx - bw / 2, by0, cx + bw / 2, by1, lf, b.seed);
    // two small shelves with a censer and a vase either side
    for (const s of [-1, 1]) {
      const sx = cx + s * (bw / 2 + 0.75 * U);
      rect(c, sx - 0.4 * U, y1 - 1.3 * U, sx + 0.4 * U, y1 - 1.22 * U, (X, Y, lx, ly) => mt(M.wood, lum(lf.get(lx, ly), 0, -0.8), X, Y, 0.1, 1));
      lathe(c, sx, y1 - 1.75 * U, y1 - 1.3 * U, (ly) => {
        const t = (ly - (y1 - 1.75 * U)) / (0.45 * U);
        return (s < 0 ? 0.12 + 0.12 * Math.sin(t * Math.PI) : 0.07 + 0.11 * Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.9)) * U;
      }, (X, Y, uu, lx, ly) => mt(s < 0 ? M.bronze : M.paper, lum(lf.get(lx, ly), uu * 0.8, 0), X, Y, 0.15, 1));
    }
  }
}

/** One screen door: a frame, a lattice over glowing paper, a kick panel below. */
function screenDoor(c: PaintCtx, p: BackWallP, x0: number, y0: number, x1: number, y1: number, pat: number, seed: number, lf: LitField, glowK: number): void {
  const U = p.u;
  const fr = 0.07 * U;
  const kick = y1 - 0.85 * U;
  rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const edge = lx < x0 + fr || lx > x1 - fr || ly < y0 + fr || Math.abs(ly - kick) < fr * 0.6;
    if (edge) return mt(M.wood, lum(l, lx < x0 + fr ? -0.5 : lx > x1 - fr ? 0.5 : 0, ly < y0 + fr ? -0.6 : 0) * 0.85, X, Y, 0.25, 1);
    if (ly > kick) {
      // the kick panel: lacquer with a gold-line inset
      const inset = Math.min(lx - x0 - fr, x1 - fr - lx, ly - kick - fr, y1 - ly) ;
      if (inset > 0.1 * U && inset < 0.13 * U) return mt(M.gold, lum(l) * 0.8, X, Y, 0.3, 1);
      return mt(M.lacq, lum(l) * 0.75, X, Y, 0.1, 1);
    }
    const u = (lx - x0 - fr) / (x1 - x0 - 2 * fr), v = (ly - y0 - fr) / (kick - y0 - fr);
    const pu = (lx - x0 - fr), pv = (ly - y0 - fr);
    if (lattice(pat, pu, pv, U, seed)) {
      // the lattice bars: dark timber against the glow
      return mt(M.wood, lum(l) * 0.4, X, Y, 0.55, 1);
    }
    // paper lit from behind by a lamp low in the corridor: a soft warm bloom, darker edges
    const bloom = Math.exp(-(((u - 0.5) / 0.55) ** 2 + ((v - 0.62) / 0.6) ** 2));
    const g = glowK * (0.35 + 0.65 * bloom) - (vnoise(lx * 0.05, ly * 0.05, seed) > 0.8 ? 0.1 : 0);
    return tn(SCREEN, clamp(1.05 - g * 1.25, 0, 1), X, Y, 0.55);
  });
}

/** Lattice patterns: 0 a stepped fret, 1 ice-crack, 2 a diamond grid. True on a bar. */
function lattice(pat: number, x: number, y: number, U: number, seed: number): boolean {
  const bw = 0.03 * U;
  if (pat === 0) {
    const s = 0.26 * U;
    const gx = ((x % s) + s) % s, gy = ((y % s) + s) % s;
    const cx = Math.floor(x / s), cy = Math.floor(y / s);
    if (gx < bw || gy < bw) return true;
    // a little stepped inner square in alternate cells
    if ((cx + cy) % 2 === 0) {
      const ix = Math.abs(gx - s / 2), iy = Math.abs(gy - s / 2);
      return Math.abs(Math.max(ix, iy) - s * 0.24) < bw * 0.5;
    }
    return false;
  }
  if (pat === 1) {
    // ice-crack: the edges of jittered cells
    const s = 0.42 * U;
    const fx = x / s, fy = y / s;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    let d1 = 9, d2 = 9;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const px = ix + i + 0.15 + 0.7 * hash(ix + i, iy + j, seed), py = iy + j + 0.15 + 0.7 * hash(ix + i, iy + j, seed + 1);
      const d = Math.hypot(fx - px, fy - py);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return (d2 - d1) * s < bw * 1.1 || x < bw || y < bw;
  }
  const s = 0.3 * U;
  const a = ((x + y) % s + s) % s, b2 = ((x - y) % s + s) % s;
  return a < bw * 0.9 || b2 < bw * 0.9;
}

/** A carved band (transoms, friezes): gold scrolls on lacquer. */
function carvedBand(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, lf: LitField, seed: number): void {
  rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const v = (ly - y0) / Math.max(1, y1 - y0);
    if (v < 0.12 || v > 0.88) return mt(M.wood, lum(l, 0, v < 0.12 ? -0.7 : 0.7) * 0.8, X, Y, 0.2, 1);
    const s = Math.sin(lx * 0.21 + Math.sin(lx * 0.05 + seed) * 2) * Math.cos((v - 0.5) * 5);
    return s > 0.35 ? mt(M.gold, lum(l, 0, (0.5 - v) * 0.8) * 0.9, X, Y, 0.15, 1) : mt(M.lacq, lum(l) * 0.5, X, Y, 0.2, 1);
  });
}

/** A long hanging brush banner: a rod, the paper with big abstract strokes, a seal, tassels. */
function banner(c: PaintCtx, x0: number, y0: number, x1: number, y1: number, lf: LitField, seed: number): void {
  const w = x1 - x0;
  // the rod and its knobs
  rect(c, x0 - w * 0.12, y0 - w * 0.08, x1 + w * 0.12, y0, (X, Y, lx, ly) => mt(M.wood, lum(lf.get(lx, ly), 0, -0.6), X, Y, 0.15, 1));
  // the mount (silk border) and the paper
  rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const u = (lx - x0) / w, v = (ly - y0) / (y1 - y0);
    if (u < 0.1 || u > 0.9 || v < 0.06 || v > 0.94) return mt(M.verm, lum(l) * 0.7, X, Y, 0.35, 1);
    // brush strokes: a few big characters stacked, made of fat noisy strokes (no real text)
    const ch = Math.floor((v - 0.08) / 0.2);
    const cv = ((v - 0.08) / 0.2) - ch;
    const sx = (u - 0.5) * 3.2, sy = (cv - 0.5) * 2.2;
    const h1 = hash(ch, 3, seed), h2 = hash(ch, 5, seed);
    const stroke =
      (Math.abs(sy - (h1 - 0.5) * 0.8) < 0.13 && Math.abs(sx) < 0.85) ||
      (Math.abs(sx - (h2 - 0.5) * 0.9 - sy * 0.3) < 0.12 && Math.abs(sy) < 0.8) ||
      (h1 > 0.5 && Math.abs(sx + sy * 0.7 - 0.2) < 0.1 && sy > -0.2);
    const wob = vnoise(lx * 0.4, ly * 0.4, seed) > 0.75;
    if (ch >= 0 && ch < 4 && stroke && !wob) return tn(M.ink, 0.2, X, Y, 0);
    if (ch === 3 && Math.abs(sx - 0.55) < 0.25 && Math.abs(sy - 0.55) < 0.25) return mt(M.verm, lum(l) * 0.9, X, Y, 0.3, 1);
    return mt(M.paper, lum(l) * 0.95 - v * 0.08, X, Y, 0.15, 1);
  });
  // tassels from the bottom corners
  for (const tx of [x0 + w * 0.1, x1 - w * 0.1]) {
    rect(c, tx - 1, y1, tx + 1, y1 + w * 0.5, (X, Y, lx, ly) => mt(M.verm, lum(lf.get(lx, ly)) * 0.8, X, Y, 0.3, 1));
  }
}

/** The clerestory over the lower storey: glowing windows, dark carved panels or an opening. */
function clerestory(c: PaintCtx, p: BackWallP, b: Bay, lf: LitField): void {
  const U = p.u;
  const x0 = b.x0 + 0.45 * U, x1 = b.x1 - 0.45 * U;
  const y0 = -LOW_TOP * U + 0.25 * U, y1 = -FRIEZE_TOP * U - 0.2 * U;
  const kind = Math.floor(hash(b.seed, 21) * 3);
  if (kind === 0) {
    const n = 5;
    const dw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) screenDoor(c, p, x0 + i * dw, y0, x0 + (i + 1) * dw, y1 + 0.85 * U, 2, b.seed + 70 + i, lf, 0.3);
  } else if (kind === 1) {
    // dark lacquer panels carved with a gold cloud-and-crane relief
    rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - x0) / (x1 - x0), v = (ly - y0) / (y1 - y0);
      const pn = Math.floor(u * 3), pu = u * 3 - pn;
      if (pu < 0.04 || pu > 0.96 || v < 0.05 || v > 0.95) return mt(M.wood, lum(l) * 0.6, X, Y, 0.3, 1);
      // carved cloud scrolls: thin interlocking curls, gold leaf in the grooves
      const gx = lx * 0.32, gy = ly * 0.32;
      const f = Math.sin(gx + Math.sin(gy * 0.8 + pn) * 2.2) * Math.sin(gy + Math.sin(gx * 0.7) * 1.8);
      if (Math.abs(f) < 0.08) return mt(M.gold, lum(l, 0, -0.3) * 0.5, X, Y, 0.4, 1);
      return mt(M.lacq, lum(l) * 0.55 + (f > 0 ? 0.05 : -0.03), X, Y, 0.2, 1);
    });
  } else {
    // a pierced opening (the deeper hall's upper air shows through), a carved frame round it
    rect(c, x0, y0, x1, y1, (X, Y, lx, ly) => {
      const u = (lx - x0) / (x1 - x0), v = (ly - y0) / (y1 - y0);
      const l = lf.get(lx, ly);
      if (u < 0.05 || u > 0.95 || v < 0.08 || v > 0.92) return mt(M.gold, lum(l, u < 0.5 ? -0.5 : 0.5, v < 0.5 ? -0.5 : 0.5) * 0.7, X, Y, 0.25, 1);
      const s2 = 0.55 * U;
      const a = (((lx - x0) % s2) + s2) % s2;
      if (a < 0.05 * U) return mt(M.wood, lum(l) * 0.5, X, Y, 0.3, 1);
      c.buf.clear(X, Y);
      return 0;
    });
  }
}

// ---------------------------------------------------------------------------
// The back balcony and the upper storey
// ---------------------------------------------------------------------------
function balcony(c: PaintCtx, p: BackWallP, lf: LitField): void {
  const U = p.u;
  const fy0 = -BAL_FLOOR * U, fy1 = -LOW_TOP * U - 0.12 * U;
  // the fascia beam: lacquer, gold medallions at intervals, a lit lip
  rect(c, 0, fy0, p.w, fy1 + 0.12 * U, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const v = (ly - fy0) / (fy1 + 0.12 * U - fy0);
    if (v < 0.14) return mt(M.wood, lum(l, 0, -0.9) * 1.05, X, Y, 0.1, 1);
    const m = ((lx % (1.4 * U)) + 1.4 * U) % (1.4 * U) - 0.7 * U;
    const d = Math.hypot(m * 0.8, (v - 0.55) * (fy1 - fy0));
    if (d < 0.17 * U) return mt(M.gold, lum(l, m / (0.2 * U), 0) * 0.95 - (d > 0.12 * U ? 0.2 : 0), X, Y, 0.1, 1);
    return mt(M.lacq, lum(l) * 0.7 - (v > 0.85 ? 0.2 : 0), X, Y, 0.1, 1);
  });
  // the rail: vermilion posts, a top rail and a lattice band
  const ry0 = -BAL_RAIL * U;
  const post = 1.05 * U;
  rect(c, 0, ry0, p.w, fy0, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const v = (ly - ry0) / (fy0 - ry0);
    const k = ((lx % post) + post) % post;
    if (k < 0.1 * U) return mt(M.verm, lum(l, k < 0.05 * U ? -0.5 : 0.5, 0) * 0.85, X, Y, 0.2, 1);
    if (v < 0.13) return mt(M.verm, lum(l, 0, -0.7) * 0.9, X, Y, 0.2, 1);
    if (v > 0.32 && v < 0.42) return mt(M.verm, lum(l) * 0.75, X, Y, 0.3, 1);
    if (v > 0.86) return mt(M.verm, lum(l) * 0.65, X, Y, 0.35, 1);
    if (v > 0.42 && v < 0.86) {
      const s = 0.18 * U;
      const a = (((lx + ly) % s) + s) % s, b = (((lx - ly) % s) + s) % s;
      if (a < 0.03 * U || b < 0.03 * U) return mt(M.verm, lum(l) * 0.6, X, Y, 0.4, 1);
    }
    return 0;
  });
}

function highBay(c: PaintCtx, p: BackWallP, b: Bay, lf: LitField): void {
  const U = p.u;
  const x0 = b.x0 + 0.5 * U, x1 = b.x1 - 0.5 * U;
  const y0 = -HIGH_TOP * U, y1 = -BAL_RAIL * U - 0.2 * U;
  if (b.high === "window") {
    const n = 3;
    const dw = (x1 - x0) / n;
    const pat = (Math.floor(hash(b.seed, 9) * 3) + 1) % 3;
    for (let i = 0; i < n; i++) screenDoor(c, p, x0 + i * dw, y0 + 0.8 * U, x0 + (i + 1) * dw, y1 + 0.4 * U, pat, b.seed + 50 + i, lf, 0.4);
    carvedBand(c, x0, y0 + 0.4 * U, x1, y0 + 0.8 * U, lf, b.seed + 2);
  } else if (b.high === "open") {
    // an opening into the roof space over the deeper hall (P2 shows through), a carved arch head
    const ax0 = x0 + 0.2 * U, ax1 = x1 - 0.2 * U;
    const top = y0 + 0.9 * U;
    rect(c, ax0, top - 0.5 * U, ax1, y1 + 0.3 * U, (X, Y, lx, ly) => {
      const u = (lx - ax0) / (ax1 - ax0);
      const arch = top - 0.5 * U * Math.sin(u * Math.PI);
      if (ly < arch) return 0;
      const l = lf.get(lx, ly);
      if (ly < arch + 0.16 * U || u < 0.03 || u > 0.97) return mt(M.gold, lum(l, (u - 0.5) * 1.2, -0.5) * 0.8, X, Y, 0.2, 1);
      c.buf.clear(X, Y);
      return 0;
    });
  } else {
    // a big hanging painting-scroll (mountains in ink), the hall's own collection
    const cx = (x0 + x1) / 2, sw = 1.45 * U;
    const sy0 = y0 + 0.5 * U, sy1 = y1 + 0.2 * U;
    rect(c, cx - sw / 2 - 0.12 * U, sy0 - 0.1 * U, cx + sw / 2 + 0.12 * U, sy0, (X, Y, lx, ly) => mt(M.wood, lum(lf.get(lx, ly), 0, -0.6), X, Y, 0.15, 1));
    rect(c, cx - sw / 2, sy0, cx + sw / 2, sy1, (X, Y, lx, ly) => {
      const l = lf.get(lx, ly);
      const u = (lx - cx + sw / 2) / sw, v = (ly - sy0) / (sy1 - sy0);
      if (u < 0.08 || u > 0.92 || v < 0.1 || v > 0.92) return mt(M.lacq, lum(l) * 0.9 + 0.1, X, Y, 0.0, 0.7);
      // ink mountains: ridges from noise, mist bands between, lighter far up
      const ridge = 0.75 - 0.35 * fbm((u - 0.08) * 3.2, 0.5, b.seed, 3) - 0.18 * Math.max(0, Math.sin(u * 7 + b.seed));
      const far = 0.42 - 0.2 * fbm((u - 0.08) * 5, 1.5, b.seed + 5, 3);
      if (v > ridge) return mt(M.paper, lum(l) * 0.4 - (v - ridge) * 0.6, X, Y, 0.3, 1);
      if (v > far && v < far + 0.2 && keep(X, Y, 0.55)) return mt(M.paper, lum(l) * 0.6, X, Y, 0.2, 1);
      return mt(M.paper, lum(l) * 0.95, X, Y, 0.1, 1);
    });
  }
}

// ---------------------------------------------------------------------------
// The lintel, its bracket sets, the roof
// ---------------------------------------------------------------------------
function lintel(c: PaintCtx, p: BackWallP, lf: LitField): void {
  const U = p.u;
  const y0 = -LINTEL * U, y1 = -HIGH_TOP * U;
  rect(c, 0, y0, p.w, y1, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const v = (ly - y0) / (y1 - y0);
    if (v < 0.1 || v > 0.9) return mt(M.gold, lum(l, 0, v < 0.1 ? -0.8 : 0.8) * 0.7, X, Y, 0.2, 1);
    // caihua: teal panels with gold cartouches, red ends near the columns
    const k = ((lx % (4.25 * U)) + 4.25 * U) % (4.25 * U) / (4.25 * U);
    if (k < 0.16 || k > 0.84) {
      // xuanzi whorls at the beam's ends: rings of teal and gold round a red eye
      const ek = k < 0.5 ? k : 1 - k;
      const cxw = 0.08, d = Math.hypot((ek - cxw) * 4.25 * U, (v - 0.5) * (y1 - y0));
      const ring = Math.floor(d / (0.11 * U));
      if (d < 0.07 * U) return mt(M.verm, lum(l) * 0.5, X, Y, 0.35, 1);
      if (ring % 2 === 0 && d < 0.5 * U) return mt(M.gold, lum(l) * 0.45, X, Y, 0.4, 1);
      return tn(P.jade, clamp(0.8 + (1 - lum(l)) * 0.2, 0, 1), X, Y, 0.45);
    }
    const cart = Math.abs(k - 0.5) < 0.17 && Math.abs(v - 0.5) < 0.32;
    if (cart) {
      const e = Math.min(0.17 - Math.abs(k - 0.5), (0.32 - Math.abs(v - 0.5)) * 0.4);
      return e < 0.02 ? mt(M.gold, lum(l) * 0.85, X, Y, 0.15, 1) : mt(M.lacq, lum(l) * 0.5, X, Y, 0.2, 1);
    }
    return tn(P.jade, clamp(0.86 + (1 - lum(l)) * 0.14 + (Math.sin(lx * 0.18) > 0.6 ? -0.06 : 0), 0, 1), X, Y, 0.45);
  });
}

function roof(c: PaintCtx, p: BackWallP, lf: LitField): void {
  const U = p.u;
  const yL = -LINTEL * U, yB = -BRACKETS * U;
  // bracket sets on every column and between them: stacked blocks and arms in gold and teal
  const step = 4.25 * U / 2;
  for (let bx = (p.cols[0] ?? 0) - step * 8; bx < p.w + step; bx += step) {
    for (let tier = 0; tier < 3; tier++) {
      const ty1 = yL - tier * 0.45 * U, ty0 = ty1 - 0.45 * U;
      const arm = (0.35 + tier * 0.28) * U;
      // the arm (a long block) and the bearing block on top
      rect(c, bx - arm, ty0 + 0.18 * U, bx + arm, ty0 + 0.36 * U, (X, Y, lx, ly) => {
        const l = lf.get(lx, ly);
        const end = Math.abs(lx - bx) > arm - 0.12 * U;
        return end ? mt(M.gold, lum(l, Math.sign(lx - bx) * 0.6, 0) * 0.55, X, Y, 0.35, 1) : tn(P.jade, clamp(0.82 + (1 - lum(l)) * 0.18, 0, 1), X, Y, 0.4);
      });
      rect(c, bx - 0.16 * U, ty0, bx + 0.16 * U, ty0 + 0.2 * U, (X, Y, lx, ly) => mt(M.gold, lum(lf.get(lx, ly), (lx - bx) / (0.2 * U), -0.4) * 0.75, X, Y, 0.2, 1));
    }
  }
  // above the brackets: purlins and rafters fading into the dark
  rect(c, 0, -p.top, p.w, yB, (X, Y, lx, ly) => {
    const l = lf.get(lx, ly);
    const up = clamp((yB - ly) / (p.top + yB), 0, 1);
    const fade = 0.55 + up * 0.45;
    const purlin = ((((-ly) % (0.9 * U)) + 0.9 * U) % (0.9 * U)) < 0.28 * U;
    const rafter = (((lx % (0.36 * U)) + 0.36 * U) % (0.36 * U)) < 0.14 * U;
    if (purlin) return mt(M.lacq, lum(l, 0, -0.5) * (1 - fade) * 1.3, X, Y, 0.2, 1);
    if (rafter) return mt(M.lacq, lum(l) * (1 - fade) * 0.9, X, Y, 0.3, 1);
    return tn(M.dark, 0.85 + up * 0.15, X, Y, 0.4);
  });
}

function column(c: PaintCtx, p: BackWallP, cx: number, lf: LitField): void {
  const U = p.u;
  const r = 0.36 * U;
  const baseTop = -0.95 * U;
  // one light for the whole column (its mean over the height), so its bands run straight
  const { k: ck, side } = colLight(lf, cx, -LINTEL * U, 0);
  colBase(c, cx, r, -baseTop, ck, side, 41);
  // the shaft: vermilion lacquer, gold bands at each storey line, worn at the foot
  lathe(c, cx, -LINTEL * U, baseTop, () => r, (X, Y, u, lx, ly) => {
    const hgt = -ly / U;
    const band = (hgt > 13.6 && hgt < 14.2) || (hgt > 1.0 && hgt < 1.22) || (hgt > 8.72 && hgt < 8.9) || (hgt > 4.94 && hgt < 5.06);
    const n = cyl(ck, u, side, 0.12) - (hgt / 14) * 0.08;
    if (band) return mt(M.gold, n * 0.9, X, Y, 0.2, 1);
    const worn = hgt < 1.6 ? vnoise(lx * 0.4, ly * 0.15, 23) * 0.1 : 0;
    return mt(M.verm, n * 0.78 - worn, X, Y, 0.25, 1);
  });
}

// ---------------------------------------------------------------------------
// The floor below the line: polished timber receding toward us, the wall reflected in it
// ---------------------------------------------------------------------------
function floor(c: PaintCtx, p: BackWallP, lf: LitField): void {
  const U = p.u;
  rect(c, 0, 0, p.w, p.below, (X, Y, lx, ly) => {
    const l = lf.get(lx, Math.min(ly, 1.5 * U) * 0.3);
    // seams: planks run along the wall, so their seams are rows that open out as they near us
    const depth = ly / U;
    const row = Math.floor(Math.sqrt(Math.max(0, depth) * 6));
    const rowTop = (row * row) / 6;
    const seam = depth - rowTop < 0.04 + 0.02 * row && row > 0;
    // reflections: the columns and the glowing bays, smeared down and fading
    let refl = 0;
    for (const cx of p.cols) {
      const d = Math.abs(lx - cx);
      if (d < 0.36 * U) refl = Math.max(refl, 0.25 * (1 - depth / 3));
    }
    const streak = vnoise(lx * 0.2, ly * 0.02, 7) * 0.12;
    const lit = lum(l) * 0.55 + refl + streak - (seam ? 0.18 : 0) - depth * 0.04;
    return mt(M.wood, lit, X, Y, 0.35, 1);
  });
}
