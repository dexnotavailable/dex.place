// Things the wind moves, as animated sprites (art bible 6: foliage and cloth sway at 6 fps over
// a 4-frame loop, 1 to 2 px; nothing in wind is ever frozen).
//
// - op.reeds: a bed of reeds and cattails at the waterline. Stems grow in clumps with gaps between
//   them, each bed its own heights and density (one or two tall places, low at its ends); among the
//   green leaves stand cattails with their brown heads, plumed reeds with a drooping seed head, a
//   stem bent over at a kink, a broken one with its top hanging, the odd dry straw stem from last
//   year. Each bends from its foot (no motion at the root, most at the tip), each with its own
//   phase, so a gust runs through the bed instead of the whole bed rocking as one; seed heads trail
//   a frame behind their stems, broken stems barely move. On a plane the lake does not mirror it
//   paints its own reflection (`refl`), swaying with it.
// - op.flags: prayer flags strung from a pole: the line sags, the flags (paper, blue, the odd
//   red) hang from it and lift and swing with the wind, the far ones later than the near ones.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { clamp, hash1, rng, tone } from "../../raster.ts";
import { dot, reflectionPen } from "./bank.ts";

export interface ReedsP {
  /** Width of the bed, px; anchor at the waterline at its left end. */
  w: number;
  /** Tallest blade, px. */
  h: number;
  /** Stems per 10 px (default 3). */
  density?: number;
  /** The bed's place along the shore, px (so a gust runs on from bed to bed: phase by it). */
  ox?: number;
  /** Ground under the bed every 8 px, px above the anchor (the reeds stand on it). */
  ground?: number[];
  /** Frames in the loop (default 4). */
  loop?: number;
  frame?: number;
  /** Paint its own reflection under the anchor (for a plane the lake does not mirror): its plane's
   *  ink, 0..1 (unset: no reflection). */
  refl?: number;
}

type StemKind = "leaf" | "cattail" | "plume" | "bent" | "broken" | "straw";

/** Green stems lit to dark, and last year's straw. */
const STEM = [P.moss[2]!, P.moss[3]!, P.moss[4]!, P.moss[5]!, P.moss[6]!, P.pine[3]!];
const STRAW = [P.paper[2]!, P.earth[1]!, P.earth[2]!, P.earth[3]!, P.umber[1]!];

