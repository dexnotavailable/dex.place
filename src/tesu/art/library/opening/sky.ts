// The opening's sky (P0): morning clouds and the two sky isles. Clouds are authored in code
// (Dex: clouds, fog, mist and haze are freestyle, never traced).
//
// One cloud family (Kagami round 4, the sky lane; Dex: "shouldn't have like 4 different types or
// shapes"): every cloud, big or small, towering or lying low and flat, is a heap of billows lit by
// the one sun, after Dex's painterly cumulus reference. Its outline is walked by billows of very
// different sizes (a few great, more middling, many small), towers and lower domes of their own
// heights on one low body, the bigger billows sprouting smaller ones round their upper rims
// (cauliflower); its body packed with billows, each lower one in front of the one above it, so
// every billow shows its lit top over the shade of the one behind; a flat-ish base scalloped by a
// few sagging billows; a scrap or two torn off downwind. The light: first the heap's big masses
// (the sun's side lit, the shade travelling down and right through it, the base darkest), then
// each billow's own ball on them (crisp lit caps, softer in the shade where the sky lights it), in
// flat steps of the cumulus ramp: warm cream and peach where the sun strikes, lilac and lavender
// greys turning away, the blue-grey base. Dither only in a narrow seam where two steps meet and a
// cell along the shaded outline; the lit outline is crisp. `haze` lifts far clouds toward the half
// light. `frame` (0..3) swells and settles the billows a little for the drifting sprites.
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
   * One cloud family (Dex, round 4: "shouldn't have like 4 different types or shapes"). Every
   * cloud is built of HEADS of billows lit by the one sun, the same light and the same ramp; its
   * members differ only in how the heads are gathered (round 5, the critic's S9: vary the members,
   * never one lens repeated):
   * - `cumulus`: a few big heads of very different sizes, the tallest left of the middle toward
   *   the sun, a long lower shoulder downwind, a small head upwind;
   * - `tower`: one tall narrow head over a couple of small ones at its foot;
   * - `deck`: a broken band of small flattened heaps low in the sky (stratocumulus);
   * - `wisp`: two to four thin torn strands of flattened billows at slightly different heights,
   *   gaps of clear air between them.
   * The older kinds `stratus` and `field` paint a deck.
   */
  kind?: "cumulus" | "tower" | "deck" | "wisp" | "stratus" | "field";
  /** Width and height of the cloud, px of its plane; anchor at the middle of its base. */
  w: number;
  h: number;
  /** How much a heap towers: 0 a low, flat heap .. 1 a great tower (default 0.75; 0.35 when `low`). */
  tower?: number;
  /** A low heap (the old flag): a tower of 0.35. */
  low?: boolean;
  /** For a deck: how many heaps along it (default from its width). */
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
 * A billow: a ball of cloud seen side-on, [centre, radius, height over width], the head it
 * belongs to, its depth within the head (the lower billows stand in front of the ones above
 * them), the base it is cut off at, a wobble seed (no billow is a compass circle), and whether it
 * is one of the head's big ones (only those keep a crisp edge inside the cloud).
 */
interface Billow { x: number; y: number; r: number; k: number; head: number; z: number; base: number; s: number; big: boolean }

/**
 * One head of a cloud: its middle, size, how much it towers, where its base lies (y, negative up),
 * its depth among the heads (bigger: in front) and how flat its billows are.
 */
interface Head { cx: number; w: number; h: number; tower: number; base: number; z: number; flat: number }

const isDeck = (p: CloudP): boolean => p.kind === "deck" || p.kind === "stratus" || p.kind === "field";

