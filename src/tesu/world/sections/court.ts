// The Prize Court 擂台 on the prow (GDK 5.1, A.3): through the Hall of Works' great doors (a
// scene cut) she comes out onto a round open-air court at the palace's east end, level with
// the hall's floor. The Prize Board stands at the gate with the newest release banner over
// it, Herald Bao beside it at the foot of his gong tower; the court floor carries the great
// inked seal; paper spectators watch from tiers behind (P3); lantern pillars ring it, two of
// them on P5 at the frame's edges in a bout; at the prow's tip a bench and a rail, and the
// whole land falls away below.
//
// Frame: outdoors grand, but bouts stay at play zoom so fights read: the court floor about
// two-thirds down, the gong tower cut by the top edge, the camera held on the court while a
// champion is out.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { FLOOR_Y } from "./palace.ts";

export const COURT_X0 = h(176.2);
export const COURT_X1 = h(192.6);
/** Where things stand on the court (world px). */
export const BOARD_X = h(178.8);
export const BAO_X = h(180.5);
export const GONG_X = h(182.2);
export const LION_X = h(187.6);
/** The court's middle, where the camera holds during a bout. */
export const COURT_MID = h(185.6);
/** The ring she and the champion move in. */
export const RING_X0 = h(177.4);
export const RING_X1 = h(191.4);

export function court(b: WorldBuilder): void {
  const Y = FLOOR_Y;
  // the floor: paving with the great seal lying on it, its face of cut blocks
  b.piece("play", "courtfloor", COURT_X0 - h(0.3), Y, { w: COURT_X1 - COURT_X0 + h(0.5), seal: [COURT_MID - COURT_X0 + h(0.3), h(3.4)] }, { z: 1 });
  b.walk([COURT_X0, Y, COURT_X1, Y], { surface: "stone", depth: h(2), name: "prize-court" });
  // the hall's east wall and the rail at the tip: hard edges with reasons
  b.wall({ x: COURT_X0 + h(0.15), y0: Y - h(6), y1: Y + h(0.1), reason: "wall" });
  b.wall({ x: COURT_X1 - h(0.2), y0: Y - h(6), y1: Y + h(0.1), reason: "rail" });

  // the gate back into the hall, the board, Bao's gong tower
  b.piece("play", "courtgate", COURT_X0 + h(0.75), Y, { w: 124, h: 300 }, { z: 3 });
  b.usable({ id: "court-doors", x0: COURT_X0 + h(0.1), y0: Y - h(3.1), x1: COURT_X0 + h(1.4), y1: Y, label: "the hall", action: { kind: "door", to: "hall-court-side" } });
  b.piece("play", "prizeboard", BOARD_X, Y, { plaques: ["dexclient", "dexcode"] }, { z: 4 });
  b.usable({ id: "prize-board", x0: BOARD_X - h(1.2), y0: Y - h(2.4), x1: BOARD_X + h(1.2), y1: Y, label: "the Prize Board", action: { kind: "panel", panel: "board" } });
  b.piece("play", "gongtower", GONG_X, Y, { h: h(12) }, { z: 3 });
  b.sprite({ id: "bao", plane: "play", kind: "bao", x: BAO_X, y: Y, p: {}, frames: 5, frame: 0, flip: true });

  // lantern pillars behind the ring, and two on P5 that stand at the frame's edges in a bout
  for (const x of [h(184.2), h(187.4), h(190.4)]) b.piece("play", "lanternpillar", x, Y - h(0.12), { h: h(3.1) }, { z: 2 });
  // (tall, out of the frame at the bottom; painted only for play zoom and closer, so the wide
  // frames never show them hanging under the prow)
  for (const x of [COURT_MID - h(6.9), COURT_MID + h(6.9)]) b.piece("near", "lanternpillar", x, Y + h(4), { h: 1150 }, { z: 3, minLevel: 0.9 });

  // at the tip: a bench and the rail, the land falling away below
  b.piece("play", "bench", h(190.6), Y, { w: 96 }, { z: 4 });
  b.piece("front", "rail", 0, 0, { pts: [h(191.3), Y + 2, COURT_X1 + h(0.1), Y + 2], h: 50, every: 46 }, { z: 2 });

  // the paper spectators in tiers behind the court (P3); their base runs down out of sight
  b.sprite({ id: "stands", plane: "back", kind: "stands", x: COURT_MID, y: Y, p: { w: 900, rows: 3 }, frames: 4, frame: 0, reflect: false });

  // the bout's actors, hidden until a champion is summoned (driven by the court's code)
  b.sprite({ id: "champion", plane: "play", kind: "lion", x: LION_X, y: Y, p: {}, frames: 9, frame: 0, hidden: true, reflect: false });
  b.sprite({ id: "install-bar", plane: "play", kind: "installbar", x: LION_X, y: Y, p: {}, frames: 11, frame: 0, hidden: true, reflect: false });
  b.sprite({ id: "glint", plane: "front", kind: "glint", x: LION_X, y: Y - h(1.4), p: {}, frames: 4, frame: 0, hidden: true, reflect: false });
  b.sprite({ id: "champion-hp", plane: "front", kind: "hpbar", x: LION_X, y: Y - h(2.2), p: {}, frames: 21, frame: 20, hidden: true, reflect: false });

  b.spawn({ id: "court-gate", x: COURT_X0 + h(1.7), y: Y, facing: 1 });
  b.place({ id: "prize-court", name: "Prize Court", x0: COURT_X0, x1: COURT_X1, title: "place", spawn: "court-gate" });

  // the frame: play zoom, the floor two-thirds down; held on the court while a bout is on
  b.track({ id: "court", x0: COURT_X0 - h(1), x1: COURT_X1 + h(1), keys: [
    { x: COURT_X0, zoom: 1, anchor: 0.68, horizon: 0.36, lead: 0.05 },
    { x: COURT_X1, zoom: 1, anchor: 0.68, horizon: 0.36, lead: 0.05 },
  ] });
  b.track({ id: "bout", x0: COURT_X0 - h(1), x1: COURT_X1 + h(1), when: "bout", keys: [
    { x: COURT_X0, zoom: 1, anchor: 0.68, horizon: 0.36, lead: 0, fixX: COURT_MID },
    { x: COURT_X1, zoom: 1, anchor: 0.68, horizon: 0.36, lead: 0, fixX: COURT_MID },
  ] });
}
