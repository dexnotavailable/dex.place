// The sky the opening falls through (the fall loop, round 1; Dex 10-16: "the camera takes you with the ofuda through
// the sky"; the sky he imagines: lanes\roadmap\refs\website-sky-backdrop-ref.webp, deep cobalt overhead, cerulean,
// pale only near the horizon). Drawn over the world's own sky (Kagami's morning, render/atmos.ts) while the camera is
// high: the colour is keyed to the camera's altitude and to each row's height above the horizon, so the high sky is
// deep and the sky eases into Kagami's milky morning as the camera comes down through the deck; by the break-out it
// is Kagami's own sky, and the fall's dissolves away (fine blue-noise grain, so no seam ever moves across the frame).
//
// A smooth per-row ramp in fine steps, each step's edge an interleaved-gradient-noise dither (no ordered seams, no
// rows of dots behind the paper at 4x, no vertical seams); the sun's warm bloom from the upper left over it.

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { FULL_VS } from "../../lab/engine/shaders.ts";

type RGB = readonly [number, number, number];

/**
 * The fall's sky by height above the horizon (frame heights): deep cobalt high overhead, cerulean, pale and a breath
 * warm toward the haze (the sky ref's top (0, 72, 120), its middle (54, 158, 191); ref 04's haze (209, 230, 230)).
 */
const FALL: readonly [number, RGB][] = [
  [1.3, [6, 58, 116]],
  [1.08, [14, 84, 150]],
  [0.88, [30, 114, 178]],
  [0.7, [58, 146, 198]],
  [0.56, [106, 178, 212]],
  [0.42, [160, 205, 224]],
  [0.24, [200, 225, 230]],
  [0, [214, 230, 228]],
];

/** How much of the fall's sky shows at an altitude (H above her feet): all of it high up, none under the deck. */
export function fallSkyShare(lift: number): number {
  const u = Math.min(1, Math.max(0, (lift - 8) / (18 - 8)));
  return u * u * (3 - 2 * u);
}

/** Kagami's sky formula (render/atmos.ts, the morning's style 1) without its bands: what the fall eases into. */
function kagamiAt(e: number, top: RGB, mid: RGB, low: RGB): RGB {
  if (e < 0) {
    const t = Math.min(1, -e / 0.2);
    return [mid[0] + (low[0] - mid[0]) * t, mid[1] + (low[1] - mid[1]) * t, mid[2] + (low[2] - mid[2]) * t];
  }
  const t = Math.pow(Math.min(1, e / 0.95), 0.62);
  return [mid[0] + (top[0] - mid[0]) * t, mid[1] + (top[1] - mid[1]) * t, mid[2] + (top[2] - mid[2]) * t];
}

function fallAt(e: number): RGB {
  if (e >= FALL[0]![0]) return FALL[0]![1];
  for (let i = 0; i + 1 < FALL.length; i++) {
    const [e0, c0] = FALL[i]!, [e1, c1] = FALL[i + 1]!;
    if (e <= e0 && e >= e1) {
      const t = (e0 - e) / (e0 - e1);
      return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
    }
  }
  return FALL[FALL.length - 1]![1];
}

/** The stops the shader interpolates (height above the horizon, colour 0..1). */
export const STOPS = [1.6, 1.3, 1.08, 0.88, 0.7, 0.56, 0.42, 0.24, 0.1, 0, -0.1, -0.25];

export interface FallSkyDraw {
  /** The fall's share (0: none drawn). */
  share: number;
  /** Horizon row (frame px). */
  hz: number;
  /** The stops' colours (0..1), STOPS.length of them. */
  cols: Float32Array;
  /** The sun (frame px x, y, core radius; radius 0: none), its bloom radius (px), strength and colour. */
  sun: [number, number, number];
  glow: [number, number, number];
  glowCol: RGB;
}

/**
 * The fall's sky now: `share` from the camera's altitude, the stops eased from the fall's deep ramp into the place's
 * own sky (top, mid, low; 0..1) by that share.
 */
export function fallSkyOf(lift: number, hz: number, top: RGB, mid: RGB, low: RGB, sun: [number, number, number], glow: [number, number, number], glowCol: RGB): FallSkyDraw {
  const share = fallSkyShare(lift);
  const cols = new Float32Array(STOPS.length * 3);
  STOPS.forEach((e, i) => {
    const k = kagamiAt(e, top, mid, low);
    const f = fallAt(e).map((v) => v / 255) as unknown as RGB;
    for (let c = 0; c < 3; c++) cols[i * 3 + c] = k[c]! + (f[c]! - k[c]!) * share;
  });
  return { share, hz, cols, sun, glow, glowCol };
}

const FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uHz;
// the share of px drawn: all of them until the stops (eased by the share) are within a breath of the place's own
uniform float uKeep;
uniform float uStops[${STOPS.length}];
uniform vec3 uCols[${STOPS.length}];
uniform vec3 uSun;      // x, y, core radius
uniform vec3 uGlow;     // bloom radius, strength, (unused)
uniform vec3 uGlowCol;
out vec4 o;
// interleaved gradient noise: a fine, even grain with no pattern (blue-noise-like), two decorrelated taps
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 ramp(float e) {
  vec3 c = uCols[0];
  for (int i = 0; i < ${STOPS.length - 1}; i++) {
    float e0 = uStops[i], e1 = uStops[i + 1];
    if (e <= e0 && e >= e1) { c = mix(uCols[i], uCols[i + 1], (e0 - e) / (e0 - e1)); }
  }
  if (e < uStops[${STOPS.length - 1}]) c = uCols[${STOPS.length - 1}];
  return c;
}
void main() {
  vec2 p = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  // (the fall's share dissolves in and out by grain, never by a moving edge)
  if (ign(p + vec2(17.0, 41.0)) >= uKeep) discard;
  float e = (uHz - p.y - 0.5) / uRes.y;
  // fine flat steps (1/96 of a frame height each: under 3 levels of colour apart), the grain choosing between a
  // step and the next
  float n = 96.0;
  float s = e * n;
  float fl = floor(s);
  float q = (fl + step(ign(p), fract(s))) / n;
  vec3 col = ramp(q);
  if (uSun.z > 0.0) {
    float d = length(p - uSun.xy);
    // the broad warm wash toward the sun, then the bloom close round it: the same grain on its steps
    // (screened over the sky, never mixed into it: on the deep blue a mix greys, light only adds)
    float wash = uGlow.y * exp(-d / uGlow.x);
    float w = floor(wash * 48.0 + ign(p + 7.0)) / 48.0;
    col = 1.0 - (1.0 - col) * (1.0 - uGlowCol * clamp(w, 0.0, 1.0) * 0.75);
    float ed = max(0.0, d - uSun.z);
    float bloom = 0.8 * exp(-ed / (uSun.z * 1.8)) + 0.3 * exp(-ed / (uSun.z * 6.0));
    float b = floor(clamp(bloom, 0.0, 1.0) * 48.0 + ign(p + 13.0)) / 48.0;
    col = mix(col, vec3(1.0, 0.975, 0.9), b);
    if (d < uSun.z - 0.5 || (d < uSun.z + 0.5 && ign(p + 3.0) < uSun.z + 0.5 - d)) col = vec3(1.0, 0.995, 0.965);
  }
  o = vec4(col, 1.0);
}`;

/** Draws the fall's sky over the world's sky (opaque where its share keeps it; before every plane). */
export class FallSky {
  private prog: WebGLProgram | null = null;
  private u: Record<string, WebGLUniformLocation> = {};
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.vao = vao;
    // (a driver that refuses the shader keeps the world's own sky)
    try {
      this.prog = compile(gl, FULL_VS, FS, "tesu-fall-sky");
      this.u = uniforms(gl, this.prog);
    } catch (e) {
      console.warn("[opening] the fall's sky shader", e);
    }
  }

  draw(W: number, Hf: number, s: FallSkyDraw): void {
    if (s.share <= 0.002 || !this.prog) return;
    const gl = this.gl, u = this.u;
    gl.useProgram(this.prog);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.uRes!, W, Hf);
    gl.uniform1f(u.uHz!, s.hz);
    gl.uniform1f(u.uKeep!, s.share >= 0.12 ? 1.01 : s.share / 0.12);
    gl.uniform1fv(u.uStops!, new Float32Array(STOPS));
    gl.uniform3fv(u.uCols!, s.cols);
    gl.uniform3f(u.uSun!, s.sun[0], s.sun[1], s.sun[2]);
    gl.uniform3f(u.uGlow!, s.glow[0], s.glow[1], s.glow[2]);
    gl.uniform3f(u.uGlowCol!, s.glowCol[0], s.glowCol[1], s.glowCol[2]);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
