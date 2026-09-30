// Near ground for pixel layers: rock and earth that read as masses of chunky,
// lit facets under a grass cap, not as noise. Shared by scenes whose player
// plane is drawn in the backdrop (the cliff stair, the yard, the reed bank).
//
// Rock: a stretched Voronoi of facets, each tilted its own way and lit by one
// key light, with a bevel (a lit edge toward the light, a shaded edge away
// from it) and a dark crack where two facets meet. Values stay in whole
// clusters (no per-pixel noise), so the ramp steps read as painted planes.
// Cap: a grass band on the walkable top, thicker in places, with blades
// spilling above the line and hanging over drops; stones bedded in the soil
// under it; everything darkens into the mass.

import { hashInt, fbm1 } from "./noise.ts";
import type { Pix } from "./pix.ts";

export interface RockOpts {
  seed: number;
  /** Facet size in px (height; width is `flatten` times it). */
  cell: number;
  /** Facets are this much wider than tall (bedded, layered rock). Default 1.7. */
  flatten?: number;
  /** Screen direction TOWARD the key light (x right, y down), e.g. [-0.7, -1] = upper left. */
  light: [number, number];
  /** Mid shade 0..1 and how far facets swing from it. */
  base?: number;
  contrast?: number;
  /** Share of facet borders that are open cracks (the rest are only a change of plane). Default 0.4. */
  cracks?: number;
}

const jx = (i: number, j: number, s: number): number => 0.15 + 0.7 * hashInt(i, j, s);
const jy = (i: number, j: number, s: number): number => 0.15 + 0.7 * hashInt(i, j, s + 101);

/** Shade (0..1) of faceted rock at a pixel. */
export function rockAt(x: number, y: number, o: RockOpts): number {
  return rockInfo(x, y, o).shade;
}

/** Faceted rock at a pixel: its shade, a stable 0..1 hash of its facet (to pick materials per stone), and whether it is a crack. */
export function rockInfo(x: number, y: number, o: RockOpts): { shade: number; cell: number; crack: boolean } {
  const sy = o.cell;
  const sx = o.cell * (o.flatten ?? 1.7);
  const gx = x / sx, gy = y / sy;
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let d1 = 1e9, d2 = 1e9, bi = 0, bj = 0, bdx = 0, bdy = 0, ni = 0, nj = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const ci = ix + i, cj = iy + j;
      // alternate rows shift half a cell: courses, not a grid
      const off = cj & 1 ? 0.5 : 0;
      const dx = (gx - (ci + off + jx(ci, cj, o.seed))) * sx;
      const dy = (gy - (cj + jy(ci, cj, o.seed))) * sy;
      const d = dx * dx + dy * dy;
      if (d < d1) {
        d2 = d1;
        ni = bi;
        nj = bj;
        d1 = d;
        bi = ci;
        bj = cj;
        bdx = dx;
        bdy = dy;
      } else if (d < d2) {
        d2 = d;
        ni = ci;
        nj = cj;
      }
    }
  }
  const r1 = Math.sqrt(d1), r2 = Math.sqrt(d2);
  const edge = (r2 - r1) * 0.5;
  // the facet's plane: mostly facing up and out, each tilted its own way
  const nx = (hashInt(bi, bj, o.seed + 7) - 0.5) * 1.3;
  const ny = -0.25 - hashInt(bi, bj, o.seed + 11) * 0.55;
  const nl = Math.hypot(nx, ny, 1);
  const [lx0, ly0] = o.light;
  const ll = Math.hypot(lx0, ly0, 0.9);
  const lit = (nx * lx0 + ny * ly0 + 0.9) / (nl * ll);
  const base = o.base ?? 0.42;
  const contrast = o.contrast ?? 0.5;
  // big masses carry their own tone, so the rock reads in a few large shapes before its facets
  const mass = hashInt(Math.floor(x / (sx * 2.7)), Math.floor(y / (sy * 2.3)), o.seed + 17) - 0.5;
  let s = base + contrast * (lit - 0.62) + (hashInt(bi, bj, o.seed + 13) - 0.5) * 0.08 + mass * 0.14;
  // only some borders are open cracks; the rest are just a change of plane
  const pair = hashInt(Math.min(bi * 7919 + bj, ni * 7919 + nj), Math.max(bi * 7919 + bj, ni * 7919 + nj), o.seed + 29);
  const cell = hashInt(bi, bj, o.seed + 37);
  if (edge < 1.1 && pair < (o.cracks ?? 0.4)) return { shade: Math.max(0, base - 0.34 + mass * 0.1), cell, crack: true };
  if (edge < 3.2) {
    // bevel: the rim toward the light catches it, the rim away from it falls into shade
    const toward = (bdx * lx0 + bdy * ly0) / ((r1 + 1e-3) * Math.hypot(lx0, ly0));
    if (toward > 0.25) s += 0.16;
    else if (toward < -0.3) s -= 0.12;
  }
  return { shade: s, cell, crack: false };
}

