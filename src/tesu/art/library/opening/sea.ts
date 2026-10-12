// A sea of mist seen from the side: the valley beyond the lake's east shore and the land past
// the palace are filled with it (the cloud sea of reference 1's valley). Its top is a line of
// long low swells lit along their sunward slopes; below, a soft white body with faint cool
// layers, slowly bluer toward the bottom. It stands in for land at a plane's depth wherever the
// opening shows no ground (the depth stack never shows a gap).
//
// Anchor: the left end of the sea's surface line. Sizes in level-1 px of its plane.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm1, vnoise1 } from "../../raster.ts";

export interface SeaP {
  w: number;
  /** Depth of the body below the surface line, px. */
  depth: number;
  /** Height of the swells, px (default 14). */
  swell?: number;
  /** Fade in over this many px at each end (default 120). */
  ends?: number;
}

export const sea = definePainter<SeaP>("op.sea", {
  bounds(p) {
    const sw = p.swell ?? 14;
    return [-2, -sw * 2.4 - 8, p.w + 2, p.depth + 2];
  },
  paint(c, p) {
    const b = c.buf, d = c.d;
    const sw = p.swell ?? 14;
    const ends = p.ends ?? 120;
    const C = P.cloud;
    const X0 = Math.max(b.ox, Math.floor(c.X(0))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const e = clamp(Math.min(lx, p.w - lx) / ends, 0, 1);
      const top = -sw * (0.5 + 0.9 * fbm1(lx / (sw * 14), c.seed, 3) + 0.4 * vnoise1(lx / (sw * 3), c.seed + 2)) * e;
      const slope = vnoise1(lx / (sw * 3) + 0.05, c.seed + 2) - vnoise1(lx / (sw * 3) - 0.05, c.seed + 2);
      const Yt = Math.floor(c.Y(top - sw * 0.8)), Yb = Math.min(b.y1, Math.ceil(c.Y(p.depth)));
      for (let y = Math.max(Yt, b.oy); y < Yb; y++) {
        const ly = c.ly(y + 0.5);
        const under = ly - top;
        if (under < 0) {
          // a dithered dissolve above the surface: 25%, then 1 in 8
          const k = -under / (sw * 0.8);
          if (bayer4(x, y) >= (k < 0.5 ? 0.25 : 0.12)) continue;
          b.set(x, y, C[1]!);
          continue;
        }
        let i = 1;
        if (under < 1.5 / d) i = slope > 0 ? 0 : 1;
        else {
          // faint cool layers lower down, dithered at their edges
          const layer = ly / Math.max(1, p.depth) + (fbm1(lx / 300, c.seed + 5, 2) - 0.5) * 0.3;
          const k = clamp(layer * 3, 0, 2.6);
          i = 1 + Math.floor(k) + (bayer4(x, y) < k - Math.floor(k) ? 1 : 0);
        }
        b.set(x, y, C[Math.min(4, i)]!);
      }
    }
  },
});
