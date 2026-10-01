// The spire's big doorways (lane R-D): every one is cut into a wall of the
// spire's own iron, never a frame stood on top of it (Dex's door rule). Over a
// kit big door (the lift's gate, an arena shutter) it draws:
//
//   the jambs      (trim "full") one order of plate either side, flush with the wall, the same
//                  width both sides, riveted; (trim "compact") none: the wall around it is a
//                  building with its own plating (the Crown's gatehouses);
//   the reveal     the wall's thickness seen into, the same width both sides, stepping darker in
//                  three bands toward the back (the side facing the light a step lighter);
//   the lintel     a flush beam cut from the wall's courses, exactly as wide as the jambs (no cap,
//                  no overhang), its joint with the wall a dark line, a keystone plate, the route's
//                  red chevrons, a shadowed soffit under it;
//   the threshold  a sill plate level with the floor, worn bright where feet go, a contact shadow
//                  along the foot of each reveal;
//   the inside     what you see through the open doorway: the lift's dark shaft (two guide rails,
//                  cold light coming up from below) or a passage through the wall (dark, the far
//                  side's light on its floor), shadowed under the lintel.
//
// It sits between the kit frame and its leaf: the gate still slides and the shutter still
// rolls up in front of it. Never breaks (dents mend). Origin: the threshold's centre, like the
// door it frames. `SURROUND` is its size, for the rooms that cut the backdrop's wall around it.

import "./materials.ts";
import { defineRecipe } from "../../prop.ts";

export interface PortalParams {
  /** The door it frames: a sliding gate (the lift's shaft behind it) or a rolling shutter (a passage through the wall). */
  kind: "gate" | "shutter";
  /** Chevrons on the lintel. */
  mark: boolean;
  /** "full": its own jamb plates (a doorway in a plain wall: the climb's face); "compact": the reveal, lintel and sill only (the Crown's gatehouses). */
  trim: "full" | "compact";
  /** The lintel's depth, H (doorways side by side share one lintel line: give them the same). NaN: by kind. */
  lintel: number;
}

/** The surround's size in H (half width from the centre, height above the threshold). */
export const SURROUND = {
  gate: { half: 1.73, top: 4.52 },
  shutter: { half: 1.73, top: 4.62 },
  compact: { half: 1.51 },
} as const;

