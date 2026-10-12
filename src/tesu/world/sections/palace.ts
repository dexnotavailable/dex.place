// The Ink Palace 墨宮 at て's corner (GDK A.3): the hall's front on the forecourt at the
// end of Gate Road, the corner rock it stands on, and (through the hall, a scene cut) the
// Prize Court on the prow. This pass lays the rock and the hall's outer wall; the front
// (twin gate towers, banners, warm doors) and the court come with their pieces.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { HALL_DOOR_X, yOn } from "./common.ts";
import { DIAG } from "./gate-road.ts";

export const HALL_X0 = HALL_DOOR_X + h(0.4);
export const HALL_X1 = h(176);
export const FLOOR_Y = h(57.2);

export function palace(b: WorldBuilder): void {
  // the corner rock: from the forecourt to the prow, down to Shiraito's top
  const top = [HALL_DOOR_X - h(3), FLOOR_Y, h(186), FLOOR_Y - h(0.2), h(190), h(53)];
  const bottom = [h(190.5), h(56), h(188), yOn(DIAG, h(176)) + h(2), h(176), yOn(DIAG, h(176)) + h(1), h(172), yOn(DIAG, h(172)), h(160), h(70), h(150), h(63), HALL_DOOR_X - h(3.4), FLOOR_Y + h(3)];
  b.piece("play", "mass", 0, 0, { top, bottom, rock: "karst", cap: "none", tufts: 0, shade: 0.25 }, { z: -1 });
  // the hall's outer wall and roofs (the doors open into the Hall of Works, a scene cut)
  b.piece("play", "hall", HALL_X0, FLOOR_Y, { w: HALL_X1 - HALL_X0, h: h(5.2), tiers: 2, door: [h(0.5), h(2.2), h(3.4)] }, { z: 4 });
  // the forecourt ends at the hall's doors: a hard edge with a reason (the wall)
  b.wall({ x: HALL_X0 + h(0.2), y0: FLOOR_Y - h(6), y1: FLOOR_Y + h(0.1), reason: "wall" });
  b.place({ id: "ink-palace", name: "Ink Palace", x0: HALL_DOOR_X - h(3), x1: h(192), title: "place", spawn: "hall-door" });
}
