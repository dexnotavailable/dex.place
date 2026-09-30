// A live room: its backdrop (scene engine), terrain art, props (pixel
// matter), collision, and the draw passes. Rooms are built on demand and kept
// warm while they are within STREAM.keepDepth doors of the player; the rest
// are disposed (GPU programs, textures). Only the current room simulates.

import type { PixelMatterEngine, Prop, PropCanvas, PropLayer, PropLight, PropWorld } from "../props-api.ts";
import { PixelRoom, resolveRecipe, type PixelDraw } from "../pixel/adapter.ts";
import { Backdrop } from "../backdrop/engine.ts";
import { withWeather } from "../weather.ts";
import { FRAME, SCALE } from "../config.ts";
import type { SpriteSheet } from "../../lab/engine/renderer.ts";
import type { WorldRenderer } from "../render/renderer.ts";
import { Collision, type OneWay, type Solid } from "./collision.ts";
import { terrainTexture } from "./terrain.ts";
import { plantStand, settle, type Moved } from "./ground.ts";
import type { RoomDef, TerrainPiece } from "./types.ts";

interface TerrainSprite {
  sheet: SpriteSheet | null;
  /** Flat fill colour (the deep part of a tall slab). */
  fill?: [number, number, number];
  x: number;
  y: number;
  w: number;
  h: number;
  front: boolean;
  reflect: boolean;
}

const SEG = 1024;

/** Pixel kit recipes whose persisted key mirrors a world flag given as params.flag. */
const PIXEL_FLAG_KEYS: Record<string, string> = { lever: "on", shrineLantern: "lit", door: "unlatched" };

export interface RoomDeps {
  r: WorldRenderer;
  gate: () => boolean;
  reduced: () => boolean;
  engine: PixelMatterEngine;
  /** Save flag lookup (recipes read cut state at build). */
  flag: (key: string) => boolean;
  /** The pixel-matter renderer on the world's context (room teardown frees its textures). */
  pixelDraw: () => PixelDraw | null;
  /** Saved pixel-matter prop data (persisted keys per prop id). */
  pixelSave: () => Record<string, Record<string, unknown>>;
}

export class Room {
  readonly def: RoomDef;
  backdrop: Backdrop | null = null;
  collision: Collision;
  props: Prop[] = [];
  /** The room's pixel-matter props (src/pixel), when it places any. */
  pixel: PixelRoom | null = null;
  private terrain: TerrainSprite[] = [];
  private textures: WebGLTexture[] = [];
  private staticSolids: Solid[] = [];
  private staticOneWays: OneWay[] = [];
  built = false;
  buildMs = 0;
  /** Placements the shared grounding pass put on the terrain under them (debug, the audit). */
  moved: Moved[] = [];
  /** Seconds the room has been live (props' clock). */
  time = 0;
  tick = 0;

  constructor(def: RoomDef, private deps: RoomDeps) {
    this.def = def;
    this.collision = new Collision(def.w, def.h);
  }

  get span(): number {
    return Math.max(0, this.def.w - SCALE.viewW);
  }

