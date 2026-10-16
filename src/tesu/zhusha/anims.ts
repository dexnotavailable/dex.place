// Zhusha's drawings in Tesu: every slot that has an anim.json in public/assets/zhusha/<slot>/
// (lanes/anim/SPRITE-CONTRACT.md) is loaded at start, trimmed and packed into atlases twice:
// at its traced size (192 px figure: the close band, zoom 2, one art px per frame px) and reduced
// 2x to her 96 px play size (contract.ts reducePixels: no new colours, the outline kept). A role
// whose slot is missing draws the white box (draw.ts). Data-driven: a new traced move is a new
// folder, no code change.

import slotsRaw from "./slots.json?raw";
import type { SpriteSheet } from "../../lab/engine/renderer.ts";
import type { WorldRenderer } from "../../world/render/renderer.ts";
import { H } from "../config.ts";
import { headOf, opaqueBox, reducePixels, timeline, validateAnim, type AnimDef } from "./contract.ts";

/** Slots present at build time, from public/assets/zhusha/<slot>/anim.json (a missing one is never fetched). */
export const PRESENT: string[] = Object.keys(import.meta.glob("/public/assets/zhusha/*/anim.json"))
  .map((k) => k.split("/")[4] ?? "")
  .filter(Boolean)
  .sort();

export const BASE = "/assets/zhusha/";
const ATLAS = 2048;

export interface RoleDef {
  normal: string | null;
  ult: string | null;
  hold?: boolean;
  reverse?: boolean;
}

interface SlotsFile {
  roles: Record<string, RoleDef>;
  jumpArc: { apex: number; contact: number };
}

export const SLOTS = JSON.parse(slotsRaw) as SlotsFile;

export interface Drawing {
  /** Atlas pages (native, play). */
  nSheet: number;
  pSheet: number;
  /** Rect in the native atlas, and its top-left from the pivot (frame px). */
  n: [number, number, number, number];
  nOff: [number, number];
  /** Rect in the play atlas, and its top-left from the pivot (play px = world px at play zoom). */
  p: [number, number, number, number];
  pOff: [number, number];
  ticks: number;
  start: number;
  /** Her head from the soles (world px at play scale, facing right), for the hat's talisman. */
  head: [number, number] | null;
}

export interface Slot {
  id: string;
  def: AnimDef;
  loop: boolean;
  total: number;
  starts: number[];
  drawings: Drawing[];
  native: SpriteSheet[];
  play: SpriteSheet[];
  /** Ticks into the clip where each marked hit drawing starts. */
  hitTicks: number[];
}

export class AnimSet {
  readonly slots: Map<string, Slot>;
  readonly failed: string[];

  constructor(slots: Map<string, Slot>, failed: string[] = []) {
    this.slots = slots;
    this.failed = failed;
  }

  /** The slot a role plays in this form (null: the white box). */
  forRole(role: string, ult: boolean): { slot: Slot; def: RoleDef } | null {
    const def = SLOTS.roles[role];
    if (!def) return null;
    const id = ult ? def.ult : def.normal;
    const slot = id ? this.slots.get(id) : undefined;
    return slot ? { slot, def } : null;
  }

  get size(): number {
    return this.slots.size;
  }
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

/** A shelf packer over atlases of ATLAS x ATLAS px. */
class Packer {
  pages: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D }[] = [];
  private x = 0;
  private y = 0;
  private row = 0;

  place(w: number, h: number): [number, number, number] {
    if (!this.pages.length || this.x + w > ATLAS) {
      this.x = 0;
      this.y += this.row;
      this.row = 0;
    }
    if (!this.pages.length || this.y + h > ATLAS) {
      const canvas = document.createElement("canvas");
      canvas.width = ATLAS;
      canvas.height = ATLAS;
      this.pages.push({ canvas, g: canvas.getContext("2d", { willReadFrequently: true })! });
      this.x = this.y = this.row = 0;
    }
    const at: [number, number, number] = [this.pages.length - 1, this.x, this.y];
    this.x += w + 1;
    this.row = Math.max(this.row, h + 1);
    return at;
  }
}

