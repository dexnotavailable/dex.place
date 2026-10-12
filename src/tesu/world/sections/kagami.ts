// Kagami 鏡, Mirrorlake, and the Western Pass (GDK A.3). The head of て's top line: an
// alpine plateau lake so still it holds a second sky, a plank jetty along its whole
// length, the catch near the jetty's east end. West, past the lake, the pass and the road
// that bends away into the far mountains (the world's west end).
//
// Terrain grammar: massif. Solid rock to the world floor; the lake sits on it.

import { h } from "../../config.ts";
import type { WorldBuilder } from "../build.ts";
import { PLANES, type PlaneId } from "../types.ts";
import { CATCH_X, DECK_Y, JETTY_X0, JETTY_X1, LAKE_X0, LAKE_X1, LAKE_Y } from "./common.ts";

/** A background piece placed by its plane px (x) and standing on 3D y (the lake by default). */
export function bg(b: WorldBuilder, plane: PlaneId, planeX: number, kind: string, p: Record<string, unknown>, y3 = LAKE_Y, z = 0): void {
  b.piece(plane, kind, planeX / PLANES[plane].rate, y3, p, { z });
}

export function kagami(b: WorldBuilder): void {
  // --- the ground: the pass, the west shore, the lake bed, the east lip, the cliffs
  const top = [
    h(0), h(59.2), h(5), h(59.0), h(9), h(58.6), h(14), h(58.5), h(19), h(59.0), h(25), h(59.9),
    h(31), h(60.9), h(36), h(61.6), h(40), h(62.1), h(43.6), h(62.25),
    // into the lake: a shelving shore, then the bed
    h(45), h(63.2), h(48), h(64.0), h(104), h(64.0), h(107.4), h(63.2), h(109.2), h(62.4),
  ];
  // the massif's east face goes down and back to the West Shore (map 540,348 ... 352,945)
  const bottom = [
    h(109.2), h(63.4), h(107.6), h(70), h(104), h(78), h(97), h(92), h(90.4), h(106), h(83), h(120),
    h(76), h(134), h(72.4), h(160), h(70.4), h(190), h(8), h(190), h(12), h(150), h(8), h(110), h(4), h(80), h(0), h(66),
  ];
  b.piece("play", "mass", 0, 0, { top, bottom, rock: "karst", cap: "moss", capH: 14, tufts: 0.7 }, { z: 0 });
  // collision: the pass and the west shore, then the jetty
  b.walk([h(0), h(59.2), h(5), h(59.0), h(9), h(58.6), h(14), h(58.5), h(19), h(59.0), h(25), h(59.9), h(31), h(60.9), h(36), h(61.6), h(40), h(62.1), h(44.1), h(62.25)],
    { surface: "grass", name: "kagami-west" });
  b.walk([JETTY_X0, DECK_Y, JETTY_X1, DECK_Y], { surface: "wood", depth: h(0.1), name: "jetty" });
  // the west end: the road bends away into the far mountains; she stops and turns back
  b.wall({ x: h(2.2), y0: h(50), y1: h(60), reason: "world-end", from: "right" });

  // the lake in cross-section (seen only from the wide frames) and its jetty
  b.piece("play", "waterBody", h(44.6), LAKE_Y, { w: h(63), depth: h(1.4) }, { z: 1, reflect: false });
  b.piece("play", "jetty", JETTY_X0, DECK_Y, { w: JETTY_X1 - JETTY_X0, water: LAKE_Y - DECK_Y }, { z: 2 });
  for (const [x, hh, rope] of [[h(52), 30, false], [h(71), 38, true], [h(88), 30, false], [CATCH_X - h(3.4), 44, true], [JETTY_X1 - h(0.4), 34, false]] as const) {
    b.piece("play", "moorPost", x, DECK_Y, { h: hh, down: LAKE_Y - DECK_Y, rope }, { z: 3 });
  }
  b.water({ y: LAKE_Y, x0: LAKE_X0, x1: LAKE_X1, fx0: h(-60), fx1: h(150), near: 1.9, far: 0.06, kind: "lake" });
  // nothing under the lake's surface to walk on: a fall there tugs her back
  b.void({ x0: LAKE_X0, x1: LAKE_X1, y: LAKE_Y + h(0.5), y1: h(66) });

  b.spawn({ id: "catch", x: CATCH_X, y: DECK_Y, facing: 1 });
  b.spawn({ id: "western-pass", x: h(12), y: h(58.5), facing: 1 });
  b.place({ id: "kagami", name: "Kagami", x0: 0, x1: JETTY_X1, title: "place", spawn: "catch" });

  // --- the sky and the land beyond the lake (P0 to P3)
  b.atmos({
    x: 0,
    sky: ["#7fa7c9", "#cfe0e8", "#eef4f2"],
    haze: "#e3edee",
    mist: 0.75,
    mistColour: "#f1f6f5",
    sun: [0.22, 0.12],
  });
  // sky plane: y is px above the horizon (the sky barely moves, 0.02 of the camera)
  const clouds: [number, number, number, number][] = [
    [-300, -230, 520, 70], [260, -150, 380, 54], [700, -260, 640, 86], [1180, -120, 420, 60], [1560, -210, 560, 74], [2100, -170, 480, 64],
  ];
  for (const [x, y, w, hh] of clouds) bg(b, "sky", x, "cloud", { w, h: hh }, LAKE_Y + y / PLANES.sky.rate, -1);

  // every background plane has ground below its line, so the land never shows a gap
  bg(b, "far", -2600, "plain", { w: 9000, foot: 700, ramp: "range", amp: 4 }, LAKE_Y, -5);
  bg(b, "mid", -4000, "plain", { w: 21000, foot: 560, ramp: "moss", amp: 8 }, LAKE_Y, -5);
  bg(b, "back", -6000, "plain", { w: 40000, foot: 520, ramp: "pine", amp: 10 }, LAKE_Y, -5);

  // P1: the far snow ranges standing on the far shore
  const ranges: [number, number, number, number][] = [
    [-2400, 1100, 260, 4], [-1400, 980, 250, 4], [-520, 1100, 330, 4], [440, 1180, 300, 5], [1500, 1040, 270, 4], [2400, 1200, 320, 5], [3500, 1100, 280, 4],
  ];
  ranges.forEach(([x, w, hh, peaks], i) => bg(b, "far", x, "range", { w, h: hh, peaks, snow: 0.55 }, LAKE_Y, i));

  // P2: karst towers along the far shore, jade and white like Wuling's lake
  const towers: [number, number, number][][] = [
    [[0, 70, 150], [60, 52, 210], [120, 64, 130]],
    [[0, 90, 250], [80, 60, 170]],
    [[0, 54, 120], [50, 80, 230], [130, 46, 150], [175, 66, 190]],
    [[0, 70, 160], [70, 58, 280]],
    [[0, 64, 140], [60, 90, 200], [150, 50, 120]],
  ];
  const towerX = [-1300, -820, 120, 900, 1700];
  towers.forEach((t, i) => bg(b, "mid", towerX[i]!, "towers", { t, green: 0.75 }, LAKE_Y, i));
  bg(b, "mid", -3000, "ridgeline", { w: 9000, h: 40, pines: 1.5, pineH: 26 }, LAKE_Y, -2);

  // P3: the near-back shore: pine ridges low over the water
  bg(b, "back", -4200, "ridgeline", { w: 5200, h: 70, pines: 2.5, pineH: 52 }, LAKE_Y, 0);
  bg(b, "back", 700, "ridgeline", { w: 5000, h: 90, pines: 3, pineH: 60 }, LAKE_Y, 1);
}
