// Zhusha's talisman on the page (GDK 3.8): the commission addressed to her, her name 朱砂 brushed down
// its face, his three lines in small script down its edges, his red seal at the foot. It is
// always moving: a short chain of cloth points simulated every frame bends the strip in the
// wind, and it is drawn as pixels at a whole-number scale with a one-pixel ink outline, never
// as a smoothly scaled bitmap. Its face is pixel art at one size (the page size), sampled
// nearest; the name comes from DotGothic16, a pixel font drawn on the same 16 px grid.
//
// The loader lights its script from the top down as the world loads (diegetic: the glyphs
// on her talisman light up one by one).

// (only the two glyphs of her name, 朱 and 砂, from DotGothic16's subsets: a few KB on the
// homepage's first load instead of the whole family's stylesheet)
const zhuUrl = new URL("../../../node_modules/@fontsource/dotgothic16/files/dotgothic16-78-400-normal.woff2", import.meta.url).href;
const shaUrl = new URL("../../../node_modules/@fontsource/dotgothic16/files/dotgothic16-92-400-normal.woff2", import.meta.url).href;

const NAME_FONT = "Zhusha DotGothic16";
let nameFont: Promise<unknown> | null = null;
/** Registers and loads the two subsets that hold 朱 (U+6731) and 砂 (U+7802). */
function loadNameFont(): Promise<unknown> {
  if (nameFont) return nameFont;
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts || typeof FontFace === "undefined") return (nameFont = Promise.resolve());
  const faces = [new FontFace(NAME_FONT, `url(${zhuUrl}) format("woff2")`, { unicodeRange: "U+6731" }), new FontFace(NAME_FONT, `url(${shaUrl}) format("woff2")`, { unicodeRange: "U+7802" })];
  for (const f of faces) fonts.add(f);
  return (nameFont = Promise.all(faces.map((f) => f.load())));
}

/** The strip in art pixels (outline included). */
export const TALISMAN_W = 24;
export const TALISMAN_H = 56;

const INK = "#2a1a08";
const PAPER = ["#fff1b0", "#f5d25c", "#e6b83e", "#c8962a"] as const;
const SCARLET = "#c8202a";
const DIM = "#e2a05a";
const SEAL = "#b8141f";

const POINTS = 8;

export class Talisman {
  private lit: HTMLCanvasElement;
  private dim: HTMLCanvasElement;
  private dx = new Float32Array(POINTS);
  private v = new Float32Array(POINTS);
  private t = Math.random() * 10;
  ready = false;

  constructor() {
    this.lit = document.createElement("canvas");
    this.dim = document.createElement("canvas");
    for (const c of [this.lit, this.dim]) {
      c.width = TALISMAN_W;
      c.height = TALISMAN_H;
    }
    this.paint(this.lit, true);
    this.paint(this.dim, false);
    // the name needs its font: repaint once it has loaded
    void loadNameFont().then(() => {
      this.paint(this.lit, true);
      this.paint(this.dim, false);
      this.ready = true;
    }, () => { this.ready = true; });
  }

