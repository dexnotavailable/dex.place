// The world's save, in localStorage: shortcuts released, cords cut, the last
// rest place, the sound choice. Cuts are permanent in a save (CANON); there is
// no undo, only "forget this save" from the debug overlay.

const KEY = "dex.world.v1";

export interface SaveData {
  v: 1;
  flags: Record<string, boolean>;
  rest: { room: string; spawn: string } | null;
  sound: boolean;
}

export class Save {
  data: SaveData;
  constructor() {
    this.data = { v: 1, flags: {}, rest: null, sound: true };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<SaveData>;
        if (d && d.v === 1) this.data = { ...this.data, ...d, flags: { ...(d.flags ?? {}) } };
      }
    } catch {
      // private mode or blocked storage: the save lives for this visit only
    }
  }
  get(key: string): boolean {
    return !!this.data.flags[key];
  }
  set(key: string, v: boolean): void {
    if (this.data.flags[key] === v) return;
    this.data.flags[key] = v;
    this.write();
  }
  setRest(room: string, spawn: string): void {
    this.data.rest = { room, spawn };
    this.write();
  }
  setSound(on: boolean): void {
    this.data.sound = on;
    this.write();
  }
  clear(): void {
    this.data = { v: 1, flags: {}, rest: null, sound: this.data.sound };
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
