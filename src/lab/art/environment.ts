// Code-authored environment pixels: stone ledges and floor (each one drawn at
// its own size, so nothing repeats like toy blocks), plus one faint distant
// layer. Flat side view: a lit top lip, no fake 3D faces.

type RGB8 = [number, number, number];

const hex = (h: string): RGB8 => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

const STONE = {
  edge: hex("#b9b3c9"),
  lip: hex("#8c86a0"),
  lip2: hex("#746e88"),
  groove: hex("#353244"),
  body: hex("#565166"),
  body2: hex("#4e495e"),
  strata: hex("#47435a"),
  speck: hex("#625d74"),
  crack: hex("#2f2c3c"),
  low: hex("#3f3b4e"),
  bottom: hex("#262332"),
};

/** Tiny deterministic PRNG so the map looks the same every load. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export interface TexPair {
  w: number;
  h: number;
  albedo: Uint8ClampedArray;
  normal: Uint8ClampedArray;
}

function blank(w: number, h: number): TexPair {
  return { w, h, albedo: new Uint8ClampedArray(w * h * 4), normal: new Uint8ClampedArray(w * h * 4) };
}

function set(t: TexPair, x: number, y: number, c: RGB8, n: [number, number, number] = [0, 0, 1]): void {
  if (x < 0 || y < 0 || x >= t.w || y >= t.h) return;
  const i = (y * t.w + x) * 4;
  t.albedo[i] = c[0];
  t.albedo[i + 1] = c[1];
  t.albedo[i + 2] = c[2];
  t.albedo[i + 3] = 255;
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  t.normal[i] = Math.round((n[0] / l * 0.5 + 0.5) * 255);
  t.normal[i + 1] = Math.round((n[1] / l * 0.5 + 0.5) * 255);
  t.normal[i + 2] = Math.round((n[2] / l * 0.5 + 0.5) * 255);
  t.normal[i + 3] = 255;
}

function clear(t: TexPair, x: number, y: number): void {
  const i = (y * t.w + x) * 4;
  t.albedo[i + 3] = 0;
  t.normal[i + 3] = 0;
}

/** A floating ledge: lit lip, soft groove, quiet strata, chamfered ends. */
export function ledge(w: number, h: number, seed: number): TexPair {
  const t = blank(w, h);
  const r = rng(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = STONE.body;
      let n: [number, number, number] = [0, 0, 1];
      if (y === 0) { c = STONE.edge; n = [0, -1, 0.35]; }
      else if (y === 1) { c = STONE.lip; n = [0, -0.8, 0.6]; }
      else if (y === 2) { c = STONE.lip2; n = [0, -0.4, 0.9]; }
      else if (y === 3) c = (x + seed) % 23 < 17 ? STONE.groove : STONE.low;
      else if (y === h - 1) { c = STONE.bottom; n = [0, 0.7, 0.7]; }
      else if (y === h - 2) { c = STONE.low; n = [0, 0.4, 0.9]; }
      else if (y >= 4 && y < h - 2 && ((y - 4) % 4 === 3)) c = STONE.body2;
      set(t, x, y, c, n);
    }
  }
  // long quiet strata and specks, never on a grid
  for (let k = 0; k < w / 18; k++) {
    const y = 5 + Math.floor(r() * Math.max(1, h - 8));
    const x0 = Math.floor(r() * w);
    const L = 6 + Math.floor(r() * 26);
    for (let x = x0; x < Math.min(w - 2, x0 + L); x++) set(t, x, y, STONE.strata);
  }
  for (let k = 0; k < w / 7; k++) set(t, Math.floor(r() * w), 4 + Math.floor(r() * Math.max(1, h - 6)), STONE.speck);
  // a few hairline cracks off the groove
  for (let k = 0; k < w / 70; k++) {
    let x = 4 + Math.floor(r() * (w - 8));
    let y = 4;
    const dir = r() < 0.5 ? -1 : 1;
    for (let s = 0; s < 3 + Math.floor(r() * 5) && y < h - 2; s++) {
      set(t, x, y, STONE.crack);
      y++;
      if (r() < 0.55) x += dir;
    }
  }
  // chamfer the ends: 1px top corners, 2-3px bottom corners
  for (const side of [0, 1]) {
    const X = (d: number): number => (side === 0 ? d : w - 1 - d);
    clear(t, X(0), 0);
    for (let y = h - 3; y < h; y++) clear(t, X(0), y);
    for (let y = h - 1; y < h; y++) clear(t, X(1), y);
    set(t, X(0), 1, STONE.lip2, [side === 0 ? -1 : 1, -0.4, 0.5]);
    for (let y = 2; y < h - 3; y++) set(t, X(0), y, STONE.low, [side === 0 ? -0.8 : 0.8, 0, 0.6]);
  }
  return t;
}

