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
import type { WorldDef } from "./types.ts";

/** About 480 x 240 H (GDK 3.1), plus the interiors' band below it (config INTERIOR_Y). */
export const WORLD_W = h(480);
export const WORLD_H = h(330);

let built: WorldDef | null = null;

export function buildWorld(): WorldDef {
  if (built) return built;
  const b = new WorldBuilder(WORLD_W, WORLD_H);
  kagami(b);
  gateRoad(b);
  palace(b);
  openingCamera(b);
  hall(b);
  built = b.finish();
  return built;
}
