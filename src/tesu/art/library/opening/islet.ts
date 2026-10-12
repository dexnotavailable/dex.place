// Kagami's middle distance (P3): small islets standing in the still lake, so the mirror stays
// open and the eye has stepping stones into the distance (reference 4's islet with its ruins).
// A low karst knob, mossy, its foot wet at the waterline, carrying one thing: a gnarled pine
// leaning out over the water, a broadleaf tree, a stone lantern, a small vermilion torii
// standing in the shallows, or a few old pilings. Reed patches and lily pads around it. The
// lake reflects all of it (the plane is mirrored about its own waterline).
//
// Anchor: the waterline at the islet's centre. Sizes in level-1 px of the back plane.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { clamp, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { clump } from "./kit.ts";
import { needlePad } from "./flora.ts";

export interface IsletP {
  /** Rock width and height above the water, px (0 for none: pilings or reeds only). */
  w: number;
  h: number;
  /** What stands on it. */
  on?: ("pine" | "tree" | "lantern" | "torii" | "posts" | "reeds")[];
  /** Offset of the thing on top along the rock, -1..1 (default 0). */
  at?: number;
}

/** Height of the rock's top above the water at local x (0 outside). */
function rockTop(p: IsletP, x: number, seed: number): number {
  const u = x / (p.w / 2);
  if (Math.abs(u) >= 1) return 0;
  const shape = Math.pow(1 - Math.pow(Math.abs(u), 2.4), 0.6);
  return p.h * shape * (0.82 + 0.3 * vnoise1(x / 9, seed + 1)) + (vnoise1(x / 3, seed + 2) - 0.5) * 1.5;
}

/** A gnarled pine: a trunk that leans out and twists, branches ending in flat pads of needles. */
export function pine(c: PaintCtx, x: number, y: number, H: number, dir: number, seed: number): void {
  const b = c.buf, d = c.d;
  const r = rng(seed);
  const pts: [number, number][] = [];
  const bend = 0.3 + 0.3 * r();
  for (let k = 0; k <= 12; k++) {
    const u = k / 12;
    pts.push([x + dir * H * bend * Math.sin(u * 1.8) + (vnoise1(u * 4, seed) - 0.5) * H * 0.12, y - H * u]);
  }
  // branches: from the upper trunk, out to the side, each ending in a pad
  const pads: [number, number, number][] = [];
  const nb = 3 + Math.floor(r() * 3);
  for (let i = 0; i < nb; i++) {
    const u = 0.4 + 0.6 * (i / Math.max(1, nb - 1));
    const [bx, by] = pts[Math.round(u * 12)]!;
    const side = i === nb - 1 ? dir : r() < 0.6 ? dir : -dir;
    const len = H * (0.18 + 0.28 * r()) * (1 - 0.4 * u);
    const ex = bx + side * len, ey = by - len * 0.15 + (r() - 0.5) * H * 0.08;
    const steps = Math.max(2, Math.ceil(len * d));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      b.set(Math.round(c.X(bx + (ex - bx) * t)), Math.round(c.Y(by + (ey - by) * t + Math.sin(t * Math.PI) * -len * 0.12)), P.timber[5]!);
    }
    pads.push([ex, ey, H * (0.12 + 0.08 * r()) * (1 - 0.3 * u)]);
  }
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!;
    const w = Math.max(1 / d, H * 0.07 * (1 - (k / 12) * 0.7));
    const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * d));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const X = c.X(ax + (bx - ax) * t), Y = Math.round(c.Y(ay + (by - ay) * t));
      for (let o = -w * d / 2; o <= w * d / 2; o += 1) b.set(Math.round(X + o), Y, o < -w * d * 0.15 ? P.timber[3]! : o < w * d * 0.2 ? P.timber[4]! : P.timber[5]!);
    }
  }
  // the crown pad at the top, then the side pads: flat layered needle clouds lit from above
  const [tx, ty] = pts[12]!;
  pads.push([tx, ty, H * 0.2]);
  for (const [px, py, pr] of pads) needlePad(c, px, py - pr * 0.1, pr * 3, pr * 0.85, seed + Math.round(px * 3));
}

