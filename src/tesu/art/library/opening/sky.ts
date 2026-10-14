// The opening's sky (P0): morning clouds and the two sky isles. Clouds are authored in code
// (Dex: clouds, fog, mist and haze are freestyle, never traced).
//
// One cloud family (Dex: "shouldn't have like 4 different types or shapes"; round 6: "the clouds
// should have volume and feel defined"), after Dex's painterly cumulus reference: every cloud is
// built of LOBES, rounded masses each big enough to carry its own light and shade, overlapping one
// another, the lower in front of the upper, so every lobe's sunlit top stands crisp against the
// shaded belly of the one behind it. A heap gathers its lobes into a few heads of very different
// sizes (the tallest toward the sun) on a flat-ish, scalloped base; the sunlit outline sprouts
// smaller lobes (cauliflower), the shaded outline stays broad and soft and its edge is lost into
// the sky by a cell of dither. A low layer is the same lobes drawn out long and flat: broken
// overlapping strands of stratus in two or three tiers, lit warm along their tops, their ends torn.
// A wisp is two tiers of such strands, thin and torn.
//
// The light: every lobe's own ball in the sun (lit cap, turning face, shaded belly) on the cloud's
// big shade, the sun's light travelling through the heap from the upper left, so its lower right
// lies in its own shadow, where the lobes' edges soften and merge; a short contact shade on a lobe
// just above a nearer one; the warm light thrown up from the land and the lake a soft dithered
// gradient into the lowest lobes' shade. Flat steps of the cumulus ramp, dither only in a narrow
// seam where two steps meet. `haze` lifts far clouds toward the half light. `frame` (0..3) swells
// and settles the lobes a little for the drifting sprites.
//
// The isles: two floating islands far off (Bell and Drum) seen side-on: a turf cap on a slab of
// bedded limestone, the rock under it stacked chunks stepping inward as they hang (Dex's chunk
// sketch upside down) ending in hanging blocks, never icicles; a pagoda on each (pale plaster
// between vermilion posts, swept eaves of grey-blue tiles curling up at the tips, a warm lit
// opening, a gold finial), pines and shrubs round it, roots off the overhangs, and a thread of
// water off the right lip fraying into a scrap of the one cloud family.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, hash1, rng, vnoise, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

/** The ordered-dither threshold on cells of k art px (two screen px at the catch's 2x). */
const bay = (x: number, y: number, k: number): number => bayer4(Math.floor(x / k), Math.floor(y / k));

export interface CloudP {
  /**
   * One cloud family: every member built of the same lobes in the same light; they differ only
   * in how the lobes are gathered:
   * - `cumulus`: a heap of a few heads of very different sizes, the tallest left of the middle
   *   toward the sun, a long lower shoulder downwind, a small head upwind;
   * - `tower`: one tall narrow head over a couple of small ones at its foot;
   * - `stratus` (and the older `deck` and `field`): a low layer of broken, overlapping strands in
   *   two or three tiers, lit warm along their tops (the lower band of Dex's reference);
   * - `wisp`: two tiers of thin torn strands.
   */
  kind?: "cumulus" | "tower" | "deck" | "wisp" | "stratus" | "field";
  /** Width and height of the cloud, px of its plane; anchor at the middle of its base. */
  w: number;
  h: number;
  /** How much a heap towers: 0 a low, flat heap .. 1 a great tower (default 0.75; 0.35 when `low`). */
  tower?: number;
  /** A low heap (the old flag): a tower of 0.35. */
  low?: boolean;
  /** For a layer: about how many strands along a tier (default from its width). */
  heaps?: number;
  /** Distance haze, 0..1: far clouds low over the horizon compress toward the half light. */
  haze?: number;
  /** Older parameters, kept so old placements still paint (unused). */
  layers?: number;
  density?: number;
  strands?: number;
  frame?: number;
}

/**
 * One head of a heap: its middle, size, how much it towers, where its base lies (y, negative up),
 * its depth among the heads (bigger: in front) and how flat its lobes are.
 */
interface Head { cx: number; w: number; h: number; tower: number; base: number; z: number; flat: number }

/**
 * A lobe: one rounded mass of cloud seen side-on, an ellipse [centre, radii] whose outline
 * wanders, the head it belongs to, its depth (the lower lobes stand in front of the ones above
 * them), the base it is cut off at, a wobble seed, and what it is: 0 a body lobe, 1 one walked
 * along the outline, 2 a cauliflower sprout, 3 a long strand of a layer (its ends torn).
 */
interface Lobe { x: number; y: number; rx: number; ry: number; z: number; head: number; s: number; base: number; sub: number; bulge: number }

/** A bulge in the cloud's own px: its centre (y negative up) and radius (-1: none, a layer). */
type Bulge = [number, number, number];

const isLayer = (p: CloudP): boolean => p.kind === "deck" || p.kind === "stratus" || p.kind === "field" || p.kind === "wisp";

/** The sun's direction (upper left and a little toward the viewer: the frame's sun at (0.2, 0.11)). */
const SUN = [-0.55, -0.68, 0.48] as const;

function headsOf(p: CloudP, seed: number): Head[] {
  const r = rng(seed + 7);
  const tower = clamp(p.tower ?? (p.low ? 0.35 : p.kind === "tower" ? 1 : 0.75), 0, 1);
  const W = p.w, HH = p.h;
  // a few big heads of very different sizes, never a row of equal ones
  const aspect = W / HH;
  const out: Head[] = [];
  // the main head (the tower): left of the middle, toward the sun; a narrow cloud is mostly it
  const mw = clamp(0.2 + 0.5 / aspect, 0.3, 0.82) * W * (p.kind === "tower" ? 0.85 : 1);
  const mcx = -W / 2 + mw / 2 + (W - mw) * (0.1 + 0.22 * r());
  out.push({ cx: mcx, w: mw, h: HH, tower, base: 0, z: 0, flat: 0.92 });
  // downwind (east): a long lower shoulder of one to three heads stepping down, each a little in
  // front of the one before it
  let right = mcx + mw * (0.36 + 0.08 * r());
  for (let k = 0; k < 3 && right < W / 2 - W * 0.08; k++) {
    const hw = W * (0.21 + 0.14 * r()) * (p.kind === "tower" ? 0.7 : 1);
    const cx = Math.min(W / 2 - hw / 2, right + hw * (0.12 + 0.22 * r()));
    const hh = HH * (0.62 - 0.1 * k) * (0.8 + 0.3 * r()) * (p.kind === "tower" ? 0.5 : 0.72 + 0.28 * (1 - tower));
    out.push({ cx, w: hw, h: hh, tower: tower * 0.5, base: -HH * 0.03 * r(), z: 1 + k * 0.6, flat: 0.88 });
    right = cx + hw * (0.3 + 0.12 * r());
  }
  // upwind: a smaller head low on the sun's side, in front of the tower's foot
  if (mcx - mw / 2 > -W / 2 + W * 0.04 || aspect > 1.5) {
    const hw = W * (0.15 + 0.09 * r());
    const cx = Math.max(-W / 2 + hw / 2, mcx - mw * 0.4 - hw * 0.12);
    out.push({ cx, w: hw, h: HH * (0.3 + 0.16 * r()), tower: 0.35, base: 0, z: 1.4, flat: 0.86 });
  }
  // a low head in front of the middle, where the tower meets its shoulder (the lower lobes of
  // Dex's reference stand in front of the tower's foot, lit along their tops)
  if (aspect > 1.7) out.push({ cx: mcx + mw * (0.22 + 0.2 * r()), w: W * (0.15 + 0.08 * r()), h: HH * (0.2 + 0.1 * r()), tower: 0.2, base: 0, z: 2.4, flat: 0.84 });
  return out;
}

/**
 * A head's big forms: BULGES, round masses stacked from a crown down each side toward the base
 * (the tall tower steps down steeply, a low heap spreads), each [x, height of its centre above the
 * base, radius]; and the head's outline, the union of their upper halves over a low body, so the
 * silhouette swells in rounded bulges with notches between them (Dex's reference: cauliflower
 * heads), never a dome, a triangle or a sloping wedge.
 */