async function loadSlot(r: WorldRenderer, id: string): Promise<Slot> {
  const res = await fetch(`${BASE}${id}/anim.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${id}: anim.json HTTP ${res.status}`);
  const def = validateAnim(await res.json(), id);
  const k = Math.max(1, Math.round(def.figure_h / H));
  const [pvx, pvy] = [Math.round(def.pivot[0]), Math.round(def.pivot[1])];
  const imgs = await Promise.all(def.frames.map((f) => loadImage(`${BASE}${id}/${f.file}`)));
  const { starts, total } = timeline(def.frames);
  const nat = new Packer(), ply = new Packer();
  const scratch = document.createElement("canvas");
  const sg = scratch.getContext("2d", { willReadFrequently: true })!;
  const drawings: Drawing[] = [];
  imgs.forEach((img, i) => {
    const w = img.naturalWidth, h = img.naturalHeight;
    scratch.width = w;
    scratch.height = h;
    sg.clearRect(0, 0, w, h);
    sg.drawImage(img, 0, 0);
    const data = sg.getImageData(0, 0, w, h).data;
    const box = opaqueBox(data, w, h) ?? [pvx, pvy, pvx + 1, pvy + 1];
    const [x0, y0, x1, y1] = box;
    const bw = x1 - x0, bh = y1 - y0;
    // native: the trimmed drawing as traced
    const [page, ax, ay] = nat.place(bw, bh);
    nat.pages[page]!.g.drawImage(img, x0, y0, bw, bh, ax, ay, bw, bh);
    // play: reduced k x k on a grid anchored to the pivot (no shimmer between drawings)
    const ox = (((x0 - pvx) % k) + k) % k, oy = (((y0 - pvy) % k) + k) % k;
    const crop = sg.getImageData(x0, y0, bw, bh).data;
    const red = reducePixels(crop, bw, bh, k, ox, oy);
    const [ppage, px, py] = ply.place(red.w, red.h);
    ply.pages[ppage]!.g.putImageData(new ImageData(red.data, red.w, red.h), px, py);
    const hd = headOf(data, w, h, pvx, def.figure_h);
    const sc = H / def.figure_h;
    drawings.push({
      nSheet: page,
      pSheet: ppage,
      n: [ax, ay, bw, bh],
      nOff: [x0 - pvx, y0 - pvy],
      p: [px, py, red.w, red.h],
      pOff: [Math.round((x0 - ox - pvx) / k), Math.round((y0 - oy - pvy) / k)],
      ticks: def.frames[i]!.ticks,
      start: starts[i]!,
      head: hd ? [(hd[0] - pvx) * sc, (hd[1] - pvy) * sc] : null,
    });
  });
  const sheet = (c: HTMLCanvasElement): SpriteSheet => ({ albedo: r.texture(c), normal: r.flatNormal, keyInfluence: 0 });
  return {
    id, def, loop: !!def.loop, total, starts, drawings,
    native: nat.pages.map((p) => sheet(p.canvas)),
    play: ply.pages.map((p) => sheet(p.canvas)),
    hitTicks: (def.hits ?? []).map((h) => starts[h]!).sort((a, b) => a - b),
  };
}

/** Loads every present slot; a slot that fails its contract is reported and left as the white box. */
export async function loadAnims(r: WorldRenderer): Promise<AnimSet> {
  const slots = new Map<string, Slot>();
  const failed: string[] = [];
  await Promise.all(PRESENT.map(async (id) => {
    try {
      slots.set(id, await loadSlot(r, id));
    } catch (e) {
      failed.push(id);
      console.warn(`zhusha: slot ${id} left as the white box:`, e instanceof Error ? e.message : e);
    }
  }));
  return new AnimSet(slots, failed);
}
