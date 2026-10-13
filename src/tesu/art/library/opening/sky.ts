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
import { bayer4, clamp, fbm, fbm1, hash1, rng, vnoise, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

export interface CloudP {
  kind?: "cumulus" | "stratus" | "field";
  /** Width and height of the cloud, px of the sky plane; anchor at the middle of its base. */
  w: number;
  h: number;
  /** For stratus: how many bands (1 to 3). */
  layers?: number;
  /** A low heap (fewer, flatter towers): the small cloud that keeps the sun company. */
  low?: boolean;
  /** For a field: how much of it is cloud, 0..1 (default 0.5), and its cirrus strands (default 3). */
  density?: number;
  strands?: number;
  frame?: number;
}

interface Lobe { x: number; y: number; r: number; z: number; root: number; gen?: number }

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
      if (s > 0.6) out.push({ x: x + (r() - 0.6) * rr * 0.5, y: y - rr * (0.75 + 0.25 * r()), r: rr * (0.74 + 0.14 * r()), z: s * 2 + 1, root });
      if (s > 0.6) out.push({ x: x + rr * (0.5 + 0.2 * r()), y: y - rr * (0.3 + 0.3 * r()), r: rr * (0.5 + 0.12 * r()), z: s * 2 + 0.6, root });
      if (s > 0.9 && !p.low) out.push({ x: x + (r() - 0.45) * rr * 0.45, y: y - rr * (1.3 + 0.15 * r()), r: rr * (0.5 + 0.1 * r()), z: s * 2 + 1.6, root });
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
        // (a great lobe also sprouts on both flanks, so no side of the heap runs straight)
        const flank = level === 0 && (L.gen ?? 0) === 0 ? 2 : 0;
        for (let j = 0; j < k + flank; j++) {
          // round the upper rim and down both flanks (no straight side), more toward the sun
          const ang = j >= k ? -Math.PI * (j === k ? -0.06 + 0.2 * r() : 0.86 + 0.24 * r()) : -Math.PI * (0.02 + 1.1 * r());
          const cr = L.r * (level ? 0.2 + 0.25 * r() : 0.24 + 0.32 * r());
          const reach = L.r * (0.72 + 0.16 * r());
          const cy = L.y + Math.sin(ang) * reach;
          if (cy - cr > -2 && level) continue;
          next.push({ x: L.x + Math.cos(ang) * reach, y: cy, r: cr, z: L.z + 0.35 + 0.3 * r(), root: L.root, gen: level + 1 });
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
interface Mask { x0: number; y0: number; w: number; h: number; own: Int16Array; light: Float32Array; dist: Float32Array; lam: Float32Array; lobes: Lobe[] }

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

function maskOf(p: CloudP, seed: number, f: number): Mask {
  return cached(`cumask3|${seed}|${p.w}|${p.h}|${p.low ? 1 : 0}|${f}`, () => {
    const L = lobesOf(p, seed).map((o, i) => ({ ...o, r: o.r * (0.97 + 0.03 * Math.sin(f * 1.57 + i * 1.3)) }));
    const x0 = Math.floor(-p.w * 0.66), y0 = Math.floor(-p.h * 1.6), w = Math.ceil(p.w * 1.32), h = Math.ceil(p.h * 1.6) + 2;
    // the silhouette (every lobe, the small ones included), and the surface the light falls on:
    // the towers and billows as great domes, the small rim lobes only shallow bumps on them, so
    // the heap is lit as a few big planes, never as a pile of separate balls
    const own = new Int16Array(w * h).fill(-1);
    const zb = new Float32Array(w * h).fill(0);
    const zs = new Float32Array(w * h).fill(-1e9);
    L.forEach((o, i) => {
      const small = (o.gen ?? 0) > 0;
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
          const k = gy * w + gx;
          const z = o.z * p.h * 0.1 + Math.sqrt(q);
          if (z > zs[k]!) { zs[k] = z; own[k] = i; }
          const zz = small ? 0 : Math.sqrt(q) + o.z * p.h * 0.06;
          if (zz > zb[k]!) zb[k] = zz;
        }
      }
    });
    // how far the light travels through the heap to reach each px (on a 3 px grid, blurred)
    const G = 3, gw = Math.ceil(w / G), gh = Math.ceil(h / G);
    const ins = (gx: number, gy: number): boolean => {
      const x = Math.min(w - 1, gx * G + 1), y = Math.min(h - 1, gy * G + 1);
      return own[y * w + x]! >= 0;
    };
    const lg = new Float32Array(gw * gh);
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
    blur3(lg, gw, gh, 2);
    const light = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) light[y * w + x] = lg[Math.min(gh - 1, Math.floor(y / G)) * gw + Math.min(gw - 1, Math.floor(x / G))]!;
    // distance to the outside (chamfer), for the rims
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
    // the surface the light falls on: a dome over the whole silhouette (each tower rises with its
    // own width, never a valley between two lobes), with the great lobes' own domes on it,
    // smoothed, so the heap is lit as a few big turning planes
    for (let i = 0; i < w * h; i++) if (own[i]! >= 0) zb[i] = zb[i]! * 0.6 + Math.sqrt(Math.min(dist[i]!, p.h) * p.h * 0.45);
    blur3(zb, w, h, Math.max(1, Math.round(p.h * 0.035)));
    // the light on it: from the upper left and a little in front (the sun at the frame's upper
    // left), as a lambert term per px
    const Lx = -0.55, Ly = -0.68, Lz = 0.48;
    const lam = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (own[i]! < 0) continue;
      const gx = (zb[i + 1]! - zb[i - 1]!) * 0.5, gy = (zb[i + w]! - zb[i - w]!) * 0.5;
      const nl = Math.hypot(gx, gy, 1);
      lam[i] = (-gx * Lx - gy * Ly + Lz) / nl;
    }
    return { x0, y0, w, h, own, light, dist, lam, lobes: L };
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

/**
 * The heap as one mass in the sun: the surface's light in flat steps (lit white, half light,
 * the cool shade, the range's blue-grey core), dithered only where two steps meet; a cream rim
 * where the sun grazes the upper-left outline; the shade deepening where the light has crossed
 * the most cloud (the lower right) and along the underside; the base level, torn along its
 * edge, scraps hanging under it, then haze lenses.
 */
function paintCumulus(c: PaintCtx, p: CloudP): void {
  const b = c.buf, seed = c.seed;
  const f = (p.frame ?? 0) & 3;
  const M = maskOf(p, seed, f);
  const C = P.cloud, R = P.range;
  const baseH = p.h * (p.low ? 0.3 : 0.2);
  const X0 = Math.max(b.ox, Math.floor(c.X(M.x0))), X1 = Math.min(b.x1, Math.ceil(c.X(M.x0 + M.w)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(M.y0))), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.h * 0.06 + 2)));
  // the steps, light to dark, and where each begins on the tone scale
  const STEP = [C[0]!, C[1]!, C[2]!, C[3]!, R[1]!, R[2]!];
  const AT = [0, 0.28, 0.46, 0.6, 0.74, 0.88];
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
        // scraps torn off the base, hanging just under it in the shade
        const bd = baseAt(p, lx, seed) - ly;
        if (bd < 0 && bd > -p.h * 0.05 && gx >= 0 && gx < M.w) {
          const sc = vnoise(lx / 9, ly / 2.5, seed + 37) * vnoise1(lx / 40, seed + 38) - 0.25 + bd / (p.h * 0.1);
          if (sc > 0.12 && bayer4(x + f, y) < (sc > 0.28 ? 0.5 : 0.25)) { b.set(x, y, R[2]!); continue; }
        }
        const th = cov > 0.55 ? 0.5 : cov > 0.32 ? 0.25 : cov > 0.15 ? 0.125 : 0;
        if (bayer4(x + f, y) < th) b.set(x, y, C[cov > 0.5 ? 2 : 3]!);
        continue;
      }
      const k = gy * M.w + gx;
      const dist = M.dist[k]!;
      const lam = M.lam[k]!;
      // the base: level, but torn along its edge by holes at two scales, dissolving into the haze
      const bd = baseAt(p, lx, seed) - ly;
      const tear = p.h * (0.012 + 0.03 * vnoise1(lx / 11, seed + 39) * vnoise1(lx / 37, seed + 40));
      if (bd < tear) {
        const keep = bd / Math.max(1e-3, tear) + (vnoise(lx / 3.5, ly / 1.6, seed + 41) - 0.5) * 0.7;
        if (keep < 0.15 || bayer4(x + f, y) >= (keep > 0.7 ? 1 : keep > 0.45 ? 0.5 : 0.25)) continue;
      }
      // the shaded outline thins by dither (a soft edge), the lit outline stays crisp
      if (lam < 0.3 && dist < 2.5 && bayer4(x + f, y) >= dist / 2.8) continue;
      // the sun-grazed rim: cream, right on the lit outline, broken where small lobes turn away
      if (dist < 2.2 && lam > 0.62 && up > baseH * 0.8 && vnoise(lx / 6, ly / 6, seed + 42) > 0.25) { b.set(x, y, P.paper[0]!); continue; }
      const deep = clamp(M.light[k]! / (p.h * 0.55), 0, 1);
      const base = clamp(1 - up / baseH, 0, 1);
      let t = 0.56 - lam * 0.8 + deep * 0.28 + base * base * 0.42;
      // (the planes' edges wander at the lobes' scale: a cauliflower terminator, never a contour)
      t += (fbm(lx / 16, ly / 13, seed + 3, 2) - 0.5) * 0.16;
      t = clamp(t, 0, 0.99);
      // flat steps; the ordered dither only in a narrow band where two steps meet
      let i = 0;
      while (i + 1 < AT.length && t >= AT[i + 1]!) i++;
      const next = AT[i + 1] ?? 2;
      const near = (next - t) / 0.03;
      if (near < 1 && bayer4(x, y) > near) i = Math.min(STEP.length - 1, i + 1);
      // each lobe a bump on the mass: lit cap, a crisp crescent of shade on its far side from the
      // sun (no gradient inside it), and the shade a nearer lobe casts below it where it overhangs
      const o = M.lobes[M.own[k]!]!;
      const u = ((lx - o.x) * -0.62 + (ly - o.y) * -0.78) / o.r;
      if (u < -0.3 - 0.15 * vnoise1(Math.atan2(ly - o.y, lx - o.x) * 3, seed + 44) && i < 5) i++;
      // (in the shade a lobe's sunward cap catches the sky's light: the bumps read there too)
      else if (i >= 3 && u > 0.35 && (o.gen ?? 0) > 0) i--;
      const ux = Math.floor(lx - 2.4 - M.x0), uy = Math.floor(ly - 3 - M.y0);
      const oi = ux >= 0 && uy >= 0 ? M.own[uy * M.w + ux]! : -1;
      if (oi >= 0 && oi !== M.own[k]! && M.lobes[oi]!.z > o.z + 0.25 && i >= 1 && i < 4 && M.lobes[oi]!.r > o.r * 0.8) i++;
      b.set(x, y, STEP[i]!);
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


