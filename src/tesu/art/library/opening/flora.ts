// Trees and terraces that frame Kagami's east lip and Gate Road: great cliff pines growing out of
// the rock (Huangshan pines: roots clawing over the rock and down into its cracks with soil and
// moss at the join, a heavy twisting trunk, arms reaching out nearly level, needles in layered
// masses with ragged tufted tops and dark undersides), a bamboo grove by the forecourt that sways,
// and the viewing terrace itself, a paved platform built out over the rock with a cut-stone
// retaining face.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { contact } from "./props.ts";

/**
 * A mass of pine needles seen side-on: wider than tall, two or three lobes of different sizes
 * grown together. Its top is a ragged row of needle fans (each a tuft of needles radiating up,
 * lit on its upper left), its body dark with needle texture, its underside darker still with
 * fans of needles pointing down and the odd longer tassel. (cx, cy): the mass's middle; w, h:
 * its width and depth; dark (0..1) deepens it (a mass in shade, or near the camera).
 */
export function needlePad(c: PaintCtx, cx: number, cy: number, w: number, h: number, seed: number, dark = 0): void {
  const b = c.buf, d = c.d;
  const hw = w / 2;
  if (!b.touches(Math.floor(c.X(cx - hw - h)), Math.floor(c.Y(cy - h * 1.4)), Math.ceil(c.X(cx + hw + h)), Math.ceil(c.Y(cy + h * 1.1)))) return;
  // lobes: the mass is two or three clumps grown together, never one smooth blob
  const nl = 2 + Math.floor(hash1(11, seed) * 2.99);
  const lobes: [number, number, number][] = [];
  for (let i = 0; i < nl; i++) lobes.push([(hash1(i, seed + 12) - 0.5) * 1.15, 0.34 + hash1(i, seed + 13) * 0.42, 0.45 + hash1(i, seed + 14) * 0.55]);
  const env = (u: number): number => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.4)), 0.5);
  const lobeAt = (u: number): number => {
    let l = 0;
    for (const [uc, wl, hl] of lobes) {
      const q = (u - uc) / wl;
      if (Math.abs(q) < 1) l = Math.max(l, hl * Math.pow(1 - q * q, 0.45));
    }
    return Math.max(l * env(u), env(u) * 0.3);
  };
  const topAt = (u: number): number => -h * 0.5 * lobeAt(u);
  const botAt = (u: number): number => h * 0.2 * Math.max(env(u), 0.2);
  // a needle stroke from (x, y) at angle a, length L, drooping a little; inner part darker
  const stroke = (x: number, y: number, a: number, L: number, col: number, inner: number): void => {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let s = 0; s <= L; s += 0.5 / d) {
      b.set(Math.round(c.X(x + ca * s)), Math.round(c.Y(y + sa * s + s * s * 0.015)), s < L * 0.4 ? inner : col);
    }
  };
  const fan = (x: number, y: number, rf: number, a0: number, a1: number, cols: (a: number) => [number, number], s: number): void => {
    const k = Math.max(4, Math.min(16, Math.round(rf * d * 1.5)));
    for (let i = 0; i < k; i++) {
      const a = a0 + (a1 - a0) * ((i + 0.2 + hash1(i, s) * 0.6) / k);
      const [col, inner] = cols(a);
      stroke(x, y, a, rf * (0.65 + 0.5 * hash1(i, s + 1)), col, inner);
    }
  };
  // the core: a dark mass under the fans
  {
    const X0 = Math.floor(c.X(cx - hw)), X1 = Math.ceil(c.X(cx + hw));
    for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
      const lx = c.lx(x + 0.5) - cx, u = lx / hw;
      if (Math.abs(u) > 0.97) continue;
      const top = topAt(u) * 0.82, bot = botAt(u) * 0.85;
      for (let y = Math.max(Math.ceil(c.Y(cy + top)), b.oy); y < Math.min(Math.ceil(c.Y(cy + bot)), b.y1); y++) {
        const ly = c.ly(y + 0.5) - cy;
        const v = (ly - top) / Math.max(0.5, bot - top);
        let t = 0.5 + v * 0.42 + (u > 0.4 ? 0.1 : 0) + dark;
        if (d >= 0.5 && hash(Math.floor((lx + ly * 0.8) * 1.3), Math.floor(ly / 1.5), seed + 9) < 0.22) t += 0.14;
        b.set(x, y, tone(P.pine, clamp(t, 0, 1), x, y, 0.3));
      }
    }
  }
  const dk = Math.round(dark * 3);
  const pick = (i: number): number => P.pine[clamp(i + (i > 0 ? dk : 0), 0, 5)]!;
  // under fans: needles pointing down and out, a few long tassels
  const sz = Math.max(1.8, h * 0.3);
  const nU = Math.max(2, Math.round(w / Math.max(3, h * 0.42)));
  for (let i = 0; i < nU; i++) {
    const u = -0.92 + (1.84 * (i + 0.3 + hash1(i, seed + 20) * 0.4)) / nU;
    const rf = sz * (0.7 + 0.6 * hash1(i, seed + 21)) * (hash1(i, seed + 22) < 0.2 ? 1.6 : 1) * (0.5 + 0.5 * env(u));
    fan(cx + u * hw, cy + botAt(u) * 0.7, rf, 0.35, Math.PI - 0.35, () => [pick(u > 0.3 ? 5 : 4), pick(5)], seed + 300 + i);
  }
  // fans inside the mass: needle texture, mid tones
  if (d >= 0.5) {
    const nM = Math.round((w * h) / 30);
    for (let i = 0; i < nM; i++) {
      const u = (hash1(i, seed + 30) - 0.5) * 1.8;
      const yy = topAt(u) * 0.6 + (botAt(u) * 0.6 - topAt(u) * 0.6) * hash1(i, seed + 31);
      const a0 = -Math.PI * (0.9 + 0.2 * hash1(i, seed + 32));
      fan(cx + u * hw, cy + yy, sz * (0.5 + 0.4 * hash1(i, seed + 33)), a0, a0 + Math.PI * 1.1, (a) => [pick(Math.sin(a) < -0.3 ? 2 : 3 + (u > 0.35 ? 1 : 0)), pick(4)], seed + 500 + i);
    }
  }
  // the top: a ragged row of fans radiating up, lit on the sun's side
  const nT = Math.max(3, Math.round(w / Math.max(2.4, h * 0.3)));
  for (let i = 0; i < nT; i++) {
    const u = -0.95 + (1.9 * (i + 0.2 + hash1(i, seed + 40) * 0.6)) / nT;
    const e = env(u);
    const rf = sz * (0.75 + 0.6 * hash1(i, seed + 41)) * (0.55 + 0.45 * Math.sqrt(e));
    const fy = topAt(u) + rf * 0.45;
    const sun = u < 0.25;
    fan(cx + u * hw, cy + fy, rf, -Math.PI + 0.25, -0.25, (a) => {
      const lit = a < -2.2 ? 0 : a < -1.3 ? 1 : 2;
      if (lit === 0 && sun && hash1(i, seed + 42) < 0.5) return [P.moss[4]!, pick(2)];
      return [pick(lit + (sun ? 0 : 1)), pick(lit + 2)];
    }, seed + 700 + i);
  }
}

