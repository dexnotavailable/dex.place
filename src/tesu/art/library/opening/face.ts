// The karst face model shared by the opening's rock (rock.ts, wall.ts): what a point on a cliff
// face looks like, side-on, in the morning light. Built to read as real limestone, never as
// paving or organ pipes:
//
// - Bedding: the face is cut into bands by bedding planes that wander (noise at two scales and
//   a slight dip), with irregular spacing; some planes are missing, so bands differ a lot in
//   height. Along a plane the band above either overhangs (an undercut, a cast shadow under
//   it, deep in places, flush in others) or steps back (a lit ledge with moss on it).
// - Masses: inside a band the rock breaks into masses of very different widths (base cells
//   merged in runs, so a few narrow blades sit between broad blocks), each seam leaning its own
//   way, so masses taper, lean and wedge. A seam is a cleft (a dark fissure), a joint (a thin
//   broken line) or fused (only a change of tone).
// - Each mass is a rounded form lit on its left, shading into its right side; its tone and how
//   far it stands out vary. Fine bedding lines, water stains under ledges and the odd flute
//   only near, so the far levels keep the big shapes and drop the grain.
// - Giant masses (optional) add a layer of big irregular buttresses and gullies for the wide
//   frames, with their own light and shade.

import { clamp, fbm1, hash, hash1, vnoise, vnoise1 } from "../../raster.ts";

export interface FaceOpts {
  /** Base width of a mass cell, px (masses are runs of 1 to 6 cells). */
  col?: number;
  /** Base spacing of the bedding planes, px. */
  bed?: number;
  /** Giant masses this wide (on average), px; 0 or unset for none. */
  giant?: number;
  /** Moss on ledges, 0..1. */
  veg?: number;
  /** Extra shade over the whole face, 0..1. */
  shade?: number;
}

export type FaceMat = "rock" | "moss" | "warm";

export interface FaceOut {
  /** Tone, 0 lit .. 1 dark. */
  t: number;
  mat: FaceMat;
}

export interface Band {
  j: number;
  /** Warped y of the point and of the band's top and bottom planes. */
  wy: number;
  y0: number;
  y1: number;
}

/** Bedding planes wander: warped y. */
export function warpY(lx: number, ly: number, seed: number): number {
  return ly + (fbm1(lx / 320, seed + 41, 3) - 0.5) * 46 + (vnoise(lx / 110, ly / 500, seed + 42) - 0.5) * 22 + lx * 0.012;
}

/**
 * Detail by level, nested: a seam or plane shows at a level only if its importance clears the
 * level's threshold, so a far level's structure is a coarser subset of the near one's (the
 * pull-back never pops, the small breaks just drop away).
 */
export const thrOf = (d: number): number => (d >= 0.5 ? 0 : d >= 0.25 ? 0.5 : 0.78);

/** The band (between two bedding planes that exist at this level) holding warped y. */
export function bandAt(wy: number, bed: number, seed: number, thr = 0): Band {
  const edge = (i: number): number => (i + (hash1(i, seed + 43) - 0.5) * 0.8) * bed;
  const has = (i: number): boolean => hash1(i, seed + 44) > 0.18 && hash1(i, seed + 65) >= thr;
  let i = Math.floor(wy / bed);
  if (wy < edge(i)) i--;
  else if (wy >= edge(i + 1)) i++;
  let a = i;
  while (!has(a) && a > i - 24) a--;
  let b = i + 1;
  while (!has(b) && b < i + 26) b++;
  return { j: a, wy, y0: edge(a), y1: edge(b) };
}

/** How far the band above overhangs band j at x (> 0 an undercut, < 0 this band stands out). */
export function overhang(lx: number, j: number, seed: number): number {
  return (vnoise1(lx / 85 + j * 13.7, seed + 52) - 0.48) * 2.2;
}

interface Mass {
  /** Left and right seams (indices), their x at this depth, position across, width. */
  L: number;
  R: number;
  xl: number;
  xr: number;
  u: number;
  w: number;
}

function massAt(ux: number, s: number, j: number, cw: number, seed: number, thr = 0): Mass {
  // each seam leans a little and wanders as it goes down (never a straight ruled line)
  const e = (i: number): number => (i + 0.5 + (hash(i, j, seed + 46) - 0.5) * 0.7) * cw + (hash(i, j, seed + 47) - 0.5) * 0.3 * s + (vnoise1(s / 44 + i * 3.1 + j * 0.7, seed + 59) - 0.5) * cw * 0.32;
  const has = (i: number): boolean => hash(i, j, seed + 48) > 0.45 && hash(i, j, seed + 64) >= thr;
  const i0 = Math.floor(ux / cw);
  const span = thr > 0.6 ? 30 : thr > 0 ? 18 : 9;
  let L = i0 - span, R = i0 + span, xl = -Infinity, xr = Infinity;
  for (let i = i0 - span; i <= i0 + span; i++) {
    if (!has(i)) continue;
    const x = e(i);
    if (x <= ux && x > xl) { xl = x; L = i; }
    if (x > ux && x < xr) { xr = x; R = i; }
  }
  if (!isFinite(xl)) xl = ux - cw * 4;
  if (!isFinite(xr)) xr = ux + cw * 4;
  const w = Math.max(1, xr - xl);
  return { L, R, xl, xr, u: (ux - xl) / w, w };
}

