// A chapel wall for the sandbox room (and a starting point for wall recipes):
// ashlar courses, engaged columns with capitals, a plinth course and a
// cornice. Background layer, pushed back with a little fog. Origin: the
// wall's bottom-left on the floor line.

import { defineRecipe } from "../prop.ts";

export interface WallParams {
  width: number;
  /** Height in H. */
  height: number;
  /** Column positions as fractions of the width. */
  columns: number[];
  /** Openings to leave (px, prop-local x centre, width, bottom height above the floor, top height). */
  openings: [number, number, number, number][];
}

export const wall = defineRecipe<WallParams, null>({
  id: "wall",
  breakage: "never",
  reason: "The room's back wall: it gives the space a scale (courses, columns) and something for windows and plaques to sit in.",
  defaults: { width: 1280, height: 7.4, columns: [0.07, 0.35, 0.65, 0.93], openings: [] },
  build(b, p) {
    const W = Math.ceil(p.width), Hh = b.u(p.height);
    const w = b.part("wall", { w: W, h: Hh, pivot: [0, Hh], at: [0, 0], layer: "bg", hittable: false, outline: 0, z: 0, fog: [0.035, 0.03, 0.055, 0.42] });
    w.bricks(0, 0, W, Hh, { bw: b.u(1.35), bh: b.u(0.5), mat: "stone", mortar: "mortar", seed: p.seed + 1, bevel: 2, jitter: 0.3, tones: [0, -1, 0, -1, -1] });
    w.speckle({ amount: 0.06, seed: p.seed + 2, tone: -1, scale: 4 });
    // plinth course
    const ph = b.u(0.42);
    w.rect(0, Hh - ph, W, ph, { mat: "stoneDark", profile: "bevel", r: 3, depth: 4, z: 3, piece: "plinth" });
    w.rect(0, Hh - ph, W, 2, { mat: "stoneDark", mode: "paint", tone: 1 });
    // cornice
    w.rect(0, 0, W, b.u(0.22), { mat: "stoneDark", profile: "bevel", r: 3, depth: 4, z: 4, piece: "cornice" });
    // engaged columns
    const cw = b.u(0.5);
    for (const f of p.columns) {
      const cx = Math.round(f * W);
      w.rect(cx - cw / 2, b.u(0.22), cw, Hh - b.u(0.22) - ph, { mat: "stoneLight", profile: "cylV", z: 3, piece: "column", tone: -1 });
      // flutes
      for (let k = -1; k <= 1; k++) w.rect(cx + k * Math.round(cw / 4) - 1, b.u(0.5), 2, Hh - b.u(0.5) - ph - b.u(0.3), { mat: "stoneLight", mode: "paint", tone: -2 });
      // capital and base
      w.rect(cx - cw * 0.75, b.u(0.22), cw * 1.5, b.u(0.22), { mat: "stoneLight", profile: "bevel", r: 3, depth: 5, z: 6, piece: "capital" });
      w.rect(cx - cw * 0.7, Hh - ph - b.u(0.16), cw * 1.4, b.u(0.16), { mat: "stoneLight", profile: "bevel", r: 2, depth: 5, z: 6, piece: "capital" });
    }
    // openings (window recesses): deep shadowed niches
    for (const [ox, ow, bot, top] of p.openings) {
      w.arch(ox - ow / 2, Hh - b.u(top), ow, b.u(top - bot), { mat: "stoneDark", profile: "sunk", r: 6, depth: 4, z: 3, tone: -1, piece: "niche" });
    }
    return null;
  },
  initial: "idle",
  states: { idle: {} },
});
