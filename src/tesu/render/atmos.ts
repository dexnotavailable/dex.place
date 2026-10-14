// The sky, the still water and the mist: the three things in Tesu that are not plates.
//
// Still water is the old site's best idea, kept and generalised for a moving, zooming
// camera: every plane is drawn into a reflection target mirrored about its OWN waterline
// (so far shores meet the water higher up the frame), the sky mirrored about the horizon,
// her and the play plane about the play waterline; the water then reads that target at
// its own pixel plus a whole-pixel ripple shear. Each frame row of the lake is a depth
// (a perspective ground plane), so ripples, glints and haze are sized by distance and
// stay put on the water while the camera pans or pulls back.
//
// Everything is stepped and ordered-dithered: no smooth gradients on screen.

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { FULL_VS } from "../../lab/engine/shaders.ts";

const LIB = /* glsl */ `
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  int k = i.x + i.y * 4;
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[k] + 0.5) / 16.0;
}
float hash2(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i), b = hash2(i + vec2(1, 0)), c = hash2(i + vec2(0, 1)), d = hash2(i + vec2(1, 1));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// quantise v (0..1) into n steps, dithering the edge of each step
float stepd(float v, float n, vec2 p) {
  float x = v * n;
  float fl = floor(x);
  return (fl + step(bayer4(p), fract(x))) / n;
}
`;

const SKY_FS = /* glsl */ `#version 300 es
precision highp float;
${LIB}
uniform vec2 uRes;
uniform float uHz;        // horizon row
uniform vec3 uTop, uMid, uLow;
uniform vec3 uSun;        // x, y (frame px), radius; radius 0 = none
uniform float uMirror;    // 1 = drawn mirrored about the horizon (for the reflection)
uniform vec4 uGlow;       // bloom radius (frame px), strength, style (1 = banded with a bloom), dither cell
uniform vec3 uGlowCol;
out vec4 o;
// v (0..1) in n flat bands; only the last stretch of each band dithers into the next (a seam,
// never a screen door across the whole band)
float bandd(float v, float n, vec2 c) {
  float x = clamp(v, 0.0, 1.0) * n;
  float fl = floor(x), fr = fract(x);
  return (fl + step(bayer4(c), (fr - 0.72) / 0.28)) / n;
}
// (round 5) The sun: a small bright core and one smooth bloom falling off from it, a broad warm
// wash under it; fine flat steps ordered-dithered on the art's own cell (no ring edges anywhere)
vec3 sunOver(vec3 col, vec2 q, vec2 c) {
  float r = uSun.z;
  float d = length(q - uSun.xy);
  // the broad wash: the sky warming toward the sun
  float wash = uGlow.y * exp(-d / uGlow.x);
  col = mix(col, uGlowCol, stepd(clamp(wash, 0.0, 1.0), 40.0, c) * 0.8);
  // the bloom: bright close round the core, falling off smoothly
  float e = max(0.0, d - r);
  float bloom = 0.8 * exp(-e / (r * 1.8)) + 0.3 * exp(-e / (r * 6.0));
  col = mix(col, vec3(1.0, 0.975, 0.9), stepd(clamp(bloom, 0.0, 1.0), 40.0, c));
  // the core: crisp, its edge one cell of dither
  float k = clamp((r - d) / max(1.0, uGlow.w) + 0.5, 0.0, 1.0);
  if (k > bayer4(c)) col = vec3(1.0, 0.995, 0.965);
  return col;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  if (uMirror > 0.5) {
    if (p.y < uHz) discard;
    p.y = 2.0 * uHz - p.y;
  }
  if (uGlow.z > 0.5) {
    // the morning sky (Kagami's): the gradient in flat bands with dithered seams, deepening up to
    // the zenith (style 2, Gate Road's: the plain gradient), and the sun over it
    vec2 c = floor(floor(p) / uGlow.w);
    vec2 q = (c + 0.5) * uGlow.w;
    float h = clamp((uHz - q.y) / uRes.y, -0.2, 1.4);
    vec3 col;
    if (uGlow.z > 1.5) {
      float t = clamp(h / 0.9, 0.0, 1.0);
      float lo = clamp(-h / 0.2, 0.0, 1.0);
      col = mix(uMid, uTop, stepd(pow(t, 0.75), 9.0, c));
      col = mix(col, uLow, stepd(lo, 4.0, c));
    } else {
      float t = clamp(h / 0.95, 0.0, 1.0);
      float lo = clamp(-h / 0.2, 0.0, 1.0);
      col = mix(uMid, uTop, bandd(pow(t, 0.62), 12.0, c));
      col = mix(col, uLow, bandd(lo, 4.0, c));
    }
    if (uSun.z > 0.0) col = sunOver(col, q, c);
    o = vec4(col, 1.0);
    return;
  }
  p = floor(p);
  // height above the horizon, 0 at the horizon, 1 a frame height up
  float h = clamp((uHz - p.y) / uRes.y, -0.2, 1.4);
  float t = clamp(h / 0.9, 0.0, 1.0);
  float lo = clamp(-h / 0.2, 0.0, 1.0);
  float a = stepd(pow(t, 0.75), 9.0, p);
  vec3 c = mix(uMid, uTop, a);
  c = mix(c, uLow, stepd(lo, 4.0, p));
  if (uSun.z > 0.0) {
    float d = length(p - uSun.xy);
    float glow = clamp(1.0 - d / (uSun.z * 7.0), 0.0, 1.0);
    c = mix(c, vec3(1.0, 0.98, 0.9), stepd(glow * glow * 0.55, 5.0, p));
    if (d < uSun.z) c = vec3(1.0, 0.99, 0.94);
  }
  o = vec4(c, 1.0);
}`;

