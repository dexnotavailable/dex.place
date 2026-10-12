// Tsuji 辻, the Chain Stair and the Peak, Kumoji's east stretch and the East Pavilion (GDK A.3,
// Shanshui; the clock's 5:40 to 7:20). Layout and systems first, neutral stand-ins (flat values,
// simple silhouettes) for the region's owner to dress later.
//
// - Tsuji: the post town where す's crossbar meets its vertical: a street of houses on the
//   rampart, a rest shrine at the crossroads, the bamboo flume's dry mouth and the Sky Well lift's
//   top station (both shortcuts that open from their far ends, later), and the needle.
// - The Chain Stair: switchback flights cut up the needle's face from the street (hop onto the
//   first step) to the Peak, a summit shrine on its top, the highest walkable point. Going down,
//   each landing leads on down the next flight.
// - Kumoji's east stretch on to the East Pavilion: a viewing pavilion wrapped round a lone pillar,
//   its galleries stacked up its sides, reached by a plank bridge; the kite station at its top
//   (the Kite Line to the Peak comes later).

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { KUMOJI_X1, TSUJI_Y, rampart } from "./shanshui.ts";
import { ringTop } from "./yuemen.ts";

/** Tsuji's street, and where Kumoji goes on east of it. */
export const TSUJI_X1 = h(410);
/** The needle (the vertical's top): its sides, and the Peak on its top. */
export const NEEDLE_X0 = h(367.6), NEEDLE_X1 = h(376.4);
export const PEAK_Y = h(31.6);
/** The East Pavilion's lone pillar, and the bridge's ends. */
const PAV_X0 = h(454.4), PAV_X1 = h(462.4), PAV_Y = h(71.4);

export function tsuji(b: WorldBuilder): void {
  // --- the street
  const yT = rampart(b, [KUMOJI_X1, TSUJI_Y, TSUJI_X1, TSUJI_Y], "tsuji", [[386, 4.2], [399, 3.6]]);
  for (const [x, w, hh] of [[h(381.2), 170, 150], [h(392.6), 190, 160], [h(397.8), 150, 140], [h(402.6), 170, 150]] as const) b.piece("play", "hut", x, yT(x), { w, h: hh }, { z: 0 });
  b.piece("play", "canopy", h(380), TSUJI_Y, { w: h(26), h: h(2.4) }, { z: 3 });
  for (const x of [h(383), h(388), h(395), h(401)]) b.piece("play", "hanglantern", x, TSUJI_Y - h(2.5), { drop: 10, r: 13 }, { z: 4 });
  b.usable({ id: "tsuji-shrine", x0: h(386.6), y0: TSUJI_Y - h(1.6), x1: h(388.2), y1: TSUJI_Y, label: "the rest shrine", action: { kind: "say", text: "A rest shrine at the crossroads: a bench, a bell, a bowl of rainwater. You sit a moment and catch your breath." } });
  b.piece("play", "hut", h(387.4), TSUJI_Y, { w: 120, h: 96 }, { z: 1 });
  // the bamboo flume's mouth: the way down to Yuemen, one way (sections/yuemen.ts)
  b.usable({ id: "tsuji-flume", x0: h(378.8), y0: TSUJI_Y - h(1.4), x1: h(380.4), y1: TSUJI_Y, label: "ride the flume down", action: { kind: "ride", ride: "flume", dir: 1 } });
  b.piece("play", "hut", h(405.2), TSUJI_Y, { w: 200, h: 170 }, { z: 0 });
  b.usable({ id: "skywell-lift-top", x0: h(404.2), y0: TSUJI_Y - h(1.8), x1: h(406.2), y1: TSUJI_Y, label: "the Sky Well lift", action: { kind: "say", text: "The Sky Well lift's cage is down at the bottom of the well, chained. It opens from the floor." } });
  b.spawn({ id: "tsuji", x: h(390), y: TSUJI_Y, facing: 1 });
  b.place({ id: "tsuji", name: "Tsuji", x0: KUMOJI_X1 + h(2), x1: TSUJI_X1, y0: h(66), y1: h(90), title: "place", spawn: "tsuji" });

  chainStair(b);
  eastward(b);

  // --- the frames: the town narrow at play zoom; the stair a little wide, looking up the needle
  b.track({ id: "tsuji", x0: KUMOJI_X1, x1: TSUJI_X1, y0: h(70), y1: h(100), bounds: [h(240), h(480)], keys: [
    { x: KUMOJI_X1, zoom: 1, anchor: 0.66, horizon: 0.38, lead: 0.06 },
    { x: TSUJI_X1, zoom: 1, anchor: 0.66, horizon: 0.38, lead: 0.06 },
  ] });
  b.track({ id: "chain-stair", x0: NEEDLE_X0 - h(3), x1: NEEDLE_X1 + h(3), y0: h(25), y1: TSUJI_Y - h(0.8), keys: [
    { x: NEEDLE_X0 - h(3), zoom: 0.78, anchor: 0.55, horizon: 0.4, lead: 0, fixX: (NEEDLE_X0 + NEEDLE_X1) / 2 },
    { x: NEEDLE_X1 + h(3), zoom: 0.78, anchor: 0.55, horizon: 0.4, lead: 0, fixX: (NEEDLE_X0 + NEEDLE_X1) / 2 },
  ] });
}

