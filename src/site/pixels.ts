// Pixel icons, authored as grids in code (CANON: no generated images).
//
// Drawn for the dark site (DESIGN-SYSTEM.md §5): each icon is a solid glyph
// with holes, not an outlined sticker, so it reads on the near-black page and
// on the accent fills alike. One character per pixel:
//   .  empty (the surface shows through the holes)
//   a  the glyph (--px-a, defaults to currentColor: icons follow the text)
//   b  second accent (--px-b, magenta)      w  highlight (--px-w, off-white)
//   k  dark detail (--px-k, near-black: eyes, marks on a lit body)
//   y  yellow   p  magenta   m  mint   c  cyan   g  mid grey
//
// Each colour becomes one SVG <path> (one rectangle per horizontal run), so an
// icon is a handful of paths at any size. Rendered at build time into the HTML
// with fixed width/height (no layout shift) and crisp edges at integer scales.
// DOM-free: runs in the build, the browser and `node --test`.
//
// An icon is either one grid or several same-sized frames. Frames are stacked
// as <g class="px-f px-fN"> and animated in CSS with steps() (components.css).

export type PixelGrid = readonly string[];
export type PixelIcon = PixelGrid | { readonly frames: readonly PixelGrid[] };

export const PIXEL_KEYS = ["k", "w", "a", "b", "y", "p", "m", "c", "g"] as const;
export type PixelKey = (typeof PIXEL_KEYS)[number];

