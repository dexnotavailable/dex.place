// Paints the website's sky clouds off the main thread: the world's own cloud painter (the opening's one cloud
// family, src/tesu/art/library/opening/sky.ts; "whatever exists" of the sky until the sky owner's tall sky art
// lands), into indexed buffers, turned into RGBA with the world's palette. Runs as a module worker
// (motion/sky.ts); each message paints one cloud and posts its pixels back.

import { IdxBuf } from "../../tesu/art/raster.ts";
import { ctxFor } from "../../tesu/art/painter.ts";
import { paletteRGBA } from "../../tesu/art/palette.ts";
import { cloud, type CloudP } from "../../tesu/art/library/opening/sky.ts";

export interface CloudJob {
  id: number;
  p: CloudP;
  seed: number;
}

export interface CloudDone {
  id: number;
  w: number;
  h: number;
  /** The anchor (the middle of its base) inside the picture, art px. */
  ax: number;
  ay: number;
  rgba: Uint8ClampedArray;
}

const pal = paletteRGBA();

export function paintCloud(job: CloudJob): CloudDone {
  const [x0, y0, x1, y1] = cloud.bounds(job.p);
  const w = Math.ceil(x1 - x0), h = Math.ceil(y1 - y0);
  const buf = new IdxBuf(w, h, 0, 0, 1);
  cloud.paint(ctxFor(buf, 1, -x0, -y0, job.seed), job.p);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < buf.px.length; i++) {
    const c = buf.px[i]!;
    if (!c) continue;
    rgba[i * 4] = pal[c * 4]!;
    rgba[i * 4 + 1] = pal[c * 4 + 1]!;
    rgba[i * 4 + 2] = pal[c * 4 + 2]!;
    rgba[i * 4 + 3] = pal[c * 4 + 3] ?? 255;
  }
  return { id: job.id, w, h, ax: -x0, ay: -y0, rgba };
}

// as a worker: one job in, one cloud out (a page that imports this file has a document and skips it)
if (typeof document === "undefined") {
  const scope = globalThis as unknown as { onmessage: ((e: MessageEvent<CloudJob>) => void) | null; postMessage(m: unknown, t: Transferable[]): void };
  scope.onmessage = (e) => {
    const done = paintCloud(e.data);
    scope.postMessage(done, [done.rgba.buffer]);
  };
}