/** A broadleaf tree: a short trunk under a crown of heaped clumps. */
function tree(c: PaintCtx, x: number, y: number, H: number, seed: number): void {
  const b = c.buf, d = c.d;
  const tw = Math.max(1 / d, H * 0.06);
  for (let ly = y; ly > y - H * 0.5; ly -= 1 / d) {
    for (let o = -tw / 2; o <= tw / 2; o += 1 / d) b.set(Math.round(c.X(x + o + (y - ly) * 0.05)), Math.round(c.Y(ly)), o < 0 ? P.timber[4]! : P.timber[5]!);
  }
  const r = rng(seed);
  const parts: [number, number, number][] = [];
  for (let i = 0; i < 6; i++) parts.push([x + (r() - 0.5) * H * 0.6, y - H * (0.55 + 0.3 * r()), H * (0.16 + 0.12 * r())]);
  parts.sort((a, q) => a[1] - q[1]);
  for (const [px, py, pr] of parts) clump(c, px, py, pr, P.moss.slice(2, 7), P.pine.slice(2), 0.4, seed + Math.round(px * 5), 0.85);
}

/** A stone lantern (tōrō): base, post, firebox, a curved cap. */
function lantern(c: PaintCtx, x: number, y: number, H: number): void {
  const b = c.buf;
  const part = (y0: number, y1: number, hw: number): void => {
    const X0 = Math.round(c.X(x - hw)), X1 = Math.round(c.X(x + hw)), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
    for (let yy = Y0; yy < Y1; yy++) for (let xx = X0; xx < X1; xx++) {
      const u = (xx - X0 + 0.5) / Math.max(1, X1 - X0);
      b.set(xx, yy, tone(P.stone, u < 0.3 ? 0.2 : u < 0.7 ? 0.45 : 0.7, xx, yy, 0.3));
    }
  };
  part(y - H * 0.12, y, H * 0.24);
  part(y - H * 0.55, y - H * 0.12, H * 0.08);
  part(y - H * 0.62, y - H * 0.55, H * 0.2);
  part(y - H * 0.8, y - H * 0.62, H * 0.15);
  // the firebox's window
  const wx0 = Math.round(c.X(x - H * 0.05)), wx1 = Math.round(c.X(x + H * 0.05));
  for (let yy = Math.round(c.Y(y - H * 0.76)); yy < Math.round(c.Y(y - H * 0.66)); yy++) for (let xx = wx0; xx < wx1; xx++) b.set(xx, yy, P.ink[1]!);
  // the cap: a low curved roof with turned-up ends
  for (let ly = y - H; ly < y - H * 0.8; ly += 1 / c.d) {
    const v = (ly - (y - H)) / (H * 0.2);
    const hw = H * (0.08 + 0.24 * v * v + (v > 0.8 ? 0.04 : 0));
    const Y = Math.round(c.Y(ly));
    for (let xx = Math.round(c.X(x - hw)); xx < Math.round(c.X(x + hw)); xx++) {
      const u = (c.lx(xx + 0.5) - (x - hw)) / (2 * hw);
      b.set(xx, Y, tone(P.stone, v > 0.85 ? 0.75 : u < 0.35 ? 0.15 : 0.5, xx, Y, 0.3));
    }
  }
  if (hash(Math.round(x), 1, 3) < 2) part(y - H * 1.06, y - H, H * 0.04);
}

/** A small vermilion torii standing in the shallows. */
function torii(c: PaintCtx, x: number, y: number, H: number): void {
  const b = c.buf;
  const span = H * 0.62;
  const R = P.red;
  const rect = (x0: number, y0: number, x1: number, y1: number, ramp: readonly number[], t0: number): void => {
    const X0 = Math.round(c.X(x0)), X1 = Math.max(Math.round(c.X(x0)) + 1, Math.round(c.X(x1))), Y0 = Math.round(c.Y(y0)), Y1 = Math.round(c.Y(y1));
    for (let yy = Y0; yy < Y1; yy++) for (let xx = X0; xx < X1; xx++) {
      const u = (xx - X0 + 0.5) / Math.max(1, X1 - X0);
      b.set(xx, yy, tone(ramp, clamp(t0 + (u > 0.6 ? 0.25 : u < 0.25 ? -0.1 : 0), 0, 1), xx, yy, 0.3));
    }
  };
  const pw = Math.max(1.5, H * 0.07);
  rect(x - span / 2 - pw / 2, y - H * 0.86, x - span / 2 + pw / 2, y + 2, R, 0.35);
  rect(x + span / 2 - pw / 2, y - H * 0.86, x + span / 2 + pw / 2, y + 2, R, 0.35);
  rect(x - span / 2 - H * 0.12, y - H * 0.74, x + span / 2 + H * 0.12, y - H * 0.68, R, 0.4);
  // the kasagi: a black-capped lintel sweeping up at the ends
  for (let lx = -span / 2 - H * 0.22; lx <= span / 2 + H * 0.22; lx += 1 / c.d) {
    const k = Math.abs(lx) / (span / 2 + H * 0.22);
    const lift = H * 0.08 * Math.pow(Math.max(0, k - 0.5) / 0.5, 2);
    const X = Math.round(c.X(x + lx));
    for (let yy = Math.round(c.Y(y - H - lift)); yy < Math.round(c.Y(y - H * 0.88 - lift)); yy++) {
      const v = (c.ly(yy + 0.5) - (y - H - lift)) / (H * 0.12);
      b.set(X, yy, v < 0.35 ? P.lacquer[2]! : tone(R, v > 0.8 ? 0.7 : 0.35, X, yy, 0.3));
    }
  }
}

