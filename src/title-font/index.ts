// Tesu Display on canvas: load the bitmap atlas, lay out a title, and draw it at a
// whole-number scale, including its timing on screen. The same pixel grid ships as
// a webfont for the website's DOM headings (title-font.css).
//
// Titles slam in (Dex, 2026-10-12): locations, introductions and mid-cutscene
// titles appear all at once, bold, on the hit. The build-up lives in the music and
// the camera before it, not in the letters. An optional impact accent of one or two
// frames, then a hold, then a fade out.
//
// Source glyphs: glyphs.txt. Build: python tools/title-font/build.py.

export { BIG_TITLE_SCALE, PLACE_TITLE_SCALE, TITLE_CAP } from "./sizes.ts";

export interface TitleGlyph {
  /** Rect in the atlas image, font pixels. It starts `up` rows above the cap line. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rows above the cap line (Vietnamese accents); 0 for plain capitals. */
  up: number;
  /** Advance width and left bearing, font pixels (the bearing is negative when an accent overhangs a narrow letter). */
  advance: number;
  left: number;
}

export interface TitleFontMetrics {
  name: string;
  cap: number;
  ascent: number;
  descent: number;
  space: number;
  glyphs: Record<string, TitleGlyph>;
}

export interface TitleFont {
  image: CanvasImageSource;
  metrics: TitleFontMetrics;
}

/** Where the build puts the atlas (served from public/). */
export const TITLE_FONT_BASE = "/fonts/tesu-display/";

export async function loadTitleFont(base: string = TITLE_FONT_BASE): Promise<TitleFont> {
  const [metrics, image] = await Promise.all([
    fetch(`${base}atlas.json`).then((r) => {
      if (!r.ok) throw new Error(`title font metrics: HTTP ${r.status}`);
      return r.json() as Promise<TitleFontMetrics>;
    }),
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("title font atlas failed to load"));
      img.src = `${base}atlas.png`;
    }),
  ]);
  return { image, metrics };
}

export interface TitleLayout {
  /** Width in font pixels, from the first ink column to the last. */
  width: number;
  letters: { ch: string; glyph: TitleGlyph; x: number }[];
}

/** Lays out a title in font pixels. Lowercase is drawn as capitals; unknown characters are skipped. */
export function layoutTitle(font: TitleFont, text: string, tracking = 0): TitleLayout {
  const { glyphs, space } = font.metrics;
  const letters: TitleLayout["letters"] = [];
  let pen = 0;
  let first = true;
  let width = 0;
  for (const raw of text.toUpperCase()) {
    if (raw === " ") {
      pen += space + tracking;
      continue;
    }
    const glyph = glyphs[raw];
    if (!glyph) continue;
    if (first) pen -= glyph.left; // the first letter starts at x = 0
    first = false;
    const x = pen + glyph.left;
    letters.push({ ch: raw, glyph, x });
    width = x + glyph.w;
    pen += glyph.advance + tracking;
  }
  return { width, letters };
}

/** A title's timing on screen, in seconds, from the hit (t = 0). */
export interface TitlePreset {
  /** Impact accent: the whole title in the hot colour for this long (0 = none; keep it to 1 or 2 frames). */
  accent: number;
  /** Fully on screen in its colour. */
  hold: number;
  /** Fade out. */
  out: number;
}

/** Big titles: TESU, SHANSHUI, YUEMEN, TIANJING, and the website's big section titles. */
export const TITLE_BIG: TitlePreset = { accent: 2 / 60, hold: 2.8, out: 0.6 };

/** Place names: small, lower left, same slam without the accent. */
export const TITLE_PLACE: TitlePreset = { accent: 0, hold: 2, out: 0.45 };

/**
 * Title colours. Dex's rule for now: scarlet over bright daytime skies (white loses
 * contrast there and titles have no outline), paper white at night and in dark places.
 */
export const TITLE_COLOR_DAY = "#c9304f";
export const TITLE_COLOR_NIGHT = "#fff4f1";
/** The impact accent's colour. */
export const TITLE_COLOR_HOT = "#ffffff";

export function titleDuration(preset: TitlePreset = TITLE_BIG): number {
  return preset.hold + preset.out;
}

export interface TitleDrawOptions {
  /** Canvas pixels per font pixel. Whole numbers only (rounded). */
  scale: number;
  /** CSS colour of the letters (see TITLE_COLOR_DAY / TITLE_COLOR_NIGHT). */
  color?: string;
  /** Colour of the impact accent frames. */
  hot?: string;
  /** Extra font pixels between letters (titles read well with 1 or 2). */
  tracking?: number;
  align?: "left" | "center" | "right";
  /** Seconds since the hit. Omit to draw the title still and fully on. */
  time?: number;
  preset?: TitlePreset;
  /** Reduced motion: no accent frames (the cut in and the fade out stay). */
  reducedMotion?: boolean;
}

const tints = new WeakMap<object, Map<string, HTMLCanvasElement>>();

/** The atlas recoloured to one colour (cached per font and colour). */
function tinted(font: TitleFont, color: string): HTMLCanvasElement {
  let byColor = tints.get(font);
  if (!byColor) tints.set(font, (byColor = new Map()));
  let c = byColor.get(color);
  if (!c) {
    const img = font.image as HTMLImageElement;
    c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    byColor.set(color, c);
  }
  return c;
}

/**
 * Draws a title with its baseline at `y`. `x` is the left edge, centre or right
 * edge depending on `align`. With `time`, it follows the preset: nothing before the
 * hit, then all of it at once. Returns the title's box in canvas pixels.
 */
export function drawTitle(
  ctx: CanvasRenderingContext2D,
  font: TitleFont,
  text: string,
  x: number,
  y: number,
  opts: TitleDrawOptions,
): { x: number; y: number; w: number; h: number } {
  const s = Math.max(1, Math.round(opts.scale));
  const preset = opts.preset ?? TITLE_BIG;
  const layout = layoutTitle(font, text, opts.tracking ?? 0);
  const cap = font.metrics.cap;
  const align = opts.align ?? "left";
  const left = Math.round(align === "center" ? x - (layout.width * s) / 2 : align === "right" ? x - layout.width * s : x);
  const top = Math.round(y) - cap * s;
  // accents (Hoài Phố and the like) rise above the cap line; the box includes them
  const up = layout.letters.reduce((m, L) => Math.max(m, L.glyph.up), 0);
  const box = { x: left, y: top - up * s, w: layout.width * s, h: (up + cap + font.metrics.descent) * s };
  const t = opts.time;

  let alpha = 1;
  let color = opts.color ?? TITLE_COLOR_NIGHT;
  if (t !== undefined) {
    if (t < 0 || t >= preset.hold + preset.out) return box;
    if (t < preset.accent && !opts.reducedMotion) color = opts.hot ?? TITLE_COLOR_HOT;
    if (t > preset.hold) {
      const u = (t - preset.hold) / preset.out;
      alpha = 1 - u * u;
    }
  }

  const src = tinted(font, color);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  for (const L of layout.letters) {
    const g = L.glyph;
    ctx.drawImage(src, g.x, g.y, g.w, g.h, left + L.x * s, top - g.up * s, g.w * s, g.h * s);
  }
  ctx.restore();
  return box;
}
