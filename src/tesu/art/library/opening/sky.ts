// The opening's sky (P0): morning clouds and the two sky isles. Clouds are authored in code
// (Dex: clouds, fog, mist and haze are freestyle, never traced).
//
// Cumulus: a cauliflower heap. A few towers of very different sizes stand on a flat base (the
// tallest left of centre, toward the sun), the big ones carrying a second billow; every lobe
// sprouts smaller lobes round its upper rim, and those sprout smaller ones again, so the
// silhouette is lumpy at three scales, never a triangle or a straight flank. Each lobe is shaded
// as a ball lit from the upper left (a cream rim where the sun grazes it), a crease of shadow
// where a nearer lobe overlaps it, deeper shade the further the light has to travel through the
// heap, and blue-grey (the far range's ramp) along the flat underside, which sits on a thin
// layer of haze. Only the shaded rims dither; the lit outline is crisp. Stratus: a torn band of
// long low lobes of different lengths and heights, lumpy on top, flatter below, tapering and
// fraying at both ends, broken in places; never a ruled line. `frame` (0..3) churns the lobes a
// little for the drifting sprites.
//
// The isles: two floating karst islands far off (Bell and Drum), painted in the haze's own
// values so they sit in the distance: a forested top, a tower each with a warm window, the rock
// beneath hanging in ragged lobes that taper to points, roots and a thread of water trailing off
// one edge into a scrap of cloud at its foot.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm1, hash1, rng, vnoise, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

export interface CloudP {
  kind?: "cumulus" | "stratus";
  /** Width and height of the cloud, px of the sky plane; anchor at the middle of its base. */
  w: number;
  h: number;
  /** For stratus: how many bands (1 to 3). */
  layers?: number;
  /** A low heap (fewer, flatter towers): the small cloud that keeps the sun company. */
  low?: boolean;
  frame?: number;
}

interface Lobe { x: number; y: number; r: number; z: number; root: number }

/** The heap's lobes: towers on the base, billows on the towers, smaller lobes on every rim. */
function lobesOf(p: CloudP, seed: number): Lobe[] {
  return cached(`cu2|${seed}|${p.w}|${p.h}|${p.low ? 1 : 0}`, () => {
    const r = rng(seed + 5);
    const W = p.w, H = p.h;
    const out: Lobe[] = [];
    // towers: sizes very different, the tallest left of centre
    const n = p.low ? 3 + Math.floor(r() * 2) : 5 + Math.floor(r() * 2);
    const sizes = p.low ? [1, 0.62, 0.45, 0.38] : [1, 0.7, 0.52, 0.42, 0.34, 0.28];
    const order = sizes.slice(0, n);
    // the biggest stands second from the left; the rest fall away to the right in a long tail
    const slots: number[] = [];
    for (let i = 0; i < n; i++) slots.push(-0.44 + (0.88 * (i + 0.2 + 0.6 * r())) / n);
    const place = [order[1]!, order[0]!, ...order.slice(2)];
    for (let i = 0; i < n; i++) {
      const s = place[i]!;
      const rr = H * (p.low ? 0.5 : 0.36) * s * (0.9 + 0.2 * r());
      const x = slots[i]! * W;
      const y = -rr * (0.62 + 0.2 * r());
      const root = out.length;
      out.push({ x, y, r: rr, z: s * 2 + r() * 0.3, root });
      if (s > 0.6) out.push({ x: x + (r() - 0.65) * rr * 0.7, y: y - rr * (0.75 + 0.25 * r()), r: rr * (0.62 + 0.18 * r()), z: s * 2 + 1, root });
      if (s > 0.9 && !p.low) out.push({ x: x + (r() - 0.3) * rr * 0.5, y: y - rr * (1.45 + 0.2 * r()), r: rr * (0.42 + 0.12 * r()), z: s * 2 + 1.6, root });
    }
    // low filler lobes along the base so the towers stand on one body
    const m = Math.round(W / (H * 0.18));
    for (let i = 0; i < m; i++) {
      const u = -0.5 + (i + r()) / m;
      const rr = H * (0.12 + 0.1 * r()) * (1 - Math.abs(u) * 0.8);
      out.push({ x: u * W, y: -rr * 0.55, r: rr, z: 0.5 + r(), root: out.length });
    }
    // every rim sprouts smaller lobes, twice: cauliflower
    let gen = out.slice();
    for (let level = 0; level < 2; level++) {
      const next: Lobe[] = [];
      for (const L of gen) {
        if (L.r < H * 0.05) continue;
        const k = 3 + Math.floor(r() * (level ? 4 : 5));
        for (let j = 0; j < k; j++) {
          // round the upper rim, more of them toward the sun (upper left)
          const ang = -Math.PI * (0.08 + 0.84 * Math.pow(r(), 1.3));
          const cr = L.r * (level ? 0.2 + 0.25 * r() : 0.24 + 0.32 * r());
          const reach = L.r * (0.72 + 0.16 * r());
          const cy = L.y + Math.sin(ang) * reach;
          if (cy - cr > -2 && level) continue;
          next.push({ x: L.x + Math.cos(ang) * reach, y: cy, r: cr, z: L.z + 0.35 + 0.3 * r(), root: L.root });
        }
      }
      out.push(...next);
      gen = next;
    }
    return out;
  });
}

