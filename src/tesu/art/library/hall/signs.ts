// The hall's signs, drawn as pixel art at the room's one art px (hall loop round 2, W1-2): no more
// pseudo-script. A sign either carries real characters drawn pixel by pixel (the ranks' numerals, the map's
// title) or is wordless and still says what it is: crossed blades for the Prize Court, an open register and
// a seal for the desk, a cash coin for the offering box, coin stacks for the sponsors.
//
// Coordinates: level-1 local px of the painter that calls these (a glyph's pixel is one local px).

import type { PaintCtx } from "../../painter.ts";
import { clamp, rect } from "./kit.ts";

type Col = (X: number, Y: number, lx: number, ly: number) => number;

/** 5 x 7 capitals and figures (1 px strokes). */
const FONT5: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
};

/** 6 x 9 bold figures (2 px strokes) for the top of a ranking. */
const FONT_BOLD: Record<string, string[]> = {
  "1": ["001100", "011100", "111100", "001100", "001100", "001100", "001100", "001100", "111111"],
  "2": ["011110", "110011", "000011", "000110", "001100", "011000", "110000", "110000", "111111"],
  "3": ["111110", "000011", "000011", "000011", "011110", "000011", "000011", "000011", "111110"],
};

/** Width of a string in a font (px, with 1 px between glyphs). */
export function textWidth(s: string, bold = false): number {
  const f = bold ? FONT_BOLD : FONT5;
  let w = 0;
  for (const ch of s) w += (f[ch]?.[0]?.length ?? 3) + 1;
  return Math.max(0, w - 1);
}

/** Draws a string with its top-left at (x, y); `shadow` adds a 1 px drop to the lower right. */
export function text(c: PaintCtx, x: number, y: number, s: string, col: Col, o: { bold?: boolean; shadow?: Col } = {}): void {
  const f = o.bold ? FONT_BOLD : FONT5;
  let cx = Math.round(x);
  const y0 = Math.round(y);
  for (const ch of s) {
    const g = f[ch];
    if (!g) { cx += 4; continue; }
    const gw = g[0]!.length;
    for (let j = 0; j < g.length; j++) for (let i = 0; i < gw; i++) {
      if (g[j]![i] !== "1") continue;
      if (o.shadow) {
        const below = g[j + 1]?.[i + 1] === "1", right = g[j]![i + 1] === "1";
        if (!below) rect(c, cx + i + 1, y0 + j + 1, cx + i + 2, y0 + j + 2, o.shadow);
        if (!right && !below) rect(c, cx + i + 1, y0 + j, cx + i + 2, y0 + j + 1, o.shadow);
      }
    }
    for (let j = 0; j < g.length; j++) for (let i = 0; i < gw; i++) {
      if (g[j]![i] === "1") rect(c, cx + i, y0 + j, cx + i + 1, y0 + j + 1, col);
    }
    cx += gw + 1;
  }
}

/** Crossed blades in a ring (the Prize Court's mark): ring radius r round (cx, cy). */
export function crossedBlades(c: PaintCtx, cx: number, cy: number, r: number, metal: Col, dark: Col, ground: Col): void {
  rect(c, cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (X, Y, lx, ly) => {
    const dx = lx - cx, dy = ly - cy, d = Math.hypot(dx, dy);
    if (d > r + 0.5) return 0;
    if (d > r - 2.2) return d > r - 0.8 ? dark(X, Y, lx, ly) : metal(X, Y, lx, ly);
    // two blades from the lower corners to the upper: each a 2 px line with a crossguard and a pommel
    for (const s of [-1, 1]) {
      // the blade runs from the hilt (lower, side s) up to its tip (upper, other side)
      const ax = s * r * 0.62, ay = r * 0.62, bx = -s * r * 0.66, by = -r * 0.66;
      const vx = bx - ax, vy = by - ay, L = Math.hypot(vx, vy);
      const t = ((dx - ax) * vx + (dy - ay) * vy) / (L * L);
      const off = Math.abs((dx - ax) * vy - (dy - ay) * vx) / L;
      if (t < -0.05 || t > 1) continue;
      // the crossguard: a short bar across the blade a fifth of the way up
      if (Math.abs(t - 0.22) < 0.045 && off < r * 0.24) return metal(X, Y, lx, ly);
      if (t < 0.22) {
        if (t < 0.02 && off < 1.8) return metal(X, Y, lx, ly); // the pommel
        if (off < 1.0) return dark(X, Y, lx, ly); // the grip
        continue;
      }
      const w = 1.25 * (1 - (t - 0.22) * 0.55);
      if (off < w) return metal(X, Y, lx, ly);
    }
    return ground(X, Y, lx, ly);
  });
}

