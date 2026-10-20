// The back wall's upper storey over its lintel (the hall loop, round 2, W2-8: the round-1 upper wall
// was stamped slot rows and one repeated bracket, crushed by the shell's dusk into a flat field).
//
// Seen across the room from the Long Gallery, in the cool dark over the art:
// - on the lintel, a row of bracket sets (a bearing block, then three tiers of arms, each wider, small
//   blocks on their ends, the projecting arms' painted end faces at their middles): heavy ones on the
//   columns, a lighter one or two between, their paint differing by bay (teal and blue, one set red, one
//   worn to the timber); each throws its shadow down and right onto the red panels between them;
// - the panels between the sets, each with its own faded motif (a lotus, a flaming pearl, a cloud, or
//   nothing left), the cornice beam's shadow along their tops;
// - the cornice beam, painted, its ends whorled at the columns;
// - over it, every bay its own: an open storage loft (a rail, stacked crates, scroll bundles and jars, a
//   paper lamp lighting it from inside, now and then an archivist), a straight-bar clerestory with the
//   night beyond, the roof's beam ends coming through the wall with a hanging lamp, or a long silk banner
//   hung down over the brackets and the lintel;
// - posts at the column lines between them, the lofts' ceiling beam, and the rafters going up into the
//   dark.
// Values are painted low and cool (hall-light.ts lays one step of dusk over it all and none in a loft's
// lit box); light comes from above and the left (the skylight's side), so tops and left faces are lit and
// shadows fall down and right.

import type { PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4 } from "../../raster.ts";
import { SCREEN, LitField, clamp, fbm, grain, hash, rect, tn, vnoise, type Ramp } from "./kit.ts";
import type { BackWallP, Bay } from "./backwall.ts";

/** Heights over the floor in H (times the plane's u). */
export const UP = { lintel: 14.2, sets: 15.5, cornice: 15.9, ceil: 17.5, ceilT: 17.8 } as const;

export type UpperKind = "loft" | "beams" | "lattice" | "banner";
/** What fills each bay over the cornice, by the bay's index (bays every 4.25 H from 15 H west of the hall's west wall). */
export const UPPER_KINDS: UpperKind[] = ["beams", "loft", "lattice", "banner", "loft", "lattice", "beams", "loft", "banner", "lattice", "loft", "beams", "lattice", "banner", "loft"];

/** A post's half width at the column lines over the cornice (H). */
const POST = 0.13;

/** A loft's opening across its bay, H from the bay's west column: [x0, x1]. */
export function loftOpening(): [number, number] {
  return [POST, 4.25 - POST];
}

/** Whether a loft has a post in its middle (its lamp then hangs off it). */
function midPost(seed: number): boolean {
  return hash(seed, 61) < 0.5;
}

/** Where a loft's lamp hangs across its opening (share of the opening's width), from the bay's seed. */
export function loftLampFrac(seed: number): number {
  const f = 0.3 + 0.4 * hash(seed, 31);
  // never on the middle post
  return midPost(seed) && Math.abs(f - 0.5) < 0.12 ? (f < 0.5 ? 0.36 : 0.64) : f;
}

// ---------------------------------------------------------------------------------------------------
// Ramps (light to dark)
// ---------------------------------------------------------------------------------------------------
const TEAL: Ramp = [P.jade[4]!, P.jade[5]!, P.jade[6]!, P.jade[7]!, P.dusk[4]!, P.dusk[5]!];
const BLUE: Ramp = [P.blue[2]!, P.blue[3]!, P.blue[4]!, P.dusk[3]!, P.dusk[4]!, P.dusk[5]!];
const RED: Ramp = [P.red[4]!, P.red[5]!, P.umber[2]!, P.umber[3]!, P.umber[4]!, P.umber[5]!];
const GOLD: Ramp = [P.gold[3]!, P.gold[4]!, P.gold[5]!, P.umber[2]!, P.umber[3]!, P.umber[4]!];
const WOOD: Ramp = [P.timber[2]!, P.timber[3]!, P.timber[4]!, P.timber[5]!, P.timber[6]!, P.umber[5]!];
const WALL: Ramp = [P.umber[1]!, P.umber[2]!, P.umber[3]!, P.umber[4]!, P.umber[5]!];
const NIGHT: Ramp = [P.dusk[0]!, P.dusk[1]!, P.dusk[2]!, P.dusk[3]!, P.dusk[4]!];
const LAMPLIT: Ramp = [P.ember[2]!, P.ember[3]!, P.ember[4]!, P.umber[0]!, P.umber[1]!, P.umber[2]!, P.umber[3]!, P.umber[4]!, P.umber[5]!];

/** A step of `r` at v (0 lit .. 1 dark), dithered only in a narrow seam. */
function st(r: Ramp, v: number, X: number, Y: number): number {
  return tn(r, clamp(v, 0, 1), X, Y, 0.3);
}

/** The bay a local x falls in and the set positions of each bay (local px). */
interface SetAt { x: number; s: number; tiers: number; scheme: number; seed: number }

function bracketSets(p: BackWallP): SetAt[] {
  const U = p.u;
  const out: SetAt[] = [];
  p.bays.forEach((b, i) => {
    const sd = b.seed;
    // the column set at the bay's west column (the last bay also closes with its east one)
    const cols = i === p.bays.length - 1 ? [b.x0, b.x1] : [b.x0];
    for (const cx of cols) out.push({ x: cx, s: 1, tiers: 3, scheme: scheme(sd, 1), seed: sd + 1 });
    // one set between, or two lighter ones
    const two = hash(sd, 63) < 0.35;
    const w = b.x1 - b.x0;
    if (two) for (const f of [1 / 3, 2 / 3]) out.push({ x: b.x0 + w * f + (hash(sd, 65 + f * 9) - 0.5) * 0.04 * U, s: 0.66, tiers: 3, scheme: scheme(sd, 2 + f), seed: sd + 7 + Math.round(f * 9) });
    else out.push({ x: b.x0 + w / 2, s: 0.86, tiers: 3, scheme: scheme(sd, 4), seed: sd + 5 });
  });
  return out;
}