const MIST_FS = /* glsl */ `#version 300 es
precision highp float;
${LIB}
uniform vec2 uRes;
uniform vec4 uBands[4];   // row centre, half height, density, drift speed (px/s)
uniform int uCount;
uniform vec3 uColour;
uniform float uTime;
uniform float uCamX;      // for drift that stays put on the land
uniform vec2 uSpan;       // frame x range the mist covers (soft ends)
out vec4 o;
void main() {
  vec2 p = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  float ends = clamp(min(p.x - uSpan.x, uSpan.y - p.x) / 120.0, 0.0, 1.0);
  if (ends <= 0.0) discard;
  float a = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uCount) break;
    vec4 b = uBands[i];
    float d = (p.y - b.x) / b.y;
    float prof = exp(-d * d * 1.6);
    float x = (p.x + uCamX * (0.08 + 0.1 * float(i)) + uTime * b.w);
    float n = vnoise(vec2(x / 140.0, p.y / 18.0 + float(i) * 7.0)) * 0.65 + vnoise(vec2(x / 41.0, p.y / 7.0)) * 0.35;
    a = max(a, prof * b.z * (0.45 + 0.9 * n));
  }
  a *= ends;
  // two to four ordered-dither steps, never smooth alpha
  float s = stepd(clamp(a, 0.0, 1.0), 4.0, p) * 0.75;
  if (s <= 0.0) discard;
  o = vec4(uColour * s, s);
}`;

