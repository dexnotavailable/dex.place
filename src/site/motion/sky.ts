// The world on the website (Dex 10-18: the page is white, with windows punched into it that look into the world):
// the windows beside the sections (motion/windows.ts) and the jetty at the bottom of the page, every piece painted by
// the world's own painters in one worker (motion/sky-paint.ts). Whole pixels only: one art px is `k` device px.

import { POOL, rampIndex, skyRamp } from "./sky-plan.ts";
import type { CloudDone, CloudJob } from "./sky-paint.ts";
import { initWindows } from "./windows.ts";

/**
 * The bottom of the website (Dex 10-16: "the jetty scene, on the left"): Kagami's jetty painted by the world's
 * own jetty painter on a still lake of the world's jade, its reflection broken by ripples, under the website's
 * sky (the backdrop shows through). She stands on it as the white box every character is until her art lands
 * (`[data-jetty-her]`, placed here at her height on the deck). Static: drawn again only when the size changes.
 */
export function initJetty(worker: () => Worker): void {
  const scene = document.querySelector<HTMLElement>("[data-jetty-scene]");
  const her = scene?.querySelector<HTMLElement>("[data-jetty-her]");
  if (!scene || !her) return;
  scene.setAttribute("data-painted", "");
  const cv = document.createElement("canvas");
  scene.prepend(cv);
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  let art: { img: HTMLCanvasElement; ax: number; ay: number } | null = null;
  // its own sky now (the page behind it is white): a dithered ramp and three heaps of the world's cloud
  const clouds: ({ img: HTMLCanvasElement; ax: number; ay: number } | null)[] = [null, null, null];
  const CLOUDS = [[2, 0.2, 0.55], [0, 0.62, 0.62], [7, 0.45, 0.7]] as const;
  const w = worker();
  w.addEventListener("message", (e: MessageEvent<CloudDone>) => {
    const i = -10 - e.data.id;
    if (i < 0 || i >= CLOUDS.length) return;
    const d = e.data;
    const img = document.createElement("canvas");
    img.width = d.w;
    img.height = d.h;
    img.getContext("2d")!.putImageData(new ImageData(d.rgba as Uint8ClampedArray<ArrayBuffer>, d.w, d.h), 0, 0);
    clouds[i] = { img, ax: d.ax, ay: d.ay };
    draw();
  });
  CLOUDS.forEach(([pool, , ], i) => {
    const { use: _use, ...p } = POOL[pool]!;
    w.postMessage({ id: -10 - i, p, seed: 31 + i * 5, d: 0.9 } satisfies CloudJob);
  });
  const sky = skyRamp(20).slice(6);
  const JETTY = { w: 560, water: 34, posts: [[0, 14], [4, 10]] as [number, number][], sag: [[150, 2], [330, 3]] as [number, number][] };
  const listen = (e: MessageEvent<CloudDone>): void => {
    if (e.data.id !== -1) return;
    const d = e.data;
    const img = document.createElement("canvas");
    img.width = d.w;
    img.height = d.h;
    img.getContext("2d")!.putImageData(new ImageData(d.rgba as Uint8ClampedArray<ArrayBuffer>, d.w, d.h), 0, 0);
    art = { img, ax: d.ax, ay: d.ay };
    w.removeEventListener("message", listen);
    draw();
  };
  w.addEventListener("message", listen);
  w.postMessage({ id: -1, kind: "jetty", p: JETTY, seed: 5 } satisfies CloudJob);
  const LAKE = ["#dbf2eb", "#b0e2d4", "#83ccbf", "#5ab2a7", "#3f918c"];
  const draw = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const r = scene.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const k = Math.max(1, Math.round(2 * dpr));
    const W = Math.ceil((r.width * dpr) / k), H = Math.ceil((r.height * dpr) / k);
    cv.width = W;
    cv.height = H;
    cv.style.width = `${(W * k) / dpr}px`;
    cv.style.height = `${(H * k) / dpr}px`;
    ctx.clearRect(0, 0, W, H);
    // the sky above the lake, and its clouds over the open part
    const skyImg = ctx.createImageData(W, H);
    const sh = Math.max(1, Math.round(H * 0.7));
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < W; x++) {
        const col = sky[rampIndex(x, y, sh, sky.length)]!;
        const i = (y * W + x) * 4;
        skyImg.data[i] = col[0]; skyImg.data[i + 1] = col[1]; skyImg.data[i + 2] = col[2]; skyImg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(skyImg, 0, 0);
    // the lake: the lower part of the scene, bands from the pale horizon down into the jade
    // where the white paper leaves the scene open: beside it (wide screens) or below it (stacked)
    const paper = scene.parentElement?.querySelector<HTMLElement>(".jetty__paper")?.getBoundingClientRect();
    const stacked = !paper || paper.width >= r.width * 0.9;
    const open = stacked ? W : Math.max(40, Math.floor(((paper.left - r.left) * dpr) / k));
    // (a short scene still has room above the deck for her)
    const horizon = Math.min(H - 12, Math.max(Math.round(H * 0.7), HER_H + JETTY.water + 14));
    if (horizon > sh) {
      const last = sky[sky.length - 1]!;
      ctx.fillStyle = `rgb(${last[0]},${last[1]},${last[2]})`;
      ctx.fillRect(0, sh, W, horizon - sh);
    }
    CLOUDS.forEach(([, fx, fy], i) => {
      const c = clouds[i];
      if (c) ctx.drawImage(c.img, Math.round(open * fx) - c.ax, Math.round(horizon * fy + horizon * 0.25) - c.ay);
    });
    for (let y = horizon; y < H; y++) {
      const u = (y - horizon) / Math.max(1, H - horizon);
      ctx.fillStyle = LAKE[Math.min(LAKE.length - 1, Math.floor(Math.pow(u, 0.8) * LAKE.length))]!;
      ctx.fillRect(0, y, W, 1);
    }
    // ripple dashes, a few per row, sparser near the horizon
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = horizon + 3; y < H; y += 3) {
      const n = Math.round((W / 60) * (0.4 + (y - horizon) / (H - horizon)));
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "#dbf2eb" : "#3f918c";
        ctx.fillRect(Math.floor(rnd() * W), y, 2 + Math.floor(rnd() * 6), 1);
      }
    }
    if (!art) return;
    // the jetty: from the left edge, its deck a few px above the waterline
    const deckY = horizon - JETTY.water;
    // it runs in from the left and ends past the middle of the open part
    const x0 = Math.min(-12, Math.round(open * 0.78) - JETTY.w);
    // its reflection: the jetty upside down in the still water, darker, broken by the ripples
    ctx.save();
    ctx.globalAlpha = 0.28;
    for (let y = 0; y < art.img.height; y++) {
      const ry = 2 * horizon - (deckY - art.ay + y) - 1;
      if (ry < horizon || ry >= H || y % 4 === 3) continue;
      ctx.drawImage(art.img, 0, y, art.img.width, 1, x0 - art.ax + ((y >> 2) % 2), ry, art.img.width, 1);
    }
    ctx.restore();
    ctx.drawImage(art.img, x0 - art.ax, deckY - art.ay);
    // she stands on the deck, at her height (the white box until her art lands)
    const css = k / dpr;
    const deckX = Math.max(x0 + JETTY.w * 0.1, Math.min(x0 + JETTY.w * 0.9, Math.round(open * 0.35)));
    her.style.left = `${Math.round(deckX * css)}px`;
    her.style.top = `${Math.round((deckY - HER_H) * css)}px`;
    her.style.width = `${Math.round(HER_W * css)}px`;
    her.style.height = `${Math.round(HER_H * css)}px`;
    her.style.bottom = "auto";
  };
  draw();
  let t = 0;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = window.setTimeout(draw, 150);
  });
}

/** Her placeholder box, art px (about her height at play zoom: 128 px art drawn ~1.65x on the world's 2 px grid). */
const HER_W = 28;
const HER_H = 104;

/** The world's pieces on the website: the windows and the jetty, one painter worker between them. */
export function initSky(reduced: MediaQueryList): void {
  if (typeof Worker === "undefined") return;
  let worker: Worker | null = null;
  const getWorker = (): Worker => (worker ??= new Worker(new URL("./sky-paint.ts", import.meta.url), { type: "module" }));
  initWindows(reduced, getWorker);
  initJetty(getWorker);
}
