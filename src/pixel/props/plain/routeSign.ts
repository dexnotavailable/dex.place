// The route sign (lane R-B, B3): a bus stop's pole with a round plate and a
// timetable board under it, whose numbers wore off long ago. No invented
// words: the plate is blank but for its rim and a faded band, the board a
// grid of empty rules. The plate swings a little on its bracket when hit;
// the steel dents and mends. Origin: the pole's foot.

import { Pendulum } from "../../motion.ts";
import { defineRecipe } from "../../prop.ts";
import type { Part } from "../../part.ts";
import "./materials.ts";

interface Refs {
  plate: Part;
  swing: Pendulum;
}

export const routeSign = defineRecipe<{ height: number }, Refs>({
  id: "routeSign",
  breakage: "heal",
  reason: "The bus stop's route sign, its numbers worn away: the ordinary thing that makes the plain strange, and says this was a stop on some route once.",
  defaults: { height: 2.7 },
  cues: ["metal.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const Ht = u(p.height);
    const pole = b.part("pole", { w: u(0.5), h: Ht, pivot: [u(0.25), Ht], at: [0, 0], layer: "mid", z: 4 });
    pole.rect(u(0.25) - 2, 0, 4, Ht, { mat: "plainPaint", profile: "cylV" });
    pole.rect(u(0.25) - u(0.08), Ht - u(0.05), u(0.16), u(0.05), { mat: "plainIron", profile: "bevel", r: 1 });
    // the timetable board, strapped to the pole at chest height: blank rules
    pole.rect(u(0.05), Ht - u(1.55), u(0.4), u(0.5), { mat: "plainPaint", profile: "bevel", r: 1, z: 1, piece: "board" });
    pole.rect(u(0.05) + 2, Ht - u(1.55) + 2, u(0.4) - 4, u(0.5) - 4, { mat: "plainSignFace", profile: "flat", z: 1, piece: "board" });
    for (let k = 0; k < 5; k++) pole.rect(u(0.05) + 4, Ht - u(1.5) + 2 + k * u(0.08), u(0.4) - 8, 1, { mat: "plainSignFace", mode: "paint", tone: -1 });
    pole.wear({ amount: 0.2, seed: p.seed });
    // the round plate on a bracket at the top: a rim and a faded band, nothing written
    const d = u(0.46);
    const plate = b.part("plate", { w: d + 2, h: d + u(0.08), pivot: [(d + 2) >> 1, 0], at: [0, -Ht + u(0.02)], layer: "mid", z: 5, smoothRotate: true });
    plate.rect(((d + 2) >> 1) - 1, 0, 3, u(0.08), { mat: "plainIron", profile: "flat" });
    plate.circle((d + 2) / 2, u(0.08) + d / 2, d / 2, { mat: "plainPaint", profile: "dome", r: 3 });
    plate.circle((d + 2) / 2, u(0.08) + d / 2, d / 2 - 3, { mat: "plainSignFace", profile: "flat" });
    plate.rect(4, u(0.08) + Math.round(d * 0.42), d - 6, Math.round(d * 0.16), { mat: "plainPaint", mode: "paint", tone: 0 });
    plate.wear({ amount: 0.35, seed: p.seed + 1 });
    return { plate: b.get("plate"), swing: new Pendulum(d, p.H * 17.5, 1.6) };
  },
  initial: "idle",
  states: {
    idle: {
      update(c, dt) {
        const r = c.refs;
        if (r.swing.resting && r.plate.rot === 0) return;
        r.swing.step(dt);
        r.plate.rot = r.swing.resting ? 0 : r.swing.angle;
      },
      hit(c, h) {
        c.refs.swing.impulse((h.hit.dir[0] || 1) * (h.hit.type === "wind" ? 0.6 : 2.2));
        if (h.hit.type !== "wind") c.damage(h.hit);
      },
    },
  },
  demo: {
    w: 4,
    script: [
      { label: "still", wait: 0.5 },
      { label: "slash: the plate swings, dents", hit: "slash", from: -0.7, wait: 2 },
      { label: "mends", wait: 6 },
    ],
  },
});
