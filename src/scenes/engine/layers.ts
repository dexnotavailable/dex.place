// Procedural layer presets. Each returns a GlslLayer whose parameters are baked
// into its GLSL as constants, so every layer is one small program evaluated
// per whole pixel. Scenes can also write their own GlslLayer bodies.
//
// Inside a body you have: p (layer pixel), s (screen pixel), uTime, uRes,
// uFog, uDepth, uReduced, and the library in glsl.ts: ramp(), pal(), paln(),
// fbm(), ridged(), vnoise(), hash2(), bayer4(), stepd(), applyFog(),
// fogColor(), fogAt(), layerOff(), sceneLight(), flashLight().

import type { GlslLayer, LayerCommon } from "./types.ts";

/** Format a number as a GLSL float literal. */
export const f = (n: number): string => {
  if (!Number.isFinite(n)) return n > 0 ? "1e9" : "-1e9";
  const s = String(Math.round(n * 1e5) / 1e5);
  return s.includes(".") || s.includes("e") ? s : `${s}.0`;
};
export const v2 = (a: number, b: number): string => `vec2(${f(a)}, ${f(b)})`;

type Common = Omit<LayerCommon, "depth" | "name"> & { name?: string; depth?: number };

// ---------------------------------------------------------------------------

export interface SkyOpts extends Common {
  /** Star field: density per pixel (0.002 = sparse), ramp for star colours. */
  stars?: { density: number; row: string; below?: number; twinkle?: boolean };
}

