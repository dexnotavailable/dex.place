// Constant pixel size on the way out (Dex 10-16: "I'd rather have the pixels be the same size, or at least portrayed
// as such, when the camera pans out for huge scenes"). One frame px is one world px at play zoom (2 screen px on a
// 1440p screen); wider than play zoom, every layer is REDUCED onto that same grid instead of point-sampled:
//
// - each frame px covers a footprint of 1/k art px a side (k = frame px per art px < 1);
// - it is opaque when its opaque texels cover at least a third of it (so a 1 px rope or pole never drops out at the
//   in-between scales), else clear;
// - its colour is the one covering most of it, except that a colour a clear step lighter or darker than the
//   footprint's background (what covers most of it and of the ring just outside it) counts double, so a 1 px line,
//   crack, rope or thread survives at every phase (at most 2 px thick) instead of breaking up, and a line that is itself
//   the main colour of a footprint is never flipped to its ground;
// - it is always one of the texels' own colours (palette-keeping: no blend, no blur, no new colour).
//
// Footprints are anchored to the layer's own art grid (the frame px minus the layer's whole-px offset), so a pan moves
// every layer by whole pixels with the same picture (no shimmer), whatever the camera's sub-pixel position. At k >= 1
// (an authored level, the 2x close band) nothing changes: one texel per frame px, as before.
//
// Used by the plates (planes.ts, palette indices across a tile and its neighbours), the plane sprites (sprites.ts,
// RGBA frames) and the actor layer below (her, her effects and the talisman at zoom < 1).

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { FULL_VS } from "../../lab/engine/shaders.ts";
import { makeTarget, type Target, type WorldRenderer } from "../../world/render/renderer.ts";
import type { CamState } from "./view.ts";
import { REDUCE_BOOST, REDUCE_FEATURE, REDUCE_OPAQUE } from "./grid.ts";

export { REDUCE_BOOST, REDUCE_FEATURE, REDUCE_OPAQUE };

/** Shared constants and luma (GLSL). */
export const REDUCE_CONST_GLSL = /* glsl */ `
const float RED_OPAQUE = ${REDUCE_OPAQUE.toFixed(6)};
const float RED_FEAT = ${REDUCE_FEATURE.toFixed(6)};
const float RED_BOOST = ${REDUCE_BOOST.toFixed(6)};
float redLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

/**
 * The reduction rule in GLSL, the same steps as its CPU reference (grid.ts reduceFootprint): `KEY NAME(ARGS, vec2 a0,
 * vec2 a1)` -> the picked key, or NONE when the footprint is clear. FETCH(ivec2 t) gives a texel's key, CLEAR for
 * clear, UNKNOWN (a key, or null) for a texel to leave out; LUMA(k) its luma. Needs REDUCE_CONST_GLSL.
 */
function reduceGlsl(o: { name: string; key: string; args: string; fetch: string; clear: string; unknown: string | null; none: string; luma: string }): string {
  const skip = o.unknown ? `if (c == ${o.unknown}) continue;` : "";
  const slot = (add: string): string => `
      int m = -1;
      for (int q = 0; q < 24; q++) {
        if (q >= n) break;
        if (ks[q] == c) { m = q; break; }
      }
      if (m < 0 && n < 24) { m = n; ks[n] = c; ws[n] = 0.0; rs[n] = 0.0; n++; }
      if (m >= 0) ${add}`;
  return /* glsl */ `