function headsOf(p: CloudP, seed: number): Head[] {
  const r = rng(seed + 7);
  const tower = clamp(p.tower ?? (p.low ? 0.35 : isDeck(p) ? 0.4 : p.kind === "tower" ? 1 : 0.75), 0, 1);
  const W = p.w, HH = p.h;
  if (p.kind === "wisp") {
    // thin strands torn apart by the wind, overlapping one another at different heights (layers
    // of stratus shredding), each of its own length and thickness, the ends frayed into scraps
    const n = 3 + Math.floor(r() * 2);
    const out: Head[] = [];
    for (let i = 0; i < n; i++) {
      const w = W * (0.3 + 0.3 * r());
      const u = n > 1 ? i / (n - 1) : 0.5;
      const cx = -W / 2 + w / 2 + (W - w) * clamp(u + (r() - 0.5) * 0.25, 0, 1);
      out.push({ cx, w, h: HH * (0.5 + 0.5 * r()), tower: 0.1 + 0.25 * r(), base: -HH * (0.1 + 1.3 * r()), z: r() * 0.6, flat: 0.42 + 0.1 * r() });
    }
    return out;
  }
  if (isDeck(p)) {
    // a deck: heaps of different widths and heights along a band, a gap between some, others
    // overlapping, their bases at slightly different heights (never one ruled line)
    const n = Math.max(2, p.heaps ?? Math.round(W / (HH * 2.8)));
    const wt: number[] = [];
    for (let i = 0; i < n; i++) wt.push(0.45 + r() * 1.1 + (i === Math.floor(n * 0.4) ? 0.6 : 0));
    const gaps: number[] = [];
    // (mostly touching or overlapping, a gap of clear air here and there: a broken band, never a
    // dotted line of lenses)
    for (let i = 0; i < n - 1; i++) gaps.push(r() < 0.7 ? -0.22 - 0.14 * r() : 0.04 + 0.2 * r());
    const sum = wt.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0) * 0.6;
    const unit = W / sum;
    const out: Head[] = [];
    let x = -W / 2;
    for (let i = 0; i < n; i++) {
      const w = wt[i]! * unit;
      const hh = HH * (0.62 + 0.38 * r()) * clamp(0.6 + wt[i]! * 0.3, 0.6, 1);
      out.push({ cx: x + w / 2, w, h: hh, tower: clamp(tower + (r() - 0.5) * 0.3, 0, 1), base: -HH * 0.16 * r(), z: r() * 2, flat: 0.8 + 0.1 * r() });
      x += w + (gaps[i] ?? 0) * unit * 0.6;
    }
    return out;
  }
  // a heap: a few big heads of very different sizes, never a row of equal ones
  const aspect = W / HH;
  const out: Head[] = [];
  // the main head (the tower): left of the middle, toward the sun; a narrow cloud is mostly it
  const mw = clamp(0.2 + 0.5 / aspect, 0.3, 0.82) * W * (p.kind === "tower" ? 0.85 : 1);
  const mcx = -W / 2 + mw / 2 + (W - mw) * (0.1 + 0.22 * r());
  out.push({ cx: mcx, w: mw, h: HH, tower, base: 0, z: 0, flat: 0.95 });
  // downwind (east): a long lower shoulder of one to three heads stepping down, each a little in
  // front of the one before it
  let right = mcx + mw * (0.36 + 0.08 * r());
  for (let k = 0; k < 3 && right < W / 2 - W * 0.08; k++) {
    const hw = W * (0.21 + 0.14 * r()) * (p.kind === "tower" ? 0.7 : 1);
    const cx = Math.min(W / 2 - hw / 2, right + hw * (0.12 + 0.22 * r()));
    const hh = HH * (0.62 - 0.1 * k) * (0.8 + 0.3 * r()) * (p.kind === "tower" ? 0.5 : 0.72 + 0.28 * (1 - tower));
    out.push({ cx, w: hw, h: hh, tower: tower * 0.5, base: -HH * 0.03 * r(), z: 1 + k * 0.6, flat: 0.9 });
    right = cx + hw * (0.3 + 0.12 * r());
  }
  // upwind: a smaller head low on the sun's side, in front of the tower's foot
  if (mcx - mw / 2 > -W / 2 + W * 0.04 || aspect > 1.5) {
    const hw = W * (0.15 + 0.09 * r());
    const cx = Math.max(-W / 2 + hw / 2, mcx - mw * 0.4 - hw * 0.12);
    out.push({ cx, w: hw, h: HH * (0.3 + 0.16 * r()), tower: 0.35, base: 0, z: 1.4, flat: 0.88 });
  }
  // a low head in front of the middle, where the tower meets its shoulder (the lower billows of
  // Dex's reference stand in front of the tower's foot, lit along their tops)
  if (aspect > 1.7) out.push({ cx: mcx + mw * (0.22 + 0.2 * r()), w: W * (0.15 + 0.08 * r()), h: HH * (0.2 + 0.1 * r()), tower: 0.2, base: 0, z: 2.4, flat: 0.86 });
  return out;
}

