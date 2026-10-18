// Character drawings in Tesu through the sprite contract (lanes/anim/SPRITE-CONTRACT.md): every slot that
// has an anim.json under public/assets/zhusha/<slot>/ (her) or public/assets/cast/<who>/<slot>/ (the cast,
// src/tesu/cast/) is loaded at start, trimmed and packed into one atlas, and drawn with nearest-neighbour
// scaling at her drawn height (feel.json charScale) at every camera zoom: 128 px art, one path, no second
// set (Dex 10-18). A role whose slot is missing draws the white box (draw.ts). Data-driven: a new move is a
// new folder, no code change.

import slotsRaw from "./slots.json?raw";
import type { SpriteSheet } from "../../lab/engine/renderer.ts";
import type { WorldRenderer } from "../../world/render/renderer.ts";
import { artMarks, headOf, opaqueBox, timeline, validateAnim, type AnimDef, type ArtMarks } from "./contract.ts";
import { artTransform, type PlayView } from "./units.ts";

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
  /** Atlas page. */
  sheet: number;
  /** Rect in the atlas, and its top-left from the pivot (art px). */
  r: [number, number, number, number];
  off: [number, number];
  ticks: number;
  start: number;
  /** The head from the soles (art px, facing right), for the hat's talisman. */
  head: [number, number] | null;
}

export interface Slot {
  id: string;
  def: AnimDef;
  loop: boolean;
  total: number;
  starts: number[];
  drawings: Drawing[];
  sheets: SpriteSheet[];
  /** Ticks into the clip where each marked hit drawing starts. */
  hitTicks: number[];
  /** The drawings' marks as clip ticks (apex, active, root motion, cancel windows). */
  marks: ArtMarks;
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

/** Loads one slot from `${base}${id}/` (anim.json + its drawings), validated against the contract. */
export async function loadSlot(r: WorldRenderer, base: string, id: string): Promise<Slot> {
  const res = await fetch(`${base}${id}/anim.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${id}: anim.json HTTP ${res.status}`);
  // a slot-in --local drop shows on the dev server only
  const def = validateAnim(await res.json(), id, { allowLocal: import.meta.env.DEV });
  const [pvx, pvy] = [Math.round(def.pivot[0]), Math.round(def.pivot[1])];
  const imgs = await Promise.all(def.frames.map((f) => loadImage(`${base}${id}/${f.file}`)));
  const { starts, total } = timeline(def.frames);
  const pack = new Packer();
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
    const [x0, y0, x1, y1] = opaqueBox(data, w, h) ?? [pvx, pvy, pvx + 1, pvy + 1];
    const bw = x1 - x0, bh = y1 - y0;
    const [page, ax, ay] = pack.place(bw, bh);
    pack.pages[page]!.g.drawImage(img, x0, y0, bw, bh, ax, ay, bw, bh);
    const hd = headOf(data, w, h, pvx, def.figure_h);
    drawings.push({
      sheet: page,
      r: [ax, ay, bw, bh],
      off: [x0 - pvx, y0 - pvy],
      ticks: def.frames[i]!.ticks,
      start: starts[i]!,
      head: hd ? [hd[0] - pvx, hd[1] - pvy] : null,
    });
  });
  const marks = artMarks(def);
  return {
    id, def, loop: !!def.loop, total, starts, drawings,
    sheets: pack.pages.map((p) => ({ albedo: r.texture(p.canvas), normal: r.flatNormal, keyInfluence: 0 })),
    hitTicks: marks.hitTicks,
    marks,
  };
}

/** Loads every present slot of hers; a slot that fails its contract is reported and left as the white box. */
export async function loadAnims(r: WorldRenderer): Promise<AnimSet> {
  const slots = new Map<string, Slot>();
  const failed: string[] = [];
  await Promise.all(PRESENT.map(async (id) => {
    try {
      slots.set(id, await loadSlot(r, BASE, id));
    } catch (e) {
      failed.push(id);
      console.warn(`zhusha: slot ${id} left as the white box:`, e instanceof Error ? e.message : e);
    }
  }));
  return new AnimSet(slots, failed);
}

/**
 * Draws drawing `index` of a slot with its pivot at world (x, y), at `a` world px per art px (units.ts artPx),
 * nearest-neighbour, on the play plane's transform for this pass; leaves that transform set again.
 */
export function drawArt(
  r: WorldRenderer, view: PlayView, slot: Slot, index: number, x: number, y: number, flip: boolean, a: number,
  o: { tint?: [number, number, number, number]; opacity?: number } = {},
): void {
  const d = slot.drawings[index];
  const sheet = d ? slot.sheets[d.sheet] : undefined;
  if (!d || !sheet) return;
  const xf = artTransform(view, r.camX, r.camY, x, y, a);
  const [sx, sy, sw, sh] = d.r;
  r.setTransform(xf.z, xf.focus, view.mirror);
  const dx = flip ? xf.q[0] - (d.off[0] + sw) : xf.q[0] + d.off[0];
  r.sprite({ sheet, sx, sy, sw, sh, x: dx, y: xf.q[1] + d.off[1], flip, lit: 0, tint: o.tint, opacity: o.opacity });
  r.setTransform(view.s, view.focus, view.mirror);
}
