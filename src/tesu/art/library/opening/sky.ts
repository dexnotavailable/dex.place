// The opening's sky (P0): morning clouds and the two sky isles. Clouds are authored in code
// (Dex: clouds, fog, mist and haze are freestyle, never traced).
//
// Cumulus: a heap of overlapping round lobes on a flat base, the big ones low and behind, the
// smaller ones riding up the front; each lobe lit on its upper left (a warm cream rim where the
// sun grazes it), cool in its lower right, a crease of shadow where a front lobe overlaps one
// behind it, a flat blue-grey underside, the outermost rim dithered so the edge is soft. Stratus:
// long flat bands with low lobes along their tops, fraying into streaks at both ends.
// `frame` (0..3) churns the rims and lobes a little for the drifting sprites.
//
// The isles: two floating karst islands far off (Bell and Drum), painted in the haze's own
// values so they sit in the distance: a forested top, a tower each with a warm window, the rock
// beneath hanging in ragged lobes that taper to points, roots and a thread of water trailing off
// one edge into a scrap of cloud at its foot.

import { definePainter, type PaintCtx } from "../../painter.ts";
import { P } from "../../palette.ts";
import { bayer4, clamp, fbm1, hash1, rng, vnoise1 } from "../../raster.ts";
import { cached } from "./kit.ts";

export interface CloudP {
  kind?: "cumulus" | "stratus";
  /** Width and height of the cloud, px of the sky plane; anchor at the middle of its base. */
  w: number;
  h: number;
  /** For stratus: how many bands (1 to 3). */
  layers?: number;
  frame?: number;
}

interface Lobe { x: number; y: number; r: number }

function lobesOf(p: CloudP, seed: number): Lobe[] {
  return cached(`cu|${seed}|${p.w}|${p.h}`, () => {
    const r = rng(seed + 5);
    const out: Lobe[] = [];
    // the heap's profile: tallest a little left of centre, a long low tail to the right
    const peak = -0.12 + (r() - 0.5) * 0.2;
    const prof = (u: number): number => Math.max(0.18, Math.exp(-Math.pow((u - peak) / 0.3, 2)) * 0.85 + 0.25 * Math.exp(-Math.pow((u - 0.35) / 0.25, 2)));
    // big inner lobes fill the body; many small lobes make the bumpy rim
    for (let i = 0; i < 26; i++) {
      const u = (r() - 0.5) * 1.8;
      const top = p.h * prof(u * 0.5);
      const rr = p.h * (0.16 + 0.16 * r()) * (0.6 + 0.6 * prof(u * 0.5));
      out.push({ x: u * p.w * 0.27, y: -Math.min(top - rr * 0.6, rr * 0.8 + r() * (top - rr)), r: rr });
    }
    for (let i = 0; i < 90; i++) {
      const u = (r() - 0.5) * 1.9;
      const top = p.h * prof(u * 0.5);
      const rr = p.h * (0.06 + 0.09 * r());
      // on the upper outline
      out.push({ x: u * p.w * 0.27, y: -top + rr * (0.4 + 0.8 * r()), r: rr });
    }
    return out;
  });
}

/** The cloud as a mask on a 2 px grid (level-1 px), built once per cloud and frame. */
interface Mask { x0: number; y0: number; w: number; h: number; m: Uint8Array; light: Float32Array }

function maskOf(p: CloudP, seed: number, f: number): Mask {
  return cached(`cumask|${seed}|${p.w}|${p.h}|${f}`, () => {
    const L = lobesOf(p, seed).map((o, i) => ({ ...o, r: o.r * (0.97 + 0.03 * Math.sin(f * 1.57 + i)) }));
    const x0 = -p.w * 0.62, y0 = -p.h * 1.25, w = Math.ceil(p.w * 1.24 / 2), h = Math.ceil(p.h * 1.27 / 2);
    const m = new Uint8Array(w * h);
    for (const o of L) {
      const gx0 = Math.max(0, Math.floor((o.x - o.r - x0) / 2)), gx1 = Math.min(w - 1, Math.ceil((o.x + o.r - x0) / 2));
      const gy0 = Math.max(0, Math.floor((o.y - o.r - y0) / 2)), gy1 = Math.min(h - 1, Math.ceil((o.y + o.r - y0) / 2));
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
        const dx = x0 + gx * 2 + 1 - o.x, dy = y0 + gy * 2 + 1 - o.y;
        if (dx * dx + dy * dy <= o.r * o.r && y0 + gy * 2 + 1 <= 0) m[gy * w + gx] = 1;
      }
    }
    // the path length to the sun from every cell (how deep in the cloud, seen from the light)
    const light = new Float32Array(w * h);
    for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) {
      if (!m[gy * w + gx]) continue;
      let len = 0;
      for (let s = 1; s < 120; s++) {
        const sx = Math.round(gx - 0.62 * s), sy = Math.round(gy - 0.78 * s);
        if (sx < 0 || sy < 0 || !m[sy * w + sx]) break;
        len = s * 2;
      }
      light[gy * w + gx] = len;
    }
    return { x0, y0, w, h, m, light };
  });
}

