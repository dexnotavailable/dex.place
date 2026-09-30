// Rooms as data. A room is a place the player stands in: its size, a backdrop
// built by the scene engine, collision terrain, one-way platforms, props
// (pixel matter), spawn points, exits and doors, lifts, framing zones for the
// camera, weather and time, ambient life and sound. Sizes are authored in H
// through config.h(), so the whole world follows the locked player height.
//
// Coordinates: room pixels, y down, (0, 0) the room's top-left. The camera
// rests at y = 0 in rooms one view tall.
//
// Region lanes add rooms as files under src/world/rooms/<region>/ (found by a
// glob in rooms/registry.ts, no shared edit). A room whose id matches a
// grey-box room (A0 ... E4, rooms/_blockout/) replaces it.

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
  /** Arriving here puts a carrier (lift, hook, boat) at one of its stops, and optionally sends it on. */
  ride?: { prop: string; stop: number; go?: number };
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
  /** One-way stair tread you can walk under (see collision.ts OneWay.stair). */
  stair?: boolean;
  /** Draw in front of the player (a low wall lip the camera looks past). */
  front?: boolean;
  /** Reflect in the room's water (mirror pass). */
  reflect?: boolean;
}

export interface Exit {
  side: "left" | "right";
  to: { room: string; spawn: string };
  /** Room-y band where this edge is open (default: the whole edge). Lets one edge hold several exits. */
  y0?: number;
  y1?: number;
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
  /** Which engine builds it: the pixel-matter engine (src/pixel) or the runtime's stub recipes. Default: pixel if it knows the recipe id exactly, else stub. */
  engine?: "pixel" | "stub";
  /** Pixel-matter props: face left. */
  flip?: boolean;
}

/** Music level states (docs/world/WORLD-PLAN.md section 9). */
export type MusicId = "theme" | "arena" | "none";

