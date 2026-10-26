// YUKI's art, made with code (Dex 10-26, YUKI docs/build/PHASE2-SCOPE.md "The feel": materials are made with code, no
// image generation): pixel Yuki (yuki-sprite.ts) at a whole-number scale in a snowy night, inside her orb's ring (the
// round portrait she lives in, in the app), ice shards drifting by, snow falling. Every pixel of the scene is one
// stage unit, and a stage unit is a whole number of screen pixels (styles/yuki.css --u), so it stays crisp at any size.
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
    const glow = [ORB, ORB - 3, ORB - 6].map((rad, i) => `<circle cx="${head[0] + 0.5}" cy="${head[1] + 0.5}" r="${rad}" fill="${RING.glow}" opacity="${[0.07, 0.08, 0.1][i]}"/>`).join("");
    s += `<g class="ykstage__ring" style="--hx:${head[0] + 0.5}px;--hy:${head[1] + 0.5}px">${glow}${cellsPath(ringCells(head[0], head[1], ORB), RING.outer)}${cellsPath(ringCells(head[0], head[1], ORB - 1), RING.inner, ' opacity="0.85"')}</g>`;
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
    `</svg></g>`;
  return (
    `<svg class="ykstage" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" shape-rendering="crispEdges" ` +
    `preserveAspectRatio="xMid${o.align === "middle" ? "YMid" : "YMax"} slice" aria-hidden="true" focusable="false" ` +
    `style="--cols:${cols};--rows:${rows}${her ? `;${blinkVars(o.seed)}` : ""}">${layer === "her" ? "" : s}${her}</svg>`
  );
}

/** Snow falling in front (spans; styles/yuki.css drops them in whole-pixel steps). Seeded. */
export function snowFx(seed: string, count = 14, className?: string): string {
  const r = rng(`${seed}-snow`);
  let s = "";
  for (let i = 0; i < count; i++) {
    const big = r() < 0.3;
    s += `<i style="--x:${(r() * 100).toFixed(1)}%;--d:${(6 + r() * 7).toFixed(1)}s;--t:${(-r() * 12).toFixed(1)}s;--w:${(r() * 2 - 1).toFixed(2)}"${big ? ' class="is-big"' : ""}></i>`;
  }
  return `<span class="${cx("ykfx", className)}" aria-hidden="true">${s}</span>`;
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
 * The art box: `div.ykart` (container) with the stage sized to cover it at a whole-pixel cell and the snow in front.
 * It takes render/cardart.ts's place for YUKI (`cart cart--code`), so a card, a banner's hero window and a project's
 * picture all hold it the same way.
 */
export function yukiArt(o: YukiArtOptions = {}): string {
  const cols = o.cols ?? 48, rows = o.rows ?? (o.card ? 72 : 60);
  const a11y = o.label ? `role="img" aria-label="${esc(o.label)}"` : `aria-hidden="true"`;
  const stage: StageOptions = {
    cols, rows, seed: o.seed ?? "yuki", yuki: { eyes: o.eyes ?? "open", mouth: o.mouth ?? "small" },
    ...(o.card ? { align: "middle" as const, at: { lift: -24 } } : {}),
  };
  // with a numeral: two stages, the night, the numeral, then her (as a rig card puts it between its back parts and
  // the figure)
  const art = o.numeral !== undefined
    ? `<div class="ykart__stage">${yukiStage({ ...stage, layer: "back" })}</div><span class="cart__num">${esc(o.numeral)}</span>` +
      `<div class="ykart__stage ykart__stage--her">${yukiStage({ ...stage, layer: "her" })}</div>`
    : `<div class="ykart__stage">${yukiStage(stage)}</div>`;
  return (
    `<div class="${cx("cart cart--code ykart", o.card && "ykart--mid", o.className)}" ${a11y} style="--cols:${cols};--rows:${rows}">` +
    art +
    snowFx(o.seed ?? "yuki") +
    (o.card ? `<span class="cart__scrim"></span><span class="cart__glare"></span>` : "") +
    `<span class="cart__shine"></span></div>`
  );
}

/** The banner's back layer for YUKI, in Dex's plate's place: the night with shards and flakes, no Yuki. */
export function yukiBack(): string {
  return `<span class="ykback">${yukiStage({ cols: 160, rows: 48, seed: "yuki-back", yuki: null, shards: 7 })}</span>`;
}

/** A tile with her face in it. `seed`: her blink's clock, so tiles side by side blink out of step. */
export function yukiTile(size: "s" | "m", seed: string): string {
  return `<span class="tile tile--cyan tile--${size} yktile" aria-hidden="true">${yukiSprite({ scale: 1, mouth: "smile", seed })}</span>`;
}

/** A step's or fact's tile: her face where it would show the site's generic mascot ("blob"), else the icon's tile. */
export const yukiTileOr = (ic: IconName, tone: Tone, size: "s" | "m", seed: string): string =>
  ic === "blob" ? yukiTile(size, seed) : tile(ic, tone, size);
