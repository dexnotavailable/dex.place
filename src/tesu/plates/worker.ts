// A plate painter thread: builds the same world as the page and paints tiles on request.
// (round 7, performance) It also paints sprite frames (render/sprite-paint.ts), which the page
// otherwise painted on its main thread, one frame of a big cloud stalling it 130-170 ms.
// (engine, perf 10-18) With the build's bake (plates/bake.ts): a tile the bake painted is fetched from its pack and
// inflated instead of painted (the same bytes), and the world is loaded from the baked JSON instead of built; only
// what the bake did not cover is painted here, as before.
import { buildWorld } from "../world/index.ts";
import { PlateIndex, paintTile } from "./paint.ts";
import { paintSpriteFrame } from "../render/sprite-paint.ts";
import { inflateTile, worldFromJson, type BakeIndex, type BakeInfo } from "./bake.ts";
import type { PlaneId, WorldDef } from "../world/types.ts";

let idx: PlateIndex | null = null;
let bake: BakeInfo | null = null;
let bakeIndex: Promise<BakeIndex | null> | null = null;
let bakedWorld: Promise<WorldDef | null> | null = null;
const packs = new Map<number, Promise<Uint8Array | null>>();
const post = (m: unknown, t?: Transferable[]): void => (self as unknown as Worker).postMessage(m, t ?? []);

interface TileMsg { key: string; plane: PlaneId; level: number; tx: number; ty: number }
interface WorldMsg { world: true }
interface BakeMsg { bake: BakeInfo | null }
interface SpriteMsg { sprite: true; key: string; kind: string; p: Record<string, unknown>; seed: number; frame: number; level: number }

const fetchText = (url: string): Promise<string | null> => fetch(url).then((r) => (r.ok ? r.text() : null), () => null);

/** The plate index, from the baked world when there is one (no build here), else built. */
async function plateIndex(): Promise<PlateIndex> {
  if (idx) return idx;
  const def = bakedWorld ? await bakedWorld : null;
  if (!idx) idx = new PlateIndex(def ?? buildWorld());
  return idx;
}

/** A baked tile's indices; undefined when the bake did not paint it (or cannot be read here). */
async function bakedTile(key: string): Promise<Uint8Array | undefined> {
  const ix = bakeIndex ? await bakeIndex : null;
  const at = ix?.tiles[key];
  if (!ix || !at) return undefined;
  const [pi, off, len] = at;
  let pack = packs.get(pi);
  if (!pack) {
    const url = ix.packs[pi]!;
    pack = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? new Uint8Array(b) : null), () => null);
    packs.set(pi, pack);
  }
  const bytes = await pack;
  if (!bytes) return undefined;
  const px = await inflateTile(bytes.subarray(off, off + len));
  return px ?? undefined;
}

async function tile(m: TileMsg): Promise<void> {
  const { key, plane, level, tx, ty } = m;
  const t0 = performance.now();
  let px: Uint8Array | null | undefined;
  let chk = 0;
  try {
    px = await bakedTile(key);
    if (px && bake?.check) {
      const painted = paintTile(await plateIndex(), plane, level, tx, ty);
      chk = painted && painted.length === px.length && painted.every((v, i) => v === px![i]) ? 1 : -1;
    }
  } catch {
    px = undefined;
  }
  if (px === undefined) px = paintTile(await plateIndex(), plane, level, tx, ty);
  const ms = performance.now() - t0;
  if (px) post({ key, px: px.buffer, ms, chk }, [px.buffer]);
  else post({ key, px: null, ms, chk });
}

self.onmessage = (e: MessageEvent<TileMsg | SpriteMsg | WorldMsg | BakeMsg>) => {
  const m = e.data;
  if ("bake" in m) {
    bake = m.bake;
    bakeIndex = bake?.index ? fetchText(bake.index).then((t) => (t ? (JSON.parse(t) as BakeIndex) : null)) : null;
    bakedWorld = bake?.world ? fetchText(bake.world).then((t) => (t ? worldFromJson(t) : null)) : null;
    return;
  }
  if ("world" in m) {
    // (engine 10-18) the page asks for the world this worker builds anyway, so it never builds it on its own thread
    const t0 = performance.now();
    void plateIndex().then((ix) => post({ world: ix.world, ms: performance.now() - t0 }));
    return;
  }
  if ("sprite" in m) {
    const t0 = performance.now();
    try {
      const s = paintSpriteFrame(m.kind, m.p, m.seed, m.frame, m.level);
      const ms = performance.now() - t0;
      post({ sprite: true, key: m.key, rgba: s.rgba.buffer, w: s.w, h: s.h, ax: s.ax, ay: s.ay, ms }, [s.rgba.buffer]);
    } catch (err) {
      post({ sprite: true, key: m.key, rgba: null, err: String(err), ms: performance.now() - t0 });
    }
    return;
  }
  void tile(m);
};
