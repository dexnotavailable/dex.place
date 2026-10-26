// Pixel Yuki: YUKI's face as a 32 x 32 chibi bust, drawn in code (CANON and the YUKI brief: materials are made with
// code, no image generation). One character per pixel, one SVG path per colour, one SVG unit per pixel, so it stays
// crisp at any whole-number scale. DOM-free: it renders at build time and runs under `node --test`.
//
// Drawn to Dex's pixel-face rules (YUKI docs/build/PHASE2-SCOPE.md W5): a head-only bust about two thirds of the
// canvas; eyes a little below the head's middle, an iris 4 px wide and 5 tall under a dark lid with a one-pixel outward
// flick, three tones from dark on top to bright below, a white highlight, no lower lash; no nose; a two-pixel mouth;
// blush under the outer corners; bangs over the brows; one lighter band in the hair; outlines a darker hue of their
// colour, never black (the lid is the one black). Her colours are the orb's (YUKI packages/yuki-orb art.ts): white
// hair with lilac shade, blue eyes, red only on the hairpin and the collar gem.
//
// Layers, so a face changes without redrawing her: the base (hair, skin with the eyes and mouth left out, the cloak),
// the eyes (one layer per expression, eye pixels only, so a glance is the layer moved one pixel sideways over plain
// skin), the mouth (one per shape) and the ahoge (two frames, it sways). styles/yuki.css shows one of each.

/** Her palette. The keys are this sprite's own (pixels.ts has the icons' keys). */
export const YUKI_PALETTE = {
  o: "#4a4366", // hair outline
  H: "#e8e5f2", // hair
  L: "#ffffff", // the hair's light band
  h: "#cbc5de", // hair shade
  d: "#a29bbe", // bang tips
  x: "#bdb6d2", // the side hair's inner shade
  S: "#fff1ea", // skin
  s: "#f8d9cf", // skin in shadow (under the bangs, the neck)
  e: "#eab4a6", // jaw line
  K: "#1c1430", // lid and lash (the one near-black)
  I: "#1b2486", // iris, top
  i: "#2c9ef5", // iris
  j: "#8fe6ff", // iris, bottom
  W: "#ffffff", // highlight
  B: "#ffa3b8", // blush
  M: "#c4505f", // mouth
  m: "#7d2a40", // mouth, open
  R: "#e8303a", // hairpin
  r: "#8f1020", // hairpin and gem, dark
  g: "#ffb3b8", // hairpin and gem, light
  G: "#e8303a", // gem
  C: "#e6e8f7", // cloak
  c: "#bfc3e0", // cloak shade
  q: "#4f5287", // cloak outline
  F: "#ffffff", // fur collar
  f: "#d6d7ea", // fur shade
} as const;
export type YukiKey = keyof typeof YUKI_PALETTE;

/** The base: everything but the eyes, the mouth and the ahoge. */
export const YUKI_BASE: readonly string[] = [
  "................................",
  "................................",
  "..............oooo..............",
  "...........oooHHHHooo...........",
  ".........ooHLLLLLLLLHoo.........",
  "........oHLLHHHHHHHHLLHo........",
  ".......oHLHHHHHHHHHHHHLHo.......",
  "......oHLHHHHHHHHHHHHHHLHo......",
  "......oHHHHHHHHHHHHHHHHHHo......",
  ".....oHHHHHHHHHHHHHHHHHHRHo.....",
  ".....oHHHHhHHhHHHHhHHhHRgRo.....",
  ".....oHHHHhHHhHHHHhHHhHrRro.....",
  "....oHHHHHdHddHHHHddHdHHHHHo....",
  "....oHHHhdsdssdHHdssdsdhHHHo....",
  "....oHHxdsSSSSsddsSSSSsdxHHo....",
  "....oHxSSSSSSSSSSSSSSSSSSxHo....",
  "....oHxSSSSSSSSSSSSSSSSSSxHo....",
  "....oHxSSSSSSSSSSSSSSSSSSxHo....",
  "....oHxSSSSSSSSSSSSSSSSSSxHo....",
  "....oHxSSSSSSSSSSSSSSSSSSxHo....",
  "....oHxSBBSSSSSSSSSSSSBBSxHo....",
  "....oHHxSSSSSSSSSSSSSSSSxHHo....",
  ".....oHxSSSSSSSSSSSSSSSSxHo.....",
  ".....oHxeSSSSSSSSSSSSSSexHo.....",
  "......oo.eeSSSSSSSSSSee.oo......",
  ".......oo..eessssssee..oo.......",
  "........o..qFFssssFFq..o........",
  ".........qqfFFFssFFFfqq.........",
  "......qqqfFFFfFgGFfFFFfqqq......",
  "....qqCFFFFFfFFGrFFfFFFFFCqq....",
  "...qCCCcCCCCCCCccCCCCCCCcCCCq...",
  "...qqqqqqqqqqqqqqqqqqqqqqqqqq...",
];

/** The eyes, rows 15-20 of the bust, its full width (every other pixel empty, the base's skin shows). */
const eyes = (rows: readonly string[]): readonly string[] => [
  ...Array.from({ length: 15 }, () => ".".repeat(32)),
  ...rows,
  ...Array.from({ length: 11 }, () => ".".repeat(32)),
];

