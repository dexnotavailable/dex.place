// A font (holy-water basin) on a pedestal: stone bowl, water surface that
// ripples when hit, walked past (the host can call disturb) or blown by the
// dash, with a glinting highlight. Proves the ripple effect; also on the
// chapel list. Origin: floor, centre.

import { F_NOINK } from "../cells.ts";
import { Ripples } from "../fx.ts";
import { resolveMat } from "../materials.ts";
import { P_ADD, P_DRAG, P_GRAV, P_SETTLE, P_FADE } from "../bodies.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";

interface Refs {
  water: Part;
  ripples: Ripples;
  still: number;
}

function drawWater(c: Prop<Refs>): void {
  const R = c.refs;
  const g = R.water.grid;
  g.clearAll();
  const water = resolveMat("water").id;
  const base = 2;
  for (let x = 0; x < g.w; x++) {
    const hgt = R.ripples.h[x]!;
    const top = Math.max(0, Math.min(base + 2, Math.round(base - hgt)));
    const slope = (R.ripples.h[Math.min(g.w - 1, x + 1)]! - R.ripples.h[Math.max(0, x - 1)]!) * 0.5;
    for (let y = top; y < g.h; y++) {
      const i = g.inner(x, y);
      const surf = y === top;
      g.setRaw(i, water, surf ? (slope < -0.25 ? 1 : slope > 0.25 ? -1 : 1) : y === top + 1 ? 0 : -1, 1, surf ? 2 + slope * 3 : 1, F_NOINK, 999);
    }
  }
  g.computeNormals();
}

export const font = defineRecipe<{ width: number }, Refs>({
  id: "font",
  reason: "Holy water at the chapel door: a still surface that answers every movement near it (ripples), and a quiet place to stop.",
  defaults: { width: 0.62 },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), Hh = u(0.82);
    const cx = Math.floor(W / 2);
    const f = b.part("font", { w: W, h: Hh, pivot: [cx, Hh], at: [0, 0], layer: "mid", z: 6, collide: "solid" });
    f.piece("foot");
    f.rect(cx - u(0.2), Hh - u(0.07), u(0.4), u(0.07), { mat: "marble", profile: "bevel", r: 2, depth: 3 });
    f.poly([cx - u(0.07), Hh - u(0.07), cx + u(0.07), Hh - u(0.07), cx + u(0.05), u(0.3), cx - u(0.05), u(0.3)], { mat: "marble", profile: "cylV", piece: "stem" });
    f.ellipse(cx, u(0.47), u(0.09), u(0.04), { mat: "marble", profile: "dome", r: 3, z: 2, piece: "knop" });
    // the bowl: a half-ellipse cup with a lip
    f.piece("bowl");
    f.poly([0, u(0.08), W, u(0.08), W - u(0.08), u(0.24), cx + u(0.1), u(0.32), cx - u(0.1), u(0.32), u(0.08), u(0.24)], { mat: "marble", profile: "dome", r: 5 });
    f.rect(0, u(0.06), W, u(0.04), { mat: "marble", profile: "cylH", z: 3, piece: "lip" });
    f.cracks(cx + u(0.12), u(0.2), { n: 1, len: 6, seed: p.seed + 3 });
    b.get("font").tag["heal"] = true;
    // water: fills the bowl's mouth, a thin band that moves
    // water: a band in the bowl's mouth, in front of the lip's middle, the lip's ends showing
    const ww = W - 8, wh = 8;
    b.part("water", { w: ww, h: wh, pivot: [Math.floor(ww / 2), wh], at: [0, -(Hh - u(0.06) - 3)], layer: "mid", z: 7, outline: 0, hittable: false });
    const refs: Refs = { water: b.get("water"), ripples: new Ripples(ww), still: 0 };
    return refs;
  },
  initial: "still",
  states: {
    still: {
      update(c, dt) {
        const R = c.refs;
        // a slow drip keeps it alive
        if (c.rand() < dt * 0.25) R.ripples.disturb(c.rand() * R.ripples.n, -3, 2);
        const [wx] = c.world.windAt(c.x, c.y - c.params.H * 0.8);
        if (Math.abs(wx) > 60) R.ripples.disturb(c.rand() * R.ripples.n, wx * 0.004 * (c.rand() - 0.3), 2);
        R.ripples.step(dt);
        drawWater(c);
      },
      hit(c, h) {
        const R = c.refs;
        const cont = h.contact ?? [c.x, c.y - c.params.H * 0.7];
        const [lx] = R.water.toLocal(cont[0], cont[1]);
        R.ripples.disturb(lx, h.hit.type === "slash" ? 16 : 30, 4);
        // splash: water pixels thrown up
        const [sx, sy] = R.water.toWorld(Math.max(0, Math.min(R.ripples.n - 1, lx)), 2);
        const water = resolveMat("water");
        for (let k = 0; k < 14; k++) {
          c.world.particles.spawn({ x: sx + (c.rand() - 0.5) * 8, y: sy, vx: (c.rand() - 0.5) * 60 + h.hit.dir[0] * 30, vy: -60 - c.rand() * 80, life: 0.6 + c.rand() * 0.5, rgb: water.rgb[2 + (k % 2)]!, flags: P_GRAV | P_SETTLE | P_FADE });
        }
        c.world.particles.spawn({ x: sx, y: sy - 2, vx: 0, vy: -20, life: 0.3, rgb: [200, 235, 240], flags: P_ADD | P_DRAG });
        c.sound("water.splash", 0.7);
        if (h.hit.type !== "wind" && h.hit.type !== "slash") c.damage(h.hit, ["font"]);
      },
    },
  },
});
