// A room's backdrop: the /scenes/ layer engine (src/scenes/engine/engine.ts),
// forked for the world. Same layer kinds, same GLSL library, same pixel rules
// (ramps, stepped fog, whole-pixel parallax), with these changes:
//
// - it shares the world renderer's GL context and draws into the world target
//   instead of presenting itself; several backdrops can be built at once
//   (streaming keeps the neighbours warm) and each can be disposed;
// - the camera is the world camera: x runs 0..span at depth 1 (1:1 with the
//   player plane), plus an optional vertical parallax;
// - layers draw in passes: "back" (depth >= 1) before the world's sprites and
//   "front" (depth < 1) after them; the reflection pass can draw extra things
//   (the world's own sprites, mirrored) before water samples it;
// - weather reaches every layer through uWx / uWx2 uniforms, and extra flash
//   lights (lightning) are merged into the scene's flash lights;
// - a "mul" blend for a flat multiply grade (storm darkening), no dither;
// - the frame: the world renders into FRAME (config.ts), larger than the 1280x720
//   design view a scene is composed in. The design view sits inside it at `at`
//   (camera.design()); layers are evaluated over the whole frame, so a scene
//   simply continues past its old edges (textures are built MARGIN wider).
//
// Scene files written for /scenes/ build here unchanged.

import { dataTexture, uniforms, type Texture } from "../../scenes/engine/gl.ts";
import { DEFAULT_PRELUDE, FULL_VS, HEADER, LIB, LIB_FOG, LIB_REFL, MAIN as SCENE_MAIN, POINT_BODY, POINT_VS } from "../../scenes/engine/glsl.ts";
import { f } from "../../scenes/engine/layers.ts";
import { mulberry } from "../../scenes/engine/noise.ts";
import { placeFlocks } from "../../scenes/engine/order.ts";
import { buildPalette, hex, paletteDefines, type Hex, type Palette } from "../../scenes/engine/palette.ts";
import { SCALE, playerPx } from "../../scenes/engine/scale.ts";
import type { BuildCtx, FogSpec, LayerDef, LightOut, SceneDef, SimEnv } from "../../scenes/engine/types.ts";
import { makeTarget, type Target } from "../render/renderer.ts";
import { FRAME, FRAME_W } from "../config.ts";

/** Extra texture width per side so pan layers cover the frame past the design view. */
const MARGIN = Math.ceil((FRAME_W.max - SCALE.view.w) / 2) + 32;

/** Uniforms every world layer can read (weather, wind, time of day). */
export const WORLD_UNIFORMS = /* glsl */ `
uniform vec4 uWx;   // rain 0..1, wind -1..1, mist 0..1, storm dark 0..1
uniform vec4 uWx2;  // lightning flash 0..1, world seconds, overcast 0..1, after-storm 0..1
uniform vec2 uVOff; // this layer's whole-pixel vertical parallax offset
uniform vec4 uBolt; // lightning bolt: screen x, seed, level 0..1, bottom row
uniform float uCamY; // the camera's vertical offset from the room's reference framing, times the vertical factor
uniform float uWl;  // the world mirror's waterline in the view's rows (-1: none)
uniform vec4 uFrame; // where the design view sits in the frame (x, y from its top-left), frame w, h
#define WORLD_FRAME 1
float vOff(float depth) { return depth > 1e6 ? 0.0 : floor(uCamY / depth + 0.5); }
`;

// The scene engine's MAIN, with vertical parallax: p = s + (horizontal offset,
// vertical offset). Derived from the shared one so reflection fades and any
// later changes there carry over.
const MAIN = ((): string => {
  const from = "vec2 p = s + uOff;";
  const fromS = "vec2 s = vec2(floor(gl_FragCoord.x), uRes.y - 1.0 - floor(gl_FragCoord.y));";
  if (!SCENE_MAIN.includes(from) || !SCENE_MAIN.includes(fromS)) throw new Error("world backdrop: the scene engine's MAIN changed; update src/world/backdrop/engine.ts");
  // s stays in design-view px (0..1280 x 0..720 inside the design view, beyond it in the frame's margins)
  return SCENE_MAIN.replace(fromS, "vec2 s = vec2(floor(gl_FragCoord.x) - uFrame.x, uFrame.w - 1.0 - floor(gl_FragCoord.y) - uFrame.y);").replace(from, "vec2 p = s + vec2(uOff.x, uVOff.y);");
})();

