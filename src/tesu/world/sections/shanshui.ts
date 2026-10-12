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

import { CHARM_PERCH, h } from "../../config.ts";
import { CAR } from "../../art/painters/shanshui.ts";
import type { WorldBuilder } from "../build.ts";
import { COURT_X1 } from "./court.ts";
import { QUAY_Y } from "./hoaipho.ts";
import { FLOOR_Y } from "./palace.ts";

/** The Kumo-bashi's flag: set when the lashing on the Kumoji side is cut (the lashing post broken). */
export const BRIDGE_FLAG = "broke:kumo-bashi-lashing";

/** Kumoji's level at its west end (the upper station), world px. */
export const KUMOJI_Y = h(79);
/** Where the cars dock: the low station on Hoài Phố's east quay, the high one at Kumoji's west end. */
export const SILK_LOW_X = h(204.1);
export const SILK_TOP_X = h(262.6);
/** From the cable down to a car's floor, px. */
export const SILK_HANG = CAR.hanger + CAR.h;
/** Kumoji's first stretch ends where Tsuji's street begins (sections/tsuji.ts). */
export const KUMOJI_X1 = h(362);
/** Tsuji's street level. */
export const TSUJI_Y = h(74.6);

/**
 * A stretch of rampart road on pillar tops (Kumoji): the walk, its band of masonry under it
 * (flat values) and the pillars that carry it down into the sea of mist, at these x (H) and
 * widths (H).
 */
export function rampart(b: WorldBuilder, road: number[], name: string, pillars: [number, number][]): (x: number) => number {
  b.walk(road, { surface: "stone", depth: h(2.6), name });
  const x0 = road[0]!, x1 = road[road.length - 2]!;
  const yAt = (x: number): number => {
    for (let i = 2; i < road.length; i += 2) if (x <= road[i]! || i === road.length - 2) return road[i - 1]! + ((x - road[i - 2]!) / (road[i]! - road[i - 2]!)) * (road[i + 1]! - road[i - 1]!);
    return road[1]!;
  };
  const bottom: number[] = [];
  for (let x = x1 + h(0.3); x >= x0 - h(0.3); x -= h(2)) bottom.push(x, yAt(Math.min(x1, Math.max(x0, x))) + h(2.6));
  b.piece("play", "mass", 0, 0, { top: [x0 - h(0.3), road[1]!, ...road.slice(2, -2), x1 + h(0.3), road[road.length - 1]!], bottom, rock: "stone", flat: true, deep: 0.62 }, { z: -1 });
  for (const [x, w] of pillars) {
    const top = yAt(Math.min(x1, Math.max(x0, h(x)))) + h(2.2);
    b.piece("play", "pillar", h(x), top, { w: h(w), h: h(226) - top }, { z: -2 });
  }
  return yAt;
}

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
  const road = [h(261.9), KUMOJI_Y, h(266.5), KUMOJI_Y, h(300), KUMOJI_Y - h(1.2), h(339.6), KUMOJI_Y - h(2.6), KUMOJI_X1, TSUJI_Y];
  const yAt = rampart(b, road, "kumoji", [[265, 4.4], [279, 3.8], [293, 4.6], [307, 3.6], [321, 4.2], [335, 4], [349, 3.8]]);
  // the station's edge: a rail where the cars come in from the open air (gone once the
  // Kumo-bashi is down: the bridge carries on from it); the road runs right up to it, so she
  // stops with her feet on the platform
  b.wall({ x: h(261.9), y0: KUMOJI_Y - h(6), y1: KUMOJI_Y + h(2.6), reason: "rail", from: "right", unless: BRIDGE_FLAG });
  b.sprite({ id: "kumoji-west-rail", plane: "front", kind: "rail", x: 0, y: 0, p: { pts: [h(261.5), KUMOJI_Y + 2, h(262.05), KUMOJI_Y + 2], h: 50, every: 46 }, frames: 1, unless: BRIDGE_FLAG });
  b.piece("play", "hut", h(265.6), yAt(h(265.6)), { w: 230, h: 190 }, { z: 0 });
  // (the road goes on east into Tsuji: sections/tsuji.ts)

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
    // (on east past Tsuji to the pavilion and the land's end)
    [384, 2.8, 92], [415, 4.2, 96], [431.5, 2.6, 84], [447, 5.4, 104], [468, 3.4, 88], [476, 2.2, 98],
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
    [389, 2.4, 70], [402, 5.6, 84], [420, 2.2, 66], [436, 3.0, 74], [452, 6.0, 90], [470, 2.6, 68], [488, 3.4, 78],
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

  kumoBashi(b);
  pillarHop(b);

  // --- the frames: Kumoji at play, the station end open to the drop; the ride pulls wide
  b.track({ id: "kumoji", x0: h(256), x1: KUMOJI_X1, y0: h(60), y1: h(100), bounds: [h(240), h(480)], keys: [
    { x: h(262), zoom: 1, anchor: 0.62, horizon: 0.4, lead: 0.06 },
    { x: KUMOJI_X1, zoom: 1, anchor: 0.62, horizon: 0.4, lead: 0.06 },
  ] });
  // the gap between the court and Kumoji (the bridge, the Pillar Hop): a little wide, looking ahead and down
  b.track({ id: "kumo-bashi", x0: COURT_X1 + h(1), x1: h(261.6), y0: h(50), y1: h(92), keys: [
    { x: COURT_X1 + h(1.5), zoom: 0.85, anchor: 0.42, horizon: 0.42, lead: 0.14 },
    { x: h(260), zoom: 0.85, anchor: 0.42, horizon: 0.42, lead: 0.14 },
  ] });
  b.track({ id: "silk-line", x0: h(200), x1: h(266), y0: h(60), y1: h(205), when: "ride:silk-line", keys: [
    { x: SILK_LOW_X, zoom: 1, anchor: 0.62, horizon: 0.4, lead: 0 },
    { x: h(212), zoom: 0.72, anchor: 0.6, horizon: 0.42, lead: 0 },
    { x: h(240), zoom: 0.62, anchor: 0.55, horizon: 0.46, lead: 0 },
    { x: h(257), zoom: 0.5, anchor: 0.42, horizon: 0.5, lead: 0 },
  ] });
}

