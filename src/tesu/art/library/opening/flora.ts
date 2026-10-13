// Trees and terraces that frame Kagami's east lip and Gate Road: great cliff pines growing out of
// the rock (Huangshan pines: roots clawing over the rock and down into its cracks with soil and
// moss at the join, a heavy twisting trunk, arms reaching out nearly level and tapering to twigs,
// needles in clustered cloud masses, each on its own twig, with ragged tufted tops and dark
// undersides), a bamboo grove by the forecourt that sways, and the viewing terrace itself, a paved
// platform built out over the rock with a cut-stone retaining face.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { contact } from "./props.ts";

export interface PadOpts {
  /**
   * Where the mass's wood comes from (local px): a twig runs from it into the mass and forks to
   * its tufts, seen in the gaps between them and under their rounded bottoms.
   */
  stem?: [number, number];
  /** The lake's light lifting the mass's underside (0..1; 1 over open water). */
  bounce?: number;
}

const smooth01 = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * A mass of pine needles seen side-on, the way a cloud pine carries them: a cluster of tufts of
 * different sizes on a near-flat base, domed and bumpy on top, the odd gap of sky between two
 * tufts, a dark crease where two tufts meet and dark pockets inside, the underside in shadow with
 * short needles hanging from it, a warm rim of sun along the lit tops on the upper left and
 * needle tips standing out of them; over the lake its underside takes the water's light. (cx, cy):
 * the mass's middle; w, h: its width and depth; dark (0..1) deepens it (in shade, or nearer the
 * camera). With a stem, the mass sits on its own twig.
 */
