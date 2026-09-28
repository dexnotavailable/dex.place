// Soft cloud masses for colossus-plain: a few big, slow, domain-warped cloud
// bodies in the upper sky, each with a flat-ish base and a lit underside (the
// density is sampled a little below each pixel: where it thins out below, the
// pixel is the cloud's belly and catches the light from the haze). Stepped into
// three flat tones; dither only on the tone edges.

import { f, rowRef } from "../../engine/index.ts";

export interface CloudMassOpts {
  y0: number;
  y1: number;
  /** Feature size in px (x, y), drift px/s, shape change speed. */
  sx: number;
  sy: number;
  drift: number;
  evolve: number;
  /** 0..1 coverage, alpha of the densest step, ramp row. */
  cover: number;
  alpha: number;
  row: string;
  /** Ramp for the lit belly. */
  lit: string;
  /** How far below (px) the belly test samples. */
  belly: number;
}

export function cloudMassGlsl(o: CloudMassOpts): string {
  return /* glsl */ `
float cmDens(vec2 q, vec2 w, float t, float y) {
  float n = fbm(q + 1.5 * w + vec2(t * 0.3, -t * 0.15), 4);
  // bodies sit in the middle of the band; flatter bases, taller tops
  float prof = smoothstep(${f(o.y0)}, ${f(o.y0 + (o.y1 - o.y0) * 0.45)}, y) * (1.0 - smoothstep(${f(o.y1 - (o.y1 - o.y0) * 0.22)}, ${f(o.y1)}, y));
  return n * prof;
}
vec4 layer(vec2 p, vec2 s) {
  if (p.y < ${f(o.y0)} || p.y > ${f(o.y1)}) return vec4(0.0);
  float tm = uTime * (1.0 - 0.5 * uReduced);
  float px = p.x - floor(tm * ${f(o.drift)} + 0.5);
  vec2 q = vec2(px / ${f(o.sx)}, p.y / ${f(o.sy)});
  float t = tm * ${f(o.evolve)};
  vec2 w = vec2(fbm(q * 0.5 + vec2(0.0, t), 2), fbm(q * 0.5 + vec2(5.2, 1.3 - t), 2)) - 0.5;
  float th = (1.0 - ${f(o.cover)}) * 0.6;
  float d = cmDens(q, w, t, p.y) - th;
  if (d <= 0.0) return vec4(0.0);
  float dB = cmDens(q + vec2(0.0, ${f(o.belly / o.sy)}), w, t, p.y + ${f(o.belly)}) - th;
  float k = clamp(d / 0.16, 0.0, 1.0);
  float lv = floor(k * 3.0 + (bayer4(p) - 0.5) * 0.35 + 0.5);
  if (lv <= 0.0) return vec4(0.0);
  // belly: density drops away below this pixel
  float belly = 1.0 - smoothstep(-0.05, 0.0, dB - d * 0.4);
  float light = flashLight(s) * 0.7 + sceneLight(s, uDepth) * 0.5;
  float bl = floor(belly * 2.0 + (bayer4(p) - 0.5) * 0.3 + 0.5);
  vec3 body = bl > 0.0
    ? ramp(${rowRef(o.lit)}, 0.1 + 0.2 * bl + light, p, 0.0)
    : ramp(${rowRef(o.row)}, 0.2 + 0.2 * lv + light, p, 0.0);
  vec3 c = mix(fogColor(s), body, 0.8);
  c = applyFog(c, uFog, 0.0, p, s);
  return vec4(c, ${f(o.alpha)} * min(lv, 3.0) / 3.0);
}`;
}