/** The sky is the fog colour itself (stepped gradient + glow), plus optional stars. */
export function sky(o: SkyOpts = {}): GlslLayer {
  const st = o.stars;
  return {
    kind: "glsl",
    name: o.name ?? "sky",
    depth: o.depth ?? Infinity,
    fog: 0,
    reflect: o.reflect,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec3 c = fogColor(s);
  ${
    st
      ? `
  if (p.y < ${f(st.below ?? 1e9)}) {
    float h = hash2(p);
    if (h < ${f(st.density)}) {
      float tw = ${st.twinkle === false ? "1.0" : "step(0.25, vnoise(vec2(uTime * 0.6 * (1.0 - uReduced * 0.8) + h * 400.0, h * 90.0)))"};
      float lv = h / ${f(st.density)};
      vec3 sc = pal(${rowRef(st.row)}, floor(lv * paln(${rowRef(st.row)})));
      c = mix(c, sc, (0.35 + 0.65 * tw) * (1.0 - smoothstep(0.0, 1.0, p.y / ${f(st.below ?? 1e9)}) * 0.6));
    }
  }`
      : ""
  }
  return vec4(c, 1.0);
}`,
  };
}

/** Ramp row constant for a ramp name inside GLSL. */
export function rowRef(name: string): string {
  return `R_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

// ---------------------------------------------------------------------------

export interface DiscOpts extends Common {
  x: number;
  y: number;
  r: number;
  row: string;
  /** Direction toward the lighting sun, screen space (x right, y down); omit for a self-lit disc. */
  light?: [number, number];
  /** Atmosphere rim thickness in px and its ramp (defaults to the disc ramp's top band). */
  rim?: number;
  rimRow?: string;
  /** Stepped halo radius (multiples of r) and strength. */
  /** seam: how much of each step boundary is dithered (0 = hard rings, default 0.7). */
  halo?: { r: number; strength: number; steps?: number; seam?: number };
  /** Surface bands/craters strength. */
  surface?: number;
}

/** Planet, moon or sun disc with stepped shading, an atmospheric rim and a halo. */
export function disc(o: DiscOpts): GlslLayer {
  const L = o.light ? norm3(o.light[0], -o.light[1], 0.6) : null;
  const rimRow = rowRef(o.rimRow ?? o.row);
  const halo = o.halo;
  return {
    kind: "glsl",
    name: o.name ?? "disc",
    depth: o.depth ?? Infinity,
    bounds: (() => {
      const R = o.r * Math.max(1 + (o.rim ?? 0) / o.r, o.halo?.r ?? 1) + 2;
      return { x0: o.x - R, x1: o.x + R, y0: o.y - R, y1: o.y + R };
    })(),
    fog: o.fog ?? 0,
    reflect: o.reflect,
    blend: "over",
    dither: o.dither,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 d = (p - ${v2(o.x, o.y)}) / ${f(o.r)};
  float r = length(d);
  float rimW = ${f((o.rim ?? 0) / o.r)};
  if (r > 1.0) {
    ${
      halo
        ? `
    float hr = (r - 1.0) / ${f(halo.r - 1)};
    if (hr < 1.0) {
      float g = stepd(pow(1.0 - hr, 2.2) * ${f(halo.strength)}, ${f(halo.steps ?? 5)}, p, ${f(halo.seam ?? 0.7)});
      if (r < 1.0 + rimW) g = max(g, ${f(halo.strength)} * 0.8);
      if (g <= 0.0) return vec4(0.0);
      return vec4(pal(${rimRow}, paln(${rimRow}) - 1.0), g);
    }`
        : `if (r < 1.0 + rimW) return vec4(pal(${rimRow}, paln(${rimRow}) - 1.0), 0.8);`
    }
    return vec4(0.0);
  }
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec3 n = vec3(d.x, -d.y, z);
  float shade = ${L ? `max(0.0, dot(n, vec3(${f(L[0])}, ${f(L[1])}, ${f(L[2])}))) * 0.9 + 0.08` : "0.75 + 0.25 * z"};
  ${o.surface ? `shade += ${f(o.surface)} * (fbm(d * 3.0 + vec2(0.0, d.y * 4.0), 4) - 0.5);` : ""}
  vec3 c = ramp(${rowRef(o.row)}, shade, p, ${f(o.dither ?? 0.5)});
  ${o.rim ? `if (r > 1.0 - rimW * 0.9) c = mix(c, pal(${rimRow}, paln(${rimRow}) - 1.0), 0.6);` : ""}
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, 1.0);
}`,
  };
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

// ---------------------------------------------------------------------------

export interface MistOpts extends Common {
  /** Vertical band in layer px; soft edges fade in over softTop/softBottom px. */
  y0: number;
  y1: number;
  softTop?: number;
  softBottom?: number;
  /** Noise feature size in px, x and y (wide x = streaky). */
  sx: number;
  sy: number;
  /** Whole-pixel drift speed in px/s (negative = leftward). */
  drift: number;
  /** Shape-change speed (noise units/s); 0.02..0.1 is slow and alive. */
  evolve?: number;
  /** 0..1: how much of the band is covered. */
  cover?: number;
  /** Domain warp strength (0.5..2). */
  warp?: number;
  octaves?: number;
  /** Number of density levels (2..4) and the alpha of the densest. */
  levels?: number;
  alpha?: number;
  /** How much of each level edge is dithered (0..1, default 0.9). Lower = edges flip in patches, not scattered pixels. */
  edgeDither?: number;
  /** Ramp for the mist body; tone 0..1 picks the band, densest adds tonePerLevel. */
  row: string;
  tone?: number;
  tonePerLevel?: number;
  /** How much of the mist colour vs the haze colour behind it (0..1). */
  tint?: number;
  /** How strongly sceneLight() brightens the mist. */
  lightGain?: number;
  /** Repeat width in px for a seamless horizontal loop (0 = none). */
  loop?: number;
}

/** Animated cloud / mist band: domain-warped noise, stepped into density levels. */
export function mist(o: MistOpts): GlslLayer {
  const levels = o.levels ?? 3;
  const loop = o.loop ?? 0;
  return {
    kind: "glsl",
    name: o.name ?? "mist",
    depth: o.depth ?? 4,
    bounds: o.bounds ?? { y0: o.y0, y1: o.y1 + 1 },
    fog: o.fog,
    reflect: o.reflect,
    blend: o.blend ?? "over",
    opacity: o.opacity,
    dither: o.dither,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float y0 = ${f(o.y0)}, y1 = ${f(o.y1)};
  if (p.y < y0 || p.y > y1) return vec4(0.0);
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float dx = floor(tm * ${f(o.drift)} + 0.5);
  float px = p.x - dx;
  ${loop > 0 ? `px = mod(px, ${f(loop)});` : ""}
  vec2 q = vec2(px / ${f(o.sx)}, p.y / ${f(o.sy)});
  float t = tm * ${f(o.evolve ?? 0.04)};
  vec2 w = vec2(fbm(q * 0.55 + vec2(0.0, t), 2), fbm(q * 0.55 + vec2(5.2, 1.3 - t * 0.8), 2)) - 0.5;
  float n = fbm(q + ${f(o.warp ?? 1.2)} * w + vec2(t * 0.35, -t * 0.2), ${o.octaves ?? 4});
  float prof = smoothstep(y0, y0 + ${f(o.softTop ?? (o.y1 - o.y0) * 0.35)}, p.y)
             * (1.0 - smoothstep(y1 - ${f(o.softBottom ?? (o.y1 - o.y0) * 0.35)}, y1, p.y));
  float cover = ${f(o.cover ?? 0.5)};
  float d = clamp((n * prof - (1.0 - cover) * 0.62) / (cover * 0.62 + 0.05), 0.0, 1.0);
  float lv = floor(d * ${f(levels)} + (bayer4(p) - 0.5) * ${f(o.edgeDither ?? 0.9)});
  if (lv <= 0.0) return vec4(0.0);
  lv = min(lv, ${f(levels)});
  float light = sceneLight(s, uDepth) * ${f(o.lightGain ?? 0.6)} + flashLight(s) * 0.6;
  float tone = ${f(o.tone ?? 0.4)} + ${f(o.tonePerLevel ?? 0.12)} * (lv - 1.0) + light;
  vec3 body = ramp(${rowRef(o.row)}, tone, p, 0.0);
  vec3 c = mix(fogColor(s), body, ${f(o.tint ?? 0.6)});
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, ${f(o.alpha ?? 0.8)} * lv / ${f(levels)});
}`,
  };
}

