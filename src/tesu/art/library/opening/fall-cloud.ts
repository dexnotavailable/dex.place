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
  frame?: number;
}

/** The sun (upper left, a little toward the viewer): the same as op.cloud's. */
const SUN = [-0.55, -0.68, 0.48] as const;

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

// ---------------------------------------------------------------------------------------------------------------
// The forms

/** A great tower: it widens and leans as it climbs, its shoulders stepping out, the crown spreading. */
function towerForms(p: FallCloudP, r: () => number): Form[] {
  const W = p.w, HH = p.h, lean = p.lean ?? -0.1;
  const out: Form[] = [];
  // the column's half width at a height share u (0 the crown .. 1 the foot): widest under the crown, narrowing down
  // the column, flaring again where its foot spreads into the deck; its middle leans
  const hwAt = (u: number): number => (W / 2) * (0.82 - 0.4 * Math.pow(u, 0.9) + 0.55 * Math.max(0, u - 0.8) / 0.2);
  const cxAt = (u: number): number => -lean * HH * (u - 0.5);
  // billows of very different sizes scattered up the column (staggered, never stacked in rows), the lower nearer;
  // the sun's side (west) stepping out in shoulders
  const n = Math.round(HH / (W * 0.09));
  for (let k = 0; k < n; k++) {
    const u = (k + r()) / n;
    const hw = hwAt(u);
    const g = r();
    const R = hw * (g < 0.25 ? 0.62 + 0.15 * r() : g < 0.7 ? 0.42 + 0.12 * r() : 0.26 + 0.1 * r());
    const side = r() < 0.58 ? -1 : 1;
    const x = cxAt(u) + side * (hw - R) * Math.pow(r(), 0.7);
    const y = -HH + HH * u * 0.94 + R * 0.6;
    out.push({ x, y, r: R, z: 1 + u * 2 + r() * 0.4 });
  }
  // the crown: a dominant head toward the sun rising clear of the column, and smaller ones spreading off it
  const hw0 = hwAt(0.05);
  const R0 = hw0 * (0.7 + 0.1 * r());
  out.push({ x: cxAt(0) - hw0 * (0.15 + 0.15 * r()), y: -HH + R0 * 0.55, r: R0, z: 0.6 });
  for (let j = 0, nc = 2 + Math.floor(r() * 2); j < nc; j++) {
    const side = j % 2 ? -1 : 1;
    const R = R0 * (0.36 + 0.2 * r());
    out.push({ x: cxAt(0) + side * hw0 * (0.55 + 0.3 * r()), y: -HH + R0 * (0.7 + 0.5 * r()), r: R, z: 0.7 + j * 0.15 });
  }
  return out;
}

/** A heap: a few heads of very different sizes (the tallest toward the sun), each of billows stepping down from its crown. */
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
  for (const H of heads) {
    // the crown, and a second beside it on a broad head
    const r0 = Math.min(H.w * 0.34, H.h * (0.3 + 0.12 * (1 - tower)));
    const c0 = H.cx + H.w * (-0.12 + 0.18 * r());
    const crowns: Form[] = [{ x: c0, y: -H.h + r0, r: r0, z: H.z }];
    if (H.w > H.h * 1.4 && r() < 0.8) {
      const r1 = r0 * (0.55 + 0.25 * r()), side = r() < 0.6 ? 1 : -1;
      crowns.push({ x: c0 + side * r0 * (0.95 + 0.35 * r()), y: -H.h + r0 * (1.4 + 0.4 * r()), r: r1, z: H.z + 0.1 });
    }
    out.push(...crowns);
    // billows stepping down each side to the base, each a little nearer than the one above it
    for (const c of crowns) {
      for (const side of [-1, 1]) {
        let x = c.x, y = c.y, rr = c.r;
        for (let k = 0; k < 8; k++) {
          const nr = rr * (0.7 + 0.32 * r());
          x += side * rr * (0.45 + 0.35 * r()) * (1.25 - 0.7 * tower);
          y += rr * (0.45 + 0.35 * r()) * (0.6 + 0.5 * tower);
          if (y > -nr * 0.25 || Math.abs(x - H.cx) > H.w / 2 - nr * 0.4) break;
          out.push({ x, y, r: nr, z: c.z + 0.15 * (k + 1) });
          rr = nr;
        }
      }
    }
    // the body under them down to the base: broad low billows in front
    for (let x = H.cx - H.w * 0.42; x < H.cx + H.w * 0.42;) {
      const rr = Math.min(H.h * (0.22 + 0.1 * r()), H.w * 0.2);
      out.push({ x, y: -rr * (0.75 + 0.2 * r()), r: rr, z: H.z + 1.5 + r() * 0.3 });
      x += rr * (1.1 + 0.6 * r());
    }
  }
  return out;
}

