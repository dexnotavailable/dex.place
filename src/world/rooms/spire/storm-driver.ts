// The spire's storm driver (lane R-D): one runtime prop per spire room that
// runs the storm's program on top of the runtime's weather.
//
// - It keeps the storm's live values (src/pixel/props/spire/storm.ts) fresh
//   every simulation tick: the gust (from the backdrop's clock, so the rain
//   angle, the pennants and the push share one clock), the lightning level,
//   the save's lit shrines (the Blade's lamp points), the storm's strength.
// - It carries the gust decks: the walkways of the outer climb are this prop's
//   one-way platforms, and while a gust blows its `mover` pushes whoever
//   stands on one along it (east, with the storm's wind) at up to 0.5 H/s.
//   The push never takes the feet past the deck's lip or into the next
//   flight's machinery (it stops short), never acts in the air, on the stairs
//   or in the sheltered alcove, so a gust can't push anyone off.
// - It names the moments for the sound lane: "storm.tell" as the warning
//   starts, "storm.gust" as the push starts.
//
// Placed as a stub-engine recipe ("spire-storm"): the runtime finds recipes
// exported next to the region's rooms (rooms/registry.ts).

import type { Box, PropHit, PropParams, PropRecipe, PropWorld } from "../../props-api.ts";
import { StubProp, type StubEngine, type TextureFactory } from "../../props/stub.ts";
import { GUST, STORM, gustNow } from "../../../pixel/props/spire/storm.ts";
import type { Deck } from "./_build.ts";

class StormDriver extends StubProp {
  readonly recipe = "spire-storm";
  readonly reason = "The spire's storm: gusts on a readable cycle that push you along the ledges (never off them), told ahead by the pennants and the rain.";
  readonly states = ["calm", "tell", "gust"] as const;
  readonly mover = { dx: 0, dy: 0 };
  private decks: Deck[];
  private strength: number;
  /** "rain": the storm's strength follows the weather's rain (the Blade: gone once the sky clears). */
  private followRain: boolean;
  /** Seconds of this room's own clock (a fallback when the storm backdrop isn't running). */
  private own = 0;
  constructor(p: PropParams, tex: TextureFactory) {
    super(p, tex, "calm");
    this.decks = (p["decks"] as Deck[]) ?? [];
    this.followRain = p["strength"] === "rain";
    this.strength = this.followRain ? 1 : Number(p["strength"] ?? 1);
    this.collision = this.decks.length ? "platform" : "none";
    this.layers = [];
  }
  bounds(): Box {
    return { x: -9999, y: -9999, w: 1, h: 1 };
  }
  solids(): Box[] {
    return this.decks.map((d) => ({ x: d.x0, y: d.y, w: d.x1 - d.x0, h: 0 }));
  }
  hit(_h: PropHit, _w: PropWorld): boolean {
    return false;
  }
  update(w: PropWorld): void {
    super.update(w);
    this.own += 1 / 60;
    if (this.followRain) this.strength = Math.min(1, w.rain / 0.4);
    STORM.frame++;
    STORM.flash = w.flash;
    STORM.strength = this.strength;
    for (let n = 1; n <= 6; n++) STORM.lit[n - 1] = w.save.get(`shrine:${n}`);
    STORM.player.x = w.player.x;
    STORM.player.y = w.player.y;
    STORM.player.vx = w.player.vx * 60;
    STORM.player.fresh = true;
    STORM.rain = w.rain;
    STORM.reduced = w.reduced;
    const g = gustNow(this.own);
    STORM.gust = g;
    const next = this.strength <= 0 ? "calm" : g.level > 0.02 ? "gust" : g.tell > 0.05 ? "tell" : "calm";
    if (next !== this.state) {
      if (next === "tell" && this.state === "calm") w.sound("storm.tell", 0.6);
      if (next === "gust") w.sound("storm.gust", 0.8);
      this.state = next;
    }
    // the push: only on a deck, only in a gust, never into a lip or the next flight's machinery
    this.mover.dx = 0;
    if (this.strength <= 0 || g.level <= 0) return;
    const pl = w.player;
    const half = this.H * 0.26;
    for (const d of this.decks) {
      if (pl.x < d.x0 || pl.x > d.x1 || Math.abs(pl.y - d.y) > 1.5) continue;
      if (d.shelter?.some(([a, b]) => pl.x >= a && pl.x <= b)) break;
      let dx = (GUST.dir * GUST.push * this.H * g.level * this.strength) / 60;
      if (Number.isFinite(d.stop)) {
        const room = GUST.dir > 0 ? d.stop - half - pl.x : pl.x - (d.stop + half);
        dx = GUST.dir * Math.min(Math.abs(dx), Math.max(0, room));
      }
      this.mover.dx = dx;
      break;
    }
  }
  draw(): void {}
}

export const spireStorm: PropRecipe = {
  name: "spire-storm",
  reason: "The spire's storm: gusts on a readable cycle that push you along the ledges (never off them), told ahead by the pennants and the rain.",
  build: (p, e) => new StormDriver(p, (e as unknown as StubEngine).texture),
};
