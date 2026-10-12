// Yuemen 月門 (GDK A.3, Terraces; the clock's 8:50): a night-market town on the top of a giant
// stone ring, す's loop, standing on two legs over the Sky Well's mouth. Layout and systems
// first, neutral stand-ins (flat values, simple silhouettes) for the region's owner to dress.
//
// - The way down from Tsuji: the bamboo flume, one way, about 40 s of swoops and drops from the
//   flume's mouth on Tsuji's street, landing with a splash on the ring's top; YUEMEN on arrival.
// - The needle stands on the ring: a door at its foot leads up its inner stair to Tsuji's
//   street (and down again), the way home until the Sky Well's lift is opened from the floor.
// - The stair down the ring's leg to the Sky Well comes with that place.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { TSUJI_Y } from "./shanshui.ts";

/** The ring: its centre, outer radius and thickness (world px). */
export const RING_CX = h(355), RING_CY = h(125), RING_R = h(25), RING_W = h(6);
/** The town on its top: where the arc is walkable (slope under 1), the needle's west face beyond. */
export const YUEMEN_X0 = h(339), YUEMEN_X1 = h(367.6);
/** The ring's outer surface at x (its top half). */
export function ringTop(x: number): number {
  const dx = Math.max(-RING_R, Math.min(RING_R, x - RING_CX));
  return RING_CY - Math.sqrt(RING_R * RING_R - dx * dx);
}

/** The flume's bed, from its mouth on Tsuji's street to the ring's top (H pairs, sampled into px). */
const FLUME_H: [number, number][] = [
  [379.6, 74.6], [380.4, 76.2], [381.2, 78.4],
  [395, 79.6], [411.4, 81.0], [412.8, 81.6], [413.5, 82.6], [412.9, 83.5],
  [400, 84.9], [386.5, 86.0], [384.2, 88.4], [382.4, 91.6],
  [370, 92.9], [352, 94.0], [342.6, 94.8], [340.6, 95.4], [340.3, 96.4], [341.6, 97.2],
  [350, 96.4], [357, 96.9], [359.6, 98.8], [361, ringTop(h(361)) / 96],
];
export const FLUME_PTS = FLUME_H.flatMap(([x, y]) => [h(x), h(y)]);

