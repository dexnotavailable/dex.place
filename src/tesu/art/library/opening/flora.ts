// Trees and terraces that frame Gate Road: great cliff pines growing out of the road's lip and
// leaning out over the valley (Huangshan pines: a twisting trunk, long flat arms, pads of needles
// in layers), a bamboo grove by the forecourt that sways, and the viewing terrace itself, a
// paved platform built out over the rock with a cut-stone retaining face.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash, hash1, rng, tone, vnoise, vnoise1 } from "../../raster.ts";
import { contact } from "./props.ts";

/**
 * A pad of pine needles seen side-on: a wide flat mass, its top a row of small tufts lit on
 * their upper left, its body streaked with needles, a dark underside fringed with needles
 * hanging down. Wider than tall, never a smooth blob.
 */
export function needlePad(c: PaintCtx, cx: number, cy: number, w: number, h: number, seed: number): void {
  const b = c.buf, d = c.d;
  const X0 = Math.floor(c.X(cx - w / 2 - 3)), X1 = Math.ceil(c.X(cx + w / 2 + 3));
  if (!b.touches(X0, Math.floor(c.Y(cy - h)), X1, Math.ceil(c.Y(cy + h * 0.8)))) return;
  const tuft = Math.max(2.5, h * 0.42);
  for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
    const lx = c.lx(x + 0.5) - cx;
    const u = lx / (w / 2);
    if (Math.abs(u) > 1.06) continue;
    const env = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u), 2.5)));
    // the top: tufts (half discs) along the width, taller in the middle
    const ti = Math.floor(lx / tuft + 0.5 + hash1(1, seed)), tf = lx / tuft + 0.5 + hash1(1, seed) - ti - 0.5;
    const top = -h * 0.55 * env - tuft * 0.55 * Math.sqrt(Math.max(0, 1 - 4 * tf * tf)) * (0.6 + 0.6 * hash1(ti, seed + 2)) * env;
    // the underside: flatter, needles hanging below it
    const spike = hash1(Math.floor(lx * 1.2), seed + 3);
    const bot = h * 0.3 * env + (spike < 0.35 ? h * 0.25 * spike * env : 0);
    const Yt = Math.ceil(c.Y(cy + top)), Yb = Math.ceil(c.Y(cy + bot));
    for (let y = Math.max(Yt, b.oy); y < Math.min(Yb, b.y1); y++) {
      const ly = c.ly(y + 0.5) - cy;
      const v = (ly - top) / Math.max(1, bot - top);
      // lit top of each tuft (upper left), body, dark underside
      let t = v < 0.18 ? (tf < 0.1 ? 0.12 : 0.3) : v < 0.55 ? 0.42 : v < 0.8 ? 0.62 : 0.85;
      if (d >= 0.5 && hash(Math.floor(lx * 1.5), Math.floor(ly / 2.5), seed + 5) < 0.22) t += 0.14;
      if (u > 0.55) t += 0.1;
      const ramp = t > 0.6 ? P.pine.slice(2) : P.pine;
      const tt = t > 0.6 ? (t - 0.6) / 0.4 : t / 0.6 * 0.7;
      b.set(x, y, tone(ramp, clamp(tt, 0, 1), x, y, 0.3));
    }
  }
}

export interface PineP {
  /** Height of the tree, px; anchor at the root on the lip. */
  h: number;
  /** Lean: -1 out to the left, 1 to the right. */
  dir?: number;
}

