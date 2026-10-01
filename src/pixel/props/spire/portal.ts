// The spire's big doorways (lane R-D): every one is cut into a wall of the
// spire's own iron, never a frame stood on top of it (Dex's door rule). Over a
// kit big door (the lift's gate, an arena shutter) it draws:
//
//   the surround   two orders of heavy plate stepping in toward the opening (the outer
//                  order lit on its top and planet-side edges, the inner one a dark reveal:
//                  the thickness of the wall you see into), riveted;
//   the lintel     a deep riveted beam bearing on both jambs past the opening, the route's
//                  red chevrons on it, corbels under its ends, and a hood over it with a lit
//                  top and a drip edge (the rain runs off it, not down the doorway);
//   the threshold  a sill plate across the opening, worn bright where feet go;
//   the inside     what you see through the open doorway: the lift's dark shaft (its cables,
//                  a guide rail, cold light coming up from below) or a passage through the
//                  wall (dark, the far side's light on its floor), shadowed under the lintel.
//
// It sits between the kit frame and its leaf: the gate still slides and the shutter still
// rolls up in front of it. Never breaks (dents mend). Origin: the threshold's centre, like the
// door it frames. `SURROUND` is its size, for the rooms that cut the backdrop's wall around it.

import "./materials.ts";
import { defineRecipe } from "../../prop.ts";

export interface PortalParams {
  /** The door it frames: a sliding gate (the lift's shaft behind it) or a rolling shutter (a passage through the wall; its housing is deeper). */
  kind: "gate" | "shutter";
  /** Chevrons on the lintel. */
  mark: boolean;
  /** "full": its own outer order and a hood (a doorway in a plain wall: the climb's face); "compact": the reveal, beam and sill only (the wall around it is a building that has its own plating: the Crown's gatehouses). */
  trim: "full" | "compact";
}

/** The surround's size in H (half width from the centre, height above the threshold), per kind. */
export const SURROUND = {
  gate: { half: 2.01, top: 4.72 },
  shutter: { half: 2.01, top: 4.92 },
  compact: { half: 1.61 },
} as const;

