// The crane over the Hollow Mouth (lane R-B, B5): a lattice mast standing on
// the east lip of the culvert platform, a jib reaching west over the shaft to
// the head sheave the hook's cable hangs from, a counter-jib with its weight,
// a winch house at the mast's foot whose drum turns while the hook runs, and
// an amber lamp on the head that glows steady while it runs (a slow lamp,
// never a flash). The hook itself (the ride) is the room's carrier; it tells
// this prop "running" / "idle". Iron dents and sparks; it never breaks.
// Origin: the mast's foot on the lip.

import { defineRecipe } from "../../prop.ts";
import type { Part } from "../../part.ts";
import { puff } from "../../kit.ts";
import "./materials.ts";

export interface CraneParams {
  /** Mast height and jib reach west in H. */
  height: number;
  reach: number;
}

interface Refs {
  drum: Part;
  lamp: Part;
  spin: number;
}

export const craneFrame = defineRecipe<CraneParams, Refs>({
  id: "craneFrame",
  breakage: "never",
  reason: "The crane whose hook is the lift into the hollow: a landmark over the shaft, and its lamp and winch tell you the hook is coming.",
  defaults: { height: 5.7, reach: 1.25 },
  cues: ["crane.run", "crane.stop", "metal.hit"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const Ht = u(p.height), reach = u(p.reach);
    const back = u(1.3);
    const gw = reach + back + u(0.4), gh = Ht + u(0.4);
    const ox = reach + u(0.2), oy = gh - 1;
    const f = b.part("frame", { w: gw, h: gh, pivot: [ox, oy], at: [0, 0], layer: "bg", z: 4 });
    const mw = u(0.34);
    const X = (x: number): number => ox + x;
    const Y = (y: number): number => oy - y;
    // the mast: two chords and a zigzag of braces
    f.rect(X(-mw / 2), Y(Ht), 3, Ht, { mat: "plainIron", profile: "cylV" });
    f.rect(X(mw / 2) - 3, Y(Ht), 3, Ht, { mat: "plainIron", profile: "cylV" });
    const step = u(0.32);
    for (let y = 0, k = 0; y < Ht - step; y += step, k++) {
      const a = k % 2 ? -mw / 2 : mw / 2;
      f.stroke([X(a), Y(y), X(-a), Y(y + step)], 2, { mat: "plainIron" });
      f.rect(X(-mw / 2), Y(y) - 1, mw, 2, { mat: "plainIron", profile: "flat" });
    }
    // the jib west and the counter-jib east: lattice girders under a top chord
    const jy = Ht - u(0.1);
    f.rect(X(-reach), Y(jy), reach + back, 3, { mat: "plainIron", profile: "cylH", z: 1 });
    f.rect(X(-reach * 0.9), Y(jy - u(0.22)), reach * 0.9 + back * 0.85, 2, { mat: "plainIron", profile: "cylH", z: 1 });
    for (let x = -reach * 0.9, k = 0; x < back * 0.85 - step * 0.5; x += step * 0.7, k++) f.stroke([X(x), Y(jy - (k % 2 ? 0 : u(0.22))), X(x + step * 0.7), Y(jy - (k % 2 ? u(0.22) : 0))], 2, { mat: "plainIron", z: 1 });
    // ties from the mast's peak to both ends
    f.stroke([X(0), Y(Ht + u(0.25)), X(-reach), Y(jy)], 1.5, { mat: "plainRope", z: 1 });
    f.stroke([X(0), Y(Ht + u(0.25)), X(back), Y(jy)], 1.5, { mat: "plainRope", z: 1 });
    f.rect(X(-2), Y(Ht + u(0.28)), 4, u(0.3), { mat: "plainIron", profile: "cylV", z: 1 });
    // the head sheave at the jib's tip (the hook's cable hangs from here)
    f.circle(X(-reach + u(0.02)), Y(jy - u(0.06)), u(0.08), { mat: "plainIron", profile: "dome", r: 3, z: 2 });
    f.circle(X(-reach + u(0.02)), Y(jy - u(0.06)), 2, { mat: "plainWoodDark", profile: "flat", z: 3 });
    // the counterweight: stacked concrete blocks
    f.rect(X(back - u(0.42)), Y(jy - u(0.04)), u(0.4), u(0.46), { mat: "plainConcrete", profile: "bevel", r: 2, z: 2 });
    f.rect(X(back - u(0.42)), Y(jy - u(0.2)), u(0.4), 1, { mat: "plainConcrete", mode: "paint", tone: -1 });
    // the winch house at the foot, facing the shaft
    f.rect(X(-mw / 2 - u(0.1)), Y(u(0.62)), mw + u(0.5), u(0.62), { mat: "plainPaint", profile: "bevel", r: 2, z: 2 });
    f.rect(X(-mw / 2 - u(0.02)), Y(u(0.52)), u(0.18), u(0.14), { mat: "plainGlass", profile: "flat", z: 3 });
    f.rect(X(-mw / 2 - u(0.14)), Y(u(0.66)), mw + u(0.58), u(0.05), { mat: "plainIron", profile: "cylH", z: 3 });
    f.wear({ amount: 0.25, seed: p.seed });
    f.speckle({ amount: 0.12, seed: p.seed + 1, tone: -1, mats: ["plainIron"] });
    // the drum on the winch house's flank: turns while the hook runs
    const dr = u(0.13);
    const drum = b.part("drum", { w: dr * 2 + 2, h: dr * 2 + 2, pivot: [dr + 1, dr + 1], at: [u(0.3), -u(0.3)], layer: "bg", z: 6, smoothRotate: true });
    drum.circle(dr + 1, dr + 1, dr, { mat: "plainIron", profile: "dome", r: 3 });
    drum.rect(dr + 1 - 1, 1, 2, dr * 2, { mat: "plainRope", profile: "flat", z: 1 });
    drum.circle(dr + 1, dr + 1, 2, { mat: "plainBrass", profile: "dome", r: 1, z: 2 });
    // the lamp on the head: amber glass, lit only while the hook runs
    const lamp = b.part("lamp", { w: 7, h: 7, pivot: [3, 6], at: [-reach + u(0.2), -jy - 1], layer: "bg", z: 7 });
    lamp.rect(1, 2, 5, 5, { mat: "plainIron", profile: "bevel", r: 1 });
    lamp.rect(2, 3, 3, 3, { mat: "glyph", profile: "flat" });
    b.light({ part: "lamp", at: [3, 4], colour: [1, 0.62, 0.28], radius: u(2.2), intensity: 0.8, on: false });
    b.glow({ part: "lamp", at: [3, 4], colour: [1, 0.6, 0.25], radius: u(0.35), on: false });
    return { drum: b.get("drum"), lamp: b.get("lamp"), spin: 0 };
  },
  initial: "idle",
  states: {
    idle: {
      enter(c) {
        for (const l of c.lights) l.on = false;
        for (const g of c.glows) g.on = false;
        c.refs.lamp.heat = -3;
      },
      hit(c, h) {
        c.damage(h.hit);
      },
    },
    running: {
      sound: "crane.run",
      enter(c) {
        for (const l of c.lights) l.on = true;
        for (const g of c.glows) g.on = true;
        c.refs.lamp.heat = 0;
        const [x, y] = c.refs.drum.toWorld(0, 0);
        puff(c.world, "dust", x, y, 4, [0, -1], { speed: 0.4 });
      },
      update(c, dt) {
        c.refs.drum.rot += dt * 3.2;
      },
      exit(c) {
        c.sound("crane.stop", 0.7);
      },
      hit(c, h) {
        c.damage(h.hit);
      },
    },
  },
  demo: {
    w: 6,
    script: [
      { label: "idle", wait: 0.6 },
      { label: "the hook runs: the drum turns, the lamp glows", go: "running", wait: 2 },
      { label: "stops", go: "idle", wait: 0.8 },
      { label: "hit: dents, never breaks", hit: "heavy", from: -0.9, wait: 1.2 },
    ],
  },
});
