// Grey-box room builder. Rooms are authored in the plan's world coordinates
// (WORLD-PLAN section 3): x in H west to east, y in H as elevation (the lake
// surface is 0, up is +). The builder turns them into room pixels (y down,
// the room's top-left at 0, 0) through config.h(), so everything follows the
// locked player height, and it records the room's world origin for the map
// and the travel log.
//
// Grey-box means collision and mechanisms only: flat "block" terrain with a
// grid line every H and a tick every half H on its lip, the runtime's
// mechanism props (doors, levers, lifts, the ferry, shrines, lamp posts,
// the rope bridge, benches) and the proven pixel-matter services (donation
// box and plaque, map banner, boss terminal). Region lanes replace a room by
// id with their own (rooms/<region>/).

import { h, SCALE } from "../../config.ts";
import { blockoutScene, type Mood } from "../../backdrop/blockout.ts";
import type { Surface } from "../../room/collision.ts";
import type { FramingZone } from "../../room/camera.ts";
import type { Area, Exit, PropPlacement, RoomAudio, RoomCamera, RoomDef, Spawn, TerrainPiece, Trigger, WaterZone } from "../../room/types.ts";
import type { WeatherProgram } from "../../weather.ts";
import { lighting } from "../common.ts";

export interface BoxSpec {
  id: string;
  title: string;
  region: string;
  /** World extent in H: west and east x, top and bottom elevation. */
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  mood: Mood;
  camera: RoomCamera;
  audio: RoomAudio;
  weather: WeatherProgram;
  neighbours: string[];
  underground?: boolean;
  surface?: Surface;
}

const LIGHT: Record<Mood, Parameters<typeof lighting>[0]> = {
  morning: { ambient: [0.36, 0.4, 0.4], keyColour: [0.7, 0.66, 0.56], rimColour: [1, 0.88, 0.66] },
  overcast: { ambient: [0.36, 0.35, 0.4], keyColour: [0.6, 0.6, 0.66], rimColour: [0.86, 0.88, 0.97] },
  amber: { ambient: [0.34, 0.26, 0.2], keyColour: [0.72, 0.52, 0.34], rimColour: [1, 0.66, 0.36] },
  storm: { ambient: [0.26, 0.28, 0.34], keyColour: [0.5, 0.54, 0.64], rimColour: [0.7, 0.8, 1] },
  dusk: { ambient: [0.34, 0.28, 0.34], keyColour: [0.8, 0.56, 0.46], rimColour: [1, 0.7, 0.6] },
  evening: { ambient: [0.26, 0.26, 0.34], keyColour: [0.56, 0.5, 0.56], rimColour: [1, 0.78, 0.56] },
  lodge: { ambient: [0.32, 0.27, 0.24], keyColour: [0.66, 0.52, 0.38], rimColour: [1, 0.76, 0.5] },
  archive: { ambient: [0.28, 0.24, 0.2], keyColour: [0.62, 0.5, 0.36], rimColour: [0.9, 0.84, 0.5] },
  tile: { ambient: [0.32, 0.34, 0.34], keyColour: [0.6, 0.64, 0.64], rimColour: [0.8, 0.9, 0.92] },
  chapel: { ambient: [0.3, 0.26, 0.3], keyColour: [0.66, 0.52, 0.5], rimColour: [1, 0.72, 0.7] },
};

/** Grey-box terrain ramps per mood (5 steps, darkest first). */
const RAMP: Record<Mood, string[]> = {
  morning: ["#1d2426", "#2b3437", "#3c474a", "#52605f", "#74827e"],
  overcast: ["#1f1f24", "#2d2d33", "#3e3e46", "#55545d", "#76747d"],
  amber: ["#1e140d", "#2e1f14", "#402c1c", "#583e28", "#7a5838"],
  storm: ["#14171d", "#1e222b", "#2b303b", "#3d4452", "#5a6274"],
  dusk: ["#221a22", "#322632", "#453544", "#5e4a5a", "#826878"],
  evening: ["#1a1a22", "#262631", "#353545", "#4a4a5e", "#68687e"],
  lodge: ["#1f1812", "#2e241a", "#403224", "#584432", "#7a5f46"],
  archive: ["#1d1611", "#2b2118", "#3c2e21", "#52402e", "#735a40"],
  tile: ["#1c2021", "#2a2f30", "#3b4243", "#525a5a", "#727b7a"],
  chapel: ["#201a1e", "#2f262c", "#41353d", "#594852", "#7c6572"],
};

export class Box {
  readonly s: BoxSpec;
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
  extra: Partial<RoomDef> = {};
  private seed = 1;

