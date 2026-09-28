// Keyboard, mouse and touch into named actions, with per-tick press
// buffering so a button tapped a few ticks early still counts.

export const ACTIONS = ["left", "right", "up", "down", "jump", "m1", "m2", "skill", "ult"] as const;
export type Action = (typeof ACTIONS)[number];

const KEYS: Record<string, Action[]> = {
  KeyA: ["left"],
  ArrowLeft: ["left"],
  KeyD: ["right"],
  ArrowRight: ["right"],
  KeyW: ["up", "jump"],
  ArrowUp: ["up", "jump"],
  KeyS: ["down"],
  ArrowDown: ["down"],
  Space: ["jump"],
  KeyJ: ["m1"],
  KeyK: ["m2"],
  ShiftLeft: ["m2"],
  ShiftRight: ["m2"],
  KeyQ: ["skill"],
  KeyR: ["ult"],
};

export class Input {
  private held = new Map<Action, Set<string>>();
  private pressedAt = new Map<Action, number>();
  private releasedAt = new Map<Action, number>();
  /** Advanced once per simulation tick. */
  tick = 0;
  onToggle: (what: "debug" | "res") => void = () => {};

  constructor(target: HTMLElement) {
    for (const a of ACTIONS) this.held.set(a, new Set());
    window.addEventListener("keydown", (e) => {
      if (e.code === "Backquote") {
        if (!e.repeat) this.onToggle("debug");
        e.preventDefault();
        return;
      }
      if (e.code === "KeyZ") {
        if (!e.repeat) this.onToggle("res");
        e.preventDefault();
        return;
      }
      const acts = KEYS[e.code];
      if (!acts) return;
      e.preventDefault();
      if (e.repeat) return;
      for (const a of acts) this.down(a, e.code);
    });
    window.addEventListener("keyup", (e) => {
      const acts = KEYS[e.code];
      if (!acts) return;
      for (const a of acts) this.up(a, e.code);
    });
    window.addEventListener("blur", () => this.releaseAll());
    target.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      if (e.button === 0) this.down("m1", "mouse0");
      if (e.button === 2) this.down("m2", "mouse2");
      e.preventDefault();
    });
    window.addEventListener("pointerup", (e) => {
      if (e.pointerType !== "mouse") return;
      if (e.button === 0) this.up("m1", "mouse0");
      if (e.button === 2) this.up("m2", "mouse2");
    });
    target.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  down(a: Action, source: string): void {
    const set = this.held.get(a)!;
    if (set.has(source)) return;
    if (set.size === 0) this.pressedAt.set(a, this.tick);
    set.add(source);
  }

  up(a: Action, source: string): void {
    const set = this.held.get(a)!;
    if (!set.delete(source)) return;
    if (set.size === 0) this.releasedAt.set(a, this.tick);
  }

  releaseAll(): void {
    for (const [a, set] of this.held) {
      if (set.size) this.releasedAt.set(a, this.tick);
      set.clear();
    }
  }

  isDown(a: Action): boolean {
    return this.held.get(a)!.size > 0;
  }

  /** Pressed within the last `buffer` ticks and not consumed yet. */
  pressed(a: Action, buffer = 0): boolean {
    const t = this.pressedAt.get(a);
    return t !== undefined && this.tick - t <= buffer;
  }

  /** Tick of the latest unconsumed press, if any. */
  pressTick(a: Action): number | undefined {
    return this.pressedAt.get(a);
  }

  consume(a: Action): void {
    this.pressedAt.delete(a);
  }

  /** Drops the press of `a` if it happened at or before tick `t` (superseded by a later choice). */
  consumeUpTo(a: Action, t: number): void {
    const p = this.pressedAt.get(a);
    if (p !== undefined && p <= t) this.pressedAt.delete(a);
  }

  releasedSince(a: Action, ticks: number): boolean {
    const t = this.releasedAt.get(a);
    return t !== undefined && this.tick - t <= ticks;
  }

  axis(): number {
    return (this.isDown("right") ? 1 : 0) - (this.isDown("left") ? 1 : 0);
  }
}
