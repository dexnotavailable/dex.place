// The gallery collage layout, computed at build time (DOM-free, deterministic).
//
// Dex (2026-09-29): "arranged more close in a grid like a collage with
// adjustment for different aspect ratios". So: a justified collage. Pieces sit
// in rows that fill the full width, every piece in a row the same height and
// uncropped (its width follows its own aspect ratio), with a hairline gap.
//
// One reading order is shared by every width (it is the DOM order, which flex
// rows follow). The rows break differently per layout (wide, mid, narrow);
// each piece gets its share of its row's width per layout, written as CSS
// variables and picked with container queries, so there is no JS layout and
// no layout shift. Row breaks come from a small dynamic programme (closest to
// a target row height, a lone portrait on a wide row is penalised); the order
// is searched so every layout ends on full rows. New manifest items are
// placed automatically; nothing here is tuned per artwork.

import { rng } from "./render/html.ts";

export interface CollagePiece {
  readonly width: number;
  readonly height: number;
}

export type LayoutName = "wide" | "mid" | "narrow";

export interface LayoutSpec {
  /** Smallest container width (CSS px) this layout is used from. */
  readonly from: number;
  /** Target row height as a share of the container width. */
  readonly target: number;
}

/** Container breakpoints (gallery.css uses the same numbers) and row targets. */
export const LAYOUTS: Readonly<Record<LayoutName, LayoutSpec>> = {
  wide: { from: 1000, target: 0.25 },
  mid: { from: 600, target: 0.34 },
  narrow: { from: 0, target: 0.52 },
};

/** Gap between pieces, CSS px (gallery.css --gap). */
export const GAP = 3;
/** Frame edge on each side of an image, CSS px (gallery.css). */
export const EDGE = 2;

export interface Slot {
  /**
   * Share of the row's picture width (0..1): the row's width after its gaps
   * and every piece's frame edges. The shares of a row sum to 1, and since a
   * share follows the piece's aspect ratio, every picture in a row is exactly
   * one height (the frames are added on top, the same 2px for everyone).
   */
  readonly share: number;
  /** Gaps in the piece's row (pieces in the row, less one). */
  readonly gaps: number;
  /** Row index. */
  readonly row: number;
  /** Row height as a share of the container width (gaps ignored). */
  readonly height: number;
}

export interface Composition {
  /** Rows, each a list of positions in the reading order. */
  readonly rows: readonly (readonly number[])[];
  /** One slot per position in the reading order. */
  readonly slots: readonly Slot[];
}

const aspect = (p: CollagePiece): number => p.width / p.height;

/** Cost of one row whose aspects sum to `sum`, for a layout. */
function rowCost(sum: number, count: number, spec: LayoutSpec, portraitsOnly: boolean): number {
  const h = 1 / sum;
  const miss = Math.log(h / spec.target);
  let cost = miss * miss;
  // A row far taller than the target (a lone portrait) or a thin strip of many
  // small pieces reads badly: push those harder.
  if (h > spec.target * 1.7) cost += 2;
  if (portraitsOnly && count === 1 && spec.from > 0) cost += 3;
  return cost;
}

/** Best row breaks for pieces in a fixed order (minimum total cost). */
export function breakRows(aspects: readonly number[], spec: LayoutSpec): { rows: number[][]; cost: number } {
  const n = aspects.length;
  const best = new Array<number>(n + 1).fill(Infinity);
  const prev = new Array<number>(n + 1).fill(-1);
  best[0] = 0;
  for (let end = 1; end <= n; end += 1) {
    let sum = 0;
    let portraits = true;
    for (let start = end - 1; start >= 0 && end - start <= 6; start -= 1) {
      const a = aspects[start]!;
      sum += a;
      portraits &&= a < 1;
      const c = best[start]! + rowCost(sum, end - start, spec, portraits);
      if (c < best[end]!) {
        best[end] = c;
        prev[end] = start;
      }
    }
  }
  const rows: number[][] = [];
  for (let end = n; end > 0; end = prev[end]!) {
    const start = prev[end]!;
    rows.unshift(Array.from({ length: end - start }, (_, i) => start + i));
  }
  return { rows, cost: best[n]! };
}

