// Things that move on a background plane (a Walker wading the far shore, kites, a boat):
// animated frames drawn with their plane's transform, haze and mirror, so they parallax,
// fade and reflect exactly like the plate they stand on. Frames are painted on demand at
// the level the camera needs (or loaded from a render later) and kept as RGBA textures.

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { ctxFor, painter } from "../art/painter.ts";
import { paletteRGBA } from "../art/palette.ts";
import { IdxBuf } from "../art/raster.ts";
import { PLANES, type SpriteDef } from "../world/types.ts";
import type { PlaneLook } from "./planes.ts";
import { levelFor, planeLevels, planeXf, type CamState } from "./view.ts";

const VS = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uRect;     // x0, y0, x1, y1 frame px
uniform vec2 uRes;
uniform float uMirror;
uniform vec2 uSize;     // texture size
uniform float uFlip;
out vec2 vUV;
const vec2 C[6] = vec2[6](vec2(0,0), vec2(1,0), vec2(1,1), vec2(0,0), vec2(1,1), vec2(0,1));
void main() {
  vec2 c = C[gl_VertexID];
  vec2 p = mix(uRect.xy, uRect.zw, c);
  if (uMirror >= 0.0) p.y = 2.0 * uMirror - p.y;
  vUV = vec2(uFlip > 0.5 ? 1.0 - c.x : c.x, c.y) * uSize;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform vec3 uHaze;
uniform float uFade;
uniform vec3 uInk;
uniform float uInkAmt;
uniform float uMirror;
uniform vec2 uRes;
out vec4 o;
void main() {
  if (uMirror >= 0.0 && uRes.y - gl_FragCoord.y < uMirror) discard;
  ivec2 t = clamp(ivec2(floor(vUV)), ivec2(0), ivec2(uSize) - 1);
  vec4 c = texelFetch(uTex, t, 0);
  if (c.a < 0.5) discard;
  vec3 col = mix(c.rgb, uHaze, uFade);
  col = mix(col, uInk, uInkAmt);
  o = vec4(col, 1.0);
}`;

interface Frame {
  tex: WebGLTexture;
  w: number;
  h: number;
  /** Anchor offset in this frame's px (where the def's 3D point is). */
  ax: number;
  ay: number;
}

export class SpriteRenderer {
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation>;
  private frames = new Map<string, Frame | null>();
  private pal = paletteRGBA();
  private paintedThisFrame = 0;

  constructor(private gl: WebGL2RenderingContext, private vao: WebGLVertexArrayObject) {
    this.prog = compile(gl, VS, FS, "tesu-sprites");
    this.u = uniforms(gl, this.prog);
  }

  newFrame(): void {
    this.paintedThisFrame = 0;
  }

  /** A painted frame of a sprite at a level (painted now if the budget allows, else null). */
  private frame(def: SpriteDef, f: number, level: number, force: boolean): Frame | null {
    const key = `${def.id}|${f}|${level}`;
    const have = this.frames.get(key);
    if (have !== undefined) return have;
    if (!force && this.paintedThisFrame >= 1) return null;
    this.paintedThisFrame++;
    const pt = painter(def.kind);
    const [x0, y0, x1, y1] = pt.bounds({ ...def.p, frame: f });
    const ox = Math.floor(x0 * level), oy = Math.floor(y0 * level);
    const w = Math.max(1, Math.ceil(x1 * level) - ox), h = Math.max(1, Math.ceil(y1 * level) - oy);
    const buf = new IdxBuf(w, h, ox, oy, level);
    pt.paint(ctxFor(buf, level, 0, 0, def.seed), { ...def.p, frame: f });
    const rgba = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const c = buf.px[i]!;
      if (!c) continue;
      rgba[i * 4] = this.pal[c * 4]!;
      rgba[i * 4 + 1] = this.pal[c * 4 + 1]!;
      rgba[i * 4 + 2] = this.pal[c * 4 + 2]!;
      rgba[i * 4 + 3] = 255;
    }
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    const fr: Frame = { tex, w, h, ax: -ox, ay: -oy };
    this.frames.set(key, fr);
    return fr;
  }

  /** Where a sprite stands now (its 3D x drifts along its path). */
  static position(def: SpriteDef, time: number): { x: number; y: number; frame: number; flip: boolean } {
    let x = def.x;
    let flip = false;
    if (def.path) {
      const [a, b] = def.path;
      const span = b - a;
      const d = (time * Math.abs(def.speed ?? 0)) % (span * 2);
      // walks one way along the shore, then back
      if (d < span) x = a + d;
      else {
        x = b - (d - span);
        flip = true;
      }
      if ((def.speed ?? 0) < 0) flip = !flip;
    }
    const frame = Math.floor(time * (def.fps ?? 0)) % Math.max(1, def.frames ?? 1);
    return { x, y: def.y, frame, flip };
  }

  /** Draws the sprites of one plane (mirrored about `mirror` for the reflection target). */
  draw(defs: readonly SpriteDef[], cam: CamState, look: PlaneLook, time: number, mirror: number | null, force = false): void {
    if (!defs.length) return;
    const gl = this.gl, u = this.u;
    gl.useProgram(this.prog);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.uRes!, cam.W, cam.H);
    gl.uniform1f(u.uMirror!, mirror ?? -1);
    gl.uniform3fv(u.uHaze!, look.haze);
    gl.uniform1f(u.uFade!, look.fade);
    gl.uniform3fv(u.uInk!, look.ink);
    gl.uniform1f(u.uInkAmt!, look.inkAmt);
    gl.bindVertexArray(this.vao);
    for (const def of defs) {
      const rate = PLANES[def.plane].rate;
      const xf = planeXf(cam, rate);
      const level = levelFor(planeLevels(rate), xf.g);
      const pos = SpriteRenderer.position(def, time);
      const fr = this.frame(def, pos.frame, level, force) ?? this.frame(def, 0, level, true);
      if (!fr) continue;
      const k = xf.g / level;
      const ax = pos.x * rate * xf.g + xf.offX, ay = pos.y * rate * xf.g + xf.offY;
      const x0 = ax - (pos.flip ? fr.w - fr.ax : fr.ax) * k, y0 = ay - fr.ay * k;
      const x1 = x0 + fr.w * k, y1 = y0 + fr.h * k;
      if (x1 < 0 || x0 > cam.W || (mirror === null && (y1 < 0 || y0 > cam.H))) continue;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fr.tex);
      gl.uniform1i(u.uTex!, 0);
      gl.uniform2f(u.uSize!, fr.w, fr.h);
      gl.uniform1f(u.uFlip!, pos.flip ? 1 : 0);
      gl.uniform4f(u.uRect!, Math.round(x0), Math.round(y0), Math.round(x0) + Math.round(fr.w * k), Math.round(y0) + Math.round(fr.h * k));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}