  build(): void {
    if (this.built) return;
    const t0 = performance.now();
    const { r, gate, engine } = this.deps;
    const d = this.def;
    const scene = d.backdrop.weather
      ? withWeather(d.backdrop.scene, (ctx) => ({ horizon: Math.round(ctx.H * 0.7), mistBand: [Math.round(ctx.H * 0.5), ctx.H + 4] }))
      : d.backdrop.scene;
    this.backdrop = new Backdrop(r.gl, scene, { id: d.id, W: SCALE.viewW, H: SCALE.viewH, span: this.span, vertical: d.backdrop.vertical, hide: d.backdrop.hide }, r.emptyVao, gate);
    // terrain: collision and art
    this.staticSolids = [];
    this.staticOneWays = [];
    for (const t of d.terrain) {
      if (t.oneWay) this.staticOneWays.push({ x: t.x, y: t.y, w: t.w, surface: t.surface, stair: t.stair });
      else this.staticSolids.push({ x: t.x, y: t.y, w: t.w, h: t.h, surface: t.surface });
      if (t.art !== "none") this.bakeTerrain(t, d.terrain);
    }
    const band = (e: RoomDef["exits"][number]): [number, number] => [e.y0 ?? -1e9, e.y1 ?? 1e9];
    this.collision.open.left = d.exits.filter((e) => e.side === "left").map(band);
    this.collision.open.right = d.exits.filter((e) => e.side === "right").map(band);
    // props: the runtime's stub recipes, or pixel matter (src/pixel) through the adapter
    this.props = [];
    const saved = this.deps.pixelSave();
    // a ground-standing placement a few px off the terrain under it is put on it (room/ground.ts)
    const settled = settle({ terrain: d.terrain, props: d.props, w: d.w, waterline: d.waterline, water: d.water });
    this.moved = settled.moved;
    const stand = plantStand(d);
    for (const pl of settled.props) {
      const how = resolveRecipe(pl.recipe, pl.engine, (n) => engine.has(n));
      if (!how) throw new Error(`room ${d.id}: no prop recipe "${pl.recipe}" (stub or pixel matter)`);
      if (how.engine === "pixel") {
        if (!this.pixel) {
          // the room's terrain is the pixel world's ground too (cut cords and debris come to rest on it)
          const ground = (x: number, y: number): boolean =>
            this.staticSolids.some((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) || this.staticOneWays.some((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + 2);
          this.pixel = new PixelRoom(d.w, d.h, SCALE.H, saved, ground, { gate, reduced: this.deps.reduced }, stand);
        }
        if (this.deps.flag(`cut:${pl.id}`) && !saved[pl.id]) this.pixel.world.saveData[pl.id] = { cut: true };
        // a world flag named in the placement (lever:culvert, shrine:1, latch:sky-door) sets the kit prop's own persisted key
        const flag = pl.params?.["flag"] as string | undefined;
        const key = PIXEL_FLAG_KEYS[how.recipe.id];
        if (flag && key && this.deps.flag(flag)) this.pixel.world.saveData[pl.id] = { ...(this.pixel.world.saveData[pl.id] ?? {}), [key]: true };
        this.pixel.add(how.recipe, pl.id, pl.x, pl.y, { seed: hashId(pl.id) % 997, ...(pl.params ?? {}) }, !!pl.flip);
        continue;
      }
      this.props.push(
        engine.create(pl.recipe, {
          id: pl.id,
          x: pl.x,
          y: pl.y,
          H: SCALE.H,
          seed: hashId(pl.id),
          cut: this.deps.flag(`cut:${pl.id}`),
          ...(pl.params ?? {}),
        }),
      );
    }
    this.syncCollision();
    this.built = true;
    this.buildMs = Math.round(performance.now() - t0);
  }

  private bakeTerrain(t: TerrainPiece, all: TerrainPiece[]): void {
    const r = this.deps.r;
    // an end is exposed (a lit or shaded side) only where no other drawn ground carries on at
    // about the same height: two slabs meeting (rock into flags) read as one floor, no seam
    const joins = (x: number): boolean => all.some((o) => o !== t && o.art !== "none" && !o.oneWay && Math.abs(o.y - t.y) <= 3 && o.x <= x + 1 && o.x + o.w >= x - 1 && (o.x + o.w <= t.x + 1 || o.x >= t.x + t.w - 1));
    const openL = !joins(t.x);
    const openR = !joins(t.x + t.w);
    const art = t.art as Exclude<TerrainPiece["art"], "none">;
    // tall slabs only need their visible depth; below that the ground is dark
    const h = Math.min(t.h, SCALE.H * 3);
    // rock and earth rise above their collision line in an irregular rim (decoration only)
    const rim = art === "rock" ? Math.round(SCALE.H * 0.16) : art === "earth" ? Math.round(SCALE.H * 0.05) : 0;
    for (let x = 0; x < t.w; x += SEG) {
      const w = Math.min(SEG, t.w - x);
      const seed = art === "block" ? (((t.x + x) % 65536) << 16) | ((t.seed ?? 1) & 0xffff) : (t.seed ?? 1) * 97 + x;
      const tex = terrainTexture(w, h + rim, art, seed, SCALE.H, t.ramp, { left: x === 0 && openL, right: x + w >= t.w && openR }, rim);
      const albedo = r.texture({ w: tex.w, h: tex.h, data: tex.albedo });
      const normal = r.texture({ w: tex.w, h: tex.h, data: tex.normal });
      this.textures.push(albedo.tex, normal.tex);
      this.terrain.push({ sheet: { albedo, normal, keyInfluence: 0.55 }, x: t.x + x, y: t.y - rim, w, h: h + rim, front: !!t.front, reflect: !!t.reflect });
      if (t.h > h) {
        // the rest of a deep slab: a flat fill in the ramp's darkest colour
        const c = hexRgb((t.ramp ?? ["#08080a"])[0]!);
        this.terrain.push({ sheet: null, fill: [c[0] / 255, c[1] / 255, c[2] / 255], x: t.x + x, y: t.y + h, w, h: t.h - h, front: !!t.front, reflect: false });
      }
    }
  }

  /** Rebuilds the dynamic part of collision from the props (lifts move, crates break, doors open). */
  syncCollision(): void {
    const solids: Solid[] = [...this.staticSolids];
    const ones: OneWay[] = [...this.staticOneWays];
    for (const p of this.props) {
      if (p.collision === "none" || p.collision === "trigger") continue;
      const mover = (p as unknown as { mover?: { dx: number; dy: number } }).mover;
      for (const b of p.solids()) {
        if (p.collision === "platform" || b.h <= 0) ones.push({ x: b.x, y: b.y, w: b.w, surface: "wood", mover, id: p.id });
        else solids.push({ x: b.x, y: b.y, w: b.w, h: b.h, surface: "stone", mover, id: p.id });
      }
    }
    if (this.pixel) {
      for (const b of this.pixel.colliders()) {
        if (b.platform) ones.push({ x: b.x, y: b.y, w: b.w, surface: "wood", id: b.id });
        else solids.push({ x: b.x, y: b.y, w: b.w, h: b.h, surface: "stone", id: b.id });
      }
    }
    this.collision.solids = solids;
    this.collision.oneWays = ones;
  }

  update(w: PropWorld): void {
    this.tick++;
    this.time += 1 / 60;
    for (const p of this.props) p.update(w);
    this.syncCollision();
  }

  lights(out: PropLight[], view?: { x: number; y: number; w: number; h: number }): void {
    for (const p of this.props) p.lights(out);
    if (this.pixel && view) for (const l of this.pixel.lights(view)) out.push({ ...l });
  }

  /** Terrain sprites: back (behind the player) or front. */
  drawTerrain(r: WorldRenderer, front: boolean, reflectOnly = false): void {
    for (const t of this.terrain) {
      if (t.front !== front || (reflectOnly && !t.reflect)) continue;
      if (t.x > r.camX + r.iw + 8 || t.x + t.w < r.camX - 8) continue;
      if (!t.sheet) r.rect(t.x, t.y, t.w, t.h, t.fill ?? [0, 0, 0], 1, 1);
      else r.sprite({ sheet: t.sheet, sx: 0, sy: 0, sw: t.w, sh: t.h, x: t.x, y: t.y, lit: 1 });
    }
  }

  drawProps(c: PropCanvas, layer: PropLayer, camX: number, filter?: (p: Prop) => boolean): void {
    for (const p of this.props) {
      if (!p.layers.includes(layer)) continue;
      if (filter && !filter(p)) continue;
      const b = p.bounds();
      if (b.x > camX + FRAME.w + 64 || b.x + b.w < camX - 64) continue;
      p.draw(c, layer);
    }
  }

  prop(id: string): Prop | undefined {
    return this.props.find((p) => p.id === id);
  }

  dispose(): void {
    const gl = this.deps.r.gl;
    this.backdrop?.dispose();
    this.backdrop = null;
    for (const t of this.textures) gl.deleteTexture(t);
    this.textures = [];
    this.terrain = [];
    for (const p of this.props) p.dispose();
    this.props = [];
    if (this.pixel) this.deps.pixelDraw()?.release(this.pixel.world);
    this.pixel = null;
    this.built = false;
  }
}

function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}

function hexRgb(h: string): [number, number, number, number] {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
}

/** Keeps the current room and its neighbours built; disposes the rest. */
export class RoomStream {
  rooms = new Map<string, Room>();
  /** `resolve` gives a room's data at build time (story hooks may adjust it: the evening after the round). */
  constructor(private defs: Map<string, RoomDef>, private deps: RoomDeps, private keepDepth: number, private resolve: (d: RoomDef) => RoomDef = (d) => d) {}

