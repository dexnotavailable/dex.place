// Ringwater's near-ground painters (region lane a, round 1): the rock the cliff
// stair is cut into, the stair's own cut stone, the yard's soil, and the plants
// that root in all of them. Pixel data for a scene Pix layer (shade + ramp row
// per texel, lit and fogged by the arrival backdrop's shader), so the ground
// shares the lake's light and palette instead of being pasted in front of it.
//
// Rock is bedded, not cobbled: horizontal beds of uneven thickness that dip a
// little, split into blocks by joints; each bed has a lit lip where it steps
// out, a shadow line under the bed above, recessed beds sitting back in shade,
// a few cracks, and the whole mass falls into one dark value with depth. The
// sun is up and to the right of every Ringwater room (the backdrop's sun), so
// faces turned right catch it and faces turned left fall away.
//
// Plants are drawn blade by blade and leaf cluster by leaf cluster from a root
// point that is always on a surface the caller hands in, so nothing floats.

import type { Pix } from "../../engine/pix.ts";
import { fbm, fbm1, hashInt } from "../../engine/noise.ts";

/** Pseudo-random 0..1 for (a, b) with a seed (stable per build). */
const H = (a: number, b: number, s: number): number => hashInt(Math.floor(a), Math.floor(b), s);

export interface StrataOpts {
  /** Surface row at column x (1e9: nothing here). */
  top: (x: number) => number;
  bottom?: (x: number) => number;
  x0?: number;
  x1?: number;
  row: number;
  seed: number;
  /** Bed thickness range (px). */
  bed?: [number, number];
  /** Joint spacing range along a bed (px). */
  joint?: [number, number];
  /** Bedding dip: rows per column (positive: beds descend to the right). */
  dip?: number;
  /** Mid shade of a block face. */
  base?: number;
  /** How far the mass darkens below its surface, and over how many px. */
  dark?: number;
  deep?: number;
  /** Extra shade by position (big planes: a lit flank, a shadowed underside). */
  plane?: (x: number, y: number) => number;
  /** Row of moss in joints and on bed lips near the surface. */
  moss?: number;
  /** Per-texel extra fog. */
  fog?: (x: number, y: number) => number;
  /** Skip a texel (cut out for something else). */
  skip?: (x: number, y: number) => boolean;
}

/** Bed boundaries: start rows of beds over a wide range, cached per (seed, range). */
function beds(seed: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  let y = -2000;
  let i = 0;
  while (y < 4000) {
    out.push(y);
    y += Math.round(lo + H(i, 1, seed) * (hi - lo));
    i++;
  }
  return out;
}