/** A low stepped fog bank: a mist with little warp and a flat top. */
export function fogBand(o: Omit<MistOpts, "sx" | "sy" | "drift"> & { sx?: number; sy?: number; drift?: number }): GlslLayer {
  return mist({
    sx: 140,
    sy: 26,
    drift: -1.5,
    evolve: 0.025,
    cover: 0.75,
    warp: 0.6,
    octaves: 3,
    levels: 3,
    tint: 0.35,
    ...o,
    name: o.name ?? "fog-band",
  });
}

// ---------------------------------------------------------------------------

export interface ShaftOpts {
  /** GLSL function name defined by shaftFn (use it in the prelude's sceneLight). */
  fn: string;
  /** Origin and end in layer px, half-widths at each end. */
  from: [number, number];
  to: [number, number];
  w0: number;
  w1: number;
  /** Cross-beam streak count and drift speed. */
  streaks?: number;
  speed?: number;
  /** Beam fades out over the last part (0..1 of its length). */
  fadeStart?: number;
  intensity?: number;
  /**
   * GLSL float expression added to the origin's x (layer px). Use it to pin the top of a
   * shaft to something at another depth, e.g. "layerOff(7.0) - layerOff(1e9)" keeps the
   * origin of a depth-7 shaft on a sky-depth sun while its body pans at depth 7.
   */
  fromShiftX?: string;
}

/** GLSL for a light shaft's intensity field, 0..1 at layer pixel p. Put it in the scene prelude. */
export function shaftFn(o: ShaftOpts): string {
  const [ox, oy] = o.from;
  const [ex, ey] = o.to;
  return /* glsl */ `
float ${o.fn}(vec2 p) {
  vec2 O = ${v2(ox, oy)}${o.fromShiftX ? ` + vec2(${o.fromShiftX}, 0.0)` : ""};
  vec2 E = ${v2(ex, ey)};
  vec2 D = normalize(E - O);
  float L = length(E - O);
  vec2 N = vec2(-D.y, D.x);
  vec2 r = p - O;
  float a = dot(r, D);
  if (a < 0.0 || a > L) return 0.0;
  float t = a / L;
  float hw = mix(${f(o.w0)}, ${f(o.w1)}, t);
  float x = dot(r, N) / hw;
  if (abs(x) > 1.0) return 0.0;
  float tm = uTime * (1.0 - 0.6 * uReduced);
  float edge = 1.0 - smoothstep(0.25, 1.0, abs(x));
  float st = fbm(vec2(x * ${f(o.streaks ?? 5)} + tm * ${f(o.speed ?? 0.05)}, t * 1.2), 3);
  float st2 = vnoise(vec2(x * ${f((o.streaks ?? 5) * 2.3)} - tm * ${f((o.speed ?? 0.05) * 0.7)}, 3.5));
  float fall = smoothstep(0.0, 0.3, t) * (1.0 - smoothstep(${f(o.fadeStart ?? 0.75)}, 1.0, t));
  return clamp(edge * (0.35 + 0.9 * st * (0.5 + st2)) * fall * ${f(o.intensity ?? 1)}, 0.0, 1.0);
}`;
}

