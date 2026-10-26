// Luggage: the suitcase on the dock (the first scale anchor: you are a
// traveller, and so was someone else), the trunk in the lodge, a canvas bag
// in the waiting room. A hit tips it over onto its side (it tips toward the
// push, about its foot); after a while it rights itself. Straps and clasps
// catch the light. Origin: floor, centre.

import { EASE } from "../util.ts";
import { puff } from "../kit.ts";
import { defineRecipe, type Prop } from "../prop.ts";
import type { Part } from "../part.ts";

export interface LuggageParams {
  kind: "suitcase" | "trunk" | "bag";
}

interface Refs {
  body: Part;
  w: number;
  h: number;
  side: number;
  e: number;
}

const SIZE = { suitcase: [0.6, 0.42], trunk: [0.9, 0.52], bag: [0.66, 0.34] } as const;

export const luggage = defineRecipe<LuggageParams, Refs>({
  id: "luggage",
  breakage: "heal",
  reason: "Someone's luggage: the suitcase on the dock is the first thing next to you that says your size and that you are a traveller; a trunk in the lodge, a bag in the waiting room.",
  defaults: { kind: "suitcase" },
  cues: ["luggage.tip", "luggage.right"],
  standard: { w: 0.6, h: 0.5, parts: ["body"], note: "suitcase: the case 0.42 H plus its handle" },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const [wH, hH] = SIZE[p.kind];
    const w = u(wH), h = u(hH);
    const handle = p.kind === "bag" ? 0 : u(0.08);
    const bd = b.part("body", { w, h: h + handle, pivot: [w >> 1, h + handle], at: [0, 0], layer: "mid", z: 6, smoothRotate: true, collide: "platform" });
    const top = handle;
    if (p.kind === "suitcase") {
      bd.roundRect(0, top, w, h, 3, { mat: "leather", profile: "bevel", r: 3, depth: 3, piece: "case" });
      bd.rect(0, top + Math.round(h * 0.18), w, 1, { mat: "leather", mode: "paint", tone: -2 });
      // corner guards, two straps, brass clasps, the handle
      for (const [x, y] of [[0, top], [w - 5, top], [0, top + h - 5], [w - 5, top + h - 5]] as const) bd.roundRect(x, y, 5, 5, 2, { mat: "leatherDark", profile: "dome", r: 2, z: 3, piece: "guard" });
      for (const x of [Math.round(w * 0.24), Math.round(w * 0.72)]) {
        bd.rect(x - 2, top, 4, h, { mat: "leatherDark", profile: "bevel", r: 1, depth: 2, z: 2, piece: "strap" });
        bd.rect(x - 3, top + Math.round(h * 0.44), 6, 4, { mat: "brass", profile: "bevel", r: 1, depth: 2, z: 4, piece: "buckle" });
      }
      for (const x of [Math.round(w * 0.38), Math.round(w * 0.58)]) bd.rect(x - 1, top + Math.round(h * 0.14), 3, 4, { mat: "brass", profile: "dome", r: 1, z: 4, piece: "clasp" });
      bd.stroke([Math.round(w * 0.38), top + 1, Math.round(w * 0.42), 1, Math.round(w * 0.58), 1, Math.round(w * 0.62), top + 1], 2, { mat: "leatherDark", piece: "handle" });
      // a travel tag on a string
      bd.rect(w - u(0.12), top + 3, u(0.06), u(0.08), { mat: "parchment", profile: "flat", z: 5, piece: "tag" });
      bd.line(w - u(0.1), top + 3, w - u(0.14), top - 1, { mat: "rope", z: 5, piece: "tag" });
    } else if (p.kind === "trunk") {
      bd.rect(0, top, w, h, { mat: "wood", profile: "bevel", r: 2, depth: 3, piece: "box" });
      bd.grain({ dir: "h", seed: p.seed, mats: ["wood"], stretch: 16 });
      bd.rect(0, top, w, Math.round(h * 0.28), { mat: "woodDark", profile: "cylH", z: 2, piece: "lid" });
      for (const x of [3, Math.round(w / 2) - 2, w - 7]) bd.rect(x, top, 4, h, { mat: "brass", profile: "bevel", r: 1, depth: 2, z: 3, piece: "band" });
      bd.rect(Math.round(w / 2) - 4, top + Math.round(h * 0.3), 8, 7, { mat: "brass", profile: "bevel", r: 1, depth: 2, z: 4, piece: "lock" });
      bd.rect(Math.round(w / 2) - 1, top + Math.round(h * 0.3) + 3, 2, 2, { mat: "soot", profile: "flat", z: 5, noInk: true });
      bd.stroke([Math.round(w * 0.2), top + 1, Math.round(w * 0.24), 1, Math.round(w * 0.34), 1, Math.round(w * 0.38), top + 1], 2, { mat: "iron", piece: "handle" });
      bd.rivets([[6, top + 3], [w - 6, top + 3], [6, top + h - 3], [w - 6, top + h - 3]], { mat: "brass", r: 1 });
    } else {
      bd.roundRect(0, top + 2, w, h - 2, Math.round(h / 2) - 1, { mat: "canvas", profile: "dome", r: 5, piece: "bag" });
      bd.rect(Math.round(w * 0.1), top + 2, Math.round(w * 0.8), 2, { mat: "leatherDark", profile: "cylH", z: 2, piece: "zip" });
      for (const x of [Math.round(w * 0.3), Math.round(w * 0.7)]) bd.rect(x - 1, top + 2, 3, h - 4, { mat: "leatherDark", profile: "bevel", r: 1, depth: 2, z: 2, piece: "strap" });
      bd.stroke([Math.round(w * 0.3), top + 3, Math.round(w * 0.5), 0, Math.round(w * 0.7), top + 3], 2, { mat: "leatherDark", piece: "handle" });
      bd.speckle({ amount: 0.08, seed: p.seed, tone: -1, mats: ["canvas"] });
    }
    bd.wear({ amount: 0.02, seed: p.seed + 2 });
    return { body: b.get("body"), w, h: h + handle, side: 1, e: 0 };
  },
  initial: "upright",
  states: {
    upright: {
      hit(c, h) {
        if (h.hit.type === "wind" && h.hit.force < c.params.H * 6) return;
        c.damage(h.hit);
        c.refs.side = h.hit.dir[0] < 0 ? -1 : 1;
        return "tipping";
      },
    },
    tipping: {
      sound: "luggage.tip",
      update(c, dt) {
        const r = c.refs;
        r.e = Math.min(1, r.e + dt / 0.45);
        pose(c, EASE["outBounce"]!(r.e));
        if (r.e >= 1) c.go("tipped");
      },
    },
    tipped: {
      enter(c) {
        const [x] = c.refs.body.toWorld(c.refs.body.pivotX, 0);
        puff(c.world, "dust", x + c.refs.side * c.refs.h * 0.6, c.y - 2, 5, [0, -1], { speed: 0.4 });
      },
      after: [4, "righting"],
      hit(c, h) {
        if (h.hit.type !== "wind") c.damage(h.hit);
      },
    },
    righting: {
      sound: "luggage.right",
      update(c, dt) {
        const r = c.refs;
        r.e = Math.max(0, r.e - dt / 0.7);
        pose(c, EASE["inOutSine"]!(r.e));
        if (r.e <= 0) c.go("upright");
      },
    },
  },
  demo: {
    w: 5,
    variants: [
      { label: "trunk (lodge)", params: { kind: "trunk" }, dx: 1.7 },
      { label: "bag (waiting room)", params: { kind: "bag" }, dx: -1.7 },
    ],
    script: [
      { label: "upright (the dock's scale anchor)", wait: 0.8 },
      { label: "slash: tips over", hit: "slash", from: -0.8, wait: 1.2 },
      { label: "lies there", wait: 3.4 },
      { label: "rights itself", wait: 1.4 },
    ],
  },
});

/** Tip about the foot on the push side: rotate and keep that corner on the floor. */
function pose(c: Prop<Refs>, e: number): void {
  const r = c.refs;
  const a = e * (Math.PI / 2) * r.side;
  r.body.rot = a;
  // the part turns about its bottom centre; move that point as if it turned about the foot corner
  r.body.offX = Math.round(r.side * (r.w / 2) * (1 - Math.cos(a)));
  r.body.offY = -Math.round((r.w / 2) * Math.abs(Math.sin(a)));
}
