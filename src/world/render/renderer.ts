// World renderer: the lab's sprite + VFX renderer (same shaders, same lighting
// model, same whole-pixel rules), resized to the world view from config.ts and
// extended for the world:
//
// - one GL context shared with the backdrop engine; everything lands in one
//   world target (viewW x viewH), which the presenter shows (presenter.ts);
// - a draw transform: zoom about a focus for the close-up overlay, and a
//   mirror about a waterline for the reflection pass;
// - an overlay target for the close-up path: during combat zoom the world is
//   upscaled, and the player and her effects are drawn again from the 144 px
//   close-up bake at native pixel size on top.
//
// API-compatible with src/lab/engine/renderer.ts where the lab's Player and
// Vfx call it (sprite, vfx, rect, box, flush, dim, texture, flatNormal, iw,
// ih, camX, camY), so they draw through it unchanged.

import { compile, nearestTexture, quadIndices, uniforms, type Texture } from "../../lab/engine/gl.ts";
import { DIM_FS, FULL_VS, MAX_LIGHTS, SPRITE_FS, SPRITE_VS, VFX_FS, VFX_VS } from "../../lab/engine/shaders.ts";
import type { Lighting, PointLight, RGB, SpriteDraw, VfxQuad } from "../../lab/engine/renderer.ts";
import { SCALE } from "../config.ts";
import { Presenter, type PresentOpts } from "./presenter.ts";

export type { Lighting, PointLight, RGB, SpriteDraw, VfxQuad };
export { VFX_TYPE } from "../../lab/engine/renderer.ts";

export interface Target {
  fbo: WebGLFramebuffer;
  color: Texture;
}

const SPRITE_FLOATS = 12;
const VFX_FLOATS = 28;
const MAX_QUADS = 4096;

export function makeTarget(gl: WebGL2RenderingContext, w: number, h: number, linear = false): Target {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const filt = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`world framebuffer incomplete (${status})`);
  return { fbo, color: { tex, w, h } };
}

/** World-to-target transform: screen = (world - cam) * z + off, optionally mirrored about y = mirror. */
interface Xf {
  z: number;
  fx: number;
  fy: number;
  mirror: number | null;
}