/** A set's paint: 0 teal arms on blue blocks, 1 blue arms on teal blocks, 2 red (a repaired set), 3 worn to the timber. */
function scheme(seed: number, k: number): number {
  const h = hash(seed, 67 + k * 3);
  return h < 0.08 ? 3 : h < 0.16 ? 2 : h < 0.58 ? 0 : 1;
}

/** Half length of a set's arm at tier t (H), before the set's scale. */
const ARM = [0.36, 0.6, 0.86];
const BLOCK_H = 0.22, ARM_H = 0.2, CAP_H = 0.16;

export function upperWall(c: PaintCtx, p: BackWallP, lf: LitField): void {
  const U = p.u;
  const px = 1 / c.d;
  const yLint = -UP.lintel * U, ySets = -UP.sets * U, yCorn = -UP.cornice * U, yCeil = -UP.ceil * U, yCeilT = -UP.ceilT * U;
  const sets = bracketSets(p);
  const lit = (lx: number, ly: number): number => clamp((lf.get(lx, ly).k - 0.15) * 1.4, 0, 1);

  // --- 1. the wall behind it all: boards between the lintel and the lofts' ceiling, the roof over that
  rect(c, 0, -p.top, p.w, yLint, (X, Y, lx, ly) => {
    if (ly < yCeilT) return roofBoards(X, Y, lx, ly, U);
    const board = Math.abs((((lx + 9) % (0.38 * U)) + 0.38 * U) % (0.38 * U) - 0.19 * U) > 0.19 * U - px * 1.2;
    return st(WALL, 0.55 + (board ? 0.25 : 0) - lit(lx, ly) * 0.4 + grain(lx, ly, 2011) * 0.12, X, Y);
  });

  // --- 2. the panels between the sets (red, each with its own faded motif), the cornice's shadow on them
  rect(c, 0, ySets, p.w, yLint, (X, Y, lx, ly) => {
    const v = (ly - ySets) / (yLint - ySets); // 0 under the cornice .. 1 on the lintel
    const frame = v < 0.06 || v > 0.95;
    if (frame) return st(TEAL, 0.72 + (v < 0.06 ? 0.15 : 0), X, Y);
    // which panel: between the two sets round lx
    let a = -1e9, b2 = 1e9;
    for (const s of sets) { if (s.x <= lx && s.x > a) a = s.x; if (s.x > lx && s.x < b2) b2 = s.x; }
    const mid = (a + b2) / 2, half = (b2 - a) / 2;
    const pseed = Math.round(mid);
    const mu = (lx - mid) / Math.max(1, half);
    const shadowTop = v < 0.17 + (vnoise(lx * 0.08, 1, 2017) - 0.5) * 0.04;
    let val = 0.26 + hash(pseed, 7, 2019) * 0.1 + (shadowTop ? 0.3 : 0) - lit(lx, ly) * 0.3 + (fbm(lx * 0.03, ly * 0.03, 2019, 2) - 0.5) * 0.08 + v * 0.08;
    // the motif, faded: gold lines on the red
    const m = motif(Math.floor(hash(pseed, 2, 2021) * 4), mu * half / U, (v - 0.55) * (yLint - ySets) / U, pseed);
    if (m === 1 && !shadowTop) return st(GOLD, 0.45 - lit(lx, ly) * 0.3 + (hash(X, Y, 2023) < 0.3 ? 0.25 : 0), X, Y);
    if (m === 2) val -= 0.08;
    // a darker wear band low on each panel, the paint rubbed thin
    if (v > 0.8 && fbm(lx * 0.09, ly * 0.2, 2025, 2) > 0.62) val += 0.1;
    return st(RED, val, X, Y);
  });

  // --- 3. the bracket sets: shadows first, then the sets
  for (const s of sets) setShadow(c, s, yLint, U, px);
  for (const s of sets) bracketSet(c, s, yLint, U, px, lit);

  // --- 4. the cornice beam on the sets
  rect(c, 0, yCorn, p.w, ySets, (X, Y, lx, ly) => {
    const v = (ly - yCorn) / (ySets - yCorn);
    if (v < 0.1) return st(GOLD, 0.35 - lit(lx, ly) * 0.3, X, Y); // its lit top edge (a gilt bead)
    if (v > 0.88) return st(TEAL, 0.95, X, Y); // its underside
    // its ends over the columns: whorls of teal and gold round a red eye; between them each bay its own
    let dc = 1e9, cx = 0;
    for (const x of p.cols) if (Math.abs(lx - x) < dc) { dc = Math.abs(lx - x); cx = x; }
    const bay = Math.floor(lx / (4.25 * U));
    if (dc < 0.5 * U) {
      const d = Math.hypot((dc - 0.22 * U) * 0.9, (v - 0.5) * (ySets - yCorn));
      if (d < 0.06 * U) return st(RED, 0.45, X, Y);
      if (Math.floor(d / (0.07 * U)) % 2 === 0 && d < 0.32 * U) return st(GOLD, 0.48 - lit(lx, ly) * 0.25, X, Y);
      if (dc < 0.04 * U) return st(WOOD, 0.85, X, Y); // the joint over the column
      return st(TEAL, 0.5 - lit(lx, ly) * 0.3, X, Y);
    }
    const style = hash(bay, 5, 2029);
    const k = (lx - cx) / (4.25 * U);
    if (style < 0.4 && Math.abs(v - 0.5) < 0.24 && dc > 0.75 * U) {
      // a long cartouche, a gold edge round blue
      const e = Math.min(dc - 0.75 * U, (0.24 - Math.abs(v - 0.5)) * (ySets - yCorn));
      return e < px * 1.5 ? st(GOLD, 0.5 - lit(lx, ly) * 0.2, X, Y) : st(BLUE, 0.62 - lit(lx, ly) * 0.3, X, Y);
    }
    if (style > 0.75 && Math.abs(v - 0.5 - Math.sin(k * 30 + bay) * 0.16) < 0.09) return st(GOLD, 0.55 - lit(lx, ly) * 0.2, X, Y);
    // the paint flaked off in places
    if (fbm(lx * 0.04, ly * 0.2, 2031 + bay, 2) > 0.66) return st(WOOD, 0.7, X, Y);
    return st(TEAL, 0.55 - lit(lx, ly) * 0.3 + (v > 0.7 ? 0.12 : 0), X, Y);
  });

  // --- 5. every bay over the cornice its own
  p.bays.forEach((b, i) => upperBay(c, p, b, UPPER_KINDS[i % UPPER_KINDS.length]!, lf, lit));

  // --- 6. posts at the column lines between the lofts, the lofts' ceiling beam over them
  for (const cx of p.cols) {
    rect(c, cx - POST * U, yCeil, cx + POST * U, yCorn, (X, Y, lx, ly) => {
      const u = (lx - cx) / (POST * U);
      return st(WOOD, (u < -0.6 ? 0.42 : u > 0.55 ? 0.9 : 0.7) - lit(lx, ly) * 0.3 + grain(lx, ly, 2033) * 0.1, X, Y);
    });
  }
  rect(c, 0, yCeilT, p.w, yCeil, (X, Y, lx, ly) => {
    const v = (ly - yCeilT) / (yCeil - yCeilT);
    if (v > 0.84) return st(WOOD, 0.95, X, Y);
    return st(WOOD, (v < 0.14 ? 0.5 : 0.78) - lit(lx, ly) * 0.25 + grain(lx, ly, 2035, false) * 0.12, X, Y);
  });

  // --- 7. what hangs over it all: banners down over the brackets
  p.bays.forEach((b, i) => {
    if (UPPER_KINDS[i % UPPER_KINDS.length] === "banner") hangBanner(c, b, U, px, yCeil, yLint, lit);
  });
}