  constructor(s: BoxSpec) {
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

  private piece(x0: number, x1: number, top: number, bottom: number, o: { surface?: Surface; oneWay?: boolean; stair?: boolean; front?: boolean; art?: "block" | "none" } = {}): void {
    const x = this.X(x0);
    const y = this.Y(top);
    const w = this.X(x1) - x;
    const hh = Math.max(1, this.Y(bottom) - y);
    if (w <= 0) return;
    this.terrain.push({ x, y, w, h: hh, art: o.art ?? "block", surface: o.surface ?? this.s.surface ?? "stone", ramp: RAMP[this.s.mood], seed: this.seed++, oneWay: o.oneWay, stair: o.stair, front: o.front });
  }

  /** Solid ground from wy down to the room's bottom (or `depth` H thick). */
  floor(x0: number, x1: number, wy: number, depth?: number, surface?: Surface): this {
    this.piece(x0, x1, wy, depth !== undefined ? wy - depth : this.s.bottom - 1, { surface });
    return this;
  }

  /** A one-way platform (jump up through it; down + jump drops). */
  ledge(x0: number, x1: number, wy: number, surface?: Surface): this {
    this.piece(x0, x1, wy, wy - 0.15, { oneWay: true, surface });
    return this;
  }

  /** A solid block (a wall, a ceiling, a pillar) between two elevations. */
  block(x0: number, x1: number, top: number, bottom: number, surface?: Surface): this {
    this.piece(x0, x1, top, bottom, { surface });
    return this;
  }

  /**
   * Solid stairs from (x0, y0) to y1 going toward +x (x1 > x0) or -x, at the
   * standard step (0.2 H rise, 0.3 H tread; rise shrinks so the count is whole).
   * Returns the x where the stair ends. Each step is solid down to the room bottom.
   */
  stairs(x0: number, y0: number, y1: number, dir: 1 | -1 = 1, surface?: Surface, base?: number): number {
    const n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.2 - 1e-6));
    const rise = (y1 - y0) / n;
    const tread = 0.3;
    for (let i = 1; i <= n; i++) {
      const a = x0 + dir * tread * (i - 1);
      const b = x0 + dir * tread * i;
      const top = y0 + rise * i;
      // each step is solid down to `base` (default: the room's bottom)
      this.floor(Math.min(a, b), Math.max(a, b), top, base !== undefined ? top - base : undefined, surface);
    }
    return x0 + dir * tread * n;
  }

  /** Stair treads you can walk under (one-way; take them with a small jump). Returns the end x. */
  treads(x0: number, y0: number, y1: number, dir: 1 | -1 = 1, surface?: Surface): number {
    const n = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 0.2 - 1e-6));
    const rise = (y1 - y0) / n;
    for (let i = 1; i <= n; i++) {
      const a = x0 + dir * 0.3 * (i - 1);
      const b = x0 + dir * 0.3 * i;
      this.piece(Math.min(a, b), Math.max(a, b), y0 + rise * i, y0 + rise * i - 0.12, { oneWay: true, stair: true, surface });
    }
    return x0 + dir * 0.3 * n;
  }

  prop(recipe: string, id: string, wx: number, wy: number, params?: Record<string, unknown>, o: Partial<PropPlacement> = {}): this {
    this.props.push({ recipe, id, x: this.X(wx), y: this.Y(wy), params, ...o });
    return this;
  }

  spawn(name: string, wx: number, wy: number, facing: 1 | -1 = 1, ride?: Spawn["ride"]): this {
    this.spawns[name] = { x: this.X(wx), y: this.Y(wy), facing, ride };
    return this;
  }

  /** An edge exit, open between two elevations (default: the whole edge). */
  exit(side: "left" | "right", room: string, spawn: string, wy0?: number, wy1?: number): this {
    const e: Exit = { side, to: { room, spawn } };
    if (wy0 !== undefined && wy1 !== undefined) {
      e.y0 = this.Y(Math.max(wy0, wy1));
      e.y1 = this.Y(Math.min(wy0, wy1));
    }
    this.exits.push(e);
    return this;
  }

  /** A door prop that leads to a room (or a panel). Params in H: w, h for big doors; latch / latchSide for shortcuts. */
  door(id: string, wx: number, wy: number, to: { room: string; spawn: string; flag?: string } | { panel: string }, params: Record<string, unknown> = {}): this {
    this.prop("door", id, wx, wy, { variant: "wood", ...params });
    this.doors[id] = to;
    return this;
  }

  /** Shallow water: wade at half speed while your feet are below the surface. */
  wade(x0: number, x1: number, surface: number): this {
    this.water.push({ x0: this.X(x0), x1: this.X(x1), y: this.Y(surface) });
    return this;
  }

  /** Water or a drop under a gap: falling below `wy` there returns you to safe ground. */
  pit(x0: number, x1: number, wy: number): this {
    this.pits.push({ x0: this.X(x0), x1: this.X(x1), y: this.Y(wy) });
    return this;
  }

  /** A vista hold: after 2 s standing still between x0 and x1 the camera eases to centre on (cx, cy). */
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

  build(): RoomDef {
    const s = this.s;
    return {
      id: s.id,
      title: s.title,
      region: s.region,
      origin: [s.x0, s.top],
      w: this.W,
      h: this.Ht,
      backdrop: { scene: blockoutScene(s.mood), vertical: s.camera.mode === "free" || this.Ht > SCALE.viewH ? 1 : 0, weather: !s.underground && !s.weather.interior },
      lighting: lighting(LIGHT[s.mood]),
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
      ambient: { dust: 10 },
      underground: s.underground,
      neighbours: s.neighbours,
      ...this.extra,
    };
  }
}

/** Standard services at a rest place: the shrine lantern, the donation box and its donor plaque (pixel matter), a bench. */
export function shrineSet(b: Box, n: number, x: number, y: number, o: { bench?: boolean; lampPosts?: never } = {}): void {
  b.prop("shrine", `shrine-${n}`, x, y, { n });
  b.prop("donationBox", `box-${n}`, x + 1.4, y, { dest: "donate" }, { engine: "pixel" });
  b.prop("donorPlaque", `plaque-${n}`, x + 2.2, y + 0.95, {}, { engine: "pixel" });
  if (o.bench !== false) b.prop("bench", `bench-${n}`, x + 3.6, y);
  b.spawn("shrine", x - 0.8, y, 1);
}

/** Lamp posts that light in sequence once shrine n is lit. */
export function lampPosts(b: Box, n: number, at: [number, number][], from = 0): void {
  at.forEach(([x, y], i) => b.prop("lamp-post", `lamp-${n}-${from + i}`, x, y, { shrine: n, order: from + i }));
}
