// The Hollow's wick: an invisible room controller (a runtime-side prop, found
// by rooms/registry.ts like any recipe exported from a region module). It is
// the one thing in these rooms that reads the save, and it tells the pixel
// matter what the save says:
//
// - street lamp posts light "as if they share one wick": dark until their
//   shrine's flag is set, then on at once when you arrive with it set, or one
//   after another (0.55 s apart, in order) the moment you rest there;
// - props that should wake with a flag (params.on = { flag, signal }): a
//   state name sent once when the flag is (or becomes) set.
//
// Pixel props hear it through the runtime's signal(), which moves a pixel
// prop to the named state. Nothing is drawn; nothing can be hit or used.

import type { Box, Interaction, Prop, PropCanvas, PropHit, PropLayer, PropLight, PropParams, PropRecipe, PropWorld } from "../../props-api.ts";

interface Lamp {
  id: string;
  flag: string;
  order: number;
}

interface Wake {
  id: string;
  flag: string;
  state: string;
}

class Wick implements Prop {
  readonly recipe = "hollow-wick";
  readonly reason = "The lamps along the colossi's route come on together when a shrine is lit; this is the wick they share.";
  readonly states = ["watching"] as const;
  readonly collision = "none" as const;
  readonly layers: readonly PropLayer[] = [];
  readonly id: string;
  x: number;
  y: number;
  state = "watching";
  private lamps: Lamp[];
  private wakes: Wake[];
  private first = true;
  private had = new Map<string, boolean>();
  private queue: { at: number; id: string; state: string }[] = [];

  constructor(p: PropParams) {
    this.id = p.id;
    this.x = p.x;
    this.y = p.y;
    this.lamps = (p["lamps"] as Lamp[] | undefined) ?? [];
    this.wakes = (p["wakes"] as Wake[] | undefined) ?? [];
  }

  bounds(): Box {
    return { x: this.x, y: this.y, w: 1, h: 1 };
  }
  solids(): Box[] {
    return [];
  }
  interaction(): Interaction | null {
    return null;
  }
  hit(_h: PropHit, _w: PropWorld): boolean {
    return false;
  }
  draw(_c: PropCanvas, _l: PropLayer): void {}
  lights(_o: PropLight[]): void {}
  setState(): void {}
  dispose(): void {}

  update(w: PropWorld): void {
    const flags = new Set([...this.lamps.map((l) => l.flag), ...this.wakes.map((k) => k.flag)]);
    for (const f of flags) {
      const now = w.save.get(f);
      const before = this.had.get(f) ?? false;
      if (now && (!before || this.first)) {
        // arriving with it set: everything at once; setting it here: in order, like one wick
        const inOrder = !this.first;
        this.lamps
          .filter((l) => l.flag === f)
          .sort((a, b) => a.order - b.order)
          .forEach((l, i) => this.queue.push({ at: w.time + (inOrder ? 0.4 + i * 0.55 : 0), id: l.id, state: "on" }));
        for (const k of this.wakes.filter((q) => q.flag === f)) this.queue.push({ at: w.time + (inOrder ? 0.6 : 0), id: k.id, state: k.state });
      }
      this.had.set(f, now);
    }
    this.first = false;
    if (!this.queue.length) return;
    const due = this.queue.filter((q) => q.at <= w.time);
    this.queue = this.queue.filter((q) => q.at > w.time);
    for (const q of due) w.signal(q.id, q.state);
  }
}

export const hollowWick: PropRecipe = {
  name: "hollow-wick",
  reason: "The lamps along the colossi's route come on together when a shrine is lit; this is the wick they share.",
  build: (p) => new Wick(p),
};