export const ICONS = {
  download: [
    "...aaaaa...",
    "...aaaaa...",
    "...aaaaa...",
    ".aaaaaaaaa.",
    "..aaaaaaa..",
    "...aaaaa...",
    "....aaa....",
    ".....a.....",
    "aa.......aa",
    "aa.......aa",
    "aaaaaaaaaaa",
  ],
  arrow: [
    "....a...",
    "....aa..",
    "aaaaaaa.",
    "aaaaaaaa",
    "aaaaaaa.",
    "....aa..",
    "....a...",
  ],
  "arrow-left": [
    "...a....",
    "..aa....",
    ".aaaaaaa",
    "aaaaaaaa",
    ".aaaaaaa",
    "..aa....",
    "...a....",
  ],
  "arrow-down": [
    "..aaa..",
    "..aaa..",
    "..aaa..",
    "aaaaaaa",
    ".aaaaa.",
    "..aaa..",
    "...a...",
  ],
  "arrow-se": [
    "aa......",
    "aaa.....",
    ".aaa....",
    "..aaa.aa",
    "...aaaaa",
    "....aaaa",
    "...aaaaa",
    "..aaaaaa",
  ],
  up: [
    "....a....",
    "...aaa...",
    "..aaaaa..",
    ".aaaaaaa.",
    "aaaaaaaaa",
    "...aaa...",
    "...aaa...",
    "...aaa...",
  ],
  close: [
    "aa...aa",
    "aaa.aaa",
    ".aaaaa.",
    "..aaa..",
    ".aaaaa.",
    "aaa.aaa",
    "aa...aa",
  ],
  menu: [
    "aaaaaaaaa",
    "aaaaaaaaa",
    ".........",
    "aaaaaaaaa",
    "aaaaaaaaa",
    ".........",
    "aaaaaaaaa",
    "aaaaaaaaa",
  ],
  window: [
    "aaaaaaaaaaaa",
    "aaaaaaa.a.aa",
    "aaaaaaaaaaaa",
    "a..........a",
    "a.a........a",
    "a..a.......a",
    "a.a..bbbb..a",
    "a..........a",
    "aaaaaaaaaaaa",
  ],
  book: [
    ".aaaa...aaaa.",
    "a....a.a....a",
    "a.aa.a.a.aa.a",
    "a....a.a....a",
    "a.aa.a.a.aa.a",
    "a....a.a....a",
    "a....a.a....a",
    "aaaaaaaaaaaaa",
    "....aa.aa....",
  ],
  page: [
    "aaaaaa...",
    "a....aa..",
    "a....a.a.",
    "a....aaaa",
    "a.aa....a",
    "a.......a",
    "a.aaaaa.a",
    "a.......a",
    "a.aaaa..a",
    "a.......a",
    "aaaaaaaaa",
  ],
  frame: [
    "aaaaaaaaaaaa",
    "a..........a",
    "a.aaaaaaaa.a",
    "a.a....bba.a",
    "a.a....bba.a",
    "a.a..a....aa",
    "a.a.aaa.a.aa",
    "a.aaaaaaaaaa",
    "a..........a",
    "aaaaaaaaaaaa",
  ],
  heart: [
    ".aa...aa.",
    "aaaa.aaaa",
    "awaaaaaaa",
    "aaaaaaaaa",
    ".aaaaaaa.",
    "..aaaaa..",
    "...aaa...",
    "....a....",
  ],
  coin: [
    "...aaaa...",
    ".aaaaaaaa.",
    ".aaa..aaa.",
    "aaa.aaaaaa",
    "aaaa..aaaa",
    "aaaaaa.aaa",
    "aaaa..aaaa",
    ".aaaa.aaa.",
    ".aaaaaaaa.",
    "...aaaa...",
  ],
  bank: [
    ".....a.....",
    "...aaaaa...",
    ".aaaaaaaaa.",
    "aaaaaaaaaaa",
    "...........",
    ".aa..a..aa.",
    ".aa..a..aa.",
    ".aa..a..aa.",
    "...........",
    "aaaaaaaaaaa",
  ],
  qr: [
    "aaa.a.aaa",
    "a.a...a.a",
    "aaa.a.aaa",
    "....a....",
    "a.aa.a.aa",
    ".........",
    "aaa.aa.a.",
    "a.a..a..a",
    "aaa.a.aa.",
  ],
  copy: [
    "aaaaaa...",
    "a....a...",
    "a..aaaaaa",
    "a..a....a",
    "a..a....a",
    "aaaa....a",
    "...a....a",
    "...a....a",
    "...aaaaaa",
  ],
  check: [
    "........a",
    ".......aa",
    "a.....aa.",
    "aa...aa..",
    ".aa.aa...",
    "..aaa....",
    "...a.....",
  ],
  external: [
    "....aaaaa",
    "......aaa",
    ".....aaaa",
    "....aaa.a",
    "a..aaa...",
    "a.aaa....",
    "a..a....a",
    "a.......a",
    "aaaaaaaaa",
  ],
  sparkle: [
    "....a....",
    "....a....",
    "...aaa...",
    "..aaaaa..",
    "aaaawaaaa",
    "..aaaaa..",
    "...aaa...",
    "....a....",
    "....a....",
  ],
  star: [
    ".....a.....",
    "....aaa....",
    "....aaa....",
    "aaaaaaaaaaa",
    ".aaaaaaaaa.",
    "..aaaaaaa..",
    "..aaaaaaa..",
    ".aaaa.aaaa.",
    ".aaa...aaa.",
    ".a.......a.",
  ],
  plus: [
    "..aaa..",
    "..aaa..",
    "aaaaaaa",
    "aaaaaaa",
    "aaaaaaa",
    "..aaa..",
    "..aaa..",
  ],
  cross: [
    "...a...",
    "...a...",
    ".......",
    "aa...aa",
    ".......",
    "...a...",
    "...a...",
  ],
  cursor: [
    "a.......",
    "aa......",
    "awa.....",
    "awwa....",
    "awwwa...",
    "awwwwa..",
    "awwwwwa.",
    "awwwaaaa",
    "awaawa..",
    "aa..awa.",
    "a....aa.",
  ],
  grid: [
    "aaaa.aaaa",
    "aaaa.aaaa",
    "aaaa.aaaa",
    "aaaa.aaaa",
    ".........",
    "aaaa.aaaa",
    "aaaa.aaaa",
    "aaaa.aaaa",
    "aaaa.aaaa",
  ],
  // Docs and blog: feed link, callout labels.
  rss: [
    "aaa......",
    "aaaaa....",
    "...aaa...",
    "aaa..aa..",
    "aaaa..aa.",
    "..aaa.aa.",
    "aa..aa.aa",
    "aa..aa.aa",
  ],
  info: [
    ".aaaaaaa.",
    "aaaa.aaaa",
    "aaaaaaaaa",
    "aaa..aaaa",
    "aaaa.aaaa",
    "aaaa.aaaa",
    "aaaa.aaaa",
    "aaa...aaa",
    ".aaaaaaa.",
  ],
  warn: [
    ".....a.....",
    "....aaa....",
    "....a.a....",
    "...aa.aa...",
    "...aa.aa...",
    "..aaa.aaa..",
    "..aaaaaaa..",
    ".aaaa.aaaa.",
    ".aaaaaaaaa.",
    "aaaaaaaaaaa",
  ],
  // Mascots for small moments. A lit body (a) with dark eyes (k), pink
  // cheeks (b) and one highlight (w). Two frames: eyes open, blink.
  blob: {
    frames: [
      [
        "...aaaaaa...",
        "..aaaaaaaa..",
        ".awwaaaaaaa.",
        ".awaaaaaaaa.",
        "aaakaaaakaaa",
        "aaakaaaakaaa",
        "abaaakkaaaba",
        "aaaaaaaaaaaa",
        ".aaaaaaaaaa.",
        "..aaaaaaaa..",
      ],
      [
        "...aaaaaa...",
        "..aaaaaaaa..",
        ".awwaaaaaaa.",
        ".awaaaaaaaa.",
        "aaaaaaaaaaaa",
        "aakkaaaakkaa",
        "abaaakkaaaba",
        "aaaaaaaaaaaa",
        ".aaaaaaaaaa.",
        "..aaaaaaaa..",
      ],
    ],
  },
  // Sleeping blob; the Z (w) drifts up a pixel between frames.
  sleepy: {
    frames: [
      [
        "..........wwww",
        "............w.",
        "...........w..",
        "..........wwww",
        "..............",
        "...aaaaaa.....",
        "..aaaaaaaa....",
        ".awaaaaaaaa...",
        "aaaaaaaaaaaa..",
        "aakkaaaakkaa..",
        "abaaaaaaaaba..",
        "aaaaakkaaaaa..",
        ".aaaaaaaaaa...",
        "..aaaaaaaa....",
      ],
      [
        ".........wwww.",
        "...........w..",
        "..........w...",
        ".........wwww.",
        "..............",
        "...aaaaaa.....",
        "..aaaaaaaa....",
        ".awaaaaaaaa...",
        "aaaaaaaaaaaa..",
        "aakkaaaakkaa..",
        "abaaaaaaaaba..",
        "aaaaakkaaaaa..",
        ".aaaaaaaaaa...",
        "..aaaaaaaa....",
      ],
    ],
  },
} as const satisfies Record<string, PixelIcon>;

export type IconName = keyof typeof ICONS;

/** Colour used for each key when the page CSS does not override it. */
export const PIXEL_FILL: Readonly<Record<PixelKey, string>> = {
  k: "var(--px-k,#0f1015)",
  w: "var(--px-w,#f2efe6)",
  a: "var(--px-a,currentColor)",
  b: "var(--px-b,#ff1aac)",
  y: "#fffa00",
  p: "#ff1aac",
  m: "#00ffa2",
  c: "#32fee3",
  g: "#8d8a9a",
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

/** The <path> elements for one grid, glyph first and details over it. */
export function pathsMarkup(grid: PixelGrid): string {
  let s = "";
  const paths = pixelPaths(grid);
  for (const key of PIXEL_KEYS) {
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
