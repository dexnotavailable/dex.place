// The bus shelter (lane R-B, B3): a bus stop, displaced from somewhere
// ordinary, standing on the causeway in the middle of the flooded plain. A
// concrete roof slab on two steel posts, a back wall of steel-framed glass
// (two panes cracked long ago) with the stone of the tor behind it, a kerb.
// The roof's collision is the room's (it is where the Stonetop climb starts);
// this is its look. The glass shatters and mends; the steel dents. Origin:
// the floor at the shelter's west end.

import { defineRecipe } from "../../prop.ts";
import "./materials.ts";

export interface ShelterParams {
  /** Width and roof underside height in H. */
  w: number;
  h: number;
}

export const busShelter = defineRecipe<ShelterParams, Record<string, never>>({
  id: "busShelter",
  breakage: "heal",
  reason: "A bus stop on a flooded plain: an ordinary roof in the middle of the vast, the second shrine's shelter, and a little wrong in the Backrooms way.",
  defaults: { w: 8, h: 3.0 },
  cues: ["glass.hit", "glass.break", "metal.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.w), Ht = u(p.h);
    const slab = u(0.3);
    // the roof slab with a drip edge and a gutter
    const roof = b.part("roof", { w: W + u(0.5), h: slab + u(0.12), pivot: [u(0.25), slab + u(0.12)], at: [0, -Ht], layer: "mid", z: 6 });
    roof.rect(0, 0, W + u(0.5), slab, { mat: "plainConcrete", profile: "bevel", r: 2 });
    roof.rect(0, slab - 3, W + u(0.5), 3, { mat: "plainConcrete", mode: "paint", tone: -1 });
    roof.rect(u(0.1), slab, W + u(0.3), u(0.06), { mat: "plainIron", profile: "cylH", z: 1 });
    roof.speckle({ amount: 0.25, seed: p.seed, tone: -1, scale: 2 });
    roof.cracks(Math.round(W * 0.6), 2, { n: 2, len: u(0.4), seed: p.seed + 1 });
    // the back wall: steel frames, glass panes (two cracked), a kerb along the floor
    const back = b.part("back", { w: W, h: Ht, pivot: [0, Ht], at: [0, 0], layer: "bg", z: 2 });
    const panes = 4;
    const pw = Math.floor((W - u(0.12)) / panes);
    for (let i = 0; i < panes; i++) {
      const x = u(0.06) + i * pw;
      back.rect(x, u(0.3), pw, Ht - u(0.62), { mat: "plainPaint", profile: "bevel", r: 1 });
      back.rect(x + u(0.05), u(0.35), pw - u(0.1), Ht - u(0.72), { mat: "plainGlass", profile: "flat", piece: `pane${i}` });
      // grime and the reflection of the sky, in streaks
      back.grain({ dir: "v", seed: p.seed + 11 + i, tone: -1, density: 0.25, stretch: 18, region: { x0: x + u(0.05), y0: u(0.35), x1: x + pw - u(0.05), y1: Ht - u(0.37) } });
      if (i === 1 || i === 3) back.cracks(x + Math.round(pw * 0.6), u(0.9), { n: 4, len: u(0.5), seed: p.seed + i, tone: 2 });
    }
    back.rect(0, Ht - u(0.28), W, u(0.28), { mat: "plainConcrete", profile: "bevel", r: 1, piece: "kerb" });
    // a timetable frame on the back wall: its numbers have worn off (blank rules)
    const tx = u(5.2), ty = u(1.05), tw = u(0.62), th = u(0.8);
    back.rect(tx, ty, tw, th, { mat: "plainPaint", profile: "bevel", r: 1, z: 1, piece: "table" });
    back.rect(tx + 3, ty + 3, tw - 6, th - 6, { mat: "plainSignFace", profile: "flat", z: 1, piece: "table" });
    for (let k = 0; k < 6; k++) back.rect(tx + 5, ty + 7 + k * Math.round((th - 14) / 6), tw - 10, 1, { mat: "plainSignFace", mode: "paint", tone: -1 });
    // the two steel posts at the ends
    const posts = b.part("posts", { w: W + u(0.2), h: Ht, pivot: [u(0.1), Ht], at: [0, 0], layer: "mid", z: 5 });
    for (const x of [u(0.1), W - u(0.02)]) {
      posts.rect(x - u(0.05), 0, u(0.1), Ht, { mat: "plainPaint", profile: "cylV" });
      posts.rect(x - u(0.08), Ht - u(0.06), u(0.16), u(0.06), { mat: "plainIron", profile: "bevel", r: 1 });
    }
    posts.wear({ amount: 0.2, seed: p.seed + 5 });
    return {};
  },
  initial: "standing",
  states: { standing: {} },
  demo: {
    w: 11,
    script: [
      { label: "the shelter", wait: 0.5 },
      { label: "slash the glass: a pane shatters", hit: "slash", from: 2.5, wait: 1.5 },
      { label: "mends", wait: 8 },
    ],
  },
});
