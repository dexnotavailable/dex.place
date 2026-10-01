// Bones of something huge, half buried (lane R-B, B2 x 148..156): a spine
// arching over the causeway and ribs curving down from it into the flats,
// so you walk under the arch. Two broken ribs jut out level from the spine:
// their tops are the one-way platforms of the optional climb (the room's
// collision, at 3.2 H and 4.7 H). Bone chips and cracks and mends. Drawn
// behind the player (the far ribs and the spine) with two short near rib
// tips in front of her at the foot. Origin: the west foot of the arch, on
// the road.

import { defineRecipe } from "../../prop.ts";
import { vnoise } from "../../util.ts";
import "./materials.ts";

export interface RibParams {
  /** Span and peak height of the spine's arch, in H. */
  span: number;
  peak: number;
  /** The level broken ribs: [x from, x to, height] in H relative to the origin (x east, height up). */
  shelves: [number, number, number][];
}

export const ribArch = defineRecipe<RibParams, Record<string, never>>({
  id: "ribArch",
  breakage: "heal",
  reason: "The bones of something huge the road was laid through: a place to walk under and, for those who want it, to climb, and a hint of what the colossi leave behind.",
  defaults: { span: 8.8, peak: 4.9, shelves: [[2.4, 3.8, 1.6], [4.8, 6.2, 3.1]] },
  cues: ["stone.hit", "stone.break"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const Wd = u(p.span), Pk = u(p.peak);
    const gw = Wd + u(0.8), gh = Pk + u(0.9);
    const ox = u(0.2), oy = gh - u(0.1);
    const spine = b.part("spine", { w: gw, h: gh, pivot: [ox, oy], at: [0, 0], layer: "bg", z: 2 });
    // the spine: a thick arch of vertebrae from the west foot to the east foot
    const arc = (t: number): [number, number] => [ox + Wd * t, oy - Pk * Math.sin(Math.PI * Math.pow(t, 0.92)) - u(0.05) * t];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const [x, y] = arc(t);
      const r = u(0.17) * (1.1 - 0.35 * Math.abs(t - 0.45));
      spine.ellipse(x, y, r * 1.05, r * 0.85, { mat: "plainBone", profile: "dome", r: 4, piece: i % 4 === 0 ? "joint" : "bone" });
      // each vertebra's spinous process: a short blade up and back
      if (i % 4 === 2) {
        const [x2, y2] = arc(Math.min(1, t + 0.012));
        const nx = -(y2 - y), ny = x2 - x;
        const l = Math.hypot(nx, ny) || 1;
        spine.stroke([x, y, x + (nx / l) * u(0.32) - u(0.05), y + (ny / l) * u(0.32)], [u(0.06), u(0.025)], { mat: "plainBoneDark", z: -1 });
      }
    }
    // the ribs: curving down from the spine into the ground on the far side (behind the road)
    const ribs = b.part("ribs", { w: gw + u(1.2), h: gh, pivot: [ox + u(0.6), oy], at: [0, 0], layer: "bg", z: 1 });
    for (let k = 0; k < 7; k++) {
      const t = 0.12 + k * 0.125;
      const [sx, sy] = arc(t);
      const len = Math.max(u(0.6), oy - sy);
      const bow = u(0.9) * (k % 2 ? 1 : 0.8) * (t < 0.5 ? -1 : 1);
      const pts: number[] = [];
      for (let j = 0; j <= 10; j++) {
        const s = j / 10;
        pts.push(sx + u(0.6) + bow * Math.sin(Math.PI * s) + (vnoise(k, j * 0.7, p.seed) - 0.5) * 2, sy + len * s);
      }
      ribs.stroke(pts, [u(0.16), u(0.13), u(0.1), u(0.07)], { mat: "plainBoneDark" });
    }
    ribs.speckle({ amount: 0.15, seed: p.seed + 2, tone: -1 });
    // the level broken ribs you can stand on
    const shelves = b.part("shelves", { w: gw, h: gh, pivot: [ox, oy], at: [0, 0], layer: "bg", z: 3 });
    for (const [a, c, hh] of p.shelves) {
      const x0 = ox + u(a), x1 = ox + u(c), y = oy - u(hh);
      shelves.roundRect(x0 - u(0.1), y, x1 - x0 + u(0.2), u(0.16), 5, { mat: "plainBone", profile: "dome", r: 4 });
      // the broken end: a ragged tip
      shelves.poly([x1 + u(0.08), y + 1, x1 + u(0.3), y + u(0.05), x1 + u(0.1), y + u(0.14)], { mat: "plainBone", profile: "bevel" });
      // where it joins the spine it thickens
      shelves.ellipse(x0, y + u(0.08), u(0.14), u(0.12), { mat: "plainBoneDark", profile: "dome", r: 3, z: -1 });
    }
    spine.speckle({ amount: 0.22, seed: p.seed, tone: -1, scale: 2 });
    spine.cracks(Math.round(ox + Wd * 0.4), Math.round(oy - Pk * 0.95), { n: 3, len: u(0.5), seed: p.seed + 3 });
    spine.wear({ amount: 0.2, seed: p.seed + 4 });
    // near rib tips in front of the player, only at the feet of the arch
    // in front of her, but with no parallax of its own: an fg part drifts off its feet as the camera moves
    const near = b.part("near", { w: gw, h: u(1.0), pivot: [ox, u(1.0)], at: [0, 0], layer: "fg", parallax: 1, z: 2 });
    for (const [tx, h] of [[0.15, 0.8], [p.span - 0.25, 0.7]] as [number, number][]) {
      near.stroke([ox + u(tx), u(1.0), ox + u(tx) + u(0.18), u(1.0) - u(h) * 0.6, ox + u(tx) + u(0.05), u(1.0) - u(h)], [u(0.09), u(0.06), u(0.03)], { mat: "plainBoneDark" });
    }
    return {};
  },
  initial: "resting",
  states: { resting: {} },
  demo: {
    w: 11,
    script: [
      { label: "the arch", wait: 0.5 },
      { label: "slash the spine's foot: chips", hit: "slash", from: -0.6, wait: 1.2 },
      { label: "heavy: a chunk off", hit: "heavy", from: 1.5, face: -1, wait: 1.5 },
      { label: "mends", wait: 8 },
    ],
  },
});