export interface RoomAudio {
  /** Music state here: "theme" (the Suno B theme), "arena", "none" (fade out), or null (keep what plays). */
  music: MusicId | null;
  /** Ambience bed id ("lake", "lodge", "market" ... from the sound lane's table; unknown ids fall back to exterior / interior). */
  bed: string | null;
  /** Room-space x ranges where the music falls silent (reading spots). */
  silence?: [number, number][];
  /** 0..1 how much outdoor weather sound comes through (1 outside, ~0.35 through walls). */
  weatherThrough?: number;
  /** Music level 0..1 before ducks (default 0.72; arena 0.8). */
  level?: number;
  /** Muffled: the same playhead low-passed at -8 to -10 dB (1 = fully muffled). A ramp along room y gives "opening up" (the lift ride). */
  muffle?: number | { y0: number; y1: number; from: number; to: number };
  /** Silence: the music fades out over 4 s; the playhead keeps running. */
  silent?: boolean;
  /** Duck the music by this many dB (the shelter: 4). */
  duck?: number;
  /**
   * How the theme enters when it isn't current: at `at` seconds into the cue,
   * after `delay` s of quiet, under a `rise` s swell. Ambience first (the dock):
   * `wait` seconds after the Enter action and, with `move`, not before you first move.
   * Grand passage (the Blade): at 48, rise 5, delay 2.
   */
  enter?: { at: number; rise: number; delay?: number; wait?: number; move?: boolean };
  /** From the top: the theme restarts from its beginning here (the chapel only). */
  fromTop?: boolean;
  /** Footstep surface when the ground doesn't say (default: from terrain). */
  surface?: Surface;
  /**
   * The storm's sound cuts off on entering (an area): rain, wind and thunder stop within a
   * quarter second, the bed with them, then `silence` seconds of nothing before this place's bed
   * comes in; the weather heard here is the place's own, not the one still easing in. `unless`: a
   * flag that, already set when you arrive, means it has happened before (the Blade's break).
   */
  cut?: { silence: number; unless?: string };
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

export type CameraMode = "locked" | "rail" | "free";

/** How the camera behaves in a room or area (WORLD-PLAN section 1, "Camera modes"). */
export interface RoomCamera {
  mode: CameraMode;
  /** Feet at this share of the view height: vast 0.72-0.8, ordinary 0.64, downward 0.35-0.5. */
  anchor?: number;
  /** locked: the view's top-left in room px (default: centred on the room or area). */
  at?: [number, number];
  /** rail: the view's top row in room px (default: from the anchor where you enter). */
  railY?: number;
  /** rail: vertical freedom in H before the rail row moves (0 = fixed row). */
  slack?: number;
  /** free: look ahead this many H in the direction of travel vertically (+ down). */
  lookY?: number;
  /**
   * View zoom (config.ts ZOOM): 1 shows the whole frame; "fit" zooms in until the room (or area)
   * fills the frame, at least ZOOM.interior. Default: "fit" in interiors, 1 outside.
   */
  zoom?: number | "fit";
  /**
   * Arena clamp while the arena is active (the terminal summoning): the view stays inside x0..x1.
   * `focus` (room px): while it summons and holds its seal the view centres here (the Crown: the
   * seal ring, so the seals are seen lighting one after another), instead of the close-up on her.
   */
  arena?: { x0: number; x1: number; focus?: number };
}

/** A part of a room with its own camera, sound or feel (the shelter inside the causeway, the storm alcove). */
export interface Area {
  id: string;
  x0: number;
  x1: number;
  y0?: number;
  y1?: number;
  camera?: RoomCamera;
  audio?: Partial<RoomAudio>;
  /** Roofed: rain doesn't fall here (and the weather is heard muffled). */
  roofed?: boolean;
  /** Label for the travel log and the map (debug only; the world shows no text). */
  title?: string;
}

/** Shallow water: wading at `slow` of the run speed (default 0.5), splashy footsteps. */
export interface WaterZone {
  x0: number;
  x1: number;
  /** Room y of the water surface; you wade while your feet are below it. */
  y: number;
  slow?: number;
}

/** A trigger box: sets a save flag, a session flag, or signals a prop when the player enters. */
export interface Trigger {
  x0: number;
  x1: number;
  y0?: number;
  y1?: number;
  flag?: string;
  session?: string;
  signal?: { target: string; msg: string };
}

export interface RoomDef {
  id: string;
  /** Debug label only; the world shows no text. */
  title: string;
  /** Region letter (A Ringwater, B Shore and Plain, C Hollow, D Spire, E Chapel) or "test". */
  region?: string;
  /** World position of the room's top-left, in H: x west to east, y elevation (lake surface 0, up is +). */
  origin?: [number, number];
  w: number;
  h: number;
  backdrop: BackdropSpec;
  /** Sprite lighting (key light, rim) for the player and props in this room. */
  lighting: Lighting;
  terrain: TerrainPiece[];
  spawns: Record<string, Spawn>;
  exits: Exit[];
  props: PropPlacement[];
  /** Door props that lead somewhere: prop id -> a room and spawn (optionally setting a save flag the first time), or a panel (an ordinary door to the archive). */
  doors?: Record<string, { room: string; spawn: string; flag?: string } | { panel: string; arg?: string }>;
  zones?: FramingZone[];
  camera?: RoomCamera;
  areas?: Area[];
  water?: WaterZone[];
  triggers?: Trigger[];
  weather: WeatherProgram;
  audio: RoomAudio;
  ambient?: AmbientSpec;
  /** Underground: no sky, no rain; thunder only as a far rumble in the sound bed. */
  underground?: boolean;
  /** The test world's beat: after ~40 s indoors during a storm the named room clears for the visit. Final rooms keep their weather (off by default). */
  stormPasses?: string;
  /** Screen row (camera at rest) of the water surface under the player plane: turns on the world mirror pass. */
  waterline?: number;
  /** Rooms this one connects to (streaming keeps them warm). */
  neighbours: string[];
  /** Falling below this y is a pit (default: room height + 2 H). */
  pitY?: number;
  /** Pits inside the room: falling below y between x0 and x1 (water under a gap) returns you to the last safe ground. */
  pits?: { x0: number; x1: number; y: number }[];
  /** A weather program that replaces the room's once a flag is set (the Blade stays clear after blade:cleared). */
  weatherIf?: { flag: string; program: WeatherProgram };
  /** Sound that replaces parts of the room's once a flag is set (the cleared Blade: the dusk bed, the theme carrying on). */
  audioIf?: { flag: string; audio: Partial<RoomAudio> };
}
