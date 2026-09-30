// The cliff stair's rock and steps (A2), drawn with the arrival scene's own
// palette and ground helper so they sit in the same light as the lake and
// mirror in it: a spur of dark rock rising out of the water under a stair of
// cut stone steps (lit treads, shadowed risers, worn edges), a landing, and the
// shelf the lodge stands on; the end of the dock's old boardwalk at the left.
// The room's collision is the same geometry (terrain pieces with art "none").
// Both layers run EDGE px past the design view on each side: the world's frame
// is wider than it (config.ts FRAME), so the rock and the yard continue there.

import { Pix } from "../../../scenes/engine/pix.ts";
import { paintGround, paintSteps } from "../../../scenes/engine/ground.ts";
import { hashInt } from "../../../scenes/engine/noise.ts";
import type { BuildCtx, LayerDef } from "../../../scenes/engine/types.ts";
import type { Geo } from "../../../scenes/scenes/arrival.ts";

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
}

export function cliffStair(s: CliffSpec): (ctx: BuildCtx, g: Geo, row: (n: string) => number) => LayerDef[] {
  return (ctx, g, row) => {
    const { W, H } = ctx;
    const u = g.u;
    const pix = new Pix(W + 2 * EDGE, H + 4);
    const X = (x: number): number => Math.round(x + s.ox + EDGE);
    const tops = s.tops.map(([a, b, y]) => [X(a), X(b), y] as const);
    const top = (x: number): number => {
      let best = 1e9;
      for (const [a, b, y] of tops) if (x >= a && x < b) best = Math.min(best, y);
      // the rock's face drops into the water just left of the foot
      const [f0, , fy] = tops[0]!;
      if (x < f0 && x > f0 - 18 * u) best = Math.min(best, fy + Math.round(((f0 - x) / (18 * u)) ** 1.5 * (s.water - fy + 6)));
      return best;
    };
    // the rock: lit facets and cracks (the moon is up and to the left of the climb), a grass cap on
    // the landing and the shelf, hanging over their drops; the steps are cut stone laid on it
    const stepX = s.steps.map(([a, b]) => [X(a), X(b)] as const);
    const onStep = (x: number): boolean => stepX.some(([a, b]) => x >= a - 1 && x < b + 1);
    paintGround(pix, {
      top,
      bottom: () => H + 4,
      rock: { seed: 91, cell: Math.round(13 * u), flatten: 1.9, light: [-0.45, -1], base: 0.4, contrast: 0.5, cracks: 0.3 },
      row: row("cliff"),
      cap: { row: row("moss"), depth: Math.round(3 * u), blades: Math.round(3 * u), where: (x) => !onStep(x) && x > X(s.tops[0]![1]) - 1 },
      dark: 0.3,
      darkDepth: 150 * u,
    });
    paintSteps(pix, s.steps.map(([a, b, y]) => [X(a), X(b), y] as [number, number, number]), { row: row("mid"), riser: Math.max(4, Math.round(g.P * 0.18)), seed: 33, moss: row("moss"), light: -1 });
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
    return [{ kind: "pix", name: "cliff-stair", depth: 1, pix, x: -EDGE, y: 0, reflect: s.water, reflectFade: 40 * u, dither: 0.15 }];
  };
}

/** The yard's ground on the cliff shelf (A4): packed earth under a grassy lip, stones in it. */
export function shelfGround(s: { ox: number; y: number }): (ctx: BuildCtx, g: Geo, row: (n: string) => number) => LayerDef[] {
  return (ctx, g, row) => {
    const { W, H } = ctx;
    const u = g.u;
    const pix = new Pix(W + 2 * EDGE, H + 4);
    // packed earth and bedded rock under a thick grass cap, stones in the soil
    paintGround(pix, {
      top: () => s.y,
      bottom: () => H + 4,
      rock: { seed: 97, cell: Math.round(9 * u), flatten: 2.2, light: [-0.5, -1], base: 0.36, contrast: 0.45 },
      row: row("mid"),
      cap: { row: row("moss"), depth: Math.round(3.5 * u), blades: Math.round(3.5 * u) },
      stones: 0.4,
      dark: 0.3,
      darkDepth: 90 * u,
    });
    return [{ kind: "pix", name: "shelf-ground", depth: 1, pix, x: -EDGE, y: 0, dither: 0.1 }];
  };
}