export function needlePad(c: PaintCtx, cx: number, cy: number, w: number, h: number, seed: number, dark = 0, o: PadOpts = {}): void {
  const b = c.buf, d = c.d;
  const hw = w / 2;
  let ex0 = cx - hw - h * 0.6 - 4, ex1 = cx + hw + h * 0.6 + 4, ey0 = cy - h * 1.3 - 6, ey1 = cy + h * 0.9 + 9;
  if (o.stem) { ex0 = Math.min(ex0, o.stem[0] - 3); ex1 = Math.max(ex1, o.stem[0] + 3); ey0 = Math.min(ey0, o.stem[1] - 3); ey1 = Math.max(ey1, o.stem[1] + 3); }
  if (!b.touches(Math.floor(c.X(ex0)), Math.floor(c.Y(ey0)), Math.ceil(c.X(ex1)), Math.ceil(c.Y(ey1)))) return;
  const bounce = o.bounce ?? 0;
  // the tufts: domes of different sizes across the mass, bigger toward its middle
  const nt = clamp(Math.round(w / Math.max(2, h * 0.85)), 2, 9);
  const base = cy + h * 0.24;
  const tufts: { x: number; rw: number; r: number }[] = [];
  for (let i = 0; i < nt; i++) {
    const u = -1 + (2 * (i + 0.5 + (hash1(i, seed + 12) - 0.5) * 0.55)) / nt;
    const env = Math.sqrt(Math.max(0, 1 - u * u * 0.9));
    tufts.push({ x: cx + u * hw * 0.9, rw: (hw / nt) * (1.05 + 0.8 * hash1(i, seed + 14)) * (0.7 + 0.3 * env), r: h * (0.34 + 0.46 * hash1(i, seed + 13)) * (0.5 + 0.5 * env) });
  }
  const baseAt = (lx: number): number => base + (vnoise1(lx / 4, seed + 15) - 0.5) * h * 0.14;
  const profile = (lx: number): [number, number, number, number] => {
    let T = 0, T2 = 0, k = -1, q0 = 0;
    for (let i = 0; i < tufts.length; i++) {
      const tf = tufts[i]!;
      const q = (lx - tf.x) / tf.rw;
      if (Math.abs(q) >= 1) continue;
      const hg = tf.r * Math.sqrt(1 - q * q) * (1 + 0.16 * (vnoise1(lx / 2.2, seed + 20 + i) - 0.5));
      if (hg > T) { T2 = T; T = hg; k = i; q0 = q; } else if (hg > T2) T2 = hg;
    }
    return [T, T2, k, q0];
  };
  // the wood: a twig from the stem into the mass, forking to the tufts (drawn first; the needles
  // cover it except in the gaps and under the tufts' rounded bottoms)
  if (o.stem) {
    const [sx, sy] = o.stem;
    const jx = cx + clamp(sx - cx, -hw * 0.45, hw * 0.45), jy = base - h * 0.05;
    limb(c, [[sx, sy], [(sx + jx) / 2, (sy + jy) / 2 - h * 0.08], [jx, jy]], Math.max(1.6, Math.min(3.2, h * 0.16)), Math.max(1.2, h * 0.1), seed + 3);
    for (const tf of tufts) {
      if (Math.abs(tf.x - jx) < 1) continue;
      limb(c, [[jx, jy], [(jx + tf.x) / 2, jy - tf.r * 0.12 + 0.6], [tf.x, base - tf.r * 0.3]], Math.max(1.1, h * 0.09), 0.8, seed + 4 + Math.round(tf.x));
    }
  }
  // needles: a stroke from (x, y) at angle a, length L, drooping a little, its inner part darker
  const stroke = (x: number, y: number, a: number, L: number, col: number, inner: number): void => {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let s = 0; s <= L; s += 0.5 / d) b.set(Math.round(c.X(x + ca * s)), Math.round(c.Y(y + sa * s + s * s * 0.015)), s < L * 0.4 ? inner : col);
  };
  const fan = (x: number, y: number, rf: number, a0: number, a1: number, cols: (a: number) => [number, number], s: number): void => {
    const k = Math.max(3, Math.min(14, Math.round(rf * d * 1.4)));
    for (let i = 0; i < k; i++) {
      const a = a0 + (a1 - a0) * ((i + 0.2 + hash1(i, s) * 0.6) / k);
      const [col, inner] = cols(a);
      stroke(x, y, a, rf * (0.6 + 0.5 * hash1(i, s + 1)), col, inner);
    }
  };
  const dk = Math.round(dark * 3);
  const pick = (i: number): number => P.pine[clamp(i + (i > 0 ? dk : 0), 0, 5)]!;
  const sz = Math.max(1.6, h * 0.3);
  // the body: dark under the needles, darker toward its underside and in the creases
  for (let x = Math.max(b.ox, Math.floor(c.X(cx - hw - h * 0.5))); x < Math.min(b.x1, Math.ceil(c.X(cx + hw + h * 0.5))); x++) {
    const lx = c.lx(x + 0.5);
    const [T, T2, k, q] = profile(lx);
    if (k < 0) continue;
    const tf = tufts[k]!;
    const yb = baseAt(lx) + tf.r * 0.16 * Math.sqrt(Math.max(0, 1 - q * q));
    const yt = base - T * 0.86;
    for (let y = Math.max(Math.round(c.Y(yt)), b.oy); y < Math.min(Math.round(c.Y(yb)), b.y1); y++) {
      const ly = c.ly(y + 0.5);
      const v = (ly - yt) / Math.max(0.5, yb - yt);
      let t = 0.4 + v * 0.46 + (q > 0.35 ? 0.08 : 0) + dark;
      if (T - T2 < 2 && base - ly < T2 * 0.9) t += 0.18;
      if (d >= 0.5 && v > 0.3 && vnoise(lx / 3.2, ly / 2.4, seed + 9) > 0.74) t += 0.2;
      if (d >= 0.5 && hash(Math.floor((lx + ly * 0.8) * 1.3), Math.floor(ly / 1.5), seed + 10) < 0.22) t += 0.12;
      // the lake's light under a mass over the water
      if (bounce > 0 && yb - ly < 1.05 / d && hash(x, 3, seed) < 0.3 + bounce * 0.6) { b.set(x, y, P.jade[6]!); continue; }
      b.set(x, y, tone(P.pine, clamp(t, 0, 1), x, y, 0.3));
    }
  }
  // under fans: short needles pointing down and out, the odd longer tassel, the lake's light on their tips
  const nU = Math.max(2, Math.round(w / Math.max(2.6, h * 0.36)));
  for (let i = 0; i < nU; i++) {
    const u = -0.94 + (1.88 * (i + 0.3 + hash1(i, seed + 20) * 0.4)) / nU;
    const lx = cx + u * hw;
    const [T, , k, q] = profile(lx);
    if (k < 0 || T < 0.5) continue;
    const yb = baseAt(lx) + tufts[k]!.r * 0.16 * Math.sqrt(Math.max(0, 1 - q * q));
    const rf = sz * (0.5 + 0.45 * hash1(i, seed + 21)) * (hash1(i, seed + 22) < 0.1 ? 1.5 : 1);
    fan(lx, yb - rf * 0.3, rf, 0.45, Math.PI - 0.45, () => [bounce > 0.5 && hash1(i, seed + 23) < 0.35 ? P.jade[6]! : pick(u > 0.3 ? 5 : 4), pick(5)], seed + 300 + i);
  }
  // fans inside the mass: needle texture in mid tones
  if (d >= 0.5) {
    const nM = Math.round((w * h) / 34);
    for (let i = 0; i < nM; i++) {
      const u = (hash1(i, seed + 30) - 0.5) * 1.8;
      const lx = cx + u * hw;
      const [T, , k] = profile(lx);
      if (k < 0 || T < 1) continue;
      const yy = base - T * (0.25 + 0.55 * hash1(i, seed + 31));
      const a0 = -Math.PI * (0.9 + 0.2 * hash1(i, seed + 32));
      fan(lx, yy, sz * (0.45 + 0.35 * hash1(i, seed + 33)), a0, a0 + Math.PI * 1.1, (a) => [pick(Math.sin(a) < -0.3 ? 2 : 3 + (u > 0.35 ? 1 : 0)), pick(4)], seed + 500 + i);
    }
  }
  // the tops: each tuft's ragged row of needle fans radiating up, lit on the sun's side; the
  // lower tufts first so the higher ones stand over them
  const order = tufts.map((_, i) => i).sort((a, q) => tufts[a]!.r - tufts[q]!.r);
  for (const ti of order) {
    const tf = tufts[ti]!;
    const nT = Math.max(2, Math.round((tf.rw * 2) / Math.max(2.2, h * 0.28)));
    for (let j = 0; j < nT; j++) {
      const qq = -0.9 + (1.8 * (j + 0.2 + hash1(j, seed + 40 + ti) * 0.6)) / nT;
      const lx = tf.x + qq * tf.rw;
      const [T, , k] = profile(lx);
      if (k !== ti) continue;
      const rf = sz * (0.7 + 0.55 * hash1(j, seed + 41 + ti)) * (0.6 + 0.4 * Math.sqrt(1 - qq * qq));
      const fy = base - T + rf * 0.5;
      const sun = (lx - cx) / hw < 0.3 && qq < 0.4;
      fan(lx, fy, rf, -Math.PI + 0.3, -0.3, (a) => {
        const lit = a < -2.2 ? 0 : a < -1.3 ? 1 : 2;
        if (lit === 0 && sun && hash1(j, seed + 42 + ti) < 0.5 && dark < 0.3) return [P.moss[4]!, pick(2)];
        return [pick(lit + (sun ? 0 : 1)), pick(lit + 2)];
      }, seed + 700 + ti * 31 + j);
    }
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
  /** Arms grow from this share of the trunk up (default 0.38 under a long arm, else 0.66: a pine by a path keeps its wood above the walkers' heads). */
  armsFrom?: number;
  /** Roots: how far they spread along the rock and how deep they claw down below the anchor, px. */
  roots?: number;
  grip?: number;
}

