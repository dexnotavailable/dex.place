// Pixel icons, authored as grids in code (CANON: no generated images).
//
// One character per pixel:
//   .  empty           k  ink outline        w  white highlight
//   a  accent (--px-a, defaults to yellow)   b  second accent (--px-b, magenta)
//   y  yellow   p  magenta   m  mint   c  cyan   g  light grey
//
// Each colour becomes one SVG <path> (one rectangle per horizontal run), so an
// icon is a handful of paths at any size. Rendered at build time into the HTML
// with fixed width/height (no layout shift) and crisp edges at integer scales.
// DOM-free: runs in the build, the browser and `node --test`.
//
// An icon is either one grid or several same-sized frames. Frames are stacked
// as <g class="px-f px-fN"> and animated in CSS with steps() (see floats.css).

export type PixelGrid = readonly string[];
export type PixelIcon = PixelGrid | { readonly frames: readonly PixelGrid[] };

export const PIXEL_KEYS = ["k", "w", "a", "b", "y", "p", "m", "c", "g"] as const;
export type PixelKey = (typeof PIXEL_KEYS)[number];

export const ICONS = {
  download: [
    "...kkkkk...",
    "...kawak...",
    "...kaaak...",
    "...kaaak...",
    "kkkkaaakkkk",
    ".kaaaaaaak.",
    "..kaaaaak..",
    "...kaaak...",
    "....kak....",
    ".....k.....",
    "k.........k",
    "kkkkkkkkkkk",
  ],
  arrow: [
    "....k...",
    "....kk..",
    "kkkkkak.",
    "kaaaaaak",
    "kkkkkak.",
    "....kk..",
    "....k...",
  ],
  "arrow-left": [
    "...k....",
    "..kk....",
    ".kakkkkk",
    "kaaaaaak",
    ".kakkkkk",
    "..kk....",
    "...k....",
  ],
  "arrow-down": [
    "..kkk..",
    "..kak..",
    "..kak..",
    "kkkakkk",
    "kaaaaak",
    ".kaaak.",
    "..kak..",
    "...k...",
  ],
  "arrow-se": [
    "kk......",
    "kak.....",
    ".kak..k.",
    "..kak.kk",
    "...kakak",
    "....kaak",
    "..kkkaak",
    "..kkkkkk",
  ],
  up: [
    "....kk....",
    "...kaak...",
    "..kaaaak..",
    ".kaaaaaak.",
    "kkkkaakkkk",
    "...kaak...",
    "...kaak...",
    "...kkkk...",
  ],
  close: [
    "kk...kk",
    "kak.kak",
    ".kakak.",
    "..kak..",
    ".kakak.",
    "kak.kak",
    "kk...kk",
  ],
  menu: [
    "kkkkkkkkkk",
    "kaaaaaaaak",
    "kkkkkkkkkk",
    "..........",
    "kkkkkkkkkk",
    "kaaaaaaaak",
    "kkkkkkkkkk",
    "..........",
    "kkkkkkkkkk",
    "kaaaaaaaak",
    "kkkkkkkkkk",
  ],
  window: [
    "kkkkkkkkkkkk",
    "kaaaaaaapkmk",
    "kkkkkkkkkkkk",
    "kwwwwwwwwwwk",
    "kwkwwwwwwwwk",
    "kwwkwwwwwwwk",
    "kwkwwkkkkwwk",
    "kwwwwwwwwwwk",
    "kkkkkkkkkkkk",
  ],
  book: [
    ".kkkkk.kkkkk.",
    "kwwwwwkwwwwwk",
    "kwkkkwkwkkkwk",
    "kwwwwwkwwwwwk",
    "kwkkkwkwkkwwk",
    "kwwwwwkwwwwwk",
    "kaaaaakaaaaak",
    ".kkkkkkkkkkk.",
  ],
  page: [
    "kkkkkkk...",
    "kwwwwwkk..",
    "kwwwwwkak.",
    "kwwwwwkkkk",
    "kwkkkkkwwk",
    "kwwwwwwwwk",
    "kwkkkkkkwk",
    "kwwwwwwwwk",
    "kwkkkkwwwk",
    "kwwwwwwwwk",
    "kkkkkkkkkk",
  ],
  frame: [
    "kkkkkkkkkkkk",
    "kaaaaaaaaaak",
    "kakkkkkkkkak",
    "kakwwwwppkak",
    "kakwwwwwwkak",
    "kakwwkwwwkak",
    "kakwkmkwkkak",
    "kakkmmmkmkak",
    "kakkkkkkkkak",
    "kaaaaaaaaaak",
    "kkkkkkkkkkkk",
  ],
  heart: [
    ".kkk.kkk.",
    "kawakaaak",
    "kwaaaaaak",
    "kaaaaaaak",
    ".kaaaaak.",
    "..kaaak..",
    "...kak...",
    "....k....",
  ],
  coin: [
    "..kkkkkk..",
    ".kaaaaaak.",
    "kawaakaaak",
    "kaaakkkaak",
    "kaaaakaaak",
    "kaaaakaaak",
    "kaaakkkaak",
    ".kaaaaaak.",
    "..kkkkkk..",
  ],
  bank: [
    ".....kk.....",
    "...kkaakk...",
    ".kkaaaaaakk.",
    "kkkkkkkkkkkk",
    ".kwk.kk.kwk.",
    ".kwk.kk.kwk.",
    ".kwk.kk.kwk.",
    ".kwk.kk.kwk.",
    "kkkkkkkkkkkk",
    "kaaaaaaaaaak",
    "kkkkkkkkkkkk",
  ],
  qr: [
    "kkkk.akkkk",
    "kwwk..kwwk",
    "kwwk.akwwk",
    "kkkk..kkkk",
    "..a.aa.a..",
    "kkkk.a.a.a",
    "kwwk..aa..",
    "kwwk.a..aa",
    "kkkk.aa.a.",
  ],
  copy: [
    "kkkkkk...",
    "kwwwwk...",
    "kwkkkkkkk",
    "kwkaaaaak",
    "kwkaaaaak",
    "kkkaaaaak",
    "..kaaaaak",
    "..kaaaaak",
    "..kkkkkkk",
  ],
  check: [
    "........kk",
    ".......kak",
    "kk....kak.",
    "kak..kak..",
    ".kakkak...",
    "..kaak....",
    "...kk.....",
  ],
  external: [
    "....kkkkkk",
    "....kaaaak",
    "......kaak",
    ".....kakak",
    "....kak.kk",
    "...kak..k.",
    "..kak.....",
    ".kak......",
    "kak.......",
    "kk........",
  ],
  sparkle: [
    ".....k.....",
    "....kak....",
    "....kak....",
    "...kaaak...",
    ".kkaaaaakk.",
    "kaaaawaaaak",
    ".kkaaaaakk.",
    "...kaaak...",
    "....kak....",
    "....kak....",
    ".....k.....",
  ],
  star: [
    ".....k.....",
    "....kak....",
    "...kaaak...",
    "kkkkawakkkk",
    ".kaaaaaaak.",
    "..kaaaaak..",
    "..kaaaaak..",
    ".kaakkkaak.",
    ".kak...kak.",
    ".kk.....kk.",
  ],
  plus: [
    "..kkk..",
    "..kak..",
    "kkkakkk",
    "kaaaaak",
    "kkkakkk",
    "..kak..",
    "..kkk..",
  ],
  cross: [
    "...k...",
    "...k...",
    "...k...",
    "kkk.kkk",
    "...k...",
    "...k...",
    "...k...",
  ],
  cursor: [
    "k.......",
    "kk......",
    "kwk.....",
    "kwwk....",
    "kwwwk...",
    "kwwwwk..",
    "kwwwwwk.",
    "kwwwwwwk",
    "kwwwkkkk",
    "kwkwwk..",
    "kk.kwk..",
    "k...kwk.",
    "....kk..",
  ],
  grid: [
    "kkkk.kkkk",
    "kaak.kaak",
    "kaak.kaak",
    "kkkk.kkkk",
    ".........",
    "kkkk.kkkk",
    "kaak.kaak",
    "kaak.kaak",
    "kkkk.kkkk",
  ],
  // Docs and blog: feed link, callout labels.
  rss: [
    "kkkk......",
    "kaaakk....",
    "kkkkaak...",
    "....kkak..",
    "kkk...kak.",
    "kaakk.kak.",
    "kkkak..kak",
    "...kak.kak",
    "kk.kak.kak",
    "kk.kkk.kkk",
  ],
  info: [
    ".kkkkkkk.",
    "kaaaaaaak",
    "kaaakaaak",
    "kaaaaaaak",
    "kaakkaaak",
    "kaaakaaak",
    "kaaakaaak",
    "kaakkkaak",
    ".kkkkkkk.",
  ],
  warn: [
    ".....k.....",
    "....kak....",
    "....kak....",
    "...kaaak...",
    "...kakak...",
    "..kaakaak..",
    "..kaakaak..",
    ".kaaaaaaak.",
    ".kaaakaaak.",
    "kaaaaaaaaak",
    "kkkkkkkkkkk",
  ],
  // Mascots for the floating layer. Two frames: eyes open, blink.
  blob: {
    frames: [
      [
        "...kkkkkk...",
        "..kaaaaaak..",
        ".kawwaaaaak.",
        ".kawaaaaaak.",
        "kaakaaaakaak",
        "kaakaaaakaak",
        "kbaaakkaaabk",
        "kaaaaaaaaaak",
        ".kaaaaaaaak.",
        "..kkkkkkkk..",
      ],
      [
        "...kkkkkk...",
        "..kaaaaaak..",
        ".kawwaaaaak.",
        ".kawaaaaaak.",
        "kaaaaaaaaaak",
        "kakkaaaakkak",
        "kbaaakkaaabk",
        "kaaaaaaaaaak",
        ".kaaaaaaaak.",
        "..kkkkkkkk..",
      ],
    ],
  },
  // Sleeping blob; the Z drifts up a pixel between frames.
  sleepy: {
    frames: [
      [
        "..........kkkk",
        "............k.",
        "...........k..",
        "..........kkkk",
        "..............",
        "...kkkkkk.....",
        "..kaaaaaak....",
        ".kawaaaaaak...",
        "kaaaaaaaaaak..",
        "kakkaaaakkak..",
        "kbaaaaaaaabk..",
        "kaaaakkaaaak..",
        ".kaaaaaaaak...",
        "..kkkkkkkk....",
      ],
      [
        ".........kkkk.",
        "...........k..",
        "..........k...",
        ".........kkkk.",
        "..............",
        "...kkkkkk.....",
        "..kaaaaaak....",
        ".kawaaaaaak...",
        "kaaaaaaaaaak..",
        "kakkaaaakkak..",
        "kbaaaaaaaabk..",
        "kaaaakkaaaak..",
        ".kaaaaaaaak...",
        "..kkkkkkkk....",
      ],
    ],
  },
} as const satisfies Record<string, PixelIcon>;

