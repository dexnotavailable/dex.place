// The lift's counterweight (lane R-D): a slab of stacked iron weights in a
// yoke, hung on two cables in the spire's lift channel. On the ride up (D1)
// it passes the car the other way halfway: it moves exactly opposite the
// car (it reads the lift's height from the storm module, which the lift
// publishes), the "how big is this" moment. On the outer climb (D2) it hangs
// still in its channel at the east edge and swings a little in the gusts.
// Hits dent and spark; it never breaks. Origin: the top of its yoke (the
// cables rise from here).

import "./materials.ts";
import { puff } from "../../kit.ts";
import { defineRecipe } from "../../prop.ts";
import type { Part } from "../../part.ts";
import { LIFT, STORM, gustNow } from "./storm.ts";

export interface CounterweightParams {
  /** "hang": still in its channel; "ride": moves opposite the lift (by `travel` H, as the lift rises from its bottom stop). */
  mode: "hang" | "ride";
  /** Cable length above the yoke, H. */
  cable: number;
  /** Ride: the lift's room y at its bottom stop (px). */
  liftBottom: number;
}

interface Refs {
  body: Part;
  cables: Part[];
  sway: number;
  vs: number;
}

export const counterweight = defineRecipe<CounterweightParams, Refs>({
  id: "counterweight",
  breakage: "never",
  reason: "The lift's counterweight: it passes the car the other way halfway up the ride, the moment you feel how big the spire is; on the climb it hangs in its channel, swinging in the gusts.",
  defaults: { mode: "hang", cable: 8, liftBottom: 0 },
  cues: ["metal.hit", "cable.creak"],
  standard: { w: 1.3, parts: ["body"], note: "counterweight block 1.3 x 2.8 H, hung from its yoke (the origin)" },
  demo: {
    w: 6,
    at: 3.2,
    params: { mode: "hang", cable: 3 },
    script: [
      { label: "hanging", wait: 0.6 },
      { label: "heavy: dents, sparks, swings", hit: "heavy", from: -0.9, face: 1, wait: 2 },
    ],
  },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(1.3), Ht = u(2.8);
    const body = b.part("body", { w: W, h: Ht, pivot: [W >> 1, 0], at: [0, 0], layer: "mid", z: 3, collide: "none" });
    // the yoke with two sheaves
    body.piece("yoke");
    body.rect(0, u(0.1), W, u(0.18), { mat: "spireIron", profile: "bevel", r: 2, depth: 4, z: 3 });
    for (const x of [W * 0.28, W * 0.72]) {
      body.circle(x, u(0.1), u(0.1), { mat: "spireIron", profile: "dome", r: 3, z: 4, piece: "sheave" });
      body.circle(x, u(0.1), 2, { mat: "brass", profile: "dome", r: 1, z: 5, piece: "hub" });
    }
    // guide shoes on both sides
    for (const x of [0, W - u(0.1)]) body.rect(x, u(0.3), u(0.1), Ht - u(0.4), { mat: "spireIronDark", profile: "cylV", z: 2, piece: "shoe" });
    // the stacked weights, each a slab with a lit top edge and a number stamped on one
    const n = 9;
    const top = u(0.3), sh = Math.floor((Ht - top - u(0.08)) / n);
    for (let k = 0; k < n; k++) {
      const y = top + k * sh;
      body.rect(u(0.12), y, W - u(0.24), sh - 1, { mat: k % 3 === 1 ? "spireIronDark" : "spireIron", profile: "bevel", r: 2, depth: 3, z: 3, piece: `slab${k % 2}` });
      body.rect(u(0.12), y, W - u(0.24), 1, { mat: "spireIron", mode: "paint", tone: 1 });
    }
    // a tie rod down each side and a base plate
    for (const x of [u(0.2), W - u(0.24)]) body.rect(x, top, 3, Ht - top, { mat: "spireIron", profile: "cylV", z: 5, piece: "rod" });
    body.rect(u(0.06), Ht - u(0.1), W - u(0.12), u(0.1), { mat: "spireIron", profile: "bevel", r: 2, depth: 3, z: 4, piece: "base" });
    body.speckle({ amount: 0.08, seed: p.seed, tone: -1, scale: 2 });
    body.rect(W * 0.35, top + sh * 4 + 3, W * 0.3, 2, { mat: "routeRed", mode: "paint" });
    // the cables, up out of view (two thin parts)
    const ch = Math.max(8, u(p.cable));
    const cables: Part[] = [];
    for (const [k, x] of [[0, W * 0.28], [1, W * 0.72]] as const) {
      const c = b.part(`cable${k}`, { w: 3, h: ch, pivot: [1, ch], at: [Math.round(x - W / 2), u(0.1)], layer: "bg", z: 2, outline: 0, collide: "none", hittable: false });
      c.rect(0, 0, 3, ch, { mat: "cable", profile: "cylV", noInk: true });
      for (let y = 6; y < ch; y += 9) c.pixels([[(y / 9) % 2 ? 2 : 0, y]], { mat: "cable", mode: "paint", tone: 1 });
      cables.push(b.get(`cable${k}`));
    }
    return { body: b.get("body"), cables, sway: 0, vs: 0 };
  },
  initial: "idle",
  states: {
    idle: {
      update(c, dt) {
        const r = c.refs;
        const H = c.params.H;
        if (c.params["mode"] === "ride") {
          // opposite the car: as it rises from its bottom stop, this falls by as much
          const up = LIFT.live ? Math.max(0, Number(c.params["liftBottom"]) - LIFT.y) : 0;
          r.body.offY = Math.round(up);
          for (const c of r.cables) c.offY = Math.round(up);
        } else {
          // swing a little in the gusts
          const g = STORM.strength > 0 ? gustNow(c.world.time) : { level: 0, tell: 0 };
          r.vs += (g.level * H * 0.06 - r.sway) * dt * 3 - r.vs * dt * 1.6;
          r.sway += r.vs * dt * 3;
          r.body.offX = Math.round(r.sway);
          r.body.rot = r.sway * 0.004;
        }
      },
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.damage(h.hit);
        c.refs.vs += h.hit.dir[0] * c.params.H * 0.15;
        puff(c.world, "spark", c.x + h.hit.dir[0] * -c.params.H * 0.6, c.y + c.params.H * 1.2, 8, [h.hit.dir[0], -1], { speed: 1 });
      },
    },
  },
});
