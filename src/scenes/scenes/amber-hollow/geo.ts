// Shared layout for amber-hollow. Everything is authored in layer pixels at
// mid-pan; view-scaled sizes are multiples of u (H / 360) so near and far
// modes compose the same, character-scaled things (deck, lamp) are plain px.

import type { BuildCtx } from "../../engine/index.ts";

export const D = {
  cliff: 90,
  wall: 48,
  smokeHigh: 34,
  struts: 28,
  far: 22,
  hazeFar: 18,
  far2: 14,
  drones: 13,
  ceiling: 11,
  mid: 8,
  pits: 7,
  low: 5.5,
  ship: 5,
  cranes: 4.2,
  near: 3.2,
  bridge: 2.6,
  nearMist: 2.2,
  overhang: 1.6,
  deck: 1,
  fg: 0.7,
} as const;

export interface Opening {
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  /** Chamfer: how much of the corner is cut, in px along each axis. */
  ch: number;
}

export interface Geo {
  W: number;
  H: number;
  u: number;
  /** The big octagonal opening in the far wall, and a smaller one on the left. */
  open: Opening;
  open2: Opening;
  /** Ground lines of the city layers. */
  farG: number;
  far2G: number;
  midG: number;
  lowG: number;
  /** Foundry pits (layer px at depth D.pits): x, y, weight. */
  pits: [number, number, number][];
  pitR: [number, number];
  /** Hammerhead tower centre x (depth D.mid) and the top of its platform slab. */
  hammerX: number;
  hammerTop: number;
  /** The deck the figure stands on (depth 1). */
  deck: number;
  figX: number;
  deckEnd: number;
  lamp: [number, number];
  /** Ship lane (depth D.ship): y of the bitmap top. */
  shipY: number;
}

export function geo(ctx: BuildCtx): Geo {
  const { W, H, u } = ctx;
  const deck = H - Math.round(28 * u);
  const figX = Math.round(W * 0.42);
  const deckEnd = Math.round(W * 0.6);
  return {
    W,
    H,
    u,
    open: { cx: W * 0.6, cy: H * 0.4, ax: W * 0.3, ay: H * 0.43, ch: H * 0.3 },
    open2: { cx: W * 0.1, cy: H * 0.36, ax: W * 0.085, ay: H * 0.2, ch: H * 0.1 },
    farG: Math.round(H * 0.8),
    far2G: Math.round(H * 0.84),
    midG: Math.round(H * 0.88),
    lowG: H + 2,
    // furnace mouths in the dark lower third: a few hot pockets, not a lit floor
    pits: [
      [W * 0.1, H * 0.8, 0.7],
      [W * 0.33, H * 0.845, 0.9],
      [W * 0.455, H * 0.785, 0.6],
      [W * 0.56, H * 0.87, 1],
      [W * 0.69, H * 0.745, 0.55],
      [W * 0.87, H * 0.725, 0.65],
    ],
    pitR: [72 * u, 46 * u],
    hammerX: Math.round(W * 0.68),
    hammerTop: Math.round(H * 0.3),
    deck,
    figX,
    deckEnd,
    lamp: [deckEnd - 16, deck - 118],
    shipY: Math.round(H * 0.1),
  };
}