// Fog lying on the still water at one plane's waterline (a FogLayer): thick on the water,
// thinning up to a heaped top that rolls at three scales and drifts, a short apron out over the
// water in front; flat steps of translucency on the art's own cell, each step's edge a narrow
// dithered seam that wanders with the billows (never a ruled stratum, never a screen door).
// Locked to its plane (it parallaxes with the land it wraps). (Round 5) It lies in pools: thick
// at the karst's feet, torn patches between them over the open water, clear gaps where the lake
// mirrors crisply.
const FOG_FS = /* glsl */ `#version 300 es
precision highp float;
${LIB}
uniform vec2 uRes;
uniform float uWl;        // the plane's waterline row (frame px)
uniform vec3 uXf;         // the plane's art scale g, its x offset (frame px), the drift (art px)
uniform vec4 uFog;        // density, height, apron (art px), roll
uniform vec3 uFog2;       // bank size (art px), cell (frame px), foot (share of the height lying solid)
uniform vec4 uPools[16];  // plane art px x, half width, strength, 0
uniform int uNPools;
uniform float uCover;     // the share of the open water between pools its patches cover (1: all)
uniform vec3 uColour;
uniform float uMirror;    // 1: drawn mirrored about the waterline (the lake's reflection target)
out vec4 o;
// v (0..1) in n flat steps; only a narrow seam where two steps meet dithers
float seamd(float v, float n, vec2 c) {
  float x = clamp(v, 0.0, 1.0) * n;
  float fl = floor(x), fr = fract(x);
  return (fl + step(bayer4(c), (fr - 0.62) / 0.38)) / n;
}
void main() {
  vec2 f = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  if (uMirror > 0.5) {
    if (f.y < uWl) discard;
    f.y = 2.0 * uWl - f.y;
  }
  vec2 cc = floor(f / uFog2.y);
  vec2 c = (cc + 0.5) * uFog2.y;
  float g = uXf.x;
  float ps = (c.x - uXf.y) / g;
  float px = ps + uXf.z;
  float up = (uWl - c.y) / g;
  float S = uFog2.x;
  // where the banks lie (fixed on the land): pools, and torn patches over the open water
  float cov = 1.0;
  if (uNPools > 0 || uCover < 0.999) {
    float pool = 0.0;
    for (int i = 0; i < 16; i++) {
      if (i >= uNPools) break;
      vec4 P = uPools[i];
      float dx = (ps - P.x) / max(1.0, P.y);
      // (a pool's ends tear: its reach wanders with the drifting fog)
      dx *= 1.0 + 0.35 * (vnoise(vec2(px / (S * 0.3), float(i) * 3.1)) - 0.5);
      pool = max(pool, P.z * exp(-dx * dx * 1.8));
    }
    float open = uCover * smoothstep(0.42, 0.78, vnoise(vec2(ps / (S * 1.6), 9.3)) * 0.75 + vnoise(vec2(px / (S * 0.45), 4.4)) * 0.25);
    cov = max(pool, open);
    if (cov < 0.04) discard;
  }
  // the banks' top: heaped at three scales, never level for long; lower where the cover thins
  float n1 = vnoise(vec2(px / S, 1.3));
  float n2 = vnoise(vec2(px / (S * 0.36), 4.1));
  float n3 = vnoise(vec2(px / (S * 0.12), 7.7));
  float top = uFog.y * mix(1.0, 0.18 + 1.25 * n1 * n1 + 0.4 * n2 + 0.18 * n3, uFog.w) * min(1.25, 0.25 + 0.75 * cov);
  if (up > top || top < 1.0) discard;
  float a;
  if (up >= 0.0) a = pow(1.0 - up / top, 0.45);
  else {
    if (uFog.z <= 0.0) discard;
    a = clamp(1.0 + up / (uFog.z * min(1.0, cov)), 0.0, 1.0);
  }
  // billows inside the bank: rolling lumps of thicker fog, so its steps follow the banks' forms
  float bl = vnoise(vec2(px / (S * 0.22), up / (uFog.y * 0.55) + 2.0)) * 0.6 + vnoise(vec2(px / (S * 0.07), up / (uFog.y * 0.2))) * 0.4;
  a = clamp(a * (0.62 + 0.62 * bl) * min(1.0, 0.35 + 0.75 * cov), 0.0, 1.0);
  // the bank's foot (opt-in): solid on the water up to a share of its rolling height
  if (uFog2.z > 0.0 && up >= 0.0) a = max(a, clamp(2.0 - up / max(top * uFog2.z, 1.0), 0.0, 1.0));
  // flat steps of translucency, their seams dithered on the cell
  float s = seamd(a, 5.0, cc) * uFog.x;
  if (s <= 0.0) discard;
  // the bank's upper reach catches the morning sun: a warmer, paler step over the cool body
  // below it, so each bank reads as a lit volume lying on the water, not a tint
  vec3 col = up > top * 0.58 ? mix(uColour, vec3(0.99, 0.985, 0.955), 0.65) : uColour;
  o = vec4(col * s, s);
}`;

