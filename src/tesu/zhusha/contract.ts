// Zhusha's sprite contract (lanes/anim/SPRITE-CONTRACT.md), the parts with no browser in them:
// what an anim.json must say, how long each drawing holds, and the 2x reduction from the traced
// 192 px figure to her 96 px play size. The loader (anims.ts) and the tests use these.
//
// Only traced pixel art ships: an anim.json whose stage is not "pixel", or that still carries a
// placeholder's background key, is refused here, so an illustrated placeholder or a raw render
// can never reach the public build through this folder.

export interface AnimFrame {
  file: string;
  ticks: number;
}

export interface AnimDef {
  id: string;
  stage: "pixel";
  frames: AnimFrame[];
  loop?: boolean;
  /** The pixel in the frame where her soles meet the ground, hips centred above it. */
  pivot: [number, number];
  /** Her height skull to sole in frame px (192 for every traced move). */
  figure_h: number;
  /** Frame indices where a hit lands. */
  hits?: number[];
  /** jump_arc: [apex, contact] as frame indices. */
  segments?: [number, number];
  source?: string;
  notes?: string;
}

export class AnimError extends Error {}

const FILE = /^f\d{3}\.png$/;

/** Checks an anim.json against the contract; throws AnimError naming every problem. */
export function validateAnim(json: unknown, slot: string): AnimDef {
  const bad: string[] = [];
  const o = json as Record<string, unknown>;
  if (!o || typeof o !== "object") throw new AnimError(`${slot}: anim.json is not an object`);
  if (o.id !== slot) bad.push(`id "${String(o.id)}" is not the folder's slot "${slot}"`);
  if (o.stage !== "pixel") bad.push(`stage "${String(o.stage)}": only traced pixel art ("pixel") ships`);
  if ("key" in o) bad.push(`has a background "key": placeholders never ship`);
  const frames = o.frames;
  if (!Array.isArray(frames) || frames.length === 0) bad.push("no frames");
  else {
    frames.forEach((f: unknown, i: number) => {
      const fr = f as Record<string, unknown>;
      if (!fr || typeof fr.file !== "string" || !FILE.test(fr.file)) bad.push(`frame ${i}: file must be fNNN.png`);
      if (!fr || typeof fr.ticks !== "number" || !Number.isInteger(fr.ticks) || fr.ticks < 1) bad.push(`frame ${i}: ticks must be a whole number >= 1`);
    });
  }
  const pv = o.pivot;
  if (!Array.isArray(pv) || pv.length !== 2 || !pv.every((v) => typeof v === "number" && Number.isFinite(v))) bad.push("pivot must be [x, y]");
  if (typeof o.figure_h !== "number" || !(o.figure_h > 0)) bad.push("figure_h must be a positive number");
  const n = Array.isArray(frames) ? frames.length : 0;
  if (o.hits !== undefined && (!Array.isArray(o.hits) || !o.hits.every((h) => Number.isInteger(h) && h >= 0 && h < n))) bad.push("hits must be frame indices");
  if (o.segments !== undefined && (!Array.isArray(o.segments) || o.segments.length !== 2 || !o.segments.every((h) => Number.isInteger(h) && h >= 0 && h < n))) bad.push("segments must be [apex, contact] frame indices");
  if (o.loop !== undefined && typeof o.loop !== "boolean") bad.push("loop must be true or false");
  if (bad.length) throw new AnimError(`${slot}: ${bad.join("; ")}`);
  return o as unknown as AnimDef;
}

/** Each drawing's first tick, and the clip's length in ticks. */
export function timeline(frames: readonly AnimFrame[]): { starts: number[]; total: number } {
  const starts: number[] = [];
  let t = 0;
  for (const f of frames) {
    starts.push(t);
    t += f.ticks;
  }
  return { starts, total: t };
}

/** The drawing showing at tick t (a loop wraps; otherwise it holds the first / last drawing). */
export function drawingIndex(starts: readonly number[], total: number, t: number, loop: boolean): number {
  if (!starts.length) return 0;
  const u = loop ? ((t % total) + total) % total : Math.min(Math.max(t, 0), total - 1e-6);
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid]! <= u) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * The move's own clock (ticks since it started) on the clip's clock, so the clip's first marked
 * hit drawing shows on the move's first hit tick: before it the clip is stretched or squeezed to
 * land there, after it the clip plays at its own speed.
 */
