// The Ink Palace 墨宮 from the road (A.3, "Frame, front"; reference 6 turned side-on): the Hall of
// Works' long face in black lacquer and gold, one red of the seal. Three storeys, each set back
// on the roof below; deep eaves on rows of gold brackets; black-tiled roofs with gold ridges and
// up-turned corners; black lacquer columns on stone drums; lattice screens between them, warm
// paper glowing behind; a recessed portal at the west end with red lacquer doors studded in
// gold, ajar, warm light at the seam, the plaque above; the stone platform grown into the rock
// under it (moss and stains at its foot, so the hall stands in the land).
//
// Also the twin gate towers that flank the way in, their cable stays slanting to the road, and
// the festival banners strung between them. Anchors: the hall's floor line at its west end; a
// tower's foot; a stay's top; the banners' left hanging point.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, tone, vnoise } from "../../raster.ts";


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

/** A round lacquered column: lit stripe left, shade right; t0 shifts the whole. */
const roundT = (u: number, t0: number): number => t0 + (u < 0.18 ? -0.25 : u < 0.42 ? -0.08 : u < 0.72 ? 0.08 : u < 0.9 ? 0.22 : 0.4);

/**
 * A black-tiled roof in side elevation: the slope facing us from the eave line (y) up to the ridge
 * (y - rh), x0..x1 at the eave. Vertical runs of round tiles lit on their left, a row of tile-end
 * caps along the eave, corners swept up, a gold-trimmed ridge with horned ends.
 */
export function roof(c: PaintCtx, x0: number, x1: number, y: number, rh: number, inset: number, seed: number, horns = true): void {
  const d = c.d;
  const cx = (x0 + x1) / 2, span = (x1 - x0) / 2;
  const ridgeH = Math.max(8, rh * 0.12);
  const Y0 = Math.round(c.Y(y - rh - ridgeH * 1.6)), Y1 = Math.round(c.Y(y + 6));
  const X0 = Math.round(c.X(x0 - span * 0.06)), X1 = Math.round(c.X(x1 + span * 0.06));
  if (!c.buf.touches(X0, Y0, X1, Y1)) return;
  for (let yy = Math.max(Y0, c.buf.oy); yy < Math.min(Y1, c.buf.y1); yy++) {
    const ly = c.ly(yy + 0.5);
    const u = (y - ly) / rh; // 0 eave .. 1 ridge
    for (let x = Math.max(X0, c.buf.ox); x < Math.min(X1, c.buf.x1); x++) {
      const lx = c.lx(x + 0.5);
      const k = (lx - cx) / span; // -1 .. 1 along the eave
      const ak = Math.abs(k);
      // the half width of the slope at this height (a concave sweep), the corners turned up
      const hw = 1 - inset * Math.pow(Math.max(0, u), 0.75);
      const lift = Math.pow(Math.max(0, ak - 0.7) / 0.3, 2.2) * rh * 0.32;
      const eave = y - lift;
      if (ly > eave + 4 || ak > hw + 0.05 * Math.max(0, 1 - u * 4)) continue;
      if (u > 1) {
        // the ridge: a thick beam, gold trimmed, its ends rising into horns
        const ridgeHalf = 1 - inset;
        if (ak > ridgeHalf + 0.02) continue;
        const v = (y - rh - ly) / ridgeH;
        const horn = horns ? Math.pow(Math.max(0, ak - (ridgeHalf - 0.08)) / 0.1, 1.5) * 1.6 : 0;
        if (v > 1 + horn) continue;
        const col = v < 0.2 || v > 0.85 + horn ? tone(P.gold, 0.3 + (k > 0 ? 0.2 : 0), x, yy, 0.3) : tone(P.lacquer, 0.55, x, yy, 0.3);
        c.buf.set(x, yy, col);
        continue;
      }
      if (ly > eave) {
        // the eave's edge: a row of round tile-end caps over a dark fascia
        const cap = Math.floor(lx / 6);
        const f = lx / 6 - cap - 0.5;
        const capDisc = (ly - eave) < 3.4 * Math.sqrt(Math.max(0, 1 - 4 * f * f));
        c.buf.set(x, yy, capDisc ? tone(P.tile, f < 0 ? 0.35 : 0.65, x, yy, 0.3) : P.lacquer[4]!);
        continue;
      }
      // tile runs: vertical, each lit on its left; darker toward the eave and the corners
      const run = lx / 5;
      const fr = run - Math.floor(run);
      let t = 0.55 + (1 - u) * 0.12 + ak * 0.08 + (fr < 0.3 ? -0.2 : fr > 0.78 ? 0.18 : 0);
      if (d >= 0.5 && hash(Math.floor(run), Math.floor(ly / 3), seed) < 0.04) t -= 0.15;
      if (ly < y - rh + 3) t -= 0.15;
      c.buf.set(x, yy, tone(P.tile, clamp(t, 0, 1), x, yy, 0.3));
    }
  }
}