/** The roof over the lofts: rafters running up the pitch toward us, the boards between, into the dark. */
function roofBoards(X: number, Y: number, lx: number, ly: number, U: number): number {
  const hgt = -ly / U - UP.ceilT;
  const k = Math.floor(Math.sqrt(Math.max(0, hgt) * 4)), kh = (k * k) / 4;
  if (hgt - kh < 0.09) return st(WOOD, 0.75, X, Y); // a purlin
  const pitch = 0.4 * U * (1 + k * 0.08);
  const rx = ((lx + k * 11) % pitch + pitch) % pitch;
  if (rx < pitch * 0.38) return st(WOOD, 0.88 - (rx < 1.2 ? 0.1 : 0), X, Y);
  return st(WALL, 0.95, X, Y);
}

/** A faded motif on a panel between the sets: 1 on a gold line, 2 in its field, 0 off. u, v in H from the panel's middle. */
function motif(kind: number, u: number, v: number, seed: number): number {
  if (kind === 0) {
    // a lotus: three petals on a base line
    const base = v > 0.16 && v < 0.2 && Math.abs(u) < 0.2;
    const pet = (cx: number, cy: number, rx: number, ry: number): number => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2;
    const pc = pet(0, -0.02, 0.07, 0.17), pl = pet(-0.12, 0.06, 0.07, 0.1), pr = pet(0.12, 0.06, 0.07, 0.1);
    if (base || Math.abs(pc - 1) < 0.35 || Math.abs(pl - 1) < 0.4 || Math.abs(pr - 1) < 0.4) return 1;
    if (pc < 1 || pl < 1 || pr < 1) return 2;
    return 0;
  }
  if (kind === 1) {
    // a flaming pearl: a ring with three flame tongues over it
    const d = Math.hypot(u, v - 0.04);
    if (Math.abs(d - 0.09) < 0.025) return 1;
    const ang = Math.atan2(v - 0.04, u);
    if (v < 0.02 && d < 0.22 && d > 0.12 && Math.abs(Math.sin(ang * 3 + d * 18)) < 0.25) return 1;
    return d < 0.09 ? 2 : 0;
  }
  if (kind === 2) {
    // a cloud curl, drawn off to one side
    const s = hash(seed, 3, 2037) < 0.5 ? 1 : -1;
    const uu = u * s;
    const d = Math.hypot(uu + 0.05, v);
    if (Math.abs(d - 0.1 - Math.atan2(v, uu + 0.05) * 0.02) < 0.022 && d < 0.15) return 1;
    if (Math.abs(v - 0.1) < 0.02 && uu > -0.05 && uu < 0.26) return 1;
    return 0;
  }
  return 0; // nothing left of it
}

/** A set's shadow on the panels and the wall behind it: down and to the right. */
function setShadow(c: PaintCtx, s: SetAt, base: number, U: number, px: number): void {
  const ox = 0.07 * U, oy = 0.09 * U;
  const L = ARM[2]! * s.s * U;
  rect(c, s.x - L + ox, base - (UP.sets - UP.lintel) * U + oy, s.x + L + ox + px, base, (X, Y, lx, ly) => {
    if (!inSet(s, lx - ox, ly - oy, base, U)) return 0;
    if (inSet(s, lx, ly, base, U)) return 0;
    const col = c.buf.get(X, Y);
    // the shadow takes the panel's red or the wall's dark a step or two down
    return RED.includes(col) ? st(RED, 0.92, X, Y) : TEAL.includes(col) ? P.dusk[5]! : st(WALL, 0.98, X, Y);
  });
}

/** Whether a local point is inside set s (its block, arms and small blocks). */
function inSet(s: SetAt, lx: number, ly: number, base: number, U: number): boolean {
  return setPart(s, lx, ly, base, U) !== null;
}

interface Part { kind: "block" | "arm" | "cap" | "face"; tier: number; u: number; v: number; e: number }

