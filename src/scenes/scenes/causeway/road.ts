// The causeway at the player plane (B2, depth 1), drawn where the room's
// collision is: the old stone road on its embankment over the flooded flats
// (big worn flags on top, courses of blocks down to the water, moss and a
// wet band), its two breaks (ragged ends, fallen blocks in the water, the
// steps down to the shin-deep wade), the colossus's footprint crater (the
// road smashed into a stepped bowl, a pool at the bottom), and Stonetop, a
// tor of stacked slabs behind the bus shelter whose shelves are the climb.
// Sized in P (the locked player height), pixel data only.

import { Pix, fbm, fbm1, hashInt, paintGround, rockInfo } from "../../engine/index.ts";
import { B2, type Geo } from "./geo.ts";

export interface RoadRows {
  stone: number;
  dark: number;
  moss: number;
  earth: number;
  lichen: number;
  /** Stonetop's own stone (paler than the road's, weathered under the white sky); the road's stone if absent. */
  tor?: number;
}

/** Stair top at world x for a stair from (x0, y0) toward +x ending at y1 (standard 0.3 H treads). */
function stairTop(wx: number, x0: number, y0: number, y1: number): number {
  const n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.2 - 1e-6));
  const rise = (y1 - y0) / n;
  const i = Math.floor((wx - x0) / 0.3);
  if (wx < x0 || i >= n) return Number.NaN;
  return y0 + rise * (i + 1);
}

/** The walking surface elevation at world x (NaN over the breaks' open water). */
export function surfaceAt(wx: number): number {
  for (const [a, b, t] of B2.road) if (wx >= a && wx < b) return t;
  const c = B2.crater;
  if (wx >= c.x0 && wx < c.x1) {
    const down = stairTop(wx, c.x0, c.top, c.floor);
    if (!Number.isNaN(down)) return down;
    if (wx >= c.pool[0] && wx < c.pool[1]) return c.floor;
    const up = stairTop(wx, c.pool[1], c.floor, c.out);
    if (!Number.isNaN(up)) return up;
    return c.out;
  }
  const k = B2.break2;
  if (wx >= k.x0 && wx < k.x1) {
    const down = stairTop(wx, k.x0, 1.4, k.floor);
    if (!Number.isNaN(down)) return down;
    if (wx >= k.bottom[0] && wx < k.bottom[1]) return k.floor;
    const up = stairTop(wx, k.bottom[1], k.floor, 1.4);
    if (!Number.isNaN(up)) return up;
    return 1.4;
  }
  return Number.NaN;
}

