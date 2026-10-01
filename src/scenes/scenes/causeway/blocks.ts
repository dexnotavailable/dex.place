// Region B's block painter (lane reg-b, round 2): quarried or dressed stones
// shaded the way a pixel artist shades them, with one consistent top-left
// light. Part of the painting kit (paint.ts): it writes tone indices of a
// ramp, so every value is a whole step of the room's hue-shifted ramp.
//
// Per block: a corner radius of its own at each corner (no two alike),
// chipped corners and nicks bitten out of the edges (their broken faces take
// the same light as the block's outline), a bright arris along the top and a
// lit west edge, the underside and the east edge in shade, a fine grain in
// 2 px clusters and a broad swell, cracks (a dark wandering line with a lit
// lip under it, now and then a branch), drip stains from the top edge,
// lichen on the upper face and an orange crust in a sheltered spot.

import { fbm, hashInt, type Pix } from "../../engine/index.ts";
import { put, type Ramp } from "./paint.ts";

export interface Block {
  /** Box in px: left, top, right, bottom (exclusive). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Corner radii px: top-left, top-right, bottom-right, bottom-left. */
  r: [number, number, number, number];
  /** Tone offset (whole steps). */
  tone?: number;
  seed: number;
  /** A walkable shelf: the top row stays exactly level between the top corner radii. */
  flat?: boolean;
}

export interface BlockOpts {
  stone: Ramp;
  base: number;
  /** Chance per corner of a chipped corner. */
  chips?: number;
  /** Nicks bitten out of the edges, per 100 px of perimeter. */
  nicks?: number;
  /** Expected cracks per block. */
  cracks?: number;
  /** Drip stains running down from the top edge, 0..1. */
  drips?: number;
  /** Outline noise px. */
  rough?: number;
  lichen?: { ramp: Ramp; amount: number };
  /** Orange crust spots: chance per block. */
  spots?: { ramp: Ramp; amount: number };
  /** Extra whole steps per pixel (occlusion, a lamp's warmth). */
  shade?: (x: number, y: number) => number;
  /** Fog per pixel 0..1 (the air between the eye and the face). */
  fog?: (x: number, y: number) => number;
}

const CAP = 12;

