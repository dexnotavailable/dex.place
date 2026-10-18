// The actors at screen resolution (worker 6's D2, 10-18). The world renders at world res (1 frame px = 1 world px at
// play zoom; the presenter shows it at a whole scale k, 2 screen px on a 1440p screen). Her 128 px art is drawn ~10%
// taller than H (charScale), so on the world grid nearest neighbour drops about one art row in six; the look Dex
// approved shows every art px at ~1.65 screen px. So at play zoom and in the close band the frame pass splits at the
// actors:
//
//   back   sky .. the play plane and the water behind her   -> the world target (world res, as always)
//   actors her drawing and the NPCs (worker 6)              -> this layer at screen res (frame x k)
//          her effects and the talisman                      -> world res (a scratch target), nearest x k into the layer,
//                                                               so nothing but the drawings changes pixel size
//   front  the near water, the front and near planes, motes,
//          the prompt, the hint, the titles                  -> the front target (world res, premultiplied)
//
// and the presenter composites back, actors, front, then its own effects (punch zoom, impact, fade, bars) over all
// three (src/world/render/presenter.ts, `layers`). Drawings are drawn through the renderer's transform at k times
// the frame's, their quads snapped to whole screen px, so the uneven nearest pattern is fixed per drawing (no
// shimmer as she moves). k = 1 (a 1080p screen): no layer, the actors are drawn straight onto the frame.

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { FULL_VS } from "../../lab/engine/shaders.ts";
import { makeTarget, type Target, type WorldRenderer } from "../../world/render/renderer.ts";
export { screenCam } from "./grid.ts";

const BLIT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform float uK;
out vec4 o;
void main() {
  vec4 c = texelFetch(uTex, ivec2(floor(gl_FragCoord.xy / uK)), 0);
  if (max(max(c.r, c.g), max(c.b, c.a)) < 0.002) discard;
  o = c;
}`;

export interface ActorLayers {
  /** Her drawings (screen res) over her effects and the talisman (world grid, x k): premultiplied. */
  actor: Target;
  /** What stands in front of her, frame res, premultiplied. */
  front: Target;
  /** Screen px per frame px. */
  k: number;
}

export class ScreenActors {
  private layer: Target | null = null;
  private scratch: Target | null = null;
  private front: Target | null = null;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation>;
  private k = 1;
  private w = 0;
  private h = 0;
  private on = false;

  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.vao = vao;
    this.prog = compile(gl, FULL_VS, BLIT_FS, "tesu-actors-blit");
    this.u = uniforms(gl, this.prog);
  }

  /** Whether the actors get their own screen-res layer at this whole presentation scale (2x to 4x). */
  static wants(k: number): boolean {
    return Number.isInteger(k) && k >= 2 && k <= 4;
  }

  private ensure(t: Target | null, w: number, h: number): Target {
    const gl = this.gl;
    if (t && t.color.w === w && t.color.h === h) return t;
    if (t) { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.color.tex); }
    return makeTarget(gl, w, h, false);
  }

  /** Starts the actors for a frame of w x h frame px shown at k: the layer is cleared clear. */
  begin(r: WorldRenderer, w: number, h: number, k: number): void {
    this.k = k;
    this.w = w;
    this.h = h;
    this.layer = this.ensure(this.layer, w * k, h * k);
    this.scratch = this.ensure(this.scratch, w, h);
    this.front = this.ensure(this.front, w, h);
    r.bindTarget(this.layer, true, [0, 0, 0, 0]);
    this.on = true;
  }

  /** A world-grid step (effects, the talisman): drawn at frame res, then nearest x k over the layer. */
  world(r: WorldRenderer, draw: () => void): void {
    if (!this.layer || !this.scratch) return;
    r.bindTarget(this.scratch, true, [0, 0, 0, 0]);
    draw();
    r.flush();
    r.bindTarget(this.layer, false);
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scratch.color.tex);
    gl.uniform1i(this.u.uTex!, 0);
    gl.uniform1f(this.u.uK!, this.k);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * A screen-res step (her drawing, the NPCs): the renderer draws into the layer with its size, through `cam` (from
   * screenCam): the play plane's transform at k times the frame's.
   */
  art(r: WorldRenderer, draw: () => void): void {
    if (!this.layer) return;
    r.bindTarget(this.layer, false);
    const saved: [number, number] = [r.iw, r.ih];
    r.iw = this.w * this.k;
    r.ih = this.h * this.k;
    try {
      draw();
      r.flush();
    } finally {
      r.iw = saved[0];
      r.ih = saved[1];
    }
  }

  /** Ends the actors: the front target is bound (cleared clear) for the rest of the frame pass. */
  end(r: WorldRenderer): void {
    if (this.front) r.bindTarget(this.front, true, [0, 0, 0, 0]);
  }

  /** The layers for the presenter if the actors had them this frame (once per frame). */
  take(): ActorLayers | null {
    if (!this.on || !this.layer || !this.front) return null;
    this.on = false;
    return { actor: this.layer, front: this.front, k: this.k };
  }
}
