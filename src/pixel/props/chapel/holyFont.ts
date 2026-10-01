// The porch font (lane R-E; WORLD-PLAN E2: "Font with water: E or a hit makes ripples and a small
// chime. It reflects the lanterns, and it is the calmest water in the world"). The kit's font with the
// E the plan gives it: touching the water sends a ring across it and a soft sound, then it settles back
// to still. Everything else (the bowl, the ripples, hits, the dash wind, mending) is the kit font's,
// except that it is not solid: the path passes in front of it.

import "./materials.ts";
import { font } from "../font.ts";
import { resolveMat } from "../../materials.ts";
import { defineRecipe, type Prop, type Recipe } from "../../prop.ts";

// the kit recipe is extended by spreading it; its refs type is private to its file
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecipe = Recipe<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FontProp = Prop<any>;

const S = (font as AnyRecipe).states;

/**
 * Re-cut the kit's cool marble in the porch's own light (once, and it is what the stone mends back to):
 * the chapel's warm limestone, its sunward (west) edge and the lip's top in the low sun's amber, and the
 * bowl's inner rim dark over the water, which sits a few px down inside the lip instead of over it.
 */
function warmStone(c: FontProp): void {
  if (c.data["warm"]) return;
  const marble = resolveMat("marble").id;
  const g = c.part("font").grid;
  const lipTop = Math.round(c.params.H * 0.06);
  const first: number[] = [];
  for (let y = 0; y < g.h; y++) {
    let fx = -1;
    for (let x = 0; x < g.w; x++) if (g.mat[g.inner(x, y)]) { fx = x; break; }
    first.push(fx);
  }
  c.paint("font", (x, y, m) => {
    if (m !== marble) return undefined;
    const fx = first[y] ?? -1;
    if (y >= lipTop + 1 && y <= lipTop + 2 && x > 4 && x < g.w - 5) return "fontStoneDark";   // the inner rim
    if (y === lipTop || (fx >= 0 && x - fx < 2)) return "fontStoneLit";                    // sunward edge and lip
    return "fontStone";
  });
  g.snapshot();
  c.data["warm"] = true;
}

/** Disturb the water from its middle outward (a fingertip's ring), and sound it softly. */
function touch(c: FontProp): void {
  const R = c.refs as { ripples: { n: number; disturb(x: number, a: number, w: number): void } };
  R.ripples.disturb(R.ripples.n / 2, 9, 3);
  c.sound("water.step", 0.5);
}

export const holyFont = defineRecipe<{ width: number }, unknown>({
  ...(font as AnyRecipe),
  id: "holyFont",
  reason: "The holy-water font at the chapel door (WORLD-PLAN E2): the calmest water in the world; E touches it and a ring spreads across it, a hit splashes it.",
  use: { reach: 0.45, prompt: "touch" },
  build(b, p) {
    const refs = (font as AnyRecipe).build(b, p);
    // you walk past it on the porch's flags, not over it: a solid basin across the path had you climbing
    // into the holy water (and stood there, half her height above the floor, she read as floating)
    b.get("font").collide = "none";
    // the water sits down inside the bowl (its surface 2 px under the lip's top), not proud of it like a lid
    b.get("water").y += 5;
    return refs;
  },
  initial: "still",
  states: {
    still: {
      ...S["still"],
      update(c: FontProp, dt: number) {
        warmStone(c);
        S["still"]!.update!(c as never, dt);
      },
      use: () => "touched",
    },
    // the ring crosses the water, then the font is still again (the same update: ripples, drips, wind)
    touched: {
      ...S["still"],
      enter(c: FontProp) {
        touch(c);
      },
      update(c: FontProp, dt: number) {
        S["still"]!.update!(c as never, dt);
        if (c.t > 1.2) c.go("still");
      },
    },
  } as never,
  demo: {
    w: 4,
    indoor: true,
    script: [
      { label: "still water", wait: 1 },
      { label: "E: touch it, a ring spreads", use: true, wait: 2 },
      { label: "slash: splash and ripples", hit: "slash", from: -0.7, wait: 2 },
    ],
  },
});