/** Paints blocks in list order (later ones in front). Returns nothing; see the header. */
export function blocks(pix: Pix, list: Block[], o: BlockOpts): void {
  const S = o.stone;
  const rough = o.rough ?? 1;
  for (const b of list) {
    const bx0 = Math.round(b.x0),
      by0 = Math.round(b.y0);
    const w = Math.round(b.x1) - bx0,
      h = Math.round(b.y1) - by0;
    if (w < 3 || h < 3) continue;
    const half = Math.min(w, h) / 2;
    const rc = b.r.map((r) => Math.max(0, Math.min(r, half))) as [number, number, number, number];
    // chipped corners: a facet cut across the corner in 2 px steps
    const chip = [0, 1, 2, 3].map((k) => {
      if (hashInt(b.seed, k, 701) >= (o.chips ?? 0)) return 0;
      const s = Math.round(4 + hashInt(b.seed, k + 4, 701) * Math.min(w, h) * 0.2);
      return b.flat && k < 2 ? Math.min(s, 12) : s;
    });
    // nicks: [edge (0 top, 1 bottom, 2 left, 3 right), centre, half-width, depth]
    const nicks: [number, number, number, number][] = [];
    const nn = Math.floor(((2 * (w + h)) / 100) * (o.nicks ?? 0) + hashInt(b.seed, 9, 701));
    for (let j = 0; j < nn; j++) {
      let e = Math.floor(hashInt(b.seed, j + 20, 701) * 4);
      if (b.flat && e === 0) e = 1;
      const len = e < 2 ? w : h;
      nicks.push([e, Math.round(len * (0.15 + 0.7 * hashInt(b.seed, j + 30, 701))), 2 + Math.floor(hashInt(b.seed, j + 40, 701) * 5), 2 + Math.floor(hashInt(b.seed, j + 50, 701) * 3)]);
    }
    const inside = (lx: number, ly: number): boolean => {
      const left = lx < w / 2,
        top = ly < h / 2;
      const k = top ? (left ? 0 : 1) : left ? 3 : 2;
      const r = rc[k]!;
      const ax = left ? lx : w - 1 - lx,
        ay = top ? ly : h - 1 - ly;
      // the walkable line: level and whole between the top corners
      if (b.flat && ly < 2 && lx >= rc[0] && lx < w - rc[1]) return true;
      if (chip[k]! > 0 && Math.floor(ax / 2) * 2 + Math.floor(ay / 2) * 2 < chip[k]!) return false;
      for (const [e, c, hw, d] of nicks) {
        const along = e < 2 ? lx : ly;
        const into = e === 0 ? ly : e === 1 ? h - 1 - ly : e === 2 ? lx : w - 1 - lx;
        if (Math.abs(along - c) <= hw && into < d - Math.floor(Math.abs(along - c) / 2)) return false;
      }
      const qx = r - ax,
        qy = r - ay;
      if (qx > 0 && qy > 0 && Math.hypot(qx, qy) > r) return false;
      // a chunky outline: noise on a 3 px grid, only right at the edge
      if (rough > 0 && (ax < 4 || ay < 4) && !(b.flat && ly < 3)) {
        const nq = (fbm(Math.floor((bx0 + lx) / 3) / 4, Math.floor((by0 + ly) / 3) / 4, b.seed, 2) - 0.5) * 2 * rough;
        if (Math.min(ax, ay) + nq < 0.5) return false;
      }
      return true;
    };
    const n = w * h;
    const m = new Uint8Array(n);
    for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) m[ly * w + lx] = inside(lx, ly) ? 1 : 0;
    // distances to the outline up / down / left / right (capped)
    const up = new Uint8Array(n),
      dn = new Uint8Array(n),
      lf = new Uint8Array(n),
      rt = new Uint8Array(n);
    for (let lx = 0; lx < w; lx++) {
      let c = 0;
      for (let ly = 0; ly < h; ly++) {
        const i = ly * w + lx;
        c = m[i] ? Math.min(CAP, c + 1) : 0;
        up[i] = c;
      }
      c = 0;
      for (let ly = h - 1; ly >= 0; ly--) {
        const i = ly * w + lx;
        c = m[i] ? Math.min(CAP, c + 1) : 0;
        dn[i] = c;
      }
    }
    for (let ly = 0; ly < h; ly++) {
      let c = 0;
      for (let lx = 0; lx < w; lx++) {
        const i = ly * w + lx;
        c = m[i] ? Math.min(CAP, c + 1) : 0;
        lf[i] = c;
      }
      c = 0;
      for (let lx = w - 1; lx >= 0; lx--) {
        const i = ly * w + lx;
        c = m[i] ? Math.min(CAP, c + 1) : 0;
        rt[i] = c;
      }
    }
    // cracks: wandering lines down from the top edge, a lit lip under each
    const crack = new Uint8Array(n);
    const nc = Math.floor((o.cracks ?? 0) * (0.4 + 1.2 * hashInt(b.seed, 60, 701)) * Math.min(2, Math.max(0.6, w / 160)));
    for (let j = 0; j < nc; j++) {
      let cx = Math.round(w * (0.12 + 0.76 * hashInt(b.seed, j + 61, 701)));
      let cy = 0;
      while (cy < h && !m[cy * w + cx]) cy++;
      const len = Math.round(h * (0.3 + 0.55 * hashInt(b.seed, j + 62, 701)));
      const bias = hashInt(b.seed, j + 63, 701) < 0.5 ? -1 : 1;
      for (let k = 0; k < len && cy < h; k++, cy++) {
        if (hashInt(b.seed + j, k, 703) < 0.38) cx += hashInt(b.seed + j, k, 704) < 0.7 ? bias : -bias;
        if (cx < 1 || cx >= w - 1) break;
        const i = cy * w + cx;
        if (!m[i]) break;
        crack[i] = 1;
        if (k > 2 && hashInt(b.seed + j, k, 705) < 0.08) {
          let bx = cx;
          for (let q = 1; q < 6 + Math.floor(hashInt(b.seed + j, k, 706) * 8) && cy + q < h; q++) {
            bx += bias * (q & 1);
            const ii = (cy + q) * w + bx;
            if (bx < 1 || bx >= w - 1 || !m[ii]) break;
            crack[ii] = 1;
          }
        }
      }
    }
    for (let i = 0; i + w + 1 < n; i++) if (crack[i] === 1 && m[i + w + 1] && crack[i + w + 1] === 0) crack[i + w + 1] = 2;
    const topRow = new Int16Array(w).fill(h);
    for (let lx = 0; lx < w; lx++)
      for (let ly = 0; ly < h; ly++)
        if (m[ly * w + lx]) {
          topRow[lx] = ly;
          break;
        }
    const spot = !!o.spots && hashInt(b.seed, 80, 701) < o.spots.amount;
    const spx = Math.round(w * (0.2 + 0.6 * hashInt(b.seed, 81, 701))),
      spy = Math.round(h * (0.3 + 0.45 * hashInt(b.seed, 82, 701))),
      spr = 3 + Math.floor(hashInt(b.seed, 83, 701) * 4);
    for (let ly = 0; ly < h; ly++)
      for (let lx = 0; lx < w; lx++) {
        const i = ly * w + lx;
        if (!m[i]) continue;
        const x = bx0 + lx,
          y = by0 + ly;
        if (x < 0 || y < 0 || x >= pix.w || y >= pix.h) continue;
        let t = o.base + (b.tone ?? 0);
        const u = up[i]!,
          d = dn[i]!,
          l = lf[i]!,
          r = rt[i]!;
        // the lower part of a stone is turned from the sky: a step down, its edge dithered
        if (ly > h * 0.62 + (hashInt(x >> 1, y >> 1, b.seed + 5) - 0.5) * h * 0.12) t -= 1;
        // grain in 2 px clusters, a broad swell
        const gr = fbm(Math.floor(x / 2) / 7, Math.floor(y / 2) / 5, b.seed + 3, 2);
        if (gr < 0.24) t -= 1;
        else if (gr > 0.8) t += 1;
        if (fbm(x / 60, y / 40, b.seed + 2, 2) < 0.22) t -= 1;
        // the bevel: the arris and the lit top, the lit west edge, the underside and the east edge in shade
        if (u <= 2) t += 3;
        else if (u <= 5) t += 2;
        else if (u <= 9) t += 1;
        if (u > 2) {
          if (l <= 3) t += 2;
          else if (l <= 6) t += 1;
        }
        if (d <= 3) t -= 3;
        else if (d <= 6) t -= 2;
        else if (d <= 10) t -= 1;
        if (r <= 3) t -= 2;
        else if (r <= 6) t -= 1;
        // drip stains from the top edge, thinning as they run
        const run = ly - topRow[lx]!;
        if (o.drips && u > 3 && hashInt(x >> 1, 3, b.seed + 9) < o.drips * 0.09 && run < h * (0.15 + 0.6 * hashInt(x >> 1, 4, b.seed + 9)) && hashInt(x, y >> 1, b.seed + 10) > run / h) t -= 1;
        // pits and flecks
        if (hashInt(x >> 1, y >> 1, b.seed + 7) < 0.02) t -= 1;
        else if (hashInt(x, y, b.seed + 8) < 0.008) t += 1;
        if (crack[i] === 1) t = Math.min(t - 3, 1);
        else if (crack[i] === 2) t += 1;
        if (o.shade) t += o.shade(x, y);
        const fg = o.fog ? o.fog(x, y) : 0;
        if (o.lichen && u > 3 && d > 3 && !crack[i]) {
          const top = Math.max(0, 1 - run / Math.max(8, h * 0.5));
          const ln = fbm(Math.floor(x / 2) / 5, Math.floor(y / 2) / 4, b.seed + 8, 3);
          if (ln * (0.55 + 0.65 * top) > 1 - o.lichen.amount) {
            const edge = fbm(Math.floor(x / 2) / 5, Math.floor((y - 2) / 2) / 4, b.seed + 8, 3) * (0.55 + 0.65 * top) <= 1 - o.lichen.amount;
            put(pix, x, y, o.lichen.ramp, Math.min(o.lichen.ramp.n - 1, (edge ? 2 : 1) + (u <= 7 ? 1 : 0)), fg);
            continue;
          }
        }
        if (spot && o.spots && !crack[i]) {
          const ex = (lx - spx) / 2,
            ey = ly - spy;
          if (ex * ex + ey * ey <= spr * spr && hashInt(x >> 1, y >> 1, b.seed + 84) > 0.3) {
            put(pix, x, y, o.spots.ramp, ey < 0 ? 2 : 1, fg);
            continue;
          }
        }
        put(pix, x, y, S, t, fg);
      }
  }
}

/** A shadow cast down a face from an overhang's underside at row y: dark rows, then a dithered fade. */
export function castShadow(pix: Pix, x0: number, x1: number, y: number, hard: number, soft: number, seed: number, step: (x: number, y: number, d: number) => void): void {
  for (let x = Math.round(x0); x < Math.round(x1); x++)
    for (let k = 0; k < hard + soft; k++) {
      const yy = y + k;
      if (!pix.solid(x, yy)) continue;
      if (k < hard) step(x, yy, -2);
      else if (hashInt(x >> 1, yy >> 1, seed) > (k - hard) / soft) step(x, yy, -1);
    }
}
