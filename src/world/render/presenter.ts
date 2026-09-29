// Shows the world target on the canvas.
//
// Scale rule: presentRect() in src/scenes/engine/scale.ts (shared with the
// scene engine): the largest whole-number nearest upscale when it fills the
// window well enough, otherwise sharp-bilinear at the exact fitting scale:
// exactly a nearest upscale to the next whole multiple N followed by a linear
// resize (four texel fetches). Inside a world pixel the colour is flat; only
// the seams between world pixels get a blended device pixel, so pixels stay
// crisp at 1.5x (1080p) without the uneven 1-2-1-2 columns of plain nearest.
// Never plain bilinear. The zoom punch and the close-up zoom go through the
// same rule at the zoomed scale.
//
// Also here: black cinematic bars, impact frames (invert / mono), the death
// and door fades (dithered per world pixel), and the close-up overlay.

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { FULL_VS } from "../../lab/engine/shaders.ts";
import { presentRect } from "../../scenes/engine/scale.ts";
import { SCALE } from "../config.ts";
import type { Target } from "./renderer.ts";

export interface PresentOpts {
  impact: 0 | 1 | 2;
  /** World zoom (1 = none). Close-up uses CLOSEUP_ZOOM; the zoom punch a whole step. */
  zoom: number;
  /** Low-res pixel the zoom keeps in place. */
  focus: [number, number];
  /** rgb + amount 0..1 (dithered per world pixel). */
  fade: [number, number, number, number];
  /** Bar height, share of the view height per bar. */
  bars: number;
  /** Draw the close-up overlay over the zoomed world. */
  overlay: boolean;
}

const PRESENT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uOver;
uniform vec2 uIRes;
uniform vec2 uCanvas;
uniform vec4 uRect;   // x, y (top-left, device px), scale S, 1 = sharp-bilinear
uniform vec4 uZoom;   // focus x, y (low-res px), zoom, overlay on
uniform int uImpact;
uniform vec4 uFade;
uniform float uBars;
out vec4 o;
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  int k = i.x + i.y * 4;
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[k] + 0.5) / 16.0;
}
vec4 fetch(sampler2D t, vec2 ip) {
  ip = clamp(ip, vec2(0.0), uIRes - 1.0);
  return texelFetch(t, ivec2(ip.x, uIRes.y - 1.0 - ip.y), 0);
}
// sample a low-res target at continuous low-res coords q (y down) at on-screen scale sc:
// nearest when sc is whole, else nearest-upscale to the next whole multiple and one linear tap
vec4 samp(sampler2D t, vec2 q, float sc, bool sharp) {
  if (!sharp) return fetch(t, floor(q));
  float pre = max(1.0, ceil(sc - 1e-3));
  vec2 P = q * pre - 0.5;
  vec2 i0 = floor(P);
  vec2 k = P - i0;
  vec2 a = floor(i0 / pre);
  vec2 b = floor((i0 + 1.0) / pre);
  vec4 c00 = fetch(t, a), c10 = fetch(t, vec2(b.x, a.y)), c01 = fetch(t, vec2(a.x, b.y)), c11 = fetch(t, b);
  return mix(mix(c00, c10, k.x), mix(c01, c11, k.x), k.y);
}
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 rel = fc - uRect.xy;
  float S = uRect.z;
  vec2 q0 = rel / S;
  if (q0.x < 0.0 || q0.y < 0.0 || q0.x >= uIRes.x || q0.y >= uIRes.y) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float bar = uBars * uIRes.y;
  if (q0.y < bar || q0.y >= uIRes.y - bar) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float Z = uZoom.z;
  vec2 q = uZoom.xy + (q0 - uZoom.xy) / Z;
  float sc = S * Z;
  // whole-number effective scale: plain nearest; otherwise sharp-bilinear
  bool sharp = abs(sc - floor(sc + 0.5)) > 1e-3;
  vec3 c = samp(uScene, q, sc, sharp).rgb;
  vec2 art = floor(q);
  if (uZoom.w > 0.5) {
    bool sharpO = abs(S - floor(S + 0.5)) > 1e-3;
    vec4 ov = samp(uOver, q0, S, sharpO);
    c = c * (1.0 - ov.a) + ov.rgb;
    art = floor(q0);
  }
  if (uImpact == 1) c = vec3(1.0) - c;
  else if (uImpact == 2) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = l > 0.52 ? vec3(0.97, 0.95, 0.93) : vec3(0.05, 0.04, 0.07);
  }
  if (uFade.a > 0.0 && (uFade.a >= 0.999 || bayer4(art) < uFade.a)) c = uFade.rgb;
  o = vec4(c, 1.0);
}`;

export class Presenter {
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation>;
  /** Output rect in device px (top-left origin), scale, and whether sharp-bilinear is on. */
  rect = { x: 0, y: 0, scale: 1, sharp: false, w: 0, h: 0 };

  constructor(private gl: WebGL2RenderingContext, private vao: WebGLVertexArrayObject) {
    this.prog = compile(gl, FULL_VS, PRESENT_FS, "present");
    this.u = uniforms(gl, this.prog);
  }

  /** Works out the output scale for a canvas size (device px). */
  layout(cw: number, ch: number): void {
    const r = presentRect(cw, ch, SCALE.viewW, SCALE.viewH, "auto");
    // presentRect is bottom-left based; the shader works top-left
    this.rect = { x: r.x, y: ch - (r.y + r.h), scale: r.scale, sharp: r.sharp, w: r.w, h: r.h };
  }

  draw(scene: Target, over: Target | null, cw: number, ch: number, o: PresentOpts): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.color.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, (over ?? scene).color.tex);
    const u = this.u;
    gl.uniform1i(u.uScene!, 0);
    gl.uniform1i(u.uOver!, 1);
    gl.uniform2f(u.uIRes!, SCALE.viewW, SCALE.viewH);
    gl.uniform2f(u.uCanvas!, cw, ch);
    const r = this.rect;
    gl.uniform4f(u.uRect!, r.x, r.y, r.scale, r.sharp ? 1 : 0);
    gl.uniform4f(u.uZoom!, o.focus[0], o.focus[1], Math.max(1, o.zoom), over ? 1 : 0);
    gl.uniform1i(u.uImpact!, o.impact);
    gl.uniform4fv(u.uFade!, o.fade);
    gl.uniform1f(u.uBars!, o.bars);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
  }
}
