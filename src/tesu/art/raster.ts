// Indexed pixel buffers and the primitives every Tesu painter draws with.
//
// A buffer covers a rectangle of one plane at one density: art px [ox, ox + w) x
// [oy, oy + h) of that plane's level. Painters draw in those absolute art px and the
// buffer clips, so a plate tile and a whole-place preview are painted by the same code.
// Pixels are palette indices (art/palette.ts); 0 is empty.

export type Fill = number | ((x: number, y: number) => number);

export class IdxBuf {
  readonly px: Uint8Array;
  readonly w: number;
  readonly h: number;
  /** Absolute art px of the buffer's top-left pixel. */
  readonly ox: number;
  readonly oy: number;
  /** Art px per level-1 px (1 at play zoom; 0.5, 0.25 ... for the wider levels). */
  readonly d: number;
  constructor(w: number, h: number, ox = 0, oy = 0, d = 1) {
    this.w = w;
    this.h = h;
    this.ox = ox;
    this.oy = oy;
    this.d = d;
    this.px = new Uint8Array(w * h);
  }

  get x1(): number { return this.ox + this.w; }
  get y1(): number { return this.oy + this.h; }

  /** Does the buffer cover absolute art px (x, y)? */
  has(x: number, y: number): boolean {
    x = Math.floor(x) - this.ox;
    y = Math.floor(y) - this.oy;
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** Overlaps the absolute rectangle [x0, x1) x [y0, y1)? */
  touches(x0: number, y0: number, x1: number, y1: number): boolean {
    return x1 > this.ox && y1 > this.oy && x0 < this.x1 && y0 < this.y1;
  }

  get(x: number, y: number): number {
    x = Math.floor(x) - this.ox;
    y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x]!;
  }

  set(x: number, y: number, c: number): void {
    if (c <= 0) return;
    x = Math.floor(x) - this.ox;
    y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  /** Sets only where nothing is painted yet (draw behind). */
  under(x: number, y: number, c: number): void {
    if (c <= 0) return;
    x = Math.floor(x) - this.ox;
    y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (this.px[i] === 0) this.px[i] = c;
  }

  clear(x: number, y: number): void {
    x = Math.floor(x) - this.ox;
    y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = 0;
  }

  /** Fills [x0, x1) x [y0, y1) (absolute art px, rounded), clipped. */
  rect(x0: number, y0: number, x1: number, y1: number, f: Fill): void {
    const ax = Math.max(Math.round(x0), this.ox), bx = Math.min(Math.round(x1), this.x1);
    const ay = Math.max(Math.round(y0), this.oy), by = Math.min(Math.round(y1), this.y1);
    for (let y = ay; y < by; y++) {
      const row = (y - this.oy) * this.w - this.ox;
      for (let x = ax; x < bx; x++) {
        const c = typeof f === "number" ? f : f(x, y);
        if (c > 0) this.px[row + x] = c;
      }
    }
  }

  /** One row span, x0 and x1 inclusive pixel columns. */
  span(y: number, x0: number, x1: number, f: Fill): void {
    if (y < this.oy || y >= this.y1) return;
    const ax = Math.max(x0, this.ox), bx = Math.min(x1, this.x1 - 1);
    const row = (y - this.oy) * this.w - this.ox;
    for (let x = ax; x <= bx; x++) {
      const c = typeof f === "number" ? f : f(x, y);
      if (c > 0) this.px[row + x] = c;
    }
  }

  /** Bresenham line between pixel centres. */
  line(x0: number, y0: number, x1: number, y1: number, f: Fill): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 100000; guard++) {
      this.set(x0, y0, typeof f === "number" ? f : f(x0, y0));
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Filled ellipse about (cx, cy) with radii rx, ry (pixel centres inside). */
  ellipse(cx: number, cy: number, rx: number, ry: number, f: Fill): void {
    if (rx <= 0 || ry <= 0) return;
    const y0 = Math.max(Math.floor(cy - ry), this.oy), y1 = Math.min(Math.ceil(cy + ry), this.y1 - 1);
    for (let y = y0; y <= y1; y++) {
      const t = (y + 0.5 - cy) / ry;
      if (t * t > 1) continue;
      const half = rx * Math.sqrt(1 - t * t);
      this.span(y, Math.ceil(cx - half - 0.5), Math.floor(cx + half - 0.5), f);
    }
  }

  disc(cx: number, cy: number, r: number, f: Fill): void {
    this.ellipse(cx, cy, r, r, f);
  }

  /** Even-odd scanline fill of a polygon (flat [x, y, x, y, ...] in absolute art px). */
  poly(pts: readonly number[], f: Fill): void {
    const sp = new Spans(pts, this.oy, this.y1);
    for (let y = sp.y0; y < sp.y1; y++) {
      const row = sp.row(y);
      for (let i = 0; i + 1 < row.length; i += 2) this.span(y, row[i]!, row[i + 1]!, f);
    }
  }

  /** Copies another buffer's painted pixels over this one (same density, absolute coords). */
  stamp(src: IdxBuf, dx = 0, dy = 0): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.px[y * src.w + x]!;
        if (c) this.set(src.ox + x + dx, src.oy + y + dy, c);
      }
    }
  }

  /** True when nothing was painted. */
  empty(): boolean {
    const p = this.px;
    for (let i = 0; i < p.length; i++) if (p[i]) return false;
    return true;
  }
}

