// Clouds for the sky plane (P0): layered strata, the shanshui way, instead of round cartoon
// puffs. Authored directly in code (Dex: clouds, fog, mist and haze are freestyle
// elements, never traced from generated images), shaped to the composition and the art
// bible.
//
// Every cloud is built from one element, the stratum: a long horizontal band, thick in the
// middle and tapering to streaks at both ends, flat below, with a row of low rounded lobes
// along its top. A stratus is one to four thin strata; a bank is three to five thicker
// strata stacked in a heap, each lower one in front of the one above it.
//
// Light (morning key): sun up and to the left. Lobes are lit on their sunward side (the
// paper ramp's warm cream on the brightest rim), the body is cool white, the creases
// between lobes and the flat underside are blue-grey. Edges are dithered, never smooth
// alpha. `frame` (0..3) churns the end streaks and the rim dither for sprites.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm1, hash, rng, vnoise1 } from "../../raster.ts";

/** Cloud tones, light to dark: warm rim, lit, body, crease, shade, underside. */
const T = (): number[] => [P.paper[0]!, P.cloud[0]!, P.cloud[1]!, P.cloud[2]!, P.cloud[3]!, P.range[1]!];

interface Stratum {
  x0: number;
  x1: number;
  /** Base line (level-1 local y, positive down). */
  y: number;
  /** Thickness at the middle, px. */
  th: number;
  /** Lobe height as a share of the thickness, and lobe width as a multiple of it. */
  lobe: number;
  lobeW: number;
  /** Share of the length over which each end thins into streaks. */
  ends: number;
  seed: number;
}

/** Paints one stratum. Later strata paint over earlier ones (lower strata are nearer). */
function paintStratum(c: PaintCtx, s: Stratum, frame: number): void {
  const b = c.buf, d = c.d;
  const C = T();
  const len = s.x1 - s.x0;
  const maxTop = s.th * (1.25 + s.lobe);
  const Xa = Math.max(b.ox, Math.floor(c.X(s.x0))), Xb = Math.min(b.x1, Math.ceil(c.X(s.x1)));
  const Ya = Math.max(b.oy, Math.floor(c.Y(s.y - maxTop))), Yb = Math.min(b.y1, Math.ceil(c.Y(s.y + 1.5)));
  if (Xa >= Xb || Ya >= Yb) return;
  const px = 1 / d;
  for (let x = Xa; x < Xb; x++) {
    const lx = c.lx(x + 0.5);
    const t = (lx - s.x0) / len;
    // the band: a lens, thick in the middle, wandering in thickness
    const body = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.55) * (0.75 + 0.4 * fbm1(lx / (s.th * 7), s.seed, 3));
    // lobes along the top: rounded, of varying size, sharp creases between them
    const period = Math.max(4, s.th * s.lobeW * (0.75 + 0.5 * vnoise1(lx / (s.th * 9), s.seed + 2)));
    const ph = lx / period + 0.8 * fbm1(lx / (s.th * 5), s.seed + 3, 2);
    const cell = Math.floor(ph);
    const f = ph - cell - 0.5;
    const crest = Math.sqrt(Math.max(0, 1 - 4 * f * f));
    const lump = s.th * s.lobe * crest * (0.5 + 0.5 * hash(cell, 1, s.seed)) * body;
    const top = s.th * body + lump;
    const end = Math.min(t, 1 - t) / Math.max(1e-3, s.ends);
    const base = s.y + 0.5 * (vnoise1(lx / 19, s.seed + 1) - 0.5);
    for (let y = Ya; y < Yb; y++) {
      const ly = c.ly(y + 0.5);
      const up = base - ly;
      if (up < 0 || up > top) continue;
      // the ends break into streaks: alternate rows drop out, then a dither fade
      if (end < 1) {
        if (end < 0.55 && ((y + (frame & 1)) & 1)) continue;
        if (bayer4(x + frame, y) > end * 1.3) continue;
      }
      const down = top - up;
      let k: number;
      if (down < 1.1 * px) {
        // the rim: warm on the sunward half of each lobe, near the cloud's lit end
        if (f < 0.15) k = t < 0.6 ? 0 : 1;
        else k = 2;
        // a thinner rim where the lobe turns away: churns with the frame
        if (f > 0.3 && bayer4(x + frame, y + (frame >> 1)) < 0.5) continue;
      } else if (f < -0.1 && down < Math.max(px, lump * 0.55)) k = 1;
      else if (f > 0.32 && down < Math.max(px, lump * 0.9)) k = 3;
      else if (up < 1.1 * px) k = 5;
      else if (up < s.th * 0.28) k = 4;
      else if (up < s.th * 0.5) k = 3;
      else k = 2;
      b.set(x, y, C[k]!);
    }
  }
}