/** A great cliff pine: a heavy twisting trunk, arms reaching out level, layered pads of needles. */
export const pine = definePainter<PineP>("op.pine", {
  bounds(p) {
    return [-p.h * 1.35, -p.h * 1.12, p.h * 1.35, p.h * 0.1 + 6];
  },
  paint(c, p) {
    const b = c.buf, d = c.d, seed = c.seed;
    const H = p.h, dir = p.dir ?? 1;
    const r = rng(seed);
    // roots gripping the lip
    for (let i = 0; i < 6; i++) {
      const a = (r() - 0.5) * 2.4;
      const len = H * (0.06 + 0.08 * r());
      for (let s = 0; s < len; s += 0.5 / d) {
        const X = Math.round(c.X(Math.sin(a) * s)), Y = Math.round(c.Y(Math.cos(a) * s * 0.5 + s * 0.15));
        b.set(X, Y, P.timber[s < len * 0.5 ? 4 : 5]!);
      }
    }
    // the trunk: leaves the rock leaning, twists back, splits into arms
    const pts: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const u = k / 16;
      pts.push([dir * H * (0.35 * Math.sin(u * 2.2) + 0.12 * u) + (vnoise1(u * 5, seed) - 0.5) * H * 0.08, -H * 0.72 * u]);
    }
    const tw = (u: number): number => Math.max(1.5 / d, H * 0.085 * (1 - u * 0.7));
    for (let k = 0; k < 16; k++) {
      const [ax, ay] = pts[k]!, [bx, by] = pts[k + 1]!;
      const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * d));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const u = (k + t) / 16;
        const w = tw(u);
        const X = c.X(ax + (bx - ax) * t), Y = Math.round(c.Y(ay + (by - ay) * t));
        for (let o = -w * d / 2; o <= w * d / 2; o += 1) {
          const q = o / (w * d / 2);
          // bark: plates and fissures, lit on the left
          let col = q < -0.45 ? P.timber[2]! : q < 0.25 ? P.timber[3]! : q < 0.7 ? P.timber[4]! : P.timber[5]!;
          if (d >= 0.5 && hash(Math.round(X + o) >> 1, Y >> 1, seed) < 0.12) col = P.timber[5]!;
          b.set(Math.round(X + o), Y, col);
        }
      }
    }
    // arms: from the upper trunk, reaching out nearly level, ending in pads
    const pads: [number, number, number][] = [];
    const arms = 4 + Math.floor(r() * 3);
    for (let i = 0; i < arms; i++) {
      const u = 0.38 + 0.62 * (i / (arms - 1));
      const [ax, ay] = pts[Math.round(u * 16)]!;
      const side = i === arms - 1 ? dir : i % 2 ? -dir : dir;
      const len = H * (0.25 + 0.3 * r()) * (1 - 0.45 * u) * (side === dir ? 1.25 : 0.8);
      const ex = ax + side * len, ey = ay - len * (0.05 + 0.12 * r());
      const w = Math.max(1 / d, H * 0.022 * (1 - u * 0.5));
      const steps = Math.max(2, Math.ceil(len * d));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const X = c.X(ax + (ex - ax) * t), Y = Math.round(c.Y(ay + (ey - ay) * t - Math.sin(t * Math.PI) * len * 0.08));
        for (let o = -w * d / 2; o <= w * d / 2; o += 1) b.set(Math.round(X), Math.round(Y + o), o < 0 ? P.timber[3]! : P.timber[5]!);
      }
      // a pad at the end and one or two along the arm
      pads.push([ex, ey - 2, H * (0.12 + 0.05 * r())]);
      if (len > H * 0.25) pads.push([ax + (ex - ax) * 0.55, ay + (ey - ay) * 0.55 - 3, H * (0.08 + 0.04 * r())]);
    }
    const [tx, ty] = pts[16]!;
    pads.push([tx, ty - 2, H * 0.16]);
    // pads: wide flat layered clouds of needles, lit on top, a dark underside
    pads.sort((a, q) => a[1] - q[1]);
    for (const [px, py, pr] of pads) {
      needlePad(c, px + pr * 0.2, py + pr * 0.15, pr * 3.4, pr * 0.95, seed + Math.round(px * 3) + 1);
      needlePad(c, px - pr * 0.25, py - pr * 0.3, pr * 2.6, pr * 0.8, seed + Math.round(px * 3));
    }
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
