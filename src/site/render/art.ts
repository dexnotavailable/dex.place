// Placeholder project scenes, drawn as real pixel art in code (never images,
// never Dex's art). Each is tagged "Placeholder art" and gets replaced by real
// imagery later. DESIGN-SYSTEM.md §5.
//
// A scene is an 80 x 50 cell canvas (16:10). Every piece is drawn cell by cell
// with the helpers below and turned into SVG paths (one rectangle per
// horizontal run, one path per colour), so the whole scene shares one pixel
// grid and scales as one: square cells, 1-cell outlines, 1-cell hard shadows,
// nothing rotated, no gradients. Colours are the site tokens, so the scenes
// follow the palette; `t` is the project's tone (--tone).
//
// Three depth layers per scene (back, mid, front) are stacked `.sc-it`
// elements with a depth `--d`: under a fine pointer they shift a little by
// depth (motion/magnet.ts). Small idle loops (a caret, a bar filling, an
// arrow dropping) move in whole cells with steps(); they rest off screen and
// never run under reduced motion. Styles: styles/landing.css (.scene, .sc-*).

import type { Project } from "../data/projects.ts";
import type { PixelGrid } from "../pixels.ts";
import { placeholderTag } from "./glyphs.ts";
import { cx } from "./html.ts";

export const SCENE_W = 80;
export const SCENE_H = 50;

/** Scene palette: one character per cell. `.` is transparent. */
export const SCENE_FILL = {
  K: "var(--shadow)",
  v: "#06070a",          // the void: terminal body, the world stage
  s: "var(--sunk)",
  b: "var(--bg)",
  n: "var(--panel)",
  N: "var(--panel-2)",
  l: "var(--line)",
  L: "var(--line-2)",
  f: "var(--fg)",
  u: "var(--muted)",
  o: "var(--on-accent)",
  y: "var(--yellow)",
  m: "var(--mint)",
  p: "var(--magenta)",
  c: "var(--cyan)",
  t: "var(--tone)",
  r: "#9b2e3a",          // the world's muted red floor line
} as const;
export type SceneKey = keyof typeof SCENE_FILL;
const KEYS = Object.keys(SCENE_FILL) as SceneKey[];

// ------------------------------------------------------------ sprites

/** Small pixel sprites placed into scenes. Keys as SCENE_FILL. */
export const SPRITES = {
  // Yuki's orb, as an abstract shape (no character art).
  orb: [
    "....KKKK....",
    "..KKccccKK..",
    ".KcffccccmK.",
    ".KcfccccmmK.",
    "KccccccmmmcK",
    "KcccccmmmmcK",
    "KccccmmmmmcK",
    "KcccmmmmmmcK",
    ".KccmmmmmcK.",
    ".KcmmmmmmcK.",
    "..KKmmmmKK..",
    "....KKKK....",
  ],
  // The installer's box: tone body, dark tape, a label.
  box: [
    "KKKKKKKKKKKKKK",
    "KfttttootttttK",
    "KtttttootttttK",
    "KKKKKKKKKKKKKK",
    ".KttttoottttK.",
    ".KttttoottttK.",
    ".KttttoottttK.",
    ".KttttttttttK.",
    ".KttKKKKKKttK.",
    ".KttKffffKttK.",
    ".KttKKKKKKttK.",
    ".KttttttttttK.",
    ".KKKKKKKKKKKK.",
  ],
  arrow: [
    ".KKKKK.",
    ".KtttK.",
    ".KtttK.",
    "KKtttKK",
    "KtttttK",
    ".KtttK.",
    "..KtK..",
    "...K...",
  ],
  cursor: [
    "K.......",
    "KK......",
    "KfK.....",
    "KffK....",
    "KfffK...",
    "KffffK..",
    "KfffffK.",
    "KfffKKKK",
    "KfKKfK..",
    "KK..KfK.",
    "K....KK.",
  ],
  check: [
    "KKKKKKKKK",
    "KpppppppK",
    "KpppppopK",
    "KppppoopK",
    "KpopooppK",
    "KpooopppK",
    "KppoppppK",
    "KpppppppK",
    "KKKKKKKKK",
  ],
  cloud: [
    "....lllll.......",
    "..lllllllllll...",
    "llllllllllllllll",
  ],
  traveller: [
    ".ff",
    ".ff",
    "pff",
    ".f.",
    "f.f",
  ],
  sparkle: [
    "..t..",
    "..t..",
    "ttftt",
    "..t..",
    "..t..",
  ],
} as const satisfies Record<string, PixelGrid>;

export type SpriteName = keyof typeof SPRITES;

