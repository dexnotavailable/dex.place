// Helpers for the Hollow's rooms (the "_" keeps rooms/registry.ts from
// reading this file as a room module).

import type { TerrainArt } from "../../room/terrain.ts";
import type { Surface } from "../../room/collision.ts";
import type { PropPlacement, TerrainPiece } from "../../room/types.ts";

/** Terrain ramps (5 steps, darkest first) that sit in each room's backdrop. */
export const HOLLOW_RAMP = {
  /** The market street: warm, soot-dark flagstone. */
  street: ["#120d0b", "#1d1511", "#2b1f18", "#3d2c20", "#5a412c"],
  /** The archive: dark oiled wood. */
  archive: ["#140e0b", "#21160f", "#312116", "#452f1f", "#5e422b"],
  /** The lift foot: cold grey-green tile. */
  tile: ["#161a1b", "#222829", "#31393a", "#46504f", "#66716e"],
} as const;

/**
 * Give the grey-box terrain its art: `art` by surface (a surface not listed
 * keeps "stone"), one ramp for the room. "none" keeps the collision and
 * draws nothing (a pixel prop draws it: the grating walkway, stall roofs).
 */
export function dressTerrain(ts: TerrainPiece[], art: Partial<Record<Surface, TerrainArt>>, ramp: readonly string[]): TerrainPiece[] {
  return ts.map((t) => ({ ...t, art: art[t.surface] ?? "stone", ramp: [...ramp] }));
}

/** Placements whose recipe names a pixel-matter prop keep engine "pixel"; the rest as authored. */
export function placePixel(ps: PropPlacement[]): PropPlacement[] {
  return ps.map((p) => ({ ...p }));
}
