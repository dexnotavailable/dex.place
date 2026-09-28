// The layered scene renderer. Every layer is drawn back to front into one
// low-res target (640x360 "near" or 960x540 "far"), then that target is shown
// at the largest whole-number scale that fits the window, letterboxed in black.
// Layers that declare a waterline are also drawn mirrored into a reflection
// target first, which water layers sample. Nothing is ever filtered: every
// texture is NEAREST, every offset a whole pixel.

import { buildStandin } from "./character.ts";
import { Camera } from "./camera.ts";
import { FlashGate } from "./flashes.ts";
import { compile, dataTexture, freeTarget, target, uniforms, type Target, type Texture } from "./gl.ts";
import { BLIT_FS, DEFAULT_PRELUDE, FULL_VS, HEADER, LIB, LIB_FOG, MAIN, POINT_BODY, POINT_VS } from "./glsl.ts";
import { f } from "./layers.ts";
import { mulberry } from "./noise.ts";
import { buildPalette, hex, paletteDefines, type Hex, type Palette } from "./palette.ts";
import { RESOLUTIONS, type BuildCtx, type FogSpec, type LayerDef, type LightOut, type Mode, type SceneDef, type SimEnv } from "./types.ts";

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

interface RL {
  def: LayerDef;
  /** Tight layer-space box of a Pix layer's solid texels. */
  box?: { x0: number; y0: number; x1: number; y1: number };
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation>;
  tex?: Texture;
  origin: [number, number];
  repeat: boolean;
  fog: number;
  points: boolean;
}

export interface EngineStats {
  layers: number;
  draws: number;
  points: number;
  buildMs: number;
}

export class Engine {
  readonly gl: WebGL2RenderingContext;
  mode: Mode = "near";
  W = 640;
  H = 360;
  readonly camera = new Camera();
  time = 0;
  reduced = false;
  showChar = true;
  paused = false;
  /** Debug: only draw layers whose name is in solo (if non-empty); never draw hidden ones. */
  solo = new Set<string>();
  hidden = new Set<string>();
  /** Output rect in device pixels (bottom-left origin) and integer scale. */
  out = { x: 0, y: 0, scale: 1 };
  stats: EngineStats = { layers: 0, draws: 0, points: 0, buildMs: 0 };

