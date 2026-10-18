// The world behind the website (Dex 10-16): "the world stays animated behind". A world layer under the white
// paper: for now the sky (the tall sky art comes from the sky owner later), a large vertical stretch from deep
// blue at the top of the website to pale blue at the jetty, with towering cumulus painted by the world's own
// cloud painter (motion/sky-paint.ts, in a worker), drifting slowly, the whole stretch sliding by a little
// slower than the page (a quarter of the scroll). Whole pixels only: one art px is `k` device px.
// Reduced motion: no drift and no slide. Only drawn while the website is on screen.

import type { CloudP } from "../../tesu/art/library/opening/sky.ts";
import type { CloudDone, CloudJob } from "./sky-paint.ts";

/** The sky's colours from the top of the stretch to the bottom (a stepped ramp: pixel-art bands). */
const RAMP: [number, number, number][] = [
  [31, 86, 156], [38, 98, 168], [46, 110, 180], [56, 123, 192], [68, 136, 202], [82, 149, 211], [98, 162, 219],
  [115, 175, 226], [132, 187, 232], [150, 198, 237], [168, 209, 241], [186, 219, 244], [203, 228, 247], [218, 236, 249],
];

/** The slide: the stretch moves at this share of the page's scroll. */
const PARALLAX = 0.25;

interface Placed {
  /** Where along the stretch (0 top .. 1 bottom) its base sits, and across (0 left .. 1 right). */
  at: number;
  x: number;
  p: CloudP;
  seed: number;
  /** Drift, art px a second. */
  v: number;
  img?: HTMLCanvasElement;
  ax?: number;
  ay?: number;
  shownAt?: number;
}

/** The clouds along the stretch: towering heaps on the open side of each panel, a low deck near the bottom. */
export function skyPlan(scale: number): Placed[] {
  const c = (at: number, x: number, p: CloudP, seed: number, v: number): Placed => ({
    at, x, seed, v,
    p: { ...p, w: Math.round(p.w * scale), h: Math.round(p.h * scale) },
  });
  return [
    c(0.16, 0.86, { kind: "tower", w: 230, h: 300 }, 11, 2.2),
    c(0.2, 0.08, { kind: "wisp", w: 220, h: 26 }, 12, 4),
    c(0.36, 0.12, { kind: "cumulus", w: 420, h: 210 }, 13, 2.6),
    c(0.5, 0.9, { kind: "cumulus", w: 360, h: 190, tower: 0.9 }, 14, 2.4),
    c(0.66, 0.1, { kind: "tower", w: 240, h: 280 }, 15, 2),
    c(0.74, 0.7, { kind: "wisp", w: 260, h: 30 }, 16, 4.4),
    c(0.86, 0.88, { kind: "cumulus", w: 460, h: 170, tower: 0.55 }, 17, 2.8),
    c(1.0, 0.3, { kind: "stratus", w: 900, h: 60 }, 18, 1.4),
  ];
}

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
  const w = worker();
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
    // the lake: the lower part of the scene, bands from the pale horizon down into the jade
    // where the white paper leaves the scene open: beside it (wide screens) or below it (stacked)
    const paper = scene.parentElement?.querySelector<HTMLElement>(".jetty__paper")?.getBoundingClientRect();
    const stacked = !paper || paper.width >= r.width * 0.9;
    const open = stacked ? W : Math.max(40, Math.floor(((paper.left - r.left) * dpr) / k));
    // (a short scene still has room above the deck for her)
    const horizon = Math.min(H - 12, Math.max(Math.round(H * 0.7), HER_H + JETTY.water + 14));
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

