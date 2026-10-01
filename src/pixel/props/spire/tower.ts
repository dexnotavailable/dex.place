// The Crown's gatehouses (lane R-D): the arena's two ends are walls, not
// frames stood on the roof. Each is a squat tower of the spire's black plate,
// rising from the arena floor: courses of riveted plate with a lit lip on each
// course, a heavier girdle every few, a lit edge toward the planet and a
// shadowed one away from it, water and rust running down from every lip, a
// battered plinth where it meets the floor, and a broken crest with a parapet,
// an antenna stub and a red warning lamp. The doorways (spirePortal "compact")
// are cut into it: the tower is the wall, the portal its recess. The west
// tower also carries the overhang the terminal stands under; the east one the
// lift's head frame (the hoist wheel over the shaft, its cables going down
// into the gate).
//
// Drawn behind everything at her depth (bg); it never blocks the way (the room's
// terrain does that). Hits dent and spark, nothing comes off. Origin: the
// tower's foot at its left edge, on the floor.

import "./materials.ts";
import { defineRecipe } from "../../prop.ts";

export interface TowerParams {
  /** Width and height above the floor, H. */
  width: number;
  height: number;
  /** Which side faces the planet (its lit edge): -1 west, 1 east. */
  lit: -1 | 1;
  /** A hoist head over a lift shaft at this x (H from the left edge); NaN: none. */
  hoist: number;
  /** Where the crest breaks off (0..1 along the top, NaN: whole) and how deep, H. */
  breakAt: number;
  breakDepth: number;
}

