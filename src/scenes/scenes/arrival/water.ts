// The lake for the arrival: the ring-lake water reworked for the 1280x720 view
// and for a reflection that has to carry a walking colossus.
//
// - Per-row ground-plane parallax (row depth = dNear / rows-below-horizon).
// - The reflection buffer is sampled with a sideways row shear AND a small
//   vertical jitter, so a tall pale reflection breaks into horizontal streaks
//   the way still water breaks a mirror image, more toward the viewer.
// - Wind ruffles: slow patches of ruffled water drift across the lake. Inside a
//   patch the reflection weakens and breaks up, and sparkles thicken.
// - Stepped reflection strength: strongest at the horizon, weaker near.
// - Sparkles as short dashes whose length grows toward the viewer (whole px),
//   a warm lit path where the shaft lands, ring ripples at the dock posts.

import { f, rowRef, type GlslLayer } from "../../engine/index.ts";

export interface LakeOpts {
  horizon: number;
  dNear: number;
  dFar: number;
  row: string;
  glintRow: string;
  warmRow: string;
  /** Reflection strength at the horizon and at the bottom. */
  reflFar: number;
  reflNear: number;
  /** Row shear amplitude (px) at the bottom, vertical jitter (px) at the bottom. */
  shear: number;
  jitter: number;
  glints: number;
  /** Size unit: u (H / 360). */
  u: number;
  /** The warm path under the shaft: layer x at `depth`, half width in px. */
  pool: { x: number; w: number; strength: number; depth: number; path: number };
  /** Ring ripples at points on the player plane, and their size unit (player px). */
  rings: [number, number][];
  ringUnit: number;
  dither: number;
}

export function lake(o: LakeOpts): GlslLayer {
  const u = o.u;
  return {
    kind: "glsl",
    name: "water",
    depth: o.dNear,
    bounds: { y0: o.horizon, y1: 1e6 },
    fog: 0,
    usesReflection: true,
    body: /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  float hor = ${f(o.horizon)};
  if (s.y < hor) return vec4(0.0);
  float k = (s.y - hor + 1.0) / (uRes.y - hor);
  float depth = min(${f(o.dFar)}, ${f(o.dNear)} / max(k, 1e-3));
  float off = layerOff(depth);
  vec2 wp = vec2(s.x + off, s.y);
  float tm = uTime * (1.0 - 0.5 * uReduced);
  // world-ish x on this row, so patterns stay put on the water as the camera pans
  float wx = (wp.x - uRes.x * 0.5) * depth;

  // wind ruffles: slow patches drifting right, stepped in three
  float rn = fbm(vec2(wx / ${f(700 * u)} - tm * 0.018, depth * 0.3 + tm * 0.012), 3);
  float ruff = floor(smoothstep(0.5, 0.72, rn) * 3.0 + (bayer4(wp) - 0.5) * 0.5 + 0.25) / 3.0;
  ruff = clamp(ruff, 0.0, 1.0);

  // sideways shear per row
  float amp = mix(0.5, ${f(o.shear)}, k) * (1.0 + 1.4 * ruff);
  float ph = s.y * (1.25 - k * 0.75) / ${f(Math.max(1, u / 2))} + tm * 0.8 + vnoise(vec2(wp.x / ${f(37 * u)}, s.y * 0.35 / ${f(Math.max(1, u / 2))})) * 5.0;
  float dx = floor(sin(ph) * amp * (0.55 + 0.45 * vnoise(vec2(wp.x / ${f(21 * u)} + tm * 0.15, s.y * 0.6))) + 0.5);
  // vertical jitter: a few rows borrow a neighbour's row, so the mirror image breaks into streaks
  float jn = vnoise(vec2(wp.x / ${f(11 * u)} + tm * 0.3, s.y * 0.45 - tm * 0.9));
  float dy = floor((jn - 0.5) * 2.0 * ${f(o.jitter)} * k * (0.6 + ruff) + 0.5);
  float ry = clamp(s.y + dy, hor + 1.0, uRes.y - 1.0);
  ivec2 rp = ivec2(clamp(s.x + dx, 0.0, uRes.x - 1.0), uRes.y - 1.0 - ry);
  vec3 refl = texelFetch(uRefl, rp, 0).rgb;

  float rs = mix(${f(o.reflFar)}, ${f(o.reflNear)}, pow(k, 0.7)) * (1.0 - 0.4 * ruff);
  // short gaps in the streaks where a ripple faces the sky instead
  float gap = hash2(vec2(floor((wp.x + floor(tm * 3.0)) / ${f(5 * u)}), s.y));
  if (gap < (0.05 + 0.25 * ruff) * k) rs *= 0.45;
  float rl = stepd(rs, 5.0, wp, ${f(o.dither)});
  vec3 body = ramp(${rowRef(o.row)}, mix(0.62, 0.05, pow(k, 0.6)) - 0.08 * ruff, wp, ${f(o.dither)});
  vec3 c = mix(body, refl, rl);

  // the warm path under the shaft
  float px = s.x + layerOff(${f(o.pool.depth)});
  float pk = exp(-pow((px - ${f(o.pool.x)}) / (${f(o.pool.w)} * (0.35 + k)), 2.0));
  {
    float pv = stepd(pk * ${f(o.pool.path)} * (0.55 + 0.45 * vnoise(vec2(wp.x / ${f(9 * u)}, s.y * 0.7 / ${f(Math.max(1, u / 2))} + tm * 0.6))), 4.0, wp, 0.6);
    if (pv > 0.0) c = mix(c, pal(${rowRef(o.warmRow)}, min(paln(${rowRef(o.warmRow)}) - 1.0, floor(pv * 3.0))), pv);
  }

  // sparkles: short dashes that switch on and off, longer toward the viewer, denser in
  // the pool, on bright reflections and in ruffled patches
  float lum = dot(refl, vec3(0.3, 0.5, 0.2));
  float cw = floor(mix(2.0, ${f(7 * Math.max(1, u * 0.75))}, k));
  float rh = k > 0.55 ? ${f(Math.max(1, Math.round(u / 2)))} : 1.0;
  vec2 cell = vec2(floor(wp.x / cw), floor(s.y / rh));
  float h = hash2(cell);
  float dens = ${f(o.glints)} * (0.4 + smoothstep(0.35, 0.8, lum) * 2.5 + 2.0 * ruff);
  dens += ${f(o.pool.strength)} * pk * (1.0 - k * 0.5);
  float on = step(fract(tm * (0.25 + 0.5 * hash2(cell + 7.0)) * (1.0 - 0.6 * uReduced) + h * 13.0), 0.45);
  if (hash2(cell + 3.0) < dens && on > 0.5) {
    bool inPool = hash2(cell + 11.0) < pk * 1.6;
    float gr = inPool ? ${rowRef(o.warmRow)} : ${rowRef(o.glintRow)};
    c = pal(gr, max(0.0, paln(gr) - 1.0 - floor(k * 1.5 + hash2(cell + 5.0) * 1.2)));
  }

  ${o.rings
    .map(
      ([rx, ry], i) => `
  {
    float ex = ${f(rx)} - layerOff(1.0);
    float per = 5.5 + ${f(i * 0.9)};
    float age = mod(tm + ${f(i * 1.7)}, per) / per;
    float rr = (2.0 + age * 18.0) * ${f(o.ringUnit)};
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
