// The opening's sky (P0): morning clouds and the two sky isles. Clouds are authored in code
// (Dex: clouds, fog, mist and haze are freestyle, never traced).
//
// Cumulus: a cauliflower heap. A few towers of very different sizes stand on a flat base (the
// tallest left of centre, toward the sun), the big ones carrying a second billow; every lobe
// sprouts smaller lobes round its upper rim, and those sprout smaller ones again, so the
// silhouette is lumpy at three scales, never a triangle or a straight flank. Each lobe is shaded
// as a ball lit from the upper left (a cream rim where the sun grazes it), the heap's big planes
// broken into billows of very different sizes (each its own ball, the lower one in front), most
// where the light turns, deeper shade the further the light has to travel through the heap, and blue-grey (the far range's ramp) along the flat underside, which sits on a thin
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

/** The ordered-dither threshold on cells of k art px (two screen px at the catch's 2x). */
const bay = (x: number, y: number, k: number): number => bayer4(Math.floor(x / k), Math.floor(y / k));

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
  return cached(`cu4|${seed}|${p.w}|${p.h}|${p.low ? 1 : 0}`, () => {
    const r = rng(seed + 5);
    const W = p.w, H = p.h;
    const out: Lobe[] = [];
    if (p.low) {
      // towers: sizes very different, the tallest left of centre
      const n = 3 + Math.floor(r() * 2);
      const order = [1, 0.62, 0.45, 0.38].slice(0, n);
      // the biggest stands second from the left; the rest fall away to the right in a long tail
      const slots: number[] = [];
      for (let i = 0; i < n; i++) slots.push(-0.44 + (0.88 * (i + 0.2 + 0.6 * r())) / n);
      const place = [order[1]!, order[0]!, ...order.slice(2)];
      for (let i = 0; i < n; i++) {
        const s = place[i]!;
        const rr = H * 0.5 * s * (0.9 + 0.2 * r());
        const x = slots[i]! * W;
        const y = -rr * (0.62 + 0.2 * r());
        const root = out.length;
        out.push({ x, y, r: rr, z: s * 2 + r() * 0.3, root });
        if (s > 0.6) out.push({ x: x + (r() - 0.6) * rr * 0.5, y: y - rr * (0.75 + 0.25 * r()), r: rr * (0.74 + 0.14 * r()), z: s * 2 + 1, root });
        if (s > 0.6) out.push({ x: x + rr * (0.5 + 0.2 * r()), y: y - rr * (0.3 + 0.3 * r()), r: rr * (0.5 + 0.12 * r()), z: s * 2 + 0.6, root });
      }
      // low filler lobes along the base so the towers stand on one body
      const m = Math.round(W / (H * 0.18));
      for (let i = 0; i < m; i++) {
        const u = -0.5 + (i + r()) / m;
        const rr = H * (0.06 + 0.2 * r() * r()) * (1 - Math.abs(u) * 0.8);
        out.push({ x: u * W, y: -rr * 0.55, r: rr, z: 0.5 + r(), root: out.length });
      }
    } else {
      // clean clusters with sky between them (Dex's cloud reference): a great tower left of
      // centre (toward the sun), a lower heap right of it, a stray puff off the end. Each a row
      // of big billows on its flat base, billows stacked up the tower (smaller as they rise,
      // leaning toward the sun), billows bulging from its flanks: very different sizes
      const CL: [number, number, number][] = [[-0.18 + 0.06 * r(), 0.5, 1], [0.27 + 0.05 * r(), 0.3, 0.42 + 0.12 * r()], [0.47, 0.07, 0.17]];
      CL.forEach(([cu, cw0, ch0], ci) => {
        if (ci === 2 && r() < 0.35) return;
        const cw = cw0 * W, ch = ch0 * H, cx = cu * W;
        const root = out.length;
        // the base row
        const nb = ci === 2 ? 2 : 3 + Math.floor(r() * 2);
        for (let i = 0; i < nb; i++) {
          const u = -0.5 + (i + 0.25 + 0.5 * r()) / nb;
          const rr = Math.min(ch * 0.36, cw / nb) * (0.62 + 0.4 * r()) * (1 - Math.abs(u) * 0.35);
          out.push({ x: cx + u * cw, y: -rr * (0.55 + 0.15 * r()), r: rr, z: 1 + r() * 0.6 + (1 - Math.abs(u)), root });
        }
        // shoulders: big billows standing on the base row either side of the tower, of their
        // own sizes, so the heap is broad and stepped, never a column
        if (ci < 2) for (const side of [-1, 1]) {
          if (ci === 1 && r() < 0.5) continue;
          const rs = ch * (side < 0 ? 0.26 + 0.08 * r() : 0.2 + 0.1 * r());
          out.push({ x: cx + side * cw * (0.18 + 0.1 * r()), y: -ch * (0.3 + 0.08 * r()), r: rs, z: 2 + r() * 0.4, root });
        }
        // the tower: billows stacked up it, smaller as they rise, stepping toward the sun, the
        // odd billow bulging from a flank (each its own side and size)
        const ns = ci === 0 ? 3 : ci === 1 ? 1 + Math.floor(r() * 2) : 0;
        let y = -ch * 0.5, x = cx - cw * 0.04, rr = ch * 0.26;
        for (let k = 0; k < ns; k++) {
          out.push({ x: x + (r() - 0.5) * rr * 0.5, y, r: rr * (0.9 + 0.2 * r()), z: 2.6 + k * 0.5 + r() * 0.3, root });
          if (r() < 0.55) {
            const side = r() < 0.6 ? -1 : 1;
            out.push({ x: x + side * rr * (0.7 + 0.25 * r()), y: y + rr * (0.15 + 0.35 * r()), r: rr * (0.35 + 0.3 * r()), z: 2.9 + k * 0.5, root });
          }
          y -= rr * (0.85 + 0.25 * r());
          x -= rr * (0.05 + 0.2 * r());
          rr *= 0.74 + 0.12 * r();
          if (-y + rr > ch) break;
        }
      });
    }
    // every rim sprouts smaller lobes, twice: cauliflower
    let gen = out.slice();
    for (let level = 0; level < 2; level++) {
      const next: Lobe[] = [];
      for (const L of gen) {
        if (L.r < H * 0.05) continue;
        // (fewer rim lobes of very different sizes: never a row of like scallops)
        const k = 2 + Math.floor(r() * (level ? 2 : 3));
        // (a great lobe also sprouts on both flanks, so no side of the heap runs straight)
        const flank = level === 0 && (L.gen ?? 0) === 0 ? 2 : 0;
        for (let j = 0; j < k + flank; j++) {
          // round the upper rim and down both flanks (no straight side), more toward the sun
          const ang = j >= k ? -Math.PI * (j === k ? -0.06 + 0.2 * r() : 0.86 + 0.24 * r()) : -Math.PI * (0.02 + 1.1 * r());
          const cr = L.r * (level ? 0.14 + 0.3 * r() : 0.16 + 0.46 * r() * r() + 0.08 * r());
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
  return -p.h * (0.012 + 0.045 * vnoise1(lx / 95, seed + 35) + 0.025 * vnoise1(lx / 38, seed + 33) + 0.014 * vnoise1(lx / 12, seed + 34));
}

/** The heap as fields on a 1 px grid (level-1 px), built once per cloud and frame. */
interface Mask { x0: number; y0: number; w: number; h: number; own: Int16Array; light: Float32Array; dist: Float32Array; lam: Float32Array; lobes: Lobe[]; tex: Int16Array; billows: Lobe[] }

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
  return cached(`cumask6|${seed}|${p.w}|${p.h}|${p.low ? 1 : 0}|${f}`, () => {
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
    // the billows over the whole heap (Dex's painterly cumulus): small balls of very different
    // sizes packed over the silhouette, each lower one standing in front of the one above it, so
    // every part of the heap, the shade included, reads as a crowd of lit tops over shaded
    // undersides, never a flat plane cut by straight creases (round-3 integration)
    const billows: Lobe[] = [];
    const rb = rng(seed + 91);
    // (sizes very different and grouped: a few great billows, mid ones, small ones mostly up on
    // the sunlit crown where the heap boils; never a sheet of like scales)
    const cell = Math.max(6, p.h * 0.12);
    for (let gy = 0; gy < h; gy += cell * 0.7) {
      const row = Math.floor(gy / (cell * 0.7));
      for (let gx = (row % 2) * cell * 0.5; gx < w; gx += cell * (0.75 + 0.6 * rb())) {
        const jx = gx + (rb() - 0.5) * cell * 0.7, jy = gy + (rb() - 0.5) * cell * 0.5;
        const ix = Math.floor(jx), iy = Math.floor(jy);
        if (ix < 0 || iy < 0 || ix >= w || iy >= h || own[iy * w + ix]! < 0) continue;
        const hi = clamp(1 - (dist[iy * w + ix]! / (cell * 2.2)), 0, 1);
        const g = rb();
        const rr = cell * (g < 0.18 ? 1.3 + 0.7 * rb() : g < 0.7 ? 0.6 + 0.45 * rb() : 0.3 + 0.2 * rb()) * (1 - hi * 0.35);
        billows.push({ x: x0 + jx, y: y0 + jy, r: rr, z: jy / cell + rb() * 0.9, root: 0 });
      }
    }
    const tex = new Int16Array(w * h).fill(-1);
    const tz = new Float32Array(w * h).fill(-1e9);
    billows.forEach((o, i) => {
      const gx0 = Math.max(0, Math.floor(o.x - o.r - x0)), gx1 = Math.min(w - 1, Math.ceil(o.x + o.r - x0));
      const gy0 = Math.max(0, Math.floor(o.y - o.r - y0)), gy1 = Math.min(h - 1, Math.ceil(o.y + o.r - y0));
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
        const k = gy * w + gx;
        if (own[k]! < 0) continue;
        const dx = x0 + gx + 0.5 - o.x, dy = y0 + gy + 0.5 - o.y;
        // (a ball's outline wanders a little: no billow is a compass circle)
        const rr = o.r * (1 + (vnoise1(Math.atan2(dy, dx) * 2.2 + i, seed + 92) - 0.5) * 0.22);
        const q = rr * rr - dx * dx - dy * dy;
        if (q < 0) continue;
        const z = o.z + Math.sqrt(q) / rr * 0.35;
        if (z > tz[k]!) { tz[k] = z; tex[k] = i; }
      }
    });
    return { x0, y0, w, h, own, light, dist, lam, lobes: L, tex, billows };
  });
}

/** The wisps torn off the base, hanging under it: [x, y below the base, half length, half thickness]. */
function skirtOf(p: CloudP, seed: number): [number, number, number, number][] {
  return cached(`cuskirt2|${seed}|${p.w}|${p.h}`, () => {
    const r = rng(seed + 41);
    const out: [number, number, number, number][] = [];
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) out.push([(r() - 0.5) * p.w * 0.85, p.h * (0.01 + 0.045 * r()), p.w * (0.03 + 0.09 * r()), p.h * (0.008 + 0.014 * r())]);
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
  const b = c.buf, seed = c.seed, kc = Math.max(1, Math.round(c.d));
  const bd = (x: number, y: number): number => bayer4(Math.floor(x / kc), Math.floor(y / kc));
  const f = (p.frame ?? 0) & 3;
  const M = maskOf(p, seed, f);
  const C = P.cloud, R = P.range;
  const baseH = p.h * (p.low ? 0.3 : 0.2);
  const X0 = Math.max(b.ox, Math.floor(c.X(M.x0))), X1 = Math.min(b.x1, Math.ceil(c.X(M.x0 + M.w)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(M.y0))), Y1 = Math.min(b.y1, Math.ceil(c.Y(p.h * 0.08 + 2)));
  // the steps, light to dark, and where each begins on the tone scale: warm paper where the
  // morning sun strikes the tops, the cloud's cool whites in the half light, the range's
  // blue-grey in the shade and along the underside
  const STEP = [P.paper[0]!, C[1]!, C[2]!, C[3]!, R[2]!, R[3]!];
  const AT = [0, 0.27, 0.42, 0.55, 0.69, 0.84];
  const wisps = skirtOf(p, seed);
  for (let y = Y0; y < Y1; y++) {
    const ly = c.ly(y + 0.5);
    const gy = Math.floor(ly - M.y0);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const gx = Math.floor(lx - M.x0);
      const up = -ly;
      if (gx < 0 || gy < 0 || gx >= M.w || gy >= M.h || M.own[gy * M.w + gx]! < 0) {
        // wisps torn off the base: long thin streaks hanging under it, solid in their cores,
        // one cell of dither at their ends and edges (never a band along the base)
        for (const [wx, wy, hl, ht] of wisps) {
          const u = (lx - wx) / hl;
          if (u <= -1 || u >= 1) continue;
          const yc = baseAt(p, lx, seed) + wy + (vnoise1(lx / 37, seed + 35 + Math.round(wx)) - 0.5) * ht * 3 - u * u * ht * 1.5;
          const th = ht * (1 - u * u) * (0.5 + vnoise1(lx / 17, seed + 36 + Math.round(wx)));
          const v = Math.abs(ly - yc);
          if (v > th) continue;
          if ((th - v) * c.d < kc && bd(x + f, y) >= 0.5) break;
          b.set(x, y, ly < yc ? C[3]! : R[2]!);
          break;
        }
        continue;
      }
      const k = gy * M.w + gx;
      const dist = M.dist[k]!;
      const lam = M.lam[k]!;
      // the base: flat-ish, but torn along its edge by holes at two scales into wisps
      const bd0 = baseAt(p, lx, seed) - ly;
      const tear = p.h * (0.014 + 0.04 * vnoise1(lx / 11, seed + 39) * vnoise1(lx / 37, seed + 40));
      if (bd0 < tear) {
        const keep = bd0 / Math.max(1e-3, tear) + (vnoise(lx / 5, ly / 1.6, seed + 41) - 0.5) * 0.8;
        if (keep < 0.3 || (keep < 0.45 && bd(x + f, y) >= 0.5)) continue;
      }
      // the shaded outline softens by one cell of dither; the lit outline stays crisp
      if (lam < 0.3 && dist * c.d < kc * 1.2 && bd(x + f, y) >= 0.5) continue;
      const o = M.lobes[M.own[k]!]!;
      // the sun-grazed rim: warm paper right on the lit outline, broken where lobes turn away
      if (dist < 2.2 && lam > 0.6 && up > baseH * 0.8 && vnoise(lx / 6, ly / 6, seed + 42) > 0.25) { b.set(x, y, P.ember[0]!); continue; }
      const deep = clamp(M.light[k]! / (p.h * 0.55), 0, 1);
      const base = clamp(1 - up / baseH, 0, 1);
      // each lobe its own body (its own ball in the sun, mixed with the heap's big planes), so
      // the heap reads as separate overlapping billows of different sizes, never one smooth mass
      // and never soap bubbles
      // (round-3 integration: the light is the heap's big planes mixed with the ball of the
      // billow at this px, so the planes break into billows everywhere; no per-tower seam)
      const ti = M.tex[k]!;
      let own = lam;
      if (ti >= 0) {
        const bo = M.billows[ti]!;
        const nx = clamp((lx - bo.x) / bo.r, -1, 1), ny = clamp((ly - bo.y) / bo.r, -1, 1);
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        // (lit from the upper left: the sun's direction is (-0.55, -0.68, 0.48))
        own = -nx * 0.55 - ny * 0.68 + nz * 0.48;
      }
      // (the billows read most where the light turns, least on the broad sunlit tops and along
      // the flat base)
      const bw = (0.2 + 0.36 * Math.exp(-(((lam - 0.32) / 0.32) ** 2))) * (1 - clamp(1 - up / baseH, 0, 1) * 0.7);
      const lamM = lam * (1 - bw) + own * bw;
      let t = 0.56 - lamM * 0.85 + deep * 0.26 + base * base * 0.45;
      // (the planes' edges wander at the lobes' scale: a cauliflower terminator, never a contour)
      t += (fbm(lx / 22, ly / 18, seed + 3, 2) - 0.5) * 0.07;
      t = clamp(t, 0, 0.99);
      // flat steps; one cell of dither only in a narrow band where two steps meet
      let i = 0;
      while (i + 1 < AT.length && t >= AT[i + 1]!) i++;
      const next = AT[i + 1] ?? 2;
      const near = (next - t) / 0.025;
      if (near < 1 && bd(x, y) > near) i = Math.min(STEP.length - 1, i + 1);
      // a crisp crescent of shade on a lobe's far side from the sun
      const u = ((lx - o.x) * -0.62 + (ly - o.y) * -0.78) / o.r;
      if ((o.gen ?? 0) > 0 && u < -0.3 - 0.15 * vnoise1(Math.atan2(ly - o.y, lx - o.x) * 3, seed + 44) && i < 4) i++;
      // (in the shade a lobe's sunward cap catches the sky's light: the bumps read there too)
      else if (i >= 4 && u > 0.35 && (o.gen ?? 0) > 0) i--;
      // (the crease a great lobe cast on the one behind it is gone: at that size its arc read as a
      // straight crack, a facet; the billows' own undersides now carry the shade between them)
      // (a small bulge on the shaded side catches the sky's light: never a dark hole in the heap)
      if ((o.gen ?? 0) > 0 && i > 3) i = 3;
      // the morning's warmth: the lit faces near the sunward outline take the ember's cream, a
      // band a few px deep (wider on the big billows), so the tops read warm and the rest cool
      if (i === 0 && dist < 4 + o.r * 0.12 && lamM > 0.5) { b.set(x, y, P.ember[0]!); continue; }
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
  const kc = Math.max(1, Math.round(c.d));
  // (the band's underside a step cooler again, its lowest px)
  const L1 = p.h * 0.28;
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
      // torn lobes: solid where the band is thick, one cell of dither on their edges, clear sky
      // through the tears; the cloud's own texture breaks it up, so no edge of it runs as a line
      const cv = best * (0.65 + 0.7 * vnoise(lx / (p.h * 1.1), ly / (p.h * 0.45), seed + 4));
      if (cv < 0.56) continue;
      if (cv < 0.63) { if (bay(x + f, y, kc) < 0.5) b.set(x, y, C[below > 0 ? 3 : 2]!); continue; }
      // a core: warm where the morning sun strikes its top (toward the sun most), cool below
      const lit = below < -p.h * 0.25 && vnoise(lx / (p.h * 2), ly / p.h, seed + 5) > 0.45 - (lx < 0 ? 0.15 : 0);
      b.set(x, y, lit ? (lx < 0 ? P.paper[0]! : P.paper[1]!) : below < 0 ? C[2]! : below < L1 ? C[3]! : P.range[1]!);
    }
  }
  void d;
}


/**
 * A high, thin cloud band (cirrostratus combed out by the wind), not a field of streaks: one
 * shaped band per piece, thick in its middle and tapering to frayed ends, its top and bottom
 * wandering at two scales, with clear sky round it. Its body a step or two off the sky, a few
 * long fibres of different thickness running along it (a step lighter or cooler), a lit top
 * edge on the sun side and a cool underside; one cell of dither only on its edges; hooked
 * strands trailing off its ends. `density` sets how thick the band is. Anchor: the middle of
 * its box's base.
 */
function paintField(c: PaintCtx, p: CloudP): void {
  const b = c.buf, seed = c.seed, kc = Math.max(1, Math.round(c.d));
  const f = (p.frame ?? 0) & 3;
  const C = P.cloud;
  const dens = p.density ?? 0.5;
  const X0 = Math.max(b.ox, Math.floor(c.X(-p.w / 2))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w / 2)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(-p.h))), Y1 = Math.min(b.y1, Math.ceil(c.Y(0)));
  // the band's centre line and half thickness along it
  const tilt = (hash1(1, seed + 30) - 0.5) * p.h * 0.5;
  const mid = (lx: number): number => -p.h * 0.5 + tilt * (lx / p.w) + Math.sin(lx / (p.w * 0.23) + seed) * p.h * 0.1 + (vnoise1(lx / 140, seed + 31) - 0.5) * p.h * 0.18;
  const half = (lx: number): number => {
    const u = lx / (p.w / 2);
    if (Math.abs(u) >= 1) return 0;
    const env = Math.pow(1 - u * u, 0.7) * (0.45 + 0.8 * vnoise1(lx / 170, seed + 32));
    return p.h * (0.06 + 0.2 * dens) * env;
  };
  for (let y = Y0; y < Y1; y++) {
    const ly = c.ly(y + 0.5);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5) + f * 0.5;
      const m = mid(lx), hw = half(lx);
      // top and bottom wander at two scales; a few tears where the wind has pulled it thin
      const top = m - hw * (0.8 + 0.5 * vnoise1(lx / 41, seed + 33) + 0.2 * (vnoise1(lx / 9, seed + 34) - 0.5));
      const bot = m + hw * (0.55 + 0.35 * vnoise1(lx / 53, seed + 35));
      let col = 0;
      // (a tear or two where the wind has pulled it apart: long, never holes)
      if (hw > 0.5 && ly > top && ly < bot) {
        const e = Math.min(ly - top, bot - ly) * c.d;
        if (e < kc && bay(x, y, kc) >= 0.5) continue;
        // fibres along it: long streaks of different thickness, following its curve
        const v = (ly - m) / Math.max(1, hw);
        const fib = vnoise(lx / 90, v * 2.2 + 3, seed + 37) + 0.25 * vnoise(lx / 30, v * 5, seed + 38);
        // its upper part catching the light, its lower part cooler, fibres between (never a
        // contour round it)
        const zv = (ly - top) / Math.max(1, bot - top);
        col = zv < 0.32 && fib > 0.42 ? C[2]! : zv > 0.74 && fib < 0.75 ? C[4]! : fib > 0.92 ? C[2]! : fib < 0.42 ? C[4]! : C[3]!;
      }
      // cirrus strands trailing off its ends: thin threads, curving, hooked up at their east ends
      if (!col) {
        const nS = p.strands ?? 3;
        for (let i = 0; i < nS; i++) {
          const east = hash1(i, seed + 20) < 0.5;
          const len = p.w * (0.1 + 0.12 * hash1(i, seed + 21));
          const sx0 = east ? p.w * (0.32 + 0.1 * hash1(i, seed + 26)) : -p.w * (0.42 + 0.06 * hash1(i, seed + 26)) - len * 0.2;
          const u = (lx - sx0) / len;
          if (u < 0 || u > 1) continue;
          const sy = mid(sx0) + (hash1(i, seed + 22) - 0.5) * p.h * 0.3 + Math.sin(u * 3.1 + i) * p.h * 0.05 - Math.pow(u, 4) * p.h * 0.16;
          if (Math.abs(ly - sy) < 0.55 + 0.5 * Math.sin(u * Math.PI) && vnoise1(lx / 9, seed + 25 + i) > 0.35) { col = C[3]!; break; }
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

/**
 * (round 4, Dex's crop of "the floating isle with its pagoda": a pale spike of icicles under a box
 * tower) The isle is a chunk of bedded karst torn out of the ground, side-on, as Dex's terrain
 * sketch builds rock: under its turf a slab, then blocks of very different widths, each broken off
 * at its own depth along the joints, so the underside steps down to its deepest hang left of the
 * middle and back up to the lips: an inverted, irregular stack of chunks, never a point. Bedding
 * lines cross it, every block lit on its left and turning into shade, the undersides darkest, the
 * side of a block hanging lower than its neighbour showing. Roots and creepers hang from the
 * blocks' feet; a thread of water falls off one lip into a scrap of cloud.
 */
interface IsleBlock { x0: number; x1: number; dep: number; tn: number; seed: number }
interface IsleShape { blocks: IsleBlock[]; slab: number; beds: number[] }

function isleShape(p: IsleP, seed: number): IsleShape {
  return cached(`isle4|${seed}|${p.w}|${p.h}`, () => {
    const r = rng(seed + 11);
    const hw = p.w / 2;
    const slab = p.h * (0.15 + 0.05 * r());
    // the deepest hang: left of the middle (toward the light), or a little right of it
    const peak = r() < 0.6 ? -0.3 + 0.15 * r() : 0.05 + 0.15 * r();
    const blocks: IsleBlock[] = [];
    let x = -hw - 1;
    let last = slab;
    while (x < hw + 1) {
      const bw = Math.min(hw + 1 - x, 4 + r() * 10 + (r() < 0.3 ? 5 + r() * 6 : 0));
      const u = (x + bw / 2) / hw;
      const span = u < peak ? 1 + peak : 1 - peak;
      const e = clamp(1 - Math.abs(u - peak) / (span + 0.04), 0, 1);
      let dep = slab + (p.h - slab) * Math.pow(e, 1.25) * (0.5 + 0.55 * r());
      // at the lips only a thin slab with a broken edge
      if (Math.abs(u) > 0.84) dep = slab * (0.45 + 0.6 * r());
      // a step from its neighbour, never the same depth
      if (Math.abs(dep - last) < 3) dep += (r() < 0.5 ? -1 : 1) * (3 + 3 * r());
      dep = Math.max(slab * 0.4, dep);
      blocks.push({ x0: x, x1: x + bw, dep, tn: (r() - 0.5) * 0.12, seed: Math.floor(r() * 1e6) });
      last = dep;
      x += bw;
    }
    // no block hangs far below both its neighbours on its own (a pillar, not a chunk): the deep hang
    // is two or three blocks together, each stepping from the next
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < blocks.length; i++) {
      const nb = Math.max(blocks[i - 1]?.dep ?? 0, blocks[i + 1]?.dep ?? 0);
      const B = blocks[i]!;
      if (B.dep > nb + Math.max(6, (p.h - slab) * 0.22) && B.x1 - B.x0 < 20) B.dep = nb + Math.max(6, (p.h - slab) * 0.22) * (0.6 + 0.4 * hash1(i, seed + 12));
    }
    const beds = [slab * (0.45 + 0.2 * r()), slab + (p.h - slab) * (0.22 + 0.1 * r()), slab + (p.h - slab) * (0.5 + 0.15 * r())];
    return { blocks, slab, beds };
  });
}

function isleBlock(S: IsleShape, lx: number): number {
  let lo = 0, hi = S.blocks.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S.blocks[m]!.x0 <= lx) lo = m; else hi = m - 1; }
  return lo;
}