export interface GroundOpts {
  /** Walkable top at column x (px; 1e9 = none). */
  top: (x: number) => number;
  bottom?: (x: number) => number;
  x0?: number;
  x1?: number;
  rock: RockOpts;
  /** Palette row of the rock and soil. */
  row: number;
  /** Grass cap: palette row, depth in px, blade height in px; `where` limits it to some columns. */
  cap?: { row: number; depth: number; blades: number; seed?: number; where?: (x: number) => boolean };
  /** Bedded stones in the soil under the cap (0..1 density). */
  stones?: number;
  /** How much the mass darkens with depth below its top, and over how many px. */
  dark?: number;
  darkDepth?: number;
  /** Lit lip (1 px) where there is no cap. */
  lip?: number;
  /** A lit band under the lip (sky light on a top edge): strength and depth in px. */
  rim?: number;
  rimDepth?: number;
  /** Shade gathering toward the mass's underside (a slab resting on another), over rimDepth * 2 px. */
  under?: number;
  fog?: (x: number, y: number) => number;
}

/** Paints a ground mass into `pix` (see the header). */
export function paintGround(pix: Pix, o: GroundOpts): void {
  const x0 = Math.max(0, Math.floor(o.x0 ?? 0));
  const x1 = Math.min(pix.w, Math.ceil(o.x1 ?? pix.w));
  const dark = o.dark ?? 0.3;
  const dd = o.darkDepth ?? 140;
  const cap = o.cap;
  const cs = cap?.seed ?? o.rock.seed + 31;
  const capDepth = (x: number): number => (cap ? Math.max(2, Math.round(cap.depth * (0.65 + 0.7 * fbm1(x / 9, cs, 2)))) : 0);
  for (let x = x0; x < x1; x++) {
    const top = Math.round(o.top(x));
    if (top >= 1e8) continue;
    const bot = Math.min(pix.h, Math.round(o.bottom ? o.bottom(x) : pix.h));
    const capped = !!cap && (!cap.where || cap.where(x));
    const cd = capped ? capDepth(x) : 0;
    // a drop right beside this column: the grass hangs over it
    const dropL = Math.round(o.top(x - 1)) - top, dropR = Math.round(o.top(x + 1)) - top;
    for (let y = Math.max(0, top); y < bot; y++) {
      const d = y - top;
      const fog = o.fog ? o.fog(x, y) : 0;
      if (cap && capped && d < cd) {
        // the grass band: lit tips, then the body, a shaded root line
        const sh = d === 0 ? 0.8 : d === 1 ? 0.66 : d < cd - 1 ? 0.5 - (d / cd) * 0.12 + (hashInt(x >> 1, d, cs) - 0.5) * 0.08 : 0.3;
        pix.set(x, y, sh, cap.row, fog);
        continue;
      }
      let s = rockAt(x, y, o.rock);
      if (capped && d === cd) s = Math.min(s, 0.12); // the cap's shadow on the soil
      else if (!capped && d === 0) s = Math.max(s, o.lip ?? 0.7);
      else if (!capped && o.rim && d < (o.rimDepth ?? 6)) s += o.rim * (1 - d / (o.rimDepth ?? 6));
      if (o.under) {
        const ud = bot - 1 - y, span = (o.rimDepth ?? 6) * 2;
        if (ud < span) s -= o.under * (1 - ud / span);
      }
      // deeper in, the mass calms and falls into shade (its facets fade toward one dark value)
      const k = Math.min(1, d / dd);
      s = s + ((o.rock.base ?? 0.42) - dark - s) * k * 0.55 - dark * k * 0.5;
      pix.set(x, y, s, o.row, fog);
    }
    if (cap && capped) {
      // blades above the line, in clumps
      const clump = fbm1(x / 6, cs + 3, 2);
      const hb = Math.round(cap.blades * Math.max(0, clump - 0.42) * 2.6 * (0.4 + hashInt(x, 5, cs)));
      for (let k = 1; k <= hb; k++) pix.set(x, top - k, k === hb ? 0.84 : 0.58 + (hashInt(x, k, cs + 1) - 0.5) * 0.12, cap.row, o.fog ? o.fog(x, top - k) : 0);
      // over a drop the grass hangs down the face a little
      const drop = Math.max(dropL, dropR);
      if (drop > 3) {
        const hang = Math.round(Math.min(drop, cd + 2 + hashInt(x, 9, cs) * 6));
        for (let k = cd; k < hang; k++) pix.set(x, top + k, 0.42 - (k / hang) * 0.2, cap.row, 0);
      }
    }
  }
  // stones bedded in the soil: small lit ovals with a dark lower rim
  const density = o.stones ?? 0;
  if (density > 0) {
    const step = 11;
    for (let gx = x0; gx < x1; gx += step) {
      if (hashInt(gx, 3, o.rock.seed + 41) > density) continue;
      const cx = gx + Math.floor(hashInt(gx, 4, o.rock.seed) * step);
      const top = o.top(cx);
      if (top >= 1e8) continue;
      const rx = 3 + Math.floor(hashInt(gx, 5, o.rock.seed) * 4);
      const ry = 2 + Math.floor(hashInt(gx, 6, o.rock.seed) * 2);
      const cy = Math.round(top + capDepth(cx) + 4 + hashInt(gx, 7, o.rock.seed) * 26);
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          const q = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          if (q > 1) continue;
          const rim = q > 0.62;
          const s = rim ? (x + y > 0 ? 0.08 : 0.5) : x + y < -1 ? 0.66 : 0.46;
          pix.set(cx + x, cy + y, s, o.row, o.fog ? o.fog(cx + x, cy + y) : 0);
        }
      }
    }
  }
}

