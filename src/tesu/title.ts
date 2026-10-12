// Titles (GDK 3.9, Dex's note: titles appear suddenly). Big titles (TESU, SHANSHUI ...)
// and place names slam in on the hit, all at once, bold, then hold and fade; the build-up
// lives in the music and the camera before them. The face is the title lane's Tesu Display
// (src/title-font): drawn at whole-number scales into a small canvas each frame it shows
// and laid over the frame. Scarlet over daytime skies, paper white at night.

import { compile, uniforms } from "../lab/engine/gl.ts";
import { drawTitle, layoutTitle, loadTitleFont, TITLE_BIG, TITLE_COLOR_DAY, TITLE_COLOR_NIGHT, TITLE_PLACE, type TitleFont } from "../title-font/index.ts";

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
out vec4 o;
void main() {
  ivec2 t = clamp(ivec2(floor(vUV * uSize)), ivec2(0), ivec2(uSize) - 1);
  vec4 c = texelFetch(uTex, t, 0);
  if (c.a < 0.01) discard;
  o = vec4(c.rgb * c.a, c.a);
}`;

interface Card {
  text: string;
  big: boolean;
  t: number;
  night: boolean;
}

export class Titles {
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation>;
  private cards: Card[] = [];
  private font: TitleFont | null = null;
  private canvas = document.createElement("canvas");
  private tex: WebGLTexture;
  reducedMotion = false;

  constructor(private gl: WebGL2RenderingContext, private vao: WebGLVertexArrayObject) {
    this.prog = compile(gl, VS, FS, "tesu-title");
    this.u = uniforms(gl, this.prog);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    loadTitleFont().then((f) => { this.font = f; }, (e: unknown) => console.warn("title font", e));
  }

  /** A big title (TESU, SHANSHUI ...) or a place name, slamming in now. */
  show(text: string, big: boolean, night = false): void {
    this.cards = this.cards.filter((c) => c.big !== big);
    this.cards.push({ text, big, t: 0, night });
  }

  get showing(): boolean {
    return this.cards.length > 0;
  }

  update(dt: number): void {
    for (const c of this.cards) c.t += dt;
    this.cards = this.cards.filter((c) => {
      const p = c.big ? TITLE_BIG : TITLE_PLACE;
      return c.t < p.hold + p.out;
    });
  }

  /** Draws the cards over the frame (W x H art px): big titles across the sky, place names lower left. */
  draw(W: number, H: number): void {
    if (!this.cards.length || !this.font) return;
    const gl = this.gl, u = this.u;
    const font = this.font;
    for (const c of this.cards) {
      const scale = c.big ? Math.max(4, Math.round(H / 120)) : Math.max(2, Math.round((H * 2) / 720));
      const lay = layoutTitle(font, c.text, c.big ? 2 : 1);
      const cap = font.metrics.cap, desc = font.metrics.descent;
      const w = Math.max(1, lay.width * scale), h = (cap + desc) * scale;
      const cv = this.canvas;
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      const g = cv.getContext("2d")!;
      g.clearRect(0, 0, w, h);
      drawTitle(g, font, c.text, 0, cap * scale, {
        scale, color: c.night ? TITLE_COLOR_NIGHT : TITLE_COLOR_DAY, tracking: c.big ? 2 : 1,
        time: c.t, preset: c.big ? TITLE_BIG : TITLE_PLACE, reducedMotion: this.reducedMotion,
      });
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      const x0 = c.big ? Math.round((W - w) / 2) : Math.round(W * 0.045);
      const y0 = c.big ? Math.round(H * 0.17) : Math.round(H * 0.88 - h);
      gl.useProgram(this.prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform2f(u.uRes!, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform1i(u.uTex!, 0);
      gl.uniform2f(u.uSize!, w, h);
      gl.uniform4f(u.uRect!, x0, y0, x0 + w, y0 + h);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }
}