/** The Chain Stair: [x of the foot, y of the foot, x of the top, y of the top] for each flight, in px. */
export function chainFlights(): [number, number, number, number][] {
  const n = 6, rise = (TSUJI_Y - PEAK_Y) / n;
  const out: [number, number, number, number][] = [];
  for (let k = 0; k < n; k++) {
    const y0 = TSUJI_Y - rise * k, y1 = y0 - rise;
    // odd flights rise to the right from the needle's left side, even ones back to the left;
    // the first step is a hop above the street (passers-by walk on under it); each later foot
    // sits a hair above its landing so the way down passes it
    const lift = k === 0 ? h(0.3) : h(0.02);
    out.push(k % 2 === 0 ? [h(368), y0 - lift, h(375.6), y1] : [h(376), y0 - lift, h(368.4), y1]);
  }
  return out;
}

function chainStair(b: WorldBuilder): void {
  // the needle: a tall pillar standing on Yuemen's ring up to the Peak, the street passing in front
  b.piece("play", "pillar", (NEEDLE_X0 + NEEDLE_X1) / 2, PEAK_Y, { w: NEEDLE_X1 - NEEDLE_X0, h: ringTop(NEEDLE_X0) + h(1.5) - PEAK_Y }, { z: -3 });
  const flights = chainFlights();
  flights.forEach(([fx, fy, tx, ty], k) => {
    const pts = fx < tx ? [fx, fy, tx, ty] : [tx, ty, fx, fy];
    b.walk(pts, { surface: "stone", stair: true, name: `chain-stair-${k + 1}` });
    b.piece("play", "boardwalk", 0, 0, { pts }, { z: 2 });
    if (k === flights.length - 1) return;
    // the landing at its top, a rail on its outer side
    const right = tx > fx;
    const lx0 = right ? h(375.6) : h(367.6), lx1 = right ? h(376.4) : h(368.4);
    b.walk([lx0, ty, lx1, ty], { surface: "wood", oneWay: true, name: `chain-landing-${k + 1}` });
    b.piece("play", "plank", lx0 - h(0.05), ty, { w: lx1 - lx0 + h(0.1) }, { z: 2 });
    b.wall(right ? { x: lx1 + h(0.05), y0: ty - h(3), y1: ty + h(0.1), reason: "rail", from: "left" } : { x: lx0 - h(0.05), y0: ty - h(3), y1: ty + h(0.1), reason: "rail", from: "right" });
    b.piece("front", "rail", 0, 0, { pts: right ? [lx1 - h(0.25), ty + 2, lx1 + h(0.05), ty + 2] : [lx0 - h(0.05), ty + 2, lx0 + h(0.25), ty + 2], h: 46, every: 30 }, { z: 1 });
  });
  // the Peak: a small summit ledge where the last flight comes out, the shrine on it
  b.walk([h(366.4), PEAK_Y, h(368.4), PEAK_Y], { surface: "stone", oneWay: true, name: "the-peak" });
  b.wall({ x: h(366.35), y0: PEAK_Y - h(3), y1: PEAK_Y + h(0.1), reason: "rail", from: "right" });
  b.piece("front", "rail", 0, 0, { pts: [h(366.3), PEAK_Y + 2, h(366.7), PEAK_Y + 2], h: 46, every: 30 }, { z: 1 });
  b.piece("play", "hut", h(367.3), PEAK_Y, { w: 100, h: 84 }, { z: 1 });
  b.usable({ id: "peak-shrine", x0: h(366.6), y0: PEAK_Y - h(1.4), x1: h(368.0), y1: PEAK_Y, label: "the summit shrine", action: { kind: "say", text: "The summit shrine on the needle: a bell rope, a bowl of coins, the whole land below. Beside it the Kite Line's post, its line strung down to the East Pavilion." } });
  b.spawn({ id: "the-peak", x: h(367.6), y: PEAK_Y, facing: 1 });
  b.place({ id: "the-peak", name: "The Peak", x0: h(366), x1: h(378), y0: h(25), y1: h(36), title: "place", spawn: "the-peak" });
}