export type IconName = keyof typeof ICONS;

/** Colour used for each key when the page CSS does not override it. */
export const PIXEL_FILL: Readonly<Record<PixelKey, string>> = {
  k: "var(--px-k,#191919)",
  w: "var(--px-w,#fff)",
  a: "var(--px-a,#fffa00)",
  b: "var(--px-b,#ff1aac)",
  y: "#fffa00",
  p: "#ff1aac",
  m: "#00ffa2",
  c: "#32fee3",
  g: "#d9d9d9",
};

export function framesOf(icon: PixelIcon): readonly PixelGrid[] {
  return "frames" in icon ? icon.frames : [icon as PixelGrid];
}

/** Checks one icon: every frame rectangular, same size, known keys only. */
export function validateIcon(name: string, icon: PixelIcon): { width: number; height: number } {
  const frames = framesOf(icon);
  const first = frames[0];
  if (!first || first.length === 0) throw new Error(`pixel icon ${name} is empty`);
  const width = first[0]?.length ?? 0;
  const height = first.length;
  frames.forEach((grid, f) => {
    if (grid.length !== height) throw new Error(`pixel icon ${name} frame ${f} has ${grid.length} rows, expected ${height}`);
    grid.forEach((row, y) => {
      if (row.length !== width) throw new Error(`pixel icon ${name} frame ${f} row ${y} is ${row.length} wide, expected ${width}`);
      for (const ch of row) {
        if (ch !== "." && !(PIXEL_KEYS as readonly string[]).includes(ch)) {
          throw new Error(`pixel icon ${name} uses unknown key "${ch}"`);
        }
      }
    });
  });
  return { width, height };
}