export function initSky(reduced: MediaQueryList): void {
  const sky = document.querySelector<HTMLElement>("[data-sky]");
  const sheet = document.getElementById("site");
  if (!sky || !sheet || typeof Worker === "undefined") return;
  const cv = document.createElement("canvas");
  sky.append(cv);
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  let plan: Placed[] = [];
  let planScale = -1;
  let worker: Worker | null = null;
  const t0 = performance.now();
  const getWorker = (): Worker => (worker ??= new Worker(new URL("./sky-paint.ts", import.meta.url), { type: "module" }));
  initJetty(getWorker);
  let generation = 0;

  const paint = (scale: number): void => {
    if (Math.abs(scale - planScale) < 0.08) return;
    planScale = scale;
    plan = skyPlan(scale);
    const gen = ++generation;
    const mine = plan;
    getWorker().addEventListener("message", (e: MessageEvent<CloudDone>) => {
      const d = e.data;
      if (gen !== generation || d.id < 0) return;
      const pl = mine[d.id];
      if (!pl) return;
      const img = document.createElement("canvas");
      img.width = d.w;
      img.height = d.h;
      img.getContext("2d")!.putImageData(new ImageData(d.rgba as Uint8ClampedArray<ArrayBuffer>, d.w, d.h), 0, 0);
      pl.img = img;
      pl.ax = d.ax;
      pl.ay = d.ay;
      pl.shownAt = performance.now();
      dirty = true;
    });
    plan.forEach((pl, id) => getWorker().postMessage({ id, p: pl.p, seed: pl.seed } satisfies CloudJob));
  };

  let dirty = true;
  let lastDraw = 0;
  const draw = (now: number): void => {
    const dpr = window.devicePixelRatio || 1;
    const vw = innerWidth, vh = innerHeight;
    const r = sheet.getBoundingClientRect();
    if (r.top >= vh || r.bottom <= 0) return;
    const k = Math.max(1, Math.round(2 * dpr));
    const W = Math.ceil((vw * dpr) / k), H = Math.ceil((vh * dpr) / k);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
      // whole device pixels per art px: the canvas is shown at exactly k, never stretched to fit
      cv.style.width = `${(W * k) / dpr}px`;
      cv.style.height = `${(H * k) / dpr}px`;
    }
    paint(Math.min(1, Math.max(0.45, W / 900)));
    // the stretch: one window high plus a quarter of the scroll through the website
    const travel = Math.max(0, sheet.offsetHeight - vh);
    const scrolled = Math.min(travel, Math.max(0, -r.top));
    const slide = reduced.matches ? 0 : PARALLAX;
    const total = H + (travel * slide * dpr) / k;
    const off = (scrolled * slide * dpr) / k;
    // the sky's bands
    for (let y = 0; y < H; y++) {
      const u = Math.min(1, Math.max(0, (y + off) / total));
      const c = RAMP[Math.min(RAMP.length - 1, Math.floor(u * RAMP.length))]!;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(0, y, W, 1);
    }
    // the clouds
    const t = reduced.matches ? 0 : (now - t0) / 1000;
    ctx.imageSmoothingEnabled = false;
    for (const pl of plan) {
      if (!pl.img) continue;
      const span = W + pl.img.width;
      const x0 = pl.x * W - pl.ax! + pl.v * t;
      const x = (((x0 + pl.img.width) % span) + span) % span - pl.img.width;
      const y = pl.at * total - off - pl.ay!;
      if (y > H || y + pl.img.height < 0) continue;
      ctx.globalAlpha = reduced.matches ? 1 : Math.min(1, (now - (pl.shownAt ?? 0)) / 600);
      ctx.drawImage(pl.img, Math.round(x), Math.round(y));
    }
    ctx.globalAlpha = 1;
    lastDraw = now;
    dirty = false;
  };

  const tick = (now: number): void => {
    // drift moves a whole art px about every 0.4 s: redraw then, or when the page moves
    if (dirty || (!reduced.matches && now - lastDraw > 400) || plan.some((p) => p.shownAt && now - p.shownAt < 700)) draw(now);
    requestAnimationFrame(tick);
  };
  window.addEventListener("scroll", () => { dirty = true; }, { passive: true });
  window.addEventListener("resize", () => { dirty = true; });
  requestAnimationFrame(tick);
}