export interface PineP {
  /** Height of the tree, px; anchor at the root on the rock. */
  h: number;
  /** Lean: -1 out to the left, 1 to the right. */
  dir?: number;
  /** A long arm reaching out toward dir: [length px, share of the trunk's height it leaves from]. */
  arm?: [number, number];
  /** How far the trunk swings out toward dir (default 1; negative leans it back). */
  bend?: number;
  /** Arms grow from this share of the trunk up (default 0.38). */
  armsFrom?: number;
  /** Roots: how far they spread along the rock and how deep they claw down below the anchor, px. */
  roots?: number;
  grip?: number;
}

/** Pine bark, lit to dark: grey plates on the sun's side, warm brown in the fissures and shade. */
const BARK = [P.stone[4]!, P.timber[4]!, P.timber[5]!, P.timber[6]!, P.timber[6]!];

/** A twisting limb from (ax, ay) to (bx, by), width w0 tapering to w1, bark lit on its upper side. */
function limb(c: PaintCtx, pts: [number, number][], w0: number, w1: number, seed: number, root = false): void {
  const b = c.buf, d = c.d;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!;
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.ceil(len * d * 1.4));
    const nx = -(by - ay) / Math.max(1e-6, len), ny = (bx - ax) / Math.max(1e-6, len);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = (k + t) / (pts.length - 1);
      const w = Math.max(1 / d, w0 + (w1 - w0) * Math.pow(u, 1.4));
      const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
      for (let o = -w / 2; o <= w / 2; o += 0.5 / d) {
        const q = o / Math.max(0.5, w / 2);
        // lit on the side facing up and left
        const up = ny < 0 ? -q : q;
        let i = up > 0.45 ? 0 : up > -0.2 ? 1 : up > -0.7 ? 2 : 3;
        if (d >= 0.5 && w * d > 3 && hash(Math.round((px + nx * o) * d / 2), Math.round((py + ny * o) * d / 3), seed) < 0.14) i = Math.min(4, i + 1);
        if (root) {
          // roots: earthy, moss in their upper creases
          if (up > 0.2 && vnoise((px + nx * o) / 2.5, (py + ny * o) / 2, seed + 7) > 0.58) { b.set(Math.round(c.X(px + nx * o)), Math.round(c.Y(py + ny * o)), P.moss[up > 0.6 ? 3 : 5]!); continue; }
          i = Math.min(4, i + 1);
        }
        b.set(Math.round(c.X(px + nx * o)), Math.round(c.Y(py + ny * o)), BARK[i]!);
      }
    }
  }
}

