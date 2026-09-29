// Grey-box, region D: the Spire (storm). D1 the Lift Ride (the car to the
// break at y 40; with lever:express it runs straight to the Crown), D2 the
// Outer Climb (six flights of 0.2 H steps and 0.8 H ledges zigzagging up,
// shrine 4 in the storm alcove halfway), D3 the Crown (the arena, the boss
// terminal, the express lever S3), D4 the Blade (the storm breaks).

import type { RoomDef } from "../../room/types.ts";
import { Box, lampPosts, shrineSet } from "./_build.ts";

// ---------------------------------------------------------------------------------
// D1 Lift Ride: 72 H in 16 s (4.5 H/s) to the break; the express stop needs lever:express
// (108 H in 18 s). The car holds you while it moves; the music opens up as you rise.
const d1 = new Box({
  id: "D1",
  title: "D1 Lift Ride",
  region: "D",
  x0: 262,
  x1: 268,
  top: 81,
  bottom: -36.2,
  mood: "storm",
  camera: { mode: "free", anchor: 0.55 },
  audio: { music: "theme", bed: "shaft", weatherThrough: 0.6, muffle: { y0: 0, y1: 0, from: 1, to: 0 }, surface: "metal" },
  weather: { state: "rain", time: "day" },
  neighbours: ["C3", "D2", "D3"],
  surface: "metal",
});
d1.s.audio.muffle = { y0: d1.Y(-32), y1: d1.Y(30), from: 1, to: 0 };
d1.floor(262, 263.5, -32, 1.0, "tile");
d1.floor(266.5, 268, 40, 0.5, "metal");
d1.floor(266.5, 268, 76, 0.5, "metal");
d1.prop("carrier", "spire-lift", 265, -32, {
  stops: [
    { x: d1.X(265), y: d1.Y(-32) },
    { x: d1.X(265), y: d1.Y(40) },
    { x: d1.X(265), y: d1.Y(76), flag: "lever:express", speed: 6 },
  ],
  speed: 4.5,
  variant: "lift",
  w: 3.0,
});
d1.spawn("bottom", 265, -32, 1, { prop: "spire-lift", stop: 0, go: -1 });
d1.spawn("break", 266.9, 40, -1, { prop: "spire-lift", stop: 1 });
d1.spawn("top", 266.9, 76, -1, { prop: "spire-lift", stop: 2 });
d1.exit("left", "C3", "lift", -33, -30).exit("right", "D2", "lift", 39.5, 42).exit("right", "D3", "lift", 75.5, 78);

// ---------------------------------------------------------------------------------
// D2 Outer Climb: rows at y 40, 46, 52, 58 (the storm alcove), 64, 70, 76. Each flight is two
// 0.8 H ledges (single jumps) then 22 steps; rows are one-way ledges so each flight has headroom.
const d2 = new Box({
  id: "D2",
  title: "D2 Outer Climb",
  region: "D",
  x0: 246,
  x1: 286,
  top: 82.5,
  bottom: 37.2,
  mood: "storm",
  camera: { mode: "free", anchor: 0.7 },
  audio: { music: "none", bed: "storm", weatherThrough: 1, surface: "wet-metal" },
  weather: { state: "storm", time: "day" },
  neighbours: ["D1", "D3"],
  surface: "wet-metal",
});
d2.floor(248, 284, 40, 2);
/** A flight from a row at `y` starting at x, going `dir`: two 0.8 H ledges, then steps up to y + 6. Returns the top x. */
const flight = (x: number, y: number, dir: 1 | -1): number => {
  d2.block(Math.min(x, x + dir * 1.2), Math.max(x, x + dir * 1.2), y + 0.8, y);
  d2.block(Math.min(x + dir * 1.2, x + dir * 2.4), Math.max(x + dir * 1.2, x + dir * 2.4), y + 1.6, y);
  return d2.stairs(x + dir * 2.4, y + 1.6, y + 6, dir, "wet-metal", y);
};
flight(272, 40, 1);
d2.ledge(254, 282, 46);
flight(262, 46, -1);
d2.ledge(252, 276, 52);
flight(268, 52, 1);
d2.ledge(252, 278, 58);
// the storm alcove on row 58: a window cut into the spire, roofed; shrine 4, candles, stained glass
d2.block(261.6, 270.4, 61.9, 61.5);
shrineSet(d2, 4, 262.6, 58);
d2.prop("candelabra", "alcove-candelabra", 268.9, 58, { candles: 3, height: 1.15 }, { engine: "pixel" });
d2.prop("stainedGlass", "alcove-glass", 264.6, 58.9, { width: 1.3, height: 2.3, drop: 80 }, { engine: "pixel" });
d2.area({ id: "D2-alcove", title: "D2 Storm Alcove", x0: 262, x1: 270, top: 61.4, bottom: 57.9, camera: { mode: "locked", anchor: 0.66 }, audio: { bed: "alcove", weatherThrough: 0.4 }, roofed: true });
flight(258, 58, -1);
d2.ledge(248, 272, 64);
flight(262, 64, 1);
d2.ledge(250, 272, 70);
flight(260, 70, -1);
d2.ledge(246, 258, 76);
d2.door("lift-gate-d2", 267.2, 40, { room: "D1", spawn: "break" }, { w: 2.5, h: 4, variant: "stone" });
lampPosts(d2, 3, [[256, 40], [275, 46], [256, 52], [270, 64]], 0);
d2.spawn("lift", 265.6, 40, -1).spawn("top", 246.8, 76, 1);
d2.exit("left", "D3", "west", 75.5, 78);

