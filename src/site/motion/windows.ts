// Windows into the world (Dex 10-18: "we start with the whole background white, then punch in some windows into the
// world, each window showing something different"). The page is plain white; beside each section a window looks into
// Tesu, alternating left and right, each onto a different place: the towering sky, the palace, the floating isles,
// Kagami's lake with its torii islet, a pine over the karst in mist, the sea of clouds. Each is composed from the
// world's own painters (motion/sky-paint.ts, in a worker) over a dithered sky, and lives a little: clouds drift, the
// isles and the boat bob, egrets cross, the lake shimmers. Whole pixels only (k device px per art px). Only windows
// on screen animate; reduced motion: each is drawn once, still. The window's edge dissolving into the white is CSS
// (styles/v2.css `.band__win`).

import { rampIndex } from "./sky-plan.ts";
import type { CloudDone, CloudJob } from "./sky-paint.ts";

export type SceneId = "sky" | "palace" | "isles" | "lake" | "pine" | "deck";

type Rgb = [number, number, number];

export interface ScenePiece {
  kind: string;
  p: Record<string, unknown>;
  /** The piece's height as a share of the window's (its density is chosen to fit). */
  fit: number;
  /** Where its anchor sits, shares of the window (x across, y down). */
  x: number;
  y: number;
  /** Slow sway across (art px) and its speed; a bob up and down (art px); a crossing (art px / s, wraps). */
  sway?: number;
  speed?: number;
  bob?: number;
  cross?: number;
  seed?: number;
}

export interface Scene {
  /** Sky colours, top to bottom (a dithered ramp between them). */
  sky: Rgb[];
  pieces: ScenePiece[];
  /** A lake from this height down (share of the window), its colours top to bottom. */
  water?: { y: number; tones: Rgb[] };
  /** A band of mist (white, dithered) at this height, this deep (shares). */
  mist?: { y: number; h: number };
}

const SKY_DAY: Rgb[] = [[30, 84, 156], [56, 122, 192], [104, 166, 222], [168, 208, 240], [214, 234, 249]];
const SKY_DAWN: Rgb[] = [[70, 128, 196], [128, 178, 226], [190, 218, 240], [242, 230, 214], [252, 236, 214]];
const SKY_HIGH: Rgb[] = [[22, 66, 132], [36, 92, 164], [64, 128, 196], [120, 176, 228], [196, 226, 248]];
const LAKE: Rgb[] = [[219, 242, 235], [176, 226, 212], [131, 204, 191], [90, 178, 167], [63, 145, 140]];