const WATER_FS = /* glsl */ `#version 300 es
precision highp float;
${LIB}
uniform vec2 uRes;
uniform sampler2D uRefl;
uniform float uHz, uEye, uWy, uZ, uCx, uLens;
uniform vec2 uFocus;
uniform vec4 uExt;        // near x0, x1, far x0, x1 (3D world px)
uniform vec2 uDepth;      // near rate, far rate
uniform vec2 uRows;       // draw rows [a, b)
uniform float uTime;
uniform vec3 uDeep, uBody, uShallow, uHaze, uGlint;
uniform vec3 uMirrorTint;             // what it mirrors, multiplied (1: as bright as the sky above)
uniform float uStill;     // 1 = mirror-still (Kagami), less for a harbour
out vec4 o;
void main() {
  vec2 f = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  if (f.y < uRows.x || f.y >= uRows.y) discard;
  vec2 p = floor(f);
  // undo the lens zoom, then this row is a depth on a flat lake
  vec2 q = uFocus + (f - uFocus) / uLens;
  float denom = uWy - uEye;
  if (denom <= 0.0) discard;
  float s = (q.y - uHz) / denom;
  if (s <= 0.0) discard;
  float r = 1.0 / (1.0 / s - 1.0 / uZ + 1.0);
  if (r <= 0.0 || r > uDepth.x || r < uDepth.y) discard;
  float u = clamp((1.0 / r - 1.0 / uDepth.x) / (1.0 / uDepth.y - 1.0 / uDepth.x), 0.0, 1.0);
  float x3 = (q.x - uRes.x * 0.5) / s + uCx;
  float x0 = mix(uExt.x, uExt.z, u), x1 = mix(uExt.y, uExt.w, u);
  // an irregular shore: coves and points, more of them the further away
  float span = x1 - x0;
  x0 += ((vnoise(vec2(u * 24.0, 3.1)) - 0.5) * 0.3 + (vnoise(vec2(u * 85.0, 7.7)) - 0.5) * 0.1) * span * u;
  x1 += ((vnoise(vec2(u * 21.0, 9.4)) - 0.5) * 0.3 + (vnoise(vec2(u * 77.0, 1.3)) - 0.5) * 0.1) * span * u;
  if (x3 < x0 || x3 > x1) discard;
  // closeness 0 (horizon) .. 1 (at the play plane and nearer)
  float k = clamp(r, 0.0, 1.0);
  // world-anchored wave coordinates (px on the water's own surface)
  float wx = x3 / 9.0;
  float t = uTime;
  float ruff = vnoise(vec2(wx / 60.0 + t * 0.03, r * 9.0));
  ruff = stepd(ruff, 3.0, p) * (1.0 - uStill * 0.6);
  // ripple shear: whole pixels, bigger toward the viewer
  float amp = mix(0.4, 3.2, pow(k, 1.3)) * (0.35 + ruff) * (1.2 - uStill * 0.5);
  float ph = wx * 0.9 + p.y * 0.55 + t * 1.6;
  float dx = floor(sin(ph) * amp * (0.6 + 0.4 * vnoise(vec2(wx * 0.2, p.y * 0.3))) + 0.5);
  float dy = floor(sin(ph * 0.5 + 1.7) * amp * 0.25 + 0.5);
  vec2 rp = vec2(p.x + dx, p.y + dy);
  rp = clamp(rp, vec2(0.0), uRes - 1.0);
  vec3 refl = texelFetch(uRefl, ivec2(rp.x, uRes.y - 1.0 - rp.y), 0).rgb;
  refl *= uMirrorTint;
  // the water's own colour: pale at the horizon, deep jade near
  vec3 body = mix(uShallow, uBody, smoothstep(0.0, 0.5, k));
  body = mix(body, uDeep, smoothstep(0.45, 1.1, k));
  // how much it mirrors: nearly all far away, still most of it near (a still lake)
  float rs = mix(0.96, mix(0.55, 0.82, uStill), pow(k, 0.8)) * (1.0 - 0.25 * ruff);
  // short gaps where a ripple faces the sky
  float gap = step(0.86 - 0.08 * k, vnoise(vec2(wx * 1.3 + t * 0.4, p.y * 0.9)));
  rs *= 1.0 - gap * 0.35;
  float rl = stepd(rs, 5.0, p);
  vec3 c = mix(body, refl, rl);
  // sun glints on the ripples nearer the viewer
  float cell = floor(p.x / max(2.0, floor(mix(2.0, 7.0, k))));
  float gl = hash2(vec2(cell, floor(p.y / max(1.0, floor(k * 2.0 + 1.0))) + floor(t * 0.7 + hash2(vec2(cell, p.y)) * 9.0)));
  float lum = dot(refl, vec3(0.3, 0.55, 0.15));
  if (gl > 0.993 - 0.01 * k * lum && k > 0.15) c = mix(c, uGlint, 0.8);
  // haze with distance, stepped
  float fog = (1.0 - smoothstep(0.03, 0.9, r)) * 0.7;
  c = mix(c, uHaze, stepd(fog, 6.0, p));
  o = vec4(c, 1.0);
}`;

