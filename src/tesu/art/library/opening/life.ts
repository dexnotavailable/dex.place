// Life in Kagami's air (art: the Kagami art loop, painter p1): a few egrets crossing in front of
// the great massif on P2, and far specks of birds over the far karst on P1 (reference 4's birds
// over its right massif). Seen side-on: each bird a body in profile, its neck folded back and
// its legs trailing, its wings seen edge-on as they beat, so they show above the body on the up
// stroke and below it on the down stroke, foreshortened between.
//
// The flap: ten frames, a fast down-stroke (two frames), a held bottom, then a slower up-stroke
// over six frames; each bird beats on its own phase and some of them glide for a while, wings
// held level. The flock drifts east on the wind as a sprite (its frames are the flap).

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { hash1 } from "../../raster.ts";

export interface BirdsP {
  /** How many birds, and the box they fly in (px of the plane; anchor at the box's bottom middle). */
  n: number;
  w: number;
  h: number;
  /** "egret" (white, long-necked, near enough to show its shape) or "speck" (a far dark tick). */
  kind?: "egret" | "speck";
  /** Body length, px (default 5 for egrets, 2 for specks). */
  size?: number;
  frame?: number;
}

/** The near wing's angle per frame of the beat (degrees, negative above the body). */
const BEAT = [-58, -10, 38, 34, 16, -2, -18, -32, -45, -54];
export const BEAT_FRAMES = BEAT.length;

function bird(c: PaintCtx, x: number, y: number, s: number, ang: number, kind: "egret" | "speck", seed: number): void {
  const b = c.buf, d = c.d;
  const set = (lx: number, ly: number, col: number): void => b.set(Math.floor(c.X(lx)), Math.floor(c.Y(ly)), col);
  const step = 0.5 / Math.max(0.5, d);
  const lift = Math.sin((ang * Math.PI) / 180);
  if (kind === "speck") {
    // a far tick: two strokes meeting at the body, up or down with the beat
    const C = P.range[6]!;
    for (let k = 0; k <= s * 1.5; k += step) {
      set(x - k * 0.9, y + k * lift * 0.8, C);
      set(x + k * 0.9, y + k * lift * 0.8, C);
    }
    set(x, y, C);
    return;
  }
  const W = P.cloud[0]!, S = P.cloud[3]!, D = P.range[5]!;
  // the body in profile, facing east: a slim lens, its underside in shade
  for (let k = -s * 0.5; k <= s * 0.5; k += step) {
    const t = 1 - (k / (s * 0.5)) ** 2;
    set(x + k, y, W);
    if (t > 0.4) set(x + k, y + 0.9, S);
  }
  // the neck folded back into the shoulders, the head forward, the bill a gold tick
  set(x + s * 0.55, y - 0.8, W);
  set(x + s * 0.75, y - 1.1, W);
  set(x + s * 0.95, y - 0.9, P.gold[2]!);
  // the legs trailing behind, dark
  for (let k = 0; k < s * 0.6; k += step) set(x - s * 0.5 - k, y + 0.4 + k * 0.15, D);
  // the far wing a step darker just behind the near one, then the near wing: seen edge-on it
  // reaches up (or down) from the shoulder, swept back toward its tip, its trailing edge shaded
  const len = s * 1.15;
  for (const [off, col, edge] of [[-0.6, S, D], [0, W, S]] as const) {
    for (let k = step; k <= len * Math.abs(lift) + 0.6; k += step) {
      const u = k / Math.max(0.6, len * Math.abs(lift) + 0.6);
      const wy = y - 0.6 - k * Math.sign(-lift || 1);
      const sweep = u * u * s * 0.35;
      const chord = s * 0.45 * (1 - u * 0.6);
      for (let q = 0; q <= chord; q += step) set(x + off - sweep - q + s * 0.15, wy, q > chord - step * 1.5 ? edge : col);
    }
  }
  void seed;
}

export const birds = definePainter<BirdsP>("op.birds", {
  bounds(p) {
    const s = p.size ?? (p.kind === "speck" ? 2 : 5);
    return [-p.w / 2 - s * 3, -p.h - s * 3, p.w / 2 + s * 3, s * 3];
  },
  paint(c, p) {
    const kind = p.kind ?? "egret";
    const s = p.size ?? (kind === "speck" ? 2 : 5);
    const f = p.frame ?? 0;
    for (let i = 0; i < p.n; i++) {
      // each bird its own place in the flock (strung out in a loose line, a pair close), size,
      // phase of the beat and the odd stretch of gliding
      const bx = (hash1(i, c.seed + 1) - 0.5) * p.w;
      const by = -hash1(i, c.seed + 2) * p.h;
      const si = s * (0.85 + 0.3 * hash1(i, c.seed + 3));
      const ph = Math.floor(hash1(i, c.seed + 4) * BEAT.length);
      const k = (((f + ph) % BEAT.length) + BEAT.length) % BEAT.length;
      const glide = hash1(i, c.seed + 5) < 0.35 && k >= 4 && k <= 7;
      // (it rises a little on each down-stroke and sinks as it recovers)
      const bob = Math.round(Math.sin(((k + 2) / BEAT.length) * Math.PI * 2) * 0.6);
      bird(c, bx, by + bob, si, glide ? -6 : BEAT[k]!, kind, c.seed + i);
    }
  },
});
