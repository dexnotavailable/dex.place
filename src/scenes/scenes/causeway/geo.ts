// B2 The Causeway, with B3 the Bus Shelter and B4 Stonetop inside it
// (WORLD-PLAN sections 3 and 4, lane R-B): the layout in the plan's world
// coordinates (x in H west to east, y in H as elevation, the lake at 0),
// shared by the room (collision, props) and the backdrop (the road, the
// crater, the breaks and the Stonetop tor are drawn where the collision is).
// The walk is the grey-box's, unchanged, so the round's times and jumps hold.

import { SCALE } from "../../engine/scale.ts";
import type { BuildCtx } from "../../engine/index.ts";

export const B2 = {
  x0: 108,
  x1: 172,
  top: 22,
  bottom: -3.2,
  /** The flooded flats' sheet water (break 1's water returns you here). */
  flats: 0.3,
  /** Rail camera on the road: feet at this share of the view. */
  anchor: 0.75,
  /** Where the colossus walks the flats (plan: 6 to 12). */
  colDepth: 9,
  /** Road runs: [x0, x1, top]. */
  road: [
    [108, 114, 1.0],
    [114, 120, 1.2],
    [121.1, 134, 1.2],
    [144.3, 146, 1.4],
    [148.5, 154, 1.6],
    [154, 160, 1.8],
    [160, 172, 2.0],
  ] as [number, number, number][],
  /** Break 1: a single jump (1.1 H), water below. */
  break1: [120, 121.1] as [number, number],
  /** The colossus's footprint: stairs down from 134 (1.2) to the pool (-1.6), up to 144.3 (1.4). */
  crater: { x0: 134, x1: 144.3, top: 1.2, floor: -1.6, pool: [138.2, 139.8] as [number, number], water: -1.3, out: 1.4 },
  /** Break 2 (2.5 H): steps down to a shin-deep wade (0.8, water at 1.1), steps up to 1.4, the road resumes at 148.5 (1.6). */
  break2: { x0: 146, x1: 148.5, floor: 0.8, water: 1.1, bottom: [146.9, 147.6] as [number, number] },
  /** The rib arch's one-way ribs (an optional double-jump climb). */
  ribs: [
    [150, 151.4, 3.2],
    [152.4, 153.8, 4.7],
  ] as [number, number, number][],
  /** B3: the bus shelter's roof (solid: Stonetop starts from it). */
  shelter: { x0: 160, x1: 168, roof: [159.8, 168, 5.3, 5.0] as [number, number, number, number], floor: 2.0 },
  /** B4 Stonetop: one-way ledges from the shelter's roof to the top. */
  stones: [
    [158.2, 159.6, 3.3],
    [156.6, 158.0, 4.6],
    [166, 167.5, 6.8],
    [169, 170.5, 8.3],
    [166, 167.5, 9.8],
    [162.5, 164, 11.3],
    [159.5, 161, 12.8],
    [162.5, 164, 14.3],
    [165.5, 167, 15.8],
  ] as [number, number, number][],
  summit: [159.8, 166.2, 17.3] as [number, number, number],
} as const;

const H = SCALE.player;

/** Room px of a world x / elevation. */
export const rx = (wx: number): number => Math.round((wx - B2.x0) * H);
export const ry = (wy: number): number => Math.round((B2.top - wy) * H);

export const ROOM_W = rx(B2.x1);
export const ROOM_H = ry(B2.bottom);
export const SPAN = ROOM_W - SCALE.view.w;
/** The camera's row on the road (1.2 H): the reference framing the backdrop is authored at. */
export const CY0 = Math.round(ry(1.2) - B2.anchor * SCALE.view.h);

export interface Geo {
  W: number;
  H: number;
  u: number;
  P: number;
  inWorld: boolean;
  ref: number;
  hor: number;
  /** Screen row (reference framing) of the flats' water at the player plane. */
  wl: number;
  groundY: (d: number) => number;
  LY: (sy: number, d: number) => number;
  X: (wx: number) => number;
  Y: (wy: number) => number;
  span: number;
  reach: (d: number, margin?: number) => [number, number];
}

export function geo(ctx: BuildCtx, inWorld: boolean): Geo {
  const { W, H: VH, u } = ctx;
  const k = ctx.world;
  const ref = inWorld ? CY0 * k : 0;
  const hor = Math.round(VH * 0.62);
  const wl = Math.round((ry(B2.flats) - CY0) * k);
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
    groundY: (d) => Math.round(hor - 1 + (wl - hor + 1) / d),
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
