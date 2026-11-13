// The destructible floor: flagstones that take craters (Q, R, heavy hits)
// and slash scars, throw real debris, and heal: the pixels reassemble from
// the bottom up so a room resets. Origin: left end of the walking surface.

import { crater, scar } from "../break.ts";
import type { Hit } from "../hits.ts";
import { defineRecipe } from "../prop.ts";

export interface FloorParams {
  /** Length in px (world). */
  width: number;
  /** Depth below the surface, in H. */
  depth: number;
  /** Stone: "stone" | "stoneLight" | "marble". */
  stone: string;
}

function craterPoint(hit: Hit): [number, number] | null {
  const s = hit.shape;
  if (s.kind === "circle" || s.kind === "point") return [s.x, s.y];
  if (s.kind === "rect") return [s.x + s.w / 2, s.y + s.h];
  if (s.kind === "arc") return [s.x, s.y];
  if (s.kind === "line") return [s.x1, s.y1];
  return null;
}

export const floor = defineRecipe<FloorParams, { head: number }>({
  id: "floor",
  reason: "The ground every room stands on; it shows the weight of her hits (craters, scars) and heals so rooms reset.",
  defaults: { width: 1280, depth: 1.5, stone: "stone" },
  build(b, p) {
    const head = 10; // rows above the surface for crater rims and rubble
    const depth = b.u(p.depth);
    const W = Math.ceil(p.width);
    const f = b.part("floor", { w: W, h: head + depth, pivot: [0, head], at: [0, 0], layer: "mid", collide: "solid", ground: true, z: -5 });
    // flagstone face: big blocks in two courses, darker going down
    const bh = b.u(0.3);
    f.bricks(0, head + 3, W, depth - 3, { bw: b.u(1.05), bh, mat: p.stone, mortar: "mortar", seed: p.seed + 3, bevel: 2, jitter: 0.35, tones: [0, 0, -1, 0, 1] });
    // deeper courses in the darker stone
    f.bricks(0, head + 3 + bh * 2, W, depth - bh * 2 - 3, { bw: b.u(1.4), bh: b.u(0.36), mat: "stoneDark", mortar: "mortar", seed: p.seed + 9, bevel: 2, jitter: 0.3, tones: [0, 1, 0] });
    // the walking surface: a worn lip, lit along its top edge
    f.rect(0, head, W, 4, { mat: p.stone, profile: "bevel", r: 2, depth: 3, z: 2, tone: 0, piece: "lip" });
    f.rect(0, head, W, 1, { mat: p.stone, mode: "paint", tone: 1 });
    f.speckle({ amount: 0.1, seed: p.seed + 5, tone: -1, scale: 2 });
    f.speckle({ amount: 0.04, seed: p.seed + 8, tone: 1 });
    // old cracks and chips
    for (let k = 0; k < Math.max(2, W / 260); k++) {
      const x = Math.floor(b.rand() * W);
      f.cracks(x, head + 4 + Math.floor(b.rand() * depth * 0.4), { n: 2, len: 8 + Math.floor(b.rand() * 14), seed: p.seed + k * 13, dir: Math.PI / 2 });
    }
    f.wear({ amount: 0.08 + p.wear * 0.2, seed: p.seed + 4, region: { x0: 0, y0: head, x1: W - 1, y1: head + 1 } });
    return { head };
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        const part = c.part("floor");
        const hit = h.hit;
        if (hit.crater) {
          const at = craterPoint(hit);
          if (at) crater(c.world, part, at[0], at[1], hit.crater.rx, hit.crater.ry, hit.crater.rim, hit);
        }
        if (hit.scar) scar(c.world, part, hit);
      },
    },
  },
});
