// The fall's clouds (the fall loop, round 1): a fall-only variant of op.cloud (opening/sky.ts, shared with Kagami, the
// vista and the website, so it stays as it is). The same family and the same sun (upper left), drawn with the whole
// value range of Dex's refs (the painterly cumulus and the sky he imagines):
//
// - BILLOWS of very different sizes (three or four big ones on the sunward side, each built of smaller lobes, the
//   smallest sprouting along the lit outline: cauliflower), never an even field of same-size ovals;
// - each billow a ball in the sun: a warm cream crown with a peach rim, a turning face, a shade that takes the sky's
//   blue, and two deep steps in the recesses where a nearer billow overlaps it and under the overhangs (the light
//   travelling through the heap from the upper left);
// - the lit outline crisp, the shaded outline lost toward the sky by a step of the sky's own blue;
// - bases flat-ish and torn, never ruled; a tower that widens and leans as it climbs, its shoulders stepping out;
// - distance by rendering: `far` compresses a cloud's values toward the sky, cools it, softens its edges, gives it
//   fewer and bigger lobes and loses its foot in the haze;
// - `streak`: the low stratus of the cloud ref: long thin torn streaks of varied lengths on one common tilt, a lit warm
//   upper edge, a cool lower edge lost into the sky, feathered ends; `wisp` the same, high, thin and pale;
// - `deck`: the cloud deck the paper falls through, a long layer seen side-on: lumpy sunlit tops, a body darkening
//   into its own shade, a flat-ish torn base with masses hanging from it lit only by the bounce from below, torn ends,
//   and gaps right through it (the paper's way down; from under the deck, the bright gaps the sun breaks through).
//
// Every cloud is its own palette ramps (palette.ts fallcu, fallfar, fallsky), flat steps with a narrow
// dithered seam where two meet (never a screen door). `frame` (0..3) swells and settles the lobes a little.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, rng, vnoise, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

export interface FallCloudP {
  kind: "cumulus" | "tower" | "streak" | "wisp" | "deck";
  /** Width and height, px of its plane; the anchor is the middle of its base. */
  w: number;
  h: number;
  /** How much a heap towers (0 flat .. 1 a great tower). */
  tower?: number;
  /** Distance, 0 near .. 1 far: value toward the sky, cooler, softer, fewer lobes, its foot lost in the haze. */
  far?: number;
  /** The sky behind it, 0 pale (low, near the haze) .. 1 deep (high overhead): its lost edges take that blue. */
  sky?: number;
  /** A tower's lean: px its crown sits west (negative) or east of its foot, per px of height. */
  lean?: number;
  /** For streaks: how many (default from the size), their common tilt (rise per px, negative: rising westward). */
  count?: number;
  tilt?: number;
  /** For a deck: the gaps right through it, [x share -0.5..0.5, width share] each. */
  gaps?: [number, number][];
  /**
   * For a deck seen only from under it (far off over the lake, receding toward the horizon): no heads on its top,
   * a flatter body, its top lost in its own haze and its base lit from below.
   */
  under?: boolean;
  frame?: number;
}

/** The sun (upper left, a little toward the viewer): the same as op.cloud's. */
const SUN = [-0.5, -0.6, 0.62] as const;
/** How much of a heap's light is its whole form (the rest its billows' and lobes'). */
const MASS_W = 0.68;

/**
 * A billow: a big round form of the cloud: its centre (y negative up), radius, depth (bigger: nearer) and how flat it
 * is (q: its height over its width; a deck's billows lie flattened).
 */
interface Form { x: number; y: number; r: number; z: number; q?: number }
/**
 * A lobe: one rounded mass seen side-on (an ellipse whose outline wanders), the billow it belongs to, its depth, a
 * wobble seed, and what it is: 0 a body lobe, 1 one on the outline, 2 a cauliflower sprout, 3 a streak.
 */
interface Lobe { x: number; y: number; rx: number; ry: number; z: number; form: number; s: number; sub: number }

const isLayer = (p: FallCloudP): boolean => p.kind === "streak" || p.kind === "wisp";
/** Its distance (a high wisp is pale and soft unless told otherwise). */
const farOf = (p: FallCloudP): number => clamp(p.far ?? (p.kind === "wisp" ? 0.6 : 0), 0, 1);
/** How deep the torn rags under a heap's or a deck's base may hang, px of its plane. */
const fringeOf = (p: FallCloudP): number => (isLayer(p) ? 0 : Math.round(clamp(p.h * (p.kind === "deck" ? 0.06 : 0.05), 3, p.kind === "deck" ? 18 : 34)));

// ---------------------------------------------------------------------------------------------------------------
// The forms

/**
 * A great tower: a broad column that widens and leans as it climbs, packed with billows of very different sizes side by
 * side and overlapping (never one ball per row: a stack of balls), its sun side stepping out in shoulders, its crown a
 * spreading cauliflower head led by a dominant billow toward the sun, its foot spreading.
 */
function towerForms(p: FallCloudP, r: () => number): Form[] {
  const W = p.w, HH = p.h, lean = p.lean ?? -0.1;
  const out: Form[] = [];
  // the column's half width at a height share u (0 the crown .. 1 the foot): broad under the crown, a little narrower
  // down the column, flaring where its foot spreads; its middle leans
  const hwAt = (u: number): number => (W / 2) * (0.8 - 0.2 * u + 0.4 * Math.max(0, u - 0.8) / 0.2);
  const cxAt = (u: number): number => -lean * HH * (u - 0.5);
  // the crown: a dominant head toward the sun rising clear of the column, smaller heads spreading off it
  const hw0 = hwAt(0.04);
  const R0 = hw0 * (0.44 + 0.06 * r());
  const crownY = -HH + R0 * 0.62;
  out.push({ x: cxAt(0) - hw0 * (0.25 + 0.12 * r()), y: crownY, r: R0, z: 0.6 });
  for (let j = 0, nc = 4 + Math.floor(r() * 3); j < nc; j++) {
    const side = j % 2 ? -1 : 1;
    const R = R0 * (0.42 + 0.3 * r());
    out.push({ x: cxAt(0) - hw0 * 0.1 + side * hw0 * (0.3 + 0.55 * r()), y: crownY + R0 * (0.05 + 0.7 * r()), r: R, z: 0.7 + j * 0.12 });
  }
  // the column: rows of billows across its width (2-4 a row, sizes 1:2.5), each row overlapping the one above by
  // most of a radius, the rows staggered
  let y = crownY + R0 * 0.75;
  let row = 0;
  while (y < -HH * 0.02) {
    const u = clamp((y + HH) / HH, 0, 1);
    const hw = hwAt(u), cx = cxAt(u);
    const sizes: number[] = [];
    let span = 0;
    while (span < hw * 2.05) {
      const g = r();
      const R = hw * (g < 0.3 ? 0.5 + 0.12 * r() : g < 0.75 ? 0.34 + 0.1 * r() : 0.2 + 0.08 * r());
      sizes.push(R);
      span += R * 1.45;
    }
    // (a shoulder: now and then the sun side's billow swells and steps out)
    const shoulder = r() < 0.4;
    // (each row's ends wander in and out: the silhouette steps, never a ruled side)
    let x = cx - hw + sizes[0]! * (shoulder ? 0.55 : 0.85) + (row % 2 ? hw * 0.08 : 0) + (r() - 0.5) * hw * 0.3;
    const end = cx + hw * (0.8 + 0.35 * r());
    let maxR = 0;
    sizes.forEach((R0b, k) => {
      const R = k === 0 && shoulder ? R0b * 1.25 : R0b;
      const yy = y + (r() - 0.5) * R * 0.5;
      if (x - R * 0.3 < end) out.push({ x, y: yy, r: R, z: 1 + u * 2.4 + r() * 0.5 });
      x += R * (1.1 + 0.35 * r());
      maxR = Math.max(maxR, R);
    });
    y += maxR * (0.55 + 0.25 * r());
    row++;
  }
  return out;
}

/**
 * One head of a heap: a crown of a few billows (the biggest toward the sun) and under it rows of billows packed across
 * the head's width down to the base, sizes 1:2.5 side by side and overlapping, the rows staggered, the ends of each row
 * wandering in and out (never a chain of shrinking balls, never a row of equal ones along the base).
 */