/**
 * What part of a set a local point is on, or null. u, v are in the part's own box (0..1); e is the distance
 * to the part's edge in H.
 */
function setPart(s: SetAt, lx: number, ly: number, base: number, U: number): Part | null {
  const dx = (lx - s.x) / U, hgt = (base - ly) / U; // H from the set's middle, H over the lintel
  const a = Math.abs(dx);
  const sc = s.s;
  // the bearing block on the lintel: square top, tapering foot
  if (hgt >= 0 && hgt < BLOCK_H) {
    const v = 1 - hgt / BLOCK_H; // 0 top .. 1 foot
    const hw = (0.2 * (v > 0.55 ? 1 - (v - 0.55) * 0.75 : 1)) * Math.min(1, sc + 0.15);
    if (a < hw) return { kind: "block", tier: -1, u: dx / hw, v, e: Math.min(hw - a, hgt, BLOCK_H - hgt) };
    return null;
  }
  for (let t = 0; t < s.tiers; t++) {
    const y0 = BLOCK_H + t * (ARM_H + CAP_H);
    const L = ARM[t]! * sc;
    // the arm: its ends cut away underneath in a curve
    if (hgt >= y0 && hgt < y0 + ARM_H) {
      const v = 1 - (hgt - y0) / ARM_H; // 0 top .. 1 underside
      const endIn = L - a;
      if (endIn < 0) return null;
      const cut = endIn < 0.14 * sc ? (1 - endIn / (0.14 * sc)) ** 1.6 * 0.75 : 0;
      if (v > 1 - cut) return null;
      // the projecting arm's end face at its middle (tiers 1 and 2): proud of the arm
      if (t > 0 && a < 0.11 * Math.max(0.75, sc)) return { kind: "face", tier: t, u: dx / (0.11 * Math.max(0.75, sc)), v, e: Math.min(0.11 * Math.max(0.75, sc) - a, (hgt - y0), y0 + ARM_H - hgt) };
      return { kind: "arm", tier: t, u: dx / L, v, e: Math.min(endIn, (hgt - y0), y0 + ARM_H - hgt) };
    }
    // the small blocks on the arm: at its two ends and its middle
    if (hgt >= y0 + ARM_H && hgt < y0 + ARM_H + CAP_H) {
      const v = 1 - (hgt - y0 - ARM_H) / CAP_H;
      const hwT = 0.1 * Math.max(0.8, sc);
      const hw = v > 0.6 ? hwT * 0.72 : hwT;
      for (const cxk of [-(L - hwT), 0, L - hwT]) {
        const da = Math.abs(dx - cxk);
        if (da < hw) return { kind: "cap", tier: t, u: (dx - cxk) / hw, v, e: Math.min(hw - da, hgt - y0 - ARM_H, y0 + ARM_H + CAP_H - hgt) };
      }
      return null;
    }
  }
  return null;
}

function bracketSet(c: PaintCtx, s: SetAt, base: number, U: number, px: number, lit: (lx: number, ly: number) => number): void {
  const L = ARM[2]! * s.s * U;
  rect(c, s.x - L - px, base - (UP.sets - UP.lintel) * U, s.x + L + px, base, (X, Y, lx, ly) => {
    const pt = setPart(s, lx, ly, base, U);
    if (!pt) return 0;
    const l = lit(lx, ly);
    const edgeTop = pt.v < 0.14, under = pt.v > 0.82;
    const rim = pt.e * U < px * 1.4;
    // the paint: arms and blocks alternate teal and blue by tier; the red set; the worn one bare timber
    const armR = s.scheme === 2 ? RED : s.scheme === 3 ? WOOD : (pt.tier % 2 === 0) === (s.scheme === 0) ? TEAL : BLUE;
    const blockR = s.scheme === 2 ? RED : s.scheme === 3 ? WOOD : armR === TEAL ? BLUE : TEAL;
    const worn = s.scheme === 3 || fbm(lx * 0.06, ly * 0.06, s.seed, 2) > 0.7;
    if (pt.kind === "face") {
      // the end face of an arm coming toward us: a gold ring on blue, lit a step more (it stands out of the set)
      const d = Math.hypot(pt.u, (pt.v - 0.5) * 1.6);
      if (rim) return st(GOLD, 0.55 - l * 0.25, X, Y);
      if (Math.abs(d - 0.55) < 0.2) return st(GOLD, 0.42 - l * 0.25, X, Y);
      return st(BLUE, 0.35 - l * 0.3 + (pt.u > 0.3 ? 0.15 : 0), X, Y);
    }
    if (pt.kind === "block" || pt.kind === "cap") {
      const r = worn ? WOOD : blockR;
      if (under) return st(r, 0.95, X, Y);
      const side = pt.u < -0.55 ? -0.12 : pt.u > 0.55 ? 0.14 : 0;
      if (rim && !under) return st(GOLD, 0.6 - l * 0.25 + (edgeTop ? -0.12 : 0), X, Y);
      return st(r, 0.5 + side - l * 0.3 + (edgeTop ? -0.15 : 0), X, Y);
    }
    // the arm: a gold line inside its edge, the paint between, a lit top and a dark underside
    const r = worn ? WOOD : armR;
    if (under) return st(r, 0.92, X, Y);
    if (edgeTop) return st(r, 0.25 - l * 0.25, X, Y);
    const inner = pt.e * U < px * 2.6 && pt.e * U >= px * 1.4;
    if (inner && s.scheme !== 3) return st(GOLD, 0.58 - l * 0.2 + (hash(X, Y, s.seed) < 0.2 ? 0.2 : 0), X, Y);
    return st(r, 0.48 - l * 0.3 + Math.abs(pt.u) * 0.12 + (worn ? grain(lx, ly, s.seed, false) * 0.2 : 0), X, Y);
  });
}

