// YUKI's art, made with code (Dex 10-26, YUKI docs/build/PHASE2-SCOPE.md "The feel": materials are made with code, no
// image generation): pixel Yuki (yuki-sprite.ts) at a whole-number scale in a snowy night, inside her orb's ring (the
// round portrait she lives in, in the app), ice shards drifting by, snow falling behind her. Every pixel of the scene is
// one stage unit, and a stage unit is a whole number of screen pixels (styles/yuki.css --u), so it stays crisp at any
// size: the snow too is one cell a flake, falling a cell at a time (a finer speck over her face read as a stray pixel).
//
// One stage feeds every place YUKI shows: its banner's hero window and back layer (render/pbanner.ts), its card in
// "Other projects" (render/cardart.ts), its block on Downloads and the big stage on /yuki/ (render/yuki.ts). Her face
// in a tile stands in for the site's generic mascot wherever a step or fact of hers would show it (yukiTileOr).
// Decorative everywhere except where a caller gives it a label. Reduced motion: all still (styles/yuki.css).

import { blinkVars, yukiSprite, type YukiEyes, type YukiMouth } from "../yuki-sprite.ts";
import type { Tone } from "../data/projects.ts";
import type { IconName } from "../pixels.ts";
import { tile } from "./glyphs.ts";
import { cx, esc, rng } from "./html.ts";

/** Night, top to bottom: hard bands (a pixel sky has steps, not a gradient). */
export const NIGHT = ["#0b0a20", "#100f30", "#161a45", "#1c2559", "#22306e"] as const;
const ICE = { edge: "#2d8fc4", body: "#8fe6ff", core: "#ffffff", deep: "#1b5f97" } as const;
const RING = { outer: "#dff7ff", inner: "#34e1ff", glow: "#34e1ff" } as const;
/** Her orb's radius in cells, round her head (14 rows down her 32 x 32 bust): its top is 6 cells over the bust's, 38
 *  cells up from the foot of a stage she stands at the bottom of (styles/yuki.css puts her line's bubble just over it). */
export const ORB = 20;
/** The hatch (the /yuki/ stage, once): her orb's ring grows through these radii, a frame each, before the whole ring. */
export const GROW = [3, 6, 9, 12, 15, 18] as const;
/** The flash as the orb opens: one opaque frame filling it, one a band of light just outside its ring, then a cut. */
const FLASH = "#d6f3ff";

/** A midpoint circle of radius r around (cx, cy), as cells. */
export function ringCells(cx: number, cy: number, r: number): [number, number][] {
  const out: [number, number][] = [];
  let x = r, y = 0, err = 1 - r;
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]] as const) out.push([cx + a, cy + b]);
    y += 1;
    if (err < 0) err += 2 * y + 1;
    else { x -= 1; err += 2 * (y - x) + 1; }
  }
  const seen = new Set<string>();
  return out.filter(([a, b]) => (seen.has(`${a},${b}`) ? false : (seen.add(`${a},${b}`), true)));
}

/**
 * A filled pixel disc: every row a midpoint circle of radius r spans, one rectangle a row. Her orb's glow is three of
 * these, stepped in whole cells like the ring (a smooth circle's edge would step in screen pixels, off her grid).
 */
export function discPath(cx: number, cy: number, r: number, fill: string, extra = ""): string {
  const rows = new Map<number, [number, number]>();
  for (const [x, y] of ringCells(cx, cy, r)) {
    const e = rows.get(y);
    rows.set(y, e ? [Math.min(e[0], x), Math.max(e[1], x)] : [x, x]);
  }
  const d = [...rows].sort(([a], [b]) => a - b).map(([y, [a, b]]) => `M${a} ${y}h${b - a + 1}v1h${a - b - 1}z`).join("");
  return `<path fill="${fill}"${extra} d="${d}"/>`;
}

/** A pixel annulus: the cells of a radius-`r` disc that are outside a radius-`hole` disc, one or two runs a row. */
export function bandPath(cx: number, cy: number, r: number, hole: number, fill: string): string {
  const span = (rad: number): Map<number, [number, number]> => {
    const rows = new Map<number, [number, number]>();
    for (const [x, y] of ringCells(cx, cy, rad)) {
      const e = rows.get(y);
      rows.set(y, e ? [Math.min(e[0], x), Math.max(e[1], x)] : [x, x]);
    }
    return rows;
  };
  const outer = span(r), inner = span(hole);
  let d = "";
  for (const [y, [a, b]] of [...outer].sort(([p], [q]) => p - q)) {
    const h = inner.get(y);
    const runs: [number, number][] = h ? [[a, h[0] - 1], [h[1] + 1, b]] : [[a, b]];
    for (const [x0, x1] of runs) if (x1 >= x0) d += `M${x0} ${y}h${x1 - x0 + 1}v1h${x0 - x1 - 1}z`;
  }
  return `<path fill="${fill}" d="${d}"/>`;
}