export interface MistBand {
  row: number;
  half: number;
  density: number;
  drift: number;
}

export interface WaterDraw {
  hz: number;
  eye: number;
  wy: number;
  z: number;
  cx: number;
  lens: number;
  focus: [number, number];
  ext: [number, number, number, number];
  depth: [number, number];
  rows: [number, number];
  time: number;
  deep: [number, number, number];
  body: [number, number, number];
  shallow: [number, number, number];
  haze: [number, number, number];
  glint: [number, number, number];
  /** Multiplies the mirrored colour (default [1, 1, 1]). */
  mirror?: [number, number, number];
  still: number;
}

/** The sky's banded look and the sun's bloom (an atmos entry's `glow`, in frame px). */
export interface SkyGlow {
  radius: number;
  strength: number;
  colour: [number, number, number];
  /** Dither cell, frame px (2 at the catch's 2x). */
  cell: number;
  /** (round 5) The plain sky gradient, only the sun drawn over it (no flat bands). */
  plain?: boolean;
}

/** One fog bank to draw: its plane's waterline row and transform, and the layer's look (art px). */
export interface FogDraw {
  wl: number;
  g: number;
  offX: number;
  drift: number;
  density: number;
  height: number;
  apron: number;
  roll: number;
  size: number;
  cell: number;
  /** The share of its height lying solid on the water (0, the default: none). */
  foot?: number;
  /** Pools [plane art px x, half width, strength] and the open water's cover (round 5). */
  pools?: readonly (readonly [number, number, number])[];
  cover?: number;
  colour: [number, number, number];
  mirrored: boolean;
}

export class Atmos {
  private sky: WebGLProgram;
  private skyU: Record<string, WebGLUniformLocation>;
  private mist: WebGLProgram;
  private mistU: Record<string, WebGLUniformLocation>;
  private water: WebGLProgram;
  private waterU: Record<string, WebGLUniformLocation>;
  private fog: WebGLProgram;
  private fogU: Record<string, WebGLUniformLocation>;

  constructor(private gl: WebGL2RenderingContext, private vao: WebGLVertexArrayObject) {
    this.sky = compile(gl, FULL_VS, SKY_FS, "tesu-sky");
    this.skyU = uniforms(gl, this.sky);
    this.mist = compile(gl, FULL_VS, MIST_FS, "tesu-mist");
    this.mistU = uniforms(gl, this.mist);
    this.water = compile(gl, FULL_VS, WATER_FS, "tesu-water");
    this.waterU = uniforms(gl, this.water);
    this.fog = compile(gl, FULL_VS, FOG_FS, "tesu-fog");
    this.fogU = uniforms(gl, this.fog);
  }

