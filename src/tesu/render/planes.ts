// Draws plate tiles: one instanced draw per plane. Tiles live in one R8 texture array
// (palette indices, 64 KB a tile), so the whole visible land costs a few draws and a
// small fraction of the memory RGBA plates would. The palette and the plane's haze are
// applied in the shader; sampling is exact (texelFetch): one texel per frame px at a level
// or magnified, and between levels (zoomed out) the palette-keeping reduction of the
// texels each frame px covers (render/reduce.ts), across the tile's edges into its neighbours.

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { TILE } from "../config.ts";
import { paletteRGBA } from "../art/palette.ts";
import { REDUCE_CONST_GLSL } from "./reduce.ts";

/**
 * (round 7, the integration) The plane's dissolve below show 1 (the near plane coming into the opening's
 * pull-back), shared by the plates and the sprites so every pixel of the plane agrees. Round 6 used an
 * ordered dither on 2 px frame cells: half-way it read as a 50% checker mesh over the lake (the critic's
 * m-pullback-180). Now the plane rises in from the frame's foot (to half its height) behind a ragged edge
 * of its own art cells (2 plane px, smooth noise at two sizes), anchored to the plane (uShowAt: its frame
 * offset and scale) so the edge never swims as the camera moves: the near rise grows up into the frame.
 * Needs uRes, uShow and uShowAt.
 */
export const SHOW_GLSL = /* glsl */ `
uint showHash(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v.x;
}
float showCell(vec2 c) { return float(showHash(uvec2(ivec2(c) + ivec2(1 << 20)))) / 4294967295.0; }
float showNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(showCell(i), showCell(i + vec2(1.0, 0.0)), f.x), mix(showCell(i + vec2(0.0, 1.0)), showCell(i + vec2(1.0, 1.0)), f.x), f.y);
}
bool hiddenByShow() {
  if (uShow >= 1.0) return false;
  if (uShow <= 0.0) return true;
  float yDown = uRes.y - gl_FragCoord.y;
  vec2 q = (vec2(gl_FragCoord.x, yDown) - uShowAt.xy) / max(uShowAt.z, 0.001);
  vec2 c = floor(q / 2.0);
  float n = 0.6 * showNoise(c / 7.0) + 0.4 * showNoise(c / 2.4 + 31.0);
  float v = clamp((uRes.y - yDown) / (0.5 * uRes.y), 0.0, 1.0);
  float t = 0.84 * v + 0.16 * n;
  return t >= uShow;
}
`;

const VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec4 aRect;   // x0, y0, x1, y1 in frame px (y down)
layout(location = 1) in vec4 aLayers; // this tile's layer, then its right, lower and lower-right neighbours' (-1 not painted, -2 empty)
layout(location = 2) in vec4 aArt;    // the tile's origin in its level's art px (x, y), k = frame px per art px, 0
layout(location = 3) in vec2 aOff;    // the plane's whole-px frame offset
uniform vec2 uRes;
uniform float uMirror;                // frame row to mirror about, or -1
flat out vec4 vL;
flat out vec4 vA;
flat out vec2 vOff;
const vec2 C[6] = vec2[6](vec2(0,0), vec2(1,0), vec2(1,1), vec2(0,0), vec2(1,1), vec2(0,1));
void main() {
  vec2 c = C[gl_VertexID];
  vec4 r = aRect;
  // reduced (k < 1): a frame px belongs to the tile its footprint starts in, which can lie up to a px past the quad
  if (aArt.z < 0.999) r += vec4(-1.0, -1.0, 1.0, 1.0);
  vec2 p = mix(r.xy, r.zw, c);
  if (uMirror >= 0.0) p.y = 2.0 * uMirror - p.y;
  vL = aLayers;
  vA = aArt;
  vOff = aOff;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DArray;
flat in vec4 vL;
flat in vec4 vA;
flat in vec2 vOff;
uniform sampler2DArray uTiles;
uniform sampler2D uPal;
uniform vec3 uHaze;
uniform float uFade;
uniform vec3 uInk;
uniform float uInkAmt;
uniform float uMirror;
uniform vec2 uRes;
uniform vec4 uGrade;                  // rgb multiply, amount
uniform float uShow;                  // (round 6) share of the plane shown: a dissolve below 1 (round 7: in clumps)
uniform vec3 uShowAt;                 // (round 7) the plane's frame offset and scale (the clumps sit on its art)
out vec4 o;
${SHOW_GLSL}
${REDUCE_CONST_GLSL}
const int T = ${TILE};
// palette index at texel t of this tile; t may run past its right / lower edge into the neighbours. -1: not painted.
int tileIdx(ivec2 t) {
  float L = vL.x;
  if (t.x >= T && t.y >= T) { L = vL.w; t -= ivec2(T); }
  else if (t.x >= T) { L = vL.y; t.x -= T; }
  else if (t.y >= T) { L = vL.z; t.y -= T; }
  if (L < -1.5) return 0;
  if (L < -0.5) return -1;
  return int(texelFetch(uTiles, ivec3(t, int(L + 0.5)), 0).r * 255.0 + 0.5);
}
vec3 palC(int i) { return texelFetch(uPal, ivec2(i, 0), 0).rgb; }
// (engine 10-18) the plate reduced onto the frame's grid (render/reduce.ts): the footprint [a0, a0 + 1/k) of this
// frame px, opaque by coverage, the colour covering most of it, a feature colour counting double. 0 = clear.
int reduceIdx(vec2 a0, float inv) {
  int ids[16];
  float ws[16];
  int n = 0;
  float total = 0.0, opaque = 0.0;
  vec2 a1 = a0 + inv;
  bool exact = inv <= 3.0;
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
        tc = floor(a0 + (vec2(float(i), float(j)) + 0.5) * inv * 0.25);
        w = 1.0;
      }
      int id = tileIdx(ivec2(tc));
      if (id < 0) continue;
      total += w;
      if (id == 0) continue;
      opaque += w;
      int m = -1;
      for (int q = 0; q < 16; q++) {
        if (q >= n) break;
        if (ids[q] == id) { m = q; break; }
      }
      if (m >= 0) ws[m] += w;
      else { ids[n] = id; ws[n] = w; n++; }
    }
  }
  if (n == 0 || opaque < total * RED_OPAQUE) return 0;
  int best = 0;
  for (int q = 1; q < 16; q++) {
    if (q >= n) break;
    if (ws[q] > ws[best]) best = q;
  }
  float lm = redLum(palC(ids[best]));
  int pick = best;
  float ps = ws[best];
  for (int q = 0; q < 16; q++) {
    if (q >= n) break;
    float s = ws[q] * (abs(redLum(palC(ids[q])) - lm) > RED_FEAT ? 2.0 : 1.0);
    if (s > ps) { ps = s; pick = q; }
  }
  return ids[pick];
}
void main() {
  if (hiddenByShow()) discard;
  float row = uRes.y - gl_FragCoord.y;
  // only what stands above the waterline shows below it
  if (uMirror >= 0.0 && row < uMirror) discard;
  // the row of the plane this frame px shows (y down; mirrored about the waterline in the reflection)
  float cy = uMirror >= 0.0 ? 2.0 * uMirror - row : row;
  float px = floor(gl_FragCoord.x);
  float k = vA.z;
  int idx;
  if (k >= 0.999) {
    // at a level or magnified: the texel under the px's centre, as always
    vec2 uv = (vec2(px + 0.5, cy) - vOff) / k - vA.xy;
    ivec2 t = clamp(ivec2(floor(uv)), ivec2(0), ivec2(T - 1));
    idx = int(texelFetch(uTiles, ivec3(t, int(vL.x + 0.5)), 0).r * 255.0 + 0.5);
  } else {
    // reduced: the footprint anchored to the plane's art grid (whole-px offsets: a pan never changes the picture)
    vec2 a0 = (vec2(px, floor(cy)) - vOff) / k - vA.xy;
    if (a0.x < 0.0 || a0.y < 0.0 || a0.x >= float(T) || a0.y >= float(T)) discard;
    idx = reduceIdx(a0, 1.0 / k);
  }
  if (idx == 0) discard;
  vec3 c = palC(idx);
  c = mix(c, c * uGrade.rgb, uGrade.a);
  c = mix(c, uHaze, uFade);
  c = mix(c, uInk, uInkAmt);
  o = vec4(c, 1.0);
}`;

export interface TileQuad {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  layer: number;
  /**
   * (engine 10-18, the reduction) The tile's origin in its level's art px, k (frame px per art px), the plane's
   * whole-px offset, and the layers of its right, lower and lower-right neighbours (-1 not painted, -2 empty), which
   * a reduced footprint can reach into. Defaults: derived from the rect, no neighbours.
   */
  ax?: number;
  ay?: number;
  k?: number;
  off?: [number, number];
  right?: number;
  down?: number;
  diag?: number;
}

export interface PlaneLook {
  haze: [number, number, number];
  fade: number;
  ink: [number, number, number];
  inkAmt: number;
  /** Colour grade (time of day, a storm): multiply rgb by amount. */
  grade: [number, number, number, number];
  /**
   * (round 6) The share of the plane shown, 0..1 (default 1): below 1 it dissolves in (the near plane
   * coming into the opening's pull-back; round 7: by clumps of its art cells, SHOW_GLSL).
   */
  show?: number;
  /** (round 7) With show: the plane's frame offset x, y and scale g (render/view.ts planeXf), the clumps' anchor. */
  showAt?: [number, number, number];
}

export class PlaneRenderer {
  readonly gl: WebGL2RenderingContext;
  readonly tiles: WebGLTexture;
  readonly layers: number;
  private pal: WebGLTexture;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation>;
  private vao: WebGLVertexArrayObject;
  private rectBuf: WebGLBuffer;
  private layerBuf: WebGLBuffer;
  private artBuf: WebGLBuffer;
  private offBuf: WebGLBuffer;
  private rects: Float32Array;
  private lays: Float32Array;
  private arts: Float32Array;
  private offs: Float32Array;
  drawCalls = 0;

  constructor(gl: WebGL2RenderingContext, layers: number) {
    this.gl = gl;
    this.layers = layers;
    this.prog = compile(gl, VS, FS, "planes");
    this.u = uniforms(gl, this.prog);
    this.tiles = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tiles);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R8, TILE, TILE, layers);
    this.pal = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.pal);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, paletteRGBA());
    const max = 4096;
    this.rects = new Float32Array(max * 4);
    this.lays = new Float32Array(max * 4);
    this.arts = new Float32Array(max * 4);
    this.offs = new Float32Array(max * 2);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.rectBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.rects.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(0, 1);
    this.layerBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.layerBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.lays.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(1, 1);
    this.artBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.artBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.arts.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(2, 1);
    this.offBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.offBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.offs.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 8, 0);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
  }

  /** Writes one painted tile (TILE x TILE palette indices) into a layer. */
  upload(layer: number, px: Uint8Array): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tiles);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, TILE, TILE, 1, gl.RED, gl.UNSIGNED_BYTE, px);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }

  /** Draws tile quads into the bound target (size w x h), optionally mirrored about a frame row. */
  draw(quads: readonly TileQuad[], look: PlaneLook, w: number, h: number, mirror: number | null = null): void {
    if (!quads.length) return;
    const gl = this.gl;
    const n = Math.min(quads.length, this.offs.length / 2);
    for (let i = 0; i < n; i++) {
      const q = quads[i]!;
      this.rects[i * 4] = q.x0;
      this.rects[i * 4 + 1] = q.y0;
      this.rects[i * 4 + 2] = q.x1;
      this.rects[i * 4 + 3] = q.y1;
      this.lays[i * 4] = q.layer;
      this.lays[i * 4 + 1] = q.right ?? -1;
      this.lays[i * 4 + 2] = q.down ?? -1;
      this.lays[i * 4 + 3] = q.diag ?? -1;
      const k = q.k ?? (q.x1 - q.x0) / TILE;
      const off = q.off ?? [0, 0];
      this.arts[i * 4] = q.ax ?? (q.x0 - off[0]) / k;
      this.arts[i * 4 + 1] = q.ay ?? (q.y0 - off[1]) / k;
      this.arts[i * 4 + 2] = k;
      this.arts[i * 4 + 3] = 0;
      this.offs[i * 2] = off[0];
      this.offs[i * 2 + 1] = off[1];
    }
    gl.useProgram(this.prog);
    gl.disable(gl.BLEND);
    const u = this.u;
    gl.uniform2f(u.uRes!, w, h);
    gl.uniform1f(u.uMirror!, mirror ?? -1);
    gl.uniform3fv(u.uHaze!, look.haze);
    gl.uniform1f(u.uFade!, look.fade);
    gl.uniform3fv(u.uInk!, look.ink);
    gl.uniform1f(u.uInkAmt!, look.inkAmt);
    gl.uniform4fv(u.uGrade!, look.grade);
    gl.uniform1f(u.uShow!, look.show ?? 1);
    if (u.uShowAt) gl.uniform3fv(u.uShowAt, look.showAt ?? [0, 0, 1]);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tiles);
    gl.uniform1i(u.uTiles!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.pal);
    gl.uniform1i(u.uPal!, 1);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.rects, 0, n * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.layerBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lays, 0, n * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.artBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.arts, 0, n * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.offBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.offs, 0, n * 2);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.drawCalls++;
  }
}
