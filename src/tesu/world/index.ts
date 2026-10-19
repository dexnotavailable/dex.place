// The whole land, built once from its sections. Deterministic: the main thread, the plate
// workers and the Node previews all build the same WorldDef.

import "../art/painters/index.ts";
import { h } from "../config.ts";
import { WorldBuilder } from "./build.ts";
import { gateRoad } from "./sections/gate-road.ts";
import { kagami } from "./sections/kagami.ts";
import { palace } from "./sections/palace.ts";
import { openingCamera } from "./sections/opening.ts";
import { hall } from "./sections/hall.ts";
import { court } from "./sections/court.ts";
import { shiraito } from "./sections/shiraito.ts";
import { hoaipho } from "./sections/hoaipho.ts";
import { shanshui } from "./sections/shanshui.ts";
import { tsuji } from "./sections/tsuji.ts";
import { yuemen } from "./sections/yuemen.ts";
import type { WorldDef } from "./types.ts";
import { adoptWorld } from "./current.ts";

/** About 480 x 240 H (GDK 3.1), plus the interiors' band below it (config INTERIOR_Y). */
export const WORLD_W = h(480);
export const WORLD_H = h(330);

let built: WorldDef | null = null;

export { adoptWorld } from "./current.ts";

/** The whole land, built (once); it also becomes the world the page runs when none was adopted (world/current.ts). */
export function buildWorld(): WorldDef {
  if (built) return built;
  const b = new WorldBuilder(WORLD_W, WORLD_H);
  kagami(b);
  gateRoad(b);
  palace(b);
  openingCamera(b);
  hall(b);
  court(b);
  shiraito(b);
  hoaipho(b);
  shanshui(b);
  tsuji(b);
  yuemen(b);
  built = b.finish();
  adoptWorld(built);
  return built;
}
