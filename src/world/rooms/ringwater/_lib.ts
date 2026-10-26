// Ringwater's shared room helpers (lane R-A): the evening after the round,
// terrain restyling on top of the grey-box builder, and room defs whose look
// follows the evening.
//
// The evening (WORLD-PLAN sections 2, 8, 11): once `round:done` is set during
// this visit (walking back through the sky door the first time), Ringwater is
// lit for evening for the rest of the session; a new visit is morning again,
// and a save that already had `round:done` when the visit began stays morning.
// Rooms are data, so their look is chosen when a room is built: `sessionRoom`
// makes a RoomDef whose backdrop, lighting and props are getters that ask
// `evening()` at that moment. The room state prop (state.ts) also sets the
// session flag `evening`, which anyone (the story lane) may read or set.

import { h } from "../../config.ts";
import type { Box } from "../_blockout/_build.ts";
import type { TerrainArt } from "../../room/terrain.ts";
import type { PropPlacement, RoomDef } from "../../room/types.ts";

const SAVE_KEY = "dex.world.v1";

/** What Ringwater's rooms know about this visit (updated by the room state props and the save). */
export const ringwater = {
  /** round:done as it stood when Ringwater first looked this visit (undefined: not yet looked). */
  doneAtStart: undefined as boolean | undefined,
  /** Seen round:done unset at some point this visit (a fresh save started mid-visit). */
  seenNotDone: false,
  /** The session flag `evening`, as last seen by a room state prop (the story lane may set it). */
  forced: false,
  /** The live save's flags, as last seen by a room state prop (in-memory saves included). */
  flags: {} as Record<string, boolean>,
};

let cached: { at: number; flags: Record<string, boolean> } | null = null;

function savedFlags(): Record<string, boolean> {
  // lighting and weather getters ask every frame: read the stored save at most 4 times a second
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (cached && now - cached.at < 250) return { ...cached.flags, ...ringwater.flags };
  let flags: Record<string, boolean> = {};
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const d = raw ? (JSON.parse(raw) as { flags?: Record<string, boolean> }) : null;
    flags = d?.flags ?? {};
  } catch {
    // private mode: only what the room state saw
  }
  cached = { at: now, flags };
  return { ...flags, ...ringwater.flags };
}

/** A save flag right now (the stored save, plus what the room state last saw). */
export function flag(key: string): boolean {
  return !!savedFlags()[key];
}

/** Is Ringwater in its evening this visit? */
export function evening(): boolean {
  if (ringwater.forced) return true;
  const done = flag("round:done");
  if (ringwater.doneAtStart === undefined) ringwater.doneAtStart = done;
  if (!done) ringwater.seenNotDone = true;
  return done && (!ringwater.doneAtStart || ringwater.seenNotDone);
}

/** Lit shrine numbers (1-6) in the save. */
export function litShrines(): number[] {
  const f = savedFlags();
  return [1, 2, 3, 4, 5, 6].filter((n) => f[`shrine:${n}`]);
}

/** Restyle the terrain pieces a Box added since `from`: art, ramp, reflection. */
export function restyle(b: Box, from: number, art: TerrainArt, o: { ramp?: string[]; reflect?: boolean; front?: boolean } = {}): void {
  for (let i = from; i < b.terrain.length; i++) {
    const t = b.terrain[i]!;
    t.art = art;
    if (o.ramp) t.ramp = o.ramp;
    if (o.reflect !== undefined) t.reflect = o.reflect;
    if (o.front !== undefined) t.front = o.front;
  }
}

/** Run `add` and restyle whatever terrain it added. */
export function styled(b: Box, art: TerrainArt, add: () => void, o: { ramp?: string[]; reflect?: boolean; front?: boolean } = {}): void {
  const n = b.terrain.length;
  add();
  restyle(b, n, art, o);
}

/** A pixel-matter placement at world coordinates (H), through the Box's coordinate transform. */
export function px(b: Box, recipe: string, id: string, wx: number, wy: number, params: Record<string, unknown> = {}, o: Partial<PropPlacement> = {}): void {
  b.prop(recipe, id, wx, wy, params, { engine: "pixel", ...o });
}

/** Room px of a height in H (re-exported for room files). */
export const hpx = h;

/**
 * A room whose look follows the evening: `morning` is the room; `eveningPatch`
 * gives what changes after the round (backdrop, lighting, weather, extra props,
 * props to drop). Getters are read when the room is built (and each frame for
 * lighting and weather), so the same def serves both.
 */
export function sessionRoom(morning: RoomDef, patch: () => { backdrop?: RoomDef["backdrop"]; lighting?: RoomDef["lighting"]; weather?: RoomDef["weather"]; add?: PropPlacement[]; drop?: string[] }): RoomDef {
  let cache: ReturnType<typeof patch> | null = null;
  const eve = (): ReturnType<typeof patch> | null => {
    if (!evening()) return null;
    return (cache ??= patch());
  };
  const def: RoomDef = { ...morning };
  Object.defineProperties(def, {
    backdrop: { enumerable: true, get: () => eve()?.backdrop ?? morning.backdrop },
    lighting: { enumerable: true, get: () => eve()?.lighting ?? morning.lighting },
    weather: { enumerable: true, get: () => eve()?.weather ?? morning.weather },
    props: {
      enumerable: true,
      get: () => {
        const e = eve();
        if (!e) return morning.props;
        const drop = new Set(e.drop ?? []);
        return [...morning.props.filter((p) => !drop.has(p.id)), ...(e.add ?? [])];
      },
    },
  });
  return def;
}