/** Pine bark, lit to dark (round 3: in the timber family): grey-brown plates on the sun's side, warm brown in the fissures and shade. */
const BARK = [P.earth[3]!, P.timber[4]!, P.timber[5]!, P.umber[3]!, P.timber[6]!];

/** A twisting limb along pts, width w0 tapering to w1 (taper > 1 keeps it thick longer), bark lit on its upper side. */
function limb(c: PaintCtx, pts: [number, number][], w0: number, w1: number, seed: number, root = false, taper = 1.4, knots: number[] = []): void {
  const b = c.buf, d = c.d;
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!;
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.ceil(len * d * 1.4));
    const nx = -(by - ay) / Math.max(1e-6, len), ny = (bx - ax) / Math.max(1e-6, len);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = (k + t) / (pts.length - 1);
      let w = Math.max(1 / d, w0 + (w1 - w0) * Math.pow(u, taper));
      // knots: the limb swells where an old branch was
      for (const kn of knots) w *= 1 + 0.42 * Math.exp(-Math.pow((u - kn) * 26, 2));
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

/** A dead stub where a branch broke off: silvered, splintered at its end. */
function deadStub(c: PaintCtx, x: number, y: number, ang: number, len: number, w: number, seed: number): void {
  const b = c.buf, d = c.d;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let s = 0; s < len; s += 0.5 / d) {
    const ww = w * (1 - 0.45 * s / len);
    for (let o = -ww / 2; o <= ww / 2; o += 0.5 / d) {
      if (s > len - 2.2 && hash(Math.round(o * 3), Math.round(s * 2), seed) < 0.45) continue;
      const q = o / Math.max(0.5, ww / 2);
      b.set(Math.round(c.X(x + ca * s - sa * o)), Math.round(c.Y(y + sa * s + ca * o)), q < -0.2 ? P.earth[1]! : q < 0.4 ? P.earth[3]! : P.umber[1]!);
    }
  }
}