export const YUKI_EYES = {
  /** Open, looking at you. */
  open: eyes([
    ".......KKKKK........KKKKK.......",
    "........KKIIK......KIIKK........",
    "........KIWII......IIWIK........",
    ".........IWii......iiWI.........",
    ".........iiij......jiii.........",
    "..........jj........jj..........",
  ]),
  /** Shut for a blink: the lash as one line, the flick kept. */
  blink: eyes([
    "................................",
    "................................",
    ".......K................K.......",
    "........KKKKK......KKKKK........",
    "................................",
    "................................",
  ]),
  /** ^ ^ */
  happy: eyes([
    "................................",
    ".........KK..........KK.........",
    "........K..K........K..K........",
    ".......K....K......K....K.......",
    "................................",
    "................................",
  ]),
  /** Asleep: two soft arcs the other way up. */
  sleepy: eyes([
    "................................",
    "................................",
    "................................",
    ".......K....K......K....K.......",
    "........KKKK........KKKK........",
    "................................",
  ]),
} as const satisfies Record<string, readonly string[]>;
export type YukiEyes = keyof typeof YUKI_EYES;

const mouth = (r21: string, r22 = "......"): readonly string[] => [
  ...Array.from({ length: 21 }, () => ".".repeat(32)),
  `.............${r21}.............`,
  `.............${r22}.............`,
  ...Array.from({ length: 9 }, () => ".".repeat(32)),
];

export const YUKI_MOUTHS = {
  /** Two pixels, calm. */
  calm: mouth("..MM.."),
  /** A small cat smile. */
  smile: mouth(".M..M.", "..MM.."),
  /** Open, mid-word. */
  talk: mouth("..mm..", "..mm.."),
} as const satisfies Record<string, readonly string[]>;
export type YukiMouth = keyof typeof YUKI_MOUTHS;

/** The ahoge, rows 0-2: two frames (it sways). */
export const YUKI_AHOGE: readonly (readonly string[])[] = [
  ["..................oo............", ".................o..o...........", "................oo.............."],
  [".................oo.............", "................o..o............", "................oo.............."],
];

const SIZE = 32;

/** Checks a layer: 32 rows of 32, known keys only. */
export function validateLayer(name: string, rows: readonly string[]): void {
  if (rows.length !== SIZE) throw new Error(`yuki ${name}: ${rows.length} rows, expected ${SIZE}`);
  rows.forEach((row, y) => {
    if (row.length !== SIZE) throw new Error(`yuki ${name} row ${y}: ${row.length} wide, expected ${SIZE}`);
    for (const ch of row) if (ch !== "." && !(ch in YUKI_PALETTE)) throw new Error(`yuki ${name}: unknown key "${ch}"`);
  });
}

/** One <path> per colour, one rectangle per horizontal run (as pixels.ts does for the icons). */
export function layerPaths(rows: readonly string[]): string {
  const runs = new Map<string, string>();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x] as string;
      if (ch === ".") { x += 1; continue; }
      const start = x;
      while (x < row.length && row[x] === ch) x += 1;
      runs.set(ch, (runs.get(ch) ?? "") + `M${start} ${y}h${x - start}v1h${start - x}z`);
    }
  });
  let out = "";
  for (const [ch, d] of runs) out += `<path fill="${YUKI_PALETTE[ch as YukiKey]}" d="${d}"/>`;
  return out;
}

export interface YukiSpriteOptions {
  /** Screen pixels per sprite pixel (whole numbers keep it crisp); omit to size it in CSS. */
  scale?: number;
  /** The face she starts with (styles/yuki.css shows it; motion/yuki.ts changes it). */
  eyes?: YukiEyes;
  mouth?: YukiMouth;
  className?: string;
  /** Accessible name; without it she is decorative. */
  label?: string;
}

/**
 * Pixel Yuki as inline SVG: `svg.yk[data-eyes][data-mouth]` with a group per layer. Every expression is in the
 * markup; the data attributes pick which shows, so a change of face is one attribute and never a fetch.
 */
export function yukiSprite(o: YukiSpriteOptions = {}): string {
  const scale = o.scale;
  const size = scale ? ` width="${SIZE * scale}" height="${SIZE * scale}"` : "";
  const a11y = o.label
    ? `role="img" aria-label="${o.label.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}"`
    : `aria-hidden="true" focusable="false"`;
  const group = (cls: string, rows: readonly string[], attr = ""): string => `<g class="${cls}"${attr}>${layerPaths(rows)}</g>`;
  return (
    `<svg class="yk${o.className ? ` ${o.className}` : ""}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}"${size} ` +
    `shape-rendering="crispEdges" data-eyes="${o.eyes ?? "open"}" data-mouth="${o.mouth ?? "calm"}" ${a11y}>` +
    `<g class="yk__body">` +
    YUKI_AHOGE.map((rows, i) => group(`yk__ahoge yk__ahoge--${i}`, [...rows, ...Array.from({ length: SIZE - 3 }, () => ".".repeat(SIZE))])).join("") +
    group("yk__base", YUKI_BASE) +
    `<g class="yk__eyes">` +
    (Object.keys(YUKI_EYES) as YukiEyes[]).map((k) => group(`yk__e yk__e--${k}`, YUKI_EYES[k])).join("") +
    `</g>` +
    (Object.keys(YUKI_MOUTHS) as YukiMouth[]).map((k) => group(`yk__m yk__m--${k}`, YUKI_MOUTHS[k])).join("") +
    `</g></svg>`
  );
}
