// The gallery collage layout, computed at build time (DOM-free, deterministic).
//
// Pieces are packed into the lowest open gap first (masonry with flexible
// widths: a piece stretches or shrinks within its range to fill a gap, so no
// cropping and few holes). A seeded pass then shrinks some pieces a little,
// nudges them inside their slot and tilts them, so the grid reads as a
// pinned-up collage. Units
// are container widths (1 unit = 1cqw), so one layout scales to any width with
// no layout shift and no JavaScript.
//
// Three compositions are emitted per piece (wide, mid, narrow); CSS picks one
// with a container query. New pieces in content/gallery/manifest.json are
// placed automatically; nothing here is tuned per artwork.

import { rng } from "./render/html.ts";

export interface CollagePiece {
  readonly width: number;
  readonly height: number;
}

export interface Box {
  /** Left edge, units (0..100). */
  readonly x: number;
  /** Top edge, units. */
  readonly y: number;
  /** Frame width, units. */
  readonly w: number;
  /** Frame height, units (image plus mat). */
  readonly h: number;
  /** Degrees. */
  readonly tilt: number;
  /** Stacking order, 1..3: smaller pieces sit above bigger ones. */
  readonly z: number;
}

export interface Composition {
  /** One box per piece, in manifest order. */
  readonly boxes: readonly Box[];
  /** Total height, units. */
  readonly height: number;
}

export interface CompositionOptions {
  /** Slot widths for landscape pieces, units: preferred, and how far a slot may stretch or shrink to fill a gap. */
  readonly land: { readonly pref: number; readonly min: number; readonly max: number };
  /** Slot widths for portrait pieces, units. */
  readonly port: { readonly pref: number; readonly min: number; readonly max: number };
  /** Slot width of the first piece, which leads the collage. */
  readonly feature?: number;
  /** Space between pieces and rows, units. */
  readonly gap: number;
  /** Mat (frame padding + border) on each side, units. */
  readonly mat: number;
  /** Pieces shrink to between this share and 1 of their slot. */
  readonly shrink: number;
  /** Largest vertical nudge, units. */
  readonly jitter: number;
  /** Largest tilt, degrees. */
  readonly tilt: number;
  /** Shape order after the lead piece, e.g. ["P", "L"]; falls back when one runs out. */
  readonly pattern: readonly ("L" | "P")[];
  readonly seed: string;
}

export const WIDTH = 100;

const round = (n: number): number => Math.round(n * 100) / 100;
const isPortrait = (p: CollagePiece): boolean => p.height > p.width;

/**
 * Collage order: the first piece leads, then landscapes (L) and portraits (P)
 * follow the pattern, each keeping manifest order, so shapes mix.
 */
export function packOrder(pieces: readonly CollagePiece[], pattern: readonly ("L" | "P")[]): number[] {
  const queues = { L: [] as number[], P: [] as number[] };
  pieces.forEach((p, i) => { if (i > 0) queues[isPortrait(p) ? "P" : "L"].push(i); });
  const order = pieces.length ? [0] : [];
  for (let k = 0; order.length < pieces.length; k += 1) {
    const want = pattern[k % pattern.length] ?? "L";
    const other = want === "L" ? "P" : "L";
    const next = queues[want].shift() ?? queues[other].shift();
    if (next !== undefined) order.push(next);
  }
  return order;
}

interface Slot { x: number; y: number; w: number; h: number }

/**
 * Lowest-gap packing for one order: each piece goes into the lowest open gap,
 * stretching or shrinking within its range so gaps close. Returns slots in
 * manifest order plus a score (lower is better: few holes, a flat bottom,
 * pieces near their preferred size).
 */
function pack(pieces: readonly CollagePiece[], order: readonly number[], prefScale: readonly number[], o: CompositionOptions): { slots: Slot[]; score: number } {
  // Pack on a grid WIDTH + gap wide; every slot includes the gap on its right,
  // so the last right edge lands exactly on WIDTH.
  const g = Math.round(o.gap);
  const span = WIDTH + g;
  const sky = new Array<number>(span).fill(0);
  const size = (i: number) => {
    const s = isPortrait(pieces[i]!) ? o.port : o.land;
    const pref = (i === 0 && o.feature ? o.feature : s.pref * prefScale[i]!);
    return { pref: Math.round(pref) + g, min: s.min + g, max: Math.round(Math.max(s.max, pref)) + g, base: i === 0 && o.feature ? o.feature : s.pref };
  };
  const minAny = Math.min(o.port.min, o.land.min) + g;
  const slots = new Array<Slot>(pieces.length);
  const queue = [...order];
  let small = 0;
  let used = 0;
  // Area of gaps too narrow for any remaining piece, raised to a neighbour:
  // these are the visible holes inside the collage.
  let holes = 0;

  while (queue.length) {
    // The lowest gap: leftmost run of columns at the lowest height.
    let y = Infinity;
    for (const v of sky) y = Math.min(y, v);
    const s = sky.indexOf(y);
    let e = s;
    while (e < span && sky[e] === y) e += 1;
    const gapWidth = e - s;

    const at = queue.findIndex((i) => size(i).min <= gapWidth);
    if (at < 0) {
      // Too narrow for anything: raise it to its lower neighbour and retry.
      const to = Math.min(s > 0 ? sky[s - 1]! : Infinity, e < span ? sky[e]! : Infinity);
      const raised = to === Infinity ? y + 1 : to;
      holes += (e - s) * (raised - y);
      for (let c = s; c < e; c += 1) sky[c] = raised;
      continue;
    }
    const index = queue.splice(at, 1)[0]!;
    const sz = size(index);
    let w = Math.min(sz.pref, gapWidth);
    if (gapWidth - w < minAny) w = gapWidth <= sz.max ? gapWidth : Math.max(sz.min, gapWidth - minAny);
    const visible = w - g;
    const h = (visible - 2 * o.mat) * (pieces[index]!.height / pieces[index]!.width) + 2 * o.mat;
    for (let c = s; c < s + w; c += 1) sky[c] = y + h + o.gap;
    slots[index] = { x: s, y, w: visible, h };
    small += Math.max(0, (0.88 * sz.base - visible) / sz.base);
    used += w * (h + o.gap);
  }
  const top = Math.max(...sky);
  const waste = 1 - used / (span * top);
  const ragged = (top - Math.min(...sky)) / top;
  // Stacks of same-width pieces read as a table, not a collage.
  let stacked = 0;
  for (let a = 0; a < slots.length; a += 1) {
    for (let b = a + 1; b < slots.length; b += 1) {
      const p = slots[a]!;
      const q = slots[b]!;
      if (Math.abs(p.x - q.x) < 3 && Math.abs(p.w - q.w) < 4) stacked += 1;
    }
  }
  const holed = holes / (span * top);
  return { slots, score: waste * 6 + holed * 14 + ragged * 2 + small + stacked * 0.12 };
}

