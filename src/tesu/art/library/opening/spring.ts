// Kagami's spring: the lake drains through the karst and bursts out of the plateau's cliff below
// it, a white fall pouring from a dark cave mouth down the face into the valley's mist (karst
// springs come out of cliffs like this). It gives the wide frames a bright vertical under the
// lake and says where the water goes.
//
// The mouth: a ragged dark hollow in the rock, mossy at its lip, wet streaks under it. The fall:
// it leaves the mouth with a little arc, a bright core broken by flow streaks, a cool shaded
// right edge, widening and fraying as it drops, then a dithered column of spray where it meets
// the mist. `frame` (0..3) moves the streaks for the flow; frame -1 paints the static plate.
// Anchor: the mouth's lip (where the water leaves the rock).

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, vnoise1 } from "../../raster.ts";

export interface SpringP {
  /** Mouth width and height, px. */
  mw: number;
  mh: number;
  /** Fall width at the mouth and its drop to the mist, px. */
  w: number;
  drop: number;
  /** Paint only the fall (for the animated overlay), not the mouth. */
  fallOnly?: boolean;
  frame?: number;
}

export const spring = definePainter<SpringP>("op.spring", {
  bounds(p) {
    return [-p.mw / 2 - 30, -p.mh - 6, p.mw / 2 + p.w * 2 + 40, p.drop + 30];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const frame = p.frame ?? -1;
    if (!p.fallOnly) {
      // the mouth: a ragged hollow, darkest at its back, a mossy lip over it, wet rock below
      const X0 = Math.max(b.ox, Math.floor(c.X(-p.mw / 2 - 4))), X1 = Math.min(b.x1, Math.ceil(c.X(p.mw / 2 + 4)));
      for (let x = X0; x < X1; x++) {
        const lx = c.lx(x + 0.5);
        const u = lx / (p.mw / 2);
        if (Math.abs(u) > 1.05) continue;
        const arch = p.mh * Math.sqrt(Math.max(0, 1 - u * u)) * (0.85 + 0.25 * vnoise1(lx / 4, seed));
        for (let y = Math.max(b.oy, Math.floor(c.Y(-arch - 4))); y < Math.min(b.y1, Math.ceil(c.Y(2))); y++) {
          const ly = c.ly(y + 0.5);
          const up = -ly;
          if (up > arch + 2.5) continue;
          if (up > arch - 0.5) { b.set(x, y, P.moss[up > arch + 1 ? 3 : 5]!); continue; }
          const k = up / Math.max(1, arch);
          b.set(x, y, k > 0.75 ? P.karst[7]! : P.ink[k > 0.3 ? 0 : 1]!);
        }
      }
    }
    // the fall
    const top = 0;
    const end = p.drop;
    const Y0 = Math.max(b.oy, Math.floor(c.Y(top - 1))), Y1 = Math.min(b.y1, Math.ceil(c.Y(end + 20)));
    const C = P.cloud;
    for (let y = Y0; y < Y1; y++) {
      const ly = c.ly(y + 0.5);
      const k = ly / end;
      // a short arc out of the mouth, then straight down, wandering a little
      const arc = Math.min(1, ly / 14);
      const cx = p.w * 0.6 * Math.sqrt(arc) + Math.sin(ly / 37 + seed) * Math.min(2, ly / 40) + (vnoise1(ly / 80, seed + 3) - 0.5) * Math.min(6, ly / 20);
      const half = p.w / 2 * (0.75 + 0.25 * arc) + ly * 0.03;
      const keep = 1 - clamp((k - 0.62) * 2.2, 0, 1);
      for (let x = Math.max(b.ox, Math.floor(c.X(cx - half - 4))); x < Math.min(b.x1, Math.ceil(c.X(cx + half + 4))); x++) {
        const lx = c.lx(x + 0.5);
        const u = (lx - cx) / half;
        if (Math.abs(u) > 1) {
          // spray and mist round it lower down
          if (k > 0.5 && Math.abs(u) < 1.8 && bayer4(x, y) < (k - 0.5) * 0.5 * (1.8 - Math.abs(u))) b.set(x, y, C[1]!);
          continue;
        }
        if (bayer4(x, y) >= keep + (1 - Math.abs(u)) * 0.1) {
          if (k > 0.55 && bayer4(x + 1, y) < 0.35) b.set(x, y, C[2]!);
          continue;
        }
        const phase = frame >= 0 ? frame * 5 : 0;
        const streak = hash(Math.floor(lx * 0.8), Math.floor((ly - phase) / (5 + 3 * hash(Math.floor(lx * 0.8), 1, seed))), seed) < 0.3;
        let col: number;
        if (u > 0.55) col = C[3]!;
        else if (u < -0.6) col = P.paper[0]!;
        else col = streak ? C[2]! : C[0]!;
        b.set(x, y, col);
      }
    }
    void d;
  },
});