function bulgesOf(H: Head, r: () => number): { top: (x: number) => number; bulges: [number, number, number][] } {
  const t = H.tower;
  const bulges: [number, number, number][] = [];
  const r0 = Math.min(H.w * 0.3, H.h * (0.24 + 0.14 * (1 - t)));
  const c0 = H.cx + H.w * (-0.1 + 0.2 * r());
  bulges.push([c0, H.h - r0, r0]);
  // (a second crown beside the first on a broad head)
  if (H.w > H.h * 1.6 && r() < 0.8) {
    const r1 = r0 * (0.6 + 0.25 * r()), side = r() < 0.6 ? 1 : -1;
    bulges.push([c0 + side * r0 * (0.9 + 0.4 * r()), H.h - r0 * (0.5 + 0.4 * r()) - r1 * 0.3, r1]);
  }
  const crowns = bulges.slice();
  for (const [cx0, cy0, cr0] of crowns) {
    for (const side of [-1, 1]) {
      let x = cx0, y = cy0, rr = cr0;
      for (let k = 0; k < 9; k++) {
        // (a great tower stands on its own stem: its bulges step down nearly straight, as big as the
        // crown or a little smaller, so its head swells over its foot, never a cone)
        const stem = t > 0.97;
        const nr = Math.min(rr * (stem ? 0.78 + 0.3 * r() : 0.82 + 0.38 * r()), H.h * 0.42);
        x += side * rr * (stem ? 0.05 + 0.3 * r() : (0.4 + 0.4 * r()) * (1.3 - 0.85 * t));
        y -= rr * (0.5 + 0.35 * r()) * (0.6 + 0.55 * t);
        if (y < nr * 0.1 || Math.abs(x - H.cx) > H.w / 2 - nr * 0.45) break;
        bulges.push([x, y, nr]);
        rr = nr;
      }
    }
  }
  const bodyH = H.h * (0.2 + 0.1 * (1 - t)) * (0.85 + 0.3 * r());
  const s = Math.floor(r() * 1e4);
  const top = (x: number): number => {
    const u = (x - H.cx) / (H.w / 2);
    if (Math.abs(u) >= 1) return 0;
    // (the ends round off as lobed shoulders over the flat base)
    const env = Math.pow(1 - u ** 6, 0.5);
    let v = bodyH * env * (0.85 + 0.3 * vnoise1(x / (H.w * 0.18), s));
    for (const [bx, by, br] of bulges) {
      const d = x - bx;
      if (Math.abs(d) < br) v = Math.max(v, (by + Math.sqrt(br * br - d * d)) * Math.pow(env, 0.25));
    }
    return v;
  };
  return { top, bulges };
}

/** How far a cloud's lobes may reach either side of its anchor, level-1 px. */
const cloudReach = (p: CloudP): number => p.w * 0.6 + p.h * 0.5;

/** A heap's lobes (in its own level-1 px, y negative up). */
function heapLobes(p: CloudP, seed: number): { L: Lobe[]; H: Head[]; B: Bulge[] } {
  const r = rng(seed + 5);
  const L: Lobe[] = [];
  const B: Bulge[] = [];
  const heads = headsOf(p, seed);
  heads.forEach((H, hi) => {
    const { top, bulges } = bulgesOf(H, r);
    const b0 = B.length;
    for (const [bx, by, br] of bulges) B.push([bx, H.base - by, br]);
    // (each lobe belongs to the bulge it sits deepest in: it takes that big form's light)
    const bulgeOf = (x: number, y: number): number => {
      let best = b0, bd = Infinity;
      for (let j = b0; j < B.length; j++) {
        const [bx, by, br] = B[j]!;
        const d = Math.hypot(x - bx, y - by) / br;
        if (d < bd) { bd = d; best = j; }
      }
      return best;
    };
    // the head's lobe size: a few to a dozen across it, each big enough to carry its own cap of
    // light and its own shade (never a speckle of bobbles)
    const R0 = clamp(Math.min(H.h * 0.2, H.w * 0.15), 4, 34);
    const minR = Math.max(2.8, R0 * 0.26);
    const zAt = (y: number): number => -((H.base - y) / Math.max(1, H.h)) * 3;
    const add = (x: number, y: number, rx: number, ry: number, z: number, sub: number): Lobe => {
      const b = { x, y, rx, ry, z, head: hi, s: Math.floor(r() * 997), base: H.base, sub, bulge: bulgeOf(x, y) };
      L.push(b);
      return b;
    };
    // the body: rows of lobes from the base up, each row in front of the one above it, smaller
    // toward the crown
    for (let y = H.base - R0 * 0.5; H.base - y < H.h * 0.96;) {
      const hy = H.base - y;
      const R = R0 * (1.2 - (0.45 * hy) / H.h);
      for (let x = H.cx - H.w / 2 + R * (0.2 + 0.7 * r()); x < H.cx + H.w / 2; x += R * (1.0 + 0.6 * r())) {
        if (top(x) - hy < R * 0.55) continue;
        const rad = R * (0.7 + 0.6 * r());
        const ly = y + (r() - 0.5) * R * 0.4;
        add(x + (r() - 0.5) * R * 0.5, ly, rad * (1 + 0.15 * r()), rad * H.flat * (0.9 + 0.1 * r()), zAt(ly) + r() * 0.5, 0);
      }
      y -= R * (0.7 + 0.35 * r());
    }
    // the outline: lobes walked along it by its length, each sitting just inside it; a few big,
    // more middling, small ones mostly where it faces the sun; broader on the shaded side
    const pts: [number, number][] = [];
    for (let x = H.cx - H.w / 2; x <= H.cx + H.w / 2; x += 1) pts.push([x, top(x)]);
    const rim: [Lobe, number][] = [];
    let acc = 0, want = 0;
    for (let i = 1; i < pts.length; i++) {
      const [xa, ta] = pts[i - 1]!, [xb, tb] = pts[i]!;
      acc += Math.hypot(xb - xa, tb - ta);
      if (acc < want || tb < 2) continue;
      const tx = xb - xa, ty = -(tb - ta), tl = Math.hypot(tx, ty) || 1;
      // (the inward normal; the outline faces the sun where the outward one points up and left)
      const nx = -ty / tl, ny = tx / tl;
      const facing = -(nx * SUN[0] + ny * SUN[1]);
      const g = r();
      let rad = R0 * (g < 0.2 ? 1 + 0.3 * r() : g < 0.6 ? 0.62 + 0.2 * r() : 0.4 + 0.16 * r());
      if (facing < 0) rad *= 1.25;
      rad = Math.max(minR, Math.min(rad, tb * 0.5 + 1.5));
      const sink = rad * (0.6 + 0.2 * r());
      const ly = H.base - tb + ny * sink;
      rim.push([add(xb + nx * sink, ly, rad * (1 + 0.15 * r()), rad * H.flat * (0.88 + 0.12 * r()), zAt(ly) + 0.3 + r() * 0.4, 1), facing]);
      acc = 0;
      want = rad * (0.75 + 0.45 * r());
    }
    // cauliflower: the sunlit outline lobes sprout smaller ones round their upper-left rims, and
    // the biggest of those sprout again (only where they stay lobes, never single px bobbles)
    let gen = rim.filter(([b, f]) => f > 0.12 && b.rx > minR * 2).map(([b]) => b);
    for (let level = 0; level < 2 && gen.length; level++) {
      const next: Lobe[] = [];
      for (const b of gen) {
        const k = 1 + Math.floor(r() * (level ? 1.6 : 2.6));
        for (let j = 0; j < k; j++) {
          const ang = -Math.PI * (0.45 + 0.5 * r());
          const sr = b.rx * (0.34 + 0.18 * r());
          if (sr < minR * 0.9) continue;
          const reach = b.rx * (0.68 + 0.14 * r());
          next.push(add(b.x + Math.cos(ang) * reach, b.y + Math.sin(ang) * reach * H.flat, sr, sr * H.flat * 0.95, b.z + 0.05, 2));
        }
      }
      gen = next.filter((b) => b.rx > minR * 2.2 && R0 > 10);
    }
    // the base: broad flattened lobes along it, in front, their bottoms cut flat by it
    for (let x = H.cx - H.w / 2 + H.w * 0.04; x < H.cx + H.w / 2;) {
      const t = top(x);
      const rad = Math.max(minR, Math.min(R0 * (0.95 + 0.4 * r()), t * 0.5 + 1));
      if (t > 3) add(x, H.base - rad * (0.32 + 0.15 * r()), rad * 1.35, rad * 0.62, 0.55 + r() * 0.35, 0);
      x += rad * (1.1 + 0.8 * r());
    }
    // the base is scalloped, never one ruled slab: a few flattened lobes sag a little below it,
    // more on the shaded (east) half
    const nSag = Math.round((H.w / H.h) * 0.6 + r() * 1.5);
    for (let j = 0; j < nSag; j++) {
      const u = r() < 0.7 ? 0.05 + 0.4 * r() : -0.4 + 0.4 * r();
      const x = H.cx + u * H.w;
      if (top(x) < H.h * 0.2) continue;
      const rad = Math.max(minR, H.h * (0.07 + 0.07 * r()));
      const sag = rad * (0.25 + 0.3 * r());
      L.push({ x, y: H.base + sag - rad * 0.55, rx: rad * 1.35, ry: rad * 0.7, z: 0.9 + r() * 0.3, head: hi, s: Math.floor(r() * 997), base: H.base + sag, sub: 0, bulge: bulgeOf(x, H.base) });
    }
    // torn off its ends: a scrap or two drifting free downwind (east), smaller as they go
    for (let j = 0, nF = Math.floor(r() * 2.2); j < nF; j++) {
      const side = r() < 0.75 ? 1 : -1;
      let x = H.cx + side * (H.w / 2) * (0.95 + 0.2 * r());
      let y = H.base - H.h * (0.08 + 0.3 * r());
      let rad = minR * (1.3 + 1.2 * r());
      for (let k = 0; k < 2 && rad >= minR && Math.abs(x) + rad * 1.9 < cloudReach(p); k++) {
        L.push({ x, y, rx: rad * 1.3, ry: rad * 0.65, z: 0.5, head: hi, s: Math.floor(r() * 997), base: y + rad * 0.4, sub: 0, bulge: -1 });
        x += side * rad * (1.8 + 1.2 * r());
        y += (r() - 0.3) * rad;
        rad *= 0.6 + 0.2 * r();
      }
    }
  });
  return { L, H: heads, B };
}

