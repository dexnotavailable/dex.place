// Paints a region of one plane at one density and writes it as a PNG (art review, no browser).
//   node src/tesu/tools/plate.mjs <plane> <level> <x0> <y0> <w> <h> <out.png> [--bg #rrggbb] [--scale n]
// x0, y0, w, h in that level's art px. Use --h to give them in H of the play plane instead.
import { buildWorld } from "../world/index.ts";
import { PlateIndex, paintRegion } from "../plates/paint.ts";
import { paletteRGBA } from "../art/palette.ts";
import { PLANES } from "../world/types.ts";
import { writePNG } from "./png.mjs";

const a = process.argv.slice(2);
const flag = (n, d) => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : d; };
const [plane, levelS, x0s, y0s, ws, hs, out] = a;
const level = Number(levelS);
let [x0, y0, w, h] = [x0s, y0s, ws, hs].map(Number);
if (a.includes("--h")) {
  const r = PLANES[plane].rate;
  x0 = Math.round(x0 * 96 * r * level); y0 = Math.round(y0 * 96 * r * level);
  w = Math.round(w * 96 * r * level); h = Math.round(h * 96 * r * level);
}
const scale = Number(flag("scale", "1"));
const bg = flag("bg", "#dfe9ee");
const t0 = performance.now();
const world = buildWorld();
const idx = new PlateIndex(world);
const t1 = performance.now();
const buf = paintRegion(idx, plane, level, x0, y0, w, h);
const t2 = performance.now();
const pal = paletteRGBA();
const bgv = parseInt(bg.slice(1), 16);
const W = w * scale, H = h * scale;
const rgba = new Uint8Array(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = buf.px[Math.floor(y / scale) * w + Math.floor(x / scale)];
    const o = (y * W + x) * 4;
    if (c) { rgba[o] = pal[c * 4]; rgba[o + 1] = pal[c * 4 + 1]; rgba[o + 2] = pal[c * 4 + 2]; }
    else { rgba[o] = (bgv >> 16) & 255; rgba[o + 1] = (bgv >> 8) & 255; rgba[o + 2] = bgv & 255; }
    rgba[o + 3] = 255;
  }
}
writePNG(out, W, H, rgba);
console.log(`world ${(t1 - t0).toFixed(0)} ms, paint ${w}x${h} ${(t2 - t1).toFixed(0)} ms -> ${out}`);
