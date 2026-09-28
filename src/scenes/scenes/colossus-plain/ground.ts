// The plain, the causeway and the small things near the player for
// colossus-plain. The plain is one ground-plane layer: every screen row below
// the horizon is a distance (depth = dNear / rows-below-horizon), shifted by
// that depth's own whole-pixel parallax, so the flat ground recedes and pans
// correctly without a stack of strips.

import { f, rowRef, Pix, fbm1, hashInt, smooth, type BuildCtx } from "../../engine/index.ts";

export interface Geo {
  W: number;
  H: number;
  u: number;
  /** Horizon row. */
  hor: number;
  /** Causeway top (the player's ground) = the plain's depth-1 row. */
  deck: number;
  k1: number;
  /** Row where something standing on the plain at depth d meets it. */
  groundY: (d: number) => number;
  figX: number;
  /** Visible layer x range at a depth (with the pan), plus a margin. */
  reach: (d: number, margin?: number) => [number, number];
}

export function geo(ctx: BuildCtx): Geo {
  const { W, H, u } = ctx;
  const hor = Math.round(H * 0.705);
  const deck = H - Math.round(32 * u);
  const k1 = (deck - hor + 1) / (H - hor);
  return {
    W,
    H,
    u,
    hor,
    deck,
    k1,
    groundY: (d) => Math.round(hor - 1 + ((H - hor) * k1) / d),
    figX: Math.round(W * 0.33),
    reach: (d, margin = 0) => {
      const e = Math.ceil((ctx.span * ctx.par(d)) / 2) + margin;
      return [-e, W + e];
    },
  };
}

/**
 * Prelude light: slow cloud shadows and breaks of sun sweeping across the plain
 * in world space, so the ground, rocks and the colossus all brighten and darken
 * together as a patch passes. Negative in shadow, positive in a break.
 */
export function sunGlsl(g: Geo): string {
  return /* glsl */ `
float cloudSun(float wx, float depth) {
  float tm = uTime * (1.0 - 0.6 * uReduced);
  float n = fbm(vec2((wx + tm * 60.0) / 900.0, depth / 11.0 + 3.0), 3);
  return smoothstep(0.5, 0.6, n);
}
float sceneLight(vec2 s, float depth) {
  if (depth > 70.0) return 0.0;
  float wx = (s.x + layerOff(depth) - ${f(g.W / 2)}) * max(depth, 1.0);
  float k = floor(cloudSun(wx, depth) * 2.0 + 0.5) * 0.5;
  return (k - 0.35) * 0.12 * (1.0 - smoothstep(30.0, 70.0, depth));
}`;
}

