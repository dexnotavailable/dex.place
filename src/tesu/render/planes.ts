// Draws plate tiles: one instanced draw per plane. Tiles live in one R8 texture array
// (palette indices, 64 KB a tile), so the whole visible land costs a few draws and a
// small fraction of the memory RGBA plates would. The palette and the plane's haze are
// applied in the shader; sampling is always exact nearest (texelFetch).

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { TILE } from "../config.ts";
import { paletteRGBA } from "../art/palette.ts";

const VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec4 aRect;   // x0, y0, x1, y1 in frame px (y down)
layout(location = 1) in float aLayer;
uniform vec2 uRes;
uniform float uMirror;                // frame row to mirror about, or -1
out vec2 vUV;
flat out float vLayer;
const vec2 C[6] = vec2[6](vec2(0,0), vec2(1,0), vec2(1,1), vec2(0,0), vec2(1,1), vec2(0,1));
void main() {
  vec2 c = C[gl_VertexID];
  vec2 p = mix(aRect.xy, aRect.zw, c);
  if (uMirror >= 0.0) p.y = 2.0 * uMirror - p.y;
  vUV = c * float(${TILE});
  vLayer = aLayer;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DArray;
in vec2 vUV;
flat in float vLayer;
uniform sampler2DArray uTiles;
uniform sampler2D uPal;
uniform vec3 uHaze;
uniform float uFade;
uniform vec3 uInk;
uniform float uInkAmt;
uniform float uMirror;
uniform vec2 uRes;
uniform vec4 uGrade;                  // rgb multiply, amount
out vec4 o;
void main() {
  if (uMirror >= 0.0) {
    // only what stands above the waterline shows below it
    float row = uRes.y - gl_FragCoord.y;
    if (row < uMirror) discard;
  }
  ivec2 t = clamp(ivec2(floor(vUV)), ivec2(0), ivec2(${TILE - 1}));
  float idx = texelFetch(uTiles, ivec3(t, int(vLayer + 0.5)), 0).r * 255.0;
  if (idx < 0.5) discard;
  vec3 c = texelFetch(uPal, ivec2(int(idx + 0.5), 0), 0).rgb;
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
}

export interface PlaneLook {
  haze: [number, number, number];
  fade: number;
  ink: [number, number, number];
  inkAmt: number;
  /** Colour grade (time of day, a storm): multiply rgb by amount. */
  grade: [number, number, number, number];
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
  private rects: Float32Array;
  private lays: Float32Array;
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
    this.lays = new Float32Array(max);
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
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 4, 0);
    gl.vertexAttribDivisor(1, 1);
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
    const n = Math.min(quads.length, this.lays.length);
    for (let i = 0; i < n; i++) {
      const q = quads[i]!;
      this.rects[i * 4] = q.x0;
      this.rects[i * 4 + 1] = q.y0;
      this.rects[i * 4 + 2] = q.x1;
      this.rects[i * 4 + 3] = q.y1;
      this.lays[i] = q.layer;
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
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lays, 0, n);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.drawCalls++;
  }
}
