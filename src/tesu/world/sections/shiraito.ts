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
// below is a fall into mist and the talisman tugs her back. Visuals here are neutral stand-ins
// (flat value masses, simple silhouettes) for the place's owner (art/painters/shiraito.ts).

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { yOn } from "./common.ts";
import { STAIRWELL_X0, STAIRWELL_X1 } from "./court.ts";
import { DIAG } from "./gate-road.ts";
import { FLOOR_Y } from "./palace.ts";
import { HARBOUR_X0, HARBOUR_Y } from "./hoaipho.ts";

/** The diagonal's top, where the Prow Stair begins, and its foot, where the village is. */
export const PATH_TOP_X = h(170);
export const FOOT_X = h(98);
export const VILLAGE_X0 = h(82.4);

export function shiraito(b: WorldBuilder): void {
  // --- the Prow Stair: from the path's top up through the palace cliff to the court's floor
  const topY = yOn(DIAG, PATH_TOP_X);
  const stair = [PATH_TOP_X, topY, STAIRWELL_X1, FLOOR_Y];
  b.walk(stair, { surface: "stone", stair: true, name: "prow-stair" });
  // where F at the stair's mouth sets her down: a few steps in, facing down the stair
  const inX = STAIRWELL_X0 - h(1.2);
  b.spawn({ id: "prow-stair-in", x: inX, y: topY + ((FLOOR_Y - topY) * (inX - PATH_TOP_X)) / (STAIRWELL_X1 - PATH_TOP_X), facing: -1 });
  // (the stand-in recess stops at 176 H: from there env-hall's court masonry carries it)
  const galleryEnd = h(176);
  b.piece("play", "stairgallery", 0, 0, { pts: [PATH_TOP_X, topY, galleryEnd, topY + ((FLOOR_Y - topY) * (galleryEnd - PATH_TOP_X)) / (STAIRWELL_X1 - PATH_TOP_X)], head: 112 }, { z: 2 });
  // (the mouth's newel posts and their lanterns are env-hall's court dressing)

  // --- the path: rock ledges at both ends, the steep middle plank walks on brackets bolted
  // back into the cliff, open air beneath (the Band grammar: carried by something you see)
  const along = (x0: number, x1: number, dy = 0): number[] => {
    const out: number[] = [x0, yOn(DIAG, x0) + dy];
    for (let i = 0; i < DIAG.length; i += 2) if (DIAG[i]! > x0 + 4 && DIAG[i]! < x1 - 4) out.push(DIAG[i]!, DIAG[i + 1]! + dy);
    out.push(x1, yOn(DIAG, x1) + dy);
    return out;
  };
  const ledge = (x0: number, x1: number, thick: number, taper0: boolean, taper1: boolean, opening = false): void => {
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
    if (opening) {
      // the upper ledge shows in the opening's gates and widest frames under the palace: it is
      // the opening's rock there, sinking into the valley mist as the rest of the opening does.
      // At play zoom (her own frames on the path) the same rock, same seed, goes on under the
      // mist, so the ledge she walks on is always drawn.
      const rock = { top, bottom, cap: "path", capH: 8, rough: 10, teeth: 0.4, veg: 0.6, shade: 0.2 };
      b.piece("play", "op.rock", 0, 0, { ...rock, fadeY: h(72), fadeH: h(9) }, { z: 1, seed: 31337 });
      b.piece("play", "op.rock", 0, 0, rock, { z: 0, seed: 31337, minLevel: 0.9 });
    } else b.piece("play", "mass", 0, 0, { top, bottom, rock: "karst", flat: true }, { z: 1 });
  };
  // (the lower ledge, by the village, is never in the opening's frames: a flat stand-in)
  ledge(FOOT_X - h(0.4), h(110), h(3.4), false, true);
  ledge(h(148), PATH_TOP_X + h(0.4), h(3.6), true, false, true);
  b.piece("play", "boardwalk", 0, 0, { pts: along(h(108), h(150), -1) }, { z: 2 });

  // --- the massif's lower body: its east face from under the valley mist down to Hoài Phố's
  // West Shore, the village's ledge against it, the mill race and the lift's cable beside it.
  // (Kagami's rock, the opening's look, dissolves into the mist above; this stand-in begins
  // below the opening's widest frame, so the opening shows only its mist.)
  b.piece("play", "mass", 0, 0, {
    top: [h(0), h(90), h(98.2), h(90)],
    bottom: [h(97), h(92), h(90.4), h(106), h(83), h(120), h(76), h(134), h(72.4), h(160), h(71.2), h(185), HARBOUR_X0, HARBOUR_Y, h(0), HARBOUR_Y],
    rock: "karst", flat: true, deep: 0.66,
  }, { z: -2 });

  // --- the village at the foot: a ledge against the massif's face, over the terraces
  const footY = yOn(DIAG, FOOT_X);
  b.walk([VILLAGE_X0, footY, FOOT_X, footY], { surface: "earth", depth: h(2.4), name: "shiraito-village" });
  // its west end is an open lip over the gap by the massif's face: the mill race pours off it,
  // and stepping off after it is a cloud drop onto Hoài Phố's West Shore (sections/hoaipho.ts)
  b.piece("play", "chute", VILLAGE_X0 - h(0.9), footY - h(0.2), { w: 70, h: HARBOUR_Y - footY + h(0.2) }, { z: 1 });
  b.sprite({ id: "race-rings", plane: "front", kind: "sky.ripple", x: VILLAGE_X0 - h(0.9), y: HARBOUR_Y, p: { rx: 40, rings: 3 }, frames: 8, fps: 10, reflect: false });
  b.piece("play", "mass", 0, 0, {
    top: [VILLAGE_X0 - h(0.1), footY, FOOT_X + h(0.6), footY],
    bottom: [FOOT_X + h(0.9), footY + h(1.8), FOOT_X - h(2), footY + h(3.2), h(90), footY + h(4.4), h(85), footY + h(5.4), VILLAGE_X0 + h(0.6), footY + h(4.4), VILLAGE_X0 - h(0.1), footY + h(1.2)],
    rock: "karst", flat: true,
  }, { z: -1 });
  // the water mill: its house and the wheel turning in the race beside it
  b.piece("play", "hut", h(85.9), footY, { w: 170, h: 150 }, { z: 2 });
  b.sprite({ id: "shiraito-wheel", plane: "play", kind: "millwheel", x: VILLAGE_X0 + h(0.6), y: footY - h(0.9), p: { r: 82 }, frames: 8, fps: 3 });
  b.piece("play", "rack", h(88.2), footY, { w: 184 }, { z: 3 });
  b.piece("play", "hut", h(93.2), footY, { w: 150, h: 130 }, { z: 2 });
  b.usable({ id: "old-inn", x0: h(92.4), y0: footY - h(1.5), x1: h(94.0), y1: footY, label: "the old inn", action: { kind: "say", text: "An old inn, its door boarded up. The planks look newer than the door." } });

  // --- behind: the great wall of falls reaches back to the massif, rice terraces into the mist.
  // Its top stands at 90 H, below anything the opening's frames show of this plane (from the
  // lake it stays under the frame, never over the water; at the widest frame the opening's own
  // valley mist fills the valley under the lake's cliff).
  const r3 = 0.62;
  b.piece("back", "cliffwall", h(62), h(90), {
    w: h(50) * r3, h: h(72) * r3, falls: 0.9,
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