export function moveToClip(t: number, moveHitAt: number | null, clipHitAt: number | null): number {
  if (moveHitAt === null || clipHitAt === null || moveHitAt <= 0) return t;
  if (t <= moveHitAt) return (t / moveHitAt) * clipHitAt;
  return clipHitAt + (t - moveHitAt);
}

const luma = (d: Uint8ClampedArray | Uint8Array, i: number): number => 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;

/**
 * k x k reduction of pixel art (k = 2: the traced 192 px figure to her 96 px play size) with no new
 * colours: a block is opaque when at least half of it is, or when its one opaque pixel continues a
 * line into a neighbouring block (thin blades and diagonals stay unbroken, lone specks go); its colour
 * is one of its own pixels, the most common, with the silhouette's edge and darker line colours
 * weighted up so the outline survives. (ox, oy): where the k grid starts in the source.
 */
export function reducePixels(
  src: Uint8ClampedArray | Uint8Array, sw: number, sh: number, k: number, ox = 0, oy = 0,
): { data: Uint8ClampedArray<ArrayBuffer>; w: number; h: number } {
  const w = Math.ceil((sw + ox) / k), h = Math.ceil((sh + oy) / k);
  const out = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  const op = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < sw && y < sh && src[(y * sw + x) * 4 + 3]! >= 128;
  const cols: number[] = [], score: number[] = [];
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      const x0 = bx * k - ox, y0 = by * k - oy;
      cols.length = 0;
      score.length = 0;
      let count = 0, lumSum = 0, single = -1;
      for (let y = y0; y < y0 + k; y++) {
        for (let x = x0; x < x0 + k; x++) {
          if (!op(x, y)) continue;
          count++;
          const i = (y * sw + x) * 4;
          lumSum += luma(src, i);
          single = i;
        }
      }
      if (count === 0) continue;
      let keep = count * 2 >= k * k;
      if (!keep && count === 1) {
        // a lone pixel stays when it continues a line out of this block
        const sx = (single / 4) % sw, sy = Math.floor(single / 4 / sw);
        for (let dy = -1; dy <= 1 && !keep; dy++) {
          for (let dx = -1; dx <= 1 && !keep; dx++) {
            const nx = sx + dx, ny = sy + dy;
            if ((dx || dy) && (nx < x0 || nx >= x0 + k || ny < y0 || ny >= y0 + k) && op(nx, ny)) keep = true;
          }
        }
      }
      if (!keep) continue;
      const mean = lumSum / count;
      for (let y = y0; y < y0 + k; y++) {
        for (let x = x0; x < x0 + k; x++) {
          if (!op(x, y)) continue;
          const i = (y * sw + x) * 4;
          const c = (src[i]! << 16) | (src[i + 1]! << 8) | src[i + 2]!;
          const edge = !op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1);
          const dark = luma(src, i) < mean - 30;
          const s = 1 + (edge ? 1.5 : 0) + (dark ? 0.75 : 0);
          const j = cols.indexOf(c);
          if (j < 0) {
            cols.push(c);
            score.push(s);
          } else score[j]! += s;
        }
      }
      let best = 0;
      for (let j = 1; j < cols.length; j++) if (score[j]! > score[best]!) best = j;
      const c = cols[best]!, o = (by * w + bx) * 4;
      out[o] = (c >> 16) & 255;
      out[o + 1] = (c >> 8) & 255;
      out[o + 2] = c & 255;
      out[o + 3] = 255;
    }
  }
  return { data: out, w, h };
}

/** The opaque box of an RGBA frame (alpha >= 128), or null when it is empty. */
export function opaqueBox(d: Uint8ClampedArray | Uint8Array, w: number, h: number): [number, number, number, number] | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3]! < 128) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

/** Her head in a frame: the top of her silhouette near the pivot's column (frame px), for the hat's talisman. */
export function headOf(d: Uint8ClampedArray | Uint8Array, w: number, h: number, pivotX: number, figureH: number): [number, number] | null {
  const band = Math.round(figureH * 0.35);
  for (let y = 0; y < h; y++) {
    let sx = 0, n = 0;
    for (let x = Math.max(0, Math.round(pivotX - band)); x < Math.min(w, Math.round(pivotX + band)); x++) {
      if (d[(y * w + x) * 4 + 3]! >= 128) { sx += x; n++; }
    }
    if (n >= 2) return [sx / n, y];
  }
  return null;
}