/** Is x (cloud px) in one of a deck's gaps at height y? The gap's walls wander (torn, never a ruled shaft). */
function inGap(p: FallCloudP, x: number, y: number, seed: number): boolean {
  for (const [gx, gw] of p.gaps ?? []) {
    const hw = (gw * p.w) / 2 * (0.75 + 0.5 * vnoise1(y / 23 + gx * 50, seed + 71) + 0.25 * (vnoise1(y / 7, seed + 72) - 0.5));
    if (Math.abs(x - gx * p.w) < hw) return true;
  }
  return false;
}

/**
 * A deck: a long layer of flattened billows, thinner toward its torn ends; its top an uneven skyline (stretches of low
 * rolls, then a cluster of heads of very different sizes rising out of it, never a row of equal domes); masses
 * hanging from its base here and there.
 */
function deckForms(p: FallCloudP, r: () => number, seed: number): Form[] {
  const W = p.w, HH = p.h;
  const out: Form[] = [];
  const thick = (x: number): number => HH * (1 - 0.65 * Math.pow(Math.min(1, Math.abs(x) / (W / 2)), 2.5)) * (0.75 + 0.5 * vnoise1(x / (HH * 3), seed + 73));
  // the body: long flat billows along its middle, overlapping end to end
  for (let x = -W / 2 + HH * 0.4; x < W / 2 - HH * 0.4;) {
    const th = thick(x);
    const R = th * (0.75 + 0.5 * r());
    const q = 0.38 + 0.14 * r();
    if (!inGap(p, x, -th * 0.4, seed)) out.push({ x, y: -th * 0.42, r: R, z: 1.5 + r() * 0.3, q });
    x += R * (0.7 + 0.5 * r());
  }
  // the tops: where the layer heaps up (a slow noise along it), heads of very different sizes; elsewhere only low rolls
  for (let x = -W / 2 + HH * 0.6; x < W / 2 - HH * 0.6;) {
    const th = thick(x);
    const heap = Math.pow(vnoise1(x / (HH * 2.2), seed + 74), 1.6);
    const g = r();
    const R = th * (g < 0.25 ? 0.2 + 0.1 * r() : 0.12 + 0.08 * r()) * (1 + 2.2 * heap);
    const q = 0.75 + 0.2 * r();
    const y = -th * (0.66 + 0.1 * r()) - R * q * (0.15 + 0.5 * heap);
    if (!inGap(p, x, y, seed)) out.push({ x, y, r: R, z: 1 + r() * 0.4, q });
    x += R * (0.8 + 1.1 * r()) + th * 0.08 * r();
  }
  // masses hanging from its base here and there, flattened
  for (let x = -W / 2 + HH * 0.6; x < W / 2 - HH * 0.6;) {
    const R = HH * (0.12 + 0.2 * r());
    if (r() < 0.5 && !inGap(p, x, 0, seed)) out.push({ x, y: R * (0.05 + 0.2 * r()), r: R, z: 2.2 + r() * 0.3, q: 0.45 + 0.15 * r() });
    x += R * (1.2 + 2 * r());
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
        if (deck && inGap(p, x, y, seed)) continue;
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
      if (deck && inGap(p, ex, ey, seed)) continue;
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
  // torn off the shaded end: a scrap or two drifting free downwind (west on the east wind: no, the heap's own
  // downwind is its shaded lower east), smaller as they go
  for (let j = 0, nF = Math.floor(r() * 2.4); j < nF; j++) {
    const side = r() < 0.7 ? 1 : -1;
    let x = side * p.w * (0.42 + 0.08 * r()), y = -p.h * (0.05 + 0.18 * r());
    let rad = Math.max(minR * 1.5, p.h * (0.025 + 0.02 * r()));
    for (let k = 0; k < 3 && rad >= minR; k++) {
      L.push({ x, y, rx: rad * 1.5, ry: rad * 0.6, z: 5, form: -1, s: Math.floor(r() * 997), sub: 0 });
      x += side * rad * (2 + 1.2 * r());
      y += (r() - 0.4) * rad;
      rad *= 0.6 + 0.2 * r();
    }
  }
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
    const cy = -HH * (0.2 + 0.65 * r());
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
  return cached(`fc1|${seed}|${p.kind}|${p.w}|${p.h}|${p.tower ?? ""}|${p.far ?? ""}|${p.lean ?? ""}|${p.count ?? ""}|${JSON.stringify(p.gaps ?? [])}`, () =>
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

/** Pixel kinds of the mask: 0 sky, 1 body (tone t on the ramp), 2 lost edge, 3 lit rim, 4 bounce, 5 haze foot. */
const SKY = 0, BODY = 1, EDGE = 2, RIM = 3, BOUNCED = 4, FOOT = 5;

function cloudMask(p: FallCloudP, seed: number, f: number): CloudMask {
  return cached(`fm1|${seed}|${p.kind}|${p.w}|${p.h}|${p.tower ?? ""}|${p.far ?? ""}|${p.lean ?? ""}|${p.count ?? ""}|${p.tilt ?? ""}|${JSON.stringify(p.gaps ?? [])}|${f}`, () => {
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
    if (!layer) by1 = Math.min(by1, deck ? p.h * 0.24 : 4);
    const x0 = Math.floor(bx0) - 6, y0 = Math.floor(by0) - 6;
    const w = Math.ceil(bx1) - x0 + 7, h = Math.ceil(by1) - y0 + 7;
    const own = new Int32Array(w * h).fill(-1);
    const zb = new Float32Array(w * h).fill(-1e9);
    const NX = new Float32Array(w * h), NY = new Float32Array(w * h), U = new Float32Array(w * h);
    // the base: flat-ish at the cloud's scale, torn: it wanders, sags in rounded scallops and notches up between them
    const S = Math.max(8, p.h * 0.05), SX = Math.max(S, p.w * 0.012);
    const baseAt = (x: number): number => {
      const sag = Math.pow(Math.max(0, vnoise1(x / (SX * 3.2), seed + 35) - 0.45), 2) * S * 6;
      const notch = Math.pow(Math.max(0, vnoise1(x / (SX * 1.6), seed + 36) - 0.55), 2) * S * 8;
      return sag - notch - 1.2 * vnoise1(x / 6, seed + 34) + (vnoise1(x / (S * 9), seed + 33) - 0.5) * S * 0.5;
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
      let lamF = lamL, up = 0;
      const fo = b && b.form >= 0 ? F[b.form] : undefined;
      if (fo) {
        let ux = (x0 + gx + 0.5 - fo.x) / fo.r, uy = (y0 + gy + 0.5 - fo.y) / (fo.r * (fo.q ?? 1));
        const ul = Math.hypot(ux, uy);
        if (ul > 0.98) { ux *= 0.98 / ul; uy *= 0.98 / ul; }
        const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
        lamF = L3[0] * ux + L3[1] * uy + L3[2] * uz;
        up = Math.max(0, -uy);
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
        if (p.kind === "wisp") tt = 0.1 + tt * 0.6;
      } else {
        const shF = (1 - lamF) / 2, shL = (1 - lamL) / 2;
        // the billow's own ball in the sun first, the lobes' only a ripple on it; the heap's self-shade and its lower
        // body cooler; the recesses behind nearer billows deepest
        const low = clamp(1 + py / Math.max(8, p.h * 0.9), 0, 1);
        let tf = 0.03 + 0.66 * Math.pow(shF, 1.25) + 0.05 * (shL - 0.3) + 0.26 * deep + (p.kind === "tower" ? 0.2 * Math.pow(low, 1.4) : 0.12 * low * low) - 0.06 * up;
        // the terminator: a clear turn from light to shade on each billow (anime: the light reads as shapes)
        tf = tf < 0.3 ? tf * 0.8 : tf < 0.4 ? 0.24 + (tf - 0.3) * 2.2 : 0.46 + (tf - 0.4) * 1.0;
        tt = tf + 0.36 * ao * (0.45 + 0.55 * clamp(tf * 2, 0, 1)) + 0.07 * contact * clamp(1.4 - tf * 1.8, 0, 1);
        // a deck lies in its own shade below its sunlit tops: darker down into the layer, its base the darkest
        if (deck) tt += 0.34 * clamp((py + p.h * 0.55) / (p.h * 0.7), 0, 1);
      }
      // distance: far clouds compress toward the sky
      tt = tt * (1 - 0.5 * far);
      t[k] = clamp(tt, 0, 0.999);
      let kd = BODY;
      {
        // the outline: crisp and rimmed warm where it faces the sun, lost toward the sky where it turns away
        const facing = -(nx * L3[0] + ny * L3[1]);
        if (dist[k]! <= 1.01) kd = (facing < -0.05 || tt > 0.42) && !(deck && ny > -0.1) ? EDGE : tt < 0.3 ? RIM : BODY;
        else if (dist[k]! <= 2.01 && far > 0.45 && facing < 0.2) kd = EDGE;
        // the light thrown up into the lowest shade (from the deck below)
        // (only on the cloud's own underside, a few px in from its lower outline: never a sprinkle through the body)
        if (kd === BODY && !layer && tt > 0.5 && ny > 0.35 && py > -p.h * (deck ? 0.2 : 0.35) && lamL < 0 && dist[k]! <= 5 && own[k + w * 3] === -1) kd = BOUNCED;
        // a far cloud's foot lost in the haze
        if (far > 0.3 && !layer && !deck) {
          const fh = p.h * (0.12 + 0.25 * far);
          const fz = (py + fh) / fh + (vnoise1((x0 + gx) / 11, seed + 61) - 0.5) * 0.5;
          if (fz > 0.92) kd = SKY;
          else if (fz > 0.4) kd = FOOT;
        }
        if (layer && U[k]! > 0.85) kd = EDGE;
        // (a wisp's edges are soft all round: two px of the sky's own pale blue)
        if (p.kind === "wisp" && dist[k]! <= 2.01) kd = EDGE;
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

/** The near ramp's steps (fallcu 0-10), light to dark, and where each begins on the tone scale. */
const NEAR_AT = [0, 0.115, 0.135, 0.24, 0.33, 0.42, 0.5, 0.58, 0.66, 0.75, 0.86];
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
  const sky = clamp(p.sky ?? 0.5, 0, 1);
  const useFar = far >= 0.5;
  const R = useFar ? P.fallfar : P.fallcu;
  const AT = useFar ? FAR_AT : NEAR_AT;
  // the lost edge takes a step of the sky's own blue (pale low, deep high)
  const edgeSky = P.fallsky[clamp(Math.round(sky * (useFar ? 2.5 : 4.2)), 0, 5)]!;
  const footSky = P.fallsky[clamp(Math.round(sky * 2), 0, 5)]!;
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
      if (kd === EDGE) { b.set(x, y, edgeSky); continue; }
      if (kd === FOOT) {
        // the foot in the haze: the far ramp's lightest, then the sky's own pale blue, a cell of dither between
        b.set(x, y, dith < 0.5 ? P.fallfar[0]! : footSky);
        continue;
      }
      if (kd === RIM) { b.set(x, y, useFar ? R[0]! : P.fallcu[1]!); continue; }
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
    if (p.kind === "deck") return [-hx, -p.h * 1.8 - 12, hx, p.h * 0.3 + 12];
    if (isLayer(p)) return [-hx, -p.h * 1.3 - Math.abs(p.tilt ?? 0.035) * p.w - 8, hx, p.h * 0.3 + Math.abs(p.tilt ?? 0.035) * p.w + 8];
    if (p.kind === "tower") return [-hx, -p.h * 1.25 - p.w * 0.05 - 12, hx, 12];
    return [-hx, -p.h * 1.25 - 12, hx, 12];
  },
  paint(c, p) {
    paintFallCloud(c, p);
  },
});
