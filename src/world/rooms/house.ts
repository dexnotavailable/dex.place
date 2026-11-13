// Room: the house (test world room 3). Indoors after the storm: two floors of
// a lived-in stone house, warm and small after the vast plain. The registry
// counter with its bell (dex account), a reading lectern by the windows where
// the music falls silent (the archive), an ordinary door to the archive
// proper, an old goods lift and climbable shelves to the upper floor, a
// framed piece of Dex's art (inspected on its own), the boss terminal
// (summoning states; the wardens come later), candles and hanging lamps, and
// a back door whose latch, once released, opens onto the shore of the arrival
// (the shortcut). The storm stays in the windows and passes while you're in.

import { h } from "../config.ts";
import { interior } from "../backdrop/interior.ts";
import type { RoomDef } from "../room/types.ts";
import { lighting } from "./common.ts";

const W = h(24);
const HT = h(14);
const ground = HT - h(1);
const upper = ground - h(5.4);
const shaft0 = h(14.8);
const shaft1 = h(16.4);
const wood = ["#120c08", "#1f150d", "#2d1f14", "#3f2c1c", "#58402a"];

export const house: RoomDef = {
  id: "house",
  title: "house: indoors, two floors",
  region: "test",
  stormPasses: "plain",
  w: W,
  h: HT,
  backdrop: {
    scene: interior({
      roomW: W,
      roomH: HT,
      floors: [ground, upper],
      windows: [
        { x: h(3.2), y: ground - h(2.9), w: h(1.1), h: h(1.9) },
        { x: h(9.6), y: ground - h(2.9), w: h(1.1), h: h(1.9) },
        { x: h(6.5), y: upper - h(3.3), w: h(1.1), h: h(2.1) },
        { x: h(19.6), y: upper - h(3.3), w: h(1.1), h: h(2.1) },
      ],
      lamps: [
        [h(5), upper + h(1.4)],
        [h(12.6), upper + h(1.4)],
        [h(5.3), h(2.4)],
        [h(18.2), h(2.4)],
      ],
      pillars: [h(8), h(17.5)],
      posts: [h(0.4), shaft0 - h(0.2), shaft1 + h(0.2), W - h(0.4)],
    }),
    vertical: 1,
    weather: false,
  },
  lighting: lighting({
    ambient: [0.3, 0.26, 0.24],
    keyDir: [0.2, -0.8, 0.6],
    keyColour: [0.62, 0.5, 0.38],
    rimColour: [0.72, 0.8, 0.95],
    rimDir: [-0.6, -0.8],
    rimIntensity: 0.8,
  }),
  terrain: [
    { x: 0, y: ground, w: W, h: h(1), art: "wood", surface: "wood", ramp: wood, seed: 21 },
    { x: 0, y: upper, w: shaft0, h: h(0.35), art: "wood", surface: "wood", ramp: wood, seed: 22 },
    // right of the shaft the upper floor is boards you can jump up through
    { x: shaft1, y: upper, w: W - shaft1, h: h(0.35), art: "wood", surface: "wood", ramp: wood, seed: 23, oneWay: true },
    // shelves climbing the right wall: one-way ledges 0.9 H apart
    { x: h(18), y: ground - h(0.9), w: h(1.6), h: h(0.12), art: "wood", surface: "wood", ramp: wood, seed: 24, oneWay: true },
    { x: h(20.3), y: ground - h(1.8), w: h(1.6), h: h(0.12), art: "wood", surface: "wood", ramp: wood, seed: 25, oneWay: true },
    { x: h(18), y: ground - h(2.7), w: h(1.6), h: h(0.12), art: "wood", surface: "wood", ramp: wood, seed: 26, oneWay: true },
    { x: h(20.3), y: ground - h(3.6), w: h(1.6), h: h(0.12), art: "wood", surface: "wood", ramp: wood, seed: 27, oneWay: true },
    { x: h(18), y: ground - h(4.5), w: h(1.6), h: h(0.12), art: "wood", surface: "wood", ramp: wood, seed: 28, oneWay: true },
  ],
  spawns: {
    entry: { x: h(2.4), y: ground, facing: 1 },
    latch: { x: W - h(2.2), y: upper, facing: -1 },
  },
  exits: [],
  props: [
    { recipe: "door", id: "house-in", x: h(1.2), y: ground, params: { variant: "wood" } },
    { recipe: "crate", id: "crate-1", x: h(3.6), y: ground, params: { seed: 1 } },
    { recipe: "crate", id: "crate-2", x: h(4.1), y: ground, params: { seed: 2, size: 0.34 } },
    { recipe: "counter", id: "registry", x: h(6.8), y: ground },
    { recipe: "candles", id: "counter-candles", x: h(6.2), y: ground - h(0.62), params: { seed: 3 } },
    { recipe: "lectern", id: "reading", x: h(10.2), y: ground },
    { recipe: "candles", id: "reading-candles", x: h(11), y: ground, params: { seed: 4 } },
    { recipe: "door", id: "archive-door", x: h(12.8), y: ground, params: { variant: "wood" } },
    { recipe: "lift", id: "lift", x: (shaft0 + shaft1) / 2, y: ground, params: { stops: [ground, upper] } },
    { recipe: "hanging-lamp", id: "lamp-1", x: h(5), y: upper + h(0.35), params: { chain: h(0.8) } },
    { recipe: "hanging-lamp", id: "lamp-2", x: h(12.6), y: upper + h(0.35), params: { chain: h(0.8) } },
    { recipe: "hanging-lamp", id: "lamp-3", x: h(5.3), y: h(0.4), params: { chain: h(1.7) } },
    { recipe: "hanging-lamp", id: "lamp-4", x: h(18.2), y: h(0.4), params: { chain: h(1.7) } },
    // upper floor
    { recipe: "bookshelf", id: "shelf-1", x: h(2.2), y: upper, params: { w: 1.3, h: 1.9, seed: 1 } },
    { recipe: "bookshelf", id: "shelf-2", x: h(3.9), y: upper, params: { w: 1.1, h: 1.5, seed: 2 } },
    { recipe: "artwork-frame", id: "art-01", x: h(8.6), y: upper - h(1.25), params: { art: "01" } },
    { recipe: "candles", id: "art-candles", x: h(8.6), y: upper, params: { seed: 5 } },
    { recipe: "terminal", id: "terminal", x: h(12), y: upper },
    { recipe: "crate", id: "crate-3", x: h(19), y: upper, params: { seed: 3 } },
    { recipe: "door", id: "house-back", x: W - h(1.1), y: upper, params: { latch: "latch:house-back", latchSide: true, variant: "wood" } },
  ],
  doors: {
    "house-in": { room: "plain", spawn: "house" },
    "house-back": { room: "arrival", spawn: "latch" },
    "archive-door": { panel: "archive" },
  },
  zones: [],
  weather: { interior: true, time: "day" },
  audio: { music: "theme", bed: "interior", weatherThrough: 0.35, silence: [[h(9), h(11.6)]] },
  ambient: { dust: 30 },
  neighbours: ["plain", "arrival"],
};
