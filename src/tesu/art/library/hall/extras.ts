// The hall's ambient people (hall loop round 3, W1-5: "zero people apart from the cast boxes; a guildhall with an
// empty gallery reads as a museum after hours"). Not cast: nobody here talks or moves on its own, nothing is usable,
// and they stand off the services' F zones. Patrons at the Long Gallery's rail looking at the art, a clerk on the
// stair's landing with an armful of scrolls, someone reading the Notice Wall, a figure in a lit loft upstairs.
//
// Each is one standing figure, side-on, in the room's light: a long robe with wide sleeves and a sash, a cream
// cross-collar, the hair up in a bun or under a scholar's cap; the side toward the nearest lamp catches a rim, the
// rest stays in the warm dark, so they read as people at a glance and never as services. Sized to her (0.88 H).
//
// Coordinates: local px of the plane, the anchor between the feet on the floor; `s` is the plane's px per H.

import { definePainter } from "../../painter.ts";
import { P } from "../../palette.ts";
import { HALL_LIGHT } from "./lights.ts";
import { M, LitField, clamp, face, hash, mt, rect, tn, type At, type Ramp } from "./kit.ts";

export interface ExtraP {
  /** What they are doing: looking at something, carrying scrolls, reading a board above them, leaning on a rail;
   *  (round 4, W1-c) holding a wrapped bundle while they wait, carrying a crate in both arms, pointing up at
   *  something, asleep slumped over a desk (only the upper body: the desk hides the rest). */
  pose: "look" | "scrolls" | "read" | "lean" | "bundle" | "crate" | "point" | "doze";
  /** Their size against an adult's (a child about 0.68). */
  k?: number;
  /** (round 4) The robe's dye by index into ROBES (else from the seed), and how much of the light they take (1 all of
   *  it; less for one who stands in a strong light and must stay a figure against it, not a lamp). */
  robe?: number;
  dim?: number;
  /** 1 faces right, -1 left. */
  facing: 1 | -1;
  /** The plane's px per H (96 on the play plane). */
  s: number;
  seed: number;
  at?: At;
}

type Pt = readonly [number, number];

/** Point in polygon (even-odd), in figure units. */
function inPoly(pts: readonly Pt[], u: number, v: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ui, vi] = pts[i]!, [uj, vj] = pts[j]!;
    if ((vi > v) !== (vj > v) && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}