/**
 * A high, thin cloud field (altocumulus with a few cirrus strands): one or two steps off the sky
 * so it gives the upper sky texture without competing with the cumulus. Patches of small
 * rounded cells in loose wavy rows, bigger and denser in a patch's heart, thinning to single
 * dithered cells at its ragged edge; each cell a cool body with a lit upper-left edge and a
 * shaded underside; long thin strands of cirrus combed out by the wind, hooked at their ends.
 * Anchor: the middle of its band's base.
 */
function paintField(c: PaintCtx, p: CloudP): void {
  const b = c.buf, seed = c.seed;
  const f = (p.frame ?? 0) & 3;
  const C = P.cloud, R = P.range;
  const dens = p.density ?? 0.5;
  const X0 = Math.max(b.ox, Math.floor(c.X(-p.w / 2))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w / 2)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(-p.h))), Y1 = Math.min(b.y1, Math.ceil(c.Y(0)));
  // the patches: where the field is, and how thick (ragged at three scales, thinning at the band's ends and edges)
  const patch = (lx: number, ly: number): number => {
    const u = lx / (p.w / 2), v = (-ly) / p.h;
    const ends = clamp((1 - Math.abs(u)) * 4, 0, 1) * clamp(Math.min(v, 1 - v) * 5, 0, 1);
    return ends * (fbm(lx / 150, ly / 46, seed + 1, 3) * 1.25 - 0.62 + dens * 0.55 + 0.25 * (vnoise(lx / 31, ly / 11, seed + 2) - 0.5));
  };
  // fibres combed out by the wind: long thin streaks at several lengths, gathered into the
  // patches, thick and lit along their tops in a patch's heart, frayed to single dithered px at
  // its edges (no cells, no grid)
  const cov = (lx: number, ly: number): number => {
    const wy = ly + Math.sin(lx / 61 + seed) * 2.5 + (vnoise1(lx / 120, seed + 3) - 0.5) * 7;
    return patch(lx, ly) * 1.7 + (fbm(lx / 85, wy / 3.4, seed + 7, 3) - 0.5) * 1.5 + (vnoise(lx / 22, wy / 1.8, seed + 8) - 0.5) * 0.35;
  };
  for (let y = Y0; y < Y1; y++) {
    const ly = c.ly(y + 0.5);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5) + f * 0.5;
      const v = cov(lx, ly);
      let col = 0;
      if (v > 0.9) col = cov(lx, ly - 1.6 / c.d) <= 0.9 ? C[2]! : cov(lx, ly + 1.6 / c.d) <= 0.9 ? R[1]! : C[3]!;
      else if (bayer4(x, y) < (v > 0.66 ? 0.5 : v > 0.46 ? 0.25 : v > 0.3 ? 0.125 : 0)) col = v > 0.66 ? C[3]! : C[4]!;
      // cirrus strands: long thin threads, curving, hooked up at their east ends
      if (!col) {
        const nS = p.strands ?? 3;
        for (let i = 0; i < nS; i++) {
          const sx0 = (hash1(i, seed + 20) - 0.5) * p.w * 0.8, len = p.w * (0.18 + 0.2 * hash1(i, seed + 21));
          const u = (lx - sx0) / len;
          if (u < 0 || u > 1) continue;
          const sy = -p.h * (0.2 + 0.6 * hash1(i, seed + 22)) + Math.sin(u * 3.1 + i) * p.h * 0.06 - Math.pow(u, 4) * p.h * 0.18;
          for (let k = 0; k < 3; k++) {
            const off = (k - 1) * (2.5 + 1.5 * hash1(i * 3 + k, seed + 23)) + (vnoise1(lx / 40, seed + 24 + k) - 0.5) * 3;
            const d = Math.abs(ly - sy - off);
            const th = 0.6 + 0.5 * Math.sin(u * Math.PI) * (1 - Math.abs(k - 1) * 0.4);
            if (d < th && bayer4(x, y) < (0.5 - 0.35 * Math.abs(2 * u - 1)) * (vnoise1(lx / 13, seed + 25 + k) > 0.3 ? 1 : 0.4)) { col = C[3]!; break; }
          }
          if (col) break;
        }
      }
      if (col) b.set(x, y, col);
    }
  }
}

