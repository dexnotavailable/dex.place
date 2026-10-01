// The one place the world's scale is decided. Everything else (renderer,
// camera, rooms, props, physics, the stand-in bake) reads these numbers, so a
// nudge here moves the whole world together. Room geometry is authored in
// units of H (the player's height) through h(), never in raw pixels.

import { SCALE as LOCKED } from "../scenes/engine/scale.ts";

// The locked numbers themselves (view 1280x720, player 80, close-up 144, the
// presentation rule) live in src/scenes/engine/scale.ts, shared with the
// scene engine, so there is one place to nudge them. This file names them for
// the world and adds what only the world runtime needs.
export const SCALE = {
  /** World view in world pixels (double the old 640x360). */
  viewW: LOCKED.view.w,
  viewH: LOCKED.view.h,
  /** Player height in exploration, world px (skull top to sole). ~11% of the view height. */
  H: LOCKED.player,
  /** Close-up render height: cut-ins, combat zoom, portraits. */
  closeupH: LOCKED.closeup,
  /** Height the lab stand-in, its clip data and the MOVESET numbers are authored at. */
  sourceH: 96,
} as const;

/**
 * The frame the world renders into, in world px. It is wider than the design
 * view (1280x720, what scenes and rooms are composed in) so the camera can
 * stand further back outside: exteriors show the whole frame (the player is
 * ~9% of its height instead of 11%), interiors zoom in (ZOOM) so a room fills
 * it. Backdrops keep their 1280x720 composition inside it and extend to its
 * edges (backdrop/engine.ts, "frame").
 */
export const FRAME: { w: number; h: number } = { w: 1536, h: 864 };

/**
 * The frame's width follows the window's shape (height is fixed, so the world's scale is
 * set by the window height alone): a wider window gets a wider frame, so the view extends
 * sideways instead of showing black side borders. `min` is where narrower windows stop
 * getting narrower frames (they letterbox top and bottom instead; the design view's width),
 * `max` is 32:9 (beyond that, ultrawides get pillars). Widths are multiples of `step`.
 */
export const FRAME_W = { base: 1536, min: 1280, max: 3072, step: 8 } as const;

/** Frame width for a window of this aspect (width / height); rounds up so the frame covers it. */
export function frameWidthFor(aspect: number): number {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const want = Math.ceil((FRAME.h * a - 1e-6) / FRAME_W.step) * FRAME_W.step;
  return Math.max(FRAME_W.min, Math.min(FRAME_W.max, want));
}

export const ZOOM = {
  /**
   * Outside: the design view's framing (1536 / 1280 = 1.2 of the base frame; the player is 11%
   * of the view height, was 9.3%). Also the global factor: explicit room zooms are multiplied by it.
   */
  exterior: 1536 / LOCKED.view.w,
  /** Inside: closer still (was 1.2), more when that still shows past the room. */
  interior: 1.45,
  /** Never closer than this (pixels stay readable, the room still reads as a room). */
  max: 1.8,
  /**
   * Short screens (a phone held sideways: CSS height up to this) keep the design view's framing
   * outside too, so she stays readable there.
   */
  compactHeight: 540,
} as const;

/** Player-scale factor from the authored 96 px data to the world's H. */
export const K = SCALE.H / SCALE.sourceH;
/** Close-up factor from the authored data to the close-up render. */
export const K_CLOSE = SCALE.closeupH / SCALE.sourceH;
/** World zoom that makes the exploration player the close-up height. */
export const CLOSEUP_ZOOM = SCALE.closeupH / SCALE.H;

/** Units of H to whole world pixels. */
export const h = (n: number): number => Math.round(n * SCALE.H);

export const PRESENT = {
  // The scale rule (whole-number nearest when it fills the window well enough,
  // otherwise sharp-bilinear, never plain bilinear) is presentRect() in
  // src/scenes/engine/scale.ts. Here: the world's black cinematic bars,
  // share of the view height per bar.
  bars: { explore: 0.03, cinematic: 0.085, rate: 0.03 },
} as const;

export const CAMERA = {
  /**
   * Framing like the old site: the player a little left of centre toward the
   * way she faces (look-ahead), feet low in the frame with sky above.
   */
  lookahead: 0.09, // of viewW
  lookaheadRate: 0.035,
  /** Extra look-ahead at a full run, share of viewW (on top of `lookahead`). */
  lookRun: 0.04,
  /** Hit punch: zoom factor added at contact (eased in fast, out slower), per tap. */
  punch: { light: 0.035, heavy: 0.07, inRate: 0.35, outRate: 0.09 },
  /** Ultimate: extra zoom (1 = none) and the ease-in, hold and ease-out in ticks (60/s). */
  ult: { zoom: 0.32, inTicks: 14, holdTicks: 24, outTicks: 28 },
  /** Feet sit at this share of the view height. */
  anchorY: 0.78,
  /** Vertical dead zone in H: small hops don't move the camera. */
  deadzoneY: 0.55,
  followX: 0.1,
  followY: 0.075,
  /** Blend rate into and out of framing zones (per tick). */
  zoneRate: 0.02,
} as const;

export const PHYSICS = {
  /** Auto step-up height for stairs and small ledges, in H. */
  stepUp: 0.26,
  /** Snap down onto stairs going down, in H. */
  stepDown: 0.3,
  /** Falling this far below the room means a pit: fade and return to the last safe ground. */
  pitMargin: 2,
} as const;

export const STREAM = {
  /** Rooms kept built (GPU programs, textures) this many doors away from the current one. */
  keepDepth: 1,
} as const;
