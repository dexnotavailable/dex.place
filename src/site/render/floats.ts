// The quiet background layer (DESIGN-SYSTEM.md §6).
//
// A few small pixel shapes per section, only in the gutters beside the
// reading column: hollow squares, dot clusters and one pixel glyph in a
// dimmed accent. They drift a few pixels in whole-pixel steps on long,
// unrelated periods, so the page feels alive without anything moving fast.
// Layout is generated from a seed, so it is stable between builds (no layout
// shift, no runtime randomness). floats.css hides the layer where the gutters
// are too narrow; motion/floats.ts adds a slight scroll parallax.
// Never rotated, never behind text, never Dex's art.

import type { IconName } from "../pixels.ts";
import type { Tone } from "../data/projects.ts";
import { icon } from "./glyphs.ts";
import { rng } from "./html.ts";

const PERIODS = [13.1, 17.3, 19.7, 23.9] as const;
const TONES = ["yellow", "magenta", "mint", "cyan"] as const;
const GLYPHS: readonly IconName[] = ["sparkle", "plus", "star", "cross"];

export interface FloatsOptions {
  /** Section accent; shapes lean toward it. */
  tone?: Tone;
  /** How many shapes (default 3, at most 4). */
  count?: number;
  /** Where the shapes start, as a fraction of the section height (0..1). */
  from?: number;
  /** How much of the section height they spread over (0..1, default the rest). */
  span?: number;
  /** A glyph to use for the one pixel icon, instead of a seeded pick. */
  glyph?: IconName;
}

type Side = "l" | "r";

const fmt = (n: number, digits = 2): string => String(Number(n.toFixed(digits)));

export function floats(seed: string, o: FloatsOptions = {}): string {
  const r = rng(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(r() * list.length)] as T;
  const from = o.from ?? 0;
  const span = o.span ?? 1 - from;
  const count = Math.max(0, Math.min(4, o.count ?? 3));
  let side: Side = r() < 0.5 ? "l" : "r";
  const tones: readonly string[] = o.tone && (TONES as readonly string[]).includes(o.tone) ? [o.tone, o.tone, ...TONES] : TONES;

  const items: string[] = [];
  for (let i = 0; i < count; i += 1) {
    side = side === "l" ? "r" : "l";
    // Spread evenly down the section, with a seeded wobble inside each band.
    const y = from + ((i + 0.2 + r() * 0.6) / count) * span;
    const kind = i === 0 ? "glyph" : pick(["box", "dots", "box"] as const);
    const tone = pick(tones);
    const size = kind === "glyph" ? 0 : kind === "dots" ? 20 : 8 * (2 + Math.floor(r() * 3));
    const inner = kind === "glyph" ? icon(o.glyph ?? pick(GLYPHS), 3) : "";
    const vars = [
      `--x:${fmt(0.2 + r() * 0.5)}`,
      `--y:${fmt(y * 100, 1)}%`,
      size ? `--s:${size}px` : "--s:33px",
      `--T:${pick(PERIODS)}s`,
      `--dy:${(r() < 0.5 ? -1 : 1) * 2 * (2 + Math.floor(r() * 3))}px`,
      `--delay:${fmt(-r() * 12, 1)}s`,
    ].join(";");
    items.push(`<span class="fl fl--${kind} fl-t-${tone}" data-side="${side}" style="${vars}">${inner}</span>`);
  }
  return `<div class="floats" aria-hidden="true" data-floats>${items.join("")}</div>`;
}