  drawSky(w: number, h: number, hz: number, top: number[], mid: number[], low: number[], sun: [number, number, number], mirrored: boolean, glow?: SkyGlow): void {
    const gl = this.gl, u = this.skyU;
    gl.useProgram(this.sky);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.uRes!, w, h);
    gl.uniform1f(u.uHz!, hz);
    gl.uniform3fv(u.uTop!, top);
    gl.uniform3fv(u.uMid!, mid);
    gl.uniform3fv(u.uLow!, low);
    gl.uniform3fv(u.uSun!, sun);
    gl.uniform1f(u.uMirror!, mirrored ? 1 : 0);
    gl.uniform4f(u.uGlow!, glow ? glow.radius : 0, glow ? glow.strength : 0, glow ? (glow.plain ? 2 : 1) : 0, glow ? glow.cell : 1);
    gl.uniform3fv(u.uGlowCol!, glow ? glow.colour : [1, 1, 1]);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
  }

  drawMist(w: number, h: number, bands: MistBand[], colour: number[], time: number, camX: number, span: [number, number] = [-1e6, 1e6]): void {
    if (!bands.length) return;
    const gl = this.gl, u = this.mistU;
    gl.useProgram(this.mist);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(u.uRes!, w, h);
    const arr = new Float32Array(16);
    bands.slice(0, 4).forEach((b, i) => arr.set([b.row, Math.max(1, b.half), b.density, b.drift], i * 4));
    gl.uniform4fv(u.uBands!, arr);
    gl.uniform1i(u.uCount!, Math.min(4, bands.length));
    gl.uniform3fv(u.uColour!, colour);
    gl.uniform1f(u.uTime!, time % 4096);
    gl.uniform1f(u.uCamX!, camX % 100000);
    gl.uniform2fv(u.uSpan!, span);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** A bank of fog at a plane's waterline (premultiplied over what is drawn). */
  drawFog(w: number, h: number, d: FogDraw): void {
    if (d.density <= 0) return;
    const gl = this.gl, u = this.fogU;
    gl.useProgram(this.fog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(u.uRes!, w, h);
    gl.uniform1f(u.uWl!, d.wl);
    gl.uniform3f(u.uXf!, d.g, d.offX, d.drift % 100000);
    gl.uniform4f(u.uFog!, d.density, d.height, d.apron, d.roll);
    gl.uniform3f(u.uFog2!, d.size, d.cell, d.foot ?? 0);
    const pools = (d.pools ?? []).slice(0, 16);
    const arr = new Float32Array(64);
    pools.forEach((q, i) => arr.set([q[0], q[1], q[2], 0], i * 4));
    gl.uniform4fv(u.uPools!, arr);
    gl.uniform1i(u.uNPools!, pools.length);
    gl.uniform1f(u.uCover!, d.cover ?? 1);
    gl.uniform3fv(u.uColour!, d.colour);
    gl.uniform1f(u.uMirror!, d.mirrored ? 1 : 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  drawWater(w: number, h: number, refl: WebGLTexture, d: WaterDraw): void {
    const gl = this.gl, u = this.waterU;
    gl.useProgram(this.water);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.uRes!, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, refl);
    gl.uniform1i(u.uRefl!, 0);
    gl.uniform1f(u.uHz!, d.hz);
    gl.uniform1f(u.uEye!, d.eye);
    gl.uniform1f(u.uWy!, d.wy);
    gl.uniform1f(u.uZ!, d.z);
    gl.uniform1f(u.uCx!, d.cx);
    gl.uniform1f(u.uLens!, d.lens);
    gl.uniform2fv(u.uFocus!, d.focus);
    gl.uniform4fv(u.uExt!, d.ext);
    gl.uniform2fv(u.uDepth!, d.depth);
    gl.uniform2fv(u.uRows!, d.rows);
    gl.uniform1f(u.uTime!, d.time % 4096);
    gl.uniform3fv(u.uDeep!, d.deep);
    gl.uniform3fv(u.uBody!, d.body);
    gl.uniform3fv(u.uShallow!, d.shallow);
    gl.uniform3fv(u.uHaze!, d.haze);
    gl.uniform3fv(u.uGlint!, d.glint);
    gl.uniform3fv(u.uMirrorTint!, d.mirror ?? [1, 1, 1]);
    gl.uniform1f(u.uStill!, d.still);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
  }
}
