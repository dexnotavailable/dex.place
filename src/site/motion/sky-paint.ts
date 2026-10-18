// Paints pieces of the world for the website off the main thread: the world's own painters (src/tesu/art/library/
// opening: clouds, the floating isles, the far karst, the palace, a pine, the torii islet, a boat, egrets, reeds, the
// jetty), into indexed buffers turned into RGBA with the world's palette. Runs as a module worker (motion/windows.ts,
// motion/sky.ts); each message paints one piece and posts its pixels back.

import { IdxBuf } from "../../tesu/art/raster.ts";
import { ctxFor, painter } from "../../tesu/art/painter.ts";
import { paletteRGBA } from "../../tesu/art/palette.ts";
// (the modules that define the painters the website uses; importing them registers them)
import "../../tesu/art/library/opening/sky.ts";
import "../../tesu/art/library/opening/jetty.ts";
import "../../tesu/art/library/opening/haze.ts";
import "../../tesu/art/library/opening/palace.ts";
import "../../tesu/art/library/opening/flora.ts";
import "../../tesu/art/library/opening/islet.ts";
import "../../tesu/art/library/opening/props.ts";
import "../../tesu/art/library/opening/life.ts";
import "../../tesu/art/library/opening/wind.ts";

export interface CloudJob {
  id: number;
  /** The painter (default the cloud); "jetty" is kept for the jetty's own job. */
  kind?: string;
  p: Record<string, unknown>;
  seed: number;
  /** Density: art px per level-1 px of the piece (paints a big piece small, as the world's wide levels do). */
  d?: number;
  /** Or: paint it this many art px tall (its density chosen to fit). */
  fitH?: number;
}

export interface CloudDone {
  id: number;
  w: number;
  h: number;
  /** The anchor inside the picture, art px. */
  ax: number;
  ay: number;
  rgba: Uint8ClampedArray;
}

const pal = paletteRGBA();

export function paintCloud(job: CloudJob): CloudDone {
  const kind = job.kind === "jetty" ? "op.jetty" : job.kind ?? "op.cloud";
  const pt = painter(kind);
  const [x0, y0, x1, y1] = pt.bounds(job.p);
  const d = job.fitH ? job.fitH / Math.max(1, y1 - y0) : job.d ?? 1;
  const w = Math.max(1, Math.ceil((x1 - x0) * d)), h = Math.max(1, Math.ceil((y1 - y0) * d));
  const buf = new IdxBuf(w, h, 0, 0, d);
  pt.paint(ctxFor(buf, d, -x0, -y0, job.seed), job.p);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < buf.px.length; i++) {
    const c = buf.px[i]!;
    if (!c) continue;
    rgba[i * 4] = pal[c * 4]!;
    rgba[i * 4 + 1] = pal[c * 4 + 1]!;
    rgba[i * 4 + 2] = pal[c * 4 + 2]!;
    rgba[i * 4 + 3] = pal[c * 4 + 3] ?? 255;
  }
  return { id: job.id, w, h, ax: Math.round(-x0 * d), ay: Math.round(-y0 * d), rgba };
}

// as a worker: one job in, one piece out (a page that imports this file has a document and skips it)
if (typeof document === "undefined") {
  const scope = globalThis as unknown as { onmessage: ((e: MessageEvent<CloudJob>) => void) | null; postMessage(m: unknown, t: Transferable[]): void };
  scope.onmessage = (e) => {
    const done = paintCloud(e.data);
    scope.postMessage(done, [done.rgba.buffer]);
  };
}
