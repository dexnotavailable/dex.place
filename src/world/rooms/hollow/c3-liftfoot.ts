// C3 Lift Foot (WORLD-PLAN section 4): the threshold, the start of the
// ascent. A waiting room arranged wrong at the foot of a megastructure: the
// spire's stem pierces the hollow floor here. Cozy and a little uncanny, calm.
// Cold fluorescent strips against the amber outside the window; a warning
// light turns while the lift moves. The radio on the empty operator's chair
// keeps the theme going, muffled. Ids match the grey-box C3 (the gate boards
// D1's car at "bottom"; the ride brings you back to "lift").

import { h, SCALE } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { Box } from "../_blockout/_build.ts";
import { lighting } from "../common.ts";
import { liftFootScene } from "./_scene/liftfoot.ts";
import { dressTerrain, HOLLOW_RAMP } from "./_room.ts";

const X0 = 252;
const X1 = 270;
const TOP = -24.3;
const FLOOR = -32;
const px = { engine: "pixel" as const };
const up = (hh: number): number => FLOOR + hh;

const b = new Box({
  id: "C3",
  title: "C3 Lift Foot",
  region: "C",
  x0: X0,
  x1: X1,
  top: TOP,
  bottom: -33.3,
  mood: "tile",
  // the station hall is a room: zoomed in so it fills the frame
  camera: { mode: "locked", zoom: "fit" },
  audio: { music: "theme", bed: "waiting", muffle: 1, weatherThrough: 0, surface: "tile" },
  weather: { state: "serene", time: "day" },
  neighbours: ["C1", "D1"],
  underground: true,
  surface: "tile",
});
b.floor(X0, X1, FLOOR, undefined, "tile");
b.prop("hollowFloor", "tiles", X0, FLOOR, { width: h(X1 - X0), depth: 1.3, kind: "tile" }, px);

// the lift: its gate (a big door that slides), the car parked in the shaft behind it, the beacon
b.prop("hollowLiftCar", "lift-car", 265.6, FLOOR, { shaft: 4.4, watch: "lift-gate" }, px);
b.prop("door", "lift-gate", 265.6, FLOOR, { kind: "gate", beyond: "none", frame: "stone" }, px);
b.doors["lift-gate"] = { room: "D1", spawn: "bottom" };
b.prop("hollowBeacon", "lift-beacon", 265.6, up(4.72), { watch: "lift-gate" }, px);
b.prop("spireArrowSign", "lift-sign", 262.7, up(2.4), {}, px);

// the waiting room: two rows of chairs (one faces the window, away from the lift), the frozen
// ticket display, luggage waiting, a training dummy for a warm-up before the storm
b.prop("waitingChairs", "chairs-a", 255.4, FLOOR, { seats: 4, facing: -1 }, px);
b.prop("waitingChairs", "chairs-b", 259.4, FLOOR, { seats: 3, facing: 1 }, px);
b.prop("ticketDisplay", "ticket", 259.4, up(3.1), { number: "47" }, px);
b.prop("luggage", "suitcase", 257.6, FLOOR, { kind: "suitcase" }, px);
b.prop("luggage", "trunk", 253.4, FLOOR, { kind: "trunk" }, px);
b.prop("luggage", "bag", 260.9, FLOOR, { kind: "bag" }, px);
b.prop("crate", "crate-lift", 254.1, FLOOR, { size: 0.45, stack: 1 }, px);
b.prop("trainingDummy", "dummy-lift", 262.2, FLOOR, {}, px);

// the empty operator's booth beside the gate, its chair, the radio on the chair
b.prop("operatorBooth", "booth", 268.7, FLOOR, {}, px);
b.prop("operatorChair", "operator-chair", 267.6, FLOOR, {}, px);
b.prop("hollowRadio", "radio-lift", 267.6, up(0.46), {}, px);

// cold fluorescent strips; a paper or two; dust in the cold light
for (const [i, x] of [254.6, 258.2, 261.6].entries()) b.prop("fluorescentStrip", `tube-${i}`, x, up(7.2), { length: 1.5, drop: 0.25 }, px);
b.prop("paper", "paper-lift", 256.6, FLOOR, { count: 2 }, px);
b.prop("dust", "motes-lift", 253.5, FLOOR, { kind: "dust", width: 8, height: 3, count: 14, lit: true }, px);

b.spawn("west", 252.6, FLOOR, 1).spawn("lift", 264, FLOOR, -1);
b.exit("left", "C1", "east");

const built = b.build();

export const c3: RoomDef = {
  ...built,
  backdrop: {
    scene: liftFootScene({
      roomW: built.w,
      roomH: built.h,
      ref: Math.round((built.h - SCALE.viewH) / 2),
      floor: h(TOP - FLOOR),
      x0: X0,
      H: SCALE.H,
      window: [253.4, 258.6, 1.5, 5.4],
      stem: 261.4,
      shaft: [264.2, 267.0, 4.35],
    }),
    vertical: 1,
    weather: false,
  },
  lighting: lighting({
    ambient: [0.26, 0.29, 0.29],
    keyDir: [-0.3, -0.8, 0.5],
    keyColour: [0.56, 0.64, 0.64],
    rimColour: [1, 0.66, 0.38],
    rimDir: [-0.8, -0.6],
    rimIntensity: 0.75,
  }),
  terrain: dressTerrain(built.terrain, { tile: "none" }, HOLLOW_RAMP.tile),
  ambient: { dust: 4, moths: false },
};
