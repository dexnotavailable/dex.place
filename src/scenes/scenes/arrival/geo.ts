// Shared geometry for the arrival. View-scaled things are fractions of W/H (or
// multiples of u = H/360); character-scaled things are multiples of P, the locked
// player height (80 px in the 1280x720 world view, scaled in the old comparison
// modes so the composition stays the same).

import type { BuildCtx } from "../../engine/index.ts";

export const SHAFT_DEPTH = 7;
export const RING_DEPTH = 34;
/** The colossus walks the far strand behind the lake; a second, fainter one further back. */
export const COL_DEPTH = 20;
export const GHOST_DEPTH = 27;
/**
 * Where the player's feet (the dock's deck) sit, as a share of the view height.
 * WORLD-PLAN section 1 puts vast exteriors at 0.72-0.80 and the dock at 0.8; the
 * scenes lane first composed it at 0.91 (H - 0.8 P). Settled by lane R-A by looking at both.
 */
export const DECK_AT = 0.8;

// Ring in camera space: camera at the origin looking down +z, y up. The ring is
// a thick band (inner radius R, radial thickness T, axial width WD) whose axis
// is tipped so its lower-left arc swings away from us: we look down onto that
// arc's inner face, and the upper right (with the break) is the near side.
export const RING = { C: [-18, 96, 112] as const, R: 100, T: 22, WD: 80, A: [-0.3, -0.6, -1] as const, gapAt: [0.8, 0.05] as const };

export interface Geo {
  W: number;
  H: number;
  u: number;
  /** Locked player height in this mode's px (80 in the world view). */
  P: number;
  hor: number;
  /** Dock top (the player's ground). */
  deck: number;
  /** Waterline under the dock (depth 1). */
  wl: number;
  k1: number;
  /** Row where something standing in the lake at depth d meets the water. */
  waterY: (d: number) => number;
  sun: [number, number];
  sunR: number;
  beamFrom: [number, number];
  beamTo: [number, number];
  figX: number;
  dockEnd: number;
  lantern: [number, number];
  F: number;
  span: number;
  /** Visible layer-x range at a depth over the whole pan, plus a margin. */
  reach: (d: number, margin?: number) => [number, number];
}

/**
 * rise: how far above the dock's eye line this view stands, in view px (the cliff stair, the
 * yard). The horizon stays put; the lake is seen from higher, so everything standing in it
 * (hills, the strand, the colossus, the rocks) meets the water lower in the frame.
 */
export function geo(ctx: BuildCtx, o: { rise?: number } = {}): Geo {
  const { W, H, u } = ctx;
  const P = ctx.player;
  const hor = Math.round(H * 0.64);
  const deck = Math.round(H * DECK_AT);
  const wl = deck + Math.round(P * 0.28);
  // the water plane's projection: the row where depth d meets the water
  const k1 = (wl + Math.round(o.rise ?? 0) - hor + 1) / (H - hor);
  const figX = Math.round(W * 0.47);
  const dockEnd = figX + Math.round(P * 0.5);
  return {
    W,
    H,
    u,
    P,
    hor,
    deck,
    wl,
    k1,
    waterY: (d) => Math.round(hor - 1 + ((H - hor) * k1) / d),
    sun: [Math.round(W * 0.63), Math.round(H * 0.19)],
    sunR: Math.round(H * 0.075),
    beamFrom: [W * 0.62, H * 0.22],
    beamTo: [W * 0.445, H * 0.735],
    figX,
    dockEnd,
    lantern: [dockEnd - Math.round(P * 0.05), deck - Math.round(P * 0.66)],
    F: H * 0.95,
    span: ctx.span,
    reach: (d, margin = 0) => {
      const e = Math.ceil((ctx.span * ctx.par(d)) / 2) + margin;
      return [-e, W + e];
    },
  };
}