// ---------------------------------------------------------------------------------
// D3 The Crown: the arena at the top. The boss terminal (pixel matter) at the west end
// under an overhang; the arena clamp and arena music while it summons; the express lever
// at the east end (S3) and the lift gate beside it.
const d3 = new Box({
  id: "D3",
  title: "D3 The Crown",
  region: "D",
  x0: 252,
  x1: 284,
  top: 86,
  bottom: 73.4,
  mood: "storm",
  camera: { mode: "rail", anchor: 0.72 },
  audio: { music: "none", bed: "storm", weatherThrough: 1, surface: "wet-metal" },
  weather: { state: "storm", time: "day" },
  neighbours: ["D2", "D1", "D4"],
  surface: "wet-metal",
});
// the arena clamp: the view stays on the fight floor (the terminal at its west end in view) while it summons
d3.s.camera.arena = { x0: d3.X(253), x1: d3.X(283) };
d3.floor(252, 284, 76, 2);
d3.block(252, 256.5, 80.2, 79.8);
d3.prop("bossTerminal", "terminal", 254.6, 76, { dest: "downloads" }, { engine: "pixel" });
d3.door("lift-top", 280.6, 76, { room: "D1", spawn: "top" }, { w: 2.5, h: 4, variant: "stone" });
d3.prop("lever", "express-lever", 282.9, 76, { flag: "lever:express", permanent: true });
d3.spawn("west", 252.6, 76, 1).spawn("lift", 279.4, 76, -1).spawn("east", 283.4, 76, -1);
d3.exit("left", "D2", "top").exit("right", "D4", "west");

// ---------------------------------------------------------------------------------
// D4 The Blade: a gentle slope (8 H over 32 H) to the tip. At x 292 the storm breaks
// (blade:cleared, kept); the theme enters under a 5 s swell from 48 s into the cue.
const d4 = new Box({
  id: "D4",
  title: "D4 The Blade",
  region: "D",
  x0: 284,
  x1: 316,
  top: 90,
  bottom: 73.4,
  mood: "dusk",
  camera: { mode: "rail", anchor: 0.72, slack: 3 },
  audio: { music: "none", bed: "storm", weatherThrough: 1, surface: "stone" },
  weather: {
    zones: [
      { x0: 0, x1: 0.25, state: "storm" },
      { x0: 0.25, x1: 1, state: "after" },
    ],
    feather: 0.06,
    time: "dusk",
  },
  neighbours: ["D3", "E1"],
});
d4.floor(284, 286, 76);
for (let i = 0; i < 40; i++) d4.floor(286 + 0.7 * i, 286 + 0.7 * (i + 1), 76.2 + 0.2 * i);
d4.floor(314, 316, 84);
d4.trigger(292, 293.5, { flag: "blade:cleared" });
d4.area({ id: "D4-break", title: "D4 the storm breaks", x0: 292, x1: 317.5, audio: { music: "theme", enter: { at: 48, rise: 5, delay: 2 }, bed: "dusk" } });
d4.prop("bench", "blade-bench", 313.2, 84);
d4.vista(308, 316, 311, 86);
d4.spawn("west", 284.6, 76, 1).spawn("east", 315.4, 84, -1);
d4.exit("left", "D3", "east").exit("right", "E1", "west");
d4.extra = { weatherIf: { flag: "blade:cleared", program: { state: "after", time: "dusk" } } };

export const spire: RoomDef[] = [d1.build(), d2.build(), d3.build(), d4.build()];
void lampPosts;