/** A head's outline: the height of its top over its base at x (px, positive up). */
function profileOf(H: Head, r: () => number): (x: number) => number {
  // a few domed towers of very different sizes over a row of lower rounded domes, all on one low
  // body: never a triangle, a level plateau or a long flat tail
  const nT = 1 + Math.round(H.tower * 1.4 + r() * 0.8);
  const towers: [number, number, number][] = [];
  for (let i = 0; i < nT; i++) {
    const big = i === 0;
    towers.push([
      H.cx + H.w * (big ? -0.12 + 0.24 * r() : (r() < 0.6 ? 0.08 + 0.26 * r() : -0.36 + 0.16 * r())),
      H.w * (big ? 0.2 + 0.08 * r() : 0.1 + 0.1 * r()),
      H.h * (big ? 1 : (0.5 + 0.3 * r()) * (0.6 + 0.4 * H.tower)),
    ]);
  }
  const nD = 2 + Math.round(r() * 1.5);
  for (let i = 0; i < nD; i++) {
    const u = -0.8 + (1.6 * (i + 0.2 + 0.6 * r())) / nD;
    towers.push([H.cx + (u * H.w) / 2, H.w * (0.5 / nD) * (0.75 + 0.6 * r()), H.h * (0.4 + 0.3 * r()) * (1.1 - 0.5 * Math.abs(u))]);
  }
  const bodyH = H.h * (0.22 + 0.1 * (1 - H.tower)) * (0.85 + 0.3 * r());
  const s = Math.floor(r() * 1e4);
  return (x: number): number => {
    const u = (x - H.cx) / (H.w / 2);
    if (Math.abs(u) >= 1) return 0;
    // (the ends round off as billowed shoulders over the flat base: never a sloping wedge)
    const env = Math.pow(1 - u ** 6, 0.5);
    let t = bodyH * env * (0.85 + 0.3 * vnoise1(x / (H.w * 0.18), s));
    for (const [tx, hw, th] of towers) {
      const v = (x - tx) / hw;
      if (Math.abs(v) < 1) t = Math.max(t, th * Math.pow(1 - v * v, 0.42) * Math.pow(env, 0.3));
    }
    return t;
  };
}

/** How far a cloud's billows may reach either side of its anchor, level-1 px. */
const cloudReach = (p: CloudP): number => p.w * 0.6 + p.h * 0.5;