/** Checks a sprite: rectangular, scene keys only. */
export function validateSprite(name: string, grid: PixelGrid): { width: number; height: number } {
  const width = grid[0]?.length ?? 0;
  if (!width) throw new Error(`sprite ${name} is empty`);
  grid.forEach((row, y) => {
    if (row.length !== width) throw new Error(`sprite ${name} row ${y} is ${row.length} wide, expected ${width}`);
    for (const ch of row) if (ch !== "." && !(ch in SCENE_FILL)) throw new Error(`sprite ${name} uses unknown key "${ch}"`);
  });
  return { width, height: grid.length };
}

// ------------------------------------------------------------ the canvas

/** An 80 x 50 grid of scene keys; draw into it, then `paths()`. */
export class Canvas {
  readonly w: number;
  readonly h: number;
  readonly cells: string[];
  constructor(w = SCENE_W, h = SCENE_H) {
    this.w = w;
    this.h = h;
    this.cells = new Array<string>(w * h).fill(".");
  }
  set(x: number, y: number, k: SceneKey | "."): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y * this.w + x] = k;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, k: SceneKey): this {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) this.set(i, j, k);
    return this;
  }
  /** A block: 1-cell edge, fill inside, and a 1-cell hard shadow down-right. */
  block(x: number, y: number, w: number, h: number, edge: SceneKey, fill: SceneKey, shadow = true): this {
    if (shadow) this.rect(x + 1, y + h, w, 1, "K").rect(x + w, y + 1, 1, h, "K");
    return this.rect(x, y, w, h, edge).rect(x + 1, y + 1, w - 2, h - 2, fill);
  }
  /** Places a sprite; `.` cells leave what is under them. */
  blit(name: SpriteName, x: number, y: number): this {
    const grid: PixelGrid = SPRITES[name];
    grid.forEach((row, j) => {
      for (let i = 0; i < row.length; i += 1) {
        const ch = row[i] as string;
        if (ch !== ".") this.set(x + i, y + j, ch as SceneKey);
      }
    });
    return this;
  }
  /** A pixel circle outline (midpoint), only where `keep` allows. */
  ring(cx0: number, cy0: number, r: number, k: SceneKey, keep: (x: number, y: number) => boolean): this {
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      for (const [dx, dy] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]] as const) {
        if (keep(cx0 + dx, cy0 + dy)) this.set(cx0 + dx, cy0 + dy, k);
      }
      y += 1;
      if (err < 0) err += 2 * y + 1;
      else { x -= 1; err += 2 * (y - x) + 1; }
    }
    return this;
  }
  /** SVG path data per key: one rectangle per horizontal run. */
  paths(): string {
    const runs = new Map<string, string>();
    for (let y = 0; y < this.h; y += 1) {
      let x = 0;
      while (x < this.w) {
        const k = this.cells[y * this.w + x] as string;
        if (k === ".") { x += 1; continue; }
        const start = x;
        while (x < this.w && this.cells[y * this.w + x] === k) x += 1;
        runs.set(k, (runs.get(k) ?? "") + `M${start} ${y}h${x - start}v1h${start - x}z`);
      }
    }
    let out = "";
    for (const k of KEYS) {
      const d = runs.get(k);
      if (d) out += `<path fill="${SCENE_FILL[k]}" d="${d}"/>`;
    }
    return out;
  }
}

// ------------------------------------------------------------ layers

interface Part {
  c: Canvas;
  /** Class for a part that moves on its own (idle loop, hover). */
  cls?: string;
  style?: string;
  /** Clip the part to this box (x, y, w, h), e.g. a window's inside. */
  clip?: readonly [number, number, number, number];
}

const partMarkup = (p: Part): string => {
  const g = `<g${p.cls ? ` class="${p.cls}"` : ""}${p.style ? ` style="${p.style}"` : ""}>${p.c.paths()}</g>`;
  if (!p.clip) return g;
  const [x, y, w, h] = p.clip;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" overflow="hidden">${g}</svg>`;
};

/** One depth layer: a full-frame SVG with its parts. `d` is the depth for motion/magnet.ts. */
function layer(d: number, n: number, parts: readonly Part[], cls?: string): string {
  return (
    `<div class="${cx("sc-it", cls)}" style="--d:${d};--n:${n}"><div class="sc-it__in">` +
    `<svg class="sc-l" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" preserveAspectRatio="none" shape-rendering="crispEdges" focusable="false">` +
    parts.map(partMarkup).join("") +
    `</svg></div></div>`
  );
}

const canvas = (): Canvas => new Canvas();

