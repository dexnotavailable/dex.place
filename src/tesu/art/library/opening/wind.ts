// Things the wind moves, as animated sprites (art bible 6: foliage and cloth sway at 6 fps over
// a 4-frame loop, 1 to 2 px; nothing in wind is ever frozen).
//
// - op.reeds: a bed of reeds and cattails at the waterline. Each blade bends from its foot (no
//   motion at the root, most at the tip), each with its own phase, so a gust runs through the
//   bed instead of the whole bed rocking as one; seed heads trail a frame behind their stems.
// - op.flags: prayer flags strung from a pole: the line sags, the flags (paper, blue, the odd
//   red) hang from it and lift and swing with the wind, the far ones later than the near ones.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { clamp, hash1, tone } from "../../raster.ts";
import { dot } from "./bank.ts";

export interface ReedsP {
  /** Width of the bed, px; anchor at the waterline at its left end. */
  w: number;
  /** Tallest blade, px. */
  h: number;
  /** Blades per 10 px (default 3). */
  density?: number;
  /** The bed's place along the shore, px (so a gust runs on from bed to bed: phase by it). */
  ox?: number;
  /** Ground under the bed every 8 px, px above the anchor (the reeds stand on it). */
  ground?: number[];
  /** Frames in the loop (default 4). */
  loop?: number;
  frame?: number;
}

export const reeds = definePainter<ReedsP>("op.reeds", {
  bounds(p) {
    let g = 0;
    for (const v of p.ground ?? []) g = Math.max(g, v);
    // (a leaf arches out up to a third of the tallest reed's height)
    return [-8 - p.h * 0.32, -p.h - g - 8, p.w + 10 + p.h * 0.32, 4];
  },
  paint(c, p) {
    const d = c.d, seed = c.seed;
    const f = p.frame ?? 0;
    const loop = p.loop ?? 4;
    const ox = p.ox ?? 0;
    const groundAt = (x: number): number => {
      const g = p.ground;
      if (!g || !g.length) return 0;
      const k = clamp(x / 8, 0, g.length - 1), i = Math.floor(k), fr = k - i;
      return (g[i] ?? 0) * (1 - fr) + (g[Math.min(g.length - 1, i + 1)] ?? 0) * fr;
    };
    const n = Math.round((p.w / 10) * (p.density ?? 3));
    // one density at the close band: whole level-1 px there, as before below it
    const put = (lx: number, ly: number, col: number): void => {
      if (d > 1) dot(c, lx, ly, col);
      else c.buf.set(Math.round(c.X(lx)), Math.round(c.Y(ly)), col);
    };
    for (let i = 0; i < n; i++) {
      const x0 = hash1(i, seed) * p.w;
      // the bed is fuller in the middle
      const mid = Math.sin(Math.PI * clamp(x0 / p.w, 0.05, 0.95));
      const hh = p.h * (0.3 + 0.7 * hash1(i, seed + 1)) * (0.45 + 0.55 * mid);
      const lean = (hash1(i, seed + 2) - 0.4) * 0.25;
      // sway: the gust passes from left to right (phase by x), amplitude grows with height
      // the gust runs along the shore: phase by the blade's place on the whole bank, so stands
      // bend one after another; each blade a little early or late
      const ph = (f / loop) * Math.PI * 2 - (ox + x0) / 55 + hash1(i, seed + 3) * 0.9;
      const sway = (Math.sin(ph) * 0.8 + Math.sin(ph * 2 + 1) * 0.2) * Math.min(2.4, hh / 16);
      const g0 = groundAt(x0);
      const dark = hash1(i, seed + 4) < 0.5;
      for (let s = 0; s < hh; s += 0.5 / d) {
        const u = s / hh;
        const lx = x0 + lean * s + sway * u * u, ly = 2 - g0 - s;
        put(lx, ly, u > 0.8 ? P.moss[3]! : u > 0.45 ? P.moss[dark ? 5 : 4]! : P.moss[dark ? 6 : 5]!);
        if (d >= 1 && u < 0.35) put(lx + 1 / Math.min(d, 1), ly, P.moss[6]!);
      }
      // a cattail on some, trailing its stem's sway a little
      if (hash1(i, seed + 5) < 0.18 && hh > p.h * 0.55) {
        const lag = (Math.sin(ph - 0.6) * 0.8 + Math.sin(ph * 2 - 0.2) * 0.2) * Math.min(2.4, hh / 16);
        for (let s = hh * 0.74; s < hh * 0.92; s += 0.5 / d) {
          const u = s / hh;
          const lx = x0 + lean * s + lag * u * u, ly = 2 - g0 - s;
          put(lx, ly, P.timber[4]!);
          put(lx + 1 / Math.min(d, 1), ly, P.timber[5]!);
        }
      }
      // the odd leaf blade arching out from the stem
      if (hash1(i, seed + 6) < 0.3 && d >= 0.5) {
        const at = hh * (0.3 + 0.3 * hash1(i, seed + 7));
        const dir = hash1(i, seed + 8) < 0.5 ? -1 : 1;
        for (let s = 0; s < hh * 0.35; s += 0.5 / d) {
          const k = s / (hh * 0.35);
          put(x0 + lean * at + dir * s * 0.8 + sway * 0.5 * k, 2 - g0 - at - s * 0.6 + k * k * hh * 0.18, P.moss[4]!);
        }
      }
    }
  },
});

