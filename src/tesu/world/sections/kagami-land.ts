// Kagami's land (art: the Kagami art loop, painter p3): the plateau rock the lake lies on (the
// Western Pass, the west shore, the east lip), the spring that drains it, the lake's near shore
// on P5 with its reed beds, and the islets in the middle distance (P3).

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES } from "../types.ts";
import { bankTopAt, reedBeds, type BankP, type MassSpec } from "../../art/library/opening/bank.ts";
import { LAKE_Y } from "./common.ts";
import { bg } from "./kagami-place.ts";

/** The plateau rock and its spring (seed block 1). */
export function kagamiLand(b: WorldBuilder): void {
  // --- the ground: the pass, the west shore, the plateau the lake lies on, the east lip
  // (art: env-opening). The lake rests on the plateau: under its surface the rock's top sits
  // just below the waterline, so the wide frames show the plateau's cliff below the near shore
  // (never a cross-section of water). The east face drops into Shiraito's valley mist.
  // (The top's points from h(0) to h(43.6) are the walk line of kagami.ts: keep them exact.)
  const top = [
    h(0), h(59.2), h(5), h(59.0), h(9), h(58.6), h(14), h(58.5), h(19), h(59.0), h(25), h(59.9),
    h(31), h(60.9), h(36), h(61.6), h(40), h(62.1), h(43.6), h(62.25),
    // the shore shelves under the water, the plateau's rim just below the lake, the east lip
    h(45), h(62.75), h(48), h(62.85), h(104), h(62.85), h(107.4), h(62.7), h(109.2), h(62.4),
  ];
  // the massif's east face goes down and back to the West Shore (map 540,348 ... 352,945)
  const bottom = [
    h(109.6), h(63.6), h(108.9), h(66.5), h(107.6), h(70), h(104), h(78), h(97), h(92), h(90.4), h(106), h(83), h(120),
    h(76), h(134), h(72.4), h(160), h(70.4), h(190), h(8), h(190), h(12), h(150), h(8), h(110), h(4), h(80), h(0), h(66),
  ];
  b.piece("play", "op.rock", 0, 0, { top, bottom, cap: "grass", capH: 12, rough: 14, teeth: 0.5, veg: 0.75, shade: 0.2, fadeY: h(72), fadeH: h(9), water: h(62.6) - h(0), joinL: h(1), giant: h(13), forest: [h(3.2), h(7.5)] }, { z: 0 });
  // the west shore where the jetty leaves it (play-west): limestone steps going down from the
  // walk line to the water, mud and pebbles, sunk stones, a fallen trunk (in front of the rock;
  // the walk line itself is the rock's and stays exact)
  const wl = (x: number, y: number): number[] => [x - h(39), LAKE_Y - y];
  b.piece("play", "op.shore", h(39), LAKE_Y, { w: h(7), end: h(5.6), walk: [...wl(h(31), h(60.9)), ...wl(h(36), h(61.6)), ...wl(h(40), h(62.1)), ...wl(h(44.1), h(62.25)), ...wl(h(46), h(62.6))] }, { z: 1, seed: 7919 * 3010 });
  // past the water's west end, the far shore (P3): the massif's wooded foot shelving into the lake
  bg(b, "back", 1300, "op.headland", { w: 1100, h: 300 }, LAKE_Y, 1, 7919 * 3011);
  // Kagami's spring: the lake drains through the karst and bursts from the cliff below it
  b.piece("play", "op.spring", h(97), h(65.4), { mw: 80, mh: 50, w: 44, drop: h(11) }, { z: 1, reflect: false });
  // its flow (12 fps over four frames)
  b.sprite({ id: "kagami-spring-flow", plane: "play", kind: "op.spring", x: h(97), y: h(65.4), p: { mw: 80, mh: 50, w: 44, drop: h(11), fallOnly: true }, frames: 4, fps: 12, reflect: false });
}

/**
 * P5, the lake's near shore: separate dark masses that frame the bottom of every lake frame,
 * low wet ground between them where the lake comes up to the camera. Placed by the shore's own
 * px (0 at 38 H; near-plane px are 1.35 x world px), composed for the key frames: play-west sees
 * 517..2437, play-walker 5183..7103, play-catch 7256..9176, the catch (2x, when the near plane
 * shows there) 7560..8520 with her at 8035, pullback 7789..9214, jetty-6s 8208..10201, play-east
 * 8034..9954, the postcard 5779..10291. Each mass stays under a quarter of the frame it is seen
 * in and tops out below the deck line on screen. (seed block 3; explicit seeds 7919 x 3000 on)
 */