function packHead(out: Form[], r: () => number, cx: number, top: number, hwTop: number, hwFoot: number, lean: number, z0: number): void {
  const HH = -top;
  const hwAt = (u: number): number => hwTop + (hwFoot - hwTop) * u;
  const cxAt = (u: number): number => cx - lean * HH * (u - 0.5);
  const R0 = Math.min(hwTop * (0.4 + 0.1 * r()), HH * 0.38);
  const cy = top + R0 * 0.72;
  out.push({ x: cxAt(0) - hwTop * (0.1 + 0.2 * r()), y: cy, r: R0, z: z0 });
  for (let j = 0, nc = 2 + Math.floor(r() * 3); j < nc; j++) {
    const side = j % 2 ? -1 : 1;
    const R = R0 * (0.36 + 0.24 * r());
    out.push({ x: cxAt(0) + side * hwTop * (0.35 + 0.5 * r()), y: cy + R0 * (0.2 + 0.5 * r()), r: R, z: z0 + 0.1 + j * 0.1 });
  }
  let y = cy + R0 * (0.6 + 0.2 * r());
  let row = 0;
  const minR = Math.max(4, HH * 0.06);
  while (y < -minR * 0.6) {
    const u = clamp((y - top) / HH, 0, 1);
    const hw = hwAt(u), c = cxAt(u);
    const cap = HH * (0.2 + 0.18 * (1 - u));
    const sizes: number[] = [];
    let span = 0;
    while (span < hw * 2.05) {
      const g = r();
      const R = Math.max(minR, Math.min(cap, hw * (g < 0.3 ? 0.5 + 0.12 * r() : g < 0.75 ? 0.34 + 0.1 * r() : 0.2 + 0.08 * r())));
      sizes.push(R);
      span += R * 1.45;
    }
    let x = c - hw + sizes[0]! * 0.8 + (row % 2 ? hw * 0.06 : 0) + (r() - 0.5) * hw * 0.25;
    const end = c + hw * (0.8 + 0.3 * r());
    let maxR = 0;
    for (const R of sizes) {
      if (x - R * 0.3 < end) out.push({ x, y: Math.min(y + (r() - 0.5) * R * 0.5, -R * 0.3), r: R, z: z0 + 1 + u * 2.4 + r() * 0.5 });
      x += R * (1.1 + 0.35 * r());
      maxR = Math.max(maxR, R);
    }
    y += maxR * (0.55 + 0.25 * r());
    row++;
  }
}

/** A heap: a few heads of very different sizes (the tallest toward the sun), each a crown over packed billows. */
function heapForms(p: FallCloudP, r: () => number): Form[] {
  const tower = clamp(p.tower ?? 0.6, 0, 1);
  const W = p.w, HH = p.h, aspect = W / HH;
  const heads: { cx: number; w: number; h: number; z: number }[] = [];
  const mw = clamp(0.24 + 0.45 / aspect, 0.32, 0.8) * W;
  const mcx = -W / 2 + mw / 2 + (W - mw) * (0.08 + 0.22 * r());
  heads.push({ cx: mcx, w: mw, h: HH, z: 0 });
  let right = mcx + mw * (0.34 + 0.08 * r());
  for (let k = 0; k < 3 && right < W / 2 - W * 0.08; k++) {
    const hw = W * (0.2 + 0.14 * r());
    const cx = Math.min(W / 2 - hw / 2, right + hw * (0.12 + 0.2 * r()));
    heads.push({ cx, w: hw, h: HH * (0.6 - 0.12 * k) * (0.75 + 0.3 * r()) * (0.7 + 0.3 * (1 - tower)), z: 1 + k * 0.6 });
    right = cx + hw * (0.3 + 0.12 * r());
  }
  if (mcx - mw / 2 > -W / 2 + W * 0.05 || aspect > 1.5) {
    const hw = W * (0.14 + 0.08 * r());
    heads.push({ cx: Math.max(-W / 2 + hw / 2, mcx - mw * 0.42 - hw * 0.1), w: hw, h: HH * (0.28 + 0.16 * r()), z: 1.4 });
  }
  const out: Form[] = [];
  for (const H of heads) packHead(out, r, H.cx, -H.h, H.w * (0.3 + 0.1 * tower), H.w * 0.5, 0.04 * (r() - 0.6), H.z);
  return out;
}

/**
 * Is x (cloud px) in one of a deck's gaps at height y, widened by `pad` px? The gap's walls wander (torn, never a
 * ruled shaft); it opens wider toward the deck's base.
 */
function inGap(p: FallCloudP, x: number, y: number, seed: number, pad = 0): boolean {
  for (const [gx, gw] of p.gaps ?? []) {
    const flare = 1 + 0.6 * clamp(y / p.h + 0.6, 0, 1);
    const hw = (gw * p.w) / 2 * flare * (0.75 + 0.5 * vnoise1(y / 23 + gx * 50, seed + 71)) + pad;
    if (Math.abs(x - gx * p.w) < hw) return true;
  }
  return false;
}

/**
 * A deck: a long layer whose thickness wanders, thinner toward its torn ends; its body billows of very different
 * sizes in two or three loose tiers (the lower nearer), never one row of equal rolls; its top an uneven skyline
 * (stretches of low rolls, then a cluster of heads of very different sizes rising out of it); its base torn by the
 * mask's fringe. Gaps go right through it: no billow stands in one, so their walls are the billows' own round sides.
 */
