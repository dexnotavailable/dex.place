// The build's bake (engine, perf 10-18): the plate tiles the opening needs, painted at build time by the same painters
// (plates/paint.ts) and shipped as compressed packs, so a visitor's browser fetches them instead of painting them
// (painting a tile costs ~30-100 ms of a core, the opening set is hundreds of them). Same code, same numbers: the
// pixels are the painters' own (src/tesu/tools/bake.mjs paints, a page check compares). The world description is
// baked too (built once at build time; the page and the workers load it instead of building it).
//
// Pure: Node (the bake) and the browser (the plate workers) share it.

import { Collision } from "../collide.ts";
import { TILE } from "../config.ts";
import { PLANE_IDS, type PlaneId, type WorldDef } from "../world/types.ts";
import { openingTiles, planeLevelTable } from "./span.ts";

/**
 * Frame sizes the opening set is baked for (the frame follows the window: 1080p at 1x, 1440p and 4K at 2x and 3x,
 * a laptop's 1366 x 768, a 2x laptop's 1440 x 800, a 21:9 at 2x, a phone held sideways). A size not here still gets
 * every baked tile it shares with these; the rest are painted, as before.
 */
export const BAKE_SIZES: readonly [number, number][] = [[1920, 1080], [1280, 720], [1366, 768], [1440, 800], [1720, 720], [1264, 584]];

/** The index of a bake: packs, and per tile key its pack, offset and length (deflate-raw of TILE x TILE indices). */
export interface BakeIndex {
  v: 1;
  tile: number;
  packs: string[];
  tiles: Record<string, [number, number, number]>;
}

/** What the page hands the plate workers: where the bake is (absent in dev: everything is painted). */
export interface BakeInfo {
  index: string | null;
  world: string | null;
  /** Paint each baked tile too and count differences (a check; never in normal use). */
  check?: boolean;
}

/** The tile keys the opening draws at the bake's frame sizes (and reduced motion at the first), with a ring around. */
export function bakeKeys(world: WorldDef): string[] {
  const collision = new Collision(world.walks, world.walls);
  collision.minX = 0;
  collision.maxX = world.w;
  const levels = planeLevelTable();
  const keys = new Set<string>();
  BAKE_SIZES.forEach(([w, h], i) => {
    for (const reduced of i === 0 ? [false, true] : [false]) {
      const { span } = openingTiles(world, collision, w, h, reduced, levels);
      for (const t of span.values()) {
        // the ring the store asks for ahead of the camera (game.ts planeQuads' prefetch)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keys.add(`${t.id}|${t.lv}|${t.tx + dx}|${t.ty + dy}`);
      }
    }
  });
  return [...keys].sort();
}

export function parseKey(k: string): { plane: PlaneId; level: number; tx: number; ty: number } {
  const [plane, lv, tx, ty] = k.split("|");
  if (!PLANE_IDS.includes(plane as PlaneId)) throw new Error(`bad tile key ${k}`);
  return { plane: plane as PlaneId, level: Number(lv), tx: Number(tx), ty: Number(ty) };
}

/**
 * The pack a tile goes in: one per plane, level and band of 8 tile columns (a camera asks for a plane's level in the
 * few columns it sees: the first scene fetches only its own bands).
 */
export function packOf(k: string): string {
  const { plane, level, tx } = parseKey(k);
  return `${plane}-${String(level).replace(".", "_")}-${Math.floor(tx / 8)}`;
}

/**
 * The world description as JSON that survives the trip exactly: Infinity, -Infinity, NaN and undefined fields are
 * kept (plain JSON would turn a wall's infinite depth into null).
 */
export function worldToJson(def: WorldDef): string {
  return JSON.stringify(def, function (this: Record<string, unknown>, k, v) {
    if (typeof v === "number" && !Number.isFinite(v)) return { $n: String(v) };
    if (k && v === undefined && Object.prototype.hasOwnProperty.call(this, k)) return { $u: 1 };
    return v;
  });
}

export function worldFromJson(text: string): WorldDef {
  const fix = (v: unknown): unknown => {
    if (!v || typeof v !== "object") return v;
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) v[i] = fix(v[i]);
      return v;
    }
    const o = v as Record<string, unknown>;
    const ks = Object.keys(o);
    if (ks.length === 1 && ks[0] === "$n") return Number(o.$n);
    if (ks.length === 1 && ks[0] === "$u") return undefined;
    for (const k of ks) o[k] = fix(o[k]);
    return o;
  };
  return fix(JSON.parse(text)) as WorldDef;
}

/** Inflates one baked tile (deflate-raw) in a browser or worker; null when the platform cannot. */
export async function inflateTile(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === "undefined") return null;
  const ds = new DecompressionStream("deflate-raw");
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(ds));
  const buf = new Uint8Array(await out.arrayBuffer());
  return buf.length === TILE * TILE ? buf : null;
}