/** A frieze of brackets (dougong) under an eave: gold blocks on black lacquer, a red-tipped arm. */
function brackets(c: PaintCtx, x0: number, x1: number, y: number, h: number, pitch: number): void {
  fill(c, x0, y, x1, y + h, (x, yy, _u, v) => {
    const lx = c.lx(x + 0.5);
    const k = (((lx - x0) % pitch) + pitch) % pitch / pitch;
    if (v < 0.16) return P.lacquer[4]!;
    if (k < 0.5) {
      if (v < 0.5) return tone(P.gold, k < 0.12 ? 0.15 : 0.5, x, yy, 0.3);
      if (v < 0.8 && k > 0.1 && k < 0.4) return tone(P.gold, 0.7, x, yy, 0.3);
      return P.lacquer[3]!;
    }
    if (k < 0.58 && v > 0.3 && v < 0.6) return P.red[3]!;
    return v > 0.85 ? P.lacquer[4]! : P.lacquer[2]!;
  });
}

/** One storey's face from x0 to x1, top y0 to floor y1: columns on drums, lattice screens. */
function storey(c: PaintCtx, x0: number, x1: number, y0: number, y1: number, bay: number, seed: number, warm: number): void {
  const d = c.d;
  const H = y1 - y0;
  const n = Math.max(1, Math.round((x1 - x0) / bay));
  const bw = (x1 - x0) / n;
  const colW = Math.max(12, bw * 0.13);
  fill(c, x0, y0, x1, y1, (x, y, _u, v) => {
    const lx = c.lx(x + 0.5);
    const i = Math.floor((lx - x0) / bw);
    const bx = lx - x0 - i * bw; // 0 .. bw in this bay
    // a column at the start of every bay (and at the end)
    const cu = (bx + colW / 2) % bw;
    if (cu < colW || lx > x1 - colW / 2) {
      const u = lx > x1 - colW / 2 ? (lx - (x1 - colW / 2)) / colW : cu / colW;
      if (v > 0.92) return tone(P.stone, u < 0.3 ? 0.2 : 0.5, x, y, 0.3);
      if (Math.abs(v - 0.06) < 0.025 || Math.abs(v - 0.88) < 0.012) return tone(P.gold, u < 0.4 ? 0.2 : 0.55, x, y, 0.3);
      return tone(P.lacquer, clamp(roundT(u, 0.45), 0, 1), x, y, 0.3);
    }
    // the bay: a lintel band, then the lattice screen, then a solid lacquer wainscot
    const inner = (bx - colW / 2) / (bw - colW);
    if (v < 0.09) return tone(P.lacquer, 0.6 + (v < 0.02 ? -0.3 : 0), x, y, 0.3);
    if (v > 0.74) {
      if (v < 0.765) return tone(P.gold, 0.45, x, y, 0.3);
      return tone(P.lacquer, 0.5 + (inner < 0.04 || inner > 0.96 ? 0.25 : 0) + (v > 0.97 ? 0.2 : 0), x, y, 0.3);
    }
    // lattice: a frame, then a grid of small panes; warm paper glows behind in some bays
    const fx = Math.min(inner, 1 - inner) * (bw - colW), fy = Math.min(v - 0.09, 0.74 - v) * H;
    if (fx < 4 || fy < 4) return tone(P.lacquer, fx < 1.2 || fy < 1.2 ? 0.75 : 0.45, x, y, 0.3);
    const pane = Math.max(5, 7 * Math.min(1.2, H / 400));
    const gx = (lx - x0) / pane, gy = (c.ly(y + 0.5) - y0) / pane;
    const bar = (gx - Math.floor(gx)) < 0.24 || (gy - Math.floor(gy)) < 0.24;
    if (bar && d >= 0.25) return P.lacquer[3]!;
    const lit = hash1(i, seed) < warm;
    if (lit) return tone(P.paper, clamp(0.25 + v * 0.5 + (bayer4(x, y) < 0.3 ? 0.1 : 0), 0, 1), x, y, 0.35);
    return tone(P.lacquer, 0.3 + v * 0.2, x, y, 0.3);
  });
}

