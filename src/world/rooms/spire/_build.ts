// The spire rooms' builder (lane R-D). Rooms are authored in the plan's world
// coordinates (WORLD-PLAN section 3): x in H west to east, y in H as
// elevation (the lake is 0, up is +), turned into room pixels (y down, the
// room's top-left at 0, 0) through config.h(). Same shape as the grey-box
// builder (rooms/_blockout/_build.ts), plus terrain art in the spire's ramps,
// real backdrops, the storm driver's gust decks, and pixel-matter props.

import { h, SCALE } from "../../config.ts";
import type { SceneDef } from "../../../scenes/engine/types.ts";
import type { Surface } from "../../room/collision.ts";
import type { FramingZone } from "../../room/camera.ts";
import type { TerrainArt } from "../../room/terrain.ts";
import type { Area, Exit, PropPlacement, RoomAudio, RoomCamera, RoomDef, Spawn, TerrainPiece, Trigger, WaterZone } from "../../room/types.ts";
import type { WeatherProgram } from "../../weather.ts";
import type { Lighting } from "../../render/renderer.ts";
import { lighting } from "../common.ts";
import { GUST } from "../../../pixel/props/spire/storm.ts";

/** Terrain ramps (darkest first): the spire's black iron, wet; the blade's stone at dusk. */
export const RAMP = {
  iron: ["#07090d", "#0e1219", "#161c25", "#222b37", "#3a4658"],
  ironLit: ["#080a0f", "#10151d", "#1a212c", "#29333f", "#4d5c70"],
  bladeDusk: ["#0f0b10", "#1a1318", "#281c22", "#3e2b2e", "#8a5a48"],
  tile: ["#1c2021", "#2a2f30", "#3b4243", "#525a5a", "#727b7a"],
};

/** Sprite lighting per mood. */
export const LIGHT = {
  storm: lighting({ ambient: [0.3, 0.33, 0.4], keyColour: [0.56, 0.62, 0.74], rimColour: [0.62, 0.76, 1] }),
  alcove: lighting({ ambient: [0.34, 0.3, 0.3], keyColour: [0.7, 0.58, 0.46], rimColour: [1, 0.74, 0.5] }),
  shaft: lighting({ ambient: [0.3, 0.3, 0.33], keyColour: [0.56, 0.58, 0.64], rimColour: [0.7, 0.82, 1] }),
  dusk: lighting({ ambient: [0.36, 0.3, 0.34], keyColour: [0.9, 0.62, 0.46], rimColour: [1, 0.72, 0.5] }),
} satisfies Record<string, Lighting>;

export interface SpireSpec {
  id: string;
  title: string;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  camera: RoomCamera;
  audio: RoomAudio;
  weather: WeatherProgram;
  neighbours: string[];
  lighting: Lighting;
  surface?: Surface;
  ramp?: string[];
  art?: TerrainArt;
}

/** A gust deck: a walkway the storm pushes you along (room px). */
export interface Deck {
  x0: number;
  x1: number;
  y: number;
  /** Room x of the first obstacle in the push's direction (a lip, the machinery of the next flight): the push never takes the feet past it. NaN: none. */
  stop: number;
  /** Room x ranges where the deck is sheltered (the alcove): no push there. */
  shelter?: [number, number][];
}

export class Spire {
  readonly s: SpireSpec;
  readonly W: number;
  readonly Ht: number;
  terrain: TerrainPiece[] = [];
  spawns: Record<string, Spawn> = {};
  exits: Exit[] = [];
  props: PropPlacement[] = [];
  doors: NonNullable<RoomDef["doors"]> = {};
  zones: FramingZone[] = [];
  areas: Area[] = [];
  water: WaterZone[] = [];
  triggers: Trigger[] = [];
  pits: { x0: number; x1: number; y: number }[] = [];
  decks: Deck[] = [];
  extra: Partial<RoomDef> = {};
  private seed = 1;

