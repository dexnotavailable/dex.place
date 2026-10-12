// Shiraito 白糸 (GDK A.3, A.4): て's long diagonal from the palace corner down to the terraces,
// a band on a background cliff. Behind it the great cliff wall strung with a hundred thin
// falls from Gate Road's lip; the path is plank walks bolted to the cliff and rock ledges,
// open to the valley in front; at its foot a ledge village of water mills over the rice
// terraces. Its top is the Prow Stair: a lantern-lit stair cut down the palace cliff under
// the Prize Court, from a mouth in the court floor near the tip, so the court and Shiraito
// join both ways by walking (the stair is walked onto from its foot going up; from the court
// it is a step down into its mouth).
//
// The way on down to Hoài Phố (the harbour) comes with that place; until then the open air
// below is a fall into mist and the talisman tugs her back. Visuals here are stand-ins for
// the place's owner (art/painters/shiraito.ts).

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { yOn } from "./common.ts";
import { STAIRWELL_X0, STAIRWELL_X1 } from "./court.ts";
import { DIAG } from "./gate-road.ts";
import { FLOOR_Y } from "./palace.ts";

/** The diagonal's top, where the Prow Stair begins, and its foot, where the village is. */
export const PATH_TOP_X = h(170);
export const FOOT_X = h(98);
export const VILLAGE_X0 = h(79.7);

