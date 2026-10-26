// A1 The Dock: the arrival and spawn (WORLD-PLAN section 4, A1). Scenery first:
// the arrival backdrop (the ring over the lake, the sun in its hole, the shaft,
// the colossus walking the far strand and through the light, all mirrored in
// the water), the dock you stand on with the keeper's lamp beside you, a
// suitcase, and the only hint: a muted red line on the boards going right.
// Past the lamp the dock bends down 0.2 H onto an older boardwalk, partly
// awash, that runs across the shallows to the foot of the cliff (x 34), with
// mooring posts and floats in the water. Left is Pier's End (A0).
//
// Nothing to use in the first view: no NPC, no sign, no donation box, no prompt.
// The first frame is the scene's own composition (a framing zone around the
// spawn) and holds for as long as you stand there.

import { arrivalScene } from "../../../scenes/scenes/arrival.ts";
import { geo as arrivalGeo } from "../../../scenes/scenes/arrival/geo.ts";
import { h, SCALE } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { geoCtx, lighting } from "../common.ts";
import { Box } from "../_blockout/_build.ts";
import { px, sessionRoom, styled } from "./_lib.ts";

// World extent (WORLD-PLAN section 3): x 0..34 H, 9 H tall, the deck at elevation 0.3.
const X0 = 0;
const X1 = 34;
const TOP = 7.5;
const SPAN = h(X1 - X0) - SCALE.viewW;
const g = arrivalGeo(geoCtx(SPAN));
/** Scene layer x (depth 1) -> world x in H. */
const wx = (lx: number): number => X0 + (lx + SPAN / 2) / SCALE.H;
/** Scene row -> elevation in H. */
const el = (row: number): number => TOP - row / SCALE.H;

export const DECK = el(g.deck);
const WATER = el(g.wl);
const BEND = wx(g.dockEnd);
const STEP = el(g.deck + Math.max(1, Math.round(g.P * 0.1)));
const WALK = el(g.deck + Math.max(1, Math.round(g.P * 0.2)));
const SPAWN = wx(g.figX);

export const MORNING_LIGHT = lighting({
  ambient: [0.3, 0.36, 0.37],
  keyDir: [0.45, -0.7, 0.55],
  keyColour: [0.66, 0.6, 0.48],
  rimColour: [1, 0.86, 0.6],
  rimDir: [0.55, -0.83],
  rimIntensity: 0.95,
});

export const EVENING_LIGHT = lighting({
  ambient: [0.28, 0.25, 0.32],
  keyDir: [0.55, -0.55, 0.55],
  keyColour: [0.62, 0.46, 0.4],
  rimColour: [1, 0.7, 0.48],
  rimDir: [0.7, -0.7],
  rimIntensity: 1.0,
});

const b = new Box({
  id: "A1",
  title: "A1 The Dock (arrival)",
  region: "A",
  x0: X0,
  x1: X1,
  top: TOP,
  bottom: TOP - 9,
  mood: "morning",
  camera: { mode: "rail", anchor: 0.8 },
  // ambience first: the theme swells in 12 s after Enter, and not before you first move
  audio: { music: "theme", bed: "lake", weatherThrough: 1, enter: { at: 0, rise: 9, wait: 12, move: true }, surface: "wood" },
  weather: { state: "serene", time: "day" },
  neighbours: ["A0", "A2"],
  surface: "wood",
});

// the scene draws the dock, the boardwalk and the cliff foot; this is their collision
styled(b, "none", () => {
  b.floor(X0, BEND, DECK, 0.3, "wood");
  b.floor(BEND, BEND + 0.3, STEP, 0.3, "wood");
  b.floor(BEND + 0.3, X1, WALK, 0.3, "wood");
});

// the keeper's lamp at the bend (the one lamp still burning), moths round it
px(b, "pierLantern", "pier-lantern", BEND - 0.03, DECK, { arm: -1 });
px(b, "moths", "pier-moths", BEND - 0.25, DECK + 0.7, { count: 4, reach: 1.6 });
// the ordinary object that makes the ring huge: a suitcase 3 H left of spawn
px(b, "luggage", "suitcase", SPAWN - 3, DECK, { kind: "suitcase" });
// mooring posts and floats along the old boardwalk, standing in the water in front of it
px(b, "mooring", "mooring-1", BEND + 3.2, WATER, { height: 0.5, buoy: 0.8 });
px(b, "mooring", "mooring-2", BEND + 8.6, WATER, { height: 0.62, buoy: -0.9 });
px(b, "mooring", "mooring-3", X1 - 2.6, WATER, { height: 0.44, buoy: 0 });
// dust over the water in the morning light
px(b, "dust", "dock-dust", SPAWN - 4, DECK + 1.2, { kind: "dust", width: 12, height: 3, count: 26, lit: true });
b.prop("ringwater-state", "state-A1", SPAWN, DECK, {}, { engine: "stub" });

b.spawn("start", SPAWN, DECK, 1).spawn("west", X0 + 0.8, DECK, 1).spawn("east", X1 - 0.8, WALK, -1);
b.exit("left", "A0", "east").exit("right", "A2", "west");
// the first view is exactly the scene's composition while you stand near the spawn
b.zones.push({ x0: h(SPAWN - 3.5), x1: h(SPAWN + 2.2), cx: h(X1 - X0) / 2, bars: 0.035, feather: h(1.5) });

const morning: RoomDef = {
  ...b.build(),
  backdrop: { scene: arrivalScene({ title: "A1 the dock", dock: "world" }), vertical: 0, weather: true },
  lighting: MORNING_LIGHT,
  ambient: { dust: 14, moths: true },
  waterline: g.wl,
  pitY: g.wl + h(0.9),
};

export const dock: RoomDef = sessionRoom(morning, () => ({
  backdrop: { scene: arrivalScene({ title: "A1 the dock (evening)", dock: "world", evening: true }), vertical: 0, weather: true },
  lighting: EVENING_LIGHT,
  weather: { state: "serene", time: "dusk" },
}));