function deckForms(p: FallCloudP, r: () => number, seed: number): Form[] {
  const W = p.w, HH = p.h;
  const out: Form[] = [];
  const thick = (x: number): number => HH * (1 - 0.65 * Math.pow(Math.min(1, Math.abs(x) / (W / 2)), 2.5)) * (0.9 + 0.2 * vnoise1(x / (HH * 3), seed + 73));
  // the body: tiers of billows, each walk along the layer with sizes 1:3 and uneven steps
  // (the lowest tier sits on the base: its billows reach below it and are cut flat-ish and torn by it, packed close,
  // so the underside is one base, never a row of rounded dark bottoms)
  const tiers = [[0.7, 0.6, 0], [0.45, 1.3, 0], [0, 2.0, 1]] as const;
  for (const [at, z, low] of tiers) {
    for (let x = -W / 2 + HH * (0.3 + 0.5 * r()); x < W / 2 - HH * 0.3;) {
      const th = thick(x);
      const g = r();
      const R = th * (g < 0.2 ? 0.4 + 0.08 * r() : g < 0.6 ? 0.28 + 0.1 * r() : 0.18 + 0.07 * r());
      const q = p.under ? 0.4 + 0.15 * r() : 0.6 + 0.2 * r();
      const y = low ? HH * 0.1 - R * q * (0.35 + 0.2 * r()) : -th * (at + (r() - 0.5) * 0.16);
      if (!inGap(p, x, y, seed, R * 0.85) && (low || r() < 0.9)) out.push({ x, y, r: R, z: z + r() * 0.4, q });
      x += R * (low ? 0.6 + 0.4 * r() : 0.8 + 0.9 * r());
    }
  }
  // the tops: where the layer heaps up (a slow noise along it), heads of very different sizes; elsewhere only low rolls
  for (let x = -W / 2 + HH * 0.6; x < W / 2 - HH * 0.6 && !p.under;) {
    const th = thick(x);
    const heap = Math.pow(vnoise1(x / (HH * 2.2), seed + 74), 1.6);
    const g = r();
    // (round 1c: sizes 1:3:9 along the layer, the big heads where it heaps, small ones and low stretches between)
    const R = th * (g < 0.2 ? 0.2 + 0.1 * r() : g < 0.6 ? 0.1 + 0.06 * r() : 0.05 + 0.04 * r()) * (1 + 1.6 * heap);
    const q = 0.78 + 0.2 * r();
    const y = -th * (0.72 + 0.1 * r()) - R * q * (0.15 + 0.5 * heap);
    if (!inGap(p, x, y, seed, R)) out.push({ x, y, r: R, z: 0.4 + r() * 0.4, q });
    x += R * (0.8 + 1.4 * r()) + th * 0.1 * r();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The lobes

/** Is (x, y) inside any form but the k-th (inflated by a share)? */
function inOther(F: Form[], k: number, x: number, y: number, grow = 1): boolean {
  for (let j = 0; j < F.length; j++) {
    if (j === k) continue;
    const f = F[j]!;
    if (Math.hypot((x - f.x) / f.r, (y - f.y) / (f.r * (f.q ?? 1))) < grow) return true;
  }
  return false;
}

/** A heap's or tower's lobes from its billows (y negative up; nothing below the base, which is 0). */
function heapLobes(p: FallCloudP, seed: number): { L: Lobe[]; F: Form[] } {
  const r = rng(seed + 5);
  const F = p.kind === "tower" ? towerForms(p, r) : p.kind === "deck" ? deckForms(p, r, seed) : heapForms(p, r);
  const far = clamp(p.far ?? 0, 0, 1);
  const deck = p.kind === "deck";
  // (round 1b) a big billow is itself a cauliflower: a few billows of a third to a half its size swell from its
  // upper, sunward half (in front of it), so a crown never reads as one bald dome
  // (round 1c: a deck's heads too, the ones standing in its sunlit top: bald domes in a row were the gust's fault)
  if (!deck || !p.under) {
    const grainPx = clamp(Math.min(p.w, p.h) * 0.032, 6, 30) * (1 + 0.8 * far);
    const n0 = F.length;
    // (only the crowns: billows whose tops stand in the cloud's upper reach; the body below stays quiet, its billows
    // big and soft, the detail where the light is)
    let top = 0;
    for (const f of F) top = Math.min(top, f.y - f.r * (f.q ?? 1));
    for (let i = 0; i < n0; i++) {
      const f = F[i]!;
      if (f.r < grainPx * 3.2 || f.y - f.r * (f.q ?? 1) > top + p.h * (deck ? 0.42 : 0.3)) continue;
      for (let j = 0, n = 2 + Math.floor(r() * 2); j < n; j++) {
        const a = -Math.PI / 2 + (r() - 0.62) * 2.4;
        const cr = f.r * (0.3 + 0.18 * r());
        const d = f.r - cr * (0.95 + 0.3 * r());
        F.push({ x: f.x + Math.cos(a) * d, y: Math.min(f.y + Math.sin(a) * d * (f.q ?? 1), -cr * 0.4), r: cr, z: f.z + 0.05 + 0.02 * j, q: f.q });
      }
    }
  }
  const L: Lobe[] = [];
  const minR = Math.max(2.6, Math.min(p.w, p.h) * 0.006) * (1 + far);
  F.forEach((f, fi) => {
    // the billow's lobes: a few to a dozen across it, of very different sizes (far: fewer, bigger)
    // (the cauliflower's grain stays about the same size on screen whatever the billow's size: small lobes in a big
    // billow, never a few giant ovals)
    const grain = clamp(Math.min(p.w, p.h) * 0.032, 6, 30) * (1 + 0.8 * far);
    const rho = Math.max(minR * 1.4, Math.min(f.r * (0.28 + 0.12 * far), grain));
    const zb = f.z * 10;
    const fq = f.q ?? 1;
    for (let gy = f.y - f.r * fq; gy < f.y + f.r * fq; gy += rho * (0.85 + 0.3 * r())) {
      for (let gx = f.x - f.r + rho * r() * 0.6; gx < f.x + f.r; gx += rho * (0.95 + 0.5 * r())) {
        const x = gx + (r() - 0.5) * rho * 0.5, y = gy + (r() - 0.5) * rho * 0.4;
        const d = Math.hypot((x - f.x) / f.r, (y - f.y) / (f.r * fq));
        if (d > 1 - (rho * 0.45) / (f.r * fq) || y > (deck ? p.h * 0.2 : -rho * 0.2)) continue;
        const g = r();
        const sideSun = ((x - f.x) * SUN[0] + (y - f.y) * SUN[1]) / f.r;
        const rad = rho * (g < 0.2 ? 1.15 + 0.3 * r() : g < 0.7 ? 0.75 + 0.3 * r() : 0.5 + 0.2 * r()) * (sideSun < -0.2 ? 1.45 : 1);
        // (the lower lobes stand in front of the ones above them)
        L.push({ x, y, rx: rad * (1 + 0.15 * r()), ry: rad * (0.86 + 0.1 * r()), z: zb + (y - f.y) / f.r + r() * 0.3, form: fi, s: Math.floor(r() * 997), sub: 0 });
      }
    }
    // its outline where it shows (not inside another billow): lobes walked round it, small and many where it faces the
    // sun (sprouting smaller ones: cauliflower), broad on the shaded side
    const steps = Math.max(8, Math.round((Math.PI * f.r * (1 + fq)) / Math.max(minR * 1.6, rho * 0.4)));
    let skip = 0;
    for (let i = 0; i < steps; i++) {
      if (skip-- > 0) continue;
      const a = (i / steps) * 2 * Math.PI + r() * 0.1;
      const ex = f.x + Math.cos(a) * f.r, ey = f.y + Math.sin(a) * f.r * fq;
      if (ey > (deck ? p.h * 0.2 : -minR) || inOther(F, fi, ex, ey, 0.96)) continue;
      const enx0 = Math.cos(a) * fq, eny0 = Math.sin(a), enl = Math.hypot(enx0, eny0) || 1;
      const enx = enx0 / enl, eny = eny0 / enl;
      const facing = -(enx * SUN[0] + eny * SUN[1]);
      const lit = facing > 0.1;
      let rad = rho * (lit ? 0.32 + 0.3 * r() : 0.55 + 0.35 * r()) * (1 + 0.5 * far);
      rad = Math.max(minR, rad);
      const sink = rad * (lit ? 0.15 + 0.35 * r() : 0.4 + 0.3 * r());
      const lx = ex - enx * sink, ly = ey - eny * sink;
      const b: Lobe = { x: lx, y: ly, rx: rad * (1 + 0.15 * r()), ry: rad * (0.88 + 0.1 * r()), z: zb + 0.6 + (ly - f.y) / f.r * 0.5 + r() * 0.2, form: fi, s: Math.floor(r() * 997), sub: 1 };
      L.push(b);
      skip = lit ? 0 : Math.floor(r() * 2);
      // cauliflower: sprouts round the lit lobe's upper-left rim, and again on the biggest of those
      if (lit && far < 0.6 && rad > minR * 1.8) {
        let gen = [b];
        for (let level = 0; level < 2 && gen.length; level++) {
          const next: Lobe[] = [];
          for (const q of gen) {
            const k = 1 + Math.floor(r() * (level ? 1.5 : 2.4));
            for (let j = 0; j < k; j++) {
              const ang = Math.atan2(SUN[1], SUN[0]) + (r() - 0.5) * 1.9;
              const sr = q.rx * (0.36 + 0.18 * r());
              if (sr < minR * 0.85) continue;
              const reach = q.rx * (0.66 + 0.14 * r());
              next.push({ x: q.x + Math.cos(ang) * reach, y: q.y + Math.sin(ang) * reach * 0.92, rx: sr, ry: sr * 0.9, z: q.z + 0.05, form: fi, s: Math.floor(r() * 997), sub: 2 });
            }
          }
          L.push(...next);
          gen = next.filter((q) => q.rx > minR * 2);
        }
      }
    }
  });
  return { L, F };
}

/**
 * Streaks (the cloud ref's low stratus): long thin spindles on one common tilt, lengths varied 3:1 and more, in two
 * or three loose tiers with sky between them, each lifted along its top by a few low humps; a wisp: fewer, thinner.
 */
function streakLobes(p: FallCloudP, seed: number): { L: Lobe[]; F: Form[] } {
  const r = rng(seed + 5);
  const W = p.w, HH = p.h;
  const wisp = p.kind === "wisp";
  const tilt = p.tilt ?? -0.035;
  const L: Lobe[] = [];
  const n = p.count ?? Math.max(2, Math.round((W / HH) * (wisp ? 0.22 : 0.32)));
  for (let i = 0; i < n; i++) {
    // lengths varied 3:1 and more; each a chain of flattened lobes of very different sizes along the common tilt,
    // thickest a little west of its middle, its ends trailing off in smaller, thinner rags with sky between them
    const g = r();
    const len = W * (g < 0.25 ? 0.65 + 0.3 * r() : g < 0.7 ? 0.32 + 0.2 * r() : 0.15 + 0.1 * r());
    const cx = (r() - 0.5) * (W - len) * 0.95;
    // (each streak its own tier, with sky between them: never a tangle of scraps)
    const cy = -HH * (0.2 + 0.65 * ((n - i - 0.5) / n + (r() - 0.5) * 0.25 / n));
    const th = Math.max(1.5, HH * (wisp ? 0.07 + 0.07 * r() : 0.08 + 0.08 * r()) * (0.7 + 0.5 * (len / W)));
    const bend = (r() - 0.5) * th * (wisp ? 5 : 1.2);
    for (let x = cx - len / 2; x < cx + len / 2;) {
      const u = (x - cx) / (len / 2);
      const taper = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u + 0.15), 2.2)), 0.8);
      const lw = th * (wisp ? 4 + 5 * r() : 2.2 + 3.2 * r()) * (0.45 + 0.55 * taper);
      const lh = Math.max(1.2, th * (0.55 + 0.6 * r() * r()) * (0.3 + 0.7 * taper));
      // (torn: past the middle stretch the chain breaks, more often toward its ends)
      const torn = Math.abs(u) > 0.55 && r() < (Math.abs(u) - 0.55) * 1.4;
      if (!torn && lh >= 1.2) {
        const y = cy + tilt * (x - cx) + bend * (1 - u * u) + (r() - 0.5) * th * 0.6;
        L.push({ x: x + lw / 2, y, rx: lw / 2, ry: lh, z: i * 3 + r() * 0.5 - y / HH, form: -1, s: Math.floor(r() * 997), sub: 0 });
        // a hump on its top now and then (the lit tops of the low stratus), smaller than the lobe under it
        if (!wisp && r() < 0.35 * taper) {
          const hr = lh * (0.7 + 0.6 * r());
          L.push({ x: x + lw * (0.3 + 0.4 * r()), y: y - lh * 0.55 - hr * 0.3, rx: hr * (1.4 + 0.8 * r()), ry: hr * 0.85, z: i * 3 - 0.5 - y / HH, form: -1, s: Math.floor(r() * 997), sub: 0 });
        }
      }
      x += lw * (0.45 + 0.4 * r());
    }
  }
  return { L, F: [] };
}