  constructor(s: SpireSpec) {
    this.s = s;
    this.W = h(s.x1 - s.x0);
    this.Ht = h(s.top - s.bottom);
  }

  X(wx: number): number {
    return h(wx - this.s.x0);
  }
  Y(wy: number): number {
    return h(this.s.top - wy);
  }

  piece(x0: number, x1: number, top: number, bottom: number, o: { surface?: Surface; oneWay?: boolean; stair?: boolean; front?: boolean; art?: TerrainArt; ramp?: string[] } = {}): this {
    const x = this.X(x0);
    const y = this.Y(top);
    const w = this.X(x1) - x;
    const hh = Math.max(1, this.Y(bottom) - y);
    if (w <= 0) return this;
    this.terrain.push({ x, y, w, h: hh, art: o.art ?? this.s.art ?? "stone", surface: o.surface ?? this.s.surface ?? "stone", ramp: o.ramp ?? this.s.ramp, seed: this.seed++, oneWay: o.oneWay, stair: o.stair, front: o.front });
    return this;
  }

  floor(x0: number, x1: number, wy: number, depth?: number, o: { surface?: Surface; art?: TerrainArt; ramp?: string[] } = {}): this {
    return this.piece(x0, x1, wy, depth !== undefined ? wy - depth : this.s.bottom - 1, o);
  }

  ledge(x0: number, x1: number, wy: number, o: { surface?: Surface; art?: TerrainArt; thick?: number } = {}): this {
    return this.piece(x0, x1, wy, wy - (o.thick ?? 0.15), { oneWay: true, ...o });
  }

  block(x0: number, x1: number, top: number, bottom: number, o: { surface?: Surface; art?: TerrainArt; ramp?: string[]; front?: boolean } = {}): this {
    return this.piece(x0, x1, top, bottom, o);
  }