/** Cells as one path (one rectangle each). */
const cellsPath = (cells: readonly (readonly [number, number])[], fill: string, extra = ""): string =>
  cells.length ? `<path fill="${fill}"${extra} d="${cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("")}"/>` : "";

/** An ice shard: a tall pixel crystal, `h` cells high (odd), as paths at (x, y) = its top. */
export function shard(x: number, y: number, h: number): string {
  const mid = (h - 1) / 2;
  const edge: [number, number][] = [], body: [number, number][] = [], core: [number, number][] = [];
  for (let r = 0; r < h; r++) {
    const half = Math.round((1 - Math.abs(r - mid) / mid) * Math.max(1, Math.floor(h / 5)));
    for (let c = -half; c <= half; c++) {
      const at: [number, number] = [x + c, y + r];
      if (Math.abs(c) === half) edge.push(at);
      else if (c === 0 && r > 1 && r < h - 2) core.push(at);
      else body.push(at);
    }
  }
  return cellsPath(edge, ICE.edge) + cellsPath(body, ICE.body) + cellsPath(core, ICE.core);
}

/** A six-armed pixel snowflake (5 x 5), at (x, y) = its centre. */
function flake(x: number, y: number, fill = "#dff7ff"): string {
  const cells: [number, number][] = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2], [-2, 0], [2, 0], [-2, -2], [2, -2], [-2, 2], [2, 2]];
  return cellsPath(cells.map(([a, b]) => [x + a, y + b] as [number, number]), fill);
}

export interface StageOptions {
  /** Stage size in cells (each cell a whole number of screen px, styles/yuki.css). */
  cols: number;
  rows: number;
  /** Seeds the stars, flakes and shards, so a stage is the same on every build. */
  seed: string;
  /** Her face to start with, or no Yuki at all (a back layer). */
  yuki?: { eyes?: YukiEyes; mouth?: YukiMouth } | null;
  /** Her orb's ring behind her. */
  ring?: boolean;
  /** How many ice shards drift by. */
  shards?: number;
  /** Where she stands: her bust's left cell (default: centred) and how far her chin sits up from the bottom. */
  at?: { x?: number; lift?: number };
  /** Which part to draw: all of it, only the night behind her, or only her (two stages stacked, something between). */
  layer?: "all" | "back" | "her";
  /** How the stage sits in a box of another shape: on its bottom edge (default) or around its middle (a card). */
  align?: "bottom" | "middle";
  /** The hatch's frames (the /yuki/ stage): the ring's growth, the flash, the pixels flying out. Hidden until it plays
   *  (styles/yuki.css), each a drawing of its own on her grid, never a scaled one. */
  hatch?: boolean;
}

/** The hatch's ring growth: each radius its own two-tone ring, shown a frame each (styles/yuki.css). */
function growFrames(hx: number, hy: number): string {
  return `<g class="ykstage__grow">${GROW.map((rad, k) =>
    `<g style="--k:${k}">${cellsPath(ringCells(hx, hy, rad), RING.outer)}${cellsPath(ringCells(hx, hy, rad - 1), RING.inner)}</g>`).join("")}</g>`;
}

/** The flash (two opaque frames: the orb full of light, then a band of it just outside the ring) and eight pixels flying
 *  out from the ring along the grid's eight directions, a cell a step, white and cyan by turns. */
function openFrames(hx: number, hy: number): string {
  const flash = `<g class="ykstage__fl ykstage__fl--a">${discPath(hx, hy, ORB - 1, FLASH)}</g>` +
    `<g class="ykstage__fl ykstage__fl--b">${bandPath(hx, hy, ORB + 3, ORB, FLASH)}</g>`;
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]] as const;
  const burst = dirs.map(([dx, dy], i) => {
    const diag = dx !== 0 && dy !== 0;
    const from = diag ? Math.round((ORB + 4) / Math.SQRT2) : ORB + 4;
    const k = diag ? 7 : 10;
    return `<g style="--i:${i};--k:${k};--dx:${dx * k};--dy:${dy * k}">${cellsPath([[hx + dx * from, hy + dy * from]], i % 2 ? RING.inner : "#ffffff")}</g>`;
  }).join("");
  return `<g class="ykstage__open">${flash}<g class="ykstage__burst">${burst}</g></g>`;
}

