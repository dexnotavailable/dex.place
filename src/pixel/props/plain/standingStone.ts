// Standing stone (lane R-B, B2 and B4): a menhir of the plain, weathered and
// lichened, leaning a little. Hits chip and crack it; it never falls; it
// mends in the room. On Stonetop two of them are the first ledges of the
// climb (flat-topped: `flat`), where the room's collision is. Origin: the
// stone's foot, centre.

import { defineRecipe } from "../../prop.ts";
import { vnoise } from "../../util.ts";
import "./materials.ts";

export interface StoneParams {
  /** Width and height in H. */
  w: number;
  h: number;
  /** Lean, H per H (+ east). */
  lean: number;
  /** A flat top (a ledge you stand on). */
  flat: boolean;
}

export const standingStone = defineRecipe<StoneParams, Record<string, never>>({
  id: "standingStone",
  breakage: "heal",
  reason: "The standing stones the colossi walk past: old, lichened, older than the road. They chip when struck and never fall, and on Stonetop they are the first steps up.",
  defaults: { w: 0.7, h: 1.6, lean: 0.05, flat: false },
  cues: ["stone.hit", "stone.break"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.w), Ht = u(p.h);
    const pad = Math.ceil(Math.abs(p.lean) * Ht) + 4;
    const gw = W + pad * 2, gh = Ht + 2;
    const s = b.part("stone", { w: gw, h: gh, pivot: [Math.round(gw / 2), gh - 1], at: [0, 0], layer: "mid", z: 5 });
    // the outline: tapering, rounded shoulders, a leaning axis; flat stones keep a level top
    const left: number[] = [], right: number[] = [];
    for (let y = Ht - 1; y >= 0; y -= 2) {
      const t = y / Ht; // 1 at the foot, 0 at the top
      const axis = gw / 2 + (Ht - y) * p.lean;
      const shoulder = p.flat ? Math.min(1, (y + 1) / u(0.06)) : Math.sqrt(Math.max(0, Math.min(1, y / (W * 0.55))));
      const half = (W / 2) * (0.78 + 0.22 * t) * (0.5 + 0.5 * shoulder) + (vnoise(y / 5, 1.5, p.seed) - 0.5) * u(0.05);
      left.push(Math.round(axis - half), y);
      right.unshift(Math.round(axis + half), y);
    }
    const pts: number[] = [];
    for (let i = 0; i < left.length; i += 2) pts.push(left[i]!, left[i + 1]!);
    for (let i = 0; i < right.length; i += 2) pts.push(right[i]!, right[i + 1]!);
    s.poly(pts, { mat: "plainStone", profile: "dome", r: Math.max(3, Math.round(W * 0.28)) });
    // rounded face (height from the centre line) and weathering
    s.speckle({ amount: 0.2, seed: p.seed, tone: -1, scale: 2 });
    s.speckle({ amount: 0.1, seed: p.seed + 3, tone: 1, scale: 3 });
    s.grain({ dir: "v", seed: p.seed + 5, tone: -1, density: 0.12, stretch: 14 });
    s.cracks(Math.round(gw / 2), Math.round(Ht * 0.3), { n: 2, len: Math.round(Ht * 0.25), seed: p.seed + 7, tone: -1 });
    // lichen patches (a few tones of pale green-grey, not a camouflage)
    for (let k = 0; k < 4; k++) {
      const cx = Math.round(gw * (0.3 + 0.4 * vnoise(k, 2.5, p.seed))), cy = Math.round(Ht * (0.25 + 0.6 * vnoise(k, 7.5, p.seed)));
      s.ellipse(cx, cy, u(0.06 + 0.05 * vnoise(k, 4.5, p.seed)), u(0.04), { mat: "plainLichen", mode: "paint", tone: -1 });
    }
    s.wear({ amount: 0.3, seed: p.seed + 9 });
    return {};
  },
  initial: "standing",
  states: { standing: {} },
  demo: {
    w: 5,
    variants: [{ label: "flat-topped (a Stonetop ledge)", params: { w: 1.4, h: 1.2, flat: true, lean: 0 }, dx: 2 }],
    script: [
      { label: "still", wait: 0.5 },
      { label: "slash: chips", hit: "slash", from: -0.8, wait: 1 },
      { label: "heavy: cracks, a chunk comes off", hit: "heavy", from: -0.9, wait: 1.5 },
      { label: "mends", wait: 8 },
    ],
  },
});