/** The flat base, not ruled: it wanders a few px and is lumpy where small lobes sag (y, negative up). */
function baseAt(p: CloudP, lx: number, seed: number): number {
  return -p.h * (0.018 + 0.03 * vnoise1(lx / 52, seed + 33) + 0.018 * vnoise1(lx / 14, seed + 34));
}

/** The heap as fields on a 1 px grid (level-1 px), built once per cloud and frame. */
interface Mask { x0: number; y0: number; w: number; h: number; own: Int16Array; light: Float32Array; dist: Float32Array; lobes: Lobe[] }

function maskOf(p: CloudP, seed: number, f: number): Mask {
  return cached(`cumask2|${seed}|${p.w}|${p.h}|${p.low ? 1 : 0}|${f}`, () => {
    const L = lobesOf(p, seed).map((o, i) => ({ ...o, r: o.r * (0.97 + 0.03 * Math.sin(f * 1.57 + i * 1.3)) }));
    const x0 = Math.floor(-p.w * 0.66), y0 = Math.floor(-p.h * 1.32), w = Math.ceil(p.w * 1.32), h = Math.ceil(p.h * 1.32) + 2;
    // the frontmost lobe at every px (-1 outside): the one whose ball stands nearest the eye
    const own = new Int16Array(w * h).fill(-1);
    const zb = new Float32Array(w * h).fill(-1e9);
    L.forEach((o, i) => {
      const gx0 = Math.max(0, Math.floor(o.x - o.r - x0)), gx1 = Math.min(w - 1, Math.ceil(o.x + o.r - x0));
      const gy0 = Math.max(0, Math.floor(o.y - o.r - y0)), gy1 = Math.min(h - 1, Math.ceil(o.y + o.r - y0));
      for (let gy = gy0; gy <= gy1; gy++) {
        const py = y0 + gy + 0.5;
        if (py > 0) continue;
        for (let gx = gx0; gx <= gx1; gx++) {
          // (small lobes may sag a little below the base: it is scalloped, never ruled)
          if (py > baseAt(p, x0 + gx + 0.5, seed) + (o.r < p.h * 0.09 ? o.r * 0.5 : 0)) continue;
          const dx = x0 + gx + 0.5 - o.x, dy = py - o.y;
          const q = o.r * o.r - dx * dx - dy * dy;
          if (q < 0) continue;
          const z = o.z * p.h * 0.1 + Math.sqrt(q);
          const k = gy * w + gx;
          if (z > zb[k]!) { zb[k] = z; own[k] = i; }
        }
      }
    });
    // how far the light travels through the heap to reach each px (on a 3 px grid, blurred)
    const G = 3, gw = Math.ceil(w / G), gh = Math.ceil(h / G);
    const ins = (gx: number, gy: number): boolean => {
      const x = Math.min(w - 1, gx * G + 1), y = Math.min(h - 1, gy * G + 1);
      return own[y * w + x]! >= 0;
    };
    let lg = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      if (!ins(gx, gy)) continue;
      let len = 0;
      for (let s = 1; s < 140; s++) {
        const sx = Math.round(gx - 0.62 * s), sy = Math.round(gy - 0.78 * s);
        if (sx < 0 || sy < 0 || !ins(sx, sy)) break;
        len = s * G;
      }
      lg[gy * gw + gx] = len;
    }
    for (let pass = 0; pass < 2; pass++) {
      const src = lg;
      lg = new Float32Array(gw * gh);
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
        let sum = 0, n = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = gx + dx, yy = gy + dy;
          if (xx < 0 || yy < 0 || xx >= gw || yy >= gh || !ins(xx, yy)) continue;
          sum += src[yy * gw + xx]!; n++;
        }
        lg[gy * gw + gx] = n ? sum / n : 0;
      }
    }
    const light = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) light[y * w + x] = lg[Math.min(gh - 1, Math.floor(y / G)) * gw + Math.min(gw - 1, Math.floor(x / G))]!;
    // distance to the outside (chamfer), for the soft shaded rims
    const dist = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) dist[i] = own[i]! >= 0 ? 1e6 : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!dist[i]) continue;
      let v = dist[i]!;
      v = Math.min(v, x > 0 ? dist[i - 1]! + 1 : 1, y > 0 ? dist[i - w]! + 1 : 1);
      if (x > 0 && y > 0) v = Math.min(v, dist[i - w - 1]! + 1.41);
      if (x < w - 1 && y > 0) v = Math.min(v, dist[i - w + 1]! + 1.41);
      dist[i] = v;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!dist[i]) continue;
      let v = dist[i]!;
      v = Math.min(v, x < w - 1 ? dist[i + 1]! + 1 : 1, y < h - 1 ? dist[i + w]! + 1 : 1);
      if (x < w - 1 && y < h - 1) v = Math.min(v, dist[i + w + 1]! + 1.41);
      if (x > 0 && y < h - 1) v = Math.min(v, dist[i + w - 1]! + 1.41);
      dist[i] = v;
    }
    return { x0, y0, w, h, own, light, dist, lobes: L };
  });
}