/** Bedded, jointed rock filling under `top` (see the header). */
export function paintStrata(pix: Pix, o: StrataOpts): [number, number][] {
  /** Points on the lips of beds that step out of the face (where plants can root), one every few px. */
  const lips: [number, number][] = [];
  const x0 = Math.max(0, Math.floor(o.x0 ?? 0));
  const x1 = Math.min(pix.w, Math.ceil(o.x1 ?? pix.w));
  const [blo, bhi] = o.bed ?? [18, 46];
  const [jlo, jhi] = o.joint ?? [60, 170];
  const dip = o.dip ?? 0.06;
  const base = o.base ?? 0.46;
  const dark = o.dark ?? 0.26;
  const deep = o.deep ?? 160;
  const starts = beds(o.seed, blo, bhi);
  const bedAt = (yb: number): number => {
    let a = 0, b = starts.length - 1;
    while (a < b) {
      const m = (a + b + 1) >> 1;
      if (starts[m]! <= yb) a = m;
      else b = m - 1;
    }
    return a;
  };
  // the sun, up and to the right: a block face's light from its own plane
  const LX = 0.55, LY = 0.83;
  for (let x = x0; x < x1; x++) {
    const top = Math.round(o.top(x));
    if (top >= 1e8) continue;
    const bot = Math.min(pix.h, Math.round(o.bottom ? o.bottom(x) : pix.h));
    for (let y = Math.max(0, top); y < bot; y++) {
      if (o.skip?.(x, y)) continue;
      // beds pinch and swell: a 2D warp of the bedding planes
      const yb = y + x * dip + (fbm(x / 70, y / 55, o.seed + 3, 3) - 0.5) * 26;
      const i = bedAt(yb);
      const b0 = starts[i]!, bh = starts[i + 1]! - b0;
      const t = yb - b0;
      const rec = H(i, 2, o.seed) < 0.34;
      // joints: sparse and slanted, so beds break into long irregular blocks
      const sp = jlo + H(i, 3, o.seed) * (jhi - jlo);
      const jx = x + H(i, 4, o.seed) * sp + t * (H(i, 5, o.seed) - 0.5) * 1.4;
      const bi = Math.floor(jx / sp);
      const e = jx - bi * sp;
      // each block is a plane turned its own way: lit when it faces up and right
      const nx = H(bi, i, o.seed + 8) * 2 - 1;
      const ny = 0.25 + H(bi, i, o.seed + 9) * 0.65;
      const lit = (nx * LX + ny * LY) / Math.hypot(nx, ny, 0.6);
      let s = base + (lit - 0.62) * 0.48 + (H(bi, i, o.seed + 7) - 0.5) * 0.07 + (rec ? -0.1 : 0);
      // big masses carry their own tone, so the cliff reads in a few large shapes first
      s += (fbm(x / 170, y / 130, o.seed + 17, 2) - 0.5) * 0.22;
      // fine laminae inside a bed, broken
      if ((Math.floor(t) + Math.floor(H(bi, i, o.seed + 15) * 7)) % 7 === 0 && H(x >> 2, Math.floor(t), o.seed + 16) < 0.55) s -= 0.05;
      // texture: 2 px clusters
      const c = H(x >> 1, y >> 1, o.seed + 9);
      if (c > 0.94) s += 0.06;
      else if (c < 0.05) s -= 0.07;
      // a bed that steps out has a lit lip; one that sits back is in the shadow of the bed above
      if (!rec && t < 1.5) {
        s += 0.18;
        if (t < 1 && y - top > 8 && x % 5 === 0 && H(x, i, o.seed + 19) < 0.5) lips.push([x, y]);
      }
      else if (!rec && t < 3) s += 0.07;
      if (rec && t < 6) s -= 0.14 * (1 - t / 6);
      if (bh - t < 1.2 && H(x >> 3, i, o.seed + 18) < 0.65) s -= 0.2;
      // joints: an open crack, the face beside it turned away from the sun or toward it
      let crack = false;
      if (e < 1.2) {
        s = base - 0.34;
        crack = true;
      } else if (e < 3.5) s -= 0.07;
      else if (sp - e < 2.5) s += 0.08;
      if (o.plane) s += o.plane(x, y);
      // depth: the mass calms into one dark value
      const d = y - top;
      const k = Math.min(1, d / deep);
      s = s + (base - dark - s) * k * 0.6 - dark * k * 0.4;
      const fog = o.fog ? o.fog(x, y) : 0;
      // moss on lips and in cracks near the surface, sparse
      if (o.moss !== undefined && d < 44 && (crack || (!rec && t < 1.5)) && H(x >> 1, y, o.seed + 13) < 0.2 * (1 - d / 44)) {
        pix.set(x, y, 0.3 + H(x, y, o.seed + 14) * 0.25, o.moss, fog);
        continue;
      }
      pix.set(x, y, s, o.row, fog);
    }
  }
  return lips;
}

/**
 * Cut stone steps laid on the rock: each step is a block whose top is the tread;
 * under the treads a band of coursed ashlar follows the stair down to the rock.
 * steps: [x0, x1, y] tread spans in pix px, ascending to the right.
 */