/** The giant layer: big irregular buttresses (runs of cells) and the gullies between them. */
function giantAt(lx: number, ly: number, g: number, seed: number): { u: number; w: number; gully: number } {
  const cw = g * 0.45;
  const gx = lx + (fbm1(ly / 520, seed + 91, 3) - 0.5) * g * 0.5 + ly * (vnoise1(lx / (g * 3), seed + 95) - 0.5) * 0.3;
  const e = (i: number): number => (i + 0.5 + (hash1(i, seed + 92) - 0.5) * 0.8) * cw;
  const has = (i: number): boolean => hash1(i, seed + 93) > 0.5;
  const i0 = Math.floor(gx / cw);
  let xl = -Infinity, xr = Infinity, L = 0;
  for (let i = i0 - 7; i <= i0 + 7; i++) {
    if (!has(i)) continue;
    const x = e(i);
    if (x <= gx && x > xl) { xl = x; L = i; }
    if (x > gx && x < xr) xr = x;
  }
  if (!isFinite(xl)) xl = gx - cw * 3;
  if (!isFinite(xr)) xr = gx + cw * 3;
  const w = xr - xl;
  // the gully on this mass's left: wide where the seam is a big cleft, its width wandering
  const gw = g * (0.03 + 0.06 * hash1(L, seed + 94)) * (0.6 + 0.8 * vnoise1(ly / 90, seed + L));
  return { u: (gx - xl) / w, w, gully: gx - xl < gw ? 1 - (gx - xl) / gw : 0 };
}

