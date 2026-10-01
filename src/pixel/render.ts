// WebGL2 renderer for pixel matter. Draws a PixelWorld into a 1280x720
// world-pixel framebuffer, layer by layer (far, bg, mid, decal, [actors],
// debris, fg, light), then presents it: whole-number nearest upscale, or
// sharp-bilinear (nearest to the next whole multiple, then a linear
// downsample) when a whole number would waste the screen. Never plain bilinear.
//
// Static cells live in textures and cost nothing; only dirty rects upload.

import lightingRaw from "../lab/data/lighting.json?raw";
import type { CellGrid } from "./cells.ts";
import { compile, freeTarget, target, texture, uniforms, type Target, type Uniforms } from "./gl.ts";
import { allMaterials, materialsVersion } from "./materials.ts";
import { LAYERS, type LayerName, type Part } from "./part.ts";
import { P_ADD, P_FADE } from "./bodies.ts";
import { presentFit, SCALE, type PresentFit } from "./scale.ts";
import { BACKDROP_FS, CELL_FS, FULL_VS, GLOW_FS, LINEAR_FS, MAX_LIGHTS, NEAREST_FS, POINT_FS, POINT_VS, QUAD_VS } from "./shaders.ts";
import type { PixelWorld } from "./world.ts";

export interface Lighting {
  ambient: [number, number, number];
  keyDir: [number, number, number];
  keyColour: [number, number, number];
  rimColour: [number, number, number];
  rimDir: [number, number];
  rimIntensity: number;
  rimBoost: number;
  rimPointGain: number;
  rimThreshold: number;
  bands: number;
  lightRoom: number;
  lightTint: number;
  lightCap: number;
  /** Key-light influence over the baked ramp (the lab's "baked" = 0.25). */
  keyInfluence: number;
}

const FALLBACK: Lighting = {
  ambient: [0.36, 0.35, 0.42], keyDir: [0.45, -0.62, 0.64], keyColour: [0.7, 0.68, 0.64], rimColour: [0.74, 0.91, 1.0], rimDir: [-0.62, -0.78],
  rimIntensity: 0.9, rimBoost: 1.45, rimPointGain: 1.15, rimThreshold: 0.34, bands: 6, lightRoom: 0.6, lightTint: 1.0, lightCap: 1.35, keyInfluence: 0.25,
};

/** The lab's lighting (src/lab/data/lighting.json), so props light like the character. */
export const LAB_LIGHTING: Lighting = (() => {
  try {
    const j = JSON.parse(lightingRaw) as Partial<Lighting>;
    return { ...FALLBACK, ...j, keyInfluence: FALLBACK.keyInfluence };
  } catch {
    return FALLBACK;
  }
})();

export type ViewMode = "lit" | "albedo" | "normals" | "layers";

export interface Backdrop {
  top: [number, number, number];
  mid: [number, number, number];
  low: [number, number, number];
  bands: number;
  /** Screen y where the gradient reaches `low`. */
  horizon: number;
}

export interface RenderOptions {
  cam: { x: number; y: number };
  view?: ViewMode;
  layers?: Partial<Record<LayerName, boolean>>;
  lighting?: Partial<Lighting>;
  backdrop?: Backdrop | null;
  clear?: [number, number, number];
  /** Draw actors (player, mobs) between the decal and fg layers; world-pixel coords, same camera. */
  actors?: (r: PixelRenderer) => void;
  particles?: boolean;
}

interface Gpu {
  a: WebGLTexture;
  b: WebGLTexture;
  W: number;
  H: number;
  idx: WebGLTexture | null;
  idxVersion: number;
}

/** Texture unit used only for uploads (never sampled). */
const SCRATCH_UNIT = 7;

const LAYER_TINT: Record<LayerName, [number, number, number]> = {
  far: [0.3, 0.45, 0.95], bg: [0.6, 0.35, 0.9], mid: [0.75, 0.75, 0.72], decal: [0.95, 0.55, 0.2], fg: [0.3, 0.85, 0.45], light: [1, 0.9, 0.3],
};

