// The pixel engine's view of the locked world scale. There is ONE source of
// truth for the numbers: src/scenes/engine/scale.ts (view 1280x720, player
// H = 80, close-up 144, the presentation rule). This module only renames them
// for the engine (SCALE.H, closeupH, present.integerCover) and adds what only
// the pixel engine needs (hu, physics). Nudge a number there, never here.
//
// Old site: the hero was ~52 px of a 900 px view (~6%). Here the player is
// 80 of 720 (~11%) in exploration, with a 144 px close-up render reserved for
// cut-ins, combat zoom and portraits.

import { presentRect, SCALE as LOCKED } from "../scenes/engine/scale.ts";

export const SCALE = {
  /** World view in world pixels (double the old 640x360). */
  view: LOCKED.view,
  /** Player height in world pixels, exploration. */
  H: LOCKED.player,
  /** Close-up render height for cut-ins / combat zoom / portraits. */
  closeupH: LOCKED.closeup,
  /**
   * Presentation: the largest whole-number nearest-neighbour upscale when it
   * covers at least `integerCover` of the fitted size; otherwise
   * "sharp-bilinear" (nearest to the next whole multiple, then a linear
   * downsample). Never plain bilinear. Same value as the locked integerFill.
   */
  present: { integerCover: LOCKED.present.integerFill },
  /** Reference only: the old site's hero-to-view ratio. */
  oldSite: { heroPx: 52, viewPx: 900 },
} as const;

/** World pixels for a length given in H (rounded to whole pixels). */
export function hu(f: number, H: number = SCALE.H): number {
  return Math.round(f * H);
}

export type PresentMode = "integer" | "sharp-bilinear";

export interface PresentFit {
  mode: PresentMode;
  /** Final scale from world pixels to device pixels. */
  scale: number;
  /** Whole-number intermediate upscale (sharp-bilinear) or the integer scale. */
  intScale: number;
  /** Output rect in device pixels (letterboxed, centred). */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * How a `vw` x `vh` frame is shown on a `cw` x `ch` device-pixel canvas. The
 * rule itself is the locked one (`presentRect` in src/scenes/engine/scale.ts);
 * this only renames its fields for the pixel renderer.
 */
export function presentFit(cw: number, ch: number, vw: number = SCALE.view.w, vh: number = SCALE.view.h): PresentFit {
  const r = presentRect(cw, ch, vw, vh, "auto");
  return {
    mode: r.sharp ? "sharp-bilinear" : "integer",
    scale: r.scale,
    intScale: r.sharp ? r.prescale : r.scale,
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  };
}

/** Physics constants in H units per second, so motion scales with H. */
export function physics(H: number): { gravity: number; maxFall: number } {
  return { gravity: 17.5 * H, maxFall: 14 * H };
}