/**
 * A layer's lobes: long strands in two or three tiers, the lower tier in front, overlapping one
 * another with a gap of clear air here and there, each strand's top lifted by a few low humps
 * (the lit tops of the stratus in Dex's reference); a wisp is two tiers of thin, torn strands.
 */
function layerLobes(p: CloudP, seed: number): { L: Lobe[]; H: Head[]; B: Bulge[] } {
  const r = rng(seed + 5);
  const W = p.w, HH = p.h;
  const wisp = p.kind === "wisp";
  const L: Lobe[] = [];
  const tiers = wisp ? 2 : HH > 26 ? 3 : 2;
  for (let k = 0; k < tiers; k++) {
    // (tier 0 is the highest and furthest back)
    const ty = -HH * (0.3 + (0.5 * (tiers - 1 - k)) / Math.max(1, tiers - 1));
    let x = -W / 2 + W * (0.01 + 0.1 * r()) + (k % 2) * W * 0.06;
    const end = W / 2 - W * (0.01 + 0.1 * r());
    while (x < end - W * 0.04) {
      const len = Math.min(end - x, W * (wisp ? 0.2 + 0.26 * r() : p.heaps ? (0.9 + 0.8 * r()) / p.heaps : 0.1 + 0.16 * r()));
      const th = HH * (wisp ? 0.14 + 0.1 * r() : 0.1 + 0.12 * r()) * (k === tiers - 1 ? 1.15 : 1);
      const cx = x + len / 2;
      const sy = ty + (r() - 0.5) * HH * 0.16;
      if (len > th * 3) {
        L.push({ x: cx, y: sy, rx: len / 2, ry: th, z: k + r() * 0.3, head: 0, s: Math.floor(r() * 997), base: sy + th * (0.75 + 0.2 * r()), sub: 3, bulge: -1 });
        // its humps: low rounded swellings along its top, lit along their tops
        const nh = wisp ? (r() < 0.35 ? 1 : 0) : Math.floor(r() * 3.4);
        for (let j = 0; j < nh; j++) {
          const hx = cx + (r() - 0.5) * len * 0.6;
          const hr = Math.min(th * (1 + 0.8 * r()), HH * 0.26);
          L.push({ x: hx, y: sy - th * 0.3 - hr * 0.2, rx: hr * (1.5 + 0.7 * r()), ry: hr * 0.85, z: k + 0.35 + r() * 0.1, head: 0, s: Math.floor(r() * 997), base: sy + th * 0.3, sub: 0, bulge: -1 });
        }
      }
      // (mostly overlapping, a gap of clear air here and there)
      x += len * (wisp ? 0.8 + 0.5 * r() : 0.62 + 0.3 * r()) + (r() < (wisp ? 0.45 : 0.25) ? len * (0.15 + 0.35 * r()) : 0);
    }
  }
  return { L, H: [{ cx: 0, w: W, h: HH, tower: 0, base: 0, z: 0, flat: 0.5 }], B: [] };
}

/** The lobes of a cloud (in its own level-1 px, y negative up), built once per cloud. */
function lobesOf(p: CloudP, seed: number): { L: Lobe[]; H: Head[]; B: Bulge[] } {
  return cached(`cl6b|${seed}|${p.kind ?? ""}|${p.w}|${p.h}|${p.tower ?? ""}|${p.low ? 1 : 0}|${p.heaps ?? ""}`, () => (isLayer(p) ? layerLobes(p, seed) : heapLobes(p, seed)));
}

/** A cloud as fields on its level-1 grid: which lobe is in front, its tone, how solid, its warmth. */
interface CloudMask { x0: number; y0: number; w: number; h: number; own: Int32Array; t: Float32Array; a: Float32Array; warm: Float32Array; seam: Float32Array }

/** Three box passes (about a gaussian) of radius r over a w x h field, in place. */
function blur3(f: Float32Array, w: number, h: number, r: number): void {
  if (r < 1) return;
  const t = new Float32Array(Math.max(w, h));
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += f[y * w + Math.min(w - 1, Math.max(0, x))]!;
      for (let x = 0; x < w; x++) {
        t[x] = acc / (2 * r + 1);
        acc += f[y * w + Math.min(w - 1, x + r + 1)]! - f[y * w + Math.max(0, x - r)]!;
      }
      for (let x = 0; x < w; x++) f[y * w + x] = t[x]!;
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += f[Math.min(h - 1, Math.max(0, y)) * w + x]!;
      for (let y = 0; y < h; y++) {
        t[y] = acc / (2 * r + 1);
        acc += f[Math.min(h - 1, y + r + 1) * w + x]! - f[Math.max(0, y - r) * w + x]!;
      }
      for (let y = 0; y < h; y++) f[y * w + x] = t[y]!;
    }
  }
}

/** Chamfer distance to the nearest px outside a mask (0 outside). */
function chamfer(inside: (i: number) => boolean, w: number, h: number): Float32Array {
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = inside(i) ? 1e6 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!dist[i]) continue;
    let v = Math.min(dist[i]!, x > 0 ? dist[i - 1]! + 1 : 1, y > 0 ? dist[i - w]! + 1 : 1);
    if (x > 0 && y > 0) v = Math.min(v, dist[i - w - 1]! + 1.41);
    if (x < w - 1 && y > 0) v = Math.min(v, dist[i - w + 1]! + 1.41);
    dist[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!dist[i]) continue;
    let v = Math.min(dist[i]!, x < w - 1 ? dist[i + 1]! + 1 : 1, y < h - 1 ? dist[i + w]! + 1 : 1);
    if (x < w - 1 && y < h - 1) v = Math.min(v, dist[i + w + 1]! + 1.41);
    if (x > 0 && y < h - 1) v = Math.min(v, dist[i + w - 1]! + 1.41);
    dist[i] = v;
  }
  return dist;
}

