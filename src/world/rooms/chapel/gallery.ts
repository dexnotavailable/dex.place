// The Chapel of Light's gallery in the world (lane R-E), WORLD-PLAN section 14,
// default 3 (option B): a small DOM overlay of the real thumbnail pinned inside
// each frame. The art is never drawn into the world: no pixelation, no tint,
// no lighting, never a texture or a backdrop. Each <img> is the thumbnail
// from content/gallery/manifest.json (srcset from its real smaller copies),
// placed every frame exactly on the frame's dark board (artRect() from the
// frame recipe) through the world's camera and the presenter's scale rule.
// It hides while the screen is faded (a door) and during the combat close-up.
// Where Rosace's drawn sprite passes in front of a work, a CSS mask of her exact
// silhouette (her current sprite frame's alpha, read once per frame from the
// GPU atlas) is taken out of the picture, so the canvas below shows her and
// nothing else: no box, and never the frame's board.
//
// Two stub-engine recipes, found by the room registry (no shared edit):
//   art-thumb  the overlay for one frame (placed with the frame's params)
//   sit-spot   the seat to sit and look: E sits you through the runtime's own
//              sit (the camera holds on the room's vista, the UI hides, the
//              music dips); invisible, next to a pew that has no E of its own
//
// And the gallery panel's neighbours: while the panel shows one work, it gets
// "previous", "next" and "all works" (the catalogue) buttons, and the left and
// right arrow keys step to the neighbouring work. The panel itself is the
// runtime's (src/world/ui.ts); this only adds the buttons to it while a work
// is open (an ask for W0: fold them into ui.ts).

import galleryRaw from "../../../../content/gallery/manifest.json?raw";
import { artRect } from "../../../pixel/props/chapel/artFrame.ts";
import type { Box, Interaction, Prop, PropCanvas, PropLayer, PropLight, PropParams, PropRecipe, PropWorld } from "../../props-api.ts";

interface Item {
  id: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  thumb?: string;
  thumbWidth?: number;
  widths?: number[];
}

export const GALLERY: Item[] = (JSON.parse(galleryRaw) as { items: Item[] }).items;

/** One sprite draw of the player (the lab Player's spriteDraw(): atlas rect and top-left in world px). */
interface SpriteDrawLike {
  sheet: { albedo: { tex: WebGLTexture; w: number; h: number } };
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  x: number;
  y: number;
  flip?: boolean;
}

/** The world game, reached through its public automation handle (window.__world). */
interface GameLike {
  camera: { view(): [number, number]; closeup: number };
  r: { canvas: HTMLCanvasElement; gl?: WebGL2RenderingContext; presenter: { rect: { x: number; y: number; w: number; h: number; scale: number } } };
  player: { body: { x: number; y: number }; fade: number; spriteDraw?(): SpriteDrawLike | undefined; dead?: number; invuln?: number; mode?: string };
  panels: { show(kind: string, arg?: string): void; open: boolean; kind: string | null };
  room: { def: { id: string } };
}

function game(): GameLike | null {
  const w = (window as unknown as { __world?: { game?: GameLike } }).__world;
  return w?.game ?? null;
}

// ---------------------------------------------------------------------------------
// The overlay

/** Standard mask-composite (Chrome 120+, Firefox, Safari 15.4+); else the -webkit- form. */
const MASK_STD = typeof CSS !== "undefined" && CSS.supports("mask-composite", "exclude");

class Overlay {
  private root: HTMLElement | null = null;
  private imgs = new Map<string, HTMLImageElement>();
  private seen = new Set<string>();
  private sweepQueued = false;

  private watching = false;

