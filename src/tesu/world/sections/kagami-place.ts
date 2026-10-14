// Shared placement helpers for Kagami's dressing files (kagami-backdrop.ts, kagami-jetty.ts,
// kagami-land.ts). Kagami's art is re-dressed in parallel by three painters, one file each; this
// file and kagami.ts hold what they share and stay fixed while they work.

import type { WorldBuilder } from "../build.ts";
import { PLANES, type PlaneId } from "../types.ts";
import { LAKE_Y } from "./common.ts";

/** A drifting sprite on a background plane, placed by plane px (x, and dy above the lake line), wrapping over plane px. */
export function drifting(b: WorldBuilder, id: string, plane: PlaneId, kind: string, planeX: number, planeDy: number, p: Record<string, unknown>, wrap: [number, number], drift: number, fps: number, frames = 4, seed?: number): void {
  const r = PLANES[plane].rate;
  b.sprite({ id, plane, kind, x: planeX / r, y: LAKE_Y + planeDy / r, p, frames, fps, path: [wrap[0] / r, wrap[1] / r], drift, reflect: true, seed });
}

/** A background piece placed by its plane px (x) and standing on 3D y (the lake by default). */
export function bg(b: WorldBuilder, plane: PlaneId, planeX: number, kind: string, p: Record<string, unknown>, y3 = LAKE_Y, z = 0, seed?: number): void {
  b.piece(plane, kind, planeX / PLANES[plane].rate, y3, p, { z, seed });
}

/**
 * Sets the builder's shared seed counter (private to WorldBuilder). kagami.ts starts each
 * dressing block from the seed it had before the split, so what one block adds or removes
 * never reseeds another block, or any section built after Kagami.
 */
export function seedAt(b: WorldBuilder, n: number): void {
  (b as unknown as { nextSeed: number }).nextSeed = n;
}

/** The builder's seed counter now. */
export function seedNow(b: WorldBuilder): number {
  return (b as unknown as { nextSeed: number }).nextSeed;
}

/**
 * The wading Walker (its frames come from the Walker lane). A sprite given the same plane, x, y,
 * path, speed, frames, fps and stepMove moves in lockstep with it and shows the same frame index
 * (for its wake, rings and wet shins).
 *
 * Round 4 (the sky lane, on Dex's word: "the walker further back with the clouds"): it wades far
 * out on the lake, on P1 with the far karst, so it parallaxes like a mountain and stands in the
 * far haze and fog, its chest in the low cloud deck. It is drawn from its half-size frame set at
 * that plane's play-zoom density (280 px tall), never redrawn. Its motion keeps the render's
 * ground step (1.912 px a frame at that size) so its planted feet stay planted; it starts right
 * of the sun (frame 0.2, 0.11) in every key frame and walks east, away from it.
 */
export const WALKER = {
  plane: "far" as const,
  x: 6000,
  /** (its hooves stand 8.06 art px under the far waterline, as the render's 16.13 at full size) */
  y: LAKE_Y + 8.06 / PLANES.far.rate,
  frames: 48,
  fps: 2.4,
  path: [6000, 6000 + 18750] as [number, number],
  speed: (1.912143386161926 * 2.4) / PLANES.far.rate,
  stepMove: true,
  /** Its own haze: further off than the far karst's ghosts would leave it, it still reads as the giant. */
  fade: 0.4,
  /** The set's scale against its full-size render (the wake painter follows it). */
  scale: 0.5,
  /** Its frame set: 280 px tall at play zoom on P1. */
  sets: [{ level: 1, base: "/tesu/walker/wade-280/" }],
} as const;
