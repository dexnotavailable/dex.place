// How the world's windows move with the page (html[data-motion], set by main.ts from ?motion= or the default). Since
// the redesign (Dex 10-19, lanes/roadmap/SITE-SCROLL.md) the page's own entrances, smooth scroll and breathing live in
// motion/stage.ts; these are only the world's:
//
// - "depth" (ships): the world is already there as you scroll. Inside every window the near things move more than the
//   far ones as the page scrolls (the sky barely, the karst a little, the palace, the pine and the towers most), in
//   whole pixels (pixel is for the assets); nothing covers it.
// - "diorama" (?motion=diorama): the same depth, and a window's hole tears open as it rises into view (and closes again
//   if you go back before it has).
//
// Reduced motion: the windows are drawn once and keep still.

import type { Look } from "./look-mode.ts";
import type { ScenePiece, WindowMotion, WinState } from "./windows.ts";

// how near each kind of thing is (0 the sky .. 1 the nearest), unless a piece says
const NEAR: Readonly<Record<string, number>> = {
  walker: 0.15, "op.farkarst": 0.2, "op.birds": 0.5, "op.isle": 0.7, "op.islet": 0.3, "op.boat": 0.45,
  "op.palace": 0.75, "op.tower": 0.95, "op.pine": 1, "op.doors": 0.85, "op.banners": 1,
};
const nearOf = (pc: ScenePiece): number => {
  if (pc.z !== undefined) return pc.z;
  if (pc.kind === "op.cloud") {
    const k = (pc.p as { kind?: string }).kind;
    return (k === "wisp" || k === "stratus" ? 0.3 : 0.45) * (1 - (pc.haze ?? 0) * 0.5);
  }
  return NEAR[pc.kind] ?? 0.5;
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** How far the window's band has come through the screen: -0.5 entering at the foot .. 0.5 leaving at the top. */
const through = (s: WinState): number => clamp01((s.vh - s.bandTop) / (s.vh + (s.bandBottom - s.bandTop))) - 0.5;

// a fixed scatter for the rough edges of tears and sweeps (one per page; indexed by pixel)
let grain: Uint8Array | null = null;
const grainOf = (n: number): Uint8Array => {
  if (grain && grain.length >= n) return grain;
  grain = new Uint8Array(n);
  let h = 2166136261;
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (i * 2654435761), 16777619) >>> 0;
    h ^= h >>> 13;
    grain[i] = h & 255;
  }
  return grain;
};

const PAPER = 255;
const paper = (out: Uint8ClampedArray, i: number): void => {
  const j = i * 4;
  out[j] = PAPER; out[j + 1] = PAPER; out[j + 2] = PAPER; out[j + 3] = 255;
};

/** The world with depth, already there: the scroll is the camera. */
export const depth: WindowMotion = {
  fps: 12,
  scrollLinked: true,
  offset(s, pc) {
    const a = s.H * 0.06;
    return [0, Math.round(-through(s) * 2 * nearOf(pc) * a)];
  },
  backOffset(s) {
    return [0, Math.round(-through(s) * 2 * 0.2 * s.H * 0.06)];
  },
};

/** The same depth, and the hole tears open as the window rises into view. */
export const diorama: WindowMotion = {
  ...depth,
  coverKey: (s) => tearExtra(s),
  cover(s, fieldOf, out) {
    const extra = tearExtra(s);
    if (extra <= 0) return false;
    const field = fieldOf();
    const g = grainOf(field.length);
    const q = extra * 4;
    for (let i = 0; i < field.length; i++) if (field[i]! < q + (g[i]! >> 5)) paper(out, i);
    return true;
  },
};

/** How much more paper than the finished tear a rising window still has (whole art px): the hole opens as the window
 *  comes up from the foot of the screen, done by the time its top is 45% of the way up. */
function tearExtra(s: WinState): number {
  const open = clamp01((s.vh - s.top) / (s.vh * 0.55));
  const o = 1 - (1 - open) * (1 - open);
  return Math.floor((1 - o) * Math.min(s.W, s.H) * 0.5);
}

export const LOOK: Readonly<Record<Look, WindowMotion>> = { depth, diorama };