export function paintStair(pix: Pix, steps: [number, number, number][], o: { row: number; seed: number; band: number; moss?: number; fog?: (x: number, y: number) => number }): void {
  if (!steps.length) return;
  const at = (x: number): number => {
    for (const [a, b, y] of steps) if (x >= a && x < b) return y;
    return 1e9;
  };
  const rise = Math.max(4, Math.round(Math.abs(steps[0]![2] - (steps[1]?.[2] ?? steps[0]![2] - 16))));
  const x0 = Math.floor(steps[0]![0]), x1 = Math.ceil(steps[steps.length - 1]![1]);
  for (let x = x0; x < x1; x++) {
    const top = at(x);
    if (top >= 1e8) continue;
    // the step this column belongs to
    let k = 0;
    while (k < steps.length && !(x >= steps[k]![0] && x < steps[k]![1])) k++;
    const [sa, sb] = steps[k]!;
    const lx = x - sa, w = sb - sa;
    for (let y = top; y < top + o.band; y++) {
      const fog = o.fog ? o.fog(x, y) : 0;
      // courses aligned to the treads; blocks span about two treads, staggered per course
      const d = y - top;
      const course = Math.floor(d / rise);
      const cy = d - course * rise;
      const gk = k - course; // the step whose tread starts this course's line
      const len = w * (1.6 + H(gk, course, o.seed) * 0.8);
      const off = H(course, 7, o.seed) * len + gk * w;
      const bx = (x - x0 + off) % len;
      const blk = Math.floor((x - x0 + off) / len) * 31 + course;
      let s = 0.5 + (H(blk, 1, o.seed) - 0.5) * 0.12;
      if (course === 0) {
        // the step stone itself: lit tread, a bright nose, worn in the middle, its left end in shade
        if (cy === 0) s = lx < 2 ? 0.92 : 0.84 - (Math.abs(lx - w / 2) < w * 0.25 ? 0.06 : 0);
        else if (cy === 1) s = 0.62;
        else s = 0.48 - cy * 0.012;
        if (lx < 2 && cy > 0) s -= 0.16;
        if (cy === rise - 1) s = 0.16;
        // a chipped nose on some steps
        if (lx < 3 && cy < 3 && H(k, 3, o.seed) < 0.3 && lx + cy < 3) {
          pix.clear(x, y);
          continue;
        }
      } else {
        if (cy === 0) s += 0.08;
        if (cy === rise - 1) s = 0.18;
        if (bx < 1) s = 0.16;
        else if (bx < 2) s -= 0.05;
        else if (len - bx < 2) s += 0.07;
        // the band's lower courses darken into the rock under them
        s -= course * 0.05;
      }
      const c = H(x >> 1, y >> 1, o.seed + 4);
      if (c > 0.95) s += 0.05;
      else if (c < 0.04) s -= 0.06;
      pix.set(x, y, s, o.row, fog);
    }
    // moss in the back corner of a tread (where it meets the next riser)
    if (o.moss !== undefined && w - lx < 6 && H(k, 5, o.seed) < 0.4 && H(x, 6, o.seed) < 0.75) {
      pix.set(x, top - 1, 0.45, o.moss);
      if (H(x, 7, o.seed) < 0.5) pix.set(x, top - 2, 0.62, o.moss);
    }
  }
}

/** A clump of grass blades rooted at (x, base): lit tips toward the sun, dark roots. */
export function grassTuft(pix: Pix, x: number, base: number, o: { row: number; h: number; n?: number; spread?: number; seed: number; lean?: number; fog?: number }): void {
  const n = o.n ?? 7;
  const sp = o.spread ?? Math.max(2, Math.round(o.h * 0.5));
  for (let k = 0; k < n; k++) {
    const bx = x + Math.round((H(k, 1, o.seed) - 0.5) * sp * 2);
    const bh = Math.max(2, Math.round(o.h * (0.45 + H(k, 2, o.seed) * 0.55)));
    const lean = (o.lean ?? 0) + (H(k, 3, o.seed) - 0.5) * 0.9;
    for (let j = 0; j < bh; j++) {
      const t = j / bh;
      const xx = bx + Math.round(lean * t * t * bh * 0.6);
      const s = j === bh - 1 ? 0.86 : t > 0.6 ? 0.66 : t > 0.25 ? 0.5 : 0.32;
      pix.set(xx, base - 1 - j, s + (H(bx, j, o.seed + 4) - 0.5) * 0.06, o.row, o.fog ?? 0);
    }
  }
}

/** A fern rooted at (x, base): arched fronds with leaflets, drooping at the tips. */
export function fern(pix: Pix, x: number, base: number, o: { row: number; size: number; seed: number; fronds?: number; fog?: number }): void {
  const n = o.fronds ?? 5;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k / Math.max(1, n - 1) - 0.5) * 2.3 + (H(k, 1, o.seed) - 0.5) * 0.3;
    const len = o.size * (0.65 + H(k, 2, o.seed) * 0.4);
    const droop = 0.9 + H(k, 3, o.seed) * 0.6;
    let px = x, py = base - 1;
    let dx = Math.cos(a), dy = Math.sin(a);
    const steps = Math.round(len);
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      // the frond bends down along its length
      dy += (droop / steps) * 1.2;
      const l = Math.hypot(dx, dy);
      px += dx / l;
      py += dy / l;
      const s = t < 0.15 ? 0.3 : 0.48 + (dx > 0 ? 0.14 : 0) - t * 0.08;
      pix.set(Math.round(px), Math.round(py), s, o.row, o.fog ?? 0);
      // leaflets every other step, shorter toward the tip
      if (j % 2 === 1 && t > 0.12) {
        const ll = Math.max(1, Math.round((1 - t) * o.size * 0.16 + 1));
        const nx = -dy / l, ny = dx / l;
        for (let q = 1; q <= ll; q++) {
          const lit = ny < 0 ? 0.68 : 0.5;
          pix.set(Math.round(px + nx * q), Math.round(py + ny * q + q * 0.4), q === ll ? lit + 0.12 : lit, o.row, o.fog ?? 0);
          pix.set(Math.round(px - nx * q), Math.round(py - ny * q + q * 0.4), q === ll ? 0.5 : 0.38, o.row, o.fog ?? 0);
        }
      }
    }
  }
}

