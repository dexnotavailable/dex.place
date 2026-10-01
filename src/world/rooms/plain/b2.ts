// B2 The Causeway, with B3 the Bus Shelter (shrine 2) and B4 Stonetop as
// areas inside it (WORLD-PLAN section 4, region B; lane R-B). Replaces the
// grey-box B2 by id and keeps its walk (so the round's times and jumps hold):
// 64 H of old road into rising wind, a 1.1 H break, the colossus's footprint
// crater, a 2.5 H break with a wade beneath, the rib arch, the shelter, and
// the Stonetop climb to a bench where the colossus passes at eye level.
// Something new on every screen: the red marker posts and the standing
// stones with their flags (screen 1), the broken colonnade and the crater
// (screen 2), the second break and the bones (screen 3), the shelter and the
// tor (screen 4). The backdrop (scenes/causeway.ts) draws the road, the
// breaks, the crater and the tor where this collision is (causeway/geo.ts).

import { causeway } from "../../../scenes/scenes/causeway.ts";
import { B2 } from "../../../scenes/scenes/causeway/geo.ts";
import { h } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { Box } from "../_blockout/_build.ts";
import { lighting } from "../common.ts";
import { fromLight } from "../../render/blend.ts";

const b = new Box({
  id: "B2",
  title: "B2 The Causeway",
  region: "B",
  x0: B2.x0,
  x1: B2.x1,
  top: B2.top,
  bottom: B2.bottom,
  mood: "overcast",
  camera: { mode: "rail", anchor: B2.anchor, slack: 1.5 },
  audio: { music: "theme", bed: "plain", weatherThrough: 1, level: 0.58, surface: "stone" },
  weather: {
    zones: [
      { x0: 0, x1: 0.3, state: "mist" },
      { x0: 0.3, x1: 1, state: "overcast" },
    ],
    feather: 0.08,
    time: "day",
  },
  neighbours: ["B1", "B5"],
});

// --- collision (the grey-box's walk, unchanged) -----------------------------------------
b.floor(108, 114, 1.0);
b.floor(114, 120, 1.2);
b.floor(120, 121.1, -0.4, undefined, "water");
b.pit(120, 121.1, 0.3);
b.floor(121.1, 134, 1.2);
let x = b.stairs(134, 1.2, -1.6, 1, "earth");
b.floor(x, x + 1.6, -1.6, undefined, "water");
b.wade(x, x + 1.6, -1.3);
x = b.stairs(x + 1.6, -1.6, 1.4, 1, "earth");
b.floor(x, 146, 1.4);
x = b.stairs(146, 1.4, 0.8, 1);
b.floor(x, 147.6, 0.8, undefined, "water");
b.wade(146, 148.5, 1.1);
x = b.stairs(147.6, 0.8, 1.4, 1);
b.floor(148.5, 154, 1.6);
for (const [a, c, y] of B2.ribs) b.ledge(a, c, y);
// the 0.2 H step sits just west of the shelter, so its whole footprint stands on one level
b.floor(154, 159.7, 1.8);
b.floor(159.7, 172, 2.0);
const [r0, r1, rt, rb] = B2.shelter.roof;
b.block(r0, r1, rt, rb);
b.area({ id: "B3", title: "B3 Bus Shelter", x0: 160, x1: 168, top: 4.9, bottom: 1.9, camera: { mode: "locked", anchor: 0.7 }, audio: { duck: 4 }, roofed: true });
for (const [a, c, y] of B2.stones) b.ledge(a, c, y);
b.ledge(B2.summit[0], B2.summit[1], B2.summit[2]);
b.area({ id: "B4", title: "B4 Stonetop", x0: 155, x1: 172, top: B2.top, bottom: 3.0, camera: { mode: "free", anchor: 0.5 } });
// the summit's view: the player high in the frame, the colossus passing at her eye level
b.vista(160, 166, 163, 16.4, 0.06, B2.top, 16.5);