// ---------------------------------------------------------------------------------------------------
// Over the cornice, bay by bay
// ---------------------------------------------------------------------------------------------------
function upperBay(c: PaintCtx, p: BackWallP, b: Bay, kind: UpperKind, lf: LitField, lit: (lx: number, ly: number) => number): void {
  const U = p.u;
  const px = 1 / c.d;
  const [o0, o1] = loftOpening();
  const x0 = b.x0 + o0 * U, x1 = b.x0 + o1 * U, w = x1 - x0;
  const fy = -UP.cornice * U, cy = -UP.ceil * U;
  if (kind === "loft") loft(c, b, x0, x1, fy, cy, U, px);
  else if (kind === "lattice") clerestory(c, b, x0, x1, fy, cy, U, px, lit);
  else if (kind === "beams") beamEnds(c, b, x0, x1, fy, cy, U, px, lit);
  else {
    // a banner bay: the boards, a shelf of bundles low on the wall beside the banner
    const sx = x0 + w * (hash(b.seed, 71) < 0.5 ? 0.12 : 0.62), sw = w * 0.26;
    shelf(c, b, sx, sx + sw, fy - 0.55 * U, U, px, lit);
  }
  void lf;
}

/** A small shelf on brackets with bundles on it, lit on top. */
function shelf(c: PaintCtx, b: Bay, x0: number, x1: number, y: number, U: number, px: number, lit: (lx: number, ly: number) => number): void {
  // what stands on it: bundles and a jar, their shadow on the boards
  const n = 4 + Math.floor(hash(b.seed, 73) * 3);
  for (let k = 0; k < n; k++) {
    const kx0 = x0 + (x1 - x0) * (k / n) + px, kx1 = x0 + (x1 - x0) * ((k + 1) / n) - px;
    const hh = (0.16 + 0.18 * hash(b.seed, 75 + k)) * U;
    const jar = hash(b.seed, 77 + k) < 0.3;
    rect(c, kx0, y - hh, kx1 + 0.04 * U, y, (X, Y, lx, ly) => {
      const u = (lx - kx0) / (kx1 - kx0), v = (ly - y + hh) / hh;
      if (u > 1) return v > 0.15 ? st(WALL, 0.98, X, Y) : 0; // its shadow
      if (jar) {
        const prof = 0.5 * Math.sin(Math.min(1, v * 1.1 + 0.08) * Math.PI) + (v < 0.15 ? -0.15 : 0);
        if (Math.abs(u - 0.5) > prof * 0.9) return 0;
        return st(hash(b.seed, 79 + k) < 0.5 ? BLUE : RED, 0.45 + (u - 0.5) * 0.6 - lit(lx, ly) * 0.3, X, Y);
      }
      // a bundle of scrolls tied with a cord: ends showing as rings
      if (Math.abs(v - 0.5) < 0.06) return st(RED, 0.5, X, Y);
      return st(WOOD, 0.35 + (u - 0.5) * 0.5 + (v < 0.12 ? -0.15 : 0) - lit(lx, ly) * 0.25, X, Y);
    });
  }
  rect(c, x0 - 0.05 * U, y, x1 + 0.05 * U, y + 0.06 * U, (X, Y, lx, ly) => st(WOOD, (ly < y + px * 1.5 ? 0.3 : 0.75) - lit(lx, ly) * 0.25, X, Y));
  for (const bx of [x0 + 0.1 * U, x1 - 0.1 * U]) {
    rect(c, bx - 0.03 * U, y + 0.06 * U, bx + 0.03 * U, y + 0.2 * U, (X, Y, lx, ly) => (ly - y - 0.06 * U) / (0.14 * U) > 1 - Math.abs(lx - bx) / (0.03 * U) * 0.2 ? 0 : st(WOOD, 0.8, X, Y));
  }
}