export function yuemen(b: WorldBuilder): void {
  // --- the ring, its legs down into the Sky Well's mouth, the town on its top
  b.piece("play", "ring", RING_CX, RING_CY, { r: RING_R, w: RING_W }, { z: -3 });
  for (const [a0, a1, f0, f1] of [[h(335.4), h(341.2), h(329.6), h(337.6)], [h(368.8), h(374.6), h(372.4), h(380.4)]] as const) {
    const yb = RING_CY + Math.sqrt(Math.max(0, RING_R * RING_R - (a0 - RING_CX) ** 2)) - h(2);
    b.piece("play", "mass", 0, 0, { top: [a0, yb, a1, yb], bottom: [f1, h(232), f0, h(232)], rock: "karst", flat: true, deep: 0.62 }, { z: -4 });
  }
  // the crossbar's road above rests on a column standing on the ring (and on the needle)
  b.piece("play", "pillar", h(340.4), TSUJI_Y + h(2.4), { w: h(3.4), h: ringTop(h(340.4)) + h(1) - TSUJI_Y - h(2.4) }, { z: -2 });
  const arc: number[] = [];
  for (let x = YUEMEN_X0; x < YUEMEN_X1 + h(1); x += h(1)) arc.push(Math.min(x, YUEMEN_X1), ringTop(Math.min(x, YUEMEN_X1)));
  b.walk(arc, { surface: "stone", depth: RING_W, name: "yuemen" });
  b.wall({ x: YUEMEN_X0 - h(0.05), y0: ringTop(YUEMEN_X0) - h(4), y1: ringTop(YUEMEN_X0) + h(0.1), reason: "rail", from: "right" });
  b.piece("front", "rail", 0, 0, { pts: [YUEMEN_X0 - h(0.1), ringTop(YUEMEN_X0) + 2, YUEMEN_X0 + h(0.4), ringTop(YUEMEN_X0 + h(0.4)) + 2], h: 46, every: 30 }, { z: 1 });
  b.wall({ x: YUEMEN_X1 + h(0.05), y0: ringTop(YUEMEN_X1) - h(6), y1: ringTop(YUEMEN_X1) + h(0.1), reason: "wall", from: "left" });
  // the night market, folded away by day: stalls, bare lantern poles
  for (const [x, w, hh] of [[h(344.2), 150, 120], [h(349.8), 170, 130], [h(355.4), 130, 110], [h(363.4), 160, 125]] as const) b.piece("play", "hut", x, ringTop(x), { w, h: hh }, { z: 0 });
  for (const x of [h(347), h(352.6), h(358.4)]) b.piece("play", "hanglantern", x, ringTop(x) - h(2.6), { drop: 10, r: 13 }, { z: 4 });
  b.usable({ id: "yuemen-market", x0: h(349), y0: ringTop(h(349.8)) - h(1.6), x1: h(350.6), y1: ringTop(h(349.8)), label: "the night market", action: { kind: "say", text: "A night market folded away for the day: awnings rolled, lantern poles bare, crates stacked under cloths. It opens at dusk." } });
  b.usable({ id: "yuemen-leg-stair", x0: YUEMEN_X0, y0: ringTop(YUEMEN_X0) - h(1.6), x1: YUEMEN_X0 + h(1.4), y1: ringTop(YUEMEN_X0), label: "the stair down the leg", action: { kind: "say", text: "A stair cut down the ring's leg toward the Sky Well, roped off. It opens later." } });
  // the needle's door: its inner stair up to Tsuji's street, and the same stair down
  b.usable({ id: "yuemen-needle", x0: YUEMEN_X1 - h(1.2), y0: ringTop(YUEMEN_X1) - h(2), x1: YUEMEN_X1, y1: ringTop(YUEMEN_X1), label: "up the needle's stair", action: { kind: "door", to: "tsuji-needle" } });
  b.usable({ id: "tsuji-needle", x0: h(371.2), y0: TSUJI_Y - h(2), x1: h(372.8), y1: TSUJI_Y, label: "down the needle's stair", action: { kind: "door", to: "yuemen-needle" } });
  b.spawn({ id: "yuemen-needle", x: YUEMEN_X1 - h(1.6), y: ringTop(YUEMEN_X1 - h(1.6)), facing: -1 });
  b.spawn({ id: "tsuji-needle", x: h(373.4), y: TSUJI_Y, facing: 1 });
  b.spawn({ id: "yuemen", x: h(353), y: ringTop(h(353)), facing: 1 });
  // (its band starts at the ring's top: the flume's last swoops pass above it, so YUEMEN comes as she lands)
  b.place({ id: "yuemen", name: "Yuemen", x0: YUEMEN_X0, x1: YUEMEN_X1, y0: h(99.4), y1: h(112), title: "big", spawn: "yuemen" });
  // the Sky Well's mouth below: mist rising through the ring, a fall into it tugged back
  b.mist({ x0: h(318), x1: h(412), y: h(176), half: h(14), rate: 1, after: "play", density: 0.9 });
  b.void({ x0: h(326), x1: h(410), y: h(114), y1: h(240) });

  // --- the flume from Tsuji: one way, a slide (faster on the drops), a splash at the foot
  b.piece("play", "flume", 0, 0, { pts: FLUME_PTS }, { z: 3 });
  b.ride({
    id: "flume", pts: FLUME_PTS, secs: 40, cars: [], hang: 0, oneWay: true, slide: { min: 2.2, gain: 7 }, splash: true,
    top: { x: RING_CX, y: ringTop(h(361)), anchor: 0.72, secs: 4 },
  });

  // --- the frames: the town held on the ring; the flume a little wide
  b.track({ id: "yuemen", x0: YUEMEN_X0 - h(4), x1: YUEMEN_X1 + h(4), y0: h(96), y1: h(114), keys: [
    { x: YUEMEN_X0, zoom: 0.8, anchor: 0.62, horizon: 0.42, lead: 0, fixX: RING_CX },
    { x: YUEMEN_X1, zoom: 0.8, anchor: 0.62, horizon: 0.42, lead: 0, fixX: RING_CX },
  ] });
  b.track({ id: "flume", x0: h(335), x1: h(416), y0: h(70), y1: h(104), when: "ride:flume", keys: [
    { x: h(335), zoom: 0.72, anchor: 0.5, horizon: 0.42, lead: 0.08 },
    { x: h(416), zoom: 0.72, anchor: 0.5, horizon: 0.42, lead: 0.08 },
  ] });
}