function eastward(b: WorldBuilder): void {
  // --- Kumoji's east stretch, rising gently to the pavilion's bridge
  const yE = rampart(b, [TSUJI_X1, TSUJI_Y, h(430), TSUJI_Y - h(1.4), h(448), h(71.6)], "kumoji-east", [[416, 4.0], [429, 3.6], [442, 4.4]]);
  void yE;
  // the plank bridge to the pavilion (a gap below, the sea of mist)
  b.walk([h(448), h(71.6), PAV_X0, PAV_Y], { surface: "wood", oneWay: true, name: "pavilion-bridge" });
  b.piece("play", "boardwalk", 0, 0, { pts: [h(448), h(71.6) - 1, PAV_X0, PAV_Y - 1] }, { z: 2 });
  // --- the East Pavilion: galleries stacked up a lone pillar, stairs zigzagging between them
  // (each flight comes out on a small landing at a side, never under a floor, so the way down
  // leads on too: up the east side, back west, up east to the top gallery and the kite station)
  const floors = [PAV_Y, h(67.0), h(62.6), h(58.2)];
  const crown = h(54.4);
  b.piece("play", "pillar", (PAV_X0 + PAV_X1) / 2, crown, { w: PAV_X1 - PAV_X0 - h(1.4), h: h(226) - crown, crown: true }, { z: -2 });
  b.walk([PAV_X0, PAV_Y, PAV_X1, PAV_Y], { surface: "wood", depth: h(1), name: "pavilion-1" });
  b.wall({ x: PAV_X1 + h(0.05), y0: crown - h(2), y1: PAV_Y + h(1), reason: "rail", from: "left" });
  floors.forEach((y, i) => b.piece("play", "canopy", PAV_X0 - h(0.4), y, { w: PAV_X1 - PAV_X0 + h(0.8), h: h(i === floors.length - 1 ? 2.6 : 2.2) }, { z: 3 }));
  const flights: [number[], number[]][] = [
    // [the flight (x increasing), the landing at its top]
    [[h(455.0), floors[0]! - h(0.02), h(461.6), floors[1]!], [h(461.6), floors[1]!, PAV_X1, floors[1]!]],
    [[h(455.4), floors[2]!, h(462.0), floors[1]! - h(0.02)], [PAV_X0, floors[2]!, h(455.4), floors[2]!]],
    [[h(455.0), floors[2]! - h(0.02), h(459.4), floors[3]!], [h(459.4), floors[3]!, PAV_X1, floors[3]!]],
  ];
  flights.forEach(([pts, landing], i) => {
    b.walk(pts, { surface: "wood", stair: true, name: `pavilion-stair-${i + 1}` });
    b.piece("play", "boardwalk", 0, 0, { pts }, { z: 1 });
    b.walk(landing, { surface: "wood", oneWay: true, name: `pavilion-${i + 2}` });
    b.piece("play", "plank", landing[0]! - h(0.05), landing[1]!, { w: landing[2]! - landing[0]! + h(0.1) }, { z: 2 });
  });
  b.wall({ x: PAV_X0 - h(0.05), y0: floors[2]! - h(3), y1: floors[2]! + h(0.1), reason: "rail", from: "right" });
  // --- the Kite Line: a big kite on its line from the kite station up over the land to the
  // Peak, one way, about 22 s; it waits at the station again after
  b.usable({ id: "kite-station", x0: PAV_X1 - h(2.6), y0: floors[3]! - h(1.6), x1: PAV_X1 - h(0.4), y1: floors[3]!, label: "fly the Kite Line", action: { kind: "ride", ride: "kite-line", dir: 1 } });
  const kh = h(1.1);
  const kp: number[] = [];
  const K = [h(461.0), floors[3]! - kh, h(452), h(38), h(410), h(20), h(367.4), PEAK_Y - kh];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 1 - t;
    kp.push(u * u * u * K[0]! + 3 * u * u * t * K[2]! + 3 * u * t * t * K[4]! + t * t * t * K[6]!, u * u * u * K[1]! + 3 * u * u * t * K[3]! + 3 * u * t * t * K[5]! + t * t * t * K[7]!);
  }
  b.sprite({ id: "kite", plane: "play", kind: "kite", x: kp[0]!, y: kp[1]!, p: {}, frames: 1 });
  b.ride({ id: "kite-line", pts: kp, secs: 22, cars: ["kite"], hang: kh, oneWay: true, top: { x: h(372), y: PEAK_Y, anchor: 0.42, secs: 4 } });
  b.track({ id: "kite-line", x0: h(362), x1: h(464), y0: h(14), y1: h(62), when: "ride:kite-line", keys: [
    { x: h(362), zoom: 0.62, anchor: 0.5, horizon: 0.42, lead: -0.06 },
    { x: h(464), zoom: 0.62, anchor: 0.5, horizon: 0.42, lead: -0.06 },
  ] });
  b.spawn({ id: "east-pavilion", x: h(446), y: h(71.8), facing: 1 });
  b.place({ id: "east-pavilion", name: "East Pavilion", x0: h(447), x1: PAV_X1, y0: h(50), y1: h(80), title: "place", spawn: "east-pavilion" });
  // framed from low on its bridge: the bridge leads in, the pavilion rises out of the top edge
  b.track({ id: "kumoji-east", x0: TSUJI_X1, x1: PAV_X1 + h(2), y0: h(50), y1: h(90), bounds: [h(240), h(480)], keys: [
    { x: TSUJI_X1, zoom: 1, anchor: 0.62, horizon: 0.4, lead: 0.06 },
    { x: h(440), zoom: 1, anchor: 0.62, horizon: 0.4, lead: 0.06 },
    { x: h(449), zoom: 0.82, anchor: 0.84, horizon: 0.46, lead: 0, fixX: h(453.5) },
    { x: PAV_X1, zoom: 0.82, anchor: 0.7, horizon: 0.46, lead: 0, fixX: h(456.5) },
  ] });
}
