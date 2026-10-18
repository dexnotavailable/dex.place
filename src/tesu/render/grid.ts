// The engine's pixel grid, the pure part (no GL; Node tests import it): the zoomed-out reduction's rule on the CPU
// (render/reduce.ts has it in GLSL for the plates, the plane sprites and the actor layer) and the camera of the
// screen-res actor layer (render/actors.ts).

import type { CamState } from "./view.ts";

/** Opaque when the opaque texels cover at least this share of the footprint. */
export const REDUCE_OPAQUE = 1 / 3;
/**
 * A colour this much lighter or darker (luma, 0..1) than the footprint's background (the colour that covers most of
 * the footprint and the ring of texels just outside it) is a feature and counts double: a 1 px line, crack, rope or
 * thread survives every phase down to 2/3 a side, at most 2 px thick, and a line that is itself the main colour of a
 * footprint is never flipped to its ground.
 */
export const REDUCE_FEATURE = 0.11;
/** Feature weight. */
export const REDUCE_BOOST = 2;

/**
 * The rule on the CPU (the shaders' reference, for tests and tools): the pick for the footprint [a0, a0 + inv) a side
 * (texel units) over `get(x, y)` -> a colour key (0 = clear, -1 = unknown: left out) and `luma(key)` 0..1.
 *  1. Core: exact area weights of the texels it covers (a 4 x 4 grid of samples past 3 texels a side).
 *  2. Clear when opaque texels cover under a third of it.
 *  3. Background: the colour with the most of (its share of the core + its share of 8 samples just outside it).
 *  4. The pick: the opaque colour with the most core weight, a colour contrasting with the background counting double.
 */
export function reduceFootprint(get: (x: number, y: number) => number, luma: (key: number) => number, a0: [number, number], inv: number): number {
  const keys: number[] = [], ws: number[] = [], ring: number[] = [];
  let total = 0, opaque = 0, ringN = 0;
  const a1: [number, number] = [a0[0] + inv, a0[1] + inv];
  const exact = inv <= 3;
  const bx = Math.floor(a0[0]), by = Math.floor(a0[1]);
  const slot = (key: number): number => {
    let m = keys.indexOf(key);
    if (m < 0) { keys.push(key); ws.push(0); ring.push(0); m = keys.length - 1; }
    return m;
  };
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      let tx: number, ty: number, w: number;
      if (exact) {
        tx = bx + i;
        ty = by + j;
        const dx = Math.min(a1[0], tx + 1) - Math.max(a0[0], tx), dy = Math.min(a1[1], ty + 1) - Math.max(a0[1], ty);
        if (dx <= 0 || dy <= 0) continue;
        w = dx * dy;
      } else {
        tx = Math.floor(a0[0] + (i + 0.5) * inv * 0.25);
        ty = Math.floor(a0[1] + (j + 0.5) * inv * 0.25);
        w = 1;
      }
      const key = get(tx, ty);
      if (key < 0) continue;
      total += w;
      if (key !== 0) opaque += w;
      ws[slot(key)]! += w;
    }
  }
  if (!total || opaque < total * REDUCE_OPAQUE) return 0;
  const solid = keys.filter((k) => k !== 0);
  if (solid.length === 1) return solid[0]!;
  const xs = [a0[0] - 0.5, (a0[0] + a1[0]) / 2, a1[0] + 0.5], ys = [a0[1] - 0.5, (a0[1] + a1[1]) / 2, a1[1] + 0.5];
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      if (i === 1 && j === 1) continue;
      const key = get(Math.floor(xs[i]!), Math.floor(ys[j]!));
      if (key < 0) continue;
      ringN++;
      ring[slot(key)]! += 1;
    }
  }
  let bg = 0, bgS = -1, main = -1;
  for (let q = 0; q < keys.length; q++) {
    const sc = ws[q]! / total + (ringN ? ring[q]! / ringN : 0);
    if (sc > bgS) { bgS = sc; bg = q; }
    if (keys[q] !== 0 && ws[q]! > 0 && (main < 0 || ws[q]! > ws[main]!)) main = q;
  }
  const ref = luma(keys[bg] !== 0 ? keys[bg]! : keys[main]!);
  let pick = main, ps = -1;
  for (let q = 0; q < keys.length; q++) {
    if (keys[q] === 0 || ws[q]! <= 0) continue;
    const sc = ws[q]! * (Math.abs(luma(keys[q]!) - ref) > REDUCE_FEATURE ? REDUCE_BOOST : 1);
    if (sc > ps) { ps = sc; pick = q; }
  }
  return keys[pick]!;
}

/**
 * The camera that draws the play plane at k times the frame's transform (same whole-px offsets x k, so a drawing in
 * the layer lands exactly on the frame's px x k): planeXf(screenCam(cam, xf, k), 1) = { s: s k, offX: offX k, offY: offY k }.
 */
export function screenCam(cam: CamState, xf: { s: number; offX: number; offY: number }, k: number): CamState {
  const W = cam.W * k, H = cam.H * k, s = xf.s * k;
  // horizon = anchor: the eye sits on the anchor row, so offY = anchor H - cy s
  return { cx: (W / 2 - xf.offX * k) / s, cy: (cam.anchor * H - xf.offY * k) / s, zoom: s, anchor: cam.anchor, horizon: cam.anchor, W, H };
}