/** How far the rock hangs below the top at lx (0 where there is none): its block's broken foot. */
function isleUnder(p: IsleP, lx: number, seed: number): number {
  const S = isleShape(p, seed);
  if (Math.abs(lx) >= p.w / 2) return 0;
  const B = S.blocks[isleBlock(S, lx)]!;
  const w = B.x1 - B.x0, e = Math.min(lx - B.x0, B.x1 - lx);
  // its foot: near flat, a little lumpy, the corners chipped round (no spikes)
  const rc = Math.min(2.5, w * 0.3);
  const corner = e < rc ? (rc - Math.sqrt(Math.max(0, rc * rc - (rc - e) * (rc - e)))) * 1.2 : 0;
  return B.dep + (fbm1(lx / 3, B.seed, 2) - 0.5) * 1.6 - corner;
}

/** The isle's top at lx: a low mound, higher toward the middle (px above its anchor, negative up). */
function isleTop(p: IsleP, lx: number, seed: number): number {
  const u = lx / (p.w / 2);
  return -p.w * 0.1 * (1 - u * u) - 3 * vnoise1(lx / 9, seed + 2) - 1.5 * vnoise1(lx / 3, seed + 12) + 2;
}

/** Hazy greens for the isle's trees: lit, body, shade (cool, into the range's blue-grey). */
const ISLE_GREEN = [P.moss[3]!, P.pine[0]!, P.pine[1]!, P.range[5]!, P.range[6]!];

