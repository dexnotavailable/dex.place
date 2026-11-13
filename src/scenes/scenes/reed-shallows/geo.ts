// B1 Reed Shallows: the room's layout (WORLD-PLAN section 3 and 4, lane R-B)
// in the plan's world coordinates (x in H west to east, y in H as elevation,
// the lake surface at 0), shared by the room (collision, props) and the
// backdrop (the depth-1 art is drawn exactly where the collision is).

import { SCALE } from "../../engine/scale.ts";
import type { BuildCtx } from "../../engine/index.ts";

export const B1 = {
  x0: 76,
  x1: 108,
  /** Room top and bottom elevation (the camera's anchor holds at the yard and on the boardwalk). */
  top: 12.7,
  bottom: -2.2,
  /** The yard shelf the ramp leaves from, the boardwalk, the water, the east bank. */
  yard: 6,
  deck: 0.2,
  water: 0,
  east: 1.0,
  /** The stone stair down from the yard (standard 0.2 x 0.3 H steps). */
  stairX: 76.6,
  /** Boardwalk runs (x from, x to). */
  walks: [
    [85.3, 88],
    [88.9, 92],
    [98, 104],
  ] as [number, number][],
  /** The 0.9 H gap (jump it or wade round it) and the 6 H reed channel (wade; the bridge once cut). */
  gap: [88, 88.9] as [number, number],
  channel: [92, 98] as [number, number],
  eastStairX: 104,
  /** Rail camera: feet at this share of the view on the boardwalk. */
  anchor: 0.76,
  /** The wading colossus's depth in the shallows (plan: about 8). */
  colDepth: 8,
} as const;

const H = SCALE.player;

/** Room px of a world x / elevation. */
export const rx = (wx: number): number => Math.round((wx - B1.x0) * H);
export const ry = (wy: number): number => Math.round((B1.top - wy) * H);

export const ROOM_W = rx(B1.x1);
export const ROOM_H = ry(B1.bottom);
export const SPAN = ROOM_W - SCALE.view.w;
/** The camera's row on the boardwalk: the reference framing the backdrop is authored at. */
export const CY0 = Math.round(ry(B1.deck) - B1.anchor * SCALE.view.h);

export interface Geo {
  W: number;
  H: number;
  u: number;
  /** Player height in this mode's px. */
  P: number;
  inWorld: boolean;
  /** Vertical reference: layer y = screen y at the reference framing + round(ref / depth). */
  ref: number;
  hor: number;
  /** Screen row (reference framing) of the water at the player plane. */
  wl: number;
  deck: number;
  /** Screen row where something standing in the water at depth d meets it (reference framing). */
  waterY: (d: number) => number;
  /** Layer y for a screen row (reference framing) at a depth. */
  LY: (sy: number, d: number) => number;
  /** Depth-1 layer x / y of a world x / elevation. */
  X: (wx: number) => number;
  Y: (wy: number) => number;
  span: number;
  reach: (d: number, margin?: number) => [number, number];
}

export function geo(ctx: BuildCtx, inWorld: boolean): Geo {
  const { W, H: VH, u } = ctx;
  const k = ctx.world;
  const ref = inWorld ? CY0 * k : 0;
  const hor = Math.round(VH * 0.6);
  const wl = Math.round((ry(B1.water) - CY0) * k);
  const deck = Math.round((ry(B1.deck) - CY0) * k);
  const LY = (sy: number, d: number): number => Math.round(sy + (Number.isFinite(d) ? Math.floor(ref / d + 0.5) : 0));
  return {
    W,
    H: VH,
    u,
    P: ctx.player,
    inWorld,
    ref,
    hor,
    wl,
    deck,
    waterY: (d) => Math.round(hor - 1 + (wl - hor + 1) / d),
    LY,
    X: (wx) => Math.round(rx(wx) * k - ctx.span / 2),
    Y: (wy) => Math.round((ry(wy) - CY0) * k + ref),
    span: ctx.span,
    reach: (d, margin = 0) => {
      const e = Math.ceil((ctx.span * ctx.par(d)) / 2) + margin;
      return [-e, W + e];
    },
  };
}