// --- the Kumo-bashi: a rope bridge from the Prize Court's tip to Kumoji (GDK B, a shortcut
// that opens from its far side). Until it is cut loose it hangs rolled up at Kumoji's west edge,
// lashed to a post; break the post (an attack) and the deck drops across the gap, Kumoji end
// first, and lies on as a one-way deck: walked both ways, dropped through anywhere (the Prow
// Leap is still a drop through it at the tip).

/** The bridge's deck: from the Prow Leap's plank end down across the gap to Kumoji's edge, sagging a little. */
export const BRIDGE_X0 = COURT_X1 + h(1.4);
export const BRIDGE_X1 = h(261.9);
export function bridgeY(x: number): number {
  const t = Math.max(0, Math.min(1, (x - BRIDGE_X0) / (BRIDGE_X1 - BRIDGE_X0)));
  return FLOOR_Y + (KUMOJI_Y - FLOOR_Y) * t + h(1.2) * 4 * t * (1 - t);
}

function kumoBashi(b: WorldBuilder): void {
  const n = 24;
  const deck: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = BRIDGE_X0 + ((BRIDGE_X1 - BRIDGE_X0) * i) / n;
    deck.push(x, bridgeY(x));
  }
  b.walk(deck, { surface: "wood", oneWay: true, name: "kumo-bashi", when: BRIDGE_FLAG });
  // the deck in eight stretches, dropping into place from the Kumoji end
  for (let k = 0; k < 8; k++) {
    const pts = deck.slice(k * 6, k * 6 + 8);
    const ax = pts[0]!, ay = pts[1]!;
    const local = pts.map((v, i) => (i % 2 === 0 ? v - ax : v - ay));
    b.sprite({ id: `kumo-bashi-${k}`, plane: "play", kind: "ropebridge", x: ax, y: ay, p: { part: "deck", pts: local }, frames: 1, when: BRIDGE_FLAG, delay: (7 - k) * 7 });
  }
  // rolled up at Kumoji's edge, lashed to its post
  b.sprite({ id: "kumo-bashi-rolled", plane: "play", kind: "ropebridge", x: BRIDGE_X1, y: KUMOJI_Y, p: { part: "rolled", tie: [Math.round(h(263.95) - BRIDGE_X1), -Math.round(h(0.45))] }, frames: 1, unless: BRIDGE_FLAG });
  b.prop({ id: "kumo-bashi-lashing", kind: "lashing", p: { h: 54 }, x: h(263.95), y: KUMOJI_Y, cls: "permanent", material: "wood", hp: 1, pieces: 4 });
  // from the court's side, until then: the anchor rings and a frayed end
  b.usable({ id: "kumo-bashi-anchor", x0: COURT_X1 - h(0.2), y0: FLOOR_Y - h(1.6), x1: BRIDGE_X0, y1: FLOOR_Y, label: "the bridge's anchor", unless: BRIDGE_FLAG, action: { kind: "say", text: "Two anchor rings and a frayed rope end. The Kumo-bashi is rolled up on the far side, at Kumoji." } });
}