export const crownTower = defineRecipe<TowerParams, Record<string, never>>({
  id: "crownTower",
  breakage: "never",
  reason: "The Crown's gatehouses: the arena's ends are walls of the spire's plate with the shutters and the lift's gate cut into them, so its doors belong to a building, not to the sky.",
  defaults: { width: 4, height: 7, lit: -1, hoist: NaN, breakAt: NaN, breakDepth: 1.2 },
  standard: { w: 4, h: 7, parts: ["wall"], note: "a gatehouse 4 H wide, 7 H tall" },
  demo: { w: 8, script: [{ label: "a gatehouse", wait: 0.5 }, { label: "heavy: dents and sparks", hit: "heavy", from: -1.2, wait: 1 }] },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), Ht = u(p.height);
    const crest = u(0.7);
    const TOT = Ht + crest + u(1.2);
    const f = b.part("wall", { w: W, h: TOT, pivot: [0, TOT], at: [0, 0], layer: "bg", z: 0, collide: "none" });
    const top = TOT - Ht; // the wall's top (the parapet sits on it)
    const course = u(0.52);
    // the plating, course by course, from the floor up
    for (let y = TOT, k = 0; y > top; y -= course, k++) {
      const y0 = Math.max(top, y - course);
      const hh = y - y0;
      const girdle = k % 4 === 3;
      f.rect(0, y0, W, hh, { mat: girdle ? "spireIronDark" : "spireIron", profile: "bevel", r: 1, depth: girdle ? 4 : 2, z: girdle ? 2 : 1, piece: `c${k % 2}`, tone: girdle ? 0 : (k % 3 === 1 ? 0 : 1) });
      // a lit lip on each course's top, a shadow under it
      f.rect(0, y0, W, 1, { mat: "spireIron", mode: "paint", tone: 1 });
      f.rect(0, y0 + 2, W, 1, { mat: "spireIronDark", mode: "paint", tone: -1 });
      // staggered plate joints and rivets
      const jw = u(1.05 + (k % 3) * 0.18);
      for (let x = (k % 2) * (jw >> 1); x < W; x += jw) {
        f.rect(x, y0 + 2, 1, hh - 2, { mat: "spireIronDark", mode: "paint", tone: -1 });
        if (x + 1 < W) f.rect(x + 1, y0 + 2, 1, hh - 2, { mat: "spireIron", mode: "paint", tone: 1 });
      }
      const rv: [number, number][] = [];
      for (let x = 4 + (k % 2) * 3; x < W - 3; x += u(0.28)) rv.push([x, y0 + 5]);
      if (hh > 8) f.rivets(rv, { mat: "spireIron", r: 1 });
    }
    // the plinth: a battered course where it meets the floor
    const pl = u(0.3);
    f.poly([0, TOT - pl, W, TOT - pl, W + 0, TOT, 0, TOT], { mat: "spireIronDark", profile: "bevel", r: 2, depth: 4, z: 3, piece: "plinth" });
    f.rect(0, TOT - pl, W, 1, { mat: "spireIron", mode: "paint", tone: 1 });
    // edges: the planet side lit, the far side in shadow (two px each)
    const le = p.lit < 0 ? 0 : W - 2, de = p.lit < 0 ? W - 3 : 0;
    f.rect(le, top, 2, Ht, { mat: "spireIron", mode: "paint", tone: 1 });
    f.rect(de, top, 3, Ht, { mat: "spireIronDark", mode: "paint", tone: -1 });
    // the crest: a parapet of plate on the top, broken where the storm took a bite out of it
    f.piece("crest");
    f.rect(0, top - crest, W, crest, { mat: "spireIron", profile: "bevel", r: 2, depth: 5, z: 3 });
    f.rect(0, top - crest, W, 1, { mat: "spireIron", mode: "paint", tone: 1 });
    // crenels
    for (let x = u(0.3); x < W - u(0.4); x += u(0.7)) f.rect(x, top - crest, u(0.28), u(0.3), { mat: "spireIron", mode: "erase" });
    if (Number.isFinite(p.breakAt)) {
      // a jagged bite out of the crest and the top courses
      const bx = Math.round(W * p.breakAt), bw = u(1.1), bd = u(p.breakDepth);
      const pts: number[] = [bx - bw / 2, top - crest - 2];
      for (let i = 0; i <= 6; i++) pts.push(bx - bw / 2 + (bw * i) / 6, top - crest + (i % 2 ? bd : bd * 0.6) * Math.sin((Math.PI * i) / 6));
      pts.push(bx + bw / 2, top - crest - 2);
      f.poly(pts, { mat: "spireIron", mode: "erase" });
    }
    // an antenna stub and a red lamp on the crest
    const ax = p.lit < 0 ? Math.round(W * 0.78) : Math.round(W * 0.22);
    f.rect(ax, top - crest - u(1.1), 2, u(1.1), { mat: "spireIronDark", profile: "cylV", z: 4, piece: "mast" });
    for (let y = top - crest - u(1.0); y < top - crest; y += u(0.3)) f.rect(ax - 2, y, 6, 1, { mat: "spireIronDark", mode: "over", z: 4, piece: "mast" });
    f.rect(ax - 1, top - crest - u(1.1) - 3, 4, 3, { mat: "lampRed", mode: "over", z: 5, noInk: true, piece: "lamp" });
    b.glow({ at: [ax + 1, top - crest - u(1.1) - 2 - TOT], colour: [1, 0.25, 0.25], radius: u(0.35), intensity: 0.6 });
    // two slit windows high in the wall, lit warm from inside (a lamp still burns in the gatehouse), each in
    // a recessed frame with a sill catching its light
    for (const fx of [0.3, 0.72]) {
      const sx = Math.round(W * fx), sy = top + u(0.9);
      if (Number.isFinite(p.hoist) && Math.abs(sx - u(p.hoist)) < u(1.2)) continue;
      f.rect(sx - 3, sy - 2, 8, u(0.62) + 4, { mat: "spireIronDark", mode: "paint", tone: -2 });
      f.rect(sx - 1, sy, 4, u(0.62), { mat: "lampAmber", mode: "over", z: 6, noInk: true, piece: "slit" });
      f.rect(sx - 3, sy + u(0.62) + 2, 8, 2, { mat: "spireIron", mode: "paint", tone: 1 });
      b.glow({ at: [sx + 1, sy + u(0.31) - TOT], colour: [1, 0.62, 0.3], radius: u(0.5), intensity: 0.35 });
    }
    // the hoist head over the lift: a wheel housing on the crest, cables down the face into the gate
    if (Number.isFinite(p.hoist)) {
      const hx = Math.round(u(p.hoist));
      const hw = u(1.5), hh = u(0.9);
      f.piece("hoist");
      f.rect(hx - hw / 2, top - crest - hh, hw, hh, { mat: "spireIron", profile: "bevel", r: 3, depth: 6, z: 5 });
      f.rect(hx - hw / 2, top - crest - hh, hw, 1, { mat: "spireIron", mode: "paint", tone: 1 });
      f.circle(hx, top - crest - hh / 2, u(0.32), { mat: "spireIronDark", profile: "dome", r: 4, z: 6, piece: "wheel" });
      f.circle(hx, top - crest - hh / 2, 3, { mat: "brass", profile: "dome", r: 2, z: 7, piece: "hub" });
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        f.line(hx, top - crest - hh / 2, hx + Math.cos(ang) * u(0.28), top - crest - hh / 2 + Math.sin(ang) * u(0.28), { mat: "spireIron", mode: "paint", tone: 1 });
      }
      // the cables down the face, into the shaft behind the gate
      for (const dx of [-u(0.18), u(0.16)]) f.rect(hx + dx, top - crest - hh / 2, 1, TOT - (top - crest - hh / 2) - u(4.9), { mat: "spireIron", mode: "over", z: 4, tone: -1, noInk: true, piece: "cable" });
    }
    // weather: water and rust running down from the lips, the plinth splashed dark
    for (let k = 0; k < Math.round(W / 14); k++) {
      const x = Math.floor(b.rand() * W);
      const y = top + Math.floor(b.rand() * (Ht - u(1)));
      f.rect(x, y, 1, Math.round(u(0.3) + b.rand() * u(1.2)), { mat: "rust", mode: "paint", tone: -2 });
    }
    f.rect(0, TOT - pl - u(0.25), W, u(0.25), { mat: "spireIronDark", mode: "paint", tone: -1 });
    f.speckle({ amount: 0.06, seed: p.seed, tone: -1, scale: 2 });
    f.wear({ amount: 0.06, seed: p.seed + 2, region: { x0: 0, y0: top - crest, x1: W - 1, y1: top - crest + 1 } });
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