function sample(M: Mask, x: number, y: number): number {
  const gx = Math.floor((x - M.x0) / 2), gy = Math.floor((y - M.y0) / 2);
  if (gx < 0 || gy < 0 || gx >= M.w || gy >= M.h || !M.m[gy * M.w + gx]) return -1;
  return M.light[gy * M.w + gx]!;
}

function paintCumulus(c: PaintCtx, p: CloudP): void {
  const b = c.buf, seed = c.seed;
  const f = (p.frame ?? 0) & 3;
  const M = maskOf(p, seed, f);
  const X0 = Math.max(b.ox, Math.floor(c.X(-p.w * 0.62))), X1 = Math.min(b.x1, Math.ceil(c.X(p.w * 0.62)));
  const Y0 = Math.max(b.oy, Math.floor(c.Y(-p.h * 1.25))), Y1 = Math.min(b.y1, Math.ceil(c.Y(3)));
  const C = P.cloud;
  for (let y = Y0; y < Y1; y++) {
    const ly = c.ly(y + 0.5);
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const len = sample(M, lx, ly);
      if (len < 0) {
        if (ly > 0 && ly < 2.5 && sample(M, lx, -1) >= 0 && bayer4(x, y) < 0.35) b.set(x, y, P.range[1]!);
        continue;
      }
      // soft edges: the outermost cells on the shadow side dither out
      const shadowEdge = sample(M, lx + 2.4, ly + 2.4) < 0 || sample(M, lx, ly + 3) < 0;
      if (shadowEdge && bayer4(x + f, y) < 0.45) continue;
      const depth = clamp(len / (p.h * 0.55), 0, 1);
      const base = clamp((ly + p.h * 0.22) / (p.h * 0.22), 0, 1);
      // texture: faint lobe-sized mottling, never bubbles
      const mott = (vnoise1(lx / (p.h * 0.09) + ly / (p.h * 0.07), seed + 3) - 0.5) * 0.1;
      let t = 0.04 + depth * 0.5 + base * 0.32 + mott;
      if (len <= 3 && ly < -p.h * 0.15) {
        b.set(x, y, P.paper[0]!);
        continue;
      }
      t = clamp(t, 0, 1);
      // stepped bands, dithered only across a narrow seam between steps
      let i = Math.floor(t * 6.99);
      const fr = t * 6.99 - i;
      if (fr > 0.62 || (fr > 0.38 && bayer4(x, y) < (fr - 0.38) / 0.24)) i++;
      b.set(x, y, i <= 4 ? C[Math.min(4, i)]! : P.range[Math.min(3, i - 4)]!);
    }
  }
}

function paintStratus(c: PaintCtx, p: CloudP): void {
  const b = c.buf, d = c.d, seed = c.seed;
  const f = (p.frame ?? 0) & 3;
  const layers = Math.max(1, Math.min(3, p.layers ?? 2));
  const r = rng(seed + 9);
  const C = P.cloud;
  for (let k = 0; k < layers; k++) {
    const x0 = -p.w / 2 + p.w * 0.25 * r() * (k ? 1 : 0), x1 = p.w / 2 - p.w * 0.2 * r() * (k ? 1 : 0);
    const by = -k * p.h * 0.9 - p.h * 0.2 * r();
    const th = p.h * (0.6 + 0.4 * r()) * (1 - k * 0.2);
    const s = seed + k * 31;
    const X0 = Math.max(b.ox, Math.floor(c.X(x0))), X1 = Math.min(b.x1, Math.ceil(c.X(x1)));
    for (let x = X0; x < X1; x++) {
      const lx = c.lx(x + 0.5);
      const t = (lx - x0) / (x1 - x0);
      const body = Math.pow(Math.sin(Math.PI * clamp(t, 0, 1)), 0.6) * (0.7 + 0.5 * fbm1(lx / (th * 8), s, 3));
      const lobe = th * 0.5 * Math.abs(Math.sin(lx / (th * 1.4) + vnoise1(lx / (th * 5), s + 1) * 3)) * body;
      const top = by - th * body - lobe;
      const ends = Math.min(t, 1 - t);
      const Yt = Math.floor(c.Y(top)), Yb = Math.ceil(c.Y(by + 1));
      for (let y = Math.max(Yt, b.oy); y < Math.min(Yb, b.y1); y++) {
        const ly = c.ly(y + 0.5);
        // the ends fray into streaks: alternate rows, then dither
        if (ends < 0.18 && ((Math.floor(ly) + f) & 1) && bayer4(x, y) > ends * 5) continue;
        const v = (ly - top) / Math.max(1, by - top);
        const col = v < 0.2 ? (lx < 0 ? P.paper[0]! : C[0]!) : v < 0.6 ? C[1]! : v < 0.85 ? C[2]! : C[3]!;
        if (y === Yt && bayer4(x + f, y) < 0.5) continue;
        b.set(x, y, col);
      }
    }
  }
  void d;
}

export const cloud = definePainter<CloudP>("op.cloud", {
  bounds(p) {
    if (p.kind === "stratus") return [-p.w / 2 - 4, -p.h * (1 + (p.layers ?? 2)) * 1.4 - 6, p.w / 2 + 4, 4];
    return [-p.w * 0.66, -p.h * 1.3, p.w * 0.66, 6];
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