function cloudMask(p: CloudP, seed: number, f: number): CloudMask {
  return cached(`cm6b|${seed}|${p.kind ?? ""}|${p.w}|${p.h}|${p.tower ?? ""}|${p.low ? 1 : 0}|${p.heaps ?? ""}|${p.haze ?? 0}|${f}`, () => {
    // the lobes this frame: each swelling and settling a little (the heap churns as it drifts)
    const { L: L0, H: HD, B: BG } = lobesOf(p, seed);
    const L = L0.map((b, i) => {
      const k = 1 + 0.03 * Math.sin(f * 1.57 + i * 1.7);
      return { ...b, rx: b.rx * k, ry: b.ry * k };
    });
    const layer = isLayer(p);
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const b of L) {
      bx0 = Math.min(bx0, b.x - b.rx * 1.2); bx1 = Math.max(bx1, b.x + b.rx * 1.2);
      by0 = Math.min(by0, b.y - b.ry * 1.2); by1 = Math.max(by1, Math.min(b.base + 3, b.y + b.ry * 1.2));
    }
    const x0 = Math.floor(bx0) - 2, y0 = Math.floor(by0) - 2;
    const w = Math.ceil(bx1) - x0 + 3, h = Math.ceil(by1) - y0 + 3;
    const own = new Int32Array(w * h).fill(-1);
    const zb = new Float32Array(w * h).fill(-1e9);
    const NX = new Float32Array(w * h), NY = new Float32Array(w * h), U = new Float32Array(w * h);
    // (the base is flat-ish: it wanders a px or two, and at the cloud's scale, never ruled)
    const BW = Math.max(6, -by0 * 0.5);
    const baseAt = (x: number, b: number): number => b - 1.4 * vnoise1(x / 23, seed + 33) - 0.9 * vnoise1(x / 7, seed + 34) + (vnoise1(x / BW, seed + 35) - 0.55) * BW * 0.16;
    L.forEach((b, i) => {
      const hz = HD[b.head]!.z * 100;
      const gx0 = Math.max(0, Math.floor(b.x - b.rx * 1.2 - x0)), gx1 = Math.min(w - 1, Math.ceil(b.x + b.rx * 1.2 - x0));
      const gy0 = Math.max(0, Math.floor(b.y - b.ry * 1.2 - y0)), gy1 = Math.min(h - 1, Math.ceil(b.y + b.ry * 1.2 - y0));
      const strand = b.sub === 3;
      for (let gy = gy0; gy <= gy1; gy++) {
        const py = y0 + gy + 0.5;
        for (let gx = gx0; gx <= gx1; gx++) {
          const px = x0 + gx + 0.5;
          if (py > baseAt(px, b.base)) continue;
          const dx = (px - b.x) / b.rx, dy = (py - b.y) / b.ry;
          const ang = Math.atan2(dy, dx);
          let rr = 1 + 0.12 * (vnoise1(ang * 2.2 + b.s, seed + 41) - 0.5) + 0.07 * (vnoise1(ang * 6.5 + b.s, seed + 42) - 0.5);
          if (strand) {
            // a strand thins toward its ends, and they tear into rags (holes at the cloud's own
            // scale, never single px)
            const u = Math.abs(dx);
            if (u > 0.5 && vnoise((px - b.x) / 5 + b.s, py / 3, seed + 43) > 1.05 - (u - 0.5) * 1.1) continue;
            rr *= 1 - 0.25 * Math.max(0, u - 0.6);
          }
          const q = (dx * dx + dy * dy) / (rr * rr);
          if (q > 1) continue;
          const k = gy * w + gx;
          const z = hz + b.z + (1 - q) * 0.04;
          if (z > zb[k]!) { zb[k] = z; own[k] = i; NX[k] = dx / rr; NY[k] = dy / rr; U[k] = strand ? Math.abs(dx) : 0; }
        }
      }
    });
    // no sky through the heap: a hole between lobes (sky not reached from outside it) takes the
    // lobe beside it, facing the viewer
    {
      const out = new Uint8Array(w * h);
      const q: number[] = [];
      for (let x = 0; x < w; x++) { q.push(x, (h - 1) * w + x); }
      for (let y = 0; y < h; y++) { q.push(y * w, y * w + w - 1); }
      while (q.length) {
        const i = q.pop()!;
        if (out[i] || own[i]! >= 0) continue;
        out[i] = 1;
        const x = i % w, y = (i - x) / w;
        if (x > 0) q.push(i - 1);
        if (x < w - 1) q.push(i + 1);
        if (y > 0) q.push(i - w);
        if (y < h - 1) q.push(i + w);
      }
      for (let pass = 0, left = 1; left && pass < 64; pass++) {
        left = 0;
        for (let i = w; i < w * h - w; i++) {
          if (out[i] || own[i]! >= 0) continue;
          const n = own[i - 1]! >= 0 ? i - 1 : own[i + 1]! >= 0 ? i + 1 : own[i - w]! >= 0 ? i - w : own[i + w]! >= 0 ? i + w : -1;
          if (n < 0) { left++; continue; }
          own[i] = own[n]!; NX[i] = 0; NY[i] = 0.2;
        }
      }
    }
    // no slivers: a lobe showing only as a 1 px crack between two of its neighbours that agree
    // takes their lobe (a painted cloud has no hairline fissures)
    for (let pass = 0; pass < 2; pass++) {
      for (let gy = 1; gy < h - 1; gy++) for (let gx = 1; gx < w - 1; gx++) {
        const k = gy * w + gx, o = own[k]!;
        if (o < 0) continue;
        const l = own[k - 1]!, r = own[k + 1]!, u = own[k - w]!, d = own[k + w]!;
        if (l >= 0 && l === r && l !== o) { own[k] = l; NX[k] = (NX[k - 1]! + NX[k + 1]!) / 2; NY[k] = (NY[k - 1]! + NY[k + 1]!) / 2; continue; }
        if (u >= 0 && u === d && u !== o) { own[k] = u; NX[k] = (NX[k - w]! + NX[k + w]!) / 2; NY[k] = (NY[k - w]! + NY[k + w]!) / 2; }
      }
    }
    const dist = chamfer((i) => own[i]! >= 0, w, h);
    const Htot = Math.max(8, -y0);
    // how far the sunlight travels through the cloud to reach each px (on a 2 px grid, blurred):
    // the heap's lower right lies in its own shade
    const G = 2, gw = Math.ceil(w / G), gh = Math.ceil(h / G);
    const ins = (gx: number, gy: number): boolean => own[Math.min(h - 1, gy * G) * w + Math.min(w - 1, gx * G)]! >= 0;
    const lg = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      if (!ins(gx, gy)) continue;
      let len = 0;
      for (let s = 1; s < 260; s++) {
        const sx = Math.round(gx + SUN[0] * 1.15 * s), sy = Math.round(gy + SUN[1] * 1.15 * s);
        if (sx < 0 || sy < 0 || sx >= gw || sy >= gh) break;
        if (ins(sx, sy)) len = s * G;
      }
      lg[gy * gw + gx] = len;
    }
    blur3(lg, gw, gh, Math.max(2, Math.round(Htot * 0.03)));
    const haze = clamp(p.haze ?? 0, 0, 1);
    const t = new Float32Array(w * h);
    const a = new Float32Array(w * h);
    const warm = new Float32Array(w * h);
    // (the depth of shade a heap reaches: a thin layer never goes dark)
    const reach = layer ? Math.max(6, Htot * 0.9) : Htot * 0.55;
    const deepAt = (gx: number, gy: number): number => clamp(lg[Math.min(gh - 1, Math.floor(gy / G)) * gw + Math.min(gw - 1, Math.floor(gx / G))]! / reach + (vnoise(gx / (Htot * 0.14 + 4), gy / (Htot * 0.12 + 4), seed + 47) - 0.5) * 0.1, 0, 1);
    // each lobe is shaded as one form by where it sits in the heap's shade (the painter's way: the
    // steps of the big shade follow the lobes' outlines, never a smooth airbrushed ramp)
    const dSum = new Float32Array(L.length), dN = new Float32Array(L.length);
    for (let gy = 1; gy < h - 1; gy++) for (let gx = 1; gx < w - 1; gx++) {
      const i = own[gy * w + gx]!;
      if (i < 0) continue;
      dSum[i]! += deepAt(gx, gy);
      dN[i]! += 1;
    }
    for (let gy = 1; gy < h - 1; gy++) for (let gx = 1; gx < w - 1; gx++) {
      const k = gy * w + gx;
      const i = own[k]!;
      if (i < 0) continue;
      const b = L[i]!, H = HD[b.head]!;
      // the lobe's own ball in the sun: its lit cap, its turning face, its shaded belly
      const nx = NX[k]!, ny = NY[k]!;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lam = SUN[0] * nx + SUN[1] * ny + SUN[2] * nz;
      const shadeL = (1 - lam) / 2;
      // the big form's light: the bulge it belongs to, a ball in the sun
      let shadeB = shadeL, upB = 0;
      if (b.bulge >= 0) {
        const [qx, qy, qr] = BG[b.bulge]!;
        let ux = (x0 + gx + 0.5 - qx) / qr, uy = (y0 + gy + 0.5 - qy) / qr;
        const ul = Math.hypot(ux, uy);
        if (ul > 0.98) { ux *= 0.98 / ul; uy *= 0.98 / ul; }
        const uz = Math.sqrt(Math.max(0, 1 - ux * ux - uy * uy));
        shadeB = (1 - (SUN[0] * ux + SUN[1] * uy + SUN[2] * uz)) / 2;
        upB = Math.max(0, -uy);
      }
      // (in the light each lobe takes one value of the big shade, so its outline reads; deep in the
      // shade the big shade runs smooth across them, so their edges are lost)
      const dp = deepAt(gx, gy);
      const wl = 0.7 * clamp(1.15 - dp * 1.3, 0, 1);
      const deep = (1 - wl) * dp + wl * (dSum[i]! / Math.max(1, dN[i]!));
      const py = y0 + gy + 0.5;
      const low = layer ? 0 : clamp(1 - (b.base - py) / Math.max(4, H.h * 0.6), 0, 1);
      // (in the cloud's own shade the lobes merge: lost edges; in the sun each one reads)
      const lit = Math.pow(1 - deep, 1.6);
      // (the tops of the heads in the cloud's shade still take the sky's light: each reads as a form)
      let tt = 0.02 + (layer ? 0.44 * shadeL : 0.28 * shadeB + 0.2 * shadeL) * (0.38 + 0.62 * lit) + (layer ? 0.3 : 0.52) * deep - 0.1 * upB * deep + 0.12 * low * low + (layer ? 0.1 + 0.2 * Math.max(0, ny) : 0);
      // a nearer lobe just below: this one's belly over it lies in a short contact shade, so the
      // nearer lobe's lit top stands crisp against it
      const dk = Math.max(2, Math.min(6, b.ry * 0.3));
      const zi = H.z * 100 + b.z;
      for (let dy = 1; dy <= dk && gy + dy < h; dy++) {
        const j = own[(gy + dy) * w + gx]!;
        if (j < 0 || j === i) continue;
        const o = L[j]!;
        if (HD[o.head]!.z * 100 + o.z > zi + 0.2) { tt += (o.head !== b.head ? 0.12 * (0.3 + 0.7 * lit) : 0.09 * lit) * (1 - (dy - 1) / (dk + 1)); break; }
      }
      // the flat base: its lowest rows turn into the shade (no sunlit cream right down to the
      // floor of the cloud)
      if (!layer && py > b.base - 6) tt += 0.1 * (1 - (b.base - py) / 6);
      // distance: low clouds sit in the haze (less contrast, lighter)
      tt = tt * (1 - 0.45 * haze) + 0.16 * haze;
      t[k] = clamp(tt, 0, 0.999);
      // the warm light thrown up from the land and the lake into the lowest lobes' shade: a soft
      // gradient, strongest at the floor of the cloud and in the deepest shade, fading up
      warm[k] = layer ? 0 : clamp((low - 0.45) / 0.55, 0, 1) * clamp((tt - 0.5) / 0.2, 0, 1) * (0.4 + 0.6 * clamp(0.2 - lam, 0, 1));
      // how solid: the shaded outline is lost into the sky by a cell of dither, a strand's ends
      // thin out; the lit outline stays crisp
      let al = 1;
      if (dist[k]! <= 1.01 && lam < 0.12) al = lam < -0.35 ? 0.4 : 0.6;
      if (U[k]! > 0.8 && dist[k]! <= 2.01) al = Math.min(al, 0.5);
      // (a strand's underside is soft: its lower outline lost)
      if (b.sub === 3 && ny > 0.3 && dist[k]! <= 1.01) al = Math.min(al, 0.45);
      a[k] = al;
    }
    // the dither seam where two steps meet: about a px and a half wide whatever the tone's slope
    // (a slow ramp across a big lobe would otherwise dither a broad screen door)
    const seam = new Float32Array(w * h);
    for (let gy = 1; gy < h - 1; gy++) for (let gx = 1; gx < w - 1; gx++) {
      const k = gy * w + gx;
      if (own[k]! < 0) continue;
      const g = Math.max(Math.abs(t[k + 1]! - t[k - 1]!), Math.abs(t[k + w]! - t[k - w]!)) * 0.5;
      seam[k] = clamp(g * 1.5, 0.003, 0.022);
    }
    return { x0, y0, w, h, own, t, a, warm, seam };
  });
}

