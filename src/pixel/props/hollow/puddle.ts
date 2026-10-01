// hollowPuddle: a puddle on the market's flagstones by the steam vents.
//
// The shared puddle holds a sky (day, dusk, storm); the Hollow has no sky,
// so a "dusk" puddle there read as a violet hole in an amber street. This one
// holds what is actually above it: the dark of the hollow's roof, warmed by
// the market's light, and the lamps as broken vertical streaks (a lamp's
// reflection in shallow water is a short column under it, not a disc),
// which shatter while ripples run and knit again when they settle.
// Footsteps ring it, hits splash it, like the shared puddle.
// Origin: its left end on the ground.

import { F_NOINK } from "../../cells.ts";
import { Ripples } from "../../fx.ts";
import { coverage } from "../../hits.ts";
import { defineMaterial } from "../../materials.ts";
import { matId, puff } from "../../kit.ts";
import { defineRecipe } from "../../prop.ts";
import type { Part } from "../../part.ts";

defineMaterial("hollowPuddle", { ramp: ["#100a08", "#21150e", "#3e2614", "#8a5426"], t: [0.1, 0.4, 0.86], glint: true, ink: false, behaviour: "splash", hardness: 999, sound: "water", spec: { colour: "#ffd8a0", thr: 0.95 } });
defineMaterial("hollowPuddleLamp", { ramp: ["#5a3012", "#b0662a", "#f2aa58", "#ffe2a8"], emissive: true, ink: false, behaviour: "splash", hardness: 999, sound: "water" });
/** A rose neon sign held in the water (the streak takes the sign's colour, not the lamps' amber). */
defineMaterial("hollowPuddleRose", { ramp: ["#4a1420", "#8e2a3e", "#d65a74", "#ffb0bc"], emissive: true, ink: false, behaviour: "splash", hardness: 999, sound: "water" });

export interface HollowPuddleParams {
  /** Width in H. */
  width: number;
  /** Where lamps hang over it: offsets from its left end in H (each makes a streak). */
  lamps: number[];
  /** Per lamp: "amber" (a lamp, the default) or "rose" (a neon sign). */
  tints: string[];
}

interface Refs {
  part: Part;
  ripples: Ripples;
  water: number;
  lamp: number;
  streaks: number[];
  /** The streak material per streak. */
  mats: number[];
  dirty: boolean;
  lastStep: number;
}

function draw(r: Refs): void {
  const g = r.part.grid;
  g.clearAll();
  const n = r.ripples.n;
  for (let x = 0; x < n; x++) {
    const t = (x + 0.5) / n;
    const e = Math.sin(Math.PI * t);
    const depth = Math.max(1, Math.round(e * 4.4));
    const h = r.ripples.h[x]!;
    const slope = (r.ripples.h[Math.min(n - 1, x + 1)]! - r.ripples.h[Math.max(0, x - 1)]!) * 0.5;
    const top = e > 0.35 ? (h > 0.5 ? 0 : 1) : 2;
    const broken = Math.abs(slope) > 0.2 || Math.abs(h) > 0.6;
    // a lamp's streak: within 2 px of a lamp column, every row, broken into dashes while it ripples
    let lampD = 99, lampM = r.lamp;
    for (const [k, sx] of r.streaks.entries())
      if (Math.abs(x - sx) < lampD) {
        lampD = Math.abs(x - sx);
        lampM = r.mats[k] ?? r.lamp;
      }
    for (let y = top; y < 2 + depth; y++) {
      const i = g.inner(x, y);
      if (i < 0) continue;
      const d = y - top;
      const streak = lampD < (d === 0 ? 3 : 2) && !(broken && (y + x) % 2 === 0);
      if (streak) {
        g.setRaw(i, lampM, lampD < 1 ? 1 : 0, 1, 1, F_NOINK, 999);
        continue;
      }
      // the warm dark of the roof on the surface, a lit lip, darker deep down
      const tone = d === 0 ? (broken ? 0 : 1) : d === 1 ? (broken || (x + y) % 3 === 0 ? 0 : 1) : d === 2 ? 0 : -1;
      g.setRaw(i, r.water, tone, 1, 1 + (d === 0 ? 1 + slope * 3 : 0), F_NOINK, 999);
    }
  }
  r.dirty = false;
}

