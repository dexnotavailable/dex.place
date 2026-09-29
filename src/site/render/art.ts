// Placeholder project scenes: blocky layered compositions drawn in HTML/CSS
// and pixel grids (never images, never Dex's art). Each is tagged
// "Placeholder art" and gets replaced by real imagery later.
//
// A scene is a 16:10 frame (a size container, so every piece is sized in cqi
// and the whole composition scales as one). Pieces are `.it` layers with a
// depth `--d` (1 far .. 4 near): on reveal they pop in near-last, with the
// cursor they shift by depth (motion/magnet.ts sets each layer's translate), and on hover
// the near ones grow a little. Styles: styles/landing.css (.scene*, .it*).

import type { Project } from "../data/projects.ts";
import { PIXEL_FILL, PIXEL_KEYS, pixelPaths, validateIcon, type PixelGrid } from "../pixels.ts";
import { icon, placeholderTag } from "./glyphs.ts";
import { cx } from "./html.ts";

// ------------------------------------------------------------ scene sprites
// Larger pixel pieces used only by the scenes. Same key as pixels.ts.

export const SPRITES = {
  // Yuki's orb, as an abstract shape (no character art).
  orb: [
    "....kkkk....",
    "..kkcccckk..",
    ".kcwwccccck.",
    ".kcwccccmck.",
    "kccccccmmcck",
    "kcccccmmmcck",
    "kccccmmmmmck",
    "kcccmmmmmmck",
    ".kccmmmmmck.",
    ".kcmmmmmmck.",
    "..kkmmmmkk..",
    "....kkkk....",
  ],
  box: [
    "kkkkkkkkkkkkkkkk",
    "kwyyyyyppyyyyyyk",
    "kyyyyyyppyyyyyyk",
    "kkkkkkkkkkkkkkkk",
    ".kyyyyyppyyyyyk.",
    ".kyyyyyppyyyyyk.",
    ".kyyyyyppyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyykkkkkkyyyk.",
    ".kyyykwwwwkyyyk.",
    ".kyyykkkkkkyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kkkkkkkkkkkkkk.",
  ],
  play: [
    "kk.....",
    "kakk...",
    "kaaakk.",
    "kaaaaak",
    "kaaakk.",
    "kakk...",
    "kk.....",
  ],
  prompt: [
    "k....",
    "kk...",
    ".kk..",
    "..kk.",
    ".kk..",
    "kk...",
    "k....",
  ],
  cloud: [
    "....kkkk......",
    "..kkwwwwkkkk..",
    ".kwwwwwwwwwwk.",
    "kwwwwwwwwwwggk",
    ".kkkkkkkkkkkk.",
  ],
  door: [
    ".kkkkkkkk.",
    "kkyyyyyykk",
    "kyywwwwyyk",
    "kywwwwwwyk",
    "kywwwwwwyk",
    "kywwwwwwyk",
    "kywwwwwwyk",
    "kywwwwwwyk",
    "kywwwwwwyk",
    "kywwwwwwyk",
    "kywwwwwwyk",
    "kkkkkkkkkk",
  ],
} as const satisfies Record<string, PixelGrid>;

export type SpriteName = keyof typeof SPRITES;

/** A scene sprite as inline SVG. Sized by CSS (cqi), so no width/height attrs. */
export function sprite(name: SpriteName, className?: string): string {
  const grid: PixelGrid = SPRITES[name];
  const { width, height } = validateIcon(name, grid);
  const paths = pixelPaths(grid);
  let body = "";
  for (const key of [...PIXEL_KEYS.filter((k) => k !== "k"), "k" as const]) {
    const d = paths.get(key);
    if (d) body += `<path fill="${PIXEL_FILL[key]}" d="${d}"/>`;
  }
  return (
    `<svg class="${cx("spr", `spr--${name}`, className)}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `style="aspect-ratio:${width}/${height}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`
  );
}

// ------------------------------------------------------------------- layers

interface Layer {
  /** Position and size in % of the frame / cqi; any extra CSS. */
  style: string;
  /** Depth 1 (far) .. 4 (near). */
  d: 1 | 2 | 3 | 4;
  cls?: string;
  html?: string;
  /** Reveal order (stagger), 0.. */
  n: number;
}

const layer = (l: Layer): string =>
  `<div class="${cx("sc-it", l.cls)}" style="--d:${l.d};--n:${l.n};${l.style}"><div class="sc-it__in">${l.html ?? ""}</div></div>`;