/** A point along a polyline at share t (0..1 of its segments). */
function along(pts: [number, number][], t: number): [number, number] {
  const f = clamp(t, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i;
  const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!;
  return [ax + (bx - ax) * k, ay + (by - ay) * k];
}

/** A needle mass to paint: middle, size (its radius), seed, dark, its stem and its lake light. */
interface Mass { x: number; y: number; r: number; s: number; dark: number; stem: [number, number]; bounce: number; under: boolean }

/** A great cliff pine: roots clawing into the rock, a heavy twisting trunk, arms reaching out nearly level and tapering to twigs, needle masses on their own twigs. */
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
    const great = !!p.arm;
    const r = rng(seed);
    // the trunk: leaves the rock, twists, splits into arms (a path by height)
    const pts: [number, number][] = [];
    if (great) {
      for (let k = 0; k <= 16; k++) {
        const u = k / 16;
        pts.push([dir * H * bend * (0.35 * Math.sin(u * 2.2) + 0.12 * u) + (vnoise1(u * 5, seed) - 0.5) * H * 0.08, -H * 0.72 * u]);
      }
    } else {
      // a pine by a path climbs near upright out of its roots, then leans out more and more, so
      // no wood lies across the walk line at her height
      let x = 0;
      pts.push([0, 0]);
      for (let k = 1; k <= 16; k++) {
        const u = k / 16;
        const th = (0.08 + 0.86 * smooth01(0.14, 0.86, u)) * bend;
        x += dir * Math.tan(th) * (H * 0.72 / 16);
        pts.push([x + (vnoise1(u * 5, seed) - 0.5) * H * 0.06 * u, -H * 0.72 * u]);
      }
    }
    const tw = (u: number): number => Math.max(1.5 / d, H * (great ? 0.072 : 0.085) * (1 - u * 0.7));
    const at = (u: number): [number, number] => along(pts, u);
    // roots: thick where they leave the trunk, running out over the rock, then down into its cracks
    const spread = p.roots ?? H * 0.15, grip = p.grip ?? H * 0.1;
    const w0 = tw(0);
    // (round 3) roots: 0 when the rock the tree stands on paints the roots gripping it (the
    // jetty's east landing does), so no disc of roots lies over the rock here
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
        const x = sx + side * len * (1 - Math.pow(1 - t, 1.5)) * (over ? 1 : 0.55 + 0.3 * hash1(i, seed + 4));
        const arch = -Math.sin(t * Math.PI) * w0 * (0.08 + 0.1 * hash1(i, seed + 5));
        const y = -w0 * 0.05 + arch + (over ? deep * 0.7 * Math.pow(t, 2.6) : t * 1.5) + (vnoise1(t * 4 + i, seed + 3) - 0.5) * 1.2;
        rp.push([x, y]);
      }
      const rw = w0 * (0.36 + 0.16 * r());
      if (spread <= 0) continue;
      limb(c, rp, rw, over ? 2 : 3.5, seed + 40 + i, true);
      const [ex, ey] = rp[rp.length - 1]!;
      for (let k = 0; k < 6; k += 0.5 / d) b.set(Math.round(c.X(ex + side * k * 0.3)), Math.round(c.Y(ey + k * 0.6)), P.karst[8]!);
    }
    // soil and moss where the trunk meets the rock
    for (let x = Math.round(c.X(-w0 * 1.5)); spread > 0 && x < Math.round(c.X(w0 * 1.5)); x++) {
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
          if (d >= 0.5) {
            const pl = vnoise(c.lx(x + 0.5) / 2.2, ly / 7, seed + 8);
            if (pl > 0.66) i = Math.min(4, i + 1);
            else if (pl < 0.2 && q < 0.4) { b.set(x, y, P.timber[q < -0.3 ? 2 : 3]!); continue; }
          }
          if (X1 - x === 1) i = 4;
          if (u < 0.12 && q < -0.1 && vnoise(c.lx(x) / 2, ly / 2.5, seed + 9) > 0.6) { b.set(x, y, P.moss[q < -0.6 ? 2 : 4]!); continue; }
          b.set(x, y, BARK[i]!);
        }
      }
    }
    // the needle masses, collected first and painted after the wood (those hanging under a limb
    // before it): sizes vary threefold, each on a twig of its own
    const masses: Mass[] = [];
    const sizeK = [0.55, 1.35, 0.8, 1.6, 0.6, 1.1, 0.9, 1.45, 0.5, 1.2];
    let si = Math.floor(r() * sizeK.length);
    const nextSize = (): number => sizeK[(si++) % sizeK.length]! * (0.9 + 0.2 * r());
    const ps = great ? 0.4 : 1;
    // arms from the upper trunk: tapering, kinked, ending in a mass, a second one along the way
    const arms = great ? 3 + Math.floor(r() * 2) : 4 + Math.floor(r() * 2);
    const from = p.armsFrom ?? (great ? 0.38 : 0.66);
    for (let i = 0; i < arms; i++) {
      const u = from + (1 - from) * (i / Math.max(1, arms - 1));
      const [ax, ay] = at(u);
      // (a pine by a path: its lower arms grow only on the side it leans to, over the drop, so no
      // needles hang at head height over the path behind it)
      const side = i === arms - 1 || (!great && u < 0.8) ? dir : i % 2 ? -dir : dir;
      const len = H * (0.25 + 0.3 * r()) * (1 - 0.45 * u) * (side === dir ? 1.25 : 0.8) * (great ? 0.45 : 1);
      const rise = len * (0.08 + 0.16 * r());
      const kink = 0.35 + 0.3 * r();
      const ap: [number, number][] = [[ax, ay], [ax + side * len * kink, ay - rise * (0.2 + 0.5 * r())], [ax + side * len, ay - rise]];
      limb(c, ap, Math.max(1.6, tw(u) * 0.5), 1.3, seed + 60 + i, false, 0.9, [0.45]);
      const [ex, ey] = ap[2]!;
      const pr = H * 0.13 * ps * nextSize();
      masses.push({ x: ex + side * pr * 0.3, y: ey - pr * 0.35, r: pr, s: seed + 200 + i * 17, dark: great ? 0.12 : 0, stem: [ex - side * pr * 0.4, ey + 0.5], bounce: great ? 0.5 : 0.25, under: false });
      if (len > H * 0.16 * (great ? 0.5 : 1)) {
        const [mx2, my2] = along(ap, 0.55);
        const pr2 = H * 0.09 * ps * nextSize();
        masses.push({ x: mx2 + side * pr2 * 0.2, y: my2 - pr2 * 0.5 - 1, r: pr2, s: seed + 260 + i * 17, dark: great ? 0.12 : 0, stem: [mx2, my2], bounce: great ? 0.5 : 0.25, under: false });
      }
    }
    // the long arm: out over the water from a heavy root, tapering to twigs, kinked where it
    // broke and regrew, knots and a dead stub or two, shoots carrying masses of every size
    if (p.arm) {
      const [len, au] = p.arm;
      const [ax, ay] = at(au);
      const ap: [number, number][] = [[ax, ay]];
      let x = ax, y = ay;
      const segs = 7;
      for (let k = 1; k <= segs; k++) {
        const t = k / segs;
        // rising as it leaves, a dip at an old break, level, the tip drooping
        // elbows: each segment bends against the last, the way a limb regrows after each break
        // (round 3: sharper elbows, one hard drop where it broke and regrew)
        const slope = -0.16 + 0.4 * t * t + (t > 0.3 && t < 0.45 ? 0.2 : 0) + (k % 2 ? 1 : -1) * (0.11 + 0.13 * hash1(k, seed + 15)) + (hash1(k, seed + 13) - 0.5) * 0.1;
        const dx = (len / segs) * (0.8 + 0.4 * hash1(k, seed + 14));
        x += dir * dx; y += dx * slope;
        ap.push([x, y]);
      }
      // dead stubs where branches broke off (behind the masses)
      for (const t of [0.22 + 0.1 * r(), 0.52 + 0.1 * r()]) {
        const [sx, sy] = along(ap, t);
        deadStub(c, sx, sy - 1, -Math.PI / 2 + dir * (0.25 + 0.4 * r()), 8 + r() * 9, 2.6, seed + 70 + Math.round(t * 100));
      }
      // (round 3) a heavier broken limb near the trunk, snapped off short and splintered
      {
        const [sx, sy] = along(ap, 0.12 + 0.05 * hash1(1, seed + 78));
        deadStub(c, sx, sy + 1, Math.PI / 2 - dir * (0.5 + 0.3 * hash1(2, seed + 78)), 10 + hash1(3, seed + 78) * 6, 4.4, seed + 77);
      }
      // a fork near its middle: a second limb rising out of it, carrying masses of its own
      {
        const [fx, fy] = along(ap, 0.5 + 0.06 * r());
        const fl = len * (0.2 + 0.06 * r());
        const fp: [number, number][] = [[fx, fy], [fx + dir * fl * 0.45, fy - fl * 0.32], [fx + dir * fl, fy - fl * 0.42]];
        limb(c, fp, tw(au) * 0.42, 1.6, seed + 85, false, 0.9, [0.5]);
        const [qx, qy] = fp[2]!;
        const pr = H * 0.13 * ps * nextSize();
        masses.push({ x: qx + dir * pr * 0.3, y: qy - pr * 0.4, r: pr, s: seed + 350, dark: 0.12, stem: [qx, qy + 0.5], bounce: 0.8, under: false });
        const [mx, my] = along(fp, 0.5);
        const pr2 = H * 0.09 * ps * nextSize();
        masses.push({ x: mx - dir * pr2 * 0.2, y: my - pr2 * 0.55, r: pr2, s: seed + 360, dark: 0.12, stem: [mx, my], bounce: 0.8, under: false });
      }
      // shoots: up and out from the arm, a few hanging down under it
      // (the outer third, the arm's "hand", carries the biggest masses, some hung under it: in the
      // catch they are the top right corner's frame)
      const shoots: [number, boolean, number][] = [[0.18, false, 0.9], [0.33, false, 1], [0.46, true, 0.8], [0.6, false, 1.05], [0.7, true, 1.15], [0.79, false, 1.2], [0.86, true, 1.35], [0.95, false, 1]];
      const unders: Mass[] = [];
      shoots.forEach(([t0, down, big], k) => {
        const [sx, sy] = along(ap, t0 + (r() - 0.5) * 0.04);
        const sl = H * (down ? 0.03 + 0.045 * t0 : 0.025 + 0.03 * r());
        const ang = down ? 0.45 + 0.3 * r() : -(0.5 + 0.7 * r());
        const tx = sx + dir * Math.cos(ang) * sl, ty = sy + Math.sin(ang) * sl;
        limb(c, [[sx, sy], [(sx + tx) / 2 + dir * 1, (sy + ty) / 2 - (down ? 0 : 1.5)], [tx, ty]], Math.max(1.6, 3.2 * (1 - t0 * 0.5)), 1.2, seed + 90 + k, false, 0.8);
        // (round 3) twigs fork: a second, thinner twig from the shoot's middle
        {
          const fx = (sx + tx) / 2 + dir * 1, fy = (sy + ty) / 2 - (down ? 0 : 1.5);
          const fa = ang + (k % 2 ? 0.55 : -0.5);
          limb(c, [[fx, fy], [fx + dir * Math.cos(fa) * sl * 0.55, fy + Math.sin(fa) * sl * 0.55]], 1.3, 1, seed + 120 + k, false, 0.8);
        }
        const pr = H * (down ? 0.085 : 0.1 + 0.04 * t0) * ps * nextSize() * big;
        (down ? unders : masses).push({ x: tx + dir * pr * 0.25, y: ty - pr * (down ? 0.05 : 0.4), r: pr, s: seed + 300 + k * 23, dark: down ? 0.22 : 0.12, stem: [tx, ty + 0.5], bounce: 1, under: down });
      });
      // the masses hanging under the arm go behind it
      for (const m of unders) needlePad(c, m.x, m.y, m.r * 2.7, m.r * 0.85, m.s, m.dark, { stem: m.stem, bounce: m.bounce });
      // the arm itself, from the trunk's girth down to a twig, knots along it
      // (round 3: thick where it leaves the trunk, thinning fast then slowly, so it never reads
      // as a tube; knots swell at the old breaks)
      limb(c, ap, tw(au) * 1.2, 1.8, seed + 80, false, 0.55, [0.18, 0.41, 0.66]);
      // its tip turns up into the last mass
      const [tx, ty] = ap[segs]!;
      const prT = H * 0.14 * ps * nextSize();
      masses.push({ x: tx + dir * prT * 0.5, y: ty - prT * 0.45, r: prT, s: seed + 400, dark: 0.12, stem: [tx, ty], bounce: 1, under: false });
    }
    const [tx, ty] = pts[16]!;
    const prTop = H * 0.15 * ps * nextSize();
    masses.push({ x: tx + dir * prTop * 0.2, y: ty - prTop * 0.3, r: prTop, s: seed + 500, dark: great ? 0.12 : 0, stem: [tx, ty + 1], bounce: 0.3, under: false });
    // from the lowest up: each upper layer's dark underside over the one below
    masses.sort((a, q) => q.y - a.y);
    for (const m of masses) {
      const wk = 2.6 + hash1(m.s, seed + 22) * 0.9;
      needlePad(c, m.x, m.y, m.r * wk, m.r * (0.82 + 0.25 * hash1(m.s, seed + 23)), m.s, m.dark, { stem: m.stem, bounce: m.bounce });
    }
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
