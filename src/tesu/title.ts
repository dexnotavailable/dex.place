// Titles (GDK 3.9): big titles land on a beat and build letter by letter, broad and clean;
// place names are small and quick, lower left. The title lane owns the font (our own pixel
// title face) and hands it over as an atlas; until then a plain placeholder face draws the
// same text in the same slot, swapped in place by setTitleFont().

import { compile, uniforms } from "../lab/engine/gl.ts";

export interface FontAtlas {
  /** The glyph sheet (white on transparent; tinted when drawn). */
  image: TexImageSource;
  /** Glyph rects in the sheet: x, y, w, h (px), and the advance after it. */
  glyphs: Record<string, [number, number, number, number, number]>;
  /** Line height in px. */
  height: number;
}

let TITLE_FONT: FontAtlas | null = null;
let FONT_VERSION = 0;

/** The title lane's font replaces the placeholder (any time; titles already showing redraw). */
export function setTitleFont(f: FontAtlas): void {
  TITLE_FONT = f;
  FONT_VERSION++;
}

/** A plain placeholder: bold sans rasterised small and hard-thresholded, so it reads as pixels. */
function placeholderLine(text: string, px: number): { canvas: HTMLCanvasElement; w: number; h: number; xs: number[] } {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const font = `900 ${px}px "Arial Black", "Segoe UI Black", system-ui, sans-serif`;
  g.font = font;
  const xs: number[] = [];
  let w = 0;
  const gap = Math.round(px * 0.18);
  for (const ch of text) {
    xs.push(w);
    w += Math.ceil(g.measureText(ch).width) + gap;
  }
  w = Math.max(1, w - gap);
  const h = Math.ceil(px * 1.15);
  c.width = w;
  c.height = h;
  g.font = font;
  g.textBaseline = "alphabetic";
  g.fillStyle = "#fff";
  [...text].forEach((ch, i) => g.fillText(ch, xs[i]!, Math.round(px * 0.95)));
  const img = g.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3]! > 110 ? 255 : 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = a;
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, w, h, xs };
}

