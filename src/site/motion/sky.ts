// The world behind the website (Dex 10-16): "the world stays animated behind". A world layer under the white
// paper: for now the sky (the tall sky art comes from the sky owner later): deep blue at the top of the website to
// pale blue at the jetty, in dithered pixel steps, with towering cumulus painted by the world's own cloud painter
// (motion/sky-paint.ts, in a worker) and placed where the sky shows (motion/sky-plan.ts): along every paper's
// open side, under every gap, over the jetty. The clouds ride with the page a little slower than it (depth) and
// sway slowly. Whole pixels only: one art px is `k` device px. Reduced motion: no sway, no lag. Only drawn while
// the website is on screen.

import { POOL, placeClouds, rampIndex, skyRamp, type CloudPlace, type SkyRegion } from "./sky-plan.ts";
import type { CloudDone, CloudJob } from "./sky-paint.ts";

/** How much slower than the page the clouds ride (0: with it). */
const LAG = 0.15;

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

/** Where the sky shows on this page, from the layout: papers' open sides, the gaps between papers, the jetty. */
export function skyRegions(sheet: HTMLElement): SkyRegion[] {
  const out: SkyRegion[] = [];
  const vw = document.documentElement.clientWidth || innerWidth;
  const y0 = window.scrollY;
  const papers: { top: number; bottom: number }[] = [];
  for (const el of sheet.querySelectorAll<HTMLElement>(".band")) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el, "::before");
    const paperW = parseFloat(cs.width) || vw;
    const fade = parseFloat(getComputedStyle(el, "::after").width) || 0;
    const top = r.top + y0 + (parseFloat(cs.top) || 0), bottom = top + (parseFloat(cs.height) || r.height);
    papers.push({ top, bottom });
    const open = el.classList.contains("band--r") ? { left: 0, right: vw - paperW - fade * 0.6 } : { left: paperW + fade * 0.6, right: vw };
    out.push({ kind: "side", top, bottom, ...open });
  }
  const jetty = sheet.querySelector<HTMLElement>("[data-jetty]");
  const jp = jetty?.querySelector<HTMLElement>(".jetty__paper");
  if (jetty) {
    const r = jetty.getBoundingClientRect();
    const pr = jp?.getBoundingClientRect();
    const stacked = !pr || pr.width >= r.width * 0.9;
    out.push({ kind: "jetty", top: r.top + y0 + (stacked && pr ? pr.height : 0), bottom: r.top + y0 + r.height * 0.62, left: 0, right: stacked || !pr ? vw : pr.left });
  }
  // the gaps: from the top of the website (under the header) down between the papers
  const hdr = sheet.querySelector<HTMLElement>(".hdr");
  let above = hdr ? hdr.getBoundingClientRect().bottom + y0 : sheet.getBoundingClientRect().top + y0;
  papers.sort((p, q) => p.top - q.top);
  for (const p of papers) {
    if (p.top - above > 24) out.push({ kind: "gap", top: above, bottom: p.top, left: 0, right: vw });
    above = Math.max(above, p.bottom);
  }
  return out;
}