export const islet = definePainter<IsletP>("op.islet", {
  bounds(p) {
    const tall = (p.on ?? []).some((k) => k === "pine" || k === "tree" || k === "torii") ? p.h + 140 : p.h + 60;
    return [-p.w * 0.9 - 130, -tall, p.w / 2 + 120, 6];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    // the rock: a low knob of karst, mossy on top, lit left, a wet dark band at the water
    if (p.w > 0 && p.h > 0) {
      const X0 = Math.max(b.ox, Math.floor(c.X(-p.w / 2))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w / 2)));
      for (let x = X0; x < X1; x++) {
        const lx = c.lx(x + 0.5);
        const top = rockTop(p, lx, seed);
        if (top <= 0) continue;
        const Yt = Math.ceil(c.Y(-top)), Yb = Math.ceil(c.Y(1));
        const u = lx / (p.w / 2);
        for (let y = Math.max(Yt, b.oy); y < Math.min(Yb, b.y1); y++) {
          const a = -c.ly(y + 0.5);
          const below = top - a;
          let ramp: readonly number[] = P.karst;
          let t: number;
          const mossD = 3 + 5 * vnoise1(lx / 7, seed + 3);
          if (below < mossD) {
            ramp = P.moss;
            t = below < 1.2 / d ? 0.2 : 0.45 + (u > 0.2 ? 0.2 : 0);
          } else {
            t = 0.25 + 0.4 * clamp((u + 1) / 2, 0, 1) + (vnoise(lx / 2, a / 6, seed + 5) - 0.5) * 0.2;
            if (a < 3) t += 0.3;
          }
          if (y === Yb - 1 || lx > p.w / 2 - 1.5 / d) t += 0.15;
          b.set(x, y, tone(ramp, clamp(t, 0, 1), x, y, 0.35));
        }
      }
    }
    const at = (p.at ?? 0) * p.w * 0.3;
    const base = -rockTop(p, at, seed) + 1;
    for (const k of p.on ?? []) {
      if (k === "pine") pine(c, at, base, 70 + 40 * hash1(1, seed), hash1(2, seed) < 0.5 ? -1 : 1, seed + 11);
      else if (k === "tree") tree(c, at + p.w * 0.15, -rockTop(p, at + p.w * 0.15, seed) + 1, 60 + 30 * hash1(3, seed), seed + 13);
      else if (k === "lantern") lantern(c, at - p.w * 0.22, -rockTop(p, at - p.w * 0.22, seed) + 1, 26);
      else if (k === "torii") torii(c, at + p.w * 0.5 + 34, 1, 54);
      else if (k === "posts") {
        for (let i = 0; i < 4; i++) {
          const px = at - p.w * 0.6 - 18 - i * (12 + 9 * hash1(i, seed));
          const ph = 10 + 16 * hash1(i + 4, seed);
          const lean = (hash1(i + 8, seed) - 0.5) * 0.15;
          for (let ly = 1; ly > -ph; ly -= 1 / d) {
            for (let o = -1.5; o <= 1.5; o += 1 / d) b.set(Math.round(c.X(px + o + lean * -ly)), Math.round(c.Y(ly)), o < -0.5 ? P.timber[3]! : P.timber[5]!);
          }
        }
      } else if (k === "reeds") {
        for (let i = 0; i < 26; i++) {
          const rx = at + (hash1(i, seed + 21) - 0.5) * (p.w + 90);
          const rh = 6 + 18 * hash1(i, seed + 22);
          const lean = (hash1(i, seed + 23) - 0.4) * 0.3;
          for (let s = 0; s < rh; s += 1 / d) b.set(Math.round(c.X(rx + lean * s)), Math.round(c.Y(1 - s)), P.moss[s < rh * 0.5 ? 5 : 4]!);
        }
      }
    }
  },
});
