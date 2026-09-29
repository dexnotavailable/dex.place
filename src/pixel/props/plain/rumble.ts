// The rumble (lane R-B): the pixel-matter half of the plain's controller
// (see bus.ts). Invisible. Each step it drains the keeper's events: a
// footfall's camera shake (the host's `shake` event; 1 px in the reed
// shallows, 2 px on the causeway; the host skips it in reduced motion), the
// ripple's wash (a broad gust that bows every reed and blade in the room
// the moment the colossus's big ring reaches the player plane), and it keeps
// the pixel world's actor list on the player so reeds and grass part as she
// passes. Never breaks (nothing to hit).

import { defineRecipe } from "../../prop.ts";
import { PLAIN } from "./bus.ts";

export interface RumbleParams {
  /** A steady breeze from the west, in H/s^2 of push: at the room's west end and at its east end (the wind rises as you go east). */
  breeze: [number, number];
  /** Room width in px (for the breeze's rise). */
  roomW: number;
}

export const plainRumble = defineRecipe<RumbleParams, { seen: number; next: number }>({
  id: "plainRumble",
  breakage: "never",
  reason: "Carries the colossus's footfalls into the room: the shake of a planted foot and the ripple that bows the reeds, in step with the walk you see.",
  defaults: { breeze: [0, 0], roomW: 0 },
  cues: ["colossus.footfall", "water.wash"],
  build() {
    return { seen: 0, next: 0 };
  },
  initial: "idle",
  states: {
    idle: {
      update(c) {
        const w = c.world;
        const pl = PLAIN.player;
        if (pl) w.actors = [{ x: pl.x, y: pl.y, vx: pl.vx, h: pl.h }];
        const H = c.params.H;
        // the breeze: a broad push from the west, renewed every half second, stronger toward the east
        const [b0, b1] = c.params.breeze as [number, number];
        if ((b0 || b1) && w.time >= c.refs.next && pl) {
          c.refs.next = w.time + 0.5;
          const k = Math.max(0, Math.min(1, pl.x / Math.max(1, c.params.roomW as number)));
          const gust = 0.75 + 0.25 * Math.sin(w.time * 0.7) * Math.sin(w.time * 0.23 + 1);
          w.blow(pl.x, pl.y - H, H * 16, (b0 + (b1 - b0) * k) * H * gust, 0, 0.7);
        }
        while (PLAIN.queue.length) {
          const e = PLAIN.queue.shift()!;
          if (e.type === "shake") c.emit({ type: "shake", amplitude: e.amp ?? 1, duration: e.dur ?? 0.35 });
          else if (e.type === "wash") {
            // a broad, low gust: every blade and reed near the player bows the same way, then rights itself
            const x = e.x ?? pl?.x ?? c.x;
            const y = e.y ?? pl?.y ?? c.y;
            const k = e.amp ?? 1;
            w.blow(x, y - H * 0.5, H * 14, (e.dir ?? -1) * H * 9 * k, -H * 0.5 * k, e.dur ?? 1.1);
          } else if (e.type === "sound" && e.id) w.soundAt(e.id, e.x ?? c.x, e.y ?? c.y, e.volume ?? 1);
        }
      },
    },
  },
  demo: { w: 4, script: [{ label: "invisible controller", wait: 0.5 }] },
});