/**
 * A bush sitting on (cx, base): a lumpy mass of leaf clusters, lit from the upper right,
 * a dark core and underside, leaf points breaking its outline.
 */
export function bush(pix: Pix, cx: number, base: number, o: { row: number; w: number; h: number; seed: number; fog?: number; lightX?: number }): void {
  const rx = o.w / 2, ry = o.h;
  const lx = o.lightX ?? 0.6;
  for (let y = Math.floor(base - ry - 3); y < base; y++)
    for (let x = Math.floor(cx - rx - 3); x <= Math.ceil(cx + rx + 3); x++) {
      const nx = (x - cx) / rx, ny = (y - base) / ry; // ny -1 (top) .. 0 (base)
      const lump = (fbm1((x + o.seed * 13) / 6, o.seed, 3) - 0.5) * 0.5 + (H(x >> 2, y >> 2, o.seed) - 0.5) * 0.25;
      const q = nx * nx + (ny + 0.05) * (ny + 0.05) * 1.1;
      if (q > 1 + lump) continue;
      // leaf clusters: 3 px cells, each lit by its own little normal
      const cell = H((x + 64) / 3, (y + 64) / 3, o.seed + 1);
      const nl = nx * lx - (ny + 0.6) * 0.8;
      let s = 0.42 + nl * 0.22 + (cell - 0.5) * 0.16;
      if (q > 0.82 + lump) s += 0.08; // the rim catches the sky
      if (ny > -0.22) s -= 0.22 * ((ny + 0.22) / 0.22); // the underside in shade
      if (cell < 0.08) s -= 0.18; // gaps into the dark core
      pix.set(x, y, s, o.row, o.fog ?? 0);
    }
  // leaf points out of the silhouette
  for (let k = 0; k < Math.round(o.w * 0.6); k++) {
    const a = Math.PI + H(k, 2, o.seed) * Math.PI;
    const ex = Math.round(cx + Math.cos(a) * rx * 1.02);
    const ey = Math.round(base + Math.sin(a) * ry * 1.02);
    pix.set(ex, ey, Math.cos(a) * lx > 0 ? 0.7 : 0.48, o.row, o.fog ?? 0);
    if (H(k, 3, o.seed) < 0.5) pix.set(ex + (Math.cos(a) > 0 ? 1 : -1), ey - 1, 0.6, o.row, o.fog ?? 0);
  }
}

/** A strand hanging from (x, y) down `len` px: a wavering stem with leaves on alternate sides. */
export function vine(pix: Pix, x: number, y: number, o: { row: number; len: number; seed: number; fog?: number; solid?: (x: number, y: number) => boolean }): void {
  let px = x;
  for (let j = 0; j < o.len; j++) {
    px = x + Math.round(Math.sin(j * 0.21 + o.seed) * 1.5);
    const yy = y + j;
    // a hanging strand lies on the rock face: stop where the face ends (no hanging in the air)
    if (o.solid && !o.solid(px, yy)) break;
    pix.set(px, yy, 0.3 + (j % 5 === 0 ? 0.08 : 0), o.row, o.fog ?? 0);
    if (j % 3 === 1) {
      const side = (j / 3) % 2 < 1 ? 1 : -1;
      pix.set(px + side, yy, side > 0 ? 0.66 : 0.46, o.row, o.fog ?? 0);
      if (H(j, 1, o.seed) < 0.5) pix.set(px + side * 2, yy + 1, side > 0 ? 0.56 : 0.4, o.row, o.fog ?? 0);
    }
  }
}