export const spirePortal = defineRecipe<PortalParams, Record<string, never>>({
  id: "spirePortal",
  breakage: "never",
  reason: "The spire's big doorways (the lift's gates, the arena shutters) cut into its iron walls: deep reveals stepping dark, a flush lintel, a sill level with the floor, and the shaft or passage beyond; the red chevrons say this is the way.",
  defaults: { kind: "gate", mark: true, trim: "full", lintel: NaN },
  standard: { w: 3.46, h: 4.52, parts: ["portal"], note: "surrounds a 4 x 2.5 H big door" },
  demo: { w: 6, script: [{ label: "a portal", wait: 0.5 }, { label: "hit: dents, never breaks", hit: "heavy", from: -1.8, wait: 1 }] },
  build(b, p) {
    const u = (f: number): number => b.u(f);
    const shutter = p.kind === "shutter";
    const w = u(2.5), h = u(4);
    const compact = p.trim === "compact";
    const O = compact ? 0 : u(0.22), R = u(0.26), J = O + R;
    const L = u(Number.isFinite(p.lintel) ? p.lintel : shutter ? 0.62 : 0.52);
    const FW = w + J * 2;
    const TH = h + L;
    const f = b.part("portal", { w: FW, h: TH + 4, pivot: [FW >> 1, TH], at: [0, 0], layer: "bg", z: 5, collide: "none" });
    const oy = L; // the opening's top
    const ix = J; // the opening's left edge

    // the inside, first (everything else sits over its edges)
    f.piece("inside");
    f.rect(ix, oy, w, h, { mat: "soot", profile: "flat", z: 0 });
    if (!shutter) {
      // the shaft: two guide rails, cold light coming up from far below in stepped bands
      for (const fx of [0.16, 0.84]) f.rect(ix + Math.round(w * fx) - 1, oy, 3, h, { mat: "spireIronDark", profile: "cylV", z: 2, noInk: true, piece: "rail" });
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

    // the jambs: one order of plate either side, flush with the wall, the same width
    if (O > 0) {
      f.piece("outer");
      for (const [x, lit] of [[0, true], [FW - O, false]] as const) {
        f.rect(x, 0, O, TH, { mat: "spireIron", profile: "bevel", r: 2, depth: 3, z: 4, piece: lit ? "outerL" : "outerR" });
        f.rect(x, 0, 1, TH, { mat: "spireIron", mode: "paint", tone: lit ? 1 : 0 });
        f.rect(x + O - 1, 0, 1, TH, { mat: "spireIronDark", mode: "paint", tone: -1 });
        for (let y = u(0.9); y < TH - 4; y += u(1.1)) f.rect(x, y, O, 1, { mat: "spireIronDark", mode: "paint", tone: -1 });
        const rv: [number, number][] = [];
        for (let y = 8; y < TH - 6; y += u(0.36)) rv.push([x + 4, y], [x + O - 5, y]);
        f.rivets(rv, { mat: "spireIron", r: 1 });
      }
    }
    // the reveal: the wall's thickness, three bands stepping darker toward the back (the left one, away
    // from the light inside the recess, a step darker than the right); both the same width
    f.piece("reveal");
    const band = Math.max(2, Math.round(R / 3));
    for (const [side, base] of [[-1, -1], [1, 0]] as const) {
      for (let k = 0; k < 3; k++) {
        const bw = k < 2 ? band : R - band * 2;
        // from the wall's face (outer) in toward the opening
        const x = side < 0 ? O + k * band : FW - O - k * band - bw;
        f.rect(x, oy, bw, h, { mat: "spireIronDark", profile: "flat", z: 3, tone: Math.max(-2, base - k), piece: side < 0 ? "revealL" : "revealR" });
      }
      // the reveal's outer arris catches a line of light
      f.rect(side < 0 ? O : FW - O - 1, oy, 1, h, { mat: "spireIron", mode: "paint", tone: side < 0 ? 0 : 1 });
      // plate joints across it, staggered
      for (let y = oy + u(0.5) + (side < 0 ? 0 : u(0.25)); y < oy + h; y += u(0.5)) f.rect(side < 0 ? O : FW - O - R, y, R, 1, { mat: "spireIronDark", mode: "paint", tone: -2 });
    }

    // the lintel: a flush beam exactly as wide as the jambs, its joint with the wall a dark line
    f.piece("lintel");
    f.rect(0, 0, FW, L, { mat: "spireIron", profile: "bevel", r: 2, depth: 3, z: 6 });
    f.rect(0, 0, FW, 1, { mat: "spireIronDark", mode: "paint", tone: -2 });
    f.rect(0, 1, FW, 1, { mat: "spireIron", mode: "paint", tone: 1 });
    // its soffit over the reveal, and the shadow it throws into the recess
    f.rect(O, L - 2, FW - O * 2, 2, { mat: "spireIronDark", mode: "paint", tone: -2 });
    const lr: [number, number][] = [];
    for (let x = 5; x < FW - 4; x += u(0.3)) lr.push([x, 5], [x, L - 6]);
    f.rivets(lr, { mat: "spireIron", r: 1 });
    // a keystone plate over the opening's centre
    const kw = u(0.36);
    f.rect(Math.round(FW / 2 - kw / 2), 2, kw, L - 4, { mat: "spireIron", profile: "bevel", r: 2, depth: 3, z: 7, tone: 1, piece: "key" });
    if (p.mark) {
      // red chevrons pointing the way in, painted either side of the keystone
      const cy = Math.round(L * 0.5), cw = u(0.14);
      for (const k of [-3, -2, 2, 3]) {
        const cx = Math.round(FW / 2 + k * cw * 1.5);
        f.stroke([cx - cw / 2, cy - 3, cx, cy + 2, cx + cw / 2, cy - 3], 2, { mat: "routeRed", profile: "flat", z: 8, piece: "chevron" });
      }
    }
    if (shutter) {
      // the shutter's drum housing shows as a heavier band at the lintel's foot, inside the recess
      f.rect(O + R, L - u(0.18), FW - (O + R) * 2, u(0.18), { mat: "spireIronDark", profile: "cylH", z: 7, piece: "drum" });
    }

    // the threshold: a sill plate level with the floor across the opening and the reveals, worn bright in
    // the middle, a contact shadow along the foot of each reveal
    f.piece("sill");
    f.rect(O, TH - 3, FW - O * 2, 5, { mat: "spireIron", profile: "bevel", r: 1, depth: 2, z: 5 });
    f.rect(ix + u(0.5), TH - 3, w - u(1), 1, { mat: "spireIron", mode: "paint", tone: 1 });
    f.rect(O, TH - 6, R, 3, { mat: "spireIronDark", mode: "paint", tone: -2 });
    f.rect(FW - O - R, TH - 6, R, 3, { mat: "spireIronDark", mode: "paint", tone: -2 });

    // weather on the iron: rust and water running down from the lintel's joints
    for (let k = 0; k < Math.round(FW / 24); k++) {
      const x = Math.floor(b.rand() * FW);
      const len = Math.round(u(0.15) + b.rand() * u(0.5));
      f.rect(x, L, 1, len, { mat: "rust", mode: "paint", tone: -1 });
    }
    f.speckle({ amount: 0.06, seed: p.seed, tone: -1, scale: 2 });
    f.wear({ amount: 0.04, seed: p.seed + 3, region: { x0: 0, y0: 1, x1: FW - 1, y1: 2 } });
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