  /** Solid stairs at the standard step (0.2 H rise, 0.3 H tread), each step solid down to elevation `bottom`. Returns the end x. */
  stairs(x0: number, y0: number, y1: number, dir: 1 | -1, bottom: number, o: { surface?: Surface; art?: TerrainArt } = {}): number {
    const n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.2 - 1e-6));
    const rise = (y1 - y0) / n;
    for (let i = 1; i <= n; i++) {
      const a = x0 + dir * 0.3 * (i - 1);
      const b = x0 + dir * 0.3 * i;
      const top = y0 + rise * i;
      this.floor(Math.min(a, b), Math.max(a, b), top, top - bottom, o);
    }
    return x0 + dir * 0.3 * n;
  }

  prop(recipe: string, id: string, wx: number, wy: number, params?: Record<string, unknown>, o: Partial<PropPlacement> = {}): this {
    this.props.push({ recipe, id, x: this.X(wx), y: this.Y(wy), params, ...o });
    return this;
  }

  /** A pixel-matter prop. */
  px(recipe: string, id: string, wx: number, wy: number, params: Record<string, unknown> = {}, o: Partial<PropPlacement> = {}): this {
    return this.prop(recipe, id, wx, wy, params, { engine: "pixel", ...o });
  }

  spawn(name: string, wx: number, wy: number, facing: 1 | -1 = 1, ride?: Spawn["ride"]): this {
    this.spawns[name] = { x: this.X(wx), y: this.Y(wy), facing, ride };
    return this;
  }

  exit(side: "left" | "right", room: string, spawn: string, wy0?: number, wy1?: number): this {
    const e: Exit = { side, to: { room, spawn } };
    if (wy0 !== undefined && wy1 !== undefined) {
      e.y0 = this.Y(Math.max(wy0, wy1));
      e.y1 = this.Y(Math.min(wy0, wy1));
    }
    this.exits.push(e);
    return this;
  }

  door(id: string, recipe: string, wx: number, wy: number, to: { room: string; spawn: string; flag?: string } | { panel: string }, params: Record<string, unknown> = {}, o: Partial<PropPlacement> = {}): this {
    this.prop(recipe, id, wx, wy, params, o);
    this.doors[id] = to;
    return this;
  }

  pit(x0: number, x1: number, wy: number): this {
    this.pits.push({ x0: this.X(x0), x1: this.X(x1), y: this.Y(wy) });
    return this;
  }

  vista(x0: number, x1: number, cx: number, cy?: number, bars = 0.06, top?: number, bottom?: number): this {
    this.zones.push({ x0: this.X(x0), x1: this.X(x1), cx: this.X(cx), cy: cy !== undefined ? this.Y(cy) : undefined, bars, hold: 2, feather: h(1), y0: top !== undefined ? this.Y(top) : undefined, y1: bottom !== undefined ? this.Y(bottom) : undefined });
    return this;
  }

  area(a: Omit<Area, "x0" | "x1" | "y0" | "y1"> & { x0: number; x1: number; top?: number; bottom?: number }): this {
    const { x0, x1, top, bottom, ...rest } = a;
    this.areas.push({ ...rest, x0: this.X(x0), x1: this.X(x1), y0: top !== undefined ? this.Y(top) : undefined, y1: bottom !== undefined ? this.Y(bottom) : undefined });
    return this;
  }

  trigger(x0: number, x1: number, t: Omit<Trigger, "x0" | "x1">): this {
    this.triggers.push({ ...t, x0: this.X(x0), x1: this.X(x1) });
    return this;
  }

  /**
   * A gust deck: a walkway the storm pushes you along. Its collision comes
   * from the storm driver (storm-driver.ts), so the push carries you; the
   * room's terrain adds the 0.3 H lips (collision only: the spireDeck recipe
   * draws them). `stopAt`: world x of the machinery at the deck's downwind
   * end (the next flight), when it has no lip there.
   */
  deck(x0: number, x1: number, wy: number, o: { lipWest?: boolean; lipEast?: boolean; stopAt?: number; shelter?: [number, number][] } = {}): this {
    const lip = 0.3;
    const lipW = 0.22;
    if (o.lipWest) this.block(x0, x0 + lipW, wy + lip, wy - 0.2, { surface: "metal", art: "none" });
    if (o.lipEast) this.block(x1 - lipW, x1, wy + lip, wy - 0.2, { surface: "metal", art: "none" });
    const dir = GUST.dir;
    let stop = NaN;
    if (o.stopAt !== undefined) stop = this.X(o.stopAt);
    else if (dir > 0 && o.lipEast) stop = this.X(x1 - lipW);
    else if (dir < 0 && o.lipWest) stop = this.X(x0 + lipW);
    this.decks.push({ x0: this.X(x0), x1: this.X(x1), y: this.Y(wy), stop, shelter: o.shelter?.map(([a, b]) => [this.X(a), this.X(b)] as [number, number]) });
    return this;
  }

  build(scene: SceneDef, o: { vertical?: number; hide?: string[]; weather?: boolean } = {}): RoomDef {
    const s = this.s;
    return {
      id: s.id,
      title: s.title,
      region: "D",
      origin: [s.x0, s.top],
      w: this.W,
      h: this.Ht,
      backdrop: { scene, vertical: o.vertical ?? (s.camera.mode === "free" || this.Ht > SCALE.viewH ? 1 : 0), weather: o.weather ?? true, hide: o.hide },
      lighting: s.lighting,
      terrain: this.terrain,
      spawns: this.spawns,
      exits: this.exits,
      props: this.props,
      doors: this.doors,
      zones: this.zones,
      camera: s.camera,
      areas: this.areas,
      water: this.water,
      triggers: this.triggers,
      pits: this.pits,
      weather: s.weather,
      audio: s.audio,
      ambient: { dust: 0 },
      neighbours: s.neighbours,
      ...this.extra,
    };
  }
}
