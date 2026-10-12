// Kagami's jetty, seen side-on along its length: the ends of the deck planks in a row (each with
// a sunlit top edge, a dark gap to its neighbour, its own wear), a bolted stringer under them,
// round log piles driven into the lake (silvered above, dark and green with algae near the
// water, wet below), diagonal braces between them, the odd pile standing up past the deck as a
// mooring post with an iron band and a rope. Weathered lake timber: bleached grey on the lit
// faces, warm brown in the shade (stone picks over timber, never dithered across ramps).
//
// The close band (2x) paints it at twice the density, so the grain, nails and rope fibres there
// are its own pixels, not a magnified copy. Anchor: the deck's top-left corner (the walk line).

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

export interface JettyP {
  /** Deck length, level-1 px. */
  w: number;
  /** Waterline below the deck top, px. */
  water: number;
  /** Pile spacing, px (default 120). */
  every?: number;
  /** Indices of piles that stand up past the deck as mooring posts, and their heights. */
  posts?: [number, number][];
}

const DECK = 6;
const STRINGER = 10;

/** Weathered timber: a tone t (0 lit .. 1 dark), bleached (stone ramp) where lit and dry. */
export function wood(x: number, y: number, t: number, bleach = true): number {
  if (bleach && t < 0.48) return tone(P.stone, clamp(0.12 + t * 1.25, 0, 1), x, y, 0.3);
  return tone(P.timber, clamp(0.3 + t * 0.7, 0, 1), x, y, 0.35);
}

export function pileXs(p: JettyP, seed: number): number[] {
  return cached(`piles|${seed}|${p.w}|${p.every}`, () => {
    const every = p.every ?? 140;
    const n = Math.max(1, Math.round(p.w / every));
    const out: number[] = [];
    for (let i = 0; i <= n; i++) out.push(clamp((i / n) * p.w + (i > 0 && i < n ? (hash1(i, seed + 3) - 0.5) * 18 : 0), 6, p.w - 6));
    return out;
  });
}

/** A round log standing from y0 to y1 (local px), centre cx, half width hw. Wet near the water. */
export function log(c: PaintCtx, cx: number, y0: number, y1: number, hw: number, water: number, seed: number, cap = false): void {
  const b = c.buf, d = c.d;
  const X0 = Math.round(c.X(cx - hw)), X1 = Math.max(X0 + 2, Math.round(c.X(cx + hw)));
  const Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
  for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
    const ly = c.ly(y + 0.5);
    for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
      const u = (x - X0 + 0.5) / (X1 - X0);
      const lx = c.lx(x + 0.5);
      // round: a lit stripe on the left, falling into shade on the right
      let t = u < 0.22 ? 0.12 : u < 0.5 ? 0.3 : u < 0.78 ? 0.5 : 0.72;
      // grain and splits running down the log
      if (d >= 0.5 && vnoise(lx / 1.4, ly / 22, seed) > 0.72) t += 0.14;
      if (d >= 1 && hash(Math.floor(lx * 2), Math.floor(ly / 9), seed + 1) < 0.04) t += 0.25;
      if (x === X1 - 1) t = 0.92;
      // the wet band: darker toward the water, algae green in patches
      const wet = clamp((ly - (water - 14)) / 14, 0, 1);
      if (wet > 0) {
        if (vnoise(lx / 3, ly / 3, seed + 2) > 0.62 - wet * 0.25 && x < X1 - 1) {
          c.buf.set(x, y, tone(P.moss, clamp(0.55 + wet * 0.3 + u * 0.2, 0, 1), x, y, 0.35));
          continue;
        }
        t = t + wet * 0.35;
      }
      // a rounded top on a post
      if (cap && ly < y0 + hw * 0.8) {
        const k = (y0 + hw * 0.8 - ly) / (hw * 0.8);
        if (Math.abs(u - 0.5) * 2 > Math.sqrt(Math.max(0, 1 - k * k))) continue;
        if (k > 0.6) t = 0.05;
      }
      b.set(x, y, wood(x, y, clamp(t, 0, 1), wet < 0.2));
    }
  }
}

/** A straight timber (a brace) between two points, thickness th, lit along its upper edge. */
export function beamLine(c: PaintCtx, ax: number, ay: number, bx: number, by: number, th: number, seed: number): void {
  const b = c.buf, d = c.d;
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(2, Math.ceil(len * d * 1.5));
  const nx = -(by - ay) / len, ny = (bx - ax) / len;
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
    for (let o = -th / 2; o <= th / 2; o += 0.5 / d) {
      const X = Math.round(c.X(px + nx * o)), Y = Math.round(c.Y(py + ny * o));
      const k = (o + th / 2) / th;
      let t = k < 0.25 ? 0.15 : k < 0.7 ? 0.42 : 0.7;
      if (d >= 1 && hash(Math.floor(u * len / 3), Math.floor(k * 3), seed) < 0.08) t += 0.15;
      b.set(X, Y, wood(X, Y, t));
    }
  }
}