/** The billows of a cloud (in its own level-1 px, y negative up), built once per cloud. */
function billowsOf(p: CloudP, seed: number): { B: Billow[]; H: Head[] } {
  return cached(`cb5|${seed}|${p.kind ?? ""}|${p.w}|${p.h}|${p.tower ?? ""}|${p.low ? 1 : 0}|${p.heaps ?? ""}`, () => {
    const r = rng(seed + 5);
    const out: Billow[] = [];
    const heads = headsOf(p, seed);
    heads.forEach((H, hi) => {
      const top = profileOf(H, r);
      const thin = H.flat < 0.6;
      // (a small head has fewer, rounder billows: never a speckle of tiny ones)
      const minR = Math.max(thin ? 2.4 : 3.2, H.h * (thin ? 0.12 : 0.06));
      const add = (x: number, y: number, rad: number, z: number, big = false): Billow => {
        const b = { x, y, r: Math.max(minR * 0.6, rad), k: H.flat * (0.86 + 0.2 * r()), head: hi, z, base: H.base, s: Math.floor(r() * 997), big };
        out.push(b);
        return b;
      };
      const zOf = (y: number): number => ((y - H.base) / Math.max(1, H.h)) * 3 + r() * 0.45;
      // the outline: billows walked along it (by its length, so the towers' steep flanks carry as
      // many as their tops), each sitting just inside it; sizes varying four to one and more (a
      // few great, more middling, many small), never bigger than the height under them allows
      const pts: [number, number][] = [];
      for (let x = H.cx - H.w / 2; x <= H.cx + H.w / 2; x += 1) pts.push([x, top(x)]);
      const rim: Billow[] = [];
      let acc = 0, want = 0;
      for (let i = 1; i < pts.length; i++) {
        const [xa, ta] = pts[i - 1]!, [xb, tb] = pts[i]!;
        acc += Math.hypot(xb - xa, tb - ta);
        if (acc < want || tb < 2) continue;
        const g = r();
        const bigOne = g < 0.22 && !thin;
        // (sizes by the head's size, but a great head is carved by more billows, never a few
        // balloons: four to one between the great and the small)
        const sc = Math.min(H.h, 60 + H.h * 0.5);
        let rad = sc * (bigOne ? 0.17 + 0.06 * r() : g < 0.55 ? 0.09 + 0.035 * r() : 0.045 + 0.02 * r()) * (thin ? 1.6 : 1);
        rad = Math.max(minR, Math.min(rad, tb * 0.5 + 1.5));
        const tx = xb - xa, ty = -(tb - ta), tl = Math.hypot(tx, ty) || 1;
        const nx = -ty / tl, ny = tx / tl;
        const sink = rad * (0.62 + 0.25 * r());
        const y = H.base - tb + ny * sink;
        rim.push(add(xb + nx * sink, y, rad, zOf(y), bigOne && rad > sc * 0.15));
        acc = 0;
        want = rad * (0.62 + 0.5 * r());
      }
      // the body: a few big billows filling the head under its outline (their own edges merge
      // into one mass: only the head's outline and its big billows keep an edge)
      const cell = Math.max(6, H.h * 0.24);
      for (let gy = H.base - cell * 0.4; gy > H.base - H.h * 1.05; gy -= cell * (0.62 + 0.2 * r())) {
        for (let gx = H.cx - H.w / 2 + cell * r() * 0.6; gx < H.cx + H.w / 2; gx += cell * (0.8 + 0.5 * r())) {
          const t = top(gx);
          const y = gy + (r() - 0.5) * cell * 0.4;
          const rad = cell * (0.55 + 0.35 * r());
          if (H.base - y > t - rad * 0.8 || t < 3) continue;
          add(gx + (r() - 0.5) * cell * 0.5, y, rad, zOf(y) - 0.6);
        }
      }
      // the base: broad, flattened billows along it, their bottoms cut flat by it
      for (let x = H.cx - H.w / 2 + H.w * 0.03; x < H.cx + H.w / 2;) {
        const t = top(x);
        const rad = Math.max(minR, Math.min(H.h * (0.16 + 0.08 * r()), t * 0.55 + 1));
        if (t > 3) out.push({ x, y: H.base - rad * (0.35 + 0.2 * r()), r: rad * 1.15, k: 0.62 + 0.1 * r(), head: hi, z: -4 + r() * 0.3, base: H.base, s: Math.floor(r() * 997), big: false });
        x += rad * (0.9 + 0.6 * r());
      }
      // cauliflower: the big outline billows sprout smaller ones round their upper rims (more
      // toward the sun), and those sprout smaller ones again
      let gen = rim.filter((b) => b.r > Math.max(minR * 1.6, Math.min(H.h, 60 + H.h * 0.5) * 0.08));
      for (let level = 0; level < 2; level++) {
        const next: Billow[] = [];
        for (const b of gen) {
          const k = Math.floor(r() * (level ? 2.4 : 3.6));
          for (let j = 0; j < k; j++) {
            const ang = -Math.PI * (r() < 0.65 ? 0.55 + 0.4 * r() : 0.1 + 0.4 * r());
            const sr = b.r * (level ? 0.3 + 0.16 * r() : 0.32 + 0.2 * r());
            if (sr < minR * 0.8) continue;
            const reach = b.r * (0.72 + 0.16 * r());
            next.push(add(b.x + Math.cos(ang) * reach, b.y + Math.sin(ang) * reach * b.k, sr, b.z + 0.05));
          }
        }
        gen = next.filter((b) => b.r > minR * 1.4);
      }
      // the base is scalloped, never one ruled slab: a few flattened billows sag a little below
      // it, more on the shaded (east) half
      const nSag = thin ? 0 : Math.round((H.w / H.h) * 0.6 + r() * 1.5);
      for (let j = 0; j < nSag; j++) {
        const u = r() < 0.7 ? 0.05 + 0.4 * r() : -0.4 + 0.4 * r();
        const x = H.cx + u * H.w;
        if (top(x) < H.h * 0.2) continue;
        const rad = Math.max(minR, H.h * (0.07 + 0.07 * r()));
        const sag = rad * (0.25 + 0.3 * r());
        out.push({ x, y: H.base + sag - rad * 0.55, r: rad * 1.3, k: 0.55 + 0.1 * r(), head: hi, z: 0.6 + r() * 0.3, base: H.base + sag, s: Math.floor(r() * 997), big: false });
      }
      // torn off its ends: a scrap or two drifting free downwind (east), smaller as they go
      for (let j = 0, nF = Math.floor(r() * (thin ? 2.6 : 2.2)); j < nF; j++) {
        const side = r() < 0.75 ? 1 : -1;
        let x = H.cx + side * (H.w / 2) * (0.95 + 0.2 * r());
        let y = H.base - H.h * (0.08 + 0.3 * r());
        let rad = minR * (1.1 + 1.2 * r());
        for (let k = 0; k < 2 && rad >= minR * 0.8 && Math.abs(x) + rad * 1.9 < cloudReach(p); k++) {
          out.push({ x, y, r: rad, k: 0.55 + 0.1 * r(), head: hi, z: 0.5, base: y + rad * 0.35, s: Math.floor(r() * 997), big: false });
          out.push({ x: x + side * rad * 0.7, y: y + rad * 0.15, r: rad * 0.7, k: 0.6, head: hi, z: 0.55, base: y + rad * 0.35, s: Math.floor(r() * 997), big: false });
          x += side * rad * (1.8 + 1.2 * r());
          y += (r() - 0.3) * rad;
          rad *= 0.55 + 0.25 * r();
        }
      }
    });
    return { B: out, H: heads };
  });
}

