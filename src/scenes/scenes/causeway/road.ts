// The causeway at the player plane (B2, depth 1), drawn where the room's
// collision is, with the region's painting kit (paint.ts):
//
// - the old road on its embankment: a coping of long kerb slabs on the
//   walking line, dressed courses down to the sheet water, buttress piers on a
//   rhythm, drainage arches through the bank where it stands tall enough (the
//   flats' water runs through them), a footing of big rough stones and fallen
//   blocks at the waterline, moss low on the face, a wet band and an algae line;
// - break 1: the road's end courses broken back in steps, blocks fallen into the
//   gap's water;
// - the colossus's footprint crater: the road smashed into a pit. Its far wall
//   stands behind the walk (earth in strata, roots, broken courses and tilted
//   flags caught in it, three toe gouges raked down it), its rim ragged with
//   grass; the walk is terraces of packed earth with the road's flags pressed
//   into their edges, down to the pool;
// - break 2: a breach, its sides broken masonry stepping down to the wade;
// - Stonetop: a tor of bedded, weathered boulders behind the bus shelter, each
//   lit from its own outline, every shelf of the climb a boulder's level top
//   exactly at its ledge, lichen on the lit faces, a darker core set back.
//
// Sized in P (the locked player height), pixel data only.

import { fbm, fbm1, hashInt, type Pix } from "../../engine/index.ts";
import { ashlar, boulders, coping, grassCap, known, put, shift, soil, type Boulder, type Ramp } from "./paint.ts";
import { B2, type Geo } from "./geo.ts";