/** The floor: wide slab whose face darkens with depth in dithered bands. */
export function floor(w: number, h: number, seed: number): TexPair {
  const t = blank(w, h);
  const r = rng(seed);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const deep = [hex("#3f3b4e"), hex("#363244"), hex("#2e2a3b"), hex("#262332"), hex("#1f1c29"), hex("#191722")];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c: RGB8;
      let n: [number, number, number] = [0, 0, 1];
      if (y === 0) { c = STONE.edge; n = [0, -1, 0.3]; }
      else if (y === 1) { c = STONE.lip; n = [0, -0.8, 0.6]; }
      else if (y === 2) { c = STONE.lip2; n = [0, -0.4, 0.9]; }
      else if (y === 3) c = STONE.groove;
      else {
        const d = (y - 4) / (h - 4);
        const f = d * (deep.length - 1) + (bayer[(x & 3) + (y & 3) * 4]! / 16 - 0.5) * 0.9;
        c = deep[Math.max(0, Math.min(deep.length - 1, Math.round(f)))]!;
      }
      set(t, x, y, c, n);
    }
  }
  for (let k = 0; k < w / 10; k++) {
    const y = 5 + Math.floor(r() * 26);
    const x0 = Math.floor(r() * w);
    const L = 8 + Math.floor(r() * 40);
    for (let x = x0; x < Math.min(w, x0 + L); x++) set(t, x, y, STONE.strata);
  }
  for (let k = 0; k < w / 6; k++) set(t, Math.floor(r() * w), 4 + Math.floor(r() * 30), STONE.speck);
  for (let k = 0; k < w / 90; k++) {
    let x = Math.floor(r() * w);
    let y = 4;
    const dir = r() < 0.5 ? -1 : 1;
    for (let s = 0; s < 4 + Math.floor(r() * 8); s++) {
      set(t, x, y, STONE.crack);
      y++;
      if (r() < 0.5) x += dir;
    }
  }
  return t;
}

/**
 * One faint distant layer: an immense ring, cropped, and a few far towers.
 * Colours sit just above the sky so it reads as depth, not as a subject.
 */
export function farLayer(w: number, h: number): TexPair {
  const t = blank(w, h);
  // a hair lighter than the sky behind it: distance reads as haze, not as a shape
  const ring = hex("#3a3e4c");
  const ringLit = hex("#40444f");
  const tower = hex("#3b3f4d");
  const win = hex("#454957");
  const cx = w * 0.62, cy = h * 0.78, R = h * 0.62, T = 13;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.02);
      if (d > R - T && d < R) set(t, x, y, d > R - 3 ? ringLit : ring);
      else if (d > R - T - 6 && d <= R - T && (Math.atan2(y - cy, x - cx) * 40) % 2 < 0.35) set(t, x, y, ring);
    }
  }
  const r = rng(77);
  for (let k = 0; k < 7; k++) {
    const x0 = Math.floor(r() * w);
    const tw = 10 + Math.floor(r() * 18);
    const th = Math.floor(h * (0.35 + r() * 0.5));
    for (let y = h - th; y < h; y++) {
      const taper = y < h - th + 8 ? Math.floor((h - th + 8 - y) / 2) : 0;
      for (let x = x0 + taper; x < x0 + tw - taper; x++) set(t, x, y, tower);
    }
    for (let y = h - th + 14; y < h - 10; y += 9) for (let x = x0 + 3; x < x0 + tw - 3; x += 4) if (r() < 0.4) set(t, x, y, win);
  }
  return t;
}
