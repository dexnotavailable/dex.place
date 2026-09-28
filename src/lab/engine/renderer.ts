// Low-res WebGL2 renderer. The scene is drawn into a 640x360 ("near") or
// 960x540 ("far") framebuffer, then shown at the largest integer scale that
// fits, letterboxed in black. Positions are whole pixels by the time they
// reach the GPU, so there is no sub-pixel drawing anywhere.

import { compile, emptyTarget, nearestTexture, quadIndices, uniforms, type Texture } from "./gl.ts";
import { BACKDROP_FS, BLIT_FS, DIM_FS, FULL_VS, MAX_LIGHTS, SPRITE_FS, SPRITE_VS, VFX_FS, VFX_VS } from "./shaders.ts";

export type ResMode = "near" | "far";
export const RESOLUTIONS: Record<ResMode, [number, number]> = { near: [640, 360], far: [960, 540] };

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

export interface SpriteSheet {
  albedo: Texture;
  normal: Texture;
  /** 1 = flat albedo lit fully by the key light, ~0.25 = baked shading nudged by it. */
  keyInfluence: number;
}

export interface PointLight {
  x: number;
  y: number;
  height: number;
  radius: number;
  colour: RGB;
  intensity: number;
}

export interface Lighting {
  ambient: RGB;
  keyDir: [number, number, number];
  keyColour: RGB;
  rimColour: RGB;
  rimDir: [number, number];
  rimIntensity: number;
  /** Rim texels become at least this multiple of their lit colour (and never darker than the rim colour). */
  rimBoost: number;
  rimPointGain: number;
  rimThreshold: number;
  bands: number;
  /**
   * Effect (point) light multiplies albedo, then eases into at most this share
   * (0..1) of the room each channel has left below 1.0: bright albedo keeps
   * its values, dark albedo stays dark.
   */
  lightRoom: number;
  /** Strength of the light-colour band on texels facing a strong light (0..1.5). */
  lightTint: number;
  /** Cap on the summed light multiplier per channel (ambient + key + effects). */
  lightCap: number;
}

export interface SpriteDraw {
  sheet: SpriteSheet;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** World position of the drawn rect's top-left. */
  x: number;
  y: number;
  flip?: boolean;
  tint?: RGBA;
  lit?: number;
  opacity?: number;
  /** Draw in screen space (UI) instead of world space. */
  screen?: boolean;
}

export const VFX_TYPE = { rect: 0, arc: 1, ring: 2, pillar: 3, burst: 4, streak: 5, disc: 6, diamond: 7 } as const;

export interface VfxQuad {
  type: number;
  t: number;
  seed: number;
  /** 1 paints over, 0 adds light. */
  over: number;
  p0: [number, number, number, number];
  p1: [number, number, number, number];
  core: RGB;
  main: RGB;
  edge: RGB;
  /** World centre. */
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  /** Local bounds x0, y0, x1, y1 in shape units. */
  ext: [number, number, number, number];
  screen?: boolean;
}

export interface PostFx {
  impact: 0 | 1 | 2;
  zoomSteps: number;
  /** Low-res screen pixel the zoom punch keeps in place. */
  focus: [number, number];
  fade: RGBA;
}