/** A great cliff pine: roots clawing into the rock, a heavy twisting trunk, arms reaching out nearly level, layered needle masses. */
export const pine = definePainter<PineP>("op.pine", {
  bounds(p) {
    const reach = p.arm ? p.arm[0] + p.h * 0.3 : 0;
    const grip = p.grip ?? p.h * 0.12;
    return [-p.h * 1.35 - reach, -p.h * 1.12 - (reach ? p.h * 0.12 : 0), p.h * 1.35 + reach, Math.max(p.h * 0.1 + 6, grip + 10)];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const H = p.h, dir = p.dir ?? 1;
    const bend = p.bend ?? 1;
    const r = rng(seed);
    // the trunk: leaves the rock, twists, splits into arms (a path by height)
    const pts: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const u = k / 16;
      pts.push([dir * H * bend * (0.35 * Math.sin(u * 2.2) + 0.12 * u) + (vnoise1(u * 5, seed) - 0.5) * H * 0.08, -H * 0.72 * u]);
    }
    const tw = (u: number): number => Math.max(1.5 / d, H * (p.arm ? 0.072 : 0.085) * (1 - u * 0.7));
    const at = (u: number): [number, number] => {
      const f = clamp(u, 0, 1) * 16, i = Math.min(15, Math.floor(f)), t = f - i;
      const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!;
      return [ax + (bx - ax) * t, ay + (by - ay) * t];
    };
    // roots: thick where they leave the trunk, running out over the rock, then down into its cracks
    const spread = p.roots ?? H * 0.15, grip = p.grip ?? H * 0.1;
    const w0 = tw(0);
    const nr = 4 + Math.floor(r() * 2);
    for (let i = 0; i < nr; i++) {
      const side = i % 2 ? -1 : 1;
      const sx = side * w0 * (0.2 + 0.25 * r());
      const len = spread * (0.5 + 0.6 * r());
      const deep = grip * (0.5 + 0.5 * r());
      const rp: [number, number][] = [];
      const over = i === 0;
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        // crawling out over the rock, arched a little where they cross a bump; one goes over the
        // edge into a crack
        const x = sx + side * len * (1 - Math.pow(1 - t, 1.5)) * (over ? 1 : 0.55 + 0.3 * hash1(i, seed + 4));
        const arch = -Math.sin(t * Math.PI) * w0 * (0.08 + 0.1 * hash1(i, seed + 5));
        const y = -w0 * 0.05 + arch + (over ? deep * 0.7 * Math.pow(t, 2.6) : t * 1.5) + (vnoise1(t * 4 + i, seed + 3) - 0.5) * 1.2;
        rp.push([x, y]);
      }
      limb(c, rp, w0 * (0.36 + 0.16 * r()), over ? 2 : 3.5, seed + 40 + i, true);
      // where it goes into the rock: a dark crack
      const [ex, ey] = rp[rp.length - 1]!;
      for (let k = 0; k < 6; k += 0.5 / d) b.set(Math.round(c.X(ex + side * k * 0.3)), Math.round(c.Y(ey + k * 0.6)), P.karst[8]!);
    }
    // soil and moss where the trunk meets the rock
    for (let x = Math.round(c.X(-w0 * 1.5)); x < Math.round(c.X(w0 * 1.5)); x++) {
      const u = c.lx(x + 0.5) / (w0 * 1.5);
      const top = -w0 * 0.3 * Math.pow(1 - u * u, 1.5) - 1.5 * vnoise1(c.lx(x) / 2, seed + 5);
      for (let y = Math.round(c.Y(top)); y < Math.round(c.Y(3 + 2 * (1 - u * u))); y++) {
        const v = (c.ly(y + 0.5) - top) / 5;
        if (v < 0.4 && vnoise(c.lx(x) / 2.2, c.ly(y) / 2, seed + 6) > 0.45) { b.set(x, y, tone(P.moss, clamp(0.35 + v + (u > 0 ? 0.2 : 0), 0, 1), x, y, 0.35)); continue; }
        b.set(x, y, tone(P.earth, clamp(0.6 + v * 0.3, 0, 1), x, y, 0.35));
      }
    }
    // the trunk, row by row: tapering, bulging at old knots, bark in plates lit on the left
    {
      const Y0 = Math.round(c.Y(-H * 0.72)), Y1 = Math.round(c.Y(2));
      for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
        const ly = c.ly(y + 0.5);
        const u = clamp(-ly / (H * 0.72), 0, 1);
        const [mx] = at(u);
        let half = tw(u) / 2 * (1 + 0.1 * (vnoise1(ly / 9, seed + 7) - 0.5));
        if (u < 0.07) half *= 1 + ((0.07 - u) / 0.07) * 0.7;
        const X0 = Math.round(c.X(mx - half)), X1 = Math.round(c.X(mx + half));
        for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
          const q = ((x + 0.5 - X0) / Math.max(1, X1 - X0)) * 2 - 1;
          let i = q < -0.55 ? 0 : q < 0.15 ? 1 : q < 0.65 ? 2 : 3;
          // bark plates: fissures running up the trunk, warm where a plate has flaked
          if (d >= 0.5) {
            const pl = vnoise(c.lx(x + 0.5) / 2.2, ly / 7, seed + 8);
            if (pl > 0.66) i = Math.min(4, i + 1);
            else if (pl < 0.2 && q < 0.4) { b.set(x, y, P.timber[q < -0.3 ? 2 : 3]!); continue; }
          }
          if (X1 - x === 1) i = 4;
          // moss on the trunk's lit side near the foot
          if (u < 0.12 && q < -0.1 && vnoise(c.lx(x) / 2, ly / 2.5, seed + 9) > 0.6) { b.set(x, y, P.moss[q < -0.6 ? 2 : 4]!); continue; }
          b.set(x, y, BARK[i]!);
        }
      }
    }
    // arms: from the upper trunk, reaching out nearly level, ending in needle masses
    const pads: [number, number, number][] = [];
    const arms = p.arm ? 3 + Math.floor(r() * 2) : 4 + Math.floor(r() * 3);
    const from = p.armsFrom ?? 0.38;
    // a great pine's masses stay the size of a cliff pine's: sky shows between them
    const ps = p.arm ? 0.4 : 1;
    for (let i = 0; i < arms; i++) {
      const u = from + (1 - from) * (i / (arms - 1));
      const [ax, ay] = at(u);
      const side = i === arms - 1 ? dir : i % 2 ? -dir : dir;
      const len = H * (0.25 + 0.3 * r()) * (1 - 0.45 * u) * (side === dir ? 1.25 : 0.8) * (p.arm ? 0.45 : 1);
      const ex = ax + side * len, ey = ay - len * (0.05 + 0.12 * r());
      const ap: [number, number][] = [];
      const kink = 0.4 + 0.3 * r();
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        ap.push([ax + (ex - ax) * t + (t > kink ? 0 : 0), ay + (ey - ay) * t - Math.sin(t * Math.PI) * len * 0.08 + (vnoise1(t * 3 + i, seed + 11) - 0.5) * len * 0.06]);
      }
      limb(c, ap, Math.max(1.5, tw(u) * 0.42), 1.2, seed + 60 + i);
      pads.push([ex, ey - 2, H * (0.12 + 0.05 * r()) * ps]);
      if (len > H * 0.18 * (p.arm ? 0.5 : 1)) pads.push([ax + (ex - ax) * 0.55, ay + (ey - ay) * 0.55 - 3, H * (0.08 + 0.04 * r()) * ps]);
    }
    // the long arm: out over the water, rising a little, its tip drooping, needle masses along it
    if (p.arm) {
      const [len, au] = p.arm;
      const [ax, ay] = at(au);
      const ap: [number, number][] = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        // it leaves the trunk rising, dips at an old break, levels out and droops at the tip
        const elbow = -Math.exp(-Math.pow((t - 0.32) / 0.1, 2)) * len * 0.03;
        ap.push([ax + dir * len * t + (vnoise1(t * 7, seed + 13) - 0.5) * len * 0.02, ay - len * 0.06 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) + len * 0.05 * t * t * t - elbow + (vnoise1(t * 4, seed + 12) - 0.5) * len * 0.05 + (vnoise1(t * 13, seed + 14) - 0.5) * len * 0.015]);
      }
      limb(c, ap, tw(au) * 0.8, 4, seed + 80);
      // side shoots carrying the masses, bigger toward the tip
      for (const [t0, sz, up] of [[0.4, 0.1, 0.05], [0.6, 0.14, 0.035], [0.76, 0.15, 0.06], [0.9, 0.17, 0.02], [1.0, 0.19, 0.04]] as const) {
        const f = t0 * 12, i0 = Math.min(11, Math.floor(f)), tt = f - i0;
        const [px, py] = ap[i0]!, [qx, qy] = ap[i0 + 1]!;
        const sx = px + (qx - px) * tt, sy = py + (qy - py) * tt;
        const ox = dir * H * 0.03 * (r() - 0.3), oy = -H * up;
        if (t0 < 1) limb(c, [[sx, sy], [sx + ox, sy + oy]], 3, 1.2, seed + 90 + Math.round(t0 * 10));
        pads.push([sx + ox, sy + oy - 2, H * sz * ps * (0.9 + 0.2 * r())]);
      }
      // a mass hanging below the tip
      const [tx, ty] = ap[12]!;
      pads.push([tx - dir * H * 0.02, ty + H * 0.06, H * 0.12 * ps]);
    }
    const [tx, ty] = pts[16]!;
    pads.push([tx, ty - 2, H * 0.16 * ps]);
    // the needle masses: lower layers first, each upper layer's dark underside over the one below
    pads.sort((a, q) => q[1] - a[1]);
    pads.forEach(([px, py, pr], i) => {
      const s = seed + Math.round(px * 3) + i * 131;
      const three = hash1(i, seed + 21) < 0.4;
      const dk = p.arm ? 0.14 : 0;
      needlePad(c, px + pr * 0.25, py + pr * 0.2, pr * (3.2 + hash1(i, seed + 22) * 0.6), pr * 0.95, s + 1, dk);
      needlePad(c, px - pr * 0.3, py - pr * 0.32, pr * (2.3 + hash1(i, seed + 23) * 0.6), pr * 0.8, s, dk);
      if (three) needlePad(c, px + pr * 0.7 * (hash1(i, seed + 24) - 0.3), py - pr * 0.62, pr * 1.5, pr * 0.62, s + 2, dk);
    });
    void bayer4;
  },
});

