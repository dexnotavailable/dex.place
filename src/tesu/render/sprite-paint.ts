// One frame of a painted sprite as RGBA pixels (round 7, performance). Shared by the sprite
// renderer (render/sprites.ts: on the page, for deterministic captures and when there are no
// workers) and the plate workers (plates/worker.ts: everywhere else), so a frame painted off the
// main thread is the same pixels as one painted on it.

import "../art/painters/index.ts";
import { ctxFor, painter } from "../art/painter.ts";
import { paletteRGBA } from "../art/palette.ts";
import { IdxBuf } from "../art/raster.ts";

export interface SpritePixels {
  /** RGBA, w x h; alpha 255 where painted, 0 elsewhere. */
  rgba: Uint8Array;
  w: number;
  h: number;
  /** The anchor's offset into the frame, px (where the def's 3D point lands). */
  ax: number;
  ay: number;
}

let pal: Uint8Array | null = null;

/** Paints frame f of a sprite kind with params p at a level (art px per level-1 plane px). */
export function paintSpriteFrame(kind: string, p: Record<string, unknown>, seed: number, f: number, level: number): SpritePixels {
  const pt = painter(kind);
  const [x0, y0, x1, y1] = pt.bounds({ ...p, frame: f });
  const ox = Math.floor(x0 * level), oy = Math.floor(y0 * level);
  const w = Math.max(1, Math.ceil(x1 * level) - ox), h = Math.max(1, Math.ceil(y1 * level) - oy);
  const buf = new IdxBuf(w, h, ox, oy, level);
  pt.paint(ctxFor(buf, level, 0, 0, seed), { ...p, frame: f });
  pal ??= paletteRGBA();
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const c = buf.px[i]!;
    if (!c) continue;
    rgba[i * 4] = pal[c * 4]!;
    rgba[i * 4 + 1] = pal[c * 4 + 1]!;
    rgba[i * 4 + 2] = pal[c * 4 + 2]!;
    rgba[i * 4 + 3] = 255;
  }
  return { rgba, w, h, ax: -ox, ay: -oy };
}
