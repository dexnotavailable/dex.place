// Shared placement helpers for Kagami's dressing files (kagami-backdrop.ts, kagami-jetty.ts,
// kagami-land.ts). Kagami's art is re-dressed in parallel by three painters, one file each; this
// file and kagami.ts hold what they share and stay fixed while they work.

import { h } from "../../config.ts";
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
 * The wading Walker (the world builder's placement; its frames come from the Walker lane). A
 * sprite given the same x, y, path, speed, frames, fps and stepMove moves in lockstep with it
 * and shows the same frame index (for its wake, rings and wet shins).
 */
export const WALKER = {
  x: h(84),
  y: LAKE_Y + h(0.6),
  frames: 48,
  fps: 2.4,
  path: [h(70), h(140)] as [number, number],
  speed: 32.8,
  stepMove: true,
  /** Its frame sets: 560 px tall at play zoom on P2, a half-size set for the wide frames. */
  sets: [{ level: 1, base: "/tesu/walker/wade-560/" }, { level: 0.5, base: "/tesu/walker/wade-280/" }],
} as const;
