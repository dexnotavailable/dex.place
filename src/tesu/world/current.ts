// The world the page runs (engine, perf): adopted from the bake or a plate worker, or built (world/index.ts) only when
// neither is there. Holding it here keeps the world's sections and art libraries out of the page's own code: they
// load only where the world is built or painted (the workers, the build, Node tools, ?manual captures).

import type { WorldDef } from "./types.ts";

let current: WorldDef | null = null;

/** The world to run (the first one adopted wins). */
export function adoptWorld(def: WorldDef): void {
  if (!current) current = def;
}

/** The world adopted, or null. */
export function peekWorld(): WorldDef | null {
  return current;
}

/** The world adopted; an error when none is yet (adopt or build one first). */
export function currentWorld(): WorldDef {
  if (!current) throw new Error("no world yet: adoptWorld() or buildWorld() first");
  return current;
}
