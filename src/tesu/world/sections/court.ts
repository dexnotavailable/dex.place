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
export const RING_X1 = h(186.6);
/** The Prow Stair's mouth: an opening in the court floor near the tip (GDK A.4), the stair
 *  running down under the court and the palace cliff to the top of Shiraito's path. */
export const STAIRWELL_X0 = h(186.8);
export const STAIRWELL_X1 = h(189.2);

export function court(b: WorldBuilder): void {
  const Y = FLOOR_Y;
  // the floor: paving with the great seal lying on it, its face of cut blocks
  // the floor, in two parts either side of the Prow Stair's mouth (thin, so the stair has
  // headroom beneath it)
  b.piece("play", "courtfloor", COURT_X0 - h(0.3), Y, { w: STAIRWELL_X0 - COURT_X0 + h(0.3), seal: [COURT_MID - COURT_X0 + h(0.3), h(3.4)] }, { z: 1 });
  b.piece("play", "courtfloor", STAIRWELL_X1, Y, { w: COURT_X1 - STAIRWELL_X1 + h(0.2), seal: [-h(20), h(0.1)] }, { z: 1 });
  b.walk([COURT_X0, Y, STAIRWELL_X0, Y], { surface: "stone", depth: h(0.6), name: "prize-court" });
  b.walk([STAIRWELL_X1, Y, COURT_X1, Y], { surface: "stone", depth: h(0.6), name: "prize-court-tip" });
  // the Prow Stair's mouth is bridged by a timber grate (one-way: she walks across it both
  // ways, walks up the stair under it, and drops through it holding down)
  b.walk([STAIRWELL_X0 - h(0.05), Y, STAIRWELL_X1 + h(0.05), Y], { surface: "wood", oneWay: true, name: "prow-stair-mouth" });
  b.piece("play", "plank", STAIRWELL_X0 - h(0.1), Y, { w: STAIRWELL_X1 - STAIRWELL_X0 + h(0.2) }, { z: 2 });
  b.usable({ id: "prow-stair", x0: STAIRWELL_X0, y0: Y - h(1.6), x1: STAIRWELL_X1, y1: Y, label: "down the Prow Stair", action: { kind: "door", to: "prow-stair-in" } });
  // the hall's east wall and the rail at the tip: hard edges with reasons
  b.wall({ x: COURT_X0 + h(0.15), y0: Y - h(6), y1: Y + h(0.1), reason: "wall" });
  // the Prow Leap at the tip (GDK 3.5): a plank with prayer flags out past the rail; off its
  // end is a long fall with a splash into Hoài Phố's lake (sections/hoaipho.ts)
  b.walk([COURT_X1 - h(0.1), Y, COURT_X1 + h(1.4), Y], { surface: "wood", oneWay: true, name: "prow-leap" });
  b.piece("play", "plank", COURT_X1 - h(0.2), Y, { w: h(1.7) }, { z: 3 });
  b.piece("play", "banners", COURT_X1 + h(0.2), Y - h(2.6), { w: h(1), drop: h(0.9), n: 2 }, { z: 3 });

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

  // things that break by the tip: two jars, and a lantern post with its paper lantern hanging
  // from the arm (break the post and the lantern falls: the support rule)
  b.prop({ id: "court-jar-1", kind: "jar", p: { h: 30, glaze: "ink" }, x: h(189.8), y: Y, cls: "cosmetic", material: "clay" });
  b.prop({ id: "court-jar-2", kind: "jar", p: { h: 24, glaze: "celadon" }, x: h(190.15), y: Y, cls: "cosmetic", material: "clay", pieces: 3 });
  b.prop({ id: "court-post", kind: "lanternpost", p: { h: 190, arm: 44 }, x: h(185.9) - 22, y: Y, cls: "cosmetic", material: "wood", hp: 2, pieces: 5 });
  b.prop({ id: "court-lantern", kind: "paperlantern", p: { r: 15 }, x: h(185.9) + 22, y: Y - 190, cls: "cosmetic", material: "paper", on: "court-post", hangs: true, pieces: 3 });
  // at the tip: a bench and the rail, the land falling away below
  b.piece("play", "bench", h(190.9), Y, { w: 96 }, { z: 4 });
  b.piece("front", "rail", 0, 0, { pts: [h(191.2), Y + 2, COURT_X1 - h(0.3), Y + 2], h: 50, every: 46 }, { z: 2 });

  // beyond the tip the land falls away into mist
  b.mist({ x0: COURT_X1 - h(6), x1: COURT_X1 + h(30), y: Y + h(16), half: h(13), rate: 0.62, after: "back", density: 0.95 });

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