  /** The face, flat: paper, edges, the name, the letter lines, the seal. */
  private paint(cv: HTMLCanvasElement, lit: boolean): void {
    const g = cv.getContext("2d")!;
    const W = TALISMAN_W, H = TALISMAN_H;
    g.clearRect(0, 0, W, H);
    // paper with a few fibres, lit on its left
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const fibre = (x * 7 + y * 13) % 11 === 0;
        g.fillStyle = x < 4 ? PAPER[0] : x > W - 5 ? PAPER[2] : fibre ? PAPER[2] : PAPER[1];
        g.fillRect(x, y, 1, 1);
      }
    }
    // the binding band at the top
    g.fillStyle = PAPER[3];
    g.fillRect(1, 1, W - 2, 3);
    g.fillStyle = lit ? SCARLET : DIM;
    g.fillRect(1, 4, W - 2, 1);
    // the emperor's three lines, in small script down both edges (too small to read)
    for (let y = 8; y < 44; y++) {
      const mark = (y * 5) % 7 < 4;
      if (!mark) continue;
      g.fillStyle = lit ? "#7a2a1a" : DIM;
      g.fillRect(2, y, 1, 1);
      if ((y * 3) % 5 < 3) g.fillRect(W - 3, y, 1, 1);
    }
    // her name, 朱砂, brushed down the middle in scarlet (thresholded to whole pixels)
    const tmp = document.createElement("canvas");
    tmp.width = 16;
    tmp.height = 34;
    const tg = tmp.getContext("2d")!;
    tg.fillStyle = "#000";
    tg.font = `16px "${NAME_FONT}", monospace`;
    tg.textBaseline = "top";
    tg.fillText("朱", 0, 0);
    tg.fillText("砂", 0, 17);
    const data = tg.getImageData(0, 0, 16, 34).data;
    g.fillStyle = lit ? SCARLET : DIM;
    for (let y = 0; y < 34; y++) for (let x = 0; x < 16; x++) if (data[(y * 16 + x) * 4 + 3]! > 110) g.fillRect(4 + x, 8 + y, 1, 1);
    // his seal at the foot
    g.fillStyle = lit ? SEAL : DIM;
    g.fillRect(8, 45, 8, 8);
    g.fillStyle = PAPER[1];
    g.fillRect(10, 47, 4, 1);
    g.fillRect(11, 47, 1, 4);
    g.fillRect(10, 50, 4, 1);
    // the one-pixel ink outline
    g.fillStyle = INK;
    g.fillRect(0, 0, W, 1);
    g.fillRect(0, H - 1, W, 1);
    g.fillRect(0, 0, 1, H);
    g.fillRect(W - 1, 0, 1, H);
  }

  /**
   * One step of the cloth: the strip bends from its top, pushed by the wind (a base and
   * gusts) and pulled straight by its own stiffness. `flutter` is how free it hangs (0 on her
   * hat, 1 falling through the air).
   */
  step(dt: number, wind: number, flutter: number, still = false): void {
    this.t += dt;
    if (still) {
      this.dx.fill(0);
      this.v.fill(0);
      return;
    }
    const gust = Math.sin(this.t * 1.3) * 0.6 + Math.sin(this.t * 3.1 + 1.7) * 0.3 + Math.sin(this.t * 7.3) * 0.12 * flutter;
    for (let i = 1; i < POINTS; i++) {
      const u = i / (POINTS - 1);
      const push = (wind + gust * (0.5 + flutter)) * u * 9;
      const pull = (this.dx[i - 1]! - this.dx[i]!) * 26 + (i < POINTS - 1 ? (this.dx[i + 1]! - this.dx[i]!) * 12 : 0) - this.dx[i]! * (6 - 4 * flutter);
      this.v[i] = (this.v[i]! + (push + pull) * dt) * Math.pow(0.04, dt);
      this.dx[i] = this.dx[i]! + this.v[i]! * dt * 8;
      this.dx[i] = Math.max(-7, Math.min(7, this.dx[i]!));
    }
  }

  /** A poke (the waiting room): the strip jolts and swings back. */
  poke(): void {
    for (let i = 1; i < POINTS; i++) this.v[i] = this.v[i]! + (i / (POINTS - 1)) * (Math.random() < 0.5 ? -1 : 1) * 14;
  }

  /**
   * Draws it with its top centre at (x, y) device px, `k` device px per art px (a whole
   * number), lit down to `lit` (0..1) of its length. `ctx` draws in device px.
   * sweep: a gold sweep's row (0..1 down the script; the loader's "everything is in");
   * flip: its width as it turns over (1 face on, 0 edge on, below 0 the back: the gust).
   */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, lit = 1, opts: { sweep?: number; flip?: number } = {}): void {
    ctx.imageSmoothingEnabled = false;
    const W = TALISMAN_W, H = TALISMAN_H;
    const flip = opts.flip ?? 1;
    const w = Math.max(1, Math.round(W * Math.abs(flip)));
    const x0 = Math.round(x - (w * k) / 2), y0 = Math.round(y);
    const litRows = Math.round(lit * H);
    const sweepRow = opts.sweep === undefined ? -9 : Math.round(opts.sweep * (H - 1));
    for (let r = 0; r < H; r++) {
      const u = r / (H - 1);
      const f = u * (POINTS - 1);
      const i = Math.min(POINTS - 2, Math.floor(f));
      const off = this.dx[i]! + (this.dx[i + 1]! - this.dx[i]!) * (f - i);
      const src = flip < 0 || r >= litRows ? this.dim : this.lit;
      ctx.drawImage(src, 0, r, W, 1, x0 + Math.round(off) * k, y0 + r * k, w * k, k);
      if (Math.abs(r - sweepRow) <= 1) {
        ctx.fillStyle = r === sweepRow ? "rgba(255, 246, 200, 0.85)" : "rgba(255, 232, 145, 0.5)";
        ctx.fillRect(x0 + Math.round(off) * k + k, y0 + r * k, (w - 2) * k, k);
      }
    }
  }
}