// --- the Pillar Hop: pillar tops across the gap with paper charms strung between them (GDK
// A.3): Q at a charm ahead warps her to it, she hangs from it a moment, then jumps on (with the
// double jump and the air dash) or warps to the next. Every gap needs its charms; a miss falls
// into the sea of mist and the talisman tugs her back to the last pillar.

/** The pillars: [x0, x1, top] in H (each top a little over 2 H under the bridge's deck). */
export const HOP_PILLARS: [number, number, number][] = [
  [205.2, 207.6, 64.4], [215.1, 217.5, 68.0], [225.0, 227.4, 71.3], [235.1, 237.5, 74.5], [245.2, 247.6, 77.4],
];
/** The charms: [x, where her feet hang] in H, two from the court's tip, one per gap, two to Kumoji. */
export const HOP_CHARMS: [number, number][] = [
  [198.6, 60.6], [203.0, 63.6], [212.7, 67.4], [222.6, 70.7], [232.5, 73.9], [242.6, 76.8], [252.8, 78.6], [259.4, 80.0],
];

function pillarHop(b: WorldBuilder): void {
  HOP_PILLARS.forEach(([x0, x1, top], i) => {
    b.walk([h(x0), h(top), h(x1), h(top)], { surface: "stone", depth: h(226) - h(top), name: `hop-${i + 1}` });
    b.piece("play", "pillar", h((x0 + x1) / 2), h(top), { w: h(x1 - x0), h: h(226) - h(top) }, { z: -2 });
  });
  // the charms on lines strung from pillar top to pillar top (from the plank's end, to Kumoji's edge)
  const tops = HOP_CHARMS.map(([x, feet]) => [h(x), h(feet) - CHARM_PERCH - h(0.4)] as const);
  HOP_CHARMS.forEach(([x, feet], i) => {
    b.charm({ id: `charm-${i + 1}`, x: h(x), y: h(feet) - CHARM_PERCH });
    b.sprite({ id: `charm-${i + 1}`, plane: "play", kind: "charm", x: tops[i]![0], y: tops[i]![1], p: {}, frames: 3, frame: 0 });
  });
  const P = HOP_PILLARS.map(([x0, x1, top]) => [h(x0), h(x1), h(top) - h(0.15)] as const);
  const lines: number[][] = [
    [BRIDGE_X0, FLOOR_Y - h(0.3), ...tops[0]!, ...tops[1]!, P[0]![0], P[0]![2]],
    [P[0]![1], P[0]![2], ...tops[2]!, P[1]![0], P[1]![2]],
    [P[1]![1], P[1]![2], ...tops[3]!, P[2]![0], P[2]![2]],
    [P[2]![1], P[2]![2], ...tops[4]!, P[3]![0], P[3]![2]],
    [P[3]![1], P[3]![2], ...tops[5]!, P[4]![0], P[4]![2]],
    [P[4]![1], P[4]![2], ...tops[6]!, ...tops[7]!, BRIDGE_X1, KUMOJI_Y + h(0.3)],
  ];
  for (const pts of lines) b.piece("play", "ropecable", 0, 0, { pts }, { z: 5 });
  b.spawn({ id: "pillar-hop", x: COURT_X1 + h(1), y: FLOOR_Y, facing: 1 });
}