/** The back layer every scene shares: a sparse dot grid and the tone block. */
function back(block: readonly [number, number, number, number], extra?: (c: Canvas) => void): string {
  const c = canvas();
  for (let y = 3; y < SCENE_H; y += 8) for (let x = 3; x < SCENE_W; x += 8) c.set(x, y, "l");
  const [x, y, w, h] = block;
  c.rect(x, y, w, h, "t");
  extra?.(c);
  return layer(0.3, 0, [{ c }]);
}

// ------------------------------------------------------------ dexCode

function terminal(): string {
  // The window: 1-cell edge, a title bar with three lights, a dark body.
  const X = 9, Y = 10, W = 46, H = 29;
  const win = canvas().block(X, Y, W, H, "L", "v")
    .rect(X + 1, Y + 1, W - 2, 4, "N").rect(X + 1, Y + 5, W - 2, 1, "L")
    .rect(X + 3, Y + 2, 2, 2, "p").rect(X + 6, Y + 2, 2, 2, "y").rect(X + 9, Y + 2, 2, 2, "m");
  // The prompt chevron.
  win.set(X + 4, Y + 8, "m").set(X + 5, Y + 9, "m").set(X + 4, Y + 10, "m");
  // Code lines type in on reveal, one part each.
  const lines: Array<[number, number, number, SceneKey]> = [
    [X + 8, Y + 9, 14, "y"], [X + 4, Y + 13, 26, "f"], [X + 8, Y + 16, 20, "u"],
    [X + 8, Y + 19, 15, "c"], [X + 8, Y + 22, 9, "p"],
  ];
  const lineParts: Part[] = lines.map(([x, y, w, k], i) => ({
    c: canvas().rect(x, y, w, 1, k), cls: "sc-type", style: `--l:${i};transform-origin:${x}px ${y}px`,
  }));
  const caret: Part = { c: canvas().rect(X + 4, Y + 25, 2, 2, "y"), cls: "sc-loop sc-caret" };

  // Front: the thinking bubble over the tone block, the orb over the window edge.
  const bx = 43, by = 3;
  const bubble = canvas().block(bx, by, 12, 6, "K", "f", false)
    .set(bx + 2, by + 6, "K").set(bx + 3, by + 6, "f").set(bx + 4, by + 6, "K").set(bx + 3, by + 7, "K");
  const dots: Part[] = [0, 1, 2].map((i) => ({
    c: canvas().rect(bx + 2 + i * 3, by + 2, 2, 2, i === 1 ? "p" : "o"), cls: "sc-loop sc-blip", style: `animation-delay:${i * 200}ms`,
  }));
  const orb: Part = { c: canvas().blit("orb", 50, 27), cls: "sc-loop sc-bob" };
  const spark: Part = { c: canvas().blit("sparkle", 68, 24), cls: "sc-loop sc-twinkle" };

  return (
    back([59, 8, 15, 11]) +
    layer(0.7, 1, [{ c: win }, ...lineParts, caret]) +
    layer(1.2, 2, [{ c: bubble }, ...dots, orb, spark], "sc-front")
  );
}

// ------------------------------------------------------------ dexClient

function installer(): string {
  const X = 17, Y = 9, W = 48, H = 30;
  const win = canvas().block(X, Y, W, H, "L", "n")
    .rect(X + 1, Y + 1, W - 2, 4, "N").rect(X + 1, Y + 5, W - 2, 1, "L")
    .rect(X + W - 5, Y + 2, 2, 2, "L")
    .rect(X + 3, Y + 2, 12, 2, "u")
    .blit("box", X + 5, Y + 8)
    .rect(X + 23, Y + 10, 18, 1, "f").rect(X + 23, Y + 13, 11, 1, "L").rect(X + 23, Y + 16, 15, 1, "L");
  // The progress bar: 9 segments of 3 cells with 1-cell gaps.
  const bx = X + 5, by = Y + 23, bw = 38;
  win.rect(bx, by, bw, 4, "L").rect(bx + 1, by + 1, bw - 2, 2, "v");
  const empty = canvas();
  const full = canvas();
  for (let i = 0; i < 9; i += 1) {
    empty.rect(bx + 2 + i * 4, by + 1, 3, 2, "l");
    full.rect(bx + 2 + i * 4, by + 1, 3, 2, "t");
  }
  // A cover in the bar's own colour slides right a segment at a time.
  const cover = canvas().rect(bx + 1, by + 1, bw - 2, 2, "v");
  const clip = [bx + 1, by + 1, bw - 2, 2] as const;

  const drop: Part = { c: canvas().blit("arrow", X + 9, 0), cls: "sc-loop sc-drop" };
  const ptr: Part = { c: canvas().blit("cursor", 58, 31), cls: "sc-loop sc-tap" };
  const check: Part = { c: canvas().blit("check", 68, 12) };

  return (
    back([3, 30, 20, 14], (c) => c.rect(69, 37, 7, 1, "L").rect(69, 43, 7, 1, "L").rect(69, 38, 1, 5, "L").rect(75, 38, 1, 5, "L").set(77, 45, "L")) +
    layer(0.7, 1, [{ c: win }, { c: empty }, { c: full, clip }, { c: cover, clip, cls: "sc-loop sc-fill" }]) +
    layer(1.2, 2, [drop, check, ptr], "sc-front")
  );
}

