// Grounding: what a placed thing stands on, shared by the room builder and the audit
// (src/world/tools/ground-audit.mjs). One source for "is this on the ground".
//
// Terrain in a room is a set of solid boxes and one-way tops, so the surface under x is the top of
// the highest box that contains the base. A placement's (x, y) is its base: the ground point under
// its centre (props-api.ts). Three things live here:
//
//   ANCHORS     which recipes are NOT meant to touch the ground (they hang, mount on walls, float,
//               span a gap, are a surface themselves, stand in water), each with the reason. The
//               audit skips them and says why; an unlisted recipe is treated as ground-standing.
//   offsetAt()  signed gap of a base above (+) or below (-) the surface under it.
//   settle()    the shared snap: a ground-standing placement that is a few px off the terrain under
//               it (authored by eye, then the terrain moved) is put on it. Small corrections only:
//               anything further off is a placement decision and stays for the room's lane.
//
// Grass, reeds and other living cover do not go through settle(): each blade roots on the ground
// under its own x (PropBuilder.groundRise, pixel/prop.ts), so a patch climbs steps and stops at
// edges. plantStand() is the ground they root in (terrain plus the water's surface).

import type { PropPlacement, RoomDef } from "./types.ts";
import { SCALE } from "../config.ts";

export type AnchorKind = "hang" | "wall" | "air" | "span" | "surface" | "water" | "onprop";

/** Recipes that are not meant to stand on terrain. Keys are normalised (lower case, letters and digits only). */
export const ANCHORS: Record<string, { kind: AnchorKind; why: string }> = {
  // hangs
  hanginglantern: { kind: "hang", why: "hangs from a bracket or rope" },
  hanginglamp: { kind: "hang", why: "hangs from the ceiling" },
  hangingbell: { kind: "hang", why: "hangs" },
  marketlantern: { kind: "hang", why: "strung over the street" },
  prayerflags: { kind: "hang", why: "strung between posts" },
  clothhanging: { kind: "hang", why: "hangs from a rail" },
  shawl: { kind: "hang", why: "hangs" },
  mapbanner: { kind: "hang", why: "hangs from a rail" },
  stormbanner: { kind: "hang", why: "hangs" },
  vines: { kind: "hang", why: "hang from a ledge" },
  cable: { kind: "hang", why: "strung" },
  hollowcable: { kind: "hang", why: "strung" },
  counterweight: { kind: "hang", why: "hangs on its cable" },
  censer: { kind: "hang", why: "swings on its chain" },
  // mounted on a wall or ceiling
  stainedglass: { kind: "wall", why: "set in a wall" },
  stormwindow: { kind: "wall", why: "set in a wall" },
  rosewindow: { kind: "wall", why: "set in a wall" },
  neonglyph: { kind: "wall", why: "mounted on a wall" },
  fluorescentstrip: { kind: "wall", why: "mounted on a ceiling" },
  warninglight: { kind: "wall", why: "mounted" },
  lampboard: { kind: "wall", why: "mounted on a wall" },
  artframe: { kind: "wall", why: "hangs on a wall" },
  artworkframe: { kind: "wall", why: "hangs on a wall" },
  productboard: { kind: "wall", why: "mounted on a wall" },
  ticketdisplay: { kind: "wall", why: "mounted on a wall" },
  donorplaque: { kind: "wall", why: "mounted on a wall at reading height" },
  junctionbox: { kind: "wall", why: "mounted on a column" },
  redpipe: { kind: "wall", why: "runs along a wall or walkway" },
  culvertgate: { kind: "wall", why: "a portcullis: drawn raised in its frame" },
  lodgeshelf: { kind: "wall", why: "shelving on a wall" },
  spirearrowsign: { kind: "wall", why: "mounted on a wall" },
  hollowbeacon: { kind: "wall", why: "mounted over the gate" },
  hollowradio: { kind: "wall", why: "sits on a shelf" },
  dustycup: { kind: "onprop", why: "sits on the porch sill" },
  // effects and abstract props
  moths: { kind: "air", why: "flies" },
  dust: { kind: "air", why: "drifts" },
  paper: { kind: "air", why: "drifts or lies on a surface" },
  hollowfootfalls: { kind: "air", why: "effect" },
  plainrumble: { kind: "air", why: "effect" },
  steamvent: { kind: "air", why: "effect" },
  arenaseals: { kind: "air", why: "floats around the arena by design" },
  spireportal: { kind: "air", why: "floats by design" },
  stormdirector: { kind: "air", why: "abstract controller" },
  spirestorm: { kind: "air", why: "abstract controller" },
  bladeedge: { kind: "air", why: "edge decal" },
  // spans and movers
  ribarch: { kind: "span", why: "spans" },
  ropebridge: { kind: "span", why: "spans two anchors" },
  jibcrane: { kind: "span", why: "mounted on a frame" },
  craneframe: { kind: "span", why: "anchors on the far side" },
  cranehook: { kind: "span", why: "hangs from the crane" },
  spirelift: { kind: "span", why: "a lift: it moves" },
  carrier: { kind: "span", why: "a ferry: it moves on water" },
  ferryboat: { kind: "span", why: "floats on water" },
  // things that are the surface
  gratingwalk: { kind: "surface", why: "a walkway: it is the surface" },
  gratingstair: { kind: "surface", why: "a stair: it is the surface" },
  spirestair: { kind: "surface", why: "a stair: it is the surface" },
  spiredeck: { kind: "surface", why: "a deck: it is the surface" },
  hollowliftcar: { kind: "surface", why: "a lift car: it is the surface" },
  // stands in water
  piling: { kind: "span", why: "pilings recede into the lake in perspective (test world arrival)" },
  mooring: { kind: "water", why: "posts run down past the pier into the water" },
  buoy: { kind: "water", why: "floats" },
};