/** The plain as a ground plane: soil streaks, drifting grit, cloud shadows, stepped haze with distance. */
export function plainGlsl(g: Geo, o: { dFar: number }): string {
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float hor = ${f(g.hor)};
  if (s.y < hor) return vec4(0.0);
  float k = (s.y - hor + 1.0) / (uRes.y - hor);
  float depth = min(${f(o.dFar)}, ${f(g.k1)} / max(k, 1e-3));
  float off = layerOff(depth);
  vec2 wp = vec2(s.x + off, s.y);
  float wx = (wp.x - ${f(g.W / 2)}) * depth;
  float tm = uTime * (1.0 - 0.5 * uReduced);
  // soil: long streaks along the ground; detail fades with distance
  float near = 1.0 - smoothstep(1.0, 10.0, depth);
  float n1 = fbm(vec2(wx / 700.0, depth * 0.42), 3);
  float n2 = fbm(vec2(wx / 150.0, depth * 1.7), 2);
  float shade = 0.36 + 0.34 * (n1 - 0.5) + 0.2 * near * (n2 - 0.5);
  // the near ground is darker: value does the work
  shade -= 0.14 * smoothstep(0.25, 1.0, k);
  // pale dust flats and dark channels, in bands that recede
  float flat_ = fbm(vec2(wx / 1800.0 + 7.0, depth / 3.5), 2);
  shade += 0.16 * smoothstep(0.58, 0.66, flat_);
  shade -= 0.12 * smoothstep(0.34, 0.28, flat_);
  // near rows: a few pebbles, whole pixels
  if (depth < 3.0) {
    float h = hash2(vec2(floor(wp.x / 2.0), s.y));
    if (h < 0.012) shade += 0.2;
    else if (h > 0.99) shade -= 0.15;
  }
  // grit blown along the ground: short light dashes moving left, faster when near
  float spd = 26.0 / depth;
  float gx = wp.x + floor(tm * spd);
  float len = max(1.0, floor(7.0 / sqrt(depth)));
  float cell = floor(gx / (len * 3.0));
  float gh = hash2(vec2(cell, s.y + 91.0));
  float gust = smoothstep(0.45, 0.75, vnoise(vec2((wx + tm * 120.0) / 1400.0, 2.0)));
  if (gh < 0.08 * gust && mod(gx, len * 3.0) < len && depth < 30.0) shade += 0.2;
  // cloud shadows and breaks of sun
  shade += sceneLight(s, depth) * 1.3;
  vec3 c = ramp(R_PLAIN, shade, wp, 0.7);
  // haze thickens toward the horizon in steps; a low stepped ground-fog skirt
  float gfog = 0.3 * (1.0 - smoothstep(0.0, 0.18, k));
  c = applyFog(c, fogAt(depth), gfog, wp, s);
  return vec4(c, 1.0);
}`;
}

/** The causeway the figure stands on: a lit top edge, then courses of big worn stone blocks. */
export function buildCauseway(pix: Pix, g: Geo, x0: number, row: number, moss: number): void {
  const { deck, H, u } = g;
  const course = Math.round(9 * u);
  for (let px = 0; px < pix.w; px++) {
    const X = px + x0;
    // a few chipped notches in the top edge
    const chip = hashInt(Math.floor(X / 5), 3, 11) < 0.08 ? 1 : 0;
    for (let y = deck + chip; y < H; y++) {
      const dy = y - deck;
      let s: number;
      if (dy < 2) s = dy === 0 ? 0.62 : 0.48;
      else if (dy < 4) s = 0.3;
      else {
        const c = Math.floor((dy - 4) / course);
        const inC = (dy - 4) % course;
        const bw = Math.round((18 + 10 * hashInt(c, 1, 5)) * u);
        const shift = Math.round(hashInt(c, 2, 5) * bw);
        const bx = Math.floor((X + shift + 4096) / bw);
        const inB = (X + shift + 4096) % bw;
        const bh = hashInt(bx, c, 7);
        s = 0.2 + 0.1 * (bh - 0.5) + 0.12 * (fbm1(X / (6 * u) + c * 13, 21, 2) - 0.5);
        if (inC === 0 || inB === 0) s = 0.05;
        else if (inC === 1) s += 0.06;
        s -= 0.1 * smooth(0, H - deck, dy);
        // worn corners
        if ((inC === 1 || inC === course - 1) && (inB === 1 || inB === bw - 1)) s -= 0.05;
      }
      pix.set(px, y, s, row);
    }
    // sparse dry moss / lichen on the lip
    if (hashInt(Math.floor(X / 3), 9, 13) < 0.12) pix.set(px, deck + 2, 0.5, moss);
  }
  // pebbles and small stones on the top, for scale
  for (let X = x0; X < x0 + pix.w; X += 1) {
    const h = hashInt(X, 17, 19);
    if (h < 0.02) {
      const w = 2 + Math.floor(hashInt(X, 5, 23) * 4);
      for (let k = 0; k < w; k++) pix.set(X - x0 + k, deck - 1, k === 0 ? 0.55 : 0.35, row);
      if (w > 3) for (let k = 1; k < w - 1; k++) pix.set(X - x0 + k, deck - 2, 0.5, row);
    }
  }
}

/** A leaning marker post with a crossbar, stuck in the causeway. */
export function buildPost(pix: Pix, x0: number, px: number, deck: number, row: number): { tipX: number; tipY: number } {
  const hgt = 74;
  const lean = 0.12;
  let tipX = px;
  let tipY = deck;
  for (let i = 0; i < hgt; i++) {
    const x = Math.round(px + i * lean) - x0;
    const y = deck - i;
    pix.set(x, y, 0.34, row);
    pix.set(x + 1, y, 0.16, row);
    tipX = x + x0;
    tipY = y;
  }
  // crossbar and lashing
  const cy = deck - hgt + 10;
  const cx = Math.round(px + (hgt - 10) * lean);
  for (let k = -7; k <= 7; k++) pix.set(cx + k - x0, cy + Math.round(k * 0.08), k < 0 ? 0.36 : 0.26, row);
  pix.set(cx - x0, cy - 1, 0.45, row);
  pix.set(cx + 1 - x0, cy + 1, 0.2, row);
  // a cairn at the foot
  const stones: [number, number, number][] = [[-5, 0, 5], [2, 0, 6], [-2, -3, 5], [-1, -6, 3]];
  for (const [sx, sy, w] of stones)
    for (let k = 0; k < w; k++) {
      pix.set(px + sx + k - x0, deck - 1 + sy, k === 0 ? 0.5 : 0.3, row);
      pix.set(px + sx + k - x0, deck - 2 + sy, k === 0 ? 0.55 : 0.42, row);
    }
  return { tipX, tipY };
}

/** A strip of cloth tied to the post, whipping in the wind (stepped at 12 fps). */
export function ribbonGlsl(tip: [number, number], o: { len: number; row: string }): string {
  return /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float tm = floor(uTime * (1.0 - 0.6 * uReduced) * 12.0) / 12.0;
  float i = ${f(tip[0])} - p.x;
  if (i < 0.0 || i > ${f(o.len)}) return vec4(0.0);
  float t = i / ${f(o.len)};
  float gust = 0.6 + 0.4 * sin(tm * 0.7) * sin(tm * 0.23 + 1.0);
  float wave = sin(i * 0.42 - tm * 7.0) * (0.6 + 3.2 * t) * gust + sin(i * 0.9 - tm * 11.0) * 0.8 * t;
  float yc = ${f(tip[1] + 3)} + floor(wave + t * t * 6.0 * (1.2 - gust) + 0.5);
  float hw = mix(2.0, 1.0, t);
  float d = p.y - yc;
  if (d < -hw || d >= hw) return vec4(0.0);
  // frayed tail: a few pixels missing near the end
  if (t > 0.8 && hash2(vec2(i, floor(tm * 3.0))) < (t - 0.8) * 3.0) return vec4(0.0);
  float shade = 0.55 + 0.25 * cos(i * 0.42 - tm * 7.0 + 1.2) - (d > 0.0 ? 0.2 : 0.0) + sceneLight(s, uDepth) + flashLight(s) * 0.3;
  vec3 c = ramp(${rowRef(o.row)}, shade, p, 0.0);
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, 1.0);
}`;
}

