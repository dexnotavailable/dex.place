// Kagami's rock (art: the Kagami art loop, painter p2 from round 3): the plateau rock the lake
// lies on (the Western Pass, the west shore, the east lip), the far headland past the lake's west
// end, the fallen blocks where the lake ends against the east lip, and the spring that drains it.
// (The lake's near shore is in kagami-land.ts; the islets are in kagami-islets.ts.)

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { LAKE_Y } from "./common.ts";
import { bg } from "./kagami-place.ts";

/** The plateau rock and its spring (seed block 1). */
export function kagamiRock(b: WorldBuilder): void {
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
  b.piece("play", "op.shore", h(39), LAKE_Y, { w: h(8.2), end: h(6.9), walk: [...wl(h(31), h(60.9)), ...wl(h(36), h(61.6)), ...wl(h(40), h(62.1)), ...wl(h(44.1), h(62.25)), ...wl(h(46), h(62.6))] }, { z: 1, seed: 7919 * 3010 });
  // past the water's west end, the far shore (P3): the massif's wooded foot shelving into the lake
  bg(b, "back", 1300, "op.headland", { w: 1100, h: 300 }, LAKE_Y, 1, 7919 * 3011);
  // where the lake runs out against the east lip (front plane, in front of the near water): fallen
  // blocks heaped in the shallows, spreading toward the camera, so the water's end never shows
  // as a ruled edge in front of the rock (pullback, jetty-6s, play-catch, play-east); P5's east
  // corner takes over below it
  // (round 5: the chain runs further toward the camera, so the cliff face under the lake's end never
  // shows as a pale wedge with a ruled side below the blocks)
  b.piece("front", "op.scree", h(109.25), LAKE_Y, { w: 140, deep: 128, h: 30 }, { z: 0, seed: 7919 * 3020 });
  // (round 5, the critic's "teal triangle", fourth round) the east lip behind the jetty's end: a
  // stack of chunks standing in the lake where it runs out against Shiraito's wall, the wall's
  // first veil pouring down a gully in it into the falls' pool at its foot (behind the station,
  // the great pine and the road's rock), so the lake's end never shows as a flat polygon with a
  // ruled diagonal against the wall's foot
  b.piece("play", "op.pool", h(107.2), LAKE_Y, { w: h(3.35), h: 186 }, { z: -1, seed: 7919 * 3022 });
  // (round 6, the critic's P3, catch's right edge, fourth round) at the foot of Shiraito's wall where
  // it meets the lake (back plane, in front of the wall's west end and behind its falls' spray): a
  // stack of chunks standing in the water, tall against the wall and stepping down to the west, so
  // the wall's end is no column with a ruled base and the lake's end no smooth diagonal there
  bg(b, "back", 6418, "op.heap", {
    w: 180,
    plan: [
      [0.6, 1.08, 84, 0.3], [0.28, 0.64, 54, 0.4], [-0.02, 0.32, 40, 0.36],
      [0.66, 0.97, 44, 0.78], [0.4, 0.7, 30, 0.86], [0.14, 0.44, 21, 0.9], [-0.1, 0.17, 13, 0.84],
      [-0.3, -0.16, 7, 0.9],
    ],
    haze: 0.32,
  }, LAKE_Y, 2.5, 7919 * 3024);
  // Kagami's spring: the lake drains through the karst and bursts from the cliff below it
  b.piece("play", "op.spring", h(97), h(65.4), { mw: 80, mh: 50, w: 44, drop: h(11) }, { z: 1, reflect: false });
  // its flow (12 fps over four frames)
  b.sprite({ id: "kagami-spring-flow", plane: "play", kind: "op.spring", x: h(97), y: h(65.4), p: { mw: 80, mh: 50, w: 44, drop: h(11), fallOnly: true }, frames: 4, fps: 12, reflect: false });
}
