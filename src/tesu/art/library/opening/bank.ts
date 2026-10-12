// Kagami's near shore (P5, the near-front plane): the bank the lake's surface ends against,
// seen close and dark. It frames the bottom of the lake views the way the grassy rise frames
// Wuling's lake in reference 4: low mossy hummocks at the waterline, beds of reeds and the odd
// cattail, rounded stones half sunk in the shallows, grass tufts, a few shrubs; gaps where the
// bank dips to a dark wet lip so the water shows through. Its body runs down past the frame
// as dark earth with stones and roots.
//
// Near plane rules (art bible, A.1): painted at full value; the plane shader darkens it toward
// ink and the palette keeps it to a few tones. Light from the upper left still reads on the
// tops of stones and tufts. The anchor is the waterline at the bank's left end.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { clamp, fbm1, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { cached, clump } from "./kit.ts";
import { bush } from "./rock.ts";

export interface BankP {
  /** The right and left ends round off and fall away over this many px (default 0: straight). */
  endR?: number;
  startR?: number;
  /** Length along the shore and depth below the waterline, level-1 px of the near plane. */
  w: number;
  h: number;
  /** Rise the right end into a rocky corner over this many px (default 0, none). */
  cornerR?: number;
  /** How much is reeds, 0..1 (default 0.5). */
  reeds?: number;
}

interface Bit {
  kind: "stone" | "reed" | "tuft" | "shrub" | "bush";
  x: number;
  /** Size (stone radius, reed height, tuft size, shrub radius). */
  s: number;
  seed: number;
}

/** Height of the bank's top above the waterline at x (px, positive up). */
function topOf(p: BankP, x: number, seed: number): number {
  // low hummocks everywhere, and every so often a big grassy mound with shrubs on it
  const hum = fbm1(x / 70, seed + 3, 3);
  // a rise where the bank is rich (bushes heap on it), never a smooth dome: noisy at every scale
  const rise = Math.max(0, vnoise1(x / 380, seed + 6) - 0.55) / 0.45;
  let t = 3 + Math.max(0, hum - 0.35) * 26 + rise * (22 + 30 * fbm1(x / 40, seed + 7, 3)) + (vnoise1(x / 9, seed + 4) - 0.5) * 3 + (vnoise1(x / 3.5, seed + 8) - 0.5) * 2;
  if (p.cornerR) {
    const k = clamp((x - (p.w - p.cornerR)) / p.cornerR, 0, 1);
    t += k * k * 90 * (0.8 + 0.4 * vnoise1(x / 23, seed + 5));
  }
  // the ends round down to the waterline
  const ke = Math.max(p.endR ? clamp((x - (p.w - p.endR * 0.4)) / (p.endR * 0.4), 0, 1) : 0, p.startR ? clamp((p.startR * 0.4 - x) / (p.startR * 0.4), 0, 1) : 0);
  return t * Math.sqrt(Math.max(0, 1 - ke * ke)) - ke * 4;
}

function bitsOf(p: BankP, seed: number): Bit[] {
  return cached(`bank|${seed}|${p.w}|${p.reeds}`, () => {
    const r = rng(seed + 11);
    const out: Bit[] = [];
    const reeds = p.reeds ?? 0.5;
    for (let x = 4; x < p.w - 4; x += 3 + r() * 7) {
      const zone = vnoise1(x / 160, seed + 13);
      const k = r();
      const high = topOf(p, x, seed) > 18;
      if (high && k < 0.55) { out.push({ kind: "bush", x, s: 9 + r() * 20 * (0.5 + vnoise1(x / 380, seed + 6)), seed: Math.floor(r() * 1e6) }); continue; }
      if (zone > 1 - reeds * 0.9 && k < 0.85 && !high) {
        // a reed bed: its reeds are sprites (they sway); the plate keeps the odd stone and tuft
        if (k < 0.06) out.push({ kind: "stone", x, s: 5 + r() * 8, seed: Math.floor(r() * 1e6) });
      } else if (k < 0.08) out.push({ kind: "stone", x, s: 6 + r() * 14, seed: Math.floor(r() * 1e6) });
      else if (k < 0.2) out.push({ kind: "tuft", x, s: 5 + r() * 9, seed: Math.floor(r() * 1e6) });
      else if (k < 0.24) out.push({ kind: "shrub", x, s: 8 + r() * 12, seed: Math.floor(r() * 1e6) });
    }
    return out;
  });
}

