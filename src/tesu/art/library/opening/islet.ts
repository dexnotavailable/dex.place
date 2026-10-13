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
import { beamLine, pileLog } from "./jetty.ts";
import { LX, LY, bladePath, dot, fern, grass, stroke } from "./bank.ts";

export interface IsletP {
  /**
   * One of Kagami's four islets, each its own place (when set, `on` and `at` are not used):
   * "piles" a ruined pile field, "reedbed" a reed bed round a small stone lantern, "crag" a
   * jagged rock with a twisted leaning pine, "torii" the small torii's low mossy islet.
   */
  kind?: "piles" | "reedbed" | "crag" | "torii";
  /** Which way a crag's pine leans out (-1 left, 1 right; default 1). */
  dir?: number;
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
    if (p.kind) {
      const reach = p.kind === "crag" ? 170 : p.kind === "torii" ? 90 : 80;
      const tall = p.kind === "crag" ? p.h * 2.5 + 110 : p.kind === "torii" ? Math.max(56, p.h * 4) + 30 : p.kind === "piles" ? 120 : Math.max(p.h, 60) + 70;
      return [-p.w / 2 - reach, -tall, p.w / 2 + reach, 6];
    }
    const tall = (p.on ?? []).some((k) => k === "pine" || k === "tree" || k === "torii") ? p.h + 140 : p.h + 60;
    return [-p.w * 0.9 - 130, -tall, p.w / 2 + 120, 6];
  },
  paint(c, p) {
    if (p.kind) {
      paintIslet(c, p);
      return;
    }
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

// ---------------------------------------------------------------------------
// Kagami's four islets: each its own place, each meeting the water through wet dark rock, reeds
// and lily pads, so its reflection reads as an islet and never as floating pads. Drawn in whole
// level-1 px (one density at the close band). Light from the upper left.

/** A rock's top over [-w/2, w/2]: noise at three scales over a lopsided envelope; jagged adds heads. */
function islandTop(lx: number, w: number, h: number, seed: number, jag: number): number {
  const u = lx / (w / 2);
  if (Math.abs(u) >= 1) return -Infinity;
  const sk = 0.7 + 0.6 * hash1(1, seed);
  const uu = u < 0 ? -Math.pow(-u, sk) : Math.pow(u, 2 - sk);
  const env = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(uu), 2.2)), 0.55);
  let t = h * env * (0.78 + 0.44 * vnoise1(lx / (w * 0.22) + 2, seed + 2)) + (vnoise1(lx / 5, seed + 3) - 0.5) * 2.4 * env + (vnoise1(lx / 1.7, seed + 4) - 0.5) * 0.9;
  if (jag > 0) {
    // jagged: karst heads and notches, steeper sides
    const f = vnoise1(lx / 7, seed + 5);
    t += jag * h * (Math.pow(f, 3) * 0.55 - 0.12) * env;
  }
  return t - 1.5 * (1 - env);
}