/**
 * The stage as an inline SVG (`svg.ykstage`, one unit a cell): night bands, stars, her orb's ring and glow, shards,
 * flakes, then Yuki. Shards are `g.ykstage__shard` (they bob in CSS); her ring is `g.ykstage__ring` (it pulses); she
 * is `svg.yk` nested at a whole cell, so her pixels land on the stage's. Her blink's clock is the stage's seed's.
 */
export function yukiStage(o: StageOptions): string {
  const r = rng(o.seed);
  const { cols, rows } = o;
  const layer = o.layer ?? "all";
  let s = "";
  // the night, in bands
  NIGHT.forEach((c, i) => {
    const y0 = Math.round((i / NIGHT.length) * rows), y1 = Math.round(((i + 1) / NIGHT.length) * rows);
    s += `<rect x="0" y="${y0}" width="${cols}" height="${y1 - y0}" fill="${c}"/>`;
  });
  // where she stands
  const sx = o.at?.x ?? Math.round((cols - 32) / 2);
  const sy = rows - 32 + (o.at?.lift ?? 0);
  // her orb: a ring round her head and hair (the app's bust is wide with her long hair), its top just over her ahoge
  const head: [number, number] = [sx + 16, sy + 14];
  // stars: one-cell dots, two brightnesses, never on her
  const stars: [number, number][] = [], dim: [number, number][] = [];
  for (let i = 0; i < Math.round((cols * rows) / 55); i++) {
    const x = Math.floor(r() * cols), y = Math.floor(r() * rows * 0.8);
    if (Math.hypot(x - head[0], y - head[1]) < ORB + 2) continue;
    (r() < 0.35 ? stars : dim).push([x, y]);
  }
  s += cellsPath(dim, "#5a6aa8") + cellsPath(stars, "#cfe9ff");
  // her orb: a stepped glow and a two-tone ring
  if (o.ring !== false && o.yuki !== null) {
    const glow = [ORB, ORB - 3, ORB - 6].map((rad, i) => discPath(head[0], head[1], rad, RING.glow, ` opacity="${[0.07, 0.08, 0.1][i]}"`)).join("");
    s += `<g class="ykstage__ring" style="--hx:${head[0] + 0.5}px;--hy:${head[1] + 0.5}px">${glow}${cellsPath(ringCells(head[0], head[1], ORB), RING.outer)}${cellsPath(ringCells(head[0], head[1], ORB - 1), RING.inner, ' opacity="0.85"')}</g>`;
    if (o.hatch) s += growFrames(head[0], head[1]);
  }
  // ice shards: either side of her, seeded heights and places
  const n = o.shards ?? 4;
  for (let i = 0; i < n; i++) {
    const left = i % 2 === 0;
    const h = 7 + 2 * Math.floor(r() * 4);
    const band = left ? [2, Math.max(3, sx - 6)] : [Math.min(cols - 4, sx + 37), cols - 3];
    const x = Math.round(band[0]! + r() * Math.max(0, band[1]! - band[0]!));
    const y = Math.round(rows * 0.08 + r() * rows * 0.5);
    s += `<g class="ykstage__shard" style="--i:${i}">${shard(x, y, h)}</g>`;
  }
  // a few big flakes, away from her face
  for (let i = 0; i < Math.max(2, Math.round(cols / 18)); i++) {
    const x = 3 + Math.floor(r() * (cols - 6)), y = 3 + Math.floor(r() * rows * 0.6);
    if (Math.hypot(x - head[0], y - head[1]) < ORB + 3) continue;
    s += `<g class="ykstage__flake" style="--i:${i}">${flake(x, y)}</g>`;
  }
  // Yuki, on whole cells
  // (a group around her, for CSS transforms: her pop, her hop; a nested svg doesn't take one everywhere)
  const her = o.yuki === null || layer === "back" ? "" :
    `<g class="ykstage__her" style="--hx:${sx + 16}px;--hy:${sy + 32}px">` +
    `<svg x="${sx}" y="${sy}" width="32" height="32" viewBox="0 0 32 32" overflow="visible">` +
    yukiSprite({ eyes: o.yuki?.eyes ?? "open", mouth: o.yuki?.mouth ?? "small" }) +
    `</svg></g>` +
    (o.hatch && o.ring !== false ? openFrames(head[0], head[1]) : "");
  return (
    `<svg class="ykstage" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" shape-rendering="crispEdges" ` +
    `preserveAspectRatio="xMid${o.align === "middle" ? "YMid" : "YMax"} slice" aria-hidden="true" focusable="false" ` +
    `style="--cols:${cols};--rows:${rows}${her ? `;${blinkVars(o.seed)}` : ""}">${layer === "her" ? "" : s}${her}</svg>`
  );
}

