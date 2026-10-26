// Room: the arrival (test world room 1). The dock under the ring, from the
// scenes lane's arrival backdrop (ring over the lake with the colossus wading
// the far water, all mirrored in the lake). The player stands where the
// scene's figure stood; nothing competes with the first view. Left: the end
// of the dock and a bench (the resting overlook). Right: a quiet red line on
// the boards, old pilings to hop, a rock shore that rises to the plain, and
// a door standing alone on the shore, latched from the other side.

import arrivalScene from "../../scenes/scenes/arrival.ts";
import { geo as arrivalGeo } from "../../scenes/scenes/arrival/geo.ts";
import { h, SCALE } from "../config.ts";
import type { RoomDef } from "../room/types.ts";
import { geoCtx, lighting } from "./common.ts";

/** Pan range at depth 1: the room is one view plus this. */
const SPAN = h(20);
const W = SCALE.viewW + SPAN;
const g = arrivalGeo(geoCtx(SPAN));
/** Layer x at depth 1 -> room x. */
const X = (lx: number): number => Math.round(lx + SPAN / 2);
const deck = g.deck;
const dockEnd = X(g.dockEnd);
const rock = ["#080c0f", "#0e1519", "#172024", "#233034", "#3d4a48"];
const shoreY = [deck - h(0.55), deck - h(0.75), deck - h(0.95)];

export const arrival: RoomDef = {
  id: "arrival",
  title: "arrival: the dock under the ring",
  w: W,
  h: SCALE.viewH,
  backdrop: { scene: arrivalScene, hide: ["figure"], vertical: 0, weather: true },
  lighting: lighting({
    ambient: [0.3, 0.36, 0.37],
    keyDir: [0.45, -0.7, 0.55],
    keyColour: [0.66, 0.6, 0.48],
    rimColour: [1, 0.86, 0.6],
    rimDir: [0.55, -0.83],
    rimIntensity: 0.95,
  }),
  terrain: [
    // the scene's dock is the visual; this is its collision
    { x: 0, y: deck, w: dockEnd, h: h(0.3), art: "none", surface: "wood" },
    // the rock shore rising to the plain
    { x: X(g.dockEnd) + h(6.1), y: shoreY[0]!, w: h(2.6), h: SCALE.viewH - shoreY[0]! + h(0.5), art: "rock", surface: "stone", ramp: rock, seed: 3, reflect: true },
    { x: X(g.dockEnd) + h(8.7), y: shoreY[1]!, w: h(2.2), h: SCALE.viewH - shoreY[1]! + h(0.5), art: "rock", surface: "stone", ramp: rock, seed: 4, reflect: true },
    { x: X(g.dockEnd) + h(10.9), y: shoreY[2]!, w: W - (X(g.dockEnd) + h(10.9)), h: SCALE.viewH - shoreY[2]! + h(0.5), art: "rock", surface: "stone", ramp: rock, seed: 5, reflect: true },
  ],
  spawns: {
    start: { x: X(g.figX), y: deck, facing: 1 },
    east: { x: W - h(0.8), y: shoreY[2]!, facing: -1 },
    latch: { x: X(g.dockEnd) + h(13.1), y: shoreY[2]!, facing: -1 },
  },
  exits: [{ side: "right", to: { room: "plain", spawn: "west" } }],
  props: [
    { recipe: "bench", id: "arrival-bench", x: h(3.4), y: deck },
    { recipe: "red-line", id: "arrival-hint", x: X(g.figX) + h(0.4), y: deck, params: { len: dockEnd - X(g.figX) - h(0.5) } },
    { recipe: "piling", id: "pile-1", x: dockEnd + h(1.0), y: deck - h(0.05), params: { depth: g.wl - deck + h(0.1), seed: 1 }, reflect: true },
    { recipe: "piling", id: "pile-2", x: dockEnd + h(2.3), y: deck - h(0.15), params: { depth: g.wl - deck + h(0.2), seed: 2 }, reflect: true },
    { recipe: "piling", id: "pile-3", x: dockEnd + h(3.6), y: deck - h(0.3), params: { depth: g.wl - deck + h(0.35), seed: 3, w: 0.34 }, reflect: true },
    { recipe: "piling", id: "pile-4", x: dockEnd + h(4.9), y: deck - h(0.42), params: { depth: g.wl - deck + h(0.47), seed: 4 }, reflect: true },
    { recipe: "buoy", id: "buoy", x: dockEnd + h(3.2), y: g.wl + 1, reflect: true },
    { recipe: "reeds", id: "reeds-1", x: X(g.dockEnd) + h(6.4), y: shoreY[0]!, params: { variant: "reeds", seed: 3 }, reflect: true },
    { recipe: "reeds", id: "reeds-2", x: X(g.dockEnd) + h(7.2), y: shoreY[0]!, params: { variant: "reeds", seed: 8 }, reflect: true },
    { recipe: "grass", id: "grass-1", x: X(g.dockEnd) + h(9.5), y: shoreY[1]!, params: { seed: 5 } },
    { recipe: "door", id: "shore-door", x: X(g.dockEnd) + h(13.4), y: shoreY[2]!, params: { latch: "latch:house-back", variant: "stone" }, reflect: true },
    { recipe: "grass", id: "grass-2", x: X(g.dockEnd) + h(15.2), y: shoreY[2]!, params: { seed: 9 } },
    { recipe: "reeds", id: "reeds-3", x: X(g.dockEnd) + h(16.4), y: shoreY[2]!, params: { variant: "reeds", seed: 13 } },
  ],
  doors: { "shore-door": { room: "house", spawn: "latch" } },
  zones: [
    // the first view: exactly the scene's composition while you stand there
    { x0: X(g.figX) - h(3.5), x1: X(g.figX) + h(2.2), cx: W / 2, bars: 0.035, feather: h(1.5) },
    // the resting overlook at the end of the dock, looking back at the ring
    { x0: 0, x1: h(6), cx: SCALE.viewW / 2 + h(1), bars: 0.07, feather: h(2) },
  ],
  weather: { state: "serene", time: "day" },
  audio: { music: "theme", bed: "water", weatherThrough: 1 },
  ambient: { dust: 20 },
  waterline: g.wl,
  neighbours: ["plain", "house"],
  pitY: g.wl + h(0.9),
};