/** A pine rooted at (x, base): a dark trunk, tiers of drooping needle masses, lit on the sun side. */
export function pine(pix: Pix, x: number, base: number, o: { row: number; bark: number; h: number; seed: number; fog?: number; w?: number }): void {
  const hgt = o.h;
  const wmax = o.w ?? hgt * 0.36;
  // trunk
  const tw = Math.max(2, Math.round(hgt * 0.035));
  for (let y = base - Math.round(hgt * 0.9); y < base; y++)
    for (let k = 0; k < tw; k++) pix.set(x - (tw >> 1) + k, y, k === tw - 1 ? 0.5 : 0.24, o.bark, o.fog ?? 0);
  // flared roots
  for (let k = 1; k <= 3; k++) {
    pix.set(x - (tw >> 1) - k, base - 1, 0.22, o.bark, o.fog ?? 0);
    pix.set(x + (tw - (tw >> 1)) + k - 1, base - 1, 0.36, o.bark, o.fog ?? 0);
  }
  // tiers from the top down: each a triangle that droops at its tips
  const tiers = Math.max(4, Math.round(hgt / 14));
  for (let i = 0; i < tiers; i++) {
    const t = (i + 1) / tiers;
    const ty = base - hgt + Math.round(i * (hgt * 0.78) / tiers);
    const th = Math.round(hgt * 0.22);
    const half = Math.max(2, wmax * t * 0.5 * (0.85 + H(i, 1, o.seed) * 0.3));
    for (let dy = 0; dy < th; dy++) {
      const f = dy / th;
      const w = half * Math.pow(f, 0.8);
      for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
        // ragged needle edge, drooping tips
        const edge = Math.abs(dx) / Math.max(1, w);
        if (edge > 1 - H(dx + 99, dy + i * 31, o.seed) * 0.25) continue;
        const droop = edge > 0.75 ? 1 : 0;
        const s = 0.32 + (dx > 0 ? 0.16 : -0.04) * edge + (dy < 2 ? 0.08 : 0) - f * 0.14 + (H((x + dx) >> 1, (ty + dy) >> 1, o.seed + 2) - 0.5) * 0.12;
        pix.set(x + dx, ty + dy + droop, s, o.row, o.fog ?? 0);
      }
    }
  }
}

/**
 * A windswept pine rooted at (x, base): a trunk that curves away from the wind (`lean` px at its
 * top: negative leans left), branches that reach out mostly downwind, and flat-topped pads of
 * needles, each with a lit top, a dark underside and ragged tufts hanging under it.
 */
export function windPine(pix: Pix, x: number, base: number, o: { row: number; bark: number; h: number; lean: number; seed: number; fog?: number }): void {
  const fog = o.fog ?? 0;
  const N = Math.round(o.h);
  const at = (t: number): [number, number] => [x + o.lean * (t * t * 0.75 + t * 0.25) + Math.sin(t * 5 + o.seed) * 2, base - t * o.h];
  // flared roots gripping the ledge
  for (let k = 1; k <= 5; k++) {
    pix.set(x - 2 - k, base - 1 + (k > 3 ? 1 : 0), 0.24, o.bark, fog);
    pix.set(x + 2 + k, base - 1 + (k > 2 ? 1 : 0), 0.4, o.bark, fog);
  }
  for (let j = 0; j <= N; j++) {
    const t = j / N;
    const [cx, cy] = at(t);
    const w = Math.max(1, Math.round(6 - t * 4.6));
    for (let k = 0; k < w; k++) pix.set(Math.round(cx) - (w >> 1) + k, Math.round(cy), k === w - 1 ? 0.58 : k === 0 ? 0.16 : 0.3 + (H(j >> 2, k, o.seed) - 0.5) * 0.1, o.bark, fog);
  }
  // pads: [height on the trunk, direction, branch reach, pad width, pad height] (in h)
  const pads: [number, number, number, number, number][] = [
    [0.48, -1, 0.3, 0.44, 0.1],
    [0.62, 1, 0.16, 0.3, 0.085],
    [0.77, -1, 0.24, 0.4, 0.1],
    [0.9, 1, 0.08, 0.28, 0.08],
    [1.0, -1, 0.05, 0.34, 0.11],
  ];
  for (const [k, [t, dir, reach, pwf, phf]] of pads.entries()) {
    const [tx, ty] = at(t);
    const ex = tx + dir * reach * o.h, ey = ty - reach * o.h * 0.25;
    // the branch: thin, a little crooked
    const L = Math.max(1, Math.round(Math.hypot(ex - tx, ey - ty)));
    for (let j = 0; j <= L; j++) {
      const f = j / L;
      const bx = Math.round(tx + (ex - tx) * f), by = Math.round(ty + (ey - ty) * f + Math.sin(f * 3 + k) * 2);
      pix.set(bx, by, 0.3, o.bark, fog);
      if (f < 0.5) pix.set(bx, by + 1, 0.18, o.bark, fog);
    }
    // the pad of needles
    const pw = pwf * o.h, ph = phf * o.h;
    const cx = ex + dir * pw * 0.12;
    for (let dx = -Math.ceil(pw / 2); dx <= Math.ceil(pw / 2); dx++) {
      const q = Math.abs(dx) / (pw / 2);
      if (q > 1) continue;
      const rag = (H(dx + 300, k, o.seed + 1) - 0.5) * 3;
      const topY = Math.round(ey - ph * Math.sqrt(1 - q * q) * 0.85 + rag);
      const botY = Math.round(ey + ph * 0.3 * (1 - q * q) + (H(dx + 500, k, o.seed + 2) < 0.2 ? 3 : 0));
      for (let y = topY; y <= botY; y++) {
        const d = y - topY;
        const tuft = H((Math.round(cx) + dx) >> 1, y >> 1, o.seed + 3);
        let s = d === 0 ? 0.82 : d === 1 ? 0.66 : 0.44 - (d / Math.max(1, botY - topY)) * 0.24;
        // the sun side of each pad, and needle clusters
        if (dx > pw * 0.15) s += 0.06;
        s += (tuft - 0.5) * 0.14;
        if (tuft < 0.07 && d > 1) continue; // gaps you see the sky through
        pix.set(Math.round(cx) + dx, y, s, o.row, fog);
      }
    }
  }
}

