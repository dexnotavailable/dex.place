// Distance: far snow ranges (P1), karst towers (P2), pine ridges (P3) and cloud banks (P0).
// Painted at full contrast; the plane shader fades them toward the band's haze, so each
// farther plane is paler with the same ramps.

import { definePainter } from "../painter.ts";
import { P } from "../palette.ts";
import { bayer4, clamp, fbm1, hash, hash1, rng, tone, vnoise, vnoise1 } from "../raster.ts";

// ---------------------------------------------------------------------------
// Far ranges: a ridge line of peaks, lit flanks facing the morning sun (upper left),
// shadowed flanks, gullies, and snow above a ragged line.
// ---------------------------------------------------------------------------
export interface RangeP {
  /** Width, level-1 px; the anchor is the left end of the base line. */
  w: number;
  /** Tallest peak, px above the base. */
  h: number;
  /** Peaks across the width. */
  peaks?: number;
  /** Snow line as a share of the tallest peak (1 = none). */
  snow?: number;
  /** Ramp: "range" (blue-grey, far) or "karst" (pale, nearer). */
  ramp?: "range" | "karst";
}

interface Peak { cx: number; hw: number; h: number }

function peaksOf(p: RangeP, seed: number): Peak[] {
  const r = rng(seed);
  const n = p.peaks ?? Math.max(2, Math.round(p.w / 260));
  const out: Peak[] = [];
  for (let i = 0; i < n; i++) {
    const cx = ((i + 0.2 + 0.6 * r()) / n) * p.w;
    const hh = p.h * (0.45 + 0.55 * r()) * (i === Math.floor(n / 2) ? 1 : 0.85);
    out.push({ cx, hw: hh * (1.3 + r() * 0.9), h: hh });
  }
  return out;
}

function ridge(peaks: Peak[], x: number, seed: number): { y: number; pk: Peak | null } {
  let best = 0, pk: Peak | null = null;
  for (const q of peaks) {
    const t = 1 - Math.abs(x - q.cx) / q.hw;
    if (t <= 0) continue;
    const v = q.h * Math.pow(t, 1.25) * (0.92 + 0.16 * fbm1(x / 37, seed + q.cx, 3));
    if (v > best) { best = v; pk = q; }
  }
  // a low saddle so the range never breaks to the base between peaks
  const floor = 0.08 * (peaks[0]?.h ?? 0) * (0.6 + 0.8 * fbm1(x / 90, seed + 5, 2));
  return { y: Math.max(best, floor), pk };
}