// ---------------------------------------------------------------------------
// A cloud bank: three to five strata stacked into a heap, the highest left of centre.
// ---------------------------------------------------------------------------
export interface BankP {
  /** Width, level-1 px; the anchor is the left end of the bottom stratum's base. */
  w: number;
  /** Height of the heap, px. */
  h: number;
  /** Where the heap peaks along the width, 0..1 (default 0.4). */
  peak?: number;
  /** Strata in the heap (3 to 5, default 4). */
  tiers?: number;
  /** Sprite frame for the churn (0..3). */
  frame?: number;
}

function strataOf(p: BankP, seed: number): Stratum[] {
  const r = rng(seed);
  const n = Math.max(3, Math.min(5, p.tiers ?? 4));
  const peak = p.peak ?? 0.4;
  const out: Stratum[] = [];
  let y = 0;
  const th0 = p.h / (1 + (n - 1) * 0.62) * 0.95;
  for (let j = 0; j < n; j++) {
    // higher strata are shorter and gather over the peak
    const share = j === 0 ? 1 : Math.max(0.18, 1 - j * (0.22 + 0.08 * r()));
    const mid = j === 0 ? 0.5 : peak + (r() - 0.5) * 0.12;
    const half = (share * p.w) / 2;
    const x0 = clamp(mid * p.w - half, -p.w * 0.05, p.w);
    const x1 = clamp(mid * p.w + half, 0, p.w * 1.05);
    const th = th0 * (j === 0 ? 0.8 : 0.9 + 0.25 * r());
    out.push({ x0, x1, y, th, lobe: j === 0 ? 0.3 : 0.5, lobeW: 1.1 + 0.6 * r(), ends: j === 0 ? 0.22 : 0.3, seed: seed + j * 37 });
    y -= th * (0.58 + 0.1 * r());
  }
  // a stray thin stratum trailing off the lit side
  out.push({ x0: -p.w * 0.12, x1: p.w * 0.35, y: -th0 * 0.25, th: th0 * 0.35, lobe: 0.2, lobeW: 2, ends: 0.4, seed: seed + 991 });
  // paint from the top (farthest back) down
  return out.reverse();
}

export const bank = definePainter<BankP>("sky.bank", {
  bounds(p) {
    return [-p.w * 0.14, -p.h * 1.45, p.w * 1.08, 3];
  },
  paint(c, p) {
    const frame = (p.frame ?? 0) & 3;
    for (const s of strataOf(p, c.seed)) paintStratum(c, s, frame);
  },
});

// ---------------------------------------------------------------------------
// Stratus: one to four long thin strata, the farther ones above, shorter and thinner.
// ---------------------------------------------------------------------------
export interface StratusP {
  /** Width, level-1 px; the anchor is the left end of the lowest ribbon's base. */
  w: number;
  /** Thickness of the main ribbon, px. */
  h: number;
  /** Ribbons in the layer (1 to 4, default 2). */
  layers?: number;
  frame?: number;
}

export const stratus = definePainter<StratusP>("sky.stratus", {
  bounds(p) {
    const n = Math.max(1, Math.min(4, p.layers ?? 2));
    return [-4, -p.h * 1.5 - (n - 1) * p.h * 1.5, p.w + 4, 3];
  },
  paint(c, p) {
    const n = Math.max(1, Math.min(4, p.layers ?? 2));
    const r = rng(c.seed + 5);
    const frame = (p.frame ?? 0) & 3;
    for (let i = n - 1; i >= 0; i--) {
      const x0 = i === 0 ? 0 : p.w * (0.05 + 0.45 * r());
      const x1 = i === 0 ? p.w : Math.min(p.w, x0 + p.w * (0.3 + 0.4 * r()));
      const th = i === 0 ? p.h : p.h * (0.45 + 0.3 * r());
      paintStratum(c, { x0, x1, y: -i * p.h * 1.4 + (r() - 0.5) * p.h * 0.4, th, lobe: 0.25, lobeW: 2.2, ends: 0.22, seed: c.seed + i * 19 }, frame);
    }
  },
});
