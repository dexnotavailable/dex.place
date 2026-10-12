// Tesu, the continuous world at dex.place/tesu. The one place its scale is decided.
//
// H is Zhusha's height at play zoom. Everything on the play plane (ground, props,
// buildings, characters) is authored at one art pixel = one world pixel at play zoom;
// nothing is resized except by the camera. Background planes have their own density,
// consistent within each plane (see render/view.ts for how planes scale with the camera).
//
// The frame is 16 x 9 H at play zoom: 1536 x 864 world px at H = 96. Its height is fixed;
// its width follows the window's shape (render/renderer.ts, the shared FRAME_W rule), so
// wide windows see further sideways instead of getting black side bars.

/** Zhusha's height at play zoom, world px. */
export const H = 96;
/** Her close-up render height (R's dive and stamp, the opening's first frame, the splash card). */
export const CLOSE_H = 192;
/** Frame height in art px. 9 H at play zoom. */
export const FRAME_H = 864;

/** H units to whole world px. */
export const h = (n: number): number => Math.round(n * H);

/** One map unit of MAP-builder.svg is 0.2 H. */
export const MAP_UNIT = 0.2;
/** Map units to world px. */
export const mu = (n: number): number => Math.round(n * MAP_UNIT * H);

/**
 * The authored camera levels (the play plane's scale on screen). Art exists at each one
 * (where it is used); while the camera moves it scales smoothly, sampling the next level
 * up, and at rest it snaps to a level.
 */
export const ZOOMS = [2, 1, 0.5, 0.25, 0.125] as const;
export type Zoom = (typeof ZOOMS)[number];

/**
 * Interiors (the Hall of Works, shops, the nook) live in a band of the world below the land:
 * a door is a scene cut, so where they sit does not matter, and below the land nothing
 * outside can be seen from them. Anything deeper than this y is indoors.
 */
export const INTERIOR_Y = 250 * H;

/** Plate tiles: art px per side. */
export const TILE = 256;

/** Movement as measured (Appendix B): she walks 2 H/s. */
export const WALK_H_PER_S = 2;

export const PHYSICS = {
  /** Steepest walkable slope (rise over run). Steeper ground is a wall or a step. */
  maxSlope: 1.05,
  /** Step up onto a ledge this high without jumping, in H. */
  stepUp: 0.26,
  /** Snap down onto ground this far below while walking (slopes, stair noses), in H. */
  stepDown: 0.34,
  /** A fall longer than this many H is a cloud drop (the camera follows, she grabs her hat). */
  cloudDrop: 13.5,
} as const;
