// The opening's sky, the part that is the camera's own (Dex 10-16: "I need clouds, front fog layers on the camera, wind
// and stuff affecting the ofuda's path"): the fog layers between the lens and the paper. They sweep up across the frame
// as the camera comes down through the sky, faster than anything in the world (they are nearer than the near plane),
// drifting west on the east wind. Pixel fog in the world's manner (DEX-EYE 6-7: authored in code; flat steps of
// translucency, each step's edge one narrow dithered seam, never a screen door; billowy lobed edges, never a ruled
// band; lit warm along the top, cool below). The clouds the camera passes are the world's (world/sections/
// opening-sky.ts, the one cloud family on their planes).

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { FULL_VS } from "../../lab/engine/shaders.ts";
import type { Way } from "./timeline.ts";

export interface Veil {
  /** T at which its middle crosses the frame's middle. */
  T: number;
  /** How fast it rises across the frame (frame heights a second). */
  speed: number;
  /** Half its thickness (share of the frame's height), how dense at its heart (0..1), its westward drift (px/s). */
  half: number;
  density: number;
  drift: number;
  /** Its tone: lit (the sky's whites, warm along its top) or the cloud base's cool grey. */
  tone: "lit" | "base";
}

/** The fog layers of the fall (ways 1-3): a thin one high up, the thick bank the paper goes through, two at the base. */
export const VEILS: readonly Veil[] = [
  { T: 2.1, speed: 0.34, half: 0.07, density: 0.5, drift: 16, tone: "lit" },
  { T: 5.6, speed: 0.4, half: 0.16, density: 0.78, drift: 22, tone: "lit" },
  { T: 6.5, speed: 0.42, half: 0.06, density: 0.55, drift: 30, tone: "lit" },
  { T: 8.7, speed: 0.5, half: 0.12, density: 0.66, drift: 26, tone: "base" },
  { T: 10.2, speed: 0.62, half: 0.18, density: 0.58, drift: 20, tone: "base" },
];

/** A veil on the frame now: its middle row and half thickness (frame px), density, x offset (px), seed, tone. */
export interface VeilDraw {
  row: number;
  half: number;
  density: number;
  x: number;
  seed: number;
  base: boolean;
}

/** The veils on the frame at T (none on way 4, none with reduced motion: they are pure motion). */
export function fallVeils(T: number, W: number, Hf: number, way: Way, reduced: boolean): VeilDraw[] {
  void W;
  if (way === "bottom" || reduced) return [];
  const out: VeilDraw[] = [];
  VEILS.forEach((v, i) => {
    const row = Hf * (0.5 - (T - v.T) * v.speed);
    const half = v.half * Hf;
    if (row < -2 * half || row > Hf + 2 * half) return;
    out.push({ row, half, density: v.density, x: Math.round(T * v.drift), seed: i * 17.3 + 3.1, base: v.tone === "base" });
  });
  return out;
}

const FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec4 uA[6];   // row, half, density, x offset
uniform vec4 uB[6];   // seed, base tone (0 / 1)
uniform int uN;
out vec4 o;
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  int k = i.x + i.y * 4;
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[k] + 0.5) / 16.0;
}
float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float vn1(float x) {
  float i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), f);
}
// rounded lobes of uneven sizes along an edge (a cloud's outline: each bump a half disc, its width and height its
// own), the bigger ones carrying smaller ones on their shoulders
float bumps(float x, float L, float s) {
  float c = floor(x / L), best = 0.0;
  for (int k = -1; k <= 1; k++) {
    float i = c + float(k);
    float ctr = (i + 0.2 + 0.6 * hash1(i * 3.1 + s)) * L;
    float r = L * (0.55 + 0.6 * hash1(i * 7.7 + s + 1.0));
    float d = (x - ctr) / r;
    if (abs(d) < 1.0) best = max(best, sqrt(1.0 - d * d) * (0.45 + 0.55 * hash1(i * 1.9 + s + 2.0)));
  }
  return best;
}
float lobes(float x, float s) {
  return 0.62 * bumps(x, 96.0, s) + 0.38 * bumps(x + 37.0, 34.0, s + 5.0);
}
// v (0..1) in n flat steps; only the last stretch of each step dithers into the next (a seam, never a screen door)
float seam(float v, float n, vec2 c) {
  float x = clamp(v, 0.0, 1.0) * n;
  float fl = floor(x), fr = fract(x);
  return (fl + step(bayer4(c), (fr - 0.78) / 0.22)) / n;
}
void main() {
  vec2 p = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y));
  float best = 0.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    if (i >= uN) break;
    vec4 a = uA[i];
    vec4 b = uB[i];
    float x = p.x + a.w;
    // patchy along its length: thick masses and thin, torn gaps (never one even ribbon across the frame)
    float mass = smoothstep(0.18, 0.62, vn1(x / 260.0 + b.x) * 0.7 + vn1(x / 97.0 + b.x * 2.0) * 0.3);
    float top = a.x - a.y * (0.25 + 0.95 * lobes(x, b.x)) * (0.45 + 0.55 * mass);
    float bot = a.x + a.y * (0.35 + 0.55 * lobes(x * 0.7 + 400.0, b.x + 4.0)) * (0.5 + 0.5 * mass);
    if (p.y < top || p.y > bot) continue;
    float u = (p.y - top) / max(1.0, bot - top);
    // thick in its body, thinning to its lobed edges
    float prof = smoothstep(0.0, 0.3, u) * smoothstep(1.0, 0.62, u);
    float al = a.z * prof * (0.35 + 0.65 * mass);
    if (al > best) {
      best = al;
      // lit warm along its top, cool in its body (the base veils cooler still)
      vec3 lit = mix(vec3(1.0, 0.975, 0.94), vec3(0.93, 0.95, 0.985), smoothstep(0.0, 0.5, u));
      vec3 cool = mix(vec3(0.9, 0.92, 0.96), vec3(0.78, 0.82, 0.89), smoothstep(0.1, 0.9, u));
      col = b.y > 0.5 ? cool : lit;
    }
  }
  // four flat steps of translucency, up to 0.8
  float s = seam(best / 0.8, 4.0, p) * 0.8;
  if (s <= 0.0) discard;
  o = vec4(col * s, s);
}`;

/** Draws the fall's veils over the frame (premultiplied, after the world, before the titles). */
export class Veils {
  private prog: WebGLProgram | null = null;
  private u: Record<string, WebGLUniformLocation> = {};
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.vao = vao;
    // (a driver that refuses the shader loses the veils, never the world)
    try {
      this.prog = compile(gl, FULL_VS, FS, "tesu-opening-veils");
      this.u = uniforms(gl, this.prog);
    } catch (e) {
      console.warn("[opening] the fog layers' shader", e);
    }
  }

  draw(W: number, Hf: number, veils: VeilDraw[]): void {
    if (!veils.length || !this.prog) return;
    const gl = this.gl, u = this.u;
    gl.useProgram(this.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(u.uRes!, W, Hf);
    const A = new Float32Array(24), B = new Float32Array(24);
    veils.slice(0, 6).forEach((v, i) => {
      A.set([v.row, Math.max(1, v.half), v.density, v.x], i * 4);
      B.set([v.seed, v.base ? 1 : 0, 0, 0], i * 4);
    });
    gl.uniform4fv(u.uA!, A);
    gl.uniform4fv(u.uB!, B);
    gl.uniform1i(u.uN!, Math.min(6, veils.length));
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