function lobesOf(p: FallCloudP, seed: number): { L: Lobe[]; F: Form[] } {
  return cached(`fc2|${seed}|${p.kind}|${p.w}|${p.h}|${p.tower ?? ""}|${p.far ?? ""}|${p.lean ?? ""}|${p.count ?? ""}|${p.tilt ?? ""}|${p.under ? 1 : 0}|${JSON.stringify(p.gaps ?? [])}`, () =>
    isLayer(p) ? streakLobes(p, seed) : heapLobes(p, seed));
}

// ---------------------------------------------------------------------------------------------------------------
// The mask and its light

/** Three box passes (about a gaussian) of radius r over a w x h field, in place. */
function blur3(f: Float32Array, w: number, h: number, r: number): void {
  if (r < 1) return;
  const t = new Float32Array(Math.max(w, h));
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += f[y * w + Math.min(w - 1, Math.max(0, x))]!;
      for (let x = 0; x < w; x++) {
        t[x] = acc / (2 * r + 1);
        acc += f[y * w + Math.min(w - 1, x + r + 1)]! - f[y * w + Math.max(0, x - r)]!;
      }
      for (let x = 0; x < w; x++) f[y * w + x] = t[x]!;
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += f[Math.min(h - 1, Math.max(0, y)) * w + x]!;
      for (let y = 0; y < h; y++) {
        t[y] = acc / (2 * r + 1);
        acc += f[Math.min(h - 1, y + r + 1) * w + x]! - f[Math.max(0, y - r) * w + x]!;
      }
      for (let y = 0; y < h; y++) f[y * w + x] = t[y]!;
    }
  }
}

/** Chamfer distance to the nearest px outside a mask (0 outside); past the grid's edge counts as outside unless `open`. */
function chamfer(inside: (i: number) => boolean, w: number, h: number, open = false): Float32Array {
  const dist = new Float32Array(w * h);
  const E = open ? 1e6 : 1;
  for (let i = 0; i < w * h; i++) dist[i] = inside(i) ? 1e6 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!dist[i]) continue;
    let v = Math.min(dist[i]!, x > 0 ? dist[i - 1]! + 1 : E, y > 0 ? dist[i - w]! + 1 : E);
    if (x > 0 && y > 0) v = Math.min(v, dist[i - w - 1]! + 1.41);
    if (x < w - 1 && y > 0) v = Math.min(v, dist[i - w + 1]! + 1.41);
    dist[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!dist[i]) continue;
    let v = Math.min(dist[i]!, x < w - 1 ? dist[i + 1]! + 1 : E, y < h - 1 ? dist[i + w]! + 1 : E);
    if (x < w - 1 && y < h - 1) v = Math.min(v, dist[i + w + 1]! + 1.41);
    if (x > 0 && y < h - 1) v = Math.min(v, dist[i + w - 1]! + 1.41);
    dist[i] = v;
  }
  return dist;
}

/** A cloud as fields on its level-1 grid: the palette index of each px (0: sky) and how wide its seam is. */
interface CloudMask { x0: number; y0: number; w: number; h: number; t: Float32Array; kind: Uint8Array; seam: Float32Array }

/** Pixel kinds of the mask: 0 sky, 1 body (tone t on the ramp), 2 lost edge, 3 lit rim, 4 bounce, 5 haze foot, 6 the lost edge's inner px. */
const SKY = 0, BODY = 1, EDGE = 2, RIM = 3, BOUNCED = 4, FOOT = 5, EDGE2 = 6;