/** Path data per colour key: one rectangle per horizontal run. */
export function pixelPaths(grid: PixelGrid): Map<PixelKey, string> {
  const out = new Map<PixelKey, string>();
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x] as string;
      if (ch === ".") { x += 1; continue; }
      const start = x;
      while (x < row.length && row[x] === ch) x += 1;
      const key = ch as PixelKey;
      out.set(key, (out.get(key) ?? "") + `M${start} ${y}h${x - start}v1h${start - x}z`);
    }
  });
  return out;
}

function pathsMarkup(grid: PixelGrid): string {
  let s = "";
  const paths = pixelPaths(grid);
  // Stable order: fills first, outline last.
  for (const key of [...PIXEL_KEYS.filter((k) => k !== "k"), "k" as const]) {
    const d = paths.get(key);
    if (d) s += `<path fill="${PIXEL_FILL[key]}" d="${d}"/>`;
  }
  return s;
}

export interface PixelSvgOptions {
  /** Screen pixels per grid cell. Integers keep edges crisp. */
  scale?: number;
  className?: string;
  /** Accessible name; without it the icon is decorative (aria-hidden). */
  label?: string;
}

/** Inline SVG markup with fixed width/height, so it never shifts layout. */
export function pixelSvg(name: IconName, options: PixelSvgOptions = {}): string {
  const icon: PixelIcon = ICONS[name];
  const { width, height } = validateIcon(name, icon);
  const scale = options.scale ?? 2;
  const frames = framesOf(icon);
  const cls = ["px", `px--${name}`, frames.length > 1 ? "px--anim" : "", options.className ?? ""].filter(Boolean).join(" ");
  const a11y = options.label
    ? `role="img" aria-label="${options.label.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"`
    : `aria-hidden="true" focusable="false"`;
  const body = frames.length === 1
    ? pathsMarkup(frames[0] as PixelGrid)
    : frames.map((grid, i) => `<g class="px-f px-f${i}">${pathsMarkup(grid)}</g>`).join("");
  return (
    `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width * scale}" height="${height * scale}" shape-rendering="crispEdges" ${a11y}>${body}</svg>`
  );
}
