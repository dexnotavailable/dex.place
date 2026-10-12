// Hand-lettered characters for the opening's signs: the public place names of the builder
// edition only (墨宮 Ink Palace, 山水 Shanshui, 月門 Yuemen, 天井 Tianjing, 白糸 Shiraito).
// Authored here as brush strokes on a 16 x 16 grid (no font, no generator), drawn at any size
// with a stroke width that follows the size, so they stay legible from a banner to the plaque.
// Gate plaques are not here: their glyphs are the world builder's data (GDK 9.5).

import type { PaintCtx } from "../../painter.ts";

type Stroke = number[];

/** Strokes per character: polylines [x, y, x, y, ...] on a 16 x 16 grid, y down. */
const G: Record<string, Stroke[]> = {
  山: [[8, 1.5, 8, 13.5], [3, 5.5, 3, 13.5], [13, 5.5, 13, 13.5], [3, 13.5, 13, 13.5]],
  水: [[8, 1, 8, 14.2, 6.6, 13.2], [2, 5, 6, 5, 2.2, 11.6], [12.8, 3.4, 9.2, 7.6], [9.2, 7.6, 14.2, 13.6]],
  月: [[4.2, 2, 4.2, 10.5, 2.6, 14.6], [4.2, 2, 12, 2, 12, 14.4, 10.4, 13.6], [4.2, 6, 12, 6], [4.2, 9.8, 12, 9.8]],
  門: [
    [2.2, 2, 2.2, 15.2], [2.2, 2, 6.6, 2, 6.6, 7.6, 2.2, 7.6], [2.2, 4.8, 6.6, 4.8],
    [13.8, 2, 13.8, 15, 12.4, 14.2], [9.4, 2, 13.8, 2], [9.4, 2, 9.4, 7.6, 13.8, 7.6], [9.4, 4.8, 13.8, 4.8],
  ],
  天: [[3.6, 2.4, 12.4, 2.4], [2, 7, 14, 7], [8, 2.4, 8, 7.2, 2.8, 14.4], [8.6, 8.2, 14, 14.2]],
  井: [[2, 5.2, 14, 5.2], [2, 10.2, 14, 10.2], [6, 1.4, 6, 10, 3, 15], [10.6, 1.4, 10.6, 15.2]],
  白: [[8.6, 0.6, 7.2, 2.8], [3.2, 3, 3.2, 15], [3.2, 3, 12.8, 3, 12.8, 15], [3.2, 8.9, 12.8, 8.9], [3.2, 15, 12.8, 15]],
  糸: [[9.6, 1, 5, 6, 10.2, 6.6], [11.6, 4, 4.4, 11.6, 13.2, 10.6], [8.6, 10.8, 8.6, 15.6], [5.2, 12.6, 3.4, 14.8], [11.6, 12.6, 13.2, 14.8]],
  墨: [
    [3, 1, 13, 1], [3, 1, 3, 5.4], [13, 1, 13, 5.4], [3, 5.4, 13, 5.4], [8, 1, 8, 8.2],
    [5, 2.2, 6.4, 4.2], [11, 2.2, 9.6, 4.2], [4, 7.4, 12, 7.4], [1.8, 9.4, 14.2, 9.4],
    [3.2, 10.4, 2.2, 11.8], [6.2, 10.4, 6.2, 11.8], [9.8, 10.4, 9.8, 11.8], [12.8, 10.4, 13.8, 11.8],
    [5, 13.1, 11, 13.1], [8, 12, 8, 15.4], [2.6, 15.4, 13.4, 15.4],
  ],
  宮: [
    [8, 0.4, 8, 2.2], [2.6, 4.8, 2.6, 2.6, 13.4, 2.6, 13.4, 4.8],
    [5, 5.4, 11, 5.4, 11, 8.8, 5, 8.8, 5, 5.4], [6.6, 8.8, 6.2, 10.4],
    [4, 10.4, 12, 10.4, 12, 15.2, 4, 15.2, 4, 10.4],
  ],
};

export function hasGlyph(ch: string): boolean {
  return ch in G;
}

/**
 * Draws one character with its top-left at (x, y) local px, `size` px square, in colour `col`.
 * The stroke width follows the size (at least one art px), so small banners stay readable.
 */
export function glyph(c: PaintCtx, ch: string, x: number, y: number, size: number, col: number, weight = 0.1): void {
  const strokes = G[ch];
  if (!strokes) return;
  const b = c.buf, d = c.d;
  const k = size / 16;
  const half = Math.max(0.5 / d, (size * weight) / 2);
  const X0 = Math.floor(c.X(x - half)), X1 = Math.ceil(c.X(x + size + half));
  const Y0 = Math.floor(c.Y(y - half)), Y1 = Math.ceil(c.Y(y + size + half));
  if (!b.touches(X0, Y0, X1, Y1)) return;
  const segs: number[] = [];
  for (const s of strokes) for (let i = 0; i + 3 < s.length; i += 2) segs.push(x + s[i]! * k, y + s[i + 1]! * k, x + s[i + 2]! * k, y + s[i + 3]! * k);
  for (let py = Math.max(Y0, b.oy); py < Math.min(Y1, b.y1); py++) {
    for (let px = Math.max(X0, b.ox); px < Math.min(X1, b.x1); px++) {
      const lx = c.lx(px + 0.5), ly = c.ly(py + 0.5);
      for (let i = 0; i < segs.length; i += 4) {
        const ax = segs[i]!, ay = segs[i + 1]!, bx = segs[i + 2]!, by = segs[i + 3]!;
        const vx = bx - ax, vy = by - ay;
        const t = Math.max(0, Math.min(1, ((lx - ax) * vx + (ly - ay) * vy) / Math.max(1e-6, vx * vx + vy * vy)));
        const dx = lx - (ax + vx * t), dy = ly - (ay + vy * t);
        if (dx * dx + dy * dy <= half * half) { b.set(px, py, col); break; }
      }
    }
  }
}

/** A column of characters from the top at (x, y): each `size` px with a gap between them. */
export function column(c: PaintCtx, text: string, cx: number, y: number, size: number, col: number, gap = 0.25, weight = 0.1): void {
  let yy = y;
  for (const ch of text) {
    glyph(c, ch, cx - size / 2, yy, size, col, weight);
    yy += size * (1 + gap);
  }
}

/** A row of characters from the left at (x, y). */
export function row(c: PaintCtx, text: string, x: number, y: number, size: number, col: number, gap = 0.3, weight = 0.1): void {
  let xx = x;
  for (const ch of text) {
    glyph(c, ch, xx, y, size, col, weight);
    xx += size * (1 + gap);
  }
}
