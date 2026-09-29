// Grey-box, region B: Shore and Plain (late morning to overcast, the wind
// rising). B1 Reed Shallows (the wade, the rope bridge S1), B2 the Causeway
// with B3 the Bus Shelter (shrine 2) and B4 Stonetop (optional) as areas
// inside it, and B5 the Hollow Mouth (the crane hook, the culvert lever S2).

import type { RoomDef } from "../../room/types.ts";
import { Box, lampPosts, shrineSet } from "./_build.ts";

// ---------------------------------------------------------------------------------
// B1 Reed Shallows: the ramp down from the yard, the boardwalk (a 0.9 H gap you can
// jump or wade), the 6 H reed channel (wade at half speed, or the bridge once cut).
const b1 = new Box({
  id: "B1",
  title: "B1 Reed Shallows",
  region: "B",
  x0: 76,
  x1: 108,
  top: 12.7,
  bottom: -1,
  mood: "morning",
  camera: { mode: "rail", anchor: 0.72, slack: 1 },
  audio: { music: "theme", bed: "reeds", weatherThrough: 1, surface: "wood" },
  weather: { zones: [{ x0: 0, x1: 1, state: "serene" }], time: "day" },
  neighbours: ["A4", "B2"],
  surface: "wood",
});
b1.floor(76, 76.6, 6, undefined, "earth");
let x = b1.stairs(76.6, 6, 0.2, 1, "stone");
b1.floor(x, 88, 0.2, 0.3, "wood");
// the 0.9 H gap over shallow water: jump it, or step down and wade (0.25 H steps)
b1.floor(88, 88.3, -0.05, undefined, "water");
b1.floor(88.3, 88.6, -0.3, undefined, "water");
b1.floor(88.6, 88.9, -0.05, undefined, "water");
b1.wade(88, 88.9, 0.1);
b1.floor(88.9, 92, 0.2, 0.3, "wood");
// the reed channel: wade across the first time; the bridge deck is hauled up against the east post
b1.floor(92, 92.3, -0.05, undefined, "water");
b1.floor(92.3, 97.7, -0.3, undefined, "water");
b1.floor(97.7, 98, -0.05, undefined, "water");
b1.wade(92, 98, 0.1);
b1.prop("rope-bridge", "rope-bridge", 92, 0.2, { span: b1.X(98) - b1.X(92) });
b1.floor(98, 104, 0.2, 0.3, "wood");
x = b1.stairs(104, 0.2, 1.0, 1, "stone");
b1.floor(x, 108, 1.0);
lampPosts(b1, 1, [[86.4, 0.2], [100.5, 0.2], [106.4, 1.0]], 5);
b1.spawn("west", 76.3, 6, 1).spawn("east", 107.4, 1, -1).spawn("channel-east", 98.6, 0.2, -1);
b1.exit("left", "A4", "east", 4, 8).exit("right", "B2", "west");