${o.key} ${o.name}(${o.args}, vec2 a0, vec2 a1) {
  ${o.key} ks[24];
  float ws[24];
  float rs[24];
  int n = 0;
  float total = 0.0, opaque = 0.0, ringN = 0.0;
  vec2 span = a1 - a0;
  bool exact = max(span.x, span.y) <= 3.0;
  vec2 b = floor(a0);
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec2 tc;
      float w;
      if (exact) {
        vec2 cell = b + vec2(float(i), float(j));
        vec2 d = min(a1, cell + 1.0) - max(a0, cell);
        if (d.x <= 0.0 || d.y <= 0.0) continue;
        w = d.x * d.y;
        tc = cell;
      } else {
        tc = floor(a0 + (vec2(float(i), float(j)) + 0.5) * span * 0.25);
        w = 1.0;
      }
      ${o.key} c = ${o.fetch.replace(/\$T/g, "ivec2(tc)")};
      ${skip}
      total += w;
      if (c != ${o.clear}) opaque += w;${slot("ws[m] += w;")}
    }
  }
  if (total <= 0.0 || opaque < total * RED_OPAQUE) return ${o.none};
  // one opaque colour (most of a picture: flat areas, the inside of a shape): nothing to decide
  if (n == 1) return ks[0];
  if (n == 2 && (ks[0] == ${o.clear} || ks[1] == ${o.clear})) return ks[0] == ${o.clear} ? ks[1] : ks[0];
  // the background: most of (its share of the core + its share of 8 samples just outside it)
  vec3 rx = vec3(a0.x - 0.5, (a0.x + a1.x) * 0.5, a1.x + 0.5), ry = vec3(a0.y - 0.5, (a0.y + a1.y) * 0.5, a1.y + 0.5);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 3; i++) {
      if (i == 1 && j == 1) continue;
      ${o.key} c = ${o.fetch.replace(/\$T/g, "ivec2(floor(vec2(rx[i], ry[j])))")};
      ${skip}
      ringN += 1.0;${slot("rs[m] += 1.0;")}
    }
  }
  int bg = 0, mn = -1;
  float bgS = -1.0;
  for (int q = 0; q < 24; q++) {
    if (q >= n) break;
    float sc = ws[q] / total + (ringN > 0.0 ? rs[q] / ringN : 0.0);
    if (sc > bgS) { bgS = sc; bg = q; }
    if (ks[q] != ${o.clear} && ws[q] > 0.0 && (mn < 0 || ws[q] > ws[mn])) mn = q;
  }
  if (mn < 0) return ${o.none};
  float ref = ks[bg] != ${o.clear} ? ${o.luma.replace(/\$K/g, "ks[bg]")} : ${o.luma.replace(/\$K/g, "ks[mn]")};
  int pick = mn;
  float ps = -1.0;
  for (int q = 0; q < 24; q++) {
    if (q >= n) break;
    if (ks[q] == ${o.clear} || ws[q] <= 0.0) continue;
    float sc = ws[q] * (abs(${o.luma.replace(/\$K/g, "ks[q]")} - ref) > RED_FEAT ? RED_BOOST : 1.0);
    if (sc > ps) { ps = sc; pick = q; }
  }
  return ks[pick];
}
`;
}

/**
 * The reduction of an RGBA texture over the footprint [a0, a1) in texel units (rows as stored): exact area weights
 * when it spans at most 3 texels a side (4 touched), else a 4 x 4 grid of samples. `clearA`: clear below alpha 0.5
 * (painted frames); otherwise clear only where all four channels are 0 (a premultiplied layer with additive light).
 * Texels outside the texture are clear. Returns the picked texel, or vec4(-1) when the footprint is clear.
 * Needs REDUCE_CONST_GLSL.
 */
export const REDUCE_RGBA_GLSL = /* glsl */ `
vec4 redFetchRGBA(sampler2D tex, ivec2 size, ivec2 t, bool clearA) {
  if (t.x < 0 || t.y < 0 || t.x >= size.x || t.y >= size.y) return vec4(0.0);
  vec4 c = texelFetch(tex, t, 0);
  if (clearA ? c.a < 0.5 : max(max(c.r, c.g), max(c.b, c.a)) < 0.002) return vec4(0.0);
  return c;
}
${reduceGlsl({ name: "reduceRGBA", key: "vec4", args: "sampler2D tex, ivec2 size, bool clearA", fetch: "redFetchRGBA(tex, size, $T, clearA)", clear: "vec4(0.0)", unknown: null, none: "vec4(-1.0)", luma: "redLum($K.rgb)" })}`;

/**
 * The reduction of a plate (palette indices; planes.ts supplies `int tileIdx(ivec2)`, -1 for a texel not painted yet,
 * and `vec3 palC(int)`): the picked index, 0 when clear. Needs REDUCE_CONST_GLSL.
 */
export const REDUCE_INDEX_GLSL = reduceGlsl({ name: "reduceIdx", key: "int", args: "int unused", fetch: "tileIdx($T)", clear: "0", unknown: "-1", none: "0", luma: "redLum(palC($K))" });

const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform ivec2 uSize;     // the layer's size (its px = world px)
uniform vec2 uRes;       // the frame
uniform vec4 uMap;       // frame px -> layer px: layer = (frame px - uMap.xy) * uMap.z (+ the anchor phase uMap.w in x)
uniform float uPhaseY;   // the anchor phase in y
uniform float uMirror;   // frame row to mirror about, or -1
uniform vec4 uRect;      // the frame rect the layer covers (x0, y0, x1, y1), y down
out vec4 o;
${REDUCE_CONST_GLSL}
${REDUCE_RGBA_GLSL}
void main() {
  float row = uRes.y - gl_FragCoord.y;
  if (uMirror >= 0.0 && row < uMirror) discard;
  float px = floor(gl_FragCoord.x);
  float py = uMirror >= 0.0 ? floor(2.0 * uMirror - row) : floor(row);
  if (px < uRect.x || px >= uRect.z || py < uRect.y || py >= uRect.w) discard;
  float inv = uMap.z;
  vec2 a0 = (vec2(px, py) - uMap.xy) * inv + vec2(uMap.w, uPhaseY);
  // (a render target's rows are stored bottom up)
  float h = float(uSize.y);
  vec4 c = reduceRGBA(uTex, uSize, false, vec2(a0.x, h - a0.y - inv), vec2(a0.x + inv, h - a0.y));
  if (c.r < 0.0) discard;
  o = c;
}`;

