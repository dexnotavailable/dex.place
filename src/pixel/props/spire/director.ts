// The storm's hand on the spire's pixel matter (lane R-D): one invisible prop
// per spire room that plays the gust program (storm.ts) on the kit's props.
//
// - Tell (about 1.4 s before each gust): the pennants start to snap, harder
//   as the push nears; warning lights quicken (they read the storm directly).
// - Gust: the pennants stream and whip, the lamp posts' lanterns swing on
//   their hooks, hanging chains and cables shake.
// - Lamps: the lamp posts named for a shrine come on one after another when
//   that shrine is lit (the storm driver mirrors the save's shrine flags), or
//   at once if it already was when you arrive.
// - "still" mode (the Blade after the storm breaks): nothing is pushed; the
//   pennants hang.
// - It hands the player, the view and the rain (from the storm driver) to the
//   room's pixel world, which the runtime doesn't feed yet: puddles ring under
//   her steps, the Blade's moss parts round her, dynamic parts out of view rest.
// Nothing is drawn. Never breaks.

import { defineRecipe, type Prop } from "../../prop.ts";
import { STORM, gustNow } from "./storm.ts";

export interface DirectorParams {
  mode: "storm" | "still";
}

interface Refs {
  phase: number;
  nextPush: number;
  wasGust: boolean;
  litSeen: boolean[];
  started: boolean;
}

/** Is the prop near enough the view to be worth pushing (cloth out of view sleeps)? */
const near = (w: { view: { x: number; y: number; w: number; h: number } | null }, p: Prop<unknown>): boolean => {
  const v = w.view;
  return !v || (Math.abs(p.x - (v.x + v.w / 2)) <= v.w * 0.75 && Math.abs(p.y - (v.y + v.h / 2)) <= v.h * 0.9);
};

const isPennant = (p: Prop<unknown>): boolean => (p.recipe.id === "clothHanging" && p.params["kind"] === "pennant") || p.recipe.id === "stormPennant";

export const stormDirector = defineRecipe<DirectorParams, Refs>({
  id: "stormDirector",
  breakage: "never",
  reason: "The storm's hand: it makes the pennants snap ahead of each gust and stream through it, swings the lamps, shakes the chains, and lights the lamp posts after a shrine.",
  defaults: { mode: "storm" },
  build(b) {
    b.part("mark", { w: 1, h: 1, pivot: [0, 0], at: [0, 0], layer: "bg", hittable: false, visible: false });
    return { phase: 0, nextPush: 0, wasGust: false, litSeen: [false, false, false, false, false, false], started: false };
  },
  initial: "run",
  states: {
    run: {
      update(c, dt) {
        const r = c.refs;
        const w = c.world;
        // the player, the view and the rain, from the storm driver (the runtime doesn't feed
        // these to the pixel world yet): puddles ring under her steps, moss parts round her
        if (STORM.player.fresh) {
          const H = w.H;
          w.actors = [{ x: STORM.player.x, y: STORM.player.y, vx: STORM.player.vx, h: H }];
          w.view = { x: STORM.player.x - H * 10, y: STORM.player.y - H * 7, w: H * 20, h: H * 10 };
          w.rain = STORM.rain;
          w.reduced = STORM.reduced;
          STORM.player.fresh = false;
        }
        // lamp posts keyed to a shrine: on in sequence when it is lit (at once if it already was)
        for (let n = 1; n <= 6; n++) {
          const lit = !!STORM.lit[n - 1];
          if (lit && !r.litSeen[n - 1]) {
            const posts = w.props.filter((p) => p.recipe.id === "lampPost" && Number(p.params["shrine"] ?? 0) === n).sort((a, b) => Number(a.params["order"] ?? 0) - Number(b.params["order"] ?? 0));
            posts.forEach((p, i) => p.act("light", r.started ? 0.5 + i * 0.45 : 0));
          }
          r.litSeen[n - 1] = lit;
        }
        r.started = true;
        // cloth budget (the storm keeps cloth awake): redraw it at 20 Hz, and let cloth well out of view sleep
        const view = w.view;
        for (const p of w.props) {
          if (!p.cloths.length) continue;
          for (const part of p.parts) {
            if (!part.dynamic || part.dynamicEvery > 1) continue;
            part.dynamicEvery = 3;
            part.dynamicPhase = r.phase++ % 3;
          }
          if (view) {
            const far = Math.abs(p.x - (view.x + view.w / 2)) > view.w * 0.75 || Math.abs(p.y - (view.y + view.h / 2)) > view.h * 0.9;
            for (const cl of p.cloths) if (far) cl.sleeping = true;
          }
        }
        if (c.params["mode"] === "still" || STORM.strength <= 0) return;
        const g = gustNow(w.time);
        r.nextPush -= dt;
        const gust = g.level > 0.05;
        if (gust && !r.wasGust) {
          for (const p of w.props) {
            if (p.recipe.id === "lampPost") p.act("gust", 0.8 + c.rand() * 0.5);
            if (p.recipe.id === "cable") p.act("shake", 0.8);
            if (p.recipe.id === "hangingLantern") p.act("nudge", 1);
          }
        }
        r.wasGust = gust;
        if (r.nextPush > 0) return;
        if (g.level > 0.05) {
          r.nextPush = 0.1 + c.rand() * 0.06;
          for (const p of w.props) if (isPennant(p) && near(w, p)) p.act("gust", 0.6 + 1.1 * g.level + c.rand() * 0.3);
        } else if (g.tell > 0.05) {
          // the tell: short snaps, closer together as the gust nears
          r.nextPush = 0.34 - 0.2 * g.tell + c.rand() * 0.08;
          for (const p of w.props) if (isPennant(p) && near(w, p)) p.act("gust", 0.25 + 0.6 * g.tell);
        } else r.nextPush = 0.2;
      },
    },
  },
});
