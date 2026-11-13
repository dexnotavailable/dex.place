// Grey-box, region A: Ringwater (morning, serene). A0 Pier's End, A1 the
// Dock (spawn), A2 the Cliff Stair, A3 the Keeper's Lodge (two floors), A4
// the Keeper's Yard (shrine 1, the map banner), and the ferry ride (S2) that
// the culvert lever opens. Coordinates are WORLD-PLAN section 3's, in H.

import { h } from "../../config.ts";
import type { RoomDef } from "../../room/types.ts";
import { Box, lampPosts, shrineSet } from "./_build.ts";

const serene = { state: "serene", time: "day" } as const;

// ---------------------------------------------------------------------------------
// A0 Pier's End: the resting overlook to the left, the ferry landing, where the story ends.
const a0 = new Box({
  id: "A0",
  title: "A0 Pier's End",
  region: "A",
  x0: -20,
  x1: 0,
  top: 7.5,
  bottom: -1.5,
  mood: "morning",
  camera: { mode: "rail", anchor: 0.8 },
  audio: { music: "theme", bed: "lake", weatherThrough: 1, level: 0.6, surface: "wood" },
  weather: serene,
  neighbours: ["A1", "S2"],
  surface: "wood",
});
a0.floor(-20, 0, 0.3, 0.3, "wood");
a0.prop("bench", "pier-bench", -12, 0.3);
a0.vista(-16, -8, -12);
// the moored ferry: asleep until the culvert is open (lever:culvert), then the short way to the hollow
a0.prop("boat", "ferry-boat", -3.2, 0.2, { flag: "lever:culvert", w: 2 });
a0.doors["ferry-boat"] = { room: "S2", spawn: "west" };
a0.spawn("east", -0.8, 0.3, -1).spawn("ferry", -4.6, 0.3, 1);
a0.exit("right", "A1", "west");
a0.extra = { pitY: a0.Y(-1.2) };

// ---------------------------------------------------------------------------------
// A1 The Dock: arrival and spawn. Scenery first; the only hint is the red line going right.
const a1 = new Box({
  id: "A1",
  title: "A1 The Dock (arrival)",
  region: "A",
  x0: 0,
  x1: 34,
  top: 7.5,
  bottom: -1.5,
  mood: "morning",
  camera: { mode: "rail", anchor: 0.8 },
  // ambience first: the theme swells in 12 s after Enter, and not before you first move
  audio: { music: "theme", bed: "lake", weatherThrough: 1, enter: { at: 0, rise: 9, wait: 12, move: true }, surface: "wood" },
  weather: serene,
  neighbours: ["A0", "A2"],
  surface: "wood",
});
a1.floor(0, 22, 0.3, 0.3, "wood");
// the lantern post is the bend; an older boardwalk 0.2 H lower runs on to the cliff foot
a1.floor(22, 34, 0.1, 0.3, "wood");
a1.prop("red-line", "red-line-dock", 16.4, 0.3, { len: h(22 - 16.4) });
a1.prop("red-line", "red-line-boardwalk", 22, 0.1, { len: h(34 - 22) });
a1.prop("lantern-post", "pier-lantern", 22.3, 0.3);
// the ordinary object that makes the ring huge: a suitcase 3 H left of spawn
a1.prop("crate", "suitcase", 13, 0.3, { size: 0.42, seed: 4 });
a1.spawn("start", 16, 0.3, 1).spawn("west", 0.8, 0.3, 1).spawn("east", 33.2, 0.1, -1);
a1.exit("left", "A0", "east").exit("right", "A2", "west");
a1.vista(8, 24, 16);
a1.extra = { pitY: a1.Y(-1.2) };

// ---------------------------------------------------------------------------------
// A2 Cliff Stair: stairs only (0.2 H steps) with one landing, rising 5.7 H to the lodge's shelf.
const a2 = new Box({
  id: "A2",
  title: "A2 Cliff Stair",
  region: "A",
  x0: 34,
  x1: 46,
  top: 12.5,
  bottom: -2.2,
  mood: "morning",
  camera: { mode: "free", anchor: 0.72 },
  audio: { music: "theme", bed: "lake", weatherThrough: 1, surface: "stone" },
  weather: serene,
  neighbours: ["A1", "A3"],
});
a2.floor(34, 35.2, 0.3);
let x = a2.stairs(35.2, 0.3, 3.1, 1);
a2.floor(x, x + 1.3, 3.1);
x = a2.stairs(x + 1.3, 3.1, 6.0, 1);
a2.floor(x, 46, 6.0);
lampPosts(a2, 1, [[45.2, 6], [40.6, 3.1], [34.6, 0.3]], 0);
a2.door("lodge-front-out", 45.6, 6, { room: "A3", spawn: "front" });
a2.spawn("west", 34.5, 0.3, 1).spawn("lodge", 45.0, 6, -1);
a2.exit("left", "A1", "east", -0.5, 2);

