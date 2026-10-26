// B5 Hollow Mouth (WORLD-PLAN sections 3 and 4, lane R-B): the plain has
// collapsed into the fallen structure below. The layout in the plan's world
// coordinates (x in H west to east, y in H as elevation), shared by the room
// (collision, props) and the backdrop. The walk is the grey-box's.
//
// Vertical parallax, as a pinhole: the eye sits at EYE (a screen row), so a
// feature at room row R and depth d lives at layer row EYE + (R - EYE) / d
// (the world backdrop then scrolls it by camY / d). Depth 1 is room rows.

import { SCALE } from "../../engine/scale.ts";
import type { BuildCtx } from "../../engine/index.ts";

export const B5 = {
  x0: 172,
  x1: 188,
  top: 6,
  bottom: -33.6,
  /** The plain's edge where the causeway arrives, the culvert platform, the market street below. */
  plain: 2.0,
  platform: 0.0,
  street: -32,
  /** Stairs from the plain down to the platform. */
  stairX: 179,
  platformX: [182, 185.6] as [number, number],
  /** The hook's gap in the platform and the east lip where the crane stands. */
  hook: 186.4,
  lip: [187.2, 188] as [number, number],
  /** The culvert: its gate and the lever beside it (inside), the hook call levers. */
  culvertLever: 182.6,
  culvertGate: 183.9,
  callTop: 185.1,
  callBottom: 184.6,
  /** The optional way down: ledges along the west wall. */
  ledges: [
    [172.3, 174.2, -3],
    [175, 176.8, -7],
    [172.3, 174.2, -11],
    [175, 176.8, -15],
    [172.3, 174.2, -19],
    [175, 176.8, -23],
    [172.3, 174.2, -27],
  ] as [number, number, number][],
  /** Crane head height above the platform. */
  craneTop: 5.5,
  /** Free camera, looking down. */
  anchor: 0.35,
} as const;

const H = SCALE.player;
export const rx = (wx: number): number => Math.round((wx - B5.x0) * H);
export const ry = (wy: number): number => Math.round((B5.top - wy) * H);
export const ROOM_W = rx(B5.x1);
export const ROOM_H = ry(B5.bottom);
/** The eye row (the anchor): the horizon of the pinhole. */
export const EYE = Math.round(B5.anchor * SCALE.view.h);
/** The /scenes/ preview's camera row: standing on the culvert platform. */
export const REF = Math.round(ry(B5.platform) - EYE);

export interface Geo {
  W: number;
  H: number;
  u: number;
  P: number;
  inWorld: boolean;
  ref: number;
  eye: number;
  /** Layer row of room row R at depth d. */
  LY: (R: number, d: number) => number;
  /** Room row / x of an elevation / world x. */
  RY: (wy: number) => number;
  X: (wx: number) => number;
}

export function geo(ctx: BuildCtx, inWorld: boolean): Geo {
  const k = ctx.world;
  const ref = inWorld ? 0 : REF * k;
  const eye = EYE * k;
  return {
    W: ctx.W,
    H: ctx.H,
    u: ctx.u,
    P: ctx.player,
    inWorld,
    ref,
    eye,
    LY: (R, d) => Math.round(eye + (R * k - eye) / d - ref / d),
    RY: (wy) => Math.round(ry(wy) * k),
    X: (wx) => Math.round(rx(wx) * k),
  };
}