/** What the face shows at a level-1 point; depth is px below the mass's top line. */
export function face(lx: number, ly: number, depth: number, o: FaceOpts, seed: number, d: number): FaceOut {
  const col = o.col ?? 22, bed = o.bed ?? 78;
  const px = 1 / Math.max(d, 0.125);
  const thr = thrOf(d);
  const B = bandAt(warpY(lx, ly, seed), bed, seed, thr);
  const s = B.wy - B.y0, S = B.y1 - B.y0;
  // masses: the band's own offset and lean, a slow wander down the band
  const ux = lx + hash1(B.j, seed + 45) * 900 + (hash1(B.j, seed + 55) - 0.5) * 0.2 * s;
  const cw = col * 1.6;
  const M = massAt(ux, s, B.j, cw, seed, thr);
  const id = M.L * 131 + B.j * 7;
  const out = hash1(id, seed + 51);
  // the big picture: light falls off below the lip; bays and prows across the whole face
  const macro = fbm1(lx / 700 + 3.1, seed + 90, 3);
  const bay = clamp((0.42 - macro) * 3, 0, 1), prow = clamp((macro - 0.6) * 3, 0, 1);
  let t = 0.4 + 0.2 * (1 - Math.exp(-depth / 300)) + (1 - out) * 0.12 + (hash1(id, seed + 57) - 0.5) * 0.12 + (o.shade ?? 0) * 0.3 + bay * 0.14 - prow * 0.1;
  let mat: FaceMat = "rock";
  if (o.giant) {
    const G = giantAt(lx, ly, o.giant, seed);
    if (G.gully > 0) return { t: 0.86 + 0.1 * G.gully, mat };
    // each giant mass lit on its left, its right side turning into shade
    t += G.u < 0.18 ? -0.1 : G.u > 0.7 ? 0.18 * ((G.u - 0.7) / 0.3) : 0;
    if (G.u > 0.04 && G.u < 0.09) t += 0.12;
  }
  const xIn = M.u * M.w, xR = (1 - M.u) * M.w;
  const big = M.w * d;
  // the seam on this mass's left: a cleft, a joint or fused
  const seam = hash(M.L, B.j, seed + 49);
  if (seam < 0.22) {
    const cwid = (2 + 5 * hash(M.L, B.j, seed + 50)) * (0.6 + 0.8 * vnoise1(ly / 23, seed + M.L));
    if (xIn < cwid) return { t: 0.82 + (xIn < cwid * 0.5 ? 0.12 : 0), mat };
    if (xIn < cwid + px * 1.5) t -= 0.14; // the lit lip of the cleft's far side
  } else if (seam < 0.8 && d >= 0.5) {
    if (xIn < px * 0.9 && vnoise1(ly / 9 + M.L, seed + 58) > 0.28) t += 0.3;
  }
  // the rounded mass: lit left flank, body, right side turning into shade
  if (big > 6) {
    // the lit flank's width wanders down the mass (it catches the light where it bulges)
    const litW = Math.max(px * 1.5, M.w * (0.05 + 0.12 * out) * (0.4 + 1.2 * vnoise1(s / 18 + id * 0.37, seed + 60)));
    if (xIn < litW) {
      t -= 0.18;
      if (out > 0.55 && s < S * 0.5 && depth < 500) mat = "warm";
    } else if (M.u > 0.6) t += 0.24 * Math.pow((M.u - 0.6) / 0.4, 1.3);
    if (xR < px * 1.2 && seam >= 0.8) t += 0.08;
    // each mass has its own breaks across it: a short crack with a shadow under it, or a step
    for (let k = 0; k < 2; k++) {
      const yk = S * (0.2 + 0.6 * hash(id, k, seed + 61));
      const tilt = (hash(id, k, seed + 62) - 0.5) * 0.3 * (xIn - M.w / 2);
      const dy = s - yk - tilt;
      if (d >= 0.5 && hash(id, k, seed + 63) < 0.55 && M.w > 16 && xIn > M.w * 0.08 && xR > M.w * 0.08) {
        if (dy >= 0 && dy < px * 0.9) t += 0.3;
        else if (dy >= px * 0.9 && dy < 3.5 * px) t += 0.12;
        else if (dy < 0 && dy > -px * 1.1 && d >= 0.5) t -= 0.12;
      }
    }
  }
  // the bedding plane at the band's top: an undercut's shadow, or a lit ledge with moss
  const ov = overhang(lx, B.j, seed);
  if (ov > 0.15) {
    const sh = 2 + 18 * Math.min(1, ov);
    if (s < sh) t += 0.4 * (1 - s / (sh + 1)) + 0.1;
  } else if (ov < -0.2) {
    if (s < px * 1.4 && d >= 0.25) t -= 0.25;
    const mh = (vnoise1(lx / 24 + B.j, seed + 68) - 0.38) * 16 * (0.5 + (o.veg ?? 0.6)) + (hash1(Math.floor(lx / 2), seed + 70) < 0.05 ? 7 : 0);
    if (s < mh) {
      mat = "moss";
      return { t: 0.26 + (s / Math.max(1, mh)) * 0.42, mat };
    }
  } else if (s < px * 0.9 && d >= 0.5 && vnoise1(lx / 14, seed + 77 + B.j) > 0.35) t += 0.14;
  // the face curves under toward the next plane down
  if (S - s < 8) t += 0.06 * (1 - (S - s) / 8);
  if (d >= 0.5) {
    // fine bedding: short wavy lines inside the band
    const y2 = B.wy + (vnoise1(lx / 40, seed + 71) - 0.5) * 5;
    const k = y2 / (13 + 6 * hash1(B.j, seed + 72));
    if (k - Math.floor(k) < 0.08 && vnoise(lx / 26, k, seed + 73) > 0.56) t += 0.08;
    // water stains running down from the plane above
    const sx = Math.floor((lx + B.j * 7) / 4);
    if (hash(sx, B.j, seed + 75) < 0.08 && s < S * (0.25 + 0.75 * hash(sx, B.j, seed + 76))) t += 0.1 + 0.08 * (1 - s / S);
  }
  // the odd fluted mass (rillen), near only
  if (d >= 1 && hash1(id, seed + 53) < 0.3 && s < 40 && vnoise(lx / 1.8, s / 30, seed + 74) > 0.7) t += 0.08;
  t += (fbm1(lx / 120 + ly / 210, seed + 81, 3) - 0.5) * 0.12;
  if (d >= 1 && hash(Math.floor(lx), Math.floor(ly), seed + 85) < 0.01) t += 0.2;
  return { t, mat };
}

/**
 * The next exposed ledge (a bedding plane where the band below stands out) below level-1 y at
 * x, as local y, or null: where soil collects and plants grow.
 */
export function nextLedge(lx: number, ly: number, o: FaceOpts, seed: number): { y: number; ov: number } | null {
  const bed = o.bed ?? 78;
  let y = ly;
  for (let n = 0; n < 4; n++) {
    const wy = warpY(lx, y, seed);
    const B = bandAt(wy, bed, seed);
    const yl = y + (B.y1 - wy);
    const below = bandAt(B.y1 + 0.5, bed, seed);
    const ov = overhang(lx, below.j, seed);
    if (ov < -0.2) return { y: yl, ov };
    y = yl + 1;
  }
  return null;
}
