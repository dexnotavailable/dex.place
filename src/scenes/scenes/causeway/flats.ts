// The flooded flats (B2): w01's dark plain gone under a sheet of water, so the
// lake's reflections carry out across the plain. One ground-plane layer: each
// row below the horizon is a distance (re-mapped when the camera climbs
// Stonetop), with wide shallow lagoons that mirror the sky, the spire and the
// colossus (the reflection buffer, sheared per row, stepped, stronger toward
// the horizon), mud banks and grass between them, grit blown along the ground
// harder toward the east (the wind rises as you go), slow cloud shadows, and
// the colossus's footfall rings racing across the water.

import { f, rowRef, type GlslLayer } from "../../engine/index.ts";

export interface FlatsOpts {
  horizon: number;
  G0: number;
  ref: number;
  dFar: number;
  W: number;
  span: number;
  u: number;
  water: string;
  glint: string;
  foam: string;
  soil: string;
  grass: string;
  rings: boolean;
}

export function flats(o: FlatsOpts): GlslLayer {
  const u = o.u;
  const hu = Math.max(1, u / 2);
  return {
    kind: "glsl",
    name: "flats",
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
  float wx = (wp.x - ${f(o.W / 2)}) * depth;
  // the wind rises from west to east along the causeway
  float east = clamp(uCam / ${f(Math.max(1, o.span))}, 0.0, 1.0);

  // where the sheet water lies: wide shallow lagoons, flatter and wider far off,
  // almost all water right beside the causeway
  float wn = fbm(vec2(wx / ${f(2600)} + 11.0, depth * 0.34), 3) * 0.8 + fbm(vec2(wx / ${f(700)}, depth * 1.3 + 4.0), 2) * 0.2;
  float wet = wn + 0.22 * (1.0 - smoothstep(1.0, 2.2, depth)) - 0.04;
  bool isWater = wet > 0.47;
  float edge = abs(wet - 0.47);
  vec3 fr = ${o.rings ? "footRings(wx, depth, G - hor + 1.0)" : "vec3(0.0)"};
  vec3 c;
  if (isWater) {
    float ruff = step(0.62, vnoise(vec2(wx / ${f(900 * u)} - tm * 0.05 * (0.5 + east), depth * 0.4)));
    float amp = mix(0.5, ${f(2.5 * hu)}, k) * (1.0 + ruff + east) + fr.y * ${f(3 * hu)} + fr.z * ${f(2 * hu)};
    float ph = s.y * (1.25 - k * 0.75) / ${f(hu)} + tm * (0.8 + east) + vnoise(vec2(wp.x / ${f(37 * u)}, s.y * 0.35)) * 5.0;
    float dx = floor(sin(ph) * amp * (0.55 + 0.45 * vnoise(vec2(wp.x / ${f(21 * u)} + tm * 0.15, s.y * 0.6))) + 0.5);
    float jn = vnoise(vec2(wp.x / ${f(11 * u)} + tm * 0.3, s.y * 0.45 - tm * 0.9));
    float dy = floor((jn - 0.5) * 2.0 * ${f(1.2 * u)} * k * (0.6 + ruff + fr.y) + 0.5);
    float ry = clamp(s.y + dy, hor + 1.0, uRes.y - 1.0);
    vec3 refl = texelFetch(uRefl, ivec2(clamp(s.x + dx, 0.0, uRes.x - 1.0), uRes.y - 1.0 - ry), 0).rgb;
    float rs = mix(0.9, 0.5, pow(k, 0.7)) * (1.0 - 0.35 * ruff) * (1.0 - 0.5 * fr.z);
    // shallow: the mud shows through at the lagoon's edge
    rs *= smoothstep(0.0, 0.05, edge);
    float rl = stepd(rs, 5.0, wp, 0.5);
    vec3 body = ramp(${rowRef(o.water)}, mix(0.6, 0.1, pow(k, 0.6)) + sceneLight(s, depth) * 1.2, wp, 0.5);
    c = mix(body, refl, rl);
    // a darker, muddier margin where the water thins over the mud
    if (edge < 0.02) c = mix(c, ramp(${rowRef(o.water)}, 0.12, wp, 0.0), 0.5);
    // sparkles, fewer than on the lake (overcast)
    vec2 cell = vec2(floor(wp.x / floor(mix(2.0, ${f(6 * Math.max(1, u * 0.75))}, k))), s.y);
    if (hash2(cell + 3.0) < 0.002 * (1.0 + 3.0 * ruff) && step(fract(tm * 0.4 + hash2(cell) * 13.0), 0.4) > 0.5) c = pal(${rowRef(o.glint)}, 1.0);
    if (fr.x > 0.25) c = mix(c, pal(${rowRef(o.glint)}, 1.0), 0.5 * min(1.0, fr.x * 2.0));
    if (fr.z > 0.0) c = mix(c, ramp(${rowRef(o.water)}, 0.05, wp, 0.0), stepd(fr.z * 0.45, 3.0, wp, 0.6));
    if (fr.y > 0.0) {
      float lv = stepd(fr.y, 3.0, wp, 0.5);
      if (lv > 0.0) c = mix(c, pal(${rowRef(o.foam)}, min(paln(${rowRef(o.foam)}) - 1.0, floor(lv * 3.0))), 0.35 + 0.5 * lv);
    }
  } else {
    // mud and grass: long streaks along the ground, detail fading with distance
    float near = 1.0 - smoothstep(1.0, 10.0, depth);
    float n1 = fbm(vec2(wx / 700.0, depth * 0.42), 3);
    float n2 = fbm(vec2(wx / 150.0, depth * 1.7), 2);
    float shade = 0.46 + 0.26 * (n1 - 0.5) + 0.18 * near * (n2 - 0.5) - 0.1 * smoothstep(0.25, 1.0, k);
    bool grassy = fbm(vec2(wx / 400.0 + 3.0, depth * 0.8), 2) > 0.52;
    // a darker wet rim next to the water
    shade -= 0.08 * (1.0 - smoothstep(0.0, 0.04, edge));
    if (depth < 3.0 && hash2(vec2(floor(wp.x / 2.0), s.y)) < 0.012) shade += 0.2;
    // grit blown along the ground: short light dashes moving right, more and faster to the east
    float spd = (22.0 + 40.0 * east) / depth;
    float gx = wp.x - floor(tm * spd);
    float len = max(1.0, floor(7.0 / sqrt(depth)));
    float gh = hash2(vec2(floor(gx / (len * 3.0)), s.y + 91.0));
    float gust = smoothstep(0.45, 0.75, vnoise(vec2((wx - tm * 120.0) / 1400.0, 2.0)));
    if (gh < (0.04 + 0.1 * east) * gust && mod(gx, len * 3.0) < len && depth < 30.0) shade += 0.2;
    shade += sceneLight(s, depth) * 1.3;
    c = grassy ? ramp(${rowRef(o.grass)}, shade, wp, 0.7) : ramp(${rowRef(o.soil)}, shade, wp, 0.7);
  }
  float gfog = 0.3 * (1.0 - smoothstep(0.0, 0.16, k));
  c = applyFog(c, fogAt(depth), gfog, wp, s);
  return vec4(c, 1.0);
}`,
  };
}