/**
 * An upright fir rooted at (x, base): a straight trunk, whorls of drooping branches every few px,
 * shorter toward a ragged leader, each branch carrying needle clumps lit on the sun side.
 */
export function fir(pix: Pix, x: number, base: number, o: { row: number; bark: number; h: number; seed: number; fog?: number; w?: number }): void {
  const fog = o.fog ?? 0;
  const hgt = o.h, wmax = (o.w ?? hgt * 0.42) / 2;
  const tw = Math.max(2, Math.round(hgt * 0.03));
  for (let y = base - Math.round(hgt * 0.97); y < base; y++)
    for (let k = 0; k < tw; k++) pix.set(x - (tw >> 1) + k, y, k === tw - 1 ? 0.5 : 0.22, o.bark, fog);
  for (let k = 1; k <= 3; k++) {
    pix.set(x - (tw >> 1) - k, base - 1, 0.2, o.bark, fog);
    pix.set(x + tw - (tw >> 1) + k - 1, base - 1, 0.36, o.bark, fog);
  }
  const gap = Math.max(4, Math.round(hgt / 22));
  let j = 0;
  for (let y = base - Math.round(hgt * 0.16); y > base - hgt; y -= gap + Math.round(H(j, 1, o.seed) * 2), j++) {
    const t = (base - y) / hgt; // 0 low .. 1 top
    const reach = wmax * Math.pow(1 - t, 0.85) * (0.75 + H(j, 2, o.seed) * 0.5) + 2;
    for (const dir of [-1, 1]) {
      const r = reach * (dir > 0 ? 1 : 0.9) * (0.8 + H(j, dir + 5, o.seed) * 0.4);
      for (let k = 0; k <= r; k++) {
        const f = k / Math.max(1, r);
        const bx = x + dir * k, by = Math.round(y + f * f * gap * 0.9);
        // needle clump: a few px tall under the branch line, lit on top and on the sun side
        const ch = Math.max(2, Math.round(gap * (1.3 - f * 0.6)));
        for (let d = -1; d < ch; d++) {
          if (H(bx >> 1, (by + d) >> 1, o.seed + 3) < 0.12) continue;
          let s = d <= 0 ? 0.74 : 0.46 - (d / ch) * 0.2;
          if (dir > 0) s += 0.08 * f;
          else s -= 0.06 * f;
          pix.set(bx, by + d, s + (H(bx, by + d, o.seed + 4) - 0.5) * 0.1, o.row, fog);
        }
        // tips droop
        if (f > 0.85) pix.set(bx, by + ch, 0.36, o.row, fog);
      }
    }
  }
  // the leader
  for (let k = 0; k < Math.round(hgt * 0.06); k++) pix.set(x, base - hgt - k + Math.round(hgt * 0.03), 0.6, o.row, fog);
}