export interface BambooP {
  /** Width of the grove and the tallest culm, px; anchor at the ground at its left end. */
  w: number;
  h: number;
  frame?: number;
}

/** A bamboo grove: culms with nodes, leaning a little, leaf sprays at the top that sway. */
export const bamboo = definePainter<BambooP>("op.bamboo", {
  bounds(p) {
    return [-p.h * 0.3, -p.h - 20, p.w + p.h * 0.3, 4];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const f = p.frame ?? 0;
    const n = Math.max(4, Math.round(p.w / 5));
    const culms: [number, number, number, number][] = [];
    for (let i = 0; i < n; i++) culms.push([hash1(i, seed) * p.w, p.h * (0.5 + 0.5 * hash1(i, seed + 1)), (hash1(i, seed + 2) - 0.5) * 0.16, i]);
    culms.sort((a, q) => q[1] - a[1]);
    const leaf = (bx: number, by: number, a: number, len: number, col: number, col2: number): void => {
      for (let s = 0; s < len; s += 0.5 / d) {
        const t = s / len;
        const X = Math.round(c.X(bx + Math.sin(a) * s)), Y = Math.round(c.Y(by - Math.cos(a) * s * 0.45 + t * t * len * 0.6));
        b.set(X, Y, col);
        if (t > 0.15 && t < 0.75) b.set(X, Y + 1, col2);
      }
    };
    for (const [x0, hh, lean, i] of culms) {
      const ph = (f / 4) * Math.PI * 2 + x0 / 30;
      const sway = Math.sin(ph) * Math.min(4, hh / 60);
      const w = Math.max(2.5, hh * 0.026);
      const back = hash1(i, seed + 3) < 0.45;
      for (let s = 0; s < hh; s += 0.5 / d) {
        const u = s / hh;
        const cx = x0 + lean * s + sway * u * u;
        const node = Math.abs(((s / 28) % 1) - 0.5) > 0.47;
        for (let o = -w / 2; o <= w / 2; o += 0.5 / d) {
          const q = (o + w / 2) / w;
          const t = (q < 0.3 ? 0.08 : q < 0.7 ? 0.32 : 0.62) + (back ? 0.22 : 0);
          b.set(Math.round(c.X(cx + o)), Math.round(c.Y(-s)), node ? P.bamboo[back ? 4 : 3]! : P.bamboo[Math.min(4, Math.round(t * 4))]!);
        }
      }
      // leaf sprays: drooping fans of narrow leaves from the upper half's nodes
      for (let k = 0; k < 9; k++) {
        const at = hh * (0.45 + 0.55 * hash1(k, seed + i * 7));
        const u = at / hh;
        const bx = x0 + lean * at + sway * u * u;
        const side = hash1(k + 9, seed + i) < 0.5 ? -1 : 1;
        for (let l = 0; l < 7; l++) {
          const len = 12 + 16 * hash1(l, seed + i * 31 + k);
          const a = side * (0.6 + 1.1 * hash1(l + 3, seed + i + k)) + sway * 0.06;
          const lit = hash1(l + 5, seed + i * 3 + k) < 0.45 && !back;
          leaf(bx, -at, a, len, lit ? P.bamboo[1]! : back ? P.moss[5]! : P.bamboo[3]!, lit ? P.bamboo[2]! : back ? P.moss[6]! : P.moss[5]!);
        }
      }
    }
  },
});

