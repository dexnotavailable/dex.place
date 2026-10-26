// Room discovery. Nothing here needs editing when a room is added:
//
// - rooms/_blockout/*.ts   the grey-box of the whole round (lane W0): all 21
//                          rooms of WORLD-PLAN section 3 at their sizes, plus
//                          the ferry ride, collision and mechanisms only;
// - rooms/<region>/**.ts   the region lanes' rooms (ringwater, plain, hollow,
//                          spire, chapel). A room whose id matches a grey-box
//                          room (A0 ... E4) replaces it;
// - rooms/*.ts             the runtime's 3-room test world (arrival, plain,
//                          house), kept reachable at ?world=test until its
//                          regions exist.
//
// A module may export rooms in any shape: `export const dock: RoomDef`,
// `export default [a, b]`, `export const rooms = {...}`. Anything that looks
// like a RoomDef (id, w, h, terrain, spawns, backdrop) is taken. Folders and
// files starting with "_" (other than _blockout) are ignored, so a lane can
// keep helpers next to its rooms.

import type { RoomDef } from "../room/types.ts";
import type { PropRecipe } from "../props-api.ts";

function isRoomDef(v: unknown): v is RoomDef {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<RoomDef>;
  return typeof r.id === "string" && typeof r.w === "number" && typeof r.h === "number" && Array.isArray(r.terrain) && !!r.spawns && !!r.backdrop && Array.isArray(r.exits);
}

function isStubRecipe(v: unknown): v is PropRecipe {
  if (!v || typeof v !== "object") return false;
  const r = v as Partial<PropRecipe>;
  return typeof r.name === "string" && typeof r.reason === "string" && typeof r.build === "function";
}

function collect(mod: unknown, out: RoomDef[], recipes: PropRecipe[]): void {
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): void => {
    if (!v || typeof v !== "object" || seen.has(v) || depth > 2) return;
    seen.add(v);
    if (isRoomDef(v)) {
      out.push(v);
      return;
    }
    if (isStubRecipe(v)) {
      recipes.push(v);
      return;
    }
    const vals = Array.isArray(v) ? v : Object.values(v as Record<string, unknown>);
    for (const x of vals) walk(x, depth + 1);
  };
  for (const v of Object.values(mod as Record<string, unknown>)) walk(v, 0);
}

const blockoutMods = import.meta.glob("./_blockout/*.ts", { eager: true });
const regionMods = import.meta.glob("./*/**/*.ts", { eager: true });
const testMods = import.meta.glob(["./*.ts", "!./registry.ts", "!./common.ts"], { eager: true });

export interface RoomSet {
  /** Every room by id (region rooms replace grey-box rooms with the same id). */
  rooms: Map<string, RoomDef>;
  /** Where each room came from (debug overlay, the report). */
  source: Map<string, "blockout" | "region" | "test">;
  /** Stub-engine recipes the region modules export (placeable by name). */
  recipes: PropRecipe[];
}

export function discoverRooms(): RoomSet {
  const rooms = new Map<string, RoomDef>();
  const source = new Map<string, "blockout" | "region" | "test">();
  const recipes: PropRecipe[] = [];
  const add = (mods: Record<string, unknown>, kind: "blockout" | "region" | "test", filter: (path: string) => boolean): void => {
    for (const [path, mod] of Object.entries(mods).sort(([a], [b]) => a.localeCompare(b))) {
      if (!filter(path)) continue;
      const list: RoomDef[] = [];
      collect(mod, list, recipes);
      for (const r of list) {
        if (kind === "test" && rooms.has(r.id)) continue;
        rooms.set(r.id, r);
        source.set(r.id, kind);
      }
    }
  };
  add(testMods, "test", () => true);
  add(blockoutMods, "blockout", () => true);
  // region rooms last: they replace the grey-box (a path segment starting with "_" is a helper)
  add(regionMods, "region", (p) => !p.split("/").slice(1).some((seg) => seg.startsWith("_")));
  return { rooms, source, recipes };
}

/** The round's rooms in route order (the map, the travel log). Grey-box ids; region rooms keep them. */
export const ROUTE = ["A0", "A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "B5", "C1", "C2", "C3", "D1", "D2", "D3", "D4", "E1", "E2", "E3", "E4"] as const;