export const hollowPuddle = defineRecipe<HollowPuddleParams, Refs>({
  id: "hollowPuddle",
  breakage: "never",
  reason: "Water by the market's steam vents: it holds the lamps over it as broken streaks of light, rings under your steps and splashes when struck.",
  defaults: { width: 1, lamps: [], tints: [] },
  cues: ["water.step", "water.splash"],
  feel: 0.3,
  build(b, p) {
    const W = b.u(p.width);
    b.part("water", { w: W, h: 8, pivot: [0, 2], at: [0, 0], layer: "decal", z: 2, outline: 0, hittable: false, lit: 0.35 });
    const refs: Refs = {
      part: b.get("water"),
      ripples: new Ripples(W, 110, 2.2, 0.3),
      water: matId("hollowPuddle"),
      lamp: matId("hollowPuddleLamp"),
      streaks: p.lamps.map((l) => Math.round(b.u(l))),
      mats: p.lamps.map((_, k) => matId(p.tints[k] === "rose" ? "hollowPuddleRose" : "hollowPuddleLamp")),
      dirty: true,
      lastStep: 0,
    };
    refs.part.tag["heal"] = false;
    refs.part.dynamicEvery = 2;
    refs.part.dynamic = () => {
      if (refs.dirty) draw(refs);
    };
    refs.part.glintT = -1;
    return refs;
  },
  initial: "still",
  states: {
    still: {
      update(c, dt) {
        const r = c.refs;
        const H = c.params.H;
        const W = r.ripples.n;
        for (const a of c.world.actorsNear(c.x + W / 2, c.y, W / 2, H * 0.3)) {
          if (Math.abs(a.vx) < 10) continue;
          r.lastStep += dt;
          if (r.lastStep > 0.28) {
            r.lastStep = 0;
            r.ripples.disturb(Math.round(a.x - c.x), 5, 2);
            puff(c.world, "water", a.x, c.y - 1, 3, [Math.sign(a.vx) * 0.3, -1], { speed: 0.5, spread: 0.6 });
            c.sound("water.step", 0.4);
          }
        }
        if (r.ripples.step(dt) > 0.05) r.dirty = true;
        if (r.part.glintT < 0 && c.rand() < dt * 0.06) r.part.glintT = 0;
      },
      hit(c, h) {
        const r = c.refs;
        const hit = h.hit;
        const W = r.ripples.n;
        if (hit.type === "wind") {
          for (let x = 0; x < W; x += 6) r.ripples.disturb(x, 1.2, 2);
          return;
        }
        let at = -1;
        for (let x = 0; x < W; x += 3) if (coverage(hit.shape, c.x + x, c.y - 1) > 0) { at = x; break; }
        if (at < 0) return;
        r.ripples.disturb(at, hit.type === "slash" ? 6 : 12, 4);
        puff(c.world, "water", c.x + at, c.y - 1, hit.type === "slash" ? 6 : 14, [hit.dir[0] * 0.3, -1], { speed: 1.4, spread: 0.7 });
        c.sound("water.splash", 0.7);
        r.dirty = true;
      },
    },
  },
  demo: {
    w: 4,
    params: { width: 1.2, lamps: [0.4, 0.9] },
    script: [
      { label: "still: two lamps in it", wait: 0.8 },
      { label: "walk through: the streaks break and knit", walk: [-0.6, 2], wait: 2.4 },
      { label: "slash into it: splash", hit: "heavy", from: -0.6, face: 1, wait: 1.6 },
    ],
  },
});