/** The haze lenses under the base: [x, y, half length, half thickness]. */
function skirtOf(p: CloudP, seed: number): [number, number, number, number][] {
  return cached(`cuskirt|${seed}|${p.w}|${p.h}`, () => {
    const r = rng(seed + 41);
    const out: [number, number, number, number][] = [];
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) out.push([(r() - 0.5) * p.w * 0.9, -p.h * (0.005 + 0.05 * r()), p.w * (0.04 + 0.1 * r()), p.h * (0.015 + 0.025 * r())]);
    return out;
  });
}

function paintCumulus(c: PaintCtx, p: CloudP): void {
  const b = c.buf, seed = c.seed;
  const f = (p.frame ?? 0) & 3;
  const M = maskOf(p, seed, f);
  const Ls = M.lobes;
  const C = P.cloud, R = P.range;
  const baseH = p.h * (p.low ? 0.32 : 0.22);
  const X0 = Math.max(b.ox, Math.floor(c.X(M.x0))), X1 = Math.min(b.x1, Math.ceil(c.X(M.x0 + M.w)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(M.y0))), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.h * 0.06 + 2)));
  // light from the upper left and a little in front
  const Lx = -0.55, Ly = -0.68, Lz = 0.48;
  for (let y = Y0; y < Y1; y++) {
    const ly = c.ly(y + 0.5);
    const gy = Math.floor(ly - M.y0);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const gx = Math.floor(lx - M.x0);
      const up = -ly;
      // the haze layer the base sits on: a few long thin lenses, wider than the heap, dithered
      if (gx < 0 || gy < 0 || gx >= M.w || gy >= M.h || M.own[gy * M.w + gx]! < 0) {
        let cov = 0;
        for (const S of skirtOf(p, seed)) {
          // (each lens wanders and swells along its length: never a ruled band)
          const u = (lx - S[0]) / S[2], v = (ly - S[1] - (vnoise1(lx / 23, seed + 35) - 0.5) * S[3] * 2) / (S[3] * (0.5 + vnoise1(lx / 17, seed + 36)));
          if (u <= -1 || u >= 1 || v <= -1 || v >= 1) continue;
          cov = Math.max(cov, (1 - u * u) * (1 - v * v) * (0.55 + 0.6 * vnoise(lx / 24, ly / 3, seed + 32)));
        }
        const th = cov > 0.55 ? 0.5 : cov > 0.32 ? 0.25 : cov > 0.15 ? 0.125 : 0;
        if (bayer4(x + f, y) < th) b.set(x, y, C[cov > 0.5 ? 2 : 3]!);
        continue;
      }
      const k = gy * M.w + gx;
      const o = Ls[M.own[k]!]!;
      const dist = M.dist[k]!;
      // the normal: mostly its tower's great form, a little of its own small ball's
      const R0 = Ls[o.root]!;
      let rx = (lx - R0.x) / R0.r, ry = (ly - R0.y) / R0.r;
      const rl = Math.hypot(rx, ry);
      if (rl > 1) { rx /= rl; ry /= rl; }
      const rz = Math.sqrt(Math.max(0, 1 - rx * rx - ry * ry));
      const ox = (lx - o.x) / o.r, oy = (ly - o.y) / o.r;
      const oz = Math.sqrt(Math.max(0, 1 - ox * ox - oy * oy));
      let nx = rx * 0.7 + ox * 0.3, ny = ry * 0.7 + oy * 0.3, nz = rz * 0.7 + oz * 0.3;
      const nl = Math.max(1e-3, Math.hypot(nx, ny, nz));
      nx /= nl; ny /= nl; nz /= nl;
      const lam = nx * Lx + ny * Ly + nz * Lz;
      // the base: its lowest px fray into the haze below
      const bd = baseAt(p, lx, seed) - ly;
      if (bd < 3 && bayer4(x + f, y) >= bd / 3.2) continue;
      // a crease where a nearer lobe's edge overlaps this one, toward the light
      const ux = Math.floor(lx - 2.2 - M.x0), uy = Math.floor(ly - 2.6 - M.y0);
      const oi = ux >= 0 && uy >= 0 ? M.own[uy * M.w + ux]! : -1;
      // (on the lit side only a dithered hint, on the shaded side a real step)
      const crease = oi >= 0 && oi !== M.own[k]! && Ls[oi]!.z > o.z + 0.3 ? (lam < 0.3 ? 0.16 : bayer4(x, y) < 0.5 ? 0.1 : 0) : 0;
      // soft rims only on the shaded side and along the base
      const shadeSide = lam < 0.1 || up < baseH * 0.5;
      if (shadeSide && dist < 3 && bayer4(x + f, y) >= dist / 3) continue;
      const deep = clamp(M.light[k]! / (p.h * 0.5), 0, 1);
      const base = clamp(1 - up / baseH, 0, 1);
      // the sun-grazed rim: cream, right on the lit outline
      if (dist < 2.2 && lam > 0.55 && up > baseH) { b.set(x, y, P.paper[0]!); continue; }
      let t = 0.3 - lam * 0.5 + deep * 0.36 + crease + base * 0.38;
      t += (vnoise(lx / 7, ly / 7, seed + 3) - 0.5) * 0.06;
      t = clamp(t, 0, 1);
      if (t < 0.62) {
        const i = t / 0.62 * 3.99;
        const kk = Math.floor(i);
        b.set(x, y, C[Math.min(3, kk + (bayer4(x, y) < i - kk ? 1 : 0))]!);
      } else {
        // the underside and the deepest shade: the far range's blue-grey
        const i = (t - 0.62) / 0.38 * 3.2;
        const kk = Math.floor(i);
        b.set(x, y, R[Math.min(4, 1 + kk + (bayer4(x, y) < i - kk ? 1 : 0))]!);
      }
    }
  }
}

