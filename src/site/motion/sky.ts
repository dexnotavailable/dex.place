// The world on the website (Dex 10-18: the page is white, with windows punched into it that look into the world):
// the windows beside the sections (motion/windows.ts) and the jetty at the bottom of the page, every piece painted by
// the world's own painters in the worker its place needs (motion/painters.ts). Whole pixels only: one art px is `k`
// device px.

import { painterWorker, warmPainters } from "./painters.ts";
import { FIGURE, HER_ART, HOLDING, WAITING, loadFirst, loadHer, ofudaOnHat, type Her } from "./her.ts";
import { POOL, rampIndex, skyRamp } from "./sky-plan.ts";
import type { CloudDone, CloudJob } from "./paint-core.ts";
import { initWindows } from "./windows.ts";

/**
 * The bottom of the website (Dex 10-16: "the jetty scene, on the left"): Kagami's jetty painted by the world's
 * own jetty painter on a still lake of the world's jade, its reflection broken by ripples, under the website's
 * sky (the backdrop shows through). She stands on the deck in her own drawings (motion/her.ts, loaded with the
 * jetty's painters when it comes near; `[data-jetty-her]`, her soles placed here on the deck): bare-hatted while she
 * waits, her idle once the ofuda is on her hat (way 4's catch, `data-caught` on the jetty); `.jetty__hat` marks the
 * ofuda's place on her hat in that drawing, where the page's paper lands. The scene is drawn again only when the size
 * changes; she breathes through her loop while the jetty is on screen (one still drawing with reduced motion).
 */
/** Her paperless loop is in the game (build time, as the game finds its drawings; a missing one is never fetched). */
const NOPAPER = Object.keys(import.meta.glob("/public/assets/zhusha/idle_nopaper/anim.json")).length > 0;