/** Distance from (u, v) to the segment a-b (figure units). */
function segD(u: number, v: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = clamp(((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(u - a[0] - dx * t, v - a[1] - dy * t);
}

// the robe from the hem up to the shoulders (forward = +u, up = +v, in H)
const ROBE: Pt[] = [[-0.15, 0.025], [0.165, 0.025], [0.135, 0.15], [0.112, 0.3], [0.1, 0.44], [0.118, 0.56], [0.116, 0.64], [0.075, 0.69], [-0.075, 0.69], [-0.108, 0.645], [-0.112, 0.5], [-0.1, 0.44], [-0.108, 0.3], [-0.128, 0.15]];

type Part = "none" | "robe" | "sleeve" | "skin" | "hair" | "collar" | "sash" | "shoe" | "scroll" | "scrollEnd" | "pin" | "cloth" | "knot" | "crate" | "crateEdge";

// (round 4) asleep at a desk's end: seated on a stool, the back hunched forward from the hips, the arms folded along
// the desk's top (0.6 H) and the head laid on them
const DOZE_BACK: Pt[] = [[-0.13, 0.36], [0.08, 0.36], [0.18, 0.5], [0.27, 0.61], [0.25, 0.67], [0.13, 0.735], [0.0, 0.735], [-0.1, 0.63], [-0.145, 0.48]];

/** Which part of the figure a point is (figure units, facing +u). Later parts sit in front. */
function part(pose: ExtraP["pose"], cap: boolean, u0: number, v: number): Part {
  // leaning on a rail: the upper body tilts forward from the hips
  const u = pose === "lean" && v > 0.36 ? u0 - (v - 0.36) * 0.22 : u0;
  const headUp = pose === "read" ? 0.012 : 0;
  // (round 4) asleep on a stool at a desk's end: no standing figure at all
  if (pose === "doze") {
    const hd = Math.hypot((u - 0.35) / 0.062, (v - 0.712) / 0.058);
    if (hd < 1) return v < 0.69 && u > 0.37 ? "skin" : "hair";
    if (Math.hypot(u - 0.3, v - 0.772) < 0.027) return "hair";
    if (inPoly([[0.17, 0.6], [0.5, 0.6], [0.52, 0.632], [0.49, 0.665], [0.2, 0.68]], u, v)) return "sleeve";
    if (inPoly(DOZE_BACK, u, v)) {
      if (v > 0.6 && Math.abs(u - (0.2 - (v - 0.6) * 1.3)) < 0.016) return "collar";
      if (Math.abs(v - 0.42 - (u + 0.1) * 0.35) < 0.02) return "sash";
      return "robe";
    }
    // the thighs forward, the shins down to the floor, the shoes; the stool under the hips
    if (inPoly([[-0.1, 0.33], [0.27, 0.33], [0.29, 0.41], [-0.08, 0.45]], u, v)) return "robe";
    if (u > 0.2 && u < 0.285 && v > 0.03 && v < 0.35) return "robe";
    if (v >= 0 && v < 0.035 && u > 0.18 && u < 0.34) return "shoe";
    if (v > 0.29 && v < 0.33 && u > -0.17 && u < 0.07) return "crate";
    if ((Math.abs(u + 0.14) < 0.017 || Math.abs(u - 0.04) < 0.017) && v >= 0 && v <= 0.29) return "crateEdge";
    return "none";
  }
  // what is held in front (drawn over the body)
  if (pose === "bundle") {
    // a parcel wrapped in a cloth, its knot on top, held at the hip in both hands
    if (Math.hypot(u - 0.11, v - 0.545) < 0.028) return "knot";
    if (inPoly([[0.0, 0.38], [0.22, 0.38], [0.235, 0.5], [0.2, 0.53], [0.02, 0.53], [-0.01, 0.5]], u, v)) return "cloth";
    if (segD(u, v, [0.0, 0.63], [0.1, 0.46]) < 0.04) return "sleeve";
    if (Math.hypot(u - 0.215, v - 0.44) < 0.022) return "skin";
  } else if (pose === "crate") {
    // a timber crate carried before the chest in both arms, the body leaning back a little under it
    if (u > 0.04 && u < 0.32 && v > 0.36 && v < 0.6) {
      const e = Math.min(u - 0.04, 0.32 - u, v - 0.36, 0.6 - v);
      return e < 0.018 || Math.abs(v - 0.48) < 0.008 ? "crateEdge" : "crate";
    }
    if (segD(u, v, [0.0, 0.63], [0.07, 0.5]) < 0.04) return "sleeve";
    if (Math.hypot(u - 0.07, v - 0.47) < 0.024) return "skin";
  } else if (pose === "point") {
    // the near arm up and forward, pointing at something above eye level
    if (Math.hypot(u - 0.255, v - 0.8) < 0.022) return "skin";
    if (segD(u, v, [0.255, 0.8], [0.29, 0.82]) < 0.012) return "skin";
    if (segD(u, v, [0.03, 0.63], [0.23, 0.78]) < 0.042) return "sleeve";
  }
  if (pose === "scrolls") {
    // an armful of rolled scrolls across the chest, their far ends dark caps, one longer than the rest
    const rolls: [number, number, number][] = [[0.0, 0.53, 0.27], [-0.02, 0.568, 0.31], [0.025, 0.606, 0.25], [0.01, 0.492, 0.22]];
    for (const [a, b, len] of rolls) {
      const vv = b + (u - a) * 0.14;
      if (u > a && u < a + len && Math.abs(v - vv) < 0.021) return u > a + len - 0.026 ? "scrollEnd" : "scroll";
    }
    if (segD(u, v, [0.02, 0.63], [0.15, 0.52]) < 0.045 || inPoly([[0.12, 0.56], [0.2, 0.5], [0.19, 0.47], [0.1, 0.49]], u, v)) return "sleeve";
    if (Math.hypot(u - 0.2, v - 0.52) < 0.022) return "skin";
  } else if (pose === "read") {
    // the near arm raised toward the board above, the wide sleeve fallen back to the elbow
    if (Math.hypot(u - 0.235, v - 0.86) < 0.022) return "skin";
    if (segD(u, v, [0.17, 0.79], [0.225, 0.845]) < 0.02) return "skin";
    if (segD(u, v, [0.03, 0.64], [0.17, 0.78]) < 0.05) return "sleeve";
  } else if (pose === "lean") {
    // forearms laid along the rail, the sleeves hanging from them
    if (inPoly([[0.0, 0.64], [0.24, 0.6], [0.26, 0.56], [0.2, 0.5], [0.04, 0.54]], u0, v)) return "sleeve";
    if (Math.hypot(u0 - 0.26, v - 0.585) < 0.02) return "skin";
  } else {
    // hands folded in the sleeves in front of the body: one wide sleeve mass hanging from both arms
    if (inPoly([[-0.02, 0.645], [0.125, 0.6], [0.17, 0.5], [0.168, 0.4], [0.12, 0.37], [0.05, 0.38], [0.0, 0.46]], u, v)) return "sleeve";
  }
  // the head: hair at the back and top (a bun with a pin, or a scholar's cap), the face forward
  const hu = u - 0.018, hv = v - 0.775 - headUp;
  if (cap) {
    if (hv > 0.035 && hv < 0.105 && Math.abs(hu + 0.004) < 0.062 - Math.max(0, hv - 0.085) * 1.2) return "hair";
    if (hv > 0.05 && hv < 0.1 && hu < -0.05 && hu > -0.09) return "hair";
  } else {
    if (Math.hypot(hu + 0.03, hv - 0.075) < 0.036) return Math.abs(hu + 0.03 + 0.01) < 0.006 && hv > 0.06 ? "pin" : "hair";
  }
  const hd = Math.hypot(hu / 0.06, hv / 0.068);
  if (hd < 1) return hu < -0.008 + hv * 0.4 || hv > 0.035 ? "hair" : "skin";
  // the neck, the cream cross-collar, the sash, the robe, the shoes
  if (v > 0.66 && v < 0.715 && u > -0.02 && u < 0.035) return "skin";
  if (inPoly(ROBE, u, v)) {
    const cx = 0.03 + (0.69 - v) * 0.55;
    if (v > 0.56 && Math.abs(u - cx) < 0.017) return "collar";
    if (Math.abs(v - 0.44) < 0.02) return "sash";
    if (u > 0.055 && u < 0.075 && v > 0.27 && v < 0.43) return "sash";
    return "robe";
  }
  if (v >= 0 && v < 0.035 && ((u > -0.1 && u < -0.01) || (u > 0.03 && u < 0.13))) return "shoe";
  return "none";
}

const ROBES: Ramp[] = [P.jade, P.blue, M.verm, P.earth, P.mauve, P.timber];
const SASHES: Ramp[] = [M.gold, M.verm, P.paper, P.blue];

export const extra = definePainter<ExtraP>("hall.extra", {
  bounds(p) {
    return [-0.4 * p.s, -1.0 * p.s, 0.4 * p.s, 4];
  },
  paint(c, p) {
    const s = p.s * (p.k ?? 1), f = p.facing;
    const lf = new LitField(HALL_LIGHT, p.at, 8);
    const robe = ROBES[p.robe ?? Math.floor(hash(p.seed, 1, 71) * ROBES.length)]!;
    const dim = p.dim ?? 1;
    const sash = SASHES[Math.floor(hash(p.seed, 2, 71) * SASHES.length)]!;
    const cap = hash(p.seed, 3, 71) < 0.45 && (p.k ?? 1) > 0.8;
    const cloth = SASHES[Math.floor(hash(p.seed, 4, 71) * SASHES.length)] === P.blue ? P.jade : P.blue;
    const at = (lx: number, ly: number): Part => part(p.pose, cap, (lx / s) * f, -ly / s);
    const step = 1 / c.d;
    rect(c, -0.4 * s, -1.0 * s, 0.4 * s, 2, (X, Y, lx, ly) => {
      const pt = at(lx, ly);
      if (pt === "none") return 0;
      const l = lf.get(lx, ly);
      // the rim: this pixel is on the silhouette's edge facing the light (the next pixel toward the light is air)
      const sx = Math.sign(l.dx) || 1, sy = Math.abs(l.dy) > 0.35 ? Math.sign(l.dy) : 0;
      const rim = at(lx + sx * step, ly + sy * step) === "none";
      const back = at(lx - sx * step, ly) === "none";
      const side = clamp(l.dx * 1.6, -1, 1);
      // a round body: the normal leans out at its edges
      const nx = clamp((lx / s) * 6, -1, 1) * 0.6;
      // (they stand in the hall's dim middle distance: a step of fill so a robe reads as a robe, not a hole)
      const lit = face(l.k, side, nx, 0) * 0.75 * dim + 0.12 + (rim ? 0.42 * Math.min(1, dim + 0.25) : 0) - (back ? 0.08 : 0);
      switch (pt) {
        case "skin": return mt(P.skin, lit + 0.2, X, Y, 0.15, 1);
        case "hair": return rim ? tn(P.umber, 0.35, X, Y, 0) : tn(P.ink, 0.15, X, Y, 0);
        case "pin": return tn(M.gold, 0.25, X, Y, 0);
        case "collar": return mt(M.paper, lit + 0.15, X, Y, 0.1, 0.9);
        case "sash": return mt(sash, lit, X, Y, 0.15, 1);
        case "shoe": return tn(P.ink, 0.1, X, Y, 0);
        case "scroll": return mt(M.paper, lit + 0.2, X, Y, 0.05, 0.85);
        case "scrollEnd": return tn(M.wood, rim ? 0.4 : 0.7, X, Y, 0);
        case "sleeve": return mt(robe, lit - 0.04, X, Y, 0.12, 0.95);
        case "cloth": return mt(cloth, lit + 0.05 - (-ly / s < 0.42 ? 0.06 : 0), X, Y, 0.1, 0.9);
        case "knot": return mt(cloth, lit + 0.15, X, Y, 0.05, 0.85);
        case "crate": return mt(M.wood, lit + 0.08 + (Math.abs(Math.sin((ly / s) * 70)) > 0.92 ? -0.12 : 0), X, Y, 0.15, 1);
        case "crateEdge": return mt(M.wood, lit - 0.08, X, Y, 0.25, 1);
        default: {
          // the robe's long folds: two soft vertical shadows down the skirt
          const fold = -ly / s < 0.42 && Math.abs(Math.sin((lx / s) * 34 + p.seed)) > 0.9 ? -0.06 : 0;
          return mt(robe, lit + fold, X, Y, 0.12, 0.95);
        }
      }
    });
  },
});
