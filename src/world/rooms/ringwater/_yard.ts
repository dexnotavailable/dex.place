// The keeper's yard's ground (A4), drawn in the arrival backdrop's palette and
// light (region lane a, round 1). The yard is the top of the cliff: a thick
// grassy lip that hangs over a band of soil with roots and bedded stones, then
// the cliff's own beds with ferns and grass on their lips, falling into shade
// toward the bottom of the frame. Flagstones run from the lodge's door; the
// shrine stands on a dressed plinth in front of a low dry-stone wall (its
// niche: the bowl, the box and the plaque are offerings set against it); the
// arch stands on a laid threshold. All flush with the ground (no collision
// change). Behind the yard a low grassy bank with shrubs and two firs closes
// the shelf off from the lake below (left open inside the arch, which frames
// the colossus); dark grass with lit tips stands in the bottom corners.

import { Pix } from "../../../scenes/engine/pix.ts";
import { fbm1, hashInt } from "../../../scenes/engine/noise.ts";
import type { BuildCtx, LayerDef } from "../../../scenes/engine/types.ts";
import type { Geo } from "../../../scenes/scenes/arrival.ts";
import { bush, fern, fir, grassTuft, paintStrata, vine } from "../../../scenes/scenes/arrival/near.ts";

const EDGE = 200;
const H = (a: number, b: number, s: number): number => hashInt(Math.floor(a), Math.floor(b), s);

export interface YardSpec {
  /** Room px -> screen px. */
  ox: number;
  /** Room y of the yard's ground. */
  y: number;
  /** Paved spans (room px): flagstones laid flush in the path. */
  paved?: [number, number][];
  /** Plinths (room px): a deeper course of dressed stone the shrine stands on, flush with the path. */
  plinth?: [number, number][];
  /** The shrine's wall behind its plinth (room px span, height px). */
  wall?: [number, number, number];
  /** The bank behind the yard: room x spans to keep low (doorways, the arch's opening). */
  open?: [number, number][];
  /** Firs on the bank (room px x, height px). */
  firs?: [number, number][];
}

