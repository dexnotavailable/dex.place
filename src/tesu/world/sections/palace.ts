// The Ink Palace 墨宮 at て's corner (GDK A.3): the hall's front on the forecourt at the
// end of Gate Road, the corner rock it stands on, and (through the hall, a scene cut) the
// Prize Court on the prow. This pass lays the rock and the hall's outer wall; the front
// (twin gate towers, banners, warm doors) and the court come with their pieces.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { HALL_DOOR_X, yOn } from "./common.ts";
import { DIAG, ROAD } from "./gate-road.ts";

export const HALL_X0 = h(145.9);
export const HALL_X1 = h(176);
export const FLOOR_Y = h(57.2);
/** The entrance: she stands in front of it to go in (F). */
export const DOOR_X0 = h(146.2);
export const DOOR_X1 = h(148.6);

export function palace(b: WorldBuilder): void {
  // the corner rock: from the forecourt to the prow, down to Shiraito's top; the hall's
  // platform, then the prow at the same level, a flat promontory carrying the Prize Court
  // (art: env-opening west of 176 H, the hall's east wall; env-hall east of it: the seam)
  const top = [HALL_DOOR_X - h(3), FLOOR_Y + h(0.5), h(176.4), FLOOR_Y + h(0.5)];
  const bottom = [h(176.8), FLOOR_Y + h(2.4), h(176.6), h(74.6), h(174), Math.max(h(74), yOn(DIAG, h(174)) + h(1)), h(170), yOn(DIAG, h(170)), h(160), h(70), h(150), h(63), HALL_DOOR_X - h(3.4), FLOOR_Y + h(3)];
  b.piece("play", "op.rock", 0, 0, { top, bottom, cap: "grass", capH: 7, rough: 12, teeth: 0.5, veg: 0.7, shade: 0.3, fadeY: h(72), fadeH: h(9), joinR: h(3) }, { z: -1 });
  // --- env-hall's block: the prow rock east of the seam (176 H) to the tip. Stand-in params in
  // the opening's rock; env-hall restyles or moves this block (lanes/ENV-OPENING-STATE.md).
  {
    const top = [h(175.8), FLOOR_Y + h(0.5), h(192.4), FLOOR_Y + h(0.5), h(193.3), FLOOR_Y + h(1.3)];
    const bottom = [h(193.7), FLOOR_Y + h(2.4), h(193.2), h(61.5), h(191.4), h(65.5), h(188.6), h(70), h(184), h(73.5), h(179), Math.max(h(75), yOn(DIAG, h(179)) + h(1)), h(175.6), h(74.6)];
    b.piece("play", "op.rock", 0, 0, { top, bottom, cap: "bare", rough: 12, teeth: 0.5, veg: 0.6, shade: 0.3, fadeY: h(72), fadeH: h(9), joinL: h(3) }, { z: -1 });
  }
  // --- end of env-hall's block
  // the forecourt in front of the doors
  b.walk([HALL_DOOR_X + h(0.4), FLOOR_Y, DOOR_X1 + h(0.4), FLOOR_Y], { surface: "stone", depth: h(3), name: "forecourt" });
  // the hall: a long three-tier hall on its stone platform, the entrance at its west end
  b.piece("play", "op.palace", HALL_X0, FLOOR_Y, { w: HALL_X1 - HALL_X0, h0: h(5.6), h1: h(4.2), h2: h(3.2), door: [DOOR_X0 - HALL_X0, DOOR_X1 - DOOR_X0, h(3.7)] }, { z: 4 });
  // twin gate towers flank the way in; cable stays slant down to the road; banners between
  const towerH = h(10);
  const lx = h(143.3), rx = h(150.4);
  const ly = yOn(ROAD_PTS(), lx);
  b.piece("play", "op.tower", lx, ly + 4, { h: towerH, w: 72 }, { z: 7 });
  b.piece("play", "op.tower", rx, FLOOR_Y + 4, { h: towerH, w: 72 }, { z: 7 });
  b.piece("play", "op.stay", lx - 20, ly - towerH + h(1.1), { dx: -h(4.4), dy: towerH - h(1.1) - h(0.6) }, { z: 8 });
  b.piece("play", "op.stay", lx + 10, ly - towerH + h(1.1), { dx: -h(2.6), dy: towerH - h(1.1) - h(0.3) }, { z: 8 });
  b.piece("play", "op.stay", rx + 20, FLOOR_Y - towerH + h(1.1), { dx: h(5), dy: towerH - h(1.1) }, { z: 8 });
  b.sprite({ id: "hall-banners", plane: "play", kind: "op.banners", x: lx, y: ly - towerH + h(2.4), p: { w: rx - lx, drop: h(2.2), n: 5 }, frames: 4, fps: 6 });
  // the doors open into the Hall of Works (a scene cut)
  b.usable({ id: "hall-doors", x0: DOOR_X0, y0: FLOOR_Y - h(3.7), x1: DOOR_X1, y1: FLOOR_Y, label: "go in", action: { kind: "door", to: "hall-in" } });
  // the forecourt ends at the doors: a hard edge with a reason (the hall's wall)
  b.wall({ x: DOOR_X1 + h(0.3), y0: FLOOR_Y - h(6), y1: FLOOR_Y + h(0.1), reason: "wall" });
  b.place({ id: "ink-palace", name: "Ink Palace", x0: HALL_DOOR_X - h(3), x1: HALL_X1, title: "place", spawn: "hall-door" });
}

function ROAD_PTS(): number[] {
  return ROAD;
}
