// CPU-side seeded randomness and value noise for the silhouette generators.
// The same lattice hash idea as the GLSL side, so patterns are stable per seed.

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashInt(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

export function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hashInt(ix, iy, seed);
  const b = hashInt(ix + 1, iy, seed);
  const c = hashInt(ix, iy + 1, seed);
  const d = hashInt(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm(x: number, y: number, seed: number, oct = 4, lac = 2.03, gain = 0.5): number {
  let s = 0;
  let a = 0.5;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x, y, seed + i * 101);
    n += a;
    x = x * lac + 17.13;
    y = y * lac + 9.71;
    a *= gain;
  }
  return s / n;
}

/** Ridged fbm: sharp creases, good for rock facets and mountain crests. */
export function ridged(x: number, y: number, seed: number, oct = 4): number {
  let s = 0;
  let a = 0.5;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * (1 - Math.abs(vnoise(x, y, seed + i * 131) * 2 - 1));
    n += a;
    x = x * 2.07 + 3.7;
    y = y * 2.07 + 11.3;
    a *= 0.5;
  }
  return s / n;
}

/** 1D fbm along x (for silhouettes). */
export function fbm1(x: number, seed: number, oct = 5): number {
  return fbm(x, 0.5, seed, oct);
}

export const clamp = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