export const reeds = definePainter<ReedsP>("op.reeds", {
  bounds(p) {
    let g = 0;
    for (const v of p.ground ?? []) g = Math.max(g, v);
    // (a leaf arches out up to a third of the tallest reed's height; a reflection hangs under it)
    return [-8 - p.h * 0.36, -p.h - g - 10, p.w + 10 + p.h * 0.36, p.refl !== undefined ? (p.h + g) * 0.95 + 8 : 4];
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
    // (round 7) at the close band a stem keeps its play-zoom width (two art px), placed on the level's
    // own px (no longer on whole level-1 cells: one pixel density with the jetty beside it)
    const put = (lx: number, ly: number, col: number): void => {
      if (d > 1.5) { dot(c, lx - 0.25, ly, col); dot(c, lx + 0.25, ly, col); }
      else if (d > 1) dot(c, lx, ly, col);
      else c.buf.set(Math.round(c.X(lx)), Math.round(c.Y(ly)), col);
    };
    const mir = p.refl !== undefined ? reflectionPen(c, 1, p.h * 0.85, seed + 5, p.refl) : null;
    const pen = (lx: number, ly: number, col: number): void => {
      put(lx, ly, col);
      if (mir) mir(lx, ly, col);
    };
    const step = 0.5 / Math.max(d, 0.25);

    // the bed's layout (the same on every frame): clumps of stems with gaps between them, its own
    // tall places, low at its ends
    const r = rng(seed + 17);
    const dens = p.density ?? 3;
    const pk1 = 0.2 + 0.6 * r(), pk2 = r(), w2 = 0.5 + 0.4 * r();
    const stems: { x: number; hh: number; kind: StemKind; back: boolean; i: number }[] = [];
    let x = r() * 4, i = 0;
    while (x < p.w) {
      const cw = 4 + r() * 15;
      const u = clamp((x + cw / 2) / p.w, 0, 1);
      const prof = (0.45 + 0.55 * Math.max(Math.exp(-(((u - pk1) / 0.3) ** 2)), w2 * Math.exp(-(((u - pk2) / 0.2) ** 2)))) * (0.6 + 0.4 * Math.sin(Math.PI * clamp(u, 0.04, 0.96)));
      const hf = prof * (0.72 + 0.4 * r());
      const ns = Math.max(1, Math.round((cw / 10) * dens * (0.7 + 1.1 * r())));
      for (let k = 0; k < ns; k++, i++) {
        const sx = x + cw * (0.5 + (r() - 0.5) * (r() + 0.3));
        const kr = r();
        const tall = r();
        const kind: StemKind = kr < 0.1 ? "cattail" : kr < 0.2 ? "plume" : kr < 0.29 ? "bent" : kr < 0.36 ? "broken" : kr < 0.44 ? "straw" : "leaf";
        stems.push({ x: sx, hh: Math.min(1, hf * (0.5 + 0.55 * tall)) * p.h, kind, back: r() < 0.5, i });
      }
      // gaps of very different widths; now and then two clumps touch
      x += cw + (r() < 0.22 ? 0 : 2 + r() * r() * 30 * (3 / dens));
    }
    stems.sort((a, b) => Number(b.back) - Number(a.back));

    for (const sm of stems) {
      const { x: x0, hh, kind, back, i: si } = sm;
      if (hh < 3) continue;
      const lean = (hash1(si, seed + 2) - 0.4) * 0.25;
      // the gust runs along the shore: phase by the stem's place on the whole bank, each a little
      // early or late; a broken stem barely moves
      const ph = (f / loop) * Math.PI * 2 - (ox + x0) / 55 + hash1(si, seed + 3) * 0.9;
      const amp = Math.min(2.4, hh / 16) * (kind === "broken" ? 0.25 : 1);
      const sway = (Math.sin(ph) * 0.8 + Math.sin(ph * 2 + 1) * 0.2) * amp;
      const lag = (Math.sin(ph - 0.6) * 0.8 + Math.sin(ph * 2 - 0.2) * 0.2) * amp;
      const g0 = groundAt(x0);
      const y0 = 2 - g0;
      const dk = back ? 1 : 0;
      const at = (s: number, sw: number): [number, number] => [x0 + lean * s + sw * (s / hh) * (s / hh), y0 - s];
      const green = (u: number): number => STEM[Math.min(5, (u > 0.8 ? 1 : u > 0.45 ? 2 : u > 0.18 ? 3 : 4) + dk)]!;
      const straw = (u: number): number => STRAW[Math.min(4, (u > 0.6 ? 1 : u > 0.25 ? 2 : 3) + dk)]!;
      if (kind === "leaf") {
        // a flat leaf: up, then bowing over to one side, its tip drooping
        const side = hash1(si, seed + 6) < 0.5 ? -1 : 1;
        const bend = side * (0.5 + 1.1 * hash1(si, seed + 7));
        let px = x0, py = y0, a = lean;
        const n = Math.ceil(hh / step);
        for (let k = 0; k <= n; k++) {
          const u = k / n;
          a = lean + bend * u * u;
          px += Math.sin(a) * step;
          py -= Math.cos(a) * step;
          pen(px + sway * u * u, py, green(u));
          if (u < 0.3 && hh > 30 && d >= 0.5) pen(px + sway * u * u + 0.6, py, green(u + 0.2));
        }
        continue;
      }
      if (kind === "bent") {
        // a stem kinked part way up, its top leaning over
        const kh = hh * (0.5 + 0.25 * hash1(si, seed + 8));
        for (let s = 0; s < kh; s += step) { const [lx, ly] = at(s, sway); pen(lx, ly, green(s / hh)); }
        const [kx, ky] = at(kh, sway);
        const a = (hash1(si, seed + 9) < 0.5 ? -1 : 1) * (0.9 + 0.7 * hash1(si, seed + 10));
        const L = (hh - kh) * 0.85;
        for (let s = 0; s < L; s += step) pen(kx + Math.sin(a) * s + lag * 0.5 * (s / L), ky - Math.cos(a) * s + 0.02 * s * s, s / L > 0.6 ? STRAW[1 + dk]! : green(0.6));
        continue;
      }
      if (kind === "broken") {
        // snapped part way up: a ragged top, the broken piece hanging down beside it
        const bh = hh * (0.4 + 0.2 * hash1(si, seed + 11));
        for (let s = 0; s < bh; s += step) { const [lx, ly] = at(s, sway); pen(lx, ly, s > bh - 2 ? STRAW[2]! : green(s / hh)); }
        const [tx, ty] = at(bh, sway);
        const a = Math.PI - (hash1(si, seed + 12) < 0.5 ? -1 : 1) * (0.25 + 0.35 * hash1(si, seed + 13));
        const L = 4 + hh * 0.18 * hash1(si, seed + 14);
        for (let s = 0; s < L; s += step) pen(tx + Math.sin(a) * s, ty - Math.cos(a) * s, s < 1 ? STRAW[1]! : STRAW[2 + dk]!);
        continue;
      }
      // a straight stem (green, or last year's straw)
      const col = kind === "straw" ? straw : green;
      for (let s = 0; s < hh; s += step) {
        const [lx, ly] = at(s, sway);
        pen(lx, ly, col(s / hh));
        if (d >= 1 && s < hh * 0.3 && hh > 40) pen(lx + 1 / Math.min(d, 1), ly, kind === "straw" ? STRAW[3]! : STEM[4]!);
      }
      if (kind === "cattail") {
        // its brown head trailing the stem's sway, a thin spike above it
        for (let s = hh * 0.7; s < hh * 0.88; s += step) {
          const [lx, ly] = at(s, lag);
          pen(lx, ly, P.timber[3]!);
          pen(lx + 1 / Math.max(1, d), ly, s < hh * 0.74 || s > hh * 0.85 ? P.umber[1]! : P.timber[4]!);
        }
      } else if (kind === "plume") {
        // a plumed seed head drooping to its lean side, pale where the sun catches it
        const side = lean >= 0 ? 1 : -1;
        const [tx, ty] = at(hh, lag);
        const L = 5 + hh * 0.08;
        for (let s = 0; s < L; s += step) {
          const u = s / L;
          const lx = tx + side * s * 0.7, ly = ty + u * u * L * 0.6;
          pen(lx, ly, u < 0.5 ? P.paper[3]! : P.earth[2]!);
          if (u > 0.2 && u < 0.85 && d >= 0.5) pen(lx - side * 0.5, ly + 1, u < 0.5 ? P.earth[1]! : P.earth[3]!);
        }
      }
      // the odd leaf arching out from low on the stem
      if (hash1(si, seed + 6) < 0.32 && d >= 0.5) {
        const at0 = hh * (0.18 + 0.3 * hash1(si, seed + 15));
        const dir = hash1(si, seed + 8) < 0.5 ? -1 : 1;
        const L = hh * (0.25 + 0.15 * hash1(si, seed + 16));
        for (let s = 0; s < L; s += step) {
          const k = s / L;
          pen(x0 + lean * at0 + dir * s * 0.8 + sway * 0.5 * k, y0 - at0 - s * 0.6 + k * k * L * 0.55, k > 0.6 ? STEM[2 + dk]! : STEM[3 + dk]!);
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