function paintBit(c: PaintCtx, p: BankP, bt: Bit, seed: number): void {
  const b = c.buf, d = c.d;
  const base = -topOf(p, bt.x, seed);
  if (bt.kind === "stone") {
    // a rounded stone half sunk in the bank: lit top-left, dark below, a wet line at its foot
    const R = bt.s, cy = base + R * 0.35;
    const X0 = Math.floor(c.X(bt.x - R * 1.3)), X1 = Math.ceil(c.X(bt.x + R * 1.3)), Y0 = Math.floor(c.Y(cy - R)), Y1 = Math.ceil(c.Y(base + 2));
    if (!b.touches(X0, Y0, X1, Y1)) return;
    for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
      for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
        const dx = (c.lx(x + 0.5) - bt.x) / (R * 1.25), dy = (c.ly(y + 0.5) - cy) / R;
        const q = dx * dx + dy * dy * (1 + 0.3 * vnoise1(dx * 4 + bt.seed, 1));
        if (q > 1 || c.ly(y + 0.5) > base + 1) continue;
        const lit = -0.62 * dx - 0.78 * dy;
        let t = 0.55 - lit * 0.35 + q * 0.15;
        if (q > 0.8 && lit < 0) t += 0.15;
        const moss = dy < -0.3 && vnoise1(dx * 5 + bt.seed, 2) > 0.45;
        b.set(x, y, tone(moss ? P.moss : P.stone, clamp(moss ? t + 0.15 : t, 0, 1), x, y, 0.35));
      }
    }
    return;
  }
  if (bt.kind === "reed") {
    if (d < 0.125) return;
    const n = 2 + Math.floor(hash1(1, bt.seed) * 4);
    for (let i = 0; i < n; i++) {
      const hgt = bt.s * (0.45 + 0.55 * hash1(i + 2, bt.seed));
      const lean = (hash1(i + 9, bt.seed) - 0.35) * 0.3;
      const x0 = bt.x + (hash1(i + 5, bt.seed) - 0.5) * 6;
      const col = hash1(i + 7, bt.seed) < 0.5 ? P.moss[4]! : P.moss[5]!;
      for (let s = 0; s < hgt; s += 1 / d) {
        const u = s / hgt;
        const X = Math.round(c.X(x0 + lean * s + lean * u * u * hgt * 0.4)), Y = Math.round(c.Y(base + 2 - s));
        b.set(X, Y, u > 0.75 ? P.moss[3]! : col);
        if (d >= 1 && u < 0.4) b.set(X + 1, Y, P.moss[6]!);
      }
      if (hash1(i + 11, bt.seed) < 0.22 && hgt > bt.s * 0.7) {
        // a cattail head
        const tx = x0 + lean * hgt * 0.92 + lean * hgt * 0.35;
        for (let s = hgt * 0.72; s < hgt * 0.9; s += 1 / d) {
          const X = Math.round(c.X(tx)), Y = Math.round(c.Y(base + 2 - s));
          b.set(X, Y, P.timber[4]!);
          b.set(X + 1, Y, P.timber[5]!);
        }
      }
    }
    return;
  }
  if (bt.kind === "tuft") {
    if (d < 0.25) return;
    const n = 4 + Math.floor(bt.s);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (hash1(i, bt.seed) - 0.5) * 2;
      const len = bt.s * (0.5 + 0.7 * hash1(i + 1, bt.seed));
      for (let s = 0; s < len; s += 1 / d) {
        const u = s / len;
        b.set(Math.round(c.X(bt.x + Math.cos(a) * s * 0.7 + Math.sign(Math.cos(a)) * u * u * 3)), Math.round(c.Y(base + 1 + Math.sin(a) * s)), P.moss[u < 0.4 ? 5 : u < 0.8 ? 4 : 2]!);
      }
    }
    return;
  }
  if (bt.kind === "bush") { bush(c, bt.x, base + bt.s * 0.45, bt.s, bt.seed, false); return; }
  clump(c, bt.x, base - bt.s * 0.4, bt.s, P.moss.slice(2, 7), P.pine.slice(3), 0.42, bt.seed, 0.75);
}