/** A rock above the water: moss on what faces up, lit on the left, wet and dark at the water. */
function paintIsland(c: PaintCtx, cx: number, w: number, h: number, seed: number, jag: number, mossy: number): void {
  const b = c.buf;
  const X0 = Math.max(b.ox, Math.floor(c.X(cx - w / 2) - 1)), X1 = Math.min(b.x1, Math.ceil(c.X(cx + w / 2) + 1));
  for (let x = X0; x < X1; x++) {
    const lx = LX(c, x) - cx;
    const T = islandTop(lx, w, h, seed, jag);
    if (T <= 0.3) continue;
    const sl = (islandTop(lx + 1.5, w, h, seed, jag) - islandTop(lx - 1.5, w, h, seed, jag)) / 3;
    const lit = isFinite(sl) ? (0.62 * sl + 0.78) / Math.sqrt(1 + sl * sl) : 0.4;
    const u = lx / (w / 2);
    const Y0 = Math.max(b.oy, Math.floor(c.Y(-T) - 2)), Y1 = Math.min(b.y1, Math.ceil(c.Y(0.5)));
    for (let y = Y0; y < Y1; y++) {
      const ly = LY(c, y);
      if (ly < -T || ly > 0.5) continue;
      const s = ly + T;
      const wet = -(1.8 + 2.8 * vnoise1(lx / 6, seed + 11));
      const mossD = (1.5 + 5 * mossy * clamp(lit, 0, 1)) * (0.5 + vnoise1(lx / 5, seed + 12)) + (vnoise1(lx / 3.5, seed + 13) > 0.75 ? 4 * mossy : 0);
      let col: number;
      if (ly > wet) col = ly > -0.6 ? P.karst[8]! : P.karst[7]!;
      else if (s < mossD) col = s < 1.1 && lit > 0.7 ? P.moss[2]! : s < mossD * 0.5 && lit > 0.5 ? P.moss[3]! : P.moss[5]!;
      else {
        // limestone: the lit flank on the left, shade on the right, the odd fissure
        let k = u < -0.35 + 0.3 * (vnoise1(ly / 6, seed + 14) - 0.5) ? 1 : u < 0.3 ? 2 : 3;
        if (s < mossD + 1.2 && lit > 0.75) k = 0;
        const fx = (lx + (vnoise1(ly / 7, seed + 15) - 0.5) * 3) / (7 + 6 * hash1(2, seed));
        if (jag > 0 && fx - Math.floor(fx) < 0.1 && s > 3) k = 4;
        if (ly > wet - 3 && k < 3) k++;
        col = [P.karst[2]!, P.karst[3]!, P.karst[4]!, P.karst[6]!, P.karst[7]!][k]!;
      }
      b.set(x, y, col);
    }
  }
}

/** Lily pads on the still water round an islet: thin lenses in clusters, the odd white flower. */
function pads(c: PaintCtx, cx: number, spread: number, n: number, seed: number): void {
  const r = rng(seed);
  let gx = cx + (r() < 0.5 ? -1 : 1) * spread * 0.6;
  for (let i = 0; i < n; i++) {
    // a cluster of three or four, then a jump to the other side
    if (i % 4 === 0) gx = cx + (r() < 0.5 ? -1 : 1) * spread * (0.5 + 0.6 * r());
    const x = gx + (r() - 0.5) * 14;
    const rx = 2.5 + r() * 4.5, fl = r() < 0.15;
    for (let o = -rx; o <= rx; o += 0.5) {
      dot(c, x + o, -0.6, Math.abs(o) < rx * 0.6 ? P.moss[3]! : P.moss[4]!);
      if (Math.abs(o) < rx * 0.7) dot(c, x + o, 0, P.moss[5]!);
    }
    if (fl) {
      dot(c, x, -1.6, P.paper[0]!);
      dot(c, x + 0.6, -1.6, P.blossom[1]!);
    }
  }
}

/** A reed patch standing in the shallows: thin blades, the odd cattail. */
function reedPatch(c: PaintCtx, cx: number, w: number, tall: number, n: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const x = cx + (hash1(i, seed) - 0.5) * w;
    const u = (x - cx) / (w / 2);
    const len = tall * (0.3 + 0.7 * hash1(i, seed + 1)) * (0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - u * u)));
    const a0 = (hash1(i, seed + 2) - 0.45) * 0.45, bend = (hash1(i, seed + 3) - 0.45) * 0.9 * (len / 30);
    grass(c, x, 0.5, len, a0, bend, hash1(i, seed + 4) * 0.8);
    if (hash1(i, seed + 5) < 0.14 && len > tall * 0.55) {
      const pts = bladePath(x, 0.5, len * 0.95, a0, bend);
      const [hx, hy] = pts[Math.floor(pts.length * 0.72)]!;
      for (let j = 0; j < 4; j++) dot(c, hx + a0 * j, hy - j, j < 3 ? P.timber[4]! : P.timber[3]!);
    }
  }
}

/** Pine bark for the islet pines, lit to dark (whole level-1 px): timber, never stone. */
const BARK = [P.timber[2]!, P.timber[3]!, P.timber[4]!, P.timber[5]!, P.timber[6]!];

