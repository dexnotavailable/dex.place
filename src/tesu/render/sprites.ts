// Things that move on a background plane (a Walker wading the far shore, kites, a boat):
// animated frames drawn with their plane's transform, haze and mirror, so they parallax,
// fade and reflect exactly like the plate they stand on. Frames are painted on demand at
// the level the camera needs (or loaded from a render later) and kept as RGBA textures.

import { compile, uniforms } from "../../lab/engine/gl.ts";
import { painter } from "../art/painter.ts";
import type { SpriteDone, SpriteJob } from "../plates/store.ts";
import { PLANES, type SpriteDef } from "../world/types.ts";
import { paintSpriteFrame, type SpritePixels } from "./sprite-paint.ts";
import { SHOW_GLSL, type PlaneLook } from "./planes.ts";
import { REDUCE_CONST_GLSL, REDUCE_RGBA_GLSL } from "./reduce.ts";
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
uniform vec4 uGrade;                  // rgb multiply, amount (the place's light, as on the planes)
uniform vec4 uRectF;                  // the drawn rect, frame px (y down), unmirrored
uniform float uCell;                  // (round 5) frame px per art cell: 2 at the catch's 2x for sky and far
uniform vec2 uFoot;                   // (round 5) haze thickening to its foot: share of its height, haze there
uniform float uFlip;
uniform float uShow;                  // (round 6) share of the plane shown: a dissolve below 1 (as on the plates; round 7: in clumps)
uniform vec3 uShowAt;                 // (round 7) the plane's frame offset and scale (render/planes.ts SHOW_GLSL)
out vec4 o;
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  int k = i.x + i.y * 4;
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[k] + 0.5) / 16.0;
}
${SHOW_GLSL}
${REDUCE_CONST_GLSL}
${REDUCE_RGBA_GLSL}
void main() {
  if (hiddenByShow()) discard;
  if (uMirror >= 0.0 && uRes.y - gl_FragCoord.y < uMirror) discard;
  if (vS > uReveal) discard;
  vec2 uv = vUV;
  vec2 cell = floor(vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uCell);
  if (uCell > 1.5) {
    // snapped to the frame's art cells: the texel under each cell's centre fills the cell
    vec2 f = (cell + 0.5) * uCell;
    if (uMirror >= 0.0) f.y = 2.0 * uMirror - f.y;
    vec2 k = vec2((f.x - uRectF.x) / (uRectF.z - uRectF.x), (f.y - uRectF.y) / (uRectF.w - uRectF.y));
    uv = vec2(uFlip > 0.5 ? 1.0 - k.x : k.x, k.y) * uSize;
  }
  vec4 c;
  vec2 inv = uSize / max(uRectF.zw - uRectF.xy, vec2(1.0));
  if (uCell <= 1.5 && inv.x > 1.001) {
    // (engine 10-18) drawn smaller than its own density (zoomed out between levels, or a set at a coarser level):
    // the palette-keeping reduction of the texels each frame px covers (render/reduce.ts), anchored to the drawn rect
    float row = uRes.y - gl_FragCoord.y;
    float cy = uMirror >= 0.0 ? 2.0 * uMirror - row : row;
    vec2 a0 = (vec2(floor(gl_FragCoord.x), floor(cy)) - uRectF.xy) * inv;
    if (uFlip > 0.5) a0.x = uSize.x - a0.x - inv.x;
    c = reduceRGBA(uTex, ivec2(uSize), a0, a0 + inv, true);
    if (c.r < 0.0) discard;
    uv = a0 + inv * 0.5;
  } else {
    ivec2 t = clamp(ivec2(floor(uv)), ivec2(0), ivec2(uSize) - 1);
    c = texelFetch(uTex, t, 0);
    if (c.a < 0.5) discard;
  }
  vec3 col = mix(c.rgb, c.rgb * uGrade.rgb, uGrade.a);
  float fade = uFade;
  if (uFoot.x > 0.0) {
    // the haze thickening down to its foot: one continuous falloff in fine flat steps, each
    // step's edge ordered-dithered on the cell (no strata across the legs)
    float k = clamp(1.0 - (uSize.y - uv.y) / (uSize.y * uFoot.x), 0.0, 1.0);
    float v = k * k * (3.0 - 2.0 * k) * 12.0;
    float st = (floor(v) + step(bayer4(cell), fract(v))) / 12.0;
    fade = mix(uFade, uFoot.y, st);
  }
  col = mix(col, uHaze, fade);
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
  /** (round 7) Its frame index and level (a stand-in drawn at its own density while another paints). */
  f?: number;
  lv?: number;
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
          this.landed++;
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
  private paintedThisFrame = 0;
  /**
   * (round 7, performance) Paints a frame off the main thread (the plate workers): false when it
   * cannot. A painted sprite's frame cost the page 1-170 ms on its main thread, and every sprite in
   * view needed a new one at once whenever the camera's zoom crossed a level (the opening's
   * pull-back, the postcard): the walk's long frames were all this. Unset for deterministic captures
   * (?manual) and when there are no workers: frames are then painted here, as before.
   */
  async: ((job: SpriteJob, done: (r: SpriteDone | null) => void) => boolean) | null = null;
  private asking = new Set<string>();
  private noAsync = new Set<string>();
  /** A sprite's painted frames (its stand-ins while one it needs is being painted). */
  private byDef = new Map<string, Frame[]>();
  /** Frames that arrived from the workers and the frame sets since the page began (tools read it). */
  landed = 0;

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
  private bounds = new Map<SpriteDef, { p: Record<string, unknown>; b: [number, number, number, number] }>();
  /** A painted sprite's bounds in level-1 px around its anchor (kept until its params change). */
  private boundsOf(def: SpriteDef): [number, number, number, number] {
    const have = this.bounds.get(def);
    if (have && have.p === def.p) return have.b;
    const b = painter(def.kind).bounds({ ...def.p, frame: 0 });
    this.bounds.set(def, { p: def.p, b });
    return b;
  }

  private frame(def: SpriteDef, f: number, level: number, force: boolean): Frame | null {
    const key = `${def.id}|${f}|${level}`;
    const have = this.frames.get(key);
    if (have !== undefined) return have;
    if (def.kind === "image") return this.imageFrame(def, level, key);
    if (!force && this.async && !this.noAsync.has(key)) {
      if (!this.asking.has(key)) {
        const ok = this.async({ key, kind: def.kind, p: def.p, seed: def.seed, frame: f, level }, (res) => {
          this.asking.delete(key);
          if (!res) { this.noAsync.add(key); return; }
          if (!this.frames.has(key)) this.keep(def, key, this.upload(res, f, level));
          this.landed++;
        });
        if (ok) this.asking.add(key);
        else this.noAsync.add(key);
      }
      if (this.asking.has(key)) return null;
    }
    if (!force && this.paintedThisFrame >= 1) return null;
    this.paintedThisFrame++;
    return this.keep(def, key, this.upload(paintSpriteFrame(def.kind, def.p, def.seed, f, level), f, level));
  }

  private keep(def: SpriteDef, key: string, fr: Frame): Frame {
    this.frames.set(key, fr);
    const a = this.byDef.get(def.id);
    if (a) a.push(fr);
    else this.byDef.set(def.id, [fr]);
    return fr;
  }

  private upload(px: SpritePixels | SpriteDone, f: number, level: number): Frame {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, px.w, px.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px.rgba);
    return { tex, w: px.w, h: px.h, ax: px.ax, ay: px.ay, f, lv: level };
  }

  /**
   * (round 7) While a frame is being painted in a worker: the nearest frame of the same sprite already
   * painted, at this level first (the frame before it in its cycle), else the same frame at the level
   * nearest this one (drawn at its own density for a moment), else any.
   */
  private standIn(def: SpriteDef, f: number, level: number): Frame | null {
    const a = this.byDef.get(def.id);
    if (!a?.length) return null;
    const n = Math.max(1, def.frames ?? 1);
    let best: Frame | null = null, score = Infinity;
    for (const fr of a) {
      const back = ((f - (fr.f ?? 0)) % n + n) % n;
      const sc = (fr.lv === level ? 0 : 1000 + Math.abs(Math.log((fr.lv ?? level) / level)) * 100) + back;
      if (sc < score) { score = sc; best = fr; }
    }
    return best;
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
    if (u.uGrade) gl.uniform4fv(u.uGrade, look.grade);
    gl.uniform1f(u.uFade!, look.fade);
    gl.uniform3fv(u.uInk!, look.ink);
    gl.uniform1f(u.uInkAmt!, look.inkAmt);
    gl.uniform1f(u.uShow!, look.show ?? 1);
    if (u.uShowAt) gl.uniform3fv(u.uShowAt, look.showAt ?? [0, 0, 1]);
    gl.bindVertexArray(this.vao);
    for (const def of defs) {
      if (def.hidden) continue;
      const rate = PLANES[def.plane].rate;
      const xf = planeXf(cam, rate);
      // (round 5; round 6: and the mid plane's, like its plates) at the catch's 2x the sky's and the far plane's sprites sit on the frame's 2 px
      // art cells like everything near (painted ones are painted at half the density for it)
      // (round 7, density: and the back plane's, as its plates)
      const snap = cam.zoom >= 1.9 && (def.plane === "sky" || def.plane === "far" || def.plane === "mid" || def.plane === "back");
      let level = levelFor(planeLevels(rate), xf.g) / (snap && def.kind !== "frames" && def.kind !== "image" ? 2 : 1);
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
      } else {
        // a painted sprite well off the frame is not painted at all (its painter's bounds, a
        // quarter-frame margin): many small animated sprites cost nothing until they come near
        const [bx0, by0, bx1, by1] = this.boundsOf(def);
        const g = xf.g, ax = pos.x * rate * g + xf.offX, ay = pos.y * rate * g + xf.offY;
        const sx0 = pos.flip ? ax - bx1 * g : ax + bx0 * g, sx1 = pos.flip ? ax - bx0 * g : ax + bx1 * g;
        const mx = cam.W * 0.25, my = cam.H * 0.25;
        if (sx1 < -mx || sx0 > cam.W + mx) continue;
        if (mirror === null && (ay + by1 * g < -my || ay + by0 * g > cam.H + my)) continue;
        fr = this.frame(def, pos.frame, level, force);
        if (!fr) {
          if (force || !this.async) fr = this.frame(def, 0, level, true);
          else {
            // (round 7) frame 0 at this level, asked for too, or a stand-in while they paint; a sprite
            // with nothing painted yet holds the first scene back (like its plates)
            fr = this.frame(def, 0, level, false) ?? this.standIn(def, pos.frame, level);
            if (!fr) this.waitingNow++;
            else if (fr.lv !== undefined) level = fr.lv;
          }
        }
      }
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
      // (a giant set deep in the distance takes its own haze; everything else its plane's)
      gl.uniform1f(u.uFade!, def.fade ?? look.fade);
      gl.uniform1f(u.uWhite!, def.white ?? 0);
      const rx0 = Math.round(x0), ry0 = Math.round(y0), rx1 = rx0 + Math.round(fr.w * k), ry1 = ry0 + Math.round(fr.h * k);
      gl.uniform4f(u.uRect!, rx0, ry0, rx1, ry1);
      if (u.uRectF) gl.uniform4f(u.uRectF, rx0, ry0, rx1, ry1);
      if (u.uCell) gl.uniform1f(u.uCell, snap ? 2 : 1);
      if (u.uFoot) gl.uniform2f(u.uFoot, def.fadeFoot?.[0] ?? 0, def.fadeFoot?.[1] ?? 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}