export class WorldRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  /** Kept for lab code that reads it; the world has one view size. */
  mode: "near" | "far" = "near";
  readonly iw = SCALE.viewW;
  readonly ih = SCALE.viewH;
  camX = 0;
  camY = 0;
  lightCount = 0;
  drawCalls = 0;
  readonly presenter: Presenter;
  /** The world target (sampled LINEAR by the presenter only; everything else uses texelFetch). */
  readonly main: Target;
  /** Close-up overlay (transparent, same size), drawn over the zoomed world. */
  readonly over: Target;
  private current: Target;

  private spriteProg: WebGLProgram;
  private spriteU: Record<string, WebGLUniformLocation>;
  private vfxProg: WebGLProgram;
  private vfxU: Record<string, WebGLUniformLocation>;
  private dimProg: WebGLProgram;
  private dimU: Record<string, WebGLUniformLocation>;
  private spriteVao: WebGLVertexArrayObject;
  private spriteBuf: WebGLBuffer;
  private vfxVao: WebGLVertexArrayObject;
  private vfxBuf: WebGLBuffer;
  readonly emptyVao: WebGLVertexArrayObject;
  private spriteData = new Float32Array(MAX_QUADS * 4 * SPRITE_FLOATS);
  private vfxData = new Float32Array(MAX_QUADS * 4 * VFX_FLOATS);
  private spriteCount = 0;
  private vfxCount = 0;
  private pending: "sprite" | "vfx" | null = null;
  private sheet: SpriteDraw["sheet"] | null = null;
  private lights0 = new Float32Array(MAX_LIGHTS * 4);
  private lights1 = new Float32Array(MAX_LIGHTS * 4);
  private lighting: Lighting | null = null;
  private lightList: PointLight[] = [];
  readonly flatNormal: Texture;
  readonly white: Texture;
  private xf: Xf = { z: 1, fx: 0, fy: 0, mirror: null };

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
    for (const [loc, size, off] of [[0, 2, 0], [1, 2, 2], [2, 4, 4], [3, 4, 8]] as const) {
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
    for (const [loc, size, off] of [[0, 2, 0], [1, 2, 2], [2, 4, 4], [3, 4, 8], [4, 4, 12], [5, 4, 16], [6, 4, 20], [7, 4, 24]] as const) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, vStride, off * 4);
    }
    this.emptyVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);

    this.flatNormal = nearestTexture(gl, { w: 1, h: 1, data: new Uint8Array([128, 128, 255, 255]) });
    this.white = nearestTexture(gl, { w: 1, h: 1, data: new Uint8Array([255, 255, 255, 255]) });
    this.main = makeTarget(gl, this.iw, this.ih, true);
    this.over = makeTarget(gl, this.iw, this.ih, true);
    this.current = this.main;
    this.presenter = new Presenter(gl, this.emptyVao);
  }

  /** Kept for lab code; the world always has one size. */
  get out(): { x: number; y: number; scale: number } {
    const r = this.presenter.rect;
    return { x: r.x, y: r.y, scale: r.scale };
  }

  texture(src: TexImageSource | { w: number; h: number; data: Uint8Array | Uint8ClampedArray }): Texture {
    return nearestTexture(this.gl, src);
  }

  layout(): void {
    this.presenter.layout(this.canvas.width, this.canvas.height);
  }

  /** Binds a target for drawing (the backdrop engine draws into the same one). */
  bindTarget(t: Target, clear: boolean, clearColour: [number, number, number, number] = [0, 0, 0, 1]): void {
    this.flush();
    const gl = this.gl;
    this.current = t;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.viewport(0, 0, t.color.w, t.color.h);
    gl.disable(gl.SCISSOR_TEST);
    if (clear) {
      gl.clearColor(...clearColour);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  /** Transform for the following draws: zoom z about the low-res focus, and/or mirror about screen row m. */
  setTransform(z = 1, focus: [number, number] = [0, 0], mirror: number | null = null): void {
    this.flush();
    this.xf = { z, fx: focus[0], fy: focus[1], mirror };
    if (this.lighting) this.uploadLights();
  }

  /** Starts the world pass: camera, lighting and effect lights. Does not clear (the backdrop is already there). */
  begin(camX: number, camY: number, lighting: Lighting, lights: PointLight[]): void {
    this.camX = Math.round(camX);
    this.camY = Math.round(camY);
    this.drawCalls = 0;
    this.lighting = lighting;
    this.lightList = lights;
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.uploadLights();
  }

  private sx(x: number): number {
    const { z, fx } = this.xf;
    return z === 1 ? x : Math.round((x - fx) * z + fx);
  }

  private sy(y: number): number {
    const { z, fy, mirror } = this.xf;
    const v = z === 1 ? y : Math.round((y - fy) * z + fy);
    return mirror === null ? v : 2 * mirror - v;
  }

  private uploadLights(): void {
    const L = this.lighting!;
    const gl = this.gl;
    const { z } = this.xf;
    const cx = this.camX + this.iw / 2;
    const cy = this.camY + this.ih / 2;
    const scored = this.lightList
      .filter((l) => l.intensity > 0.01 && Math.abs(l.x - cx) < this.iw / 2 + l.radius && Math.abs(l.y - cy) < this.ih / 2 + l.radius)
      .sort((a, b) => b.intensity * b.radius - a.intensity * a.radius)
      .slice(0, MAX_LIGHTS);
    this.lightCount = scored.length;
    this.lights0.fill(0);
    this.lights1.fill(0);
    scored.forEach((l, i) => {
      this.lights0.set([this.sx(Math.round(l.x) - this.camX), this.sy(Math.round(l.y) - this.camY), l.height * z, l.radius * z], i * 4);
      this.lights1.set([l.colour[0], l.colour[1], l.colour[2], l.intensity], i * 4);
    });
    gl.useProgram(this.spriteProg);
    const u = this.spriteU;
    gl.uniform2f(u.uRes!, this.iw, this.ih);
    gl.uniform1i(u.uAlbedo!, 0);
    gl.uniform1i(u.uNormal!, 1);
    gl.uniform3fv(u.uAmbient!, L.ambient);
    const kd = L.keyDir;
    const kl = Math.hypot(kd[0], kd[1], kd[2]) || 1;
    // mirrored: the key light comes from below in the reflection
    const my = this.xf.mirror === null ? 1 : -1;
    gl.uniform3f(u.uKeyDir!, kd[0] / kl, (my * kd[1]) / kl, kd[2] / kl);
    gl.uniform3fv(u.uKeyCol!, L.keyColour);
    gl.uniform3fv(u.uRimCol!, L.rimColour);
    const rl = Math.hypot(L.rimDir[0], L.rimDir[1]) || 1;
    gl.uniform2f(u.uRimDir!, L.rimDir[0] / rl, (my * L.rimDir[1]) / rl);
    gl.uniform4f(u.uRim!, L.rimIntensity, L.rimBoost, L.rimPointGain, L.rimThreshold);
    gl.uniform3f(u.uTone!, L.lightRoom, L.lightTint, L.lightCap);
    gl.uniform1f(u.uBands!, L.bands);
    gl.uniform1i(u.uCount!, this.lightCount);
    if (u.uL0) gl.uniform4fv(u.uL0, this.lights0);
    if (u.uL1) gl.uniform4fv(u.uL1, this.lights1);
    gl.useProgram(this.vfxProg);
    gl.uniform2f(this.vfxU.uRes!, this.iw, this.ih);
  }

  /** Multiplies everything drawn so far by `mul` (a real darken, no dither). */
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
    const bx = d.screen ? Math.round(d.x) : Math.round(d.x) - this.camX;
    const by = d.screen ? Math.round(d.y) : Math.round(d.y) - this.camY;
    const z = d.screen ? 1 : this.xf.z;
    let x0 = d.screen ? bx : this.sx(bx);
    let y0 = d.screen ? by : this.sy(by);
    let x1 = x0 + d.sw * z;
    let y1 = d.screen || this.xf.mirror === null ? y0 + d.sh * z : y0 - d.sh * z;
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (x0 > this.iw || y0 > this.ih || x1 < 0 || y1 < 0) return;
    let u0 = d.sx;
    let u1 = d.sx + d.sw;
    if (d.flip) [u0, u1] = [u1, u0];
    let v0 = d.sy;
    let v1 = d.sy + d.sh;
    if (!d.screen && this.xf.mirror !== null) [v0, v1] = [v1, v0];
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
    x0 = Math.round(x0); x1 = Math.round(x1);
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
    const z = q.screen ? 1 : this.xf.z;
    const mir = !q.screen && this.xf.mirror !== null;
    const cx = q.screen ? Math.round(q.x) : this.sx(Math.round(q.x) - this.camX);
    const cy = q.screen ? Math.round(q.y) : this.sy(Math.round(q.y) - this.camY);
    const rot = mir ? -q.rot : q.rot;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const qsx = q.sx * z;
    const qsy = q.sy * z * (mir ? -1 : 1);
    const [ex0, ey0, ex1, ey1] = q.ext;
    const a = this.vfxData;
    let o = this.vfxCount * 4 * VFX_FLOATS;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const corners: [number, number][] = [[ex0, ey0], [ex1, ey0], [ex1, ey1], [ex0, ey1]];
    const start = o;
    for (const [lx, ly] of corners) {
      const px = lx * qsx;
      const py = ly * qsy;
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
    this.vfx({
      type: 0, t: 0, seed: 0, over,
      p0: [opacity, 0, 0, 0], p1: [0, 0, 0, 0],
      core: colour, main: colour, edge: colour,
      x: Math.round(x), y: Math.round(y), rot: 0, sx: 1, sy: 1, ext: [0, 0, Math.max(1, Math.round(w)), Math.max(1, Math.round(h))], screen,
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

  /** Shows the world target (and the close-up overlay when used) on the canvas. */
  present(o: PresentOpts): void {
    this.flush();
    this.presenter.draw(this.main, o.overlay ? this.over : null, this.canvas.width, this.canvas.height, o);
    this.drawCalls++;
    this.current = this.main;
  }

  get target(): Target {
    return this.current;
  }
}
