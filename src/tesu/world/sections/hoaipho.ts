// Hoài Phố 懷浦 (GDK A.3; Lowlands, shore): a lantern harbour on a still lake at the bottom of
// て, under the palace prow. Layout and systems first, neutral stand-ins (flat values, simple
// silhouettes) for the place's owner to dress later.
//
// The ways in and out, as the map's loop has them:
// - down from Shiraito's village: the mill race pours off the village's west lip into the gap
//   by the massif's face, and stepping off after it is a cloud drop onto the West Shore;
// - the Prow Leap: off the Prize Court's tip, a long fall into the splash pool at the harbour's
//   east end (cloud drops speed up, so it takes seconds);
// - the waterwheel lift at the West Shore, up the massif's face to Kagami beside the catch: it
//   opens from below (the first ride up opens it for good), and from above it says so;
// - the Silk Line's lower station at the east end: the ropeway up to Kumoji (sections/shanshui.ts).
//
// The harbour street runs along the near shore: the West Shore's quay under the massif, a
// street of stilt houses on posts in the water (Mai's lantern shop, the mirror-polisher's
// stall), a covered bridge, the east quay, the splash pool with steps out on both sides.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { DECK_Y, JETTY_X1 } from "./common.ts";

/** The street's level, the still water's surface, the pool's floor (world px). */
export const QUAY_Y = h(196);
export const HARBOUR_Y = h(197.2);
const POOL_Y = QUAY_Y + h(1.7);
/** The harbour's ends: the massif's foot in the west, the Silk Line's station in the east. */
export const HARBOUR_X0 = h(70.6);
export const HARBOUR_X1 = h(205);
/** The splash pool, where the Prow Leap lands. */
const POOL_X0 = h(190.6), POOL_X1 = h(197.6);
/** The waterwheel lift's two stations. */
const LIFT_LOW_X = h(75.2);
const LIFT_TOP_X = JETTY_X1 - h(1.6);

