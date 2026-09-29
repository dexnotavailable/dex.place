// The locked world scale: ONE place to nudge it. Everything else (the engine's
// render modes, the presentation rule, the stand-in, scenes that size things in
// player heights) reads these numbers.
//
// - World view: 1280x720 world pixels (double the old 640x360).
// - Presentation: the largest whole-number nearest upscale when it fills the
//   window well enough; otherwise "sharp-bilinear": nearest upscale to the next
//   whole multiple, then a linear downsample to the fitted size, so pixels stay
//   crisp at fractional sizes (1.5x on 1080p). Never plain bilinear.
// - Player height H: 80 world px in exploration (about 11% of the view); a 144 px
//   close-up render is reserved for cut-ins, combat zoom and portraits. World
//   geometry (doors, steps, platforms, jump heights, props) is sized in H.

import type { Mode } from "./types.ts";

export const SCALE = {
  /** The world view in world pixels. */
  view: { w: 1280, h: 720 },
  /** The old view, kept to compare against (Z cycles modes, ?res=near). */
  legacy: { w: 640, h: 360 },
  /** Mode a scene opens in unless the URL asks for another. */
  defaultMode: "world" as Mode,
  /** Player height in world px (exploration) and the close-up render height. */
  player: 80,
  closeup: 144,
  /**
   * Presentation. An integer scale k is used (nearest, letterboxed) when k covers
   * at least `integerFill` of the fitted size; below that the frame is fitted
   * with sharp-bilinear. 0.92 keeps 1366x768 at a crisp 1x with a thin border,
   * and sends 1920x1080 (fit 1.5) to sharp-bilinear.
   */
  present: { integerFill: 0.92 },
} as const;

/** Render modes: world is the locked view, near/far are the old prototype sizes. */
export const RESOLUTIONS: Record<Mode, [number, number]> = {
  world: [SCALE.view.w, SCALE.view.h],
  near: [SCALE.legacy.w, SCALE.legacy.h],
  far: [960, 540],
};

/** Order Z cycles through. */
export const MODES: Mode[] = ["world", "near", "far"];

/** Player height in px at a buffer height (80 at 720; scaled for the comparison modes). */
export function playerPx(bufferH: number): number {
  return Math.round((SCALE.player * bufferH) / SCALE.view.h);
}

export type PresentMode = "auto" | "integer" | "sharp";

export interface PresentRect {
  /** Device-pixel rect (bottom-left origin) the frame is drawn into. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Device pixels per world pixel (may be fractional). */
  scale: number;
  /** Whole-number prescale the sharp path upsamples to (1 = plain nearest). */
  prescale: number;
  sharp: boolean;
}

/**
 * Where and how a W x H frame goes into a cw x ch canvas.
 * auto: the rule above. integer: always the old whole-number letterbox.
 * sharp: always fit with sharp-bilinear (integer fits still come out exact).
 */
export function presentRect(cw: number, ch: number, W: number, H: number, mode: PresentMode = "auto"): PresentRect {
  const fit = Math.min(cw / W, ch / H);
  const k = Math.max(1, Math.floor(fit + 1e-6));
  // below 1x a whole-number scale would crop the frame; the sharp path shrinks it instead
  const useInt = fit >= 1 - 1e-6 && (mode === "integer" || (mode === "auto" && (k / fit >= SCALE.present.integerFill || Math.abs(fit - k) < 1e-6)));
  if (useInt) {
    const w = W * k;
    const h = H * k;
    return { x: Math.floor((cw - w) / 2), y: Math.floor((ch - h) / 2), w, h, scale: k, prescale: 1, sharp: false };
  }
  const w = Math.round(W * fit);
  const h = Math.round(H * fit);
  return { x: Math.floor((cw - w) / 2), y: Math.floor((ch - h) / 2), w, h, scale: fit, prescale: Math.max(1, Math.ceil(fit - 1e-6)), sharp: true };
}