/** Point sprites placed in the frame (the scene engine's POINT_VS maps design px to its own target). */
const WORLD_POINT_VS = ((): string => {
  const from = "gl_Position = vec4(c.x / uRes.x * 2.0 - 1.0, 1.0 - c.y / uRes.y * 2.0, 0.0, 1.0);";
  if (!POINT_VS.includes(from)) throw new Error("world backdrop: the scene engine's POINT_VS changed; update src/world/backdrop/engine.ts");
  return POINT_VS.replace("uniform vec2 uRes;", "uniform vec2 uRes;\nuniform vec4 uFrame;").replace(from, "vec2 fc = c + uFrame.xy;\n  gl_Position = vec4(fc.x / uFrame.z * 2.0 - 1.0, 1.0 - fc.y / uFrame.w * 2.0, 0.0, 1.0);");
})();

const PIX_BODY = (twinkle: number): string => /* glsl */ `
vec4 layer(vec2 p, vec2 s) {
  vec2 tp = p - uTexOrigin;
  if (uRepeat > 0.5) tp.x = mod(tp.x, uTexSize.x);
  if (tp.x < 0.0 || tp.y < 0.0 || tp.x >= uTexSize.x || tp.y >= uTexSize.y) return vec4(0.0);
  vec4 t = texelFetch(uTex, ivec2(tp), 0);
  if (t.a < 0.5) return vec4(0.0);
  float g = floor(t.g * 255.0 + 0.5);
  bool emis = g >= 128.0;
  float row = emis ? g - 128.0 : g;
  vec3 c;
  if (emis) {
    float n = paln(row);
    float ph = hash2(tp) * 97.0;
    float tw = uReduced > 0.5 ? 0.0 : step(1.0 - ${f(twinkle * 0.12)}, vnoise(vec2(uTime * 0.3 + ph, ph)));
    c = pal(row, max(0.0, n - 1.0 - tw));
    c = applyFog(c, uFog * 0.75, t.b * 0.75, tp, s);
  } else {
    float light = sceneLight(s, uDepth) + flashLight(s);
    c = ramp(row, t.r + light, tp, uDither);
    c = applyFog(c, uFog, t.b, tp, s);
  }
  return vec4(c, 1.0);
}`;

const DEFAULT_STANDIN: Hex[] = ["#07080c", "#11151c", "#2a3440", "#6f7f8c"];

export type Pass = "back" | "front";

/** A LayerDef plus the world's extras (set on the def object; the scene types don't know them). */
export type WorldLayer = LayerDef & {
  /** Force a pass (default: depth < 1 -> front). */
  pass?: Pass;
  /** Weather drives this layer's opacity each frame. */
  wx?: (w: WeatherUniforms) => number;
  /** "mul": multiply what is behind (flat grade). */
  worldBlend?: "mul";
};

export interface WeatherUniforms {
  rain: number;
  wind: number;
  mist: number;
  dark: number;
  flash: number;
  time: number;
  overcast: number;
  after: number;
  /** Lightning bolt: screen x, seed, level 0..1, bottom row. */
  bolt: [number, number, number, number];
}

interface Prog {
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation>;
  vs: WebGLShader;
  fs: WebGLShader;
  name: string;
  fsSrc: string;
  ok: boolean;
}

interface RL {
  def: WorldLayer;
  box?: { x0: number; y0: number; x1: number; y1: number };
  p: Prog;
  pass: Pass;
  tex?: Texture;
  origin: [number, number];
  repeat: boolean;
  fog: number;
  baseOpacity: number;
}

export interface BackdropOpts {
  id: string;
  W: number;
  H: number;
  /** Pan range at depth 1: room width - view width. */
  span: number;
  /** 0..1: how much of the camera's vertical travel the layers follow (x 1/depth). */
  vertical: number;
  /** Layer names to leave out (the world draws its own ground and figure). */
  hide?: string[];
}

