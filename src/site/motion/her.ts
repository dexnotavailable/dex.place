// Zhusha on the page's jetty (Dex 10-19: her real drawings are in the game): the game's own drawings
// (public/assets/zhusha/<move>: anim.json + fNNN.png, lanes/anim/SPRITE-CONTRACT.md), drawn nearest-neighbour at her
// play scale, facing right as she does when the game starts. Loaded only when the jetty comes near (motion/sky.ts);
// reduced motion loads and draws the first drawing only, still.
//
// Before the catch she waits bare-hatted (her paperless breathing loop, idle_nopaper, once it is in the game; her idle
// until then); once the ofuda has drifted onto her hat she is her idle, whose hat carries it: the same pixels as the
// page's ofuda (motion/pixel-loader.ts, cut from that drawing at OFUDA_IN_IDLE), so the paper lands exactly on itself.

import feel from "../../tesu/zhusha/feel.json" with { type: "json" };
import { OFUDA_H, OFUDA_IN_IDLE, OFUDA_W } from "./pixel-loader.ts";

/** Her art: 128 px skull to sole (tesu/zhusha/contract.ts FIGURE_H). */
export const FIGURE = 128;
/**
 * World px per art px: her drawn height, H x charScale (tesu/config.ts H = 96; the game's own feel.json, so her size
 * on the jetty follows the game's: Dex 10-19, 0.88), over her 128 px art. The jetty's scene px are world px at play
 * zoom (2 css px each), so this is scene px too.
 */
export const HER_ART = (96 * feel.charScale) / FIGURE;
/** Her drawings: bare-hatted while she waits (the paperless loop, else the idle), and the idle (the ofuda on her hat). */
export const WAITING = ["/assets/zhusha/idle_nopaper/", "/assets/zhusha/idle/"] as const;
export const HOLDING = "/assets/zhusha/idle/";
/** Her idle's pivot (public/assets/zhusha/idle/anim.json), until its drawings are in. */
export const IDLE_PIVOT: readonly [number, number] = [40, 146];

export interface Her {
  frames: HTMLImageElement[];
  /** Each drawing's ticks, 60 a second (the clip plays as a plain forward loop). */
  ticks: number[];
  /** The drawings' size, art px. */
  w: number;
  h: number;
  /** Where her soles meet the ground, art px. */
  pivot: [number, number];
}

interface AnimJson {
  pivot: [number, number];
  frames: { file: string; ticks: number }[];
}

/**
 * The ofuda on her hat in her idle, from her soles (art px): its box (top-left, size) in the drawing that holds it,
 * `pivot` that drawing's pivot. The page's paper lands with its tie (the box's top middle) here.
 */
export function ofudaOnHat(pivot: readonly [number, number] = IDLE_PIVOT): { x: number; y: number; w: number; h: number } {
  return { x: OFUDA_IN_IDLE.x - pivot[0], y: OFUDA_IN_IDLE.y - pivot[1], w: OFUDA_W, h: OFUDA_H };
}

const load = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(src));
    img.src = src;
  });

/** One move's drawings (only the first with `still`), or null if they cannot be had. */
export async function loadHer(still: boolean, base: string = HOLDING): Promise<Her | null> {
  try {
    const res = await fetch(base + "anim.json");
    if (!res.ok) return null;
    const def = (await res.json()) as AnimJson;
    const use = still ? def.frames.slice(0, 1) : def.frames;
    const frames = await Promise.all(use.map((f) => load(base + f.file)));
    const f0 = frames[0]!;
    return { frames, ticks: use.map((f) => Math.max(1, f.ticks)), w: f0.naturalWidth, h: f0.naturalHeight, pivot: def.pivot };
  } catch {
    return null;
  }
}

/** The first of `bases` that loads (her waiting loop, falling back to her idle). */
export async function loadFirst(still: boolean, bases: readonly string[]): Promise<{ her: Her; base: string } | null> {
  for (const base of bases) {
    const her = await loadHer(still, base);
    if (her) return { her, base };
  }
  return null;
}
