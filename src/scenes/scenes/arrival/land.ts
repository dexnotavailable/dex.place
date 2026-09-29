// Rock shaping for the arrival's shores: big lit planes and ledges on the
// cliffs, and the short broken reflection under rock that stands in the water.
// Adapted from ring-lake.

import { Pix, fbm1, hashInt } from "../../engine/index.ts";
import type { Geo } from "./geo.ts";
/**
 * Big planes on the near-right cliff: a lit face turned toward the shaft along its
 * left edge, a half-lit plane behind it, then shadow; three ledges with lit tops
 * and dark undersides. Works per chunk cell so the rock stays chunky.
 */
export function cliffPlanes(pix: Pix, x0: number, g: Geo, c: number): void {
  const { W, H, u } = g;
  const ledges = [
    { y: H * 0.3, x1: W * 0.99, slope: 0.1 },
    { y: H * 0.47, x1: W * 1.02, slope: 0.16 },
    { y: H * 0.62, x1: W * 0.97, slope: 0.08 },
  ];
  for (let y = 0; y < pix.h; y += c) {
    let ex = -1;
    for (let x = 0; x < pix.w; x++)
      if (pix.solid(x, y)) {
        ex = x;
        break;
      }
    if (ex < 0) continue;
    for (let x = ex; x < pix.w; x += c) {
      if (!pix.solid(x, y)) continue;
      const X = x + x0;
      // facet boundaries lean with height, so the planes read as slabs, not stripes
      const dd = x - ex - (pix.h - y) * 0.06;
      let add = x - ex < 3 * u ? 0.5 : dd < 14 * u ? 0.3 : dd < 38 * u ? 0.14 : dd < 60 * u ? 0.05 : 0;
      for (const l of ledges) {
        if (X > l.x1) continue;
        const ly = l.y + (X - W * 0.85) * l.slope;
        const dy = y - ly;
        if (dy >= 0 && dy < 2 * u) add += Math.max(0.14, 0.4 - Math.max(0, dd) * 0.003);
        else if (dy >= 2 * u && dy < 7 * u) add -= 0.08;
      }
      for (let yy = y; yy < Math.min(pix.h, y + c); yy++)
        for (let xx = x; xx < Math.min(pix.w, x + c); xx++) if (pix.solid(xx, yy)) pix.setShade(xx, yy, pix.shadeAt(xx, yy) + add);
    }
  }
}

/**
 * Planes on a mid rock: a lit rim and a half-lit plane on the flank toward the
 * sun (dir 1: the right edge, -1: the left edge), a shadow core behind, and a few
 * ledges with lit tops and dark undersides that break the vertical streaks.
 */
export function flankPlanes(pix: Pix, x0: number, g: Geo, o: { dir: 1 | -1; c: number; ledges: number[]; seed: number }): void {
  const { H, u } = g;
  for (let y = 0; y < pix.h; y++) {
    let ex = -1;
    if (o.dir > 0) {
      for (let x = pix.w - 1; x >= 0; x--)
        if (pix.solid(x, y)) {
          ex = x;
          break;
        }
    } else {
      for (let x = 0; x < pix.w; x++)
        if (pix.solid(x, y)) {
          ex = x;
          break;
        }
    }
    if (ex < 0) continue;
    for (let k = 0; k < pix.w; k++) {
      const x = ex - o.dir * k;
      if (x < 0 || x >= pix.w) break;
      if (!pix.solid(x, y)) continue;
      // facet edges lean and wobble, so planes read as slabs
      const dd = k - (pix.h - y) * 0.05 + (fbm1((y + x0) / (9 * u), o.seed) - 0.5) * 6 * u;
      let add = k < 2 ? 0.36 : dd < 7 * u ? 0.18 : dd < 18 * u ? 0.07 : -0.03;
      for (const [i, f] of o.ledges.entries()) {
        const ly = H * f + (fbm1((x + x0) / (20 * u), o.seed + i) - 0.5) * 8 * u + (x + x0) * 0.04 * (i % 2 ? 1 : -1);
        const dy = y - ly;
        if (dy >= 0 && dy < 1.5) add += dd < 18 * u ? 0.22 : 0.1;
        else if (dy >= 1.5 && dy < 5 * u) add -= 0.07;
      }
      pix.setShade(x, y, pix.shadeAt(x, y) + add);
    }
  }
}

/**
 * A short, dark, broken reflection under a rock that stands in the water: rows of
 * streaks that wobble sideways and break up more with distance from the rock.
 */
export function cliffReflection(pix: Pix, base: number, row: number, seed: number, u: number): void {
  const len = Math.round(16 * u);
  for (let x = 0; x < pix.w; x++) {
    if (!pix.solid(x, base - 1)) continue;
    const l = Math.round(len * (0.55 + 0.45 * fbm1(x / (12 * u), seed)));
    for (let k = 0; k < l; k++) {
      const y = base + k;
      if (y >= pix.h) break;
      const t = k / l;
      const shift = Math.round(Math.sin(k * 1.7 + seed) * (1 + t * 2));
      const seg = Math.floor((x + shift) / (3 + (k % 3)));
      if (hashInt(seg, k, seed) < 0.15 + t * 0.7) continue;
      if (!pix.solid(x + shift, base - 1)) continue;
      pix.set(x, y, 0.1 - t * 0.06, row);
    }
  }
}