/** The visible beam: stepped additive light using a shaftFn from the prelude. */
export function shaft(o: Common & { fn: string; row: string; steps?: number; alpha?: number }): GlslLayer {
  return {
    kind: "glsl",
    name: o.name ?? "shaft",
    depth: o.depth ?? 8,
    bounds: o.bounds,
    fog: o.fog ?? 0,
    reflect: o.reflect,
    blend: "add",
    opacity: o.opacity,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float v = ${o.fn}(p);
  float lv = stepd(v, ${f(o.steps ?? 4)}, p, 0.9);
  if (lv <= 0.0) return vec4(0.0);
  vec3 c = ramp(${rowRef(o.row)}, lv, p, 0.0);
  return vec4(c, lv * ${f(o.alpha ?? 0.35)});
}`,
  };
}

// ---------------------------------------------------------------------------

export interface WaterOpts extends Common {
  /** Screen y of the far water line. */
  horizon: number;
  /** Depth of the bottom screen row (near) and cap for the horizon (far). */
  dNear: number;
  dFar: number;
  row: string;
  glintRow: string;
  /** Reflection strength at the horizon and at the bottom (0..1). */
  reflFar?: number;
  reflNear?: number;
  /** Row displacement in px at the bottom, and ripple speed. */
  rippleAmp?: number;
  rippleSpeed?: number;
  /** Sparkle density (0..1) and a brighter sun pool (layer x at depth 1, half width px). */
  glints?: number;
  pool?: {
    x: number;
    w: number;
    strength: number;
    depth: number;
    /** Ramp for sparkles inside the pool (default glintRow), e.g. a warm sun path. */
    row?: string;
    /** 0..1: stepped tint of the water toward `row` along the pool (a lit path). */
    path?: number;
  };
  /** Dither of the water body and reflection step edges (default 0.9). */
  waterDither?: number;
  /** Ring ripples at points on the player plane: [x, y] layer coords at depth 1. */
  rings?: [number, number][];
}

/** Still water: per-row ground-plane parallax, stepped reflection with ripple shear, sparkles, ring ripples. */
export function water(o: WaterOpts): GlslLayer {
  const rings = o.rings ?? [];
  const pool = o.pool;
  return {
    kind: "glsl",
    name: o.name ?? "water",
    depth: o.depth ?? o.dNear,
    bounds: { y0: o.horizon, y1: 1e6 },
    fog: 0,
    usesReflection: true,
    blend: "over",
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float hor = ${f(o.horizon)};
  if (s.y < hor) return vec4(0.0);
  float k = (s.y - hor + 1.0) / (uRes.y - hor);
  // ground-plane depth for this row: distance falls off as 1 / (rows below horizon)
  float depth = min(${f(o.dFar)}, ${f(o.dNear)} / max(k, 1e-3));
  float off = layerOff(depth);
  vec2 wp = vec2(s.x + off, s.y);
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float amp = mix(0.6, ${f(o.rippleAmp ?? 3)}, k);
  float ph = s.y * (1.3 - k * 0.8) + tm * ${f(o.rippleSpeed ?? 0.9)} + vnoise(vec2(wp.x / 37.0, s.y * 0.35)) * 5.0;
  float dx = floor(sin(ph) * amp * (0.55 + 0.45 * vnoise(vec2(wp.x / 21.0 + tm * 0.15, s.y * 0.6))) + 0.5);
  ivec2 rp = ivec2(clamp(s.x + dx, 0.0, uRes.x - 1.0), uRes.y - 1.0 - s.y);
  vec3 refl = texelFetch(uRefl, rp, 0).rgb;
  float rl = stepd(mix(${f(o.reflFar ?? 0.85)}, ${f(o.reflNear ?? 0.45)}, pow(k, 0.7)), 5.0, wp, ${f(o.waterDither ?? 0.9)});
  vec3 body = ramp(${rowRef(o.row)}, mix(0.62, 0.05, pow(k, 0.6)), wp, ${f(o.waterDither ?? 0.9)});
  vec3 c = mix(body, refl, rl);
  // sparkles: short dashes that switch on and off, denser in the sun pool and on bright reflections
  float lum = dot(refl, vec3(0.3, 0.5, 0.2));
  float cw = floor(mix(2.0, 7.0, k));
  vec2 cell = vec2(floor(wp.x / cw), s.y);
  float h = hash2(cell);
  float dens = ${f(o.glints ?? 0.03)} * (0.4 + smoothstep(0.35, 0.8, lum) * 2.5);
  float pk = 0.0;
  ${
    pool
      ? `float px = s.x + layerOff(${f(pool.depth)});
  pk = exp(-pow((px - ${f(pool.x)}) / (${f(pool.w)} * (0.35 + k)), 2.0));
  dens += ${f(pool.strength)} * pk * (1.0 - k * 0.5);
  ${
    pool.path
      ? `{
    float pv = stepd(pk * ${f(pool.path)} * (0.55 + 0.45 * vnoise(vec2(wp.x / 9.0, s.y * 0.7 + tm * 0.6))), 4.0, wp, 0.6);
    if (pv > 0.0) c = mix(c, pal(${rowRef(pool.row ?? o.glintRow)}, min(paln(${rowRef(pool.row ?? o.glintRow)}) - 1.0, floor(pv * 3.0))), pv);
  }`
      : ""
  }`
      : ""
  }
  float on = step(fract(tm * (0.25 + 0.5 * hash2(cell + 7.0)) * (1.0 - 0.6 * uReduced) + h * 13.0), 0.45);
  if (hash2(cell + 3.0) < dens && on > 0.5) {
    ${
      pool?.row
        ? `bool inPool = hash2(cell + 11.0) < pk * 1.6;
    float gr = inPool ? ${rowRef(pool.row)} : ${rowRef(o.glintRow)};`
        : `float gr = ${rowRef(o.glintRow)};`
    }
    float gl = paln(gr);
    c = pal(gr, max(0.0, gl - 1.0 - floor(k * 1.5 + hash2(cell + 5.0) * 1.2)));
  }
  ${rings
    .map(
      ([rx, ry], i) => `
  {
    float ex = ${f(rx)} - layerOff(1.0);
    float per = 5.5 + ${f(i * 0.9)};
    float age = mod(tm + ${f(i * 1.7)}, per) / per;
    float rr = 3.0 + age * 26.0;
    vec2 e = vec2((s.x - ex) / (rr * 2.6), (s.y - ${f(ry)}) / (rr * 0.42));
    float el = abs(length(e) - 1.0) * rr * 0.42;
    if (el < 0.55 && age < 0.85 && s.y > ${f(ry)} - 1.0) c = mix(c, pal(${rowRef(o.glintRow)}, 1.0), 0.55 * (1.0 - age));
  }`,
    )
    .join("")}
  c = applyFog(c, fogAt(depth) * 0.85, 0.0, wp, s);
  return vec4(c, 1.0);
}`,
  };
}