export interface PalaceP {
  /** Length of the hall, px; the anchor is the floor line at its west end. */
  w: number;
  /** Ground storey, upper storey and top pavilion heights, px. */
  h0: number;
  h1: number;
  h2: number;
  /** The entrance: x from the west end, width, height, px. */
  door: [number, number, number];
}

export const palace = definePainter<PalaceP>("op.palace", {
  bounds(p) {
    return [-200, -(p.h0 + p.h1 + p.h2 + 820), p.w + 200, 64];
  },
  paint(c, p) {
    const w = p.w, seed = c.seed;
    const r0 = 230, r1 = 220, r2 = 290;
    const g0 = -p.h0;
    const s1 = 160;
    const g1top = g0 - r0 * 0.55;
    const g1 = g1top - p.h1;
    const s2 = w * 0.3;
    const g2top = g1 - r1 * 0.55;
    const g2 = g2top - p.h2;
    // the stone platform: big ashlar courses, a lit top edge, grown into the rock below
    fill(c, -44, 0, w + 44, 52, (x, y, _u, v) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      if (ly < 1.2 / c.d) return P.stone[0]!;
      const course = Math.floor(ly / 17);
      const bx = (lx + course * 37) / 64;
      const joint = (bx - Math.floor(bx)) < 0.025 || (ly % 17) < 1.1 / c.d;
      let t = 0.4 + 0.18 * hash(Math.floor(bx), course, seed) + v * 0.15;
      if (joint) t = 0.78;
      if ((ly % 17) < 2.5 && !joint) t -= 0.12;
      // moss and stains creeping up from the rock
      if (v > 0.55 && vnoise(lx / 9, ly / 4, seed + 3) > 0.62 - v * 0.2) return tone(P.moss, 0.55 + v * 0.3, x, y, 0.35);
      if (vnoise(lx / 2.5, ly / 30, seed + 4) > 0.75) t += 0.1;
      return tone(P.stone, clamp(t, 0, 1), x, y, 0.3);
    });
    // a step up to the portal
    const [dx, dw, dh] = p.door;
    fill(c, dx - 40, -6, dx + dw + 40, 0, (x, y, _u, v) => tone(P.stone, v < 0.25 ? 0.05 : 0.45, x, y, 0.3));
    // the storeys, top down (each one's foot is hidden by the roof below it)
    storey(c, s2, w - s2, g2, g2top + 30, 128, seed + 7, 0.6);
    storey(c, s1, w - s1, g1, g1top + 30, 150, seed + 8, 0.5);
    storey(c, 0, w, g0, -6, 154, seed + 9, 0.35);
    brackets(c, -10, w + 10, g0 - 4, 26, 32);
    brackets(c, s1 - 8, w - s1 + 8, g1 - 4, 24, 30);
    brackets(c, s2 - 8, w - s2 + 8, g2 - 4, 22, 28);
    // the gallery's balustrade along the second storey's foot
    fill(c, s1 - 20, g1top + 8, w - s1 + 20, g1top + 30, (x, y, _u, v) => {
      if (v < 0.18) return tone(P.lacquer, v < 0.06 ? 0.15 : 0.5, x, y, 0.3);
      const k = (c.lx(x + 0.5) / 9) % 1;
      if (v > 0.85) return P.lacquer[3]!;
      return k < 0.35 ? tone(P.lacquer, 0.45, x, y, 0.3) : 0;
    });
    // the portal: a deep frame of lacquer and gold, red doors ajar, warm light at the seam
    fill(c, dx - 26, -dh - 34, dx + dw + 26, -6, (x, y, u, v) => {
      const ex = Math.min(u, 1 - u) * (dw + 52), ey = v * (dh + 28);
      if (ex < 26 || ey < 28) return tone(P.lacquer, ex < 3 || ey < 3 ? 0.15 : ex < 6 || ey < 6 ? 0.35 : 0.65, x, y, 0.3);
      return 0;
    });
    fill(c, dx - 26, -dh - 34, dx + dw + 26, -dh - 30, (x, y) => tone(P.gold, 0.35, x, y, 0.3));
    fill(c, dx, -dh - 6, dx + dw, -6, (x, y, u, v) => {
      const seam = Math.abs(u - 0.5) < 0.035;
      if (seam) return v > 0.08 ? (bayer4(x, y) < 0.6 ? P.gold[0]! : P.paper[0]!) : P.gold[1]!;
      const half = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5;
      const ex = Math.min(half, 1 - half) * (dw / 2), ey = Math.min(v, 1 - v) * dh;
      if (ex < 2 || ey < 2) return P.lacquer[4]!;
      // panels: four per leaf, raised; gold studs in rows; a ring handle by the seam
      const pv = (v * 4) % 1, pu = half;
      if (pv < 0.06 || pv > 0.94 || pu < 0.08 || pu > 0.92) return tone(P.red, 0.75, x, y, 0.3);
      const sx = (c.lx(x + 0.5) - dx) / 13, sy = (c.ly(y + 0.5) + dh) / 13;
      if (c.d >= 0.5 && Math.abs(sx - Math.round(sx)) < 0.12 && Math.abs(sy - Math.round(sy)) < 0.12) return P.gold[1]!;
      const ring = Math.abs(Math.hypot(c.lx(x + 0.5) - (dx + dw * (u < 0.5 ? 0.42 : 0.58)), c.ly(y + 0.5) + dh * 0.5) - 5) < 1.2;
      if (ring) return P.gold[2]!;
      return tone(P.red, 0.32 + v * 0.3 + (u < 0.5 ? 0 : 0.08) + (pv < 0.2 ? -0.08 : 0), x, y, 0.35);
    });
    // the plaque over the portal
    fill(c, dx + dw / 2 - 70, -dh - 72, dx + dw / 2 + 70, -dh - 38, (x, y, u, v) => {
      const ex = Math.min(u, 1 - u) * 140, ey = Math.min(v, 1 - v) * 34;
      if (ex < 1 || ey < 1) return P.ink[0]!;
      if (ex < 4 || ey < 4) return tone(P.gold, u < 0.4 ? 0.15 : 0.5, x, y, 0.3);
      if (c.d >= 0.5) {
        // four gold characters
        const ch = Math.floor(u * 4), cu = (u * 4) % 1;
        if (cu > 0.2 && cu < 0.8 && v > 0.22 && v < 0.78 && hash(Math.floor(cu * 5), Math.floor(v * 6), ch + seed) < 0.42) return P.gold[1]!;
      }
      return tone(P.lacquer, 0.55, x, y, 0.3);
    });
    // the seal: the one red, under the top eave
    const sealX = w / 2;
    fill(c, sealX - 32, g2 + 36, sealX + 32, g2 + 100, (x, y, u, v) => {
      const ex = Math.min(u, 1 - u) * 64, ey = Math.min(v, 1 - v) * 64;
      if (ex < 3 || ey < 3) return P.gold[1]!;
      const g = c.d >= 0.5 && ((Math.abs(u - 0.5) < 0.06 && v > 0.2 && v < 0.8) || (Math.abs(v - 0.4) < 0.05 && u > 0.25 && u < 0.75) || (Math.abs(v - 0.7) < 0.05 && u > 0.3 && u < 0.7));
      return g ? P.paper[0]! : tone(P.red, 0.3 + 0.2 * v, x, y, 0.3);
    });
    // the roofs, top tier first, each lapping over the foot of the storey above
    roof(c, s2 - 140, w - s2 + 140, g2 - 22, r2, 0.42, seed + 11);
    roof(c, s1 - 120, w - s1 + 120, g1 - 22, r1, 0.24, seed + 12);
    roof(c, -120, w + 120, g0 - 22, r0, 0.18, seed + 13);
    // a little roof over the portal
    roof(c, dx - 60, dx + dw + 60, -dh - 76, 40, 0.25, seed + 14, false);
    // lanterns under the first eave, every other bay: red paper, gold caps, a warm core
    if (c.d >= 0.25) {
      for (let lx = 77; lx < w - 40; lx += 308) {
        fill(c, lx - 1, g0 + 20, lx + 1, g0 + 40, () => P.ink[0]!);
        fill(c, lx - 13, g0 + 40, lx + 13, g0 + 78, (x, y, u, v) => {
          const r = Math.abs(u - 0.5) * 2;
          if (r > Math.sqrt(Math.max(0, 1 - Math.pow(v * 2 - 1, 2))) * 1.02 && v > 0.12 && v < 0.88) return 0;
          if (v < 0.12 || v > 0.88) return tone(P.gold, 0.6, x, y, 0.3);
          if (Math.abs(((v * 5) % 1) - 0.5) < 0.08) return P.red[4]!;
          return tone(P.red, u < 0.35 ? 0.0 : u < 0.65 ? 0.18 : 0.45, x, y, 0.3);
        });
      }
    }
  },
});

