// The locked world scale: ONE source of truth for view size, player height and
// how the low-res frame reaches the screen. Every prop, door, step, platform
// and jump height is sized in units of H, so nudging a number here regenerates
// everything consistently.
//
// Old site: the hero was ~52 px of a 900 px view (~6%). Here the player is
// 80 of 720 (~11%) in exploration, with a 144 px close-up render reserved for
// cut-ins, combat zoom and portraits.

export const SCALE = {
  /** World view in world pixels (double the old 640x360). */
  view: { w: 1280, h: 720 },
  /** Player height in world pixels, exploration. */
  H: 80,
  /** Close-up render height for cut-ins / combat zoom / portraits. */
  closeupH: 144,
  /**
   * Presentation. Use the largest whole-number nearest-neighbour upscale when it
   * covers at least `integerCover` of the available width/height ratio;
   * otherwise "sharp-bilinear": nearest upscale to the next whole multiple,
   * then a linear downsample to fit (crisp pixels at 1.5x on 1080p). Never
   * plain bilinear.
   */
  present: { integerCover: 0.92 },
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

/** How a `vw` x `vh` frame is shown on a `cw` x `ch` device-pixel canvas. */
export function presentFit(cw: number, ch: number, vw: number = SCALE.view.w, vh: number = SCALE.view.h): PresentFit {
  const s = Math.min(cw / vw, ch / vh);
  const si = Math.floor(s + 1e-6);
  const intOk = si >= 1 && si / s >= SCALE.present.integerCover;
  const scale = intOk ? si : s;
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  return {
    mode: intOk ? "integer" : "sharp-bilinear",
    scale,
    intScale: intOk ? si : Math.max(1, Math.ceil(s - 1e-6)),
    x: Math.floor((cw - w) / 2),
    y: Math.floor((ch - h) / 2),
    w,
    h,
  };
}

/** Physics constants in H units per second, so motion scales with H. */
export function physics(H: number): { gravity: number; maxFall: number } {
  return { gravity: 17.5 * H, maxFall: 14 * H };
}