export const range = definePainter<RangeP>("range", {
  bounds(p) {
    return [-2, -p.h - 4, p.w + 2, 2];
  },
  paint(c, p) {
    const b = c.buf, d = c.d;
    const peaks = peaksOf(p, c.seed);
    const snowAt = (p.snow ?? 0.62) * p.h;
    const body = p.ramp === "karst" ? P.karst : P.range;
    const x0 = Math.max(b.ox, Math.floor(c.X(0))), x1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
    for (let x = x0; x < x1; x++) {
      const lx = c.lx(x + 0.5);
      const { y: hh, pk } = ridge(peaks, lx, c.seed);
      const { y: hl } = ridge(peaks, lx - 1 / d, c.seed);
      const { y: hr } = ridge(peaks, lx + 1 / d, c.seed);
      const slope = (hr - hl) / 2; // + means rising to the right: a left-facing, lit flank
      const lit = pk ? (lx < pk.cx ? 1 : 0) : slope > 0 ? 1 : 0;
      const topY = Math.ceil(c.Y(-hh));
      const baseY = Math.floor(c.Y(0));
      for (let y = Math.max(topY, b.oy); y < Math.min(baseY, b.y1); y++) {
        const ly = c.ly(y + 0.5);
        const above = -ly; // px above the base
        const fromTop = hh - above;
        // gullies: thin darker streaks running down the flanks
        const gully = vnoise(lx / 7, above / 60, c.seed + 11);
        const snowLine = snowAt + (vnoise1(lx / 23, c.seed + 3) - 0.5) * p.h * 0.18 - gully * 14;
        const outline = y === topY;
        if (above > snowLine && p.snow !== 1) {
          let t = lit ? 0.05 + 0.25 * (gully > 0.62 ? 1 : 0) : 0.55 + 0.2 * (gully > 0.6 ? 1 : 0);
          if (outline) t = lit ? 0 : 0.35;
          b.set(x, y, tone(P.snow, t, x, y, 0.4));
          continue;
        }
        let t = lit ? 0.18 + 0.18 * (fromTop / p.h) : 0.55 + 0.15 * (fromTop / p.h);
        if (gully > 0.64) t += lit ? 0.18 : 0.12;
        t += (bayer4(x, y) - 0.5) * 0.06;
        // the foot of the range dissolves toward the base (mist sits there)
        if (above < p.h * 0.12) t -= 0.25 * (1 - above / (p.h * 0.12));
        if (outline) t = lit ? 0.1 : 0.5;
        b.set(x, y, tone(body, clamp(t, 0, 1), x, y, 0.6));
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Karst towers (Guilin, Zhangjiajie): steep rounded columns with green crowns and ledges.
// ---------------------------------------------------------------------------
export interface TowersP {
  /** Towers: [x (centre), width, height] in level-1 px from the anchor; base at y 0. */
  t: [number, number, number][];
  /** Green on the crowns and ledges, 0..1. */
  green?: number;
}

export const towers = definePainter<TowersP>("towers", {
  bounds(p) {
    let x0 = Infinity, x1 = -Infinity, y0 = 0;
    for (const [x, w, h] of p.t) {
      x0 = Math.min(x0, x - w); x1 = Math.max(x1, x + w); y0 = Math.min(y0, -h);
    }
    return [x0 - 4, y0 - 8, x1 + 4, 4];
  },
  paint(c, p) {
    const b = c.buf, d = c.d;
    const green = p.green ?? 0.7;
    p.t.forEach(([cx, w, h], i) => {
      const seed = c.seed + i * 977;
      const half = w / 2;
      // width profile: straight sides, a rounded crown, a little waist and bulge
      const hwAt = (above: number): number => {
        const u = above / h;
        const crown = u > 0.82 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.82) / 0.18, 2))) : 1;
        const wobble = 1 + 0.08 * (vnoise1(above / 31, seed) - 0.5) + 0.05 * Math.sin(u * 7 + i);
        return half * crown * wobble;
      };
      const yTop = Math.floor(c.Y(-h)), yBase = Math.ceil(c.Y(0));
      for (let y = Math.max(yTop, b.oy); y < Math.min(yBase, b.y1); y++) {
        const above = -c.ly(y + 0.5);
        const hw = hwAt(above);
        if (hw <= 0) continue;
        const lxa = cx - hw, lxb = cx + hw;
        const xa = Math.max(b.ox, Math.ceil(c.X(lxa) - 0.5)), xb = Math.min(b.x1 - 1, Math.floor(c.X(lxb) - 0.5));
        const hwUp = hwAt(above + 1.5 / d);
        for (let x = xa; x <= xb; x++) {
          const lx = c.lx(x + 0.5);
          const u = (lx - cx) / hw; // -1 left edge .. 1 right edge
          const edge = x === xa || x === xb;
          const topEdge = Math.abs(lx - cx) > hwUp;
          // green: on the crown and on ledges (bands where noise says so)
          const ledge = vnoise(lx / 10, above / 9, seed + 5);
          const crownG = above > h * 0.86 - 10 * vnoise1(lx / 8, seed + 7);
          const isGreen = green > 0 && (crownG || (ledge > 1 - 0.28 * green && above > h * 0.1));
          if (isGreen) {
            const t = topEdge ? 0.15 : 0.35 + 0.4 * (u + 1) / 2 + (hash(x, y, seed) - 0.5) * 0.2;
            b.set(x, y, tone(P.moss, clamp(edge ? 0.9 : t + 0.15, 0, 1), x, y, 0.5));
            continue;
          }
          // rock: lit on the left, vertical striations, darker toward the right edge
          const stri = vnoise(lx / 2.6, above / 40, seed + 9);
          let t = 0.12 + 0.62 * Math.pow((u + 1) / 2, 1.4) + (stri - 0.5) * 0.28;
          if (above < h * 0.08) t += 0.15;
          if (edge) t = u < 0 ? 0.45 : 0.95;
          b.set(x, y, tone(P.karst, clamp(t, 0, 1), x, y, 0.55));
        }
      }
    });
  },
});

// ---------------------------------------------------------------------------
// A forested ridge: a rolling hill line with pines standing on it (P3, P2).
// ---------------------------------------------------------------------------
export interface RidgeP {
  w: number;
  /** Hill height range, level-1 px. */
  h: number;
  /** Pines per 100 px. */
  pines?: number;
  /** Pine height, level-1 px. */
  pineH?: number;
  /** "pine" (dark green) or "moss" (bright meadow). */
  kind?: "pine" | "moss";
}

function pineSilhouette(dx: number, above: number, h: number, seed: number): boolean {
  // tiers of drooping boughs: width shrinks toward the top, notched every tier
  if (above < 0 || above > h) return false;
  const u = above / h;
  const tiers = 5;
  const k = (u * tiers) % 1;
  const base = (1 - u) * h * 0.34 + 1;
  const half = base * (0.55 + 0.45 * (1 - k)) * (0.85 + 0.3 * hash1(Math.floor(u * tiers), seed));
  if (Math.abs(dx) < 1.2 && above < h * 0.18) return true; // trunk
  return Math.abs(dx) <= half;
}

export const ridgeline = definePainter<RidgeP>("ridgeline", {
  bounds(p) {
    return [-4, -p.h - (p.pineH ?? 40) - 4, p.w + 4, 4];
  },
  paint(c, p) {
    const b = c.buf, d = c.d;
    const seed = c.seed;
    const kind = p.kind ?? "pine";
    const taper = (lx: number): number => Math.min(1, lx / (p.w * 0.12), (p.w - lx) / (p.w * 0.12));
    const hillAt = (lx: number): number => p.h * (0.35 + 0.65 * fbm1(lx / 160, seed, 3)) * Math.max(0, taper(lx));
    const x0 = Math.max(b.ox, Math.floor(c.X(0))), x1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
    // the hill body
    for (let x = x0; x < x1; x++) {
      const lx = c.lx(x + 0.5);
      const hh = hillAt(lx);
      const top = Math.ceil(c.Y(-hh));
      for (let y = Math.max(top, b.oy); y < Math.min(Math.ceil(c.Y(0)), b.y1); y++) {
        const above = -c.ly(y + 0.5);
        let t = 0.35 + 0.35 * (1 - above / Math.max(1, hh)) + (vnoise(lx / 9, above / 6, seed + 3) - 0.5) * 0.25;
        if (y === top) t = 0.15;
        b.set(x, y, tone(kind === "pine" ? P.pine : P.moss, clamp(t, 0, 1), x, y, 0.5));
      }
    }
    // pines along it
    const per = p.pines ?? 3;
    const ph = p.pineH ?? 40;
    if (kind === "pine" && per > 0 && d >= 0.125) {
      const r = rng(seed + 101);
      const n = Math.round((p.w / 100) * per);
      for (let i = 0; i < n; i++) {
        const tx = r() * p.w;
        const th = ph * (0.55 + 0.6 * r()) * Math.max(0, Math.min(1, taper(tx) * 1.5 - 0.2));
        if (th < 6) continue;
        const tSeed = Math.floor(r() * 1e6);
        const baseY = -hillAt(tx) + 2;
        const X0 = Math.floor(c.X(tx - th * 0.4)), X1 = Math.ceil(c.X(tx + th * 0.4));
        const Y0 = Math.floor(c.Y(baseY - th)), Y1 = Math.ceil(c.Y(baseY));
        if (!b.touches(X0, Y0, X1, Y1)) continue;
        for (let y = Y0; y < Y1; y++) {
          for (let x = X0; x < X1; x++) {
            const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
            const dx = lx - tx, above = baseY - ly;
            if (!pineSilhouette(dx, above, th, tSeed)) continue;
            const lit = dx < -th * 0.06;
            const t = lit ? 0.25 + 0.2 * hash(x, y, tSeed) : 0.62 + 0.25 * hash(x, y, tSeed);
            b.set(x, y, tone(P.pine, clamp(t, 0, 1), x, y, 0.4));
          }
        }
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Cloud banks: flat bottoms, heaped tops, lit from above.
// ---------------------------------------------------------------------------
export interface CloudP {
  w: number;
  h: number;
}

export const cloud = definePainter<CloudP>("cloud", {
  bounds(p) {
    return [-p.h, -p.h * 1.1, p.w + p.h, 2];
  },
  paint(c, p) {
    const b = c.buf;
    const r = rng(c.seed);
    const puffs: [number, number, number][] = [];
    const n = Math.max(3, Math.round(p.w / (p.h * 0.7)));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const bulge = Math.sin(t * Math.PI);
      const rad = p.h * (0.35 + 0.5 * bulge * (0.6 + 0.6 * r()));
      puffs.push([t * p.w, -rad * 0.55, rad]);
    }
    const X0 = Math.floor(c.X(-p.h)), X1 = Math.ceil(c.X(p.w + p.h));
    const Y0 = Math.floor(c.Y(-p.h * 1.1)), Y1 = Math.ceil(c.Y(0));
    for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
      for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
        const lx = c.lx(x + 0.5), ly = c.ly(y + 0.5);
        let inside = 0, lit = 0;
        for (const [px, py, pr] of puffs) {
          const dx = lx - px, dy = ly - py;
          const q = (dx * dx + dy * dy) / (pr * pr);
          if (q < 1) {
            inside = 1;
            // lit from above: the top of each puff is brighter
            lit = Math.max(lit, (-dy / pr) * 0.5 + 0.5 - q * 0.25);
          }
        }
        if (!inside || ly > 0) continue;
        const bottom = ly > -p.h * 0.12;
        const t = bottom ? 0.75 : 0.6 - lit * 0.6;
        b.set(x, y, tone(P.cloud, clamp(t, 0, 1), x, y, 0.5));
      }
    }
  },
});

// ---------------------------------------------------------------------------
// A great cliff wall strung with thin falls (Shiraito's backdrop): pale wet karst with
// vertical runnels, moss on the ledges, white threads pouring from the lip.
// ---------------------------------------------------------------------------
export interface CliffWallP {
  /** Width and height, level-1 px; the anchor is the left end of the lip. */
  w: number;
  h: number;
  /** Lip heights: [x, y] offsets along the top (x from 0 to w, y px; negative is higher). */
  lip?: number[];
  /** Falls per 100 px of lip. */
  falls?: number;
}

function lipAt(p: CliffWallP, x: number): number {
  const l = p.lip;
  if (!l || l.length < 4) return 0;
  if (x <= l[0]!) return l[1]!;
  for (let i = 2; i < l.length; i += 2) {
    if (l[i]! >= x) {
      const t = (x - l[i - 2]!) / Math.max(1e-6, l[i]! - l[i - 2]!);
      return l[i - 1]! + (l[i + 1]! - l[i - 1]!) * t;
    }
  }
  return l[l.length - 1]!;
}

export const cliffwall = definePainter<CliffWallP>("cliffwall", {
  bounds(p) {
    let mn = 0;
    for (let i = 1; i < (p.lip?.length ?? 0); i += 2) mn = Math.min(mn, p.lip![i]!);
    return [-2, mn - 10, p.w + 2, p.h + 2];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const per = p.falls ?? 2.2;
    // falls: x positions with a width and a strength
    const r = rng(seed + 5);
    const falls: [number, number, number][] = [];
    for (let x = 6; x < p.w - 6; ) {
      x += (100 / per) * (0.35 + 1.3 * r());
      falls.push([x, 1 + Math.floor(r() * 2.6), 0.55 + 0.45 * r()]);
    }
    const X0 = Math.max(b.ox, Math.floor(c.X(0))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const top = lipAt(p, lx) + (vnoise1(lx / 13, seed) - 0.5) * 6;
      const Yt = Math.ceil(c.Y(top)), Yb = Math.min(b.y1, Math.ceil(c.Y(p.h)));
      // the nearest fall and how far from its centre this column is
      let fall = 0, wet = 0;
      for (const [fx, fw, fs] of falls) {
        const dx = Math.abs(lx - fx);
        if (dx <= fw * 0.5 + 0.5) fall = Math.max(fall, fs);
        else if (dx < fw + 6) wet = Math.max(wet, 1 - (dx - fw) / 6);
      }
      for (let y = Math.max(Yt, b.oy); y < Yb; y++) {
        const ly = c.ly(y + 0.5);
        const below = ly - top;
        if (y === Yt) { b.set(x, y, P.moss[3]!); continue; }
        if (below < 6 + 4 * vnoise1(lx / 7, seed + 9)) {
          b.set(x, y, tone(P.moss, 0.35 + 0.4 * (below / 10), x, y, 0.5));
          continue;
        }
        if (fall > 0) {
          // white thread: brighter at its core, broken by dither as it falls and frays
          const fray = clamp(below / p.h, 0, 1);
          const keep = fall * (1 - 0.55 * fray);
          if (bayer4(x, y) < keep + 0.15) {
            b.set(x, y, tone(P.cloud, 0.05 + 0.4 * fray + 0.2 * hash(x, Math.floor(y / 3), seed), x, y, 0.5));
            continue;
          }
        }
        const runnel = vnoise(lx / 2.2, ly / 70, seed + 3);
        const ledge = vnoise(lx / 30, ly / 5, seed + 7);
        if (ledge > 0.8 && d >= 0.25) {
          b.set(x, y, tone(P.moss, 0.45 + 0.3 * hash(x, y, seed), x, y, 0.5));
          continue;
        }
        let t = 0.18 + 0.3 * runnel + 0.25 * clamp(below / p.h, 0, 1) + wet * 0.25;
        t += (vnoise(lx / 40, ly / 40, seed + 11) - 0.5) * 0.2;
        b.set(x, y, tone(P.karst, clamp(t, 0, 1), x, y, 0.55));
      }
    }
  },
});

// ---------------------------------------------------------------------------
// The ground of a background plane: whatever lies at that depth below the horizon (a
// far plain, a meadow, forest) from its line down past the frame's foot, so the land
// never shows a gap where there is no water. The lake covers it where the lake is.
// ---------------------------------------------------------------------------
export interface PlainP {
  w: number;
  /** Depth of the fill below the anchor line, px. */
  foot: number;
  /** Ramp: "range" (hazy far plain), "moss" (meadow), "pine" (forest). */
  ramp?: "range" | "moss" | "pine" | "karst";
  /** Undulation of the top line, px. */
  amp?: number;
}

export const plain = definePainter<PlainP>("plain", {
  bounds(p) {
    return [-2, -(p.amp ?? 6) - 4, p.w + 2, p.foot + 2];
  },
  paint(c, p) {
    const b = c.buf;
    const ramp = p.ramp === "moss" ? P.moss : p.ramp === "pine" ? P.pine : p.ramp === "karst" ? P.karst : P.range;
    const amp = p.amp ?? 6;
    const X0 = Math.max(b.ox, Math.floor(c.X(0))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const top = -amp * fbm1(lx / 70, c.seed, 3);
      const Yt = Math.ceil(c.Y(top)), Yb = Math.min(b.y1, Math.ceil(c.Y(p.foot)));
      for (let y = Math.max(Yt, b.oy); y < Yb; y++) {
        const ly = c.ly(y + 0.5);
        const below = ly - top;
        // nearer rows (further down the frame) are a little darker and more textured
        let t = 0.3 + 0.35 * clamp(below / Math.max(1, p.foot), 0, 1) + (vnoise(lx / 11, ly / 5, c.seed + 3) - 0.5) * 0.18;
        if (y === Yt) t = 0.15;
        b.set(x, y, tone(ramp, clamp(t, 0, 1), x, y, 0.5));
      }
    }
  },
});