/**
 * A tree on the isle, small with distance: a broadleaf crown of a few bumps (lit on its upper left,
 * a dark pocket under it, a trunk showing below), or a cloud pine of two to four flat pads on a
 * leaning trunk. Never one round blob.
 */
function isleTree(c: PaintCtx, cx: number, foot: number, r: number, seed: number, pine: boolean): void {
  const b = c.buf, d = c.d;
  const px = (lx: number, ly: number, col: number): void => b.set(Math.floor(c.X(lx)), Math.floor(c.Y(ly)), col);
  const lean = (hash1(1, seed) - 0.5) * 0.5;
  const H = pine ? r * 2.6 : r * 1.9;
  // the trunk
  for (let s = 0; s < H * (pine ? 0.92 : 0.55); s += 0.5 / d) px(cx + lean * s * (pine ? 0.5 : 0.3), foot - s, s < H * 0.2 ? P.range[6]! : P.timber[4]!);
  if (pine) {
    const n = 2 + Math.floor(hash1(2, seed) * 3);
    for (let i = 0; i < n; i++) {
      const v = (i + 0.6) / (n + 0.2);
      const py = foot - H * (0.35 + 0.62 * v), pxc = cx + lean * (foot - py) * 0.5 + (hash1(i + 3, seed) - 0.5) * r * 0.6;
      const pw = r * (1.25 - 0.55 * v) * (0.8 + 0.4 * hash1(i + 5, seed)), ph = Math.max(1.2, r * 0.42);
      for (let y = Math.floor(c.Y(py - ph)); y < Math.ceil(c.Y(py + ph * 0.5)); y++) {
        for (let x = Math.floor(c.X(pxc - pw)); x < Math.ceil(c.X(pxc + pw)); x++) {
          const dx = (c.lx(x + 0.5) - pxc) / pw, dy = (c.ly(y + 0.5) - py) / ph;
          if (dx * dx + (dy < 0 ? dy * dy : dy * dy * 3) > 1 + (vnoise1(c.lx(x + 0.5) / 1.6, seed + i) - 0.5) * 0.5) continue;
          b.set(x, y, dy < -0.45 ? (dx < 0.2 ? ISLE_GREEN[1]! : ISLE_GREEN[2]!) : dy < 0.2 ? ISLE_GREEN[2]! : ISLE_GREEN[3]!);
        }
      }
    }
    return;
  }
  // broadleaf: three to five bumps heaped into one crown, the biggest at the back and top
  const nb = 3 + Math.floor(hash1(3, seed) * 3);
  const crownY = foot - H * 0.62;
  for (let i = 0; i < nb; i++) {
    const a = (hash1(i + 10, seed) - 0.5) * 2.6;
    const br = r * (0.42 + 0.3 * hash1(i + 20, seed)) * (i === 0 ? 1.25 : 1);
    const bx = cx + Math.sin(a) * r * 0.62 + lean * H * 0.3, by = crownY - Math.cos(a) * r * 0.32 + (i / nb) * r * 0.35;
    for (let y = Math.floor(c.Y(by - br)); y < Math.ceil(c.Y(by + br)); y++) {
      for (let x = Math.floor(c.X(bx - br)); x < Math.ceil(c.X(bx + br)); x++) {
        const dx = c.lx(x + 0.5) - bx, dy = c.ly(y + 0.5) - by;
        const q = Math.hypot(dx, dy * 1.1) / (br * (0.86 + 0.28 * vnoise1(Math.atan2(dy, dx) * 2.4 + i, seed + 30)));
        if (q > 1) continue;
        const lit = (-0.62 * dx - 0.78 * dy) / br;
        b.set(x, y, lit > 0.5 && q > 0.35 ? ISLE_GREEN[0]! : lit > 0.05 ? ISLE_GREEN[1]! : lit > -0.45 ? ISLE_GREEN[2]! : ISLE_GREEN[3]!);
      }
    }
  }
}