function paintStratus(c: PaintCtx, p: CloudP): void {
  const b = c.buf, d = c.d, seed = c.seed;
  const f = (p.frame ?? 0) & 3;
  const layers = Math.max(1, Math.min(3, p.layers ?? 2));
  const C = P.cloud;
  // the band's lobes: long lenses of different lengths and heights, overlapping, with gaps
  const lobes = cached(`st2|${seed}|${p.w}|${p.h}|${layers}`, () => {
    const r = rng(seed + 9);
    const out: { x: number; y: number; half: number; th: number; s: number }[] = [];
    for (let k = 0; k < layers; k++) {
      let x = -p.w / 2 + p.w * 0.12 * r() + k * p.w * 0.1;
      const end = p.w / 2 - p.w * 0.1 * r() - k * p.w * 0.12;
      while (x < end) {
        const half = p.w * (0.05 + 0.1 * r()) * (k ? 0.8 : 1);
        const cx = x + half;
        // thicker in the middle of the band, thin at its ends
        const along = 1 - Math.pow(Math.abs(cx) / (p.w / 2), 2);
        out.push({ x: cx, y: -k * p.h * 1.4 - p.h * (0.2 + 0.9 * r()), half, th: p.h * (0.45 + 0.75 * r()) * (0.35 + 0.65 * Math.max(0, along)), s: Math.floor(r() * 1e5) });
        x += half * (1.1 + 0.9 * r()) + (r() < 0.2 ? p.w * (0.03 + 0.05 * r()) : 0);
      }
    }
    return out;
  });
  const X0 = Math.max(b.ox, Math.floor(c.X(-p.w / 2))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w / 2)));
  const top = -p.h * (layers * 1.4 + 1.8);
  const Y0 = Math.max(b.oy, Math.floor(c.Y(top))), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.h * 0.6)));
  for (let x = X0; x < X1; x++) {
    const lx = c.lx(x + 0.5);
    for (let y = Y0; y < Y1; y++) {
      const ly = c.ly(y + 0.5);
      let best = 0, below = 0;
      for (const L of lobes) {
        const u = (lx - L.x) / L.half;
        if (u <= -1 || u >= 1) continue;
        // lumpy on top, flatter below, the lens wandering a little
        const mid = L.y + (vnoise1(lx / (p.h * 6), L.s) - 0.5) * L.th * 0.6;
        const lump = 0.7 + 0.6 * vnoise1(lx / (p.h * 1.6) + f * 0.2, L.s + 1);
        const v = ly < mid ? (mid - ly) / (L.th * lump) : (ly - mid) / (L.th * 0.45);
        const cov = (1 - u * u) * (1 - v * v);
        if (cov > best) { best = cov; below = ly - mid; }
      }
      if (best <= 0) continue;
      // mostly a dithered veil, solid only in its thickest cores; the cloud's own texture breaks
      // it up, so no edge of it runs as a line
      const cv = best * (0.65 + 0.7 * vnoise(lx / (p.h * 1.1), ly / (p.h * 0.45), seed + 4));
      if (cv < 0.72) {
        const th = cv > 0.5 ? 0.5 : cv > 0.32 ? 0.25 : cv > 0.18 ? 0.125 : 0;
        if (bayer4(x + f, y) < th) b.set(x, y, C[below > 0 ? 2 : 1]!);
        continue;
      }
      // a core: lit in patches toward the sun, a cooler underside
      const lit = below < -p.h * 0.3 && vnoise(lx / (p.h * 2), ly / p.h, seed + 5) > 0.55;
      b.set(x, y, lit ? (lx < 0 ? P.paper[0]! : C[0]!) : below < 0 ? C[1]! : C[2]!);
    }
  }
  void d;
}