// ---------------------------------------------------------------------------------
// B2 The Causeway: 64 H into rising wind. A 1.1 H break at x 120 (a single jump; water
// below returns you), the footprint crater, the 2.5 H break at x 146 (wade around, or
// jump + double + dash), the rib arch, the bus shelter (B3) and Stonetop above it (B4).
const b2 = new Box({
  id: "B2",
  title: "B2 The Causeway",
  region: "B",
  x0: 108,
  x1: 172,
  top: 19,
  bottom: -2,
  mood: "overcast",
  camera: { mode: "rail", anchor: 0.75, slack: 1.5 },
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
b2.floor(108, 114, 1.0);
b2.floor(114, 120, 1.2);
// break 1 (1.1 H): sheet water below
b2.floor(120, 121.1, -0.4, undefined, "water");
b2.pit(120, 121.1, 0.3);
b2.floor(121.1, 134, 1.2);
// the colossus footprint crater: a 3 H dip with stepped ramps and a pool at the bottom
x = b2.stairs(134, 1.2, -1.6, 1);
b2.floor(x, x + 1.6, -1.6, undefined, "water");
b2.wade(x, x + 1.6, -1.3);
x = b2.stairs(x + 1.6, -1.6, 1.4, 1);
b2.floor(x, 146, 1.4);
// break 2 (2.5 H): a shin-deep wade around beneath, or the dash line across the top
x = b2.stairs(146, 1.4, 0.8, 1);
b2.floor(x, 147.6, 0.8, undefined, "water");
b2.wade(146, 148.5, 1.1);
x = b2.stairs(147.6, 0.8, 1.4, 1);
b2.floor(148.5, 154, 1.6);
// the rib arch: optional one-way ribs (double jump)
b2.ledge(150, 151.4, 3.2).ledge(152.4, 153.8, 4.7);
b2.floor(154, 160, 1.8);
b2.floor(160, 172, 2.0);
// B3 the bus shelter: a roofed pocket (locked camera while inside), shrine 2
b2.block(159.8, 168, 5.3, 5.0);
shrineSet(b2, 2, 161.2, 2.0);
b2.area({ id: "B3", title: "B3 Bus Shelter", x0: 160, x1: 168, top: 4.9, bottom: 1.9, camera: { mode: "locked", anchor: 0.7 }, audio: { duck: 4 }, roofed: true });
// B4 Stonetop: double-jump ledges 1.3 to 1.5 H apart from the shelter's roof to a bench at the top
b2.ledge(158.2, 159.6, 3.3).ledge(156.6, 158.0, 4.6);
const stone: [number, number, number][] = [
  [166, 167.5, 6.8],
  [169, 170.5, 8.3],
  [166, 167.5, 9.8],
  [162.5, 164, 11.3],
  [159.5, 161, 12.8],
  [162.5, 164, 14.3],
  [165.5, 167, 15.8],
];
for (const [a, b, y] of stone) b2.ledge(a, b, y);
b2.ledge(159.8, 166.2, 17.3);
b2.prop("bench", "stonetop-bench", 162.5, 17.3);
b2.area({ id: "B4", title: "B4 Stonetop", x0: 155, x1: 172, top: 19, bottom: 3.0, camera: { mode: "free", anchor: 0.62 } });
b2.vista(160, 166, 163, 14.5, 0.06, 19, 16.5);
lampPosts(b2, 1, [[111, 1.0], [125, 1.2], [145.2, 1.4], [157, 1.8]], 8);
b2.spawn("west", 108.6, 1.0, 1).spawn("east", 171.4, 2.0, -1);
b2.exit("left", "B1", "east", -1, 3).exit("right", "B5", "top", 1, 4);

// ---------------------------------------------------------------------------------
// B5 Hollow Mouth: the ground falls away into the fallen structure. The culvert platform
// (the gate to the ferry, its lever inside: S2), the crane hook (34 H, called from either end),
// an optional climb down by ledges, and the market street at the bottom.
const b5 = new Box({
  id: "B5",
  title: "B5 Hollow Mouth",
  region: "B",
  x0: 172,
  x1: 188,
  top: 6,
  bottom: -38,
  mood: "overcast",
  camera: { mode: "free", anchor: 0.35, lookY: 1.5 },
  audio: { music: "theme", bed: "shaft", weatherThrough: 1, level: 0.43, surface: "stone" },
  weather: { state: "overcast", time: "day" },
  neighbours: ["B2", "C1", "S2"],
});
b5.floor(172, 179, 2.0, 1.2);
x = b5.stairs(179, 2.0, 0.0, 1, undefined, -1.2);
b5.floor(x, 185.6, 0.0, 1.2);
b5.floor(187.2, 188, 0.0, 1.2);
b5.prop("lever", "culvert-lever", 182.6, 0, { flag: "lever:culvert", permanent: true });
b5.door("culvert-gate", 183.9, 0, { room: "S2", spawn: "east" }, { latch: "lever:culvert", variant: "stone" });
b5.prop("lever", "hook-call-top", 185.1, 0, { target: "crane", msg: "call:0" });
b5.prop("carrier", "crane", 186.4, 0, {
  stops: [
    { x: b5.X(186.4), y: b5.Y(0) },
    { x: b5.X(186.4), y: b5.Y(-32) },
  ],
  speed: 3.2,
  variant: "hook",
  w: 1.6,
  top: b5.Y(5.5),
});
// the optional way down: drops to ledges along the west wall
for (const [a, b, y] of [
  [172.3, 174.2, -3],
  [175, 176.8, -7],
  [172.3, 174.2, -11],
  [175, 176.8, -15],
  [172.3, 174.2, -19],
  [175, 176.8, -23],
  [172.3, 174.2, -27],
] as [number, number, number][])
  b5.ledge(a, b, y);
b5.floor(172, 188, -32);
b5.prop("lever", "hook-call-bottom", 184.6, -32, { target: "crane", msg: "call:1" });
b5.spawn("top", 172.6, 2.0, 1).spawn("culvert", 183.0, 0, -1).spawn("bottom", 187.3, -32, -1);
b5.exit("left", "B2", "east", 1, 4).exit("right", "C1", "west", -34, -30);

export const plain: RoomDef[] = [b1.build(), b2.build(), b5.build()];
