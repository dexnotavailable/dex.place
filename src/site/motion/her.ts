// Zhusha on the page's jetty (Dex 10-19: her real drawings are in the game): her idle, the game's own drawings
// (public/assets/zhusha/idle: anim.json + fNNN.png, lanes/anim/SPRITE-CONTRACT.md), drawn nearest-neighbour at her
// play scale, facing right as she does when the game starts. Loaded only when the jetty comes near (motion/sky.ts);
// reduced motion loads and draws the first drawing only, still.

import { headOf } from "../../tesu/zhusha/contract.ts";

/** Her art: 128 px skull to sole (tesu/zhusha/contract.ts FIGURE_H). */
export const FIGURE = 128;
/**
 * World px per art px: her drawn height, H x charScale (tesu/config.ts H = 96, tesu/zhusha/feel.json charScale 1.1),
 * over her 128 px art. The jetty's scene px are world px at play zoom (2 css px each), so this is scene px too.
 */
export const HER_ART = (96 * 1.1) / FIGURE;
/** The tie on her hat from the top of her head, world px, facing right (tesu/opening/ofuda.ts HAT_TIE). */
export const HAT_TIE: readonly [number, number] = [2, -7];

export interface Her {
  frames: HTMLImageElement[];
  /** Each drawing's ticks, 60 a second (the clip plays as a plain forward loop). */
  ticks: number[];
  /** The drawings' size, art px. */
  w: number;
  h: number;
  /** Where her soles meet the ground, art px. */
  pivot: [number, number];
  /** The tie on her hat, art px in the drawing (from the first drawing's head, as the game finds it). */
  tie: [number, number];
}

interface AnimJson {
  pivot: [number, number];
  frames: { file: string; ticks: number }[];
}

const load = (src: string): Promise<HTMLImageElement> =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(src));
    img.src = src;
  });

/** Her idle drawings (only the first with `still`), or null if they cannot be had. */
export async function loadHer(still: boolean, base = "/assets/zhusha/idle/"): Promise<Her | null> {
  try {
    const def = (await (await fetch(base + "anim.json")).json()) as AnimJson;
    const use = still ? def.frames.slice(0, 1) : def.frames;
    const frames = await Promise.all(use.map((f) => load(base + f.file)));
    const f0 = frames[0]!;
    const w = f0.naturalWidth, h = f0.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(f0, 0, 0);
    const head = headOf(g.getImageData(0, 0, w, h).data, w, h, def.pivot[0], FIGURE) ?? [def.pivot[0], 0];
    const tie: [number, number] = [head[0] + HAT_TIE[0] / HER_ART, head[1] + HAT_TIE[1] / HER_ART];
    return { frames, ticks: use.map((f) => Math.max(1, f.ticks)), w, h, pivot: def.pivot, tie };
  } catch {
    return null;
  }
}
