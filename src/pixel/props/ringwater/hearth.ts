// The lodge's warm things (WORLD-PLAN A3, A0, E2): the stove with its kettle,
// the cups, and the shelves.
//
// stove: a small cast-iron stove with a fire behind its grate (a live flame
// and an ember glow that light the room orange) and a flue pipe up to the
// ceiling; the kettle on top lets out a thread of steam now and then. Hits
// ring the iron and rattle the kettle's lid; it never breaks.
//
// cups: one or two glazed cups (the second set down beside the first), or a
// dusty one (the chapel porch). Story objects: a knock only makes them clink.
//
// lodgeShelf: a wall shelf of jars and books above a lost-property board; it
// sways and rattles, nothing falls (the lodge is the keeper's).

import "./materials.ts";
import { addFlame, puff, stepFlame, type Flame } from "../../kit.ts";
import { P_DRAG, P_FADE, P_RISE } from "../../bodies.ts";
import { Spring } from "../../motion.ts";
import { defineRecipe, type Prop } from "../../prop.ts";
import { bench } from "../bench.ts";
import type { Part } from "../../part.ts";

interface StoveRefs {
  body: Part;
  lid: Part;
  flame: Flame;
  rattle: Spring;
  steam: number;
}

export const stove = defineRecipe<{ pipe: number }, StoveRefs>({
  id: "stove",
  breakage: "never",
  reason: "The keeper's stove and kettle: the lodge is warm because someone keeps it so, and the orange light on you says you're indoors.",
  defaults: { pipe: 2.6 },
  cues: ["metal.hit", "kettle.lid", "fire.crackle"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(0.62), Ht = u(0.72), pipe = u(p.pipe);
    const cx = W >> 1;
    const body = b.part("body", { w: W, h: Ht + pipe, pivot: [cx, Ht + pipe], at: [0, 0], layer: "mid", z: 5 });
    const y0 = pipe;
    // legs, the firebox, a rounded top, the flue up to the ceiling
    body.piece("iron");
    for (const x of [u(0.06), W - u(0.12)]) body.rect(x, y0 + Ht - u(0.12), u(0.06), u(0.12), { mat: "iron", profile: "cylV", piece: "leg" });
    body.roundRect(u(0.03), y0 + u(0.12), W - u(0.06), Ht - u(0.24), 4, { mat: "iron", profile: "bevel", r: 4, depth: 4, piece: "box" });
    body.roundRect(0, y0 + u(0.06), W, u(0.08), 3, { mat: "iron", profile: "cylH", z: 1, piece: "top" });
    body.rect(u(0.06), y0 + Ht - u(0.16), W - u(0.12), u(0.04), { mat: "iron", profile: "cylH", z: 1, piece: "skirt" });
    // the grate: a dark window with bars; the fire sits behind it
    const gx = u(0.14), gy = y0 + u(0.28), gw = W - u(0.28), gh = u(0.2);
    body.rect(gx, gy, gw, gh, { mat: "soot", profile: "sunk", z: 1, piece: "grate" });
    body.rect(gx + 2, gy + gh - u(0.06), gw - 4, u(0.05), { mat: "ember", profile: "flat", z: 2, piece: "embers", noInk: true });
    for (let x = gx + 3; x < gx + gw - 2; x += u(0.06)) body.rect(x, gy, 2, gh, { mat: "iron", profile: "cylV", z: 3, piece: "bars" });
    body.rivets([[u(0.08), y0 + u(0.18)], [W - u(0.08), y0 + u(0.18)], [u(0.08), y0 + Ht - u(0.22)], [W - u(0.08), y0 + Ht - u(0.22)]], { mat: "brass", r: 1.1 });
    // the flue pipe with its collar and a damper
    body.rect(cx - u(0.06), 0, u(0.12), pipe + u(0.08), { mat: "iron", profile: "cylV", piece: "pipe" });
    for (const y of [u(0.3), pipe - u(0.6)]) body.rect(cx - u(0.07), y, u(0.14), 3, { mat: "iron", profile: "cylH", z: 1, piece: "collar" });
    body.speckle({ amount: 0.1, seed: p.seed, tone: -1, mats: ["iron"] });
    const flame = addFlame(b, { name: "fire", parent: "body", at: [cx, gy + gh - u(0.04)], size: [0.2, 0.14], light: 3.4, intensity: 0.85, colour: [1, 0.6, 0.3], glow: 0.4, layer: "mid", z: 4, lit: true });
    // the kettle: a squat pot with a spout and a lid that rattles
    const kw = u(0.26), kh = u(0.16);
    const kettle = b.part("kettle", { w: kw + u(0.08), h: kh + 2, pivot: [(kw >> 1) + u(0.02), kh + 2], at: [u(0.04), -(Ht - u(0.06))], layer: "mid", z: 6 });
    kettle.ellipse(kw / 2 + u(0.02), kh / 2 + 3, kw / 2, kh / 2, { mat: "copper", profile: "dome", r: 4, piece: "pot" });
    kettle.stroke([u(0.02) + 2, kh * 0.6 + 2, 1, kh * 0.25, 0, 2], 2, { mat: "copper", piece: "spout" });
    kettle.stroke([u(0.06), 4, kw / 2 + u(0.02), 0, kw - u(0.02), 4], 2, { mat: "iron", z: 2, piece: "handle" });
    const lid = b.part("lid", { w: u(0.12), h: 3, pivot: [u(0.06), 3], parent: "kettle", at: [(kw >> 1) + u(0.02), 3], layer: "mid", z: 7 });
    lid.roundRect(0, 0, u(0.12), 3, 1, { mat: "copper", profile: "dome", r: 1 });
    return { body: b.get("body"), lid: b.get("lid"), flame, rattle: new Spring(260, 9), steam: 1.5 };
  },
  initial: "lit",
  states: {
    lit: {
      update(c, dt) {
        const r = c.refs;
        stepFlame(c, r.flame, dt);
        if (!r.rattle.resting) {
          r.rattle.step(dt);
          r.lid.offY = -Math.round(Math.abs(r.rattle.x) * 2);
        }
        // a thread of steam from the spout now and then
        r.steam -= dt;
        if (r.steam <= 0) {
          r.steam = 0.12 + (Math.sin(c.world.time * 0.3) > 0.4 ? 0 : 1.4);
          const [x, y] = r.lid.toWorld(0, 0);
          if (c.world.inView(x, y, c.params.H)) {
            const g = 170 + Math.floor(c.rand() * 30);
            c.world.particles.spawn({ x: x - c.params.H * 0.14, y: y + 3, vx: -6 - c.rand() * 4, vy: -10 - c.rand() * 8, life: 0.8 + c.rand() * 0.6, rgb: [g, g, g + 6], flags: P_RISE | P_DRAG | P_FADE });
          }
        }
      },
      hit(c, h) {
        if (h.hit.type === "wind") {
          c.refs.flame.leanV += (h.hit.dir[0] < 0 ? -1 : 1) * 10;
          return;
        }
        c.refs.rattle.impulse(4);
        c.sound("metal.hit", 0.6);
        c.sound("kettle.lid", 0.5);
        c.damage(h.hit, ["body"]);
        const [x, y] = c.refs.body.toWorld(c.refs.body.pivotX, c.refs.body.pivotY - c.params.H * 0.4);
        puff(c.world, "spark", x, y, 4, [0, -1], { speed: 0.5, spread: 1 });
      },
    },
  },
  demo: {
    indoor: true,
    w: 4,
    script: [
      { label: "lit, the kettle steams", wait: 2.4 },
      { label: "slash: the iron rings, the lid rattles", hit: "slash", from: -0.8, wait: 1.4 },
      { label: "dash wind: the fire leans", hit: "wind", from: -1.2, wait: 1.4 },
    ],
  },
});

