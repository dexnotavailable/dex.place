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
    // the roof: a cast slab with a fascia, a drip groove under its lip, a gutter and its rust run
    const RW = W + u(0.5);
    const roof = b.part("roof", { w: RW, h: slab + u(0.12), pivot: [u(0.25), slab + u(0.12)], at: [0, -Ht], layer: "mid", z: 6 });
    roof.rect(0, 0, RW, slab, { mat: "plainConcrete", profile: "bevel", r: 2 });
    roof.rect(0, 2, RW, 1, { mat: "plainConcrete", mode: "paint", tone: 1 });
    roof.rect(0, slab - 4, RW, 1, { mat: "plainConcrete", mode: "paint", tone: -2 });
    roof.rect(0, slab - 3, RW, 3, { mat: "plainConcrete", mode: "paint", tone: -1 });
    roof.grain({ dir: "v", seed: p.seed + 2, tone: -1, density: 0.2, stretch: 5, region: { x0: 0, y0: 4, x1: RW - 1, y1: slab - 5 } });
    roof.rect(u(0.1), slab, RW - u(0.2), u(0.06), { mat: "plainIron", profile: "cylH", z: 1 });
    roof.cracks(Math.round(RW * 0.62), 3, { n: 2, len: u(0.35), seed: p.seed + 1 });
    for (const rx of [u(0.6), RW - u(0.7)]) roof.rect(rx, slab - 3, 1, 3, { mat: "plainBrass", mode: "paint", tone: -1 });
    // the back wall: steel frames and glass. Glass reads as glass: the white sky reflected in its upper part
    // falling off toward the foot, two diagonal glints across each pane, grime along the bottom rail
    const back = b.part("back", { w: W, h: Ht, pivot: [0, Ht], at: [0, 0], layer: "bg", z: 2 });
    const panes = 4;
    const fr = u(0.06);
    const pw = Math.floor((W - u(0.16)) / panes);
    const gy0 = u(0.32), gy1 = Ht - u(0.36);
    back.rect(0, u(0.26), W, fr, { mat: "plainPaint", profile: "bevel", r: 1 });
    for (let i = 0; i < panes; i++) {
      const x = u(0.08) + i * pw;
      const gx0 = x + fr, gx1 = x + pw - 1;
      back.rect(x, gy0 - fr, fr, gy1 - gy0 + fr * 2, { mat: "plainPaint", profile: "bevel", r: 1 });
      back.rect(gx0, gy0, gx1 - gx0, gy1 - gy0, { mat: "plainGlass", profile: "flat", piece: `pane${i}`, tone: 1 });
      // the reflection falls off down the pane in three steps
      const third = Math.round((gy1 - gy0) / 3);
      back.rect(gx0, gy0 + third, gx1 - gx0, third, { mat: "plainGlass", mode: "paint", tone: 0 });
      back.rect(gx0, gy0 + third * 2, gx1 - gx0, gy1 - gy0 - third * 2, { mat: "plainGlass", mode: "paint", tone: -1 });
      // two glints, steep diagonals
      for (const [g0, gw] of [[0.22, 3], [0.5, 1]] as [number, number][]) {
        for (let y = gy0; y < gy1; y++) {
          const gx = gx0 + Math.round((gx1 - gx0) * g0 + (gy1 - y) * 0.45) - Math.round((gy1 - gy0) * 0.2);
          for (let k = 0; k < gw; k++) if (gx + k >= gx0 && gx + k < gx1) back.rect(gx + k, y, 1, 1, { mat: "plainGlass", mode: "paint", tone: 2 });
        }
      }
      back.grain({ dir: "v", seed: p.seed + 11 + i, tone: -1, density: 0.18, stretch: 7, region: { x0: gx0, y0: gy1 - u(0.22), x1: gx1 - 1, y1: gy1 - 1 } });
      if (i === 1 || i === 3) back.cracks(x + Math.round(pw * 0.62), gy0 + u(0.5), { n: 4, len: u(0.45), seed: p.seed + i, tone: 2 });
    }
    back.rect(W - fr, gy0 - fr, fr, gy1 - gy0 + fr * 2, { mat: "plainPaint", profile: "bevel", r: 1 });
    back.rect(0, gy1, W, fr, { mat: "plainPaint", profile: "bevel", r: 1 });
    // the kerb along the floor under the glass
    back.rect(0, Ht - u(0.3), W, u(0.3), { mat: "plainConcrete", profile: "bevel", r: 1, piece: "kerb" });
    back.rect(0, Ht - u(0.3), W, 1, { mat: "plainConcrete", mode: "paint", tone: 1 });
    back.wear({ amount: 0.2, seed: p.seed + 7, region: { x0: 0, y0: Ht - u(0.3), x1: W - 1, y1: Ht - 1 } });
    // a timetable frame bolted into the glazing bar: its numbers have worn off (blank rules)
    const tx = u(5.2), ty = u(1.05), tw = u(0.62), th = u(0.8);
    back.rect(tx, ty, tw, th, { mat: "plainPaint", profile: "bevel", r: 1, z: 1, piece: "table" });
    back.rect(tx + 3, ty + 3, tw - 6, th - 6, { mat: "plainSignFace", profile: "flat", z: 1, piece: "table" });
    for (let k = 0; k < 6; k++) back.rect(tx + 5, ty + 7 + k * Math.round((th - 14) / 6), tw - 10, 1, { mat: "plainSignFace", mode: "paint", tone: -1 });
    back.rivets([[tx + 2, ty + 2], [tx + tw - 3, ty + 2], [tx + 2, ty + th - 3], [tx + tw - 3, ty + th - 3]], { mat: "plainIron", r: 1 });
    // the two steel columns at the ends: square, painted, the paint gone to rust at the foot, base plates bolted down
    const posts = b.part("posts", { w: W + u(0.24), h: Ht, pivot: [u(0.12), Ht], at: [0, 0], layer: "mid", z: 5 });
    const cw = u(0.11);
    for (const x of [u(0.12), W + u(0.02)]) {
      posts.rect(x - (cw >> 1), 0, cw, Ht, { mat: "plainPaint", profile: "bevel", r: 1 });
      posts.rect(x - (cw >> 1), 0, 1, Ht, { mat: "plainPaint", mode: "paint", tone: 1 });
      posts.grain({ dir: "v", seed: p.seed + x, tone: -1, density: 0.35, stretch: 10, region: { x0: x - (cw >> 1), y0: Ht - u(0.5), x1: x + (cw >> 1) - 1, y1: Ht - u(0.08) } });
      posts.rect(x - (cw >> 1) + 1, Ht - u(0.4), cw - 2, u(0.3), { mat: "plainBrass", mode: "paint", tone: -2 });
      posts.rect(x - u(0.1), Ht - u(0.05), u(0.2), u(0.05), { mat: "plainIron", profile: "bevel", r: 1 });
      posts.rivets([[x - u(0.07), Ht - u(0.025)], [x + u(0.07), Ht - u(0.025)]], { mat: "plainIron", r: 1 });
    }
    posts.wear({ amount: 0.15, seed: p.seed + 5 });
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