/** The scenes (art px are the world's; every piece is painted to fit its window). */
export const SCENES: Readonly<Record<SceneId, Scene>> = {
  sky: {
    sky: SKY_DAY,
    pieces: [
      { kind: "op.cloud", p: { kind: "cumulus", w: 420, h: 210 }, fit: 0.42, x: 0.16, y: 0.9, sway: 6, speed: 0.05, seed: 3 },
      { kind: "op.cloud", p: { kind: "tower", w: 230, h: 300 }, fit: 0.86, x: 0.64, y: 1.03, sway: 4, speed: 0.04, seed: 5 },
      { kind: "op.cloud", p: { kind: "wisp", w: 260, h: 30 }, fit: 0.07, x: 0.32, y: 0.26, sway: 10, speed: 0.07, seed: 7 },
      { kind: "op.birds", p: { n: 4, w: 120, h: 40, kind: "egret", size: 5 }, fit: 0.12, x: 0.3, y: 0.5, cross: 5, seed: 9 },
    ],
  },
  palace: {
    sky: SKY_DAWN,
    pieces: [
      { kind: "op.cloud", p: { kind: "cumulus", w: 340, h: 180, tower: 0.9 }, fit: 0.36, x: 0.82, y: 0.55, sway: 5, speed: 0.04, seed: 11 },
      { kind: "op.farkarst", p: { w: 900, h: 178, rows: 2, groups: [[80, 380], [480, 860, 0.62]], haze: 0.6 }, fit: 0.26, x: 0.5, y: 0.8 },
      { kind: "op.palace", p: { w: 1200, h0: 537, h1: 403, h2: 307, door: [500, 200, 355] }, fit: 0.8, x: 0.2, y: 0.97 },
      { kind: "op.pine", p: { h: 260, dir: 1 }, fit: 0.5, x: -0.02, y: 1.04, seed: 13 },
    ],
  },
  isles: {
    sky: SKY_DAY,
    pieces: [
      { kind: "op.cloud", p: { kind: "wisp", w: 280, h: 30 }, fit: 0.07, x: 0.7, y: 0.2, sway: 8, speed: 0.06, seed: 17 },
      { kind: "op.isle", p: { w: 92, h: 120, tower: "bell" }, fit: 0.87, x: 0.32, y: 0.41, bob: 1, speed: 0.6, seed: 19 },
      { kind: "op.isle", p: { w: 110, h: 96, tower: "drum" }, fit: 0.66, x: 0.76, y: 0.57, bob: 1, speed: 0.5, seed: 23 },
      { kind: "op.cloud", p: { kind: "cumulus", w: 460, h: 150, tower: 0.45 }, fit: 0.36, x: 0.42, y: 1.03, sway: 6, speed: 0.03, seed: 29 },
      { kind: "op.birds", p: { n: 3, w: 90, h: 30, kind: "egret", size: 5 }, fit: 0.08, x: 0.55, y: 0.36, cross: 4, seed: 31 },
    ],
  },
  lake: {
    sky: SKY_DAY,
    water: { y: 0.64, tones: LAKE },
    pieces: [
      { kind: "op.cloud", p: { kind: "cumulus", w: 460, h: 150, tower: 0.45 }, fit: 0.3, x: 0.3, y: 0.5, sway: 6, speed: 0.04, seed: 37 },
      { kind: "op.farkarst", p: { w: 900, h: 170, rows: 2, groups: [[60, 420], [560, 880]], haze: 0.6 }, fit: 0.22, x: 0.5, y: 0.645 },
      { kind: "op.islet", p: { kind: "torii", w: 96, h: 13 }, fit: 0.26, x: 0.64, y: 0.7 },
      { kind: "op.boat", p: { w: 70 }, fit: 0.1, x: 0.24, y: 0.86, bob: 1, speed: 1.1, seed: 41 },
      { kind: "op.birds", p: { n: 3, w: 90, h: 30, kind: "egret", size: 5 }, fit: 0.08, x: 0.4, y: 0.34, cross: 4, seed: 43 },
    ],
  },
  pine: {
    sky: SKY_DAWN,
    mist: { y: 0.76, h: 0.14 },
    pieces: [
      { kind: "op.cloud", p: { kind: "cumulus", w: 300, h: 150, tower: 0.6 }, fit: 0.32, x: 0.74, y: 0.58, sway: 5, speed: 0.05, seed: 47 },
      { kind: "op.farkarst", p: { w: 900, h: 178, rows: 2, groups: [[120, 460], [560, 860, 0.7]], haze: 0.6 }, fit: 0.32, x: 0.5, y: 0.84 },
      { kind: "op.pine", p: { h: 260, dir: 1 }, fit: 0.78, x: 0.1, y: 1.04, seed: 53 },
    ],
  },
  deck: {
    sky: SKY_HIGH,
    pieces: [
      { kind: "op.isle", p: { w: 110, h: 96, tower: "drum" }, fit: 0.52, x: 0.7, y: 0.38, bob: 1, speed: 0.5, seed: 59 },
      { kind: "op.cloud", p: { kind: "cumulus", w: 460, h: 150, tower: 0.55 }, fit: 0.42, x: 0.2, y: 0.86, sway: 5, speed: 0.04, seed: 61 },
      { kind: "op.cloud", p: { kind: "cumulus", w: 420, h: 210 }, fit: 0.4, x: 0.85, y: 0.98, sway: 7, speed: 0.03, seed: 67 },
      { kind: "op.cloud", p: { kind: "stratus", w: 640, h: 50 }, fit: 0.22, x: 0.45, y: 1.06, sway: 6, speed: 0.035, seed: 71 },
    ],
  },
};