// ---------------------------------------------------------------------------------
// A3 The Keeper's Lodge: ground floor 4.5 H (counter, donation box), loft 3.4 H (the sky door).
// Locked camera, ceiling visible. The loft stair is treads you walk under; a small jump takes it.
const a3 = new Box({
  id: "A3",
  title: "A3 The Keeper's Lodge",
  region: "A",
  x0: 46,
  x1: 60,
  top: 14.1,
  bottom: 5.1,
  mood: "lodge",
  camera: { mode: "locked" },
  audio: { music: "theme", bed: "lodge", weatherThrough: 0.35, muffle: 1, surface: "wood" },
  weather: { interior: true, time: "day" },
  neighbours: ["A2", "A4", "E4"],
  surface: "wood",
});
a3.floor(46, 60, 6, 0.2, "wood");
// the ceiling: the loft is 3.4 H here (plan: 4) so the whole lodge, floor to ceiling, fits one locked screen above the bars
a3.block(46, 60, 14.1, 13.85, "wood");
const loftFrom = a3.treads(47.3, 6, 10.5, 1, "wood");
a3.ledge(loftFrom, 60, 10.5, "wood");
a3.door("lodge-front", 46.6, 6, { room: "A2", spawn: "lodge" });
a3.prop("counter", "registry", 50.6, 6, { dest: "account" });
a3.prop("candles", "counter-candles", 50.1, 6.62, { seed: 3 });
a3.prop("donationBox", "box-lodge", 55.4, 6, { dest: "donate" }, { engine: "pixel" });
a3.prop("donorPlaque", "plaque-lodge", 56.3, 6.95, {}, { engine: "pixel" });
a3.door("lodge-yard", 59.3, 6, { room: "A4", spawn: "west" });
// the sky door: barred by a rail bolted from the far side until the latch is released on the balcony (S4)
a3.door("sky-door", 58.9, 10.5, { room: "E4", spawn: "balcony" }, { latch: "latch:sky-door" });
a3.spawn("front", 47.4, 6, 1).spawn("yard", 58.3, 6, -1).spawn("sky", 57.8, 10.5, -1);

// ---------------------------------------------------------------------------------
// A4 Keeper's Yard: shrine 1, the map banner, the first lamp posts; a ramp down into the reeds.
const a4 = new Box({
  id: "A4",
  title: "A4 Keeper's Yard",
  region: "A",
  x0: 60,
  x1: 76,
  top: 13.2,
  bottom: 4.2,
  mood: "morning",
  camera: { mode: "rail", anchor: 0.8 },
  audio: { music: "theme", bed: "lake", weatherThrough: 1, surface: "earth" },
  weather: serene,
  neighbours: ["A3", "B1"],
  surface: "earth",
});
a4.floor(60, 76, 6);
a4.door("yard-door", 60.7, 6, { room: "A3", spawn: "yard" });
shrineSet(a4, 1, 64.2, 6);
// the map banner on the shrine's arch: slash the red cord, the cloth unrolls, E reads the map (cut:map-banner)
a4.prop("mapBanner", "map-banner", 70.4, 6 + 3.4, { dest: "map" }, { engine: "pixel" });
lampPosts(a4, 1, [[72.6, 6], [75.4, 6]], 3);
a4.spawn("west", 61.5, 6, 1).spawn("east", 75.3, 6, -1);
a4.exit("right", "B1", "west");

// ---------------------------------------------------------------------------------
// S2 the ferry: A0's landing across the lake and through the culvert to B5 (16 s). Not on the map.
const s2 = new Box({
  id: "S2",
  title: "S2 Ferry (A0 to B5)",
  region: "A",
  x0: 0,
  x1: 34,
  top: 7.5,
  bottom: -1.5,
  mood: "morning",
  camera: { mode: "rail", anchor: 0.8 },
  audio: { music: "theme", bed: "lake", weatherThrough: 1, surface: "wood" },
  weather: serene,
  neighbours: ["A0", "B5"],
});
s2.floor(0, 1.6, 0.3, 0.3, "wood");
s2.floor(32.4, 34, 0.3, 0.3, "wood");
s2.prop("carrier", "ferry", 2.7, 0.3, {
  stops: [
    { x: s2.X(2.7), y: s2.Y(0.3) },
    { x: s2.X(31.3), y: s2.Y(0.3) },
  ],
  speed: 1.8,
  variant: "boat",
  w: 2.1,
});
s2.spawn("west", 2.7, 0.3, 1, { prop: "ferry", stop: 0, go: 1 }).spawn("east", 31.3, 0.3, -1, { prop: "ferry", stop: 1, go: 0 });
s2.exit("left", "A0", "ferry").exit("right", "B5", "culvert");
s2.extra = { pitY: s2.Y(-1.2) };
const s2Def = s2.build();
delete s2Def.origin;

export const ringwater: RoomDef[] = [a0.build(), a1.build(), a2.build(), a3.build(), a4.build(), s2Def];
