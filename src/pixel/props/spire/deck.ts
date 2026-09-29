// The spire's walkways (lane R-D): the iron catwalks bolted to the outer
// climb, the landing at the lift's break and the Crown's arena floor. Tread
// plate on top (a lit, wet lip), a riveted girder under it (a truss on the
// catwalks, deep plate on the landing and the arena), and on a catwalk's open
// end a 0.3 H lip with the route's red on it, the thing that stops a gust from
// pushing you off. It is the ground here: hits dent it and throw sparks,
// heavy hits buckle the plate into a crater with a torn rim, and it all mends
// (breakage "floor"). The room's terrain carries the collision; this is what
// you see and hit. Origin: the walkway's left end, on its surface.

import "./materials.ts";
import { crater, scar } from "../../break.ts";
import type { Hit } from "../../hits.ts";
import { puff } from "../../kit.ts";
import { defineRecipe } from "../../prop.ts";

export interface DeckParams {
  /** Length in px (world). */
  width: number;
  /** Girder depth below the surface, in H. */
  depth: number;
  /** "catwalk" (truss under), "landing" (deep plate), "arena" (plate with a wide inlaid band). */
  kind: "catwalk" | "landing" | "arena";
  /** Which end carries the 0.3 H lip. */
  lip: "west" | "east" | "none";
}

const LIP_H = 0.3;
const LIP_W = 0.22;

function hitPoint(hit: Hit): [number, number] | null {
  const s = hit.shape;
  if (s.kind === "circle" || s.kind === "point") return [s.x, s.y];
  if (s.kind === "rect") return [s.x + s.w / 2, s.y + s.h];
  if (s.kind === "arc") return [s.x, s.y];
  if (s.kind === "line") return [s.x1, s.y1];
  return null;
}

