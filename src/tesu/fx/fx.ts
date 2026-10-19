// World effects as pixel sprite animations (lane C 10-19, lanes/engine/EFFECTS-CONTRACT.md): every effect under
// public/assets/fx/<id>/ (fx.json + fNNN.png) loads at start, trimmed and packed into atlases like her drawings, and
// is drawn at her art px through her own path (the actors' pass: at screen res where an art px is a screen px or more,
// else in the actor layer, reduced onto her grid). The game plays one with fx.play(id, { x, y, facing }).

import type { SpriteSheet } from "../../lab/engine/renderer.ts";
import type { WorldRenderer } from "../../world/render/renderer.ts";
import { opaqueBox } from "../zhusha/contract.ts";
import { artTransform, type PlayView } from "../zhusha/units.ts";
import { FxClock, FX_MAX_AREA, fxFrameAt, validateFx, type FxDef, type FxHandle, type FxLayer, type FxSpawn } from "./contract.ts";

/** Effects present at build time (a missing one is never fetched). */
export const FX_PRESENT: string[] = Object.keys(import.meta.glob("/public/assets/fx/*/fx.json"))
  .map((k) => k.split("/")[4] ?? "")
  .filter(Boolean)
  .sort();

export const FX_BASE = "/assets/fx/";
const ATLAS = 2048;

interface FxDrawing {
  sheet: number;
  r: [number, number, number, number];
  /** The trimmed drawing's top-left from the pivot (art px). */
  off: [number, number];
}

interface FxLoaded {
  def: FxDef;
  drawings: FxDrawing[];
  sheets: SpriteSheet[];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadFx(r: WorldRenderer, id: string): Promise<FxLoaded> {
  const res = await fetch(`${FX_BASE}${id}/fx.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${id}: fx.json HTTP ${res.status}`);
  const def = validateFx(await res.json(), id);
  const imgs = await Promise.all(def.frames.map((f) => loadImage(`${FX_BASE}${id}/${f.file}`)));
  const pages: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D }[] = [];
  let x = 0, y = 0, row = 0, area = 0;
  const place = (w: number, h: number): [number, number, number] => {
    if (!pages.length || x + w > ATLAS) { x = 0; y += row; row = 0; }
    if (!pages.length || y + h > ATLAS) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = ATLAS;
      pages.push({ canvas, g: canvas.getContext("2d", { willReadFrequently: true })! });
      x = y = row = 0;
    }
    const at: [number, number, number] = [pages.length - 1, x, y];
    x += w + 1;
    row = Math.max(row, h + 1);
    return at;
  };
  const scratch = document.createElement("canvas");
  const sg = scratch.getContext("2d", { willReadFrequently: true })!;
  const [pvx, pvy] = def.pivot;
  const drawings = imgs.map((img, i): FxDrawing => {
    const w = img.naturalWidth, h = img.naturalHeight;
    scratch.width = w;
    scratch.height = h;
    sg.clearRect(0, 0, w, h);
    sg.drawImage(img, 0, 0);
    const box = opaqueBox(sg.getImageData(0, 0, w, h).data, w, h) ?? [pvx, pvy, pvx + 1, pvy + 1];
    const [x0, y0, x1, y1] = box;
    const bw = x1 - x0, bh = y1 - y0;
    area += bw * bh;
    const [page, ax, ay] = place(bw, bh);
    pages[page]!.g.drawImage(img, x0, y0, bw, bh, ax, ay, bw, bh);
    const off = def.frames[i]!.off ?? [0, 0];
    return { sheet: page, r: [ax, ay, bw, bh], off: [x0 - pvx + off[0], y0 - pvy + off[1]] };
  });
  if (area > FX_MAX_AREA) throw new Error(`${id}: ${area} opaque px over its drawings, the limit is ${FX_MAX_AREA}`);
  return { def, drawings, sheets: pages.map((p) => ({ albedo: r.texture(p.canvas), normal: r.flatNormal, keyInfluence: 0 })) };
}

/** The game's effects: loaded at start, played by id, drawn in the actors' pass with her. */
export class Fx {
  private loaded = new Map<string, FxLoaded>();
  readonly clock: FxClock;

  private constructor(loaded: Map<string, FxLoaded>) {
    this.loaded = loaded;
    this.clock = new FxClock(new Map([...loaded].map(([id, l]) => [id, l.def])));
  }

  /** Loads every present effect; one that breaks the contract is reported and left out. */
  static async load(r: WorldRenderer): Promise<Fx> {
    const loaded = new Map<string, FxLoaded>();
    await Promise.all(FX_PRESENT.map(async (id) => {
      try {
        loaded.set(id, await loadFx(r, id));
      } catch (e) {
        console.warn(`fx: ${id} left out:`, e instanceof Error ? e.message : e);
      }
    }));
    return new Fx(loaded);
  }

  /** No effects (tests, a renderer-less game). */
  static none(): Fx {
    return new Fx(new Map());
  }

  play(id: string, o: FxSpawn = {}): FxHandle {
    return this.clock.play(id, o);
  }

  tick(): void {
    this.clock.tick();
  }

  clear(): void {
    this.clock.clear();
  }

  get size(): number {
    return this.loaded.size;
  }

  /**
   * Draws the live effects of a layer on the play plane's transform for this pass (`view`), at `a` world px per art px
   * (her ART_PX), each pivot snapped like her drawings'. `her`: her soles and facing (for attach "her"); `reflection`:
   * the lake's pass (effects with reflect false are left out). Leaves the transform at the view's.
   */
  draw(r: WorldRenderer, view: PlayView, layer: FxLayer, a: number, her: { x: number; y: number; facing: number }, reflection = false): void {
    for (const e of this.clock.live) {
      if (e.layer !== layer || e.t < 0 || (reflection && !e.def.reflect)) continue;
      const i = fxFrameAt(e.def, e.t);
      const l = this.loaded.get(e.def.id);
      const d = i === null ? undefined : l?.drawings[i];
      const sheet = d ? l!.sheets[d.sheet] : undefined;
      if (!d || !sheet || i === null) continue;
      const onHer = e.attach === "her";
      const facing = onHer ? her.facing : e.facing;
      const xf = artTransform(view, r.camX, r.camY, onHer ? her.x : e.x, onHer ? her.y : e.y, a);
      const [sx, sy, sw, sh] = d.r;
      const flip = facing < 0;
      r.setTransform(xf.z, xf.focus, view.mirror);
      const dx = flip ? xf.q[0] - (d.off[0] + sw) : xf.q[0] + d.off[0];
      r.sprite({ sheet, sx, sy, sw, sh, x: dx, y: xf.q[1] + d.off[1], flip, lit: 0, opacity: e.def.frames[i]!.opacity });
    }
    r.setTransform(view.s, view.focus, view.mirror);
  }
}