export class Backdrop {
  readonly id: string;
  readonly W: number;
  readonly H: number;
  readonly span: number;
  camX = 0;
  camY = 0;
  /** Where the design view sits in the frame (px from the frame's top-left). */
  frameAt: [number, number] = [0, 0];
  /** The world mirror's waterline in design rows (room waterline minus the design camera's y); -1 with none. */
  waterRow = -1;
  time = 0;
  reduced = false;
  buildMs = 0;
  stats = { layers: 0, draws: 0, points: 0 };
  refl: Target;
  private layers: RL[] = [];
  private pal: Palette;
  private programs = new Map<string, Prog>();
  private parallel: { COMPLETION_STATUS_KHR: number } | null;
  /** All shader programs compiled and linked (built across frames with KHR_parallel_shader_compile). */
  private isReady = false;
  cpuMs = 0;
  readyMs = 0;
  private t0 = 0;
  private pointVao: WebGLVertexArrayObject;
  private pointBuf: WebGLBuffer;
  private pointData = new Float32Array(8 * 8192);
  private pointN = 0;
  private ctx: BuildCtx;
  private flashU = new Float32Array(16);
  private flashC = new Float32Array(12);
  private wx: WeatherUniforms = { rain: 0, wind: 0, mist: 0, dark: 0, flash: 0, time: 0, overcast: 0, after: 0, bolt: [0, 0, 0, 0] };
  private extraLights: LightOut[] = [];
  private disposed = false;
  readonly usesReflection: boolean;

