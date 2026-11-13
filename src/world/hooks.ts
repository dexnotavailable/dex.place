// Story and sound hooks: how the story lane (I1, src/world/story/**) and the
// sound lane (S1, src/world/sound/**) plug into the runtime without editing
// it. Every module in those folders is found by a glob; a module exports a
// StoryHooks or SoundHooks object (any export name, or default), and the game
// calls it at the moments below. The runtime keeps the mechanics (flags,
// doors, rides, the music machine); the hooks decide what they mean.
//
//   story:  install, tick, enter (a room or an area), flag (a save or session
//           flag changed), rest (a shrine lit), state (a prop changed state),
//           room (adjust a room's data before it's built: the evening light
//           after the round, the keeper's chair in the dusk patch)
//   sound:  tables (cue files, beds, footsteps, AUDIO_BASE; see audio.ts
//           registerSound), install, tick (drive ducks: wind alone while the
//           colossus passes), enter
//
// Both see the same WorldApi.

import { registerSound, type SoundTables } from "./audio.ts";
import type { Prop } from "./props-api.ts";
import type { RoomDef } from "./room/types.ts";
import type { WeatherProgram } from "./weather.ts";

/** What hooks can see and do. */
export interface WorldApi {
  /** Saved flags (WORLD-PLAN section 11: shrine:N, cut:*, lever:*, latch:*, blade:cleared, rose:open, round:done, keeper:greeted). */
  flag(key: string): boolean;
  setFlag(key: string, v: boolean): void;
  /** This visit only (not saved): "evening" after the round. */
  session(key: string): boolean;
  setSession(key: string, v: boolean): void;
  /** Current room id, area id (or null), and the player. */
  room(): string;
  area(): string | null;
  player(): { x: number; y: number; grounded: boolean; facing: number };
  /** Props in the current room (stub engine) by id; pixel-matter props by id. */
  prop(id: string): Prop | undefined;
  pixelProp(id: string): { id: string; state: string; go(s: string): void; x: number; y: number } | undefined;
  signal(propId: string, msg: string): void;
  /** Replace a room's weather program for this visit. */
  weather(room: string, program: WeatherProgram | null): void;
  /** A named music duck in dB (0 removes it): "colossus" at Stonetop is "wind alone". */
  duck(name: string, db: number): void;
  panel(kind: string, arg?: string): void;
  sound(id: string, volume?: number): void;
  /** Seconds since the page started (real time, 60 Hz ticks). */
  time(): number;
  /** The camera, for a story shake or hold (1 to 2 px shakes are off in reduced motion). */
  shake(px: number, ticks: number): void;
  /**
   * Let a room that the stream keeps built go, so it is built again from its data (through the
   * story's `room` hooks) the next time it is needed: the evening reaching a room that was built
   * in the morning. The room you are in is never rebuilt under you. True if it was let go.
   */
  rebuild(room: string): boolean;
  /** Where the next visit starts (a room id and one of its spawns), as resting at a shrine does. */
  setRest(room: string, spawn: string): void;
  reduced: boolean;
}

export interface StoryHooks {
  id: string;
  install?(api: WorldApi): void;
  tick?(api: WorldApi, dt: number): void;
  /** A room (area = null) or an area inside it was entered. */
  enter?(room: string, area: string | null, api: WorldApi): void;
  flag?(key: string, value: boolean, api: WorldApi): void;
  rest?(shrine: number, api: WorldApi): void;
  state?(propId: string, from: string, to: string, api: WorldApi): void;
  /** Adjust a room's data before it is built (return a new def or nothing). */
  room?(def: RoomDef, api: WorldApi): RoomDef | void;
}

export interface SoundHooks {
  id: string;
  tables?: SoundTables;
  install?(api: WorldApi): void;
  tick?(api: WorldApi, dt: number): void;
  enter?(room: string, area: string | null, api: WorldApi): void;
}

const isHooks = (v: unknown): v is { id: string } => !!v && typeof v === "object" && typeof (v as { id?: unknown }).id === "string";

function gather<T extends { id: string }>(mods: Record<string, unknown>, ok: (v: T) => boolean): T[] {
  const out: T[] = [];
  for (const [, mod] of Object.entries(mods).sort(([a], [b]) => a.localeCompare(b))) {
    for (const v of Object.values(mod as Record<string, unknown>)) if (isHooks(v) && ok(v as T) && !out.includes(v as T)) out.push(v as T);
  }
  return out;
}

const storyMods = import.meta.glob("./story/**/*.ts", { eager: true });
const soundMods = import.meta.glob("./sound/**/*.ts", { eager: true });

export class Hooks {
  readonly story: StoryHooks[];
  readonly sound: SoundHooks[];
  constructor() {
    this.story = gather<StoryHooks>(storyMods, (v) => ["install", "tick", "enter", "flag", "rest", "state", "room"].some((k) => typeof (v as unknown as Record<string, unknown>)[k] === "function"));
    this.sound = gather<SoundHooks>(soundMods, (v) => !!v.tables || ["install", "tick", "enter"].some((k) => typeof (v as unknown as Record<string, unknown>)[k] === "function"));
    for (const s of this.sound) if (s.tables) registerSound(s.tables);
  }

  install(api: WorldApi): void {
    for (const s of this.sound) s.install?.(api);
    for (const s of this.story) s.install?.(api);
  }
  tick(api: WorldApi, dt: number): void {
    for (const s of this.sound) s.tick?.(api, dt);
    for (const s of this.story) s.tick?.(api, dt);
  }
  enter(room: string, area: string | null, api: WorldApi): void {
    for (const s of this.sound) s.enter?.(room, area, api);
    for (const s of this.story) s.enter?.(room, area, api);
  }
  flag(key: string, v: boolean, api: WorldApi): void {
    for (const s of this.story) s.flag?.(key, v, api);
  }
  rest(n: number, api: WorldApi): void {
    for (const s of this.story) s.rest?.(n, api);
  }
  state(prop: string, from: string, to: string, api: WorldApi): void {
    for (const s of this.story) s.state?.(prop, from, to, api);
  }
  room(def: RoomDef, api: WorldApi): RoomDef {
    let d = def;
    for (const s of this.story) d = s.room?.(d, api) ?? d;
    return d;
  }
  get ids(): string[] {
    return [...this.sound.map((s) => `sound:${s.id}`), ...this.story.map((s) => `story:${s.id}`)];
  }
}
