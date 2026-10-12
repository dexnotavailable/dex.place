// The Ink Palace in side view: black lacquer, gold ridges, one red seal. The front the
// opening walks up to (twin gate towers, banners, warm doors) is composed in the
// palace section; these are its kit pieces.

import { definePainter } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4, clamp, hash, tone } from "../raster.ts";

export interface HallP {
  /** Width and wall height, level-1 px; the anchor is the wall's bottom-left (the floor line). */
  w: number;
  h: number;
  /** Roof tiers above the wall. */
  tiers?: number;
  /** Door: x from the left, width, height (px). */
  door?: [number, number, number];
}

/** A lacquered hall: timber posts and lacquer panels, gold trim, tiered eaves. */
export const hall = definePainter<HallP>("hall", {
  bounds(p) {
    const tiers = p.tiers ?? 2;
    return [-90, -p.h - tiers * 120 - 40, p.w + 90, 4];
  },
  paint(c, p) {
    const b = c.buf;
    const tiers = p.tiers ?? 2;
    // the wall: posts every 96 px, lacquer panels between, a stone plinth
    const X0 = Math.round(c.X(0)), X1 = Math.round(c.X(p.w));
    const Yt = Math.round(c.Y(-p.h)), Yb = Math.round(c.Y(0));
    const plinth = Math.round(c.Y(-14));
    for (let y = Yt; y < Yb; y++) {
      for (let x = X0; x < X1; x++) {
        const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
        let col: number;
        if (y >= plinth) {
          col = tone(P.stone, y === plinth ? 0.15 : 0.5 + 0.2 * hash(Math.floor(lx / 24), 0, c.seed), x, y, 0.4);
        } else {
          const post = ((lx % 96) + 96) % 96 < 12;
          const rail = Math.abs(ly + p.h * 0.62) < 3 || Math.abs(ly + p.h * 0.18) < 2;
          if (post) col = tone(P.red, 0.45 + 0.35 * (((lx % 96) + 96) % 96 / 12), x, y, 0.4);
          else if (rail) col = P.gold[2]!;
          else col = tone(P.lacquer, 0.35 + 0.3 * (-ly / p.h) + (bayer4(x, y) - 0.5) * 0.1, x, y, 0.4);
        }
        if (x === X0 || x === X1 - 1) col = P.ink[0]!;
        b.set(x, y, col);
      }
    }
    // the door: red leaves with gold studs, warm light at the seam
    if (p.door) {
      const [dx, dw, dh] = p.door;
      const DX0 = Math.round(c.X(dx)), DX1 = Math.round(c.X(dx + dw)), DY0 = Math.round(c.Y(-dh)), DY1 = Math.round(c.Y(-14));
      for (let y = DY0; y < DY1; y++) {
        for (let x = DX0; x < DX1; x++) {
          const mid = Math.abs(x - (DX0 + DX1) / 2) < 1;
          let col = tone(P.red, 0.25 + 0.4 * ((y - DY0) / Math.max(1, DY1 - DY0)), x, y, 0.5);
          if (mid) col = P.gold[1]!;
          if ((x - DX0) % Math.max(2, Math.round(9 * c.d)) === 4 && (y - DY0) % Math.max(2, Math.round(9 * c.d)) === 4) col = P.gold[2]!;
          if (x === DX0 || x === DX1 - 1 || y === DY0) col = P.ink[0]!;
          b.set(x, y, col);
        }
      }
    }
    // eaves: each tier a sweeping tiled roof with a gold ridge, upturned at the ends
    for (let t = 0; t < tiers; t++) {
      const inset = t * 70;
      const ex0 = -60 + inset, ex1 = p.w + 60 - inset;
      const eaveY = -p.h - t * 120;
      const roofH = 54;
      for (let ly = eaveY - roofH; ly < eaveY + 6; ly += 1 / c.d) {
        const Y = Math.round(c.Y(ly));
        const u = (eaveY - ly) / roofH; // 0 at the eave, 1 at the ridge
        const half = (ex1 - ex0) / 2 - u * 30;
        const cx = (ex0 + ex1) / 2;
        // upturned corners: the lowest rows reach further out
        const flare = u < 0.15 ? 26 * (1 - u / 0.15) : 0;
        const xa = Math.round(c.X(cx - half - flare)), xb = Math.round(c.X(cx + half + flare));
        for (let x = xa; x < xb; x++) {
          let col: number;
          if (u > 0.94) col = P.gold[1 + (hash(x, 0, c.seed) < 0.3 ? 1 : 0)]!;
          else if (ly > eaveY) col = P.ink[0]!;
          else {
            const course = Math.floor((eaveY - ly) / 6) % 2;
            col = tone(P.tile, clamp(0.35 + 0.4 * (1 - u) + course * 0.12, 0, 1), x, Y, 0.4);
          }
          if (x === xa || x === xb - 1) col = P.ink[0]!;
          b.set(x, Y, col);
        }
      }
      // the wall of the next tier
      if (t + 1 < tiers) {
        const wy0 = Math.round(c.Y(eaveY - 120)), wy1 = Math.round(c.Y(eaveY - roofH));
        const wx0 = Math.round(c.X(ex0 + 70)), wx1 = Math.round(c.X(ex1 - 70));
        for (let y = wy0; y < wy1; y++) {
          for (let x = wx0; x < wx1; x++) {
            if (b.get(x, y)) continue;
            b.set(x, y, tone(P.lacquer, 0.5 + (bayer4(x, y) - 0.5) * 0.1, x, y, 0.4));
          }
        }
      }
    }
  },
});
