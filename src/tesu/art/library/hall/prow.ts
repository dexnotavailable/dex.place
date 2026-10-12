// The Prize Court's edges: the Prow Stair's last run up through the rock and the court's
// foundation to its mouth (with the grate across the mouth), and at the tip the Prow Leap with
// its prayer flags in the wind. Daylight from the upper left.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { M, clamp, cyl, face, fbm, grain, lathe, mt, rect, tn } from "./kit.ts";

const H = 96;
const SIDE = -1;

// ---------------------------------------------------------------------------
// The stair's last run (play): a recess cut along the stair, lined in ashlar where it passes the
// masonry, rough rock below; treads with lit noses; lanterns from its ceiling; the grate across
// the mouth with the stair's light showing between its slats
// ---------------------------------------------------------------------------
export interface StairRunP {
  /** The stair's line (local px): from its lower end at the anchor up to the mouth (x1, y1). */
  x1: number;
  y1: number;
  /** The recess's height above the treads (px); where the foundation's masonry starts (local y). */
  head: number;
  masonry: number;
  /** The grate across the mouth: local x range. */
  grate: [number, number];
}

export const stairRun = definePainter<StairRunP>("court.stairrun", {
  bounds(p) {
    return [-4, p.y1 - p.head - 10, Math.max(p.x1, p.grate[1]) + 6, 16];
  },
  paint(c, p) {
    const slope = p.y1 / p.x1;
    const yAt = (lx: number): number => lx * slope;
    rect(c, 0, p.y1 - p.head - 4, p.x1, 14, (X, Y, lx, ly) => {
      const ty = yAt(lx);
      const top = ty - p.head;
      if (ly < top - 3 || ly > ty + 12) return 0;
      const inMasonry = ly < p.masonry;
      if (ly < top) return mt(M.stone, face(0.95, SIDE, 0, -0.8) * (inMasonry ? 1.0 : 0.85), X, Y, 0.1, 1);
      if (ly > ty) {
        const k = ((lx % 15) + 15) % 15;
        const nose = ly - ty < 2.5;
        return mt(M.stone, nose ? 0.95 : 0.55 - (k < 2 ? 0.1 : 0) - (ly - ty) * 0.02, X, Y, 0.1, 1);
      }
      const v = (ly - top) / p.head;
      const glow = 0.2 + 0.45 * v;
      if (inMasonry) {
        const course = Math.floor((ly - p.masonry) / 18);
        const joint = (((ly % 18) + 18) % 18) < 1.2 || ((((lx + (course % 2) * 26) % 52) + 52) % 52) < 1.2;
        return mt(M.stone, glow * (joint ? 0.6 : 0.85), X, Y, 0.35, 1);
      }
      const n = fbm(lx * 0.06, ly * 0.06, 13, 3);
      return mt(M.stone, glow * (0.7 + (n - 0.5) * 0.5), X, Y, 0.4, 1);
    });
    for (let lx = 70; lx < p.x1 - 40; lx += 210) {
      const cy = yAt(lx) - p.head + 4;
      rect(c, lx - 0.5, cy, lx + 0.5, cy + 14, (X, Y) => tn(M.dark, 0.6, X, Y, 0));
      rect(c, lx - 7, cy + 14, lx + 7, cy + 32, (X, Y, x, y) => {
        const q = Math.hypot((x - lx) / 7, (y - cy - 23) / 9);
        return q > 1 ? 0 : tn(M.glow, clamp(q * 0.6, 0, 1), X, Y, 0.5);
      });
    }
    const [g0, g1] = p.grate;
    rect(c, g0, p.y1 - 2, g1, p.y1 + 9, (X, Y, lx, ly) => {
      const k = (((lx - g0) % 12) + 12) % 12;
      const strap = Math.abs(lx - g0 - (g1 - g0) * 0.25) < 1.5 || Math.abs(lx - g0 - (g1 - g0) * 0.75) < 1.5;
      if (strap) return tn(M.dark, 0.5, X, Y, 0);
      if (k < 2) return ly > p.y1 + 1 ? tn(M.glow, 0.45, X, Y, 0) : 0;
      return mt(M.wood, face(0.92, SIDE, 0, ly < p.y1 ? -0.8 : 0.3) * 0.9 + grain(lx, ly, 3, false) * 0.08, X, Y, 0.1, 1);
    });
  },
});

// ---------------------------------------------------------------------------
// The Prow Leap: a weathered plank out past the rail on two brackets braced to the foundation
// ---------------------------------------------------------------------------
export const leap = definePainter<{ w: number }>("court.leap", {
  bounds(p) {
    return [-0.6 * H, -6, p.w + 6, 0.9 * H];
  },
  paint(c, p) {
    rect(c, 0, -2, p.w, 8, (X, Y, lx, ly) => {
      const end = lx > p.w - 4;
      const k = ((lx % 58) + 58) % 58;
      return mt(M.wood, face(0.92, SIDE, end ? 0.8 : 0, ly < 0 ? -0.9 : 0.3) * (k < 1.2 ? 0.6 : 0.95) + grain(lx, ly, 9, false) * 0.12 - (lx / p.w) * 0.1, X, Y, 0.0, 1);
    });
    for (const bx of [p.w * 0.18, p.w * 0.46]) {
      for (let t = 0; t < 1; t += 0.02) {
        const x = bx - t * 0.45 * H, y = 8 + t * 0.7 * H;
        rect(c, x - 2.5, y - 2, x + 2.5, y + 2, (X, Y) => mt(M.wood, face(0.9, SIDE, -0.4, 0) * 0.7, X, Y, 0.2, 1));
      }
      rect(c, bx - 4, 7, bx + 4, 12, (X, Y) => tn(M.paper, 0.45, X, Y, 0.2));
    }
  },
});

/** Prayer flags on a line from a pole at the leap's root out over the drop (a sprite: 8 frames). */
export const flags = definePainter<{ w: number; h: number; n: number; frame?: number }>("court.flags", {
  bounds(p) {
    return [-6, -p.h - 8, p.w + 12, 4];
  },
  paint(c, p) {
    const f = (p.frame ?? 0) % 8;
    const ph = (f / 8) * Math.PI * 2;
    lathe(c, 0, -p.h, 0, () => 2.2, (X, Y, u) => mt(M.wood, cyl(0.92, u, SIDE, 0.2), X, Y, 0.1, 1));
    const y0 = -p.h + 4, y1 = -0.35 * H;
    const cols = [M.verm, P.blue, M.paper, P.moss, P.gold];
    const n = Math.ceil(p.w * c.d);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = t * p.w, y = y0 + (y1 - y0) * t + 10 * Math.sin(t * Math.PI);
      c.buf.set(Math.round(c.X(x)), Math.round(c.Y(y)), P.umber[3]!);
    }
    for (let k = 0; k < p.n; k++) {
      const t = (k + 0.6) / (p.n + 0.4);
      const x = t * p.w, y = y0 + (y1 - y0) * t + 10 * Math.sin(t * Math.PI);
      const ramp = cols[k % cols.length]!;
      rect(c, x - 4, y, x + 8, y + 14, (X, Y, lx, ly) => {
        const v = (ly - y) / 14;
        const wave = Math.sin(v * 4 - ph + k) * 2 * v;
        const u = lx - x - wave;
        if (u < -3 || u > 6 || v > 1 - Math.max(0, u) * 0.03) return 0;
        return mt(ramp, 0.85 - Math.cos(v * 4 - ph + k) * 0.12, X, Y, 0.1, 0.8);
      });
    }
  },
});