/**
 * Cut stone steps over a mass: a lit tread (1 px), a shaded front, joints
 * between blocks at uneven spacing, chipped corners and the odd moss tuft on
 * a tread's back. `steps` are [x0, x1, y] in the pix's px.
 */
export function paintSteps(pix: Pix, steps: [number, number, number][], o: { row: number; riser: number; seed: number; moss?: number; light?: -1 | 1 }): void {
  const lightFromLeft = (o.light ?? -1) < 0;
  steps.forEach(([a, b, y], k) => {
    const x0 = Math.round(a), x1 = Math.round(b);
    const chip = hashInt(k, 1, o.seed) < 0.35;
    const mossy = o.moss !== undefined && hashInt(k, 2, o.seed) < 0.3;
    // joints: blocks 18..34 px long, offset per step
    let j = x0 + 6 + Math.floor(hashInt(k, 3, o.seed) * 14);
    const joints = new Set<number>();
    while (j < x1 - 4) {
      joints.add(j);
      j += 18 + Math.floor(hashInt(j, k, o.seed) * 16);
    }
    for (let x = x0; x < x1; x++) {
      const lead = lightFromLeft ? x === x0 : x === x1 - 1;
      const corner = chip && (lightFromLeft ? x - x0 < 3 : x1 - 1 - x < 3);
      // tread: lit edge, a softer line behind it
      if (!(corner && x !== (lightFromLeft ? x0 + 2 : x1 - 3))) pix.set(x, y, hashInt(x, y, o.seed) < 0.1 ? 0.62 : 0.86, o.row);
      pix.set(x, y + 1, 0.56, o.row);
      for (let d = 2; d < o.riser; d++) {
        let s = 0.4 - d * 0.018 + (hashInt(x >> 2, y + (d >> 2), o.seed) - 0.5) * 0.05;
        if (joints.has(x)) s = 0.16;
        else if (joints.has(x - 1)) s += 0.1;
        if (lead) s += 0.14;
        if (d === o.riser - 1) s = 0.14; // the shadow under the step's nose
        pix.set(x, y + d, s, o.row);
      }
      if (mossy && o.moss !== undefined && (lightFromLeft ? x1 - x < 7 : x - x0 < 7) && hashInt(x, 8, o.seed) < 0.7) {
        pix.set(x, y - 1, 0.55, o.moss);
        if (hashInt(x, 9, o.seed) < 0.5) pix.set(x, y - 2, 0.7, o.moss);
      }
    }
  });
}
