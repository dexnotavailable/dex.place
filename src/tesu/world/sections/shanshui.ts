// Shanshui 山水 (GDK A.3; Heights): the Silk Line, a ropeway from Hoài Phố's east pier up over the
// pillar forest to Kumoji 雲路, the rampart road on pillar tops at the start of す's crossbar.
// Layout and systems first, neutral stand-ins (flat values, simple silhouettes) for the region's
// owner to dress later.
//
// - The Silk Line: two cars on one cable, about 40 s station to station, controls held, the
//   camera pulling wide on the way up. Arriving at the top holds a Vista (1/2) over the forest
//   with SHANSHUI, the biggest title, once a visit; moving on ends the hold.
// - Kumoji's first stretch: the upper station, then the road on its band of masonry carried by
//   pillars standing out of a sea of mist (a fall into it is tugged back). Its far end is a
//   barred gate until Tsuji exists; the Kumo-bashi bridge back to the court and the Pillar Hop
//   come with their own pieces.

import { h } from "../../config.ts";
import { CAR } from "../../art/painters/shanshui.ts";
import type { WorldBuilder } from "../build.ts";
import { QUAY_Y } from "./hoaipho.ts";

/** Kumoji's level at its west end (the upper station), world px. */
export const KUMOJI_Y = h(79);
/** Where the cars dock: the low station on Hoài Phố's east quay, the high one at Kumoji's west end. */
export const SILK_LOW_X = h(204.1);
export const SILK_TOP_X = h(262.6);
/** From the cable down to a car's floor, px. */
export const SILK_HANG = CAR.hanger + CAR.h;
const KUMOJI_X1 = h(339.6);

/** A cubic Bezier sampled to a polyline (n segments). */
function bezier(p: [number, number, number, number, number, number, number, number], n: number): number[] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    out.push(s * s * s * x0 + 3 * s * s * t * x1 + 3 * s * t * t * x2 + t * t * t * x3, s * s * s * y0 + 3 * s * s * t * y1 + 3 * s * t * t * y2 + t * t * t * y3);
  }
  return out;
}

/** The Silk Line's cable, low station to high (the map's hairline from て's end to す's crossbar). */
export const SILK_CABLE = bezier([SILK_LOW_X, QUAY_Y - SILK_HANG, h(222), h(168), h(242), h(108), SILK_TOP_X, KUMOJI_Y - SILK_HANG], 32);

