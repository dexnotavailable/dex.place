// The Hollow's destructible ground: the market's worn flagstones, the lift
// foot's cold tile, the archive's boards. Same behaviour as the kit's floor
// (craters with raised rims on Q, R and heavy hits, slash scars, real debris,
// healing from the bottom up), in the region's own materials and courses.
// The room's terrain carries the collision: the part is ground (craters, debris land on it)
// but not a collider, so the adapter never rescans its cells for a platform top.
// Origin: left end of the walking surface.

import "./materials.ts";
import { crater, scar } from "../../break.ts";
import type { Hit } from "../../hits.ts";
import { defineRecipe } from "../../prop.ts";

export interface HollowFloorParams {
  /** Length in px (world). */
  width: number;
  /** Depth below the surface, in H. */
  depth: number;
  kind: "flagstone" | "tile" | "boards";
}

function craterPoint(hit: Hit): [number, number] | null {
  const s = hit.shape;
  if (s.kind === "circle" || s.kind === "point") return [s.x, s.y];
  if (s.kind === "rect") return [s.x + s.w / 2, s.y + s.h];
  if (s.kind === "arc") return [s.x, s.y];
  if (s.kind === "line") return [s.x1, s.y1];
  return null;
}

export const hollowFloor = defineRecipe<HollowFloorParams, { head: number }>({
  id: "hollowFloor",
  breakage: "floor",
  reason: "The Hollow's ground (the market's worn flagstones, the lift foot's tile, the archive's boards) shows the weight of her hits and heals, so the rooms reset.",
  defaults: { width: 1280, depth: 1.2, kind: "flagstone" },
  build(b, p) {
    const head = 10;
    const depth = b.u(p.depth);
    const W = Math.ceil(p.width);
    const f = b.part("floor", { w: W, h: head + depth, pivot: [0, head], at: [0, 0], layer: "mid", collide: "none", ground: true, z: -5 });
    if (p.kind === "tile") {
      f.bricks(0, head + 3, W, depth - 3, { bw: b.u(0.25), bh: b.u(0.25), mat: "hollowTile", mortar: "soot", seed: p.seed + 3, bevel: 1, jitter: 0, stagger: 0, tones: [0, -1, 0, -1, 0] });
      f.rect(0, head, W, 4, { mat: "hollowTile", profile: "bevel", r: 2, depth: 3, z: 2, piece: "lip" });
      f.rect(0, head, W, 1, { mat: "hollowTile", mode: "paint", tone: 1 });
      f.speckle({ amount: 0.06, seed: p.seed + 5, tone: -1 });
    } else if (p.kind === "boards") {
      f.bricks(0, head + 3, W, depth - 3, { bw: b.u(1.8), bh: b.u(0.12), mat: "woodDark", mortar: "soot", seed: p.seed + 3, bevel: 1, jitter: 0.5, tones: [0, 0, -1, 0] });
      f.rect(0, head, W, 4, { mat: "wood", profile: "bevel", r: 2, depth: 2, z: 2, piece: "lip" });
      f.rect(0, head, W, 1, { mat: "wood", mode: "paint", tone: 1 });
      f.grain({ dir: "h", seed: p.seed + 4, mats: ["woodDark", "wood"], stretch: 22 });
    } else {
      // worn flagstones: a top course of big slabs, smaller rubble courses below going dark
      const bh = b.u(0.26);
      f.bricks(0, head + 3, W, bh, { bw: b.u(0.9), bh, mat: "hollowStone", mortar: "mortar", seed: p.seed + 3, bevel: 2, jitter: 0.4, tones: [0, -1, 0, 0, 1, -1] });
      f.bricks(0, head + 3 + bh, W, depth - bh - 3, { bw: b.u(0.55), bh: b.u(0.2), mat: "hollowStoneDark", mortar: "soot", seed: p.seed + 9, bevel: 1, jitter: 0.45, tones: [0, -1, 0, 1] });
      f.rect(0, head, W, 4, { mat: "hollowStone", profile: "bevel", r: 2, depth: 3, z: 2, piece: "lip" });
      f.rect(0, head, W, 1, { mat: "hollowStone", mode: "paint", tone: 1 });
      f.speckle({ amount: 0.14, seed: p.seed + 5, tone: -1, scale: 2 });
      f.speckle({ amount: 0.03, seed: p.seed + 8, tone: 1 });
      for (let k = 0; k < Math.max(2, W / 200); k++) {
        const x = Math.floor(b.rand() * W);
        f.cracks(x, head + 4 + Math.floor(b.rand() * depth * 0.3), { n: 2, len: 6 + Math.floor(b.rand() * 12), seed: p.seed + k * 13, dir: Math.PI / 2 });
      }
    }
    f.wear({ amount: 0.1 + p.wear * 0.2, seed: p.seed + 4, region: { x0: 0, y0: head, x1: W - 1, y1: head + 1 } });
    // the ground's face falls into shadow with depth (ordered dither, a step at a time), so the lit
    // walking line reads first and the face under it sits back, as in the refs
    {
      const g = f.grid;
      const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      const y0 = head + Math.round(depth * 0.35);
      for (let y = y0; y < head + depth; y++) {
        const t = (y - y0) / Math.max(1, head + depth - y0); // 0..1 down the face
        for (let x = 0; x < W; x++) {
          const i = g.inner(x, y);
          if (i < 0 || !g.mat[i]) continue;
          const th = BAYER[(y & 3) * 4 + (x & 3)]! / 16;
          const steps = t * 2.2;
          const k = Math.floor(steps) + (steps - Math.floor(steps) > th ? 1 : 0);
          if (k > 0) g.tone[i] = Math.max(-3, g.tone[i]! - k);
        }
      }
    }
    return { head };
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        const part = c.part("floor");
        const hit = h.hit;
        if (c.keepsCells) return;
        if (hit.crater) {
          const at = craterPoint(hit);
          if (at) crater(c.world, part, at[0], at[1], hit.crater.rx, hit.crater.ry, hit.crater.rim, hit);
        }
        if (hit.scar) scar(c.world, part, hit);
      },
    },
  },
  demo: {
    w: 6,
    params: { width: 480, kind: "flagstone" },
    script: [
      { label: "flagstones", wait: 0.5 },
      { label: "slash: a scar", hit: "slash", from: -1.5, wait: 1 },
      { label: "Q: a crater and rubble", hit: "q", from: 0.6, wait: 2 },
      { label: "heals from the bottom up", wait: 9 },
    ],
  },
});
