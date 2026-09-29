// The plain's keeper (lane R-B): an invisible stub-engine prop, placed once in
// each of region B's rooms. The runtime's stub props see the player and the
// save; pixel props don't. So the keeper:
//
// - follows the colossus: it reads the backdrop's walk feed (the scene's
//   clock and its ColossusDef, published by causeway/shared.ts WalkClock) and
//   runs the walk's TypeScript twin, so every footfall it finds is the one
//   drawn on screen. Near feet thud (a sound cue), and the one plant per pass
//   whose ring races across the water shakes the camera (1 px in the reed
//   shallows, 2 px on the causeway; through the rumble's host `shake` event,
//   which the runtime skips in reduced motion) and, when the ring reaches the
//   player plane, bows the room's reeds and grass (the rumble's wash);
// - says when the colossus is passing close (its `state`: "far" | "passing"),
//   for the sound lane's "wind alone" duck at Stonetop (api.prop(id).state);
// - lights the room's pixel-matter lamp posts from the save: on at once when
//   their shrine is already lit, one after another when it gets lit here;
// - hands the player's position to the pixel world (PLAIN.player), so reeds
//   and grass part around her (the adapter doesn't feed pixel actors yet).

import type { Box, Interaction, Prop, PropCanvas, PropHit, PropLayer, PropLight, PropParams, PropRecipe, PropWorld } from "../../props-api.ts";
import { FEEDS, PlantWatch, washDelay, type FeedColossus } from "../../../scenes/scenes/causeway/shared.ts";
import { PLAIN, plainEmit } from "../../../pixel/props/plain/bus.ts";
import { SCALE } from "../../config.ts";

interface LampGroup {
  shrine: number;
  ids: string[];
}

export interface KeeperParams {
  /** Backdrop scene title whose walk feed to follow. */
  scene?: string;
  /** Camera shake for the big footfall, px (0: none). */
  shake?: number;
  /** Lamp posts to light from the save. */
  lamps?: LampGroup[];
  /** How far (screen px from the view's centre) the colossus's body must come to count as passing. */
  passing?: number;
  /** Rooms in which the colossus's plants are heard as a far rumble only (0..1 volume). */
  footVolume?: number;
  /** Pixel props to put in a state when a save flag is already set (the culvert gate: open once lever:culvert is set). */
  opens?: { flag: string; target: string; state: string }[];
}

class Keeper implements Prop {
  readonly recipe = "plain-keeper";
  readonly reason = "Carries the colossus's walk into the room (thuds, the shake of a planted foot, the ripple that bows the reeds) and lights the lamp posts from the save.";
  readonly states = ["far", "passing"] as const;
  readonly collision = "none" as const;
  readonly layers: PropLayer[] = [];
  readonly id: string;
  x: number;
  y: number;
  state: string = "far";
  private p: KeeperParams;
  private watch: PlantWatch | null = null;
  private feedWalker: FeedColossus | null = null;
  private washes: { at: number; x: number; y: number; dir: number }[] = [];
  private lamps = new Map<string, number>();
  private first = true;
  private tick = 0;

  constructor(pp: PropParams) {
    this.id = pp.id;
    this.x = pp.x;
    this.y = pp.y;
    this.p = pp as KeeperParams;
  }

  bounds(): Box {
    return { x: this.x, y: this.y, w: 0, h: 0 };
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
  lights(_out: PropLight[]): void {}
  setState(s: string): void {
    this.state = s;
  }
  dispose(): void {
    if (PLAIN.player?.room === this.id) PLAIN.player = null;
  }

  update(w: PropWorld): void {
    this.tick++;
    const pl = w.player;
    PLAIN.player = { x: pl.x, y: pl.y, vx: pl.vx * 60, h: pl.h, room: this.id };
    this.lampsStep(w);
    this.walkStep(w);
    if (this.first) for (const o of this.p.opens ?? []) if (w.save.get(o.flag)) w.signal(o.target, o.state);
    this.first = false;
  }

  /** The camera's left edge, estimated from the player (rail cameras keep her near the centre). */
  private camX(px: number, span: number): number {
    return Math.max(0, Math.min(span, px - SCALE.viewW / 2));
  }

  private walkStep(w: PropWorld): void {
    const scene = this.p.scene;
    if (!scene) return;
    const f = FEEDS[scene];
    if (!f || performance.now() - f.at > 500) return;
    const main = f.walkers[0];
    if (!main) return;
    if (this.feedWalker !== main) {
      this.feedWalker = main;
      this.watch = new PlantWatch(main);
    }
    const watch = this.watch!;
    const d = main.depth;
    const camX = this.camX(w.player.x, f.span);
    const toScreen = (lx: number): number => lx - Math.round(camX / d) + Math.round(f.span / (2 * d));
    PLAIN.t = f.t;
    const plants = watch.step(f.t, f.reduced);
    const vol = this.p.footVolume ?? 1;
    for (const p of plants) {
      const sx = toScreen(p.x);
      const onScreen = sx > -SCALE.H * 2 && sx < SCALE.viewW + SCALE.H * 2;
      if (!onScreen) continue;
      const roomX = camX + sx;
      if (!p.far) w.sound("colossus-footfall", (p.big ? 0.9 : 0.35) * vol, [roomX, w.player.y]);
      if (p.big) {
        PLAIN.log.push({ type: "sound", id: "big-plant", x: roomX, t: f.t });
        if ((this.p.shake ?? 0) > 0) plainEmit({ type: "shake", amp: this.p.shake, dur: 0.4 });
        // the big ring reaches the player plane after it has crossed the water
        const delay = washDelay(d) / (f.reduced ? 0.5 : 1);
        this.washes.push({ at: f.t + delay, x: w.player.x, y: w.player.y, dir: Math.sign(w.player.x - roomX) || 1 });
      }
    }
    for (const wa of this.washes) {
      if (f.t < wa.at) continue;
      plainEmit({ type: "wash", x: w.player.x, y: w.player.y, dir: wa.dir, amp: 1, dur: 1.2 });
      w.sound("water-wash", 0.6 * vol, [w.player.x, w.player.y]);
      wa.at = Infinity;
    }
    this.washes = this.washes.filter((wa) => wa.at !== Infinity);
    // passing: the body near the middle of the view
    const bx = toScreen(watch.bodyX(f.t, f.reduced) + 40 * main.c.S);
    const near = Math.abs(bx - SCALE.viewW / 2) < (this.p.passing ?? SCALE.viewW * 0.45);
    this.state = near ? "passing" : "far";
  }

  private lampsStep(w: PropWorld): void {
    const groups = this.p.lamps;
    if (!groups) return;
    for (const g of groups) {
      if (!w.save.get(`shrine:${g.shrine}`)) continue;
      g.ids.forEach((id, i) => {
        if (this.lamps.has(id)) return;
        // already lit when the room was built: on at once; lit here: one after another
        this.lamps.set(id, this.first ? this.tick : this.tick + 20 + i * 21);
      });
    }
    for (const [id, at] of this.lamps) {
      if (at < 0 || this.tick < at) continue;
      w.signal(id, "on");
      this.lamps.set(id, -1);
    }
  }
}

export const plainKeeper: PropRecipe = {
  name: "plain-keeper",
  reason: "Carries the colossus's walk into region B's rooms and lights their lamp posts from the save.",
  build: (p) => new Keeper(p),
};