export function buildRoad(pix: Pix, g: Geo, x0: number, y0: number, r: RoadRows): void {
  const P = g.P;
  const u = g.u;
  const n = (k: number): number => Math.max(1, Math.round(P * k));
  const set = (x: number, y: number, s: number, row: number): void => pix.set(x - x0, y - y0, s, row);
  const wl = g.Y(B2.flats);
  const H1 = P;
  const course = n(0.16);
  const xa = g.X(B2.x0) - 8;
  const xb = g.X(B2.x1) + 8;
  const inCrater = (wx: number): boolean => wx >= B2.crater.x0 && wx < B2.crater.x1;
  const inBreak2 = (wx: number): boolean => wx >= B2.break2.x0 && wx < B2.break2.x1;
  for (let x = xa; x < xb; x++) {
    const wx = B2.x0 + (x - g.X(B2.x0)) / H1;
    let top = surfaceAt(Math.max(B2.x0, Math.min(B2.x1 - 0.01, wx)));
    // break 1: ragged ends, a few blocks fallen into the water between them
    if (Number.isNaN(top)) {
      const t = (wx - B2.break1[0]) / (B2.break1[1] - B2.break1[0]);
      const rubble = hashInt(Math.floor(x / n(0.12)), 5, 7);
      if (rubble < 0.45) {
        const hgt = n(0.1 + 0.2 * hashInt(Math.floor(x / n(0.12)), 6, 7)) * (0.5 + 0.5 * Math.sin(Math.PI * t));
        for (let y = wl - hgt; y <= wl + 1; y++) set(x, y, y === wl - hgt ? 0.5 : 0.24, r.stone);
      }
      continue;
    }
    // the bowl and the break's pit are dug down: no embankment face above their floor
    const bowl = inCrater(wx);
    const pit = inBreak2(wx);
    const ty = g.Y(top);
    // the crater is dug into the embankment below the flats' water: its bowl goes down to its own floor
    const floorY = bowl ? g.Y(B2.crater.floor - 2.6) : wl + 1;
    // ragged edges at the break's rims
    const nearBreak = Math.min(Math.abs(wx - B2.break1[0]), Math.abs(wx - B2.break1[1]));
    const rag = nearBreak < 0.18 && hashInt(Math.floor(x / 3), 2, 9) < 0.4 ? n(0.08) : 0;
    for (let y = ty + rag; y <= floorY; y++) {
      const dy = y - ty;
      let s: number;
      let row = r.stone;
      if (bowl || pit) {
        // a stepped earth bowl: each tread's lip lit by the white sky, the packed earth
        // under it falling off into the dark with depth (so every step reads as a
        // terrace, not a black slab), broken flags of the road pressed into it
        const depthT = Math.min(1, dy / (P * 1.5));
        const f = rockInfo(x, y, { seed: 71, cell: Math.round(7 * u), flatten: 2, light: [-0.5, -1], base: 0.52, contrast: 0.45, cracks: 0.45 });
        if (dy === 0) s = 0.95;
        else if (dy <= n(0.03)) s = 0.78;
        else if (f.crack) {
          row = r.earth;
          s = 0.18 - 0.14 * depthT;
        } else if (f.cell < 0.4) {
          row = r.stone;
          s = f.shade - 0.26 * depthT;
        } else {
          row = r.earth;
          s = 0.28 + f.shade * 0.45 - 0.5 * depthT;
        }
      } else if (dy === 0) s = hashInt(Math.floor(x / n(0.4)), 1, 3) < 0.15 ? 0.58 : 0.74;
      else if (dy === 1) s = 0.52;
      else if (dy < n(0.06)) s = 0.36;
      else {
        // courses of big blocks, darker toward the water; each block its own tone, worn corners
        const c = Math.floor((y - g.Y(2.2)) / course);
        const inC = (y - g.Y(2.2)) % course;
        const bw = n(0.36 + 0.24 * hashInt(c, 1, 5));
        const shift = Math.round(hashInt(c, 2, 5) * bw);
        const bx = Math.floor((x + shift + 16384) / bw);
        const inB = (x + shift + 16384) % bw;
        s = 0.34 + 0.12 * (hashInt(bx, c, 7) - 0.5) + 0.1 * (fbm1(x / (6 * u) + c * 13, 21, 2) - 0.5);
        if (inC === 0 || inB === 0) s = 0.07;
        else if (inC === 1) s += 0.07;
        if ((inC === 1 || inC === course - 1) && (inB === 1 || inB === bw - 1)) s -= 0.06;
        s -= 0.14 * Math.min(1, dy / (P * 1.4));
        // lichen in sparse flecks inside patches (a texture, not a camouflage)
        const lm = fbm(x / (14 * u), y / (9 * u), 73, 2);
        if (lm > 0.62 && hashInt(x >> 1, y >> 1, 74) < 0.3) {
          row = r.lichen;
          s = Math.min(s, 0.3);
        }
      }
      // wet dark band and weed at the water (the bowl's own pool is lower)
      if (!bowl && y > wl - n(0.12)) {
        s = Math.min(s, 0.16);
        if (hashInt(x, y, 75) < 0.3) row = r.moss;
      }
      set(x, y, s, row);
    }
    // pebbles and tufts on the road, for scale
    if (!bowl && !pit) {
      const h = hashInt(x, 17, 19);
      if (h < 0.018) {
        const w = 2 + Math.floor(hashInt(x, 5, 23) * 4);
        for (let k = 0; k < w; k++) set(x + k, ty - 1, k === 0 ? 0.55 : 0.35, r.stone);
      } else if (h > 0.95) for (let k = 1; k <= 1 + Math.floor(hashInt(x, 6, 23) * n(0.07)); k++) set(x, ty - k, 0.3 + 0.1 * (k & 1), r.moss);
    }
  }
}

/** Stonetop's slabs: [x0, x1, top, bottom] in H. Each shelf of the climb is a slab's top. */
export const TOR: [number, number, number, number][] = [
  [158.9, 162.8, 4.5, 2.0],
  [165.3, 169.0, 4.9, 2.0],
  [161.6, 166.0, 5.35, 2.0],
  [165.4, 168.3, 6.8, 5.3],
  [167.7, 171.0, 8.3, 6.8],
  [163.6, 168.1, 9.8, 8.3],
  [161.8, 165.3, 11.3, 9.8],
  [158.9, 162.4, 12.8, 11.3],
  [161.5, 165.1, 14.3, 12.8],
  [164.5, 167.9, 15.8, 14.3],
  [159.4, 166.8, 17.3, 15.8],
];

/**
 * Stonetop: a tor of stacked, weathered slabs rising behind the bus shelter,
 * each slab's top one shelf of the climb (B2.stones above the roof and the
 * summit), a darker core set back behind them, painted with the engine's rock
 * grammar (lit from the sky side, bedding, fissures). From the road it is the
 * tall dark landmark at the east end.
 */
