// A4 Keeper's Yard (WORLD-PLAN section 4, A4): out of the lodge and vast again,
// on the cliff shelf 6 H above the lake. The first shrine (lantern, offering
// bowl, donation box and donor plaque): resting there lights it, sets your
// respawn, lights its lamp on the lodge's lamp board and the lamp posts toward
// the next shrine. The map banner hangs rolled on the shrine's arch, tied with
// a red cord: slash the cord and it unrolls; E reads the map (cut for good in
// the save). The keeper's training dummy (she beats rugs on it), a laundry
// line, grass and flowers, and two lamp posts along the path east to the reeds.

import { arrivalScene } from "../../../scenes/scenes/arrival.ts";
import { h } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { Box } from "../_blockout/_build.ts";
import { litShrines, px, sessionRoom, styled } from "./_lib.ts";
import { shelfGround } from "./_cliff.ts";
import { EVENING_LIGHT, MORNING_LIGHT } from "./a1-dock.ts";

const X0 = 60;
const X1 = 76;
const TOP = 13.2;
const GROUND = 6;

const b = new Box({
  id: "A4",
  title: "A4 Keeper's Yard",
  region: "A",
  x0: X0,
  x1: X1,
  top: TOP,
  bottom: TOP - 9,
  mood: "morning",
  camera: { mode: "rail", anchor: 0.8 },
  audio: { music: "theme", bed: "lake", weatherThrough: 1, surface: "earth" },
  weather: { state: "serene", time: "day" },
  neighbours: ["A3", "B1"],
  surface: "earth",
});

// the backdrop draws the shelf's ground (_cliff.ts); this is its collision
styled(b, "none", () => b.floor(X0, X1, GROUND));

// the lodge's east end with the yard door
px(b, "lodgeFacade", "lodge-facade-east", 62.3, GROUND, { width: 4.3, height: 4.3, side: -1, windowAt: 0.04 });
px(b, "lodgeDoor", "yard-door", 60.7, GROUND, { kind: "ordinary", frame: "timber" });
b.doors["yard-door"] = { room: "A3", spawn: "yard" };
// the keeper's training dummy (she beats rugs on it) and the laundry line
px(b, "trainingDummy", "yard-dummy", 62.4, GROUND);
px(b, "prayerFlags", "laundry", 73.05, GROUND, { kind: "laundry", span: 2.0, height: 1.75, posts: true });
// shrine 1: the lantern (E rests: shrine:1), the offering bowl, the donation box and donor plaque
px(b, "shrineLantern", "shrine-1", 64.2, GROUND, { n: 1, flag: "shrine:1" });
px(b, "offeringBowl", "bowl-1", 64.95, GROUND, { petals: 2 });
px(b, "donationBox", "box-1", 65.6, GROUND, { dest: "donate" });
px(b, "bellPost", "plaque-post", 66.4, GROUND, { height: 1.45, reach: 0, back: true });
px(b, "donorPlaque", "plaque-1", 66.4, GROUND + 0.95);
// the arch and the map banner on it: rolled, tied with a red cord (slash it; E reads the map)
px(b, "shrineArch", "shrine-arch", 70.4, GROUND, { width: 2.6, height: 3.55 });
b.props.push({
  recipe: "mapBanner",
  id: "map-banner",
  x: h(70.4 - X0),
  y: h(TOP - (GROUND + 3.37)),
  engine: "pixel",
  // the banner's shrine marks show the shrines lit in the save when the room is built
  params: {
    dest: "map",
    get shrines() {
      return litShrines();
    },
  },
});
// grass and flowers, two lamp posts along the path east (dark until shrine 1 is lit)
px(b, "grass", "yard-grass-1", 67.1, GROUND, { kind: "flowers", width: 1.8, height: 0.24 });
px(b, "grass", "yard-grass-2", 71.9, GROUND, { kind: "grass", width: 1.0, height: 0.26 });
px(b, "grass", "yard-grass-3", 74.9, GROUND, { kind: "dry", width: 1.0, height: 0.3 });
px(b, "lampPost", "lamp-1-3", 72.6, GROUND, { lit: false, arm: 1 });
px(b, "lampPost", "lamp-1-4", 75.4, GROUND, { lit: false, arm: 1 });
px(b, "dust", "yard-seeds", 66, GROUND + 1.6, { kind: "seeds", width: 10, height: 3, count: 20, lit: true });
b.prop(
  "ringwater-state",
  "state-A4",
  68,
  GROUND,
  {
    lamps: [
      { id: "lamp-1-3", shrine: 1, order: 0 },
      { id: "lamp-1-4", shrine: 1, order: 1 },
    ],
  },
  { engine: "stub" },
);

b.spawn("west", 61.5, GROUND, 1).spawn("east", 75.3, GROUND, -1).spawn("shrine", 63.4, GROUND, 1);
b.exit("right", "B1", "west");

// the lake far below on the left, the far shore and hills ahead
const lake = (evening: boolean): RoomDef["backdrop"] => ({
  scene: arrivalScene({ title: evening ? "A4 keeper's yard (evening)" : "A4 keeper's yard", dock: "none", rise: h(5.7), bias: -h(10), without: ["near-left", "near-right", "foreground", "mid-right"], evening, extra: shelfGround({ ox: 0, y: h(TOP - GROUND) }) }),
  vertical: 0,
  weather: true,
});

const morning: RoomDef = {
  ...b.build(),
  backdrop: lake(false),
  lighting: MORNING_LIGHT,
  ambient: { dust: 10 },
};

export const keepersYard: RoomDef = sessionRoom(morning, () => ({
  backdrop: lake(true),
  lighting: EVENING_LIGHT,
  weather: { state: "serene", time: "dusk" },
}));