/**
 * Snow on the stage's grid (styles/yuki.css .yksnow: laid over the stage cell for cell, a flake one cell, falling a
 * cell at a time and swaying a cell now and then). Behind her: a stage puts it between its night and her (yukiArt, the
 * /yuki/ hero), so no flake ever crosses her face. Near flakes are white and quicker, far ones dimmer and slower. Seeded.
 */
export function snowLayer(seed: string, cols: number, rows: number, count: number, className?: string): string {
  const r = rng(`${seed}-snow`);
  let s = "";
  for (let i = 0; i < count; i++) {
    const far = r() < 0.45;
    const c = Math.floor(r() * cols);
    const n = rows + 1;
    const d = Math.round(n * (far ? 190 + r() * 70 : 110 + r() * 50));
    // (--r: where it hangs when nothing moves)
    s += `<i${far ? ' class="is-far"' : ""} style="--c:${c};--r:${1 + Math.floor(r() * rows)};--n:${n};--d:${d}ms;--t:${-Math.round(r() * d)}ms;--sw:${(1.6 + r() * 2.4).toFixed(1)}s;--w:${r() < 0.5 ? -1 : 1}"></i>`;
  }
  return `<span class="${cx("yksnow", className)}" aria-hidden="true" style="--cols:${cols};--rows:${rows}">${s}</span>`;
}

export interface YukiArtOptions {
  className?: string;
  /** A picture with this name (role="img"); without it the art is decorative. */
  label?: string;
  /** Stage cells: a 4:5 window by default (the banner's hero). */
  cols?: number;
  rows?: number;
  seed?: string;
  eyes?: YukiEyes;
  mouth?: YukiMouth;
  /** The giant numeral between the night and her (a card, DESIGN-1019 5.3). */
  numeral?: string;
  /** A card's foot scrim and pointer glare (render/cardart.ts CardArtExtras.card). A card also holds her up in the
   *  middle of a taller night, her bust inside her orb as in the app's portrait, and its words below her. */
  card?: boolean;
}

/**
 * The art box: `div.ykart` (container) with the stage sized to cover it at a whole-pixel cell. Two stages stacked, the
 * night behind and her in front, with the snow between them (and a card's numeral, as a rig card puts it between its
 * back parts and the figure), so the snow falls behind her. It takes render/cardart.ts's place for YUKI (`cart
 * cart--code`), so a card, a banner's hero window and a project's picture all hold it the same way.
 */
export function yukiArt(o: YukiArtOptions = {}): string {
  const cols = o.cols ?? 48, rows = o.rows ?? (o.card ? 72 : 60);
  const seed = o.seed ?? "yuki";
  const a11y = o.label ? `role="img" aria-label="${esc(o.label)}"` : `aria-hidden="true"`;
  const stage: StageOptions = {
    cols, rows, seed, yuki: { eyes: o.eyes ?? "open", mouth: o.mouth ?? "small" },
    ...(o.card ? { align: "middle" as const, at: { lift: -24 } } : {}),
  };
  return (
    `<div class="${cx("cart cart--code ykart", o.card && "ykart--mid", o.className)}" ${a11y} style="--cols:${cols};--rows:${rows}">` +
    `<div class="ykart__stage">${yukiStage({ ...stage, layer: "back" })}</div>` +
    (o.numeral !== undefined ? `<span class="cart__num">${esc(o.numeral)}</span>` : "") +
    snowLayer(seed, cols, rows, Math.round((cols * rows) / 220)) +
    `<div class="ykart__stage ykart__stage--her">${yukiStage({ ...stage, layer: "her" })}</div>` +
    (o.card ? `<span class="cart__scrim"></span><span class="cart__glare"></span>` : "") +
    `<span class="cart__shine"></span></div>`
  );
}

/** The banner's back layer for YUKI, in Dex's plate's place: the night with shards, flakes and its snow, no Yuki. */
export function yukiBack(): string {
  return `<span class="ykback">${yukiStage({ cols: 160, rows: 48, seed: "yuki-back", yuki: null, shards: 7 })}${snowLayer("yuki-back", 160, 48, 30)}</span>`;
}

/** A tile with her face in it. `seed`: her blink's clock, so tiles side by side blink out of step. */
export function yukiTile(size: "s" | "m", seed: string): string {
  return `<span class="tile tile--cyan tile--${size} yktile" aria-hidden="true">${yukiSprite({ scale: 1, seed })}</span>`;
}

/** A step's or fact's tile: her face where it would show the site's generic mascot ("blob"), else the icon's tile. */
export const yukiTileOr = (ic: IconName, tone: Tone, size: "s" | "m", seed: string): string =>
  ic === "blob" ? yukiTile(size, seed) : tile(ic, tone, size);
