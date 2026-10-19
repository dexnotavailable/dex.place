// The engine's pixel grid, the pure part (no GL; Node tests import it): the zoomed-out reduction's rule on the CPU
// (render/reduce.ts has it in GLSL for the plates, the plane sprites and the actor layer) and the camera of the
// screen-res actor layer (render/actors.ts).

import type { CamState } from "./view.ts";

/** Opaque when the opaque texels cover at least this share of the footprint, if the opaque part is thin (a rope). */
export const REDUCE_OPAQUE = 1 / 3;
/** ... and this share where it is not (an edge of a shape: plain majority, so shapes keep their size). */
export const REDUCE_OPAQUE_EDGE = 1 / 2;
/**
 * A colour this much lighter or darker (luma, 0..1; 0.05 keeps low-contrast texture dots, 10-18) than the footprint's background (the colour that covers most of
 * the footprint and the ring of texels just outside it) is a feature; a THIN feature (absent from the ring on both
 * sides in one direction: a line, a crack, a rope, a dot) counts double, so it survives every phase down to 2/3 a
 * side, at most 2 px thick. Edges of shapes are not boosted (plain majority), so a stud or a window keeps its shape.
 */
export const REDUCE_FEATURE = 0.05;
/** Thin-feature weight. */
export const REDUCE_BOOST = 2;

/**
 * The rule on the CPU (the shaders' reference, for tests and tools): the pick for the footprint [a0, a0 + inv) a side
 * (texel units) over `get(x, y)` -> a colour key (0 = clear, -1 = unknown: left out) and `luma(key)` 0..1.
 *  1. Core: exact area weights of the texels it covers (a 4 x 4 grid of samples past 3 texels a side).
 *  2. Ring: the 8 texels just outside its span (the corners and the middle of each side).
 *  3. Clear when opaque texels cover under a third of it (the opaque part thin: clear above and below it, or left
 *     and right), or under half (an edge).
 *  4. Background: the colour with the most of (its share of the core + its share of the ring).
 *  5. The pick: the opaque colour with the most core weight, a thin colour contrasting with the background counting
 *     double.
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
  if (!total) return 0;
  // the ring, 3 x 3 around it without the middle: rg[j * 3 + i]
  // (the texels just outside its span: the one before its first, its middle one, the one after its last)
  const xs = [Math.floor(a0[0]) - 1, Math.floor((a0[0] + a1[0]) / 2), Math.floor(a1[0] - 1e-4) + 1];
  const ys = [Math.floor(a0[1]) - 1, Math.floor((a0[1] + a1[1]) / 2), Math.floor(a1[1] - 1e-4) + 1];
  const rg: number[] = [];
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 3; i++) {
      if (i === 1 && j === 1) { rg.push(-2); continue; }
      const key = get(Math.floor(xs[i]!), Math.floor(ys[j]!));
      rg.push(key);
      if (key < 0) continue;
      ringN++;
      ring[slot(key)]! += 1;
    }
  }
  // thin: missing from both opposite sides of the ring in one direction (rows, columns or a diagonal)
  const off = (key: number, ...at: number[]): boolean => at.every((q) => rg[q] !== key);
  const thin = (key: number): boolean => (off(key, 0, 1, 2) && off(key, 6, 7, 8)) || (off(key, 0, 3, 6) && off(key, 2, 5, 8)) || off(key, 2, 6) || off(key, 0, 8);
  const clearRow = (at: number[]): boolean => at.every((q) => rg[q] === 0 || rg[q] === -1);
  const opThin = (clearRow([0, 1, 2]) && clearRow([6, 7, 8])) || (clearRow([0, 3, 6]) && clearRow([2, 5, 8])) || clearRow([2, 6]) || clearRow([0, 8]);
  if (opaque <= 0 || opaque < total * (opThin ? REDUCE_OPAQUE : REDUCE_OPAQUE_EDGE)) return 0;
  let bg = 0, bgS = -1, main = -1, solid = 0;
  for (let q = 0; q < keys.length; q++) {
    const sc = ws[q]! / total + (ringN ? ring[q]! / ringN : 0);
    if (sc > bgS) { bgS = sc; bg = q; }
    if (keys[q] !== 0 && ws[q]! > 0) {
      solid++;
      if (main < 0 || ws[q]! > ws[main]!) main = q;
    }
  }
  if (solid === 1) return keys[main]!;
  const ref = luma(keys[bg] !== 0 ? keys[bg]! : keys[main]!);
  let pick = main, ps = -1;
  for (let q = 0; q < keys.length; q++) {
    if (keys[q] === 0 || ws[q]! <= 0) continue;
    const sc = ws[q]! * (Math.abs(luma(keys[q]!) - ref) > REDUCE_FEATURE && thin(keys[q]!) ? REDUCE_BOOST : 1);
    if (sc > ps) { ps = sc; pick = q; }
  }
  return keys[pick]!;
}

/**
 * (lane C 10-19) How the actor layer (render/reduce.ts ActorLayer) lands on a destination grid. The layer holds the
 * play plane at `lay` (scale D layer px per world px: her art density, 1 layer px = 1 of her art px, so nothing of her
 * is dropped drawing into it; whole-px offsets); the destination grid (the frame, or a screen-res layer) shows the play
 * plane at `dst`. Destination px n reads the layer's footprint [n * inv + c, (n + 1) * inv + c) a side, inv = D / s,
 * phased so that her anchor (her feet, world px) starts a footprint: her drawing keeps its pixels while she or the
 * camera moves. `rect`: the destination px [x0, y0, x1, y1) the layer covers (w x h layer px).
 */
export function actorMap(lay: { s: number; offX: number; offY: number }, dst: { s: number; offX: number; offY: number }, w: number, h: number, anchor: [number, number]): { inv: number; cx: number; cy: number; rect: [number, number, number, number] } {
  const inv = lay.s / dst.s;
  const ax = Math.round(anchor[0]), ay = Math.round(anchor[1]);
  // her anchor's layer px (where the renderer puts a whole world px drawn at the layer's transform) and the first
  // destination px at or right of / below it
  const lx = Math.round(ax * lay.s + lay.offX), ly = Math.round(ay * lay.s + lay.offY);
  const nx = Math.ceil(ax * dst.s + dst.offX - 1e-6), ny = Math.ceil(ay * dst.s + dst.offY - 1e-6);
  const cx = lx - (nx - dst.offX) * inv, cy = ly - (ny - dst.offY) * inv;
  // layer px L = (n - off) * inv + c  <->  n = (L - c) / inv + off
  const rect: [number, number, number, number] = [
    Math.floor(-cx / inv + dst.offX), Math.floor(-cy / inv + dst.offY),
    Math.ceil((w - cx) / inv + dst.offX), Math.ceil((h - cy) / inv + dst.offY),
  ];
  return { inv, cx, cy, rect };
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
