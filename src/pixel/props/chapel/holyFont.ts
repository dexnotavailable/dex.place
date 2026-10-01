// The porch font (lane R-E; WORLD-PLAN E2: "Font with water: E or a hit makes ripples and a small
// chime. It reflects the lanterns, and it is the calmest water in the world"). The kit's font with the
// E the plan gives it: touching the water sends a ring across it and a soft sound, then it settles back
// to still. Everything else (the bowl, the ripples, hits, the dash wind, mending) is the kit font's,
// except that it is not solid: the path passes in front of it.

import { font } from "../font.ts";
import { defineRecipe, type Prop, type Recipe } from "../../prop.ts";

// the kit recipe is extended by spreading it; its refs type is private to its file
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecipe = Recipe<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FontProp = Prop<any>;

const S = (font as AnyRecipe).states;

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
    return refs;
  },
  initial: "still",
  states: {
    still: {
      ...S["still"],
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
