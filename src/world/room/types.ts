// Rooms as data. A room is a place the player stands in: its size, a backdrop
// built by the scene engine, collision terrain, one-way platforms, props
// (pixel matter), spawn points, exits and doors, lifts, framing zones for the
// camera, weather and time, ambient life and sound. Sizes are authored in H
// through config.h(), so the whole world follows the locked player height.
//
// Coordinates: room pixels, y down, (0, 0) the room's top-left. The camera
// rests at y = 0 in rooms one view tall.

import type { SceneDef } from "../../scenes/engine/types.ts";
import type { Surface } from "./collision.ts";
import type { FramingZone } from "./camera.ts";
import type { TerrainArt } from "./terrain.ts";
import type { WeatherProgram } from "../weather.ts";
import type { Lighting } from "../render/renderer.ts";

export interface Spawn {
  x: number;
  y: number;
  facing: 1 | -1;
}

export interface TerrainPiece {
  x: number;
  y: number;
  w: number;
  h: number;
  art: TerrainArt;
  surface: Surface;
  /** Ramp override (5 hex colours, darkest first) to sit in the backdrop's palette. */
  ramp?: string[];
  seed?: number;
  /** Solid (default) or a one-way top only. */
  oneWay?: boolean;
  /** Draw in front of the player (a low wall lip the camera looks past). */
  front?: boolean;
  /** Reflect in the room's water (mirror pass). */
  reflect?: boolean;
}

export interface Exit {
  side: "left" | "right";
  to: { room: string; spawn: string };
}

export interface PropPlacement {
  recipe: string;
  id: string;
  x: number;
  y: number;
  /** Recipe parameters (sizes in H inside the recipe). */
  params?: Record<string, unknown>;
  /** Mirror in the room's water. */
  reflect?: boolean;
}

export interface RoomAudio {
  /** Music state here: "theme" (the Suno B theme), "arena", or null (keep what plays). */
  music: "theme" | "arena" | "none" | null;
  /** Ambience bed. */
  bed: "exterior" | "interior" | "water" | null;
  /** Room-space x ranges where the music falls silent (reading spots). */
  silence?: [number, number][];
  /** 0..1 how much outdoor weather sound comes through (1 outside, ~0.35 through walls). */
  weatherThrough?: number;
}

export interface AmbientSpec {
  /** Dust motes drifting in the player plane (count per view). */
  dust?: number;
  /** Moths around light props. */
  moths?: boolean;
  /** Drips from the ceiling (interiors after rain). */
  drips?: [number, number][];
}

export interface BackdropSpec {
  scene: SceneDef;
  /** Layers to leave out (the world draws its own figure and ground). */
  hide?: string[];
  /** 0..1 vertical parallax (0 for rooms one view tall with water; 1 for interiors). */
  vertical: number;
  /** Extra weather layers (rain, mist, bolts, grade) on top of the scene's own. */
  weather: boolean;
}

export interface RoomDef {
  id: string;
  /** Debug label only; the world shows no text. */
  title: string;
  w: number;
  h: number;
  backdrop: BackdropSpec;
  /** Sprite lighting (key light, rim) for the player and props in this room. */
  lighting: Lighting;
  terrain: TerrainPiece[];
  spawns: Record<string, Spawn>;
  exits: Exit[];
  props: PropPlacement[];
  /** Door props that lead somewhere: prop id -> a room and spawn, or a panel (an ordinary door to the archive). */
  doors?: Record<string, { room: string; spawn: string } | { panel: string }>;
  zones?: FramingZone[];
  weather: WeatherProgram;
  audio: RoomAudio;
  ambient?: AmbientSpec;
  /** Screen row (camera at rest) of the water surface under the player plane: turns on the world mirror pass. */
  waterline?: number;
  /** Rooms this one connects to (streaming keeps them warm). */
  neighbours: string[];
  /** Falling below this y is a pit (default: room height + 2 H). */
  pitY?: number;
}