export interface FlagsP {
  /** Pole height and the line's run to its far end (dx, dy), px; anchor at the pole's foot. */
  h: number;
  dx: number;
  dy: number;
  /** Number of flags along the line. */
  n?: number;
  frame?: number;
}

export const flags = definePainter<FlagsP>("op.flags", {
  bounds(p) {
    return [Math.min(0, p.dx) - 14, -p.h - 8, Math.max(0, p.dx) + 14, Math.max(0, -p.h + p.dy) + 40];
  },
  paint(c, p) {
    const d = c.d, seed = c.seed;
    const f = p.frame ?? 0;
    // the pole: a bamboo cane with nodes, its foot lashed to the plank
    for (let ly = 0; ly > -p.h; ly -= 0.5 / d) {
      const node = Math.abs(((-ly / 22) % 1) - 0.5) > 0.46;
      for (let o = -1.5; o <= 1.5; o += 0.5 / d) c.buf.set(Math.round(c.X(o)), Math.round(c.Y(ly)), node ? P.bamboo[4]! : o < -0.5 ? P.bamboo[1]! : o < 0.6 ? P.bamboo[2]! : P.bamboo[3]!);
    }
    const n = p.n ?? 9;
    const at = (t: number): [number, number] => [p.dx * t, -p.h + p.dy * t + Math.sin(t * Math.PI) * Math.abs(p.dx) * 0.08];
    for (let lt = 0; lt <= 1; lt += 0.4 / Math.max(1, Math.hypot(p.dx, p.dy) * d)) {
      const [x, y] = at(lt);
      c.buf.set(Math.round(c.X(x)), Math.round(c.Y(y)), P.earth[3]!);
    }
    const cols = [P.paper, P.blue, P.paper, P.moss, P.paper, P.red, P.blue, P.paper, P.gold];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.6) / (n + 0.4);
      const [fx, fy] = at(t);
      const ramp = cols[(i + Math.floor(hash1(1, seed) * 9)) % cols.length]!;
      // each flag lifts and swings in the wind, the far ones a little later
      const ph = (f / 4) * Math.PI * 2 - i * 0.7;
      const lift = 0.35 + 0.25 * Math.sin(ph);
      const fw = 9, fh = 14;
      for (let v = 0; v < fh; v += 0.5 / d) {
        const k = v / fh;
        const off = lift * k * fh * 0.9;
        for (let u = 0; u < fw; u += 0.5 / d) {
          const X = Math.round(c.X(fx - fw / 2 + u + off)), Y = Math.round(c.Y(fy + 1 + v * (1 - lift * 0.5)));
          const uu = u / fw;
          // a ragged hem at the bottom
          if (k > 0.85 && hash1(Math.floor(u), seed + i) < 0.4) continue;
          c.buf.set(X, Y, tone(ramp, uu < 0.3 ? 0.1 : uu < 0.75 ? 0.3 : 0.55, X, Y, 0.3));
        }
      }
    }
  },
});