export const NEAR_MASSES: MassSpec[] = [
  // the west end: the shore turns, a crag's face drops away
  { kind: "crag", x: -80, w: 380, h: 130, drop: -1 },
  // play-west: the jetty leaves the west shore
  { kind: "hummock", x: 560, w: 400, h: 120 },
  { kind: "reeds", x: 975, w: 230, h: 36, reed: 118, dense: 3.4 },
  { kind: "tuft", x: 1230, w: 100, h: 26 },
  { kind: "boulder", x: 1500, w: 270, h: 112 },
  { kind: "reeds", x: 1760, w: 170, h: 24, reed: 84, dense: 2.6 },
  { kind: "reeds", x: 2010, w: 70, h: 8, reed: 44, dense: 2.2 },
  { kind: "hummock", x: 2140, w: 360, h: 96 },
  // along the lake
  { kind: "reeds", x: 2560, w: 220, h: 30, reed: 100, dense: 3 },
  { kind: "boulder", x: 2800, w: 220, h: 84 },
  { kind: "hummock", x: 3380, w: 440, h: 110 },
  { kind: "tuft", x: 3840, w: 100, h: 22 },
  { kind: "reeds", x: 4180, w: 280, h: 38, reed: 130, dense: 3.8 },
  { kind: "boulder", x: 4480, w: 320, h: 130 },
  { kind: "tuft", x: 4820, w: 140, h: 24 },
  // play-walker and the postcard's left edge
  { kind: "reeds", x: 5150, w: 240, h: 32, reed: 108, dense: 3 },
  { kind: "hummock", x: 5520, w: 380, h: 132 },
  { kind: "boulder", x: 5880, w: 240, h: 118 },
  { kind: "tuft", x: 6130, w: 90, h: 22 },
  { kind: "reeds", x: 6440, w: 210, h: 34, reed: 124, dense: 3.2 },
  { kind: "tuft", x: 6660, w: 110, h: 22 },
  { kind: "reeds", x: 6930, w: 80, h: 10, reed: 54, dense: 2.4 },
  { kind: "hummock", x: 7080, w: 330, h: 86 },
  // the catch: a reed hummock in the bottom-left corner, a low grassy hummock in the
  // bottom-right, the middle below her open; in the pull-back that low hummock is the grass
  // crossing the foot of her reflection, the old lantern stands off to the right
  { kind: "hummock", x: 7360, w: 330, h: 108 },
  { kind: "reeds", x: 7440, w: 290, h: 40, reed: 150, dense: 3.6 },
  { kind: "tuft", x: 7740, w: 140, h: 34 },
  { kind: "hummock", x: 8300, w: 260, h: 58 },
  { kind: "lantern", x: 8600, w: 240, h: 136 },
  { kind: "tuft", x: 8850, w: 120, h: 26 },
  // the east end: a rocky corner rising in front of the lip's foot, a low ledge running on
  // past it, its face dropping away off the bottom of the frame
  { kind: "boulder", x: 9000, w: 210, h: 104 },
  { kind: "crag", x: 9150, w: 520, h: 150 },
  { kind: "crag", x: 9640, w: 290, h: 104 },
  { kind: "crag", x: 9900, w: 460, h: 236, drop: 1 },
];

/** The lake's near shore on P5 and its reed beds (seed block 3). */
export function kagamiNear(b: WorldBuilder): void {
  const bankP: BankP = { w: 10500, h: 290, masses: NEAR_MASSES };
  const bank = b.piece("near", "op.bank", h(38), LAKE_Y, bankP as unknown as Record<string, unknown>, { z: 1, reflect: false, seed: 7919 * 3000 });
  // its reed beds sway in the wind (6 fps over 8 frames, a gust running along the shore)
  reedBeds(bankP, bank.seed).forEach(([x, w, hh, dense], i) => {
    const ground: number[] = [];
    for (let gx = 0; gx <= w; gx += 8) ground.push(Math.max(0, Math.round(bankTopAt(bankP, bank.seed, x + gx) - 3)));
    b.sprite({ id: `bank-reeds-${i}`, plane: "near", kind: "op.reeds", x: h(38) + x / PLANES.near.rate, y: LAKE_Y + 1 / PLANES.near.rate, p: { w: Math.round(w), h: Math.round(hh), density: dense, ox: Math.round(x), ground, loop: 8 }, frames: 8, fps: 6, reflect: false, seed: 7919 * (3001 + i) });
  });
}

/**
 * The islets in the middle distance of the lake (P3, seed block 6; explicit seeds 7919 x 3100
 * on): four different places, so the mirror stays open between them. Back-plane px: play-west
 * sees 1980..3900, play-walker 4123..6043, play-catch 5075..6995, the catch 5292..6616 (1.45x),
 * jetty-6s 5512..7465, play-east 5432..7352, the postcard 4397..7507 (0.62x).
 */
export function kagamiIslets(b: WorldBuilder): void {
  // a reed bed round a small stone lantern (play-west, under the Walker)
  bg(b, "back", 3560, "op.islet", { kind: "reedbed", w: 170, h: 9 }, LAKE_Y, 0, 7919 * 3100);
  // a ruined pile field: old posts of different heights, one broken, a fallen beam (play-walker,
  // in front of the Walker's reflection; the postcard's left edge)
  bg(b, "back", 4420, "op.islet", { kind: "piles", w: 150, h: 12 }, LAKE_Y, 1, 7919 * 3101);
  // a jagged rock with a twisted pine leaning out over the water (play-walker's right, play-catch's
  // left, cut by the catch's left edge)
  bg(b, "back", 5330, "op.islet", { kind: "crag", w: 110, h: 62, dir: 1 }, LAKE_Y, 2, 7919 * 3102);
  // the small torii in the shallows: in the catch's right third (x 1325-1411), clear of her; in
  // jetty-6s (682-742) and play-east (774-834) west of the lift's top station (106.8-108 H),
  // never behind it
  bg(b, "back", 6230, "op.islet", { kind: "torii", w: 96, h: 13 }, LAKE_Y, 3, 7919 * 3103);
}