export const cloud = definePainter<CloudP>("op.cloud", {
  bounds(p) {
    if (p.kind === "stratus") return [-p.w / 2 - 4, -p.h * ((p.layers ?? 2) * 1.4 + 1.8) - 6, p.w / 2 + 4, p.h * 0.6 + 4];
    return [-p.w * 0.66 - 2, -p.h * 1.32 - 2, p.w * 0.66 + 2, p.h * 0.08 + 4];
  },
  paint(c, p) {
    if (p.kind === "stratus") paintStratus(c, p);
    else paintCumulus(c, p);
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

function isleUnder(p: IsleP, lx: number, seed: number): number {
  const u = lx / (p.w / 2);
  if (Math.abs(u) >= 1) return 0;
  // ragged hanging lobes tapering to points (the karst it was torn from)
  const lobes = Math.abs(Math.sin(u * 4.2 + hash1(1, seed) * 6)) * 0.35 + 0.65;
  return p.h * Math.pow(1 - Math.abs(u), 0.85) * lobes * (0.8 + 0.4 * fbm1(lx / 9, seed + 1, 3));
}

export const isle = definePainter<IsleP>("op.isle", {
  bounds(p) {
    return [-p.w / 2 - 30, -p.w * 1.05 - 3, p.w / 2 + 30, p.h + 93];
  },
  paint(c0, p) {
    // the bob: a whole-pixel rise and settle (eased), the isle drifting on the air
    const bob = Math.round(Math.sin(((p.frame ?? 0) / 8) * Math.PI * 2) * 1.5);
    const c: PaintCtx = { ...c0, ay: c0.ay + bob, Y: (v: number) => c0.Y(v) + bob, ly: (v: number) => c0.ly(v - bob) };
    const b = c.buf, d = c.d, seed = c.seed;
    const R = P.range;
    // the rock under the top: hazy blue-grey, lit left, dark lower right, stained streaks
    const X0 = Math.max(b.ox, Math.floor(c.X(-p.w / 2))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w / 2)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const u = lx / (p.w / 2);
      const depth = isleUnder(p, lx, seed);
      const topY = -2 - 3 * vnoise1(lx / 6, seed + 2);
      for (let y = Math.max(b.oy, Math.floor(c.Y(topY))); y < Math.min(b.y1, Math.ceil(c.Y(depth))); y++) {
        const ly = c.ly(y + 0.5);
        if (ly < 4) {
          // the forested top edge
          b.set(x, y, R[ly < 1.5 ? 2 : 4]!);
          continue;
        }
        let t = 0.2 + 0.35 * clamp((u + 1) / 2, 0, 1) + 0.3 * (ly / p.h);
        if (vnoise1(lx / 2.5 + ly * 0.01, seed + 3) > 0.7) t += 0.12;
        if (ly > depth - 2 / d) t += 0.15;
        const i = Math.floor(clamp(t, 0, 1) * (R.length - 1));
        const k = clamp(t, 0, 1) * (R.length - 1) - i;
        b.set(x, y, R[Math.min(R.length - 1, i + (bayer4(x, y) < k ? 1 : 0))]!);
      }
      // roots and hanging strands from the underside
      if (hash1(Math.floor(lx / 3), seed + 4) < 0.12 && d >= 0.5) {
        const len = 6 + 20 * hash1(Math.floor(lx / 3), seed + 5);
        for (let s = 0; s < len; s += 1 / d) b.set(x, Math.round(c.Y(depth + s)), R[s < len * 0.5 ? 4 : 3]!);
      }
    }
    // a thread of water off the right edge, into a scrap of cloud
    const fx = p.w * 0.28;
    const fall = isleUnder(p, fx, seed);
    for (let ly = 0; ly < fall + 70; ly += 1 / d) {
      const Y = Math.round(c.Y(ly));
      const X = Math.round(c.X(fx + Math.sin(ly / 9) * 0.6));
      if (ly > fall && bayer4(X, Y) > 1 - (ly - fall) / 70) continue;
      b.set(X, Y, P.cloud[ly > fall ? 1 : 0]!);
    }
    // trees on the top: small hazy crowns
    const r = rng(seed + 7);
    for (let i = 0; i < Math.round(p.w / 7); i++) {
      const tx = (r() - 0.5) * p.w * 0.9;
      const tr = 2.5 + r() * 3.5;
      const X0b = Math.floor(c.X(tx - tr)), X1b = Math.ceil(c.X(tx + tr));
      for (let y = Math.floor(c.Y(-tr * 1.6 - 2)); y < Math.ceil(c.Y(1)); y++) {
        for (let x = X0b; x < X1b; x++) {
          const dx = c.lx(x + 0.5) - tx, dy = c.ly(y + 0.5) + tr * 0.6;
          if (dx * dx + dy * dy > tr * tr) continue;
          b.set(x, y, R[-0.62 * dx - 0.78 * dy > 0 ? 3 : 4]!);
        }
      }
    }
    // the tower: lacquer gone pale with distance, gold ridges, one warm window
    const tiers = p.tower === "bell" ? 3 : 2;
    const tw = p.w * (p.tower === "bell" ? 0.22 : 0.32);
    let y = -1;
    for (let t = 0; t < tiers; t++) {
      const sw = tw * (1 - t * 0.2);
      const sh = p.w * (p.tower === "bell" ? 0.15 : 0.18);
      for (let yy = Math.floor(c.Y(y - sh)); yy < Math.ceil(c.Y(y)); yy++) {
        for (let x = Math.floor(c.X(-sw / 2)); x < Math.ceil(c.X(sw / 2)); x++) {
          const u = (c.lx(x + 0.5) + sw / 2) / sw;
          const win = Math.abs(u - 0.5) < 0.12 && c.ly(yy + 0.5) > y - sh * 0.7 && c.ly(yy + 0.5) < y - sh * 0.3;
          b.set(x, yy, win ? P.gold[1]! : R[u < 0.3 ? 4 : 5]!);
        }
      }
      const rh = sh * 0.6;
      for (let yy = Math.floor(c.Y(y - sh - rh)); yy < Math.ceil(c.Y(y - sh + 1)); yy++) {
        const v = (y - sh - c.ly(yy + 0.5)) / rh;
        const rw = sw * (1.55 - 0.95 * v) + (v < 0.2 ? (0.2 - v) * sw * 1.4 : 0);
        for (let x = Math.floor(c.X(-rw / 2)); x < Math.ceil(c.X(rw / 2)); x++) {
          b.set(x, yy, v > 0.88 ? P.gold[3]! : R[c.lx(x + 0.5) < 0 ? 4 : 6]!);
        }
      }
      y -= sh + rh * 0.65;
    }
  },
});
