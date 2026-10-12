// The deeper hall (P2), seen only through the back wall's openings: the moon gates, the
// pierced clerestory and the arches into the roof space. A second, larger room further in:
// a far colonnade against tall windows full of warm light, lanterns hanging at many heights,
// beams and the roof going up into the dark. Painted at full contrast; the plane's haze (40%)
// turns it into warm incense air.

import { definePainter } from "../../painter.ts";
import { M, clamp, fbm, hash, mt, rect, tn, vnoise } from "./kit.ts";

export interface DeepP {
  /** Width (plane px; the anchor is the west end on the floor line), plane px per H. */
  w: number;
  u: number;
  top: number;
  below: number;
}

export const deep = definePainter<DeepP>("hall.deep", {
  bounds(p) {
    return [0, -p.top, p.w, p.below];
  },
  paint(c, p) {
    const U = p.u;
    const seed = c.seed;
    const bay = 3.4 * U;
    rect(c, 0, -p.top, p.w, p.below, (X, Y, lx, ly) => {
      const hgt = -ly / U;
      const k = ((lx % bay) + bay) % bay;
      const bi = Math.floor(lx / bay);
      // the air: warmest between 2 and 9 H where the far windows pour light in
      const air = clamp(1 - Math.abs(hgt - 5.5) / 9, 0, 1);
      if (ly > 0) {
        // the far floor: dark boards, a gleam under each window
        const gleam = k > 0.25 * bay && k < 0.75 * bay ? 0.25 * (1 - ly / (2 * U)) : 0;
        return mt(M.wood, 0.2 + gleam + vnoise(lx * 0.05, ly * 0.2, seed) * 0.1, X, Y, 0.3, 1);
      }
      // far columns, red in the warm air, lit along one edge
      if (k < 0.34 * U) {
        if (hgt < 0.5) return mt(M.stone, 0.35, X, Y, 0.3, 1);
        const u = k / (0.34 * U);
        return mt(M.verm, 0.25 + air * 0.35 + (u > 0.7 ? 0.25 : 0), X, Y, 0.3, 1);
      }
      // tall windows between them: lattice over bright paper, the source of the hall's warm air
      const wx0 = 0.75 * U, wx1 = bay - 0.4 * U;
      if (k > wx0 && k < wx1 && hgt > 1.4 && hgt < 9.2 && hash(bi, 3, seed) > 0.25) {
        const s = 0.32 * U;
        const gx = (((k - wx0) % s) + s) % s, gy = (((hgt - 1.4) * U % s) + s) % s;
        if (gx < 0.07 * U || gy < 0.07 * U) return mt(M.wood, 0.3 + air * 0.25, X, Y, 0.3, 1);
        const mid = 1 - Math.abs((k - wx0) / (wx1 - wx0) - 0.5) * 1.4;
        return tn(M.glow, clamp(0.35 - mid * 0.3 + (hgt > 7.5 ? 0.2 : 0), 0, 1), X, Y, 0.5);
      }
      // a gallery band at mid height with a rail
      if (hgt > 9.6 && hgt < 10.2) return mt(M.lacq, 0.3 + air * 0.2, X, Y, 0.3, 1);
      if (hgt > 10.2 && hgt < 10.7) return ((lx % (0.5 * U)) < 0.08 * U || hgt > 10.6) ? mt(M.verm, 0.35, X, Y, 0.3, 1) : mt(M.lacq, 0.25 + air * 0.2, X, Y, 0.3, 1);
      // the roof: beams and dark
      if (hgt > 14) {
        const beam = ((((hgt - 14) * U) % (1.4 * U)) + 1.4 * U) % (1.4 * U) < 0.35 * U;
        return mt(M.lacq, beam ? 0.25 : 0.05, X, Y, 0.3, 1);
      }
      // the wall between windows: warm dark panelling, hazier higher up
      const n = fbm(lx * 0.02, ly * 0.02, seed, 3);
      return mt(M.lacq, 0.18 + air * 0.4 + (n - 0.5) * 0.15, X, Y, 0.1, 1);
    });
    // lanterns hanging in the deeper hall: small warm glows on long cords
    for (let i = 0; i * 1.9 * U < p.w; i++) {
      const lx = (i + 0.3 + 0.4 * hash(i, 1, seed)) * 1.9 * U;
      const hy = (2.8 + 9 * hash(i, 2, seed)) * U;
      const r = (0.16 + 0.1 * hash(i, 4, seed)) * U;
      rect(c, lx - 0.5, -p.top, lx + 0.5, -hy - r, (X, Y) => tn(M.dark, 0.6, X, Y, 0));
      rect(c, lx - r, -hy - r * 1.2, lx + r, -hy + r * 1.2, (X, Y, x, y) => {
        const d = Math.hypot((x - lx) / r, (y + hy) / (r * 1.2));
        if (d > 1) return 0;
        return tn(M.glow, clamp(d * 0.55, 0, 1), X, Y, 0.5);
      });
    }
  },
});
