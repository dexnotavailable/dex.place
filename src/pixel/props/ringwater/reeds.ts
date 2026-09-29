// Reeds at the water's edge (WORLD-PLAN A0, B1): tall stems that bend and part
// as you pass, lean in the wind, bow from a swing or your dash, and when cut
// drop to stubs and grow back. They are the kit's grass (same motion, same
// breakage policy and `form` check) grown tall, khaki-green, with a brown seed
// head on some stems. Origin: the clump's left end, on the ground or water.

import "./materials.ts";
import { grass } from "../plants.ts";
import { matId } from "../../kit.ts";
import { defineRecipe } from "../../prop.ts";

export interface ReedParams {
  kind: "grass" | "dry" | "flowers";
  width: number;
  height: number;
  density: number;
}

export const reeds = defineRecipe<ReedParams, ReturnType<typeof grass.build>>({
  ...grass,
  id: "reeds",
  reason: "The lake's edge grows reeds: they show the wind over the water and part around your ankles, so the shore answers you the way the water does.",
  defaults: { kind: "dry", width: 1.3, height: 0.95, density: 2.4 },
  build(b, p) {
    const r = grass.build(b, { ...p, kind: "dry" });
    const reed = matId("ringReed"), dry = matId("grassDry"), head = matId("ringReedHead");
    for (const bl of r.blades) {
      bl.mat = b.rand() < 0.7 ? reed : dry;
      bl.rest *= 0.6;
      bl.lean = bl.rest;
      bl.flower = b.rand() < 0.3 && bl.h0 > b.u(p.height) * 0.6 ? head : 0;
    }
    return r;
  },
  demo: {
    w: 5,
    params: { width: 1.6 },
    script: [
      { label: "still", wait: 0.6 },
      { label: "walk through: they part", walk: [-0.6, 2.4], wait: 2.2 },
      { label: "wind over the water", wind: 360, wait: 2 },
      { label: "calm", wind: 0, wait: 1 },
      { label: "slash: stems cut", hit: "slash", from: 0.7, face: 1, wait: 1.2 },
      { label: "dash wind: they bow", hit: "wind", from: -0.2, face: 1, wait: 1.2 },
      { label: "grow back", wait: 6 },
    ],
  },
});