/** A point along a polyline at share t (0..1 of its segments). */
function along(pts: [number, number][], t: number): [number, number] {
  const f = clamp(t, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i;
  const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!;
  return [ax + (bx - ax) * k, ay + (by - ay) * k];
}

/**
 * A gnarled pine growing out of an islet's rock and leaning out over the water: roots gripping the
 * rock, a twisting trunk that thickens hard at its foot, kinked limbs at different heights (more
 * of them reaching out toward dir), each carrying a needle mass on its own twig, the masses of
 * very different sizes with sky between them.
 */
function islandPine(c: PaintCtx, x: number, y: number, H: number, dir: number, seed: number): void {
  const r = rng(seed);
  const pts: [number, number][] = [];
  const a = 0.5 + 0.2 * r(), bulge = 0.2 + 0.08 * r();
  for (let k = 0; k <= 14; k++) {
    const u = k / 14;
    pts.push([x + dir * H * (a * Math.sin(u * 1.6) - bulge * Math.sin(u * Math.PI * 1.5)) + (vnoise1(u * 4, seed) - 0.5) * H * 0.06, y - H * (0.3 * u + 0.45 * u * u)]);
  }
  const tw = (u: number): number => Math.max(1.4, H * 0.1 * (1 - u * 0.74) * (u < 0.1 ? 1 + ((0.1 - u) / 0.1) * 0.7 : 1));
  const barkCol = (_u: number, sd: number): number => BARK[sd < -0.45 ? 0 : sd < -0.05 ? 1 : sd < 0.45 ? 2 : sd < 0.8 ? 3 : 4]!;
  // roots gripping the rock, down over its shoulders into the cracks
  for (let i = 0; i < 3; i++) {
    const side = i === 1 ? -dir : dir * (i === 0 ? 1 : -0.4);
    const L = 4 + 5 * r();
    stroke(c, [[x, y - 0.5], [x + side * L * 0.55, y + 1 + r()], [x + side * L, y + 3 + 4 * r()]], (u) => Math.max(1, tw(0) * 0.42 * (1 - u * 0.7)), (u, sd) => (sd < -0.2 && u < 0.6 ? P.moss[4]! : BARK[u < 0.5 ? 2 : 3]!));
  }
  // limbs: kinked, tapering, each ending in a mass on its twig
  const sizes = [0.6, 1.5, 0.85, 1.2, 0.5, 1.35, 0.75];
  let si = Math.floor(r() * sizes.length);
  const nb = 5 + Math.floor(r() * 2);
  const masses: [number, number, number, number, number][] = [];
  for (let i = 0; i < nb; i++) {
    const u = clamp(0.3 + 0.62 * (i / (nb - 1)) + (r() - 0.5) * 0.08, 0.25, 0.95);
    const [bx, by] = along(pts, u);
    const side = i === nb - 1 ? dir : r() < 0.68 ? dir : -dir;
    const len = H * (0.16 + 0.22 * r()) * (1 - 0.3 * u) * (side === dir ? 1.25 : 0.8);
    const k1 = len * (0.4 + 0.2 * r());
    const lp: [number, number][] = [[bx, by], [bx + side * k1, by - len * (0.06 + 0.12 * r())], [bx + side * len, by - len * (0.1 + 0.16 * r())]];
    // (a limb reaching left has its lit side on the other hand of the stroke)
    stroke(c, lp, (q) => Math.max(1, tw(u) * 0.5 * (1 - q * 0.6)), (q, sd) => barkCol(q, side > 0 ? sd : -sd));
    const [ex, ey] = lp[2]!;
    const pr = H * 0.13 * sizes[(si++) % sizes.length]!;
    masses.push([ex + side * pr * 0.3, ey - pr * 0.36, pr, ex - side * pr * 0.25, ey + 0.5]);
  }
  // the trunk over its limbs' roots
  stroke(c, pts, (u) => tw(u), barkCol);
  const [tx, ty] = pts[14]!;
  const prT = H * 0.15 * sizes[(si++) % sizes.length]!;
  masses.push([tx + dir * prT * 0.2, ty - prT * 0.3, prT, tx, ty + 1]);
  masses.sort((p, q) => q[1] - p[1]);
  masses.forEach(([mx, my, pr, sx, sy], i) => needlePad(c, mx, my, pr * (2.5 + 0.8 * hash1(i, seed + 5)), pr * (0.8 + 0.2 * hash1(i, seed + 6)), seed + 100 + i * 37, 0, { stem: [sx, sy], bounce: 0.6 }));
}

/** One lobe of a limestone crag: its foot's middle, half width there, height, lean (px of x per px up), seed. */
interface Lobe { x: number; bw: number; ht: number; lean: number; s: number }

/** A lobe's left and right edges at height up above the water (null above it). */
function lobeEdges(L: Lobe, up: number): [number, number] | null {
  const v = up / L.ht;
  const topN = 1 + 0.12 * (vnoise1(L.x * 0.3 + up / 5, L.s + 7) - 0.5);
  if (v > topN || up < -1) return null;
  const vv = clamp(v / topN, 0, 1);
  let half = L.bw * Math.pow(Math.max(0, 1 - Math.pow(vv, 2.3)), 0.42) * (1 - 0.16 * vv);
  // a skirt of fallen rock where it stands in the water
  if (up < 4) half += L.bw * 0.14 * (1 - up / 4);
  const cx = L.x + L.lean * up;
  const nl = (vnoise1(up / 9, L.s) - 0.5) * L.bw * 0.3 + (vnoise1(up / 3.2, L.s + 1) - 0.5) * 1.4;
  const nr = (vnoise1(up / 8, L.s + 2) - 0.5) * L.bw * 0.3 + (vnoise1(up / 2.9, L.s + 3) - 0.5) * 1.4;
  return [cx - half + nl, cx + half + nr];
}

/**
 * A limestone crag standing in the lake: two or three leaning lobes of very different widths
 * fused at their foot, rounded crowns under moss, a bedding ledge or two with grass on it,
 * fissures that open at the top and close lower down, rain stains under the ledges, lit on its
 * upper left, a dark wet band and a bright wet line where it meets the water, fallen stones at its
 * foot. Paints in whole level-1 px. Returns the main lobe for whatever grows on its crown.
 */
function crag(c: PaintCtx, w: number, h: number, dir: number, seed: number): Lobe {
  const b = c.buf;
  const r = rng(seed);
  const lean = -dir;
  const lobes: Lobe[] = [
    { x: -dir * w * 0.02, bw: w * (0.22 + 0.03 * r()), ht: h, lean: lean * (0.26 + 0.1 * r()), s: seed + 11 },
    { x: dir * w * (0.24 + 0.04 * r()), bw: w * (0.15 + 0.04 * r()), ht: h * (0.52 + 0.14 * r()), lean: lean * (0.1 + 0.1 * r()), s: seed + 23 },
    { x: -dir * w * (0.3 + 0.04 * r()), bw: w * (0.09 + 0.03 * r()), ht: h * (0.22 + 0.1 * r()), lean: -lean * 0.12, s: seed + 37 },
  ];
  // per lobe: a ledge or two and a fissure or two
  const ledges = lobes.map((L, i) => [L.ht * (0.3 + 0.26 * hash1(i, seed + 3)), L.ht * (0.62 + 0.2 * hash1(i, seed + 4))].slice(0, i === 0 ? 2 : 1));
  const shelf: [number, number][] = lobes.map((_, i) => [-0.9 + 0.5 * hash1(i, seed + 18), 0.05 + 0.5 * hash1(i, seed + 19)]);
  const fissures: [number, number][][] = lobes.map((_, i) => ([[-0.25 + 0.5 * hash1(i, seed + 5), 0.3 + 0.3 * hash1(i, seed + 6)], [0.15 + 0.4 * hash1(i, seed + 7), 0.5 + 0.25 * hash1(i, seed + 8)]] as [number, number][]).slice(0, i === 0 ? 2 : 1));
  const X0 = Math.max(b.ox, Math.floor(c.X(-w * 0.75))), X1 = Math.min(b.x1, Math.ceil(c.X(w * 0.75)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(-h * 1.15))), Y1 = Math.min(b.y1, Math.ceil(c.Y(0.5)));
  for (let y = Y0; y < Y1; y++) {
    const ly = LY(c, y), up = -ly;
    if (up < -0.5) continue;
    const edges = lobes.map((L) => lobeEdges(L, up));
    for (let x = X0; x < X1; x++) {
      const lx = LX(c, x);
      // the frontmost lobe here (the small ones stand in front of the main tower)
      let k = -1;
      for (let i = 0; i < lobes.length; i++) { const e = edges[i]; if (e && lx >= e[0] && lx <= e[1]) k = i; }
      if (k < 0) continue;
      const L = lobes[k]!, [el, er] = edges[k]!;
      const cx = (el + er) / 2, half = Math.max(0.5, (er - el) / 2);
      const q = (lx - cx) / half, v = up / L.ht;
      let col: number;
      // where a front lobe stands against the one behind it: a dark crevice
      const behind = edges.some((e, i) => i !== k && i < k && e && lx >= e[0] && lx <= e[1]);
      const crevice = behind && (lx - el < 1.2 || er - lx < 1.2);
      // the wet band and the wet line at the water
      const wetH = 1.8 + 2.4 * vnoise1(lx / 6, seed + 9);
      // (the bright line only where the lit side meets the water, broken by lumps and weed)
      if (up < 0.6) col = q < 0.1 && vnoise1(lx / 2.2, seed + 10) > 0.38 ? P.cloud[2]! : q < 0.5 && hash1(Math.floor(lx), seed + 12) < 0.4 ? P.jade[3]! : P.karst[8]!;
      else if (up < wetH) col = q < 0 ? P.karst[7]! : P.karst[8]!;
      else if (crevice) col = P.karst[8]!;
      else {
        // planes lit from the upper left; the crown and the ledges face the sky
        let t = q < -0.52 ? 0 : q < 0.05 ? 1 : q < 0.55 ? 2 : 3;
        if (v > 0.84 && q < 0.3) t = Math.max(0, t - 1);
        if (q > 0.9 && v < 0.45) t = 2;
        // the lower rock a step darker toward the wet band, damp
        if (v < 0.22 && t < 3) t++;
        // limestone mottling: pits and dissolution hollows
        if (vnoise(lx / 2.6, up / 3.6, seed + 13) > 0.74) t = Math.min(4, t + 1);
        let ramp = [P.karst[2]!, P.karst[3]!, P.karst[5]!, P.karst[6]!, P.karst[7]!][t]!;
        // bedding ledges: grass and moss on top, a dark lip under, stains running down below
        for (const hl of ledges[k]!) {
          const ly0 = hl + (q - 0.2) * L.bw * 0.12 * dir + (vnoise1(lx / 4, seed + 14) - 0.5) * 1.2;
          const du = up - ly0;
          const [s0, s1] = shelf[k]!;
          if (q < s0 || q > s1 + 0.3) continue;
          if (du >= 0 && du < 1.6 && q < s1) ramp = du < 0.8 ? P.moss[q < -0.3 ? 3 : 4]! : P.moss[5]!;
          else if (du < 0 && du > -1.1) ramp = P.karst[6]!;
          else if (du < -1.1 && du > -6 - 4 * hash1(Math.floor(lx * 0.8), seed + 15) && hash1(Math.floor(lx * 0.8), seed + 16) < 0.3 && q > -0.6) ramp = P.karst[t >= 2 ? 6 : 4]!;
        }
        // fissures: open at the top, closing lower down
        for (const [fq, fv] of fissures[k]!) {
          const fx = cx + (fq + 0.07 * Math.sin(up / 4 + fq * 9)) * half;
          const open = clamp((v - fv) / 0.25, 0, 1);
          if (open > 0 && Math.abs(lx - fx) < 0.45 + open * 0.55) ramp = P.karst[open > 0.6 ? 8 : 7]!;
        }
        // moss on the crown, thickest on the lit shoulder
        const crown = L.ht * (1 + 0.12 * (vnoise1(L.x * 0.3 + up / 5, L.s + 7) - 0.5)) - up;
        if (crown < 2.5 + 3 * vnoise1(lx / 3, seed + 17) && q < 0.6) ramp = P.moss[crown < 1 && q < 0 ? 2 : q < -0.2 ? 3 : 5]!;
        col = ramp;
      }
      dot(c, lx, ly, col);
    }
  }
  // stones fallen at its foot, half in the water
  for (let i = 0; i < 3; i++) {
    const sx = (i === 0 ? -1 : i === 1 ? 1 : -0.4) * w * (0.36 + 0.12 * r()) * (i === 2 ? 0.6 : 1), rx = 2.5 + 3.5 * r(), ry = 1.6 + 1.6 * r();
    for (let oy = -ry; oy <= 0.5; oy += 0.5) for (let ox = -rx; ox <= rx; ox += 0.5) {
      const e = (ox / rx) ** 2 + (oy / ry) ** 2;
      if (e > 1) continue;
      const lit = -ox / rx * 0.6 - oy / ry * 0.6;
      dot(c, sx + ox, oy, oy > -0.7 ? P.karst[8]! : lit > 0.4 ? P.karst[2]! : lit > -0.1 ? P.karst[4]! : P.karst[6]!);
    }
  }
  return lobes[0]!;
}

/**
 * A low base standing in the water (P3: simpler and cooler than the near shore): an uneven bar of
 * mud with a broken top, a few small limestone blocks of very different sizes in it (a lit top
 * ledge with a green cap, the face going into shade on the right), a dark wet band and a broken
 * bright line where it meets the water; the lake mirrors it from that contact.
 */
function isletBase(c: PaintCtx, cx: number, w: number, h: number, nb: number, seed: number): void {
  const b = c.buf;
  const r = rng(seed);
  const half = w / 2;
  const top = (lx: number): number => {
    const u = (lx - cx) / half;
    if (Math.abs(u) >= 1) return -Infinity;
    const ends = Math.pow(1 - Math.pow(Math.abs(u), 2.2), 0.6);
    return h * 0.55 * ends * (0.6 + 0.8 * vnoise1(lx / 7, seed + 1)) + (vnoise1(lx / 2.3, seed + 2) - 0.5) * 0.9;
  };
  // the blocks: [x0, x1, height, tilt]
  const blocks: [number, number, number, number][] = [];
  for (let i = 0; i < nb; i++) {
    const bw = 4 + r() * w * 0.2, bx = cx + (r() - 0.5) * (w - bw) * 0.9;
    blocks.push([bx - bw / 2, bx + bw / 2, h * (0.5 + 0.55 * r()) * (i === 0 ? 1 : 0.85), (r() - 0.5) * 0.25]);
  }
  blocks.sort((p, q) => p[2] - q[2]);
  const X0 = Math.max(b.ox, Math.floor(c.X(cx - half - 2))), X1 = Math.min(b.x1, Math.ceil(c.X(cx + half + 2)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(-h - 4))), Y1 = Math.min(b.y1, Math.ceil(c.Y(0.6)));
  for (let x = X0; x < X1; x++) {
    const lx = LX(c, x);
    const T = top(lx);
    for (let y = Y0; y < Y1; y++) {
      const ly = LY(c, y);
      let col = 0;
      // the blocks (the tallest drawn last, in front)
      for (const [a, z, bh, tl] of blocks) {
        const bt = -bh + tl * (lx - a) + (vnoise1(lx / 3, seed + 7 + Math.round(a)) - 0.5) * 1.1;
        const sl = a + (vnoise1(ly / 3.7, seed + 9) - 0.5) * 1.2, sr = z + (vnoise1(ly / 3.3, seed + 10) - 0.5) * 1.2;
        if (lx < sl || lx > sr || ly < bt || ly > 0.5) continue;
        const u = (lx - sl) / Math.max(1, sr - sl), s = ly - bt;
        col = s < 1.1 + 1.4 * vnoise1(lx / 4, seed + 11) ? (u < 0.6 ? P.moss[3]! : P.moss[4]!)
          : ly > -1.6 ? P.karst[7]!
          : u < 0.3 ? P.karst[3]! : u < 0.72 ? P.karst[4]! : P.karst[6]!;
      }
      if (!col && T > 0.3 && ly >= -T && ly <= 0.5) {
        const s = ly + T;
        col = s < 1 ? (vnoise1(lx / 5, seed + 12) > 0.45 ? P.moss[4]! : P.earth[3]!) : ly > -1.4 ? P.karst[8]! : s < 2.6 ? P.moss[5]! : P.earth[4]!;
      }
      if (!col) continue;
      // the bright line at the water, broken
      if (ly > 0 && vnoise1(lx / 2.6, seed + 13) > 0.55) col = P.jade[2]!;
      b.set(x, y, col);
    }
  }
}

/** Wet mud heaped round a post's foot: a low dark hump, its lit edge, a stone or two. */
function mudHump(c: PaintCtx, x: number, hw: number, hh: number, seed: number): void {
  for (let ox = -hw; ox <= hw; ox += 0.5) {
    const u = ox / hw;
    const top = hh * Math.pow(1 - u * u, 0.7) * (0.75 + 0.5 * vnoise1((x + ox) / 2.5, seed));
    for (let up = 0; up < top; up += 0.5) {
      const edge = top - up < 0.6;
      dot(c, x + ox, -up, up < 0.6 ? (u < 0 ? P.jade[3]! : P.karst[8]!) : edge ? (u < 0.2 ? P.earth[3]! : P.earth[4]!) : P.earth[5]!);
    }
  }
  if (hash1(1, seed) < 0.6) {
    const sx = x + (hash1(2, seed) - 0.5) * hw;
    dot(c, sx, -hh - 0.2, P.karst[3]!);
    dot(c, sx + 0.6, -hh - 0.2, P.karst[5]!);
  }
}

function paintIslet(c: PaintCtx, p: IsletP): void {
  const seed = c.seed;
  const w = p.w, h = p.h;
  if (p.kind === "piles") {
    // a ruined pile field standing in the water: posts of different heights and thickness (a
    // pair, a three, a straggler), two broken, a beam fallen from them into the water; no bar of
    // land under them, only wet mud heaped at their feet, reeds in clumps and lily pads, the lake
    // running through between them
    const xs = [-0.42, -0.33, -0.08, 0.02, 0.1, 0.38];
    const hs = [46, 30, 58, 22, 40, 16];
    const posts = xs.map((u, i) => ({ x: u * w + (hash1(i, seed + 5) - 0.5) * 6, hh: hs[i]! * (0.85 + 0.3 * hash1(i, seed + 6)), wd: 3.5 + 2.5 * hash1(i, seed + 7), lean: (hash1(i, seed + 8) - 0.5) * 3, broken: i === 2 || i === 5 }));
    // low bases of mud and small blocks under the two groups of posts, the lake between them
    isletBase(c, w * -0.37, w * 0.32, 9, 3, seed + 60);
    isletBase(c, w * 0.02, w * 0.38, 11, 4, seed + 61);
    for (const [i, q] of posts.entries()) mudHump(c, q.x, q.wd * 0.9 + 3 + 3 * hash1(i, seed + 9), 1 + 1.6 * hash1(i, seed + 10), seed + 40 + i);
    reedPatch(c, -w * 0.38, w * 0.22, 22, 14, seed + 2);
    reedPatch(c, -w * 0.02, w * 0.16, 18, 9, seed + 3);
    posts.forEach((q, i) => pileLog(c, { x: q.x, hw: q.wd / 2, top: -q.hh, foot: 1, lean: -q.lean, wet: 3 + 4 * hash1(i, seed + 11), moss: 7 + 8 * hash1(i, seed + 12), age: 0, back: false, broken: q.broken, lash: 0, k: hash1(i, seed + 13) }, 0, seed + 10 + i * 7));
    // the fallen beam: from the tall broken post's shoulder down into the water, its end wet
    const tall = posts[2]!;
    beamLine(c, tall.x + 2.5, -tall.hh * 0.7, 0.3 * w, -0.6, 3.4, seed + 30, 0.14);
    for (let i = 0; i < 6; i++) grass(c, w * (0.27 + 0.08 * hash1(i, seed + 20)), 0.5, 4 + 8 * hash1(i, seed + 21), (hash1(i, seed + 22) - 0.5) * 0.9, 0.3, 0.4);
    reedPatch(c, w * 0.42, w * 0.12, 14, 6, seed + 4);
    pads(c, 0, w * 0.55, 13, seed + 30);
  } else if (p.kind === "reedbed") {
    // a reed bed round a little mossy knoll and a small stone lantern
    const kh = Math.max(5, h);
    paintIsland(c, w * 0.08, w * 0.42, kh, seed + 1, 0, 1.4);
    reedPatch(c, -w * 0.22, w * 0.55, 34, 46, seed + 2);
    lantern(c, w * 0.12, -Math.max(0, islandTop(w * 0.04, w * 0.42, kh, seed + 1, 0)) + 1.5, 30);
    reedPatch(c, w * 0.32, w * 0.4, 30, 30, seed + 3);
    pads(c, 0, w * 0.5, 14, seed + 30);
  } else if (p.kind === "crag") {
    // a leaning limestone crag of fused lobes, ferns in its clefts, a twisted pine growing out of
    // its crown and leaning out over the water, reeds at its feet
    const dir = p.dir ?? 1;
    reedPatch(c, -dir * w * 0.46, w * 0.3, 20, 16, seed + 3);
    const L = crag(c, w, h, dir, seed + 1);
    const r = rng(seed + 40);
    for (let i = 0; i < 3; i++) {
      const up = L.ht * (0.3 + 0.4 * r());
      const fx = L.x + L.lean * up + (r() - 0.3) * L.bw * 0.8;
      fern(c, fx, -up, 6 + r() * 7, (r() < 0.5 ? -1 : 1) * (0.4 + 0.5 * r()), seed + 50 + i);
    }
    // the pine roots in the crown's lit shoulder
    const top = L.ht * 0.9;
    islandPine(c, L.x + L.lean * top + dir * L.bw * 0.15, -top + 1.5, h * 1.0 + 16, dir, seed + 60);
    reedPatch(c, dir * w * 0.4, w * 0.14, 12, 7, seed + 5);
    pads(c, 0, w * 0.6, 10, seed + 30);
  } else {
    // the torii's islet: a low mossy rock and a stone, reeds on both sides, the torii's posts
    // standing in the shallows with wet dark feet
    // a low base of mud and small limestone blocks, its top broken, a second smaller one by it
    isletBase(c, -w * 0.14, w * 0.7, Math.max(8, h), 5, seed + 1);
    isletBase(c, w * 0.34, w * 0.2, Math.max(5, h * 0.6), 2, seed + 4);
    reedPatch(c, -w * 0.48, w * 0.32, 24, 22, seed + 2);
    const H = Math.max(56, h * 4);
    const tx = w * 0.06;
    torii(c, tx, 1, H);
    // wet dark feet on the posts, a bright wet line where they meet the water
    const span = H * 0.62, pw = Math.max(1.5, H * 0.07);
    for (const sx of [-1, 1]) {
      const fx = tx + (sx * span) / 2;
      const wh = 5 + 2 * hash1(sx + 3, seed);
      for (let o = -pw / 2; o <= pw / 2; o += 0.5) for (let up = 0; up < wh; up += 0.5) dot(c, fx + o, -up, up < 0.6 ? P.cloud[2]! : up < 2.5 ? P.red[5]! : P.red[4]!);
    }
    reedPatch(c, w * 0.5, w * 0.3, 20, 16, seed + 3);
    pads(c, tx, w * 0.6, 12, seed + 30);
  }
}
