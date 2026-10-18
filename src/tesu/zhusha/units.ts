// Zhusha's units, with no browser and no bundler in them (the controller, draw.ts and the tests share them).
//
// H is her height at play zoom in world px (config.ts, 96). feel.json counts in H, H/s and ticks.
// - charScale (Dex 10-18, "maybe make her slightly bigger, like 10%"): her DRAWN height is H * charScale. Her art
//   (128 px skull to sole), her white box, her hurtbox and her attack boxes follow the drawn body.
// - Movement does not: run speeds are metres per second turned into H/s with the world's metre (one H is
//   units.metresPerH metres, the character height in docs/character/PIPELINE.md), never through charScale.

import { FIGURE_H } from "./contract.ts";

export interface UnitsFeel {
  charScale: number;
  units: { metresPerH: number };
  run: { mps: number; ultMps: number };
}

/** Her drawn height, world px. */
export function drawnH(feel: UnitsFeel, H: number): number {
  return H * feel.charScale;
}

/** World px per art px for 128 px art drawn at her drawn height. */
export function artPx(feel: UnitsFeel, H: number): number {
  return drawnH(feel, H) / FIGURE_H;
}

/** Metres per second to H per second (the world's metre; independent of charScale). */
export function mpsToHps(feel: UnitsFeel, mps: number): number {
  return mps / feel.units.metresPerH;
}

/** Her run speed, H/s: normal form or the ult form. */
export function runHps(feel: UnitsFeel, ult: boolean): number {
  return mpsToHps(feel, ult ? feel.run.ultMps : feel.run.mps);
}

/** H per second to world px per tick (60 ticks a second). */
export function pxPerTick(hps: number, H: number): number {
  return (hps * H) / 60;
}

/** Checks the unit fields feel.json must carry; throws naming the first problem. */
export function checkUnits(feel: unknown): asserts feel is UnitsFeel {
  const f = feel as Partial<UnitsFeel> | null;
  const pos = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v > 0;
  if (!f || !pos(f.charScale) || f.charScale! > 3) throw new Error("feel.json: charScale must be a number in (0, 3]");
  if (!f.units || !pos(f.units.metresPerH)) throw new Error("feel.json: units.metresPerH must be a positive number");
  if (!f.run || !pos(f.run.mps) || !pos(f.run.ultMps)) throw new Error("feel.json: run.mps and run.ultMps must be positive numbers");
}

/** How the play plane lands on the frame this pass (game.ts): scale, the focus it zooms about, the mirror row. */
export interface PlayView {
  s: number;
  focus: [number, number];
  mirror: number | null;
}

/**
 * The transform that draws art at `a` world px per art px about a pivot at world (px, py), for the world
 * renderer's setTransform(z, focus) (frame = round((x - cam - focus) * z + focus), x a whole world px).
 * z = s * a; the pivot lands where the play plane puts it, snapped to a whole frame px, so each art px column
 * and row lands on the same frame px in every drawing (no shimmer while she moves). Draw a drawing's top-left
 * at q + its offset from the pivot in art px.
 */
export function artTransform(view: PlayView, camX: number, camY: number, px: number, py: number, a: number): { z: number; focus: [number, number]; q: [number, number]; pivot: [number, number] } {
  const [Fx, Fy] = view.focus, s = view.s;
  const qx = Math.round(px), qy = Math.round(py);
  const Px = Math.round((qx - camX - Fx) * s + Fx), Py = Math.round((qy - camY - Fy) * s + Fy);
  const z = s * a;
  if (Math.abs(1 - z) < 1e-9) return { z: 1, focus: [0, 0], q: [Px + camX, Py + camY], pivot: [Px, Py] };
  return { z, focus: [(Px - (qx - camX) * z) / (1 - z), (Py - (qy - camY) * z) / (1 - z)], q: [qx, qy], pivot: [Px, Py] };
}