function cloudMask(p: FallCloudP, seed: number, f: number): CloudMask {
  return cached(`fm2|${seed}|${p.kind}|${p.w}|${p.h}|${p.tower ?? ""}|${p.far ?? ""}|${p.lean ?? ""}|${p.count ?? ""}|${p.tilt ?? ""}|${p.under ? 1 : 0}|${p.sky ?? ""}|${JSON.stringify(p.gaps ?? [])}|${f}`, () => {
    const { L: L0, F } = lobesOf(p, seed);
    const deck = p.kind === "deck";
    const layer = isLayer(p);
    const far = farOf(p);
    const tilt = p.tilt ?? (layer ? -0.035 : 0);
    // the lobes this frame: each swelling and settling a little (the heap churns as it drifts)
    const L = L0.map((b, i) => {
      const k = 1 + 0.025 * Math.sin(f * 1.57 + i * 1.7);
      return { ...b, rx: b.rx * k, ry: b.ry * k };
    });
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const b of L) {
      bx0 = Math.min(bx0, b.x - b.rx * 1.2); bx1 = Math.max(bx1, b.x + b.rx * 1.2);
      by0 = Math.min(by0, b.y - b.ry * 1.25 + (layer ? Math.min(0, tilt * (b.x - b.rx)) : 0) - (layer ? Math.abs(tilt) * b.rx : 0));
      by1 = Math.max(by1, b.y + b.ry * 1.25 + (layer ? Math.abs(tilt) * b.rx : 0));
    }
    // (room under the base for its torn fringe)
    const FR = fringeOf(p);
    if (!layer) by1 = Math.min(by1, deck ? p.h * 0.24 : 4) + FR;
    const x0 = Math.floor(bx0) - 6, y0 = Math.floor(by0) - 6;
    const w = Math.ceil(bx1) - x0 + 7, h = Math.ceil(by1) - y0 + 7;
    const own = new Int32Array(w * h).fill(-1);
    const zb = new Float32Array(w * h).fill(-1e9);
    const NX = new Float32Array(w * h), NY = new Float32Array(w * h), U = new Float32Array(w * h);
    // the base: flat-ish at the cloud's scale, torn: it wanders, sags in rounded scallops and notches up between them
    const S = Math.max(8, p.h * (deck ? 0.09 : 0.05)), SX = Math.max(S, p.w * (deck ? 0.008 : 0.012));
    // (round 1b: no notches: the base hangs in a few rounded sags; the torn part is the fringe of rags under it)
    const baseAt = (x: number): number => {
      const sag = Math.pow(Math.max(0, vnoise1(x / (SX * 2.6), seed + 35) - 0.5), 1.6) * S * 3.2;
      // (round 1c: and a slow swell along a long base, so a wide heap's foot is never one ruled line)
      return sag + (vnoise1(x / (SX * 5), seed + 36) - 0.5) * S * 0.8 + (vnoise1(x / 6, seed + 34) - 0.5) * 1.4 + (vnoise1(x / (S * 9), seed + 33) - 0.5) * S * 0.5 +
        (vnoise1(x / Math.max(60, p.w * 0.13), seed + 37) - 0.5) * Math.min(S * 2.2, p.w * 0.03);
    };
    // (the base once per column)
    const baseCol = new Float32Array(w);
    for (let gx = 0; gx < w; gx++) baseCol[gx] = baseAt(x0 + gx + 0.5) + (deck ? p.h * 0.12 : 0);
    L.forEach((b, i) => {
      const strand = b.sub === 3;
      const reachY = strand ? Math.abs(tilt) * b.rx + b.ry * 1.3 : b.ry * 1.2;
      const gx0 = Math.max(0, Math.floor(b.x - b.rx * 1.2 - x0)), gx1 = Math.min(w - 1, Math.ceil(b.x + b.rx * 1.2 - x0));
      const gy0 = Math.max(0, Math.floor(b.y - reachY - y0)), gy1 = Math.min(h - 1, Math.ceil(b.y + reachY - y0));
      for (let gy = gy0; gy <= gy1; gy++) {
        const py = y0 + gy + 0.5;
        for (let gx = gx0; gx <= gx1; gx++) {
          const px = x0 + gx + 0.5;
          if (!layer && b.form >= 0 && py > baseCol[gx]!) continue;
          let dx = (px - b.x) / b.rx, dy = (py - b.y) / b.ry;
          let rr: number;
          if (strand) {
            // a spindle on the tilt: thickest a little west of its middle, thinning to torn, feathered ends; its top
            // edge lumpy, its underside flatter and lost
            const yy = py - (b.y + tilt * (px - b.x));
            const u = dx;
            if (Math.abs(u) >= 1) continue;
            const prof = Math.pow(1 - u * u, 0.7) * (0.75 + 0.5 * vnoise1(px / (b.rx * 0.18 + 6) + b.s, seed + 44));
            const topE = -b.ry * prof * (1 + 0.45 * vnoise1(px / 9 + b.s, seed + 45));
            const botE = b.ry * prof * 0.7;
            if (yy < topE || yy > botE) continue;
            // ends: rags (holes at the cloud's own scale)
            const au = Math.abs(u);
            if (au > 0.55 && vnoise((px - b.x) / 7 + b.s, yy / 2.5, seed + 43) > 1.08 - (au - 0.55) * 1.6) continue;
            dy = yy < 0 ? yy / Math.max(0.5, -topE) : yy / Math.max(0.5, botE);
            dx = u * 0.25;
            rr = 1;
            const k = gy * w + gx;
            const z = b.z * 100 + (1 - dy * dy) * 0.04;
            if (z > zb[k]!) { zb[k] = z; own[k] = i; NX[k] = dx; NY[k] = clamp(dy, -1, 1) * 0.9; U[k] = au; }
            continue;
          }
          const q0 = dx * dx + dy * dy;
          if (q0 > 1.21) continue;
          const k = gy * w + gx;
          if (b.z + 0.04 <= zb[k]!) continue;
          // (the outline wanders: only near it is the wobble worth its noise)
          rr = 1;
          if (q0 > 0.8) {
            const ang = Math.atan2(dy, dx);
            rr = 1 + 0.12 * (vnoise1(ang * 2.2 + b.s, seed + 41) - 0.5) + 0.07 * (vnoise1(ang * 6.5 + b.s, seed + 42) - 0.5);
          }
          const q = q0 / (rr * rr);
          if (q > 1) continue;
          const z = b.z + (1 - q) * 0.04;
          if (z > zb[k]!) { zb[k] = z; own[k] = i; NX[k] = dx / rr; NY[k] = dy / rr; U[k] = 0; }
        }
      }
    });
    // no sky through a heap: a hole between lobes that the outside cannot reach takes the lobe beside it
    if (!layer) {
      // (a closing: the outside is the sky reached from the border through gaps wider than about five px, grown back
      // to the cloud; channels and pits narrower than that close up, no cracks through a heap)
      const near = chamfer((i) => own[i] === -1, w, h, true);
      const out = new Uint8Array(w * h);
      const q: number[] = [];
      for (let x = 0; x < w; x++) q.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y++) q.push(y * w, y * w + w - 1);
      while (q.length) {
        const i = q.pop()!;
        if (out[i] || own[i] !== -1 || near[i]! <= 2.5) continue;
        out[i] = 1;
        const x = i % w, y = (i - x) / w;
        if (x > 0) q.push(i - 1);
        if (x < w - 1) q.push(i + 1);
        if (y > 0) q.push(i - w);
        if (y < h - 1) q.push(i + w);
      }
      const back = chamfer((i) => out[i] !== 1, w, h, true);
      for (let i = 0; i < w * h; i++) if (!out[i] && own[i] === -1 && back[i]! <= 3.1) out[i] = 1;
      // (a breadth-first fill from the holes' rims inward: every enclosed px takes the nearest lobe, whatever the size)
      const fq: number[] = [];
      for (let i = w; i < w * h - w; i++) if (!out[i] && own[i] === -1 && (own[i - 1] !== -1 || own[i + 1] !== -1 || own[i - w] !== -1 || own[i + w] !== -1)) fq.push(i);
      for (let qi = 0; qi < fq.length; qi++) {
        const i = fq[qi]!;
        if (own[i] !== -1) continue;
        // (the nearest of its neighbours: a hole in a near billow is that billow, never a pit into the one behind)
        let n = -1;
        for (const j of [i - 1, i + 1, i - w, i + w]) if (own[j] !== -1 && (n < 0 || zb[j]! > zb[n]!)) n = j;
        if (n < 0) continue;
        own[i] = own[n]!; zb[i] = zb[n]!; NX[i] = 0; NY[i] = 0.2;
        for (const j of [i - 1, i + 1, i - w, i + w]) if (j >= w && j < w * h - w && !out[j] && own[j] === -1) fq.push(j);
      }
    }
    // no pits: a small patch of a farther billow showing through a gap in a nearer one is that nearer billow (a crevice
    // too small to read as one reads as a hole)
    if (!layer) {
      const fOf = (o: number): number => (o >= 0 ? L[o]!.form : o);
      const seen = new Uint8Array(w * h);
      const minA = Math.max(60, Math.min(p.w, p.h) * 0.6);
      const stack: number[] = [], reg: number[] = [];
      for (let s0 = 0; s0 < w * h; s0++) {
        if (seen[s0] || own[s0] === -1) continue;
        const f0 = fOf(own[s0]!);
        stack.length = 0; reg.length = 0;
        stack.push(s0); seen[s0] = 1;
        let nearer = -1, nearerZ = -1e9, foreign = 0, open = false;
        while (stack.length) {
          const i = stack.pop()!;
          reg.push(i);
          const x = i % w;
          for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
            if (j < 0 || j >= w * h) { open = true; continue; }
            const oj = own[j]!;
            if (oj === -1) { open = true; continue; }
            if (fOf(oj) === f0) { if (!seen[j]) { seen[j] = 1; stack.push(j); } continue; }
            foreign++;
            if (zb[j]! > nearerZ) { nearerZ = zb[j]!; nearer = j; }
          }
        }
        // (a region past the size, or touching the sky, keeps its own billow)
        if (reg.length > minA || open || nearer < 0 || nearerZ <= zb[s0]!) continue;
        for (const i of reg) { own[i] = own[nearer]!; zb[i] = nearerZ; NX[i] = NX[i]! * 0.5; NY[i] = NY[i]! * 0.5 + 0.1; }
        void foreign;
      }
    }
    // no slivers: a lobe showing only as a 1 px crack between two neighbours that agree takes their lobe
    for (let pass = 0; pass < 2; pass++) {
      for (let gy = 1; gy < h - 1; gy++) for (let gx = 1; gx < w - 1; gx++) {
        const k = gy * w + gx, o = own[k]!;
        if (o < 0) continue;
        const l = own[k - 1]!, rt = own[k + 1]!, u = own[k - w]!, d = own[k + w]!;
        if (l >= 0 && l === rt && l !== o) { own[k] = l; zb[k] = zb[k - 1]!; NX[k] = (NX[k - 1]! + NX[k + 1]!) / 2; NY[k] = (NY[k - 1]! + NY[k + 1]!) / 2; continue; }
        if (u >= 0 && u === d && u !== o) { own[k] = u; zb[k] = zb[k - w]!; NX[k] = (NX[k - w]! + NX[k + w]!) / 2; NY[k] = (NY[k - w]! + NY[k + w]!) / 2; }
      }
    }
    // the base torn, not ruled: rags of very different widths hanging under it (a slow noise along it, elongated
    // sideways), each joined to the base above it and thinning as it hangs; they take the base's own lobe
    if (!layer && FR > 0) {
      const tops = new Int32Array(w).fill(-1);
      for (let gx = 0; gx < w; gx++) for (let gy = h - 1; gy >= 0; gy--) if (own[gy * w + gx] !== -1) { tops[gx] = gy; break; }
      for (let gx = 1; gx < w - 1; gx++) {
        const yb = tops[gx]!;
        if (yb < 0) continue;
        const px = x0 + gx + 0.5;
        // (how ragged this stretch of the base is: some stretches hang long rags, others barely fray)
        const reachK = 0.25 + 0.75 * Math.pow(vnoise1(px / (FR * 6 + 20), seed + 93), 1.3);
        const src = yb * w + gx;
        for (let d = 1; d <= FR && yb + d < h - 1; d++) {
          const py = y0 + yb + d + 0.5;
          // (a deck's rags are torn sideways, wisps trailing under its base, never a comb of one-px columns)
          const v = deck
            ? 0.75 * vnoise(px / (12 + FR * 1.2), py / 3.2, seed + 91) + 0.25 * vnoise(px / 5, py / 2.2, seed + 92)
            : 0.65 * vnoise(px / (4 + FR * 0.45), py / 2.4, seed + 91) + 0.35 * vnoise(px / 2.6, py / 1.6, seed + 92);
          if (v < 0.28 + 0.72 * (d / (FR * reachK + 1))) break;
          const k = (yb + d) * w + gx;
          own[k] = own[src]!; zb[k] = zb[src]!; NX[k] = NX[src]! * 0.5; NY[k] = 0.85;
        }
      }
    }
    // a streak is one band, not a row of ovals: its light runs across its whole thickness, column by column (lit along
    // its lumpy top, cool along its underside), whatever lobes built it
    if (layer) {
      for (let gx = 0; gx < w; gx++) {
        for (let gy = 0; gy < h;) {
          if (own[gy * w + gx] === -1) { gy++; continue; }
          let e = gy;
          while (e < h && own[e * w + gx] !== -1) e++;
          const n = e - gy;
          for (let y = gy; y < e; y++) {
            const v = n > 1 ? (y - gy) / (n - 1) : 0.5;
            NX[y * w + gx] = 0;
            NY[y * w + gx] = (v * 2 - 1) * 0.92;
          }
          gy = e;
        }
      }
    }
    // (round 1c) a deck's column tops, smoothed along the layer: how deep each px lies in the layer, from its sunlit
    // skyline down to its base (a head's own column does not make a seam in the underside's light)
    const colTop = new Float32Array(w);
    if (deck) {
      const raw = new Float32Array(w);
      let last = -1;
      for (let gx = 0; gx < w; gx++) {
        let t = -1;
        for (let gy = 0; gy < h; gy++) if (own[gy * w + gx] !== -1) { t = gy; break; }
        raw[gx] = t >= 0 ? y0 + t : last >= 0 ? last : y0 + h * 0.3;
        if (t >= 0) last = raw[gx]!;
      }
      const R = Math.max(4, Math.round(p.h * 0.45));
      let acc = 0;
      for (let x = -R; x <= R; x++) acc += raw[Math.min(w - 1, Math.max(0, x))]!;
      for (let gx = 0; gx < w; gx++) {
        colTop[gx] = acc / (2 * R + 1);
        acc += raw[Math.min(w - 1, gx + R + 1)]! - raw[Math.max(0, gx - R)]!;
      }
    }
    // (a deck: how far each px lies above the sky under it, so the lowest lip of every hanging mass and rag takes the
    // light thrown up from below, following the torn outline)
    const below = new Uint16Array(deck ? w * h : 0);
    if (deck) {
      for (let gx = 0; gx < w; gx++) {
        let run = 0;
        for (let gy = h - 1; gy >= 0; gy--) {
          const k = gy * w + gx;
          run = own[k] === -1 ? 0 : Math.min(60000, run + 1);
          below[k] = run;
        }
      }
    }
    const inside = (i: number): boolean => own[i] !== -1;
    const dist = chamfer(inside, w, h);
    const Htot = Math.max(8, h);
    // how far the light travels through the cloud to reach each px (on a 2 px grid, blurred): a heap's lower right
    // lies in its own shade
    const L3 = SUN;
    const G = 2, gw = Math.ceil(w / G), gh = Math.ceil(h / G);
    const ins = (gx: number, gy: number): boolean => own[Math.min(h - 1, gy * G) * w + Math.min(w - 1, gx * G)] !== -1;
    const lg = new Float32Array(gw * gh);
    {
      // (one pass in order along the light: each cell's run toward the light is the next cell's run plus one, while
      // the cloud goes on that way: the distance the light travels through it)
      // (a step of 1.5 cells, so the sample never reaches back into the cell itself)
      const ux = L3[0] / Math.hypot(L3[0], L3[1]), uy = L3[1] / Math.hypot(L3[0], L3[1]), ST = 1.5;
      const order = new Uint32Array(gw * gh);
      const key = new Float32Array(gw * gh);
      for (let i = 0; i < gw * gh; i++) { order[i] = i; key[i] = -((i % gw) * ux + Math.floor(i / gw) * uy); }
      order.sort((a, b) => key[a]! - key[b]!);
      const run = new Float32Array(gw * gh);
      for (const i of order) {
        const gx = i % gw, gy = (i - gx) / gw;
        const sx = gx + ux * ST, sy = gy + uy * ST;
        const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
        if (ix < 0 || iy < 0 || ix + 1 >= gw || iy + 1 >= gh) continue;
        const r00 = run[iy * gw + ix]!, r10 = run[iy * gw + ix + 1]!, r01 = run[(iy + 1) * gw + ix]!, r11 = run[(iy + 1) * gw + ix + 1]!;
        const rv = (r00 * (1 - fx) + r10 * fx) * (1 - fy) + (r01 * (1 - fx) + r11 * fx) * fy;
        const nIn = ins(Math.round(sx), Math.round(sy));
        run[i] = nIn || rv > 0.5 ? rv + ST : 0;
        if (ins(gx, gy)) lg[i] = run[i]! * G;
      }
    }
    blur3(lg, gw, gh, Math.max(2, Math.round(Htot * 0.025)));
    // (round 1b) the whole cloud's own form: its silhouette swollen into one big soft mass, lit on its sun side, its
    // far side and its underside in shade, so the billows read as parts of one heap, never a stack of balls
    const RM = layer ? 0 : clamp(deck ? p.h * 0.5 : Math.min(p.w, p.h) * 0.17, 6, 96);
    const mg = new Float32Array(gw * gh);
    if (RM > 0) {
      for (let i = 0; i < gw * gh; i++) { const cx = i % gw; mg[i] = ins(cx, (i - cx) / gw) ? 1 : 0; }
      blur3(mg, gw, gh, Math.max(1, Math.round(RM / G / 1.7)));
    }
    const massN = (gx: number, gy: number): [number, number, number] => {
      const cx = Math.min(gw - 2, Math.max(1, Math.floor(gx / G))), cy = Math.min(gh - 2, Math.max(1, Math.floor(gy / G)));
      const dx = (mg[cy * gw + cx + 1]! - mg[cy * gw + cx - 1]!) / (2 * G), dy = (mg[(cy + 1) * gw + cx]! - mg[(cy - 1) * gw + cx]!) / (2 * G);
      const kk = RM * 2.2;
      const nx = -dx * kk, ny = -dy * kk, l = Math.hypot(nx, ny, 1);
      return [nx / l, ny / l, 1 / l];
    };
    const reach = layer ? Math.max(6, Htot * 0.9) : deck ? Htot * 0.6 : Math.min(Htot * 0.55, p.w * 0.5);
    const deepAt = (gx: number, gy: number): number =>
      clamp(lg[Math.min(gh - 1, Math.floor(gy / G)) * gw + Math.min(gw - 1, Math.floor(gx / G))]! / reach + (vnoise(gx / (Htot * 0.12 + 4), gy / (Htot * 0.1 + 4), seed + 47) - 0.5) * 0.05, 0, 1);
    // the recesses: how much of the air round a px is filled by a NEARER lobe (it is tucked behind and under it)
    // (two scales: a billow tucked behind and under a nearer billow lies in a deep recess; a lobe just above a nearer
    // lobe of its own billow takes only a short contact shade, so the cauliflower reads without outlining every lobe)
    const aoR = clamp(Math.min(p.w, p.h) * 0.045, 4, 30) * (1 - 0.4 * far);
    const ring = (R: number, n: number, drop: number): [number, number][] => {
      const out: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const a = i * 2.39996, d = R * Math.sqrt((i + 0.5) / n);
        out.push([Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d * 0.9 + R * drop)]);
      }
      return out;
    };
    const AOS = ring(aoR, 16, 0.3);
    const CTS = ring(Math.max(2, aoR * 0.18), 6, 0.6);
    const formOf = (i: number): number => (i >= 0 ? L[i]!.form : -2);
    const formZ = (fi: number): number => (fi >= 0 ? F[fi]!.z : fi === -1 ? 9 : -9);
    // (the recesses on a 2 px grid: each cell's share of the ring round it held by a nearer billow)
    const AG = 2, aw = Math.ceil(w / AG), ah = Math.ceil(h / AG);
    const fz = new Float32Array(aw * ah).fill(-1e9);
    const ff = new Int32Array(aw * ah).fill(-3);
    for (let ay = 0; ay < ah; ay++) for (let ax = 0; ax < aw; ax++) {
      const o = own[Math.min(h - 1, ay * AG) * w + Math.min(w - 1, ax * AG)]!;
      if (o === -1) continue;
      const fo = formOf(o);
      ff[ay * aw + ax] = fo;
      fz[ay * aw + ax] = formZ(fo);
    }
    const aoG = new Float32Array(aw * ah);
    const AOH = AOS.map(([ox, oy]) => [Math.round(ox / AG), Math.round(oy / AG)] as const);
    if (!layer) {
      for (let ay = 0; ay < ah; ay++) for (let ax = 0; ax < aw; ax++) {
        const c = ay * aw + ax, f0 = ff[c]!;
        if (f0 === -3) continue;
        const z0 = fz[c]! + 0.05;
        let n = 0;
        for (const [ox, oy] of AOH) {
          const sx = ax + ox, sy = ay + oy;
          if (sx < 0 || sy < 0 || sx >= aw || sy >= ah) continue;
          const j = sy * aw + sx;
          if (ff[j] !== f0 && fz[j]! > z0) n++;
        }
        aoG[c] = clamp((n / AOH.length) * 1.6, 0, 1);
      }
      blur3(aoG, aw, ah, 1);
    }
    const aoAt = (gx: number, gy: number): number => aoG[Math.min(ah - 1, Math.floor(gy / AG)) * aw + Math.min(aw - 1, Math.floor(gx / AG))]!;
    // (a deck's underside: its recesses soft and broad, never a crack along each billow's edge)
    // (round 1c: and in a heap's own shade too: there a recess is a soft pocket of deeper blue, never a dark line
    // round every billow: the turtle-shell the stronger shade drew on the tower's lower body)
    const aoS = layer ? aoG : Float32Array.from(aoG);
    if (!layer) blur3(aoS, aw, ah, Math.max(2, Math.round((aoR / AG) * (deck ? 1 : 0.7))));
    const aoSoftAt = (gx: number, gy: number): number => aoS[Math.min(ah - 1, Math.floor(gy / AG)) * aw + Math.min(aw - 1, Math.floor(gx / AG))]!;
    const t = new Float32Array(w * h);
    const kind = new Uint8Array(w * h);
    const sky = clamp(p.sky ?? 0.5, 0, 1);
    for (let gy = 1; gy < h - 1; gy++) for (let gx = 1; gx < w - 1; gx++) {
      const k = gy * w + gx;
      const i = own[k]!;
      if (i === -1) continue;
      const b = i >= 0 ? L[i]! : null;
      const nx = NX[k]!, ny = NY[k]!;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lamL = L3[0] * nx + L3[1] * ny + L3[2] * nz;
      // the billow's own light (its big form, a ball)
      let lamF = lamL, up = 0, fby = 0, fbz = 1;
      const fo = b && b.form >= 0 ? F[b.form] : undefined;
      if (fo) {
        let ux = (x0 + gx + 0.5 - fo.x) / fo.r, uy = (y0 + gy + 0.5 - fo.y) / (fo.r * (fo.q ?? 1));
        const ul = Math.hypot(ux, uy);
        if (ul > 0.98) { ux *= 0.98 / ul; uy *= 0.98 / ul; }
        const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
        lamF = L3[0] * ux + L3[1] * uy + L3[2] * uz;
        up = Math.max(0, -uy);
        fby = uy; fbz = uz;
      }
      const deep = deepAt(gx, gy);
      let ao = 0, contact = 0;
      {
        if (!layer) ao = aoAt(gx, gy);
        const z0 = zb[k]!;
        let m = 0;
        for (const [ox, oy] of CTS) {
          const sx = gx + ox, sy = gy + oy;
          if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
          const j = sy * w + sx;
          if (own[j] !== -1 && own[j] !== i && zb[j]! > z0 + 0.2) m++;
        }
        contact = m / CTS.length;
      }
      const py = y0 + gy + 0.5;
      let tt: number;
      if (layer) {
        // a streak: each of its lobes a flattened ball in the sun: lit warm along its top, cool on its underside
        tt = 0.02 + 0.5 * Math.pow((1 - lamL) / 2, 1.2) + 0.16 * Math.max(0, ny) + 0.12 * deep + 0.1 * contact;
        if (p.kind === "wisp") tt = 0.17 + tt * 0.75;
      } else {
        const shF = (1 - lamF) / 2, shL = (1 - lamL) / 2;
        const [mx, my, mz] = massN(gx, gy);
        const shM = (1 - (L3[0] * mx + L3[1] * my + L3[2] * mz)) / 2;
        // the whole heap's form in the sun first, each billow's ball on it, the lobes only a ripple; the heap's
        // self-shade and its lower body cooler; the recesses behind nearer billows deepest
        // (where the whole form turns from the sun, its billows sink into its shade; where it faces the sun they keep
        // their own balls of light)
        const ms = clamp((shM - 0.2) / 0.36, 0, 1);
        // (a deck: its billows read along its tops; down in the layer they melt into one broad soft underside, rolled
        // only by a slow swell, never a row of hanging balls)
        const dsh = deck ? (p.under ? 0.85 : clamp((py + p.h * 0.8) / (p.h * 0.6), 0, 1)) : 0;
        let sh = deck
          ? (1 - dsh) * (0.5 * shF + 0.2 * shL + 0.3 * shM) + dsh * (0.12 * shF + 0.08 * shL + 0.8 * shM) + (vnoise((x0 + gx) / (p.h * 1.3), py / (p.h * 0.3), seed + 77) - 0.5) * 0.2 * dsh
          : 0.68 * shF + 0.32 * shL;
        sh += (1 - sh) * MASS_W * ms * ms * (3 - 2 * ms);
        // (round 1c) deep in the heap's own shade the billows' balls flatten toward one shade: the shadow side reads
        // as one big shape with soft lobes in it (the refs), never a field of lit bubbles
        if (!deck) {
          const dS = deep * deep * (3 - 2 * deep);
          sh = sh * (1 - 0.5 * dS) + 0.6 * 0.5 * dS;
        }
        const low = clamp(1 + py / Math.max(8, p.h * 0.9), 0, 1);
        let tf = 0.02 + 0.62 * Math.pow(sh, 1.25) + (deck ? 0.17 : 0.34) * deep * deep * (3 - 2 * deep) + (p.kind === "tower" ? 0.2 * Math.pow(low, 1.4) : 0.12 * low * low) - 0.06 * up;
        // the terminator: a clear turn from light to shade on each billow (anime: the light reads as shapes)
        tf = tf < 0.3 ? tf * 0.8 : tf < 0.4 ? 0.24 + (tf - 0.3) * 2.2 : 0.46 + (tf - 0.4) * 1.0;
        // (a deck's underside: its billows melted together, so their recesses fade with depth into it)
        const aoK = 1 - 0.75 * dsh;
        const dS2 = deck ? 0 : deep * deep * (3 - 2 * deep);
        const aoE = ao * (1 - dS2) + aoSoftAt(gx, gy) * dS2 * 0.75;
        tt = tf + 0.36 * aoE * aoK * (0.45 + 0.55 * clamp(tf * 2, 0, 1)) + 0.07 * contact * aoK * (1 - 0.7 * dS2) * clamp(1.4 - tf * 1.8, 0, 1);
        // a deck lies in its own shade below its sunlit tops: darker down into the layer, its base the darkest
        // (round 1b) ... and its underside, seen from under it, takes the light thrown up from the lake and the haze:
        // the last stretch above the base lifts again, unevenly (folds stay dark), so the base is a soft lit
        // underside, never a flat dark band
        if (deck) {
          // (round 1c) the underside, what the camera sees overhead at the break-out (ref 01's ceiling): below its
          // sunlit heads the layer is one broad soft mass in its own cool shade, deepest a little above its base,
          // rolled by long soft folds (never a row of hanging balls, never one flat dark plate); its lowest stretch
          // and the bottoms of the masses hanging from it take the light thrown up from the lake and the haze
          const top = colTop[gx]!, base = baseCol[gx]!;
          const v = clamp((py - top) / Math.max(8, base - top), 0, 1.3);
          // (a far deck seen only from under it: all underside, its top lost in its own haze)
          const wU = p.under ? 1 : clamp((v - 0.06) / 0.22, 0, 1);
          const wUs = wU * wU * (3 - 2 * wU);
          const fx = x0 + gx;
          // (soft masses at the layer's own scale, warped so no fold runs ruled along the layer)
          const warp = vnoise(fx / (p.h * 0.55), py / (p.h * 0.45), seed + 80) - 0.5;
          const blob = vnoise(fx / (p.h * 0.95) + warp * 1.1, py / (p.h * 0.3) + warp * 0.5, seed + 78);
          const blob2 = vnoise(fx / (p.h * 0.32) - warp * 0.8, py / (p.h * 0.13), seed + 79);
          const deepV = clamp((v - 0.2) / 0.45, 0, 1);
          const nearBase = clamp((v - 0.6) / 0.4, 0, 1.3);
          // (the lip: a few px up from the sky under it, lit from below, wider where a mass hangs low)
          const lipW = p.h * (0.05 + 0.05 * blob) + 2;
          const lip = clamp(1 - (below[k]! - 1) / lipW, 0, 1);
          // (each hanging billow lit from below on its lower half: the light off the lake, cool and soft)
          const lamB = Math.max(0, 0.85 * fby + 0.35 * fbz - 0.2);
          let tu = (p.under ? 0.47 : 0.51) + 0.15 * deepV * deepV * (3 - 2 * deepV) - 0.06 * nearBase - 0.22 * lamB * clamp(v * 1.6 - 0.3, 0, 1);
          tu += (blob - 0.5) * 0.09 + (blob2 - 0.5) * 0.04 + 0.22 * aoSoftAt(gx, gy) - 0.16 * lip * lip * (0.6 + 0.4 * nearBase);
          if (p.under) tu -= 0.05;
          tt = tt * (1 - wUs) + tu * wUs;
        }
      }
      // distance: far clouds compress toward the sky
      tt = tt * (1 - 0.5 * far);
      t[k] = clamp(tt, 0, 0.999);
      let kd = BODY;
      {
        // the outline: crisp and rimmed warm where it faces the sun, lost toward the sky where it turns away
        const facing = -(nx * L3[0] + ny * L3[1]);
        if (dist[k]! <= 1.01) kd = facing < -0.05 || tt > 0.42 ? EDGE : tt < 0.3 ? RIM : BODY;
        // (an under deck's upper outline: lost toward the sky two px deep, never a lit lumpy rim)
        if (deck && p.under && dist[k]! <= 2.01 && ny < 0.2) kd = dist[k]! <= 1.01 ? EDGE : EDGE2;
        else if (dist[k]! <= 2.01 && far > 0.45 && facing < 0.2) kd = EDGE2;
        // the light thrown up into the lowest shade (from the deck below)
        // (only on the cloud's own underside, a few px in from its lower outline: never a sprinkle through the body)
        if (kd === BODY && !layer && tt > 0.5 && ny > 0.35 && py > -p.h * (deck ? 0.2 : 0.35) && lamL < 0 && dist[k]! <= 5 && own[k + w * 3] === -1) kd = BOUNCED;
        // a far cloud's foot lost in the haze: its palest step, thinning toward the base in small torn clusters (never
        // a checker against the sky)
        if (far > 0.3 && !layer && !deck) {
          const fh = p.h * (0.12 + 0.25 * far);
          const fz = (py + fh) / fh + (vnoise((x0 + gx) / 23, py / 9, seed + 61) - 0.5) * 0.35;
          if (fz > 0.4) {
            const thin = clamp((fz - 0.4) / 0.55, 0, 1);
            kd = vnoise((x0 + gx) / 7, py / 2.6, seed + 62) * 0.7 + vnoise((x0 + gx) / 2.5, py / 1.7, seed + 63) * 0.3 < thin ? SKY : FOOT;
          }
        }
        if (layer && U[k]! > 0.85) kd = EDGE;
        // (a wisp's edges are soft all round: two px of the sky's own pale blue)
        if (p.kind === "wisp" && dist[k]! <= 2.01) kd = dist[k]! <= 1.01 ? EDGE : EDGE2;
      }
      void sky;
      kind[k] = kd;
    }
    // the dither seam where two steps meet: about a px and a half wide whatever the tone's slope
    const seam = new Float32Array(w * h);
    for (let gy = 1; gy < h - 1; gy++) for (let gx = 1; gx < w - 1; gx++) {
      const k = gy * w + gx;
      if (!kind[k]) continue;
      const g = Math.max(Math.abs(t[k + 1]! - t[k - 1]!), Math.abs(t[k + w]! - t[k - w]!)) * 0.5;
      seam[k] = clamp(g * 1.5, 0.003, 0.025);
    }
    return { x0, y0, w, h, t, kind, seam };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Painting