export function shiraito(b: WorldBuilder): void {
  // --- the Prow Stair: from the path's top up through the palace cliff to the court's floor
  const topY = yOn(DIAG, PATH_TOP_X);
  const stair = [PATH_TOP_X, topY, STAIRWELL_X1, FLOOR_Y];
  b.walk(stair, { surface: "stone", stair: true, name: "prow-stair" });
  b.piece("play", "stairgallery", 0, 0, { pts: stair, head: 112 }, { z: 2 });
  // the mouth's balustrade posts, a lantern on each
  for (const x of [STAIRWELL_X0 - h(0.15), STAIRWELL_X1 + h(0.15)]) b.piece("play", "lanternpillar", x, FLOOR_Y, { h: h(1.1) }, { z: 3 });

  // --- the path: rock ledges at both ends, the steep middle plank walks on brackets bolted
  // back into the cliff, open air beneath (the Band grammar: carried by something you see)
  const along = (x0: number, x1: number, dy = 0): number[] => {
    const out: number[] = [x0, yOn(DIAG, x0) + dy];
    for (let i = 0; i < DIAG.length; i += 2) if (DIAG[i]! > x0 + 4 && DIAG[i]! < x1 - 4) out.push(DIAG[i]!, DIAG[i + 1]! + dy);
    out.push(x1, yOn(DIAG, x1) + dy);
    return out;
  };
  const ledge = (x0: number, x1: number, thick: number, taper0: boolean, taper1: boolean): void => {
    const top = along(x0, x1);
    const bottom: number[] = [];
    for (let x = x1; x >= x0; x -= h(1.1)) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      // thinning to a point where it meets the planks, so no ledge ends in a cut
      const k = Math.min(taper0 ? Math.min(1, u * 4) : 1, taper1 ? Math.min(1, (1 - u) * 4) : 1);
      bottom.push(x, yOn(DIAG, x) + h(0.5) + (thick - h(0.5)) * k + h(0.5) * Math.sin(x / h(4.3)) * k);
    }
    bottom.push(x0, yOn(DIAG, x0) + (taper0 ? h(0.5) : thick));
    // (drawn over the foot of the Gate Road pillar that stands on it: she walks in front of it)
    b.piece("play", "mass", 0, 0, { top, bottom, rock: "karst", cap: "moss", capH: 12, tufts: 0.7 }, { z: 1 });
  };
  ledge(FOOT_X - h(0.4), h(110), h(3.4), false, true);
  ledge(h(148), PATH_TOP_X + h(0.4), h(3.6), true, false);
  b.piece("play", "boardwalk", 0, 0, { pts: along(h(108), h(150), -1) }, { z: 2 });

  // --- the village at the foot: a ledge against the massif's face, over the terraces
  const footY = yOn(DIAG, FOOT_X);
  b.walk([VILLAGE_X0, footY, FOOT_X, footY], { surface: "earth", depth: h(2.4), name: "shiraito-village" });
  b.wall({ x: VILLAGE_X0 - h(0.1), y0: footY - h(6), y1: footY + h(0.1), reason: "cliff", from: "right" });
  b.piece("play", "mass", 0, 0, {
    top: [VILLAGE_X0 - h(1.2), footY, FOOT_X + h(0.6), footY],
    bottom: [FOOT_X + h(0.9), footY + h(1.8), FOOT_X - h(2), footY + h(3.2), h(90), footY + h(4.4), h(84), footY + h(6.4), VILLAGE_X0 - h(1.4), footY + h(9)],
    rock: "karst", cap: "earth", capH: 10, tufts: 0.5,
  }, { z: -1 });
  // the water mill: its house and the wheel turning in the race beside it
  b.piece("play", "hut", h(85.4), footY, { w: 170, h: 150 }, { z: 2 });
  b.sprite({ id: "shiraito-wheel", plane: "play", kind: "millwheel", x: h(82.9), y: footY - h(0.9), p: { r: 82 }, frames: 8, fps: 3 });
  b.piece("play", "rack", h(88.2), footY, { w: 184 }, { z: 3 });
  b.piece("play", "hut", h(93.2), footY, { w: 150, h: 130 }, { z: 2 });
  b.usable({ id: "old-inn", x0: h(92.4), y0: footY - h(1.5), x1: h(94.0), y1: footY, label: "the old inn", action: { kind: "say", text: "An old inn, its door boarded up. The planks look newer than the door." } });

  // --- behind: the great wall of falls reaches back to the massif, rice terraces into the mist
  const r3 = 0.62;
  b.piece("back", "cliffwall", h(62), h(59.6), {
    w: h(50) * r3, h: h(90) * r3, falls: 0.9,
    lip: [0, h(3) * r3, h(20) * r3, h(1.5) * r3, h(50) * r3, h(1.2) * r3],
  }, { z: 1 });
  b.piece("back", "paddies", h(80), footY + h(2.6), { w: 900, steps: 7, rise: 30 }, { z: 3 });
  b.mist({ x0: h(70), x1: h(110), y: footY + h(9), half: h(6), rate: 0.8, after: "back", density: 0.9 });

  b.spawn({ id: "shiraito", x: h(88.8), y: footY, facing: 1 });
  b.place({ id: "shiraito", name: "Shiraito", x0: VILLAGE_X0, x1: PATH_TOP_X, y0: h(63), y1: h(140), title: "place", spawn: "shiraito" });

  // --- the frame: outdoors narrow on the plank walks, grand over the terraces at the foot
  b.track({ id: "shiraito-path", x0: FOOT_X, x1: PATH_TOP_X + h(2), y0: h(63), y1: h(140), keys: [
    { x: FOOT_X, zoom: 1, anchor: 0.6, horizon: 0.34, lead: 0.06 },
    { x: PATH_TOP_X, zoom: 1, anchor: 0.62, horizon: 0.36, lead: 0.06 },
  ] });
  b.track({ id: "shiraito-foot", x0: VILLAGE_X0 - h(4), x1: FOOT_X + h(4), y0: h(110), y1: h(140), keys: [
    { x: VILLAGE_X0, zoom: 0.5, anchor: 0.62, horizon: 0.42, lead: 0 },
    { x: FOOT_X - h(2), zoom: 0.5, anchor: 0.62, horizon: 0.42, lead: 0 },
    { x: FOOT_X + h(3), zoom: 1, anchor: 0.6, horizon: 0.34, lead: 0.06 },
  ] });
}
