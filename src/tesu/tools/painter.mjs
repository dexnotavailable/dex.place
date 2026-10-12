// Paints one painter on its own (art review): frames side by side.
//   node src/tesu/tools/painter.mjs <kind> '<params json>' <level> <out.png> [--frames 0,4,8] [--bg #rrggbb] [--scale n]
import "../art/painters/index.ts";
import { painter, ctxFor } from "../art/painter.ts";
import { IdxBuf } from "../art/raster.ts";
import { paletteRGBA } from "../art/palette.ts";
import { writePNG } from "./png.mjs";

const a = process.argv.slice(2);
const flag = (n, d) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : d; };
const [kind, pjson, levelS, out] = a;
const level = Number(levelS);
const p = JSON.parse(pjson);
const frames = flag("frames", "").split(",").filter(Boolean).map(Number);
const list = frames.length ? frames : [p.frame ?? 0];
const scale = Number(flag("scale", "1"));
const bg = parseInt(flag("bg", "#cfe0e8").slice(1), 16);
const pt = painter(kind);
const [x0, y0, x1, y1] = pt.bounds(p);
const ox = Math.floor(x0 * level), oy = Math.floor(y0 * level);
const w = Math.ceil(x1 * level) - ox, h = Math.ceil(y1 * level) - oy;
const pal = paletteRGBA();
const W = w * list.length * scale, Hh = h * scale;
const rgba = new Uint8Array(W * Hh * 4);
for (let i = 0; i < W * Hh; i++) { rgba[i * 4] = (bg >> 16) & 255; rgba[i * 4 + 1] = (bg >> 8) & 255; rgba[i * 4 + 2] = bg & 255; rgba[i * 4 + 3] = 255; }
const t0 = performance.now();
list.forEach((f, k) => {
  const buf = new IdxBuf(w, h, ox, oy, level);
  pt.paint(ctxFor(buf, level, 0, 0, 12345), { ...p, frame: f });
  for (let y = 0; y < Hh; y++) for (let x = 0; x < w * scale; x++) {
    const c = buf.px[Math.floor(y / scale) * w + Math.floor(x / scale)];
    if (!c) continue;
    const o = (y * W + k * w * scale + x) * 4;
    rgba[o] = pal[c * 4]; rgba[o + 1] = pal[c * 4 + 1]; rgba[o + 2] = pal[c * 4 + 2];
  }
});
writePNG(out, W, Hh, rgba);
console.log(`${kind} ${w}x${h} x${list.length} in ${(performance.now() - t0).toFixed(0)} ms -> ${out}`);
