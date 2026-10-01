// A0 Pier's End (WORLD-PLAN section 4, A0): CANON's short resting overlook to
// the left, the ferry landing, and where the story ends. The same lake and
// ring as the dock, seen from 27 H further left (the backdrop's camera bias:
// the sun and ring stay put, the shaft is seen side-on, the leaning spire of
// rock moves toward the middle). The pier runs out to its two end posts; a
// bench to sit and look; the ferry moored in front with its ferryman asleep;
// the ferry bell on its post; mooring posts, floats and reeds; a tuft of grass
// in the planks. After the round, in the evening, the keeper sits on the bench
// with two cups, one set down beside her.

import { arrivalScene } from "../../../scenes/scenes/arrival.ts";
import { geo as arrivalGeo } from "../../../scenes/scenes/arrival/geo.ts";
import { h, SCALE } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { geoCtx } from "../common.ts";
import { Box } from "../_blockout/_build.ts";
import { px, sessionRoom, styled } from "./_lib.ts";
import { pierShore } from "./_shore.ts";
import { EVENING_BLEND, EVENING_LIGHT, MORNING_BLEND, MORNING_LIGHT } from "./a1-dock.ts";

const X0 = -20;
const X1 = 0;
const TOP = 7.5;
const SPAN = h(X1 - X0) - SCALE.viewW;
const g = arrivalGeo(geoCtx(SPAN));
const el = (row: number): number => TOP - row / SCALE.H;
const DECK = el(g.deck);
const WATER = el(g.wl);
/** The dock's view is centred at world x 17; this room's at -10: 27 H further left. */
const BIAS = h(17 - (X0 + X1) / 2);
const PIER_END = X0 + 1.0 + 0.05;

const b = new Box({
  id: "A0",
  title: "A0 Pier's End",
  region: "A",
  x0: X0,
  x1: X1,
  top: TOP,
  bottom: TOP - 9,
  mood: "morning",
  camera: { mode: "rail", anchor: 0.8 },
  audio: { music: "theme", bed: "lake", weatherThrough: 1, level: 0.6, surface: "wood" },
  weather: { state: "serene", time: "day" },
  neighbours: ["A1", "S2"],
  surface: "wood",
});

// the scene draws the pier; this is its collision (from its end posts to the dock)
styled(b, "none", () => b.floor(PIER_END, X1, DECK, 0.3, "wood"));
// a wall at the pier's end posts so you can't walk off into the lake
styled(b, "none", () => b.block(X0, PIER_END, DECK + 3, DECK - 0.3));

// the bench to sit and look (E: the camera holds on the vista, the UI hides)
px(b, "ringBench", "pier-bench-art", -12, DECK, { kind: "wood", length: 1.7 });
// you sit at its right end; after the round she sits at its left end
b.prop("ring-seat", "pier-bench", -11.65, DECK, {}, { engine: "stub" });
b.vista(-16, -8, -12);
// the ferry, moored in front of the pier; the ferryman asleep until the culvert opens (S2)
px(b, "ferryBoat", "ferry-boat", -3.2, WATER);
b.doors["ferry-boat"] = { room: "S2", spawn: "west" };
// the ferry bell on its post; ring it to call the ferry once the culvert is open
px(b, "bellPost", "bell-post", -5.9, DECK, { height: 1.55, reach: 0.42 });
px(b, "hangingBell", "ferry-bell", -5.9 + 0.44, DECK + 1.47, { size: "small", usable: true });
// mooring posts, floats and reeds in the water; a tuft of grass in the old planks
px(b, "mooring", "pier-mooring-1", -17.2, WATER, { height: 0.58, buoy: 1.0 });
px(b, "mooring", "pier-mooring-2", -8.4, WATER, { height: 0.46, buoy: -0.8 });
// the reeds are the backdrop's now (_shore.ts): in open water past the pier's end and as dark tips
// in the corners. As props they rooted in the planks (-14.6) or inside the wall at the pier's end.
px(b, "grass", "pier-grass", -9.6, DECK, { kind: "grass", width: 0.35, height: 0.14, density: 7 });
px(b, "dust", "pier-dust", -16, DECK + 1.4, { kind: "dust", width: 12, height: 3, count: 18, lit: true });
b.prop("ringwater-state", "state-A0", -10, DECK, { ferry: "ferry-boat", keeper: { id: "keeper-pier", pose: "pier" } }, { engine: "stub" });

b.spawn("east", X1 - 0.8, DECK, -1).spawn("ferry", -4.6, DECK, 1);
b.exit("right", "A1", "west");

const lake = (evening: boolean): RoomDef["backdrop"] => ({
  scene: arrivalScene({ title: evening ? "A0 Pier's End (evening)" : "A0 Pier's End", dock: "pier", bias: BIAS, without: ["near-left", "near-right", "foreground"], evening, extra: pierShore({ span: SPAN }) }),
  vertical: 0,
  weather: true,
});

const morning: RoomDef = {
  ...b.build(),
  backdrop: lake(false),
  lighting: MORNING_LIGHT,
  blend: MORNING_BLEND,
  ambient: { dust: 10, moths: true },
  waterline: g.wl,
  pitY: g.wl + h(0.9),
};

// after the round, this session: evening; the keeper and two cups on the bench
const cupsAt = { x: -12.18, y: DECK + 0.34 };
export const piersEnd: RoomDef = sessionRoom(morning, () => ({
  backdrop: lake(true),
  lighting: EVENING_LIGHT,
  blend: EVENING_BLEND,
  weather: { state: "serene", time: "dusk" },
  add: [
    { recipe: "keeper", id: "keeper-pier", x: h(-12.62 - X0), y: h(TOP - DECK), params: { pose: "pier" }, engine: "pixel" },
    { recipe: "cups", id: "pier-cups", x: h(cupsAt.x - X0), y: h(TOP - cupsAt.y), params: { count: 1 }, engine: "pixel" },
  ],
}));