export interface RoadRows {
  stone: Ramp;
  moss: Ramp;
  earth: Ramp;
  lichen: Ramp;
  algae: Ramp;
  grass: Ramp;
  recess: Ramp;
  tor: Ramp;
  ochre: Ramp;
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

/** Drainage arches through the bank: centre x and span in H (crown 0.5 H over the flats). */
const ARCHES: [number, number][] = [
  [116.9, 0.9],
  [127.9, 0.9],
  [151.2, 0.85],
  [157.3, 0.85],
];
/** Buttress piers on the face: x in H. */
const PIERS = [111.2, 123.6, 131.9, 145.3, 149.6, 154.2, 169.4];

export function buildRoad(pix: Pix, g: Geo, x0: number, y0: number, r: RoadRows): void {
  const P = g.P;
  const n = (k: number): number => Math.max(1, Math.round(P * k));
  const X = (wx: number): number => g.X(wx) - x0;
  const Y = (wy: number): number => g.Y(wy) - y0;
  const W = (lx: number): number => B2.x0 + (lx + x0 - g.X(B2.x0)) / P;
  known(pix, r.stone, r.moss, r.earth, r.lichen, r.algae, r.grass, r.recess, r.tor, r.ochre);
  const wl = Y(B2.flats);
  const bottom = wl + 3;
  const kerb = n(0.09);
  const c = B2.crater,
    k2 = B2.break2;
  const inCrater = (wx: number): boolean => wx >= c.x0 && wx < c.x1;
  const inBreak2 = (wx: number): boolean => wx >= k2.x0 && wx < k2.x1;
  const inBreak1 = (wx: number): boolean => wx >= B2.break1[0] && wx < B2.break1[1];
  const xa = X(B2.x0) - 10,
    xb = X(B2.x1) + 10;
  const top = (lx: number): number => {
    const wx = Math.max(B2.x0, Math.min(B2.x1 - 0.01, W(lx)));
    const t = surfaceAt(wx);
    return Number.isNaN(t) ? 1e9 : Y(t);
  };
  /** The road's coping line: road runs only (not the pit or the breach). */
  const isRoad = (lx: number): boolean => {
    const wx = W(lx);
    return !inCrater(wx) && !inBreak2(wx) && !inBreak1(wx);
  };

  // --- the arches' openings -------------------------------------------------------------
  const crown = Y(B2.flats + 0.52);
  const ring = n(0.12);
  const archAt = (lx: number, ly: number, grow = 0): boolean => {
    for (const [ax, span] of ARCHES) {
      const cx = X(ax),
        rx = (span * P) / 2 + grow;
      const dx = (lx - cx) / rx;
      if (Math.abs(dx) >= 1 || ly > wl + 2) continue;
      const ry = wl - crown + grow;
      if (ly >= wl - ry * Math.sqrt(1 - dx * dx)) return true;
    }
    return false;
  };
  const pierAt = (lx: number): number => {
    for (const px of PIERS) {
      const d = lx - X(px);
      if (d >= 0 && d < n(0.36)) return d;
    }
    return -1;
  };

  // --- the embankment's face (road runs) ---------------------------------------------------
  ashlar(pix, {
    x0: xa,
    x1: xb,
    top: (lx) => (isRoad(lx) ? top(lx) + kerb : 1e9),
    bottom: () => bottom,
    stone: r.stone,
    course: n(0.17),
    courseVar: 0.5,
    block: [n(0.32), n(0.75)],
    originY: wl,
    seed: 61,
    base: 3,
    swing: 1,
    light: -1,
    lit: [1, 0, 1, 0, -1],
    pits: 0.1,
    cracks: 0.2,
    stain: 0.6,
    clumps: 0.45,
    moss: { ramp: r.moss, amount: 0.35, where: (_lx, ly) => Math.max(0, Math.min(1, (ly - (wl - P * 1.2)) / (P * 1.0))) },
    streaks: { from: (lx) => top(lx) + kerb + 1, amount: 0.25, length: n(0.55) },
    wet: { y: wl, h: n(0.18), algae: r.algae },
    // the piers stand a hand proud of the face: lit west edge, shaded east edge, a step lighter
    shade: (lx) => {
      const d = pierAt(lx);
      if (d < 0) return 0;
      return d < 2 ? 2 : d > n(0.36) - 3 ? -2 : 1;
    },
    hole: (lx, ly) => archAt(lx, ly, ring),
  });
  // the piers' weathered caps under the coping and their foot in the water
  for (const px of PIERS) {
    const a = X(px),
      b = a + n(0.36);
    if (!isRoad(a) || !isRoad(b)) continue;
    for (let lx = a - 1; lx <= b; lx++) {
      const t = top(lx) + kerb;
      put(pix, lx, t, r.stone, lx === a - 1 ? 3 : 5);
      put(pix, lx, t + 1, r.stone, 3);
      shift(pix, lx, t + 2, -1);
    }
    // a contact shadow east of the pier on the face
    for (let ly = top(b) + kerb + 2; ly < wl - 2; ly++) shift(pix, b, ly, -1);
  }
  // the arches: voussoir rings, the dark wet tunnel, the flats' water running through
  for (const [ax, span] of ARCHES) {
    const cx = X(ax),
      rx = (span * P) / 2;
    const ry = wl - crown;
    const vous = 9;
    for (let ly = crown - ring - 1; ly <= wl + 2; ly++)
      for (let lx = Math.floor(cx - rx - ring - 1); lx <= Math.ceil(cx + rx + ring + 1); lx++) {
        if (!isRoad(lx)) continue;
        const dx0 = (lx - cx) / rx;
        const inner = Math.abs(dx0) < 1 && ly >= wl - ry * Math.sqrt(Math.max(0, 1 - dx0 * dx0)) && ly <= wl + 2;
        const dxo = (lx - cx) / (rx + ring);
        const outer = Math.abs(dxo) < 1 && ly >= wl - (ry + ring) * Math.sqrt(Math.max(0, 1 - dxo * dxo)) && ly <= wl + 2;
        if (!outer) continue;
        if (inner) {
          const ceil = wl - ry * Math.sqrt(Math.max(0, 1 - dx0 * dx0));
          let i = ly - ceil < 2 ? 2 : 0;
          // the light at the far end of the tunnel: the flats on the other side
          if (Math.abs(dx0) < 0.45 && ly > ceil + n(0.12)) i = ly > wl - n(0.08) ? 3 : 1;
          if (ly >= wl - 1) i = hashInt(lx >> 1, 3, 151) < 0.3 ? 3 : 1;
          put(pix, lx, ly, r.recess, i);
          continue;
        }
        const ang = Math.atan2((wl - ly) / ry, (lx - cx) / rx);
        const kk = Math.floor((ang / Math.PI) * vous);
        const fr = (ang / Math.PI) * vous - kk;
        let i = 3 + (hashInt(kk, Math.round(ax), 153) < 0.4 ? -1 : 0) + (kk === Math.floor(vous / 2) ? 1 : 0);
        if (fr < 0.12) i = 0;
        if (ly > wl - n(0.18)) i -= 1;
        put(pix, lx, ly, r.stone, i);
      }
  }
  // the coping along the road: long kerb slabs, the walking line their lit top
  const pad = (lx: number): boolean => lx >= X(B2.shelter.x0 - 0.3) && lx < X(B2.shelter.x1 + 0.4);
  coping(pix, { x0: xa, x1: xb, top: (lx) => (isRoad(lx) && !pad(lx) ? top(lx) : 1e9), h: kerb, stone: r.stone, base: 3, seed: 160, block: [n(0.6), n(1.3)], drip: 3, moss: { ramp: r.moss, amount: 0.12 } });
  // the bus stop's paved pad: newer, smoother slabs laid square, a lighter line of kerb
  coping(pix, { x0: X(B2.shelter.x0 - 0.3), x1: X(B2.shelter.x1 + 0.4), top: (lx) => top(lx), h: kerb, stone: r.stone, base: 4, seed: 161, block: [n(0.98), n(1.02)], drip: 3 });
  // the footing: big rough stones along the waterline, and blocks fallen from the face
  {
    const list: Boulder[] = [];
    for (let i = 0; i * n(0.5) < xb - xa; i++) {
      const lx = xa + i * n(0.5) + Math.round(hashInt(i, 1, 171) * n(0.3));
      if (!isRoad(lx) && !inBreak1(W(lx))) continue;
      if (hashInt(i, 2, 171) < 0.45) continue;
      const w = n(0.22 + 0.3 * hashInt(i, 3, 171)),
        h = n(0.12 + 0.12 * hashInt(i, 4, 171));
      list.push({ x0: lx, x1: lx + w, y0: wl - h + n(0.04), y1: wl + 3, r: n(0.06), tone: -1, seed: 172 + i });
    }
    // break 1: blocks fallen into the gap
    for (const [fx, fw, fh] of [
      [120.15, 0.32, 0.2],
      [120.5, 0.26, 0.14],
      [120.78, 0.24, 0.24],
    ] as [number, number, number][])
      list.push({ x0: X(fx), x1: X(fx + fw), y0: wl - n(fh), y1: wl + 3, r: n(0.05), tone: 0, seed: 180 + Math.round(fx * 10) });
    boulders(pix, list, { stone: r.stone, base: 2, light: [-0.7, -1], rim: 2, rough: 1, lichen: { ramp: r.algae, amount: 0.25, top: false } });
  }
  // break 1's ends: under the kerb, the courses broken back unevenly into the road, the raw faces dark
  for (const [edge, dir] of [
    [B2.break1[0], -1],
    [B2.break1[1], 1],
  ] as [number, number][]) {
    const ex = X(edge);
    const ct = Y(1.2) + kerb;
    for (let ly = ct + 2; ly < wl; ly++) {
      const course = Math.floor((ly - ct) / n(0.17));
      const bite = Math.round(hashInt(course, Math.round(edge * 10), 191) * n(0.16)) + (course > 1 ? n(0.04) : 0);
      // dir -1: the gap is east of the edge, eat west into the road; dir 1: eat east
      for (let k = 0; k < bite; k++) pix.clear(dir < 0 ? ex - 1 - k : ex + k, ly);
      const fx = dir < 0 ? ex - 1 - bite : ex + bite;
      shift(pix, fx, ly, -2);
      shift(pix, fx - dir, ly, -1);
    }
  }

  // --- the crater -----------------------------------------------------------------------------
  {
    const cx0 = X(c.x0),
      cx1 = X(c.x1);
    const rimY = (lx: number): number => {
      const t = (lx - cx0) / (cx1 - cx0);
      // the far rim: a little below the road at the middle, broken and ragged
      return Y(c.top + 0.02) + Math.round(Math.sin(Math.PI * t) * n(0.22) + (fbm1(lx / 9, 301, 3) - 0.5) * n(0.12));
    };
    // the far wall (behind the walk): earth in strata with roots and broken courses caught in it
    soil(pix, {
      x0: cx0,
      x1: cx1,
      top: rimY,
      bottom: (lx) => (top(lx) >= 1e8 ? Y(c.floor) : top(lx)),
      earth: r.earth,
      seed: 303,
      base: 5,
      strata: n(0.16),
      pebbles: { ramp: r.stone, amount: 0.5, size: n(0.035) },
      roots: { ramp: r.earth, amount: 0.8, length: n(0.4) },
      darkPer: 1 / (P * 1.1),
    });
    // the far wall is in the pit's own shadow under its rim
    for (let lx = cx0; lx < cx1; lx++) for (let k = 2; k < n(0.14); k++) shift(pix, lx, rimY(lx) + k, k < n(0.07) ? -1 : 0);
    // broken courses of the road caught in the far wall, tilted into the pit
    for (const [bx, bw, by, tilt] of [
      [134.9, 0.6, 0.85, 0.35],
      [136.2, 0.5, 0.2, 0.22],
      [141.6, 0.55, 0.15, -0.28],
      [142.9, 0.7, 0.85, -0.4],
    ] as [number, number, number, number][]) {
      const a = X(bx),
        w = n(bw),
        y = Y(by);
      for (let k = 0; k < w; k++) {
        const yy = y + Math.round(k * tilt);
        for (let j = 0; j < n(0.1); j++) {
          const i = j === 0 ? 5 : j === n(0.1) - 1 ? 1 : k === 0 ? 4 : 3;
          put(pix, a + k, yy + j, r.stone, i - (hashInt(a + k, j, 305) < 0.08 ? 1 : 0));
        }
        shift(pix, a + k, yy + n(0.1), -2);
      }
    }
    // three toe gouges raked down the far wall toward the pool
    for (const [gx, len] of [
      [137.3, 1.1],
      [138.4, 1.35],
      [139.9, 1.2],
    ] as [number, number][]) {
      const a = X(gx);
      const y0g = rimY(a) + n(0.12);
      for (let k = 0; k < n(len); k++) {
        const lx = a + Math.round(k * 0.18 + Math.sin(k * 0.2) * 1.2);
        const ly = y0g + k;
        if (ly >= top(lx)) break;
        put(pix, lx, ly, r.earth, 0);
        put(pix, lx + 1, ly, r.earth, 0);
        put(pix, lx - 1, ly, r.earth, 4);
        put(pix, lx + 2, ly, r.earth, 1);
      }
    }
    // the rim: broken flags tipping over it, grass along it
    grassCap(pix, { x0: cx0, x1: cx1, top: rimY, grass: r.grass, seed: 307, depth: 2, blades: n(0.08), cover: 0.7, lean: 0.4 });
    // the terraces of the walk: packed earth under each tread, the road's flags pressed into the edges
    // the ground the pit is cut into (a section through the bank, in front): its edge broken, not ruled
    const cutL = (ly: number): number => cx0 - Math.round(Math.max(0, ly - wl) * 0.15 + hashInt(ly >> 2, 1, 315) * n(0.06));
    const cutR = (ly: number): number => cx1 + Math.round(Math.max(0, ly - wl) * 0.15 + hashInt(ly >> 2, 2, 315) * n(0.06));
    soil(pix, {
      x0: cutL(Y(c.floor - 2.6)),
      x1: cutR(Y(c.floor - 2.6)),
      top: (lx) => {
        if (lx >= cx0 && lx < cx1) return top(lx);
        // past the pit's ends the section only shows below the water, widening downward
        for (let ly = wl + 2; ly < Y(c.floor - 2.6); ly++) if (lx >= cutL(ly) && lx < cutR(ly)) return ly;
        return 1e9;
      },
      bottom: () => Y(c.floor - 2.6),
      earth: r.earth,
      seed: 311,
      base: 3,
      strata: n(0.12),
      pebbles: { ramp: r.stone, amount: 0.7, size: n(0.03) },
      darkPer: 1 / (P * 0.6),
    });
    // spoil thrown out over both ends: earth and broken blocks heaped against the embankment's face
    const spoil: Boulder[] = [];
    for (const [sx, dir] of [
      [c.x0, -1],
      [c.x1, 1],
    ] as [number, number][]) {
      const ex = X(sx);
      for (let k = 0; k < 5; k++) {
        const w = n(0.2 + 0.18 * hashInt(k, Math.round(sx), 317)),
          h = n(0.12 + 0.1 * hashInt(k + 5, Math.round(sx), 317));
        const off = n(0.12) + k * n(0.16);
        const bx = dir < 0 ? ex - off - w : ex + off;
        const by = wl - Math.round(Math.max(0, n(0.75) - k * n(0.16)) * (0.7 + 0.3 * hashInt(k, 9, 317)));
        spoil.push({ x0: bx, x1: bx + w, y0: by - h, y1: Math.min(wl + 3, by + h), r: n(0.05), tone: -1 + (k % 2), seed: 330 + k + Math.round(sx) });
      }
    }
    boulders(pix, spoil, { stone: r.stone, base: 3, light: [-0.7, -1], rim: 2, rough: 1.2, lichen: { ramp: r.moss, amount: 0.25 } });
    // each tread's lip: a flag of the old road set in it, lit, its shadow under
    for (let lx = cx0; lx < cx1; lx++) {
      const t = top(lx);
      if (t >= 1e8) continue;
      const wx = W(lx);
      const flag = hashInt(Math.floor((wx - c.x0) / 0.3), 7, 313) < 0.7;
      const pool = wx >= c.pool[0] && wx < c.pool[1];
      if (pool) {
        for (let k = 0; k < n(0.05); k++) put(pix, lx, t + k, r.earth, 1);
        continue;
      }
      if (flag) {
        put(pix, lx, t, r.stone, 5);
        put(pix, lx, t + 1, r.stone, 3);
        put(pix, lx, t + 2, r.stone, 2);
        shift(pix, lx, t + 3, -2);
      } else {
        put(pix, lx, t, r.earth, 5);
        put(pix, lx, t + 1, r.earth, 4);
      }
    }
  }

  // --- break 2: the breach -------------------------------------------------------------------
  {
    const a = X(k2.x0),
      b = X(k2.x1);
    // the breach's sides: broken masonry stepping down to the wade, then the stream bed
    ashlar(pix, {
      x0: a,
      x1: b,
      top: (lx) => top(lx),
      bottom: () => bottom,
      stone: r.stone,
      course: n(0.13),
      courseVar: 0.5,
      block: [n(0.2), n(0.4)],
      originY: wl,
      seed: 321,
      base: 2,
      light: -1,
      lit: [2, 0, 1, -1, -1],
      cracks: 0.35,
      stain: 0.5,
      moss: { ramp: r.moss, amount: 0.5 },
      clumps: 0.4,
      wet: { y: Y(k2.water), h: n(0.12), algae: r.algae },
    });
    // the water through the breach behind the wade (the flats' level), weed on the stones
    for (let lx = a; lx < b; lx++) {
      const t = top(lx);
      if (t >= 1e8) continue;
      for (let k = 0; k < n(0.04); k++) put(pix, lx, t + k, r.stone, k === 0 ? 4 : 3);
    }
  }

  // --- pebbles and tufts on the road, for scale -------------------------------------------------
  for (let lx = xa; lx < xb; lx++) {
    if (!isRoad(lx)) continue;
    const t = top(lx);
    const h = hashInt(lx, 17, 19);
    if (h < 0.012) {
      const w = 2 + Math.floor(hashInt(lx, 5, 23) * 4);
      for (let k = 0; k < w; k++) put(pix, lx + k, t - 1, r.stone, k === 0 ? 5 : 3);
    } else if (h > 0.965) for (let k = 1; k <= 1 + Math.floor(hashInt(lx, 6, 23) * n(0.08)); k++) put(pix, lx, t - k, r.grass, 2 + (k & 1));
  }
  void fbm;
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
 * Stonetop: a tor of bedded, weathered boulders rising behind the bus shelter.
 * Each walkable slab keeps a level lit shelf exactly at its ledge (B2.stones
 * and the summit); between and behind them sit rounder filler stones and a
 * darker core set back, so the climb reads as one stacked outcrop of granite
 * lit from the white sky, lichen crusting the upper faces.
 */
export function buildTor(pix: Pix, g: Geo, x0: number, y0: number, r: RoadRows): void {
  const P = g.P;
  const X = (wx: number): number => g.X(wx) - x0;
  const Y = (wy: number): number => g.Y(wy) - y0;
  known(pix, r.tor, r.lichen, r.ochre, r.grass, r.moss);
  const lich: Ramp = r.lichen;
  // the core, set back and in shade: big rounded masses behind the climb
  // the core: courses of bedded blocks stacked up the middle of the tor, narrowing as it rises, set back
  // (a step darker) so the climb's slabs stand out in front of them
  const core: Boulder[] = [];
  {
    let y = 5.0;
    let k = 0;
    while (y < 16.6) {
      const h = 0.9 + 0.6 * hashInt(k, 1, 505);
      const t = (y - 5) / 11.6;
      const half = 3.6 - 1.6 * t + (hashInt(k, 2, 505) - 0.5) * 0.6;
      const mid = 164.1 + (hashInt(k, 3, 505) - 0.5) * 0.8;
      let x = mid - half;
      let j = 0;
      while (x < mid + half - 0.4) {
        const w = Math.min(mid + half - x, 1.3 + 1.4 * hashInt(k, j + 10, 505));
        core.push({ x0: X(x), x1: X(x + w) - 1, y0: Y(y + h), y1: Y(y), r: P * (0.18 + 0.2 * hashInt(k, j + 20, 505)), tone: -1 + (hashInt(k, j + 30, 505) < 0.3 ? 1 : 0), seed: 506 + k * 13 + j });
        x += w;
        j++;
      }
      y += h;
      k++;
    }
  }
  boulders(pix, core, { stone: r.tor, base: 3, light: [-0.8, -1], rim: 3, bedding: Math.round(P * 0.32), rough: 2, lichen: { ramp: lich, amount: 0.16 } });
  // the slabs, lowest first: rounded ends, a level shelf on top where the ledge is
  const slabs: Boulder[] = TOR.map(([a, b, t, bt], i) => ({ x0: X(a), x1: X(b), y0: Y(t), y1: Y(bt), r: Math.min(P * (0.28 + 0.1 * (i % 3)), (Y(bt) - Y(t)) * 0.38), tone: i % 3 === 1 ? -1 : 0, seed: 520 + i }));
  boulders(pix, slabs, {
    stone: r.tor,
    base: 3,
    light: [-0.8, -1],
    rim: 3,
    bedding: Math.round(P * 0.28),
    rough: 1.6,
    lichen: { ramp: lich, amount: 0.26 },
    flatTop: () => Math.round(P * 0.07),
  });
  // orange lichen in a few sheltered spots, and grass in the joints between slabs
  for (const s of slabs) {
    const w = s.x1 - s.x0;
    for (let k = 0; k < 2; k++) {
      if (hashInt(s.seed, k + 40, 541) < 0.4) continue;
      const cx = Math.round(s.x0 + w * (0.2 + 0.6 * hashInt(s.seed, k, 541))),
        cy = Math.round(s.y0 + (s.y1 - s.y0) * (0.35 + 0.4 * hashInt(s.seed, k + 9, 541)));
      const rr = 2 + Math.floor(hashInt(s.seed, k + 3, 541) * 4);
      for (let yy = -rr; yy <= rr; yy++)
        for (let xx = -rr * 2; xx <= rr * 2; xx++) {
          if ((xx * xx) / 4 + yy * yy > rr * rr || hashInt((cx + xx) >> 1, (cy + yy) >> 1, 543) < 0.3) continue;
          if (pix.solid(cx + xx, cy + yy)) put(pix, cx + xx, cy + yy, r.ochre, yy < 0 ? 2 : 1);
        }
    }
    // tufts along the shelf's back edge (never on its walking line)
    grassCap(pix, { x0: Math.round(s.x0 + w * 0.08), x1: Math.round(s.x0 + w * 0.22), top: () => s.y0, grass: r.grass, seed: s.seed + 7, depth: 1, blades: Math.round(P * 0.1), cover: 0.9, lean: 0.4 });
  }
  // the seams under each slab: a contact shadow on whatever it rests on
  for (const s of slabs) for (let lx = Math.round(s.x0 + s.r * 0.5); lx < s.x1 - s.r * 0.5; lx++) for (let k = 1; k <= 3; k++) shift(pix, lx, s.y1 + k, k === 1 ? -2 : -1);
  void fbm;
  void fbm1;
}