export interface TerraceP {
  /** Length of the terrace and depth of its retaining face, px; anchor at its west end, walk line. */
  w: number;
  depth: number;
}

/** The viewing terrace: a paved platform on a cut-stone retaining wall built out over the rock. */
export const terrace = definePainter<TerraceP>("op.terrace", {
  bounds(p) {
    return [-30, -4, p.w + 30, p.depth + 46];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const W = p.w, D = p.depth;
    // the face: ashlar courses, battered (a little wider at the foot), weathered, its foot in moss
    const X0 = Math.max(b.ox, Math.floor(c.X(-26))), X1 = Math.min(b.x1, Math.ceil(c.X(W + 26)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      for (let y = Math.max(b.oy, Math.floor(c.Y(-2))); y < Math.min(b.y1, Math.ceil(c.Y(D + 26))); y++) {
        const ly = c.ly(y + 0.5);
        // the face's ends step back into the rock in courses (no box), its foot is ragged
        const course0 = Math.floor(Math.max(0, ly - 10) / 15);
        const inset = ly < 10 ? -6 : course0 * 7 + 6 * hash1(course0, seed + 6);
        const footRag = D * (1 - 0.35 * Math.pow(Math.abs(lx / W - 0.5) * 2, 2)) + 8 * vnoise1(lx / 9, seed + 1) + (hash1(Math.floor(lx / 5), seed + 2) < 0.2 ? 10 : 0);
        if (lx < inset - 6 || lx > W - inset + 6 || ly > footRag) continue;
        const bat = -inset + 6;
        if (ly < 1.3 / d) { b.set(x, y, P.stone[0]!); continue; }
        // the paving's edge: a heavy coping course
        if (ly < 7) {
          const k = Math.floor((lx + 3) / 34);
          const joint = ((lx + 3) % 34 + 34) % 34 < 1.1 / d;
          b.set(x, y, joint ? P.stone[5]! : tone(P.stone, ly < 3 ? 0.12 : 0.38 + 0.1 * hash1(k, seed), x, y, 0.3));
          continue;
        }
        if (ly < 10) { b.set(x, y, P.stone[5]!); continue; }
        const course = Math.floor((ly - 10) / 15);
        const off = (course % 2) * 21;
        const bx = Math.floor((lx + off) / 42);
        const joint = ((ly - 10) % 15) < 1.1 / d || (((lx + off) % 42) + 42) % 42 < 1.1 / d;
        let t = 0.36 + 0.16 * hash(bx, course, seed) + clamp(ly / D, 0, 1) * 0.15;
        if (joint) t = 0.78;
        else if (((ly - 10) % 15) < 2.6) t -= 0.12;
        // edges of the face: a lit west edge, a shaded east edge
        if (lx < -bat + 2.5) t -= 0.15;
        if (lx > W + bat - 3) t += 0.25;
        // stains and moss, more toward the foot
        if (vnoise(lx / 2.5, ly / 26, seed + 3) > 0.74) t += 0.12;
        if (vnoise(lx / 8, ly / 5, seed + 4) > 1.05 - ly / D * 0.45) { b.set(x, y, tone(P.moss, 0.45 + ly / D * 0.35, x, y, 0.35)); continue; }
        b.set(x, y, tone(P.stone, clamp(t, 0, 1), x, y, 0.3));
      }
    }
    // a carved drain spout pouring a thin thread down the face
    const sx = W * 0.62;
    for (let ly = 22; ly < D + 40; ly += 0.5 / d) {
      const X = Math.round(c.X(sx + 6 + Math.min(4, (ly - 22) * 0.3))), Y = Math.round(c.Y(ly));
      if (ly > D && bayer4(X, Y) < (ly - D) / 40) continue;
      b.set(X, Y, P.cloud[ly < 30 ? 1 : 0]!);
    }
    for (let y2 = Math.round(c.Y(18)); y2 < Math.round(c.Y(24)); y2++) for (let x2 = Math.round(c.X(sx - 4)); x2 < Math.round(c.X(sx + 8)); x2++) b.set(x2, y2, tone(P.stone, 0.55, x2, y2, 0.3));
    contact(c, -20, W + 20, 0);
  },
});
