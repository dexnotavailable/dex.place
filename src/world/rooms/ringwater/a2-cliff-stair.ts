// A2 Cliff Stair (WORLD-PLAN section 4, A2): the first climb, stairs only
// (0.2 H steps) with one landing, up 5.7 H from the boardwalk to the lodge on
// its shelf. Still vast: you are leaving the water, the lake and the ring
// behind and below you, the shaft moving across the water (the backdrop seen
// from higher: the same lake, its things standing lower in the frame). Three
// lamp posts up the stair, dark until shrine 1 is lit, then lit one after
// another down toward the dock. Bedded rock under a cut-stone stair; ferns in its joints, vines off
// the landing, a windswept pine on the landing, grass on the ledges, rubble at
// the foot. The lodge's end wall at the top with its door built into the logs.

import { arrivalScene } from "../../../scenes/scenes/arrival.ts";
import { h } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { Box } from "../_blockout/_build.ts";
import { px, sessionRoom, styled } from "./_lib.ts";
import { cliffStair as cliffLayers, type CliffSpec } from "./_cliff.ts";
import { SCALE } from "../../config.ts";
import { EVENING_BLEND, EVENING_LIGHT, MORNING_BLEND, MORNING_LIGHT } from "./a1-dock.ts";

// The whole climb in one locked frame (9 H tall): the stair is short enough to see from
// its foot to the lodge's door, and a still frame lets the backdrop's lake hold true.
const X0 = 34;
const X1 = 46;
const TOP = 8.3;

const b = new Box({
  id: "A2",
  title: "A2 Cliff Stair",
  region: "A",
  x0: X0,
  x1: X1,
  top: TOP,
  bottom: TOP - 9,
  mood: "morning",
  camera: { mode: "locked" },
  audio: { music: "theme", bed: "lake", weatherThrough: 1, surface: "stone" },
  weather: { state: "serene", time: "day" },
  neighbours: ["A1", "A3"],
});

// the foot (the old boardwalk's end, on the rock), two flights and the landing, the shelf;
// the backdrop draws them (see _cliff.ts), this is their collision
const steps: CliffSpec["steps"] = [];
let x = 0;
styled(b, "none", () => b.floor(X0, 35.2, 0.3));
let n = b.terrain.length;
styled(b, "none", () => (x = b.stairs(35.2, 0.3, 3.1, 1)));
for (const t of b.terrain.slice(n)) steps.push([t.x, t.x + t.w, t.y]);
const LANDING = x;
styled(b, "none", () => b.floor(x, x + 1.3, 3.1));
n = b.terrain.length;
styled(b, "none", () => (x = b.stairs(x + 1.3, 3.1, 6.0, 1)));
for (const t of b.terrain.slice(n)) steps.push([t.x, t.x + t.w, t.y]);
styled(b, "none", () => b.floor(x, X1, 6.0));

// three lamp posts, dark until shrine 1 is lit; then they come on down toward the dock
px(b, "lampPost", "lamp-1-0", 43.25, 3.1 + 9 * (2.9 / 15), { lit: false, arm: -1 });
px(b, "lampPost", "lamp-1-1", LANDING + 0.9, 3.1, { lit: false, arm: -1 });
px(b, "lampPost", "lamp-1-2", 34.6, 0.3, { lit: false, arm: 1 });
// vines off the landing's lip, grass on the landing (you brush through it), rubble at the foot;
// the rest of the growth (ferns in the joints, the shelf's grass, the pine) is the backdrop's,
// rooted where it grows (_cliff.ts). The old shelf grass and vines at x 43-44 hung over the stair
// in mid-air (their shelf is at 45.2): gone.
px(b, "vines", "stair-vines-1", LANDING + 0.15, 3.1, { width: 1.0, length: 1.1, strands: 5 });
px(b, "grass", "landing-grass", LANDING + 0.35, 3.1, { kind: "grass", width: 0.8, height: 0.2 });
px(b, "rubble", "stair-rubble", 34.95, 0.3, { kind: "stone", width: 0.6, height: 0.22 });
// the lodge on its shelf: its end wall and the front door
// the lodge runs on east past the frame's edge (its interior is A3)
// the door is built into the end wall (the facade cuts its opening, lintel, sill and hood at DOOR)
const DOOR = 45.84;
px(b, "lodgeFacade", "lodge-facade-west", 45.2, 6, { width: 5.4, height: 4.3, side: 1, windowAt: 0.3, door: DOOR - 45.2 });
px(b, "lodgeDoor", "lodge-front-out", DOOR, 6, { kind: "ordinary", frame: "timber" });
b.doors["lodge-front-out"] = { room: "A3", spawn: "front" };
b.prop(
  "ringwater-state",
  "state-A2",
  40,
  3.1,
  {
    lamps: [
      { id: "lamp-1-0", shrine: 1, order: 0 },
      { id: "lamp-1-1", shrine: 1, order: 1 },
      { id: "lamp-1-2", shrine: 1, order: 2 },
    ],
  },
  { engine: "stub" },
);

b.spawn("west", 34.5, 0.3, 1).spawn("lodge", 45.0, 6, -1);
b.exit("left", "A1", "east", -0.5, 2);

const RY = (wy: number): number => h(TOP - wy);
const cliff: CliffSpec = {
  ox: Math.round((SCALE.viewW - h(X1 - X0)) / 2),
  tops: [[h(0), h(35.2 - X0), RY(0.3)], ...steps, [h(LANDING - X0), h(LANDING + 1.3 - X0), RY(3.1)], [h(x - X0), h(X1 + 3.5 - X0), RY(6.0)]],
  steps,
  water: RY(0.025),
  boardwalk: [h(-0.05), RY(0.1)],
  landing: [h(LANDING - X0), h(LANDING + 1.3 - X0), RY(3.1)],
  shelf: [h(x - X0), h(45.2 - X0)],
};

// the lake from a little higher: the horizon (the eye) sits 1.1 H above the dock's
const lake = (evening: boolean): RoomDef["backdrop"] => ({
  scene: arrivalScene({ title: evening ? "A2 cliff stair (evening)" : "A2 cliff stair", dock: "none", rise: h(TOP - 461 / 80 - 1.74), bias: -h(4), without: ["near-left", "near-right", "foreground"], evening, extra: cliffLayers(cliff) }),
  vertical: 0,
  weather: true,
});

const morning: RoomDef = {
  ...b.build(),
  backdrop: lake(false),
  lighting: MORNING_LIGHT,
  blend: MORNING_BLEND,
  ambient: { dust: 12 },
  waterline: RY(0.025),
};

export const cliffStair: RoomDef = sessionRoom(morning, () => ({
  backdrop: lake(true),
  lighting: EVENING_LIGHT,
  blend: EVENING_BLEND,
  weather: { state: "serene", time: "dusk" },
}));