// ---------------------------------------------------------------------------

interface CupRefs {
  cups: Part[];
  clink: Spring;
}

export const cups = defineRecipe<{ count: number; dusty: boolean; gap: number }, CupRefs>({
  id: "cups",
  breakage: "never",
  reason: "Cups tell the keeper's story without words: hers on the counter, two at Pier's End after the round (one set down for someone), a dusty one on the chapel porch.",
  defaults: { count: 1, dusty: false, gap: 0.22 },
  cues: ["cup.clink"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const cw = u(0.08), ch = u(0.08);
    const n = Math.max(1, Math.min(3, Math.round(p.count)));
    const list: Part[] = [];
    for (let k = 0; k < n; k++) {
      const name = `cup${k}`;
      const cb = b.part(name, { w: cw + 4, h: ch + 1, pivot: [cw >> 1, ch + 1], at: [Math.round(k * u(p.gap)), 0], layer: "mid", z: 6 + k, smoothRotate: true });
      cb.roundRect(0, 1, cw, ch, 2, { mat: "ringGlaze", profile: "cylV", piece: "cup" });
      cb.rect(0, 1 + Math.round(ch * 0.35), cw, 2, { mat: "ringGlazeBlue", mode: "paint" });
      cb.ring(cw + 1, (ch >> 1) + 1, 1, 2.4, { mat: "ringGlaze", flat: 1, piece: "handle" });
      if (p.dusty) cb.speckle({ amount: 0.45, seed: p.seed + k, tone: -1, mats: ["ringGlaze", "ringGlazeBlue"] });
      else if (k === 0) cb.rect(2, 1, cw - 4, 1, { mat: "ringGlaze", mode: "paint", tone: -2 });
      list.push(b.get(name));
    }
    return { cups: list, clink: new Spring(300, 12) };
  },
  initial: "still",
  states: {
    still: {
      update(c, dt) {
        const r = c.refs;
        if (r.clink.resting) return;
        r.clink.step(dt);
        r.cups.forEach((q, i) => (q.rot = r.clink.x * (i % 2 ? -1 : 1) * 0.3));
      },
      hit(c, h) {
        if (h.hit.type === "wind") return;
        c.refs.clink.impulse(3);
        c.sound("cup.clink", 0.4);
      },
    },
  },
  demo: {
    w: 3,
    params: { count: 2 },
    variants: [{ label: "dusty (the chapel porch)", params: { count: 1, dusty: true }, dx: 1.2 }],
    script: [
      { label: "two cups, one set down beside the other", wait: 1 },
      { label: "slash: they clink, nothing breaks", hit: "slash", from: -0.6, wait: 1 },
    ],
  },
});