// ---------------------------------------------------------------------------

/** A small warm light: stepped radial glow with a slow, gentle flicker (never strobes). */
export function glow(o: Common & { x: number; y: number; r: number; row: string; flicker?: number; alpha?: number }): GlslLayer {
  return {
    kind: "glsl",
    name: o.name ?? "glow",
    depth: o.depth ?? 1,
    bounds: { x0: o.x - o.r - 1, x1: o.x + o.r + 1, y0: o.y - o.r - 1, y1: o.y + o.r + 1 },
    fog: o.fog,
    reflect: o.reflect,
    blend: "add",
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float r = length(p - ${v2(o.x, o.y)}) / ${f(o.r)};
  if (r > 1.0) return vec4(0.0);
  float tm = uTime * (1.0 - 0.7 * uReduced);
  float fl = 1.0 - ${f(o.flicker ?? 0.15)} * floor(vnoise(vec2(tm * 2.2, 3.0)) * 3.0) / 3.0;
  float g = stepd(pow(1.0 - r, 1.8) * fl, 4.0, p, 0.8);
  if (g <= 0.0) return vec4(0.0);
  vec3 c = ramp(${rowRef(o.row)}, g, p, 0.0);
  return vec4(c, g * ${f(o.alpha ?? 0.5)} * (1.0 - uFog));
}`,
  };
}
