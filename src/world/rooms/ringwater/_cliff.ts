// The cliff stair's rock and steps (A2) and the yard's ground (A4), drawn with
// the arrival scene's own palette so they sit in the lake's light and mirror in
// it. Region lane a, round 1: the rock is bedded and jointed (_rock.ts), not a
// field of cobbles; the stair is cut stone laid on it in courses; plants root
// on ledges, in joints and at the waterline; a windswept pine on the landing
// and dark foreground growth frame the climb.
//
// The room's collision is the same geometry (terrain pieces with art "none").
// Every layer runs EDGE px past the design view on each side: the world's frame
// is wider than it (config.ts FRAME), so the rock and the yard continue there.

import { Pix } from "../../../scenes/engine/pix.ts";
import { fbm1, hashInt } from "../../../scenes/engine/noise.ts";
import type { BuildCtx, LayerDef } from "../../../scenes/engine/types.ts";
import type { Geo } from "../../../scenes/scenes/arrival.ts";
import { bush, fern, grassTuft, paintStair, paintStrata, vine, windPine } from "../../../scenes/scenes/arrival/near.ts";

/** How far the layers continue past the design view's sides (px). */
const EDGE = 200;

export interface CliffSpec {
  /** Room px -> screen px (the room is narrower than the view and locked). */
  ox: number;
  /** Walkable tops, room px: [x0, x1, y] (the foot, each step, the landing, the shelf). */
  tops: [number, number, number][];
  /** Room px: the stair's steps (lit treads and risers). */
  steps: [number, number, number][];
  /** Room y of the water under the player plane. */
  water: number;
  /** The boardwalk's end at the left: room x1 and y. */
  boardwalk: [number, number];
  /** The landing (room px): x0, x1, y. */
  landing: [number, number, number];
  /** The shelf's left end (room x) and the lodge's wall (room x, where its footing starts). */
  shelf: [number, number];
}

const H = (a: number, b: number, s: number): number => hashInt(Math.floor(a), Math.floor(b), s);