export function initSky(reduced: MediaQueryList): void {
  const sky = document.querySelector<HTMLElement>("[data-sky]");
  const sheet = document.getElementById("site");
  if (!sky || !sheet || typeof Worker === "undefined") return;
  const cv = document.createElement("canvas");
  sky.append(cv);
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  let worker: Worker | null = null;
  const t0 = performance.now();
  let dirty = true;
  let lastDraw = 0;
  const getWorker = (): Worker => (worker ??= new Worker(new URL("./sky-paint.ts", import.meta.url), { type: "module" }));
  initJetty(getWorker);

  // the painted pool, at the scale the screen wants
  interface Art { img: HTMLCanvasElement; ax: number; ay: number; at: number }
  let pool: (Art | null)[] = [];
  let poolScale = -1;
  let generation = 0;
  const paint = (scale: number): void => {
    if (Math.abs(scale - poolScale) < 0.08) return;
    poolScale = scale;
    const gen = ++generation;
    const mine: (Art | null)[] = POOL.map(() => null);
    pool = mine;
    getWorker().addEventListener("message", (e: MessageEvent<CloudDone>) => {
      const d = e.data;
      if (gen !== generation || d.id < 0 || d.id >= 1000) return;
      const img = document.createElement("canvas");
      img.width = d.w;
      img.height = d.h;
      img.getContext("2d")!.putImageData(new ImageData(d.rgba as Uint8ClampedArray<ArrayBuffer>, d.w, d.h), 0, 0);
      mine[d.id] = { img, ax: d.ax, ay: d.ay, at: performance.now() };
      dirty = true;
    });
    POOL.forEach(({ use: _use, ...p }, id) => {
      const job: CloudJob = { id, p: { ...p, w: Math.round(p.w * scale), h: Math.round(p.h * scale) }, seed: 11 + id * 7 };
      getWorker().postMessage(job);
    });
  };

  // where the clouds go: from the layout, again whenever it changes
  let places: CloudPlace[] = [];
  const plan = (): void => {
    places = placeClouds(skyRegions(sheet), innerHeight, 3);
    dirty = true;
  };
  let planT = 0;
  const replan = (): void => {
    clearTimeout(planT);
    planT = window.setTimeout(plan, 120);
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(replan).observe(sheet);
  void document.fonts?.ready.then(replan);
  plan();

  // the sky's colour: a dithered ramp, a little over two screens of it from the top of the website to the bottom
  const ramp = skyRamp(28);
  let grad: HTMLCanvasElement | null = null;
  const gradient = (W: number, H: number): HTMLCanvasElement => {
    const G = Math.round(H * 2.2);
    if (grad && grad.width === W && grad.height === G) return grad;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = G;
    const g = c.getContext("2d")!;
    const img = g.createImageData(W, G);
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < W; x++) {
        const col = ramp[rampIndex(x, y, G, ramp.length)]!;
        const i = (y * W + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    grad = c;
    return c;
  };

  const draw = (now: number): void => {
    const dpr = window.devicePixelRatio || 1;
    const vw = innerWidth, vh = innerHeight;
    const r = sheet.getBoundingClientRect();
    if (r.top >= vh || r.bottom <= 0) return;
    const k = Math.max(1, Math.round(2 * dpr));
    const css = k / dpr;
    const W = Math.ceil((vw * dpr) / k), H = Math.ceil((vh * dpr) / k);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
      // whole device pixels per art px: the canvas is shown at exactly k, never stretched to fit
      cv.style.width = `${(W * k) / dpr}px`;
      cv.style.height = `${(H * k) / dpr}px`;
    }
    paint(Math.min(1, Math.max(0.45, W / 900)));
    // the colour: the window slides down the ramp as the page goes down the website
    const g = gradient(W, H);
    const travel = Math.max(1, sheet.offsetHeight - vh);
    const progress = Math.min(1, Math.max(0, -r.top / travel));
    ctx.drawImage(g, 0, -Math.round(progress * (g.height - H)));
    // the clouds
    const t = reduced.matches ? 0 : (now - t0) / 1000;
    const sy = window.scrollY;
    ctx.imageSmoothingEnabled = false;
    for (const pl of places) {
      const art = pool[pl.pool];
      if (!art) continue;
      // on screen (css px): with the page, lagging a little away from the middle of the screen (depth)
      let y = pl.y - sy;
      if (!reduced.matches) y += (vh / 2 - y) * LAG;
      const x = pl.x + (reduced.matches ? 0 : Math.sin(t * 0.05 + pl.phase) * 10 * css);
      const ax = Math.round(x / css) - art.ax, ay = Math.round(y / css) - art.ay;
      if (ay > H || ay + art.img.height < 0 || ax > W || ax + art.img.width < 0) continue;
      ctx.globalAlpha = reduced.matches ? 1 : Math.min(1, (now - art.at) / 600);
      ctx.drawImage(art.img, ax, ay);
    }
    ctx.globalAlpha = 1;
    lastDraw = now;
    dirty = false;
  };

  const tick = (now: number): void => {
    // the sway moves a whole art px every few tenths of a second: redraw then, or when the page moves
    if (dirty || (!reduced.matches && now - lastDraw > 250) || pool.some((a) => a && now - a.at < 700)) draw(now);
    requestAnimationFrame(tick);
  };
  window.addEventListener("scroll", () => { dirty = true; }, { passive: true });
  window.addEventListener("resize", () => { dirty = true; grad = null; replan(); });
  requestAnimationFrame(tick);
}