function compose(aspects: readonly number[], spec: LayoutSpec): Composition & { cost: number } {
  const { rows, cost } = breakRows(aspects, spec);
  const slots: Slot[] = [];
  rows.forEach((row, r) => {
    const sum = row.reduce((s, i) => s + aspects[i]!, 0);
    for (const i of row) slots[i] = { share: aspects[i]! / sum, gaps: row.length - 1, row: r, height: 1 / sum };
  });
  return { rows, slots, cost };
}

/** Out-of-order pairs against the manifest order (a gentle tie-break). */
function inversions(order: readonly number[]): number {
  let n = 0;
  for (let i = 0; i < order.length; i += 1) for (let j = i + 1; j < order.length; j += 1) if (order[i]! > order[j]!) n += 1;
  return n;
}

function* permutations(list: number[], k = 0): Generator<number[]> {
  if (k >= list.length - 1) { yield list; return; }
  for (let i = k; i < list.length; i += 1) {
    [list[k], list[i]] = [list[i]!, list[k]!];
    yield* permutations(list, k + 1);
    [list[k], list[i]] = [list[i]!, list[k]!];
  }
}

export interface Collage {
  /** Reading order: manifest indexes, first piece always first (it leads). */
  readonly order: readonly number[];
  readonly layouts: Readonly<Record<LayoutName, Composition>>;
}

const NAMES = Object.keys(LAYOUTS) as LayoutName[];

/**
 * The collage for a list of pieces: the reading order that gives the best
 * rows across all three layouts, and the rows themselves. The first piece
 * stays first. Up to 9 pieces every order is tried; beyond that a seeded
 * random search, so the result is always the same for the same manifest.
 */
export function collage(pieces: readonly CollagePiece[]): Collage {
  const n = pieces.length;
  const all = pieces.map(aspect);
  const score = (order: readonly number[]): number => {
    const a = order.map((i) => all[i]!);
    return NAMES.reduce((s, name) => s + compose(a, LAYOUTS[name]).cost, 0) + inversions(order) * 0.002;
  };
  let best: number[] = pieces.map((_, i) => i);
  let bestScore = n ? score(best) : 0;
  const consider = (order: readonly number[]): void => {
    const s = score(order);
    if (s < bestScore - 1e-9) { bestScore = s; best = [...order]; }
  };
  if (n > 2 && n <= 9) {
    for (const rest of permutations(best.slice(1))) consider([0, ...rest]);
  } else if (n > 9) {
    const r = rng(`collage:${n}`);
    for (let t = 0; t < 4000; t += 1) {
      const rest = best.slice(1);
      const i = Math.floor(r() * rest.length);
      const j = Math.floor(r() * rest.length);
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
      consider([0, ...rest]);
    }
  }
  const aspects = best.map((i) => all[i]!);
  const layouts = Object.fromEntries(NAMES.map((name) => {
    const { rows, slots } = compose(aspects, LAYOUTS[name]);
    return [name, { rows, slots }];
  })) as Record<LayoutName, Composition>;
  return { order: best, layouts };
}

/**
 * CSS width of the image in a slot for a container `box` px wide: its share of
 * the row after the gaps and the frame edges of every piece in the row
 * (gallery.css .art width). Used for `sizes` and the phone caps.
 */
export function imageWidth(slot: Slot, box: number): number {
  return (box - slot.gaps * GAP - (slot.gaps + 1) * 2 * EDGE) * slot.share;
}

/** Fixed px taken out of a row before the shares apply: its gaps and frame edges. */
export const rowChrome = (slot: Slot): number => slot.gaps * GAP + (slot.gaps + 1) * 2 * EDGE;