export interface TowerP {
  /** Height to the tip of the finial, px; the anchor is its foot. */
  h: number;
  /** Width of the shaft, px. */
  w?: number;
}

/**
 * A gate tower (reference 6): a battered stone base with a lantern niche, a timber shaft of
 * lacquer and gold with lattice panels and a round window, two small roofs, a gold finial.
 */
export const tower = definePainter<TowerP>("op.tower", {
  bounds(p) {
    const w = p.w ?? 72;
    return [-w - 60, -p.h - 30, w + 60, 6];
  },
  paint(c, p) {
    const w = p.w ?? 72, half = w / 2, seed = c.seed;
    const baseH = p.h * 0.24;
    // the stone base, battered (wider at the foot), coursed, a lantern niche glowing
    fill(c, -half - 16, -baseH, half + 16, 0, (x, y, _u, v) => {
      const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
      const bat = (half + 6) + 10 * v;
      if (Math.abs(lx) > bat) return 0;
      const u = (lx + bat) / (2 * bat);
      if (Math.abs(lx) < 11 && v > 0.32 && v < 0.62) return Math.abs(lx) < 6 && v > 0.38 && v < 0.58 ? (bayer4(x, y) < 0.5 ? P.gold[0]! : P.gold[1]!) : P.ink[0]!;
      const course = Math.floor(-ly / 14);
      const joint = (-ly % 14) < 1.1 / c.d || (((lx + course * 19) / 34) % 1 + 1) % 1 < 0.04;
      let t = u < 0.2 ? 0.15 : u < 0.7 ? 0.4 : 0.65;
      if (joint) t += 0.3;
      if (v > 0.8 && vnoise(lx / 5, ly / 3, seed) > 0.55) return tone(P.moss, 0.6, x, y, 0.3);
      return tone(P.stone, clamp(t + v * 0.1, 0, 1), x, y, 0.3);
    });
    // the shaft: lacquer frame, gold bands, lattice panels, a round window with warm light
    const top = -p.h + 120;
    fill(c, -half, top, half, -baseH, (x, y, u, v) => {
      if (u < 0.09 || u > 0.91) return tone(P.lacquer, u < 0.05 ? 0.2 : u > 0.95 ? 0.8 : 0.5, x, y, 0.3);
      const band = Math.abs(((v * 6) % 1) - 0.02) < 0.025;
      if (band) return tone(P.gold, u < 0.4 ? 0.2 : 0.5, x, y, 0.3);
      const pu = (u - 0.09) / 0.82;
      if (pu < 0.08 || pu > 0.92) return P.lacquer[3]!;
      const gx = c.lx(x + 0.5) / 6, gy = c.ly(y + 0.5) / 6;
      if ((gx - Math.floor(gx)) < 0.25 || (gy - Math.floor(gy)) < 0.25) return P.lacquer[3]!;
      return tone(P.lacquer, 0.35 + pu * 0.3, x, y, 0.3);
    });
    const wy = top + 60;
    fill(c, -18, wy - 18, 18, wy + 18, (x, y) => {
      const r = Math.hypot(c.lx(x + 0.5), c.ly(y + 0.5) - wy);
      if (r > 18) return 0;
      return r > 15 ? P.gold[2]! : r > 12 ? P.ink[0]! : bayer4(x, y) < 0.5 ? P.gold[0]! : P.paper[0]!;
    });
    brackets(c, -half - 6, half + 6, top - 4, 16, 14);
    roof(c, -half - 40, half + 40, top - 6, 56, 0.35, seed + 3, true);
    // the upper pavilion and its roof, a gold finial
    fill(c, -half * 0.6, top - 96, half * 0.6, top - 40, (x, y, u) => tone(P.lacquer, roundT(u, 0.45), x, y, 0.3));
    roof(c, -half * 0.6 - 34, half * 0.6 + 34, top - 96, 50, 0.45, seed + 4, true);
    fill(c, -3, -p.h, 3, top - 150, (x, y, u) => tone(P.gold, u < 0.4 ? 0.2 : 0.55, x, y, 0.3));
    fill(c, -7, -p.h + 8, 7, -p.h + 16, (x, y, u) => tone(P.gold, u < 0.4 ? 0.15 : 0.5, x, y, 0.3));
  },
});

