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

/** A drifting sprite on a background plane, placed by plane px (x, and dy above the lake line), wrapping over plane px. */
function drifting(b: WorldBuilder, id: string, plane: PlaneId, kind: string, planeX: number, planeDy: number, p: Record<string, unknown>, wrap: [number, number], drift: number, fps: number, frames = 4): void {
  const r = PLANES[plane].rate;
  b.sprite({ id, plane, kind, x: planeX / r, y: LAKE_Y + planeDy / r, p, frames, fps, path: [wrap[0] / r, wrap[1] / r], drift, reflect: true });
}

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
  // ripple rings opening round the posts that stand in the lake (env-sky lane)
  for (const x of [h(52), h(71), h(88), CATCH_X - h(3.4), JETTY_X1 - h(0.4)]) {
    b.sprite({ id: `ripple-${Math.round(x)}`, plane: "front", kind: "sky.ripple", x, y: LAKE_Y, p: { rx: 26, rings: 3 }, frames: 8, fps: 8, reflect: false });
  }
  // a moored boat beside the jetty, a coil of rope and a bucket on the deck
  b.piece("play", "boat", h(91.5), LAKE_Y + 2, { w: h(2.6) }, { z: 1 });
  b.piece("play", "coil", CATCH_X - h(2.6), DECK_Y, { r: 12 }, { z: 4 });
  b.piece("play", "barrel", h(97.4), DECK_Y, { h: 22 }, { z: 4 });
  // reeds in the shallows in front, posts standing in the water nearer still (P5)
  for (const [x, w, hh] of [[h(46), 260, 90], [h(66), 180, 70], [h(84), 220, 96], [h(104), 260, 110]] as const) {
    b.piece("near", "reeds", x, LAKE_Y + h(1.1), { w, h: hh }, { z: 1 });
  }
  for (const x of [h(58), h(79), h(96.5)]) b.piece("near", "moorPost", x, LAKE_Y - h(0.9), { h: 40, down: h(5), rope: false }, { z: 2 });

  b.water({ y: LAKE_Y, x0: LAKE_X0, x1: LAKE_X1, fx0: h(-60), fx1: h(150), near: 1.9, far: 0.06, kind: "lake" });
  // nothing under the lake's surface to walk on: a fall there tugs her back
  b.void({ x0: LAKE_X0, x1: LAKE_X1, y: LAKE_Y + h(0.5), y1: h(66) });

  b.spawn({ id: "catch", x: CATCH_X, y: DECK_Y, facing: 1 });
  b.spawn({ id: "western-pass", x: h(12), y: h(58.5), facing: 1 });
  b.place({ id: "kagami", name: "Kagami", x0: 0, x1: JETTY_X1, title: "place", spawn: "catch" });

  // --- the sky and the land beyond the lake (P0 to P3)
  b.atmos({
    x: 0,
    // the morning key (env-sky lane, ART-BIBLE section 3; composited in the opening)
    sky: ["#8fb6cf", "#d3e6e3", "#edf5ef"],
    haze: "#dce9e4",
    mist: 0.8,
    mistColour: "#f2f7f2",
    sun: [0.2, 0.11],
    water: { deep: "#235f60", body: "#4a9a90", shallow: "#c3e2d9", glint: "#fffbe8" },
  });
  // sky plane: y is px above the horizon (the sky barely moves, 0.02 of the camera)
  const clouds: [number, number, number, number][] = [
    [-300, -230, 520, 70], [260, -150, 380, 54], [700, -260, 640, 86], [1180, -120, 420, 60], [1560, -210, 560, 74], [2100, -170, 480, 64],
  ];
  // the env-sky lane's clouds, drifting east with the wind: the big slots are banks, the thin
  // ones strata; two low strata lie just over the far karst (mist layered between sky and land)
  const skyWrap: [number, number] = [-1700, 2500];
  clouds.forEach(([x, y, w, hh], i) => {
    const big = hh >= 64;
    drifting(b, `sky-cloud-${i}`, "sky", big ? "sky.bank" : "sky.stratus", x, y, big ? { w, h: Math.round(hh * 1.05) } : { w: Math.round(w * 1.3), h: Math.round(hh * 0.3), layers: 2 }, skyWrap, big ? 2 : 3, 2);
  });
  drifting(b, "sky-low-0", "sky", "sky.stratus", -260, -70, { w: 900, h: 14, layers: 2 }, skyWrap, 3.5, 2);
  drifting(b, "sky-low-1", "sky", "sky.stratus", 760, -96, { w: 700, h: 12, layers: 2 }, skyWrap, 3, 2);
  // the two sky isles, Bell and Drum, above and right of the palace: seen from almost everywhere
  bg(b, "sky", 560, "isle", { w: 92, h: 120, tower: "bell" }, LAKE_Y - 300 / PLANES.sky.rate, 2);
  bg(b, "sky", 700, "isle", { w: 110, h: 96, tower: "drum" }, LAKE_Y - 236 / PLANES.sky.rate, 2);

  // every background plane has ground below its line, so the land never shows a gap
  bg(b, "far", -2600, "plain", { w: 9000, foot: 700, ramp: "range", amp: 4 }, LAKE_Y, -5);
  bg(b, "mid", -4000, "plain", { w: 21000, foot: 560, ramp: "pine", amp: 8 }, LAKE_Y, -5);
  bg(b, "back", -6000, "plain", { w: 40000, foot: 520, ramp: "pine", amp: 10 }, LAKE_Y, -5);

  // P1: the far karst, rows of pale limestone rising out of layered mist (env-sky lane), with
  // wisps drifting along their feet
  const ranges: [number, number, number][] = [
    [-2400, 1100, 260], [-1400, 980, 250], [-520, 1100, 330], [440, 1180, 300], [1500, 1040, 270], [2400, 1200, 320], [3500, 1100, 280],
  ];
  ranges.forEach(([x, w, hh], i) => bg(b, "far", x, "sky.karst", { w, h: Math.round(hh * 0.72), rows: i % 2 ? 2 : 3, look: "far", mist: Math.round(hh * 0.16), green: 0.6 }, LAKE_Y, i));
  const farWrap: [number, number] = [-900, 2400];
  ([[-200, -34, 520, 22], [520, -52, 420, 18], [1150, -30, 600, 24]] as const).forEach(([x, dy, w, th], i) =>
    drifting(b, `far-wisp-${i}`, "far", "sky.wisp", x, dy, { w, h: th, density: 0.65 }, farWrap, 5, 3));

  // P2: karst towers along the far shore, jade and white like Wuling's lake
  const towers: [number, number, number][][] = [
    [[0, 70, 150], [60, 52, 210], [120, 64, 130]],
    [[0, 90, 250], [80, 60, 170]],
    [[0, 54, 120], [50, 80, 230], [130, 46, 150], [175, 66, 190]],
    [[0, 70, 160], [70, 58, 280]],
    [[0, 64, 140], [60, 90, 200], [150, 50, 120]],
  ];
  const towerX = [-1300, -820, 120, 900, 1700];
  towers.forEach((t, i) => bg(b, "mid", towerX[i]!, "sky.karst", { w: 0, h: 260, rows: 1, look: "near", towers: t, mist: 30, green: 0.8 }, LAKE_Y, i));
  const midWrap: [number, number] = [-400, 5400];
  ([[600, -24, 520, 26], [1900, -40, 460, 22], [3300, -22, 640, 30]] as const).forEach(([x, dy, w, th], i) =>
    drifting(b, `mid-wisp-${i}`, "mid", "sky.wisp", x, dy, { w, h: th, density: 0.6 }, midWrap, 7, 3));
  bg(b, "mid", -3000, "ridgeline", { w: 9000, h: 40, pines: 1.5, pineH: 26 }, LAKE_Y, -2);

  // a Walker wading the far shore (the Walker lane's giant replaces this stand-in in its slot)
  b.sprite({ id: "walker-kagami", plane: "mid", kind: "walker", x: h(84), y: LAKE_Y + h(0.6), p: { frames: 16 }, frames: 16, fps: 4, path: [h(70), h(140)], speed: 82 });

  // P3: the near-back shore: pine ridges low over the water
  bg(b, "back", -4200, "ridgeline", { w: 5200, h: 70, pines: 2.5, pineH: 52 }, LAKE_Y, 0);
  bg(b, "back", 700, "ridgeline", { w: 5000, h: 90, pines: 3, pineH: 60 }, LAKE_Y, 1);
}