// --- props --------------------------------------------------------------------------------
const px = { engine: "pixel" as const };
b.prop("plain-keeper", "keeper", 140, 1.2, { scene: "causeway", shake: 2.45, passing: 560, lamps: [{ shrine: 1, ids: ["lamp-1-8", "lamp-1-9", "lamp-1-10", "lamp-1-11"] }] }, { engine: "stub" });
b.prop("plainRumble", "rumble", 140, 1.2, { breeze: [3.5, 8], roomW: h(B2.x1 - B2.x0) }, px);

// screen 1: the red marks, the standing stones and their flags, the first break
b.prop("markerPost", "marker-1", 109.4, 1.0, { lean: 0.1 }, px);
b.prop("standingStone", "stone-1", 112.6, 1.0, { w: 0.72, h: 1.75, lean: 0.05 }, px);
b.prop("prayerFlags", "flags-1", 112.9, 1.0, { kind: "prayer", span: 3.9, height: 1.7, posts: false }, px);
b.prop("standingStone", "stone-2", 116.8, 1.2, { w: 0.5, h: 1.15, lean: -0.08 }, px);
b.prop("markerPost", "marker-2", 119.4, 1.2, { lean: 0.14, height: 1.9 }, px);
b.prop("grass", "grass-1", 108.2, 1.0, { kind: "dry", width: 2.6, height: 0.28 }, px);
b.prop("grass", "grass-2", 114.4, 1.2, { kind: "grass", width: 1.8, height: 0.3 }, px);
b.prop("paper", "paper", 122.2, 1.2, { count: 1 }, px);
// screen 2: the broken colonnade, the crater with its pool and rubble
b.prop("pillar", "col-1", 124.5, 1.2, { kind: "round", height: 3.1, width: 0.46 }, px);
b.prop("pillar", "col-2", 126.0, 1.2, { kind: "broken", height: 1.7, width: 0.46 }, px);
b.prop("pillar", "col-3", 127.5, 1.2, { kind: "round", height: 2.7, width: 0.46 }, px);
b.prop("pillar", "col-4", 129.0, 1.2, { kind: "broken", height: 0.9, width: 0.46 }, px);
b.prop("rubble", "col-rubble", 130.1, 1.2, { kind: "stone", width: 1.1, height: 0.3 }, px);
b.prop("markerPost", "marker-3", 132.2, 1.2, { lean: 0.08, height: 2.2 }, px);
b.prop("rubble", "rim-west", 133.3, 1.2, { kind: "stone", width: 0.8, height: 0.3 }, px);
b.prop("puddle", "crater-pool", B2.crater.pool[0] + 0.05, B2.crater.floor, { width: B2.crater.pool[1] - B2.crater.pool[0] - 0.1, sky: "storm" }, px);
b.prop("rubble", "rim-east", 144.5, 1.4, { kind: "stone", width: 0.9, height: 0.28 }, px);
b.prop("grass", "grass-3", 131.0, 1.2, { kind: "flowers", width: 1.4, height: 0.26 }, px);
// screen 3: the second break, the bones
b.prop("markerPost", "marker-4", 145.5, 1.4, { lean: 0.16, height: 1.8 }, px);
b.prop("ribArch", "ribs", 148.2, 1.6, { shelves: B2.ribs.map(([a, c, y]) => [a - 148.2, c - 148.2, y - 1.6]) }, px);
b.prop("grass", "grass-4", 149.0, 1.6, { kind: "dry", width: 2.4, height: 0.32 }, px);
b.prop("grass", "grass-5", 154.3, 1.8, { kind: "grass", width: 1.6, height: 0.3 }, px);
// screen 4: Stonetop's first two stones (their tops are ledges), the shelter, shrine 2
for (const [i, id] of [[1, "stonetop-1"], [0, "stonetop-2"]] as [number, string][]) {
  const [a, c, y] = B2.stones[i]!;
  b.prop("standingStone", id, (a + c) / 2, 1.8, { w: c - a, h: y - 1.8, lean: 0, flat: true }, px);
}
b.prop("busShelter", "shelter", B2.shelter.x0, B2.shelter.floor, { w: 8, h: B2.shelter.roof[3] - B2.shelter.floor }, px);
b.prop("shrineLantern", "shrine-2", 161.2, 2.0, { flag: "shrine:2", n: 2 }, px);
b.prop("offeringBowl", "bowl-2", 161.85, 2.0, {}, px);
b.prop("donationBox", "box-2", 162.6, 2.0, { dest: "donate" }, px);
b.prop("donorPlaque", "plaque-2", 163.4, 2.95, {}, px);
b.prop("bench", "bench-2", 165.0, 2.0, { kind: "stone", length: 1.8 }, px);
b.prop("routeSign", "route-sign", 167.4, 2.0, {}, px);
b.prop("moths", "moths-2", 161.2, 3.2, { count: 4, reach: 2 }, px);
b.prop("puddle", "puddle-1", 168.3, 2.0, { width: 0.8, sky: "storm" }, px);
b.prop("puddle", "puddle-2", 158.6, 1.8, { width: 0.6, sky: "storm" }, px);
b.prop("grass", "grass-6", 169.0, 2.0, { kind: "dry", width: 2.8, height: 0.3 }, px);
// Stonetop's summit: the bench to sit and look, flags in the wind, a small stone
b.prop("bench", "stonetop-bench", 162.8, B2.summit[2], { kind: "stone", length: 1.6 }, px);
b.prop("prayerFlags", "stonetop-flags", 160.2, B2.summit[2], { kind: "prayer", span: 1.9, height: 1.4, posts: true }, px);
b.prop("standingStone", "summit-stone", 165.6, B2.summit[2], { w: 0.4, h: 0.8, lean: 0.06 }, px);
// lamp posts along the road, dark until shrine 1 is lit (the keeper lights them)
for (const [id, lx, ly] of [
  ["lamp-1-8", 111, 1.0],
  ["lamp-1-9", 125.4, 1.2],
  ["lamp-1-10", 145.0, 1.4],
  ["lamp-1-11", 157.0, 1.8],
] as [string, number, number][])
  b.prop("lampPost", id, lx, ly, { lit: false, arm: 1 }, px);

