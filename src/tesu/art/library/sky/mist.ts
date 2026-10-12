// Mist that moves: long wisps drifting across a background plane between the karst rows
// and over the lake, drawn as sprites so they slide and churn while the plates stay put.
// Transparency is dither only (the sprite path keeps a pixel or drops it): the density
// profile picks a 4x4 ordered-dither threshold, so thin mist is a sparse screen of white
// pixels and thick mist is solid.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm1, vnoise } from "../../raster.ts";

export interface WispP {
  /** Length, level-1 px; the anchor is the left end of its centre line. */
  w: number;
  /** Thickness at the middle, px. */
  h: number;
  /** Peak density 0..1 (default 0.7): 1 is solid in the core. */
  density?: number;
  /** Sprite frame (0..3): the slow roll of the mist's inner texture. */
  frame?: number;
}

export const wisp = definePainter<WispP>("sky.wisp", {
  bounds(p) {
    return [-2, -p.h * 0.75, p.w + 2, p.h * 0.6];
  },
  paint(c, p) {
    const b = c.buf;
    const frame = (p.frame ?? 0) & 3;
    const dens = p.density ?? 0.7;
    const X0 = Math.max(b.ox, Math.floor(c.X(0))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
    const Y0 = Math.max(b.oy, Math.floor(c.Y(-p.h * 0.75))), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.h * 0.6)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const t = lx / p.w;
      // thick in the middle, long thin tails; the centre line wanders a little
      const along = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.8);
      const mid = (fbm1(lx / (p.h * 5), c.seed, 2) - 0.5) * p.h * 0.35;
      const half = p.h * 0.5 * (0.35 + 0.65 * along) * (0.75 + 0.5 * fbm1(lx / (p.h * 3), c.seed + 1, 2));
      for (let y = Y0; y < Y1; y++) {
        const ly = c.ly(y + 0.5);
        const v = (ly - mid) / Math.max(1e-3, half);
        if (v < -1 || v > 1) continue;
        // denser along the lower half (mist lies on something), rolling inner texture
        const prof = (1 - v * v) * (v > 0 ? 1 : 0.8);
        const roll = vnoise(lx / (p.h * 1.2) + frame * 0.35, ly / (p.h * 0.45), c.seed + 3);
        const a = prof * along * dens * (0.55 + 0.7 * roll);
        if (bayer4(x, y) >= clamp(a, 0, 1)) continue;
        b.set(x, y, a > 0.75 && v < -0.2 ? P.cloud[0]! : a > 0.45 ? P.cloud[1]! : P.cloud[2]!);
      }
    }
  },
});
