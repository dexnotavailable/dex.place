// The planet: a huge pale moon filling the sky, lit from its lower left, with a
// cratered surface that turns very slowly, dark maria, a night side with a
// little earthshine, a thin bright atmospheric rim and a stepped blue halo
// that is strongest on the lit limb. One GLSL layer, evaluated per pixel.

import { f, v2 } from "../../engine/index.ts";

export function planetBody(o: { x: number; y: number; r: number; halo: number }): string {
  return /* glsl */ `
const vec2 PC = ${v2(o.x, o.y)};
const float PR = ${f(o.r)};
const float HALO = ${f(o.halo)};
const vec3 PL = vec3(-0.66, -0.52, 0.54);

// craters in surface coords q; L2 is the light direction in the same space
float craters(vec2 q, float sd, vec2 L2, float dens) {
  // the 2x2 cells nearest q (radii are kept small enough that farther cells can't reach)
  vec2 i = floor(q - 0.5);
  float acc = 0.0;
  for (int y = 0; y <= 1; y++)
    for (int x = 0; x <= 1; x++) {
      vec2 c = i + vec2(float(x), float(y));
      float h = hash2(c + sd);
      if (h > dens) continue;
      h /= dens;
      vec2 ctr = c + 0.3 + 0.4 * vec2(fract(h * 37.13), fract(h * 91.7));
      float rad = 0.14 + 0.2 * pow(fract(h * 13.37), 1.5);
      vec2 e = (q - ctr) / rad;
      float r = length(e);
      if (r > 1.4) continue;
      float lt = dot(e, L2);
      if (r < 1.0) acc += -0.17 * lt * smoothstep(0.15, 0.95, r) - 0.03;
      else acc += 0.08 * lt * (1.0 - smoothstep(1.0, 1.4, r)) + 0.012;
    }
  return acc;
}

vec4 layer(vec2 p, vec2 s) {
  vec2 d = (p + 0.5 - PC) / PR;
  float r = length(d);
  vec3 L = normalize(PL);
  vec2 dn = d / max(r, 1e-4);
  float side = clamp(dot(vec2(dn.x, -dn.y), normalize(L.xy)) * 0.5 + 0.5, 0.0, 1.0);
  if (r > 1.0) {
    // atmosphere halo, strongest on the lit limb
    float h = (r - 1.0) / HALO;
    if (h > 1.0) return vec4(0.0);
    float g = pow(1.0 - h, 2.6) * (0.2 + 0.8 * side * side);
    float lv = stepd(g, 6.0, p, 0.85);
    if (lv <= 0.0) return vec4(0.0);
    vec3 c = ramp(R_RIM, lv * 0.85 + 0.1, p, 0.0);
    c = applyFog(c, uFog * 0.5, 0.0, p, s);
    return vec4(c, lv * 0.8);
  }
  float tm = uTime * (1.0 - 0.7 * uReduced);
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec3 n = vec3(d.x, -d.y, z);
  float lit = dot(n, L);
  // tilt so the visible face is equatorial, then spin very slowly
  const float TC = 0.72, TS = 0.69;
  vec3 m = vec3(n.x, n.y * TC + n.z * TS, -n.y * TS + n.z * TC);
  float rot = tm * 0.0011 + 0.4;
  float ca = cos(rot), sa = sin(rot);
  m = vec3(m.x * ca - m.z * sa, m.y, m.x * sa + m.z * ca);
  float lon = atan(m.x, m.z);
  float lat = asin(clamp(m.y, -1.0, 1.0));
  vec2 q = vec2(lon * cos(lat), lat);
  vec2 L2 = normalize(vec2(L.x, L.y));
  float mare = smoothstep(0.45, 0.62, fbm(q * 2.2 + 3.0, 3));
  float streak = vnoise(q * vec2(5.0, 11.0) + 7.0);
  float alb = 1.0 - 0.26 * mare - 0.08 * smoothstep(0.5, 0.75, streak);
  float cr = craters(q * 5.0, 0.0, L2, 0.2) + 0.6 * craters(q * 15.0, 91.0, L2, 0.3) + 0.45 * craters(q * 36.0, 37.0, L2, 0.4);
  float grain = (vnoise(q * 70.0) - 0.5) * 0.06;
  float day = max(lit, 0.0);
  float shade = 0.09 + 0.86 * pow(day, 0.85) * alb + (cr + grain) * (0.25 + 0.75 * smoothstep(-0.05, 0.3, lit));
  // the lit limb glows through the thin atmosphere
  shade += 0.12 * smoothstep(0.93, 1.0, r) * side;
  vec3 c = ramp(R_PLANET, shade, p, 0.55);
  float rimW = ${f(1.6 / o.r)};
  if (r > 1.0 - rimW * (0.6 + 1.6 * side)) c = mix(c, pal(R_RIM, paln(R_RIM) - 1.0), 0.25 + 0.6 * side);
  c = applyFog(c, uFog, 0.35 * stepd(smoothstep(0.55, 1.0, r) * (1.0 - side), 4.0, p, 0.8), p, s);
  return vec4(c, 1.0);
}`;
}