export function initJetty(reduced: MediaQueryList): void {
  const scene = document.querySelector<HTMLElement>("[data-jetty-scene]");
  const her = scene?.querySelector<HTMLElement>("[data-jetty-her]");
  if (!scene || !her) return;
  const hat = her.querySelector<HTMLElement>(".jetty__hat");
  const herCv = document.createElement("canvas");
  her.prepend(herCv);
  const herCtx = herCv.getContext("2d");
  const jettyEl = scene.closest<HTMLElement>("[data-jetty]") ?? scene;
  /** Bare-hatted (waiting) and holding the ofuda (after the catch); the same drawings until the paperless loop is in. */
  let waiting: Her | null = null, holding: Her | null = null;
  let sprite: Her | null = null;
  const pick = (): void => {
    sprite = (jettyEl.hasAttribute("data-caught") ? holding ?? waiting : waiting ?? holding) ?? null;
  };
  let stand: { x: number; y: number; k: number; dpr: number } | null = null;
  let fi = 0, herT = 0, onScreen = false;
  // until her drawings are in: her size from the contract (a figure 128 px tall, the tie just above her head)
  const FALLBACK: Pick<Her, "w" | "h" | "pivot"> = { w: Math.round(FIGURE * 0.6), h: FIGURE + 28, pivot: [Math.round(FIGURE * 0.3), FIGURE + 18] };
  const drawHer = (): void => {
    if (!sprite || !herCtx || !herCv.width) return;
    herCtx.imageSmoothingEnabled = false;
    herCtx.clearRect(0, 0, herCv.width, herCv.height);
    herCtx.drawImage(sprite.frames[fi % sprite.frames.length]!, 0, 0, herCv.width, herCv.height);
  };
  // her soles on the deck at (x, y) scene px; her drawings nearest-neighbour at her play scale, on whole device px
  const placeHer = (): void => {
    if (!stand) return;
    const { x, y, k, dpr } = stand;
    const d = sprite ?? FALLBACK;
    const s = HER_ART * k;
    const left = Math.round(x * k - d.pivot[0] * s), top = Math.round(y * k - d.pivot[1] * s);
    const cw = Math.round(d.w * s), ch = Math.round(d.h * s);
    her.style.left = `${left / dpr}px`;
    her.style.top = `${top / dpr}px`;
    her.style.width = `${cw / dpr}px`;
    her.style.height = `${ch / dpr}px`;
    her.style.bottom = "auto";
    // the ofuda's place on her hat in the drawing that holds it (from her soles), where the page's paper lands
    if (hat) {
      const o = ofudaOnHat(holding?.pivot);
      hat.style.left = `${((o.x + d.pivot[0]) * s) / dpr}px`;
      hat.style.top = `${((o.y + d.pivot[1]) * s) / dpr}px`;
      hat.style.width = `${(o.w * s) / dpr}px`;
      hat.style.height = `${(o.h * s) / dpr}px`;
    }
    if (sprite && (herCv.width !== cw || herCv.height !== ch)) {
      herCv.width = cw;
      herCv.height = ch;
      herCv.style.width = `${cw / dpr}px`;
      herCv.style.height = `${ch / dpr}px`;
    }
    drawHer();
  };
  // her idle: a plain forward loop at the clip's own ticks (60 a second), only while the jetty is on screen
  const stepHer = (): void => {
    herT = 0;
    if (!sprite || !onScreen) return;
    fi = (fi + 1) % sprite.frames.length;
    drawHer();
    herT = window.setTimeout(stepHer, (sprite.ticks[fi]! * 1000) / 60);
  };
  const runHer = (): void => {
    if (herT || !sprite || !onScreen || reduced.matches || sprite.frames.length < 2) return;
    herT = window.setTimeout(stepHer, (sprite.ticks[fi]! * 1000) / 60);
  };
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      runHer();
    }).observe(scene);
  } else onScreen = true;
  scene.setAttribute("data-painted", "");
  const cv = document.createElement("canvas");
  scene.prepend(cv);
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  let art: { img: HTMLCanvasElement; ax: number; ay: number } | null = null;
  // its own sky now (the page behind it is white): a dithered ramp and three heaps of the world's cloud
  const clouds: ({ img: HTMLCanvasElement; ax: number; ay: number } | null)[] = [null, null, null];
  const CLOUDS = [[2, 0.2, 0.55], [0, 0.62, 0.62], [7, 0.45, 0.7]] as const;
  const sky = skyRamp(20).slice(6);
  const JETTY = { w: 560, water: 34, posts: [[0, 14], [4, 10]] as [number, number][], sag: [[150, 2], [330, 3]] as [number, number][] };
  const toCanvas = (d: CloudDone): { img: HTMLCanvasElement; ax: number; ay: number } => {
    const img = document.createElement("canvas");
    img.width = d.w;
    img.height = d.h;
    img.getContext("2d")!.putImageData(new ImageData(d.rgba as Uint8ClampedArray<ArrayBuffer>, d.w, d.h), 0, 0);
    return { img, ax: d.ax, ay: d.ay };
  };
  // Kagami's painters start only when the jetty comes near; its own jobs go first (the jetty, then its clouds)
  let started = false;
  const start = (): void => {
    if (started) return;
    started = true;
    void loadFirst(reduced.matches, NOPAPER ? WAITING : [HOLDING]).then(async (w) => {
      if (!w) return;
      waiting = w.her;
      holding = w.base === HOLDING ? w.her : await loadHer(reduced.matches, HOLDING);
      pick();
      her.setAttribute("data-drawn", "");
      placeHer();
      runHer();
    });
    // the catch (way 4): from the next drawing on she is the one holding the ofuda
    if (typeof MutationObserver === "function") {
      new MutationObserver(() => {
        const was = sprite;
        pick();
        if (sprite !== was) { fi = 0; placeHer(); }
      }).observe(jettyEl, { attributes: true, attributeFilter: ["data-caught"] });
    }
    const w = painterWorker("kagami");
    w.addEventListener("message", (e: MessageEvent<CloudDone>) => {
      const id = e.data.id;
      if (id === -1) art = toCanvas(e.data);
      else if (id <= -10 && id > -10 - CLOUDS.length) clouds[-10 - id] = toCanvas(e.data);
      else return;
      draw();
    });
    w.postMessage({ id: -1, kind: "op.jetty", p: JETTY, seed: 5 } satisfies CloudJob);
    CLOUDS.forEach(([pool], i) => {
      const { use: _use, ...p } = POOL[pool]!;
      w.postMessage({ id: -10 - i, p, seed: 31 + i * 5, d: 0.9 } satisfies CloudJob);
    });
  };
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
    const paperEl = scene.parentElement?.querySelector<HTMLElement>(".jetty__paper");
    const paper = paperEl?.getBoundingClientRect();
    const stacked = !paper || paper.width >= r.width * 0.9;
    const open = stacked ? W : Math.max(40, Math.floor(((paper.left - r.left) * dpr) / k));
    // stacked, the white question sits over the scene's top: her head stays below its bottom edge and its dissolve
    const fade = paperEl ? parseFloat(getComputedStyle(paperEl, "::before").height) || 0 : 0;
    const clear = stacked && paper ? Math.ceil(((paper.bottom - r.top + fade) * dpr) / k) + 4 : 0;
    // (a short scene still has room above the deck for her)
    const horizon = Math.min(H - 12, Math.max(Math.round(H * 0.7), clear + HER_H + JETTY.water + 14));
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
    // she stands on the deck
    const deckX = Math.max(x0 + JETTY.w * 0.1, Math.min(x0 + JETTY.w * 0.9, Math.round(open * 0.35)));
    stand = { x: deckX, y: deckY, k, dpr };
    placeHer();
  };
  draw();
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: "50% 0px" });
    io.observe(scene);
  } else start();
  let t = 0;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = window.setTimeout(draw, 150);
  });
}

/** The room she needs above the deck, scene px: her drawing from the soles to the hat's tie (motion/her.ts: 128 px
 *  art at 0.825 scene px each; her hat stands ~16 art px over her skull, the tie ~8 over that). */
const HER_H = Math.ceil((FIGURE + 16 + 9) * HER_ART) + 2;

/** The world's pieces on the website: the windows and the jetty, each painted only when it comes near. */
export function initSky(reduced: MediaQueryList): void {
  if (typeof Worker === "undefined") return;
  initWindows(reduced);
  initJetty(reduced);
  warmPainters();
}