export function yardGround(s: YardSpec): (ctx: BuildCtx, g: Geo, row: (n: string) => number) => LayerDef[] {
  return (ctx, _g, row) => {
    const { W, H: VH } = ctx;
    const X = (x: number): number => Math.round(x + s.ox + EDGE);
    const gy = s.y;
    const crag = row("crag"), ashlar = row("ashlar"), leaf = row("leaf"), earth = row("earth"), moss = row("moss");
    const pix = new Pix(W + 2 * EDGE, VH + 4);
    const inSpan = (x: number, spans?: [number, number][]): boolean => !!spans?.some(([a, b]) => x >= X(a) && x < X(b));
    // the soil band's depth wanders; the rock under it is the cliff's top beds
    const soil = (x: number): number => 30 + Math.round((fbm1(x / 23, 51, 3) - 0.5) * 18);
    const lips = paintStrata(pix, {
      top: (x) => gy + soil(x),
      bottom: () => VH + 4,
      row: crag,
      seed: 97,
      bed: [16, 34],
      joint: [60, 160],
      dip: 0.04,
      base: 0.4,
      dark: 0.26,
      deep: 110,
      moss,
      // the rock's top under the soil sits in the lip's shadow; sky light on the beds below that
      plane: (x, y) => {
        const d = y - gy - soil(x);
        return d < 5 ? -0.14 : d < 26 ? 0.05 : 0;
      },
    });
    for (let x = 0; x < pix.w; x++) {
      const sd = soil(x);
      const paved = inSpan(x, s.paved) || inSpan(x, s.plinth);
      for (let d = 0; d < sd; d++) {
        const y = gy + d;
        // soil: dark, roots threading through it
        let sh = 0.44 - d * 0.012 + (H(x >> 1, y >> 1, 52) - 0.5) * 0.1;
        const root = Math.abs(((x * 0.7 + d * 3 + fbm1(x / 9, 53, 2) * 30) % 37) - 1) < 0.8 && d > 6;
        if (root) sh = 0.62;
        pix.set(x, y, sh, earth);
      }
      // roots and grass hanging out over the rock under the soil
      if (H(x, 3, 58) < 0.12) {
        const len = 4 + Math.round(H(x, 4, 58) * 16);
        for (let k = 0; k < len; k++) pix.set(x + (k > len / 2 && H(x, 5, 58) < 0.5 ? 1 : 0), gy + sd + k, H(x, 6, 58) < 0.5 ? 0.5 - k * 0.015 : 0.36, H(x, 6, 58) < 0.5 ? earth : leaf);
      }
      if (!paved) {
        // the grass lip: lit tips, the mat, a dark root line, overhanging the soil
        const cd = 5 + Math.round(fbm1(x / 7, 54, 2) * 5);
        for (let d = 0; d < cd; d++) pix.set(x, gy + d, d === 0 ? 0.82 : d === 1 ? 0.68 : d < cd - 1 ? 0.5 - d * 0.02 + (H(x, d, 59) - 0.5) * 0.08 : 0.24, leaf);
        if (H(x, 7, 58) < 0.3) for (let k = 0; k < 3 + H(x, 8, 58) * 5; k++) pix.set(x, gy + cd + k, 0.4 - k * 0.04, leaf);
        const clump = fbm1(x / 5, 55, 2);
        const hb = Math.round(11 * Math.max(0, clump - 0.42) * 2.4 * (0.4 + H(x, 5, 55)));
        for (let k = 1; k <= hb; k++) pix.set(x + (k > 3 && H(x, 6, 55) < 0.4 ? 1 : 0), gy - k, k === hb ? 0.88 : 0.58 + (H(x, k, 56) - 0.5) * 0.12, leaf);
      }
    }
    // stones bedded in the soil
    for (let x = 6; x < pix.w; x += 13) {
      if (H(x, 1, 57) > 0.45) continue;
      const cx = x + Math.round(H(x, 2, 57) * 9), cy = gy + 10 + Math.round(H(x, 3, 57) * (soil(cx) - 12));
      const rx = 2 + Math.round(H(x, 4, 57) * 3), ry = 1 + Math.round(H(x, 5, 57) * 2);
      for (let y = -ry; y <= ry; y++)
        for (let k = -rx; k <= rx; k++) {
          const q = (k * k) / (rx * rx) + (y * y) / (ry * ry);
          if (q > 1) continue;
          pix.set(cx + k, cy + y, q > 0.6 ? (k + y > 0 ? 0.16 : 0.5) : k - y > 0 ? 0.62 : 0.44, ashlar);
        }
    }
    // growth on the rock's lips
    for (const [lx, ly] of lips) {
      const r = H(lx, ly, 60);
      if (r > 0.14) continue;
      if (r < 0.06) grassTuft(pix, lx, ly, { row: leaf, h: 5 + H(lx, 1, 61) * 6, n: 6, seed: lx * 3 + ly, lean: 0.35 });
      else if (r < 0.09) fern(pix, lx, ly + 1, { row: leaf, size: 8 + H(lx, 2, 61) * 7, seed: lx + ly, fronds: 5 });
      else vine(pix, lx, ly + 1, { row: leaf, len: 8 + Math.round(H(lx, 3, 61) * 22), seed: lx, solid: (x, y) => pix.solid(x, y) });
    }
    // flagstones: a course of flat dressed slabs laid in the path, each with a lit top and worn middle
    const slabs = (spans: [number, number][], course: number, seed: number): void => {
      for (const [a, b] of spans) {
        let x = X(a);
        let k = 0;
        while (x < X(b)) {
          const len = Math.min(X(b) - x, 22 + Math.round(H(k, 1, seed) * 18));
          const tone = (H(k, 2, seed) - 0.5) * 0.12;
          for (let dx = 0; dx < len; dx++)
            for (let d = 0; d < course; d++) {
              let sh = 0.54 + tone - d * 0.02;
              if (d === 0) sh = 0.88 - (Math.abs(dx - len / 2) < len * 0.3 ? 0.06 : 0);
              else if (d === 1) sh = 0.66;
              if (dx === 0) sh = 0.14;
              else if (dx === len - 1) sh += 0.08;
              if (d === course - 1) sh = 0.14;
              pix.set(x + dx, gy + d, sh, ashlar);
            }
          // grass creeping between slabs
          if (H(k, 3, seed) < 0.5) grassTuft(pix, x, gy, { row: leaf, h: 4 + H(k, 4, seed) * 4, n: 3, seed: seed + k, spread: 1 });
          x += len;
          k++;
        }
      }
    };
    if (s.paved) slabs(s.paved, 8, 61);
    if (s.plinth) slabs(s.plinth, 14, 62);

    // behind the yard: a low grassy bank closing the shelf off from the lake, shrubs on it, the
    // shrine's dry-stone wall, two firs
    const back = new Pix(W + 2 * EDGE, VH + 4);
    const by = gy - 2;
    const bankTop = (x: number): number => {
      const open = inSpan(x, s.open);
      const hgt = open ? 6 + fbm1(x / 9, 63, 2) * 6 : 14 + Math.round(fbm1(x / 40, 63, 3) * 30) + Math.round(fbm1(x / 9, 64, 2) * 8);
      return by - hgt;
    };
    for (let x = 0; x < back.w; x++) {
      const t = Math.round(bankTop(x));
      for (let y = t; y < by + 8; y++) {
        const d = y - t;
        const sh = d === 0 ? 0.64 : d < 3 ? 0.5 : 0.34 - Math.min(0.14, d * 0.006) + (H(x >> 1, y >> 1, 65) - 0.5) * 0.1;
        back.set(x, y, sh, leaf, 0.12);
      }
      if (H(x, 1, 66) < 0.3) for (let k = 1; k < 2 + H(x, 2, 66) * 6; k++) back.set(x, t - k, 0.56 + k * 0.03, leaf, 0.12);
    }
    for (let k = 0; k < 16; k++) {
      const x = Math.round(30 + H(k, 1, 67) * (back.w - 60));
      if (inSpan(x, s.open)) continue;
      const t = bankTop(x) + 4;
      if (H(k, 2, 67) < 0.6) bush(back, x, t, { row: leaf, w: 24 + H(k, 3, 67) * 26, h: 12 + H(k, 4, 67) * 14, seed: 70 + k, fog: 0.12 });
      else fern(back, x, t, { row: leaf, size: 13 + H(k, 5, 67) * 8, seed: 90 + k, fronds: 6, fog: 0.12 });
    }
    for (const [fx, fh] of s.firs ?? []) fir(back, X(fx), bankTop(X(fx)) + 6, { row: leaf, bark: row("bark"), h: fh, seed: fx, fog: 0.1 });
    // the shrine's wall: dry-laid stones, a capstone course, moss and a fern in its joints
    if (s.wall) {
      const [a, b, wh] = s.wall;
      const x0 = X(a), x1 = X(b), wy0 = gy - wh;
      let course = 0;
      for (let y = wy0; y < gy; course++) {
        const ch = course === 0 ? 7 : 8 + Math.round(H(course, 1, 68) * 4);
        let x = x0 - (course % 2) * 6;
        let k = 0;
        while (x < x1) {
          const len = 12 + Math.round(H(k, course, 68) * 16);
          const tone = (H(k, course + 9, 68) - 0.5) * 0.14;
          for (let dx = 0; dx < len; dx++) {
            const xx = x + dx;
            if (xx < x0 || xx >= x1) continue;
            for (let d = 0; d < ch && y + d < gy; d++) {
              let sh = 0.46 + tone - d * 0.015;
              if (d === 0) sh = course === 0 ? 0.84 : 0.62;
              if (dx === 0 || d === ch - 1) sh = 0.12;
              else if (dx === len - 1) sh += 0.08;
              // the wall's ends are rough
              if ((xx - x0 < 2 || x1 - xx < 2) && H(xx, y + d, 69) < 0.4) continue;
              back.set(xx, y + d, sh, ashlar);
            }
          }
          x += len;
          k++;
        }
        y += ch;
      }
      for (let x = x0; x < x1; x++) if (H(x, 2, 70) < 0.3) back.set(x, wy0 - 1, 0.5, moss);
      fern(back, x1 - 6, gy - 4, { row: leaf, size: 14, seed: 71, fronds: 5 });
      grassTuft(back, x0 + 4, gy, { row: leaf, h: 10, n: 6, seed: 72, lean: 0.3 });
    }

    // foreground: dark grass with lit tips and a fern in the bottom corners
    const fore = new Pix(W + 2 * EDGE, VH + 4);
    const near = row("near");
    for (let k = 0; k < 40; k++) {
      const left = k < 20;
      const x = X(left ? -60 + k * 9 : 1180 + (k - 20) * 9) + Math.round(H(k, 1, 73) * 6);
      const fall = left ? 1 - k / 22 : (k - 18) / 22;
      grassTuft(fore, x, VH + 3, { row: leaf, h: 30 + H(k, 2, 73) * 50 * fall + 20 * fall, n: 5, seed: 500 + k, lean: left ? 0.5 : -0.5, spread: 4 });
    }
    // darken the bodies of the foreground blades: only their tips catch the light
    for (let y = 0; y < fore.h; y++) for (let x = 0; x < fore.w; x++) if (fore.solid(x, y) && fore.solid(x, y - 1)) fore.setShade(x, y, fore.shadeAt(x, y) * 0.4);
    fern(fore, X(1290), VH - 6, { row: near, size: 46, seed: 7, fronds: 7 });

    return [
      { kind: "pix", name: "yard-back", depth: 1.06, pix: back, x: -EDGE, y: 0, dither: 0.1 },
      { kind: "pix", name: "shelf-ground", depth: 1, pix, x: -EDGE, y: 0, dither: 0.1 },
      { kind: "pix", name: "yard-fore", depth: 0.8, pix: fore, x: -EDGE, y: 0, dither: 0 },
    ];
  };
}
