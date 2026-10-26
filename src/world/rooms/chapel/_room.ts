// Room authoring for region E (lane R-E): rooms are written in the plan's world
// coordinates (WORLD-PLAN section 3: x in H west to east, y in H as elevation,
// the lake surface at 0) and turned into room pixels (y down, top-left 0, 0)
// through config.h(), like the grey-box builder, but with the region's own
// terrain art, ramps and backdrops. Everything stays sized in H.

import { h, SCALE } from "../../config.ts";
import type { Surface } from "../../room/collision.ts";
import type { FramingZone } from "../../room/camera.ts";
import type { TerrainArt } from "../../room/terrain.ts";
import type { Area, BackdropSpec, Exit, PropPlacement, RoomAudio, RoomCamera, RoomDef, Spawn, TerrainPiece, Trigger, WaterZone } from "../../room/types.ts";
import type { WeatherProgram } from "../../weather.ts";
import type { Lighting } from "../../render/renderer.ts";

export interface RoomSpec {
  id: string;
  title: string;
  /** World extent in H: west and east x, top and bottom elevation. */
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
}

export interface PieceOpts {
  art?: TerrainArt;
  surface?: Surface;
  ramp?: string[];
  oneWay?: boolean;
  stair?: boolean;
  front?: boolean;
}

/** A flight of stairs as the room data sees it (for backdrops that draw the path). */
export interface Flight {
  /** World x where the flight starts and the elevation of the ground before it. */
  x: number;
  y: number;
  /** Steps (each 0.3 H tread; rise 0.2 H), going east; dy -1 down, +1 up. */
  n: number;
  dir: -1 | 1;
}

export class RoomBuilder {
  readonly s: RoomSpec;
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
  private seed = 11;

  constructor(s: RoomSpec) {
    this.s = s;
    this.W = h(s.x1 - s.x0);
    this.Ht = h(s.top - s.bottom);
  }

  /** World x (H) -> room px. */
  X(wx: number): number {
    return h(wx - this.s.x0);
  }
  /** World elevation (H) -> room px (y down). */
  Y(wy: number): number {
    return h(this.s.top - wy);
  }

  /** A terrain piece between two x and two elevations (top > bottom). */
  piece(x0: number, x1: number, top: number, bottom: number, o: PieceOpts = {}): this {
    const x = this.X(x0);
    const y = this.Y(top);
    const w = this.X(x1) - x;
    const hh = Math.max(1, this.Y(bottom) - y);
    if (w <= 0) return this;
    this.terrain.push({ x, y, w, h: hh, art: o.art ?? "none", surface: o.surface ?? this.s.surface ?? "stone", ramp: o.ramp, seed: this.seed++, oneWay: o.oneWay, stair: o.stair, front: o.front });
    return this;
  }

  /** Ground from wy down (to the room's bottom, or `depth` H). */
  floor(x0: number, x1: number, wy: number, o: PieceOpts & { depth?: number } = {}): this {
    return this.piece(x0, x1, wy, o.depth !== undefined ? wy - o.depth : this.s.bottom - 1, o);
  }

  /** A one-way platform (jump up through it; down + jump drops). */
  ledge(x0: number, x1: number, wy: number, o: PieceOpts = {}): this {
    return this.piece(x0, x1, wy, wy - 0.15, { ...o, oneWay: true });
  }

  /**
   * A flight of standard steps (0.3 H tread, 0.2 H rise) going east from
   * (x, y): n steps, down (dir -1) or up (dir +1). Each step is ground down to
   * `depth` H below its top (default: the room's bottom). Returns the end.
   */
  flight(x: number, y: number, n: number, dir: -1 | 1, o: PieceOpts & { depth?: number } = {}): [number, number] {
    for (let i = 1; i <= n; i++) {
      const a = x + 0.3 * (i - 1);
      const top = y + dir * 0.2 * i;
      this.floor(a, a + 0.3, +top.toFixed(4), o);
    }
    return [+(x + 0.3 * n).toFixed(4), +(y + dir * 0.2 * n).toFixed(4)];
  }

  prop(recipe: string, id: string, wx: number, wy: number, params?: Record<string, unknown>, o: Partial<PropPlacement> = {}): this {
    this.props.push({ recipe, id, x: this.X(wx), y: this.Y(wy), params, ...o });
    return this;
  }

  /** A pixel-matter prop (src/pixel/props/**). */
  px(recipe: string, id: string, wx: number, wy: number, params?: Record<string, unknown>, o: Partial<PropPlacement> = {}): this {
    return this.prop(recipe, id, wx, wy, params, { engine: "pixel", ...o });
  }

  spawn(name: string, wx: number, wy: number, facing: 1 | -1 = 1): this {
    this.spawns[name] = { x: this.X(wx), y: this.Y(wy), facing };
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

  /** A door leading somewhere (the door prop is placed separately). */
  door(id: string, to: { room: string; spawn: string; flag?: string }): this {
    this.doors[id] = to;
    return this;
  }

  /** A vista hold: after 2 s standing still between x0 and x1 the camera eases to centre on (cx, cy). */
  vista(x0: number, x1: number, cx: number, cy?: number, bars = 0.06): this {
    this.zones.push({ x0: this.X(x0), x1: this.X(x1), cx: this.X(cx), cy: cy !== undefined ? this.Y(cy) : undefined, bars, hold: 2, feather: h(1) });
    return this;
  }

  area(a: Omit<Area, "x0" | "x1" | "y0" | "y1"> & { x0: number; x1: number; top?: number; bottom?: number }): this {
    const { x0, x1, top, bottom, ...rest } = a;
    this.areas.push({ ...rest, x0: this.X(x0), x1: this.X(x1), y0: top !== undefined ? this.Y(top) : undefined, y1: bottom !== undefined ? this.Y(bottom) : undefined });
    return this;
  }

  pit(x0: number, x1: number, wy: number): this {
    this.pits.push({ x0: this.X(x0), x1: this.X(x1), y: this.Y(wy) });
    return this;
  }

  build(backdrop: BackdropSpec, extra: Partial<RoomDef> = {}): RoomDef {
    const s = this.s;
    return {
      id: s.id,
      title: s.title,
      region: "E",
      origin: [s.x0, s.top],
      w: this.W,
      h: this.Ht,
      backdrop,
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
      ambient: { dust: 8 },
      neighbours: s.neighbours,
      ...extra,
    };
  }
}

/** Screen size in world px (for backdrops that frame themselves). */
export const VIEW = { w: SCALE.viewW, h: SCALE.viewH };
