// A flight of the outer climb (lane R-D): two squat machine housings you hop
// up (0.8 H each, single jumps), then 22 standard steps (0.2 H rise, 0.3 H
// tread) on a riveted iron stringer to the next catwalk 6 H up, with a thin
// handrail behind and support posts down to the catwalk below. The room's
// terrain carries the collision; this is the look. Hits dent it and spark;
// nothing comes off (breakage "floor": it is ground, and it mends).
// Origin: the foot of the flight on the catwalk below, where the first
// housing starts; it climbs to the right (flip for a flight that climbs left).
//
// Built from small parts (housings, a stretch of four steps at a time, their
// rail, the posts) so the cells stay few: an open stair is mostly air.

import "./materials.ts";
import { defineRecipe } from "../../prop.ts";

export interface StairParams {
  /** Rise of each machine housing, in H. */
  housing: number;
  steps: number;
  rise: number;
  tread: number;
}

export const spireStair = defineRecipe<StairParams, Record<string, never>>({
  id: "spireStair",
  breakage: "floor",
  reason: "The way up the storm face: machine housings you hop, then a steep iron stair between the catwalks, readable as steps at a glance.",
  defaults: { housing: 0.8, steps: 22, rise: 0.2, tread: 0.3 },
  cues: ["metal.hit"],
  standard: { w: 2.4, h: 1.6, parts: ["housing0", "housing1"], note: "the two 0.8 H housings (single jumps); then 22 steps of 0.2 x 0.3 H to 6 H" },
  demo: {
    w: 12,
    script: [
      { label: "a flight", wait: 0.5 },
      { label: "slash: dents and sparks", hit: "slash", from: -0.6, wait: 1 },
      { label: "heavy on the stringer", hit: "heavy", from: 3.5, wait: 1.5 },
    ],
  },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const hw = u(1.2);
    const n = p.steps;
    const tr = u(p.tread);
    const railH = u(0.85);
    const below = u(0.15);
    // prop-local: x right from the foot, y down (0 = the catwalk's surface)
    const Y = (e: number): number => -Math.round(u(e));
    const e0 = p.housing * 2;
    const stepTop = (i: number): number => Y(e0 + i * p.rise);
    const sx0 = hw * 2;
    // the machine housings
    for (let k = 0; k < 2; k++) {
      const top = Y(p.housing * (k + 1));
      const hh = -top + below;
      const s = b.part(`housing${k}`, { w: hw, h: hh, pivot: [0, 0], at: [k * hw, top], layer: "mid", collide: "none", ground: true, z: -4 });
      s.rect(0, 0, hw, hh, { mat: "spireIron", profile: "bevel", r: 3, depth: 4, z: 3 });
      s.rect(0, 0, hw, 1, { mat: "spireIron", mode: "paint", tone: 1 });
      for (let v = 0; v < 3; v++) s.rect(u(0.2), u(0.2) + v * 5, hw - u(0.4), 2, { mat: "spireIronDark", profile: "sunk", r: 1, depth: 2, z: 3, noInk: true, piece: "vent" });
      s.rect(hw - 2, 3, 1, hh - 3, { mat: "spireIronDark", mode: "paint", tone: -1 });
      s.rivets([[3, 3], [hw - 5, 3], [3, hh - 4], [hw - 5, hh - 4]], { mat: "spireIron", r: 1 });
      if (k === 1) s.pixels([[u(0.9), u(0.18)], [u(0.9) + 1, u(0.18)]], { mat: "lampAmber", mode: "over", z: 5, noInk: true });
      s.speckle({ amount: 0.05, seed: p.seed + k, tone: -1, scale: 2 });
    }
    // the stair, four steps at a time: treads, the closed stringer plate under them, the beam
    const beam = u(0.34);
    const plate = u(0.5);
    for (let k = 0; k * 4 < n; k++) {
      const i0 = k * 4 + 1, i1 = Math.min(n, k * 4 + 4);
      const x0 = sx0 + (i0 - 1) * tr;
      const w = (i1 - i0 + 1) * tr + 1;
      const top = stepTop(i1);
      const bottom = stepTop(i0 - 1) + plate + 6;
      const h = bottom - top;
      const s = b.part(`steps${k}`, { w, h, pivot: [0, 0], at: [x0, top], layer: "mid", collide: "none", ground: true, z: -4 });
      // the stringer plate: from each tread down to a line parallel to the slope
      const slope = (u(p.rise) / tr);
      for (let x = 0; x < w; x++) {
        const i = Math.min(i1, i0 + Math.floor(x / tr));
        const ty = stepTop(i) - top;
        const by = stepTop(i0 - 1) - top + plate - Math.round(x * slope);
        if (by > ty) s.rect(x, ty, 1, by - ty, { mat: "spireIronDark", profile: "flat", z: 1, piece: "side" });
      }
      // the beam, lit, riveted
      const bx0 = 0, by0 = stepTop(i0 - 1) - top + beam, bx1 = w - 1, by1 = by0 - Math.round((w - 1) * slope);
      s.stroke([bx0, by0, bx1, by1], 5, { mat: "spireIron", profile: "cylV", z: 3, piece: "beam" });
      s.rivets([[Math.round(w * 0.3), Math.round(by0 - w * 0.3 * slope)], [Math.round(w * 0.8), Math.round(by0 - w * 0.8 * slope)]], { mat: "spireIron", r: 1, z: 5 });
      // treads with lit noses
      for (let i = i0; i <= i1; i++) {
        const a = (i - i0) * tr, ty = stepTop(i) - top;
        s.rect(a, ty, tr, 4, { mat: "spireIron", profile: "bevel", r: 1, depth: 3, z: 4, piece: `tread${i % 2}` });
        s.pixels([[a, ty], [a + 1, ty]], { mat: "spireIron", mode: "paint", tone: 1 });
      }
      // the handrail behind this stretch: one post, and the rail along the slope
      const railTop = stepTop(i1) - railH;
      const rh = stepTop(i0) - railTop + 4;
      const r = b.part(`rail${k}`, { w, h: rh, pivot: [0, 0], at: [x0, railTop], layer: "bg", collide: "none", hittable: false, z: 2 });
      const lineY = (x: number): number => stepTop(i0) - railH - railTop - Math.round(x * slope);
      const pxp = Math.round(tr * 1.5);
      const tread = stepTop(Math.min(i1, i0 + Math.floor(pxp / tr))) - railTop;
      r.rect(pxp, lineY(pxp), 2, Math.max(4, tread - lineY(pxp)), { mat: "spireIronDark", profile: "cylV", piece: "post" });
      r.stroke([0, lineY(0), w - 1, lineY(w - 1)], 2, { mat: "spireIron", profile: "cylH", piece: "rail" });
    }
    // support posts down to the catwalk, every 7 steps
    for (let i = 5; i < n; i += 7) {
      const x = sx0 + i * tr;
      const t = stepTop(i) + beam + 3;
      const hh = -t + below;
      const s = b.part(`post${i}`, { w: 6, h: hh, pivot: [0, 0], at: [x, t], layer: "mid", collide: "none", ground: true, z: -5 });
      s.rect(0, 0, 5, hh, { mat: "spireIron", profile: "cylV" });
    }
    return {};
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.damage(h.hit);
      },
    },
  },
});