// ---------------------------------------------------------------------------

interface ShelfRefs {
  shelf: Part;
  sway: Spring;
}

export const lodgeShelf = defineRecipe<{ width: number; boards: number }, ShelfRefs>({
  id: "lodgeShelf",
  breakage: "never",
  reason: "The keeper's shelves: jars, a row of old logbooks, a lamp oil tin; things kept for the lodge's travellers, which sway and rattle but are never broken.",
  defaults: { width: 1.4, boards: 2 },
  cues: ["wood.hit", "glass.clink"],
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = u(p.width), step = u(0.42), Hh = step * p.boards + u(0.06);
    const sh = b.part("shelf", { w: W, h: Hh, pivot: [W >> 1, 0], at: [0, 0], layer: "bg", z: 5, smoothRotate: true });
    for (let k = 0; k < p.boards; k++) {
      const y = step * (k + 1);
      sh.rect(0, y, W, u(0.05), { mat: "wood", profile: "bevel", r: 1, depth: 3, piece: `board${k}` });
      sh.rect(0, y, W, 1, { mat: "wood", mode: "paint", tone: 1 });
      for (const x of [u(0.08), W - u(0.12)]) sh.poly([x, y + u(0.05), x + u(0.04), y + u(0.05), x + u(0.04), y + u(0.14)], { mat: "iron", profile: "flat", piece: "bracket" });
      // what stands on it: logbooks, jars, a tin (drawn from the seed; nothing to read)
      let x = u(0.06);
      let s = p.seed * 7 + k * 13;
      while (x < W - u(0.12)) {
        s = (s * 9301 + 49297) % 233280;
        const r = s / 233280;
        if (r < 0.45) {
          const bw = u(0.04) + Math.round(r * 6), bh = u(0.2) + Math.round(r * 8);
          sh.rect(x, y - bh, bw, bh, { mat: r < 0.15 ? "leatherDark" : r < 0.3 ? "leather" : "clothIndigo", profile: "bevel", r: 1, depth: 2, z: 1, piece: "book" });
          sh.rect(x, y - bh + 3, bw, 1, { mat: "brass", mode: "paint", tone: -1 });
          x += bw + 1;
        } else if (r < 0.75) {
          const jw = u(0.1), jh = u(0.13);
          sh.roundRect(x, y - jh, jw, jh, 2, { mat: "glassPale", profile: "cylV", z: 1, piece: "jar" });
          sh.rect(x + 1, y - jh, jw - 2, 2, { mat: "iron", profile: "cylH", z: 2, piece: "lid" });
          x += jw + u(0.04);
        } else {
          const tw = u(0.12), th = u(0.16);
          sh.rect(x, y - th, tw, th, { mat: "rust", profile: "bevel", r: 1, depth: 2, z: 1, piece: "tin" });
          x += tw + u(0.06);
        }
      }
    }
    sh.grain({ dir: "h", seed: p.seed, mats: ["wood"], stretch: 18 });
    return { shelf: b.get("shelf"), sway: new Spring(90, 6) };
  },
  initial: "still",
  states: {
    still: {
      update(c: Prop<ShelfRefs>, dt: number) {
        const r = c.refs;
        if (r.sway.resting) return;
        r.sway.step(dt);
        r.shelf.rot = Math.max(-0.05, Math.min(0.05, r.sway.x));
      },
      hit(c, h) {
        c.refs.sway.impulse((h.hit.dir[0] < 0 ? -1 : 1) * (h.hit.type === "wind" ? 0.05 : 0.2));
        if (h.hit.type !== "wind") c.sound("glass.clink", 0.4);
      },
    },
  },
  demo: {
    indoor: true,
    at: 1.2,
    w: 4,
    script: [
      { label: "the keeper's shelves", wait: 1 },
      { label: "slash: they sway and rattle, nothing falls", hit: "slash", from: -0.8, wait: 1.6 },
    ],
  },
});

// ---------------------------------------------------------------------------

/**
 * Ringwater's benches: the kit bench (same look, rocking, splinters and mends) without
 * its own E. A `ring-seat` placed at the same spot sits you down through the runtime,
 * so the camera holds on the room's vista (Pier's End) and the keeper can sit beside you.
 */
const { use: _benchUse, ...benchNoUse } = bench;
void _benchUse;
export const ringBench = defineRecipe({
  ...benchNoUse,
  id: "ringBench",
  reason: "Places to sit and look over the lake (Pier's End, the lodge's loft); sitting goes through the room's seat so the camera holds on the view.",
});