  get(id: string): Room {
    let r = this.rooms.get(id);
    if (!r || !r.built) {
      const def = this.defs.get(id);
      if (!def) throw new Error(`no room "${id}"`);
      // a room that was disposed is made again from fresh data
      if (!r || r.def !== this.resolve(def)) {
        r = new Room(this.resolve(def), this.deps);
        this.rooms.set(id, r);
      }
    }
    return r;
  }

  /** Rooms within keepDepth doors of `id`. */
  private near(id: string): Set<string> {
    const out = new Set<string>([id]);
    let frontier = [id];
    for (let d = 0; d < this.keepDepth; d++) {
      const next: string[] = [];
      for (const f of frontier) for (const n of this.defs.get(f)?.neighbours ?? []) if (!out.has(n)) {
        out.add(n);
        next.push(n);
      }
      frontier = next;
    }
    return out;
  }

  /** Called when the current room changes: dispose far rooms. */
  settle(current: string): void {
    const keep = this.near(current);
    for (const [id, r] of this.rooms) if (!keep.has(id) && r.built) r.dispose();
  }

  /** Builds one warm neighbour (call during idle frames); returns true if it built something. */
  warmOne(current: string): boolean {
    for (const id of this.near(current)) {
      const r = this.get(id);
      if (!r.built) {
        r.build();
        return true;
      }
    }
    return false;
  }

  status(): string {
    return [...this.rooms.values()].map((r) => `${r.def.id}${r.built ? "*" : ""}`).join(" ");
  }
}
