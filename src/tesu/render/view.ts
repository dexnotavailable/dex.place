// How every plane lands on the frame for a camera state.
//
// The camera is a real camera in side view. Its zoom z is the play plane's scale. Below 1
// it dollies back: a plane with scroll rate r (its scale at play zoom) then shows at
//   s = 1 / (1/z + 1/r - 1)
// so the play plane shrinks to z while far ranges barely move: the pull-back of the
// opening. Above 1 it is a lens zoom about her feet (the close band). Each plane's art is
// authored at its own density (1 art px = 1 frame px at play zoom); at another zoom it is
// drawn at g = s / r of that, from the nearest authored level at or above g.
//
// Vertically the camera has a horizon (eye level) and puts her feet on an anchor row.
// A point at 3D (x, y) on a plane of scale s lands on frame row (y - eyeY) * s + horizon.

import { ZOOMS } from "../config.ts";

export interface CamState {
  /** World x at the frame's centre column, world y on the anchor row (her feet when framed). */
  cx: number;
  cy: number;
  /** Play plane scale. */
  zoom: number;
  /** Feet row and horizon row, shares of the frame height. */
  anchor: number;
  horizon: number;
  /** Frame size in px. */
  W: number;
  H: number;
}

/** A plane's scale on the frame at camera zoom z (dolly below 1, lens above). */
export function planeScale(rate: number, z: number): number {
  if (z >= 1) return rate * z;
  return 1 / (1 / z + 1 / rate - 1);
}

/** Art scale of a plane at zoom z relative to its play-zoom density. */
export function planeArtScale(rate: number, z: number): number {
  return planeScale(rate, z) / rate;
}

/** The densities a plane's art exists at, one per authored camera zoom (descending). */
export function planeLevels(rate: number, zooms: readonly number[] = ZOOMS): number[] {
  const out: number[] = [];
  for (const z of zooms) {
    const g = Math.round(planeArtScale(rate, z) * 4096) / 4096;
    if (!out.some((v) => Math.abs(v - g) < 1e-4)) out.push(g);
  }
  return out.sort((a, b) => b - a);
}

/** Smallest level at or above g (the next level up), or the highest when g is beyond them all. */
export function levelFor(levels: readonly number[], g: number): number {
  let pick = levels[0]!;
  for (const l of levels) if (l >= g - 1e-4) pick = l;
  return pick;
}

export interface PlaneXf {
  /** Plane scale (frame px per 3D px). */
  s: number;
  /** Art scale relative to play-zoom density. */
  g: number;
  /** Frame px = art px (level 1) * g + off; offsets are whole px when g is a whole number. */
  offX: number;
  offY: number;
}

/** Eye-level world y for a camera state (the row of the horizon in 3D). */
export function eyeY(c: CamState): number {
  const zEff = Math.min(1, c.zoom);
  return c.cy - ((c.anchor - c.horizon) * c.H) / zEff;
}

/**
 * The transform of a plane with scroll rate r. Plane art px (level 1) are r * 3D px, so a
 * 3D point (x, y) is art px (r x, r y) and lands on (r x * g + offX, r y * g + offY).
 */
export function planeXf(c: CamState, rate: number): PlaneXf {
  const zEff = Math.min(1, c.zoom);
  const lens = Math.max(1, c.zoom);
  const s1 = planeScale(rate, zEff);
  const eye = eyeY(c);
  const hz = c.horizon * c.H;
  // at zEff: x' = (x - cx) * s1 + W/2, y' = (y - eye) * s1 + hz
  let offX = c.W / 2 - c.cx * s1;
  let offY = hz - eye * s1;
  let s = s1;
  if (lens > 1) {
    // lens zoom about the anchor point (her feet)
    const fx = c.W / 2, fy = c.anchor * c.H;
    offX = fx + (offX - fx) * lens;
    offY = fy + (offY - fy) * lens;
    s = s1 * lens;
  }
  const g = s / rate;
  // whole-pixel offsets so slow planes never shimmer (exact at whole scales)
  return { s, g, offX: Math.round(offX), offY: Math.round(offY) };
}

/** Frame point of a 3D point on a plane. */
export function project(c: CamState, rate: number, x: number, y: number): [number, number] {
  const t = planeXf(c, rate);
  return [x * rate * t.g + t.offX, y * rate * t.g + t.offY];
}

/** 3D point on a plane under a frame point. */
export function unproject(c: CamState, rate: number, fx: number, fy: number): [number, number] {
  const t = planeXf(c, rate);
  return [(fx - t.offX) / (rate * t.g), (fy - t.offY) / (rate * t.g)];
}

/** Frame row of a level surface at world y seen on a plane (the plane's waterline). */
export function rowOf(c: CamState, rate: number, y: number): number {
  const t = planeXf(c, rate);
  return y * rate * t.g + t.offY;
}