/** The tone steps, light to dark, and where each begins on the tone scale. */
const CLOUD_AT = [0, 0.14, 0.24, 0.35, 0.47, 0.6, 0.73, 0.86];
/** The warm bounce in the base's shade: steps 5 and 6 turn to the ramp's two warm greys. */
const BOUNCE: Record<number, number> = { 5: 8, 6: 9 };

/**
 * Paints a cloud from its mask: flat steps of the cumulus ramp (the warm cream and peach only
 * where the sun strikes, neutral cool greys turning away, the cool grey base with a warm bounce
 * in its lowest shade), one cell of dither only in a narrow band where two steps meet, on the lost
 * outline and in the bounce's gradient; cells are the level's own.
 */
function paintCloud(c: PaintCtx, p: CloudP): void {
  const b = c.buf, kc = Math.max(1, Math.round(c.d));
  const f = (p.frame ?? 0) & 3;
  const M = cloudMask(p, c.seed, f);
  const R = P.cumulus;
  const X0 = Math.max(b.ox, Math.floor(c.X(M.x0))), X1 = Math.min(b.x1, Math.ceil(c.X(M.x0 + M.w)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(M.y0))), Y1 = Math.min(b.y1, Math.ceil(c.Y(M.y0 + M.h)));
  for (let y = Y0; y < Y1; y++) {
    const gy = Math.floor(c.ly(y + 0.5) - M.y0);
    if (gy < 0 || gy >= M.h) continue;
    for (let x = X0; x < X1; x++) {
      const gx = Math.floor(c.lx(x + 0.5) - M.x0);
      if (gx < 0 || gx >= M.w) continue;
      const k = gy * M.w + gx;
      if (M.own[k]! < 0) continue;
      const dith = bay(x + f * kc, y, kc);
      if (M.a[k]! < 1 && dith >= M.a[k]!) continue;
      const t = M.t[k]!;
      let i = 0;
      while (i + 1 < CLOUD_AT.length && t >= CLOUD_AT[i + 1]!) i++;
      const near = ((CLOUD_AT[i + 1] ?? 2) - t) / M.seam[k]!;
      if (near < 1 && dith > near) i = Math.min(CLOUD_AT.length - 1, i + 1);
      // (the bounce in flat patches with a narrow dithered seam: a gradient by its steps, never a
      // screen door)
      const wm = M.warm[k]!;
      if (BOUNCE[i] !== undefined && (wm > 0.66 || (wm > 0.5 && dith < (wm - 0.5) / 0.16))) i = BOUNCE[i]!;
      b.set(x, y, R[i]!);
    }
  }
}

export const cloud = definePainter<CloudP>("op.cloud", {
  bounds(p) {
    const hx = cloudReach(p) + 6;
    const up = p.kind === "wisp" ? 2.4 : isLayer(p) ? 1.9 : 1.45;
    return [-hx, -p.h * up - 6, hx, p.h * 0.14 + 8];
  },
  paint(c, p) {
    paintCloud(c, p);
  },
});