b.spawn("west", 108.6, 1.0, 1).spawn("east", 171.4, 2.0, -1).spawn("shrine", 160.4, 2.0, 1);
b.exit("left", "B1", "east", -1, 3).exit("right", "B5", "top", 1, 4);

const built = b.build();

const LIGHT = lighting({
  ambient: [0.36, 0.35, 0.41],
  keyDir: [-0.5, -0.62, 0.6],
  keyColour: [0.62, 0.62, 0.68],
  rimColour: [0.86, 0.88, 0.98],
  rimDir: [-0.7, -0.72],
  rimIntensity: 0.9,
});

export const b2: RoomDef = {
  ...built,
  terrain: built.terrain.map((t) => ({ ...t, art: "none" as const })),
  backdrop: { scene: causeway(true), vertical: 1, weather: true },
  lighting: LIGHT,
  // one image: the overcast's cool cast over road, tor and props, the far props veiled in the flats'
  // haze, contact shadows, the lamps' light tinting the stone round them
  blend: fromLight(LIGHT, { amount: 0.12, haze: 0.32, band: 0.7, halo: 1.3 }),
  // rain drips off the shelter roof's edges
  ambient: { dust: 14, drips: [[h(B2.shelter.roof[0] - B2.x0), h(B2.top - B2.shelter.roof[3])], [h(B2.shelter.roof[1] - B2.x0), h(B2.top - B2.shelter.roof[3])]] },
  waterline: h(B2.top - B2.flats),
};
