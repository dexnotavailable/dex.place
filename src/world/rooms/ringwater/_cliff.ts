// The cliff stair's rock and steps (A2), drawn with the arrival scene's own
// palette and ground helper so they sit in the same light as the lake and
// mirror in it: a spur of dark rock rising out of the water under a stair of
// cut stone steps (lit treads, shadowed risers, worn edges), a landing, and the
// shelf the lodge stands on; the end of the dock's old boardwalk at the left.
// The room's collision is the same geometry (terrain pieces with art "none").

import { Pix, terrain } from "../../../scenes/engine/pix.ts";
import { hashInt } from "../../../scenes/engine/noise.ts";
import type { BuildCtx, LayerDef } from "../../../scenes/engine/types.ts";
import type { Geo } from "../../../scenes/scenes/arrival.ts";

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
}

export function cliffStair(s: CliffSpec): (ctx: BuildCtx, g: Geo, row: (n: string) => number) => LayerDef[] {
  return (ctx, g, row) => {
    const { W, H } = ctx;
    const u = g.u;
    const pix = new Pix(W, H + 4);
    const X = (x: number): number => Math.round(x + s.ox);
    const tops = s.tops.map(([a, b, y]) => [X(a), X(b), y] as const);
    const top = (x: number): number => {
      let best = 1e9;
      for (const [a, b, y] of tops) if (x >= a && x < b) best = Math.min(best, y);
      // the rock's face drops into the water just left of the foot
      const [f0, , fy] = tops[0]!;
      if (x < f0 && x > f0 - 18 * u) best = Math.min(best, fy + Math.round(((f0 - x) / (18 * u)) ** 1.5 * (s.water - fy + 6)));
      return best;
    };
    const c = Math.max(1, Math.round(1.5 * u));
    terrain(pix, {
      row: row("cliff"),
      top,
      bottom: () => H + 4,
      seed: 91,
      scale: 16 * u,
      chunk: c,
      light: [0.7, -1],
      base: 0.3,
      contrast: 0.55,
      vertical: 0.25,
      strata: 0.4,
      rim: 0.32,
      rimDepth: c * 2,
      ao: 0.35,
    });
    // moss and grass along the lit lips of the landing and the shelf
    const moss = row("moss");
    for (const [a0, b0, y] of s.tops) if (b0 - a0 > g.P * 0.6) for (let x = X(a0); x < X(b0); x++) {
      const n = hashInt(x >> 1, 3, 37);
      for (let k = 2; k < 2 + Math.round(n * 5 * u); k++) pix.set(x, y + k, 0.25 + n * 0.3, moss);
      if (n > 0.8) for (let k = 1; k < Math.round((n - 0.8) * 20); k++) pix.set(x, y - k, 0.5, moss);
    }
    // the steps: a lit tread, a darker riser under the tread's lip, worn corners
    const stone = row("mid");
    for (const [a0, b0, y] of s.steps) {
      const a = X(a0), b = X(b0);
      const riser = Math.max(4, Math.round(g.P * 0.18));
      for (let x = a; x < b; x++) {
        const worn = hashInt(x, y, 31) < 0.12;
        pix.set(x, y, worn ? 0.55 : 0.82, stone);
        pix.set(x, y + 1, 0.5, stone);
        for (let k = 2; k < riser; k++) pix.set(x, y + k, 0.24 - k * 0.012 + (hashInt(x >> 1, y + k, 33) - 0.5) * 0.06, stone);
      }
      // the riser's left edge catches the light off the lake
      for (let k = 0; k < riser; k++) pix.set(a, y + k, 0.45, stone);
    }
    // the landing's and the shelf's edges: a lit lip
    for (const [a0, b0, y] of s.tops) if (b0 - a0 > g.P * 0.6) for (let x = X(a0); x < X(b0); x++) {
      pix.set(x, y, hashInt(x, 7, 35) < 0.15 ? 0.5 : 0.72, stone);
      pix.set(x, y + 1, 0.4, stone);
    }
    // the dock's old boardwalk, ending at the rock
    const wood = row("wood");
    const [bx1, by] = s.boardwalk;
    const th = Math.max(3, Math.round(g.P * 0.07));
    for (let x = 0; x < X(bx1); x++) {
      const b = Math.floor((x + 4096) / Math.max(4, Math.round(g.P * 0.1)));
      for (let y = by; y < by + th; y++) pix.set(x, y, y === by ? (hashInt(b, 2, 17) < 0.2 ? 0.46 : 0.6) : 0.22 - (y - by) * 0.03, wood);
      // the red line runs on to the rock
      if (hashInt(Math.floor(x / 3), 11, 17) > 0.08) pix.set(x, by, 0.72, row("red"));
    }
    for (let px = Math.round(g.P * 0.3); px < X(bx1); px += Math.round(g.P * 0.9)) for (let y = by + th; y <= s.water + 1; y++) for (let k = 0; k < 5; k++) pix.set(px + k, y, k === 0 ? 0.28 : 0.12, wood);
    return [{ kind: "pix", name: "cliff-stair", depth: 1, pix, x: 0, y: 0, reflect: s.water, reflectFade: 40 * u, dither: 0.15 }];
  };
}

/** The yard's ground on the cliff shelf (A4): packed earth under a grassy lip, stones in it. */
export function shelfGround(s: { ox: number; y: number }): (ctx: BuildCtx, g: Geo, row: (n: string) => number) => LayerDef[] {
  return (ctx, g, row) => {
    const { W, H } = ctx;
    const u = g.u;
    const pix = new Pix(W, H + 4);
    const c = Math.max(1, Math.round(1.5 * u));
    terrain(pix, {
      row: row("mid"),
      top: () => s.y + 2,
      bottom: () => H + 4,
      seed: 97,
      scale: 18 * u,
      chunk: c,
      light: [0.7, -1],
      base: 0.3,
      contrast: 0.45,
      strata: 0.5,
      rim: 0.1,
      rimDepth: c,
      ao: 0.45,
    });
    const moss = row("moss");
    for (let x = 0; x < W; x++) {
      const n = hashInt(x >> 1, 5, 41);
      const deep = 3 + Math.round(hashInt(x >> 3, 6, 41) * 5 * u);
      for (let k = 0; k < deep; k++) pix.set(x, s.y + k, k === 0 ? 0.62 : 0.42 - k * 0.03 + n * 0.1, moss);
      if (n > 0.86) for (let k = 1; k < Math.round((n - 0.8) * 22); k++) pix.set(x, s.y - k, 0.55, moss);
      // stones set in the earth
      if (hashInt(x >> 4, 7, 43) > 0.82 && (x & 15) < 9) for (let k = 0; k < 4; k++) pix.set(x, s.y + deep + 6 + k, 0.55 - k * 0.08, row("mid"));
    }
    return [{ kind: "pix", name: "shelf-ground", depth: 1, pix, x: 0, y: 0, dither: 0.1 }];
  };
}