export function buildTor(pix: Pix, g: Geo, x0: number, y0: number, r: RoadRows): void {
  const P = g.P;
  const u = g.u;
  const Y = (wy: number): number => g.Y(wy) - y0;
  const X = (wx: number): number => g.X(wx) - x0;
  const W2 = (px: number): number => B2.x0 + (px + x0 - g.X(B2.x0)) / P;
  const rock = r.tor ?? r.stone;
  // the core, set back: a rounded mass from the shelter up to under the summit
  paintGround(pix, {
    top: (px) => {
      const wx = W2(px);
      const t = (wx - 160.6) / 7.6;
      if (t < 0 || t > 1) return 1e9;
      return Y(15.0 - 10.0 * Math.pow(Math.abs(t - 0.45) * 2, 1.3) + (fbm1(wx * 1.3, 99, 3) - 0.5) * 1.6);
    },
    bottom: () => Y(4.8),
    rock: { seed: 111, cell: Math.round(12 * u), flatten: 1.4, light: [-1, -0.6], base: 0.34, contrast: 0.5, cracks: 0.35 },
    row: rock,
    lip: 0.5,
    dark: 0.16,
    darkDepth: 260 * u,
  });
  // the slabs, lowest first, each rounded at its corners
  TOR.forEach(([a, b, top, bot], i) => {
    const xa = X(a), xb = X(b);
    const rnd = Math.min(P * 0.22, (xb - xa) * 0.2);
    // bedded slabs sit nearly flat on what is under them: only their corners are worn round
    const rb = Math.min(P * 0.16, (Y(bot) - Y(top)) * 0.25, (xb - xa) * 0.15);
    const arc = (e: number, r0: number): number => (e < r0 ? r0 - Math.sqrt(Math.max(0, r0 * r0 - (r0 - e) * (r0 - e))) : 0);
    paintGround(pix, {
      row: rock,
      x0: xa,
      x1: xb,
      top: (px) => {
        if (px < xa || px >= xb) return 1e9;
        const e = Math.min(px - xa, xb - 1 - px);
        // worn corners, chipped near the ends (not a pillow: a slab that has sat in the weather)
        const chip = e < rnd * 3 ? Math.round(Math.max(0, fbm1(px / (4 * u), 140 + i, 2) - 0.45) * rnd * 1.6) : 0;
        return Y(top) + arc(e, rnd) + chip + (fbm1(px / (5 * u), 120 + i, 2) - 0.5) * 1.5 + (e > rnd && hashInt(Math.floor(px / (3 * u)), i, 131) < 0.12 ? 2 * u : 0);
      },
      // a rounded, eroded underside
      bottom: (px) => {
        const e = Math.min(px - xa, xb - 1 - px);
        return Y(bot) - arc(e, rb) - Math.round(Math.max(0, fbm1(px / (16 * u), 130 + i, 2) - 0.6) * P * 0.25);
      },
      // bedded slabs: wide, flat facets lit from the sky side, a lit rim, shade gathering underneath
      rock: { seed: 121 + i, cell: Math.round(8 * u), flatten: 2.6, light: [-1, -0.7], base: 0.5, contrast: 0.42, cracks: 0.3 },
      lip: 0.8,
      rim: 0.3,
      rimDepth: 3 * u,
      under: 0.26,
      dark: 0.14,
      darkDepth: 60 * u,
    });
    // the shelf you stand on: a flat top face exactly at the ledge's height, lit by the white
    // sky, with lichen in crusts on it
    for (let px = xa + Math.round(rnd * 0.8); px < xb - Math.round(rnd * 0.8); px++) {
      pix.set(px, Y(top), 0.92, rock);
      for (let k = 1; k < Math.round(P * 0.1); k++) {
        const lich = k < Math.round(P * 0.06) && fbm1(px / (6 * u), 150 + i, 2) > 0.6 && hashInt(px, k, 151) < 0.55;
        if (lich) pix.set(px, Y(top) + k, 0.62 - k * 0.02, r.lichen);
        else pix.set(px, Y(top) + k, 0.7 - k * 0.014 + (hashInt(px >> 2, k, 133) < 0.1 ? -0.12 : 0), rock);
      }
    }
    // the slab's underside throws a shadow on what is below
    for (let px = xa; px < xb; px++) for (let k = 1; k <= Math.round(0.06 * P); k++) if (pix.solid(px, Y(bot) + k)) pix.setShade(px, Y(bot) + k, 0.06);
    void hashInt;
    void fbm;
  });
}
