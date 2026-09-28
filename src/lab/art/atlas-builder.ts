// Packs trimmed albedo + normal images into one atlas pair (shelf packing,
// 2 px gutters so nearest sampling never bleeds between frames).

export interface PackedImage {
  key: string;
  w: number;
  h: number;
  albedo: Uint8ClampedArray;
  normal: Uint8ClampedArray;
}

export interface PackedAtlas {
  width: number;
  height: number;
  albedo: ImageData;
  normal: ImageData;
  rects: Map<string, [number, number, number, number]>;
}

/** Crops a w*h RGBA pair to the albedo's opaque bounds (plus pad). */
export function trim(
  w: number,
  h: number,
  albedo: Uint8ClampedArray,
  normal: Uint8ClampedArray,
  pad = 0,
): { x: number; y: number; w: number; h: number; albedo: Uint8ClampedArray; normal: Uint8ClampedArray } | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (albedo[(y * w + x) * 4 + 3]! < 128) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const a = new Uint8ClampedArray(cw * ch * 4);
  const n = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const src = ((y + y0) * w + x0) * 4;
    a.set(albedo.subarray(src, src + cw * 4), y * cw * 4);
    n.set(normal.subarray(src, src + cw * 4), y * cw * 4);
  }
  return { x: x0, y: y0, w: cw, h: ch, albedo: a, normal: n };
}

export function pack(images: PackedImage[], maxW = 2048): PackedAtlas {
  const gutter = 2;
  const order = images.map((_, i) => i).sort((a, b) => images[b]!.h - images[a]!.h || images[b]!.w - images[a]!.w);
  const rects = new Map<string, [number, number, number, number]>();
  let x = gutter, y = gutter, rowH = 0, width = 0;
  const pos: [number, number][] = new Array(images.length);
  for (const i of order) {
    const im = images[i]!;
    if (x + im.w + gutter > maxW) {
      x = gutter;
      y += rowH + gutter;
      rowH = 0;
    }
    pos[i] = [x, y];
    rects.set(im.key, [x, y, im.w, im.h]);
    x += im.w + gutter;
    rowH = Math.max(rowH, im.h);
    width = Math.max(width, x);
  }
  const height = y + rowH + gutter;
  const W = Math.max(4, width), H = Math.max(4, height);
  const albedo = new ImageData(W, H);
  const normal = new ImageData(W, H);
  images.forEach((im, i) => {
    const [px, py] = pos[i]!;
    for (let r = 0; r < im.h; r++) {
      albedo.data.set(im.albedo.subarray(r * im.w * 4, (r + 1) * im.w * 4), ((py + r) * W + px) * 4);
      normal.data.set(im.normal.subarray(r * im.w * 4, (r + 1) * im.w * 4), ((py + r) * W + px) * 4);
    }
  });
  return { width: W, height: H, albedo, normal, rects };
}