export const jetty = definePainter<JettyP>("op.jetty", {
  bounds(p) {
    let up = 4;
    for (const [, hgt] of p.posts ?? []) up = Math.max(up, hgt + 4);
    return [-10, -up, p.w + 10, p.water + 30];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const piles = pileXs(p, seed);
    const posts = new Map(p.posts ?? []);
    // braces first (behind the piles): short knee braces from each pile up to the stringer, and
    // a low waling across the odd bay just above the water
    for (let i = 0; i < piles.length; i++) {
      const x = piles[i]!;
      if (!b.touches(Math.floor(c.X(x - 40)), Math.floor(c.Y(0)), Math.ceil(c.X(x + 40)), Math.ceil(c.Y(p.water + 4)))) continue;
      const yTop = DECK + STRINGER - 1, yLow = DECK + STRINGER + 18 + 4 * hash1(i, seed + 4);
      if (i > 0) beamLine(c, x - 4, yLow, x - 24, yTop, 5, seed + i);
      if (i < piles.length - 1) beamLine(c, x + 4, yLow, x + 24, yTop, 5, seed + i + 30);
      if (i < piles.length - 1 && hash1(i, seed + 7) < 0.45) beamLine(c, x - 2, p.water - 11, piles[i + 1]! + 2, p.water - 11, 5, seed + i + 90);
    }
    // the piles (and the mooring posts that stand past the deck)
    piles.forEach((x, i) => {
      const up = posts.get(i) ?? 0;
      const hw = up ? 8 : 7;
      if (!b.touches(Math.floor(c.X(x - hw - 2)), Math.floor(c.Y(-up - 2)), Math.ceil(c.X(x + hw + 2)), Math.ceil(c.Y(p.water + 26)))) return;
      log(c, x, -up + (up ? 0 : DECK), p.water + 24, hw, p.water, seed + i * 17, up > 0);
      if (up > 0) {
        // an iron band near the top and a rope wound round it, one end hanging
        const by = -up + 7;
        for (let x2 = Math.round(c.X(x - hw)); x2 < Math.round(c.X(x + hw)); x2++) {
          for (let y2 = Math.round(c.Y(by)); y2 < Math.round(c.Y(by + 2.5)); y2++) b.set(x2, y2, x2 < c.X(x - hw * 0.3) ? P.ink[1]! : P.ink[0]!);
        }
        if (d >= 0.5) {
          const ry = -up * 0.45;
          for (let k = 0; k < 4; k++) {
            for (let x2 = Math.round(c.X(x - hw - 1)); x2 < Math.round(c.X(x + hw + 1)); x2++) {
              const Y = Math.round(c.Y(ry + k * 2.6 + (x2 - c.X(x - hw)) / (c.d * 6)));
              b.set(x2, Y, ((x2 + k) & 1) ? P.earth[1]! : P.earth[2]!);
              b.set(x2, Y + 1, P.earth[3]!);
            }
          }
          // the loose end, hanging in a slack curve
          for (let s = 0; s < 18; s += 0.5 / d) {
            const X = Math.round(c.X(x + hw + 1 + s * 0.35)), Y = Math.round(c.Y(ry + 10 + s));
            b.set(X, Y, P.earth[2]!);
            if (d >= 1) b.set(X + 1, Y, P.earth[3]!);
          }
        }
      }
    });
    // the stringer: a long beam under the deck, bolted at every pile, a seam where beams join
    {
      const X0 = Math.max(b.ox, Math.round(c.X(-4))), X1 = Math.min(b.x1, Math.round(c.X(p.w + 4)));
      const Y0 = Math.round(c.Y(DECK)), Y1 = Math.round(c.Y(DECK + STRINGER));
      for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
        const v = (y - Y0 + 0.5) / Math.max(1, Y1 - Y0);
        for (let x = X0; x < X1; x++) {
          const lx = c.lx(x + 0.5);
          let t = v < 0.15 ? 0.2 : v < 0.6 ? 0.42 : v < 0.88 ? 0.58 : 0.85;
          if (d >= 0.5 && vnoise(lx / 30, (y - Y0) / (1.6 * d), seed + 8) > 0.68) t += 0.12;
          const seg = Math.floor(lx / 480);
          if (Math.abs(lx - seg * 480) < 0.8 / d && seg > 0) t = 0.95;
          // bolts at the piles
          for (const px of piles) {
            if (d >= 0.5 && Math.abs(lx - px) < 1.6 && Math.abs(v - 0.5) < 0.2) t = -1;
          }
          b.set(x, y, t < 0 ? P.ink[1]! : wood(x, y, clamp(t, 0, 1), false));
        }
      }
    }
    // the deck: plank ends in a row, each its own width, wear and height
    {
      const r = rng(seed + 9);
      let x = -4;
      const planks: [number, number, number][] = [];
      while (x < p.w + 4) {
        const w = 8 + r() * 7;
        planks.push([x, w, r()]);
        x += w;
      }
      for (const [px, pw, k] of planks) {
        const X0 = Math.round(c.X(px)), X1 = Math.round(c.X(px + pw));
        if (X1 < b.ox || X0 >= b.x1) continue;
        const sag = k < 0.12 ? 1 : 0;
        const Y0 = Math.round(c.Y(sag)), Y1 = Math.round(c.Y(DECK));
        const base = 0.22 + k * 0.25;
        for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
          for (let x2 = Math.max(X0, b.ox); x2 < Math.min(X1, b.x1); x2++) {
            let t: number;
            if (x2 === X1 - 1 || (d >= 1 && x2 === X1 - 2 && bayer4(x2, y) < 0.5)) t = 0.95;
            else if (y === Y0) t = 0.04;
            else if (x2 === X0) t = base - 0.12;
            else {
              t = base + ((y - Y0) / Math.max(1, Y1 - Y0)) * 0.22;
              // end grain: rings and checks on the plank ends at the close band
              if (d >= 1.5 && hash(x2, y, seed + Math.round(px)) < 0.06) t += 0.2;
              if (d >= 1 && vnoise1(c.lx(x2 + 0.5) * 2.5, seed + Math.round(px)) > 0.75) t += 0.1;
            }
            b.set(x2, y, wood(x2, y, clamp(t, 0, 1)));
          }
        }
        // a nail head on the odd plank (close band)
        if (d >= 1.5 && k > 0.5) b.set(Math.round(c.X(px + pw * 0.5)), Math.round(c.Y(DECK * 0.55)), P.ink[1]!);
      }
    }
  },
});