export function shanshui(b: WorldBuilder): void {
  // --- the Silk Line: the cable, its two cars (one waits at each station)
  b.piece("play", "ropecable", 0, 0, { pts: SILK_CABLE }, { z: 6 });
  for (const id of ["silk-car-a", "silk-car-b"]) {
    b.sprite({ id, plane: "play", kind: "ropecar", x: SILK_LOW_X, y: QUAY_Y - SILK_HANG, p: {}, frames: 1, reflect: true });
    b.sprite({ id: `${id}:front`, plane: "front", kind: "ropecar", x: SILK_LOW_X, y: QUAY_Y - SILK_HANG, p: { part: "front" }, frames: 1, reflect: true });
  }
  b.ride({
    id: "silk-line", pts: SILK_CABLE, secs: 40, cars: ["silk-car-a", "silk-car-b"], hang: SILK_HANG,
    // arriving at the top: the forest below, the cable a long diagonal down to the left
    // (the station's edge kept at 86% of the width on any screen, the title in the open air left of it)
    top: { x: h(252), y: KUMOJI_Y, anchor: 0.42, secs: 5, pin: { x: h(261.4), at: 0.86 }, title: "SHANSHUI", titleFrac: 0.62 },
  });
  b.usable({ id: "silk-line-top", x0: SILK_TOP_X - h(0.5), y0: KUMOJI_Y - h(1.8), x1: SILK_TOP_X + h(1.2), y1: KUMOJI_Y, label: "the Silk Line", action: { kind: "ride", ride: "silk-line", dir: -1 } });

  // --- Kumoji: the road on its band, from the upper station east
  // (level at the station, where the car docks, then rising gently east)
  const road = [h(262), KUMOJI_Y, h(266.5), KUMOJI_Y, h(300), KUMOJI_Y - h(1.2), KUMOJI_X1, KUMOJI_Y - h(2.6)];
  b.walk(road, { surface: "stone", depth: h(2.6), name: "kumoji" });
  const yAt = (x: number): number => {
    for (let i = 2; i < road.length; i += 2) if (x <= road[i]! || i === road.length - 2) return road[i - 1]! + ((x - road[i - 2]!) / (road[i]! - road[i - 2]!)) * (road[i + 1]! - road[i - 1]!);
    return road[1]!;
  };
  // the station's edge: a rail where the cars come in from the open air
  b.wall({ x: h(261.9), y0: KUMOJI_Y - h(6), y1: KUMOJI_Y + h(0.1), reason: "rail", from: "right" });
  b.piece("front", "rail", 0, 0, { pts: [h(261.5), KUMOJI_Y + 2, h(262.05), KUMOJI_Y + 2], h: 50, every: 46 }, { z: 2 });
  b.piece("play", "hut", h(265.6), yAt(h(265.6)), { w: 230, h: 190 }, { z: 0 });
  // the band: masonry under the road, flat values
  const bandTop: number[] = [h(261.6), KUMOJI_Y, ...road.slice(2)];
  const bandBottom: number[] = [];
  for (let x = KUMOJI_X1 + h(0.4); x >= h(261.4); x -= h(2)) bandBottom.push(x, yAt(Math.min(KUMOJI_X1, Math.max(h(262), x))) + h(2.6));
  b.piece("play", "mass", 0, 0, { top: bandTop, bottom: bandBottom, rock: "stone", flat: true, deep: 0.62 }, { z: -1 });
  // the pillars that carry it, standing out of the sea of mist
  for (const [x, w] of [[h(265), h(4.4)], [h(279), h(3.8)], [h(293), h(4.6)], [h(307), h(3.6)], [h(321), h(4.2)], [h(335), h(4)]] as const) {
    const top = yAt(Math.min(KUMOJI_X1, x)) + h(2.2);
    b.piece("play", "pillar", x, top, { w, h: h(226) - top }, { z: -2 });
  }
  // the far end: a barred gatehouse until the road goes on to Tsuji
  b.piece("play", "hut", KUMOJI_X1 - h(1.2), yAt(KUMOJI_X1 - h(1.2)), { w: 250, h: 220 }, { z: 1 });
  b.wall({ x: KUMOJI_X1 + h(0.05), y0: KUMOJI_Y - h(8), y1: KUMOJI_Y, reason: "gate", from: "left" });
  b.usable({ id: "kumoji-gate", x0: KUMOJI_X1 - h(2), y0: yAt(KUMOJI_X1) - h(2), x1: KUMOJI_X1, y1: yAt(KUMOJI_X1), label: "the rampart gate", action: { kind: "say", text: "The rampart gate is barred from the far side. The road to Tsuji opens later." } });

  // --- the pillar forest: ranks on P3 and P2, each paler, the sea of mist between them. Stand-ins
  // in clusters (a broad massif, a tall needle beside a stout one, open mist between groups), not
  // a row of even columns. [x, width, top] in H; P2 starts east of what the court's frames see.
  const r3 = 0.62, r2 = 0.28;
  const P3: [number, number, number][] = [
    [208, 3.2, 96], [212.4, 2.0, 112],
    // (a broad massif at the forest's west edge, standing in front of where the lake's far plains end)
    [227, 10.4, 58],
    [231.5, 2.6, 84], [234.6, 3.8, 92], [238.2, 1.8, 104],
    [249, 4.6, 80],
    [258.5, 2.2, 101], [262.2, 5.4, 116],
    [274, 3.0, 88], [277.4, 2.0, 95],
    [290, 8.4, 110],
    [303, 2.8, 82], [306.6, 3.8, 88],
    [320, 2.4, 98], [323.6, 5.2, 106],
    [338, 3.4, 86],
  ];
  const P2: [number, number, number][] = [
    [229, 2.0, 70], [232, 3.0, 76],
    [241, 6.4, 92],
    [250, 1.8, 66], [252.6, 2.6, 72], [255.6, 1.6, 80],
    [265, 4.2, 64],
    [276, 2.2, 74], [279.2, 3.4, 69],
    [291, 7.2, 88],
    [302, 2.0, 63], [304.8, 2.8, 70],
    [316, 4.8, 78],
    [329, 2.4, 66], [332, 1.8, 74],
    [345, 6.2, 84],
    [358, 2.6, 68], [361.4, 3.2, 72],
    [374, 4.2, 76],
  ];
  for (const [x, w, top] of P3) b.piece("back", "pillar", h(x), h(top), { w: Math.round(h(w) * r3), h: Math.round((h(232) - h(top)) * r3), crown: true }, { z: 1 });
  for (const [x, w, top] of P2) b.piece("mid", "pillar", h(x), h(top), { w: Math.round(h(w) * r2), h: Math.round((h(236) - h(top)) * r2), crown: true }, { z: 1 });
  // the pillars rise out of layered mist: their trunks fade into it, their crowns stand clear
  b.mist({ x0: h(220), x1: h(480), y: h(112), half: h(24), rate: r2, after: "mid", density: 0.75 });
  b.mist({ x0: h(205), x1: h(480), y: h(152), half: h(28), rate: r3, after: "back", density: 0.8 });
  b.mist({ x0: h(206), x1: h(480), y: h(214), half: h(12), rate: 1, after: "play", density: 0.95 });
  // below Kumoji and the forest is the sea of mist: a fall into it is tugged back
  b.void({ x0: h(206), x1: h(480), y: KUMOJI_Y + h(8), y1: h(240) });

  b.spawn({ id: "silk-line-top", x: SILK_TOP_X + h(1), y: yAt(SILK_TOP_X + h(1)), facing: 1 });
  b.spawn({ id: "kumoji", x: h(290), y: yAt(h(290)), facing: 1 });
  b.place({ id: "kumoji", name: "Kumoji", x0: h(272), x1: KUMOJI_X1, y0: h(60), y1: h(100), title: "place", spawn: "kumoji" });

  // --- the frames: Kumoji at play, the station end open to the drop; the ride pulls wide
  b.track({ id: "kumoji", x0: h(256), x1: h(345), y0: h(60), y1: h(100), bounds: [h(240), KUMOJI_X1 + h(2)], keys: [
    { x: h(262), zoom: 1, anchor: 0.62, horizon: 0.4, lead: 0.06 },
    { x: KUMOJI_X1, zoom: 1, anchor: 0.62, horizon: 0.4, lead: 0.06 },
  ] });
  b.track({ id: "silk-line", x0: h(200), x1: h(266), y0: h(60), y1: h(205), when: "ride:silk-line", keys: [
    { x: SILK_LOW_X, zoom: 1, anchor: 0.62, horizon: 0.4, lead: 0 },
    { x: h(212), zoom: 0.72, anchor: 0.6, horizon: 0.42, lead: 0 },
    { x: h(240), zoom: 0.62, anchor: 0.55, horizon: 0.46, lead: 0 },
    { x: h(257), zoom: 0.5, anchor: 0.42, horizon: 0.5, lead: 0 },
  ] });
}