/** A ramp of `n` steps through the key colours. */
function ramp(keys: Rgb[], n: number): Rgb[] {
  const out: Rgb[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * (keys.length - 1);
    const a = keys[Math.floor(u)]!, b = keys[Math.min(keys.length - 1, Math.floor(u) + 1)]!, f = u - Math.floor(u);
    out.push([Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)]);
  }
  return out;
}

interface Art { img: HTMLCanvasElement; ax: number; ay: number }

interface Win {
  el: HTMLElement;
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scene: Scene;
  W: number;
  H: number;
  k: number;
  back: HTMLCanvasElement | null;
  art: (Art | null)[];
  visible: boolean;
  gen: number;
  drawnStill: boolean;
}

export function initWindows(reduced: MediaQueryList, worker: () => Worker): void {
  const els = [...document.querySelectorAll<HTMLElement>("[data-window]")];
  if (!els.length) return;
  const wins: Win[] = [];
  let nextId = 1000;
  const pending = new Map<number, [Win, number, number]>();
  const w = worker();
  w.addEventListener("message", (e: MessageEvent<CloudDone>) => {
    const job = pending.get(e.data.id);
    if (!job) return;
    pending.delete(e.data.id);
    const [win, i, gen] = job;
    if (gen !== win.gen) return;
    const d = e.data;
    const img = document.createElement("canvas");
    img.width = d.w;
    img.height = d.h;
    img.getContext("2d")!.putImageData(new ImageData(d.rgba as Uint8ClampedArray<ArrayBuffer>, d.w, d.h), 0, 0);
    win.art[i] = { img, ax: d.ax, ay: d.ay };
    win.drawnStill = false;
  });

  const layout = (win: Win): void => {
    const dpr = window.devicePixelRatio || 1;
    const r = win.el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const k = Math.max(1, Math.round(2 * dpr));
    const W = Math.ceil((r.width * dpr) / k), H = Math.ceil((r.height * dpr) / k);
    if (win.k === k && Math.abs(W - win.W) < 2 && Math.abs(H - win.H) < 2) return;
    const repaint = !win.H || Math.abs(H - win.H) / win.H > 0.08 || win.k !== k;
    win.W = W;
    win.H = H;
    win.k = k;
    win.cv.width = W;
    win.cv.height = H;
    win.cv.style.width = `${(W * k) / dpr}px`;
    win.cv.style.height = `${(H * k) / dpr}px`;
    win.back = null;
    win.drawnStill = false;
    if (!repaint) return;
    win.gen++;
    win.art = win.scene.pieces.map(() => null);
    win.scene.pieces.forEach((pc, i) => {
      const id = nextId++;
      pending.set(id, [win, i, win.gen]);
      const job: CloudJob = { id, kind: pc.kind, p: pc.p, seed: pc.seed ?? 7 + i, fitH: Math.max(4, Math.round(pc.fit * H)) };
      w.postMessage(job);
    });
  };

  // the sky behind the pieces: a dithered ramp, and the lake and the mist, drawn once per size
  const backdrop = (win: Win): HTMLCanvasElement => {
    if (win.back) return win.back;
    const { W, H, scene } = win;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d")!;
    const img = g.createImageData(W, H);
    const sky = ramp(scene.sky, 18);
    const lakeTop = scene.water ? Math.round(scene.water.y * H) : H;
    const lake = scene.water ? ramp(scene.water.tones, 8) : [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const col = y < lakeTop ? sky[rampIndex(x, y, lakeTop, sky.length)]! : lake[rampIndex(x, y - lakeTop, H - lakeTop, lake.length)]!;
        const i = (y * W + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    win.back = c;
    return c;
  };

  const hash = (a: number, b: number): number => {
    let h = Math.imul(a * 374761393 + b * 668265263, 3266489917) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  };

  const draw = (win: Win, t: number): void => {
    const { ctx, W, H, scene } = win;
    if (!W || !H) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(backdrop(win), 0, 0);
    // the mist, a dithered white band behind the nearest piece
    scene.pieces.forEach((pc, i) => {
      const art = win.art[i];
      if (!art) return;
      if (scene.mist && i === scene.pieces.length - 1) mist(win, t);
      const tt = reduced.matches ? 0 : t;
      let x = pc.x * W + (pc.sway ? Math.sin(tt * (pc.speed ?? 0.05) * 6.28 + i) * pc.sway : 0);
      const y = pc.y * H + (pc.bob ? Math.round(Math.sin(tt * (pc.speed ?? 0.5) * 6.28 + i * 1.7) * pc.bob) : 0);
      if (pc.cross) {
        const span = W + art.img.width;
        x = ((((pc.x * W + tt * pc.cross) % span) + span) % span) - art.img.width / 2;
      }
      ctx.drawImage(art.img, Math.round(x) - art.ax, Math.round(y) - art.ay);
    });
    if (scene.water) ripples(win, t);
  };

  const mist = (win: Win, t: number): void => {
    const { ctx, W, H, scene } = win;
    const m = scene.mist!;
    const y0 = Math.round(m.y * H), y1 = Math.round((m.y + m.h) * H);
    ctx.fillStyle = "rgba(250, 250, 250, 1)";
    const drift = reduced.matches ? 0 : Math.floor(t * 2);
    for (let y = y0; y < y1; y++) {
      const u = (y - y0) / Math.max(1, y1 - y0);
      const dens = Math.sin(u * Math.PI) * 0.75;
      for (let x = 0; x < W; x++) if (hash(x + drift, y) < dens * (0.55 + 0.45 * hash(Math.floor((x + drift) / 9), Math.floor(y / 3)))) ctx.fillRect(x, y, 1, 1);
    }
  };

  const ripples = (win: Win, t: number): void => {
    const { ctx, W, H, scene } = win;
    const top = Math.round(scene.water!.y * H);
    const frame = reduced.matches ? 0 : Math.floor(t * 3);
    for (let y = top + 2; y < H; y += 2) {
      const n = Math.round((W / 40) * (0.5 + (y - top) / (H - top)));
      for (let i = 0; i < n; i++) {
        const h1 = hash(i * 7 + frame, y), h2 = hash(i * 13, y * 3 + frame);
        ctx.fillStyle = h2 < 0.5 ? "#dbf2eb" : "#3f918c";
        ctx.fillRect(Math.floor(h1 * W), y, 2 + Math.floor(h2 * 5), 1);
      }
    }
  };

  for (const el of els) {
    const id = el.dataset.window as SceneId;
    const scene = SCENES[id] ?? SCENES.sky;
    const cv = document.createElement("canvas");
    el.prepend(cv);
    const ctx = cv.getContext("2d");
    if (!ctx) continue;
    wins.push({ el, cv, ctx, scene, W: 0, H: 0, k: 0, back: null, art: [], visible: false, gen: 0, drawnStill: false });
  }
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const win = wins.find((x) => x.el === e.target);
        if (win) win.visible = e.isIntersecting;
      }
    }, { rootMargin: "200px 0px" });
    for (const win of wins) io.observe(win.el);
  } else for (const win of wins) win.visible = true;
  for (const win of wins) layout(win);
  let t0 = performance.now(), last = 0;
  window.addEventListener("resize", () => { for (const win of wins) layout(win); });
  const tick = (now: number): void => {
    // a few frames a second: the drift and the bob move whole pixels slowly
    if (now - last > 160) {
      last = now;
      const t = (now - t0) / 1000;
      for (const win of wins) {
        if (!win.visible) continue;
        if (reduced.matches) {
          if (win.drawnStill) continue;
          win.drawnStill = win.art.every(Boolean);
        }
        draw(win, t);
      }
    }
    requestAnimationFrame(tick);
  };
  void t0;
  t0 = performance.now();
  requestAnimationFrame(tick);
}
