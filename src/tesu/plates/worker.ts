// A plate painter thread: builds the same world as the page and paints tiles on request.
import { buildWorld } from "../world/index.ts";
import { PlateIndex, paintTile } from "./paint.ts";
import type { PlaneId } from "../world/types.ts";

let idx: PlateIndex | null = null;

self.onmessage = (e: MessageEvent<{ key: string; plane: PlaneId; level: number; tx: number; ty: number }>) => {
  const { key, plane, level, tx, ty } = e.data;
  const t0 = performance.now();
  if (!idx) idx = new PlateIndex(buildWorld());
  const px = paintTile(idx, plane, level, tx, ty);
  const ms = performance.now() - t0;
  if (px) (self as unknown as Worker).postMessage({ key, px: px.buffer, ms }, [px.buffer]);
  else (self as unknown as Worker).postMessage({ key, px: null, ms });
};