/** Tries seeded orders and sizes, keeps the best packing, then loosens it into a collage. */
export function compose(pieces: readonly CollagePiece[], o: CompositionOptions, trials = 1500): Composition {
  if (!pieces.length) return { boxes: [], height: 0 };
  const search = rng(`${o.seed}:search`);
  const base = packOrder(pieces, o.pattern);
  let best = pack(pieces, base, pieces.map(() => 1), o);
  for (let t = 0; t < trials; t += 1) {
    const order = [...base];
    for (let i = order.length - 1; i > 1; i -= 1) {
      const j = 1 + Math.floor(search() * i);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const scale = pieces.map(() => 0.85 + search() * 0.3);
    const next = pack(pieces, order, scale, o);
    if (next.score < best.score) best = next;
  }
  const placed = best.slots;

  const rand = rng(o.seed);
  const areas = placed.map((p) => p.w * p.h);
  const sorted = [...areas].sort((p, q) => q - p);
  const boxes = placed.map((p, i) => {
    const lead = i === 0;
    const scale = lead ? 1 : o.shrink + rand() * (1 - o.shrink);
    const w = p.w * scale;
    const h = (w - 2 * o.mat) * (p.h - 2 * o.mat) / (p.w - 2 * o.mat) + 2 * o.mat;
    const x = p.x + (p.w - w) * rand();
    const y = p.y + (p.h - h) * rand() + (rand() * 2 - 1) * o.jitter;
    const sign = i % 2 === 0 ? -1 : 1;
    const tilt = lead ? -0.6 : sign * (0.3 + rand() * 0.7) * o.tilt;
    const z = 1 + Math.round((sorted.indexOf(areas[i]!) / Math.max(1, placed.length - 1)) * 2);
    return { x: round(x), y: round(Math.max(0, y)), w: round(w), h: round(h), tilt: round(tilt), z };
  });
  const height = round(Math.max(0, ...boxes.map((b) => b.y + b.h)) + o.jitter + 1);
  return { boxes, height };
}

export type LayoutName = "wide" | "mid" | "narrow";

/** The three compositions the site uses (tuned by eye; see gallery.css). */
export const LAYOUTS: Readonly<Record<LayoutName, Omit<CompositionOptions, "seed">>> = {
  // >= 1000px: a big lead piece, landscapes about a third, portraits a fifth.
  wide: {
    feature: 50, land: { pref: 36, min: 26, max: 50 }, port: { pref: 21, min: 16, max: 28 },
    gap: 2.6, mat: 1, shrink: 0.9, jitter: 1.2, tilt: 2, pattern: ["P", "L", "L", "P"],
  },
  // 600-999px: fewer, larger pieces across.
  mid: {
    feature: 64, land: { pref: 54, min: 40, max: 64 }, port: { pref: 32, min: 26, max: 38 },
    gap: 3.2, mat: 1.5, shrink: 0.9, jitter: 1.6, tilt: 2, pattern: ["P", "L", "P", "L"],
  },
  // < 600px: landscapes nearly full width, portraits in pairs.
  narrow: {
    feature: 100, land: { pref: 100, min: 70, max: 100 }, port: { pref: 50, min: 42, max: 58 },
    gap: 4.6, mat: 2.6, shrink: 0.92, jitter: 1.4, tilt: 2.2, pattern: ["P", "P", "L"],
  },
};

export function collageLayouts(pieces: readonly CollagePiece[]): Record<LayoutName, Composition> {
  return {
    wide: compose(pieces, { ...LAYOUTS.wide, seed: "gallery-wide" }),
    mid: compose(pieces, { ...LAYOUTS.mid, seed: "gallery-mid" }),
    narrow: compose(pieces, { ...LAYOUTS.narrow, seed: "gallery-narrow" }),
  };
}