/**
 * A pagoda, small with distance and pale in the haze: on a stone plinth, tiers of plastered wall
 * between dark posts, a warm lit window in each, a balcony rail, and over each tier a roof of dark
 * tile whose eaves sweep out and turn up at their tips, its ridge and the eaves' edge catching the
 * sun; a finial with rings on top. `tiers` 3 (the bell tower, slender) or 2 (the drum tower, broad).
 */
function pagoda(c: PaintCtx, foot: number, w: number, tiers: number, seed: number): number {
  const b = c.buf;
  const R = P.range, T = P.tile;
  const fill = (x0: number, x1: number, y0: number, y1: number, col: (lx: number, ly: number) => number): void => {
    for (let y = Math.floor(c.Y(y0)); y < Math.ceil(c.Y(y1)); y++) for (let x = Math.floor(c.X(x0)); x < Math.ceil(c.X(x1)); x++) {
      const k = col(c.lx(x + 0.5), c.ly(y + 0.5));
      if (k) b.set(x, y, k);
    }
  };
  // the plinth: two courses of stone, lit on top and on the left
  const pw = w * 0.62;
  fill(-pw / 2, pw / 2, foot - 4, foot + 1, (lx, ly) => (ly < foot - 3 ? R[1]! : lx < -pw / 2 + 1.2 ? R[2]! : ly > foot - 1 ? R[5]! : R[3]!));
  let y = foot - 4;
  for (let t = 0; t < tiers; t++) {
    const sw = w * (0.46 - t * 0.07) * (tiers === 2 ? 1.25 : 1);
    const sh = w * (tiers === 2 ? 0.17 : 0.14) * (1 - t * 0.08);
    const yt = y - sh;
    // the wall: posts at its corners, plaster between, lit on the left; a warm window (a lattice
    // of two lights) in the middle; a balcony rail along its foot on the upper tiers
    fill(-sw / 2, sw / 2, yt, y, (lx, ly) => {
      const u = (lx + sw / 2) / sw, v = (ly - yt) / sh;
      if (u < 0.1 || u > 0.9) return u < 0.1 ? R[4]! : R[6]!;
      // the eaves' shadow across the top of the wall
      if (v < 0.2) return u < 0.5 ? R[4]! : R[5]!;
      if (Math.abs(u - 0.5) < 0.16 && v > 0.28 && v < 0.78) return Math.abs(u - 0.5) < 0.03 ? P.gold[3]! : v < 0.4 ? P.gold[0]! : P.gold[1]!;
      if (t > 0 && v > 0.82) return v > 0.92 ? R[6]! : R[3]!;
      return u < 0.3 ? R[1]! : u < 0.7 ? R[2]! : R[3]!;
    });
    // the roof: eaves wider than the wall, the underside sweeping up to the tips, the slope
    // concave from the ridge, dark tile with the eave's lit edge and a gold ridge
    const ew = sw * (tiers === 2 ? 1.95 : 1.85) + 2, rh = sh * (t === tiers - 1 ? 0.95 : 0.7);
    const yb = yt + 0.5;
    fill(-ew / 2 - 1.5, ew / 2 + 1.5, yb - rh - 2.5, yb + 1, (lx, ly) => {
      const q = Math.abs(lx) / (ew / 2);
      if (q > 1.06) return 0;
      // the eave's underside: level near the wall, turning up hard at the tip
      const under = yb - Math.pow(Math.max(0, (q - 0.5) / 0.5), 2.4) * rh * 0.95;
      // the slope: concave, from the ridge (narrow) down to the eave
      const ridgeW = t === tiers - 1 ? 0.1 : 0.42;
      const topY = q < ridgeW ? yb - rh : yb - rh + Math.pow((q - ridgeW) / (1 - ridgeW), 0.62) * rh * 0.8 - Math.pow(Math.max(0, (q - 0.8) / 0.26), 2) * rh * 0.85;
      if (ly < topY - 0.01 || ly > under) return 0;
      if (ly - topY < 1 / Math.max(c.d, 0.5)) return q < ridgeW + 0.05 ? P.gold[2]! : lx < 0 ? T[1]! : T[2]!;
      if (under - ly < 1 / Math.max(c.d, 0.5)) return q > 0.9 ? P.gold[2]! : T[1]!;
      // tile rows running down the slope, lit on the sun side
      if (Math.round(lx * Math.max(c.d, 0.5)) % 3 === 0 && ly - topY > 1.5) return lx < -ew * 0.15 ? T[3]! : T[4]!;
      return lx < -ew * 0.15 ? T[2]! : T[3]!;
    });
    y = yb - rh * (t === tiers - 1 ? 1 : 0.62);
  }
  // the finial: a mast with rings, its tip catching the light
  const fh = w * 0.16;
  fill(-0.6, 0.6, y - fh, y + 0.5, (lx, ly) => (Math.round(ly - y) % 3 === 0 ? P.gold[2]! : lx < 0 ? P.gold[1]! : P.gold[3]!));
  void seed;
  return y - fh;
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
    const hw = p.w / 2;
    const one = 1 / Math.max(d, 0.5);
    // the rock: blocks under a slab, lit from the upper left, in the haze's own values (a few
    // columns past the buffer's edges too: a root swaying across a tile's edge paints the same)
    const X0 = Math.max(b.ox - 3, Math.floor(c.X(-hw))), X1 = Math.min(b.x1 + 3, Math.ceil(c.X(hw)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const depth = isleUnder(p, lx, seed);
      if (depth <= 0) continue;
      const top = isleTop(p, lx, seed);
      const bi = isleBlock(S, lx);
      const B = S.blocks[bi]!;
      const L = S.blocks[bi - 1], Rb = S.blocks[bi + 1];
      const bw = B.x1 - B.x0, u = (lx - B.x0) / bw;
      const across = (lx + hw) / p.w;
      for (let y = Math.max(b.oy, Math.floor(c.Y(top))); y < Math.min(b.y1, Math.ceil(c.Y(depth))); y++) {
        const ly = c.ly(y + 0.5);
        const s = ly - top;
        let t = 0.2 + 0.26 * across + 0.24 * clamp(s / Math.max(1, depth - top), 0, 1) + B.tn;
        // the turf's shadow under its lip, then the slab's lit brow
        if (s < 1.6) t += 0.2;
        else if (s < 3.2) t -= 0.12;
        // a block hanging lower than a neighbour shows its side: lit on the left, shaded right
        if (L && ly > top + L.dep - 1 && u * bw < 1.6) t -= 0.14;
        if (Rb && ly > top + Rb.dep - 1 && (1 - u) * bw < 2) t += 0.16;
        // the joints between blocks, below the slab
        if (s > S.slab * 0.8 && u * bw < one * 0.9 && L && Math.abs(L.dep - B.dep) > 2) t += 0.22;
        // bedding lines, each with a lit lip under it
        for (const bd of S.beds) {
          const by = bd + (vnoise1(lx / 9, seed + 40) - 0.5) * 2;
          if (Math.abs(s - by) < 0.5 * one) t += 0.2;
          else if (s - by > 0.5 * one && s - by < 1.6 * one) t -= 0.07;
        }
        // its foot: the underside in shadow, the lake's light faint along the very edge
        if (depth - ly < 2.2 * one) t += 0.16;
        // weathering in streaks
        if (d >= 0.5 && vnoise(lx / 2.4, ly / 11, seed + 41) > 0.7) t += 0.07;
        const tt = clamp(t, 0, 1) * (R.length - 1);
        const i = Math.floor(tt), fr = tt - i;
        b.set(x, y, R[Math.min(R.length - 1, i + (fr > 0.62 || (fr > 0.38 && bay(x, y, Math.max(1, Math.round(d))) < (fr - 0.38) / 0.24) ? 1 : 0))]!);
      }
      // turf over the lip: a green rim, moss draping down the lit side
      const md = 1.5 + (2 + 4 * vnoise1(lx / 4, seed + 8)) * clamp(0.65 - lx / p.w, 0.15, 1);
      for (let a = -1; a < md; a += 0.5 / d) b.set(x, Math.floor(c.Y(top + a)), a < 0 ? ISLE_GREEN[1]! : a < md - 1 ? ISLE_GREEN[2]! : ISLE_GREEN[3]!);
      // roots and creepers hanging from the blocks' feet
      if (hash1(Math.floor(lx / 2.5), seed + 4) < 0.16 && d >= 0.5) {
        const len = 4 + 14 * hash1(Math.floor(lx / 2.5), seed + 5);
        for (let a = 0; a < len; a += 0.5 / d) {
          const X = Math.floor(c.X(lx + Math.sin(a / 5 + lx) * 0.8)), Y = Math.floor(c.Y(depth - 1 + a));
          if (a > len * 0.6 && bay(X, Y, Math.max(1, Math.round(d))) < 0.5) continue;
          b.set(X, Y, a < len * 0.5 ? R[6]! : hash1(Math.floor(a), seed + Math.floor(lx)) < 0.3 ? ISLE_GREEN[2]! : R[5]!);
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
      if (below > 0 && bay(X, Y, Math.max(1, Math.round(d))) > 1 - below / 70) continue;
      b.set(X, Y, P.cloud[below > 30 ? 1 : 0]!);
    }
    // the scrap of cloud it frays into
    for (let y = Math.floor(c.Y(lipY + 52)); y < Math.ceil(c.Y(lipY + 82)); y++) {
      for (let x = Math.floor(c.X(fx - 18)); x < Math.ceil(c.X(fx + 26)); x++) {
        const u = (c.lx(x + 0.5) - fx - 4) / 22, v = (c.ly(y + 0.5) - lipY - 68) / 8;
        const cov = (1 - u * u - v * v) + (vnoise(c.lx(x + 0.5) / 6, c.ly(y + 0.5) / 3, seed + 9) - 0.5) * 0.9;
        if (cov > 0.55 && v < 0.2) b.set(x, y, v < -0.3 ? P.cloud[1]! : P.cloud[2]!);
        else if (cov > 0.3 && bay(x, y, Math.max(1, Math.round(d))) < 0.5) b.set(x, y, P.cloud[2]!);
      }
    }
    // trees on the top round the tower's foot: crowns and cloud pines of very different sizes,
    // the small ones behind, the big ones flanking it
    const r = rng(seed + 7);
    const tw = p.w * (p.tower === "bell" ? 0.22 : 0.32);
    const trees: [number, number, boolean][] = [];
    for (let i = 0; i < Math.round(p.w / 6); i++) {
      const tx = (r() - 0.5) * p.w * 0.9;
      const v = r();
      const tr = v < 0.25 ? 4.5 + 3 * r() : v < 0.6 ? 3 + 1.5 * r() : 1.8 + r();
      const pine = r() < 0.35;
      if (Math.abs(tx) < tw * 0.55 && tr > 3) continue;
      trees.push([tx, tr, pine]);
    }
    trees.sort((a, q) => a[1] - q[1]);
    const behind = trees.filter(([tx]) => Math.abs(tx) < tw * 0.75), around = trees.filter(([tx]) => Math.abs(tx) >= tw * 0.75);
    for (const [tx, tr, pine] of behind) isleTree(c, tx, isleTop(p, tx, seed) + 0.5, tr, seed + Math.round(tx * 13), pine);
    pagoda(c, isleTop(p, 0, seed) - 0.5, p.w, p.tower === "bell" ? 3 : 2, seed);
    for (const [tx, tr, pine] of around) isleTree(c, tx, isleTop(p, tx, seed) + 0.5, tr, seed + Math.round(tx * 13), pine);
  },
});