const VS = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uRect;
uniform vec2 uRes;
out vec2 vUV;
const vec2 C[6] = vec2[6](vec2(0,0), vec2(1,0), vec2(1,1), vec2(0,0), vec2(1,1), vec2(0,1));
void main() {
  vec2 c = C[gl_VertexID];
  vec2 p = mix(uRect.xy, uRect.zw, c);
  vUV = c;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform vec4 uColour;
uniform vec3 uShade;
uniform float uReveal;   // 0..1 across the line (letters build left to right)
uniform float uLetters;  // letter count, for the build
uniform float uAlpha;
out vec4 o;
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 4.0));
  int k = i.x + i.y * 4;
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[k] + 0.5) / 16.0;
}
void main() {
  ivec2 t = clamp(ivec2(floor(vUV * uSize)), ivec2(0), ivec2(uSize) - 1);
  float a = texelFetch(uTex, t, 0).a;
  if (a < 0.5) discard;
  // the build: each column appears once the reveal passes it, a stepped wipe
  float col = vUV.x;
  if (col > uReveal) discard;
  if (bayer4(gl_FragCoord.xy) > uAlpha) discard;
  // broad and clean: a light face, a slightly darker lower third (no outline)
  vec3 c = vUV.y > 0.66 ? uShade : uColour.rgb;
  o = vec4(c, 1.0);
}`;

interface Card {
  text: string;
  big: boolean;
  t: number;
  /** Seconds: build, hold, fade. */
  build: number;
  hold: number;
  fade: number;
  tex: WebGLTexture | null;
  w: number;
  h: number;
  version: number;
}

export class Titles {
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation>;
  private cards: Card[] = [];
  /** Titles fired this visit (each big title fires once). */
  readonly fired = new Set<string>();
  reducedMotion = false;

  constructor(private gl: WebGL2RenderingContext, private vao: WebGLVertexArrayObject) {
    this.prog = compile(gl, VS, FS, "tesu-title");
    this.u = uniforms(gl, this.prog);
  }

  /** A big title (TESU, SHANSHUI ...) or a place name. */
  show(text: string, big: boolean): void {
    this.cards = this.cards.filter((c) => c.big !== big);
    this.cards.push({ text, big, t: 0, build: big ? 1.1 : 0.35, hold: big ? 4 : 2.4, fade: big ? 1.2 : 0.6, tex: null, w: 0, h: 0, version: -1 });
  }

  get showing(): boolean {
    return this.cards.length > 0;
  }

  update(dt: number): void {
    for (const c of this.cards) c.t += dt;
    this.cards = this.cards.filter((c) => {
      const done = c.t > c.build + c.hold + c.fade;
      if (done && c.tex) this.gl.deleteTexture(c.tex);
      return !done;
    });
  }

  private texture(c: Card): void {
    if (c.tex && c.version === FONT_VERSION) return;
    const gl = this.gl;
    if (c.tex) gl.deleteTexture(c.tex);
    let src: TexImageSource;
    if (TITLE_FONT) {
      const f = TITLE_FONT;
      const cv = document.createElement("canvas");
      let w = 0;
      for (const ch of c.text) w += f.glyphs[ch]?.[4] ?? f.height / 2;
      cv.width = Math.max(1, w);
      cv.height = f.height;
      const g = cv.getContext("2d")!;
      let x = 0;
      for (const ch of c.text) {
        const gl1 = f.glyphs[ch];
        if (gl1) g.drawImage(f.image as CanvasImageSource, gl1[0], gl1[1], gl1[2], gl1[3], x, 0, gl1[2], gl1[3]);
        x += gl1?.[4] ?? f.height / 2;
      }
      src = cv;
      c.w = cv.width;
      c.h = cv.height;
    } else {
      const line = placeholderLine(c.text, c.big ? 26 : 12);
      src = line.canvas;
      c.w = line.w;
      c.h = line.h;
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    c.tex = tex;
    c.version = FONT_VERSION;
  }

  /** Draws the cards over the frame (W x H art px). Big titles sit across the sky. */
  draw(W: number, H: number): void {
    if (!this.cards.length) return;
    const gl = this.gl, u = this.u;
    gl.useProgram(this.prog);
    gl.disable(gl.BLEND);
    gl.uniform2f(u.uRes!, W, H);
    gl.bindVertexArray(this.vao);
    for (const c of this.cards) {
      this.texture(c);
      const scale = c.big ? Math.max(4, Math.round(H / 96)) : 2;
      const w = c.w * scale, h = c.h * scale;
      const x0 = c.big ? Math.round((W - w) / 2) : Math.round(W * 0.04);
      const y0 = c.big ? Math.round(H * 0.16) : Math.round(H * 0.86 - h);
      const build = this.reducedMotion ? 1 : Math.min(1, c.t / c.build);
      const fadeT = c.t - c.build - c.hold;
      const alpha = this.reducedMotion ? Math.min(1, c.t / 0.5) * (fadeT > 0 ? 1 - fadeT / c.fade : 1) : fadeT > 0 ? 1 - fadeT / c.fade : 1;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, c.tex);
      gl.uniform1i(u.uTex!, 0);
      gl.uniform2f(u.uSize!, c.w, c.h);
      gl.uniform4f(u.uRect!, x0, y0, x0 + w, y0 + h);
      gl.uniform4f(u.uColour!, 1.0, 0.985, 0.95, 1);
      gl.uniform3f(u.uShade!, 0.93, 0.9, 0.86);
      gl.uniform1f(u.uReveal!, build >= 1 ? 1.01 : Math.floor(build * c.text.length + 1) / c.text.length);
      gl.uniform1f(u.uLetters!, c.text.length);
      gl.uniform1f(u.uAlpha!, Math.max(0, Math.min(1, alpha)));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
}