export interface IsleP {
  /** Width of the isle's top and depth of the rock under it, px; anchor at the middle of its top. */
  w: number;
  h: number;
  tower: "bell" | "drum";
  /** Bob frame (0..7): the isle rises and settles a pixel or two over the cycle. */
  frame?: number;
}

/**
 * A block of the isle's rock: bedded limestone broken along its joints (Dex's chunk sketch, upside
 * down): [left, right, top, bottom] in level-1 px, and its tier (0 under the top).
 */
interface Block { x0: number; x1: number; y0: number; y1: number; tier: number; s: number; slant: number; cut: number }

/**
 * The rock under the top as stacked chunks: a broad slab under the turf, then tiers of blocks of
 * very different widths and depths stepping inward as they go down, offset from each other, so
 * the underside is an upside-down stepped crag ending in two or three hanging blocks (never
 * icicles, never a cone).
 */
function isleBlocks(p: IsleP, seed: number): Block[] {
  return cached(`isle3|${seed}|${p.w}|${p.h}`, () => {
    const r = rng(seed + 11);
    const out: Block[] = [];
    const W = p.w, H = p.h;
    // the slab under the turf: the full width, its ends broken back a little
    out.push({ x0: -W / 2 + W * 0.02 * r(), x1: W / 2 - W * 0.03 * r(), y0: -2, y1: H * (0.14 + 0.05 * r()), tier: 0, s: Math.floor(r() * 999), slant: 0, cut: 2 });
    let lo = -W / 2 + W * (0.06 + 0.06 * r()), hi = W / 2 - W * (0.04 + 0.08 * r());
    let y = out[0]!.y1 - 1;
    for (let tier = 1; tier < 6 && hi - lo > W * 0.12 && y < H * 0.9; tier++) {
      // one to three blocks side by side across what is left, each of its own depth
      const n = hi - lo > W * 0.5 ? 2 + Math.floor(r() * 2) : hi - lo > W * 0.25 ? 1 + Math.floor(r() * 2) : 1;
      const cuts = [lo];
      for (let i = 1; i < n; i++) cuts.push(lo + ((hi - lo) * (i + (r() - 0.5) * 0.5)) / n);
      cuts.push(hi);
      let deepest = y;
      for (let i = 0; i < n; i++) {
        const a = cuts[i]! + (i ? 0 : 0), b = cuts[i + 1]! - 1;
        const d = H * (0.1 + 0.14 * r()) * (1 + 0.25 * (tier === 1 ? 1 : 0));
        out.push({ x0: a, x1: b, y0: y - 1, y1: y + d, tier, s: Math.floor(r() * 999), slant: (r() - 0.6) * 0.3, cut: Math.min(b - a, d) * (0.12 + 0.2 * r()) });
        deepest = Math.max(deepest, y + d);
      }
      // the next tier steps in from both sides by different amounts, mostly from the right (the
      // heavier mass hangs under the sunlit left, where the longest pendant falls)
      const w = hi - lo;
      lo += w * (0.06 + 0.16 * r());
      hi -= w * (0.12 + 0.2 * r());
      y += (deepest - y) * (0.55 + 0.25 * r());
    }
    // two or three pendant blocks hanging from the last tier, of very different lengths
    const np = 2 + Math.floor(r() * 2);
    for (let i = 0; i < np; i++) {
      const cx = lo + (hi - lo) * ((i + 0.25 + 0.5 * r()) / np);
      const hw = Math.max(3, (hi - lo) * (0.12 + 0.12 * r()));
      const d = H * (i === 0 ? 0.16 + 0.14 * r() : 0.06 + 0.1 * r());
      out.push({ x0: cx - hw, x1: cx + hw, y0: y - 2, y1: Math.min(H * 1.02, y + d), tier: 9, s: Math.floor(r() * 999), slant: (r() - 0.5) * 0.4, cut: hw * (0.3 + 0.3 * r()) });
    }
    return out;
  });
}

/** The isle's top at lx: a low mound, higher toward the middle (px above its anchor, negative up). */
function isleTop(p: IsleP, lx: number, seed: number): number {
  const u = lx / (p.w / 2);
  return -p.w * 0.08 * (1 - u * u) - 2.5 * vnoise1(lx / 9, seed + 2) - 1.2 * vnoise1(lx / 3, seed + 12) + 2;
}

/** Which block is in front at (lx, ly): the upper tiers overhang the lower ones. */
function blockAt(B: Block[], lx: number, ly: number, seed: number): number {
  let best = -1;
  for (let i = 0; i < B.length; i++) {
    const b = B[i]!;
    // (edges wander at two scales and lean a little; the corners broken off: hand-broken
    // chunks, never ruled boxes)
    const v = (ly - b.y0) / Math.max(1, b.y1 - b.y0);
    // (round 5, the critic: "flat-value stacked cubes") each hanging block tapers as it hangs, its
    // right side drawn in more than its left
    const tp = b.tier === 0 ? 0 : (b.x1 - b.x0) * (b.tier === 9 ? 0.32 : 0.14) * Math.pow(Math.max(0, v), 1.3);
    const e = (vnoise1(ly / 3 + b.s, seed + 21) - 0.5) * 1.6 + (vnoise1(ly / 11 + b.s, seed + 24) - 0.5) * 2.4 - b.slant * (b.y1 - b.y0) * v + tp * 0.4;
    const e2 = (vnoise1(ly / 3 + b.s + 50, seed + 21) - 0.5) * 1.6 + (vnoise1(ly / 11 + b.s + 50, seed + 24) - 0.5) * 2.4 + b.slant * (b.y1 - b.y0) * v + tp * 0.6;
    const f = (vnoise1(lx / 3 + b.s, seed + 22) - 0.5) * 1.4 + (vnoise1(lx / 13 + b.s, seed + 25) - 0.5) * 3;
    if (lx < b.x0 + e || lx >= b.x1 - e2 || ly < b.y0 || ly >= b.y1 + f) continue;
    // (the lower corners chipped away)
    const cl = lx - (b.x0 + e), cr = b.x1 - e2 - lx, cb = b.y1 + f - ly;
    if (Math.min(cl, cr) + cb < b.cut) continue;
    if (best < 0 || b.tier < B[best]!.tier) best = i;
  }
  return best;
}

/** A pine on the isle seen far off: a trunk and two to four flat pads of needles, lit on top. */
function islePine(c: PaintCtx, x: number, y: number, hgt: number, seed: number): void {
  const b = c.buf, R = P.pine;
  const r = rng(seed);
  const lean = (r() - 0.5) * 0.5;
  for (let a = 0; a < hgt * 0.7; a += 0.5 / c.d) b.set(Math.floor(c.X(x + lean * a)), Math.floor(c.Y(y - a)), P.timber[5]!);
  const pads = 2 + Math.floor(r() * 3);
  for (let i = 0; i < pads; i++) {
    const py = y - hgt * (0.35 + (0.6 * i) / pads), px = x + lean * hgt * (0.35 + (0.6 * i) / pads) + (r() - 0.5) * 3;
    const hw = hgt * (0.38 - i * 0.07) * (0.8 + 0.4 * r()), th = Math.max(1.5, hgt * 0.13);
    for (let Y = Math.floor(c.Y(py - th)); Y < Math.ceil(c.Y(py + th * 0.5)); Y++) {
      const ly = c.ly(Y + 0.5) - py;
      for (let X = Math.floor(c.X(px - hw)); X < Math.ceil(c.X(px + hw)); X++) {
        const lx = c.lx(X + 0.5) - px;
        const k = Math.abs(lx) / hw + (ly < 0 ? -ly / th : (ly / (th * 0.5)) * 0.9);
        if (k > 1 + 0.25 * (vnoise1((X + Y * 3) / 2.5, seed + 3) - 0.5)) continue;
        b.set(X, Y, ly < -th * 0.45 && lx < hw * 0.3 ? R[0]! : ly > th * 0.1 ? R[3]! : R[1]!);
      }
    }
  }
}