/** An open storage loft lit from inside by a paper lamp: stacks against its back, a rail along its front. */
function loft(c: PaintCtx, b: Bay, x0: number, x1: number, fy: number, cy: number, U: number, px: number): void {
  const w = x1 - x0, hgt = fy - cy;
  const lampX = x0 + w * loftLampFrac(b.seed);
  const lampY = cy + 0.36 * hgt;
  const mp = midPost(b.seed);
  const mx = (x0 + x1) / 2;
  // the lamp's light at a point (0 .. 1): falls off across the loft, a little faster up toward the ceiling,
  // stopped by the middle post (the far half takes only its bounce)
  const glow = (lx: number, ly: number): number => {
    const dx = (lx - lampX) / (1.55 * U), dy = (ly - lampY) / ((ly < lampY ? 0.9 : 1.3) * U);
    let g = clamp(1 - dx * dx - dy * dy, 0, 1);
    if (mp && (lx - mx) * (lampX - mx) < 0 && Math.abs(lx - mx) > 0.08 * U) g *= 0.35;
    return g;
  };
  // the stacks' profile across the loft: slots of crates, scroll racks, jars and a chest
  const SLOT = 0.42 * U;
  rect(c, x0, cy, x1, fy, (X, Y, lx, ly) => {
    const g = glow(lx, ly);
    const v = (ly - cy) / hgt; // 0 at the ceiling .. 1 at the floor
    const si = Math.floor((lx - x0) / SLOT);
    const su = ((lx - x0) - si * SLOT) / SLOT;
    const what = hash(si, b.seed, 2041);
    const top = 0.32 + 0.38 * hash(si, b.seed, 2043);
    // the ceiling's underside over the lamp, warm; the beam's shadow along the back wall's top
    if (v < 0.08) return tone(0.75 - g * 0.6, X, Y);
    if (v > top && su > 0.04) {
      const sv = (v - top) / (1 - top); // 0 at the stack's top .. 1 at the floor
      const facing = (lampX - (x0 + (si + 0.5) * SLOT)) / U; // + when the lamp is to its right
      const sideLit = (su < 0.18 && facing < 0) || (su > 0.82 && facing > 0) ? -0.12 : su < 0.18 || su > 0.82 ? 0.15 : 0;
      if (sv < 0.06) return tone(0.42 - g * 0.55, X, Y); // its lit top
      if (what < 0.35) {
        // crates: boards with seams and an iron strap
        const seam = Math.abs(((sv * 4) % 1) - 0.5) > 0.44;
        const strap = Math.abs(su - 0.3) < 0.04;
        return tone(0.6 + sideLit + (seam ? 0.18 : 0) + (strap ? 0.25 : 0) - g * 0.6, X, Y);
      }
      if (what < 0.7) {
        // a rack of scroll ends: discs in rows, cream and red, the dark between
        const sr = 0.075 * U;
        const gx = ((((lx - x0) % (sr * 2.1)) + sr * 2.1) % (sr * 2.1)) - sr * 1.05;
        const gy = ((((fy - ly) % (sr * 2)) + sr * 2) % (sr * 2)) - sr;
        const d = Math.hypot(gx, gy) / sr;
        if (d < 0.35) return tone(0.85 - g * 0.3, X, Y);
        if (d < 1) {
          const red = hash(Math.floor((lx - x0) / (sr * 2.1)), Math.floor((fy - ly) / (sr * 2)), b.seed) < 0.22;
          const t = 0.5 + (gx + gy) / sr * 0.12 - g * 0.6;
          return red ? st(RED, t + 0.15, X, Y) : tone(t - 0.1, X, Y);
        }
        return tone(0.92, X, Y);
      }
      if (what < 0.85) {
        // jars: two round bellies on the floor
        const ju = su * 2 % 1, jv = sv;
        const prof = 0.46 * Math.sin(Math.min(1, jv * 1.05 + 0.1) * Math.PI);
        if (jv < 0.35 || Math.abs(ju - 0.5) > prof) return tone(0.9 - g * 0.3, X, Y);
        return st(hash(si, 3, b.seed) < 0.5 ? BLUE : P.stone.slice(2) as Ramp, 0.55 + (ju - 0.5) * 0.7 - g * 0.55, X, Y);
      }
      // a lacquer chest, a gold clasp
      if (sv > 0.4 && Math.abs(su - 0.5) < 0.06 && sv < 0.52) return st(GOLD, 0.45 - g * 0.4, X, Y);
      return st(RED, 0.62 + sideLit - g * 0.55, X, Y);
    }
    // the loft's back wall: boards, warm by the lamp, dark away from it
    const board = Math.abs((((lx + 5) % (0.3 * U)) + 0.3 * U) % (0.3 * U) - 0.15 * U) > 0.15 * U - px * 1.2;
    return tone(0.78 + (board ? 0.12 : 0) - g * 0.62, X, Y);
  });
  // the middle post, back-lit on the lamp's side
  if (mp) {
    rect(c, mx - 0.07 * U, cy, mx + 0.07 * U, fy, (X, Y, lx) => st(WOOD, (lx - mx) * (lampX - mx) > 0 ? 0.55 : 0.9, X, Y));
  }
  // an archivist now and then, between the lamp and the rail: a dark shape against the lit stacks, a
  // rim of the lamp's light on the side toward it
  if (hash(b.seed, 41) < 0.6) {
    const fx = lampX + (hash(b.seed, 43) < 0.5 ? -1 : 1) * (0.45 + 0.3 * hash(b.seed, 45)) * U;
    const hr = 0.1 * U;
    const head = fy - 0.66 * U;
    const bend = hash(b.seed, 47) < 0.5;
    rect(c, fx - 0.32 * U, head - hr, fx + 0.32 * U, fy, (X, Y, lx, ly) => {
      const dx = lx - fx - (bend ? (ly - head) * -0.25 : 0);
      const inHead = Math.hypot(dx - (bend ? 0.06 * U : 0), ly - head) < hr;
      const body = ly > head + hr * 0.7 && Math.abs(dx) < hr * (1.1 + (ly - head) / (0.32 * U));
      const arm = bend && ly > head + hr && ly < head + hr * 2.4 && dx > 0 && dx < 0.28 * U;
      if (!inHead && !body && !arm) return 0;
      const toward = (lampX - fx) > 0 ? dx > hr * 0.55 : dx < -hr * 0.55;
      return toward ? tone(0.45, X, Y) : st(inHead ? WALL : RED, inHead ? 0.98 : 0.9, X, Y);
    });
  }
  // the lamp: a cord from the ceiling beam, a small paper lantern glowing
  rect(c, lampX - px / 2, cy, lampX + px / 2, lampY - 0.12 * U, (X, Y) => st(WALL, 0.9, X, Y));
  rect(c, lampX - 0.1 * U, lampY - 0.13 * U, lampX + 0.1 * U, lampY + 0.13 * U, (X, Y, lx, ly) => {
    const u = (lx - lampX) / (0.1 * U), v = (ly - lampY) / (0.13 * U);
    if (u * u + v * v * 1.05 > 1) return 0;
    if (Math.abs(v) > 0.82) return st(WALL, 0.6, X, Y);
    return tn(SCREEN, clamp(0.08 + Math.abs(u) * 0.45 + Math.abs(v) * 0.25, 0, 1), X, Y, 0.3);
  });
  // the rail along its front: in silhouette against the lit loft, a line of light along its top
  const ry0 = fy - 0.42 * U;
  rect(c, x0, ry0, x1, fy, (X, Y, lx, ly) => {
    const v = (ly - ry0) / (fy - ry0);
    const g = glow(lx, ly);
    const post = ((((lx - x0 + 0.05 * U) % (0.62 * U)) + 0.62 * U) % (0.62 * U)) < 0.07 * U;
    if (v < 0.12) return v < 0.05 ? st(RED, 0.55 - g * 0.5, X, Y) : st(RED, 0.88, X, Y);
    if (post) return st(RED, 0.92 - (g > 0.5 ? 0.12 : 0), X, Y);
    if (v > 0.88) return st(RED, 0.85, X, Y);
    // a fret: two rails and short struts between them
    const midRail = Math.abs(v - 0.5) < 0.06;
    const strut = ((((lx - x0) % (0.155 * U)) + 0.155 * U) % (0.155 * U)) < 0.03 * U && v > 0.12 && v < 0.5;
    if (midRail || strut) return st(RED, 0.9, X, Y);
    return 0;
  });
}