export function cliffStair(s: CliffSpec): (ctx: BuildCtx, g: Geo, row: (n: string) => number) => LayerDef[] {
  return (ctx, g, row) => {
    const { W, H: VH } = ctx;
    const pix = new Pix(W + 2 * EDGE, VH + 4);
    const X = (x: number): number => Math.round(x + s.ox + EDGE);
    const tops = s.tops.map(([a, b, y]) => [X(a), X(b), y] as const);
    const [f0, f1, fy] = tops[0]!;
    // the rock's face drops into the water just left of the foot, in two stepped shoulders
    const faceW = 46;
    const top = (x: number): number => {
      let best = 1e9;
      for (const [a, b, y] of tops) if (x >= a && x < b) best = Math.min(best, y);
      if (x < f0 && x > f0 - faceW) {
        const t = (f0 - x) / faceW;
        const step = t < 0.4 ? 3 : t < 0.75 ? 10 : 18;
        best = Math.min(best, fy + step + Math.round(t ** 1.6 * (s.water - fy + 8)) + Math.round((fbm1(x / 5, 61, 2) - 0.5) * 4));
      }
      return best;
    };
    const crag = row("crag"), ashlar = row("ashlar"), leaf = row("leaf"), earth = row("earth"), moss = row("moss");
    const stepX = s.steps.map(([a, b, y]) => [X(a), X(b), y] as [number, number, number]);
    const band = 46;
    const stairTop = (x: number): number => {
      for (const [a, b, y] of stepX) if (x >= a && x < b) return y;
      return 1e9;
    };
    const [lx0, lx1, ly] = [X(s.landing[0]), X(s.landing[1]), s.landing[2]];
    const shelfX = X(s.shelf[0]);
    // big planes: the sky lights the top of the mass, the sun (up right) its right-facing
    // shoulders; under the landing and the shelf the rock sits back in shadow; the flank
    // into the water turns away from the sun
    const plane = (x: number, y: number): number => {
      const d = y - top(x);
      let p = d < 10 ? 0.06 : 0;
      if (x < f0) p -= 0.1;
      // the overhang under the landing's lip and under the shelf
      if (x >= lx0 - 6 && x < lx1 + 4 && y > ly + 18 && y < ly + 46) p -= 0.08;
      // a lit buttress running down under the second flight
      const bx = X(s.landing[1]) + 70 + (y - ly) * 0.35;
      if (Math.abs(x - bx) < 26 && y > ly) p += x > bx ? 0.08 : -0.04;
      return p;
    };
    const lips = paintStrata(pix, {
      top: (x) => {
        const st = stairTop(x);
        // under the stair the rock begins below its masonry band
        return st < 1e8 ? st + band : top(x);
      },
      bottom: () => VH + 4,
      row: crag,
      seed: 91,
      bed: [20, 46],
      joint: [70, 190],
      dip: -0.08,
      base: 0.5,
      dark: 0.26,
      deep: 260,
      plane,
      moss,
    });
    // the stair: cut stone in courses, a lit tread on every step
    paintStair(pix, stepX, { row: ashlar, seed: 33, band, moss: leaf });
    // where the masonry band meets the rock: a shadow seam
    for (const [a, b, y] of stepX) for (let x = a; x < b; x++) pix.set(x, y + band, 0.08, crag);

    // grass caps: the landing, the shelf, the foot (a thin mossy one), hanging over the drops
    const cap = (a: number, b: number, y: number, depth: number, hang: boolean): void => {
      for (let x = a; x < b; x++) {
        const cd = Math.max(2, Math.round(depth * (0.6 + 0.8 * fbm1(x / 7, 71, 2))));
        // soil under the grass, then the grass band: lit tips, a dark root line
        for (let d = 0; d < cd + 2; d++) {
          const sh = d === 0 ? 0.78 : d === 1 ? 0.62 : d < cd ? 0.46 - (d / cd) * 0.14 + (H(x >> 1, d, 72) - 0.5) * 0.1 : 0.2;
          pix.set(x, y + d, sh, d < cd ? leaf : earth);
        }
        if (hang && (x - a < 5 || b - x < 3)) {
          const len = 4 + Math.round(H(x, 3, 73) * 10);
          for (let k = cd; k < cd + len; k++) pix.set(x, y + k, 0.42 - (k / (cd + len)) * 0.22, leaf);
        }
      }
    };
    cap(lx0, lx1, ly, 4, true);
    const [sx0, , sy] = [shelfX, 0, tops[tops.length - 1]![2]];
    cap(sx0, pix.w, sy, 5, false);
    cap(f0 + 2, f1 - 6, fy, 2, false);

    // plants: rooted on surfaces only
    const tuft = (x: number, h: number, seed: number, n = 7, lean = 0.3): void => {
      const y = top(Math.round(x));
      if (y < 1e8) grassTuft(pix, Math.round(x), y, { row: leaf, h, n, seed, lean });
    };
    // the landing: a bush at its back left, ferns where the second flight starts, grass
    bush(pix, lx0 + 14, ly, { row: leaf, w: 30, h: 17, seed: 5 });
    fern(pix, lx1 - 8, ly, { row: leaf, size: 15, seed: 7, fronds: 6 });
    for (let k = 0; k < 6; k++) tuft(lx0 + 30 + k * 11 + H(k, 1, 8) * 6, 7 + H(k, 2, 8) * 5, 80 + k);
    // the shelf: tall grass and flowers along the lodge's footing, a fern at the stair's head
    fern(pix, shelfX + 10, sy, { row: leaf, size: 13, seed: 11, fronds: 5 });
    for (let x = shelfX + 22; x < pix.w; x += 9 + H(x, 1, 12) * 8) {
      tuft(x, 8 + H(x, 2, 12) * 7, 120 + x);
      if (H(x, 3, 12) < 0.35) pix.set(Math.round(x) + 1, sy - 6 - Math.round(H(x, 4, 12) * 5), 0.8, row("petal"));
    }
    // the foot: reeds and grass where the rock meets the water and the boardwalk
    for (let k = 0; k < 4; k++) tuft(f0 + 8 + k * 14 + H(k, 5, 13) * 6, 6 + H(k, 6, 13) * 6, 140 + k, 6, -0.2);
    // ferns and grass out of joints on the face, near the stair's band
    for (const [k, [a, b, y]] of stepX.entries()) {
      if (H(k, 1, 14) > 0.3) continue;
      const x = Math.round(a + (b - a) * H(k, 2, 14));
      const yy = y + band + 2;
      if (H(k, 3, 14) < 0.5) fern(pix, x, yy + 6, { row: leaf, size: 9 + H(k, 4, 14) * 5, seed: 200 + k, fronds: 4 });
      else grassTuft(pix, x, yy + 4, { row: leaf, h: 7, n: 5, seed: 220 + k, lean: 0.4 });
    }
    // growth on the lips of beds that step out of the face: grass, ferns, a few trailing strands
    for (const [lxp, lyp] of lips) {
      const r = H(lxp, lyp, 16);
      if (r > 0.15) continue;
      if (r < 0.06) grassTuft(pix, lxp, lyp, { row: leaf, h: 6 + H(lxp, 1, 17) * 8, n: 8, seed: lxp * 7 + lyp, lean: 0.35 });
      else if (r < 0.085) fern(pix, lxp, lyp + 1, { row: leaf, size: 10 + H(lxp, 2, 17) * 9, seed: lxp + lyp, fronds: 6 });
      else if (r < 0.11) vine(pix, lxp, lyp + 1, { row: leaf, len: 10 + Math.round(H(lxp, 3, 17) * 24), seed: lxp, solid: (x, y) => pix.solid(x, y) });
      else grassTuft(pix, lxp, lyp, { row: moss, h: 3, n: 4, seed: lxp + 3 * lyp, spread: 2 });
    }
    // vines hanging from the landing's lip and the shelf's edge, lying on the face
    const solid = (x: number, y: number): boolean => pix.solid(x, y);
    for (let k = 0; k < 7; k++) vine(pix, lx0 + 6 + k * 13 + Math.round(H(k, 1, 15) * 6), ly + 5, { row: leaf, len: 30 + Math.round(H(k, 2, 15) * 46), seed: k * 3 + 1, solid });
    for (let k = 0; k < 4; k++) vine(pix, shelfX + 4 + k * 9, sy + 6, { row: leaf, len: 24 + Math.round(H(k, 3, 15) * 30), seed: k * 5 + 2, solid });
    // the waterline: a wet dark band on the rock and a thin lit lip of water against it
    for (let x = 0; x < f0; x++) {
      if (!pix.solid(x, s.water - 1)) continue;
      for (let y = s.water - 5; y < s.water; y++) if (pix.solid(x, y)) pix.set(x, y, 0.1, crag);
    }

    // the dock's old boardwalk, ending at the rock (thicker, as in A1)
    const wood = row("wood");
    const [bx1, by] = s.boardwalk;
    const th = Math.max(4, Math.round(g.P * 0.1));
    for (let x = 0; x < X(bx1); x++) {
      const b = Math.floor((x + 4096) / Math.max(4, Math.round(g.P * 0.1)));
      for (let y = by; y < by + th; y++) {
        const dy = y - by;
        pix.set(x, y, dy === 0 ? (H(b, 2, 17) < 0.2 ? 0.46 : 0.62) : dy === 1 ? 0.4 : 0.24 - dy * 0.02 - ((x + 4096) % 8 === 0 ? 0.08 : 0), wood);
      }
      for (let k = 0; k < 2; k++) pix.set(x, by + th + k, 0.08, wood);
      // the red line runs on to the rock
      if (H(Math.floor(x / 3), 11, 17) > 0.08) pix.set(x, by, 0.72, row("red"));
    }
    for (let px = Math.round(g.P * 0.3); px < X(bx1); px += Math.round(g.P * 0.9))
      for (let y = by + th; y <= s.water + 1; y++) for (let k = 0; k < 6; k++) pix.set(px + k, y, k === 0 ? 0.3 : y > s.water - 4 ? 0.06 : 0.13, wood);

    // a windswept pine on the landing, leaning out over the water: the climb's one vertical
    const bent = new Pix(W + 2 * EDGE, VH + 4);
    windPine(bent, lx0 + 8, ly + 1, { row: leaf, bark: row("bark"), h: 168, lean: -46, seed: 3 });
    // foreground: dark growth at the bottom corners, in front of the player plane (never over her path)
    const fore = new Pix(W + 2 * EDGE, VH + 4);
    const near = row("near");
    // bottom right: an overhang of rock and ferns under the shelf
    for (let x = X(s.shelf[0] + 40); x < fore.w; x++) {
      const t = (x - X(s.shelf[0] + 40)) / 140;
      const yTop = Math.round(VH - Math.min(1, t) ** 0.7 * 120 - (fbm1(x / 11, 81, 3) - 0.5) * 22);
      for (let y = yTop; y < fore.h; y++) fore.set(x, y, y - yTop < 2 ? 0.42 : 0.12 + (H(x >> 2, y >> 2, 82) - 0.5) * 0.05, near);
    }
    for (let k = 0; k < 5; k++) {
      const x = X(s.shelf[0] + 70 + k * 34);
      const y = Math.round(VH - Math.min(1, (x - X(s.shelf[0] + 40)) / 140) ** 0.7 * 120) + 4;
      fern(fore, x, y, { row: near, size: 26 + H(k, 1, 83) * 14, seed: 300 + k, fronds: 6 });
    }
    // bottom left: reeds standing in the water, well left of the foot
    for (let k = 0; k < 26; k++) {
      const x = X(-170 + k * 5 + H(k, 1, 84) * 5);
      grassTuft(fore, x, VH + 2, { row: near, h: 50 + H(k, 2, 84) * 70 * (1 - k / 34), n: 4, seed: 400 + k, lean: -0.25, spread: 2 });
      if (k % 5 === 2) for (let j = 0; j < 7; j++) fore.set(x + (j > 3 ? 1 : 0), VH + 2 - 50 - Math.round(H(k, 2, 84) * 40) - j, 0.3, near);
    }

    return [
      { kind: "pix", name: "cliff-stair", depth: 1, pix, x: -EDGE, y: 0, reflect: s.water, reflectFade: 40, dither: 0.12 },
      { kind: "pix", name: "landing-pine", depth: 1, pix: bent, x: -EDGE, y: 0, reflect: s.water, reflectFade: 50, dither: 0.1 },
      { kind: "pix", name: "cliff-fore", depth: 0.8, pix: fore, x: -EDGE, y: 0, dither: 0 },
    ];
  };
}

/** The yard's ground on the cliff shelf (A4): see yardGround in _yard.ts. */
export { yardGround as shelfGround } from "./_yard.ts";
