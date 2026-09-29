// Floating layered background (DESIGN-SYSTEM.md §6).
//
// Three depths, placed only in the gutters beside the reading column:
//   far   2 pale tint blocks, large, hanging off the page edge
//   mid   up to 3 ink-outlined blocks, crosshairs, dot grids, strip fragments
//   near  up to 3 pixel stickers and mascots
// Layout is generated from a seed, so it is stable between builds (no layout
// shift, no runtime randomness). CSS (floats.css) drifts each shape on its own
// co-prime period; motion/floats.ts adds scroll and cursor parallax per depth.
// The pointer-arrow glyph is never a sticker: in a gutter it reads as a stuck
// second mouse cursor.

import { ICONS, validateIcon, type IconName } from "../pixels.ts";
import type { Tone } from "../data/projects.ts";
import { icon } from "./glyphs.ts";
import { rng } from "./html.ts";

const PERIODS = [5.3, 7.1, 9.7, 11.3] as const;
const FAR_TONES = ["yellow", "magenta", "mint", "cyan"] as const;
const STICKERS: readonly IconName[] = ["star", "sparkle", "plus", "heart", "blob", "sleepy", "coin"];

export interface FloatsOptions {
  /** Section accent; far tints lean toward it. */
  tone?: Tone;
  far?: number;
  mid?: number;
  near?: number;
  /** Where the shapes start, as a fraction of the section height (0..1). */
  from?: number;
  /** How much of the section height they spread over (0..1, default the rest). */
  span?: number;
  /** Stickers to prefer, in order. */
  stickers?: readonly IconName[];
  /** Force the far tints' tone (e.g. to keep two sets in one section apart). */
  farTone?: (typeof FAR_TONES)[number];
}

type Side = "l" | "r";

interface Shape { depth: "far" | "mid" | "near"; side: Side; html: string; vars: Record<string, string> }

function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)] as T;
}

const fmt = (n: number, digits = 2): string => String(Number(n.toFixed(digits)));

export function floats(seed: string, o: FloatsOptions = {}): string {
  const r = rng(seed);
  const shapes: Shape[] = [];
  const from = o.from ?? 0;
  const span = o.span ?? 1 - from;
  let side: Side = r() < 0.5 ? "l" : "r";
  const flip = (): Side => (side = side === "l" ? "r" : "l");
  const y = (lo: number, hi: number): string => `${fmt((from + (lo + r() * (hi - lo)) * span) * 100, 1)}%`;
  const drift = (amp: number): Record<string, string> => ({
    "--T": `${pick(r, PERIODS)}s`,
    "--dx": `${fmt((r() - 0.5) * amp * 2, 0)}px`,
    "--dy": `${fmt((r() * 0.6 + 0.4) * amp * (r() < 0.5 ? -1 : 1), 0)}px`,
    "--r0": `${fmt((r() - 0.5) * 8, 1)}deg`,
    "--r1": `${fmt((r() - 0.5) * 8, 1)}deg`,
    "--delay": `${fmt(-r() * 6, 1)}s`,
  });

  const tones: readonly string[] = o.tone && (FAR_TONES as readonly string[]).includes(o.tone)
    ? [o.tone, o.tone, ...FAR_TONES]
    : FAR_TONES;

  for (let i = 0; i < (o.far ?? 2); i += 1) {
    const size = Math.round(140 + r() * 180);
    const kind = pick(r, ["block", "step", "pill"] as const);
    const side = flip();
    const tone = pick(r, tones); // always drawn, so a forced tone moves nothing else
    shapes.push({
      depth: "far",
      side,
      html: `<span class="fl__shape fl-${kind} fl-t-${o.farTone ?? tone}"></span>`,
      vars: { "--x": fmt(-0.9 - r() * 0.5), "--y": y(0.02, 0.8), "--s": `${size}px`, ...drift(10) },
    });
  }
  for (let i = 0; i < (o.mid ?? 3); i += 1) {
    const kind = pick(r, ["outline", "dots", "cross", "strip", "tile"] as const);
    const size = kind === "strip" ? 56 : kind === "dots" ? 44 : Math.round(26 + r() * 22);
    const inner = kind === "cross" ? icon("cross", 3) : "";
    shapes.push({
      depth: "mid",
      side: flip(),
      html: `<span class="fl__shape fl-${kind} fl-t-${pick(r, tones)}">${inner}</span>`,
      vars: { "--x": fmt(0.15 + r() * 0.55), "--y": y(0.05, 0.95), "--s": `${size}px`, ...drift(12) },
    });
  }
  const preferred = o.stickers ?? [];
  for (let i = 0; i < (o.near ?? 3); i += 1) {
    const name = preferred[i] ?? pick(r, STICKERS);
    // Footprint for the gutter clamp in floats.css: the grid at scale 3 plus
    // the 2px die-cut outline on each side.
    const { width, height } = validateIcon(name, ICONS[name]);
    const size = Math.max(width, height) * 3 + 4;
    shapes.push({
      depth: "near",
      side: flip(),
      html: `<span class="fl__shape fl-sticker">${icon(name, 3)}</span>`,
      vars: { "--x": fmt(0.2 + r() * 0.5), "--y": y(0.08, 0.92), "--s": `${size}px`, "--tilt": `${fmt((r() - 0.5) * 24, 0)}deg`, ...drift(14) },
    });
  }

  const items = shapes
    .map((s) => {
      const style = Object.entries(s.vars).map(([k, v]) => `${k}:${v}`).join(";");
      return `<span class="fl fl--${s.depth}" data-side="${s.side}" style="${style}">${s.html}</span>`;
    })
    .join("");
  return `<div class="floats" aria-hidden="true" data-floats>${items}</div>`;
}