export const spireDeck = defineRecipe<DeckParams, { head: number }>({
  id: "spireDeck",
  breakage: "floor",
  reason: "The spire's walkways: iron catwalks on the storm face, the landing at the lift's break, the arena floor; they take her hits as dents, sparks and buckled plate, and mend.",
  defaults: { width: 640, depth: 0.42, kind: "catwalk", lip: "none" },
  cues: ["metal.hit", "metal.crater"],
  standard: { w: 8, parts: ["deck"], note: "a catwalk 8 H long; its lip (the gust stop) is 0.3 H" },
  demo: {
    w: 12,
    params: { width: 640, depth: 0.42, kind: "catwalk", lip: "west" },
    variants: [{ label: "landing", params: { width: 320, depth: 1.0, kind: "landing", lip: "none" }, dx: 3.2, at: 0 }],
    script: [
      { label: "catwalk with its lip", wait: 0.5 },
      { label: "slash: dents and sparks", hit: "slash", from: -1.2, wait: 1 },
      { label: "heavy: the plate buckles", hit: "heavy", from: -1.0, wait: 1.2 },
      { label: "Q: a crater, torn plate flies", hit: "q", from: 1.4, wait: 2 },
      { label: "mends", wait: 9 },
    ],
  },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const W = Math.max(8, Math.ceil(p.width));
    const lipH = p.lip === "none" ? 0 : u(LIP_H);
    // rows above the surface for dents and crater rims (the lip is its own small part)
    const head = 10;
    const D = Math.max(u(0.2), u(p.depth));
    const f = b.part("deck", { w: W, h: head + D, pivot: [0, head], at: [0, 0], layer: "mid", collide: "none", ground: true, z: -5 });
    const top = head;
    const plate = p.kind === "catwalk" ? 5 : 7;
    // tread plate
    f.piece("plate");
    f.rect(0, top, W, plate, { mat: "spireIron", profile: "bevel", r: 2, depth: 3, z: 2 });
    f.rect(0, top, W, 1, { mat: "spireIron", mode: "paint", tone: 1 });
    // raised diamond ticks on the tread (every 6 px, alternating)
    for (let x = 3; x < W - 3; x += 6) f.pixels([[x, top + 2], [x + 1, top + 1 + ((x / 6) % 2 === 0 ? 0 : 2)]], { mat: "spireIron", mode: "raise", tone: 0 });
    // the girder under it
    f.piece("girder");
    if (p.kind === "catwalk") {
      const g0 = top + plate, g1 = top + D;
      const fl = 3;
      f.rect(0, g0, W, fl, { mat: "spireIronDark", profile: "bevel", r: 1, depth: 2, z: 1 });
      f.rect(0, g1 - fl, W, fl, { mat: "spireIronDark", profile: "bevel", r: 1, depth: 2, z: 1, piece: "flange" });
      // Warren truss: diagonals between the flanges, open between them
      const bay = u(0.5);
      const hh = g1 - fl - (g0 + fl);
      for (let x = 0; x < W; x += bay) {
        f.stroke([x, g0 + fl, x + bay / 2, g0 + fl + hh], 3, { mat: "spireIronDark", profile: "cylV", z: 0, piece: "web" });
        f.stroke([x + bay / 2, g0 + fl + hh, x + bay, g0 + fl], 3, { mat: "spireIronDark", profile: "cylV", z: 0, piece: "web" });
      }
      // rivets along the flanges
      const pts: [number, number][] = [];
      for (let x = 4; x < W - 3; x += u(0.25)) pts.push([x, g0 + 1], [x, g1 - 2]);
      f.rivets(pts, { mat: "spireIron", r: 1 });
      // brackets back to the face every few bays (they read as bolted to the spire)
      for (let x = u(1.5); x < W - u(1); x += u(3.2)) f.poly([x, g0, x + 5, g0, x + 5, g1 + u(0.35), x, g1 + u(0.35) - 4], { mat: "spireIronDark", profile: "bevel", r: 1, depth: 2, z: 1, piece: "bracket" });
    } else {
      // deep plate in courses with a shadowed underside
      const g0 = top + plate;
      const course = u(p.kind === "arena" ? 0.32 : 0.28);
      for (let y = g0, k = 0; y < top + D; y += course, k++) {
        const hh = Math.min(course, top + D - y);
        f.rect(0, y, W, hh, { mat: k === 0 ? "spireIron" : "spireIronDark", profile: "bevel", r: 1, depth: 2, z: 1, tone: k > 1 ? -1 : 0, piece: `course${k % 2}` });
        // plate joints, staggered
        const jw = u(1.1 + (k % 3) * 0.2);
        for (let x = (k % 2) * (jw >> 1); x < W; x += jw) f.rect(x, y, 1, hh, { mat: "spireIronDark", mode: "paint", tone: -1 });
        const pts: [number, number][] = [];
        for (let x = 3 + (k % 2) * 4; x < W - 2; x += u(0.3)) pts.push([x, y + 2]);
        if (hh > 5) f.rivets(pts, { mat: "spireIron", r: 1 });
      }
      if (p.kind === "arena") {
        // an inlaid band of old brass under the lip, worn
        f.rect(0, top + plate, W, 2, { mat: "bronze", mode: "paint", tone: -1 });
      }
    }
    f.speckle({ amount: 0.06, seed: p.seed + 5, tone: -1, scale: 2 });
    f.wear({ amount: 0.05 + p.wear * 0.15, seed: p.seed + 4, region: { x0: 0, y0: top, x1: W - 1, y1: top + 1 } });
    // streaks of rust and old water running down the girder
    for (let k = 0; k < Math.max(2, W / 120); k++) {
      const x = Math.floor(b.rand() * W);
      f.rect(x, top + plate, 1, Math.round(D * (0.3 + b.rand() * 0.6)), { mat: "rust", mode: "paint", tone: -1 });
    }
    // the lip at the open end, painted with the route's red (its own part: the deck needs no headroom for it)
    if (p.lip !== "none") {
      const lw = u(LIP_W);
      const lp = b.part("lip", { w: lw, h: lipH + plate, pivot: [0, lipH], at: [p.lip === "west" ? 0 : W - lw, 0], layer: "mid", collide: "none", z: -4 });
      lp.rect(0, 0, lw, lipH + plate, { mat: "spireIron", profile: "bevel", r: 2, depth: 4, z: 4 });
      lp.rect(0, 0, lw, 1, { mat: "spireIron", mode: "paint", tone: 1 });
      lp.rect(2, 4, lw - 4, Math.round(lipH * 0.4), { mat: "routeRed", mode: "paint", tone: 0 });
      lp.rivets([[3, lipH - 3], [lw - 4, lipH - 3]], { mat: "spireIron", r: 1 });
    }
    return { head };
  },
  initial: "idle",
  states: {
    idle: {
      hit(c, h) {
        const part = c.part("deck");
        const hit = h.hit;
        if (hit.type === "wind") return;
        // metal: dents and sparks everywhere the hit touches
        c.damage(hit);
        if (c.keepsCells) return;
        if (hit.crater) {
          const at = hitPoint(hit);
          if (at) {
            crater(c.world, part, at[0], at[1], hit.crater.rx * 0.8, hit.crater.ry * 0.7, Math.max(2, hit.crater.rim - 1), hit);
            puff(c.world, "spark", at[0], at[1] - 2, 10, [0, -1], { speed: 1.2 });
          }
        }
        if (hit.scar) scar(c.world, part, hit);
      },
    },
  },
});