/** A ruyi cloud scroll (a curl with a tail) for a sign's ends: centre (cx, cy), radius r, curling toward dir. */
export function cloudScroll(c: PaintCtx, cx: number, cy: number, r: number, dir: 1 | -1, tail: number, col: Col): void {
  rect(c, Math.min(cx - r - 1, cx + dir * tail), cy - r - 1, Math.max(cx + r + 1, cx + dir * tail), cy + r + 1, (X, Y, lx, ly) => {
    const dx = (lx - cx) * dir, dy = ly - cy;
    const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    // an Archimedean curl of 1.4 turns
    for (let k = 0; k < 2; k++) {
      const rr = (r * ((a + Math.PI) / (2 * Math.PI) + k)) / 1.4;
      if (rr <= r && Math.abs(d - rr) < 0.75) return col(X, Y, lx, ly);
    }
    // the tail: a line running off from the curl's bottom, thinning
    if (dx > 0 && dx < tail && Math.abs(dy - r + 0.5 + (dx / tail) * 1.5) < 0.75 * (1 - dx / tail * 0.5)) return col(X, Y, lx, ly);
    return 0;
  });
}

/** An open register (a book lying open, pages bowed) with a brush laid across it: about w px wide. */
export function openBook(c: PaintCtx, x: number, y: number, w: number, page: Col, edge: Col, brush: Col): void {
  const h = w * 0.55;
  const mid = x + w / 2;
  rect(c, x - 1, y - 1, x + w + 1, y + h + 1, (X, Y, lx, ly) => {
    const u = (lx - x) / w, v = (ly - y) / h;
    const bow = Math.abs(u - 0.5) * 2; // 0 at the spine, 1 at the edges
    const top = 0.12 + bow * bow * -0.1 + (1 - bow) * 0.12;
    const bot = 0.92 - (1 - bow) * 0.08;
    if (u < 0 || u > 1 || v < top || v > bot) return 0;
    if (Math.abs(lx - mid) < 0.6) return edge(X, Y, lx, ly);
    if (v < top + 0.08 || v > bot - 0.1 || u < 0.04 || u > 0.96) return edge(X, Y, lx, ly);
    // ruled lines on each page
    const line = Math.abs(((v - top) * h) % 3 - 1.5) < 0.5 && Math.abs(u - 0.5) > 0.08 && Math.abs(u - 0.5) < 0.42 && v > top + 0.2 && v < bot - 0.18;
    return line ? edge(X, Y, lx, ly) : page(X, Y, lx, ly);
  });
  // the brush, laid across the right page
  const bx0 = mid + w * 0.08, by0 = y + h * 0.95, bx1 = x + w * 0.98, by1 = y + h * 0.1;
  const n = Math.ceil(Math.hypot(bx1 - bx0, by1 - by0));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const px = bx0 + (bx1 - bx0) * t, py = by0 + (by1 - by0) * t;
    rect(c, px, py, px + 1, py + 1, t < 0.22 ? edge : brush);
  }
}

/** A seal's impression: a red square with a white border and a simple mark inside (Hanko's seal). */
export function sealStamp(c: PaintCtx, x: number, y: number, s: number, red: Col, white: Col): void {
  rect(c, x, y, x + s, y + s, (X, Y, lx, ly) => {
    const u = (lx - x) / s, v = (ly - y) / s;
    const e = Math.min(u, 1 - u, v, 1 - v) * s;
    if (e < 1.2) return red(X, Y, lx, ly);
    if (e < 2.2) return white(X, Y, lx, ly);
    // the mark: a frame in the frame and a cross bar, white on red (a seal's carved lines)
    const m = Math.min(u, 1 - u, v, 1 - v) * s;
    const inner = Math.abs(m - s * 0.3) < 0.6 || (Math.abs(v - 0.5) < 0.06 && u > 0.3 && u < 0.7) || (Math.abs(u - 0.5) < 0.06 && v > 0.3 && v < 0.7);
    return inner ? white(X, Y, lx, ly) : red(X, Y, lx, ly);
  });
}

/** A cash coin (round, a square hole): centre (cx, cy), radius r. */
export function cashCoin(c: PaintCtx, cx: number, cy: number, r: number, metal: Col, dark: Col, light?: Col): void {
  rect(c, cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (X, Y, lx, ly) => {
    const dx = lx - cx, dy = ly - cy, d = Math.hypot(dx, dy);
    if (d > r) return 0;
    const hole = Math.max(Math.abs(dx), Math.abs(dy)) < r * 0.3;
    if (hole) return 0;
    const rim = d > r - 1.2 || Math.max(Math.abs(dx), Math.abs(dy)) < r * 0.3 + 1.1;
    if (rim) return dark(X, Y, lx, ly);
    if (light && dx + dy < -r * 0.5) return light(X, Y, lx, ly);
    return metal(X, Y, lx, ly);
  });
}

/**
 * The hall's crest: a plum blossom (five round petals round a gold heart, the notch of each petal cut in) in a
 * ring, radius r round (cx, cy). Wordless; the Hall of Works' mark on its door plaque and the register's counter.
 */
