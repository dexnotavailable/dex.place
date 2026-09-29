// The world's save, in localStorage: shortcuts released, cords cut, levers
// thrown, shrines lit, the last rest place, the sound choice, and the
// pixel-matter props' persisted keys. Cuts are permanent in a save (CANON);
// there is no undo, only "forget this save" (?fresh).
//
// Flags use the kind:id pattern (WORLD-PLAN section 11): shrine:1 ... shrine:6,
// cut:map-banner, cut:rope-bridge, lever:culvert, lever:express,
// blade:cleared, rose:open, latch:sky-door, round:done, keeper:greeted.
// Nothing about payment or donations is ever stored or gates anything.
//
// Session flags live for this visit only (Ringwater's evening after the round).

const KEY = "dex.world.v1";

export interface SaveData {
  v: 1;
  flags: Record<string, boolean>;
  rest: { room: string; spawn: string } | null;
  sound: boolean;
  /** Pixel-matter props' persisted keys by prop id (the engine's saveData). */
  props?: Record<string, Record<string, unknown>>;
}

export class Save {
  data: SaveData;
  /** This visit only. */
  session: Record<string, boolean> = {};
  /** Called when a flag changes (story hooks). */
  onFlag: (key: string, v: boolean, session: boolean) => void = () => {};
  constructor() {
    this.data = { v: 1, flags: {}, rest: null, sound: true, props: {} };
    try {
      const raw = localStorage.getItem(KEY);
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
    this.data = { v: 1, flags: {}, rest: null, sound: this.data.sound, props: {} };
    this.session = {};
    this.write();
  }
  private write(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // ignore
    }
  }
}
