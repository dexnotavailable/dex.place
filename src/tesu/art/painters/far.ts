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

export const range = definePainter<RangeP>("range", {
  bounds(p) {
    return [-p.h * 2, -p.h - 4, p.w + p.h * 2, 2];
  },
  paint(c, p) {
    const b = c.buf, d = c.d;
    const body = p.ramp === "karst" ? P.karst : P.range;
    const snowFrac = p.snow ?? 0.62;
    // peaks back to front: the tallest first, lower (nearer) ones overlap them
    const peaks = peaksOf(p, c.seed).sort((a, q) => q.h - a.h);
    peaks.forEach((pk, i) => {
      const seed = c.seed + i * 131;
      const heightAt = (lx: number): number => {
        const t = 1 - Math.abs(lx - pk.cx) / pk.hw;
        if (t <= 0) return 0;
        return pk.h * Math.pow(t, 1.2) * (0.94 + 0.12 * fbm1(lx / 31, seed, 3));
      };
      const xa = Math.max(b.ox, Math.floor(c.X(pk.cx - pk.hw))), xb = Math.min(b.x1, Math.ceil(c.X(pk.cx + pk.hw)));
      for (let x = xa; x < xb; x++) {
        const lx = c.lx(x + 0.5);
        const hh = heightAt(lx);
        if (hh <= 0) continue;
        const topY = Math.ceil(c.Y(-hh));
        const baseY = Math.floor(c.Y(0));
        for (let y = Math.max(topY, b.oy); y < Math.min(baseY, b.y1); y++) {
          const above = -c.ly(y + 0.5);
          const down = pk.h - above;
          const spine = pk.cx + down * 0.42 + (vnoise1(above / 17, seed) - 0.5) * 18;
          const lit = lx < spine;
          let gully = false;
          if (d >= 0.25) {
            const rib = pk.cx - down * 0.55 + (vnoise1(above / 13, seed + 7) - 0.5) * 12;
            if (Math.abs(lx - rib) < 0.8 / d && down > pk.h * 0.12) gully = true;
            const gl = pk.cx + down * 1.05 + (vnoise1(above / 11, seed + 9) - 0.5) * 16;
            if (!lit && Math.abs(lx - gl) < 0.7 / d && down > pk.h * 0.2) gully = true;
          }
          const snowLine = pk.h * snowFrac - (vnoise1(lx / 9, seed + 3) - 0.5) * p.h * 0.1 - Math.abs(Math.sin(lx / 11 + seed)) * p.h * 0.07;
          const outline = y === topY;
          if (above > snowLine && snowFrac < 1) {
            let t = lit ? 0.02 : 0.42;
            if (gully) t += 0.25;
            if (outline) t = lit ? 0.12 : 0.5;
            b.set(x, y, tone(P.snow, clamp(t, 0, 1), x, y, 0.3));
            continue;
          }
          let t = lit ? 0.28 : 0.62;
          if (gully) t += 0.15;
          const foot = p.h * 0.16;
          if (above < foot) t -= 0.3 * (1 - above / foot);
          if (outline) t = lit ? 0.45 : 0.75;
          b.set(x, y, tone(body, clamp(t, 0, 1), x, y, 0.5));
        }
      }
    });
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
    return [x0 - 4, y0 - 24, x1 + 4, 4];
  },
  paint(c, p) {
    const b = c.buf, d = c.d;
    const green = p.green ?? 0.7;
    const order = p.t.map((t, i) => ({ t, i })).sort((a, q) => q.t[2] - a.t[2]);
    for (const { t: [cx0, w, h], i } of order) {
      const seed = c.seed + i * 977;
      const half = w / 2;
      const lean = (hash(i, 1, seed) - 0.5) * 0.3;
      // left and right edges wander on their own; the crown is lumpy
      const centre = (above: number): number => cx0 + lean * above * 0.25 + (vnoise1(above / 47, seed + 2) - 0.5) * half * 0.25;
      const edgeL = (above: number): number => {
        const u = above / h;
        const crown = u > 0.74 ? Math.sqrt(Math.max(0, 1 - ((u - 0.74) / 0.26) ** 2)) : 1;
        return half * crown * (0.9 + 0.22 * vnoise1(above / 19, seed + 3)) * (u < 0.05 ? 1 + (0.05 - u) * 3 : 1);
      };
      const edgeR = (above: number): number => {
        const u = above / h;
        const crown = u > 0.7 ? Math.sqrt(Math.max(0, 1 - ((u - 0.7) / 0.3) ** 2)) : 1;
        return half * crown * (0.88 + 0.22 * vnoise1(above / 17, seed + 5)) * (u < 0.05 ? 1 + (0.05 - u) * 3 : 1);
      };
      const yTop = Math.floor(c.Y(-h)), yBase = Math.ceil(c.Y(0));
      for (let y = Math.max(yTop, b.oy); y < Math.min(yBase, b.y1); y++) {
        const above = -c.ly(y + 0.5);
        if (above > h || above < 0) continue;
        const m = centre(above), hl = edgeL(above), hr = edgeR(above);
        if (hl + hr <= 0) continue;
        const xa = Math.max(b.ox, Math.ceil(c.X(m - hl) - 0.5)), xb = Math.min(b.x1 - 1, Math.floor(c.X(m + hr) - 0.5));
        const up = above + 1.5 / d;
        const mU = centre(up), lU = edgeL(up), rU = edgeR(up);
        for (let x = xa; x <= xb; x++) {
          const lx = c.lx(x + 0.5);
          const u = lx < m ? (lx - m) / hl : (lx - m) / hr; // -1 .. 1 across
          const edge = x === xa || x === xb;
          const topEdge = up > h || lx < mU - lU || lx > mU + rU;
          // vegetation drapes down from the crown and from ledges
          const drape = vnoise(lx / 7, above / 26, seed + 9) + (above / h) * 0.55 - 0.15;
          const ledge = vnoise(lx / 16, above / 7, seed + 11);
          const veg = green > 0 && (drape > 1.02 - 0.45 * green || ledge > 1 - 0.14 * green);
          if (veg) {
            let t = topEdge ? 0.25 : u < -0.2 ? 0.42 : u < 0.45 ? 0.6 : 0.78;
            if (edge) t = 0.92;
            b.set(x, y, tone(P.moss, clamp(t + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.14, 0, 1), x, y, 0.45));
            continue;
          }
          let t = 0.12 + 0.62 * clamp((u + 1) / 2, 0, 1) ** 1.3;
          const stria = vnoise(lx / 2.4, above / 38, seed + 3);
          if (d >= 0.25 && stria > 0.7) t += 0.12;
          if (above < h * 0.07) t += 0.1;
          if (edge) t = u < 0 ? 0.5 : 0.9;
          b.set(x, y, tone(P.karst, clamp(t, 0, 1), x, y, 0.5));
        }
      }
    }
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
    const per = p.falls ?? 1.4;
    // the falls: where each pours from the lip, its width and how far it holds together
    const r = rng(seed + 5);
    const falls: [number, number, number][] = [];
    for (let x = 10; x < p.w - 10; ) {
      x += (100 / per) * (0.4 + 1.2 * r());
      falls.push([x, 3 + Math.floor(r() * 5), 0.45 + 0.5 * r()]);
    }
    const X0 = Math.max(b.ox, Math.floor(c.X(0))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const top = lipAt(p, lx) + (vnoise1(lx / 13, seed) - 0.5) * 6;
      const Yt = Math.ceil(c.Y(top)), Yb = Math.min(b.y1, Math.ceil(c.Y(p.h)));
      for (let y = Math.max(Yt, b.oy); y < Yb; y++) {
        const ly = c.ly(y + 0.5);
        const below = ly - top;
        if (y === Yt) { b.set(x, y, P.moss[2]!); continue; }
        // the lip: a moss cap with a ragged hem
        if (below < 7 + 5 * vnoise1(lx / 6, seed + 9)) {
          b.set(x, y, tone(P.moss, below < 2 ? 0.25 : 0.55, x, y, 0.3));
          continue;
        }
        // a fall here? it sways a little as it drops and frays toward the bottom
        let fall = 0, rim = false;
        for (const [fx, fw, fs] of falls) {
          const sway = Math.sin(below / 61 + fx) * Math.min(2, below / 80);
          // the stream widens a little as it falls
          const half = fw / 2 + below * 0.012;
          const dx = Math.abs(lx - fx - sway);
          if (dx <= half) {
            const fray = clamp(below / (p.h * fs), 0, 1);
            fall = Math.max(fall, 1 - fray * fray);
            if (dx > half - 1.2 / d) rim = true;
          }
        }
        if (fall > 0 && bayer4(x, y) < fall + 0.1) {
          b.set(x, y, rim ? P.cloud[3]! : tone(P.cloud, fall > 0.6 ? 0 : 0.25, x, y, 0.3));
          continue;
        }
        // wet rock: dark, vertically streaked, moss on the ledges
        const runnel = vnoise(lx / 5, ly / 90, seed + 3);
        // moss along the bedding ledges: long thin strips, thicker where they catch the light
        const bed = Math.abs(Math.sin((ly + 30 * vnoise1(lx / 90, seed + 13)) / 21));
        const ledge = bed < 0.16 && vnoise(lx / 30, ly / 21, seed + 7) > 0.48;
        if (ledge && d >= 0.25) {
          b.set(x, y, tone(P.moss, bed < 0.07 ? 0.48 : 0.68, x, y, 0.4));
          continue;
        }
        let t = 0.48 + 0.14 * runnel + 0.14 * clamp(below / p.h, 0, 1);
        if (bed < 0.24 && !ledge) t += 0.1;
        t += (vnoise(lx / 60, ly / 50, seed + 11) - 0.5) * 0.14;
        b.set(x, y, tone(P.karst, clamp(t, 0, 1), x, y, 0.45));
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
  /** Dissolves into the haze over this many px at its east end (default 0: a plain cut). */
  fadeEnd?: number;
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
        // (its east end thins out pixel by pixel into the haze)
        if (p.fadeEnd && lx > p.w - p.fadeEnd && bayer4(x, y) >= (p.w - lx) / p.fadeEnd) continue;
        b.set(x, y, tone(ramp, clamp(t, 0, 1), x, y, 0.5));
      }
    }
  },
});