/** Warm loft tone: v 0 lamplit .. 1 the dark. */
function tone(v: number, X: number, Y: number): number {
  return st(LAMPLIT, v, X, Y);
}

/** A straight-bar clerestory: a deep frame (the wall's thickness in the reveal), bars against the night. */
function clerestory(c: PaintCtx, b: Bay, x0: number, x1: number, fy: number, cy: number, U: number, px: number, lit: (lx: number, ly: number) => number): void {
  const w = x1 - x0;
  // one wide window or two narrow ones
  const two = hash(b.seed, 81) < 0.5;
  const wins: [number, number][] = two ? [[x0 + 0.12 * w, x0 + 0.44 * w], [x0 + 0.56 * w, x0 + 0.88 * w]] : [[x0 + 0.16 * w, x0 + 0.84 * w]];
  const wy0 = cy + 0.2 * U, wy1 = fy - 0.16 * U;
  // the boards round it
  rect(c, x0, cy, x1, fy, (X, Y, lx, ly) => {
    const board = Math.abs((((lx + 3) % (0.38 * U)) + 0.38 * U) % (0.38 * U) - 0.19 * U) > 0.19 * U - px * 1.2;
    return st(WALL, 0.6 + (board ? 0.22 : 0) - lit(lx, ly) * 0.35 + grain(lx, ly, 2051) * 0.12, X, Y);
  });
  const moonL = hash(b.seed, 83) < 0.5;
  for (const [a0, a1] of wins) {
    const F = 0.09 * U, R = 0.07 * U;
    rect(c, a0 - F, wy0 - F, a1 + F, wy1 + F, (X, Y, lx, ly) => {
      const inX = lx > a0 && lx < a1, inY = ly > wy0 && ly < wy1;
      if (!inX || !inY) {
        // the frame: a lit sill and left jamb, a dark head
        if (ly > wy1) return st(WOOD, 0.32 - lit(lx, ly) * 0.25, X, Y);
        if (ly < wy0) return st(WOOD, 0.85, X, Y);
        return st(WOOD, lx < a0 ? 0.5 : 0.78, X, Y);
      }
      // the reveal: the wall's thickness, in shadow under the head and down the left
      if (ly < wy0 + R || lx < a0 + R * 0.7) return st(WALL, 0.92, X, Y);
      if (lx > a1 - R * 0.6) return st(WOOD, 0.62, X, Y);
      // the bars and two rails, dark timber against the night, each with a thin cool edge on its left
      const bp = 0.13 * U;
      const bx = ((((lx - a0 - R * 0.7) % bp) + bp) % bp);
      const v = (ly - wy0) / (wy1 - wy0);
      const rail = Math.abs(v - 0.3) < 0.035 || Math.abs(v - 0.72) < 0.035;
      if (bx < 0.045 * U || rail) return bx < px * 1.2 && !rail ? st(NIGHT, 0.85, X, Y) : st(WOOD, 0.88, X, Y);
      // the night: a deep blue, lighter low down toward the horizon's glow and on the moon's side
      const u = (lx - a0) / (a1 - a0);
      const glowSide = moonL ? 1 - u : u;
      const n = 0.62 - v * 0.25 - glowSide * 0.18 + (vnoise(lx * 0.05, ly * 0.05, b.seed) - 0.5) * 0.15;
      // a star or two
      if (hash(Math.floor(lx / 2), Math.floor(ly / 2), b.seed + 2053) < 0.004 && v < 0.6) return P.dusk[0]!;
      return st(NIGHT, n, X, Y);
    });
  }
  void bayer4;
}