export const bank = definePainter<BankP>("op.bank", {
  bounds(p) {
    return [-12, -120 - (p.cornerR ? 110 : 0), p.w + 12, p.h + 34];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const X0 = Math.max(b.ox, Math.floor(c.X(0))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const top = -topOf(p, lx, seed);
      // the body's foot: the right end rounds off and falls away, ragged with foliage
      // the foot: ragged, foliage hanging in tongues over whatever lies below the bank
      const tw = 9, tc = Math.floor(lx / tw), tf = lx / tw - tc;
      let foot = p.h * (0.78 + 0.22 * vnoise1(lx / 31, seed + 18)) + 26 * hash1(tc, seed + 19) * hash1(tc, seed + 20) * Math.sqrt(Math.max(0, 1 - (2 * tf - 1) ** 2));
      if (p.endR || p.startR) {
        const k = Math.max(p.endR ? clamp((lx - (p.w - p.endR)) / p.endR, 0, 1) : 0, p.startR ? clamp((p.startR - lx) / p.startR, 0, 1) : 0);
        foot = foot * Math.sqrt(Math.max(0, 1 - k * k)) * (0.9 + 0.2 * vnoise1(lx / 11, seed + 15)) + (k > 0 ? (vnoise1(lx / 5, seed + 16) - 0.5) * 10 : 0);
        if (foot <= top + 1) continue;
      }
      const Yt = Math.ceil(c.Y(top)), Yb = Math.min(b.y1, Math.ceil(c.Y(foot)));
      for (let y = Math.max(Yt, b.oy); y < Yb; y++) {
        const ly = c.ly(y + 0.5);
        const below = ly - top;
        // the body: a sunlit grass top, then a dense dark mass of leaves and grass running down
        // past the frame (a near silhouette, never a cross-section of soil)
        let ramp: readonly number[];
        let t: number;
        const grassH = 9 + 7 * vnoise1(lx / 13, seed + 7);
        if (below < 1.5 / Math.min(1, d)) { ramp = P.moss; t = 0.25; }
        else if (below < grassH) {
          ramp = P.moss;
          // blades: vertical strokes of lighter and darker grass
          const blade = hash(Math.floor(lx), 1, seed + 8) < 0.3;
          t = 0.45 + (below / grassH) * 0.25 + (blade && d >= 0.5 ? -0.12 : 0);
        } else {
          ramp = P.pine;
          // foliage: masses at two scales, each lit on its upper left (the light falls on the
          // bumps of the noise field), deeper is darker; never a grid
          const n0 = vnoise(lx / 26, ly / 22, seed + 9);
          const nA = vnoise(lx / 7, ly / 6, seed + 10), nB = vnoise((lx + 1.2) / 7, (ly + 1.5) / 6, seed + 10);
          const lit = nB - nA; // brighter where the field rises toward the upper left
          t = 0.32 + clamp((below - grassH) / 120, 0, 1) * 0.42 + (0.5 - n0) * 0.35 - lit * 1.4;
          if (d >= 0.5 && hash(x >> 1, y >> 1, seed + 11) < 0.06) t -= 0.18;
          t += (fbm1(lx / 70 + ly / 50, seed + 17, 3) - 0.5) * 0.4;
          if (ly > foot - 6) t += 0.25;
        }
        // a wet dark lip where the water laps it
        if (ly > -3 && ly < 2 && below > 2 && top > -6) { ramp = P.pine; t = 0.95; }
        b.set(x, y, tone(ramp, clamp(t, 0, 1), x, y, 0.3));
      }
    }
    for (const bt of bitsOf(p, seed)) {
      const reach = bt.kind === "reed" ? 30 : bt.s * 1.6 + 4;
      if (!b.touches(Math.floor(c.X(bt.x - reach)), b.oy - 1, Math.ceil(c.X(bt.x + reach)), b.y1 + 1)) continue;
      paintBit(c, p, bt, seed);
    }
  },
});

/** Where the bank's reed beds are (for the reed sprites): [x, width, height] in its own px. */
export function reedBeds(p: BankP, seed: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const reeds = p.reeds ?? 0.5;
  let a = -1;
  for (let x = 4; x < p.w - 4; x += 6) {
    const zone = vnoise1(x / 160, seed + 13);
    const on = zone > 1 - reeds * 0.9 && topOf(p, x, seed) <= 30;
    if (on && a < 0) a = x;
    if ((!on || x + 6 >= p.w - 4) && a >= 0) {
      if (x - a > 30) {
        // split long beds into pieces of at most 260 px (sprites stay small)
        for (let s = a; s < x; s += 260) out.push([s, Math.min(260, x - s), 34 + 56 * vnoise1(s / 90, seed + 21)]);
      }
      a = -1;
    }
  }
  return out;
}