  constructor(
    readonly gl: WebGL2RenderingContext,
    readonly def: SceneDef,
    readonly o: BackdropOpts,
    private emptyVao: WebGLVertexArrayObject,
    private gate: () => boolean,
  ) {
    const t0 = performance.now();
    this.t0 = t0;
    this.parallel = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;
    this.id = o.id;
    this.W = o.W;
    this.H = o.H;
    this.span = Math.max(0, Math.round(o.span));
    this.refl = makeTarget(gl, FRAME.w, FRAME.h);
    this.pointVao = gl.createVertexArray()!;
    this.pointBuf = gl.createBuffer()!;
    gl.bindVertexArray(this.pointVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.pointData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    gl.bindVertexArray(null);

    const { W, H } = o;
    const pal = buildPalette(gl, { standin: DEFAULT_STANDIN, ...def.palette });
    this.pal = pal;
    const span = this.span;
    let seed = 0;
    for (const ch of o.id) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
    const rng = mulberry(seed ^ 0x5eed);
    const ctx: BuildCtx = {
      mode: "world",
      W,
      H,
      u: H / 360,
      world: H / SCALE.view.h,
      player: playerPx(H),
      span,
      row: (name) => {
        const r = pal.rows[name];
        if (r === undefined) throw new Error(`${o.id}: palette has no ramp "${name}"`);
        return r;
      },
      par: (d) => (Number.isFinite(d) ? 1 / d : 0),
      panWidth: (d) => W + 2 * MARGIN + Math.ceil(span * (Number.isFinite(d) ? 1 / d : 0)) + 2,
      fogAt: (d) => this.fogAt(d),
      rng,
    };
    this.ctx = ctx;

    let prelude = def.prelude ? def.prelude(ctx) : DEFAULT_PRELUDE;
    if (!/float\s+sceneLight\s*\(/.test(prelude)) prelude += DEFAULT_PRELUDE;
    const head = [HEADER, WORLD_UNIFORMS, paletteDefines(pal), LIB, LIB_REFL, fogGlsl(def.fog), LIB_FOG, prelude].join("\n");
    // shaders start compiling now and finish in the background (ready() polls them)
    const program = (key: string, vsSrc: string, fsSrc: string, name: string): Prog => {
      let p = this.programs.get(key);
      if (!p) {
        const mk = (type: number, src: string): WebGLShader => {
          const sh = gl.createShader(type)!;
          gl.shaderSource(sh, src);
          gl.compileShader(sh);
          return sh;
        };
        const vs = mk(gl.VERTEX_SHADER, vsSrc);
        const fs = mk(gl.FRAGMENT_SHADER, fsSrc);
        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        p = { prog, u: {}, vs, fs, name: `${o.id}/${name}`, fsSrc, ok: false };
        this.programs.set(key, p);
      }
      return p;
    };
    const hide = new Set(o.hide ?? []);
    const all = placeFlocks(def.build(ctx)) as WorldLayer[];
    // the player plane sits where the scene put its figure: layers after it draw in front of the world
    const fig = all.findIndex((l) => l.kind === "character");
    all.forEach((l, i) => {
      if (hide.has(l.name) || l.kind === "character") return;
      const pass: Pass = l.pass ?? (fig >= 0 ? (i > fig ? "front" : "back") : l.depth < 1 && !(l.kind === "glsl" && l.usesReflection) ? "front" : "back");
      const fog = l.fog ?? this.fogAt(l.depth);
      const base = { origin: [0, 0] as [number, number], repeat: false, fog, baseOpacity: l.opacity ?? 1, pass };
      if (l.kind === "points") {
        this.layers.push({ def: l, p: program("points", WORLD_POINT_VS, `${head}\n${POINT_BODY}`, l.name), ...base });
        return;
      }
      if (l.kind === "glsl") {
        this.layers.push({ def: l, p: program(`glsl:${l.body}`, FULL_VS, `${head}\n${l.body}\n${MAIN}`, l.name), ...base });
        return;
      }
      const tw = l.twinkle ?? 0;
      const p = program(`pix:${tw}`, FULL_VS, `${head}\n${PIX_BODY(tw)}\n${MAIN}`, l.name);
      const tex = dataTexture(gl, l.pix.w, l.pix.h, l.pix.data);
      const bb = solidBox(l.pix.data, l.pix.w, l.pix.h);
      const box = bb ? { x0: l.x + bb[0], y0: l.y + bb[1], x1: l.x + bb[2], y1: l.y + bb[3] } : { x0: 0, y0: 0, x1: 0, y1: 0 };
      this.layers.push({ def: l, p, ...base, tex, box, origin: [l.x, l.y], repeat: !!l.repeatX });
    });
    this.usesReflection = this.layers.some((l) => l.def.kind === "glsl" && l.def.usesReflection);
    this.stats.layers = this.layers.length;
    this.cpuMs = Math.round(performance.now() - t0);
    this.buildMs = this.cpuMs;
  }

  /**
   * True once every program has compiled and linked. With
   * KHR_parallel_shader_compile this never blocks: it is polled each frame
   * while the room warms up. Without it, the first call finishes them all.
   */
  ready(): boolean {
    if (this.isReady) return true;
    this.poll();
    return this.isReady;
  }

  /** Share of programs compiled (0..1). */
  get progress(): number {
    let n = 0;
    for (const p of this.programs.values()) if (p.ok) n++;
    return this.programs.size ? n / this.programs.size : 1;
  }

  /** Finishes every program the driver has completed; never waits on one that isn't. */
  poll(): void {
    if (this.isReady) return;
    const gl = this.gl;
    const ext = this.parallel;
    let all = true;
    for (const p of this.programs.values()) {
      if (p.ok) continue;
      if (ext && !gl.getProgramParameter(p.prog, ext.COMPLETION_STATUS_KHR)) {
        all = false;
        continue;
      }
      if (!gl.getProgramParameter(p.prog, gl.LINK_STATUS)) {
        const log = gl.getShaderInfoLog(p.fs) || gl.getShaderInfoLog(p.vs) || gl.getProgramInfoLog(p.prog) || "";
        const lines = p.fsSrc.split("\n");
        const near = [...log.matchAll(/0:(\d+)/g)].map((m) => Number(m[1])).slice(0, 2);
        const at = near.map((n) => lines.slice(Math.max(0, n - 3), n + 1).map((l, i) => `${Math.max(1, n - 2) + i}: ${l}`).join("\n")).join("\n---\n");
        throw new Error(`${p.name} shader: ${log}\n${at}`);
      }
      gl.deleteShader(p.vs);
      gl.deleteShader(p.fs);
      p.u = uniforms(gl, p.prog);
      p.ok = true;
    }
    if (all) {
      this.isReady = true;
      this.readyMs = Math.round(performance.now() - this.t0);
    }
  }

  get buildCtx(): BuildCtx {
    return this.ctx;
  }

  fogAt(depth: number): number {
    const fog = this.def.fog;
    if (depth <= 1) return 0;
    if (!Number.isFinite(depth)) return fog.max;
    return fog.max * (1 - Math.exp(-fog.density * (depth - 1)));
  }

  /** Whole-pixel horizontal offset of a depth, relative to mid-pan (same rounding as GLSL layerOff). */
  offset(depth: number): number {
    const par = depth > 1e6 ? 0 : 1 / depth;
    return Math.floor(this.camX * par + 0.5) - Math.floor((this.span / 2) * par + 0.5);
  }

  /** Whole-pixel vertical offset of a depth (camY is relative to the room's reference framing). */
  offsetY(depth: number): number {
    if (!Number.isFinite(depth) || this.o.vertical <= 0) return 0;
    return Math.floor((this.camY * this.o.vertical) / depth + 0.5);
  }

  /**
   * Camera: x = the design camera's left edge (0..span), y = vertical offset from the reference
   * framing; `at`: where that design view sits in the frame (camera.design()).
   */
  setCamera(x: number, y: number, at: [number, number] = [0, 0]): void {
    this.camX = Math.min(this.span, Math.max(0, x));
    this.camY = y;
    this.frameAt = at;
  }

  setWeather(w: WeatherUniforms, lights: LightOut[]): void {
    this.wx = w;
    this.extraLights = lights;
  }

  update(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.time += dt;
    const env: SimEnv = { t: this.time, reduced: this.reduced, ctx: this.ctx, flashGate: this.gate };
    for (const l of this.layers) {
      if (l.def.kind === "points") l.def.system.update(dt, env);
      if (l.def.wx) l.def.opacity = l.baseOpacity * Math.max(0, Math.min(1, l.def.wx(this.wx)));
    }
  }

  private gatherLights(): void {
    const all: LightOut[] = [];
    for (const l of this.layers) {
      if (l.def.kind !== "points" || !l.def.system.lights) continue;
      const before = all.length;
      l.def.system.lights(all);
      const off = this.offset(l.def.depth);
      const offY = this.offsetY(l.def.depth);
      for (let i = before; i < all.length; i++) {
        all[i]!.x -= off;
        all[i]!.y -= offY;
      }
    }
    for (const e of this.extraLights) all.push(e);
    all.sort((a, b) => b.intensity - a.intensity);
    const lights = all.slice(0, 4);
    this.flashU.fill(0);
    this.flashC.fill(0);
    lights.forEach((li, i) => {
      this.flashU.set([li.x, li.y, li.radius, li.intensity], i * 4);
      this.flashC.set(li.colour, i * 3);
    });
  }

  private passOf(l: RL): Pass {
    return l.pass;
  }

  /** Reflection pass: mirrored layers into this backdrop's reflection target; `extra` draws more (the world's sprites). */
  renderReflection(extra?: () => void): void {
    this.poll();
    if (!this.usesReflection) return;
    const gl = this.gl;
    if (this.refl.color.w !== FRAME.w) {
      // the frame changed width (the window's shape changed): rebuild the reflection target
      gl.deleteFramebuffer(this.refl.fbo);
      gl.deleteTexture(this.refl.color.tex);
      this.refl = makeTarget(gl, FRAME.w, FRAME.h);
    }
    this.gatherLights();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.refl.fbo);
    gl.viewport(0, 0, FRAME.w, FRAME.h);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    for (const l of this.layers) if (l.def.reflect !== undefined) this.draw(l, l.def.reflect);
    gl.disable(gl.SCISSOR_TEST);
    if (extra) extra();
  }

  /** Draws one pass of layers into the bound target (the caller binds it). */
  render(target: Target, pass: Pass): void {
    const gl = this.gl;
    this.poll();
    if (pass === "back") {
      this.stats.draws = 0;
      this.stats.points = 0;
      this.gatherLights();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, FRAME.w, FRAME.h);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    for (const l of this.layers) if (this.passOf(l) === pass) this.draw(l, -1);
    gl.disable(gl.SCISSOR_TEST);
  }

  private draw(l: RL, mirror: number): void {
    const gl = this.gl;
    const d = l.def;
    if (d.kind === "character" || !l.p.ok) return;
    if ((d.opacity ?? 1) <= 0.001) return;
    const off = this.offset(d.depth);
    const offY = this.offsetY(d.depth);
    // the waterline is in layer space; on screen it moves with the layer's vertical offset
    const m = mirror >= 0 ? mirror - offY : -1;
    if (!this.scissor(l, off, offY, m)) return;
    gl.useProgram(l.p.prog);
    const u = l.p.u;
    const s1 = (n: string, v: number): void => {
      const loc = u[n];
      if (loc) gl.uniform1f(loc, v);
    };
    const s2 = (n: string, a: number, b: number): void => {
      const loc = u[n];
      if (loc) gl.uniform2f(loc, a, b);
    };
    s2("uRes", this.W, this.H);
    if (u.uFrame) gl.uniform4f(u.uFrame, this.frameAt[0], this.frameAt[1], FRAME.w, FRAME.h);
    s2("uOff", off, 0);
    s2("uVOff", 0, offY);
    s1("uCamY", this.camY * this.o.vertical);
    s1("uMirror", m);
    s1("uWl", this.waterRow);
    s1("uTime", this.time % 4096);
    s1("uFog", l.fog);
    s1("uDepth", Number.isFinite(d.depth) ? d.depth : 1e9);
    s1("uPar", Number.isFinite(d.depth) ? 1 / d.depth : 0);
    s1("uReduced", this.reduced ? 1 : 0);
    s1("uCam", this.camX);
    s1("uHalf", this.span / 2);
    s1("uDither", d.dither ?? 0);
    s1("uOpacity", d.opacity ?? 1);
    s1("uReflFade", mirror >= 0 ? (d.reflectFade ?? 0) : 0);
    s1("uReflDim", mirror >= 0 ? (d.reflectDim ?? 0) : 0);
    const w = this.wx;
    if (u.uWx) gl.uniform4f(u.uWx, w.rain, w.wind, w.mist, w.dark);
    if (u.uWx2) gl.uniform4f(u.uWx2, w.flash, w.time % 4096, w.overcast, w.after);
    if (u.uBolt) gl.uniform4f(u.uBolt, w.bolt[0], w.bolt[1], w.bolt[2], w.bolt[3]);
    if (u.uFlash) gl.uniform4fv(u.uFlash, this.flashU);
    if (u.uFlashC) gl.uniform3fv(u.uFlashC, this.flashC);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.pal.tex.tex);
    if (u.uPal) gl.uniform1i(u.uPal, 0);
    if (l.tex) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, l.tex.tex);
      if (u.uTex) gl.uniform1i(u.uTex, 1);
      s2("uTexOrigin", l.origin[0], l.origin[1]);
      s2("uTexSize", l.tex.w, l.tex.h);
      s1("uRepeat", l.repeat ? 1 : 0);
    }
    if (d.kind === "glsl" && d.usesReflection) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.refl.color.tex);
      if (u.uRefl) gl.uniform1i(u.uRefl, 2);
    }
    if (d.worldBlend === "mul") gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ZERO, gl.ONE);
    else if (d.blend === "add") gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
    else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);

    if (d.kind === "points") {
      this.pointN = 0;
      const data = this.pointData;
      const cap = data.length / 8;
      d.system.draw({
        push: (x, y, size, shape, row, shade, frame, alpha) => {
          if (this.pointN >= cap) return;
          data.set([Math.round(x) - off, Math.round(y) - offY, size, shape, row, shade, frame, alpha], this.pointN * 8);
          this.pointN++;
        },
      });
      if (this.pointN === 0) return;
      gl.bindVertexArray(this.pointVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, this.pointN * 8);
      gl.drawArrays(gl.POINTS, 0, this.pointN);
      this.stats.points += this.pointN;
    } else {
      gl.bindVertexArray(this.emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    this.stats.draws++;
  }

  private scissor(l: RL, off: number, offY: number, mirror: number): boolean {
    const gl = this.gl;
    const d = l.def;
    let b: { x0: number; y0: number; x1: number; y1: number } | null = null;
    if (l.tex) b = l.box ? { ...l.box } : { x0: l.origin[0], y0: l.origin[1], x1: l.origin[0] + l.tex.w, y1: l.origin[1] + l.tex.h };
    if (d.bounds) {
      const bb = d.bounds;
      b = { x0: bb.x0 ?? -1e6, y0: bb.y0, x1: bb.x1 ?? 1e6, y1: bb.y1 };
    }
    if (l.repeat && b) {
      b.x0 = -1e6;
      b.x1 = 1e6;
    }
    if (!b || d.kind === "points") {
      gl.disable(gl.SCISSOR_TEST);
      return true;
    }
    const [ax, ay] = this.frameAt;
    const x0 = Math.max(0, Math.floor(b.x0 - off) + ax);
    const x1 = Math.min(FRAME.w, Math.ceil(b.x1 - off) + ax);
    let y0 = b.y0 - offY;
    let y1 = b.y1 - offY;
    if (mirror >= 0) {
      const m0 = 2 * mirror - y1;
      const m1 = 2 * mirror - y0;
      y0 = Math.max(m0, mirror);
      y1 = m1 + 1;
    }
    const sy0 = Math.max(0, Math.floor(y0) + ay);
    const sy1 = Math.min(FRAME.h, Math.ceil(y1) + ay);
    if (x1 <= x0 || sy1 <= sy0) return false;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x0, FRAME.h - sy1, x1 - x0, sy1 - sy0);
    return true;
  }

  layerNames(): string[] {
    return this.layers.map((l) => `${l.def.name} (${l.def.kind}, depth ${l.def.depth}, ${this.passOf(l)})`);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    for (const l of this.layers) if (l.tex) gl.deleteTexture(l.tex.tex);
    for (const p of this.programs.values()) {
      gl.deleteProgram(p.prog);
      if (!p.ok) {
        gl.deleteShader(p.vs);
        gl.deleteShader(p.fs);
      }
    }
    this.programs.clear();
    this.layers = [];
    gl.deleteTexture(this.pal.tex.tex);
    gl.deleteFramebuffer(this.refl.fbo);
    gl.deleteTexture(this.refl.color.tex);
    gl.deleteBuffer(this.pointBuf);
    gl.deleteVertexArray(this.pointVao);
  }
}

