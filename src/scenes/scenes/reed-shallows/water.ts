// The shallows: the arrival's lake (per-row parallax, stepped reflections
// strongest toward the horizon, row-shear ripples, vertical jitter so tall
// pale reflections break into streaks, wind ruffles, sparkles) reworked for
// region B:
//
// - rows re-map when the camera rises (the ramp down from the yard): the
//   player plane's water row is G0 + ref - camY(), the horizon stays put;
// - the colossus's footfalls ring the water (footRings from causeway/shared):
//   small rings at every foot, and once per pass a big ring that races across
//   the whole lake to the boardwalk, shearing the reflections as it passes;
// - breaks of sun drift across the water (the prelude's sceneLight), where
//   the reflection thins and the sparkle thickens.

import { f, rowRef, type GlslLayer } from "../../engine/index.ts";

export interface ShallowsOpts {
  name?: string;
  horizon: number;
  /** Screen row of the player plane's water at the reference framing, and that reference. */
  G0: number;
  ref: number;
  dFar: number;
  row: string;
  glintRow: string;
  foamRow: string;
  reflFar: number;
  reflNear: number;
  shear: number;
  jitter: number;
  glints: number;
  u: number;
  dither: number;
  /** Use footRings() from the prelude. */
  rings: boolean;
  /** Where the shallow bottom shows through (0 none .. 1): sandbars near the reeds. */
  shoals?: number;
}

export function shallows(o: ShallowsOpts): GlslLayer {
  const u = o.u;
  const hu = Math.max(1, u / 2);
  return {
    kind: "glsl",
    name: o.name ?? "water",
    depth: 1,
    bounds: { y0: o.horizon, y1: 1e6 },
    fog: 0,
    usesReflection: true,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float hor = ${f(o.horizon)};
  if (s.y < hor) return vec4(0.0);
  float G = ${f(o.G0 + o.ref)} - camY();
  float k = (s.y - hor + 1.0) / (uRes.y - hor);
  float depth = min(${f(o.dFar)}, (G - hor + 1.0) / max(s.y - hor + 1.0, 1e-3));
  float off = layerOff(depth);
  vec2 wp = vec2(s.x + off, s.y);
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float wx = (wp.x - uRes.x * 0.5) * depth;

  // wind ruffles: slow patches drifting right, stepped in three
  float rn = fbm(vec2(wx / ${f(700 * u)} - tm * 0.018, depth * 0.3 + tm * 0.012), 3);
  float ruff = clamp(floor(smoothstep(0.5, 0.72, rn) * 3.0 + (bayer4(wp) - 0.5) * 0.5 + 0.25) / 3.0, 0.0, 1.0);

  // ripples from the colossus's feet
  vec3 fr = ${o.rings ? "footRings(wx, depth, G - hor + 1.0)" : "vec3(0.0)"};

  // sideways shear per row (stronger inside a ruffle and where the big ring passes)
  float amp = mix(0.5, ${f(o.shear)}, k) * (1.0 + 1.4 * ruff) + fr.y * ${f(3 * hu)} + fr.z * ${f(2 * hu)};
  float ph = s.y * (1.25 - k * 0.75) / ${f(hu)} + tm * 0.8 + vnoise(vec2(wp.x / ${f(37 * u)}, s.y * 0.35 / ${f(hu)})) * 5.0;
  float dx = floor(sin(ph) * amp * (0.55 + 0.45 * vnoise(vec2(wp.x / ${f(21 * u)} + tm * 0.15, s.y * 0.6))) + 0.5);
  float jn = vnoise(vec2(wp.x / ${f(11 * u)} + tm * 0.3, s.y * 0.45 - tm * 0.9));
  float dy = floor((jn - 0.5) * 2.0 * ${f(o.jitter)} * k * (0.6 + ruff + fr.y) + 0.5);
  float ry = clamp(s.y + dy, hor + 1.0, uRes.y - 1.0);
  ivec2 rp = ivec2(clamp(s.x + dx, 0.0, uRes.x - 1.0), uRes.y - 1.0 - ry);
  vec3 refl = texelFetch(uRefl, rp, 0).rgb;

  // breaks of sun on the water: the reflection thins, the water brightens
  float sun = sceneLight(s, depth);
  float rs = mix(${f(o.reflFar)}, ${f(o.reflNear)}, pow(k, 0.7)) * (1.0 - 0.4 * ruff) * (1.0 - 0.8 * max(0.0, sun));
  float gap = hash2(vec2(floor((wp.x + floor(tm * 3.0)) / ${f(5 * u)}), s.y));
  if (gap < (0.05 + 0.25 * ruff) * k) rs *= 0.45;
  rs *= 1.0 - 0.5 * fr.z;
  float rl = stepd(rs, 5.0, wp, ${f(o.dither)});
  float bodyShade = mix(0.62, 0.08, pow(k, 0.6)) - 0.08 * ruff + max(0.0, sun) * 1.4;
  ${
    o.shoals
      ? `// the shallow bottom: sandbars and weed show through in the nearer rows
  float sh = fbm(vec2(wx / ${f(420 * u)} + 3.0, depth * 0.9), 3);
  bodyShade += ${f(o.shoals)} * 0.18 * smoothstep(0.55, 0.7, sh) * smoothstep(0.25, 0.8, k);`
      : ""
  }
  vec3 body = ramp(${rowRef(o.row)}, bodyShade, wp, ${f(o.dither)});
  vec3 c = mix(body, refl, rl);

  // sparkles: short dashes, longer toward the viewer, denser in sun, on bright reflections and ruffles
  float lum = dot(refl, vec3(0.3, 0.5, 0.2));
  float cw = floor(mix(2.0, ${f(7 * Math.max(1, u * 0.75))}, k));
  float rh = k > 0.55 ? ${f(Math.max(1, Math.round(u / 2)))} : 1.0;
  vec2 cell = vec2(floor(wp.x / cw), floor(s.y / rh));
  float h = hash2(cell);
  float dens = ${f(o.glints)} * (0.4 + smoothstep(0.35, 0.8, lum) * 2.5 + 2.0 * ruff) + max(0.0, sun) * 0.35;
  float on = step(fract(tm * (0.25 + 0.5 * hash2(cell + 7.0)) * (1.0 - 0.6 * uReduced) + h * 13.0), 0.45);
  if (hash2(cell + 3.0) < dens && on > 0.5) c = pal(${rowRef(o.glintRow)}, max(0.0, paln(${rowRef(o.glintRow)}) - 1.0 - floor(k * 1.5 + hash2(cell + 5.0) * 1.2)));

  // the rings themselves: a lit crest, a dark trough behind the big one
  if (fr.x > 0.0) c = mix(c, pal(${rowRef(o.glintRow)}, 1.0), step(0.25, fr.x) * 0.55 * min(1.0, fr.x * 2.0));
  if (fr.z > 0.0) c = mix(c, ramp(${rowRef(o.row)}, 0.05, wp, 0.0), stepd(fr.z * 0.45, 3.0, wp, 0.6));
  if (fr.y > 0.0) {
    float lv = stepd(fr.y, 3.0, wp, 0.5);
    if (lv > 0.0) c = mix(c, pal(${rowRef(o.foamRow)}, min(paln(${rowRef(o.foamRow)}) - 1.0, floor(lv * 3.0))), 0.35 + 0.5 * lv);
  }
  c = applyFog(c, fogAt(depth) * 0.85, 0.0, wp, s);
  return vec4(c, 1.0);
}`,
  };
}