/**
 * The near ramp's body steps, light to dark (fallcu indices: the peach 1 is the lit rim's alone, never a body step: as
 * a step it drew a peach contour round every lit patch), and where each begins on the tone scale.
 */
const NEAR_IDX = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const NEAR_AT = [0, 0.1, 0.22, 0.32, 0.42, 0.5, 0.58, 0.66, 0.75, 0.86];
/**
 * A high wisp's steps (round 1c): the sky's own pale blues (fallsky 0-3), never the cumulus' cream: thin cirrus is
 * the deep sky lit through, its core the palest, its edges going back into the blue (on the deep sky an opaque white
 * streak read as a scratch).
 */
const WISP_IDX = [0, 1, 2, 3];
const WISP_AT = [0, 0.2, 0.3, 0.42];
/** The far ramp's steps (fallfar 0-4). */
const FAR_AT = [0, 0.14, 0.26, 0.36, 0.44];

function stepOf(at: readonly number[], t: number, seam: number, dith: number): number {
  let i = 0;
  while (i + 1 < at.length && t >= at[i + 1]!) i++;
  const near = ((at[i + 1] ?? 2) - t) / seam;
  if (near < 1 && dith > near) i = Math.min(at.length - 1, i + 1);
  return i;
}

function paintFallCloud(c: PaintCtx, p: FallCloudP): void {
  const b = c.buf, kc = Math.max(1, Math.round(c.d));
  const f = (p.frame ?? 0) & 3;
  const M = cloudMask(p, c.seed, f);
  const far = farOf(p);
  const useFar = far >= 0.5;
  const wisp = p.kind === "wisp";
  const R0 = wisp ? P.fallsky : useFar ? P.fallfar : P.fallcu;
  const R = wisp ? WISP_IDX.map((i) => R0[i]!) : useFar ? R0 : NEAR_IDX.map((i) => R0[i]!);
  const AT = wisp ? WISP_AT : useFar ? FAR_AT : NEAR_AT;
  const X0 = Math.max(b.ox, Math.floor(c.X(M.x0))), X1 = Math.min(b.x1, Math.ceil(c.X(M.x0 + M.w)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(M.y0))), Y1 = Math.min(b.y1, Math.ceil(c.Y(M.y0 + M.h)));
  for (let y = Y0; y < Y1; y++) {
    const gy = Math.floor(c.ly(y + 0.5) - M.y0);
    if (gy < 0 || gy >= M.h) continue;
    for (let x = X0; x < X1; x++) {
      const gx = Math.floor(c.lx(x + 0.5) - M.x0);
      if (gx < 0 || gx >= M.w) continue;
      const k = gy * M.w + gx;
      const kd = M.kind[k]!;
      if (!kd) continue;
      const dith = bayer4(Math.floor((x + f * kc) / kc), Math.floor(y / kc));
      const t = M.t[k]!;
      // the lost edge: the cloud's own tone, broken in small clusters (soft toward the sky, never a pale ring)
      if (kd === EDGE || kd === EDGE2) {
        const n = vnoise((M.x0 + gx) / 1.7, (M.y0 + gy) / 1.7, c.seed + 97);
        if (n < (kd === EDGE ? 0.52 : 0.22)) continue;
        b.set(x, y, R[stepOf(AT, t, M.seam[k]!, dith)]!);
        continue;
      }
      if (kd === FOOT) {
        // the foot in the haze: the far ramp's palest (the mask has already torn it toward the sky)
        b.set(x, y, P.fallfar[t > 0.3 ? 1 : 0]!);
        continue;
      }
      if (kd === RIM) { b.set(x, y, useFar || wisp ? R[0]! : P.fallcu[1]!); continue; }
      if (kd === BOUNCED && !useFar) {
        b.set(x, y, t > 0.7 ? P.fallcu[12]! : P.fallcu[11]!);
        continue;
      }
      b.set(x, y, R[stepOf(AT, t, M.seam[k]!, dith)]!);
    }
  }
}

/** How far a cloud may reach either side of its anchor, level-1 px (measured on the fall's clouds, with a margin). */
const reachOf = (p: FallCloudP): number =>
  p.kind === "tower" ? p.w * 0.62 + p.h * Math.abs(p.lean ?? 0.1) * 0.3 + 24 : p.kind === "deck" ? p.w * 0.56 + 24 : isLayer(p) ? p.w * 0.56 + 16 : p.w * 0.62 + 24;

export const fallCloud = definePainter<FallCloudP>("op.fallcloud", {
  bounds(p) {
    const hx = reachOf(p);
    if (p.kind === "deck") return [-hx, -p.h * 1.8 - 12, hx, p.h * 0.4 + 12];
    if (isLayer(p)) return [-hx, -p.h * 1.3 - Math.abs(p.tilt ?? 0.035) * p.w - 8, hx, p.h * 0.3 + Math.abs(p.tilt ?? 0.035) * p.w + 8];
    if (p.kind === "tower") return [-hx, -p.h * 1.25 - p.w * 0.05 - 12, hx, 12 + fringeOf(p)];
    return [-hx, -p.h * 1.25 - 12, hx, 12 + fringeOf(p)];
  },
  paint(c, p) {
    paintFallCloud(c, p);
  },
});
