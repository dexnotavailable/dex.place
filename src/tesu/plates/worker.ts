// A plate painter thread: builds the same world as the page and paints tiles on request.
// (round 7, performance) It also paints sprite frames (render/sprite-paint.ts), which the page
// otherwise painted on its main thread, one frame of a big cloud stalling it 130-170 ms.
import { buildWorld } from "../world/index.ts";
import { PlateIndex, paintTile } from "./paint.ts";
import { paintSpriteFrame } from "../render/sprite-paint.ts";
import type { PlaneId } from "../world/types.ts";

let idx: PlateIndex | null = null;

interface TileMsg { key: string; plane: PlaneId; level: number; tx: number; ty: number }
interface WorldMsg { world: true }
interface SpriteMsg { sprite: true; key: string; kind: string; p: Record<string, unknown>; seed: number; frame: number; level: number }

self.onmessage = (e: MessageEvent<TileMsg | SpriteMsg | WorldMsg>) => {
  const m = e.data;
  if ("world" in m) {
    // (engine 10-18) the page asks for the world this worker builds anyway, so it never builds it on its own thread
    const t0 = performance.now();
    if (!idx) idx = new PlateIndex(buildWorld());
    (self as unknown as Worker).postMessage({ world: buildWorld(), ms: performance.now() - t0 });
    return;
  }
  if ("sprite" in m) {
    const t0 = performance.now();
    try {
      const s = paintSpriteFrame(m.kind, m.p, m.seed, m.frame, m.level);
      const ms = performance.now() - t0;
      (self as unknown as Worker).postMessage({ sprite: true, key: m.key, rgba: s.rgba.buffer, w: s.w, h: s.h, ax: s.ax, ay: s.ay, ms }, [s.rgba.buffer]);
    } catch (err) {
      (self as unknown as Worker).postMessage({ sprite: true, key: m.key, rgba: null, err: String(err), ms: performance.now() - t0 });
    }
    return;
  }
  const { key, plane, level, tx, ty } = m;
  const t0 = performance.now();
  if (!idx) idx = new PlateIndex(buildWorld());
  const px = paintTile(idx, plane, level, tx, ty);
  const ms = performance.now() - t0;
  if (px) (self as unknown as Worker).postMessage({ key, px: px.buffer, ms }, [px.buffer]);
  else (self as unknown as Worker).postMessage({ key, px: null, ms });
};