/** The roof's transverse beams come through the wall: two painted beam ends and the struts over them. */
function beamEnds(c: PaintCtx, b: Bay, x0: number, x1: number, fy: number, cy: number, U: number, px: number, lit: (lx: number, ly: number) => number): void {
  const w = x1 - x0;
  rect(c, x0, cy, x1, fy, (X, Y, lx, ly) => {
    const board = Math.abs((((lx + 3) % (0.38 * U)) + 0.38 * U) % (0.38 * U) - 0.19 * U) > 0.19 * U - px * 1.2;
    return st(WALL, 0.62 + (board ? 0.22 : 0) - lit(lx, ly) * 0.35 + grain(lx, ly, 2061) * 0.12, X, Y);
  });
  const ends: [number, number, number, number][] = [];
  for (let k = 0; k < 2; k++) {
    const bx = x0 + w * (0.27 + 0.46 * k + (hash(b.seed, 85 + k) - 0.5) * 0.06);
    const bw = (0.46 - 0.06 * k) * U, bh = (0.4 - 0.04 * k) * U;
    const by = fy - (0.42 + 0.5 * k * hash(b.seed, 87)) * U - bh / 2;
    ends.push([bx, by, bw, bh]);
  }
  for (const [bx, by, bw, bh] of ends) {
    // the strut from it up to the ceiling beam, then its shadow, then the end face
    rect(c, bx - 0.08 * U, cy, bx + 0.08 * U, by - bh / 2, (X, Y, lx) => st(WOOD, lx < bx - 0.03 * U ? 0.48 : 0.82, X, Y));
    rect(c, bx - bw / 2 + 0.07 * U, by - bh / 2 + 0.09 * U, bx + bw / 2 + 0.07 * U, by + bh / 2 + 0.09 * U, (X, Y) => st(WALL, 1, X, Y));
    rect(c, bx - bw / 2, by - bh / 2, bx + bw / 2, by + bh / 2, (X, Y, lx, ly) => {
      const u = (lx - bx) / (bw / 2), v = (ly - by) / (bh / 2);
      const e = Math.min(1 - Math.abs(u), 1 - Math.abs(v)) * bw / 2;
      if (e < px * 1.3) return st(GOLD, v < -0.7 ? 0.35 : u < -0.7 ? 0.45 : 0.72, X, Y);
      const d = Math.hypot(u, v);
      const ring = Math.floor(d / 0.22);
      if (d < 0.2) return st(RED, 0.45 - lit(lx, ly) * 0.2, X, Y);
      if (ring % 2 === 1 && d < 0.9) return st(GOLD, 0.5 - lit(lx, ly) * 0.25 + (v > 0 ? 0.12 : 0), X, Y);
      return st(BLUE, 0.4 - lit(lx, ly) * 0.3 + (v > 0.3 ? 0.15 : 0) + (u > 0.4 ? 0.1 : 0), X, Y);
    });
  }
  // a hoist's pulley hung from the ceiling beam between them, its rope down to a bundle over the cornice
  const hx = x0 + w * (0.5 + (hash(b.seed, 89) - 0.5) * 0.1);
  const bundleY = fy - 0.22 * U;
  rect(c, hx - 0.07 * U, cy, hx + 0.07 * U, cy + 0.16 * U, (X, Y, lx, ly) => (Math.hypot(lx - hx, ly - cy - 0.09 * U) < 0.07 * U ? st(WOOD, lx < hx ? 0.4 : 0.8, X, Y) : 0));
  for (const rx of [hx - 0.05 * U, hx + 0.05 * U]) rect(c, rx - px / 2, cy + 0.1 * U, rx + px / 2, bundleY - 0.1 * U, (X, Y) => st(WOOD, 0.55, X, Y));
  rect(c, hx - 0.16 * U, bundleY - 0.12 * U, hx + 0.16 * U, bundleY + 0.12 * U, (X, Y, lx, ly) => {
    const u = (lx - hx) / (0.16 * U), v = (ly - bundleY) / (0.12 * U);
    if (u * u * 0.7 + v * v > 1) return 0;
    if (Math.abs(u) < 0.1) return st(RED, 0.6, X, Y);
    return st(WOOD, 0.4 + v * 0.3 + u * 0.15 - lit(lx, ly) * 0.25, X, Y);
  });
}

/** A long silk banner hung from the lofts' ceiling beam down over the cornice, the sets and the lintel. */
function hangBanner(c: PaintCtx, b: Bay, U: number, px: number, top: number, lint: number, lit: (lx: number, ly: number) => number): void {
  const w = b.x1 - b.x0;
  const cx = b.x0 + w * (0.38 + 0.24 * hash(b.seed, 51)), bw = 0.86 * U;
  const y1 = lint - (0.1 + 0.55 * hash(b.seed, 53)) * U; // its hem: down among the sets
  const indigo = hash(b.seed, 57) < 0.5;
  const body: Ramp = indigo ? [P.blue[3]!, P.blue[4]!, P.dusk[3]!, P.dusk[4]!, P.dusk[5]!] : [P.red[4]!, P.red[5]!, P.umber[2]!, P.umber[3]!, P.umber[4]!];
  // its shadow on whatever is behind, down and right
  rect(c, cx - bw / 2 + 0.07 * U, top + 0.09 * U, cx + bw / 2 + 0.07 * U, y1 + 0.09 * U, (X, Y, lx, ly) => {
    const vs = (ly - 0.09 * U - top) / (y1 - top);
    const sway = Math.sin(vs * 2.2) * 0.03 * U;
    const us = (lx - 0.07 * U - cx - sway) / (bw / 2);
    if (Math.abs(us) > 1 || vs > 1 - 0.1 * (1 - Math.abs(us))) return 0;
    const col = c.buf.get(X, Y);
    return RED.includes(col) ? st(RED, 0.95, X, Y) : TEAL.includes(col) || BLUE.includes(col) ? P.dusk[5]! : st(WALL, 1, X, Y);
  });
  rect(c, cx - bw / 2 - 0.06 * U, top, cx + bw / 2 + 0.06 * U, top + 0.05 * U, (X, Y) => st(WOOD, 0.6, X, Y)); // the rod
  rect(c, cx - bw / 2 - 2 * px, top + 0.05 * U, cx + bw / 2 + 2 * px, y1, (X, Y, lx, ly) => {
    const v = (ly - top) / (y1 - top);
    const sway = Math.sin(v * 2.2) * 0.03 * U;
    const u = (lx - cx - sway) / (bw / 2);
    if (Math.abs(u) > 1) return 0;
    // a swallowtail hem: a V cut up into it, a fringe along the cut
    const vcut = 1 - 0.1 * (1 - Math.abs(u));
    if (v > vcut) return 0;
    if (v > vcut - 0.02) return (Math.floor(lx / px) & 1) ? st(GOLD, 0.5, X, Y) : st(body, 0.8, X, Y);
    if (Math.abs(u) > 0.84) return st(GOLD, 0.55 - lit(lx, ly) * 0.25 + (u > 0 ? 0.12 : 0), X, Y);
    // a gold ring with the hall's plum blossom near its head (five dots round a dot)
    const ey = 0.3;
    const d = Math.hypot(u * bw / 2, (v - ey) * (y1 - top));
    if (Math.abs(d - 0.24 * U) < 0.035 * U) return st(GOLD, 0.45 - lit(lx, ly) * 0.25, X, Y);
    if (d < 0.17 * U) {
      const ang = Math.atan2((v - ey) * (y1 - top), u * bw / 2);
      const petal = Math.cos(ang * 5) > 0.2 && d > 0.06 * U;
      if (petal || d < 0.035 * U) return st(GOLD, 0.5, X, Y);
    }
    // folds: the silk lit on its left-facing slopes
    const fold = Math.sin(u * 3.1 + 0.6 + v * 1.5) * 0.5 + 0.5;
    return st(body, 0.25 + (1 - fold) * 0.45 + v * 0.15 - lit(lx, ly) * 0.25, X, Y);
  });
}