export interface StayP {
  /** The far end of the cable, px from the anchor (the tower's top). */
  dx: number;
  dy: number;
}

/** A cable stay: a heavy rope with a slight sag, lit along its top, prayer pennants along it. */
export const stay = definePainter<StayP>("op.stay", {
  bounds(p) {
    return [Math.min(0, p.dx) - 10, Math.min(0, p.dy) - 10, Math.max(0, p.dx) + 10, Math.max(0, p.dy) + 30];
  },
  paint(c, p) {
    const len = Math.hypot(p.dx, p.dy);
    const n = Math.max(4, Math.ceil(len * c.d * 1.2));
    const at = (t: number): [number, number] => [p.dx * t, p.dy * t + Math.sin(t * Math.PI) * len * 0.035];
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(i / n);
      const X = Math.round(c.X(x)), Y = Math.round(c.Y(y));
      c.buf.set(X, Y, P.earth[3]!);
      c.buf.set(X, Y + 1, P.earth[4]!);
      if (c.d >= 0.5) c.buf.set(X, Y + 2, P.earth[5]!);
    }
    // small pennants hanging along it, paper white and blue with the odd red
    if (c.d >= 0.25) {
      const k = Math.floor(len / 46);
      for (let i = 1; i < k; i++) {
        const t = i / k;
        const [x, y] = at(t);
        const col = hash1(i, c.seed) < 0.15 ? P.red : hash1(i, c.seed) < 0.55 ? P.paper : P.blue;
        fill(c, x - 5, y + 2, x + 5, y + 18, (xx, yy, u, v) => (v > 0.75 && Math.abs(u - 0.5) * 2 < (v - 0.75) * 4 ? 0 : tone(col, u < 0.4 ? 0.1 : 0.4, xx, yy, 0.3)));
      }
    }
  },
});