  private def: SceneDef | null = null;
  private id = "";
  private layers: RL[] = [];
  private pal: Palette | null = null;
  private main: Target | null = null;
  private refl: Target | null = null;
  private programs = new Map<string, { prog: WebGLProgram; u: Record<string, WebGLUniformLocation> }>();
  private blit: { prog: WebGLProgram; u: Record<string, WebGLUniformLocation> };
  private emptyVao: WebGLVertexArrayObject;
  private pointVao: WebGLVertexArrayObject;
  private pointBuf: WebGLBuffer;
  private pointData = new Float32Array(8 * 8192);
  private pointN = 0;
  private gate = new FlashGate();
  private ctx: BuildCtx | null = null;
  private lights: LightOut[] = [];
  private flashU = new Float32Array(16);
  private flashC = new Float32Array(12);
  private input = { dir: 0, drag: 0 };

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false });
    if (!gl) throw new Error("This page needs WebGL2.");
    this.gl = gl;
    const bp = compile(gl, FULL_VS, BLIT_FS, "blit");
    this.blit = { prog: bp, u: uniforms(gl, bp) };
    this.emptyVao = gl.createVertexArray()!;
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
  }

  get sceneId(): string {
    return this.id;
  }

  setScene(id: string, def: SceneDef): void {
    this.id = id;
    this.def = def;
    this.time = 0;
    this.gate.reset();
    this.camera.span = 0;
    this.build();
    this.camera.period = def.driftPeriod ?? 70;
    this.camera.center();
  }

  setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.def) this.build();
  }

  setInput(dir: number, drag: number): void {
    this.input.dir = dir;
    this.input.drag += drag;
  }

  fogAt(depth: number): number {
    const fog = this.def!.fog;
    if (depth <= 1) return 0;
    if (!Number.isFinite(depth)) return fog.max;
    return fog.max * (1 - Math.exp(-fog.density * (depth - 1)));
  }

  private build(): void {
    const t0 = performance.now();
    const gl = this.gl;
    const def = this.def!;
    const [W, H] = RESOLUTIONS[this.mode];
    this.W = W;
    this.H = H;
    for (const l of this.layers) if (l.tex) gl.deleteTexture(l.tex.tex);
    for (const p of this.programs.values()) gl.deleteProgram(p.prog);
    this.programs.clear();
    this.layers = [];
    if (this.main) freeTarget(gl, this.main);
    if (this.refl) freeTarget(gl, this.refl);
    this.main = target(gl, W, H);
    this.refl = target(gl, W, H);
    if (this.pal) gl.deleteTexture(this.pal.tex.tex);

    const ramps = { standin: DEFAULT_STANDIN, ...def.palette };
    const pal = buildPalette(gl, ramps);
    this.pal = pal;
    const span = Math.round(def.span ? def.span(W, H) : W * 0.5);
    this.camera.setSpan(span);
    let seed = 0;
    for (const ch of this.id) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
    const rng = mulberry(seed ^ 0x5eed);
    const ctx: BuildCtx = {
      mode: this.mode,
      W,
      H,
      u: H / 360,
      span,
      row: (name) => {
        const r = pal.rows[name];
        if (r === undefined) throw new Error(`palette has no ramp "${name}"`);
        return r;
      },
      par: (d) => (Number.isFinite(d) ? 1 / d : 0),
      panWidth: (d) => W + Math.ceil(span * (Number.isFinite(d) ? 1 / d : 0)) + 2,
      fogAt: (d) => this.fogAt(d),
      rng,
    };
    this.ctx = ctx;

    let prelude = def.prelude ? def.prelude(ctx) : DEFAULT_PRELUDE;
    if (!/float\s+sceneLight\s*\(/.test(prelude)) prelude += DEFAULT_PRELUDE;
    const head = [HEADER, paletteDefines(pal), LIB, fogGlsl(def.fog), LIB_FOG, prelude].join("\n");
    const program = (key: string, vs: string, fs: string, name: string) => {
      let p = this.programs.get(key);
      if (!p) {
        const prog = compile(gl, vs, fs, `${this.id}/${name}`);
        p = { prog, u: uniforms(gl, prog) };
        this.programs.set(key, p);
      }
      return p;
    };

    for (const l of def.build(ctx)) {
      const fog = l.fog ?? this.fogAt(l.depth);
      if (l.kind === "points") {
        const p = program("points", POINT_VS, `${head}\n${POINT_BODY}`, l.name);
        this.layers.push({ def: l, ...p, origin: [0, 0], repeat: false, fog, points: true });
        continue;
      }
      if (l.kind === "glsl") {
        const p = program(`glsl:${l.body}`, FULL_VS, `${head}\n${l.body}\n${MAIN}`, l.name);
        this.layers.push({ def: l, ...p, origin: [0, 0], repeat: false, fog, points: false });
        continue;
      }
      const tw = l.kind === "pix" ? (l.twinkle ?? 0) : 0;
      const p = program(`pix:${tw}`, FULL_VS, `${head}\n${PIX_BODY(tw)}\n${MAIN}`, l.name);
      if (l.kind === "pix") {
        const tex = dataTexture(gl, l.pix.w, l.pix.h, l.pix.data);
        const bb = solidBox(l.pix.data, l.pix.w, l.pix.h);
        const box = bb ? { x0: l.x + bb[0], y0: l.y + bb[1], x1: l.x + bb[2], y1: l.y + bb[3] } : { x0: 0, y0: 0, x1: 0, y1: 0 };
        this.layers.push({ def: l, ...p, tex, box, origin: [l.x, l.y], repeat: !!l.repeatX, fog, points: false });
      } else {
        const st = buildStandin(ctx.row("standin"), l.rimDir ?? [1, -1], l.facing ?? 1);
        const tex = dataTexture(gl, st.pix.w, st.pix.h, st.pix.data);
        this.layers.push({ def: l, ...p, tex, origin: [l.x - st.ax, l.ground - st.ay], repeat: false, fog, points: false });
      }
    }
    this.stats.layers = this.layers.length;
    this.stats.buildMs = Math.round(performance.now() - t0);
  }

  /** Advance scene time and simulations. */
  update(dt: number): void {
    if (!this.def || !this.ctx) return;
    dt = Math.min(dt, 0.1);
    const drag = this.input.drag;
    this.input.drag = 0;
    this.camera.update(dt, this.input.dir, drag, this.reduced);
    if (this.paused) return;
    this.time += dt;
    const env: SimEnv = { t: this.time, reduced: this.reduced, ctx: this.ctx, flashGate: () => this.gate.allow(this.time, this.reduced) };
    for (const l of this.layers) if (l.def.kind === "points") l.def.system.update(dt, env);
  }

  private gatherLights(): void {
    const all: LightOut[] = [];
    for (const l of this.layers) {
      if (l.def.kind !== "points" || !l.def.system.lights) continue;
      const before = all.length;
      l.def.system.lights(all);
      const off = this.camera.offset(l.def.depth);
      for (let i = before; i < all.length; i++) all[i]!.x -= off;
    }
    all.sort((a, b) => b.intensity - a.intensity);
    this.lights = all.slice(0, 4);
    this.flashU.fill(0);
    this.flashC.fill(0);
    this.lights.forEach((li, i) => {
      this.flashU.set([li.x, li.y, li.radius, li.intensity], i * 4);
      this.flashC.set(li.colour, i * 3);
    });
  }

  render(): void {
    const gl = this.gl;
    if (!this.def || !this.main || !this.refl || !this.pal) return;
    this.stats.draws = 0;
    this.stats.points = 0;
    this.gatherLights();
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.viewport(0, 0, this.W, this.H);

    gl.disable(gl.SCISSOR_TEST);
    const needsRefl = this.layers.some((l) => l.def.kind === "glsl" && l.def.usesReflection);
    if (needsRefl) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.refl.fbo);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      for (const l of this.layers) if (l.def.reflect !== undefined) this.draw(l, l.def.reflect);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.main.fbo);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const l of this.layers) this.draw(l, -1);

    // present
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const scale = Math.max(1, Math.floor(Math.min(cw / this.W, ch / this.H)));
    const ox = Math.floor((cw - this.W * scale) / 2);
    const oy = Math.floor((ch - this.H * scale) / 2);
    this.out = { x: ox, y: oy, scale };
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(ox, oy, this.W * scale, this.H * scale);
    gl.useProgram(this.blit.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.main.color.tex);
    gl.uniform1i(this.blit.u.uSrc!, 0);
    gl.uniform4f(this.blit.u.uRect!, ox, oy, scale, 0);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private draw(l: RL, mirror: number): void {
    const gl = this.gl;
    const d = l.def;
    if (d.kind === "character" && !this.showChar) return;
    if (this.hidden.has(d.name) || (this.solo.size > 0 && !this.solo.has(d.name))) return;
    const off = this.camera.offset(d.depth);
    if (!this.scissor(l, off, mirror)) return;
    gl.useProgram(l.prog);
    const u = l.u;
    const s1 = (n: string, v: number): void => {
      const loc = u[n];
      if (loc) gl.uniform1f(loc, v);
    };
    const s2 = (n: string, a: number, b: number): void => {
      const loc = u[n];
      if (loc) gl.uniform2f(loc, a, b);
    };
    s2("uRes", this.W, this.H);
    s2("uOff", off, 0);
    s1("uMirror", mirror);
    s1("uTime", this.time % 4096);
    s1("uFog", l.fog);
    s1("uDepth", Number.isFinite(d.depth) ? d.depth : 1e9);
    s1("uPar", Number.isFinite(d.depth) ? 1 / d.depth : 0);
    s1("uReduced", this.reduced ? 1 : 0);
    s1("uCam", this.camera.x);
    s1("uHalf", this.camera.span / 2);
    s1("uDither", d.dither ?? 0);
    s1("uOpacity", d.opacity ?? 1);
    if (u.uFlash) gl.uniform4fv(u.uFlash, this.flashU);
    if (u.uFlashC) gl.uniform3fv(u.uFlashC, this.flashC);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.pal!.tex.tex);
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
      gl.bindTexture(gl.TEXTURE_2D, this.refl!.color.tex);
      if (u.uRefl) gl.uniform1i(u.uRefl, 2);
    }
    if (d.blend === "add") gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
    else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);

    if (d.kind === "points") {
      this.pointN = 0;
      const data = this.pointData;
      const cap = data.length / 8;
      d.system.draw({
        push: (x, y, size, shape, row, shade, frame, alpha) => {
          if (this.pointN >= cap) return;
          data.set([Math.round(x) - off, Math.round(y), size, shape, row, shade, frame, alpha], this.pointN * 8);
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

  /** Scissor to the layer's box on screen; false when it is entirely off screen. */
  private scissor(l: RL, off: number, mirror: number): boolean {
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
    const x0 = Math.max(0, Math.floor(b.x0 - off));
    const x1 = Math.min(this.W, Math.ceil(b.x1 - off));
    let y0 = b.y0;
    let y1 = b.y1;
    if (mirror >= 0) {
      const m0 = 2 * mirror - y1;
      const m1 = 2 * mirror - y0;
      y0 = Math.max(m0, mirror);
      y1 = m1 + 1;
    }
    const sy0 = Math.max(0, Math.floor(y0));
    const sy1 = Math.min(this.H, Math.ceil(y1));
    if (x1 <= x0 || sy1 <= sy0) return false;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x0, this.H - sy1, x1 - x0, sy1 - sy0);
    return true;
  }

  /** The low-res frame as top-down RGBA. */
  capture(): { w: number; h: number; data: Uint8Array } {
    const gl = this.gl;
    const w = this.W;
    const h = this.H;
    const buf = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.main!.fbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) out.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return { w, h, data: out };
  }

  layerNames(): string[] {
    return this.layers.map((l) => `${l.def.name} (${l.def.kind}, depth ${l.def.depth}, fog ${l.fog.toFixed(2)})`);
  }
}

/** Bounding box [x0, y0, x1, y1) of texels with alpha, or null if none. */
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
