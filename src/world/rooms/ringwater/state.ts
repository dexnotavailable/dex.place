// Ringwater's room state and seats (lane R-A): two small runtime props with
// no looks of their own, exported here so the rooms can place them by name
// (rooms/registry.ts registers stub recipes found next to region rooms).
//
// ringwater-state: one per room. It reads the save each tick and tells the
// room's pixel-matter props what the save means: the lamp posts toward the
// next shrine come on one after another when their shrine is lit (and are
// simply on when you arrive later), the lamp board mirrors the lit shrines,
// the ferryman wakes once the culvert is open, the sky door loses its rail
// once the balcony latch is released, the keeper is at her counter, away, or
// at Pier's End with two cups in the evening after the round. It mirrors the
// keeper's own persisted `greeted` into the plan's flag keeper:greeted, and
// sets the session flag `evening` when the round has just been completed
// (see _lib.ts). Pure data flow: it never invents state.
//
// ring-seat: E sits you down (the runtime's sit: the camera holds on the
// room's vista near the seat, the UI hides, the music dips; any move stands
// you up). The bench you see is pixel matter placed at the same spot.

import type { Box, Interaction, PixelMatterEngine, Prop, PropCanvas, PropHit, PropLayer, PropLight, PropParams, PropRecipe, PropWorld } from "../../props-api.ts";
import { evening, ringwater } from "./_lib.ts";

interface LampSpec {
  id: string;
  shrine: number;
  order: number;
}

const WATCH = ["round:done", "shrine:1", "shrine:2", "shrine:3", "shrine:4", "shrine:5", "shrine:6", "lever:culvert", "latch:sky-door", "keeper:greeted"];

abstract class Quiet implements Prop {
  readonly layers: readonly PropLayer[] = [];
  readonly collision = "none" as const;
  state = "idle";
  abstract readonly recipe: string;
  abstract readonly reason: string;
  abstract readonly states: readonly string[];
  constructor(
    readonly id: string,
    public x: number,
    public y: number,
    protected H: number,
  ) {}
  bounds(): Box {
    return { x: this.x - this.H * 0.4, y: this.y - this.H * 0.6, w: this.H * 0.8, h: this.H * 0.6 };
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
  update(_w: PropWorld): void {}
  draw(_c: PropCanvas, _l: PropLayer): void {}
  lights(_out: PropLight[]): void {}
  setState(s: string): void {
    this.state = s;
  }
  dispose(): void {}
}

class RoomState extends Quiet {
  readonly recipe = "ringwater-state";
  readonly reason = "Ringwater's props learn what the save means from here: lit shrines light the lamps and the lamp board, the open culvert wakes the ferryman, the released latch frees the sky door, and the round's end sends the keeper to Pier's End.";
  readonly states = ["idle"] as const;
  private readonly lamps: LampSpec[];
  private readonly board: string | null;
  private readonly ferry: string | null;
  private readonly keeper: { id: string; pose: "lodge" | "pier" } | null;
  private readonly sky: string | null;
  private readonly open: string[];
  private first = true;
  private seen = new Map<string, boolean>();
  private queue: { at: number; id: string; msg: string }[] = [];
  private t = 0;

  constructor(p: PropParams) {
    super(p.id, p.x, p.y, p.H);
    this.lamps = (p["lamps"] as LampSpec[] | undefined) ?? [];
    this.board = (p["board"] as string | undefined) ?? null;
    this.ferry = (p["ferry"] as string | undefined) ?? null;
    this.keeper = (p["keeper"] as { id: string; pose: "lodge" | "pier" } | undefined) ?? null;
    this.sky = (p["skyDoor"] as string | undefined) ?? null;
    this.open = (p["openAtEvening"] as string[] | undefined) ?? [];
  }

  update(w: PropWorld): void {
    this.t += 1 / 60;
    for (const k of WATCH) ringwater.flags[k] = w.save.get(k);
    ringwater.forced = w.session.get("evening");
    const eve = evening();
    if (eve && !w.session.get("evening")) w.session.set("evening", true);
    // the keeper's own persisted "greeted" is the plan's keeper:greeted
    if (this.keeper && w.save.get(`greeted:${this.keeper.id}`) && !w.save.get("keeper:greeted")) w.save.set("keeper:greeted", true);
    const changed = (k: string): boolean => {
      const v = w.save.get(k);
      const was = this.seen.get(k);
      this.seen.set(k, v);
      return v && was !== true;
    };
    // lamp posts: on when you arrive if their shrine is already lit; in a line when it is lit now
    const lit = new Set<number>();
    for (let n = 1; n <= 6; n++) if (changed(`shrine:${n}`)) lit.add(n);
    for (const l of this.lamps) {
      if (!lit.has(l.shrine)) continue;
      if (this.first) w.signal(l.id, "on");
      else this.queue.push({ at: this.t + 0.5 + l.order * 0.45, id: l.id, msg: "lighting" });
    }
    if (this.board) for (const n of lit) w.signal(this.board, `on${n}`);
    if (this.ferry && changed("lever:culvert")) w.signal(this.ferry, "awake");
    if (this.sky && changed("latch:sky-door")) w.signal(this.sky, "free");
    if (this.keeper && (this.first || changed("round:done"))) {
      if (this.keeper.pose === "lodge") {
        if (eve) w.signal(this.keeper.id, "away");
      } else w.signal(this.keeper.id, eve ? "sitting" : "absent");
    }
    if (eve && (this.first || this.seen.get("evening") !== true)) for (const id of this.open) w.signal(id, "ajar");
    this.seen.set("evening", eve);
    for (const q of this.queue) if (q.at <= this.t) w.signal(q.id, q.msg);
    this.queue = this.queue.filter((q) => q.at > this.t);
    this.first = false;
  }
}

class Seat extends Quiet {
  readonly recipe = "ring-seat";
  readonly reason = "Somewhere to sit and look: E sits you down, the camera holds on the view, and any move stands you up.";
  readonly states = ["idle"] as const;
  interaction(): Interaction | null {
    return {
      radius: this.H * 0.8,
      label: "",
      use: (w) => w.openPanel("sit", this.id),
    };
  }
}

/** Stub-engine recipes the rooms place by name. */
export const ringwaterStateRecipe: PropRecipe = { name: "ringwater-state", reason: "Tells Ringwater's props what the save means.", build: (p) => new RoomState(p) };
export const ringSeatRecipe: PropRecipe = { name: "ring-seat", reason: "E sits you down on the bench here.", build: (p) => new Seat(p.id, p.x, p.y, p.H) };

export type { PixelMatterEngine };