export interface PostP {
  /** Height above the deck and depth below it to the water, px. */
  h: number;
  down: number;
  rope?: boolean;
}

/** A free-standing mooring post (on the deck's edge or in the shallows). */
export const post = definePainter<PostP>("op.post", {
  bounds(p) {
    return [-12, -p.h - 4, 22, p.down + 28];
  },
  paint(c, p) {
    log(c, 0, -p.h, p.down + 24, 7, p.down, c.seed, true);
    const b = c.buf, d = c.d;
    const by = -p.h + 7;
    for (let x2 = Math.round(c.X(-7)); x2 < Math.round(c.X(7)); x2++) {
      for (let y2 = Math.round(c.Y(by)); y2 < Math.round(c.Y(by + 2.5)); y2++) b.set(x2, y2, x2 < c.X(-2) ? P.ink[1]! : P.ink[0]!);
    }
    if (p.rope && d >= 0.5) {
      const ry = -p.h * 0.45;
      for (let k = 0; k < 4; k++) {
        for (let x2 = Math.round(c.X(-8)); x2 < Math.round(c.X(8)); x2++) {
          const Y = Math.round(c.Y(ry + k * 2.6 + (x2 - c.X(-7)) / (c.d * 6)));
          b.set(x2, Y, ((x2 + k) & 1) ? P.earth[1]! : P.earth[2]!);
          b.set(x2, Y + 1, P.earth[3]!);
        }
      }
    }
  },
});

export interface PlankP {
  /** Length, px; anchor at the plank's top-left. */
  w: number;
  t?: number;
}

/** Pilgrims' Leap: one long weathered plank jutting over the drop, lashed down, worn on top. */
export const plank = definePainter<PlankP>("op.plank", {
  bounds(p) {
    return [-4, -2, p.w + 6, (p.t ?? 8) + 16];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const th = p.t ?? 8;
    const XE = Math.round(c.X(p.w));
    const X0 = Math.max(b.ox, Math.round(c.X(0))), X1 = Math.min(b.x1, XE);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      // it sags a little toward its free end
      const sag = Math.pow(Math.max(0, lx / p.w - 0.4) / 0.6, 2) * 2;
      const Y0 = Math.round(c.Y(sag)), Y1 = Math.round(c.Y(sag + th));
      for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
        const v = (y - Y0 + 0.5) / Math.max(1, Y1 - Y0);
        let t = v < 0.15 ? 0.05 : v < 0.6 ? 0.3 : 0.55;
        if (d >= 0.5 && vnoise(lx / 18, v * 4, seed) > 0.7) t += 0.12;
        if (x === XE - 1 || y === Y1 - 1) t = 0.92;
        b.set(x, y, wood(x, y, clamp(t, 0, 1)));
      }
    }
    // rope lashings at its root, and a knot hanging from the outer one
    for (const fx of [0.08, 0.2]) {
      const lx = p.w * fx;
      for (let y = Math.round(c.Y(-1)); y < Math.round(c.Y(th + 3)); y++) {
        for (let x = Math.round(c.X(lx - 2)); x < Math.round(c.X(lx + 2)); x++) b.set(x, y, ((x + y) & 1) ? P.earth[1]! : P.earth[3]!);
      }
    }
    for (let s = 0; s < 10; s += 0.5 / d) b.set(Math.round(c.X(p.w * 0.2 + 1 + s * 0.2)), Math.round(c.Y(th + 3 + s)), P.earth[2]!);
  },
});