export function hoaipho(b: WorldBuilder): void {
  // --- the ground: the West Shore at the massif's foot, the street, the pool, the east quay
  b.walk([HARBOUR_X0, QUAY_Y, h(189.4), QUAY_Y], { surface: "wood", depth: h(1), name: "hoai-pho" });
  b.walk([h(189.4), QUAY_Y, POOL_X0 + h(0.3), POOL_Y], { surface: "stone", stair: true, name: "pool-steps-west" });
  b.walk([POOL_X0, POOL_Y, POOL_X1, POOL_Y], { surface: "water", depth: h(1), name: "splash-pool" });
  b.walk([POOL_X1 - h(0.3), POOL_Y, h(198.9), QUAY_Y], { surface: "stone", stair: true, name: "pool-steps-east" });
  b.walk([h(198.9), QUAY_Y, HARBOUR_X1, QUAY_Y], { surface: "wood", depth: h(1), name: "east-quay" });
  b.wall({ x: HARBOUR_X0 - h(0.1), y0: QUAY_Y - h(6), y1: QUAY_Y + h(0.1), reason: "cliff", from: "right" });
  b.wall({ x: HARBOUR_X1 + h(0.1), y0: QUAY_Y - h(6), y1: QUAY_Y + h(0.1), reason: "wall", from: "left" });
  // below the street and the pool is the lake: a fall into it is tugged back to the quay
  b.void({ x0: h(60), x1: h(212), y: HARBOUR_Y + h(1.8), y1: h(240) });

  // the West Shore's quay at the massif's foot (the massif's face: sections/shiraito.ts); the
  // pool's stone basin
  b.piece("play", "mass", 0, 0, {
    top: [h(58), QUAY_Y, h(100), QUAY_Y],
    bottom: [h(100.4), QUAY_Y + h(0.8), h(90), HARBOUR_Y + h(1.4), h(70), HARBOUR_Y + h(2.4), h(58), HARBOUR_Y + h(3)],
    rock: "earth", flat: true,
  }, { z: 0 });
  b.piece("play", "mass", 0, 0, {
    top: [POOL_X0 - h(0.4), POOL_Y, POOL_X1 + h(0.4), POOL_Y],
    bottom: [POOL_X1 + h(0.4), POOL_Y + h(1.2), POOL_X0 - h(0.4), POOL_Y + h(1.2)],
    rock: "stone", flat: true,
  }, { z: 0 });
  // the lake's bed under the whole harbour (the cross-section seen from the street)
  b.piece("play", "mass", 0, 0, {
    top: [h(99), HARBOUR_Y + h(1.5), HARBOUR_X1 + h(4), HARBOUR_Y + h(1.5)],
    bottom: [HARBOUR_X1 + h(4), HARBOUR_Y + h(9), h(99), HARBOUR_Y + h(9)],
    rock: "earth", flat: true,
  }, { z: -1 });
  // the street and the east quay on posts in the water
  b.piece("play", "jetty", h(100), QUAY_Y, { w: h(89.4), water: HARBOUR_Y - QUAY_Y }, { z: 1 });
  b.piece("play", "jetty", h(198.9), QUAY_Y, { w: HARBOUR_X1 - h(198.9), water: HARBOUR_Y - QUAY_Y }, { z: 1 });
  b.piece("play", "waterBody", h(100), HARBOUR_Y, { w: HARBOUR_X1 - h(100) + h(2), depth: h(1.6) }, { z: 0, reflect: false });
  b.water({ y: HARBOUR_Y, x0: h(70), x1: h(206), fx0: h(-40), fx1: h(320), near: 1.9, far: 0.06, kind: "lake" });

  // --- the street: stilt houses, the covered bridge, lanterns, boats
  for (const [x, w, hh] of [[h(104), 150, 128], [h(141), 160, 136], [h(176), 150, 124]] as const) b.piece("play", "hut", x, QUAY_Y, { w, h: hh }, { z: 0 });
  b.piece("play", "hut", h(116.5), QUAY_Y, { w: 190, h: 150 }, { z: 0 });
  b.usable({ id: "mai-shop", x0: h(115.5), y0: QUAY_Y - h(1.6), x1: h(117.5), y1: QUAY_Y, label: "Mai's lantern shop", action: { kind: "say", text: "Mai's lantern shop: paper, paste and a dozen half-made lanterns. \"Back soon,\" says the sign." } });
  b.piece("play", "hut", h(128.5), QUAY_Y, { w: 120, h: 104 }, { z: 0 });
  b.usable({ id: "mirror-stall", x0: h(127.8), y0: QUAY_Y - h(1.3), x1: h(129.2), y1: QUAY_Y, label: "the mirror-polisher's stall", action: { kind: "say", text: "A stall of polished bronze mirrors. Its sign is painted back to front." } });
  b.piece("play", "canopy", h(150), QUAY_Y, { w: h(18), h: h(2.6) }, { z: 3 });
  for (const x of [h(152), h(156), h(160), h(164), h(108), h(122), h(134), h(146), h(182)]) b.piece("play", "hanglantern", x, QUAY_Y - h(2.7), { drop: 12, r: 14 }, { z: 4 });
  for (const [x, w] of [[h(112), h(2.4)], [h(137), h(2.8)], [h(171), h(2.2)]] as const) b.piece("play", "boat", x, HARBOUR_Y + 2, { w }, { z: 1 });
  // the stilt houses across the water (P3), low hills behind them (P2)
  for (let i = 0; i < 9; i++) b.piece("back", "hut", h(96 + i * 13), HARBOUR_Y, { w: 120 + (i % 3) * 20, h: 96 + (i % 2) * 18 }, { z: 2 });
  b.piece("back", "plain", h(40), HARBOUR_Y, { w: 9000, foot: 400, ramp: "pine", amp: 6 }, { z: 0 });
  b.piece("mid", "plain", h(20), HARBOUR_Y, { w: 7000, foot: 400, ramp: "range", amp: 18 }, { z: 0 });
  b.piece("far", "plain", h(-400), HARBOUR_Y, { w: 9000, foot: 900, ramp: "range", amp: 4 }, { z: 0 });
  b.mist({ x0: h(66), x1: h(210), y: HARBOUR_Y - h(1.2), half: h(1.6), rate: 0.62, after: "back", density: 0.6 });

  // --- the waterwheel lift: a wheel in the harbour drives the cable up the massif's face
  b.sprite({ id: "lift-wheel", plane: "play", kind: "millwheel", x: LIFT_LOW_X - h(1.6), y: QUAY_Y - h(0.6), p: { r: 70 }, frames: 8, fps: 2 });
  // (the cable hangs close down the massif's face: between the face and Shiraito's mill race)
  b.piece("play", "liftcable", 0, 0, { pts: [LIFT_TOP_X, DECK_Y - h(0.2), h(104.4), h(84), h(88.6), h(112), h(80.4), h(127.5), h(75.6), h(141), LIFT_LOW_X, QUAY_Y] }, { z: 2 });
  b.usable({
    id: "lift-low", x0: LIFT_LOW_X - h(0.8), y0: QUAY_Y - h(1.8), x1: LIFT_LOW_X + h(0.8), y1: QUAY_Y, label: "the waterwheel lift",
    action: { kind: "door", to: "lift-top", opens: "lift:waterwheel" },
  });
  b.usable({
    id: "lift-top", x0: LIFT_TOP_X - h(0.6), y0: DECK_Y - h(1.8), x1: LIFT_TOP_X + h(0.6), y1: DECK_Y, label: "the waterwheel lift",
    action: { kind: "door", to: "lift-low", needs: "lift:waterwheel", closed: "The lift's cage is chained at the bottom of the cliff. It opens from the harbour." },
  });

  // --- the Silk Line's lower station: its car docks at the quay's east end (the ropeway up to
  // Kumoji, its cable and cars: sections/shanshui.ts)
  b.piece("play", "hut", h(202.2), QUAY_Y, { w: 210, h: 170 }, { z: 0 });
  b.usable({ id: "silk-line", x0: h(203.3), y0: QUAY_Y - h(2), x1: h(205), y1: QUAY_Y, label: "the Silk Line", action: { kind: "ride", ride: "silk-line", dir: 1 } });

  b.spawn({ id: "hoai-pho", x: h(96), y: QUAY_Y, facing: 1 });
  b.spawn({ id: "lift-low", x: LIFT_LOW_X + h(0.9), y: QUAY_Y, facing: 1 });
  b.spawn({ id: "lift-top", x: LIFT_TOP_X - h(0.9), y: DECK_Y, facing: 1 });
  b.place({ id: "hoai-pho", name: "Hoài Phố", x0: HARBOUR_X0, x1: HARBOUR_X1, y0: h(175), y1: h(215), title: "place", spawn: "hoai-pho" });

  // --- the frame: play zoom throughout, its edges kept inside the harbour's ends
  // (west, the frame keeps a few H of the massif's face in view: the harbour's end is its foot)
  b.track({ id: "hoai-pho", x0: h(60), x1: h(215), y0: h(175), y1: h(215), bounds: [HARBOUR_X0 - h(4), HARBOUR_X1 + h(1.5)], keys: [
    { x: HARBOUR_X0, zoom: 1, anchor: 0.64, horizon: 0.4, lead: 0.06 },
    { x: HARBOUR_X1, zoom: 1, anchor: 0.64, horizon: 0.4, lead: 0.06 },
  ] });
}