/** A clump of shrubs and small trees on the turf: rounded masses lit on their upper left. */
function isleClump(c: PaintCtx, cx: number, cy: number, rad: number, seed: number): void {
  const b = c.buf;
  const X0 = Math.floor(c.X(cx - rad * 1.3)), X1 = Math.ceil(c.X(cx + rad * 1.3)), Y0 = Math.floor(c.Y(cy - rad * 1.2)), Y1 = Math.ceil(c.Y(cy + rad * 0.5));
  for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
    for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
      const dx = c.lx(x + 0.5) - cx, dy = c.ly(y + 0.5) - cy;
      const ang = Math.atan2(dy, dx);
      const rim = rad * (0.82 + 0.3 * vnoise1(ang * 2.4 + 5, seed));
      if (Math.hypot(dx, dy > 0 ? dy * 1.8 : dy) > rim) continue;
      const lit = Math.hypot(dx + rim * 0.3, dy + rim * 0.4) < rim * 0.62;
      const shade = dx > rim * 0.35 || dy > rim * 0.1;
      b.set(x, y, lit ? P.moss[3]! : shade ? P.pine[2]! : P.moss[4]!);
    }
  }
}

/**
 * A pagoda seen side-on, far off: on a stone plinth, `tiers` storeys diminishing upward, each a
 * body of pale plaster between vermilion corner posts with a warm lit opening and a rail, under
 * swept eaves of grey-blue tiles (a lit ridge and top edge, the tiles' rows, a dark soffit, the
 * eave tips curling up), the eaves' shadow on the wall below them; a gold finial with rings.
 * Anchor: the middle of its plinth's foot; px of the plane.
 */
function pagoda(c: PaintCtx, foot: number, bw0: number, tiers: number, seed: number): void {
  const b = c.buf, d = c.d, R2 = P.range;
  // (the tiles' grey-blue, lifted toward the far air)
  const T = [P.range[1]!, P.tile[0]!, P.tile[1]!, P.tile[2]!, P.tile[3]!, P.tile[3]!];
  const px = (lx: number, ly: number, col: number): void => {
    const X0 = Math.floor(c.X(lx)), Y0 = Math.floor(c.Y(ly));
    b.set(X0, Y0, col);
  };
  const rect = (x0: number, x1: number, y0: number, y1: number, col: (lx: number, ly: number) => number): void => {
    for (let Y = Math.floor(c.Y(y0)); Y < Math.ceil(c.Y(y1)); Y++) {
      const ly = c.ly(Y + 0.5);
      for (let X = Math.floor(c.X(x0)); X < Math.ceil(c.X(x1)); X++) b.set(X, Y, col(c.lx(X + 0.5), ly));
    }
  };
  // the plinth: two steps of cut stone, lit on top and left
  const pw = bw0 * 0.62 + 2, ph = Math.max(2, bw0 * 0.08);
  rect(-pw, pw, foot - ph, foot, (lx, ly) => (ly < foot - ph + 1 / d ? P.stone[1]! : lx < -pw + 1.5 ? P.stone[2]! : lx > pw * 0.4 ? P.stone[4]! : P.stone[3]!));
  let y = foot - ph;
  let bw = bw0;
  for (let t = 0; t < tiers; t++) {
    const bh = bw * (t === 0 ? 0.5 : 0.42);
    const half = bw / 2;
    // the storey's body: plaster between posts, a warm opening, a rail along its foot
    rect(-half, half, y - bh, y, (lx, ly) => {
      const u = (lx + half) / bw, v = (y - ly) / bh;
      // (in the far air: the vermilion and the plaster a step paler, the shade cool)
      if (u < 0.1 || u > 0.9) return u < 0.05 ? P.red[1]! : u > 0.9 ? P.red[3]! : P.red[2]!;
      if (v < 0.14) return ly > y - 1 / d ? R2[4]! : P.red[2]!;
      if (Math.abs(u - 0.5) < 0.12 && v > 0.22 && v < 0.7) return v > 0.6 ? P.ember[1]! : P.ember[0]!;
      if (Math.abs(u - 0.5) < 0.17 && v > 0.2 && v < 0.74) return R2[4]!;
      return u > 0.6 ? R2[1]! : P.paper[1]!;
    });
    // the eaves' shadow on the wall just under them
    rect(-half + 1, half - 1, y - bh, y - bh + Math.max(1, bh * 0.16), (lx) => (lx < -half * 0.8 || lx > half * 0.8 ? P.red[3]! : R2[3]!));
    y -= bh;
    // the roof: swept eaves overhanging the body, tips curling up, ridge on top
    const ov = bw * (0.3 + 0.04 * t), rh = bw * 0.3;
    const rw = half + ov;
    for (let Y = Math.floor(c.Y(y - rh - 1)); Y < Math.ceil(c.Y(y + 1)); Y++) {
      const ly = c.ly(Y + 0.5);
      for (let X = Math.floor(c.X(-rw - 1)); X < Math.ceil(c.X(rw + 1)); X++) {
        const lx = c.lx(X + 0.5);
        const u = Math.abs(lx) / rw;
        if (u > 1) continue;
        // the eave line: up at the tips; the roof's top: a concave sweep from the ridge
        const under = y - Math.pow(u, 4) * rh * 0.45;
        const top = y - rh * (1 - Math.pow(u, 0.6)) - Math.pow(u, 5) * rh * 0.55 - rh * 0.22;
        if (ly < top || ly > under) continue;
        const fromTop = (ly - top) * d, fromUnder = (under - ly) * d;
        let col = T[2]!;
        if (fromUnder < 1.5) col = T[5]!;
        else if (fromTop < 1.2) col = lx < rw * 0.25 ? T[0]! : T[1]!;
        else if (lx > rw * 0.3) col = T[3]!;
        // (rows of tiles: a darker course every few px)
        else if (Math.floor((ly - top) / Math.max(2, rh * 0.28)) % 2 === 1 && fromUnder > 2) col = T[3]!;
        b.set(X, Y, col);
      }
    }
    // the eave tips: a gold fleck where each curls up
    px(-rw + 0.5, y - rh * 0.45 - 0.5, P.gold[2]!);
    px(rw - 0.5, y - rh * 0.45 - 0.5, P.gold[3]!);
    y -= rh * 0.85;
    bw *= 0.74;
  }
  // the finial: a gold spire with rings
  const fh = bw0 * 0.42;
  for (let a = 0; a < fh; a += 0.5 / d) {
    const ring = Math.floor((a / fh) * 6) % 2 === 0 && a < fh * 0.7;
    b.set(Math.floor(c.X(0)), Math.floor(c.Y(y - a)), a > fh * 0.85 ? P.gold[1]! : ring ? P.gold[2]! : P.gold[3]!);
    if (ring && a < fh * 0.6) b.set(Math.floor(c.X(-1)), Math.floor(c.Y(y - a)), P.gold[1]!);
  }
  void seed;
}

