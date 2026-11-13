// The spire's big doorways (lane R-D): a riveted iron portal, with the
// route's red in chevrons on its lintel, set over a kit big door (the lift's
// gate, an arena shutter), so the doors of the spire are iron like the rest of
// it (the kit door's frame is stone or timber). It sits between the kit
// frame and its leaf: the gate still slides and the shutter still rolls up in
// front of it. Never breaks (dents mend). Origin: the threshold's centre, like
// the door it frames.

import "./materials.ts";
import { defineRecipe } from "../../prop.ts";

export interface PortalParams {
  /** The door it frames: a sliding gate or a rolling shutter (its housing is deeper). */
  kind: "gate" | "shutter";
  /** Chevrons on the lintel. */
  mark: boolean;
}

export const spirePortal = defineRecipe<PortalParams, Record<string, never>>({
  id: "spirePortal",
  breakage: "never",
  reason: "The iron frames of the spire's big doors (the lift's gates, the arena shutters): the doors belong to the spire, and the red chevrons say this is the way.",
  defaults: { kind: "gate", mark: true },
  standard: { w: 3.1, h: 4.42, parts: ["portal"], note: "frames a 4 x 2.5 H big door" },
  demo: { w: 6, script: [{ label: "a portal", wait: 0.5 }, { label: "hit: dents, never breaks", hit: "heavy", from: -1.8, wait: 1 }] },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const w = u(2.5), h = u(4);
    const J = u(0.3), L = u(p.kind === "shutter" ? 0.62 : 0.42);
    const FW = w + J * 2, FH = h + L;
    const f = b.part("portal", { w: FW, h: FH + 4, pivot: [FW >> 1, FH], at: [0, 0], layer: "bg", z: 5, collide: "none" });
    // jambs
    for (const [x, lit] of [[0, true], [FW - J, false]] as const) {
      f.rect(x, L, J, h, { mat: "spireIron", profile: "bevel", r: 3, depth: 5, piece: lit ? "jambL" : "jambR" });
      f.rect(lit ? x : x + J - 2, L, 2, h, { mat: "spireIron", mode: "paint", tone: lit ? 1 : -1 });
      const rv: [number, number][] = [];
      for (let y = L + 8; y < FH - 6; y += u(0.45)) rv.push([x + 4, y], [x + J - 5, y]);
      f.rivets(rv, { mat: "spireIron", r: 1 });
    }
    // lintel (deeper over a shutter: its housing)
    f.rect(0, 0, FW, L, { mat: "spireIron", profile: "bevel", r: 3, depth: 6, piece: "lintel" });
    f.rect(0, 0, FW, 1, { mat: "spireIron", mode: "paint", tone: 1 });
    f.rect(J - 2, L - 4, w + 4, 4, { mat: "spireIronDark", profile: "cylH", z: 2, piece: "lip" });
    if (p.mark) {
      // red chevrons pointing the way in
      const cy = Math.round(L * 0.45), cw = u(0.16);
      for (let k = -2; k <= 2; k++) {
        const cx = Math.round(FW / 2 + k * cw * 1.6);
        f.stroke([cx - cw / 2, cy - 3, cx, cy + 2, cx + cw / 2, cy - 3], 2, { mat: "routeRed", profile: "flat", z: 3, piece: "chevron" });
      }
    }
    // an iron threshold
    f.rect(J - 3, FH, w + 6, 4, { mat: "spireIronDark", profile: "bevel", r: 1, depth: 2, piece: "threshold" });
    f.speckle({ amount: 0.06, seed: p.seed, tone: -1, scale: 2 });
    return {};
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        if (h.hit.type !== "wind") c.damage(h.hit);
      },
    },
  },
});
