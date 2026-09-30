// The world's save, in localStorage: shortcuts released, cords cut, levers
// thrown, shrines lit, the last rest place, the sound choice, the
// pixel-matter props' persisted keys, and where the player last stood with
// the time of their last activity. Cuts are permanent in a save (CANON);
// there is no undo, only "forget this save" (?fresh).
//
// Flags use the kind:id pattern (WORLD-PLAN section 11): shrine:1 ... shrine:6,
// cut:map-banner, cut:rope-bridge, lever:culvert, lever:express,
// blade:cleared, rose:open, latch:sky-door, round:done, keeper:greeted.
// Nothing about payment or donations is ever stored or gates anything.
//
// Position (startPlace): a load within RESUME_MS of the last activity resumes
// at the exact saved place; later, or with no record, it starts at the world's
// spawn (the arrival dock). Only the position resets: flags, props, the rest
// place record and the sound choice stay.
//
// Session flags live for this visit only (Ringwater's evening after the round).

const KEY = "dex.world.v1";

/** A reload this soon after the last activity resumes at the exact place; later starts at the spawn. */
export const RESUME_MS = 180_000;

/** Where the player stood: a room and a grounded spot in it (the last safe ground). */
export interface Place {
  room: string;
  x: number;
  y: number;
  facing: 1 | -1;
}

export interface SaveData {
  v: 1;
  flags: Record<string, boolean>;
  rest: { room: string; spawn: string } | null;
  sound: boolean;
  /** Pixel-matter props' persisted keys by prop id (the engine's saveData). */
  props?: Record<string, Record<string, unknown>>;
  /** The exact place of the last activity (absent in saves before position resume). */
  place?: Place | null;
  /** Wall-clock ms (Date.now) of the last player activity in the world. */
  lastSeen?: number | null;
}

export type StartWhy = "place" | "rest" | "spawn";
export interface Start {
  room: string;
  spawn: string;
  /** Set when resuming: the exact spot (the spawn id is then unused). */
  at?: Place;
  why: StartWhy;
}

/** A well-formed place record (shape only; the room and spot are checked by the caller). */
export function isPlace(p: unknown): p is Place {
  const q = p as Partial<Place> | null;
  return !!q && typeof q === "object" && typeof q.room === "string" && q.room !== "" &&
    typeof q.x === "number" && Number.isFinite(q.x) && typeof q.y === "number" && Number.isFinite(q.y) &&
    (q.facing === 1 || q.facing === -1);
}

/** Is the saved activity recent enough to resume (0 <= age < RESUME_MS; a future stamp is not). */
export function isRecent(lastSeen: unknown, now: number): boolean {
  if (typeof lastSeen !== "number" || !Number.isFinite(lastSeen)) return false;
  const age = now - lastSeen;
  return age >= 0 && age < RESUME_MS;
}

/**
 * Where a load starts. Recent: the exact saved place if its room exists and
 * the spot is still standable, else the rest place, else the spawn. Stale or
 * never recorded: the spawn (opts.start: the arrival dock, or a ?room= link).
 */
export function startPlace(
  data: Pick<SaveData, "rest" | "place" | "lastSeen">,
  now: number,
  o: { start: { room: string; spawn: string }; has: (room: string) => boolean; spotOk: (p: Place) => boolean },
): Start {
  if (isRecent(data.lastSeen, now)) {
    const p = data.place;
    if (isPlace(p) && o.has(p.room) && o.spotOk(p)) return { room: p.room, spawn: "", at: { room: p.room, x: p.x, y: p.y, facing: p.facing }, why: "place" };
    const r = data.rest;
    if (r && o.has(r.room)) return { room: r.room, spawn: r.spawn, why: "rest" };
  }
  return { room: o.start.room, spawn: o.start.spawn, why: "spawn" };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export class Save {
  data: SaveData;
  /** This visit only. */
  session: Record<string, boolean> = {};
  /** Called when a flag changes (story hooks). */
  onFlag: (key: string, v: boolean, session: boolean) => void = () => {};
  constructor() {
    this.data = { v: 1, flags: {}, rest: null, sound: true, props: {}, place: null, lastSeen: null };
    try {
      const raw = storage()?.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SaveData>;
        if (d && d.v === 1) this.data = { ...this.data, ...d, flags: { ...(d.flags ?? {}) }, props: { ...(d.props ?? {}) } };
      }
    } catch {
      // private mode or blocked storage: the save lives for this visit only
    }
  }
  get(key: string): boolean {
    return !!this.data.flags[key];
  }
  set(key: string, v: boolean): void {
    if (!!this.data.flags[key] === v) return;
    this.data.flags[key] = v;
    this.write();
    this.onFlag(key, v, false);
  }
  getSession(key: string): boolean {
    return !!this.session[key];
  }
  setSession(key: string, v: boolean): void {
    if (!!this.session[key] === v) return;
    this.session[key] = v;
    this.onFlag(key, v, true);
  }
  setRest(room: string, spawn: string): void {
    this.data.rest = { room, spawn };
    this.write();
  }
  setSound(on: boolean): void {
    this.data.sound = on;
    this.write();
  }
  /**
   * Record the player's place and the time of their last activity. Only these
   * two fields are merged into what is stored, so a second open tab (the
   * homepage and /world/ share this save) never rolls back the other's flags.
   */
  setPlace(place: Place, lastSeen: number): void {
    this.data.place = { room: place.room, x: place.x, y: place.y, facing: place.facing };
    this.data.lastSeen = lastSeen;
    try {
      const s = storage();
      if (!s) return;
      const raw = s.getItem(KEY);
      let d: Partial<SaveData> | null = null;
      try {
        d = raw ? (JSON.parse(raw) as Partial<SaveData>) : null;
      } catch {
        d = null;
      }
      const out = d && typeof d === "object" && d.v === 1 ? { ...d, place: this.data.place, lastSeen } : this.data;
      s.setItem(KEY, JSON.stringify(out));
    } catch {
      // ignore
    }
  }
  /** Merge a room's pixel-matter save data; mirrors boolean keys into flags as key:id (cut:map-banner). */
  setProps(data: Record<string, Record<string, unknown>>): void {
    const props = (this.data.props ??= {});
    let changed = false;
    for (const [id, d] of Object.entries(data)) {
      const before = JSON.stringify(props[id] ?? {});
      const after = JSON.stringify(d);
      if (before === after) continue;
      props[id] = { ...d };
      changed = true;
      for (const [k, v] of Object.entries(d)) if (v === true && !this.data.flags[`${k}:${id}`]) {
        this.data.flags[`${k}:${id}`] = true;
        this.onFlag(`${k}:${id}`, true, false);
      }
    }
    if (changed) this.write();
  }
  clear(): void {
    this.data = { v: 1, flags: {}, rest: null, sound: this.data.sound, props: {}, place: null, lastSeen: null };
    this.session = {};
    this.write();
  }
  private write(): void {
    try {
      storage()?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // ignore
    }
  }
}
