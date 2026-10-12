// Details on the still water that the lake shader does not draw: ripple rings that open
// slowly round anything standing in the lake (mooring posts, jetty legs, a wading Walker's
// feet, a dropped talisman). The lake itself, its mirror, shimmer, glints and haze stay the
// shader's (render/atmos.ts); its colours come from the time-of-day key (keys.ts).
//
// Drawn as a sprite on the front plane (rate 1, the play plane's depth) at the waterline,
// so it lands on top of the near water slice. Flattened ellipses: the lake is seen almost
// edge-on. The far half of a ring is a dark line (it faces away and mirrors the shore), the
// near half a light line (it mirrors the sky). Rings fade out as they open, by dither.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, hash } from "../../raster.ts";

export interface RippleP {
  /** Largest ring radius across, px (level-1 of its plane). */
  rx: number;
  /** Flattening: ry = rx * flat (default 0.16). */
  flat?: number;
  /** Rings alive at once (default 3). */
  rings?: number;
  /** Frames in one cycle (default 8, played at 8 fps). */
  cycle?: number;
  frame?: number;
}

export const ripple = definePainter<RippleP>("sky.ripple", {
  bounds(p) {
    const ry = p.rx * (p.flat ?? 0.16);
    return [-p.rx - 2, -ry - 2, p.rx + 2, ry + 2];
  },
  paint(c, p) {
    const b = c.buf, d = c.d;
    const n = Math.max(1, p.rings ?? 3);
    const cycle = Math.max(2, p.cycle ?? 8);
    const f = ((p.frame ?? 0) % cycle) / cycle;
    const flat = p.flat ?? 0.16;
    for (let i = 0; i < n; i++) {
      const ph = (f + i / n) % 1;
      // rings start just outside the post and open; thin and faint by the time they are wide
      const rx = p.rx * (0.18 + 0.82 * ph);
      const ry = Math.max(1 / d, rx * flat);
      const keep = 1 - ph * ph;
      const steps = Math.max(24, Math.ceil(rx * d * 6));
      let lastX = NaN, lastY = NaN;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const X = Math.round(c.X(Math.cos(a) * rx)), Y = Math.round(c.Y(Math.sin(a) * ry));
        if (X === lastX && Y === lastY) continue;
        lastX = X; lastY = Y;
        // gaps: a ring is never a perfect line on real water
        if (hash(Math.floor((a / (Math.PI * 2)) * 11), i, c.seed) < 0.18) continue;
        if (bayer4(X, Y) > keep) continue;
        const far = Math.sin(a) < 0;
        b.set(X, Y, far ? P.jade[5]! : ph < 0.5 ? P.cloud[0]! : P.jade[0]!);
      }
    }
  },
});