/** A cloud as fields on its level-1 grid: which billow is in front, and the tone there. */
interface CloudMask { x0: number; y0: number; w: number; h: number; own: Int32Array; t: Float32Array; edge: Uint8Array; warm: Uint8Array }

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

/** The sun's direction (upper left and a little toward the viewer: the frame's sun at (0.2, 0.11)). */
const SUN = [-0.55, -0.68, 0.48] as const;

function cloudMask(p: CloudP, seed: number, f: number): CloudMask {
  return cached(`cm5|${seed}|${p.kind ?? ""}|${p.w}|${p.h}|${p.tower ?? ""}|${p.low ? 1 : 0}|${p.heaps ?? ""}|${p.haze ?? 0}|${f}`, () => {
    // the billows this frame: each swelling and settling a little (the heap churns as it drifts)
    const { B: B0, H: HD } = billowsOf(p, seed);
    const B = B0.map((b, i) => ({ ...b, r: b.r * (1 + 0.03 * Math.sin(f * 1.57 + i * 1.7)) }));
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const b of B) {
      bx0 = Math.min(bx0, b.x - b.r * 1.2); bx1 = Math.max(bx1, b.x + b.r * 1.2);
      by0 = Math.min(by0, b.y - b.r * b.k * 1.2); by1 = Math.max(by1, Math.min(b.base + 3, b.y + b.r * b.k * 1.2));
    }
    const x0 = Math.floor(bx0) - 2, y0 = Math.floor(by0) - 2;
    const w = Math.ceil(bx1) - x0 + 3, h = Math.ceil(by1) - y0 + 3;
    const nH = HD.length;
    const own = new Int32Array(w * h).fill(-1);
    const zb = new Float32Array(w * h).fill(-1e9);
    const NX = new Float32Array(w * h), NY = new Float32Array(w * h);
    // every head's whole extent (its own dome is shaped by all of it, the parts hidden behind a
    // nearer head included)
    const cover: Uint8Array[] = HD.map(() => new Uint8Array(w * h));
    // (the base is flat-ish: it wanders a px or two, and at the head's scale, never ruled)
    const BW = Math.max(6, -by0 * 0.5);
    const baseAt = (x: number, b: number): number => b - 1.4 * vnoise1(x / 23, seed + 33) - 0.9 * vnoise1(x / 7, seed + 34) + (vnoise1(x / BW, seed + 35) - 0.55) * BW * 0.16;
    B.forEach((b, i) => {
      const hz = HD[b.head]!.z * 100;
      const cv = cover[b.head]!;
      const gx0 = Math.max(0, Math.floor(b.x - b.r * 1.2 - x0)), gx1 = Math.min(w - 1, Math.ceil(b.x + b.r * 1.2 - x0));
      const gy0 = Math.max(0, Math.floor(b.y - b.r * b.k * 1.2 - y0)), gy1 = Math.min(h - 1, Math.ceil(b.y + b.r * b.k * 1.2 - y0));
      for (let gy = gy0; gy <= gy1; gy++) {
        const py = y0 + gy + 0.5;
        for (let gx = gx0; gx <= gx1; gx++) {
          const px = x0 + gx + 0.5;
          if (py > baseAt(px, b.base)) continue;
          const dx = px - b.x, dy = (py - b.y) / b.k;
          const ang = Math.atan2(dy, dx);
          const rr = b.r * (1 + 0.12 * (vnoise1(ang * 2.2 + b.s, seed + 41) - 0.5) + 0.07 * (vnoise1(ang * 6.5 + b.s, seed + 42) - 0.5));
          const q = (dx * dx + dy * dy) / (rr * rr);
          if (q > 1) continue;
          const k = gy * w + gx;
          cv[k] = 1;
          const z = hz + b.z + (1 - q) * 0.04;
          if (z > zb[k]!) { zb[k] = z; own[k] = i; NX[k] = dx / rr; NY[k] = dy / rr; }
        }
      }
    });
    // no sky through the heap: a hole between billows (sky not reached from outside it) takes
    // the billow beside it, facing the viewer
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
          cover[B[own[i]!]!.head]![i] = 1;
        }
      }
    }
    const dist = chamfer((i) => own[i]! >= 0, w, h);
    const Htot = Math.max(8, -y0);
    // each head's big form: a dome over its whole extent, smoothed, lit by the sun as a few big
    // turning planes (the billows ride on it); the head's own distance to its outline
    const LH = new Float32Array(w * h), DH = new Float32Array(w * h);
    for (let hi = 0; hi < nH; hi++) {
      const H = HD[hi]!, cv = cover[hi]!;
      const dh = chamfer((i) => cv[i] === 1, w, h);
      const R = Math.max(4, H.h * 0.5);
      const zf = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) if (cv[i]) zf[i] = Math.sqrt(Math.min(dh[i]!, R) * R);
      blur3(zf, w, h, Math.max(1, Math.round(H.h * 0.05)));
      for (let gy = 1; gy < h - 1; gy++) for (let gx = 1; gx < w - 1; gx++) {
        const k = gy * w + gx;
        const o = own[k]!;
        if (o < 0 || B[o]!.head !== hi) continue;
        const fx = (zf[k + 1]! - zf[k - 1]!) * 0.5, fy = (zf[k + w]! - zf[k - w]!) * 0.5;
        const fl = Math.hypot(fx, fy, 1);
        LH[k] = (-fx * SUN[0] - fy * SUN[1] + SUN[2]) / fl;
        DH[k] = dh[k]!;
      }
    }
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
    blur3(lg, gw, gh, Math.max(2, Math.round(Htot * 0.025)));
    const haze = clamp(p.haze ?? 0, 0, 1);
    const t = new Float32Array(w * h);
    const edge = new Uint8Array(w * h);
    const warm = new Uint8Array(w * h);
    for (let gy = 1; gy < h - 1; gy++) for (let gx = 1; gx < w - 1; gx++) {
      const k = gy * w + gx;
      const i = own[k]!;
      if (i < 0) continue;
      const b = B[i]!, H = HD[b.head]!;
      const lamH = LH[k]!;
      // the billow's own ball in the sun: it shows only on the head's lit outline (its
      // cauliflower) and, faintly, inside; the head reads as one mass, not a heap of scales
      const nx = NX[k]!, ny = NY[k]!;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lamB = SUN[0] * nx + SUN[1] * ny + SUN[2] * nz;
      const rimK = lamH > 0.1 ? clamp(1 - DH[k]! / Math.max(3, H.h * 0.14), 0, 1) : 0;
      const wB = 0.1 + 0.3 * rimK + (b.big ? 0.08 : 0);
      const deep = clamp(lg[Math.min(gh - 1, Math.floor(gy / G)) * gw + Math.min(gw - 1, Math.floor(gx / G))]! / (Htot * 0.62) + (vnoise(gx / (Htot * 0.14 + 4), gy / (Htot * 0.12 + 4), seed + 47) - 0.5) * 0.14, 0, 1);
      const py = y0 + gy + 0.5;
      const low = clamp(1 - (b.base - py) / Math.max(4, H.h * 0.7), 0, 1);
      let tt = 0.33 - 0.27 * lamH + 0.36 * deep + 0.16 * low * low - wB * lamB * (1 - 0.5 * deep);
      // a nearer head in front, just below: this head's belly over it lies in its shade (the lit
      // top of the nearer head stands crisp against it: the cloud's big internal edges)
      for (let dy = 1; dy <= 6 && gy + dy < h; dy++) {
        const j = own[(gy + dy) * w + gx]!;
        if (j >= 0 && B[j]!.head !== b.head && HD[B[j]!.head]!.z > H.z) { tt += 0.11 * (1 - (dy - 1) / 7); break; }
      }
      // inside a head, a big billow's rounded top leaves a short shade on the one behind it, only
      // on the sun's side (a few crisp edges where the light falls; the rest merges)
      if (lamH > 0.12) {
        for (let dy = 1; dy <= 3 && gy + dy < h; dy++) {
          const j = own[(gy + dy) * w + gx]!;
          if (j >= 0 && j !== i && B[j]!.head === b.head && B[j]!.z > b.z + 0.25) { tt += (B[j]!.big ? 0.12 : 0.05 * rimK) * (1 - (dy - 1) / 4); break; }
        }
      }
      // the flat base: its lowest rows turn into the shade, the last px a step darker again (no
      // sunlit cream right down to the floor of the cloud)
      if (py > b.base - 7) tt += 0.13 * (1 - (b.base - py) / 7);
      if (py > b.base - 2.2) tt += 0.06;
      // distance: low clouds sit in the haze (less contrast, lighter)
      tt = tt * (1 - 0.45 * haze) + 0.16 * haze;
      t[k] = clamp(tt, 0, 0.999);
      // the warm light thrown up from the land and the lake onto the lowest billows' shade
      if (low > 0.72 && tt > 0.55 && lamH < 0.3) warm[k] = 1;
      // the shaded outline softens by a cell of dither; the lit outline stays crisp
      if (dist[k]! <= 1.01 && lamH < 0.3) edge[k] = 1;
    }
    return { x0, y0, w, h, own, t, edge, warm };
  });
}