  /**
   * Every animation frame: when the world is in a room with no frames (the
   * thumbnails' room is only kept warm nearby, or gone), nothing is shown.
   */
  private watch(): void {
    if (this.watching) return;
    this.watching = true;
    const tick = (): void => {
      const g = game();
      const here = g?.room?.def.id;
      if (!g || !this.imgs.size || ![...this.imgs.values()].some((im) => im.dataset.room === here)) for (const im of this.imgs.values()) im.style.visibility = "hidden";
      else for (const im of this.imgs.values()) if (im.dataset.room !== here) im.style.visibility = "hidden";
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private ensure(): HTMLElement | null {
    this.watch();
    if (this.root?.isConnected) return this.root;
    const stage = document.getElementById("stage");
    const canvas = document.getElementById("view");
    if (!stage || !canvas) return null;
    const root = document.createElement("div");
    root.id = "chapel-art";
    root.setAttribute("aria-hidden", "false");
    root.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    canvas.after(root);
    this.root = root;
    return root;
  }

  /** Place the thumbnail for `key` at world rect (x0, y0, x1, y1) this frame. */
  place(key: string, art: string, x0: number, y0: number, x1: number, y1: number): void {
    const g = game();
    const root = this.ensure();
    if (!g || !root) return;
    let img = this.imgs.get(key);
    if (!img) {
      const it = GALLERY.find((q) => q.id === art);
      if (!it) return;
      img = document.createElement("img");
      img.decoding = "async";
      img.alt = it.alt;
      img.draggable = false;
      const set = [...(it.widths ?? []).map((w) => `${it.src.replace(/\.webp$/, `-${w}.webp`)} ${w}w`), `${it.src} ${it.width}w`];
      img.srcset = set.join(", ");
      img.src = it.thumb ?? it.src;
      img.style.cssText = "position:absolute;left:0;top:0;display:block;object-fit:cover;image-rendering:auto;will-change:transform;transform-origin:0 0;";
      root.append(img);
      this.imgs.set(key, img);
    }
    img.dataset.room = g.room.def.id;
    const canvas = g.r.canvas;
    const pr = g.r.presenter.rect;
    const k = canvas.clientWidth / Math.max(1, canvas.width);
    const [cx, cy] = g.camera.view();
    // Presenter.rect already uses a top-left origin, as the scene shader does.
    const top = pr.y;
    const L = (pr.x + (x0 - cx) * pr.scale) * k;
    const T = (top + (y0 - cy) * pr.scale) * k;
    const W = (x1 - x0) * pr.scale * k;
    const Hh = (y1 - y0) * pr.scale * k;
    const fade = Math.max(Number((g as unknown as { fade?: number }).fade ?? 0), g.player.fade ?? 0);
    const hidden = g.camera.closeup >= 0.02 || fade > 0.98;
    img.style.width = `${W.toFixed(2)}px`;
    img.style.height = `${Hh.toFixed(2)}px`;
    img.sizes = `${Math.ceil(W)}px`;
    img.style.transform = `translate(${L.toFixed(2)}px, ${T.toFixed(2)}px)`;
    img.style.opacity = hidden ? "0" : (1 - fade).toFixed(3);
    img.style.visibility = hidden ? "hidden" : "visible";
    // Rosace in front of the work: mask exactly her drawn pixels out of the picture,
    // so the canvas below shows her (lit, as drawn) and never the frame's board
    this.maskPlayer(img, g, x0, y0, x1, y1, pr.scale * k);
    this.seen.add(key);
    if (!this.sweepQueued) {
      this.sweepQueued = true;
      // after this render: hide every thumbnail that wasn't drawn (out of view, another room)
      queueMicrotask(() => {
        this.sweepQueued = false;
        for (const [k2, im] of this.imgs) if (!this.seen.has(k2)) im.style.visibility = "hidden";
        this.seen.clear();
      });
    }
  }

  /**
   * Her silhouette as a CSS mask on one thumbnail. Only the pixels her sprite
   * draws this frame (same frame rect, pivot, flip and the sprite shader's 0.5
   * alpha cut) are taken out, so wherever she doesn't reach the work nothing
   * is cut at all. While she is drawn dithered (dying, the hurt blink) the
   * canvas would show the board through her, so she goes behind the work.
   */
  private maskPlayer(img: HTMLImageElement, g: GameLike, x0: number, y0: number, x1: number, y1: number, css: number): void {
    const p = g.player;
    const d = p.spriteDraw?.();
    const dithered = (p.dead ?? 0) > 0 || ((p.invuln ?? 0) > 0 && p.mode !== "action" && Math.floor((p.invuln ?? 0) / 4) % 2 === 0);
    let mask = "";
    if (d && !dithered && d.x < x1 && d.x + d.sw > x0 && d.y < y1 && d.y + d.sh > y0) {
      const sil = this.silhouette(g, d, css * (window.devicePixelRatio || 1), x0 - d.x, y0 - d.y, x1 - d.x, y1 - d.y);
      if (sil) {
        const mx = ((d.x - x0) * css).toFixed(2), my = ((d.y - y0) * css).toFixed(2);
        const mw = (d.sw * css).toFixed(2), mh = (d.sh * css).toFixed(2);
        mask = `url("${sil}") ${mx}px ${my}px / ${mw}px ${mh}px no-repeat, linear-gradient(#000, #000) 0 0 / 100% 100% no-repeat`;
      }
    }
    if (img.dataset.mask === mask) return;
    img.dataset.mask = mask;
    const s = img.style as CSSStyleDeclaration & Record<string, string>;
    if (!mask) {
      s.mask = "";
      s.webkitMask = "";
      s.maskComposite = "";
      s.webkitMaskComposite = "";
      this.masked = Math.max(0, this.masked - (img.dataset.masked ? 1 : 0));
      delete img.dataset.masked;
      return;
    }
    if (!img.dataset.masked) this.masked++;
    img.dataset.masked = "1";
    if (MASK_STD) {
      s.mask = mask;
      s.maskComposite = "exclude";
    } else {
      s.webkitMask = mask;
      s.webkitMaskComposite = "xor";
    }
  }

  /** How many thumbnails carry her mask right now (for the captures). */
  masked = 0;

  private alphaCache = new Map<string, Uint8Array>();
  private silCache = new Map<string, string | null>();
  private readFbo: WebGLFramebuffer | null = null;

  /**
   * A data URL of her silhouette for one sprite frame at `scale` device px per
   * world px (nearest, pixel centres), or null when none of her opaque pixels
   * fall inside the art rect (ax0..ax1, ay0..ay1 in the frame's own px).
   */
  private silhouette(g: GameLike, d: SpriteDrawLike, scale: number, ax0: number, ay0: number, ax1: number, ay1: number): string | null {
    const alpha = this.frameAlpha(g, d);
    if (!alpha) return null;
    const { sw, sh, flip } = d;
    // any of her pixels over the work?
    let any = false;
    const cx0 = Math.max(0, Math.floor(ax0)), cx1 = Math.min(sw, Math.ceil(ax1));
    const cy0 = Math.max(0, Math.floor(ay0)), cy1 = Math.min(sh, Math.ceil(ay1));
    for (let y = cy0; y < cy1 && !any; y++) {
      for (let x = cx0; x < cx1; x++) {
        const sx = flip ? sw - 1 - x : x;
        if (alpha[y * sw + sx]! >= 128) {
          any = true;
          break;
        }
      }
    }
    if (!any) return null;
    const key = `${d.sheet.albedo.w}x${d.sheet.albedo.h}:${d.sx},${d.sy},${sw},${sh}:${flip ? 1 : 0}:${scale.toFixed(3)}`;
    const hit = this.silCache.get(key);
    if (hit !== undefined) return hit;
    const W = Math.max(1, Math.ceil(sw * scale));
    const H = Math.max(1, Math.ceil(sh * scale));
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    const out = ctx.createImageData(W, H);
    for (let j = 0; j < H; j++) {
      const wy = Math.min(sh - 1, Math.floor((j + 0.5) / scale));
      for (let i = 0; i < W; i++) {
        const wx = Math.min(sw - 1, Math.floor((i + 0.5) / scale));
        const sx = flip ? sw - 1 - wx : wx;
        if (alpha[wy * sw + sx]! >= 128) {
          const o = (j * W + i) * 4;
          out.data[o] = out.data[o + 1] = out.data[o + 2] = out.data[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
    const url = cv.toDataURL("image/png");
    if (this.silCache.size > 600) this.silCache.clear();
    this.silCache.set(key, url);
    return url;
  }

  /** The alpha of one sprite frame, read once from the GPU atlas (rows top-down, like the image). */
  private frameAlpha(g: GameLike, d: SpriteDrawLike): Uint8Array | null {
    const key = `${d.sheet.albedo.w}x${d.sheet.albedo.h}:${d.sx},${d.sy},${d.sw},${d.sh}`;
    const hit = this.alphaCache.get(key);
    if (hit) return hit;
    const gl = g.r.gl;
    if (!gl) return null;
    const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    this.readFbo ??= gl.createFramebuffer();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.readFbo);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, d.sheet.albedo.tex, 0);
    const rgba = new Uint8Array(d.sw * d.sh * 4);
    const ok = gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (ok) gl.readPixels(d.sx, d.sy, d.sw, d.sh, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prev);
    if (!ok) return null;
    const a = new Uint8Array(d.sw * d.sh);
    for (let i = 0; i < a.length; i++) a[i] = rgba[i * 4 + 3]!;
    if (this.alphaCache.size > 600) this.alphaCache.clear();
    this.alphaCache.set(key, a);
    return a;
  }

  remove(key: string): void {
    this.imgs.get(key)?.remove();
    this.imgs.delete(key);
  }

  /** Test hook: where each thumbnail is (CSS px), for the captures. */
  report(): { key: string; left: number; top: number; width: number; height: number; visible: boolean; src: string }[] {
    return [...this.imgs].map(([key, im]) => {
      const r = im.getBoundingClientRect();
      return { key, left: r.left, top: r.top, width: r.width, height: r.height, visible: im.style.visibility !== "hidden" && im.style.opacity !== "0", src: im.currentSrc || im.src };
    });
  }
}

export const overlay = new Overlay();
Object.assign(window, { __chapelArt: overlay });

class ArtThumb implements Prop {
  readonly recipe = "art-thumb";
  readonly reason = "Dex's work, shown as itself: the real thumbnail pinned inside its frame (WORLD-PLAN section 14, default 3), never drawn into the world.";
  readonly states = ["shown"] as const;
  readonly state = "shown";
  readonly collision = "none" as const;
  readonly layers: PropLayer[] = ["light"];
  readonly id: string;
  x: number;
  y: number;
  private art: string;
  private rect: { x0: number; y0: number; x1: number; y1: number };
  constructor(p: PropParams) {
    this.id = p.id;
    this.x = p.x;
    this.y = p.y;
    this.art = String(p["art"] ?? "01");
    this.rect = artRect({ w: Number(p["w"] ?? 2.4), h: Number(p["h"] ?? 1.35), sill: p["sill"] as number | undefined, kind: String(p["kind"] ?? "easel") }, p.H);
  }
  bounds(): Box {
    return { x: this.x + this.rect.x0, y: this.y + this.rect.y0, w: this.rect.x1 - this.rect.x0, h: this.rect.y1 - this.rect.y0 };
  }
  solids(): Box[] {
    return [];
  }
  interaction(): Interaction | null {
    return null;
  }
  hit(): boolean {
    return false;
  }
  update(): void {}
  draw(_c: PropCanvas, layer: PropLayer): void {
    if (layer !== "light") return;
    const r = this.rect;
    overlay.place(this.id, this.art, this.x + r.x0, this.y + r.y0, this.x + r.x1, this.y + r.y1);
  }
  lights(_out: PropLight[]): void {}
  setState(): void {}
  dispose(): void {
    overlay.remove(this.id);
  }
}

export const artThumb: PropRecipe = {
  name: "art-thumb",
  reason: "The real thumbnail of one of Dex's works, pinned inside its frame as DOM (WORLD-PLAN section 14, default 3).",
  build: (p) => {
    installGalleryNav();
    return new ArtThumb(p);
  },
};

// ---------------------------------------------------------------------------------
// The seat to sit and look

class SitSpot implements Prop {
  readonly recipe = "sit-spot";
  readonly reason = "The bench to sit and look (WORLD-PLAN E3, E4): E sits; the camera holds on the view, the UI hides and the music dips.";
  readonly states = ["free"] as const;
  readonly state = "free";
  readonly collision = "none" as const;
  readonly layers: PropLayer[] = [];
  readonly id: string;
  x: number;
  y: number;
  private H: number;
  constructor(p: PropParams) {
    this.id = p.id;
    this.x = p.x;
    this.y = p.y;
    this.H = p.H;
  }
  bounds(): Box {
    return { x: this.x - this.H * 0.8, y: this.y - this.H * 0.4, w: this.H * 1.6, h: this.H * 0.4 };
  }
  solids(): Box[] {
    return [];
  }
  interaction(): Interaction {
    return { radius: this.H * 0.8, label: "", use: (w: PropWorld) => w.openPanel("sit", this.id) };
  }
  hit(): boolean {
    return false;
  }
  update(): void {}
  draw(): void {}
  lights(): void {}
  setState(): void {}
  dispose(): void {}
}

export const sitSpot: PropRecipe = {
  name: "sit-spot",
  reason: "The seat to sit and look at the works or the view (WORLD-PLAN E3, E4).",
  build: (p) => new SitSpot(p),
};

// ---------------------------------------------------------------------------------
// The gallery panel's neighbours (previous, next, all works; arrow keys)

let navInstalled = false;

export function installGalleryNav(): void {
  if (navInstalled) return;
  const panel = document.getElementById("panel");
  if (!panel) return;
  navInstalled = true;
  const style = document.createElement("style");
  style.textContent = `
#panel .art-nav { display: flex; gap: 8px; justify-content: space-between; align-items: center; margin: 10px 0 0; }
#panel .art-nav button { min-width: 44px; min-height: 36px; padding: 4px 12px; font: 14px/1 system-ui, sans-serif; color: #e4dccb; background: #1d1712; border: 1px solid #5a4630; cursor: pointer; }
#panel .art-nav button:focus-visible { outline: 2px solid #e8c98a; }
#panel .art-nav .all { margin: 0 auto; }
`;
  document.head.append(style);
  const current = (): string | null => {
    if (panel.dataset.kind !== "gallery") return null;
    const img = panel.querySelector<HTMLImageElement>(".body figure img");
    const m = img ? /\/gallery\/(\d\d)\.webp/.exec(img.getAttribute("src") ?? "") : null;
    return m ? m[1]! : null;
  };
  const step = (d: number): void => {
    const id = current();
    const g = game();
    if (!id || !g) return;
    const i = GALLERY.findIndex((q) => q.id === id);
    const next = GALLERY[(i + d + GALLERY.length) % GALLERY.length]!;
    g.panels.show("gallery", next.id);
  };
  const decorate = (): void => {
    const id = current();
    const body = panel.querySelector(".body");
    if (!id || !body || body.querySelector(".art-nav")) return;
    const i = GALLERY.findIndex((q) => q.id === id);
    const prev = GALLERY[(i - 1 + GALLERY.length) % GALLERY.length]!;
    const next = GALLERY[(i + 1) % GALLERY.length]!;
    const nav = document.createElement("nav");
    nav.className = "art-nav";
    nav.setAttribute("aria-label", "Works");
    nav.innerHTML = `<button type="button" class="prev" aria-label="Previous work">&larr;</button><button type="button" class="all">All works</button><button type="button" class="next" aria-label="Next work">&rarr;</button>`;
    nav.querySelector(".prev")!.addEventListener("click", () => step(-1));
    nav.querySelector(".next")!.addEventListener("click", () => step(1));
    nav.querySelector(".all")!.addEventListener("click", () => game()?.panels.show("gallery", "all"));
    (nav.querySelector(".prev") as HTMLElement).title = `Previous (${prev.id})`;
    (nav.querySelector(".next") as HTMLElement).title = `Next (${next.id})`;
    body.querySelector("figure")?.after(nav);
  };
  new MutationObserver(decorate).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "data-kind"] });
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (!current()) return;
    e.preventDefault();
    step(e.key === "ArrowLeft" ? -1 : 1);
  });
}
