// The website's sky, pure (motion/windows.ts and motion/sky.ts draw it; checks read it): a ramp of many steps, each
// step's lower edge an ordered dither into the next (pixel-art banding, never a ruled line), and the clouds the jetty
// paints from.

import type { CloudP } from "../../tesu/art/library/opening/sky.ts";

/** Key colours of the sky, top of the website to its bottom (deep blue to pale, the reference's mood). */
const KEYS: [number, number, number][] = [
  [28, 80, 150], [44, 108, 178], [70, 138, 204], [104, 166, 222], [146, 196, 236], [190, 222, 246], [222, 238, 250],
];

/** The ramp: `n` steps between the key colours. */
export function skyRamp(n = 28): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * (KEYS.length - 1);
    const a = KEYS[Math.floor(u)]!, b = KEYS[Math.min(KEYS.length - 1, Math.floor(u) + 1)]!, f = u - Math.floor(u);
    out.push([Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)]);
  }
  return out;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * The step at row y (0..rows) of a ramp of `n` steps, at column x: flat inside a step, an ordered dither over the
 * last third of it into the next one (pixel-art banding with soft edges, never a ruled line).
 */
export function rampIndex(x: number, y: number, rows: number, n: number): number {
  const t = (Math.max(0, Math.min(rows - 1, y)) / Math.max(1, rows - 1)) * (n - 1);
  const i = Math.floor(t), f = t - i;
  if (i >= n - 1) return n - 1;
  const edge = 0.62;
  if (f < edge) return i;
  const th = (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
  return th < (f - edge) / (1 - edge) ? i + 1 : i;
}

/** The painted clouds every placement picks from (art px at full scale). */
export const POOL: readonly (CloudP & { use: "heap" | "low" | "thin" })[] = [
  { kind: "tower", w: 230, h: 300, use: "heap" },
  { kind: "tower", w: 190, h: 240, use: "heap" },
  { kind: "cumulus", w: 420, h: 210, use: "heap" },
  { kind: "cumulus", w: 340, h: 180, tower: 0.9, use: "heap" },
  { kind: "cumulus", w: 300, h: 150, tower: 0.6, use: "heap" },
  { kind: "cumulus", w: 460, h: 150, tower: 0.45, use: "low" },
  { kind: "cumulus", w: 320, h: 110, low: true, use: "low" },
  { kind: "stratus", w: 640, h: 50, use: "low" },
  { kind: "wisp", w: 220, h: 26, use: "thin" },
  { kind: "wisp", w: 280, h: 30, use: "thin" },
];