// ---------------------------------------------------------------------------
// The sky isles, Bell and Drum: floating rock isles each carrying a tower, backdrop only.
// ---------------------------------------------------------------------------
export interface IsleP {
  /** Width of the isle's top, px; the anchor is the middle of its top. */
  w: number;
  /** Depth of the rock below, px. */
  h: number;
  tower: "bell" | "drum";
}

export const isle = definePainter<IsleP>("isle", {
  bounds(p) {
    return [-p.w / 2 - 6, -p.w * 0.9, p.w / 2 + 6, p.h + 4];
  },
  paint(c, p) {
    const b = c.buf, seed = c.seed;
    const half = p.w / 2;
    // the rock: a ragged inverted cone, lit on the left, a moss top
    for (let lx = -half; lx <= half; lx += 1 / c.d) {
      const u = lx / half;
      const depth = p.h * Math.pow(1 - Math.abs(u), 0.7) * (0.75 + 0.35 * vnoise1(lx / 7, seed)) + 4;
      const X = Math.round(c.X(lx));
      const Y0 = Math.round(c.Y(-2 - 3 * vnoise1(lx / 5, seed + 1))), Y1 = Math.round(c.Y(depth));
      for (let y = Y0; y < Y1; y++) {
        const ly = c.ly(y + 0.5);
        if (ly < 5) { b.set(X, y, tone(P.moss, ly < 1.5 ? 0.15 : 0.45, X, y, 0.3)); continue; }
        let t = 0.25 + 0.45 * clamp((u + 1) / 2, 0, 1) + 0.15 * (ly / p.h) + (vnoise(lx / 4, ly / 9, seed + 3) - 0.5) * 0.2;
        if (y === Y1 - 1) t = 0.9;
        b.set(X, y, tone(P.karst, clamp(t, 0, 1), X, y, 0.4));
      }
    }
    // the tower: a tall timber pagoda (the bell) or a squat drum tower
    const tiers = p.tower === "bell" ? 3 : 2;
    const tw = p.w * (p.tower === "bell" ? 0.28 : 0.38);
    let y = 0;
    for (let i = 0; i < tiers; i++) {
      const sw = tw * (1 - i * 0.18);
      const sh = p.w * (p.tower === "bell" ? 0.17 : 0.2);
      // wall
      for (let ly = y - sh; ly < y; ly += 1 / c.d) {
        for (let lx = -sw / 2; lx <= sw / 2; lx += 1 / c.d) {
          const X = Math.round(c.X(lx)), Y = Math.round(c.Y(ly));
          const u = (lx + sw / 2) / sw;
          b.set(X, Y, u < 0.12 || u > 0.88 ? P.red[3]! : tone(P.lacquer, 0.4 + 0.3 * u, X, Y, 0.3));
        }
      }
      // roof
      const rh = sh * 0.55;
      for (let ly = y - sh - rh; ly < y - sh + 2; ly += 1 / c.d) {
        const v = (y - sh - ly) / rh;
        const rw = sw * (1.5 - 0.9 * v) + (v < 0.2 ? (0.2 - v) * sw * 1.2 : 0);
        for (let lx = -rw / 2; lx <= rw / 2; lx += 1 / c.d) {
          const X = Math.round(c.X(lx)), Y = Math.round(c.Y(ly));
          b.set(X, Y, v > 0.9 ? P.gold[2]! : tone(P.tile, 0.3 + 0.4 * (1 - v), X, Y, 0.3));
        }
      }
      y -= sh + rh * 0.7;
    }
  },
});