/**
 * Her, her effects and the talisman at zoom < 1: drawn at play density into this layer (1 layer px = 1 world px, the
 * grid worker 6's charScale lands on), then reduced onto the frame (composite). The reduction grid is anchored to her
 * feet (`anchor`), so her drawing keeps its pixels while she or the camera moves: she moves by whole frame px.
 */
export class ActorLayer {
  private target: Target | null = null;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation>;
  /** The layer's world origin (whole world px) and size. */
  x0 = 0;
  y0 = 0;
  w = 0;
  h = 0;
  private saved: [number, number] = [0, 0];

  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.vao = vao;
    this.prog = compile(gl, FULL_VS, COMPOSITE_FS, "tesu-actor-reduce");
    this.u = uniforms(gl, this.prog);
  }

  /** Whether the actors go through the layer at this camera: wider than play zoom. */
  static wants(zoom: number): boolean {
    return zoom < 1 - 1e-4;
  }

  /**
   * Binds the layer for drawing (cleared clear) and returns the camera that draws the play plane into it at play
   * density: its play-plane transform has scale 1 and offsets -x0, -y0. The layer covers twice the frame a side
   * (capped by the GPU), centred on the view when the view fits in it (zoom >= 1/2), else on her.
   */
  begin(r: WorldRenderer, cam: CamState, view: { cx: number; cy: number }, her: [number, number]): CamState {
    const gl = this.gl;
    const max = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    const w = Math.min(max, 2 * cam.W), h = Math.min(max, 2 * cam.H);
    if (!this.target || this.target.color.w !== w || this.target.color.h !== h) {
      if (this.target) { gl.deleteFramebuffer(this.target.fbo); gl.deleteTexture(this.target.color.tex); }
      this.target = makeTarget(gl, w, h, false);
    }
    this.w = w;
    this.h = h;
    const fits = cam.W / cam.zoom <= w && cam.H / cam.zoom <= h;
    const [cx, cy] = fits ? [view.cx, view.cy] : her;
    this.x0 = Math.floor(cx - w / 2);
    this.y0 = Math.floor(cy - h / 2);
    this.saved = [r.iw, r.ih];
    r.bindTarget(this.target, true, [0, 0, 0, 0]);
    r.iw = w;
    r.ih = h;
    const anchor = 0.5;
    return { cx: w / 2 + this.x0, cy: anchor * h + this.y0, zoom: 1, anchor, horizon: anchor, W: w, H: h };
  }

  /** Ends drawing into the layer; the renderer is back on its frame size (the caller rebinds its target). */
  end(r: WorldRenderer): void {
    r.flush();
    r.iw = this.saved[0];
    r.ih = this.saved[1];
  }

  /**
   * Reduces the layer onto the bound frame target (premultiplied over). `xf`: the play plane's transform on the
   * frame (scale s, whole-px offsets); `anchor`: the world point the reduction grid is anchored to (her feet), so her
   * drawing keeps its pixels as she moves; `mirror`: a frame row to mirror about (the reflection target).
   */
  composite(frameW: number, frameH: number, xf: { s: number; offX: number; offY: number }, anchor: [number, number], mirror: number | null = null): void {
    if (!this.target) return;
    const gl = this.gl, u = this.u, s = xf.s, inv = 1 / s;
    // frame px n covers world [(n - off) / s, (n + 1 - off) / s); shifted by a phase in [0, 1/s) so that her anchor
    // falls on a footprint boundary: n* = ceil(ax * s + off), phase = ax - (n* - off) / s
    const ax = Math.round(anchor[0]), ay = Math.round(anchor[1]);
    const nx = Math.ceil(ax * s + xf.offX - 1e-6), ny = Math.ceil(ay * s + xf.offY - 1e-6);
    const phX = ax - (nx - xf.offX) * inv, phY = ay - (ny - xf.offY) * inv;
    // the frame rect the layer covers
    const fx0 = Math.floor((this.x0 - phX) * s + xf.offX), fy0 = Math.floor((this.y0 - phY) * s + xf.offY);
    const fx1 = Math.ceil((this.x0 + this.w - phX) * s + xf.offX), fy1 = Math.ceil((this.y0 + this.h - phY) * s + xf.offY);
    gl.useProgram(this.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.target.color.tex);
    gl.uniform1i(u.uTex!, 0);
    gl.uniform2i(u.uSize!, this.w, this.h);
    gl.uniform2f(u.uRes!, frameW, frameH);
    // layer px = (frame px - off) / s - x0 + phase  ->  (px - off) * inv + (phase - x0)
    gl.uniform4f(u.uMap!, xf.offX, xf.offY, inv, phX - this.x0);
    gl.uniform1f(u.uPhaseY!, phY - this.y0);
    gl.uniform1f(u.uMirror!, mirror ?? -1);
    gl.uniform4f(u.uRect!, fx0, fy0, fx1, fy1);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