export class PixelRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  readonly vw: number;
  readonly vh: number;
  readonly scene: Target;
  private up: Target | null = null;
  fit: PresentFit;
  private cell: { p: WebGLProgram; u: Uniforms };
  private glow: { p: WebGLProgram; u: Uniforms };
  private point: { p: WebGLProgram; u: Uniforms };
  private backdrop: { p: WebGLProgram; u: Uniforms };
  private nearest: { p: WebGLProgram; u: Uniforms };
  private linear: { p: WebGLProgram; u: Uniforms };
  private matTex: WebGLTexture | null = null;
  private matPTex: WebGLTexture | null = null;
  private matVersion = -1;
  private pointBuf: WebGLBuffer;
  private pointVao: WebGLVertexArrayObject;
  private pointData = new Float32Array(0);
  private frame = 0;
  /** >= 0: parts draw mirrored about this view row (the world's reflection pass sets it around its draw). */
  mirror = -1;
  /** Parts currently holding cell textures (for leak checks). */
  private live = 0;
  private emptyTex: WebGLTexture;
  stats = { draws: 0, uploads: 0, uploadKB: 0, parts: 0, lights: 0, glows: 0, particles: 0, gpuParts: 0 };

  constructor(canvas: HTMLCanvasElement, vw: number = SCALE.view.w, vh: number = SCALE.view.h) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    this.vw = vw;
    this.vh = vh;
    this.scene = target(gl, vw, vh);
    const mk = (vs: string, fs: string, name: string): { p: WebGLProgram; u: Uniforms } => {
      const p = compile(gl, vs, fs, name);
      return { p, u: uniforms(gl, p) };
    };
    this.cell = mk(QUAD_VS, CELL_FS, "cell");
    this.glow = mk(QUAD_VS, GLOW_FS, "glow");
    this.point = mk(POINT_VS, POINT_FS, "point");
    this.backdrop = mk(FULL_VS, BACKDROP_FS, "backdrop");
    this.nearest = mk(FULL_VS, NEAREST_FS, "present-nearest");
    this.linear = mk(FULL_VS, LINEAR_FS, "present-linear");
    this.pointBuf = gl.createBuffer()!;
    this.pointVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.pointVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.bindVertexArray(null);
    this.emptyTex = texture(gl, 1, 1, new Uint8Array(4));
    this.fit = presentFit(canvas.width || vw, canvas.height || vh, vw, vh);
  }

  /** Match the canvas backing store to its CSS size x devicePixelRatio. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.fit = presentFit(w, h, this.vw, this.vh);
  }

  private syncMaterials(): void {
    if (this.matVersion === materialsVersion && this.matTex) return;
    const gl = this.gl;
    const d = new Uint8Array(8 * 256 * 4);
    const p = new Uint8Array(2 * 256 * 4);
    for (const m of allMaterials()) {
      const row = m.id;
      const cols = [m.rgb[0]!, m.rgb[1]!, m.rgb[2]!, m.rgb[3]!, m.lineRgb, m.seloutRgb, m.innerRgb, m.specRgb ?? m.rgb[3]!];
      cols.forEach((c, k) => d.set([c[0], c[1], c[2], 255], (row * 8 + k) * 4));
      const t = m.t ?? [0.16, 0.44, 0.8];
      p.set([Math.round(t[0] * 255), Math.round(t[1] * 255), Math.round(t[2] * 255), m.spec ? Math.round(m.spec.thr * 255) : 0], (row * 2) * 4);
      p.set([m.emissive ? 255 : 0, Math.round((m.glow ?? 0) * 255), m.ink === false ? 0 : 255, m.glint ? 255 : 0], (row * 2 + 1) * 4);
    }
    if (this.matTex) gl.deleteTexture(this.matTex);
    if (this.matPTex) gl.deleteTexture(this.matPTex);
    this.matTex = texture(gl, 8, 256, d);
    this.matPTex = texture(gl, 2, 256, p);
    this.matVersion = materialsVersion;
  }

  // --- cell upload -----------------------------------------------------------

  private pack(g: CellGrid, x0: number, y0: number, x1: number, y1: number): { a: Uint8Array; b: Uint8Array } {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const a = new Uint8Array(w * h * 4), b = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y0 + y) * g.W + x0 + x;
        const k = (y * w + x) * 4;
        a[k] = g.mat[i]!;
        a[k + 1] = Math.max(0, Math.min(255, g.tone[i]! + 128));
        a[k + 2] = g.piece[i]!;
        a[k + 3] = g.flags[i]!;
        b[k] = Math.round((g.nrm[i * 3]! * 0.5 + 0.5) * 255);
        b[k + 1] = Math.round((g.nrm[i * 3 + 1]! * 0.5 + 0.5) * 255);
        b[k + 2] = Math.round((g.nrm[i * 3 + 2]! * 0.5 + 0.5) * 255);
        b[k + 3] = Math.min(255, Math.round(g.height[i]! * 8));
      }
    }
    return { a, b };
  }

  private sync(part: Part): Gpu {
    const gl = this.gl;
    const g = part.grid;
    // uploads bind on the active unit: use a scratch unit so the material
    // tables bound to units 3/4 by useCell survive (a first upload after
    // useCell used to clobber unit 4 and flash the whole frame bright)
    gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT);
    let gpu = part.gpu as Gpu | null;
    if (!gpu || gpu.W !== g.W || gpu.H !== g.Hh) {
      if (gpu) this.free(gpu);
      g.computeNormals({ x0: 0, y0: 0, x1: g.W - 1, y1: g.Hh - 1 });
      const { a, b } = this.pack(g, 0, 0, g.W - 1, g.Hh - 1);
      if (!gpu) this.live++;
      gpu = { a: texture(gl, g.W, g.Hh, a), b: texture(gl, g.W, g.Hh, b), W: g.W, H: g.Hh, idx: null, idxVersion: -1 };
      part.gpu = gpu;
      g.dirty = null;
      this.stats.uploads++;
      this.stats.uploadKB += (a.length * 2) / 1024;
    } else if (g.dirty) {
      const d = g.dirty;
      g.computeNormals(d);
      const x0 = Math.max(0, d.x0 - 1), y0 = Math.max(0, d.y0 - 1), x1 = Math.min(g.W - 1, d.x1 + 1), y1 = Math.min(g.Hh - 1, d.y1 + 1);
      const { a, b } = this.pack(g, x0, y0, x1, y1);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.bindTexture(gl.TEXTURE_2D, gpu.a);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1, gl.RGBA, gl.UNSIGNED_BYTE, a);
      gl.bindTexture(gl.TEXTURE_2D, gpu.b);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1, gl.RGBA, gl.UNSIGNED_BYTE, b);
      g.dirty = null;
      this.stats.uploads++;
      this.stats.uploadKB += (a.length * 2) / 1024;
    }
    if (part.smoothRotate && Math.abs(part.wrot) > 1e-3 && gpu.idxVersion !== g.shapeVersion) {
      const { data, w, h } = scale2x2(g);
      if (gpu.idx) gl.deleteTexture(gpu.idx);
      gpu.idx = texture(gl, w, h, data);
      gpu.idxVersion = g.shapeVersion;
      this.stats.uploadKB += data.length / 1024;
    }
    return gpu;
  }

  private free(gpu: Gpu): void {
    this.gl.deleteTexture(gpu.a);
    this.gl.deleteTexture(gpu.b);
    if (gpu.idx) this.gl.deleteTexture(gpu.idx);
  }

  /** Release a part's GPU textures (when it is removed for good). */
  release(part: Part): void {
    const gpu = part.gpu as Gpu | null;
    if (gpu) {
      this.free(gpu);
      this.live--;
    }
    part.gpu = null;
  }

  /**
   * Room teardown: free every texture the world's parts and debris hold.
   * Call before dropping a world (room transition, rebuild, H toggle). The
   * world stays usable; anything drawn again simply re-uploads.
   */
  releaseWorld(world: PixelWorld): void {
    for (const p of world.drainRetired()) this.release(p);
    for (const p of world.allParts()) this.release(p);
  }

  // --- frame -----------------------------------------------------------------

  render(world: PixelWorld, o: RenderOptions): void {
    const gl = this.gl;
    this.frame++;
    for (const p of world.drainRetired()) this.release(p);
    this.stats = { draws: 0, uploads: 0, uploadKB: 0, parts: 0, lights: 0, glows: 0, particles: 0, gpuParts: 0 };
    this.syncMaterials();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.viewport(0, 0, this.vw, this.vh);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    const cl = o.clear ?? [0.02, 0.02, 0.03];
    gl.clearColor(cl[0], cl[1], cl[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (o.backdrop && o.layers?.far !== false) this.drawBackdrop(o.backdrop);

    const L: Lighting = { ...LAB_LIGHTING, ...o.lighting };
    const lights = world.lights({ x: o.cam.x, y: o.cam.y, w: this.vw, h: this.vh });
    this.stats.lights = lights.length;
    const view = o.view ?? "lit";
    const parts = world.allParts();
    const byLayer = new Map<LayerName, Part[]>();
    for (const l of LAYERS) byLayer.set(l, []);
    for (const p of parts) if (p.visible && p.grid.count > 0) byLayer.get(p.layer)!.push(p);

    this.useCell(L, lights, view);
    for (const layer of LAYERS) {
      if (layer === "fg") {
        if (o.actors) {
          o.actors(this);
          this.useCell(L, lights, view);
        }
        if (o.particles !== false) this.drawParticles(world, o.cam, false);
        this.useCell(L, lights, view);
      }
      if (o.layers?.[layer] === false) continue;
      const list = byLayer.get(layer)!.sort((a, b) => a.z - b.z);
      for (const p of list) this.drawPart(p, o.cam, layer, world);
      if (layer === "light" && view === "lit") {
        this.drawGlows(world, o.cam);
        if (o.particles !== false) this.drawParticles(world, o.cam, true);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.stats.gpuParts = this.live;
  }

  private useCell(L: Lighting, lights: ReturnType<PixelWorld["lights"]>, view: ViewMode): void {
    const gl = this.gl;
    const { p, u } = this.cell;
    gl.useProgram(p);
    gl.disable(gl.BLEND);
    gl.uniform2f(u["uRes"]!, this.vw, this.vh);
    const kd = L.keyDir, kl = Math.hypot(kd[0], kd[1], kd[2]) || 1;
    gl.uniform3f(u["uAmbient"]!, ...L.ambient);
    gl.uniform3f(u["uKeyDir"]!, kd[0] / kl, kd[1] / kl, kd[2] / kl);
    gl.uniform3f(u["uKeyCol"]!, ...L.keyColour);
    gl.uniform3f(u["uRimCol"]!, ...L.rimColour);
    const rl = Math.hypot(L.rimDir[0], L.rimDir[1]) || 1;
    gl.uniform2f(u["uRimDir"]!, L.rimDir[0] / rl, L.rimDir[1] / rl);
    gl.uniform4f(u["uRim"]!, L.rimIntensity, L.rimBoost, L.rimPointGain, L.rimThreshold);
    gl.uniform3f(u["uTone"]!, L.lightRoom, L.lightTint, L.lightCap);
    gl.uniform1f(u["uBands"]!, L.bands);
    gl.uniform1f(u["uKeyInf"]!, L.keyInfluence);
    const l0 = new Float32Array(MAX_LIGHTS * 4), l1 = new Float32Array(MAX_LIGHTS * 4);
    lights.forEach((l, i) => {
      l0.set([l.x, l.y, l.height, l.radius], i * 4);
      l1.set([l.colour[0], l.colour[1], l.colour[2], l.intensity], i * 4);
    });
    gl.uniform1i(u["uCount"]!, lights.length);
    if (u["uL0"]) gl.uniform4fv(u["uL0"], l0);
    if (u["uL1"]) gl.uniform4fv(u["uL1"], l1);
    gl.uniform1i(u["uView"]!, view === "lit" ? 0 : view === "albedo" ? 1 : view === "normals" ? 2 : 3);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.matTex);
    gl.uniform1i(u["uMats"]!, 3);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.matPTex);
    gl.uniform1i(u["uMatP"]!, 4);
  }

  private resolveMask(part: Part, world: PixelWorld): Part | null {
    if (!part.mask) return null;
    if (part.mask !== "ground") return part.mask;
    const b = part.worldBounds();
    for (const q of world.allParts()) {
      if (!q.ground) continue;
      const c = q.worldBounds();
      if (c.x1 < b.x0 || c.x0 > b.x1 || c.y1 < b.y0 || c.y0 > b.y1) continue;
      part.mask = q;
      return q;
    }
    return null;
  }

  private drawPart(part: Part, cam: { x: number; y: number }, layer: LayerName, world: PixelWorld): void {
    const gl = this.gl;
    const { u } = this.cell;
    const cx = Math.round(cam.x * part.parallax), cy = Math.round(cam.y * part.parallax);
    const b = part.worldBounds();
    const x0 = Math.max(0, Math.floor(b.x0 - cx) - 2);
    const x1 = Math.min(this.vw, Math.ceil(b.x1 - cx) + 2);
    let y0 = Math.floor(b.y0 - cy) - 2, y1 = Math.ceil(b.y1 - cy) + 2;
    const m = this.mirror;
    if (m >= 0) {
      // mirrored: the rows of the part above the line land below it
      const t = 2 * m - y0;
      y0 = Math.max(m, 2 * m - y1);
      y1 = Math.min(this.vh, t);
    } else {
      y0 = Math.max(0, y0);
      y1 = Math.min(this.vh, y1);
    }
    if (x1 <= x0 || y1 <= y0) return;
    const gpu = this.sync(part);
    const mask = this.resolveMask(part, world);
    const mgpu = mask ? this.sync(mask) : null;
    this.stats.parts++;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gpu.a);
    gl.uniform1i(u["uA"]!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gpu.b);
    gl.uniform1i(u["uB"]!, 1);
    const useIdx = part.smoothRotate && Math.abs(part.wrot) > 1e-3 && !!gpu.idx;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, useIdx ? gpu.idx : this.emptyTex);
    gl.uniform1i(u["uIdx"]!, 2);
    gl.uniform1i(u["uUseIdx"]!, useIdx ? 1 : 0);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, mgpu ? mgpu.a : this.emptyTex);
    gl.uniform1i(u["uMA"]!, 5);
    gl.uniform1i(u["uUseMask"]!, mgpu ? 1 : 0);
    if (mask) {
      gl.uniform2f(u["uMPos"]!, mask.wx, mask.wy);
      gl.uniform2f(u["uMOrigin"]!, mask.pivotX + mask.grid.pad, mask.pivotY + mask.grid.pad);
      gl.uniform2f(u["uMGrid"]!, mask.grid.W, mask.grid.Hh);
      gl.uniform2f(u["uMRot"]!, Math.cos(mask.wrot), Math.sin(mask.wrot));
      gl.uniform1f(u["uMFlip"]!, mask.wflip);
    }
    const shake = part.shake > 0 ? (this.frame >> 1) % 2 ? 1 : -1 : 0;
    gl.uniform4f(u["uQuad"]!, x0, y0, x1, y1);
    gl.uniform2f(u["uCam"]!, cx, cy);
    gl.uniform2f(u["uPos"]!, part.wx + shake, part.wy);
    gl.uniform2f(u["uOrigin"]!, part.pivotX + part.grid.pad, part.pivotY + part.grid.pad);
    gl.uniform2f(u["uGrid"]!, part.grid.W, part.grid.Hh);
    gl.uniform2f(u["uRot"]!, Math.cos(part.wrot), Math.sin(part.wrot));
    gl.uniform1f(u["uFlip"]!, part.wflip);
    gl.uniform1f(u["uMirror"]!, m);
    gl.uniform1i(u["uOutline"]!, part.outline);
    gl.uniform1f(u["uLit"]!, part.lit);
    gl.uniform1f(u["uGlow"]!, part.glow);
    gl.uniform1f(u["uHeat"]!, part.heat);
    gl.uniform1f(u["uRimMul"]!, part.rim);
    gl.uniform1f(u["uDissolve"]!, part.dissolve);
    gl.uniform1i(u["uDissolveMode"]!, part.dissolveMode);
    gl.uniform1f(u["uFlash"]!, part.flash > 0.02 ? Math.min(0.75, part.flash) : 0);
    gl.uniform3f(u["uFlashCol"]!, ...part.flashRgb);
    gl.uniform1f(u["uGlint"]!, part.glintT);
    gl.uniform4f(u["uFog"]!, ...part.fog);
    gl.uniform3f(u["uLayerTint"]!, ...LAYER_TINT[layer]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.stats.draws++;
  }

  private drawBackdrop(bd: Backdrop): void {
    const gl = this.gl;
    const { p, u } = this.backdrop;
    gl.useProgram(p);
    gl.uniform2f(u["uRes"]!, this.vw, this.vh);
    gl.uniform3f(u["uTop"]!, ...bd.top);
    gl.uniform3f(u["uMid"]!, ...bd.mid);
    gl.uniform3f(u["uLow"]!, ...bd.low);
    gl.uniform1f(u["uBands"]!, bd.bands);
    gl.uniform1f(u["uHorizon"]!, bd.horizon);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.stats.draws++;
  }

  private drawGlows(world: PixelWorld, cam: { x: number; y: number }): void {
    const gl = this.gl;
    const { p, u } = this.glow;
    const glows = world.glows();
    this.stats.glows = glows.length;
    if (!glows.length) return;
    gl.useProgram(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform2f(u["uRes"]!, this.vw, this.vh);
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    gl.uniform2f(u["uCam"]!, cx, cy);
    for (const g of glows) {
      let x0: number, y0: number, x1: number, y1: number;
      if (g.kind === "beam") {
        const r = Math.max(g.radius, g.width1) / 2 + 1;
        x0 = Math.min(g.x, g.x1) - r; x1 = Math.max(g.x, g.x1) + r;
        y0 = Math.min(g.y, g.y1) - r; y1 = Math.max(g.y, g.y1) + r;
      } else {
        const r = g.radius + (g.kind === "ring" ? g.thick : 0) + 1;
        x0 = g.x - r; x1 = g.x + r; y0 = g.y - r * g.flat; y1 = g.y + r * g.flat;
      }
      const q = [Math.max(0, Math.floor(x0 - cx)), Math.max(0, Math.floor(y0 - cy)), Math.min(this.vw, Math.ceil(x1 - cx)), Math.min(this.vh, Math.ceil(y1 - cy))] as const;
      if (q[2] <= q[0] || q[3] <= q[1]) continue;
      gl.uniform4f(u["uQuad"]!, q[0], q[1], q[2], q[3]);
      gl.uniform1i(u["uKind"]!, g.kind === "disc" ? 0 : g.kind === "beam" ? 1 : 2);
      gl.uniform2f(u["uP0"]!, g.x, g.y);
      gl.uniform2f(u["uP1"]!, g.x1, g.y1);
      gl.uniform3f(u["uCol"]!, ...g.colour);
      gl.uniform1f(u["uR"]!, g.radius);
      gl.uniform1f(u["uI"]!, g.intensity);
      gl.uniform1f(u["uFlat"]!, g.flat);
      gl.uniform1f(u["uW1"]!, g.width1);
      gl.uniform1f(u["uThick"]!, g.thick);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.stats.draws++;
    }
    gl.disable(gl.BLEND);
  }

  private drawParticles(world: PixelWorld, cam: { x: number; y: number }, additive: boolean): void {
    const gl = this.gl;
    const P = world.particles;
    if (!P.n) return;
    if (this.pointData.length < P.n * 7) this.pointData = new Float32Array(Math.max(P.n * 7, 1024 * 7));
    const d = this.pointData;
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    let k = 0;
    for (let i = 0; i < P.n; i++) {
      const add = (P.flags[i]! & P_ADD) !== 0;
      if (add !== additive) continue;
      const x = P.x[i]! - cx, y = P.y[i]! - cy;
      if (x < -2 || y < -2 || x > this.vw + 2 || y > this.vh + 2) continue;
      const c = P.rgb[i]!;
      let a = 1;
      if (P.flags[i]! & P_FADE) a = Math.min(1, P.life[i]! / Math.max(1e-3, P.max[i]! * 0.33));
      else if (additive) a = Math.min(1, P.life[i]! / Math.max(1e-3, P.max[i]! * 0.5));
      d[k++] = x;
      d[k++] = y;
      d[k++] = ((c >> 16) & 255) / 255;
      d[k++] = ((c >> 8) & 255) / 255;
      d[k++] = (c & 255) / 255;
      d[k++] = a;
      d[k++] = P.size[i]!;
    }
    const n = k / 7;
    if (!n) return;
    this.stats.particles += n;
    const { p, u } = this.point;
    gl.useProgram(p);
    gl.uniform2f(u["uRes"]!, this.vw, this.vh);
    gl.uniform1i(u["uAdd"]!, additive ? 1 : 0);
    if (additive) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    } else gl.disable(gl.BLEND);
    gl.bindVertexArray(this.pointVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, k), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    this.stats.draws++;
  }

  // --- present ---------------------------------------------------------------

  present(): void {
    const gl = this.gl;
    const f = this.fit;
    const cw = this.canvas.width, ch = this.canvas.height;
    gl.disable(gl.BLEND);
    if (f.mode === "integer") {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, ch);
      this.drawNearest(this.scene.tex, [cw, ch], [f.x, f.y, f.scale]);
      return;
    }
    const k = f.intScale;
    const uw = this.vw * k, uh = this.vh * k;
    if (!this.up || this.up.w !== uw || this.up.h !== uh) {
      freeTarget(gl, this.up);
      this.up = target(gl, uw, uh, true);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.up.fbo);
    gl.viewport(0, 0, uw, uh);
    this.drawNearest(this.scene.tex, [uw, uh], [0, 0, k]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    const { p, u } = this.linear;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.up.tex);
    gl.uniform1i(u["uUp"]!, 0);
    gl.uniform2f(u["uOut"]!, cw, ch);
    gl.uniform4f(u["uRect"]!, f.x, f.y, f.w, f.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private drawNearest(tex: WebGLTexture, out: [number, number], rect: [number, number, number]): void {
    const gl = this.gl;
    const { p, u } = this.nearest;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u["uScene"]!, 0);
    gl.uniform2f(u["uIRes"]!, this.vw, this.vh);
    gl.uniform2f(u["uOut"]!, out[0], out[1]);
    gl.uniform4f(u["uRect"]!, rect[0], rect[1], rect[2], 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** The world-pixel frame, RGBA, top row first. */
  capture(): Uint8ClampedArray {
    const gl = this.gl;
    const out = new Uint8Array(this.vw * this.vh * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fbo);
    gl.readPixels(0, 0, this.vw, this.vh, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const flipped = new Uint8ClampedArray(out.length);
    const row = this.vw * 4;
    for (let y = 0; y < this.vh; y++) flipped.set(out.subarray((this.vh - 1 - y) * row, (this.vh - y) * row), y * row);
    return flipped;
  }
}

/**
 * Pixel-art-safe rotation support: Scale2x applied twice to the cell grid
 * (comparing material + piece), stored as a 4x map of source cell coordinates.
 * The shader samples it nearest after rotating, so a turning bell keeps clean
 * edges instead of blurring or stair-stepping.
 */
export function scale2x2(g: CellGrid): { data: Uint8Array; w: number; h: number } {
  let w = g.W, h = g.Hh;
  let idx = new Int32Array(w * h);
  for (let i = 0; i < idx.length; i++) idx[i] = g.mat[i] ? i : -1;
  const key = (i: number): number => (i < 0 ? 0 : (g.mat[i]! << 8) | g.piece[i]!);
  for (let pass = 0; pass < 2; pass++) {
    const W2 = w * 2;
    const out = new Int32Array(W2 * h * 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const P = idx[y * w + x]!;
        const A = y > 0 ? idx[(y - 1) * w + x]! : -1;
        const B = x < w - 1 ? idx[y * w + x + 1]! : -1;
        const C = x > 0 ? idx[y * w + x - 1]! : -1;
        const D = y < h - 1 ? idx[(y + 1) * w + x]! : -1;
        const kA = key(A), kB = key(B), kC = key(C), kD = key(D);
        out[2 * y * W2 + 2 * x] = kC === kA && kC !== kD && kA !== kB ? A : P;
        out[2 * y * W2 + 2 * x + 1] = kA === kB && kA !== kC && kB !== kD ? B : P;
        out[(2 * y + 1) * W2 + 2 * x] = kD === kC && kD !== kB && kC !== kA ? C : P;
        out[(2 * y + 1) * W2 + 2 * x + 1] = kB === kD && kB !== kA && kD !== kC ? D : P;
      }
    }
    idx = out;
    w *= 2;
    h *= 2;
  }
  const data = new Uint8Array(w * h * 4);
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k]!;
    if (i < 0) continue;
    const X = i % g.W, Y = (i / g.W) | 0;
    data[k * 4] = X & 255;
    data[k * 4 + 1] = X >> 8;
    data[k * 4 + 2] = Y & 255;
    data[k * 4 + 3] = (Y >> 8) + 1;
  }
  return { data, w, h };
}