export function plumCrest(c: PaintCtx, cx: number, cy: number, r: number, metal: Col, dark: Col, light?: Col, ring = true): void {
  rect(c, cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (X, Y, lx, ly) => {
    const dx = lx - cx, dy = ly - cy, d = Math.hypot(dx, dy);
    if (d > r + 0.5) return 0;
    if (ring && d > r - 1.3) return metal(X, Y, lx, ly);
    if (ring && d > r - 2.3) return 0;
    const pr = (ring ? r - 2.3 : r) * 0.36, pc = (ring ? r - 2.3 : r) * 0.6;
    if (d < pr * 0.62) return d < pr * 0.3 ? dark(X, Y, lx, ly) : metal(X, Y, lx, ly);
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
      const px = cx + Math.cos(a) * pc, py = cy + Math.sin(a) * pc;
      const e = Math.hypot(lx - px, ly - py);
      if (e > pr) continue;
      // the notch at the petal's tip, and its outer edge a step darker so the five read apart
      const tip = Math.hypot(lx - (cx + Math.cos(a) * (pc + pr)), ly - (cy + Math.sin(a) * (pc + pr)));
      if (tip < pr * 0.32) return 0;
      if (e > pr - 1) return dark(X, Y, lx, ly);
      return light && (lx - px) + (ly - py) < -pr * 0.4 ? light(X, Y, lx, ly) : metal(X, Y, lx, ly);
    }
    return 0;
  });
}

/** A stack of n coins seen side-on (each 2 px thick), its foot at (x, y), w px wide. */
export function coinStack(c: PaintCtx, x: number, y: number, w: number, n: number, metal: Col, dark: Col, light: Col): void {
  for (let i = 0; i < n; i++) {
    const off = Math.round(Math.sin(i * 2.3) * 0.8);
    const y1 = y - i * 2, y0 = y1 - 2;
    rect(c, x + off, y0, x + off + w, y1, (X, Y, lx, ly) => {
      if (ly < y0 + 1) return clamp(lx - x - off, 0, w) < w * 0.35 ? light(X, Y, lx, ly) : metal(X, Y, lx, ly);
      return dark(X, Y, lx, ly);
    });
  }
}

/** A prize cup: a bowl with two handles on a stem and a foot, about 2s px tall, its foot's middle at (cx, y). */
export function trophy(c: PaintCtx, cx: number, y: number, s: number, metal: Col, dark: Col, light: Col): void {
  const top = y - 2 * s;
  rect(c, cx - s * 1.3, top - 1, cx + s * 1.3, y + 1, (X, Y, lx, ly) => {
    const dx = lx - cx, v = (ly - top) / (2 * s);
    // the foot and the stem
    if (v > 0.86) return Math.abs(dx) < s * 0.55 ? (v > 0.95 ? dark(X, Y, lx, ly) : metal(X, Y, lx, ly)) : 0;
    if (v > 0.62) return Math.abs(dx) < s * (0.12 + (v > 0.8 ? 0.12 : 0)) ? metal(X, Y, lx, ly) : 0;
    // the bowl: wide at the rim, rounding in to the stem; lit on its left
    const bw = s * (0.82 - 0.55 * Math.pow(Math.max(0, v - 0.08) / 0.54, 1.6));
    if (v >= 0 && v <= 0.62 && Math.abs(dx) < bw) {
      if (v < 0.07) return light(X, Y, lx, ly);
      return dx < -bw * 0.35 ? light(X, Y, lx, ly) : dx > bw * 0.55 ? dark(X, Y, lx, ly) : metal(X, Y, lx, ly);
    }
    // the handles: rings off each side of the bowl
    const hx = Math.abs(dx) - s * 0.95, hy = (v - 0.25) * 2 * s;
    if (Math.abs(Math.hypot(hx, hy) - s * 0.24) < 0.8 && Math.abs(dx) > s * 0.8) return metal(X, Y, lx, ly);
    return 0;
  });
}

/** An award rosette with two ribbon tails, pinned at (cx, cy): radius r. */
export function rosette(c: PaintCtx, cx: number, cy: number, r: number, red: Col, gold: Col, dark: Col): void {
  // the tails first (behind the rosette): two ribbons falling apart, their ends cut in a V
  for (const s of [-1, 1]) {
    const x0 = cx + s * r * 0.35, len = r * 2.1;
    rect(c, Math.min(x0, x0 + s * r * 0.8) - 3, cy, Math.max(x0, x0 + s * r * 0.8) + 3, cy + len + 1, (X, Y, lx, ly) => {
      const t = (ly - cy) / len;
      const mx = x0 + s * r * 0.8 * t;
      const half = 2.2;
      if (Math.abs(lx - mx) > half) return 0;
      if (t > 0.86 && (ly - cy) > len - (half - Math.abs(lx - mx)) * 1.2) return 0;
      return Math.abs(lx - mx) > half - 0.9 ? dark(X, Y, lx, ly) : red(X, Y, lx, ly);
    });
  }
  rect(c, cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (X, Y, lx, ly) => {
    const dx = lx - cx, dy = ly - cy, d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const edge = r * (0.86 + 0.14 * Math.abs(Math.cos(a * 6)));
    if (d > edge) return 0;
    if (d < r * 0.42) return d < r * 0.28 ? gold(X, Y, lx, ly) : dark(X, Y, lx, ly);
    const pleat = Math.cos(a * 12) > 0.6;
    return pleat ? dark(X, Y, lx, ly) : red(X, Y, lx, ly);
  });
}
