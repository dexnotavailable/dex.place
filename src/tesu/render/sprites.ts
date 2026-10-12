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
out float vS;
const vec2 C[6] = vec2[6](vec2(0,0), vec2(1,0), vec2(1,1), vec2(0,0), vec2(1,1), vec2(0,1));
void main() {
  vec2 c = C[gl_VertexID];
  vec2 p = mix(uRect.xy, uRect.zw, c);
  if (uMirror >= 0.0) p.y = 2.0 * uMirror - p.y;
  vUV = vec2(uFlip > 0.5 ? 1.0 - c.x : c.x, c.y) * uSize;
  vS = c.x;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
in float vS;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uReveal;
uniform float uWhite;
uniform vec3 uHaze;
uniform float uFade;
uniform vec3 uInk;
uniform float uInkAmt;
uniform float uMirror;
uniform vec2 uRes;
out vec4 o;
void main() {
  if (uMirror >= 0.0 && uRes.y - gl_FragCoord.y < uMirror) discard;
  if (vS > uReveal) discard;
  ivec2 t = clamp(ivec2(floor(vUV)), ivec2(0), ivec2(uSize) - 1);
  vec4 c = texelFetch(uTex, t, 0);
  if (c.a < 0.5) discard;
  vec3 col = mix(c.rgb, uHaze, uFade);
  col = mix(col, uInk, uInkAmt);
  col = mix(col, vec3(1.0), uWhite);
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

/** A rendered frame set (kind "frames"): files `${base}NN.webp` and `${base}manifest.json`. */
interface FrameSet {
  /** Art density of this set (1: the plane's play-zoom density; 0.5 half of it). */
  level: number;
  base: string;
}

interface SetManifest {
  count: number;
  w: number;
  h: number;
  /** The anchor (the body's centre on the ground row) in the frame. */
  ax: number;
  ay: number;
}

interface Stream {
  man: SetManifest | null;
  manLoading: boolean;
  tex: Map<number, { fr: Frame; used: number }>;
  pending: Set<number>;
  failed: boolean;
}

/** Decoded frames kept on the GPU per set (the rest stay as small files in the browser cache). */
const STREAM_KEEP = 10;

export class SpriteRenderer {
  private streams = new Map<string, Stream>();
  private useTick = 0;

  /**
   * A rendered frame set's frame (the Walker's wade): fetched and decoded on demand, a few
   * kept as textures, the nearest one already decoded shown while the next arrives. Picks the
   * set whose density is the smallest at or above the art scale g.
   */
  private streamed(def: SpriteDef, f: number, g: number): { fr: Frame; level: number } | null {
    const sets = ((def.p.sets as FrameSet[] | undefined) ?? []).slice().sort((a, b) => b.level - a.level);
    if (!sets.length) return null;
    let set = sets[0]!;
    for (const s of sets) if (s.level >= g - 1e-3) set = s;
    let st = this.streams.get(set.base);
    if (!st) {
      st = { man: null, manLoading: false, tex: new Map(), pending: new Set(), failed: false };
      this.streams.set(set.base, st);
    }
    const s = st;
    if (s.failed) return null;
    if (!s.man) {
      if (!s.manLoading) {
        s.manLoading = true;
        fetch(`${set.base}manifest.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))).then(
          (m: SetManifest) => { s.man = m; },
          () => { s.failed = true; },
        );
      }
      return null;
    }
    const n = s.man.count;
    const want = ((f % n) + n) % n;
    const load = (i: number): void => {
      if (s.tex.has(i) || s.pending.has(i)) return;
      s.pending.add(i);
      fetch(`${set.base}${String(i).padStart(2, "0")}.webp`)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status}`))))
        .then((b) => createImageBitmap(b))
        .then((bmp) => {
          const gl = this.gl;
          const tex = gl.createTexture()!;
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
          bmp.close();
          s.tex.set(i, { fr: { tex, w: s.man!.w, h: s.man!.h, ax: s.man!.ax, ay: s.man!.ay }, used: this.useTick });
          s.pending.delete(i);
          // keep only the most recently used few on the GPU
          if (s.tex.size > STREAM_KEEP) {
            let old = -1, oldUse = Infinity;
            for (const [k, v] of s.tex) if (v.used < oldUse && k !== want) { old = k; oldUse = v.used; }
            if (old >= 0) { gl.deleteTexture(s.tex.get(old)!.fr.tex); s.tex.delete(old); }
          }
        })
        .catch(() => { s.pending.delete(i); });
    };
    load(want);
    load((want + 1) % n);
    this.useTick++;
    let got = s.tex.get(want);
    if (!got) {
      // the nearest earlier frame already decoded stands in for a moment
      for (let d = 1; d < n && !got; d++) got = s.tex.get(((want - d) % n + n) % n);
    }
    if (!got) return null;
    got.used = this.useTick;
    return { fr: got.fr, level: set.level };
  }
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation>;
  private frames = new Map<string, Frame | null>();
  private pal = paletteRGBA();
  private paintedThisFrame = 0;

  constructor(private gl: WebGL2RenderingContext, private vao: WebGLVertexArrayObject) {
    this.prog = compile(gl, VS, FS, "tesu-sprites");
    this.u = uniforms(gl, this.prog);
  }

  /** Rendered frame sets drawn last frame that had nothing decoded yet (the world waits for them). */
  waiting = 0;
  private waitingNow = 0;

  newFrame(): void {
    this.paintedThisFrame = 0;
    this.waiting = this.waitingNow;
    this.waitingNow = 0;
  }

  private images = new Map<string, HTMLImageElement | null>();

  /**
   * A picture (the gallery's previews): the image fitted into p.w x p.h level-1 px without
   * cropping, resampled down like the website's smaller copies, then shown as pixels.
   */
  private imageFrame(def: SpriteDef, level: number, key: string): Frame | null {
    const src = String(def.p.src);
    let img = this.images.get(src);
    if (img === undefined) {
      const im = new Image();
      im.decoding = "async";
      this.images.set(src, null);
      im.onload = () => this.images.set(src, im);
      im.src = src;
      return null;
    }
    if (!img) return null;
    const bw = Number(def.p.w) * level, bh = Number(def.p.h) * level;
    const k = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const g = cv.getContext("2d")!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    const fr: Frame = { tex, w, h, ax: w / 2, ay: h };
    this.frames.set(key, fr);
    return fr;
  }

  /** A painted frame of a sprite at a level (painted now if the budget allows, else null). */
  private frame(def: SpriteDef, f: number, level: number, force: boolean): Frame | null {
    const key = `${def.id}|${f}|${level}`;
    const have = this.frames.get(key);
    if (have !== undefined) return have;
    if (def.kind === "image") return this.imageFrame(def, level, key);
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
  /** Drift speed share (reduced motion drifts at a quarter speed). */
  static driftScale = 1;

  static position(def: SpriteDef, time: number): { x: number; y: number; frame: number; flip: boolean } {
    if (def.frame !== undefined) return { x: def.x, y: def.y, frame: def.frame, flip: !!def.flip };
    // a rendered cycle moves only when its frame changes, so its planted feet stay planted
    if (def.stepMove && def.fps) time = Math.floor(time * def.fps) / def.fps;
    let x = def.x;
    let flip = false;
    if (def.drift && def.path) {
      // the wind: always east, wrapping off screen, never turning round
      const [a, b] = def.path;
      const span = Math.max(1, b - a);
      const v = (def.drift * SpriteRenderer.driftScale) / Math.max(1e-3, PLANES[def.plane].rate);
      x = a + ((((def.x - a + time * v) % span) + span) % span);
      const frame = SpriteRenderer.driftScale < 1 ? 0 : Math.floor(time * (def.fps ?? 0)) % Math.max(1, def.frames ?? 1);
      return { x, y: def.y, frame, flip };
    }
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
      if (def.hidden) continue;
      const rate = PLANES[def.plane].rate;
      const xf = planeXf(cam, rate);
      let level = levelFor(planeLevels(rate), xf.g);
      const pos = SpriteRenderer.position(def, time);
      let fr: Frame | null;
      if (def.kind === "frames") {
        // nothing is fetched or decoded for a giant out of the frame (its reach in level-1 px)
        const reach = Number(def.p.reach ?? 700) * xf.g;
        const sx = pos.x * rate * xf.g + xf.offX;
        if (sx + reach < 0 || sx - reach > cam.W) continue;
        const got = this.streamed(def, pos.frame, xf.g);
        fr = got?.fr ?? null;
        if (got) level = got.level;
        else this.waitingNow++;
      } else if (def.kind === "image") {
        // a picture is fetched only once it comes near the frame (the hall's art, far from the start)
        const sx = pos.x * rate * xf.g + xf.offX, sy = pos.y * rate * xf.g + xf.offY;
        const pw = Number(def.p.w) * xf.g, ph = Number(def.p.h) * xf.g;
        if (sx + pw < -cam.W * 0.5 || sx - pw > cam.W * 1.5 || sy < -cam.H * 0.5 || sy - ph > cam.H * 1.5) continue;
        fr = this.frame(def, pos.frame, level, force);
      } else fr = this.frame(def, pos.frame, level, force) ?? this.frame(def, 0, level, true);
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
      gl.uniform1f(u.uReveal!, def.reveal ?? 1);
      gl.uniform1f(u.uWhite!, def.white ?? 0);
      gl.uniform4f(u.uRect!, Math.round(x0), Math.round(y0), Math.round(x0) + Math.round(fr.w * k), Math.round(y0) + Math.round(fr.h * k));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}
