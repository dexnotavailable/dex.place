// B1 Reed Shallows (WORLD-PLAN section 4, region B; lane R-B). Replaces the
// grey-box B1 by id. The same walk as the grey-box (so the round's times and
// jumps hold): the stone stair down from the yard, the old boardwalk with its
// 0.9 H gap (jump it or wade round), the 6 H reed channel you wade the first
// time, the rope bridge you cut from the east bank (S1), the steps up to the
// causeway. The backdrop (scenes/reed-shallows.ts) draws the stair, the
// boardwalk and the banks exactly where this collision is, from the same
// numbers (reed-shallows/geo.ts), with the colossus wading at depth 8.

import { reedShallows } from "../../../scenes/scenes/reed-shallows.ts";
import { B1 } from "../../../scenes/scenes/reed-shallows/geo.ts";
import type { RoomDef } from "../../room/types.ts";
import { Box } from "../_blockout/_build.ts";
import { lighting } from "../common.ts";
import { fromLight } from "../../render/blend.ts";
import { h } from "../../config.ts";

const b = new Box({
  id: "B1",
  title: "B1 Reed Shallows",
  region: "B",
  x0: B1.x0,
  x1: B1.x1,
  top: B1.top,
  bottom: B1.bottom,
  mood: "morning",
  camera: { mode: "rail", anchor: B1.anchor, slack: 1 },
  audio: { music: "theme", bed: "reeds", weatherThrough: 1, surface: "wood" },
  weather: { state: "serene", time: "day" },
  neighbours: ["A4", "B2"],
  surface: "wood",
});

// --- collision (the grey-box's walk, unchanged) -------------------------------------
b.floor(B1.x0, B1.stairX, B1.yard, undefined, "earth");
let x = b.stairs(B1.stairX, B1.yard, B1.deck, 1, "stone");
b.floor(x, B1.walks[0]![1], B1.deck, 0.3, "wood");
// the 0.9 H gap over shallow water: jump it, or step down and wade (0.25 H steps)
b.floor(88, 88.3, -0.05, undefined, "water");
b.floor(88.3, 88.6, -0.3, undefined, "water");
b.floor(88.6, 88.9, -0.05, undefined, "water");
b.wade(88, 88.9, 0.1);
b.floor(B1.walks[1]![0], B1.walks[1]![1], B1.deck, 0.3, "wood");
// the reed channel: wade across the first time; the bridge deck stands hauled up on the east bank
b.floor(92, 92.3, -0.05, undefined, "water");
b.floor(92.3, 97.7, -0.3, undefined, "water");
b.floor(97.7, 98, -0.05, undefined, "water");
b.wade(92, 98, 0.1);
b.floor(B1.walks[2]![0], B1.walks[2]![1], B1.deck, 0.3, "wood");
x = b.stairs(B1.eastStairX, B1.deck, B1.east, 1, "stone");
b.floor(x, B1.x1, B1.east, undefined, "earth");

// --- props ---------------------------------------------------------------------------
const px = { engine: "pixel" as const };
// the controllers: the keeper (walk feed, save, player) and the rumble (shake, wash)
b.prop("plain-keeper", "keeper", 90, B1.deck, { scene: "reed-shallows", shake: 1.45, lamps: [{ shrine: 1, ids: ["lamp-1-5", "lamp-1-6", "lamp-1-7"] }] }, { engine: "stub" });
b.prop("plainRumble", "rumble", 90, B1.deck, { breeze: [0.8, 1.6], roomW: h(B1.x1 - B1.x0) }, px);
// S1: the lowering bridge, hinged on the east bank
b.prop("ropeBridge", "rope-bridge", B1.channel[1], B1.deck, { span: B1.channel[1] - B1.channel[0] }, px);
// reeds in the channel you wade through, at the gap, at the stair's foot and the east bank
const reedAt: [number, number, number, number, string?][] = [
  // x, width, height (H), elevation, layer
  [85.4, 0.8, 0.8, B1.water],
  [88.05, 0.8, 0.7, B1.water],
  [92.3, 1.8, 1.05, B1.water],
  [94.6, 1.1, 0.9, B1.water],
  [96.2, 1.5, 1.1, B1.water],
  [92.6, 1.5, 0.42, B1.water, "fg"],
  [95.2, 1.6, 0.38, B1.water, "fg"],
  [104.9, 1.2, 0.7, B1.east],
];
reedAt.forEach(([rx, w, h, y, layer], i) => b.prop("reedBed", `reeds-${i + 1}`, rx, y, { width: w, height: h, layer: layer ?? "mid", heads: layer ? 0.05 : 0.18 }, px));
// lamp posts along the boardwalk, dark until shrine 1 is lit (the keeper lights them)
for (const [id, lx, ly] of [
  ["lamp-1-5", 86.6, B1.deck],
  ["lamp-1-6", 100.6, B1.deck],
  ["lamp-1-7", 106.6, B1.east],
] as [string, number, number][])
  b.prop("lampPost", id, lx, ly, { lit: false, arm: 1 }, px);
// the ferry board: its times worn away to nothing (ghost rules, no invented text)
b.prop("ferryBoard", "ferry-board", 99.6, B1.deck, {}, px);
// green spilling over the quay: from the yard's lip down the first treads, and down the wall over the boat arch
b.prop("vines", "quay-vines-1", 76.25, B1.yard, { width: 0.7, length: 0.9, strands: 5 }, px);
b.prop("vines", "quay-vines-2", 79.3, 4.05, { width: 1.1, length: 1.7, strands: 8 }, px);
// puddles on the planks
b.prop("puddle", "puddle-1", 86.9, B1.deck, { width: 0.7, sky: "day" }, px);
b.prop("puddle", "puddle-2", 102.1, B1.deck, { width: 0.9, sky: "day" }, px);
// grass on the yard's lip and the bank up to the causeway
b.prop("grass", "grass-1", 76.0, B1.yard, { kind: "dry", width: 0.55, height: 0.24 }, px);
b.prop("grass", "grass-2", 105.5, B1.east, { kind: "grass", width: 2.2, height: 0.3 }, px);

b.spawn("west", 76.3, B1.yard, 1).spawn("east", 107.4, B1.east, -1).spawn("channel-east", 98.6, B1.deck, -1);
b.exit("left", "A4", "east", 4, 8).exit("right", "B2", "west");

const built = b.build();

const LIGHT = lighting({
  ambient: [0.36, 0.42, 0.41],
  keyDir: [-0.5, -0.66, 0.56],
  keyColour: [0.74, 0.7, 0.58],
  rimColour: [1, 0.93, 0.74],
  rimDir: [-0.62, -0.78],
  rimIntensity: 0.95,
});

export const b1: RoomDef = {
  ...built,
  // the backdrop draws the stair, the boardwalk and the banks where this collision is
  terrain: built.terrain.map((t) => ({ ...t, art: "none" as const })),
  backdrop: { scene: reedShallows(true), vertical: 1, weather: true },
  lighting: LIGHT,
  // one image: the morning's warm cast over everything, the far pixel props veiled in the lake's haze,
  // the lamps' light tinting the planks around them
  blend: fromLight(LIGHT, { amount: 0.12, haze: 0.3 }),
  ambient: { dust: 6 },
  // the lake's surface under the boardwalk: the player and reflecting props mirror here
  waterline: h(B1.top - B1.water),
};