export const cloud = definePainter<CloudP>("op.cloud", {
  bounds(p) {
    if (p.kind === "field") return [-p.w / 2 - 2, -p.h - 2, p.w / 2 + 4, 2];
    if (p.kind === "stratus") return [-p.w / 2 - 4, -p.h * ((p.layers ?? 2) * 1.4 + 1.8) - 6, p.w / 2 + 4, p.h * 0.6 + 4];
    return [-p.w * 0.66 - 2, -p.h * 1.6 - 2, p.w * 0.66 + 2, p.h * 0.08 + 4];
  },
  paint(c, p) {
    if (p.kind === "field") paintField(c, p);
    else if (p.kind === "stratus") paintStratus(c, p);
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

/** The isle's hanging underside: a slab under the top and lobes of torn limestone of very different lengths. */
interface IsleShape { lobes: [number, number, number][]; slab: number }

function isleShape(p: IsleP, seed: number): IsleShape {
  return cached(`isle2|${seed}|${p.w}|${p.h}`, () => {
    const r = rng(seed + 11);
    const lobes: [number, number, number][] = [];
    // three hanging masses with gaps between them: the longest left of centre (toward the light),
    // the others much shorter, one each side, each of its own width
    const big = Math.floor(r() * 2);
    for (let i = 0; i < 3; i++) {
      const u = [-0.4, 0.1, 0.55][i]! + (r() - 0.5) * 0.16;
      const len = p.h * (i === big ? 0.82 + 0.18 * r() : 0.32 + 0.3 * r());
      lobes.push([u * p.w * 0.5, len, p.w * (i === big ? 0.2 + 0.06 * r() : 0.13 + 0.08 * r())]);
    }
    return { lobes, slab: p.h * (0.16 + 0.08 * r()) };
  });
}

/** How far the rock hangs below the top at lx (0 where there is none). */
function isleUnder(p: IsleP, lx: number, seed: number): number {
  const S = isleShape(p, seed);
  const u = lx / (p.w / 2);
  if (Math.abs(u) >= 1) return 0;
  // the slab: thick in the middle, thinning to a ragged lip at both ends
  let d = S.slab * Math.pow(1 - u * u, 0.6);
  for (const [x, len, hw] of S.lobes) {
    const k = Math.abs(lx - x) / hw;
    if (k >= 1) continue;
    // a hanging mass: full where it leaves the slab, rounding off into a knobbed bottom (a bulb
    // of rock and roots, never a spike)
    d = Math.max(d, S.slab * 0.5 + len * Math.pow(1 - k * k, 0.85) * (0.84 + 0.24 * vnoise1(lx / 6, seed + 3) + 0.1 * vnoise1(lx / 1.8, seed + 13)));
  }
  return d * (0.92 + 0.16 * fbm1(lx / 4, seed + 1, 2));
}

/** The isle's top at lx: a low mound, higher toward the middle (px above its anchor, negative up). */
function isleTop(p: IsleP, lx: number, seed: number): number {
  const u = lx / (p.w / 2);
  return -p.w * 0.1 * (1 - u * u) - 3 * vnoise1(lx / 9, seed + 2) - 1.5 * vnoise1(lx / 3, seed + 12) + 2;
}

/** A small hazy clump of trees on the isle: bumps lit on their upper left, no outline. */
function isleClump(c: PaintCtx, cx: number, cy: number, r: number, seed: number): void {
  const b = c.buf;
  const R = P.range;
  const X0 = Math.floor(c.X(cx - r * 1.4)), X1 = Math.ceil(c.X(cx + r * 1.4)), Y0 = Math.floor(c.Y(cy - r * 1.5)), Y1 = Math.ceil(c.Y(cy + r * 0.7));
  for (let y = Math.max(Y0, b.oy); y < Math.min(Y1, b.y1); y++) {
    for (let x = Math.max(X0, b.ox); x < Math.min(X1, b.x1); x++) {
      const dx = c.lx(x + 0.5) - cx, dy = c.ly(y + 0.5) - cy;
      const ang = Math.atan2(dy, dx);
      const rim = r * (0.82 + 0.3 * vnoise1(ang * 2.2 + 5, seed));
      if (Math.hypot(dx, dy > 0 ? dy * 1.4 : dy) > rim) continue;
      const lit = Math.hypot(dx + rim * 0.3, dy + rim * 0.38) < rim * 0.7;
      const shade = Math.hypot(dx + rim * 0.15, dy + rim * 0.2) > rim * 0.95 || dy > r * 0.25;
      b.set(x, y, lit ? P.pine[0]! : shade ? R[6]! : P.pine[1]!);
    }
  }
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
    const S = isleShape(p, seed);
    // the rock: a floating limestone island seen side-on. Lit on its upper left, the lobes'
    // shaded right sides and tips darker, a lit ledge under the top's lip, fissures down it
    // (a few columns past the buffer's edges too: a root swaying across a tile's edge is painted
    // the same from both sides)
    const X0 = Math.max(b.ox - 3, Math.floor(c.X(-p.w / 2))), X1 = Math.min(b.x1 + 3, Math.ceil(c.X(p.w / 2)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const depth = isleUnder(p, lx, seed);
      if (depth <= 0) continue;
      const top = isleTop(p, lx, seed);
      // which lobe this column hangs in, and where in it (for its own light and shade)
      let side = (lx / (p.w / 2)) * 0.5;
      for (const [lx0, len, hw] of S.lobes) {
        if (Math.abs(lx - lx0) < hw && S.slab * 0.6 + len * Math.pow(1 - Math.abs(lx - lx0) / hw, 1.4) >= depth * 0.9) side = (lx - lx0) / hw;
      }
      const fis = vnoise1(lx / 2.2, seed + 6) > 0.8 && vnoise1(lx / 13, seed + 7) > 0.4;
      for (let y = Math.max(b.oy, Math.floor(c.Y(top))); y < Math.min(b.y1, Math.ceil(c.Y(depth))); y++) {
        const ly = c.ly(y + 0.5);
        const k = (ly - top) / Math.max(1, depth - top);
        let t = 0.3 + 0.32 * side + 0.35 * k;
        if (ly - top < 3) t -= 0.15;
        if (fis && k > 0.1) t += 0.18;
        if (ly > depth - 2 / d) t += 0.12;
        // (flat steps; dither only in a narrow band where two meet)
        const tt = clamp(t, 0, 1) * (R.length - 1);
        const i = Math.floor(tt), fr = tt - i;
        b.set(x, y, R[Math.min(R.length - 1, i + (fr > 0.62 || (fr > 0.38 && bayer4(x, y) < (fr - 0.38) / 0.24) ? 1 : 0))]!);
      }
      // moss draping over the lip on the lit side, roots hanging from the underside
      if (lx < p.w * 0.2) {
        const md = (2 + 5 * vnoise1(lx / 4, seed + 8)) * clamp(0.6 - lx / p.w, 0, 1);
        for (let a = 0; a < md; a += 0.5 / d) b.set(x, Math.floor(c.Y(top + a)), a < md - 1 ? P.karst[5]! : R[5]!);
      }
      if (hash1(Math.floor(lx / 3), seed + 4) < 0.14 && d >= 0.5) {
        const len = 5 + 18 * hash1(Math.floor(lx / 3), seed + 5);
        for (let a = 0; a < len; a += 0.5 / d) {
          const X = Math.floor(c.X(lx + Math.sin(a / 5 + lx) * 0.8)), Y = Math.floor(c.Y(depth - 1 + a));
          if (a > len * 0.6 && bayer4(X, Y) < 0.5) continue;
          b.set(X, Y, R[a < len * 0.5 ? 6 : 5]!);
        }
      }
    }
    // a thread of water from a spring on top, over the right lip, falling clear of the rock and
    // fraying into a scrap of cloud below
    const fx = p.w * 0.3;
    const lipY = isleUnder(p, fx + 3, seed);
    for (let ly = isleTop(p, fx, seed); ly < lipY + 80; ly += 0.5 / d) {
      const below = ly - lipY;
      const sway = below > 0 ? Math.sin(below / 11) * 0.8 + below * 0.03 : 0;
      const X = Math.round(c.X(fx + 3 + sway)), Y = Math.round(c.Y(ly));
      if (below > 0 && bayer4(X, Y) > 1 - below / 70) continue;
      b.set(X, Y, P.cloud[below > 30 ? 1 : 0]!);
    }
    // the scrap of cloud it frays into
    for (let y = Math.floor(c.Y(lipY + 52)); y < Math.ceil(c.Y(lipY + 82)); y++) {
      for (let x = Math.floor(c.X(fx - 18)); x < Math.ceil(c.X(fx + 26)); x++) {
        const u = (c.lx(x + 0.5) - fx - 4) / 22, v = (c.ly(y + 0.5) - lipY - 68) / 8;
        const cov = (1 - u * u - v * v) + (vnoise(c.lx(x + 0.5) / 6, c.ly(y + 0.5) / 3, seed + 9) - 0.5) * 0.9;
        if (cov > 0.55 && v < 0.2) b.set(x, y, v < -0.3 ? P.cloud[1]! : P.cloud[2]!);
        else if (bayer4(x, y) < (cov > 0.3 ? 0.5 : cov > 0.1 ? 0.25 : 0)) b.set(x, y, P.cloud[2]!);
      }
    }
    // trees on the top, round the tower's foot: clumps of very different sizes
    const r = rng(seed + 7);
    const tw = p.w * (p.tower === "bell" ? 0.22 : 0.32);
    for (let i = 0; i < Math.round(p.w / 3.2); i++) {
      const tx = (r() - 0.5) * p.w * 0.92;
      const v = r();
      const tr = v < 0.25 ? 6 + 4 * r() : v < 0.6 ? 3.5 + 2 * r() : 2 + 1.2 * r();
      // (behind the tower's foot only the small ones; the big ones flank it)
      if (Math.abs(tx) < tw * 0.5 && tr > 4) continue;
      isleClump(c, tx, isleTop(p, tx, seed) - tr * 0.35, tr, seed + i * 17);
    }
    // the tower: lacquer gone pale with distance, lit on its left, gold ridges, a warm window
    const tiers = p.tower === "bell" ? 3 : 2;
    let y = isleTop(p, 0, seed) - 1;
    for (let t = 0; t < tiers; t++) {
      const sw = tw * (1 - t * 0.2);
      const sh = p.w * (p.tower === "bell" ? 0.15 : 0.18);
      for (let yy = Math.floor(c.Y(y - sh)); yy < Math.ceil(c.Y(y)); yy++) {
        for (let x = Math.floor(c.X(-sw / 2)); x < Math.ceil(c.X(sw / 2)); x++) {
          const u = (c.lx(x + 0.5) + sw / 2) / sw;
          const win = Math.abs(u - 0.5) < 0.12 && c.ly(yy + 0.5) > y - sh * 0.7 && c.ly(yy + 0.5) < y - sh * 0.3;
          b.set(x, yy, win ? P.gold[1]! : R[u < 0.12 ? 3 : u < 0.45 ? 4 : 5]!);
        }
      }
      const rh = sh * 0.6;
      for (let yy = Math.floor(c.Y(y - sh - rh)); yy < Math.ceil(c.Y(y - sh + 1)); yy++) {
        const v = (y - sh - c.ly(yy + 0.5)) / rh;
        const rw = sw * (1.55 - 0.95 * v) + (v < 0.2 ? (0.2 - v) * sw * 1.4 : 0);
        for (let x = Math.floor(c.X(-rw / 2)); x < Math.ceil(c.X(rw / 2)); x++) {
          const lx = c.lx(x + 0.5);
          b.set(x, yy, v > 0.88 ? P.gold[3]! : R[lx < -rw * 0.2 ? 4 : v < 0.25 ? 6 : 5]!);
        }
      }
      y -= sh + rh * 0.65;
    }
  },
});