export const normRecipe = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function anchorOf(recipe: string): { kind: AnchorKind; why: string } | null {
  return ANCHORS[normRecipe(recipe)] ?? null;
}

/** Ground cover: rooted blade by blade (pixel/prop.ts groundRise), not snapped as one piece. */
export const COVER = new Set(["grass", "reeds", "reedbed"]);

export interface Top {
  x0: number;
  x1: number;
  y: number;
  /** How deep the solid goes under its top (px); a base further below the top is not inside it. */
  inside: number;
  src: string;
}

/** The water surfaces of a room: its waterline (the whole width) and its wade zones. */
export function waterTops(def: Pick<RoomDef, "w" | "waterline" | "water">): Top[] {
  const out: Top[] = [];
  if (def.waterline !== undefined) out.push({ x0: 0, x1: def.w, y: def.waterline, inside: 2, src: "water" });
  for (const z of def.water ?? []) out.push({ x0: z.x0, x1: z.x1, y: z.y, inside: 2, src: "water" });
  return out;
}

/** The surfaces the terrain offers (and the water's surface: a base on it is standing in the lake). */
export function terrainTops(def: Pick<RoomDef, "terrain"> & Partial<Pick<RoomDef, "w" | "waterline" | "water">>): Top[] {
  const out: Top[] = [];
  for (const t of def.terrain) {
    if (t.oneWay) out.push({ x0: t.x, x1: t.x + t.w, y: t.y, inside: 2, src: "oneway" });
    else out.push({ x0: t.x, x1: t.x + t.w, y: t.y, inside: t.h, src: "terrain" });
  }
  if (def.w !== undefined) out.push(...waterTops(def as Pick<RoomDef, "w" | "waterline" | "water">));
  return out;
}

/** Signed offset of a base at (x, y) from the nearest surface: > 0 floats above it, < 0 is sunk into it, null nothing under. */
export function offsetAt(tops: Top[], x: number, y: number): { d: number; src: string } | null {
  let best: { d: number; src: string } | null = null;
  for (const t of tops) {
    if (x < t.x0 || x > t.x1) continue;
    const d = t.y - y;
    if (d < 0 && -d > t.inside) continue; // the base is below this whole solid
    if (best === null || Math.abs(d) < Math.abs(best.d)) best = { d, src: t.src };
  }
  return best;
}

/** The ground living cover roots in: terrain, and the surface of a room's shallow water. */
export function plantStand(def: Pick<RoomDef, "terrain" | "water" | "w" | "waterline">): (x: number, y: number) => boolean {
  const solids = def.terrain.filter((t) => !t.oneWay);
  const ones = def.terrain.filter((t) => t.oneWay);
  const water = def.water ?? [];
  const wl = def.waterline;
  return (x, y) =>
    (wl !== undefined && y >= wl) ||
    solids.some((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) ||
    ones.some((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + 2) ||
    water.some((q) => x >= q.x0 && x <= q.x1 && y >= q.y);
}

/** How far a placement may be moved onto the terrain under it (H): down onto it, and up out of it. */
export const SNAP = { down: 0.3, up: 0.15 };

export interface Moved {
  id: string;
  recipe: string;
  from: number;
  to: number;
}

/**
 * The room's placements with every ground-standing one that is a little off the terrain under it
 * put on it (see the header). Returns the same array when nothing moved.
 */
export function settle(def: Pick<RoomDef, "terrain" | "props"> & Partial<Pick<RoomDef, "w" | "waterline" | "water">>): { props: PropPlacement[]; moved: Moved[] } {
  const H = SCALE.H;
  const tops = terrainTops(def);
  const moved: Moved[] = [];
  const props = def.props.map((pl) => {
    const key = normRecipe(pl.recipe);
    if (ANCHORS[key] || COVER.has(key)) return pl;
    const at = offsetAt(tops, pl.x, pl.y);
    if (!at || at.src === "oneway" || at.src === "water") return pl;
    const d = at.d;
    if (d === 0 || Math.abs(d) <= 0.5) return pl;
    if (d > 0 ? d > H * SNAP.down : -d > H * SNAP.up) return pl;
    moved.push({ id: pl.id, recipe: pl.recipe, from: pl.y, to: pl.y + d });
    return { ...pl, y: pl.y + d };
  });
  return { props: moved.length ? props : def.props, moved };
}