export const isle = definePainter<IsleP>("op.isle", {
  bounds(p) {
    return [-p.w / 2 - 30, -p.w * 1.15 - 3, p.w / 2 + 30, p.h + 93];
  },
  paint(c0, p) {
    // the bob: a whole-pixel rise and settle (eased), the isle drifting on the air
    const bob = Math.round(Math.sin(((p.frame ?? 0) / 8) * Math.PI * 2) * 1.5);
    const c: PaintCtx = { ...c0, ay: c0.ay + bob, Y: (v: number) => c0.Y(v) + bob, ly: (v: number) => c0.ly(v - bob) };
    const b = c.buf, d = c.d, seed = c.seed, K = Math.max(1, Math.round(d));
    const R = P.range, KA = P.karst;
    const B = isleBlocks(p, seed);
    let bot = 0;
    for (const bl of B) bot = Math.max(bot, bl.y1);
    // the rock: chunks of bedded limestone in the far air's values. Each block lit on its left
    // face and its exposed top ledge (moss on the ledges only), shaded on its right, a bedding
    // line or two across it, darkest under each overhang and along its underside, where the
    // jade of the lake below bounces faintly into the very bottom
    const X0 = Math.max(b.ox, Math.floor(c.X(-p.w / 2 - 2))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w / 2 + 2)));
    const Y0 = Math.max(b.oy, Math.floor(c.Y(-4))), Y1 = Math.min(b.y1, Math.ceil(c.Y(bot + 3)));
    for (let Y = Y0; Y < Y1; Y++) {
      const ly = c.ly(Y + 0.5);
      for (let X = X0; X < X1; X++) {
        const lx = c.lx(X + 0.5);
        const i = blockAt(B, lx, ly, seed);
        if (i < 0) continue;
        const bl = B[i]!;
        const u = (lx - bl.x0) / Math.max(1, bl.x1 - bl.x0), v = (ly - bl.y0) / Math.max(1, bl.y1 - bl.y0);
        // light: the left face and the top lit, the right and the underside in shade
        // (flat planes, not a gradient: the lit face, the front, the shaded side, in steps)
        const wob = (vnoise1(ly / 5 + bl.s, seed + 26) - 0.5) * 0.12;
        // (round 5: a lit left face, the front turning, a dark right side: never one flat value)
        let t = 0.34 + (u + wob < 0.22 ? -0.22 : u + wob > 0.66 ? 0.26 : (u - 0.44) * 0.3) + (v > 0.62 ? 0.1 : 0) + 0.04 * Math.min(4, bl.tier);
        // the overhang's shadow: under a block of an upper tier
        if (blockAt(B, lx, ly - 3, seed) >= 0 && B[blockAt(B, lx, ly - 3, seed)]!.tier < bl.tier) t += 0.18;
        // the block's own underside, a step darker
        if (bl.y1 - ly < 2.2) t += 0.16;
        // bedding: a darker course or two across the block, broken
        const bed = (ly - bl.y0) / Math.max(4, (bl.y1 - bl.y0) * 0.45);
        if (Math.abs(bed - Math.round(bed)) * Math.max(4, (bl.y1 - bl.y0) * 0.45) < 0.6 / d && bed > 0.5 && vnoise1(lx / 2.5 + bl.s, seed + 23) > 0.55) t += 0.12;
        // a joint between two blocks side by side
        if ((lx - bl.x0 < 1 / d || bl.x1 - lx < 1 / d) && bl.tier > 0) t += 0.2;
        // the exposed top ledge of a lower block: lit, mossed
        const above = blockAt(B, lx, ly - 1.5, seed);
        if (above < 0 && bl.tier > 0 && ly - bl.y0 < 2.4) { b.set(X, Y, u < 0.7 ? P.moss[4]! : P.moss[5]!); continue; }
        if (above < 0 && bl.tier > 0 && ly - bl.y0 < 3.6) { b.set(X, Y, R[1]!); continue; }
        t = clamp(t, 0, 0.999);
        const steps = [KA[2]!, R[2]!, R[3]!, R[4]!, R[5]!, R[6]!];
        const k = Math.floor(t * steps.length);
        // (the bounce: the very bottom of the lowest blocks a jade-grey, faint)
        if (bl.tier === 9 && bl.y1 - ly < 1.2) { b.set(X, Y, P.jade[5]!); continue; }
        b.set(X, Y, steps[Math.min(steps.length - 1, k)]!);
      }
    }
    // roots and a vine or two hanging from the overhangs, fraying
    for (const bl of B) {
      if (bl.tier === 0 || hash1(bl.s, seed + 4) < 0.45) continue;
      const rx = bl.x0 + (bl.x1 - bl.x0) * (0.2 + 0.6 * hash1(bl.s, seed + 5));
      const len = 4 + 12 * hash1(bl.s, seed + 6);
      for (let a = 0; a < len; a += 0.5 / d) {
        const X = Math.floor(c.X(rx + Math.sin(a / 4 + bl.s) * 0.7)), Y = Math.floor(c.Y(bl.y1 - 0.5 + a));
        if (a > len * 0.6 && bay(X, Y, K) < 0.5) continue;
        if (b.get(X, Y) && a < 1) continue;
        b.set(X, Y, a < len * 0.4 ? P.moss[5]! : R[5]!);
      }
    }
    // the turf over the slab: a mossy cap following the mound, its edge breaking over the lip
    for (let X = X0; X < X1; X++) {
      const lx = c.lx(X + 0.5);
      if (Math.abs(lx) > p.w / 2 - 1) continue;
      const top = isleTop(p, lx, seed);
      const cap = 2.2 + 2.5 * vnoise1(lx / 5, seed + 8) + (lx < -p.w * 0.3 ? 2.5 * vnoise1(lx / 3, seed + 9) : 0);
      for (let Y = Math.floor(c.Y(top)); Y < Math.ceil(c.Y(Math.max(top + cap, -1))); Y++) {
        const a = c.ly(Y + 0.5) - top;
        b.set(X, Y, a < 1 / d ? P.moss[2]! : a < cap * 0.5 ? P.moss[3]! : P.moss[5]!);
      }
      // the turf's face down to the slab
      for (let Y = Math.ceil(c.Y(top + cap)); Y < Math.ceil(c.Y(0)); Y++) b.set(X, Y, R[3]!);
    }
    // a thread of water from a spring on top, over the right lip, falling clear of the rock and
    // fraying into a scrap of cloud below
    const fx = p.w * 0.3;
    let lip = 0;
    for (const bl of B) if (fx + 3 >= bl.x0 && fx + 3 < bl.x1) lip = Math.max(lip, bl.y1);
    // (round 5, the critic: "ruler-straight 1 px rules") it wavers on the wind, thick where it
    // leaves the lip, then beads into drops further down and breaks into a drift of spray
    // (round 6, the critic's P11: "still ruled for its first two thirds") it wavers from where it
    // leaves the spring, clinging to the rock and slipping over its bulges down the side, then
    // swinging free on the wind below the lip
    const t0 = isleTop(p, fx, seed);
    for (let ly = t0; ly < lip + 70; ly += 0.5 / d) {
      const below = ly - lip, run = ly - t0;
      const sway = below > 0
        ? Math.sin(below / 9 + seed) * Math.min(2.2, 0.4 + below * 0.05) + (vnoise1(below / 4, seed + 61) - 0.5) * 1.2 + below * 0.05
        : Math.sin(run / 6 + seed * 0.7) * Math.min(1.4, 0.3 + run * 0.05) + (vnoise1(run / 3.2, seed + 64) - 0.5) * 1.3;
      const X = Math.round(c.X(fx + 3 + sway)), Y = Math.round(c.Y(ly));
      if (below > 18) {
        // beads: drops strung out with gaps that grow as it falls
        const per = 4 + below * 0.08;
        if ((below % per) > per * (0.65 - below / 160)) continue;
        if (below > 44) {
          // spray: drops scattered either side, thinning out
          if (hash1(Math.floor(below * 2), seed + 62) > 1 - (below - 44) / 30) continue;
          const off = Math.round((hash1(Math.floor(below * 2), seed + 63) - 0.5) * (below - 40) * 0.25);
          b.set(X + off * K, Y, P.cumulus[2]!);
          continue;
        }
      }
      b.set(X, Y, below > 25 ? P.cumulus[2]! : P.cumulus[0]!);
      if (below < 10 && d >= 1) b.set(X + 1, Y, P.cumulus[3]!);
    }
    // (round 6, the critic's P11: "each ends in a tiny cotton-puff cloud") no scrap of cloud under it:
    // it ends in its own drift of spray
    // trees on the top: pines leaning out over the lip, clumps of shrubs round the tower's foot
    const r = rng(seed + 7);
    const tw = p.w * (p.tower === "bell" ? 0.3 : 0.36);
    for (let i = 0; i < Math.round(p.w / 9); i++) {
      const tx = (r() - 0.5) * p.w * 0.9;
      if (Math.abs(tx) < tw * 0.7) continue;
      const rr = 2.2 + 3.2 * r() * r();
      isleClump(c, tx, isleTop(p, tx, seed) + 1, rr, seed + i * 17);
    }
    // the tower (Bell: three storeys; Drum: two, broader)
    pagoda(c, isleTop(p, 0, seed) + 1, tw, p.tower === "bell" ? 3 : 2, seed + 31);
    // two pines, one each side of it, of their own heights
    islePine(c, -p.w * (0.3 + 0.08 * hash1(1, seed)), isleTop(p, -p.w * 0.34, seed) + 1, p.w * 0.2, seed + 41);
    islePine(c, p.w * (0.24 + 0.1 * hash1(2, seed)), isleTop(p, p.w * 0.28, seed) + 1, p.w * 0.14, seed + 43);
  },
});