/**
 * A sloped slab of layered rust rock rising to the right: diagonal strata in
 * bands (each its own value, a dark seam and a lit lip), a lit crest, stepped
 * ledges, darker toward its foot. Painted in 2 px blocks (near layer).
 */
export function buildSlab(pix: Pix, g: Geo, x0: number, row: number, o: { from: number; base: number; height: number; seed: number }): void {
  const { W, u } = g;
  const c = 2;
  const top = (X: number): number => {
    if (X < o.from) return 1e9;
    const t = (X - o.from) / (W - o.from);
    const ramp = Math.min(1, t * 1.5);
    const ledge = Math.floor(ramp * 5 + fbm1(X / (30 * u), o.seed) * 0.8) / 5;
    const hgt = (0.72 * ramp + 0.28 * ledge) * o.height + (fbm1(X / (26 * u), o.seed + 4, 3) - 0.5) * 22 * u + (fbm1(X / (6 * u), o.seed + 1, 3) - 0.5) * 7 * u;
    return o.base - Math.max(0, hgt) * smooth(0, 0.05, t);
  };
  const band = 7 * u;
  for (let bx = 0; bx < Math.ceil(pix.w / c); bx++) {
    const X = bx * c + c / 2 + x0;
    const tp = top(X);
    if (tp > o.base - 1) continue;
    const tpL = top(X - 4);
    for (let by = Math.floor(tp / c); by < Math.ceil(o.base / c); by++) {
      const y = by * c + c / 2;
      if (y < tp) continue;
      const v = (y + (X - o.from) * 0.42 + (fbm1(X / (20 * u), o.seed + 2, 2) - 0.5) * 6 * u) / band;
      const k = Math.floor(v);
      const fr = v - k;
      let s = 0.33 + 0.2 * (hashInt(k, 3, o.seed) - 0.5) + 0.12 * (fbm1(X / (14 * u) + k * 7.3, o.seed + 3, 2) - 0.5);
      if (fr < 0.16) s -= 0.26;
      else if (fr < 0.32) s += 0.12;
      const below = y - tp;
      if (below < 2 * c) s += below < c ? 0.4 : 0.2;
      // a ledge face to the left of a rise catches the light
      if (tpL - tp > 3 * u && below < 4 * c) s += 0.1;
      s -= 0.22 * smooth(0, o.base - tp, below);
      for (let yy = 0; yy < c; yy++) {
        const py = by * c + yy;
        if (py < tp || py >= o.base) continue;
        for (let xx = 0; xx < c; xx++) pix.set(bx * c + xx, py, s, row);
      }
    }
  }
  // loose boulders at its foot
  for (let i = 0; i < 6; i++) {
    const bxw = o.from - 20 * u + i * 13 * u + hashInt(i, 1, o.seed) * 8 * u;
    const r = (2 + 3 * hashInt(i, 2, o.seed)) * u;
    for (let y = Math.floor(o.base - r * 1.4); y < o.base; y++)
      for (let x = Math.floor(bxw - r); x <= bxw + r; x++) {
        const dx = (x - bxw) / r;
        const dy = (o.base - y) / (r * 1.4);
        if (dx * dx + dy * dy > 1 || pix.solid(x - x0, y)) continue;
        pix.set(x - x0, y, 0.2 + (dx < -0.3 && dy > 0.4 ? 0.25 : 0) - dy * 0 + (dy > 0.8 ? 0.1 : 0), row);
      }
  }
}