const SPRITE_FLOATS = 12;
const VFX_FLOATS = 28;
const MAX_QUADS = 4096;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  mode: ResMode = "near";
  iw = 640;
  ih = 360;
  camX = 0;
  camY = 0;
  /** Output rect in device pixels: x, y, scale. */
  out = { x: 0, y: 0, scale: 1 };
  lightCount = 0;
  drawCalls = 0;

  private target: { fbo: WebGLFramebuffer; color: Texture };
  private spriteProg: WebGLProgram;
  private spriteU: Record<string, WebGLUniformLocation>;
  private vfxProg: WebGLProgram;
  private vfxU: Record<string, WebGLUniformLocation>;
  private backProg: WebGLProgram;
  private backU: Record<string, WebGLUniformLocation>;
  private blitProg: WebGLProgram;
  private blitU: Record<string, WebGLUniformLocation>;
  private dimProg: WebGLProgram;
  private dimU: Record<string, WebGLUniformLocation>;
  private spriteVao: WebGLVertexArrayObject;
  private spriteBuf: WebGLBuffer;
  private vfxVao: WebGLVertexArrayObject;
  private vfxBuf: WebGLBuffer;
  private emptyVao: WebGLVertexArrayObject;
  private spriteData = new Float32Array(MAX_QUADS * 4 * SPRITE_FLOATS);
  private vfxData = new Float32Array(MAX_QUADS * 4 * VFX_FLOATS);
  private spriteCount = 0;
  private vfxCount = 0;
  private pending: "sprite" | "vfx" | null = null;
  private sheet: SpriteSheet | null = null;
  private lights0 = new Float32Array(MAX_LIGHTS * 4);
  private lights1 = new Float32Array(MAX_LIGHTS * 4);
  readonly flatNormal: Texture;
  readonly white: Texture;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    this.spriteProg = compile(gl, SPRITE_VS, SPRITE_FS, "sprite");
    this.spriteU = uniforms(gl, this.spriteProg);
    this.vfxProg = compile(gl, VFX_VS, VFX_FS, "vfx");
    this.vfxU = uniforms(gl, this.vfxProg);
    this.backProg = compile(gl, FULL_VS, BACKDROP_FS, "backdrop");
    this.backU = uniforms(gl, this.backProg);
    this.blitProg = compile(gl, FULL_VS, BLIT_FS, "blit");
    this.blitU = uniforms(gl, this.blitProg);
    this.dimProg = compile(gl, FULL_VS, DIM_FS, "dim");
    this.dimU = uniforms(gl, this.dimProg);

    const idx = quadIndices(gl, MAX_QUADS);
    this.spriteVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.spriteVao);
    this.spriteBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.spriteData.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    const sStride = SPRITE_FLOATS * 4;
    const sAttr: [number, number, number][] = [[0, 2, 0], [1, 2, 2], [2, 4, 4], [3, 4, 8]];
    for (const [loc, size, off] of sAttr) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, sStride, off * 4);
    }
    this.vfxVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vfxVao);
    this.vfxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vfxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.vfxData.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
    const vStride = VFX_FLOATS * 4;
    const vAttr: [number, number, number][] = [[0, 2, 0], [1, 2, 2], [2, 4, 4], [3, 4, 8], [4, 4, 12], [5, 4, 16], [6, 4, 20], [7, 4, 24]];
    for (const [loc, size, off] of vAttr) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, vStride, off * 4);
    }
    this.emptyVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);

    this.flatNormal = nearestTexture(gl, { w: 1, h: 1, data: new Uint8Array([128, 128, 255, 255]) });
    this.white = nearestTexture(gl, { w: 1, h: 1, data: new Uint8Array([255, 255, 255, 255]) });
    this.target = emptyTarget(gl, this.iw, this.ih);
  }

  texture(src: TexImageSource | { w: number; h: number; data: Uint8Array | Uint8ClampedArray }): Texture {
    return nearestTexture(this.gl, src);
  }

  setMode(mode: ResMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    const [w, h] = RESOLUTIONS[mode];
    this.iw = w;
    this.ih = h;
    const gl = this.gl;
    gl.deleteFramebuffer(this.target.fbo);
    gl.deleteTexture(this.target.color.tex);
    this.target = emptyTarget(gl, w, h);
    this.layout();
  }

  /** Recomputes the letterboxed integer-scale output rect for the canvas' device size. */
  layout(): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    let s = Math.floor(Math.min(W / this.iw, H / this.ih));
    if (s < 1) s = Math.min(W / this.iw, H / this.ih);
    this.out.scale = s;
    this.out.x = Math.floor((W - this.iw * s) / 2);
    this.out.y = Math.floor((H - this.ih * s) / 2);
  }

  begin(camX: number, camY: number, lighting: Lighting, lights: PointLight[]): void {
    const gl = this.gl;
    this.camX = Math.round(camX);
    this.camY = Math.round(camY);
    this.drawCalls = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.fbo);
    gl.viewport(0, 0, this.iw, this.ih);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // pick the strongest lights near the view
    const cx = this.camX + this.iw / 2;
    const cy = this.camY + this.ih / 2;
    const scored = lights
      .filter((l) => l.intensity > 0.01 && Math.abs(l.x - cx) < this.iw / 2 + l.radius && Math.abs(l.y - cy) < this.ih / 2 + l.radius)
      .sort((a, b) => b.intensity * b.radius - a.intensity * a.radius)
      .slice(0, MAX_LIGHTS);
    this.lightCount = scored.length;
    scored.forEach((l, i) => {
      this.lights0.set([Math.round(l.x) - this.camX, Math.round(l.y) - this.camY, l.height, l.radius], i * 4);
      this.lights1.set([l.colour[0], l.colour[1], l.colour[2], l.intensity], i * 4);
    });

    gl.useProgram(this.spriteProg);
    const u = this.spriteU;
    gl.uniform2f(u.uRes!, this.iw, this.ih);
    gl.uniform1i(u.uAlbedo!, 0);
    gl.uniform1i(u.uNormal!, 1);
    gl.uniform3fv(u.uAmbient!, lighting.ambient);
    const kd = lighting.keyDir;
    const kl = Math.hypot(kd[0], kd[1], kd[2]) || 1;
    gl.uniform3f(u.uKeyDir!, kd[0] / kl, kd[1] / kl, kd[2] / kl);
    gl.uniform3fv(u.uKeyCol!, lighting.keyColour);
    gl.uniform3fv(u.uRimCol!, lighting.rimColour);
    const rl = Math.hypot(lighting.rimDir[0], lighting.rimDir[1]) || 1;
    gl.uniform2f(u.uRimDir!, lighting.rimDir[0] / rl, lighting.rimDir[1] / rl);
    gl.uniform4f(u.uRim!, lighting.rimIntensity, lighting.rimBoost, lighting.rimPointGain, lighting.rimThreshold);
    gl.uniform3f(u.uTone!, lighting.lightRoom, lighting.lightTint, lighting.lightCap);
    gl.uniform1f(u.uBands!, lighting.bands);
    gl.uniform1i(u.uCount!, this.lightCount);
    if (u.uL0) gl.uniform4fv(u.uL0, this.lights0);
    if (u.uL1) gl.uniform4fv(u.uL1, this.lights1);
    gl.useProgram(this.vfxProg);
    gl.uniform2f(this.vfxU.uRes!, this.iw, this.ih);
  }

  backdrop(top: RGB, mid: RGB, low: RGB, horizonScreenY: number, bands: number): void {
    this.flush();
    const gl = this.gl;
    gl.useProgram(this.backProg);
    const u = this.backU;
    gl.uniform2f(u.uRes!, this.iw, this.ih);
    gl.uniform1f(u.uHorizon!, horizonScreenY);
    gl.uniform3fv(u.uTop!, top);
    gl.uniform3fv(u.uMid!, mid);
    gl.uniform3fv(u.uLow!, low);
    gl.uniform1f(u.uBands!, bands);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    this.drawCalls++;
  }

  /**
   * Multiplies everything drawn so far by `mul` (per channel): a real darken,
   * no dither, so what is behind stays a solid shape.
   */
  dim(mul: RGB): void {
    this.flush();
    const gl = this.gl;
    gl.useProgram(this.dimProg);
    gl.uniform3fv(this.dimU.uMul!, mul);
    gl.bindVertexArray(this.emptyVao);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.drawCalls++;
  }

  sprite(d: SpriteDraw): void {
    if (this.pending !== "sprite" || this.sheet !== d.sheet || this.spriteCount >= MAX_QUADS) {
      this.flush();
      this.pending = "sprite";
      this.sheet = d.sheet;
    }
    const x0 = d.screen ? Math.round(d.x) : Math.round(d.x) - this.camX;
    const y0 = d.screen ? Math.round(d.y) : Math.round(d.y) - this.camY;
    if (x0 > this.iw || y0 > this.ih || x0 + d.sw < 0 || y0 + d.sh < 0) return;
    const x1 = x0 + d.sw;
    const y1 = y0 + d.sh;
    let u0 = d.sx;
    let u1 = d.sx + d.sw;
    if (d.flip) [u0, u1] = [u1, u0];
    const v0 = d.sy;
    const v1 = d.sy + d.sh;
    const t = d.tint ?? [0, 0, 0, 0];
    const flip = d.flip ? -1 : 1;
    const lit = d.lit ?? 1;
    const op = d.opacity ?? 1;
    const k = d.sheet.keyInfluence;
    const a = this.spriteData;
    let o = this.spriteCount * 4 * SPRITE_FLOATS;
    const put = (x: number, y: number, u: number, v: number): void => {
      a[o++] = x; a[o++] = y; a[o++] = u; a[o++] = v;
      a[o++] = t[0]; a[o++] = t[1]; a[o++] = t[2]; a[o++] = t[3];
      a[o++] = flip; a[o++] = lit; a[o++] = k; a[o++] = op;
    };
    put(x0, y0, u0, v0);
    put(x1, y0, u1, v0);
    put(x1, y1, u1, v1);
    put(x0, y1, u0, v1);
    this.spriteCount++;
  }

  vfx(q: VfxQuad): void {
    if (this.pending !== "vfx" || this.vfxCount >= MAX_QUADS) {
      this.flush();
      this.pending = "vfx";
    }
    const cx = q.screen ? Math.round(q.x) : Math.round(q.x) - this.camX;
    const cy = q.screen ? Math.round(q.y) : Math.round(q.y) - this.camY;
    const c = Math.cos(q.rot);
    const s = Math.sin(q.rot);
    const [ex0, ey0, ex1, ey1] = q.ext;
    const a = this.vfxData;
    let o = this.vfxCount * 4 * VFX_FLOATS;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const corners: [number, number][] = [[ex0, ey0], [ex1, ey0], [ex1, ey1], [ex0, ey1]];
    const start = o;
    for (const [lx, ly] of corners) {
      const px = lx * q.sx;
      const py = ly * q.sy;
      const x = cx + px * c - py * s;
      const y = cy + px * s + py * c;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      a[o++] = x; a[o++] = y; a[o++] = lx; a[o++] = ly;
      a[o++] = q.type; a[o++] = q.t; a[o++] = q.seed; a[o++] = q.over;
      a.set(q.p0, o); o += 4;
      a.set(q.p1, o); o += 4;
      a[o++] = q.core[0]; a[o++] = q.core[1]; a[o++] = q.core[2]; a[o++] = 1;
      a[o++] = q.main[0]; a[o++] = q.main[1]; a[o++] = q.main[2]; a[o++] = 1;
      a[o++] = q.edge[0]; a[o++] = q.edge[1]; a[o++] = q.edge[2]; a[o++] = 1;
    }
    if (maxX < 0 || maxY < 0 || minX > this.iw || minY > this.ih) {
      a.fill(0, start, o);
      return;
    }
    this.vfxCount++;
  }

  /** Solid pixel rect (particles, debug boxes, tiny UI). Integer pixels only. */
  rect(x: number, y: number, w: number, h: number, colour: RGB, over = 1, opacity = 1, screen = false): void {
    const X = Math.round(x);
    const Y = Math.round(y);
    this.vfx({
      type: VFX_TYPE.rect, t: 0, seed: 0, over,
      p0: [opacity, 0, 0, 0], p1: [0, 0, 0, 0],
      core: colour, main: colour, edge: colour,
      x: X, y: Y, rot: 0, sx: 1, sy: 1, ext: [0, 0, Math.max(1, Math.round(w)), Math.max(1, Math.round(h))], screen,
    });
  }

  /** 1px outline box (debug). */
  box(x: number, y: number, w: number, h: number, colour: RGB, screen = false): void {
    const X = Math.round(x), Y = Math.round(y), W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
    this.rect(X, Y, W, 1, colour, 1, 1, screen);
    this.rect(X, Y + H - 1, W, 1, colour, 1, 1, screen);
    this.rect(X, Y, 1, H, colour, 1, 1, screen);
    this.rect(X + W - 1, Y, 1, H, colour, 1, 1, screen);
  }

  flush(): void {
    const gl = this.gl;
    if (this.pending === "sprite" && this.spriteCount > 0 && this.sheet) {
      gl.useProgram(this.spriteProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sheet.albedo.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.sheet.normal.tex);
      gl.bindVertexArray(this.spriteVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.spriteData, 0, this.spriteCount * 4 * SPRITE_FLOATS);
      gl.drawElements(gl.TRIANGLES, this.spriteCount * 6, gl.UNSIGNED_INT, 0);
      this.drawCalls++;
    } else if (this.pending === "vfx" && this.vfxCount > 0) {
      gl.useProgram(this.vfxProg);
      gl.bindVertexArray(this.vfxVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vfxBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vfxData, 0, this.vfxCount * 4 * VFX_FLOATS);
      gl.drawElements(gl.TRIANGLES, this.vfxCount * 6, gl.UNSIGNED_INT, 0);
      this.drawCalls++;
    }
    this.spriteCount = 0;
    this.vfxCount = 0;
    this.pending = null;
  }

  present(post: PostFx): void {
    this.flush();
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(this.blitProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.target.color.tex);
    const u = this.blitU;
    gl.uniform1i(u.uScene!, 0);
    gl.uniform2f(u.uIRes!, this.iw, this.ih);
    gl.uniform2f(u.uCanvas!, this.canvas.width, this.canvas.height);
    const S = this.out.scale;
    const Z = Number.isInteger(S) ? S + Math.max(0, Math.round(post.zoomSteps)) : S;
    gl.uniform4f(u.uRect!, this.out.x, this.out.y, S, Z);
    gl.uniform2f(u.uFocus!, Math.round(post.focus[0]), Math.round(post.focus[1]));
    gl.uniform1i(u.uImpact!, post.impact);
    gl.uniform4fv(u.uFade!, post.fade);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    this.drawCalls++;
  }
}