export const spirePortal = defineRecipe<PortalParams, Record<string, never>>({
  id: "spirePortal",
  breakage: "never",
  reason: "The spire's big doorways (the lift's gates, the arena shutters) cut into its iron walls: deep reveals, a lintel and hood, a worn sill, and the shaft or passage beyond; the red chevrons say this is the way.",
  defaults: { kind: "gate", mark: true, trim: "full" },
  standard: { w: 4.02, h: 4.72, parts: ["portal"], note: "surrounds a 4 x 2.5 H big door" },
  demo: { w: 6, script: [{ label: "a portal", wait: 0.5 }, { label: "hit: dents, never breaks", hit: "heavy", from: -1.8, wait: 1 }] },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const shutter = p.kind === "shutter";
    const w = u(2.5), h = u(4);
    // orders: the outer plate and the inner reveal; the lintel, the hood over it
    const compact = p.trim === "compact";
    const O = compact ? 0 : u(0.22), R = u(0.26), J = O + R;
    const L = u(shutter ? 0.72 : 0.52), HD = u(0.2), bear = u(0.1), hoodOut = compact ? 0 : u(0.18);
    const FW = w + J * 2;
    const ox = hoodOut + bear; // the hood's overhang at each side
    const TW = FW + ox * 2;
    const TH = h + L + HD;
    const f = b.part("portal", { w: TW, h: TH + 4, pivot: [TW >> 1, TH], at: [0, 0], layer: "bg", z: 5, collide: "none" });
    const x0 = ox; // the surround's left edge
    const oy = HD + L; // the opening's top
    const ix = x0 + J; // the opening's left edge

    // the inside, first (everything else sits over its edges)
    f.piece("inside");
    f.rect(ix, oy, w, h, { mat: "soot", profile: "flat", z: 0 });
    if (!shutter) {
      // the shaft: plated back wall, two guide rails, the hoist cables, cold light from below
      for (const fx of [0.2, 0.8]) f.rect(ix + Math.round(w * fx) - 1, oy, 3, h, { mat: "spireIronDark", profile: "cylV", z: 2, noInk: true, piece: "rail" });
      for (const fx of [0.42, 0.56]) f.rect(ix + Math.round(w * fx), oy, 1, h, { mat: "spireIron", mode: "over", z: 3, tone: -1, noInk: true, piece: "cable" });
      // light coming up the shaft from far below: three stepped bands at the foot
      f.rect(ix, oy + h - u(0.16), w, u(0.16), { mat: "spireIronDark", mode: "paint", tone: 0 });
      f.rect(ix, oy + h - u(0.34), w, u(0.18), { mat: "spireIronDark", mode: "paint", tone: -1 });
    } else {
      // a passage through the wall: dark, the far side's cold light lying along its floor
      f.rect(ix, oy + h - u(0.22), w, u(0.22), { mat: "spireIronDark", mode: "over", z: 1, noInk: true });
      f.rect(ix + u(0.4), oy + h - u(0.1), w - u(0.8), u(0.1), { mat: "spireIron", mode: "over", z: 2, tone: -1, noInk: true });
    }
    // under the lintel the inside is darkest (the soffit's shadow), stepped
    f.rect(ix, oy, w, u(0.3), { mat: "soot", mode: "paint", tone: -1 });
    f.rect(ix, oy + u(0.3), w, u(0.14), { mat: "soot", mode: "paint", tone: 0 });

    // the surround: the outer order (lit edges toward the planet and the sky)
    f.piece("outer");
    if (O > 0) for (const [x, lit] of [[x0, true], [x0 + FW - O, false]] as const) {
      f.rect(x, oy - u(0.06), O, h + u(0.06), { mat: "spireIron", profile: "bevel", r: 3, depth: 6, z: 4, piece: lit ? "outerL" : "outerR" });
      f.rect(lit ? x : x + O - 2, oy, 2, h, { mat: "spireIron", mode: "paint", tone: lit ? 1 : -1 });
      // plate joints, and rivets down both edges
      for (let y = oy + u(0.9); y < oy + h - 4; y += u(1.1)) f.rect(x, y, O, 1, { mat: "spireIronDark", mode: "paint", tone: -1 });
      const rv: [number, number][] = [];
      for (let y = oy + 8; y < oy + h - 6; y += u(0.36)) rv.push([x + 4, y], [x + O - 5, y]);
      f.rivets(rv, { mat: "spireIron", r: 1 });
    }
    // the inner order: the reveal, the wall's thickness seen into (the planet-side one in shadow)
    f.piece("reveal");
    f.rect(x0 + O, oy, R, h, { mat: "spireIronDark", profile: "bevel", r: 2, depth: 3, z: 3, tone: -1, piece: "revealL" });
    f.rect(x0 + FW - O - R, oy, R, h, { mat: "spireIronDark", profile: "bevel", r: 2, depth: 3, z: 3, tone: 0, piece: "revealR" });
    // the reveal's edge against the opening catches a thin line of light
    f.rect(x0 + FW - O - R, oy, 1, h, { mat: "spireIronDark", mode: "paint", tone: 1 });
    for (let y = oy + u(0.5); y < oy + h; y += u(0.5)) {
      f.rect(x0 + O, y, R, 1, { mat: "spireIronDark", mode: "paint", tone: -2 });
      f.rect(x0 + FW - O - R, y + u(0.25), R, 1, { mat: "spireIronDark", mode: "paint", tone: -2 });
    }

    // the lintel: a deep beam bearing past the jambs, corbels under its ends
    f.piece("lintel");
    f.rect(x0 - bear, HD, FW + bear * 2, L, { mat: "spireIron", profile: "bevel", r: 3, depth: 7, z: 6 });
    f.rect(x0 - bear, HD, FW + bear * 2, 1, { mat: "spireIron", mode: "paint", tone: 1 });
    f.rect(x0 - bear, HD + L - 3, FW + bear * 2, 3, { mat: "spireIronDark", mode: "paint", tone: -1 });
    // its soffit over the reveal: a stepped shadow band
    f.rect(x0 + O, oy, FW - O * 2, 2, { mat: "spireIronDark", mode: "paint", tone: -2 });
    const lr: [number, number][] = [];
    for (let x = x0 - bear + 5; x < x0 + FW + bear - 4; x += u(0.3)) lr.push([x, HD + 4], [x, HD + L - 6]);
    f.rivets(lr, { mat: "spireIron", r: 1 });
    for (const cx of [x0 - bear, x0 + FW + bear - u(0.2)]) {
      f.poly([cx, oy - 2, cx + u(0.2), oy - 2, cx + u(0.2), oy + u(0.16), cx + u(0.06), oy + u(0.3), cx, oy + u(0.3)], { mat: "spireIron", profile: "bevel", r: 2, depth: 4, z: 5, piece: "corbel" });
    }
    if (p.mark) {
      // red chevrons pointing the way in, painted on the beam
      const cy = HD + Math.round(L * 0.48), cw = u(0.16);
      for (let k = -2; k <= 2; k++) {
        const cx = Math.round(TW / 2 + k * cw * 1.6);
        f.stroke([cx - cw / 2, cy - 3, cx, cy + 2, cx + cw / 2, cy - 3], 2, { mat: "routeRed", profile: "flat", z: 8, piece: "chevron" });
      }
    }
    if (shutter) {
      // the shutter's drum housing shows as a heavier band at the beam's foot
      f.rect(x0 + O, HD + L - u(0.2), FW - O * 2, u(0.2), { mat: "spireIronDark", profile: "cylH", z: 7, piece: "drum" });
    }
    // the hood: a thin cornice over the beam, lit on top, a drip edge under it
    f.piece("hood");
    f.rect(0, 0, TW, HD, { mat: "spireIron", profile: "bevel", r: 2, depth: 5, z: 7 });
    f.rect(0, 0, TW, 1, { mat: "spireIron", mode: "paint", tone: 1 });
    f.rect(0, HD - 2, TW, 2, { mat: "spireIronDark", mode: "paint", tone: -1 });
    for (let x = 3; x < TW - 2; x += u(0.22)) f.pixels([[x, HD], [x, HD + 1]], { mat: "spireIronDark", mode: "over", z: 7, noInk: true });

    // the threshold: a sill plate across the opening and the reveals, worn bright in the middle
    f.piece("sill");
    f.rect(x0 + O - 2, TH - u(0.1), FW - O * 2 + 4, u(0.1) + 2, { mat: "spireIron", profile: "bevel", r: 1, depth: 2, z: 5 });
    f.rect(ix + u(0.5), TH - u(0.1), w - u(1), 1, { mat: "spireIron", mode: "paint", tone: 1 });

    // weather on the iron: rust and water stains running down from the hood and the beam
    for (let k = 0; k < Math.round(TW / 30); k++) {
      const x = Math.floor(b.rand() * TW);
      const len = Math.round(u(0.15) + b.rand() * u(0.5));
      f.rect(x, HD, 1, len, { mat: "rust", mode: "paint", tone: -2 });
    }
    f.speckle({ amount: 0.06, seed: p.seed, tone: -1, scale: 2 });
    f.wear({ amount: 0.04, seed: p.seed + 3, region: { x0: 0, y0: 0, x1: TW - 1, y1: 1 } });
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