export interface BannersP {
  /** Span between the two hanging points, px; the anchor is the left one. */
  w: number;
  /** Banner drop, px. */
  drop: number;
  n?: number;
  /** Sway frame (0..3) for the sprite; omitted for the still plate. */
  frame?: number;
}

/** Festival banners on a rope between the towers: long paper banners with ink glyphs, gold hems. */
export const banners = definePainter<BannersP>("op.banners", {
  bounds(p) {
    return [-10, -8, p.w + 10, p.drop + p.w * 0.12 + 40];
  },
  paint(c, p) {
    const n = p.n ?? 5;
    const f = p.frame ?? 0;
    const sagAt = (lx: number): number => Math.sin((lx / p.w) * Math.PI) * p.w * 0.1;
    for (let lx = 0; lx <= p.w; lx += 0.5 / c.d) {
      const X = Math.round(c.X(lx)), Y = Math.round(c.Y(sagAt(lx)));
      c.buf.set(X, Y, P.earth[3]!);
      c.buf.set(X, Y + 1, P.earth[4]!);
    }
    for (let i = 0; i < n; i++) {
      const bx = ((i + 0.5) / n) * p.w;
      const top = sagAt(bx);
      const bw = Math.min(40, (p.w / n) * 0.5);
      const drop = p.drop * (0.8 + 0.2 * hash(i, 1, c.seed));
      const red = i % 2 === 1;
      const ramp = red ? P.red : P.paper;
      // the sway: the hem swings while the top stays put (sprite frames)
      const swing = Math.sin((f / 4) * Math.PI * 2 + i * 1.3) * 3;
      fill(c, bx - bw / 2 - 6, top + 2, bx + bw / 2 + 6, top + drop + 2, (x, y, _u, v) => {
        const off = swing * v * v;
        const lx = c.lx(x + 0.5) - (bx + off);
        const u = lx / bw + 0.5;
        if (u < 0 || u > 1) return 0;
        const hem = Math.abs(u - 0.5) * 2;
        if (v > 1 - 0.1 * (1 - hem)) return 0;
        if (u < 0.08 || u > 0.92) return ramp[ramp.length - 1]!;
        if (Math.abs(v - 0.06) < 0.035 || Math.abs(v - 0.86) < 0.025) return tone(P.gold, 0.4, x, y, 0.3);
        // a column of ink glyphs down the middle of the paper banners, gold on the red ones
        if (c.d >= 0.5 && Math.abs(u - 0.5) < 0.22 && v > 0.16 && v < 0.8 && hash(Math.floor(u * 5), Math.floor(v * 14), c.seed + i) < 0.4) return red ? P.gold[1]! : P.ink[1]!;
        return tone(ramp, u < 0.3 ? 0.12 : u < 0.7 ? 0.3 : 0.55, x, y, 0.3);
      });
    }
  },
});