function terminal(): string {
  const lines = [
    ["mint", 46], ["paper", 78], ["cyan", 58], ["magenta", 34], ["paper", 66],
  ] as const;
  const body =
    `<div class="sc-term__bar"><i></i><i></i><i></i></div>` +
    `<div class="sc-term__body">` +
    `<p class="sc-term__row">${sprite("prompt", "sc-term__prompt")}<span class="sc-term__line sc-term__line--yellow" style="--w:40%;--l:0"></span></p>` +
    lines.map(([t, w], i) => `<span class="sc-term__line sc-term__line--${t}" style="--w:${w}%;--l:${i + 1}"></span>`).join("") +
    `<span class="sc-term__caret"></span></div>`;
  return [
    layer({ d: 1, n: 0, cls: "sc-blk sc-blk--magenta", style: "left:69%;top:-9%;width:38cqi;height:22cqi;--r:7deg" }),
    layer({ d: 1, n: 0, cls: "sc-dots", style: "left:4%;top:7%;width:17cqi;height:8cqi" }),
    layer({ d: 1, n: 1, cls: "sc-blk sc-blk--paper", style: "left:-5%;top:74%;width:22cqi;height:14cqi;--r:-5deg" }),
    layer({ d: 2, n: 1, cls: "sc-term", style: "left:11%;top:15%;width:58cqi;height:41cqi", html: body }),
    layer({ d: 3, n: 2, cls: "sc-bubble", style: "left:62%;top:11%", html: "<i></i><i></i><i></i>" }),
    layer({ d: 3, n: 3, cls: "sc-blk sc-blk--mint sc-blk--key", style: "left:5%;top:60%;width:12cqi;height:12cqi;--r:-8deg", html: icon("sparkle", 3) }),
    layer({ d: 4, n: 3, cls: "sc-orb", style: "left:70%;top:47%;width:17cqi", html: `<span class="sc-orb__ring"></span>${sprite("orb")}` }),
    layer({ d: 4, n: 4, cls: "sc-stk", style: "left:87%;top:40%;--r:12deg", html: icon("sparkle", 3) }),
  ].join("");
}

function installer(): string {
  const segs = Array.from({ length: 10 }, (_, i) => `<i style="--s:${i}"></i>`).join("");
  const win =
    `<div class="sc-inst__row">${sprite("box", "sc-inst__box")}` +
    `<span class="sc-inst__lines"><i style="--w:88%"></i><i style="--w:56%"></i><i style="--w:70%"></i></span></div>` +
    `<div class="sc-inst__bar">${segs}</div>`;
  return [
    layer({ d: 1, n: 0, cls: "sc-blk sc-blk--yellow", style: "left:-7%;top:58%;width:34cqi;height:26cqi;--r:-6deg" }),
    layer({ d: 1, n: 0, cls: "sc-pill sc-pill--cyan", style: "left:74%;top:6%;width:30cqi;height:9cqi;--r:4deg" }),
    layer({ d: 1, n: 1, cls: "sc-dots", style: "left:80%;top:78%;width:16cqi;height:8cqi" }),
    layer({ d: 2, n: 1, cls: "sc-win sc-inst", style: "left:21%;top:17%;width:56cqi;height:38cqi", html: win }),
    layer({ d: 3, n: 2, cls: "sc-drop", style: "left:27%;top:7%;width:8cqi", html: icon("download", 4) }),
    layer({ d: 3, n: 3, cls: "sc-blk sc-blk--ink sc-blk--play", style: "left:62%;top:59%;width:17cqi;height:12cqi;--r:3deg", html: sprite("play") }),
    layer({ d: 4, n: 3, cls: "sc-tile-it", style: "left:8%;top:14%;--r:-10deg", html: `<span class="tile tile--magenta tile--m">${icon("check", 3)}</span>` }),
    layer({ d: 4, n: 4, cls: "sc-ptr", style: "left:75%;top:69%;width:6cqi", html: icon("cursor", 4) }),
  ].join("");
}

function site(): string {
  const stage =
    `<span class="sc-stage__stars"></span><span class="sc-stage__ring"></span>` +
    `${sprite("cloud", "sc-stage__cloud sc-stage__cloud--a")}${sprite("cloud", "sc-stage__cloud sc-stage__cloud--b")}` +
    `<span class="sc-stage__floor"></span>${sprite("door", "sc-stage__door")}` +
    `<span class="sc-stage__bar sc-stage__bar--t"></span><span class="sc-stage__bar sc-stage__bar--b"></span>`;
  const tiles = (["download", "frame", "book", "heart"] as const)
    .map((n, i) => `<span class="sc-sheet__tile sc-sheet__tile--${i}">${icon(n, 2)}</span>`).join("");
  const sheet =
    `<span class="sc-sheet__nav"><span class="sc-sheet__mark mark">dex</span><i></i><i></i><i></i><i></i></span>` +
    `<span class="sc-sheet__slab"></span><span class="sc-sheet__tiles">${tiles}</span>` +
    `<span class="sc-sheet__cards"><i></i><i></i><i></i></span>`;
  return [
    layer({ d: 1, n: 0, cls: "sc-blk sc-blk--yellow", style: "left:72%;top:-8%;width:30cqi;height:20cqi;--r:-7deg" }),
    layer({ d: 1, n: 0, cls: "sc-dots", style: "left:3%;top:80%;width:18cqi;height:8cqi" }),
    layer({ d: 2, n: 1, cls: "sc-stage", style: "left:7%;top:9%;width:62cqi;height:42cqi", html: stage }),
    layer({ d: 3, n: 2, cls: "sc-sheet", style: "left:37%;top:40%;width:54cqi;height:35cqi", html: sheet }),
    layer({ d: 4, n: 3, cls: "sc-stk sc-stk--mint", style: "left:86%;top:15%;--r:10deg", html: icon("star", 4) }),
    layer({ d: 4, n: 4, cls: "sc-stk", style: "left:22%;top:72%;--r:-9deg", html: icon("heart", 4) }),
  ].join("");
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