/** The tone steps, light to dark, and where each begins on the tone scale. */
const CLOUD_AT = [0, 0.14, 0.24, 0.35, 0.47, 0.6, 0.73, 0.86];
/** The warm bounce in the base's shade: steps 5 and 6 turn to the ramp's two warm greys. */
const BOUNCE: Record<number, number> = { 5: 8, 6: 9 };

/**
 * Paints a cloud from its mask: flat steps of the cumulus ramp (the warm cream and peach only
 * where the sun strikes, neutral cool greys turning away, the cool grey base with a warm bounce
 * in its lowest shade), one cell of dither only in a narrow band where two steps meet and along
 * the shaded outline; cells are the level's own.
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
      if (M.edge[k] && dith >= 0.5) continue;
      const t = M.t[k]!;
      let i = 0;
      while (i + 1 < CLOUD_AT.length && t >= CLOUD_AT[i + 1]!) i++;
      const near = ((CLOUD_AT[i + 1] ?? 2) - t) / 0.022;
      if (near < 1 && dith > near) i = Math.min(CLOUD_AT.length - 1, i + 1);
      if (M.warm[k] && BOUNCE[i] !== undefined) i = BOUNCE[i]!;
      b.set(x, y, R[i]!);
    }
  }
}

export const cloud = definePainter<CloudP>("op.cloud", {
  bounds(p) {
    const hx = cloudReach(p) + 6;
    const up = p.kind === "wisp" ? 2.4 : isDeck(p) ? 1.65 : 1.45;
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