function solidBox(data: Uint8Array, w: number, h: number): [number, number, number, number] | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

function fogGlsl(fog: FogSpec): string {
  const stops = [...fog.stops].sort((a, b) => a[0] - b[0]);
  const col = (h: Hex): string => {
    const [r, g, b] = hex(h);
    return `vec3(${f(r / 255)}, ${f(g / 255)}, ${f(b / 255)})`;
  };
  const mixes = stops
    .slice(1)
    .map(([y, c], i) => {
      const y0 = stops[i]![0];
      return `  c = mix(c, ${col(c)}, clamp((y - ${f(y0)}) / ${f(Math.max(1e-4, y - y0))}, 0.0, 1.0));`;
    })
    .join("\n");
  const g = fog.glow;
  return /* glsl */ `
vec3 fogBase(float y) {
  vec3 c = ${col(stops[0]![1])};
${mixes}
  return c;
}
float fogAt(float d) {
  if (d <= 1.0) return 0.0;
  if (d > 1e6) return ${f(fog.max)};
  return ${f(fog.max)} * (1.0 - exp(-${f(fog.density)} * (d - 1.0)));
}
vec3 fogColor(vec2 s) {
  float y = s.y / uRes.y;
  vec3 c = fogBase(stepd(y, ${f(fog.bands ?? 16)}, s, ${f(fog.dither ?? 0.85)}));
  ${
    g
      ? `vec2 gd = (s / uRes.y - vec2(${f(g.x)} * uRes.x / uRes.y, ${f(g.y)})) / ${f(g.r)};
  float gr = length(gd);
  float gv = ${f(g.strength)} * stepd(pow(max(0.0, 1.0 - gr), 2.0), ${f(g.steps ?? 6)}, s, ${f(g.dither ?? 0.8)});
  c = mix(c, ${col(g.colour)}, gv);`
      : ""
  }
  return c;
}`;
}
