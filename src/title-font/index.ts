// Tesu Display on canvas: load the bitmap atlas, lay out a title, and draw it
// (optionally mid-build) at a whole-number scale. The same pixel grid ships as a
// webfont for the website's DOM headings (title-font.css).
//
// Source glyphs: glyphs.txt. Build: python tools/title-font/build.py.

export { BIG_TITLE_SCALE, PLACE_TITLE_SCALE, TITLE_CAP } from "./sizes.ts";

export interface TitleGlyph {
  /** Rect in the atlas image, font pixels. The glyph's top row is the cap line. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Advance width and left bearing, font pixels. */
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

/** A title's build, hold and exit, in seconds. */
export interface TitlePreset {
  /** A hairline rule draws out from the centre along the baseline first. */
  rule: number;
  /** When the first letter starts rising, and the gap between letters. */
  letterStart: number;
  stagger: number;
  /** Each letter rises out of the rule, bottom row first. */
  rise: number;
  /** After the last letter lands: the rule fades and the letters cool from hot white. */
  settle: number;
  hold: number;
  out: number;
  outStagger: number;
}

/** Big titles: TESU, SHANSHUI, YUEMEN, TIANJING, and the website's big section titles. */
export const TITLE_BIG: TitlePreset = {
  rule: 0.42,
  letterStart: 0.24,
  stagger: 0.075,
  rise: 0.34,
  settle: 0.35,
  hold: 2.6,
  out: 0.55,
  outStagger: 0.045,
};

/** Place names: quick, small, lower left. */
export const TITLE_PLACE: TitlePreset = {
  rule: 0.2,
  letterStart: 0.08,
  stagger: 0.03,
  rise: 0.16,
  settle: 0.2,
  hold: 1.8,
  out: 0.4,
  outStagger: 0.02,
};

/** Reduced motion: fade in, hold, fade out. */
const CALM = { in: 0.4, out: 0.6 };

export function titleDuration(text: string, preset: TitlePreset = TITLE_BIG, reducedMotion = false): number {
  if (reducedMotion) return CALM.in + preset.hold + CALM.out;
  const n = [...text].filter((c) => c !== " ").length;
  const landed = preset.letterStart + Math.max(0, n - 1) * preset.stagger + preset.rise;
  return landed + preset.settle + preset.hold + preset.out + Math.max(0, n - 1) * preset.outStagger;
}

export interface TitleDrawOptions {
  /** Canvas pixels per font pixel. Whole numbers only (rounded). */
  scale: number;
  /** CSS colour of the letters. */
  color?: string;
  /** Colour of fresh, just-built rows. */
  hot?: string;
  /** Extra font pixels between letters (titles read well with 1 or 2). */
  tracking?: number;
  align?: "left" | "center" | "right";
  /** Seconds since the title started. Omit to draw it finished and still. */
  time?: number;
  preset?: TitlePreset;
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

const ease = (u: number): number => 1 - (1 - u) * (1 - u) * (1 - u);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Draws a title with its baseline at `y`. `x` is the left edge, centre or right
 * edge depending on `align`. Returns the title's box in canvas pixels.
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
  const color = opts.color ?? "#fff4f1";
  const hot = opts.hot ?? "#ffffff";
  const layout = layoutTitle(font, text, opts.tracking ?? 0);
  const cap = font.metrics.cap;
  const align = opts.align ?? "left";
  const left = Math.round(align === "center" ? x - (layout.width * s) / 2 : align === "right" ? x - layout.width * s : x);
  const top = Math.round(y) - cap * s;
  const box = { x: left, y: top, w: layout.width * s, h: (cap + font.metrics.descent) * s };
  const ink = tinted(font, color);
  const glow = tinted(font, hot);
  const t = opts.time;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const blit = (src: CanvasImageSource, g: TitleGlyph, gx: number, row0: number, rows: number): void => {
    if (rows <= 0) return;
    ctx.drawImage(src, g.x, g.y + row0, g.w, rows, left + gx * s, top + row0 * s, g.w * s, rows * s);
  };

  if (t === undefined) {
    for (const L of layout.letters) blit(ink, L.glyph, L.x, 0, L.glyph.h);
    ctx.restore();
    return box;
  }

  const n = layout.letters.length;
  const total = titleDuration(text, preset, opts.reducedMotion);

  if (opts.reducedMotion) {
    const a = t < CALM.in ? t / CALM.in : t > total - CALM.out ? (total - t) / CALM.out : 1;
    ctx.globalAlpha = clamp01(a);
    for (const L of layout.letters) blit(ink, L.glyph, L.x, 0, L.glyph.h);
    ctx.restore();
    return box;
  }

  const landed = preset.letterStart + Math.max(0, n - 1) * preset.stagger + preset.rise;
  const outAt = landed + preset.settle + preset.hold;

  // the rule: one font pixel tall, two below the baseline, drawn out from the centre
  const ruleIn = ease(clamp01(t / preset.rule));
  const ruleFade = 1 - clamp01((t - landed) / preset.settle);
  if (ruleIn > 0 && ruleFade > 0) {
    const pad = 4;
    const full = layout.width + 2 * pad;
    const half = Math.round((full * ruleIn) / 2);
    const mid = Math.round(layout.width / 2);
    ctx.globalAlpha = 0.7 * ruleFade;
    ctx.fillStyle = color;
    ctx.fillRect(left + (mid - half) * s, top + (cap + 1) * s, half * 2 * s, s);
  }

  layout.letters.forEach((L, i) => {
    const g = L.glyph;
    const start = preset.letterStart + i * preset.stagger;
    const u = clamp01((t - start) / preset.rise);
    if (u <= 0) return;
    const capRows = Math.min(g.h, cap);
    // rows shown, counted up from the baseline; the descender comes with the last row
    const shown = Math.round(ease(u) * capRows);
    const outU = clamp01((t - outAt - i * preset.outStagger) / preset.out);
    if (outU >= 1) return;
    ctx.globalAlpha = 1 - outU * outU;
    const row0 = capRows - shown;
    blit(ink, g, L.x, row0, shown + (u >= 1 ? g.h - capRows : 0));
    if (u < 1) {
      // the leading row is white-hot as it rises
      blit(glow, g, L.x, row0, Math.min(1, shown));
    } else {
      // after landing the whole title cools from hot together
      const cool = clamp01((t - landed) / preset.settle);
      if (cool < 1) {
        ctx.globalAlpha = (1 - outU * outU) * (1 - cool) * 0.85;
        blit(glow, g, L.x, 0, g.h);
      }
    }
  });

  ctx.restore();
  return box;
}