/**
 * Row spans of a polygon, at pixel centres, for rows [yA, yB). `inside()` answers for any
 * pixel in those rows; rows outside are computed on demand, so outlines can look one
 * pixel past the buffer edge and stay seamless across plate tiles.
 */
export class Spans {
  readonly y0: number;
  readonly y1: number;
  private rows = new Map<number, number[]>();
  private minY: number;
  private maxY: number;
  private pts: readonly number[];

  constructor(pts: readonly number[], yA: number, yB: number) {
    this.pts = pts;
    let mn = Infinity, mx = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      mn = Math.min(mn, pts[i]!);
      mx = Math.max(mx, pts[i]!);
    }
    this.minY = mn;
    this.maxY = mx;
    this.y0 = Math.max(yA, Math.floor(mn));
    this.y1 = Math.min(yB, Math.ceil(mx) + 1);
  }

  /** Inclusive [x0, x1] pixel column pairs inside the polygon on row y. */
  row(y: number): number[] {
    let r = this.rows.get(y);
    if (r) return r;
    r = [];
    const yc = y + 0.5;
    if (yc >= this.minY && yc <= this.maxY) {
      const xs: number[] = [];
      const p = this.pts, n = p.length / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = p[i * 2]!, yi = p[i * 2 + 1]!, xj = p[j * 2]!, yj = p[j * 2 + 1]!;
        if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = Math.ceil(xs[i]! - 0.5), b = Math.floor(xs[i + 1]! - 0.5);
        if (b >= a) r.push(a, b);
      }
    }
    if (this.rows.size > 4096) this.rows.clear();
    this.rows.set(y, r);
    return r;
  }

  inside(x: number, y: number): boolean {
    const r = this.row(y);
    for (let i = 0; i + 1 < r.length; i += 2) {
      if (x < r[i]!) return false;
      if (x <= r[i + 1]!) return true;
    }
    return false;
  }

  /** Inside, with at least one of the 4 neighbours outside. */
  edge(x: number, y: number): boolean {
    return this.inside(x, y) && (!this.inside(x - 1, y) || !this.inside(x + 1, y) || !this.inside(x, y - 1) || !this.inside(x, y + 1));
  }
}

// ---------------------------------------------------------------------------
// Noise and dither. All deterministic integer hashing: the same art px always gets
// the same value, in every tile, on every device.
// ---------------------------------------------------------------------------

/** 32-bit integer hash of (x, y, seed) to [0, 1). */
export function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 1D hash. */
export function hash1(x: number, seed = 0): number {
  return hash(x, 0x5bd1e995, seed);
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise, period-free, in [0, 1). */
export function vnoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** 1D value noise. */
export function vnoise1(x: number, seed = 0): number {
  const xi = Math.floor(x), f = smooth(x - xi);
  const a = hash1(xi, seed), b = hash1(xi + 1, seed);
  return a + (b - a) * f;
}

/** Fractal value noise in [0, 1). */
export function fbm(x: number, y: number, seed = 0, octaves = 4): number {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise(x, y, seed + o * 101) * amp;
    norm += amp;
    x *= 2.03; y *= 2.03; amp *= 0.5;
  }
  return sum / norm;
}

export function fbm1(x: number, seed = 0, octaves = 4): number {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise1(x, seed + o * 101) * amp;
    norm += amp;
    x *= 2.03; amp *= 0.5;
  }
  return sum / norm;
}

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4x4 ordered-dither threshold in (0, 1). */
export function bayer4(x: number, y: number): number {
  return (B4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;
}

const B8: number[] = (() => {
  const m: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v = 4 * B4[((y & 3) << 2) | (x & 3)]! + [0, 2, 3, 1][((y >> 2) << 1) | (x >> 2)]!;
      m.push(v);
    }
  }
  return m;
})();
/** 8x8 ordered-dither threshold in (0, 1). */
export function bayer8(x: number, y: number): number {
  return (B8[((y & 7) << 3) | (x & 7)]! + 0.5) / 64;
}

/**
 * A ramp step for a tone t (0 = lightest, 1 = darkest), dithered between neighbouring
 * steps over the share `band` of each step (0 = hard steps, 1 = fully dithered).
 */
export function tone(ramp: readonly number[], t: number, x: number, y: number, band = 0.5): number {
  const n = ramp.length;
  const pos = Math.min(Math.max(t, 0), 1) * (n - 1);
  let i = Math.floor(pos);
  const f = pos - i;
  if (band > 0) {
    const lo = 0.5 - band / 2;
    const k = (f - lo) / Math.max(1e-6, band);
    if (k >= 1 || (k > 0 && bayer4(x, y) < k)) i++;
  } else if (f >= 0.5) i++;
  return ramp[Math.min(n - 1, Math.max(0, i))]!;
}

/** A seeded random generator (mulberry32) for placing things. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const sstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
