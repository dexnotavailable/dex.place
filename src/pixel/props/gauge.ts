// The H gauge: a plain figure exactly H tall in Rosace's own materials
// (art/rosace/palette.json), so the sandbox shows every prop against the
// locked player size and the same ramps and outline. Not a character design;
// a measuring stick with her colours. Origin: between the feet.

import { defineRecipe } from "../prop.ts";

export const gauge = defineRecipe<Record<string, unknown>, null>({
  id: "gauge",
  reason: "Scale reference in the sandbox: exactly one H tall in Rosace's palette, so props are judged at the locked player size.",
  defaults: {},
  build(b) {
    const H = b.H;
    const u = (f: number): number => Math.round(f * H);
    const w = u(0.5), h = H;
    const g = b.part("figure", { w, h, pivot: [Math.floor(w / 2), h], at: [0, 0], layer: "mid", hittable: false, z: 50 });
    const cx = w / 2;
    // legs (indigo stockings), boots
    g.piece("legs");
    g.rect(cx - u(0.075), u(0.56), u(0.06), u(0.4), { mat: "rosace.stocking", profile: "cylV" });
    g.rect(cx + u(0.015), u(0.56), u(0.06), u(0.4), { mat: "rosace.stocking", profile: "cylV" });
    g.rect(cx - u(0.085), h - u(0.08), u(0.08), u(0.08), { mat: "rosace.boot", profile: "dome", r: 2 });
    g.rect(cx + u(0.01), h - u(0.08), u(0.085), u(0.08), { mat: "rosace.boot", profile: "dome", r: 2 });
    // white tabard / robe body
    g.piece("robe");
    g.poly([cx - u(0.1), u(0.2), cx + u(0.1), u(0.2), cx + u(0.15), u(0.62), cx - u(0.13), u(0.62)], { mat: "rosace.white", profile: "dome", r: 5 });
    g.rect(cx - u(0.13), u(0.6), u(0.28), u(0.03), { mat: "rosace.gold", profile: "cylH" });
    g.rect(cx - u(0.015), u(0.24), u(0.03), u(0.36), { mat: "rosace.gold", profile: "cylV", piece: "trim" });
    // arms
    g.piece("arm");
    g.stroke([cx + u(0.08), u(0.24), cx + u(0.13), u(0.42), cx + u(0.12), u(0.52)], u(0.05), { mat: "rosace.white" });
    g.circle(cx + u(0.12), u(0.53), u(0.03), { mat: "rosace.skin" });
    // head and hair
    g.piece("hair");
    g.poly([cx - u(0.1), u(0.06), cx + u(0.07), u(0.04), cx + u(0.05), u(0.3), cx - u(0.15), u(0.48), cx - u(0.13), u(0.14)], { mat: "rosace.hair", profile: "dome", r: 4 });
    g.piece("head");
    g.circle(cx, u(0.1), u(0.072), { mat: "rosace.skin", profile: "dome", r: 4 });
    g.piece("fringe");
    g.poly([cx - u(0.08), u(0.02), cx + u(0.075), u(0.03), cx + u(0.04), u(0.08), cx - u(0.075), u(0.1)], { mat: "rosace.hair", profile: "dome", r: 3 });
    return null;
  },
  initial: "idle",
  states: { idle: {} },
});
