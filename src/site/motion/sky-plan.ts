// Where the website's sky puts its clouds and what colour it is, pure (motion/sky.ts draws it; checks read it).
//
// The critic's first pass (CRITIQUE-1 B1): clouds spread along one long stretch left most gaps between the papers
// as flat blue bars. Now the clouds belong to the page: every paper's open side gets heaps all along it (about
// three to a screen), every gap between papers gets a low heap or a deck whose tops show between them, and the
// jetty's sky gets its own. The colour is a ramp of many steps, each step's lower edge an ordered dither into the
// next, so no gap is ever one flat colour.

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

/** A stretch of page where the sky shows: a paper's open side, a gap between papers, the jetty's sky. */
export interface SkyRegion {
  kind: "side" | "gap" | "jetty";
  /** Page coordinates, css px. */
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface CloudPlace {
  /** Index into POOL. */
  pool: number;
  /** The cloud's anchor (the middle of its base), page css px. */
  x: number;
  y: number;
  /** For its slow sway. */
  phase: number;
}

function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const pick = (r: () => number, use: "heap" | "low" | "thin"): number => {
  const ids = POOL.map((c, i) => (c.use === use ? i : -1)).filter((i) => i >= 0);
  return ids[Math.floor(r() * ids.length)]!;
};

/**
 * The clouds for a page: about three heaps per screen height along every open side (anchored inside it, so the
 * heads stand in the open sky beside the paper), a low heap or a deck under every gap (its tops show between the
 * papers), a wisp now and then, and heaps over the jetty's open sky. `vh`: the screen height, css px.
 */
export function placeClouds(regions: readonly SkyRegion[], vh: number, seed = 1): CloudPlace[] {
  const r = rng(seed);
  const out: CloudPlace[] = [];
  for (const g of regions) {
    const h = g.bottom - g.top, w = g.right - g.left;
    if (h <= 0 || w <= 0) continue;
    if (g.kind === "side") {
      if (w < 90) continue;
      const n = Math.max(1, Math.round(h / (vh * 0.34)));
      for (let j = 0; j < n; j++) {
        out.push({
          pool: pick(r, "heap"),
          x: g.left + w * (0.35 + 0.3 * r()),
          y: g.top + (h * (j + 0.55 + 0.3 * (r() - 0.5))) / n,
          phase: r() * 6.28,
        });
        if (r() < 0.3) out.push({ pool: pick(r, "thin"), x: g.left + w * r(), y: g.top + (h * (j + r())) / n, phase: r() * 6.28 });
      }
    } else if (g.kind === "gap") {
      // its base below the gap, so the heads fill it; one or two across the width
      const n = w > 900 ? 2 : 1;
      for (let j = 0; j < n; j++) {
        out.push({ pool: pick(r, "low"), x: g.left + (w * (j + 0.3 + 0.4 * r())) / n, y: g.bottom + h * 0.35, phase: r() * 6.28 });
      }
      if (r() < 0.5) out.push({ pool: pick(r, "thin"), x: g.left + w * r(), y: g.top + h * (0.3 + 0.3 * r()), phase: r() * 6.28 });
    } else {
      // the jetty's sky: heaps along the open part, the horizon a deck
      const n = Math.max(2, Math.round(w / 420));
      for (let j = 0; j < n; j++) out.push({ pool: pick(r, "heap"), x: g.left + (w * (j + 0.5)) / n, y: g.top + h * (0.55 + 0.25 * r()), phase: r() * 6.28 });
      out.push({ pool: 7, x: g.left + w * 0.5, y: g.bottom, phase: r() * 6.28 });
    }
  }
  return out;
}
