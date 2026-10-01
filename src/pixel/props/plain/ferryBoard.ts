// The ferry board (lane reg-b, B1): the landing's old notice board on the
// boardwalk, where the ferry's times were painted. A board under a little
// gable roof on two square posts, the posts shod in iron and bolted to the
// deck, the paint weathered off so the times are gone (ghost rules where the
// letters were, never words), a hook under the eave where a lamp once hung.
// It stands; slashes splinter the wood and it mends. Origin: the deck at the
// board's centre.

import { defineRecipe } from "../../prop.ts";
import "./materials.ts";

export interface FerryBoardParams {
  /** Board width and the posts' height, in H. */
  w: number;
  h: number;
}

export const ferryBoard = defineRecipe<FerryBoardParams, Record<string, never>>({
  id: "ferryBoard",
  breakage: "heal",
  reason: "The ferry's notice board at the landing, its times worn away: the boat this water once had, and no longer does.",
  defaults: { w: 1.25, h: 1.62 },
  cues: ["wood.hit", "wood.break"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.w), Ht = u(p.h);
    const pw = u(0.1);
    const roofH = u(0.2);
    const G = W + u(0.3);
    const part = b.part("board", { w: G, h: Ht + roofH, pivot: [G >> 1, Ht + roofH], at: [0, 0], layer: "bg", z: 3 });
    const x0 = u(0.15);
    // the posts, square timbers with a lit west face, shod in iron at the deck
    for (const px of [x0, x0 + W - pw]) {
      part.rect(px, roofH - u(0.02), pw, Ht + u(0.02), { mat: "plainWood", profile: "bevel", r: 1 });
      part.grain({ dir: "v", seed: p.seed + px, tone: -1, density: 0.3, stretch: 14, region: { x0: px, y0: roofH, x1: px + pw - 1, y1: roofH + Ht - 1 } });
      part.rect(px - 1, roofH + Ht - u(0.12), pw + 2, u(0.12), { mat: "plainIron", profile: "bevel", r: 1, z: 1 });
      part.rivets([[px + (pw >> 1), roofH + Ht - u(0.06)]], { mat: "plainIron", r: 1 });
    }
    // the board: planks set between the posts, a frame, the weathered face
    const by = roofH + u(0.16), bh = u(0.62);
    part.rect(x0 + pw, by, W - pw * 2, bh, { mat: "plainWoodDark", profile: "bevel", r: 1, z: 1 });
    part.rect(x0 + pw + 2, by + 2, W - pw * 2 - 4, bh - 4, { mat: "plainSignFace", profile: "flat", z: 1, tone: -1 });
    // ghost rules where the times were painted, broken where the paint came off (no words)
    for (let k = 0; k < 4; k++) {
      const y = by + 6 + k * Math.round((bh - 12) / 4);
      for (let x = x0 + pw + 6; x < x0 + W - pw - 6; x++) if ((x * 7 + k * 13 + p.seed) % 11 > 3) part.rect(x, y, 1, 1, { mat: "plainSignFace", mode: "paint", tone: -1 });
    }
    // the paint has flaked off in patches: the grey boards show through, grain running across them
    for (let k = 0; k < 9; k++) {
      const fx = x0 + pw + 4 + ((p.seed * 37 + k * 53) % Math.max(1, W - pw * 2 - 18));
      const fy = by + 4 + ((p.seed * 11 + k * 29) % Math.max(1, bh - 12));
      part.ellipse(fx, fy, 3 + ((k * 7) % 6), 2 + ((k * 5) % 3), { mat: "plainWood", mode: "paint", tone: (k % 3) - 1 });
    }
    part.grain({ dir: "h", seed: p.seed + 3, tone: -1, density: 0.22, stretch: 12, region: { x0: x0 + pw + 2, y0: by + 2, x1: x0 + W - pw - 3, y1: by + bh - 3 } });
    // weathering runs down from the top edge under the roof
    part.grain({ dir: "v", seed: p.seed + 6, tone: -1, density: 0.18, stretch: 6, region: { x0: x0 + pw + 2, y0: by + 2, x1: x0 + W - pw - 3, y1: by + 9 } });
    part.wear({ amount: 0.25, seed: p.seed + 4, region: { x0: x0 + pw, y0: by, x1: x0 + W - pw - 1, y1: by + bh - 1 } });
    // the plank seams of the board's back showing through where the face has flaked
    part.rect(x0 + pw + 2, by + Math.round(bh / 2), W - pw * 2 - 4, 1, { mat: "plainWoodDark", mode: "paint", tone: -1 });
    // the gable: two boards meeting over the middle, an eave each side, a ridge
    const mid = G >> 1;
    part.poly([0, roofH, mid, 0, G, roofH, G, roofH + u(0.05), mid, u(0.05), 0, roofH + u(0.05)], { mat: "plainWoodDark", profile: "bevel", r: 2, z: 2 });
    part.grain({ dir: "h", seed: p.seed + 5, tone: -1, density: 0.3, stretch: 8, region: { x0: 0, y0: 0, x1: G - 1, y1: roofH + u(0.05) } });
    part.rect(mid - 1, 0, 3, 3, { mat: "plainWood", profile: "dome", r: 1, z: 3 });
    // the empty lamp hook under the eave
    part.rect(x0 + W - pw - u(0.12), roofH + u(0.04), 1, u(0.08), { mat: "plainIron", profile: "flat", z: 2 });
    part.rect(x0 + W - pw - u(0.12) - 1, roofH + u(0.12), 3, 1, { mat: "plainIron", profile: "flat", z: 2 });
    return {};
  },
  initial: "standing",
  states: { standing: {} },
  demo: {
    w: 4,
    script: [
      { label: "the board", wait: 0.5 },
      { label: "slash: splinters", hit: "slash", from: -0.4, face: 1, wait: 1.2 },
      { label: "mends", wait: 8 },
    ],
  },
});