// ------------------------------------------------------------ dex.place

function site(): string {
  // The world stage: night, a distant ring, an immense cropped tower, the
  // red floor line, a small traveller in the middle, a lit door, and the
  // black cinematic bars (they recede on hover).
  const X = 5, Y = 6, W = 50, H = 31;
  const floor = Y + 22;
  const inside = (x: number, y: number): boolean => x > X && x < X + W - 1 && y > Y && y < floor;
  const stage = canvas().block(X, Y, W, H, "L", "v")
    .ring(X + 24, floor, 17, "l", inside)
    .rect(X + 40, Y + 1, 6, floor - Y - 1, "n").rect(X + 40, Y + 1, 1, floor - Y - 1, "l").rect(X + 45, Y + 1, 1, floor - Y - 1, "l")
    .rect(X + 1, floor, W - 2, 1, "r").rect(X + 1, floor + 1, W - 2, H - 24, "b")
    .rect(X + 8, floor - 6, 4, 6, "L").rect(X + 9, floor - 5, 2, 5, "y");
  for (const [x, y, k] of [[8, 4, "f"], [15, 9, "u"], [22, 5, "f"], [30, 11, "u"], [36, 6, "f"], [4, 13, "u"], [26, 15, "u"]] as const) {
    stage.set(X + x, Y + y, k);
  }
  const clip = [X + 1, Y + 1, W - 2, H - 2] as const;
  const cloud: Part = { c: canvas().blit("cloud", X + 25, Y + 11), cls: "sc-loop sc-cloud", clip };
  const walker: Part = { c: canvas().blit("traveller", X + 18, floor - 5), cls: "sc-walk" };
  const barT: Part = { c: canvas().rect(X + 1, Y + 1, W - 2, 4, "K"), cls: "sc-bar sc-bar--t", clip };
  const barB: Part = { c: canvas().rect(X + 1, Y + H - 5, W - 2, 4, "K"), cls: "sc-bar sc-bar--b", clip };

  // The site sheet rising over it, with its four-colour top edge.
  const SX = 29, SY = 25, SW = 46, SH = 21;
  const sheet = canvas().block(SX, SY, SW, SH, "L", "b")
    .rect(SX, SY, 12, 1, "y").rect(SX + 12, SY, 11, 1, "p").rect(SX + 23, SY, 11, 1, "m").rect(SX + 34, SY + 0, 12, 1, "c")
    .rect(SX + 3, SY + 3, 6, 3, "y")
    .rect(SX + 25, SY + 4, 3, 1, "y").rect(SX + 30, SY + 4, 3, 1, "L").rect(SX + 35, SY + 4, 3, 1, "L").rect(SX + 40, SY + 4, 3, 1, "L")
    .rect(SX + 3, SY + 8, 17, 2, "f").rect(SX + 3, SY + 11, 5, 1, "t");
  for (const [i, k] of (["m", "N", "y", "p"] as const).entries()) sheet.block(SX + 3 + i * 6, SY + 14, 5, 4, k === "N" ? "L" : k, k);
  sheet.block(SX + 28, SY + 13, 7, 5, "l", "n", false).block(SX + 36, SY + 13, 7, 5, "m", "n", false);

  return (
    back([60, 2, 16, 12]) +
    layer(0.7, 1, [{ c: stage }, cloud, walker, barT, barB]) +
    layer(1.2, 2, [{ c: sheet, cls: "sc-sheet" }, { c: canvas().blit("sparkle", 71, 17), cls: "sc-loop sc-twinkle" }], "sc-front")
  );
}

/** The scene frame for one project. `size` only changes the frame's styling. */
export function projectArt(p: Project, size: "card" | "hero" = "card"): string {
  const scene = p.art === "terminal" ? terminal() : p.art === "installer" ? installer() : site();
  return (
    `<div class="${cx("scene", `scene--${p.tone}`, `scene--${p.art}`, `scene--${size}`)}" data-tilt-scene aria-hidden="true">` +
    `<div class="scene__box">${scene}</div></div>`
  );
}

/** "Placeholder art" tag, kept outside the aria-hidden scene so it is read. */
export const artTag = (p: Project): string => (p.placeholder ? placeholderTag("Placeholder art") : "");
