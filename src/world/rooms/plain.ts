// Room: the plain (test world room 2). The colossus-plain backdrop (a pale
// colossus the size of weather crossing the far distance) under a sky that
// turns as you walk: mist at the shore, overcast, rain, then a storm with wind
// tearing at the prayer flags and lightning over the colossus. On the way:
// a gap in the old causeway, standing stones to climb for the view, the first
// shrine (lanterns, the donation box and its donor plaque, the map banner on
// its cord, a bench), bones of something huge, and at the far side a small
// stone house with a lit window: shelter.

import plainScene from "../../scenes/scenes/colossus-plain.ts";
import { geo as plainGeo } from "../../scenes/scenes/colossus-plain/ground.ts";
import { h, SCALE } from "../config.ts";
import type { RoomDef, TerrainPiece } from "../room/types.ts";
import { geoCtx, lighting } from "./common.ts";

const SPAN = h(44);
const W = SCALE.viewW + SPAN;
const g = plainGeo(geoCtx(SPAN));
const deck = g.deck;
const stone = ["#0c0b0d", "#171417", "#221e21", "#302a2c", "#43393a", "#5f5150"];
const D = SCALE.viewH - deck + h(0.6);

const slab = (x0: number, x1: number, top: number, seed: number, open = true): TerrainPiece => ({
  x: x0,
  y: top,
  w: x1 - x0,
  h: SCALE.viewH - top + h(0.6),
  art: "stone",
  surface: "stone",
  ramp: stone,
  seed,
  ...(open ? {} : {}),
});

// shrine terrace
const T0 = h(26);
const T1 = h(36.5);
const terrace = deck - h(0.75);

export const plain: RoomDef = {
  id: "plain",
  title: "plain: the colossus crossing, mist to storm",
  region: "test",
  w: W,
  h: SCALE.viewH,
  backdrop: { scene: plainScene, hide: ["figure", "causeway", "cloth", "foreground", "lightning", "sheet-flash"], vertical: 0, weather: true },
  lighting: lighting({
    ambient: [0.34, 0.33, 0.4],
    keyDir: [-0.5, -0.62, 0.6],
    keyColour: [0.64, 0.63, 0.68],
    rimColour: [0.86, 0.88, 0.97],
    rimDir: [-0.7, -0.72],
    rimIntensity: 0.9,
  }),
  terrain: [
    slab(0, h(17.5), deck, 11),
    // the gap: jump it (a pit sends you back to the edge)
    slab(h(18.5), h(24), deck, 12),
    // steps up to the shrine terrace, the terrace, steps down
    { ...slab(h(24), h(24.6), deck - h(0.25), 13), h: D },
    { ...slab(h(24.6), h(25.2), deck - h(0.5), 14), h: D },
    slab(h(25.2), T1, terrace, 15),
    slab(T1, h(37.1), deck - h(0.5), 16),
    slab(h(37.1), h(37.7), deck - h(0.25), 17),
    slab(h(37.7), W, deck, 18),
  ],
  spawns: {
    west: { x: h(0.9), y: deck, facing: 1 },
    house: { x: W - h(5.8), y: deck, facing: -1 },
    shrine: { x: h(33.6), y: terrace, facing: 1 },
  },
  exits: [{ side: "left", to: { room: "arrival", spawn: "east" } }],
  props: [
    { recipe: "grass", id: "g1", x: h(3), y: deck, params: { seed: 1 } },
    { recipe: "grass", id: "g2", x: h(7.5), y: deck, params: { seed: 2 } },
    { recipe: "grass", id: "g3", x: h(12.2), y: deck, params: { seed: 3 } },
    { recipe: "standing-stone", id: "stone-1", x: h(20.4), y: deck, params: { w: 0.7, h: 0.95, seed: 3 } },
    { recipe: "standing-stone", id: "stone-2", x: h(22.1), y: deck, params: { w: 0.6, h: 1.75, seed: 7 } },
    { recipe: "grass", id: "g4", x: h(19.3), y: deck, params: { seed: 4 } },
    // the shrine
    { recipe: "lantern-post", id: "shrine-lantern-1", x: h(26.3), y: terrace, params: { seed: 2 } },
    { recipe: "offering-bowl", id: "shrine-bowl", x: h(27.4), y: terrace },
    { recipe: "donation-box", id: "shrine-box", x: h(28.6), y: terrace },
    { recipe: "donor-plaque", id: "shrine-plaque", x: h(29.5), y: terrace },
    { recipe: "map-banner", id: "shrine-map", x: h(31.3), y: terrace },
    { recipe: "bench", id: "shrine-bench", x: h(33.6), y: terrace },
    { recipe: "lantern-post", id: "shrine-lantern-2", x: h(35.6), y: terrace, params: { seed: 5 } },
    { recipe: "grass", id: "g5", x: h(30.4), y: terrace, params: { seed: 6 } },
    // prayer flags into the wind
    { recipe: "prayer-flags", id: "flags-1", x: h(40), y: deck, params: { span: h(4.6) } },
    { recipe: "bones", id: "bones-far", x: h(45.5), y: deck, params: { size: 1.4, seed: 5, layer: "back" } },
    { recipe: "grass", id: "g6", x: h(43.2), y: deck, params: { seed: 7 } },
    { recipe: "grass", id: "g7", x: h(49.4), y: deck, params: { seed: 8 } },
    { recipe: "bones", id: "bones-near", x: h(51.5), y: deck + h(0.1), params: { size: 0.55, seed: 9, layer: "front" } },
    { recipe: "grass", id: "g8", x: h(53.6), y: deck, params: { seed: 9 } },
    // shelter
    { recipe: "house-front", id: "house", x: W - h(3.2), y: deck, params: { w: 4.6 } },
    { recipe: "door", id: "house-door", x: W - h(4.2), y: deck, params: { variant: "wood" } },
    { recipe: "lantern-post", id: "house-lantern", x: W - h(6.3), y: deck, params: { seed: 8 } },
  ],
  doors: { "house-door": { room: "house", spawn: "entry" } },
  zones: [
    // on the standing stones: the vista, the colossus crossing the plain
    { x0: h(19.5), x1: h(23), y1: deck - h(0.6), bars: 0.07, feather: h(1) },
    // the shrine: a slower, framed stop
    { x0: T0, x1: T1, cx: (T0 + T1) / 2 + h(0.3), bars: 0.05, weight: 0.6, feather: h(2) },
  ],
  weather: {
    zones: [
      { x0: 0, x1: 0.2, state: "mist" },
      { x0: 0.2, x1: 0.44, state: "overcast" },
      { x0: 0.44, x1: 0.64, state: "rain" },
      { x0: 0.64, x1: 1, state: "storm" },
    ],
    feather: 0.07,
    time: "day",
  },
  audio: { music: "theme", bed: "exterior", weatherThrough: 1 },
  ambient: { dust: 12 },
  neighbours: ["arrival", "house"],
};
