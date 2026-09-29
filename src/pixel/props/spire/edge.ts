// The Blade's top edge (lane R-D; WORLD-PLAN D4): the monolith's knife edge
// you walk up to the tip, laid in overlapping iron plates, each a little
// higher than the last (like scales on a spine), with a lit bevel that runs
// gold once the storm has broken (a gold sheen on wet iron at dusk). It is the
// ground: hits dent it and spark, heavy hits buckle a plate, it mends.
// Origin: the foot of the first plate, on its surface.

import "./materials.ts";
import { crater } from "../../break.ts";
import { puff } from "../../kit.ts";
import { defineMaterial } from "../../materials.ts";
import { defineRecipe } from "../../prop.ts";

/** The blade's iron: the spire's, with a gold sheen where the low sun catches the wet. */
defineMaterial("bladeIron", { ramp: ["#0d0b12", "#1a1620", "#2c2430", "#4a3a40"], t: [0.12, 0.34, 0.7], behaviour: "dent", hardness: 320, sound: "metal", glint: true, spec: { colour: "#e8b070", thr: 0.95 }, bounce: 0.35, debris: 0.05 });

export interface EdgeParams {
  /** Length and total rise of the edge, in H. */
  length: number;
  rise: number;
  /** Plate length (a seam between plates), and how deep the plates hang, in H. */
  plate: number;
  depth: number;
}

export const bladeEdge = defineRecipe<EdgeParams, { parts: string[] }>({
  id: "bladeEdge",
  breakage: "floor",
  reason: "The Blade's knife edge, the path up to the tip where the storm breaks: overlapping iron plates on a steady slope, gold-lit when the sky clears.",
  defaults: { length: 8, rise: 2.3, plate: 0.9, depth: 0.55 },
  cues: ["metal.hit"],
  demo: { w: 10, params: { length: 8, rise: 2.3 }, script: [{ label: "the edge", wait: 0.5 }, { label: "heavy: buckles, sparks", hit: "heavy", from: -1, wait: 1.5 }, { label: "mends", wait: 8 }] },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const L = u(p.length), R = u(p.rise), D = u(p.depth), P = u(p.plate);
    const slope = R / L;
    // the edge in segments of about 4 H (an edge is mostly air: small parts keep the cells few)
    const seg = u(4);
    const names: string[] = [];
    for (let s0 = 0; s0 < L; s0 += seg) {
      const w = Math.min(seg, L - s0) + 2;
      const yTop = -Math.round((s0 + w) * slope) - 12;
      const yBot = -Math.round(s0 * slope) + D + 10;
      const h = yBot - yTop;
      const name = `edge${names.length}`;
      const part = b.part(name, { w, h, pivot: [0, 0], at: [s0, yTop], layer: "mid", collide: "none", ground: true, z: -5 });
      names.push(name);
      for (let x = 0; x < w; x++) {
        const X = s0 + x;
        const top = -Math.round(X * slope) - yTop;
        const inPlate = X % P;
        // each plate laps over the next: its downhill end sits a pixel proud, with a shadowed lip under it
        const lap = inPlate < 3 ? 1 : 0;
        part.rect(x, top - lap, 1, D + lap, { mat: "bladeIron", profile: "flat", z: 2, piece: `p${Math.floor(X / P) % 2}`, toneFn: (_x, y) => (y > D * 0.6 ? -1 : 0) });
        part.pixels([[x, top - lap]], { mat: "bladeIron", mode: "paint", tone: 1 });
        if (inPlate === 3) part.rect(x, top + 1, 1, D - 2, { mat: "bladeIron", mode: "paint", tone: -1 });
        // a fringe of short broken spikes under the edge
        const hh = (X * 2654435761) >>> 0;
        if (hh % 23 === 0) {
          const len = 4 + (hh % 9);
          for (let k = 0; k < len; k++) part.pixels([[x, top + D + k], ...(k < len - 2 ? [[x + 1, top + D + k] as [number, number]] : [])], { mat: "bladeIron", profile: "flat", tone: -1 });
        }
      }
      // rivets along each plate
      const rv: [number, number][] = [];
      for (let X = Math.ceil(s0 / P) * P + Math.round(P / 2); X < s0 + w - 2; X += P) rv.push([X - s0, -Math.round(X * slope) - yTop + 4]);
      part.rivets(rv, { mat: "bladeIron", r: 1, z: 5 });
      part.speckle({ amount: 0.05, seed: p.seed + names.length, tone: -1, scale: 2 });
    }
    return { parts: names };
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        const hit = h.hit;
        if (hit.type === "wind") return;
        c.damage(hit);
        if (c.keepsCells || !hit.crater) return;
        const s = hit.shape;
        const at: [number, number] | null = s.kind === "circle" || s.kind === "point" ? [s.x, s.y] : s.kind === "rect" ? [s.x + s.w / 2, s.y + s.h] : s.kind === "arc" ? [s.x, s.y] : null;
        if (!at) return;
        // the part under the hit
        const part = c.refs.parts.map((n) => c.part(n)).find((q) => {
          const bb = q.worldBounds();
          return at[0] >= bb.x0 && at[0] <= bb.x1;
        });
        if (!part) return;
        crater(c.world, part, at[0], at[1], hit.crater.rx * 0.7, hit.crater.ry * 0.6, Math.max(2, hit.crater.rim - 1), hit);
        puff(c.world, "spark", at[0], at[1] - 2, 8, [0, -1], { speed: 1 });
      },
    },
  },
});
